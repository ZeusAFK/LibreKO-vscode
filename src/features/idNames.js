const vscode = require('vscode');
const { LANGUAGE_ID } = require('../lsp/questLanguage');

const REQUEST = 'quest/resolvedNames';

let showNames = true;
let api;

const hiddenId = vscode.window.createTextEditorDecorationType({
  textDecoration: 'none; display: none',
});

const nameLabel = vscode.window.createTextEditorDecorationType({
  before: { color: new vscode.ThemeColor('editorInlayHint.foreground') },
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

function client() {
  return api?.clients.get(LANGUAGE_ID);
}

async function refresh(editor) {
  if (!editor || editor.document.languageId !== LANGUAGE_ID) return;

  const active = client();
  if (!active || !showNames) {
    editor.setDecorations(hiddenId, []);
    editor.setDecorations(nameLabel, []);
    return;
  }

  let spans;
  try {
    spans = await active.sendRequest(REQUEST, {
      textDocument: { uri: editor.document.uri.toString() },
    });
  } catch {
    return;
  }

  if (!spans || editor !== vscode.window.activeTextEditor) return;

  const cursors = editor.selections;
  const hide = [];
  const label = [];

  for (const span of spans) {
    const range = new vscode.Range(
      span.range.start.line, span.range.start.character,
      span.range.end.line, span.range.end.character);

    // Leave the id itself visible wherever a cursor sits in it, so it stays readable and editable.
    if (cursors.some(selection => range.contains(selection.active))) continue;

    hide.push(range);
    label.push({
      range,
      renderOptions: { before: { contentText: span.name } },
      hoverMessage: new vscode.MarkdownString(`\`${span.kind} ${span.id}\``),
    });
  }

  editor.setDecorations(hiddenId, hide);
  editor.setDecorations(nameLabel, label);
}

function register(context, extensionApi) {
  api = extensionApi;
  showNames = vscode.workspace.getConfiguration('libreko.quest').get('showNamesInsteadOfIds');

  context.subscriptions.push(
    hiddenId,
    nameLabel,
    vscode.window.onDidChangeActiveTextEditor(refresh),
    vscode.window.onDidChangeTextEditorSelection(event => refresh(event.textEditor)),
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) refresh(editor);
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration('libreko.quest.showNamesInsteadOfIds')) return;
      showNames = vscode.workspace.getConfiguration('libreko.quest').get('showNamesInsteadOfIds');
      refresh(vscode.window.activeTextEditor);
    }),
    vscode.commands.registerCommand('libreko.quest.toggleNames', () => {
      showNames = !showNames;
      refresh(vscode.window.activeTextEditor);
    }));

  return refresh(vscode.window.activeTextEditor);
}

module.exports = { name: 'ids shown as names', register };
