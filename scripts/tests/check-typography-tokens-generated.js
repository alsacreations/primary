import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const mobile = {
    name: "font-mobile.json",
    text: async () =>
      JSON.stringify({
        mode: "mobile",
        FontSize: { m: { $type: "number", $value: 16 } },
        "Line-height": { m: { $type: "number", $value: 20 } },
      }),
  }

  const desktop = {
    name: "font-desktop.json",
    text: async () =>
      JSON.stringify({
        mode: "desktop",
        FontSize: { m: { $type: "number", $value: 18 } },
        "Line-height": { m: { $type: "number", $value: 24 } },
      }),
  }

  const { artifacts } = await processFiles([mobile, desktop], console.log)
  const css = artifacts["theme.css"] || ""
  if (!css.includes("/* Typographie Tokens du projet */")) {
    console.error("Typographie Tokens section missing")
    process.exit(1)
  }

  const tokensStart = css.indexOf("/* Typographie Tokens du projet */")
  const idx =
    tokensStart >= 0
      ? css.indexOf("--text-m:", tokensStart)
      : css.indexOf("--text-m:")
  if (idx === -1) {
    console.error("--text-m token line missing")
    process.exit(1)
  }
  const line = css.slice(idx, css.indexOf("\n", idx))
  if (!line.includes("clamp(") || !line.includes("vw")) {
    console.error("--text-m token not emitted as fluid clamp:", line)
    process.exit(1)
  }

  // If numeric primitives exist for mobile and desktop, ensure they are referenced
  const hasMobilePrimitive = css.includes("--text-16:")
  const hasDesktopPrimitive = css.includes("--text-18:")
  if (hasMobilePrimitive && hasDesktopPrimitive) {
    if (
      !/clamp\(\s*var\(--text-16\)/.test(line) ||
      !/var\(--text-18\)\s*\)/.test(line)
    ) {
      console.error(
        "--text-m clamp does not reference the numeric primitives on both ends:",
        line,
      )
      process.exit(1)
    }
  }

  console.log("Typography tokens generated with fluid clamps — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
