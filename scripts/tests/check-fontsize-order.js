import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const file = {
    name: "fontsize_order.json",
    text: async () =>
      JSON.stringify({
        color: {},
        FontSize: {
          18: { $type: "number", $value: 18 },
          12: { $type: "number", $value: 12 },
          16: { $type: "number", $value: 16 },
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
    /\/\* Typographie Primitives du projet \*\/[\s\S]*?(?=\n\n)/,
  )
  if (!m) {
    console.error("Could not find typography primitives section")
    process.exit(1)
  }
  const section = m[0]
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("--text-"))
    .map((l) => l.replace(/:.*$/, ""))

  const expected = ["--text-12", "--text-16", "--text-18"]
  for (let i = 0; i < expected.length; i++) {
    if (lines[i] !== expected[i]) {
      console.error("Font-size order incorrect", { expected, got: lines })
      process.exit(1)
    }
  }

  console.log("Font-size primitives order — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
