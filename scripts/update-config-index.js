#!/usr/bin/env node
/**
 * Script : Génère automatiquement index.json pour canonical/config
 * Usage : node scripts/update-config-index.js
 */
import { readdirSync, statSync, writeFileSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = join(__dirname, "..", "canonical", "config");

/**
 * Lit récursivement tous les fichiers d'un dossier
 */
function getAllFiles(dir, baseDir = dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = relative(baseDir, fullPath);
    const stat = statSync(fullPath);

    // Ignorer les fichiers/dossiers système
    if (entry.startsWith(".DS_Store")) continue;
    if (entry === "index.json") continue;
    if (entry === "README.md" && dir === baseDir) continue; // README à la racine uniquement

    if (stat.isDirectory()) {
      // Récursion dans les sous-dossiers
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      // Ajouter le fichier avec son chemin relatif
      files.push(relativePath);
    }
  }

  return files;
}

// Lire tous les fichiers du dossier config (y compris sous-dossiers)
const files = getAllFiles(configDir).sort();

// Créer un mapping source -> destination
// Les fichiers .txt qui correspondent à des fichiers cachés sont renommés
// Exemples: editorconfig.txt -> .editorconfig, gitignore.txt -> .gitignore
const mapping = {};
files.forEach((file) => {
  const fileName = file.split("/").pop(); // Nom du fichier seul

  if (fileName.endsWith(".txt")) {
    // Convention: nomfichier.txt -> .nomfichier
    const baseName = fileName.replace(/\.txt$/, "");
    // Liste connue de fichiers cachés courants
    const hiddenFiles = [
      "editorconfig",
      "gitignore",
      "eslintrc",
      "prettierrc",
      "nvmrc",
    ];

    if (hiddenFiles.includes(baseName)) {
      // Remplacer le nom de fichier mais garder le chemin
      const destPath = file.replace(/[^/]+\.txt$/, `.${baseName}`);
      mapping[file] = destPath;
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
