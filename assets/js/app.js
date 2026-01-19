import { processFiles } from "./client-utils.mjs"

const dropzone = document.getElementById("dropzone")
const fileInput = document.getElementById("file-input")
const logOutput = document.getElementById("log-output")
const previewThemed = document.getElementById("preview-themecss")
const previewThemeJson = document.getElementById("preview-themejson")
// Note: generated files are shown inside the generation summary; the dedicated `generated-list` element was removed from the DOM
// Download/reset/apply buttons removed; copy buttons are provided on code previews.

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
  previewThemed.textContent = ""
  previewThemeJson.textContent = ""

  // clear generation summary (remove title, list items or any pre-existing text)
  // revoke any blob URLs created for the generation summary links to avoid memory leaks
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
  const genSummaryEl = document.getElementById("generation-summary")
  if (genSummaryEl) {
    const ul = genSummaryEl.querySelector("#generation-summary-list")
    const title = genSummaryEl.querySelector(".generation-summary-title")
    if (title) title.remove()
    if (ul) ul.innerHTML = ""
    else genSummaryEl.textContent = ""
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
  const genSummaryContainer = document.getElementById("generation-summary")
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

  // Do not print parsing/technical logs unless debug enabled
  const debugFlag = !!(
    document.getElementById("debug-toggle") &&
    document.getElementById("debug-toggle").checked
  )

  const { artifacts, logs } = await processFiles(
    Array.from(files),
    (message) => {}, // suppress immediate logging; UI shows logs only in debug mode
    { debug: debugFlag },
  )

  // Show logs in UI only when debug is enabled
  const logsContainer = document.querySelector(".logs")
  // cache logs from last run even if debug was not enabled
  lastLogs = logs || []
  if (debugFlag) {
    logs.forEach((l) => {
      if (!l) return
      log(l)
    })
    logsContainer.classList.add("is-visible")
    logsContainer.setAttribute("aria-hidden", "false")
  } else {
    // ensure logs panel hidden and cleared
    logsContainer.classList.remove("is-visible")
    logsContainer.setAttribute("aria-hidden", "true")
    // keep the log output empty
    logOutput.textContent = ""
  }

  // show artifacts
  previewThemed.textContent = artifacts["theme.css"]

  // show generation summary just above results (if provided)
  const genSummaryEl = document.getElementById("generation-summary")
  if (genSummaryEl) {
    const txt = artifacts["generation-summary.txt"] || ""
    renderGenerationSummaryText(genSummaryEl, txt, artifacts)
    // also remove any stray plain text node inside container (legacy)
    const first = genSummaryEl.firstChild
    if (first && first.nodeType === Node.TEXT_NODE) first.textContent = ""
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
    previewThemeJson.textContent = artifacts["theme.json"]
    if (panelThemeJson) {
      panelThemeJson.classList.add("is-visible")
      panelThemeJson.setAttribute("aria-hidden", "false")
    }
  } else {
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

// Hook debug toggle to show cached logs when enabled
const debugToggleEl = document.getElementById("debug-toggle")
if (debugToggleEl) {
  debugToggleEl.addEventListener("change", (e) => {
    const logsContainer = document.querySelector(".logs")
    if (e.target.checked) {
      if (lastLogs && lastLogs.length) {
        // populate log output with last known logs
        logOutput.textContent = ""
        lastLogs.forEach((l) => log(l))
      }
      logsContainer.classList.add("is-visible")
      logsContainer.setAttribute("aria-hidden", "false")
    } else {
      logsContainer.classList.remove("is-visible")
      logsContainer.setAttribute("aria-hidden", "true")
      logOutput.textContent = ""
    }
  })
}

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
          const debugFlag = !!(
            document.getElementById("debug-toggle") &&
            document.getElementById("debug-toggle").checked
          )
          const filesToUse = lastFiles || []
          const { artifacts: newArtifacts, logs } = await processFiles(
            filesToUse,
            (m) => {},
            { debug: debugFlag },
          )
          lastArtifacts = newArtifacts
        } catch (err) {
          console.error("Erreur lors de la génération de theme.json:", err)
        }
      }
      if (lastArtifacts && lastArtifacts["theme.json"]) {
        previewThemeJson.textContent = lastArtifacts["theme.json"]
        if (panelThemeJson) {
          panelThemeJson.classList.add("is-visible")
          panelThemeJson.setAttribute("aria-hidden", "false")
        }
        console.log("theme.json généré et affiché")
      } else {
        // nothing to show
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
  })
}

