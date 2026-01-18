import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const light = {
    name: "light.json",
    text: async () =>
      JSON.stringify({
        mode: "light",
        color: {
          primary: {
            $type: "color",
            $value: { hex: "#112233" },
            $extensions: { "com.figma.isOverride": true },
          },
        },
      }),
  }

  const dark = {
    name: "dark.json",
    text: async () =>
      JSON.stringify({
        mode: "dark",
        color: {
          primary: {
            $type: "color",
            $value: { hex: "#445566" },
            $extensions: { "com.figma.isOverride": true },
          },
        },
      }),
  }

  const { artifacts, logs } = await processFiles([light, dark], console.log)
  const css = artifacts["theme.css"]
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  // Expect primary to be replaced by a light-dark expression using the provided hex values
  const start = css.indexOf("--primary:")
  if (start === -1) {
    console.error("No --primary line found in theme.css")
    process.exit(1)
  }
  const line = css.slice(start, css.indexOf("\n", start))
  if (!line.includes("light-dark(") || !line.includes("#112233")) {
    console.error("Primary line not formatted as expected:", line)
    process.exit(1)
  }
  // Dark side can be direct hex or var reference to project primitive
  if (!line.includes("#445566") && !line.includes("var(--color-primary)")) {
    console.error("Primary dark value not found in primary line:", line)
    process.exit(1)
  }

  console.log("Global primary token replaced correctly — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
