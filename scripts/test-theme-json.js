/**
 * Test de génération theme.json avec import Figma
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock du DOM et du window
global.window = {
  __PRIMARY_STATE: {
    _debug: true,
    _logs: [],
  },
};
global.document = {
  documentElement: {
    style: {},
  },
};

// Mock des éléments DOM
const mockElements = {};

// Import des modules
const statePath = join(__dirname, "../assets/js/modules/state.js");
const stateModule = await import(statePath);
const { state } = stateModule;

const generatorsPath = join(__dirname, "../assets/js/modules/generators.js");
const generatorsModule = await import(generatorsPath);
const { generateThemeJSON } = generatorsModule;

const figmaClientPath = join(
  __dirname,
  "../assets/js/modules/figma-client-gen.js"
);
const figmaClient = await import(figmaClientPath);

// Charger les fichiers JSON de test
const primitivesPath = join(
  __dirname,
  "../public/samples/figma-tokens/Primitives.json"
);
const tokenColorsPath = join(
  __dirname,
  "../public/samples/figma-tokens/Token colors.json"
);
const tokenFontPath = join(
  __dirname,
  "../public/samples/figma-tokens/Token Font.json"
);

const primitives = JSON.parse(readFileSync(primitivesPath, "utf8"));
const tokenColors = JSON.parse(readFileSync(tokenColorsPath, "utf8"));
const fonts = JSON.parse(readFileSync(tokenFontPath, "utf8"));

// Configurer state pour mode WordPress
state.config = {
  primaryColor: "raspberry",
  themeMode: "both",
  typoResponsive: true,
  spacingResponsive: true,
  technology: "wordpress",
  synthesizeProjectPrimitives: true,
  customVars: "",
};

// Générer theme.css et tokens.css depuis Figma
const out = figmaClient.generateCanonicalThemeFromFigma({
  primitives,
  fonts,
  tokenColors,
  synthesizeProjectPrimitives: true,
  customColors: "",
  themeMode: "both",
});

state.themeContent = out.themeCss;
state.tokensContent = out.tokensCss;
state.themeFromImport = true; // Marquer comme provenant d'un import

// Debug : afficher les variables --text-* présentes
console.log("\n===== VARIABLES --text-* DANS THEME.CSS =====");
const textVars = (out.themeCss || "").match(
  /--(text-[a-z0-9-]+):\s*([^;]+);/gim
);
if (textVars) {
  textVars.forEach((v) => console.log(v.trim()));
} else {
  console.log("Aucune variable --text-* trouvée dans theme.css");
}

console.log("\n===== VARIABLES --text-* DANS TOKENS.CSS =====");
const tokenTextVars = (out.tokensCss || "").match(
  /--(text-[a-z0-9-]+):\s*([^;]+);/gim
);
if (tokenTextVars) {
  tokenTextVars.forEach((v) => console.log(v.trim()));
} else {
  console.log("Aucune variable --text-* trouvée dans tokens.css");
}

// Générer theme.json
const themeJson = generateThemeJSON();
const parsed = JSON.parse(themeJson);

// Vérifier les tailles de police
console.log("\n===== FONTSIZE DANS THEME.JSON =====");
const fontSizes = parsed.settings?.typography?.fontSizes || [];
console.log(`Total font sizes: ${fontSizes.length}`);

// Trouver text-10 et text-14
const text10 = fontSizes.find((fs) => fs.slug === "text-10");
const text14 = fontSizes.find((fs) => fs.slug === "text-14");

if (text10) {
  console.log(
    `❌ ERREUR : text-10 présent (valeur canonique non importée) : ${JSON.stringify(
      text10
    )}`
  );
} else {
  console.log("✅ text-10 absent (correct, non importé depuis Figma)");
}

if (text14) {
  console.log(`✅ text-14 présent : ${JSON.stringify(text14)}`);
} else {
  console.log("❌ ERREUR : text-14 absent (devrait être importé depuis Figma)");
}

// Afficher toutes les tailles
console.log("\nToutes les tailles de police :");
fontSizes.forEach((fs) => {
  console.log(`  - ${fs.name}: ${fs.size}`);
});

console.log("\n===== FIN TEST =====");
