#!/usr/bin/env node
import fs from "fs/promises";

const primitives = JSON.parse(
  await fs.readFile("public/samples/figma-tokens/Primitives.json", "utf8")
);

// Simuler extractFigmaSpacings
function pxToRem(px) {
  const rem = Number(px) / 16;
  if (Number(px) === 0) return "0";
  return (
    String(rem)
      .replace(/(\.\d*?)0+$/, "$1")
      .replace(/\.$/, "") + "rem"
  );
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

const spacings = [];
for (const v of primitives.variables) {
  if (v.type !== "FLOAT") continue;
  const name = String(v.name || "").toLowerCase();
  if (!name.includes("spacing") && !name.includes("space")) continue;

  const resolvedModes = v.resolvedValuesByMode || {};
  for (const [modeKey, modeData] of Object.entries(resolvedModes)) {
    if (!modeData) continue;
    const resolvedValue = modeData.resolvedValue;
    if (typeof resolvedValue !== "number") continue;

    const cssVarName = sanitizeVarName(v.name);
    const cssValue = pxToRem(resolvedValue);
    spacings.push({ name: cssVarName, value: cssValue });
    break;
  }
}

console.log("📏 Espacements extraits:", spacings.length);
console.log("\nSection générée :");
console.log("  /* Espacements */");
spacings.forEach((s) => {
  console.log(`  ${s.name}: ${s.value};`);
});
