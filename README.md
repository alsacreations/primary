# Primary - Générateur de CSS Alsacréations

**Primary** est un outil de génération de fichiers CSS personnalisés pour vos projets Alsacréations. Il permet de configurer et télécharger un kit CSS complet avec tokens, thématisation et layouts.

## 🎯 Pour qui ?

Cet outil est destiné aux **intégrateurs chez Alsacréations** pour démarrer rapidement leurs projets avec une base CSS cohérente et personnalisable.

## 🚀 Utilisation

### Accès

Rendez-vous sur : [**primary.alsacreations.com**](https://primary.alsacreations.com)

### Étapes de configuration

#### 1️⃣ Sources

- Consultez le fichier `theme.css` contenant toutes les **variables CSS primitives** (couleurs, espacements, typographie)
- Ajoutez vos **variables personnalisées** si nécessaire dans la zone de texte

#### 2️⃣ Configuration

Personnalisez votre thème selon vos besoins :

- **Couleur primaire** : Choisissez parmi les couleurs disponibles (blue, red, green, orange)
- **Mode thème** :
  - Light uniquement
  - Dark uniquement
  - Light et Dark (avec fonction `light-dark()`)
- **Typographie** : Responsive (avec `clamp()`) ou fixe
- **Espacements** : Responsive (avec `clamp()`) ou fixes
- **Police de caractères** : Système ou Poppins

#### 3️⃣ Génération

- Visualisez tous les fichiers CSS générés avec coloration syntaxique
- Copiez individuellement chaque fichier si besoin
- **Téléchargez le kit complet** en un clic (fichier `primary-css.zip`)

## 📦 Contenu du kit téléchargé

Le fichier `primary-css.zip` contient une architecture complète :

```text
css/
├── app.css              # Point d'entrée avec @import et @layer
├── reset.css            # Reset CSS (Alsacréations)
├── theme.css            # Variables primitives
├── theme-tokens.css     # Tokens sémantiques générés
├── layouts.css          # Bretzel Layouts
├── natives.css          # Styles éléments natifs (KNACSS)
├── styles.css           # Styles de base (selon config police)
└── fonts/               # Police Poppins (si sélectionnée)
    └── Poppins-Variable-opti.woff2
```

## 🔧 Intégration dans votre projet

### 1. Extraire le ZIP

Décompressez `primary-css.zip` à la racine de votre projet.

### 2. Importer dans votre HTML

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="css/app.css" />
  </head>
  <body>
    <!-- Votre contenu -->
  </body>
</html>
```

### 3. Personnaliser si besoin

- **Ajouter des composants** : Créez vos fichiers dans le layer `components`
- **Ajouter des utilitaires** : Créez vos fichiers dans le layer `utilities`
- **Modifier les tokens** : Éditez `theme-tokens.css` selon vos besoins

## 📚 Ressources

- [Guidelines CSS Alsacréations](guidelines-css.md)
- [Bretzel Layouts](https://bretzel.alsacreations.com/)
- [KNACSS](https://knacss.com/)
- [Reset CSS Alsacréations](https://reset.alsacreations.com/)

## ⚡ Fichiers toujours à jour

Les fichiers suivants sont **automatiquement récupérés** depuis leurs sources officielles à chaque utilisation :

- `reset.css` → [reset.alsacreations.com](https://reset.alsacreations.com/public/reset.css)
- `layouts.css` → [Bretzel GitHub](https://github.com/alsacreations/bretzel)
- `natives.css` → [knacss.com](https://knacss.com/css/natives.css)

Vous disposez donc toujours de la **dernière version** de ces dépendances.

## 🎨 Thématisation

### Mode Light/Dark automatique

Si vous avez choisi **"Light et Dark"** :

```css
/* Les tokens utilisent light-dark() */
--surface: light-dark(var(--color-white), var(--color-gray-900));
```

Le thème s'adapte automatiquement selon la préférence système de l'utilisateur.

### Forcer un thème

Ajoutez l'attribut `data-theme` sur `<html>` :

```html
<!-- Forcer le thème clair -->
<html lang="fr" data-theme="light"></html>

<!-- Forcer le thème sombre -->
<html lang="fr" data-theme="dark"></html>
```

## 📐 Layouts Bretzel

Utilisez les attributs `data-layout` pour structurer vos pages :

```html
<!-- Empilement vertical -->
<div data-layout="stack" data-gap="m">...</div>

<!-- Grille fluide -->
<div data-layout="autogrid" data-gap="l">...</div>

<!-- 2 colonnes -->
<div data-layout="duo" data-gap="m">...</div>
```

Consultez la [documentation Bretzel](https://bretzel.alsacreations.com/) pour tous les layouts disponibles.

## 🎯 Variables CSS disponibles

### Tokens de couleurs

```css
--primary, --on-primary
--accent, --accent-invert
--surface, --on-surface
--layer-1, --layer-2, --layer-3
--link, --link-hover
--selection
--success, --warning, --error, --info
--border-light, --border-medium
```

### Tokens de typographie

```css
--text-s, --text-m, --text-l, --text-xl, --text-2xl, --text-3xl, --text-4xl
```

### Tokens d'espacements

```css
--gap-xs, --gap-s, --gap-m, --gap-l, --gap-xl
--spacing-xs, --spacing-s, --spacing-m, --spacing-l, --spacing-xl
```

### Tokens de formulaires

```css
--form-control-background, --on-form-control
--form-control-spacing
--form-control-border-width, --form-control-border-color, --form-control-border-radius
--checkables-border-color, --checkable-size
```

### Variables primitives (theme.css)

```css
/* Espacements */
--spacing-0, --spacing-1, --spacing-2, --spacing-4, --spacing-8, --spacing-12,
--spacing-16, --spacing-20, --spacing-24, --spacing-32, --spacing-40, --spacing-48,
--spacing-56, --spacing-64, --spacing-80, --spacing-128, --spacing-160

/* Tailles de police */
--text-10, --text-11, --text-12, --text-13, --text-14, --text-15, --text-16,
--text-17, --text-18, --text-20, --text-24, --text-30, --text-32, --text-36,
--text-40, --text-48, --text-60, --text-80

/* Border radius */
--radius-none, --radius-s, --radius-m, --radius-l, --radius-xl, --radius-2xl, --radius-full

/* Couleurs */
--color-gray-50 à --color-gray-900
--color-white, --color-black
--color-red-100, --color-red-300, --color-red-500, --color-red-700, --color-red-900
--color-green-100, --color-green-300, --color-green-500, --color-green-700, --color-green-900
--color-orange-100, --color-orange-300, --color-orange-500, --color-orange-700, --color-orange-900
--color-blue-100, --color-blue-300, --color-blue-500, --color-blue-700, --color-blue-900
```

## ❓ Questions fréquentes

### Puis-je modifier les fichiers générés ?

Oui ! Les fichiers sont votre point de départ. Vous pouvez les personnaliser selon les besoins du projet.

### Comment ajouter mes propres composants ?

Créez vos fichiers CSS et importez-les dans `app.css` :

```css
/* Dans app.css */
@import "mes-boutons.css" layer(components);
@import "ma-navigation.css" layer(components);
```

### Que faire si je veux changer de couleur primaire plus tard ?

Relancez le générateur avec la nouvelle couleur, téléchargez le nouveau kit et remplacez uniquement les fichiers modifiés (`theme-tokens.css` principalement).

## 🐛 Problème ou suggestion ?

Contactez l'équipe Alsacréations ou ouvrez une issue sur le repository.

---

Bon intégration ! 🚀
