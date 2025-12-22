# Primary - Générateur CSS Alsacréations

Outil de génération de fichiers CSS pour les projets Alsacréations, avec configuration et téléchargement d'un kit CSS complet (tokens, thématisation et layouts).

� **[primary.alsacreations.com](https://primary.alsacreations.com)**

## Comment ça marche ?

### 1. Sources

Deux possibilités :

- **Fichier statique** `theme.css` : variables CSS primitives (couleurs, espacements, typographie). Ajoutez vos couleurs personnalisées si nécessaire.
- **Import Figma** : fichiers `.json` exportés de Figma, automatiquement analysés pour extraire styles et variables.

```bash
# Import depuis le projet (par défaut)
npm run import:step1

# Import depuis Figma
node scripts/import-step1.js --source=figma
```

### 2. Configuration

Personnalisez votre thème :

- **Couleur primaire** : info, error, success, warning, raspberry
- **Thème** : light, dark, ou les deux
- **Typographie** : responsive (avec `clamp()`) ou fixes
- **Espacements** : responsive (avec `clamp()`) ou fixes
- **Police** : système ou Poppins
- **Techno** : statique ou WordPress (génère `theme.json`)

### 3. Génération

Visualisation et téléchargement du kit complet `primary-css.zip` contenant :

- `app.css`, `reset.css`, `theme.css`, `theme-tokens.css`
- `layouts.css`, `natives.css`, `styles.css`
- `theme.json` (si WordPress)
- Police Poppins (si sélectionnée)

**Fichiers toujours à jour :** `reset.css`, `layouts.css` et `natives.css` sont automatiquement récupérés depuis leurs sources officielles.

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
index.html            # Page de démonstration des styles
```

## Variables CSS principales

**Tokens sémantiques :**

- Couleurs : `--primary`, `--accent`, `--surface`, `--layer-1/2/3`, `--link`, `--success/warning/error/info`
- Typographie : `--text-s/m/l/xl/2xl/3xl/4xl`
- Espacements : `--spacing-xs/s/m/l/xl`
- Formulaires : `--input-background`, `--input-border-color`, `--checkable-size`

**Variables primitives :**

- Espacements : `--spacing-0` à `--spacing-160`
- Tailles : `--text-10` à `--text-80`
- Rayons : `--radius-none` à `--radius-full`
- Couleurs : `--color-gray-50` à `--color-gray-900`, palettes complètes error/success/warning/info/raspberry

## Layouts Bretzel

```html
<div
  data-layout="stack"
  data-gap="s">
  ...
</div>
<div
  data-layout="autogrid"
  data-gap="l">
  ...
</div>
<div
  data-layout="duo"
  data-split="1-2">
  ...
</div>
```

[Documentation](https://bretzel.alsacreations.com/)

## Ressources

- [Guidelines CSS](guidelines-css.md)
- [Reset CSS](https://reset.alsacreations.com/)
- [Bretzel Layouts](https://bretzel.alsacreations.com/)
- [KNACSS](https://knacss.com/)

---

**Problème ou suggestion ?** Contactez l'équipe Alsacréations.
