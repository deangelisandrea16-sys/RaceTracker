#!/usr/bin/env node
// Prova: i gruppi non sono un elenco fisso. Gara con gruppi E-F-G-H, manche non ancora pubblicate:
// ogni pilota deve comparire nei turni del suo gruppo e solo in quelli.   node tools/test_gruppi.js [prova/app.js]
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'prova', 'app.js'), 'utf8');
function fn(nome) { const m = new RegExp('^function ' + nome + '\\(', 'm').exec(src); if (!m) return ''; let i = src.indexOf('{', m.index), d = 0, q = null;
  for (; i < src.length; i++) { const c = src[i], n = src[i + 1]; if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); continue; } if (c === '/' && n === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; } if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(m.index, i + 1); } } return ''; }
const codice = [/^const VALID_GROUPS=.*$/m.exec(src)[0], /^let _hpCache=.*$/m.exec(src)[0], 'var _oneSerieSrc=null,_oneSerieMap={};']
  .concat(['pHeats', 'raceGroups', 'normalizeGroup', 'canonCat', 'heatPublished', 'pilotInGroup', 'oneSerieOf', 'pSerie', 'pilotsForSlot'].map(fn)).join('\n')
  + '\n;globalThis.__api={pilotsForSlot,normalizeGroup,raceGroups:typeof raceGroups==="function"?raceGroups:null};';
const L = ['E', 'F', 'G', 'H'], el = {}, pilots = [];
for (let i = 0; i < 16; i++) { const n = String(100 + i); el[n] = { num: n, cat: 'CAT X', group: L[i % 4] }; pilots.push({ num: n, cat: 'CAT X', group: '', heats: [], eliminated: false }); }
const sched = { SABATO: [{ cat: 'CAT X', time: '9.00', type: 'group', filter: ['E', 'F'] }, { cat: 'CAT X', time: '9.20', type: 'group', filter: ['G', 'H'] }] };
const ctx = vm.createContext({ window: {}, console });
vm.runInContext('var currentEntryList=' + JSON.stringify(el) + ',currentSchedule=' + JSON.stringify(sched) + ',pilots=' + JSON.stringify(pilots) + ';' + codice, ctx);
let ok = 0, ko = 0; const prova = (n, c, x) => { c ? ok++ : ko++; console.log((c ? '  ok  ' : '  NO  ') + n + (c || !x ? '' : '  → ' + x)); };
const A = ctx.__api;
prova('gruppo F riconosciuto', A.normalizeGroup('f') === 'F', JSON.stringify(A.normalizeGroup('f')));
prova('gruppo H riconosciuto', A.normalizeGroup(' H ') === 'H');
prova('valori non validi rifiutati (AB, 1, vuoto)', A.normalizeGroup('AB') === '' && A.normalizeGroup('1') === '' && A.normalizeGroup('') === '');
for (const s of sched.SABATO) { const visti = A.pilotsForSlot(s).map(p => p.num).sort().join(','), attesi = Object.values(el).filter(e => s.filter.includes(e.group)).map(e => e.num).sort().join(',');
  prova('turno ' + s.filter.join('-') + ': mostra i piloti dei suoi gruppi e solo quelli', visti === attesi, 'visti [' + visti + '] attesi [' + attesi + ']'); }
prova('elenco dei gruppi preso dalla gara (E,F,G,H)', !!A.raceGroups && A.raceGroups().join(',') === 'E,F,G,H', A.raceGroups ? A.raceGroups().join(',') : 'funzione assente');
console.log(ok + ' riuscite, ' + ko + ' fallite'); process.exit(ko ? 1 : 0);
