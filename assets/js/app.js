/**
 * Bootstrap minimal de l'application.
 * Cette version délègue l'initialisation et les UI helpers à
 * `assets/js/modules/app-init.js` pour rendre `app.js` modulaire.
 */
import { init } from "./modules/app-init.js";
import {
  loadThemeFile,
  loadResetFile,
  loadLayoutsFile,
  loadNativesFile,
  loadStylesFiles,
} from "./modules/files.js";

// Bootstrap : charger les assets nécessaires puis démarrer l'app
(async function bootstrap() {
  try {
    await loadThemeFile();
    await loadResetFile();
    await loadLayoutsFile();
    await loadNativesFile();
    await loadStylesFiles();
  } catch (e) {
    // Si un chargement échoue, on log et on continue pour permettre au UI
    // de s'initialiser en mode dégradé.
    console.warn("Warning during asset loading:", e);
  } finally {
    init();
  }
})();
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
 * Parse toutes les variantes de couleur (nom et valeur)
 * @returns Map<colorName, Map<variant, value>>
 */
function parseColorVariants(cssText) {
  const colorsMap = new Map();
  const colorRegex = /--color-(\w+)-(\d+|fade|bright):\s*([^;]+);/g;
  let match;

  while ((match = colorRegex.exec(cssText)) !== null) {
    const [, colorName, variant, value] = match;

    if (!colorsMap.has(colorName)) {
      colorsMap.set(colorName, new Map());
    }

    colorsMap.get(colorName).set(variant, value.trim());
  }

  return colorsMap;
}

/**
 * Génère les variantes manquantes d'une couleur par interpolation
 * @param {Map<string, string>} variants - Variantes existantes (variant -> value)
 * @returns {Map<string, string>} - Toutes les variantes (existantes + générées)
 */
function generateMissingVariants(variants) {
  const required = ["100", "300", "500", "700"];
  const result = new Map(variants);

  // Si toutes les variantes requises existent déjà, retourner tel quel
  const hasAll = required.every((v) => variants.has(v));
  if (hasAll) return result;

  // Convertir les variantes existantes en tableaux triés
  const existing = Array.from(variants.entries())
    .filter(([k]) => /^\d+$/.test(k))
    .map(([k, v]) => [parseInt(k), v])
    .sort((a, b) => a[0] - b[0]);

  if (existing.length === 0) return result;

  // Fonction d'interpolation entre deux valeurs OKLCH
  const interpolate = (val1, val2, ratio) => {
    // Parser les valeurs OKLCH: oklch(L% C H)
    const parseOKLCH = (str) => {
      const match = str.match(
        /oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/
      );
      if (!match) return null;
      return {
        l: parseFloat(match[1]),
        c: parseFloat(match[2]),
        h: parseFloat(match[3]),
        alpha: match[4] || "",
      };
    };

    const c1 = parseOKLCH(val1);
    const c2 = parseOKLCH(val2);

    if (!c1 || !c2) return val1;

    const l = c1.l + (c2.l - c1.l) * ratio;
    const c = c1.c + (c2.c - c1.c) * ratio;
    const h = c1.h + (c2.h - c1.h) * ratio;

    return `oklch(${l.toFixed(2)}% ${c.toFixed(2)} ${h.toFixed(2)})`;
  };

  // Générer les variantes manquantes
  required.forEach((target) => {
    const targetNum = parseInt(target);

    if (!result.has(target)) {
      // Trouver les variantes encadrantes
      let lower = null;
      let upper = null;

      for (let i = 0; i < existing.length; i++) {
        if (existing[i][0] < targetNum) {
          lower = existing[i];
        }
        if (existing[i][0] > targetNum && !upper) {
          upper = existing[i];
        }
      }

      let interpolatedValue;

      if (lower && upper) {
        // Interpolation entre deux valeurs
        const ratio = (targetNum - lower[0]) / (upper[0] - lower[0]);
        interpolatedValue = interpolate(lower[1], upper[1], ratio);
      } else {
        // Extrapolation basée sur une échelle standard de luminosité
        // Échelle de référence : 100=98%, 300=84%, 500=64%, 700=44%
        const lightnessScale = {
          100: 98,
          300: 84,
          500: 64,
          700: 44,
        };

        // Prendre la valeur de référence (la plus proche disponible)
        const refVariant = existing[0];
        const refNum = refVariant[0];
        const refValue = refVariant[1];

        const parsed = refValue.match(
          /oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/
        );

        if (parsed) {
          const refLightness = parseFloat(parsed[1]);
          const chroma = parsed[2];
          const hue = parsed[3];
          const alpha = parsed[4] ? ` / ${parsed[4]}` : "";

          // Calculer le décalage de luminosité par rapport à la référence
          const refStandardL = lightnessScale[refNum] || 64;
          const offset = refLightness - refStandardL;

          // Appliquer l'échelle standard avec le décalage
          const targetL = lightnessScale[targetNum] + offset;

          interpolatedValue = `oklch(${targetL.toFixed(
            2
          )}% ${chroma} ${hue}${alpha})`;
        }
      }

      if (interpolatedValue) {
        result.set(target, interpolatedValue);
      }
    }
  });

  return result;
}

