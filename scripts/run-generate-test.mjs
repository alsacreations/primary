import fs from "fs/promises";

(async function () {
  try {
    // Minimal DOM stubs so that importing modules that reference `document`
    // does not throw when run in Node for test purposes.
    globalThis.document = {
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
    };

    const theme = await fs.readFile("assets/css/theme.css", "utf8");
    const customVars = "";
    const primaryColor = "raspberry";

    function parseColorVariants(txt) {
      const rx = /--color-([a-z0-9-]+)-(\d+):\s*([^;]+);/gim;
      const m = new Map();
      let r;
      while ((r = rx.exec(txt))) {
        if (!m.has(r[1])) m.set(r[1], new Map());
        m.get(r[1]).set(r[2], r[3].trim());
      }
      return m;
    }

    const colorsMap = parseColorVariants(theme + "\n" + customVars);

    let additional = "";

    if (customVars && customVars.trim()) {
      additional +=
        "\n  /* Couleurs projet personnalisees */\n" +
        customVars
          .trim()
          .split(/\r?\n/)
          .map((l) => "  " + l.trim())
          .join("\n") +
        "\n";
    }

    if (primaryColor === "raspberry") {
      if (!colorsMap.has("raspberry") && customVars.trim() === "") {
        const placeholder = {
          100: "oklch(98% 0.03 352)",
          200: "oklch(94.5% 0.12 352)",
          300: "oklch(84.5% 0.2 352)",
          400: "oklch(72.8281% 0.1971 352.001)",
          500: "oklch(64.5% 0.2 352)",
          600: "oklch(54.5% 0.2 352)",
          700: "oklch(44.5% 0.2 352)",
        };
        let rb = "\n  /* Placeholder raspberry injected */\n";
        Object.keys(placeholder).forEach((k) => {
          rb += `  --color-raspberry-${k}: ${placeholder[k]};\n`;
        });
        additional += rb;
      }
    }

    let out = theme;
    if (additional) {
      const i = out.lastIndexOf("}");
      if (i !== -1) out = out.slice(0, i) + additional + out.slice(i);
      else out += additional;
    }

    // Now verify using the actual module generator to ensure we match runtime
    // behavior (filtering runtime palettes).
    const gen = await import("../assets/js/modules/generators.js");
    const stateMod = await import("../assets/js/modules/state.js");
    stateMod.state.themeContent = theme;
    stateMod.state.config.customVars = customVars;
    stateMod.state.config.primaryColor = primaryColor;
    const generated = gen.generateThemeCSS();

    const importPresent = /palettes\/ocean\.css/.test(generated);
    console.log(
      importPresent ? "FAILED: import present" : "OK: import removed"
    );
    console.log("raspberry present:", /--color-raspberry-100/.test(generated));
  } catch (e) {
    console.error("ERROR", e);
    process.exit(2);
  }
})();
