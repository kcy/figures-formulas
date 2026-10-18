/* Slice of Truth — equations fly up on fruit; slice the false ones. Second front end to FF.Scheduler.
 * Every slice or escape is a *verification* exposure of a fact: it schedules the fact like any answer,
 * but never marks it fluent on its own (see scheduler.report). Wrong-answer kinds are tagged so the Sheet
 * shows which mistakes slip past. */
(function () {
'use strict';
const VERSION = '1.0.0', GAME = 'slice';
const ROUND = 60, STRIKES = 3, FAST_MUL = 1.4;
const $ = s => document.querySelector(s);
const W = 560, H = 420;
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
function loadColors() { COL = { phos: css('--phos'), dim: css('--phos-dim'), faint: css('--phos-faint'), white: css('--white'), orange: css('--orange'), blue: css('--blue'), violet: css('--violet'), danger: css('--danger'), warn: css('--warn'), screen: css('--screen') }; }
const FRUIT = [
  { n: 'watermelon', r: 40, skin: '#2f9e44', flesh: '#ff5d6c', seed: '#1d1d1d' },
  { n: 'orange', r: 34, skin: '#ff922b', flesh: '#ffb866' },
  { n: 'apple', r: 33, skin: '#e03131', flesh: '#fff3bf', stem: '#5c3d1e', leaf: '#51cf66' },
  { n: 'lemon', r: 32, skin: '#fcc419', flesh: '#fff9c4' },
  { n: 'kiwi', r: 32, skin: '#8d6e3f', flesh: '#9bdc5a', seed: '#1d1d1d' },
  { n: 'plum', r: 31, skin: '#7048e8', flesh: '#e5dbff' },
  { n: 'peach', r: 34, skin: '#ff8787', flesh: '#ffe8cc' }
];
const GRAV = 560;
let G = null, mode = 'title', lastT = 0, effects = [], trail = [], shake = 0, banner = null, lastSliceAt = -1e9;
let pointer = { down: false, x: 0, y: 0 };

function newRound() {
  G = { t: 0, left: ROUND, score: 0, strikes: 0, combo: 0, bestCombo: 0, fruits: [], halves: [], spawnT: .6, frenzy: 0, frenzyUsed: 0,
    answers: 0, correct: 0, caught: 0, falseAlarms: 0, escapedFalse: 0, practiced: new Set(), startedAt: Date.now(), lastTick: 0,
    goalShown: sched.todayCount() >= S.settings.goal, goalToast: false };
  sched.newSession(); effects = []; trail = []; banner = null; shake = 0;
}
function startRound() { newRound(); mode = 'play'; overlayHide(); updateHud(); }
function floatText(x, y, text, color, life, big) { effects.push({ k: 'text', x, y, text, color, life, t: 0, big: !!big }); }
function showBanner(text, color, life, big) { banner = { text, color, life, t: 0, big: !!big }; }

function spawn(forceFalse) {
  const id = sched.next(G.fruits.map(f => f.id), []); if (!id) return;
  const it = ITEMS[id];
  const isFalse = forceFalse || Math.random() < .55;
  let shown = it.answer, tag = null;
  if (isFalse) { const f = falseAnswer(it); shown = f.value; tag = f.tag; }
  const kind = pick(FRUIT);
  const x = 70 + Math.random() * (W - 140);
  const apexY = 60 + Math.random() * 90; // how high it flies
  const vy = -Math.sqrt(2 * GRAV * (H + 40 - apexY));
  const vx = ((W / 2 - x) / W) * 120 + (Math.random() - .5) * 60;
  G.fruits.push({ id, item: it, text: it.prompt + ' = ' + fmt(shown), isFalse, tag, kind, x, y: H + 40, vx, vy, rot: Math.random() * Math.PI * 2, vr: (Math.random() - .5) * 2.5, born: G.t, dead: false });
}
function sliceFruit(f, ang) {
  f.dead = true; lastSliceAt = G.t;
  const rt = G.t - f.born;
  // halves
  for (const side of [-1, 1]) G.halves.push({ f, side, ang, x: f.x, y: f.y, vx: f.vx * .4 + Math.cos(ang + Math.PI / 2) * side * 110, vy: f.vy * .3 - 60, rot: f.rot, vr: side * 3, t: 0 });
  for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 200; effects.push({ k: 'juice', x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, color: f.kind.flesh, life: .7, t: 0, r: 2 + Math.random() * 4 }); }
  effects.push({ k: 'splat', x: f.x, y: f.y, color: f.kind.flesh, life: 2.5, t: 0, r: f.kind.r * .9, ang });
  if (f.isFalse) {
    sched.report(f.id, true, rt, { kind: 'verify', fastMul: FAST_MUL }); G.answers++; G.correct++; G.caught++; G.practiced.add(f.id);
    G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
    const pts = 10 + Math.min(G.combo - 1, 10) * 2 + (G.frenzy > 0 ? 5 : 0); G.score += pts;
    floatText(f.x, f.y - 30, '+' + pts + (G.combo >= 3 ? '  ×' + G.combo : ''), COL.white, .8);
    SFX.splat(); if (G.combo >= 3) SFX.combo(G.combo);
    if (G.combo === 10 && !G.frenzy) { G.frenzy = 6; G.frenzyUsed++; SFX.frenzy(); showBanner('FRENZY · EVERYTHING IS FALSE', COL.warn, 2.5, true); }
    checkGoal();
  } else {
    sched.report(f.id, false, rt, { kind: 'verify', error: 'false_alarm' }); G.answers++; G.falseAlarms++; G.practiced.add(f.id);
    G.combo = 0; G.strikes++; shake = .5; SFX.strike();
    showBanner('THAT ONE WAS TRUE · ' + f.text, COL.danger, 2.2, true);
    updateHud(); if (G.strikes >= STRIKES) endRound('strikes');
  }
}
function escaped(f) {
  const flight = G.t - f.born;
  if (f.isFalse) {
    sched.report(f.id, false, flight, { kind: 'verify', error: 'missed_' + f.tag }); G.answers++; G.escapedFalse++; G.practiced.add(f.id);
    G.combo = 0; SFX.miss();
    showBanner('GOT AWAY · ' + f.text + '  (it’s ' + fmt(f.item.answer) + ')', COL.warn, 2.2);
  } else if (G.t - lastSliceAt < 5) { // leaving a true one alone counts, but only while the player is clearly engaged
    sched.report(f.id, true, flight, { kind: 'verify', fastMul: FAST_MUL }); G.answers++; G.correct++; G.practiced.add(f.id);
    checkGoal();
  }
}
function checkGoal() { if (!G.goalToast && !G.goalShown && sched.todayCount() >= S.settings.goal) { G.goalToast = true; SFX.goal(); showBanner("TODAY'S GOAL REACHED", COL.warn, 2.6, true); } }
function sessionRow() { return { ts: new Date().toISOString(), game: GAME, version: VERSION, wave: G.frenzyUsed, score: G.score, answers: G.answers, correct: G.correct, facts: G.practiced.size, bestStreak: G.bestCombo, seconds: Math.round((Date.now() - G.startedAt) / 1000) }; }
function endRound(why) {
  mode = 'over'; S.meta.sliceRuns = (S.meta.sliceRuns || 0) + 1; S.meta.sliceBest = Math.max(S.meta.sliceBest || 0, G.score); save(); sync.save(sessionRow()); SFX.end();
  const n = sched.todayCount(), g = S.settings.goal, acc = G.answers ? Math.round(100 * G.correct / G.answers) : 0;
  const goalNow = !G.goalShown && n >= g; if (goalNow) G.goalShown = true;
  overlay(`<h2>${goalNow ? 'MISSION COMPLETE' : why === 'strikes' ? 'THREE STRIKES' : "TIME'S UP"}</h2>
    <p>Score ${G.score} · best combo ${G.bestCombo}${G.frenzyUsed ? ' · ' + G.frenzyUsed + ' frenzy' : ''}</p>
    <p>${G.caught} mistakes caught · ${G.escapedFalse} got away · ${G.falseAlarms} false alarm${G.falseAlarms === 1 ? '' : 's'} · ${acc}% right</p>
    <p class="muted">${n >= g ? `Today's goal done (${n}/${g}).` : `Today: ${n} of ${g}. ${g - n} to go.`} Best score ${S.meta.sliceBest}</p>
    <div class="row">${goalNow ? '<button class="primary" id="ovDone">Done for today</button><button id="ovAgain">One more round</button>' : '<button class="primary" id="ovAgain">Play again</button><button id="ovStats">Stats</button>'}</div>`);
  const a = $('#ovAgain'); if (a) a.onclick = () => { audio(); startRound(); };
  const d = $('#ovDone'); if (d) d.onclick = () => { sync.flushNow(); location.href = '../'; };
  const st = $('#ovStats'); if (st) st.onclick = showStats;
  updateHud();
}

/* ---------- update ---------- */
function update(dt) {
  if (mode !== 'play') return;
  G.t += dt; G.left = Math.max(0, ROUND - G.t);
  if (G.left <= 5 && Math.floor(G.left) !== G.lastTick) { G.lastTick = Math.floor(G.left); SFX.tick(); }
  if (G.left <= 0) { for (const f of G.fruits) if (!f.dead) escaped(f); G.fruits = []; endRound('time'); return; }
  if (G.frenzy > 0) G.frenzy = Math.max(0, G.frenzy - dt);
  // spawning: ramps from one at a time to small bursts
  G.spawnT -= dt;
  const maxOn = G.frenzy ? 6 : G.t < 15 ? 2 : G.t < 35 ? 3 : 4;
  if (G.spawnT <= 0 && G.fruits.length < maxOn) {
    const burst = G.frenzy ? 2 : (G.t > 25 && Math.random() < .35 ? 2 : 1);
    for (let i = 0; i < burst && G.fruits.length < maxOn; i++) spawn(G.frenzy > 0);
    G.spawnT = G.frenzy ? .45 : Math.max(.7, 1.6 - G.t * .015) + Math.random() * .3;
  }
  for (const f of G.fruits) { f.vy += GRAV * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; if (f.x < 30 || f.x > W - 30) f.vx *= -1;
    if (f.vy > 0 && f.y > H + 50) { f.dead = true; escaped(f); } }
  G.fruits = G.fruits.filter(f => !f.dead);
  for (const h of G.halves) { h.vy += GRAV * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; h.t += dt; }
  G.halves = G.halves.filter(h => h.y < H + 80 && h.t < 2);
  updateHud();
}

/* ---------- slicing ---------- */
function canvasPoint(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height }; }
function segCircle(ax, ay, bx, by, cx, cy, r) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; let t = ((cx - ax) * dx + (cy - ay) * dy) / l2; t = Math.max(0, Math.min(1, t)); const px = ax + t * dx, py = ay + t * dy; return (px - cx) ** 2 + (py - cy) ** 2 <= r * r; }
function cutAlong(ax, ay, bx, by) {
  if (mode !== 'play') return;
  const ang = Math.atan2(by - ay, bx - ax);
  for (const f of G.fruits) if (!f.dead && segCircle(ax, ay, bx, by, f.x, f.y, f.kind.r + 6)) sliceFruit(f, ang);
  G.fruits = G.fruits.filter(f => !f.dead);
}
cv.addEventListener('pointerdown', ev => { ev.preventDefault(); audio(); const p = canvasPoint(ev); pointer = { down: true, x: p.x, y: p.y }; trail = [{ x: p.x, y: p.y, t: 0 }];
  if (mode === 'play') { // a click (or tap) on a fruit is a slice too
    let hit = false; for (const f of G.fruits) if (!f.dead && (p.x - f.x) ** 2 + (p.y - f.y) ** 2 <= (f.kind.r + 8) ** 2) { sliceFruit(f, Math.PI / 4); hit = true; }
    if (hit) { G.fruits = G.fruits.filter(f => !f.dead); SFX.swoosh(); } }
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {} });
cv.addEventListener('pointermove', ev => { if (!pointer.down) return; const p = canvasPoint(ev); const d = Math.hypot(p.x - pointer.x, p.y - pointer.y); if (d < 3) return;
  if (trail.length < 2 || d > 12) SFX.swoosh(); cutAlong(pointer.x, pointer.y, p.x, p.y); pointer.x = p.x; pointer.y = p.y; trail.push({ x: p.x, y: p.y, t: 0 }); if (trail.length > 24) trail.shift(); });
const up = () => { pointer.down = false; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);

/* ---------- draw ---------- */
function px() { const dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; } ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
function drawFruitBody(k, r) {
  ctx.lineWidth = 2;
  switch (k.n) {
    case 'watermelon': ctx.fillStyle = k.skin; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e9fac8'; ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = k.flesh; ctx.beginPath(); ctx.arc(0, 0, r - 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.seed; for (let i = 0; i < 7; i++) { const a = i * .9, d = r * .45; ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, 2.2, 3.5, a, 0, Math.PI * 2); ctx.fill(); } break;
    case 'orange': ctx.fillStyle = k.skin; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.flesh; ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = k.skin; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5)); ctx.stroke(); } break;
    case 'apple': ctx.fillStyle = k.skin; ctx.beginPath(); ctx.arc(-r * .3, 0, r * .78, 0, Math.PI * 2); ctx.arc(r * .3, 0, r * .78, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = k.flesh; ctx.beginPath(); ctx.ellipse(0, 2, r * .55, r * .5, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = k.stem; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -r * .7); ctx.lineTo(3, -r * 1.05); ctx.stroke();
      ctx.fillStyle = k.leaf; ctx.beginPath(); ctx.ellipse(10, -r * .95, 8, 4, -.5, 0, Math.PI * 2); ctx.fill(); break;
    case 'lemon': ctx.fillStyle = k.skin; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * .85, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.flesh; ctx.beginPath(); ctx.ellipse(0, 0, r * .95, r * .65, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = k.skin; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * .95, Math.sin(a) * r * .65); ctx.stroke(); } break;
    case 'kiwi': ctx.fillStyle = k.skin; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.flesh; ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e9fac8'; ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.seed; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * .5, Math.sin(a) * r * .5, 1.6, 3, a, 0, Math.PI * 2); ctx.fill(); } break;
    case 'plum': ctx.fillStyle = k.skin; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-r * .35, -r * .35, r * .25, r * .15, -.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * .3, 0, 0, r); ctx.stroke(); break;
    default: ctx.fillStyle = k.skin; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(-r * .3, -r * .3, r * .3, 0, Math.PI * 2); ctx.fill();
  }
}
function drawLabel(x, y, text, strong) {
  ctx.font = '20px ' + css('--font-mono'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 14, h = 24;
  ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = strong ? COL.white : 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x - w / 2 + .5, y - h / 2 + .5, w - 1, h - 1);
  ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 1);
}
function draw() {
  px(); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 10 * shake, (Math.random() - .5) * 10 * shake);
  ctx.fillStyle = COL.screen; ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = COL.faint; for (let i = 0; i < 40; i++) ctx.fillRect((i * 193) % W, (i * 101) % H, 2, 2);
  // splats first (background)
  for (const f of effects) if (f.k === 'splat') { const p = f.t / f.life; ctx.globalAlpha = .35 * (1 - p); ctx.fillStyle = f.color; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
    for (let i = 0; i < 7; i++) { const a = i * .9 + 0.3, d = f.r * (0.5 + (i % 3) * .35); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * .6, f.r * (.3 - i * .025), 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, 0, f.r * .9, f.r * .5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
  if (G) {
    if (G.frenzy > 0) { ctx.fillStyle = 'rgba(255,212,59,' + (0.06 + 0.04 * Math.sin(G.t * 10)) + ')'; ctx.fillRect(0, 0, W, H); }
    for (const h of G.halves) { ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.ang); ctx.beginPath(); ctx.rect(-80, h.side < 0 ? -80 : 0, 160, 80); ctx.clip(); ctx.rotate(-h.ang + h.rot); ctx.globalAlpha = Math.max(0, 1 - h.t / 1.6); drawFruitBody(h.f.kind, h.f.kind.r); ctx.restore(); }
    for (const f of G.fruits) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); drawFruitBody(f.kind, f.kind.r); ctx.restore(); }
    for (const f of G.fruits) drawLabel(f.x, f.y, f.text, false);
    // timer bar
    ctx.fillStyle = COL.faint; ctx.fillRect(0, H - 6, W, 6); ctx.fillStyle = G.left <= 10 ? COL.danger : COL.phos; ctx.fillRect(0, H - 6, W * G.left / ROUND, 6);
    ctx.font = '16px ' + css('--font-mono'); ctx.fillStyle = COL.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('COMBO ' + G.combo + (G.frenzy > 0 ? '   FRENZY ' + G.frenzy.toFixed(1) : ''), 8, H - 18);
    ctx.textAlign = 'right'; ctx.fillText('STRIKES ' + '✕'.repeat(G.strikes) + '○'.repeat(Math.max(0, STRIKES - G.strikes)), W - 8, H - 18);
  }
  for (const f of effects) {
    const p = f.t / f.life;
    if (f.k === 'juice') { ctx.globalAlpha = 1 - p; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t + 0.5 * GRAV * f.t * f.t, f.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.k === 'text') { ctx.font = (f.big ? '26px ' : '20px ') + css('--font-mono'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = f.color; ctx.globalAlpha = p < .7 ? 1 : 1 - (p - .7) / .3; ctx.fillText(f.text, Math.max(60, Math.min(W - 60, f.x)), f.y - p * 24); ctx.globalAlpha = 1; }
  }
  // blade trail
  if (trail.length > 1) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; for (let i = 1; i < trail.length; i++) { const a = i / trail.length; ctx.strokeStyle = 'rgba(238,255,241,' + (a * .9) + ')'; ctx.lineWidth = 1 + a * 6; ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke(); } }
  if (banner && G) { const b = banner, p = b.t / b.life; ctx.globalAlpha = p < .8 ? 1 : 1 - (p - .8) * 5; ctx.font = (b.big ? '28px ' : '22px ') + css('--font-mono'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(W - 16, ctx.measureText(b.text).width + 28), h = b.big ? 40 : 30, y = 30; ctx.fillStyle = COL.screen; ctx.fillRect(W / 2 - w / 2, y - h / 2, w, h); ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2); ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, y + 1); ctx.globalAlpha = 1; }
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
function overlay(html) { const o = $('#overlay'); o.innerHTML = html; o.hidden = false; }
function overlayHide() { $('#overlay').hidden = true; }
function updateHud() {
  sched.rollDaily();
  $('#hudTime').textContent = 'TIME ' + (G && mode !== 'title' ? Math.ceil(G.left) : ROUND);
  $('#hudScore').textContent = 'SCORE ' + (G ? G.score : 0);
  const st = $('#hudStrikes'); st.textContent = 'STRIKES ' + (G ? '✕'.repeat(G.strikes) + '○'.repeat(Math.max(0, STRIKES - G.strikes)) : '○○○'); st.className = G && G.strikes >= STRIKES - 1 ? 'lo' : 'hp';
  $('#hudCombo').textContent = G && G.combo >= 3 ? 'COMBO ×' + G.combo : '';
  const n = sched.todayCount(), g = S.settings.goal; $('#hudGoal').textContent = (PLAYERS.length > 1 ? cap(player).toUpperCase() + ' · ' : '') + (n >= g ? `TODAY ${n} ✓` : `TODAY ${n}/${g}`);
  $('#btnSound').textContent = 'Sound: ' + (S.settings.sound ? 'on' : 'off');
}
function showTitle() {
  mode = 'title'; G = null;
  const todayN = sched.todayCount();
  overlay(`<h2>SLICE OF TRUTH</h2>
    ${PLAYERS.length > 1 ? `<p class="muted">Playing as ${cap(player)} · <a href="../" style="color:var(--phos)">switch</a></p>` : ''}
    <p>Fruit flies up carrying equations. Slice the <b>false</b> ones. Leave the true ones alone: cutting a true equation is a strike.</p>
    <p class="muted">${todayN >= S.settings.goal ? `Today's goal done ✓ (${todayN}). Extra rounds still count.` : `Today's goal: ${S.settings.goal} problems · ${todayN} done`} · 60-second rounds</p>
    <div class="row"><button class="primary" id="ovStart">Start round</button></div>`);
  $('#ovStart').onclick = () => { audio(); startRound(); };
  updateHud();
}
function togglePause() {
  if (mode === 'play') { mode = 'pause'; overlay(`<h2>PAUSED</h2><div class="row"><button class="primary" id="ovRes">Resume</button><button id="ovQuit">End round</button></div>`);
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
  panel(`<div class="row" style="justify-content:space-between"><h2>STATS · SLICE</h2><button id="pClose">Close</button></div>
  <p class="muted">${esc(sync.statusLine())}</p>
  <div class="tilerow">
    <div class="tile"><div class="k">Today</div><div class="v">${sched.todayCount()}</div><div class="s">of ${S.settings.goal} across both games</div></div>
    <div class="tile"><div class="k">Best score</div><div class="v">${S.meta.sliceBest || 0}</div><div class="s">${S.meta.sliceRuns || 0} rounds</div></div>
    <div class="tile"><div class="k">Verified</div><div class="v">${cards.length}</div><div class="s">facts judged in this game</div></div>
  </div>
  <h3>Catching mistakes, by family</h3>
  ${Object.keys(byFam).length ? `<div class="wrap"><table><tr><th>Family</th><th>Facts</th><th>Judgments</th><th>Right</th></tr>${Object.entries(byFam).map(([f, r]) => `<tr><td class="fam-${f}">${FAM[f].name}</td><td class="num">${r.n}</td><td class="num">${r.att}</td><td class="num">${Math.round(100 * r.ok / r.att)}%</td></tr>`).join('')}</table></div>` : '<p class="muted">Play a round first.</p>'}
  <h3>Which mistakes slip past</h3>
  <p class="muted">Counted across both games. "false alarm" means a true equation got sliced.</p>
  ${errRows.length ? `<div class="wrap"><table><tr><th>Kind</th><th>Times</th></tr>${errRows.map(([k, v]) => `<tr><td>${esc(label(k))}</td><td class="num">${v}</td></tr>`).join('')}</table></div>` : '<p class="muted">None yet.</p>'}
  <p class="muted" style="margin-top:14px">Full fact-by-fact stats are in the shooter's Stats panel. Slice of Truth v${VERSION}</p>`);
  $('#pClose').onclick = hidePanel;
}
function showSettings() {
  const s = S.settings;
  panel(`<div class="row" style="justify-content:space-between"><h2>SETTINGS</h2><button id="pClose">Close</button></div>
  <p class="muted">Settings for ${cap(player)}, shared with the shooter${sync.remote ? ' and saved to the Sheet' : ''}.</p>
  <h3>Fact families</h3>
  ${Object.keys(FAM).map(f => `<label class="opt"><input type="checkbox" id="fam_${f}" ${s.fams[f] ? 'checked' : ''}> <span class="fam-${f}">${FAM[f].name}</span> <span style="color:var(--phos-dim)">· ${ORDER.filter(id => ITEMS[id].fam === f).length} facts</span></label>`).join('')}
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
  else if (ev.key === 'Enter' && (mode === 'title' || mode === 'over')) { const b = $('#ovStart') || $('#ovAgain'); if (b) { b.click(); ev.preventDefault(); } }
});
$('#btnStart').onclick = () => { audio(); if (mode === 'pause') { togglePause(); return; } if (mode === 'play') return; startRound(); };
$('#btnStats').onclick = showStats;
$('#btnSettings').onclick = showSettings;
$('#btnSound').onclick = () => { S.settings.sound = !S.settings.sound; save(); updateHud(); if (S.settings.sound) { audio(); SFX.combo(1); } };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });

function start() {
  loadColors(); $('#ver').textContent = 'v' + VERSION; showTitle(); requestAnimationFrame(loop); sync.load();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('../sw.js').catch(() => {});
}
start();
})();
