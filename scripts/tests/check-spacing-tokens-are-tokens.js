import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const file = {
    name: "spacing_only.json",
    text: async () =>
      JSON.stringify({
        Spacing: {
          0: { $type: "number", $value: 0 },
          16: { $type: "number", $value: 16 },
          32: { $type: "number", $value: 32 },
        },
      }),
  }

  const { artifacts } = await processFiles([file], console.log)
  const tokens = JSON.parse(artifacts["tokens.json"] || "{}")
  const spacing = tokens.spacing || {}

  if (Object.keys(spacing).length !== 0) {
    console.error(
      "tokens.json.spacing must be empty for primitives-only input",
      {
        got: Object.keys(spacing),
      },
    )
    process.exit(1)
  }

  const css = artifacts["theme.css"] || ""
  if (css.includes("/* Espacements Tokens du projet */")) {
    console.error(
      "Theme CSS must not contain Espacements Tokens section for primitives-only input",
    )
    process.exit(1)
  }

  console.log("Spacing tokens only present when true tokens exist — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
