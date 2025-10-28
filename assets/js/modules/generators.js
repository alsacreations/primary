/**
 * Module de génération CSS - Primary CSS Generator
 * Fonctions de génération des différents fichiers CSS
 */

import { state, PLACEHOLDER_RASPBERRY } from "./state.js";
import { validateCustomVars } from "./validation.js";

/**
 * Génère les variantes manquantes d'une palette de couleurs
 */
export function generateMissingVariants(variants) {
  const required = ["100", "300", "500", "700"];
  const result = new Map(variants);

  // Si toutes les variantes requises existent déjà, retourner tel quel
  const hasAll = required.every((v) => variants.has(v));
  if (hasAll) return result;

  // Convertir les variantes existantes en tableaux triés
  const existing = Array.from(variants.entries())
    .filter(([k]) => /^\d+$/.test(k))
    .map(([k, v]) => [parseInt(k), v])
    .sort((a, b) => a[0] - b[0]);

  if (existing.length === 0) return result;

  // Fonction d'interpolation entre deux valeurs OKLCH
  const interpolate = (val1, val2, ratio) => {
    // Parser les valeurs OKLCH: oklch(L% C H)
    const parseOKLCH = (str) => {
      const match = str.match(
        /oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/
      );
      if (!match) return null;
      return {
        l: parseFloat(match[1]),
        c: parseFloat(match[2]),
        h: parseFloat(match[3]),
        alpha: match[4] || "",
      };
    };

    const c1 = parseOKLCH(val1);
    const c2 = parseOKLCH(val2);

    if (!c1 || !c2) return val1;

    const l = c1.l + (c2.l - c1.l) * ratio;
    const c = c1.c + (c2.c - c1.c) * ratio;
    const h = c1.h + (c2.h - c1.h) * ratio;

    return `oklch(${l.toFixed(2)}% ${c.toFixed(2)} ${h.toFixed(2)})`;
  };

  // Générer les variantes manquantes
  required.forEach((target) => {
    const targetNum = parseInt(target);

    if (!result.has(target)) {
      // Trouver les variantes encadrantes
      let lower = null;
      let upper = null;

      for (let i = 0; i < existing.length; i++) {
        if (existing[i][0] < targetNum) {
          lower = existing[i];
        }
        if (existing[i][0] > targetNum && !upper) {
          upper = existing[i];
        }
      }

      let interpolatedValue;

      if (lower && upper) {
        // Interpolation entre deux valeurs
        const ratio = (targetNum - lower[0]) / (upper[0] - lower[0]);
        interpolatedValue = interpolate(lower[1], upper[1], ratio);
      } else {
        // Extrapolation basée sur une échelle standard de luminosité
        // Échelle de référence : 100=98%, 300=84%, 500=64%, 700=44%
        const lightnessScale = {
          100: 98,
          300: 84,
          500: 64,
          700: 44,
        };

        // Prendre la valeur de référence (la plus proche disponible)
        const refVariant = existing[0];
        const refNum = refVariant[0];
        const refLightness = lightnessScale[refNum] || 64; // 500 par défaut
        const targetLightness = lightnessScale[targetNum] || 64;

        // Ajuster la luminosité
        const lightnessRatio = targetLightness / refLightness;
        const parsed = parseOKLCH(refVariant[1]);

        if (parsed) {
          const newL = Math.max(0, Math.min(100, parsed.l * lightnessRatio));
          interpolatedValue = `oklch(${newL.toFixed(2)}% ${parsed.c.toFixed(
            2
          )} ${parsed.h.toFixed(2)})`;
        } else {
          interpolatedValue = refVariant[1]; // Fallback
        }
      }

      result.set(target, interpolatedValue);
    }
  });

  return result;
}

/**
 * Génère le CSS des tokens sémantiques
 */
