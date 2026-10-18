# Figures & Formulas

Math fluency games on one spaced-repetition scheduler. Two so far:

- **Figures & Formulas** (`web/shooter/`): MasterType-style. Enemies carry problems; type the answer and the ship fires. Production practice.
- **Slice of Truth** (`web/slice/`): equations fly up on fruit; slice the false ones. Verification practice, with the kind of each mistake recorded.

The hub (`web/index.html`) picks the player and the game. Both games report to the same scheduler and the same Sheet, so a fact drilled in one comes due in the other.
Only typed answers can make a fact *fluent*; slicing schedules it but never promotes it on recognition alone.

## Layout

```
web/                 served as-is by GitHub Pages
  index.html         the hub: player picker + game cards
  config.js          deployment settings: Sheet endpoint, shared key, players  ← the one file to edit
  css/theme.css      the shared look
  js/facts.js        the knowledge set, generated in layers (core · signed · strategies)
  js/scheduler.js    SM-2-style scheduler graded by correctness + response time; game-agnostic
  js/store.js        LocalStore (browser) and SheetStore (Google Sheet via Apps Script)
  js/player.js       who is playing (remembered per device; ?player= overrides)
  js/sync.js         load/save against the Sheet, shared by every game
  shooter/           Figures & Formulas (typed answers)
  slice/             Slice of Truth (catch the false equations)
  sw.js, manifest    offline support and "Add to Home Screen"
apps-script/Code.gs  paste into the Sheet's Apps Script editor; see the header comment
tools/export-facts.js  dumps the generated fact set as CSV
```

## Connect the Google Sheet (one time, ~5 minutes)

1. Create a blank Google Sheet. Extensions → Apps Script. Replace the contents with `apps-script/Code.gs`.
2. Change `SECRET` at the top to any phrase. Save, choose `setup` in the function dropdown, Run (approve the permissions once).
3. Deploy → New deployment → type **Web app** → Execute as **Me**, Who has access **Anyone** → Deploy. Copy the `…/exec` URL.
4. Put the URL and the same phrase in `web/config.js` (`endpoint`, `key`). Commit and push.

The game fills the **Facts** tab with its whole catalog on first connect. From then on:

- **Settings** tab: goal, new facts per day, max layer, which families are on. The game reads these at start and writes them when changed in-game.
- **Facts** tab: set `enabled` to FALSE to pull a fact; add rows with `custom` = TRUE to add your own.
- **Progress**, **Sessions**, **History**: written by the game after each wave and run. Edit if you want, the game takes whichever copy has seen more attempts.

If the Sheet is unreachable the game plays from browser storage and syncs next time.

## Updating the game

Push to `main`. The Pages workflow deploys `web/` and stamps the service-worker cache with the commit, so open copies pick up the new version on their next load.

## Adding a game

A game needs four calls: `FF.player.current()` for who, `FF.store.LocalStore.load/save` for state, `new FF.Scheduler(FF.facts, S, {onChange})`
for `next()` / `report(id, ok, seconds, {kind, error, fastMul})`, and `new FF.Sync({...})` for the Sheet. Copy `slice/` as a template and add a card to the hub.

## Adding knowledge

Add a generator block in `web/js/facts.js` (or rows in the Sheet). Every item is `{ id, prompt, answer, fam, op, layer, strategy, mode }`.
The scheduler does not care what the item is; a second game with different mechanics only needs `FF.Scheduler`'s `next()` and `report()`.
