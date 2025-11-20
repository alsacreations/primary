Policy: assets/css/\* protection

Objectif

- Ne JAMAIS modifier les fichiers runtime du dossier `assets/css/` via les générateurs ou par erreur de commit.
- Ne JAMAIS utiliser `assets/css/*` comme source de référence pour la génération des fichiers finaux.
- TOUJOURS utiliser les fichiers canoniques sous `/canonical/` comme source de vérité pour la génération.

Fichiers ajoutés

- `scripts/prevent-assets-modify.js` : script Node qui vérifie les fichiers mis en staging et bloque les commits touchant `assets/css/*`.
- `.githooks/pre-commit` : hook Git simple qui exécute le script ci‑dessus.
- `package.json` : ajout d'un script `precommit:check-assets` pour exécuter manuellement la vérification.

Comment activer le hook Git localement

1. Dans la racine du dépôt, activer le dossier de hooks :

```bash
git config core.hooksPath .githooks
```

2. Tester le hook (mode non-destructif) :

```bash
# simuler en stagant un fichier assets/css/test.css
git add --intent-to-add assets/css/theme.css
# lancer le check manuel
npm run precommit:check-assets
# si le script échoue, annuler le staging
git reset
```

CI / Serveur

- Recommander d'exécuter `npm run precommit:check-assets` dans la pipeline CI avant les étapes de build ou de publication. Cela empêchera les pushes contenant des modifications non voulues vers `assets/css/`.

Note

- Le script est intentionnellement conservateur : il bloque toute modification staged sous `assets/css/`. Si une modification est volontaire (exception rare), elle doit être validée manuellement après validation de l'équipe.
- Le générateur a été mis à jour pour préférer les fichiers canoniques (`/canonical/`) lorsque disponibles. Si vous avez besoin d'une exception (ex : preview via `?useAssets=true`), ce mode reste disponible uniquement pour la visualisation, pas pour la génération des fichiers finaux.
