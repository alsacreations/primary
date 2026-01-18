import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const file = {
    name: "fonts_only.json",
    text: async () =>
      JSON.stringify({
        FontSize: {
          14: { $type: "number", $value: 14 },
          16: { $type: "number", $value: 16 },
        },
        "Line-height": {
          20: { $type: "number", $value: 20 },
        },
      }),
  }

  const { artifacts } = await processFiles([file], console.log)
  const tokens = JSON.parse(artifacts["tokens.json"] || "{}")
  const fonts = tokens.fonts || {}
  const fsTokens = (fonts.fontSize && Object.keys(fonts.fontSize)) || []
  const lhTokens = (fonts.lineHeight && Object.keys(fonts.lineHeight)) || []

  if (fsTokens.length || lhTokens.length) {
    console.error("tokens.json.fonts must be empty for primitives-only input", {
      fontSize: fsTokens,
      lineHeight: lhTokens,
    })
    process.exit(1)
  }

  const css = artifacts["theme.css"] || ""
  if (css.includes("/* Typographie Tokens du projet */")) {
    console.error(
      "Theme CSS must not contain Typographie Tokens section for primitives-only input",
    )
    process.exit(1)
  }

  console.log("Typography tokens only present when true tokens exist — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
