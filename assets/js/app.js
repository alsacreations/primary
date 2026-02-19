import { processFiles } from "./client-utils.mjs"
import {
  highlightCode,
  clearHighlightsForElement,
} from "./highlight-preview.mjs"

const dropzone = document.getElementById("dropzone")
const fileInput = document.getElementById("file-input")
const logOutput = document.getElementById("log-output")
const previewThemed = document.getElementById("preview-themecss")
const previewThemeJson = document.getElementById("preview-themejson")
// Note: generated files are shown inside the logs summary; the dedicated `generated-list` element was removed from the DOM
// Download/reset/apply buttons removed; copy buttons are provided on code previews.

let STYLES_CSS_CONTENT = ""
let UTILITIES_CSS_CONTENT = ""

/**
 * Fetch template files for styles.css and utilities.css
 */
async function initTemplates() {
  try {
    const [styles, utilities] = await Promise.all([
      fetchTextIfAvailable("assets/templates/styles.css"),
      fetchTextIfAvailable("assets/templates/utilities.css"),
    ])
    if (styles) STYLES_CSS_CONTENT = styles
    if (utilities) UTILITIES_CSS_CONTENT = utilities
  } catch (e) {
    console.warn("Could not load CSS templates from assets/templates/", e)
  }
}
// Initial fetching of templates
initTemplates()

const EXTRA_CSS_FILES = [
  {
    src: "https://reset.alsacreations.com/public/reset.css",
    name: "reset.css",
  },
  {
    src: "https://raw.githubusercontent.com/alsacreations/bretzel/refs/heads/main/public/layouts.css",
    name: "layouts.css",
  },
  { src: "https://knacss.com/css/natives.css", name: "natives.css" },
]
let extraFilesCache = {}

let lastArtifacts = null
let lastLogs = []
let lastFiles = null
let summaryBlobUrls = []
const resultsSection = document.querySelector(".results")

function setResultsVisible(visible) {
  if (!resultsSection) return
  if (visible) {
    resultsSection.classList.remove("is-empty")
    resultsSection.setAttribute("aria-hidden", "false")
  } else {
    resultsSection.classList.add("is-empty")
    resultsSection.setAttribute("aria-hidden", "true")
  }
}

// helper: show/enable or hide/disable the download kit controls
function updateDownloadControls(enabled) {
  const downloadBtn = document.getElementById("download-kit-btn")
  if (!downloadBtn) return
  const controls = downloadBtn.closest(".summary-controls")
  if (controls) {
    controls.classList.toggle("is-visible", !!enabled)
    controls.setAttribute("aria-hidden", !!enabled ? "false" : "true")
  }
  // If enabling, also ensure the summary section is visible so the button is seen
  if (enabled) {
    const summarySection = document.querySelector(".summary-logs")
    if (summarySection) {
      summarySection.classList.add("is-visible")
      summarySection.setAttribute("aria-hidden", "false")
    }
  }
  // enable button if enabled truthy OR there is content in the preview element
  const previewEl = document.getElementById("preview-themecss")
  const hasPreviewContent =
    previewEl && previewEl.textContent && previewEl.textContent.trim()
  downloadBtn.disabled = !(enabled || hasPreviewContent)
}

function log(...args) {
  const str = args.join(" ")
  logOutput.textContent += `\n${str}`
  logOutput.scrollTop = logOutput.scrollHeight
}

function resetUi() {
  // Keep logs empty by default; only show content when debug is enabled
  logOutput.textContent = ""
  // ensure logs panel is hidden
  document.querySelector(".logs")?.classList.remove("is-visible")
  // clear previews and any registered code highlights
  clearHighlightsForElement(previewThemed)
  clearHighlightsForElement(previewThemeJson)
  previewThemed.textContent = ""
  previewThemeJson.textContent = ""

  // clear logs summary (remove title, list items or any pre-existing text)
  // revoke any blob URLs created for the logs summary links to avoid memory leaks
  if (summaryBlobUrls && summaryBlobUrls.length) {
    summaryBlobUrls.forEach((u) => {
      try {
        URL.revokeObjectURL(u)
      } catch (e) {
        /* ignore */
      }
    })
    summaryBlobUrls = []
  }
  const genSummaryEl = document.getElementById("summary-logs-id")
  if (genSummaryEl) {
    const ul = genSummaryEl.querySelector("#summary-logs-list")
    const title = genSummaryEl.querySelector(".summary-logs-title")
    if (title) title.remove()
    if (ul) {
      ul.innerHTML = ""
      ul.setAttribute("aria-hidden", "true")
    } else genSummaryEl.textContent = ""

    // hide the generation summary container by default
    genSummaryEl.classList.remove("is-visible")
    genSummaryEl.setAttribute("aria-hidden", "true")
    // also hide the outer section to avoid visible padding/background
    const genSummarySection = genSummaryEl.closest(".summary-logs")
    if (genSummarySection) {
      genSummarySection.classList.remove("is-visible")
      genSummarySection.setAttribute("aria-hidden", "true")
    }

    // hide download controls by default
    const downloadBtn = document.getElementById("download-kit-btn")
    if (downloadBtn) {
      downloadBtn.disabled = true
      downloadBtn.textContent = "Télécharger Kit complet"
      const controls = downloadBtn.closest(".summary-controls")
      if (controls) {
        controls.classList.remove("is-visible")
        controls.setAttribute("aria-hidden", "true")
      }
    }
  }

  // hide theme.json preview panel by default
  const panelThemeJson = document.getElementById("panel-preview-themejson")
  if (panelThemeJson) {
    panelThemeJson.classList.remove("is-visible")
    panelThemeJson.setAttribute("aria-hidden", "true")
  }

  // hide results area until artifacts are generated
  setResultsVisible(false)

  // no download/apply buttons — clear artifacts cache
  lastArtifacts = null
}

