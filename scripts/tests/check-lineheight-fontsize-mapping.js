import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  // Case 1: matching line-height tokens are present in the Figma export —
  // theme.json must reference var(--line-height-*) alongside var(--text-*).
  const withLineHeights = {
    name: "tokens-with-lineheights.json",
    text: async () =>
      JSON.stringify({
        fonts: {
          fontSize: {
            "text-m": { value: "var(--text-m)", modes: { desktop: 16, mobile: 16 } },
            "text-xl": { value: "var(--text-xl)", modes: { desktop: 20, mobile: 20 } },
            "text-xxl": { value: "var(--text-xxl)", modes: { desktop: 24, mobile: 24 } },
          },
          lineHeight: {
            "line-height-m": { value: "var(--line-height-m)", modes: { desktop: 22, mobile: 22 } },
            "line-height-xl": { value: "var(--line-height-xl)", modes: { desktop: 26, mobile: 26 } },
            "line-height-xxl": { value: "var(--line-height-xxl)", modes: { desktop: 30, mobile: 30 } },
          },
        },
      }),
  }

  const { artifacts } = await processFiles([withLineHeights], console.log)
  const theme = JSON.parse(artifacts["theme.json"] || "{}")
  const { typography: bodyTypo } = theme.styles
  const { h1, h2 } = theme.styles.elements

  if (bodyTypo.lineHeight !== "var(--line-height-m)") {
    console.error("Expected body lineHeight to reference var(--line-height-m)", bodyTypo.lineHeight)
    process.exit(1)
  }
  if (h1.typography.lineHeight !== "var(--line-height-xxl)") {
    console.error("Expected h1 lineHeight to reference var(--line-height-xxl)", h1.typography.lineHeight)
    process.exit(1)
  }
  if (h2.typography.lineHeight !== "var(--line-height-xl)") {
    console.error("Expected h2 lineHeight to reference var(--line-height-xl)", h2.typography.lineHeight)
    process.exit(1)
  }

  // Case 2: no line-height tokens at all — must fall back to the literal
  // defaults, never invent a var(--line-height-*) reference.
  const { artifacts: emptyArtifacts } = await processFiles([], console.log)
  const emptyTheme = JSON.parse(emptyArtifacts["theme.json"] || "{}")
  if (emptyTheme.styles.typography.lineHeight !== "1.2") {
    console.error("Expected fallback body lineHeight 1.2", emptyTheme.styles.typography.lineHeight)
    process.exit(1)
  }
  if (emptyTheme.styles.elements.h1.typography.lineHeight !== "1.05") {
    console.error("Expected fallback h1 lineHeight 1.05", emptyTheme.styles.elements.h1.typography.lineHeight)
    process.exit(1)
  }
  if (emptyTheme.styles.elements.h2.typography.lineHeight !== "1.2") {
    console.error("Expected fallback h2 lineHeight 1.2", emptyTheme.styles.elements.h2.typography.lineHeight)
    process.exit(1)
  }

  console.log("Line-height / font-size mapping — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
