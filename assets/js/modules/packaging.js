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

  // Styleguide avec CSS injecté pour version autonome
  try {
    const styleguideResp = await fetch("styleguide.html");
    if (styleguideResp.ok) {
      let styleguideContent = await styleguideResp.text();

      // Injecter le CSS directement dans le styleguide pour le rendre autonome
      const cssInjection = `
        <script>
          // CSS injecté pour version téléchargée
          window.INJECTED_THEME_CSS = \`${themeCSS.replace(/`/g, "\\`")}\`;
          window.INJECTED_TOKENS_CSS = \`${tokensCSS.replace(/`/g, "\\`")}\`;
        </script>
      `;

      // Injecter avant la fermeture du head
      styleguideContent = styleguideContent.replace(
        "</head>",
        cssInjection + "</head>"
      );

      zip.file("styleguide.html", styleguideContent);
    }
  } catch (err) {
    console.warn("styleguide.html absent pour le ZIP:", err);
  }

  // SVGs
  try {
    const svgResp = await fetch("canonical/assets/alsacreations.svg");
    if (svgResp.ok) {
      const svgBlob = await svgResp.blob();
      zip.file("img/alsacreations.svg", svgBlob);
    }
  } catch (err) {
    console.warn("alsacreations.svg non inclus:", err);
  }

  try {
    const favResp = await fetch("canonical/assets/favicon.svg");
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
        "canonical/fonts/Poppins-Variable-opti.woff2"
      );
      if (fontResp.ok) {
        const fontBlob = await fontResp.blob();
        // Place the font at assets/fonts/ so it matches canonical styles
        // which reference /assets/fonts/... (and keeps the archive layout logical)
        zip.file("assets/fonts/Poppins-Variable-opti.woff2", fontBlob);
      }
    }
  } catch (err) {
    console.warn("Police Poppins non incluse dans le ZIP:", err);
  }

  // theme.json (WordPress) si demandé
  try {
    if (state.config && state.config.technology === "wordpress") {
      // Générer le JSON via le générateur afin de respecter le cas canonical
      const { generateThemeJSON } = await import("./generators.js");
      const themeJson = generateThemeJSON();
      zip.file("theme.json", themeJson);
    }
  } catch (err) {
    console.warn("Impossible d'ajouter theme.json au ZIP:", err);
  }

  // Fichiers de config (si checkbox cochée)
  try {
    const includeConfigCheckbox = document.getElementById(
      "include-config-files"
    );
    if (includeConfigCheckbox && includeConfigCheckbox.checked) {
      // Récupérer le mapping des fichiers de config (source -> destination)
      const indexResp = await fetch("canonical/config/index.json");
      if (indexResp.ok) {
        const configMapping = await indexResp.json();

        // configMapping = { "editorconfig.txt": ".editorconfig", ... }
        for (const [sourceFile, destFile] of Object.entries(configMapping)) {
          const configResp = await fetch(`canonical/config/${sourceFile}`);
          if (configResp.ok) {
            const configContent = await configResp.text();
            zip.file(destFile, configContent); // Utiliser le nom de destination
          }
        }
      }
    }
  } catch (err) {
    console.warn("Erreur lors de l'ajout des fichiers de config:", err);
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
