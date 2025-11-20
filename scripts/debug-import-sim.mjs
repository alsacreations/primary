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

console.log(
  "Simulating import: state.themeFromImport =",
  state.themeFromImport
);
const out = generateTokensCSS();
fs.writeFileSync(
  path.join(process.cwd(), "tmp", "debug-import-tokens.css"),
  out,
  "utf8"
);
console.log("WROTE tmp/debug-import-tokens.css");
console.log(out.substring(0, 800));
