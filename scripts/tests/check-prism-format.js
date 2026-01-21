import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { extractFonts } from "../extract/fonts.js"

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, "utf8"))
}

async function run() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const dir = path.resolve(path.join(__dirname, "..", "..", "tmp-prism"))
  const files = [
    "Desktop.tokens.json",
    "Mobile.tokens.json",
    "Mode 1.tokens.json",
  ].map((f) => {
    const fp = path.join(dir, f)
    if (!fs.existsSync(fp)) {
      console.error("Missing test fixture:", fp)
      process.exit(1)
    }
    const json = readJson(fp)
    const rawMode =
      (json && json.$extensions && json.$extensions["com.figma.modeName"]) ||
      json.mode ||
      null
    let modeName = null
    if (rawMode) {
      const lower = String(rawMode).toLowerCase()
      if (["light", "dark", "mobile", "desktop"].includes(lower))
        modeName = lower
    }
    return { filePath: fp, json, modeName }
  })

  const res = extractFonts(files)
  // Expect some font primitives and tokens to be present
  const primKeys = Object.keys(res.primitives || {})
  const tokenFontKeys = Object.keys((res.json && res.json.fontSize) || {})
  const tokenLineKeys = Object.keys((res.json && res.json.lineHeight) || {})

  if (!primKeys.some((k) => k.startsWith("--text-"))) {
    console.error("No text primitives found")
    process.exit(1)
  }
  if (tokenFontKeys.length === 0) {
    console.error("No font tokens found")
    process.exit(1)
  }
  if (tokenLineKeys.length === 0) {
    console.error("No line-height tokens found")
    process.exit(1)
  }

  console.log("Prism-format fixture parsed correctly — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
