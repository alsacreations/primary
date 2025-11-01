// Client-side port of scripts/figma-import.js (generation logic)
// Exposes generateCanonicalThemeFromFigma({ primitives, fonts, tokenColors })
// which returns { themeCss, tokensCss }

function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearRgbToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { L, a, b: b_ };
}

function oklabToOklch(L, a, b) {
  const C = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return { L, C, h };
}

function formatNumber(n) {
  const s = Number(n).toFixed(4);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function figmaColorToCss(c) {
  const r = srgbToLinear(Number(c.r));
  const g = srgbToLinear(Number(c.g));
  const b = srgbToLinear(Number(c.b));
  const { L, a, b: bb } = linearRgbToOklab(r, g, b);
  const { C, h } = oklabToOklch(L, a, bb);
  const Lstr = formatNumber(L);
  const Cstr = formatNumber(C);
  const Hstr = formatNumber(h);
  const alpha = typeof c.a === "number" ? formatNumber(c.a) : null;
  const base = `oklch(${Lstr} ${Cstr} ${Hstr}`;
  return alpha && alpha !== "1" ? `${base} / ${alpha})` : base + `)`;
}

function pxToRem(px) {
  const rem = Number(px) / 16;
  if (Number(px) === 0) return "0";
  return formatNumber(rem) + "rem";
}

function sanitizeVarName(name) {
  return (
    "--" + String(name).replace(/\//g, "-").replace(/\s+/g, "-").toLowerCase()
  );
}

function fontVarName(figmaName) {
  const parts = String(figmaName).split("/");
  const last = parts[parts.length - 1];
  return "--" + String(last).replace(/\s+/g, "-").toLowerCase();
}

// Local storage for synthesized project semantics when generating
// This replaces previous usage of `generate._projectSemantics` which
// caused a ReferenceError in the browser environment.
const PROJECT_SEMANTICS = [];

export function generateCanonicalThemeFromFigma({
  primitives,
  fonts,
  tokenColors,
  // Flag: when true, synthesize project primitives (extrapolated colors)
  // from semantic tokens and aliases; when false, skip emitting the
  // "Couleurs personnalisées (projet) - primitives synthétisées" block.
  synthesizeProjectPrimitives = true,
} = {}) {
  // Debug: in-browser callers sometimes pass unexpected arrays due to
  // classification bugs or caching; log counts to help diagnose missing
  // primitives reported by tokens generation.
  try {
    const pcount =
      (primitives && primitives.variables && primitives.variables.length) || 0;
    const tcount =
      (tokenColors && tokenColors.variables && tokenColors.variables.length) ||
      0;
    const fcount = (fonts && fonts.variables && fonts.variables.length) || 0;
    console.log(
      "[figma-gen-debug] called with primitives=%d tokenColors=%d fonts=%d",
      pcount,
      tcount,
      fcount
    );
    try {
      if (
        typeof window !== "undefined" &&
        window.__PRIMARY_STATE &&
        window.__PRIMARY_STATE._debug
      ) {
        window.__PRIMARY_STATE._logs = window.__PRIMARY_STATE._logs || [];
        window.__PRIMARY_STATE._logs.push({
          tag: "figma-gen-debug",
          primitives: pcount,
          tokenColors: tcount,
          fonts: fcount,
          ts: Date.now(),
        });
      }
    } catch (e) {
      /* noop */
    }
  } catch (e) {
    /* noop */
  }
  // Reset any previously synthesized semantics to ensure each invocation is
  // pure and doesn't accumulate results from earlier runs (prevents
  // "invented" variables persisting across multiple calls).
  PROJECT_SEMANTICS.length = 0;
  // primitives, fonts, tokenColors are objects parsed from respective JSON files
  primitives = primitives || { variables: [] };
  fonts = fonts || { variables: [] };
  tokenColors = tokenColors || { variables: [] };

  let themeCss = `/* ----------------------------------\n * Theme du projet (valeurs primitives)\n * ----------------------------------\n */\n:root {\n`;
  themeCss += `  /* Breakpoints (en dur) */\n`;
  themeCss += `  --md: 48rem; /* 768px */\n`;
  themeCss += `  --lg: 64rem; /* 1024px */\n`;
  themeCss += `  --xl: 80rem; /* 1280px */\n`;
  themeCss += `  --xxl: 96rem; /* 1536px */\n\n`;

  const colors = [];
  const primitivesAsSemantics = [];
  const preSynth = Object.create(null);
  const spacings = [];
  const roundeds = [];
  const others = [];
  const lineheightPrimitives = [];

  const spacingPrefixes = new Set(["spacing", "space", "gap"]);
  const roundedPrefixes = new Set(["rounded", "radius", "border-radius"]);

  // Build quick lookup indices for resolving aliases transitively across
  // primitives and tokenColors. Some Figma exports use variable aliases that
  // point to other variables; to ensure parity with the Node generator we
  // must follow alias chains and materialize primitives when a resolved RGB
  // value can be found further down the chain.
  const idIndex = Object.create(null);
  const nameIndex = Object.create(null);
  const collectVar = (v) => {
    if (!v || !v.id) return;
    idIndex[v.id] = v;
    if (v.name) {
      nameIndex[String(v.name)] = v;
      try {
        const s = sanitizeVarName(v.name);
        nameIndex[s] = v;
        nameIndex[String(v.name).toLowerCase()] = v;
        nameIndex[s.toLowerCase()] = v;
      } catch (e) {
        /* noop */
      }
    }
  };
  for (const v of primitives.variables || []) collectVar(v);
  for (const v of tokenColors.variables || []) collectVar(v);

  // Compute set of token names (sanitized) to avoid emitting semantic tokens
  // directly into themeCss. Semantic tokens must remain in tokensCss. We
  // include token names and any aliasNames referenced by tokenColors.
  const tokenNameSet = new Set();
  for (const tv of tokenColors.variables || []) {
    if (tv.name) tokenNameSet.add(sanitizeVarName(tv.name));
    const modes = tv.resolvedValuesByMode || {};
    for (const mk of Object.keys(modes || {})) {
      const entry = modes[mk] || {};
      if (entry && entry.aliasName)
        tokenNameSet.add(sanitizeVarName(entry.aliasName));
    }
  }

  const resolveVarRgb = (v, visited = new Set()) => {
    if (!v || visited.has(v)) return null;
    visited.add(v);
    const modes = v.resolvedValuesByMode || v.valuesByMode || {};
    const modeKey = Object.keys(modes || {})[0];
    const entry = modes[modeKey];
    if (!entry) return null;
    const rv = entry.resolvedValue || entry;
    if (rv && typeof rv === "object" && typeof rv.r === "number") return rv;
    // follow aliasName or alias id
    if (entry.aliasName) {
      const candidates = [
        entry.aliasName,
        String(entry.aliasName).toLowerCase(),
        sanitizeVarName(entry.aliasName),
        sanitizeVarName(entry.aliasName).toLowerCase(),
      ];
      for (const c of candidates) {
        if (c && nameIndex[c]) return resolveVarRgb(nameIndex[c], visited);
      }
    }
    if (entry.alias && idIndex[entry.alias]) {
      return resolveVarRgb(idIndex[entry.alias], visited);
    }
    return null;
  };

  for (const v of primitives.variables || []) {
    const name = v.name || "";
    const sName = sanitizeVarName(name);
    // Heuristic: treat as color when type is COLOR, or the name contains
    // "color" (many exports use 'color/...' names), or the per-mode values
    // clearly look like color strings/objects. Some Figma exports omit
    // v.type, so this improves robustness.
    const likelyColor =
      v.type === "COLOR" ||
      String(name).toLowerCase().includes("color") ||
      Object.values(v.valuesByMode || v.resolvedValuesByMode || {}).some(
        (entry) => {
          if (!entry) return false;
          if (typeof entry === "string")
            return /^(#|rgb|hsl|oklch|oklab)/i.test(entry.trim());
          const rv = entry.resolvedValue || entry;
          return typeof rv === "object" && typeof rv.r === "number";
        }
      );

    if (likelyColor) {
      // Emit primitives that were explicitly provided in the import.
      // Previously we skipped emitting a primitive when its sanitized
      // name appeared in tokenNames; that caused legitimate project
      // primitives to be omitted if tokenColors referenced the same
      // name. To avoid removing user-provided primitives, always
      // continue processing primitives.variables entries and emit them
      // into themeCss. Token-only names (coming from tokenColors) are
      // still handled later during token synthesis.
      let css = null;
      // Try to resolve an RGB value possibly following alias chains
      const rv = resolveVarRgb(v);
      if (rv) css = figmaColorToCss(rv);
      else {
        // fallback: accept direct OKLCH strings in values
        const modes = v.valuesByMode || v.resolvedValuesByMode || {};
        const modeKey = Object.keys(modes || {})[0];
        const entry = modes[modeKey];
        if (
          entry &&
          typeof entry === "string" &&
          entry.trim().toLowerCase().startsWith("oklch(")
        )
          css = entry.trim();
      }
      if (css) {
        // Collect any alias-based sub-primitives referenced by this
        // semantic variable (e.g. aliasName: "color/blue/400") so we can
        // synthesize the underlying primitive `--color-blue-400` even when
        // that variable isn't present separately in the import.
        try {
          // Prefer resolvedValuesByMode when available: some exports put
          // aliases in valuesByMode while resolvedValuesByMode contains the
          // actual resolved RGB + aliasName. Use resolvedValuesByMode first.
          const modes = v.resolvedValuesByMode || v.valuesByMode || {};
          for (const mk of Object.keys(modes || {})) {
            const entry = modes[mk] || {};
            const rv = (entry && (entry.resolvedValue || entry)) || null;
            if (
              entry &&
              entry.aliasName &&
              rv &&
              typeof rv === "object" &&
              typeof rv.r === "number"
            ) {
              try {
                const aliasVar = sanitizeVarName(entry.aliasName);
                if (!preSynth[aliasVar])
                  preSynth[aliasVar] = figmaColorToCss(rv);
              } catch (e) {
                /* noop */
              }
            }
          }
        } catch (e) {
          /* noop */
        }

        // If the sanitized name does not follow the primitive naming
        // convention (i.e. it doesn't start with "--color-"), treat this
        // entry as a semantic token that must live in tokensCss rather than
        // as a raw primitive in themeCss. Collect it for later injection
        // into PROJECT_SEMANTICS so it appears in theme-tokens.css.
        if (!sName.startsWith("--color-")) {
          primitivesAsSemantics.push({ name: sName, css });
        } else {
          colors.push({ name, css });
        }
      } else {
        // Debug: report skipped color primitives and nearby data to help
        // diagnose why the browser-side generation does not emit them.
        try {
          const modes = v.valuesByMode || v.resolvedValuesByMode || {};
          console.log("[figma-gen-skip] skipped color primitive", name, {
            type: v.type,
            modesCount: Object.keys(modes).length,
            sampleModeKey: Object.keys(modes)[0],
            sampleEntry: modes[Object.keys(modes)[0]] || null,
          });
          try {
            if (
              typeof window !== "undefined" &&
              window.__PRIMARY_STATE &&
              window.__PRIMARY_STATE._debug
            ) {
              window.__PRIMARY_STATE._logs = window.__PRIMARY_STATE._logs || [];
              window.__PRIMARY_STATE._logs.push({
                tag: "figma-gen-skip",
                name,
                modesCount: Object.keys(modes).length,
                sampleModeKey: Object.keys(modes)[0],
                sampleEntry: modes[Object.keys(modes)[0]] || null,
                ts: Date.now(),
              });
            }
          } catch (e) {
            /* noop */
          }
        } catch (e) {
          /* noop */
        }
        continue; // skip non-resolvable color primitives
      }
    } else if (v.type === "FLOAT" || v.type === "NUMBER") {
      const modeKey = Object.keys(v.valuesByMode || {})[0];
      const px = v.valuesByMode[modeKey];
      const first = (name.split("/")[0] || "").toLowerCase();
      if (spacingPrefixes.has(first)) spacings.push({ name, px });
      else if (roundedPrefixes.has(first)) roundeds.push({ name, px });
      else if (/(^line[- ]?height$|^leading$)/i.test(first))
        lineheightPrimitives.push({ name, px });
      else if (name.toLowerCase().startsWith("fontsize/")) {
        // skip
      } else others.push({ name, px });
    }
  }

  const sortByName = (a, b) => a.name.localeCompare(b.name, "en");

  if (colors.length) {
    const groups = {
      gray: [],
      error: [],
      success: [],
      warning: [],
      info: [],
      others: [],
    };
    for (const c of colors) {
      const parts = c.name.split("/").map((p) => p.toLowerCase());
      const semantic = parts[1] || "";
      if (semantic === "gray") groups.gray.push(c);
      else if (semantic === "error") groups.error.push(c);
      else if (semantic === "success") groups.success.push(c);
      else if (semantic === "warning") groups.warning.push(c);
      else if (semantic === "info") groups.info.push(c);
      else groups.others.push(c);
    }

    themeCss += `\n  /* Couleurs globales */\n`;
    const emitGroup = (arr) => {
      const numericSuffix = (varName) => {
        const n = sanitizeVarName(varName);
        const m = n.match(/-(\d+)$/);
        return m ? Number(m[1]) : null;
      };
      arr
        .sort((a, b) => {
          const aa = numericSuffix(a.name);
          const bb = numericSuffix(b.name);
          if (aa !== null && bb !== null) return aa - bb;
          if (aa !== null) return -1;
          if (bb !== null) return 1;
          return sanitizeVarName(a.name).localeCompare(
            sanitizeVarName(b.name),
            "en"
          );
        })
        .forEach((c) => {
          themeCss += `  ${sanitizeVarName(c.name)}: ${c.css};\n`;
        });
    };

    const hasWhite = colors.some(
      (c) => sanitizeVarName(c.name) === "--color-white"
    );
    const hasBlack = colors.some(
      (c) => sanitizeVarName(c.name) === "--color-black"
    );
    if (!hasWhite) themeCss += `  --color-white: oklch(1 0 0);\n`;
    if (!hasBlack) themeCss += `  --color-black: oklch(0 0 0);\n`;

    emitGroup(groups.gray);
    emitGroup(groups.error);
    emitGroup(groups.success);
    emitGroup(groups.warning);
    emitGroup(groups.info);
    emitGroup(groups.others);

    const colorMap = {};
    colors.forEach((c) => {
      colorMap[sanitizeVarName(c.name)] = c.css;
    });
    if (!hasWhite) colorMap["--color-white"] = "oklch(1 0 0)";
    if (!hasBlack) colorMap["--color-black"] = "oklch(0 0 0)";

    // tokenColors synthesis
    try {
      const tokenColorsVars = (tokenColors && tokenColors.variables) || [];
      const modeMap = tokenColors.modes || {};
      let lightModeId = null;
      let darkModeId = null;
      for (const k of Object.keys(modeMap)) {
        if (modeMap[k] === "light") lightModeId = k;
        if (modeMap[k] === "dark") darkModeId = k;
      }
      const modeKeys = Object.keys(modeMap);
      if (!lightModeId && modeKeys.length) lightModeId = modeKeys[0];
      if (!darkModeId && modeKeys.length > 1) darkModeId = modeKeys[1];

      const projectSemantics = [];
      const synthesizedMap = {};
      let needColorScheme = false;

      for (const v of tokenColorsVars) {
        const rawName = (v.name || "").toLowerCase().replace(/\s+/g, "-");
        const primLightName = `--color-${rawName}-light`;
        const primDarkName = `--color-${rawName}-dark`;
        const rvLight =
          v.resolvedValuesByMode && v.resolvedValuesByMode[lightModeId];
        const rvDark = darkModeId
          ? v.resolvedValuesByMode && v.resolvedValuesByMode[darkModeId]
          : null;
        let lightPrim = null;
        let lightRaw = null;
        if (rvLight && rvLight.aliasName) {
          const aliasVar = sanitizeVarName(rvLight.aliasName);
          lightPrim = aliasVar;
          if (!colorMap[aliasVar]) {
            // try to resolve the alias transitively (follow alias chains)
            const aliasTarget = nameIndex && nameIndex[rvLight.aliasName];
            const resolved = aliasTarget ? resolveVarRgb(aliasTarget) : null;
            if (resolved) {
              const raw = figmaColorToCss(resolved);
              if (synthesizeProjectPrimitives) {
                synthesizedMap[aliasVar] = raw;
                colorMap[aliasVar] = raw;
              } else {
                lightRaw = raw;
                lightPrim = null; // prefer raw when not synthesizing
              }
            } else if (rvLight.resolvedValue) {
              const raw = figmaColorToCss(rvLight.resolvedValue);
              if (synthesizeProjectPrimitives) {
                synthesizedMap[aliasVar] = raw;
                colorMap[aliasVar] = raw;
              } else {
                lightRaw = raw;
                lightPrim = null;
              }
            }
          }
        } else if (rvLight && rvLight.resolvedValue) {
          lightPrim = primLightName;
          const raw = figmaColorToCss(rvLight.resolvedValue);
          if (synthesizeProjectPrimitives) {
            if (!colorMap[lightPrimName]) {
              synthesizedMap[lightPrimName] = raw;
              colorMap[lightPrimName] = raw;
            }
          } else {
            // don't synthesize prim var; keep raw for semantic output
            lightRaw = raw;
            lightPrim = null;
          }
        }

        let darkPrim = null;
        let darkRaw = null;
        if (rvDark && rvDark.aliasName) {
          const aliasVar = sanitizeVarName(rvDark.aliasName);
          darkPrim = aliasVar;
          if (!colorMap[aliasVar]) {
            const aliasTarget = nameIndex && nameIndex[rvDark.aliasName];
            const resolved = aliasTarget ? resolveVarRgb(aliasTarget) : null;
            if (resolved) {
              const raw = figmaColorToCss(resolved);
              if (synthesizeProjectPrimitives) {
                synthesizedMap[aliasVar] = raw;
                colorMap[aliasVar] = raw;
              } else {
                darkRaw = raw;
                darkPrim = null;
              }
            } else if (rvDark.resolvedValue) {
              const raw = figmaColorToCss(rvDark.resolvedValue);
              if (synthesizeProjectPrimitives) {
                synthesizedMap[aliasVar] = raw;
                colorMap[aliasVar] = raw;
              } else {
                darkRaw = raw;
                darkPrim = null;
              }
            }
          }
        } else if (rvDark && rvDark.resolvedValue) {
          darkPrim = primDarkName;
          const raw = figmaColorToCss(rvDark.resolvedValue);
          if (synthesizeProjectPrimitives) {
            if (!colorMap[primDarkName]) {
              synthesizedMap[primDarkName] = raw;
              colorMap[primDarkName] = raw;
            }
          } else {
            darkRaw = raw;
            darkPrim = null;
          }
        }

        // Build the semantic entry. Prefer var(...) when a primitive var is
        // available; otherwise fall back to inline OKLCH values (light/dark
        // or single value) depending on what we resolved above.
        if (darkPrim) {
          needColorScheme = true;
          projectSemantics.push(
            `  --${rawName}: light-dark(var(${lightPrim}), var(${darkPrim}));`
          );
        } else if (lightPrim) {
          projectSemantics.push(`  --${rawName}: var(${lightPrim});`);
        } else if (lightRaw || darkRaw) {
          if (darkRaw) {
            needColorScheme = true;
            projectSemantics.push(
              `  --${rawName}: light-dark(${lightRaw}, ${darkRaw});`
            );
          } else {
            projectSemantics.push(`  --${rawName}: ${lightRaw};`);
          }
        }
      }
      if (synthesizeProjectPrimitives) {
        // Merge pre-synthesized primitives collected from semantic variables
        // earlier into the synthesizedMap so they will be emitted in the
        // "Couleurs personnalisées (projet) - primitives synthétisées" block.
        try {
          for (const k of Object.keys(preSynth || {})) {
            if (!synthesizedMap[k]) synthesizedMap[k] = preSynth[k];
          }
        } catch (e) {
          /* noop */
        }
        const synthKeys = Object.keys(synthesizedMap || {});
        if (synthKeys.length) {
          synthKeys.sort((a, b) => {
            const na = a.replace(/^--/, "");
            const nb = b.replace(/^--/, "");
            const ma = na.match(/^(.*?)-(\d+)$/);
            const mb = nb.match(/^(.*?)-(\d+)$/);
            const baseA = ma ? ma[1] : na;
            const baseB = mb ? mb[1] : nb;
            if (baseA !== baseB) return baseA.localeCompare(baseB, "en");
            if (ma && mb) return Number(ma[2]) - Number(mb[2]);
            if (ma) return -1;
            if (mb) return 1;
            return na.localeCompare(nb, "en");
          });
          themeCss += `\n  /* Couleurs personnalisées (projet) - primitives synthétisées */\n`;
          for (const k of synthKeys)
            themeCss += `  ${k}: ${synthesizedMap[k]};\n`;
        }
      }
      // If any primitives were detected as semantic tokens, add them to
      // the project semantics so they appear in tokensCss (and not in themeCss)
      if (primitivesAsSemantics.length) {
        // Prefer referencing an existing primitive when the semantic value
        // exactly matches a primitive's CSS value. This enforces the
        // project's split: primitives in theme.css, semantics in theme-tokens.css
        const semLines = primitivesAsSemantics.map((p) => {
          // try to find a primitive var name that has the same CSS value
          let mapped = null;
          try {
            for (const k of Object.keys(colorMap || {})) {
              if (colorMap[k] === p.css) {
                mapped = k;
                break;
              }
            }
          } catch (e) {
            /* noop */
          }
          if (mapped) return `  ${p.name}: var(${mapped});`;
          return `  ${p.name}: ${p.css};`;
        });
        PROJECT_SEMANTICS.push({ lines: semLines, needColorScheme: false });
      }
      if (projectSemantics.length) {
        // Store synthesized semantic lines for later injection into tokensCss
        PROJECT_SEMANTICS.push({ lines: projectSemantics, needColorScheme });
      }
    } catch (e) {
      // ignore
    }
  }

  if (spacings.length) {
    themeCss += `\n  /* Espacements */\n`;
    spacings
      .sort((a, b) => Number(a.px) - Number(b.px))
      .forEach((s) => {
        themeCss += `  ${sanitizeVarName(s.name)}: ${pxToRem(s.px)};\n`;
      });
  }

  if (roundeds.length) {
    themeCss += `\n  /* Border radius */\n`;
    roundeds
      .sort((a, b) => Number(a.px) - Number(b.px))
      .forEach((r) => {
        const px = Math.round(Number(r.px));
        const name = `--radius-${px}`;
        themeCss += `  ${name}: ${pxToRem(r.px)};\n`;
      });
  }

  if (lineheightPrimitives.length) {
    lineheightPrimitives
      .sort((a, b) => Number(a.px) - Number(b.px))
      .forEach((lh) => {
        const px = Math.round(Number(lh.px));
        const name = `--line-height-${px}`;
        themeCss += `  ${name}: ${pxToRem(lh.px)};\n`;
      });
  }

  if (others.length) {
    themeCss += `\n  /* Others */\n`;
    others.sort(sortByName).forEach((o) => {
      themeCss += `  ${sanitizeVarName(o.name)}: ${o.px};\n`;
    });
  }

  // Continue with fonts primitives processing from fonts.variables
  // Build tokensCss similar to Node logic
  let tokensCss = `/* ----------------------------------\n * Theme-tokens\n * Surcouche de theme.css\n * ----------------------------------\n */\n:root {\n`;

  // project semantics injection
  let projectNeedColorScheme = false;
  if (PROJECT_SEMANTICS && PROJECT_SEMANTICS.length) {
    const all = PROJECT_SEMANTICS.reduce(
      (acc, cur) => {
        if (cur.lines && cur.lines.length) acc.lines.push(...cur.lines);
        if (cur.needColorScheme) acc.needColorScheme = true;
        return acc;
      },
      { lines: [], needColorScheme: false }
    );
    projectNeedColorScheme = Boolean(all.needColorScheme);
    if (all.needColorScheme) {
      const cs = `  color-scheme: light dark;\n\n  &[data-theme="light"] {\n    color-scheme: light;\n  }\n\n  &[data-theme="dark"] {\n    color-scheme: dark;\n  }\n\n`;
      tokensCss = tokensCss.replace(":root {\n", `:root {\n${cs}`);
    }
    if (all.lines.length) {
      tokensCss += `\n  /* Couleurs personnalisées (projet) */\n`;
      tokensCss += all.lines.join("\n") + "\n";
    }
  }

  // font sizes and line heights
  const fontSizes = [];
  const lineHeights = [];
  for (const v of fonts.variables || []) {
    const name = v.name || "";
    const first = (name.split("/")[0] || "").toLowerCase();
    const fontSizePrefixes = new Set([
      "fontsize",
      "font-size",
      "text",
      "textsize",
    ]);
    const lineHeightPrefixes = new Set([
      "lineheight",
      "line-height",
      "leading",
    ]);
    if (
      fontSizePrefixes.has(first) ||
      name.toLowerCase().startsWith("fontsize/")
    ) {
      const varName = fontVarName(name);
      const modes = Object.keys(v.resolvedValuesByMode || {});
      const mobileKey = modes[0];
      const desktopKey = modes[1] || mobileKey;
      const mobileVal =
        v.resolvedValuesByMode[mobileKey] &&
        v.resolvedValuesByMode[mobileKey].resolvedValue;
      const desktopVal =
        v.resolvedValuesByMode[desktopKey] &&
        v.resolvedValuesByMode[desktopKey].resolvedValue;
      if (typeof mobileVal === "number" && typeof desktopVal === "number")
        fontSizes.push({
          varName,
          minRem: mobileVal / 16,
          maxRem: desktopVal / 16,
        });
    }
    if (
      lineHeightPrefixes.has(first) ||
      name.toLowerCase().startsWith("lineheight/")
    ) {
      const rawLast = name.split("/").pop().toLowerCase().replace(/\s+/g, "-");
      const key = rawLast.replace(/^(lineheight|line-height|leading)-?/, "");
      const varName = `--line-height-${key}`;
      const modes = Object.keys(v.resolvedValuesByMode || {});
      const mobileKey = modes[0];
      const desktopKey = modes[1] || mobileKey;
      const mobileVal =
        v.resolvedValuesByMode[mobileKey] &&
        v.resolvedValuesByMode[mobileKey].resolvedValue;
      const desktopVal =
        v.resolvedValuesByMode[desktopKey] &&
        v.resolvedValuesByMode[desktopKey].resolvedValue;
      if (typeof mobileVal === "number" && typeof desktopVal === "number")
        lineHeights.push({
          varName,
          minRem: mobileVal / 16,
          maxRem: desktopVal / 16,
        });
    }
  }

  fontSizes.sort((a, b) => a.minRem - b.minRem);
  lineHeights.sort((a, b) => a.minRem - b.minRem);

  const fontPrimitives = [];
  const linePrimitives = [];
  for (const f of fontSizes) {
    const partsF = f.varName.slice(2).split("-");
    let prefix = partsF.slice(0, partsF.length - 1).join("-") || partsF[0];
    if (/^(lineheight|line-height|leading)$/i.test(prefix))
      prefix = "line-height";
    if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text";
    const minPx = Math.round(f.minRem * 16);
    const maxPx = Math.round(f.maxRem * 16);
    fontPrimitives.push({
      name: `--${prefix}-${minPx}`,
      rem: formatNumber(f.minRem) + "rem",
      px: minPx,
    });
    fontPrimitives.push({
      name: `--${prefix}-${maxPx}`,
      rem: formatNumber(f.maxRem) + "rem",
      px: maxPx,
    });
  }
  for (const lh of lineHeights) {
    const partsL = lh.varName.slice(2).split("-");
    let prefix = partsL.slice(0, partsL.length - 1).join("-") || partsL[0];
    if (/^(lineheight|line-height|leading)$/i.test(prefix))
      prefix = "line-height";
    if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text";
    const minPx = Math.round(lh.minRem * 16);
    const maxPx = Math.round(lh.maxRem * 16);
    linePrimitives.push({
      name: `--${prefix}-${minPx}`,
      rem: formatNumber(lh.minRem) + "rem",
      px: minPx,
    });
    linePrimitives.push({
      name: `--${prefix}-${maxPx}`,
      rem: formatNumber(lh.maxRem) + "rem",
      px: maxPx,
    });
  }

  if (fontPrimitives.length) {
    const seen = new Set();
    fontPrimitives.sort((a, b) => a.px - b.px);
    themeCss += `\n  /* Typographie — Tailles de police */\n`;
    for (const p of fontPrimitives) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      themeCss += `  ${p.name}: ${p.rem};\n`;
    }
  }

  // families and weights
  const families = [
    { name: "--font-base", value: "system-ui, sans-serif" },
    { name: "--font-mono", value: "ui-monospace, monospace" },
  ];
  const weights = [
    { name: "--font-weight-regular", value: "400" },
    { name: "--font-weight-semibold", value: "600" },
    { name: "--font-weight-bold", value: "700" },
    { name: "--font-weight-extrabold", value: "800" },
    { name: "--font-weight-black", value: "900" },
  ];
  const missingFamily = families.some(
    (f) => !new RegExp(`${f.name}\s*:`).test(themeCss)
  );
  const missingWeight = weights.some(
    (w) => !new RegExp(`${w.name}\s*:`).test(themeCss)
  );
  if (missingFamily || missingWeight) {
    themeCss += `\n  /* Typographie - Familles de police */\n`;
    for (const f of families)
      if (!new RegExp(`${f.name}\s*:`).test(themeCss))
        themeCss += `  ${f.name}: ${f.value};\n`;
    themeCss += `\n  /* Typographie - Graisses de police */\n`;
    for (const w of weights)
      if (!new RegExp(`${w.name}\s*:`).test(themeCss))
        themeCss += `  ${w.name}: ${w.value};\n`;
  }

  if (linePrimitives.length) {
    const seenLine = new Set();
    linePrimitives.sort((a, b) => a.px - b.px);
    themeCss += `\n  /* Typographie — Hauteurs de lignes */\n`;
    for (const p of linePrimitives) {
      if (seenLine.has(p.name)) continue;
      seenLine.add(p.name);
      themeCss += `  ${p.name}: ${p.rem};\n`;
    }
  }

  // transitions and z
  const ensureVar = (name) => new RegExp(`${name}\s*:`).test(themeCss);
  const missingTransitions = [];
  if (!ensureVar("--transition-duration"))
    missingTransitions.push("  --transition-duration: 0.25s;");
  const missingZ = [];
  if (!ensureVar("--z-under-page-level"))
    missingZ.push("  --z-under-page-level: -1;");
  if (!ensureVar("--z-above-page-level"))
    missingZ.push("  --z-above-page-level: 1;");
  if (!ensureVar("--z-header-level"))
    missingZ.push("  --z-header-level: 1000;");
  if (!ensureVar("--z-above-header-level"))
    missingZ.push("  --z-above-header-level: 2000;");
  if (!ensureVar("--z-above-all-level"))
    missingZ.push("  --z-above-all-level: 3000;");
  if (missingTransitions.length || missingZ.length) {
    themeCss += `\n  /* Transitions et animations */\n`;
    missingTransitions.forEach((l) => (themeCss += l + "\n"));
    themeCss += `\n  /* Niveaux de z-index */\n`;
    missingZ.forEach((l) => (themeCss += l + "\n"));
  }

  themeCss += `\n}\n`;
  themeCss = themeCss.replace(/\n{3,}/g, "\n\n");

  // build primitiveNames set
  const primitiveNames = new Set();
  const varRe = /^\s*(--[a-z0-9-]+)\s*:/gim;
  let vm;
  while ((vm = varRe.exec(themeCss)) !== null) primitiveNames.add(vm[1]);

  function preferredValue(minRem, maxRem, wMin = 360, wMax = 1280) {
    if (minRem === maxRem) return formatNumber(minRem) + "rem";
    const D = ((maxRem - minRem) * 1600) / (wMax - wMin);
    const C = minRem - (D * wMin) / 1600;
    return `${formatNumber(C)}rem + ${formatNumber(D)}vw`;
  }

  // tokensCss typography
  if (fontSizes.length) {
    tokensCss += `\n  /* Typographie — Tailles de police */\n`;
    for (const f of fontSizes) {
      const partsFtok = f.varName.slice(2).split("-");
      let prefix =
        partsFtok.slice(0, partsFtok.length - 1).join("-") || partsFtok[0];
      if (/^(lineheight|line-height|leading)$/i.test(prefix))
        prefix = "line-height";
      if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text";
      const minPx = Math.round(f.minRem * 16);
      const maxPx = Math.round(f.maxRem * 16);
      const minName = `--${prefix}-${minPx}`;
      const maxName = `--${prefix}-${maxPx}`;
      const minPart = primitiveNames.has(minName)
        ? `var(${minName})`
        : `${formatNumber(f.minRem)}rem`;
      const maxPart = primitiveNames.has(maxName)
        ? `var(${maxName})`
        : `${formatNumber(f.maxRem)}rem`;
      const middle = preferredValue(f.minRem, f.maxRem);
      tokensCss += `  ${f.varName}: clamp(${minPart}, ${middle}, ${maxPart});\n`;
    }
  }

  if (lineHeights.length) {
    tokensCss += `\n  /* Typographie — Hauteurs de lignes */\n`;
    for (const lh of lineHeights) {
      const partsLtok = lh.varName.slice(2).split("-");
      let prefix =
        partsLtok.slice(0, partsLtok.length - 1).join("-") || partsLtok[0];
      if (/^(lineheight|line-height|leading)$/i.test(prefix))
        prefix = "line-height";
      if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text";
      const minPx = Math.round(lh.minRem * 16);
      const maxPx = Math.round(lh.maxRem * 16);
      const minName = `--${prefix}-${minPx}`;
      const maxName = `--${prefix}-${maxPx}`;
      const minPart = primitiveNames.has(minName)
        ? `var(${minName})`
        : `${formatNumber(lh.minRem)}rem`;
      const maxPart = primitiveNames.has(maxName)
        ? `var(${maxName})`
        : `${formatNumber(lh.maxRem)}rem`;
      const middle = preferredValue(lh.minRem, lh.maxRem);
      tokensCss += `  ${lh.varName}: clamp(${minPart}, ${middle}, ${maxPart});\n`;
    }
  }

  // spacing semantics
  const spacingMap = new Map();
  for (const s of spacings)
    spacingMap.set(Math.round(Number(s.px)), {
      name: sanitizeVarName(s.name),
      rem: Number(s.px) / 16,
    });
  const findSpacingVar = (n) => {
    const candidates = [`--spacing-${n}`, `--space-${n}`, `--gap-${n}`];
    return candidates.find((c) => primitiveNames.has(c)) || null;
  };
  const emitSemanticSpacing = () => {
    const lines = [];
    const xsVar = findSpacingVar(4);
    if (xsVar) lines.push(`  --spacing-xs: var(${xsVar});`);
    const emitClampIf = (label, minPx, maxPx) => {
      const minVar = findSpacingVar(minPx);
      const maxVar = findSpacingVar(maxPx);
      const minEntry = spacingMap.get(minPx);
      const maxEntry = spacingMap.get(maxPx);
      if (minVar && maxVar && minEntry && maxEntry) {
        const middle = preferredValue(minEntry.rem, maxEntry.rem);
        lines.push(
          `  --spacing-${label}: clamp(var(${minVar}), ${middle}, var(${maxVar}));`
        );
      }
    };
    emitClampIf("s", 8, 16);
    emitClampIf("m", 16, 32);
    emitClampIf("l", 24, 48);
    emitClampIf("xl", 32, 80);
    if (lines.length) {
      tokensCss += `\n  /* Espacements */\n`;
      tokensCss += lines.join("\n") + "\n";
    }
  };
  emitSemanticSpacing();

  // Forms block
  tokensCss += `\n  /* Formulaires */\n`;
  if (projectNeedColorScheme) {
    tokensCss += `  --form-control-background: light-dark(\n    var(--color-gray-200),\n    var(--color-gray-700)\n  );\n`;
    tokensCss += `  --on-form-control: light-dark(var(--color-gray-900), var(--color-gray-100));\n`;
  } else {
    tokensCss += `  --form-control-background: var(--color-gray-200);\n`;
    tokensCss += `  --on-form-control: var(--color-gray-900);\n`;
  }
  tokensCss += `  --form-control-spacing: var(--spacing-12) var(--spacing-16);\n`;
  tokensCss += `  --form-control-border-width: 1px;\n`;
  tokensCss += `  --form-control-border-color: var(--color-gray-400);\n`;
  // choose radius fallback
  (function () {
    const radiusCandidates = [
      "--radius-m",
      "--radius-16",
      "--radius-8",
      "--radius-0",
      "--radius-9999",
    ];
    let chosen = radiusCandidates.find((r) => primitiveNames.has(r));
    if (!chosen)
      chosen = Array.from(primitiveNames).find((n) => /^--radius-\d+$/.test(n));
    if (!chosen) chosen = "--radius-0";
    tokensCss += `  --form-control-border-radius: var(${chosen});\n`;
  })();
  tokensCss += `  --checkables-border-color: var(--color-gray-400);\n`;
  tokensCss += `  --checkable-size: 1.25em;\n`;

  tokensCss += `\n}\n`;
  tokensCss = tokensCss.replace(/\n{3,}/g, "\n\n");

  // validate var(...) usage
  const varUsageRe = /var\(\s*(--[a-z0-9-]+)\s*\)/g;
  const missing = new Set();
  let mu;
  while ((mu = varUsageRe.exec(tokensCss)) !== null) {
    if (!primitiveNames.has(mu[1])) missing.add(mu[1]);
  }
  if (missing.size) {
    // If missing primitives, we return what we have but flag missing via console
    console.error(
      "Tokens generation references primitives not present in theme primitives:",
      [...missing].join(", ")
    );
  }

  return { themeCss, tokensCss };
}

export default { generateCanonicalThemeFromFigma };
