import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const file = {
    name: "primitives_others.json",
    text: async () =>
      JSON.stringify({
        color: {},
        // provide overrides for some 'other' primitives
        "transition-duration": { $type: "string", $value: "300ms" },
        "z-header-level": { $type: "number", $value: 900 },
        "font-base": { $type: "string", $value: "Poppins, sans-serif" },
      }),
  }

  const { artifacts } = await processFiles([file], console.log)
  const css = artifacts["theme.css"]
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  if (!css.includes("--transition-duration: 300ms;")) {
    console.error("transition-duration not replaced as expected")
    process.exit(1)
  }
  if (!css.includes("--z-header-level: 900;")) {
    console.error("z-header-level not replaced as expected")
    process.exit(1)
  }
  if (!css.includes("--font-base: Poppins, sans-serif;")) {
    console.error("font-base not replaced as expected")
    process.exit(1)
  }

  const mustHaveComments = [
    "/* Transitions et animations */",
    "/* Niveaux de z-index */",
    "/* Border radius */",
    "/* Familles de police */",
    "/* Graisses de police */",
  ]
  const missingComments = mustHaveComments.filter((c) => !css.includes(c))
  if (missingComments.length) {
    console.error(
      "Missing comment headers in other primitives:",
      missingComments,
    )
    process.exit(1)
  }

  console.log("Other primitives replacements work — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
