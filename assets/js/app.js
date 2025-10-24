/**
 * Primary - Générateur de tokens CSS
 * Application principale
 */

// État de l'application
const state = {
  currentStep: 1,
  config: {
    primaryColor: "blue",
    themeMode: "both",
    typoResponsive: true,
    spacingResponsive: true,
    customVars: "",
  },
  themeContent: "", // Contenu original de theme.css
};

// Éléments DOM
const elements = {
  steps: document.querySelectorAll(".step"),
  stepButtons: document.querySelectorAll(".step-button"),
  sections: document.querySelectorAll(".step-section"),
  btnPrev: document.getElementById("btn-prev"),
  btnNext: document.getElementById("btn-next"),
  btnCopy: document.getElementById("btn-copy"),
  btnDownload: document.getElementById("btn-download"),
  themePreview: document.getElementById("theme-preview"),
  customVarsInput: document.getElementById("custom-vars-input"),
  generatedCss: document.getElementById("generated-css"),
};

/**
 * Initialisation de l'application
 */
async function init() {
  // Charger le contenu de theme.css
  await loadThemeFile();

  // Attacher les événements
  attachEventListeners();

  // Mettre à jour l'interface
  updateUI();
}

/**
 * Charge le contenu du fichier theme.css
 */
async function loadThemeFile() {
  try {
    const response = await fetch("assets/css/theme.css");
    const content = await response.text();
    state.themeContent = content; // Sauvegarder le contenu original
    elements.themePreview.textContent = content;
  } catch (error) {
    console.error("Erreur lors du chargement de theme.css:", error);
    elements.themePreview.textContent = "/* Erreur de chargement */";
  }
}

/**
 * Parse les variables de couleur depuis une chaîne CSS
 */
function parseColorVariables(cssText) {
  const colors = new Set();
  // Regex pour trouver les variables de couleur au format --color-{nom}-{numéro}
  const colorRegex = /--color-(\w+)-(?:\d+|fade|bright):/g;
  let match;

  while ((match = colorRegex.exec(cssText)) !== null) {
    colors.add(match[1]);
  }

  return Array.from(colors);
}

/**
 * Met à jour les choix de couleurs dans le formulaire
 */
function updateColorChoices() {
  const customColors = parseColorVariables(state.config.customVars);
  const colorChoicesContainer = document.querySelector(".color-choices");

  // Couleurs par défaut
  const defaultColors = ["blue", "red", "green", "orange"];
  const allColors = [...defaultColors, ...customColors];

  // Régénérer les choix
  colorChoicesContainer.innerHTML = allColors
    .map((color, index) => {
      const isChecked =
        color === state.config.primaryColor ||
        (index === 0 && !state.config.primaryColor);
      return `
      <label class="color-choice">
        <input type="radio" name="primary-color" value="${color}" ${
        isChecked ? "checked" : ""
      } />
        <span class="color-swatch" style="background: var(--color-${color}-500)"></span>
        <span class="color-name">${
          color.charAt(0).toUpperCase() + color.slice(1)
        }</span>
      </label>
    `;
    })
    .join("");

  // Réattacher les événements
  colorChoicesContainer
    .querySelectorAll('input[name="primary-color"]')
    .forEach((input) => {
      input.addEventListener("change", (e) => {
        state.config.primaryColor = e.target.value;
      });
    });
}

/**
 * Attache les événements aux éléments interactifs
 */
function attachEventListeners() {
  // Navigation
  elements.btnPrev.addEventListener("click", previousStep);
  elements.btnNext.addEventListener("click", nextStep);

  // Navigation directe via les boutons d'étapes
  elements.stepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetStep = parseInt(button.dataset.step, 10);
      if (targetStep !== state.currentStep) {
        state.currentStep = targetStep;

        // Générer le CSS si on arrive à l'étape 3
        if (state.currentStep === 3) {
          generateCSS();
        }

        updateUI();
      }
    });
  });

  // Configuration
  document.querySelectorAll('input[name="primary-color"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      state.config.primaryColor = e.target.value;
    });
  });

  document.querySelectorAll('input[name="theme-mode"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      state.config.themeMode = e.target.value;
    });
  });

  document
    .querySelector('input[name="typo-responsive"]')
    .addEventListener("change", (e) => {
      state.config.typoResponsive = e.target.checked;
    });

  document
    .querySelector('input[name="spacing-responsive"]')
    .addEventListener("change", (e) => {
      state.config.spacingResponsive = e.target.checked;
    });

  elements.customVarsInput.addEventListener("input", (e) => {
    state.config.customVars = e.target.value;
    // Mettre à jour les choix de couleurs quand l'utilisateur ajoute des variables
    updateColorChoices();
  });

  // Actions de génération
  elements.btnCopy.addEventListener("click", copyToClipboard);
  elements.btnDownload.addEventListener("click", downloadFile);
}

