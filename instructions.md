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
--primary: …;
--on-primary: …;
--primary-lighten: …;
--primary-darken: …;
--accent: …;
--accent-invert: …;
--surface: …;
--on-surface: …;
--layer-1: …;
--layer-2: …;
--layer-3: …;
--link: …;
--link-hover: …;
--link-active: …;
--selection: …;
--warning: …;
--error: …;
--success: …;
--info: …;
--border-light: …;
--border-medium: …;
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

- Couleurs : `--variable-*: var(primitive)`. Exemple: `--surface: var(--color-gray-100);`
- Espacements et gouttières : `--spacing-*: var(primitive)`. Exemple: `--spacing-m: var(--spacing-16);`
- Taille de texte : `--text-*: var(primitive)`. Exemple: `--text-m: var(--text-16);`

## Tokens de mode light/dark

Un token light/dark référence une primitive différente selon le mode (light ou dark). Il est recommandé que les deux variantes (light et dark) soient présentes et chaque alias est lié à l'autre à l'aide de l'ID `variableId`. Si une variante est absente dans l'export, le script doit consigner un avertissement et utiliser la valeur disponible comme fallback.

Par exemple, le token suivant :

```json
"surface": { "hex": "#FFFFFF", "variableId": "VariableID:3921:10839", "alias": "color/white" },
```

Est lié au token suivant en mode dark :

```json
"surface": { "hex": "#111827", "variableId": "VariableID:3921:10839", "alias": "color/gray/900" },
```