/**
 * Met à jour les choix de couleurs dans le formulaire
 */
function updateColorChoices() {
  const customColors = parseColorVariables(state.config.customVars);
  const colorChoicesContainer = document.querySelector(".color-choices");

  // Construire la map des variantes disponibles en combinant le theme et
  // les variables personnalisées (pour pouvoir afficher les teintes 100/300/500/700)
  const combined = state.themeContent + "\n" + state.config.customVars;
  const colorsMap = parseColorVariants(combined);

  // Si l'utilisateur a ajouté des couleurs personnalisées, utiliser uniquement
  // celles-ci. Sinon, afficher le placeholder 'raspberry'.
  const allColors = customColors.length > 0 ? [...customColors] : ["raspberry"];

  // Si l'utilisateur a ajouté des couleurs et que la couleur primaire est
  // encore 'raspberry', basculer automatiquement sur la première couleur
  // personnalisée pour éviter de référencer une variable inexistante.
  if (customColors.length > 0 && state.config.primaryColor === "raspberry") {
    state.config.primaryColor = customColors[0];
  }

  // Régénérer les choix
  // Helper: génère le markup des swatches multiples selon les variantes présentes
  const swatchMarkup = (color) => {
    const variantsOrder = ["100", "300", "500", "700"];

    // Cas particulier pour le placeholder 'raspberry' : afficher les
    // variantes connues du placeholder (100/300/500/700) pour que le
    // swatch soit multi-segment à l'étape 2 même si le runtime n'a pas
    // de variables --color-raspberry-... définies.
    let variantsAvailable = [];
    if (color === "raspberry" && !colorsMap.has("raspberry")) {
      variantsAvailable = variantsOrder.filter(
        (v) => typeof PLACEHOLDER_RASPBERRY[v] !== "undefined"
      );
    } else {
      variantsAvailable = variantsOrder.filter((v) =>
        colorsMap.has(color) ? colorsMap.get(color).has(v) : false
      );

      // Si aucune variante connue, tenter le fallback 500 en assumant qu'elle existe
      if (variantsAvailable.length === 0) {
        if (colorsMap.has(color)) {
          const keys = Array.from(colorsMap.get(color).keys());
          if (keys.length > 0) variantsAvailable.push(keys[0]);
          else variantsAvailable.push("500");
        } else {
          variantsAvailable.push("500");
        }
      }
    }

    // Helper pour obtenir la valeur CSS de la variante (placeholder ou var())
    const getVariantValue = (c, v) => {
      if (c === "raspberry" && PLACEHOLDER_RASPBERRY[v]) {
        return PLACEHOLDER_RASPBERRY[v];
      }
      return `var(--color-${c}-${v})`;
    };

    // Si plusieurs variantes, afficher une rangée de segments, sinon afficher un grand swatch
    if (variantsAvailable.length > 1) {
      const segments = variantsAvailable
        .map((v) => {
          const val = getVariantValue(color, v);
          return `<span class="swatch-seg" style="background: ${val};" aria-hidden="true"></span>`;
        })
        .join("");
      return `<span class="color-swatch multi" aria-hidden="true">${segments}</span>`;
    }

    // Single variant
    const singleVal = getVariantValue(color, variantsAvailable[0]);
    return `<span class="color-swatch" style="background: ${singleVal};" aria-hidden="true"></span>`;
  };

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
        ${swatchMarkup(color)}
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

        // Générer les fichiers CSS si on arrive à l'étape 3
        if (state.currentStep === 3) {
          generateAllFiles();
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
    .querySelectorAll('input[name="typo-responsive"]')
    .forEach((input) => {
      input.addEventListener("change", (e) => {
        state.config.typoResponsive = e.target.value === "true";
      });
    });

  document
    .querySelectorAll('input[name="spacing-responsive"]')
    .forEach((input) => {
      input.addEventListener("change", (e) => {
        state.config.spacingResponsive = e.target.value === "true";
      });
    });

  document.querySelectorAll('input[name="font-family"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      state.config.fontFamily = e.target.value;
    });
  });

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

  // Actions de copie
  elements.btnCopyApp.addEventListener("click", () =>
    copyToClipboard(elements.generatedApp)
  );
  elements.btnCopyReset.addEventListener("click", () =>
    copyToClipboard(elements.generatedReset)
  );
  elements.btnCopyLayouts.addEventListener("click", () =>
    copyToClipboard(elements.generatedLayouts)
  );
  elements.btnCopyNatives.addEventListener("click", () =>
    copyToClipboard(elements.generatedNatives)
  );
  elements.btnCopyTheme.addEventListener("click", () =>
    copyToClipboard(elements.generatedTheme)
  );
  elements.btnCopyTokens.addEventListener("click", () =>
    copyToClipboard(elements.generatedTokens)
  );
  elements.btnCopyStyles.addEventListener("click", () =>
    copyToClipboard(elements.generatedStyles)
  );

  // Action de téléchargement unique
  elements.btnDownloadAll.addEventListener("click", downloadAllFiles);
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

    // Générer les fichiers CSS si on arrive à l'étape 3
    if (state.currentStep === 3) {
      generateAllFiles();
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
 * Génère le fichier theme-tokens.css selon la configuration
 */
function generateTokensCSS() {
  const {
    primaryColor,
    themeMode,
    typoResponsive,
    spacingResponsive,
    customVars,
  } = state.config;

  // Valider les variables personnalisées avant génération
  const validation = validateCustomVars(customVars);
  if (validation !== true) {
    throw new Error(`Variables personnalisées invalides : ${validation}`);
  }

  // Utiliser directement le nom de la couleur pour référencer la variable
  const primaryValue = `var(--color-${primaryColor}-500)`;

  // Générer l'en-tête
  let css = `/* ----------------------------------
 * Theme-tokens, généré par primary.alsacreations.com
 * Surcouche de theme.css
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

:root {\n`;

  // Ajouter color-scheme si mode both
  if (themeMode === "both") {
    css += `  /* Color Scheme */
  color-scheme: light dark;

  &[data-theme="light"] {
    color-scheme: light;
  }

  &[data-theme="dark"] {
    color-scheme: dark;
  }

`;
  }

  // Couleurs primaires
  css += `  /* Couleur primaire */
  --primary: ${primaryValue};
  --on-primary: var(--color-white);\n`;

  // Générer les tokens de couleur selon le mode
  if (themeMode === "both") {
    css += `
  /* Couleur d'accent */
  --accent: light-dark(var(--primary), var(--color-${primaryColor}-300));
  --accent-invert: light-dark(var(--color-${primaryColor}-300), var(--primary));

  /* Surface du document */
  --surface: light-dark(var(--color-white), var(--color-gray-900));
  --on-surface: light-dark(var(--color-gray-900), var(--color-gray-100));

  /* Niveaux de profondeur */
  --layer-1: light-dark(var(--color-gray-50), var(--color-gray-800));
  --layer-2: light-dark(var(--color-gray-100), var(--color-gray-700));
  --layer-3: light-dark(var(--color-gray-200), var(--color-gray-600));

  /* Interactions */
  --link: light-dark(var(--primary), var(--color-${primaryColor}-300));
  --link-hover: light-dark(var(--color-${primaryColor}-700), var(--primary));

  /* Couleur de sélection */
  --selection: light-dark(var(--color-${primaryColor}-300), var(--color-${primaryColor}-500));

  /* États */
  --warning: light-dark(var(--color-warning-500), var(--color-warning-300));
  --error: light-dark(var(--color-error-500), var(--color-error-300));
  --success: light-dark(var(--color-success-500), var(--color-success-300));
  --info: light-dark(var(--color-info-500), var(--color-info-300));\n`;
  } else if (themeMode === "light") {
    css += `
  /* Couleur d'accent */
  --accent: var(--color-${primaryColor}-700);
  --accent-invert: var(--color-${primaryColor}-300);

  /* Surface du document */
  --surface: var(--color-white);
  --on-surface: var(--color-gray-900);

  /* Niveaux de profondeur */
  --layer-1: var(--color-gray-50);
  --layer-2: var(--color-gray-100);
  --layer-3: var(--color-gray-200);

  /* Interactions */
  --link: var(--primary);
  --link-hover: var(--color-${primaryColor}-700);

  /* Couleur de sélection */
  --selection: var(--color-${primaryColor}-300);

  /* États */
  --warning: var(--color-warning-500);
  --error: var(--color-error-500);
  --success: var(--color-success-500);
  --info: var(--color-info-500);\n`;
  } else {
    // dark
    css += `
  /* Couleur d'accent */
  --accent: var(--color-${primaryColor}-300);
  --accent-invert: var(--color-${primaryColor}-700);

  /* Surface du document */
  --surface: var(--color-gray-900);
  --on-surface: var(--color-gray-100);

  /* Niveaux de profondeur */
  --layer-1: var(--color-gray-800);
  --layer-2: var(--color-gray-700);
  --layer-3: var(--color-gray-600);

  /* Interactions */
  --link: var(--color-${primaryColor}-300);
  --link-hover: var(--primary);

  /* Couleur de sélection */
  --selection: var(--color-${primaryColor}-500);

  /* États */
  --warning: var(--color-warning-300);
  --error: var(--color-error-300);
  --success: var(--color-success-300);
  --info: var(--color-info-300);\n`;
  }

  // Ajouter les bordures pour le mode both
  if (themeMode === "both") {
    css += `  --border-light: light-dark(var(--color-gray-200), var(--color-gray-700));
  --border-medium: light-dark(var(--color-gray-300), var(--color-gray-600));\n`;
  }

  // Typographie
  css += `\n  /* Tailles de police */\n`;
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
  css += `\n  /* Espacements */\n`;
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
  css += `\n  /* Formulaires */\n`;
  if (themeMode === "both") {
    css += `  --form-control-background: light-dark(var(--color-gray-200), var(--color-gray-700));
  --on-form-control: light-dark(var(--color-gray-900), var(--color-gray-100));\n`;
  } else if (themeMode === "light") {
    css += `  --form-control-background: var(--color-gray-200);
  --on-form-control: var(--color-gray-900);\n`;
  } else {
    css += `  --form-control-background: var(--color-gray-700);
  --on-form-control: var(--color-gray-100);\n`;
  }

  css += `  --form-control-spacing: var(--spacing-12) var(--spacing-16);
  --form-control-border-width: 1px;
  --form-control-border-color: var(--color-gray-400);
  --form-control-border-radius: var(--radius-m);
  --checkables-border-color: var(--color-gray-400);
  --checkable-size: 1.25em;
}

*::selection {
  background: var(--selection);
}\n`;

  return css;
}

/**
 * Génère le contenu de theme.css avec les variables personnalisées et générées
 */
function generateThemeCSS() {
  const { customVars, primaryColor } = state.config;
  let themeCSS = state.themeContent;

  // Parser les couleurs disponibles
  const allColors = state.themeContent + "\n" + customVars;
  const colorsMap = parseColorVariants(allColors);

  // Générer les variantes manquantes pour la couleur primaire
  let generatedVariants = "";
  if (colorsMap.has(primaryColor)) {
    const variants = colorsMap.get(primaryColor);
    const requiredVariants = ["100", "300", "500", "700"];
    const missing = requiredVariants.filter((v) => !variants.has(v));

    if (missing.length > 0) {
      const completed = generateMissingVariants(variants);
      const generated = [];

      missing.forEach((variant) => {
        if (completed.has(variant)) {
          generated.push(
            `  --color-${primaryColor}-${variant}: ${completed.get(variant)};`
          );
        }
      });

      if (generated.length > 0) {
        generatedVariants = `\n  /* Variantes générées automatiquement pour --color-${primaryColor} */\n${generated.join(
          "\n"
        )}\n`;
      }
    }
  }

  // Construire la section complète à ajouter
  let additionalContent = "";

  if (customVars.trim()) {
    // Ajouter l'indentation à chaque ligne des variables personnalisées
    const indentedCustomVars = customVars
      .trim()
      .split(/\r?\n/) // Gérer les retours chariot Windows et Unix
      .map((line) => `  ${line.trim()}`)
      .filter((line) => line.trim().length > 2) // Ignorer les lignes vides (juste "  ")
      .join("\n");
    additionalContent += `\n  /* Couleurs projet personnalisées */\n${indentedCustomVars}\n`;
  }

  if (generatedVariants) {
    additionalContent += generatedVariants;
  }

  // Si la couleur primaire demandée est 'raspberry' et qu'elle n'existe pas
  // dans le theme (par ex. runtime dépourvu de raspberry), injecter les
  // définitions placeholder depuis la constante JS afin que le fichier
  // généré contienne bien les variables nécessaires.
  if (primaryColor === "raspberry") {
    const hasRaspberry = colorsMap.has("raspberry");
    const customList = parseColorVariables(customVars);
    if (!hasRaspberry && customList.length === 0) {
      let raspBlock = `\n  /* Placeholder 'raspberry' injecté par le générateur */\n`;
      Object.keys(PLACEHOLDER_RASPBERRY).forEach((variant) => {
        raspBlock += `  --color-raspberry-${variant}: ${PLACEHOLDER_RASPBERRY[variant]};\n`;
      });
      additionalContent += raspBlock;
    }
  }

  // Trouver la dernière occurrence de la fermeture du :root
  const lastBraceIndex = themeCSS.lastIndexOf("}");

  if (lastBraceIndex !== -1 && additionalContent) {
    themeCSS =
      themeCSS.slice(0, lastBraceIndex) +
      additionalContent +
      themeCSS.slice(lastBraceIndex);
  }

  // Si l'utilisateur a ajouté des couleurs personnalisées, retirer le
  // placeholder 'raspberry' des définitions dans le theme généré afin que
  // la variable ne figure plus dans le fichier de sortie.
  const customColorsList = parseColorVariables(customVars);
  if (customColorsList.length > 0) {
    // Supprimer toute occurrence de définitions --color-raspberry-* dans
    // le contenu généré, quel que soit le format (ligne, indentation, etc.).
    themeCSS = themeCSS.replace(/--color-raspberry-[\w-]*:\s*[^;]+;?/g, "");
    // Nettoyer les retours à la ligne multiples éventuels et espaces résiduels
    themeCSS = themeCSS.replace(/\n{3,}/g, "\n\n").replace(/\n\s+\n/g, "\n\n");
  }

  // Filtrer les couleurs réservées au runtime (ex: 'ocean') de la sortie
  // générée pour que les exports restent propres et n'exposent pas les
  // primitives internes de l'application.
  if (
    typeof RUNTIME_ONLY_COLORS !== "undefined" &&
    RUNTIME_ONLY_COLORS.size > 0
  ) {
    const names = Array.from(RUNTIME_ONLY_COLORS)
      .map((n) => n.replace(/[-\\/\\^$*+?.()|[\]{}]/g, "\\$&"))
      .join("|");

    // Supprimer les lignes de définition de variables --color-<name>-*
    const varRx = new RegExp(`--color-(?:${names})-[\\w-]*:\\s*[^;]+;?`, "g");
    themeCSS = themeCSS.replace(varRx, "");

    // Supprimer les @import qui importent des palettes runtime (palettes/<name>.css)
    // Le pattern précédent ciblait l'import inline mais pouvait laisser des
    // traces si la ligne contenait des modificateurs (ex: layer(config)) ou
    // d'autres tokens ; supprimer maintenant n'importe quelle ligne qui
    // référence palettes/<name>.css pour être sûr qu'aucune importation
    // runtime ne fuite dans les fichiers exportés.
    const importRx = new RegExp(
      `@import\\s+["']?[^"';]*palettes\\/(?:${names})\\.css["']?;?`,
      "gi"
    );
    themeCSS = themeCSS.replace(importRx, "");

    // Suppression de secours : toute ligne (quelle que soit sa forme)
    // contenant palettes/<name>.css est retirée (prise en compte des
    // variantes comme `@import "palettes/ocean.css" layer(config);`).
    const lineFallback = new RegExp(
      `^.*palettes\\/(?:${names})\\.css.*$\\n?`,
      "gmi"
    );
    themeCSS = themeCSS.replace(lineFallback, "");

    // Nettoyer les retours à la ligne multiples et espaces résiduels
    themeCSS = themeCSS.replace(/\n{3,}/g, "\n\n").replace(/\n\s+\n/g, "\n\n");
  }

  return themeCSS;
}

/**
 * Génère le contenu de styles.css selon la configuration
 */
function generateStylesCSS() {
  const { fontFamily } = state.config;

  // Choisir le bon fichier selon la configuration
  return fontFamily === "poppins"
    ? state.stylesPoppinsContent
    : state.stylesSystemContent;
}

/**
 * Génère le contenu de app.css
 */
function generateAppCSS() {
  return `/* css/app.css */
/* L'ordre des layers définit la priorité des styles */
/* Chaque layer écrase le précédent si conflit */
@layer config, base, components, utilities;

/* Config */
@import "reset.css" layer(config);
@import "theme.css" layer(config);
@import "theme-tokens.css" layer(config);
@import "layouts.css" layer(config);
@import "natives.css" layer(config);

/* Base */
@import "styles.css" layer(base);

/* Components */
/* Ici un @import dans le layer(components) */

/* Utilities */
/* Ici un @import dans le layer(utilities) */
`;
}

/**
 * Génère et affiche tous les fichiers CSS
 */
function generateAllFiles() {
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

/**
 * Copie le CSS dans le presse-papier
 */
async function copyToClipboard(element) {
  try {
    await navigator.clipboard.writeText(element.textContent);

    // Feedback visuel - Trouver le bouton overlay dans le details parent
    const button = element
      .closest("details")
      .querySelector(".btn-copy-overlay");
    const originalText = button.innerHTML;
    button.innerHTML = '<span aria-hidden="true">✅</span>';
    button.disabled = true;

    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = false;
    }, 2000);
  } catch (error) {
    console.error("Erreur lors de la copie:", error);
    alert("Erreur lors de la copie dans le presse-papier");
  }
}

