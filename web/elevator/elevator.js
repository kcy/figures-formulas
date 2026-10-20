/* Elevator Drop — the floors of a building are a vertical number line, with the negatives underground.
 * The car rides to the first number; tap (or arrow to) the floor where it stops after the move.
 * A wrong floor flashes red, then the car goes back to the start and rides the real move one floor at a time.
 * No clock: a round is 12 trips. Built for signed-number sense, like Lily Hop turned on its side. */
(function () {
'use strict';
const VERSION = '1.0.0', TRIPS = 12;
const K = FF.kit({ game: 'elevator', title: 'Elevator Drop', version: VERSION });
const { fmt } = K;
const $ = s => document.querySelector(s);
const cv = $('#stage'), ctx = cv.getContext('2d');
const FONT = '"Baloo 2", ui-rounded, system-ui, sans-serif';
let W = 800, H = 600, U = 1, L = null;
function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; U = Math.max(.75, Math.min(1.4, Math.min(W, H) / 640)); cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); layout(); }
/* wide screens: problem on the left, building on the right; tall screens: problem on top, building below */
function layout() {
  const fs = Math.round(Math.max(34, 54 * U)), wide = W >= H * 1.05 && W >= 700;
  if (wide) { const bw = Math.min(560 * U, W * .5), bx1 = W - Math.max(16, W * .03); L = { wide, fs, bx0: bx1 - bw, bx1, by0: 84, by1: H - 18, px: (bx1 - bw) / 2, pw: bx1 - bw - 32, ty: H * .34 }; }
  else { const bw = Math.min(560 * U, W - 32), ty = Math.max(96, H * .1); L = { wide, fs, bx0: (W - bw) / 2, bx1: (W + bw) / 2, by0: ty + fs * 1.5 + 64 * U, by1: H - 18, px: W / 2, pw: W - 24, ty }; }
}
addEventListener('resize', resize); resize();

const LINE_FAMS = new Set(['add', 'sub', 'neg']);
const lineFact = it => LINE_FAMS.has(it.fam) && !!FF.distract.parse(it);
let G = null, mode = 'title', lastT = 0, hover = null;

function newRound() { G = { t: 0, trip: 0, score: 0, combo: 0, best: 0, right: 0, wrong: 0, q: null, car: 0, fade: 1, ride: null, timer: null, flash: null, count: null, cursor: 0, kbd: false, say: '', sayBad: false, phase: 'idle', practiced: new Set() }; hover = null; K.sched.newSession(); }

/* ---- timeline: one ride or one wait at a time, both run on game time so Pause freezes them ---- */
function ride(to, dur, done) { G.ride = { from: G.car, to, t: 0, dur: Math.max(.01, dur), done }; }
function wait(s, done) { G.timer = { left: s, done }; }
const rideTime = d => Math.min(.25 + d * .09, 1.1);
/* one floor at a time, with a tick and a running count, so the size and direction of the move are visible */
function stepRide(to, done) {
  const dir = Math.sign(to - G.car), n = Math.abs(to - G.car); let k = 0;
  const step = () => { if (k >= n) { done(); return; } k++; ride(G.car + dir, .3, () => { K.sfx.tick(); G.count = { k, dir }; step(); }); };
  G.count = { k: 0, dir }; step();
}

/* the visible floors: at least 13, always one spare floor above and below the move; take in the ground floor when it fits */
function rowsFit() { return Math.max(13, Math.min(17, Math.floor((L.by1 - L.by0) / (40 * U)))); }
function pickWindow(mn, mx) {
  const R = rowsFit(), slack = Math.max(0, R - (mx - mn + 1)), opts = [];
  for (let lo = mn - slack; lo <= mn; lo++) opts.push(lo);
  const withZero = opts.filter(lo => lo <= 0 && lo + R - 1 >= 0), pool = withZero.length ? withZero : opts;
  const lo = pool[Math.floor(Math.random() * pool.length)];
  return { lo, hi: lo + R - 1 };
}

