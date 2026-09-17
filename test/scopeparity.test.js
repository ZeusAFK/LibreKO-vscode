const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const GRAMMAR = path.join(__dirname, '..', 'syntaxes', 'koquest.tmLanguage.json');
const PACKAGE = path.join(__dirname, '..', 'package.json');
const WASM = path.join(
  __dirname, '..', 'node_modules', 'vscode-oniguruma', 'release', 'onig.wasm');

const SAMPLE = [
  'Npc 16079',
  'Bind Npc 16079 Zone 21',
  '    Topic "Back" goto greeting',
  '    Transaction',
  'RewardPool loot',
  '    100 810418000',
  'RewardTable chest',
  '    Weights 1500 8500',
  '    Row 810418000 900044000',
  '    Give random from chest',
  '    Trade 1 of 123 for 1 of 456',
  '        Give 10 coins',
  '        By selection',
  '        For 0 to 999',
  '    Refuse reward',
  '    Teleport 21 at 10 20',
  'chaos_3_offer = event 1205',
  'On chaos_3_offer for quest 512',
  '    Say "hello"',
  '    Button "Close" goto chaos_3_offer',
  '    Take 10 of 900106000',
  '    If player in zone 21 and monument is Karus',
  '        Change job to Warrior unmastered',
  '        Give 500 cash',
  '        Exchange 317 x 2',
  '        By roll of 2',
  '            0, 1',
  '                Give 1 gold',
  'Quest 512 "Silk Spool" needs any',
  '    Journal "Bring the spool back."',
  '    Kill 10 of 700',
  'On inventory_check',
  '    If player can receive 2 of 123 and player weight < 100 and player experience >= 50',
  '        Do nothing',
  '    Else if player can receive 3 stacks',
  '        Exchange 94 for quest reward 2',
  '    If player class subtype == 6',
  '        Do nothing',
  '    Despawn npc',
  '    If no topic fits',
  '    If player clan is Royal1 and player clan rank < Accredited5',
  '    If player clan grade < 4 and player clan points >= 252000',
  '        Take 252000 clan points',
  '        Promote clan to Accredited4',
  '    Open rename panel',
];

// what the server calls each token, so the two highlighting paths can be compared
const SEMANTIC = {
  Npc: 'type',
  Bind: 'type',
  Topic: 'function',
  Transaction: 'keyword',
  Trade: 'keyword',
  RewardPool: 'keyword',
  RewardTable: 'keyword',
  Row: 'keyword',
  Weights: 'keyword',
  from: 'property',
  For: 'keyword',
  Refuse: 'macro',
  Teleport: 'macro',
  coins: 'property',
  event: 'event',
  chaos_3_offer: 'event',
  On: 'keyword',
  goto: 'keyword',
  Say: 'function',
  Button: 'function',
  Take: 'macro',
  hello: 'string',
  Close: 'string',
  zone: 'property',
  monument: 'property',
  Karus: 'enumMember',
  Change: 'macro',
  job: 'property',
  unmastered: 'property',
  cash: 'property',
  x: 'property',
  roll: 'property',
  needs: 'property',
  any: 'property',
  Kill: 'macro',
  Journal: 'macro',
  Despawn: 'macro',
  clan: 'property',
  Open: 'function',
  rename: 'property',
  grade: 'property',
  points: 'property',
  Promote: 'macro',
  Accredited4: 'enumMember',
  rank: 'property',
  Royal1: 'enumMember',
  Accredited5: 'enumMember',
  no: 'property',
  topic: 'property',
  fits: 'property',
  can: 'property',
  receive: 'property',
  weight: 'property',
  experience: 'property',
  stacks: 'property',
  Do: 'keyword',
  nothing: 'property',
  reward: 'property',
  selection: 'property',
  subtype: 'property',
};

function familyOf(scope) {
  return scope.split('.').slice(0, 2).join('.');
}

async function main() {
  const wasm = fs.readFileSync(WASM);
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
      createOnigString: value => new oniguruma.OnigString(value),
    }),
    loadGrammar: scope => scope === 'source.koquest'
      ? Promise.resolve(vsctm.parseRawGrammar(fs.readFileSync(GRAMMAR, 'utf8'), GRAMMAR))
      : Promise.resolve(null),
  });

  const grammar = await registry.loadGrammar('source.koquest');
  assert.ok(grammar, 'grammar failed to load');

  const pkg = JSON.parse(fs.readFileSync(PACKAGE, 'utf8'));
  const fallback = pkg.contributes.semanticTokenScopes
    .find(entry => entry.language === 'koquest').scopes;

  let state = vsctm.INITIAL;
  const found = new Map();
  for (const line of SAMPLE) {
    const result = grammar.tokenizeLine(line, state);
    state = result.ruleStack;
    for (const token of result.tokens) {
      const text = line.slice(token.startIndex, token.endIndex).trim();
      if (!text || found.has(text)) continue;
      const own = token.scopes.filter(s => s !== 'source.koquest').pop();
      if (own) found.set(text, own);
    }
  }

  let failures = 0;
  console.log('token            textmate scope             semantic falls back to     match');
  for (const [text, semanticType] of Object.entries(SEMANTIC)) {
    const tmScope = found.get(text);
    if (!tmScope) {
      console.error(`  MISSING from grammar output: ${text}`);
      failures++;
      continue;
    }
    const mapped = (fallback[semanticType] || [])[0];
    if (!mapped) {
      console.error(`  ${text}: semantic type "${semanticType}" has no scope mapping`);
      failures++;
      continue;
    }
    const same = familyOf(tmScope) === familyOf(mapped);
    if (!same) failures++;
    console.log('  %s %s %s %s',
      text.padEnd(16), tmScope.padEnd(26), mapped.padEnd(26), same ? 'yes' : 'NO');
  }

  console.log();
  console.log(failures === 0
    ? 'both highlighting paths agree - turning the server on or off cannot change a colour'
    : `${failures} token(s) would change colour when the server starts`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(error => { console.error(error); process.exit(1); });
