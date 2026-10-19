/* Bubble Pop — the problem sits at the top; after a moment to think, five bubbles drift up from the deep,
 * each carrying an answer. Pop the right one before it reaches the surface. No lives, just a 90-second dive. */
(function () {
'use strict';
const VERSION = '1.0.0', ROUND = 90, N_BUBBLES = 5, FAST_MUL = 1.8;
const K = FF.kit({ game: 'bubbles', title: 'Bubble Pop', version: VERSION });
const { fmt } = K;
const $ = s => document.querySelector(s);
const cv = $('#stage'), ctx = cv.getContext('2d');
let W = 800, H = 600, U = 1;
function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; U = Math.max(.75, Math.min(1.4, Math.min(W, H) / 640)); cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', resize); resize();

const HUES = [168, 200, 262, 320, 40, 140];
let G = null, mode = 'title', lastT = 0, fx = [], banner = null;
const motes = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, s: .02 + Math.random() * .05, p: Math.random() * 6 }));

function newRound() { G = { t: 0, score: 0, combo: 0, best: 0, right: 0, wrong: 0, q: null, bubbles: [], gap: .4, practiced: new Set(), goalShown: false }; fx = []; banner = null; K.sched.newSession(); }
const cardBottom = () => { const fs = Math.round(Math.max(34, 54 * U)); return Math.max(96, H * .12) + fs * 1.5; };
const riseTime = () => 8.5; // seconds from the bottom to the surface: slow on purpose

function nextQuestion() {
  const id = K.next(); if (!id) { G.q = null; banner = { text: 'No facts are turned on. Check Settings.', t: 0, life: 99 }; return; }
  const it = FF.facts.ITEMS[id];
  G.q = { id, it, shownAt: G.t, think: K.think(), released: false, relAt: 0, done: false };
}
function release() {
  const q = G.q, opts = K.options(q.it, N_BUBBLES), slot0 = (W - 40 * U) / N_BUBBLES, r = Math.max(30 * U, Math.min(62 * U, slot0 * .36));
  const slot = (W - 2 * r - 40 * U) / (N_BUBBLES - 1);
  const order = opts.map((_, i) => i).sort(() => Math.random() - .5);
  G.bubbles = opts.map((o, i) => ({ ...o, r, hue: HUES[i % HUES.length], x0: 20 * U + r + order[i] * slot + (Math.random() - .5) * slot * .1,
    y: H + r + Math.random() * 90 * U, ph: Math.random() * 6, wob: Math.min(12, 4 + (slot - 2 * r) / U * .2), popped: false, fade: 0 }));
  q.released = true; q.relAt = G.t;
}
const bx = b => b.x0 + Math.sin(G.t * 1.3 + b.ph) * b.wob * U;

function answer(b) {
  const q = G.q; if (!q || q.done || !q.released || mode !== 'play') return;
  q.done = true; const it = q.it, rt = G.t - q.relAt, ok = !!(b && b.isAnswer); G.practiced.add(q.id);
  const fast = rt < FF.facts.FAM[it.fam].fast * FAST_MUL;
  K.report(q.id, ok, rt, { kind: 'verify', fastMul: FAST_MUL, error: ok ? null : (b ? b.tag || 'other' : 'too_slow') });
  if (ok) {
    G.right++; G.combo++; G.best = Math.max(G.best, G.combo); K.adjustThink(fast ? -.1 : -.03);
    const pts = 10 + (fast ? 5 : 0) + Math.min(G.combo - 1, 10) * 2; G.score += pts;
    pop(b, true); K.sfx.pop(); setTimeout(() => K.sfx.good(), 60);
    fx.push({ k: 'text', x: bx(b), y: b.y - b.r, text: '+' + pts + (fast ? ' fast!' : ''), t: 0, life: 1 });
    G.bubbles.forEach(o => { if (o !== b) o.fade = .001; }); G.gap = .7;
  } else {
    G.wrong++; G.combo = 0; K.adjustThink(.25); K.sfx.bad();
    if (b) { b.popped = true; b.dud = true; fx.push({ k: 'ring', x: bx(b), y: b.y, r: b.r, t: 0, life: .5, dud: true }); }
    const right = G.bubbles.find(o => o.isAnswer); if (right) { right.glow = true; right.hold = true; }
    G.bubbles.forEach(o => { if (!o.isAnswer && o !== b) o.fade = .001; });
    banner = { text: `${it.prompt} = ${fmt(it.answer)}`, t: 0, life: 2.6 }; G.gap = 2.2;
  }
  if (K.goalReached() && !G.goalShown) { G.goalShown = true; K.sfx.goal(); }
}
function pop(b, good) {
  b.popped = true; const x = bx(b);
  fx.push({ k: 'ring', x, y: b.y, r: b.r, t: 0, life: .45 });
  for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 160) * U; fx.push({ k: 'drop', x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, hue: b.hue, t: 0, life: .6 }); }
}

