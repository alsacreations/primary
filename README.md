# figmatocss

Small, modular CLI to convert Figma Mode JSON exports into CSS variables and artifacts.

Usage:

1. Place one or more Mode JSON files (export from Figma) into the `source/` folder.
2. Run:

```bash
# node exec (generate CSS + primitives)
node scripts/figmatocss.js <source-dir> <out-dir>
# example
node scripts/figmatocss.js source dist

# generate theme.json from dist
node scripts/generateThemeJson.js --in dist

# or with npm scripts (recommended)
# prefer using npm run scripts with `--` to pass args to the CLI
npm run figmatocss -- -- <src> <out>        # deprecated; use figmatocss:run
npm run figmatocss:run -- <src> <out>      # recommended (explicit runner)
npm run wp-theme   # generate theme.json from dist
npm run build      # run figmatocss then generateThemeJson (recommended)
```

Output:

- `dist/theme.css` — generated CSS
- `dist/primitives.json` — extracted primitives (colors)
- `dist/tokens.json` — resolved tokens (colors, spacing, fonts)

Modules:

- `scripts/extract/colors.js`
- `scripts/extract/spacing.js`
- `scripts/extract/fonts.js`
- `scripts/utils.js`

Notes:

- This tool expects Mode JSON exports from Figma (see `instructions.md`).
- The generator handles color primitives, spacing and basic font sizes/line-heights. Light/dark pairing and mobile/desktop clamps are supported in basic form.

Fallback primitives when `source/` is empty:

- When no Mode JSON files are present in `source/`, the CLI injects a minimal set of **global fallback primitives** so `theme.css` and `theme.json` can be produced without missing‑reference warnings. These fallbacks include:
  - Colors: `--color-white`, `--color-black`, `--color-gray-*` (50..900), `--color-error-*`, `--color-success-*`, `--color-warning-*`, `--color-info-*`.
  - Spacing primitives: `--spacing-0`, `--spacing-2`, `--spacing-4`, `--spacing-8`, `--spacing-12`, `--spacing-16`, `--spacing-24`, `--spacing-32`, `--spacing-48`.
  - Font sizes: `--text-14`, `--text-16`, `--text-18`, `--text-20`, `--text-24`, `--text-30`, `--text-48`.
  - Border radii: `--radius-none`, `--radius-4`, `--radius-8`, `--radius-12`, `--radius-16`, `--radius-24`, `--radius-full`.
  - Other: `--font-base` (system default), `--font-weight-regular`.

  These values are **fallbacks** only — any primitives present in `source/` override them.