export function generateTokensCSS() {
  const {
    primaryColor,
    themeMode,
    typoResponsive,
    spacingResponsive,
    customVars,
  } = state.config;

  // Valider les variables personnalisées avant génération
  const validation = validateCustomVars(customVars);
  if (validation !== true) {
    throw new Error(`Variables personnalisées invalides : ${validation}`);
  }

  // Utiliser directement le nom de la couleur pour référencer la variable
  const primaryValue = `var(--color-${primaryColor}-500)`;

  // Générer le CSS des tokens
  let css = `/* ----------------------------------
 * Primary par Alsacréations
 * Nécessite les variables CSS primaires (theme.css)
 * Généré par le script de génération de tokens
 * Configuration :
 * - Couleur primaire : ${primaryColor}
 * - Theme ${
   themeMode === "both"
     ? "light et dark"
     : themeMode === "light"
     ? "light uniquement"
     : "dark uniquement"
 }
 * - Typographie ${typoResponsive ? "responsive" : "fixe"}
 * - Espacements ${spacingResponsive ? "responsive" : "fixes"}
 * ----------------------------------
 */

:root {
  /* Color Tokens */
  color-scheme: ${
    themeMode === "both"
      ? "light dark"
      : themeMode === "light"
      ? "light"
      : "dark"
  };

  --primary: ${primaryValue};
  --on-primary: var(--color-white);
  --surface: ${
    themeMode === "both"
      ? "light-dark(var(--color-white), var(--color-gray-900))"
      : themeMode === "light"
      ? "var(--color-white)"
      : "var(--color-gray-900)"
  };
  --on-surface: ${
    themeMode === "both"
      ? "light-dark(var(--color-gray-900), var(--color-white))"
      : themeMode === "light"
      ? "var(--color-gray-900)"
      : "var(--color-white)"
  };
  --surface-secondary: ${
    themeMode === "both"
      ? "light-dark(var(--color-gray-50), var(--color-gray-800))"
      : themeMode === "light"
      ? "var(--color-gray-50)"
      : "var(--color-gray-800)"
  };
  --on-surface-secondary: ${
    themeMode === "both"
      ? "light-dark(var(--color-gray-600), var(--color-gray-400))"
      : themeMode === "light"
      ? "var(--color-gray-600)"
      : "var(--color-gray-400)"
  };
  --border-light: ${
    themeMode === "both"
      ? "light-dark(var(--color-gray-200), var(--color-gray-700))"
      : themeMode === "light"
      ? "var(--color-gray-200)"
      : "var(--color-gray-700)"
  };
  --border-medium: ${
    themeMode === "both"
      ? "light-dark(var(--color-gray-300), var(--color-gray-600))"
      : themeMode === "light"
      ? "var(--color-gray-300)"
      : "var(--color-gray-600)"
  };
  --error: ${
    themeMode === "both"
      ? "light-dark(oklch(50.54% 0.19 27.52), oklch(60.54% 0.19 27.52))"
      : "oklch(50.54% 0.19 27.52)"
  };
  --on-error: ${
    themeMode === "both"
      ? "light-dark(oklch(100% 0 0), oklch(100% 0 0))"
      : "oklch(100% 0 0)"
  };
  --success: ${
    themeMode === "both"
      ? "light-dark(oklch(45.5% 0.15 142), oklch(55.5% 0.15 142))"
      : "oklch(45.5% 0.15 142)"
  };
  --on-success: ${
    themeMode === "both"
      ? "light-dark(oklch(100% 0 0), oklch(100% 0 0))"
      : "oklch(100% 0 0)"
  };
  --warning: ${
    themeMode === "both"
      ? "light-dark(oklch(70.5% 0.15 85), oklch(80.5% 0.15 85))"
      : "oklch(70.5% 0.15 85)"
  };
  --on-warning: ${
    themeMode === "both"
      ? "light-dark(oklch(20% 0 0), oklch(20% 0 0))"
      : "oklch(20% 0 0)"
  };
  --info: ${
    themeMode === "both"
      ? "light-dark(oklch(51.33% 0.18 256.37), oklch(61.33% 0.18 256.37))"
      : "oklch(51.33% 0.18 256.37)"
  };
  --on-info: ${
    themeMode === "both"
      ? "light-dark(oklch(100% 0 0), oklch(100% 0 0))"
      : "oklch(100% 0 0)"
  };

  /* Typography Tokens */
  --font-base: ${
    state.config.fontFamily === "poppins"
      ? '"Poppins", system-ui, sans-serif'
      : "system-ui, sans-serif"
  };
  --font-weight-normal: 400;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --text-xs: ${
    typoResponsive
      ? "clamp(var(--text-12), 0.7125rem + 0.125vw, var(--text-14))"
      : "var(--text-14)"
  };
  --text-s: ${
    typoResponsive
      ? "clamp(var(--text-14), 0.85rem + 0.25vw, var(--text-16))"
      : "var(--text-16)"
  };
  --text-m: ${
    typoResponsive
      ? "clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18))"
      : "var(--text-18)"
  };
  --text-l: ${
    typoResponsive
      ? "clamp(var(--text-18), 1.063rem + 0.4348vw, var(--text-20))"
      : "var(--text-20)"
  };
  --text-xl: ${
    typoResponsive
      ? "clamp(var(--text-20), 1.1695rem + 0.6522vw, var(--text-24))"
      : "var(--text-24)"
  };
  --text-2xl: ${
    typoResponsive
      ? "clamp(var(--text-24), 1.3913rem + 1.087vw, var(--text-28))"
      : "var(--text-28)"
  };
  --text-3xl: ${
    typoResponsive
      ? "clamp(var(--text-28), 1.613rem + 1.5217vw, var(--text-32))"
      : "var(--text-32)"
  };
  --text-4xl: ${
    typoResponsive
      ? "clamp(var(--text-32), 1.8348rem + 1.9565vw, var(--text-36))"
      : "var(--text-36)"
  };
  --text-5xl: ${
    typoResponsive
      ? "clamp(var(--text-36), 2.0565rem + 2.3913vw, var(--text-40))"
      : "var(--text-40)"
  };

  /* Spacing Tokens */
  --spacing-xs: ${
    spacingResponsive
      ? "clamp(var(--spacing-4), 0.15rem + 0.4348vw, var(--spacing-8))"
      : "var(--spacing-8)"
  };
  --spacing-s: ${
    spacingResponsive
      ? "clamp(var(--spacing-8), 0.3rem + 0.8696vw, var(--spacing-16))"
      : "var(--spacing-16)"
  };
  --spacing-m: ${
    spacingResponsive
      ? "clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32))"
      : "var(--spacing-32)"
  };
  --spacing-l: ${
    spacingResponsive
      ? "clamp(var(--spacing-24), 0.8909rem + 2.7273vw, var(--spacing-48))"
      : "var(--spacing-48)"
  };
  --spacing-xl: ${
    spacingResponsive
      ? "clamp(var(--spacing-32), 1.1818rem + 3.6364vw, var(--spacing-64))"
      : "var(--spacing-64)"
  };
  --spacing-2xl: ${
    spacingResponsive
      ? "clamp(var(--spacing-48), 1.7727rem + 5.4545vw, var(--spacing-96))"
      : "var(--spacing-96)"
  };

  /* Layout Tokens */
  --gap-xs: var(--spacing-xs);
  --gap-s: var(--spacing-s);
  --gap-m: var(--spacing-m);
  --gap-l: var(--spacing-l);
  --gap-xl: var(--spacing-xl);

  /* Border Radius Tokens */
  --radius-s: var(--spacing-2);
  --radius-m: var(--spacing-4);
  --radius-l: var(--spacing-8);
  --radius-xl: var(--spacing-16);

  /* Shadow Tokens */
  --shadow-s: 0 1px 2px 0 ${
    themeMode === "both"
      ? "light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.3))"
      : themeMode === "light"
      ? "rgba(0, 0, 0, 0.05)"
      : "rgba(0, 0, 0, 0.3)"
  };
  --shadow-m: 0 4px 6px -1px ${
    themeMode === "both"
      ? "light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.4))"
      : themeMode === "light"
      ? "rgba(0, 0, 0, 0.1)"
      : "rgba(0, 0, 0, 0.4)"
  }, 0 2px 4px -1px ${
    themeMode === "both"
      ? "light-dark(rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.25))"
      : themeMode === "light"
      ? "rgba(0, 0, 0, 0.06)"
      : "rgba(0, 0, 0, 0.25)"
  };
  --shadow-l: 0 10px 15px -3px ${
    themeMode === "both"
      ? "light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.4))"
      : themeMode === "light"
      ? "rgba(0, 0, 0, 0.1)"
      : "rgba(0, 0, 0, 0.4)"
  }, 0 4px 6px -2px ${
    themeMode === "both"
      ? "light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.2))"
      : themeMode === "light"
      ? "rgba(0, 0, 0, 0.05)"
      : "rgba(0, 0, 0, 0.2)"
  };
  --shadow-xl: 0 20px 25px -5px ${
    themeMode === "both"
      ? "light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.4))"
      : themeMode === "light"
      ? "rgba(0, 0, 0, 0.1)"
      : "rgba(0, 0, 0, 0.4)"
  }, 0 10px 10px -5px ${
    themeMode === "both"
      ? "light-dark(rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.15))"
      : themeMode === "light"
      ? "rgba(0, 0, 0, 0.04)"
      : "rgba(0, 0, 0, 0.15)"
  };

  /* Focus Tokens */
  --focus-ring: 2px solid var(--primary);
  --focus-ring-offset: 2px;
}`;

  // Ajouter les variables personnalisées si elles existent
  if (customVars.trim()) {
    css += "\n\n  /* Custom Variables */\n";
    css += customVars
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .join("\n  ");
  }

  css += "\n}\n";

  return css;
}

