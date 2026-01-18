// Compact client utilities (spacing-focused)
// Export functions used by tests: processFiles, emitSpacingTokenLines

const spacingExtractor = require("../../scripts/extract/spacing")

function pxToRem(px) {
  if (px === undefined || px === null) return "0rem"
  if (typeof px === "string") {
    const s = px.trim()
    if (s.endsWith("rem")) return s
    if (s.endsWith("px"))
      return `${(parseFloat(s) / 16)
        .toFixed(3)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1")}rem`
    const n = Number(s)
    if (!isNaN(n))
      return `${(n / 16)
        .toFixed(3)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1")}rem`
    return s
  }
  const n = Number(px)
  if (isNaN(n)) return "0rem"
  return `${(n / 16)
    .toFixed(3)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1")}rem`
}

function valueToPx(val) {
  if (val === undefined || val === null) return NaN
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const s = val.trim()
    if (s.endsWith("px")) return parseFloat(s.replace(/px$/, ""))
    if (s.endsWith("rem")) return parseFloat(s.replace(/rem$/, "")) * 16
    const n = Number(s)
    if (!isNaN(n)) return n
  }
  return NaN
}

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

function resolvePxFromRef(ref, structuredPrimitivesParam) {
  if (ref === undefined || ref === null) return NaN
  if (typeof ref === "number") return Number(ref)
  if (typeof ref === "string") {
    const s = ref.trim()
    if (s.endsWith("px")) return parseFloat(s.replace(/px$/, ""))
    if (s.endsWith("rem")) return parseFloat(s.replace(/rem$/, "")) * 16
    const varMatch =
      s.match(/var\((--[a-z0-9-]+)\)/i) ||
      (s.startsWith("--") ? [null, s] : null)
    if (varMatch) {
      const vname = varMatch[1]
      if (!vname) return NaN
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
        )
          return valueToPx(structuredPrimitivesParam.spacing[key].value)
      }
    }
    return NaN
  }
  return NaN
}

function clampBetweenModes(mobileVarOrHex, desktopVarOrHex) {
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

function computeFluidClamp(mobileRef, desktopRef, structuredPrimitivesParam) {
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
          structuredPrimitivesParam &&
          structuredPrimitivesParam.spacing &&
          structuredPrimitivesParam.spacing[key]
        ) {
          return valueToPx(structuredPrimitivesParam.spacing[key].value)
        }
      }
    }
    return null
  }

  const mobPx = numericPxFromRef(mobileRef)
  const deskPx = numericPxFromRef(desktopRef)
  if (Number.isFinite(mobPx) && Number.isFinite(deskPx)) {
    const deltaPx = deskPx - mobPx
    const slopePxPerVw = (deltaPx * 100) / (1280 - 360)
    const interceptPx = mobPx - slopePxPerVw * (360 / 100)
    const interceptRem = Number((interceptPx / 16).toFixed(3))
    const slopeVwStr = Number(slopePxPerVw.toFixed(4))
    const middle = `${interceptRem}rem + ${slopeVwStr}vw`
    const left =
      typeof mobileRef === "string" && mobileRef.startsWith("var(")
        ? mobileRef
        : typeof mobileRef === "string" && mobileRef.startsWith("--")
          ? `var(${mobileRef})`
          : pxToRem(mobPx)
    const right =
      typeof desktopRef === "string" && desktopRef.startsWith("var(")
        ? desktopRef
        : typeof desktopRef === "string" && desktopRef.startsWith("--")
          ? `var(${desktopRef})`
          : pxToRem(deskPx)
    return `clamp(${left}, ${middle}, ${right})`
  }
  return clampBetweenModes(mobileRef, desktopRef)
}

function emitSpacingTokenLines(spacingTokensObj, structuredPrimitivesParam) {
  const out = []
  const names = numericSortKeys(Object.keys(spacingTokensObj || {}))
  names.forEach((k) => {
    const clean = k.replace(/^--/, "")
    const entry = spacingTokensObj[k]
    if (entry && entry.modes && entry.modes.mobile && entry.modes.desktop) {
      const line = computeFluidClamp(
        entry.modes.mobile,
        entry.modes.desktop,
        structuredPrimitivesParam,
      )
      const mob = resolvePxFromRef(
        entry.modes.mobile,
        structuredPrimitivesParam,
      )
      const desk = resolvePxFromRef(
        entry.modes.desktop,
        structuredPrimitivesParam,
      )
      const pxComment =
        Number.isFinite(mob) && Number.isFinite(desk)
          ? ` /* ${Math.round(mob)}px / ${Math.round(desk)}px */`
          : ""
      out.push(`--${clean}: ${line};${pxComment}`)
    } else if (entry && entry.value) {
      const px = resolvePxFromRef(entry.value, structuredPrimitivesParam)
      const pxComment = Number.isFinite(px) ? ` /* ${Math.round(px)}px */` : ""
      out.push(`--${clean}: ${entry.value};${pxComment}`)
    }
  })
  return out
}

async function processFiles(fileList) {
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
    } catch (err) {
      // ignore
    }
  }

  const spacingResult = spacingExtractor.extractSpacing(entries)

  const allPrimitivesFlat = Object.assign({}, spacingResult.primitives || {})

  // fallback defaults
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
  }

  // Build structured primitives (spacing only)
  const structured = { spacing: {} }
  Object.keys(allPrimitivesFlat).forEach((k) => {
    if (!k.startsWith("--spacing-")) return
    const raw = k.replace(/^--spacing-/, "")
    structured.spacing[`spacing-${raw}`] = {
      $type: "number",
      value: allPrimitivesFlat[k],
    }
  })

  // normalized tokens: spacingResult.json already provides tokens keyed by --spacing-*
  const normalized = { spacing: {} }
  Object.keys(spacingResult.json || {}).forEach((k) => {
    normalized.spacing[k.replace(/^--/, "")] = spacingResult.json[k]
  })

  const parts = []
  parts.push(
    "/* ----------------------------------\n * Theme du projet (minimal)\n * ---------------------------------- */\n\n",
  )
  parts.push(":root {\n\n")

  // Primitives
  if (structured.spacing && Object.keys(structured.spacing).length) {
    parts.push("  /* Espacements Primitives du projet */\n")
    numericSortKeys(Object.keys(structured.spacing)).forEach((k) => {
      const v = structured.spacing[k].value
      const raw = k.replace(/^spacing-/, "")
      const px = resolvePxFromRef(v, structured)
      const pxComment = Number.isFinite(px) ? ` /* ${Math.round(px)}px */` : ""
      parts.push(`  --spacing-${raw}: ${v};${pxComment}\n`)
    })
    parts.push("\n")
  }

  // Tokens
  const tokenObj = Object.fromEntries(
    Object.entries(normalized.spacing).map(([k, v]) => [`--${k}`, v]),
  )
  const tokenLines = emitSpacingTokenLines(tokenObj, structured)
  if (tokenLines.length) {
    parts.push("  /* Espacements Tokens du projet */\n")
    tokenLines.forEach((l) => parts.push(`  ${l}\n`))
    parts.push("\n")
  }

  parts.push("}\n")

  const themeCss = parts.join("")
  const artifacts = {
    "primitives.json": JSON.stringify(structured, null, 2),
    "tokens.json": JSON.stringify(normalized, null, 2),
    "theme.css": themeCss,
  }
  return { artifacts }
}

module.exports = { processFiles, emitSpacingTokenLines }
