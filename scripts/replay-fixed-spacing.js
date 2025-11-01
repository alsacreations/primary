#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import fgClient from "../assets/js/modules/figma-client-gen.js";
import * as gen from "../assets/js/modules/generators.js";
import { state } from "../assets/js/modules/state.js";

async function main() {
  const p = path.resolve(process.argv[2] || "./tmp/last-args.json");
  const raw = await fs.readFile(p, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    try {
      let cleaned = raw.trim();
      if (/^```/.test(cleaned)) {
        cleaned = cleaned.replace(/^```[^\n]*\n/, "");
        cleaned = cleaned.replace(/\n```\s*$/m, "");
      }
      if (/\\n/.test(cleaned)) {
        cleaned = cleaned
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
      data = JSON.parse(cleaned);
    } catch (e2) {
      console.error("Failed to parse JSON (after cleanup):", e2.message);
      process.exit(2);
    }
  }
  const primitives = data.primitives || data.primitivesList || [];
  const tokenColors = data.tokenColors || data.token_colors || [];
  const fonts = data.fonts || [];

  const out = fgClient.generateCanonicalThemeFromFigma({
    primitives: { variables: primitives },
    tokenColors: { variables: tokenColors },
    fonts: fonts,
    synthesizeProjectPrimitives: true,
  });

  if (out && out.tokensCss) state.tokensContent = out.tokensCss;
  if (out && out.themeCss) state.themeContent = out.themeCss;

  // Force spacing to be FIXED (disable spacing responsiveness)
  state.config = state.config || {};
  state.config.spacingResponsive = false;

  const themeCss = gen.generateThemeCSS();
  const tokensCss = gen.generateTokensCSS();

  console.log("\n---- THEME.CSS PREVIEW ----\n");
  console.log(themeCss);
  console.log("\n---- GENERATED TOKENS (FIXED SPACING) ----\n");
  console.log(tokensCss);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
