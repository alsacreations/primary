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
    const text = fs.readFileSync(fp, "utf8")
    return { name: f, text: async () => text }
  })

  // The feature to emit trivial spacing tokens has been removed.
  // Ensure the generation summary reports zero spacing tokens and contains no option indicator.
  const res = await processFiles(files, () => {}, {})
  const summary = res.artifacts["generation-summary.txt"]
  if (!summary) {
    console.error("Missing generation-summary.txt artifact")
    process.exit(1)
  }
  const line = summary
    .split("\n")
    .find((l) => l.includes("Espacements extraits"))
  if (!line) {
    console.error("Missing Espacements line in summary")
    console.error(summary)
    process.exit(1)
  }
  if (!/Primitives : 15 .* Tokens : 0/.test(line)) {
    console.error("Unexpected spacing counts (tokens should be 0):", line)
    process.exit(1)
  }
  if (/Inclure tokens d'espacement triviaux/.test(summary)) {
    console.error("Option indicator unexpectedly present in summary")
    process.exit(1)
  }

  console.log(
    "Generation summary reflects removal of trivial spacing option — OK",
  )
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
