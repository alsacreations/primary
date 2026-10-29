# Primary — Générateur de thème CSS automatique

**Primary** est un outil web conçu par Alsacréations pour transformer des exports JSON de variables Figma en un kit CSS complet, structuré et prêt à l'emploi. Il permet de générer des tokens, des primitives, et de gérer nativement les modes clair/sombre ainsi que la typographie et les espacements fluides.

---

## 🚀 Fonctionnalités pour l'utilisateur

1. **Importation de fichiers JSON** : Glissez-déposez un ou plusieurs fichiers JSON exportés depuis le plugin "Variables" de Figma (via l'option "Export modes").
2. **Projet vide** : Possibilité de débuter un projet avec un set de primitives et tokens par défaut si aucune donnée Figma n'est disponible.
3. **Options de génération** :
   - **WordPress** : Génère un fichier `theme.json` conforme à la version 3 du schéma (WP 6.7+).
   - **Extra CSS** : Inclut automatiquement les dernières versions de `reset.css`, `layouts.css` (Bretzel) et `natives.css`.
   - **Fichiers de config** : Ajoute les fichiers standards de projet (`.editorconfig`, `.prettierrc`, `vite.config.js`, etc.).
4. **Kit complet (ZIP)** : Téléchargez une archive contenant toute la structure CSS (`app.css`, `theme.css`, `styles.css`, `utilities.css`) prête à être intégrée.

---

## 🛠️ Infos techniques (Développeur)

### Stack Technique

- **Vanilla JavaScript** (ESM) : Pas de framework CSS ou JS complexe.
- **Logique de traitement** : Portée par `assets/js/client-utils.mjs`. C'est ici que sont extraites les couleurs, typographies et espacements.
- **Interface & UI** : Gérée par `assets/js/app.js`.
- **Génération ZIP** : Utilise la bibliothèque [JSZip](https://stuk.github.io/jszip/).
- **Aperçu du code** : Rendu dynamique avec coloration syntaxique via `highlight-preview.mjs`.

### Structure des fichiers

Ce que Primary **distribue** aux projets :

- `config_files/` : Fichiers de configuration (EditorConfig, Prettier, Stylelint, ESLint, PostCSS, Vite, VS Code).
- `kit/` : Fichiers CSS statiques du kit (`styles.css`, `utilities.css`). `theme.css` et `custom-media.css` sont générés par les scripts.

Ce qui fait **fonctionner le site** Primary (jamais copié dans un projet) :

- `index.html` : Structure de l'application.
- `assets/js/` : Logique de l'application.
- `assets/css/` : Styles propres à l'application web. Ne pas confondre avec les fichiers du kit, même si certains portent le même nom.

---

## 📝 Maintenance et Mise à jour

### Mettre à jour les modèles de fichiers

Les fichiers générés dans le kit (`styles.css` et `utilities.css`) proviennent du dossier `kit/` pour faciliter leur maintenance sans toucher au code JavaScript.

- Modifiez `kit/styles.css` pour changer les styles de base par défaut.
- Modifiez `kit/utilities.css` pour ajuster les classes utilitaires (marges, paddings, etc.).

### Modifier la logique de génération

- **Calculs CSS (Clamp, Colors)** : Tout se passe dans `assets/js/client-utils.mjs`.
- **Structure du kit ZIP** : La composition de l'archive et la génération de `app.css` se font dans `assets/js/app.js`.
- **Instructions WP (theme.json)** : La fonction `processFiles.generateThemeJson` dans `client-utils.mjs` définit la structure du fichier JSON pour WordPress.

---

## 💻 Installation locale

Pour faire tourner Primary en local :

1. Clonez le dépôt.
2. Lancez un serveur local (utile pour les imports de modules ESM et le chargement des fichiers du kit) :

   ```bash
   npx serve .
   ```

3. Ouvrez votre navigateur sur `http://localhost:3000`.
