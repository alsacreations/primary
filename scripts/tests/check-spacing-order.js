import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const file = {
    name: "spacing_order.json",
    text: async () =>
      JSON.stringify({
        color: {},
        Spacing: {
          32: { $type: "number", $value: 32 },
          8: { $type: "number", $value: 8 },
          16: { $type: "number", $value: 16 },
          2: { $type: "number", $value: 2 },
          48: { $type: "number", $value: 48 },
        },
      }),
  }

  const { artifacts } = await processFiles([file], console.log)
  const css = artifacts["theme.css"]
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  const m = css.match(
    /\/\* Espacements Primitives du projet \*\/[\s\S]*?(?=\n\n)/,
  )
  if (!m) {
    console.error("Could not find spacing section")
    process.exit(1)
  }
  const section = m[0]
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("--spacing-"))
    .map((l) => l.replace(/:.*$/, ""))

  const expected = [
    "--spacing-2",
    "--spacing-8",
    "--spacing-16",
    "--spacing-32",
    "--spacing-48",
  ]
  for (let i = 0; i < expected.length; i++) {
    if (lines[i] !== expected[i]) {
      console.error("Spacing order incorrect", { expected, got: lines })
      process.exit(1)
    }
  }

  console.log("Spacing primitives order — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
