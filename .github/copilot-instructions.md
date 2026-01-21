# Instructions Copilot - Primary

## Vue d'ensemble du projet

**Primary** est une application web de génération de fichiers CSS `theme-tokens.css` pour les projets Alsacréations.

**Stack technique :**

- HTML sémantique
- CSS moderne vanilla (pas de framework)
- JavaScript vanilla (pas de framework)
- Respect strict des guidelines CSS d'Alsacréations

**Objectif :** Permettre à l'utilisateur de configurer et générer un fichier de tokens CSS personnalisé avec :

- Choix du thème (light uniquement, dark uniquement, ou les deux avec `light-dark()`)
- Typographie responsive ou fixe
- Espacements responsive ou fixes
- Couleur primaire personnalisable
- Possibilité d'ajouter des variables de couleurs personnalisées

## Fonctionnement de l'application

L'application s'articule en **3 étapes** :

### 1. Sources

- Affichage du fichier `theme.css` (non modifiable, en lecture seule)
- Textarea permettant à l'utilisateur d'ajouter des variables de couleurs personnalisées

### 2. Configuration

- **Couleur primaire** : Sélection parmi les couleurs disponibles dans le theme
- **Mode thème** :
  - Light uniquement
  - Dark uniquement
  - Light et dark (avec `light-dark()`)
- **Typographie** : Responsive (avec `clamp()`) ou fixe
- **Espacements** : Responsive (avec `clamp()`) ou fixes

### 3. Génération et téléchargement

- Affichage du contenu généré `theme-tokens.css` complet
- Bouton de téléchargement du fichier
- Copie possible dans le presse-papier (optionnel)

## Principes fondamentaux

### Accessibilité (RGAA)

**L'accessibilité est une priorité absolue** dans ce projet :

- ✅ Respecter les normes RGAA (Référentiel Général d'Amélioration de l'Accessibilité)
- ✅ HTML sémantique obligatoire (`<header>`, `<nav>`, `<main>`, `<section>`, etc.)
- ✅ Attributs ARIA appropriés (uniquement quand nécessaire)
- ✅ Labels explicites pour tous les formulaires
- ✅ Contraste de couleurs conforme (ratio minimum 4.5:1 pour texte normal, 3:1 pour texte large)
- ✅ Navigation au clavier complète et logique
- ✅ Focus visible sur tous les éléments interactifs
- ✅ Messages d'erreur clairs et associés aux champs
- ✅ Textes alternatifs pour les images informatives
- ✅ Structure de titres hiérarchique (`<h1>` → `<h2>` → `<h3>`)

### Langue et commits

**Tous les messages de commit doivent être en français** et suivre le format **Conventional Commits** :

**Format :** `type(scope): message conjugué`

**Types principaux :**

- `feat` ✨ : Ajout d'une nouvelle fonctionnalité
- `fix` 🐛 : Correction d'un bug
- `refactor` 📦 : Refactorisation du code sans changement fonctionnel
- `style` 💎 : Modifications de formatage (espaces, indentation, point-virgules)
- `docs` 📚 : Documentation
- `chore` ♻️ : Tâches de maintenance
- `perf` 🚀 : Amélioration des performances
- `test` 🚨 : Ajout ou correction de tests
- `build` 🛠 : Modifications du système de build ou dépendances
- `ci` ⚙️ : Modifications de la configuration CI
- `revert` 🗑 : Annulation d'un commit précédent

```bash
# ✅ BON
git commit -m "feat(generator): ajoute le sélecteur de couleur primaire ✨"
git commit -m "fix(theme): corrige le contraste en mode sombre 🐛"
git commit -m "refactor(tokens): optimise la génération des tokens 📦"
git commit -m "style(app): corrige l'indentation et les espaces 💎"
git commit -m "docs(readme): complète les instructions d'installation 📚"
git commit -m "perf(generator): améliore la vitesse de génération CSS 🚀"
git commit -m "test(utils): ajoute les tests unitaires 🚨"
git commit -m "build(deps): met à jour les dépendances 🛠"
git commit -m "ci(actions): configure les GitHub Actions ⚙️"

# ❌ MAUVAIS
git commit -m "Add primary color picker"
git commit -m "Fix dark mode contrast"
git commit -m "Ajout du sélecteur" # Manque type(scope)
git commit -m "feat(generator): Ajoute..." # Majuscule incorrecte
```

## Architecture CSS obligatoire

### Cascade Layers

Toujours utiliser cet ordre de priorité :

```css
@layer config, base, components, utilities;
```

### Structure des fichiers

```
assets/css/
├── reset.css         # Reset CSS
├── theme.css         # Variables primitives (immuables)
├── layouts.css       # Bretzel Layouts
├── natives.css       # Styles éléments natifs
└── app.css           # Point d'entrée
```

