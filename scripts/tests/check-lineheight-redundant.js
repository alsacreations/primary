import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  // token where mobile === desktop numeric
  const mobile = {
    name: "font-mobile.json",
    text: async () =>
      JSON.stringify({
        mode: "mobile",
        "Line-height": { "line-height-14": { $type: "number", $value: 18 } },
      }),
  }
  const desktop = {
    name: "font-desktop.json",
    text: async () =>
      JSON.stringify({
        mode: "desktop",
        "Line-height": { "line-height-14": { $type: "number", $value: 18 } },
      }),
  }

  const { artifacts, logs } = await processFiles([mobile, desktop], console.log)
  const css = artifacts["theme.css"] || ""

  // The token should have been converted to a primitive, not emitted as clamp
  if (css.includes("--line-height-14: clamp(")) {
    console.error(
      "line-height-14 should not be emitted as clamp when mobile===desktop",
    )
    process.exit(1)
  }

  // It should appear in Typographie Primitives or project primitives
  if (!css.includes("--line-height-14:")) {
    console.error("line-height-14 primitive not found")
    process.exit(1)
  }

  // Check warning emitted
  if (!logs.some((l) => l && l.includes("redundant-token"))) {
    console.error("Expected redundant-token warning")
    process.exit(1)
  }

  console.log("Line-height redundant token handling — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
