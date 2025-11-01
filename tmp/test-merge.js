#!/usr/bin/env node
import fs from "fs/promises";
import { state } from "../assets/js/modules/state.js";
import * as fg from "../assets/js/modules/figma-client-gen.js";

(async () => {
  try {
    const prim = JSON.parse(
      await fs.readFile("./public/samples/figma-tokens/Primitives.json", "utf8")
    );
    const colors = JSON.parse(
      await fs.readFile(
        "./public/samples/figma-tokens/Token colors.json",
        "utf8"
      )
    );
    const fonts = JSON.parse(
      await fs.readFile("./public/samples/figma-tokens/Token Font.json", "utf8")
    );

    // Simulate the same merge logic as the browser handler: combine multiple
    // incoming files (primitives, token colors, fonts) and classify variables
    const rawParsed = [];
    rawParsed.push(prim, colors, fonts);

    const primitives = { variables: [] };
    const fnts = { variables: [] };
    const tokenColors = { variables: [], modes: {} };

    const processedFiles = [];
    let totalVars = 0;
    for (const p of rawParsed) {
      if (!p) continue;
      processedFiles.push(p.name || "(anonymous)");
      for (const v of p.variables || []) {
        totalVars++;
        const nm = String(v.name || "").toLowerCase();
        // Prefer tokenColors classification when the variable has per-mode
        // resolved values or aliases (semantic tokens).
        if (
          v.resolvedValuesByMode &&
          Object.values(v.resolvedValuesByMode).some(
            (rv) => rv && (typeof rv.resolvedValue === "object" || rv.aliasName)
          )
        ) {
          tokenColors.variables.push(v);
        } else if (v.type === "COLOR" || nm.startsWith("color/")) {
          primitives.variables.push(v);
        } else if (
          nm.includes("font") ||
          nm.includes("text") ||
          nm.includes("fontsize") ||
          nm.includes("lineheight") ||
          v.type === "FONT"
        ) {
          fnts.variables.push(v);
        } else {
          primitives.variables.push(v);
        }
      }
    }

    console.log("processed files:", processedFiles.length, processedFiles);
    console.log("total variables across files:", totalVars);
    console.log(
      "classified counts -> primitives:",
      primitives.variables.length,
      "fonts:",
      fnts.variables.length,
      "tokenColors:",
      tokenColors.variables.length
    );

    const out = fg.generateCanonicalThemeFromFigma({
      primitives,
      fonts: fnts,
      tokenColors,
    });

    // simulate original theme loaded (the app normally uses assets/css/theme.css)
    state.originalThemeContent = await fs.readFile(
      "assets/css/theme.css",
      "utf8"
    );
    state.themeFromImport = true;

    let generated = out.themeCss || "";

    const rxColor = /--color-[a-z0-9-]+-\d+\s*:/gi;
    const genColors = new Set(
      (generated.match(rxColor) || []).map((s) =>
        s.replace(/\s*:.*/, "").trim()
      )
    );

    // For local tests, consider additional original sources such as tmp/theme.css
    const origCandidates = [];
    if (state.originalThemeContent)
      origCandidates.push({
        src: "assets/css/theme.css",
        content: state.originalThemeContent,
      });
    try {
      const tmpTheme = await fs.readFile("tmp/theme.css", "utf8");
      if (tmpTheme)
        origCandidates.push({ src: "tmp/theme.css", content: tmpTheme });
    } catch (e) {
      // ignore if tmp/theme.css doesn't exist
    }

    const orig =
      origCandidates.map((c) => c.content).join("\n\n") ||
      state.themeContent ||
      "";
    const origMatches = (orig.match(rxColor) || []).map((s) =>
      s.replace(/\s*:.*/, "").trim()
    );

    const missing = [];
    for (const o of origMatches) {
      if (!genColors.has(o)) missing.push(o);
    }

    console.log("missing count", missing.length);
    if (missing.length) {
      const lines = orig.split(/\r?\n/);
      const insertLines = [];
      for (const m of missing) {
        const rxLine = new RegExp(`^\\s*(${m})\\s*:\\s*(.*);?\\s*$`, "i");
        for (const L of lines) {
          const mm = L.match(rxLine);
          if (mm) {
            const val = String(mm[2] || "").replace(/;\s*$/, "");
            insertLines.push(`  ${mm[1]}: ${val};`);
          }
        }
      }
      console.log("insertLines sample", insertLines.slice(0, 10));
      console.log("missing variables (names):", missing);
      console.log(
        "orig sources considered:",
        origCandidates.map((c) => c.src)
      );
    }

    console.log("done");
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
