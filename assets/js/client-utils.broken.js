// Client-side utilities (restored clean version)
// Export functions used by the UI to parse Mode JSON exports and generate artifacts

const colorsExtractor = require("../scripts/extract/colors");
const spacingExtractor = require("../scripts/extract/spacing");
const fontsExtractor = require("../scripts/extract/fonts");

function pxToRem(px) {
  if (px === undefined || px === null) return "0rem"
  if (typeof px === "string") {
    const s = px.trim()
    if (s.endsWith("rem")) return s
    if (s.endsWith("px")) {
      const n = parseFloat(s.slice(0, -2))
      if (isNaN(n)) return "0rem"
      return `${(n / 16).toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}rem`
    }
    const n = Number(s)
    if (!isNaN(n)) return `${(n / 16).toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}rem`
    return s
  }
  const num = Number(px)
  if (isNaN(num)) return "0rem"
  return `${(num / 16).toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}rem`
}

function valueToPx(val) {
  if (val === undefined || val === null) return NaN
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const s = val.trim()
    if (s.endsWith("px")) return parseFloat(s.slice(0, -2))
    if (s.endsWith("rem")) return parseFloat(s.slice(0, -3)) * 16
    const n = Number(s)
    if (!isNaN(n)) return n
  }
  return NaN
}

function clampBetweenModes(mobileVarOrHex, desktopVarOrHex) {
  const mobile = typeof mobileVarOrHex === "string" && mobileVarOrHex.startsWith("--") ? `var(${mobileVarOrHex})` : pxToRem(Number(mobileVarOrHex))
  const desktop = typeof desktopVarOrHex === "string" && desktopVarOrHex.startsWith("--") ? `var(${desktopVarOrHex})` : pxToRem(Number(desktopVarOrHex))
  return `clamp(${mobile}, calc(${mobile} + ((100vw - 360px) / 920) * (calc(${desktop} - ${mobile}))), ${desktop})`
}

function numericKeyValue(k) {
  const s = String(k).toLowerCase()
  if (s.includes("none")) return 0
  if (s.includes("full")) return Number.MAX_SAFE_INTEGER
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : NaN
}
function numericSortKeys(keys) {
  return keys.sort((a, b) => {
    const na = numericKeyValue(a)
    const nb = numericKeyValue(b)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    if (!Number.isNaN(na)) return -1
    if (!Number.isNaN(nb)) return 1
    return String(a).localeCompare(String(b))
  })
}

function computeFluidClamp(mobileRef, desktopRef, structuredPrimitivesParam) {
  // Try to resolve numeric px values for a clean clamp; fallback to clampBetweenModes
  function numericPxFromRef(ref) {
    if (ref === undefined || ref === null) return null
    if (typeof ref === "number") return Number(ref)
    if (typeof ref === "string") {
      const s = ref.trim()
      if (s.endsWith("px")) return parseFloat(s.replace(/px$/, ""))
      if (s.endsWith("rem")) return parseFloat(s.replace(/rem$/, "")) * 16
      const varMatch = s.match(/var\((--[^)]+)\)/) || (s.startsWith("--") ? [null, s] : null)
      if (varMatch) {
        const vname = varMatch[1]
        if (!vname) return null
        if (vname.startsWith("--spacing-") && structuredPrimitivesParam && structuredPrimitivesParam.spacing) {
          const raw = vname.replace(/^--spacing-/, "")
          const key = `spacing-${raw}`
          if (structuredPrimitivesParam.spacing && structuredPrimitivesParam.spacing[key]) return valueToPx(structuredPrimitivesParam.spacing[key].value)
        }
        if (vname.startsWith("--text-") && structuredPrimitivesParam && structuredPrimitivesParam.fontSize) {
          const raw = vname.replace(/^--text-/, "")
          const key = `text-${raw}`
          if (structuredPrimitivesParam.fontSize && structuredPrimitivesParam.fontSize[key]) return valueToPx(structuredPrimitivesParam.fontSize[key].value)
        }
        if (vname.startsWith("--line-height-") && structuredPrimitivesParam && structuredPrimitivesParam.lineHeight) {
          const raw = vname.replace(/^--line-height-/, "")
          const key = `line-height-${raw}`
          if (structuredPrimitivesParam.lineHeight && structuredPrimitivesParam.lineHeight[key]) return valueToPx(structuredPrimitivesParam.lineHeight[key].value)
        }
      }
    }
    return null
  }

  const mobPx = numericPxFromRef(mobileRef)
  const deskPx = numericPxFromRef(desktopRef)
  if (Number.isFinite(mobPx) && Number.isFinite(deskPx)) {
    const delta = deskPx - mobPx
    const slope = (delta * 100) / 920
    const interceptPx = mobPx - slope * (360 / 100)
    const interceptRem = (interceptPx / 16).toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
    const slopeStr = slope.toFixed(4).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
    const mobileExpr = typeof mobileRef === "string" && mobileRef.startsWith("--") ? `var(${mobileRef})` : pxToRem(mobPx)
    const desktopExpr = typeof desktopRef === "string" && desktopRef.startsWith("--") ? `var(${desktopRef})` : pxToRem(deskPx)
    return `clamp(${mobileExpr}, ${interceptRem}rem + ${slopeStr}vw, ${desktopExpr})`
  }
  return clampBetweenModes(mobileRef, desktopRef)
}

// Emit spacing token lines helper
function emitSpacingTokenLines(spacingTokensObj, structuredPrimitivesParam) {
  const out = []
  const names = numericSortKeys(Object.keys(spacingTokensObj || {}))
  names.forEach((k) => {
    const clean = k.replace(/^--/, "")
    const entry = spacingTokensObj[k]
    if (entry.modes && entry.modes.mobile && entry.modes.desktop) {
      const line = computeFluidClamp(entry.modes.mobile, entry.modes.desktop, structuredPrimitivesParam)
      const mob = valueToPx(
        (entry.modes.mobile || "").startsWith("var(") ? structuredPrimitivesParam && structuredPrimitivesParam.spacing && structuredPrimitivesParam.spacing[String(entry.modes.mobile).replace(/var\((--|)\)/g, "")] && structuredPrimitivesParam.spacing[String(entry.modes.mobile).replace(/var\((--|)\)/g, "")].value : entry.modes.mobile
      )
      const mobPx = Number.isFinite(mob) ? mob : null
      const desk = valueToPx(
        (entry.modes.desktop || "").startsWith("var(") ? structuredPrimitivesParam && structuredPrimitivesParam.spacing && structuredPrimitivesParam.spacing[String(entry.modes.desktop).replace(/var\((--|)\)/g, "")] && structuredPrimitivesParam.spacing[String(entry.modes.desktop).replace(/var\((--|)\)/g, "")].value : entry.modes.desktop
      )
      const deskPx = Number.isFinite(desk) ? desk : null
      const pxComment = Number.isFinite(mobPx) && Number.isFinite(deskPx) ? ` /* ${Math.round(mobPx)}px / ${Math.round(deskPx)}px */` : ""
      out.push(`--${clean}: ${line};${pxComment}`)
    } else if (entry.value) {
      const px = valueToPx(entry.value)
      const pxComment = Number.isFinite(px) ? ` /* ${Math.round(px)}px */` : ""
      out.push(`--${clean}: ${entry.value};${pxComment}`)
    }
  })
  return out
}

