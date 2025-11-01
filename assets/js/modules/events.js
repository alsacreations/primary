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
  if (!elements.jsonImportFile && !elements.jsonImportPaste) return;

  const setStatus = (msg, isError = false) => {
    if (elements.jsonImportStatus) {
      elements.jsonImportStatus.textContent = msg || "";
      elements.jsonImportStatus.style.color = isError ? "#b00020" : "";
    }
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
            rawParsed.push(parsed);
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
          for (const v of p.variables || []) {
            // heuristics to classify — prefer tokenColors when the entry has
            // resolved values per mode or aliases, otherwise fallback to
            // primitives/fonts based on type/name.
            const nm = String(v.name || "").toLowerCase();
            if (
              v.resolvedValuesByMode &&
              Object.values(v.resolvedValuesByMode).some(
                (rv) =>
                  rv && (typeof rv.resolvedValue === "object" || rv.aliasName)
              )
            ) {
              tokenColors.variables.push(v);
            } else if (v.type === "COLOR" || nm.startsWith("color/")) {
              primitives.variables.push(v);
            } else if (
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
          const out = fgClient.generateCanonicalThemeFromFigma({
            primitives,
            fonts,
            tokenColors,
          });
          // Même si out.themeCss est absent, considérer que l'origine
          // est un import utilisateur : cela évite que l'UI réinjecte des placeholders.
          state.themeFromImport = true;
          if (out && out.themeCss) {
            // Defensive merge: ensure project color primitives from the
            // original theme are present in the client-generated theme.
            let generated = out.themeCss;
              try {
                const rxColor = /--color-[a-z0-9-]+-\d+\s*:/gi;
                const genColors = new Set(
                  (generated.match(rxColor) || []).map((s) =>
                    s.replace(/\s*:.*/, "").trim()
                  )
                );

                // Build a map of primitives actually present in the imported files
                // so we don't copy unrelated variables from the committed theme.
                const importedMap = new Map();
                for (const pv of primitives.variables || []) {
                  const nm = sanitizeVarName(pv.name || "");
                  importedMap.set(nm, pv);
                }
                for (const tv of tokenColors.variables || []) {
                  const modes = tv.resolvedValuesByMode || {};
                  for (const mk of Object.keys(modes || {})) {
                    const entry = modes[mk] || {};
                    if (entry && entry.aliasName) {
                      importedMap.set(sanitizeVarName(entry.aliasName), entry);
                    }
                  }
                }

                const missing = [];
                for (const [name] of importedMap) {
                  if (!genColors.has(name)) missing.push(name);
                }

                if (missing.length) {
                  const insertLines = [];
                  for (const m of missing) {
                    const pv = importedMap.get(m);
                    if (!pv) continue;
                    try {
                      // Synthesize the primitive using the client generator on
                      // the single variable so the conversion to OKLCH is
                      // consistent with the main generator.
                      const smallOut = fgClient.generateCanonicalThemeFromFigma({
                        primitives: { variables: [pv] },
                      });
                      const smallCss = smallOut.themeCss || "";
                      const rxLine = new RegExp(`^\\s*${m}\\s*:\\s*(.*);?$`, "m");
                      const mm = smallCss.match(rxLine);
                      if (mm) {
                        const val = String(mm[1] || "").replace(/;\s*$/, "");
                        insertLines.push(`  ${m}: ${val};`);
                      }
                    } catch (err) {
                      // skip if we can't synthesize this primitive
                    }
                  }
                  if (insertLines.length) {
                    const lastBrace = generated.lastIndexOf("}");
                    if (lastBrace !== -1) {
                      generated =
                        generated.slice(0, lastBrace) +
                        "\n\n  /* Couleurs personnalisées (import - fusion) */\n" +
                        insertLines.join("\n") +
                        "\n" +
                        generated.slice(lastBrace);
                    } else {
                      generated +=
                        "\n\n  /* Couleurs personnalisées (import - fusion) */\n" +
                        insertLines.join("\n") +
                        "\n";
                    }
                  }
                }
              } catch (e) {
                // noop - fall back to original generated content
              }
            state.themeContent = generated;
          }
          if (out && out.tokensCss) state.tokensContent = out.tokensCss;
          updateThemePreview();
          updateColorChoices();
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

      state.themeContent = css;
      // provient d'un import utilisateur
      state.themeFromImport = true;
      // clear any previous tokens override
      state.tokensContent = "";
      updateThemePreview();
      updateColorChoices();
      setStatus(`Import réussi — ${files.length} fichier(s) traité(s).`);
    });
  }

  // paste + button
  if (elements.btnImportJson) {
    elements.btnImportJson.addEventListener("click", () => {
      const txt = elements.jsonImportPaste
        ? elements.jsonImportPaste.value
        : "";
      if (!txt || !txt.trim()) {
        setStatus("Aucun contenu JSON fourni.", true);
        return;
      }
      try {
        const parsed = JSON.parse(txt);
        const collected = [];
        const rawParsed = [];
        if (
          parsed &&
          Array.isArray(parsed.variables) &&
          parsed.variables.length
        ) {
          rawParsed.push(parsed);
        } else {
          const vars = collectVarsFromJson(parsed);
          if (vars && vars.length) collected.push(...vars);
        }

        // If we have raw Figma parsed data, try client canonical generation
        if (rawParsed.length) {
          const primitives = { variables: [] };
          const fonts = { variables: [] };
          const tokenColors = { variables: [], modes: {} };
          for (const p of rawParsed) {
            if (p.modes)
              Object.assign(
                tokenColors.modes || (tokenColors.modes = {}),
                p.modes
              );
            for (const v of p.variables || []) {
              const nm = String(v.name || "").toLowerCase();
              // Prefer tokenColors classification when the variable has per-mode
              // resolved values or aliases (semantic tokens).
              if (
                v.resolvedValuesByMode &&
                Object.values(v.resolvedValuesByMode).some(
                  (rv) =>
                    rv && (typeof rv.resolvedValue === "object" || rv.aliasName)
                )
              ) {
                tokenColors.variables.push(v);
              } else if (v.type === "COLOR" || nm.startsWith("color/")) {
                primitives.variables.push(v);
              } else if (
                nm.includes("font") ||
                nm.includes("text") ||
                nm.includes("fontsize") ||
                nm.includes("lineheight") ||
                v.type === "FONT"
              ) {
                fonts.variables.push(v);
              } else {
                primitives.variables.push(v);
              }
            }
          }
          try {
            const out = fgClient.generateCanonicalThemeFromFigma({
              primitives,
              fonts,
              tokenColors,
            });
            if (out && out.themeCss) {
              state.themeContent = out.themeCss;
              state.themeFromImport = true;
            }
            if (out && out.tokensCss) state.tokensContent = out.tokensCss;
            updateThemePreview();
            updateColorChoices();
            setStatus("Import réussi — variables ajoutées.");
            return;
          } catch (err) {
            console.error("Erreur génération canonique client (paste):", err);
          }
        }

        if (!collected.length) {
          setStatus("Aucune variable détectée dans le JSON collé.", true);
          return;
        }

        const css = buildCssFromVars(collected);
        state.themeContent = css;
        state.tokensContent = "";
        state.themeFromImport = true;
        updateThemePreview();
        updateColorChoices();
        setStatus("Import réussi — variables ajoutées.");
      } catch (err) {
        console.error(err);
        setStatus("JSON invalide — vérifiez la syntaxe.", true);
      }
    });
  }

  if (elements.btnClearImport) {
    elements.btnClearImport.addEventListener("click", () => {
      if (elements.jsonImportPaste) elements.jsonImportPaste.value = "";
      if (elements.jsonImportFile) elements.jsonImportFile.value = "";
      if (elements.jsonImportStatus) elements.jsonImportStatus.textContent = "";
      // Restaurer le thème original si disponible
      try {
        if (state.originalThemeContent) {
          state.themeContent = state.originalThemeContent;
          state.themeFromImport = false;
          state.tokensContent = "";
          updateThemePreview();
          updateColorChoices();
        }
      } catch (e) {
        /* noop */
      }
    });
  }
}
