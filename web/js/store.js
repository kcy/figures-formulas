/* Figures & Formulas — where progress lives.
 *
 * LocalStore  : this browser's storage. Always on; the game never waits on the network.
 * SheetStore  : a Google Sheet behind an Apps Script web app (see apps-script/). Optional —
 *               set FF_CONFIG.endpoint in config.js to turn it on. The game loads from it at
 *               start (settings, custom facts, progress) and posts changed progress after
 *               each wave and each run. If it is unreachable the game carries on locally and
 *               retries next time.
 */
(function (root) {
  'use strict';
  const KEY = 'figures-formulas-v2';

  function defaultState() {
    return { v: 2, cards: {}, daily: { date: '', newCount: 0 },
      meta: { runs: 0, kills: 0, best: 0, bestWave: 0, answers: 0 },
      settings: { fams: { add: true, sub: true, neg: true, mul: false, div: false, negmul: false }, maxLayer: 2, newPerDay: 12, goal: 60, sound: true, numpad: null },
      history: [], synced: 0 };
  }
  function merge(d, o) {
    if (!o) return d;
    const s = Object.assign({}, d.settings, o.settings || {});
    s.fams = Object.assign({}, d.settings.fams, (o.settings && o.settings.fams) || {});
    return Object.assign({}, d, o, { settings: s });
  }

  /* One saved state per player. The first player keeps the pre-player save, so nothing is lost on upgrade. */
  const keyFor = (player, first) => (player === first ? KEY : KEY + ':' + player);
  const LocalStore = {
    load(player, first) { try { const r = localStorage.getItem(keyFor(player, first)) || (player === first ? localStorage.getItem('figures-formulas-v1') : null); if (r) return merge(defaultState(), JSON.parse(r)); } catch (e) {} return defaultState(); },
    save(S, player, first) { try { localStorage.setItem(keyFor(player, first), JSON.stringify(S)); } catch (e) {} },
    currentPlayer(fallback) { try { return localStorage.getItem(KEY + ':player') || fallback; } catch (e) { return fallback; } },
    setPlayer(p) { try { localStorage.setItem(KEY + ':player', p); } catch (e) {} }
  };

  function SheetStore(cfg) { this.url = cfg.endpoint; this.key = cfg.key || ''; this.player = cfg.player || 'default'; this.status = 'idle'; this.lastError = null; }
  SheetStore.prototype.call = async function (body) {
    this.status = 'busy';
    try {
      // text/plain keeps the browser from sending a CORS preflight, which Apps Script cannot answer.
      const res = await fetch(this.url, { method: 'POST', body: JSON.stringify(Object.assign({ key: this.key, player: this.player }, body)), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      this.status = 'ok'; this.lastError = null; return j;
    } catch (e) { this.status = 'error'; this.lastError = String(e && e.message || e); throw e; }
  };
  /* -> { settings:{...overrides}, facts:[custom rows], progress:{id:card}, needCatalog:bool } */
  SheetStore.prototype.load = function () { return this.call({ action: 'load' }); };
  SheetStore.prototype.saveProgress = function (rows, session, history) { return this.call({ action: 'save', progress: rows, session: session || null, history: history || null }); };
  SheetStore.prototype.sendCatalog = function (items) { return this.call({ action: 'catalog', facts: items }); };
  SheetStore.prototype.saveSettings = function (settings) { return this.call({ action: 'settings', settings }); };

  /* Merge remote progress into local: per card, keep whichever has seen more attempts (ties -> remote). */
  function mergeProgress(local, remote) {
    for (const id in remote) { const r = remote[id], l = local[id]; if (!l || (r.att || 0) >= (l.att || 0)) local[id] = Object.assign({}, l || {}, r); }
    return local;
  }

  root.FF = root.FF || {};
  root.FF.store = { KEY, defaultState, LocalStore, SheetStore, mergeProgress };
})(typeof window !== 'undefined' ? window : globalThis);
