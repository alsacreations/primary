#!/usr/bin/env node
/* CLI entry: read Mode JSON files from ./source and generate CSS + artifacts in ./dist */
const fs = require("fs")
const path = require("path")
const {
  ensureDir,
  writeFile,
  readJsonFiles,
  clampBetweenModes,
} = require("./utils")
const colors = require("./extract/colors")
const spacing = require("./extract/spacing")
const fonts = require("./extract/fonts")

// Support calling via npm where package scripts might include defaults (e.g. "node scripts/figmatocss.js source dist")
// Prefer the last two non-flag arguments when provided so commands like
// `npm run figmatocss -- tmp-prism dist-tmp` behave as expected.
const rawArgs = process.argv.slice(2)
let SRC_DIR, OUT_DIR
if (rawArgs.length >= 2) {
  SRC_DIR = rawArgs[rawArgs.length - 2]
  OUT_DIR = rawArgs[rawArgs.length - 1]
} else {
  SRC_DIR = process.argv[2] || path.join(process.cwd(), "source")
  OUT_DIR = process.argv[3] || path.join(process.cwd(), "dist")
}

;(async function main() {
  ensureDir(OUT_DIR)

  console.log("Reading Mode JSON files from", SRC_DIR)
  const files = readJsonFiles(SRC_DIR)
  // If no files found, do not fail: proceed to generate defaults-only outputs
  if (!files.length) {
    console.warn(
      "Aucun fichier JSON trouvé dans",
      SRC_DIR,
      "— génération des valeurs globales par défaut seulement.",
    )
  }

  // files: [{filePath, json, modeName}]
  const entries = files || []

  console.log(`Parsing ${entries.length} file(s)`)
  // Show the list of files parsed for clarity
  const fileNames = entries.map((e) => require("path").basename(e.filePath))
  console.log(`Fichiers détectés : ${fileNames.join(", ")}`)

  // Extract primitives and tokens by type
  const colorResult = colors.extractColors(entries)
  const spacingResult = spacing.extractSpacing(entries)
  const fontResult = fonts.extractFonts(entries)

  // Merge CSS parts
  const header = `/* ----------------------------------\n * Theme du projet\n * ---------------------------------- */\n`

  // Custom breakpoint helpers (inserted after header as per instructions.md)
  const breakpointsBlock = `/* stylelint-disable */
/* Custom Breakpoints */
@custom-media --md (width >= 48rem);
@custom-media --lg (width >= 64rem);
@custom-media --xl (width >= 80rem);
@custom-media --xxl (width >= 96rem);
@custom-media --until-md (width < 48rem);
@custom-media --until-lg (width < 64rem);
@custom-media --until-xl (width < 80rem);
@custom-media --until-xxl (width < 96rem);
/* stylelint-enable */
`

  // Color-scheme handling (split into property placed inside :root and selectors placed after)
  let colorSchemeProperty = ""
  let colorSchemeSelectors = ""
  const hasLight = colorResult.modes.includes("light")
  const hasDark = colorResult.modes.includes("dark")
  if (hasLight && hasDark) {
    colorSchemeProperty = `/* Theme (color-scheme) */\ncolor-scheme: light dark;\n\n&[data-theme="light"] { color-scheme: light; }\n&[data-theme="dark"] { color-scheme: dark; }`
    colorSchemeSelectors = ""
  } else {
    colorSchemeProperty = `/* Theme (color-scheme) */\ncolor-scheme: light;\n\n&[data-theme="light"] { color-scheme: light; }\n&[data-theme="dark"] { color-scheme: dark; }`
    colorSchemeSelectors = ""
  }

  // Note: CSS sections will be assembled later after token normalization so generated primitives
  // (created while normalizing tokens) are included in the final `theme.css`.

  // Merge flat primitives from all extractors
  const allPrimitivesFlat = Object.assign(
    {},
    colorResult.primitivesJson || {},
    spacingResult.primitives || {},
    fontResult.primitives || {},
  )

  // Convert flat primitives (--color-*, --spacing-*, --text-*, --line-height-*) into structured `primitives.json` expected format
  function buildStructuredPrimitives(flat) {
    const out = {
      color: {},
      spacing: {},
      fontSize: {},
      lineHeight: {},
      rounded: {},
    }
    Object.keys(flat).forEach((k) => {
      const v = flat[k]
      if (!k.startsWith("--")) return // ignore unexpected
      if (k.startsWith("--color-")) {
        const name = k.replace(/^--color-/, "")
        out.color[name] = { $type: "color", value: v }
      } else if (k.startsWith("--spacing-")) {
        const raw = k.replace(/^--spacing-/, "")
        const name = `spacing-${raw}`
        out.spacing[name] = {
          $type: "number",
          value: `${(Number(v) / 16)
            .toFixed(4)
            .replace(/(\.\d*?)0+$/, "$1")
            .replace(/\.$/, "")}rem`,
        }
      } else if (k.startsWith("--text-")) {
        const raw = k.replace(/^--text-/, "")
        const name = `text-${raw}`
        out.fontSize[name] = {
          $type: "number",
          value: `${(Number(v) / 16)
            .toFixed(4)
            .replace(/(\.\d*?)0+$/, "$1")
            .replace(/\.$/, "")}rem`,
        }
      } else if (k.startsWith("--line-height-")) {
        const raw = k.replace(/^--line-height-/, "")
        const name = `line-height-${raw}`
        out.lineHeight[name] = {
          $type: "number",
          value: `${(Number(v) / 16)
            .toFixed(4)
            .replace(/(\.\d*?)0+$/, "$1")
            .replace(/\.$/, "")}rem`,
        }
      } else if (k.startsWith("--radius-") || k.startsWith("--rounded-")) {
        const name = k.replace(/^--(radius|rounded)-/, "")
        out.rounded[`radius-${name}`] = {
          $type: "number",
          value: `${(Number(v) / 16)
            .toFixed(4)
            .replace(/(\.\d*?)0+$/, "$1")
            .replace(/\.$/, "")}rem`,
        }
      } else {
        // fallback: classify by value
        if (typeof v === "string" && v.startsWith("#")) {
          const name = k.replace(/^--/, "")
          out.color[name] = { $type: "color", value: v }
        } else if (!isNaN(Number(v))) {
          const name = k.replace(/^--/, "")
          out[name] = {
            $type: "number",
            value: `${(Number(v) / 16)
              .toFixed(4)
              .replace(/(\.\d*?)0+$/, "$1")
              .replace(/\.$/, "")}rem`,
          }
        } else {
          const name = k.replace(/^--/, "")
          out[name] = { $type: "string", value: String(v) }
        }
      }
    })
    return out
  }

  const structuredPrimitives = buildStructuredPrimitives(allPrimitivesFlat)

  // Normalize tokens to strict schema expected in `instructions.md`
  function normalizeTokens(rawColors, rawSpacing, rawFonts, primitivesFlat) {
    const normalized = {
      colors: {},
      spacing: {},
      fonts: { fontSize: {}, lineHeight: {} },
    }

    // Colors: map to { type: 'color', value: 'var(--token)', modes: { light: 'var(--color-...)', dark: 'var(...)' } }
    Object.keys(rawColors || {}).forEach((tokenName) => {
      const tokenRaw = rawColors[tokenName]
      const out = { type: "color", value: `var(--${tokenName})` }
      const modes = {}
      if (tokenRaw.light && tokenRaw.light.value)
        modes.light = tokenRaw.light.value
      if (tokenRaw.dark && tokenRaw.dark.value) modes.dark = tokenRaw.dark.value
      if (Object.keys(modes).length) out.modes = modes
      normalized.colors[tokenName] = out
    })

    // Spacing & radius: tokens should NOT include primitives already present in `primitives.json`.
    Object.keys(rawSpacing || {}).forEach((k) => {
      const clean = k.replace(/^--/, "")
      // Skip tokens that are actually primitives
      if (
        structuredPrimitives &&
        structuredPrimitives.spacing &&
        structuredPrimitives.spacing[clean]
      )
        return
      if (
        structuredPrimitives &&
        structuredPrimitives.rounded &&
        structuredPrimitives.rounded[clean]
      )
        return
      const item = rawSpacing[k]
      normalized.spacing[clean] = { type: "number", value: item.value }
      if (item.px !== undefined) normalized.spacing[clean].px = item.px
    })

    // Fonts: fontSize and lineHeight
    const primitivesLookup = primitivesFlat // key: --text-12 -> value (number or hex)

    function resolvePrimitiveForValue(val, prefix, tokenClean, mode) {
      // If resolving a mode-specific primitive, prefer reusing an existing primitive with the same value
      // (prefer primitives with the requested prefix like --text- or --line-height-) before creating a
      // mode-specific primitive such as --<token>-desktop.
      const keys = Object.keys(primitivesLookup)
      if (mode) {
        // Try to find existing primitive with same value and desired prefix
        let found = keys.find(
          (pk) =>
            pk.startsWith(prefix) &&
            (Number(primitivesLookup[pk]) === Number(val) ||
              String(primitivesLookup[pk]) === String(val)),
        )
        if (!found) {
          // Fallback: match any primitive with the same value
          found = keys.find(
            (pk) =>
              Number(primitivesLookup[pk]) === Number(val) ||
              String(primitivesLookup[pk]) === String(val),
          )
        }
        if (found) {
          // If the found primitive is already of the desired prefix (eg. --text-), reuse it.
          if (found.startsWith(prefix)) return `var(${found})`
          // Otherwise prefer creating a value-based primitive in the desired namespace (eg. --text-40)
          const numericPx = Number(val)
          const baseName = prefix.replace(/^--/, "").replace(/-$/, "") // e.g. 'text' or 'line-height'
          const valueBasedKey = `--${baseName}-${numericPx}`
          if (primitivesLookup[valueBasedKey]) return `var(${valueBasedKey})`
          primitivesLookup[valueBasedKey] = numericPx
          const group = prefix.includes("line-height")
            ? "lineHeight"
            : "fontSize"
          const structuredValueName = valueBasedKey.replace(/^--/, "")
          structuredPrimitives[group][structuredValueName] = {
            $type: "number",
            value: `${(Number(val) / 16)
              .toFixed(4)
              .replace(/(\.\d*?)0+$/, "$1")
              .replace(/\.$/, "")}rem`,
          }
          return `var(${valueBasedKey})`
        }

        // No existing primitive matches: prefer creating/reusing a value-based primitive like --text-60
        const numericPx = Number(val)
        const baseName = prefix.replace(/^--/, "").replace(/-$/, "") // e.g. 'text' or 'line-height'
        const valueBasedKey = `--${baseName}-${numericPx}`
        if (primitivesLookup[valueBasedKey]) return `var(${valueBasedKey})`
        // create the value-based primitive
        primitivesLookup[valueBasedKey] = numericPx
        const group = prefix.includes("line-height") ? "lineHeight" : "fontSize"
        const structuredValueName = valueBasedKey.replace(/^--/, "")
        structuredPrimitives[group][structuredValueName] = {
          $type: "number",
          value: `${(Number(val) / 16)
            .toFixed(4)
            .replace(/(\.\d*?)0+$/, "$1")
            .replace(/\.$/, "")}rem`,
        }
        return `var(${valueBasedKey})`
      }

      // No mode provided: prefer primitives with requested prefix, then any primitive matching value
      let found = keys.find(
        (pk) =>
          pk.startsWith(prefix) &&
          (Number(primitivesLookup[pk]) === Number(val) ||
            String(primitivesLookup[pk]) === String(val)),
      )
      if (!found) {
        // fallback: match any primitive with same value when not mode-specific
        found = keys.find(
          (pk) =>
            Number(primitivesLookup[pk]) === Number(val) ||
            String(primitivesLookup[pk]) === String(val),
        )
      }
      if (found) return `var(${found})`

      // Not found: create a primitive for this token
      const suffix = mode ? `-${mode}` : ""
      const newPrimitiveKey = `--${tokenClean}${suffix}` // e.g. --line-height-5xl-desktop
      if (!primitivesLookup[newPrimitiveKey]) {
        // Add to flat primitives (use px number)
        primitivesLookup[newPrimitiveKey] = Number(val)
        // Add to structuredPrimitives under the proper group
        const group = prefix.includes("line-height") ? "lineHeight" : "fontSize"
        const structuredName = newPrimitiveKey.replace(/^--/, "")
        structuredPrimitives[group][structuredName] = {
          $type: "number",
          value: `${(Number(val) / 16)
            .toFixed(4)
            .replace(/(\.\d*?)0+$/, "$1")
            .replace(/\.$/, "")}rem`,
        }
      }
      return `var(${newPrimitiveKey})`
    }

    Object.keys((rawFonts && rawFonts.fontSize) || {}).forEach((k) => {
      const clean = k.replace(/^--/, "")
      const entry = rawFonts.fontSize[k]
      const out = { type: "number", value: entry.value }
      if (entry.modes) {
        const modes = {}
        Object.keys(entry.modes).forEach((m) => {
          const v = entry.modes[m]
          modes[m] = resolvePrimitiveForValue(v, "--text-", clean, m)
        })
        out.modes = modes
      }
      normalized.fonts.fontSize[clean] = out
    })

    Object.keys((rawFonts && rawFonts.lineHeight) || {}).forEach((k) => {
      const clean = k.replace(/^--/, "")
      const entry = rawFonts.lineHeight[k]
      const out = { type: "number", value: entry.value }
      if (entry.modes) {
        const modes = {}
        Object.keys(entry.modes).forEach((m) => {
          const v = entry.modes[m]
          modes[m] = resolvePrimitiveForValue(v, "--line-height-", clean, m)
        })
        out.modes = modes
      }
      normalized.fonts.lineHeight[clean] = out
    })

    return normalized
  }

  const normalizedTokens = normalizeTokens(
    colorResult.tokensJson,
    spacingResult.json,
    fontResult.json,
    allPrimitivesFlat,
  )

  // Collect warnings from extractors and normalizer
  const warnings = []
  if (colorResult.warnings && colorResult.warnings.length)
    warnings.push(
      ...colorResult.warnings.map((w) => ({ source: "colors", ...w })),
    )
  if (fontResult.warnings && fontResult.warnings.length)
    warnings.push(
      ...fontResult.warnings.map((w) => ({ source: "fonts", ...w })),
    )
  if (normalizedTokens._warnings && normalizedTokens._warnings.length)
    warnings.push(
      ...normalizedTokens._warnings.map((w) => ({ source: "normalize", ...w })),
    )

  // Rebuild structured primitives in case normalizeTokens added new entries
  const finalStructuredPrimitives = buildStructuredPrimitives(allPrimitivesFlat)

  // Final validation: ensure token references point to existing primitives
  function extractVarName(str) {
    if (!str || typeof str !== "string") return null
    const m = str.match(/var\((--[a-z0-9-]+)\)/i)
    if (m) return m[1]
    // also accept bare --name
    const m2 = str.match(/^(--[a-z0-9-]+)$/i)
    if (m2) return m2[1]
    return null
  }

  function primitiveExists(varName) {
    if (!varName) return false
    const k = varName.replace(/^--/, "")
    // check known groups
    if (
      finalStructuredPrimitives.color &&
      k.startsWith("color-") &&
      finalStructuredPrimitives.color[k.replace(/^color-/, "")]
    )
      return true
    if (
      finalStructuredPrimitives.spacing &&
      finalStructuredPrimitives.spacing[k]
    )
      return true
    if (
      finalStructuredPrimitives.fontSize &&
      finalStructuredPrimitives.fontSize[k]
    )
      return true
    if (
      finalStructuredPrimitives.lineHeight &&
      finalStructuredPrimitives.lineHeight[k]
    )
      return true
    if (
      finalStructuredPrimitives.rounded &&
      finalStructuredPrimitives.rounded[k]
    )
      return true
    // also accept primary names like --primary --surface which are tokens (may not be primitives) but should exist in tokens.json
    // check tokens.json for presence
    const tokenCheck =
      normalizedTokens.colors &&
      normalizedTokens.colors[k.replace(/^color-/, "")]
        ? true
        : false
    if (tokenCheck) return true
    // lastly check flat primitives
    if (k in allPrimitivesFlat) return true
    return false
  }

  const validationWarnings = []
  // Colors tokens
  Object.keys(normalizedTokens.colors || {}).forEach((name) => {
    const entry = normalizedTokens.colors[name]
    if (entry.modes) {
      Object.keys(entry.modes).forEach((m) => {
        const ref = entry.modes[m]
        const vn = extractVarName(ref)
        if (vn && !primitiveExists(vn))
          validationWarnings.push({
            source: "validate",
            type: "missing-primitive",
            message: `Color token '${name}' ${m} references missing primitive '${vn}'`,
          })
      })
    }
    if (entry.value) {
      const vn = extractVarName(entry.value)
      if (vn && !primitiveExists(vn))
        validationWarnings.push({
          source: "validate",
          type: "missing-primitive",
          message: `Color token '${name}' value references missing primitive '${vn}'`,
        })
    }
  })

  // Fonts: fontSize & lineHeight
  Object.keys(
    (normalizedTokens.fonts && normalizedTokens.fonts.fontSize) || {},
  ).forEach((k) => {
    const entry = normalizedTokens.fonts.fontSize[k]
    if (entry.modes) {
      Object.keys(entry.modes).forEach((m) => {
        const ref = entry.modes[m]
        const vn = extractVarName(ref)
        if (vn && !primitiveExists(vn))
          validationWarnings.push({
            source: "validate",
            type: "missing-primitive",
            message: `Font-size token '${k}' ${m} references missing primitive '${vn}'`,
          })
      })
    }
  })
  Object.keys(
    (normalizedTokens.fonts && normalizedTokens.fonts.lineHeight) || {},
  ).forEach((k) => {
    const entry = normalizedTokens.fonts.lineHeight[k]
    if (entry.modes) {
      Object.keys(entry.modes).forEach((m) => {
        const ref = entry.modes[m]
        const vn = extractVarName(ref)
        if (vn && !primitiveExists(vn))
          validationWarnings.push({
            source: "validate",
            type: "missing-primitive",
            message: `Line-height token '${k}' ${m} references missing primitive '${vn}'`,
          })
      })
    }
  })

  // Merge validation warnings
  if (validationWarnings.length) warnings.push(...validationWarnings)

  // Write warnings file if any and print them
  if (!warnings) warnings = []
  const warningsPath = path.join(OUT_DIR, "extraction-warnings.json")
  if (warnings.length) {
    writeFile(warningsPath, JSON.stringify(warnings, null, 2))
    console.log("\nWarnings:")
    warnings
      .slice(0, 20)
      .forEach((w) => console.log(`- [${w.source}] ${w.type}: ${w.message}`))
    if (warnings.length > 20)
      console.log(`- and ${warnings.length - 20} more warnings...`)
  } else {
    // remove stale warnings file if present
    if (fs.existsSync(warningsPath)) fs.unlinkSync(warningsPath)
  }

  // Color-scheme handling
  const hasLight2 = colorResult.modes.includes("light")
  const hasDark2 = colorResult.modes.includes("dark")
  if (hasLight2 && hasDark2) {
    colorSchemeBlock = `/* Theme (color-scheme) */\ncolor-scheme: light dark;\n:root[data-theme="light"] { color-scheme: light; }\n:root[data-theme="dark"] { color-scheme: dark; }\n`
  } else {
    colorSchemeBlock = `/* Theme (color-scheme) */\ncolor-scheme: light;\n`
  }

  // Build CSS sections from finalStructuredPrimitives
  // Global color defaults (step 5) as per instructions.md - these are used when project doesn't provide them
  const globalColorDefaults = {
    white: "oklch(1 0 0)",
    black: "oklch(0 0 0)",
    "gray-50": "oklch(0.97 0 0)",
    "gray-100": "oklch(0.922 0 0)",
    "gray-200": "oklch(0.87 0 0)",
    "gray-300": "oklch(0.708 0 0)",
    "gray-400": "oklch(0.556 0 0)",
    "gray-500": "oklch(0.439 0 0)",
    "gray-600": "oklch(0.371 0 0)",
    "gray-700": "oklch(0.269 0 0)",
    "gray-800": "oklch(0.205 0 0)",
    "gray-900": "oklch(0.145 0 0)",
    "error-100": "oklch(0.97 0.1 27.52)",
    "error-300": "oklch(0.7054 0.19 27.52)",
    "error-500": "oklch(0.5054 0.19 27.52)",
    "error-700": "oklch(0.3554 0.19 27.52)",
    "error-900": "oklch(0.2054 0.11 27.52)",
    "success-100": "oklch(0.9446 0.13 150.685)",
    "success-300": "oklch(0.7166 0.13 150.73)",
    "success-500": "oklch(0.5166 0.13 150.73)",
    "success-700": "oklch(0.3666 0.13 150.73)",
    "success-900": "oklch(0.2166 0.13 150.73)",
    "warning-100": "oklch(0.97 0.08 49.95)",
    "warning-300": "oklch(0.8315 0.17 49.95)",
    "warning-500": "oklch(0.6315 0.17 49.95)",
    "warning-700": "oklch(0.4815 0.17 49.95)",
    "warning-900": "oklch(0.3315 0.11 49.95)",
    "info-100": "oklch(0.97 0.09 256.37)",
    "info-300": "oklch(0.7133 0.18 256.37)",
    "info-500": "oklch(0.5133 0.18 256.37)",
    "info-700": "oklch(0.3633 0.18 256.37)",
    "info-900": "oklch(0.2133 0.11 256.37)",
  }

  // If no source files were provided, inject concrete primitives for the global defaults
  // so that generateThemeJson can resolve tokens without missing-primitive warnings.
  if (!entries.length) {
    // Colors
    Object.keys(globalColorDefaults).forEach((name) => {
      if (!finalStructuredPrimitives.color[name]) {
        finalStructuredPrimitives.color[name] = {
          $type: "color",
          value: globalColorDefaults[name],
        }
        allPrimitivesFlat[`--color-${name}`] = globalColorDefaults[name]
      }
    })

    // Spacing defaults (align with instructions.md)
    const spacingDefaults = {
      "spacing-0": "0",
      "spacing-2": "0.125rem",
      "spacing-4": "0.25rem",
      "spacing-8": "0.5rem",
      "spacing-12": "0.75rem",
      "spacing-16": "1rem",
      "spacing-24": "1.5rem",
      "spacing-32": "2rem",
      "spacing-48": "3rem",
    }
    Object.keys(spacingDefaults).forEach((k) => {
      if (!finalStructuredPrimitives.spacing[k]) {
        finalStructuredPrimitives.spacing[k] = {
          $type: "number",
          value: spacingDefaults[k],
        }
        // store px value for numeric computations
        allPrimitivesFlat[`--${k}`] = Math.round(
          parseFloat(spacingDefaults[k]) * 16,
        )
      }
    })

    // Typography defaults (align with instructions.md)
    const fontSizeDefaults = {
      "text-14": "0.875rem",
      "text-16": "1rem",
      "text-18": "1.125rem",
      "text-20": "1.25rem",
      "text-24": "1.5rem",
      "text-30": "1.875rem",
      "text-48": "3rem",
    }
    Object.keys(fontSizeDefaults).forEach((k) => {
      if (!finalStructuredPrimitives.fontSize[k]) {
        finalStructuredPrimitives.fontSize[k] = {
          $type: "number",
          value: fontSizeDefaults[k],
        }
        // store px value for numeric computations (e.g., clamp calculation)
        allPrimitivesFlat[`--${k}`] = Math.round(
          parseFloat(fontSizeDefaults[k]) * 16,
        )
      }
    })

    // Note: line-heights are not specified by default per instructions -> do not inject by default

    // Rounded defaults
    const radiusDefaults = {
      "radius-none": "0",
      "radius-4": "0.25rem",
      "radius-8": "0.5rem",
      "radius-12": "0.75rem",
      "radius-16": "1rem",
      "radius-24": "1.5rem",
      "radius-full": "9999px",
    }
    Object.keys(radiusDefaults).forEach((r) => {
      if (!finalStructuredPrimitives.rounded[r]) {
        finalStructuredPrimitives.rounded[r] = {
          $type: "number",
          value: radiusDefaults[r],
        }
      }
    })

    // Add a few simple primitives expected by the theme generator
    if (!finalStructuredPrimitives["font-base"])
      finalStructuredPrimitives["font-base"] = {
        $type: "string",
        value: "system-ui, sans-serif",
      }
    if (!finalStructuredPrimitives["font-weight-regular"])
      finalStructuredPrimitives["font-weight-regular"] = {
        $type: "number",
        value: 400,
      }
  }

  // DEBUG: list injected raspberry entries (temporary)
  // console.log('Injected raspberry primitives:', Object.keys(finalStructuredPrimitives.color).filter(n=>n.startsWith('raspberry')));

  // Helper to find a project-provided color (accept some common synonyms like neutral->gray)
  function findProjectColorValue(key) {
    if (!finalStructuredPrimitives || !finalStructuredPrimitives.color)
      return null
    if (finalStructuredPrimitives.color[key])
      return finalStructuredPrimitives.color[key].value
    // try neutral-* variant for gray-*
    const m = key.match(/^gray-(\d+)$/)
    if (m) {
      const alt = `neutral-${m[1]}`
      if (finalStructuredPrimitives.color[alt])
        return finalStructuredPrimitives.color[alt].value
      const alt2 = `slate-${m[1]}`
      if (finalStructuredPrimitives.color[alt2])
        return finalStructuredPrimitives.color[alt2].value
    }
    return null
  }

  const globalColorsLines = Object.keys(globalColorDefaults).map((name) => {
    const projectVal = findProjectColorValue(name)
    const val = projectVal || globalColorDefaults[name]
    return `--color-${name}: ${val};`
  })

  // Now project colors excluding those already covered by global defaults (to avoid duplicates)
  const projectColorNames = Object.keys(
    finalStructuredPrimitives.color || {},
  ).filter((n) => {
    // map neutral-* to gray-* to avoid duplicate
    const asGray = n.replace(/^neutral-/, "gray-")
    return !(asGray in globalColorDefaults) && !(n in globalColorDefaults)
  })
  const colorsLines = projectColorNames
    .sort()
    .map(
      (name) =>
        `--color-${name}: ${finalStructuredPrimitives.color[name].value};`,
    )

  const radiusLines = Object.keys(finalStructuredPrimitives.rounded || {})
    .sort()
    .map(
      (name) =>
        `--${name}: ${finalStructuredPrimitives.rounded[name].value}; /* ${Math.round(
          parseFloat(finalStructuredPrimitives.rounded[name].value) * 16,
        )}px */`,
    )

  const spacingLines = Object.keys(finalStructuredPrimitives.spacing || {})
    .sort((a, b) => {
      const va = parseFloat(finalStructuredPrimitives.spacing[a].value || 0)
      const vb = parseFloat(finalStructuredPrimitives.spacing[b].value || 0)
      return va - vb
    })
    .map(
      (name) =>
        `--${name}: ${finalStructuredPrimitives.spacing[name].value}; /* ${Math.round(
          parseFloat(finalStructuredPrimitives.spacing[name].value) * 16,
        )}px */`,
    )

  const textLines = Object.keys(finalStructuredPrimitives.fontSize || {})
    .sort((a, b) => {
      const va = parseFloat(finalStructuredPrimitives.fontSize[a].value || 0)
      const vb = parseFloat(finalStructuredPrimitives.fontSize[b].value || 0)
      return va - vb
    })
    .map(
      (name) =>
        `--${name}: ${finalStructuredPrimitives.fontSize[name].value}; /* ${Math.round(
          parseFloat(finalStructuredPrimitives.fontSize[name].value) * 16,
        )}px */`,
    )

  const lineHeightLines = Object.keys(
    finalStructuredPrimitives.lineHeight || {},
  )
    .sort((a, b) => {
      const va = parseFloat(finalStructuredPrimitives.lineHeight[a].value || 0)
      const vb = parseFloat(finalStructuredPrimitives.lineHeight[b].value || 0)
      return va - vb
    })
    .map(
      (name) =>
        `--${name}: ${finalStructuredPrimitives.lineHeight[name].value}; /* ${Math.round(
          parseFloat(finalStructuredPrimitives.lineHeight[name].value) * 16,
        )}px */`,
    )

  // Bring token-generated CSS (light-dark / clamp) back
  const colorsSection = [
    "/* Colors */",
    ...colorsLines,
    ...colorResult.tokensCss,
  ]
  const spacingSection = ["/* Spacing */", ...radiusLines, ...spacingLines]
  const typographySection = [
    "/* Typography */",
    ...textLines,
    ...lineHeightLines,
  ]
  const typographyTokensSection = [
    "/* Typography Tokens */",
    ...(fontResult.tokensCss || []),
  ]

  const indent = (lines) => lines.map((l) => `  ${l}`).join("\n")

  // Compute clamp() expression in the exact format required by instructions.md:
  // clamp(var(--primitive-mobile), <intercept>rem + <slope>vw, var(--primitive-desktop))
  function computeFluidClamp(mobileRef, desktopRef) {
    function normalizeVarExpr(ref) {
      if (!ref && ref !== 0) return null
      if (typeof ref === "string") {
        ref = ref.trim()
        if (ref.startsWith("var(")) return ref
        if (ref.startsWith("--")) return `var(${ref})`
        if (ref.endsWith("rem") || ref.endsWith("px")) return ref
      }
      if (typeof ref === "number") return pxToRem(ref)
      return ref
    }

    function numericPxFromRef(ref) {
      if (ref === undefined || ref === null) return null
      if (typeof ref === "number") return Number(ref)
      if (typeof ref === "string") {
        const s = ref.trim()
        if (s.endsWith("px")) return parseFloat(s.replace(/px$/, ""))
        if (s.endsWith("rem")) return parseFloat(s.replace(/rem$/, "")) * 16
        // var(--text-16) or --text-16
        const varMatch =
          s.match(/var\((--[^)]+)\)/) || (s.startsWith("--") ? [null, s] : null)
        if (varMatch) {
          const vname = varMatch[1]
          const key = vname.replace(/^--/, "")
          // try fontSize, lineHeight, spacing, rounded
          if (
            finalStructuredPrimitives.fontSize &&
            finalStructuredPrimitives.fontSize[key]
          ) {
            return (
              parseFloat(
                finalStructuredPrimitives.fontSize[key].value.replace(
                  /rem$/,
                  "",
                ),
              ) * 16
            )
          }
          if (
            finalStructuredPrimitives.lineHeight &&
            finalStructuredPrimitives.lineHeight[key]
          ) {
            return (
              parseFloat(
                finalStructuredPrimitives.lineHeight[key].value.replace(
                  /rem$/,
                  "",
                ),
              ) * 16
            )
          }
          if (
            finalStructuredPrimitives.spacing &&
            finalStructuredPrimitives.spacing[key]
          ) {
            return (
              parseFloat(
                finalStructuredPrimitives.spacing[key].value.replace(
                  /rem$/,
                  "",
                ),
              ) * 16
            )
          }
          if (
            finalStructuredPrimitives.rounded &&
            finalStructuredPrimitives.rounded[key]
          ) {
            return (
              parseFloat(
                finalStructuredPrimitives.rounded[key].value.replace(
                  /rem$/,
                  "",
                ),
              ) * 16
            )
          }
        }
      }
      return null
    }

    const mobileExpr = normalizeVarExpr(mobileRef)
    const desktopExpr = normalizeVarExpr(desktopRef)
    const mobilePx = numericPxFromRef(mobileRef)
    const desktopPx = numericPxFromRef(desktopRef)

    // If we can't compute numeric pxs, fallback to previous generic clampBetweenModes
    if (
      mobilePx === null ||
      desktopPx === null ||
      Number.isNaN(mobilePx) ||
      Number.isNaN(desktopPx)
    ) {
      return clampBetweenModes(
        mobileExpr || mobileRef,
        desktopExpr || desktopRef,
      )
    }

    // Compute slope in px-per-vw: (delta_px / (maxViewport - minViewport)) * 100
    const deltaPx = desktopPx - mobilePx
    const slopePxPerVw = (deltaPx * 100) / (1280 - 360) // px per 1vw

    // Intercept in px at viewport=0 (we solve so value at 360px equals mobilePx):
    // intercept_px + slopePxPerVw * (360/100) = mobilePx
    const interceptPx = mobilePx - slopePxPerVw * (360 / 100)

    // Convert intercept to rem and format
    const interceptRem = Number((interceptPx / 16).toFixed(3))
    const slopeVwStr = Number(slopePxPerVw.toFixed(4))

    const middle = `${interceptRem}rem + ${slopeVwStr}vw`

    // Use var(...) endpoints when possible
    const left =
      mobileExpr && mobileExpr.startsWith("var(")
        ? mobileExpr
        : pxToRem(mobilePx)
    const right =
      desktopExpr && desktopExpr.startsWith("var(")
        ? desktopExpr
        : pxToRem(desktopPx)

    return `clamp(${left}, ${middle}, ${right})`
  }

  // Insert color-scheme property at start of :root
  const colorSchemePropertyIndented = indent(colorSchemeProperty.split("\n"))

  const globalColorsSection = [
    "/* Couleurs (globales) */",
    ...globalColorsLines,
  ]
  const projectColorsSection = colorsLines.length
    ? ["/* Couleurs Primitives du projet */", ...colorsLines]
    : []

  // Build global color tokens (step 7) — prefer explicit token CSS from extractor, otherwise fall back to defaults
  const globalColorTokenDefaults = {
    primary: "var(--color-gray-500)",
    "on-primary": "var(--color-white)",
    "primary-lighten": "oklch(from var(--primary) calc(l * 1.2) c h)",
    "primary-darken": "oklch(from var(--primary) calc(l * 0.8) c h)",
    accent: "light-dark(var(--primary), var(--primary-lighten))",
    "accent-invert": "light-dark(var(--primary-lighten), var(--primary))",
    surface: "light-dark(var(--color-white), var(--color-gray-900))",
    "on-surface": "light-dark(var(--color-gray-900), var(--color-gray-100))",
    "layer-1": "light-dark(var(--color-gray-50), var(--color-gray-800))",
    "layer-2": "light-dark(var(--color-gray-100), var(--color-gray-700))",
    "layer-3": "light-dark(var(--color-gray-200), var(--color-gray-600))",
    link: "light-dark(var(--primary), var(--primary-lighten))",
    "link-hover": "light-dark(var(--primary-darken), var(--primary))",
    "link-active": "light-dark(var(--primary-darken), var(--primary))",
    selection: "light-dark(var(--primary-lighten), var(--primary-darken))",
    warning: "light-dark(var(--color-warning-500), var(--color-warning-300))",
    error: "light-dark(var(--color-error-500), var(--color-error-300))",
    success: "light-dark(var(--color-success-500), var(--color-success-300))",
    info: "light-dark(var(--color-info-500), var(--color-info-300))",
    "border-light": "var(--color-gray-400)",
    "border-medium": "var(--color-gray-600)",
  }

  function findTokenLineFromExtractor(name) {
    const arr = (colorResult.tokensCss || []).map((l) => l.trim())
    return arr.find((l) => l.startsWith(`--${name}:`)) || null
  }

  // Find a token CSS line produced by any extractor (colors, fonts, spacing)
  function findExtractorTokenLine(name) {
    const arr = []
    if (colorResult.tokensCss) arr.push(...colorResult.tokensCss)
    if (fontResult.tokensCss) arr.push(...fontResult.tokensCss)
    if (spacingResult.css) arr.push(...spacingResult.css)
    const trimmed = arr.map((l) => l.trim())
    return trimmed.find((l) => l.startsWith(`--${name}:`)) || null
  }

  // Grouped sections with comments, matching instructions.md step 7
  const colorTokenGroups = [
    {
      comment: "/* Couleur primaire */",
      keys: ["primary", "on-primary", "primary-lighten", "primary-darken"],
    },
    { comment: "/* Couleur d'accent */", keys: ["accent", "accent-invert"] },
    { comment: "/* Surface du document */", keys: ["surface", "on-surface"] },
    {
      comment: "/* Niveaux de profondeur */",
      keys: ["layer-1", "layer-2", "layer-3"],
    },
    {
      comment: "/* Interactions */",
      keys: ["link", "link-hover", "link-active"],
    },
    { comment: "/* Couleur de sélection */", keys: ["selection"] },
    {
      comment: "/* États d'alerte */",
      keys: ["warning", "error", "success", "info"],
    },
    { comment: "/* Bordures */", keys: ["border-light", "border-medium"] },
  ]

  const globalColorTokensLines = []
  colorTokenGroups.forEach((group, idx) => {
    globalColorTokensLines.push(group.comment)
    group.keys.forEach((name) => {
      const fromExtractor = findTokenLineFromExtractor(name)
      if (fromExtractor) {
        globalColorTokensLines.push(fromExtractor)
        return
      }

      // Prefer the normalized token value from tokens.json when present
      const nt =
        (normalizedTokens &&
          normalizedTokens.colors &&
          normalizedTokens.colors[name]) ||
        null
      if (nt) {
        if (nt.modes && nt.modes.light && nt.modes.dark) {
          globalColorTokensLines.push(
            `--${name}: light-dark(${nt.modes.light}, ${nt.modes.dark});`,
          )
          return
        }
        if (nt.value) {
          globalColorTokensLines.push(`--${name}: ${nt.value};`)
          return
        }
      }

      // try project primitive direct value (e.g., a project may define "primary" as a primitive)
      if (
        finalStructuredPrimitives.color &&
        finalStructuredPrimitives.color[name]
      ) {
        globalColorTokensLines.push(
          `--${name}: ${finalStructuredPrimitives.color[name].value};`,
        )
        return
      }

      globalColorTokensLines.push(
        `--${name}: ${globalColorTokenDefaults[name]};`,
      )
    })
    if (idx !== colorTokenGroups.length - 1) globalColorTokensLines.push("") // blank line between groups
  })

  const globalColorTokensSection = [
    "/* Couleurs Tokens globales */",
    ...globalColorTokensLines,
  ]

  // Project color tokens (step 8) — use normalized tokens from `tokens.json`, prefer extractor CSS when available
  const projectColorTokensLines = []
  const colorTokens = normalizedTokens.colors || {}
  // Avoid duplicating tokens that are part of the global tokens group
  const globalTokenNames = new Set(colorTokenGroups.flatMap((g) => g.keys))
  Object.keys(colorTokens)
    .sort()
    .forEach((name) => {
      if (globalTokenNames.has(name)) return // already rendered in globals
      const extractorLine = findTokenLineFromExtractor(name)
      if (extractorLine) {
        projectColorTokensLines.push(extractorLine)
        return
      }
      const entry = colorTokens[name]
      if (entry && entry.modes && entry.modes.light && entry.modes.dark) {
        projectColorTokensLines.push(
          `--${name}: light-dark(${entry.modes.light}, ${entry.modes.dark});`,
        )
      } else if (entry && entry.value) {
        projectColorTokensLines.push(`--${name}: ${entry.value};`)
      }
    })
  const projectColorTokensSection = projectColorTokensLines.length
    ? ["/* Couleurs Tokens du projet */", ...projectColorTokensLines]
    : []

  // Autres Primitives CSS globales (step 9) — use project values when present
  const otherPrimitivesDefaults = {
    "transition-duration": "250ms",
    "z-under-page-level": "-1",
    "z-above-page-level": "1",
    "z-header-level": "1000",
    "z-above-header-level": "2000",
    "z-above-all-level": "3000",
    "font-base": "system-ui, sans-serif",
    "font-mono": "ui-monospace, monospace",
    "font-weight-light": "300",
    "font-weight-regular": "400",
    "font-weight-semibold": "600",
    "font-weight-bold": "700",
    "font-weight-extrabold": "800",
    "font-weight-black": "900",
  }

  function getProjectPrimitiveValue(name) {
    if (allPrimitivesFlat && allPrimitivesFlat[`--${name}`])
      return allPrimitivesFlat[`--${name}`]
    if (
      name.startsWith("radius-") &&
      finalStructuredPrimitives &&
      finalStructuredPrimitives.rounded &&
      finalStructuredPrimitives.rounded[name]
    )
      return finalStructuredPrimitives.rounded[name].value
    return null
  }

  const otherPrimitivesLines = []
  otherPrimitivesLines.push("/* Transitions et animations */")
  ;["transition-duration"].forEach((k) => {
    const projectVal = getProjectPrimitiveValue(k)
    otherPrimitivesLines.push(
      `--${k}: ${projectVal || otherPrimitivesDefaults[k]};`,
    )
  })
  otherPrimitivesLines.push("")

  otherPrimitivesLines.push("/* Niveaux de z-index */")
  ;[
    "z-under-page-level",
    "z-above-page-level",
    "z-header-level",
    "z-above-header-level",
    "z-above-all-level",
  ].forEach((k) => {
    const projectVal = getProjectPrimitiveValue(k)
    otherPrimitivesLines.push(
      `--${k}: ${projectVal || otherPrimitivesDefaults[k]};`,
    )
  })
  otherPrimitivesLines.push("")

  otherPrimitivesLines.push("/* Border radius */")
  const radiusDefaults = {
    "radius-none": "0",
    "radius-4": "0.25rem",
    "radius-8": "0.5rem",
    "radius-12": "0.75rem",
    "radius-16": "1rem",
    "radius-24": "1.5rem",
    "radius-full": "9999px",
  }
  Object.keys(radiusDefaults).forEach((r) => {
    const projectVal = getProjectPrimitiveValue(r)
    otherPrimitivesLines.push(`--${r}: ${projectVal || radiusDefaults[r]};`)
  })

  otherPrimitivesLines.push("")
  otherPrimitivesLines.push("/* Familles de police */")
  ;["font-base", "font-mono"].forEach((k) => {
    const projectVal = getProjectPrimitiveValue(k)
    otherPrimitivesLines.push(
      `--${k}: ${projectVal || otherPrimitivesDefaults[k]};`,
    )
  })

  otherPrimitivesLines.push("")
  otherPrimitivesLines.push("/* Graisses de police */")
  ;[
    "font-weight-light",
    "font-weight-regular",
    "font-weight-semibold",
    "font-weight-bold",
    "font-weight-extrabold",
    "font-weight-black",
  ].forEach((k) => {
    const projectVal = getProjectPrimitiveValue(k)
    otherPrimitivesLines.push(
      `--${k}: ${projectVal || otherPrimitivesDefaults[k]};`,
    )
  })

  const otherPrimitivesSection = [
    "/* Autres Primitives CSS globales */",
    ...otherPrimitivesLines,
  ]

  // Step 10: Espacements Primitives du projet (ou valeurs globales de fallback si aucune source)
  const spacingTitle = entries.length
    ? "/* Espacements Primitives du projet */"
    : "/* Espacements — valeurs globales (fallback) */"
  const spacingPrimitivesSection = spacingLines.length
    ? [spacingTitle, ...spacingLines]
    : []

  // Step 11: Espacements Tokens du projet (use normalized tokens if present)
  const projectSpacingTokensLines = []
  const spacingTokens = normalizedTokens.spacing || {}
  Object.keys(spacingTokens)
    .sort()
    .forEach((k) => {
      const clean = k.replace(/^--/, "")
      const entry = spacingTokens[k]
      if (entry.modes && entry.modes.mobile && entry.modes.desktop) {
        // Use clampBetweenModes helper - accept var(...) or px numbers
        const mobile = entry.modes.mobile
        const desktop = entry.modes.desktop
        projectSpacingTokensLines.push(
          `--${clean}: ${computeFluidClamp(mobile, desktop)};`,
        )
      } else if (entry.value) {
        projectSpacingTokensLines.push(`--${clean}: ${entry.value};`)
      }
    })
  const projectSpacingTokensSection = projectSpacingTokensLines.length
    ? ["/* Espacements Tokens du projet */", ...projectSpacingTokensLines]
    : []

  // Step 12: Typographie Primitives du projet (ou valeurs globales de fallback si aucune source)
  const typographyTitle = entries.length
    ? "/* Typographie Primitives du projet */"
    : "/* Typographie — valeurs globales (fallback) */"
  const typographyPrimitivesSection =
    textLines.length || lineHeightLines.length
      ? [typographyTitle, ...textLines, ...lineHeightLines]
      : []

  // Step 13 prep: Typographie Tokens du projet (use extractor token CSS first, else normalized tokens)
  const typographyTokensLines = []
  const fontTokensNorm =
    (normalizedTokens.fonts && normalizedTokens.fonts.fontSize) || {}
  const lineTokensNorm =
    (normalizedTokens.fonts && normalizedTokens.fonts.lineHeight) || {}

  // prefer extractor-produced token lines (fontResult.tokensCss already contains both fontSize and lineHeight token CSS)
  ;(fontResult.tokensCss || []).forEach((line) => {
    const l = (line || "").trim()
    const m = l.match(/^--([a-z0-9-]+):\s*(.+);/i)
    if (!m) {
      typographyTokensLines.push(l)
      return
    }
    const tokenName = m[1]
    // If extractor produced a calc() expression or NaN, prefer recomputing a clean clamp() from normalized tokens if possible
    if (l.includes("NaN") || l.includes("calc(")) {
      const norm = fontTokensNorm[`--${tokenName}`]
      if (norm && norm.modes && norm.modes.mobile && norm.modes.desktop) {
        typographyTokensLines.push(
          `--${tokenName}: ${computeFluidClamp(norm.modes.mobile, norm.modes.desktop)};`,
        )
        return
      }
      // fallback: keep original if we cannot generate a replacement
      typographyTokensLines.push(l)
      return
    }
    typographyTokensLines.push(l)
  })

  Object.keys(fontTokensNorm)
    .sort()
    .forEach((k) => {
      const name = k.replace(/^--/, "")
      const extractorLine = findTokenLineFromExtractor(name)
      if (extractorLine) return
      const entry = fontTokensNorm[k]
      if (entry.modes && entry.modes.mobile && entry.modes.desktop) {
        const existing = findExtractorTokenLine(name)
        if (!existing)
          typographyTokensLines.push(
            `--${name}: ${computeFluidClamp(entry.modes.mobile, entry.modes.desktop)};`,
          )
      } else if (entry.modes && entry.modes.light && entry.modes.dark) {
        const existing = findExtractorTokenLine(name)
        if (!existing)
          typographyTokensLines.push(
            `--${name}: light-dark(${entry.modes.light}, ${entry.modes.dark});`,
          )
      } else if (entry.value) {
        const existing = findExtractorTokenLine(name)
        if (!existing) typographyTokensLines.push(`--${name}: ${entry.value};`)
      }
    })

  Object.keys(lineTokensNorm)
    .sort()
    .forEach((k) => {
      const name = k.replace(/^--/, "")
      const extractorLine = findTokenLineFromExtractor(name)
      if (extractorLine) return
      const entry = lineTokensNorm[k]
      if (entry.modes && entry.modes.mobile && entry.modes.desktop) {
        typographyTokensLines.push(
          `--${name}: ${clampBetweenModes(entry.modes.mobile, entry.modes.desktop)};`,
        )
      } else if (entry.modes && entry.modes.light && entry.modes.dark) {
        typographyTokensLines.push(
          `--${name}: light-dark(${entry.modes.light}, ${entry.modes.dark});`,
        )
      } else if (entry.value) {
        typographyTokensLines.push(`--${name}: ${entry.value};`)
      }
    })

  // Deduplicate and prefer clean `clamp(var(...), <rem> + <vw>, var(...))` over raw calc() forms or NaNs
  const tokenLineMap = {}
  typographyTokensLines.forEach((l) => {
    const m = (l || "").trim().match(/^--([a-z0-9-]+):\s*(.+);/i)
    if (!m) return
    const name = m[1]
    const val = m[2]
    // ignore NaN entries entirely
    if (val.includes("NaN")) return
    const existing = tokenLineMap[name]
    if (!existing) {
      tokenLineMap[name] = l.trim()
      return
    }
    // prefer lines containing 'var(' + 'rem + ' + 'vw' (our desired pattern)
    const isPreferred = /var\(/.test(val) && /rem\s*\+\s*[0-9.]+vw/.test(val)
    const existingPreferred =
      /var\(/.test(existing) && /rem\s*\+\s*[0-9.]+vw/.test(existing)
    if (isPreferred && !existingPreferred) tokenLineMap[name] = l.trim()
  })

  // Ensure normalized font tokens (if present) override any extractor lines with a clean computeFluidClamp
  Object.keys(fontTokensNorm).forEach((k) => {
    const name = k.replace(/^--/, "")
    const entry = fontTokensNorm[k]
    if (entry && entry.modes && entry.modes.mobile && entry.modes.desktop) {
      tokenLineMap[name] =
        `--${name}: ${computeFluidClamp(entry.modes.mobile, entry.modes.desktop)};`
    }
  })
  Object.keys(lineTokensNorm).forEach((k) => {
    const name = k.replace(/^--/, "")
    const entry = lineTokensNorm[k]
    if (entry && entry.modes && entry.modes.mobile && entry.modes.desktop) {
      tokenLineMap[name] =
        `--${name}: ${computeFluidClamp(entry.modes.mobile, entry.modes.desktop)};`
    }
  })

  // Sort typography tokens by numeric anchor (left primitive rem) when possible, then by name
  const tokenObjects = Object.keys(tokenLineMap).map((n) => {
    const line = tokenLineMap[n]
    // Try to extract the left var() inside clamp(var(--...), ...)
    const m = line.match(/clamp\(\s*(?:var\((--[^)]+)\)|(--[a-z0-9-]+))/i)
    let anchorRem = NaN
    if (m) {
      const varRef = m[1] || m[2]
      if (varRef) {
        const px = (function numericPxFromRef(ref) {
          if (!ref) return null
          if (typeof ref === "number") return Number(ref)
          if (typeof ref === "string") {
            const s = ref.trim()
            if (s.endsWith("px")) return parseFloat(s.replace(/px$/, ""))
            if (s.endsWith("rem")) return parseFloat(s.replace(/rem$/, "")) * 16
            const varMatch =
              s.match(/var\((--[^)]+)\)/) ||
              (s.startsWith("--") ? [null, s] : null)
            if (varMatch) {
              const vname = varMatch[1]
              const key = vname.replace(/^--/, "")
              if (
                finalStructuredPrimitives.fontSize &&
                finalStructuredPrimitives.fontSize[key]
              )
                return (
                  parseFloat(
                    finalStructuredPrimitives.fontSize[key].value.replace(
                      /rem$/,
                      "",
                    ),
                  ) * 16
                )
              if (
                finalStructuredPrimitives.lineHeight &&
                finalStructuredPrimitives.lineHeight[key]
              )
                return (
                  parseFloat(
                    finalStructuredPrimitives.lineHeight[key].value.replace(
                      /rem$/,
                      "",
                    ),
                  ) * 16
                )
              if (
                finalStructuredPrimitives.spacing &&
                finalStructuredPrimitives.spacing[key]
              )
                return (
                  parseFloat(
                    finalStructuredPrimitives.spacing[key].value.replace(
                      /rem$/,
                      "",
                    ),
                  ) * 16
                )
            }
          }
          return null
        })(varRef)
        if (px !== null && !Number.isNaN(px)) anchorRem = px / 16
      }
    }
    return { name: n, line, anchorRem }
  })

  tokenObjects.sort((a, b) => {
    const ax = Number.isNaN(a.anchorRem) ? Infinity : a.anchorRem
    const bx = Number.isNaN(b.anchorRem) ? Infinity : b.anchorRem
    if (ax !== bx) return ax - bx
    return a.name.localeCompare(b.name)
  })

  // Separate text tokens and line-height tokens, sort each by numeric anchor (left primitive rem)
  const textTokenObjs = tokenObjects.filter((o) => /^text-/.test(o.name))
  const lhTokenObjs = tokenObjects.filter((o) => /^line-height-/.test(o.name))

  function anchorSort(a, b) {
    const ax = Number.isNaN(a.anchorRem) ? Infinity : a.anchorRem
    const bx = Number.isNaN(b.anchorRem) ? Infinity : b.anchorRem
    if (ax !== bx) return ax - bx
    return a.name.localeCompare(b.name)
  }

  textTokenObjs.sort(anchorSort)
  lhTokenObjs.sort(anchorSort)

  const dedupedTypographyTokensLines = [
    ...textTokenObjs.map((o) => o.line),
    ...lhTokenObjs.map((o) => o.line),
  ]

  const projectTypographyTokensSection = dedupedTypographyTokensLines.length
    ? ["/* Typographie Tokens du projet */", ...dedupedTypographyTokensLines]
    : []

  const rootBody = [
    colorSchemePropertyIndented,
    "",
    indent(globalColorsSection),
    "",
    indent(projectColorsSection),
    "",
    indent(globalColorTokensSection),
    "",
    indent(projectColorTokensSection),
    "",
    indent(otherPrimitivesSection),
    "",
    indent(spacingPrimitivesSection),
    projectSpacingTokensSection.length ? "" : null,
    projectSpacingTokensSection.length
      ? indent(projectSpacingTokensSection)
      : null,
    "",
    indent(typographyPrimitivesSection),
    projectTypographyTokensSection.length ? "" : null,
    projectTypographyTokensSection.length
      ? indent(projectTypographyTokensSection)
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  const cssPartsFinal = [
    header,
    breakpointsBlock,
    ":root {",
    rootBody,
    "}",
  ].join("\n\n")

  // Collapse multiple consecutive blank lines into a single blank line for tidy output
  let cleanedCss = cssPartsFinal.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n"

  // Write outputs
  writeFile(path.join(OUT_DIR, "theme.css"), cleanedCss)
  writeFile(
    path.join(OUT_DIR, "primitives.json"),
    JSON.stringify(finalStructuredPrimitives, null, 2),
  )
  writeFile(
    path.join(OUT_DIR, "tokens.json"),
    JSON.stringify(normalizedTokens, null, 2),
  )

  // Summary report
  const filesCount = entries.length

  // Final counts (after normalization & potential primitive creation)
  const colorPrimitivesCount = Object.keys(
    finalStructuredPrimitives.color || {},
  ).length
  const colorTokensCount = Object.keys(normalizedTokens.colors || {}).length
  const spacingPrimitivesCount = Object.keys(
    finalStructuredPrimitives.spacing || {},
  ).length
  const spacingTokensCount = Object.keys(normalizedTokens.spacing || {}).length
  const roundedPrimitivesCount = Object.keys(
    finalStructuredPrimitives.rounded || {},
  ).length
  const typographyPrimitivesCount =
    Object.keys(finalStructuredPrimitives.fontSize || {}).length +
    Object.keys(finalStructuredPrimitives.lineHeight || {}).length
  const typographyTokensCount =
    Object.keys(
      (normalizedTokens.fonts && normalizedTokens.fonts.fontSize) || {},
    ).length +
    Object.keys(
      (normalizedTokens.fonts && normalizedTokens.fonts.lineHeight) || {},
    ).length

  // Extractor-level counts (what each extractor discovered before normalization)
  const colorExtractorPrimitivesCount = Object.keys(
    colorResult.primitivesJson || {},
  ).length
  const colorExtractorTokensCount = Object.keys(
    colorResult.tokensJson || {},
  ).length
  const spacingExtractorPrimitivesCount = Object.keys(
    spacingResult.primitives || {},
  ).length
  const spacingExtractorTokensCount = Object.keys(
    spacingResult.json || {},
  ).length
  const roundedExtractorPrimitivesCount = spacingExtractorPrimitivesCount
    ? Object.keys(spacingResult.primitives || {}).filter((k) =>
        k.startsWith("--radius-"),
      ).length
    : 0
  const fontExtractorPrimitivesCount = Object.keys(
    fontResult.primitives || {},
  ).length
  const fontExtractorTokensCount = Object.keys(
    fontResult.json &&
      (fontResult.json.fontSize || {}) &&
      (fontResult.json.lineHeight || {})
      ? Object.assign({}, fontResult.json.fontSize, fontResult.json.lineHeight)
      : {},
  ).length

  console.log("\nExtraction summary:")
  console.log(`- Fichiers extraits : ${fileNames.length}`)
  console.log(
    `- Couleurs extraites : ${colorPrimitivesCount + colorTokensCount} (dont ${colorPrimitivesCount} Primitives et ${colorTokensCount} Tokens) — extracteur: ${colorExtractorPrimitivesCount}P / ${colorExtractorTokensCount}T`,
  )
  console.log(
    `- Espacements extraits : ${spacingPrimitivesCount + spacingTokensCount} (dont ${spacingPrimitivesCount} Primitives et ${spacingTokensCount} Tokens) — extracteur: ${spacingExtractorPrimitivesCount}P / ${spacingExtractorTokensCount}T`,
  )
  console.log(
    `- Arrondis extraits : ${roundedPrimitivesCount} (dont ${roundedPrimitivesCount} Primitives)` +
      ` — extracteur: ${roundedExtractorPrimitivesCount}P`,
  )
  console.log(
    `- Typographies extraites : ${typographyPrimitivesCount + typographyTokensCount} (dont ${typographyPrimitivesCount} Primitives et ${typographyTokensCount} Tokens) — extracteur: ${fontExtractorPrimitivesCount}P / ${fontExtractorTokensCount}T`,
  )
  console.log(
    `- Fichiers corrigés finalisés : primitives.json, tokens.json, theme.css`,
  )

  console.log("Wrote", path.join(OUT_DIR, "theme.css"))
  console.log("Wrote primitives and tokens JSON into", OUT_DIR)
})()
