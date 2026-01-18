import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  const file = { name: "empty.json", text: async () => JSON.stringify({}) }

  // Ensure logger is not called when debug=false
  let called = false
  const spyLogger = () => {
    called = true
  }
  const r1 = await processFiles([file], spyLogger, { debug: false })
  if (!r1 || !Array.isArray(r1.logs)) {
    console.error("Missing logs array in result")
    process.exit(2)
  }
  if (called) {
    console.error("FAIL: logger should NOT be called when debug=false")
    process.exit(1)
  }

  // When debug is true, logger should be invoked and logs should be present
  called = false
  const r2 = await processFiles([file], spyLogger, { debug: true })
  if (!r2 || !Array.isArray(r2.logs)) {
    console.error("Missing logs array in result (debug)")
    process.exit(2)
  }
  if (!called) {
    console.error("FAIL: logger should be called when debug=true")
    process.exit(1)
  }
  if (r2.logs.length === 0) {
    console.error("FAIL: logs should be present when debug=true")
    process.exit(1)
  }

  console.log("Logs hidden by default — OK")
}

run().catch((e) => {
  console.error("Error during test:", e)
  process.exit(2)
})
