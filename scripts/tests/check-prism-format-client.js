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

  const { artifacts } = await processFiles(files, console.log)
  const tokensJson = artifacts["tokens.json"]
  if (!tokensJson) {
    console.error("Missing tokens.json artifact from processFiles")
    process.exit(1)
  }
  const parsed = JSON.parse(tokensJson)
  const fontTokens = (parsed && parsed.fonts && parsed.fonts.fontSize) || {}
  const lineTokens = (parsed && parsed.fonts && parsed.fonts.lineHeight) || {}

  if (Object.keys(fontTokens).length === 0) {
    console.error("No font tokens extracted by client processFiles")
    process.exit(1)
  }
  if (Object.keys(lineTokens).length === 0) {
    console.error("No line-height tokens extracted by client processFiles")
    process.exit(1)
  }

  console.log("Client-side Prism-format import parsed correctly — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
