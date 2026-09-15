#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "dist");
// Allow overriding the input directory where primitives.json and tokens.json are read from
let IN_DIR = OUT_DIR;
const DEFAULTS = {
  $schema: "https://schemas.wp.org/wp/7.1/theme.json",
  version: 3,
  settings: {
    appearanceTools: true,
    useRootPaddingAwareAlignments: true,
  },
};

// Rayons de bordure — primitives globales toujours présentes dans theme.css
// (--radius-none/4/8/12/16/24/full), indépendamment des données Figma du projet.
const defaultRadiusSizes = [
  { name: "0", size: "var(--radius-none)", slug: "radius-none" },
  { name: "4px", size: "var(--radius-4)", slug: "radius-4" },
  { name: "8px", size: "var(--radius-8)", slug: "radius-8" },
  { name: "12px", size: "var(--radius-12)", slug: "radius-12" },
  { name: "16px", size: "var(--radius-16)", slug: "radius-16" },
  { name: "24px", size: "var(--radius-24)", slug: "radius-24" },
  { name: "Full", size: "var(--radius-full)", slug: "radius-full" },
];

// Seuls les tokens de couleur sémantiques (base/contrast/accent) sont exposés
// dans la palette theme.json — les primitives (gray, slate, error, etc.) et
// les tokens non retenus (link, états) restent des variables CSS classiques,
// hors palette WordPress.
const defaultPalette = [
  { name: "Base", color: "var(--base)", slug: "base" },
  { name: "Base-2", color: "var(--base-2)", slug: "base-2" },
  { name: "Base-3", color: "var(--base-3)", slug: "base-3" },
  { name: "Contraste", color: "var(--contrast)", slug: "contrast" },
  { name: "Accent-1", color: "var(--accent-1)", slug: "accent-1" },
  { name: "Accent-2", color: "var(--accent-2)", slug: "accent-2" },
  { name: "Accent-3", color: "var(--accent-3)", slug: "accent-3" },
];

// Traduction du name affiché vers le français ("base" et "accent" s'écrivent
// déjà pareil dans les deux langues) — le slug, lui, reste celui de la
// variable CSS (donc en anglais).
const FRENCH_COLOR_WORDS = { contrast: "contraste" };

function isKeptColorSlug(slug) {
  return /^(base|contrast|accent)/i.test(slug);
}

function toFrenchName(slug) {
  const match = slug.match(/^([a-z]+)(-.*)?$/i);
  if (!match) return slug.charAt(0).toUpperCase() + slug.slice(1);
  const [, word, suffix = ""] = match;
  const frenchWord = FRENCH_COLOR_WORDS[word.toLowerCase()] || word;
  return frenchWord.charAt(0).toUpperCase() + frenchWord.slice(1) + suffix;
}

// Seuls les tokens de spacing sémantiques (spacing-xs/s/m/l/xl) sont exposés
// dans theme.json — l'échelle brute (spacing-0, spacing-16, ...) reste une
// variable CSS interne, hors settings.spacing.
const defaultSpacingSizes = [
  { name: "XS", size: "var(--spacing-xs)", slug: "spacing-xs" },
  { name: "S", size: "var(--spacing-s)", slug: "spacing-s" },
  { name: "M", size: "var(--spacing-m)", slug: "spacing-m" },
  { name: "L", size: "var(--spacing-l)", slug: "spacing-l" },
  { name: "XL", size: "var(--spacing-xl)", slug: "spacing-xl" },
];

function isSpacingToken(slug) {
  return !/^spacing-\d+$/.test(slug);
}

function toSpacingDisplayName(slug) {
  return slug.replace(/^spacing-/, "").toUpperCase();
}

// Contrairement aux couleurs/spacings, aucune valeur par défaut n'est
// injectée pour les tailles de police : seuls les tokens réellement présents
// dans les données extraites de Figma (tokens.json) doivent apparaître.
function isFontSizeToken(slug) {
  return !/^text-\d+$/.test(slug);
}

function toFontSizeDisplayName(slug) {
  return slug.replace(/^text-/, "").toUpperCase();
}

// Même logique que isFontSizeToken, côté line-height : seuls les slugs
// sémantiques (line-height-s, line-height-m, ...) comptent, jamais l'échelle
// brute (line-height-14, line-height-22, ...).
function isLineHeightToken(slug) {
  return !/^line-height-\d+$/.test(slug);
}

// Ordre "t-shirt sizing" attendu pour les listes de tailles (spacing, texte) —
// l'ordre d'itération de tokens.json (dépendant de l'export Figma) n'est pas
// garanti, donc on trie explicitement avant de renvoyer settings.*.
const SEMANTIC_SIZE_ORDER = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl"];