// Main: processFiles
async function processFiles(fileList, logger = console.log) {
  const entries = []
  for (const file of fileList) {
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const rawMode = (json && json.$extensions && json.$extensions["com.figma.modeName"]) || json.mode || null
      let modeName = null
      if (rawMode) {
        const lower = String(rawMode).toLowerCase()
        if (["light", "dark", "mobile", "desktop"].includes(lower)) modeName = lower
      }
      entries.push({ fileName: file.name, json, modeName })
      logger(`Parsed ${file.name} (mode: ${modeName || "none"})`)
    } catch (err) {
      logger(`Erreur parsing ${file.name}: ${err.message}`)
    }
  }

  const colorResult = colorsExtractor.extractColors(entries)
  const spacingResult = spacingExtractor.extractSpacing(entries)
  const fontsResult = fontsExtractor.extractFonts(entries)

  const hasSpacingSource = entries.some(({ json }) => json.Spacing || json.spacing || json.spacings)
  const hasFontSource = entries.some(({ json }) => json.FontSize || json.fontSize || json.Font || json.font)
  const hasLineHeightSource = entries.some(({ json }) => json.LineHeight || json["Line-height"] || json.lineheight || json["line-height"] || json.lineHeight || json.lineheight)

  const allPrimitivesFlat = Object.assign({}, colorResult.primitivesJson || {}, spacingResult.primitives || {}, fontsResult.primitives || {})

  // apply fallback defaults if no entries
  if (!entries.length) {
    const spacingDefaults = {
      "--spacing-0": "0",
      "--spacing-2": "0.125rem",
      "--spacing-4": "0.25rem",
      "--spacing-8": "0.5rem",
      "--spacing-12": "0.75rem",
      "--spacing-16": "1rem",
      "--spacing-24": "1.5rem",
      "--spacing-32": "2rem",
      "--spacing-48": "3rem",
    }
    Object.keys(spacingDefaults).forEach((k) => {
      if (!allPrimitivesFlat[k]) allPrimitivesFlat[k] = spacingDefaults[k]
    })
    if (!allPrimitivesFlat["--text-16"]) allPrimitivesFlat["--text-16"] = 16
    if (!allPrimitivesFlat["--text-14"]) allPrimitivesFlat["--text-14"] = 14
    if (!allPrimitivesFlat["--text-18"]) allPrimitivesFlat["--text-18"] = 18
  }

  // Build structured primitives like CLI
  function buildStructuredPrimitives(flat) {
    const out = { color: {}, spacing: {}, fontSize: {}, lineHeight: {}, rounded: {} }
    Object.keys(flat).forEach((k) => {
      const v = flat[k]
      if (!k.startsWith("--")) return
      if (k.startsWith("--color-")) {
        const name = k.replace(/^--color-/, "")
        out.color[name] = { $type: "color", value: v }
      } else if (k.startsWith("--spacing-")) {
        const raw = k.replace(/^--spacing-/, "")
        out.spacing[`spacing-${raw}`] = { $type: "number", value: pxToRem(v) }
      } else if (k.startsWith("--text-")) {
        const raw = k.replace(/^--text-/, "")
        out.fontSize[`text-${raw}`] = { $type: "number", value: pxToRem(v) }
      } else if (k.startsWith("--line-height-")) {
        const raw = k.replace(/^--line-height-/, "")
        out.lineHeight[`line-height-${raw}`] = { $type: "number", value: pxToRem(v) }
      } else if (k.startsWith("--radius-") || k.startsWith("--rounded-")) {
        const name = k.replace(/^--(radius|rounded)-/, "")
        out.rounded[`radius-${name}`] = { $type: "number", value: pxToRem(v) }
      } else if (typeof v === "string" && v.startsWith("#")) {
        const name = k.replace(/^--/, "")
        out.color[name] = { $type: "color", value: v }
      } else if (!isNaN(Number(v))) {
        const name = k.replace(/^--/, "")
        out[name] = { $type: "number", value: `${(Number(v)/16).toFixed(4).replace(/(\.\d*?)0+$/,"$1").replace(/\.$/,'')}rem` }
      } else {
        const name = k.replace(/^--/, "")
        out[name] = { $type: "string", value: String(v) }
      }
    })
    return out
  }

  const structuredPrimitives = buildStructuredPrimitives(allPrimitivesFlat)

  // Normalize tokens: reuse spacingResult.json and fontsResult.json format
  const normalizedTokens = { colors: {}, spacing: {}, fonts: { fontSize: {}, lineHeight: {} } }
  Object.keys(colorResult.tokensJson || {}).forEach((k) => normalizedTokens.colors[k.replace(/^--/, "")] = { type: 'color', value: `var(${k})` })
  Object.keys(spacingResult.json || {}).forEach((k) => normalizedTokens.spacing[k.replace(/^--/, "")] = spacingResult.json[k])
  if (fontsResult.json && fontsResult.json.fontSize) normalizedTokens.fonts.fontSize = fontsResult.json.fontSize
  if (fontsResult.json && fontsResult.json.lineHeight) normalizedTokens.fonts.lineHeight = fontsResult.json.lineHeight

  // Build theme.css minimal needed by tests
  const header = `/* ----------------------------------\n * Theme du projet\n * ---------------------------------- */\n\n`
  const breakpoints = `/* stylelint-disable */\n/* Custom Breakpoints */\n@custom-media --md (width >= 48rem);\n@custom-media --lg (width >= 64rem);\n@custom-media --xl (width >= 80rem);\n@custom-media --xxl (width >= 96rem);\n@custom-media --until-md (width < 48rem);\n@custom-media --until-lg (width < 64rem);\n@custom-media --until-xl (width < 80rem);\n@custom-media --until-xxl (width < 96rem);\n/* stylelint-enable */\n\n`
  const parts = []
  parts.push(header)
  parts.push(breakpoints)
  parts.push(":root {\n\n")
  parts.push("  /* Theme (color-scheme) */\n  color-scheme: light;\n\n  &[data-theme=\"light\"] { color-scheme: light; }\n  &[data-theme=\"dark\"] { color-scheme: dark; }\n\n")

  // Global colors
  parts.push("  /* Couleurs (globales) */\n")
  const global = ["white","black","gray-50","gray-100","gray-200","gray-300","gray-400","gray-500","gray-600","gray-700","gray-800","gray-900"]
  global.forEach((name) => parts.push(`  --color-${name}: ${structuredPrimitives.color && structuredPrimitives.color[name] ? structuredPrimitives.color[name].value : 'oklch(0.5 0 0)'};\n`))
  parts.push("\n")

  // Other primitives (radii, fonts)
  parts.push("  /* Autres Primitives globales */\n")
  parts.push("  --transition-duration: 250ms;\n\n")

  // Espacements Primitives du projet
  if (structuredPrimitives.spacing && (hasSpacingSource || entries.length===0)) {
    parts.push("  /* Espacements Primitives du projet */\n")
    numericSortKeys(Object.keys(structuredPrimitives.spacing)).forEach((k) => {
      const v = structuredPrimitives.spacing[k].value
      const px = valueToPx(v)
      const comment = Number.isFinite(px) ? ` /* ${Math.round(px)}px */` : ""
      parts.push(`  --${k.replace(/^/, '')}: ${v};${comment}\n`)
    })
    parts.push("\n")
  }

  // Espacements Tokens
  const spacingTokens = normalizedTokens.spacing || {}
  const tokenLines = emitSpacingTokenLines(Object.keys(spacingTokens).length ? Object.fromEntries(Object.entries(spacingTokens).map(([k,v])=>[k,v])) : {}, structuredPrimitives)
  if (tokenLines.length) {
    parts.push("  /* Espacements Tokens du projet */\n")
    tokenLines.forEach((l)=> parts.push(`  ${l}\n`))
    parts.push("\n")
  }

  // Typographie primitives
  if ((structuredPrimitives.fontSize || structuredPrimitives.lineHeight) && (hasFontSource || hasLineHeightSource || entries.length===0)) {
    parts.push("  /* Typographie */\n")
    numericSortKeys(Object.keys(structuredPrimitives.fontSize || {})).forEach((k)=>{
      const v = structuredPrimitives.fontSize[k].value
      const px = valueToPx(v)
      const comment = Number.isFinite(px) ? ` /* ${Math.round(px)}px */` : ""
      parts.push(`  --${k.replace(/^/, '')}: ${v};${comment}\n`)
    })
    if (structuredPrimitives.lineHeight) {
      numericSortKeys(Object.keys(structuredPrimitives.lineHeight)).forEach((k)=>{
        const v = structuredPrimitives.lineHeight[k].value
        const px = valueToPx(v)
        const comment = Number.isFinite(px) ? ` /* ${Math.round(px)}px */` : ""
        parts.push(`  --${k.replace(/^/, '')}: ${v};${comment}\n`)
      })
    }
    parts.push("\n")
  }

  parts.push("}\n")
  const themeCss = parts.join("")

  const artifacts = {
    "primitives.json": JSON.stringify(structuredPrimitives, null, 2),
    "tokens.json": JSON.stringify(normalizedTokens, null, 2),
    "theme.css": themeCss,
  }

  return { artifacts }
}

module.exports = { processFiles, emitSpacingTokenLines }

function toCssVarName(parts) {
  return "--" + parts.join("-").replace(/\s+/g, "-").toLowerCase()
}

function pxToRem(px) {
  // Accept numbers (px), strings with 'px' or 'rem', or bare numeric strings
  if (px === undefined || px === null) return "0rem"
  if (typeof px === "string") {
    const s = px.trim()
    if (s.endsWith("rem")) return s
    if (s.endsWith("px")) {
      const n = parseFloat(s.slice(0, -2))
      if (isNaN(n)) return "0rem"
      return `${(n / 16)
        .toFixed(3)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1")}rem`
    }
    const n = Number(s)
    if (!isNaN(n))
      return `${(n / 16)
        .toFixed(3)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1")}rem`
    // Unknown string (color etc.), return as-is
    return s
  }
  const num = Number(px)
  if (isNaN(num)) return "0rem"
  return `${(num / 16)
    .toFixed(3)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1")}rem`
}

function valueToPx(val) {
  if (val === undefined || val === null) return NaN
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const s = val.trim()
    if (s.endsWith("px")) return parseFloat(s.slice(0, -2))
    if (s.endsWith("rem")) return parseFloat(s.slice(0, -3)) * 16
    const n = Number(s)
    if (!isNaN(n)) return n
  }
  return NaN
}

// Numeric sorting helpers: interpret 'none' as 0, 'full' as very large, otherwise extract first number
function _numericKeyValue(k) {
  const s = String(k).toLowerCase()
  if (s.includes("none")) return 0
  if (s.includes("full")) return Number.MAX_SAFE_INTEGER
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : NaN
}
function numericSortKeys(keys) {
  return keys.sort((a, b) => {
    const na = _numericKeyValue(a)
    const nb = _numericKeyValue(b)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    if (!Number.isNaN(na)) return -1
    if (!Number.isNaN(nb)) return 1
    return String(a).localeCompare(String(b))
  })
}

