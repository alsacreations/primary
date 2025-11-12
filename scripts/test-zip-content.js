/**
 * Test : Vérifie le contenu du ZIP généré
 */
import { readFileSync } from "fs";
import { state } from "../assets/js/modules/state.js";
import { downloadAllFiles } from "../assets/js/modules/packaging.js";

// Mock global JSZip pour Node.js
global.JSZip = (await import("jszip")).default;

// Mock fetch pour Node.js
global.fetch = async (url) => {
  const path = url.replace(/^canonical\//, "");
  const fullPath = `canonical/${path}`;

  try {
    const content = readFileSync(fullPath);
    return {
      ok: true,
      text: async () => content.toString(),
      blob: async () => content,
    };
  } catch (err) {
    return { ok: false };
  }
};

// Mock DOM
global.document = {
  createElement: () => ({
    click: () => {},
  }),
};
global.URL = {
  createObjectURL: () => "mock-url",
  revokeObjectURL: () => {},
};

// Charger les contenus requis
state.resetContent = readFileSync("assets/css/reset.css", "utf8");
state.layoutsContent = readFileSync("assets/css/layouts.css", "utf8");
state.nativesContent = readFileSync("assets/css/natives.css", "utf8");
state.themeContent = readFileSync("assets/css/theme.css", "utf8");

// Config par défaut (tous les fichiers)
state.config = {
  primaryColor: "info",
  themeMode: "light-dark",
  typoResponsive: true,
  spacingResponsive: true,
  fontFamily: "poppins", // Pour tester avec police
  technology: "wordpress", // Pour tester avec theme.json
};

console.log("\n🧪 Test du contenu du ZIP\n");

// Intercepter la génération du ZIP
const originalGenerateAsync = global.JSZip.prototype.generateAsync;
global.JSZip.prototype.generateAsync = async function (options) {
  console.log("📦 Contenu du ZIP :\n");

  const files = Object.keys(this.files).sort();
  files.forEach((file) => {
    const fileData = this.files[file];
    if (!fileData.dir) {
      console.log(`  ✓ ${file}`);
    }
  });

  console.log(
    `\n📊 Total : ${files.filter((f) => !this.files[f].dir).length} fichiers\n`
  );

  // Vérifications
  const required = [
    "assets/css/app.css",
    "assets/css/reset.css",
    "assets/css/theme.css",
    "assets/css/theme-tokens.css",
    "assets/css/layouts.css",
    "assets/css/natives.css",
    "assets/css/styles.css",
    "index.html",
    "img/alsacreations.svg",
    "img/favicon.svg",
  ];

  const optional = [
    "assets/css/fonts/Poppins-Variable-opti.woff2",
    "theme.json",
  ];

  console.log("🔍 Vérifications :\n");

  required.forEach((file) => {
    if (files.includes(file)) {
      console.log(`  ✅ ${file} (requis)`);
    } else {
      console.log(`  ❌ ${file} (MANQUANT !)`);
    }
  });

  optional.forEach((file) => {
    if (files.includes(file)) {
      console.log(`  ✅ ${file} (optionnel présent)`);
    } else {
      console.log(`  ⚠️  ${file} (optionnel absent)`);
    }
  });

  return new Blob();
};

// Lancer la génération
try {
  await downloadAllFiles();
  console.log("\n✅ Test terminé avec succès\n");
} catch (err) {
  console.error("\n❌ Erreur:", err);
  process.exit(1);
}
