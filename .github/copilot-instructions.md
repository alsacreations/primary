# Instructions Copilot - Primary

## Vue d'ensemble du projet

**Primary** est un outil de génération de design tokens (CSS et WordPress `theme.json`) à partir d'exports JSON Figma.

**Stack technique :**
- JavaScript Vanilla (Node.js pour les scripts, Browser pour l'UI)
- CSS moderne (Cascade Layers, `light-dark()`, `clamp()`, `oklch()`)
- HTML sémantique & Accessibilité (RGAA)

---

## 1. Concepts de Design Tokens

### Définitions
- **Primitive** : Valeur brute (couleur hex/oklch, nombre px/rem). Toujours préfixée par son type (ex: `--color-pink-500`, `--spacing-16`).
- **Token** : Référence sémantique pointant vers une Primitive.
  - **Token Simple** : Référence une seule primitive (ex: `--surface: var(--color-white)`).
  - **Token de Mode** : Référence des primitives différentes selon le contexte (Light/Dark ou Mobile/Desktop).

### Modes supportés
- **Thème** : `light` / `dark` (utilisant `light-dark()`)
- **Appareil** : `Mobile` (360px) / `Desktop` (1280px) (utilisant `clamp()`)

---

## 2. Procédure d'Extraction Figma

L'extraction transforme le JSON brut de Figma en fichiers intermédiaires (`primitives.json`, `tokens.json`) puis en fichiers finaux (`theme.css`, `theme.json`).

### Conventions de nommage CSS
- Couleurs : `--color-*` (Primitives) ou noms sémantiques (ex: `--primary`, `--surface`).
- Espacements : `--spacing-*`.
- Typographie : `--text-*` (taille), `--font-*` (famille), `--line-height-*`, `--font-weight-*`.
- Divers : `--radius-*`, `--shadow-*`, `--z-*`.

### Calcul des valeurs fluides (Responsive)
Pour les tokens Mobile/Desktop, calculer l'expression `clamp()` :
`clamp(var(--primitive-mobile), <intercept>rem + <slope>vw, var(--primitive-desktop))`
- `viewport_min` = 360, `viewport_max` = 1280.
- `slope` = (desktop_px - mobile_px) * 100 / (1280 - 360).
- `intercept` = (mobile_px - slope * (360 / 100)) / 16.

---

## 3. Génération WordPress (`theme.json`)

Le script `scripts/generateThemeJson.js` doit mapper les tokens vers le schéma FSE (Full Site Editing).

### Mappings principaux
- **Couleurs** : `settings.color.palette` (Slug = nom sans préfixe).
- **Espacements** : `settings.spacing.spacingSizes`.
- **Typographie** : `settings.typography.fontSizes` et `fontFamilies`.
- **Styles** : Injecter les mappings par défaut pour `elements` (h1-h6, link) et `blocks` (core/button).

### Règles WordPress
- Préférer les références `var:preset|...` pour les valeurs mappées.
- Conserver les expressions CSS (`light-dark()`, `clamp()`) telles quelles dans le JSON.
- **Attention** : `line-height` ne doit pas être dans `settings.typography` mais uniquement dans les mappings de `styles`.

---

## 4. Architecture et Qualité

### Architecture CSS (Priority Order)
```css
@layer config, base, components, utilities;
```
- Utiliser **Bretzel Layouts** (attributs `data-layout`) en priorité absolue pour la structure.
- **Mobile First** systématique.

### JavaScript
- Vanilla JS uniquement.
- Délégation d'événements et manipulation via `classList` / `dataset`.

### Accessibilité (RGAA)
- Priorité absolue. HTML sémantique obligatoire.
- Contrastes respectés (Ratio 4.5:1 min).
- Navigation clavier et focus visible.

### Commits et Langue
- **Langue** : Français pour tout (code, comms, docs).
- **Format** : `type(scope): message` (ex: `feat(wp): ajoute le mapping des polices`).

---

## 5. Composition du fichier `theme.css`
1. Commentaire général.
2. Custom Breakpoints (`@custom-media`).
3. `:root` contenant :
   - `color-scheme` & `data-theme` overrides.
   - Primitives Globales (Fallbacks si source Figma vide).
   - Primitives & Tokens du projet (Extraits de Figma).
