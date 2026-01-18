import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  // no files (simulate empty source)
  const { artifacts } = await processFiles([], console.log)
  const css = artifacts["theme.css"]
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  if (!css.includes("/* Espacements — valeurs globales (fallback) */")) {
    console.error("Missing fallback spacing header")
    process.exit(1)
  }
  if (!css.includes("--spacing-16: 1rem;")) {
    console.error("Expected fallback --spacing-16 missing")
    process.exit(1)
  }

  console.log("Spacing primitives (fallback) — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
