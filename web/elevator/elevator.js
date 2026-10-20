/* Elevator Drop — the floors of a building are a vertical number line from −8 to 8, with the negatives underground.
 * Every floor is its own room (lava cave at the bottom, star deck at the top), drawn as SVG and painted onto the canvas.
 * The car rides to the first number; tap (or arrow to) the floor where it stops after the move.
 * A wrong floor flashes red, then the car goes back to the start and rides the real move one floor at a time.
 * No clock: a round is 12 trips. Built for signed-number sense, like Lily Hop turned on its side. */
(function () {
'use strict';
const VERSION = '1.2.0', TRIPS = 12, TOP = 8, BOTTOM = -8;
const K = FF.kit({ game: 'elevator', title: 'Elevator Drop', version: VERSION });
const { fmt } = K;
/* who rides the car: the player's own face */
const RIDER = { krishna: '🧔🏾‍♂️', nabil: '🧑🏻' }[K.player] || (FF.player.isGuest(K.player) ? '🙂' : '🧑');
const $ = s => document.querySelector(s);
const cv = $('#stage'), ctx = cv.getContext('2d');
const FONT = '"Baloo 2", ui-rounded, system-ui, sans-serif';
let W = 800, H = 600, U = 1, L = null;
function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; U = Math.max(.75, Math.min(1.4, Math.min(W, H) / 640)); cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); layout(); }
/* wide screens: problem on the left, building on the right; tall screens: problem on top, building below.
 * The building is a roof (1.25 rows), floors 8..0, a strip of ground, floors −1..−8. */
function layout() {
  const fs = Math.round(Math.max(34, 54 * U)), wide = W >= H * 1.05 && W >= 700, s = Math.min(1.2, Math.max(.8, U));
  if (wide) { const bw = Math.min(640 * U, W * .56), bx1 = W - Math.max(16, W * .02); L = { wide, fs, bx0: bx1 - bw, bx1, by0: 84, by1: H - 14, px: (bx1 - bw) / 2, pw: bx1 - bw - 32, ty: H * .34 }; }
  else { const bw = W - 32, ty = Math.max(96, H * .09); L = { wide, fs, bx0: 16, bx1: W - 16, by0: ty + fs * 1.5 + 60 * U, by1: H - 14, px: W / 2, pw: W - 24, ty }; }
  L.lw = 52 * s; L.sw = 74 * s; L.edge = 22 * s; L.gnd = 18;
  L.rh = (L.by1 - L.by0 - L.gnd) / (TOP - BOTTOM + 1 + 1.25); L.roof = L.rh * 1.25;
  L.rx0 = L.bx0 + L.lw; L.sx = L.bx1 - L.edge - L.sw; L.rx1 = L.sx;
}
const floorTop = n => L.by0 + L.roof + (TOP - n) * L.rh + (n < 0 ? L.gnd : 0);
function floorAtY(y) {
  const gy = floorTop(0) + L.rh; let n = y < gy ? TOP - Math.floor((y - L.by0 - L.roof) / L.rh) : -1 - Math.floor((y - gy - L.gnd) / L.rh);
  return Math.max(BOTTOM, Math.min(TOP, n));
}
addEventListener('resize', resize); resize();

/* =====================================================================
 *  ROOM DRAWINGS  (each room is 640 x 64; the floor line is at y = 54)
 * ===================================================================== */
const O = 'class="o"';
let seed = 7;
const srand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const shelf = (x, w) => {
  let s = `<rect x="${x}" y="6" width="${w}" height="48" fill="#8a5a33" ${O}/>`;
  const colors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#2ecc71', '#e67e22', '#1abc9c', '#ecf0f1'];
  [8, 23, 38].forEach(top => {
    let bx = x + 4;
    while (bx < x + w - 10) {
      const bw = 5 + Math.floor(srand() * 5), bh = 10 + Math.floor(srand() * 4);
      s += `<rect x="${bx}" y="${top + 14 - bh}" width="${bw}" height="${bh}" fill="${colors[Math.floor(srand() * colors.length)]}" class="o thin"/>`;
      bx += bw + 1;
    }
    s += `<line x1="${x}" y1="${top + 15}" x2="${x + w}" y2="${top + 15}" class="ln"/>`;
  });
  return s;
};
const plant = (x, pot = '#c7743c') =>
  `<path d="M${x} 40 q-11 -12 -6 -24 M${x} 40 q2 -16 6 -26 M${x} 40 q12 -6 13 -18" class="ln" style="stroke:#2e8b3e;stroke-width:3"/>
   <rect x="${x - 9}" y="40" width="18" height="14" rx="2" fill="${pot}" ${O}/>`;
const person = (x, shirt, skin = '#f5c9a0', hair = '#4a2f1d') =>
  `<rect x="${x - 7}" y="31" width="14" height="15" rx="5" fill="${shirt}" ${O}/>
   <path d="M${x - 4} 46 V54 M${x + 4} 46 V54" class="ln" style="stroke-width:3"/>
   <circle cx="${x}" cy="24" r="7" fill="${skin}" ${O}/>
   <path d="M${x - 7} 23 q7 -10 14 0 q-7 -4 -14 0Z" fill="${hair}" ${O}/>
   <circle cx="${x - 2.5}" cy="25" r="1" fill="#23233a"/><circle cx="${x + 2.5}" cy="25" r="1" fill="#23233a"/>`;
const lamp = x => `<line x1="${x}" y1="0" x2="${x}" y2="6" class="ln"/><path d="M${x - 7} 12 L${x - 4} 6 H${x + 4} L${x + 7} 12Z" fill="#ffe27a" ${O}/>`;

