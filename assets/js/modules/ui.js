/**
 * Module UI - Primary CSS Generator
 * Gestion de l'interface utilisateur
 */

import { state, PLACEHOLDER_RASPBERRY } from "./state.js";
import { elements } from "./dom.js";
import {
  generateTokensCSS,
  generateThemeCSS,
  generateStylesCSS,
  generateAppCSS,
} from "./generators.js";
import { showGlobalError, hideGlobalError } from "./validation.js";

/**
 * Met à jour l'affichage de l'étape active
 */
export function updateUI() {
  // Masquer toutes les sections
  elements.sections.forEach((section) => {
    section.classList.remove("is-visible");
  });

  // Afficher la section active
  const activeSection = document.getElementById(
    `step-${
      state.currentStep === 1
        ? "sources"
        : state.currentStep === 2
        ? "config"
        : "generate"
    }`
  );
  if (activeSection) {
    activeSection.classList.add("is-visible");
  }

  // Mettre à jour les boutons d'étape
  elements.stepButtons.forEach((button, index) => {
    const stepNumber = index + 1;
    const stepElement = button.closest(".step");

    if (stepNumber === state.currentStep) {
      button.setAttribute("aria-current", "step");
      stepElement.classList.add("is-active");
    } else {
      button.removeAttribute("aria-current");
      stepElement.classList.remove("is-active");
    }

    if (stepNumber < state.currentStep) {
      stepElement.classList.add("is-completed");
    } else {
      stepElement.classList.remove("is-completed");
    }
  });

  // Mettre à jour les boutons de navigation
  if (elements.btnPrev) {
    elements.btnPrev.disabled = state.currentStep === 1;
  }
  if (elements.btnNext) {
    elements.btnNext.disabled = state.currentStep === 3;
  }
}

/**
 * Met à jour l'aperçu du fichier theme.css
 */
export function updateThemePreview() {
  if (elements.themePreview) {
    elements.themePreview.innerHTML = Prism.highlight(
      generateThemeCSS(),
      Prism.languages.css,
      "css"
    );
  }
}

/**
 * Met à jour les choix de couleurs disponibles
 */
export function updateColorChoices() {
  if (!elements.primaryColorSelect) return;

  // Extraire les couleurs du CSS personnalisé
  const customColors = new Map();
  const customVars = state.config.customVars.trim();

  if (customVars) {
    const lines = customVars.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("--color-") && trimmed.includes(":")) {
        const parts = trimmed.split(":");
        if (parts.length >= 2) {
          const varName = parts[0].trim();
          const varValue = parts[1].trim().replace(";", "");
          customColors.set(varName, varValue);
        }
      }
    }
  }

  // Générer les options de couleur
  let options = "";

  // Couleurs du thème (de theme.css)
  const themeColors = [
    "raspberry",
    "blue",
    "green",
    "orange",
    "purple",
    "red",
    "yellow",
  ];
  themeColors.forEach((color) => {
    const selected = state.config.primaryColor === color ? " selected" : "";
    options += `<option value="${color}"${selected}>${color}</option>`;
  });

  // Couleurs personnalisées
  if (customColors.size > 0) {
    options += '<optgroup label="Couleurs personnalisées">';
    for (const [varName, varValue] of customColors) {
      const colorName = varName.replace("--color-", "").replace("-500", "");
      const selected =
        state.config.primaryColor === colorName ? " selected" : "";
      options += `<option value="${colorName}"${selected}>${colorName} (personnalisé)</option>`;
    }
    options += "</optgroup>";
  }

  elements.primaryColorSelect.innerHTML = options;
}

/**
 * Applique les variables personnalisées au document
 */
export function applyCustomVarsToDocument() {
  // Supprimer les styles précédents
  const existingStyle = document.getElementById("custom-vars-style");
  if (existingStyle) {
    existingStyle.remove();
  }

  // Appliquer les nouvelles variables
  if (state.config.customVars.trim()) {
    const style = document.createElement("style");
    style.id = "custom-vars-style";
    style.textContent = `:root {\n  ${state.config.customVars
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .join("\n  ")}\n}`;
    document.head.appendChild(style);
  }
}

/**
 * Génère et affiche tous les fichiers CSS
 */
export function generateAllFiles() {
  try {
    const appCSS = generateAppCSS();
    const themeCSS = generateThemeCSS();
    const tokensCSS = generateTokensCSS();
    const stylesCSS = generateStylesCSS();

    // Masquer les erreurs si la génération réussit
    hideGlobalError();

    // Afficher app.css avec coloration syntaxique
    elements.generatedApp.innerHTML = Prism.highlight(
      appCSS,
      Prism.languages.css,
      "css"
    );

    // Afficher reset.css avec coloration syntaxique
    elements.generatedReset.innerHTML = Prism.highlight(
      state.resetContent,
      Prism.languages.css,
      "css"
    );

    // Afficher layouts.css avec coloration syntaxique
    elements.generatedLayouts.innerHTML = Prism.highlight(
      state.layoutsContent,
      Prism.languages.css,
      "css"
    );

    // Afficher natives.css avec coloration syntaxique
    elements.generatedNatives.innerHTML = Prism.highlight(
      state.nativesContent,
      Prism.languages.css,
      "css"
    );

    // Afficher theme.css avec coloration syntaxique
    elements.generatedTheme.innerHTML = Prism.highlight(
      themeCSS,
      Prism.languages.css,
      "css"
    );

    // Afficher theme-tokens.css avec coloration syntaxique
    elements.generatedTokens.innerHTML = Prism.highlight(
      tokensCSS,
      Prism.languages.css,
      "css"
    );

    // Afficher styles.css avec coloration syntaxique
    elements.generatedStyles.innerHTML = Prism.highlight(
      stylesCSS,
      Prism.languages.css,
      "css"
    );

    // Appliquer la coloration syntaxique à l'exemple app.css
    const appCssExample = document.getElementById("app-css-example");
    if (appCssExample) {
      const appCssContent = appCssExample.textContent;
      appCssExample.innerHTML = Prism.highlight(
        appCssContent,
        Prism.languages.css,
        "css"
      );
    }
  } catch (error) {
    showGlobalError(`Erreur lors de la génération : ${error.message}`);
    console.error("Erreur de génération :", error);
  }
}
