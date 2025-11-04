/**
 * Module événements - Primary CSS Generator
 * Gestion des événements utilisateur
 */

import { state } from "./state.js";
import fgClient from "./figma-client-gen.js";
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
import { applyThemeToDocument, applyTokensToDocument } from "./app-init.js";
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
  // Handlers d'import JSON (étape Sources)
  attachJsonImportHandlers();
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
  // Délègue la gestion du mode thème et des options responsive
  attachThemeModeHandlers();
  attachResponsiveHandlers();
  // Délègue la gestion du format de génération (static | wordpress)
  attachTechnologyHandlers();

  elements.fontFamilyInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      state.config.fontFamily = e.target.value;
    });
  });
  // Attach the custom variables handler if the input exists
  if (elements.customVarsInput) attachCustomVarsHandler();
  // Attach synthesis checkbox handler (option explicite pour l'utilisateur)
  attachSynthesisCheckboxHandler();
}

function attachSynthesisCheckboxHandler() {
  const cb = elements.synthesizeProjectColorsCheckbox;
  if (!cb) return;
  // Initialize config value from the checkbox state
  try {
    state.config.synthesizeProjectPrimitives = Boolean(cb.checked);
  } catch (e) {
    /* noop */
  }
  cb.addEventListener("change", (e) => {
    state.config.synthesizeProjectPrimitives = Boolean(e.target.checked);
    // if on generation step, refresh generated files
    if (state.currentStep === 3) generateAllFiles();
  });
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
  // Supporte à la fois l'ancien <select> et le nouveau conteneur .color-choices
  if (elements.primaryColorSelect.tagName === "SELECT") {
    elements.primaryColorSelect.addEventListener("change", (e) => {
      state.config.primaryColor = e.target.value;
      try {
        refreshColorSelection();
      } catch (err) {
        // noop (aucune action requise)
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
          // noop (aucune action requise)
        }
        try {
          syncConfigFromDOM();
        } catch (err) {
          // noop (aucune action requise)
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
          // noop (aucune action requise)
        }
        if (state.currentStep === 3) generateAllFiles();
      }
    });
  }
}

function attachThemeModeHandlers() {
  // Theme mode radios (light / dark / both)
  if (elements.themeModeInputs && elements.themeModeInputs.length) {
    elements.themeModeInputs.forEach((input) => {
      input.addEventListener("change", (e) => {
        state.config.themeMode = e.target.value;
        if (state.currentStep === 3) generateAllFiles();
      });
    });
  }
}

function attachTechnologyHandlers() {
  if (elements.technologyInputs && elements.technologyInputs.length) {
    elements.technologyInputs.forEach((input) => {
      input.addEventListener("change", (e) => {
        state.config.technology = e.target.value;
        // If already on generation step, refresh generated files
        if (state.currentStep === 3) generateAllFiles();
      });
    });
  }
}

function attachResponsiveHandlers() {
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
}

/**
 * Construits un bloc CSS `:root { ... }` à partir d'une collection
 * de paires { name, value } normalisées. Regroupe par type et trie
 * numériquement quand des suffixes numériques sont présents.
 */
