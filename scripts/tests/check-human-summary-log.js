import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  const { artifacts, logs } = await processFiles([], () => {}, { debug: false })
  // We expect a human summary to be present in logs
  const found = logs.find(
    (l) => typeof l === "string" && l.includes("Résumé de génération"),
  )
  if (!found) {
    console.error("FAIL: human summary log not found in logs")
    process.exit(1)
  }

  const requiredLines = [
    "Fichiers traités",
    "Couleurs extraites",
    "Espacements extraits",
    "Typographies extraites",
    "Fichiers générés",
  ]
  const missing = requiredLines.filter((r) => !found.includes(r))
  if (missing.length) {
    console.error("FAIL: human summary missing lines:", missing)
    console.error(found)
    process.exit(1)
  }

  console.log("Human summary log — OK")
}

run().catch((e) => {
  console.error("Error during test:", e)
  process.exit(2)
})