async function handleFiles(files) {
  resetUi()
  lastFiles = Array.from(files) // remember files for later regeneration

  // If a previous run left a raw summary string inside the container, convert it to list for consistency
  const genSummaryContainer = document.getElementById("summary-logs-id")
  if (genSummaryContainer && genSummaryContainer.textContent.trim()) {
    const txt = genSummaryContainer.textContent.trim()
    renderGenerationSummaryText(genSummaryContainer, txt)
    // clear the raw text node if any
    if (
      genSummaryContainer.firstChild &&
      genSummaryContainer.firstChild.nodeType === Node.TEXT_NODE
    )
      genSummaryContainer.firstChild.textContent = ""
  }

  const { artifacts, logs } = await processFiles(
    Array.from(files),
    (message) => {}, // suppress immediate logging; UI does not expose debug logs
  )

  // Cache logs from last run but do not display them in the UI (no debug toggle)
  lastLogs = logs || []
  // Ensure logs panel is hidden and cleared
  const logsContainer = document.querySelector(".logs")
  if (logsContainer) {
    logsContainer.classList.remove("is-visible")
    logsContainer.setAttribute("aria-hidden", "true")
  }
  logOutput.textContent = ""

  // show artifacts
  highlightCode(previewThemed, artifacts["theme.css"], "css")
  // ensure download controls reflect presence of theme.css (Option A: activate if theme exists)
  updateDownloadControls(!!(artifacts && artifacts["theme.css"]))
  // show generation summary just above results (if provided)
  const genSummaryEl = document.getElementById("summary-logs-id")
  if (genSummaryEl) {
    const txt = artifacts["generation-summary.txt"] || ""
    renderGenerationSummaryText(genSummaryEl, txt, artifacts)
    // also remove any stray plain text node inside container (legacy)
    const first = genSummaryEl.firstChild
    if (first && first.nodeType === Node.TEXT_NODE) first.textContent = ""

    // only display the summary container when we have meaningful content
    const genSummarySection = genSummaryEl.closest(".summary-logs")
    const ulEl = genSummaryEl.querySelector("#summary-logs-list")
    if (txt && txt.trim()) {
      genSummaryEl.classList.add("is-visible")
      genSummaryEl.setAttribute("aria-hidden", "false")
      if (ulEl) ulEl.setAttribute("aria-hidden", "false")
      if (genSummarySection) {
        genSummarySection.classList.add("is-visible")
        genSummarySection.setAttribute("aria-hidden", "false")
      }

      // show download controls when there is at least one artifact
      const downloadBtn = document.getElementById("download-kit-btn")
      if (downloadBtn) {
        const controls = downloadBtn.closest(".summary-controls")
        if (controls) {
          controls.classList.add("is-visible")
          controls.setAttribute("aria-hidden", "false")
        }
        // enable only if we have theme.css (minimum requirement)
        downloadBtn.disabled = !(artifacts && artifacts["theme.css"])
      }
    } else {
      genSummaryEl.classList.remove("is-visible")
      genSummaryEl.setAttribute("aria-hidden", "true")
      if (ulEl) ulEl.setAttribute("aria-hidden", "true")
      if (genSummarySection) {
        genSummarySection.classList.remove("is-visible")
        genSummarySection.setAttribute("aria-hidden", "true")
      }

      // hide download controls when no summary
      const downloadBtn = document.getElementById("download-kit-btn")
      if (downloadBtn) {
        const controls = downloadBtn.closest(".summary-controls")
        if (controls) {
          controls.classList.remove("is-visible")
          controls.setAttribute("aria-hidden", "true")
        }
        downloadBtn.disabled = true
      }
    }
  }

  // show or hide the results section depending on whether we have artifacts
  const hasArtifacts = artifacts && Object.keys(artifacts).length > 0
  setResultsVisible(!!hasArtifacts)

  // Show/hide theme.json preview depending on the checkbox
  const generateJson = !!(
    document.getElementById("generate-themejson") &&
    document.getElementById("generate-themejson").checked
  )
  const panelThemeJson = document.getElementById("panel-preview-themejson")
  if (generateJson && artifacts["theme.json"]) {
    highlightCode(previewThemeJson, artifacts["theme.json"], "json")
    if (panelThemeJson) {
      panelThemeJson.classList.add("is-visible")
      panelThemeJson.setAttribute("aria-hidden", "false")
    }
  } else {
    // clear preview and highlights
    clearHighlightsForElement(previewThemeJson)
    previewThemeJson.textContent = ""
    if (panelThemeJson) {
      panelThemeJson.classList.remove("is-visible")
      panelThemeJson.setAttribute("aria-hidden", "true")
    }
  }

  // The list of generated files is now rendered inside the generation summary as linked items. (No separate list element.)
  // Nothing to do here.

  // copy buttons handle user interactions now
  lastArtifacts = artifacts
}

