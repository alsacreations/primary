# Fichiers de configuration

Ce dossier contient les fichiers de configuration standards pour les projets Alsacréations.

## Contenu

- `editorconfig.txt` → `.editorconfig` : Configuration de l'éditeur (indentation, encodage, etc.)
- `gitignore.txt` → `.gitignore` : Fichiers à ignorer par Git
- `postcss.config.mjs` : Configuration PostCSS
- `prettier.config.mjs` : Configuration Prettier (formatage du code)
- `stylelint.config.mjs` : Configuration Stylelint (linting CSS)

**Note :** Les fichiers `.editorconfig` et `.gitignore` sont stockés avec l'extension `.txt` pour être accessibles via HTTP (les serveurs web bloquent souvent les fichiers cachés). Ils sont automatiquement renommés avec le point initial lors de l'inclusion dans le ZIP.

## Utilisation

Ces fichiers peuvent être inclus dans le ZIP téléchargeable en cochant l'option **"Ajouter fichiers de config"** à l'étape 3 de l'application.

## Ajout de nouveaux fichiers

Lorsque vous ajoutez un nouveau fichier de configuration dans ce dossier :

1. Ajoutez le fichier dans `canonical/config/`
   - Si c'est un fichier caché (commençant par `.`), nommez-le avec `.txt` (ex: `.eslintrc` → `eslintrc.txt`)
2. Lancez le script de mise à jour :

   ```bash
   npm run update:config
   ```

3. Cela mettra automatiquement à jour `index.json` qui mappe les fichiers sources vers leurs noms de destination

Le fichier sera automatiquement inclus dans les ZIP générés avec le bon nom.
