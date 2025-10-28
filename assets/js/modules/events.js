/**
 * Module événements - Primary CSS Generator
 * Gestion des événements utilisateur
 */

import { state } from "./state.js";
import { elements } from "./dom.js";
import {
  validateCustomVars,
  showGlobalError,
  hideGlobalError,
} from "./validation.js";
import {
  updateUI,
  updateThemePreview,
  updateColorChoices,
  applyCustomVarsToDocument,
  generateAllFiles,
} from "./ui.js";

/**
 * Navigue vers l'étape précédente
 */
export function previousStep() {
  if (state.currentStep > 1) {
    state.currentStep--;
    updateUI();
  }
}

/**
 * Navigue vers l'étape suivante
 */
export function nextStep() {
  if (state.currentStep < 3) {
    state.currentStep++;

    // Générer les fichiers CSS si on arrive à l'étape 3
    if (state.currentStep === 3) {
      generateAllFiles();
    }

    updateUI();
  }
}

/**
 * Copie le CSS dans le presse-papier
 */
export async function copyToClipboard(element) {
  try {
    await navigator.clipboard.writeText(element.textContent);

    // Feedback visuel - Trouver le bouton overlay dans le details parent
    const details = element.closest("details");
    if (details) {
      const button = details.querySelector(".copy-button");
      if (button) {
        const originalText = button.textContent;
        button.textContent = "Copié !";
        button.classList.add("is-success");

        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("is-success");
        }, 2000);
      }
    }
  } catch (err) {
    console.error("Erreur lors de la copie :", err);
    // Fallback pour les navigateurs qui ne supportent pas l'API Clipboard
    const textArea = document.createElement("textarea");
    textArea.value = element.textContent;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);

    // Feedback visuel même en fallback
    const details = element.closest("details");
    if (details) {
      const button = details.querySelector(".copy-button");
      if (button) {
        const originalText = button.textContent;
        button.textContent = "Copié !";
        button.classList.add("is-success");

        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("is-success");
        }, 2000);
      }
    }
  }
}

import {
  generateAppCSS,
  generateThemeCSS,
  generateTokensCSS,
  generateStylesCSS,
} from "./generators.js";

/**
 * Télécharge tous les fichiers CSS
 */
export function downloadAllFiles() {
  const zip = new JSZip();

  // Générer tous les fichiers en utilisant les fonctions du module generators
  const appCSS = generateAppCSS();
  const themeCSS = generateThemeCSS();
  const tokensCSS = generateTokensCSS();
  const stylesCSS = generateStylesCSS();

  // Ajouter les fichiers au ZIP
  zip.file("app.css", appCSS);
  zip.file("reset.css", state.resetContent);
  zip.file("theme.css", themeCSS);
  zip.file("theme-tokens.css", tokensCSS);
  zip.file("layouts.css", state.layoutsContent);
  zip.file("natives.css", state.nativesContent);
  zip.file("styles.css", stylesCSS);

  // Générer et télécharger le ZIP
  zip.generateAsync({ type: "blob" }).then((content) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "primary-css-kit.zip";
    link.click();
  });
}

/**
 * Configure tous les événements
 */
export function setupEventListeners() {
  // Navigation des étapes
  elements.stepButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const targetStep = parseInt(button.dataset.step);

      if (targetStep >= 1 && targetStep <= 3) {
        state.currentStep = targetStep;

        // Générer les fichiers CSS si on arrive à l'étape 3
        if (state.currentStep === 3) {
          generateAllFiles();
        }

        updateUI();
      }
    });
  });

  // Boutons de navigation
  if (elements.btnPrev) {
    elements.btnPrev.addEventListener("click", previousStep);
  }
  if (elements.btnNext) {
    elements.btnNext.addEventListener("click", nextStep);
  }

  // Étape 2 - Configuration
  if (elements.primaryColorSelect) {
    elements.primaryColorSelect.addEventListener("change", (e) => {
      state.config.primaryColor = e.target.value;
    });
  }

  elements.themeModeInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      state.config.themeMode = e.target.value;
    });
  });

  if (elements.typoResponsiveInput) {
    elements.typoResponsiveInput.addEventListener("change", (e) => {
      state.config.typoResponsive = e.target.checked;
    });
  }

  if (elements.spacingResponsiveInput) {
    elements.spacingResponsiveInput.addEventListener("change", (e) => {
      state.config.spacingResponsive = e.target.checked;
    });
  }

  elements.fontFamilyInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      state.config.fontFamily = e.target.value;
    });
  });

  // Variables personnalisées
  if (elements.customVarsInput) {
    elements.customVarsInput.addEventListener("input", (e) => {
      const value = e.target.value;
      state.config.customVars = value;

      // Valider la syntaxe CSS
      const validation = validateCustomVars(value);
      if (validation !== true) {
        showGlobalError(`Variables personnalisées : ${validation}`);
      } else {
        hideGlobalError();
      }

      // Mettre à jour l'affichage de theme.css avec les variables personnalisées
      updateThemePreview();
      // Mettre à jour les choix de couleurs quand l'utilisateur ajoute des variables
      updateColorChoices();
      // Appliquer les variables personnalisées au document pour que les swatches
      // et le rendu instantané utilisent ces valeurs.
      applyCustomVarsToDocument();
    });
  }

  // Boutons de copie
  if (elements.btnCopyApp) {
    elements.btnCopyApp.addEventListener("click", () =>
      copyToClipboard(elements.generatedApp)
    );
  }
  if (elements.btnCopyReset) {
    elements.btnCopyReset.addEventListener("click", () =>
      copyToClipboard(elements.generatedReset)
    );
  }
  if (elements.btnCopyLayouts) {
    elements.btnCopyLayouts.addEventListener("click", () =>
      copyToClipboard(elements.generatedLayouts)
    );
  }
  if (elements.btnCopyNatives) {
    elements.btnCopyNatives.addEventListener("click", () =>
      copyToClipboard(elements.generatedNatives)
    );
  }
  if (elements.btnCopyTheme) {
    elements.btnCopyTheme.addEventListener("click", () =>
      copyToClipboard(elements.generatedTheme)
    );
  }
  if (elements.btnCopyTokens) {
    elements.btnCopyTokens.addEventListener("click", () =>
      copyToClipboard(elements.generatedTokens)
    );
  }
  if (elements.btnCopyStyles) {
    elements.btnCopyStyles.addEventListener("click", () =>
      copyToClipboard(elements.generatedStyles)
    );
  }

  // Bouton de téléchargement
  if (elements.btnDownloadAll) {
    elements.btnDownloadAll.addEventListener("click", downloadAllFiles);
  }
}