// Dropzone handlers
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault()
  dropzone.classList.add("is-dragover")
})
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("is-dragover")
})
dropzone.addEventListener("drop", (e) => {
  e.preventDefault()
  dropzone.classList.remove("is-dragover")
  const files = e.dataTransfer.files
  if (files && files.length) handleFiles(files)
})

fileInput.addEventListener("change", (e) => {
  const files = e.target.files
  if (files && files.length) handleFiles(files)
})

// keyboard accessibility: enter on dropzone opens file input
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    fileInput.click()
    e.preventDefault()
  }
})

// Debug toggle removed from UI: no runtime handler required

// Toggle to generate and preview theme.json (WordPress project)
const genThemeJsonToggle = document.getElementById("generate-themejson")
const panelThemeJson = document.getElementById("panel-preview-themejson")
if (genThemeJsonToggle) {
  genThemeJsonToggle.addEventListener("change", async (e) => {
    const checked = e.target.checked
    if (checked) {
      // If we don't have theme.json yet, regenerate from lastFiles (or empty project)
      if (!lastArtifacts || !lastArtifacts["theme.json"]) {
        try {
          const filesToUse = lastFiles || []
          const { artifacts: newArtifacts, logs } = await processFiles(
            filesToUse,
            (m) => {},
          )
          lastArtifacts = newArtifacts
        } catch (err) {
          console.error("Erreur lors de la génération de theme.json:", err)
        }
      }
      if (lastArtifacts && lastArtifacts["theme.json"]) {
        highlightCode(previewThemeJson, lastArtifacts["theme.json"], "json")
        if (panelThemeJson) {
          panelThemeJson.classList.add("is-visible")
          panelThemeJson.setAttribute("aria-hidden", "false")
        }
        console.log("theme.json généré et affiché")
      } else {
        // nothing to show
        clearHighlightsForElement(previewThemeJson)
        previewThemeJson.textContent = ""
        if (panelThemeJson) {
          panelThemeJson.classList.remove("is-visible")
          panelThemeJson.setAttribute("aria-hidden", "true")
        }
        console.warn("theme.json non disponible après génération")
      }
    } else {
      previewThemeJson.textContent = ""
      if (panelThemeJson) {
        panelThemeJson.classList.remove("is-visible")
        panelThemeJson.setAttribute("aria-hidden", "true")
      }
    }
    // Update summary to reflect theme.json addition/removal
    if (lastArtifacts) {
      const genSummaryEl = document.getElementById("summary-logs-id")
      const txt = lastArtifacts["generation-summary.txt"] || ""
      renderGenerationSummaryText(genSummaryEl, txt, lastArtifacts)
    }
  })
}

// Listen to other checkbox changes to update the summary list
document
  .getElementById("add-extra-css-files")
  ?.addEventListener("change", async (e) => {
    if (e.target.checked) {
      // Pre-fetch files for summary links if not in cache
      for (const f of EXTRA_CSS_FILES) {
        if (!extraFilesCache[f.name]) {
          const text = await fetchTextWithCacheBust(f.src)
          if (text) extraFilesCache[f.name] = text
        }
      }
    }
    if (lastArtifacts) {
      const genSummaryEl = document.getElementById("summary-logs-id")
      const txt = lastArtifacts["generation-summary.txt"] || ""
      renderGenerationSummaryText(genSummaryEl, txt, lastArtifacts)
    }
  })

