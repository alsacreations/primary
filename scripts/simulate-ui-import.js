#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import fgClient from "../assets/js/modules/figma-client-gen.js";
import * as gen from "../assets/js/modules/generators.js";
import { state } from "../assets/js/modules/state.js";

const ROOT = path.resolve(".");
const samplesDir = path.join(ROOT, "public", "samples", "figma-tokens");

async function readJson(name) {
  const p = path.join(samplesDir, name);
  return JSON.parse(await fs.readFile(p, "utf8"));
}

function sanitizeVarName(name) {
  return (
    "--" + String(name).replace(/\//g, "-").replace(/\s+/g, "-").toLowerCase()
  );
}

async function main() {
  const primitives = await readJson("Primitives.json");
  const fonts = await readJson("Token Font.json");
  const tokenColors = await readJson("Token colors.json");

  // Mimic attachJsonImportHandlers rawParsed branch
  // Snapshot args like events.js
  try {
    state.themeFromImport = true;
  } catch (e) {}

  // Call client generator as events.js does
  const out = fgClient.generateCanonicalThemeFromFigma({
    primitives,
    fonts,
    tokenColors,
    synthesizeProjectPrimitives: true,
  });

  // emulate finalizeGeneratedTheme from events.js (simplified)
  let generated = out && out.themeCss ? out.themeCss : "";

  // collect userNames empty (no custom vars)
  const userNames = new Set();
  const allowSynthesis = Boolean(
    state.config && state.config.synthesizeProjectPrimitives
  );

  if (allowSynthesis) {
    // In default state config, this is false; skip
  } else {
    // build genColors set from generated themeCss
    const rxColor = /--color-[a-z0-9-]+-\d+\s*:/gi;
    const genColors = new Set(
      (generated.match(rxColor) || []).map((s) =>
        s.replace(/\s*:.*/, "").trim()
      )
    );

    const importedMap = new Map();
    for (const pv of primitives.variables || []) {
      const nm = sanitizeVarName(pv.name || "");
      importedMap.set(nm, pv);
    }
    for (const tv of tokenColors.variables || []) {
      const modes = tv.resolvedValuesByMode || {};
      for (const mk of Object.keys(modes || {})) {
        const entry = modes[mk] || {};
        if (entry && entry.aliasName)
          importedMap.set(sanitizeVarName(entry.aliasName), entry);
      }
    }

    const missing = [];
    for (const [name] of importedMap) {
      if (!genColors.has(name) && !userNames.has(name)) missing.push(name);
    }

    const insertLines = [];
    for (const m of missing) {
      const pv = importedMap.get(m);
      if (!pv) continue;
      try {
        const smallOut = fgClient.generateCanonicalThemeFromFigma({
          primitives: { variables: [pv] },
          synthesizeProjectPrimitives: false,
        });
        const smallCss = smallOut.themeCss || "";
        const rxLine = new RegExp(`^\\s*${m}\\s*:\\s*(.*);?$`, "m");
        const mm = smallCss.match(rxLine);
        if (mm) {
          const val = String(mm[1] || "").replace(/;\s*$/, "");
          insertLines.push(`  ${m}: ${val};`);
        }
      } catch (err) {
        /* noop */
      }
    }

    if (insertLines.length) {
      const lastBrace = generated.lastIndexOf("}");
      if (lastBrace !== -1) {
        generated =
          generated.slice(0, lastBrace) +
          "\n\n  /* Couleurs personnalisées (projet - synthèse) */\n" +
          insertLines.join("\n") +
          "\n" +
          generated.slice(lastBrace);
      } else {
        generated +=
          "\n\n  /* Couleurs personnalisées (projet - synthèse) */\n" +
          insertLines.join("\n") +
          "\n";
      }
    }
  }

  // State tokensContent is set by events.js
  if (out && out.tokensCss) state.tokensContent = out.tokensCss;

  // Now call generateTokensCSS which the UI uses to display tokens (it post-processes state.tokensContent)
  const tokens = gen.generateTokensCSS();

  console.log("---- GENERATED TOKENS (UI) ----");
  console.log(tokens);
  console.log("---- END ----");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
