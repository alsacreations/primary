import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod
  const primitivesPath = path.resolve(process.cwd(), "dist", "primitives.json")
  if (!fs.existsSync(primitivesPath)) {
    console.error("primitives.json not found in dist/. Run build first.")
    process.exit(2)
  }

  const file = {
    name: "primitives.json",
    text: async () => fs.promises.readFile(primitivesPath, "utf8"),
  }

  const primitivesRaw = JSON.parse(await file.text())
  const projectColors = Object.keys(primitivesRaw.color || {}).filter(
    (k) =>
      ![
        "white",
        "black",
        "gray-50",
        "gray-100",
        "gray-200",
        "gray-300",
        "gray-400",
        "gray-500",
        "gray-600",
        "gray-700",
        "gray-800",
        "gray-900",
        "error-100",
        "error-300",
        "error-500",
        "error-700",
        "error-900",
        "success-100",
        "success-300",
        "success-500",
        "success-700",
        "success-900",
        "warning-100",
        "warning-300",
        "warning-500",
        "warning-700",
        "warning-900",
        "info-100",
        "info-300",
        "info-500",
        "info-700",
        "info-900",
      ].includes(k),
  )

  const { artifacts } = await processFiles([file], console.log)
  const css = artifacts["theme.css"]
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  const projectHeader = "/* Couleurs Primitives du projet */"
  const hasProjectBlock = css.includes(projectHeader)

  if (projectColors.length === 0) {
    if (hasProjectBlock) {
      console.error("No project colors expected, but project block exists")
      process.exit(1)
    }
    console.log("No project colors present — OK")
    process.exit(0)
  }

  if (!hasProjectBlock) {
    console.error(
      "Project colors present in primitives.json but block missing in theme.css",
    )
    process.exit(1)
  }

  // Collect lines following the project header
  const idx = css.indexOf(projectHeader)
  const slice = css.slice(idx)
  const lines = slice.split("\n")
  const found = []
  projectColors.forEach((name) => {
    const line = `  --color-${name}: `
    if (!lines.some((l) => l.trim().startsWith(line.trim()))) {
      found.push(name)
    }
  })

  if (found.length) {
    console.error(
      "Some project colors not emitted in project block:",
      found.join(", "),
    )
    process.exit(1)
  }

  console.log(
    "Project colors block present and contains all project colors — OK",
  )
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
