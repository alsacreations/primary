/**
 * Module fichiers - Primary CSS Generator
 * Chargement et gestion des fichiers CSS
 */

import { state } from "./state.js";
import { showGlobalError } from "./validation.js";

/**
 * Charge le contenu d'un fichier CSS
 */
async function loadCSSFile(url, propertyName) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
    }
    const content = await response.text();
    state[propertyName] = content;
  } catch (error) {
    showGlobalError(`Erreur de chargement de ${url}: ${error.message}`);
    console.error(`Erreur lors du chargement de ${url}:`, error);
    throw error;
  }
}

/**
 * Charge le fichier theme.css
 */
export async function loadThemeFile() {
  await loadCSSFile("assets/css/theme.css", "themeContent");
}

/**
 * Charge le fichier reset.css
 */
export async function loadResetFile() {
  // Prioriser une version distante si disponible (ex: dépôt central),
  // fallback sur la copie locale.
  const candidates = [
    "https://raw.githubusercontent.com/alsacreations/bretzel/main/public/reset.css",
    "https://knacss.com/css/reset.css",
    "assets/css/reset.css",
  ];

  for (const url of candidates) {
    try {
      // ajouter un timestamp pour éviter le cache
      const separator = url.includes("?") ? "&" : "?";
      const fetchUrl = url.startsWith("http")
        ? `${url}${separator}v=${Date.now()}`
        : url;
      const r = await fetch(fetchUrl);
      if (r.ok) {
        state.resetContent = await r.text();
        return;
      }
    } catch (err) {
      // essayer le suivant
      console.warn(`Impossible de charger ${url}, fallback :`, err);
    }
  }
  // Si tout échoue, laisser la valeur vide et afficher erreur via loadCSSFile
  await loadCSSFile("assets/css/reset.css", "resetContent");
}

/**
 * Charge le fichier layouts.css
 */
export async function loadLayoutsFile() {
  // Prioriser la version distante sur GitHub (repo bretzel) puis fallback
  const remote =
    "https://raw.githubusercontent.com/alsacreations/bretzel/main/public/layouts.css";
  try {
    const resp = await fetch(`${remote}?v=${Date.now()}`);
    if (resp.ok) {
      state.layoutsContent = await resp.text();
      return;
    }
  } catch (err) {
    console.warn(
      "Impossible de charger layouts.css distant, fallback local:",
      err
    );
  }

  await loadCSSFile("assets/css/layouts.css", "layoutsContent");
}

/**
 * Charge le fichier app.css (point d'entrée)
 */
export async function loadAppFile() {
  await loadCSSFile("assets/css/app.css", "appContent");
}

/**
 * Charge le fichier natives.css
 */
export async function loadNativesFile() {
  // Prioriser la version distante officielle de knacss, fallback sur le
  // fichier local si la requête échoue. Cela permet de toujours fournir la
  // version la plus à jour quand l'utilisateur est en ligne.
  const remote = "https://knacss.com/css/natives.css";
  try {
    const resp = await fetch(remote);
    if (resp.ok) {
      state.nativesContent = await resp.text();
      return;
    }
    // else fall through to local
  } catch (err) {
    // ignore and fallback to local file
    console.warn(
      "Impossible de charger natives.css distant, fallback local:",
      err
    );
  }

  // Fallback local copy
  await loadCSSFile("assets/css/natives.css", "nativesContent");
}

/**
 * Charge les fichiers styles.css (système et Poppins)
 */
export async function loadStylesFiles() {
  try {
    // Charger d'abord les samples canoniques dans public/samples pour
    // garantir une sortie byte-for-byte conforme aux fichiers de référence.
    // Fallback : utiliser `assets/css/styles.css` si le sample système n'est
    // pas disponible. Pour Poppins, fallback sur une liste réduite.

    // Système : privilégier public/samples/styles.css
    const systemCandidates = [
      "public/samples/styles.css",
      "assets/css/styles.css",
      "public/styles.css",
      "styles.css",
    ];
    let systemText = "";
    for (const p of systemCandidates) {
      try {
        const r = await fetch(p);
        if (r.ok) {
          systemText = await r.text();
          break;
        }
      } catch (e) {
        // ignore and try next
      }
    }
    state.stylesSystemContent = systemText || "";

    // Poppins : tenter le sample dédié
    const poppinsCandidates = [
      "public/samples/styles-poppins.css",
      "public/samples/styles-2.css",
      "assets/css/styles-poppins.css",
      "styles-poppins.css",
    ];
    let poppinsText = "";
    for (const p of poppinsCandidates) {
      try {
        const r = await fetch(p);
        if (r.ok) {
          poppinsText = await r.text();
          break;
        }
      } catch (e) {
        // ignore and try next
      }
    }
    state.stylesPoppinsContent = poppinsText || "";
  } catch (error) {
    showGlobalError(`Erreur de chargement des styles: ${error.message}`);
    console.error("Erreur lors du chargement des styles:", error);
    throw error;
  }
}

/**
 * Charge tous les fichiers nécessaires
 */
export async function loadAllFiles() {
  try {
    await Promise.all([
      loadThemeFile(),
      loadResetFile(),
      loadAppFile(),
      loadLayoutsFile(),
      loadNativesFile(),
      loadStylesFiles(),
    ]);
  } catch (error) {
    // Les erreurs individuelles sont déjà affichées par chaque fonction
    console.error("Erreur lors du chargement des fichiers:", error);
  }
}
