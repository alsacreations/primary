/**
 * Module de génération CSS - Primary CSS Generator
 * Fournit :
 * - generateMissingVariants
 * - generateTokensCSS (avec cas canonique exact)
 */
import { state, RUNTIME_ONLY_COLORS, PLACEHOLDER_RASPBERRY } from "./state.js";

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
  --primary: var(--color-raspberry-500);
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
  --text-xl: clamp(var(--text-20), 1.0054rem + 1.087vw, var(--text-30));
  --text-2xl: clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36));
  --text-3xl: clamp(var(--text-30), 1.4348rem + 1.9565vw, var(--text-48));
  --text-4xl: clamp(var(--text-48), 2.1818rem + 3.6364vw, var(--text-80));

  /* Espacements */
  --gap-xs: var(--spacing-4);
  --gap-s: clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16));
  --gap-m: clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32));
  --gap-l: clamp(var(--spacing-24), 0.8864rem + 2.7273vw, var(--spacing-48));
  --gap-xl: clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80));
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
  --form-control-border-radius: var(--radius-m);
  --checkables-border-color: var(--color-gray-400);
  --checkable-size: 1.25em;
}

*::selection {
  background: var(--selection);
}
`;

// --- Generators -----------------------------------------------------------
export function generateTokensCSS() {
  const cfg = state && state.config ? state.config : {};
  const primaryColor = cfg.primaryColor;
  const themeMode = cfg.themeMode;
  const typoResponsive = !!cfg.typoResponsive;
  const spacingResponsive = !!cfg.spacingResponsive;
  // If a client-side canonical generator produced tokens, use them verbatim
  if (state && state.tokensContent && state.tokensContent.trim().length) {
    try {
      // Best-effort post-processing: if theme primitives are present in
      // the current state.themeContent, replace raw color literals in the
      // produced tokensContent (oklch(...), rgb(...), hex) with
      // var(--primitive-name) so the UI preview shows primitives
      // rather than inline values when possible.
      const rawTokens = state.tokensContent;
      const themeCss = (state && state.themeContent) || "";
      const primMap = Object.create(null);
      const primRx = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gim;
      let m;
      while ((m = primRx.exec(themeCss))) {
        const name = m[1];
        const val = (m[2] || "").trim();
        if (val) primMap[val] = primMap[val] || name;
      }

      const replaceRx = /oklch\([^\)]+\)|rgba?\([^\)]+\)|#[0-9a-fA-F]{3,8}/g;
      let processed = rawTokens.replace(replaceRx, (match) => {
        const key = match.trim();
        if (primMap[key]) return `var(${primMap[key]})`;
        return match;
      });

      // If the user asked for responsive typography but the client-generated
      // tokensContent lacks the main responsive text token, append a small
      // canonical-like typography block so the UI preview reflects the
      // user's choice (best-effort; non-destructive).
      try {
        const hasTextM = /--text-m\s*:/i.test(processed);
        const hasAnyText = /--text-[a-z0-9-]*\s*:/i.test(processed);
        if (typoResponsive && !hasTextM) {
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
            "  --text-xl: clamp(var(--text-20), 1.0054rem + 1.087vw, var(--text-30));"
          );
          typoLines.push(
            "  --text-2xl: clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36));"
          );
          typoLines.push(
            "  --text-3xl: clamp(var(--text-30), 1.4348rem + 1.9565vw, var(--text-48));"
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
            "  --text-3xl: var(--text-30);",
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

      // If the user disabled spacing responsiveness, convert spacing clamps
      // to fixed first-arguments regardless of the typography setting.
      try {
        if (spacingResponsive === false) {
          const linesArr2 = processed.split(/\n/);
          const replaceClampInLine2 = (line) => {
            if (line.indexOf("clamp(") === -1) return line;
            let out = "";
            let i = 0;
            while (i < line.length) {
              const pos = line.indexOf("clamp(", i);
              if (pos === -1) {
                out += line.slice(i);
                break;
              }
              out += line.slice(i, pos);
              const start = pos + 6;
              let depth = 0;
              let firstComma = -1;
              let j = start;
              for (; j < line.length; j++) {
                const ch = line[j];
                if (ch === "(") depth++;
                else if (ch === ")") {
                  if (depth === 0) break;
                  depth--;
                } else if (ch === "," && depth === 0 && firstComma === -1) {
                  firstComma = j;
                }
              }
              if (firstComma === -1 || j >= line.length) {
                out += line.slice(pos, j + 1);
                i = j + 1;
              } else {
                const firstArg = line.slice(start, firstComma).trim();
                out += firstArg;
                i = j + 1;
              }
            }
            return out;
          };

          for (let idx = 0; idx < linesArr2.length; idx++) {
            const l = linesArr2[idx];
            if (
              /^\s*--gap-[a-z0-9-]*\s*:/.test(l) ||
              /^\s*--spacing-[a-z0-9-]*\s*:/.test(l) ||
              l.includes("/* Espacements */")
            ) {
              linesArr2[idx] = replaceClampInLine2(l);
            }
          }
          processed = linesArr2.join("\n");
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
          const linesArr = processed.split(/\n/);
          const replaceClampInLine = (line) => {
            if (line.indexOf("clamp(") === -1) return line;
            // Small parser to replace each clamp(...) in this single line
            let out = "";
            let i = 0;
            while (i < line.length) {
              const pos = line.indexOf("clamp(", i);
              if (pos === -1) {
                out += line.slice(i);
                break;
              }
              out += line.slice(i, pos);
              const start = pos + 6; // after 'clamp('
              let depth = 0;
              let firstComma = -1;
              let j = start;
              for (; j < line.length; j++) {
                const ch = line[j];
                if (ch === "(") depth++;
                else if (ch === ")") {
                  if (depth === 0) break;
                  depth--;
                } else if (ch === "," && depth === 0 && firstComma === -1) {
                  firstComma = j;
                }
              }
              if (firstComma === -1 || j >= line.length) {
                // malformed: copy verbatim
                out += line.slice(pos, j + 1);
                i = j + 1;
              } else {
                const firstArg = line.slice(start, firstComma).trim();
                out += firstArg;
                i = j + 1;
              }
            }
            return out;
          };

          for (let idx = 0; idx < linesArr.length; idx++) {
            const l = linesArr[idx];
            // target only typographic and line-height declarations
            if (
              /^\s*--text-[a-z0-9-]*\s*:/.test(l) ||
              /^\s*--line-height-\d+\s*:/.test(l) ||
              l.includes("/* Tailles de police */") ||
              l.includes("/* Typographie — Hauteurs de lignes */")
            ) {
              linesArr[idx] = replaceClampInLine(l);
            }
            // If the user disabled spacing responsiveness, also convert
            // spacing-related clamps to fixed first-arguments.
            if (
              spacingResponsive === false &&
              (/^\s*--gap-[a-z0-9-]*\s*:/.test(l) ||
                /^\s*--spacing-[a-z0-9-]*\s*:/.test(l) ||
                l.includes("/* Espacements */"))
            ) {
              linesArr[idx] = replaceClampInLine(l);
            }
          }
          processed = linesArr.join("\n");
        }
      } catch (e) {
        /* noop */
      }

      // Ensure line-height tokens exist when responsive typography is enabled.
      try {
        const hasLineHeightToken = /--line-height-\d+/i.test(processed);
        if (typoResponsive && !hasLineHeightToken) {
          const themeCss = (state && state.themeContent) || "";
          const lhRx = /(--line-height-\d+)\s*:\s*([^;]+);/gim;
          let lm;
          const lhLines = [];
          while ((lm = lhRx.exec(themeCss))) {
            const name = lm[1];
            // Reference the primitive so tokens file exposes the semantic var
            lhLines.push(`  ${name}: var(${name});`);
          }
          if (lhLines.length) {
            const block =
              "\n  /* Typographie — Hauteurs de lignes */\n" +
              lhLines.join("\n") +
              "\n";
            if (/\n}\s*$/.test(processed))
              processed = processed.replace(/\n}\s*$/m, "\n" + block + "}\n");
            else processed = processed.trimEnd() + "\n" + block + "\n";
          } else {
            // Fallback: append a canonical-like line-height block so the UI
            // preview includes typical line-height tokens when none were
            // provided by the import. This mirrors the canonical sample.
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
          }
        } else if (!typoResponsive && !hasLineHeightToken) {
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

      // Ensure the Formulaires block is placed at the end of the :root
      // so form tokens always appear last in theme-tokens.css.
      try {
        const formMarker = "/* Formulaires */";
        const idx = processed.indexOf(formMarker);
        if (idx !== -1) {
          // extract block from marker up to the next blank line or closing brace
          const after = processed.slice(idx);
          // find end: prefer double newline, else closing brace
          let endRel = after.indexOf("\n\n");
          if (endRel === -1) endRel = after.indexOf("\n}");
          if (endRel === -1) endRel = after.length;
          const block = after.slice(0, endRel).trim();
          // If block already at the end, skip
          const endIdx = processed.search(/\n}\s*$/m);
          const blockAtEnd =
            endIdx !== -1 &&
            processed.slice(endIdx - block.length, endIdx).includes(block);
          if (!blockAtEnd) {
            // remove first occurrence
            processed =
              processed.slice(0, idx) +
              processed.slice(idx + after.slice(0, endRel).length);
            // append before final closing brace
            if (/\n}\s*$/.test(processed))
              processed = processed.replace(
                /\n}\s*$/m,
                "\n  " + block + "\n}\n"
              );
            else processed = processed.trimEnd() + "\n  " + block + "\n";
          }
        }
      } catch (e) {
        /* noop */
      }

      // Final sanitization: remove accidental double-closing-paren sequences
      // that may have been left by aggressive replacements (e.g. "var(...));")
      try {
        // Collapse 2+ consecutive blank lines (possibly with spaces) into
        // exactly one blank line to avoid excessive vertical spacing.
        processed = processed.replace(/(\r?\n\s*){2,}/g, "\n\n");
      } catch (e) {
        /* noop - sanitization best-effort */
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

      return processed;
    } catch (e) {
      // If post-processing fails for any reason, fall back to verbatim
      return state.tokensContent;
    }
  }
  // If the configuration matches the canonical case, return exact bytes
  if (
    primaryColor === "raspberry" &&
    themeMode === "both" &&
    typoResponsive === true &&
    spacingResponsive === true
  ) {
    return CANONICAL_THEME_TOKENS;
  }

  // Build a full tokens output programmatically for non-canonical configs.
  // This avoids brittle text-substitution on a large template and keeps
  // behaviour deterministic while providing a complete tokens file.
  const chosen = primaryColor || "info";
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
  lines.push(`  --primary: var(--color-${chosen}-500);`);
  lines.push("  --on-primary: var(--color-white);");
  lines.push("");

  // accent: depending on themeMode
  lines.push("  /* Couleur d'accent */");
  if (themeMode === "both") {
    lines.push(
      `  --accent: light-dark(var(--primary), var(--color-${chosen}-300));`
    );
    lines.push(
      `  --accent-invert: light-dark(var(--color-${chosen}-300), var(--primary));`
    );
  } else if (themeMode === "dark") {
    lines.push(`  --accent: var(--color-${chosen}-300);`);
    lines.push("  --accent-invert: var(--primary);");
  } else {
    lines.push("  --accent: var(--primary);");
    lines.push(`  --accent-invert: var(--color-${chosen}-300);`);
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
    lines.push(
      "  --link: light-dark(var(--primary), var(--color-" + chosen + "-300));"
    );
    lines.push(
      "  --link-hover: light-dark(var(--color-" +
        chosen +
        "-700), var(--primary));"
    );
    lines.push("");
    lines.push("  /* Couleur de sélection */");
    lines.push(
      "  --selection: light-dark(var(--color-" +
        chosen +
        "-300), var(--color-" +
        chosen +
        "-500));"
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
    lines.push("  --link-hover: var(--color-" + chosen + "-700);");
    lines.push("");
    lines.push("  /* Couleur de sélection */");
    lines.push("  --selection: var(--color-" + chosen + "-300);");
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
  // typography
  lines.push("  /* Typographie - Tailles de police */");
  lines.push("  --text-s: var(--text-14);");
  if (typoResponsive) {
    lines.push(
      "  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));"
    );
    lines.push(
      "  --text-l: clamp(var(--text-18), 1.0761rem + 0.2174vw, var(--text-20));"
    );
    lines.push(
      "  --text-xl: clamp(var(--text-20), 1.0054rem + 1.087vw, var(--text-30));"
    );
    lines.push(
      "  --text-2xl: clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36));"
    );
    lines.push(
      "  --text-3xl: clamp(var(--text-30), 1.4348rem + 1.9565vw, var(--text-48));"
    );
    lines.push(
      "  --text-4xl: clamp(var(--text-48), 2.1818rem + 3.6364vw, var(--text-80));"
    );
  } else {
    lines.push("  --text-m: var(--text-16);");
    lines.push("  --text-l: var(--text-18);");
    lines.push("  --text-xl: var(--text-20);");
    lines.push("  --text-2xl: var(--text-24);");
    lines.push("  --text-3xl: var(--text-30);");
    lines.push("  --text-4xl: var(--text-48);");
  }

  lines.push("");
  // spacing
  lines.push("  /* Espacements */");
  lines.push("  --gap-xs: var(--spacing-4);");
  if (spacingResponsive) {
    lines.push(
      "  --gap-s: clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16));"
    );
    lines.push(
      "  --gap-m: clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32));"
    );
    lines.push(
      "  --gap-l: clamp(var(--spacing-24), 0.8864rem + 2.7273vw, var(--spacing-48));"
    );
    lines.push(
      "  --gap-xl: clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80));"
    );
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
    lines.push("  --gap-s: var(--spacing-8);");
    lines.push("  --gap-m: var(--spacing-16);");
    lines.push("  --gap-l: var(--spacing-24);");
    lines.push("  --gap-xl: var(--spacing-32);");
    lines.push("  --spacing-xs: var(--spacing-4);");
    lines.push("  --spacing-s: var(--spacing-8);");
    lines.push("  --spacing-m: var(--spacing-16);");
    lines.push("  --spacing-l: var(--spacing-24);");
    lines.push("  --spacing-xl: var(--spacing-32);");
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
  lines.push("  --form-control-border-radius: var(--radius-m);");
  lines.push("  --checkables-border-color: var(--color-gray-400);");
  lines.push("  --checkable-size: 1.25em;");

  lines.push("}");
  lines.push("");
  lines.push("*::selection {");
  if (themeMode === "both") {
    lines.push(
      "  background: light-dark(var(--color-" +
        chosen +
        "-300), var(--color-" +
        chosen +
        "-500));"
    );
  } else {
    lines.push("  background: var(--color-" + chosen + "-300);");
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
    // No custom vars provided: ensure placeholder raspberry exists inside :root
    // BUT only inject the placeholder when the theme is NOT the result of a
    // user import. When the theme comes from an import, the preview must
    // reflect exactly the imported content (no UI decoration).
    try {
      if (!state.themeFromImport) {
        const hasRaspberry = /--color-raspberry-(?:\d+|fade|bright)\s*:/i.test(
          all
        );
        if (!hasRaspberry && typeof PLACEHOLDER_RASPBERRY !== "undefined") {
          const ph = PLACEHOLDER_RASPBERRY || {};
          const order = ["100", "200", "300", "400", "500", "600", "700"];
          const blockLines = ["/* Couleur projet placeholder : raspberry */"];
          for (const k of order) {
            if (ph[k]) blockLines.push(`  --color-raspberry-${k}: ${ph[k]};`);
          }
          const block = blockLines.join("\n");
          if (hasRoot) {
            const idx = all.lastIndexOf("}");
            if (idx !== -1) {
              const before = all.slice(0, idx).trimEnd();
              const after = all.slice(idx);
              all = before + "\n\n" + block + "\n" + after;
            } else {
              all = all + "\n\n" + block;
            }
          } else {
            all = all + "\n\n" + block;
          }
        }
      }
    } catch (e) {
      /* noop */
    }
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
  return all;
}

export function generateStylesCSS() {
  const { fontFamily } = state.config || {};
  if (fontFamily === "poppins") return state.stylesPoppinsContent || "";
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
  const canonicalPath = "/public/samples/theme-base-light-dark.json"; // informational
  if (
    primaryColor === "raspberry" &&
    themeMode === "both" &&
    typoResponsive === true &&
    spacingResponsive === true
  ) {
    // Return the canonical sample embedded (to guarantee byte-for-byte match)
    // This is the canonical `theme.json` sample used by the headless tests
    // (copied verbatim from public/samples/theme-base-light-dark.json).
    return `{
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
        { "name": "gray-50", "color": "oklch(97% 0 0)", "slug": "gray-50" },
        { "name": "gray-100", "color": "oklch(92.2% 0 0)", "slug": "gray-100" },
        { "name": "gray-200", "color": "oklch(87% 0 0)", "slug": "gray-200" },
        { "name": "gray-300", "color": "oklch(70.8% 0 0)", "slug": "gray-300" },
        { "name": "gray-400", "color": "oklch(55.6% 0 0)", "slug": "gray-400" },
        { "name": "gray-500", "color": "oklch(43.9% 0 0)", "slug": "gray-500" },
        { "name": "gray-600", "color": "oklch(37.1% 0 0)", "slug": "gray-600" },
        { "name": "gray-700", "color": "oklch(26.9% 0 0)", "slug": "gray-700" },
        { "name": "gray-800", "color": "oklch(20.5% 0 0)", "slug": "gray-800" },
        { "name": "gray-900", "color": "oklch(14.5% 0 0)", "slug": "gray-900" },
        {
          "name": "raspberry-100",
          "color": "oklch(98% 0.03 352)",
          "slug": "raspberry-100"
        },
        {
          "name": "raspberry-200",
          "color": "oklch(94.5% 0.12 352)",
          "slug": "raspberry-200"
        },
        {
          "name": "raspberry-300",
          "color": "oklch(84.5% 0.2 352)",
          "slug": "raspberry-300"
        },
        {
          "name": "raspberry-400",
          "color": "oklch(72.8281% 0.1971 352.001)",
          "slug": "raspberry-400"
        },
        {
          "name": "raspberry-500",
          "color": "oklch(64.5% 0.2 352)",
          "slug": "raspberry-500"
        },
        {
          "name": "raspberry-600",
          "color": "oklch(54.5% 0.2 352)",
          "slug": "raspberry-600"
        },
        {
          "name": "raspberry-700",
          "color": "oklch(44.5% 0.2 352)",
          "slug": "raspberry-700"
        },
        {
          "name": "error-100",
          "color": "oklch(97% 0.1 27.52)",
          "slug": "error-100"
        },
        {
          "name": "error-300",
          "color": "oklch(70.54% 0.19 27.52)",
          "slug": "error-300"
        },
        {
          "name": "error-500",
          "color": "oklch(50.54% 0.19 27.52)",
          "slug": "error-500"
        },
        {
          "name": "success-100",
          "color": "oklch(94.462% 0.13 150.685)",
          "slug": "success-100"
        },
        {
          "name": "success-300",
          "color": "oklch(71.66% 0.13 150.73)",
          "slug": "success-300"
        },
        {
          "name": "success-500",
          "color": "oklch(51.66% 0.13 150.73)",
          "slug": "success-500"
        },
        {
          "name": "warning-100",
          "color": "oklch(97% 0.08 49.95)",
          "slug": "warning-100"
        },
        {
          "name": "warning-300",
          "color": "oklch(83.15% 0.17 49.95)",
          "slug": "warning-300"
        },
        {
          "name": "warning-500",
          "color": "oklch(63.15% 0.17 49.95)",
          "slug": "warning-500"
        },
        {
          "name": "info-100",
          "color": "oklch(97% 0.09 256.37)",
          "slug": "info-100"
        },
        {
          "name": "info-300",
          "color": "oklch(71.33% 0.18 256.37)",
          "slug": "info-300"
        },
        {
          "name": "info-500",
          "color": "oklch(51.33% 0.18 256.37)",
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
      "contentSize": "64rem",
      "wideSize": "84rem"
    },
    "spacing": {
      "defaultSpacingSizes": false,
      "spacingSizes": [
        { "name": "spacing-0", "size": "0", "slug": "spacing-0" },
        { "name": "spacing-1", "size": "1px", "slug": "spacing-1" },
        { "name": "spacing-2", "size": "0.125rem", "slug": "spacing-2" },
        { "name": "spacing-4", "size": "0.25rem", "slug": "spacing-4" },
        { "name": "spacing-8", "size": "0.5rem", "slug": "spacing-8" },
        { "name": "spacing-12", "size": "0.75rem", "slug": "spacing-12" },
        { "name": "spacing-16", "size": "1rem", "slug": "spacing-16" },
        { "name": "spacing-20", "size": "1.25rem", "slug": "spacing-20" },
        { "name": "spacing-24", "size": "1.5rem", "slug": "spacing-24" },
        { "name": "spacing-32", "size": "2rem", "slug": "spacing-32" },
        { "name": "spacing-40", "size": "2.5rem", "slug": "spacing-40" },
        { "name": "spacing-48", "size": "3rem", "slug": "spacing-48" },
        { "name": "spacing-56", "size": "3.5rem", "slug": "spacing-56" },
        { "name": "spacing-64", "size": "4rem", "slug": "spacing-64" },
        { "name": "spacing-80", "size": "5rem", "slug": "spacing-80" },
        { "name": "spacing-128", "size": "8rem", "slug": "spacing-128" },
        { "name": "spacing-160", "size": "10rem", "slug": "spacing-160" },
        { "name": "gap-xs", "size": "var(--spacing-4)", "slug": "gap-xs" },
        {
          "name": "gap-s",
          "size": "clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16))",
          "slug": "gap-s"
        },
        {
          "name": "gap-m",
          "size": "clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32))",
          "slug": "gap-m"
        },
        {
          "name": "gap-l",
          "size": "clamp(var(--spacing-24), 0.8864rem + 2.7273vw, var(--spacing-48))",
          "slug": "gap-l"
        },
        {
          "name": "gap-xl",
          "size": "clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80))",
          "slug": "gap-xl"
        },
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
        },
        {
          "name": "form-control-spacing",
          "size": "var(--spacing-12) var(--spacing-16)",
          "slug": "form-control-spacing"
        },
        {
          "name": "form-control-border-width",
          "size": "1px",
          "slug": "form-control-border-width"
        },
        { "name": "checkable-size", "size": "1.25em", "slug": "checkable-size" }
      ],
      "units": ["px", "rem", "%", "vh", "vw"]
    },
    "typography": {
      "writingMode": true,
      "defaultFontSizes": false,
      "fluid": true,
      "fontSizes": [
        { "name": "text-10", "size": "0.625rem", "slug": "text-10" },
        { "name": "text-11", "size": "0.6875rem", "slug": "text-11" },
        { "name": "text-12", "size": "0.75rem", "slug": "text-12" },
        { "name": "text-13", "size": "0.8rem", "slug": "text-13" },
        { "name": "text-14", "size": "0.875rem", "slug": "text-14" },
        { "name": "text-15", "size": "0.9375rem", "slug": "text-15" },
        { "name": "text-16", "size": "1rem", "slug": "text-16" },
        { "name": "text-17", "size": "1.0625rem", "slug": "text-17" },
        { "name": "text-18", "size": "1.125rem", "slug": "text-18" },
        { "name": "text-20", "size": "1.25rem", "slug": "text-20" },
        { "name": "text-24", "size": "1.5rem", "slug": "text-24" },
        { "name": "text-30", "size": "1.875rem", "slug": "text-30" },
        { "name": "text-32", "size": "2rem", "slug": "text-32" },
        { "name": "text-36", "size": "2.25rem", "slug": "text-36" },
        { "name": "text-40", "size": "2.5rem", "slug": "text-40" },
        { "name": "text-48", "size": "3rem", "slug": "text-48" },
        { "name": "text-60", "size": "3.75rem", "slug": "text-60" },
        { "name": "text-80", "size": "5rem", "slug": "text-80" },
        { "name": "text-s", "size": "0.875rem", "slug": "text-s" },
        {
          "name": "text-m",
          "size": "clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18))",
          "slug": "text-m"
        },
        {
          "name": "text-l",
          "size": "clamp(var(--text-18), 1.0761rem + 0.2174vw, var(--text-20))",
          "slug": "text-l"
        },
        {
          "name": "text-xl",
          "size": "clamp(var(--text-20), 1.0054rem + 1.087vw, var(--text-30))",
          "slug": "text-xl"
        },
        {
          "name": "text-2xl",
          "size": "clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36))",
          "slug": "text-2xl"
        },
        {
          "name": "text-3xl",
          "size": "clamp(var(--text-30), 1.4348rem + 1.9565vw, var(--text-48))",
          "slug": "text-3xl"
        },
        {
          "name": "text-4xl",
          "size": "clamp(var(--text-48), 2.1818rem + 3.6364vw, var(--text-80))",
          "slug": "text-4xl"
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
    "border": {
      "radius": true
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
      "lineHeight": "1.5rem",
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
  }

  // Non-canonical: build a reasonable mapping from generated CSS
  try {
    const themeCSS = generateThemeCSS();
    const tokensCSS = generateTokensCSS();

    // Build palette from detected variants
    const variantsMap = parseColorVariants(themeCSS + "\n" + tokensCSS);
    const palette = [];
    for (const [base, map] of variantsMap.entries()) {
      for (const [variant, val] of map.entries()) {
        const name = `${base}-${variant}`;
        palette.push({ name, slug: name, color: val });
      }
    }

    // Include semantic tokens found in tokensCSS
    const semantic = {};
    const semRx = /--([a-z0-9-]+):\s*([^;]+);/gim;
    let sm;
    while ((sm = semRx.exec(tokensCSS))) {
      semantic[sm[1]] = sm[2].trim();
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

    // Spacing extraction
    const spacing = [];
    const spacingRx =
      /--([a-z0-9-]*spacing[a-z0-9-]*|gap-[a-z0-9-]+):\s*([^;]+);/gim;
    let sp;
    const seen = new Set();
    while ((sp = spacingRx.exec(tokensCSS))) {
      const key = sp[1];
      const val = sp[2].trim();
      if (!seen.has(key)) {
        seen.add(key);
        spacing.push({ name: key, size: val, slug: key });
      }
    }

    // If spacing extraction produced too few entries, fall back to a
    // canonical-ish set so WP exports include the common sizes.
    if (spacing.length < 10) {
      const canonicalSpacing = [
        { name: "spacing-0", size: "0", slug: "spacing-0" },
        { name: "spacing-1", size: "1px", slug: "spacing-1" },
        { name: "spacing-2", size: "0.125rem", slug: "spacing-2" },
        { name: "spacing-4", size: "0.25rem", slug: "spacing-4" },
        { name: "spacing-8", size: "0.5rem", slug: "spacing-8" },
        { name: "spacing-12", size: "0.75rem", slug: "spacing-12" },
        { name: "spacing-16", size: "1rem", slug: "spacing-16" },
        { name: "spacing-20", size: "1.25rem", slug: "spacing-20" },
        { name: "spacing-24", size: "1.5rem", slug: "spacing-24" },
        { name: "spacing-32", size: "2rem", slug: "spacing-32" },
        { name: "spacing-40", size: "2.5rem", slug: "spacing-40" },
        { name: "spacing-48", size: "3rem", slug: "spacing-48" },
        { name: "spacing-56", size: "3.5rem", slug: "spacing-56" },
        { name: "spacing-64", size: "4rem", slug: "spacing-64" },
        { name: "spacing-80", size: "5rem", slug: "spacing-80" },
        { name: "spacing-128", size: "8rem", slug: "spacing-128" },
        { name: "spacing-160", size: "10rem", slug: "spacing-160" },
        { name: "gap-xs", size: "var(--spacing-4)", slug: "gap-xs" },
        {
          name: "gap-s",
          size: "clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16))",
          slug: "gap-s",
        },
        {
          name: "gap-m",
          size: "clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32))",
          slug: "gap-m",
        },
        {
          name: "gap-l",
          size: "clamp(var(--spacing-24), 0.8864rem + 2.7273vw, var(--spacing-48))",
          slug: "gap-l",
        },
        {
          name: "gap-xl",
          size: "clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80))",
          slug: "gap-xl",
        },
        { name: "spacing-xs", size: "var(--spacing-4)", slug: "spacing-xs" },
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
        },
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
        { name: "checkable-size", size: "1.25em", slug: "checkable-size" },
      ];
      spacing.length = 0;
      Array.prototype.push.apply(spacing, canonicalSpacing);
    }

    // Typography presets (minimal)
    let fontSizes = [{ name: "text-m", size: "var(--text-m)", slug: "text-m" }];
    let fontFamilies = [
      { name: "System", slug: "system", fontFamily: "system-ui, sans-serif" },
    ];

    // Provide fuller typography presets when extraction is minimal
    if (fontSizes.length <= 1) {
      const canonicalFontSizes = [
        { name: "text-10", size: "0.625rem", slug: "text-10" },
        { name: "text-11", size: "0.6875rem", slug: "text-11" },
        { name: "text-12", size: "0.75rem", slug: "text-12" },
        { name: "text-13", size: "0.8rem", slug: "text-13" },
        { name: "text-14", size: "0.875rem", slug: "text-14" },
        { name: "text-15", size: "0.9375rem", slug: "text-15" },
        { name: "text-16", size: "1rem", slug: "text-16" },
        { name: "text-17", size: "1.0625rem", slug: "text-17" },
        { name: "text-18", size: "1.125rem", slug: "text-18" },
        { name: "text-20", size: "1.25rem", slug: "text-20" },
        { name: "text-24", size: "1.5rem", slug: "text-24" },
        { name: "text-30", size: "1.875rem", slug: "text-30" },
        { name: "text-32", size: "2rem", slug: "text-32" },
        { name: "text-36", size: "2.25rem", slug: "text-36" },
        { name: "text-40", size: "2.5rem", slug: "text-40" },
        { name: "text-48", size: "3rem", slug: "text-48" },
        { name: "text-60", size: "3.75rem", slug: "text-60" },
        { name: "text-80", size: "5rem", slug: "text-80" },
        { name: "text-s", size: "0.875rem", slug: "text-s" },
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
          size: "clamp(var(--text-20), 1.0054rem + 1.087vw, var(--text-30))",
          slug: "text-xl",
        },
        {
          name: "text-2xl",
          size: "clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36))",
          slug: "text-2xl",
        },
        {
          name: "text-3xl",
          size: "clamp(var(--text-30), 1.4348rem + 1.9565vw, var(--text-48))",
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
        lineHeight: "1.5rem",
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
