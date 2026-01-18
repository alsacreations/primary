const { toCssVarName, pxToRem, clampBetweenModes } = require("../utils");

function extractSpacing(entries) {
  const spacing = {};
  const tokensByName = {};

  entries.forEach(({ json, modeName }) => {
    // Spacing primitives may appear with different key casings in source exports
    const spacingSection = json.Spacing || json.spacing || json.spacings || null;
    if (spacingSection) {
      Object.keys(spacingSection).forEach((k) => {
        const v = spacingSection[k] && spacingSection[k].$value;
        const name = `--spacing-${k}`;
        spacing[name] = v;
      });
    }

    // Rounded (border radius) primitives (handle lowercase/uppercase variants)
    const roundedSection = json.Rounded || json.rounded || null;
    if (roundedSection) {
      Object.keys(roundedSection).forEach((k) => {
        const v = roundedSection[k] && roundedSection[k].$value;
        const name = `--radius-${k}`;
        spacing[name] = v;
      });
    }

    // tokens in top-level could also reference spacing
    Object.keys(json || {}).forEach((k) => {
      const v = json[k];
      if (
        v &&
        v.$type === "number" &&
        v.$extensions &&
        v.$extensions.com &&
        v.$extensions.com.figma &&
        v.$extensions.com.figma.variableId
      ) {
        // ignore complex detection here; server-side conversion will merge later
      }
    });
  });

  // Build primitives map (raw values)
  const primitives = {};
  const tokens = {};
  Object.keys(spacing).forEach((name) => {
    primitives[name] = spacing[name];
    // spacing does not have multi-mode variants in our current exports; expose tokens as references to primitives
    tokens[name] = { value: `var(${name})`, px: spacing[name] };
  });

  // CSS lines
  const css = Object.keys(spacing)
    .sort()
    .map((name) => `${name}: ${pxToRem(spacing[name])}; /* ${spacing[name]}px */`);
  return { primitives, json: tokens, css };
}

module.exports = { extractSpacing };
