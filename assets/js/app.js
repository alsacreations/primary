/**
 * Primary - Configurateur CSS pour projets Alsacréations
 * Application principale modulaire
 */

// Imports des modules
import { state } from './modules/state.js';
import { elements } from './modules/dom.js';
import { setupEventListeners } from './modules/events.js';
import { loadAllFiles } from './modules/files.js';
import { updateUI, updateColorChoices, applyCustomVarsToDocument } from './modules/ui.js';

/**
 * Fonction d'initialisation de l'application
 */
async function init() {
  try {
    // Charger tous les fichiers CSS nécessaires
    await loadAllFiles();

    // Configurer les événements
    setupEventListeners();

    // Initialiser l'interface
    updateUI();
    updateColorChoices();
    applyCustomVarsToDocument();

    console.log('Primary CSS Generator initialisé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
  }
}

// Démarrer l'application quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}