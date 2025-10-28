import fs from "fs";
import path from "path";

// Minimal DOM shim so modules that import `./dom.js` at top-level
// don't throw when running in Node (we only need to avoid ReferenceError)
globalThis.document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  querySelector: () => null,
};

const { generateThemeCSS, generateTokensCSS } = await import(
  "../assets/js/modules/generators.js"
);

console.log("=== generateThemeCSS() output (first 800 chars) ===\n");
const theme = generateThemeCSS();
console.log(theme ? theme.slice(0, 800) : "[vide]");
console.log("\n=== end generateThemeCSS ===\n");

console.log("=== generateTokensCSS() output (first 800 chars) ===\n");
const tokens = generateTokensCSS();
console.log(tokens ? tokens.slice(0, 800) : "[vide]");
console.log("\n=== end generateTokensCSS ===\n");

// Also write full tokens output to tmp file for inspection
const outPath = path.resolve("./tmp-generated-theme-tokens.css");
fs.writeFileSync(outPath, tokens, "utf8");
console.log(`Wrote full tokens to ${outPath}`);
