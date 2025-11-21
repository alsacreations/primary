import { state, RUNTIME_ONLY_COLORS } from "./state.js";
import { setupEventListeners as __modulesSetupEventListeners } from "./events.js";
import {
  parseColorVariants,
  parseColorVariables,
  generateMissingVariants,
  generateTokensCSS,
  normalizeTokensContent,
  chooseBestVariant,
  chooseNumericVariant,
} from "./generators.js";
import { elements } from "./dom.js";
import { loadAllCanonicals } from "./canonical-loader.js";

export function showGlobalError(message) {
  elements.globalError.textContent = message;
  elements.globalError.hidden = false;
}

export function hideGlobalError() {
  elements.globalError.hidden = true;
  elements.globalError.textContent = "";
}

export function validateCustomVars(css) {
  if (!css || !css.trim()) return true;

  const lines = css
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.startsWith("--")) {
      return `Ligne ${i + 1}: Les variables doivent commencer par "--".`;
    }

    if (!line.includes(":")) {
      return `Ligne ${i + 1}: Variable mal formée (manque ":").`;
    }

    if (!line.endsWith(";")) {
      return `Ligne ${i + 1}: Variable mal formée (manque ";").`;
    }

    const openBraces = (line.match(/\(/g) || []).length;
    const closeBraces = (line.match(/\)/g) || []).length;
    if (openBraces !== closeBraces) {
      return `Ligne ${i + 1}: Parenthèses non équilibrées.`;
    }
  }

  return true;
}

