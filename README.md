# Figures & Formulas

A MasterType-style math fluency game (1981 lineage, Apple II look) built around a spaced-repetition scheduler.
Enemies carry arithmetic problems; you type the answer and the ship fires at the one that matches.
Wrong answers cost shields, five right in a row restores one, and every fourth wave is a boss that only fast answers can hurt.

## Layout

```
web/                 the game, served as-is by GitHub Pages
  index.html         page + CSS
  config.js          deployment settings: the Sheet endpoint, shared key, player name  ← the one file to edit
  js/facts.js        the knowledge set, generated in layers (core · signed · strategies)
  js/scheduler.js    SM-2-style scheduler graded by correctness + response time; game-agnostic
  js/store.js        LocalStore (browser) and SheetStore (Google Sheet via Apps Script)
  js/game.js         the MasterType game: one front end to the scheduler
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

## Adding knowledge

Add a generator block in `web/js/facts.js` (or rows in the Sheet). Every item is `{ id, prompt, answer, fam, op, layer, strategy, mode }`.
The scheduler does not care what the item is; a second game with different mechanics only needs `FF.Scheduler`'s `next()` and `report()`.
