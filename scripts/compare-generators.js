#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import {
  setPaths as setNodePaths,
  generate as nodeGenerate,
} from "./figma-import.js";
import clientMod from "../assets/js/modules/figma-client-gen.js";
import { exec } from "child_process";
import { promisify } from "util";
const execp = promisify(exec);

const ROOT = path.resolve(".");
const samplesDir = path.join(ROOT, "public", "samples", "figma-tokens");
const outDir = path.join(ROOT, "tmp");

async function readJson(name) {
  const p = path.join(samplesDir, name);
  return JSON.parse(await fs.readFile(p, "utf8"));
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const primitives = await readJson("Primitives.json");
  const fonts = await readJson("Token Font.json");
  const tokenColors = await readJson("Token colors.json");

  // Run Node canonical generator writing to tmp/
  setNodePaths({ samplesDir, outDir });
  await nodeGenerate();

  const nodeTokensPath = path.join(outDir, "theme-tokens.css");
  const nodeThemePath = path.join(outDir, "theme.css");
  const nodeTokens = await fs.readFile(nodeTokensPath, "utf8");
  const nodeTheme = await fs.readFile(nodeThemePath, "utf8");

  // Run client generator in-process
  const clientRes = await clientMod.generateCanonicalThemeFromFigma({
    primitives,
    fonts,
    tokenColors,
    synthesizeProjectPrimitives: true,
  });

  // write client outputs for inspection
  const clientTokensPath = path.join(outDir, "client-theme-tokens.css");
  const clientThemePath = path.join(outDir, "client-theme.css");
  await fs.writeFile(clientTokensPath, clientRes.tokensCss, "utf8");
  await fs.writeFile(clientThemePath, clientRes.themeCss, "utf8");

  // Compare exact
  if (nodeTokens === clientRes.tokensCss) {
    console.log("OK: theme-tokens.css outputs are byte-for-byte identical");
    return process.exit(0);
  }

  console.log("DIFFER: theme-tokens.css differs — showing unified diff:");
  try {
    const { stdout, stderr } = await execp(
      `diff -u ${nodeTokensPath} ${clientTokensPath}`
    );
    console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (err) {
    // diff returns non-zero when files differ; capture stdout from the error
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
  }

  // Also print a short summary of sizes
  console.log("\nSummary:");
  console.log("  node tokens length:", nodeTokens.length);
  console.log("  client tokens length:", clientRes.tokensCss.length);

  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
