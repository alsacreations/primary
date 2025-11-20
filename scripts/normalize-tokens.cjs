#!/usr/bin/env node
// normalize-tokens.cjs
// Version CommonJS du script de normalisation

const fs = require("fs");
const path = require("path");

const inputPath = path.resolve(
  __dirname,
  "..",
  "assets",
  "css",
  "theme-tokens.css"
);
const outDir = path.resolve(__dirname, "..", "tmp");
const outPath = path.join(outDir, "normalized-theme-tokens.css");

function readFile(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    console.error("Erreur lecture fichier:", p, e.message);
    process.exit(1);
  }
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function extractRootBlocks(css) {
  const roots = [];
  const regex = /:root\s*\{/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    let idx = match.index + match[0].length; // position after '{'
    let depth = 1;
    let start = idx;
    while (idx < css.length && depth > 0) {
      const ch = css[idx];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      idx++;
    }
    const inner = css.slice(start, idx - 1).trim();
    roots.push(inner);
    regex.lastIndex = idx;
  }
  return roots;
}

function normalizeInnerContent(innerParts) {
  const combined = innerParts.map((s) => s.trim()).join("\n\n");
  const lines = combined.split(/\r?\n/);
  const out = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.trim() === "") {
      if (out.length && out[out.length - 1].trim() === "") continue;
      out.push("");
      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith("/*")) {
      const commentLines = [line];
      if (!trimmed.endsWith("*/")) {
        i++;
        while (i < lines.length && !lines[i].includes("*/")) {
          commentLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) commentLines.push(lines[i]);
      }
      out.push(...commentLines);
      continue;
    }

    if (trimmed.endsWith("{")) {
      const blockLines = [line];
      let depth = 1;
      i++;
      while (i < lines.length && depth > 0) {
        const l = lines[i];
        blockLines.push(l);
        if (l.includes("{")) depth += (l.match(/\{/g) || []).length;
        if (l.includes("}")) depth -= (l.match(/\}/g) || []).length;
        i++;
      }
      out.push(...blockLines);
      i--;
      continue;
    }

    const propMatch = trimmed.match(/^([a-zA-Z0-9-]+)\s*:/);
    if (propMatch) {
      const prop = propMatch[1];
      if (seen.has(prop)) {
        continue;
      }
      seen.add(prop);
      out.push(line);
      continue;
    }

    out.push(line);
  }

  while (out.length && out[0].trim() === "") out.shift();
  while (out.length && out[out.length - 1].trim() === "") out.pop();

  return out.join("\n");
}

function extractHeaderComment(css) {
  const m = css.match(/^(\s*\/\*[\s\S]*?\*\/)/);
  return m ? m[1].trim() + "\n\n" : "";
}

function buildOutput(header, body) {
  return header + ":root {\n" + indentBody(body) + "\n}\n";
}

function indentBody(body) {
  return body
    .split(/\r?\n/)
    .map((l) => "  " + l)
    .join("\n");
}

function main() {
  const css = readFile(inputPath);
  const header = extractHeaderComment(css);
  const roots = extractRootBlocks(css);
  if (roots.length === 0) {
    console.error("Aucun bloc :root trouvé dans", inputPath);
    process.exit(1);
  }
  const normalizedInner = normalizeInnerContent(roots);
  const output = buildOutput(header, normalizedInner);
  ensureDir(outDir);
  fs.writeFileSync(outPath, output, "utf8");
  console.log("Fichier normalisé écrit:", outPath);
}

main();
