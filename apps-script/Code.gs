/**
 * Figures & Formulas — Google Sheet backend.
 *
 * Paste this whole file into Extensions → Apps Script in your Sheet, set SECRET below,
 * run setup() once (it creates the tabs), then Deploy → New deployment → Web app with
 *   Execute as: Me        Who has access: Anyone
 * and put the …/exec URL plus the same SECRET into web/config.js.
 *
 * Tabs it keeps:
 *   Settings   key | value                    — goal, newPerDay, maxLayer, fam_add … fam_negmul (TRUE/FALSE)
 *   Facts      id | prompt | answer | fam | op | layer | strategy | mode | enabled | custom
 *              The game fills this with its whole catalog the first time it connects.
 *              Add your own rows (set custom = TRUE) and they enter his rotation. Set enabled = FALSE to pull one.
 *   Progress   one row per fact the player has seen; the game updates it after each wave
 *   Sessions   one row per run
 *   History    one row per day: answers and correct answers
 * With several players, Progress/Sessions/History/Settings get a "_<player>" suffix (e.g. Progress_krishna).
 * The plain Settings tab holds the defaults; Settings_<player> overrides it for that player.
 */
var SECRET = 'change-me';

var PROGRESS_COLS = ['id', 'prompt', 'fam', 'strategy', 'stage', 'att', 'ok', 'accuracy', 'median_s', 'lapses', 'interval_d', 'due', 'reps', 'ease', 'fast_streak', 'last_review', 'updated'];
var FACT_COLS = ['id', 'prompt', 'answer', 'fam', 'op', 'layer', 'strategy', 'mode', 'enabled', 'custom'];
var SESSION_COLS = ['ts', 'player', 'game', 'version', 'wave', 'score', 'answers', 'correct', 'facts', 'bestStreak', 'seconds'];
var HISTORY_COLS = ['date', 'answers', 'correct'];
var DEFAULT_SETTINGS = { goal: 60, newPerDay: 12, maxLayer: 2, fam_add: true, fam_sub: true, fam_neg: true, fam_mul: false, fam_div: false, fam_negmul: false };

function setup() {
  var ss = SpreadsheetApp.getActive();
  var st = sheet(ss, 'Settings', ['key', 'value']);
  if (st.getLastRow() < 2) { var rows = Object.keys(DEFAULT_SETTINGS).map(function (k) { return [k, DEFAULT_SETTINGS[k]]; }); st.getRange(2, 1, rows.length, 2).setValues(rows); }
  sheet(ss, 'Facts', FACT_COLS);
  sheet(ss, 'Progress', PROGRESS_COLS);
  sheet(ss, 'Sessions', SESSION_COLS);
  sheet(ss, 'History', HISTORY_COLS);
  var first = ss.getSheets()[0]; if (first.getName() === 'Sheet1' && first.getLastRow() === 0) ss.deleteSheet(first);
}

function doGet(e) { return out({ ok: true, hint: 'POST JSON with {key, action}.' }); }

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (!SECRET || body.key !== SECRET) return out({ error: 'bad key' });
    var player = String(body.player || 'default').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'default';
    var ss = SpreadsheetApp.getActive();
    switch (body.action) {
      case 'load': return out(load(ss, player));
      case 'save': return out(save(ss, player, body));
      case 'catalog': return out(catalog(ss, body.facts || []));
      case 'settings': return out(saveSettings(ss, player, body.settings || {}));
      default: return out({ error: 'unknown action' });
    }
  } catch (err) { return out({ error: String(err) }); }
  finally { lock.releaseLock(); }
}

/* ---------- actions ---------- */
function load(ss, player) {
  var settings = readSettings(ss, player);
  var facts = sheet(ss, 'Facts', FACT_COLS), fr = rows(facts), custom = [], disabled = [];
  fr.forEach(function (r) {
    if (String(r.enabled).toUpperCase() === 'FALSE') disabled.push(r.id);
    if (String(r.custom).toUpperCase() === 'TRUE') custom.push({ id: r.id, prompt: r.prompt, answer: r.answer, fam: r.fam, op: r.op, layer: r.layer, strategy: r.strategy, mode: r.mode });
  });
  var pr = rows(sheet(ss, suffixed('Progress', player), PROGRESS_COLS)), progress = {};
  pr.forEach(function (r) {
    if (!r.id) return;
    progress[r.id] = { att: num(r.att), ok: num(r.ok), lapses: num(r.lapses), iv: num(r.interval_d), due: r.due ? new Date(r.due).getTime() : 0, reps: num(r.reps),
      e: num(r.ease) || 2.5, fs: num(r.fast_streak), stage: r.stage || 'learning', lo: r.last_review ? isoDay(new Date(r.last_review)) : '', rts: r.median_s ? [num(r.median_s)] : [] };
  });
  return { settings: settings, facts: custom, disabled: disabled, progress: progress, needCatalog: fr.length === 0 };
}

