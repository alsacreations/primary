/**
 * Module packaging - gestion de la création et du téléchargement ZIP
 */
import { state } from "./state.js";
import {
  generateAppCSS,
  generateThemeCSS,
  generateTokensCSS,
  generateStylesCSS,
} from "./generators.js";

/**
 * Télécharge tous les fichiers CSS et assets connexes dans une archive ZIP.
 */
export async function downloadAllFiles() {
  const zip = new JSZip();

  // Générer les fichiers CSS
  const appCSS = generateAppCSS();
  const themeCSS = generateThemeCSS();
  const tokensCSS = generateTokensCSS();
  const stylesCSS = generateStylesCSS();

  // Ajouter les fichiers CSS au ZIP sous assets/css/
  zip.file("assets/css/app.css", appCSS);
  zip.file("assets/css/reset.css", state.resetContent || "");
  zip.file("assets/css/theme.css", themeCSS);
  zip.file("assets/css/theme-tokens.css", tokensCSS);
  zip.file("assets/css/layouts.css", state.layoutsContent || "");
  zip.file("assets/css/natives.css", state.nativesContent || "");
  zip.file("assets/css/styles.css", stylesCSS);

  // Index
  try {
    const indexResp = await fetch("public/samples/index.html");
    if (indexResp.ok) {
      const indexContent = await indexResp.text();
      zip.file("index.html", indexContent);
    }
  } catch (err) {
    console.warn("index.html sample absent pour le ZIP:", err);
  }

  // SVGs
  try {
    const svgResp = await fetch("public/samples/alsacreations.svg");
    if (svgResp.ok) {
      const svgBlob = await svgResp.blob();
      zip.file("img/alsacreations.svg", svgBlob);
    }
  } catch (err) {
    console.warn("alsacreations.svg non inclus:", err);
  }

  try {
    const favResp = await fetch("public/samples/favicon.svg");
    if (favResp.ok) {
      const favBlob = await favResp.blob();
      zip.file("img/favicon.svg", favBlob);
    }
  } catch (err) {
    console.warn("favicon.svg non inclus:", err);
  }

  // Police Poppins
  try {
    const fontFamily = state.config && state.config.fontFamily;
    if (fontFamily === "poppins") {
      const fontResp = await fetch(
        "public/samples/Poppins-Variable-opti.woff2"
      );
      if (fontResp.ok) {
        const fontBlob = await fontResp.blob();
        zip.file("assets/css/fonts/Poppins-Variable-opti.woff2", fontBlob);
      }
    }
  } catch (err) {
    console.warn("Police Poppins non incluse dans le ZIP:", err);
  }

  // Générer le blob et déclencher le téléchargement
  try {
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "primary-css-kit.zip";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  } catch (err) {
    console.error("Erreur lors de la génération du ZIP:", err);
    alert("Erreur lors de la création de l'archive");
  }
}

/**
 * Télécharge un seul fichier en créant un Blob et en l'ouvrant via un lien.
 */
export function downloadSingleFile(filename, content) {
  const blob = new Blob([content], { type: "text/css" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
