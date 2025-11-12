#!/usr/bin/env node
/**
 * Script : Génère automatiquement index.json pour canonical/config
 * Usage : node scripts/update-config-index.js
 */
import { readdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = join(__dirname, "..", "canonical", "config");

// Lire tous les fichiers du dossier config
const files = readdirSync(configDir)
  .filter((file) => {
    // Exclure index.json lui-même, README.md et les fichiers cachés système
    return (
      file !== "index.json" &&
      file !== "README.md" &&
      !file.startsWith(".DS_Store")
    );
  })
  .sort(); // Tri alphabétique

// Créer un mapping source -> destination
// Les fichiers .txt qui correspondent à des fichiers cachés sont renommés
// Exemples: editorconfig.txt -> .editorconfig, gitignore.txt -> .gitignore
const mapping = {};
files.forEach((file) => {
  if (file.endsWith(".txt")) {
    // Convention: nomfichier.txt -> .nomfichier
    const baseName = file.replace(/\.txt$/, "");
    // Liste connue de fichiers cachés courants
    const hiddenFiles = [
      "editorconfig",
      "gitignore",
      "eslintrc",
      "prettierrc",
      "nvmrc",
    ];

    if (hiddenFiles.includes(baseName)) {
      mapping[file] = `.${baseName}`;
    } else {
      mapping[file] = file; // Si pas dans la liste, garder tel quel
    }
  } else {
    mapping[file] = file; // Autres fichiers : nom identique
  }
});

// Écrire le fichier index.json
const indexPath = join(configDir, "index.json");
writeFileSync(indexPath, JSON.stringify(mapping, null, 2) + "\n", "utf8");

console.log(
  `✅ ${files.length} fichiers listés dans canonical/config/index.json :\n`
);
Object.entries(mapping).forEach(([source, dest]) => {
  if (source !== dest) {
    console.log(`   - ${source} → ${dest}`);
  } else {
    console.log(`   - ${source}`);
  }
});
console.log("");
