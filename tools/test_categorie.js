#!/usr/bin/env node
// Prova: le categorie vengono dall'entry list e non si fondono per somiglianza.   node tools/test_categorie.js [prova/app.js] [export.json]
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'prova', 'app.js'), 'utf8');
function fn(nome) { const m = new RegExp('^function ' + nome + '\\(', 'm').exec(src); if (!m) return ''; let i = src.indexOf('{', m.index), d = 0, q = null;
  for (; i < src.length; i++) { const c = src[i], n = src[i + 1]; if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); continue; } if (c === '/' && n === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; } if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(m.index, i + 1); } } return ''; }
const nuovo = /^function _catIndex\(/m.test(src);
const codice = (nuovo ? 'var _catIxSig=null,_catIx={perN:{},perVecchia:{}},_catAvvisi={};' : '') + ['_canonCatNomi', '_catN', '_catIndex', 'canonCat'].map(fn).join('\n') + '\n;globalThis.__c=canonCat;';
const mk = el => { const ctx = vm.createContext({ window: {}, dlog() {}, console }); vm.runInContext('var currentEntryList=' + JSON.stringify(el) + ';' + codice, ctx); return ctx; };
let ok = 0, ko = 0; const prova = (n, c, x) => { c ? ok++ : ko++; console.log((c ? '  ok  ' : '  NO  ') + n + (c || !x ? '' : '  → ' + x)); };
const el = (...cats) => Object.fromEntries(cats.map((c, i) => [100 + i, { num: String(100 + i), cat: c }]));
{ const c = mk(el('MINI 60', 'MINI ROK', 'X30 JUNIOR')).__c;
  prova('due categorie con "MINI" restano DUE', c('MINI 60') !== c('MINI ROK'), c('MINI 60') + ' / ' + c('MINI ROK'));
  prova('stesso nome scritto diverso = stessa categoria', c('mini-60') === c('MINI 60') && c('X30  Junior.') === c('X30 JUNIOR'));
  prova('nome ambiguo ("MINI") non viene attaccato a nessuna delle due', c('MINI') !== c('MINI 60') && c('MINI') !== c('MINI ROK')); }
{ const c = mk(el('MINI GR3', 'MINI U10', 'OK', 'OKJ', 'OKN', 'OK-NJ', 'KZ2')).__c;   // nomi di una gara vera: le scritte note devono continuare a funzionare
  prova('scritte diverse della stessa categoria ancora abbinate', c('MINI GR.3') === c('MINI GR3') && c('MINI GR.3 U10') === c('MINI U10') && c('OK-N JUNIOR') === c('OK-NJ') && c('OK JUNIOR') === c('OKJ') && c('OK-N') === c('OKN'));
  prova('categorie diverse restano diverse', new Set(['MINI GR3', 'MINI U10', 'OK', 'OKJ', 'OKN', 'OK-NJ', 'KZ2'].map(c)).size === 7); }
{ const ctx = mk(el('ALFA', 'BETA')); ctx.window._rtCatMap = { GAMMACUP: 'BETA' }; prova('abbinamento verificato dal server (catMap) usato', ctx.__c('Gamma Cup') === ctx.__c('BETA')); }
if (process.argv[3] && nuovo) { // dati veri: stesso risultato di prima su ogni coppia (categoria dell'entry list, altro nome), tranne dove prima si fondeva
  const db = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), v = vm.createContext({}); vm.runInContext(fn('_canonCatNomi') + ';globalThis.__v=_canonCatNomi;', v);
  let conf = 0; const diversi = [], fuse = [];
  for (const [id, g] of Object.entries(db.races || {})) { const elr = {}; for (const [k, e] of Object.entries(g.entryList || {})) if (e && typeof e === 'object') elr[k] = { num: k, cat: e.cat };
    const c = mk(elr).__c, catE = [...new Set(Object.values(elr).map(e => e.cat).filter(Boolean))], altri = new Set();
    for (const d of Object.values(g.schedule || {})) for (const s of (Array.isArray(d) ? d : Object.values(d || {}))) if (s && s.cat) altri.add(s.cat);
    for (const u of Object.values(g.users || {})) for (const p of Object.values((u && u.pilots) || {})) if (p && p.cat) altri.add(p.cat);
    for (const a of catE) for (const b of catE) if (a < b && v.__v(a) === v.__v(b)) fuse.push(id.slice(-6) + ': ' + a + ' + ' + b);
    for (const a of catE) for (const b of altri) { conf++; const prima = v.__v(a) === v.__v(b), ora = c(a) === c(b); if (prima !== ora) diversi.push(id.slice(-6) + ' ' + a + ' ~ ' + b + ': prima ' + prima + ', ora ' + ora); } }
  console.log('  dati veri: ' + conf + ' coppie categoria×nome, diverse da prima: ' + diversi.length + (fuse.length ? ' · categorie che prima si fondevano: ' + fuse.join('; ') : '')); diversi.slice(0, 8).forEach(x => console.log('     ' + x));
  prova('dati veri: nessun abbinamento perso rispetto a oggi', diversi.filter(x => /prima true, ora false/.test(x)).length === 0, diversi.filter(x => /prima true, ora false/.test(x)).slice(0, 3).join(' | ')); }
console.log(ok + ' riuscite, ' + ko + ' fallite'); process.exit(ko ? 1 : 0);
