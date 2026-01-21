import { processFiles } from "../../assets/js/client-utils.mjs"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

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
    const text = fs.readFileSync(fp, "utf8")
    return { name: f, text: async () => text }
  })

  const { artifacts } = await processFiles(files, console.log, { debug: false })
  const primitivesStr = artifacts["primitives.json"]
  if (!primitivesStr) {
    console.error("Missing primitives.json artifact from processFiles")
    process.exit(1)
  }
  const primitives = JSON.parse(primitivesStr)
  const colorKeys = Object.keys(primitives.color || {})
  const expected = ["gray-50", "blue-500", "yellow-500", "pink-500"]
  const missing = expected.filter((k) => !colorKeys.includes(k))
  if (missing.length) {
    console.error(
      "Missing expected color primitives in client primitives.json:",
      missing,
    )
    process.exit(1)
  }

  // also verify theme.css includes at least one of these vars
  const css = artifacts["theme.css"] || ""
  if (
    !css.includes("--color-blue-500") ||
    !css.includes("--color-yellow-500")
  ) {
    console.error("theme.css missing expected color variables")
    process.exit(1)
  }

  console.log("Client-side color extraction for Prism fixtures — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