## Système de variables CSS (2 niveaux)

### 1. Variables primitives (`theme.css`)

**NE JAMAIS MODIFIER** - Valeurs brutes issues de l'UI Kit :

```css
:root {
  /* Couleurs */
  --color-info-500: oklch(51.33% 0.18 256.37);
  --color-gray-900: oklch(14.5% 0 0);

  /* Espacements */
  --spacing-16: 1rem;
  --spacing-32: 2rem;

  /* Typographie */
  --text-16: 1rem;
  --text-18: 1.125rem;
}
```

### 2. Tokens sémantiques (`theme-tokens.css`)

**FICHIER GÉNÉRÉ** - Rôles fonctionnels assignés aux primitives :

```css
:root {
  /* Couleurs sémantiques */
  --primary: var(--color-info-500);
  --on-primary: var(--color-white);
  --surface: light-dark(var(--color-white), var(--color-gray-900));
  --on-surface: light-dark(var(--color-gray-900), var(--color-white));

  /* Typographie responsive */
  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));

  /* Espacements responsive */
  --spacing-m: clamp(
    var(--spacing-16),
    0.5909rem + 1.8182vw,
    var(--spacing-32)
  );
}
```

## Conventions de nommage

### Classes CSS

**BEM adapté :**

```css
/* Block */
.generator {
}

/* Element */
.generator-section {
}
.generator-title {
}

/* Modifier */
.generator--compact {
}

/* État */
.is-active {
}
.is-loading {
}
.has-error {
}
```

**❌ À éviter :**

- Sélecteurs d'ID : `#generator`
- Sélecteurs d'éléments génériques : `div`, `span`
- Nesting profond (> 1 niveau)

### Nesting CSS natif

**✅ Autorisé uniquement pour :**

```css
.button {
  /* Styles de base */

  &:hover,
  &:focus {
    /* États interactifs */
  }

  &::before {
    /* Pseudo-éléments */
  }

  @media (width >= 48rem) {
    /* Media queries */
  }
}
```

**❌ Interdit :**

```css
.parent {
  & .child {
    & .subchild {
      /* NON ! Trop profond */
    }
  }
}
```

## Thématisation (Light/Dark Mode)

### Fonction `light-dark()`

**Toujours utiliser** cette syntaxe moderne :

```css
:root {
  color-scheme: light dark;

  &[data-theme="light"] {
    color-scheme: light;
  }

  &[data-theme="dark"] {
    color-scheme: dark;
  }

  --surface: light-dark(#ffffff, #1a1a1a);
  --on-surface: light-dark(#000000, #ffffff);
}
```

### Gestion du theme switcher

**JavaScript :**

```javascript
document.documentElement.setAttribute("data-theme", "dark");
```

## Layouts prioritaires

### 1. Bretzel Layouts (PRIORITÉ 1)

**Toujours privilégier** les layouts Bretzel via attributs `data-layout` :

| Layout     | Usage                        | Attribut                 |
| ---------- | ---------------------------- | ------------------------ |
| `stack`    | Empilement vertical          | `data-layout="stack"`    |
| `cluster`  | Groupe d'éléments wrappables | `data-layout="cluster"`  |
| `autogrid` | Grille fluide responsive     | `data-layout="autogrid"` |
| `switcher` | 1 col → plusieurs cols       | `data-layout="switcher"` |
| `duo`      | 2 panneaux côte à côte       | `data-layout="duo"`      |
| `repel`    | Gauche vs droite             | `data-layout="repel"`    |
| `reel`     | Scroll horizontal            | `data-layout="reel"`     |
| `boxed`    | Contenu centré max-width     | `data-layout="boxed"`    |

**Modificateurs communs :**

- `data-gap="s|m|l|xl|none"`
- `data-justify="start|end|center|space"`
- `data-align="start|end|center|stretch"`

**Exemple :**

```html
<form data-layout="stack" data-gap="m">
  <div data-layout="cluster" data-gap="s">
    <button>Valider</button>
    <button>Annuler</button>
  </div>
</form>
```

### 2. Grid Layout (PRIORITÉ 2)

Seulement si Bretzel insuffisant :

```css
.complex-layout {
  display: grid;
  grid-template-areas: "header header" "sidebar main";
}
```

### 3. Flexbox (PRIORITÉ 3)

En dernier recours pour layouts spécifiques.

## Responsive Design

### Mobile First OBLIGATOIRE

```css
/* ✅ BON : Mobile First */
.component {
  display: block;

  @media (width >= 48rem) {
    display: grid;
  }
}

/* ❌ MAUVAIS : Desktop First */
.component {
  display: grid;

  @media (width < 48rem) {
    display: block;
  }
}
```

### Breakpoints standardisés