cv.addEventListener('pointerdown', ev => {
  if (mode !== 'play' || !G.q || G.q.done || !G.q.released) return; K.audio();
  let hit = null, bestD = Infinity;
  for (const b of G.bubbles) { if (b.popped) continue; const d = Math.hypot(ev.clientX - bx(b), ev.clientY - b.y); if (d < b.r * 1.15 && d < bestD) { hit = b; bestD = d; } }
  if (hit) answer(hit);
});

function update(dt) {
  if (mode !== 'play') return;
  G.t += dt; if (ROUND - G.t <= 0) return end();
  const q = G.q;
  if (q && !q.released && G.t - q.shownAt >= q.think) release();
  const sp = (H + 80 * U - cardBottom()) / riseTime(), top = cardBottom() + 10 * U;
  for (const b of G.bubbles) {
    if (b.popped) continue;
    if (b.fade) { b.fade += dt * 2.2; b.y -= sp * dt * .6; continue; }
    if (b.hold) { b.y += ((Math.max(top + b.r + 40 * U, Math.min(b.y, H * .55))) - b.y) * Math.min(1, dt * 4); continue; }
    b.y -= sp * dt;
    if (b.y - b.r < top && q && !q.done && b.isAnswer) answer(null); // the right bubble got away
    if (b.y + b.r < top - 10) b.popped = true;
  }
  G.bubbles = G.bubbles.filter(b => !b.popped && (!b.fade || b.fade < 1) || b.hold);
  if (!q || q.done) { G.gap -= dt; if (G.gap <= 0) { G.bubbles = []; nextQuestion(); } }
}
function end() {
  mode = 'over'; K.setBest(G.score); K.finish({ wave: 0, score: G.score, answers: G.right + G.wrong, correct: G.right, facts: G.practiced.size, bestStreak: G.best, seconds: Math.round(G.t) }); K.sfx.win();
  K.result({ heading: G.wrong === 0 && G.right > 0 ? 'Perfect dive!' : 'Back to the surface!', stats: [[G.score, 'score'], [G.right, 'popped'], [G.best, 'best chain']],
    lines: [`${G.wrong} missed · best ${K.best()} · think time ${K.think().toFixed(1)} s`], onAgain: start });
}
function start() { newRound(); mode = 'play'; K.hide(); }

