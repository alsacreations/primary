#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "dist");
// Allow overriding the input directory where primitives.json and tokens.json are read from
let IN_DIR = OUT_DIR;
const DEFAULTS = {
  $schema: "https://schemas.wp.org/wp/6.7/theme.json",
  version: 3,
  settings: {
    appearanceTools: true,
    useRootPaddingAwareAlignments: true,
  },
};

const defaultPalette = [
  { name: "white", color: "var(--color-white)", slug: "white" },
  { name: "black", color: "var(--color-black)", slug: "black" },
  { name: "gray-50", color: "var(--color-gray-50)", slug: "gray-50" },
  { name: "gray-100", color: "var(--color-gray-100)", slug: "gray-100" },
  { name: "gray-200", color: "var(--color-gray-200)", slug: "gray-200" },
  { name: "gray-300", color: "var(--color-gray-300)", slug: "gray-300" },
  { name: "gray-400", color: "var(--color-gray-400)", slug: "gray-400" },
  { name: "gray-500", color: "var(--color-gray-500)", slug: "gray-500" },
  { name: "gray-600", color: "var(--color-gray-600)", slug: "gray-600" },
  { name: "gray-700", color: "var(--color-gray-700)", slug: "gray-700" },
  { name: "gray-800", color: "var(--color-gray-800)", slug: "gray-800" },
  { name: "gray-900", color: "var(--color-gray-900)", slug: "gray-900" },

  { name: "error-100", color: "var(--color-error-100)", slug: "error-100" },
  { name: "error-300", color: "var(--color-error-300)", slug: "error-300" },
  { name: "error-500", color: "var(--color-error-500)", slug: "error-500" },

  { name: "success-100", color: "var(--color-success-100)", slug: "success-100" },
  { name: "success-300", color: "var(--color-success-300)", slug: "success-300" },
  { name: "success-500", color: "var(--color-success-500)", slug: "success-500" },

  { name: "warning-100", color: "var(--color-warning-100)", slug: "warning-100" },
  { name: "warning-300", color: "var(--color-warning-300)", slug: "warning-300" },
  { name: "warning-500", color: "var(--color-warning-500)", slug: "warning-500" },

  { name: "info-100", color: "var(--color-info-100)", slug: "info-100" },
  { name: "info-300", color: "var(--color-info-300)", slug: "info-300" },
  { name: "info-500", color: "var(--color-info-500)", slug: "info-500" },

  { name: "primary", color: "light-dark(var(--color-gray-500), var(--color-gray-300))", slug: "primary" },
  { name: "on-primary", color: "light-dark(var(--color-white), var(--color-black))", slug: "on-primary" },
  { name: "accent", color: "light-dark(var(--color-gray-300), var(--color-gray-500))", slug: "accent" },
  {
    name: "accent-invert",
    color: "light-dark(var(--color-gray-500), var(--color-gray-300))",
    slug: "accent-invert",
  },
  { name: "surface", color: "light-dark(var(--color-white), var(--color-gray-900))", slug: "surface" },
  { name: "on-surface", color: "light-dark(var(--color-gray-900), var(--color-gray-100))", slug: "on-surface" },
  { name: "link", color: "light-dark(var(--color-gray-500), var(--color-gray-300))", slug: "link" },
  {
    name: "link-hover",
    color: "light-dark(var(--color-gray-700), var(--color-gray-500))",
    slug: "link-hover",
  },
  { name: "selection", color: "light-dark(var(--color-gray-300), var(--color-gray-500))", slug: "selection" },
];

const defaultSpacingSizes = [
  { name: "spacing-0", size: "var(--spacing-0)", slug: "spacing-0" },
  { name: "spacing-2", size: "var(--spacing-2)", slug: "spacing-2" },
  { name: "spacing-4", size: "var(--spacing-4)", slug: "spacing-4" },
  { name: "spacing-8", size: "var(--spacing-8)", slug: "spacing-8" },
  { name: "spacing-12", size: "var(--spacing-12)", slug: "spacing-12" },
  { name: "spacing-16", size: "var(--spacing-16)", slug: "spacing-16" },
  { name: "spacing-24", size: "var(--spacing-24)", slug: "spacing-24" },
  { name: "spacing-32", size: "var(--spacing-32)", slug: "spacing-32" },
  { name: "spacing-48", size: "var(--spacing-48)", slug: "spacing-48" },
];

const defaultFontSizes = [
  { name: "text-14", size: "var(--text-14)", slug: "text-14" },
  { name: "text-16", size: "var(--text-16)", slug: "text-16" },
  { name: "text-18", size: "var(--text-18)", slug: "text-18" },
  { name: "text-20", size: "var(--text-20)", slug: "text-20" },
  { name: "text-24", size: "var(--text-24)", slug: "text-24" },
  { name: "text-30", size: "var(--text-30)", slug: "text-30" },
  { name: "text-48", size: "var(--text-48)", slug: "text-48" },
];

