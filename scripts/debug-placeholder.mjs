import fs from "fs";
import path from "path";
import { state } from "../assets/js/modules/state.js";
import {
  generateThemeCSS,
  generateTokensCSS,
} from "../assets/js/modules/generators.js";

// Scenario: no import, no custom vars, no tokensContent set
state.themeContent = fs.readFileSync(
  path.join(process.cwd(), "assets", "css", "theme.css"),
  "utf8"
);
state.tokensContent = "";
state.config.primaryColor = null;
state.themeFromImport = false;

console.log("=== generateThemeCSS() preview ===");
console.log(generateThemeCSS());

console.log("=== generateTokensCSS() output (head 400) ===");
const tokens = generateTokensCSS();
console.log(tokens.substring(0, 400));

// write full tokens to tmp for inspection
fs.writeFileSync(
  path.join(process.cwd(), "tmp", "debug-placeholder-tokens.css"),
  tokens,
  "utf8"
);
console.log("WROTE tmp/debug-placeholder-tokens.css");
