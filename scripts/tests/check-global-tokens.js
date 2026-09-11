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

  const { artifacts } = await processFiles([file], console.log)
  const css = artifacts["theme.css"]
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  const start = css.indexOf("/* Couleurs Tokens globales */")
  if (start === -1) {
    console.error("Global tokens block not found")
    process.exit(1)
  }

  const slice = css.slice(start)
  const lines = slice.split("\n").map((l) => l.replace(/\s+$/, ""))

  const expected = [
    "  /* Couleurs Tokens globales */",
    "  /* Couleurs d'accent */",
    "  --accent-1: var(--color-gray-500);",
    "  --accent-2: var(--accent-1);",
    "  --accent-3: color-mix(in srgb, var(--accent-1), white 20%);",
    "",
    "  /* Base */",
    "  --base: var(--color-white);",
    "  --contrast: var(--color-gray-900);",
    "  --base-2: var(--color-gray-50);",
    "  --base-3: var(--color-gray-100);",
    "",
    "  /* Interactions */",
    "  --link: var(--accent-1);",
    "  --link-hover: color-mix(in srgb, var(--accent-1), black 20%);",
    "  --link-active: color-mix(in srgb, var(--accent-1), black 20%);",
    "",
    "  /* Couleur de sélection */",
    "  --selection: color-mix(in srgb, var(--accent-1), white 20%);",
    "",
    "  /* États d'alerte */",
    "  --warning: var(--color-warning-500);",
    "  --error: var(--color-error-500);",
    "  --success: var(--color-success-500);",
    "  --info: var(--color-info-500);",
  ]

  const actual = lines.slice(0, expected.length)
  const diffs = []
  expected.forEach((exp, i) => {
    const act = actual[i] ?? ""
    if (act.trim() !== exp.trim())
      diffs.push({ index: i + 1, expected: exp, actual: act })
  })

  if (diffs.length) {
    console.error("Global tokens mismatch:")
    diffs.forEach((d) =>
      console.error(
        `line ${d.index}: expected: "${d.expected}", actual: "${d.actual}"`,
      ),
    )
    process.exit(1)
  }

  console.log("Global tokens block matches the expected exact content — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
