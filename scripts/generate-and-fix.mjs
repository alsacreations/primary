#!/usr/bin/env node
import { spawnSync } from "child_process";

console.log("Running generation (run-figma-alsafr.mjs)");
let r = spawnSync("node", ["scripts/run-figma-alsafr.mjs"], {
  stdio: "inherit",
});
if (r.status !== 0) process.exit(r.status);

console.log("\nRunning verifier/fixer (verify-and-fix-theme-tokens.mjs)");
r = spawnSync("node", ["scripts/verify-and-fix-theme-tokens.mjs"], {
  stdio: "inherit",
});
if (r.status !== 0) process.exit(r.status);

console.log("\nDone.");
