# Instructions pour générer `theme.json` (WordPress FSE)

## Objectif

Générer un fichier `dist/theme.json` conforme au modèle WordPress FSE à partir de `dist/primitives.json` et `dist/tokens.json` produits par l'extracteur Figma. Les valeurs et mappings par défaut attendus sont explicitement listés dans la section **Valeurs par défaut (autonomes)** ci‑dessous, de sorte que le document est entièrement autonome et ne dépend plus d'un fichier d'exemple externe.

Ce document décrit, étape par étape, les règles de mappage, les conventions de nommage, la validation et les commandes pour automatiser la génération.

---

## Principe général

- **Toutes** les données extraites (primitives + tokens) doivent être représentées dans `theme.json` dans la section appropriée (couleurs, espacements, typographie, familles de police, etc.).
- **Les tokens projet (tokens.json)** priment sur les primitives pour déterminer la valeur finale exposée à `theme.json` lorsqu'il y a un conflit.
- **Les noms** affichés (`name`) sont dérivés du `slug` (même texte que le slug, en minuscules, avec tirets conservés), comme dans `examples/theme.json`.
- Conserver par défaut les mappings `styles`, `elements` et `blocks` selon les valeurs listées dans la section **Valeurs par défaut (autonomes)** ci‑dessous (le script injectera ces mappings automatiquement si l'utilisateur n'en fournit pas).

> **Comportement si aucune source fournie :** Si aucun fichier JSON n'est présent dans le dossier d'entrée (`source/`), le script doit générer `primitives.json` , `tokens.json` `theme.json` et `theme.css` malgré tout. Le résultat contiendra uniquement les **données globales** (commentaire général, custom breakpoints, color-scheme light par défaut, couleurs globales, couleurs tokens globales, autres primitives globales, et mappings `styles`/`elements`/`blocks` par défaut).

---

## Entrées attendues

- `dist/primitives.json` — structure contenant les primitives corrigées (noms `--color-*`, `--spacing-*`, `--text-*`, `--line-height-*`, `--font-*`, `--radius-*`, etc.).
- `dist/tokens.json` — structure contenant les tokens normalisés (tokens simples, light/dark, mobile/desktop).

---

## Règles de mappage détaillées

### 1) Couleurs — `settings.color.palette`

- Inclure _toutes_ les primitives couleur presentes (`--color-*`) en entrée comme éléments de la palette. Pour chaque primitive `--color-XXX` :
  - `slug`: `XXX` (supprime le préfixe `color-` si présent). Exemple : `--color-raspberry-500` → `slug: "raspberry-500"`.
  - `name`: identique au `slug` (ex. `"raspberry-500"`).
  - `color`: référence CSS telle quelle dans `primitives.json` (ex. `"var(--color-raspberry-500)"` ou la valeur littérale si présente).
- Inclure aussi tous les **tokens couleurs** (ex. `--primary`, `--surface`, `--accent`) comme entrées distinctes dans la palette si ces tokens existent dans `tokens.json` ou `primitives.json`.
  - Si le token est **light/dark**, conserver l'expression `light-dark(var(...), var(...))` (ne pas l'évaluer).
  - Si le token est **simple** ou référencé par `var(--...)`, mettre la chaîne telle quelle dans `color`.
- Priorité : préférez la représentation à partir de `tokens.json` quand une entrée token existe, sinon tombez sur la primitive correspondante.

Exemple d'élément :

```json
{ "name": "raspberry-500", "color": "var(--color-raspberry-500)", "slug": "raspberry-500" }
```

---

### 2) Espacements — `settings.spacing.spacingSizes`

- Construire une liste de `spacingSizes` à partir :
  - des **tokens** de spacing présents dans `tokens.json` (préférence),
  - sinon des primitives `--spacing-*` (convertir en `var(--spacing-*)`).
