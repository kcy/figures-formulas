# Working on Figures & Formulas

Math-fact fluency games for Nabil (11). Krishna (kcy) and Nabil both push here. Read README.md first for the layout.

## Ground rules
- Plain static site: no build step, no frameworks, no npm dependencies in `web/`. Each game is `index.html` + one JS file on a full-screen canvas.
- It is played mostly on an iPad (touch, Safari). Every change has to work with touch and with a keyboard; test at iPad size.
- Kid-facing: calm pacing beats twitchy. New mechanics should give time to think (see adaptive think time in `js/kit.js`, 0–4 s, starts at 3 s).
- Original art and sounds only. No characters, ships, logos or sounds from existing franchises.
- Every game feeds the shared scheduler. Report typed answers with `kind: 'produce'` and pick/tap answers with `kind: 'verify'`;
  only `produce` can make a fact fluent. Tag wrong answers with an error kind (`FF.distract.classify`) when you can.
- After a wrong answer, show the right answer and why (a hop, an array, a line of text) before moving on.
- Every end screen has a way back to the hub (`../`).

## Don't break
- `web/config.js` holds the Sheet endpoint, shared key and player list. Players `nabil` and `krishna` sync to the Sheet; `guest` stays on the device.
- Saved progress lives in localStorage under `figures-formulas-v2` (first player) and `figures-formulas-v2:<player>`. Don't rename these keys.
- `apps-script/Code.gs` runs as a deployed web app. If you change it, Krishna has to paste it into the Sheet's Apps Script editor and deploy a new version.
- New files under `web/` that a game needs must be added to `SHELL` in `web/sw.js`.
- Asset URLs carry `?v=__BUILD__`; the deploy replaces it with the commit hash. Keep that on new script/style tags.

## Deploy
Push to `main`. `.github/workflows/pages.yml` publishes `web/` to GitHub Pages in about a minute (`gh run list -R kcy/figures-formulas --limit 1`).
iPads may need a reload or two to pick up a new version.

## Testing
Open `web/<game>/index.html` directly (file://) in a browser, or screenshot with Playwright at the "iPad Pro 11" device size,
click `#ovPlay`, and check for page errors. The kit games expose `window.__game()` for tests.
Check the hub too after adding a game.

## Commits
Small, descriptive commits straight to `main`. Bump the game's `VERSION` constant when its behavior changes.