function nextQuestion() {
  if (G.trip >= TRIPS) return end();
  const id = K.next(lineFact);
  if (!id) { G.phase = 'idle'; G.say = 'Turn on addition, subtraction or negatives in Settings'; return; }
  const it = FF.facts.ITEMS[id], o = FF.distract.parse(it), move = o.op === '+' ? o.b : o.op === '-' ? -o.b : 0;
  const mn = Math.min(o.a, it.answer) - 1, mx = Math.max(o.a, it.answer) + 1, old = G.q;
  let win = old && old.lo <= mn && old.hi >= mx && G.car >= old.lo && G.car <= old.hi ? { lo: old.lo, hi: old.hi } : null;
  if (!win) { win = pickWindow(mn, mx); G.car = o.a; G.fade = 0; }
  G.trip++; G.flash = null; G.count = null;
  G.q = { id, it, a: o.a, op: o.op, b: o.b, move, lo: win.lo, hi: win.hi, done: false, shownAt: null };
  if (G.car !== o.a) { G.phase = 'move'; G.say = `Going to floor ${fmt(o.a)}…`; G.sayBad = false; ride(o.a, rideTime(Math.abs(G.car - o.a)), ask); }
  else ask();
}
function ask() { G.phase = 'ask'; G.q.shownAt = G.t; G.cursor = G.q.a; G.say = 'Tap the floor where it stops'; G.sayBad = false; }

function explain(q) {
  const dir = q.move > 0 ? 'up' : 'down', steps = Math.abs(q.move);
  const why = q.op === '-' && q.b < 0 ? ` (taking away ${fmt(q.b)} goes up)` : q.op === '+' && q.b < 0 ? ` (adding ${fmt(q.b)} goes down)` : '';
  return `${q.it.prompt}: start on ${fmt(q.a)}, go ${dir} ${steps} → ${fmt(q.it.answer)}${why}`;
}
function answer(n) {
  const q = G.q; if (!q || q.done || mode !== 'play' || G.phase !== 'ask') return;
  q.done = true; G.phase = 'show'; hover = null;
  const rt = G.t - q.shownAt, it = q.it, ok = n === it.answer; G.practiced.add(q.id);
  K.report(q.id, ok, rt, { kind: 'verify', fastMul: 2.2, error: ok ? null : n === q.a - q.move ? 'wrong_direction' : FF.distract.classify(it, n) });
  ride(n, rideTime(Math.abs(n - G.car)), () => {
    if (ok) {
      G.right++; G.combo++; G.best = Math.max(G.best, G.combo);
      const fast = rt < FF.facts.FAM[it.fam].fast * 2.2, pts = 10 + (fast ? 5 : 0) + Math.min(G.combo - 1, 10) * 2; G.score += pts;
      K.sfx.good(); G.flash = { floor: n, good: true }; G.say = `Ding! +${pts}${fast ? ' fast!' : ''}`; G.sayBad = false;
      wait(.8, nextQuestion);
    } else {
      G.wrong++; G.combo = 0;
      K.sfx.bad(); G.flash = { floor: n, good: false }; G.say = explain(q); G.sayBad = true;
      wait(.7, () => { G.flash = null; ride(q.a, .5, () => wait(.3, () => stepRide(it.answer, () => { K.sfx.good(); G.flash = { floor: it.answer, good: true }; wait(1.4, nextQuestion); }))); });
    }
    if (K.goalReached() && !G.goalShown) { G.goalShown = true; K.sfx.goal(); }
  });
}

