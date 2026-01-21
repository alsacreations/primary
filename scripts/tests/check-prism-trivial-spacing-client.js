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

  // The feature to emit trivial spacing tokens has been removed from the UI/API.
  // Ensure tokens.json contains no spacing tokens by default.
  const res = await processFiles(files, console.log, {})
  const parsed = JSON.parse(res.artifacts["tokens.json"])
  if (parsed && parsed.spacing && Object.keys(parsed.spacing).length > 0) {
    console.error("FAIL: trivial spacing tokens present (feature removed)")
    process.exit(1)
  }

  console.log("Trivial spacing tokens are not emitted — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
