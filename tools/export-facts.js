#!/usr/bin/env node
/* Writes the generated knowledge set to facts.csv (same columns as the Sheet's Facts tab).
 * The game sends its catalog to the Sheet on first connect, so this is for looking at the set
 * or importing it by hand:   node tools/export-facts.js > facts.csv */
require('../web/js/facts.js');
const { ITEMS, ORDER } = globalThis.FF.facts;
const q = s => '"' + String(s).replace(/"/g, '""') + '"';
console.log(['id', 'prompt', 'answer', 'fam', 'op', 'layer', 'strategy', 'mode', 'enabled', 'custom'].join(','));
for (const id of ORDER) { const it = ITEMS[id]; console.log([q(it.id), q(it.prompt), it.answer, it.fam, it.op, it.layer, it.strategy, it.mode, 'TRUE', 'FALSE'].join(',')); }
