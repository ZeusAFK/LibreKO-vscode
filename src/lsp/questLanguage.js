const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

const LANGUAGE_ID = 'koquest';
const PROJECT = path.join('KOServer', 'tools', 'LibreKO.QuestLsp', 'LibreKO.QuestLsp.csproj');

let client;

function settings() {
  return vscode.workspace.getConfiguration('libreko.quest');
}

function serverArguments(config) {
  const args = [];
  const seed = config.get('seedDirectory');
  const text = config.get('questTextPath');
  if (seed) args.push('--seed', seed);
  if (text) args.push('--text', text);
  return args;
}

function findProject(startAt) {
  // Walk up from the open folder. The server may sit in this checkout or in a sibling one,
  // so a workspace opened on a subfolder still finds it.
  for (let directory = startAt; ; ) {
    for (const candidate of [
      path.join(directory, PROJECT),
      path.join(directory, 'tools', 'LibreKO.QuestLsp', 'LibreKO.QuestLsp.csproj'),
    ]) {
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function serverOptions(config) {
  const args = serverArguments(config);
  const configured = config.get('serverPath');
  if (configured) {
    return { command: configured, args, transport: TransportKind.stdio };
  }

  const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspace) {
    throw new Error('open a folder, or set libreko.quest.serverPath, so the server can be found');
  }

  const project = findProject(workspace);
  if (!project) {
    throw new Error(
      `could not find ${PROJECT} above ${workspace} — set libreko.quest.serverPath instead`);
  }

  return {
    command: 'dotnet',
    args: ['run', '--project', project, '--'].concat(args),
    transport: TransportKind.stdio,
  };
}

async function start(context, api) {
  const config = settings();
  client = new LanguageClient(
    'libreko.quest',
    'LibreKO Quest Script',
    serverOptions(config),
    {
      documentSelector: [{ scheme: 'file', language: LANGUAGE_ID }],
      outputChannelName: 'LibreKO Quest Script',
    });

  await client.start();
  api.clients.set(LANGUAGE_ID, client);
  context.subscriptions.push({ dispose: () => client?.stop() });
}

async function register(context, api) {
  context.subscriptions.push(
    vscode.commands.registerCommand('libreko.quest.restartServer', async () => {
      await client?.stop();
      api.clients.delete(LANGUAGE_ID);
      await start(context, api);
      vscode.window.showInformationMessage('LibreKO: quest language server restarted.');
    }));

  await start(context, api);
}

module.exports = { name: 'quest language server', register, dispose: () => client?.stop(), LANGUAGE_ID };
