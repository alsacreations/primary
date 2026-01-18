import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  const combined = {
    name: "tokens-combined.json",
    text: async () =>
      JSON.stringify({
        fonts: {
          fontSize: {
            "text-m": {
              value: "var(--text-m)",
              modes: { desktop: 18, mobile: 16 },
            },
          },
          lineHeight: {
            "line-height-m": {
              value: "var(--line-height-m)",
              modes: { desktop: 28, mobile: 24 },
            },
            "line-height-s": {
              value: "var(--line-height-s)",
              modes: { desktop: 24, mobile: 20 },
            },
          },
        },
      }),
  }

  const { artifacts } = await processFiles([combined], console.log)
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
      "Ordering incorrect for combined file: --line-height-s appears after --line-height-m",
    )
    process.exit(1)
  }
  console.log("Order of line-height tokens for combined file is correct — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