function semanticSizeRank(slug) {
  const suffix = slug.replace(/^(spacing|text)-/, "").toLowerCase();
  const idx = SEMANTIC_SIZE_ORDER.indexOf(suffix);
  return idx === -1 ? null : idx;
}

function sortBySemanticSize(entries) {
  return entries.slice().sort((a, b) => {
    const ra = semanticSizeRank(a.slug);
    const rb = semanticSizeRank(b.slug);
    if (ra !== null && rb !== null) return ra - rb;
    if (ra !== null) return -1;
    if (rb !== null) return 1;
    return a.slug.localeCompare(b.slug);
  });
}

// Defaults for base/mono fonts and weight scale
const defaultFontBase = "system-ui, sans-serif";
const defaultFontMono = "ui-monospace, monospace";
const defaultFontWeights = {
  light: 300,
  regular: 400,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

// "Poppins" n'est qu'un exemple de police de projet particulier — elle n'est
// ni définie ni chargée (@font-face) par défaut dans theme.css. Seules
// --font-base et --font-mono sont garanties par le générateur.
const defaultFontFamilies = [
  { name: "System", slug: "system", fontFamily: "system-ui, sans-serif" },
  { name: "Mono", slug: "mono", fontFamily: "ui-monospace, monospace" },
];

// Construit les styles par défaut. fontSizes (settings.typography.fontSizes,
// déjà limité aux tokens réellement extraits de Figma — voir buildTypography)
// détermine si une taille de police par défaut peut être référencée : jamais
// de fontSize inventé, uniquement si le token correspondant existe vraiment.
// Même principe pour lineHeight : on ne référence var(--line-height-*) que si
// le token sémantique correspondant a réellement été extrait de Figma
// (tokens.fonts.lineHeight) ; sinon on garde la valeur numérique littérale
// par défaut (voir instructions-wp.md).
function buildDefaultStyles(fontSizes, tokens) {
  const fontSizeSlugs = new Set((fontSizes || []).map((f) => f.slug));
  const bodyFontSize = fontSizeSlugs.has("text-m") ? "var(--text-m)" : undefined;
  const h1FontSize = fontSizeSlugs.has("text-xxl") ? "var(--text-xxl)" : undefined;
  const h2FontSize = fontSizeSlugs.has("text-xl") ? "var(--text-xl)" : undefined;

  const lineHeightSlugs = new Set(
    Object.keys((tokens && tokens.fonts && tokens.fonts.lineHeight) || {}).filter(isLineHeightToken)
  );
  const bodyLineHeight = lineHeightSlugs.has("line-height-m") ? "var(--line-height-m)" : "1.2";
  const h1LineHeight = lineHeightSlugs.has("line-height-xxl") ? "var(--line-height-xxl)" : "1.05";
  const h2LineHeight = lineHeightSlugs.has("line-height-xl") ? "var(--line-height-xl)" : "1.2";

  return {
    color: { background: "var:preset|color|base", text: "var:preset|color|contrast" },
    spacing: {
      blockGap: "var:preset|spacing|spacing-m",
      padding: { left: "var:preset|spacing|spacing-m", right: "var:preset|spacing|spacing-m" },
    },
    typography: {
      fontFamily: "var(--font-base)",
      ...(bodyFontSize ? { fontSize: bodyFontSize } : {}),
      fontWeight: "var(--font-weight-regular)",
      lineHeight: bodyLineHeight,
      fontStyle: "normal",
    },
    elements: {
      heading: {
        color: { text: "var:preset|color|accent-1" },
        typography: { fontFamily: "var(--font-base)", fontWeight: "var(--font-weight-semibold)" },
      },
      h1: {
        typography: {
          fontFamily: "var(--font-base)",
          ...(h1FontSize ? { fontSize: h1FontSize } : {}),
          lineHeight: h1LineHeight,
          fontWeight: "var(--font-weight-semibold)",
        },
      },
      h2: {
        typography: {
          fontFamily: "var(--font-base)",
          ...(h2FontSize ? { fontSize: h2FontSize } : {}),
          lineHeight: h2LineHeight,
          fontWeight: "var(--font-weight-semibold)",
        },
      },
    },
    blocks: {},
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return null;
  }
}

function writeJson(outPath, obj) {
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2));
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function toVarName(prefix, slug) {
  // prefix without leading dashes
  return `var(--${prefix}${slug})`;
}

