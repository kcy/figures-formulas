/* Figures & Formulas — who is playing. Shared by the hub and every game.
 * The choice is remembered per device; ?player=name in the URL overrides it. */
(function (root) {
  'use strict';
  const CFG = root.FF_CONFIG || {};
  const PLAYERS = (CFG.players && CFG.players.length ? CFG.players : [CFG.player || 'player']).map(p => String(p).toLowerCase());
  const DEFAULT = PLAYERS.includes(CFG.player) ? CFG.player : PLAYERS[0];
  const urlPlayer = (() => { try { const p = new URLSearchParams(root.location.search).get('player'); return p && PLAYERS.includes(p.toLowerCase()) ? p.toLowerCase() : null; } catch (e) { return null; } })();
  const GUESTS = (CFG.guests || []).map(p => String(p).toLowerCase());
  const isGuest = p => GUESTS.includes(p);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function current() { const ls = root.FF.store.LocalStore; let p = urlPlayer || ls.currentPlayer(DEFAULT); if (!PLAYERS.includes(p)) p = DEFAULT; return p; }
  function set(p) { if (PLAYERS.includes(p)) root.FF.store.LocalStore.setPlayer(p); }
  root.FF = root.FF || {};
  root.FF.player = { PLAYERS, DEFAULT, FIRST: PLAYERS[0], current, set, cap, isGuest };
})(typeof window !== 'undefined' ? window : globalThis);
