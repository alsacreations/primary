import fs from "fs"
import path from "path"

async function run() {
  const mod = await import("../../assets/js/client-utils.mjs")
  const { processFiles } = mod

  const file = {
    name: "primitives_others_step9.json",
    text: async () =>
      JSON.stringify({
        color: {},
        // only other primitives provided
        "transition-duration": { $type: "string", $value: "300ms" },
        "z-header-level": { $type: "number", $value: 900 },
        "font-base": { $type: "string", $value: "Poppins, sans-serif" },
      }),
  }

  const { artifacts } = await processFiles([file], console.log)
  const css = artifacts["theme.css"]
  if (!css) {
    console.error("theme.css not generated")
    process.exit(2)
  }

  // Positive expectations (must be present)
  const mustHaveComments = [
    "/* Autres Primitives globales */",
    "/* Transitions et animations */",
    "/* Niveaux de z-index */",
    "/* Border radius */",
    "/* Familles de police */",
    "/* Graisses de police */",
  ]
  const missingComments = mustHaveComments.filter((c) => !css.includes(c))
  if (missingComments.length) {
    console.error(
      "Missing required comments in step 9 output:",
      missingComments,
    )
    process.exit(1)
  }

  // Negative expectations (must NOT be present at this stage)
  const forbidden = [
    "/* Espacements */",
    "/* Typographie */",
    "/* Typographie Tokens du projet */",
    "/* Espacements Tokens du projet */",
  ]
  const foundForbidden = forbidden.filter((f) => css.includes(f))
  if (foundForbidden.length) {
    console.error(
      "Unexpected sections present (should not be emitted at step 9):",
      foundForbidden,
    )
    process.exit(1)
  }

  // Also ensure no spacing / typographie tokens/primitives lines are present
  const forbiddenPatterns = [
    /--spacing-/,
    /--text-/,
    /--line-height-/,
    /--radius-2xl/,
  ]
  const matched = forbiddenPatterns.filter((r) => r.test(css))
  if (matched.length) {
    console.error(
      "Unexpected token-like lines present in step 9 output:",
      matched.map(String),
    )
    process.exit(1)
  }

  console.log("Step 9 output contains only expected sections — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