function buildPalette(primitives, tokens) {
  const palette = [];
  const seen = new Set();

  // Ne garder que les tokens de couleur (pas les primitives) dont le slug
  // commence par base/contrast/accent — on exclut link et les états
  // (warning/error/success/info).
  if (tokens && tokens.colors) {
    Object.keys(tokens.colors).forEach((tk) => {
      if (!isKeptColorSlug(tk)) return;
      if (!seen.has(tk)) {
        const value = tokens.colors[tk].value || `var(--${tk})`;
        palette.push({ name: toFrenchName(tk), color: value, slug: tk });
        seen.add(tk);
      }
    });
  }

  // Finally add defaults for commonly expected tokens if missing
  defaultPalette.forEach((entry) => {
    if (!seen.has(entry.slug)) {
      palette.push(entry);
      seen.add(entry.slug);
    }
  });

  return palette;
}

function buildSpacing(primitives, tokens) {
  const sizes = [];
  const seen = new Set();

  // Ne garder que les tokens de spacing sémantiques (spacing-xs/s/m/l/xl...),
  // jamais l'échelle brute (spacing-0, spacing-16, ...).
  if (tokens && tokens.spacing) {
    Object.keys(tokens.spacing).forEach((slug) => {
      if (!isSpacingToken(slug)) return;
      if (seen.has(slug)) return;
      sizes.push({ name: toSpacingDisplayName(slug), size: `var(--${slug})`, slug });
      seen.add(slug);
    });
  }

  // Add default spacing sizes as fallback
  defaultSpacingSizes.forEach((s) => {
    if (!seen.has(s.slug)) {
      sizes.push(s);
      seen.add(s.slug);
    }
  });

  return {
    defaultSpacingSizes: false,
    spacingSizes: sortBySemanticSize(sizes),
    units: ["px", "rem", "%", "vh", "vw"],
  };
}

function buildTypography(primitives, tokens) {
  const fontSizes = [];
  const seen = new Set();

  // Uniquement les tokens de taille de police réellement extraits de Figma
  // (tokens.fonts.fontSize) — ni valeurs par défaut inventées, ni primitives
  // (--text-14, --text-16, ...).
  if (tokens && tokens.fonts && tokens.fonts.fontSize) {
    Object.keys(tokens.fonts.fontSize).forEach((slug) => {
      if (!isFontSizeToken(slug) || seen.has(slug)) return;
      fontSizes.push({ name: toFontSizeDisplayName(slug), size: `var(--${slug})`, slug });
      seen.add(slug);
    });
  }

  // font families
  const fontFamilies = [];
  if (primitives && primitives.font) {
    Object.keys(primitives.font).forEach((k) => {
      const meta = primitives.font[k];
      fontFamilies.push({ name: k, slug: k, fontFamily: meta.value || k, fontFace: meta.fontFace || undefined });
    });
  }
  // fallback defaults
  if (!fontFamilies.length) fontFamilies.push(...defaultFontFamilies);

  return {
    typography: {
      writingMode: true,
      defaultFontSizes: false,
      fluid: false,
      customFontSize: false,
      fontSizes: sortBySemanticSize(fontSizes),
      fontFamilies,
      // encode font base/mono and weight scale explicitly
    },
  }; // Note: font base/mono and weight scale are exposed in CSS variables (`--font-base`, `--font-mono`, `--font-weight-*`) and should be referenced from `styles.typography` if desired.
}

function injectDefaults(theme, tokens) {
  // layout
  theme.settings.layout = { contentSize: "48rem", wideSize: "80rem" };
  // border : pas de personnalisation de bordure exposée dans l'éditeur FSE par défaut,
  // mais les rayons globaux (toujours présents dans theme.css) restent proposés.
  theme.settings.border = { color: false, style: false, width: false, radiusSizes: defaultRadiusSizes };
  // styles defaults — dépend des fontSizes déjà résolues (settings.typography.fontSizes)
  theme.styles = buildDefaultStyles(theme.settings.typography && theme.settings.typography.fontSizes, tokens);
}