document.getElementById("add-config-files")?.addEventListener("change", () => {
  if (lastArtifacts) {
    const genSummaryEl = document.getElementById("summary-logs-id")
    const txt = lastArtifacts["generation-summary.txt"] || ""
    renderGenerationSummaryText(genSummaryEl, txt, lastArtifacts)
  }
})

// Empty project button handler
const btnEmptyProject = document.getElementById("btn-empty-project")
if (btnEmptyProject) {
  btnEmptyProject.addEventListener("click", async () => {
    // generate theme without any JSON files
    resetUi()

    const { artifacts, logs } = await processFiles([], () => {}, {})
    // remember lastFiles as empty project
    lastFiles = []

    // Replace the verbose summary with a minimal one for empty project
    const minimalSummary = [
      "Résumé de génération :",
      "Fichiers traités : 0",
    ].join("\n")
    artifacts["generation-summary.txt"] = minimalSummary

    // reuse same log logic as handleFiles (debug UI removed: keep logs hidden)
    const logsContainer = document.querySelector(".logs")
    lastLogs = logs || []
    if (logsContainer) {
      logsContainer.classList.remove("is-visible")
      logsContainer.setAttribute("aria-hidden", "true")
    }
    logOutput.textContent = ""

    // Ensure download controls are visible and enabled for empty project
    updateDownloadControls(true)

    // show artifacts
    highlightCode(previewThemed, artifacts["theme.css"], "css")

    // ensure download controls reflect presence of theme.css (Option A)
    updateDownloadControls(!!(artifacts && artifacts["theme.css"]))

    // ensure download controls reflect presence of theme.css (Option A: activate if theme exists)
    updateDownloadControls(!!(artifacts && artifacts["theme.css"]))

    // show generation summary just above results (if provided)
    const genSummaryEl = document.getElementById("summary-logs-id")
    if (genSummaryEl) {
      const txt = artifacts["generation-summary.txt"] || ""
      renderGenerationSummaryText(genSummaryEl, txt, artifacts)
      // also remove any stray plain text node inside container (legacy)
      const first = genSummaryEl.firstChild
      if (first && first.nodeType === Node.TEXT_NODE) first.textContent = ""

      // Show/hide theme.json preview depending on the checkbox
      const generateJson = !!(
        document.getElementById("generate-themejson") &&
        document.getElementById("generate-themejson").checked
      )
      const panelThemeJson = document.getElementById("panel-preview-themejson")
      if (generateJson && artifacts["theme.json"]) {
        highlightCode(previewThemeJson, artifacts["theme.json"], "json")
        if (panelThemeJson) {
          panelThemeJson.classList.add("is-visible")
          panelThemeJson.setAttribute("aria-hidden", "false")
        }
      } else {
        clearHighlightsForElement(previewThemeJson)
        previewThemeJson.textContent = ""
        if (panelThemeJson) {
          panelThemeJson.classList.remove("is-visible")
          panelThemeJson.setAttribute("aria-hidden", "true")
        }
      }

      // toggle visibility of summary container and download controls (same logic as handleFiles)
      const genSummarySection = genSummaryEl.closest(".summary-logs")
      const ulEl = genSummaryEl.querySelector("#summary-logs-list")
      if (txt && txt.trim()) {
        genSummaryEl.classList.add("is-visible")
        genSummaryEl.setAttribute("aria-hidden", "false")
        if (ulEl) ulEl.setAttribute("aria-hidden", "false")
        if (genSummarySection) {
          genSummarySection.classList.add("is-visible")
          genSummarySection.setAttribute("aria-hidden", "false")
        }

        // show download controls when there is at least one artifact
        const downloadBtn = document.getElementById("download-kit-btn")
        if (downloadBtn) {
          const controls = downloadBtn.closest(".summary-controls")
          if (controls) {
            controls.classList.add("is-visible")
            controls.setAttribute("aria-hidden", "false")
          }
          // enable only if we have theme.css (minimum requirement)
          downloadBtn.disabled = !(artifacts && artifacts["theme.css"])
        }
      } else {
        genSummaryEl.classList.remove("is-visible")
        genSummaryEl.setAttribute("aria-hidden", "true")
        if (ulEl) ulEl.setAttribute("aria-hidden", "true")
        if (genSummarySection) {
          genSummarySection.classList.remove("is-visible")
          genSummarySection.setAttribute("aria-hidden", "true")
        }

        // hide download controls when no summary
        const downloadBtn = document.getElementById("download-kit-btn")
        if (downloadBtn) {
          const controls = downloadBtn.closest(".summary-controls")
          if (controls) {
            controls.classList.remove("is-visible")
            controls.setAttribute("aria-hidden", "true")
          }
          downloadBtn.disabled = true
        }
      }
    }

    // The empty project reuses the generation summary to display linked files; no separate list element;

    // copy buttons available for each preview

    // show results area since artifacts were generated
    setResultsVisible(!!(artifacts && Object.keys(artifacts).length > 0))

    lastArtifacts = artifacts
  })
}

