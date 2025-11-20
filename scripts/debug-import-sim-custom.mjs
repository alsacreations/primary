import fs from "fs";
import path from "path";
import { state } from "../assets/js/modules/state.js";
import { generateTokensCSS } from "../assets/js/modules/generators.js";

const sample = fs.readFileSync(
  path.join(process.cwd(), "canonical", "tokens", "theme-tokens-base.css"),
  "utf8"
);
state.themeContent = fs.readFileSync(
  path.join(process.cwd(), "assets", "css", "theme.css"),
  "utf8"
);
state.tokensContent = sample;
state.config.primaryColor = null;
state.themeFromImport = true;
// Inject a test customVars block to simulate user input in the UI textarea
state.config.customVars = `--color-custom-100: oklch(95% 0.02 10);\n--color-custom-500: oklch(60% 0.15 10);\n--spacing-tiny: var(--spacing-6);`;

console.log(
  "Simulating import with customVars: state.themeFromImport =",
  state.themeFromImport
);
const out = generateTokensCSS();
fs.writeFileSync(
  path.join(process.cwd(), "tmp", "debug-import-tokens-custom.css"),
  out,
  "utf8"
);
console.log("WROTE tmp/debug-import-tokens-custom.css");
console.log(out.substring(0, 1200));
