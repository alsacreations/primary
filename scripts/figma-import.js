#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";

// Resolve repo root reliably
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
let samplesDir = path.join(ROOT, "public", "samples", "figma-tokens");
let outDir = path.join(ROOT, "tmp");

function setPaths({ samplesDir: s, outDir: o } = {}) {
  if (s) samplesDir = s;
  if (o) outDir = o;
}

// Color conversion: sRGB (0..1) -> OKLab -> OKLCH
function srgbToLinear(v) {
  // v in 0..1
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearRgbToOklab(r, g, b) {
  // matrices from OKLab specification (Björn Ottosson)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { L, a, b: b_ };
}

function oklabToOklch(L, a, b) {
  const C = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI); // degrees
  if (h < 0) h += 360;
  return { L, C, h };
}

function figmaColorToCss(c) {
  // c: {r:0..1, g:0..1, b:0..1, a}
  const r = srgbToLinear(Number(c.r));
  const g = srgbToLinear(Number(c.g));
  const b = srgbToLinear(Number(c.b));

  const { L, a, b: bb } = linearRgbToOklab(r, g, b);
  const { C, h } = oklabToOklch(L, a, bb);

  // Output OKLCH without units: L in 0..1, C numeric, h numeric (degrees as number)
  const Lstr = formatNumber(L);
  const Cstr = formatNumber(C);
  const Hstr = formatNumber(h);

  const alpha = typeof c.a === "number" ? formatNumber(c.a) : null;
  const base = `oklch(${Lstr} ${Cstr} ${Hstr}`;
  return alpha && alpha !== "1" ? `${base} / ${alpha})` : base + `)`;
}

