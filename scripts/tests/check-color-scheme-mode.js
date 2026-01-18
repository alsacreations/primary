import { processFiles } from "../../assets/js/client-utils.mjs"

async function run() {
  // Case A: no light/dark modes present (combined file)
  const combined = {
    name: "combined.json",
    text: async () => JSON.stringify({ fonts: {} }),
  }
  const { artifacts: artA } = await processFiles([combined], console.log)
  const cssA = artA["theme.css"] || ""
  if (!/color-scheme:\s*light;/.test(cssA)) {
    console.error(
      "Expected 'color-scheme: light;' when no light/dark modes present",
    )
    process.exit(1)
  }

  // Case B: light and dark files provided
  const light = {
    name: "light.json",
    text: async () => JSON.stringify({ mode: "light", color: {} }),
  }
  const dark = {
    name: "dark.json",
    text: async () => JSON.stringify({ mode: "dark", color: {} }),
  }
  const { artifacts: artB } = await processFiles([light, dark], console.log)
  const cssB = artB["theme.css"] || ""
  if (!/color-scheme:\s*light dark;/.test(cssB)) {
    console.error(
      "Expected 'color-scheme: light dark;' when light and dark modes present",
    )
    process.exit(1)
  }

  console.log("Color-scheme mode detection — OK")
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(2)
})