// Empty project button handler
const btnEmptyProject = document.getElementById("btn-empty-project")
if (btnEmptyProject) {
  btnEmptyProject.addEventListener("click", async () => {
    // generate theme without any JSON files
    resetUi()

    const debugFlag = !!(
      document.getElementById("debug-toggle") &&
      document.getElementById("debug-toggle").checked
    )

    const { artifacts, logs } = await processFiles([], () => {}, {
      debug: debugFlag,
    })
    // remember lastFiles as empty project
    lastFiles = []

    // reuse same log logic as handleFiles
    const logsContainer = document.querySelector(".logs")
    lastLogs = logs || []
    if (debugFlag) {
      logs.forEach((l) => {
        if (!l) return
        log(l)
      })
      logsContainer.classList.add("is-visible")
      logsContainer.setAttribute("aria-hidden", "false")
    } else {
      logsContainer.classList.remove("is-visible")
      logsContainer.setAttribute("aria-hidden", "true")
      logOutput.textContent = ""
    }

    // show artifacts
    previewThemed.textContent = artifacts["theme.css"]

    // show generation summary just above results (if provided)
    const genSummaryEl = document.getElementById("generation-summary")
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
        previewThemeJson.textContent = artifacts["theme.json"]
        if (panelThemeJson) {
          panelThemeJson.classList.add("is-visible")
          panelThemeJson.setAttribute("aria-hidden", "false")
        }
      } else {
        previewThemeJson.textContent = ""
        if (panelThemeJson) {
          panelThemeJson.classList.remove("is-visible")
          panelThemeJson.setAttribute("aria-hidden", "true")
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

// helper: render the generation summary string into title + list
function renderGenerationSummaryText(container, txt, artifacts = {}) {
  const ul = container.querySelector("#generation-summary-list")
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
    let titleEl = container.querySelector(".generation-summary-title")
    if (!titleEl) {
      titleEl = document.createElement("div")
      titleEl.className = "generation-summary-title"
      container.insertBefore(titleEl, ul)
    }
    titleEl.textContent = lines[0]
    lines.slice(1).forEach((line) => {
      // If this line is the generated files line, render as linked items when possible
      if (/^Fichiers générés\s*:/i.test(line)) {
        const after = line.split(":")[1] || ""
        const parts = after
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean)
        const li = document.createElement("li")
        // Keep the label and append files inline separated by ' / '
        const label = line.split(":")[0].trim() + ": "
        li.appendChild(document.createTextNode(label))
        parts.forEach((name, idx) => {
          if (artifacts && artifacts[name]) {
            const blob = new Blob([artifacts[name]], {
              type: name.endsWith(".json") ? "application/json" : "text/css",
            })
            const a = document.createElement("a")
            const url = URL.createObjectURL(blob)
            summaryBlobUrls.push(url)
            a.href = url
            a.download = name
            a.textContent = name
            li.appendChild(a)
          } else {
            li.appendChild(document.createTextNode(name))
          }
          if (idx !== parts.length - 1)
            li.appendChild(document.createTextNode(" / "))
        })
        ul.appendChild(li)
      } else {
        const li = document.createElement("li")
        li.textContent = line
        ul.appendChild(li)
      }
    })
  }
}

// init
resetUi()

// On load: if the generation summary container already contains raw text (e.g., page restored), convert it to the list
const genSummaryOnLoad = document.getElementById("generation-summary")
if (genSummaryOnLoad && genSummaryOnLoad.textContent.trim()) {
  const txt = genSummaryOnLoad.textContent.trim()
  // No artifacts available on load; render as plain text conversion
  renderGenerationSummaryText(genSummaryOnLoad, txt)
  // remove stray text node
  const first = genSummaryOnLoad.firstChild
  if (first && first.nodeType === Node.TEXT_NODE) first.textContent = ""
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
