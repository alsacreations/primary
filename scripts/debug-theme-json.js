import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { generateThemeJSON } from "../assets/js/modules/generators.js";
import { state } from "../assets/js/modules/state.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  state.config.primaryColor = "raspberry";
  state.config.themeMode = "both";
  state.config.typoResponsive = true;
  state.config.spacingResponsive = true;
  state.config.technology = "wordpress";

  const out = generateThemeJSON();
  const expected = await fs.readFile(
    path.join(
      __dirname,
      "..",
      "public",
      "samples",
      "theme-base-light-dark.json"
    ),
    "utf8"
  );

  await fs.mkdir(path.join(__dirname, "..", "tmp"), { recursive: true });
  await fs.writeFile(
    path.join(__dirname, "..", "tmp", "generated-theme.json"),
    out,
    "utf8"
  );
  await fs.writeFile(
    path.join(__dirname, "..", "tmp", "expected-theme.json"),
    expected,
    "utf8"
  );

  console.log("Wrote tmp/generated-theme.json and tmp/expected-theme.json");
  console.log("Lengths:", out.length, expected.length);
} catch (err) {
  console.error("Error writing debug files:", err);
  process.exit(1);
}
