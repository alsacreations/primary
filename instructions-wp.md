# Instructions pour générer `theme.json` (WordPress FSE)

## Objectif

Générer un fichier `dist/theme.json` conforme au modèle WordPress FSE à partir de `dist/primitives.json` et `dist/tokens.json` produits par l'extracteur Figma. Les valeurs et mappings par défaut attendus sont explicitement listés dans la section **Valeurs par défaut (autonomes)** ci‑dessous, de sorte que le document est entièrement autonome et ne dépend plus d'un fichier d'exemple externe.

Ce document décrit, étape par étape, les règles de mappage, les conventions de nommage, la validation et les commandes pour automatiser la génération.

---

## Principe général

- **Toutes** les données extraites (primitives + tokens) doivent être représentées dans `theme.json` dans la section appropriée (couleurs, espacements, typographie, familles de police, etc.).
- **Les tokens projet (tokens.json)** priment sur les primitives pour déterminer la valeur finale exposée à `theme.json` lorsqu'il y a un conflit.
- **Les noms** affichés (`name`) sont dérivés du `slug` (même texte que le slug, en minuscules, avec tirets conservés), comme dans `examples/theme.json`. **Exception** : pour la palette de couleurs (`settings.color.palette`), voir les règles spécifiques de la section 1) ci-dessous (noms capitalisés, slugs en français).
- Conserver par défaut les mappings `styles`, `elements` et `blocks` selon les valeurs listées dans la section **Valeurs par défaut (autonomes)** ci‑dessous (le script injectera ces mappings automatiquement si l'utilisateur n'en fournit pas).

> **Comportement si aucune source fournie :** Si aucun fichier JSON n'est présent dans le dossier d'entrée (`source/`), le script doit générer `primitives.json` , `tokens.json` `theme.json` et `theme.css` malgré tout. Le résultat contiendra uniquement les **données globales** (commentaire général, custom breakpoints, color-scheme light par défaut, couleurs globales, couleurs tokens globales, autres primitives globales, et mappings `styles`/`elements`/`blocks` par défaut).

---

## Entrées attendues

- `dist/primitives.json` — structure contenant les primitives corrigées (noms `--color-*`, `--spacing-*`, `--text-*`, `--line-height-*`, `--font-*`, `--radius-*`, etc.).
- `dist/tokens.json` — structure contenant les tokens normalisés (tokens simples, light/dark, mobile/desktop).

---

## Règles de mappage détaillées

### 0) Flags généraux (top-level `settings`)

- Certains flags WordPress utiles doivent être explicitement exposés dans `settings` :
  - `appearanceTools`: `true` par défaut (active les outils d'apparence dans l'éditeur FSE).
  - `useRootPaddingAwareAlignments`: `true` par défaut (meilleure prise en charge des alignements et du padding racine).
- Ajoutez ces flags au début de l'objet `settings` généré quand approprié.

- **Flags de couleur** : pour l'éditeur FSE, exposez aussi dans `settings.color` les flags suivants (valeurs par défaut indiquées) :
  - `defaultDuotone`: `false`
  - `defaultGradients`: `false`
  - `defaultPalette`: `false`

Ces flags aident l'éditeur FSE à connaître quelles fonctionnalités de couleur sont prises en charge dans le thème.

### 1) Couleurs — `settings.color.palette`

- **Ne pas inclure les primitives couleur** (`--color-*`, ex. `raspberry-500`, `gray-900`, `slate-100`) : elles restent des variables CSS internes, hors palette WordPress.
- Ne conserver que les **tokens de couleur sémantiques** dont le slug commence par :
  - `base` (inclut `base`, `base-2`, `base-3`, …)
  - `contrast`
  - `accent` (inclut `accent-1`, `accent-2`, `accent-3`, …)
- **Exclure** `link` / `link-hover` et les couleurs d'état (`warning`, `error`, `success`, `info`, y compris leurs variantes numérotées comme `error-500`) : elles restent des variables CSS classiques, référencées directement en `var(--...)` dans les styles, sans passer par la palette.
- Pour chaque entrée conservée :
  - `name`: le mot anglais capitalisé (première lettre en majuscule), tirets et suffixes numériques conservés. Exemple : `accent-1` → `"Accent-1"`, `contrast` → `"Contrast"`.
  - `slug`: la traduction française du slug. `base` et `accent-*` s'écrivent identiquement en français ; `contrast` devient `contraste`.
  - `color`: référence directe à la variable CSS sémantique, sans préfixe `color-` (ex. `"var(--accent-1)"`, `"var(--base)"`, `"var(--contrast)"`). Ne pas envelopper dans `light-dark(...)`.
- Si le projet ne fournit pas ces tokens, injecter les valeurs par défaut `base`, `contrast`, `accent-1`, `accent-2`, `accent-3` avec les mêmes règles de nommage.