// Resolve a reference (var(--...), rem, px, or number) to px when possible
function resolvePxFromRef(ref, structuredPrimitivesParam) {
  if (ref === undefined || ref === null) return NaN
  if (typeof ref === "number") return Number(ref)
  if (typeof ref === "string") {
    const s = ref.trim()
    if (s.endsWith("px")) return parseFloat(s.replace(/px$/, ""))
    if (s.endsWith("rem")) return parseFloat(s.replace(/rem$/, "")) * 16
    // var(--foo-...)
    const varMatch =
      s.match(/var\((--[a-z0-9-]+)\)/i) ||
      (s.startsWith("--") ? [null, s] : null)
    if (varMatch) {
      const vname = varMatch[1]
      if (!vname) return NaN
      // spacing
      if (
        vname.startsWith("--spacing-") &&
        structuredPrimitivesParam &&
        structuredPrimitivesParam.spacing
      ) {
        const raw = vname.replace(/^--spacing-/, "")
        const key = `spacing-${raw}`
        if (
          structuredPrimitivesParam.spacing &&
          structuredPrimitivesParam.spacing[key]
        ) {
          return valueToPx(structuredPrimitivesParam.spacing[key].value)
        }
      }
      // font size
      if (
        vname.startsWith("--text-") &&
        structuredPrimitivesParam &&
        structuredPrimitivesParam.fontSize
      ) {
        const raw = vname.replace(/^--text-/, "")
        const key = `text-${raw}`
        if (
          structuredPrimitivesParam.fontSize &&
          structuredPrimitivesParam.fontSize[key]
        ) {
          return valueToPx(structuredPrimitivesParam.fontSize[key].value)
        }
      }
      // line-height
      if (
        vname.startsWith("--line-height-") &&
        structuredPrimitivesParam &&
        structuredPrimitivesParam.lineHeight
      ) {
        const raw = vname.replace(/^--line-height-/, "")
        const key = `line-height-${raw}`
        if (
          structuredPrimitivesParam.lineHeight &&
          structuredPrimitivesParam.lineHeight[key]
        ) {
          return valueToPx(structuredPrimitivesParam.lineHeight[key].value)
        }
      }
    }
    // couldn't resolve
    return NaN
  }
  return NaN
}

function clampBetweenModes(mobileVarOrHex, desktopVarOrHex) {
  // mobileVarOrHex or desktopVarOrHex can be '--var' or number (px) or string hex
  const mobile =
    typeof mobileVarOrHex === "string" && mobileVarOrHex.startsWith("--")
      ? `var(${mobileVarOrHex})`
      : pxToRem(Number(mobileVarOrHex))
  const desktop =
    typeof desktopVarOrHex === "string" && desktopVarOrHex.startsWith("--")
      ? `var(${desktopVarOrHex})`
      : pxToRem(Number(desktopVarOrHex))
  return `clamp(${mobile}, calc(${mobile} + ((100vw - 360px) / 920) * (calc(${desktop} - ${mobile}))), ${desktop})`
}

// Emit spacing token lines (used by processFiles and tests)
function emitSpacingTokenLines(spacingTokensObj, structuredPrimitivesParam) {
  const out = []
  const names = numericSortKeys(Object.keys(spacingTokensObj || {}))
  names.forEach((k) => {
    const clean = k.replace(/^--/, "")
    const entry = spacingTokensObj[k]
    if (entry.modes && entry.modes.mobile && entry.modes.desktop) {
      const line = computeFluidClamp(entry.modes.mobile, entry.modes.desktop, structuredPrimitivesParam)
      const mob = resolvePxFromRef(entry.modes.mobile, structuredPrimitivesParam)
      const desk = resolvePxFromRef(entry.modes.desktop, structuredPrimitivesParam)
      const pxComment = Number.isFinite(mob) && Number.isFinite(desk) ? ` /* ${Math.round(mob)}px / ${Math.round(desk)}px */` : ""
      out.push(`--${clean}: ${line};${pxComment}`)
    } else if (entry.value) {
      const px = resolvePxFromRef(entry.value, structuredPrimitivesParam)
      const pxComment = Number.isFinite(px) ? ` /* ${Math.round(px)}px */` : ""
      out.push(`--${clean}: ${entry.value};${pxComment}`)
    }
  })
  return out
}

