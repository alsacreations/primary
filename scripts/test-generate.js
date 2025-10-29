#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM equivalents for __filename / __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import generator modules to run headless comparisons
import {
  generateAppCSS,
  generateStylesCSS,
  generateTokensCSS,
} from "../assets/js/modules/generators.js";
import { state } from "../assets/js/modules/state.js";

// Minimal test harness to validate generateThemeCSS-like behavior
const RUNTIME_ONLY_COLORS = new Set(["ocean"]);
const PLACEHOLDER_RASPBERRY = {
  100: "oklch(98% 0.03 352)",
  300: "oklch(84.5% 0.2 352)",
  500: "oklch(64.5% 0.2 352)",
  700: "oklch(44.5% 0.2 352)",
};

function readTheme() {
  const p = path.join(__dirname, "..", "assets", "css", "theme.css");
  return fs.readFileSync(p, "utf8");
}

function parseColorVariants(content) {
  const rx = /--color-([a-z0-9-]+)-(\d+):\s*([^;]+);/gim;
  const map = new Map();
  let m;
  while ((m = rx.exec(content))) {
    const name = m[1];
    const variant = m[2];
    if (!map.has(name)) map.set(name, new Set());
    map.get(name).add(variant);
  }
  return map;
}

function generateThemeCSS({
  themeContent,
  customVars = "",
  primaryColor = "raspberry",
}) {
  let themeCSS = themeContent;
  const all = themeContent + "\n" + customVars;
  const colorsMap = parseColorVariants(all);
  const customList = (customVars || "").trim();

  // If user provided custom vars, inject them into the generated output
  if (customList.length > 0) {
    const indentedCustomVars = customList
      .split(/\r?\n/) // handle windows + unix
      .map((l) => `  ${l.trim()}`)
      .filter((l) => l.trim().length > 0)
      .join("\n");
    const customBlock = `\n  /* Couleurs projet personnalisées */\n${indentedCustomVars}\n`;
    const lastBrace = themeCSS.lastIndexOf("}");
    if (lastBrace !== -1)
      themeCSS =
        themeCSS.slice(0, lastBrace) + customBlock + themeCSS.slice(lastBrace);
    else themeCSS += customBlock;
  }

  if (primaryColor === "raspberry") {
    const hasRasp = colorsMap.has("raspberry");
    if (!hasRasp && customList.length === 0) {
      let raspBlock = "\n  /* Placeholder raspberry injected */\n";
      Object.keys(PLACEHOLDER_RASPBERRY).forEach((k) => {
        raspBlock += `  --color-raspberry-${k}: ${PLACEHOLDER_RASPBERRY[k]};\n`;
      });
      const last = themeCSS.lastIndexOf("}");
      if (last !== -1)
        themeCSS = themeCSS.slice(0, last) + raspBlock + themeCSS.slice(last);
      else themeCSS += raspBlock;
    }
  }

  // If user provided custom vars, remove any injected raspberry definitions
  if (customList.length > 0) {
    themeCSS = themeCSS.replace(/--color-raspberry-[\w-]*:\s*[^;]+;?/g, "");
    themeCSS = themeCSS.replace(/\n{3,}/g, "\n\n").replace(/\n\s+\n/g, "\n\n");
  }

  // Filter runtime-only colors and imports
  if (RUNTIME_ONLY_COLORS.size > 0) {
    const names = Array.from(RUNTIME_ONLY_COLORS)
      .map((n) => n.replace(/[-\\/\\^$*+?.()|[\]{}]/g, "\\$&"))
      .join("|");
    const varRx = new RegExp(`--color-(?:${names})-[\\w-]*:\\s*[^;]+;?`, "g");
    themeCSS = themeCSS.replace(varRx, "");

    const importRx = new RegExp(
      `@import\\s+["']?[^"';]*palettes\\/(?:${names})\\.css["']?;?`,
      "gi"
    );
    themeCSS = themeCSS.replace(importRx, "");

    const lineFallback = new RegExp(
      `^.*palettes\\/(?:${names})\\.css.*$\\n?`,
      "gmi"
    );
    themeCSS = themeCSS.replace(lineFallback, "");

    themeCSS = themeCSS.replace(/\n{3,}/g, "\n\n").replace(/\n\s+\n/g, "\n\n");
  }

  return themeCSS;
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 2;
    throw new Error(msg);
  }
}

