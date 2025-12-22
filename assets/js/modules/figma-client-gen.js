// Client-side port of scripts/figma-import.js (generation logic)
// Exposes generateCanonicalThemeFromFigma({ primitives, fonts, tokenColors })
// which returns { themeCss, tokensCss }

import { getCanonicalCache } from "./canonical-loader.js"

/**
 * Extrait l'en-tête du theme.css (avant :root {)
 * Contient : @custom-media + stylelint comments
 * @returns {string} Le header avec @custom-media et commentaires stylelint
 */
function buildThemeHeader() {
  const canonicals = getCanonicalCache()

  if (!canonicals?.primitives?.commons?.raw) {
    console.warn("[buildThemeHeader] ⚠️ commons.raw introuvable")
    return ""
  }

  const commonsRaw = canonicals.primitives.commons.raw

  // Extraire tout AVANT ":root {"
  const rootIndex = commonsRaw.indexOf(":root {")
  if (rootIndex === -1) {
    console.warn("[buildThemeHeader] ⚠️ :root { introuvable dans commons.raw")
    return commonsRaw // Retourner tout le contenu par sécurité
  }

  // Récupérer les lignes avant :root et nettoyer les espaces de fin
  const header = commonsRaw.slice(0, rootIndex).trimEnd()

  return header
}

/**
 * Extrait le contenu entre :root { et } d'un fichier CSS
 * @param {string} cssContent - Contenu CSS
 * @returns {string} Contenu entre :root { et } (sans les accolades)
 */
function extractRootContent(cssContent) {
  const rootStart = cssContent.indexOf(":root {")
  if (rootStart === -1) return ""

  const contentStart = rootStart + ":root {".length
  const closingBrace = cssContent.lastIndexOf("}")

  if (closingBrace === -1) return ""

  // Ne pas trim pour préserver l'indentation des lignes
  let content = cssContent.slice(contentStart, closingBrace)

  // Supprimer uniquement le premier saut de ligne si présent
  if (content.startsWith("\n")) {
    content = content.slice(1)
  }

  // Supprimer les espaces/sauts de ligne à la fin
  content = content.trimEnd()

  return content
}

/**
 * Collecte toutes les primitives canoniques avec leurs commentaires
 * @param {Object} options - Options de collecte
 * @param {boolean} options.includeFonts - Inclure les sections typographiques canoniques
 * @param {boolean} options.includeSpacings - Inclure les espacements canoniques
 * @returns {Array<{comment: string, content: string}>} Sections ordonnées
 */
function collectCanonicalPrimitives({
  includeFonts = true,
  includeSpacings = true,
  includeColors = true,
} = {}) {
  const canonicals = getCanonicalCache()

  if (!canonicals?.primitives) {
    console.warn("[collectCanonicalPrimitives] ⚠️ Primitives introuvables")
    return []
  }

  const sections = []
  const { commons, colors, spacings, radius, fonts } = canonicals.primitives

  // 1. Extraire les sections de commons (breakpoints, transitions, z-index)
  if (commons?.raw) {
    const commonsContent = extractRootContent(commons.raw)
    const lines = commonsContent.split("\n")
    let currentSection = { comment: "", content: [] }

    for (const line of lines) {
      if (line.trim().startsWith("/*") && line.trim().endsWith("*/")) {
        // Nouveau commentaire de section
        if (currentSection.content.length > 0) {
          // Sauvegarder la section précédente
          sections.push({
            comment: currentSection.comment,
            content: currentSection.content.join("\n"),
          })
        }
        currentSection = { comment: line.trim(), content: [] }
      } else if (line.trim().length > 0) {
        // Ligne de contenu
        currentSection.content.push(line)
      }
    }

    // Sauvegarder la dernière section de commons
    if (currentSection.content.length > 0) {
      sections.push({
        comment: currentSection.comment,
        content: currentSection.content.join("\n"),
      })
    }
  }

  // 2. Couleurs (globales) - extraire uniquement si includeColors = true
  if (includeColors && colors?.raw) {
    const colorsContent = extractRootContent(colors.raw)
    const lines = colorsContent.split("\n")
    let inGlobalColors = false
    const globalColorLines = []

    for (const line of lines) {
      const trimmed = line.trim()

      // Détecter le début de la section "Couleurs (globales)"
      if (trimmed === "/* Couleurs (globales) */") {
        inGlobalColors = true
        continue
      }

      // Détecter le début d'une autre section (commentaire suivant)
      if (
        inGlobalColors &&
        trimmed.startsWith("/*") &&
        trimmed.endsWith("*/")
      ) {
        break // Fin de la section globales
      }

      // Collecter les lignes de la section globales
      if (inGlobalColors && trimmed.length > 0) {
        globalColorLines.push(line)
      }
    }

    if (globalColorLines.length > 0) {
      sections.push({
        comment: "/* Couleurs (globales) */",
        content: globalColorLines.join("\n"),
      })
    }
  }

  // 3. Espacements - Uniquement si includeSpacings = true
  if (includeSpacings && spacings?.raw) {
    const spacingsContent = extractRootContent(spacings.raw)
    const lines = spacingsContent.split("\n")
    // Filtrer le commentaire et les lignes vides, garder l'indentation originale
    const contentLines = lines.filter((line) => {
      const trimmed = line.trim()
      return trimmed.length > 0 && trimmed !== "/* Espacements */"
    })
    sections.push({
      comment: "/* Espacements */",
      content: contentLines.join("\n"),
    })
  }

  // 4. Border radius
  if (radius?.raw) {
    const radiusContent = extractRootContent(radius.raw)
    const lines = radiusContent.split("\n")
    // Filtrer le commentaire et les lignes vides, garder l'indentation originale
    const contentLines = lines.filter((line) => {
      const trimmed = line.trim()
      return trimmed.length > 0 && trimmed !== "/* Border radius */"
    })
    sections.push({
      comment: "/* Border radius */",
      content: contentLines.join("\n"),
    })
  }

  // 5. Typographie (3 sections : familles, graisses, tailles+line-height)
  // Uniquement si includeFonts = true
  if (includeFonts && fonts?.raw) {
    const fontsContent = extractRootContent(fonts.raw)
    const lines = fontsContent.split("\n")
    let currentSection = { comment: "", content: [] }

    for (const line of lines) {
      if (line.trim().startsWith("/*") && line.trim().endsWith("*/")) {
        // Nouveau commentaire de section
        if (currentSection.content.length > 0) {
          sections.push({
            comment: currentSection.comment,
            content: currentSection.content.join("\n"),
          })
        }
        currentSection = { comment: line.trim(), content: [] }
      } else if (line.trim().length > 0) {
        currentSection.content.push(line)
      }
    }

    // Sauvegarder la dernière section de fonts
    if (currentSection.content.length > 0) {
      sections.push({
        comment: currentSection.comment,
        content: currentSection.content.join("\n"),
      })
    }
  }

  return sections
}

/**
 * Génère les 7 nuances de Raspberry (placeholder)
 * @returns {string} CSS des couleurs raspberry
 */
function generateRaspberryColors() {
  return `  --color-raspberry-100: oklch(0.95 0.05 10);
  --color-raspberry-200: oklch(0.85 0.1 10);
  --color-raspberry-300: oklch(0.75 0.15 10);
  --color-raspberry-400: oklch(0.65 0.18 10);
  --color-raspberry-500: oklch(0.55 0.2 10);
  --color-raspberry-600: oklch(0.45 0.18 10);
  --color-raspberry-700: oklch(0.35 0.15 10);`
}

