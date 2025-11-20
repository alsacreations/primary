#!/usr/bin/env node
// Prevent staged commits touching assets/css/*
// Usage: run as a git pre-commit hook or manually.
const { execSync } = require("child_process");

try {
  const out = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  const files = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const offending = files.filter(f => f.startsWith('assets/css/'));
  if (offending.length) {
    console.error('\nERROR: Commit blocked — modification(s) détectée(s) dans assets/css/*');
    console.error('Fichiers touchés:');
    offending.forEach(f => console.error('  - ' + f));
    console.error('\nContrainte du projet: ne jamais modifier les fichiers runtime dans assets/css/ via les générateurs ou commits automatiques.');
    console.error('Si vous avez besoin d’exceptions, contactez l’équipe et appliquez un commit explicite après vérification.');
    process.exit(1);
  }
  process.exit(0);
} catch (e) {
  console.error('Erreur lors de la vérification des fichiers git:', e && e.message);
  // Fail-safe: do not block commit if git command fails unexpectedly
  process.exit(0);
}
