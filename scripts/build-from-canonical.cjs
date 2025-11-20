#!/usr/bin/env node
// build-from-canonical.cjs
// Lit tous les fichiers CSS sous canonical/tokens/**, extrait les blocs :root
// et reconstruit un fichier unique tmp/canonical-theme-tokens.css pour inspection.

const fs = require("fs");
const path = require("path");

const canonicalDir = path.resolve(__dirname, "..", "canonical", "tokens");
const outDir = path.resolve(__dirname, "..", "tmp");
const outPath = path.join(outDir, "canonical-theme-tokens.css");

function listFiles(dir) {
  const res = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) res.push(...listFiles(p));
    else if (e.isFile() && p.endsWith(".css")) res.push(p);
  }
  return res;
}

function readFile(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    console.error("Erreur lecture", p, e.message);
    process.exit(1);
  }
}

function extractRootInner(css) {
  const parts = [];
  const startRx = /:root\s*\{/g;
  let match;
  while ((match = startRx.exec(css))) {
    let idx = match.index + match[0].length; // position after '{'
    let depth = 1;
    const start = idx;
    while (idx < css.length && depth > 0) {
      const ch = css[idx];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      idx++;
    }
    const inner = css.slice(start, idx - 1).trim();
    parts.push(inner);
    startRx.lastIndex = idx;
  }
  if (parts.length === 0) return css.trim();
  return parts.join("\n\n");
}

function build(header, body) {
  return (
    header +
    ":root {\n" +
    body
      .split(/\r?\n/)
      .map((l) => "  " + l)
      .join("\n") +
    "\n}\n"
  );
}

function extractHeader(filesContent) {
  // try to take header from first file if it starts with a comment
  const first = filesContent.find((c) => c && c.trim().length > 0) || "";
  const m = first.match(/^(\s*\/\*[\s\S]*?\*\/)/);
  return m
    ? m[1].trim() + "\n\n"
    : "/* Canonical tokens (generated for inspection) */\n\n";
}

function main() {
  if (!fs.existsSync(canonicalDir)) {
    console.error("Dossier canonical non trouvé:", canonicalDir);
    process.exit(1);
  }
  const files = listFiles(canonicalDir).sort();
  if (files.length === 0) {
    console.error("Aucun fichier CSS trouvé dans", canonicalDir);
    process.exit(1);
  }
  const contents = files.map((f) => ({ path: f, content: readFile(f) }));
  // header
  const header = extractHeader(contents.map((c) => c.content));
  // concatenate inner parts in file order (deterministic)
  const inners = contents.map((c) => extractRootInner(c.content));
  const body = inners.join("\n\n");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, build(header, body), "utf8");
  console.log("Fichier canonical construit:", outPath);
  console.log("Fichiers inclus (ordre):");
  for (const f of files) console.log(" -", path.relative(process.cwd(), f));
}

main();