/**
 * Helper: generates the content of app.css based on current options.
 * It always includes theme.css, styles.css and utilities.css.
 * It optionally includes reset.css, natives.css and layouts.css if extra files are checked.
 */
function getAppCssContent() {
  const addExtraCss = document.getElementById("add-extra-css-files")?.checked
  return `/* L'ordre des layers définit la priorité des styles */

/* Chaque layer écrase le précédent si conflit */
@layer config, base, components, utilities;

/* Config */
${addExtraCss ? '@import "reset.css" layer(config);\n' : ""}${addExtraCss ? '@import "natives.css" layer(config);\n' : ""}${addExtraCss ? '@import "layouts.css" layer(config);\n' : ""}@import "theme.css" layer(config);

/* Base */
@import "styles.css" layer(base);

/* Utilities */
@import "utilities.css" layer(utilities);
`
}

// helper: render the generation summary string into title + list
function renderGenerationSummaryText(container, txt, artifacts = {}) {
  const ul = container.querySelector("#summary-logs-list")
  if (!ul) {
    container.textContent = txt
    return
  }
  // revoke any previous summary blob URLs before rendering new links
  if (summaryBlobUrls && summaryBlobUrls.length) {
    summaryBlobUrls.forEach((u) => {
      try {
        URL.revokeObjectURL(u)
      } catch (e) {
        /* ignore revoke errors */
      }
    })
    summaryBlobUrls = []
  }
  ul.innerHTML = ""
  const lines = txt
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length) {
    let titleEl = container.querySelector(".summary-logs-title")
    if (!titleEl) {
      titleEl = document.createElement("div")
      titleEl.className = "summary-logs-title"
      container.insertBefore(titleEl, ul)
    }
    titleEl.textContent = lines[0]
    lines.slice(1).forEach((line) => {
      const li = document.createElement("li")
      li.textContent = line
      ul.appendChild(li)
    })

    // Add the "Fichiers générés" line dynamically
    const genFilesLi = document.createElement("li")
    genFilesLi.appendChild(document.createTextNode("Fichiers générés : "))

    const filesToDisplay = []

    // 1. styles.css (default)
    filesToDisplay.push({ name: "styles.css", content: STYLES_CSS_CONTENT })

    // 1b. utilities.css (default)
    filesToDisplay.push({
      name: "utilities.css",
      content: UTILITIES_CSS_CONTENT,
    })

    // 1c. app.css (default)
    filesToDisplay.push({
      name: "app.css",
      content: getAppCssContent(),
    })

    // 2. theme.css (default, if exists)
    if (artifacts && artifacts["theme.css"]) {
      filesToDisplay.push({
        name: "theme.css",
        content: artifacts["theme.css"],
      })
    }

    // 3. theme.json (if checkbox checked)
    const generateThemeJson =
      document.getElementById("generate-themejson")?.checked
    if (generateThemeJson && artifacts && artifacts["theme.json"]) {
      filesToDisplay.push({
        name: "theme.json",
        content: artifacts["theme.json"],
      })
    }

    // 4. extra css files (if checkbox checked)
    const addExtraCss = document.getElementById("add-extra-css-files")?.checked
    if (addExtraCss) {
      EXTRA_CSS_FILES.forEach((f) => {
        filesToDisplay.push({ name: f.name, content: extraFilesCache[f.name] })
      })
    }

    // 5. config files (if checkbox checked)
    const addConfigFiles = document.getElementById("add-config-files")?.checked

    // Render files list with links where content is available
    filesToDisplay.forEach((file, idx) => {
      if (file.content) {
        const isJson = file.name.endsWith(".json")
        const blob = new Blob([file.content], {
          type: isJson ? "application/json" : "text/css",
        })
        const url = URL.createObjectURL(blob)
        summaryBlobUrls.push(url)
        const a = document.createElement("a")
        a.href = url
        a.download = file.name
        a.textContent = file.name
        genFilesLi.appendChild(a)
      } else {
        genFilesLi.appendChild(document.createTextNode(file.name))
      }

      if (idx < filesToDisplay.length - 1 || addConfigFiles) {
        genFilesLi.appendChild(document.createTextNode(" / "))
      }
    })

    if (addConfigFiles) {
      genFilesLi.appendChild(document.createTextNode("+ fichiers de config"))
    }

    ul.appendChild(genFilesLi)
  }
}

