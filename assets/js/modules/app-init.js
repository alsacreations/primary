import { state, PLACEHOLDER_RASPBERRY, RUNTIME_ONLY_COLORS } from "./state.js";
import { setupEventListeners as __modulesSetupEventListeners } from "./events.js";
import {
  parseColorVariants,
  parseColorVariables,
  generateMissingVariants,
} from "./generators.js";

// Exposer les éléments DOM et fonctions UI minimalistes qui étaient dans app.js
export const elements = {
  steps: document.querySelectorAll(".step"),
  stepButtons: document.querySelectorAll(".step-button"),
  sections: document.querySelectorAll(".step-section"),
  btnPrev: document.getElementById("btn-prev"),
  btnNext: document.getElementById("btn-next"),
  btnCopyApp: document.getElementById("btn-copy-app"),
  btnCopyReset: document.getElementById("btn-copy-reset"),
  btnCopyLayouts: document.getElementById("btn-copy-layouts"),
  btnCopyNatives: document.getElementById("btn-copy-natives"),
  btnCopyTheme: document.getElementById("btn-copy-theme"),
  btnCopyTokens: document.getElementById("btn-copy-tokens"),
  btnCopyStyles: document.getElementById("btn-copy-styles"),
  btnDownloadAll: document.getElementById("btn-download-all"),
  themePreview: document.getElementById("theme-preview"),
  customVarsInput: document.getElementById("custom-vars-input"),
  generatedApp: document.getElementById("generated-app"),
  generatedReset: document.getElementById("generated-reset"),
  generatedLayouts: document.getElementById("generated-layouts"),
  generatedNatives: document.getElementById("generated-natives"),
  generatedTheme: document.getElementById("generated-theme"),
  generatedTokens: document.getElementById("generated-tokens"),
  generatedStyles: document.getElementById("generated-styles"),
  globalError: document.getElementById("global-error"),
};

export function showGlobalError(message) {
  elements.globalError.textContent = message;
  elements.globalError.hidden = false;
}

export function hideGlobalError() {
  elements.globalError.hidden = true;
  elements.globalError.textContent = "";
}

export function validateCustomVars(css) {
  if (!css.trim()) return true; // Vide est OK

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

  const hasCustom = customVars.trim().length > 0;
  if (!hasCustom) {
    const hasRasp = /--color-raspberry-/.test(state.themeContent);
    if (!hasRasp) {
      const raspLines = Object.entries(PLACEHOLDER_RASPBERRY)
        .map(([variant, value]) => `  --color-raspberry-${variant}: ${value};`)
        .join("\n");
      const raspBlock = `\n  /* Couleur projet placeholder : raspberry */\n${raspLines}\n`;
      const lastBrace = preview.lastIndexOf("}");
      if (lastBrace !== -1) {
        preview =
          preview.slice(0, lastBrace) + raspBlock + preview.slice(lastBrace);
      } else {
        preview += raspBlock;
      }
    }
  }

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

export function updateColorChoices() {
  const customColors = parseColorVariables(state.config.customVars);
  const colorChoicesContainer = document.querySelector(".color-choices");

  const combined = state.themeContent + "\n" + state.config.customVars;
  const colorsMap = parseColorVariants(combined);

  const allColors = customColors.length > 0 ? [...customColors] : ["raspberry"];

  if (customColors.length > 0 && state.config.primaryColor === "raspberry") {
    state.config.primaryColor = customColors[0];
  }

  const swatchMarkup = (color) => {
    const variantsOrder = ["100", "300", "500", "700"];
    let variantsAvailable = [];
    if (color === "raspberry" && !colorsMap.has("raspberry")) {
      variantsAvailable = variantsOrder.filter(
        (v) => typeof PLACEHOLDER_RASPBERRY[v] !== "undefined"
      );
    } else {
      variantsAvailable = variantsOrder.filter((v) =>
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
    }

    const getVariantValue = (c, v) => {
      if (c === "raspberry" && PLACEHOLDER_RASPBERRY[v]) {
        return PLACEHOLDER_RASPBERRY[v];
      }
      return `var(--color-${c}-${v})`;
    };

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
      });
    });
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
