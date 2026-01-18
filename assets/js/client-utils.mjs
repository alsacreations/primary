// ESM client utilities (spacing-focused)
// Exports: processFiles, emitSpacingTokenLines

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

function computeFluidClamp(
  mobileRef,
  desktopRef,
  structuredPrimitivesParam = null,
  preferredPrefix = null,
) {
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
        // If structured primitives map is provided, try to resolve the variable value
        if (
          structuredPrimitivesParam &&
          vname &&
          structuredPrimitivesParam[vname] !== undefined
        ) {
          return valueToPx(structuredPrimitivesParam[vname])
        }
        // otherwise fallthrough; cannot resolve
      }
      // If the ref is a plain identifier like "text-16" or numeric string, try to parse
      const n = Number(s)
      if (!isNaN(n)) return n
    }
    return null
  }

  function findPrimitiveVarForPx(px, structuredPrimitivesParamLocal, prefix) {
    if (!structuredPrimitivesParamLocal || !Number.isFinite(px)) return null
    // Prefer exact numeric match with conventional variable name like --<prefix>-<n>
    if (prefix && Number.isFinite(px)) {
      const rounded = Math.round(px)
      const candidate = `--${prefix}-${rounded}`
      if (structuredPrimitivesParamLocal[candidate]) return candidate
    }
    const eps = 0.5 // 0.5px tolerance
    const keys = Object.keys(structuredPrimitivesParamLocal)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (prefix && !key.startsWith(`--${prefix}`)) continue
      const val = structuredPrimitivesParamLocal[key]
      const valPx = valueToPx(val)
      if (Number.isFinite(valPx) && Math.abs(valPx - px) <= eps) return key
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

    // Prefer explicit primitive variables when they exist in structuredPrimitivesParam
    let left = null
    if (typeof mobileRef === "string" && mobileRef.startsWith("var(")) {
      left = mobileRef
    } else if (typeof mobileRef === "string" && mobileRef.startsWith("--")) {
      left = `var(${mobileRef})`
    } else {
      const found = findPrimitiveVarForPx(
        mobPx,
        structuredPrimitivesParam,
        preferredPrefix,
      )
      if (found) left = `var(${found})`
      else left = pxToRem(mobPx)
    }

    let right = null
    if (typeof desktopRef === "string" && desktopRef.startsWith("var(")) {
      right = desktopRef
    } else if (typeof desktopRef === "string" && desktopRef.startsWith("--")) {
      right = `var(${desktopRef})`
    } else {
      const found = findPrimitiveVarForPx(
        deskPx,
        structuredPrimitivesParam,
        preferredPrefix,
      )
      if (found) right = `var(${found})`
      else right = pxToRem(deskPx)
    }

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

// Inline extractor for spacing (simple adaptation of scripts/extract/spacing.js)
function extractSpacing(entries) {
  const spacing = {}
  entries.forEach(({ json }) => {
    const spacingSection = json.Spacing || json.spacing || json.spacings || null
    if (spacingSection) {
      Object.keys(spacingSection).forEach((k) => {
        const raw = spacingSection[k]
        const v = raw && (raw.$value ?? raw.value ?? raw)
        const name = k.startsWith("spacing-") ? `--${k}` : `--spacing-${k}`
        spacing[name] = v
      })
    }
    const roundedSection = json.Rounded || json.rounded || null
    if (roundedSection) {
      Object.keys(roundedSection).forEach((k) => {
        const raw = roundedSection[k]
        const v = raw && (raw.$value ?? raw.value ?? raw)
        const name = k.startsWith("radius-") ? `--${k}` : `--radius-${k}`
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

  const css = Object.keys(spacing)
    .sort()
    .map(
      (name) =>
        `${name}: ${pxToRem(spacing[name])}; /* ${String(spacing[name])} */`,
    )

  return { primitives, json: tokens, css }
}

// Inserted extractColors (ESM port)
function toCssVarName(parts) {
  return "--" + parts.join("-").replace(/\s+/g, "-").toLowerCase()
}

function aliasToVar(alias) {
  // Convert alias like "color/gray/100" to "--color-gray-100"
  return "--" + String(alias).replace(/[\/]/g, "-").toLowerCase()
}

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
    const colorRoot = json.color || json.colors
    if (colorRoot) {
      const flat = flattenColors(colorRoot)
      Object.assign(primitives, flat)
    }

    if (!modeName) return
    const mode = modeName.toLowerCase()
    modes.add(mode)

    if (json.color || json.colors)
      scanColorTokens(json.color || json.colors, [], mode)

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
      // Also support newer 'colors' key name produced by other tools
      if (
        val &&
        typeof val === "object" &&
        val.$type === undefined &&
        val.colors
      ) {
        scanColorTokens(val.colors, [...(prefix || []), key], mode)
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
        if (!v)
          tokensCss.push(`/* ${varName}: missing value for mode ${onlyMode} */`)
        else if (v.primitive) tokensCss.push(`${varName}: var(${v.primitive});`)
        else tokensCss.push(`${varName}: ${v.value};`)
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

// Main: processFiles
export async function processFiles(fileList, logger = console.log, opts = {}) {
  const entries = []
  const logs = []

  function emit(msg, level = "info") {
    // keep history (tests rely on logs being present)
    logs.push(msg)
    // Only surface logs to the provided logger when debug/verbose is enabled
    if (opts && (opts.debug || opts.verbose)) {
      try {
        logger(msg)
      } catch (e) {
        /* ignore */
      }
    }
  }

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
      const msg = `Parsed ${file.name} (mode: ${modeName || "none"})`
      emit(msg, "info")
    } catch (err) {
      const msg = `Erreur parsing ${file.name}: ${err.message}`
      emit(msg, "warn")
    }
  }

  const spacingResult = extractSpacing(entries)
  const colorResult = extractColors(entries)
  // Extract fonts (font-size and line-height)
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
        (json.fonts && json.fonts.fontSize) ||
        null
      if (!modeName) {
        if (fontSizeSection) {
          Object.keys(fontSizeSection).forEach((k) => {
            const v =
              fontSizeSection[k] &&
              (fontSizeSection[k].$value ??
                fontSizeSection[k].value ??
                fontSizeSection[k])
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
          (json.fonts && json.fonts.lineHeight) ||
          null
        if (lhSection) {
          Object.keys(lhSection).forEach((k) => {
            const v =
              lhSection[k] &&
              (lhSection[k].$value ?? lhSection[k].value ?? lhSection[k])
            const normalized = String(k)
              .replace(/^line-?height-?/i, "")
              .replace(/^lineheight-?/i, "")
            lineHeight[`--line-height-${normalized}`] = v
          })
        }
      } else {
        // do not add token-mode entries to primitives; tokens handled separately
      }
    })

    const css = []
    Object.keys(fontSize)
      .sort()
      .forEach((k) =>
        css.push(`${k}: ${pxToRem(fontSize[k])}; /* ${fontSize[k]}px */`),
      )
    Object.keys(lineHeight)
      .sort()
      .forEach((k) =>
        css.push(`${k}: ${pxToRem(lineHeight[k])}; /* ${lineHeight[k]}px */`),
      )

    // Build token-like json referencing primitives and cross-mode tokens
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
        (json.fonts && json.fonts.fontSize) ||
        null
      if (fontSection) {
        Object.keys(fontSection).forEach((k) => {
          const normalized = String(k).replace(/^text-/, "")
          const token = `text-${normalized}`
          fontTokensByName[token] = fontTokensByName[token] || {}
          const raw = fontSection[k]
          // If the token entry itself contains explicit modes (single combined file), merge them
          if (
            raw &&
            typeof raw === "object" &&
            (raw.modes || raw.mobile || raw.desktop)
          ) {
            const modesObj = raw.modes || {}
            if (raw.mobile !== undefined) modesObj.mobile = raw.mobile
            if (raw.desktop !== undefined) modesObj.desktop = raw.desktop
            Object.keys(modesObj).forEach((mn) => {
              fontTokensByName[token][mn] = modesObj[mn]
            })
          } else {
            fontTokensByName[token][mode] =
              raw && (raw.$value ?? raw.value ?? raw)
          }
        })
      }
      const lhSection =
        json.LineHeight ||
        json["Line-height"] ||
        json["lineheight"] ||
        json["line-height"] ||
        json.lineHeight ||
        json.lineheight ||
        (json.fonts && json.fonts.lineHeight) ||
        null
      if (lhSection) {
        Object.keys(lhSection).forEach((k) => {
          const normalized = String(k)
            .replace(/^line-?height-?/i, "")
            .replace(/^lineheight-?/i, "")
          const token = `line-height-${normalized}`
          lineTokensByName[token] = lineTokensByName[token] || {}
          const raw = lhSection[k]
          // If the token entry itself contains explicit modes (single combined file), merge them
          if (
            raw &&
            typeof raw === "object" &&
            (raw.modes || raw.mobile || raw.desktop)
          ) {
            const modesObj = raw.modes || {}
            if (raw.mobile !== undefined) modesObj.mobile = raw.mobile
            if (raw.desktop !== undefined) modesObj.desktop = raw.desktop
            Object.keys(modesObj).forEach((mn) => {
              lineTokensByName[token][mn] = modesObj[mn]
            })
          } else {
            lineTokensByName[token][mode] =
              raw && (raw.$value ?? raw.value ?? raw)
          }
        })
      }
    })

    const tokensCss = []
    const primitives = {}
    // expose the raw fontSize and lineHeight primitives so computeFluidClamp can find matching --text-* / --line-height-* variables
    Object.keys(fontSize).forEach((k) => {
      primitives[k] = fontSize[k]
    })
    Object.keys(lineHeight).forEach((k) => {
      primitives[k] = lineHeight[k]
    })
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
          // Single-mode token: keep as token and use available value as fallback; warn
          const only = modesForToken[0]
          if (only === "mobile") per.desktop = per.mobile
          else if (only === "desktop") per.mobile = per.desktop
          warnings.push({
            token: `--${token}`,
            type: "missing-mode-variant",
            message: `Token '--${token}' present only in mode '${only}'. Using available value as fallback.`,
          })
        }

        tokenFontSize[`--${token}`] = { value: `var(--${token})`, modes: per }
        if (
          modesForToken.includes("mobile") &&
          modesForToken.includes("desktop")
        ) {
          // If both modes resolve to the same primitive var or numeric value, do not emit a redundant clamp token
          const leftResolved = resolveModeToPrimitiveVar(per.mobile, "mobile")
          const rightResolved = resolveModeToPrimitiveVar(
            per.desktop,
            "desktop",
          )

          const extractVarName = (v) => {
            if (!v) return null
            if (typeof v === "string") {
              const m = v.match(/var\((--[^)]+)\)/)
              if (m) return m[1]
              if (v.startsWith("--")) return v
            }
            return null
          }

          const leftVar = extractVarName(leftResolved)
          const rightVar = extractVarName(rightResolved)

          // Case A: both resolve to same primitive var -> convert token into primitive alias
          if (leftVar && rightVar && leftVar === rightVar) {
            primitives[`--${token}`] = `var(${leftVar})`
            // remove token mapping and any emitted css for this token
            if (tokenFontSize[`--${token}`]) delete tokenFontSize[`--${token}`]
            for (let i = tokensCss.length - 1; i >= 0; i--) {
              if (tokensCss[i].startsWith(`--${token}:`)) tokensCss.splice(i, 1)
            }
            warnings.push({
              token: `--${token}`,
              type: "redundant-token",
              message: `Token '--${token}' has identical mobile and desktop primitive ${leftVar}; converting to primitive alias.`,
            })
          } else if (
            typeof per.mobile === "number" &&
            typeof per.desktop === "number" &&
            per.mobile === per.desktop
          ) {
            // Case B: both endpoints are the same numeric value -> emit primitive with rem value
            primitives[`--${token}`] = pxToRem(per.mobile)
            if (tokenFontSize[`--${token}`]) delete tokenFontSize[`--${token}`]
            for (let i = tokensCss.length - 1; i >= 0; i--) {
              if (tokensCss[i].startsWith(`--${token}:`)) tokensCss.splice(i, 1)
            }
            warnings.push({
              token: `--${token}`,
              type: "redundant-token-numeric",
              message: `Token '--${token}' has identical mobile and desktop numeric value ${per.mobile}px; converting to primitive.`,
            })
          } else {
            tokensCss.push(
              `--${token}: ${computeFluidClamp(per.mobile, per.desktop, primitives, "text")};`,
            )
          }
        } else if (
          modesForToken.includes("light") &&
          modesForToken.includes("dark")
        ) {
          tokensCss.push(
            `--${token}: light-dark(${pxToRem(per.light)}, ${pxToRem(per.dark)});`,
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
          // Single-mode token: keep as token and use available side as fallback; warn
          const only = modesForToken[0]
          if (only === "mobile") per.desktop = per.mobile
          else if (only === "desktop") per.mobile = per.desktop
          warnings.push({
            token: `--${token}`,
            type: "missing-mode-variant",
            message: `Token '--${token}' present only in mode '${only}'. Using available value as fallback.`,
          })
        }

        tokenLineHeight[`--${token}`] = { value: `var(--${token})`, modes: per }
        if (
          modesForToken.includes("mobile") &&
          modesForToken.includes("desktop")
        ) {
          // If both modes resolve to the same primitive var or numeric value, convert to primitive instead
          const leftResolved = resolveModeToPrimitiveVar(per.mobile, "mobile")
          const rightResolved = resolveModeToPrimitiveVar(
            per.desktop,
            "desktop",
          )

          const extractVarName = (v) => {
            if (!v) return null
            if (typeof v === "string") {
              const m = v.match(/var\((--[^)]+)\)/)
              if (m) return m[1]
              if (v.startsWith("--")) return v
            }
            return null
          }

          const leftVar = extractVarName(leftResolved)
          const rightVar = extractVarName(rightResolved)

          if (leftVar && rightVar && leftVar === rightVar) {
            primitives[`--${token}`] = `var(${leftVar})`
            // remove token mapping and any emitted css for this token
            if (tokenLineHeight[`--${token}`])
              delete tokenLineHeight[`--${token}`]
            for (let i = tokensCss.length - 1; i >= 0; i--) {
              if (tokensCss[i].startsWith(`--${token}:`)) tokensCss.splice(i, 1)
            }
            warnings.push({
              token: `--${token}`,
              type: "redundant-token",
              message: `Token '--${token}' has identical mobile and desktop primitive ${leftVar}; converting to primitive alias.`,
            })
          } else if (
            typeof per.mobile === "number" &&
            typeof per.desktop === "number" &&
            per.mobile === per.desktop
          ) {
            primitives[`--${token}`] = pxToRem(per.mobile)
            if (tokenLineHeight[`--${token}`])
              delete tokenLineHeight[`--${token}`]
            for (let i = tokensCss.length - 1; i >= 0; i--) {
              if (tokensCss[i].startsWith(`--${token}:`)) tokensCss.splice(i, 1)
            }
            warnings.push({
              token: `--${token}`,
              type: "redundant-token-numeric",
              message: `Token '--${token}' has identical mobile and desktop numeric value ${per.mobile}px; converting to primitive.`,
            })
          } else {
            tokensCss.push(
              `--${token}: ${computeFluidClamp(per.mobile, per.desktop, primitives, "line-height")};`,
            )
          }
        } else if (
          modesForToken.includes("light") &&
          modesForToken.includes("dark")
        ) {
          tokensCss.push(
            `--${token}: light-dark(${pxToRem(per.light)}, ${pxToRem(per.dark)});`,
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

  const fontResult = extractFonts(entries)
  // Surface font extraction warnings into logs for visibility
  ;(fontResult.warnings || []).forEach((w) => {
    emit(`WARN: fonts:${w.type}:${w.token || ""}:${w.message || ""}`, "warn")
  })

  // Collect all flat primitives: colors, spacing, fonts
  const allPrimitivesFlat = Object.assign(
    {},
    colorResult.primitives || {},
    spacingResult.primitives || {},
    fontResult.primitives || {},
  )

  // Extract other global primitives from source JSON (transitions, z-index, fonts, etc.)
  entries.forEach(({ json }) => {
    Object.keys(json || {}).forEach((k) => {
      if (
        k === "color" ||
        k === "Spacing" ||
        k === "spacing" ||
        k === "FontSize" ||
        k === "fontSize" ||
        k === "LineHeight" ||
        k === "lineHeight" ||
        k === "Rounded" ||
        k === "rounded"
      )
        return
      const val = json[k]
      if (!val) return
      const v = val.$value ?? val.value ?? val
      if (typeof v === "object") return
      // Normalize key to CSS var name
      const cssKey = k.startsWith("--") ? k : `--${k}`
      // Only add if not present (primitives extracted earlier win)
      if (!allPrimitivesFlat[cssKey]) allPrimitivesFlat[cssKey] = v
    })
  })

  // fallback primitives when no entries
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

    // default colors
    const globalColorDefaults = {
      "--color-white": "oklch(1 0 0)",
      "--color-black": "oklch(0 0 0)",
      "--color-gray-50": "oklch(0.97 0 0)",
      "--color-gray-100": "oklch(0.922 0 0)",
      "--color-gray-200": "oklch(0.87 0 0)",
      "--color-gray-300": "oklch(0.708 0 0)",
      "--color-gray-400": "oklch(0.556 0 0)",
      "--color-gray-500": "oklch(0.439 0 0)",
      "--color-gray-600": "oklch(0.371 0 0)",
      "--color-gray-700": "oklch(0.269 0 0)",
      "--color-gray-800": "oklch(0.205 0 0)",
      "--color-gray-900": "oklch(0.145 0 0)",
    }
    Object.keys(globalColorDefaults).forEach((k) => {
      if (!allPrimitivesFlat[k]) allPrimitivesFlat[k] = globalColorDefaults[k]
    })

    // Default font sizes
    const textDefaults = {
      "--text-14": "0.875rem",
      "--text-16": "1rem",
      "--text-18": "1.125rem",
      "--text-20": "1.25rem",
      "--text-24": "1.5rem",
      "--text-30": "1.875rem",
      "--text-48": "3rem",
    }
    Object.keys(textDefaults).forEach((k) => {
      if (!allPrimitivesFlat[k]) allPrimitivesFlat[k] = textDefaults[k]
    })

    // Default radii
    const radiusDefaults = {
      "--radius-none": "0",
      "--radius-4": "0.25rem",
      "--radius-8": "0.5rem",
      "--radius-12": "0.75rem",
      "--radius-16": "1rem",
      "--radius-24": "1.5rem",
      "--radius-full": "9999px",
    }
    Object.keys(radiusDefaults).forEach((k) => {
      if (!allPrimitivesFlat[k]) allPrimitivesFlat[k] = radiusDefaults[k]
    })

    // Default fonts
    const fontDefaults = {
      "--font-base": "system-ui, sans-serif",
      "--font-mono": "ui-monospace, monospace",
    }
    Object.keys(fontDefaults).forEach((k) => {
      if (!allPrimitivesFlat[k]) allPrimitivesFlat[k] = fontDefaults[k]
    })
  }

  const structured = {
    spacing: {},
    color: {},
    rounded: {},
    fontSize: {},
    lineHeight: {},
  }
  Object.keys(allPrimitivesFlat).forEach((k) => {
    if (k.startsWith("--spacing-")) {
      const raw = k.replace(/^--spacing-/, "")
      // Normalize primitive spacing values to rem for tokens/primitives output
      structured.spacing[`spacing-${raw}`] = {
        $type: "number",
        value: pxToRem(allPrimitivesFlat[k]),
      }
    } else if (k.startsWith("--color-")) {
      const raw = k.replace(/^--color-/, "")
      structured.color[raw] = { $type: "color", value: allPrimitivesFlat[k] }
    } else if (k.startsWith("--radius-") || k.startsWith("--rounded-")) {
      const raw = k.replace(/^--(radius|rounded)-/, "")
      structured.rounded[`radius-${raw}`] = {
        $type: "number",
        value: pxToRem(allPrimitivesFlat[k]),
      }
    } else if (k.startsWith("--text-")) {
      const raw = k.replace(/^--text-/, "")
      structured.fontSize[`text-${raw}`] = {
        $type: "number",
        value: pxToRem(allPrimitivesFlat[k]),
      }
    } else if (k.startsWith("--line-height-")) {
      const raw = k.replace(/^--line-height-/, "")
      structured.lineHeight[`line-height-${raw}`] = {
        $type: "number",
        value: pxToRem(allPrimitivesFlat[k]),
      }
    }
  })

  const normalized = { spacing: {}, fonts: { fontSize: {}, lineHeight: {} } }
  Object.keys(spacingResult.json || {}).forEach((k) => {
    // exclude rounded primitives from spacing tokens
    if (k.startsWith("--radius-") || k.startsWith("--rounded-")) return
    const entry = spacingResult.json[k]
    // Only include real tokens: entries that declare modes, or whose value is not a trivial self-reference
    if (!entry) return
    if (entry.modes) {
      normalized.spacing[k.replace(/^--/, "")] = entry
    } else if (entry.value && typeof entry.value === "string") {
      const selfRef = `var(${k})`
      if (entry.value.trim() !== selfRef)
        normalized.spacing[k.replace(/^--/, "")] = entry
    }
  })

  // normalized font tokens (if any)
  Object.keys((fontResult.json && fontResult.json.fontSize) || {}).forEach(
    (k) => {
      normalized.fonts.fontSize[k.replace(/^--/, "")] =
        fontResult.json.fontSize[k]
    },
  )
  Object.keys((fontResult.json && fontResult.json.lineHeight) || {}).forEach(
    (k) => {
      normalized.fonts.lineHeight[k.replace(/^--/, "")] =
        fontResult.json.lineHeight[k]
    },
  )

  // Create numeric alias primitives for token endpoints when tokens supply numeric mobile/desktop values
  // Ensures clamps reference `var(--<prefix>-<px>)` exactly as instructed
  function createNumericAliasesForTokens(normMap, prefix) {
    Object.keys(normMap || {}).forEach((k) => {
      const entry = normMap[k]
      if (!entry || !entry.modes) return
      ;["mobile", "desktop"].forEach((side) => {
        const v = entry.modes[side]
        const px =
          typeof v === "number"
            ? v
            : typeof v === "string" && /^\d+$/.test(v)
              ? Number(v)
              : null
        if (!Number.isFinite(px)) return
        const aliasVar = `--${prefix}-${Math.round(px)}`
        if (!allPrimitivesFlat[aliasVar]) {
          allPrimitivesFlat[aliasVar] = pxToRem(px)
          // also add to structured for downstream lookups
          if (prefix === "text") {
            structured.fontSize[`text-${Math.round(px)}`] = {
              $type: "number",
              value: pxToRem(px),
            }
          } else if (prefix === "line-height") {
            structured.lineHeight[`line-height-${Math.round(px)}`] = {
              $type: "number",
              value: pxToRem(px),
            }
          } else if (prefix === "spacing") {
            structured.spacing[`spacing-${Math.round(px)}`] = {
              $type: "number",
              value: pxToRem(px),
            }
          }
        }
      })
    })
  }

  // apply for font-size and line-height tokens
  createNumericAliasesForTokens(normalized.fonts.fontSize, "text")
  createNumericAliasesForTokens(normalized.fonts.lineHeight, "line-height")

  const parts = []
  parts.push(
    "/* ----------------------------------\n * Theme du projet\n * ---------------------------------- */\n\n",
  )

  parts.push(
    "/* stylelint-disable */\n/* Custom Breakpoints */\n@custom-media --md (width >= 48rem); /* 768px */\n@custom-media --lg (width >= 64rem); /* 1024px */\n@custom-media --xl (width >= 80rem); /* 1280px */\n@custom-media --xxl (width >= 96rem); /* 1536px */\n@custom-media --until-md (width < 48rem); /* < 768px */\n@custom-media --until-lg (width < 64rem); /* < 1024px */\n@custom-media --until-xl (width < 80rem); /* < 1280px */\n@custom-media --until-xxl (width < 96rem); /* < 1536px */\n/* stylelint-enable */\n\n",
  )

  parts.push(":root {\n\n")

  // Color-scheme (simple, support light/dark later)
  // Determine whether light/dark modes are present in input files
  const hasLightDarkModes = entries.some(({ modeName }) => {
    if (!modeName) return false
    const m = String(modeName).toLowerCase()
    return m === "light" || m === "dark"
  })

  if (hasLightDarkModes) {
    parts.push(
      '  /* Theme (color-scheme) */\n  color-scheme: light dark;\n\n  &[data-theme="light"] { color-scheme: light; }\n  &[data-theme="dark"] { color-scheme: dark; }\n\n',
    )
  } else {
    parts.push(
      '  /* Theme (color-scheme) */\n  color-scheme: light;\n\n  &[data-theme="light"] { color-scheme: light; }\n  &[data-theme="dark"] { color-scheme: dark; }\n\n',
    )
  }

  // Global color defaults and project colors
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

  parts.push("  /* Couleurs Primitives globales */\n")
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
  globalColorOrder.forEach((name) => {
    const entry = structured.color && structured.color[name]
    const value = entry ? entry.value : globalColorDefaults[name]
    parts.push(`  --color-${name}: ${value};\n`)
  })
  parts.push("\n")

  // Project color primitives
  function colorParts(key) {
    // parse trailing numeric variant, e.g. 'iris-50' -> { base: 'iris', num: 50 }
    const m = String(key).match(/^(.*?)-(\d+)$/)
    if (m) return { base: m[1], num: Number(m[2]) }
    const idx = String(key).lastIndexOf("-")
    if (idx !== -1) {
      const last = String(key).slice(idx + 1)
      if (/^\d+$/.test(last))
        return { base: String(key).slice(0, idx), num: Number(last) }
    }
    return { base: key, num: NaN }
  }

  const projectColors = structured.color
    ? Object.keys(structured.color)
        .filter((k) => !globalColorOrder.includes(k))
        .sort((a, b) => {
          const pa = colorParts(a)
          const pb = colorParts(b)
          if (pa.base !== pb.base) return pa.base.localeCompare(pb.base)
          const aNum = Number.isFinite(pa.num) ? pa.num : Infinity
          const bNum = Number.isFinite(pb.num) ? pb.num : Infinity
          if (aNum !== bNum) return aNum - bNum
          return a.localeCompare(b)
        })
    : []
  if (projectColors.length) {
    parts.push("  /* Couleurs Primitives du projet */\n")
    projectColors.forEach((k) => {
      const v = structured.color[k].value
      parts.push(`  --color-${k}: ${v};\n`)
    })
    parts.push("\n")
  }

  // Global tokens map (prefer extracted tokens when present)
  const tokensMap = new Map()
  ;(colorResult.tokensCss || []).forEach((line) => {
    const m = String(line).match(/^\s*--([a-z0-9\-]+)\s*:\s*(.+);?$/)
    if (m) tokensMap.set(m[1], m[0])
  })

  function pushOrDefault(name, def) {
    if (tokensMap.has(name)) parts.push(`  ${tokensMap.get(name)}\n`)
    else parts.push(`  ${def}\n`)
  }

  parts.push("  /* Couleurs Tokens globales */\n")
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
  pushOrDefault(
    "link",
    "--link: light-dark(var(--primary), var(--primary-lighten));",
  )
  pushOrDefault(
    "link-hover",
    "--link-hover: light-dark(var(--primary-darken), var(--primary));",
  )
  pushOrDefault(
    "link-active",
    "--link-active: light-dark(var(--primary-darken), var(--primary));",
  )
  parts.push("\n")
  parts.push("  /* Couleur de sélection */\n")
  pushOrDefault(
    "selection",
    "--selection: light-dark(var(--primary-lighten), var(--primary-darken));",
  )
  parts.push("\n")
  parts.push("  /* États d'alerte */\n")
  pushOrDefault(
    "warning",
    "--warning: light-dark(var(--color-warning-500), var(--color-warning-300));",
  )
  pushOrDefault(
    "error",
    "--error: light-dark(var(--color-error-500), var(--color-error-300));",
  )
  pushOrDefault(
    "success",
    "--success: light-dark(var(--color-success-500), var(--color-success-300));",
  )
  pushOrDefault(
    "info",
    "--info: light-dark(var(--color-info-500), var(--color-info-300));",
  )
  parts.push("\n")
  parts.push("  /* Bordures */\n")
  pushOrDefault("border-light", "--border-light: var(--color-gray-400);")
  pushOrDefault("border-medium", "--border-medium: var(--color-gray-600);")
  parts.push("\n")

  // Project color tokens (exclude global tokens)
  const colorTokenLines = colorResult.tokensCss || []
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
  const projectTokenLines = colorTokenLines.filter((line) => {
    const m = String(line).match(/^\s*--([a-z0-9\-]+):/)
    if (!m) return false
    const name = m[1]
    return !exceptions.has(name)
  })
  if (projectTokenLines.length) {
    parts.push("  /* Couleurs Tokens du projet */\n")
    projectTokenLines.sort().forEach((l) => parts.push(`  ${l}\n`))
    parts.push("\n")
  }

  // Autres Primitives globales (transitions, z-index, radii, fonts)
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
    if (
      structured.rounded &&
      structured.rounded[clean] &&
      structured.rounded[clean].value
    )
      return structured.rounded[clean].value
    if (allPrimitivesFlat && allPrimitivesFlat[key])
      return allPrimitivesFlat[key]
    return otherDefaults[key]
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
  ].forEach((k) => parts.push(`  ${k}: ${resolveOtherPrimitive(k)};\n`))
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
  ].forEach((k) => parts.push(`  ${k}: ${resolveOtherPrimitive(k)};\n`))
  parts.push("\n")

  parts.push("  /* Familles de police */\n")
  ;["--font-base", "--font-mono"].forEach((k) =>
    parts.push(`  ${k}: ${resolveOtherPrimitive(k)};\n`),
  )
  parts.push("\n")

  parts.push("  /* Graisses de police */\n")
  ;[
    "--font-weight-light",
    "--font-weight-regular",
    "--font-weight-semibold",
    "--font-weight-bold",
    "--font-weight-extrabold",
    "--font-weight-black",
  ].forEach((k) => parts.push(`  ${k}: ${resolveOtherPrimitive(k)};\n`))
  parts.push("\n")

  // Espacements Primitives
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

  // Build token object only from actual tokens (entries that declare modes)
  const tokenObj = Object.fromEntries(
    Object.entries(normalized.spacing)
      .filter(([k, v]) => {
        if (!v) return false
        // Include only if modes are present (mobile/desktop or light/dark)
        if (v.modes) return true
        // If a single value is present, skip if it only references the same primitive (avoid duplicate primitive-as-token)
        if (v.value && typeof v.value === "string") {
          const samePrimitiveVar = `var(--spacing-${k})`
          return v.value.trim() !== samePrimitiveVar
        }
        return false
      })
      .map(([k, v]) => [`--${k}`, v]),
  )
  const tokenLines = emitSpacingTokenLines(tokenObj, structured)
  if (tokenLines.length) {
    parts.push("  /* Espacements Tokens du projet */\n")
    tokenLines.forEach((l) => parts.push(`  ${l}\n`))
    parts.push("\n")
  }

  // Typographie primitives
  if (
    (structured.fontSize && Object.keys(structured.fontSize).length) ||
    (structured.lineHeight && Object.keys(structured.lineHeight).length)
  ) {
    parts.push("  /* Typographie Primitives du projet */\n")
    // font sizes
    if (structured.fontSize && Object.keys(structured.fontSize).length) {
      numericSortKeys(Object.keys(structured.fontSize)).forEach((k) => {
        const v = structured.fontSize[k].value
        const raw = k.replace(/^text-/, "")
        const px =
          typeof v === "string" && v.endsWith("rem")
            ? parseFloat(v.replace(/rem$/, "")) * 16
            : NaN
        const pxComment = Number.isFinite(px)
          ? ` /* ${Math.round(px)}px */`
          : ""
        parts.push(`  --text-${raw}: ${v};${pxComment}\n`)
      })
    }
    // line heights
    if (structured.lineHeight && Object.keys(structured.lineHeight).length) {
      numericSortKeys(Object.keys(structured.lineHeight)).forEach((k) => {
        const v = structured.lineHeight[k].value
        const raw = k.replace(/^line-height-/, "")
        const px =
          typeof v === "string" && v.endsWith("rem")
            ? parseFloat(v.replace(/rem$/, "")) * 16
            : NaN
        const pxComment = Number.isFinite(px)
          ? ` /* ${Math.round(px)}px */`
          : ""
        parts.push(`  --line-height-${raw}: ${v};${pxComment}\n`)
      })
    }
    parts.push("\n")
  }

  // Typographie Tokens du projet
  const typographyTokensLines = []

  function findExtractorTokenLine(name) {
    const found = (fontResult.tokensCss || []).find((ln) => {
      const m = (ln || "").trim().match(/^--([a-z0-9-]+):\s*(.+);/i)
      return m && m[1] === name
    })
    return found
  }

  // Helper to resolve references to underlying primitive vars when possible
  function resolveModeToPrimitiveVar(modeVal, side) {
    // side is 'mobile' or 'desktop'
    if (!modeVal || typeof modeVal !== "string") return modeVal
    // strip possible var(...) wrapper
    const vm = modeVal.match(/var\(--([^)]+)\)/)
    const plain = modeVal.startsWith("--") ? modeVal : vm ? `--${vm[1]}` : null

    // direct primitive available
    if (plain && allPrimitivesFlat && allPrimitivesFlat[plain]) return plain

    // if this is a token reference, try to dereference from normalized fonts
    const tokenName = vm ? vm[1] : plain ? plain.replace(/^--/, "") : null
    if (tokenName) {
      const tokenEntry =
        (normalized.fonts &&
          normalized.fonts.fontSize &&
          normalized.fonts.fontSize[tokenName]) ||
        (normalized.fonts &&
          normalized.fonts.lineHeight &&
          normalized.fonts.lineHeight[tokenName]) ||
        null
      if (tokenEntry && tokenEntry.modes) {
        // prefer the same side if present
        if (tokenEntry.modes[side]) return tokenEntry.modes[side]
        // else prefer mobile then desktop
        if (tokenEntry.modes.mobile) return tokenEntry.modes.mobile
        if (tokenEntry.modes.desktop) return tokenEntry.modes.desktop
      }
    }

    return modeVal
  }

  // Include extractor lines first, with fallbacks
  ;(fontResult.tokensCss || []).forEach((line) => {
    const l = (line || "").trim()
    const m = l.match(/^--([a-z0-9-]+):\s*(.+);/i)
    if (!m) {
      typographyTokensLines.push(l)
      return
    }
    const tokenName = m[1]
    if (l.includes("NaN") || l.includes("calc(")) {
      const norm =
        (normalized.fonts &&
          (normalized.fonts.fontSize || {})[`--${tokenName}`]) ||
        (normalized.fonts &&
          (normalized.fonts.lineHeight || {})[`--${tokenName}`])
      if (norm && norm.modes && norm.modes.mobile && norm.modes.desktop) {
        const left = resolveModeToPrimitiveVar(norm.modes.mobile, "mobile")
        const right = resolveModeToPrimitiveVar(norm.modes.desktop, "desktop")
        typographyTokensLines.push(
          `--${tokenName}: ${computeFluidClamp(left, right, allPrimitivesFlat)};`,
        )
        return
      }
      typographyTokensLines.push(l)
      return
    }
    typographyTokensLines.push(l)
  })

  const fontTokensNorm = (normalized.fonts && normalized.fonts.fontSize) || {}
  const lineTokensNorm = (normalized.fonts && normalized.fonts.lineHeight) || {}

  Object.keys(fontTokensNorm)
    .sort()
    .forEach((k) => {
      const name = k.replace(/^--/, "")
      if (findExtractorTokenLine(name)) return
      const entry = fontTokensNorm[k]
      if (entry.modes && entry.modes.mobile && entry.modes.desktop) {
        const left = resolveModeToPrimitiveVar(entry.modes.mobile, "mobile")
        const right = resolveModeToPrimitiveVar(entry.modes.desktop, "desktop")
        typographyTokensLines.push(
          `--${name}: ${computeFluidClamp(left, right, allPrimitivesFlat)};`,
        )
      } else if (entry.modes && entry.modes.light && entry.modes.dark) {
        typographyTokensLines.push(
          `--${name}: light-dark(${entry.modes.light}, ${entry.modes.dark});`,
        )
      } else if (entry.value) {
        typographyTokensLines.push(`--${name}: ${entry.value};`)
      }
    })

  Object.keys(lineTokensNorm)
    .sort()
    .forEach((k) => {
      const name = k.replace(/^--/, "")
      if (findExtractorTokenLine(name)) return
      const entry = lineTokensNorm[k]
      if (entry.modes && entry.modes.mobile && entry.modes.desktop) {
        const left = resolveModeToPrimitiveVar(entry.modes.mobile, "mobile")
        const right = resolveModeToPrimitiveVar(entry.modes.desktop, "desktop")
        typographyTokensLines.push(
          `--${name}: ${computeFluidClamp(left, right, allPrimitivesFlat)};`,
        )
      } else if (entry.modes && entry.modes.light && entry.modes.dark) {
        typographyTokensLines.push(
          `--${name}: light-dark(${entry.modes.light}, ${entry.modes.dark});`,
        )
      } else if (entry.value) {
        typographyTokensLines.push(`--${name}: ${entry.value};`)
      }
    })

  // Deduplicate & prefer clean clamps
  const tokenLineMap = {}
  typographyTokensLines.forEach((l) => {
    const m = (l || "").trim().match(/^--([a-z0-9-]+):\s*(.+);/i)
    if (!m) return
    const name = m[1]
    const val = m[2]
    if (val.includes("NaN")) return
    const existing = tokenLineMap[name]
    if (!existing) {
      tokenLineMap[name] = l.trim()
      return
    }
    const isPreferred = /var\(/.test(val) && /rem\s*\+\s*[0-9.]+vw/.test(val)
    const existingPreferred =
      /var\(/.test(existing) && /rem\s*\+\s*[0-9.]+vw/.test(existing)
    if (isPreferred && !existingPreferred) tokenLineMap[name] = l.trim()
  })

  // Ensure normalized mobile/desktop override with clean computeFluidClamp
  Object.keys(fontTokensNorm).forEach((k) => {
    const name = k.replace(/^--/, "")
    const entry = fontTokensNorm[k]
    if (entry && entry.modes && entry.modes.mobile && entry.modes.desktop) {
      const left = resolveModeToPrimitiveVar(entry.modes.mobile, "mobile")
      const right = resolveModeToPrimitiveVar(entry.modes.desktop, "desktop")
      tokenLineMap[name] =
        `--${name}: ${computeFluidClamp(left, right, allPrimitivesFlat, "text")};`
    }
  })
  Object.keys(lineTokensNorm).forEach((k) => {
    const name = k.replace(/^--/, "")
    const entry = lineTokensNorm[k]
    if (entry && entry.modes && entry.modes.mobile && entry.modes.desktop) {
      const left = resolveModeToPrimitiveVar(entry.modes.mobile, "mobile")
      const right = resolveModeToPrimitiveVar(entry.modes.desktop, "desktop")
      tokenLineMap[name] =
        `--${name}: ${computeFluidClamp(left, right, allPrimitivesFlat, "line-height")};`
    }
  })

  // Sort tokens by numeric anchor (left primitive rem)
  const tokenObjects = Object.keys(tokenLineMap).map((n) => {
    const line = tokenLineMap[n]

    // Prefer normalized token mobile value for anchor when available (most reliable)
    let anchorRem = NaN
    if (normalized && normalized.fonts) {
      const ln = normalized.fonts.lineHeight || {}
      const fn = normalized.fonts.fontSize || {}
      const tokenEntry = ln[n] || fn[n]
      if (
        tokenEntry &&
        tokenEntry.modes &&
        Number.isFinite(tokenEntry.modes.mobile)
      ) {
        anchorRem = tokenEntry.modes.mobile / 16
      }
    }

    // Fallback: parse first var(...) in clamp() to determine numeric px
    if (Number.isNaN(anchorRem)) {
      const m = line.match(/clamp\(\s*(?:var\((--[^)]+)\)|(--[a-z0-9-]+))/i)
      if (m) {
        const varRef = m[1] || m[2]
        if (varRef) {
          const px = (function numericPxFromRef(ref) {
            if (!ref) return null
            if (typeof ref === "number") return Number(ref)
            if (typeof ref === "string") {
              const s = ref.trim()
              if (s.endsWith("px")) return parseFloat(s.replace(/px$/, ""))
              if (s.endsWith("rem"))
                return parseFloat(s.replace(/rem$/, "")) * 16
              const varMatch =
                s.match(/var\((--[^)]+)\)/) ||
                (s.startsWith("--") ? [null, s] : null)
              if (varMatch) {
                const vname = varMatch[1]
                const key = vname.replace(/^--/, "")

                // 1. Try direct primitives
                if (structured.fontSize && structured.fontSize[key])
                  return (
                    parseFloat(
                      structured.fontSize[key].value.replace(/rem$/, ""),
                    ) * 16
                  )
                if (structured.lineHeight && structured.lineHeight[key])
                  return (
                    parseFloat(
                      structured.lineHeight[key].value.replace(/rem$/, ""),
                    ) * 16
                  )
                if (structured.spacing && structured.spacing[key])
                  return (
                    parseFloat(
                      structured.spacing[key].value.replace(/rem$/, ""),
                    ) * 16
                  )

                // 2. Fallback: if this var is actually a token, try to dereference the token
                //    into its mobile/desktop primitive and recurse
                const tokenKey = key // e.g. 'line-height-s' or 'text-m'
                if (normalized && normalized.fonts) {
                  const fn = normalized.fonts.fontSize || {}
                  const ln = normalized.fonts.lineHeight || {}
                  const tokenEntry = fn[tokenKey] || ln[tokenKey]
                  if (tokenEntry && tokenEntry.modes) {
                    // prefer mobile side for anchor, else desktop
                    const candidate =
                      tokenEntry.modes.mobile || tokenEntry.modes.desktop
                    if (candidate) return numericPxFromRef(candidate)
                  }
                }
              }
            }
            return null
          })(varRef)
          if (px !== null && !Number.isNaN(px)) anchorRem = px / 16
        }
      }

      // One more fallback: if anchor still NaN, attempt to use normalized token numeric directly
      if (Number.isNaN(anchorRem) && normalized && normalized.fonts) {
        const ln = normalized.fonts.lineHeight || {}
        const tokenEntry = ln[n]
        if (
          tokenEntry &&
          tokenEntry.modes &&
          Number.isFinite(tokenEntry.modes.mobile)
        ) {
          anchorRem = tokenEntry.modes.mobile / 16
        }
      }
    }

    // Diagnostic: per-token details
    try {
      const m2 = line.match(/clamp\(\s*(?:var\((--[^)]+)\)|(--[a-z0-9-]+))/i)
      const captured = m2 ? m2[1] || m2[2] : ""
      const normMobile =
        normalized &&
        normalized.fonts &&
        normalized.fonts.lineHeight &&
        normalized.fonts.lineHeight[n] &&
        normalized.fonts.lineHeight[n].modes
          ? normalized.fonts.lineHeight[n].modes.mobile
          : null
      if (opts && opts.debug) {
        logs.push(
          `DEBUG: token-anchor-detail:${n}|captured=${captured}|normMobile=${normMobile}|anchorRem=${Number.isNaN(anchorRem) ? "NaN" : anchorRem.toFixed(3)}`,
        )
      }
    } catch (e) {
      /* ignore */
    }

    return { name: n, line, anchorRem }
  })

  // Diagnostic: publish anchor values for debugging
  if (opts && opts.debug) {
    logs.push(
      `DEBUG: token-order-anchor:${Object.values(tokenObjects)
        .filter((o) => /^line-height-/.test(o.name))
        .map(
          (o) =>
            `${o.name}=${Number.isNaN(o.anchorRem) ? "NaN" : o.anchorRem.toFixed(3)}`,
        )
        .join(",")}`,
    )
  }

  tokenObjects.sort((a, b) => {
    const ax = Number.isNaN(a.anchorRem) ? Infinity : a.anchorRem
    const bx = Number.isNaN(b.anchorRem) ? Infinity : b.anchorRem
    if (ax !== bx) return ax - bx
    return a.name.localeCompare(b.name)
  })

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

  // Diagnostic logs for ordering (useful for debugging preview vs generated file mismatches)
  if (opts && opts.debug) {
    logs.push(
      `DEBUG: token-order:text:${textTokenObjs.map((o) => o.name).join(",")}`,
    )
    logs.push(
      `DEBUG: token-order:line-height:${lhTokenObjs.map((o) => o.name).join(",")}`,
    )
  }

  const dedupedTypographyTokensLines = [
    ...textTokenObjs.map((o) => o.line),
    ...lhTokenObjs.map((o) => o.line),
  ]

  if (dedupedTypographyTokensLines.length) {
    parts.push("  /* Typographie Tokens du projet */\n")
    dedupedTypographyTokensLines.forEach((l) => parts.push(`  ${l}\n`))
    parts.push("\n")
  }

  parts.push("}\n")

  const themeCss = parts.join("")
  const primitivesJsonStr = JSON.stringify(structured, null, 2)
  const tokensJsonStr = JSON.stringify(Object.assign({ colors: colorResult.tokensJson || {} }, normalized), null, 2)

  // generate a minimal theme.json compatible structure (client-side)
  function generateThemeJson(primitivesJsonStrLocal, tokensJsonStrLocal) {
    let primitives = {}
    let tokens = {}
    try {
      primitives = JSON.parse(primitivesJsonStrLocal)
    } catch (e) {}
    try {
      tokens = JSON.parse(tokensJsonStrLocal)
    } catch (e) {}

    const theme = {
      $schema: "https://schemas.wp.org/wp/6.7/theme.json",
      version: 3,
      settings: {},
      styles: {},
    }

    // Build palette: prefer tokens.colors then primitives.color, fallback to defaults
    const palette = []
    const seen = new Set()
    if (primitives && primitives.color) {
      Object.keys(primitives.color).forEach((k) => {
        palette.push({ name: k, color: `var(--color-${k})`, slug: k })
        seen.add(k)
      })
    }
    if (tokens && tokens.colors) {
      Object.keys(tokens.colors).forEach((tk) => {
        if (!seen.has(tk)) {
          const val = tokens.colors[tk].value || `var(--${tk})`
          palette.push({ name: tk, color: val, slug: tk })
          seen.add(tk)
        }
      })
    }
    // simple defaults for missing common colors
    ;["white", "black", "gray-500"].forEach((slug) => {
      if (!seen.has(slug)) {
        const name = slug
        const color = slug === "white" ? "var(--color-white)" : slug === "black" ? "var(--color-black)" : "var(--color-gray-500)"
        palette.push({ name, color, slug })
        seen.add(slug)
      }
    })

    theme.settings.color = { palette }

    // spacing
    const spacingSizes = []
    if (tokens && tokens.spacing) {
      Object.keys(tokens.spacing).forEach((k) => {
        spacingSizes.push({ name: k, size: tokens.spacing[k].value || `var(--${k})`, slug: k })
      })
    }
    // fallback common spacings from primitives
    ;["spacing-16", "spacing-24", "spacing-32"].forEach((s) => {
      if (!spacingSizes.find((x) => x.slug === s)) spacingSizes.push({ name: s, size: `var(--${s})`, slug: s })
    })
    theme.settings.spacing = { spacingSizes }

    // typography sizes
    const fontSizes = []
    if (tokens && tokens.fonts && tokens.fonts.fontSize) {
      Object.keys(tokens.fonts.fontSize).forEach((k) => {
        fontSizes.push({ name: k, size: tokens.fonts.fontSize[k].value || `var(--${k})`, slug: k })
      })
    }
    ;["text-16", "text-24", "text-30"].forEach((s) => {
      if (!fontSizes.find((x) => x.slug === s)) fontSizes.push({ name: s, size: `var(--${s})`, slug: s })
    })
    theme.settings.typography = { fontSizes }

    // inject some sensible defaults for styles
    theme.settings = theme.settings || {}
    theme.settings.layout = { contentSize: "48rem", wideSize: "80rem" }
    theme.styles = theme.styles || {}
    theme.styles.typography = { fontFamily: "var(--font-base)", fontWeight: "var(--font-weight-regular)" }

    return JSON.stringify(theme, null, 2)
  }

  const artifacts = {
    "primitives.json": primitivesJsonStr,
    "tokens.json": tokensJsonStr,
    "theme.css": themeCss,
    "theme.json": generateThemeJson(primitivesJsonStr, tokensJsonStr),
  }
  return { artifacts, logs }
}

export { emitSpacingTokenLines }
