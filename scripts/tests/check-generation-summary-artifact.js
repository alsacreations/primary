import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  const { artifacts, logs } = await processFiles([], () => {}, { debug: false })
  if (!artifacts || !artifacts["generation-summary.txt"]) {
    console.error(
      "FAIL: expected generation-summary.txt artifact to be present",
    )
    process.exit(1)
  }
  const summary = artifacts["generation-summary.txt"]
  if (
    typeof summary !== "string" ||
    !summary.includes("Résumé de génération")
  ) {
    console.error(
      "FAIL: generation-summary.txt malformed or missing expected content",
    )
    console.error(summary)
    process.exit(1)
  }

  console.log("Generation summary artifact — OK")
}

run().catch((e) => {
  console.error("Error during test:", e)
  process.exit(2)
})
