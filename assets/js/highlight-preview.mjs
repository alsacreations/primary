// Module: highlight-preview.mjs
// Provides highlightCode(el, content, language) using the CSS Custom Highlight API
// with a DOM-based Range approach when available, and an HTML fallback otherwise.

const _registeredHighlights = new WeakMap()
// track when highlights were last registered for an element to avoid immediate clears
const _registeredAt = new WeakMap()

export function highlightCode(el, content = "", language = "auto") {
  if (!el) return
  clearHighlightsForElement(el)
  el.textContent = content || ""
  if (!content) {
    return
  }

  const textNode = el.firstChild
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return

  let tokens =
    language === "json" ? tokenizeJson(content) : tokenizeCss(content)

  // defensive filter: remove tokens whose offsets are out of bounds relative to the text node
  const maxLen = textNode.length
  const inBounds = tokens.filter(
    (t) =>
      typeof t.start === "number" &&
      typeof t.end === "number" &&
      t.start >= 0 &&
      t.end <= maxLen &&
      t.end > t.start,
  )
  if (inBounds.length !== tokens.length) {
    tokens = inBounds
  }

  // Try Highlight API (ensure Highlight constructor exists)
  if (window.Highlight && window.CSS && CSS.highlights && tokens.length) {
    const groups = {}
    tokens.forEach((t) => {
      groups[t.type] = groups[t.type] || []
      const r = new Range()
      try {
        r.setStart(textNode, t.start)
        r.setEnd(textNode, t.end)
        groups[t.type].push(r)
      } catch (e) {
        // ignore invalid ranges
      }
    })

    const regNames = []
    Object.keys(groups).forEach((type, idx) => {
      const ranges = groups[type]
      if (!ranges || !ranges.length) return
      const highlight = new Highlight(...ranges)
      // set a small priority so overlaps are consistent (later types override earlier if higher)
      highlight.priority = 100 + idx
      const name = `code-${el.id}-${type}`
      try {
        CSS.highlights.set(name, highlight)
        regNames.push(name)
      } catch (e) {
        // ignore registration error
      }
    })
    _registeredHighlights.set(el, regNames)
    _registeredAt.set(el, Date.now())
    return
  }

  // Fallback: simple HTML token wrapping
  const html = fallbackWrap(content, language)
  el.innerHTML = html
  _registeredHighlights.set(el, [])
}

export function clearHighlightsForElement(el) {
  const list = _registeredHighlights.get(el)
  const lastRegistered = _registeredAt.get(el)
  if (lastRegistered && Date.now() - lastRegistered < 300) {
    return
  }

  if (list && window.CSS && CSS.highlights) {
    list.forEach((name) => {
      try {
        CSS.highlights.delete(name)
      } catch (e) {
        // ignore deletion errors
      }
    })
  }
  _registeredAt.delete(el)
  _registeredHighlights.delete(el)
}

// --- Tokenizers ---
function tokenizeCss(str) {
  const tokens = []
  // comments /* ... */
  for (const m of str.matchAll(/\/\*[\s\S]*?\*\//g)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "comment" })
  }
  // strings
  for (const m of str.matchAll(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "string" })
  }
  // variables (--name)
  for (const m of str.matchAll(/(--[a-zA-Z0-9-_]+)/g)) {
    tokens.push({
      start: m.index,
      end: m.index + m[0].length,
      type: "variable",
    })
  }
  // hex colors
  for (const m of str.matchAll(/#(?:[0-9a-fA-F]{3,8})\b/g)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "hex" })
  }
  // functions e.g. clamp(
  for (const m of str.matchAll(/\b([a-zA-Z\-]+)(?=\()/g)) {
    tokens.push({ start: m.index, end: m.index + m[1].length, type: "func" })
  }
  // numbers with units
  for (const m of str.matchAll(/\b-?\d+(?:\.\d+)?(?:px|rem|em|vw|vh|%)\b/g)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "number" })
  }
  // at-rules
  for (const m of str.matchAll(/@[-_a-zA-Z]+/g)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "atrule" })
  }
  // property names at line start or after semicolon
  for (const m of str.matchAll(/(^|[;\n\r])\s*([a-zA-Z-]+)\s*(?=:)/gm)) {
    const start = m.index + m[0].indexOf(m[2])
    tokens.push({ start, end: start + m[2].length, type: "property" })
  }

  // Sort tokens and remove duplicates / overlaps by keeping first occurrence
  tokens.sort((a, b) => a.start - b.start || b.end - a.end)
  return tokens
}

