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

  const { artifacts } = await processFiles([file], console.log)
  const css = artifacts["theme.css"]
  const tokensJson = JSON.parse(artifacts["tokens.json"] || "{}")
  const colors = tokensJson.colors || {}
  const tokenNames = Object.keys(colors).filter((n) => n && n.trim())

  const hasProjectTokens = tokenNames.filter((t) => {
    const exceptions = new Set([
      "primary",
      "on-primary",
      "primary-lighten",
      "primary-darken",
      "accent",
      "accent-invert",
      "surface",
      "on-surface",
      "layer-1",
      "layer-2",
      "layer-3",
      "link",
      "link-hover",
      "link-active",
      "selection",
      "warning",
      "error",
      "success",
      "info",
      "border-light",
      "border-medium",
    ])
    return !exceptions.has(t)
  })

  const header = "/* Couleurs Tokens du projet */"
  const hasHeader = css.includes(header)

  if (hasProjectTokens.length === 0) {
    if (hasHeader) {
      console.error(
        "No project tokens expected, but project tokens block exists",
      )
      process.exit(1)
    }
    console.log("No project tokens present — OK")
    process.exit(0)
  }

  if (!hasHeader) {
    console.error("Project tokens present but section missing in theme.css")
    process.exit(1)
  }

  // ensure each token is emitted
  const idx = css.indexOf(header)
  const slice = css.slice(idx)
  const lines = slice.split("\n")

  const missing = []
  hasProjectTokens.forEach((t) => {
    const tokenLine = `  --${t}: `
    if (!lines.some((l) => l.trim().startsWith(tokenLine.trim())))
      missing.push(t)
  })

  if (missing.length) {
    console.error("Some project tokens not emitted:", missing.join(", "))
    process.exit(1)
  }

  console.log("Project tokens block present and contains all tokens — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
