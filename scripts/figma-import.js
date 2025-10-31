#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";

// Resolve repo root reliably
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const samplesDir = path.join(ROOT, "public", "samples", "figma-tokens");
const outDir = path.join(ROOT, "tmp");

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
  return "--" + name.replace(/\//g, "-").replace(/\s+/g, "-").toLowerCase();
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

  const colors = [];
  const spacings = [];
  const roundeds = [];
  const others = [];

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
      } else if (
        name.startsWith("FontSize/") ||
        name.startsWith("LineHeight/")
      ) {
        // skip font tokens here
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

    themeCss += `\n  /* Couleurs */\n`;
    const emitGroup = (arr) => {
      arr.sort(sortByName).forEach((c) => {
        themeCss += `  ${sanitizeVarName(c.name)}: ${c.css};\n`;
      });
    };

    // Emit gray first
    emitGroup(groups.gray);
    // Then semantic groups in order
    emitGroup(groups.error);
    emitGroup(groups.success);
    emitGroup(groups.warning);
    emitGroup(groups.info);
    // Then any other colors
    emitGroup(groups.others);
  }

  // Spacing block (sort by numeric value)
  if (spacings.length) {
    themeCss += `\n  /* Espacements */\n`;
    spacings
      .sort((a, b) => Number(a.px) - Number(b.px))
      .forEach((s) => {
        themeCss += `  ${sanitizeVarName(s.name)}: ${pxToRem(s.px)};\n`;
      });
  }

  // Rounded block (sort by numeric value)
  if (roundeds.length) {
    themeCss += `\n  /* Border radius */\n`;
    roundeds
      .sort((a, b) => Number(a.px) - Number(b.px))
      .forEach((r) => {
        themeCss += `  ${sanitizeVarName(r.name)}: ${pxToRem(r.px)};\n`;
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
      const varName = "--" + name.split("/").pop().toLowerCase();
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
    const prefix = f.varName.slice(2).split("-")[0];
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
    const prefix = lh.varName.slice(2).split("-")[0];
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

  themeCss += `\n}\n`;

  // build a lookup set of primitives we just emitted for validation
  const primitiveNames = new Set([
    ...fontPrimitives.map((p) => p.name),
    ...linePrimitives.map((p) => p.name),
  ]);

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
      const prefix = f.varName.slice(2).split("-")[0];
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
      const prefix = lh.varName.slice(2).split("-")[0];
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

  tokensCss += `\n}\n`;

  // write outputs to tmp/
  await fs.writeFile(path.join(outDir, "theme.css"), themeCss, "utf8");
  await fs.writeFile(path.join(outDir, "theme-tokens.css"), tokensCss, "utf8");

  console.log("Generated tmp/theme.css and tmp/theme-tokens.css");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
