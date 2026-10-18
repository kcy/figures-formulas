/* Slice of Truth — equations fly up on fruit; slice the false ones. Second front end to FF.Scheduler.
 * Every slice or escape is a *verification* exposure of a fact: it schedules the fact like any answer,
 * but never marks it fluent on its own (see scheduler.report). Wrong-answer kinds are tagged so the Sheet
 * shows which mistakes slip past. */
(function () {
'use strict';
const VERSION = '1.2.0', GAME = 'slice';
const ROUND = 60, STRIKES = 3, FAST_MUL = 1.4;
const $ = s => document.querySelector(s);
let W = 800, H = 600, U = 1; // logical size follows the viewport; U scales sizes and physics
const { FAM, ITEMS, ORDER, fmt } = FF.facts;
const { LocalStore } = FF.store;
const { median, today } = FF.util;
const { PLAYERS, cap } = FF.player;

/* ================= STATE, SCHEDULER, SYNC ================= */
let player = FF.player.current();
let S = LocalStore.load(player, FF.player.FIRST);
function save() { LocalStore.save(S, player, FF.player.FIRST); }
let sched = new FF.Scheduler(FF.facts, S, { onChange: save });
function setSync(cls, text, title) { const el = $('#hudSync'); el.className = 'sync ' + (cls === 'local' ? '' : cls); el.textContent = text; el.title = title || ''; }
let sync = new FF.Sync({ player, getState: () => S, getSched: () => sched, onStatus: setSync, onLoaded: () => updateHud() });

/* ================= FALSE ANSWERS =================
 * The wrong answers are the mistakes people actually make; the tag names the slip for the Sheet. */
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function parseOperands(it) { const m = it.prompt.replace(/[()]/g, '').replace(/−/g, '-').match(/^(-?\d+)\s*([+\-×÷])\s*(-?\d+)$/); return m ? { a: +m[1], op: m[2], b: +m[3] } : null; }
function falseAnswer(it) {
  const ans = it.answer, o = parseOperands(it) || { a: 0, b: 0, op: '+' };
  const cands = [];
  const add = (v, tag) => { if (v !== ans && Number.isInteger(v) && Math.abs(v) < 400) cands.push([v, tag]); };
  switch (it.fam) {
    case 'add': add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one'); add(ans + 2, 'off_by_two'); add(ans - 2, 'off_by_two'); add(ans + 10, 'tens_slip'); add(ans - 10, 'tens_slip'); break;
    case 'sub': add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one'); add(ans + 2, 'off_by_two'); add(ans - 2, 'off_by_two'); add(o.a + o.b, 'added_instead'); add(ans + 10, 'tens_slip'); break;
    case 'neg': add(-ans, 'sign_flip'); add(Math.abs(o.a) + Math.abs(o.b), 'ignored_signs'); add(-(Math.abs(o.a) + Math.abs(o.b)), 'ignored_signs'); add(Math.abs(Math.abs(o.a) - Math.abs(o.b)), 'ignored_signs'); add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one'); add(o.op === '-' ? o.a + o.b : o.a - o.b, 'wrong_operation'); break;
    case 'mul': add(o.a * (o.b + 1), 'neighbor_table'); add(o.a * (o.b - 1), 'neighbor_table'); add((o.a + 1) * o.b, 'neighbor_table'); add((o.a - 1) * o.b, 'neighbor_table'); if (ans >= 10 && ans % 11) add(+String(ans).split('').reverse().join(''), 'digit_swap'); add(o.a + o.b, 'added_instead'); break;
    case 'div': add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one'); add(o.b, 'other_factor'); add(ans + 2, 'off_by_two'); break;
    case 'negmul': add(-ans, 'sign_flip'); { const m = Math.abs(o.a), n = Math.abs(o.b); if (o.op === '×') { add(Math.sign(ans) * m * (n + 1), 'neighbor_table'); add(Math.sign(ans) * (m + 1) * n, 'neighbor_table'); } else { add(ans + Math.sign(ans || 1), 'off_by_one'); add(ans - Math.sign(ans || 1), 'off_by_one'); } } break;
    default: add(ans + 1, 'off_by_one'); add(ans - 1, 'off_by_one');
  }
  if (!cands.length) cands.push([ans + 1, 'off_by_one']);
  // bias toward the slips that matter: first two entries are the family's signature mistakes
  const w = Math.random(); const c = w < .55 ? cands[Math.floor(Math.random() * Math.min(2, cands.length))] : pick(cands);
  return { value: c[0], tag: c[1] };
}

/* ================= AUDIO ================= */
let AC = null;
function audio() { if (!S.settings.sound) return null; try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } }
function tone(f0, f1, dur, type = 'square', vol = .08, delay = 0) { const ac = audio(); if (!ac) return; const t0 = ac.currentTime + delay; const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(.0001, ac.currentTime); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + .02); }
let NOISE = null;
function noise(dur, f0, f1, vol, type = 'lowpass', delay = 0) { const ac = audio(); if (!ac) return; const t0 = ac.currentTime + delay;
  if (!NOISE) { NOISE = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(); s.buffer = NOISE; const f = ac.createBiquadFilter(); f.type = type;
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(.0001, ac.currentTime); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t0); s.stop(t0 + dur + .02); }
const SFX = {
  swoosh: () => noise(.18, 600, 4000, .12, 'bandpass'),
  splat: () => { noise(.25, 1200, 150, .25); tone(220, 90, .18, 'sine', .1); },
  strike: () => { tone(140, 70, .45, 'sawtooth', .12); tone(150, 75, .45, 'square', .06, .02); },
  miss: () => tone(330, 260, .18, 'triangle', .05),
  combo: n => { tone(523 * Math.pow(1.06, Math.min(n, 12)), 523 * Math.pow(1.06, Math.min(n, 12)), .09, 'triangle', .05); },
  frenzy: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, f, .12, 'triangle', .07, i * .06)); },
  tick: () => tone(1500, 1500, .04, 'square', .04),
  end: () => { [784, 659, 523].forEach((f, i) => tone(f, f, .18, 'triangle', .07, i * .15)); },
  goal: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, f, .16, 'triangle', .08, i * .14)); tone(1047, 1047, .6, 'triangle', .09, .6); }
};

