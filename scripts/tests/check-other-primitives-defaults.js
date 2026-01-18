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
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  const mustHave = [
    "--transition-duration: 250ms;",
    "--z-under-page-level: -1;",
    "--z-above-page-level: 1;",
    "--z-header-level: 1000;",
    "--z-above-header-level: 2000;",
    "--z-above-all-level: 3000;",
    "--radius-4: 0.25rem;",
    "--radius-8: 0.5rem;",
    "--font-base: system-ui, sans-serif;",
    "--font-weight-regular: 400;",
  ]

  const mustHaveComments = [
    "/* Transitions et animations */",
    "/* Niveaux de z-index */",
    "/* Border radius */",
    "/* Familles de police */",
    "/* Graisses de police */",
  ]

  const missing = mustHave.filter((m) => !css.includes(m))
  const missingComments = mustHaveComments.filter((c) => !css.includes(c))

  if (missing.length || missingComments.length) {
    console.error("Missing defaults or comment sections in other primitives:", {
      missing,
      missingComments,
    })
    process.exit(1)
  }

  console.log("Other primitives defaults present — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
