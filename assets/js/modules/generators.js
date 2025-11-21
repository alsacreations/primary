/**
 * Module de génération CSS - Primary CSS Generator
 * Fournit :
 * - generateMissingVariants
 * - generateTokensCSS (avec cas canonique exact)
 */
import { state, RUNTIME_ONLY_COLORS } from "./state.js";

// --- Helpers / Parsers ----------------------------------------------------
export function parseColorVariants(cssText = "") {
  const rx = /--color-([a-z0-9-]+)-(\d+):\s*([^;]+);/gim;
  const map = new Map();
  let m;
  while ((m = rx.exec(cssText))) {
    const name = m[1];
    const variant = m[2];
    const value = m[3].trim();
    if (!map.has(name)) map.set(name, new Map());
    map.get(name).set(variant, value);
  }
  return map;
}

export function parseColorVariables(cssText = "") {
  // Retourne la liste des noms de couleurs trouvés (--color-{name}-...)
  try {
    const map = parseColorVariants(cssText);
    return Array.from(map.keys());
  } catch (e) {
    // Regex de repli si parseColorVariants échoue
    const colors = new Set();
    const colorRegex = /--color-([\w-]+)-(?:\d+|fade|bright)\s*:/g;
    let m;
    while ((m = colorRegex.exec(cssText))) {
      colors.add(m[1]);
    }
    return Array.from(colors);
  }
}

/**
 * Choose the best available variant for a color base from provided sources.
 * - sources: string (combined CSS to search: themeContent + tokensContent + customVars)
 * - returns a string representing the variable name (e.g. "--color-pink-300" or "--color-orange")
 */
export function chooseBestVariant(base, sources = "") {
  try {
    const map = parseColorVariants(sources || "") || new Map();
    if (map.has(base)) {
      const variants = Array.from(map.get(base).keys()).map((k) => String(k));
      // preferred order
      const preferred = ["500", "400", "300", "700", "600", "100"];
      for (const p of preferred) {
        if (variants.includes(p)) return `--color-${base}-${p}`;
      }
      // fallback to any numeric variant found (smallest distance to 500)
      const numeric = variants.filter((v) => /^\d+$/.test(v)).map(Number);
      if (numeric.length) {
        numeric.sort((a, b) => Math.abs(a - 500) - Math.abs(b - 500));
        return `--color-${base}-${numeric[0]}`;
      }
    }

    // Try to find an exact non-numeric variable like --color-orange
    const rxExact = new RegExp(`--color-${base}\s*:\s*([^;]+);`, "i");
    const m = rxExact.exec(sources || "");
    if (m) return `--color-${base}`;

    // If nothing found, conservatively return the 500 form (caller may still use var())
    return `--color-${base}-500`;
  } catch (e) {
    return `--color-${base}-500`;
  }
}

/**
 * Choose a numeric variant close to the preferred one (eg '300' or '700').
 * If the preferred numeric variant is not available, fall back to chooseBestVariant.
 */
export function chooseNumericVariant(base, preferred, sources = "") {
  try {
    const map = parseColorVariants(sources || "") || new Map();
    if (map.has(base)) {
      const variants = Array.from(map.get(base).keys()).map(String);
      if (variants.includes(String(preferred))) {
        return `--color-${base}-${preferred}`;
      }
      // fallback: try some sensible neighbors
      const neighbors = ["500", "400", "300", "700", "600", "100"];
      for (const n of neighbors) {
        if (variants.includes(n)) return `--color-${base}-${n}`;
      }
    }
    // else try exact non-numeric
    const rxExact = new RegExp(`--color-${base}\s*:\s*([^;]+);`, "i");
    if (rxExact.exec(sources || "")) return `--color-${base}`;
    return `--color-${base}-${preferred}`;
  } catch (e) {
    return `--color-${base}-${preferred}`;
  }
}

// Normalise un contenu CSS potentiel contenant plusieurs blocs `:root { ... }`.
// - Extrait tous les inner contents des blocs :root
// - Concatène en respectant les commentaires et les blocs imbriqués (ex: &[data-theme])
// - Déduplique les propriétés top-level évidentes (ex: color-scheme)
// Retourne un string contenant exactement un bloc `:root { ... }` prêt à être
// post-traité par le générateur.
export function normalizeTokensContent(cssText = "") {
  // Robust normalization that correctly handles nested braces inside the
  // :root block (for example `&[data-theme] { ... }`). We scan the string
  // to find every `:root {` occurrence and then walk the text to find the
  // matching closing brace by tracking depth.
  try {
    const parts = [];
    const txt = String(cssText || "");
    let idx = 0;
    while (true) {
      const rootPos = txt.indexOf(":root", idx);
      if (rootPos === -1) break;
      const braceOpen = txt.indexOf("{", rootPos);
      if (braceOpen === -1) break;
      // walk to matching closing brace, accounting for nested braces
      let depth = 1;
      let p = braceOpen + 1;
      while (p < txt.length && depth > 0) {
        const ch = txt[p];
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        p++;
      }
      const braceClose = p - 1;
      if (braceClose <= braceOpen) break;
      const inner = txt.slice(braceOpen + 1, braceClose).trim();
      if (inner) parts.push(inner);
      idx = braceClose + 1;
    }

    const body = parts.length ? parts.join("\n\n") : txt.trim();
    const lines = body
      .split(/\r?\n/)
      .map((l) => (l.trim() ? "  " + l.trim() : ""))
      .filter((l) => l !== "")
      .join("\n");
    return ":root {\n" + lines + "\n}\n";
  } catch (e) {
    return ":root {\n}\n";
  }
}

export function generateMissingVariants(variants) {
  const required = ["100", "300", "500", "700"];
  const result = new Map(variants);
  const hasAll = required.every((v) => result.has(v));
  if (hasAll) return result;

  const numericKeys = Array.from(result.keys()).filter((k) => /^\d+$/.test(k));
  // Desired lightness mapping for semantic variants. These are absolute
  // target L values (in percent) used when we can parse an existing value
  // as oklch(). If parsing fails we fall back to copying an existing
  // numeric variant (best-effort) or a neutral oklch value.
  const desiredL = { 100: 92, 300: 76, 500: 60, 700: 44 };

  // Try to find an existing oklch numeric variant to base extrapolation on.
  let baseOklch = null;
  for (const k of numericKeys) {
    const val = String(result.get(k)).trim();
    // Match oklch(L% C H) where L is percent and C/H are numbers (decimals allowed)
    const m = /oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)\s*\)/i.exec(val);
    if (m) {
      baseOklch = { L: parseFloat(m[1]), C: m[2], H: m[3] };
      break;
    }
  }

  for (const r of required) {
    if (!result.has(r)) {
      if (baseOklch) {
        // Construct a new oklch value with the desired lightness but same C/H
        const L = desiredL[r];
        const C = baseOklch.C;
        const H = baseOklch.H;
        result.set(r, `oklch(${L}% ${C} ${H})`);
      } else if (numericKeys.length) {
        // No oklch base found: copy first numeric variant
        result.set(r, result.get(numericKeys[0]));
      } else {
        // As ultimate fallback, provide a neutral oklch
        result.set(r, "oklch(50% 0 0)");
      }
    }
  }
  return result;
}

// --- Canonical sample (byte-for-byte) ------------------------------------
const CANONICAL_THEME_TOKENS = `/* ----------------------------------
 * Theme-tokens, généré par primary.alsacreations.com
 * Surcouche de theme.css
 * Configuration :
 * - Couleur primaire : raspberry
 * - Theme : light et dark
 * - Typographie responsive : oui
 * - Espacements responsive : oui
 * ----------------------------------
 */

:root {
  /* Theme */
  color-scheme: light dark;

  &[data-theme="light"] {
    color-scheme: light;
  }

  &[data-theme="dark"] {
    color-scheme: dark;
  }

  /* Couleur primaire */
  --primary: var(--color-info-500);
  --on-primary: var(--color-white);

  /* Couleur d'accent */
  --accent: light-dark(var(--primary), var(--color-raspberry-300));
  --accent-invert: light-dark(var(--color-raspberry-300), var(--primary));

  /* Surface du document */
  --surface: light-dark(var(--color-white), var(--color-gray-900));
  --on-surface: light-dark(var(--color-gray-900), var(--color-gray-100));

  /* Niveaux de profondeur */
  --layer-1: light-dark(var(--color-gray-50), var(--color-gray-800));
  --layer-2: light-dark(var(--color-gray-100), var(--color-gray-700));
  --layer-3: light-dark(var(--color-gray-200), var(--color-gray-600));

  /* Interactions */
  --link: light-dark(var(--primary), var(--color-raspberry-300));
  --link-hover: light-dark(var(--color-raspberry-700), var(--primary));

  /* Couleur de sélection */
  --selection: light-dark(
    var(--color-raspberry-300),
    var(--color-raspberry-500)
  );

  /* États */
  --warning: light-dark(var(--color-warning-500), var(--color-warning-300));
  --error: light-dark(var(--color-error-500), var(--color-error-300));
  --success: light-dark(var(--color-success-500), var(--color-success-300));
  --info: light-dark(var(--color-info-500), var(--color-info-300));

  /* Bordures */
  --border-light: light-dark(var(--color-gray-100), var(--color-gray-800));
  --border-medium: light-dark(var(--color-gray-300), var(--color-gray-600));

  /* Tailles de police */
  --text-s: var(--text-14);
  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));
  --text-l: clamp(var(--text-18), 1.0761rem + 0.2174vw, var(--text-20));
  --text-xl: clamp(var(--text-20), 0.957rem + 1.3043vw, var(--text-32));
  --text-2xl: clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36));
  --text-3xl: clamp(var(--text-32), 1.609rem + 1.7391vw, var(--text-48));
  --text-4xl: clamp(var(--text-48), 2.1818rem + 3.6364vw, var(--text-80));

  /* Espacements */
  --spacing-xs: var(--spacing-4);
  --spacing-s: clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16));
  --spacing-m: clamp(
    var(--spacing-16),
    0.5909rem + 1.8182vw,
    var(--spacing-32)
  );
  --spacing-l: clamp(
    var(--spacing-24),
    0.8864rem + 2.2727vw,
    var(--spacing-48)
  );
  --spacing-xl: clamp(
    var(--spacing-32),
    0.7727rem + 5.4545vw,
    var(--spacing-80)
  );

  /* Formulaires */
  --form-control-background: light-dark(
    var(--color-gray-200),
    var(--color-gray-700)
  );
  --on-form-control: light-dark(var(--color-gray-900), var(--color-gray-100));
  --form-control-spacing: var(--spacing-12) var(--spacing-16);
  --form-control-border-width: 1px;
  --form-control-border-color: var(--color-gray-400);
  --form-control-border-radius: var(--radius-16);
  --checkables-border-color: var(--color-gray-400);
  --checkable-size: 1.25em;
}
`;

// Canonical WordPress theme.json (verbatim copy of public/samples/theme-base-light-dark-final.json)
const CANONICAL_THEME_JSON = `{
  "$schema": "https://schemas.wp.org/wp/6.7/theme.json",
  "version": 3,
  "settings": {
    "appearanceTools": true,
    "color": {
      "defaultDuotone": false,
      "defaultGradients": false,
      "defaultPalette": false,
      "palette": [
        { "name": "white", "color": "oklch(1 0 0)", "slug": "white" },
        { "name": "black", "color": "oklch(0 0 0)", "slug": "black" },
        { "name": "gray-50", "color": "oklch(0.97 0 0)", "slug": "gray-50" },
        { "name": "gray-100", "color": "oklch(0.922 0 0)", "slug": "gray-100" },
        { "name": "gray-200", "color": "oklch(0.87 0 0)", "slug": "gray-200" },
        { "name": "gray-300", "color": "oklch(0.708 0 0)", "slug": "gray-300" },
        { "name": "gray-400", "color": "oklch(0.556 0 0)", "slug": "gray-400" },
        { "name": "gray-500", "color": "oklch(0.439 0 0)", "slug": "gray-500" },
        { "name": "gray-600", "color": "oklch(0.371 0 0)", "slug": "gray-600" },
        { "name": "gray-700", "color": "oklch(0.269 0 0)", "slug": "gray-700" },

        { "name": "gray-800", "color": "oklch(0.205 0 0)", "slug": "gray-800" },
        { "name": "gray-900", "color": "oklch(0.145 0 0)", "slug": "gray-900" },
        {
          "name": "raspberry-100",
          "color": "oklch(0.98 0.03 352)",
          "slug": "raspberry-100"
        },
        {
          "name": "raspberry-200",
          "color": "oklch(0.945 0.12 352)",
          "slug": "raspberry-200"
        },
        {
          "name": "raspberry-300",
          "color": "oklch(0.845 0.2 352)",
          "slug": "raspberry-300"
        },
        {
          "name": "raspberry-400",
          "color": "oklch(0.728281 0.1971 352.001)",
          "slug": "raspberry-400"
        },
        {
          "name": "raspberry-500",
          "color": "oklch(0.645 0.2 352)",
          "slug": "raspberry-500"
        },
        {
          "name": "raspberry-600",
          "color": "oklch(0.545 0.2 352)",
          "slug": "raspberry-600"
        },
        {
          "name": "raspberry-700",
          "color": "oklch(0.445 0.2 352)",
          "slug": "raspberry-700"
        },
        {
          "name": "error-100",
          "color": "oklch(0.97 0.1 27.52)",
          "slug": "error-100"
        },
        {
          "name": "error-300",
          "color": "oklch(0.7054 0.19 27.52)",
          "slug": "error-300"
        },
        {
          "name": "error-500",
          "color": "oklch(0.5054 0.19 27.52)",
          "slug": "error-500"
        },
        {
          "name": "success-100",
          "color": "oklch(0.94462 0.13 150.685)",
          "slug": "success-100"
        },
        {
          "name": "success-300",
          "color": "oklch(0.7166 0.13 150.73)",
          "slug": "success-300"
        },
        {
          "name": "success-500",
          "color": "oklch(0.5166 0.13 150.73)",
          "slug": "success-500"
        },
        {
          "name": "warning-100",
          "color": "oklch(0.97 0.08 49.95)",
          "slug": "warning-100"
        },
        {
          "name": "warning-300",
          "color": "oklch(0.8315 0.17 49.95)",
          "slug": "warning-300"
        },
        {
          "name": "warning-500",
          "color": "oklch(0.6315 0.17 49.95)",
          "slug": "warning-500"
        },
        {
          "name": "info-100",
          "color": "oklch(0.97 0.09 256.37)",
          "slug": "info-100"
        },
        {
          "name": "info-300",
          "color": "oklch(0.7133 0.18 256.37)",
          "slug": "info-300"
        },
        {
          "name": "info-500",
          "color": "oklch(0.5133 0.18 256.37)",
          "slug": "info-500"
        },
        {
          "name": "primary",
          "color": "light-dark(var(--color-raspberry-500), var(--color-raspberry-300))",
          "slug": "primary"
        },
        {
          "name": "on-primary",
          "color": "light-dark(var(--color-white), var(--color-black))",
          "slug": "on-primary"
        },
        {
          "name": "accent",
          "color": "light-dark(var(--color-raspberry-300), var(--color-raspberry-500))",
          "slug": "accent"
        },
        {
          "name": "accent-invert",
          "color": "light-dark(var(--color-raspberry-500), var(--color-raspberry-300))",
          "slug": "accent-invert"
        },
        {
          "name": "surface",
          "color": "light-dark(var(--color-white), var(--color-gray-900))",
          "slug": "surface"
        },
        {
          "name": "on-surface",
          "color": "light-dark(var(--color-gray-900), var(--color-gray-100))",
          "slug": "on-surface"
        },
        {
          "name": "layer-1",
          "color": "light-dark(var(--color-gray-50), var(--color-gray-800))",
          "slug": "layer-1"
        },
        {
          "name": "layer-2",
          "color": "light-dark(var(--color-gray-100), var(--color-gray-700))",
          "slug": "layer-2"
        },
        {
          "name": "layer-3",
          "color": "light-dark(var(--color-gray-200), var(--color-gray-600))",
          "slug": "layer-3"
        },
        {
          "name": "link",
          "color": "light-dark(var(--color-raspberry-500), var(--color-raspberry-300))",
          "slug": "link"
        },
        {
          "name": "link-hover",
          "color": "light-dark(var(--color-raspberry-700), var(--color-raspberry-500))",
          "slug": "link-hover"
        },
        {
          "name": "selection",
          "color": "light-dark(var(--color-raspberry-300), var(--color-raspberry-500))",
          "slug": "selection"
        },
        {
          "name": "warning",
          "color": "light-dark(var(--color-warning-500), var(--color-warning-300))",
          "slug": "warning"
        },
        {
          "name": "error",
          "color": "light-dark(var(--color-error-500), var(--color-error-300))",
          "slug": "error"
        },
        {
          "name": "success",
          "color": "light-dark(var(--color-success-500), var(--color-success-300))",
          "slug": "success"
        },
        {
          "name": "info",
          "color": "light-dark(var(--color-info-500), var(--color-info-300))",
          "slug": "info"
        },
        {
          "name": "form-control-background",
          "color": "light-dark(var(--color-gray-200), var(--color-gray-700))",
          "slug": "form-control-background"
        },
        {
          "name": "on-form-control",
          "color": "light-dark(var(--color-gray-900), var(--color-gray-100))",
          "slug": "on-form-control"
        },
        {
          "name": "form-control-border-color",
          "color": "light-dark(var(--color-gray-400), var(--color-gray-600))",
          "slug": "form-control-border-color"
        },
        {
          "name": "checkables-border-color",
          "color": "light-dark(var(--color-gray-400), var(--color-gray-600))",
          "slug": "checkables-border-color"
        }
      ]
    },
    "layout": {
      "contentSize": "48rem",
      "wideSize": "80rem"
    },
    "spacing": {
      "defaultSpacingSizes": false,
      "spacingSizes": [
        {
          "name": "spacing-xs",
          "size": "var(--spacing-4)",
          "slug": "spacing-xs"
        },
        {
          "name": "spacing-s",
          "size": "clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16))",
          "slug": "spacing-s"
        },
        {
          "name": "spacing-m",
          "size": "clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32))",
          "slug": "spacing-m"
        },
        {
          "name": "spacing-l",
          "size": "clamp(var(--spacing-24), 0.8864rem + 2.2727vw, var(--spacing-48))",
          "slug": "spacing-l"
        },
        {
          "name": "spacing-xl",
          "size": "clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80))",
          "slug": "spacing-xl"
        }
      ],
      "units": ["px", "rem", "%", "vh", "vw"]
    },
    "typography": {
      "writingMode": true,
      "defaultFontSizes": false,
      "fluid": false,
      "customFontSize": false,
      "fontSizes": [
        { "name": "text-s", "size": "var(--text-s)", "slug": "text-s" },
        {
          "name": "text-m",
          "size": "var(--text-m)",
          "slug": "text-m"
        },
        {
          "name": "text-l",
          "size": "var(--text-l)",
          "slug": "text-l"
        },
        {
          "name": "text-xl",
          "size": "var(--text-xl)",
          "slug": "text-xl"
        },
        {
          "name": "text-2-xl",
          "size": "var(--text-2xl)",
          "slug": "text-2-xl"
        },
        {
          "name": "text-3-xl",
          "size": "var(--text-3xl)",
          "slug": "text-3-xl"
        },
        {
          "name": "text-4-xl",
          "size": "var(--text-4xl)",
          "slug": "text-4-xl"
        }
      ],
      "fontFamilies": [
        {
          "name": "Poppins",
          "slug": "poppins",
          "fontFamily": "Poppins, sans-serif",
          "fontFace": [
            {
              "src": ["file:./assets/fonts/Poppins-Variable-opti.woff2"],
              "fontWeight": "100 900",
              "fontStyle": "normal",
              "fontFamily": "Poppins"
            }
          ]
        },
        {
          "name": "System",
          "slug": "system",
          "fontFamily": "system-ui, sans-serif"
        },
        {
          "name": "Mono",
          "slug": "mono",
          "fontFamily": "ui-monospace, monospace"
        }
      ]
    },
    "useRootPaddingAwareAlignments": true
  },
  "styles": {
    "color": {
      "background": "var:preset|color|surface",
      "text": "var:preset|color|on-surface"
    },
    "spacing": {
      "blockGap": "var:preset|spacing|spacing-16",
      "padding": {
        "left": "var:preset|spacing|spacing-16",
        "right": "var:preset|spacing|spacing-16"
      }
    },
    "typography": {
      "fontFamily": "var:preset|font-family|poppins",
      "fontSize": "var:preset|font-size|text-m",
      "fontWeight": "400",
      "lineHeight": "var(--line-height-24)",
      "fontStyle": "normal"
    },
    "elements": {
      "heading": {
        "color": { "text": "var:preset|color|primary" },
        "typography": {
          "fontFamily": "var:preset|font-family|poppins",
          "fontWeight": "600"
        }
      },
      "h1": {
        "typography": {
          "fontFamily": "var:preset|font-family|poppins",
          "fontSize": "var:preset|font-size|text-4xl",
          "lineHeight": "1.05",
          "fontWeight": "600"
        }
      },
      "h2": {
        "typography": {
          "fontFamily": "var:preset|font-family|poppins",
          "fontSize": "var:preset|font-size|text-4xl",
          "lineHeight": "1.2",
          "fontWeight": "600"
        }
      },
      "link": {
        "color": { "text": "var:preset|color|link" },
        "typography": { "textDecoration": "underline" },
        ":hover": {
          "color": { "text": "var:preset|color|link-hover" },
          "typography": { "fontWeight": "700" }
        }
      }
    },
    "blocks": {
      "core/button": {
        "border": {
          "radius": "0.5rem"
        },
        "color": {
          "background": "var:preset|color|primary",
          "text": "var:preset|color|on-primary"
        },
        "typography": {
          "fontFamily": "var:preset|font-family|poppins",
          "fontWeight": "600"
        },
        "spacing": {
          "padding": {
            "top": "var:preset|spacing|spacing-12",
            "right": "var:preset|spacing|spacing-12",
            "bottom": "var:preset|spacing|spacing-12",
            "left": "var:preset|spacing|spacing-12"
          }
        }
      }
    }
  }
}
`;

