/**
 * Module de validation - Primary CSS Generator
 * Fonctions de validation des données utilisateur
 */

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

    // Vérifier que chaque ligne non vide commence par --
    if (!line.startsWith("--")) {
      return `Ligne ${i + 1}: Les variables doivent commencer par "--".`;
    }

    // Vérifier la présence de ":"
    if (!line.includes(":")) {
      return `Ligne ${i + 1}: Variable mal formée (manque ":").`;
    }

    // Vérifier la présence de ";"
    if (!line.endsWith(";")) {
      return `Ligne ${i + 1}: Variable mal formée (manque ";").`;
    }

    // Vérifier les accolades non fermées (basique)
    const openBraces = (line.match(/\(/g) || []).length;
    const closeBraces = (line.match(/\)/g) || []).length;
    if (openBraces !== closeBraces) {
      return `Ligne ${i + 1}: Parenthèses non équilibrées.`;
    }
  }

  return true; // OK
}
