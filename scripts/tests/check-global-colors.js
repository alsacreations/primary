import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod
  const primitivesPath = path.resolve(process.cwd(), "dist", "primitives.json")
  if (!fs.existsSync(primitivesPath)) {
    console.error("primitives.json not found in dist/. Run build first.")
    process.exit(2)
  }

  const file = {
    name: "primitives.json",
    text: async () => fs.promises.readFile(primitivesPath, "utf8"),
  }

  const { artifacts, logs } = await processFiles([file], console.log)
  const css = artifacts["theme.css"]
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  const globalBlockStart = css.indexOf("/* Couleurs Primitives globales */")
  if (globalBlockStart === -1) {
    console.error("Global colors block not found")
    process.exit(1)
  }

  const after = css.slice(globalBlockStart)
  const lines = after.split("\n")
  const expected = [
    "  /* Couleurs Primitives globales */",
    "  --color-white: oklch(1 0 0);",
    "  --color-black: oklch(0 0 0);",
    "  --color-gray-50: oklch(0.97 0 0);",
    "  --color-gray-100: oklch(0.922 0 0);",
    "  --color-gray-200: oklch(0.87 0 0);",
    "  --color-gray-300: oklch(0.708 0 0);",
    "  --color-gray-400: oklch(0.556 0 0);",
    "  --color-gray-500: oklch(0.439 0 0);",
    "  --color-gray-600: oklch(0.371 0 0);",
    "  --color-gray-700: oklch(0.269 0 0);",
    "  --color-gray-800: oklch(0.205 0 0);",
    "  --color-gray-900: oklch(0.145 0 0);",
    "  --color-error-100: oklch(0.97 0.1 27.52);",
    "  --color-error-300: oklch(0.7054 0.19 27.52);",
    "  --color-error-500: oklch(0.5054 0.19 27.52);",
    "  --color-error-700: oklch(0.3554 0.19 27.52);",
    "  --color-error-900: oklch(0.2054 0.11 27.52);",
    "  --color-success-100: oklch(0.9446 0.13 150.685);",
    "  --color-success-300: oklch(0.7166 0.13 150.73);",
    "  --color-success-500: oklch(0.5166 0.13 150.73);",
    "  --color-success-700: oklch(0.3666 0.13 150.73);",
    "  --color-success-900: oklch(0.2166 0.13 150.73);",
    "  --color-warning-100: oklch(0.97 0.08 49.95);",
    "  --color-warning-300: oklch(0.8315 0.17 49.95);",
    "  --color-warning-500: oklch(0.6315 0.17 49.95);",
    "  --color-warning-700: oklch(0.4815 0.17 49.95);",
    "  --color-warning-900: oklch(0.3315 0.11 49.95);",
    "  --color-info-100: oklch(0.97 0.09 256.37);",
    "  --color-info-300: oklch(0.7133 0.18 256.37);",
    "  --color-info-500: oklch(0.5133 0.18 256.37);",
    "  --color-info-700: oklch(0.3633 0.18 256.37);",
    "  --color-info-900: oklch(0.2133 0.11 256.37);",
  ]

  // Compare expected to actual block lines
  const actual = lines.slice(0, expected.length)

  const diffs = []
  expected.forEach((exp, i) => {
    const act = String(actual[i] ?? "")
    if (act.trim() !== exp.trim())
      diffs.push({ index: i, expected: exp, actual: act })
  })

  if (diffs.length) {
    console.error("Global colors mismatch:")
    diffs.forEach((d) =>
      console.error(
        `line ${d.index + 1}: expected: "${d.expected}", actual: "${d.actual}"`,
      ),
    )
    process.exit(1)
  }

  console.log("Global colors list matches expected exact list — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
