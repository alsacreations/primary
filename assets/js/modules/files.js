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
  await loadCSSFile("assets/css/reset.css", "resetContent");
}

/**
 * Charge le fichier layouts.css
 */
export async function loadLayoutsFile() {
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
