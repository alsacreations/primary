import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const file = {
    name: "spacing_project.json",
    text: async () =>
      JSON.stringify({
        color: {},
        Spacing: {
          16: { $type: "number", $value: 16 },
          24: { $type: "number", $value: 24 },
        },
      }),
  }

  const { artifacts } = await processFiles([file], console.log)
  const css = artifacts["theme.css"]
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  if (!css.includes("/* Espacements Primitives du projet */")) {
    console.error("Missing project spacing header")
    process.exit(1)
  }
  if (!css.includes("--spacing-16: 1rem;")) {
    console.error("Expected --spacing-16 from project primitives missing")
    process.exit(1)
  }

  // Ensure fallback header NOT present
  if (css.includes("/* Espacements — valeurs globales (fallback) */")) {
    console.error("Fallback header present unexpectedly")
    process.exit(1)
  }

  console.log("Spacing primitives (project) — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