Exemple de token light/dark présent dans JSON source (lié à l'autre alias via `variableId`) :

```json
  "surface": {
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
  "surface": {
    "type": "color",
    "value": "var(--surface)",
    "modes": {
      "light": "var(--color-gray-100)",
      "dark": "var(--color-gray-900)"
    }
  }
}
```

### Tokens light/dark vers CSS

Les tokens light/dark sont à convertir en variables CSS via `light-dark()` selon cette convention de nommage (+ exemples) :

- Couleurs : `--variable: light-dark(var(primitive light), var(primitive dark))`. Exemple: `--surface: light-dark(var(--color-white), var(--color-gray-900));` ou `--accent: light-dark(var(--primary), var(--primary-lighten));`
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

> **Comportement si aucune source fournie :** Si aucun fichier JSON n'est présent dans `source/`, le script **ne doit pas échouer**. Il doit générer quand même `theme.css` (contenant uniquement les **données globales** — commentaire général, custom breakpoints, color-scheme (light par défaut), couleurs globales, couleurs tokens globales et autres primitives globales) et `primitives.json` / `tokens.json` (vides ou ne contenant que les valeurs dérivées des données globales). Le script `generateThemeJson.js` doit ensuite pouvoir produire `theme.json` basé sur ces valeurs globales.

### Primitives globales de fallback (si aucune source)

Lorsque `source/` est vide, le script injecte un jeu minimal de primitives globales afin que `theme.css` et `generateThemeJson.js` puissent produire des sorties complètes sans générer d'avertissements de références manquantes. Ces primitives de fallback servent uniquement de valeurs par défaut et sont remplacées si des primitives correspondant sont présentes dans `source/`.

Parmi les primitives injectées par défaut on trouve :

- **Couleurs** (voir étape 5) : `--color-white`, `--color-black`, `--color-gray-*` (50..900), `--color-error-*`, `--color-success-*`, `--color-warning-*`, `--color-info-*`.
- **Espacements** : `--spacing-0` (0), `--spacing-2` (0.125rem) `--spacing-4` (0.25rem), `--spacing-8` (0.5rem), `--spacing-12` (0.75rem), `--spacing-16` (1rem), `--spacing-24` (1.5rem), `--spacing-32` (2rem), `--spacing-48` (3rem).
- **Tailles de texte** : `--text-14` (0.875rem), `--text-16` (1rem), `--text-18` (1.125rem), `--text-20` (1.25rem), `--text-24` (1.5rem), `--text-30` (1.875rem), `--text-48` (3rem).
- **Hauteurs de ligne** : non spécifiées par défaut.
- **Arrondis** : `--radius-none`, `--radius-4`, `--radius-8`, `--radius-12`, `--radius-16`, `--radius-24`, `--radius-full`.
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

### 2. Insérer les custom breakpoints après le commentaire général

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

Les couleurs globales à inclure sont les suivantes, **si elles sont présentes dans les données JSON exportées de Figma, elles doivent être remplacées par les valeurs extraites**:

```css
/* Couleurs Primitives globales */
--color-white: oklch(1 0 0);
--color-black: oklch(0 0 0);
--color-gray-50: oklch(0.97 0 0);
--color-gray-100: oklch(0.922 0 0);
--color-gray-200: oklch(0.87 0 0);
--color-gray-300: oklch(0.708 0 0);
--color-gray-400: oklch(0.556 0 0);
--color-gray-500: oklch(0.439 0 0);
--color-gray-600: oklch(0.371 0 0);
--color-gray-700: oklch(0.269 0 0);
--color-gray-800: oklch(0.205 0 0);
--color-gray-900: oklch(0.145 0 0);
--color-error-100: oklch(0.97 0.1 27.52);
--color-error-300: oklch(0.7054 0.19 27.52);
--color-error-500: oklch(0.5054 0.19 27.52);
--color-error-700: oklch(0.3554 0.19 27.52);
--color-error-900: oklch(0.2054 0.11 27.52);
--color-success-100: oklch(0.9446 0.13 150.685);
--color-success-300: oklch(0.7166 0.13 150.73);
--color-success-500: oklch(0.5166 0.13 150.73);
--color-success-700: oklch(0.3666 0.13 150.73);
--color-success-900: oklch(0.2166 0.13 150.73);
--color-warning-100: oklch(0.97 0.08 49.95);
--color-warning-300: oklch(0.8315 0.17 49.95);
--color-warning-500: oklch(0.6315 0.17 49.95);
--color-warning-700: oklch(0.4815 0.17 49.95);
--color-warning-900: oklch(0.3315 0.11 49.95);
--color-info-100: oklch(0.97 0.09 256.37);
--color-info-300: oklch(0.7133 0.18 256.37);
--color-info-500: oklch(0.5133 0.18 256.37);
--color-info-700: oklch(0.3633 0.18 256.37);
--color-info-900: oklch(0.2133 0.11 256.37);
```

### 6. Couleurs Primitives du projet (contenues dans `primitives.json`)

Si ces données sont présentes dans le JSON source, débuter la section par ce commentaire :

```css
/* Couleurs Primitives du projet */
```

### 7. Couleurs Tokens globales (= communes à tous les projets)

Les couleurs suivantes sont à ajouter à `theme.css` en tant que variables CSS globales avec les commentaires, **si elles sont présentes dans les données JSON exportées de Figma, elles doivent être remplacées par les valeurs extraites** :

```css
/* Couleurs Tokens globales */
/* Couleur primaire */
--primary: var(--color-gray-500);
--on-primary: var(--color-white);
--primary-lighten: oklch(from var(--primary) calc(l * 1.2) c h);
--primary-darken: oklch(from var(--primary) calc(l * 0.8) c h);

/* Couleur d'accent */
--accent: light-dark(var(--primary), var(--primary-lighten));
--accent-invert: light-dark(var(--primary-lighten), var(--primary));

/* Surface du document */
--surface: light-dark(var(--color-white), var(--color-gray-900));
--on-surface: light-dark(var(--color-gray-900), var(--color-gray-100));

/* Niveaux de profondeur */
--layer-1: light-dark(var(--color-gray-50), var(--color-gray-800));
--layer-2: light-dark(var(--color-gray-100), var(--color-gray-700));
--layer-3: light-dark(var(--color-gray-200), var(--color-gray-600));

/* Interactions */
--link: light-dark(var(--primary), var(--primary-lighten));
--link-hover: light-dark(var(--primary-darken), var(--primary));
--link-active: light-dark(var(--primary-darken), var(--primary));

/* Couleur de sélection */
--selection: light-dark(var(--primary-lighten), var(--primary-darken));

/* États d'alerte */
--warning: light-dark(var(--color-warning-500), var(--color-warning-300));
--error: light-dark(var(--color-error-500), var(--color-error-300));
--success: light-dark(var(--color-success-500), var(--color-success-300));
--info: light-dark(var(--color-info-500), var(--color-info-300));

/* Bordures */
--border-light: var(--color-gray-400);
--border-medium: var(--color-gray-600);
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
--radius-12: 0.75rem;
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
