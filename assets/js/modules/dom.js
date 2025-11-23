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
  // Aligné avec l'ID présent dans index.html
  customVarsInput: document.getElementById("custom-vars-input"),

  // JSON import UI (file + paste + actions)
  jsonImportFile: document.getElementById("json-import-file"),
  // Paste input removed: JSON will be provided via downloaded files only
  // (textarea `json-import-paste` and action buttons removed from the UI).
  jsonImportStatus: document.getElementById("json-import-status"),

  // Étape 2 - Configuration
  // Le HTML n'utilise pas un <select> pour la couleur primaire mais
  // un conteneur `.color-choices` ; on référence donc cet élément.
  primaryColorSelect: document.querySelector(".color-choices"),
  themeModeInputs: document.querySelectorAll('input[name="theme-mode"]'),
  // Les choix responsive sont des inputs radio nommés, on récupère la NodeList
  typoResponsiveInputs: document.querySelectorAll(
    'input[name="typo-responsive"]'
  ),
  spacingResponsiveInputs: document.querySelectorAll(
    'input[name="spacing-responsive"]'
  ),
  // Technologie / format de génération (static | wordpress)
  technologyInputs: document.querySelectorAll('input[name="technology"]'),
  // Alias rétro-compatible mon-élément (utilisé par events.js)
  typoResponsiveInput: document.querySelector('input[name="typo-responsive"]'),
  spacingResponsiveInput: document.querySelector(
    'input[name="spacing-responsive"]'
  ),
  fontFamilyInputs: document.querySelectorAll('input[name="font-family"]'),

  // Étape 3 - Génération
  generatedApp: document.getElementById("generated-app"),
  generatedReset: document.getElementById("generated-reset"),
  generatedLayouts: document.getElementById("generated-layouts"),
  generatedNatives: document.getElementById("generated-natives"),
  generatedTheme: document.getElementById("generated-theme"),
  // Optionnel : sortie générée theme.json (présente uniquement si le template l'inclut)
  generatedThemeJson: document.getElementById("generated-theme-json"),
  generatedTokens: document.getElementById("generated-tokens"),
  generatedStyles: document.getElementById("generated-styles"),

  // Boutons d'actions
  btnCopyApp: document.getElementById("btn-copy-app"),
  btnCopyReset: document.getElementById("btn-copy-reset"),
  btnCopyLayouts: document.getElementById("btn-copy-layouts"),
  btnCopyNatives: document.getElementById("btn-copy-natives"),
  btnCopyTheme: document.getElementById("btn-copy-theme"),
  btnCopyThemeJson: document.getElementById("btn-copy-theme-json"),
  btnCopyTokens: document.getElementById("btn-copy-tokens"),
  btnCopyStyles: document.getElementById("btn-copy-styles"),
  btnDownloadAll: document.getElementById("btn-download-all"),

  // Message d'erreur global
  globalError: document.getElementById("global-error"),
};