const ROOMS = {
  8: { name: 'star deck', wall: '#3b3f8f', floor: '#8b5a3c', art: () => {
    const stars = [[188, 18], [205, 36], [222, 13], [246, 28], [262, 40], [300, 16], [318, 33], [336, 12], [384, 38], [392, 15]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff"/>`).join('');
    return `<rect x="172" y="7" width="232" height="40" rx="4" fill="#141a45" ${O}/>${stars}
      <circle cx="360" cy="24" r="8" fill="#ffe58a" ${O}/><circle cx="357" cy="22" r="1.8" fill="#e3c35a"/>
      <line x1="288" y1="7" x2="288" y2="47" class="ln"/>
      <ellipse cx="290" cy="58" rx="70" ry="3" fill="#7b6bd6"/>
      <rect x="40" y="27" width="96" height="14" rx="6" fill="#c94467" ${O}/>
      <rect x="44" y="38" width="88" height="14" rx="4" fill="#e05a7a" ${O}/>
      <rect x="34" y="33" width="14" height="21" rx="5" fill="#c94467" ${O}/><rect x="128" y="33" width="14" height="21" rx="5" fill="#c94467" ${O}/>
      <path d="M482 36 L470 54 M482 36 L494 54 M482 36 V54" class="ln"/>
      <g transform="rotate(-28 484 31)"><rect x="462" y="26" width="46" height="10" rx="3" fill="#dfe4ef" ${O}/><rect x="505" y="24" width="8" height="14" rx="2" fill="#9aa4b8" ${O}/></g>
      ${person(445, '#ffb627')}${plant(592)}`;
  } },
  7: { name: 'pizza kitchen', wall: '#ffe0b3', floor: '#f4f4f4', art: () => {
    let checks = ''; for (let i = 0; i < 40; i += 2) checks += `<rect x="${i * 16}" y="54" width="16" height="10" fill="#d9534f"/>`;
    return `${checks}
      <line x1="26" y1="8" x2="104" y2="8" class="ln"/>
      <line x1="45" y1="8" x2="45" y2="14" class="ln"/><circle cx="45" cy="22" r="8" fill="#555c66" ${O}/>
      <line x1="82" y1="8" x2="82" y2="13" class="ln"/><circle cx="82" cy="23" r="10" fill="#c46a2c" ${O}/>
      <rect x="112" y="36" width="196" height="18" fill="#7fb2cc" ${O}/><rect x="106" y="32" width="208" height="5" rx="2" fill="#f3f5f7" ${O}/>
      <line x1="178" y1="38" x2="178" y2="54" class="ln"/><line x1="244" y1="38" x2="244" y2="54" class="ln"/>
      <ellipse cx="160" cy="29" rx="24" ry="4.5" fill="#f2b44a" ${O}/>
      <circle cx="150" cy="29" r="2" fill="#c0392b"/><circle cx="162" cy="28" r="2" fill="#c0392b"/><circle cx="172" cy="30" r="2" fill="#c0392b"/>
      <rect x="262" y="22" width="12" height="10" rx="2" fill="#e74c3c" ${O}/>
      <circle cx="333" cy="11" r="5" fill="#fff" ${O}/><circle cx="345" cy="11" r="5" fill="#fff" ${O}/><circle cx="339" cy="8" r="6" fill="#fff" ${O}/>
      <rect x="331" y="11" width="16" height="7" fill="#fff" ${O}/>
      <rect x="328" y="31" width="22" height="23" rx="6" fill="#fff" ${O}/>
      <circle cx="339" cy="24" r="7.5" fill="#f5c9a0" ${O}/>
      <circle cx="336" cy="23" r="1" fill="#23233a"/><circle cx="342" cy="23" r="1" fill="#23233a"/>
      <path d="M334 27 q5 3 10 0" class="ln" style="stroke:#4a2f1d;stroke-width:2.5"/>
      <path d="M418 54 V30 a33 26 0 0 1 66 0 V54 Z" fill="#c0563a" ${O}/>
      <path d="M424 22 h54 M420 38 h62" class="ln" style="stroke:#8e3f2b"/>
      <path d="M437 54 V43 a14 11 0 0 1 28 0 V54 Z" fill="#3a1d10" ${O}/>
      <ellipse cx="451" cy="51" rx="9" ry="4" fill="#ff9a2e"/><ellipse cx="451" cy="51" rx="5" ry="2.5" fill="#ffe14d"/>
      <rect x="544" y="10" width="42" height="44" rx="4" fill="#e9f1f7" ${O}/>
      <line x1="544" y1="27" x2="586" y2="27" class="ln"/><line x1="550" y1="15" x2="550" y2="23" class="ln"/><line x1="550" y1="32" x2="550" y2="44" class="ln"/>
      <circle cx="575" cy="18" r="3" fill="#ffb627"/>`;
  } },
  6: { name: 'library', wall: '#5f8a6a', floor: '#7a4a2a', art: () => {
    seed = 11;
    return `${shelf(14, 140)}${shelf(450, 170)}
      <ellipse cx="300" cy="58" rx="80" ry="3.5" fill="#c0392b"/>
      <rect x="296" y="9" width="44" height="22" fill="#fff4d6" ${O}/>
      <path d="M299 28 L312 15 L322 25 L328 19 L337 28Z" fill="#5aa469"/><circle cx="330" cy="14" r="3" fill="#f1c40f"/>
      <rect x="228" y="22" width="40" height="22" rx="8" fill="#8e44ad" ${O}/>
      <rect x="224" y="38" width="48" height="12" rx="4" fill="#9b59b6" ${O}/>
      <rect x="220" y="32" width="10" height="20" rx="4" fill="#8e44ad" ${O}/><rect x="266" y="32" width="10" height="20" rx="4" fill="#8e44ad" ${O}/>
      ${person(248, '#3498db')}
      <rect x="241" y="33" width="14" height="9" fill="#f1c40f" ${O}/>
      <line x1="370" y1="54" x2="370" y2="18" class="ln"/><path d="M360 22 L364 12 H376 L380 22Z" fill="#ffe27a" ${O}/>
      <path d="M356 54 h28" class="ln"/>
      <circle cx="410" cy="20" r="9" fill="#a0522d" ${O}/><circle cx="406" cy="18" r="2.5" fill="#fff" ${O}/><circle cx="414" cy="18" r="2.5" fill="#fff" ${O}/>
      <path d="M408 23 l2 3 l2 -3" fill="#ffb627"/>`;
  } },
  5: { name: 'arcade', wall: '#2b1a46', floor: '#20132f', art: () => {
    const cab = (x, body, screen) => `<path d="M${x} 54 V18 l6 -10 h28 l6 10 V54Z" fill="${body}" ${O}/>
      <rect x="${x + 6}" y="15" width="28" height="16" rx="2" fill="${screen}" ${O}/>
      <rect x="${x + 10}" y="19" width="6" height="4" fill="#fff" opacity=".8"/><rect x="${x + 22}" y="24" width="4" height="4" fill="#fff" opacity=".8"/>
      <rect x="${x + 2}" y="34" width="36" height="5" fill="#111" ${O}/>
      <line x1="${x + 11}" y1="34" x2="${x + 11}" y2="29" class="ln" style="stroke:#ddd"/><circle cx="${x + 11}" cy="28" r="2.5" fill="#e74c3c"/>
      <circle cx="${x + 24}" cy="36" r="1.6" fill="#f1c40f"/><circle cx="${x + 30}" cy="36" r="1.6" fill="#2ecc71"/>`;
    return `<rect x="0" y="59" width="640" height="2" fill="#ff4fd8"/>
      ${cab(30, '#3d5afe', '#00e5ff')}${cab(84, '#e53935', '#76ff03')}${cab(138, '#00bfa5', '#ffea00')}
      <rect x="236" y="14" width="60" height="40" rx="4" fill="#ff80ab" ${O}/><rect x="242" y="18" width="48" height="22" fill="#d6f3ff" ${O}/>
      <line x1="266" y1="18" x2="266" y2="26" class="ln"/><path d="M261 30 l5 -4 l5 4" class="ln"/>
      <circle cx="252" cy="37" r="4" fill="#ffca28"/><circle cx="262" cy="37" r="4" fill="#8bc34a"/><circle cx="280" cy="36" r="4" fill="#ba68c8"/>
      <text x="372" y="26" text-anchor="middle" font-size="15" fill="#ff4fd8" stroke="#ffd1f4" stroke-width=".6">GAME</text>
      <text x="372" y="42" text-anchor="middle" font-size="15" fill="#00e5ff" stroke="#d1fbff" stroke-width=".6">ON!</text>
      ${cab(470, '#ff9100', '#ff4081')}${cab(524, '#7c4dff', '#00e676')}${cab(578, '#3d5afe', '#ffea00')}`;
  } },
  4: { name: 'office', wall: '#cfe3f2', floor: '#8e9aab', art: () => {
    const desk = x => `<rect x="${x}" y="36" width="78" height="4" fill="#b07a4a" ${O}/>
      <path d="M${x + 4} 40 V54 M${x + 74} 40 V54" class="ln"/>
      <rect x="${x + 22}" y="16" width="34" height="20" rx="2" fill="#2b3a55" ${O}/><rect x="${x + 25}" y="19" width="28" height="13" fill="#6fc3ff"/>
      <path d="M${x + 28} 29 l6 -5 l5 3 l7 -6" class="ln" style="stroke:#fff;stroke-width:1.4"/>
      <circle cx="${x + 66}" cy="32" r="3.5" fill="#fff" ${O}/>`;
    return `${desk(26)}${desk(130)}
      ${person(108, '#2ecc71', '#c98b5e', '#1d1d1d')}
      <rect x="282" y="34" width="22" height="20" rx="2" fill="#e6eef5" ${O}/><rect x="285" y="14" width="16" height="20" rx="7" fill="#7fd0ff" ${O}/>
      ${person(326, '#e67e22')}
      <rect x="314" y="30" width="6" height="7" fill="#fff" ${O}/>
      <circle cx="388" cy="18" r="9" fill="#fff" ${O}/><path d="M388 12 V18 L392 20" class="ln"/>
      <rect x="420" y="8" width="112" height="32" rx="2" fill="#fff" ${O}/>
      <path d="M430 34 L452 26 L470 30 L496 16 L520 20" class="ln" style="stroke:#e74c3c"/>
      <rect x="444" y="40" width="8" height="2" fill="#2b3a55"/>
      ${plant(592)}`;
  } },
  3: { name: 'bedroom', wall: '#f8c8d4', floor: '#b97a4b', art: () => `
      <rect x="30" y="22" width="10" height="32" rx="2" fill="#8a5a33" ${O}/>
      <rect x="36" y="38" width="136" height="10" fill="#fff" ${O}/>
      <ellipse cx="54" cy="36" rx="12" ry="5" fill="#fff" ${O}/>
      <circle cx="56" cy="32" r="6.5" fill="#f5c9a0" ${O}/><path d="M50 30 q6 -8 12 0Z" fill="#e0a030" ${O}/>
      <path d="M53 33 h2 M58 33 h2" class="ln thin"/>
      <rect x="64" y="34" width="108" height="14" rx="4" fill="#4a90e2" ${O}/>
      <path d="M84 34 v14 M104 34 v14 M124 34 v14 M144 34 v14" class="ln thin" style="stroke:#2d6bb5"/>
      <path d="M40 48 V54 M168 48 V54" class="ln"/>
      <text x="72" y="22" font-size="10" fill="#7b6bd6">z</text><text x="80" y="14" font-size="13" fill="#7b6bd6">Z</text>
      <rect x="182" y="40" width="22" height="14" fill="#a0673f" ${O}/>
      <line x1="193" y1="40" x2="193" y2="30" class="ln"/><path d="M185 30 L188 22 H198 L201 30Z" fill="#ffe27a" ${O}/>
      <rect x="246" y="8" width="84" height="34" fill="#9fdcff" ${O}/>
      <circle cx="312" cy="18" r="5" fill="#ffe14d"/>
      <path d="M246 8 q14 18 4 34 H246Z M330 8 q-14 18 -4 34 H330Z" fill="#ff8fab" ${O}/>
      <line x1="288" y1="8" x2="288" y2="42" class="ln thin"/>
      <ellipse cx="372" cy="58" rx="36" ry="3" fill="#9b59b6"/>
      <ellipse cx="372" cy="50" rx="13" ry="6" fill="#f39c12" ${O}/>
      <circle cx="384" cy="44" r="6" fill="#f39c12" ${O}/>
      <path d="M380 39 l1 -5 l3 4 M386 39 l2 -5 l2 5" fill="#f39c12" ${O}/>
      <path d="M359 50 q-10 -2 -8 -10" class="ln" style="stroke:#f39c12;stroke-width:3"/>
      <circle cx="382" cy="44" r=".9" fill="#23233a"/><circle cx="386" cy="44" r=".9" fill="#23233a"/>
      <rect x="448" y="44" width="60" height="10" fill="#8a5a33" ${O}/>
      <rect x="452" y="16" width="52" height="28" rx="3" fill="#23233a" ${O}/><rect x="456" y="20" width="44" height="20" fill="#7ed957"/>
      <circle cx="470" cy="30" r="5" fill="#ffd166"/><rect x="482" y="26" width="10" height="10" fill="#ef476f"/>
      <ellipse cx="562" cy="48" rx="22" ry="9" fill="#06d6a0" ${O}/>
      <rect x="596" y="20" width="26" height="34" fill="#c8915e" ${O}/><line x1="609" y1="20" x2="609" y2="54" class="ln"/>`
  },
  2: { name: 'gym', wall: '#ffe066', floor: '#4a4f5a', art: () => `
      <path d="M30 54 L34 46 H112 L116 54Z" fill="#555" ${O}/><rect x="36" y="44" width="76" height="4" fill="#222" ${O}/>
      <path d="M104 46 L100 20 M110 46 L106 20" class="ln"/><rect x="96" y="16" width="16" height="7" rx="2" fill="#888" ${O}/>
      <rect x="64" y="25" width="12" height="13" rx="4" fill="#e63946" ${O}/>
      <circle cx="72" cy="19" r="6.5" fill="#c98b5e" ${O}/><path d="M66 17 q6 -8 12 0Z" fill="#1d1d1d"/>
      <path d="M68 38 L60 44 M74 38 L80 45" class="ln" style="stroke-width:3"/>
      <path d="M66 28 L58 32 M76 28 L84 25" class="ln" style="stroke-width:2.5"/>
      <rect x="184" y="34" width="90" height="4" fill="#666" ${O}/><path d="M190 38 V54 M268 38 V54" class="ln"/>
      <g fill="#333" class="o"><circle cx="198" cy="30" r="4"/><circle cx="214" cy="30" r="4"/><circle cx="236" cy="29" r="5"/><circle cx="256" cy="29" r="5"/></g>
      <path d="M198 30 h16 M236 29 h20" class="ln" style="stroke-width:3"/>
      <line x1="328" y1="0" x2="328" y2="12" class="ln"/>
      <rect x="318" y="12" width="20" height="32" rx="8" fill="#e63946" ${O}/><rect x="318" y="20" width="20" height="3" fill="#b5212e"/>
      <rect x="390" y="7" width="130" height="40" fill="#d8f0ff" ${O}/>
      <path d="M402 40 L424 12 M414 42 L440 10 M480 40 L500 14" class="ln" style="stroke:#fff;stroke-width:3"/>
      <text x="455" y="32" text-anchor="middle" font-size="13" fill="#2b3a55">GO!</text>
      <path d="M552 54 a10 10 0 1 1 20 0Z" fill="#2d6bb5" ${O}/><path d="M556 44 a6 6 0 0 1 12 0" class="ln" style="stroke-width:3"/>
      <path d="M586 54 a13 13 0 1 1 26 0Z" fill="#e67e22" ${O}/><path d="M591 41 a8 7 0 0 1 16 0" class="ln" style="stroke-width:3"/>`
  },
  1: { name: 'pet shop', wall: '#b6ecf2', floor: '#c9a87c', art: () => {
    const tank = (x, w, fishes) => {
      let s = `<rect x="${x}" y="44" width="${w}" height="10" fill="#8a5a33" ${O}/>
        <rect x="${x}" y="12" width="${w}" height="32" fill="#4fb3e8" ${O}/>
        <rect x="${x + 1}" y="39" width="${w - 2}" height="4" fill="#f2d49b"/>
        <path d="M${x + 10} 43 q-4 -8 2 -16 M${x + 16} 43 q4 -10 -1 -20" class="ln" style="stroke:#2ecc71;stroke-width:2.5"/>
        <circle cx="${x + w - 14}" cy="22" r="2" fill="none" stroke="#fff"/><circle cx="${x + w - 11}" cy="16" r="1.5" fill="none" stroke="#fff"/>`;
      fishes.forEach(([fx, fy, c, dir]) => {
        s += `<ellipse cx="${x + fx}" cy="${fy}" rx="6" ry="3.6" fill="${c}" class="o thin"/>
          <path d="M${x + fx - 6 * dir} ${fy} l${-5 * dir} -4 v8Z" fill="${c}" class="o thin"/>
          <circle cx="${x + fx + 3 * dir}" cy="${fy - 1}" r=".9" fill="#23233a"/>`;
      });
      return s;
    };
    return `${tank(24, 130, [[40, 22, '#ff8c1a', 1], [90, 32, '#ffd93b', -1], [110, 20, '#ff5d8f', 1]])}
      ${tank(176, 92, [[40, 26, '#ff8c1a', -1], [64, 34, '#9b59b6', 1]])}
      <line x1="306" y1="18" x2="346" y2="18" class="ln" style="stroke:#8a5a33;stroke-width:3"/><line x1="326" y1="18" x2="326" y2="54" class="ln"/>
      <ellipse cx="320" cy="11" rx="7" ry="9" fill="#2ecc71" ${O}/><circle cx="322" cy="4" r="5" fill="#e74c3c" ${O}/>
      <path d="M326 4 l5 2 l-5 2Z" fill="#f1c40f" ${O}/><circle cx="323" cy="3" r="1" fill="#23233a"/>
      <path d="M315 18 l-3 7 l5 -2Z" fill="#3498db" ${O}/>
      ${tank(392, 136, [[30, 24, '#ff8c1a', 1], [70, 30, '#2ecc71', -1], [104, 20, '#ffd93b', 1]])}
      <rect x="552" y="40" width="44" height="14" fill="#d9a85b" ${O}/>
      <ellipse cx="574" cy="38" rx="11" ry="7" fill="#f5deb3" ${O}/>
      <circle cx="580" cy="30" r="7" fill="#f5deb3" ${O}/>
      <ellipse cx="574" cy="30" rx="3" ry="6" fill="#a0522d" ${O}/><ellipse cx="586" cy="30" rx="3" ry="6" fill="#a0522d" ${O}/>
      <circle cx="578" cy="29" r="1" fill="#23233a"/><circle cx="583" cy="29" r="1" fill="#23233a"/><circle cx="580.5" cy="33" r="1.5" fill="#23233a"/>`;
  } },
  0: { name: 'lobby', wall: '#efe3c8', floor: '#c9c2b4', art: () => {
    let tiles = ''; for (let x = 0; x <= 640; x += 32) tiles += `<line x1="${x}" y1="54" x2="${x - 8}" y2="64" stroke="#a9a294" stroke-width="1"/>`;
    return `${tiles}
      <rect x="16" y="6" width="104" height="48" fill="#bfe6ff" ${O}/>
      <path d="M68 6 V54" class="ln"/><path d="M44 54 A24 6 0 0 1 92 54" class="ln"/>
      <path d="M26 46 L40 14 M84 44 L98 14" class="ln" style="stroke:#fff;stroke-width:3"/>
      ${plant(144, '#2b3a55')}
      <rect x="160" y="55" width="300" height="5" fill="#c0392b"/>
      <rect x="236" y="7" width="128" height="14" rx="3" fill="#2b3a55" ${O}/>
      <text x="300" y="18" text-anchor="middle" font-size="11" fill="#ffcf5a">LOBBY</text>
      ${person(330, '#2b3a55')}
      <rect x="244" y="34" width="120" height="20" fill="#8a5a33" ${O}/><rect x="240" y="30" width="128" height="5" rx="2" fill="#a8743e" ${O}/>
      <path d="M266 30 a6 6 0 0 1 12 0Z" fill="#f1c40f" ${O}/><circle cx="272" cy="23" r="1.5" fill="#f1c40f"/>
      ${lamp(430)}${lamp(500)}
      <circle cx="470" cy="26" r="8" fill="#fff" ${O}/><path d="M470 21 V26 H474" class="ln"/>
      <rect x="524" y="6" width="104" height="48" fill="#bfe6ff" ${O}/><path d="M576 6 V54 M524 30 H628" class="ln"/>
      ${plant(512, '#2b3a55')}`;
  } },
  '-1': { name: 'parking garage', wall: '#9aa0a8', floor: '#5a5f68', art: () => {
    let stripes = ''; for (let x = 20; x < 640; x += 90) stripes += `<rect x="${x}" y="58" width="40" height="3" fill="#ffd400"/>`;
    const car = (x, c) => `<path d="M${x} 50 V41 q2 -8 12 -9 l11 -10 h30 l12 10 q14 1 16 9 V50Z" fill="${c}" ${O}/>
      <path d="M${x + 27} 31 l7 -7 h11 v7Z M${x + 50} 31 v-7 h9 l7 7Z" fill="#cfefff" ${O}/>
      <circle cx="${x + 18}" cy="50" r="6.5" fill="#222" ${O}/><circle cx="${x + 18}" cy="50" r="2.5" fill="#bbb"/>
      <circle cx="${x + 66}" cy="50" r="6.5" fill="#222" ${O}/><circle cx="${x + 66}" cy="50" r="2.5" fill="#bbb"/>
      <rect x="${x + 80}" y="38" width="5" height="3" fill="#ffe14d"/>`;
    const pillar = x => `<rect x="${x}" y="0" width="20" height="54" fill="#c5cad1" ${O}/>
      <path d="M${x} 46 l8 -8 M${x + 6} 54 l14 -14 M${x + 16} 54 l4 -4" class="ln" style="stroke:#ffd400;stroke-width:4"/>`;
    return `${stripes}${car(50, '#e63946')}${pillar(200)}
      <circle cx="210" cy="16" r="7" fill="#2d6bb5" ${O}/><text x="210" y="20" text-anchor="middle" font-size="10" fill="#fff">P</text>
      ${car(260, '#3a86ff')}${pillar(400)}${car(450, '#2ecc71')}`;
  } },
  '-2': { name: 'laundry room', wall: '#cdeeff', floor: '#dfe4ea', art: () => {
    const washer = (x, swirl) => `<rect x="${x}" y="22" width="36" height="32" rx="3" fill="#fff" ${O}/>
      <line x1="${x}" y1="29" x2="${x + 36}" y2="29" class="ln thin"/><circle cx="${x + 29}" cy="25.5" r="2" fill="#e74c3c"/>
      <circle cx="${x + 18}" cy="42" r="9" fill="#8fd3ff" ${O}/><path d="M${x + 12} 44 q6 -8 12 0" class="ln" style="stroke:${swirl};stroke-width:3"/>`;
    const sock = (x, c) => `<path d="M${x} 13 v10 h5 v3 h-9 v-13Z" fill="${c}" class="o thin"/>`;
    const shirt = (x, c) => `<path d="M${x} 13 l-6 4 l3 4 l3 -2 v12 h14 v-12 l3 2 l3 -4 l-6 -4Z" fill="${c}" class="o thin"/>`;
    return `${washer(30, '#e74c3c')}${washer(68, '#2ecc71')}${washer(106, '#f1c40f')}${washer(144, '#9b59b6')}
      <path d="M232 10 Q330 18 428 10" class="ln thin"/>
      ${sock(250, '#ff5d8f')}${shirt(280, '#3a86ff')}${sock(320, '#2ecc71')}${shirt(350, '#ffb627')}${sock(395, '#9b59b6')}
      <path d="M466 36 h44 l-5 18 h-34Z" fill="#d9a85b" ${O}/>
      <path d="M470 36 q8 -8 16 0 q8 -10 18 0" fill="#ff8fab" ${O}/>
      <rect x="550" y="32" width="18" height="22" rx="4" fill="#06d6a0" ${O}/><rect x="554" y="27" width="10" height="6" fill="#fff" ${O}/>
      <circle cx="530" cy="20" r="4" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="540" cy="12" r="3" fill="none" stroke="#fff" stroke-width="1.5"/>
      <circle cx="596" cy="46" r="6" fill="#ffe14d" ${O}/><circle cx="600" cy="38" r="4.5" fill="#ffe14d" ${O}/><path d="M604 38 l4 1 l-4 1.5Z" fill="#ff8c1a"/>`;
  } },
  '-3': { name: 'boiler room', wall: '#6b4636', floor: '#3d3330', art: () => `
      <path d="M0 18 H640 M0 36 H640" stroke="#5a3a2c" stroke-width="2"/>
      <path d="M90 10 V4 H600 M150 4 V54 M600 4 V54" fill="none" stroke="#23233a" stroke-width="8" stroke-linecap="round"/>
      <path d="M90 10 V4 H600 M150 4 V54 M600 4 V54" fill="none" stroke="#9aa3ad" stroke-width="5" stroke-linecap="round"/>
      <rect x="58" y="10" width="64" height="44" rx="14" fill="#c0563a" ${O}/>
      <circle cx="90" cy="23" r="7" fill="#fff" ${O}/><path d="M90 23 L94 19" class="ln"/>
      <rect x="78" y="34" width="24" height="14" rx="3" fill="#3a1d10" ${O}/><ellipse cx="90" cy="44" rx="8" ry="3" fill="#ff9a2e"/>
      <circle cx="150" cy="30" r="7" fill="none" class="o" style="stroke:#e63946;stroke-width:3"/><path d="M143 30 h14 M150 23 v14" class="ln" style="stroke:#e63946"/>
      <circle cx="260" cy="16" r="6" fill="#eee" opacity=".7"/><circle cx="270" cy="12" r="8" fill="#eee" opacity=".6"/><circle cx="283" cy="15" r="6" fill="#eee" opacity=".5"/>
      <rect x="320" y="20" width="60" height="34" rx="4" fill="#8a9099" ${O}/><rect x="326" y="26" width="48" height="10" fill="#2b3a55" ${O}/>
      <circle cx="334" cy="44" r="3" fill="#2ecc71"/><circle cx="344" cy="44" r="3" fill="#f1c40f"/><circle cx="354" cy="44" r="3" fill="#e74c3c"/>
      <rect x="470" y="12" width="34" height="28" rx="2" fill="#b0b6bf" ${O}/>
      <path d="M490 16 l-7 10 h6 l-4 10 l10 -13 h-6 l4 -7Z" fill="#ffd400" ${O}/>
      <ellipse cx="546" cy="50" rx="9" ry="5" fill="#9aa0a8" ${O}/><circle cx="554" cy="47" r="4" fill="#9aa0a8" ${O}/>
      <circle cx="553" cy="43" r="2.5" fill="#ffb3c1" ${O}/><path d="M537 51 q-8 2 -10 -4" class="ln thin"/><circle cx="555" cy="46.5" r=".8" fill="#23233a"/>`
  },
  '-4': { name: 'storage room', wall: '#b0916a', floor: '#7a6447', art: () => {
    const box = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#d9a85b" ${O}/><rect x="${x + w / 2 - 3}" y="${y}" width="6" height="${h}" fill="#f2d49b"/>`;
    return `<path d="M0 0 L30 0 M0 0 L0 26 M0 0 L26 22 M0 12 Q10 10 14 0 M0 20 Q18 18 24 0" class="ln thin" style="stroke:#eee"/>
      ${box(40, 34, 32, 20)}${box(74, 34, 32, 20)}${box(56, 16, 32, 18)}${box(140, 28, 44, 26)}
      <rect x="222" y="30" width="30" height="24" fill="#a8743e" ${O}/><path d="M222 30 L252 54 M252 30 L222 54" class="ln"/>
      <line x1="330" y1="0" x2="330" y2="10" class="ln"/><circle cx="330" cy="14" r="5" fill="#fff3a0" ${O}/>
      <circle cx="296" cy="44" r="10" class="ln"/><circle cx="346" cy="44" r="10" class="ln"/>
      <path d="M296 44 L314 30 L338 30 L346 44 M314 30 L322 44 L338 30 M312 26 h6 M338 30 l2 -6 h6" class="ln" style="stroke:#3a86ff;stroke-width:2.5"/>
      ${box(420, 36, 40, 18)}
      <path d="M432 36 v-4 h16 v4 M434 32 q-8 -12 6 -14 h0 q14 2 6 14" fill="#f1c40f" ${O}/>
      <rect x="500" y="10" width="50" height="44" fill="#8a5a33" ${O}/><path d="M500 24 h50 M500 39 h50" class="ln"/>
      ${box(506, 27, 16, 12)}${box(526, 12, 18, 12)}
      <line x1="610" y1="0" x2="610" y2="20" class="ln thin" style="stroke:#eee"/><circle cx="610" cy="22" r="3" fill="#23233a"/>
      <path d="M606 20 l-3 -2 M606 23 l-3 2 M614 20 l3 -2 M614 23 l3 2" class="ln thin"/>`;
  } },
  '-5': { name: 'secret lab', wall: '#24404c', floor: '#18272d', art: () => `
      <rect x="52" y="4" width="40" height="6" fill="#8a9099" ${O}/><rect x="52" y="48" width="40" height="6" fill="#8a9099" ${O}/>
      <rect x="56" y="10" width="32" height="38" rx="6" fill="#3dff9a" opacity=".85" ${O}/>
      <ellipse cx="72" cy="32" rx="9" ry="10" fill="#9b59b6" ${O}/>
      <circle cx="69" cy="30" r="2.6" fill="#fff"/><circle cx="76" cy="30" r="2.6" fill="#fff"/><circle cx="69.5" cy="30.5" r="1.2" fill="#23233a"/><circle cx="76.5" cy="30.5" r="1.2" fill="#23233a"/>
      <circle cx="64" cy="18" r="1.6" fill="#fff"/><circle cx="82" cy="24" r="1.2" fill="#fff"/>
      <rect x="170" y="36" width="190" height="4" fill="#b0b6bf" ${O}/><path d="M176 40 V54 M354 40 V54" class="ln"/>
      <path d="M196 36 v-7 l-6 -10 h14 l-6 10" fill="#ff4fd8" ${O}/>
      <path d="M226 36 v-16 h10 v16Z" fill="#00e5ff" ${O}/>
      <path d="M258 36 a10 10 0 0 1 4 -18 v-6 h6 v6 a10 10 0 0 1 4 18Z" fill="#ffd400" ${O}/>
      <rect x="290" y="22" width="40" height="14" rx="3" fill="#e9f1f7" ${O}/><circle cx="300" cy="29" r="3" fill="#e74c3c"/><circle cx="310" cy="29" r="3" fill="#2ecc71"/>
      <rect x="410" y="6" width="110" height="30" rx="3" fill="#0b1a20" ${O}/>
      <path d="M416 22 L430 22 L436 12 L444 32 L452 18 L460 26 L476 26 L484 14 L492 28 L514 22" class="ln" style="stroke:#3dff9a;stroke-width:1.6"/>
      <rect x="430" y="36" width="70" height="18" fill="#3b5560" ${O}/>
      <rect x="574" y="26" width="26" height="28" rx="4" fill="#b0b6bf" ${O}/>
      <rect x="578" y="10" width="18" height="16" rx="3" fill="#cfd6de" ${O}/>
      <circle cx="583" cy="18" r="2.5" fill="#00e5ff"/><circle cx="591" cy="18" r="2.5" fill="#00e5ff"/>
      <line x1="587" y1="10" x2="587" y2="3" class="ln"/><circle cx="587" cy="3" r="2" fill="#e74c3c"/>
      <rect x="580" y="34" width="14" height="6" fill="#ffd400"/>`
  },
  '-6': { name: 'dinosaur dig', wall: '#8a6a4a', floor: '#6a4f36', art: () => {
    seed = 5; let spots = '';
    for (let i = 0; i < 26; i++) spots += `<ellipse cx="${Math.floor(srand() * 640)}" cy="${Math.floor(srand() * 50)}" rx="${3 + srand() * 5}" ry="${2 + srand() * 3}" fill="#755838"/>`;
    const bone = '#f3ead2';
    let ribs = ''; for (let x = 252; x <= 352; x += 14) ribs += `<path d="M${x} ${24 - (x - 300) * 0.02} q4 10 0 18" fill="none" stroke="#23233a" stroke-width="5" stroke-linecap="round"/><path d="M${x} ${24 - (x - 300) * 0.02} q4 10 0 18" fill="none" stroke="${bone}" stroke-width="3" stroke-linecap="round"/>`;
    const spine = 'M180 40 Q220 34 250 24 Q300 14 360 22 Q400 28 430 20';
    const legs = 'M266 30 L262 54 M262 54 h-8 M346 30 L352 54 M352 54 h8';
    return `${spots}
      <path d="${spine}" fill="none" stroke="#23233a" stroke-width="7" stroke-linecap="round"/><path d="${spine}" fill="none" stroke="${bone}" stroke-width="4.5" stroke-linecap="round"/>
      ${ribs}
      <path d="${legs}" fill="none" stroke="#23233a" stroke-width="7" stroke-linecap="round"/><path d="${legs}" fill="none" stroke="${bone}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M428 14 q14 -6 30 2 q8 4 4 10 l-12 1 l2 4 h-10 q-14 -2 -14 -17Z" fill="${bone}" ${O}/>
      <circle cx="444" cy="16" r="3" fill="#6a4f36"/><path d="M448 27 l2 3 l2 -3 l2 3" class="ln thin"/>
      <line x1="60" y1="54" x2="80" y2="16" class="ln" style="stroke:#8a5a33;stroke-width:3.5"/><path d="M54 54 q-2 -10 6 -12 l8 3 q2 8 -4 12Z" fill="#9aa3ad" ${O}/>
      <rect x="102" y="38" width="14" height="16" rx="3" fill="#2b3a55" ${O}/><circle cx="109" cy="45" r="4.5" fill="#ffd400"/>
      <circle cx="109" cy="45" r="10" fill="#ffd400" opacity=".25"/>
      ${person(520, '#e9c46a', '#f5c9a0', '#7a4a2a')}
      <path d="M509 20 h22 l-4 -6 h-14Z" fill="#c9a26b" ${O}/>
      <path d="M528 32 L548 24" class="ln" style="stroke:#8a5a33;stroke-width:3"/><path d="M544 18 q8 4 10 12" class="ln" style="stroke:#9aa3ad;stroke-width:3"/>`;
  } },
  '-7': { name: 'treasure vault', wall: '#50505e', floor: '#38383f', art: () => {
    let rivets = ''; for (let x = 10; x < 640; x += 30) rivets += `<circle cx="${x}" cy="5" r="1.6" fill="#8a8a9a"/>`;
    return `${rivets}
      <circle cx="90" cy="30" r="22" fill="#b8bec9" ${O}/><circle cx="90" cy="30" r="15" fill="#9aa3ad" ${O}/>
      <path d="M90 18 V42 M78 30 H102 M81 21 L99 39 M99 21 L81 39" class="ln" style="stroke-width:2.5"/><circle cx="90" cy="30" r="4" fill="#f1c40f" ${O}/>
      <path d="M168 4 L250 50 M200 4 L282 50 M600 4 L520 50" stroke="#ff2e4d" stroke-width="1.4" opacity=".8"/>
      <path d="M240 54 q30 -32 80 -30 q50 -2 80 30Z" fill="#f5c542" ${O}/>
      <g fill="#ffd95e" class="o thin"><circle cx="290" cy="34" r="4"/><circle cx="320" cy="28" r="4"/><circle cx="350" cy="34" r="4"/><circle cx="305" cy="44" r="4"/><circle cx="336" cy="42" r="4"/><circle cx="270" cy="46" r="4"/><circle cx="372" cy="46" r="4"/></g>
      <path d="M312 18 l6 -6 h6 l6 6 l-9 10Z" fill="#ff5d8f" ${O}/>
      <g fill="#f1c40f" class="o"><path d="M440 54 l4 -8 h22 l4 8Z"/><path d="M472 54 l4 -8 h22 l4 8Z"/><path d="M456 46 l4 -8 h22 l4 8Z"/></g>
      <rect x="556" y="34" width="28" height="20" fill="#2b2b36" ${O}/>
      <path d="M560 26 l6 -8 h8 l6 8 l-10 10Z" fill="#8fe9ff" ${O}/><path d="M560 26 h20 M566 18 l4 18 M574 18 l-4 18" class="ln thin"/>`;
  } },
  '-8': { name: 'lava cave', wall: '#3a1f1c', floor: '#ff6a1a', art: () => `
      <rect x="0" y="50" width="640" height="14" fill="#ff6a1a"/>
      <ellipse cx="320" cy="50" rx="340" ry="10" fill="#ffb627" opacity=".35"/>
      <circle cx="200" cy="56" r="3" fill="#ffe14d"/><circle cx="430" cy="58" r="2.5" fill="#ffe14d"/><circle cx="560" cy="55" r="3.5" fill="#ffe14d"/>
      <path d="M0 0 h640 v6 l-20 6 l-14 -4 l-30 8 l-20 -6 l-40 5 l-30 -3 l-50 6 l-40 -5 l-60 7 l-40 -4 l-50 6 l-40 -5 l-50 4 l-40 -6 l-30 5 l-20 -3 l-30 4 l-26 -4 V0Z" fill="#2a1512"/>
      <path d="M0 54 V34 q20 -6 50 -2 q30 4 50 0 l14 22Z" fill="#5a4038" ${O}/>
      <g fill="#b06bff" class="o"><path d="M40 34 l5 -18 l6 18Z"/><path d="M52 32 l4 -12 l5 12Z"/><path d="M28 34 l3 -10 l4 10Z"/></g>
      <path d="M250 54 l6 -14 h108 l6 14Z" fill="#5a4038" ${O}/>
      <ellipse cx="310" cy="32" rx="15" ry="10" fill="#6b4a3a" ${O}/>
      <ellipse cx="324" cy="34" rx="4" ry="3" fill="#ffb3c1" ${O}/>
      <path d="M297 24 a14 10 0 0 1 26 0Z" fill="#ffd400" ${O}/><circle cx="310" cy="20" r="2.5" fill="#fff" ${O}/>
      <circle cx="316" cy="29" r="1.2" fill="#23233a"/>
      <path d="M298 38 l-4 4 M322 38 l4 4" class="ln" style="stroke:#ffb3c1;stroke-width:3"/>
      <path d="M526 54 l10 -22 q30 -6 60 0 l30 22Z" fill="#5a4038" ${O}/>
      <g fill="#3ce0ff" class="o"><path d="M560 32 l5 -20 l6 20Z"/><path d="M574 32 l4 -14 l5 14Z"/><path d="M548 32 l3 -10 l4 10Z"/></g>
      <path d="M150 50 q4 -12 8 0 q4 -8 6 0" fill="#ffb627"/><path d="M450 50 q4 -14 8 0 q4 -9 7 0" fill="#ffb627"/>`
  }
};

const ROOF = `
  <circle cx="560" cy="18" r="11" fill="#ffd93b" class="o"/>
  <g fill="#fff" opacity=".95"><ellipse cx="70" cy="16" rx="18" ry="6"/><ellipse cx="86" cy="12" rx="12" ry="7"/><ellipse cx="420" cy="12" rx="16" ry="5"/><ellipse cx="434" cy="9" rx="10" ry="5"/></g>
  <rect x="0" y="54" width="640" height="10" fill="#6c7380"/><path d="M0 54 H640" class="ln"/>
  <path d="M130 54 L136 34 M170 54 L164 34 M136 44 h28" class="ln"/>
  <rect x="128" y="18" width="44" height="18" rx="4" fill="#a8743e" class="o"/><path d="M126 18 L150 6 L174 18Z" fill="#8a5a33" class="o"/>
  <path d="M142 18 v18 M158 18 v18" class="ln thin"/>
  <rect x="240" y="20" width="160" height="26" rx="5" fill="#2b3a55" class="o"/>
  <path d="M260 46 V54 M380 46 V54" class="ln"/>
  <text x="320" y="38" text-anchor="middle" font-size="16" fill="#ffcf5a">ELEVATOR DROP</text>
  <path d="M470 54 V14 M462 54 L470 30 L478 54" class="ln"/><circle cx="470" cy="12" r="3" fill="#ff3b3b" class="o"/>
  <path d="M520 54 v-8 h20 v8" fill="#9aa3ad" class="o"/>`;

/* each drawing becomes an SVG image (rendered at 3x so it stays sharp on a Retina iPad), then painted onto the canvas */
const SVG_STYLE = '<style>.o{stroke:#23233a;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.ln{fill:none;stroke:#23233a;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.thin{stroke-width:1.2}text{font-family:"Baloo 2","Trebuchet MS",sans-serif;font-weight:800}</style>';
function svgImage(body) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 64" width="1920" height="192">${SVG_STYLE}${body}</svg>`);
  return img;
}
const ROOM_IMG = {}, ROOF_IMG = svgImage(ROOF);
for (let f = TOP; f >= BOTTOM; f--) { const r = ROOMS[f]; ROOM_IMG[f] = svgImage(`<rect width="640" height="64" fill="${r.wall}"/><rect y="54" width="640" height="10" fill="${r.floor}"/>${r.art()}<line x1="0" y1="54" x2="640" y2="54" stroke="#23233a" stroke-width="1.5" opacity=".6"/>`); }

