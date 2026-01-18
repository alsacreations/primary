import { processFiles } from "../assets/js/client-utils.mjs"
;(async () => {
  const file = {
    name: "primitives_others.json",
    text: async () =>
      JSON.stringify({
        color: {},
        "transition-duration": { $type: "string", $value: "300ms" },
        "z-header-level": { $type: "number", $value: 900 },
        "font-base": { $type: "string", $value: "Poppins, sans-serif" },
      }),
  }

  const { artifacts, logs } = await processFiles([file], console.log)
  console.log("\n--- logs ---")
  console.log(logs.join("\n"))
  console.log("\n--- theme.css ---\n")
  console.log(artifacts["theme.css"])
})()
