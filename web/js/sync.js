/* Figures & Formulas — keeps a player's state in step with the Sheet. Shared by every game.
 *
 *   const sync = new FF.Sync({ player, getState, getSched, onStatus, onLoaded });
 *   sync.load()           pull settings, custom facts, disabled ids and progress; merge into state
 *   sync.save(session?)   push changed cards (and a session row); debounced, retried next time on failure
 *   sync.settings()       push this player's settings
 * Without an endpoint in config.js every call is a no-op and onStatus reports 'local'.
 */
(function (root) {
  'use strict';
  const { SheetStore, mergeProgress } = root.FF.store;
  const CFG = root.FF_CONFIG || {};

  function Sync(o) {
    this.player = o.player; this.getState = o.getState; this.getSched = o.getSched;
    this.onStatus = o.onStatus || function () {}; this.onLoaded = o.onLoaded || function () {};
    this.remote = CFG.endpoint ? new SheetStore(Object.assign({}, CFG, { player: o.player })) : null;
    this.timer = null;
    if (!this.remote) this.onStatus('local', 'LOCAL', 'Progress is saved in this browser');
  }
  const P = Sync.prototype;
  P.applySettings = function (rs) {
    if (!rs) return; const s = this.getState().settings, FAM = root.FF.facts.FAM;
    if (rs.fams) for (const f in rs.fams) if (FAM[f]) s.fams[f] = !!rs.fams[f];
    for (const k of ['maxLayer', 'newPerDay', 'goal']) if (rs[k] != null && !isNaN(+rs[k])) s[k] = +rs[k];
  };
  P.load = async function () {
    if (!this.remote) return;
    this.onStatus('busy', 'SYNC…');
    try {
      const r = await this.remote.load(), S = this.getState(), sched = this.getSched();
      if (r.facts && r.facts.length) root.FF.facts.addCustom(r.facts);
      this.applySettings(r.settings);
      if (r.disabled) sched.disabled = new Set(r.disabled);
      if (r.progress) mergeProgress(S.cards, r.progress);
      S.synced = Date.now(); sched.onChange();
      this.onStatus('ok', 'SHEET ✓', 'Loaded from your Sheet ' + new Date().toLocaleTimeString());
      if (r.needCatalog) { const ITEMS = root.FF.facts.ITEMS; this.remote.sendCatalog(Object.values(ITEMS).map(it => ({ id: it.id, prompt: it.prompt, answer: it.answer, fam: it.fam, op: it.op, layer: it.layer, strategy: it.strategy, mode: it.mode }))).catch(() => {}); }
      this.onLoaded();
    } catch (e) { this.onStatus('err', 'SHEET ✗', 'Could not reach the Sheet: ' + (this.remote.lastError || e)); }
  };
  P.save = function (session) {
    if (!this.remote) return;
    const sched = this.getSched(), rows = sched.flushDirty();
    if (!rows.length && !session) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      this.onStatus('busy', 'SYNC…');
      try { const S = this.getState(); await this.remote.saveProgress(rows, session, S.history.slice(-1)[0]); S.synced = Date.now(); sched.onChange(); this.onStatus('ok', 'SHEET ✓', 'Saved to your Sheet ' + new Date().toLocaleTimeString()); }
      catch (e) { rows.forEach(r => sched.dirty.add(r.id)); this.onStatus('err', 'SHEET ✗', 'Save failed, will retry: ' + (this.remote.lastError || e)); }
    }, 300);
  };
  P.flushNow = function () { if (!this.remote) return; clearTimeout(this.timer); const sched = this.getSched(), rows = sched.flushDirty(); if (rows.length) this.remote.saveProgress(rows, null, this.getState().history.slice(-1)[0]).catch(() => {}); };
  P.settings = function () { if (!this.remote) return; const s = this.getState().settings; this.remote.saveSettings({ fams: s.fams, maxLayer: s.maxLayer, newPerDay: s.newPerDay, goal: s.goal }).catch(() => {}); };
  P.statusLine = function () { const S = this.getState(); return this.remote ? (this.remote.status === 'error' ? 'Sheet sync failed: ' + (this.remote.lastError || '') : 'Synced with your Sheet' + (S.synced ? ' · last ' + new Date(S.synced).toLocaleString() : '')) : 'Progress is saved in this browser only (no Sheet configured).'; };

  root.FF.Sync = Sync;
})(typeof window !== 'undefined' ? window : globalThis);
