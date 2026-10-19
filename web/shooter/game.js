/* Figures & Formulas — the MasterType-style game. One of possibly several front ends to FF.Scheduler. */
(function () {
'use strict';
const VERSION = '2.3.1';
const $ = s => document.querySelector(s);
const W = 560, H = 420, CX = 280, CY = 210;
const { FAM, ITEMS, ORDER, fmt, hash } = FF.facts;
const { LocalStore } = FF.store;
const { median, today } = FF.util;

/* ================= STATE, SCHEDULER, SYNC ================= */
const CFG = window.FF_CONFIG || {};
const { PLAYERS, cap } = FF.player;
let player = FF.player.current();
let S = LocalStore.load(player, FF.player.FIRST);
function save() { LocalStore.save(S, player, FF.player.FIRST); }
let sched = new FF.Scheduler(FF.facts, S, { onChange: save });
function setSync(cls, text, title) { const el = $('#hudSync'); if (!el) return; el.className = 'sync ' + (cls === 'local' ? '' : cls); el.textContent = text; el.title = title || ''; }
function makeSync() { return new FF.Sync({ player, getState: () => S, getSched: () => sched, onStatus: setSync, onLoaded: updateHud }); }
let sync = makeSync();
function switchPlayer(p) {
  if (!PLAYERS.includes(p) || p === player) return;
  sync.flushNow();
  player = p; FF.player.set(p);
  S = LocalStore.load(player, FF.player.FIRST); sched = new FF.Scheduler(FF.facts, S, { onChange: save });
  sync = makeSync(); sync.load();
  applyNumpad(); showTitle();
}

/* ================= AUDIO ================= */
let AC = null;
function audio() { if (!S.settings.sound) return null; try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } }
function tone(f0, f1, dur, type = 'square', vol = .08, delay = 0) { const ac = audio(); if (!ac) return; const t0 = ac.currentTime + delay; const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(.0001, ac.currentTime); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + .02); }
let NOISE = null;
function noise(dur, f0, f1, vol, delay = 0) { const ac = audio(); if (!ac) return; const t0 = ac.currentTime + delay;
  if (!NOISE) { NOISE = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(); s.buffer = NOISE; const f = ac.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(.0001, ac.currentTime); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t0); s.stop(t0 + dur + .02); }
function beam() { const ac = audio(); if (!ac) return; const t = ac.currentTime, d = .32;
  const g = ac.createGain(); g.gain.setValueAtTime(.07, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 38; lg.gain.value = .04; lfo.connect(lg).connect(g.gain);
  [[1900, 950, 'sine'], [950, 470, 'sawtooth']].forEach(([a, b, ty]) => { const o = ac.createOscillator(); o.type = ty; o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + d); o.connect(g); o.start(t); o.stop(t + d); });
  g.connect(ac.destination); lfo.start(t); lfo.stop(t + d); }
const SFX = {
  fire: beam,
  kill: () => { noise(.5, 3200, 120, .22); tone(180, 40, .4, 'sine', .08); },
  wrong: () => { tone(170, 120, .22, 'square', .06); tone(160, 110, .22, 'square', .05, .03); },
  shield: () => { noise(.35, 1800, 200, .18); tone(260, 110, .35, 'sine', .12); tone(520, 220, .25, 'triangle', .05); },
  hull: () => { noise(.8, 900, 50, .32); tone(90, 35, .7, 'sawtooth', .1); },
  regen: () => { tone(300, 1400, .5, 'triangle', .04); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f * 1.01, .22, 'sine', .06, .05 + i * .06)); },
  key: () => tone(1200, 1200, .03, 'sine', .03),
  clear: () => { [523, 659, 784].forEach((f, i) => tone(f, f, .12, 'triangle', .07, i * .11)); tone(1047, 1047, .35, 'triangle', .08, .33); },
  boss: () => { for (let i = 0; i < 3; i++) { tone(660, 660, .22, 'triangle', .08, i * .5); tone(880, 880, .22, 'triangle', .08, i * .5 + .25); } },
  goal: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, f, .16, 'triangle', .08, i * .14)); tone(1047, 1047, .6, 'triangle', .09, .6); tone(523, 523, .6, 'sine', .05, .6); }
};

/* ================= GAME ================= */
const cv = $('#screen'), ctx = cv.getContext('2d');
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let COL = {};
function loadColors() { COL = { phos: css('--phos'), dim: css('--phos-dim'), faint: css('--phos-faint'), white: css('--white'),
  orange: css('--orange'), blue: css('--blue'), violet: css('--violet'), danger: css('--danger'), warn: css('--warn'), screen: css('--screen') }; }
function famColor(f) { return { add: COL.phos, sub: COL.orange, neg: COL.blue, mul: COL.violet, div: COL.warn, negmul: COL.danger }[f] || COL.phos; }
const CORNERS = [{ x: 60, y: 70 }, { x: W - 60, y: 70 }, { x: 60, y: H - 70 }, { x: W - 60, y: H - 70 }];
const CORNER_ANG = [-3 * Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, Math.PI / 4];

let G = null, mode = 'title', buf = '', lastT = 0, effects = [], shake = 0, banner = null;

