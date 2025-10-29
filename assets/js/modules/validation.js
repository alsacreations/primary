/**
 * Module de validation - Primary CSS Generator
 * Fonctions de validation des données utilisateur
 */

import { elements } from "./dom.js";

/**
 * Cache le message d'erreur global
 */
export function hideGlobalError() {
  elements.globalError.hidden = true;
  elements.globalError.textContent = "";
}

/**
 * Affiche un message d'erreur global
 */
export function showGlobalError(message) {
  elements.globalError.textContent = message;
  elements.globalError.hidden = false;
}

/**
 * Valide la syntaxe basique du CSS personnalisé
 */
export function validateCustomVars(css) {
  if (!css.trim()) return true; // Vide est OK

  // Regex simple pour détecter des erreurs évidentes
  const lines = css
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;

    // Vérifier que chaque ligne non vide commence par --
    // Mais être tolérant si l'utilisateur est en train d'écrire la ligne
    if (!line.startsWith("--")) {
      if (!isLast) {
        return `Ligne ${i + 1}: Les variables doivent commencer par "--".`;
      } else {
        // Dernière ligne incomplète : laisser passer (utilisateur en cours de frappe)
        return true;
      }
    }

    // Vérifier la présence de ":" — si la ligne courante est la dernière et
    // ne contient pas encore ":", on considère que l'utilisateur est en train
    // d'écrire et on évite de renvoyer une erreur agressive.
    if (!line.includes(":")) {
      if (!isLast) {
        return `Ligne ${i + 1}: Variable mal formée (manque ":").`;
      } else {
        return true;
      }
    }

    // Vérifier la présence de ";" — tolérer l'absence uniquement sur la ligne
    // en cours (dernière ligne) pour éviter de spammer l'utilisateur.
    if (!line.endsWith(";")) {
      if (!isLast) {
        return `Ligne ${i + 1}: Variable mal formée (manque ";").`;
      } else {
        return true;
      }
    }

    // Vérifier les parenthèses non fermées (basique) — tolérer sur la dernière
    const openBraces = (line.match(/\(/g) || []).length;
    const closeBraces = (line.match(/\)/g) || []).length;
    if (openBraces !== closeBraces) {
      if (!isLast) {
        return `Ligne ${i + 1}: Parenthèses non équilibrées.`;
      } else {
        return true;
      }
    }
  }

  return true; // OK
}
