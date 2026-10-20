# Figures & Formulas

Math fluency games on one spaced-repetition scheduler. Live at https://kcy.github.io/figures-formulas/.

| Game | Folder | How you answer | Counts toward fluent? |
|---|---|---|---|
| Figures & Formulas | `web/shooter/` | type (MasterType-style shooter) | yes |
| Slice of Truth | `web/slice/` | pick: slice the right fruit | no (schedules only) |
| Lily Hop | `web/hop/` | tap the pad on a number line (+, −, negatives) | no |
| Elevator Drop | `web/elevator/` | tap the floor where the elevator stops (negatives underground) | no |
| Bubble Pop | `web/bubbles/` | pop the right rising bubble | no |
| Pace Race | `web/race/` | type, racing a pace car that adapts | yes |
| Array Grid | `web/arrays/` | type; times tables drawn as dot arrays | yes |

The hub (`web/index.html`) picks the player and the game. Every game reports to the same scheduler and the same Sheet, so a fact drilled in one comes due in the others.
Only typed answers can make a fact *fluent*; picking games schedule a fact but never promote it on recognition alone.

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
  js/kit.js, css/kit.css   shared kit for the newer games (player, scheduler, sync, think time, sound, overlays, keypad)
  shooter/, slice/   the first two games (self-contained)
  hop/, elevator/, bubbles/, race/, arrays/   built on the kit: index.html (look) + one game .js
  sw.js, manifest    offline support and "Add to Home Screen"
apps-script/Code.gs  paste into the Sheet's Apps Script editor; see the header comment
tools/export-facts.js  dumps the generated fact set as CSV
```

## Reading the code from a chat

If you can only fetch web pages (not clone), every file is readable at a raw URL. Start with CLAUDE.md, then the kit and one kit game:

- https://raw.githubusercontent.com/kcy/figures-formulas/main/CLAUDE.md
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/js/kit.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/css/kit.css
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/js/facts.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/js/scheduler.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/js/player.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/js/store.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/js/sync.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/config.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/sw.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/index.html
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/hop/index.html
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/hop/hop.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/elevator/index.html
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/elevator/elevator.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/bubbles/index.html
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/bubbles/bubbles.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/race/index.html
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/race/race.js
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/arrays/index.html
- https://raw.githubusercontent.com/kcy/figures-formulas/main/web/arrays/arrays.js

To push changes you need a real clone: use Claude Code with GitHub connected, as a collaborator on this repo.

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

Copy one of `hop/`, `bubbles/`, `race/` or `arrays/`. `FF.kit({ game, title, version })` wires up the player, scheduler, Sheet sync, think time,
sound and the title/result/pause cards; the game file only draws its world and calls `K.next(filter)` and `K.report(id, ok, seconds, {kind, error})`.
Then add a card and poster to `web/index.html` and the new files to `SHELL` in `web/sw.js` (the offline cache fails if a listed file is missing).

## Adding knowledge

Add a generator block in `web/js/facts.js` (or rows in the Sheet). Every item is `{ id, prompt, answer, fam, op, layer, strategy, mode }`.
The scheduler does not care what the item is; a second game with different mechanics only needs `FF.Scheduler`'s `next()` and `report()`.