function tokenizeJson(str) {
  const tokens = []
  // keys: "key":
  for (const m of str.matchAll(/"([^"\\]|\\.)*"\s*(?=:)/g)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "key" })
  }
  // strings (values)
  for (const m of str.matchAll(/(?<!: )"([^"\\]|\\.)*"/g)) {
    // this will also match keys; keys already captured earlier so overlaps are fine
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "string" })
  }
  // numbers
  for (const m of str.matchAll(/-?\b\d+(?:\.\d+)?\b/g)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "number" })
  }
  // booleans/null
  for (const m of str.matchAll(/\b(?:true|false|null)\b/g)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "boolean" })
  }
  tokens.sort((a, b) => a.start - b.start || b.end - a.end)
  return tokens
}

// --- Fallback HTML wrapping ---
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function fallbackWrap(content, language) {
  // Work on escaped content so HTML cannot be injected, and use
  // regex patterns that match escaped quotes (&quot;) and single quotes (&#39;)
  let html = escapeHtml(content)
  if (language === "json") {
    // keys: &quot;...&quot; :
    html = html.replace(
      /(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)/g,
      (m, p1, p2) => {
        return `<span class="token-key">${p1}</span>${p2}`
      },
    )
    // strings (values)
    html = html.replace(
      /(:\s*)(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g,
      (m, p1, p2) => {
        return `${p1}<span class="token-string">${p2}</span>`
      },
    )
    // booleans/null
    html = html.replace(
      /\b(true|false|null)\b/g,
      '<span class="token-boolean">$1</span>',
    )
    // numbers
    html = html.replace(
      /(-?\b\d+(?:\.\d+)?\b)/g,
      '<span class="token-number">$1</span>',
    )
  } else {
    // CSS fallback: comments
    html = html.replace(
      /\/\*[\s\S]*?\*\//g,
      (m) => `<span class="token-comment">${escapeHtml(m)}</span>`,
    )
    // strings (double-quoted &quot;...&quot; or single-quoted &#39;...&#39;)
    html = html.replace(
      /(&quot;(?:[^&]|&(?!quot;))*?&quot;)|(&#39;(?:[^&]|&(?!#39;))*?&#39;)/g,
      (m) => `<span class="token-string">${m}</span>`,
    )
    // variables
    html = html.replace(
      /(--[a-zA-Z0-9-_]+)/g,
      '<span class="token-variable">$1</span>',
    )
    // hex
    html = html.replace(
      /#(?:[0-9a-fA-F]{3,8})\b/g,
      (m) => `<span class="token-hex">${m}</span>`,
    )
    // functions
    html = html.replace(
      /\b([a-zA-Z\-]+)(?=\()/g,
      '<span class="token-func">$1</span>',
    )
    // numbers with units
    html = html.replace(
      /\b-?\d+(?:\.\d+)?(?:px|rem|em|vw|vh|%)\b/g,
      '<span class="token-number">$&</span>',
    )
    // at-rules
    html = html.replace(/@[-_a-zA-Z]+/g, '<span class="token-atrule">$&</span>')
    // property names (approx, at line starts)
    html = html.replace(
      /(^|[;\n\r])\s*([a-zA-Z-]+)\s*(?=:)/gm,
      (m, p1, p2) => `${p1}<span class="token-property">${p2}</span>:`,
    )
  }
  return html
}
