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
import { refreshColorSelection } from "./ui.js";

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
      // bouton overlay attendu dans le DOM : .btn-copy-overlay
      const button = details.querySelector(".btn-copy-overlay");
      if (button) {
        // Conserver le contenu initial et afficher une coche pour feedback
        const original = button.innerHTML;
        // Marquer visuellement et pour AT via aria-live
        try {
          button.setAttribute("aria-live", "polite");
        } catch (e) {
          /* noop */
        }
        button.innerHTML = '<span aria-hidden="true">✅</span>';
        button.disabled = true;
        // Remettre l'état initial après 2s
        setTimeout(() => {
          button.innerHTML = original;
          button.disabled = false;
          try {
            button.removeAttribute("aria-live");
          } catch (e) {
            /* noop */
          }
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
      const button = details.querySelector(".btn-copy-overlay");
      if (button) {
        const original = button.innerHTML;
        try {
          button.setAttribute("aria-live", "polite");
        } catch (e) {
          /* noop */
        }
        button.innerHTML = '<span aria-hidden="true">✅</span>';
        button.disabled = true;
        setTimeout(() => {
          button.innerHTML = original;
          button.disabled = false;
          try {
            button.removeAttribute("aria-live");
          } catch (e) {
            /* noop */
          }
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
import { loadAllFiles } from "./files.js";

/**
 * Télécharge tous les fichiers CSS
 */
export async function downloadAllFiles() {
  const zip = new JSZip();

  // Générer tous les fichiers en utilisant les fonctions du module generators
  const appCSS = generateAppCSS();
  const themeCSS = generateThemeCSS();
  const tokensCSS = generateTokensCSS();
  const stylesCSS = generateStylesCSS();

  // Ajouter les fichiers CSS au ZIP sous assets/css/ pour conserver la
  // structure attendue par le kit.
  zip.file("assets/css/app.css", appCSS);
  zip.file("assets/css/reset.css", state.resetContent);
  zip.file("assets/css/theme.css", themeCSS);
  zip.file("assets/css/theme-tokens.css", tokensCSS);
  zip.file("assets/css/layouts.css", state.layoutsContent);
  zip.file("assets/css/natives.css", state.nativesContent);
  zip.file("assets/css/styles.css", stylesCSS);

  // Télécharger et ajouter les assets non-CSS (index, images, police) de façon
  // synchrone afin qu'ils soient bien inclus avant la génération du ZIP.
  try {
    const indexResp = await fetch("public/samples/index.html");
    if (indexResp.ok) {
      const indexContent = await indexResp.text();
      zip.file("index.html", indexContent);
    }
  } catch (err) {
    console.warn("index.html sample absent pour le ZIP:", err);
  }

  try {
    const svgResp = await fetch("public/samples/alsacreations.svg");
    if (svgResp.ok) {
      const svgBlob = await svgResp.blob();
      zip.file("img/alsacreations.svg", svgBlob);
    }
  } catch (err) {
    console.warn("alsacreations.svg non inclus:", err);
  }

  try {
    const favResp = await fetch("public/samples/favicon.svg");
    if (favResp.ok) {
      const favBlob = await favResp.blob();
      zip.file("img/favicon.svg", favBlob);
    }
  } catch (err) {
    console.warn("favicon.svg non inclus:", err);
  }

  try {
    const fontFamily = state.config && state.config.fontFamily;
    if (fontFamily === "poppins") {
      const fontResp = await fetch(
        "public/samples/Poppins-Variable-opti.woff2"
      );
      if (fontResp.ok) {
        const fontBlob = await fontResp.blob();
        zip.file("assets/css/fonts/Poppins-Variable-opti.woff2", fontBlob);
      }
    }
  } catch (err) {
    console.warn("Police Poppins non incluse dans le ZIP:", err);
  }

  // Générer et télécharger le ZIP
  try {
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "primary-css-kit.zip";
    link.click();
    // cleanup
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  } catch (err) {
    console.error("Erreur lors de la génération du ZIP:", err);
    alert("Erreur lors de la création de l'archive");
  }
}

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

  // Étape 2 - Configuration
  // Helper: synchronise les valeurs du DOM dans state.config
  function syncConfigFromDOM() {
    try {
      const primary = document.querySelector(
        'input[name="primary-color"]:checked'
      );
      if (primary) state.config.primaryColor = primary.value;

      const theme = document.querySelector('input[name="theme-mode"]:checked');
      if (theme) state.config.themeMode = theme.value;

      const typo = document.querySelector(
        'input[name="typo-responsive"]:checked'
      );
      if (typo) state.config.typoResponsive = typo.value === "true";

      const spacing = document.querySelector(
        'input[name="spacing-responsive"]:checked'
      );
      if (spacing) state.config.spacingResponsive = spacing.value === "true";

      const font = document.querySelector('input[name="font-family"]:checked');
      if (font) state.config.fontFamily = font.value;

      const custom = document.getElementById("custom-vars-input");
      if (custom) state.config.customVars = custom.value || "";
    } catch (e) {
      // defensive noop
    }
  }

  if (elements.primaryColorSelect) {
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

  // Variables personnalisées
  if (elements.customVarsInput) {
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