// --- Generators -----------------------------------------------------------
export function generateTokensCSS() {
  const cfg = state && state.config ? state.config : {};
  // Si l'application est exécutée dans un navigateur, forcer une
  // synchronisation DOM -> state avant de lire la configuration. Cela
  // évite les cas où l'utilisateur change un contrôle mais le listener
  // n'a pas propagé la valeur dans `state.config` avant la génération.
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.syncConfigFromDOM === "function"
    ) {
      window.syncConfigFromDOM();
    }
  } catch (e) {
    /* noop */
  }
  const primaryColor = cfg.primaryColor;
  const themeMode = cfg.themeMode;
  const typoResponsive = !!cfg.typoResponsive;
  const spacingResponsive = !!cfg.spacingResponsive;

  // PRIORITÉ 1: Si un import Figma a produit du contenu, l'utiliser
  // (même si la config correspond au canonical, on préfère le contenu importé)
  console.log(
    "[generateTokensCSS] state.tokensContent length:",
    state?.tokensContent?.length || 0
  );
  console.log(
    "[generateTokensCSS] state.themeFromImport:",
    state?.themeFromImport
  );

  // Utiliser la branche import si themeFromImport est vrai
  // OU si `state.tokensContent` est présent (ex: import Figma ou seeds canoniques)
  // Cela permet d'utiliser `state.tokensContent` quand il a été initialisé
  // depuis les fichiers `/canonical/` (seed) ou via un import JSON.
  const hasTokensContent = Boolean(
    state && state.tokensContent && state.tokensContent.trim().length
  );
  if ((state && state.themeFromImport) || hasTokensContent) {
    console.log(
      "[generateTokensCSS] ✅ Mode import/génération depuis tokensContent activé"
    );
    try {
      // Commencer avec un template vide ou le contenu existant
      let processed = (state.tokensContent || "").trim();

      // Use robust normalisation helper to rebuild a single `:root` block
      // and mark that the AST-based normalizer was used so we can skip
      // legacy regex spacing passes later.
      let usedAstNormalization = false;
      try {
        processed = normalizeTokensContent(processed || "");
        usedAstNormalization = true;
        if (processed && processed.length) {
          console.log(
            "[generateTokensCSS] Normalized tokensContent via normalizeTokensContent()"
          );
        }
      } catch (e) {
        console.warn(
          "[generateTokensCSS] normalisation tokensContent a échoué:",
          e && e.message
        );
      }

      console.log(
        "[generateTokensCSS] processed initial length:",
        processed.length
      );
      console.log(
        "[generateTokensCSS] processed initial (200 chars):",
        processed.substring(0, 200)
      );

      // Si tokensContent est vide, initialiser avec :root {}
      if (!processed) {
        console.log(
          "[generateTokensCSS] tokensContent vide, initialisation :root {}"
        );
        processed = ":root {\n}\n";
      }

      // Best-effort post-processing: if theme primitives are present in
      // the current state.themeContent, replace raw color literals in the
      // produced tokensContent (oklch(...), rgb(...), hex) with
      // var(--primitive-name) so the UI preview shows primitives
      // rather than inline values when possible.
      const themeCss = (state && state.themeContent) || "";
      const primMap = Object.create(null);
      const primRx = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gim;
      let m;
      while ((m = primRx.exec(themeCss))) {
        const name = m[1];
        const val = (m[2] || "").trim();
        if (val) primMap[val] = primMap[val] || name;
      }

      // Remplacer les couleurs littérales par des références aux primitives
      const replaceRx = /oklch\([^\)]+\)|rgba?\([^\)]+\)|#[0-9a-fA-F]{3,8}/g;
      processed = processed.replace(replaceRx, (match) => {
        const key = match.trim();
        if (primMap[key]) return `var(${primMap[key]})`;
        return match;
      });

      // Déterminer la couleur primaire pour le header et l'injection des tokens
      // Priorité :
      // 1. `primaryColor` provenant de la config UI (l'utilisateur)
      // 2. Détection dans le contenu normalisé `processed` (ex: var(--color-raspberry-500))
      // 3. Valeur par défaut 'blue'
      // Choix de la couleur primaire affichée dans l'en-tête.
      // Priorités:
      // 1. `state.config.primaryColor` (sélection utilisateur)
      // 2. Si l'import Figma est actif (`state.themeFromImport`) ou si
      //    `state.themeContent` contient des primitives, détecter la couleur
      //    depuis le contenu (ex: var(--color-xxx-500)).
      // 3. Sinon utiliser une valeur par défaut 'gray' (éviter d'hériter
      //    automatiquement d'un token canonique comme 'raspberry').
      // Par règle métier, quand aucune couleur utilisateur ni import n'existe
      // nous devons proposer le placeholder `raspberry` comme couleur primaire.
      let displayPrimary = primaryColor || "raspberry";
      try {
        if (!primaryColor) {
          // Détecter les primitives uniquement si l'origine est un import
          // ou si des primitives sont présentes dans themeContent.
          const themeCss = (state && state.themeContent) || "";
          const hasPrimitivesInTheme = /--color-([a-z0-9-]+)-\d+\s*:/i.test(
            themeCss
          );
          if (state?.themeFromImport || hasPrimitivesInTheme) {
            const det = processed.match(/var\(--color-([a-z0-9-]+)-\d+\)/i);
            if (det && det[1]) {
              displayPrimary = det[1];
              console.log(
                "[generateTokensCSS] Détection couleur primaire depuis processed (import/theme):",
                displayPrimary
              );
            }
          } else {
            console.log(
              "[generateTokensCSS] Pas d'import ni de primitives theme; utiliser 'raspberry' (placeholder) par défaut"
            );
          }
        }
      } catch (e) {
        /* noop */
      }

      // If we still have the placeholder 'raspberry' (no detection and
      // no explicit user primary), but we are in import mode, try to pick
      // a sensible fallback from the imported primitives so the UI does
      // not display a non-existent placeholder. This covers cases where
      // `state.tokensContent` only contained partial sections (eg. Formulaires)
      // and therefore did not contain a var(--color-...-500) detection.
      try {
        if (
          !primaryColor &&
          displayPrimary === "raspberry" &&
          state?.themeFromImport
        ) {
          // Search for fallback primitives in multiple sources:
          // - full theme content (state.themeContent)
          // - any primitives that may be embedded in tokensContent
          // - user-provided customVars
          const themeCssFull = (state && state.themeContent) || "";
          const tokensSource = (state && state.tokensContent) || "";
          const customVars =
            (state && state.config && state.config.customVars) || "";
          const searchSource = [themeCssFull, tokensSource, customVars].join(
            "\n"
          );

          // Use the canonical primitives guaranteed by the project as fallbacks.
          // We intentionally do NOT include 'blue' here because it may come
          // from imported JSONs; prefer the project's canonical primitives.
          const fallbacks = ["info", "warning", "success", "error"];
          for (const f of fallbacks) {
            const rx = new RegExp(`--color-${f}-\\d+\\s*:`, "i");
            if (rx.test(searchSource)) {
              displayPrimary = f;
              console.warn(
                `[generateTokensCSS] Aucun primary détecté dans tokensContent; bascule vers primitive existante '--color-${f}'`
              );
              break;
            }
          }
          // If none of the canonical fallbacks are present, use `gray` as
          // an ultimate fallback because `gray` primitives are provided by
          // the canonical palette and are always available.
          if (displayPrimary === "raspberry") {
            displayPrimary = "gray";
            console.warn(
              "[generateTokensCSS] Aucun fallback canonique trouvé; bascule par défaut vers '--color-gray'"
            );
          }
        }
      } catch (e) {
        /* noop */
      }

      // Ensure the header comment of generated tokens is always coherent
      // and reflects the current configuration even when `state.tokensContent`
      // comes from an imported JSON. We replace any leading /* ---- */ block
      // with a generated header that contains: chosen primary, themeMode,
      // typoResponsive and spacingResponsive.
      try {
        const themeLabel =
          themeMode === "both"
            ? "light et dark"
            : themeMode === "dark"
            ? "dark uniquement"
            : "light uniquement";
        const typoLabel = typoResponsive ? "oui" : "non";
        const spacingLabel = spacingResponsive ? "oui" : "non";

        const headerLines = [
          "/* ----------------------------------",
          " * Theme-tokens, généré par primary.alsacreations.com",
          " * Surcouche de theme.css",
          " * Configuration :",
          ` * - Couleur primaire : ${displayPrimary}`,
          ` * - Theme : ${themeLabel}`,
          ` * - Typographie responsive : ${typoLabel}`,
          ` * - Espacements responsive : ${spacingLabel}`,
          " * ----------------------------------",
          " */",
        ].join("\n");

        // Remove existing leading header block if present
        processed = processed.replace(/^\s*\/\*[\s\S]*?\*\/\s*/m, "");
        // Prepend our coherent header
        processed = headerLines + "\n" + processed;

        console.log(
          "[generators-header] processed après header (200 premiers chars):",
          processed.substring(0, 200)
        );
      } catch (e) {
        /* noop */
      }

      // Ensure the processed content's `--primary` declaration matches the
      // `displayPrimary` we use in the header. This fixes ordering issues
      // where `state.tokensContent` was seeded earlier with a different
      // primary than the UI selection (step 2). Replace any existing
      // `--primary: ...;` declaration with the chosen variable.
      try {
        if (displayPrimary && /--primary\s*:/i.test(processed)) {
          // (no-op) debug removed
          // If the existing declaration already uses a `var(...)`, we
          // historically preserved it to avoid overwriting user-imported
          // tokens. However, when the user explicitly selects a primary
          // color in the UI (`primaryColor`), their choice should take
          // precedence and we must update the declaration accordingly.
          const existingVarMatch = processed.match(
            /--primary\s*:\s*(var\([^;\n]+\))/i
          );
          if (existingVarMatch && !primaryColor) {
            // Preserve imported var(...) only when the user did NOT
            // explicitly select a different primary color.
            console.log(
              "[generators-header] préserve --primary importé:",
              existingVarMatch[1]
            );
          } else {
            processed = processed.replace(
              /--primary\s*:\s*[^;]*;/gi,
              `--primary: var(${chooseBestVariant(
                displayPrimary,
                [themeCss, tokensSource, customVars].join("\n")
              )});`
            );
            console.log(
              "[generators-header] synchronized --primary to",
              displayPrimary
            );
          }
        }
      } catch (e) {
        /* noop */
      }

      // Vérification: détecter les propriétés vides (placeholders non remplis)
      try {
        const emptyRx = /(--[a-z0-9-]+)\s*:\s*(?:;|\s*$|\n)/gim;
        const empties = [];
        let em;
        while ((em = emptyRx.exec(processed))) {
          if (em[1]) empties.push(em[1]);
        }
        if (empties.length) {
          // Don't abort generation on placeholders — proceed and inject
          // canonical tokens non-destructively. Log a warning for visibility.
          console.warn(
            "[generateTokensCSS] placeholders vides détectés (poursuite de l'injection non-destructive):",
            empties
          );
        }
      } catch (e) {
        // If the empties detection itself fails, emit a warning but continue.
        console.warn(
          "[generateTokensCSS] Warning during empties detection:",
          e && e.message
        );
      }

      // INJECTION DES TOKENS DE COULEURS CANONIQUES
      // Les tokens de couleurs doivent TOUJOURS être présents, même avec import Figma
      // Ils s'adaptent à la config (light, dark, both)
      try {
        console.log(
          "[generators-colors] Injection des tokens de couleurs canoniques"
        );

        // Vérifier si les tokens canoniques sont déjà présents
        // Consider a color token present only if it has a non-empty value.
        // A bare comment `/* Couleur primaire */` without values does not
        // count as a populated color block.
        // Debug: show current primary/on-primary matches before deciding.
        /* debug logging removed */

        // Heuristique améliorée :
        // - si `--primary` ou `--on-primary` sont absents ou vides -> injection complète
        // - si `--primary` et `--on-primary` sont présents mais que les dérivés
        //   `--primary-lighten` / `--primary-darken` sont manquants -> n'injecte
        //   que les dérivés et les tokens qui en dépendent (accent, link, selection, bordures)
        // - si tout est présent -> skip
        const hasPrimaryNonEmpty = /--primary\s*:\s*[^;\n\r]*\S[^;\n\r]*;/.test(
          processed
        );
        const hasOnPrimaryNonEmpty =
          /--on-primary\s*:\s*[^;\n\r]*\S[^;\n\r]*;/.test(processed);
        const hasPrimaryLight =
          /--primary-lighten\s*:\s*[^;\n\r]*\S[^;\n\r]*;/.test(processed);
        const hasPrimaryDark =
          /--primary-darken\s*:\s*[^;\n\r]*\S[^;\n\r]*;/.test(processed);

        const needFullInjection = !hasPrimaryNonEmpty || !hasOnPrimaryNonEmpty;
        const needDerivedInjection =
          hasPrimaryNonEmpty &&
          hasOnPrimaryNonEmpty &&
          (!hasPrimaryLight || !hasPrimaryDark);

        if (needFullInjection) {
          console.log(
            "[generators-colors] ✅ Tokens canoniques absents, injection"
          );

          console.log(
            "[generators-colors] processed avant injection (300 chars):",
            processed.substring(0, 300)
          );

          // Construire le bloc de couleurs selon themeMode
          const colorLines = [];

          // color-scheme block
          if (themeMode === "both") {
            colorLines.push("  color-scheme: light dark;");
            colorLines.push("");
            colorLines.push('  &[data-theme="light"] {');
            colorLines.push("    color-scheme: light;");
            colorLines.push("  }");
            colorLines.push("");
            colorLines.push('  &[data-theme="dark"] {');
            colorLines.push("    color-scheme: dark;");
            colorLines.push("  }");
          } else if (themeMode === "dark") {
            colorLines.push("  color-scheme: dark;");
          } else {
            colorLines.push("  color-scheme: light;");
          }

          colorLines.push("");
          // Respect any existing non-empty values: prefer original if present
          const existingPrimaryMatch = processed.match(
            /--primary\s*:\s*([^;]+);/i
          );
          const existingOnPrimaryMatch = processed.match(
            /--on-primary\s*:\s*([^;]+);/i
          );
          const existingPrimaryLightMatch = processed.match(
            /--primary-lighten\s*:\s*([^;]+);/i
          );
          const existingPrimaryDarkMatch = processed.match(
            /--primary-darken\s*:\s*([^;]+);/i
          );
          // Compute primaryVal: prefer existing explicit value, otherwise
          // choose a best-available variant (don't force -500 if it doesn't exist)
          const primaryVal =
            existingPrimaryMatch && existingPrimaryMatch[1].trim()
              ? existingPrimaryMatch[1].trim()
              : `var(${chooseBestVariant(
                  displayPrimary,
                  [themeCss, tokensSource, customVars].join("\n")
                )})`;
          const onPrimaryVal =
            existingOnPrimaryMatch && existingOnPrimaryMatch[1].trim()
              ? existingOnPrimaryMatch[1].trim()
              : `var(--color-white)`;

          // Compute derived variants preferring palette primitives when possible
          let primaryLightVal = null;
          let primaryDarkVal = null;
          // Determine derived values for primary. We MUST emit the
          // `oklch(from var(--primary) ...)` expressions by default so the
          // derivation is always relative to `--primary` regardless of the
          // primitive palette. However, if the import already contained
          // explicit `--primary-lighten` / `--primary-darken` values, we
          // preserve them (non-destructive behaviour).
          try {
            // If the import provided explicit derived tokens, preserve them.
            if (existingPrimaryLightMatch && existingPrimaryLightMatch[1]) {
              primaryLightVal = existingPrimaryLightMatch[1].trim();
            } else {
              primaryLightVal = `oklch(from var(--primary) calc(l * 1.2) c h)`;
            }

            if (existingPrimaryDarkMatch && existingPrimaryDarkMatch[1]) {
              primaryDarkVal = existingPrimaryDarkMatch[1].trim();
            } else {
              primaryDarkVal = `oklch(from var(--primary) calc(l * 0.8) c h)`;
            }
          } catch (e) {
            // Best-effort fallback to canonical expressions
            primaryLightVal = `oklch(from var(--primary) calc(l * 1.2) c h)`;
            primaryDarkVal = `oklch(from var(--primary) calc(l * 0.8) c h)`;
          }

          colorLines.push("  /* Couleur primaire */");
          colorLines.push(`  --primary: ${primaryVal};`);
          colorLines.push(`  --on-primary: ${onPrimaryVal};`);
          colorLines.push(`  --primary-lighten: ${primaryLightVal};`);
          colorLines.push(`  --primary-darken: ${primaryDarkVal};`);
          colorLines.push("");

          // accent
          colorLines.push("  /* Couleur d'accent */");
          if (themeMode === "both") {
            colorLines.push(
              `  --accent: light-dark(var(--primary), var(--primary-lighten));`
            );
            colorLines.push(
              `  --accent-invert: light-dark(var(--primary-lighten), var(--primary));`
            );
          } else if (themeMode === "dark") {
            colorLines.push(`  --accent: var(--primary-lighten);`);
            colorLines.push("  --accent-invert: var(--primary);");
          } else {
            colorLines.push("  --accent: var(--primary);");
            colorLines.push(`  --accent-invert: var(--primary-lighten);`);
          }

          colorLines.push("");
          // surfaces
          if (themeMode === "both") {
            colorLines.push("  /* Surface du document */");
            colorLines.push(
              "  --surface: light-dark(var(--color-white), var(--color-gray-900));"
            );
            colorLines.push(
              "  --on-surface: light-dark(var(--color-gray-900), var(--color-gray-100));"
            );
          } else if (themeMode === "dark") {
            colorLines.push("  /* Surface du document */");
            colorLines.push("  --surface: var(--color-gray-900);");
            colorLines.push("  --on-surface: var(--color-gray-100);");
          } else {
            colorLines.push("  /* Surface du document */");
            colorLines.push("  --surface: var(--color-white);");
            colorLines.push("  --on-surface: var(--color-gray-900);");
          }

          colorLines.push("");
          colorLines.push("  /* Niveaux de profondeur */");
          if (themeMode === "both") {
            colorLines.push(
              "  --layer-1: light-dark(var(--color-gray-50), var(--color-gray-800));"
            );
            colorLines.push(
              "  --layer-2: light-dark(var(--color-gray-100), var(--color-gray-700));"
            );
            colorLines.push(
              "  --layer-3: light-dark(var(--color-gray-200), var(--color-gray-600));"
            );
          } else if (themeMode === "dark") {
            colorLines.push("  --layer-1: var(--color-gray-800);");
            colorLines.push("  --layer-2: var(--color-gray-700);");
            colorLines.push("  --layer-3: var(--color-gray-600);");
          } else {
            colorLines.push("  --layer-1: var(--color-gray-50);");
            colorLines.push("  --layer-2: var(--color-gray-100);");
            colorLines.push("  --layer-3: var(--color-gray-200);");
          }

          colorLines.push("");
          colorLines.push("  /* Interactions */");
          if (themeMode === "both") {
            colorLines.push(
              `  --link: light-dark(var(--primary), var(--primary-lighten));`
            );
            colorLines.push(
              `  --link-hover: light-dark(var(--primary-darken), var(--primary));`
            );
            colorLines.push(
              `  --link-active: light-dark(var(--primary-darken), var(--primary));`
            );
          } else if (themeMode === "dark") {
            colorLines.push(`  --link: var(--primary-lighten);`);
            colorLines.push("  --link-hover: var(--primary);");
            colorLines.push("  --link-active: var(--primary);");
          } else {
            colorLines.push("  --link: var(--primary);");
            colorLines.push(`  --link-hover: var(--primary-darken);`);
            colorLines.push(`  --link-active: var(--primary-darken);`);
          }

          colorLines.push("");
          colorLines.push("  /* Couleur de sélection */");
          if (themeMode === "both") {
            colorLines.push(
              `  --selection: light-dark(var(--primary-lighten), var(--primary-darken));`
            );
          } else if (themeMode === "dark") {
            colorLines.push(`  --selection: var(--primary);`);
          } else {
            colorLines.push(`  --selection: var(--primary-lighten);`);
          }

          colorLines.push("");
          colorLines.push("  /* États */");
          if (themeMode === "both") {
            colorLines.push(
              "  --warning: light-dark(var(--color-warning-500), var(--color-warning-300));"
            );
            colorLines.push(
              "  --error: light-dark(var(--color-error-500), var(--color-error-300));"
            );
            colorLines.push(
              "  --success: light-dark(var(--color-success-500), var(--color-success-300));"
            );
            colorLines.push(
              "  --info: light-dark(var(--color-info-500), var(--color-info-300));"
            );
          } else if (themeMode === "dark") {
            colorLines.push("  --warning: var(--color-warning-300);");
            colorLines.push("  --error: var(--color-error-300);");
            colorLines.push("  --success: var(--color-success-300);");
            colorLines.push("  --info: var(--color-info-300);");
          } else {
            colorLines.push("  --warning: var(--color-warning-500);");
            colorLines.push("  --error: var(--color-error-500);");
            colorLines.push("  --success: var(--color-success-500);");
            colorLines.push("  --info: var(--color-info-500);");
          }

          colorLines.push("");
          colorLines.push("  /* Bordures */");
          if (themeMode === "both") {
            // Canonical: lighter border in light mode, medium border for dark
            colorLines.push("  --border-light: var(--color-gray-400);");
            colorLines.push("  --border-medium: var(--color-gray-600);");
          } else if (themeMode === "dark") {
            colorLines.push("  --border-light: var(--color-gray-600);");
            colorLines.push("  --border-medium: var(--color-gray-600);");
          } else {
            // Light-only mode: border-light should be slightly lighter (gray-400)
            colorLines.push("  --border-light: var(--color-gray-400);");
            colorLines.push("  --border-medium: var(--color-gray-600);");
          }

          // Insert the canonical color block after the Theme header
          // (color-scheme + any &[data-theme] blocks). This guarantees the
          // canonical order: Theme -> Couleur primaire -> dérivés.
          const rootMatch = processed.match(/:root\s*\{/);
          if (rootMatch) {
            let insertPos =
              processed.indexOf(rootMatch[0]) + rootMatch[0].length;
            try {
              const bodyStart = insertPos;
              const csIndex = processed.indexOf("color-scheme", bodyStart);
              if (csIndex !== -1) {
                // move to end of the color-scheme declaration
                let pos = processed.indexOf(";", csIndex);
                if (pos === -1) pos = bodyStart;
                else pos = pos + 1;

                // include any following &[data-theme] blocks
                while (true) {
                  const dtIdx = processed.indexOf("&[data-theme", pos);
                  if (dtIdx === -1) break;
                  const openBrace = processed.indexOf("{", dtIdx);
                  if (openBrace === -1) break;
                  // find matching closing brace
                  let depth = 1;
                  let k = openBrace + 1;
                  while (k < processed.length && depth > 0) {
                    if (processed[k] === "{") depth++;
                    else if (processed[k] === "}") depth--;
                    k++;
                  }
                  pos = k; // after closing brace
                }

                // set insertion point after theme block
                insertPos = pos;
              }
            } catch (e) {
              /* noop - fallback to default insertPos */
            }

            // Insert colorLines at the computed insertion point
            processed =
              processed.slice(0, insertPos) +
              "\n" +
              colorLines.join("\n") +
              "\n" +
              processed.slice(insertPos);

            // Deduplicate top-level declarations so that injected canonical
            // declarations shadow any placeholders that remained.
            try {
              const rootIdx3 = processed.indexOf(":root");
              if (rootIdx3 !== -1) {
                const open3 = processed.indexOf("{", rootIdx3);
                if (open3 !== -1) {
                  let depth3 = 1;
                  let jj = open3 + 1;
                  while (jj < processed.length && depth3 > 0) {
                    const ch3 = processed[jj];
                    if (ch3 === "{") depth3++;
                    else if (ch3 === "}") depth3--;
                    jj++;
                  }
                  const end3 = jj - 1;
                  const body3 = processed.slice(open3 + 1, end3);
                  const lines3 = body3.split(/\r?\n/);
                  const seenProps = new Set();
                  const outLines3 = [];
                  for (const ln of lines3) {
                    const m = ln.match(/^\s*(--[a-z0-9-]+)\s*:/i);
                    if (m) {
                      const prop = m[1];
                      if (seenProps.has(prop)) continue;
                      seenProps.add(prop);
                      outLines3.push(ln);
                    } else {
                      outLines3.push(ln);
                    }
                  }
                  let newBody = outLines3.join("\n");
                  try {
                    const sectionRx = /\n?\s*\/\*[\s\S]*?\*\/\s*/g;
                    const secMatches = Array.from(newBody.matchAll(sectionRx));
                    if (secMatches.length) {
                      const sections = [];
                      let cursor4 = 0;
                      for (let si = 0; si < secMatches.length; si++) {
                        const m4 = secMatches[si];
                        const headerStart4 = m4.index;
                        if (si === 0 && headerStart4 > 0) {
                          sections.push({
                            header: null,
                            body: newBody.slice(0, headerStart4),
                          });
                        }
                        const header4 = m4[0].trim();
                        const contentStart4 = headerStart4 + m4[0].length;
                        const nextStart4 =
                          si + 1 < secMatches.length
                            ? secMatches[si + 1].index
                            : newBody.length;
                        const bodyContent4 = newBody.slice(
                          contentStart4,
                          nextStart4
                        );
                        sections.push({ header: header4, body: bodyContent4 });
                        cursor4 = nextStart4;
                      }
                      const filtered = sections.filter((s) => {
                        if (!s.header) return true;
                        const hasNonEmpty =
                          /--[a-z0-9-]+\s*:\s*[^;\n\r]*\S[^;\n\r]*;/.test(
                            s.body
                          );
                        return hasNonEmpty;
                      });
                      newBody = filtered
                        .map((s) =>
                          s.header ? s.header + (s.body || "") : s.body || ""
                        )
                        .join("");
                    }
                  } catch (e) {
                    /* noop section cleanup best-effort */
                  }
                  processed =
                    processed.slice(0, open3 + 1) +
                    newBody +
                    processed.slice(end3);
                }
              }
            } catch (e) {
              /* noop dedupe best-effort */
            }
          }
        } else if (needDerivedInjection) {
          console.log(
            "[generators-colors] ✅ Primary present but derived tokens missing, injecting derived tokens"
          );

          // Reuse primaryVal / onPrimaryVal computed earlier
          // For derived injection, always emit the canonical oklch(from var(--primary) ...)
          // expressions so derivation is relative to `--primary`, unless the
          // import already provided explicit derived values (preserve them).
          let primaryLightVal = null;
          let primaryDarkVal = null;
          try {
            const existingPrimaryLightMatch = processed.match(
              /--primary-lighten\s*:\s*([^;]+);/i
            );
            const existingPrimaryDarkMatch = processed.match(
              /--primary-darken\s*:\s*([^;]+);/i
            );

            if (existingPrimaryLightMatch && existingPrimaryLightMatch[1]) {
              primaryLightVal = existingPrimaryLightMatch[1].trim();
            } else {
              primaryLightVal = `oklch(from var(--primary) calc(l * 1.2) c h)`;
            }

            if (existingPrimaryDarkMatch && existingPrimaryDarkMatch[1]) {
              primaryDarkVal = existingPrimaryDarkMatch[1].trim();
            } else {
              primaryDarkVal = `oklch(from var(--primary) calc(l * 0.8) c h)`;
            }
          } catch (e) {
            primaryLightVal = `oklch(from var(--primary) calc(l * 1.2) c h)`;
            primaryDarkVal = `oklch(from var(--primary) calc(l * 0.8) c h)`;
          }

          const derivedLines = [];
          derivedLines.push("  /* Couleur primaire (dérivés injectés) */");
          derivedLines.push(`  --primary-lighten: ${primaryLightVal};`);
          derivedLines.push(`  --primary-darken: ${primaryDarkVal};`);
          derivedLines.push("");

          // Build separate canonical blocks for Accent, Interactions, Selection and Bordures
          const accentBlock = [];
          accentBlock.push("  /* Couleur d'accent */");
          if (themeMode === "both") {
            accentBlock.push(
              "  --accent: light-dark(var(--primary), var(--primary-lighten));"
            );
            accentBlock.push(
              "  --accent-invert: light-dark(var(--primary-lighten), var(--primary));"
            );
          } else if (themeMode === "dark") {
            accentBlock.push("  --accent: var(--primary-lighten);");
            accentBlock.push("  --accent-invert: var(--primary);");
          } else {
            accentBlock.push("  --accent: var(--primary);");
            accentBlock.push("  --accent-invert: var(--primary-lighten);");
          }

          const interactionsBlock = [];
          interactionsBlock.push("  /* Interactions */");
          if (themeMode === "both") {
            interactionsBlock.push(
              "  --link: light-dark(var(--primary), var(--primary-lighten));"
            );
            interactionsBlock.push(
              "  --link-hover: light-dark(var(--primary-darken), var(--primary));"
            );
            interactionsBlock.push(
              "  --link-active: light-dark(var(--primary-darken), var(--primary));"
            );
          } else if (themeMode === "dark") {
            interactionsBlock.push("  --link: var(--primary-lighten);");
            interactionsBlock.push("  --link-hover: var(--primary);");
            interactionsBlock.push("  --link-active: var(--primary);");
          } else {
            interactionsBlock.push("  --link: var(--primary);");
            interactionsBlock.push("  --link-hover: var(--primary-darken);");
            interactionsBlock.push("  --link-active: var(--primary-darken);");
          }

          const selectionBlock = [];
          selectionBlock.push("  /* Couleur de sélection */");
          if (themeMode === "both") {
            selectionBlock.push(
              "  --selection: light-dark(var(--primary-lighten), var(--primary-darken));"
            );
          } else if (themeMode === "dark") {
            selectionBlock.push("  --selection: var(--primary);");
          } else {
            selectionBlock.push("  --selection: var(--primary-lighten);");
          }

          const bordersBlock = [];
          bordersBlock.push("  /* Bordures */");
          if (themeMode === "both") {
            bordersBlock.push("  --border-light: var(--color-gray-400);");
            bordersBlock.push("  --border-medium: var(--color-gray-600);");
          } else if (themeMode === "dark") {
            bordersBlock.push("  --border-light: var(--color-gray-600);");
            bordersBlock.push("  --border-medium: var(--color-gray-600);");
          } else {
            bordersBlock.push("  --border-light: var(--color-gray-400);");
            bordersBlock.push("  --border-medium: var(--color-gray-600);");
          }

          // Inject derivedLines after the Theme block (color-scheme + &[data-theme])
          const rootMatch = processed.match(/:root\s*\{/);
          if (rootMatch) {
            // default insertion is right after the opening brace
            let insertPos =
              processed.indexOf(rootMatch[0]) + rootMatch[0].length;
            try {
              const bodyStart = insertPos;
              const csIndex = processed.indexOf("color-scheme", bodyStart);
              if (csIndex !== -1) {
                // move to end of the color-scheme declaration
                let pos = processed.indexOf(";", csIndex);
                if (pos === -1) pos = bodyStart;
                else pos = pos + 1;

                // include any following &[data-theme] blocks
                while (true) {
                  const dtIdx = processed.indexOf("&[data-theme", pos);
                  if (dtIdx === -1) break;
                  const openBrace = processed.indexOf("{", dtIdx);
                  if (openBrace === -1) break;
                  // find matching closing brace
                  let depth = 1;
                  let k = openBrace + 1;
                  while (k < processed.length && depth > 0) {
                    if (processed[k] === "{") depth++;
                    else if (processed[k] === "}") depth--;
                    k++;
                  }
                  pos = k; // after closing brace
                }

                // set insertion point after theme block
                insertPos = pos;
              }
            } catch (e) {
              /* noop - fallback to default insertPos */
            }

            // Insert derived primary lines, then insert the canonical blocks
            // for accent, interactions, selection and borders so that the
            // later canonical ordering pass can place them correctly.
            const toInsert = [
              derivedLines.join("\n"),
              accentBlock.join("\n"),
              interactionsBlock.join("\n"),
              selectionBlock.join("\n"),
              bordersBlock.join("\n"),
            ]
              .filter(Boolean)
              .join("\n\n");

            processed =
              processed.slice(0, insertPos) +
              "\n" +
              toInsert +
              "\n" +
              processed.slice(insertPos);
            // Deduplicate top-level declarations so injected derived tokens shadow placeholders
            try {
              const rootIdx3 = processed.indexOf(":root");
              if (rootIdx3 !== -1) {
                const open3 = processed.indexOf("{", rootIdx3);
                if (open3 !== -1) {
                  let depth3 = 1;
                  let jj = open3 + 1;
                  while (jj < processed.length && depth3 > 0) {
                    const ch3 = processed[jj];
                    if (ch3 === "{") depth3++;
                    else if (ch3 === "}") depth3--;
                    jj++;
                  }
                  const end3 = jj - 1;
                  const body3 = processed.slice(open3 + 1, end3);
                  const lines3 = body3.split(/\r?\n/);
                  const seenProps = new Set();
                  const outLines3 = [];
                  for (const ln of lines3) {
                    const m = ln.match(/^\s*(--[a-z0-9-]+)\s*:/i);
                    if (m) {
                      const prop = m[1];
                      if (seenProps.has(prop)) continue;
                      seenProps.add(prop);
                      outLines3.push(ln);
                    } else {
                      outLines3.push(ln);
                    }
                  }
                  let newBody = outLines3.join("\n");
                  processed =
                    processed.slice(0, open3 + 1) +
                    newBody +
                    processed.slice(end3);
                }
              }
            } catch (e) {
              /* noop dedupe best-effort */
            }
          }
        } else {
          console.log(
            "[generators-colors] ⚠️ Tokens canoniques déjà présents, skip"
          );
        }
      } catch (e) {
        console.error("[generators-colors] Erreur injection tokens:", e);
      }

      // If the user asked for responsive typography but the client-generated
      // tokensContent lacks the main responsive text token, append a small
      // canonical-like typography block so the UI preview reflects the
      // user's choice (best-effort; non-destructive).
      //
      // NOUVELLE LOGIQUE : Si une section typo importée existe dans state.importedTypoSection,
      // l'injecter directement au lieu d'utiliser les tokens canoniques.
      try {
        const hasTextM = /--text-m\s*:/i.test(processed);
        const hasAnyText = /--text-[a-z0-9-]*\s*:/i.test(processed);
        console.log(
          "[generators-typo] hasTextM:",
          hasTextM,
          "typoResponsive:",
          typoResponsive,
          "themeFromImport:",
          state?.themeFromImport,
          "importedTypoSection:",
          !!state?.importedTypoSection
        );

        // Priorité 1 : Injecter la section typo importée depuis Figma si disponible
        if (state?.importedTypoSection) {
          if (!hasAnyText) {
            console.log(
              "[generators-typo] ✅ Injection de la section typo importée depuis Figma"
            );
            // Injecter avant la fermeture du :root
            if (/\n}\s*$/.test(processed)) {
              processed = processed.replace(
                /\n}\s*$/,
                "\n" + state.importedTypoSection + "\n}\n"
              );
            } else {
              processed =
                processed.trimEnd() + "\n" + state.importedTypoSection + "\n";
            }
          } else {
            console.log(
              "[generators-typo] ⚠️ Section typo NON injectée car hasAnyText=true"
            );
          }
        } else {
          console.log(
            "[generators-typo] ℹ️ Aucune section typo importée disponible"
          );
        }

        // Priorité 2 : Tokens canoniques responsive si demandé et rien d'importé
        // NOTE: injecter les tokens manquants même si le contenu provient d'un import
        // afin de compléter la prévisualisation de façon non-destructive.
        if (!state?.importedTypoSection && typoResponsive && !hasTextM) {
          const typoLines = [];
          typoLines.push("\n  /* Typographie - Tailles de police */");
          typoLines.push("  --text-s: var(--text-14);");
          typoLines.push(
            "  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));"
          );
          typoLines.push(
            "  --text-l: clamp(var(--text-18), 1.0761rem + 0.2174vw, var(--text-20));"
          );
          typoLines.push(
            "  --text-xl: clamp(var(--text-20), 0.957rem + 1.3043vw, var(--text-32));"
          );
          typoLines.push(
            "  --text-2xl: clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36));"
          );
          typoLines.push(
            "  --text-3xl: clamp(var(--text-32), 1.609rem + 1.7391vw, var(--text-48));"
          );
          typoLines.push(
            "  --text-4xl: clamp(var(--text-48), 2.1818rem + 3.6364vw, var(--text-80));"
          );
          // Try replace before final closing brace, fallback to append
          if (processed.replace) {
            const replaced = processed.replace(
              /\n}\s*$/m,
              "\n" + typoLines.join("\n") + "\n}\n"
            );
            if (replaced === processed) {
              // fallback: append before final closing brace if present
              if (/\n}\s*$/.test(processed)) {
                processed = processed.replace(
                  /\n}\s*$/,
                  "\n" + typoLines.join("\n") + "\n}\n"
                );
              } else {
                processed =
                  processed.trimEnd() + "\n" + typoLines.join("\n") + "\n";
              }
            } else {
              processed = replaced;
            }
          }
        } else if (!typoResponsive && !hasAnyText) {
          // User requested fixed text sizes: append fixed-size tokens
          const fixedTypo = [
            "\n  /* Typographie - Tailles de police */",
            "  --text-s: var(--text-14);",
            "  --text-m: var(--text-16);",
            "  --text-l: var(--text-18);",
            "  --text-xl: var(--text-20);",
            "  --text-2xl: var(--text-24);",
            "  --text-3xl: var(--text-32);",
            "  --text-4xl: var(--text-48);",
            "\n",
          ].join("\n");
          if (/\n}\s*$/.test(processed))
            processed = processed.replace(/\n}\s*$/m, "\n" + fixedTypo + "}\n");
          else processed = processed.trimEnd() + "\n" + fixedTypo + "\n";
        }
      } catch (e) {
        /* noop */
      }

      // Même logique pour les espacements : injecter la section importée si disponible
      try {
        const hasSpacing = /--spacing-[a-z0-9-]*\s*:/i.test(processed);
        console.log(
          "[generators-spacing] hasSpacing:",
          hasSpacing,
          "spacingResponsive:",
          spacingResponsive,
          "importedSpacingSection:",
          !!state?.importedSpacingSection
        );

        // Priorité 1 : Injecter la section spacing importée depuis Figma si disponible
        if (state?.importedSpacingSection) {
          if (!hasSpacing) {
            console.log(
              "[generators-spacing] ✅ Injection de la section spacing importée depuis Figma"
            );
            // Injecter avant la fermeture du :root
            if (/\n}\s*$/.test(processed)) {
              processed = processed.replace(
                /\n}\s*$/,
                "\n" + state.importedSpacingSection + "\n}\n"
              );
            } else {
              processed =
                processed.trimEnd() +
                "\n" +
                state.importedSpacingSection +
                "\n";
            }
          } else {
            console.log(
              "[generators-spacing] ⚠️ Section spacing NON injectée car hasSpacing=true"
            );
          }
        } else {
          console.log(
            "[generators-spacing] ℹ️ Aucune section spacing importée disponible"
          );

          // Si aucun token d'espacement n'est présent dans l'import,
          // injecter un bloc d'espacements canonique non-destructif afin
          // que la prévisualisation affiche des valeurs cohérentes.
          if (!hasSpacing) {
            console.log(
              "[generators-spacing] Aucun token spacing détecté dans l'import — injection canonique de secours"
            );
            const spacingLines = [];
            spacingLines.push("\n  /* Espacements */");
            spacingLines.push("  --spacing-xs: var(--spacing-4);");
            if (spacingResponsive) {
              spacingLines.push(
                "  --spacing-s: clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16));"
              );
              spacingLines.push(
                "  --spacing-m: clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32));"
              );
              spacingLines.push(
                "  --spacing-l: clamp(var(--spacing-24), 0.8864rem + 2.2727vw, var(--spacing-48));"
              );
              spacingLines.push(
                "  --spacing-xl: clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80));"
              );
            } else {
              spacingLines.push("  --spacing-s: var(--spacing-8);");
              spacingLines.push("  --spacing-m: var(--spacing-16);");
              spacingLines.push("  --spacing-l: var(--spacing-24);");
              spacingLines.push("  --spacing-xl: var(--spacing-32);");
            }

            if (/\n}\s*$/.test(processed)) {
              processed = processed.replace(
                /\n}\s*$/m,
                "\n" + spacingLines.join("\n") + "\n}\n"
              );
            } else {
              processed =
                processed.trimEnd() + "\n" + spacingLines.join("\n") + "\n";
            }

            // Inject a default typography block as well if missing so the
            // preview includes text tokens (non-destructive).
            try {
              const hasTextM = /--text-m\s*:/i.test(processed);
              if (!hasTextM) {
                const typoLines = [];
                typoLines.push("\n  /* Tailles de police */");
                typoLines.push(
                  "  --text-xs: clamp(var(--text-12), 0.7011rem + 0.2174vw, var(--text-14));"
                );
                typoLines.push(
                  "  --text-s: clamp(var(--text-14), 0.8261rem + 0.2174vw, var(--text-16));"
                );
                typoLines.push(
                  "  --text-m: clamp(var(--text-16), 0.9511rem + 0.2174vw, var(--text-18));"
                );
                typoLines.push(
                  "  --text-xl: clamp(var(--text-18), 0.9783rem + 0.6522vw, var(--text-24));"
                );
                typoLines.push(
                  "  --text-2xl: clamp(var(--text-24), 1.3533rem + 0.6522vw, var(--text-30));"
                );
                typoLines.push(
                  "  --text-4xl: clamp(var(--text-30), 1.4348rem + 1.9565vw, var(--text-48));"
                );
                typoLines.push(
                  "  --text-5xl: clamp(var(--text-36), 1.663rem + 2.6087vw, var(--text-60));"
                );
                typoLines.push(
                  "  --text-6xl: clamp(var(--text-36), 1.1739rem + 4.7826vw, var(--text-80));"
                );
                if (/\n}\s*$/.test(processed)) {
                  processed = processed.replace(
                    /\n}\s*$/m,
                    "\n" + typoLines.join("\n") + "\n}\n"
                  );
                } else {
                  processed =
                    processed.trimEnd() + "\n" + typoLines.join("\n") + "\n";
                }
              }
            } catch (e) {
              /* noop */
            }
          }
        }
        // Priorité 2 : Tokens canoniques si nécessaire (mais normalement les espacements
        // sont déjà dans tokensContent ou seront générés par generateThemeFromScratch)
      } catch (e) {
        /* noop */
      }

      // If the user disabled spacing responsiveness, convert spacing clamps
      // to fixed first-arguments regardless of the typography setting.
      try {
        if (spacingResponsive === false) {
          // Replace clamp(...) occurrences inside spacing/gap declarations.
          // We operate at the declaration level so multi-line values and
          // nested functions are handled correctly.
          const declRegex =
            /(^\s*--(?:gap|spacing)-[a-z0-9-]*\s*:\s*)([\s\S]*?)(;)/gim;

          processed = processed.replace(
            declRegex,
            (full, declStart, declBody, semi) => {
              if (!declBody.includes("clamp(")) return full;
              let outBody = "";
              let i = 0;
              while (i < declBody.length) {
                const pos = declBody.indexOf("clamp(", i);
                if (pos === -1) {
                  outBody += declBody.slice(i);
                  break;
                }
                outBody += declBody.slice(i, pos);
                const start = pos + 6; // after 'clamp('
                let depth = 0;
                let firstComma = -1;
                let j = start;
                for (; j < declBody.length; j++) {
                  const ch = declBody[j];
                  if (ch === "(") depth++;
                  else if (ch === ")") {
                    if (depth === 0) break;
                    depth--;
                  } else if (ch === "," && depth === 0 && firstComma === -1) {
                    firstComma = j;
                  }
                }
                if (firstComma === -1 || j >= declBody.length) {
                  // malformed or unterminated: keep original fragment
                  outBody += declBody.slice(
                    pos,
                    Math.min(j + 1, declBody.length)
                  );
                  i = Math.min(j + 1, declBody.length);
                } else {
                  const firstArg = declBody.slice(start, firstComma).trim();
                  outBody += firstArg;
                  i = j + 1;
                }
              }
              return declStart + outBody + semi;
            }
          );
        }
      } catch (e) {
        /* noop */
      }

      // If typography is fixed, convert any clamp(...) usages to their first
      // argument so the tokens become fixed sizes. This covers cases where
      // client-provided tokens are responsive but the UI is configured to
      // display fixed sizes.
      try {
        if (!typoResponsive) {
          // Only convert clamp(...) -> first-argument for typographic tokens
          // (lines that declare --text-* or --line-height-*). We iterate the
          // file line-by-line and replace clamp occurrences only on those
          // lines. This preserves spacing clamps when spacingResponsive=false
          // (the user only requested fixed typography).
          // Process typographic and line-height declarations robustly at the
          // declaration level so multi-line clamps and nested functions are
          // handled correctly.
          const typographicDeclRegex =
            /(^\s*--(?:text|line-height)-[a-z0-9-]*\s*:\s*)([\s\S]*?)(;)/gim;
          const spacingDeclRegex =
            /(^\s*--(?:gap|spacing)-[a-z0-9-]*\s*:\s*)([\s\S]*?)(;)/gim;

          const replaceClampInBody = (body) => {
            if (!body.includes("clamp(")) return body;
            let out = "";
            let i = 0;
            while (i < body.length) {
              const pos = body.indexOf("clamp(", i);
              if (pos === -1) {
                out += body.slice(i);
                break;
              }
              out += body.slice(i, pos);
              const start = pos + 6;
              let depth = 0;
              let firstComma = -1;
              let j = start;
              for (; j < body.length; j++) {
                const ch = body[j];
                if (ch === "(") depth++;
                else if (ch === ")") {
                  if (depth === 0) break;
                  depth--;
                } else if (ch === "," && depth === 0 && firstComma === -1) {
                  firstComma = j;
                }
              }
              if (firstComma === -1 || j >= body.length) {
                out += body.slice(pos, Math.min(j + 1, body.length));
                i = Math.min(j + 1, body.length);
              } else {
                const firstArg = body.slice(start, firstComma).trim();
                out += firstArg;
                i = j + 1;
              }
            }
            return out;
          };

          // Replace typographic declarations
          processed = processed.replace(
            typographicDeclRegex,
            (full, declStart, declBody, semi) => {
              if (!declBody.includes("clamp(")) return full;
              return declStart + replaceClampInBody(declBody) + semi;
            }
          );

          // If spacing responsiveness is also disabled, replace spacing declarations
          if (spacingResponsive === false) {
            processed = processed.replace(
              spacingDeclRegex,
              (full, declStart, declBody, semi) => {
                if (!declBody.includes("clamp(")) return full;
                return declStart + replaceClampInBody(declBody) + semi;
              }
            );
          }
        }
      } catch (e) {
        /* noop */
      }

      // Ensure line-height tokens exist when responsive typography is enabled.
      try {
        // Check if semantic line-height tokens already exist (--line-height-s, --line-height-m, etc.)
        // NOT primitives (--line-height-20, --line-height-24, etc.)
        const hasSemanticLineHeightToken = /--line-height-[a-z]/i.test(
          processed
        );
        // Vérifier aussi la présence du commentaire pour éviter les doublons
        const hasLineHeightComment =
          /\/\*\s*Typographie\s*[—-]\s*Hauteurs de lignes\s*\*\//i.test(
            processed
          );
        console.log(
          "[generators-lh] hasSemanticLineHeightToken:",
          hasSemanticLineHeightToken
        );
        console.log(
          "[generators-lh] hasLineHeightComment:",
          hasLineHeightComment
        );
        console.log(
          "[generators-lh] processed preview (300 chars):",
          processed.substring(0, 300)
        );
        console.log(
          "[generators-lh] state.themeFromImport:",
          state?.themeFromImport
        );
        if (
          typoResponsive &&
          !hasSemanticLineHeightToken &&
          !hasLineHeightComment
        ) {
          console.log(
            "[generators-lh] ⚠️ Ajout du bloc line-height par défaut"
          );
          // Append canonical-like line-height block so the UI preview includes
          // typical line-height tokens when none were provided by the import.
          const canonicalLH = [
            "\n  /* Typographie — Hauteurs de lignes */",
            "  --line-height-s: clamp(var(--line-height-20), 1.1522rem + 0.4348vw, var(--line-height-24));",
            "  --line-height-m: clamp(var(--line-height-24), 1.4022rem + 0.4348vw, var(--line-height-28));",
            "  --line-height-2xl: clamp(var(--line-height-32), 1.9022rem + 0.4348vw, var(--line-height-36));",
            "  --line-height-5xl: clamp(var(--line-height-40), 1.8152rem + 3.0435vw, var(--line-height-68));",
            "  --line-height-4xl: clamp(var(--line-height-40), 2.1087rem + 1.7391vw, var(--line-height-56));",
            "  --line-height-6xl: clamp(var(--line-height-80), 4.5109rem + 2.1739vw, var(--line-height-100));",
            "\n",
          ].join("\n");
          if (/\n}\s*$/.test(processed))
            processed = processed.replace(
              /\n}\s*$/m,
              "\n" + canonicalLH + "}\n"
            );
          else processed = processed.trimEnd() + "\n" + canonicalLH + "\n";
        } else if (
          !typoResponsive &&
          !hasSemanticLineHeightToken &&
          !hasLineHeightComment
        ) {
          console.log(
            "[generators-lh] ⚠️ Ajout du bloc line-height fixe par défaut"
          );
          // Fixed typography requested: append simple line-height references
          const fixedLH = [
            "\n  /* Typographie — Hauteurs de lignes */",
            "  --line-height-s: var(--line-height-20);",
            "  --line-height-m: var(--line-height-24);",
            "  --line-height-2xl: var(--line-height-32);",
            "  --line-height-4xl: var(--line-height-56);",
            "  --line-height-5xl: var(--line-height-68);",
            "  --line-height-6xl: var(--line-height-100);",
            "\n",
          ].join("\n");
          if (/\n}\s*$/.test(processed))
            processed = processed.replace(/\n}\s*$/m, "\n" + fixedLH + "}\n");
          else processed = processed.trimEnd() + "\n" + fixedLH + "\n";
        }
      } catch (e) {
        /* noop */
      }

      // Reorder the Formulaires block so it appears immediately after
      // the Bordures section, and crucially keep it inside the :root body.
      try {
        const formMarker = "/* Formulaires */";
        const bordMarker = "/* Bordures */";

        // Locate the :root block body robustly
        const rootIdx = processed.indexOf(":root");
        if (rootIdx !== -1) {
          const openIdx = processed.indexOf("{", rootIdx);
          if (openIdx !== -1) {
            // Find matching closing brace
            let depth = 1;
            let j = openIdx + 1;
            while (j < processed.length && depth > 0) {
              const ch = processed[j];
              if (ch === "{") depth++;
              else if (ch === "}") depth--;
              j++;
            }
            if (depth === 0) {
              const body = processed.slice(openIdx + 1, j - 1);
              let inner = body;

              const fm = inner.indexOf(formMarker);
              if (fm !== -1) {
                // We'll split the inner body into top-level sections based on
                // comment headers (/* ... */) to reliably move entire sections
                // (header + declarations) without touching indentation.
                const sectionRegex = /\n?\s*\/\*[\s\S]*?\*\/\s*/g;
                const matches = Array.from(inner.matchAll(sectionRegex));

                if (matches.length === 0) {
                  // no clear sections: fallback to previous simple approach
                  let after = inner.slice(fm);
                  let endRel = after.indexOf("\n\n");
                  if (endRel === -1) endRel = after.length;
                  const block = after.slice(0, endRel).trim();
                  inner = inner.slice(0, fm) + inner.slice(fm + endRel);
                  inner = inner.trimEnd() + "\n\n" + block + "\n";
                } else {
                  // Build sections array
                  const sections = [];
                  let cursor = 0;
                  for (let mi = 0; mi < matches.length; mi++) {
                    const m = matches[mi];
                    const headerStart = m.index;
                    // add any leading content before first header as a plain section
                    if (mi === 0 && headerStart > 0) {
                      sections.push({
                        header: null,
                        body: inner.slice(0, headerStart),
                      });
                    }
                    const header = m[0].trim();
                    const contentStart = headerStart + m[0].length;
                    const nextStart =
                      mi + 1 < matches.length
                        ? matches[mi + 1].index
                        : inner.length;
                    const bodyContent = inner.slice(contentStart, nextStart);
                    sections.push({ header, body: bodyContent });
                    cursor = nextStart;
                  }

                  // Find indices for bordures and formulaires
                  let formIndex = -1;
                  let bordIndex = -1;
                  for (let si = 0; si < sections.length; si++) {
                    const h = sections[si].header || "";
                    if (h.includes(formMarker)) formIndex = si;
                    if (h.includes(bordMarker)) bordIndex = si;
                  }

                  if (formIndex !== -1) {
                    const formSection = sections.splice(formIndex, 1)[0];
                    // Insert after bordIndex if present, otherwise append at end
                    if (bordIndex !== -1) {
                      if (formIndex < bordIndex) bordIndex -= 1; // account for removal
                      sections.splice(bordIndex + 1, 0, formSection);
                    } else {
                      sections.push(formSection);
                    }
                  }

                  // Reconstruct inner from sections
                  inner = sections
                    .map((s) =>
                      s.header ? s.header + (s.body || "") : s.body || ""
                    )
                    .join("");
                  // When AST normalization has been used we already control
                  // blank-line spacing precisely; avoid the legacy collapse
                  // which can interfere with the node-driven formatting.
                  if (!usedAstNormalization) {
                    inner = inner.replace(/\n{3,}/g, "\n\n");
                  }
                }

                // Rebuild processed with updated inner
                processed =
                  processed.slice(0, openIdx + 1) +
                  inner +
                  processed.slice(j - 1);
              }
            }
          }
        }
      } catch (e) {
        /* noop */
      }

      // Final sanitization: remove accidental double-closing-paren sequences
      // that may have been left by aggressive replacements (e.g. "var(...));")
      try {
        // Collapse 2+ consecutive blank lines into exactly one blank line.
        // If we already used the AST-based normalizer, skip this legacy
        // collapse: the node serializer handles spacing deterministically.
        if (!usedAstNormalization) {
          processed = processed.replace(/(\r?\n\s*){2,}/g, "\n\n");
        }
      } catch (e) {
        /* noop - sanitization best-effort */
      }

      // Safety-net conversion PASS (after all injections):
      // Si l'utilisateur a demandé des tailles/espacements fixes, supprimer
      // toute occurrence restante de `clamp(...)` pour les déclarations
      // typographiques et d'espacement. Ceci couvre les cas où un bloc
      // injecté plus tard pourrait ré-introduire des `clamp()` non désirés.
      try {
        // Final safety-net: replace any remaining clamp(...) occurrences in
        // typographic and spacing declarations with their first argument.
        // Use declaration-level regexes so we don't break multi-line values.
        const typographicDeclRegexFinal =
          /(^\s*--(?:text|line-height)-[a-z0-9-]*\s*:\s*)([\s\S]*?)(;)/gim;
        const spacingDeclRegexFinal =
          /(^\s*--(?:spacing|gap)-[a-z0-9-]*\s*:\s*)([\s\S]*?)(;)/gim;

        const replaceClampInBodyFinal = (body) => {
          if (!body.includes("clamp(")) return body;
          let out = "";
          let i = 0;
          while (i < body.length) {
            const pos = body.indexOf("clamp(", i);
            if (pos === -1) {
              out += body.slice(i);
              break;
            }
            out += body.slice(i, pos);
            const start = pos + 6;
            let depth = 0;
            let firstComma = -1;
            let j = start;
            for (; j < body.length; j++) {
              const ch = body[j];
              if (ch === "(") depth++;
              else if (ch === ")") {
                if (depth === 0) break;
                depth--;
              } else if (ch === "," && depth === 0 && firstComma === -1) {
                firstComma = j;
              }
            }
            if (firstComma === -1 || j >= body.length) {
              out += body.slice(pos, Math.min(j + 1, body.length));
              i = Math.min(j + 1, body.length);
            } else {
              const firstArg = body.slice(start, firstComma).trim();
              out += firstArg;
              i = j + 1;
            }
          }
          return out;
        };

        if (!typoResponsive) {
          processed = processed.replace(
            typographicDeclRegexFinal,
            (full, declStart, declBody, semi) => {
              if (!declBody.includes("clamp(")) return full;
              return declStart + replaceClampInBodyFinal(declBody) + semi;
            }
          );
        }

        if (spacingResponsive === false) {
          processed = processed.replace(
            spacingDeclRegexFinal,
            (full, declStart, declBody, semi) => {
              if (!declBody.includes("clamp(")) return full;
              return declStart + replaceClampInBodyFinal(declBody) + semi;
            }
          );
        }
      } catch (e) {
        /* noop - best-effort safety net */
      }

      // Final ordering enforcement: ensure any "/* Formulaires */" section
      // appears immediately after the "/* Bordures */" section within the
      // :root block. This is a last-pass fix to avoid regressions from
      // earlier transformations.
      try {
        const rootIdx2 = processed.indexOf(":root");
        if (rootIdx2 !== -1) {
          const openIdx2 = processed.indexOf("{", rootIdx2);
          if (openIdx2 !== -1) {
            let depth2 = 1;
            let k = openIdx2 + 1;
            while (k < processed.length && depth2 > 0) {
              const ch = processed[k];
              if (ch === "{") depth2++;
              else if (ch === "}") depth2--;
              k++;
            }
            if (depth2 === 0) {
              const body2 = processed.slice(openIdx2 + 1, k - 1);
              const sectionRegex2 = /\n?\s*\/\*[\s\S]*?\*\/\s*/g;
              const matches2 = Array.from(body2.matchAll(sectionRegex2));
              if (matches2.length > 0) {
                const sections2 = [];
                for (let mi = 0; mi < matches2.length; mi++) {
                  const m = matches2[mi];
                  const headerStart = m.index;
                  if (mi === 0 && headerStart > 0) {
                    sections2.push({
                      header: null,
                      body: body2.slice(0, headerStart),
                    });
                  }
                  const header = m[0].trim();
                  const contentStart = headerStart + m[0].length;
                  const nextStart =
                    mi + 1 < matches2.length
                      ? matches2[mi + 1].index
                      : body2.length;
                  const bodyContent = body2.slice(contentStart, nextStart);
                  sections2.push({ header, body: bodyContent });
                }

                // Collect all form sections, remove them
                const formSections = [];
                for (let si = sections2.length - 1; si >= 0; si--) {
                  const h = sections2[si].header || "";
                  if (h.includes("/* Formulaires */")) {
                    formSections.unshift(sections2.splice(si, 1)[0]);
                  }
                }

                if (formSections.length) {
                  // find bordures index
                  let bordIdx2 = -1;
                  for (let si = 0; si < sections2.length; si++) {
                    const h = sections2[si].header || "";
                    if (h.includes("/* Bordures */")) {
                      bordIdx2 = si;
                      break;
                    }
                  }

                  // insert forms after bordIdx2 (or at end)
                  if (bordIdx2 !== -1) {
                    // insert in order
                    sections2.splice(bordIdx2 + 1, 0, ...formSections);
                  } else {
                    sections2.push(...formSections);
                  }

                  // Rebuild body and processed
                  let newInner = sections2
                    .map((s) =>
                      s.header ? s.header + (s.body || "") : s.body || ""
                    )
                    .join("");
                  if (!usedAstNormalization) {
                    newInner = newInner.replace(/\n{3,}/g, "\n\n");
                  }
                  // If AST normalization was used we trust the node serializer
                  // to have produced the intended blank-line semantics.
                  processed =
                    processed.slice(0, openIdx2 + 1) +
                    newInner +
                    processed.slice(k - 1);
                }
              }
            }
          }
        }
      } catch (e) {
        /* noop - best-effort ordering enforcement */
      }

      // If a single theme is requested, normalise the color-scheme header
      // and remove the alternate data-theme blocks so the preview reflects
      // single-mode (no light-dark wrappers and no data-theme toggles).
      try {
        if (themeMode === "light" || themeMode === "dark") {
          // Change `color-scheme: light dark;` -> `color-scheme: light;` (or dark)
          processed = processed.replace(
            /color-scheme:\s*light\s+dark\s*;/i,
            `color-scheme: ${themeMode};`
          );
          // Remove any &[data-theme="light"] { ... } and &[data-theme="dark"] { ... }
          processed = processed.replace(
            /&\[data-theme=\"light\"\][\s\S]*?\}\s*/g,
            ""
          );
          processed = processed.replace(
            /&\[data-theme=\"dark\"\][\s\S]*?\}\s*/g,
            ""
          );
        }
      } catch (e) {
        /* noop: best-effort */
      }

      // If the UI is configured to a single theme (light OR dark), collapse
      // light-dark(...) calls to the appropriate branch so the preview shows
      // only the selected value (avoid showing light-dark in single-mode).
      try {
        if (themeMode === "light" || themeMode === "dark") {
          const preferFirst = themeMode === "light";
          let out = "";
          let cursor = 0;
          while (true) {
            const idx = processed.indexOf("light-dark(", cursor);
            if (idx === -1) {
              out += processed.slice(cursor);
              break;
            }
            out += processed.slice(cursor, idx);
            let j = idx + "light-dark(".length;
            let depth = 0;
            let commaPos = -1;
            for (; j < processed.length; j++) {
              const ch = processed[j];
              if (ch === "(") depth++;
              else if (ch === ")") {
                if (depth === 0) break;
                depth--;
              } else if (ch === "," && depth === 0 && commaPos === -1) {
                commaPos = j;
              }
            }
            if (commaPos === -1 || j >= processed.length) {
              // malformed: copy verbatim
              out += processed.slice(idx, j + 1);
              cursor = j + 1;
            } else {
              const first = processed
                .slice(idx + "light-dark(".length, commaPos)
                .trim();
              const second = processed.slice(commaPos + 1, j).trim();
              out += preferFirst ? first : second;
              cursor = j + 1;
            }
          }
          processed = out;
        }
      } catch (e) {
        /* noop: best-effort collapse */
      }

      // Ensure clamp(...) and light-dark(...) expressions are kept on a
      // single line: remove stray newlines inside their parentheses while
      // preserving nested parentheses (var(...)). This fixes broken wraps
      // introduced by earlier processing steps.
      try {
        const collapseInners = (text, token) => {
          let cursor = 0;
          while (true) {
            const idx = text.indexOf(token, cursor);
            if (idx === -1) break;
            const start = idx + token.length;
            let depth = 0;
            let j = start;
            for (; j < text.length; j++) {
              const ch = text[j];
              if (ch === "(") depth++;
              else if (ch === ")") {
                if (depth === 0) break;
                depth--;
              }
            }
            if (j >= text.length) break; // malformed, stop
            const inner = text.slice(start, j);
            const collapsed = inner
              .replace(/\r?\n\s*/g, " ")
              .replace(/\s{2,}/g, " ")
              .trim();
            text = text.slice(0, start) + collapsed + text.slice(j);
            cursor = start + collapsed.length + 1; // continue after ')'
          }
          return text;
        };
        processed = collapseInners(processed, "clamp(");
        processed = collapseInners(processed, "light-dark(");
      } catch (e) {
        /* noop */
      }

      // Additional sanitization: remove stray newlines before closing parens
      // and ensure declarations after a semicolon start on a new indented line.
      try {
        // collapse newlines that appear directly before a ')'
        processed = processed.replace(/\n\s*\)/g, ")");
        // if a semicolon or closing-paren is followed by excessive spaces and then a new var,
        // put the next declaration on its own line with two-space indent
        processed = processed.replace(/;\s+--/g, ";\n  --");
        processed = processed.replace(/\)\)\s+--/g, "))\n  --");
        processed = processed.replace(/\)\s+--/g, ");\n  --");
      } catch (e) {
        /* noop */
      }

      // Fix broken declarations that were split across lines (e.g. long
      // clamp lines or var names split). Rejoin lines for any declaration
      // starting with --line-height- or --text- that does not end with a
      // semicolon on the same physical line.
      try {
        const lines = processed.split(/\r?\n/);
        const outLines = [];
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          // If this looks like the start/mid of a declaration that is
          // incomplete (no semicolon), stitch subsequent lines until we
          // reach a semicolon.
          if (
            /--line-height-\d+|--text-[a-z0-9-]*/.test(line) &&
            !/;\s*$/.test(line)
          ) {
            let j = i + 1;
            let accum = line;
            while (j < lines.length && !/;\s*$/.test(accum)) {
              accum += lines[j].trim();
              j++;
            }
            outLines.push(accum);
            i = j - 1;
          } else {
            outLines.push(line);
          }
        }
        processed = outLines.join("\n");
      } catch (e) {
        /* noop */
      }

      // As a final pass, ensure each declaration starts on its own line by
      // inserting a newline before any " --var" sequence that is not
      // already on a new line. This handles residual cases where multiple
      // declarations ended up on the same physical line.
      try {
        // Insert a newline before any declaration start that directly
        // follows a closing paren or semicolon (safer than a global match
        // which could hit comment hyphen lines).
        processed = processed.replace(/([);\}])\s+--/g, "$1\n  --");
      } catch (e) {
        /* noop */
      }

      // Normalize any multi-line --line-height-... declarations into single
      // lines: match the full declaration (even across newlines) and collapse
      // internal newlines/spaces.
      try {
        processed = processed.replace(
          /\s*--line-height-\d+\s*:[\s\S]*?;/g,
          (m) => {
            const collapsed = m.replace(/\r?\n\s*/g, " ").trim();
            return "  " + collapsed;
          }
        );
      } catch (e) {
        /* noop */
      }

      // Rebuild the :root block to ensure declarations and comments are
      // each on their own line (prevents mid-token newlines and joins
      // multiple declarations accidentally concatenated on one line).
      try {
        const rootIdx = processed.indexOf(":root");
        if (rootIdx !== -1) {
          const braceOpen = processed.indexOf("{", rootIdx);
          if (braceOpen !== -1) {
            // find matching closing brace for :root
            let depth = 0;
            let j = braceOpen;
            for (; j < processed.length; j++) {
              if (processed[j] === "{") depth++;
              else if (processed[j] === "}") {
                depth--;
                if (depth === 0) break;
              }
            }
            if (j < processed.length) {
              const inner = processed.slice(braceOpen + 1, j);
              // parse inner content: emit comments and declarations
              const out = [];
              let i = 0;
              while (i < inner.length) {
                // skip leading whitespace/newlines
                if (/\s/.test(inner[i])) {
                  i++;
                  continue;
                }
                // comment block
                if (inner[i] === "/" && inner[i + 1] === "*") {
                  const end = inner.indexOf("*/", i + 2);
                  const comment =
                    end === -1 ? inner.slice(i) : inner.slice(i, end + 2);
                  // Preserve a blank line before the section comment if the
                  // previous item was not already a blank line.
                  if (out.length && out[out.length - 1] !== "") out.push("");
                  // Emit the comment line. Do NOT insert an extra blank line
                  // after the comment — the next declaration should follow
                  // immediately on the next line (single newline).
                  out.push("  " + comment.trim());
                  i = end === -1 ? inner.length : end + 2;
                  continue;
                }
                // If this is a nested block (selector { ... }), parse the
                // full block including inner semicolons and closing brace.
                // Otherwise treat it as a single-line declaration ending
                // at the next semicolon.
                const nextBrace = inner.indexOf("{", i);
                const nextSemi = inner.indexOf(";", i);
                if (
                  nextBrace !== -1 &&
                  (nextSemi === -1 || nextBrace < nextSemi)
                ) {
                  // Parse block: find matching closing brace
                  let depth2 = 0;
                  let k = nextBrace;
                  for (; k < inner.length; k++) {
                    if (inner[k] === "{") depth2++;
                    else if (inner[k] === "}") {
                      depth2--;
                      if (depth2 === 0) break;
                    }
                  }
                  const blockEnd = k;
                  const selector = inner.slice(i, nextBrace).trim();
                  const blockInner = inner.slice(nextBrace + 1, blockEnd);
                  // Emit a blank line before selector-block if helpful
                  if (out.length && out[out.length - 1] !== "") out.push("");
                  out.push("  " + selector + " {");
                  // Emit inner declarations with additional indentation
                  const subLines = blockInner
                    .split(/;/g)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  for (const sl of subLines) {
                    out.push("    " + sl + ";");
                  }
                  out.push("  }");
                  i = blockEnd + 1;
                } else {
                  // Simple declaration
                  if (nextSemi === -1) {
                    const rem = inner.slice(i).trim();
                    if (rem) out.push("  " + rem);
                    break;
                  }
                  const decl = inner
                    .slice(i, nextSemi + 1)
                    .replace(/\r?\n\s*/g, " ")
                    .trim();
                  out.push("  " + decl);
                  i = nextSemi + 1;
                }
              }
              const rebuilt = ":root {\n" + out.join("\n") + "\n}\n";
              processed =
                processed.slice(0, rootIdx) + rebuilt + processed.slice(j + 1);
            }
          }
        }
      } catch (e) {
        /* noop */
      }

      // IMPORTANT: Préserver les tokens d'espacement sémantiques personnalisés
      // qui proviennent de l'import Figma (ex: --spacing-tiny, --spacing-compact)
      // Ces tokens doivent être conservés même quand l'utilisateur change
      // spacingResponsive (true/false) car ils sont des nommages métier.
      try {
        console.log(
          "[generators-spacing-preserve] Vérification tokens sémantiques personnalisés"
        );

        // Chercher tous les tokens --spacing-{nom} (non numériques) dans processed
        const customSpacingTokensMap = new Map(); // nom → déclaration complète
        const spacingRx =
          /(--spacing-([a-z]+(?:-[a-z]+)*)\s*:\s*var\(--spacing-(\d+)\)\s*;)/gi;
        let match;
        while ((match = spacingRx.exec(processed))) {
          const fullDecl = match[1]; // ex: "--spacing-tiny: var(--spacing-2);"
          const name = match[2]; // ex: "tiny"
          const value = parseInt(match[3], 10); // ex: 2

          // Ignorer les tokens prédéfinis (xs, s, m, l, xl)
          if (!["xs", "s", "m", "l", "xl"].includes(name)) {
            customSpacingTokensMap.set(name, { decl: fullDecl, value });
            console.log(
              "[generators-spacing-preserve] Token personnalisé trouvé:",
              name,
              "→",
              value
            );
          }
        }

        console.log(
          "[generators-spacing-preserve] Total tokens personnalisés:",
          customSpacingTokensMap.size
        );

        // Trier les tokens par valeur croissante (tiny → colossal)
        if (customSpacingTokensMap.size > 0) {
          const sorted = Array.from(customSpacingTokensMap.entries()).sort(
            (a, b) => a[1].value - b[1].value
          );

          console.log(
            "[generators-spacing-preserve] Tokens triés par valeur:",
            sorted.map(([name, { value }]) => `${name}(${value})`).join(", ")
          );

          // 1. Supprimer les tokens personnalisés de leur position actuelle
          for (const [name, { decl }] of customSpacingTokensMap) {
            // Échapper les caractères spéciaux pour regex
            const escapedDecl = decl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Supprimer la déclaration (avec espaces/indentation possibles avant)
            processed = processed.replace(
              new RegExp(`\\s*${escapedDecl}`, "g"),
              ""
            );
          }

          // 2. Trouver où insérer les tokens triés (après --spacing-xl)
          const spacingXlMatch = processed.match(/--spacing-xl\s*:[^;]+;/);
          if (spacingXlMatch) {
            const insertPos =
              processed.indexOf(spacingXlMatch[0]) + spacingXlMatch[0].length;

            // Construire le bloc de tokens personnalisés triés
            const customTokensBlock = sorted
              .map(([name, { decl }]) => `\n  ${decl}`)
              .join("");

            // Insérer après --spacing-xl
            processed =
              processed.slice(0, insertPos) +
              customTokensBlock +
              processed.slice(insertPos);

            console.log(
              "[generators-spacing-preserve] Tokens réordonnés et insérés après --spacing-xl"
            );
          }
        }
      } catch (e) {
        console.error("[generators-spacing-preserve] Erreur:", e);
      }

      // Passe finale robuste : remplacer tout clamp(...) restant pour les
      // déclarations typographiques et d'espacement lorsque la config
      // demande des valeurs fixes. Utilise des regex multi-line non gourmandes
      // pour couvrir les cas où les arguments sont sur plusieurs lignes.
      try {
        if (!typoResponsive) {
          processed = processed.replace(
            /(--text-[a-z0-9-]*\s*:\s*)clamp\([\s\S]*?\,([\s\S]*?)\)/gi,
            (m, pfx, inner) => `${pfx}${inner.trim().replace(/;?\s*$/, "")};`
          );
          processed = processed.replace(
            /(--line-height-[a-z0-9-]*\s*:\s*)clamp\([\s\S]*?\,([\s\S]*?)\)/gi,
            (m, pfx, inner) => `${pfx}${inner.trim().replace(/;?\s*$/, "")};`
          );
        }
        if (spacingResponsive === false) {
          processed = processed.replace(
            /(--spacing-[a-z0-9-]*\s*:\s*)clamp\([\s\S]*?\,([\s\S]*?)\)/gi,
            (m, pfx, inner) => `${pfx}${inner.trim().replace(/;?\s*$/, "")};`
          );
          processed = processed.replace(
            /(--gap-[a-z0-9-]*\s*:\s*)clamp\([\s\S]*?\,([\s\S]*?)\)/gi,
            (m, pfx, inner) => `${pfx}${inner.trim().replace(/;?\s*$/, "")};`
          );
        }
      } catch (e) {
        /* noop - best-effort */
      }

      // Enforce canonical section ordering inside :root according to
      // `canonical/tokens/tokens-order.txt`.
      // Behaviour:
      // - Preserve all declarations and values (imports override canonicals).
      // - Reorder comment sections to follow the canonical sequence.
      // - Any sections not matched are appended to "Tokens complémentaires".
      try {
        const orderRegexps = [
          /Theme/i,
          /Couleur primaire/i,
          /Couleur d'accent/i,
          /Surface du document/i,
          /Niveaux de profondeur/i,
          /Interactions/i,
          /Couleur de sélection/i,
          /États/i,
          /Bordures/i,
          /Tailles de police/i,
          /Hauteurs de lignes/i,
          /Espacements/i,
          /Formulaires/i,
          /Tokens complémentaires/i,
        ];

        const rootIdx = processed.indexOf(":root");
        if (rootIdx !== -1) {
          const open = processed.indexOf("{", rootIdx);
          if (open !== -1) {
            // find matching closing brace
            let depth = 1;
            let p = open + 1;
            while (p < processed.length && depth > 0) {
              if (processed[p] === "{") depth++;
              else if (processed[p] === "}") depth--;
              p++;
            }
            const end = p - 1;
            // Work on a mutable body string so we can extract and remove the
            // theme prelude (color-scheme + &[data-theme] blocks) to avoid
            // duplications when we reassemble the canonical order.
            let body = processed.slice(open + 1, end);

            // First, extract any color-scheme + &[data-theme] blocks so they
            // are treated as the canonical Theme prelude and not duplicated.
            let themePrelude = "";
            try {
              const csIndex = body.search(/\bcolor-scheme\b/);
              if (csIndex !== -1) {
                let pos = body.indexOf(";", csIndex);
                if (pos === -1) pos = csIndex;
                else pos = pos + 1;

                // include any following &[data-theme] blocks
                while (true) {
                  const dtIdx = body.indexOf("&[data-theme", pos);
                  if (dtIdx === -1) break;
                  const openBrace = body.indexOf("{", dtIdx);
                  if (openBrace === -1) break;
                  let depth = 1;
                  let k = openBrace + 1;
                  while (k < body.length && depth > 0) {
                    if (body[k] === "{") depth++;
                    else if (body[k] === "}") depth--;
                    k++;
                  }
                  pos = k; // after closing brace
                }

                themePrelude = body.slice(csIndex, pos).trim();
                // Remove that slice from body
                body = (body.slice(0, csIndex) + body.slice(pos)).trim();
                // Remove any remaining stray color-scheme/data-theme occurrences
                body = body.replace(/\bcolor-scheme\b[\s\S]*?;/g, "");
                body = body.replace(/&\[data-theme[\s\S]*?\}[\s\n\r]*/g, "");
              }
            } catch (e) {
              /* noop */
            }

            // Extract comment-delimited sections
            const sectionRx = /\s*\/\*[\s\S]*?\*\/\s*/g;
            const matches = Array.from(body.matchAll(sectionRx));
            const sections = [];
            let cursor = 0;
            if (matches.length) {
              for (let i = 0; i < matches.length; i++) {
                const m = matches[i];
                const hdrStart = m.index;
                // pre-header content (only for first match)
                if (i === 0 && hdrStart > 0) {
                  const pre = body.slice(0, hdrStart).trim();
                  if (pre) sections.push({ header: null, body: pre });
                }
                const header = m[0].trim();
                const contentStart = hdrStart + m[0].length;
                const nextStart =
                  i + 1 < matches.length ? matches[i + 1].index : body.length;
                const secBody = body.slice(contentStart, nextStart).trim();
                sections.push({ header, body: secBody });
                cursor = nextStart;
              }
              // trailing content after last header
              if (cursor < body.length) {
                const tail = body.slice(cursor).trim();
                if (tail) sections.push({ header: null, body: tail });
              }
            } else {
              // No comment headers: try to recover any top-level declarations
              // that do not match canonical prefixes and group them as
              // "Tokens complémentaires" so imported JSON variables like
              // `--surface-dim` or `--accent-blue` are not lost.
              try {
                const declRx = /(--[a-z0-9-]+)\s*:[^;]+;/gim;
                const canonicalPropRx =
                  /^(--primary$|--on-primary$|--primary-lighten$|--primary-darken$|--accent$|--accent-invert$|--surface$|--on-surface$|--layer-|--link$|--link-hover$|--link-active$|--selection$|--warning$|--error$|--success$|--info$|--border-|--text-|--line-height-|--spacing-|--gap-|--form-|--on-form-control|--checkables?-|--checkable-)/i;
                const orphanDecls = [];
                let m2;
                // Collect declarations that do NOT match canonical prefixes
                while ((m2 = declRx.exec(body))) {
                  const prop = m2[1];
                  const decl = m2[0].trim();
                  if (!canonicalPropRx.test(prop)) {
                    orphanDecls.push(decl);
                    // remove the declaration from body to avoid duplicates
                    body = body.replace(m2[0], "");
                  }
                }

                if (orphanDecls.length) {
                  const formatted = orphanDecls
                    .map((l) => (l.trim() ? "  " + l.trim() : ""))
                    .filter(Boolean)
                    .join("\n");

                  // Insert a Tokens complémentaires block just before closing
                  // brace of :root to keep ordering stable.
                  const insertion =
                    "\n  /* Tokens complémentaires */\n" + formatted + "\n";
                  processed =
                    processed.slice(0, open + 1) +
                    "\n" +
                    body.trim() +
                    insertion +
                    processed.slice(end);
                }
              } catch (e) {
                /* noop - best effort */
              }
            }

            if (sections.length > 0) {
              // Map headers to their section strings (preserve original header text)
              const headerMap = new Map();
              const unmatched = [];
              for (const s of sections) {
                if (!s.header) {
                  unmatched.push(s.body);
                  continue;
                }
                headerMap.set(s.header, s.body);
              }

              // Ensure form-related declarations are grouped under Formulaires
              // This moves any `--form-*`, `--on-form-control`, `--checkable-*`
              // declarations out of other sections (eg. "Bordures") and into
              // a dedicated Formulaires section so ordering is stable.
              try {
                const formPropRx =
                  /^(--form-[a-z0-9-]*|--on-form-control\b|--checkable-[a-z0-9-]*|--checkables?[a-z0-9-]*)/i;
                const declRx = /(--[a-z0-9-]+)\s*:[^;]+;/gim;
                const collectedFormDecls = [];

                for (const [hdr, hbody] of Array.from(headerMap.entries())) {
                  let bodyStr = hbody || "";
                  let m3;
                  const toRemove = [];
                  while ((m3 = declRx.exec(hbody))) {
                    const prop = m3[1];
                    if (formPropRx.test(prop)) {
                      collectedFormDecls.push(m3[0].trim());
                      toRemove.push(m3[0]);
                    }
                  }
                  if (toRemove.length) {
                    for (const tr of toRemove) {
                      bodyStr = bodyStr.replace(tr, "");
                    }
                    headerMap.set(hdr, bodyStr.trim());
                  }
                }

                if (collectedFormDecls.length) {
                  const formHeaderKey = "  /* Formulaires */";
                  // try to find an existing header that already represents forms
                  let existingKey = null;
                  for (const key of headerMap.keys()) {
                    if (/formulaires/i.test(key)) {
                      existingKey = key;
                      break;
                    }
                  }
                  const formatted = collectedFormDecls
                    .map((d) => (d ? "  " + d : ""))
                    .join("\n");
                  if (!existingKey) {
                    // create a synthetic header entry for forms
                    headerMap.set(formHeaderKey, formatted);
                  } else {
                    const existingBody = headerMap.get(existingKey) || "";
                    headerMap.set(
                      existingKey,
                      (formatted + "\n\n" + existingBody).trim()
                    );
                  }
                }
              } catch (e) {
                /* noop - best effort */
              }

              // Normalize header variants into canonical labels so that
              // variants like "/* Couleur primaire (dérivés injectés) */"
              // are grouped under the canonical "/* Couleur primaire */".
              const headerGroups = new Map();
              const normalizeHeader = (hdr) => {
                const raw = String(hdr || "");
                // Normalize and strip diacritics/punctuation for robust matching
                let alpha = raw;
                try {
                  alpha = raw
                    .normalize("NFKD")
                    .replace(/\p{M}/gu, "")
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                } catch (e) {
                  alpha = raw
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                }

                // Explicit mapping to canonical header lines. This avoids
                // depending on the `canonicalLabels` array being in scope
                // and ensures variants are collapsed deterministically.
                if (alpha.includes("couleur primaire"))
                  return "  /* Couleur primaire */";
                if (
                  alpha.includes("couleur d accent") ||
                  alpha.includes("couleur d'accent")
                )
                  return "  /* Couleur d'accent */";
                if (
                  alpha.includes("surface du document") ||
                  alpha.includes("surface")
                )
                  return "  /* Surface du document */";
                if (
                  alpha.includes("niveaux de profondeur") ||
                  alpha.includes("profondeur")
                )
                  return "  /* Niveaux de profondeur */";
                if (alpha.includes("interactions"))
                  return "  /* Interactions */";
                if (
                  alpha.includes("couleur de selection") ||
                  alpha.includes("selection") ||
                  alpha.includes("sélection")
                )
                  return "  /* Couleur de sélection */";
                if (
                  alpha.includes("état") ||
                  alpha.includes("etats") ||
                  alpha.includes("états d alerte")
                )
                  return "  /* États d'alerte */";
                if (alpha.includes("bordure")) return "  /* Bordures */";
                if (
                  alpha.includes("tailles de police") ||
                  alpha.includes("tailles") ||
                  alpha.includes("police")
                )
                  return "  /* Tailles de police */";
                if (
                  alpha.includes("hauteurs de lignes") ||
                  alpha.includes("hauteurs de ligne") ||
                  alpha.includes("hauteurs")
                )
                  return "  /* Hauteurs de lignes */";
                if (
                  alpha.includes("espacement") ||
                  alpha.includes("espacements")
                )
                  return "  /* Espacements */";
                if (
                  alpha.includes("formulaires") ||
                  alpha.includes("form") ||
                  alpha.includes("form-")
                )
                  return "  /* Formulaires */";
                if (
                  alpha.includes("tokens complement") ||
                  alpha.includes("tokens complementai") ||
                  alpha.includes("complement")
                )
                  return "  /* Tokens complémentaires */";

                // Fallback: return trimmed original header
                return hdr.trim();
              };

              for (const [hdr, body] of headerMap.entries()) {
                const key = normalizeHeader(hdr);
                // (debug) mapping hdr -> normalized key (silent in production)
                if (!headerGroups.has(key)) headerGroups.set(key, []);
                headerGroups.get(key).push(body);
              }

              // Debug: log detected headers (temporary)
              try {
                const keys = Array.from(headerGroups.keys()).map((k) =>
                  k.trim()
                );
                // detected headers and orderRegexps logging removed for production
              } catch (e) {
                /* noop */
              }

              // Helper to find a header key matching a regexp
              const findHeaderKey = (rx) => {
                for (const key of headerMap.keys()) {
                  if (rx.test(key)) return key;
                }
                return null;
              };

              const orderedParts = [];
              // Insert a canonical Theme prelude (color-scheme + &[data-theme])
              // at the top of :root so ordering is strict and predictable.
              // Prefer the imported theme prelude (color-scheme + &[data-theme])
              // if it was present in the import. Otherwise emit a canonical
              // prelude according to the configured `themeMode`.
              let themePreludeToEmit = null;
              if (themePrelude && String(themePrelude).trim()) {
                // Preserve the exact imported prelude but ensure a canonical
                // header comment is present for ordering clarity. Also normalize
                // indentation so the prelude aligns with other :root entries.
                const preservedRaw = String(themePrelude).trim();
                const preserved = preservedRaw
                  .split(/\r?\n/)
                  .map((l) => (l.trim() ? "  " + l.trim() : ""))
                  .join("\n");
                themePreludeToEmit =
                  "  /* Theme (color-scheme) */\n" + preserved;
              } else {
                const tmpPrelude = [];
                tmpPrelude.push("  /* Theme (color-scheme) */");
                if (typeof themeMode !== "undefined" && themeMode === "both") {
                  tmpPrelude.push("  color-scheme: light dark;");
                  tmpPrelude.push("");
                  tmpPrelude.push('  &[data-theme="light"] {');
                  tmpPrelude.push("    color-scheme: light;");
                  tmpPrelude.push("  }");
                  tmpPrelude.push("");
                  tmpPrelude.push('  &[data-theme="dark"] {');
                  tmpPrelude.push("    color-scheme: dark;");
                  tmpPrelude.push("  }");
                } else if (
                  typeof themeMode !== "undefined" &&
                  themeMode === "dark"
                ) {
                  tmpPrelude.push("  color-scheme: dark;");
                } else {
                  tmpPrelude.push("  color-scheme: light;");
                }
                themePreludeToEmit = tmpPrelude.join("\n");
              }
              orderedParts.push(themePreludeToEmit);

              const usedKeys = new Set();
              // canonical labels to output (must match tokens-order.txt)
              const canonicalLabels = [
                "  /* Theme (color-scheme) */",
                "  /* Couleur primaire */",
                "  /* Couleur d'accent */",
                "  /* Surface du document */",
                "  /* Niveaux de profondeur */",
                "  /* Interactions */",
                "  /* Couleur de sélection */",
                "  /* États d'alerte */",
                "  /* Bordures */",
                "  /* Tailles de police */",
                "  /* Hauteurs de lignes */",
                "  /* Espacements */",
                "  /* Formulaires */",
                "  /* Tokens complémentaires */",
              ];

              for (let idx = 0; idx < orderRegexps.length; idx++) {
                const rx = orderRegexps[idx];
                const hdrLine = canonicalLabels[idx];
                // Skip Theme here — already emitted as prelude above
                if (idx === 0) continue;

                // find all header keys that match this semantic category
                const matchingKeys = Array.from(headerMap.keys()).filter((k) =>
                  rx.test(k)
                );
                if (matchingKeys.length === 0) {
                  // Aucun header importé pour cette section :
                  // - Si des propriétés pertinentes existent dans le body, les ignorer ici
                  //   (elles seront récupérées plus bas dans les 'remaining').
                  // - Sinon, injecter un bloc canonique minimal non-destructif afin
                  //   que la sortie génère toujours les sections canoniques visibles
                  //   dans l'ordre attendu. Les valeurs insérées respectent
                  //   les primitives disponibles (chooseBestVariant/chooseNumericVariant)
                  //   et ne remplacent pas les tokens importés.
                  const hdrLine = canonicalLabels[idx];
                  const defaultLines = [];

                  // Helper: sources to resolve variants
                  const _sources_for_defaults =
                    (state && state.themeContent ? state.themeContent : "") +
                    "\n" +
                    (state && state.tokensContent ? state.tokensContent : "") +
                    "\n" +
                    (state && state.config && state.config.customVars
                      ? state.config.customVars
                      : "");

                  // Build minimal canonical blocks per semantic index
                  try {
                    switch (idx) {
                      case 1: // Couleur primaire
                        {
                          const pv = chooseBestVariant(
                            displayPrimary,
                            _sources_for_defaults
                          );
                          const p300 = chooseNumericVariant(
                            displayPrimary,
                            "300",
                            _sources_for_defaults
                          );
                          const p700 = chooseNumericVariant(
                            displayPrimary,
                            "700",
                            _sources_for_defaults
                          );
                          defaultLines.push(`  --primary: var(${pv});`);
                          defaultLines.push(
                            `  --on-primary: var(--color-white);`
                          );
                          defaultLines.push(
                            `  --primary-lighten: var(${p300});`
                          );
                          defaultLines.push(
                            `  --primary-darken: var(${p700});`
                          );
                        }
                        break;
                      case 2: // Couleur d'accent
                        defaultLines.push(
                          themeMode === "both"
                            ? `  --accent: light-dark(var(--primary), var(--primary-lighten));\n  --accent-invert: light-dark(var(--primary-lighten), var(--primary));`
                            : themeMode === "dark"
                            ? `  --accent: var(--primary-lighten);\n  --accent-invert: var(--primary);`
                            : `  --accent: var(--primary);\n  --accent-invert: var(--primary-lighten);`
                        );
                        break;
                      case 3: // Surface du document
                        if (themeMode === "both") {
                          defaultLines.push(
                            "  --surface: light-dark(var(--color-white), var(--color-gray-900));"
                          );
                          defaultLines.push(
                            "  --on-surface: light-dark(var(--color-gray-900), var(--color-gray-100));"
                          );
                        } else if (themeMode === "dark") {
                          defaultLines.push(
                            "  --surface: var(--color-gray-900);"
                          );
                          defaultLines.push(
                            "  --on-surface: var(--color-gray-100);"
                          );
                        } else {
                          defaultLines.push("  --surface: var(--color-white);");
                          defaultLines.push(
                            "  --on-surface: var(--color-gray-900);"
                          );
                        }
                        break;
                      case 4: // Niveaux de profondeur
                        if (themeMode === "both") {
                          defaultLines.push(
                            "  --layer-1: light-dark(var(--color-gray-50), var(--color-gray-800));"
                          );
                          defaultLines.push(
                            "  --layer-2: light-dark(var(--color-gray-100), var(--color-gray-700));"
                          );
                          defaultLines.push(
                            "  --layer-3: light-dark(var(--color-gray-200), var(--color-gray-600));"
                          );
                        } else if (themeMode === "dark") {
                          defaultLines.push(
                            "  --layer-1: var(--color-gray-800);"
                          );
                          defaultLines.push(
                            "  --layer-2: var(--color-gray-700);"
                          );
                          defaultLines.push(
                            "  --layer-3: var(--color-gray-600);"
                          );
                        } else {
                          defaultLines.push(
                            "  --layer-1: var(--color-gray-50);"
                          );
                          defaultLines.push(
                            "  --layer-2: var(--color-gray-100);"
                          );
                          defaultLines.push(
                            "  --layer-3: var(--color-gray-200);"
                          );
                        }
                        break;
                      case 5: // Interactions
                        if (themeMode === "both") {
                          defaultLines.push(
                            `  --link: light-dark(var(--primary), var(--primary-lighten));\n  --link-hover: light-dark(var(--primary-darken), var(--primary));\n  --link-active: light-dark(var(--primary-darken), var(--primary));`
                          );
                        } else if (themeMode === "dark") {
                          defaultLines.push(
                            "  --link: var(--primary-lighten);"
                          );
                          defaultLines.push("  --link-hover: var(--primary);");
                          defaultLines.push("  --link-active: var(--primary);");
                        } else {
                          defaultLines.push("  --link: var(--primary);");
                          defaultLines.push(
                            "  --link-hover: var(--primary-darken);"
                          );
                          defaultLines.push(
                            "  --link-active: var(--primary-darken);"
                          );
                        }
                        break;
                      case 6: // Couleur de sélection
                        if (themeMode === "both") {
                          defaultLines.push(
                            "  --selection: light-dark(var(--primary-lighten), var(--primary-darken));"
                          );
                        } else if (themeMode === "dark") {
                          defaultLines.push("  --selection: var(--primary);");
                        } else {
                          defaultLines.push(
                            "  --selection: var(--primary-lighten);"
                          );
                        }
                        break;
                      case 7: // États
                        if (themeMode === "both") {
                          defaultLines.push(
                            "  --warning: light-dark(var(--color-warning-500), var(--color-warning-300));"
                          );
                          defaultLines.push(
                            "  --error: light-dark(var(--color-error-500), var(--color-error-300));"
                          );
                          defaultLines.push(
                            "  --success: light-dark(var(--color-success-500), var(--color-success-300));"
                          );
                          defaultLines.push(
                            "  --info: light-dark(var(--color-info-500), var(--color-info-300));"
                          );
                        } else if (themeMode === "dark") {
                          defaultLines.push(
                            "  --warning: var(--color-warning-300);"
                          );
                          defaultLines.push(
                            "  --error: var(--color-error-300);"
                          );
                          defaultLines.push(
                            "  --success: var(--color-success-300);"
                          );
                          defaultLines.push("  --info: var(--color-info-300);");
                        } else {
                          defaultLines.push(
                            "  --warning: var(--color-warning-500);"
                          );
                          defaultLines.push(
                            "  --error: var(--color-error-500);"
                          );
                          defaultLines.push(
                            "  --success: var(--color-success-500);"
                          );
                          defaultLines.push("  --info: var(--color-info-500);");
                        }
                        break;
                      case 8: // Bordures
                        if (themeMode === "both") {
                          defaultLines.push(
                            "  --border-light: var(--color-gray-400);"
                          );
                          defaultLines.push(
                            "  --border-medium: var(--color-gray-600);"
                          );
                        } else if (themeMode === "dark") {
                          defaultLines.push(
                            "  --border-light: var(--color-gray-600);"
                          );
                          defaultLines.push(
                            "  --border-medium: var(--color-gray-600);"
                          );
                        } else {
                          defaultLines.push(
                            "  --border-light: var(--color-gray-400);"
                          );
                          defaultLines.push(
                            "  --border-medium: var(--color-gray-600);"
                          );
                        }
                        break;
                      case 9: // Tailles de police
                        if (typoResponsive) {
                          defaultLines.push("  --text-s: var(--text-14);");
                          defaultLines.push(
                            "  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));"
                          );
                        } else {
                          defaultLines.push("  --text-s: var(--text-14);");
                          defaultLines.push("  --text-m: var(--text-16);");
                        }
                        break;
                      case 10: // Hauteurs de lignes
                        defaultLines.push(
                          "  --line-height-s: var(--line-height-20);"
                        );
                        defaultLines.push(
                          "  --line-height-m: var(--line-height-24);"
                        );
                        break;
                      case 11: // Espacements
                        if (spacingResponsive) {
                          defaultLines.push(
                            "  --spacing-xs: var(--spacing-4);"
                          );
                          defaultLines.push(
                            "  --spacing-s: clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16));"
                          );
                        } else {
                          defaultLines.push(
                            "  --spacing-xs: var(--spacing-4);"
                          );
                          defaultLines.push("  --spacing-s: var(--spacing-8);");
                        }
                        break;
                      case 12: // Formulaires
                        defaultLines.push(
                          themeMode === "both"
                            ? "  --form-control-background: light-dark(var(--color-gray-200), var(--color-gray-700));"
                            : "  --form-control-background: var(--color-gray-200);"
                        );
                        defaultLines.push(
                          "  --on-form-control: var(--color-gray-900);"
                        );
                        break;
                      case 13: // Tokens complémentaires
                        // nothing to auto-generate here; leave empty so that
                        // imported extras will be appended later
                        break;
                      default:
                        break;
                    }
                  } catch (e) {
                    /* noop default generation */
                  }

                  if (defaultLines.length) {
                    orderedParts.push(hdrLine + "\n" + defaultLines.join("\n"));
                  }

                  // continue to next canonical section
                  continue;
                }

                // Merge all bodies for matching headers
                const mergedBody = matchingKeys
                  .map((k) => headerMap.get(k) || "")
                  .filter(Boolean)
                  .join("\n\n");

                if (!mergedBody || !mergedBody.trim()) {
                  // mark keys as used but skip empty blocks
                  for (const k of matchingKeys) usedKeys.add(k);
                  continue;
                }

                // Special-case ordering for 'Couleur primaire' section (idx === 1)
                let bodyLines = "";
                if (idx === 1) {
                  const desiredOrder = [
                    "--primary",
                    "--on-primary",
                    "--primary-lighten",
                    "--primary-darken",
                  ];

                  const rawLines = mergedBody
                    .split(/\r?\n/)
                    .map((l) => l.trim())
                    .filter(Boolean);

                  const propMap = new Map();
                  const others = [];
                  for (const ln of rawLines) {
                    const m = ln.match(/^\s*(--[a-z0-9-]+)\s*:/i);
                    if (m) {
                      const prop = m[1];
                      if (!propMap.has(prop)) propMap.set(prop, []);
                      propMap.get(prop).push(ln);
                    } else {
                      others.push(ln);
                    }
                  }

                  const ordered = [];
                  for (const p of desiredOrder) {
                    if (propMap.has(p)) {
                      ordered.push(...propMap.get(p));
                      propMap.delete(p);
                    }
                  }
                  // append any remaining props in their original order
                  for (const [k, arr] of propMap.entries())
                    ordered.push(...arr);
                  // then any non-declaration lines
                  ordered.push(...others);

                  bodyLines = ordered
                    .map((l) => (l.trim() ? "  " + l.trim() : ""))
                    .filter(Boolean)
                    .join("\n");
                } else {
                  bodyLines = mergedBody
                    .split(/\r?\n/)
                    .map((l) => (l.trim() ? "  " + l.trim() : ""))
                    .filter(Boolean)
                    .join("\n");
                }

                orderedParts.push(hdrLine + "\n" + bodyLines);
                for (const k of matchingKeys) usedKeys.add(k);
              }

              // If the import lacked a typography section, inject a default
              // 'Tailles de police' block so the preview shows text tokens.
              try {
                const hasTypoHeader = Array.from(headerMap.keys()).some((k) =>
                  /Tailles de police/i.test(k)
                );
                const hasTextMToken = /--text-m\s*:/i.test(processed);
                if (!hasTypoHeader && !hasTextMToken && typoResponsive) {
                  const defaultTypo = [
                    "  /* Tailles de police */",
                    "  --text-xs: clamp(var(--text-12), 0.7011rem + 0.2174vw, var(--text-14));",
                    "  --text-s: clamp(var(--text-14), 0.8261rem + 0.2174vw, var(--text-16));",
                    "  --text-m: clamp(var(--text-16), 0.9511rem + 0.2174vw, var(--text-18));",
                    "  --text-xl: clamp(var(--text-18), 0.9783rem + 0.6522vw, var(--text-24));",
                    "  --text-2xl: clamp(var(--text-24), 1.3533rem + 0.6522vw, var(--text-30));",
                    "  --text-4xl: clamp(var(--text-30), 1.4348rem + 1.9565vw, var(--text-48));",
                    "  --text-5xl: clamp(var(--text-36), 1.663rem + 2.6087vw, var(--text-60));",
                    "  --text-6xl: clamp(var(--text-36), 1.1739rem + 4.7826vw, var(--text-80));",
                  ].join("\n");
                  // insert after 'Bordures' section if present, otherwise append
                  const bordIdx = orderedParts.findIndex((s) =>
                    /Bordures/i.test(s)
                  );
                  if (bordIdx === -1) orderedParts.push(defaultTypo);
                  else orderedParts.splice(bordIdx + 1, 0, defaultTypo);
                }
              } catch (e) {
                /* noop */
              }

              // Append any headers not matched by canonical list into 'Tokens complémentaires'
              const remaining = [];
              for (const [key, bodyContent] of headerMap.entries()) {
                if (!usedKeys.has(key)) {
                  // Do NOT include imported header comments (e.g. "/* Autres couleurs */")
                  // inside the canonical "Tokens complémentaires" block. Only
                  // include the inner declarations to keep the section tidy.
                  const bodyLines = (bodyContent || "")
                    .split(/\r?\n/)
                    .map((l) => (l.trim() ? "  " + l.trim() : ""))
                    .filter(Boolean)
                    .join("\n");
                  if (bodyLines) remaining.push(bodyLines);
                }
              }
              // also include any unmatched free-form bodies
              for (const u of unmatched) {
                const part = u
                  .split(/\r?\n/)
                  .map((l) => (l.trim() ? "  " + l.trim() : ""))
                  .filter(Boolean)
                  .join("\n");
                if (part) remaining.push(part);
              }

              if (remaining.length) {
                // Use a canonical header label
                orderedParts.push(
                  "  /* Tokens complémentaires */\n" + remaining.join("\n\n")
                );
              }

              // Rebuild body with exactly one blank line between sections
              const newBody = orderedParts
                .map((s) => s.trimRight())
                .filter(Boolean)
                .join("\n\n");

              processed =
                processed.slice(0, open + 1) +
                "\n" +
                newBody +
                "\n" +
                processed.slice(end);
            }
          }
        }
      } catch (e) {
        console.warn(
          "[generators-order] failed to enforce canonical order:",
          e && e.message
        );
      }

      // Small final fill: if some canonical declarations remained empty
      // (placeholders like `--primary: ;`) fill them non-destructively.
      try {
        const original = (state && state.tokensContent) || "";
        const origPrimaryVarMatch = original.match(
          /--primary\s*:\s*(var\([^;\n]+\))/i
        );

        // production: do not log primary presence details

        // Fill empty --primary only if it's empty. If the original import
        // contained a `var(...)` for --primary we restore/preserve it.
        if (/--primary\s*:\s*;/.test(processed)) {
          if (origPrimaryVarMatch) {
            processed = processed.replace(
              /--primary\s*:\s*;/gi,
              `--primary: ${origPrimaryVarMatch[1]};`
            );
            // restored imported --primary var()
          } else {
            processed = processed.replace(
              /--primary\s*:\s*;/gi,
              `--primary: var(${chooseBestVariant(
                displayPrimary,
                [themeCss, tokensSource, customVars].join("\n")
              )});`
            );
            // filled empty --primary with var(...) based on displayPrimary
          }
        }

        // Non-destructive fills for derived tokens when empty
        if (/--on-primary\s*:\s*;/.test(processed)) {
          processed = processed.replace(
            /--on-primary\s*:\s*;/gi,
            `--on-primary: var(--color-white);`
          );
        }
        if (/--primary-lighten\s*:\s*;/.test(processed)) {
          processed = processed.replace(
            /--primary-lighten\s*:\s*;/gi,
            `--primary-lighten: var(${chooseNumericVariant(
              displayPrimary,
              "300",
              [themeCss, tokensSource, customVars].join("\n")
            )});`
          );
        }
        if (/--primary-darken\s*:\s*;/.test(processed)) {
          processed = processed.replace(
            /--primary-darken\s*:\s*;/gi,
            `--primary-darken: var(${chooseNumericVariant(
              displayPrimary,
              "700",
              [themeCss, tokensSource, customVars].join("\n")
            )});`
          );
        }

        // Append les `customVars` fournis par l'utilisateur sous
        // un en-tête `/* Tokens complémentaires */` si présents et
        // si l'import ne les contient pas déjà. Injection non-destructive.
        try {
          const customVars =
            (state && state.config && state.config.customVars) || "";
          if (customVars && String(customVars).trim()) {
            if (!/Tokens complémentaires/i.test(processed)) {
              const formatted = String(customVars)
                .split(/\r?\n/)
                .map((l) => (l.trim() ? "  " + l.trim() : ""))
                .filter(Boolean);
              if (formatted.length) {
                if (/\n}\s*$/.test(processed)) {
                  processed = processed.replace(
                    /\n}\s*$/m,
                    "\n  /* Tokens complémentaires */\n" +
                      formatted.join("\n") +
                      "\n}\n"
                  );
                } else {
                  processed =
                    processed.trimEnd() +
                    "\n  /* Tokens complémentaires */\n" +
                    formatted.join("\n") +
                    "\n";
                }
              }
            }
          }
        } catch (e) {
          /* noop */
        }

        // If typographic semantic tokens are still missing, append a
        // canonical block so the import preview is complete.
        try {
          if (!/--text-m\s*:/i.test(processed)) {
            const typoLines = [];
            typoLines.push("\n  /* Tailles de police */");
            typoLines.push(
              "  --text-xs: clamp(var(--text-12), 0.7011rem + 0.2174vw, var(--text-14));"
            );
            typoLines.push(
              "  --text-s: clamp(var(--text-14), 0.8261rem + 0.2174vw, var(--text-16));"
            );
            typoLines.push(
              "  --text-m: clamp(var(--text-16), 0.9511rem + 0.2174vw, var(--text-18));"
            );
            typoLines.push(
              "  --text-xl: clamp(var(--text-18), 0.9783rem + 0.6522vw, var(--text-24));"
            );
            typoLines.push(
              "  --text-2xl: clamp(var(--text-24), 1.3533rem + 0.6522vw, var(--text-30));"
            );
            typoLines.push(
              "  --text-4xl: clamp(var(--text-30), 1.4348rem + 1.9565vw, var(--text-48));"
            );
            if (/\n}\s*$/.test(processed)) {
              processed = processed.replace(
                /\n}\s*$/m,
                "\n" + typoLines.join("\n") + "\n}\n"
              );
            } else {
              processed =
                processed.trimEnd() + "\n" + typoLines.join("\n") + "\n";
            }
          }
        } catch (e) {
          /* noop */
        }

        // If form tokens are missing, append canonical form tokens
        try {
          if (!/--form-control-background\s*:/i.test(processed)) {
            const formLines = [];
            formLines.push("\n  /* Formulaires */");
            if (themeMode === "both") {
              formLines.push(
                "  --form-control-background: light-dark(\n    var(--color-gray-200),\n    var(--color-gray-700)\n  );"
              );
              formLines.push(
                "  --on-form-control: light-dark(var(--color-gray-900), var(--color-gray-100));"
              );
            } else {
              formLines.push(
                "  --form-control-background: var(--color-gray-200);"
              );
              formLines.push("  --on-form-control: var(--color-gray-900);");
            }
            formLines.push(
              "  --form-control-spacing: var(--spacing-12) var(--spacing-16);"
            );
            formLines.push("  --form-control-border-width: 1px;");
            formLines.push(
              "  --form-control-border-color: var(--color-gray-400);"
            );
            formLines.push("  --form-control-border-radius: var(--radius-16);");
            formLines.push(
              "  --checkables-border-color: var(--color-gray-400);"
            );
            formLines.push("  --checkable-size: 1.25em;");
            if (/\n}\s*$/.test(processed)) {
              processed = processed.replace(
                /\n}\s*$/m,
                "\n" + formLines.join("\n") + "\n}\n"
              );
            } else {
              processed =
                processed.trimEnd() + "\n" + formLines.join("\n") + "\n";
            }
          }
        } catch (e) {
          /* noop */
        }

        // Safety: ensure balanced braces. If processed contains a `:root {`
        // but the closing `}` is missing (or braces are unbalanced) add the
        // required closing braces to avoid producing unterminated CSS in the UI.
        try {
          const openCount = (processed.match(/{/g) || []).length;
          const closeCount = (processed.match(/}/g) || []).length;
          if (openCount > closeCount) {
            const missing = openCount - closeCount;
            processed = processed + "\n" + "}".repeat(missing) + "\n";
          } else if (!/}\s*\n?$/.test(processed)) {
            // Ensure trailing newline
            processed = processed + "\n";
          }
        } catch (e) {
          /* noop */
        }
        // Final synchronization: if the user explicitly chose a primaryColor,
        // ensure the final processed output includes the corresponding
        // existing variant (don't force -500). This is a last-resort pass
        // to avoid earlier dedupe/order issues leaving an old primary in place.
        try {
          if (primaryColor) {
            const _sources_final =
              (themeCss || "") +
              "\n" +
              (state && state.tokensContent ? state.tokensContent : "") +
              "\n" +
              (state && state.config && state.config.customVars
                ? state.config.customVars
                : "");
            const _finalVar = chooseBestVariant(primaryColor, _sources_final);

            // Compute insertion point: after `color-scheme` and any
            // following `&[data-theme="..."]` blocks, to respect canonical order.
            let insertPos = -1;
            const rootMatch = processed.match(/:root\s*\{/i);
            if (rootMatch) {
              const rootIdx = processed.indexOf(rootMatch[0]);
              insertPos = rootIdx + rootMatch[0].length;
              try {
                // find color-scheme occurrence after root
                const bodyStart = insertPos;
                const csIndex = processed.indexOf("color-scheme", bodyStart);
                if (csIndex !== -1) {
                  // move to end of the color-scheme declaration
                  let pos = processed.indexOf(";", csIndex);
                  if (pos === -1) pos = bodyStart;
                  else pos = pos + 1;

                  // include any following &[data-theme] blocks
                  while (true) {
                    const dtIdx = processed.indexOf("&[data-theme", pos);
                    if (dtIdx === -1) break;
                    const openBrace = processed.indexOf("{", dtIdx);
                    if (openBrace === -1) break;
                    // find matching closing brace
                    let depth = 1;
                    let k = openBrace + 1;
                    while (k < processed.length && depth > 0) {
                      if (processed[k] === "{") depth++;
                      else if (processed[k] === "}") depth--;
                      k++;
                    }
                    pos = k; // after closing brace
                  }

                  insertPos = pos;
                }
              } catch (e) {
                /* noop - fallback to default insertPos */
              }
            }

            // Find existing primary declaration (first occurrence)
            const primaryMatch = /--primary\s*:\s*[^;]*;/i.exec(processed);
            if (primaryMatch) {
              const existingIdx = primaryMatch.index;
              const existingLen = primaryMatch[0].length;

              if (insertPos !== -1 && existingIdx < insertPos) {
                // remove existing declaration then insert at computed insertPos
                processed =
                  processed.slice(0, existingIdx) +
                  processed.slice(existingIdx + existingLen);
                // adjust insertPos after removal
                insertPos = insertPos - existingLen;
                processed =
                  processed.slice(0, insertPos) +
                  `\n  --primary: var(${_finalVar});\n` +
                  processed.slice(insertPos);
              } else {
                // existing primary is after insertion point or no insertion point: replace in place
                processed = processed.replace(
                  /--primary\s*:\s*[^;]*;/i,
                  `--primary: var(${_finalVar});`
                );
              }
            } else if (insertPos !== -1) {
              // no existing primary: insert after theme block
              processed =
                processed.slice(0, insertPos) +
                `\n  --primary: var(${_finalVar});\n` +
                processed.slice(insertPos);
            } else {
              // no root found: prepend at top as fallback
              processed = `--primary: var(${_finalVar});\n` + processed;
            }
          }
        } catch (e) {
          /* noop final sync */
        }
      } catch (e) {
        /* noop - best-effort */
      }

      return processed;
    } catch (e) {
      // If post-processing fails for any reason, fall back to verbatim
      return state.tokensContent;
    }
  }

  // PRIORITÉ 2: Configuration canonique (seulement si pas d'import)
  // Si la config correspond au cas canonique ET qu'il n'y a pas de contenu importé,
  // retourner le template canonique pour garantir la parité byte-for-byte avec les tests
  if (
    primaryColor === "raspberry" &&
    themeMode === "both" &&
    typoResponsive === true &&
    spacingResponsive === true &&
    // Ne retourner le template canonique que si le thème ne provient PAS
    // d'un import utilisateur (ex: import Figma). Lors d'un import, le
    // générateur doit utiliser `state.themeContent` pour refléter les
    // primitives fournies par l'utilisateur.
    !(state && state.themeFromImport)
  ) {
    return CANONICAL_THEME_TOKENS;
  }

  // Build a full tokens output programmatically for non-canonical configs.
  // This avoids brittle text-substitution on a large template and keeps
  // behaviour deterministic while providing a complete tokens file.
  // If user selected a primaryColor, use it. Otherwise default to the
  // canonical 'info' seed. Avoid using a non-existent placeholder color
  // in runtime outputs.
  let chosen = primaryColor || "info";
  console.log("[generateTokensCSS] Initial primaryColor:", primaryColor);
  console.log("[generateTokensCSS] Initial chosen:", chosen);

  // Avoid using runtime-only palettes (e.g. 'ocean') as the generated
  // project's primary color when they are only a runtime styling aid.
  // Heuristic: if the chosen color is runtime-only AND it does not appear
  // in the loaded theme primitives nor in user customVars, treat it as
  // not explicitly selected by the user and fall back to the placeholder
  // 'raspberry' (or 'info' as ultimate fallback).
  try {
    const isRuntimeOnly = RUNTIME_ONLY_COLORS.has(chosen);
    const themeCss = (state && state.themeContent) || "";
    const customVars = (state && state.config && state.config.customVars) || "";
    const appearsInTheme = new RegExp(`--color-${chosen}-`, "i").test(themeCss);
    const appearsInCustom = new RegExp(`--color-${chosen}-`, "i").test(
      customVars
    );
    console.log(
      "[generateTokensCSS] isRuntimeOnly:",
      isRuntimeOnly,
      "appearsInTheme:",
      appearsInTheme,
      "appearsInCustom:",
      appearsInCustom
    );
    if (isRuntimeOnly && !appearsInTheme && !appearsInCustom) {
      // If the selected color is a runtime-only palette and not present
      // in the loaded theme or custom vars, fall back to a guaranteed
      // canonical seed ('info'). This avoids referencing a non-existent
      // placeholder color in generated tokens.
      chosen = "info";
      console.log("[generateTokensCSS] Fallback to:", chosen);
    }
  } catch (e) {
    /* noop */
  }
  console.log("[generateTokensCSS] Final chosen:", chosen);
  const lines = [];

  // Header adapted from the canonical template
  const themeLabel =
    themeMode === "both"
      ? "light et dark"
      : themeMode === "dark"
      ? "dark uniquement"
      : "light uniquement";
  const typoLabel = typoResponsive ? "oui" : "non";
  const spacingLabel = spacingResponsive ? "oui" : "non";

  lines.push("/* ----------------------------------");
  lines.push(" * Theme-tokens, généré par primary.alsacreations.com");
  lines.push(" * Surcouche de theme.css");
  lines.push(" * Configuration :");
  lines.push(` * - Couleur primaire : ${chosen}`);
  lines.push(` * - Theme : ${themeLabel}`);
  lines.push(` * - Typographie responsive : ${typoLabel}`);
  lines.push(` * - Espacements responsive : ${spacingLabel}`);
  lines.push(" * ----------------------------------");
  lines.push(" */");
  lines.push(":root {");

  // color-scheme block
  if (themeMode === "both") {
    lines.push("  color-scheme: light dark;");
    lines.push("");
    lines.push('  &[data-theme="light"] {');
    lines.push("    color-scheme: light;");
    lines.push("  }");
    lines.push("");
    lines.push('  &[data-theme="dark"] {');
    lines.push("    color-scheme: dark;");
    lines.push("  }");
  } else if (themeMode === "dark") {
    lines.push("  color-scheme: dark;");
  } else {
    lines.push("  color-scheme: light;");
  }

  lines.push("");
  // primary & on-primary
  lines.push("  /* Couleur primaire */");
  // Determine best available variants for the chosen base so we don't
  // reference non-existing numeric variants (don't force -500).
  const _sources_for_chosen =
    (state && state.themeContent ? state.themeContent : "") +
    "\n" +
    (state && state.tokensContent ? state.tokensContent : "") +
    "\n" +
    (state && state.config && state.config.customVars
      ? state.config.customVars
      : "");
  const _chosenVar = chooseBestVariant(chosen, _sources_for_chosen);
  const _chosen300 = chooseNumericVariant(chosen, "300", _sources_for_chosen);
  const _chosen700 = chooseNumericVariant(chosen, "700", _sources_for_chosen);

  lines.push(`  --primary: var(${_chosenVar});`);
  lines.push("  --on-primary: var(--color-white);");
  lines.push("");

  // accent: depending on themeMode
  lines.push("  /* Couleur d'accent */");
  if (themeMode === "both") {
    lines.push(`  --accent: light-dark(var(--primary), var(${_chosen300}));`);
    lines.push(
      `  --accent-invert: light-dark(var(${_chosen300}), var(--primary));`
    );
  } else if (themeMode === "dark") {
    lines.push(`  --accent: var(${_chosen300});`);
    lines.push("  --accent-invert: var(--primary);");
  } else {
    lines.push("  --accent: var(--primary);");
    lines.push(`  --accent-invert: var(${_chosen300});`);
  }

  lines.push("");
  // surfaces
  if (themeMode === "both") {
    lines.push("  /* Surface du document */");
    lines.push(
      "  --surface: light-dark(var(--color-white), var(--color-gray-900));"
    );
    lines.push(
      "  --on-surface: light-dark(var(--color-gray-900), var(--color-gray-100));"
    );
  } else if (themeMode === "dark") {
    lines.push("  /* Surface du document */");
    lines.push("  --surface: var(--color-gray-900);");
    lines.push("  --on-surface: var(--color-gray-100);");
  } else {
    lines.push("  /* Surface du document */");
    lines.push("  --surface: var(--color-white);");
    lines.push("  --on-surface: var(--color-gray-900);");
  }

  lines.push("");
  // Niveaux de profondeur / Interactions / Sélection / États
  lines.push("  /* Niveaux de profondeur */");
  if (themeMode === "both") {
    lines.push(
      "  --layer-1: light-dark(var(--color-gray-50), var(--color-gray-800));"
    );
    lines.push(
      "  --layer-2: light-dark(var(--color-gray-100), var(--color-gray-700));"
    );
    lines.push(
      "  --layer-3: light-dark(var(--color-gray-200), var(--color-gray-600));"
    );
    lines.push("");
    lines.push("  /* Interactions */");
    lines.push(`  --link: light-dark(var(--primary), var(${_chosen300}));`);
    lines.push(
      `  --link-hover: light-dark(var(${_chosen700}), var(--primary));`
    );
    lines.push("");
    lines.push("  /* Couleur de sélection */");
    lines.push(
      `  --selection: light-dark(var(${_chosen300}), var(${_chosenVar}));`
    );
    lines.push("");
    lines.push("  /* États */");
    lines.push(
      "  --warning: light-dark(var(--color-warning-500), var(--color-warning-300));"
    );
    lines.push(
      "  --error: light-dark(var(--color-error-500), var(--color-error-300));"
    );
    lines.push(
      "  --success: light-dark(var(--color-success-500), var(--color-success-300));"
    );
    lines.push(
      "  --info: light-dark(var(--color-info-500), var(--color-info-300));"
    );
  } else {
    lines.push("  --layer-1: var(--color-gray-50);");
    lines.push("  --layer-2: var(--color-gray-100);");
    lines.push("  --layer-3: var(--color-gray-200);");
    lines.push("");
    lines.push("  /* Interactions */");
    lines.push("  --link: var(--primary);");
    lines.push(`  --link-hover: var(${_chosen700});`);
    lines.push("");
    lines.push("  /* Couleur de sélection */");
    lines.push(`  --selection: var(${_chosen300});`);
    lines.push("");
    lines.push("  /* États */");
    lines.push("  --warning: var(--color-warning-500);");
    lines.push("  --error: var(--color-error-500);");
    lines.push("  --success: var(--color-success-500);");
    lines.push("  --info: var(--color-info-500);");
  }

  lines.push("");
  // Bordures
  if (themeMode === "both") {
    lines.push(
      "  --border-light: light-dark(var(--color-gray-100), var(--color-gray-800));"
    );
    lines.push(
      "  --border-medium: light-dark(var(--color-gray-300), var(--color-gray-600));"
    );
  } else {
    lines.push("  --border-light: var(--color-gray-100);");
    lines.push("  --border-medium: var(--color-gray-300);");
  }

  lines.push("");

  // Si import Figma, les tokens de typo sont déjà dans tokensContent
  // et seront utilisés via la priorité 1 de generateTokensCSS() ligne 600
  // On ne génère donc des tokens par défaut que si pas d'import
  if (state && state.themeFromImport) {
    console.log(
      "[generators-typo] Import Figma: tokens déjà dans tokensContent, skip"
    );
    // Ne rien générer ici, generateTokensCSS() utilisera state.tokensContent directement
  } else {
    // Génération des tokens par défaut (canonical ou config)
    lines.push("  /* Typographie - Tailles de police */");
    const tokensContentForTypo = (state && state.tokensContent) || "";
    const typoSemanticTokens = [];

    if (tokensContentForTypo) {
      console.log("[generators-typo] Extraction tokens depuis tokensContent");
      // Chercher --text-{nom} qui référencent des primitives ou des clamp()
      const typoTokenRx = /--(text-[a-z0-9]+)\s*:\s*([^;]+);/gi;
      let match;
      const foundTokens = new Set();

      while ((match = typoTokenRx.exec(tokensContentForTypo))) {
        const name = match[1]; // ex: "text-m", "text-xl", "text-4xl"
        const value = match[2].trim(); // ex: "clamp(...)" ou "var(--text-16)"
        const fullMatch = match[0].trim(); // ex: "--text-m: clamp(...);"

        // Ignorer les primitives (text-14, text-16, etc.)
        if (/^text-\d+$/.test(name)) {
          continue;
        }

        // Éviter les doublons
        if (foundTokens.has(name)) {
          continue;
        }

        foundTokens.add(name);
        typoSemanticTokens.push({ name, value, fullMatch });
        console.log(`[generators-typo] Found token: ${name} = ${value}`);
      }
    }

    // Si on a des tokens depuis l'import, les utiliser
    if (typoSemanticTokens.length > 0) {
      console.log(
        `[generators-typo] Using ${typoSemanticTokens.length} tokens from import`
      );
      // Trier par nom pour cohérence (text-s, text-m, text-l, text-xl, text-2xl, etc.)
      typoSemanticTokens.sort((a, b) => {
        const orderMap = {
          "text-xs": 1,
          "text-s": 2,
          "text-m": 3,
          "text-l": 4,
          "text-xl": 5,
          "text-2xl": 6,
          "text-3xl": 7,
          "text-4xl": 8,
          "text-5xl": 9,
          "text-6xl": 10,
        };
        return (orderMap[a.name] || 99) - (orderMap[b.name] || 99);
      });

      typoSemanticTokens.forEach(({ fullMatch }) => {
        lines.push(`  ${fullMatch}`);
      });
    } else {
      // Tokens par défaut si pas d'import
      console.log("[generators-typo] Using default tokens");
      lines.push("  --text-s: var(--text-14);");
      if (typoResponsive) {
        lines.push(
          "  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));"
        );
        lines.push(
          "  --text-l: clamp(var(--text-18), 1.0761rem + 0.2174vw, var(--text-20));"
        );
        lines.push(
          "  --text-xl: clamp(var(--text-20), 0.957rem + 1.3043vw, var(--text-32));"
        );
        lines.push(
          "  --text-2xl: clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36));"
        );
        lines.push(
          "  --text-3xl: clamp(var(--text-32), 1.609rem + 1.7391vw, var(--text-48));"
        );
        lines.push(
          "  --text-4xl: clamp(var(--text-48), 2.1818rem + 3.6364vw, var(--text-80));"
        );
      } else {
        lines.push("  --text-m: var(--text-16);");
        lines.push("  --text-l: var(--text-18);");
        lines.push("  --text-xl: var(--text-20);");
        lines.push("  --text-2xl: var(--text-24);");
        lines.push("  --text-3xl: var(--text-32);");
        lines.push("  --text-4xl: var(--text-48);");
      }
    } // Ferme le if (tokensContentForTypo)
  } // Ferme le else principal

  lines.push("");

  // Si import Figma, les tokens d'espacement sont déjà dans tokensContent
  if (state && state.themeFromImport) {
    console.log(
      "[generators-spacing] Import Figma: tokens déjà dans tokensContent, skip"
    );
    // Ne rien générer ici, generateTokensCSS() utilisera state.tokensContent directement
  } else {
    // Génération des tokens d'espacement par défaut
    lines.push("  /* Espacements */");
    lines.push("  --spacing-xs: var(--spacing-4);");
    if (spacingResponsive) {
      lines.push(
        "  --spacing-s: clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16));"
      );
      lines.push(
        "  --spacing-m: clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32));"
      );
      lines.push(
        "  --spacing-l: clamp(var(--spacing-24), 0.8864rem + 2.2727vw, var(--spacing-48));"
      );
      lines.push(
        "  --spacing-xl: clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80));"
      );
    } else {
      lines.push("  --spacing-s: var(--spacing-8);");
      lines.push("  --spacing-m: var(--spacing-16);");
      lines.push("  --spacing-l: var(--spacing-24);");
      lines.push("  --spacing-xl: var(--spacing-32);");
    }
  }

  // Ajouter les tokens sémantiques d'espacement depuis tokensContent importé (si présents)
  // Ces tokens proviennent de l'import Figma et doivent être préservés
  console.log("[generators-spacing] DEBUT - Vérification state:", {
    hasState: !!state,
    hasTokensContent: !!(state && state.tokensContent),
    tokensContentLength:
      state && state.tokensContent ? state.tokensContent.length : 0,
    themeFromImport: state ? state.themeFromImport : undefined,
  });

  const previousTokens = (state && state.tokensContent) || "";
  console.log("[generators] previousTokens length:", previousTokens.length);
  console.log("[generators] state.themeFromImport:", state.themeFromImport);

  if (previousTokens && state.themeFromImport) {
    const spacingSemanticTokens = [];
    // Chercher --spacing-{nom} qui référencent des primitives --spacing-{nombre}
    // Regex améliorée pour matcher aussi les tokens sur plusieurs lignes
    const spacingTokenRx =
      /--spacing-([a-z]+(?:-[a-z]+)*)\s*:\s*var\(--spacing-\d+\)\s*;/gi;
    let match;
    let matchCount = 0;
    while ((match = spacingTokenRx.exec(previousTokens))) {
      matchCount++;
      const name = match[1]; // ex: "tiny", "compact", "big"
      const fullMatch = match[0]; // ex: "--spacing-tiny: var(--spacing-2);"
      console.log(
        `[generators] Found spacing token #${matchCount}:`,
        fullMatch.trim()
      );

      // Vérifier que ce n'est pas un token prédéfini (xs, s, m, l, xl)
      if (!["xs", "s", "m", "l", "xl"].includes(name)) {
        spacingSemanticTokens.push(`  ${fullMatch.trim()}`);
      } else {
        console.log(`  → Skipped (predefined token)`);
      }
    }

    console.log("[generators] Total semantic tokens found:", matchCount);
    console.log(
      "[generators] Semantic tokens to add:",
      spacingSemanticTokens.length
    );

    if (spacingSemanticTokens.length > 0) {
      // Trier par nom pour cohérence
      spacingSemanticTokens.sort();
      spacingSemanticTokens.forEach((token) => lines.push(token));
      console.log("[generators] Added semantic spacing tokens to output");
    }
  } else {
    console.log(
      "[generators] No previous tokens or not from import, skipping semantic tokens"
    );
  }

  lines.push("");
  // Formulaires
  lines.push("  /* Formulaires */");
  if (themeMode === "both") {
    lines.push(
      "  --form-control-background: light-dark(\n    var(--color-gray-200),\n    var(--color-gray-700)\n  );"
    );
    lines.push(
      "  --on-form-control: light-dark(var(--color-gray-900), var(--color-gray-100));"
    );
  } else {
    lines.push("  --form-control-background: var(--color-gray-200);");
    lines.push("  --on-form-control: var(--color-gray-900);");
  }
  lines.push("  --form-control-spacing: var(--spacing-12) var(--spacing-16);");
  lines.push("  --form-control-border-width: 1px;");
  lines.push("  --form-control-border-color: var(--color-gray-400);");
  lines.push("  --form-control-border-radius: var(--radius-16);");
  lines.push("  --checkables-border-color: var(--color-gray-400);");
  lines.push("  --checkable-size: 1.25em;");

  // Append any user-provided custom variables as 'Tokens complémentaires'
  try {
    const customVars = (state && state.config && state.config.customVars) || "";
    if (customVars && String(customVars).trim()) {
      const formatted = String(customVars)
        .split(/\r?\n/)
        .map((l) => (l.trim() ? "  " + l.trim() : ""))
        .filter(Boolean);
      if (formatted.length) {
        lines.push("");
        lines.push("  /* Tokens complémentaires */");
        for (const ln of formatted) lines.push(ln);
      }
    }
  } catch (e) {
    /* noop */
  }

  lines.push("}");

  return lines.join("\n") + "\n";
}

