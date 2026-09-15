# Instructions pour extraire les données JSON de Figma

- L'extraction se fait exclusivement à partir du Mode JSON exporté depuis Figma (bouton Export). Le format d'export est fixe et immuable ; le script doit s'y adapter.
- Procédure : les fichiers JSON exportés depuis Figma doivent être fournis au script (placés par défaut dans `source/`). Le script analyse les fichiers JSON, extrait les primitives dans un fichier JSON corrigé `primitives.json` et les tokens dans un fichier JSON corrigé (`tokens.json`), puis génère un fichier CSS (`theme.css`) contenant les variables CSS correspondantes.

## Définitions

- Une Primitive est une donnée qui fait toujours référence à une valeur brute (nombre, chaîne de caractères, couleur).
- Un Token est une donnée qui fait référence :
  - soit à une Primitive unique (Token simple)
  - soit à deux Primitives différentes selon le mode (Token de mode light/dark ou mobile/desktop).
- Si une donnée est liée à un mode (light/dark ou mobile/desktop), elle est toujours considérée comme un Token, même si elle ne fait pas référence à une Primitive ou si les deux modes référencent la même Primitive. Dans ces cas, le script doit consigner un avertissement.

## Modes

Différents modes peuvent être renseignés dans les données JSON exportées de Figma. Les modes possibles sont :

- aucun mode (alors toutes les données seront des Primitives)
- lightmode (`"mode": "light"`) / darkmode (`"mode": "dark"`)
- mobile (`"mode": "Mobile"`) / desktop (`"mode": "Desktop"`)

La présence de mode est primordiale pour distinguer une primitive d'un token.

## Primitives

Définition : une primitive est une variable qui contient une valeur simple (nombre, chaîne de caractères, booléen).

Les primitives sont toujours présentes, quel que soit le mode.

### Primitives sources

Exemple de primitives présente dans JSON source (taille de police) :

```json
"FontSize": {
    "12": {
      "$type": "number",
      "$value": 12,
      "$extensions": {
        "com.figma.variableId": "VariableID:3744:14704",
        "com.figma.scopes": [
          "FONT_SIZE"
        ],
        "com.figma.isOverride": true
      }
    },
}
```

### Primitives vers JSON corrigé (`primitives.json`)

```json
  "fontSize": {
  "text-16": {
    "$type": "number",
    "value": "16rem",
  },
}
```

### Primitives vers CSS

Les primitives corrigées sont à convertir en variables CSS selon cette convention de nommage (+ exemples) :

- Couleurs : `--color-*`. Exemple: `--color-pink-300: #f9a8d4;`
- Espacements et gouttières : `--spacing-*`. Exemple: `--spacing-16: 1rem;`
- Taille de texte : `--text-*`. Exemple: `--text-16: 1rem;`
- Famille de polices : `--font-*`. Exemple: `--font-poppins: 'Poppins';`
- Graisses de polices : `--font-weight-*`. Exemple: `--font-weight-bold: 700;`
- Hauteurs de ligne : `--line-height-*`. Exemple: `--line-height-28: 1.75rem;`
- Arrondis : `--radius-*`. Exemple: `--radius-lg: 0.5rem;`
- Ombres : `--shadow-*`. Exemple: `--shadow-md: 0 4px 6px...;`
- Z-index : `--z-*`. Exemple: `--z-modal: 1000;`

### Exceptions au nommages de couleurs

Les couleurs suivantes sont à convertir en variables CSS avec un nommage spécifique (pas de préfixe `--color-`) :

```css
--accent-1: …;
--accent-2: …;
--accent-3: …;
--base: …;
--contrast: …;
--base-2: …;
--base-3: …;
--link: …;
--link-hover: …;
--link-active: …;
--selection: …;
```

## Tokens simple

Définition : un token simple référence une seule primitive. Les tokens simples n'existent que dans les cas où aucun mode n'est défini (ni light/dark, ni mobile/desktop).

Remarque : dans le JSON exporté, un token simple n'est pas associé à un `variableId` mais uniquement à une primitive.

- Exemple de token simple de couleur: `"surface": "color-gray-100"`

### Token simple vers JSON corrigé (`primitives.json`)

```json
{
  "surface": {
    "type": "color",
    "value": "var(--color-gray-100)"
  }
}
```

### Tokens simples vers CSS

Les tokens simples sont à convertir en variables CSS selon cette convention de nommage (+ exemples) :

