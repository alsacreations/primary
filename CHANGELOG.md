# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Features

- feat(generator): preserve imported token forms and pick existing color variants
- Preserve non‑destructive `var(...)` imports and choose available numeric variants instead of forcing `-500`.
- feat(typo): support Poppins without overwriting system base
- Keep `--font-base: system-ui, sans-serif;` and add `--font-poppins` when Poppins is selected; UI selection is synchronized to exports.

### Chores

- chore(files): load canonical `styles-poppins.css` for Poppins exports
- Ensure generated `styles.css` for Poppins matches the canonical file.
- chore(packaging): include Poppins font under `assets/fonts/` in ZIP
- chore(styleguide): remove "Source des tokens" indicator and cleanup JS
- chore(clean): remove temporary files (`tmp/`) and obsolete `scripts/` utilities

### Notes

- Debug scripts and local tests were used to validate these changes; they can be restored from version history if needed.
