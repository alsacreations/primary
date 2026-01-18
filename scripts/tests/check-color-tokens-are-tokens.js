import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const file = {
    name: "colors_only.json",
    text: async () =>
      JSON.stringify({
        color: {
          "brand-100": { $type: "color", $value: { hex: "#fafafa" } },
          "brand-500": { $type: "color", $value: { hex: "#123456" } },
        },
      }),
  }

  const { artifacts } = await processFiles([file], console.log)
  const tokens = JSON.parse(artifacts["tokens.json"] || "{}")
  const colors = tokens.colors || {}

  if (Object.keys(colors).length !== 0) {
    console.error(
      "tokens.json.colors must be empty for primitives-only input",
      {
        got: Object.keys(colors),
      },
    )
    process.exit(1)
  }

  const css = artifacts["theme.css"] || ""
  if (css.includes("/* Couleurs Tokens du projet */")) {
    console.error(
      "Theme CSS must not contain Couleurs Tokens du projet section for primitives-only input",
    )
    process.exit(1)
  }

  console.log("Color tokens only present when true tokens exist — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