- Flags couleur complémentaires : exposer aussi les flags suivants dans `settings.color` quand pertinent (valeurs par défaut indiquées) :
  - `defaultDuotone`: `false`
  - `defaultGradients`: `false`
  - `defaultPalette`: `false`

Ces flags aident l'éditeur FSE à connaître quelles fonctionnalités de couleur sont prises en charge dans le thème.

Exemple d'éléments :

```json
{ "name": "Accent-1", "color": "var(--accent-1)", "slug": "accent-1" },
{ "name": "Contrast", "color": "var(--contrast)", "slug": "contraste" }
```

> Les références `var:preset|color|<slug>` utilisées dans `styles` (section 4) doivent utiliser le **slug de palette** (donc `var:preset|color|contraste`, pas `var:preset|color|contrast`). Pour les couleurs hors palette (`link`, `link-hover`), utiliser une référence directe `var(--link)` / `var(--link-hover)`.

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

**Remarque importante (line-height)** : N'ajoutez **pas** de clé top-level `settings.typography.lineHeights` (ce n'est pas pris en charge par le schéma WordPress). Les tokens de hauteur de ligne doivent rester dans `primitives.json` / `tokens.json` et être référencés depuis les mappings `styles.typography.lineHeight` (par exemple : `"lineHeight": "var(--line-height-24)"` ou une valeur numérique).

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

- Vérifier que toutes les références `var(...)` mentionnées existent soit dans `primitives.json`, soit dans `tokens.json`, soit dans la liste des tokens sémantiques connus (`base`, `base-2`, `base-3`, `contrast`, `accent-1`, `accent-2`, `accent-3`, `link`, `link-hover`, `link-active`, `selection`) qui n'ont pas de primitive correspondante. Lister les références manquantes dans `dist/theme-warnings.json`.
- Valider la structure minimale du `theme.json` (présence de `settings`, `settings.color.palette`, `settings.typography.fontSizes` et `settings.spacing.spacingSizes`).
- Emettre des erreurs non bloquantes (warnings) pour : tokens mono-mode apparents, primitives sans utilisation, tokens dont la valeur est `NaN` ou `calc` invalide.

---

## Valeurs par défaut (autonomes)

Le document contient ci‑dessous les valeurs par défaut que le script doit injecter automatiquement lorsque l'utilisateur ne fournit pas de configuration personnalisée. Ces valeurs doivent être intégrées **telles quelles** dans `dist/theme.json` si nécessaire.

### Palette de couleurs par défaut (`settings.color.palette`)

Le script doit inclure au minimum les entrées suivantes (format `name`, `color`, `slug`) lorsque les tokens correspondants n'existent pas explicitement dans `dist/tokens.json` :

```json
[
  { "name": "Base", "color": "var(--base)", "slug": "base" },
  { "name": "Base-2", "color": "var(--base-2)", "slug": "base-2" },
  { "name": "Base-3", "color": "var(--base-3)", "slug": "base-3" },
  { "name": "Contrast", "color": "var(--contrast)", "slug": "contraste" },
  { "name": "Accent-1", "color": "var(--accent-1)", "slug": "accent-1" },
  { "name": "Accent-2", "color": "var(--accent-2)", "slug": "accent-2" },
  { "name": "Accent-3", "color": "var(--accent-3)", "slug": "accent-3" }
]
```

> Remarque : cette liste est la base minimale — le script doit y ajouter tout token couleur du projet (`tokens.json`) dont le slug commence par `base`, `contrast` ou `accent` (voir section 1). Les primitives `--color-*` et les tokens `link`/états ne sont **jamais** ajoutés à la palette.

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
    "background": "var:preset|color|base",
    "text": "var:preset|color|contraste"
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
      "color": { "text": "var:preset|color|accent-1" },
      "typography": { "fontFamily": "var:preset|font-family|poppins", "fontWeight": "600" }
    },
    "h1": {
      "typography": { "fontFamily": "var:preset|font-family|poppins", "fontSize": "var:preset|font-size|text-4xl", "lineHeight": "1.05", "fontWeight": "600" }
    },
    "h2": {
      "typography": { "fontFamily": "var:preset|font-family|poppins", "fontSize": "var:preset|font-size|text-4xl", "lineHeight": "1.2", "fontWeight": "600" }
    },
    "link": {
      "color": { "text": "var(--link)" },
      "typography": { "textDecoration": "underline" },
      ":hover": { "color": { "text": "var(--link-hover)" }, "typography": { "fontWeight": "700" } }
    }
  },
  "blocks": {}
}
```

---

## Format du script proposé (`scripts/generateThemeJson.js`)

1. Lire `dist/primitives.json` et `dist/tokens.json`.
2. Construire :
   - `settings.color.palette` : uniquement les tokens couleur (tokens.json) dont le slug commence par `base`, `contrast` ou `accent` (traduits en français, noms capitalisés — voir section 1), complétés par les valeurs par défaut si absents. Aucune primitive `--color-*` n'est ajoutée.
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
