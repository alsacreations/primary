/**
 * Module UI - Primary CSS Generator
 * Gestion de l'interface utilisateur
 */

import { state, PLACEHOLDER_RASPBERRY } from "./state.js";
import { elements } from "./dom.js";
import {
  generateTokensCSS,
  generateThemeCSS,
  generateThemeJSON,
  generateStylesCSS,
  generateAppCSS,
  generateMissingVariants,
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
 * Synchronise la configuration depuis le DOM vers `state.config`.
 * Appelée automatiquement avant toute génération pour éviter les
 * problèmes de valeurs stale quand les listeners n'ont pas encore
 * propagé l'état.
 */
export function syncConfigFromDOM() {
  try {
    // Primary color (select or radio container)
    const primaryContainer = elements.primaryColorSelect;
    if (primaryContainer) {
      if (primaryContainer.tagName === "SELECT") {
        state.config.primaryColor = primaryContainer.value;
      } else {
        const checked = primaryContainer.querySelector(
          'input[name="primary-color"]:checked'
        );
        if (checked) state.config.primaryColor = checked.value;
      }
    }

    // Theme mode radios
    if (elements.themeModeInputs && elements.themeModeInputs.length) {
      const checked = Array.from(elements.themeModeInputs).find(
        (i) => i.checked
      );
      if (checked) state.config.themeMode = checked.value;
    }

    // Typographie responsive (radios or single alias)
    if (elements.typoResponsiveInputs && elements.typoResponsiveInputs.length) {
      const checked = Array.from(elements.typoResponsiveInputs).find(
        (i) => i.checked
      );
      if (checked) state.config.typoResponsive = checked.value === "true";
    } else if (elements.typoResponsiveInput) {
      // fallback: checkbox-like input
      state.config.typoResponsive = !!elements.typoResponsiveInput.checked;
    }

    // Espacements responsive
    if (
      elements.spacingResponsiveInputs &&
      elements.spacingResponsiveInputs.length
    ) {
      const checked = Array.from(elements.spacingResponsiveInputs).find(
        (i) => i.checked
      );
      if (checked) state.config.spacingResponsive = checked.value === "true";
    } else if (elements.spacingResponsiveInput) {
      state.config.spacingResponsive =
        !!elements.spacingResponsiveInput.checked;
    }

    // Font family
    if (elements.fontFamilyInputs && elements.fontFamilyInputs.length) {
      const checked = Array.from(elements.fontFamilyInputs).find(
        (i) => i.checked
      );
      if (checked) state.config.fontFamily = checked.value;
    }

    // Technology (static | wordpress)
    if (elements.technologyInputs && elements.technologyInputs.length) {
      const checkedTech = Array.from(elements.technologyInputs).find(
        (i) => i.checked
      );
      if (checkedTech) state.config.technology = checkedTech.value;
    }

    // Variables personnalisées
    if (elements.customVarsInput) {
      state.config.customVars = elements.customVarsInput.value || "";
    }

    // Debug log to help diagnose cases where DOM changes are not
    // reflected in the generated output.
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[generator] syncConfigFromDOM ->", {
        primaryColor: state.config.primaryColor,
        themeMode: state.config.themeMode,
        typoResponsive: state.config.typoResponsive,
        spacingResponsive: state.config.spacingResponsive,
      });
    }
  } catch (e) {
    // noop defensive
  }
}

// Exposer la fonction de synchronisation globalement pour permettre
// à d'autres modules (ex: generators) d'obtenir l'état DOM actuel
// avant de lancer une génération. Ceci évite des conditions de course
// où les listeners n'ont pas encore propagé les changements.
if (typeof window !== "undefined") {
  window.syncConfigFromDOM = syncConfigFromDOM;
}

// Expose generateAllFiles for debugging (call window.generateAllFiles())
if (typeof window !== "undefined") {
  window.generateAllFiles = generateAllFiles;
}

/**
 * Met à jour les choix de couleurs disponibles
 */
