import { state } from "../assets/js/modules/state.js";
import * as gen from "../assets/js/modules/generators.js";

state.tokensContent = `:root {
  color-scheme: light dark;

  &[data-theme="light"] {
    color-scheme: light;
  }

  &[data-theme="dark"] {
    color-scheme: dark;
  }

  --surface: light-dark(var(--color-white), var(--color-gray-900));
  --form-control-background: light-dark(
    var(--color-gray-200),
    var(--color-gray-700)
  );
}`;

state.themeContent =
  ":root { --color-white: oklch(1 0 0); --color-gray-900: oklch(0 0 0); }\n";

state.config = state.config || {};
state.config.themeMode = "light";

console.log(gen.generateTokensCSS());
