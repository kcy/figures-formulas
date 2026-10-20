/* Pace Race — type each answer to move your car one step down the track. A pace car drives at your own
 * recent speed; beat it and it gets a little faster next time, lose and it eases off. 20 answers to the flag. */
(function () {
'use strict';
const VERSION = '1.0.1', LAPS = 20, PACE_START = 4.5, PACE_MIN = 1.4, PACE_MAX = 9;
const K = FF.kit({ game: 'race', title: 'Pace Race', version: VERSION });
const { fmt } = K;
const $ = s => document.querySelector(s);
const cv = $('#stage'), ctx = cv.getContext('2d'), pad = $('#keypad');
let W = 800, H = 600, U = 1;
function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; U = Math.max(.75, Math.min(1.4, Math.min(W, H) / 640)); cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', resize); resize();

const pace = () => K.S.meta.racePace || PACE_START;
let G = null, mode = 'title', lastT = 0, fx = [], banner = null;

function newRound() { G = { t: 0, typed: '', q: null, right: 0, wrong: 0, combo: 0, best: 0, me: 0, meShow: 0, spin: 0, practiced: new Set(), pace: pace(), goalShown: false, done: false, flash: 0 }; fx = []; banner = null; K.sched.newSession(); }
function nextQuestion() {
  const id = K.next(); if (!id) { G.q = null; banner = { text: 'No facts are turned on. Check Settings.', t: 0, life: 99 }; return; }
  G.q = { id, it: FF.facts.ITEMS[id], shownAt: G.t }; G.typed = '';
}
function submit(auto) {
  const q = G.q; if (!q || mode !== 'play' || G.spin > 0 || G.done) return;
  if (G.typed === '' || G.typed === '-') return;
  const n = +G.typed, it = q.it, ok = n === it.answer, rt = G.t - q.shownAt; G.practiced.add(q.id);
  K.report(q.id, ok, rt, { kind: 'produce', error: ok ? null : FF.distract.classify(it, n) });
  if (ok) {
    G.right++; G.me++; G.combo++; G.best = Math.max(G.best, G.combo); K.sfx.good(); G.flash = .25;
    if (G.combo >= 3) fx.push({ k: 'text', x: 0, y: 0, rel: true, text: 'Streak ×' + G.combo, t: 0, life: .9 });
    if (G.me >= LAPS) return finish();
    nextQuestion();
  } else {
    G.wrong++; G.combo = 0; G.spin = 1.1; K.sfx.bad(); K.noise(.5, 2400, 300, .12, 'bandpass');
    banner = { text: `${it.prompt} = ${fmt(it.answer)}`, t: 0, life: 2.4 };
    G.typed = '';
    G.after = () => nextQuestion();
  }
  if (K.goalReached() && !G.goalShown) { G.goalShown = true; K.sfx.goal(); }
}
function onKey(k) {
  if (mode !== 'play' || !G.q || G.spin > 0 || G.done) return;
  if (k === 'go') return submit(false);
  if (k === 'bs') G.typed = G.typed.slice(0, -1);
  else if (k === '-') G.typed = G.typed.startsWith('-') ? G.typed.slice(1) : '-' + G.typed;
  else if (G.typed.replace('-', '').length < 4) G.typed += k;
  K.sfx.tick();
  if (G.typed !== '' && G.typed !== '-' && +G.typed === G.q.it.answer) submit(true); // the right answer goes through without Go
}
K.keypad(pad, onKey);

function finish() {
  G.done = true; const paceTime = G.pace * LAPS, myTime = G.t, won = myTime <= paceTime;
  const next = Math.max(PACE_MIN, Math.min(PACE_MAX, G.pace * (won ? .93 : 1.03)));
  K.S.meta.racePace = Math.round(next * 100) / 100;
  if (!K.S.meta.bestRaceTime || myTime < K.S.meta.bestRaceTime) K.S.meta.bestRaceTime = Math.round(myTime * 10) / 10;
  K.finish({ wave: 0, score: G.right, answers: G.right + G.wrong, correct: G.right, facts: G.practiced.size, bestStreak: G.best, seconds: Math.round(myTime) });
  won ? K.sfx.win() : K.sfx.lose();
  setTimeout(() => { mode = 'over';
    const diff = Math.abs(paceTime - myTime).toFixed(1);
    K.result({ heading: won ? 'You beat the pace car!' : 'The pace car got there first', stats: [[myTime.toFixed(1) + ' s', 'your time'], [paceTime.toFixed(1) + ' s', 'pace car'], [G.wrong, 'spin-outs']],
      lines: [won ? `Won by ${diff} s. Next race the pace car is a bit quicker.` : `${diff} s behind. Next race the pace car eases off a little.`, `Best time ${K.S.meta.bestRaceTime} s · pace ${K.S.meta.racePace.toFixed(1)} s per answer`], onAgain: start });
  }, 900);
}
function start() { newRound(); mode = 'play'; K.hide(); nextQuestion(); }

function update(dt) {
  if (mode !== 'play') return;
  if (!G.done) G.t += dt;
  G.meShow += (G.me - G.meShow) * Math.min(1, dt * 6);
  if (G.flash > 0) G.flash -= dt;
  if (G.spin > 0) { G.spin -= dt; if (G.spin <= 0) { G.spin = 0; if (G.after) { const f = G.after; G.after = null; f(); } } }
  if (!G.done && G.t > G.pace * LAPS + 40) finish(); // don't let a stuck race run forever
}

/* ---- draw ---- */
const C = { sky: '#ffe8c7', sky2: '#ffd59e', sun: '#ff9f1c', hill1: '#f4a259', hill2: '#e07a5f', grass: '#8ac926', road: '#2d2d4a', line: '#fffaf0', ink: '#1d1d3a', me: '#ff6b35', pace: '#6c5ce7' };
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function car(x, y, s, color, label, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 16, 40, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.ink; rr(-42, -12, 84, 26, 9); ctx.fill();
  ctx.fillStyle = color; rr(-40, -10, 80, 22, 8); ctx.fill();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(-8, -26); ctx.lineTo(16, -26); ctx.lineTo(26, -10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-14, -11); ctx.lineTo(-6, -23); ctx.lineTo(14, -23); ctx.lineTo(22, -11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#bde0fe'; ctx.beginPath(); ctx.moveTo(2, -12); ctx.lineTo(2, -21); ctx.lineTo(13, -21); ctx.lineTo(19, -12); ctx.closePath(); ctx.fill();
  [-24, 24].forEach(wx => { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(wx, 13, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(wx, 13, 4, 0, Math.PI * 2); ctx.fill(); });
  if (label) { ctx.fillStyle = '#fffaf0'; ctx.font = '900 11px Rubik, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, -14, 1); }
  ctx.restore();
}
function draw(t) {
  const padTop = K.padTop();
  const fs = Math.round(Math.max(34, 54 * U)), ty = Math.max(96, H * .12), ch = fs * 1.5;
  // sky and flat hills
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.sky); g.addColorStop(1, C.sky2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const top = ty + ch + 24 * U, bottom = padTop - 18 * U;
  const laneH = Math.max(40 * U, Math.min(95 * U, (bottom - top) * .26)), ry = bottom - laneH * 2 - 46 * U, mid = ry - 10 * U;
  ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(W * .82, Math.min(mid - 110 * U, top + 60 * U), 34 * U, 0, Math.PI * 2); ctx.fill();
  const off = (G ? G.meShow * 30 : 0);
  ctx.fillStyle = C.hill1; ctx.beginPath(); ctx.moveTo(0, mid); for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, mid - 40 * U - Math.sin((x + off * .3) / 120) * 22 * U); ctx.lineTo(W, mid); ctx.fill();
  ctx.fillStyle = C.hill2; ctx.beginPath(); ctx.moveTo(0, mid + 10); for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, mid - 10 * U - Math.sin((x + off * .6) / 80 + 2) * 16 * U); ctx.lineTo(W, mid + 10); ctx.fill();
  ctx.fillStyle = C.grass; ctx.fillRect(0, mid, W, bottom - mid + 18 * U);
  // the track: two lanes, start on the left, chequered flag on the right
  const L = 70 * U, R = W - 70 * U;
  ctx.fillStyle = C.ink; ctx.fillRect(0, ry - 4, W, laneH * 2 + 8); ctx.fillStyle = C.road; ctx.fillRect(0, ry, W, laneH * 2);
  ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.setLineDash([22, 18]); ctx.lineDashOffset = -off; ctx.beginPath(); ctx.moveTo(0, ry + laneH); ctx.lineTo(W, ry + laneH); ctx.stroke(); ctx.setLineDash([]);
  for (let i = 0; i <= LAPS; i++) { const x = L + (R - L) * i / LAPS; ctx.fillStyle = i % 5 === 0 ? 'rgba(255,250,240,.5)' : 'rgba(255,250,240,.18)'; ctx.fillRect(x - 1, ry + laneH * 2 + 6, 2, i % 5 === 0 ? 10 : 6); }
  const sq = laneH / 4; for (let r = 0; r < 8; r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? C.ink : '#fffaf0'; ctx.fillRect(R + 30 * U + c * sq, ry + r * sq, sq, sq); }
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(L - 2, ry, 4, laneH * 2);
  const s = Math.min(1.5, laneH / 60);
  if (G) {
    const paceAt = Math.min(LAPS, G.t / G.pace), meX = L + (R - L) * G.meShow / LAPS, paceX = L + (R - L) * paceAt / LAPS;
    car(paceX, ry + laneH * .55, s * .9, C.pace, 'PACE', 0);
    const rot = G.spin > 0 ? (1.1 - G.spin) / 1.1 * Math.PI * 4 : 0;
    if (G.flash > 0) { ctx.strokeStyle = 'rgba(255,250,240,.8)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(meX - 50 * s - i * 14, ry + laneH * 1.4 + i * 8 - 8); ctx.lineTo(meX - 80 * s - i * 14, ry + laneH * 1.4 + i * 8 - 8); ctx.stroke(); } }
    car(meX, ry + laneH * 1.55, s, C.me, (K.cap(K.player) || '').slice(0, 5).toUpperCase(), rot);
    // lap counter and gap to the pace car
    ctx.font = `900 italic ${Math.round(22 * U)}px Rubik, system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = C.ink;
    ctx.fillText(`${G.me} / ${LAPS}`, L, ry - 10 * U);
    const lead = (G.me - G.t / G.pace); ctx.textAlign = 'right'; ctx.fillStyle = lead >= 0 ? '#2b9348' : '#c94a1b';
    ctx.fillText(lead >= 0 ? `Ahead by ${lead.toFixed(1)}` : `Behind by ${(-lead).toFixed(1)}`, R, ry - 10 * U);
  }
  // problem card with the answer being typed
  if (G && G.q && mode !== 'title') {
    const it = G.q.it, typed = G.typed, cursor = (Math.floor(t / 450) % 2) && G.spin <= 0 ? '|' : ' ';
    ctx.font = `900 ${fs}px Rubik, system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const left = it.prompt + ' = ', ans = typed === '' ? '?' : typed.replace('-', '−'), lw = ctx.measureText(left).width, aw = Math.max(ctx.measureText(ans).width, ctx.measureText('00').width);
    const w = lw + aw + fs * 1.4, x0 = W / 2 - w / 2;
    ctx.fillStyle = C.ink; rr(x0 + 6, ty + 6, w, ch, 16); ctx.fill(); ctx.fillStyle = '#fffaf0'; rr(x0, ty, w, ch, 16); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.fillText(left, x0 + fs * .6, ty + ch / 2 + 2);
    ctx.fillStyle = G.spin > 0 ? '#c94a1b' : typed === '' ? '#b8b8cc' : C.me; ctx.fillText(ans, x0 + fs * .6 + lw, ty + ch / 2 + 2);
    if (typed !== '') { ctx.fillStyle = C.ink; ctx.fillText(cursor, x0 + fs * .6 + lw + ctx.measureText(ans).width + 2, ty + ch / 2); }
  }
  for (const f of fx) { const k = f.t / f.life; ctx.globalAlpha = 1 - k; ctx.font = `900 italic ${Math.round(26 * U)}px Rubik, system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = C.me; ctx.fillText(f.text, W / 2, ty + ch + 20 * U - k * 14); ctx.globalAlpha = 1; }
  if (banner) { const k = banner.t / banner.life; ctx.globalAlpha = k > .85 ? (1 - k) / .15 : 1; const bf = Math.round(Math.max(22, 30 * U)); ctx.font = `900 ${bf}px Rubik, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(W - 24, ctx.measureText(banner.text).width + bf * 1.6), h = bf * 1.9, y = top - 6 * U; ctx.fillStyle = C.ink; rr(W / 2 - w / 2 + 4, y + 4, w, h, 12); ctx.fill(); ctx.fillStyle = '#ffd166'; rr(W / 2 - w / 2, y, w, h, 12); ctx.fill(); ctx.fillStyle = C.ink; ctx.fillText(banner.text, W / 2, y + h / 2 + 1); ctx.globalAlpha = 1; }
}
function loop(t) { const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t; update(dt); if (mode === 'play') { for (const f of fx) f.t += dt; fx = fx.filter(f => f.t < f.life); if (banner) { banner.t += dt; if (banner.t > banner.life) banner = null; } } draw(t); hud(); requestAnimationFrame(loop); }
function hud() {
  $('#hudClock').textContent = G && mode !== 'title' ? G.t.toFixed(1) : '0.0';
  $('#hudScore').textContent = G ? G.me : 0; $('#hudSub').textContent = K.S.meta.bestRaceTime ? `Best ${K.S.meta.bestRaceTime} s` : `of ${LAPS}`;
  $('#hudMid').textContent = `Pace ${(G ? G.pace : pace()).toFixed(1)} s`;
  const n = K.sched.todayCount(), g = K.S.settings.goal; $('#hudGoal').textContent = (K.PLAYERS.length > 1 ? K.cap(K.player) + ' · ' : '') + (n >= g ? `Today ${n} ✓` : `Today ${n}/${g}`);
}
$('#btnPause').onclick = () => { if (mode === 'play' && !G.done) { mode = 'pause'; K.pauseCard(() => { mode = 'play'; K.hide(); lastT = performance.now(); }, () => { mode = 'over'; K.hide(); K.title(titleOpts()); }); } };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') $('#btnPause').click(); });
K.sound($('#btnSound'));
const titleOpts = () => ({ heading: 'Pace Race', blurb: `Type each answer to move your car. <b>Reach the flag in ${LAPS} answers</b> before the pace car does.`, extra: `<p class="small">The pace car drives at ${pace().toFixed(1)} s per answer. Beat it and it speeds up a little; lose and it slows down.</p>`, onPlay: start });
K.title(titleOpts());
window.__game = () => ({ G });
requestAnimationFrame(loop);
})();
