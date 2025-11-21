import fs from "fs/promises";
import path from "path";
import { state } from "../assets/js/modules/state.js";
import { generateThemeCSS } from "../assets/js/modules/generators.js";

async function main() {
  const themePath = path.join(process.cwd(), "tmp", "theme.css");

  try {
    const theme = await fs.readFile(themePath, "utf8");

    state.themeContent = String(theme || "");
    state.themeFromImport = true;

    // Simulate user selection of 'poppins' as font family
    state.config = state.config || {};
    state.config.fontFamily = "poppins";

    console.log(
      "[debug-generate-theme-poppins] state.themeContent length:",
      state.themeContent.length
    );
    console.log("[debug-generate-theme-poppins] state.config ->", state.config);

    const out = generateThemeCSS();
    await fs.writeFile(
      path.join(process.cwd(), "tmp", "debug-theme-poppins.css"),
      out,
      "utf8"
    );
    console.log("WROTE tmp/debug-theme-poppins.css");
  } catch (e) {
    console.error("Failed to read generated files:", e);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
