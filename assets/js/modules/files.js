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
 * Charge le fichier theme.css depuis les sources canoniques
 */
export async function loadThemeFile() {
  try {
    // Charger tous les fichiers canoniques dans l'ordre
    const canonicalFiles = [
      "canonical/primitives/commons/commons.css",
      "canonical/primitives/spacings/spacings.css",
      "canonical/primitives/fonts/fonts.css",
      "canonical/primitives/radius/radius.css",
      "canonical/primitives/colors/colors.css",
    ];

    const responses = await Promise.all(
      canonicalFiles.map((path) => fetch(path).then((r) => r.text()))
    );

    // Extraire tout ce qui est avant :root dans le premier fichier (commons.css)
    const commonsContent = responses[0];
    const rootIndex = commonsContent.indexOf(":root");
    const header =
      rootIndex !== -1 ? commonsContent.substring(0, rootIndex).trim() : "";

    // Extraire le contenu :root de chaque fichier et normaliser l'indentation
    const rootContents = [];
    for (const content of responses) {
      const rootMatch = content.match(/:root\s*\{([\s\S]*?)\n\}/);
      if (rootMatch) {
        const innerContent = rootMatch[1];
        // Normaliser l'indentation : enlever l'indentation existante puis ajouter 2 espaces
        const lines = innerContent.split("\n");
        const normalizedLines = lines
          .map((line) => {
            // Ligne vide
            if (!line.trim()) return "";
            // Commentaire ou déclaration : indenter de 2 espaces
            return "  " + line.trimStart();
          })
          .join("\n");

        if (normalizedLines.trim()) {
          rootContents.push(normalizedLines);
        }
      }
    }

    // Construire le fichier final avec un seul :root
    const combinedContent =
      header + "\n\n:root {\n" + rootContents.join("\n\n") + "\n}\n";

    // Importer l'état pour mettre à jour themeContent
    const stateModule = await import("./state.js");
    if (stateModule && stateModule.state) {
      stateModule.state.themeContent = combinedContent;
      stateModule.state.themeFromImport = false;
    }
  } catch (error) {
    showGlobalError(`Erreur de chargement du theme.css: ${error.message}`);
    console.error("Erreur lors du chargement du theme.css:", error);
    throw error;
  }
}

/**
 * Charge le fichier reset.css
 */
export async function loadResetFile() {
  const url = "https://reset.alsacreations.com/public/reset.css";

  try {
    // Ajouter un timestamp pour éviter le cache
    const fetchUrl = `${url}?v=${Date.now()}`;
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
    }

    state.resetContent = await response.text();
  } catch (error) {
    showGlobalError(
      `Impossible de charger reset.css depuis reset.alsacreations.com: ${error.message}`
    );
    console.error(`Erreur lors du chargement de ${url}:`, error);
    throw error;
  }
}

/**
 * Charge le fichier layouts.css
 */
export async function loadLayoutsFile() {
  const url = "https://bretzel.alsacreations.com/public/layouts.css";
  const fetchUrl = `${url}?v=${Date.now()}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    state.layoutsContent = await response.text();
  } catch (error) {
    showGlobalError(
      `Erreur de chargement de layouts.css depuis ${url}: ${error.message}`
    );
    console.error("Erreur lors du chargement de layouts.css:", error);
    throw error;
  }
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
  const url = "https://knacss.com/css/natives.css";
  const fetchUrl = `${url}?v=${Date.now()}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    state.nativesContent = await response.text();
  } catch (error) {
    showGlobalError(
      `Erreur de chargement de natives.css depuis ${url}: ${error.message}`
    );
    console.error("Erreur lors du chargement de natives.css:", error);
    throw error;
  }
}

/**
 * Charge les fichiers styles.css (système et Poppins)
 */
export async function loadStylesFiles() {
  // Contenu canonique pour styles système (hardcodé)
  state.stylesSystemContent = `/* ----------------------------------
 * Styles de base du projet
 * ----------------------------------
 */

/* Modificateurs de Layouts */
[data-layout*="boxed"] {
  --boxed-max: 96rem; /* 1536px */
}

/* Base */
body {
  background-color: var(--surface);
  color: var(--on-surface);
  font-family: var(--font-base);
  font-size: var(--text-m);
  font-weight: var(--font-weight-regular);
}

/* Titres */
.title-l {
  font-size: var(--text-3xl);
  font-weight: var(--font-weight-semibold);
}

.title-m {
  font-size: var(--text-m);
  font-weight: var(--font-weight-semibold);
}

.title-s {
  font-size: var(--text-s);
  font-weight: var(--font-weight-semibold);
}
`;

  // Poppins : contenu vide par défaut (peut être étendu ultérieurement)
  // Try to load canonical styles for Poppins so that exported `styles.css`
  // matches the canonical file byte-for-byte when the user selects Poppins.
  try {
    const resp = await fetch("/canonical/styles/styles-poppins.css");
    if (resp.ok) {
      state.stylesPoppinsContent = await resp.text();
    } else {
      state.stylesPoppinsContent = "";
    }
  } catch (e) {
    // Fallback: keep empty and let generators build a sensible fallback
    state.stylesPoppinsContent = "";
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