function validate(theme, primitives, tokens) {
  const warnings = [];
  // minimal structure validations
  if (!theme.settings) warnings.push("Missing settings root");
  if (!theme.settings.color || !Array.isArray(theme.settings.color.palette))
    warnings.push("Missing settings.color.palette");
  if (!theme.settings.typography || !Array.isArray(theme.settings.typography.fontSizes))
    warnings.push("Missing settings.typography.fontSizes");
  if (!theme.settings.spacing || !Array.isArray(theme.settings.spacing.spacingSizes))
    warnings.push("Missing settings.spacing.spacingSizes");

  // Tokens de couleur sémantiques définis directement dans theme.css (pas des
  // primitives), toujours présents : base/contrast/accent-*. (link/selection/
  // états ne sont jamais référencés dans theme.json — voir buildPalette.)
  const knownSemanticColorVars = new Set(["base", "base-2", "base-3", "contrast", "accent-1", "accent-2", "accent-3"]);
  // Tokens de spacing sémantiques (theme.css), distincts de l'échelle brute
  // spacing-0..48 vérifiée via primitives.spacing.
  const knownSemanticSpacingVars = new Set(["spacing-xs", "spacing-s", "spacing-m", "spacing-l", "spacing-xl"]);
  // Idem pour les tailles de police sémantiques (theme.css), distinctes de
  // l'échelle brute text-14..60 vérifiée via primitives.fontSize.
  const knownSemanticFontSizeVars = new Set(["text-s", "text-m", "text-l", "text-xl", "text-xxl"]);
  // Familles/graisses de police toujours émises par le pipeline (voir
  // client-utils.mjs otherDefaults), indépendamment des données Figma.
  const knownFontVars = new Set([
    "font-base",
    "font-mono",
    "font-weight-light",
    "font-weight-regular",
    "font-weight-semibold",
    "font-weight-bold",
    "font-weight-extrabold",
    "font-weight-black",
  ]);
  // Rayons de bordure globaux (theme.css), toujours présents.
  const knownRadiusVars = new Set(["radius-none", "radius-4", "radius-8", "radius-12", "radius-16", "radius-24", "radius-full"]);

  // Check var references exist in primitives or tokens where possible (naive check)
  const varRefs = JSON.stringify(theme).match(/var\(--[a-zA-Z0-9-]+\)/g) || [];
  varRefs.forEach((v) => {
    let name = v.replace(/^var\(--/, "").replace(/\)$/, "");
    // normalize color names like 'color-white' -> 'white'
    if (name.startsWith("color-")) name = name.replace(/^color-/, "");
    // strip any leading dashes
    if (name.startsWith("--")) name = name.replace(/^--/, "");

    // check existence in primitives (color/spacings/fontSize/lineHeight/rounded) or top-level primitives
    const exists =
      (primitives && primitives.color && primitives.color[name]) ||
      (primitives && primitives.spacing && primitives.spacing[name]) ||
      (primitives && primitives.fontSize && primitives.fontSize[name]) ||
      (primitives && primitives.lineHeight && primitives.lineHeight[name]) ||
      (primitives && primitives.rounded && primitives.rounded[name]) ||
      (primitives && primitives[name]) ||
      (tokens && tokens.colors && tokens.colors[name]) ||
      (tokens && tokens.spacing && tokens.spacing[name]) ||
      (tokens && tokens.fonts && tokens.fonts.fontSize && tokens.fonts.fontSize[name]) ||
      (tokens && tokens.fonts && tokens.fonts.lineHeight && tokens.fonts.lineHeight[name]) ||
      knownSemanticColorVars.has(name) ||
      knownSemanticSpacingVars.has(name) ||
      knownSemanticFontSizeVars.has(name) ||
      knownFontVars.has(name) ||
      knownRadiusVars.has(name);

    if (!exists) warnings.push(`Reference to ${v} not found in primitives`);
  });

  return [...new Set(warnings)];
}

function main() {
  const args = process.argv.slice(2);
  const outArgIndex = args.indexOf("--out");
  const outPath =
    outArgIndex !== -1 && args[outArgIndex + 1] ? args[outArgIndex + 1] : path.join(OUT_DIR, "theme.json");
  const inArgIndex = args.indexOf("--in");
  IN_DIR = inArgIndex !== -1 && args[inArgIndex + 1] ? path.resolve(args[inArgIndex + 1]) : IN_DIR;

  ensureOutDir();

  const primitives = readJson(path.join(IN_DIR, "primitives.json")) || {};
  const tokens = readJson(path.join(IN_DIR, "tokens.json")) || {};

  const theme = Object.assign({}, DEFAULTS);
  theme.settings.background = { gradient: false };
  theme.settings.color = {
    customGradient: false,
    defaultDuotone: false,
    defaultGradients: false,
    defaultPalette: false,
    link: false,
  };

  // build palette
  theme.settings.color.palette = buildPalette(primitives, tokens);

  // build spacing
  theme.settings.spacing = buildSpacing(primitives, tokens);

  // build typography
  const typ = buildTypography(primitives, tokens);
  theme.settings.typography = typ.typography;

  // inject defaults
  injectDefaults(theme, tokens);

  // write theme
  writeJson(outPath, theme);

  // validate
  const warnings = validate(theme, primitives, tokens);
  if (warnings.length) {
    writeJson(path.join(OUT_DIR, "theme-warnings.json"), warnings);
    console.warn("Warnings generated. See dist/theme-warnings.json");
  }

  console.log(`Wrote ${outPath}`);
}

if (require.main === module) main();

module.exports = { buildPalette, buildSpacing, buildTypography, DEFAULTS };
