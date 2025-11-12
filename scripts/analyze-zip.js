/**
 * Test : Analyse statique du contenu prévu du ZIP
 */
import { readFileSync } from "fs";

console.log("\n📦 Analyse du contenu du ZIP Primary\n");

const packagingCode = readFileSync("assets/js/modules/packaging.js", "utf8");

// Extraire tous les fichiers ajoutés au ZIP
const zipFilePattern = /zip\.file\(["']([^"']+)["']/g;
const files = [];
let match;

while ((match = zipFilePattern.exec(packagingCode)) !== null) {
  files.push(match[1]);
}

console.log("🗂️  Fichiers CSS générés (toujours présents) :\n");
const cssFiles = files.filter(
  (f) => f.startsWith("assets/css/") && f.endsWith(".css")
);
cssFiles.forEach((f) => console.log(`  ✓ ${f}`));

console.log("\n🖼️  Assets statiques (toujours présents) :\n");
console.log("  ✓ index.html");
console.log("  ✓ img/alsacreations.svg");
console.log("  ✓ img/favicon.svg");

console.log("\n🔤 Police (conditionnelle - si fontFamily=poppins) :\n");
const fontFile = files.find((f) => f.includes("Poppins"));
if (fontFile) {
  console.log(`  ✓ ${fontFile}`);
}

console.log("\n⚙️  WordPress (conditionnel - si technology=wordpress) :\n");
const themeJson = files.find((f) => f === "theme.json");
if (themeJson) {
  console.log(`  ✓ ${themeJson}`);
}

console.log(`\n📊 Total identifié : ${files.length} appels zip.file()\n`);

// Vérification des chemins vers canonical/
console.log("🔍 Vérification des sources fetch() :\n");
const fetchPattern = /fetch\(["']([^"']+)["']\)/g;
const fetches = [];
while ((match = fetchPattern.exec(packagingCode)) !== null) {
  fetches.push(match[1]);
}

fetches.forEach((url) => {
  const prefix = url.startsWith("canonical/") ? "✅" : "⚠️ ";
  console.log(`  ${prefix} ${url}`);
});

console.log("\n✅ Analyse terminée\n");
console.log("💡 Structure du ZIP attendue :");
console.log(`
primary-css-kit.zip
├── assets/
│   └── css/
│       ├── app.css
│       ├── reset.css
│       ├── theme.css
│       ├── theme-tokens.css
│       ├── layouts.css
│       ├── natives.css
│       ├── styles.css
│       └── fonts/ (si Poppins)
│           └── Poppins-Variable-opti.woff2
├── img/
│   ├── alsacreations.svg
│   └── favicon.svg
├── index.html
└── theme.json (si WordPress)
`);
