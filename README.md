# LibreKO for Visual Studio Code

Editor support for LibreKO's own file formats. Today that means quest scripts (`.quest`); the layout is
set up so another language or feature is a new module rather than a rewrite.

## What it gives you

**Ids read as what they mean.** The file keeps the id — so a diff, a PR review and GitHub all show
`900106000` — but the editor shows the name, and hands the id back the moment your cursor enters it.

```
Take 10 of Voucher of Chaos (+0)            <- what you see
Take 10 of 900106000                        <- what the file holds
```

Names come from the live game data, so a wrong id is not a wrong label — it is a squiggle reading
`KQ2001: There is no item 900106999`.

The rule is: **a bare id gets replaced, a name that already reads gets its detail appended.**

```
Quest 512               ->  Quest [Chaos] Emblem of Chaos III        (id hidden)
Map "worms"             ->  Map "worms"  Worm - Outside Moradon      (hint appended)
Take 3 of "apple"       ->  Take 3 of "apple"  Voucher of Chaos (+0)
"x" = event 1205        ->  "x" = event 1205  Emblem of Chaos III - started/state 3
```

An **event id is not a name and has no name to show** — it is our server's routing key, taken from
`QuestHelpers.EventTriggerIndex`. Worse, it is not unique: **52% of event ids are used by more than one
NPC**, so `event 1300` is quest 526 at Falkwine, 528 at Drake and 513 at Menissiah. The hint therefore
reports what the id means *at this file's NPC* — which quest it concerns and in which states it
fires — and it is only correct because the file declares its `Npc`.

So items, quests, NPCs, zones and legacy text ids written as bare numbers are replaced; anything
written as a declared name keeps the name on screen, because replacing readable text with other
readable text only hides what the file says. An exchange has no name at all, only a derived
description, so it keeps its id and takes a hint. The two are never both drawn on one span.

**Highlighting, twice over.** A TextMate grammar colours the file with no server running — and colours
it on GitHub. On top of that the server publishes **semantic tokens** built by the real parser, so an
action, an event name, an id and a piece of dialogue are classified by what they *are* rather than by
what a regex guessed. Where the two disagree, semantic tokens win.

### Authoring quests

Each `<npc>_<zone>_<quest>.quest` owns one quest at one binding:

```quest
include locations/global

Bind Npc 16079 Zone 21
Quest 512 "Emblem of Chaos III"

On greeting
    Say "There is always work for someone willing."

On topics
    If quest is available and player level >= 60
        Topic "About the Chaos Battle" goto offer
    If quest is active
        Topic "I have the vouchers" goto collect

On offer
    Say "Bring ten vouchers."
    Topic "Accept" do
        Start quest
    Topic "Close" goto close

On collect
    If quest is active
        Reward
            Take 10 of 900106000
            Give 100 coins
        Complete quest
```

Matching files share an NPC menu. `On greeting` supplies its text, `On topics` its choices;
zone-specific bindings take precedence. Local handler names stay local to their file. `Quest`
supplies the scope for `On accept`, `On fulfil`, `Start quest` and other lifecycle operations.
The client replies with a choice index, and the server resolves the stored continuation and reward
selection. Recheck mutable prerequisites in that continuation.

Includes go first, with later includes overriding earlier names. Use `//` or `/* ... */` for
comments. `Topic ... do` keeps short continuations next to their choice. `Reward` checks the costs
and combined inventory capacity before consuming items. `By reward` and `By roll of N` express
selection explicitly; `For` is optional before a case label. Plain `Say` needs no display modifier.

### Names instead of ids

A name line declares a name for an id, and `include` pulls another file's names in:

```
include locations/global

On chaos_3_directions
    Map country_cont
```

A name is a bare identifier; a quoted string is always literal text the player sees. The kinds that
can be named are `event`, `quest`, `item`, `npc`, `location` and `text`. A `location` carries the
payload the player eventually sees, so its text can be extracted for translation:

```
worms = location "Worm" found "Outside Moradon central gate" at 637 429 in zone 21
```

`found`, `at` and `in zone` are optional and keyword-marked, because 44% of the converted locations
have no coordinates and two adjacent bare strings is the pair people transpose.

A location has **no id**: the declaration is the data. `Map` therefore takes a name and refuses a bare
number — there is no external row to point at, and the retail `ShowMap` id was only ever passed to an
empty method.

The include is a **compile-time alias**: the name resolves to the id before anything runs, so the wire
still carries `900106000`. Names are resolved by kind, so putting a location where an item belongs is
`KQ1028` rather than a silent wrong id.

A file with no `On` blocks is a library — it needs no `Npc` line, and only its names are imported if
it happens to have handlers. Paths resolve against the file's own directory and then its ancestors, so
`include locations/global` works from a subdirectory without `../`.

Four diagnostics guard it: `KQ1025` (no such file), `KQ1026` (include cycle, with the chain),
`KQ1015` (a duplicate local definition) and `KQ1028` (right name, wrong kind). A
problem inside an included file is reported against the `include` line that pulled it in — that is
the only span valid in the file you have open.

### Blocks and the colon

Indentation opens a block, so a block opener carries no colon:

```
On chaos_3_offer for quest 512
    If player has < 10 of 900106000
        Say chaos_pitch
    Else
        Say "Not yet"
        Topic "Close" goto close
```

The quest on the handler titles every dialog the block sends, so it is written once rather than per
`Say`. A long line of dialogue that several handlers share earns a name of its own —
`chaos_pitch = text "..."` — and the editor draws the sentence over the name where it is used.

A colon means one thing only: **the body is on this line.** That is the case-label one-liner, where a
reader does need to see where the labels end:

```
By player class
    Warrior, Kurian: Complete 512
    Rogue: Take 10 of 900106000
```

Indentation must be consistent — mixed tabs and spaces is an error, and a sibling at the wrong depth
is an error. A colon that opens nothing is `KQ1023`, so there is exactly one way to write each form.

### What the colours mean

The one question a reviewer asks of a quest script is *which lines change the player*. The scheme
answers that first: **effects are loud, presentation is ordinary, reads of player state are quiet.**

| Role | Semantic type | Words |
|---|---|---|
| changes the player | `macro` | `Give` `Take` `Complete` `Start` `Set` `Teleport` `Refuse` `Cast` `Effect` `Promote` `Reset` |
| shows the player something | `function` | `Say` `Topic` `Announce` `Open` |
| control flow | `keyword` | `On` `If` `Else` `By` `For` `Reward` `Goto` `goto` `close` |
| declaration | `type` | `Bind` `Quest` `event` |
| this file's entry points | `event` | the `event` keyword and every quoted event name, in the declaration and at each `On` / `goto` |
| what the player reads | `string` | quoted dialogue and button labels |
| fixed game vocabulary | `enumMember` | `Warrior` `Karus` `completed` |
| reads player state | `property` | `player` `has` `is` `level` `space` `of` |
| a data reference | `number` | ids, usually drawn as a name instead |

The verb lists are derived from `QuestVocabulary` at startup rather than hand-maintained, so a new
action is coloured correctly the moment it is added — an earlier hand-written list had drifted to an
older syntax and was colouring words (`when`, `otherwise`, `end`, `step`) that no longer exist.

An event name is deliberately grouped with the `event` keyword rather than with dialogue: both
name a piece of this file's wiring, while a `string` is text a player reads. The TextMate
fallback puts both on `storage.type.koquest` for the same reason.

Actual colours come from your theme, not from this extension; the table is the mapping it asks for.

Plus diagnostics, hover, completion over the action and condition vocabulary, and go-to-definition on an
event name.

## Layout