// init
resetUi()

// On load: if the generation summary container already contains raw text (e.g., page restored), convert it to the list
const genSummaryOnLoad = document.getElementById("summary-logs-id")
if (genSummaryOnLoad && genSummaryOnLoad.textContent.trim()) {
  const txt = genSummaryOnLoad.textContent.trim()
  // No artifacts available on load; render as plain text conversion
  renderGenerationSummaryText(genSummaryOnLoad, txt)
  // remove stray text node
  const first = genSummaryOnLoad.firstChild
  if (first && first.nodeType === Node.TEXT_NODE) first.textContent = ""

  // show legacy summary on load if present
  if (txt && txt.trim()) {
    genSummaryOnLoad.classList.add("is-visible")
    genSummaryOnLoad.setAttribute("aria-hidden", "false")
    const ulOnLoad = genSummaryOnLoad.querySelector("#summary-logs-list")
    if (ulOnLoad) ulOnLoad.setAttribute("aria-hidden", "false")
    const genSummarySectionOnLoad = genSummaryOnLoad.closest(".summary-logs")
    if (genSummarySectionOnLoad) {
      genSummarySectionOnLoad.classList.add("is-visible")
      genSummarySectionOnLoad.setAttribute("aria-hidden", "false")
    }
  }
}

// COPY BUTTONS: accessible copy functionality for code previews
function announceCopy(msg) {
  const status = document.getElementById("copy-status")
  if (!status) return
  status.textContent = msg
  setTimeout(() => {
    // clear message after a short delay so screen readers can read it
    if (status.textContent === msg) status.textContent = ""
  }, 2000)
}

async function copyPreContent(preEl, btn) {
  if (!preEl) return
  const text = preEl.textContent || ""
  if (!text.trim()) {
    announceCopy("Aucun contenu à copier")
    return
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      // fallback
      const ta = document.createElement("textarea")
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      ta.remove()
    }
    // visual feedback
    if (btn) {
      const prev = btn.textContent
      btn.classList.add("is-copied")
      btn.textContent = "Copié !"
      setTimeout(() => {
        btn.classList.remove("is-copied")
        btn.textContent = prev
      }, 1500)
    }
    announceCopy("Contenu copié dans le presse-papiers")
  } catch (err) {
    announceCopy("Impossible de copier le contenu")
  }
}

// attach listeners to existing copy buttons
function initCopyButtons() {
  const buttons = document.querySelectorAll(".copy-btn")
  buttons.forEach((b) => {
    b.addEventListener("click", (e) => {
      const targetId = b.getAttribute("data-target")
      const pre = targetId ? document.getElementById(targetId) : null
      copyPreContent(pre, b)
    })
  })
}

// Initialize copy buttons on load
initCopyButtons()

// INFO BUTTONS: transforme les boutons (class .btn-info) en ancres accessibles
// Le bouton doit avoir `data-target="<id>"` correspondant à un <details id>
// - met à jour `aria-controls` et `aria-expanded`
// - ouvre le <details> ciblé et focuse le <summary>
// - met à jour le hash (pushState) pour créer une vraie ancre
function updateInfoButtonsForDetails(id, isOpen) {
  document.querySelectorAll(`.btn-info[data-target="${id}"]`).forEach((btn) => {
    btn.setAttribute("aria-expanded", !!isOpen)
  })
}

// Ferme tous les <details> sauf celui passé en exception (id ou élément)
function closeOtherDetails(exception) {
  const exceptId =
    typeof exception === "string" ? exception : exception && exception.id
  document.querySelectorAll("details[id]").forEach((d) => {
    if (!d.id) return
    if (d.id !== exceptId && d.open) {
      d.open = false
      updateInfoButtonsForDetails(d.id, false)
      // cleanup hash if it pointed to the closed detail
      if (location.hash === `#${d.id}`) {
        history.replaceState(null, "", location.pathname + location.search)
      }
    }
  })
}

function openDetailsAndFocus(id, { pushHistory = false } = {}) {
  if (!id) return
  const details = document.getElementById(id)
  if (!(details instanceof HTMLDetailsElement)) return
  if (!details.open) details.open = true
  // fermer les autres détails pour comportement d'accordéon
  closeOtherDetails(details)
  const summary = details.querySelector("summary")
  if (summary && typeof summary.focus === "function") {
    // focus then ensure visible for sighted keyboard users
    summary.focus()
    if (typeof summary.scrollIntoView === "function") {
      try {
        summary.scrollIntoView({ block: "center", behavior: "smooth" })
      } catch (e) {
        summary.scrollIntoView()
      }
    }
  }
  updateInfoButtonsForDetails(id, true)
  if (pushHistory) {
    history.pushState(null, "", `#${id}`)
  } else {
    history.replaceState(null, "", `#${id}`)
  }
}

