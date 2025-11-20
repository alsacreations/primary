import fs from "fs/promises";
import path from "path";
import { generateCanonicalThemeFromFigma } from "../assets/js/modules/figma-client-gen.js";
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
  const primitivesPath = path.join(samplesDir, "Primitives.json");
  const tokenColorsPath = path.join(samplesDir, "Token colors.json");
  const fontsPath = path.join(samplesDir, "Token Font.json");

  try {
    const [primitivesTxt, tokenColorsTxt, fontsTxt] = await Promise.all([
      fs.readFile(primitivesPath, "utf8"),
      fs.readFile(tokenColorsPath, "utf8"),
      fs.readFile(fontsPath, "utf8"),
    ]);

    const primitives = JSON.parse(primitivesTxt);
    const tokenColors = JSON.parse(tokenColorsTxt);
    const fonts = JSON.parse(fontsTxt);

    console.log("[debug-alsafr-client] loaded samples, calling generator...");
    const out = generateCanonicalThemeFromFigma({
      primitives,
      fonts,
      tokenColors,
      synthesizeProjectPrimitives: true,
      customColors: "",
      themeMode: "both",
    });

    // assign to state as the browser would
    state.themeFromImport = true;
    if (out.themeCss) state.themeContent = out.themeCss;
    if (out.tokensCss) state.tokensContent = out.tokensCss;

    console.log(
      "[debug-alsafr-client] tokensCss length:",
      (out.tokensCss || "").length
    );

    const generated = generateTokensCSS();
    await fs.writeFile(
      path.join(process.cwd(), "tmp", "debug-import-from-alsafr.css"),
      generated,
      "utf8"
    );
    console.log("WROTE tmp/debug-import-from-alsafr.css");
  } catch (e) {
    console.error("Failed:", e);
    process.exit(1);
  }
}

main();