function newRun() {
  G = { wave: 0, score: 0, credits: 0, shields: [true, true, true, true], shieldFx: [0, 0, 0, 0], hull: 3, maxHull: 3, streak: 0, bestStreak: 0,
    bombs: 0, thrust: 1, kills: 0, needed: 0, waveKills: 0, enemies: [], goalShown: sched.todayCount() >= S.settings.goal, goalToast: false,
    spawnT: 0, boss: null, answers: 0, correct: 0, practiced: new Set(), startedAt: Date.now(), lastFire: 0 };
  sched.newSession(); buf = ''; effects = []; banner = null;
}
/* Think time: an enemy sits still at its corner, problem showing, before it starts moving. Adapts per player. */
const DELAY_START = 3, DELAY_MIN = 0, DELAY_MAX = 4;
const thinkDelay = () => (S.meta.thinkTimeShooter == null ? DELAY_START : S.meta.thinkTimeShooter);
function adjustDelay(d) { S.meta.thinkTimeShooter = Math.round(Math.max(DELAY_MIN, Math.min(DELAY_MAX, thinkDelay() + d)) * 100) / 100; }
function pickNext(onScreen) { return sched.next(onScreen.map(e => e.id), onScreen.map(e => e.item.answer)); }
function startWave() {
  G.wave++; G.waveKills = 0; G.enemies = []; G.boss = null; G.spawnT = 0; buf = '';
  if (G.wave % 4 === 0) {
    const id = pickNext([]); if (!id) { overlayMsg('No facts enabled', 'Turn on at least one family in Settings.'); mode = 'title'; return; }
    G.boss = { id, item: ITEMS[id], hp: 4 + Math.floor(G.wave / 4), maxHp: 4 + Math.floor(G.wave / 4), askedAt: performance.now() / 1000 + thinkDelay(), lastDmg: performance.now() / 1000 + thinkDelay(), dmgFlash: 0, graded: false, misses: 0 };
    G.needed = 1; SFX.boss(); showBanner('DREADNOUGHT · ONLY FAST ANSWERS HURT IT', COL.violet, 2.6);
  } else G.needed = Math.min(16, 6 + 2 * G.wave);
  mode = 'play'; overlayHide(); updateHud(); grabKeys();
}
function maxActive() { return G.wave < 3 ? 1 : G.wave < 5 ? 2 : G.wave < 8 ? 3 : 4; }
function enemySpeed() { const acc = sched.accuracy(); const am = acc < .8 ? .55 : acc < .9 ? .75 : 1; return 18 * (1 + .06 * (G.wave - 1)) * am * G.thrust; }
function spawn() {
  const id = pickNext(G.enemies); if (!id) return;
  const used = new Set(G.enemies.map(e => e.corner)); const free = [0, 1, 2, 3].filter(c => !used.has(c));
  const corner = free[Math.floor(Math.random() * free.length)]; const p = CORNERS[corner];
  const now = performance.now() / 1000, wait = thinkDelay();
  G.enemies.push({ id, item: ITEMS[id], corner, x: p.x, y: p.y, spawnAt: now + wait, think: wait, thinkTotal: wait, graded: false, hold: 0, dead: false, misses: 0, adjusted: false });
}
function target() { let b = null, bd = 1e9; for (const e of G.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - CX, e.y - CY); if (d < bd) { bd = d; b = e; } } return b; }
function floatText(x, y, text, color, life) { effects.push({ k: 'text', x, y, text, color, life, t: 0 }); }
function showBanner(text, color, life, big) { banner = { text, color, life, t: 0, big: !!big }; }
function bolt(x, y, color) { const pts = []; const n = 7; for (let i = 0; i <= n; i++) { const t = i / n; pts.push({ x: CX + (x - CX) * t + (i && i < n ? (Math.random() - .5) * 18 : 0), y: CY + (y - CY) * t + (i && i < n ? (Math.random() - .5) * 18 : 0) }); }
  effects.push({ k: 'bolt', pts, color, life: .18, t: 0 }); }
function boom(x, y, color) { const ps = []; for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 120; ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); }
  effects.push({ k: 'boom', ps, color, life: .55, t: 0 }); }

