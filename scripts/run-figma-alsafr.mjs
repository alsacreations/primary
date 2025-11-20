#!/usr/bin/env node
import path from "path";
import { default as run } from "./figma-import.js";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const samplesDir = path.join(
  ROOT,
  "public",
  "samples",
  "figma-tokens",
  "alsafr"
);
const outDir = path.join(ROOT, "tmp");

run({ samplesDir, outDir })
  .then(() => {
    console.log("figma import (alsafr) done");
  })
  .catch((e) => {
    console.error("figma import (alsafr) failed", e);
    process.exit(1);
  });
