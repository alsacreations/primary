import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  // Use the same minimal mobile/desktop font files as other test
  const mobile = {
    name: "font-mobile.json",
    text: async () =>
      JSON.stringify({
        mode: "mobile",
        FontSize: { m: { $type: "number", $value: 16 } },
        "Line-height": { m: { $type: "number", $value: 20 } },
      }),
  }

  const desktop = {
    name: "font-desktop.json",
    text: async () =>
      JSON.stringify({
        mode: "desktop",
        FontSize: { m: { $type: "number", $value: 18 } },
        "Line-height": { m: { $type: "number", $value: 24 } },
      }),
  }

  const { artifacts } = await processFiles([mobile, desktop], console.log)
  const css = artifacts["theme.css"] || ""

  const tokensStart = css.indexOf("/* Typographie Tokens du projet */")
  if (tokensStart === -1) {
    console.error("Missing Typographie Tokens section")
    process.exit(1)
  }
  const tokensBlock = css.slice(
    tokensStart,
    css.indexOf("\n\n", tokensStart) + 2,
  )
  const lines = tokensBlock
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  // Check for self-referential clamps: --name: clamp(var(--name), ...)
  const selfRef = lines.find((l) => {
    const m = l.match(/^--([a-z0-9-]+):\s*clamp\(\s*var\(--([a-z0-9-]+)\)/i)
    return m && m[1] === m[2]
  })
  if (selfRef) {
    console.error("Found self-referential typography token:", selfRef)
    process.exit(1)
  }

  // Check for token endpoints referencing other tokens (var(--token)) rather than primitives or rem numbers
  const badEndpoint = lines.find((l) => {
    const m = l.match(
      /^--([a-z0-9-]+):\s*clamp\(\s*([^,]+),\s*([^,]+),\s*([^\)]+)\)/i,
    )
    if (!m) return false
    const left = m[2].trim()
    const right = m[4].trim()
    // left/right acceptable if either rem/px values or var(--<primitive-name>) where primitive is a numeric primitive (contains a digit)
    const leftIsVar = /^var\(--[a-z0-9-]+\)$/.test(left)
    const rightIsVar = /^var\(--[a-z0-9-]+\)$/.test(right)
    if (leftIsVar) {
      const name = left.match(/var\(--([a-z0-9-]+)\)/)[1]
      if (!/\d/.test(name)) return true
    }
    if (rightIsVar) {
      const name = right.match(/var\(--([a-z0-9-]+)\)/)[1]
      if (!/\d/.test(name)) return true
    }
    return false
  })
  if (badEndpoint) {
    console.error(
      "Found typography token with token endpoints (should reference primitives):",
      badEndpoint,
    )
    process.exit(1)
  }

  console.log("No self-ref or token-endpoint typography tokens — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
