/**
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 * @type {import("eslint").Linter.Config[]}
 * Dépendances : pnpm add -D eslint @eslint/js globals eslint-config-prettier
 * Mise à jour : 2026-10-29
 */
import globals from "globals"
import pluginJs from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"

export default [
  // Fichiers compilés
  { ignores: ["dist/"] },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      sourceType: "module",
    },
  },
  pluginJs.configs.recommended,
  // Désactive les règles de mise en forme qui entrent en conflit avec Prettier
  eslintConfigPrettier,
]
