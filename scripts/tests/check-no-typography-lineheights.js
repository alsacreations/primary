import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  const { artifacts } = await processFiles([], () => {}, { debug: false })
  if (!artifacts || !artifacts["theme.json"]) {
    console.error("FAIL: expected theme.json to be generated")
    process.exit(1)
  }
  const themeJson = JSON.parse(artifacts["theme.json"])
  if (!themeJson.settings || !themeJson.settings.typography) {
    console.log("No typography settings present — OK")
    process.exit(0)
  }
  if (
    Object.prototype.hasOwnProperty.call(
      themeJson.settings.typography,
      "lineHeights",
    )
  ) {
    console.error(
      "FAIL: settings.typography.lineHeights must NOT be present in theme.json",
    )
    process.exit(1)
  }
  console.log("No top-level settings.typography.lineHeights — OK")
}

run().catch((e) => {
  console.error("Error during test:", e)
  process.exit(2)
})
