#!/usr/bin/env node
import fs from "fs";
import path from "path";

const tmpDir = path.resolve(process.cwd(), "tmp");
const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".css"));

function cleanAndFix(
  content,
  displayPrimary = "raspberry",
  themeMode = "both"
) {
  const rootIdx = content.indexOf(":root");
  if (rootIdx === -1) return content;
  const open = content.indexOf("{", rootIdx);
  if (open === -1) return content;
  // find matching close
  let depth = 1;
  let i = open + 1;
  for (; i < content.length && depth > 0; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") depth--;
  }
  const body = content.slice(open + 1, i - 1);

  // remove any theme blocks (color-scheme and &[data-theme] blocks)
  let cleaned = body.replace(/\/\*\s*Theme\s*\*\/[\s\S]*?(?=\/\*|$)/gi, "\n");
  cleaned = cleaned.replace(
    /color-scheme\s*:\s*[\w\s]+;[\s\S]*?(?:&\[data-theme=["'][^"']+["']\][\s\S]*?\}\s*)*/gi,
    "\n"
  );

  // capture existing primary value if any
  const primMatch = cleaned.match(/--primary\s*:\s*([^;]+);/i);
  const primaryVal =
    primMatch && primMatch[1]
      ? primMatch[1].trim()
      : `var(--color-${displayPrimary}-500)`;

  // remove any existing primary-related declarations
  cleaned = cleaned.replace(
    /\/\*\s*Couleur primaire\s*\*\/[\s\S]*?(?=\/\*|$)/gi,
    "\n"
  );
  cleaned = cleaned.replace(/^\s*--primary\s*:[^;]*;?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*--on-primary\s*:[^;]*;?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*--primary-lighten\s*:[^;]*;?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*--primary-darken\s*:[^;]*;?\s*/gim, "");

  let csBlk = "  color-scheme: light;\n";
  if (themeMode === "both") {
    csBlk = `  color-scheme: light dark;\n\n  &[data-theme="light"] {\n    color-scheme: light;\n  }\n\n  &[data-theme="dark"] {\n    color-scheme: dark;\n  }\n\n`;
  } else if (themeMode === "dark") {
    csBlk = "  color-scheme: dark;\n";
  }

  const primaryGroup = [
    "  /* Couleur primaire */",
    `  --primary: ${primaryVal};`,
    "  --on-primary: var(--color-white);",
    "  --primary-lighten: oklch(from var(--primary) calc(l * 1.2) c h);",
    "  --primary-darken: oklch(from var(--primary) calc(l * 0.8) c h);",
    "",
  ].join("\n");

  const rest = cleaned.replace(/^\s+/, "").replace(/\s+$/, "\n");
  const newBody = csBlk + "\n" + primaryGroup + rest;

  return content.slice(0, open + 1) + "\n" + newBody + "}" + content.slice(i);
}

for (const f of files) {
  const p = path.join(tmpDir, f);
  const txt = fs.readFileSync(p, "utf8");
  const fixed = cleanAndFix(txt);
  if (fixed !== txt) {
    fs.writeFileSync(p, fixed, "utf8");
    console.log("Fixed", f);
  } else {
    console.log("No change", f);
  }
}

console.log("verify-and-fix-theme-tokens done.");
