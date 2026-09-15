# Instructions pour générer `theme.json` (WordPress FSE)

## Objectif

Générer un fichier `dist/theme.json` conforme au modèle WordPress FSE à partir de `dist/primitives.json` et `dist/tokens.json` produits par l'extracteur Figma. Les valeurs et mappings par défaut attendus sont explicitement listés dans la section **Valeurs par défaut (autonomes)** ci‑dessous, de sorte que le document est entièrement autonome et ne dépend plus d'un fichier d'exemple externe.

Ce document décrit, étape par étape, les règles de mappage, les conventions de nommage, la validation et les commandes pour automatiser la génération.

---

## Principe général

- **Toutes** les données extraites (primitives + tokens) doivent être représentées dans `theme.json` dans la section appropriée (couleurs, espacements, typographie, familles de police, etc.).
- **Les tokens projet (tokens.json)** priment sur les primitives pour déterminer la valeur finale exposée à `theme.json` lorsqu'il y a un conflit.
- **Les noms** affichés (`name`) sont dérivés du `slug` (même texte que le slug, en minuscules, avec tirets conservés), comme dans `examples/theme.json`. **Exception** : pour la palette de couleurs (`settings.color.palette`), voir les règles spécifiques de la section 1) ci-dessous (slugs en anglais, noms traduits en français).
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
- **Exclure** `link` / `link-hover` : ils restent des variables CSS classiques, référencées directement en `var(--...)` dans les styles, sans passer par la palette.
- **Les couleurs d'état** (`warning`, `error`, `success`, `info`) ne sont **plus générées du tout** dans `theme.css` (ni comme tokens globaux, ni ailleurs) — seules leurs primitives numérotées (`--color-error-500`, `--color-warning-300`, …, voir section 5 de `instructions.md`) restent disponibles comme variables CSS internes. Ne jamais référencer `var(--warning)`, `var(--error)`, `var(--success)` ou `var(--info)` dans `theme.json`.
- Pour chaque entrée conservée :
  - `slug`: le slug tel quel (celui de la variable CSS, en anglais), tirets et suffixes numériques conservés. Exemple : `accent-1`, `contrast`, `base-2`.
  - `name`: la traduction française du mot, capitalisée (première lettre en majuscule). `base` et `accent-*` s'écrivent identiquement en français (`"Accent-1"`, `"Base-2"`) ; `contrast` devient `"Contraste"`.
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
{ "name": "Contraste", "color": "var(--contrast)", "slug": "contrast" }
```

> Les références `var:preset|color|<slug>` utilisées dans `styles` (section 4) doivent utiliser le **slug de palette** (donc `var:preset|color|contrast`, le slug reste en anglais). Les couleurs exclues de la palette (`link`, `link-hover`, états) ne doivent **jamais** être référencées dans `theme.json`, ni via un preset ni via `var(--...)` — aucun mapping `styles`/`elements` par défaut ne doit s'appuyer dessus (voir la section 4 : pas de mapping `elements.link`).

---

### 2) Espacements — `settings.spacing.spacingSizes`

- **Ne pas inclure l'échelle brute** (`--spacing-0`, `--spacing-16`, ... issus de `primitives.json`) : elle reste une variable CSS interne, hors `theme.json`.
- Ne conserver que les **tokens de spacing sémantiques** (ex. `spacing-xs`, `spacing-s`, `spacing-m`, `spacing-l`, `spacing-xl`) présents dans `tokens.json`.
- Pour chaque token conservé :
  - `slug`: le slug du token tel quel (ex. `spacing-s`).
  - `name`: le suffixe du slug (après `spacing-`) tout en majuscules. Exemple : `spacing-s` → `"S"`, `spacing-xs` → `"XS"`.
  - `size`: référence directe à la variable CSS du token, sans l'expression `clamp(...)` sous-jacente (ex. `"var(--spacing-s)"`).
- Si le projet ne fournit pas ces tokens, injecter les valeurs par défaut `spacing-xs`, `spacing-s`, `spacing-m`, `spacing-l`, `spacing-xl` avec les mêmes règles de nommage.
- Inclure `units`: `["px","rem","%","vh","vw"]` et définir `defaultSpacingSizes: false` (ou selon configuration).

> Comme pour les couleurs (section 1), les références `var:preset|spacing|<slug>` utilisées dans `styles` doivent pointer vers un slug de la palette de spacing (ex. `var:preset|spacing|spacing-m`), jamais vers l'échelle brute (`spacing-16`).

---

### 3) Typographie — `settings.typography.fontSizes` & `fontFamilies`

- `fontSizes`: **ne pas inclure les primitives** (`--text-14`, `--text-16`, ... issues de `primitives.json`) : elles restent des variables CSS internes, hors `theme.json`. **Important** : seuls les tokens de taille de police **réellement présents** dans les données extraites de Figma (`tokens.json` → `fonts.fontSize`) doivent figurer — contrairement aux couleurs et aux espacements, aucune valeur par défaut n'est injectée si le projet n'en fournit pas (`fontSizes` reste alors vide).
  - Pour chaque token présent :
    - `slug`: le slug du token tel quel (ex. `text-s`, `text-2-xl`).
    - `name`: le suffixe du slug (après `text-`) tout en majuscules (ex. `text-s` → `"S"`, `text-2-xl` → `"2-XL"`).
    - `size`: référence directe à la variable CSS du token (ex. `"var(--text-s)"`), sans expression `clamp(...)` sous-jacente.
- `fontFamilies`: détecter primitives `--font-*` et -> créer objet `{ name, slug, fontFamily, fontFace? }`.
  - Si `primitives.json` contient métadonnées de fontFace (src, poids, style), inclure `fontFace` comme dans l'exemple (utile pour l'embed).
  - Si `primitives.json` ne fournit **aucune** famille de police projet, injecter uniquement `System` (`system-ui, sans-serif`) et `Mono` (`ui-monospace, monospace`), qui reflètent `--font-base`/`--font-mono` (garanties dans `theme.css`). Ne jamais injecter une famille de police fictive (ex. "Poppins") qui ne correspond à aucun `@font-face` réellement chargé par défaut.
- Respecter les flags : `writingMode`, `defaultFontSizes`, `fluid`, `customFontSize`. Valeurs par défaut : `writingMode: true`, `defaultFontSizes: false`, `fluid: false`, `customFontSize: false`.

**Remarque importante (line-height)** : N'ajoutez **pas** de clé top-level `settings.typography.lineHeights` (ce n'est pas pris en charge par le schéma WordPress). Les tokens de hauteur de ligne doivent rester dans `primitives.json` / `tokens.json` et être référencés depuis les mappings `styles.typography.lineHeight`. Contrairement aux couleurs/spacings/tailles de police, il n'existe pas de variable CSS de hauteur de ligne garantie dans `theme.css` — `--line-height-*` n'est qu'une primitive/token générée par l'extracteur à partir de `tokens.json`/`primitives.json`, absente tant que le projet ne fournit pas ces données.

Le mapping suit donc la même logique que pour `fontSize` (section 3) : référencer `var(--line-height-<size>)` **uniquement si le slug sémantique correspondant existe réellement** dans `tokens.json` (`fonts.lineHeight`), en associant chaque taille de police à la hauteur de ligne de même taille (`text-m` ↔ `line-height-m`, `text-xl` ↔ `line-height-xl`, `text-xxl` ↔ `line-height-xxl`, ...). Si le token n'existe pas, garder la valeur numérique littérale par défaut (`"1.2"` pour le corps et h2, `"1.05"` pour h1) plutôt que d'inventer une référence `var(--line-height-*)`.

---

### 4) Styles par défaut (pré-remplissage)

- Conserver par défaut les mappings `styles.color`, `styles.spacing`, `styles.typography`, `styles.elements` et `styles.blocks` présents dans `examples/theme.json`.
- Le script doit **injecter** ces mappings par défaut si l'utilisateur ne fournit pas de configuration spécifique.
- Les valeurs doivent rester des références `var:preset|...` quand elles pointent vers un preset ou `var(--...)` si elles réfèrent directement à une primitive.
- **`styles.elements` ne doit pas contenir de mapping `link`** : `link`/`link-hover` sont des couleurs exclues de la palette (voir section 1) et ne doivent jamais être référencées dans `theme.json`, ni en `var:preset|color|...` ni en `var(--...)`.

---

### 5) Cas des tokens mobile/desktop (clamp)

- Les tokens mobile/desktop doivent être transmis tels quels (leur `size` est déjà une expression `clamp(var(--left), <intercept>rem + <slope>vw, var(--right))` si l'extracteur a appliqué la règle). Ne pas transformer la formule.
- Si une extrémité manque, utiliser le fallback tel que défini par `clampBetweenModes` (le script d'extraction fournit ces valeurs).

---

### 6) Validation et avertissements

- Vérifier que toutes les références `var(...)` mentionnées existent soit dans `primitives.json`, soit dans `tokens.json`, soit dans la liste des tokens sémantiques connus (`base`, `base-2`, `base-3`, `contrast`, `accent-1`, `accent-2`, `accent-3`, `spacing-xs`, `spacing-s`, `spacing-m`, `spacing-l`, `spacing-xl`, `text-s`, `text-m`, `text-l`, `text-xl`, `text-xxl`, `font-base`, `font-mono`, `font-weight-light`, `font-weight-regular`, `font-weight-semibold`, `font-weight-bold`, `font-weight-extrabold`, `font-weight-black`) qui n'ont pas de primitive correspondante. Lister les références manquantes dans `dist/theme-warnings.json`.
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
  { "name": "Contraste", "color": "var(--contrast)", "slug": "contrast" },
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
  { "name": "XS", "size": "var(--spacing-xs)", "slug": "spacing-xs" },
  { "name": "S", "size": "var(--spacing-s)", "slug": "spacing-s" },
  { "name": "M", "size": "var(--spacing-m)", "slug": "spacing-m" },
  { "name": "L", "size": "var(--spacing-l)", "slug": "spacing-l" },
  { "name": "XL", "size": "var(--spacing-xl)", "slug": "spacing-xl" }
]
```

