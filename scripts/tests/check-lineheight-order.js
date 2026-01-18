import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const file = {
    name: "lineheight_order.json",
    text: async () =>
      JSON.stringify({
        color: {},
        "Line-height": {
          20: { $type: "number", $value: 20 },
          14: { $type: "number", $value: 14 },
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
    .filter((l) => l.startsWith("--line-height-"))
    .map((l) => l.replace(/:.*$/, ""))

  const expected = ["--line-height-14", "--line-height-20", "--line-height-24"]
  for (let i = 0; i < expected.length; i++) {
    if (lines[i] !== expected[i]) {
      console.error("Line-height order incorrect", { expected, got: lines })
      process.exit(1)
    }
  }

  console.log("Line-height primitives order — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
