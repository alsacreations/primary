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
    "  /* Couleur primaire */",
    "  --primary: var(--color-gray-500);",
    "  --on-primary: var(--color-white);",
    "  --primary-lighten: oklch(from var(--primary) calc(l * 1.2) c h);",
    "  --primary-darken: oklch(from var(--primary) calc(l * 0.8) c h);",
    "",
    "  /* Couleur d'accent */",
    "  --accent: light-dark(var(--primary), var(--primary-lighten));",
    "  --accent-invert: light-dark(var(--primary-lighten), var(--primary));",
    "",
    "  /* Surface du document */",
    "  --surface: light-dark(var(--color-white), var(--color-gray-900));",
    "  --on-surface: light-dark(var(--color-gray-900), var(--color-gray-100));",
    "",
    "  /* Niveaux de profondeur */",
    "  --layer-1: light-dark(var(--color-gray-50), var(--color-gray-800));",
    "  --layer-2: light-dark(var(--color-gray-100), var(--color-gray-700));",
    "  --layer-3: light-dark(var(--color-gray-200), var(--color-gray-600));",
    "",
    "  /* Interactions */",
    "  --link: light-dark(var(--primary), var(--primary-lighten));",
    "  --link-hover: light-dark(var(--primary-darken), var(--primary));",
    "  --link-active: light-dark(var(--primary-darken), var(--primary));",
    "",
    "  /* Couleur de sélection */",
    "  --selection: light-dark(var(--primary-lighten), var(--primary-darken));",
    "",
    "  /* États d'alerte */",
    "  --warning: light-dark(var(--color-warning-500), var(--color-warning-300));",
    "  --error: light-dark(var(--color-error-500), var(--color-error-300));",
    "  --success: light-dark(var(--color-success-500), var(--color-success-300));",
    "  --info: light-dark(var(--color-info-500), var(--color-info-300));",
    "",
    "  /* Bordures */",
    "  --border-light: var(--color-gray-400);",
    "  --border-medium: var(--color-gray-600);",
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