/**
 * Parse les variables CSS personnalisées depuis le textarea
 * @param {string} customVarsText - Contenu du textarea
 * @returns {string} CSS formaté des variables personnalisées
 */
function parseCustomColors(customVarsText) {
  if (!customVarsText || !customVarsText.trim()) {
    return ""
  }

  const lines = customVarsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.startsWith("--"))

  return lines.map((line) => `  ${line}`).join("\n")
}

/**
 * Extrapole des nuances de couleurs à partir des couleurs custom
 * @param {string} customVarsText - Contenu du textarea avec variables custom
 * @returns {string} CSS des couleurs extrapolées
 */
function extrapolateCustomColors(customVarsText) {
  if (!customVarsText || !customVarsText.trim()) {
    return ""
  }

  // Extraire les couleurs définies dans le textarea
  const colorVarRegex = /--(color-[a-z0-9-]+):\s*oklch\(([^)]+)\)/gi
  const matches = [...customVarsText.matchAll(colorVarRegex)]

  if (matches.length === 0) {
    return ""
  }

  const extrapolated = []

  // Pour chaque couleur trouvée, générer 5 nuances (si pas déjà une nuance)
  matches.forEach((match) => {
    const varName = match[1] // Ex: "color-brand"
    const oklchValues = match[2] // Ex: "0.55 0.2 10"

    // Ignorer si c'est déjà une nuance (ex: color-brand-500)
    if (/-\d{3}$/.test(varName)) {
      return
    }

    // Parser les valeurs OKLCH
    const [l, c, h] = oklchValues.split(/\s+/).map(Number)

    if (isNaN(l) || isNaN(c) || isNaN(h)) {
      return
    }

    // Générer 5 nuances
    const shades = [
      { suffix: "100", lightness: Math.min(0.95, l + 0.3) },
      { suffix: "300", lightness: Math.min(0.9, l + 0.15) },
      { suffix: "500", lightness: l },
      { suffix: "700", lightness: Math.max(0.2, l - 0.15) },
      { suffix: "900", lightness: Math.max(0.1, l - 0.3) },
    ]

    shades.forEach(({ suffix, lightness }) => {
      const shadeName = `--${varName}-${suffix}`
      const shadeValue = `oklch(${formatNumber(lightness)} ${c} ${h})`
      extrapolated.push(`  ${shadeName}: ${shadeValue};`)
    })
  })

  return extrapolated.join("\n")
}

/**
 * Collecte les sections de couleurs selon le contexte
 * @param {Object} options - Options de collecte
 * @param {boolean} options.hasFigmaImport - Présence d'un import Figma
 * @param {string} options.customColors - Contenu du textarea custom
 * @param {boolean} options.shouldExtrapolate - Activer l'extrapolation
 * @param {Array} options.figmaColors - Couleurs importées depuis Figma
 * @returns {Array<{comment: string, content: string}>} Sections de couleurs
 */
function collectFigmaColors({
  hasFigmaImport = false,
  customColors = "",
  shouldExtrapolate = false,
  figmaColors = [],
} = {}) {
  const sections = []

  // 1. Raspberry placeholder (UNIQUEMENT si pas d'import Figma)
  if (!hasFigmaImport) {
    sections.push({
      comment: "/* Couleur projet placeholder : raspberry */",
      content: generateRaspberryColors(),
    })
  }

  // 2. Couleurs personnalisées (depuis textarea)
  const customContent = parseCustomColors(customColors)
  if (customContent) {
    sections.push({
      comment: "/* Couleurs personnalisées */",
      content: customContent,
    })
  }

  // 3. Couleurs personnalisées extrapolées (UNIQUEMENT depuis custom, PAS Figma)
  if (shouldExtrapolate && customColors) {
    const extrapolatedContent = extrapolateCustomColors(customColors)
    if (extrapolatedContent) {
      sections.push({
        comment: "/* Couleurs personnalisées extrapolées */",
        content: extrapolatedContent,
      })
    }
  }

  // 4. Couleurs du projet (depuis Figma)
  if (hasFigmaImport && figmaColors && figmaColors.length > 0) {
    const figmaContent = figmaColors
      .map((color) => `  ${color.name}: ${color.value};`)
      .join("\n")

    if (figmaContent) {
      sections.push({
        comment: "/* Couleurs du projet */",
        content: figmaContent,
      })
    }
  }

  return sections
}

/**
 * Collecte les sections d'espacements depuis Figma
 * @param {Array} figmaSpacings - Espacements extraits depuis Figma
 * @returns {Array<{comment: string, content: string}>} Section d'espacements
 */
function collectFigmaSpacings(figmaSpacings = []) {
  const sections = []

  if (figmaSpacings && figmaSpacings.length > 0) {
    // Trier les espacements par valeur numérique croissante
    // Convertir rem en nombre pour le tri (ex: "0.125rem" -> 0.125)
    const sortedSpacings = [...figmaSpacings].sort((a, b) => {
      const getNumericValue = (value) => {
        if (value === "0") return 0
        // Extraire le nombre depuis "0.125rem", "1rem", etc.
        const match = value.match(/^([\d.]+)/)
        return match ? parseFloat(match[1]) : 0
      }
      return getNumericValue(a.value) - getNumericValue(b.value)
    })

    const spacingsContent = sortedSpacings
      .map((spacing) => `  ${spacing.name}: ${spacing.value};`)
      .join("\n")

    if (spacingsContent) {
      sections.push({
        comment: "/* Espacements */",
        content: spacingsContent,
      })
    }
  }

  return sections
}

/**
 * Fusionne toutes les sections dans le bon ordre pour générer theme.css
 * @param {Object} options - Options de fusion
 * @param {string} options.header - Header avec @custom-media et stylelint
 * @param {Array} options.canonicalPrimitives - Sections canoniques
 * @param {Array} options.colorSections - Sections de couleurs (raspberry, custom, extrapolated, figma)
 * @param {Array} options.spacingSections - Sections d'espacements depuis Figma
 * @returns {string} Contenu complet du theme.css
 */
function mergeSections({
  header,
  canonicalPrimitives,
  colorSections,
  spacingSections,
} = {}) {
  const output = []

  // 1. Header (@custom-media + stylelint)
  if (header) {
    output.push(header)
    output.push("") // Ligne vide après le header
  }

  // 2. Ouverture du :root
  output.push(":root {")

  // 3. Sections canoniques (breakpoints, transitions, z-index, colors globales, spacings, radius, fonts)
  if (canonicalPrimitives && canonicalPrimitives.length > 0) {
    canonicalPrimitives.forEach((section) => {
      if (section.comment) {
        output.push("") // Ligne vide avant le commentaire
        output.push(`  ${section.comment}`)
      }
      if (section.content) {
        output.push(section.content)
      }
    })
  }

  // 4. Sections d'espacements depuis Figma (remplacent les espacements canoniques si présents)
  if (spacingSections && spacingSections.length > 0) {
    spacingSections.forEach((section) => {
      if (section.comment) {
        output.push("") // Ligne vide avant le commentaire
        output.push(`  ${section.comment}`)
      }
      if (section.content) {
        output.push(section.content)
      }
    })
  }

  // 5. Sections de couleurs projet (raspberry/custom/extrapolated/figma)
  if (colorSections && colorSections.length > 0) {
    colorSections.forEach((section) => {
      if (section.comment) {
        output.push("") // Ligne vide avant le commentaire
        output.push(`  ${section.comment}`)
      }
      if (section.content) {
        output.push(section.content)
      }
    })
  }

  // 6. Fermeture du :root
  output.push("}")

  // Joindre toutes les lignes avec retours à la ligne
  return output.join("\n")
}

