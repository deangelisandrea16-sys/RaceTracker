// Prova (revisione-2 27/11/2026): caricamento entry list da file nell'app (revisione/app.js, funzione uploadEntryList).
// Nessuna rete e nessun database: la funzione viene estratta dal file ed eseguita con FileReader, conferma e scritture finti.
// Atteso: i campi a oggetto (result, out) si uniscono voce per voce; nessun campo esistente viene cancellato (niente null).
// Uso: node tools/test_upload_entry.js [revisione/app.js]
'use strict';
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2] || 'revisione/app.js', 'utf8');
const i = src.indexOf('function uploadEntryList('), j = src.indexOf('window.uploadEntryList', i);
const fn = src.slice(i, j);
const writes = [];
const ctx = {
  FileReader: class { readAsText(f) { this.onload({ target: { result: f.txt } }); } },
  confirm: () => true, alert: () => {}, closeModal() {}, rtCanDeleteRace: () => true, normCat: c => c,
  activeRaceId: 'race_T', currentEntryList: { '10': { num: '10', cat: 'KZ2', result: { 'A-B': '3', 'PF-A': '5' } } },
  ref: (db, p) => ({ p, once: async () => ({ val: () => ({ '10': {}, '11': {} }) }) }), db: null,
  update: async (r, u) => { writes.push(u); },
};
vm.createContext(ctx); vm.runInContext(fn, ctx);
const file = { txt: JSON.stringify({ '10': { num: '10', cat: 'KZ2', result: { 'Q-S1': '2' }, team: 'NUOVO', eliminated: null }, '11': { num: '11', cat: 'KZ2', lastName: 'ROSSI' } }) };
ctx.uploadEntryList({ target: { files: [file], value: '' } }, 'race_T');
setTimeout(() => {
  const u = writes[0] || {}, res = [];
  const ck = (n, ok, info) => res.push((ok ? 'OK   ' : 'FALLITO ') + n + (info ? ' — ' + info : ''));
  ck('result unito voce per voce (Q-S1 aggiunto, A-B/PF-A non toccati)', u['races/race_T/entryList/10/result/Q-S1'] === '2' && !('races/race_T/entryList/10/result' in u), Object.keys(u).filter(k => /\/10\//.test(k)).join(','));
  ck('nessun campo cancellato (null nel file ignorato)', !Object.values(u).some(v => v === null), JSON.stringify(u));
  ck('campi semplici scritti', u['races/race_T/entryList/10/team'] === 'NUOVO' && u['races/race_T/entryList/11/lastName'] === 'ROSSI');
  console.log(res.join('\n')); console.log('prove:', res.length, '| fallite:', res.filter(r => r.startsWith('FALLITO')).length);
}, 50);
