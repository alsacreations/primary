#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import fgClient from "../assets/js/modules/figma-client-gen.js";
import * as gen from "../assets/js/modules/generators.js";
import { state } from "../assets/js/modules/state.js";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "Usage: node scripts/replay-last-args.js /path/to/last-args.json"
    );
    process.exit(2);
  }
  const p = path.resolve(arg);
  const raw = await fs.readFile(p, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    // Fallback: try to clean common paste formats (code fences, escaped \n sequences)
    try {
      let cleaned = raw.trim();
      // Remove surrounding ``` fences if present
      if (/^```/.test(cleaned)) {
        cleaned = cleaned.replace(/^```[^\n]*\n/, "");
        cleaned = cleaned.replace(/\n```\s*$/m, "");
      }
      // If the content still contains literal "\\n" sequences, unescape them
      if (/\\n/.test(cleaned)) {
        cleaned = cleaned
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
      data = JSON.parse(cleaned);
    } catch (e2) {
      console.error("Failed to parse JSON (after cleanup):", e2.message);
      process.exit(2);
    }
  }

  // data is expected to be { primitives: [...], tokenColors: [...], fonts: [...] }
  const primitives = data.primitives || data.primitivesList || [];
  const tokenColors = data.tokenColors || data.token_colors || [];
  const fonts = data.fonts || [];

  // Call client generator (mimic UI: synthesizeProjectPrimitives default true when generator invoked)
  const out = fgClient.generateCanonicalThemeFromFigma({
    primitives: { variables: primitives },
    tokenColors: { variables: tokenColors },
    fonts: fonts,
    synthesizeProjectPrimitives: true,
  });

  // place outputs into state like the UI
  if (out && out.tokensCss) state.tokensContent = out.tokensCss;
  if (out && out.themeCss) state.themeContent = out.themeCss;

  // Run finalize-like preview behaviour: use generateThemeCSS and generateTokensCSS
  // Allow optional mode override (3rd arg) for testing: light|dark|both
  const overrideMode = process.argv[3];
  if (overrideMode) {
    state.config = state.config || {};
    state.config.themeMode = overrideMode;
  }
  console.log(
    "[replay] state.config.themeMode =",
    state.config && state.config.themeMode
  );
  const themeCss = gen.generateThemeCSS();
  const tokensCss = gen.generateTokensCSS();

  console.log("\n---- THEME.CSS PREVIEW ----\n");
  console.log(themeCss);
  console.log("\n---- GENERATED TOKENS (UI) ----\n");
  console.log(tokensCss);
  console.log("\n---- END ----\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
