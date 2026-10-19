/* Lily Hop — a frog sits on the first number; tap (or drag and release) the pad where it lands.
 * A right answer hops there one pad at a time, so the direction and size of the move are visible.
 * A wrong answer splashes, then a ghost frog shows the real hop. Built for signed-number sense. */
(function () {
'use strict';
const VERSION = '1.0.0', ROUND = 60;
const K = FF.kit({ game: 'hop', title: 'Lily Hop', version: VERSION });
const { fmt } = K;
const $ = s => document.querySelector(s);
const cv = $('#stage'), ctx = cv.getContext('2d');
let W = 800, H = 600, U = 1;
function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; U = Math.max(.75, Math.min(1.4, Math.min(W, H) / 640)); cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', resize); resize();

const LINE_FAMS = new Set(['add', 'sub', 'neg']);
const lineFact = it => LINE_FAMS.has(it.fam) && !!FF.distract.parse(it);
let G = null, mode = 'title', lastT = 0, fx = [], hover = null, banner = null;

function newRound() { G = { t: 0, score: 0, combo: 0, best: 0, right: 0, wrong: 0, q: null, frog: null, ghost: null, gap: .3, practiced: new Set() }; fx = []; banner = null; K.sched.newSession(); }
function nextQuestion() {
  const id = K.next(lineFact); if (!id) { G.q = null; banner = { text: 'Turn on addition, subtraction or negatives in Settings', t: 0, life: 99 }; return; }
  const it = FF.facts.ITEMS[id], o = FF.distract.parse(it), move = o.op === '+' ? o.b : o.op === '-' ? -o.b : 0;
  const lo0 = Math.min(0, o.a, it.answer), hi0 = Math.max(0, o.a, it.answer);
  let lo = lo0 - 2, hi = hi0 + 2; while (hi - lo < 14) { lo--; hi++; } // never fewer than 15 pads, so the answer isn't obvious from the window
  const shift = Math.floor(Math.random() * 3) - 1; lo += shift; hi += shift; if (lo > lo0 - 1) lo = lo0 - 1; if (hi < hi0 + 1) hi = hi0 + 1;
  G.q = { id, it, a: o.a, move, lo, hi, shownAt: G.t, done: false };
  G.frog = { at: o.a, x: null, y: 0, hopping: null };
}
const padX = n => { const q = G.q, m = 44 * U; return m + (n - q.lo) * (W - 2 * m) / (q.hi - q.lo); };
const lineY = () => H * .56;
const nearestPad = x => { const q = G.q, m = 44 * U, n = Math.round(q.lo + (x - m) / ((W - 2 * m) / (q.hi - q.lo))); return Math.max(q.lo, Math.min(q.hi, n)); };

function answer(n) {
  const q = G.q; if (!q || q.done || mode !== 'play') return; q.done = true;
  const rt = G.t - q.shownAt, it = q.it, ok = n === it.answer; G.practiced.add(q.id);
  K.report(q.id, ok, rt, { kind: 'verify', fastMul: 2.2, error: ok ? null : (n === -it.answer ? 'sign_flip' : n === q.a - q.move ? 'wrong_direction' : Math.abs(n - it.answer) === 1 ? 'off_by_one' : 'other') });
  if (ok) {
    G.right++; G.combo++; G.best = Math.max(G.best, G.combo);
    const fast = rt < FF.facts.FAM[it.fam].fast * 2.2, pts = 10 + (fast ? 5 : 0) + Math.min(G.combo - 1, 10) * 2; G.score += pts;
    hopTo(G.frog, it.answer, () => { K.sfx.good(); fx.push({ k: 'text', x: padX(it.answer), y: lineY() - 90 * U, text: '+' + pts + (fast ? ' fast!' : ''), t: 0, life: 1 }); ripple(it.answer); G.gap = .55; });
  } else {
    G.wrong++; G.combo = 0;
    jumpTo(G.frog, n, () => { K.sfx.splash(); splash(n); });
    G.ghost = { at: q.a, hopping: null, wait: .8, target: it.answer, finished: false };
    const dir = q.move > 0 ? 'right' : 'left';
    banner = { text: `${it.prompt} : start at ${fmt(q.a)}, hop ${Math.abs(q.move)} ${dir} → ${fmt(it.answer)}`, t: 0, life: 3.2 };
  }
  if (K.goalReached() && !G.goalShown) { G.goalShown = true; K.sfx.goal(); }
}
/* one pad at a time for small moves (you can count them), one big arc for big ones */
function hopTo(f, target, done) {
  const steps = [], dir = Math.sign(target - f.at) || 1, n = Math.abs(target - f.at);
  if (n <= 12) for (let i = 1; i <= n; i++) steps.push(f.at + dir * i); else steps.push(target);
  f.hopping = { steps, i: 0, from: f.at, t: 0, dur: n <= 12 ? .16 : .55, done };
}
function jumpTo(f, target, done) { f.hopping = { steps: [target], i: 0, from: f.at, t: 0, dur: .45, done }; }
function stepFrog(f, dt) {
  const h = f.hopping; if (!h) return;
  h.t += dt; if (h.t >= h.dur) { f.at = h.steps[h.i]; h.from = f.at; h.i++; h.t = 0; if (f !== G.ghost) K.sfx.hop(); if (h.i >= h.steps.length) { f.hopping = null; if (h.done) h.done(); } }
}
function frogPos(f) {
  const y0 = lineY() - 18 * U;
  if (!f.hopping) return { x: padX(f.at), y: y0, squash: 0 };
  const h = f.hopping, to = h.steps[h.i], k = h.t / h.dur, x = padX(h.from) + (padX(to) - padX(h.from)) * k;
  const height = (Math.abs(padX(to) - padX(h.from)) * .45 + 30 * U);
  return { x, y: y0 - Math.sin(k * Math.PI) * height, squash: Math.sin(k * Math.PI) };
}
function ripple(n) { fx.push({ k: 'ripple', x: padX(n), y: lineY(), t: 0, life: .9 }); }
function splash(n) { for (let i = 0; i < 18; i++) { const a = -Math.PI * Math.random(), v = (80 + Math.random() * 200) * U; fx.push({ k: 'drop', x: padX(n), y: lineY(), vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: .8 }); } fx.push({ k: 'ripple', x: padX(n), y: lineY(), t: 0, life: 1.2 }); }

/* ---- input: drag along the line to preview, release to answer; a plain tap works too ---- */
cv.addEventListener('pointerdown', ev => { if (mode !== 'play' || !G.q || G.q.done) return; K.audio(); hover = nearestPad(ev.clientX); cv.setPointerCapture(ev.pointerId); });
cv.addEventListener('pointermove', ev => { if (hover != null && mode === 'play' && G.q && !G.q.done) hover = nearestPad(ev.clientX); });
cv.addEventListener('pointerup', ev => { if (hover == null) return; const n = nearestPad(ev.clientX); hover = null; answer(n); });
cv.addEventListener('pointercancel', () => { hover = null; });

/* ---- loop ---- */
function update(dt) {
  if (mode !== 'play') return;
  G.t += dt; const left = ROUND - G.t;
  if (left <= 0) return end();
  if (G.frog) stepFrog(G.frog, dt);
  if (G.ghost) { const gh = G.ghost; if (!gh.hopping && !gh.finished) { gh.wait -= dt; if (gh.wait <= 0 && !gh.started) { gh.started = true; hopTo(gh, gh.target, () => { gh.finished = true; G.gap = 1.6; }); } } stepFrog(gh, dt); }
  if (!G.q || (G.q.done && !G.frog.hopping && (!G.ghost || G.ghost.finished))) { G.gap -= dt; if (G.gap <= 0) { G.ghost = null; nextQuestion(); } }
}
function end() {
  mode = 'over'; K.setBest(G.score); K.finish({ wave: 0, score: G.score, answers: G.right + G.wrong, correct: G.right, facts: G.practiced.size, bestStreak: G.best, seconds: Math.round(G.t) }); K.sfx.win();
  K.result({ heading: G.wrong === 0 && G.right > 0 ? 'Perfect pond!' : "Time's up!", stats: [[G.score, 'score'], [G.right, 'right'], [G.best, 'best streak']],
    lines: [`${G.wrong} splash${G.wrong === 1 ? '' : 'es'} · best ${K.best()}`], onAgain: start });
}
function start() { newRound(); mode = 'play'; K.hide(); }

/* ---- draw ---- */
const C = { sky1: '#bfe9f2', sky2: '#e9f8ef', water1: '#5cc4d6', water2: '#2b8ea8', pad: '#5cb85c', pad2: '#3d8b3d', frog: '#7bd25b', frog2: '#4e9e35', ink: '#123c4a', neg: '#4361ee', pos: '#2a9d8f', gold: '#ffb703' };
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawFrog(x, y, s, ghost) {
  ctx.save(); ctx.translate(x, y); ctx.scale(U * (1 + s * .08), U * (1 - s * .1)); ctx.globalAlpha = ghost ? .45 : 1;
  ctx.fillStyle = ghost ? '#ffffff' : C.frog; ctx.strokeStyle = ghost ? '#ffffff' : C.frog2; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 18, 0, 0, Math.PI * 2); ctx.fill(); if (ghost) { ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]); }
  [-11, 11].forEach(ex => { ctx.fillStyle = ghost ? '#fff' : C.frog; ctx.beginPath(); ctx.arc(ex, -16, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, -16, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#123'; ctx.beginPath(); ctx.arc(ex + 1, -15, 2.6, 0, Math.PI * 2); ctx.fill(); });
  ctx.strokeStyle = '#2d5f1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 2, 9, .2, Math.PI - .2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,120,.5)'; ctx.beginPath(); ctx.arc(-15, 3, 3.5, 0, Math.PI * 2); ctx.arc(15, 3, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function draw(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.sky1); g.addColorStop(.38, C.sky2); g.addColorStop(.42, C.water1); g.addColorStop(1, C.water2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // reeds on the bank, gentle wave lines on the water
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; for (let r = 0; r < 6; r++) { const y = H * (.48 + r * .08); ctx.beginPath(); for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y + Math.sin(x / 40 + t / 900 + r) * 3); ctx.stroke(); }
  ctx.fillStyle = '#6aa84f'; for (let i = 0; i < 18; i++) { const x = (i * 97) % W, h = 30 + (i * 37) % 40; ctx.beginPath(); ctx.moveTo(x - 3, H * .41); ctx.quadraticCurveTo(x + Math.sin(t / 700 + i) * 4, H * .41 - h, x + 3, H * .41); ctx.fill(); }
  if (G && G.q) {
    const q = G.q, y = lineY(), sp = (W - 88 * U) / (q.hi - q.lo), pr = Math.min(26 * U, sp * .46);
    for (let n = q.lo; n <= q.hi; n++) {
      const x = padX(n), isZero = n === 0, hov = hover === n;
      ctx.save(); ctx.translate(x, y + Math.sin(t / 600 + n) * 1.5); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(2, 4, pr, pr * .45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hov ? '#8fe08f' : C.pad; ctx.beginPath(); ctx.ellipse(0, 0, pr * (hov ? 1.12 : 1), pr * .45 * (hov ? 1.12 : 1), 0, .25, Math.PI * 2 - .05); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.pad2; ctx.lineWidth = 1.5; ctx.stroke();
      if (isZero) { ctx.fillStyle = C.gold; for (let p = 0; p < 6; p++) { const a = p * Math.PI / 3; ctx.beginPath(); ctx.ellipse(Math.cos(a) * pr * .35, Math.sin(a) * pr * .16 - 4, pr * .22, pr * .12, a, 0, Math.PI * 2); ctx.fill(); } }
      ctx.restore();
      const showLabel = sp >= 26 * U || n % 5 === 0 || n === q.lo || n === q.hi || hov;
      if (showLabel) { ctx.font = `700 ${Math.round(Math.min(22, sp * .62) * (hov ? 1.3 : 1))}px Fredoka, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = n < 0 ? C.neg : n > 0 ? C.pos : C.ink; ctx.fillText(fmt(n), x, y + pr * .6 + 8); }
    }
    // the hover preview bubble
    if (hover != null) { const x = padX(hover); ctx.font = `700 ${Math.round(34 * U)}px Fredoka, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const w = ctx.measureText(fmt(hover)).width + 28 * U; ctx.fillStyle = '#fffdf6'; rr(x - w / 2, y - 120 * U, w, 52 * U, 26 * U); ctx.fill(); ctx.fillStyle = C.ink; ctx.fillText(fmt(hover), x, y - 94 * U); }
    // the problem card
    const fs = Math.round(Math.max(34, 54 * U)); ctx.font = `700 ${fs}px Fredoka, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const txt = q.it.prompt + ' = ?', w = ctx.measureText(txt).width + fs * 1.1, h = fs * 1.5, ty = Math.max(96, H * .12);
    ctx.save(); ctx.shadowColor = 'rgba(18,60,74,.2)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; ctx.fillStyle = '#fffdf6'; rr(W / 2 - w / 2, ty, w, h, h * .4); ctx.fill(); ctx.restore();
    ctx.fillStyle = q.done ? '#7a9aa3' : C.ink; ctx.fillText(txt, W / 2, ty + h / 2 + 2);
    ctx.font = `600 ${Math.round(fs * .36)}px Fredoka, system-ui`; ctx.fillStyle = '#2f6273'; ctx.fillText(q.done ? '' : 'Tap where the frog lands', W / 2, ty + h + fs * .45);
    // frogs
    if (G.ghost) { const p = frogPos(G.ghost); drawFrog(p.x, p.y, p.squash, true); }
    const p = frogPos(G.frog); drawFrog(p.x, p.y, p.squash, false);
  }
  for (const f of fx) { const k = f.t / f.life;
    if (f.k === 'ripple') { ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, f.y, 20 * U + k * 70 * U, (20 * U + k * 70 * U) * .35, 0, 0, Math.PI * 2); ctx.stroke(); }
    else if (f.k === 'drop') { ctx.fillStyle = `rgba(255,255,255,${1 - k})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t + 400 * U * f.t * f.t, 4 * U, 0, Math.PI * 2); ctx.fill(); }
    else if (f.k === 'text') { ctx.globalAlpha = 1 - k; ctx.font = `700 ${Math.round(32 * U)}px Fredoka, system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#e08e00'; ctx.fillText(f.text, f.x, f.y - k * 30); ctx.globalAlpha = 1; } }
  if (banner) { const k = banner.t / banner.life; ctx.globalAlpha = k > .85 ? (1 - k) / .15 : 1; const fs = Math.round(Math.max(18, 22 * U)); ctx.font = `600 ${fs}px Fredoka, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(W - 24, ctx.measureText(banner.text).width + fs * 1.4), h = fs * 2, y = H - h - 30 * U; ctx.fillStyle = '#fffdf6'; rr(W / 2 - w / 2, y, w, h, h / 2); ctx.fill(); ctx.fillStyle = C.ink; ctx.fillText(banner.text, W / 2, y + h / 2 + 1); ctx.globalAlpha = 1; }
}
function loop(t) { const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t; update(dt); for (const f of fx) f.t += dt; fx = fx.filter(f => f.t < f.life); if (banner && mode === 'play') { banner.t += dt; if (banner.t > banner.life) banner = null; } draw(t); hud(); requestAnimationFrame(loop); }
function hud() {
  const left = G && mode !== 'title' ? Math.max(0, ROUND - G.t) : ROUND; $('#hudClock').textContent = Math.ceil(left); $('#hudClock').classList.toggle('low', left <= 10);
  $('#hudScore').textContent = G ? G.score : 0; $('#hudSub').textContent = 'Best ' + K.best(); $('#hudMid').textContent = G && G.combo >= 3 ? 'Streak ×' + G.combo : '';
  const n = K.sched.todayCount(), g = K.S.settings.goal; $('#hudGoal').textContent = (K.PLAYERS.length > 1 ? K.cap(K.player) + ' · ' : '') + (n >= g ? `Today ${n} ✓` : `Today ${n}/${g}`);
}
$('#btnPause').onclick = () => { if (mode === 'play') { mode = 'pause'; K.pauseCard(() => { mode = 'play'; K.hide(); lastT = performance.now(); }, () => { mode = 'play'; G.t = ROUND; }); } };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') $('#btnPause').click(); });
K.sound($('#btnSound'));
K.title({ heading: 'Lily Hop', blurb: 'The frog starts on the first number. <b>Tap the pad where it lands.</b> Drag along the pads to see each number, let go to choose.', extra: '<p class="small">Hop right to add, left to subtract. 60 seconds.</p>', onPlay: start });
requestAnimationFrame(loop);
})();
