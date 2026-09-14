#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "dist");
// Allow overriding the input directory where primitives.json and tokens.json are read from
let IN_DIR = OUT_DIR;
const DEFAULTS = {
  $schema: "https://schemas.wp.org/wp/6.7/theme.json",
  version: 3,
  settings: {
    appearanceTools: true,
    useRootPaddingAwareAlignments: true,
  },
};

// Seuls les tokens de couleur sémantiques (base/contrast/accent) sont exposés
// dans la palette theme.json — les primitives (gray, slate, error, etc.) et
// les tokens non retenus (link, états) restent des variables CSS classiques,
// hors palette WordPress.
const defaultPalette = [
  { name: "Base", color: "var(--base)", slug: "base" },
  { name: "Base-2", color: "var(--base-2)", slug: "base-2" },
  { name: "Base-3", color: "var(--base-3)", slug: "base-3" },
  { name: "Contrast", color: "var(--contrast)", slug: "contrast" },
  { name: "Accent-1", color: "var(--accent-1)", slug: "accent-1" },
  { name: "Accent-2", color: "var(--accent-2)", slug: "accent-2" },
  { name: "Accent-3", color: "var(--accent-3)", slug: "accent-3" },
];

// Traduction des slugs conservés vers le français ("base" et "accent"
// s'écrivent déjà pareil dans les deux langues).
const FRENCH_COLOR_SLUGS = { contrast: "contraste" };

function isKeptColorSlug(slug) {
  return /^(base|contrast|accent)/i.test(slug);
}

function toFrenchSlug(slug) {
  const match = slug.match(/^([a-z]+)(-.*)?$/i);
  if (!match) return slug;
  const [, word, suffix = ""] = match;
  return (FRENCH_COLOR_SLUGS[word.toLowerCase()] || word) + suffix;
}

function toDisplayName(slug) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

const defaultSpacingSizes = [
  { name: "spacing-0", size: "var(--spacing-0)", slug: "spacing-0" },
  { name: "spacing-2", size: "var(--spacing-2)", slug: "spacing-2" },
  { name: "spacing-4", size: "var(--spacing-4)", slug: "spacing-4" },
  { name: "spacing-8", size: "var(--spacing-8)", slug: "spacing-8" },
  { name: "spacing-12", size: "var(--spacing-12)", slug: "spacing-12" },
  { name: "spacing-16", size: "var(--spacing-16)", slug: "spacing-16" },
  { name: "spacing-24", size: "var(--spacing-24)", slug: "spacing-24" },
  { name: "spacing-32", size: "var(--spacing-32)", slug: "spacing-32" },
  { name: "spacing-48", size: "var(--spacing-48)", slug: "spacing-48" },
];

const defaultFontSizes = [
  { name: "text-14", size: "var(--text-14)", slug: "text-14" },
  { name: "text-16", size: "var(--text-16)", slug: "text-16" },
  { name: "text-18", size: "var(--text-18)", slug: "text-18" },
  { name: "text-20", size: "var(--text-20)", slug: "text-20" },
  { name: "text-24", size: "var(--text-24)", slug: "text-24" },
  { name: "text-30", size: "var(--text-30)", slug: "text-30" },
  { name: "text-48", size: "var(--text-48)", slug: "text-48" },
];

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

const defaultFontFamilies = [
  {
    name: "Poppins",
    slug: "poppins",
    fontFamily: "Poppins, sans-serif",
    fontFace: [
      {
        src: ["file:./assets/fonts/Poppins-Variable-opti.woff2"],
        fontWeight: "100 900",
        fontStyle: "normal",
        fontFamily: "Poppins",
      },
    ],
  },
  { name: "System", slug: "system", fontFamily: "system-ui, sans-serif" },
  { name: "Mono", slug: "mono", fontFamily: "ui-monospace, monospace" },
];

