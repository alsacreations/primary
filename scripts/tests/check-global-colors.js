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
    "  --color-white: #ffffff;",
    "  --color-black: #000000;",
    "  --color-slate-100: #f1f5f9;",
    "  --color-slate-400: #90a1b9;",
    "  --color-slate-700: #314158;",
    "  --color-slate-900: #161f2c;",
    "  --color-gray-50: #f5f5f5;",
    "  --color-gray-100: #e5e5e5;",
    "  --color-gray-200: #d4d4d4;",
    "  --color-gray-300: #a1a1a1;",
    "  --color-gray-400: #737373;",
    "  --color-gray-500: #525252;",
    "  --color-gray-600: #404040;",
    "  --color-gray-700: #262626;",
    "  --color-gray-800: #171717;",
    "  --color-gray-900: #0a0a0a;",
    "  --color-error-100: #ffece8;",
    "  --color-error-300: #ff675a;",
    "  --color-error-500: #b91d1c;",
    "  --color-error-700: #7c0000;",
    "  --color-error-900: #3a0000;",
    "  --color-success-100: #aaffbf;",
    "  --color-success-300: #60ba78;",
    "  --color-success-500: #187c3e;",
    "  --color-success-700: #005013;",
    "  --color-success-900: #002401;",
    "  --color-warning-100: #ffeedd;",
    "  --color-warning-300: #ffae79;",
    "  --color-warning-500: #d76300;",
    "  --color-warning-700: #9d3b00;",
    "  --color-warning-900: #5f1d00;",
    "  --color-info-100: #e6f7ff;",
    "  --color-info-300: #53a2ff;",
    "  --color-info-500: #0063cb;",
    "  --color-info-700: #003498;",
    "  --color-info-900: #00134a;",
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