/* brick facade above ground, packed soil below, as repeating patterns */
function pattern(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d')); return ctx.createPattern(c, 'repeat'); }
const BRICK = pattern(22, 11, c => { c.fillStyle = '#b85a3e'; c.fillRect(0, 0, 22, 11); c.fillStyle = '#8e3f2b'; c.fillRect(0, 0, 22, 2); c.fillRect(0, 0, 2, 11); });
const SOIL = pattern(34, 30, c => { c.fillStyle = '#6e4a30'; c.fillRect(0, 0, 34, 30); [[10, 12, 3, '#8a6243'], [24, 22, 4, '#553722'], [20, 6, 2, '#9a7150']].forEach(([x, y, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }); });

/* ---- the game ---- */
const LINE_FAMS = new Set(['add', 'sub', 'neg']);
const inBuilding = n => n >= BOTTOM && n <= TOP;
/* only facts whose start and answer are both floors of the building */
const lineFact = it => { if (!LINE_FAMS.has(it.fam)) return false; const o = FF.distract.parse(it); return !!o && inBuilding(o.a) && inBuilding(it.answer); };
let G = null, mode = 'title', lastT = 0, hover = null;

function newRound() { G = { t: 0, trip: 0, score: 0, combo: 0, best: 0, right: 0, wrong: 0, q: null, car: 0, ride: null, timer: null, flash: null, count: null, cursor: 0, kbd: false, say: '', sayBad: false, phase: 'idle', practiced: new Set() }; hover = null; K.sched.newSession(); }

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

function nextQuestion() {
  if (G.trip >= TRIPS) return end();
  const id = K.next(lineFact);
  if (!id) { G.phase = 'idle'; G.say = 'Turn on addition, subtraction or negatives in Settings'; return; }
  const it = FF.facts.ITEMS[id], o = FF.distract.parse(it), move = o.op === '+' ? o.b : o.op === '-' ? -o.b : 0;
  G.trip++; G.flash = null; G.count = null;
  G.q = { id, it, a: o.a, op: o.op, b: o.b, move, done: false, shownAt: null };
  if (G.car !== o.a) { G.phase = 'move'; G.say = `Going to floor ${fmt(o.a)}, the ${ROOMS[o.a].name}…`; G.sayBad = false; ride(o.a, rideTime(Math.abs(G.car - o.a)), ask); }
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
      K.sfx.good(); G.flash = { floor: n, good: true }; G.say = `Ding! The ${ROOMS[n].name}. +${pts}${fast ? ' fast!' : ''}`; G.sayBad = false;
      wait(.9, nextQuestion);
    } else {
      G.wrong++; G.combo = 0;
      K.sfx.bad(); G.flash = { floor: n, good: false }; G.say = explain(q); G.sayBad = true;
      wait(.7, () => { G.flash = null; ride(q.a, .5, () => wait(.3, () => stepRide(it.answer, () => { K.sfx.good(); G.flash = { floor: it.answer, good: true }; wait(1.4, nextQuestion); }))); });
    }
    if (K.goalReached() && !G.goalShown) { G.goalShown = true; K.sfx.goal(); }
  });
}

