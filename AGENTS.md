# AGENTS.md - Projet Primary

Outil web de transformation d'exports JSON Figma en kits CSS structurés et artifacts WordPress.

## Tech Stack

- **Vanilla JavaScript (ESM)**, HTML5, CSS natif.
- **Node.js** (scripts), JSZip, ESLint, Stylelint, Prettier.

## Commandes essentielles

- `npx serve .` : Lancer le serveur de développement local (port 3000).
- `npm run build` : Générer les artifacts CSS et le `theme.json` WordPress.
- `npm run test:[category]` : Exécuter les tests (ex: `test:global-tokens`).

## Conventions Projet

- **Logique** : `assets/js/client-utils.mjs` (calculs) et `assets/js/app.js` (Interface/ZIP).
- **Templates** : Modifier `assets/templates/*.css` pour impacter le kit généré.
- **Commits** : Conventional Commits (type EN, desc FR). Ex: `feat(ui): ajoute bouton`.
- **Commentaires** : Uniquement en français.

## Conventions Générales (Critiques)

- **CSS** : Pas de styles inline (CSP). CSS natif uniquement (pas de Tailwind/Bootstrap).
- **Variables** : Utiliser `assets/css/theme.css`. Préférer les **tokens** aux primitives.
- **Layouts** : Système **Bretzel** via `data-layout` (`duo`, `stack`, `cluster`, `autogrid`, etc.). Préférer ces attributs aux styles `flex`/`grid` personnalisés.

## Subagents

- Utiliser l'outil **Task** pour toute exploration, recherche ou analyse verbeuse.
- Déléguer par défaut : investigation du code, revue technique et résumés d'analyse.
