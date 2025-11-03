#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";

const ROOT = path.resolve(".");
const samplesDir = path.join(ROOT, "public", "samples", "figma-tokens");
const canonicalDir = path.join(ROOT, "canonical");

async function readJson(name) {
  const p = path.join(samplesDir, name);
  return JSON.parse(await fs.readFile(p, "utf8"));
}

async function readCss(name) {
  const p = path.join(canonicalDir, name);
  return await fs.readFile(p, "utf8");
}

function sanitizeVarName(name) {
  return (
    "--" + String(name).replace(/\//g, "-").replace(/\s+/g, "-").toLowerCase()
  );
}

/**
 * Mock du canonical-loader pour Node.js
 * Charge directement les fichiers CSS canoniques depuis /canonical/
 */
async function mockCanonicalCache() {
  const [commons, colors, fonts, radius, spacings] = await Promise.all([
    readCss("primitives/commons/commons.css"),
    readCss("primitives/colors/colors.css"),
    readCss("primitives/fonts/fonts.css"),
    readCss("primitives/radius/radius.css"),
    readCss("primitives/spacings/spacings.css"),
  ]);

  // Structure attendue par getCanonicalCache()
  const mockCache = {
    primitives: {
      commons: { raw: commons },
      colors: { raw: colors },
      fonts: { raw: fonts },
      radius: { raw: radius },
      spacings: { raw: spacings },
    },
    tokens: {}, // Requis par getCanonicalCache()
    themeJson: null,
  };

  return mockCache;
}

async function main() {
  // 1. CRITIQUE : Injecter le mock AVANT d'importer figma-client-gen.js
  const canonicalLoader = await import(
    "../assets/js/modules/canonical-loader.js"
  );

  const canonicalCache = await mockCanonicalCache();
  console.log("[simulate] ✅ Canoniques chargés depuis /canonical/*.css");

  canonicalLoader.__setMockCache(canonicalCache);
  console.log("[simulate] ✅ Mock canonical cache injecté");

  // 2. MAINTENANT on peut importer figma-client-gen (qui va utiliser le cache mocké)
  const fgClient = await import("../assets/js/modules/figma-client-gen.js");
  const gen = await import("../assets/js/modules/generators.js");
  const { state } = await import("../assets/js/modules/state.js");
  console.log("[simulate] ✅ Modules importés avec cache actif");

  // 3. Charger les fichiers Figma
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