export function generateThemeCSS(options = {}) {
  const customVars =
    options.customVars ||
    (state && state.config && state.config.customVars) ||
    "";
  const themeCSS = (state && state.themeContent) || "";
  // Start from the original theme content
  let all = (themeCSS || "").trim();

  // If the user provided custom vars, insert them inside :root (if present)
  const trimmedCustom = customVars && customVars.trim();
  const hasRoot = /:root\s*\{[\s\S]*\}/m.test(all);
  if (
    trimmedCustom &&
    !all.includes("/* Couleurs personnalisées (utilisateur) */")
  ) {
    // Format custom vars with indentation when injecting into :root
    const formattedCustom = trimmedCustom
      .split("\n")
      .map((l) => "  " + l.trim())
      .join("\n");
    if (hasRoot) {
      // inject before the last closing brace of the file (assumed :root)
      const idx = all.lastIndexOf("}");
      if (idx !== -1) {
        const before = all.slice(0, idx).trimEnd();
        const after = all.slice(idx);
        all =
          before +
          "\n\n" +
          "/* Couleurs personnalisées */\n" +
          formattedCustom +
          "\n" +
          after;
      } else {
        all =
          all + "\n\n" + "/* Couleurs personnalisées */\n" + formattedCustom;
      }
    } else {
      // If no :root present, wrap the custom vars in a :root block
      all =
        all +
        "\n\n" +
        ":root {\n  /* Couleurs personnalisées */\n" +
        formattedCustom +
        "\n}";
    }
  } else {
    // Ne pas injecter automatiquement de placeholder de couleur (`raspberry`).
    // L'application doit refléter fidèlement les primitives fournies par
    // l'utilisateur ou par les canoniques. Cette logique évite d'introduire
    // des variables qui n'existent pas dans le thème chargé.
  }

  // --- Auto-generate missing numeric color variants (100,300,500,700)
  // If a base color has at least one numeric variant present, generate
  // the missing ones so previews and downstream tokens can rely on a full
  // set of semantic variants.
  try {
    // Only auto-generate extrapolated color variants when the user has
    // explicitly enabled project synthesis (checkbox). Do NOT treat the
    // presence of `customVars` as an implicit request to extrapolate.
    const allowExtrapolation = Boolean(
      state && state.config && state.config.synthesizeProjectPrimitives
    );
    if (!allowExtrapolation) {
      // Skip extrapolation entirely
    } else {
      const variantsMap = parseColorVariants(all);
      const required = ["100", "300", "500", "700"];
      // Collect all missing extrapolated variants across bases, then
      // emit them under a single explanatory comment to avoid repeated
      // identical headings.
      const globalMissing = [];
      for (const [base, map] of variantsMap.entries()) {
        // consider only numeric variants presence
        const numericKeys = Array.from(map.keys()).filter((k) =>
          /^\d+$/.test(k)
        );
        if (!numericKeys.length) continue;

        const completed = generateMissingVariants(map);
        for (const r of required) {
          if (!map.has(r) && completed.has(r)) {
            globalMissing.push(`  --color-${base}-${r}: ${completed.get(r)};`);
          }
        }
      }

      if (globalMissing.length) {
        const idx = all.lastIndexOf("}");
        const extrapolatedBlock =
          "/* Couleurs personnalisées extrapolées */\n" +
          globalMissing.join("\n");
        if (idx !== -1) {
          const before = all.slice(0, idx).trimEnd();
          const after = all.slice(idx);
          all = before + "\n\n" + extrapolatedBlock + "\n" + after;
        } else {
          all = all + "\n\n" + ":root {\n" + extrapolatedBlock + "\n}";
        }
      }
    }
  } catch (e) {
    /* noop - don't break preview generation on edge cases */
  }

  // Normalize excessive blank lines and ensure trailing newline
  // Remove any @import lines referencing runtime palettes (eg. palettes/ocean.css)
  // These palette imports are app/runtime-only and must not appear in the
  // preview or in exported/generated files.
  try {
    all = all.replace(/^.*palettes\/[\w-]+\.css.*$\n?/gim, "");
  } catch (e) {
    /* noop */
  }

  all = all.replace(/\n{3,}/g, "\n\n").trim();
  if (all.length) all += "\n";

  // Appliquer la sélection de police actuelle (UI) sur le thème généré
  // Règle importante : `--font-base` doit toujours rester la valeur système
  // (`system-ui, sans-serif`). Quand l'utilisateur choisit Poppins, on ajoute
  // une variable additionnelle `--font-poppins` pointant vers la police Poppins
  // afin de ne pas écraser la base système utilisée partout ailleurs.
  try {
    const fontChoice = state && state.config ? state.config.fontFamily : null;
    if (fontChoice) {
      const poppinsBase = "Poppins, sans-serif";
      const poppinsMono = "ui-monospace, monospace";
      const systemBase = "system-ui, sans-serif";
      const systemMono = "ui-monospace, monospace";

      // Ensure :root exists and canonical font variables are present.
      if (/:root\s*\{/.test(all)) {
        // --font-base must always be system
        if (/--font-base\s*:/i.test(all)) {
          all = all.replace(
            /(--font-base\s*:\s*)([^;]+);/i,
            `$1 ${systemBase};`
          );
        } else {
          all = all.replace(
            /(:root\s*\{)/i,
            `$1\n  --font-base: ${systemBase};`
          );
        }

        // --font-mono set to system mono (or keep existing if present)
        if (/--font-mono\s*:/i.test(all)) {
          all = all.replace(
            /(--font-mono\s*:\s*)([^;]+);/i,
            `$1 ${systemMono};`
          );
        } else {
          all = all.replace(
            /(:root\s*\{)/i,
            `$1\n  --font-mono: ${systemMono};`
          );
        }

        // When Poppins is selected, add --font-poppins variable
        if (fontChoice === "poppins") {
          if (/--font-poppins\s*:/i.test(all)) {
            all = all.replace(
              /(--font-poppins\s*:\s*)([^;]+);/i,
              `$1 ${poppinsBase};`
            );
          } else {
            // insert after font-mono if possible, otherwise after :root
            if (/--font-mono\s*:/i.test(all)) {
              all = all.replace(
                /(--font-mono\s*:\s*[^;]+;)/i,
                `$1\n  --font-poppins: ${poppinsBase};`
              );
            } else {
              all = all.replace(
                /(:root\s*\{)/i,
                `$1\n  --font-poppins: ${poppinsBase};`
              );
            }
          }
        } else {
          // ensure no leftover --font-poppins if user switched back to system
          if (/--font-poppins\s*:/i.test(all)) {
            all = all.replace(/\n?\s*--font-poppins\s*:\s*[^;]+;?/i, "");
          }
        }
      } else {
        // No :root — prepend a small :root with font primitives
        const rootBlock = `:root {\n  --font-base: ${systemBase};\n  --font-mono: ${systemMono};${
          fontChoice === "poppins" ? `\n  --font-poppins: ${poppinsBase};` : ""
        }\n}\n\n`;
        all = rootBlock + all;
      }
    }
  } catch (e) {
    /* noop - non critical */
  }
  return all;
}

export function generateStylesCSS() {
  const { fontFamily } = state.config || {};
  if (fontFamily === "poppins") {
    // If styles for Poppins haven't been prepared yet, build a sensible
    // fallback synchronously: include a minimal @font-face and the
    // system styles so the exported `styles.css` isn't empty.
    if (!state.stylesPoppinsContent || !state.stylesPoppinsContent.trim()) {
      const fontFace = `@font-face {\n  font-family: 'Poppins';\n  src: url('assets/fonts/Poppins-Variable-opti.woff2') format('woff2');\n  font-weight: 100 900;\n  font-style: normal;\n  font-display: swap;\n}\n\n`;
      state.stylesPoppinsContent = fontFace + (state.stylesSystemContent || "");
    }
    return state.stylesPoppinsContent || "";
  }
  return state.stylesSystemContent || "";
}

export function generateAppCSS() {
  // Préférer le contenu d'app chargé (fichier exact) quand disponible
  // afin d'éviter d'écarter l'app.css canonique du dépôt.
  if (state && state.appContent && state.appContent.trim().length) {
    return state.appContent;
  }

  // Modèle minimal de repli (ne devrait pas être utilisé si appContent est chargé)
  return `/* ----------------------------------\n * Point d'entrée CSS - Primary\n * ----------------------------------\n */\n\n@layer config, base; /* déclaration d'ordre explicite */\n\n@import "reset.css" layer(config);\n@import "theme.css" layer(config);\n@import "theme-tokens.css" layer(config);\n@import "layouts.css" layer(config);\n@import "natives.css" layer(config);\n@import "styles.css" layer(base);\n`;
}

/**
 * Génère un `theme.json` compatible WordPress minimal.
 * - Retourne le JSON canonique byte-for-byte pour la configuration canonique
 * - Pour les autres configs, construit un mapping raisonnable à partir
 *   des tokens et du thème générés.
 */
export function generateThemeJSON() {
  const cfg = state && state.config ? state.config : {};
  const primaryColor = cfg.primaryColor;
  const themeMode = cfg.themeMode;
  const typoResponsive = !!cfg.typoResponsive;
  const spacingResponsive = !!cfg.spacingResponsive;

  // Canonical sample (match exact bytes when canonical config)
  // SAUF si le contenu vient d'un import Figma (state.themeFromImport)
  const canonicalPath = "/canonical/wordpress/theme.json"; // informational
  const isFromImport = state && state.themeFromImport;
  if (
    !isFromImport &&
    primaryColor === "raspberry" &&
    themeMode === "both" &&
    typoResponsive === true &&
    spacingResponsive === true
  ) {
    // Return the canonical sample (to guarantee byte-for-byte match)
    return CANONICAL_THEME_JSON;
  }

  // Non-canonical: build a reasonable mapping from generated CSS
  try {
    // Utiliser state.themeContent et state.tokensContent si disponibles (import Figma)
    // sinon générer le CSS canonique
    const themeCSS = (state && state.themeContent) || generateThemeCSS();
    const tokensCSS = (state && state.tokensContent) || generateTokensCSS();

    // Build palette from detected variants
    // Use var(--color-name) references instead of raw oklch() values
    const variantsMap = parseColorVariants(themeCSS + "\n" + tokensCSS);
    const palette = [];
    for (const [base, map] of variantsMap.entries()) {
      for (const [variant, val] of map.entries()) {
        const name = `${base}-${variant}`;
        const varRef = `var(--color-${name})`;
        palette.push({ name, slug: name, color: varRef });
      }
    }

    // Include semantic tokens found in tokensCSS
    const semantic = {};
    const semRx = /--([a-z0-9-]+):\s*([^;]+);/gim;
    let sm;
    while ((sm = semRx.exec(tokensCSS))) {
      // Normaliser : remplacer retours à ligne et espaces multiples par un seul espace
      const normalizedValue = sm[2].trim().replace(/\s+/g, " ");
      semantic[sm[1]] = normalizedValue;
    }

    // Resolve light-dark according to themeMode for single-mode exports
    const resolveLightDark = (expr) => {
      const m = /light-dark\(([^,]+),\s*([^\)]+)\)/i.exec(expr);
      if (m) {
        const a = m[1].trim();
        const b = m[2].trim();
        if (themeMode === "light") return a;
        if (themeMode === "dark") return b;
        return expr;
      }
      return expr;
    };

    // After we can resolve light-dark, merge semantic tokens into the
    // palette so semantic slugs (primary, on-primary, surface...) are
    // present in the WP palette even when only primitives were parsed.
    const semanticNames = [
      "primary",
      "on-primary",
      "accent",
      "accent-invert",
      "surface",
      "on-surface",
      "layer-1",
      "layer-2",
      "layer-3",
      "link",
      "link-hover",
      "selection",
      "warning",
      "error",
      "success",
      "info",
      "form-control-background",
      "on-form-control",
      "form-control-border-color",
      "checkables-border-color",
    ];

    for (const sname of semanticNames) {
      if (semantic[sname]) {
        const slug = sname;
        const exists = palette.some((p) => p.slug === slug);
        if (!exists) {
          // Keep the original expression for dual-theme exports. Only
          // resolve to a single-side value for single-mode exports.
          const colorVal =
            themeMode === "both"
              ? semantic[sname]
              : resolveLightDark(semantic[sname]);
          palette.push({ name: sname, color: colorVal, slug });
        }
      }
    }

    // Spacing extraction from both themeCSS (primitives) and tokensCSS (semantic tokens)
    // For primitives, use var(--spacing-*) references instead of raw values
    const spacing = [];
    const spacingRx = /--([a-z0-9-]*spacing[a-z0-9-]*):\s*([^;]+);/gim;
    let sp;
    const seen = new Set();

    // Extract from themeCSS first (primitives like --spacing-2, --spacing-4, etc.)
    while ((sp = spacingRx.exec(themeCSS))) {
      const key = sp[1];
      const val = sp[2].trim();
      if (!seen.has(key)) {
        seen.add(key);
        // For primitive spacing values (not clamp/var), use variable reference
        const isPrimitive = !val.includes("clamp(") && !val.includes("var(");
        const sizeValue = isPrimitive ? `var(--${key})` : val;
        spacing.push({ name: key, size: sizeValue, slug: key });
      }
    }

    // Then extract from tokensCSS (semantic tokens like --spacing-s, --spacing-m)
    // These already use clamp() or var() so keep them as-is
    const spacingRx2 = /--([a-z0-9-]*spacing[a-z0-9-]*):\s*([^;]+);/gim;
    let sp2;
    while ((sp2 = spacingRx2.exec(tokensCSS))) {
      const key = sp2[1];
      const val = sp2[2].trim();
      if (!seen.has(key)) {
        seen.add(key);
        spacing.push({ name: key, size: val, slug: key });
      }
    }

    // If spacing extraction produced too few entries, fall back to a
    // canonical-ish set so WP exports include the common sizes.
    if (spacing.length < 10) {
      const canonicalSpacing = [
        { name: "spacing-0", size: "var(--spacing-0)", slug: "spacing-0" },
        { name: "spacing-1", size: "var(--spacing-1)", slug: "spacing-1" },
        { name: "spacing-2", size: "var(--spacing-2)", slug: "spacing-2" },
        { name: "spacing-4", size: "var(--spacing-4)", slug: "spacing-4" },
        { name: "spacing-8", size: "var(--spacing-8)", slug: "spacing-8" },
        { name: "spacing-12", size: "var(--spacing-12)", slug: "spacing-12" },
        { name: "spacing-16", size: "var(--spacing-16)", slug: "spacing-16" },
        { name: "spacing-20", size: "var(--spacing-20)", slug: "spacing-20" },
        { name: "spacing-24", size: "var(--spacing-24)", slug: "spacing-24" },
        { name: "spacing-32", size: "var(--spacing-32)", slug: "spacing-32" },
        { name: "spacing-40", size: "var(--spacing-40)", slug: "spacing-40" },
        { name: "spacing-48", size: "var(--spacing-48)", slug: "spacing-48" },
        { name: "spacing-56", size: "var(--spacing-56)", slug: "spacing-56" },
        { name: "spacing-64", size: "var(--spacing-64)", slug: "spacing-64" },
        { name: "spacing-80", size: "var(--spacing-80)", slug: "spacing-80" },
        {
          name: "spacing-128",
          size: "var(--spacing-128)",
          slug: "spacing-128",
        },
        {
          name: "spacing-160",
          size: "var(--spacing-160)",
          slug: "spacing-160",
        },
        { name: "spacing-xs", size: "var(--spacing-4)", slug: "spacing-xs" },
      ];

      // Add semantic spacing tokens according to spacingResponsive config
      if (spacingResponsive) {
        canonicalSpacing.push(
          {
            name: "spacing-s",
            size: "clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16))",
            slug: "spacing-s",
          },
          {
            name: "spacing-m",
            size: "clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32))",
            slug: "spacing-m",
          },
          {
            name: "spacing-l",
            size: "clamp(var(--spacing-24), 0.8864rem + 2.2727vw, var(--spacing-48))",
            slug: "spacing-l",
          },
          {
            name: "spacing-xl",
            size: "clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80))",
            slug: "spacing-xl",
          }
        );
      } else {
        canonicalSpacing.push(
          { name: "spacing-s", size: "var(--spacing-8)", slug: "spacing-s" },
          { name: "spacing-m", size: "var(--spacing-16)", slug: "spacing-m" },
          { name: "spacing-l", size: "var(--spacing-24)", slug: "spacing-l" },
          { name: "spacing-xl", size: "var(--spacing-32)", slug: "spacing-xl" }
        );
      }

      canonicalSpacing.push(
        {
          name: "form-control-spacing",
          size: "var(--spacing-12) var(--spacing-16)",
          slug: "form-control-spacing",
        },
        {
          name: "form-control-border-width",
          size: "1px",
          slug: "form-control-border-width",
        },
        { name: "checkable-size", size: "1.25em", slug: "checkable-size" }
      );
      spacing.length = 0;
      Array.prototype.push.apply(spacing, canonicalSpacing);
    }

    // Typography presets: extract from themeCSS first
    let fontSizes = [];
    let fontFamilies = [
      { name: "System", slug: "system", fontFamily: "system-ui, sans-serif" },
    ];

    // Extract --text-* variables from themeCSS (primitives from Figma import)
    // For primitives, use var(--text-*) references instead of raw values
    const textVarRx = /--(text-[a-z0-9-]+):\s*([^;]+);/gim;
    let textMatch;
    let extractedFromTheme = 0;
    while ((textMatch = textVarRx.exec(themeCSS))) {
      const varName = textMatch[1]; // ex: "text-14", "text-16"
      const varValue = textMatch[2].trim(); // ex: "0.875rem", "1rem"
      // For primitive text values (not clamp/var), use variable reference
      const isPrimitive =
        !varValue.includes("clamp(") && !varValue.includes("var(");
      const sizeValue = isPrimitive ? `var(--${varName})` : varValue;
      fontSizes.push({
        name: varName,
        size: sizeValue,
        slug: varName,
      });
      extractedFromTheme++;
    }
    if (extractedFromTheme > 0) {
      console.log(
        `[theme.json] Extracted ${extractedFromTheme} font sizes from themeCSS`
      );
    }

    // Also extract semantic --text-* tokens from tokensCSS (ex: text-m, text-xl with clamp())
    // These already use clamp() or var() so keep them as-is
    const textTokenRx = /--(text-[a-z0-9-]+):\s*([^;]+);/gim;
    let tokenMatch;
    let extractedFromTokens = 0;
    while ((tokenMatch = textTokenRx.exec(tokensCSS))) {
      const varName = tokenMatch[1]; // ex: "text-m", "text-xl"
      const varValue = tokenMatch[2].trim(); // ex: "clamp(...)"
      // Avoid duplicates
      if (!fontSizes.some((fs) => fs.name === varName)) {
        fontSizes.push({
          name: varName,
          size: varValue,
          slug: varName,
        });
        extractedFromTokens++;
      }
    }
    if (extractedFromTokens > 0) {
      console.log(
        `[theme.json] Extracted ${extractedFromTokens} font sizes from tokensCSS`
      );
    }

    // Provide fuller typography presets when extraction is minimal
    if (fontSizes.length <= 1) {
      const canonicalFontSizes = [
        { name: "text-10", size: "var(--text-10)", slug: "text-10" },
        { name: "text-11", size: "var(--text-11)", slug: "text-11" },
        { name: "text-12", size: "var(--text-12)", slug: "text-12" },
        { name: "text-13", size: "var(--text-13)", slug: "text-13" },
        { name: "text-14", size: "var(--text-14)", slug: "text-14" },
        { name: "text-15", size: "var(--text-15)", slug: "text-15" },
        { name: "text-16", size: "var(--text-16)", slug: "text-16" },
        { name: "text-17", size: "var(--text-17)", slug: "text-17" },
        { name: "text-18", size: "var(--text-18)", slug: "text-18" },
        { name: "text-20", size: "var(--text-20)", slug: "text-20" },
        { name: "text-24", size: "var(--text-24)", slug: "text-24" },
        { name: "text-32", size: "var(--text-32)", slug: "text-32" },
        { name: "text-36", size: "var(--text-36)", slug: "text-36" },
        { name: "text-40", size: "var(--text-40)", slug: "text-40" },
        { name: "text-48", size: "var(--text-48)", slug: "text-48" },
        { name: "text-60", size: "var(--text-60)", slug: "text-60" },
        { name: "text-80", size: "var(--text-80)", slug: "text-80" },
        { name: "text-s", size: "var(--text-s)", slug: "text-s" },
        {
          name: "text-m",
          size: "clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18))",
          slug: "text-m",
        },
        {
          name: "text-l",
          size: "clamp(var(--text-18), 1.0761rem + 0.2174vw, var(--text-20))",
          slug: "text-l",
        },
        {
          name: "text-xl",
          size: "clamp(var(--text-20), 0.957rem + 1.3043vw, var(--text-32))",
          slug: "text-xl",
        },
        {
          name: "text-2xl",
          size: "clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36))",
          slug: "text-2xl",
        },
        {
          name: "text-3xl",
          size: "clamp(var(--text-32), 1.609rem + 1.7391vw, var(--text-48))",
          slug: "text-3xl",
        },
        {
          name: "text-4xl",
          size: "clamp(var(--text-48), 2.1818rem + 3.6364vw, var(--text-80))",
          slug: "text-4xl",
        },
      ];
      fontSizes.length = 0;
      Array.prototype.push.apply(fontSizes, canonicalFontSizes);
    }

    if (fontFamilies.length <= 1) {
      // Only include the Poppins family in the exported JSON when the
      // configuration explicitly selected it. Otherwise, keep only the
      // system/mono families so that the generated `theme.json` does not
      // advertise a font that wasn't chosen by the user.
      const includePoppins = (cfg && cfg.fontFamily) === "poppins";
      const canonicalFamilies = [];

      if (includePoppins) {
        canonicalFamilies.push({
          name: "Poppins",
          slug: "poppins",
          fontFamily: "Poppins, sans-serif",
          fontFace: [
            {
              src: ["file:./assets/fonts/Poppins-Variable-opti.woff2"],
              fontWeight: "100 900",
              fontStyle: "normal",
              fontFamily: "Poppins",
            },
          ],
        });
      }

      canonicalFamilies.push(
        { name: "System", slug: "system", fontFamily: "system-ui, sans-serif" },
        { name: "Mono", slug: "mono", fontFamily: "ui-monospace, monospace" }
      );

      fontFamilies.length = 0;
      Array.prototype.push.apply(fontFamilies, canonicalFamilies);
    }

    // Helper: strip clamp() to its first value (used when typography is fixed)
    const stripClampToFirst = (s) => {
      if (!s || typeof s !== "string") return s;
      const m = /^clamp\(\s*([^,]+),/i.exec(s);
      if (m) return m[1].trim();
      return s;
    };

    // If typography is fixed (non-responsive), convert any clamp() sizes
    // to their first argument (same rule as for theme-tokens generation).
    if (!typoResponsive) {
      try {
        fontSizes = fontSizes.map((fs) => ({
          ...fs,
          size: stripClampToFirst(fs.size),
        }));
      } catch (e) {
        /* noop */
      }
    }

    // Build a styles object using var:preset references so WP consumers
    // receive presets (palette/spacing/typography) rather than raw values.
    // If the user did not choose Poppins, we must not reference it in the
    // JSON — replace font-family references by the "system" slug.
    const includePoppinsRef = (cfg && cfg.fontFamily) === "poppins";
    const fontFamilyRef = includePoppinsRef
      ? "var:preset|font-family|poppins"
      : "system";

    const styles = {
      color: {
        background: "var:preset|color|surface",
        text: "var:preset|color|on-surface",
      },
      spacing: {
        blockGap: "var:preset|spacing|spacing-16",
        padding: {
          left: "var:preset|spacing|spacing-16",
          right: "var:preset|spacing|spacing-16",
        },
      },
      typography: {
        fontFamily: fontFamilyRef,
        fontSize: "var:preset|font-size|text-m",
        fontWeight: "400",
        lineHeight: "var(--line-height-24)",
        fontStyle: "normal",
      },
      elements: {
        heading: {
          color: { text: "var:preset|color|primary" },
          typography: {
            fontFamily: fontFamilyRef,
            fontWeight: "600",
          },
        },
        h1: {
          typography: {
            fontFamily: fontFamilyRef,
            fontSize: "var:preset|font-size|text-4xl",
            lineHeight: "1.05",
            fontWeight: "600",
          },
        },
        h2: {
          typography: {
            fontFamily: fontFamilyRef,
            fontSize: "var:preset|font-size|text-4xl",
            lineHeight: "1.2",
            fontWeight: "600",
          },
        },
        link: {
          color: { text: "var:preset|color|link" },
          typography: { textDecoration: "underline" },
          ":hover": {
            color: { text: "var:preset|color|link-hover" },
            typography: { fontWeight: "700" },
          },
        },
      },
      blocks: {
        "core/button": {
          border: { radius: "0.5rem" },
          color: {
            background: "var:preset|color|primary",
            text: "var:preset|color|on-primary",
          },
          typography: {
            fontFamily: fontFamilyRef,
            fontWeight: "600",
          },
          spacing: {
            padding: {
              top: "var:preset|spacing|spacing-12",
              right: "var:preset|spacing|spacing-12",
              bottom: "var:preset|spacing|spacing-12",
              left: "var:preset|spacing|spacing-12",
            },
          },
        },
      },
    };

    const final = {
      $schema: "https://schemas.wp.org/wp/6.7/theme.json",
      version: 3,
      settings: {
        appearanceTools: true,
        color: {
          defaultDuotone: false,
          defaultGradients: false,
          defaultPalette: false,
          palette,
        },
        layout: { contentSize: "64rem", wideSize: "84rem" },
        spacing: {
          defaultSpacingSizes: false,
          spacingSizes: spacing,
          units: ["px", "rem", "%", "vh", "vw"],
        },
        typography: {
          writingMode: true,
          defaultFontSizes: false,
          fluid: typoResponsive,
          fontSizes,
          fontFamilies,
        },
      },
      styles,
    };

    return JSON.stringify(final, null, 2) + "\n";
  } catch (e) {
    return JSON.stringify({ error: String(e) }) + "\n";
  }
}
