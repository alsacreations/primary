const { pxToRem, clampBetweenModes } = require("../utils");

// Noms de tokens de spacing usuels ("t-shirt sizing"), seuls reconnus par le
// repli "clés racine à plat" ci-dessous — une liste blanche plutôt qu'une
// liste noire, pour ne jamais capter par erreur d'autres primitives à plat
// (transition-duration, z-header-level, font-base, ...) qui partagent la
// racine du fichier dans certains exports.
const SPACING_TOKEN_NAME_RE = /^(xs|s|m|l|x+l|[0-9]x+l)$/i;

// Certains exports Figma déclarent les tokens de spacing comme des clés
// directement à la racine du fichier, sans enveloppe "Spacing" (ex. une
// collection Figma "Spacing" sans nœud de regroupement, exportée avec un
// fichier par mode). On les détecte en repli quand aucune enveloppe
// classique n'est trouvée, en se limitant aux noms de tokens reconnus.
function flatNumericSection(json) {
  const out = {};
  Object.keys(json || {}).forEach((k) => {
    if (!SPACING_TOKEN_NAME_RE.test(k)) return;
    const val = json[k];
    if (val && val.$type === "number") out[k] = val;
  });
  return Object.keys(out).length ? out : null;
}

function extractSpacing(entries) {
  const spacing = {}; // --spacing-N / --radius-N -> valeur brute (fichiers sans mode reconnu)
  const modes = new Set();
  const spacingTokensByName = {}; // "spacing-<name>" -> { mode: valeur brute }

  entries.forEach(({ json, modeName }) => {
    if (modeName) modes.add(modeName.toLowerCase());

    const spacingSection = json.Spacing || json.spacing || json.spacings || flatNumericSection(json);

    if (!modeName) {
      // Fichier sans mode reconnu : échelle brute de primitives.
      if (spacingSection) {
        Object.keys(spacingSection).forEach((k) => {
          const v = spacingSection[k] && spacingSection[k].$value;
          spacing[`--spacing-${k}`] = v;
        });
      }
      const roundedSection = json.Rounded || json.rounded || null;
      if (roundedSection) {
        Object.keys(roundedSection).forEach((k) => {
          const v = roundedSection[k] && roundedSection[k].$value;
          spacing[`--radius-${k}`] = v;
        });
      }
      return;
    }

    // Fichier à mode reconnu (desktop/mobile/...) : ce sont des tokens, pas
    // des primitives — on les accumule par mode pour calculer un clamp() fluide.
    if (spacingSection) {
      const mode = modeName.toLowerCase();
      Object.keys(spacingSection).forEach((k) => {
        const token = `spacing-${k}`;
        spacingTokensByName[token] = spacingTokensByName[token] || {};
        const raw = spacingSection[k];
        spacingTokensByName[token][mode] = raw && (raw.$value ?? raw.value ?? raw);
      });
    }
  });

  const primitives = {};
  Object.keys(spacing).forEach((name) => {
    primitives[name] = spacing[name];
  });

  const tokens = {};
  const tokensCss = [];
  const warnings = [];

  Object.keys(spacingTokensByName).forEach((token) => {
    const per = spacingTokensByName[token];
    const modesForToken = Object.keys(per);
    const varName = `--${token}`;

    if (modesForToken.length === 1) {
      // Une seule variante de mode disponible : pas de contrepartie pour
      // calculer un clamp() fluide, on la garde comme primitive (comme pour
      // le texte / les hauteurs de ligne).
      const only = modesForToken[0];
      primitives[varName] = per[only];
      warnings.push({
        token: varName,
        type: "missing-mode-variant",
        message: `Token '${varName}' present only in mode '${only}'. Missing counterpart mode.`,
      });
      return;
    }

    tokens[varName] = { value: `var(${varName})`, modes: per };

    if (modesForToken.includes("mobile") && modesForToken.includes("desktop")) {
      tokensCss.push(`${varName}: ${clampBetweenModes(per.mobile, per.desktop)};`);
    } else if (modesForToken.includes("light") && modesForToken.includes("dark")) {
      tokensCss.push(`${varName}: light-dark(${pxToRem(per.light)}, ${pxToRem(per.dark)});`);
    } else {
      const only = modesForToken[0];
      tokensCss.push(`${varName}: ${pxToRem(per[only])};`);
    }
  });

  const css = Object.keys(primitives)
    .sort()
    .map((name) => `${name}: ${pxToRem(primitives[name])}; /* ${primitives[name]}px */`);

  return { primitives, json: tokens, css, tokensCss, modes: Array.from(modes), warnings };
}

module.exports = { extractSpacing };
