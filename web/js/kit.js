/* Figures & Formulas — shared game kit for the newer games (Lily Hop, Bubble Pop, Pace Race, Array Grid).
 * One call wires a page to the player, the scheduler, the Sheet, think time, sound and the common overlays,
 * so each game file only has to draw its world and run its loop.
 *
 *   const K = FF.kit({ game: 'hop', title: 'Lily Hop', thinkKey: 'thinkHop' });
 *   K.S, K.sched, K.sync, K.save()          state, scheduler, Sheet sync
 *   K.next(filter, opts)                    next fact id the game can show
 *   K.report(id, ok, seconds, opts)         same as sched.report, then save
 *   K.think(), K.adjustThink(d)             adaptive think time for this game, 0–4 s, starts at 3
 *   K.options(item, n)                      the answer plus n-1 plausible wrong answers, shuffled
 *   K.overlay(html), K.hide(), K.title(...) K.result(...)   cards over the play field
 *   K.keypad(el, onKey)                     an on-screen number pad that also listens to the keyboard
 *   K.sfx.good() / bad() / tick() / win() / pop() / hop()
 */
(function (root) {
  'use strict';
  const $ = s => document.querySelector(s);
  const { fmt } = root.FF.facts;

  /* ---------- plausible wrong answers (the same slips Slice of Truth uses) ---------- */
  function parse(it) { const m = it.prompt.replace(/[()]/g, '').replace(/−/g, '-').match(/^(-?\d+)\s*([+\-×÷])\s*(-?\d+)$/); return m ? { a: +m[1], op: m[2], b: +m[3] } : null; }
  function candidates(it) {
    const ans = it.answer, o = parse(it) || { a: 0, b: 0, op: '+' }, c = [];
    const add = (v, tag) => { if (v !== ans && Number.isInteger(v) && Math.abs(v) < 400) c.push([v, tag]); };
    switch (it.fam) {
      case 'add': add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one'); add(ans + 2, 'off_by_two'); add(ans - 2, 'off_by_two'); add(ans + 10, 'tens_slip'); add(ans - 10, 'tens_slip'); break;
      case 'sub': add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one'); add(ans + 2, 'off_by_two'); add(ans - 2, 'off_by_two'); add(o.a + o.b, 'added_instead'); add(ans + 10, 'tens_slip'); break;
      case 'neg': add(-ans, 'sign_flip'); add(Math.abs(o.a) + Math.abs(o.b), 'ignored_signs'); add(-(Math.abs(o.a) + Math.abs(o.b)), 'ignored_signs'); add(Math.abs(Math.abs(o.a) - Math.abs(o.b)), 'ignored_signs'); add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one'); add(o.op === '-' ? o.a + o.b : o.a - o.b, 'wrong_operation'); break;
      case 'mul': add(o.a * (o.b + 1), 'neighbor_table'); add(o.a * (o.b - 1), 'neighbor_table'); add((o.a + 1) * o.b, 'neighbor_table'); add((o.a - 1) * o.b, 'neighbor_table'); if (ans >= 10 && ans % 11) add(+String(ans).split('').reverse().join(''), 'digit_swap'); add(o.a + o.b, 'added_instead'); break;
      case 'div': add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one'); add(o.b, 'other_factor'); add(ans + 2, 'off_by_two'); break;
      case 'negmul': add(-ans, 'sign_flip'); { const m = Math.abs(o.a), n = Math.abs(o.b); if (o.op === '×') { add(Math.sign(ans) * m * (n + 1), 'neighbor_table'); add(Math.sign(ans) * (m + 1) * n, 'neighbor_table'); } else { add(ans + Math.sign(ans || 1), 'off_by_one'); add(ans - Math.sign(ans || 1), 'off_by_one'); } } break;
      default: add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one');
    }
    if (!c.length) c.push([ans + 1, 'off_by_one']);
    return c;
  }
  function falseAnswer(it) {
    const c = candidates(it);
    const pick = Math.random() < .55 ? c[Math.floor(Math.random() * Math.min(2, c.length))] : c[Math.floor(Math.random() * c.length)];
    return { value: pick[0], tag: pick[1] };
  }
  function options(it, n) {
    const out = [{ value: it.answer, isAnswer: true, tag: null }], seen = new Set([it.answer]);
    for (let k = 0; k < 20 && out.length < n; k++) { const f = falseAnswer(it); if (!seen.has(f.value)) { seen.add(f.value); out.push({ value: f.value, isAnswer: false, tag: f.tag }); } }
    for (let d = 1; out.length < n; d++) for (const v of [it.answer + d, it.answer - d]) if (out.length < n && !seen.has(v)) { seen.add(v); out.push({ value: v, isAnswer: false, tag: 'off_by_' + d }); }
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  /* name the slip behind a typed wrong answer, when it matches a common one */
  function classify(it, n) {
    if (n === it.answer) return null;
    if (n === -it.answer) return 'sign_flip';
    const hit = candidates(it).find(([v]) => v === n); if (hit) return hit[1];
    return Math.abs(n - it.answer) === 1 ? 'off_by_one' : 'other';
  }
  root.FF.distract = { falseAnswer, options, parse, classify };

  /* ---------- the kit ---------- */
  root.FF.kit = function (cfg) {
    const { LocalStore } = root.FF.store, P = root.FF.player;
    const player = P.current();
    const S = LocalStore.load(player, P.FIRST);
    const save = () => LocalStore.save(S, player, P.FIRST);
    const sched = new root.FF.Scheduler(root.FF.facts, S, { onChange: save });
    const K = { player, S, sched, save, cap: P.cap, PLAYERS: P.PLAYERS, fmt, cfg };
    K.sync = new root.FF.Sync({ player, getState: () => S, getSched: () => sched,
      onStatus: (cls, text, title) => { const el = $('#hudSync'); if (el) { el.className = 'sync ' + (cls === 'local' ? '' : cls); el.textContent = text; el.title = title || ''; } },
      onLoaded: () => { if (K.onLoaded) K.onLoaded(); } });

    K.next = (filter, opts) => sched.next([], [], Object.assign({ filter }, opts || {}));
    K.report = (id, ok, rt, opts) => { sched.report(id, ok, rt, opts); };
    K.options = options;
    const TK = cfg.thinkKey || ('think_' + cfg.game);
    K.think = () => (S.meta[TK] == null ? (cfg.thinkStart != null ? cfg.thinkStart : 3) : S.meta[TK]);
    K.adjustThink = d => { S.meta[TK] = Math.round(Math.max(0, Math.min(4, K.think() + d)) * 100) / 100; };
    K.best = () => (S.meta['best_' + cfg.game] || 0);
    K.setBest = v => { if (v > K.best()) S.meta['best_' + cfg.game] = v; };
    K.todayLine = () => { const n = sched.todayCount(), g = S.settings.goal; return n >= g ? `Today's goal done ✓ (${n})` : `Today ${n} of ${g}`; };
    K.goalReached = () => sched.todayCount() >= S.settings.goal;
    K.finish = row => { S.meta.runs = (S.meta.runs || 0) + 1; save(); K.sync.save(Object.assign({ ts: new Date().toISOString(), game: cfg.game, version: cfg.version || '1.0.0' }, row)); };
    K.home = () => { K.sync.flushNow(); location.href = '../'; };

    /* ---- sound ---- */
    let AC = null, NOISE = null;
    K.audio = () => { if (!S.settings.sound) return null; try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } };
    const tone = (f0, f1, dur, type = 'sine', vol = .08, delay = 0) => { const ac = K.audio(); if (!ac) return; const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur); g.gain.setValueAtTime(.0001, ac.currentTime); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur); o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + .02); };
    const noise = (dur, f0, f1, vol, type = 'lowpass', delay = 0) => { const ac = K.audio(); if (!ac) return; const t0 = ac.currentTime + delay;
      if (!NOISE) { NOISE = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = ac.createBufferSource(); s.buffer = NOISE; const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
      const g = ac.createGain(); g.gain.setValueAtTime(.0001, ac.currentTime); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur); s.connect(f).connect(g).connect(ac.destination); s.start(t0); s.stop(t0 + dur + .02); };
    K.tone = tone; K.noise = noise;
    K.sfx = {
      good: () => { tone(660, 660, .1, 'triangle', .07); tone(990, 990, .14, 'triangle', .07, .08); },
      bad: () => { tone(220, 140, .3, 'square', .05); },
      tick: () => tone(1400, 1400, .04, 'square', .03),
      pop: () => { noise(.08, 3000, 800, .15, 'bandpass'); tone(900, 1500, .08, 'sine', .06); },
      hop: () => tone(300, 700, .1, 'sine', .06),
      splash: () => noise(.45, 1200, 200, .2),
      win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .16, 'triangle', .08, i * .12)); },
      lose: () => { [523, 440, 349].forEach((f, i) => tone(f, f, .18, 'triangle', .07, i * .14)); },
      goal: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, f, .16, 'triangle', .08, i * .14)); tone(1047, 1047, .6, 'triangle', .09, .6); }
    };

    /* ---- overlays ---- */
    K.overlay = html => { const o = $('#overlay'); o.innerHTML = '<div class="card">' + html + '</div>'; o.hidden = false; };
    K.hide = () => { $('#overlay').hidden = true; };
    K.playersRow = () => (K.PLAYERS.length > 1 ? `<div class="players">${K.PLAYERS.map(p => `<button data-p="${p}" class="${p === player ? 'on' : ''}">${K.cap(p)}</button>`).join('')}</div>` : '');
    K.wirePlayers = () => { document.querySelectorAll('#overlay .players button').forEach(b => b.onclick = () => { if (b.dataset.p === player) return; K.sync.flushNow(); P.set(b.dataset.p); location.reload(); }); };
    /* title({ heading, blurb, extra, onPlay }) */
    K.title = o => {
      K.overlay(`<h1>${o.heading}</h1>${o.blurb ? `<p>${o.blurb}</p>` : ''}${o.extra || ''}${K.playersRow()}
        <div class="row"><button class="btn" id="ovPlay">Play</button><button class="btn ghost" id="ovHome">Games</button></div>
        <p class="small">${K.todayLine()}</p>`);
      $('#ovPlay').onclick = () => { K.audio(); o.onPlay(); }; $('#ovHome').onclick = K.home; K.wirePlayers();
    };
    /* result({ heading, stats:[[value,label],…], lines:[…], onAgain }) */
    K.result = o => {
      K.overlay(`<h1>${o.heading}</h1>
        <div class="bigstats">${o.stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
        ${(o.lines || []).map(l => `<p class="small">${l}</p>`).join('')}
        <p class="small">${K.todayLine()}</p>
        <div class="row"><button class="btn" id="ovAgain">Play again</button><button class="btn ghost" id="ovHome">Games</button></div>`);
      $('#ovAgain').onclick = () => { K.audio(); o.onAgain(); }; $('#ovHome').onclick = K.home;
    };
    K.pauseCard = (onResume, onEnd) => {
      K.overlay(`<h1>Paused</h1><div class="row"><button class="btn" id="ovRes">Resume</button><button class="btn ghost" id="ovEnd">End round</button><button class="btn ghost" id="ovHome">Games</button></div>`);
      $('#ovRes').onclick = onResume; $('#ovEnd').onclick = onEnd; $('#ovHome').onclick = () => { onEnd(); K.home(); };
    };

    /* ---- number pad (on screen + keyboard) ---- */
    K.keypad = (el, onKey) => {
      el.innerHTML = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '−', '0', '⌫'].map(k => `<button data-k="${k}">${k}</button>`).join('') + '<button data-k="go" class="go">Go</button>';
      el.addEventListener('pointerdown', ev => { const b = ev.target.closest('button'); if (!b) return; ev.preventDefault(); K.audio(); const k = b.dataset.k; onKey(k === '−' ? '-' : k === '⌫' ? 'bs' : k); });
      document.addEventListener('keydown', ev => {
        const t = ev.target && ev.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
        if (/^[0-9]$/.test(ev.key)) onKey(ev.key); else if (ev.key === '-' || ev.key === '−') onKey('-'); else if (ev.key === 'Backspace' || ev.key === 'Delete') onKey('bs'); else if (ev.key === 'Enter') onKey('go'); else return;
        ev.preventDefault();
      });
    };
    K.sound = btn => { const upd = () => { btn.textContent = S.settings.sound ? '♪' : '✕'; }; upd(); btn.onclick = () => { S.settings.sound = !S.settings.sound; save(); upd(); if (S.settings.sound) K.sfx.good(); }; };
    K.sync.load();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('../sw.js').catch(() => {});
    return K;
  };
})(typeof window !== 'undefined' ? window : globalThis);