function initInfoButtons() {
  const buttons = document.querySelectorAll(".btn-info[data-target]")
  buttons.forEach((btn) => {
    const targetId = btn.getAttribute("data-target")
    if (!targetId) return
    btn.setAttribute("aria-controls", targetId)
    btn.setAttribute("aria-expanded", "false")
    btn.addEventListener("click", (e) => {
      e.preventDefault()
      openDetailsAndFocus(targetId, { pushHistory: true })
    })
  })

  // Sync when details toggled (via summary click)
  document.querySelectorAll("details[id]").forEach((details) => {
    details.addEventListener("toggle", () => {
      const id = details.id
      const isOpen = details.open
      updateInfoButtonsForDetails(id, isOpen)
      if (isOpen) {
        // fermer les autres détails (accordéon)
        closeOtherDetails(details)
        history.replaceState(null, "", `#${id}`)
      } else {
        if (location.hash === `#${id}`) {
          history.replaceState(null, "", location.pathname + location.search)
        }
      }
    })
  })

  // React to hashchange (back/forward or direct link)
  window.addEventListener("hashchange", () => {
    const id = location.hash && location.hash.slice(1)
    if (!id) return
    const details = document.getElementById(id)
    if (details && details instanceof HTMLDetailsElement) {
      details.open = true
      const summary = details.querySelector("summary")
      if (summary) {
        summary.focus()
        if (typeof summary.scrollIntoView === "function") {
          try {
            summary.scrollIntoView({ block: "center", behavior: "smooth" })
          } catch (e) {
            summary.scrollIntoView()
          }
        }
      }
      updateInfoButtonsForDetails(id, true)
    }
  })

  // Ensure buttons reflect current open state of details
  document.querySelectorAll("details[id]").forEach((d) => {
    updateInfoButtonsForDetails(d.id, !!d.open)
  })

  // Open on initial load if hash present
  const initial = location.hash && location.hash.slice(1)
  if (initial) {
    const details = document.getElementById(initial)
    if (details && details instanceof HTMLDetailsElement) {
      details.open = true
      const summary = details.querySelector("summary")
      if (summary) {
        summary.focus()
        if (typeof summary.scrollIntoView === "function") {
          try {
            summary.scrollIntoView({ block: "center", behavior: "smooth" })
          } catch (e) {
            summary.scrollIntoView()
          }
        }
      }
      updateInfoButtonsForDetails(initial, true)
    }
  }
}

// Initialize info buttons
initInfoButtons()

// download kit (zip) functionality
async function fetchTextIfAvailable(path) {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    return await res.text()
  } catch (e) {
    return null
  }
}

// Fetch a remote resource with a simple cache-bust query param to force latest version
// Uses cache: 'no-store' to ensure the network is hit (simple and reliable)
async function fetchTextWithCacheBust(url) {
  try {
    const sep = url.includes("?") ? "&" : "?"
    const fetchUrl = `${url}${sep}t=${Date.now()}`
    const res = await fetch(fetchUrl, { cache: "no-store" })
    if (!res.ok) return null
    return await res.text()
  } catch (e) {
    return null
  }
}

