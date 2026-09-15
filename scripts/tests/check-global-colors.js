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
    "  --color-white: #FFFFFF;",
    "  --color-black: #000000;",
    "  --color-slate-100: #F1F5F9;",
    "  --color-slate-400: #90A1B9;",
    "  --color-slate-700: #314158;",
    "  --color-slate-900: #161F2C;",
    "  --color-gray-50: #F5F5F5;",
    "  --color-gray-100: #E5E5E5;",
    "  --color-gray-200: #D4D4D4;",
    "  --color-gray-300: #A1A1A1;",
    "  --color-gray-400: #737373;",
    "  --color-gray-500: #525252;",
    "  --color-gray-600: #404040;",
    "  --color-gray-700: #262626;",
    "  --color-gray-800: #171717;",
    "  --color-gray-900: #0A0A0A;",
    "  --color-error-100: #FFECE8;",
    "  --color-error-300: #FF675A;",
    "  --color-error-500: #B91D1C;",
    "  --color-error-700: #7C0000;",
    "  --color-error-900: #3A0000;",
    "  --color-success-100: #AAFFBF;",
    "  --color-success-300: #60BA78;",
    "  --color-success-500: #187C3E;",
    "  --color-success-700: #005013;",
    "  --color-success-900: #002401;",
    "  --color-warning-100: #FFEEDD;",
    "  --color-warning-300: #FFAE79;",
    "  --color-warning-500: #D76300;",
    "  --color-warning-700: #9D3B00;",
    "  --color-warning-900: #5F1D00;",
    "  --color-info-100: #E6F7FF;",
    "  --color-info-300: #53A2FF;",
    "  --color-info-500: #0063CB;",
    "  --color-info-700: #003498;",
    "  --color-info-900: #00134A;",
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
