import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  const combined = {
    name: "colors-combined.json",
    text: async () =>
      JSON.stringify({
        "--color-iris-100": "#E9DEFF",
        "--color-iris-300": "#D9C9FA",
        "--color-iris-400": "#9EA8FF",
        "--color-iris-50": "#F8F4FF",
        "--color-iris-500": "#5829FF",
        "--color-iris-900": "#020946",
      }),
  }

  const { artifacts, logs } = await processFiles([combined], console.log)
  logs.filter((l) => l && l.startsWith("DEBUG:")).forEach((l) => console.log(l))
  const css = artifacts["theme.css"] || ""
  console.log(css)
  const start = css.indexOf("/* Couleurs Primitives du projet */")
  if (start === -1) {
    console.error("Missing Couleurs Primitives du projet section")
    process.exit(1)
  }
  const block = css.slice(start, css.indexOf("\n\n", start) + 2)
  console.log(block)

  const expectedOrder = [
    "--color-iris-50:",
    "--color-iris-100:",
    "--color-iris-300:",
    "--color-iris-400:",
    "--color-iris-500:",
    "--color-iris-900:",
  ]
  const idxs = expectedOrder.map((s) => block.indexOf(s))
  if (idxs.some((i) => i === -1)) {
    console.error("One or more expected color lines missing")
    process.exit(1)
  }
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i - 1] > idxs[i]) {
      console.error("Color ordering incorrect")
      process.exit(1)
    }
  }
  console.log("Color ordering is correct — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
