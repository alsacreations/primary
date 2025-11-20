#!/usr/bin/env node
import fs from "fs";
import path from "path";

const tmpDir = path.resolve(process.cwd(), "tmp");
const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".css"));
let exitCode = 0;

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const errors = [];

  // Count canonical color-scheme occurrences (light dark)
  const csRegex = /color-scheme\s*:\s*light\s+dark\s*;/gi;
  const csMatches = content.match(csRegex) || [];
  if (csMatches.length === 0) {
    errors.push('Missing canonical "color-scheme: light dark;" block');
  } else if (csMatches.length > 1) {
    errors.push(`Multiple color-scheme blocks found (${csMatches.length})`);
  }

  // Locate end of canonical theme block
  const themeBlockRx =
    /color-scheme\s*:\s*light\s+dark;[\s\S]*?&\[data-theme=\"dark\"\]\s*\{[\s\S]*?\}\s*/i;
  const themeBlockMatch = content.match(themeBlockRx);
  let themeEndIndex = -1;
  if (themeBlockMatch)
    themeEndIndex =
      content.indexOf(themeBlockMatch[0]) + themeBlockMatch[0].length;

  // Find primary comment index
  const primCommentRx = /\/\*\s*Couleur primaire\s*\*\//i;
  const primMatch = content.match(primCommentRx);
  const primIndex = primMatch ? content.indexOf(primMatch[0]) : -1;

  if (primIndex === -1) {
    errors.push('Missing "/* Couleur primaire */" block');
  } else if (themeEndIndex !== -1) {
    // Allow some whitespace/newlines between themeEndIndex and primIndex
    const between = content.slice(themeEndIndex, primIndex);
    if (!/^\s*$/.test(between)) {
      errors.push(
        '"/* Couleur primaire */" is not immediately after the theme block'
      );
    }
  }

  // Check presence of tokens
  const needed = [
    "--primary",
    "--on-primary",
    "--primary-lighten",
    "--primary-darken",
  ];
  for (const tok of needed) {
    if (!new RegExp(tok + "\\s*:", "i").test(content)) {
      errors.push(`Missing token ${tok}`);
    }
  }

  if (errors.length) {
    console.error("FAIL", path.basename(filePath));
    for (const e of errors) console.error("  -", e);
    exitCode = 2;
  } else {
    console.log("OK", path.basename(filePath));
  }
}

for (const f of files) checkFile(path.join(tmpDir, f));
process.exit(exitCode);
