// Mise en forme finale de theme.css, partagée par l'interface web
// (client-utils.mjs) et la CLI (scripts/figmatocss.js) pour que les deux
// chemins produisent un fichier identique, conforme à la configuration
// Prettier et Stylelint fournie dans config_files/.

const PRINT_WIDTH = 80

// Découpe les arguments d'une fonction CSS aux virgules de premier niveau
function splitTopLevelArgs(str) {
  const args = []
  let depth = 0
  let start = 0
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (c === "(") depth++
    else if (c === ")") depth--
    else if (c === "," && depth === 0) {
      args.push(str.slice(start, i).trim())
      start = i + 1
    }
  }
  args.push(str.slice(start).trim())
  return args
}

// Repère une valeur de la forme `nom(arguments)` dont la parenthèse ouvrante
// se ferme en toute fin de chaîne ; renvoie null sinon
function parseFunctionCall(value) {
  const m = value.match(/^([a-z-]+)\(/i)
  if (!m || !value.endsWith(")")) return null
  let depth = 0
  for (let i = m[0].length - 1; i < value.length; i++) {
    if (value[i] === "(") depth++
    else if (value[i] === ")") {
      depth--
      if (depth === 0 && i !== value.length - 1) return null
    }
  }
  const args = splitTopLevelArgs(value.slice(m[0].length, -1))
  return args.length > 1 ? { name: m[1], args } : null
}

// Reproduit le retour à la ligne de Prettier pour une valeur trop longue :
// un argument par ligne, indenté de deux espaces, parenthèse fermante seule
function wrapValue(indent, prefix, value, suffix) {
  const flat = `${indent}${prefix}${value}${suffix}`
  const call = parseFunctionCall(value)
  if (flat.length <= PRINT_WIDTH || !call) return [flat]
  const inner = `${indent}  `
  const lines = [`${indent}${prefix}${call.name}(`]
  call.args.forEach((arg, i) => {
    const argSuffix = i === call.args.length - 1 ? "" : ","
    lines.push(...wrapValue(inner, "", arg, argSuffix))
  })
  lines.push(`${indent})${suffix}`)
  return lines
}

export function formatThemeCss(css) {
  const out = []
  const isStandaloneComment = (l) => l.trim().startsWith("/*")
  const lines = css.split("\n").map((l) => l.replace(/\s+$/, ""))

  lines.forEach((line) => {
    const prev = out.length ? out[out.length - 1] : null
    if (line === "") {
      // Pas de ligne vide en début de bloc, ni en double
      if (prev === null || prev === "" || prev.endsWith("{")) return
      out.push("")
      return
    }
    // Pas de ligne vide avant une accolade fermante
    if (line.trim().startsWith("}") && prev === "") out.pop()

    // Stylelint (comment-empty-line-before) : une ligne vide avant chaque
    // commentaire, sauf en tête de bloc
    if (
      isStandaloneComment(line) &&
      prev !== null &&
      prev !== "" &&
      !prev.endsWith("{")
    ) {
      out.push("")
    }

    // Prettier : hexadécimaux en minuscules
    const lowered = line.replace(/#[0-9a-f]{3,8}\b/gi, (h) => h.toLowerCase())

    // Prettier : déclarations au-delà de la largeur d'impression
    const decl = lowered.match(/^(\s*)(--[\w-]+|[a-z-]+): (.+);$/i)
    if (decl && !decl[3].includes("/*")) {
      out.push(...wrapValue(decl[1], `${decl[2]}: `, decl[3], ";"))
    } else {
      out.push(lowered)
    }
  })

  while (out.length && out[out.length - 1] === "") out.pop()
  return out.join("\n") + "\n"
}