function formatNumber(n) {
  // keep up to 4 decimals, but trim trailing zeros
  const s = Number(n).toFixed(4);
  // remove trailing zeros and optional trailing dot
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function pxToRem(px) {
  const rem = Number(px) / 16;
  // For zero values, return unitless 0; otherwise rem with unit
  if (Number(px) === 0) return "0";
  return formatNumber(rem) + "rem";
}

function remOrZero(remValue) {
  // remValue is a number in rem
  if (Number(remValue) === 0) return "0";
  return formatNumber(remValue) + "rem";
}

function sanitizeVarName(name) {
  // Figma names like "color/gray/900" -> --color-gray-900
  let sanitized = name.replace(/\//g, "-").replace(/\s+/g, "-").toLowerCase();
  // Cas spécial : "colors/..." doit devenir "color-..." (singulier)
  // pour correspondre à la convention de nommage des primitives
  if (sanitized.startsWith("colors-")) {
    sanitized = "color-" + sanitized.slice(7);
  }
  return "--" + sanitized;
}

function fontVarName(figmaName) {
  // FontSize/text-m -> --text-m
  const parts = figmaName.split("/");
  const last = parts[parts.length - 1];
  return "--" + last.replace(/\s+/g, "-").toLowerCase();
}

function clampBetween(minRem, maxRem, wMin = 360, wMax = 1280) {
  // minRem, maxRem are numbers in rem
  // Use Utopia-style calculation to produce "Crem + Dvw" preferred value.
  if (minRem === maxRem) return formatNumber(minRem) + "rem";
  const D = ((maxRem - minRem) * 1600) / (wMax - wMin); // coefficient for vw
  const C = minRem - (D * wMin) / 1600;
  return `clamp(${formatNumber(minRem)}rem, ${formatNumber(
    C
  )}rem + ${formatNumber(D)}vw, ${formatNumber(maxRem)}rem)`;
}

async function readJson(file) {
  const txt = await fs.readFile(file, "utf8");
  return JSON.parse(txt);
}

async function generate() {
  await fs.mkdir(outDir, { recursive: true });

  const primitivesPath = path.join(samplesDir, "Primitives.json");
  const fontPath = path.join(samplesDir, "Token Font.json");

  const primitives = await readJson(primitivesPath);
  const fonts = await readJson(fontPath);

  // theme.css generation (primitives)
  // theme.css generation (primitives) - collect by category then print grouped blocks
  let themeCss = `/* ----------------------------------\n * Theme du projet (valeurs primitives)\n * ----------------------------------\n */\n:root {\n`;

  // Ensure breakpoints always present at the top of :root
  themeCss += `  /* Breakpoints (en dur) */\n`;
  themeCss += `  --md: 48rem; /* 768px */\n`;
  themeCss += `  --lg: 64rem; /* 1024px */\n`;
  themeCss += `  --xl: 80rem; /* 1280px */\n`;
  themeCss += `  --xxl: 96rem; /* 1536px */\n\n`;

  const colors = [];
  const spacings = [];
  const roundeds = [];
  const others = [];
  const lineheightPrimitives = [];

  // Stocker la correspondance nom sémantique → nom primitif pour theme-tokens.css
  const spacingSemanticMap = new Map();

  // alias-aware prefixes
  const spacingPrefixes = new Set(["spacing", "space", "gap"]);
  const roundedPrefixes = new Set(["rounded", "radius", "border-radius"]);

  for (const v of primitives.variables || []) {
    const name = v.name || "";
    if (v.type === "COLOR") {
      const modeKey = Object.keys(v.valuesByMode || {})[0];
      const val = v.valuesByMode[modeKey];
      const css = figmaColorToCss(val);
      colors.push({ name, css });
    } else if (v.type === "FLOAT") {
      const modeKey = Object.keys(v.valuesByMode || {})[0];
      const px = v.valuesByMode[modeKey];
      // detect prefix (first segment before '/') and be tolerant to alias names
      const first = (name.split("/")[0] || "").toLowerCase();
      if (spacingPrefixes.has(first)) {
        spacings.push({ name, px });
      } else if (roundedPrefixes.has(first)) {
        roundeds.push({ name, px });
      } else if (/(^line[- ]?height$|^leading$)/i.test(first)) {
        // Normalize any Line-height / LineHeight / leading primitives into
        // explicit --line-height-<px> primitives (keep px value for sorting).
        lineheightPrimitives.push({ name, px });
      } else if (name.toLowerCase().startsWith("fontsize/")) {
        // skip font-size tokens here (handled in Token Font.json)
      } else {
        others.push({ name, px });
      }
    }
  }

  // helper to sort by variable name
  const sortByName = (a, b) => a.name.localeCompare(b.name, "en");

  // Colors block
  if (colors.length) {
    // group colors semantically: gray, error, success, warning, info, then others
    const groups = {
      gray: [],
      error: [],
      success: [],
      warning: [],
      info: [],
      others: [],
    };
    for (const c of colors) {
      const parts = c.name.split("/").map((p) => p.toLowerCase());
      // expect names like color/gray/900 or color/error/500
      const semantic = parts[1] || "";
      if (semantic === "gray") groups.gray.push(c);
      else if (semantic === "error") groups.error.push(c);
      else if (semantic === "success") groups.success.push(c);
      else if (semantic === "warning") groups.warning.push(c);
      else if (semantic === "info") groups.info.push(c);
      else groups.others.push(c);
    }

    themeCss += `\n  /* Couleurs globales */\n`;
    // Emit group with numeric-suffix-aware sorting so that --color-*-50 comes before --color-*-100
    const emitGroup = (arr) => {
      const numericSuffix = (varName) => {
        const n = sanitizeVarName(varName);
        const m = n.match(/-(\d+)$/);
        return m ? Number(m[1]) : null;
      };
      arr
        .sort((a, b) => {
          const na = sanitizeVarName(a.name);
          const nb = sanitizeVarName(b.name);
          const aa = numericSuffix(a.name);
          const bb = numericSuffix(b.name);
          if (aa !== null && bb !== null) return aa - bb;
          if (aa !== null) return -1;
          if (bb !== null) return 1;
          return na.localeCompare(nb, "en");
        })
        .forEach((c) => {
          themeCss += `  ${sanitizeVarName(c.name)}: ${c.css};\n`;
        });
    };

    // Emit gray first
    // Ensure white and black primitives always present and placed before gray
    const hasWhite = colors.some(
      (c) => sanitizeVarName(c.name) === "--color-white"
    );
    const hasBlack = colors.some(
      (c) => sanitizeVarName(c.name) === "--color-black"
    );
    if (!hasWhite) themeCss += `  --color-white: oklch(1 0 0);\n`;
    if (!hasBlack) themeCss += `  --color-black: oklch(0 0 0);\n`;

    emitGroup(groups.gray);
    // Then semantic groups in order
    emitGroup(groups.error);
    emitGroup(groups.success);
    emitGroup(groups.warning);
    emitGroup(groups.info);
    // Then any other colors
    emitGroup(groups.others);
    // Build a quick map of emitted color primitives -> raw OKLCH values so that
    // project palette entries that alias existing color tokens can be resolved
    // to their underlying raw values (we must NOT emit var(...) inside theme.css
    // primitives; theme.css must contain only raw primitives).
    const colorMap = {};
    colors.forEach((c) => {
      const varName = sanitizeVarName(c.name);
      colorMap[varName] = c.css;
    });
    if (!hasWhite) colorMap["--color-white"] = "oklch(1 0 0)";
    if (!hasBlack) colorMap["--color-black"] = "oklch(0 0 0)";

    // If a Token colors file is present in the samples, import project palette
    // and emit both primitives into themeCss and semantic tokens into tokensCss.
    try {
      const tokenColorsPath = path.join(samplesDir, "Token colors.json");
      const tokenColors = await readJson(tokenColorsPath);
      const modeMap = tokenColors.modes || {};
      // invert modeMap to find light/dark keys
      let lightModeId = null;
      let darkModeId = null;
      for (const k of Object.keys(modeMap)) {
        if (modeMap[k] === "light") lightModeId = k;
        if (modeMap[k] === "dark") darkModeId = k;
      }
      // fallback to first/second if explicit keys missing
      const modeKeys = Object.keys(modeMap);
      if (!lightModeId && modeKeys.length) lightModeId = modeKeys[0];
      if (!darkModeId && modeKeys.length > 1) darkModeId = modeKeys[1];

      const projectSemantics = [];
      // collect synthesized primitives in a map varName -> rawValue
      const synthesizedMap = {};
      let needColorScheme = false;

      const toVarNameFromAlias = (alias) => {
        if (!alias) return null;
        // already a CSS var name
        if (/^--/.test(alias)) return alias;
        // if it's a var(...) string, extract the inner var name
        const m = String(alias).match(/var\(\s*(--[a-z0-9-]+)\s*\)/i);
        if (m) return m[1];
        // otherwise sanitize the Figma-style name
        return sanitizeVarName(alias);
      };

      for (const v of tokenColors.variables || []) {
        const rawName = (v.name || "").toLowerCase().replace(/\s+/g, "-");
        const primLightName = `--color-${rawName}-light`;
        const primDarkName = `--color-${rawName}-dark`;
        if (rawName === "primary") {
          // primary token inspected for resolved values (kept silent in normal runs)
        }

        const rvLight =
          v.resolvedValuesByMode && v.resolvedValuesByMode[lightModeId];
        const rvDark = darkModeId
          ? v.resolvedValuesByMode && v.resolvedValuesByMode[darkModeId]
          : null;

        // derive primitive reference: prefer aliasName mapping to existing primitive
        // else synthesize a primitive for the resolvedValue and emit it into themeCss
        let lightPrim = null;
        if (rawName === "primary") {
          // primary resolvedValues are available in rvLight / rvDark if present
        }
        if (rvLight && rvLight.aliasName) {
          const aliasVar = sanitizeVarName(rvLight.aliasName);
          lightPrim = aliasVar;
          // if the aliased primitive is not present in our colorMap, try to
          // resolve it from primitives.variables or from the resolvedValue
          if (!colorMap[aliasVar]) {
            // If the aliased primitive was not present, synthesize it from the
            // token's resolvedValue when available. This ensures theme.css
            // contains base primitives like --color-blue-500.
            if (rvLight && rvLight.resolvedValue) {
              const raw = figmaColorToCss(rvLight.resolvedValue);
              synthesizedMap[aliasVar] = raw;
              colorMap[aliasVar] = raw;
            }
          }
        } else if (rvLight && rvLight.resolvedValue) {
          lightPrim = `--color-${rawName}-light`;
          const raw = figmaColorToCss(rvLight.resolvedValue);
          if (!colorMap[lightPrim]) {
            synthesizedMap[lightPrim] = raw;
            colorMap[lightPrim] = raw;
          }
        }

        let darkPrim = null;
        if (rvDark && rvDark.aliasName) {
          const aliasVar = sanitizeVarName(rvDark.aliasName);
          darkPrim = aliasVar;
          if (!colorMap[aliasVar]) {
            if (rvDark && rvDark.resolvedValue) {
              const raw = figmaColorToCss(rvDark.resolvedValue);
              synthesizedMap[aliasVar] = raw;
              colorMap[aliasVar] = raw;
            }
          }
        } else if (rvDark && rvDark.resolvedValue) {
          darkPrim = `--color-${rawName}-dark`;
          const raw = figmaColorToCss(rvDark.resolvedValue);
          if (!colorMap[darkPrim]) {
            synthesizedMap[darkPrim] = raw;
            colorMap[darkPrim] = raw;
          }
        }

        // resolved primitives for this token (kept internal)

        // semantic token should reference primitive variables (existing or synthesized)
        if (darkPrim) {
          needColorScheme = true;
          projectSemantics.push(
            `  --${rawName}: light-dark(var(${lightPrim}), var(${darkPrim}));`
          );
        } else if (lightPrim) {
          projectSemantics.push(`  --${rawName}: var(${lightPrim});`);
        }
      }

      const synthKeys = Object.keys(synthesizedMap || {});
      if (synthKeys.length) {
        // sort synthesized keys with numeric-suffix-aware ordering similar to emitGroup
        synthKeys.sort((a, b) => {
          // Sort by base name (family) then numeric suffix when present.
          // a/b are like --color-blue-500
          const na = a.replace(/^--/, "");
          const nb = b.replace(/^--/, "");
          const ma = na.match(/^(.*?)-(\d+)$/);
          const mb = nb.match(/^(.*?)-(\d+)$/);
          const baseA = ma ? ma[1] : na;
          const baseB = mb ? mb[1] : nb;
          if (baseA !== baseB) return baseA.localeCompare(baseB, "en");
          // same base, compare numeric suffix if present
          if (ma && mb) return Number(ma[2]) - Number(mb[2]);
          if (ma) return -1; // numbers come before non-numeric variants of same base
          if (mb) return 1;
          return na.localeCompare(nb, "en");
        });
        themeCss += `\n  /* Couleurs personnalisées (projet) - primitives synthétisées */\n`;
        for (const k of synthKeys) {
          themeCss += `  ${k}: ${synthesizedMap[k]};\n`;
        }
      }
      if (projectSemantics.length) {
        generate._projectSemantics = generate._projectSemantics || [];
        generate._projectSemantics.push({
          lines: projectSemantics,
          needColorScheme,
        });
      }
      // project debug dump intentionally omitted in normal runs
    } catch (e) {
      // no token colors present — ignore
    }
  }

  // Spacing block (sort by numeric value)
  if (spacings.length) {
    themeCss += `\n  /* Espacements */\n`;
    spacings
      .sort((a, b) => Number(a.px) - Number(b.px))
      .forEach((s) => {
        const px = Math.round(Number(s.px));
        const primitiveName = `--spacing-${px}`;
        const semanticName = sanitizeVarName(s.name);

        // Stocker la correspondance pour theme-tokens.css
        if (semanticName !== primitiveName) {
          spacingSemanticMap.set(semanticName, primitiveName);
        }

        // Émettre uniquement le nom primitif dans theme.css
        themeCss += `  ${primitiveName}: ${pxToRem(s.px)};\n`;
      });
  }

  // Rounded block (sort by numeric value)
  if (roundeds.length) {
    themeCss += `\n  /* Border radius */\n`;
    roundeds
      .sort((a, b) => Number(a.px) - Number(b.px))
      .forEach((r) => {
        const px = Math.round(Number(r.px));
        // Cas spéciaux : 0 -> none, >= 9999 -> full
        let name;
        let value;
        if (px === 0) {
          name = `--radius-none`;
          value = "0";
        } else if (px >= 9999) {
          name = `--radius-full`;
          value = "9999px";
        } else {
          name = `--radius-${px}`;
          value = pxToRem(r.px);
        }
        themeCss += `  ${name}: ${value};\n`;
      });
  }

  // Line-height primitives (from Primitives.json) — normalize to --line-height-<px>
  if (lineheightPrimitives.length) {
    themeCss += `\n  /* Interlignage (line-height) */\n`;
    lineheightPrimitives
      .sort((a, b) => Number(a.px) - Number(b.px))
      .forEach((lh) => {
        const px = Math.round(Number(lh.px));
        const name = `--line-height-${px}`;
        themeCss += `  ${name}: ${pxToRem(lh.px)};\n`;
      });
  }

  // Others (fallback)
  if (others.length) {
    themeCss += `\n  /* Others */\n`;
    others.sort(sortByName).forEach((o) => {
      themeCss += `  ${sanitizeVarName(o.name)}: ${o.px};\n`;
    });
  }

  // NOTE: do not close themeCss yet — we will append font size primitives later

  // theme-tokens.css generation (fonts responsive) — collect, sort by min value, then emit grouped blocks
  let tokensCss = `/* ----------------------------------\n * Theme-tokens\n * Surcouche de theme.css\n * ----------------------------------\n */\n:root {\n`;
  // If project semantics were prepared while emitting themeCss, inject them here.
  // capture whether any project token required a light/dark scheme so we can
  // conditionally emit light-dark() in other semantic blocks (forms etc.).
  let projectNeedColorScheme = false;
  if (generate._projectSemantics && generate._projectSemantics.length) {
    const all = generate._projectSemantics.reduce(
      (acc, cur) => {
        if (cur.lines && cur.lines.length) acc.lines.push(...cur.lines);
        if (cur.needColorScheme) acc.needColorScheme = true;
        return acc;
      },
      { lines: [], needColorScheme: false }
    );

    projectNeedColorScheme = Boolean(all.needColorScheme);

    if (all.needColorScheme) {
      const cs = `  color-scheme: light dark;\n\n  &[data-theme="light"] {\n    color-scheme: light;\n  }\n\n  &[data-theme="dark"] {\n    color-scheme: dark;\n  }\n\n`;
      tokensCss = tokensCss.replace(":root {\n", `:root {\n${cs}`);
    }

    if (all.lines.length) {
      tokensCss += `\n  /* Couleurs personnalisées (projet) */\n`;
      tokensCss += all.lines.join("\n") + "\n";
    }
  }

  const fontSizes = [];
  const lineHeights = [];

  for (const v of fonts.variables || []) {
    const name = v.name || "";
    // tolerant detection for font size / line-height prefixes (case-insensitive / aliases)
    const first = (name.split("/")[0] || "").toLowerCase();
    const fontSizePrefixes = new Set([
      "fontsize",
      "font-size",
      "text",
      "textsize",
    ]);
    const lineHeightPrefixes = new Set([
      "lineheight",
      "line-height",
      "leading",
    ]);

    if (
      fontSizePrefixes.has(first) ||
      name.toLowerCase().startsWith("fontsize/")
    ) {
      const varName = fontVarName(name);
      const modes = Object.keys(v.resolvedValuesByMode || {});
      const mobileKey = modes[0];
      const desktopKey = modes[1] || mobileKey;
      const mobileVal =
        v.resolvedValuesByMode[mobileKey] &&
        v.resolvedValuesByMode[mobileKey].resolvedValue;
      const desktopVal =
        v.resolvedValuesByMode[desktopKey] &&
        v.resolvedValuesByMode[desktopKey].resolvedValue;
      if (typeof mobileVal === "number" && typeof desktopVal === "number") {
        fontSizes.push({
          varName,
          minRem: mobileVal / 16,
          maxRem: desktopVal / 16,
        });
      }
    }
    if (
      lineHeightPrefixes.has(first) ||
      name.toLowerCase().startsWith("lineheight/")
    ) {
      const rawLast = name.split("/").pop().toLowerCase().replace(/\s+/g, "-");
      const key = rawLast.replace(/^(lineheight|line-height|leading)-?/, "");
      const varName = `--line-height-${key}`;
      const modes = Object.keys(v.resolvedValuesByMode || {});
      const mobileKey = modes[0];
      const desktopKey = modes[1] || mobileKey;
      const mobileVal =
        v.resolvedValuesByMode[mobileKey] &&
        v.resolvedValuesByMode[mobileKey].resolvedValue;
      const desktopVal =
        v.resolvedValuesByMode[desktopKey] &&
        v.resolvedValuesByMode[desktopKey].resolvedValue;
      if (typeof mobileVal === "number" && typeof desktopVal === "number") {
        lineHeights.push({
          varName,
          minRem: mobileVal / 16,
          maxRem: desktopVal / 16,
        });
      }
    }
  }

  // sort ascending by minRem
  fontSizes.sort((a, b) => a.minRem - b.minRem);
  lineHeights.sort((a, b) => a.minRem - b.minRem);

  // Convert -min/-max values into primitives to emit into theme.css
  const fontPrimitives = [];
  const linePrimitives = [];

  for (const f of fontSizes) {
    const partsF = f.varName.slice(2).split("-");
    let prefix = partsF.slice(0, partsF.length - 1).join("-") || partsF[0];
    // normalize common prefixes (line-height / leading -> line-height)
    if (/^(lineheight|line-height|leading)$/i.test(prefix))
      prefix = "line-height";
    if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text";
    const minPx = Math.round(f.minRem * 16);
    const maxPx = Math.round(f.maxRem * 16);
    fontPrimitives.push({
      name: `--${prefix}-${minPx}`,
      rem: formatNumber(f.minRem) + "rem",
      px: minPx,
    });
    fontPrimitives.push({
      name: `--${prefix}-${maxPx}`,
      rem: formatNumber(f.maxRem) + "rem",
      px: maxPx,
    });
  }

  for (const lh of lineHeights) {
    const partsL = lh.varName.slice(2).split("-");
    let prefix = partsL.slice(0, partsL.length - 1).join("-") || partsL[0];
    if (/^(lineheight|line-height|leading)$/i.test(prefix))
      prefix = "line-height";
    if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text";
    const minPx = Math.round(lh.minRem * 16);
    const maxPx = Math.round(lh.maxRem * 16);
    linePrimitives.push({
      name: `--${prefix}-${minPx}`,
      rem: formatNumber(lh.minRem) + "rem",
      px: minPx,
    });
    linePrimitives.push({
      name: `--${prefix}-${maxPx}`,
      rem: formatNumber(lh.maxRem) + "rem",
      px: maxPx,
    });
  }

  // emit font size primitives into themeCss under /* Font sizes */
  if (fontPrimitives.length) {
    const seenFont = new Set();
    fontPrimitives.sort((a, b) => a.px - b.px);
    themeCss += `\n  /* Typographie — Tailles de police */\n`;
    for (const p of fontPrimitives) {
      if (seenFont.has(p.name)) continue;
      seenFont.add(p.name);
      themeCss += `  ${p.name}: ${p.rem};\n`;
    }
  }

  // Ensure generic font families and font-weight tokens are present under the
  // "Typographie — Tailles de police" section. Add only missing entries.
  const families = [
    { name: "--font-base", value: "system-ui, sans-serif" },
    { name: "--font-mono", value: "ui-monospace, monospace" },
  ];
  const weights = [
    { name: "--font-weight-regular", value: "400" },
    { name: "--font-weight-semibold", value: "600" },
    { name: "--font-weight-bold", value: "700" },
    { name: "--font-weight-extrabold", value: "800" },
    { name: "--font-weight-black", value: "900" },
  ];

  // Only add header if at least one entry is missing
  const missingFamily = families.some(
    (f) => !new RegExp(`${f.name}\s*:`).test(themeCss)
  );
  const missingWeight = weights.some(
    (w) => !new RegExp(`${w.name}\s*:`).test(themeCss)
  );
  if (missingFamily || missingWeight) {
    themeCss += `\n  /* Typographie - Familles de police */\n`;
    for (const f of families) {
      if (!new RegExp(`${f.name}\s*:`).test(themeCss)) {
        themeCss += `  ${f.name}: ${f.value};\n`;
      }
    }
    themeCss += `\n  /* Typographie - Graisses de police */\n`;
    for (const w of weights) {
      if (!new RegExp(`${w.name}\s*:`).test(themeCss)) {
        themeCss += `  ${w.name}: ${w.value};\n`;
      }
    }
  }

  // emit line-height primitives into themeCss under /* Line heights */
  if (linePrimitives.length) {
    const seenLine = new Set();
    linePrimitives.sort((a, b) => a.px - b.px);
    themeCss += `\n  /* Typographie — Hauteurs de lignes */\n`;
    for (const p of linePrimitives) {
      if (seenLine.has(p.name)) continue;
      seenLine.add(p.name);
      themeCss += `  ${p.name}: ${p.rem};\n`;
    }
  }

  // Ensure transitions and z-index variables are present at the end of :root
  const ensureVar = (name) => new RegExp(`${name}\s*:`).test(themeCss);
  const missingTransitions = [];
  if (!ensureVar("--transition-duration"))
    missingTransitions.push(`  --transition-duration: 0.25s;`);

  const missingZ = [];
  if (!ensureVar("--z-under-page-level"))
    missingZ.push(`  --z-under-page-level: -1;`);
  if (!ensureVar("--z-above-page-level"))
    missingZ.push(`  --z-above-page-level: 1;`);
  if (!ensureVar("--z-header-level"))
    missingZ.push(`  --z-header-level: 1000;`);
  if (!ensureVar("--z-above-header-level"))
    missingZ.push(`  --z-above-header-level: 2000;`);
  if (!ensureVar("--z-above-all-level"))
    missingZ.push(`  --z-above-all-level: 3000;`);

  if (missingTransitions.length || missingZ.length) {
    themeCss += `\n  /* Transitions et animations */\n`;
    missingTransitions.forEach((l) => (themeCss += l + "\n"));
    themeCss += `\n  /* Niveaux de z-index */\n`;
    missingZ.forEach((l) => (themeCss += l + "\n"));
  }

  themeCss += `\n}\n`;
  // build a lookup set of primitives we just emitted for validation
  // normalize excessive blank lines (collapse 3+ newlines into 2)
  themeCss = themeCss.replace(/\n{3,}/g, "\n\n");

  // Intermediate debug file omitted in normal runs

  // build a lookup set of primitives we just emitted for validation
  // parse the emitted themeCss — this is the single source of truth
  const primitiveNames = new Set();
  const varRe = /^\s*(--[a-z0-9-]+)\s*:/gim;
  let vm;
  while ((vm = varRe.exec(themeCss)) !== null) {
    primitiveNames.add(vm[1]);
  }

  function preferredValue(minRem, maxRem, wMin = 360, wMax = 1280) {
    if (minRem === maxRem) return formatNumber(minRem) + "rem";
    const D = ((maxRem - minRem) * 1600) / (wMax - wMin);
    const C = minRem - (D * wMin) / 1600;
    return `${formatNumber(C)}rem + ${formatNumber(D)}vw`;
  }

  // Typography — font sizes (only emit fluid clamp variables here, with primitives refs)
  if (fontSizes.length) {
    tokensCss += `\n  /* Typographie — Tailles de police */\n`;
    for (const f of fontSizes) {
      const partsFtok = f.varName.slice(2).split("-");
      let prefix =
        partsFtok.slice(0, partsFtok.length - 1).join("-") || partsFtok[0];
      if (/^(lineheight|line-height|leading)$/i.test(prefix))
        prefix = "line-height";
      if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text";
      const minPx = Math.round(f.minRem * 16);
      const maxPx = Math.round(f.maxRem * 16);
      const minName = `--${prefix}-${minPx}`;
      const maxName = `--${prefix}-${maxPx}`;
      const minPart = primitiveNames.has(minName)
        ? `var(${minName})`
        : `${formatNumber(f.minRem)}rem`;
      const maxPart = primitiveNames.has(maxName)
        ? `var(${maxName})`
        : `${formatNumber(f.maxRem)}rem`;
      if (!primitiveNames.has(minName) || !primitiveNames.has(maxName)) {
        console.warn(
          `Missing primitive for ${f.varName}: ${
            !primitiveNames.has(minName) ? minName : ""
          } ${!primitiveNames.has(maxName) ? maxName : ""}`
        );
      }
      const middle = preferredValue(f.minRem, f.maxRem);
      tokensCss += `  ${f.varName}: clamp(${minPart}, ${middle}, ${maxPart});\n`;
    }
  }

  // Typography — line heights (emit clamps referencing primitives)
  if (lineHeights.length) {
    tokensCss += `\n  /* Typographie — Hauteurs de lignes */\n`;
    for (const lh of lineHeights) {
      const partsLtok = lh.varName.slice(2).split("-");
      let prefix =
        partsLtok.slice(0, partsLtok.length - 1).join("-") || partsLtok[0];
      if (/^(lineheight|line-height|leading)$/i.test(prefix))
        prefix = "line-height";
      if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text";
      const minPx = Math.round(lh.minRem * 16);
      const maxPx = Math.round(lh.maxRem * 16);
      const minName = `--${prefix}-${minPx}`;
      const maxName = `--${prefix}-${maxPx}`;
      const minPart = primitiveNames.has(minName)
        ? `var(${minName})`
        : `${formatNumber(lh.minRem)}rem`;
      const maxPart = primitiveNames.has(maxName)
        ? `var(${maxName})`
        : `${formatNumber(lh.maxRem)}rem`;
      if (!primitiveNames.has(minName) || !primitiveNames.has(maxName)) {
        console.warn(
          `Missing primitive for ${lh.varName}: ${
            !primitiveNames.has(minName) ? minName : ""
          } ${!primitiveNames.has(maxName) ? maxName : ""}`
        );
      }
      const middle = preferredValue(lh.minRem, lh.maxRem);
      tokensCss += `  ${lh.varName}: clamp(${minPart}, ${middle}, ${maxPart});\n`;
    }
  }

  // Espacements sémantiques (ex : --spacing-s, --spacing-m, ...)
  // On n'ajoute chaque variable sémantique QUE si les primitives min et max existent.
  // Support des préfixes tolérants : --spacing-, --space-, --gap-
  const spacingMap = new Map();
  for (const s of spacings) {
    const px = Math.round(Number(s.px));
    spacingMap.set(px, {
      name: sanitizeVarName(s.name),
      rem: Number(s.px) / 16,
    });
  }

  const findSpacingVar = (n) => {
    const candidates = [`--spacing-${n}`, `--space-${n}`, `--gap-${n}`];
    return candidates.find((c) => primitiveNames.has(c)) || null;
  };

  const emitSemanticSpacing = () => {
    const lines = [];
    // XS -> single primitive (4)
    const xsVar = findSpacingVar(4);
    if (xsVar) {
      lines.push(`  --spacing-xs: var(${xsVar});`);
    }

    // helper to emit clamp if both primitives exist and we can compute rems
    const emitClampIf = (label, minPx, maxPx) => {
      const minVar = findSpacingVar(minPx);
      const maxVar = findSpacingVar(maxPx);
      const minEntry = spacingMap.get(minPx);
      const maxEntry = spacingMap.get(maxPx);
      if (minVar && maxVar && minEntry && maxEntry) {
        const middle = preferredValue(minEntry.rem, maxEntry.rem);
        lines.push(
          `  --spacing-${label}: clamp(var(${minVar}), ${middle}, var(${maxVar}));`
        );
      }
    };

    // S: 8 -> 16
    emitClampIf("s", 8, 16);
    // M: 16 -> 32
    emitClampIf("m", 16, 32);
    // L: 24 -> 48
    emitClampIf("l", 24, 48);
    // XL: 32 -> 80
    emitClampIf("xl", 32, 80);

    if (lines.length) {
      tokensCss += `\n  /* Espacements */\n`;
      tokensCss += lines.join("\n") + "\n";
    }
  };

  emitSemanticSpacing();

  // Émettre les tokens sémantiques d'espacement venant de Figma
  if (spacingSemanticMap.size > 0) {
    if (!tokensCss.includes("/* Espacements */")) {
      tokensCss += `\n  /* Espacements */\n`;
    }
    // Trier par nom sémantique pour cohérence
    const sortedSemantics = Array.from(spacingSemanticMap.entries()).sort(
      (a, b) => a[0].localeCompare(b[0])
    );
    for (const [semanticName, primitiveName] of sortedSemantics) {
      tokensCss += `  ${semanticName}: var(${primitiveName});\n`;
    }
  }

  // Formulaires — placer ce bloc systématiquement à la fin de :root
  // Utiliser light-dark() uniquement si le projet propose à minima des
  // variantes light et dark (projectNeedColorScheme). Sinon, on choisit la
  // variante light par défaut.
  tokensCss += `\n  /* Formulaires */\n`;
  if (projectNeedColorScheme) {
    tokensCss += `  --form-control-background: light-dark(\n    var(--color-gray-200),\n    var(--color-gray-700)\n  );\n`;
    tokensCss += `  --on-form-control: light-dark(var(--color-gray-900), var(--color-gray-100));\n`;
  } else {
    // default to light variant if no dark modes available
    tokensCss += `  --form-control-background: var(--color-gray-200);\n`;
    tokensCss += `  --on-form-control: var(--color-gray-900);\n`;
  }
  tokensCss += `  --form-control-spacing: var(--spacing-12) var(--spacing-16);\n`;
  tokensCss += `  --form-control-border-width: 1px;\n`;
  tokensCss += `  --form-control-border-color: var(--color-gray-400);\n`;
  // choose a sensible fallback for --radius-m if it's not present in theme primitives
  (function () {
    const radiusCandidates = [
      "--radius-none",
      "--radius-4",
      "--radius-8",
      "--radius-12",
      "--radius-16",
      "--radius-24",
      "--radius-full",
    ];
    let chosen = radiusCandidates.find((r) => primitiveNames.has(r));
    if (!chosen) {
      // fallback to any emitted --radius-<number> if available
      chosen = Array.from(primitiveNames).find((n) => /^--radius-\d+$/.test(n));
    }
    if (!chosen) chosen = "--radius-none";
    tokensCss += `  --form-control-border-radius: var(${chosen});\n`;
  })();
  tokensCss += `  --checkables-border-color: var(--color-gray-400);\n`;
  tokensCss += `  --checkable-size: 1.25em;\n`;

  tokensCss += `\n}\n`;

  // normalize excessive blank lines in tokensCss (collapse 3+ newlines into 2)
  tokensCss = tokensCss.replace(/\n{3,}/g, "\n\n");

  // final validation: ensure every var(...) used in tokensCss references an emitted primitive
  const varUsageRe = /var\(\s*(--[a-z0-9-]+)\s*\)/g;
  const missing = new Set();
  let mu;
  while ((mu = varUsageRe.exec(tokensCss)) !== null) {
    if (!primitiveNames.has(mu[1])) missing.add(mu[1]);
  }
  if (missing.size) {
    console.error(
      "Aborting generation: theme-tokens.css references primitives not emitted in theme.css :",
      [...missing].join(", ")
    );
    process.exit(2);
  }

  // write outputs to tmp/
  await fs.writeFile(path.join(outDir, "theme.css"), themeCss, "utf8");
  await fs.writeFile(path.join(outDir, "theme-tokens.css"), tokensCss, "utf8");

  console.log("Generated tmp/theme.css and tmp/theme-tokens.css");
}
// Export generate() so other scripts (or tests) can call it programmatically.
// Export generate() so other scripts (or tests) can call it programmatically.
export { generate, setPaths };

// Provide a simple default API entrypoint for programmatic usage.
export default async function run(opts = {}) {
  // allow overriding the source/destination paths for testing or integration
  if (opts && (opts.samplesDir || opts.outDir)) setPaths(opts);
  return generate();
}

// If the script is executed directly, run the generator.
if (process.argv[1] && process.argv[1].endsWith("figma-import.js")) {
  generate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