/**
 * Extrait et convertit les couleurs projet depuis Figma JSON
 * Gère 2 cas :
 * 1. Couleurs avec aliasName (Token colors.json) → Extraire primitive référencée
 * 2. Couleurs directes (Primitives.json) → Convertir directement en CSS
 * @param {Array} figmaVariables - Variables COLOR importées depuis JSON
 * @returns {Array<{name: string, value: string}>} Primitives de couleurs formatées
 */
function extractFigmaColors(figmaVariables = []) {
  const primitiveMap = new Map() // Pour éviter les doublons

  // Liste des couleurs canoniques globales à exclure
  const canonicalGlobalColors = new Set([
    "--color-white",
    "--color-black",
    "--color-gray-50",
    "--color-gray-100",
    "--color-gray-200",
    "--color-gray-300",
    "--color-gray-400",
    "--color-gray-500",
    "--color-gray-600",
    "--color-gray-700",
    "--color-gray-800",
    "--color-gray-900",
    "--color-error-100",
    "--color-error-200",
    "--color-error-300",
    "--color-error-500",
    "--color-error-700",
    "--color-error-900",
    "--color-success-100",
    "--color-success-300",
    "--color-success-500",
    "--color-success-700",
    "--color-success-900",
    "--color-warning-100",
    "--color-warning-300",
    "--color-warning-500",
    "--color-warning-700",
    "--color-warning-900",
    "--color-info-100",
    "--color-info-300",
    "--color-info-500",
    "--color-info-700",
    "--color-info-900",
  ])

  for (const v of figmaVariables) {
    // On cherche uniquement les tokens COLOR
    if (v.type !== "COLOR") continue

    const resolvedModes = v.resolvedValuesByMode || {}

    // Pour chaque mode (light/dark), extraire les couleurs
    for (const [modeKey, modeData] of Object.entries(resolvedModes)) {
      if (!modeData) continue

      const aliasName = modeData.aliasName // Ex: "color/pink/700" (Token colors.json)
      const resolvedValue = modeData.resolvedValue // RGB object

      if (!resolvedValue) continue

      let cssVarName

      if (aliasName) {
        // CAS 1 : Token avec alias (Token colors.json)
        // "color/pink/700" → "--color-pink-700"
        cssVarName = sanitizeVarName(aliasName)
      } else {
        // CAS 2 : Couleur directe (Primitives.json)
        // "colors/primary/Neptune" → "--color-primary-neptune"
        cssVarName = sanitizeVarName(v.name)
      }

      // Exclure les canoniques globales (gray, error, success, warning, info)
      if (canonicalGlobalColors.has(cssVarName)) continue

      // Si cette primitive n'existe pas encore dans la Map, l'ajouter
      if (!primitiveMap.has(cssVarName)) {
        const css = figmaColorToCss(resolvedValue)
        if (css) {
          primitiveMap.set(cssVarName, css)
        }
      }
    }
  }

  // Convertir la Map en tableau
  const colors = []
  for (const [name, value] of primitiveMap.entries()) {
    colors.push({ name, value })
  }

  return colors
}

/**
 * Extrait les espacements depuis les variables Figma (Primitives.json)
 * @param {Array} figmaVariables - Variables depuis Primitives.json
 * @returns {Array<{name: string, value: string}>} Espacements extraits
 */
function extractFigmaSpacings(figmaVariables = []) {
  const spacings = []

  for (const v of figmaVariables) {
    // On cherche uniquement les tokens FLOAT avec "spacing" ou "space" dans le nom
    if (v.type !== "FLOAT") continue

    const name = String(v.name || "").toLowerCase()
    if (!name.includes("spacing") && !name.includes("space")) continue

    const resolvedModes = v.resolvedValuesByMode || {}

    // Pour chaque mode, extraire la valeur
    for (const [modeKey, modeData] of Object.entries(resolvedModes)) {
      if (!modeData) continue

      const resolvedValue = modeData.resolvedValue
      if (typeof resolvedValue !== "number") continue

      // Convertir le nom Figma en nom de variable CSS
      const cssVarName = sanitizeVarName(v.name)
      // Convertir la valeur en rem
      const cssValue = pxToRem(resolvedValue)

      spacings.push({ name: cssVarName, value: cssValue })
      break // Un seul mode suffit pour les spacings
    }
  }

  return spacings
}

/**
 * Génère les tokens sémantiques de couleurs depuis Token colors.json
 * Convertit les VARIABLE_ALIAS en light-dark() ou var() selon les modes
 * @param {Array} tokenColorsVariables - Variables depuis Token colors.json
 * @returns {Array<string>} Lignes CSS des tokens sémantiques
 */
function generateSemanticColorTokens(tokenColorsVariables = []) {
  const lines = []
  const needColorScheme = false // Sera true si on détecte des light-dark()

  for (const v of tokenColorsVariables) {
    if (v.type !== "COLOR") continue

    const name = sanitizeVarName(v.name || "")
    const resolvedModes = v.resolvedValuesByMode || {}
    const modeKeys = Object.keys(resolvedModes)

    if (modeKeys.length === 0) continue

    // Extraire les aliasName pour chaque mode
    const aliases = modeKeys.map((key) => {
      const data = resolvedModes[key]
      return data?.aliasName ? sanitizeVarName(data.aliasName) : null
    })

    // Vérifier si tous les modes pointent vers la même primitive
    const uniqueAliases = [...new Set(aliases.filter(Boolean))]

    if (uniqueAliases.length === 0) continue

    if (uniqueAliases.length === 1) {
      // Même primitive pour tous les modes → var()
      lines.push(`  ${name}: var(${uniqueAliases[0]});`)
    } else {
      // Différentes primitives selon le mode → light-dark()
      const lightAlias = aliases[0]
      const darkAlias = aliases[1]
      if (lightAlias && darkAlias) {
        lines.push(
          `  ${name}: light-dark(var(${lightAlias}), var(${darkAlias}));`,
        )
      }
    }
  }

  return lines
}

/**
 * Génère le fichier theme.css complet (primitives)
 * @param {Object} options - Options de génération
 * @param {Array} options.figmaPrimitives - Variables primitives importées depuis Figma (Primitives.json)
 * @param {Array} options.figmaTokenColors - Variables token colors importées depuis Figma (Token colors.json)
 * @param {string} options.customColors - Contenu du textarea custom
 * @param {boolean} options.shouldExtrapolate - Activer l'extrapolation des couleurs custom
 * @returns {{themeCss: string, figmaColors: Array}} Contenu CSS et couleurs extraites
 */