```css
/* Utiliser rem uniquement */
@media (width >= 48rem) {
  /* 768px - Tablette */
}
@media (width >= 64rem) {
  /* 1024px - Desktop */
}
@media (width >= 80rem) {
  /* 1280px - Large Desktop */
}
```

## Typographie

### Utiliser clamp() pour fluidité

```css
:root {
  /* Source : https://utopia.fyi/clamp/calculator/ */
  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));
}
```

### Préférer police système

```css
body {
  font-family: system-ui, sans-serif; /* Performance optimale */
}
```

### Chargement de polices personnalisées

```css
@font-face {
  font-family: "Custom";
  src: url("custom.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap; /* Évite FOIT */
}
```

## Ordre des propriétés CSS (SMACSS)

**Automatique via Stylelint**, mais à connaître :

```css
.element {
  /* 1. Positionnement */
  position: absolute;
  top: 0;
  z-index: 10;

  /* 2. Modèle de boîte */
  display: flex;
  width: 100%;
  padding: 1rem;
  margin: 0 auto;

  /* 3. Typographie */
  font-family: var(--font-base);
  font-size: var(--text-m);
  color: var(--on-surface);

  /* 4. Décoration */
  background: var(--surface);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-16);

  /* 5. Animations */
  transition: transform 0.2s ease;

  /* 6. Autres */
  cursor: pointer;
}
```

## Optimisation des performances

### Animations

```css
/* ✅ Animer uniquement transform et opacity */
.animated {
  transition: transform 0.3s ease, opacity 0.3s ease;
  will-change: transform, opacity;
}

/* ❌ Éviter propriétés coûteuses */
.laggy {
  transition: width 0.3s, height 0.3s; /* NON ! */
}
```

### SVG adaptatif

```css
.icon {
  fill: currentcolor; /* Suit la couleur du texte */
  stroke: light-dark(var(--color-black), var(--color-white));
}
```

## JavaScript vanilla

### Sélection d'éléments

```javascript
// ✅ Préférer querySelector
const form = document.querySelector(".generator-form");
const inputs = document.querySelectorAll('input[type="radio"]');

// ✅ Utiliser dataset pour data-attributes
element.dataset.theme = "dark";
```

### Gestion des événements

```javascript
// ✅ Délégation d'événements
form.addEventListener("submit", (e) => {
  e.preventDefault();
  // ...
});

// ✅ Event listeners modernes
input.addEventListener("change", ({ target }) => {});
```

### Manipulation du DOM

```javascript
// ✅ Template literals pour HTML
element.innerHTML = `
  <div class="result">
    <h2>${title}</h2>
  </div>
`;

// ✅ classList API
element.classList.add("is-active");
element.classList.toggle("is-visible");
```

## Génération du fichier theme-tokens.css

### Structure attendue

```css
/* ----------------------------------
 * Primary par Alsacréations
 * Nécessite les variables CSS primaires (theme.css)
 * Généré par le script de génération de tokens
 * Configuration :
 * - Couleur primaire : [valeur]
 * - Theme light et dark : [oui/non]
 * - Typographie responsive : [oui/non]
 * - Espacements responsive : [oui/non]
 * ----------------------------------
 */

:root {
  /* Color Tokens */
  color-scheme: light dark;

  --primary: var(--color-info-500);
  --on-primary: var(--color-white);
  --surface: light-dark(var(--color-white), var(--color-gray-900));
  /* ... */

  /* Typo Tokens */
  --text-m: clamp(var(--text-16), 0.9565rem + 0.2174vw, var(--text-18));
  /* ... */

  /* Spacing Tokens */
  --spacing-m: clamp(
    var(--spacing-16),
    0.5909rem + 1.8182vw,
    var(--spacing-32)
  );
  /* ... */
}
```

## Bonnes pratiques générales

### ✅ À FAIRE

- Utiliser les tokens sémantiques dans les composants
- Commenter les sections importantes
- Tester en light ET dark mode
- Valider avec Stylelint
- Utiliser `rem` pour les tailles
- Mobile First systématiquement
- Bretzel Layouts en priorité

### ❌ À ÉVITER

- Valeurs en dur (couleurs, tailles)
- `!important` (sauf cas exceptionnel)
- Sélecteurs d'ID
- Nesting profond (> 1 niveau)
- `px` pour les breakpoints
- Desktop First
- Grid/Flexbox si Bretzel suffit

## Ressources

- [Guidelines CSS complètes](guidelines-css.md)
- [Bretzel Layouts](https://bretzel.alsacreations.com/)
- [Utopia Fluid Type](https://utopia.fyi/clamp/calculator/)
- [light-dark() MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)

## Configuration Stylelint

Le projet utilise Stylelint avec :

- `stylelint-config-standard`
- `stylelint-order` (ordre SMACSS automatique)
- Support du nesting CSS natif

Lancer la vérification :

```bash
npm run lint:css
```
