import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  // Primitives
  const mobile = {
    name: "font-mobile.json",
    text: async () =>
      JSON.stringify({
        mode: "mobile",
        FontSize: {
          "text-s": { $type: "number", $value: 16 },
        },
      }),
  }

  const desktop = {
    name: "font-desktop.json",
    text: async () =>
      JSON.stringify({
        mode: "desktop",
        FontSize: {
          "text-s": { $type: "number", $value: 16 },
        },
      }),
  }

  const { artifacts } = await processFiles([mobile, desktop], console.log)
  const css = artifacts["theme.css"] || ""

  const textSLine = css.split("\n").find((l) => l.includes("--text-s:"))

  if (!textSLine) {
    console.error("FAIL: --text-s token line missing")
    console.error("Full CSS:", css)
    process.exit(1)
  }

  console.log("Verified line:", textSLine)

  if (textSLine.includes("clamp(")) {
    console.error(
      "FAIL: --text-s should NOT use clamp() when mobile and desktop values are identical",
    )
    console.error("Actual:", textSLine)
    process.exit(1)
  }

  console.log(
    "SUCCESS: No redundant clamp() generated for identical typography values",
  )
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