function generateThemeCss({
  figmaPrimitives = [],
  figmaTokenColors = [],
  customColors = "",
  shouldExtrapolate = false,
} = {}) {
  const canonicals = getCanonicalCache()

  if (!canonicals) {
    console.error("[generateThemeCss] ⚠️ Canoniques non chargés")
    return { themeCss: "", figmaColors: [] }
  }

  // 1. Construire le header (@custom-media + stylelint)
  const header = buildThemeHeader()

  // 2. Déterminer si on a des fonts depuis Figma
  const hasFigmaFonts =
    figmaPrimitives &&
    figmaPrimitives.some((v) => {
      const name = String(v.name || "").toLowerCase()
      // Exclure les espacements
      if (name.includes("spacing") || name.includes("space")) {
        return false
      }
      // Vérifier uniquement les noms liés aux fonts (avec ou sans tiret)
      return (
        name.includes("font") ||
        name.includes("text") ||
        name.includes("line-height") ||
        name.includes("lineheight") ||
        name.includes("leading")
      )
    })

  // 2b. Déterminer si on a des espacements depuis Figma
  const hasFigmaSpacings =
    figmaPrimitives &&
    figmaPrimitives.some((v) => {
      const name = String(v.name || "").toLowerCase()
      return name.includes("spacing") || name.includes("space")
    })

  // 3. Extraire les espacements depuis Figma si présents
  const figmaSpacings = hasFigmaSpacings
    ? extractFigmaSpacings(figmaPrimitives)
    : []

  if (figmaSpacings.length > 0) {
  }

  // 4. Extraire et convertir les couleurs projet depuis TOUTES les sources Figma
  // Cas 1 : Couleurs directes depuis Primitives.json (colors/primary/Neptune)
  // Cas 2 : Couleurs référencées depuis Token colors.json (aliasName)
  const colorsFromPrimitives = extractFigmaColors(figmaPrimitives)
  const colorsFromTokens = extractFigmaColors(figmaTokenColors)

  // Fusionner les deux sources (Map pour éviter doublons)
  const figmaColorsMap = new Map()
  ;[...colorsFromPrimitives, ...colorsFromTokens].forEach((color) => {
    if (!figmaColorsMap.has(color.name)) {
      figmaColorsMap.set(color.name, color.value)
    }
  })

  const figmaColors = Array.from(figmaColorsMap.entries()).map(
    ([name, value]) => ({ name, value }),
  )
  const hasFigmaImport = figmaColors.length > 0

  // 5. Collecter les primitives canoniques
  // NE PAS inclure les fonts/spacings canoniques si on a les équivalents depuis Figma
  // Les couleurs globales (white, black, gray, error, etc.) sont TOUJOURS incluses
  const canonicalPrimitives = collectCanonicalPrimitives({
    includeFonts: !hasFigmaFonts,
    includeSpacings: !hasFigmaSpacings,
    includeColors: true, // Toujours inclure les couleurs globales
  })

  if (figmaColors.length > 0) {
  }

  // 6. Collecter les sections de couleurs projet
  const colorSections = collectFigmaColors({
    hasFigmaImport,
    customColors,
    shouldExtrapolate,
    figmaColors,
  })

  // 7. Collecter les sections d'espacements depuis Figma
  const spacingSections = collectFigmaSpacings(figmaSpacings)

  if (spacingSections.length > 0) {
  }

  // 8. Fusionner toutes les sections
  const themeCss = mergeSections({
    header,
    canonicalPrimitives,
    spacingSections,
    colorSections,
  })

  return { themeCss, figmaColors }
}

function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function linearRgbToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  return { L, a, b: b_ }
}

function oklabToOklch(L, a, b) {
  const C = Math.sqrt(a * a + b * b)
  let h = Math.atan2(b, a) * (180 / Math.PI)
  if (h < 0) h += 360
  return { L, C, h }
}

function formatNumber(n) {
  const s = Number(n).toFixed(4)
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}

function figmaColorToCss(c) {
  const r = srgbToLinear(Number(c.r))
  const g = srgbToLinear(Number(c.g))
  const b = srgbToLinear(Number(c.b))
  const { L, a, b: bb } = linearRgbToOklab(r, g, b)
  const { C, h } = oklabToOklch(L, a, bb)
  const Lstr = formatNumber(L)
  const Cstr = formatNumber(C)
  const Hstr = formatNumber(h)
  const alpha = typeof c.a === "number" ? formatNumber(c.a) : null
  const base = `oklch(${Lstr} ${Cstr} ${Hstr}`
  return alpha && alpha !== "1" ? `${base} / ${alpha})` : base + `)`
}

function pxToRem(px) {
  const rem = Number(px) / 16
  if (Number(px) === 0) return "0"
  return formatNumber(rem) + "rem"
}

function sanitizeVarName(name) {
  let sanitized = String(name)
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase()
  // Cas spécial : "colors/..." doit devenir "color-..." (singulier)
  // pour correspondre à la convention de nommage des primitives
  if (sanitized.startsWith("colors-")) {
    sanitized = "color-" + sanitized.slice(7)
  }
  return "--" + sanitized
}

function fontVarName(figmaName) {
  const parts = String(figmaName).split("/")
  const first = (parts[0] || "").toLowerCase()
  const last = parts[parts.length - 1]
  const cleaned = String(last).replace(/\s+/g, "-").toLowerCase()

  // Ajouter le préfixe approprié si absent
  const fontSizePrefixes = ["fontsize", "font-size", "text", "textsize"]
  const lineHeightPrefixes = ["lineheight", "line-height", "leading"]

  // Si le nom nettoyé est juste un nombre, ajouter le préfixe basé sur la catégorie
  if (/^\d+$/.test(cleaned)) {
    if (fontSizePrefixes.includes(first)) {
      return `--text-${cleaned}`
    } else if (lineHeightPrefixes.includes(first)) {
      return `--line-height-${cleaned}`
    }
  }

  return "--" + cleaned
}

// Local storage for synthesized project semantics when generating
// This replaces previous usage of `generate._projectSemantics` which
// caused a ReferenceError in the browser environment.
const PROJECT_SEMANTICS = []

/**
 * Regroupe et trie les tokens de couleurs par catégories sémantiques
 * @param {string[]} colorLines - Lignes de tokens (ex: "  --primary: var(--color-blue-500);")
 * @returns {string} - Tokens regroupés et commentés par catégorie
 */
function organizeColorTokens(colorLines) {
  const categories = {
    primary: {
      comment: "/* Couleur primaire */",
      tokens: [],
      patterns: [/^--primary:/, /^--on-primary:/],
    },
    accent: {
      comment: "/* Couleur d'accent */",
      tokens: [],
      patterns: [/^--accent:/, /^--accent-invert:/],
    },
    surface: {
      comment: "/* Surface du document */",
      tokens: [],
      patterns: [/^--surface:/, /^--on-surface:/],
    },
    layers: {
      comment: "/* Niveaux de profondeur */",
      tokens: [],
      patterns: [/^--layer/],
    },
    interactions: {
      comment: "/* Interactions */",
      tokens: [],
      patterns: [/^--link/],
    },
    states: {
      comment: "/* États */",
      tokens: [],
      patterns: [/^--warning:/, /^--error:/, /^--success:/, /^--info:/],
    },
    borders: {
      comment: "/* Bordures */",
      tokens: [],
      patterns: [/^--border/],
    },
    other: {
      comment: "/* Autres couleurs */",
      tokens: [],
      patterns: [],
    },
  }

  // Classifier chaque token
  for (const line of colorLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("/*")) continue

    let classified = false
    for (const [key, category] of Object.entries(categories)) {
      if (key === "other") continue
      for (const pattern of category.patterns) {
        if (pattern.test(trimmed)) {
          category.tokens.push(line)
          classified = true
          break
        }
      }
      if (classified) break
    }

    if (!classified) {
      categories.other.tokens.push(line)
    }
  }

  // Construire la sortie avec commentaires par catégorie
  const output = []
  const order = [
    "primary",
    "accent",
    "surface",
    "layers",
    "interactions",
    "states",
    "borders",
    "other",
  ]

  for (const key of order) {
    const category = categories[key]
    if (category.tokens.length > 0) {
      if (output.length > 0) output.push("") // Ligne vide entre catégories
      output.push(category.comment)
      output.push(...category.tokens)
    }
  }

  return output.join("\n")
}

