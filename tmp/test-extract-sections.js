// Test d'extraction des sections depuis tokensCss

const sampleTokensCss = `
:root {
  color-scheme: light dark;

  /* Couleurs */
  --primary: var(--color-info-500);
  --on-primary: var(--color-white);
  --border-light: var(--color-gray-100);

  /* Typographie - Tailles de police */
  --text-xs: clamp(var(--text-12), 0.7174rem + 0.2174vw, var(--text-14));
  --text-s: var(--text-14);
  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));
  --text-l: clamp(var(--text-18), 1.0761rem + 0.2174vw, var(--text-20));
  --text-xl: clamp(var(--text-20), 1.0054rem + 1.087vw, var(--text-30));

  /* Typographie - Line heights */
  --line-height-xs: 1.2;
  --line-height-s: 1.3;
  --line-height-m: clamp(1.4, 1.3 + 0.1vw, 1.5);

  /* Espacements - Variables */
  --spacing-s: clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16));
  --spacing-m: clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32));
  --spacing-l: clamp(var(--spacing-32), 1.1818rem + 3.6364vw, var(--spacing-64));
}
`;

// NOUVELLE REGEX : Capturer TOUTE la section typo jusqu'à "Espacements" ou fin
const typoMatch = sampleTokensCss.match(
  /\/\* Typographie[^*]*\*\/[\s\S]*?(?=\n\s*\/\* Espacements|\n\s*}$)/
);

// Regex pour extraire la section spacing (jusqu'à fin)
const spacingMatch = sampleTokensCss.match(
  /\/\* Espacements[^*]*\*\/[\s\S]*?(?=\n\s*}$)/
);

// Regex pour extraire UNIQUEMENT la section couleurs (avant typo/spacing)
const colorSectionMatch = sampleTokensCss.match(
  /^[\s\S]*?(?=\n\s*\/\* Typographie|\n\s*\/\* Espacements|\n\s*}$)/
);

console.log("=== SECTION TYPO (avec line-heights) ===");
if (typoMatch) {
  console.log(typoMatch[0]);
  console.log("\n✅ Longueur:", typoMatch[0].length, "caractères");
} else {
  console.log("❌ Aucune section trouvée");
}

console.log("\n=== SECTION SPACING ===");
if (spacingMatch) {
  console.log(spacingMatch[0]);
} else {
  console.log("❌ Aucune section trouvée");
}

console.log("\n=== SECTION COULEURS (partielle) ===");
if (colorSectionMatch) {
  console.log(colorSectionMatch[0]);
  console.log("\n+ fermeture }\n");
} else {
  console.log("❌ Aucune section trouvée");
}
