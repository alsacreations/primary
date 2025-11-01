import fs from "fs/promises";
import * as fg from "../assets/js/modules/figma-client-gen.js";

function sanitizeVarName(name) {
  return (
    "--" +
    String(name || "")
      .replace(/\//g, "-")
      .replace(/\s+/g, "-")
      .toLowerCase()
  );
}
function safeSanitize(n) {
  return sanitizeVarName(n || "");
}

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

    const out = fg.generateCanonicalThemeFromFigma({
      primitives: prim,
      fonts,
      tokenColors: colors,
    });
    const generated = out.themeCss || "";
    const rxColor = /(--[a-z0-9-]+)\s*:/gi;
    const genVars = new Set();
    let m;
    while ((m = rxColor.exec(generated)) !== null) genVars.add(m[1]);

    console.log("Generated primitive count:", genVars.size);

    const refsMissing = new Map();

    for (const v of colors.variables || []) {
      const nameRaw = (v.name || "").toLowerCase();
      const rawName = String(nameRaw).replace(/\s+/g, "-");
      const primLightName = `--color-${rawName}-light`;
      const primDarkName = `--color-${rawName}-dark`;
      const rvLight =
        v.resolvedValuesByMode &&
        v.resolvedValuesByMode[Object.keys(v.resolvedValuesByMode || {})[0]];
      const rvDark =
        v.resolvedValuesByMode &&
        v.resolvedValuesByMode[Object.keys(v.resolvedValuesByMode || {})[1]];

      const refs = [];
      if (rvLight && rvLight.aliasName)
        refs.push(safeSanitize(rvLight.aliasName));
      else if (rvLight && rvLight.resolvedValue) refs.push(primLightName);
      if (rvDark && rvDark.aliasName) refs.push(safeSanitize(rvDark.aliasName));
      else if (rvDark && rvDark.resolvedValue) refs.push(primDarkName);

      const missing = refs.filter((r) => r && !genVars.has(r));
      if (missing.length) {
        refsMissing.set(v.name || "(unnamed)", { refs, missing });
      }
    }

    if (!refsMissing.size) console.log("No missing refs from token colors");
    else {
      console.log("Tokens that reference missing primitives:");
      for (const [k, v] of refsMissing.entries()) {
        console.log("-", k, "-> refs:", v.refs, "missing:", v.missing);
      }
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