export function generateCanonicalThemeFromFigma({
  primitives,
  fonts,
  tokenColors,
  // Flag: when true, synthesize project primitives (extrapolated colors)
  // from semantic tokens and aliases; when false, skip emitting the
  // "Couleurs personnalisées (projet) - primitives synthétisées" block.
  synthesizeProjectPrimitives = false,
  // Couleurs personnalisées depuis textarea (optionnel)
  customColors = "",
  // Mode thème depuis l'UI : "light", "dark", ou "both"
  themeMode = "both",
} = {}) {
  // Debug: in-browser callers sometimes pass unexpected arrays due to
  // classification bugs or caching; log counts to help diagnose missing
  // primitives reported by tokens generation.
  try {
    const pcount =
      (primitives && primitives.variables && primitives.variables.length) || 0
    const tcount =
      (tokenColors && tokenColors.variables && tokenColors.variables.length) ||
      0
    const fcount = (fonts && fonts.variables && fonts.variables.length) || 0

    try {
      if (
        typeof window !== "undefined" &&
        window.__PRIMARY_STATE &&
        window.__PRIMARY_STATE._debug
      ) {
        window.__PRIMARY_STATE._logs = window.__PRIMARY_STATE._logs || []
        window.__PRIMARY_STATE._logs.push({
          tag: "figma-gen-debug",
          primitives: pcount,
          tokenColors: tcount,
          fonts: fcount,
          ts: Date.now(),
        })
      }
    } catch (e) {
      /* noop */
    }
  } catch (e) {
    /* noop */
  }
  // Reset any previously synthesized semantics to ensure each invocation is
  // pure and doesn't accumulate results from earlier runs (prevents
  // "invented" variables persisting across multiple calls).
  PROJECT_SEMANTICS.length = 0
  // primitives, fonts, tokenColors are objects parsed from respective JSON files
  primitives = primitives || { variables: [] }
  fonts = fonts || { variables: [] }
  tokenColors = tokenColors || { variables: [] }

  // NOUVEAU : Génération propre avec fonctions helper

  // Générer theme.css (primitives) avec la nouvelle architecture
  // ATTENTION : On utilise let car le code legacy modifie themeCss après (fonts primitives)
  // Fusionner primitives + fonts pour la détection hasFigmaFonts
  const allFigmaVariables = [
    ...(primitives.variables || []),
    ...(fonts.variables || []),
  ]
  const { themeCss: generatedThemeCss, figmaColors } = generateThemeCss({
    figmaPrimitives: allFigmaVariables,
    figmaTokenColors: tokenColors.variables || [],
    customColors: customColors || "",
    shouldExtrapolate: synthesizeProjectPrimitives,
  })

  let themeCss = generatedThemeCss

  // Continue avec la génération de tokensCss (à refactoriser plus tard)
  // NOTE: PROJECT_SEMANTICS sera peuplé par la génération de tokensCss ci-dessous
  PROJECT_SEMANTICS.length = 0

  // Détecter la couleur primaire depuis figmaColors
  let detectedPrimaryColor = null

  if (figmaColors.length > 0) {
    // Stratégie : chercher une couleur "primary" en priorité
    const primaryColor = figmaColors.find((c) => c.name.includes("-primary-"))
    const targetColor = primaryColor || figmaColors[0]

    // Extraire le nom de base (sans suffixes type -light, -dark, -medium, -extralight)
    // Ex: "--color-primary-neptune" → "neptune"
    // Ex: "--color-primary-neptune-light" → "neptune"
    const name = targetColor.name
    const parts = name.split("-")

    // Trouver la partie principale (après "color" et category "primary/secondary/tertiary")
    const colorIndex = parts.indexOf("color")

    if (colorIndex !== -1 && parts.length > colorIndex + 2) {
      // Prendre la partie après la catégorie (primary/secondary/tertiary)
      const baseName = parts[colorIndex + 2]

      // Exclure les suffixes connus
      if (!["light", "dark", "medium", "extralight"].includes(baseName)) {
        detectedPrimaryColor = baseName
      }
    }
  }

  // Continue with fonts primitives processing from fonts.variables
  // Build tokensCss similar to Node logic with dynamic header
  const primaryColorLine = detectedPrimaryColor
    ? `\n * - Couleur primaire : ${detectedPrimaryColor}`
    : ""

  let tokensCss = `/* ----------------------------------
 * Theme-tokens, généré par primary.alsacreations.com
 * Surcouche de theme.css
 * Configuration :${primaryColorLine}
 * - Theme : light et dark
 * - Typographie responsive : oui
 * - Espacements responsive : oui
 * ----------------------------------
 */

:root {
`

  // Générer les tokens sémantiques de couleurs depuis tokenColors
  const semanticColorLines = generateSemanticColorTokens(
    tokenColors.variables || [],
  )
  const hasSemanticColors = semanticColorLines.length > 0

  // Détection du besoin de color-scheme (si des light-dark() sont présents)
  const needsColorScheme =
    hasSemanticColors &&
    semanticColorLines.some((line) => line.includes("light-dark("))

  if (needsColorScheme) {
  }

  // Injecter color-scheme si nécessaire
  if (needsColorScheme) {
    const cs = `  color-scheme: light dark;\n\n  &[data-theme="light"] {\n    color-scheme: light;\n  }\n\n  &[data-theme="dark"] {\n    color-scheme: dark;\n  }\n\n`
    tokensCss = tokensCss.replace(":root {\n", `:root {\n${cs}`)
  }

  // Injecter les tokens sémantiques de couleurs
  if (hasSemanticColors) {
    // Regrouper et organiser les tokens par catégories sémantiques
    const organizedTokens = organizeColorTokens(semanticColorLines)
    tokensCss += `\n  /* Color Tokens */\n`
    tokensCss += organizedTokens + "\n"
  }

  // Legacy: support PROJECT_SEMANTICS si présent (pour compatibilité)
  let projectNeedColorScheme = false
  if (PROJECT_SEMANTICS && PROJECT_SEMANTICS.length) {
    const all = PROJECT_SEMANTICS.reduce(
      (acc, cur) => {
        if (cur.lines && cur.lines.length) acc.lines.push(...cur.lines)
        if (cur.needColorScheme) acc.needColorScheme = true
        return acc
      },
      { lines: [], needColorScheme: false },
    )
    projectNeedColorScheme = Boolean(all.needColorScheme)
    if (all.needColorScheme && !needsColorScheme) {
      const cs = `  color-scheme: light dark;\n\n  &[data-theme="light"] {\n    color-scheme: light;\n  }\n\n  &[data-theme="dark"] {\n    color-scheme: dark;\n  }\n\n`
      tokensCss = tokensCss.replace(":root {\n", `:root {\n${cs}`)
    }
    if (all.lines.length) {
      tokensCss += `\n  /* Couleurs legacy (PROJECT_SEMANTICS) */\n`
      tokensCss += all.lines.join("\n") + "\n"
    }
  }

  // IMPORTANT : Le code legacy ci-dessous modifie themeCss (ajoute fonts primitives)
  // Il faut retirer le "}" final de :root avant d'ajouter du contenu
  if (themeCss.trim().endsWith("}")) {
    themeCss = themeCss.trimEnd().slice(0, -1) // Retirer le "}" final
  }

  // font sizes, line heights, and spacings
  // PRIORITÉ : Token Font.json (fonts.variables), sinon Primitives.json
  // Fusionner les deux sources pour éviter de manquer des variables
  const allFontVariables = [
    ...(fonts.variables || []),
    ...(primitives.variables || []).filter((v) => {
      const name = String(v.name || "").toLowerCase()
      // Exclure explicitement les espacements (spacing)
      if (name.includes("spacing") || name.includes("space")) {
        return false
      }
      // Inclure uniquement les variables avec des noms liés aux fonts (avec ou sans tiret)
      return (
        name.includes("font") ||
        name.includes("text") ||
        name.includes("line-height") ||
        name.includes("lineheight") ||
        name.includes("leading")
      )
    }),
  ]

  // Dédupliquer par nom
  const fontVarMap = new Map()
  for (const v of allFontVariables) {
    const key = v.name || ""
    if (!fontVarMap.has(key)) {
      fontVarMap.set(key, v)
    }
  }
  const mergedFontVariables = Array.from(fontVarMap.values())

  const fontSizes = []
  const lineHeights = []
  const spacings = []
  const spacingSemanticMap = new Map()

  for (const v of mergedFontVariables) {
    const name = v.name || ""
    const first = (name.split("/")[0] || "").toLowerCase()
    const fontSizePrefixes = new Set([
      "fontsize",
      "font-size",
      "text",
      "textsize",
    ])
    const lineHeightPrefixes = new Set(["lineheight", "line-height", "leading"])
    if (
      fontSizePrefixes.has(first) ||
      name.toLowerCase().startsWith("fontsize/")
    ) {
      const varName = fontVarName(name)
      const modes = Object.keys(v.resolvedValuesByMode || {})
      const mobileKey = modes[0]
      const desktopKey = modes[1] || mobileKey
      const mobileVal =
        v.resolvedValuesByMode[mobileKey] &&
        v.resolvedValuesByMode[mobileKey].resolvedValue
      const desktopVal =
        v.resolvedValuesByMode[desktopKey] &&
        v.resolvedValuesByMode[desktopKey].resolvedValue
      // Ne créer un token sémantique que si les valeurs mobile/desktop diffèrent
      // Si égales, c'est une primitive fixe qui restera dans primitives[]
      if (
        typeof mobileVal === "number" &&
        typeof desktopVal === "number" &&
        mobileVal !== desktopVal
      )
        fontSizes.push({
          varName,
          minRem: mobileVal / 16,
          maxRem: desktopVal / 16,
        })
    }
    if (
      lineHeightPrefixes.has(first) ||
      name.toLowerCase().startsWith("lineheight/")
    ) {
      const rawLast = name.split("/").pop().toLowerCase().replace(/\s+/g, "-")
      const key = rawLast.replace(/^(lineheight|line-height|leading)-?/, "")
      const varName = `--line-height-${key}`
      const modes = Object.keys(v.resolvedValuesByMode || {})
      const mobileKey = modes[0]
      const desktopKey = modes[1] || mobileKey
      const mobileVal =
        v.resolvedValuesByMode[mobileKey] &&
        v.resolvedValuesByMode[mobileKey].resolvedValue
      const desktopVal =
        v.resolvedValuesByMode[desktopKey] &&
        v.resolvedValuesByMode[desktopKey].resolvedValue
      // Ne créer un token sémantique que si les valeurs mobile/desktop diffèrent
      // Si égales, c'est une primitive fixe qui restera dans primitives[]
      if (
        typeof mobileVal === "number" &&
        typeof desktopVal === "number" &&
        mobileVal !== desktopVal
      )
        lineHeights.push({
          varName,
          minRem: mobileVal / 16,
          maxRem: desktopVal / 16,
        })
    }
  }

  fontSizes.sort((a, b) => a.minRem - b.minRem)
  lineHeights.sort((a, b) => a.minRem - b.minRem)

  const fontPrimitives = []
  const linePrimitives = []

  // Extraire les primitives fixes (valeurs uniques) depuis mergedFontVariables
  for (const v of mergedFontVariables) {
    const name = v.name || ""
    const first = (name.split("/")[0] || "").toLowerCase()
    const modes = Object.keys(v.resolvedValuesByMode || {})
    if (modes.length === 0) continue

    const mobileKey = modes[0]
    const desktopKey = modes[1] || mobileKey
    const mobileVal =
      v.resolvedValuesByMode[mobileKey] &&
      v.resolvedValuesByMode[mobileKey].resolvedValue
    const desktopVal =
      v.resolvedValuesByMode[desktopKey] &&
      v.resolvedValuesByMode[desktopKey].resolvedValue

    // Si valeurs égales (primitive fixe), l'ajouter directement
    if (
      typeof mobileVal === "number" &&
      typeof desktopVal === "number" &&
      mobileVal === desktopVal
    ) {
      const fontSizePrefixes = new Set([
        "fontsize",
        "font-size",
        "text",
        "textsize",
      ])
      const lineHeightPrefixes = new Set([
        "lineheight",
        "line-height",
        "leading",
      ])

      if (
        fontSizePrefixes.has(first) ||
        name.toLowerCase().startsWith("fontsize/")
      ) {
        const varName = fontVarName(name)
        const partsF = varName.slice(2).split("-")
        let prefix = partsF.slice(0, partsF.length - 1).join("-") || partsF[0]
        if (/^(lineheight|line-height|leading)$/i.test(prefix))
          prefix = "line-height"
        if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text"
        const px = Math.round(mobileVal)
        fontPrimitives.push({
          name: `--${prefix}-${px}`,
          rem: formatNumber(mobileVal / 16) + "rem",
          px: px,
        })
      } else if (
        lineHeightPrefixes.has(first) ||
        name.toLowerCase().startsWith("lineheight/")
      ) {
        const rawLast = name.split("/").pop().toLowerCase().replace(/\s+/g, "-")
        const key = rawLast.replace(/^(lineheight|line-height|leading)-?/, "")
        const varName = `--line-height-${key}`
        const partsL = varName.slice(2).split("-")
        let prefix = partsL.slice(0, partsL.length - 1).join("-") || partsL[0]
        if (/^(lineheight|line-height|leading)$/i.test(prefix))
          prefix = "line-height"
        if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text"
        const px = Math.round(mobileVal)
        linePrimitives.push({
          name: `--${prefix}-${px}`,
          rem: formatNumber(mobileVal / 16) + "rem",
          px: px,
        })
      }
    }
  }
  for (const f of fontSizes) {
    const partsF = f.varName.slice(2).split("-")
    let prefix = partsF.slice(0, partsF.length - 1).join("-") || partsF[0]
    if (/^(lineheight|line-height|leading)$/i.test(prefix))
      prefix = "line-height"
    if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text"
    const minPx = Math.round(f.minRem * 16)
    const maxPx = Math.round(f.maxRem * 16)
    fontPrimitives.push({
      name: `--${prefix}-${minPx}`,
      rem: formatNumber(f.minRem) + "rem",
      px: minPx,
    })
    fontPrimitives.push({
      name: `--${prefix}-${maxPx}`,
      rem: formatNumber(f.maxRem) + "rem",
      px: maxPx,
    })
  }
  for (const lh of lineHeights) {
    const partsL = lh.varName.slice(2).split("-")
    let prefix = partsL.slice(0, partsL.length - 1).join("-") || partsL[0]
    if (/^(lineheight|line-height|leading)$/i.test(prefix))
      prefix = "line-height"
    if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text"
    const minPx = Math.round(lh.minRem * 16)
    const maxPx = Math.round(lh.maxRem * 16)
    linePrimitives.push({
      name: `--${prefix}-${minPx}`,
      rem: formatNumber(lh.minRem) + "rem",
      px: minPx,
    })
    linePrimitives.push({
      name: `--${prefix}-${maxPx}`,
      rem: formatNumber(lh.maxRem) + "rem",
      px: maxPx,
    })
  }

  // Ajouter les primitives typo uniquement si pas déjà présentes dans themeCss
  // (pour éviter les doublons avec les primitives canoniques ou celles ajoutées avant)
  if (fontPrimitives.length) {
    const hasFontSection =
      /\/\*\s*Typographie\s*[—-]\s*Tailles de police\s*\*\//i.test(themeCss)
    if (!hasFontSection) {
      const seen = new Set()
      fontPrimitives.sort((a, b) => a.px - b.px)
      themeCss += `\n  /* Typographie — Tailles de police */\n`
      for (const p of fontPrimitives) {
        if (seen.has(p.name)) continue
        seen.add(p.name)
        themeCss += `  ${p.name}: ${p.rem};\n`
      }
    } else {
    }
  }

  // families and weights
  const families = [
    { name: "--font-base", value: "system-ui, sans-serif" },
    { name: "--font-mono", value: "ui-monospace, monospace" },
  ]
  const weights = [
    { name: "--font-weight-regular", value: "400" },
    { name: "--font-weight-semibold", value: "600" },
    { name: "--font-weight-bold", value: "700" },
    { name: "--font-weight-extrabold", value: "800" },
    { name: "--font-weight-black", value: "900" },
  ]
  const missingFamily = families.some(
    (f) => !new RegExp(`${f.name}\s*:`).test(themeCss),
  )
  const missingWeight = weights.some(
    (w) => !new RegExp(`${w.name}\s*:`).test(themeCss),
  )
  if (missingFamily || missingWeight) {
    themeCss += `\n  /* Typographie - Familles de police */\n`
    for (const f of families)
      if (!new RegExp(`${f.name}\s*:`).test(themeCss))
        themeCss += `  ${f.name}: ${f.value};\n`
    themeCss += `\n  /* Typographie - Graisses de police */\n`
    for (const w of weights)
      if (!new RegExp(`${w.name}\s*:`).test(themeCss))
        themeCss += `  ${w.name}: ${w.value};\n`
  }

  // Ajouter les primitives line-height uniquement si pas déjà présentes
  if (linePrimitives.length) {
    const hasLineHeightSection =
      /\/\*\s*Typographie\s*[—-]\s*Hauteurs de lignes\s*\*\//i.test(themeCss)
    if (!hasLineHeightSection) {
      const seenLine = new Set()
      linePrimitives.sort((a, b) => a.px - b.px)
      themeCss += `\n  /* Typographie — Hauteurs de lignes */\n`
      for (const p of linePrimitives) {
        if (seenLine.has(p.name)) continue
        seenLine.add(p.name)
        themeCss += `  ${p.name}: ${p.rem};\n`
      }
    } else {
    }
  }

  // transitions and z
  const ensureVar = (name) => new RegExp(`${name}\s*:`).test(themeCss)
  const missingTransitions = []
  if (!ensureVar("--transition-duration"))
    missingTransitions.push("  --transition-duration: 0.25s;")
  const missingZ = []
  if (!ensureVar("--z-under-page-level"))
    missingZ.push("  --z-under-page-level: -1;")
  if (!ensureVar("--z-above-page-level"))
    missingZ.push("  --z-above-page-level: 1;")
  if (!ensureVar("--z-header-level")) missingZ.push("  --z-header-level: 1000;")
  if (!ensureVar("--z-above-header-level"))
    missingZ.push("  --z-above-header-level: 2000;")
  if (!ensureVar("--z-above-all-level"))
    missingZ.push("  --z-above-all-level: 3000;")
  if (missingTransitions.length || missingZ.length) {
    themeCss += `\n  /* Transitions et animations */\n`
    missingTransitions.forEach((l) => (themeCss += l + "\n"))
    themeCss += `\n  /* Niveaux de z-index */\n`
    missingZ.forEach((l) => (themeCss += l + "\n"))
  }

  // Remettre le "}" de fermeture de :root (retiré plus haut avant les ajouts legacy)
  themeCss += "\n}"

  // Build primitiveNames set from generated themeCss
  const primitiveNames = new Set()
  const varRe = /^\s*(--[a-z0-9-]+)\s*:/gim
  let vm
  while ((vm = varRe.exec(themeCss)) !== null) primitiveNames.add(vm[1])

  function preferredValue(minRem, maxRem, wMin = 360, wMax = 1280) {
    if (minRem === maxRem) return formatNumber(minRem) + "rem"
    const D = ((maxRem - minRem) * 1600) / (wMax - wMin)
    const C = minRem - (D * wMin) / 1600
    return `${formatNumber(C)}rem + ${formatNumber(D)}vw`
  }

  // tokensCss typography
  if (fontSizes.length) {
    // Générer les tokens dans un buffer temporaire
    const fontSizeTokens = []
    for (const f of fontSizes) {
      const partsFtok = f.varName.slice(2).split("-")
      let prefix =
        partsFtok.slice(0, partsFtok.length - 1).join("-") || partsFtok[0]
      if (/^(lineheight|line-height|leading)$/i.test(prefix))
        prefix = "line-height"
      if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text"
      const minPx = Math.round(f.minRem * 16)
      const maxPx = Math.round(f.maxRem * 16)
      const minName = `--${prefix}-${minPx}`
      const maxName = `--${prefix}-${maxPx}`
      const minPart = primitiveNames.has(minName)
        ? `var(${minName})`
        : `${formatNumber(f.minRem)}rem`
      const maxPart = primitiveNames.has(maxName)
        ? `var(${maxName})`
        : `${formatNumber(f.maxRem)}rem`
      const middle = preferredValue(f.minRem, f.maxRem)
      const line = `  ${f.varName}: clamp(${minPart}, ${middle}, ${maxPart});\n`

      fontSizeTokens.push(line)
    }

    // N'ajouter le commentaire que si au moins un token a été généré
    if (fontSizeTokens.length > 0) {
      tokensCss += `\n  /* Typographie — Tailles de police */\n`
      tokensCss += fontSizeTokens.join("")
    }
  }

  if (lineHeights.length) {
    // Générer les tokens dans un buffer temporaire
    const lineHeightTokens = []
    for (const lh of lineHeights) {
      const partsLtok = lh.varName.slice(2).split("-")
      let prefix =
        partsLtok.slice(0, partsLtok.length - 1).join("-") || partsLtok[0]
      if (/^(lineheight|line-height|leading)$/i.test(prefix))
        prefix = "line-height"
      if (/^(text|fontsize|font-size)$/i.test(prefix)) prefix = "text"
      const minPx = Math.round(lh.minRem * 16)
      const maxPx = Math.round(lh.maxRem * 16)
      const minName = `--${prefix}-${minPx}`
      const maxName = `--${prefix}-${maxPx}`

      // Si minRem === maxRem (valeur fixe, non responsive)
      // Référencer directement la primitive au lieu de générer un clamp()
      if (lh.minRem === lh.maxRem) {
        const primitiveName = primitiveNames.has(minName) ? minName : null
        if (primitiveName) {
          // Ne générer un token que si le nom est différent de la primitive
          if (lh.varName !== primitiveName) {
            lineHeightTokens.push(`  ${lh.varName}: var(${primitiveName});\n`)
          }
          // Sinon, ne rien générer (évite les références circulaires)
        } else {
          // Pas de primitive trouvée, utiliser la valeur directe
          lineHeightTokens.push(
            `  ${lh.varName}: ${formatNumber(lh.minRem)}rem;\n`,
          )
        }
      } else {
        // Valeurs différentes (responsive) : générer un clamp()
        const minPart = primitiveNames.has(minName)
          ? `var(${minName})`
          : `${formatNumber(lh.minRem)}rem`
        const maxPart = primitiveNames.has(maxName)
          ? `var(${maxName})`
          : `${formatNumber(lh.maxRem)}rem`
        const middle = preferredValue(lh.minRem, lh.maxRem)
        lineHeightTokens.push(
          `  ${lh.varName}: clamp(${minPart}, ${middle}, ${maxPart});\n`,
        )
      }
    }

    // N'ajouter le commentaire que si au moins un token a été généré
    if (lineHeightTokens.length > 0) {
      tokensCss += `\n  /* Typographie — Hauteurs de lignes */\n`
      tokensCss += lineHeightTokens.join("")
    }
  }

  // spacing semantics
  const spacingMap = new Map()
  // Extraire les spacings depuis primitiveNames (déjà parsés du themeCss)
  for (const name of primitiveNames) {
    const match = name.match(/^--spacing-(\d+)$/)
    if (match) {
      const px = parseInt(match[1], 10)
      spacingMap.set(px, {
        name: name,
        rem: px / 16,
      })
    }
  }
  const findSpacingVar = (n) => {
    const candidates = [`--spacing-${n}`, `--space-${n}`, `--gap-${n}`]
    return candidates.find((c) => primitiveNames.has(c)) || null
  }
  const emitSemanticSpacing = () => {
    const lines = []
    const xsVar = findSpacingVar(4)
    if (xsVar) lines.push(`  --spacing-xs: var(${xsVar});`)
    const emitClampIf = (label, minPx, maxPx) => {
      const minVar = findSpacingVar(minPx)
      const maxVar = findSpacingVar(maxPx)
      const minEntry = spacingMap.get(minPx)
      const maxEntry = spacingMap.get(maxPx)
      if (minVar && maxVar && minEntry && maxEntry) {
        const middle = preferredValue(minEntry.rem, maxEntry.rem)
        lines.push(
          `  --spacing-${label}: clamp(var(${minVar}), ${middle}, var(${maxVar}));`,
        )
      }
    }
    emitClampIf("s", 8, 16)
    emitClampIf("m", 16, 32)
    emitClampIf("l", 24, 48)
    emitClampIf("xl", 32, 80)
    if (lines.length) {
      tokensCss += `\n  /* Espacements */\n`
      tokensCss += lines.join("\n") + "\n"
    }
  }
  emitSemanticSpacing()

  // Émettre les tokens sémantiques d'espacement venant de Figma
  if (spacingSemanticMap.size > 0) {
    if (!tokensCss.includes("/* Espacements */")) {
      tokensCss += `\n  /* Espacements */\n`
    }
    // Trier par nom sémantique pour cohérence
    const sortedSemantics = Array.from(spacingSemanticMap.entries()).sort(
      (a, b) => a[0].localeCompare(b[0]),
    )
    for (const [semanticName, primitiveName] of sortedSemantics) {
      tokensCss += `  ${semanticName}: var(${primitiveName});\n`
    }
  }

  // Forms block
  tokensCss += `\n  /* Formulaires */\n`
  // Utiliser themeMode pour déterminer si on génère light-dark()
  if (themeMode === "both") {
    tokensCss += `  --form-background: light-dark(\n    var(--color-gray-50),\n    var(--color-gray-800)\n  );\n`
    tokensCss += `  --on-form: light-dark(var(--color-gray-900), var(--color-gray-100));\n`
  } else {
    tokensCss += `  --form-background: var(--color-gray-50);\n`
    tokensCss += `  --on-form: var(--color-gray-800);\n`
  }
  tokensCss += `  --form-spacing: var(--spacing-12) var(--spacing-16);\n`
  tokensCss += `  --form-border-width: 1px;\n`
  if (themeMode === "both") {
    tokensCss += `  --form-border-color: light-dark(var(--color-gray-400), var(--color-gray-600));\n`
  } else {
    tokensCss += `  --form-border-color: var(--color-gray-400);\n`
  }
  // choose radius fallback
  ;(function () {
    const radiusCandidates = [
      "--radius-none",
      "--radius-4",
      "--radius-8",
      "--radius-12",
      "--radius-16",
      "--radius-24",
      "--radius-full",
    ]
    let chosen = radiusCandidates.find((r) => primitiveNames.has(r))
    if (!chosen)
      chosen = Array.from(primitiveNames).find((n) => /^--radius-\d+$/.test(n))
    if (!chosen) chosen = "--radius-none"
    tokensCss += `  --form-border-radius: var(${chosen});\n`
  })()
  if (themeMode === "both") {
    tokensCss += `  --checkables-border-color: light-dark(var(--color-gray-400), var(--color-gray-600));\n`
  } else {
    tokensCss += `  --checkables-border-color: var(--color-gray-400);\n`
  }
  tokensCss += `  --checkable-size: 1.25em;\n`

  tokensCss += `\n}\n`
  tokensCss = tokensCss.replace(/\n{3,}/g, "\n\n")

  // validate var(...) usage
  const varUsageRe = /var\(\s*(--[a-z0-9-]+)\s*\)/g
  const missing = new Set()
  let mu
  while ((mu = varUsageRe.exec(tokensCss)) !== null) {
    if (!primitiveNames.has(mu[1])) missing.add(mu[1])
  }
  if (missing.size) {
    // Si peu de primitives manquantes (< 5), c'est probablement dû à des appels
    // partiels de l'UI - ne pas alarmer avec console.error
    if (missing.size < 5) {
      console.warn(
        "[tokens] ⚠️ Quelques primitives référencées non présentes :",
        [...missing].join(", "),
      )
    } else {
      // Beaucoup de primitives manquantes = vraie erreur
      console.error(
        "Tokens generation references primitives not present in theme primitives:",
        [...missing].join(", "),
      )
    }
  }

  // Post-process tokensCss: replace any raw primitive values (eg. oklch(...))
  // with var(--primitive) when the primitive was emitted in themeCss.
  try {
    // build map value -> varName for quick lookup
    const valueToVar = Object.create(null)
    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    for (const name of primitiveNames) {
      const re = new RegExp(
        "^\\s*" + escapeRegExp(name) + "\\s*:\\s*(.*);?",
        "m",
      )
      const m = themeCss.match(re)
      if (m) {
        const val = (m[1] || "").trim()
        if (val) valueToVar[val] = name
      }
    }

    // Replace occurrences of raw values with var(...) when possible.
    // Look for oklch(...) or other raw token values used in tokensCss.
    tokensCss = tokensCss.replace(
      /oklch\([^\)]+\)|rgba?\([^\)]+\)|#[0-9a-fA-F]{3,8}/g,
      (match) => {
        const key = match.trim()
        if (valueToVar[key]) return `var(${valueToVar[key]})`
        return match
      },
    )
  } catch (e) {
    /* noop - best-effort only */
  }

  return { themeCss, tokensCss }
}

export default { generateCanonicalThemeFromFigma }