function runTests() {
  console.log("Running generation tests...");
  const theme = readTheme();

  // Test 1: raspberry placeholder injection
  const out1 = generateThemeCSS({
    themeContent: theme,
    customVars: "",
    primaryColor: "raspberry",
  });
  assert(
    out1.includes("--color-raspberry-100"),
    "Test1: raspberry 100 missing"
  );
  assert(
    out1.includes("--color-raspberry-500"),
    "Test1: raspberry 500 missing"
  );
  assert(!/palettes\/ocean\.css/.test(out1), "Test1: runtime import leaked");
  console.log("✓ Test1 passed");

  // Test 2: user adds a custom color (rose) and it should replace raspberry
  const customRose = "--color-rose-500: oklch(60% 0.1 25);";
  const out2 = generateThemeCSS({
    themeContent: theme,
    customVars: customRose,
    primaryColor: "rose",
  });
  assert(
    !/--color-raspberry-/.test(out2),
    "Test2: raspberry should be removed when user provides custom vars"
  );
  assert(out2.includes("--color-rose-500"), "Test2: custom rose not present");
  console.log("✓ Test2 passed");

  // Test 3: user provides an ocean variable — ensure runtime palette import isn't present
  const customOcean = "--color-ocean-300: oklch(70% 0.12 250);";
  const out3 = generateThemeCSS({
    themeContent: theme,
    customVars: customOcean,
    primaryColor: "ocean",
  });
  assert(!/palettes\/ocean\.css/.test(out3), "Test3: ocean import leaked");
  // Also ensure runtime vars were filtered (current behavior)
  assert(
    !/--color-ocean-300/.test(out3),
    "Test3: runtime ocean variable should be filtered from export"
  );
  console.log("✓ Test3 passed");

  console.log("\nAll tests passed");
}

async function runHeadlessComparisons() {
  console.log("\nRunning headless file comparisons (app/styles/tokens)...");

  // Load files into state (styles, app, theme, etc.) directly from disk
  // to avoid importing DOM-dependent modules (dom.js) in Node.
  const read = (p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
  try {
    state.themeContent = read(["assets", "css", "theme.css"]);
  } catch (e) {
    state.themeContent = "";
  }
  try {
    state.resetContent = read(["assets", "css", "reset.css"]);
  } catch (e) {
    state.resetContent = "";
  }
  try {
    state.layoutsContent = read(["assets", "css", "layouts.css"]);
  } catch (e) {
    state.layoutsContent = "";
  }
  try {
    state.nativesContent = read(["assets", "css", "natives.css"]);
  } catch (e) {
    state.nativesContent = "";
  }
  try {
    state.stylesSystemContent = read(["public", "samples", "styles.css"]);
  } catch (e) {
    state.stylesSystemContent = "";
  }
  try {
    state.stylesPoppinsContent = read([
      "public",
      "samples",
      "styles-poppins.css",
    ]);
  } catch (e) {
    state.stylesPoppinsContent = "";
  }
  try {
    state.appContent = read(["assets", "css", "app.css"]);
  } catch (e) {
    state.appContent = "";
  }

  // Ensure canonical config
  state.config.primaryColor = "raspberry";
  state.config.themeMode = "both";
  state.config.typoResponsive = true;
  state.config.spacingResponsive = true;

  // 1) app.css -> compare with assets/css/app.css (source of truth)
  const generatedApp = generateAppCSS();
  const expectedApp = fs.readFileSync(
    path.join(__dirname, "..", "assets", "css", "app.css"),
    "utf8"
  );
  assert(
    generatedApp === expectedApp,
    "App CSS mismatch (generated vs assets/css/app.css)"
  );
  console.log("✓ app.css matches assets/css/app.css");

  // 2) styles.css system
  state.config.fontFamily = "system";
  const generatedStylesSystem = generateStylesCSS();
  const expectedStylesSystem = fs.readFileSync(
    path.join(__dirname, "..", "public", "samples", "styles.css"),
    "utf8"
  );
  assert(
    generatedStylesSystem === expectedStylesSystem,
    "styles.css (system) mismatch vs public/samples/styles.css"
  );
  console.log("✓ styles.css (system) matches public/samples/styles.css");

  // 3) styles.css poppins
  state.config.fontFamily = "poppins";
  const generatedStylesPoppins = generateStylesCSS();
  const expectedStylesPoppins = fs.readFileSync(
    path.join(__dirname, "..", "public", "samples", "styles-poppins.css"),
    "utf8"
  );
  assert(
    generatedStylesPoppins === expectedStylesPoppins,
    "styles.css (poppins) mismatch vs public/samples/styles-poppins.css"
  );
  console.log(
    "✓ styles.css (poppins) matches public/samples/styles-poppins.css"
  );

  // 4) tokens canonical
  const generatedTokens = generateTokensCSS();
  const expectedTokens = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "public",
      "samples",
      "theme-tokens-base-light-dark.css"
    ),
    "utf8"
  );
  assert(
    generatedTokens === expectedTokens,
    "Canonical theme-tokens mismatch vs public/samples/theme-tokens-base-light-dark.css"
  );
  console.log(
    "✓ canonical theme-tokens match public/samples/theme-tokens-base-light-dark.css"
  );

  console.log("\nHeadless comparisons passed");
}

try {
  runTests();
  // run headless comparisons after the internal tests
  await runHeadlessComparisons();
} catch (err) {
  console.error("\nOne or more tests failed.");
  process.exit(process.exitCode || 1);
}