export async function init() {
  // Charger les canoniques en premier (priorité absolue)
  try {
    const canonicals = await loadAllCanonicals();

    // Si l'application n'a pas de tokens fournis par import Figma et
    // que state.tokensContent est vide, initialiser state.tokensContent
    // à partir des fichiers tokens canoniques chargés. Cela garantit
    // que la génération (`generateTokensCSS()`) reprend exactement
    // le contenu des canoniques lors de la création du kit.
    try {
      if (
        canonicals &&
        canonicals.tokens &&
        !state.tokensContent &&
        !state.themeFromImport
      ) {
        const parts = [];
        if (canonicals.tokens.commons && canonicals.tokens.commons.raw)
          parts.push(canonicals.tokens.commons.raw);
        if (canonicals.tokens.colors && canonicals.tokens.colors.raw)
          parts.push(canonicals.tokens.colors.raw);
        if (canonicals.tokens.fonts && canonicals.tokens.fonts.raw)
          parts.push(canonicals.tokens.fonts.raw);
        if (canonicals.tokens.spacings && canonicals.tokens.spacings.raw)
          parts.push(canonicals.tokens.spacings.raw);

        const combined = parts.join("\n").trim();
        if (combined) {
          try {
            // Normaliser avant d'assigner pour éviter les :root imbriqués
            state.tokensContent = normalizeTokensContent(combined);
          } catch (e) {
            // fallback: assigner brut si la normalisation échoue
            state.tokensContent = combined;
            console.warn(
              "[app-init] normalisation échouée, tokensContent assigné sans normalisation:",
              e && e.message
            );
          }
        }
      }
    } catch (e) {
      console.warn(
        "[app-init] Impossible d'initialiser state.tokensContent:",
        e
      );
    }
  } catch (error) {
    console.error("[app-init] ❌ Erreur chargement canoniques:", error);
    showGlobalError(
      "Impossible de charger les fichiers canoniques. Vérifiez que le dossier /canonical/ est accessible."
    );
  }

  // Les modules externes (files.js) doivent avoir rempli state.* avant l'appel
  // Attacher les listeners fournis par les modules si disponibles
  if (typeof window.setupEventListenersFromModules === "function") {
    window.setupEventListenersFromModules();
  } else if (typeof setupEventListeners === "function") {
    setupEventListeners();
  } else {
    // fallback : appeler la fonction d'attachement si elle existe globalement
    if (typeof window.attachEventListeners === "function") {
      window.attachEventListeners();
    }
  }

  // Générer les choix de couleurs initialement
  updateColorChoices();
  applyCustomVarsToDocument();

  // Si nous avons initialisé `state.tokensContent` depuis les canoniques
  // et que l'UI a choisi une couleur primaire (ex: via `updateColorChoices()`),
  // synchroniser le token `--primary` dans `state.tokensContent` afin
  // d'éviter une discordance entre l'UI (étape 2) et les tokens générés
  // (étape 3). Ceci remplace uniquement la déclaration --primary.
  try {
    const chosen = state.config && state.config.primaryColor;
    if (chosen && state.tokensContent) {
      // Remplacer une déclaration existante --primary: var(--color-...-NUM);
      // Choisir une variante réellement présente (ne pas forcer -500)
      try {
        const sources =
          (state.themeContent || "") +
          "\n" +
          (state.tokensContent || "") +
          "\n" +
          (state.config && state.config.customVars
            ? state.config.customVars
            : "");
        const chosenVar = chooseBestVariant(chosen, sources);
        state.tokensContent = state.tokensContent.replace(
          /(--primary\s*:\s*)var\(--color-[a-z0-9-]+-\d+\)\s*;/gi,
          `$1var(${chosenVar});`
        );

        // Si la déclaration --primary existe mais vide (cas de template), la remplir
        state.tokensContent = state.tokensContent.replace(
          /(--primary\s*:\s*)(;)/gi,
          `$1var(${chosenVar});`
        );
      } catch (e) {
        /* noop fallback */
      }
      // Remplacer aussi la ligne d'entête indiquant la couleur primaire
      // dans le bloc de commentaire initial (s'il existe) pour garder
      // `state.tokensContent` cohérent avec l'UI.
      try {
        state.tokensContent = state.tokensContent.replace(
          /(\* - Couleur primaire\s*:\s*)([^\r\n]*)/i,
          `$1 ${chosen}`
        );
      } catch (e) {
        console.warn(
          "[app-init] Impossible de remplacer la ligne d'entête Couleur primaire:",
          e
        );
      }
    }
  } catch (e) {
    console.warn("[app-init] Impossible de synchroniser tokensContent:", e);
  }

  // Synchroniser la sélection de police de l'UI avec les primitives
  // du thème afin que la prévisualisation et les fichiers exportés
  // reflètent la police choisie (ex: Poppins).
  try {
    const fontChoice = state.config && state.config.fontFamily;
    if (fontChoice) {
      // Remplacer --font-base et --font-mono dans state.themeContent
      let theme = state.themeContent || "";
      if (fontChoice === "poppins") {
        // valeur sémantique pour Poppins
        const poppinsBase = "Poppins, sans-serif";
        const poppinsMono = "ui-monospace, monospace";
        if (/--font-base\s*:/i.test(theme)) {
          theme = theme.replace(
            /(--font-base\s*:\s*)([^;]+);/i,
            `$1 ${poppinsBase};`
          );
        } else {
          // injecter dans :root si absent
          theme = theme.replace(
            /:root\s*\{/,
            ":root {\n  --font-base: " + poppinsBase + ";"
          );
        }
        if (/--font-mono\s*:/i.test(theme)) {
          theme = theme.replace(
            /(--font-mono\s*:\s*)([^;]+);/i,
            `$1 ${poppinsMono};`
          );
        } else {
          theme = theme.replace(
            /:root\s*\{/,
            ":root {\n  --font-mono: " + poppinsMono + ";"
          );
        }
        state.themeContent = theme;

        // Préparer stylesPoppinsContent si vide : inclure @font-face + styles système
        if (!state.stylesPoppinsContent || !state.stylesPoppinsContent.trim()) {
          const fontFace = `@font-face {\n  font-family: 'Poppins';\n  src: url('assets/fonts/Poppins-Variable-opti.woff2') format('woff2');\n  font-weight: 100 900;\n  font-style: normal;\n  font-display: swap;\n}\n\n`;
          state.stylesPoppinsContent =
            fontFace + (state.stylesSystemContent || "");
        }
      } else {
        // user selected system -> restore canonical primitives if available
        const systemBase = "system-ui, sans-serif";
        const systemMono = "ui-monospace, monospace";
        if (/--font-base\s*:/i.test(theme)) {
          theme = theme.replace(
            /(--font-base\s*:\s*)([^;]+);/i,
            `$1 ${systemBase};`
          );
        }
        if (/--font-mono\s*:/i.test(theme)) {
          theme = theme.replace(
            /(--font-mono\s*:\s*)([^;]+);/i,
            `$1 ${systemMono};`
          );
        }
        state.themeContent = theme;
      }
    }
  } catch (e) {
    console.warn(
      "[app-init] Impossible de synchroniser la sélection de police:",
      e
    );
  }

  // Si on est en mode debug (ex: ?debug=state), appliquer le thème complet
  // au document pour faciliter le debug visuel local (ne s'active que via URL)
  try {
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("debug=state")
    ) {
      applyThemeToDocument();
      // Appliquer aussi les tokens sémantiques (primary, surface, etc.)
      try {
        applyTokensToDocument();
      } catch (e) {
        /* noop */
      }
    }
  } catch (e) {
    /* noop */
  }

  // Mettre à jour l'interface et l'aperçu
  updateUI();
  try {
    updateThemePreview();
  } catch (e) {
    console.warn("[app-init] updateThemePreview failed:", e);
  }
}

/* --- Fonctions UI extraites (mini) --- */
export function updateThemePreview() {
  const { customVars } = state.config;
  let preview = state.themeContent;

  if (RUNTIME_ONLY_COLORS.size > 0) {
    const names = Array.from(RUNTIME_ONLY_COLORS).join("|");
    const rx = new RegExp(`\\n?\\s*--color-(?:${names})-[^;]+;?`, "g");
    preview = preview.replace(rx, "");
    const importRx = new RegExp(
      `@import\\s+[\"']?[^\"';]*palettes\\/(?:${names})\\.css[\"']?;?`,
      "g"
    );
    preview = preview.replace(importRx, "");
    preview = preview.replace(/\n{3,}/g, "\n\n");
  }
  // NOTE: injection du placeholder 'raspberry' désactivée.
  // L'application ne doit pas ajouter automatiquement une couleur
  // projet d'exemple dans la prévisualisation afin d'éviter que
  // l'UI affiche une couleur qui n'existe pas dans le thème.
  // Si besoin, la logique d'injection peut être réactivée plus tard.

  if (customVars.trim()) {
    const lastBraceIndex = preview.lastIndexOf("}");
    if (lastBraceIndex !== -1) {
      const indentedCustomVars = customVars
        .trim()
        .split(/\r?\n/)
        .map((line) => `  ${line.trim()}`)
        .filter((line) => line.trim().length > 2)
        .join("\n");
      const customSection = `\n  /* Couleurs projet personnalisées */\n${indentedCustomVars}\n`;
      preview =
        preview.slice(0, lastBraceIndex) +
        customSection +
        preview.slice(lastBraceIndex);
    }
  }

  elements.themePreview.innerHTML = Prism.highlight(
    preview,
    Prism.languages.css,
    "css"
  );
}

export function applyCustomVarsToDocument() {
  const custom = state.config.customVars || "";
  const varsMap = parseColorVariants(custom);
  const newKeys = new Set();
  varsMap.forEach((variants, colorName) => {
    variants.forEach((value, variant) => {
      const key = `--color-${colorName}-${variant}`;
      newKeys.add(key);
      try {
        document.documentElement.style.setProperty(key, value);
      } catch (e) {
        console.warn(`Impossible d'appliquer ${key}: ${value}`, e);
      }
    });
  });

  state.appliedCustomVars.forEach((existingKey) => {
    if (!newKeys.has(existingKey)) {
      document.documentElement.style.removeProperty(existingKey);
    }
  });

  state.appliedCustomVars = newKeys;
}

/**
 * Applique l'ensemble des variables primitives présentes dans `state.themeContent`
 * sur `document.documentElement` afin d'activer un aperçu visuel réel.
 * Ceci est volontairement explicite et n'est activé automatiquement que
 * via le flag `?debug=state` pour éviter d'impacter l'UI normale.
 */
export function applyThemeToDocument() {
  try {
    const css = state.themeContent || "";
    if (!css.trim()) return;

    // Supprimer les imports de palettes runtime-only
    const cleaned = css.replace(/^.*palettes\/[\w-]+\.css.*$\n?/gim, "");

    const variantsMap = parseColorVariants(cleaned);
    variantsMap.forEach((variants, colorName) => {
      // Ignore runtime-only palettes
      if (RUNTIME_ONLY_COLORS.has(colorName)) return;
      variants.forEach((value, variant) => {
        const key = `--color-${colorName}-${variant}`;
        try {
          document.documentElement.style.setProperty(key, value);
        } catch (e) {
          console.warn(`Impossible d'appliquer ${key}: ${value}`, e);
        }
      });
    });
  } catch (e) {
    console.error("applyThemeToDocument failed:", e);
  }
}

/**
 * Applique les variables sémantiques générées (theme-tokens) au document.
 * Utilise `state.tokensContent` si présent, sinon génère via
 * `generateTokensCSS()` pour reproduire l'aperçu exact.
 */
export function applyTokensToDocument() {
  try {
    let css = (state && state.tokensContent) || "";
    if (!css.trim()) {
      // Générer à la volée si aucun contenu client-side fourni
      try {
        css = generateTokensCSS();
      } catch (e) {
        css = "";
      }
    }
    if (!css.trim()) return;

    // Extraire toutes les déclarations de variables simples (--name: value;)
    const rx = /--([a-z0-9-_]+)\s*:\s*([^;]+);/gim;
    let m;
    let applied = 0;
    while ((m = rx.exec(css))) {
      const name = m[1];
      const value = m[2].trim();
      try {
        document.documentElement.style.setProperty(`--${name}`, value);
        applied++;
      } catch (e) {
        console.warn(`Impossible d'appliquer --${name}: ${value}`, e);
      }
    }
    if (typeof console !== "undefined" && console.info) {
      console.info(`DEBUG: applied ${applied} token variables to :root`);
    }
  } catch (e) {
    console.error("applyTokensToDocument failed:", e);
  }
}

export function updateColorChoices() {
  const colorChoicesContainer = document.querySelector(".color-choices");

  const combined = state.themeContent + "\n" + state.config.customVars;
  const colorsMap = parseColorVariants(combined);

  // Extraire les couleurs depuis le combined (themeContent + customVars)
  // pour inclure les couleurs importées depuis Figma
  const customColors = parseColorVariables(combined);

  // Construire la liste des couleurs disponibles depuis le thème et
  // depuis les variables personnalisées. Ne pas proposer de placeholder
  // factice qui n'existe pas dans les primitives.
  let allColors = [];
  if (customColors.length > 0) {
    allColors = customColors.slice();
  } else {
    const detected = Array.from(colorsMap.keys());
    if (detected.length > 0) allColors = detected;
  }
  if (allColors.length === 0) {
    allColors = ["info", "blue", "green", "orange", "purple", "red", "yellow"];
  }

  const swatchMarkup = (color) => {
    const variantsOrder = ["100", "300", "500", "700"];
    let variantsAvailable = variantsOrder.filter((v) =>
      colorsMap.has(color) ? colorsMap.get(color).has(v) : false
    );
    if (variantsAvailable.length === 0) {
      if (colorsMap.has(color)) {
        const keys = Array.from(colorsMap.get(color).keys());
        if (keys.length > 0) variantsAvailable.push(keys[0]);
        else variantsAvailable.push("500");
      } else {
        variantsAvailable.push("500");
      }
    }

    const getVariantValue = (c, v) => `var(--color-${c}-${v})`;

    if (variantsAvailable.length > 1) {
      const segments = variantsAvailable
        .map(
          (v) =>
            `<span class="swatch-seg" style="background: ${getVariantValue(
              color,
              v
            )};" aria-hidden="true"></span>`
        )
        .join("");
      return `<span class="color-swatch multi" aria-hidden="true">${segments}</span>`;
    }

    const singleVal = getVariantValue(color, variantsAvailable[0]);
    return `<span class="color-swatch" style="background: ${singleVal};" aria-hidden="true"></span>`;
  };

  colorChoicesContainer.innerHTML = allColors
    .map((color, index) => {
      const isChecked =
        color === state.config.primaryColor ||
        (index === 0 && !state.config.primaryColor);
      return `\n      <label class="color-choice">\n        <input type="radio" name="primary-color" value="${color}" ${
        isChecked ? "checked" : ""
      } />\n        ${swatchMarkup(color)}\n        <span class="color-name">${
        color.charAt(0).toUpperCase() + color.slice(1)
      }</span>\n      </label>\n    `;
    })
    .join("");

  colorChoicesContainer
    .querySelectorAll('input[name="primary-color"]')
    .forEach((input) => {
      input.addEventListener("change", (e) => {
        state.config.primaryColor = e.target.value;
        // Si des tokens client-side existent, ne pas les vider (perte d'information)
        // mais synchroniser la déclaration `--primary` et la ligne d'entête
        // pour conserver la cohérence entre l'UI (étape 2) et les tokens (étape 3).
        try {
          if (state.tokensContent) {
            const chosen = state.config.primaryColor;
            // Remplacer toute declaration --primary: ...; par la nouvelle valeur
            try {
              const sources =
                (state.themeContent || "") +
                "\n" +
                (state.tokensContent || "") +
                "\n" +
                (state.config && state.config.customVars
                  ? state.config.customVars
                  : "");
              const chosenVar = chooseBestVariant(chosen, sources);
              state.tokensContent = state.tokensContent.replace(
                /--primary\s*:\s*[^;]*;/gi,
                `--primary: var(${chosenVar});`
              );
              // Remplir un placeholder éventuel
              state.tokensContent = state.tokensContent.replace(
                /(--primary\s*:\s*)(;)/gi,
                `$1var(${chosenVar});`
              );
            } catch (err) {
              console.warn(
                "[updateColorChoices] chooseBestVariant failed:",
                err
              );
            }
            // Mettre à jour la ligne d'entête indiquant la couleur primaire
            try {
              state.tokensContent = state.tokensContent.replace(
                /(\* - Couleur primaire\s*:\s*)([^\r\n]*)/i,
                `$1 ${chosen}`
              );
            } catch (err) {
              console.warn(
                "[updateColorChoices] Impossible de mettre à jour la ligne d'entête:",
                err
              );
            }
          }
        } catch (e) {
          console.warn(
            "[updateColorChoices] Synchronisation tokensContent failed:",
            e
          );
        }
      });
    });

  // Synchroniser state.config.primaryColor avec l'input checked par défaut
  const checkedInput = colorChoicesContainer.querySelector(
    'input[name="primary-color"]:checked'
  );
  if (checkedInput) {
    state.config.primaryColor = checkedInput.value;
  } else {
    console.warn("[updateColorChoices] No checked input found!");
  }
}

export function updateUI() {
  elements.steps.forEach((step, index) => {
    step.classList.toggle("is-active", index + 1 === state.currentStep);
  });
  elements.stepButtons.forEach((button, index) => {
    const stepNumber = index + 1;
    const isActive = stepNumber === state.currentStep;
    if (isActive) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  elements.sections.forEach((section, index) => {
    const isVisible = index + 1 === state.currentStep;
    section.classList.toggle("is-visible", isVisible);
    section.hidden = !isVisible;
  });
  elements.btnPrev.disabled = state.currentStep === 1;
  elements.btnNext.style.display =
    state.currentStep === 3 ? "none" : "inline-flex";
  const currentSection = elements.sections[state.currentStep - 1];
  const title = currentSection && currentSection.querySelector(".step-title");
  if (title) title.focus();
}

// API progressive
window.setupEventListenersFromModules = function () {
  if (typeof __modulesSetupEventListeners === "function") {
    __modulesSetupEventListeners();
  }
};

window.applyCustomVarsFromModules = function (value) {
  state.config.customVars = value;
  const validation = validateCustomVars(value);
  if (validation !== true) {
    showGlobalError(`Variables personnalisées : ${validation}`);
  } else {
    hideGlobalError();
  }
  applyCustomVarsToDocument();
  updateThemePreview();
  updateColorChoices();
};
