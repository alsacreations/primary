const fs = require("fs")
const path = require("path")

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { emitSpacingTokenLines } = mod

  // Prepare normalized tokens with mobile/desktop modes
  const normalized = {
    "spacing-l": {
      type: "number",
      modes: { mobile: "var(--spacing-24)", desktop: "var(--spacing-48)" },
    },
  }
  const structuredPrimitives = {
    spacing: {
      "spacing-24": { $type: "number", value: "1.5rem" },
      "spacing-48": { $type: "number", value: "3rem" },
    },
  }

  const lines = emitSpacingTokenLines(normalized, structuredPrimitives)
  if (!lines.length) {
    console.error("No token lines generated")
    process.exit(1)
  }
  const line = lines.find((l) => l.startsWith("--spacing-l:"))
  if (!line) {
    console.error("Expected --spacing-l token missing")
    process.exit(1)
  }

  if (!line.includes("clamp(") && !line.includes("light-dark(")) {
    console.error("Expected clamp() for mobile/desktop token", line)
    process.exit(1)
  }

  if (!/\/\*\s*24px\s*\/\s*48px\s*\*\//.test(line)) {
    console.error("Expected px comment '24px / 48px' on line", line)
    process.exit(1)
  }

  console.log("Spacing tokens (project mobile/desktop) — OK")
  process.exit(0)
}

try {
  run()
} catch (err) {
  console.error(err)
  process.exit(2)
}