async function createAndDownloadKit() {
  const btn = document.getElementById("download-kit-btn")
  if (!btn || btn.disabled) return
  btn.disabled = true
  const prev = btn.textContent
  btn.textContent = "Préparation..."
  announceCopy("Préparation de l'archive...")
  try {
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip introuvable")
    }
    const zip = new JSZip()
    const cssFolder = zip.folder("css")

    // theme.css (obligatoire)
    const themeCss =
      (lastArtifacts && lastArtifacts["theme.css"]) ||
      previewThemed.textContent ||
      ""
    // placer theme.css dans le dossier css/
    if (cssFolder) cssFolder.file("theme.css", themeCss)

    if (cssFolder) cssFolder.file("styles.css", STYLES_CSS_CONTENT)
    if (cssFolder) cssFolder.file("utilities.css", UTILITIES_CSS_CONTENT)

    // theme.json optionnel
    if (
      document.getElementById("generate-themejson") &&
      document.getElementById("generate-themejson").checked
    ) {
      const themeJson = (lastArtifacts && lastArtifacts["theme.json"]) || ""
      if (themeJson) cssFolder.file("theme.json", themeJson)
    }

    // option: extra css files (fetch from remote canonical URLs with cache-bust ?t=...)
    if (
      document.getElementById("add-extra-css-files") &&
      document.getElementById("add-extra-css-files").checked
    ) {
      for (const f of EXTRA_CSS_FILES) {
        // use cache if available, else fetch
        const text =
          extraFilesCache[f.name] || (await fetchTextWithCacheBust(f.src))
        if (text !== null) {
          cssFolder.file(f.name, text)
          extraFilesCache[f.name] = text // update cache
        }
      }
    }

    // Systematic app.css generation
    if (cssFolder) cssFolder.file("app.css", getAppCssContent())

    // option: config files (support 'config_files:*' artifacts + robust fallback fetch)
    if (
      document.getElementById("add-config-files") &&
      document.getElementById("add-config-files").checked
    ) {
      // Prefer files provided by the generation step under keys like 'config_files:PATH' or 'config_files/PATH'
      let addedAny = false
      if (lastArtifacts) {
        for (const key of Object.keys(lastArtifacts)) {
          if (key.startsWith("config_files:")) {
            const dest = key.slice("config_files:".length)
            const content = lastArtifacts[key]
            if (typeof content === "string") {
              zip.file(dest, content)
              addedAny = true
              // also try adding dotted variant if missing (e.g., 'editorconfig' -> '.editorconfig')
              if (
                !dest.startsWith(".") &&
                !dest.startsWith(".vscode") &&
                dest.indexOf("/") === -1
              ) {
                // add dotted alias as well
                zip.file(`.${dest}`, content)
              } else if (!dest.startsWith(".") && dest.startsWith("vscode/")) {
                zip.file(`.vscode/${dest.slice(6)}`, content)
              }
            }
          } else if (key.startsWith("config_files/")) {
            const dest = key.slice("config_files/".length)
            const content = lastArtifacts[key]
            if (typeof content === "string") {
              zip.file(dest, content)
              addedAny = true
            }
          }
        }
      }

      // helper: try multiple fetch paths (with/without leading dot, absolute or relative)
      async function tryFetchVariants(p) {
        const candidates = new Set()
        // common locations
        candidates.add("/" + p)
        candidates.add(p)
        candidates.add("/config_files/" + p)
        candidates.add("config_files/" + p)

        // if starts with '.', try without dot and with config_files variants
        if (p.startsWith(".")) {
          candidates.add("/" + p.slice(1))
          candidates.add(p.slice(1))
          candidates.add("/config_files/" + p.slice(1))
          candidates.add("config_files/" + p.slice(1))
        } else {
          // try with dot prefix for common dotfiles, and config_files variants
          candidates.add("/." + p)
          candidates.add("." + p)
          candidates.add("/config_files/." + p)
          candidates.add("config_files/." + p)
        }

        for (const c of candidates) {
          const t = await fetchTextIfAvailable(c)
          if (t !== null) return { text: t, path: c }
        }
        return null
      }

      // If none were provided via artifacts, fallback to fetching canonical config files from project root
      const missing = []
      if (!addedAny) {
        const cfg = [
          ".editorconfig",
          ".gitignore",
          ".vscode/extensions.json",
          ".vscode/settings.json",
          "postcss.config.mjs",
          "prettier.config.mjs",
          "stylelint.config.mjs",
          "vite.config.js",
        ]
        for (const p of cfg) {
          const result = await tryFetchVariants(p)
          if (result && result.text !== null) {
            // ensure we store at the intended destination (preserve dot/dir form)
            const dest = p
            zip.file(dest, result.text)
            addedAny = true
            // If destination is a dotted file like '.editorconfig' but the fetched path was non-dotted,
            // also create a copy with dotted name to be safe
            if (
              (p === ".editorconfig" || p === ".gitignore") &&
              !result.path.includes("." + p.slice(1))
            ) {
              zip.file(p, result.text)
            }
          } else {
            missing.push(p)
          }
        }
      }

      // notify user if some files couldn't be fetched
      if (missing.length) {
        announceCopy(
          `Fichiers de configuration manquants : ${missing.join(", ")}`,
        )
        console.warn("Fichiers de configuration manquants:", missing)
      }
    }

    const blob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "primary-kit.zip"
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    announceCopy("Archive prête, téléchargement lancé")
  } catch (err) {
    console.error(err)
    announceCopy("Impossible de générer l'archive")
  } finally {
    btn.disabled = false
    btn.textContent = prev
  }
}

function initDownloadKitButton() {
  const btn = document.getElementById("download-kit-btn")
  if (!btn) return
  btn.addEventListener("click", () => {
    createAndDownloadKit()
  })
  btn.disabled = true
}

// Initialize download button handling
initDownloadKitButton()
