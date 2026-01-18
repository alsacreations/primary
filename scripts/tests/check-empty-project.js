import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  const { artifacts, logs } = await processFiles([], () => {}, { debug: false })
  if (!artifacts || !artifacts["theme.css"]) {
    console.error("FAIL: expected theme.css to be generated")
    process.exit(1)
  }
  const css = artifacts["theme.css"]
  const required = [
    "--color-white",
    "--color-black",
    "--color-gray-500",
    "--spacing-16",
    "--text-16",
    "--text-24",
    "--radius-16",
    "--font-base",
    "--color-error-500",
  ]
  const missing = required.filter((r) => !css.includes(r))
  if (missing.length) {
    console.error(
      "FAIL: fallback primitives missing in generated theme.css:",
      missing,
    )
    console.error(css)
    process.exit(1)
  }
  console.log("Empty project generation — OK")
}

run().catch((e) => {
  console.error("Error during test:", e)
  process.exit(2)
})