/**
 * Génère le CSS du thème avec les variables personnalisées
 */
export function generateThemeCSS() {
  let css = state.themeContent;

  // Ajouter les variables personnalisées à la fin
  if (state.config.customVars.trim()) {
    css += "\n\n/* Variables personnalisées */\n";
    css += ":root {\n";
    css += state.config.customVars
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .join("\n  ");
    css += "\n}\n";
  }

  return css;
}

/**
 * Génère le CSS des styles applicatifs
 */
export function generateStylesCSS() {
  const { fontFamily } = state.config;

  if (fontFamily === "poppins") {
    return state.stylesPoppinsContent;
  }

  return state.stylesSystemContent;
}

/**
 * Génère le CSS de l'application
 */
export function generateAppCSS() {
  return `/* ----------------------------------
 * Point d'entrée CSS - Primary
 * ----------------------------------
 */

/* Configuration */
@layer config;

/* Reset */
@layer base;

/* Layouts */
@layer components;

/* Styles applicatifs */
@layer utilities;

/* Imports */
@import url("reset.css") layer(base);
@import url("theme.css") layer(config);
@import url("theme-tokens.css") layer(config);
@import url("layouts.css") layer(components);
@import url("natives.css") layer(components);
@import url("styles.css") layer(utilities);
`;
}