export function updateColorChoices() {
  if (!elements.primaryColorSelect) return;

  // If the primaryColor reference is a <select>, keep legacy behavior
  if (elements.primaryColorSelect.tagName === "SELECT") {
    // Backwards compatible: build <option> list
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

    // Déduire les couleurs réellement présentes dans themeContent
    const themeColors = [
      "raspberry",
      "blue",
      "green",
      "orange",
      "purple",
      "red",
      "yellow",
    ];
    const themeColorsFound = new Set();
    try {
      // Pattern 1: couleurs standard --color-{nom}-{numéro|fade|bright}
      const rx1 = /--color-([a-z0-9-]+)-(?:\d+|fade|bright)\s*:/gim;
      let m;
      while ((m = rx1.exec(state.themeContent || ""))) {
        themeColorsFound.add(m[1]);
      }

      // Pattern 2: couleurs Figma --color-primary|secondary|tertiary-{nom}
      const rx2 = /--color-(primary|secondary|tertiary)-([a-z0-9-]+)\s*:/gim;
      while ((m = rx2.exec(state.themeContent || ""))) {
        themeColorsFound.add(m[1]); // ajouter "primary", "secondary", "tertiary"
      }
    } catch (e) {
      /* noop */
    }

    // Regrouper les colors custom par base
    const getBaseName = (varName) =>
      varName.replace(/^--color-/, "").replace(/-(?:\d+|fade|bright)$/, "");
    const customBases = new Set();
    for (const [varName] of customColors) {
      customBases.add(getBaseName(varName));
    }

    // Générer les options (préserver l'ordre des themeColors)
    let options = "";
    themeColors.forEach((color) => {
      if (themeColorsFound.size === 0 || themeColorsFound.has(color)) {
        const selected = state.config.primaryColor === color ? " selected" : "";
        options += `<option value="${color}"${selected}>${color}</option>`;
      }
    });

    if (customBases.size > 0) {
      // Ne pas ajouter de label/optgroup visible pour les couleurs
      // personnalisées — ajouter directement les options.
      for (const baseName of customBases) {
        if (themeColorsFound.has(baseName)) continue;
        const selected =
          state.config.primaryColor === baseName ? " selected" : "";
        options += `<option value="${baseName}"${selected}>${baseName}</option>`;
      }
    }

    elements.primaryColorSelect.innerHTML = options;
    return;
  }

  // Otherwise assume it's a container (.color-choices) and render radio swatches
  const container = elements.primaryColorSelect;
  container.innerHTML = "";

  // Collect custom colors from user input
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

  // Déduire les couleurs présentes dans le thème (state.themeContent)
  const themeColors = [
    "raspberry",
    "blue",
    "green",
    "orange",
    "purple",
    "red",
    "yellow",
  ];
  const themeColorsFound = new Set();
  try {
    // Pattern 1: couleurs standard --color-{nom}-{numéro|fade|bright}
    const rx1 = /--color-([a-z0-9-]+)-(?:\d+|fade|bright)\s*:/gim;
    let m;
    while ((m = rx1.exec(state.themeContent || ""))) {
      themeColorsFound.add(m[1]);
    }

    // Pattern 2: couleurs Figma --color-primary|secondary|tertiary-{nom}
    const rx2 = /--color-(primary|secondary|tertiary)-([a-z0-9-]+)\s*:/gim;
    while ((m = rx2.exec(state.themeContent || ""))) {
      themeColorsFound.add(m[1]); // ajouter "primary", "secondary", "tertiary"
    }
  } catch (e) {
    /* noop */
  }

  // Helper pour extraire le nom de base d'une variable (--color-<base>-<variant>)
  const getBaseName = (varName) => {
    return varName
      .replace(/^--color-/, "")
      .replace(/-(?:\d+|fade|bright)$/, "");
  };

  // Regrouper les couleurs personnalisées par nom de base
  const customBases = new Map();
  for (const [varName, varValue] of customColors.entries()) {
    const base = getBaseName(varName);
    if (!customBases.has(base)) customBases.set(base, []);
    customBases.get(base).push({ varName, varValue });
  }

  const buildChoice = (name, labelText, isCustom = false) => {
    const label = document.createElement("label");
    label.className = "color-choice";
    label.setAttribute("tabindex", "0");

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "primary-color";
    input.value = name;
    input.className = "visually-hidden";
    if (state.config.primaryColor === name) input.checked = true;

    // Construire un swatch multi-segment si plusieurs variantes existent
    const variantsOrder = ["100", "300", "500", "700"];

    const getVariantValue = (base, variant) => {
      const key = `--color-${base}-${variant}`;
      // 1) valeur fournie par customColors map (inline)
      if (customColors && customColors.has(key)) return customColors.get(key);

      // 2) chercher dans le themeContent
      try {
        const rx = new RegExp(`--color-${base}-${variant}:\\s*([^;]+);`, "i");
        const m = (state.themeContent || "").match(rx);
        if (m && m[1]) return m[1].trim();
      } catch (e) {
        /* noop */
      }

      // 2.5) Si la variante n'existe pas explicitement mais il existe au moins
      // une autre variante pour cette base, tenter de générer les variantes
      // manquantes à la volée via generateMissingVariants.
      try {
        // Collecter variantes présentes (numériques) depuis customColors et themeContent
        const present = new Map();
        // customColors
        if (customColors) {
          for (const [k, v] of customColors.entries()) {
            const m = k.match(new RegExp(`^--color-${base}-(\\d+)$`));
            if (m) present.set(m[1], v);
          }
        }

        // themeContent
        const rxAll = new RegExp(`--color-${base}-(\\d+):\\s*([^;]+);`, "gim");
        let mm;
        const tc = state.themeContent || "";
        while ((mm = rxAll.exec(tc))) {
          present.set(mm[1], mm[2].trim());
        }

        if (present.size > 0) {
          const completed = generateMissingVariants(present);
          if (completed && completed.has(variant))
            return completed.get(variant);
        }
      } catch (e) {
        /* noop */
      }

      // 3) raspberry placeholder
      if (
        base === "raspberry" &&
        typeof PLACEHOLDER_RASPBERRY !== "undefined"
      ) {
        if (PLACEHOLDER_RASPBERRY[variant])
          return PLACEHOLDER_RASPBERRY[variant];
      }

      // 4) fallback to CSS variable reference
      return `var(--color-${base}-${variant})`;
    };

    // Détecter si on a au moins deux variantes disponibles (pour afficher multi)
    let foundCount = 0;
    for (const v of variantsOrder) {
      const val = getVariantValue(name, v);
      if (val && !/^var\(/.test(val)) foundCount++;
    }

    let swatch;
    if (foundCount >= 2) {
      swatch = document.createElement("span");
      swatch.className = "color-swatch multi" + (isCustom ? " custom" : "");
      swatch.setAttribute("aria-hidden", "true");

      for (const v of variantsOrder) {
        const seg = document.createElement("span");
        seg.className = "swatch-seg";
        const value = getVariantValue(name, v);
        seg.style.background = value;
        seg.setAttribute("aria-hidden", "true");
        swatch.appendChild(seg);
      }
    } else {
      swatch = document.createElement("span");
      swatch.className = "color-swatch" + (isCustom ? " custom" : "");
      // valeur principale
      const mainVal = getVariantValue(name, "500");
      swatch.style.background = mainVal;
    }

    const spanName = document.createElement("span");
    spanName.className = "color-name";
    spanName.textContent = labelText;

    label.appendChild(input);
    label.appendChild(swatch);
    label.appendChild(spanName);

    return label;
  };

  // Append theme colors that actually exist in the themeContent (keeps ordering)
  for (const color of themeColors) {
    if (themeColorsFound.size === 0 || themeColorsFound.has(color)) {
      const choice = buildChoice(color, color, false);
      container.appendChild(choice);
    }
  }

  // Append custom color bases that are not part of the theme (grouped)
  if (customBases.size > 0) {
    // Ne pas afficher de titre/legend visible pour les couleurs personnalisées
    // (conserver uniquement les choix regroupés). On ajoute directement
    // les choix personnalisés après les couleurs du thème.
    for (const [baseName, variants] of customBases.entries()) {
      // Skip if this base is already shown as a theme color
      if (themeColorsFound.has(baseName)) continue;

      const choice = buildChoice(baseName, `${baseName}`, true);
      container.appendChild(choice);
    }
  }
  // Synchroniser l'état visuel des choix
  try {
    // Si l'état courant ne correspond à aucune option visible, sélectionner
    // la première option disponible afin d'éviter d'avoir aucune sélection.
    const inputs = Array.from(
      container.querySelectorAll('input[name="primary-color"]')
    );
    const hasMatching = inputs.some(
      (inp) => inp.value === state.config.primaryColor || inp.checked
    );
    if (!hasMatching && inputs.length > 0) {
      const first = inputs[0];
      state.config.primaryColor = first.value;
      first.checked = true;
    }

    refreshColorSelection();

    // Mettre à jour l'aperçu du thème si la couleur a changé
    try {
      updateThemePreview();
    } catch (e) {
      /* noop */
    }
  } catch (err) {
    // noop
  }
}

/**
 * Synchronise la classe visuelle `.is-selected` sur les éléments
 * `.color-choice` en fonction de l'état courant (`state.config.primaryColor`).
 * Utile lorsque la sélection change dynamiquement et qu'on veut s'assurer
 * d'un rendu cohérent même si :has() n'est pas pris en charge.
 */
export function refreshColorSelection() {
  const container = elements.primaryColorSelect;
  if (!container) return;

  // Si c'est un <select>, rien à faire
  if (container.tagName === "SELECT") return;

  const choices = container.querySelectorAll(".color-choice");
  choices.forEach((choice) => {
    const input = choice.querySelector('input[name="primary-color"]');
    if (!input) return;
    if (input.value === state.config.primaryColor || input.checked) {
      choice.classList.add("is-selected");
    } else {
      choice.classList.remove("is-selected");
    }
  });
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
    // Ensure we always read the latest form values from the DOM
    // before generating files. This avoids stale state when listeners
    // are not yet attached or when generation is triggered externally.
    try {
      syncConfigFromDOM();
    } catch (err) {
      /* noop */
    }

    if (typeof console !== "undefined" && console.debug) {
      console.debug(
        "[generator] generateAllFiles state.config ->",
        state.config
      );
    }
    const appCSS = generateAppCSS();
    const themeCSS = generateThemeCSS();
    console.log(
      "[generateAllFiles] Avant generateTokensCSS, state.tokensContent.length:",
      state?.tokensContent?.length || 0
    );
    console.log(
      "[generateAllFiles] state.themeFromImport:",
      state?.themeFromImport
    );
    const tokensCSS = generateTokensCSS();
    const stylesCSS = generateStylesCSS();

    // NOTE: Nous n'injectons plus automatiquement les tokens générés dans
    // le document afin de préserver la distinction entre le theme/runtime
    // de l'application et les fichiers générés pour l'export. L'injection
    // automatique provoquait des ré-écritures visuelles (par ex. collapsing
    // des light-dark en mode 'light') lorsque l'utilisateur changeait la
    // configuration. Si l'utilisateur souhaite voir un aperçu live des
    // tokens, fournir un contrôle explicite ou activer le debug via
    // `?debug=state` qui appelle `applyTokensToDocument()`.

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

    // theme.json (WordPress) : afficher uniquement en mode 'wordpress'
    if (elements.generatedThemeJson) {
      // Localiser l'élément conteneur <details> pour pouvoir le cacher
      const themeJsonContainer = elements.generatedThemeJson.closest
        ? elements.generatedThemeJson.closest("details")
        : null;

      try {
        if (state.config && state.config.technology === "wordpress") {
          // Assurer que le bloc est visible
          if (themeJsonContainer) themeJsonContainer.hidden = false;

          const themeJson = generateThemeJSON();

          // Le langage Prism pour JSON n'est pas toujours chargé dans tous
          // les embeds ; basculer en texte brut (échappé) si besoin pour
          // éviter une sortie vide.
          if (
            typeof Prism !== "undefined" &&
            Prism.languages &&
            Prism.languages.json
          ) {
            elements.generatedThemeJson.innerHTML = Prism.highlight(
              themeJson,
              Prism.languages.json,
              "json"
            );
          } else {
            // Simple safe-escaping
            const esc = (s) =>
              String(s)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            elements.generatedThemeJson.innerHTML = `<pre>${esc(
              themeJson
            )}</pre>`;
          }
        } else {
          // Pour le mode 'static' : masquer complètement le bloc (ne pas afficher
          // d'indication textuelle). Le bloc <details> est caché pour éviter
          // toute confusion.
          if (themeJsonContainer) themeJsonContainer.hidden = true;
        }
      } catch (e) {
        // Afficher l'erreur dans la zone plutôt que la laisser vide
        try {
          elements.generatedThemeJson.textContent =
            "Erreur lors de la génération de theme.json";
        } catch (err) {
          /* noop */
        }
        // et logger l'erreur pour debug
        console.error("Erreur generateAllFiles -> theme.json:", e);
      }
    }

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
