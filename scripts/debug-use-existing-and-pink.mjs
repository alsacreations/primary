import fs from "fs/promises";
import path from "path";
import { state } from "../assets/js/modules/state.js";
import { generateTokensCSS } from "../assets/js/modules/generators.js";

async function main() {
  const tokensPath = path.join(process.cwd(), "tmp", "theme-tokens.css");
  const themePath = path.join(process.cwd(), "tmp", "theme.css");

  try {
    const tokens = await fs.readFile(tokensPath, "utf8");
    const theme = await fs.readFile(themePath, "utf8");

    state.tokensContent = String(tokens || "");
    state.themeContent = String(theme || "");
    state.themeFromImport = true;

    // Simulate user selection of 'pink' as primary
    state.config = state.config || {};
    state.config.primaryColor = "pink";

    console.log(
      "[debug-use-existing-and-pink] state.tokensContent length:",
      state.tokensContent.length
    );
    console.log("[debug-use-existing-and-pink] state.config ->", state.config);

    const out = generateTokensCSS();
    await fs.writeFile(
      path.join(process.cwd(), "tmp", "debug-use-existing-and-pink.css"),
      out,
      "utf8"
    );
    console.log("WROTE tmp/debug-use-existing-and-pink.css");
  } catch (e) {
    console.error("Failed to read generated files:", e);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