// Defaults for base/mono fonts and weight scale
const defaultFontBase = "system-ui, sans-serif";
const defaultFontMono = "ui-monospace, monospace";
const defaultFontWeights = {
  light: 300,
  regular: 400,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

const defaultFontFamilies = [
  {
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
  },
  { name: "System", slug: "system", fontFamily: "system-ui, sans-serif" },
  { name: "Mono", slug: "mono", fontFamily: "ui-monospace, monospace" },
];

const defaultStyles = {
  color: { background: "var:preset|color|surface", text: "var:preset|color|on-surface" },
  spacing: {
    blockGap: "var:preset|spacing|spacing-16",
    padding: { left: "var:preset|spacing|spacing-16", right: "var:preset|spacing|spacing-16" },
  },
  typography: {
    fontFamily: "var:preset|font-family|poppins",
    fontSize: "var:preset|font-size|text-16",
    fontWeight: "400",
    lineHeight: "1.2",
    fontStyle: "normal",
  },
  elements: {
    heading: {
      color: { text: "var:preset|color|primary" },
      typography: { fontFamily: "var:preset|font-family|poppins", fontWeight: "600" },
    },
    h1: {
      typography: {
        fontFamily: "var:preset|font-family|poppins",
        fontSize: "var:preset|font-size|text-48",
        lineHeight: "1.05",
        fontWeight: "600",
      },
    },
    h2: {
      typography: {
        fontFamily: "var:preset|font-family|poppins",
        fontSize: "var:preset|font-size|text-48",
        lineHeight: "1.2",
        fontWeight: "600",
      },
    },
    link: {
      color: { text: "var:preset|color|link" },
      typography: { textDecoration: "underline" },
      ":hover": { color: { text: "var:preset|color|link-hover" }, typography: { fontWeight: "700" } },
    },
  },
  blocks: {
    "core/button": {
      border: { radius: "0.5rem" },
      color: { background: "var:preset|color|primary", text: "var:preset|color|on-primary" },
      typography: { fontFamily: "var:preset|font-family|poppins", fontWeight: "600" },
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

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return null;
  }
}

function writeJson(outPath, obj) {
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2));
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function toVarName(prefix, slug) {
  // prefix without leading dashes
  return `var(--${prefix}${slug})`;
}

function buildPalette(primitives, tokens) {
  const palette = [];
  const seen = new Set();

  // Add color primitives first
  if (primitives && primitives.color) {
    Object.keys(primitives.color).forEach((key) => {
      const slug = key;
      const entry = { name: slug, color: `var(--color-${slug})`, slug };
      palette.push(entry);
      seen.add(slug);
    });
  }

  // Add tokens color entries (if any), prefer token representation
  if (tokens && tokens.colors) {
    Object.keys(tokens.colors).forEach((tk) => {
      const slug = tk;
      if (!seen.has(slug)) {
        const value = tokens.colors[tk].value || `var(--${slug})`;
        palette.push({ name: slug, color: value, slug });
        seen.add(slug);
      }
    });
  }

  // Finally add defaults for commonly expected tokens if missing
  defaultPalette.forEach((entry) => {
    if (!seen.has(entry.slug)) {
      palette.push(entry);
      seen.add(entry.slug);
    }
  });

  return palette;
}

function buildSpacing(primitives, tokens) {
  const sizes = [];
  const seen = new Set();

  // Use tokens spacing first
  if (tokens && tokens.spacing) {
    Object.keys(tokens.spacing).forEach((k) => {
      const item = tokens.spacing[k];
      const slug = k;
      const size = item.value || `var(--${slug})`;
      sizes.push({ name: slug, size, slug });
      seen.add(slug);
    });
  }

  // Add default spacing sizes as fallback
  defaultSpacingSizes.forEach((s) => {
    if (!seen.has(s.slug)) {
      sizes.push(s);
      seen.add(s.slug);
    }
  });

  // Ensure primitives are available as var entries (append additional unnamed primitives)
  if (primitives && primitives.spacing) {
    Object.keys(primitives.spacing).forEach((p) => {
      if (!seen.has(p)) {
        sizes.push({ name: p, size: `var(--${p})`, slug: p });
        seen.add(p);
      }
    });
  }

  return { defaultSpacingSizes: false, spacingSizes: sizes, units: ["px", "rem", "%", "vh", "vw"] };
}

function buildTypography(primitives, tokens) {
  const fontSizes = [];
  const seen = new Set();

  // tokens first
  if (tokens && tokens.fonts && tokens.fonts.fontSize) {
    Object.keys(tokens.fonts.fontSize).forEach((k) => {
      const entry = tokens.fonts.fontSize[k];
      const slug = k;
      const size = entry.value || `var(--${slug})`;
      fontSizes.push({ name: slug, size, slug });
      seen.add(slug);
    });
  }

  // add default font sizes
  defaultFontSizes.forEach((s) => {
    if (!seen.has(s.slug)) {
      fontSizes.push(s);
      seen.add(s.slug);
    }
  });

  // add primitives font sizes
  if (primitives && primitives.fontSize) {
    Object.keys(primitives.fontSize).forEach((p) => {
      if (!seen.has(p)) {
        fontSizes.push({ name: p, size: `var(--${p})`, slug: p });
        seen.add(p);
      }
    });
  }

  // font families
  const fontFamilies = [];
  if (primitives && primitives.font) {
    Object.keys(primitives.font).forEach((k) => {
      const meta = primitives.font[k];
      fontFamilies.push({ name: k, slug: k, fontFamily: meta.value || k, fontFace: meta.fontFace || undefined });
    });
  }
  // fallback defaults
  if (!fontFamilies.length) fontFamilies.push(...defaultFontFamilies);

  return {
    typography: {
      writingMode: true,
      defaultFontSizes: false,
      fluid: false,
      customFontSize: false,
      fontSizes,
      fontFamilies,
      // encode font base/mono and weight scale explicitly
    },
  }; // Note: font base/mono and weight scale are exposed in CSS variables (`--font-base`, `--font-mono`, `--font-weight-*`) and should be referenced from `styles.typography` if desired.
}

function injectDefaults(theme) {
  // layout
  theme.settings.layout = { contentSize: "48rem", wideSize: "80rem" };
  // spacing - use buildSpacing caller output inserted elsewhere
  // styles defaults
  // Ensure styles.typography references the CSS variables for base font and weight.
  defaultStyles.typography.fontFamily = "var(--font-base)";
  defaultStyles.typography.fontWeight = "var(--font-weight-regular)";
  theme.styles = defaultStyles;
}

function validate(theme, primitives, tokens) {
  const warnings = [];
  // minimal structure validations
  if (!theme.settings) warnings.push("Missing settings root");
  if (!theme.settings.color || !Array.isArray(theme.settings.color.palette))
    warnings.push("Missing settings.color.palette");
  if (!theme.settings.typography || !Array.isArray(theme.settings.typography.fontSizes))
    warnings.push("Missing settings.typography.fontSizes");
  if (!theme.settings.spacing || !Array.isArray(theme.settings.spacing.spacingSizes))
    warnings.push("Missing settings.spacing.spacingSizes");

  // Check var references exist in primitives or tokens where possible (naive check)
  const varRefs = JSON.stringify(theme).match(/var\(--[a-zA-Z0-9-]+\)/g) || [];
  varRefs.forEach((v) => {
    let name = v.replace(/^var\(--/, "").replace(/\)$/, "");
    // normalize color names like 'color-white' -> 'white'
    if (name.startsWith("color-")) name = name.replace(/^color-/, "");
    // strip any leading dashes
    if (name.startsWith("--")) name = name.replace(/^--/, "");

    // check existence in primitives (color/spacings/fontSize/lineHeight/rounded) or top-level primitives
    const exists =
      (primitives && primitives.color && primitives.color[name]) ||
      (primitives && primitives.spacing && primitives.spacing[name]) ||
      (primitives && primitives.fontSize && primitives.fontSize[name]) ||
      (primitives && primitives.lineHeight && primitives.lineHeight[name]) ||
      (primitives && primitives.rounded && primitives.rounded[name]) ||
      (primitives && primitives[name]);

    if (!exists) warnings.push(`Reference to ${v} not found in primitives`);
  });

  return [...new Set(warnings)];
}

function main() {
  const args = process.argv.slice(2);
  const outArgIndex = args.indexOf("--out");
  const outPath =
    outArgIndex !== -1 && args[outArgIndex + 1] ? args[outArgIndex + 1] : path.join(OUT_DIR, "theme.json");
  const inArgIndex = args.indexOf("--in");
  IN_DIR = inArgIndex !== -1 && args[inArgIndex + 1] ? path.resolve(args[inArgIndex + 1]) : IN_DIR;

  ensureOutDir();

  const primitives = readJson(path.join(IN_DIR, "primitives.json")) || {};
  const tokens = readJson(path.join(IN_DIR, "tokens.json")) || {};

  const theme = Object.assign({}, DEFAULTS);
  theme.settings.color = { defaultDuotone: false, defaultGradients: false, defaultPalette: false };

  // build palette
  theme.settings.color.palette = buildPalette(primitives, tokens);

  // build spacing
  theme.settings.spacing = buildSpacing(primitives, tokens);

  // build typography
  const typ = buildTypography(primitives, tokens);
  theme.settings.typography = typ.typography;

  // inject defaults
  injectDefaults(theme);

  // write theme
  writeJson(outPath, theme);

  // validate
  const warnings = validate(theme, primitives, tokens);
  if (warnings.length) {
    writeJson(path.join(OUT_DIR, "theme-warnings.json"), warnings);
    console.warn("Warnings generated. See dist/theme-warnings.json");
  }

  console.log(`Wrote ${outPath}`);
}

if (require.main === module) main();

module.exports = { buildPalette, buildSpacing, buildTypography, DEFAULTS };
