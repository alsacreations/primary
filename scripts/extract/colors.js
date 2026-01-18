const { toCssVarName, ensureArray, clampBetweenModes } = require("../utils");

// Helper to flatten color primitives from a Mode JSON file
function flattenColors(colorObject, prefix = []) {
  const result = {};
  Object.keys(colorObject || {}).forEach((key) => {
    const val = colorObject[key];
    if (val && val.$type === "color" && val.$value && val.$value.hex) {
      // ensure all primitives are keyed as --color-...
      const name = toCssVarName(["color", ...prefix, key]);
      result[name] = val.$value.hex;
    } else if (typeof val === "object") {
      Object.assign(result, flattenColors(val, [...prefix, key]));
    }
  });
  return result;
}

function aliasToVar(alias) {
  // alias like "color/gray/100" -> --color-gray-100
  return "--" + alias.replace(/[\/]/g, "-").toLowerCase();
}

function extractColors(entries) {
  const primitives = {}; // --color-... -> hex
  const tokensByName = {}; // tokenName -> { mode: hex | aliasVar }
  const modes = new Set();

  // helper: scan nested color nodes for token overrides (isOverride)
  function scanColorTokens(obj, prefix, mode) {
    Object.keys(obj || {}).forEach((key) => {
      const val = obj[key];
      if (!val) return;
      if (val.$type === "color" && val.$extensions && val.$extensions["com.figma.isOverride"]) {
        const tokenName = [...(prefix || []), key].join("-").replace(/\s+/g, "-").toLowerCase();
        const hex = val.$value && val.$value.hex;
        const aliasData = (val.$extensions && val.$extensions["com.figma.aliasData"]) || null;
        const alias = aliasData && aliasData.targetVariableName ? aliasToVar(aliasData.targetVariableName) : null;
        const variableId =
          val.$extensions && val.$extensions["com.figma.variableId"] ? val.$extensions["com.figma.variableId"] : null;
        tokensByName[tokenName] = tokensByName[tokenName] || {};
        tokensByName[tokenName][mode] = {
          rawHex: hex || null,
          aliasVar: alias || null,
          variableId: variableId || null,
        };
      }
      if (typeof val === "object" && !val.$type) {
        scanColorTokens(val, [...(prefix || []), key], mode);
      }
    });
  }

  entries.forEach(({ json, modeName }) => {
    // Always collect primitives from any file
    if (json.color) {
      const flat = flattenColors(json.color);
      Object.assign(primitives, flat);
    }

    // If file declares a recognized mode, collect token overrides and top-level token colors
    if (!modeName) return;
    const mode = modeName.toLowerCase();
    modes.add(mode);

    // scan color tree for overrides (tokens)
    if (json.color) scanColorTokens(json.color, [], mode);

    // collect token aliases if present at top-level (tokens as direct values)
    Object.keys(json || {}).forEach((k) => {
      if (["color", "Spacing", "FontSize", "LineHeight", "Rounded"].includes(k)) return;
      const val = json[k];
      if (val && val.$type === "color") {
        // token defined as color object at top-level
        const token = k;
        const hex = val.$value && val.$value.hex;
        const aliasData = (val.$extensions && val.$extensions["com.figma.aliasData"]) || null;
        const alias = aliasData && aliasData.targetVariableName ? aliasToVar(aliasData.targetVariableName) : null;
        const variableId =
          val.$extensions && val.$extensions["com.figma.variableId"] ? val.$extensions["com.figma.variableId"] : null;
        tokensByName[token] = tokensByName[token] || {};
        // store an object so we keep metadata and can normalize to primitives later
        tokensByName[token][mode] = {
          rawHex: hex || null,
          aliasVar: alias || null,
          variableId: variableId || null,
        };
      }
    });
  });

  // Generate primitives CSS
  const primitivesCss = Object.keys(primitives)
    .sort()
    .map((name) => `${name}: ${primitives[name]};`);

  // Tokens: normalize token names and produce CSS
  const exceptions = new Set([
    "primary",
    "on-primary",
    "primary-lighten",
    "primary-darken",
    "accent",
    "accent-invert",
    "surface",
    "on-surface",
    "layer-1",
    "layer-2",
    "layer-3",
    "link",
    "link-hover",
    "link-active",
    "selection",
    "warning",
    "error",
    "success",
    "info",
    "border-light",
    "border-medium",
  ]);

  const tokensCss = [];
  const tokensJson = {};
  const warnings = [];

  Object.keys(tokensByName).forEach((token) => {
    const perMode = tokensByName[token];
    // normalized token name (remove spaces, to-lower)
    const normalizedToken = token.replace(/\s+/g, "-").toLowerCase();
    const varName = `--${normalizedToken}`;

    const outPerMode = {};
    const modesPresent = Object.keys(perMode);

    modesPresent.forEach((m) => {
      const entry = perMode[m];
      // prefer aliasVar (a primitive), else try to locate a primitive by hex
      let primitiveVar = entry.aliasVar;
      if (!primitiveVar && entry.rawHex) {
        const found = Object.keys(primitives).find((k) => primitives[k].toLowerCase() === entry.rawHex.toLowerCase());
        if (found) primitiveVar = found;
      }
      // store reference to primitive if possible, otherwise rawHex
      outPerMode[m] = primitiveVar
        ? { value: `var(${primitiveVar})`, primitive: primitiveVar, variableId: entry.variableId }
        : { value: entry.rawHex, primitive: null, variableId: entry.variableId };
    });

    // If token only present in a single mode, treat as a primitive; otherwise keep as token
    if (modesPresent.length === 1) {
      const only = modesPresent[0];
      const val = outPerMode[only];
      if (val && val.primitive) {
        // map short token name to primitive if found
        primitives[`--${normalizedToken}`] = primitives[val.primitive] || null;
      } else if (val && val.value) {
        primitives[`--${normalizedToken}`] = val.value;
      }
      // If the single mode is a named mode (not modeless), emit warning per instructions
      if (modesPresent[0] !== "") {
        warnings.push({
          token: normalizedToken,
          type: "missing-mode-variant",
          message: `Token '${normalizedToken}' present only in mode '${modesPresent[0]}'. Missing counterpart mode.`,
        });
      }
    } else {
      tokensJson[normalizedToken] = outPerMode;

      // If both modes reference same primitive, emit a warning (still a token per instructions)
      if (modesPresent.includes("light") && modesPresent.includes("dark")) {
        const l = outPerMode["light"].primitive || outPerMode["light"].value;
        const d = outPerMode["dark"].primitive || outPerMode["dark"].value;
        if (l && d && l === d) {
          warnings.push({
            token: normalizedToken,
            type: "identical-variants",
            message: `Token '${normalizedToken}' has identical light/dark variants referencing '${l}', consider collapsing but keep as Token.`,
          });
        }
      }

      // produce CSS for token
      if (modesPresent.includes("light") && modesPresent.includes("dark")) {
        const lightVal = outPerMode["light"].primitive
          ? `var(${outPerMode["light"].primitive})`
          : outPerMode["light"].value;
        const darkVal = outPerMode["dark"].primitive
          ? `var(${outPerMode["dark"].primitive})`
          : outPerMode["dark"].value;
        tokensCss.push(`${varName}: light-dark(${lightVal}, ${darkVal});`);
      } else if (modesPresent.includes("mobile") && modesPresent.includes("desktop")) {
        const mobileEntry = outPerMode["mobile"];
        const desktopEntry = outPerMode["desktop"];
        const mobileVarOrVal =
          mobileEntry && mobileEntry.primitive ? mobileEntry.primitive : mobileEntry && mobileEntry.value;
        const desktopVarOrVal =
          desktopEntry && desktopEntry.primitive ? desktopEntry.primitive : desktopEntry && desktopEntry.value;
        tokensCss.push(
          `${varName}: ${clampBetweenModes(mobileVarOrVal.startsWith("--") ? mobileVarOrVal : mobileEntry.value, desktopVarOrVal.startsWith("--") ? desktopVarOrVal : desktopEntry.value)};`,
        );
      } else {
        const onlyMode = modesPresent[0];
        const v = outPerMode[onlyMode];
        if (!v) {
          tokensCss.push(`/* ${varName}: missing value for mode ${onlyMode} */`);
        } else if (v.primitive) {
          tokensCss.push(`${varName}: var(${v.primitive});`);
        } else {
          tokensCss.push(`${varName}: ${v.value};`);
        }
      }
    }
  });

  return { primitivesJson: primitives, primitivesCss, tokensCss, tokensJson, modes: Array.from(modes), warnings };
}

module.exports = { extractColors };