const defaultStyles = {
  color: { background: "var:preset|color|base", text: "var:preset|color|contraste" },
  spacing: {
    blockGap: "var:preset|spacing|spacing-16",
    padding: { left: "var:preset|spacing|spacing-16", right: "var:preset|spacing|spacing-16" },
  },
  typography: {
    fontFamily: "var:preset|font-family|poppins",
    fontSize: "var:preset|font-size|text-16",
    fontWeight: "400",
    lineHeight: "1.2",
    fontStyle: "normal",
  },
  elements: {
    heading: {
      color: { text: "var:preset|color|accent-1" },
      typography: { fontFamily: "var:preset|font-family|poppins", fontWeight: "600" },
    },
    h1: {
      typography: {
        fontFamily: "var:preset|font-family|poppins",
        fontSize: "var:preset|font-size|text-48",
        lineHeight: "1.05",
        fontWeight: "600",
      },
    },
    h2: {
      typography: {
        fontFamily: "var:preset|font-family|poppins",
        fontSize: "var:preset|font-size|text-48",
        lineHeight: "1.2",
        fontWeight: "600",
      },
    },
    link: {
      color: { text: "var(--link)" },
      typography: { textDecoration: "underline" },
      ":hover": { color: { text: "var(--link-hover)" }, typography: { fontWeight: "700" } },
    },
  },
  blocks: {},
};

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
      const slug = toFrenchSlug(tk);
      if (!seen.has(slug)) {
        const value = tokens.colors[tk].value || `var(--${tk})`;
        palette.push({ name: toDisplayName(tk), color: value, slug });
        seen.add(slug);
      }
    });
  }

  // Finally add defaults for commonly expected tokens if missing
  defaultPalette.forEach((entry) => {
    const slug = toFrenchSlug(entry.slug);
    if (!seen.has(slug)) {
      palette.push({ ...entry, slug });
      seen.add(slug);
    }
  });

  return palette;
}

function buildSpacing(primitives, tokens) {
  const sizes = [];
  const seen = new Set();

  // Use tokens spacing first
  if (tokens && tokens.spacing) {
    Object.keys(tokens.spacing).forEach((k) => {
      const item = tokens.spacing[k];
      const slug = k;
      const size = item.value || `var(--${slug})`;
      sizes.push({ name: slug, size, slug });
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

  // Ensure primitives are available as var entries (append additional unnamed primitives)
  if (primitives && primitives.spacing) {
    Object.keys(primitives.spacing).forEach((p) => {
      if (!seen.has(p)) {
        sizes.push({ name: p, size: `var(--${p})`, slug: p });
        seen.add(p);
      }
    });
  }

  return { defaultSpacingSizes: false, spacingSizes: sizes, units: ["px", "rem", "%", "vh", "vw"] };
}

function buildTypography(primitives, tokens) {
  const fontSizes = [];
  const seen = new Set();

  // tokens first
  if (tokens && tokens.fonts && tokens.fonts.fontSize) {
    Object.keys(tokens.fonts.fontSize).forEach((k) => {
      const entry = tokens.fonts.fontSize[k];
      const slug = k;
      const size = entry.value || `var(--${slug})`;
      fontSizes.push({ name: slug, size, slug });
      seen.add(slug);
    });
  }

  // add default font sizes
  defaultFontSizes.forEach((s) => {
    if (!seen.has(s.slug)) {
      fontSizes.push(s);
      seen.add(s.slug);
    }
  });

  // add primitives font sizes
  if (primitives && primitives.fontSize) {
    Object.keys(primitives.fontSize).forEach((p) => {
      if (!seen.has(p)) {
        fontSizes.push({ name: p, size: `var(--${p})`, slug: p });
        seen.add(p);
      }
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
      fontSizes,
      fontFamilies,
      // encode font base/mono and weight scale explicitly
    },
  }; // Note: font base/mono and weight scale are exposed in CSS variables (`--font-base`, `--font-mono`, `--font-weight-*`) and should be referenced from `styles.typography` if desired.
}

function injectDefaults(theme) {
  // layout
  theme.settings.layout = { contentSize: "48rem", wideSize: "80rem" };
  // spacing - use buildSpacing caller output inserted elsewhere
  // styles defaults
  // Ensure styles.typography references the CSS variables for base font and weight.
  defaultStyles.typography.fontFamily = "var(--font-base)";
  defaultStyles.typography.fontWeight = "var(--font-weight-regular)";
  theme.styles = defaultStyles;
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
  // primitives) : base/contrast/accent-* toujours présents, plus link/selection
  // qui restent des variables CSS classiques bien qu'absents de la palette.
  const knownSemanticColorVars = new Set([
    "base",
    "base-2",
    "base-3",
    "contrast",
    "accent-1",
    "accent-2",
    "accent-3",
    "link",
    "link-hover",
    "link-active",
    "selection",
  ]);

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
      knownSemanticColorVars.has(name);

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
  theme.settings.color = { defaultDuotone: false, defaultGradients: false, defaultPalette: false };

  // build palette
  theme.settings.color.palette = buildPalette(primitives, tokens);

  // build spacing
  theme.settings.spacing = buildSpacing(primitives, tokens);

  // build typography
  const typ = buildTypography(primitives, tokens);
  theme.settings.typography = typ.typography;

  // inject defaults
  injectDefaults(theme);

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
