const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const GRAMMAR = path.join(__dirname, '..', 'syntaxes', 'koquest.tmLanguage.json');
const WASM = path.join(
  __dirname, '..', 'node_modules', 'vscode-oniguruma', 'release', 'onig.wasm');

const SAMPLE = [
  '# Menissiah, Moradon - Voucher of Chaos',
  'Npc 16079',
  'include locations/global',
  'chaos_3_offer = event 1205',
  'chaos_pitch = text "Bring her ten Vouchers of Chaos."',
  '',
  'On chaos_3_offer for quest 512',
  '    If player has < 10 of 900106000',
  '        Say chaos_pitch',
  '        Button "Where can I find it?" goto chaos_3_reward',
  '    Else',
  '        Say "Choose your reward."',
  '        Button "Close" goto close',
  '',
  'On chaos_3_reward',
  '    If quest 512 is completed',
  '        Map country_cont',
  '    Else',
  '        By player class',
  '            Warrior, Kurian',
  '                Complete 512',
  '            Rogue',
  '                Take 10 of 900106000',
  '',
  'On accept for quest 512',
  '    If player is Karus',
  '        Goto chaos_3_offer',
  '',
  'On fulfil for quest 512',
  '    Goto chaos_3_reward',
  '',
  'On chaos_3_directions',
  '    Say "Here you go."',
  '    Button "Show me" do',
  '        Map country_cont',
  '        Clear 512',
  '',
  'Quest 512 "Silk Spool" needs any',
  '    Kill 10 of 700, 750',
  '',
  'On chaos_3_prize',
  '    If player in zone 21 and monument is Karus',
  '        Change job to Warrior unmastered',
  '        Give 500 cash',
  '        Exchange 317 x 2',
  '    Else if the last step failed',
  '        Todo "nothing to hand over"',
  '    Else',
  '        By roll of 2',
  '            0, 1',
  '                Give 1 gold',
  '            2',
  '                Give 2 gold',
  '    Despawn npc',
  '    If no topic fits',
  '    If player clan is Royal1 and player clan rank < Accredited5',
  '    If player clan grade < 4 and player clan points >= 252000',
  '        Take 252000 clan points',
  '        Promote clan to Accredited4',
  '    Open rename panel',
  'Quest 513 "Silk Spool"',
  '    Journal "Bring the spool back."',
];

const EXPECTATIONS = [
  [0, '# Menissiah, Moradon - Voucher of Chaos', 'comment.line.number-sign.koquest'],
  [1, 'Npc', 'storage.type.koquest'],
  [1, '16079', 'constant.numeric.koquest'],
  [2, 'include', 'keyword.control.import.koquest'],
  [2, 'locations/global', 'string.unquoted.include.koquest'],
  [3, 'chaos_3_offer', 'storage.type.koquest'],
  [3, '=', 'keyword.operator.assignment.koquest'],
  [3, 'event', 'storage.type.koquest'],
  [4, 'text', 'storage.type.koquest'],
  [6, 'On', 'keyword.control.koquest'],
  [6, 'chaos_3_offer', 'storage.type.koquest'],
  [7, 'If', 'keyword.control.koquest'],
  [7, '<', 'keyword.operator.koquest'],
  [7, '900106000', 'constant.numeric.koquest'],
  [8, 'Say', 'entity.name.function.koquest'],
  [9, 'Button', 'entity.name.function.koquest'],
  [9, 'goto', 'keyword.control.koquest'],
  [9, 'chaos_3_reward', 'storage.type.koquest'],
  [10, 'Else', 'keyword.control.koquest'],
  [15, 'completed', 'support.constant.koquest'],
  [16, 'Map', 'entity.name.function.koquest'],
  [18, 'By', 'keyword.control.koquest'],
  [19, 'Warrior', 'support.constant.koquest'],
  [19, 'Kurian', 'support.constant.koquest'],
  [20, 'Complete', 'support.function.koquest'],
  [22, 'Take', 'support.function.koquest'],
  [24, 'On', 'keyword.control.koquest'],
  [24, 'accept', 'storage.type.koquest'],
  [26, 'Goto', 'keyword.control.koquest'],
  [26, 'chaos_3_offer', 'storage.type.koquest'],
  [28, 'fulfil', 'storage.type.koquest'],
  [33, 'Button', 'entity.name.function.koquest'],
  [33, 'do', 'keyword.control.koquest'],
  [34, 'Map', 'entity.name.function.koquest'],
  [35, 'Clear', 'support.function.koquest'],
  [37, 'Quest', 'storage.type.koquest'],
  [37, 'needs', 'variable.other.koquest'],
  [37, 'any', 'variable.other.koquest'],
  [37, 'Silk Spool', 'string.quoted.double.koquest'],
  [38, 'Kill', 'support.function.koquest'],
  [41, 'zone', 'variable.other.koquest'],
  [41, 'monument', 'variable.other.koquest'],
  [41, 'Karus', 'support.constant.koquest'],
  [42, 'Change', 'support.function.koquest'],
  [42, 'job', 'variable.other.koquest'],
  [42, 'unmastered', 'variable.other.koquest'],
  [43, 'cash', 'variable.other.koquest'],
  [44, 'x', 'variable.other.koquest'],
  [45, 'failed', 'variable.other.koquest'],
  [46, 'Todo', 'support.function.koquest'],
  [48, 'By', 'keyword.control.koquest'],
  [48, 'roll', 'variable.other.koquest'],
  [49, '0', 'constant.numeric.koquest'],
  [51, '2', 'constant.numeric.koquest'],
  [53, 'Despawn', 'support.function.koquest'],
  [53, 'npc', 'variable.other.koquest'],
  [54, 'no', 'variable.other.koquest'],
  [54, 'topic', 'variable.other.koquest'],
  [54, 'fits', 'variable.other.koquest'],
  [55, 'clan', 'variable.other.koquest'],
  [55, 'Royal1', 'support.constant.koquest'],
  [55, 'rank', 'variable.other.koquest'],
  [55, 'Accredited5', 'support.constant.koquest'],
  [56, 'grade', 'variable.other.koquest'],
  [56, 'points', 'variable.other.koquest'],
  [57, 'Take', 'support.function.koquest'],
  [58, 'Promote', 'support.function.koquest'],
  [58, 'Accredited4', 'support.constant.koquest'],
  [59, 'Open', 'entity.name.function.koquest'],
  [59, 'rename', 'variable.other.koquest'],
  [60, 'Quest', 'storage.type.koquest'],
  [61, 'Journal', 'support.function.koquest'],
  [61, 'Bring the spool back.', 'string.quoted.double.koquest'],
];

