/**
 * Module DOM - Primary CSS Generator
 * Gestion des références aux éléments DOM
 */

/**
 * Éléments DOM de l'application
 */
export const elements = {
  // Navigation des étapes
  steps: document.querySelectorAll(".step"),
  stepButtons: document.querySelectorAll(".step-button"),
  sections: document.querySelectorAll(".step-section"),

  // Boutons de navigation
  btnPrev: document.getElementById("btn-prev"),
  btnNext: document.getElementById("btn-next"),

  // Étape 1 - Sources
  themePreview: document.getElementById("theme-preview"),
  customVarsInput: document.getElementById("custom-vars"),

  // Étape 2 - Configuration
  primaryColorSelect: document.getElementById("primary-color"),
  themeModeInputs: document.querySelectorAll('input[name="theme-mode"]'),
  typoResponsiveInput: document.getElementById("typo-responsive"),
  spacingResponsiveInput: document.getElementById("spacing-responsive"),
  fontFamilyInputs: document.querySelectorAll('input[name="font-family"]'),

  // Étape 3 - Génération
  generatedApp: document.getElementById("generated-app"),
  generatedReset: document.getElementById("generated-reset"),
  generatedLayouts: document.getElementById("generated-layouts"),
  generatedNatives: document.getElementById("generated-natives"),
  generatedTheme: document.getElementById("generated-theme"),
  generatedTokens: document.getElementById("generated-tokens"),
  generatedStyles: document.getElementById("generated-styles"),

  // Boutons d'actions
  btnCopyApp: document.getElementById("btn-copy-app"),
  btnCopyReset: document.getElementById("btn-copy-reset"),
  btnCopyLayouts: document.getElementById("btn-copy-layouts"),
  btnCopyNatives: document.getElementById("btn-copy-natives"),
  btnCopyTheme: document.getElementById("btn-copy-theme"),
  btnCopyTokens: document.getElementById("btn-copy-tokens"),
  btnCopyStyles: document.getElementById("btn-copy-styles"),
  btnDownloadAll: document.getElementById("btn-download-all"),

  // Message d'erreur global
  globalError: document.getElementById("global-error"),
};