/* ---- input: drag over the floors to preview, release to choose; a plain tap works too. Arrow keys + Enter on a keyboard. ---- */
const canPick = () => mode === 'play' && G && G.q && G.phase === 'ask';
cv.addEventListener('pointerdown', ev => {
  if (!canPick()) return; K.audio();
  if (ev.clientX < L.bx0 - 16 || ev.clientX > L.bx1 + 16 || ev.clientY < L.by0 + L.roof - 4 || ev.clientY > L.by1 + 8) return;
  G.kbd = false; hover = floorAtY(ev.clientY); cv.setPointerCapture(ev.pointerId);
});
cv.addEventListener('pointermove', ev => { if (hover != null && canPick()) hover = floorAtY(ev.clientY); });
cv.addEventListener('pointerup', ev => { if (hover == null) return; hover = null; if (canPick()) answer(floorAtY(ev.clientY)); });
cv.addEventListener('pointercancel', () => { hover = null; });
document.addEventListener('keydown', ev => {
  if (!$('#overlay').hidden) { if (ev.key === 'Enter') { const b = $('#ovPlay') || $('#ovAgain') || $('#ovRes'); if (b) { b.click(); ev.preventDefault(); } } return; }
  if (ev.key === 'Escape' || ev.key === 'p') { $('#btnPause').click(); return; }
  if (!canPick()) return;
  if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); K.audio(); if (G.kbd) G.cursor = Math.max(BOTTOM, Math.min(TOP, G.cursor + (ev.key === 'ArrowUp' ? 1 : -1))); G.kbd = true; }
  else if ((ev.key === 'Enter' || ev.key === ' ') && G.kbd) { ev.preventDefault(); answer(G.cursor); }
});

