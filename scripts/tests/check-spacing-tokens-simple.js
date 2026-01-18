const fs = require("fs")
const path = require("path")

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { emitSpacingTokenLines } = mod

  const normalized = {
    "spacing-m": { type: "number", value: "var(--spacing-16)" },
  }
  const structuredPrimitives = {
    spacing: {
      "spacing-16": { $type: "number", value: "1rem" },
    },
  }

  const lines = emitSpacingTokenLines(normalized, structuredPrimitives)
  const line = lines.find((l) => l.startsWith("--spacing-m:"))
  if (!line) {
    console.error("Expected --spacing-m token missing")
    process.exit(1)
  }
  if (!/\/\*\s*16px\s*\*\//.test(line)) {
    console.error("Expected px comment '16px' on line", line)
    process.exit(1)
  }

  console.log("Spacing tokens (simple) — OK")
  process.exit(0)
}

try {
  run()
} catch (err) {
  console.error(err)
  process.exit(2)
}