for (const [line, needle, scope] of [
  ['Bind Npc 16079 Zone 21', 'Bind', 'storage.type.koquest'],
  ['Bind Npc 16079 Zone 21', 'Npc', 'variable.other.koquest'],
  ['Bind Npc 16079 Zone 21', 'Zone', 'variable.other.koquest'],
  ['    Topic "Back" goto greeting', 'Topic', 'entity.name.function.koquest'],
  ['    Transaction', 'Transaction', 'keyword.control.koquest'],
  ['RewardPool loot', 'RewardPool', 'keyword.control.koquest'],
  ['RewardTable chest', 'RewardTable', 'keyword.control.koquest'],
  ['    Row 810418000', 'Row', 'keyword.control.koquest'],
  ['    Weights 1500', 'Weights', 'keyword.control.koquest'],
  ['        Give 10 coins', 'coins', 'variable.other.koquest'],
  ['        For 0 to 999', 'For', 'keyword.control.koquest'],
  ['    Refuse reward', 'Refuse', 'support.function.koquest'],
  ['    Teleport 21 at 10 20', 'Teleport', 'support.function.koquest'],
  ['    Title for karus "Marauders of Darkland I"', 'Title', 'support.function.koquest'],
  ['// Comment', '// Comment', 'comment.line.number-sign.koquest'],
  ['/* Begin', '/* Begin', 'comment.block.koquest'],
  ['End */', 'End */', 'comment.block.koquest'],
]) {
  EXPECTATIONS.push([SAMPLE.length, needle, scope]);
  SAMPLE.push(line);
}

async function main() {
  const wasm = fs.readFileSync(WASM);
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
      createOnigString: value => new oniguruma.OnigString(value),
    }),
    loadGrammar: scope => {
      if (scope !== 'source.koquest') return Promise.resolve(null);
      const raw = fs.readFileSync(GRAMMAR, 'utf8');
      return Promise.resolve(vsctm.parseRawGrammar(raw, GRAMMAR));
    },
  });

  const grammar = await registry.loadGrammar('source.koquest');
  assert.ok(grammar, 'the grammar failed to load');

  const lines = [];
  let state = vsctm.INITIAL;
  for (const line of SAMPLE) {
    const result = grammar.tokenizeLine(line, state);
    state = result.ruleStack;
    lines.push(result.tokens.map(token => ({
      text: line.slice(token.startIndex, token.endIndex),
      scopes: token.scopes,
    })));
  }

  let failures = 0;
  for (const [lineIndex, needle, scope] of EXPECTATIONS) {
    const tokens = lines[lineIndex] ?? [];
    const covered = tokens.some(token =>
      token.text.trim().length > 0 &&
      needle.includes(token.text.trim()) &&
      token.scopes.includes(scope));
    if (covered) continue;
    failures++;
    console.error(`FAIL line ${lineIndex + 1}: expected ${scope} on ${JSON.stringify(needle)}`);
    console.error('  got: ' + JSON.stringify(tokens.map(t => [t.text, t.scopes.at(-1)])));
  }

  const unscoped = [];
  lines.forEach((tokens, index) => {
    for (const token of tokens) {
      if (token.text.trim().length === 0) continue;
      if (token.scopes.length > 1) continue;
      unscoped.push(`line ${index + 1}: ${JSON.stringify(token.text)}`);
    }
  });

  console.log(`${EXPECTATIONS.length - failures}/${EXPECTATIONS.length} scope expectation(s) met`);
  if (unscoped.length > 0) {
    console.log(`${unscoped.length} token(s) carry no scope at all:`);
    for (const entry of unscoped.slice(0, 12)) console.log('   ' + entry);
  } else {
    console.log('every non-blank token carries a scope');
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
