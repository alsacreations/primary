const { toCssVarName, pxToRem, clampBetweenModes } = require("../utils");

function extractFonts(entries) {
  const fontSize = {};
  const lineHeight = {};
  const modes = new Set();

  entries.forEach(({ json, modeName }) => {
    if (modeName) modes.add(modeName.toLowerCase());
    const fontSizeSection = json.FontSize || json.fontSize || json["Font-Size"] || json.font || json.Font || null;
    if (fontSizeSection) {
      Object.keys(fontSizeSection).forEach((k) => {
        const v = fontSizeSection[k] && fontSizeSection[k].$value;
        // normalize keys like 'text-xs' -> 'xs' and numeric keys stay as-is
        const normalized = String(k).replace(/^text-/, "");
        fontSize[`--text-${normalized}`] = v;
      });
    }

    const lhSection =
      json.LineHeight ||
      json["Line-height"] ||
      json["lineheight"] ||
      json["line-height"] ||
      json.lineHeight ||
      json.lineheight ||
      null;
    if (lhSection) {
      const lh = lhSection;
      Object.keys(lh).forEach((k) => {
        const v = lh[k] && lh[k].$value;
        // normalize keys like 'lineheight-6xl' or 'line-height-6xl' -> '6xl'
        const normalized = String(k)
          .replace(/^line-?height-?/i, "")
          .replace(/^lineheight-?/i, "");
        lineHeight[`--line-height-${normalized}`] = v;
      });
    }
  });

  const css = [];
  Object.keys(fontSize)
    .sort()
    .forEach((k) => css.push(`${k}: ${pxToRem(fontSize[k])}; /* ${fontSize[k]}px */`));
  Object.keys(lineHeight)
    .sort()
    .forEach((k) => css.push(`${k}: ${pxToRem(lineHeight[k])}; /* ${lineHeight[k]}px */`));

  // Build token-like json referencing primitives and cross-mode tokens
  const tokensFont = {}; // tokenName -> { modes }
  const tokensLine = {};

  // tokens by name across modes: we need to collect from entries
  const fontTokensByName = {};
  const lineTokensByName = {};
  entries.forEach(({ json, modeName }) => {
    const mode = (modeName || "").toLowerCase();
    const fontSection = json.FontSize || json.fontSize || json["Font-Size"] || json.font || json.Font || null;
    if (fontSection) {
      Object.keys(fontSection).forEach((k) => {
        const normalized = String(k).replace(/^text-/, "");
        const token = `text-${normalized}`;
        fontTokensByName[token] = fontTokensByName[token] || {};
        fontTokensByName[token][mode] = fontSection[k] && fontSection[k].$value;
      });
    }
    const lhSection =
      json.LineHeight ||
      json["Line-height"] ||
      json["lineheight"] ||
      json["line-height"] ||
      json.lineHeight ||
      json.lineheight ||
      null;
    if (lhSection) {
      Object.keys(lhSection).forEach((k) => {
        const normalized = String(k)
          .replace(/^line-?height-?/i, "")
          .replace(/^lineheight-?/i, "");
        const token = `line-height-${normalized}`;
        lineTokensByName[token] = lineTokensByName[token] || {};
        lineTokensByName[token][mode] = lhSection[k] && lhSection[k].$value;
      });
    }
  });

  const tokensCss = [];
  const primitives = {};
  const tokenFontSize = {};
  const tokenLineHeight = {};

  const hasDeviceModes = modes.has("desktop") || modes.has("mobile");

  const warnings = [];

  Object.keys(fontTokensByName).forEach((token) => {
    const per = fontTokensByName[token];

    // If device modes are present in the workspace, and this token appears in a non-mode file (""):
    // only promote that fallback into device modes if at least one device-mode entry already exists
    // for this token. This avoids turning pure modeless primitives into tokens.
    if (hasDeviceModes && per[""] !== undefined && (per.desktop !== undefined || per.mobile !== undefined)) {
      const fallback = per[""];
      if (!per.desktop && !per.mobile) {
        per.desktop = fallback;
        per.mobile = fallback;
      } else if (!per.desktop && per.mobile) {
        per.desktop = fallback;
      } else if (per.desktop && !per.mobile) {
        per.mobile = fallback;
      }
      delete per[""];
    }

    const modesForToken = Object.keys(per);
    // If the workspace contains device modes (desktop/mobile), prefer token semantics
    if (modesForToken.length === 1 && modesForToken[0] === "") {
      // single unconditional value -> primitive
      const only = modesForToken[0];
      primitives[`--${token}`] = per[only];
    } else {
      // token (multi-mode or single-mode with a named mode like 'desktop'/'mobile')
      // Single named mode present -> treat as primitive (use source value)
      if (modesForToken.length === 1 && modesForToken[0] !== "") {
        const only = modesForToken[0];
        primitives[`--${token}`] = per[only];
        return;
      }

      tokenFontSize[`--${token}`] = { value: `var(--${token})`, modes: per };
      if (modesForToken.includes("mobile") && modesForToken.includes("desktop")) {
        tokensCss.push(`--${token}: ${clampBetweenModes(per["mobile"], per["desktop"])};`);
      } else if (modesForToken.includes("light") && modesForToken.includes("dark")) {
        tokensCss.push(`--${token}: light-dark(${pxToRem(per["light"])}, ${pxToRem(per["dark"])});`);
      } else {
        // single named mode available (e.g., only 'desktop') -> set token to that value
        const only = modesForToken[0];
        const val = per[only];
        tokensCss.push(`--${token}: ${pxToRem(val)};`);
      }
    }
  });

  // Line-height tokens
  Object.keys(lineTokensByName).forEach((token) => {
    const per = lineTokensByName[token];
    // promote non-mode value into device modes only if at least one device-mode entry exists for this token
    if (hasDeviceModes && per[""] !== undefined && (per.desktop !== undefined || per.mobile !== undefined)) {
      const fallback = per[""];
      if (!per.desktop && !per.mobile) {
        per.desktop = fallback;
        per.mobile = fallback;
      } else if (!per.desktop && per.mobile) {
        per.desktop = fallback;
      } else if (per.desktop && !per.mobile) {
        per.mobile = fallback;
      }
      delete per[""];
    }

    const modesForToken = Object.keys(per);
    if (modesForToken.length === 1 && modesForToken[0] === "") {
      primitives[`--${token}`] = per[modesForToken[0]];
    } else {
      // Single named mode present -> treat as primitive instead of token
      if (modesForToken.length === 1 && modesForToken[0] !== "") {
        const only = modesForToken[0];
        primitives[`--${token}`] = per[only];
        return;
      }

      tokenLineHeight[`--${token}`] = { value: `var(--${token})`, modes: per };
      if (modesForToken.includes("mobile") && modesForToken.includes("desktop")) {
        tokensCss.push(`--${token}: ${clampBetweenModes(per["mobile"], per["desktop"])};`);
      } else if (modesForToken.includes("light") && modesForToken.includes("dark")) {
        tokensCss.push(`--${token}: light-dark(${pxToRem(per["light"])}, ${pxToRem(per["dark"])});`);
      } else {
        const only = modesForToken[0];
        const val = per[only];
        tokensCss.push(`--${token}: ${pxToRem(val)};`);
      }
    }
  });

  // Cleanup: ensure modeless-only tokens (present only in files without a recognized mode) are treated as primitives
  Object.keys(lineTokensByName).forEach((token) => {
    const per = lineTokensByName[token];
    const modes = Object.keys(per);
    if (modes.length === 1 && modes[0] === "") {
      primitives[`--${token}`] = per[""];
      if (tokenLineHeight[`--${token}`]) delete tokenLineHeight[`--${token}`];
      // remove any tokensCss entry for this token
      for (let i = tokensCss.length - 1; i >= 0; i--) {
        if (tokensCss[i].startsWith(`--${token}:`)) tokensCss.splice(i, 1);
      }
    }
  });

  Object.keys(fontTokensByName).forEach((token) => {
    const per = fontTokensByName[token];
    const modes = Object.keys(per);
    if (modes.length === 1 && modes[0] === "") {
      primitives[`--${token}`] = per[""];
      if (tokenFontSize[`--${token}`]) delete tokenFontSize[`--${token}`];
      for (let i = tokensCss.length - 1; i >= 0; i--) {
        if (tokensCss[i].startsWith(`--${token}:`)) tokensCss.splice(i, 1);
      }
    }
  });

  return { primitives, json: { fontSize: tokenFontSize, lineHeight: tokenLineHeight }, css, tokensCss, warnings };

  // Prefer token semantics if device modes are present
  Object.keys(lineTokensByName).forEach((token) => {
    const per = lineTokensByName[token];
    // promote non-mode value into device modes when applicable
    if (hasDeviceModes && per[""] !== undefined) {
      const fallback = per[""];
      if (!per.desktop && !per.mobile) {
        per.desktop = fallback;
        per.mobile = fallback;
      } else if (!per.desktop && per.mobile) {
        per.desktop = fallback;
      } else if (per.desktop && !per.mobile) {
        per.mobile = fallback;
      }
      delete per[""];
    }

    const modesForToken = Object.keys(per);
    if (modesForToken.length === 1 && modesForToken[0] === "" && !hasDeviceModes) {
      primitives[`--${token}`] = per[modesForToken[0]];
    } else {
      tokenLineHeight[`--${token}`] = { value: `var(--${token})`, modes: per };
      if (modesForToken.includes("mobile") && modesForToken.includes("desktop")) {
        tokensCss.push(`--${token}: ${clampBetweenModes(per["mobile"], per["desktop"])};`);
      } else if (modesForToken.includes("light") && modesForToken.includes("dark")) {
        tokensCss.push(`--${token}: light-dark(${pxToRem(per["light"])}, ${pxToRem(per["dark"])});`);
      } else {
        const only = modesForToken[0];
        const val = per[only];
        tokensCss.push(`--${token}: ${pxToRem(val)};`);
      }
    }
  });

  return { primitives, json: { fontSize: tokenFontSize, lineHeight: tokenLineHeight }, css, tokensCss };
}

module.exports = { extractFonts };