/* ================= GAME ================= */
const cv = $('#slice'), ctx = cv.getContext('2d');
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let COL = {};
function loadColors() { COL = { top: css('--sky-top'), bot: css('--sky-bot'), glow: css('--glow'), white: css('--ink'), soft: css('--ink-soft'), gold: css('--gold'), red: css('--red'), mint: css('--mint'), warn: css('--gold'), danger: css('--red') }; }
const FONT = () => css('--font');
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight; U = Math.max(.7, Math.min(1.5, Math.min(W, H) / 600)); GRAV = 1000 * (H / 700);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
const FRUIT = [
  { n: 'watermelon', r: 40, skin: '#2b9348', skin2: '#1b5e20', flesh: '#ff4d6d', rind: '#e8f7c8', seed: '#2b1d14', juice: '#ff4d6d' },
  { n: 'orange', r: 34, skin: '#ff9f1c', skin2: '#e36a00', flesh: '#ffbf57', juice: '#ffa62b' },
  { n: 'apple', r: 33, skin: '#ef233c', skin2: '#9d0208', flesh: '#fff3c4', stem: '#5c3d1e', leaf: '#52b788', juice: '#fff1a8' },
  { n: 'lemon', r: 32, skin: '#ffe14d', skin2: '#e0b400', flesh: '#fff7b0', juice: '#ffe66d' },
  { n: 'kiwi', r: 32, skin: '#9c7a4a', skin2: '#6b4f2a', flesh: '#8bd346', seed: '#1d1d1d', juice: '#9be15d' },
  { n: 'plum', r: 31, skin: '#8e44ad', skin2: '#4a1a6b', flesh: '#f6d365', juice: '#c77dff' },
  { n: 'peach', r: 34, skin: '#ffad8a', skin2: '#f07167', flesh: '#ffd6a5', juice: '#ffb38a' },
  { n: 'coconut', r: 35, skin: '#7f5539', skin2: '#4a2f1d', flesh: '#fbfaf5', juice: '#ffffff' }
];
let GRAV = 900;
let G = null, mode = 'title', lastT = 0, effects = [], trail = [], shake = 0, banner = null, lastSliceAt = -1e9;
let pointer = { down: false, x: 0, y: 0 };

/* Two ways to play.
 *   pick  — a problem is pinned at the top; a volley of fruit carries candidate answers; slice the right number.
 *   catch — each fruit carries a whole equation; slice it only if it is wrong. Harder to read, so it runs slower.
 * Fruit fly on a gentler gravity than the juice and halves, so there is time to read. */