/* ---- draw ---- */
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawBubble(b, t) {
  const x = bx(b), y = b.y, r = b.r * (b.glow ? 1 + Math.sin(t / 150) * .05 : 1), a = b.fade ? Math.max(0, 1 - b.fade) : 1;
  ctx.save(); ctx.globalAlpha = a;
  if (b.glow) { ctx.shadowColor = '#7ee8d6'; ctx.shadowBlur = 30; }
  const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  g.addColorStop(0, `hsla(${b.hue},90%,92%,.55)`); g.addColorStop(.7, `hsla(${b.hue},80%,70%,.22)`); g.addColorStop(1, `hsla(${b.hue},90%,80%,.55)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = b.glow ? '#7ee8d6' : `hsla(${b.hue},90%,85%,.9)`; ctx.lineWidth = b.glow ? 4 : 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - r * .42, y - r * .45, r * .2, r * .11, -.7, 0, Math.PI * 2); ctx.fill();
  ctx.font = `900 ${Math.round(r * .78)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,27,75,.55)'; ctx.strokeText(fmt(b.value), x, y + 2); ctx.fillStyle = '#ffffff'; ctx.fillText(fmt(b.value), x, y + 2);
  ctx.restore();
}
function draw(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3b2a6b'); g.addColorStop(.45, '#24407a'); g.addColorStop(1, '#0f5c63'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // light shafts from the surface
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) { const x = W * (.1 + i * .2) + Math.sin(t / 3000 + i) * 40; const lg = ctx.createLinearGradient(0, 0, 0, H * .8); lg.addColorStop(0, 'rgba(160,220,255,.10)'); lg.addColorStop(1, 'rgba(160,220,255,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 120, H * .8); ctx.lineTo(x - 60, H * .8); ctx.fill(); }
  ctx.restore();
  // tiny drifting motes
  ctx.fillStyle = 'rgba(220,240,255,.25)'; for (const m of motes) { const y = ((m.y - t / 1000 * m.s) % 1 + 1) % 1; ctx.beginPath(); ctx.arc(m.x * W + Math.sin(t / 900 + m.p) * 6, y * H, m.r, 0, Math.PI * 2); ctx.fill(); }
  // seaweed and sand
  ctx.fillStyle = '#0b4a4f'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H - 22 - Math.sin(x / 90) * 8); ctx.lineTo(W, H); ctx.fill();
  for (let i = 0; i < 9; i++) { const x = (i * 173 + 50) % W, h = (90 + (i * 53) % 110) * U; ctx.strokeStyle = i % 2 ? '#1f8a70' : '#2fae8a'; ctx.lineWidth = 7 * U; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, H - 10);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(t / 800 + i + k * .7) * 10 * U * k / 6, H - 10 - h * k / 6); ctx.stroke(); }
  if (G && G.q) {
    const q = G.q, fs = Math.round(Math.max(34, 54 * U)), ty = Math.max(96, H * .12);
    for (const b of G.bubbles) drawBubble(b, t);
    // the problem card, pinned
    ctx.font = `900 ${fs}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const txt = q.it.prompt + ' = ?', w = Math.max(ctx.measureText(txt).width + fs * 1.2, 260 * U), h = fs * 1.5;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; ctx.fillStyle = '#f4f0ff'; rr(W / 2 - w / 2, ty, w, h, h / 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = q.done ? '#8a83b8' : '#1e1b4b'; ctx.fillText(txt, W / 2, ty + h / 2 + 2);
    // think-time meter: a row of little bubbles that fill before the real ones rise
    if (!q.released && q.think > 0) {
      const k = Math.min(1, (G.t - q.shownAt) / q.think), n = 5, sx = W / 2 - (n - 1) * 14 * U;
      for (let i = 0; i < n; i++) { const on = k * n > i; ctx.beginPath(); ctx.arc(sx + i * 28 * U, ty + h + 26 * U, 7 * U, 0, Math.PI * 2); ctx.fillStyle = on ? '#7ee8d6' : 'rgba(244,240,255,.2)'; ctx.fill(); }
    } else if (!q.done) { ctx.font = `800 ${Math.round(fs * .34)}px Nunito, system-ui`; ctx.fillStyle = '#d4ccf5'; ctx.fillText('Pop the right bubble', W / 2, ty + h + 26 * U); }
  }
  for (const f of fx) { const k = f.t / f.life;
    if (f.k === 'ring') { ctx.strokeStyle = f.dud ? `rgba(255,140,140,${1 - k})` : `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + k * .6), 0, Math.PI * 2); ctx.stroke(); }
    else if (f.k === 'drop') { ctx.fillStyle = `hsla(${f.hue},90%,85%,${1 - k})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t, 4 * U * (1 - k * .5), 0, Math.PI * 2); ctx.fill(); }
    else if (f.k === 'text') { ctx.globalAlpha = 1 - k; ctx.font = `900 ${Math.round(32 * U)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe066'; ctx.fillText(f.text, f.x, f.y - k * 40); ctx.globalAlpha = 1; } }
  if (banner) { const k = banner.t / banner.life; ctx.globalAlpha = k > .85 ? (1 - k) / .15 : 1; const fs = Math.round(Math.max(22, 30 * U)); ctx.font = `900 ${fs}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(W - 24, ctx.measureText(banner.text).width + fs * 1.6), h = fs * 1.9, y = H - h - 40 * U; ctx.fillStyle = '#f4f0ff'; rr(W / 2 - w / 2, y, w, h, h / 2); ctx.fill(); ctx.fillStyle = '#1e1b4b'; ctx.fillText(banner.text, W / 2, y + h / 2 + 1); ctx.globalAlpha = 1; }
}
function loop(t) { const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t; update(dt); if (mode === 'play') { for (const f of fx) f.t += dt; fx = fx.filter(f => f.t < f.life); if (banner) { banner.t += dt; if (banner.t > banner.life) banner = null; } } draw(t); hud(); requestAnimationFrame(loop); }
function hud() {
  const left = G && mode !== 'title' ? Math.max(0, ROUND - G.t) : ROUND; $('#hudClock').textContent = Math.ceil(left); $('#hudClock').classList.toggle('low', left <= 10);
  $('#hudScore').textContent = G ? G.score : 0; $('#hudSub').textContent = 'Best ' + K.best(); $('#hudMid').textContent = G && G.combo >= 3 ? 'Chain ×' + G.combo : '';
  const n = K.sched.todayCount(), g = K.S.settings.goal; $('#hudGoal').textContent = (K.PLAYERS.length > 1 ? K.cap(K.player) + ' · ' : '') + (n >= g ? `Today ${n} ✓` : `Today ${n}/${g}`);
}
$('#btnPause').onclick = () => { if (mode === 'play') { mode = 'pause'; K.pauseCard(() => { mode = 'play'; K.hide(); lastT = performance.now(); }, () => { mode = 'play'; G.t = ROUND; }); } };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') $('#btnPause').click(); });
K.sound($('#btnSound'));
K.title({ heading: 'Bubble Pop', blurb: 'Read the problem. After a moment, bubbles rise with answers. <b>Pop the right one</b> before it reaches the top.', extra: `<p class="small">90 seconds · chains score extra · think time ${K.think().toFixed(1)} s</p>`, onPlay: start });
window.__game = () => ({ G, bx });
requestAnimationFrame(loop);
})();