- Pour chaque token :
  - `name`: prendre le slug du token (ex. `spacing-s`),
  - `size`: conservé tel quel (soit `var(--spacing-16)`, soit `clamp(...)` déjà calculé par l'extracteur),
  - `slug`: identique au `name` (ex. `spacing-s`).
- Inclure `units`: `["px","rem","%","vh","vw"]` et définir `defaultSpacingSizes: false` (ou selon configuration).

---

### 3) Typographie — `settings.typography.fontSizes` & `fontFamilies`

- `fontSizes`: inclure tous les tokens/primitives textuels (tokens projets d'abord); chaque entrée :
  - `name`: slug du token (ex. `text-m`),
  - `size`: `var(--text-*)` ou `clamp(...)` si token mobile/desktop,
  - `slug`: identique.
- `fontFamilies`: détecter primitives `--font-*` et -> créer objet `{ name, slug, fontFamily, fontFace? }`.
  - Si `primitives.json` contient métadonnées de fontFace (src, poids, style), inclure `fontFace` comme dans l'exemple (utile pour l'embed).
- Respecter les flags : `writingMode`, `defaultFontSizes`, `fluid`, `customFontSize`. Valeurs par défaut : `writingMode: true`, `defaultFontSizes: false`, `fluid: false`, `customFontSize: false`.

---

### 4) Styles par défaut (pré-remplissage)

- Conserver par défaut les mappings `styles.color`, `styles.spacing`, `styles.typography`, `styles.elements` et `styles.blocks` présents dans `examples/theme.json`.
- Le script doit **injecter** ces mappings par défaut si l'utilisateur ne fournit pas de configuration spécifique.
- Les valeurs doivent rester des références `var:preset|...` quand elles pointent vers un preset ou `var(--...)` si elles réfèrent directement à une primitive.

---

### 5) Cas des tokens mobile/desktop (clamp)

- Les tokens mobile/desktop doivent être transmis tels quels (leur `size` est déjà une expression `clamp(var(--left), <intercept>rem + <slope>vw, var(--right))` si l'extracteur a appliqué la règle). Ne pas transformer la formule.
- Si une extrémité manque, utiliser le fallback tel que défini par `clampBetweenModes` (le script d'extraction fournit ces valeurs).

---

### 6) Validation et avertissements

- Vérifier que toutes les références `var(...)` mentionnées existent soit dans `primitives.json` soit dans `tokens.json`. Lister les références manquantes dans `dist/theme-warnings.json`.
- Valider la structure minimale du `theme.json` (présence de `settings`, `settings.color.palette`, `settings.typography.fontSizes` et `settings.spacing.spacingSizes`).
- Emettre des erreurs non bloquantes (warnings) pour : tokens mono-mode apparents, primitives sans utilisation, tokens dont la valeur est `NaN` ou `calc` invalide.

---

## Valeurs par défaut (autonomes)

Le document contient ci‑dessous les valeurs par défaut que le script doit injecter automatiquement lorsque l'utilisateur ne fournit pas de configuration personnalisée. Ces valeurs doivent être intégrées **telles quelles** dans `dist/theme.json` si nécessaire.

### Palette de couleurs par défaut (`settings.color.palette`)

Le script doit inclure au minimum les entrées suivantes (format `name`, `color`, `slug`) lorsque les primitives correspondantes n'existent pas explicitement dans `dist/primitives.json` :

```json
[
  { "name": "white", "color": "var(--color-white)", "slug": "white" },
  { "name": "black", "color": "var(--color-black)", "slug": "black" },
  { "name": "gray-50", "color": "var(--color-gray-50)", "slug": "gray-50" },
  { "name": "gray-100", "color": "var(--color-gray-100)", "slug": "gray-100" },
  { "name": "gray-200", "color": "var(--color-gray-200)", "slug": "gray-200" },
  { "name": "gray-300", "color": "var(--color-gray-300)", "slug": "gray-300" },
  { "name": "gray-400", "color": "var(--color-gray-400)", "slug": "gray-400" },
  { "name": "gray-500", "color": "var(--color-gray-500)", "slug": "gray-500" },
  { "name": "gray-600", "color": "var(--color-gray-600)", "slug": "gray-600" },
  { "name": "gray-700", "color": "var(--color-gray-700)", "slug": "gray-700" },
  { "name": "gray-800", "color": "var(--color-gray-800)", "slug": "gray-800" },
  { "name": "gray-900", "color": "var(--color-gray-900)", "slug": "gray-900" },

  { "name": "error-100", "color": "var(--color-error-100)", "slug": "error-100" },
  { "name": "error-300", "color": "var(--color-error-300)", "slug": "error-300" },
  { "name": "error-500", "color": "var(--color-error-500)", "slug": "error-500" },

  { "name": "success-100", "color": "var(--color-success-100)", "slug": "success-100" },
  { "name": "success-300", "color": "var(--color-success-300)", "slug": "success-300" },
  { "name": "success-500", "color": "var(--color-success-500)", "slug": "success-500" },

  { "name": "warning-100", "color": "var(--color-warning-100)", "slug": "warning-100" },
  { "name": "warning-300", "color": "var(--color-warning-300)", "slug": "warning-300" },
  { "name": "warning-500", "color": "var(--color-warning-500)", "slug": "warning-500" },

  { "name": "info-100", "color": "var(--color-info-100)", "slug": "info-100" },
  { "name": "info-300", "color": "var(--color-info-300)", "slug": "info-300" },
  { "name": "info-500", "color": "var(--color-info-500)", "slug": "info-500" },

  {
    "name": "primary",
    "color": "light-dark(var(--color-raspberry-500), var(--color-raspberry-300))",
    "slug": "primary"
  },
  { "name": "on-primary", "color": "light-dark(var(--color-white), var(--color-black))", "slug": "on-primary" },
  { "name": "accent", "color": "light-dark(var(--color-raspberry-300), var(--color-raspberry-500))", "slug": "accent" },
  {
    "name": "accent-invert",
    "color": "light-dark(var(--color-raspberry-500), var(--color-raspberry-300))",
    "slug": "accent-invert"
  },
  { "name": "surface", "color": "light-dark(var(--color-white), var(--color-gray-900))", "slug": "surface" },
  { "name": "on-surface", "color": "light-dark(var(--color-gray-900), var(--color-gray-100))", "slug": "on-surface" },
  { "name": "link", "color": "light-dark(var(--color-raspberry-500), var(--color-raspberry-300))", "slug": "link" },
  {
    "name": "link-hover",
    "color": "light-dark(var(--color-raspberry-700), var(--color-raspberry-500))",
    "slug": "link-hover"
  },
  {
    "name": "selection",
    "color": "light-dark(var(--color-raspberry-300), var(--color-raspberry-500))",
    "slug": "selection"
  }
]
```

> Remarque : la palette ci‑dessus est la base minimale — le script doit ajouter **toutes** les primitives `--color-*` trouvées dans `primitives.json` en priorité.

### Layout par défaut

```json
{
  "contentSize": "48rem",
  "wideSize": "80rem"
}
```

### Espacements par défaut (`settings.spacing`)

- `defaultSpacingSizes`: `false`
- `units`: `["px","rem","%","vh","vw"]`
- Exemple de `spacingSizes` par défaut (les tokens de projet remplaceront ces entrées s'ils existent) :

```json
[
  { "name": "spacing-xs", "size": "var(--spacing-4)", "slug": "spacing-xs" },
  {
    "name": "spacing-s",
    "size": "clamp(var(--spacing-8), 0.2955rem + 0.9091vw, var(--spacing-16))",
    "slug": "spacing-s"
  },
  {
    "name": "spacing-m",
    "size": "clamp(var(--spacing-16), 0.5909rem + 1.8182vw, var(--spacing-32))",
    "slug": "spacing-m"
  },
  {
    "name": "spacing-l",
    "size": "clamp(var(--spacing-24), 0.8864rem + 2.2727vw, var(--spacing-48))",
    "slug": "spacing-l"
  },
  {
    "name": "spacing-xl",
    "size": "clamp(var(--spacing-32), 0.7727rem + 5.4545vw, var(--spacing-80))",
    "slug": "spacing-xl"
  }
]
```

### Typographie — valeurs par défaut

- `writingMode`: `true`
- `defaultFontSizes`: `false`
- `fluid`: `false`
- `customFontSize`: `false`

`fontSizes` d'exemple (le script doit générer ces entrées à partir des tokens/primitives) :

```json
[
  { "name": "text-s", "size": "var(--text-s)", "slug": "text-s" },
  { "name": "text-m", "size": "var(--text-m)", "slug": "text-m" },
  { "name": "text-l", "size": "var(--text-l)", "slug": "text-l" }
]
```

`fontFamilies` d'exemple :

```json
[
  {
    "name": "Poppins",
    "slug": "poppins",
    "fontFamily": "Poppins, sans-serif",
    "fontFace": [
      {
        "src": ["file:./assets/fonts/Poppins-Variable-opti.woff2"],
        "fontWeight": "100 900",
        "fontStyle": "normal",
        "fontFamily": "Poppins"
      }
    ]
  },
  { "name": "System", "slug": "system", "fontFamily": "system-ui, sans-serif" },
  { "name": "Mono", "slug": "mono", "fontFamily": "ui-monospace, monospace" }
]
```

### Mappings `styles`, `elements` et `blocks` par défaut

Le script doit injecter les mappings suivants lorsqu'aucune configuration utilisateur n'est fournie (valeurs identiques à celles suivantes) :

```json
"styles": {
  "color": {
    "background": "var:preset|color|surface",
    "text": "var:preset|color|on-surface"
  },
  "spacing": {
    "blockGap": "var:preset|spacing|spacing-16",
    "padding": { "left": "var:preset|spacing|spacing-16", "right": "var:preset|spacing|spacing-16" }
  },
  "typography": {
    "fontFamily": "var:preset|font-family|poppins",
    "fontSize": "var:preset|font-size|text-m",
    "fontWeight": "400",
    "lineHeight": "var(--line-height-24)",
    "fontStyle": "normal"
  },
  "elements": {
    "heading": {
      "color": { "text": "var:preset|color|primary" },
      "typography": { "fontFamily": "var:preset|font-family|poppins", "fontWeight": "600" }
    },
    "h1": {
      "typography": { "fontFamily": "var:preset|font-family|poppins", "fontSize": "var:preset|font-size|text-4xl", "lineHeight": "1.05", "fontWeight": "600" }
    },
    "h2": {
      "typography": { "fontFamily": "var:preset|font-family|poppins", "fontSize": "var:preset|font-size|text-4xl", "lineHeight": "1.2", "fontWeight": "600" }
    },
    "link": {
      "color": { "text": "var:preset|color|link" },
      "typography": { "textDecoration": "underline" },
      ":hover": { "color": { "text": "var:preset|color|link-hover" }, "typography": { "fontWeight": "700" } }
    }
  },
  "blocks": {
    "core/button": {
      "border": { "radius": "0.5rem" },
      "color": { "background": "var:preset|color|primary", "text": "var:preset|color|on-primary" },
      "typography": { "fontFamily": "var:preset|font-family|poppins", "fontWeight": "600" },
      "spacing": { "padding": { "top": "var:preset|spacing|spacing-12", "right": "var:preset|spacing|spacing-12", "bottom": "var:preset|spacing|spacing-12", "left": "var:preset|spacing|spacing-12" } }
    }
  }
}
```

---

## Format du script proposé (`scripts/generateThemeJson.js`)

1. Lire `dist/primitives.json` et `dist/tokens.json`.
2. Construire :
   - `settings.color.palette` : concaténation de (a) toutes les primitives `--color-*` (format palette entry) et (b) tous les tokens couleur (tokens.json) qui ne sont pas déjà représentés.
   - `settings.spacing.spacingSizes` : tokens spacing (préférer tokens à primitives) ordonnés par slug ou valeur.
   - `settings.typography.fontSizes` et `fontFamilies`.
   - Insérer les mappings `styles`, `elements`, `blocks` par défaut (copie depuis `examples/theme.json`).
3. Valider la sortie et écrire `dist/theme.json`.
4. Écrire `dist/theme-warnings.json` quand il y a des problèmes non bloquants.

### Options CLI

- `--out` : chemin de sortie (défaut `dist/theme.json`).
- `--merge-example` : boolean; si true, fusionner avec `examples/theme.json` et ne remplacer que les sections générées (utile pour conserver manuellement des custom mappings).

---

## Tests et CI

- Ajouter un test d'intégration `tests/generate-theme.test.js` qui :
  - Fournit des fixtures (copies de `dist/primitives.json` + `dist/tokens.json` sous `tests/fixtures`).
  - Exécute `node scripts/generateThemeJson.js --out tests/out/theme.json` et compare le résultat à `tests/out/theme.json` référence.
- Ajouter un test de validation: vérifier qu'aucune `var(...)` référencée n'est manquante.
- Ajouter un script npm :

```json
"scripts": {
  "wp-theme": "node scripts/generateThemeJson.js",
  "test:wp": "node tests/generate-theme.test.js"
}
```

---

## Exemples rapides

- `npm run wp-theme` → génère `dist/theme.json` à partir de `dist/primitives.json` + `dist/tokens.json`.
- En cas de besoin de fusion manuelle avec `examples/theme.json` : `node scripts/generateThemeJson.js --merge-example`.

---

## Remarques finales

- Le script doit être idempotent et lisible (clear diffs lorsqu'il est régénéré).
- Préférer la **conservation des expressions CSS** (ne pas évaluer `light-dark` ni `clamp`) — laisser ces expressions telles quelles dans le JSON final.

---

Si ces règles te conviennent, je peux :

- implémenter `scripts/generateThemeJson.js` et les tests, puis ajouter `npm run wp-theme`, ou
- commencer par commiter uniquement ce fichier d'instructions pour validation.

Dis-moi quelle option tu préfères.
