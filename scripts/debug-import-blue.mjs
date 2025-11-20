import fs from "fs";
import path from "path";
import { state } from "../assets/js/modules/state.js";
import { generateTokensCSS } from "../assets/js/modules/generators.js";

// Simulate an import that explicitly sets --primary to var(--color-blue-500)
const sample = `/* Sample import with explicit primary */
:root {
  --primary: var(--color-blue-500);
  --on-primary: ;
  /* maybe other placeholders */
}`;

state.themeContent = fs.readFileSync(
  path.join(process.cwd(), "assets", "css", "theme.css"),
  "utf8"
);
state.tokensContent = sample;
state.config.primaryColor = null;
state.themeFromImport = true;

console.log(
  "Simulating import (explicit blue primary): state.themeFromImport =",
  state.themeFromImport
);
const out = generateTokensCSS();
fs.writeFileSync(
  path.join(process.cwd(), "tmp", "debug-import-blue-tokens.css"),
  out,
  "utf8"
);
console.log("WROTE tmp/debug-import-blue-tokens.css");
console.log(out.substring(0, 800));
