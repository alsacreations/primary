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
    // Charger le fichier système
    const systemResponse = await fetch("assets/css/styles.css");
    if (!systemResponse.ok) {
      throw new Error(
        `Erreur HTTP ${systemResponse.status}: ${systemResponse.statusText}`
      );
    }
    state.stylesSystemContent = await systemResponse.text();

    // Charger le fichier Poppins
    const poppinsResponse = await fetch("public/samples/styles-2.css");
    if (!poppinsResponse.ok) {
      throw new Error(
        `Erreur HTTP ${poppinsResponse.status}: ${poppinsResponse.statusText}`
      );
    }
    state.stylesPoppinsContent = await poppinsResponse.text();
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
      loadLayoutsFile(),
      loadNativesFile(),
      loadStylesFiles(),
    ]);
  } catch (error) {
    // Les erreurs individuelles sont déjà affichées par chaque fonction
    console.error("Erreur lors du chargement des fichiers:", error);
  }
}