function hitCorner(c) {
  G.streak = 0; shake = .35;
  if (G.shields[c]) { G.shields[c] = false; G.shieldFx[c] = -.6; SFX.shield(); floatText(CORNERS[c].x < CX ? CX - 90 : CX + 90, CORNERS[c].y < CY ? CY - 60 : CY + 70, 'SHIELD DOWN', COL.blue, 1); }
  else { G.hull--; shake = .6; SFX.hull(); floatText(CX, CY - 58, 'HULL HIT', COL.danger, 1.1); }
  updateHud(); if (G.hull <= 0) endRun();
}
function addStreak() {
  G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak);
  if (G.streak % 5 === 0) {
    const i = G.shields.indexOf(false);
    if (i >= 0) { G.shields[i] = true; G.shieldFx[i] = .8; SFX.regen(); floatText(CX, CY - 56, 'SHIELD RESTORED', COL.blue, 1.3); }
    else { G.score += 20; G.credits += 20; SFX.regen(); floatText(CX, CY - 56, 'STREAK ' + G.streak + ' · +20', COL.white, 1.1); }
  }
  if (!G.goalToast && !G.goalShown && sched.todayCount() >= S.settings.goal) { G.goalToast = true; SFX.goal(); showBanner("TODAY'S GOAL REACHED · FINISH THE WAVE", COL.warn, 2.8); }
}
function fire() {
  if (mode !== 'play') return;
  if (buf === '' || buf === '-') { SFX.wrong(); return; }
  const val = parseInt(buf, 10); buf = ''; const now = performance.now() / 1000;
  if (G.boss) { bossAnswer(val, now); updateHud(); return; }
  const hit = G.enemies.find(e => !e.dead && e.item.answer === val);
  if (hit) {
    const rt = Math.max(0, now - Math.max(hit.spawnAt, G.lastFire || 0)), first = !hit.graded;
    if (first) { sched.report(hit.id, true, rt); G.correct++; G.answers++; G.practiced.add(hit.id); }
    hit.dead = true; bolt(hit.x, hit.y, famColor(hit.item.fam)); boom(hit.x, hit.y, famColor(hit.item.fam)); SFX.fire(); setTimeout(SFX.kill, 120);
    const fast = first && rt < FAM[hit.item.fam].fast; const pts = first ? 10 + (fast ? 5 : 0) : 5; G.score += pts; G.credits += pts;
    if (fast) floatText(hit.x, hit.y - 26, 'FAST +' + pts, COL.white, .8);
    if (first && !hit.adjusted) { hit.adjusted = true; adjustDelay(fast ? -.1 : -.03); }
    G.kills++; G.waveKills++; S.meta.kills++;
    G.enemies = G.enemies.filter(e => e !== hit); G.lastFire = now;
    if (first) addStreak();
    if (G.hull > 0 && G.waveKills >= G.needed && G.enemies.length === 0) waveCleared();
  } else {
    const t = target(); G.streak = 0;
    if (t) {
      if (!t.graded) { sched.report(t.id, false, Math.max(0, now - Math.max(t.spawnAt, G.lastFire || 0))); G.answers++; G.practiced.add(t.id); }
      t.graded = true; t.misses++;
      if (t.misses === 1) { t.hold = 1.2; showBanner('NOT ' + fmt(val) + ' · TRY AGAIN', COL.warn, 1.3); SFX.wrong(); }
      else { t.hold = 2.2; t.reveal = true; if (!t.adjusted) { t.adjusted = true; adjustDelay(.25); } showBanner(t.item.prompt + ' = ' + fmt(t.item.answer), COL.warn, 2.4, true); SFX.wrong(); hitCorner(t.corner); }
    } else SFX.wrong();
    G.lastFire = now;
  }
  updateHud();
}
function bossAnswer(val, now) {
  const b = G.boss, rt = Math.max(0, now - b.askedAt), F = FAM[b.item.fam];
  if (val === b.item.answer) {
    const first = !b.graded;
    if (first) { sched.report(b.id, true, rt); G.correct++; G.answers++; G.practiced.add(b.id); }
    if (first && rt < F.fast * 1.4) {
      b.hp--; b.lastDmg = now; b.dmgFlash = .3; bolt(CX, 78, COL.white); SFX.fire(); G.score += 15; G.credits += 15; addStreak();
      if (b.hp <= 0) { boom(CX, 78, COL.violet); boom(CX - 40, 70, COL.violet); boom(CX + 40, 86, COL.violet); setTimeout(SFX.kill, 100);
        G.score += 100; G.credits += 100; G.kills++; S.meta.kills++; G.waveKills = 1; G.boss = null; waveCleared(); return; }
    } else if (first) { addStreak(); showBanner('RIGHT, BUT TOO SLOW — ' + rt.toFixed(1) + 's', COL.warn, 1.3); SFX.key(); }
    else { showBanner('GOT IT', COL.phos, .9); SFX.key(); }
    nextBossProblem();
  } else {
    G.streak = 0;
    if (!b.graded) { sched.report(b.id, false, rt); G.answers++; G.practiced.add(b.id); }
    b.graded = true; b.misses++;
    if (b.misses === 1) { showBanner('NOT ' + fmt(val) + ' · TRY AGAIN', COL.warn, 1.3); SFX.wrong(); return; }
    showBanner(b.item.prompt + ' = ' + fmt(b.item.answer), COL.warn, 2.4, true); SFX.wrong();
    const c = Math.floor(Math.random() * 4); effects.push({ k: 'bolt', pts: [{ x: CX, y: 92 }, { x: CX + (CORNERS[c].x < CX ? -22 : 22), y: CY + (CORNERS[c].y < CY ? -22 : 22) }], color: COL.danger, life: .25, t: 0 });
    hitCorner(c); if (G.hull <= 0) return;
    b.reask = true; nextBossProblem();
  }
}
function nextBossProblem() {
  const b = G.boss; if (!b) return;
  if (b.reask) { b.reask = false; b.misses = 1; b.askedAt = performance.now() / 1000 + thinkDelay(); return; }
  const id = pickNext([]); if (!id) return; b.id = id; b.item = ITEMS[id]; b.graded = false; b.misses = 0; b.askedAt = performance.now() / 1000 + thinkDelay(); b.lastDmg = Math.max(b.lastDmg, b.askedAt);
}
function emp() {
  if (mode !== 'play' || G.bombs <= 0 || G.boss || !G.enemies.length) return;
  G.bombs--; for (const e of G.enemies) boom(e.x, e.y, COL.white); G.enemies = []; shake = .5; SFX.clear();
  updateHud(); if (G.waveKills >= G.needed) waveCleared();
}
function sessionRow() { return { ts: new Date().toISOString(), game: 'mastertype', version: VERSION, wave: G.wave, score: G.score, answers: G.answers, correct: G.correct, facts: G.practiced.size, bestStreak: G.bestStreak, seconds: Math.round((Date.now() - G.startedAt) / 1000) }; }
function waveCleared() {
  G.score += 25 * G.wave; G.credits += 25 * G.wave; S.meta.bestWave = Math.max(S.meta.bestWave, G.wave); save(); sync.save(null);
  if (!G.goalShown && sched.todayCount() >= S.settings.goal) { G.goalShown = true; SFX.goal(); mode = 'shop'; showGoal(); updateHud(); return; }
  SFX.clear(); mode = 'shop'; showShop(); updateHud();
}
function runSummary() {
  const acc = G.answers ? Math.round(100 * G.correct / G.answers) : 0;
  const fl = [...G.practiced].filter(id => S.cards[id] && S.cards[id].stage === 'fluent').length;
  return `<p>Wave ${G.wave} · Score ${G.score} · best streak ${G.bestStreak}</p>
    <p class="muted">Think time now ${thinkDelay().toFixed(1)} s${thinkDelay() <= .3 ? ' · lightning!' : ''}</p>
    <p>${G.answers} problems, ${acc}% right first try · ${G.practiced.size} facts practiced · ${fl} now fluent</p>`;
}
function finishRun() { S.meta.runs++; S.meta.best = Math.max(S.meta.best, G.score); save(); sync.save(sessionRow()); }
function showGoal() {
  overlay(`<h2>MISSION COMPLETE</h2><p>Today's goal of ${S.settings.goal} problems is done.</p>${runSummary()}
    <div class="row"><button class="primary" id="ovDone">Done for today</button><button id="ovMore">Keep playing</button></div>
    <p class="muted">"Done" takes you back to the games.</p>`);
  $('#ovDone').onclick = () => { finishRun(); sync.flushNow(); location.href = '../'; };
  $('#ovMore').onclick = () => { SFX.key(); showShop(); };
}
function endRun() {
  mode = 'over'; finishRun();
  const n = sched.todayCount(), g = S.settings.goal;
  overlay(`<h2>SHIP LOST</h2>${runSummary()}
    <p class="muted">${n >= g ? `Today's goal done (${n}/${g}).` : `Today: ${n} of ${g} problems. ${g - n} to go.`} Best score ${S.meta.best} · best wave ${S.meta.bestWave}</p>
    <div class="row"><button class="primary" id="ovStart">${n >= g ? 'Play again' : 'Launch again'}</button><button id="ovStats">Stats</button><button id="ovHome">Games</button></div>`);
  $('#ovStart').onclick = () => { newRun(); startWave(); }; $('#ovStats').onclick = showStats; $('#ovHome').onclick = () => { sync.flushNow(); location.href = '../'; };
}

/* ---------- update ---------- */
function update(dt) {
  if (mode !== 'play') return;
  const now = performance.now() / 1000;
  for (let i = 0; i < 4; i++) { const f = G.shieldFx[i]; G.shieldFx[i] = f > 0 ? Math.max(0, f - dt) : Math.min(0, f + dt); }
  if (G.boss) {
    const b = G.boss; b.dmgFlash = Math.max(0, b.dmgFlash - dt);
    if (now - b.lastDmg > 7) { b.lastDmg = now; const c = Math.floor(Math.random() * 4);
      effects.push({ k: 'bolt', pts: [{ x: CX, y: 92 }, { x: CX + (CORNERS[c].x < CX ? -22 : 22), y: CY + (CORNERS[c].y < CY ? -22 : 22) }], color: COL.danger, life: .25, t: 0 });
      floatText(CX, CY - 58, 'DREADNOUGHT FIRES', COL.danger, 1); hitCorner(c); }
    return;
  }
  const active = G.enemies.length; G.spawnT -= dt;
  if (active < maxActive() && G.waveKills + active < G.needed && G.spawnT <= 0) { spawn(); G.spawnT = Math.max(1.2, 3 - .1 * G.wave); }
  const sp = enemySpeed();
  for (const e of G.enemies) {
    if (e.think > 0) { e.think -= dt; continue; }
    if (e.hold > 0) { e.hold -= dt; continue; }
    const dx = CX - e.x, dy = CY - e.y, d = Math.hypot(dx, dy);
    if (d < 26) {
      if (!e.graded) { sched.report(e.id, false, Math.max(0, now - Math.max(e.spawnAt, G.lastFire || 0))); G.answers++; G.practiced.add(e.id); }
      if (!e.adjusted) { e.adjusted = true; adjustDelay(.25); }
      showBanner(e.item.prompt + ' = ' + fmt(e.item.answer), COL.warn, 2.4, true); e.dead = true; boom(e.x, e.y, COL.danger); hitCorner(e.corner);
      if (G.hull <= 0) return; continue;
    }
    e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
  }
  G.enemies = G.enemies.filter(e => !e.dead);
  if (G.hull > 0 && G.waveKills >= G.needed && G.enemies.length === 0) waveCleared();
}

/* ---------- draw ---------- */
function px() { const dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; } ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
function draw() {
  px(); ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 8 * shake, (Math.random() - .5) * 8 * shake);
  ctx.fillStyle = COL.screen; ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = COL.faint; for (let i = 0; i < 40; i++) ctx.fillRect(hash('s' + i) % W, hash('t' + i) % H, 2, 2);
  if (G) { drawInput(); drawShip(); if (G.boss) drawBoss(); for (const e of G.enemies) drawEnemy(e); }
  for (const f of effects) drawEffect(f);
  if (banner && G) drawBanner();
  ctx.restore();
}
function drawShip() {
  ctx.save(); ctx.translate(CX, CY);
  for (let i = 0; i < 4; i++) { const a = CORNER_ANG[i], fx = G.shieldFx[i], up = G.shields[i];
    ctx.beginPath(); ctx.arc(0, 0, 34 + (fx > 0 ? fx * 6 : 0), a - .62, a + .62);
    ctx.lineWidth = up ? (fx > 0 ? 6 : 4) : 2; ctx.strokeStyle = fx < 0 ? COL.danger : up ? (fx > 0 ? COL.white : COL.blue) : COL.faint;
    if (!up && fx === 0) ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
    if (up) { ctx.globalAlpha = .25; ctx.beginPath(); ctx.arc(0, 0, 38, a - .5, a + .5); ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; } }
  ctx.lineWidth = 2; ctx.strokeStyle = COL.white; ctx.fillStyle = COL.screen;
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(7, -6); ctx.lineTo(18, 10); ctx.lineTo(18, 15); ctx.lineTo(6, 9); ctx.lineTo(0, 14); ctx.lineTo(-6, 9); ctx.lineTo(-18, 15); ctx.lineTo(-18, 10); ctx.lineTo(-7, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = COL.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 6); ctx.stroke();
  ctx.strokeStyle = COL.phos; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 4, 4.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = COL.blue; ctx.fillRect(-1.5, -14, 3, 5);
  const blink = Math.floor(performance.now() / 500) % 2; ctx.fillStyle = blink ? COL.danger : COL.faint; ctx.fillRect(-19, 11, 2, 2); ctx.fillStyle = blink ? COL.phos : COL.faint; ctx.fillRect(17, 11, 2, 2);
  for (let i = 0; i < G.maxHull; i++) { ctx.fillStyle = i < G.hull ? COL.white : COL.faint; ctx.fillRect(-G.maxHull * 5 + i * 10 + 1, 22, 7, 3); }
  ctx.restore();
}
function drawEnemy(e) {
  const c = famColor(e.item.fam); ctx.save(); ctx.translate(e.x, e.y);
  const ang = Math.atan2(CY - e.y, CX - e.x), tnow = performance.now();
  ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.fillStyle = COL.screen;
  switch (e.item.fam) {
    case 'add': // Hive drone: hexagonal pod with a scanning eye
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); } ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(Math.cos(ang) * 4, Math.sin(ang) * 4, 4, 0, Math.PI * 2); ctx.fill(); break;
    case 'sub': // Raider: forked claw hull aimed at the ship
      ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(18, -7); ctx.lineTo(4, -4); ctx.lineTo(-6, -13); ctx.lineTo(-14, -10); ctx.lineTo(-10, 0); ctx.lineTo(-14, 10); ctx.lineTo(-6, 13); ctx.lineTo(4, 4); ctx.lineTo(18, 7); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = Math.floor(tnow / 120) % 2 ? COL.warn : COL.orange; ctx.fillRect(-19, -2, 5, 4); break;
    case 'mul': // Warden: square hull, four thrusters
      ctx.rotate(tnow / 1500); ctx.beginPath(); ctx.rect(-11, -11, 22, 22); ctx.fill(); ctx.stroke();
      ctx.beginPath(); [[-11, -11], [11, -11], [11, 11], [-11, 11]].forEach(([x, y]) => { ctx.moveTo(x, y); ctx.lineTo(x * 1.6, y * 1.6); }); ctx.stroke();
      ctx.fillStyle = c; ctx.fillRect(-4, -4, 8, 8); break;
    case 'div': // Splitter: two mirrored triangles
      ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -14); ctx.lineTo(-2, 0); ctx.lineTo(-6, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(-18, -6); ctx.lineTo(-10, 0); ctx.lineTo(-18, 6); ctx.lineTo(-8, 12); ctx.stroke();
      ctx.fillStyle = c; ctx.fillRect(2, -2, 4, 4); break;
    case 'negmul': // Phantom: hollow pentagon that fades in and out
      ctx.globalAlpha = .55 + .45 * Math.sin(tnow / 300); ctx.rotate(-tnow / 900); ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5 - Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); } ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; break;
    default: // Shard: a slowly turning crystal (negatives)
      ctx.rotate(tnow / 700); ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(10, 0); ctx.lineTo(0, 17); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -17); ctx.lineTo(0, 17); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = COL.white; ctx.fillRect(-2, -2, 4, 4);
  }
  ctx.restore();
  ctx.font = '22px ' + css('--font-mono'); const t = e.reveal ? e.item.prompt + ' = ' + fmt(e.item.answer) : e.item.prompt; const tw = ctx.measureText(t).width + 12;
  // label on the inner side of the enemy, toward the ship, so it never meets the screen edge or the status line
  let bx = e.x - tw / 2, by = e.y + (e.y < CY ? 28 : -52); bx = Math.max(4, Math.min(W - tw - 4, bx));
  ctx.fillStyle = COL.screen; ctx.fillRect(bx, by, tw, 24); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.strokeRect(bx + .5, by + .5, tw - 1, 23);
  ctx.fillStyle = e.graded ? COL.warn : COL.white; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(t, bx + 6, by + 13);
  if (e.think > 0 && e.thinkTotal > 0) { const fr = e.think / e.thinkTotal; ctx.fillStyle = COL.faint; ctx.fillRect(bx, by + 26, tw, 4); ctx.fillStyle = COL.warn; ctx.fillRect(bx, by + 26, tw * fr, 4); }
  if (target() === e) { ctx.strokeStyle = COL.white; ctx.lineWidth = 2; const r = 24;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.moveTo(e.x + sx * r, e.y + sy * (r - 8)); ctx.lineTo(e.x + sx * r, e.y + sy * r); ctx.lineTo(e.x + sx * (r - 8), e.y + sy * r); ctx.stroke(); }); }
}
function drawBoss() {
  const b = G.boss, now = performance.now() / 1000; ctx.save(); ctx.translate(CX, 78);
  ctx.lineWidth = 2; ctx.strokeStyle = b.dmgFlash > 0 ? COL.white : COL.violet; ctx.fillStyle = COL.screen;
  ctx.beginPath(); ctx.moveTo(-84, -6); ctx.lineTo(-58, -14); ctx.lineTo(-30, -26); ctx.lineTo(30, -26); ctx.lineTo(58, -14); ctx.lineTo(84, -6); ctx.lineTo(56, 6); ctx.lineTo(24, 18); ctx.lineTo(0, 24); ctx.lineTo(-24, 18); ctx.lineTo(-56, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-58, -14); ctx.lineTo(-70, -28); ctx.moveTo(58, -14); ctx.lineTo(70, -28); ctx.moveTo(-30, -26); ctx.lineTo(-24, -36); ctx.moveTo(30, -26); ctx.lineTo(24, -36); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-56, 6); ctx.lineTo(-30, -8); ctx.lineTo(30, -8); ctx.lineTo(56, 6); ctx.stroke();
  const pulse = .5 + .5 * Math.sin(now * 6); ctx.fillStyle = COL.violet; ctx.globalAlpha = .4 + .6 * pulse; ctx.beginPath(); ctx.arc(0, 4, 7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  for (let i = -2; i <= 2; i++) if (i) ctx.fillRect(i * 16 - 2, -17, 4, 4);
  for (let i = 0; i < b.maxHp; i++) { ctx.fillStyle = i < b.hp ? COL.violet : COL.faint; ctx.fillRect(-b.maxHp * 7 + i * 14, -46, 10, 6); }
  ctx.restore();
  ctx.font = '28px ' + css('--font-mono'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const t = b.item.prompt; const tw = ctx.measureText(t).width + 16;
  ctx.fillStyle = COL.screen; ctx.fillRect(CX - tw / 2, CY - 100, tw, 34); ctx.strokeStyle = COL.violet; ctx.lineWidth = 1; ctx.strokeRect(CX - tw / 2 + .5, CY - 100 + .5, tw - 1, 33);
  ctx.fillStyle = b.graded ? COL.warn : COL.white; ctx.fillText(t, CX, CY - 83);
  const win = FAM[b.item.fam].fast * 1.4, el = now - b.askedAt, frac = el < 0 ? 1 : Math.max(0, 1 - el / win);
  ctx.fillStyle = COL.faint; ctx.fillRect(CX - 80, CY - 60, 160, 6); ctx.fillStyle = frac > 0 ? COL.white : COL.danger; ctx.fillRect(CX - 80, CY - 60, 160 * frac, 6);
  ctx.font = '16px ' + css('--font-mono'); ctx.fillStyle = COL.dim; ctx.fillText(el < 0 ? 'THINK… ' + Math.ceil(-el) : frac > 0 ? 'SPEED WINDOW' : 'TOO SLOW — STILL COUNTS, NO DAMAGE', CX, CY - 46);
}
function drawInput() {
  ctx.font = '26px ' + css('--font-mono'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const blink = Math.floor(performance.now() / 400) % 2 ? '_' : ' ';
  ctx.fillStyle = COL.phos; ctx.fillText('> ' + buf.replace('-', '−') + blink, CX, CY + 52);
  ctx.font = '16px ' + css('--font-mono'); ctx.fillStyle = COL.dim;
  ctx.textAlign = 'left'; ctx.fillText(G.boss ? '' : `${G.needed - G.waveKills} TO GO`, 8, H - 12);
  const sp = G.streak % 5, sl = 'STREAK ' + G.streak; ctx.fillText(sl, 8, H - 30); const sx = 8 + ctx.measureText(sl).width + 10;
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < sp ? COL.blue : COL.faint; ctx.fillRect(sx + i * 12, H - 35, 9, 9); } ctx.fillStyle = COL.dim;
  ctx.textAlign = 'right'; ctx.fillText((G.bombs ? 'EMP ×' + G.bombs + '   ' : '') + 'WAVE ' + G.wave, W - 8, H - 12);
}
function drawBanner() {
  const b = banner, p = b.t / b.life; ctx.globalAlpha = p < .8 ? 1 : 1 - (p - .8) * 5;
  ctx.font = (b.big ? '30px ' : '22px ') + css('--font-mono'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.min(W - 16, ctx.measureText(b.text).width + 28), h = b.big ? 40 : 30, y = CY + (b.big ? 112 : 106);
  ctx.fillStyle = COL.screen; ctx.fillRect(CX - w / 2, y - h / 2, w, h); ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.strokeRect(CX - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2);
  ctx.fillStyle = b.color; ctx.fillText(b.text, CX, y + 1); ctx.globalAlpha = 1;
}
function drawEffect(f) {
  const p = f.t / f.life;
  if (f.k === 'bolt') { ctx.lineWidth = 4; ctx.strokeStyle = COL.white; ctx.globalAlpha = 1 - p; ctx.beginPath(); f.pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = f.color; ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.k === 'boom') { ctx.fillStyle = f.color; ctx.globalAlpha = 1 - p; for (const q of f.ps) ctx.fillRect(q.x + q.vx * f.t - 2, q.y + q.vy * f.t - 2, 4, 4); ctx.globalAlpha = 1; }
  else if (f.k === 'text') { ctx.font = '20px ' + css('--font-mono'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = f.color; ctx.globalAlpha = p < .75 ? 1 : 1 - (p - .75) * 4;
    ctx.fillText(f.text, Math.max(70, Math.min(W - 70, f.x)), f.y - p * 10); ctx.globalAlpha = 1; }
}
function loop(t) {
  const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t;
  update(dt);
  for (const f of effects) f.t += dt; effects = effects.filter(f => f.t < f.life);
  if (banner && mode !== 'pause') { banner.t += dt; if (banner.t >= banner.life) banner = null; }
  shake = Math.max(0, shake - dt);
  draw(); requestAnimationFrame(loop);
}

/* ================= UI ================= */
function overlay(html) { const o = $('#overlay'); o.innerHTML = html; o.hidden = false; }
function overlayHide() { $('#overlay').hidden = true; }
function overlayMsg(h, p) { overlay(`<h2>${h}</h2><p>${p}</p>`); }
function updateHud() {
  sched.rollDaily();
  $('#hudWave').textContent = G && mode !== 'title' ? ('WAVE ' + G.wave + (G.boss ? ' ★' : '')) : 'WAVE —';
  $('#hudScore').textContent = 'SCORE ' + (G ? G.score : 0);
  const sym = '◤◥◣◢', hp = $('#hudHp'), hl = $('#hudHull');
  if (G) { hp.textContent = 'SHIELDS ' + G.shields.map((u, i) => u ? sym[i] : '·').join(''); hp.className = G.shields.some(Boolean) ? 'hp' : 'lo';
    hl.textContent = 'HULL ' + '▮'.repeat(Math.max(0, G.hull)) + '▯'.repeat(Math.max(0, G.maxHull - G.hull)); hl.className = G.hull <= 1 ? 'lo' : 'hp'; }
  else { hp.textContent = 'SHIELDS ◤◥◣◢'; hp.className = 'hp'; hl.textContent = 'HULL ▮▮▮'; hl.className = 'hp'; }
  const n = sched.todayCount(), g = S.settings.goal; $('#hudGoal').textContent = (PLAYERS.length > 1 ? cap(player).toUpperCase() + ' · ' : '') + (n >= g ? `TODAY ${n} ✓` : `TODAY ${n}/${g}`);
  $('#btnSound').textContent = 'Sound: ' + (S.settings.sound ? 'on' : 'off');
}
function showTitle() {
  mode = 'title'; G = null;
  const todayN = sched.todayCount(), known = Object.keys(S.cards).length, fl = Object.values(S.cards).filter(c => c.stage === 'fluent').length;
  overlay(`<h2>FIGURES &amp; FORMULAS</h2>
    ${PLAYERS.length > 1 ? `<p class="muted">Playing as ${cap(player)}</p>` : ''}
    <p>Alien ships carry problems. Type the answer, press Enter, and your cruiser fires at the one that matches. Five right in a row restores a shield.</p>
    <p class="muted">${todayN >= S.settings.goal ? `Today's goal done ✓ (${todayN}). Extra practice still counts.` : `Today's goal: ${S.settings.goal} problems · ${todayN} done`}</p>
    <p class="muted">${known ? `${known} facts in rotation · ${fl} fluent · ${sched.dueCount()} due now` : 'First run: new facts come in a few at a time.'}</p>
    ${PLAYERS.length > 1 ? `<div class="row players">${PLAYERS.map(p => `<button data-p="${p}" class="${p === player ? 'primary' : ''}">${cap(p)}</button>`).join('')}</div>` : ''}
    <div class="row"><button class="primary" id="ovStart">Start run</button><button id="ovHome">Games</button></div>`);
  $('#ovStart').onclick = () => { audio(); newRun(); startWave(); }; $('#ovHome').onclick = () => { location.href = '../'; };
  $('#overlay').querySelectorAll('.players button').forEach(b => b.onclick = () => { SFX.key(); switchPlayer(b.dataset.p); });
  updateHud();
}
function showShop() {
  const items = [
    { k: 'shields', n: 'Shield recharge', d: 'Restore all four shields', c: 50, ok: () => G.shields.some(u => !u) },
    { k: 'patch', n: 'Hull patch', d: '+1 hull', c: 60, ok: () => G.hull < G.maxHull },
    { k: 'armor', n: 'Armor plating', d: '+1 max hull (and fill it)', c: 110, ok: () => G.maxHull < 6 },
    { k: 'thrust', n: 'Tractor field', d: 'Enemies 12% slower this run', c: 70, ok: () => G.thrust > .68 },
    { k: 'emp', n: 'EMP', d: 'Clears the screen once (Space)', c: 80, ok: () => G.bombs < 3 }];
  const boss = (G.wave + 1) % 4 === 0;
  overlay(`<h2>WAVE ${G.wave} CLEARED</h2>
    <p>Credits: <span id="shopCr">${G.credits}</span>${boss ? ' · <span class="muted">Dreadnought next: only fast answers hurt it.</span>' : ''}</p>
    <div class="shopgrid">${items.map(i => `<button data-k="${i.k}" ${(!i.ok() || G.credits < i.c) ? 'disabled' : ''}><b>${i.n}</b><small>${i.d}</small><span class="cost">${i.c} cr</span></button>`).join('')}</div>
    <div class="row"><button class="primary" id="ovNext">Next wave</button></div>`);
  $('#ovNext').onclick = () => { audio(); startWave(); };
  $('#overlay').querySelectorAll('.shopgrid button').forEach(b => b.onclick = () => {
    const i = items.find(x => x.k === b.dataset.k); if (!i || G.credits < i.c || !i.ok()) return; G.credits -= i.c; SFX.key();
    if (i.k === 'shields') { G.shields = [true, true, true, true]; G.shieldFx = [.8, .8, .8, .8]; SFX.regen(); }
    if (i.k === 'patch') G.hull++; if (i.k === 'armor') { G.maxHull++; G.hull = G.maxHull; } if (i.k === 'thrust') G.thrust *= .88; if (i.k === 'emp') G.bombs++;
    updateHud(); showShop(); });
}
function togglePause() {
  if (mode === 'play') { mode = 'pause'; overlay(`<h2>PAUSED</h2><p class="muted">Esc or the button to resume.</p><div class="row"><button class="primary" id="ovRes">Resume</button><button id="ovQuit">End run</button><button id="ovHome">Games</button></div>`);
    $('#ovRes').onclick = togglePause; $('#ovQuit').onclick = () => { endRun(); }; $('#ovHome').onclick = () => { endRun(); sync.flushNow(); location.href = '../'; }; }
  else if (mode === 'pause') { mode = 'play'; overlayHide(); lastT = performance.now(); grabKeys(); }
}

/* ---------- stats & settings ---------- */
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function showStats() {
  const sum = sched.summary(), now = Date.now();
  const famRows = Object.keys(FAM).filter(f => sum.byFam[f]).map(f => { const b = sum.byFam[f]; const total = ORDER.filter(id => ITEMS[id].fam === f).length;
    return `<tr><td class="fam-${f}">${FAM[f].name}</td><td class="num">${b.n}/${total}</td><td class="num">${b.att ? Math.round(100 * b.ok / b.att) + '%' : '—'}</td><td class="num">${b.median ? b.median.toFixed(1) + 's' : '—'}</td><td class="num">${b.stages.fluent}</td><td class="num">${b.stages.review}</td><td class="num">${b.stages.learning + b.stages.new}</td><td class="num">${b.due}</td></tr>`; }).join('');
  const stratRows = Object.entries(sum.byStrategy).filter(([, b]) => b.att >= 3).sort((a, b) => (a[1].ok / a[1].att) - (b[1].ok / b[1].att)).slice(0, 12)
    .map(([k, b]) => `<tr><td>${esc(k.replace(/_/g, ' '))}</td><td class="num">${b.n}</td><td class="num">${Math.round(100 * b.ok / b.att)}%</td><td class="num">${b.median ? b.median.toFixed(1) + 's' : '—'}</td></tr>`).join('');
  const hist = S.history.slice(-21); const mx = Math.max(1, ...hist.map(h => h.n));
  const streak = (() => { let n = 0; const d = new Date(); for (let i = 0; i < 90; i++) { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (S.history.some(h => h.d === k && h.n > 0)) n++; else if (i > 0) break; d.setDate(d.getDate() - 1); } return n; })();
  const syncLine = esc(sync.statusLine());
  panel(`<div class="row" style="justify-content:space-between"><h2>STATS</h2><button id="pClose">Close</button></div>
  <p class="muted">${syncLine}</p>
  <div class="tilerow">
    <div class="tile"><div class="k">Fluent</div><div class="v">${sum.fluent}</div><div class="s">of ${sum.seen} seen · ${ORDER.filter(id => sched.famOn(id)).length} enabled</div></div>
    <div class="tile"><div class="k">Due now</div><div class="v">${sched.dueCount()}</div><div class="s">new today ${S.daily.date === today() ? S.daily.newCount : 0}/${S.settings.newPerDay}</div></div>
    <div class="tile"><div class="k">Day streak</div><div class="v">${streak}</div><div class="s">${S.meta.answers} answers all time</div></div>
    <div class="tile"><div class="k">Best</div><div class="v">${S.meta.best}</div><div class="s">wave ${S.meta.bestWave} · ${S.meta.runs} runs</div></div>
  </div>
  <h3>Answers per day (last 3 weeks)</h3>
  <div class="bars">${hist.map(h => `<div title="${h.d}: ${h.ok}/${h.n}" class="${h.d === today() ? 'today' : ''}" style="height:${Math.max(4, 100 * h.n / mx)}%"></div>`).join('') || '<div style="height:4px"></div>'}</div>
  <h3>By family</h3>
  <div class="wrap"><table><tr><th>Family</th><th>Seen</th><th>Accuracy</th><th>Median</th><th>Fluent</th><th>Review</th><th>Learning</th><th>Due</th></tr>${famRows || '<tr><td colspan="8" class="muted">Nothing yet.</td></tr>'}</table></div>
  <h3>By strategy</h3>
  <p class="muted">Weakest first. A slow strategy shows up across many facts; this is where to look before drilling individual ones.</p>
  ${stratRows ? `<div class="wrap"><table><tr><th>Strategy</th><th>Facts</th><th>Accuracy</th><th>Median</th></tr>${stratRows}</table></div>` : '<p class="muted">Needs a few more answers.</p>'}
  <h3 class="leech">Trouble facts</h3>
  <p class="muted">Missed 3+ times, or under 70% after 4 tries.</p>
  ${sum.leeches.length ? `<div class="wrap"><table><tr><th>Fact</th><th>Answer</th><th>Misses</th><th>Accuracy</th><th>Median</th><th>Stage</th></tr>${sum.leeches.slice(0, 15).map(({ id, c }) => `<tr><td class="fam-${ITEMS[id].fam}">${esc(ITEMS[id].prompt)}</td><td class="num">${fmt(ITEMS[id].answer)}</td><td class="num">${c.lapses}</td><td class="num">${Math.round(100 * c.ok / c.att)}%</td><td class="num">${c.rts.length ? median(c.rts).toFixed(1) + 's' : '—'}</td><td class="stage-${c.stage}">${c.stage}</td></tr>`).join('')}</table></div>` : '<p class="muted">None yet.</p>'}
  <h3>Slow but correct</h3>
  <p class="muted">Right answers that take over 1.6× the family's target time. Computed, not recalled.</p>
  ${sum.slow.length ? `<div class="wrap"><table><tr><th>Fact</th><th>Answer</th><th>Median</th><th>Target</th></tr>${sum.slow.slice(0, 12).map(({ id, c }) => `<tr><td class="fam-${ITEMS[id].fam}">${esc(ITEMS[id].prompt)}</td><td class="num">${fmt(ITEMS[id].answer)}</td><td class="num">${median(c.rts).toFixed(1)}s</td><td class="num">${FAM[ITEMS[id].fam].fast.toFixed(1)}s</td></tr>`).join('')}</table></div>` : '<p class="muted">None yet.</p>'}
  <h3>Export</h3>
  <p class="muted">A copy of everything this browser knows. Paste it into Import on another device to move progress by hand.</p>
  <textarea id="exp" readonly>${esc(JSON.stringify(S))}</textarea>
  <div class="row" style="justify-content:flex-start"><button id="pCopy">Copy</button></div>
  <h3>Import</h3>
  <textarea id="imp" placeholder="Paste an export here"></textarea>
  <div class="row" style="justify-content:flex-start"><button id="pImport">Import (replaces current progress)</button></div>
  <p class="muted" style="margin-top:14px">Figures &amp; Formulas v${VERSION}</p>`);
  $('#pClose').onclick = hidePanel;
  $('#pCopy').onclick = () => { const ta = $('#exp'); const done = () => { $('#pCopy').textContent = 'Copied'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done).catch(() => ta.select()); else ta.select(); };
  $('#pImport').onclick = () => { try { const o = JSON.parse($('#imp').value); if (!o || !o.cards) throw 0; S = Object.assign(FF.store.defaultState(), o); save(); sched = new FF.Scheduler(FF.facts, S, { onChange: save }); showStats(); } catch (e) { $('#pImport').textContent = 'That is not a valid export'; } };
}
function showSettings() {
  const s = S.settings;
  panel(`<div class="row" style="justify-content:space-between"><h2>SETTINGS</h2><button id="pClose">Close</button></div>
  <p class="muted">Settings for ${cap(player)}${sync.remote ? ', saved to the Sheet too so they follow to any device' : ''}.</p>
  <h3>Fact families</h3>
  ${Object.keys(FAM).map(f => `<label class="opt"><input type="checkbox" id="fam_${f}" ${s.fams[f] ? 'checked' : ''}> <span class="fam-${f}">${FAM[f].name}</span> <span style="color:var(--phos-dim)">· ${ORDER.filter(id => ITEMS[id].fam === f).length} facts · fast under ${FAM[f].fast}s</span></label>`).join('')}
  <label class="opt" style="margin-top:8px">Layers <select id="setLayer">
    <option value="1" ${s.maxLayer == 1 ? 'selected' : ''}>1 · core facts only</option>
    <option value="2" ${s.maxLayer == 2 ? 'selected' : ''}>1–2 · core + signed numbers</option>
    <option value="3" ${s.maxLayer == 3 ? 'selected' : ''}>1–3 · also bridging twenty, 11s and 12s</option></select></label>
  <h3>Pacing</h3>
  <label class="opt">Daily goal (problems) <input type="number" id="setGoal" min="10" max="300" value="${s.goal}"></label>
  <p class="muted">When the goal is reached, the next cleared wave ends the mission. About 60 problems is 5–7 minutes.</p>
  <label class="opt">New facts per day <input type="number" id="setNew" min="0" max="60" value="${s.newPerDay}"></label>
  <p class="muted">Due facts always come first; new ones fill in after. 10–15 a day is plenty.</p>
  <h3>Input</h3>
  <label class="opt"><input type="checkbox" id="setPad" ${padOn() ? 'checked' : ''}> Show on-screen number pad</label>
  <label class="opt"><input type="checkbox" id="setSnd" ${s.sound ? 'checked' : ''}> Sound</label>
  <h3>Danger zone</h3>
  <div class="row" style="justify-content:flex-start"><button class="danger" id="pReset">Reset progress in this browser</button></div>`);
  $('#pClose').onclick = () => { Object.keys(FAM).forEach(f => s.fams[f] = $('#fam_' + f).checked); s.maxLayer = +$('#setLayer').value;
    s.newPerDay = Math.max(0, Math.min(60, parseInt($('#setNew').value, 10) || 0)); s.goal = Math.max(10, Math.min(300, parseInt($('#setGoal').value, 10) || 60)); s.numpad = $('#setPad').checked; s.sound = $('#setSnd').checked;
    save(); sync.settings(); applyNumpad(); hidePanel(); updateHud(); };
  let armed = false; $('#pReset').onclick = () => { if (!armed) { armed = true; $('#pReset').textContent = 'Click again to erase everything in this browser'; return; }
    S = FF.store.defaultState(); save(); sched = new FF.Scheduler(FF.facts, S, { onChange: save }); hidePanel(); showTitle(); };
}
function panel(html) { $('#panelIn').innerHTML = html; $('#panel').hidden = false; if (mode === 'play') togglePause(); }
function hidePanel() { $('#panel').hidden = true; grabKeys(); }
function isTouch() { try { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches || /iPad|iPhone|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); } catch (e) { return false; } }
function padOn() { return S.settings.numpad === null ? isTouch() : !!S.settings.numpad; }
function applyNumpad() { $('#numpad').hidden = !padOn(); $('#btnPad').textContent = 'Numpad: ' + (padOn() ? 'on' : 'off'); }
/* A hidden focused input: iPadOS only delivers hardware Backspace (and some other keys) to a focused text field.
   inputmode="none" keeps the on-screen keyboard away, so the number pad still does that job on touch. */
const kb = $('#kb');
function grabKeys() { if (mode === 'play' && $('#panel').hidden) { try { kb.focus({ preventScroll: true }); } catch (e) {} } }

/* ---------- input ---------- */
function key(k) {
  if (k === 'pause') { if (mode === 'play' || mode === 'pause') togglePause(); return; }
  if (mode !== 'play') return;
  if (k === 'fire') { fire(); return; }
  if (k === 'emp') { emp(); return; }
  if (k === 'bs') { buf = buf.slice(0, -1); return; }
  if (k === '-') { if (buf === '') buf = '-'; return; }
  if (/^[0-9]$/.test(k) && buf.replace('-', '').length < 3) { buf += k; SFX.key(); }
}
document.addEventListener('keydown', ev => {
  if (!$('#panel').hidden) return;
  const tag = (ev.target && ev.target.tagName) || ''; if (ev.target !== kb && (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT')) return;
  if (ev.key === 'Escape') { key('pause'); ev.preventDefault(); return; }
  if (ev.key === 'Enter' && (mode === 'shop' || mode === 'title' || mode === 'over')) { const b = $('#ovNext') || $('#ovDone') || $('#ovStart'); if (b) { b.click(); ev.preventDefault(); } return; }
  if (mode !== 'play') return;
  if (ev.key === 'Enter') { key('fire'); ev.preventDefault(); }
  else if (ev.key === ' ') { key('emp'); ev.preventDefault(); }
  else if (ev.key === 'Backspace' || ev.key === 'Delete') { key('bs'); ev.preventDefault(); }
  else if (ev.key === '-' || ev.key === '−' || ev.key === 'Subtract') { key('-'); ev.preventDefault(); }
  else if (/^[0-9]$/.test(ev.key)) { key(ev.key); ev.preventDefault(); }
});
kb.addEventListener('beforeinput', ev => { ev.preventDefault(); if (mode !== 'play') return;
  if (ev.inputType === 'deleteContentBackward' || ev.inputType === 'deleteContentForward') key('bs');
  else if (ev.inputType === 'insertLineBreak' || ev.inputType === 'insertParagraph') key('fire');
  else if (ev.inputType === 'insertText' && ev.data) for (const ch of ev.data) { if (/[0-9]/.test(ch)) key(ch); else if (ch === '-' || ch === '−') key('-'); else if (ch === ' ') key('emp'); } });
kb.addEventListener('input', () => { kb.value = ''; });
$('#numpad').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; audio(); key(b.dataset.k); grabKeys(); });
$('#btnPad').onclick = () => { S.settings.numpad = !padOn(); save(); applyNumpad(); grabKeys(); };
document.querySelector('.screenwrap').addEventListener('pointerdown', () => { grabKeys(); });
$('#btnStart').onclick = () => { audio(); if (mode === 'play' || mode === 'pause') { if (mode === 'pause') togglePause(); return; } newRun(); startWave(); };
$('#btnStats').onclick = showStats;
$('#btnSettings').onclick = showSettings;
$('#btnSound').onclick = () => { S.settings.sound = !S.settings.sound; save(); updateHud(); if (S.settings.sound) { audio(); SFX.key(); } };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });

/* ---------- boot ---------- */
function start() {
  loadColors(); applyNumpad(); $('#ver').textContent = 'v' + VERSION; showTitle(); requestAnimationFrame(loop);
  sync.load();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('../sw.js').catch(() => {});
}
start();
})();
