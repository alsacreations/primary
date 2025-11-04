const fs = require("fs");
const path = require("path");

// Simuler l'environnement global nécessaire
global.state = {
  config: {},
  themeFromImport: true,
  tokensContent: "",
};

// Charger le module generators
const generatorsPath = path.join(__dirname, "../assets/js/modules/generators.js");
let generatorsCode = fs.readFileSync(generatorsPath, "utf8");

// Simuler l'export pour Node.js
generatorsCode = generatorsCode.replace(/export function/g, "global.");
eval(generatorsCode);

// Charger le JSON Figma
const jsonPath = path.join(__dirname, "../public/samples/figma-tokens/Token Font.json");
const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

// Simuler un tokensContent avec les tokens extraits
const mockTokensContent = `
:root {
  --text-xs: clamp(var(--text-12), 0.7174rem + 0.2174vw, var(--text-14));
  --text-s: clamp(var(--text-14), 0.8370rem + 0.2174vw, var(--text-16));
  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));
  --text-xl: clamp(var(--text-18), 0.9565rem + 0.5435vw, var(--text-24));
  --text-2xl: clamp(var(--text-24), 1.2065rem + 1.3043vw, var(--text-30));
  --text-4xl: clamp(var(--text-30), 1.0054rem + 2.1739vw, var(--text-48));
  --text-5xl: clamp(var(--text-36), 1.4348rem + 2.6087vw, var(--text-60));
  --text-6xl: clamp(var(--text-36), 0.5455rem + 5.4545vw, var(--text-80));
}
`;

global.state.tokensContent = mockTokensContent;

// Générer les tokens
const result = global.generateTokensCSS({
  primaryColor: "info",
  themeMode: "both",
  typoResponsive: true,
  spacingResponsive: true,
});

// Extraire et afficher les tokens --text-*
const textTokens = result.match(/--text-[a-z0-9]+:[^;]+;/g) || [];
console.log("\n=== Tokens de typographie générés ===");
textTokens.forEach((token) => console.log(token));
console.log(`\nTotal: ${textTokens.length} tokens`);
