import fs from "fs/promises";
import * as fg from "../assets/js/modules/figma-client-gen.js";

(async () => {
  const prim = JSON.parse(
    await fs.readFile("./public/samples/figma-tokens/Primitives.json", "utf8")
  );
  const colors = JSON.parse(
    await fs.readFile("./public/samples/figma-tokens/Token colors.json", "utf8")
  );
  const fonts = JSON.parse(
    await fs.readFile("./public/samples/figma-tokens/Token Font.json", "utf8")
  );
  const out = fg.generateCanonicalThemeFromFigma({
    primitives: prim,
    fonts,
    tokenColors: colors,
  });
  const generated = out.themeCss || "";
  const rxColor = /--color-[a-z0-9-]+-\d+\s*:/gi;
  const genColors = (generated.match(rxColor) || []).map((s) =>
    s.replace(/\s*:.*/, "").trim()
  );
  const genSet = new Set(genColors);
  console.log("genColors count", genColors.length, "unique", genSet.size);
  const orig1 = await fs.readFile("assets/css/theme.css", "utf8");
  let orig2 = "";
  try {
    orig2 = await fs.readFile("tmp/theme.css", "utf8");
  } catch (e) {}
  const orig = orig1 + "\n\n" + orig2;
  const origMatches = (orig.match(rxColor) || []).map((s) =>
    s.replace(/\s*:.*/, "").trim()
  );
  console.log(
    "origMatches count",
    origMatches.length,
    "unique orig",
    new Set(origMatches).size
  );
  const missing = origMatches.filter((o) => !genSet.has(o));
  console.log("missing count", missing.length);
  console.log([...new Set(missing)].slice(0, 40));
})();
