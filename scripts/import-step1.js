#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const outDir = path.join(ROOT, "tmp");

function usage() {
  console.log("Usage: node scripts/import-step1.js --source=figma|project");
  process.exit(1);
}

const arg = process.argv.slice(2).find((a) => a.startsWith("--source="));
if (!arg) usage();
const source = arg.split("=")[1];

async function ensureOut() {
  await fs.mkdir(outDir, { recursive: true });
}

async function useProjectSource() {
  // Copy existing project theme and base tokens into tmp/
  const srcTheme = path.join(ROOT, "assets", "css", "theme.css");
  const srcTokens = path.join(
    ROOT,
    "public",
    "samples",
    "theme-tokens-base.css"
  );
  const dstTheme = path.join(outDir, "theme.css");
  const dstTokens = path.join(outDir, "theme-tokens.css");
  try {
    await fs.copyFile(srcTheme, dstTheme);
  } catch (e) {
    console.warn("Could not copy project theme.css:", e.message);
  }
  try {
    await fs.copyFile(srcTokens, dstTokens);
  } catch (e) {
    console.warn("Could not copy theme-tokens-base.css:", e.message);
  }
  console.log("Imported project source -> tmp/");
}

function useFigmaSource() {
  // Delegate to existing figma importer script to avoid duplicating logic
  const script = path.join(ROOT, "scripts", "figma-import.js");
  const res = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (res.error) {
    console.error("Failed to execute figma importer:", res.error);
    process.exit(1);
  }
  if (res.status !== 0) process.exit(res.status);
}

async function main() {
  await ensureOut();
  if (source === "project") {
    await useProjectSource();
  } else if (source === "figma") {
    useFigmaSource();
  } else {
    usage();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