```
src/extension.js            feature registry — each feature registers itself, failures are isolated
src/lsp/questLanguage.js    starts and owns questlsp
src/features/idNames.js     the id -> name decoration
syntaxes/                   TextMate grammars
languages/                  bracket, comment and indent rules
test/grammar.test.js        tokenizes a sample and asserts the scopes
```

Adding a feature is a module with `{ name, register(context, api) }` appended to the `features` array in
`extension.js`. Adding a language is a `contributes.languages` entry, a grammar, and an LSP module.

## Setup

```
npm install
npm run test:grammar     # 20 scope assertions over a sample script
```

Nothing else is required — the seed directory and the server are both discovered by walking up the
tree. Three settings exist for when discovery is not what you want:

```jsonc
// .vscode/settings.json
{
  // Only needed while scripts still carry legacy text ids.
  "libreko.quest.questTextPath": "<client checkout>/assets/quests/quest_text.json",

  // Faster than the dotnet run default, which re-checks the project on every start.
  "libreko.quest.serverPath": "<server checkout>/tools/LibreKO.QuestLsp/bin/Debug/net10.0/questlsp.exe",

  // Override only if the checkout is somewhere the walk-up cannot reach.
  "libreko.quest.seedDirectory": ""
}
```

## Loading it

Nothing needs configuring: the server finds `Seed/Data` by walking up from its own binary, and the
extension finds the server by walking up from the open folder.

**While working on it — press F5.** Open this repository as the VS Code folder and hit F5; a
second window opens with the extension loaded and the quest folder of a sibling `LibreKO` checkout
already open. Reload that
window (`Ctrl+R`) after editing extension code.

**To keep it installed**, symlink it into your extensions folder and restart VS Code:

```powershell
New-Item -ItemType SymbolicLink `
  -Path   "$env:USERPROFILE/.vscode/extensions/libreko.vscode-libreko-0.1.0" `
  -Target "<this checkout>"
```

A copy works too if symlinks are awkward, but then edits need re-copying.

**To share it**, package a `.vsix`:

```
npx @vscode/vsce package
code --install-extension vscode-libreko-0.1.0.vsix
```

Either way, run `npm install` first — `vscode-languageclient` is a runtime dependency.

## Checking it is alive

Open a `.quest` file. Then:

- **Output panel → "LibreKO Quest Script"** carries the client/server log, and the server's own
  `[questlsp] catalog loaded from … in NNNN ms` line.
- The first open costs ~1.5 s while the catalog builds. Diagnostics and names appear after that.
- If nothing happens, the language did not attach: check the status bar says `LibreKO Quest Script`,
  not `Plain Text`. That means the file extension is not `.quest`.
- `LibreKO: Restart the quest language server` from the command palette picks up a rebuilt server.

## Startup cost

The server builds an id → name index from `Seed/Data`, about **1.5 s**, almost all of it the 291 MB
`Items.json` (263,700 rows, of which only ~5.9 MB is names). That is the reason this is a long-lived
language server rather than a `questc` call per keystroke: the index is paid for once, not per edit.

## Commands

| | |
|---|---|
| `LibreKO: Toggle quest names / ids` | stop replacing, show the file exactly as it is |
| `LibreKO: Restart the quest language server` | after changing the seed directory or rebuilding the server |

## Known gaps

- **`Map N` is misnamed.** The id does not name a map — it indexes `Quest_Npc_Desc_us`, a table of
  quest-relevant *things to find*, so `338` is "Country CONT", found in the "War zone". Names resolve
  (419 of the 429 ids the converted scripts use, 97.7%), but the verb still says "map". `Locate` or
  `Show where` would read true.
- **Quest completion is not scoped to the NPC.** `KQ1021` now warns when a `Quest N` names a quest
  the file's NPC does not serve, but completion still offers every quest id in the game.
- **The decoration is unverified in a real editor.** The grammar is tested, the server is driven over
  stdio by a probe, and the JavaScript parses — but nobody has loaded this extension in VS Code and
  watched the ids swap. Do that before trusting it.
- No formatter, no rename, no workspace-wide reference search.
