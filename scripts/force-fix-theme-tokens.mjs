#!/usr/bin/env node
import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "tmp", "theme-tokens.css");
if (!fs.existsSync(p)) {
  console.error("File not found:", p);
  process.exit(2);
}
let txt = fs.readFileSync(p, "utf8");

// Preserve header comment if exists
const headerMatch = txt.match(/^(\s*\/\*[\s\S]*?\*\/\s*)/);
const header = headerMatch ? headerMatch[1] : "";

// find :root body
const rootIdx = txt.indexOf(":root");
if (rootIdx === -1) {
  console.error(":root not found");
  process.exit(2);
}
const open = txt.indexOf("{", rootIdx);
let depth = 1;
let i = open + 1;
for (; i < txt.length && depth > 0; i++) {
  if (txt[i] === "{") depth++;
  else if (txt[i] === "}") depth--;
}
const body = txt.slice(open + 1, i - 1);

// Extract primary if present
const primMatch = body.match(/--primary\s*:\s*([^;]+);/i);
const primaryVal =
  primMatch && primMatch[1] ? primMatch[1].trim() : "var(--color-blue-500)";

// Remove any existing primary-related declarations and any data-theme or color-scheme occurrences from body
let cleaned = body.replace(
  /\/\*\s*Couleur primaire\s*\*\/[\s\S]*?(?=\/\*|$)/gi,
  "\n"
);
cleaned = cleaned.replace(/^\s*--primary\s*:[^;]*;?\s*/gim, "");
cleaned = cleaned.replace(/^\s*--on-primary\s*:[^;]*;?\s*/gim, "");
cleaned = cleaned.replace(/^\s*--primary-lighten\s*:[^;]*;?\s*/gim, "");
cleaned = cleaned.replace(/^\s*--primary-darken\s*:[^;]*;?\s*/gim, "");
cleaned = cleaned.replace(/color-scheme\s*:[\s\S]*?(?=\/\*|$)/gi, "\n");
cleaned = cleaned.replace(
  /&\[data-theme=["'][^"']+["']\]\s*\{[\s\S]*?\}\s*/gi,
  "\n"
);

// Remove leading/trailing whitespace
cleaned = cleaned.replace(/^\s+/, "").replace(/\s+$/, "\n");

const themeBlock = `  /* Theme */\n  color-scheme: light dark;\n\n  &[data-theme="light"] {\n    color-scheme: light;\n  }\n\n  &[data-theme="dark"] {\n    color-scheme: dark;\n  }\n\n`;
const primaryGroup = `  /* Couleur primaire */\n  --primary: ${primaryVal};\n  --on-primary: var(--color-white);\n  --primary-lighten: oklch(from var(--primary) calc(l * 1.2) c h);\n  --primary-darken: oklch(from var(--primary) calc(l * 0.8) c h);\n\n`;

const newBody = themeBlock + primaryGroup + cleaned;
const newTxt = (header ? header + "\n" : "") + ":root {\n" + newBody + "}\n";
fs.writeFileSync(p, newTxt, "utf8");
console.log("force-fixed", p);
