const vscode = require('vscode');
const questLanguage = require('./lsp/questLanguage');
const idNames = require('./features/idNames');

const features = [questLanguage, idNames];

async function activate(context) {
  const api = { clients: new Map() };

  for (const feature of features) {
    try {
      await feature.register(context, api);
    } catch (error) {
      vscode.window.showErrorMessage(`LibreKO: ${feature.name} failed to start — ${error.message}`);
    }
  }

  return api;
}

async function deactivate() {
  for (const feature of features.slice().reverse()) {
    if (feature.dispose) await feature.dispose();
  }
}

module.exports = { activate, deactivate };