> Remarque : cette liste est la base minimale — le script doit y ajouter tout token de spacing du projet (`tokens.json`) qui n'est pas déjà représenté. L'échelle brute `--spacing-*` (primitives) n'est jamais ajoutée.

### Typographie — valeurs par défaut

- `writingMode`: `true`
- `defaultFontSizes`: `false`
- `fluid`: `false`
- `customFontSize`: `false`

`fontSizes` d'exemple (uniquement si ces tokens existent réellement dans `tokens.json` — sinon `fontSizes` reste vide) :

```json
[
  { "name": "S", "size": "var(--text-s)", "slug": "text-s" },
  { "name": "M", "size": "var(--text-m)", "slug": "text-m" },
  { "name": "L", "size": "var(--text-l)", "slug": "text-l" }
]
```

`fontFamilies` par défaut — **uniquement** `System`/`Mono` (qui reflètent `--font-base`/`--font-mono`, garantis dans `theme.css`) lorsque `primitives.json` ne fournit aucune famille de police projet. Ne jamais inventer une famille de police (ex. "Poppins") qui ne correspond à aucun `@font-face` réellement chargé par défaut :

```json
[
  { "name": "System", "slug": "system", "fontFamily": "system-ui, sans-serif" },
  { "name": "Mono", "slug": "mono", "fontFamily": "ui-monospace, monospace" }
]
```