function buildCssFromVars(vars) {
  if (!vars || !vars.length) return "";

  const normalized = vars.map(({ name, value }) => {
    const nm =
      name && name.startsWith("--")
        ? name
        : `--${String(name || "").replace(/\s+/g, "-")}`;
    return { name: nm, value };
  });

  const groups = {
    colors: [],
    spacing: [],
    radius: [],
    text: [],
    lineHeight: [],
    font: [],
    other: [],
  };

  const numericSuffix = (s) => {
    const m = String(s).match(/-(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  };

  for (const v of normalized) {
    const n = v.name;
    if (/^--color-/.test(n)) groups.colors.push(v);
    else if (/--spacing-|^--gap-/.test(n)) groups.spacing.push(v);
    else if (/--radius-|--rounded-/.test(n)) groups.radius.push(v);
    else if (/--text-|--font-size-/.test(n)) groups.text.push(v);
    else if (/--line-height-/.test(n)) groups.lineHeight.push(v);
    else if (/--font-/.test(n) || /font-family/.test(n)) groups.font.push(v);
    else groups.other.push(v);
  }

  const sortFn = (a, b) => {
    const an = numericSuffix(a.name);
    const bn = numericSuffix(b.name);
    if (an !== null && bn !== null) return an - bn;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  };

  Object.values(groups).forEach((arr) => arr.sort(sortFn));

  const lines = [":root {"];
  const emit = (title, items) => {
    if (!items || !items.length) return;
    lines.push(`  /* ${title} */`);
    for (const it of items) lines.push(`  ${it.name}: ${it.value};`);
    lines.push("");
  };

  emit("Couleurs", groups.colors);
  emit("Espacements", groups.spacing);
  emit("Border radius", groups.radius);
  emit("Tailles de police", groups.text);
  emit("Hauteurs de ligne", groups.lineHeight);
  emit("Fonts", groups.font);
  emit("Autres variables", groups.other);

  lines.push("}");
  return lines.join("\n");
}

/**
 * Finalise le CSS généré par le client :
 * - optionnellement synthétise des primitives projet (si activée)
 * - ajoute un bloc distinct pour les variables personnalisées utilisateur
 * Cette fonction évite tout conflit entre valeurs synthétisées et valeurs
 * explicitement fournies par l'utilisateur.
 */
function finalizeGeneratedTheme(
  generated,
  primitives = { variables: [] },
  tokenColors = { variables: [] }
) {
  if (!generated) return String(generated || "");

  try {
    // collect user-provided variable names (if any)
    const userText = String((state.config && state.config.customVars) || "");
    const userNames = new Set(
      [...userText.matchAll(/--[A-Za-z0-9_-]+/g)].map((m) =>
        sanitizeVarName(m[0])
      )
    );

    const allowSynthesis = Boolean(
      state.config && state.config.synthesizeProjectPrimitives
    );

    if (allowSynthesis) {
      const rxColor = /--color-[a-z0-9-]+-\d+\s*:/gi;
      const genColors = new Set(
        (generated.match(rxColor) || []).map((s) =>
          s.replace(/\s*:.*/, "").trim()
        )
      );

      const importedMap = new Map();
      for (const pv of primitives.variables || []) {
        const nm = sanitizeVarName(pv.name || "");
        importedMap.set(nm, pv);
      }
      for (const tv of tokenColors.variables || []) {
        const modes = tv.resolvedValuesByMode || {};
        for (const mk of Object.keys(modes || {})) {
          const entry = modes[mk] || {};
          if (entry && entry.aliasName)
            importedMap.set(sanitizeVarName(entry.aliasName), entry);
        }
      }

      const missing = [];
      for (const [name] of importedMap) {
        if (!genColors.has(name) && !userNames.has(name)) missing.push(name);
      }

      if (missing.length) {
        const insertLines = [];
        for (const m of missing) {
          const pv = importedMap.get(m);
          if (!pv) continue;
          try {
            const smallOut = fgClient.generateCanonicalThemeFromFigma({
              primitives: { variables: [pv] },
              synthesizeProjectPrimitives: false,
              customColors: state.config.customVars || "",
            });
            const smallCss = smallOut.themeCss || "";
            const rxLine = new RegExp(`^\\s*${m}\\s*:\\s*(.*);?$`, "m");
            const mm = smallCss.match(rxLine);
            if (mm) {
              const val = String(mm[1] || "").replace(/;\s*$/, "");
              insertLines.push(`  ${m}: ${val};`);
            }
          } catch (err) {
            /* noop */
          }
        }
        if (insertLines.length) {
          const lastBrace = generated.lastIndexOf("}");
          if (lastBrace !== -1) {
            generated =
              generated.slice(0, lastBrace) +
              "\n\n  /* Couleurs personnalisées (projet - synthèse) */\n" +
              insertLines.join("\n") +
              "\n" +
              generated.slice(lastBrace);
          } else {
            generated +=
              "\n\n  /* Couleurs personnalisées (projet - synthèse) */\n" +
              insertLines.join("\n") +
              "\n";
          }
        }
      }
    }
  } catch (e) {
    /* noop */
  }

  // Append user-provided custom vars so they override synthesized ones
  try {
    const userText = String(
      (state.config && state.config.customVars) || ""
    ).trim();
    if (userText) {
      const lastBrace = generated.lastIndexOf("}");
      const block =
        "\n\n  /* Couleurs personnalisées (utilisateur) */\n" +
        userText
          .split(/\r?\n/)
          .map((l) => (l.trim() ? `  ${l.trim()}` : ""))
          .filter(Boolean)
          .join("\n") +
        "\n";
      if (lastBrace !== -1)
        generated =
          generated.slice(0, lastBrace) + block + generated.slice(lastBrace);
      else generated += block;
    }
  } catch (e) {
    /* noop */
  }

  return String(generated || "");
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
  // Copy theme.json if present
  if (elements.btnCopyThemeJson && elements.generatedThemeJson) {
    elements.btnCopyThemeJson.addEventListener("click", () =>
      copyToClipboard(elements.generatedThemeJson)
    );
  }
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

function attachJsonImportHandlers() {
  if (!elements.jsonImportFile) return;

  const setStatus = (msg, isError = false) => {
    if (elements.jsonImportStatus) {
      elements.jsonImportStatus.textContent = msg || "";
      elements.jsonImportStatus.style.color = isError ? "#b00020" : "";
    }
  };

  // Helper: heuristically determine if a resolved value looks like a color.
  const looksLikeColor = (rv) => {
    if (!rv) return false;
    const candidate = rv.resolvedValue ?? rv.value ?? rv;
    if (!candidate) return false;
    if (typeof candidate === "object") {
      // Figma resolved color objects often have r,g,b (0..1) or r,g,b (0..255)
      if (
        ("r" in candidate && "g" in candidate && "b" in candidate) ||
        ("red" in candidate && "green" in candidate && "blue" in candidate)
      )
        return true;
      return false;
    }
    if (typeof candidate === "string") {
      return /^(#|rgb|hsl|oklch|oklab)/i.test(String(candidate).trim());
    }
    return false;
  };

  // multi-file input
  if (elements.jsonImportFile) {
    elements.jsonImportFile.addEventListener("change", async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const collected = [];
      const rawParsed = [];

      for (const f of files) {
        try {
          const txt = await f.text();
          const parsed = JSON.parse(txt);

          if (
            parsed &&
            Array.isArray(parsed.variables) &&
            parsed.variables.length
          ) {
            // Keep raw parsed object for better canonical generation
            // Attach filename as hint for classification
            rawParsed.push({ ...parsed, __fileName: f.name });
          } else {
            const vars = collectVarsFromJson(parsed);
            if (vars && vars.length) collected.push(...vars);
          }
        } catch (err) {
          console.error(`Échec parsing ${f.name}:`, err);
          setStatus(`Erreur parsing ${f.name} — ignoré.`, true);
        }
      }
      // If we collected raw Figma-style parsed files, attempt canonical generation
      if (rawParsed.length) {
        // Merge variables into primitive/fonts/tokenColors buckets
        const primitives = { variables: [] };
        const fonts = { variables: [] };
        const tokenColors = { variables: [], modes: {} };

        for (const p of rawParsed) {
          // merge modes if present
          if (p.modes)
            Object.assign(
              tokenColors.modes || (tokenColors.modes = {}),
              p.modes
            );
          // Extract filename hint for classification
          const fileName = (p.__fileName || "").toLowerCase();
          const isColorFile = fileName.includes("color");
          const isFontFile = fileName.includes("font");

          for (const v of p.variables || []) {
            // heuristics to classify — prefer explicit COLOR/type first,
            // then inspect per-mode resolved values to decide if the entry
            // is a color primitive or a semantic token (tokenColors).
            const nm = String(v.name || "").toLowerCase();

            // CORRECTION : Les COLOR avec aliases → tokenColors (tokens sémantiques)
            // Les COLOR sans aliases → primitives (couleurs brutes)
            // HINT : Fichier avec "color" dans le nom → priorité tokenColors si aliases
            if (v.type === "COLOR") {
              // Vérifier si c'est un token sémantique (avec aliases)
              const hasAliases =
                v.resolvedValuesByMode &&
                Object.values(v.resolvedValuesByMode).some(
                  (rv) => rv && rv.aliasName
                );

              if (hasAliases || isColorFile) {
                // Token sémantique (ex: accent-pink → color/pink/700)
                // OU fichier explicitement nommé avec "color"
                tokenColors.variables.push(v);
              } else {
                // Primitive brute (ex: color/raspberry/500: oklch(...))
                primitives.variables.push(v);
              }
              continue;
            }

            // Primitives nommées "color/xxx" (fallback)
            if (nm.startsWith("color/")) {
              primitives.variables.push(v);
              continue;
            }

            if (v.resolvedValuesByMode) {
              const vals = Object.values(v.resolvedValuesByMode || {});
              // If any resolved value looks like a concrete color, treat as primitive
              if (vals.some((rv) => looksLikeColor(rv))) {
                primitives.variables.push(v);
                continue;
              }
              // If it contains aliases or object-like resolved values (non-color),
              // treat as tokenColors (semantic tokens)
              if (
                vals.some(
                  (rv) =>
                    rv &&
                    (rv.aliasName ||
                      (rv.resolvedValue &&
                        typeof rv.resolvedValue === "object"))
                )
              ) {
                tokenColors.variables.push(v);
                continue;
              }
            }

            // HINT : Fichier avec "font" dans le nom → forcer vers fonts
            if (
              isFontFile ||
              nm.includes("font") ||
              nm.includes("text") ||
              nm.includes("fontsize") ||
              nm.includes("lineheight") ||
              v.type === "FONT"
            ) {
              fonts.variables.push(v);
            } else {
              // default to primitives for unknown numeric/color types
              primitives.variables.push(v);
            }
          }
        }

        try {
          // Snapshot args for post-mortem inspection in the browser.
          try {
            if (typeof window !== "undefined" && window.__PRIMARY_STATE) {
              window.__PRIMARY_STATE._lastGenerateArgs = {
                primitives: (primitives && primitives.variables) || [],
                tokenColors: (tokenColors && tokenColors.variables) || [],
                fonts: (fonts && fonts.variables) || [],
                ts: Date.now(),
              };
            }
          } catch (e) {
            /* noop */
          }

          const out = fgClient.generateCanonicalThemeFromFigma({
            primitives,
            fonts,
            tokenColors,
            // Project primitives must always be generated.
            synthesizeProjectPrimitives: true,
            customColors: state.config.customVars || "",
            themeMode: state.config.themeMode || "both",
          });
          // Même si out.themeCss est absent, considérer que l'origine
          // est un import utilisateur : cela évite que l'UI réinjecte des placeholders.
          state.themeFromImport = true;
          if (out && out.themeCss) {
            // Defensive merge: ensure project color primitives from the
            // original theme are present in the client-generated theme.
            // NOTE: project synthesis must not conflict with user custom vars.
            let generated = out.themeCss;
            try {
              generated = finalizeGeneratedTheme(
                generated,
                primitives,
                tokenColors
              );
            } catch (e) {
              /* noop */
            }
            state.themeContent = String(generated || "");
          }
          if (out && out.tokensCss) state.tokensContent = out.tokensCss;
          updateThemePreview();
          updateColorChoices();
          // Re-générer les fichiers (tokens) maintenant que themeContent est finalisé
          try {
            generateAllFiles();
          } catch (e) {
            /* noop */
          }
          setStatus(`Import réussi — ${files.length} fichier(s) traité(s).`);
          return;
        } catch (err) {
          console.error("Erreur génération canonique client:", err);
          // fallback to previous collected behavior
        }
      }

      if (!collected.length) {
        setStatus("Aucune variable détectée dans les fichiers importés.", true);
        return;
      }

      const css = buildCssFromVars(collected);
      if (!css || !css.trim()) {
        setStatus(
          "Aucune variable générée à partir des fichiers importés.",
          true
        );
        return;
      }

      state.themeContent = String(css || "");
      // provient d'un import utilisateur
      state.themeFromImport = true;
      // clear any previous tokens override
      state.tokensContent = "";
      updateThemePreview();
      updateColorChoices();
      try {
        generateAllFiles();
      } catch (e) {
        /* noop */
      }
      setStatus(`Import réussi — ${files.length} fichier(s) traité(s).`);
    });
  }

  // Note: paste import and clear buttons removed from UI; file input handler remains
}