/**
 * Télécharge tous les fichiers CSS générés
 */
async function downloadAllFiles() {
  const appCSS = elements.generatedApp.textContent;
  const resetCSS = elements.generatedReset.textContent;
  const layoutsCSS = elements.generatedLayouts.textContent;
  const nativesCSS = elements.generatedNatives.textContent;
  const themeCSS = elements.generatedTheme.textContent;
  const tokensCSS = elements.generatedTokens.textContent;
  const stylesCSS = elements.generatedStyles.textContent;
  const { fontFamily } = state.config;

  // Créer une archive ZIP
  const zip = new JSZip();

  // Ajouter les fichiers CSS dans assets/css/
  zip.file("assets/css/app.css", appCSS);
  zip.file("assets/css/reset.css", resetCSS);
  zip.file("assets/css/layouts.css", layoutsCSS);
  zip.file("assets/css/natives.css", nativesCSS);
  zip.file("assets/css/theme.css", themeCSS);
  zip.file("assets/css/theme-tokens.css", tokensCSS);
  zip.file("assets/css/styles.css", stylesCSS);

  // Ajouter le fichier index.html à la racine
  try {
    const indexResponse = await fetch("public/samples/index.html");
    const indexContent = await indexResponse.text();
    zip.file("index.html", indexContent);
  } catch (error) {
    console.error("Erreur lors du chargement de index.html:", error);
  }

  // Ajouter le fichier alsacreations.svg dans img/
  try {
    const svgResponse = await fetch("public/samples/alsacreations.svg");
    const svgBlob = await svgResponse.blob();
    zip.file("img/alsacreations.svg", svgBlob);
  } catch (error) {
    console.error("Erreur lors du chargement de alsacreations.svg:", error);
  }

  // Ajouter le fichier favicon.svg dans img/
  try {
    const faviconResponse = await fetch("public/samples/favicon.svg");
    const faviconBlob = await faviconResponse.blob();
    zip.file("img/favicon.svg", faviconBlob);
  } catch (error) {
    console.error("Erreur lors du chargement de favicon.svg:", error);
  }

  // Si police Poppins sélectionnée, ajouter le fichier de police dans assets/css/fonts/
  if (fontFamily === "poppins") {
    try {
      // Télécharger le fichier de police
      const fontResponse = await fetch(
        "public/samples/Poppins-Variable-opti.woff2"
      );
      const fontBlob = await fontResponse.blob();
      zip.file("assets/css/fonts/Poppins-Variable-opti.woff2", fontBlob);
    } catch (error) {
      console.error("Erreur lors du chargement de la police:", error);
    }
  }

  // Générer et télécharger l'archive
  try {
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);

    const link = document.createElement("a");
    link.href = url;
    link.download = "primary-css.zip";
    link.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erreur lors de la génération du ZIP:", error);
    alert("Erreur lors de la création de l'archive");
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

// Lancer l'application au chargement de la page
init();