const variant = () => (S.settings.sliceMode === 'catch' ? 'catch' : 'pick');
const FRUIT_G = () => GRAV * (variant() === 'pick' ? .42 : .38);
function newRound() {
  G = { t: 0, left: ROUND, score: 0, strikes: 0, combo: 0, bestCombo: 0, fruits: [], halves: [], spawnT: .8, frenzy: 0, frenzyUsed: 0,
    answers: 0, correct: 0, caught: 0, falseAlarms: 0, escapedFalse: 0, missed: 0, practiced: new Set(), startedAt: Date.now(), lastTick: 0,
    q: null, gap: .6, goalShown: sched.todayCount() >= S.settings.goal, goalToast: false };
  sched.newSession(); effects = []; trail = []; banner = null; shake = 0;
}
function startRound() { newRound(); mode = 'play'; overlayHide(); updateHud(); }
function floatText(x, y, text, color, life, big) { effects.push({ k: 'text', x, y, text, color, life, t: 0, big: !!big }); }
function showBanner(text, color, life, big) { banner = { text, color, life, t: 0, big: !!big }; }
function launch(x, apexFrac, payload) {
  const kind = pick(FRUIT), r = kind.r * (variant() === 'pick' ? Math.min(1.6, W / 560) : 1.9) * U, g = FRUIT_G();
  const apexY = H * apexFrac, vy = -Math.sqrt(2 * g * (H + r - apexY));
  const vx = ((W / 2 - x) / W) * W * .06 + (Math.random() - .5) * W * .03;
  G.fruits.push(Object.assign({ kind, r, x, y: H + r, vx, vy, g, rot: Math.random() * Math.PI * 2, vr: (Math.random() - .5) * 1.6, born: G.t, dead: false }, payload));
}
/* ---- pick mode ---- */
function newQuestion() {
  const id = sched.next([], []); if (!id) return;
  const it = ITEMS[id], opts = [{ value: it.answer, isAnswer: true, tag: null }], seen = new Set([it.answer]);
  for (let k = 0; k < 12 && opts.length < (G.t < 20 ? 3 : 4); k++) { const f = falseAnswer(it); if (!seen.has(f.value)) { seen.add(f.value); opts.push({ value: f.value, isAnswer: false, tag: f.tag }); } }
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  G.q = { id, item: it, shownAt: G.t, done: false, graded: false, doneAt: 0 };
  const n = opts.length;
  opts.forEach((o, i) => setTimeout(() => { if (G && G.q && G.q.id === id && mode === 'play') launch(W * (i + 1) / (n + 1), .36 + Math.random() * .12, { id, item: it, qid: G.q, value: o.value, isAnswer: o.isAnswer, tag: o.tag, text: fmt(o.value) }); }, i * 220));
}
function resolve(q) { if (!q || q.done) return; q.done = true; q.doneAt = G.t; for (const f of G.fruits) if (f.qid === q) f.spent = true; }
function pickSlice(f) {
  const q = f.qid; if (f.spent || !q || q.done) return; // leftovers from a settled question are just fruit
  const rt = G.t - q.shownAt;
  if (f.isAnswer) {
    if (!q.graded) { q.graded = true; sched.report(q.id, true, rt, { kind: 'verify', fastMul: FAST_MUL * 1.3 }); G.answers++; G.correct++; G.practiced.add(q.id); }
    G.caught++; G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
    const fast = rt < FAM[q.item.fam].fast * 1.8, pts = 10 + (fast ? 5 : 0) + Math.min(G.combo - 1, 10) * 2; G.score += pts;
    floatText(f.x, f.y - f.r - 10, '+' + pts + (fast ? '  fast!' : ''), COL.gold, 1, G.combo >= 3);
    SFX.splat(); if (G.combo >= 3) SFX.combo(G.combo);
    resolve(q); checkGoal();
  } else {
    if (!q.graded) { q.graded = true; sched.report(q.id, false, rt, { kind: 'verify', error: f.tag }); G.answers++; G.practiced.add(q.id); }
    G.falseAlarms++; G.combo = 0; G.strikes++; shake = .5; SFX.strike();
    showBanner(q.item.prompt + ' = ' + fmt(q.item.answer) + '   (not ' + f.text + ')', COL.red, 2.6, true);
    resolve(q); updateHud(); if (G.strikes >= STRIKES) endRound('strikes');
  }
}
function pickEscaped(f) {
  const q = f.qid; if (!f.isAnswer || f.spent || !q || q.done) return;
  if (!q.graded) { q.graded = true; sched.report(q.id, false, G.t - q.shownAt, { kind: 'verify', error: 'too_slow' }); G.answers++; G.practiced.add(q.id); }
  G.missed++; G.combo = 0; SFX.miss();
  showBanner(q.item.prompt + ' = ' + fmt(q.item.answer), COL.gold, 2.4, true);
  resolve(q);
}
/* ---- catch mode ---- */
function spawn() {
  const id = sched.next(G.fruits.map(f => f.id), []); if (!id) return;
  const it = ITEMS[id];
  const isFalse = Math.random() < .55;
  let shown = it.answer, tag = null;
  if (isFalse) { const f = falseAnswer(it); shown = f.value; tag = f.tag; }
  launch(W * .2 + Math.random() * W * .6, .32 + Math.random() * .14, { id, item: it, text: it.prompt + ' = ' + fmt(shown), isFalse, tag });
}
function catchSlice(f) {
  const rt = G.t - f.born;
  if (f.isFalse) {
    sched.report(f.id, true, rt, { kind: 'verify', fastMul: FAST_MUL * 1.5 }); G.answers++; G.correct++; G.caught++; G.practiced.add(f.id);
    G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
    const pts = 10 + Math.min(G.combo - 1, 10) * 2; G.score += pts;
    floatText(f.x, f.y - f.r - 10, '+' + pts, COL.gold, .9, G.combo >= 3);
    SFX.splat(); if (G.combo >= 3) SFX.combo(G.combo);
    checkGoal();
  } else {
    sched.report(f.id, false, rt, { kind: 'verify', error: 'false_alarm' }); G.answers++; G.falseAlarms++; G.practiced.add(f.id);
    G.combo = 0; G.strikes++; shake = .5; SFX.strike();
    showBanner('That one was right:  ' + f.text, COL.red, 2.4, true);
    updateHud(); if (G.strikes >= STRIKES) endRound('strikes');
  }
}
function catchEscaped(f) {
  const flight = G.t - f.born;
  if (f.isFalse) {
    sched.report(f.id, false, flight, { kind: 'verify', error: 'missed_' + f.tag }); G.answers++; G.escapedFalse++; G.practiced.add(f.id);
    G.combo = 0; SFX.miss();
    showBanner('Got away:  ' + f.text + '   (it’s ' + fmt(f.item.answer) + ')', COL.gold, 2.4);
  } else if (G.t - lastSliceAt < 6) { sched.report(f.id, true, flight, { kind: 'verify', fastMul: FAST_MUL * 1.5 }); G.answers++; G.correct++; G.practiced.add(f.id); checkGoal(); }
}
/* ---- shared ---- */
function sliceFruit(f, ang) {
  f.dead = true; lastSliceAt = G.t;
  for (const side of [-1, 1]) G.halves.push({ f, side, ang, x: f.x, y: f.y, vx: f.vx * .4 + Math.cos(ang + Math.PI / 2) * side * 160 * U, vy: f.vy * .25 - 80 * U, rot: f.rot, vr: side * 3, t: 0 });
  for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, v = (80 + Math.random() * 320) * U; effects.push({ k: 'juice', x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * U, color: f.kind.juice || f.kind.flesh, life: .8, t: 0, r: (2 + Math.random() * 5) * U }); }
  effects.push({ k: 'splat', x: f.x, y: f.y, color: f.kind.juice || f.kind.flesh, life: 3, t: 0, r: f.r * 1.1, ang, seed: Math.random() * 10 });
  effects.push({ k: 'flash', x: f.x, y: f.y, ang, life: .18, t: 0, r: f.r * 2.2 });
  if (f.qid !== undefined) pickSlice(f); else catchSlice(f);
}
function escaped(f) { if (f.qid !== undefined) pickEscaped(f); else catchEscaped(f); }
function checkGoal() { if (!G.goalToast && !G.goalShown && sched.todayCount() >= S.settings.goal) { G.goalToast = true; SFX.goal(); showBanner("Today's goal reached!", COL.gold, 2.6, true); } }
function sessionRow() { return { ts: new Date().toISOString(), game: GAME + '-' + variant(), version: VERSION, wave: 0, score: G.score, answers: G.answers, correct: G.correct, facts: G.practiced.size, bestStreak: G.bestCombo, seconds: Math.round((Date.now() - G.startedAt) / 1000) }; }
function endRound(why) {
  mode = 'over'; S.meta.sliceRuns = (S.meta.sliceRuns || 0) + 1; S.meta.sliceBest = Math.max(S.meta.sliceBest || 0, G.score); save(); sync.save(sessionRow()); SFX.end();
  const n = sched.todayCount(), g = S.settings.goal, acc = G.answers ? Math.round(100 * G.correct / G.answers) : 0;
  const goalNow = !G.goalShown && n >= g; if (goalNow) G.goalShown = true;
  const title = goalNow ? 'Goal reached!' : why === 'strikes' ? 'Three strikes!' : why === 'quit' ? 'Round over' : "Time's up!";
  const pickMode = variant() === 'pick';
  overlay(`<h1>${title}</h1>
    <div class="bigstats"><div><b>${G.score}</b><span>score</span></div><div><b>${G.caught}</b><span>${pickMode ? 'right' : 'caught'}</span></div><div><b>${G.bestCombo}</b><span>best combo</span></div></div>
    <p>${pickMode ? `${G.falseAlarms} wrong slice${G.falseAlarms === 1 ? '' : 's'} · ${G.missed} missed` : `${G.escapedFalse} got away · ${G.falseAlarms} right one${G.falseAlarms === 1 ? '' : 's'} sliced`} · ${acc}% right</p>
    <p class="small">${G.score > 0 && G.score >= (S.meta.sliceBest || 0) ? 'New best! · ' : 'Best ' + (S.meta.sliceBest || 0) + ' · '}${n >= g ? `today's goal done (${n})` : `today ${n} of ${g}`}</p>
    <div class="row">${goalNow ? '<button class="btn" id="ovDone">Done for today</button><button class="btn ghost" id="ovAgain">One more</button>' : '<button class="btn" id="ovAgain">Play again</button><button class="btn ghost" id="ovMenu">Menu</button>'}</div>`);
  const a = $('#ovAgain'); if (a) a.onclick = () => { audio(); startRound(); };
  const d = $('#ovDone'); if (d) d.onclick = () => { sync.flushNow(); location.href = '../'; };
  const m = $('#ovMenu'); if (m) m.onclick = showTitle;
  updateHud();
}

/* ---------- update ---------- */
function update(dt) {
  if (mode !== 'play') return;
  G.t += dt; G.left = Math.max(0, ROUND - G.t);
  if (G.left <= 5 && Math.floor(G.left) !== G.lastTick) { G.lastTick = Math.floor(G.left); SFX.tick(); }
  if (G.left <= 0) { G.fruits = []; endRound('time'); return; }
  if (variant() === 'pick') {
    const live = G.fruits.some(f => !f.spent);
    if (!G.q || (G.q.done && (!live || G.t - G.q.doneAt > 1.4))) { G.gap -= dt; if (G.gap <= 0) { newQuestion(); G.gap = .5; } }
  } else {
    G.spawnT -= dt;
    const maxOn = G.t < 20 ? 1 : G.t < 40 ? 2 : 3;
    if (G.spawnT <= 0 && G.fruits.length < maxOn) { spawn(); G.spawnT = Math.max(1.6, 2.6 - G.t * .015); }
  }
  for (const f of G.fruits) { f.vy += f.g * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; if (f.x < f.r || f.x > W - f.r) f.vx *= -1;
    if (f.vy > 0 && f.y > H + f.r + 10) { f.dead = true; escaped(f); } }
  G.fruits = G.fruits.filter(f => !f.dead);
  for (const h of G.halves) { h.vy += GRAV * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; h.t += dt; }
  G.halves = G.halves.filter(h => h.y < H + 120 && h.t < 2.5);
  updateHud();
}

/* ---------- slicing ---------- */
function canvasPoint(ev) { return { x: ev.clientX, y: ev.clientY }; }
function segCircle(ax, ay, bx, by, cx, cy, r) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; let t = ((cx - ax) * dx + (cy - ay) * dy) / l2; t = Math.max(0, Math.min(1, t)); const px = ax + t * dx, py = ay + t * dy; return (px - cx) ** 2 + (py - cy) ** 2 <= r * r; }
function cutAlong(ax, ay, bx, by) {
  if (mode !== 'play') return;
  const ang = Math.atan2(by - ay, bx - ax);
  for (const f of G.fruits) if (!f.dead && segCircle(ax, ay, bx, by, f.x, f.y, f.r + 6)) sliceFruit(f, ang);
  G.fruits = G.fruits.filter(f => !f.dead);
}
cv.addEventListener('pointerdown', ev => { ev.preventDefault(); audio(); const p = canvasPoint(ev); pointer = { down: true, x: p.x, y: p.y }; trail = [{ x: p.x, y: p.y, t: 0 }];
  if (mode === 'play') { // a click (or tap) on a fruit is a slice too
    let hit = false; for (const f of G.fruits) if (!f.dead && (p.x - f.x) ** 2 + (p.y - f.y) ** 2 <= (f.r + 10) ** 2) { sliceFruit(f, -Math.PI / 5); hit = true; }
    if (hit) { G.fruits = G.fruits.filter(f => !f.dead); SFX.swoosh(); } }
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {} });
cv.addEventListener('pointermove', ev => { if (!pointer.down) return; const p = canvasPoint(ev); const d = Math.hypot(p.x - pointer.x, p.y - pointer.y); if (d < 3) return;
  if (trail.length < 2 || d > 12) SFX.swoosh(); cutAlong(pointer.x, pointer.y, p.x, p.y); pointer.x = p.x; pointer.y = p.y; trail.push({ x: p.x, y: p.y, t: 0 }); if (trail.length > 24) trail.shift(); });
const up = () => { pointer.down = false; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);

/* ---------- draw ---------- */
let BG = null, BGW = 0, BGH = 0;
function background() { // painted once per size: dusky orchard gradient, soft bokeh, low hills
  if (BG && BGW === W && BGH === H) return BG;
  BG = document.createElement('canvas'); BG.width = W; BG.height = H; BGW = W; BGH = H; const b = BG.getContext('2d');
  const g = b.createLinearGradient(0, 0, 0, H); g.addColorStop(0, COL.top); g.addColorStop(1, COL.bot); b.fillStyle = g; b.fillRect(0, 0, W, H);
  const rg = b.createRadialGradient(W * .5, H * .35, 10, W * .5, H * .35, Math.max(W, H) * .7); rg.addColorStop(0, 'rgba(255,200,61,.18)'); rg.addColorStop(1, 'rgba(255,200,61,0)'); b.fillStyle = rg; b.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { const x = (i * 197 % 1000) / 1000 * W, y = (i * 331 % 1000) / 1000 * H * .7, r = (6 + (i * 53 % 22)) * U; const c = b.createRadialGradient(x, y, 0, x, y, r); c.addColorStop(0, 'rgba(255,240,200,.05)'); c.addColorStop(1, 'rgba(255,240,200,0)'); b.fillStyle = c; b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill(); }
  b.fillStyle = 'rgba(0,0,0,.18)'; b.beginPath(); b.moveTo(0, H); for (let x = 0; x <= W; x += 20) b.lineTo(x, H * .86 + Math.sin(x / W * 5) * H * .03); b.lineTo(W, H); b.fill();
  b.fillStyle = 'rgba(0,0,0,.22)'; b.beginPath(); b.moveTo(0, H); for (let x = 0; x <= W; x += 20) b.lineTo(x, H * .92 + Math.sin(x / W * 8 + 1) * H * .02); b.lineTo(W, H); b.fill();
  return BG;
}
function shade(k, r) { const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r * 1.05); g.addColorStop(0, '#ffffff'); g.addColorStop(.12, k.skin); g.addColorStop(1, k.skin2); return g; }
function gloss(r) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * .35, -r * .45, r * .32, r * .18, -.6, 0, Math.PI * 2); ctx.fill(); }
function drawWhole(k, r) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18 * U; ctx.shadowOffsetY = 8 * U;
  switch (k.n) {
    case 'watermelon': ctx.fillStyle = shade(k, r); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.12, r * .95, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = k.skin2; ctx.lineWidth = r * .1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * r * .32, 0, r * .12, r * .9, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); } break;
    case 'apple': ctx.fillStyle = shade(k, r); ctx.beginPath(); ctx.arc(-r * .28, r * .02, r * .8, 0, Math.PI * 2); ctx.arc(r * .28, r * .02, r * .8, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = k.stem; ctx.lineWidth = r * .1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -r * .62); ctx.quadraticCurveTo(r * .05, -r * .95, r * .15, -r * 1.05); ctx.stroke();
      ctx.fillStyle = k.leaf; ctx.beginPath(); ctx.ellipse(r * .38, -r * .92, r * .28, r * .13, -.4, 0, Math.PI * 2); ctx.fill(); break;
    case 'lemon': ctx.fillStyle = shade(k, r); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.18, r * .86, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(r * 1.15, 0, r * .14, 0, Math.PI * 2); ctx.arc(-r * 1.15, 0, r * .12, 0, Math.PI * 2); ctx.fill(); break;
    case 'kiwi': ctx.fillStyle = shade(k, r); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * .9, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 30; i++) { const a = i * 2.4, d = (i % 7) / 7 * r * .9; ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d * .8, 2, 2); } break;
    case 'plum': ctx.fillStyle = shade(k, r); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * .35, 0, 0, r); ctx.stroke(); break;
    case 'peach': ctx.fillStyle = shade(k, r); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(160,40,40,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(-r * .35, 0, 0, r * .9); ctx.stroke(); ctx.fillStyle = '#52b788'; ctx.beginPath(); ctx.ellipse(r * .2, -r * .95, r * .25, r * .11, -.3, 0, Math.PI * 2); ctx.fill(); break;
    case 'coconut': ctx.fillStyle = shade(k, r); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5; for (let i = 0; i < 14; i++) { const a = i * .45; ctx.beginPath(); ctx.arc(0, 0, r * (.4 + (i % 4) * .15), a, a + .5); ctx.stroke(); } ctx.fillStyle = '#2b1a10'; [[-.25, -.3], [.12, -.38], [-.05, -.12]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * r, y * r, r * .08, 0, Math.PI * 2); ctx.fill(); }); break;
    default: ctx.fillStyle = shade(k, r); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 40; i++) { const a = i * 2.4, d = Math.sqrt(i / 40) * r * .9; ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, 1.5, 1.5); }
  }
  ctx.shadowColor = 'transparent'; gloss(r); ctx.restore();
}
function drawCut(k, r) { // the inside face of a half
  ctx.fillStyle = k.skin2; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  if (k.rind) { ctx.fillStyle = k.rind; ctx.beginPath(); ctx.arc(0, 0, r * .9, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = k.flesh; ctx.beginPath(); ctx.arc(0, 0, r * (k.rind ? .82 : .88), 0, Math.PI * 2); ctx.fill();
  if (k.n === 'orange' || k.n === 'lemon') { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * .85, Math.sin(a) * r * .85); ctx.stroke(); } }
  if (k.seed) { ctx.fillStyle = k.seed; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, d = r * (k.n === 'kiwi' ? .45 : .55); ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * .04, r * .08, a, 0, Math.PI * 2); ctx.fill(); } }
  if (k.n === 'kiwi') { ctx.fillStyle = '#f1f8d8'; ctx.beginPath(); ctx.arc(0, 0, r * .25, 0, Math.PI * 2); ctx.fill(); }
  if (k.n === 'peach' || k.n === 'plum') { ctx.fillStyle = '#a0522d'; ctx.beginPath(); ctx.ellipse(0, 0, r * .3, r * .4, 0, 0, Math.PI * 2); ctx.fill(); }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawLabel(x, y, text, big, faded) {
  const fs = Math.round(big ? Math.max(30, 40 * U) : Math.max(20, 25 * U)); ctx.globalAlpha = faded ? .35 : 1; ctx.font = '800 ' + fs + 'px ' + FONT(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + fs * .9, h = fs * 1.35;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  ctx.fillStyle = 'rgba(255,250,240,.96)'; roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#1d2b2a'; ctx.fillText(text, x, y + fs * .06); ctx.globalAlpha = 1;
}
function drawPinned() {
  const pickMode = variant() === 'pick'; let text, sub;
  if (pickMode) { if (!G.q) return; text = G.q.item.prompt + ' = ?'; sub = G.q.done ? '' : 'Slice the answer'; }
  else { text = 'Slice it if it\u2019s WRONG'; sub = 'Leave the right ones alone'; }
  const fs = Math.round(pickMode ? Math.max(34, 52 * U) : Math.max(24, 32 * U)); ctx.font = '800 ' + fs + 'px ' + FONT(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + fs * 1.2, h = fs * 1.5, y = Math.max(110, H * .13);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6; ctx.fillStyle = 'rgba(255,250,240,.97)'; roundRect(W / 2 - w / 2, y, w, h, h * .35); ctx.fill(); ctx.restore();
  ctx.fillStyle = pickMode && G.q && G.q.done ? '#7a8a87' : '#1d2b2a'; ctx.fillText(text, W / 2, y + h / 2 + fs * .06);
  if (sub) { ctx.font = '700 ' + Math.round(fs * .42) + 'px ' + FONT(); ctx.fillStyle = COL.soft; ctx.fillText(sub, W / 2, y + h + fs * .45); }
}
function draw() {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 14 * shake * U, (Math.random() - .5) * 14 * shake * U);
  ctx.drawImage(background(), 0, 0, W, H);
  for (const f of effects) if (f.k === 'splat') { const p = f.t / f.life; ctx.globalAlpha = .55 * (1 - p * p); ctx.fillStyle = f.color; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
    for (let i = 0; i < 9; i++) { const a = i * .73 + f.seed, d = f.r * (.6 + ((i * 7 + f.seed * 3) % 5) * .18); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * .55, f.r * (.22 - i * .015), 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, 0, f.r, f.r * .5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
  if (G) {
    if (G.frenzy > 0) { const a = .12 + .06 * Math.sin(G.t * 12); const fg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .2, W / 2, H / 2, Math.max(W, H) * .7); fg.addColorStop(0, 'rgba(255,200,61,0)'); fg.addColorStop(1, 'rgba(255,200,61,' + a + ')'); ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H); }
    for (const h of G.halves) { const r = h.f.r; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - h.t / 2); ctx.translate(h.x, h.y); ctx.rotate(h.ang);
      ctx.beginPath(); ctx.rect(-r * 1.5, h.side < 0 ? -r * 1.5 : 0, r * 3, r * 1.5); ctx.clip(); ctx.rotate(h.rot * .3); drawWhole(h.f.kind, r); ctx.rotate(-h.rot * .3);
      ctx.scale(1, .28); drawCut(h.f.kind, r); ctx.restore(); }
    for (const f of G.fruits) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); drawWhole(f.kind, f.r); ctx.restore(); }
    for (const f of G.fruits) { if (f.qid !== undefined) drawLabel(f.x, f.y, f.text, true, f.spent); else drawLabel(f.x, f.y + f.r * .62, f.text, false, false); }
    drawPinned();
  }
  for (const f of effects) {
    const p = f.t / f.life;
    if (f.k === 'juice') { ctx.globalAlpha = 1 - p; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t + 0.5 * GRAV * f.t * f.t, f.r * (1 - p * .5), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.k === 'flash') { ctx.save(); ctx.globalAlpha = 1 - p; ctx.translate(f.x, f.y); ctx.rotate(f.ang); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, f.r, 4 * U * (1 - p) + 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    else if (f.k === 'text') { const fs = Math.round((f.big ? 44 : 32) * U); ctx.font = '800 ' + fs + 'px ' + FONT(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = p < .7 ? 1 : 1 - (p - .7) / .3;
      const y = f.y - p * 40 * U, sc = p < .15 ? .6 + p / .15 * .4 : 1; ctx.save(); ctx.translate(Math.max(60, Math.min(W - 60, f.x)), y); ctx.scale(sc, sc);
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0); ctx.restore(); ctx.globalAlpha = 1; }
  }
  if (trail.length > 1) { ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < trail.length; i++) { const a = i / trail.length; ctx.strokeStyle = pass ? 'rgba(255,255,255,' + a + ')' : 'rgba(255,200,61,' + (a * .45) + ')'; ctx.lineWidth = (pass ? 2 + a * 7 : 8 + a * 16) * U; ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke(); } }
  if (banner && G && mode === 'play') { const b = banner, p = b.t / b.life; ctx.globalAlpha = p < .85 ? 1 : 1 - (p - .85) / .15;
    const fs = Math.round((b.big ? 26 : 22) * Math.max(.85, U)); ctx.font = '800 ' + fs + 'px ' + FONT(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(W - 32, ctx.measureText(b.text).width + fs * 1.4), h = fs * 1.8, y = H - h - 28 * U;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 16; ctx.fillStyle = b.color; roundRect(W / 2 - w / 2, y, w, h, h / 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = b.color === COL.gold ? '#3a2500' : '#fff'; ctx.fillText(b.text, W / 2, y + h / 2 + fs * .06); ctx.globalAlpha = 1; }
  ctx.restore();
}
function loop(t) {
  const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t;
  update(dt);
  for (const f of effects) f.t += dt; effects = effects.filter(f => f.t < f.life);
  for (const p of trail) p.t += dt; trail = trail.filter(p => p.t < .25); if (!pointer.down && trail.length) trail.shift();
  if (banner && mode !== 'pause') { banner.t += dt; if (banner.t >= banner.life) banner = null; }
  shake = Math.max(0, shake - dt);
  draw(); requestAnimationFrame(loop);
}

/* ================= UI ================= */
function overlay(html) { const o = $('#overlay'); o.innerHTML = '<div class="card">' + html + '</div>'; o.hidden = false; }
function overlayHide() { $('#overlay').hidden = true; }
function updateHud() {
  sched.rollDaily();
  const left = G && mode !== 'title' ? G.left : ROUND;
  $('#hudTime').textContent = Math.ceil(left); const tm = $('#hudTimer'); tm.style.setProperty('--p', (left / ROUND).toFixed(3)); tm.classList.toggle('low', left <= 10);
  $('#hudScore').textContent = G ? G.score : 0;
  $('#hudBest').textContent = 'Best ' + (S.meta.sliceBest || 0);
  $('#hudStrikes').querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', !!G && i < G.strikes));
  $('#hudCombo').textContent = G && G.frenzy > 0 ? 'FRENZY!' : G && G.combo >= 3 ? 'Combo ×' + G.combo : '';
  const n = sched.todayCount(), g = S.settings.goal; $('#hudGoal').textContent = (PLAYERS.length > 1 ? cap(player) + ' · ' : '') + (n >= g ? `Today ${n} ✓` : `Today ${n}/${g}`);
  $('#btnSound').textContent = S.settings.sound ? '♪' : '✕'; $('#btnSound').title = 'Sound ' + (S.settings.sound ? 'on' : 'off');
}
function playersRow() { return PLAYERS.length > 1 ? `<div class="players">${PLAYERS.map(p => `<button data-p="${p}" class="${p === player ? 'on' : ''}">${cap(p)}</button>`).join('')}</div>` : ''; }
function wirePlayers() { $('#overlay').querySelectorAll('.players button').forEach(b => b.onclick = () => { if (b.dataset.p === player) return; sync.flushNow(); FF.player.set(b.dataset.p); location.reload(); }); }
function showTitle() {
  mode = 'title'; G = null;
  const todayN = sched.todayCount(), v = variant();
  overlay(`<h1>Slice of <em>Truth</em></h1>
    <div class="modes">
      <button data-m="pick" class="${v === 'pick' ? 'on' : ''}"><b>Pick the answer</b><span>A problem at the top. Slice the fruit with the right number.</span><code>8 × 7 = ?&nbsp;&nbsp;→&nbsp;&nbsp;<u>56</u>&nbsp; 54&nbsp; 63</code></button>
      <button data-m="catch" class="${v === 'catch' ? 'on' : ''}"><b>Catch the mistakes</b><span>Each fruit has an equation. Slice only the wrong ones.</span><code><u>7 × 8 = 54</u>&nbsp;&nbsp;·&nbsp;&nbsp;7 × 8 = 56</code></button>
    </div>
    <p class="small">60 seconds · a wrong slice is a strike · three strikes and you're out<br>Drag to slice, or tap/click a fruit</p>
    ${playersRow()}
    <div class="row"><button class="btn" id="ovStart">Play</button></div>
    <p class="small">${todayN >= S.settings.goal ? `Today's goal done ✓ (${todayN}). Extra rounds still count.` : `Today: ${todayN} of ${S.settings.goal}`}</p>`);
  $('#ovStart').onclick = () => { audio(); startRound(); }; wirePlayers();
  $('#overlay').querySelectorAll('.modes button').forEach(b => b.onclick = () => { S.settings.sliceMode = b.dataset.m; save(); showTitle(); });
  updateHud();
}
function togglePause() {
  if (mode === 'play') { mode = 'pause'; overlay(`<h1>Paused</h1><div class="row"><button class="btn" id="ovRes">Resume</button><button class="btn ghost" id="ovQuit">End round</button></div>`);
    $('#ovRes').onclick = togglePause; $('#ovQuit').onclick = () => { endRound('quit'); }; }
  else if (mode === 'pause') { mode = 'play'; overlayHide(); lastT = performance.now(); }
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function showStats() {
  const cards = Object.entries(S.cards).filter(([, c]) => c.vatt);
  const byFam = {}; for (const [id, c] of cards) { const f = ITEMS[id] && ITEMS[id].fam; if (!f) continue; const r = byFam[f] = byFam[f] || { n: 0, att: 0, ok: 0 }; r.n++; r.att += c.vatt; r.ok += c.vok || 0; }
  const errs = {}; for (const [, c] of Object.entries(S.cards)) if (c.err) for (const k in c.err) errs[k] = (errs[k] || 0) + c.err[k];
  const errRows = Object.entries(errs).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const label = k => k.replace(/^missed_/, 'let through: ').replace(/_/g, ' ');
  panel(`<div class="row" style="justify-content:space-between;align-items:center"><h2>Stats</h2><button class="btn ghost" id="pClose">Close</button></div>
  <p class="muted">${esc(sync.statusLine())}</p>
  <div class="tiles">
    <div class="tile"><div class="k">Today</div><div class="v">${sched.todayCount()}</div><div class="s">of ${S.settings.goal}, both games</div></div>
    <div class="tile"><div class="k">Best score</div><div class="v">${S.meta.sliceBest || 0}</div><div class="s">${S.meta.sliceRuns || 0} rounds</div></div>
    <div class="tile"><div class="k">Facts judged</div><div class="v">${cards.length}</div><div class="s">in this game</div></div>
  </div>
  <h3>Catching mistakes, by family</h3>
  ${Object.keys(byFam).length ? `<div class="wrap"><table><tr><th>Family</th><th>Facts</th><th>Judgments</th><th>Right</th></tr>${Object.entries(byFam).map(([f, r]) => `<tr><td>${FAM[f].name}</td><td class="num">${r.n}</td><td class="num">${r.att}</td><td class="num">${Math.round(100 * r.ok / r.att)}%</td></tr>`).join('')}</table></div>` : '<p class="muted">Play a round first.</p>'}
  <h3>Which mistakes slip past</h3>
  <p class="muted">Counted across both games. "false alarm" means a true equation got sliced.</p>
  ${errRows.length ? `<div class="wrap"><table><tr><th>Kind</th><th>Times</th></tr>${errRows.map(([k, v]) => `<tr><td>${esc(label(k))}</td><td class="num">${v}</td></tr>`).join('')}</table></div>` : '<p class="muted">None yet.</p>'}
  <p class="muted" style="margin-top:14px">Fact-by-fact stats are in the shooter's Stats panel. Slice of Truth v${VERSION}</p>`);
  $('#pClose').onclick = hidePanel;
}
function showSettings() {
  const s = S.settings;
  panel(`<div class="row" style="justify-content:space-between;align-items:center"><h2>Settings</h2><button class="btn ghost" id="pClose">Done</button></div>
  <p class="muted">Settings for ${cap(player)}, shared with the shooter${sync.remote ? ' and saved to the Sheet' : ''}.</p>
  <h3>Fact families</h3>
  ${Object.keys(FAM).map(f => `<label class="opt"><input type="checkbox" id="fam_${f}" ${s.fams[f] ? 'checked' : ''}> ${FAM[f].name} <span class="muted">· ${ORDER.filter(id => ITEMS[id].fam === f).length} facts</span></label>`).join('')}
  <label class="opt" style="margin-top:8px">Layers <select id="setLayer">
    <option value="1" ${s.maxLayer == 1 ? 'selected' : ''}>1 · core facts only</option>
    <option value="2" ${s.maxLayer == 2 ? 'selected' : ''}>1–2 · core + signed numbers</option>
    <option value="3" ${s.maxLayer == 3 ? 'selected' : ''}>1–3 · also bridging twenty, 11s and 12s</option></select></label>
  <h3>Pacing</h3>
  <label class="opt">Daily goal (problems) <input type="number" id="setGoal" min="10" max="300" value="${s.goal}"></label>
  <label class="opt">New facts per day <input type="number" id="setNew" min="0" max="60" value="${s.newPerDay}"></label>
  <h3>Sound</h3>
  <label class="opt"><input type="checkbox" id="setSnd" ${s.sound ? 'checked' : ''}> Sound</label>`);
  $('#pClose').onclick = () => { Object.keys(FAM).forEach(f => s.fams[f] = $('#fam_' + f).checked); s.maxLayer = +$('#setLayer').value;
    s.newPerDay = Math.max(0, Math.min(60, parseInt($('#setNew').value, 10) || 0)); s.goal = Math.max(10, Math.min(300, parseInt($('#setGoal').value, 10) || 60)); s.sound = $('#setSnd').checked;
    save(); sync.settings(); hidePanel(); updateHud(); };
}
function panel(html) { $('#panelIn').innerHTML = html; $('#panel').hidden = false; if (mode === 'play') togglePause(); }
function hidePanel() { $('#panel').hidden = true; }

document.addEventListener('keydown', ev => {
  if (!$('#panel').hidden) return; const tag = (ev.target && ev.target.tagName) || ''; if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (ev.key === 'Escape') { if (mode === 'play' || mode === 'pause') togglePause(); ev.preventDefault(); }
  else if ((ev.key === 'Enter' || ev.key === ' ') && (mode === 'title' || mode === 'over')) { const b = $('#ovStart') || $('#ovAgain'); if (b) { b.click(); ev.preventDefault(); } }
});
$('#btnPause').onclick = () => { if (mode === 'play' || mode === 'pause') togglePause(); };
$('#btnStats').onclick = showStats;
$('#btnSettings').onclick = showSettings;
$('#btnSound').onclick = () => { S.settings.sound = !S.settings.sound; save(); updateHud(); if (S.settings.sound) { audio(); SFX.combo(1); } };
window.addEventListener('resize', () => { BG = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });

function start() {
  loadColors(); resize(); $('#ver').textContent = 'v' + VERSION; showTitle(); requestAnimationFrame(loop); sync.load();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('../sw.js').catch(() => {});
}
start();
})();
