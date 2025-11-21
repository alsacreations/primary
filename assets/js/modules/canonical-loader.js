// canonical-loader.js
// Charge et parse les fichiers canoniques de référence depuis /canonical/

/**
 * Charge le contenu d'un fichier CSS canonique
 * @param {string} path - Chemin relatif depuis /canonical/
 * @returns {Promise<string>} Contenu CSS
 */
async function loadCanonicalFile(path) {
  try {
    const response = await fetch(`/canonical/${path}`);
    if (!response.ok) {
      console.warn(`[canonical-loader] Fichier non trouvé: ${path}`);
      return "";
    }
    return await response.text();
  } catch (error) {
    console.error(`[canonical-loader] Erreur chargement ${path}:`, error);
    return "";
  }
}

/**
 * Parse un fichier CSS et extrait les variables CSS
 * @param {string} cssContent - Contenu CSS
 * @returns {Map<string, string>} Map des variables (nom -> valeur)
 */
function parseCssVariables(cssContent) {
  const variables = new Map();
  const regex = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match;

  while ((match = regex.exec(cssContent))) {
    const name = match[1];
    const value = match[2].trim();
    variables.set(name, value);
  }

  return variables;
}

/**
 * Charge toutes les primitives canoniques
 * @returns {Promise<Object>} Objet structuré avec toutes les primitives
 */
export async function loadCanonicalPrimitives() {
  const [commons, colors, fonts, radius, spacings] = await Promise.all([
    loadCanonicalFile("primitives/commons/commons.css"),
    loadCanonicalFile("primitives/colors/colors.css"),
    loadCanonicalFile("primitives/fonts/fonts.css"),
    loadCanonicalFile("primitives/radius/radius.css"),
    loadCanonicalFile("primitives/spacings/spacings.css"),
  ]);

  return {
    commons: {
      raw: commons,
      variables: parseCssVariables(commons),
    },
    colors: {
      raw: colors,
      variables: parseCssVariables(colors),
    },
    fonts: {
      raw: fonts,
      variables: parseCssVariables(fonts),
    },
    radius: {
      raw: radius,
      variables: parseCssVariables(radius),
    },
    spacings: {
      raw: spacings,
      variables: parseCssVariables(spacings),
    },
  };
}

/**
 * Charge tous les tokens canoniques
 * @returns {Promise<Object>} Objet structuré avec tous les tokens
 */
export async function loadCanonicalTokens() {
  const [commons, colors, fonts, spacings] = await Promise.all([
    loadCanonicalFile("tokens/commons/commons.css"),
    loadCanonicalFile("tokens/colors/colors.css"),
    loadCanonicalFile("tokens/fonts/fonts.css"),
    loadCanonicalFile("tokens/spacings/spacings.css"),
  ]);

  return {
    commons: {
      raw: commons,
      variables: parseCssVariables(commons),
    },
    colors: {
      raw: colors,
      variables: parseCssVariables(colors),
    },
    fonts: {
      raw: fonts,
      variables: parseCssVariables(fonts),
    },
    spacings: {
      raw: spacings,
      variables: parseCssVariables(spacings),
    },
  };
}

/**
 * Charge le theme.json canonique
 * @returns {Promise<Object>} Objet JSON parsé
 */
export async function loadCanonicalThemeJson() {
  try {
    const response = await fetch("/canonical/theme.json/theme.json");
    if (!response.ok) {
      console.warn("[canonical-loader] theme.json non trouvé");
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("[canonical-loader] Erreur chargement theme.json:", error);
    return null;
  }
}

/**
 * Cache pour éviter de recharger les canoniques à chaque fois
 */
const cache = {
  primitives: null,
  tokens: null,
  themeJson: null,
};

/**
 * Charge tous les canoniques (avec cache)
 * @param {boolean} forceReload - Force le rechargement (ignore le cache)
 * @returns {Promise<Object>} Tous les canoniques
 */
export async function loadAllCanonicals(forceReload = false) {
  if (!forceReload && cache.primitives && cache.tokens && cache.themeJson) {
    return cache;
  }

  const [primitives, tokens, themeJson] = await Promise.all([
    loadCanonicalPrimitives(),
    loadCanonicalTokens(),
    loadCanonicalThemeJson(),
  ]);

  cache.primitives = primitives;
  cache.tokens = tokens;
  cache.themeJson = themeJson;

  return cache;
}

/**
 * Retourne le cache actuel (accès synchrone)
 * @returns {Object|null} Les canoniques en cache ou null
 */
export function getCanonicalCache() {
  if (!cache.primitives || !cache.tokens) {
    return null;
  }
  return {
    primitives: cache.primitives,
    tokens: cache.tokens,
    themeJson: cache.themeJson,
  };
}

/**
 * [TEST ONLY] Permet d'injecter un mock du cache pour les tests Node.js
 * @param {Object} mockData - Données mockées
 */
export function __setMockCache(mockData) {
  cache.primitives = mockData.primitives || null;
  cache.tokens = mockData.tokens || null;
  cache.themeJson = mockData.themeJson || null;
}

export default {
  loadCanonicalPrimitives,
  loadCanonicalTokens,
  loadCanonicalThemeJson,
  loadAllCanonicals,
  getCanonicalCache,
  __setMockCache,
};
