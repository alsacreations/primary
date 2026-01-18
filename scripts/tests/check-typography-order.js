import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  const mobile = {
    name: "font-mobile.json",
    text: async () =>
      JSON.stringify({
        mode: "mobile",
        "Line-height": {
          "line-height-s": { $type: "number", $value: 20 },
          "line-height-m": { $type: "number", $value: 24 },
        },
      }),
  }
  const desktop = {
    name: "font-desktop.json",
    text: async () =>
      JSON.stringify({
        mode: "desktop",
        "Line-height": {
          "line-height-s": { $type: "number", $value: 24 },
          "line-height-m": { $type: "number", $value: 28 },
        },
      }),
  }

  const { artifacts } = await processFiles([mobile, desktop], console.log)
  const css = artifacts["theme.css"] || ""
  const start = css.indexOf("/* Typographie Tokens du projet */")
  if (start === -1) {
    console.error("Missing Typographie Tokens section")
    process.exit(1)
  }
  const block = css.slice(start, css.indexOf("\n\n", start) + 2)
  const idxS = block.indexOf("--line-height-s:")
  const idxM = block.indexOf("--line-height-m:")
  if (idxS === -1 || idxM === -1) {
    console.error("Missing expected line-height tokens in block")
    process.exit(1)
  }
  if (idxS > idxM) {
    console.error(
      "Ordering incorrect: --line-height-s appears after --line-height-m",
    )
    process.exit(1)
  }
  console.log("Order of line-height tokens is correct — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
