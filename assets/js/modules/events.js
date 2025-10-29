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
  syncConfigFromDOM,
  refreshColorSelection,
} from "./ui.js";
import { copyToClipboard } from "./clipboard.js";

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
// copyToClipboard moved to modules/clipboard.js

import {
  generateAppCSS,
  generateThemeCSS,
  generateTokensCSS,
  generateStylesCSS,
} from "./generators.js";
import { loadAllFiles } from "./files.js";
import { downloadAllFiles } from "./packaging.js";

// downloadAllFiles moved to modules/packaging.js

/**
 * Configure tous les événements
 */
export async function setupEventListeners() {
  // Charger les fichiers dans le state du module avant d'attacher
  // les listeners afin d'éviter que la génération ne lise des
  // contenus vides si l'utilisateur passe rapidement à l'étape 3.
  try {
    await loadAllFiles();
  } catch (err) {
    // Les erreurs de chargement sont déjà affichées par loadAllFiles
    // mais on poursuit l'initialisation pour garder l'app réactive.
    console.warn("loadAllFiles a échoué dans setupEventListeners:", err);
  }
  // Attach grouped handlers to keep setupEventListeners concise
  attachNavigationHandlers();
  attachConfigHandlers();
  attachActionHandlers();
}

function attachNavigationHandlers() {
  // Navigation des étapes
  elements.stepButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const targetStep = parseInt(button.dataset.step);

      if (targetStep >= 1 && targetStep <= 3) {
        state.currentStep = targetStep;

        // Synchroniser la configuration depuis le DOM avant toute génération
        try {
          syncConfigFromDOM();
        } catch (err) {
          /* noop */
        }

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
}

function attachConfigHandlers() {
  if (!elements.primaryColorSelect) return;

  // Délègue la gestion des changements de couleur primaire
  attachPrimaryColorHandlers();

  // Theme mode radios (light / dark / both)
  if (elements.themeModeInputs && elements.themeModeInputs.length) {
    elements.themeModeInputs.forEach((input) => {
      input.addEventListener("change", (e) => {
        state.config.themeMode = e.target.value;
        if (state.currentStep === 3) generateAllFiles();
      });
    });
  }
  if (elements.typoResponsiveInput) {
    elements.typoResponsiveInput.addEventListener("change", (e) => {
      state.config.typoResponsive = e.target.checked;
      if (state.currentStep === 3) generateAllFiles();
    });
  }

  if (elements.spacingResponsiveInput) {
    elements.spacingResponsiveInput.addEventListener("change", (e) => {
      state.config.spacingResponsive = e.target.checked;
      if (state.currentStep === 3) generateAllFiles();
    });
  }

  elements.fontFamilyInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      state.config.fontFamily = e.target.value;
    });
  });
  // Attach the custom variables handler if the input exists
  if (elements.customVarsInput) attachCustomVarsHandler();
}

function attachCustomVarsHandler() {
  elements.customVarsInput.addEventListener("input", (e) => {
    const value = e.target.value;

    // Si l'application principale a exposé une API globale pour
    // appliquer les variables (mode progressif de migration), l'utiliser
    // afin d'éviter les problèmes de double-état entre app.js et
    // modules/state.js. Sinon, tomber back sur le state du module.
    if (typeof window.applyCustomVarsFromModules === "function") {
      // Mettre à jour l'état principal via l'API exposée
      window.applyCustomVarsFromModules(value);
      // Synchroniser aussi l'état local du module afin que les générateurs
      // qui lisent `modules/state.js` voient la même valeur.
      try {
        state.config.customVars = value;
      } catch (err) {
        // noop
      }
    } else {
      state.config.customVars = value;
    }

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

function attachPrimaryColorHandlers() {
  // Support both legacy <select> and the new .color-choices container
  if (elements.primaryColorSelect.tagName === "SELECT") {
    elements.primaryColorSelect.addEventListener("change", (e) => {
      state.config.primaryColor = e.target.value;
      try {
        refreshColorSelection();
      } catch (err) {
        /* noop */
      }
      // If already on generation step, refresh generated files
      if (state.currentStep === 3) generateAllFiles();
    });
  } else {
    // Event delegation for radio inputs rendered inside the container
    elements.primaryColorSelect.addEventListener("change", (e) => {
      const input =
        e.target.closest && e.target.closest('input[name="primary-color"]');
      if (input) {
        state.config.primaryColor = input.value;
        try {
          refreshColorSelection();
        } catch (err) {
          /* noop */
        }
        try {
          syncConfigFromDOM();
        } catch (err) {
          /* noop */
        }
        if (state.currentStep === 3) generateAllFiles();
      }
    });

    // Also handle clicks on labels (some browsers may not trigger change)
    elements.primaryColorSelect.addEventListener("click", (e) => {
      const input =
        e.target.closest && e.target.closest('input[name="primary-color"]');
      if (input) {
        state.config.primaryColor = input.value;
        try {
          refreshColorSelection();
        } catch (err) {
          /* noop */
        }
        if (state.currentStep === 3) generateAllFiles();
      }
    });
  }
}

function attachActionHandlers() {
  // Boutons de copie
  if (elements.btnCopyApp)
    elements.btnCopyApp.addEventListener("click", () =>
      copyToClipboard(elements.generatedApp)
    );
  if (elements.btnCopyReset)
    elements.btnCopyReset.addEventListener("click", () =>
      copyToClipboard(elements.generatedReset)
    );
  if (elements.btnCopyLayouts)
    elements.btnCopyLayouts.addEventListener("click", () =>
      copyToClipboard(elements.generatedLayouts)
    );
  if (elements.btnCopyNatives)
    elements.btnCopyNatives.addEventListener("click", () =>
      copyToClipboard(elements.generatedNatives)
    );
  if (elements.btnCopyTheme)
    elements.btnCopyTheme.addEventListener("click", () =>
      copyToClipboard(elements.generatedTheme)
    );
  if (elements.btnCopyTokens)
    elements.btnCopyTokens.addEventListener("click", () =>
      copyToClipboard(elements.generatedTokens)
    );
  if (elements.btnCopyStyles)
    elements.btnCopyStyles.addEventListener("click", () =>
      copyToClipboard(elements.generatedStyles)
    );

  // Bouton de téléchargement
  if (elements.btnDownloadAll) {
    elements.btnDownloadAll.addEventListener("click", downloadAllFiles);
  }
}
