/* Figures & Formulas — the scheduler. Game-agnostic.
 *
 * Any game asks  next(excludeIds, excludeAnswers)  for an item id, and reports back
 * report(id, ok, rtSeconds)  after the player answers. Everything about *what to ask and when*
 * lives here, so a second game with different mechanics reuses it unchanged.
 *
 * Two loops:
 *   in-session  — a miss comes back 45–75 s later, inside the same run
 *   across days — SM-2 intervals graded by correctness + response time (fast / normal / slow)
 * A fact is 'fluent' only after 3 consecutive fast answers; until then its interval is capped at 4 days.
 */
(function (root) {
  'use strict';
  const DAY = 86400000;

  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function newCard() { return { e: 2.5, iv: 0, due: 0, reps: 0, lapses: 0, att: 0, ok: 0, rts: [], fs: 0, stage: 'new', lo: '' }; }

  function Scheduler(facts, state, opts) {
    this.F = facts; this.S = state;
    this.onChange = (opts && opts.onChange) || function () {};
    this.replay = []; this.sessionDone = new Set(); this.sessionCount = {}; this.recent = []; this.dirty = new Set();
    this.disabled = new Set(); // ids switched off in the Sheet's Facts tab
  }
  const P = Scheduler.prototype;

  P.rollDaily = function () { if (this.S.daily.date !== today()) this.S.daily = { date: today(), newCount: 0 }; };
  P.famOn = function (id) { const it = this.F.ITEMS[id]; if (!it) return false; const s = this.S.settings; return !!s.fams[it.fam] && it.layer <= (s.maxLayer || 2) && !this.disabled.has(id); };
  P.newSession = function () { this.replay = []; this.sessionDone = new Set(); this.sessionCount = {}; this.recent = []; };
  P.todayCount = function () { const h = this.S.history[this.S.history.length - 1]; return h && h.d === today() ? h.n : 0; };
  P.dueCount = function () { const now = Date.now(); return Object.keys(this.S.cards).filter(id => this.famOn(id) && this.S.cards[id].due <= now).length; };
  P.accuracy = function () { return this.recent.length >= 8 ? this.recent.filter(Boolean).length / this.recent.length : 1; };
  P.fastFor = function (id) { return this.F.FAM[this.F.ITEMS[id].fam].fast; };

  /* opts.kind: 'produce' (typed the answer, default) or 'verify' (judged an answer true/false — a slicing game).
   * Both schedule the fact; only production advances the fluency streak, so a fact is never 'fluent' on recognition alone.
   * opts.error: a short tag for the kind of mistake (sign, off_by_one, neighbor_table …), tallied per fact for the Sheet.
   * opts.fastMul: the game's own idea of 'fast' relative to the family target (a swipe is slower than a keypress). */
  P.report = function (id, ok, rt, opts) {
    opts = opts || {};
    this.rollDaily();
    const S = this.S, now = Date.now(), fast0 = this.fastFor(id) * (opts.fastMul || 1), verify = opts.kind === 'verify';
    let c = S.cards[id]; if (!c) { c = S.cards[id] = newCard(); S.daily.newCount++; }
    c.att++; S.meta.answers++;
    if (verify) { c.vatt = (c.vatt || 0) + 1; if (ok) c.vok = (c.vok || 0) + 1; }
    if (!ok && opts.error) { c.err = c.err || {}; c.err[opts.error] = (c.err[opts.error] || 0) + 1; }
    if (!ok) {
      c.lapses++; c.reps = 0; c.iv = 0; c.e = Math.max(1.3, c.e - 0.2); c.fs = 0; c.stage = 'learning'; c.due = now + 10 * 60000;
      this.replay.push({ id, at: now + 45000 + Math.random() * 30000 });
    } else {
      c.ok++; c.rts.push(Math.round(rt * 100) / 100); if (c.rts.length > 6) c.rts.shift();
      const fast = rt < fast0, slow = rt > fast0 * 2, q = fast ? 5 : slow ? 3 : 4;
      c.fs = verify ? c.fs : (fast ? c.fs + 1 : 0);
      if (c.lo !== today()) { // one scheduled review per day; extra hits in a session feed the fluency streak only
        if (c.reps === 0) c.iv = 1; else if (c.reps === 1) c.iv = 3; else c.iv = c.iv * (q === 3 ? 1.2 : q === 4 ? c.e : c.e * 1.3);
        c.reps++; c.e = Math.max(1.3, c.e + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)); c.lo = today();
      }
      if (c.fs >= 3 && c.reps >= 3) c.stage = 'fluent'; else { c.stage = c.reps >= 2 ? 'review' : 'learning'; c.iv = Math.min(c.iv, 4); }
      c.iv = Math.round(c.iv * 10) / 10; c.due = now + c.iv * DAY;
      this.sessionDone.add(id);
    }
    let h = S.history[S.history.length - 1];
    if (!h || h.d !== today()) { h = { d: today(), n: 0, ok: 0 }; S.history.push(h); if (S.history.length > 90) S.history.shift(); }
    h.n++; if (ok) h.ok++;
    this.recent.push(ok); if (this.recent.length > 20) this.recent.shift();
    this.dirty.add(id);
    this.onChange();
  };

  /* opts.filter(item) narrows to facts a game can show (e.g. only add/sub on a number line).
   * opts.ignoreFamilies lets a game use facts outside the player's family switches (Array Grid always uses times tables). */
  P.next = function (excludeIds, excludeAnswers, opts) {
    opts = opts || {};
    const S = this.S, F = this.F, now = Date.now();
    const ids = new Set(excludeIds || []), ans = new Set(excludeAnswers || []);
    const inScope = id => opts.ignoreFamilies ? (F.ITEMS[id] && !this.disabled.has(id)) : this.famOn(id);
    const okItem = id => F.ITEMS[id] && inScope(id) && (!opts.filter || opts.filter(F.ITEMS[id])) && !ids.has(id) && !ans.has(F.ITEMS[id].answer);
    const take = id => { this.sessionCount[id] = (this.sessionCount[id] || 0) + 1; return id; };
    for (let i = 0; i < this.replay.length; i++) if (this.replay[i].at <= now && okItem(this.replay[i].id)) return take(this.replay.splice(i, 1)[0].id);
    const due = Object.keys(S.cards).filter(id => S.cards[id].due <= now && okItem(id) && !this.sessionDone.has(id)).sort((a, b) => S.cards[a].due - S.cards[b].due);
    if (due.length) return take(due[0]);
    this.rollDaily();
    if (S.daily.newCount < S.settings.newPerDay) { const id = F.ORDER.find(id => !S.cards[id] && okItem(id)); if (id) { S.cards[id] = newCard(); S.daily.newCount++; this.dirty.add(id); this.onChange(); return take(id); } }
    const pool = Object.keys(S.cards).filter(id => okItem(id) && !this.sessionDone.has(id));
    if (pool.length) { // weakest-of-a-sample: slow, low ease, lapsed facts come up more
      let best = null, bs = -1; const n = Math.min(pool.length, 12);
      for (let k = 0; k < n; k++) { const id = pool[Math.floor(Math.random() * pool.length)]; const c = S.cards[id]; const f = this.fastFor(id);
        const m = c.rts.length ? median(c.rts) : f * 2; const s = 1 / c.e + m / f + c.lapses * .5; if (s > bs) { bs = s; best = id; } }
      return take(best);
    }
    const any = Object.keys(S.cards).filter(okItem);
    if (any.length) { any.sort((a, b) => (this.sessionCount[a] || 0) - (this.sessionCount[b] || 0) || Math.random() - .5); return take(any[0]); }
    const fresh = F.ORDER.find(id => !S.cards[id] && okItem(id));
    if (fresh) { S.cards[fresh] = newCard(); S.daily.newCount++; this.dirty.add(fresh); this.onChange(); return take(fresh); }
    return null;
  };

  /* Progress rows for the Sheet: one per card that changed since the last flush. */
  P.flushDirty = function () {
    const out = [];
    for (const id of this.dirty) { const c = this.S.cards[id]; if (c) out.push(Object.assign({ id, median: median(c.rts), errors: c.err ? Object.entries(c.err).map(([k, v]) => k + ':' + v).join(' ') : '' }, c)); }
    this.dirty.clear();
    return out;
  };

  /* Roll-ups for a stats screen. */
  P.summary = function () {
    const F = this.F, S = this.S, now = Date.now(), cards = Object.entries(S.cards);
    const by = key => { const m = {}; for (const [id, c] of cards) { const k = key(F.ITEMS[id]); if (!k) continue; const r = m[k] = m[k] || { n: 0, att: 0, ok: 0, rts: [], stages: { new: 0, learning: 0, review: 0, fluent: 0 }, due: 0 };
      r.n++; r.att += c.att; r.ok += c.ok; r.rts.push(...c.rts); r.stages[c.stage]++; if (c.due <= now) r.due++; }
      for (const k in m) m[k].median = median(m[k].rts); return m; };
    return {
      byFam: by(it => it && it.fam), byStrategy: by(it => it && it.strategy),
      leeches: cards.filter(([, c]) => c.lapses >= 3 || (c.att >= 4 && c.ok / c.att < .7)).sort((a, b) => b[1].lapses - a[1].lapses || a[1].ok / a[1].att - b[1].ok / b[1].att).map(([id, c]) => ({ id, c })),
      slow: cards.filter(([id, c]) => F.ITEMS[id] && c.rts.length >= 2).map(([id, c]) => ({ id, c, ratio: median(c.rts) / this.fastFor(id) })).filter(x => x.ratio > 1.6).sort((a, b) => b.ratio - a.ratio),
      fluent: cards.filter(([, c]) => c.stage === 'fluent').length, seen: cards.length
    };
  };

  root.FF = root.FF || {};
  root.FF.Scheduler = Scheduler;
  root.FF.util = { today, median, newCard, DAY };
})(typeof window !== 'undefined' ? window : globalThis);
