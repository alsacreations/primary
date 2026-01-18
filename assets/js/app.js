import { processFiles } from "./client-utils.mjs"

const dropzone = document.getElementById("dropzone")
const fileInput = document.getElementById("file-input")
const logOutput = document.getElementById("log-output")
const previewThemed = document.getElementById("preview-themecss")
const previewThemeJson = document.getElementById("preview-themejson")
const generatedList = document.getElementById("generated-list")
const btnDownloadThemeCss = document.getElementById("btn-download-themecss")
const btnDownloadThemeJson = document.getElementById("btn-download-themejson")
const btnDownloadZip = document.getElementById("btn-download-zip")
const btnClear = document.getElementById("btn-clear")
const btnApplyTheme = document.getElementById("btn-apply-theme")

let lastArtifacts = null
let lastLogs = []
let lastFiles = null

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

  // hide theme.json preview panel by default
  const panelThemeJson = document.getElementById("panel-preview-themejson")
  if (panelThemeJson) {
    panelThemeJson.classList.remove("is-visible")
    panelThemeJson.setAttribute("aria-hidden", "true")
  }

  generatedList.innerHTML = ""
  btnDownloadThemeCss.disabled = true
  btnDownloadThemeJson.disabled = true
  btnDownloadZip.disabled = true
  btnApplyTheme.disabled = true
  lastArtifacts = null
}

async function handleFiles(files) {
  resetUi()
  lastFiles = Array.from(files) // remember files for later regeneration

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

  // Show/hide theme.json preview depending on the checkbox
  const generateJson = !!(
    document.getElementById("generate-themejson-toggle") &&
    document.getElementById("generate-themejson-toggle").checked
  )
  const panelThemeJson = document.getElementById("panel-preview-themejson")
  if (generateJson && artifacts["theme.json"]) {
    previewThemeJson.textContent = artifacts["theme.json"]
    if (panelThemeJson) {
      panelThemeJson.classList.add("is-visible")
      panelThemeJson.setAttribute("aria-hidden", "false")
    }
    btnDownloadThemeJson.disabled = false
  } else {
    previewThemeJson.textContent = ""
    if (panelThemeJson) {
      panelThemeJson.classList.remove("is-visible")
      panelThemeJson.setAttribute("aria-hidden", "true")
    }
    btnDownloadThemeJson.disabled = true
  }

  // list generated files
  generatedList.innerHTML = ""
  Object.keys(artifacts).forEach((k) => {
    const li = document.createElement("li")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(
      new Blob([artifacts[k]], {
        type: k.endsWith(".json") ? "application/json" : "text/css",
      }),
    )
    a.download = k
    a.textContent = k
    li.appendChild(a)
    generatedList.appendChild(li)
  })

  // enable downloads
  btnDownloadThemeCss.disabled = false
  btnDownloadThemeJson.disabled = false
  btnDownloadZip.disabled = false
  btnApplyTheme.disabled = false

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

btnDownloadThemeCss.addEventListener("click", () => {
  if (!lastArtifacts) return
  const blob = new Blob([lastArtifacts["theme.css"]], { type: "text/css" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "theme.css"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
})

btnDownloadThemeJson.addEventListener("click", () => {
  if (!lastArtifacts) return
  const blob = new Blob([lastArtifacts["theme.json"]], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "theme.json"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
})

btnDownloadZip.addEventListener("click", async () => {
  if (!lastArtifacts) return
  const zip = new JSZip()
  Object.keys(lastArtifacts).forEach((k) => zip.file(k, lastArtifacts[k]))
  const content = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(content)
  const a = document.createElement("a")
  a.href = url
  a.download = "primary-theme-artifacts.zip"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
})

btnApplyTheme.addEventListener("click", () => {
  if (!lastArtifacts) return
  // Inject style into the page for preview
  let el = document.getElementById("preview-theme-style")
  if (!el) {
    el = document.createElement("style")
    el.id = "preview-theme-style"
    document.head.appendChild(el)
  }
  el.textContent = lastArtifacts["theme.css"]
  log("Thème appliqué en aperçu (non persistant)")
})

btnClear.addEventListener("click", resetUi)

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
const genThemeJsonToggle = document.getElementById("generate-themejson-toggle")
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
        btnDownloadThemeJson.disabled = false
        console.log("theme.json généré et affiché")
      } else {
        // nothing to show
        previewThemeJson.textContent = ""
        if (panelThemeJson) {
          panelThemeJson.classList.remove("is-visible")
          panelThemeJson.setAttribute("aria-hidden", "true")
        }
        btnDownloadThemeJson.disabled = true
        console.warn("theme.json non disponible après génération")
      }
    } else {
      previewThemeJson.textContent = ""
      if (panelThemeJson) {
        panelThemeJson.classList.remove("is-visible")
        panelThemeJson.setAttribute("aria-hidden", "true")
      }
      btnDownloadThemeJson.disabled = true
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

    // Show/hide theme.json preview depending on the checkbox
    const generateJson = !!(
      document.getElementById("generate-themejson-toggle") &&
      document.getElementById("generate-themejson-toggle").checked
    )
    const panelThemeJson = document.getElementById("panel-preview-themejson")
    if (generateJson && artifacts["theme.json"]) {
      previewThemeJson.textContent = artifacts["theme.json"]
      if (panelThemeJson) {
        panelThemeJson.classList.add("is-visible")
        panelThemeJson.setAttribute("aria-hidden", "false")
      }
      btnDownloadThemeJson.disabled = false
    } else {
      previewThemeJson.textContent = ""
      if (panelThemeJson) {
        panelThemeJson.classList.remove("is-visible")
        panelThemeJson.setAttribute("aria-hidden", "true")
      }
      btnDownloadThemeJson.disabled = true
    }

    // list generated files
    generatedList.innerHTML = ""
    Object.keys(artifacts).forEach((k) => {
      const li = document.createElement("li")
      const a = document.createElement("a")
      a.href = URL.createObjectURL(
        new Blob([artifacts[k]], {
          type: k.endsWith(".json") ? "application/json" : "text/css",
        }),
      )
      a.download = k
      a.textContent = k
      li.appendChild(a)
      generatedList.appendChild(li)
    })

    btnDownloadThemeCss.disabled = false
    btnDownloadThemeJson.disabled = false
    btnDownloadZip.disabled = false
    btnApplyTheme.disabled = false

    lastArtifacts = artifacts
  })
}

// init
resetUi()
