/**
 * Module de gestion d'état - Primary CSS Generator
 * Gère l'état global de l'application
 */

/**
 * État de l'application
 */
export const state = {
  currentStep: 1,
  config: {
    primaryColor: "raspberry",
    themeMode: "both",
    typoResponsive: true,
    spacingResponsive: true,
    fontFamily: "system",
    customVars: "",
  },
  appliedCustomVars: new Set(),
  themeContent: "", // Contenu original de theme.css
  resetContent: "", // Contenu de reset.css
  layoutsContent: "", // Contenu de layouts.css
  nativesContent: "", // Contenu de natives.css
  stylesSystemContent: "", // Contenu de styles.css (système)
  stylesPoppinsContent: "", // Contenu de styles-2.css (Poppins)
  appContent: "", // Contenu de app.css (point d'entrée)
};

/**
 * Placeholder 'raspberry' utilisé uniquement pour la génération et l'affichage
 * quand l'app n'a pas de couleur projet fournie. Ne doit pas être utilisé
 * comme variable runtime globale pour le style de l'application.
 */
export const PLACEHOLDER_RASPBERRY = {
  100: "oklch(98% 0.03 352)",
  200: "oklch(94.5% 0.12 352)",
  300: "oklch(84.5% 0.2 352)",
  400: "oklch(72.8281% 0.1971 352.001)",
  500: "oklch(64.5% 0.2 352)",
  600: "oklch(54.5% 0.2 352)",
  700: "oklch(44.5% 0.2 352)",
};

/**
 * Palette présentes uniquement pour le runtime de l'application (ne doivent
 * pas apparaître dans l'interface de configuration). Par ex. 'ocean' sert
 * le style de l'app mais ne doit pas être exposée comme couleur projet.
 */
export const RUNTIME_ONLY_COLORS = new Set(["ocean"]);