// Compute clamp(var(--primitive-mobile), <intercept>rem + <slope>vw, var(--primitive-desktop))
// Attempts to resolve numeric px values from structured primitives to produce a clean clamp expression.
function computeFluidClamp(mobileRef, desktopRef, structuredPrimitivesParam) {
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
      const varMatch =
        s.match(/var\((--[^)]+)\)/) || (s.startsWith("--") ? [null, s] : null)
      if (varMatch) {
        const vname = varMatch[1]
        const key = vname.replace(/^--/, "")
        if (
          structuredPrimitivesParam.fontSize &&
          structuredPrimitivesParam.fontSize[key]
        ) {
          return (
            parseFloat(
              structuredPrimitivesParam.fontSize[key].value.replace(/rem$/, ""),
            ) * 16
          )
        }
        if (
          structuredPrimitivesParam.lineHeight &&
          structuredPrimitivesParam.lineHeight[key]
        ) {
          return (
            parseFloat(
              structuredPrimitivesParam.lineHeight[key].value.replace(
                /rem$/,
                "",
              ),
            ) * 16
          )
        }
        if (
          structuredPrimitivesParam.spacing &&
          structuredPrimitivesParam.spacing[key]
        ) {
          return (
            parseFloat(
              structuredPrimitivesParam.spacing[key].value.replace(/rem$/, ""),
            ) * 16
          )
        }
        if (
          structuredPrimitivesParam.rounded &&
          structuredPrimitivesParam.rounded[key]
        ) {
          return (
            parseFloat(
              structuredPrimitivesParam.rounded[key].value.replace(/rem$/, ""),
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

  if (
    mobilePx === null ||
    desktopPx === null ||
    Number.isNaN(mobilePx) ||
    Number.isNaN(desktopPx)
  ) {
    return clampBetweenModes(mobileExpr || mobileRef, desktopExpr || desktopRef)
  }

  const deltaPx = desktopPx - mobilePx
  const slopePxPerVw = (deltaPx * 100) / (1280 - 360)
  const interceptPx = mobilePx - slopePxPerVw * (360 / 100)

  const interceptRem = Number((interceptPx / 16).toFixed(3))
  const slopeVwStr = Number(slopePxPerVw.toFixed(4))
  const middle = `${interceptRem}rem + ${slopeVwStr}vw`

  const left =
    mobileExpr && mobileExpr.startsWith("var(") ? mobileExpr : pxToRem(mobilePx)
  const right =
    desktopExpr && desktopExpr.startsWith("var(")
      ? desktopExpr
      : pxToRem(desktopPx)

  return `clamp(${left}, ${middle}, ${right})`
}

function aliasToVar(alias) {
  return "--" + alias.replace(/[\/]/g, "-").toLowerCase()
}

// Adaptation of extractors for browser environment. They expect entries: [{ json, modeName }]

function flattenColors(colorObject, prefix = []) {
  const result = {}
  Object.keys(colorObject || {}).forEach((key) => {
    const val = colorObject[key]
    if (val && val.$type === "color" && val.$value && val.$value.hex) {
      const name = toCssVarName(["color", ...prefix, key])
      result[name] = val.$value.hex
    } else if (typeof val === "object") {
      Object.assign(result, flattenColors(val, [...prefix, key]))
    }
  })
  return result
}

function extractColors(entries) {
  const primitives = {}
  const tokensByName = {}
  const modes = new Set()

  function scanColorTokens(obj, prefix, mode) {
    Object.keys(obj || {}).forEach((key) => {
      const val = obj[key]
      if (!val) return
      if (
        val.$type === "color" &&
        val.$extensions &&
        val.$extensions["com.figma.isOverride"]
      ) {
        const tokenName = [...(prefix || []), key]
          .join("-")
          .replace(/\s+/g, "-")
          .toLowerCase()
        const hex = val.$value && val.$value.hex
        const aliasData =
          (val.$extensions && val.$extensions["com.figma.aliasData"]) || null
        const alias =
          aliasData && aliasData.targetVariableName
            ? aliasToVar(aliasData.targetVariableName)
            : null
        const variableId =
          val.$extensions && val.$extensions["com.figma.variableId"]
            ? val.$extensions["com.figma.variableId"]
            : null
        tokensByName[tokenName] = tokensByName[tokenName] || {}
        tokensByName[tokenName][mode] = {
          rawHex: hex || null,
          aliasVar: alias || null,
          variableId: variableId || null,
        }
      }
      if (typeof val === "object" && !val.$type) {
        scanColorTokens(val, [...(prefix || []), key], mode)
      }
    })
  }

  entries.forEach(({ json, modeName }) => {
    if (json.color) {
      const flat = flattenColors(json.color)
      Object.assign(primitives, flat)
    }

    // Gather other top-level primitives (string/number) regardless of mode
    Object.keys(json || {}).forEach((k) => {
      if (["color", "Spacing", "FontSize", "LineHeight", "Rounded"].includes(k))
        return
      const v = json[k]
      if (v && (v.$type === "string" || v.$type === "number")) {
        let extracted = v.$value ?? v.value ?? null
        if (extracted && typeof extracted === "object" && extracted.hex)
          extracted = extracted.hex
        if (extracted !== null)
          primitives[`--${k.replace(/\s+/g, "-").toLowerCase()}`] = extracted
      }
    })

    if (!modeName) return
    const mode = modeName.toLowerCase()
    modes.add(mode)
    if (json.color) scanColorTokens(json.color, [], mode)
    Object.keys(json || {}).forEach((k) => {
      if (["color", "Spacing", "FontSize", "LineHeight", "Rounded"].includes(k))
        return
      const val = json[k]
      if (val && val.$type === "color") {
        const token = k
        const hex = val.$value && val.$value.hex
        const aliasData =
          (val.$extensions && val.$extensions["com.figma.aliasData"]) || null
        const alias =
          aliasData && aliasData.targetVariableName
            ? aliasToVar(aliasData.targetVariableName)
            : null
        const variableId =
          val.$extensions && val.$extensions["com.figma.variableId"]
            ? val.$extensions["com.figma.variableId"]
            : null
        tokensByName[token] = tokensByName[token] || {}
        tokensByName[token][mode] = {
          rawHex: hex || null,
          aliasVar: alias || null,
          variableId: variableId || null,
        }
      }
    })
  })

  const primitivesCss = Object.keys(primitives)
    .sort()
    .map((name) => `${name}: ${primitives[name]};`)

  const exceptions = new Set([
    "primary",
    "on-primary",
    "primary-lighten",
    "primary-darken",
    "accent",
    "accent-invert",
    "surface",
    "on-surface",
    "layer-1",
    "layer-2",
    "layer-3",
    "link",
    "link-hover",
    "link-active",
    "selection",
    "warning",
    "error",
    "success",
    "info",
    "border-light",
    "border-medium",
  ])

  const tokensCss = []
  const tokensJson = {}
  const warnings = []

  Object.keys(tokensByName).forEach((token) => {
    const perMode = tokensByName[token]
    const normalizedToken = token.replace(/\s+/g, "-").toLowerCase()
    const varName = `--${normalizedToken}`

    const outPerMode = {}
    const modesPresent = Object.keys(perMode)

    modesPresent.forEach((m) => {
      const entry = perMode[m]
      let primitiveVar = entry.aliasVar
      if (!primitiveVar && entry.rawHex) {
        const found = Object.keys(primitives).find(
          (k) => primitives[k].toLowerCase() === entry.rawHex.toLowerCase(),
        )
        if (found) primitiveVar = found
      }
      outPerMode[m] = primitiveVar
        ? {
            value: `var(${primitiveVar})`,
            primitive: primitiveVar,
            variableId: entry.variableId,
          }
        : { value: entry.rawHex, primitive: null, variableId: entry.variableId }
    })

    if (modesPresent.length === 1) {
      const only = modesPresent[0]
      const val = outPerMode[only]
      if (val && val.primitive)
        primitives[`--${normalizedToken}`] = primitives[val.primitive] || null
      else if (val && val.value) primitives[`--${normalizedToken}`] = val.value
      if (modesPresent[0] !== "") {
        warnings.push({
          token: normalizedToken,
          type: "missing-mode-variant",
          message: `Token '${normalizedToken}' present only in mode '${modesPresent[0]}'. Missing counterpart mode.`,
        })
      }
    } else {
      tokensJson[normalizedToken] = outPerMode

      if (modesPresent.includes("light") && modesPresent.includes("dark")) {
        const lightVal = outPerMode["light"].primitive
          ? `var(${outPerMode["light"].primitive})`
          : outPerMode["light"].value
        const darkVal = outPerMode["dark"].primitive
          ? `var(${outPerMode["dark"].primitive})`
          : outPerMode["dark"].value
        tokensCss.push(`${varName}: light-dark(${lightVal}, ${darkVal});`)
      } else if (
        modesPresent.includes("mobile") &&
        modesPresent.includes("desktop")
      ) {
        const mobileEntry = outPerMode["mobile"]
        const desktopEntry = outPerMode["desktop"]
        const mobileVarOrVal =
          mobileEntry && mobileEntry.primitive
            ? mobileEntry.primitive
            : mobileEntry && mobileEntry.value
        const desktopVarOrVal =
          desktopEntry && desktopEntry.primitive
            ? desktopEntry.primitive
            : desktopEntry && desktopEntry.value
        tokensCss.push(
          `${varName}: ${clampBetweenModes(mobileVarOrVal.startsWith("--") ? mobileVarOrVal : mobileEntry.value, desktopVarOrVal.startsWith("--") ? desktopVarOrVal : desktopEntry.value)};`,
        )
      } else {
        const onlyMode = modesPresent[0]
        const v = outPerMode[onlyMode]
        if (!v) {
          tokensCss.push(`/* ${varName}: missing value for mode ${onlyMode} */`)
        } else if (v.primitive) {
          tokensCss.push(`${varName}: var(${v.primitive});`)
        } else {
          tokensCss.push(`${varName}: ${v.value};`)
        }
      }
    }
  })

  return {
    primitivesJson: primitives,
    primitivesCss,
    tokensCss,
    tokensJson,
    modes: Array.from(modes),
    warnings,
  }
}

function extractSpacing(entries) {
  const spacing = {}
  const tokensByName = {}

  entries.forEach(({ json, modeName }) => {
    const spacingSection = json.Spacing || json.spacing || json.spacings || null
    if (spacingSection) {
      Object.keys(spacingSection).forEach((k) => {
        const raw = spacingSection[k]
        const v = raw && (raw.$value ?? raw.value ?? raw)
        const name = `--spacing-${k}`
        spacing[name] = v
      })
    }

    const roundedSection = json.Rounded || json.rounded || null
    if (roundedSection) {
      Object.keys(roundedSection).forEach((k) => {
        const raw = roundedSection[k]
        const v = raw && (raw.$value ?? raw.value ?? raw)
        const name = `--radius-${k}`
        spacing[name] = v
      })
    }
  })

  const primitives = {}
  const tokens = {}
  Object.keys(spacing).forEach((name) => {
    primitives[name] = spacing[name]
    tokens[name] = { value: `var(${name})`, px: spacing[name] }
  })

  function _numericKeyValue(k) {
    const s = String(k).toLowerCase()
    if (s.includes("none")) return 0
    if (s.includes("full")) return Number.MAX_SAFE_INTEGER
    const m = s.match(/(\d+(?:\.\d+)?)/)
    return m ? Number(m[1]) : NaN
  }
  const css = Object.keys(spacing)
    .sort((a, b) => {
      const na = _numericKeyValue(a)
      const nb = _numericKeyValue(b)
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
      if (!Number.isNaN(na)) return -1
      if (!Number.isNaN(nb)) return 1
      return String(a).localeCompare(String(b))
    })
    .map(
      (name) =>
        `${name}: ${pxToRem(spacing[name])}; /* ${String(spacing[name])} */`,
    )
  return { primitives, json: tokens, css }
}

function extractFonts(entries) {
  const fontSize = {}
  const lineHeight = {}
  const modes = new Set()

  entries.forEach(({ json, modeName }) => {
    if (modeName) modes.add(modeName.toLowerCase())
    const fontSizeSection =
      json.FontSize ||
      json.fontSize ||
      json["Font-Size"] ||
      json.font ||
      json.Font ||
      null
    if (fontSizeSection) {
      Object.keys(fontSizeSection).forEach((k) => {
        const raw = fontSizeSection[k]
        const v = raw && (raw.$value ?? raw.value ?? raw)
        const normalized = String(k).replace(/^text-/, "")
        fontSize[`--text-${normalized}`] = v
      })
    }

    const lhSection =
      json.LineHeight ||
      json["Line-height"] ||
      json["lineheight"] ||
      json["line-height"] ||
      json.lineHeight ||
      json.lineheight ||
      null
    if (lhSection) {
      const lh = lhSection
      Object.keys(lh).forEach((k) => {
        const raw = lh[k]
        const v = raw && (raw.$value ?? raw.value ?? raw)
        const normalized = String(k)
          .replace(/^line-?height-?/i, "")
          .replace(/^lineheight-?/i, "")
        lineHeight[`--line-height-${normalized}`] = v
      })
    }
  })

  const css = []
  numericSortKeys(Object.keys(fontSize)).forEach((k) =>
    css.push(`${k}: ${pxToRem(fontSize[k])}; /* ${String(fontSize[k])} */`),
  )
  numericSortKeys(Object.keys(lineHeight)).forEach((k) =>
    css.push(`${k}: ${pxToRem(lineHeight[k])}; /* ${String(lineHeight[k])} */`),
  )

  const tokensFont = {}
  const tokensLine = {}

  const fontTokensByName = {}
  const lineTokensByName = {}
  entries.forEach(({ json, modeName }) => {
    const mode = (modeName || "").toLowerCase()
    const fontSection =
      json.FontSize ||
      json.fontSize ||
      json["Font-Size"] ||
      json.font ||
      json.Font ||
      null
    if (fontSection) {
      Object.keys(fontSection).forEach((k) => {
        const normalized = String(k).replace(/^text-/, "")
        const token = `text-${normalized}`
        fontTokensByName[token] = fontTokensByName[token] || {}
        fontTokensByName[token][mode] = fontSection[k] && fontSection[k].$value
      })
    }
    const lhSection =
      json.LineHeight ||
      json["Line-height"] ||
      json["lineheight"] ||
      json["line-height"] ||
      json.lineHeight ||
      json.lineheight ||
      null
    if (lhSection) {
      Object.keys(lhSection).forEach((k) => {
        const normalized = String(k)
          .replace(/^line-?height-?/i, "")
          .replace(/^lineheight-?/i, "")
        const token = `line-height-${normalized}`
        lineTokensByName[token] = lineTokensByName[token] || {}
        lineTokensByName[token][mode] = lhSection[k] && lhSection[k].$value
      })
    }
  })

  const tokensCss = []
  const primitives = {}
  const tokenFontSize = {}
  const tokenLineHeight = {}

  const hasDeviceModes = modes.has("desktop") || modes.has("mobile")
  const warnings = []

  Object.keys(fontTokensByName).forEach((token) => {
    const per = fontTokensByName[token]
    if (
      hasDeviceModes &&
      per[""] !== undefined &&
      (per.desktop !== undefined || per.mobile !== undefined)
    ) {
      const fallback = per[""]
      if (!per.desktop && !per.mobile) {
        per.desktop = fallback
        per.mobile = fallback
      } else if (!per.desktop && per.mobile) {
        per.desktop = fallback
      } else if (per.desktop && !per.mobile) {
        per.mobile = fallback
      }
      delete per[""]
    }

    const modesForToken = Object.keys(per)
    if (modesForToken.length === 1 && modesForToken[0] === "") {
      const only = modesForToken[0]
      primitives[`--${token}`] = per[only]
    } else {
      if (modesForToken.length === 1 && modesForToken[0] !== "") {
        const only = modesForToken[0]
        primitives[`--${token}`] = per[only]
        return
      }

      tokenFontSize[`--${token}`] = { value: `var(--${token})`, modes: per }
      if (
        modesForToken.includes("mobile") &&
        modesForToken.includes("desktop")
      ) {
        tokensCss.push(
          `--${token}: ${clampBetweenModes(per["mobile"], per["desktop"])};`,
        )
      } else if (
        modesForToken.includes("light") &&
        modesForToken.includes("dark")
      ) {
        tokensCss.push(
          `--${token}: light-dark(${pxToRem(per["light"])}, ${pxToRem(per["dark"])});`,
        )
      } else {
        const only = modesForToken[0]
        const val = per[only]
        tokensCss.push(`--${token}: ${pxToRem(val)};`)
      }
    }
  })

  Object.keys(lineTokensByName).forEach((token) => {
    const per = lineTokensByName[token]
    if (
      hasDeviceModes &&
      per[""] !== undefined &&
      (per.desktop !== undefined || per.mobile !== undefined)
    ) {
      const fallback = per[""]
      if (!per.desktop && !per.mobile) {
        per.desktop = fallback
        per.mobile = fallback
      } else if (!per.desktop && per.mobile) {
        per.desktop = fallback
      } else if (per.desktop && !per.mobile) {
        per.mobile = fallback
      }
      delete per[""]
    }

    const modesForToken = Object.keys(per)
    if (modesForToken.length === 1 && modesForToken[0] === "") {
      primitives[`--${token}`] = per[modesForToken[0]]
    } else {
      if (modesForToken.length === 1 && modesForToken[0] !== "") {
        const only = modesForToken[0]
        primitives[`--${token}`] = per[only]
        return
      }

      tokenLineHeight[`--${token}`] = { value: `var(--${token})`, modes: per }
      if (
        modesForToken.includes("mobile") &&
        modesForToken.includes("desktop")
      ) {
        tokensCss.push(
          `--${token}: ${clampBetweenModes(per["mobile"], per["desktop"])};`,
        )
      } else if (
        modesForToken.includes("light") &&
        modesForToken.includes("dark")
      ) {
        tokensCss.push(
          `--${token}: light-dark(${pxToRem(per["light"])}, ${pxToRem(per["dark"])})`,
        )
      } else {
        const only = modesForToken[0]
        const val = per[only]
        tokensCss.push(`--${token}: ${pxToRem(val)};`)
      }
    }
  })

  Object.keys(lineTokensByName).forEach((token) => {
    const per = lineTokensByName[token]
    const modes = Object.keys(per)
    if (modes.length === 1 && modes[0] === "") {
      primitives[`--${token}`] = per[""]
      if (tokenLineHeight[`--${token}`]) delete tokenLineHeight[`--${token}`]
      for (let i = tokensCss.length - 1; i >= 0; i--) {
        if (tokensCss[i].startsWith(`--${token}:`)) tokensCss.splice(i, 1)
      }
    }
  })

  Object.keys(fontTokensByName).forEach((token) => {
    const per = fontTokensByName[token]
    const modes = Object.keys(per)
    if (modes.length === 1 && modes[0] === "") {
      primitives[`--${token}`] = per[""]
      if (tokenFontSize[`--${token}`]) delete tokenFontSize[`--${token}`]
      for (let i = tokensCss.length - 1; i >= 0; i--) {
        if (tokensCss[i].startsWith(`--${token}:`)) tokensCss.splice(i, 1)
      }
    }
  })

  return {
    primitives,
    json: { fontSize: tokenFontSize, lineHeight: tokenLineHeight },
    css,
    tokensCss,
    warnings,
  }
}

// Build structured primitives object compatible with the CLI output
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
    if (!k.startsWith("--")) return
    if (k.startsWith("--color-")) {
      const name = k.replace(/^--color-/, "")
      out.color[name] = { $type: "color", value: v }
    } else if (k.startsWith("--spacing-")) {
      const raw = k.replace(/^--spacing-/, "")
      const name = `spacing-${raw}`
      out.spacing[name] = { $type: "number", value: pxToRem(v) }
    } else if (k.startsWith("--text-")) {
      const raw = k.replace(/^--text-/, "")
      const name = `text-${raw}`
      out.fontSize[name] = { $type: "number", value: pxToRem(v) }
    } else if (k.startsWith("--line-height-")) {
      const raw = k.replace(/^--line-height-/, "")
      const name = `line-height-${raw}`
      out.lineHeight[name] = { $type: "number", value: pxToRem(v) }
    } else if (k.startsWith("--radius-") || k.startsWith("--rounded-")) {
      const name = k.replace(/^--(radius|rounded)-/, "")
      out.rounded[`radius-${name}`] = { $type: "number", value: pxToRem(v) }
    } else if (k.startsWith("--z-") || k.startsWith("--font-weight-")) {
      // Keep z-index and font-weight primitives as raw numbers/strings (don't convert to rem)
      const name = k.replace(/^--/, "")
      out[name] = { $type: "number", value: String(v) }
    } else {
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

function normalizeTokens(
  rawColors,
  rawSpacing,
  rawFonts,
  primitivesFlat,
  structuredPrimitives,
) {
  const normalized = {
    colors: {},
    spacing: {},
    fonts: { fontSize: {}, lineHeight: {} },
  }

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

  Object.keys(rawSpacing || {}).forEach((k) => {
    const clean = k.replace(/^--/, "")
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

  function resolvePrimitiveForValue(
    val,
    prefix,
    tokenClean,
    mode,
    primitivesLookup,
  ) {
    const keys = Object.keys(primitivesLookup)
    if (mode) {
      let found = keys.find(
        (pk) =>
          pk.startsWith(prefix) &&
          (Number(primitivesLookup[pk]) === Number(val) ||
            String(primitivesLookup[pk]) === String(val)),
      )
      if (!found) {
        found = keys.find(
          (pk) =>
            Number(primitivesLookup[pk]) === Number(val) ||
            String(primitivesLookup[pk]) === String(val),
        )
      }
      if (found) {
        if (found.startsWith(prefix)) return `var(${found})`
        const numericPx = valueToPx(val)
        const valueBasedKey = `--${prefix.replace(/^--/, "").replace(/-$/, "")}-${numericPx}`
        if (primitivesLookup[valueBasedKey]) return `var(${valueBasedKey})`
        primitivesLookup[valueBasedKey] = numericPx
        const group = prefix.includes("line-height") ? "lineHeight" : "fontSize"
        structuredPrimitives[group][valueBasedKey.replace(/^--/, "")] = {
          $type: "number",
          value: pxToRem(numericPx),
        }
        return `var(${valueBasedKey})`
      }
      const numericPx = valueToPx(val)
      const valueBasedKey = `--${prefix.replace(/^--/, "").replace(/-$/, "")}-${numericPx}`
      if (primitivesLookup[valueBasedKey]) return `var(${valueBasedKey})`
      primitivesLookup[valueBasedKey] = numericPx
      const group = prefix.includes("line-height") ? "lineHeight" : "fontSize"
      structuredPrimitives[group][valueBasedKey.replace(/^--/, "")] = {
        $type: "number",
        value: pxToRem(numericPx),
      }
      return `var(${valueBasedKey})`
    }

    let found = keys.find(
      (pk) =>
        pk.startsWith(prefix) &&
        (Number(primitivesLookup[pk]) === Number(val) ||
          String(primitivesLookup[pk]) === String(val)),
    )
    if (!found) {
      found = keys.find(
        (pk) =>
          Number(primitivesLookup[pk]) === Number(val) ||
          String(primitivesLookup[pk]) === String(val),
      )
    }
    if (found) return `var(${found})`

    const suffix = mode ? `-${mode}` : ""
    const newPrimitiveKey = `--${tokenClean}${suffix}`
    if (!primitivesLookup[newPrimitiveKey]) {
      primitivesLookup[newPrimitiveKey] = Number(val)
      const group = prefix.includes("line-height") ? "lineHeight" : "fontSize"
      structuredPrimitives[group][newPrimitiveKey.replace(/^--/, "")] = {
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
        modes[m] = resolvePrimitiveForValue(
          v,
          "--text-",
          clean,
          m,
          primitivesFlat,
        )
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
        modes[m] = resolvePrimitiveForValue(
          v,
          "--line-height-",
          clean,
          m,
          primitivesFlat,
        )
      })
      out.modes = modes
    }
    normalized.fonts.lineHeight[clean] = out
  })

  return normalized
}

function applyGlobalFallbacksIfEmpty(entries, flatPrimitives) {
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

  if (!entries.length) {
    Object.keys(globalColorDefaults).forEach((name) => {
      if (!flatPrimitives[`--color-${name}`])
        flatPrimitives[`--color-${name}`] = globalColorDefaults[name]
    })
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
      if (!flatPrimitives[`--${k}`])
        flatPrimitives[`--${k}`] = spacingDefaults[k]
    })
    if (!flatPrimitives["--text-16"]) flatPrimitives["--text-16"] = 16
    if (!flatPrimitives["--text-14"]) flatPrimitives["--text-14"] = 14
    if (!flatPrimitives["--text-18"]) flatPrimitives["--text-18"] = 18
    if (!flatPrimitives["--font-base"])
      flatPrimitives["--font-base"] = "system-ui, sans-serif"
  }
}

// High level function: from File[] (upload) produce artifacts
async function processFiles(fileList, logger = console.log) {
  const entries = []
  for (const file of fileList) {
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const rawMode =
        (json && json.$extensions && json.$extensions["com.figma.modeName"]) ||
        json.mode ||
        null
      let modeName = null
      if (rawMode) {
        const lower = String(rawMode).toLowerCase()
        if (["light", "dark", "mobile", "desktop"].includes(lower))
          modeName = lower
      }
      entries.push({ fileName: file.name, json, modeName })
      logger(`Parsed ${file.name} (mode: ${modeName || "none"})`)
    } catch (err) {
      logger(`Erreur parsing ${file.name}: ${err.message}`)
    }
  }

  // Run extractors
  const colorResult = extractColors(entries)
  const spacingResult = extractSpacing(entries)
  const fontsResult = extractFonts(entries)

  // Detect whether Spacing / FontSize / Rounded were provided in source entries
  const hasSpacingSource = entries.some(
    ({ json }) => json.Spacing || json.spacing || json.spacings,
  )
  const hasRoundedSource = entries.some(
    ({ json }) => json.Rounded || json.rounded,
  )
  const hasFontSource = entries.some(
    ({ json }) => json.FontSize || json.fontSize || json.Font || json.font,
  )
  const hasLineHeightSource = entries.some(
    ({ json }) =>
      json.LineHeight ||
      json["Line-height"] ||
      json["lineheight"] ||
      json["line-height"] ||
      json.lineHeight ||
      json.lineheight,
  )

  // Merge flat primitives
  const allPrimitivesFlat = Object.assign(
    {},
    colorResult.primitivesJson || {},
    spacingResult.primitives || {},
    fontsResult.primitives || {},
  )

  // apply fallbacks
  applyGlobalFallbacksIfEmpty(entries, allPrimitivesFlat)

  const structuredPrimitives = buildStructuredPrimitives(allPrimitivesFlat)

  const normalizedTokens = normalizeTokens(
    colorResult.tokensJson,
    spacingResult.json,
    fontsResult.json,
    allPrimitivesFlat,
    structuredPrimitives,
  )

  // Build theme.css content following instructions.md
  const header = `/* ----------------------------------\n * Theme du projet\n * ---------------------------------- */\n`
  const breakpoints = `/* stylelint-disable */\n/* Custom Breakpoints */\n@custom-media --md (width >= 48rem);\n@custom-media --lg (width >= 64rem);\n@custom-media --xl (width >= 80rem);\n@custom-media --xxl (width >= 96rem);\n@custom-media --until-md (width < 48rem);\n@custom-media --until-lg (width < 64rem);\n@custom-media --until-xl (width < 80rem);\n@custom-media --until-xxl (width < 96rem);\n/* stylelint-enable */\n\n`

  const hasLight = colorResult.modes.includes("light")
  const hasDark = colorResult.modes.includes("dark")
  let colorSchemeProperty =
    '  /* Theme (color-scheme) */\n  color-scheme: light;\n\n  &[data-theme="light"] { color-scheme: light; }\n  &[data-theme="dark"] { color-scheme: dark; }\n\n'
  if (hasLight && hasDark) {
    colorSchemeProperty =
      '  /* Theme (color-scheme) */\n  color-scheme: light dark;\n\n  &[data-theme="light"] { color-scheme: light; }\n  &[data-theme="dark"] { color-scheme: dark; }\n\n'
  }

  // Validation logs (déclaré avant toute validation) — utilisé par les validations étape 1..n
  const validationLogs = []

  // Step 5 — s'assurer que les Couleurs Primitives CSS globales existent (insertion des fallback si manquantes)
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
  if (!structuredPrimitives.color) structuredPrimitives.color = {}
  const missingColors = []
  Object.keys(globalColorDefaults).forEach((name) => {
    if (!structuredPrimitives.color[name]) {
      structuredPrimitives.color[name] = {
        $type: "color",
        value: globalColorDefaults[name],
      }
      missingColors.push(name)
      validationLogs.push(
        `[validate] couleur primitive --color-${name} manquante — insertion du fallback.`,
      )
    }
  })
  if (missingColors.length === 0)
    validationLogs.push("[validate] Couleurs primitives globales: OK")

  // Assemble CSS body (strict order / comments per instructions.md)
  const parts = []
  parts.push(header)
  parts.push("\n")
  parts.push(breakpoints)
  parts.push(":root {\n\n")

  // Color-scheme property and selectors (first inside :root)
  parts.push(colorSchemeProperty)

  // Validation étape 3 : vérifier qu'il y a une ligne vide immédiatement après `:root {`
  ;(function validateRootSpacing() {
    const rootPattern = ":root {\n\n"
    // Vérifier à partir du contenu déjà assemblé dans `parts` pour éviter d'accéder à `themeCss` avant initialisation
    const soFar = parts.join("")
    if (soFar.indexOf(rootPattern) !== -1) {
      validationLogs.push("[validate] ligne vide après ':root {' : OK")
      return
    }
    // si non trouvé pour l'instant, on prévient et la validation post-assembly s'occupera de l'insertion
    validationLogs.push(
      "[validate] espace après ':root {' non confirmé maintenant — vérification post-assembly effectuée.",
    )
  })()

  // 5. Couleurs Primitives CSS globales (liste exhaustive — ordre précis)
  const globalColorOrder = [
    "white",
    "black",
    "gray-50",
    "gray-100",
    "gray-200",
    "gray-300",
    "gray-400",
    "gray-500",
    "gray-600",
    "gray-700",
    "gray-800",
    "gray-900",
    "error-100",
    "error-300",
    "error-500",
    "error-700",
    "error-900",
    "success-100",
    "success-300",
    "success-500",
    "success-700",
    "success-900",
    "warning-100",
    "warning-300",
    "warning-500",
    "warning-700",
    "warning-900",
    "info-100",
    "info-300",
    "info-500",
    "info-700",
    "info-900",
  ]

  parts.push("  /* Couleurs (globales) */\n")
  globalColorOrder.forEach((name) => {
    const entry = structuredPrimitives.color && structuredPrimitives.color[name]
    const value = entry ? entry.value : globalColorDefaults[name]
    parts.push(`  --color-${name}: ${value};\n`)
  })
  parts.push("\n")

  // 6. Couleurs Primitives du projet (primitives.json)
  const projectColors = (
    structuredPrimitives.color
      ? Object.keys(structuredPrimitives.color).filter(
          (k) => !globalColorOrder.includes(k),
        )
      : []
  ).sort()
  if (projectColors.length) {
    parts.push("  /* Couleurs (primitives du projet) */\n")
    projectColors.forEach((k) => {
      const v = structuredPrimitives.color[k].value
      parts.push(`  --color-${k}: ${v};\n`)
    })
    parts.push("\n")
    validationLogs.push(
      `[validate] Couleurs primitives du projet: ${projectColors.length} couleurs ajoutées.`,
    )
  } else {
    validationLogs.push(
      "[validate] Couleurs primitives du projet: aucune couleur projet détectée.",
    )
  }

  // Couleurs Tokens globales (primary, on-primary, accent, surface, on-surface, layers, interactions, selection, states, borders)
  parts.push("  /* Couleurs Tokens globales */\n")
  // Prefer any extracted token definitions when present (replace defaults)
  const globalTokenNames = [
    "primary",
    "on-primary",
    "primary-lighten",
    "primary-darken",
    "accent",
    "accent-invert",
    "surface",
    "on-surface",
    "layer-1",
    "layer-2",
    "layer-3",
    "link",
    "link-hover",
    "link-active",
    "selection",
    "warning",
    "error",
    "success",
    "info",
    "border-light",
    "border-medium",
  ]
  const tokensMap = new Map()
  ;(colorResult.tokensCss || []).forEach((line) => {
    const m = String(line).match(/^\s*--([a-z0-9\-]+)\s*:\s*(.+);?$/)
    if (m) tokensMap.set(m[1], m[0])
  })

  function pushOrDefault(name, def) {
    if (tokensMap.has(name)) parts.push(`  ${tokensMap.get(name)}\n`)
    else parts.push(`  ${def}\n`)
  }

  // Couleur primaire
  parts.push("  /* Couleur primaire */\n")
  pushOrDefault("primary", "--primary: var(--color-gray-500);")
  pushOrDefault("on-primary", "--on-primary: var(--color-white);")
  pushOrDefault(
    "primary-lighten",
    "--primary-lighten: oklch(from var(--primary) calc(l * 1.2) c h);",
  )
  pushOrDefault(
    "primary-darken",
    "--primary-darken: oklch(from var(--primary) calc(l * 0.8) c h);",
  )
  parts.push("\n")

  // Couleur d'accent
  parts.push("  /* Couleur d'accent */\n")
  pushOrDefault(
    "accent",
    "--accent: light-dark(var(--primary), var(--primary-lighten));",
  )
  pushOrDefault(
    "accent-invert",
    "--accent-invert: light-dark(var(--primary-lighten), var(--primary));",
  )
  parts.push("\n")

  // Surface
  parts.push("  /* Surface du document */\n")
  pushOrDefault(
    "surface",
    "--surface: light-dark(var(--color-white), var(--color-gray-900));",
  )
  pushOrDefault(
    "on-surface",
    "--on-surface: light-dark(var(--color-gray-900), var(--color-gray-100));",
  )
  parts.push("\n")

  // Niveaux de profondeur
  parts.push("  /* Niveaux de profondeur */\n")
  pushOrDefault(
    "layer-1",
    "--layer-1: light-dark(var(--color-gray-50), var(--color-gray-800));",
  )
  pushOrDefault(
    "layer-2",
    "--layer-2: light-dark(var(--color-gray-100), var(--color-gray-700));",
  )
  pushOrDefault(
    "layer-3",
    "--layer-3: light-dark(var(--color-gray-200), var(--color-gray-600));",
  )
  parts.push("\n")
  parts.push("  /* Interactions */\n")
  parts.push("  --link: light-dark(var(--primary), var(--primary-lighten));\n")
  parts.push(
    "  --link-hover: light-dark(var(--primary-darken), var(--primary));\n",
  )
  parts.push(
    "  --link-active: light-dark(var(--primary-darken), var(--primary));\n",
  )
  parts.push("\n")
  parts.push("  /* Couleur de sélection */\n")
  parts.push(
    "  --selection: light-dark(var(--primary-lighten), var(--primary-darken));\n",
  )
  parts.push("\n")
  parts.push("  /* États d'alerte */\n")
  parts.push(
    "  --warning: light-dark(var(--color-warning-500), var(--color-warning-300));\n",
  )
  parts.push(
    "  --error: light-dark(var(--color-error-500), var(--color-error-300));\n",
  )
  parts.push(
    "  --success: light-dark(var(--color-success-500), var(--color-success-300));\n",
  )
  parts.push(
    "  --info: light-dark(var(--color-info-500), var(--color-info-300));\n",
  )
  parts.push("\n")
  parts.push("  /* Bordures */\n")
  parts.push("  --border-light: var(--color-gray-400);\n")
  parts.push("  --border-medium: var(--color-gray-600);\n")
  parts.push("\n")

  // 8. Couleurs Tokens du projet (contenues dans tokens.json)
  const tokenLines = colorResult.tokensCss || []
  // Exceptions (tokens globaux à exclure des tokens projet)
  const exceptions = new Set([
    "primary",
    "on-primary",
    "primary-lighten",
    "primary-darken",
    "accent",
    "accent-invert",
    "surface",
    "on-surface",
    "layer-1",
    "layer-2",
    "layer-3",
    "link",
    "link-hover",
    "link-active",
    "selection",
    "warning",
    "error",
    "success",
    "info",
    "border-light",
    "border-medium",
  ])

  const projectTokenLines = tokenLines.filter((line) => {
    const m = String(line).match(/^\s*--([a-z0-9\-]+):/) // capture token name
    if (!m) return false
    const name = m[1]
    return !exceptions.has(name)
  })
  if (projectTokenLines.length) {
    parts.push("  /* Couleurs Tokens du projet */\n")
    projectTokenLines.sort().forEach((l) => parts.push(`  ${l}\n`))
    parts.push("\n")
    validationLogs.push(
      `[validate] Couleurs tokens du projet: ${projectTokenLines.length} tokens ajoutés.`,
    )
  } else {
    validationLogs.push(
      "[validate] Couleurs tokens du projet: aucun token projet détecté.",
    )
  }

  // Tokens css lines: group by colors, fonts, spacing for predictable order
  const colorTokenLines = colorResult.tokensCss || []
  const fontTokenLines = fontsResult.tokensCss || []
  const spacingTokenLines = spacingResult.css || []

  // Generate token lines (colors only here — fonts & spacing handled later)
  const globalTokenSet = new Set([
    "primary",
    "on-primary",
    "primary-lighten",
    "primary-darken",
    "accent",
    "accent-invert",
    "surface",
    "on-surface",
    "layer-1",
    "layer-2",
    "layer-3",
    "link",
    "link-hover",
    "link-active",
    "selection",
    "warning",
    "error",
    "success",
    "info",
    "border-light",
    "border-medium",
  ])
  const projectTokenSet = new Set(
    (projectTokenLines || [])
      .map((l) => {
        const m = String(l).match(/^\s*--([a-z0-9\-]+)\s*:/)
        return m ? m[1] : null
      })
      .filter(Boolean),
  )

  const generatedColorTokenLines = (colorTokenLines || []).filter((l) => {
    const m = String(l).match(/^\s*--([a-z0-9\-]+)\s*:/)
    if (!m) return true
    return !globalTokenSet.has(m[1]) && !projectTokenSet.has(m[1])
  })

  if (generatedColorTokenLines.length) {
    parts.push("  /* Tokens (générés) */\n")
    generatedColorTokenLines.forEach((l) => parts.push(`  ${l}\n`))
    parts.push("\n")
  }

  // 9. Autres Primitives CSS globales (injection des valeurs globales avec fallback)
  parts.push("  /* Autres Primitives globales */\n")
  const otherDefaults = {
    "--transition-duration": "250ms",
    "--z-under-page-level": "-1",
    "--z-above-page-level": "1",
    "--z-header-level": "1000",
    "--z-above-header-level": "2000",
    "--z-above-all-level": "3000",
    "--radius-none": "0",
    "--radius-4": "0.25rem",
    "--radius-8": "0.5rem",
    "--radius-12": "0.75rem",
    "--radius-16": "1rem",
    "--radius-24": "1.5rem",
    "--radius-full": "9999px",
    "--font-base": "system-ui, sans-serif",
    "--font-mono": "ui-monospace, monospace",
    "--font-weight-light": "300",
    "--font-weight-regular": "400",
    "--font-weight-semibold": "600",
    "--font-weight-bold": "700",
    "--font-weight-extrabold": "800",
    "--font-weight-black": "900",
  }

  function resolveOtherPrimitive(key) {
    const clean = key.replace(/^--/, "")
    let value = otherDefaults[key]

    if (structuredPrimitives[clean] && structuredPrimitives[clean].value)
      value = structuredPrimitives[clean].value
    else if (
      structuredPrimitives.rounded &&
      structuredPrimitives.rounded[clean] &&
      structuredPrimitives.rounded[clean].value
    )
      value = structuredPrimitives.rounded[clean].value
    else if (allPrimitivesFlat && allPrimitivesFlat[key])
      value = allPrimitivesFlat[key]

    if (value !== otherDefaults[key]) {
      validationLogs.push(
        `[validate] primitive ${key} remplacée par la source.`,
      )
    }
    return value
  }

  parts.push("  /* Transitions et animations */\n")
  parts.push(
    `  --transition-duration: ${resolveOtherPrimitive("--transition-duration")};\n`,
  )
  parts.push("\n")

  parts.push("  /* Niveaux de z-index */\n")
  ;[
    "--z-under-page-level",
    "--z-above-page-level",
    "--z-header-level",
    "--z-above-header-level",
    "--z-above-all-level",
  ].forEach((k) => {
    parts.push(`  ${k}: ${resolveOtherPrimitive(k)};\n`)
  })
  parts.push("\n")

  parts.push("  /* Border radius */\n")
  ;[
    "--radius-none",
    "--radius-4",
    "--radius-8",
    "--radius-12",
    "--radius-16",
    "--radius-24",
    "--radius-full",
  ].forEach((k) => {
    parts.push(`  ${k}: ${resolveOtherPrimitive(k)};\n`)
  })
  parts.push("\n")

  parts.push("  /* Familles de police */\n")
  ;["--font-base", "--font-mono"].forEach((k) => {
    parts.push(`  ${k}: ${resolveOtherPrimitive(k)};\n`)
  })
  parts.push("\n")

  parts.push("  /* Graisses de police */\n")
  ;[
    "--font-weight-light",
    "--font-weight-regular",
    "--font-weight-semibold",
    "--font-weight-bold",
    "--font-weight-extrabold",
    "--font-weight-black",
  ].forEach((k) => {
    parts.push(`  ${k}: ${resolveOtherPrimitive(k)};\n`)
  })
  parts.push("\n")

  // Espacements
  // Emit only if spacing primitives come from source OR when no source entries (global fallback case)
  if (
    structuredPrimitives.spacing &&
    (hasSpacingSource || entries.length === 0)
  ) {
    const spacingTitle = entries.length
      ? "  /* Espacements Primitives du projet */\n"
      : "  /* Espacements — valeurs globales (fallback) */\n"
    parts.push(spacingTitle)
    numericSortKeys(Object.keys(structuredPrimitives.spacing)).forEach((k) => {
      const v = structuredPrimitives.spacing[k].value
      const raw = k.replace(/^spacing-/, "")
      const px = resolvePxFromRef(v, structuredPrimitives)
      const pxComment = Number.isFinite(px) ? ` /* ${Math.round(px)}px */` : ""
      parts.push(`  --spacing-${raw}: ${v};${pxComment}\n`)
    })
    parts.push("\n")

    // Step 11: Espacements Tokens du projet (contenus dans tokens.json)
    const spacingTokens = normalizedTokens.spacing || {}
    const spacingTokenNames = Object.keys(spacingTokens)
    if (
      spacingTokenNames.length &&
      (hasSpacingSource || entries.length === 0)
    ) {
      parts.push("  /* Espacements Tokens du projet */\n")
      // Use helper to generate token lines
      const tokenLines = emitSpacingTokenLines(spacingTokens, structuredPrimitives)
      tokenLines.forEach((l) => parts.push(`  ${l}\n`))
      parts.push("\n")
    }
  }

  // Typographie
  // Emit only when font primitives come from source OR when no source entries (global fallback case)
  if (
    (structuredPrimitives.fontSize || structuredPrimitives.lineHeight) &&
    (hasFontSource || hasLineHeightSource || entries.length === 0)
  ) {
    parts.push("  /* Typographie */\n")
    numericSortKeys(Object.keys(structuredPrimitives.fontSize || {})).forEach(
      (k) => {
        const raw = k.replace(/^text-/, "")
        const v = structuredPrimitives.fontSize[k].value
        const px = resolvePxFromRef(v, structuredPrimitives)
        const pxComment = Number.isFinite(px)
          ? ` /* ${Math.round(px)}px */`
          : ""
        parts.push(`  --text-${raw}: ${v};${pxComment}\n`)
      },
    )

    if (structuredPrimitives.lineHeight) {
      numericSortKeys(Object.keys(structuredPrimitives.lineHeight)).forEach(
        (k) => {
          const raw = k.replace(/^line-height-/, "")
          const v = structuredPrimitives.lineHeight[k].value
          const px = resolvePxFromRef(v, structuredPrimitives)
          const pxComment = Number.isFinite(px)
            ? ` /* ${Math.round(px)}px */`
            : ""
          parts.push(`  --line-height-${raw}: ${v};${pxComment}\n`)
        },
      )
      parts.push("\n")
    } else {
      parts.push("\n")
    }

    // Step 13: Typographie Tokens du projet (préférer les lignes extraites, sinon utiliser normalized tokens)
    const typographyTokensLines = []
    const fontTokensNorm = (normalizedTokens.fonts && normalizedTokens.fonts.fontSize) || {}

    // prefer extractor-produced token lines (fontsResult.tokensCss), but recompute clean clamp if NaN or calc()
    ;(fontsResult.tokensCss || []).forEach((line) => {
      const l = (line || "").trim()
      const m = l.match(/^--([a-z0-9-]+):\s*(.+);/i)
      if (!m) {
        typographyTokensLines.push(l)
        return
      }
      const tokenName = m[1]
      if (l.includes("NaN") || l.includes("calc(")) {
        const norm = fontTokensNorm[`--${tokenName}`]
        if (norm && norm.modes && norm.modes.mobile && norm.modes.desktop) {
          typographyTokensLines.push(
            `--${tokenName}: ${computeFluidClamp(norm.modes.mobile, norm.modes.desktop, structuredPrimitives)};`,
          )
          return
        }
        typographyTokensLines.push(l)
        return
      }
      typographyTokensLines.push(l)
    })

    // Add normalized tokens that the extractor didn't emit
    numericSortKeys(Object.keys(fontTokensNorm)).forEach((name) => {
      const entry = fontTokensNorm[name]
      const tokenName = name.replace(/^--/, "")
      const present = typographyTokensLines.find((ln) =>
        (ln || "").includes(`--${tokenName}:`),
      )
      if (present) return
      if (entry.modes && entry.modes.mobile && entry.modes.desktop) {
        typographyTokensLines.push(
          `--${tokenName}: ${computeFluidClamp(entry.modes.mobile, entry.modes.desktop, structuredPrimitives)};`,
        )
      } else if (entry.value) {
        typographyTokensLines.push(`--${tokenName}: ${entry.value};`)
      }
    })



    if (typographyTokensLines.length) {
      parts.push("  /* Typographie Tokens du projet */\n")
      // Sort token lines by their token numeric suffix (when available) for consistent ascending order
      const sortedLines = typographyTokensLines.sort((a, b) => {
        const ma = (a || "").match(/^--([a-z0-9-]+)/i)
        const mb = (b || "").match(/^--([a-z0-9-]+)/i)
        const na = ma ? ma[1] : a
        const nb = mb ? mb[1] : b
        const va = _numericKeyValue(na)
        const vb = _numericKeyValue(nb)
        if (!Number.isNaN(va) && !Number.isNaN(vb)) return va - vb
        if (!Number.isNaN(va)) return -1
        if (!Number.isNaN(vb)) return 1
        return String(na).localeCompare(String(nb))
      })
      sortedLines.forEach((l) => {
        const m = (l || "").match(/^--([a-z0-9-]+):\s*(.+);/i)
        let comment = ""
        if (m) {
          const tokenName = `--${m[1]}`
          const entry = fontTokensNorm[tokenName]
          if (
            entry &&
            entry.modes &&
            entry.modes.mobile &&
            entry.modes.desktop
          ) {
            const mob = resolvePxFromRef(
              entry.modes.mobile,
              structuredPrimitives,
            )
            const desk = resolvePxFromRef(
              entry.modes.desktop,
              structuredPrimitives,
            )
            if (Number.isFinite(mob) && Number.isFinite(desk))
              comment = ` /* ${Math.round(mob)}px / ${Math.round(desk)}px */`
          } else {
            const val = m[2]
            const px = resolvePxFromRef(val, structuredPrimitives)
            if (Number.isFinite(px)) comment = ` /* ${Math.round(px)}px */`
          }
        }
        parts.push(`  ${l}${comment}\n`)
      })
      parts.push("\n")
    }

  // Close :root
  parts.push("}\n")

  let themeCss = parts.join("")

  // Validation étape 1 : vérifier la présence du header attendu et ligne vide suivante
  if (!themeCss.startsWith(header)) {
    // si absent ou modifié, préfixer le header standard et émettre un avertissement
    validationLogs.push(
      "[validate] header manquant ou malformé — header standard préfixé.",
    )
    // éviter double header si une variante est présente : enlever les éventuels commentaires similaires
    const cleaned = themeCss.replace(/^\s*(\/\*[-\s\S]*?\*\/\s*)?/, "")
    themeCss = header + "\n" + cleaned // assurer la ligne vide après header
  } else {
    validationLogs.push("[validate] header: OK")
    // vérifier qu'il y a exactement une ligne vide après le header (header se termine par \n)
    const nextChar = themeCss.charAt(header.length)
    if (nextChar !== "\n") {
      validationLogs.push(
        "[validate] ligne vide après header manquante — insertion d'une ligne vide.",
      )
      themeCss =
        themeCss.slice(0, header.length) + "\n" + themeCss.slice(header.length)
    } else {
      validationLogs.push("[validate] ligne vide après header: OK")
    }
  }

  // Validation étape 3 (post-assembly) : s'assurer de la ligne vide après `:root {`
  ;(function validateRootBlankLine() {
    const rootSeq = ":root {\n\n"
    if (themeCss.indexOf(rootSeq) !== -1) {
      validationLogs.push("[validate] ligne vide après ':root {' : OK")
      return
    }

    // Si on trouve ":root {\n" sans la ligne vide, insérer la ligne vide
    if (themeCss.indexOf(":root {\n") !== -1) {
      validationLogs.push(
        "[validate] ligne vide après ':root {' manquante — insertion d'une ligne vide.",
      )
      themeCss = themeCss.replace(":root {\n", ":root {\n\n")
      return
    }

    validationLogs.push(
      "[validate] :root { introuvable — aucune action effectuée.",
    )
  })()

  // Build theme.json using same logic as generateThemeJson.js but simpler: reuse available functions
  function buildThemeJson(primitivesStructured, tokensNormalized) {
    const theme = {
      $schema: "https://schemas.wp.org/wp/6.7/theme.json",
      version: 3,
      settings: {},
      styles: {},
    }
    // build palette
    const palette = []
    if (primitivesStructured.color) {
      Object.keys(primitivesStructured.color).forEach((k) => {
        const slug = k
        palette.push({ name: slug, color: `var(--color-${slug})`, slug })
      })
    }
    // add token colors
    if (tokensNormalized.colors) {
      Object.keys(tokensNormalized.colors).forEach((tk) => {
        const slug = tk
        const entry = tokensNormalized.colors[tk]
        const color = entry.modes
          ? entry.modes.light || entry.modes.dark || entry.value
          : entry.value
        palette.push({ name: slug, color, slug })
      })
    }

    // add defaults if missing (simple merge of defaultPalette used in generateThemeJson.js)
    const defaultPalette = [
      { name: "white", color: "var(--color-white)", slug: "white" },
      { name: "black", color: "var(--color-black)", slug: "black" },
    ]
    defaultPalette.forEach((d) => {
      if (!palette.find((p) => p.slug === d.slug)) palette.push(d)
    })

    theme.settings.color = { palette }

    // spacing
    const spacingSizes = []
    if (tokensNormalized.spacing) {
      Object.keys(tokensNormalized.spacing).forEach((s) => {
        spacingSizes.push({
          name: s,
          size: tokensNormalized.spacing[s].value,
          slug: s,
        })
      })
    }
    // fallback defaults
    theme.settings.spacing = {
      defaultSpacingSizes: false,
      spacingSizes,
      units: ["px", "rem", "%", "vh", "vw"],
    }

    // typography
    const fontSizes = []
    if (tokensNormalized.fonts && tokensNormalized.fonts.fontSize) {
      Object.keys(tokensNormalized.fonts.fontSize).forEach((fs) => {
        fontSizes.push({
          name: fs,
          size: tokensNormalized.fonts.fontSize[fs].value,
          slug: fs,
        })
      })
    }

    theme.settings.typography = {
      writingMode: true,
      defaultFontSizes: false,
      fluid: false,
      customFontSize: false,
      fontSizes,
      fontFamilies: [],
    }

    // default styles injection (simplified)
    theme.styles = {
      color: {
        background: "var:preset|color|surface",
        text: "var:preset|color|on-surface",
      },
      spacing: {
        blockGap: "var:preset|spacing|spacing-16",
        padding: {
          left: "var:preset|spacing|spacing-16",
          right: "var:preset|spacing|spacing-16",
        },
      },
      typography: {
        fontFamily: "var:preset|font-family|poppins",
        fontSize: "var:preset|font-size|text-m",
        fontWeight: "400",
        lineHeight: "1.2",
        fontStyle: "normal",
      },
    }

    return theme
  }

  const themeJson = buildThemeJson(structuredPrimitives, normalizedTokens)

  // Compose artifacts
  const artifacts = {
    "primitives.json": JSON.stringify(structuredPrimitives, null, 2),
    "tokens.json": JSON.stringify(normalizedTokens, null, 2),
    "theme.css": themeCss,
    "theme.json": JSON.stringify(themeJson, null, 2),
  }

  // Collect logs and warnings
  const logs = []
  logs.push(`Fichiers importés: ${entries.length}`)
  // ajouter les logs de validation (étape 1 .. ) en tête
  if (validationLogs && validationLogs.length)
    validationLogs.forEach((v) => logs.unshift(v))
  entries.forEach((e) =>
    logs.push(`- ${e.fileName} (mode: ${e.modeName || "none"})`),
  )
  if (colorResult.warnings && colorResult.warnings.length) {
    logs.push(`Warnings colors: ${colorResult.warnings.length}`)
    colorResult.warnings.forEach((w) => logs.push(JSON.stringify(w)))
  }
  if (fontsResult.warnings && fontsResult.warnings.length) {
    logs.push(`Warnings fonts: ${fontsResult.warnings.length}`)
    fontsResult.warnings.forEach((w) => logs.push(JSON.stringify(w)))
  }

  return { artifacts, logs }
}



