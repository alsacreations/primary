/**
 * Bootstrap minimal de l'application.
 * Charge les fichiers nécessaires (theme, reset, layouts, natives, styles)
 * puis délègue l'initialisation à `modules/app-init.js`.
 */
import { init } from "./modules/app-init.js";
import {
  loadThemeFile,
  loadResetFile,
  loadLayoutsFile,
  loadNativesFile,
  loadStylesFiles,
} from "./modules/files.js";

// Charger les assets puis démarrer l'app. Les erreurs de chargement
// sont loggées mais n'empêchent pas l'initialisation afin que l'UI
// reste interactive en mode dégradé.
(async function bootstrap() {
  try {
    await loadThemeFile();
    await loadResetFile();
    await loadLayoutsFile();
    await loadNativesFile();
    await loadStylesFiles();
  } catch (e) {
    console.warn("Warning during asset loading:", e);
  } finally {
    init();
  }
})();