/* ---- loop ---- */
function update(dt) {
  if (mode !== 'play') return;
  G.t += dt;
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
const C = { sky1: '#7cc8ff', sky2: '#c9ecff', ink: '#16263d', good: '#2fbf71', bad: '#ef5b5b', neg: '#4361ee', pos: '#1f7a6d', car: '#f2b632', car2: '#b9821a' };
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
/* like SVG preserveAspectRatio xMidYMax: wide boxes show the whole drawing ("meet"), narrow ones crop the sides ("slice") */
function paintSvg(img, x, y, w, h, bg) {
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); }
  if (!img.complete || !img.naturalWidth) return;
  const s = w / h >= 10 ? Math.min(w / 640, h / 64) : Math.max(w / 640, h / 64), dw = 640 * s, dh = 64 * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(img, x + (w - dw) / 2, y + h - dh, dw, dh); ctx.restore();
}
function draw() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.sky1); g.addColorStop(1, C.sky2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawGround();
  drawBuilding();
  if (G && (G.q || G.say)) drawPanel();
}
/* the ground runs the full width of the screen: a grass surface at the bottom of floor 0, soil below it */
function drawGround() {
  const gy = floorTop(0) + L.rh, gnd = L.gnd;
  const sg = ctx.createLinearGradient(0, gy, 0, H); sg.addColorStop(0, '#8a5b3a'); sg.addColorStop(1, '#4e3221'); ctx.fillStyle = sg; ctx.fillRect(0, gy, W, H - gy);
  ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = SOIL; ctx.fillRect(0, gy, W, H - gy); ctx.restore();
  ctx.fillStyle = '#55b04a'; ctx.fillRect(0, gy, W, gnd * .5); ctx.fillStyle = '#3c8a34'; ctx.fillRect(0, gy + gnd * .5, W, gnd * .15);
  ctx.fillStyle = '#55b04a'; for (let x = 4; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, gy + 1); ctx.lineTo(x + 3, gy - 6); ctx.lineTo(x + 6, gy + 1); ctx.fill(); }
}
function drawBuilding() {
  const { bx0, bx1, by0, by1, rh, roof, lw, sw, sx, rx0, rx1, gnd } = L, play = G && mode !== 'title';
  ctx.save(); rr(bx0, by0, bx1 - bx0, by1 - by0, 22); ctx.clip();
  const sg = ctx.createLinearGradient(0, by0, 0, by1); sg.addColorStop(0, C.sky1); sg.addColorStop(1, C.sky2); ctx.fillStyle = sg; ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  // roof
  ctx.fillStyle = '#6c7380'; ctx.fillRect(bx0, by0 + roof * (1 - .156), bx1 - bx0, roof * .156 + 1);
  paintSvg(ROOF_IMG, bx0, by0, bx1 - bx0, roof);
  const sel = !play ? null : hover != null ? hover : G.kbd && G.phase === 'ask' ? G.cursor : null;
  for (let n = TOP; n >= BOTTOM; n--) {
    const y = floorTop(n), under = n < 0, r = ROOMS[n];
    ctx.fillStyle = under ? SOIL : BRICK; ctx.fillRect(bx0, y, bx1 - bx0, rh);
    // the room, framed by a beam above
    paintSvg(ROOM_IMG[n], rx0, y, rx1 - rx0, rh, r.wall);
    ctx.fillStyle = under ? '#4a3524' : '#5d6470'; ctx.fillRect(rx0, y, rx1 - rx0, 3); ctx.fillRect(rx0, y + rh - 1, rx1 - rx0, 1);
    if (G && G.flash && G.flash.floor === n) { ctx.fillStyle = G.flash.good ? 'rgba(47,191,113,.5)' : 'rgba(239,91,91,.5)'; ctx.fillRect(rx0, y, rx1 - rx0, rh); ctx.strokeStyle = G.flash.good ? C.good : C.bad; ctx.lineWidth = 4; ctx.strokeRect(rx0 + 2, y + 2, rx1 - rx0 - 4, rh - 4); }
    if (sel === n) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(rx0, y, rx1 - rx0, rh); ctx.strokeStyle = C.car; ctx.lineWidth = 4; ctx.strokeRect(rx0 + 2, y + 2, rx1 - rx0 - 4, rh - 4); }
    // shaft cell with its two rails
    ctx.fillStyle = '#353b46'; ctx.fillRect(sx, y, sw, rh); ctx.fillStyle = '#4b5260'; ctx.fillRect(sx + 8, y, 3, rh); ctx.fillRect(sx + sw - 11, y, 3, rh); ctx.fillStyle = '#5d6470'; ctx.fillRect(sx, y, sw, 3);
    // floor number tag
    const fsz = Math.round(Math.min(18 * Math.min(1.25, U), rh * .5) * (sel === n ? 1.15 : 1)); ctx.font = `800 ${fsz}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const t = fmt(n), tw = Math.max(32, ctx.measureText(t).width + 12), th = fsz * 1.25, cx = bx0 + lw / 2, cy = y + rh / 2;
    ctx.fillStyle = sel === n ? '#ffd25e' : '#fff4d6'; ctx.strokeStyle = '#23233a'; ctx.lineWidth = 2; rr(cx - tw / 2, cy - th / 2, tw, th, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.fillText(t, cx, cy + fsz * .06);
  }
  // ground between 0 and −1
  const gy = floorTop(0) + rh; ctx.fillStyle = '#55b04a'; ctx.fillRect(bx0, gy, bx1 - bx0, gnd * .45); ctx.fillStyle = '#3c8a34'; ctx.fillRect(bx0, gy + gnd * .45, bx1 - bx0, gnd * .15); ctx.fillStyle = '#7a5236'; ctx.fillRect(bx0, gy + gnd * .6, bx1 - bx0, gnd * .4);
  // the car, hanging from its cable
  const f = G ? G.car : 0, fl = Math.min(TOP - 1, Math.floor(f)), cy = floorTop(fl) + (floorTop(fl + 1) - floorTop(fl)) * (f - fl), cx = sx + 6, cw = sw - 12, ch = rh - 6;
  ctx.fillStyle = '#1d2129'; ctx.fillRect(cx + cw / 2 - 1.5, by0 + roof, 3, cy + 4 - by0 - roof);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; rr(cx, cy + 7, cw, ch, 8); ctx.fill();
  const cg = ctx.createLinearGradient(0, cy + 4, 0, cy + 4 + ch); cg.addColorStop(0, '#ffd25e'); cg.addColorStop(1, C.car); ctx.fillStyle = cg; ctx.strokeStyle = C.car2; ctx.lineWidth = 3; rr(cx, cy + 4, cw, ch, 8); ctx.fill(); ctx.stroke();
  const es = Math.round(Math.min(ch * .7, 28 * U)); ctx.font = `${es}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(RIDER, cx + cw / 2, cy + 4 + ch / 2 + es * .05);
  // the floor display above the car
  const ds = Math.round(Math.max(12, 14 * U)); ctx.font = `800 ${ds}px ${FONT}`; const dt = fmt(Math.round(f)), dw = ctx.measureText(dt).width + 12, dh = ds * 1.4, dy = Math.max(by0 + 2, cy + 4 - dh - 2);
  ctx.fillStyle = '#111c2e'; rr(cx + cw / 2 - dw / 2, dy, dw, dh, 6); ctx.fill(); ctx.fillStyle = '#ffcf5a'; ctx.fillText(dt, cx + cw / 2, dy + dh / 2 + ds * .06);
  // the running count during a shown move
  if (G && G.count && G.count.k > 0) {
    const t = (G.count.dir > 0 ? '+' : '−') + G.count.k, fz = Math.round(Math.max(20, 26 * U)); ctx.font = `800 ${fz}px ${FONT}`;
    const w = ctx.measureText(t).width + fz, x = sx - 14 - w / 2, y = cy + 4 + ch / 2; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#23233a'; ctx.lineWidth = 2; rr(x - w / 2, y - fz * .7, w, fz * 1.4, fz * .7); ctx.fill(); ctx.stroke(); ctx.fillStyle = G.count.dir > 0 ? C.pos : C.neg; ctx.fillText(t, x, y + fz * .06);
  }
  ctx.restore();
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
window.__game = () => ({ G, mode, L, VERSION, floorTop });
})();
