import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { generateTokensCSS } from "../assets/js/modules/generators.js";
import { state } from "../assets/js/modules/state.js";

function read(p) {
  return fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
}

try {
  state.themeContent = read(["assets", "css", "theme.css"]);
} catch (e) {
  state.themeContent = "";
}
try {
  state.resetContent = read(["assets", "css", "reset.css"]);
} catch (e) {
  state.resetContent = "";
}
try {
  state.layoutsContent = read(["assets", "css", "layouts.css"]);
} catch (e) {
  state.layoutsContent = "";
}
try {
  state.nativesContent = read(["assets", "css", "natives.css"]);
} catch (e) {
  state.nativesContent = "";
}
try {
  state.stylesSystemContent = read(["canonical", "styles", "styles.css"]);
} catch (e) {
  state.stylesSystemContent = "";
}
try {
  state.stylesPoppinsContent = read([
    "canonical",
    "styles",
    "styles-poppins.css",
  ]);
} catch (e) {
  state.stylesPoppinsContent = "";
}
try {
  state.appContent = read(["assets", "css", "app.css"]);
} catch (e) {
  state.appContent = "";
}

// canonical expected
const expectedPath = path.join(
  __dirname,
  "..",
  "canonical",
  "tokens",
  "theme-tokens-base-light-dark.css"
);
const outDir = path.join(__dirname, "..", "tmp");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const generated = generateTokensCSS();
fs.writeFileSync(path.join(outDir, "generated-tokens.css"), generated, "utf8");
console.log("Wrote tmp/generated-tokens.css (length:", generated.length, ")");

let expected = "";
try {
  expected = fs.readFileSync(expectedPath, "utf8");
  fs.writeFileSync(
    path.join(outDir, "expected-canonical.css"),
    expected,
    "utf8"
  );
  console.log(
    "Wrote tmp/expected-canonical.css (length:",
    expected.length,
    ")"
  );
} catch (e) {
  console.warn("Could not read expected canonical:", expectedPath, e.message);
}

// Simple diff print (line-wise prefix)
function diff(a, b) {
  const A = a.split(/\r?\n/);
  const B = b.split(/\r?\n/);
  const max = Math.max(A.length, B.length);
  const lines = [];
  for (let i = 0; i < max; i++) {
    const x = A[i] || "";
    const y = B[i] || "";
    if (x !== y) {
      lines.push(`- ${x}`);
      lines.push(`+ ${y}`);
    }
  }
  return lines.join("\n");
}

const d = diff(expected, generated);
if (d.length === 0)
  console.log("No diff between expected canonical and generated");
else {
  console.log("Diff (expected -> generated) :\n");
  console.log(d.split("\n").slice(0, 200).join("\n"));
  if (d.split("\n").length > 200) console.log("\n... (diff truncated)");
}

console.log("\nDone.");