function save(ss, player, body) {
  var n = 0;
  if (body.progress && body.progress.length) {
    var sh = sheet(ss, suffixed('Progress', player), PROGRESS_COLS), index = idIndex(sh), now = new Date();
    body.progress.forEach(function (c) {
      var row = [c.id, c.prompt || '', c.fam || '', c.strategy || '', c.stage, c.att, c.ok, c.att ? Math.round(1000 * c.ok / c.att) / 10 : '', c.median ? Math.round(c.median * 100) / 100 : '',
        c.lapses, c.iv, c.due ? new Date(c.due) : '', c.reps, Math.round(c.e * 100) / 100, c.fs, c.lo || '', now];
      var r = index[c.id];
      if (r) sh.getRange(r, 1, 1, row.length).setValues([row]); else { sh.appendRow(row); index[c.id] = sh.getLastRow(); }
      n++;
    });
    // fill prompt/fam/strategy from the Facts tab for rows the game sent without them
    fillFromFacts(ss, sh);
  }
  if (body.session) {
    var s = body.session; sheet(ss, suffixed('Sessions', player), SESSION_COLS).appendRow([new Date(s.ts), player, s.game, s.version, s.wave, s.score, s.answers, s.correct, s.facts, s.bestStreak, s.seconds]);
  }
  if (body.history && body.history.d) {
    var hs = sheet(ss, suffixed('History', player), HISTORY_COLS), hv = hs.getDataRange().getValues(), hit = 0;
    for (var i = 1; i < hv.length; i++) if (isoDay(hv[i][0]) === body.history.d) { hit = i + 1; break; }
    var hrow = [body.history.d, body.history.n, body.history.ok];
    if (hit) hs.getRange(hit, 1, 1, 3).setValues([hrow]); else hs.appendRow(hrow);
  }
  return { ok: true, saved: n };
}

function catalog(ss, facts) {
  var sh = sheet(ss, 'Facts', FACT_COLS), index = idIndex(sh), add = [];
  facts.forEach(function (f) { if (!index[f.id]) add.push([f.id, f.prompt, f.answer, f.fam, f.op, f.layer, f.strategy, f.mode, true, false]); });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, FACT_COLS.length).setValues(add);
  return { ok: true, added: add.length };
}

function saveSettings(ss, player, s) {
  var flat = {};
  Object.keys(s).forEach(function (k) { if (k === 'fams') Object.keys(s.fams).forEach(function (f) { flat['fam_' + f] = !!s.fams[f]; }); else flat[k] = s[k]; });
  var sh = sheet(ss, suffixed('Settings', player), ['key', 'value']), v = sh.getDataRange().getValues(), seen = {};
  for (var i = 1; i < v.length; i++) { var k = v[i][0]; if (k in flat) { sh.getRange(i + 1, 2).setValue(flat[k]); seen[k] = 1; } }
  Object.keys(flat).forEach(function (k) { if (!seen[k]) sh.appendRow([k, flat[k]]); });
  return { ok: true };
}

/* ---------- helpers ---------- */
function readSettings(ss, player) {
  var s = { fams: {} };
  var apply = function (name) {
    var sh = ss.getSheetByName(name); if (!sh) return;
    var v = sh.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      var k = String(v[i][0]), val = v[i][1]; if (!k || val === '') continue;
      if (k.indexOf('fam_') === 0) s.fams[k.slice(4)] = (val === true || String(val).toUpperCase() === 'TRUE');
      else s[k] = val;
    }
  };
  apply('Settings'); if (player !== 'default') apply(suffixed('Settings', player)); // shared defaults, then the player's overrides
  return s;
}
function fillFromFacts(ss, prog) {
  var pv = prog.getDataRange().getValues(); if (pv.length < 2) return;
  var missing = false; for (var i = 1; i < pv.length; i++) if (!pv[i][1]) { missing = true; break; }
  if (!missing) return;
  var facts = {}; rows(sheet(ss, 'Facts', FACT_COLS)).forEach(function (f) { facts[f.id] = f; });
  for (var r = 1; r < pv.length; r++) { var f = facts[pv[r][0]]; if (f && !pv[r][1]) prog.getRange(r + 1, 2, 1, 3).setValues([[f.prompt, f.fam, f.strategy]]); }
}
function sheet(ss, name, cols) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function rows(sh) {
  var v = sh.getDataRange().getValues(); if (v.length < 2) return [];
  var h = v[0], out = [];
  for (var i = 1; i < v.length; i++) { var o = {}; for (var j = 0; j < h.length; j++) o[h[j]] = v[i][j]; out.push(o); }
  return out;
}
function idIndex(sh) { var v = sh.getDataRange().getValues(), m = {}; for (var i = 1; i < v.length; i++) if (v[i][0]) m[v[i][0]] = i + 1; return m; }
function suffixed(base, player) { return player === 'default' ? base : base + '_' + player; }
function num(x) { var n = Number(x); return isNaN(n) ? 0 : n; }
function isoDay(d) { if (!(d instanceof Date)) return String(d); return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