/**
 * Passe à l'étape précédente
 */
function previousStep() {
  if (state.currentStep > 1) {
    state.currentStep--;
    updateUI();
  }
}

/**
 * Passe à l'étape suivante
 */
function nextStep() {
  if (state.currentStep < 3) {
    state.currentStep++;

    // Générer le CSS si on arrive à l'étape 3
    if (state.currentStep === 3) {
      generateCSS();
    }

    updateUI();
  }
}

/**
 * Met à jour l'interface selon l'étape actuelle
 */
function updateUI() {
  // Mettre à jour les indicateurs d'étapes
  elements.steps.forEach((step, index) => {
    step.classList.toggle("is-active", index + 1 === state.currentStep);
  });

  // Mettre à jour les boutons d'étapes
  elements.stepButtons.forEach((button, index) => {
    const stepNumber = index + 1;
    const isActive = stepNumber === state.currentStep;

    if (isActive) {
      button.setAttribute("aria-current", "step");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  // Afficher la section correspondante
  elements.sections.forEach((section, index) => {
    const isVisible = index + 1 === state.currentStep;
    section.classList.toggle("is-visible", isVisible);
    section.hidden = !isVisible;
  });

  // Gérer les boutons de navigation
  elements.btnPrev.disabled = state.currentStep === 1;

  if (state.currentStep === 3) {
    elements.btnNext.style.display = "none";
  } else {
    elements.btnNext.style.display = "inline-flex";
  }

  // Focus sur le titre de la section
  const currentSection = elements.sections[state.currentStep - 1];
  const title = currentSection.querySelector(".step-title");
  if (title) {
    title.focus();
  }
}

/**
 * Génère le CSS selon la configuration
 */
function generateCSS() {
  const {
    primaryColor,
    themeMode,
    typoResponsive,
    spacingResponsive,
    customVars,
  } = state.config;

  // Utiliser directement le nom de la couleur pour référencer la variable
  const primaryValue = `var(--color-${primaryColor}-500)`;

  // Générer l'en-tête
  let css = `/* ----------------------------------
 * Primary par Alsacréations
 * Nécessite les variables CSS primaires (theme.css)
 * Généré par le script de génération de tokens
 * Configuration :
 * - Couleur primaire : ${primaryColor}
 * - Theme : ${themeMode === "both" ? "light et dark" : themeMode}
 * - Typographie responsive : ${typoResponsive ? "oui" : "non"}
 * - Espacements responsive : ${spacingResponsive ? "oui" : "non"}${
    customVars.trim()
      ? "\n * - Variables personnalisées ajoutées dans theme.css"
      : ""
  }
 * ----------------------------------
 */

:root {
  /* Color Tokens */\n`;

  // Ajouter color-scheme si mode both
  if (themeMode === "both") {
    css += `  color-scheme: light dark;

  &[data-theme="light"] {
    color-scheme: light;
  }

  &[data-theme="dark"] {
    color-scheme: dark;
  }

`;
  }

  // Couleurs primaires
  css += `  --primary: ${primaryValue};
  --on-primary: var(--color-white);\n`;

  // Générer les tokens de couleur selon le mode
  if (themeMode === "both") {
    css += `  --accent: light-dark(var(--primary), var(--color-${primaryColor}-300));
  --accent-invert: light-dark(var(--color-${primaryColor}-300), var(--primary));
  --surface: light-dark(var(--color-white), var(--color-gray-900));
  --on-surface: light-dark(var(--color-gray-900), var(--color-gray-100));
  --layer-1: light-dark(var(--color-gray-50), var(--color-gray-800));
  --layer-2: light-dark(var(--color-gray-100), var(--color-gray-700));
  --layer-3: light-dark(var(--color-gray-200), var(--color-gray-600));
  --link: light-dark(var(--primary), var(--color-${primaryColor}-300));
  --link-hover: light-dark(var(--color-${primaryColor}-700), var(--primary));
  --selection: light-dark(var(--color-${primaryColor}-300), var(--color-${primaryColor}-500));
  --warning: light-dark(var(--color-orange-500), var(--color-orange-300));
  --error: light-dark(var(--color-red-500), var(--color-red-300));
  --success: light-dark(var(--color-green-500), var(--color-green-300));
  --info: light-dark(var(--color-blue-500), var(--color-blue-300));\n`;
  } else if (themeMode === "light") {
    css += `  --accent: var(--primary);
  --surface: var(--color-white);
  --on-surface: var(--color-gray-900);
  --on-surface-secondary: var(--color-gray-600);
  --layer-1: var(--color-gray-50);
  --layer-2: var(--color-gray-100);
  --layer-3: var(--color-gray-200);
  --link: var(--primary);
  --link-hover: var(--color-${primaryColor}-700);
  --selection: var(--color-${primaryColor}-300);
  --border-light: var(--color-gray-200);
  --border-medium: var(--color-gray-400);
  --warning: var(--color-orange-500);
  --error: var(--color-red-500);
  --success: var(--color-green-500);
  --info: var(--color-blue-500);\n`;
  } else {
    // dark
    css += `  --accent: var(--color-${primaryColor}-300);
  --surface: var(--color-gray-900);
  --on-surface: var(--color-gray-100);
  --on-surface-secondary: var(--color-gray-400);
  --layer-1: var(--color-gray-800);
  --layer-2: var(--color-gray-700);
  --layer-3: var(--color-gray-600);
  --link: var(--color-${primaryColor}-300);
  --link-hover: var(--primary);
  --selection: var(--color-${primaryColor}-500);
  --border-light: var(--color-gray-700);
  --border-medium: var(--color-gray-600);
  --warning: var(--color-orange-300);
  --error: var(--color-red-300);
  --success: var(--color-green-300);
  --info: var(--color-blue-300);\n`;
  }

  // Ajouter les bordures pour le mode both
  if (themeMode === "both") {
    css += `  --border-light: light-dark(var(--color-gray-200), var(--color-gray-700));
  --border-medium: light-dark(var(--color-gray-400), var(--color-gray-600));
  --on-surface-secondary: light-dark(var(--color-gray-600), var(--color-gray-400));\n`;
  }

  // Typographie
  css += `\n  /* Typo Tokens */\n`;
  if (typoResponsive) {
    css += `  --text-s: var(--text-14);
  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));
  --text-l: clamp(var(--text-18), 1.0761rem + 0.2174vw, var(--text-20));
  --text-xl: clamp(var(--text-20), 1.0054rem + 1.087vw, var(--text-30));
  --text-2xl: clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-36));
  --text-3xl: clamp(var(--text-30), 1.4348rem + 1.9565vw, var(--text-48));
  --text-4xl: clamp(var(--text-48), 2.1818rem + 3.6364vw, var(--text-80));\n`;
  } else {
    css += `  --text-s: var(--text-14);
  --text-m: var(--text-16);
  --text-l: var(--text-18);
  --text-xl: var(--text-24);
  --text-2xl: var(--text-30);
  --text-3xl: var(--text-36);
  --text-4xl: var(--text-48);\n`;
  }

  // Espacements
  css += `\n  /* Spacing Tokens */\n`;
  if (spacingResponsive) {
    css += `  --gap-xs: var(--spacing-4);
  --gap-s: clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16));
  --gap-m: clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32));
  --gap-l: clamp(var(--spacing-24), 0.8864rem + 2.7273vw, var(--spacing-48));
  --gap-xl: clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80));
  --spacing-xs: var(--spacing-4);
  --spacing-s: clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16));
  --spacing-m: clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32));
  --spacing-l: clamp(var(--spacing-24), 0.8864rem + 2.2727vw, var(--spacing-48));
  --spacing-xl: clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80));\n`;
  } else {
    css += `  --gap-xs: var(--spacing-4);
  --gap-s: var(--spacing-8);
  --gap-m: var(--spacing-16);
  --gap-l: var(--spacing-24);
  --gap-xl: var(--spacing-32);
  --spacing-xs: var(--spacing-4);
  --spacing-s: var(--spacing-8);
  --spacing-m: var(--spacing-16);
  --spacing-l: var(--spacing-24);
  --spacing-xl: var(--spacing-32);\n`;
  }

  // Form controls
  css += `\n  /* Forms Tokens */\n`;
  if (themeMode === "both") {
    css += `  --form-control-background: light-dark(var(--color-slate-200), var(--color-slate-700));
  --on-form-control: light-dark(var(--color-gray-900), var(--color-gray-100));\n`;
  } else if (themeMode === "light") {
    css += `  --form-control-background: var(--color-slate-200);
  --on-form-control: var(--color-gray-900);\n`;
  } else {
    css += `  --form-control-background: var(--color-slate-700);
  --on-form-control: var(--color-gray-100);\n`;
  }

  css += `  --form-control-spacing: var(--spacing-12) var(--spacing-16);
  --form-control-border-width: 1px;
  --form-control-border-color: var(--color-gray-400);
  --form-control-border-radius: var(--radius-md);
  --checkables-border-color: var(--color-gray-400);
  --checkable-size: 1.25em;
}\n`;

  // Afficher le résultat
  elements.generatedCss.textContent = css;
}

/**
 * Génère le contenu de theme.css avec les variables personnalisées
 */
function generateThemeCSS() {
  const { customVars } = state.config;

  if (!customVars.trim()) {
    return state.themeContent; // Retourner le contenu original si pas de variables custom
  }

  // Ajouter les variables personnalisées à la fin du :root existant
  let themeCSS = state.themeContent;

  // Trouver la dernière occurrence de la fermeture du :root
  const lastBraceIndex = themeCSS.lastIndexOf("}");

  if (lastBraceIndex !== -1) {
    const customSection = `\n  /* Custom Color Variables (ajoutées par Primary) */\n  ${customVars.trim()}\n`;
    themeCSS =
      themeCSS.slice(0, lastBraceIndex) +
      customSection +
      themeCSS.slice(lastBraceIndex);
  }

  return themeCSS;
}

/**
 * Copie le CSS dans le presse-papier
 */
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(elements.generatedCss.textContent);

    // Feedback visuel
    const originalText = elements.btnCopy.innerHTML;
    elements.btnCopy.innerHTML = '<span aria-hidden="true">✅</span> Copié !';
    elements.btnCopy.disabled = true;

    setTimeout(() => {
      elements.btnCopy.innerHTML = originalText;
      elements.btnCopy.disabled = false;
    }, 2000);
  } catch (error) {
    console.error("Erreur lors de la copie:", error);
    alert("Erreur lors de la copie dans le presse-papier");
  }
}

/**
 * Télécharge le(s) fichier(s) CSS
 */
function downloadFile() {
  const { customVars } = state.config;
  const hasCustomVars = customVars.trim() !== "";

  if (hasCustomVars) {
    // Télécharger les deux fichiers
    downloadBothFiles();
  } else {
    // Télécharger uniquement theme-tokens.css
    downloadSingleFile("theme-tokens.css", elements.generatedCss.textContent);
  }
}

/**
 * Télécharge un seul fichier
 */
function downloadSingleFile(filename, content) {
  const blob = new Blob([content], { type: "text/css" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Télécharge theme.css et theme-tokens.css ensemble
 */
function downloadBothFiles() {
  const themeContent = generateThemeCSS();
  const tokensContent = elements.generatedCss.textContent;

  // Télécharger theme.css
  downloadSingleFile("theme.css", themeContent);

  // Télécharger theme-tokens.css après un court délai
  setTimeout(() => {
    downloadSingleFile("theme-tokens.css", tokensContent);
  }, 100);
}

// Lancer l'application au chargement de la page
init();
