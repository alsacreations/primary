import fs from "fs/promises";
import path from "path";
import figmaRun from "./figma-import.js";
import { state } from "../assets/js/modules/state.js";
import { generateTokensCSS } from "../assets/js/modules/generators.js";

async function main() {
  const samplesDir = path.join(
    process.cwd(),
    "public",
    "samples",
    "figma-tokens",
    "alsafr"
  );
  const outDir = path.join(process.cwd(), "tmp");
  console.log("Running figma-import for samples in", samplesDir);
  await figmaRun({ samplesDir, outDir });

  const tokensPath = path.join(process.cwd(), "tmp", "theme-tokens.css");
  const themePath = path.join(process.cwd(), "tmp", "theme.css");

  try {
    const tokens = await fs.readFile(tokensPath, "utf8");
    const theme = await fs.readFile(themePath, "utf8");

    state.tokensContent = String(tokens || "");
    state.themeContent = String(theme || "");
    state.themeFromImport = true;

    console.log(
      "[debug-import-from-alsafr] state.tokensContent length:",
      state.tokensContent.length
    );

    const out = generateTokensCSS();
    await fs.writeFile(
      path.join(process.cwd(), "tmp", "debug-import-from-alsafr.css"),
      out,
      "utf8"
    );
    console.log("WROTE tmp/debug-import-from-alsafr.css");
  } catch (e) {
    console.error("Failed to read generated files:", e);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
