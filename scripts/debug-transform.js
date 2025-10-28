import fs from "fs";
const t = fs.readFileSync("./assets/js/modules/generators.js", "utf8");
const m = t.match(/const CANONICAL_THEME_TOKENS = `([\s\S]*?)`;/);
if (!m) {
  console.error("template not found");
  process.exit(1);
}
const tpl = m[1];
console.log("--- ORIGINAL snippet around light-dark ---");
console.log(
  tpl
    .split("\n")
    .filter(
      (l) =>
        l.includes("light-dark") ||
        l.includes("--accent") ||
        l.includes("--selection")
    )
    .join("\n")
);
let out = tpl.replace(/raspberry/g, "raspberry");
out = out.replace(/color-scheme:\s*light dark;/g, "color-scheme: light;");
out = out.replace(/\n\s*&\[data-theme="dark"\][^{]*\{[\s\S]*?\n\s*\}/g, "");
out = out.replace(/light-dark\(\s*([^,]+),\s*([^\)]+)\)/g, "$1");
console.log("\n--- AFTER transformations ---");
console.log(
  out
    .split("\n")
    .filter(
      (l) =>
        l.includes("light-dark") ||
        l.includes("--accent") ||
        l.includes("--selection")
    )
    .join("\n")
);
