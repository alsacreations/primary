import fs from "fs"
;(async () => {
  try {
    const module = await import("../assets/js/client-utils.mjs")
    const { processFiles } = module
    const files = [
      {
        name: "primitives.json",
        text: async () =>
          fs.promises.readFile(
            new URL("../dist/primitives.json", import.meta.url),
            "utf8",
          ),
      },
    ]

    const { artifacts, logs } = await processFiles(files, (m) =>
      console.log("[log]", m),
    )

    console.log("\n--- Validation logs:")
    logs.forEach((l) => console.log(l))

    console.log("\n--- theme.css (top 120 lines):")
    const css = artifacts["theme.css"] || ""
    console.log(css.split("\n").slice(0, 120).join("\n"))
  } catch (err) {
    console.error("Error running preview:", err)
    process.exit(1)
  }
})()