/* ---- input: drag over the floors to preview, release to choose; a plain tap works too. Arrow keys + Enter on a keyboard. ---- */
const rowH = () => (L.by1 - L.by0) / (G.q.hi - G.q.lo + 1);
const floorTop = n => L.by0 + (G.q.hi - n) * rowH();
const floorAtY = y => Math.max(G.q.lo, Math.min(G.q.hi, G.q.hi - Math.floor((y - L.by0) / rowH())));
const canPick = () => mode === 'play' && G && G.q && G.phase === 'ask';
cv.addEventListener('pointerdown', ev => {
  if (!canPick()) return; K.audio();
  if (ev.clientX < L.bx0 - 24 || ev.clientX > L.bx1 + 24 || ev.clientY < L.by0 - 8 || ev.clientY > L.by1 + 8) return;
  G.kbd = false; hover = floorAtY(ev.clientY); cv.setPointerCapture(ev.pointerId);
});
cv.addEventListener('pointermove', ev => { if (hover != null && canPick()) hover = floorAtY(ev.clientY); });
cv.addEventListener('pointerup', ev => { if (hover == null) return; hover = null; if (canPick()) answer(floorAtY(ev.clientY)); });
cv.addEventListener('pointercancel', () => { hover = null; });
document.addEventListener('keydown', ev => {
  if (!$('#overlay').hidden) { if (ev.key === 'Enter') { const b = $('#ovPlay') || $('#ovAgain') || $('#ovRes'); if (b) { b.click(); ev.preventDefault(); } } return; }
  if (ev.key === 'Escape' || ev.key === 'p') { $('#btnPause').click(); return; }
  if (!canPick()) return;
  if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); K.audio(); if (G.kbd) G.cursor = Math.max(G.q.lo, Math.min(G.q.hi, G.cursor + (ev.key === 'ArrowUp' ? 1 : -1))); G.kbd = true; }
  else if ((ev.key === 'Enter' || ev.key === ' ') && G.kbd) { ev.preventDefault(); answer(G.cursor); }
});

