/* Array Grid — times tables as rows of dots on graph paper. New facts show the whole array; once a fact is
 * settling in, the array flashes and fades; once it's fluent, there are no dots at all. Every answer, right
 * or wrong, ends with the full array and the skip-count down the side, so the picture stays attached to the fact. */
(function () {
'use strict';
const VERSION = '1.0.0', ROUND = 60;
const K = FF.kit({ game: 'arrays', title: 'Array Grid', version: VERSION });
const { fmt } = K;
const $ = s => document.querySelector(s);
const cv = $('#stage'), ctx = cv.getContext('2d'), pad = $('#keypad');
let W = 800, H = 600, U = 1;
function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; U = Math.max(.75, Math.min(1.4, Math.min(W, H) / 640)); cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', resize); resize();

const tableFact = it => (it.fam === 'mul' || it.fam === 'div') && it.layer === 1 && !!FF.distract.parse(it);
let G = null, mode = 'title', lastT = 0, fx = [], banner = null;

function newRound() { G = { t: 0, typed: '', q: null, score: 0, right: 0, wrong: 0, combo: 0, best: 0, practiced: new Set(), goalShown: false, gap: 0 }; fx = []; banner = null; K.sched.newSession(); }
function nextQuestion() {
  const id = K.next(tableFact, { ignoreFamilies: true });
  if (!id) { G.q = null; banner = { text: 'No times-table facts left to show today', t: 0, life: 99 }; return; }
  const it = FF.facts.ITEMS[id], o = FF.distract.parse(it), c = K.S.cards[id], stage = c ? c.stage : 'new';
  // the picture: a × b is a rows of b; c ÷ b is c dots in rows of b (so the rows are the answer)
  const rows = it.fam === 'mul' ? o.a : it.answer, cols = o.b;
  const scaffold = stage === 'fluent' ? 'none' : stage === 'review' ? 'flash' : 'full';
  G.q = { id, it, rows, cols, scaffold, shownAt: G.t, done: false, reveal: 0, ok: null }; G.typed = '';
}
function submit() {
  const q = G.q; if (!q || q.done || mode !== 'play' || G.typed === '' || G.typed === '-') return;
  const n = +G.typed, it = q.it, ok = n === it.answer, rt = G.t - q.shownAt; G.practiced.add(q.id);
  K.report(q.id, ok, rt, { kind: 'produce', error: ok ? null : FF.distract.classify(it, n) });
  q.done = true; q.ok = ok; q.doneAt = G.t;
  if (ok) {
    G.right++; G.combo++; G.best = Math.max(G.best, G.combo);
    const fast = rt < FF.facts.FAM[it.fam].fast, pts = 10 + (fast ? 5 : 0) + (q.scaffold === 'none' ? 5 : 0) + Math.min(G.combo - 1, 10) * 2; G.score += pts;
    K.sfx.good(); fx.push({ k: 'text', text: '+' + pts + (fast ? ' fast!' : ''), t: 0, life: 1 }); G.gap = 1.1;
  } else {
    G.wrong++; G.combo = 0; K.sfx.bad();
    banner = { text: it.fam === 'mul' ? `${q.rows} rows of ${q.cols} = ${fmt(it.answer)}` : `${fmt(it.answer * q.cols)} in rows of ${q.cols} makes ${fmt(it.answer)} rows`, t: 0, life: 3 };
    G.gap = 3;
  }
  if (K.goalReached() && !G.goalShown) { G.goalShown = true; K.sfx.goal(); }
}
function onKey(k) {
  if (mode !== 'play' || !G.q || G.q.done) return;
  if (k === 'go') return submit();
  if (k === 'bs') G.typed = G.typed.slice(0, -1);
  else if (k === '-') return;
  else if (G.typed.length < 3) G.typed += k;
  K.sfx.tick();
  if (G.typed !== '' && +G.typed === G.q.it.answer) submit();
}
K.keypad(pad, onKey);

function update(dt) {
  if (mode !== 'play') return;
  G.t += dt;
  const q = G.q;
  if (ROUND - G.t <= 0 && (!q || !q.done || G.gap <= 0)) return end();
  if (q && q.done) { q.reveal = Math.min(1, q.reveal + dt * 2.2); G.gap -= dt; if (G.gap <= 0) { if (ROUND - G.t <= 0) return end(); nextQuestion(); } }
}
function end() {
  mode = 'over'; K.setBest(G.score); K.finish({ wave: 0, score: G.score, answers: G.right + G.wrong, correct: G.right, facts: G.practiced.size, bestStreak: G.best, seconds: Math.round(G.t) }); K.sfx.win();
  K.result({ heading: G.wrong === 0 && G.right > 0 ? 'Clean page!' : 'Pencils down!', stats: [[G.score, 'score'], [G.right, 'right'], [G.best, 'best streak']],
    lines: [`${G.wrong} to look at again · best ${K.best()}`], onAgain: start });
}
function start() { newRound(); mode = 'play'; K.hide(); nextQuestion(); }

/* ---- draw ---- */
const C = { paper: '#f7f5ee', grid: '#d6e2f3', grid5: '#a9bfe0', ink: '#22304a', blue: '#2f6fde', red: '#e5484d', dot: '#ff8a3d', dot2: '#2f6fde', green: '#2b9348', ghost: 'rgba(34,48,74,.12)' };
const F = (w, px) => `${w} ${Math.round(px)}px Kalam, "Patrick Hand", system-ui`;
function draw(t) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  const cell = Math.round(26 * U);
  ctx.lineWidth = 1; ctx.strokeStyle = C.grid; ctx.beginPath(); for (let x = .5; x < W; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = .5; y < H; y += cell) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
  ctx.strokeStyle = 'rgba(229,72,77,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(56 * U, 0); ctx.lineTo(56 * U, H); ctx.stroke(); // the notebook margin
  if (!G || !G.q || mode === 'title') return;
  const q = G.q, it = q.it, padTop = pad.getBoundingClientRect().top || H * .7;
  // problem, handwritten across the top
  const fs = Math.round(Math.max(40, 62 * U)), ty = Math.max(100, H * .12);
  ctx.font = F(700, fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const left = it.prompt + ' = ', ans = G.typed === '' ? '?' : G.typed, lw = ctx.measureText(left).width, aw = ctx.measureText(ans).width, x0 = W / 2 - (lw + aw) / 2;
  ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText(left, x0, ty + fs * .5);
  ctx.fillStyle = q.done ? (q.ok ? C.green : C.red) : G.typed === '' ? '#9aa6bd' : C.blue; ctx.fillText(ans, x0 + lw, ty + fs * .5);
  if (q.done && !q.ok) { ctx.strokeStyle = C.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0 + lw - 4, ty + fs * .55); ctx.lineTo(x0 + lw + aw + 4, ty + fs * .45); ctx.stroke();
    ctx.fillStyle = C.green; ctx.fillText(fmt(it.answer), x0 + lw + aw + 18 * U, ty + fs * .5); }
  // the array
  const top = ty + fs * 1.25, bottom = padTop - 20 * U, availH = bottom - top - 24 * U, availW = W - 160 * U;
  const s = Math.max(10, Math.min(46 * U, availH / q.rows, availW / q.cols)), gw = s * q.cols, gh = s * q.rows, gx = W / 2 - gw / 2, gy = top + (availH - gh) / 2 + 12 * U;
  let alpha = 1;
  if (!q.done) { if (q.scaffold === 'none') alpha = 0; else if (q.scaffold === 'flash') { const k = G.t - q.shownAt; alpha = k < 1.5 ? 1 : Math.max(0, 1 - (k - 1.5) / .6); } }
  else alpha = Math.max(alpha, q.reveal);
  const dimmed = !q.done && q.scaffold !== 'full';
  // the frame stays even when the dots are hidden, so the shape of the problem is always there
  ctx.strokeStyle = q.done ? C.ink : C.grid5; ctx.lineWidth = 2; ctx.setLineDash(q.done || q.scaffold === 'full' ? [] : [6, 6]); ctx.strokeRect(gx, gy, gw, gh); ctx.setLineDash([]);
  if (alpha > 0) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.grid5; ctx.lineWidth = 2; ctx.beginPath();
    for (let c = 5; c < q.cols; c += 5) { ctx.moveTo(gx + c * s, gy); ctx.lineTo(gx + c * s, gy + gh); }
    for (let r = 5; r < q.rows; r += 5) { ctx.moveTo(gx, gy + r * s); ctx.lineTo(gx + gw, gy + r * s); } ctx.stroke();
    const fillRows = q.done ? Math.ceil(q.reveal * q.rows) : q.rows;
    for (let r = 0; r < q.rows; r++) for (let c = 0; c < q.cols; c++) {
      ctx.fillStyle = r < fillRows ? (r % 2 ? C.dot2 : C.dot) : C.ghost; if (dimmed && !q.done) ctx.fillStyle = r % 2 ? 'rgba(47,111,222,.8)' : 'rgba(255,138,61,.8)';
      ctx.beginPath(); ctx.arc(gx + c * s + s / 2, gy + r * s + s / 2, s * .34, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // side labels: columns across the top always; the skip-count appears row by row after answering
  ctx.font = F(700, Math.max(15, Math.min(24 * U, s * .62))); ctx.fillStyle = C.ink; ctx.textBaseline = 'middle';
  ctx.textAlign = 'center'; ctx.fillText(`${q.cols} in each row`, W / 2, gy - 14 * U);
  if (q.done) { ctx.textAlign = 'left'; const rows = Math.ceil(q.reveal * q.rows);
    for (let r = 0; r < rows; r++) { const last = r === q.rows - 1; ctx.fillStyle = last ? (q.ok ? C.green : C.red) : '#5b6884'; ctx.fillText(String((r + 1) * q.cols), gx + gw + 12 * U, gy + r * s + s / 2); }
    ctx.textAlign = 'right'; ctx.fillStyle = '#5b6884'; ctx.fillText(`${q.rows} rows`, gx - 12 * U, gy + gh / 2); }
  else if (q.scaffold === 'none') { ctx.textAlign = 'center'; ctx.fillStyle = '#7c8598'; ctx.fillText('You know this one. No dots!', W / 2, gy + gh / 2); }
  for (const f of fx) { const k = f.t / f.life; ctx.globalAlpha = 1 - k; ctx.font = F(700, 34 * U); ctx.textAlign = 'center'; ctx.fillStyle = C.green; ctx.fillText(f.text, W / 2, ty + fs * 1.15 - k * 20); ctx.globalAlpha = 1; }
  if (banner) { const k = banner.t / banner.life; ctx.globalAlpha = k > .85 ? (1 - k) / .15 : 1; const bf = Math.round(Math.max(22, 30 * U)); ctx.font = F(700, bf); ctx.textAlign = 'center';
    const w = Math.min(W - 24, ctx.measureText(banner.text).width + bf * 1.4), h = bf * 1.8, y = bottom - h + 6 * U;
    ctx.fillStyle = '#fff6a8'; ctx.save(); ctx.translate(W / 2, y + h / 2); ctx.rotate(-.012); ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = C.ink; ctx.fillText(banner.text, 0, 2); ctx.restore(); ctx.globalAlpha = 1; }
}
function loop(t) { const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t; update(dt); if (mode === 'play') { for (const f of fx) f.t += dt; fx = fx.filter(f => f.t < f.life); if (banner) { banner.t += dt; if (banner.t > banner.life) banner = null; } } draw(t); hud(); requestAnimationFrame(loop); }
function hud() {
  const left = G && mode !== 'title' ? Math.max(0, ROUND - G.t) : ROUND; $('#hudClock').textContent = Math.ceil(left); $('#hudClock').classList.toggle('low', left <= 10);
  $('#hudScore').textContent = G ? G.score : 0; $('#hudSub').textContent = 'Best ' + K.best(); $('#hudMid').textContent = G && G.combo >= 3 ? 'Streak ×' + G.combo : '';
  const n = K.sched.todayCount(), g = K.S.settings.goal; $('#hudGoal').textContent = (K.PLAYERS.length > 1 ? K.cap(K.player) + ' · ' : '') + (n >= g ? `Today ${n} ✓` : `Today ${n}/${g}`);
}
$('#btnPause').onclick = () => { if (mode === 'play') { mode = 'pause'; K.pauseCard(() => { mode = 'play'; K.hide(); lastT = performance.now(); }, () => { mode = 'play'; G.t = ROUND; if (G.q) G.q.done = true; G.gap = 0; }); } };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') $('#btnPause').click(); });
K.sound($('#btnSound'));
K.title({ heading: 'Array Grid', blurb: 'Times tables as rows of dots. <b>Type the answer.</b> New facts show every dot; facts you know well show fewer, then none.', extra: '<p class="small">Multiplication and division up to 10 × 10 · 60 seconds</p>', onPlay: start });
window.__game = () => ({ G });
requestAnimationFrame(loop);
})();
