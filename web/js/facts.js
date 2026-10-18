/* Figures & Formulas — the knowledge set.
 *
 * Every fact is one row: { id, prompt, answer, fam, op, layer, strategy, mode, diff }.
 *   fam      drives the game (enemy type, speed target, settings toggle)
 *   op       add | sub | mul | div
 *   layer    1 core facts · 2 signed numbers · 3 strategies (bridging twenty, bigger tables)
 *   strategy the procedure a slow answer points at; stats roll up by this too
 *   mode     'typed' for now; 'choice' items come with layer 4 (number sense)
 *   diff     introduction order inside a family (lower = sooner; slip-prone facts first)
 *
 * The set is generated, not hand-written, so adding a layer is a code change here
 * and tools/export-facts.js turns it into a CSV for the Sheet.
 */
(function (root) {
  'use strict';

  const FAM = {
    add:    { name: 'Addition',            fast: 2.0, op: 'add', signed: false },
    sub:    { name: 'Subtraction',         fast: 2.5, op: 'sub', signed: false },
    neg:    { name: 'Negatives (+ / −)',   fast: 3.5, op: 'addsub', signed: true },
    mul:    { name: 'Multiplication',      fast: 3.0, op: 'mul', signed: false },
    div:    { name: 'Division',            fast: 3.5, op: 'div', signed: false },
    negmul: { name: 'Negatives (× / ÷)',   fast: 4.0, op: 'muldiv', signed: true }
  };

  const fmt = n => (n < 0 ? '−' + (-n) : String(n));
  const paren = n => (n < 0 ? '(' + fmt(n) + ')' : String(n));
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function addStrategy(a, b) {
    if (a === b) return 'doubles';
    if (Math.abs(a - b) === 1) return 'near_double';
    if (a === 10 || b === 10) return 'plus_ten';
    if (a + b > 10 && a < 10 && b < 10) return 'bridge_ten';
    if (a + b > 20) return 'bridge_twenty';
    return 'within_ten';
  }
  function subStrategy(c, b) {
    const r = c - b;
    if (b === r) return 'doubles';
    if (c > 20) return 'bridge_twenty';
    if (c > 10 && b < 10 && r < 10) return 'bridge_ten';
    if (b === 10 || r === 10) return 'minus_ten';
    return 'within_ten';
  }
  function mulStrategy(a, b) {
    if (a === b) return 'square';
    if (a === 10 || b === 10) return 'times_ten';
    if (a === 5 || b === 5) return 'times_five';
    if (a === 9 || b === 9) return 'times_nine';
    if (a === 2 || b === 2) return 'doubling';
    if (a > 10 || b > 10) return 'big_table';
    return 'table';
  }

  function build() {
    const items = {}, perFam = {};
    const put = (fam, prompt, answer, layer, strategy, diff) => {
      const id = fam + ':' + prompt;
      if (items[id]) return;
      items[id] = { id, prompt, answer, fam, op: FAM[fam].op, layer, strategy, mode: 'typed', diff };
      (perFam[fam] = perFam[fam] || []).push(id);
    };

    // Layer 1 — core addition and subtraction, operands 1–10
    for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) {
      const s = addStrategy(a, b);
      put('add', `${a} + ${b}`, a + b, 1, s, (a + b > 10 ? 0 : 40) + (20 - (a + b)) + (a === 1 || b === 1 ? 30 : 0) + (s === 'doubles' ? 20 : 0) + (s === 'plus_ten' ? 25 : 0));
    }
    for (let c = 2; c <= 20; c++) for (let b = 1; b <= 10; b++) {
      const r = c - b; if (r < 1 || r > 10) continue;
      { const s = subStrategy(c, b); put('sub', `${c} − ${b}`, r, 1, s, (c > 10 ? 0 : 40) + (20 - c) + (b === 1 || r === 1 ? 30 : 0) + (s === 'doubles' ? 20 : 0) + (s === 'minus_ten' ? 25 : 0)); }
    }
    // Layer 3 — bridging twenty: teens plus/minus single digits that cross 20
    for (let a = 11; a <= 19; a++) for (let b = 2; b <= 9; b++) {
      if (a + b > 20) put('add', `${a} + ${b}`, a + b, 3, 'bridge_twenty', 200 + (30 - a - b));
      const c = a + b; if (c > 20 && c <= 29) put('sub', `${c} − ${b}`, a, 3, 'bridge_twenty', 200 + (30 - c));
    }

    // Layer 2 — signed addition and subtraction, operands −10..10
    for (let a = -10; a <= 10; a++) for (let b = -10; b <= 10; b++) {
      if (a === 0 || b === 0 || (a > 0 && b > 0)) continue;
      const mag = 20 - Math.abs(a) - Math.abs(b);
      put('neg', `${fmt(a)} + ${paren(b)}`, a + b, 2, b < 0 ? 'add_negative' : 'negative_plus', (b < 0 ? 100 : 0) + mag);
      put('neg', `${fmt(a)} − ${paren(b)}`, a - b, 2, b < 0 ? 'subtract_negative' : 'negative_minus', (b < 0 ? 200 : 50) + mag);
    }

    // Layer 1 — times tables 2–12 and their divisions
    for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) {
      const s = mulStrategy(a, b), big = a > 10 || b > 10;
      put('mul', `${a} × ${b}`, a * b, big ? 3 : 1, s, (s === 'table' ? 0 : 40) + (24 - a - b) + (big ? 200 : 0));
      put('div', `${a * b} ÷ ${b}`, a, big ? 3 : 1, 'inverse_' + s, (s === 'table' ? 0 : 40) + (24 - a - b) + (big ? 200 : 0));
    }
    // Layer 2 — signed multiplication and division, tables 2–10
    for (let a = 2; a <= 10; a++) for (let b = 2; b <= 10; b++) {
      const mag = 20 - a - b;
      put('negmul', `${fmt(-a)} × ${b}`, -a * b, 2, 'neg_times_pos', mag);
      put('negmul', `${a} × ${paren(-b)}`, -a * b, 2, 'pos_times_neg', 20 + mag);
      put('negmul', `${fmt(-a)} × ${paren(-b)}`, a * b, 2, 'neg_times_neg', 60 + mag);
      put('negmul', `${fmt(-a * b)} ÷ ${b}`, -a, 2, 'neg_div_pos', 100 + mag);
      put('negmul', `${fmt(-a * b)} ÷ ${paren(-b)}`, a, 2, 'neg_div_neg', 140 + mag);
    }

    // Introduction order: within a family by diff, across families interleaved.
    for (const f in perFam) perFam[f].sort((x, y) => items[x].diff - items[y].diff || hash(x) - hash(y));
    const fams = Object.keys(perFam), order = [];
    let i = 0, left = Object.keys(items).length;
    while (left) { const f = fams[i++ % fams.length]; if (perFam[f].length) { order.push(perFam[f].shift()); left--; } }
    return { items, order };
  }

  const built = build();
  root.FF = root.FF || {};
  root.FF.facts = { FAM, ITEMS: built.items, ORDER: built.order, fmt, hash,
    /* Custom facts from the Sheet are added here at load time. */
    addCustom(rows) {
      for (const r of rows) {
        if (!r || !r.id || r.prompt == null || r.answer == null) continue;
        const fam = FAM[r.fam] ? r.fam : 'add';
        built.items[r.id] = { id: r.id, prompt: String(r.prompt), answer: Number(r.answer), fam, op: r.op || FAM[fam].op,
          layer: Number(r.layer) || 1, strategy: r.strategy || 'custom', mode: r.mode || 'typed', diff: Number(r.diff) || 0, custom: true };
        if (!built.order.includes(r.id)) built.order.push(r.id);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
