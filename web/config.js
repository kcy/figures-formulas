/* Figures & Formulas — deployment settings. Edit this file, nothing else, to point the game at your Sheet.
 *
 *   endpoint  the Apps Script web-app URL (…/exec). Leave empty to play with browser storage only.
 *   key       the same shared key you put in the script's SECRET. Not bank-grade, just keeps strangers out.
 *   players   who can play; each gets their own progress, sessions, history and settings, locally and in the Sheet.
 *   player    the default when nobody has picked one on this device.
 *   guests    players whose progress stays on the device they play on and never goes to the Sheet.
 */
window.FF_CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbyofktiRdEuXn2xfZEvWtvV0ta3V2UHQBtKZv99zFWBABxa90eg6iwNeqk1YGpUfw11/exec',
  key: 'nabil-me',
  players: ['nabil', 'krishna', 'guest'],
  player: 'nabil',
  guests: ['guest']
};