/* ---- loop ---- */
function update(dt) {
  if (mode !== 'play') return;
  G.t += dt; G.fade = Math.min(1, G.fade + dt * 3);
  if (G.ride) { const r = G.ride; r.t += dt; const k = Math.min(1, r.t / r.dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; G.car = r.from + (r.to - r.from) * e;
    if (k >= 1) { G.car = r.to; G.ride = null; if (r.done) r.done(); } }
  else if (G.timer) { G.timer.left -= dt; if (G.timer.left <= 0) { const d = G.timer.done; G.timer = null; d(); } }
}
function end() {
  mode = 'over'; G.phase = 'idle'; K.setBest(G.score); K.sfx.win();
  K.finish({ wave: 0, score: G.score, answers: G.right + G.wrong, correct: G.right, facts: G.practiced.size, bestStreak: G.best, seconds: Math.round(G.t) });
  K.result({ heading: G.wrong === 0 && G.right > 0 ? 'Every floor right!' : 'Last stop!', stats: [[G.score, 'score'], [`${G.right}/${TRIPS}`, 'right'], [G.best, 'best streak']],
    lines: [`${G.wrong} wrong floor${G.wrong === 1 ? '' : 's'} · best ${K.best()}`], onAgain: start });
}
function start() { newRound(); mode = 'play'; K.hide(); nextQuestion(); }

/* ---- draw ---- */
const C = { sky1: '#8fd3ff', sky2: '#c9ecff', soil1: '#8a5b3a', soil2: '#4e3221', grass: '#3d8b37', wall: '#e3eef7', brick: '#2f6f8f', brick2: '#245a75', dirt: '#6e4a31', dirt2: '#4a2f1e',
  car: '#f2b632', car2: '#b9821a', ink: '#16263d', good: '#2fbf71', bad: '#ef5b5b', neg: '#4361ee', pos: '#1f7a6d' };
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function draw() {
  let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.sky1); g.addColorStop(1, C.sky2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (G && G.q) drawBuilding();
  else { ctx.fillStyle = C.grass; ctx.fillRect(0, H * .7, W, 6); g = ctx.createLinearGradient(0, H * .7, 0, H); g.addColorStop(0, C.soil1); g.addColorStop(1, C.soil2); ctx.fillStyle = g; ctx.fillRect(0, H * .7 + 6, W, H); }
  if (G && (G.q || G.say)) drawPanel();
}
function drawBuilding() {
  const q = G.q, rh = rowH(), { bx0, bx1, by0, by1 } = L, lw = Math.max(44, 52 * U), sw = 70 * U, sx = bx1 - sw;
  // the ground: soil from the bottom of floor 0 down (or the whole picture, when every floor shown is underground)
  const gy = q.lo > 0 ? null : q.hi < 0 ? 0 : floorTop(0) + rh;
  if (gy != null) { const g = ctx.createLinearGradient(0, gy, 0, H); g.addColorStop(0, C.soil1); g.addColorStop(1, C.soil2); ctx.fillStyle = g; ctx.fillRect(0, gy, W, H - gy); if (q.hi >= 0) { ctx.fillStyle = C.grass; ctx.fillRect(0, gy - 3, W, 6); } }
  // walls and the shaft
  ctx.fillStyle = 'rgba(255,255,255,.55)'; rr(bx0, by0 - 6, bx1 - bx0, by1 - by0 + 12, 14); ctx.fill();
  ctx.fillStyle = 'rgba(22,38,61,.16)'; rr(sx, by0 - 2, sw - 4, by1 - by0 + 4, 10); ctx.fill();
  const sel = hover != null ? hover : G.kbd && G.phase === 'ask' ? G.cursor : null;
  for (let n = q.lo; n <= q.hi; n++) {
    const y = floorTop(n), under = n < 0, x = bx0 + lw, w = sx - 8 - x;
    let fill = under ? C.dirt : C.brick;
    if (G.flash && G.flash.floor === n) fill = G.flash.good ? C.good : C.bad;
    ctx.fillStyle = fill; rr(x, y + 2, w, rh - 4, 7); ctx.fill();
    ctx.fillStyle = under ? C.dirt2 : C.brick2; ctx.fillRect(x + 4, y + rh - 5, w - 8, 3);
    // windows
    ctx.fillStyle = under ? 'rgba(255,214,140,.35)' : 'rgba(255,255,255,.45)';
    const wy = y + rh * .28, wh = rh * .4; for (let wx = x + 14 * U; wx + 16 * U < x + w - 10 * U; wx += 30 * U) { rr(wx, wy, 16 * U, wh, 3); ctx.fill(); }
    if (sel === n) { ctx.fillStyle = 'rgba(255,255,255,.28)'; rr(x, y + 2, w, rh - 4, 7); ctx.fill(); ctx.strokeStyle = C.car; ctx.lineWidth = 4; rr(x - 2, y, w + 4, rh, 9); ctx.stroke(); }
    // floor number
    const fsz = Math.round(Math.min(26 * U, rh * .58) * (sel === n ? 1.2 : 1));
    ctx.font = `800 ${fsz}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = under ? '#fff3e6' : C.ink;
    const ly = y + rh / 2 + fsz * .06; ctx.fillText(fmt(n), bx0 + lw / 2, ly);
    if (n === 0) { const tw = ctx.measureText('0').width; ctx.fillRect(bx0 + lw / 2 - tw, ly + fsz * .38, tw * 2, 3); }
  }
  // the car
  const cy = floorTop(G.car), cx = sx + 4, cw = sw - 12, ch = rh - 6;
  ctx.save(); ctx.globalAlpha = G.fade;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; rr(cx + 2, cy + 6, cw, ch, 9); ctx.fill();
  ctx.fillStyle = C.car; ctx.strokeStyle = C.car2; ctx.lineWidth = 3; rr(cx, cy + 3, cw, ch, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(185,130,26,.5)'; ctx.fillRect(cx + cw / 2 - 1, cy + 7, 2, ch - 8);
  const shown = Math.round(G.car), cfs = Math.round(Math.min(26 * U, ch * .62));
  ctx.font = `800 ${cfs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2b1d00'; ctx.fillText(fmt(shown), cx + cw / 2, cy + 3 + ch / 2 + cfs * .06);
  ctx.restore();
  // the running count during a shown move
  if (G.count && G.count.k > 0) {
    const t = (G.count.dir > 0 ? '+' : '−') + G.count.k, f = Math.round(Math.max(20, 26 * U)); ctx.font = `800 ${f}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(t).width + f, x = sx - 14 - w / 2, y = cy + rh / 2; ctx.fillStyle = '#ffffff'; rr(x - w / 2, y - f * .7, w, f * 1.4, f * .7); ctx.fill(); ctx.fillStyle = G.count.dir > 0 ? C.pos : C.neg; ctx.fillText(t, x, y + f * .06);
  }
}
function drawPanel() {
  const q = G.q, cx = L.px;
  let fs = L.fs; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (q) {
    const txt = q.it.prompt + ' = ?'; ctx.font = `800 ${fs}px ${FONT}`;
    while (fs > 24 && ctx.measureText(txt).width + fs * 1.1 > L.pw) { fs -= 2; ctx.font = `800 ${fs}px ${FONT}`; }
    const w = ctx.measureText(txt).width + fs * 1.1, h = fs * 1.5, ty = L.ty;
    ctx.save(); ctx.shadowColor = 'rgba(22,38,61,.2)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; ctx.fillStyle = '#ffffff'; rr(cx - w / 2, ty, w, h, h * .4); ctx.fill(); ctx.restore();
    ctx.fillStyle = q.done ? '#7a8ea3' : C.ink; ctx.fillText(txt, cx, ty + h / 2 + fs * .06);
  }
  if (G.say) {
    const sf = Math.round(Math.max(18, 22 * U)), ty = q ? L.ty + fs * 1.5 + 18 * U : L.ty; ctx.font = `700 ${sf}px ${FONT}`;
    const lines = wrap(G.say, L.pw - sf * 1.4);
    if (G.sayBad) { const w = Math.min(L.pw, Math.max(...lines.map(l => ctx.measureText(l).width)) + sf * 1.4), h = lines.length * sf * 1.25 + sf * .8; ctx.fillStyle = '#ffffff'; rr(cx - w / 2, ty, w, h, Math.min(h / 2, sf)); ctx.fill(); }
    ctx.fillStyle = G.sayBad ? C.ink : '#33496a'; lines.forEach((l, i) => ctx.fillText(l, cx, ty + sf * .4 + sf * 1.25 * (i + .5)));
  }
}
function wrap(text, maxW) {
  const words = text.split(' '), out = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function loop(t) { const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t; update(dt); draw(); hud(); requestAnimationFrame(loop); }
function hud() {
  $('#hudClock').textContent = `${G ? Math.max(1, G.trip) : 1}/${TRIPS}`;
  $('#hudScore').textContent = G ? G.score : 0; $('#hudSub').textContent = 'Best ' + K.best(); $('#hudMid').textContent = G && G.combo >= 3 ? 'Streak ×' + G.combo : '';
  const n = K.sched.todayCount(), g = K.S.settings.goal; $('#hudGoal').textContent = (K.PLAYERS.length > 1 ? K.cap(K.player) + ' · ' : '') + (n >= g ? `Today ${n} ✓` : `Today ${n}/${g}`);
}
$('#btnPause').onclick = () => { if (mode === 'play') { mode = 'pause'; hover = null; K.pauseCard(() => { mode = 'play'; K.hide(); lastT = performance.now(); }, () => { mode = 'play'; end(); }); } };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') $('#btnPause').click(); });
K.sound($('#btnSound'));
K.title({ heading: 'Elevator Drop', blurb: 'The elevator rides to the first number. <b>Tap the floor where it stops.</b> Floors below the ground are the negative numbers.',
  extra: '<p class="small">Up to add, down to subtract. 12 trips, no clock. On a keyboard: ↑ ↓ to pick a floor, Enter to choose.</p>', onPlay: start });
requestAnimationFrame(loop);
window.__game = () => ({ G, mode, L, VERSION });
})();
