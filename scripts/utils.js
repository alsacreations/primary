const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function writeFile(p, content) {
  fs.writeFileSync(p, content, "utf8");
}

function toCssVarName(parts) {
  // parts e.g. ['slate','100'] -> --color-slate-100 or just 'color-slate-100'
  return "--" + parts.join("-").replace(/\s+/g, "-").toLowerCase();
}

function pxToRem(px) {
  if (px === undefined || px === null) return "0rem";
  const rem = Number(px) / 16;
  return `${rem}rem`;
}

function clampBetweenModes(mobileVarOrHex, desktopVarOrHex) {
  // If inputs are var() references, we return a placeholder using clamp with var() wrapped
  const mobile =
    typeof mobileVarOrHex === "string" && mobileVarOrHex.startsWith("--")
      ? `var(${mobileVarOrHex})`
      : pxToRem(Number(mobileVarOrHex));
  const desktop =
    typeof desktopVarOrHex === "string" && desktopVarOrHex.startsWith("--")
      ? `var(${desktopVarOrHex})`
      : pxToRem(Number(desktopVarOrHex));
  // Build a safe clamp formula (using 360px and 1280px breakpoints)
  return `clamp(${mobile}, calc(${mobile} + ((100vw - 360px) / 920) * (calc(${desktop} - ${mobile}))), ${desktop})`;
}

function readJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => {
      const fp = path.join(dir, f);
      try {
        const json = JSON.parse(fs.readFileSync(fp, "utf8"));
        // Normalize mode name: only recognize explicit modes that imply tokens
        const rawMode = (json && json.$extensions && json.$extensions["com.figma.modeName"]) || json.mode || null;
        let modeName = null;
        if (rawMode) {
          const lower = String(rawMode).toLowerCase();
          if (["light", "dark", "mobile", "desktop"].includes(lower)) {
            modeName = lower;
          } else {
            // treat unknown mode names as modeless (primitive files)
            modeName = null;
          }
        }
        return { filePath: fp, json, modeName };
      } catch (err) {
        console.warn("Skipping invalid JSON file", fp, err.message);
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = { ensureDir, writeFile, toCssVarName, pxToRem, clampBetweenModes, readJsonFiles };