- Couleurs : `--variable-*: var(primitive)`. Exemple: `--base: var(--color-gray-100);`
- Espacements et gouttières : `--spacing-*: var(primitive)`. Exemple: `--spacing-m: var(--spacing-16);`
- Taille de texte : `--text-*: var(primitive)`. Exemple: `--text-m: var(--text-16);`

## Tokens de mode light/dark

Un token light/dark référence une primitive différente selon le mode (light ou dark). Il est recommandé que les deux variantes (light et dark) soient présentes et chaque alias est lié à l'autre à l'aide de l'ID `variableId`. Si une variante est absente dans l'export, le script doit consigner un avertissement et utiliser la valeur disponible comme fallback.

Par exemple, le token suivant :

```json
"base": { "hex": "#FFFFFF", "variableId": "VariableID:3921:10839", "alias": "color/white" },
```

Est lié au token suivant en mode dark :

```json
"base": { "hex": "#111827", "variableId": "VariableID:3921:10839", "alias": "color/gray/900" },
```

Exemple de token light/dark présent dans JSON source (lié à l'autre alias via `variableId`) :

```json
  "base": {
    "$type": "color",
    "$value": {
      "colorSpace": "srgb",
      "components": [
        1,
        1,
        1
      ],
      "alpha": 1,
      "hex": "#FFFFFF"
    },
    "$extensions": {
      "com.figma.variableId": "VariableID:3921:10839",
      "com.figma.scopes": [
        "ALL_SCOPES"
      ],
      "com.figma.aliasData": {
        "targetVariableId": "VariableID:fe453c92bb939b91aa651ddb603d73a94c728f98/-1:-1",
        "targetVariableName": "color/white",
        "targetVariableSetId": "VariableCollectionId:cdf3ea42acf9327a5a506bc9db075d10a398f8c4/-1:-1",
        "targetVariableSetName": "Primitives"
      },
      "com.figma.isOverride": true
    }
  },
```

### Token light/dark vers JSON corrigé (`tokens.json`)

```json
{
  "base": {
    "type": "color",
    "value": "var(--base)",
    "modes": {
      "light": "var(--color-gray-100)",
      "dark": "var(--color-gray-900)"
    }
  }
}
```

### Tokens light/dark vers CSS

Les tokens light/dark sont à convertir en variables CSS via `light-dark()` selon cette convention de nommage (+ exemples) :

- Couleurs : `--variable: light-dark(var(primitive light), var(primitive dark))`. Exemple: `--base: light-dark(var(--color-white), var(--color-gray-900));` ou `--accent-2: light-dark(var(--accent-1), color-mix(in srgb, var(--accent-1), white 20%));`
- Ombres : `--shadow-*: light-dark(var(primitive light), var(primitive dark))`. Exemple: `--shadow-xs: light-dark(var(--shadow-light), var(--shadow-dark));`

## Tokens de mode mobile/desktop

Un token mobile/desktop référence une primitive différente selon le mode (mobile ou desktop). Il est toujours défini avec les deux modes et chaque alias est lié à l'autre à l'aide de l'ID `variableId`.

### Tokens mobile/desktop — EXEMPLE D'EXPORT JSON

Exemple de token mobile/desktop présent dans JSON source (lié à `targetVariableName`) :

```json
"FontSize": {
  "text-xs": {
    "$type": "number",
    "$value": 12,
    "$extensions": {
      "com.figma.variableId": "VariableID:3744:14717",
      "com.figma.scopes": [
        "FONT_SIZE"
      ],
      "com.figma.aliasData": {
        "targetVariableId": "VariableID:07aed26e26444df4bc0f4f041349786ce2d8bf88/-1:-1",
        "targetVariableName": "FontSize/12",
        "targetVariableSetId": "VariableCollectionId:cdf3ea42acf9327a5a506bc9db075d10a398f8c4/-1:-1",
        "targetVariableSetName": "Primitives"
      },
      "com.figma.isOverride": true
    }
  },
}
```

### Tokens mobile/desktop vers JSON corrigé (`tokens.json`)

```json
"text-xs": {
  "type": "number",
  "value": "var(--text-xs)",
  "modes": {
    "desktop": "var(--text-14)",
    "mobile": "var(--text-12)"
  }
},
```

### Tokens mobile/desktop vers CSS

Les tokens mobile/desktop sont à convertir en variables CSS via `clamp()` selon cette convention de nommage (+ exemples).

- Tailles de police : `--text-*: clamp(var(primitive mobile), valeur fluide, var(primitive desktop))`. Exemple: `--text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));`
- Espacements : `--spacing-*: clamp(var(primitive mobile), valeur fluide, var(primitive desktop))`. Exemple: `--spacing-l: clamp(var(--spacing-24), 0.8864rem + 2.2727vw, var(--spacing-48));`
- Hauteurs de ligne : `--line-height-*: clamp(var(primitive mobile), valeur fluide, var(primitive desktop))`. Exemple: `--line-height-4xl: clamp(var(--line-height-40), 2.1087rem + 1.7391vw, var(--line-height-56));`

### Méthode pour calculer la valeur fluide

1. Travailler sur les valeurs en pixels (px) : récupérer la valeur mobile et la valeur desktop en px.
2. Utiliser les points d'arrêt suivants :
   - Mobile : 360px
   - Desktop : 1280px

Formule exacte à appliquer pour produire l'expression "`<intercept>rem + <slope>vw`" qui sera la partie centrale de `clamp()` :

- delta_px = desktop_px - mobile_px
- slope_px_per_vw = (delta_px \* 100) / (max_viewport - min_viewport)
  - (ici max_viewport - min_viewport = 1280 - 360 = 920)
  - `slope_px_per_vw` a l'unité "px per vw" (ex. 0.2174vw représente 0.2174 px par 1vw)
- intercept_px = mobile_px - slope_px_per_vw \* (min_viewport / 100)
  - (on retire la contribution de la partie `vw` au point mobile)
- intercept_rem = intercept_px / 16

Construire la valeur fluide exactement comme :

`clamp(var(--primitive-mobile), <intercept_rem>rem + <slope_px_per_vw>vw, var(--primitive-desktop))`

Arrondissements recommandés : **intercept** → 3 décimales (rem), **slope** → 4 décimales (vw).

Exemple chiffré (pour `--text-m` : mobile = 16px, desktop = 18px) :

- delta_px = 2
- slope_px_per_vw = 2 \* 100 / 920 = 0.217391304... → **0.2174vw**
- intercept_px = 16 - 0.217391304 \* 3.6 = 15.2173913px
- intercept_rem = 15.2173913 / 16 = 0.9510869rem → **0.951rem**

Expression finale :

```css
--text-m: clamp(var(--text-16), 0.951rem + 0.2174vw, var(--text-18));
```

> Remarque : si l'une des extrémités n'est pas résoluble (pas de primitive disponible), retomber sur une valeur de secours (`clampBetweenModes`) est acceptable, mais la méthode ci‑dessus doit être préférée lorsque les primitives existent.

Exemples de ressources pour le calcul des valeurs fluides :

- <https://sindresorhus.com/css-extras/index.css#L329>
- <https://utopia.fyi/clamp/calculator/?a=360,1280>
- <https://elastic.alsacreations.com/>

## Instructions de génération CSS

- Récupérer les données JSON exportées de Figma (Mode JSON export). Vérifier que le JSON contient les sections attendues (couleurs, Spacing, FontSize, etc.). Valider la présence des clés nécessaires et des `$extensions` attendues (p.ex. `com.figma.variableId`) avant de lancer la conversion.

> **Comportement si aucune source fournie :** Si aucun fichier JSON n'est présent dans `source/`, le script **ne doit pas échouer**. Il doit générer quand même `theme.css` (contenant uniquement les **données globales** — commentaire général, color-scheme (light par défaut), couleurs globales, couleurs tokens globales et autres primitives globales), `custom-media.css` (fichier statique, identique dans tous les cas — voir section **Fichier `custom-media.css`**) et `primitives.json` / `tokens.json` (vides ou ne contenant que les valeurs dérivées des données globales). Le script `generateThemeJson.js` doit ensuite pouvoir produire `theme.json` basé sur ces valeurs globales.

### Primitives globales de fallback (si aucune source)

Lorsque `source/` est vide, le script injecte un jeu minimal de primitives globales afin que `theme.css` et `generateThemeJson.js` puissent produire des sorties complètes sans générer d'avertissements de références manquantes. Ces primitives de fallback servent uniquement de valeurs par défaut et sont remplacées si des primitives correspondant sont présentes dans `source/`.

Parmi les primitives injectées par défaut on trouve :

- **Couleurs** (voir étape 5) : `--color-white`, `--color-black`, `--color-slate-100`, `--color-slate-400`, `--color-slate-700`, `--color-slate-800`, `--color-gray-*` (50..900), `--color-error-*`, `--color-success-*`, `--color-warning-*`, `--color-info-*`.
- **Espacements** : `--spacing-0` (0), `--spacing-2` (0.125rem) `--spacing-4` (0.25rem), `--spacing-8` (0.5rem), `--spacing-12` (0.75rem), `--spacing-16` (1rem), `--spacing-24` (1.5rem), `--spacing-32` (2rem), `--spacing-48` (3rem).
- **Tailles de texte** : `--text-14` (0.875rem), `--text-16` (1rem), `--text-18` (1.125rem), `--text-20` (1.25rem), `--text-24` (1.5rem), `--text-30` (1.875rem), `--text-48` (3rem).
- **Hauteurs de ligne** : non spécifiées par défaut.
- **Arrondis** : `--radius-none`, `--radius-4`, `--radius-8`, `--radius-16`, `--radius-24`, `--radius-full`.
- **Autres** : `--font-base` ("system-ui, sans-serif"), `--font-mono` ("ui-monospace, monospace").

Ces valeurs sont des _fallbacks_ : si `source/` contient des primitives correspondantes, elles remplacent ces valeurs par défaut.

- Identifier les primitives et les convertir en variables CSS selon les conventions de nommage.
- Identifier les tokens simples et les convertir en variables CSS.
- Identifier les tokens light/dark et les convertir en variables CSS via `light-dark()`.
- Identifier les tokens mobile/desktop et les convertir en variables CSS via `clamp()`.
- Insérer l'ensemble des variables CSS (primitives et tokens) dans un fichier `theme.css` au sein de `:root { ... }`.
- Vérifier que toutes les variables CSS sont correctement nommées et référencées.
- Séparer les sections de variables CSS par type (couleurs, espacements, typographie, etc.) à l'aide de commentaires CSS pour une meilleure lisibilité.

## Composition précise du fichier `theme.css`

### 1. Débuter par ce commentaire général

```css
/* ----------------------------------
 * Theme du projet
 * ----------------------------------
 */
```

### 2. Les custom breakpoints ne sont PAS insérés dans `theme.css`

Contrairement à une version antérieure de ces instructions, les `@custom-media` ne
font plus partie de `theme.css`. Ils sont générés dans un fichier séparé
`custom-media.css` (voir section **Fichier `custom-media.css`** ci-dessous),
importé sans layer depuis `app.css`.

```css
/* stylelint-disable */
/* Custom Breakpoints */
@custom-media --md (width >= 48rem);
@custom-media --lg (width >= 64rem);
@custom-media --xl (width >= 80rem);
@custom-media --xxl (width >= 96rem);
@custom-media --until-md (width < 48rem);
@custom-media --until-lg (width < 64rem);
@custom-media --until-xl (width < 80rem);
@custom-media --until-xxl (width < 96rem);
/* stylelint-enable */
```

### 3. Insérer le sélecteur racine `:root`

### 4. Définir le mode de couleurs (light et/ou dark)

Au début de `:root` (avant les variables) selon les modes présents dans les données JSON

Cas où les modes light/dark sont présents :

```css
/* Theme (color-scheme) */
color-scheme: light dark;

&[data-theme="light"] {
  color-scheme: light;
}

&[data-theme="dark"] {
  color-scheme: dark;
}
```

Cas où les modes light/dark ne sont pas présents :

```css
/* Theme (color-scheme) */
color-scheme: light;

&[data-theme="light"] {
  color-scheme: light;
}

&[data-theme="dark"] {
  color-scheme: dark;
}
```

### 5. Couleurs Primitives CSS **globales** (= communes à tous les projets)

Présentes dans tous les cas et tous les themes, même si non présentes dans les données JSON exportées de Figma.

> **Notation** : toutes les couleurs (primitives et tokens) sont exprimées en notation hexadécimale (`#RRGGBB` / `#RRGGBBAA`), jamais en `oklch()`. Figma ne propose pas nativement la notation OKLCH, ce qui crée des divergences entre les valeurs vues par les designers et celles produites par le script. Les ajustements dynamiques (éclaircir/assombrir une couleur runtime comme `--accent-1`) utilisent `color-mix(in srgb, ...)` plutôt que la syntaxe de couleur relative `oklch(from ...)`.

Les couleurs globales à inclure sont les suivantes, **si elles sont présentes dans les données JSON exportées de Figma, elles doivent être remplacées par les valeurs extraites**:

```css
/* Couleurs Primitives globales */
--color-white: #FFFFFF;
--color-black: #000000;
--color-slate-100: #F1F5F9;
--color-slate-400: #90A1B9;
--color-slate-700: #314158;
--color-slate-800: #161F2C;
--color-gray-50: #F5F5F5;
--color-gray-100: #E5E5E5;
--color-gray-200: #D4D4D4;
--color-gray-300: #A1A1A1;
--color-gray-400: #737373;
--color-gray-500: #525252;
--color-gray-600: #404040;
--color-gray-700: #262626;
--color-gray-800: #171717;
--color-gray-900: #0A0A0A;
--color-error-100: #FFECE8;
--color-error-300: #FF675A;
--color-error-500: #B91D1C;
--color-error-700: #7C0000;
--color-error-900: #3A0000;
--color-success-100: #AAFFBF;
--color-success-300: #60BA78;
--color-success-500: #187C3E;
--color-success-700: #005013;
--color-success-900: #002401;
--color-warning-100: #FFEEDD;
--color-warning-300: #FFAE79;
--color-warning-500: #D76300;
--color-warning-700: #9D3B00;
--color-warning-900: #5F1D00;
--color-info-100: #E6F7FF;
--color-info-300: #53A2FF;
--color-info-500: #0063CB;
--color-info-700: #003498;
--color-info-900: #00134A;
```

### 6. Couleurs Primitives du projet (contenues dans `primitives.json`)

Si ces données sont présentes dans le JSON source, débuter la section par ce commentaire :

```css
/* Couleurs Primitives du projet */
```

### 7. Couleurs Tokens globales (= communes à tous les projets)

Les couleurs suivantes sont à ajouter à `theme.css` en tant que variables CSS globales avec les commentaires, **si elles sont présentes dans les données JSON exportées de Figma, elles doivent être remplacées par les valeurs extraites** :

> **Règle light/dark** : nos projets n'ont que très rarement un vrai mode sombre. Le `light-dark()` n'est donc généré pour ces tokens globaux que si les données JSON exportées de Figma contiennent effectivement des fichiers en mode `light` **et** `dark`. Par défaut (aucun mode détecté dans `source/`), seule la valeur "light" est émise, sans enveloppe `light-dark()`. La fonctionnalité s'active donc automatiquement dès que le projet en a besoin, sans configuration manuelle.

**Cas par défaut (aucun mode light/dark dans la source)** :

```css
/* Couleurs Tokens globales */
/* Couleurs d'accent */
--accent-1: var(--color-gray-500);
--accent-2: var(--accent-1);
--accent-3: color-mix(in srgb, var(--accent-1), white 20%);

/* Base */
--base: var(--color-white);
--contrast: var(--color-gray-900);
--base-2: var(--color-gray-50);
--base-3: var(--color-gray-100);

/* Interactions */
--link: var(--accent-1);
--link-hover: color-mix(in srgb, var(--accent-1), black 20%);
--link-active: color-mix(in srgb, var(--accent-1), black 20%);

/* Couleur de sélection */
--selection: color-mix(in srgb, var(--accent-1), white 20%);
```

**Cas où le projet définit des modes light/dark** (fichiers `source/` en mode `light` et `dark`) :

```css
/* Couleurs Tokens globales */
/* Couleurs d'accent */
--accent-1: var(--color-gray-500);
--accent-2: light-dark(var(--accent-1), color-mix(in srgb, var(--accent-1), white 20%));
--accent-3: light-dark(color-mix(in srgb, var(--accent-1), white 20%), var(--accent-1));

/* Base */
--base: light-dark(var(--color-white), var(--color-gray-900));
--contrast: light-dark(var(--color-gray-900), var(--color-gray-100));
--base-2: light-dark(var(--color-gray-50), var(--color-gray-800));
--base-3: light-dark(var(--color-gray-100), var(--color-gray-700));

/* Interactions */
--link: light-dark(var(--accent-1), color-mix(in srgb, var(--accent-1), white 20%));
--link-hover: light-dark(color-mix(in srgb, var(--accent-1), black 20%), var(--accent-1));
--link-active: light-dark(color-mix(in srgb, var(--accent-1), black 20%), var(--accent-1));

/* Couleur de sélection */
--selection: light-dark(color-mix(in srgb, var(--accent-1), white 20%), color-mix(in srgb, var(--accent-1), black 20%));
```

### 8. Couleurs Tokens du projet (contenus dans `tokens.json`)

Si ces données sont présentes dans le JSON source, débuter la section par ce commentaire :

```css
/* Couleurs Tokens du projet */
```

### 9. Autres Primitives CSS globales (= communes à tous les projets)

Autres variables CSS globales à inclure dans tous les thèmes, **si elles sont présentes dans les données JSON exportées de Figma, elles doivent être remplacées par les valeurs extraites** :

```css
/* Autres Primitives globales */
/* Transitions et animations */
--transition-duration: 250ms;

/* Niveaux de z-index */
--z-under-page-level: -1;
--z-above-page-level: 1;
--z-header-level: 1000;
--z-above-header-level: 2000;
--z-above-all-level: 3000;

/* Border radius */
--radius-none: 0;
--radius-4: 0.25rem;
--radius-8: 0.5rem;
--radius-16: 1rem;
--radius-24: 1.5rem;
--radius-full: 9999px;

/* Familles de police */
--font-base: system-ui, sans-serif;
--font-mono: ui-monospace, monospace;

/* Graisses de police */
--font-weight-light: 300;
--font-weight-regular: 400;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--font-weight-extrabold: 800;
--font-weight-black: 900;
```

> **Note**: Ces valeurs de police sont exposées via des variables CSS globales (`--font-base`, `--font-mono`, `--font-weight-*`). Pour rester compatible avec le schéma `theme.json` de WordPress, **évitez d'ajouter des propriétés personnalisées non standard dans `settings.typography`** ; référencez plutôt ces variables depuis `styles.typography` (par exemple : `fontFamily: "var(--font-base)"`, `fontWeight: "var(--font-weight-regular)"`).

### 10. Espacements Primitives du projet (contenus dans `primitives.json`)

Si ces données sont présentes dans le JSON source, débuter la section par ce commentaire :

```css
/* Espacements Primitives du projet */
```

### 11. Espacements Tokens du projet (contenus dans `tokens.json`)

Si ces données sont présentes dans le JSON source, débuter la section par ce commentaire :

```css
/* Espacements Tokens du projet */
```

### 12. Typographie Primitives du projet (contenus dans `primitives.json`)

Si ces données sont présentes dans le JSON source, débuter la section par ce commentaire :

```css
/* Typographie Primitives du projet */
```

### 13. Typographie Tokens du projet (contenus dans `tokens.json`)

Si ces données sont présentes dans le JSON source, débuter la section par ce commentaire :

```css
/* Typographie Tokens du projet */
```

## Fichier `custom-media.css`

Les breakpoints `@custom-media` (voir section 2) ne sont **jamais** insérés dans
`theme.css` : ils sont écrits dans un fichier dédié `custom-media.css`, généré
systématiquement en sortie à côté de `theme.css`, `primitives.json` et
`tokens.json` — y compris dans le cas « aucune source fournie » (fichier
statique, identique à chaque génération).

- **Dans `app.css`** : importé **sans layer** (`@import "custom-media.css";`),
  placé dans le même bloc que les autres `@import`, juste après la
  déclaration `@layer config, base, components, utilities;` — ne jamais
  scinder ce bloc en deux. **Important** : la déclaration `@layer` doit rester
  en tête de fichier, **immédiatement suivie d'un bloc ininterrompu de
  `@import`** (custom-media.css compris). Un `@import` placé **avant** cette
  déclaration `@layer` — la coupant donc en deux groupes d'`@import` séparés
  par le `@layer` — invalide silencieusement tous les `@import` qui suivent :
  le navigateur ne les requête même plus (constaté en production : reset.css,
  natives.css, layouts.css, theme.css, styles.css, utilities.css et anime.css
  n'étaient plus chargés du tout, page totalement non stylée). Un `@layer`
  seul en tête suivi d'un bloc ininterrompu d'`@import` fonctionne en
  revanche normalement.
- **Dans le kit téléchargeable** : `custom-media.css` doit systématiquement
  figurer parmi les fichiers du kit (au même titre que `theme.css`,
  `styles.css`, `utilities.css` et `app.css`), qu'il s'agisse du kit généré
  par le CLI (`figmatocss.js`, dossier de sortie) ou du kit ZIP téléchargeable
  depuis l'outil web.
