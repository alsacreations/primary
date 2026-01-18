import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  const { artifacts } = await processFiles([], () => {}, { debug: false })
  if (!artifacts || !artifacts["theme.json"]) {
    console.error("FAIL: expected theme.json to be generated")
    process.exit(1)
  }
  const themeJson = JSON.parse(artifacts["theme.json"])
  if (!themeJson.settings) {
    console.error("FAIL: theme.json.settings missing")
    process.exit(1)
  }
  if (themeJson.settings.appearanceTools !== true) {
    console.error("FAIL: settings.appearanceTools must be true")
    process.exit(1)
  }
  if (themeJson.settings.useRootPaddingAwareAlignments !== true) {
    console.error("FAIL: settings.useRootPaddingAwareAlignments must be true")
    process.exit(1)
  }
  const color = themeJson.settings.color
  if (!color) {
    console.error("FAIL: settings.color missing")
    process.exit(1)
  }
  if (
    color.defaultDuotone !== false ||
    color.defaultGradients !== false ||
    color.defaultPalette !== false
  ) {
    console.error("FAIL: color defaults must be present and falsy by default")
    process.exit(1)
  }

  console.log("Theme settings flags — OK")
}

run().catch((e) => {
  console.error("Error during test:", e)
  process.exit(2)
})
