#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";

const ROOT = path.resolve(".");
const samplesDir = path.join(ROOT, "public", "samples", "figma-tokens");

// Copie de figmaColorToCss et helpers
function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearRgbToOklab(r, g, b) {
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
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return { L, C, h };
}

function formatNumber(n) {
  const s = Number(n).toFixed(4);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function figmaColorToCss(c) {
  const r = srgbToLinear(Number(c.r));
  const g = srgbToLinear(Number(c.g));
  const b = srgbToLinear(Number(c.b));
  const { L, a, b: bb } = linearRgbToOklab(r, g, b);
  const { C, h } = oklabToOklch(L, a, bb);
  const Lstr = formatNumber(L);
  const Cstr = formatNumber(C);
  const Hstr = formatNumber(h);
  const alpha = typeof c.a === "number" ? formatNumber(c.a) : null;
  const base = `oklch(${Lstr} ${Cstr} ${Hstr}`;
  return alpha && alpha !== "1" ? `${base} / ${alpha})` : base + `)`;
}

function sanitizeVarName(name) {
  let sanitized = String(name)
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
  if (sanitized.startsWith("colors-")) {
    sanitized = "color-" + sanitized.slice(7);
  }
  return "--" + sanitized;
}

// Copie de extractFigmaColors (nouvelle version)
function extractFigmaColors(figmaVariables = []) {
  const primitiveMap = new Map();

  const canonicalGlobalColors = new Set([
    "--color-white",
    "--color-black",
    "--color-gray-50",
    "--color-gray-100",
    "--color-gray-200",
    "--color-gray-300",
    "--color-gray-400",
    "--color-gray-500",
    "--color-gray-600",
    "--color-gray-700",
    "--color-gray-800",
    "--color-gray-900",
    "--color-error-100",
    "--color-error-200",
    "--color-error-300",
    "--color-error-500",
    "--color-error-700",
    "--color-error-900",
    "--color-success-100",
    "--color-success-300",
    "--color-success-500",
    "--color-success-700",
    "--color-success-900",
    "--color-warning-100",
    "--color-warning-300",
    "--color-warning-500",
    "--color-warning-700",
    "--color-warning-900",
    "--color-info-100",
    "--color-info-300",
    "--color-info-500",
    "--color-info-700",
    "--color-info-900",
  ]);

  for (const v of figmaVariables) {
    if (v.type !== "COLOR") continue;

    const resolvedModes = v.resolvedValuesByMode || {};

    for (const [modeKey, modeData] of Object.entries(resolvedModes)) {
      if (!modeData) continue;

      const aliasName = modeData.aliasName;
      const resolvedValue = modeData.resolvedValue;

      if (!aliasName || !resolvedValue) continue;

      const cssVarName = sanitizeVarName(aliasName);

      if (canonicalGlobalColors.has(cssVarName)) continue;

      if (!primitiveMap.has(cssVarName)) {
        const css = figmaColorToCss(resolvedValue);
        if (css) {
          primitiveMap.set(cssVarName, css);
        }
      }
    }
  }

  const colors = [];
  for (const [name, value] of primitiveMap.entries()) {
    colors.push({ name, value });
  }

  return colors;
}

async function main() {
  const tokenColorsPath = path.join(samplesDir, "Token colors.json");
  const tokenColors = JSON.parse(await fs.readFile(tokenColorsPath, "utf8"));

  console.log(
    `\n[test] Token colors.json contient ${tokenColors.variables.length} variables\n`
  );

  const extracted = extractFigmaColors(tokenColors.variables);

  console.log(`[test] ✅ ${extracted.length} primitives extraites :\n`);

  extracted.forEach((color) => {
    console.log(`  ${color.name}: ${color.value};`);
  });
}

main().catch(console.error);