> Si `primitives.json` fournit de vraies familles de police projet (ex. une police "Poppins" avec son `fontFace`), les utiliser à la place — voir section 3.

### Mappings `styles`, `elements` et `blocks` par défaut

Le script doit injecter les mappings suivants lorsqu'aucune configuration utilisateur n'est fournie (valeurs identiques à celles suivantes) :

- `fontFamily` : toujours `var(--font-base)` (garanti dans `theme.css`), jamais une référence `var:preset|font-family|<slug>` vers une famille de police non garantie.
- `fontWeight` : toujours `var(--font-weight-regular)` / `var(--font-weight-semibold)` / `var(--font-weight-bold)` selon le cas (garantis dans `theme.css`), jamais une valeur numérique littérale (`"400"`, `"600"`, `"700"`).
- `fontSize` : **omis** si le token correspondant (`text-m` pour le corps, `text-xxl` pour h1, `text-xl` pour h2) n'existe pas réellement dans `tokens.json` — ne jamais inventer une taille par défaut (voir section 3). L'exemple ci-dessous suppose qu'aucun de ces tokens n'est présent.
- `lineHeight` : `var(--line-height-m)` / `var(--line-height-xxl)` / `var(--line-height-xl)` (corps / h1 / h2) si le token sémantique correspondant existe dans `tokens.json` (`fonts.lineHeight`), sinon la valeur littérale par défaut (`"1.2"` / `"1.05"` / `"1.2"`) — voir la remarque de la section 3. L'exemple ci-dessous suppose qu'aucun de ces tokens n'est présent.

```json
"styles": {
  "color": {
    "background": "var:preset|color|base",
    "text": "var:preset|color|contrast"
  },
  "spacing": {
    "blockGap": "var:preset|spacing|spacing-m",
    "padding": { "left": "var:preset|spacing|spacing-m", "right": "var:preset|spacing|spacing-m" }
  },
  "typography": {
    "fontFamily": "var(--font-base)",
    "fontWeight": "var(--font-weight-regular)",
    "lineHeight": "1.2",
    "fontStyle": "normal"
  },
  "elements": {
    "heading": {
      "color": { "text": "var:preset|color|accent-1" },
      "typography": { "fontFamily": "var(--font-base)", "fontWeight": "var(--font-weight-semibold)" }
    },
    "h1": {
      "typography": { "fontFamily": "var(--font-base)", "lineHeight": "1.05", "fontWeight": "var(--font-weight-semibold)" }
    },
    "h2": {
      "typography": { "fontFamily": "var(--font-base)", "lineHeight": "1.2", "fontWeight": "var(--font-weight-semibold)" }
    }
  },
  "blocks": {}
}
```

---

## Format du script proposé (`scripts/generateThemeJson.js`)

1. Lire `dist/primitives.json` et `dist/tokens.json`.
2. Construire :
   - `settings.color.palette` : uniquement les tokens couleur (tokens.json) dont le slug commence par `base`, `contrast` ou `accent` (slug conservé en anglais, name traduit en français et capitalisé — voir section 1), complétés par les valeurs par défaut si absents. Aucune primitive `--color-*` n'est ajoutée.
   - `settings.spacing.spacingSizes` : uniquement les tokens de spacing sémantiques (`tokens.json`), complétés par les valeurs par défaut si absents (voir section 2). Aucune primitive `--spacing-*` n'est ajoutée.
   - `settings.typography.fontSizes` : uniquement les tokens de taille de police réellement présents dans `tokens.json` (aucune valeur par défaut, aucune primitive `--text-*` — voir section 3), et `fontFamilies`.
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
