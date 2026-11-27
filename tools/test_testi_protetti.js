// Prova (revisione-2 27/11/2026): testi e argomenti protetti in revisione/app.js. Nessuna rete.
// 1) rtEsc / rtJsArg / avvisi (solo icone ammesse) con testi ostili; 2) controllo statico: nomi, team, numeri, categorie e
// etichette inseriti nell'HTML senza protezione (eccezioni: contatori e indici numerici calcolati dall'app).
// Uso: node tools/test_testi_protetti.js [revisione/app.js]
'use strict';
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'revisione/app.js', 'utf8'), res = [];
const ck = (n, ok, info) => res.push((ok ? 'OK   ' : 'FALLITO ') + n + (info ? ' — ' + info : ''));
const grab = re => { const m = src.match(re); return m ? m[0] : ''; };
const defs = [grab(/function rtEsc\(x\)\{[^\n]*\}/), grab(/function rtJsArg\(x\)\{[^\n]*?\}/)].join('\n');
const safeSrc = grab(/const safe=x=>[^\n]*;/);
const ev = new Function(defs + '\n' + safeSrc.replace(/^const /, 'var ') + '\nreturn {rtEsc, rtJsArg, safe: typeof safe === "function" ? safe : null};')();
const bad = '<img src=x onerror=alert(1)>\'"&';
ck('rtEsc toglie i tag', !/<img/.test(ev.rtEsc(bad)));
ck('rtJsArg: nessun apice o virgoletta grezza dentro onclick', !/["']/.test(ev.rtJsArg(bad).replace(/&quot;|&#39;/g, '')));
ck('avvisi: tag ostile mostrato come testo', !!ev.safe && !/<img/.test(ev.safe('#19 ' + bad)), ev.safe ? ev.safe('#19 ' + bad).slice(0, 60) : 'manca il sanificatore');
ck('avvisi: icona ammessa resta', !!ev.safe && ev.safe('<i class="ic ic-flag"></i> PARTITA') === '<i class="ic ic-flag"></i> PARTITA');
ck('avvisi: icona con attributo extra NON ammessa', !!ev.safe && !/<i class="ic ic-flag" onclick/.test(ev.safe('<i class="ic ic-flag" onclick="x()"></i>')));
// controllo statico
const L = src.split('\n'), F = /(^|\.)(num|no|name|team|lastName|firstName|nm|label|cat|sess)$/, flagged = [];
const pat = /\+\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*(?=\+)/g;
L.forEach((l, i) => { if (!l.includes('<') || /^\s*\/\//.test(l)) return; let m; pat.lastIndex = 0;
  while ((m = pat.exec(l))) { const x = m[1], pre = l.slice(Math.max(0, m.index - 2), m.index);
    if (!F.test(x) || pre.endsWith("|'")) continue;   // pezzi di id ('...|'+x+'|')
    const ctx = l.slice(Math.max(0, m.index - 30), m.index);
    if (/rtAlert\(/.test(l.slice(0, m.index)) || /prompt\(|confirm\(|alert\(|catClass\($|getElementById\(/.test(ctx)) continue;   // non HTML (o avviso: protetto alla vista)
    flagged.push((i + 1) + ': ' + x + ' | ' + l.slice(Math.max(0, m.index - 40), m.index + 30).trim()); } });
const onq = (src.match(/onclick="[^"]*\\''\+(?!escAttr)/g) || []).length;
ck('onclick con argomenti tra apici non protetti', onq === 0, onq + ' trovati');
ck('nomi/team/numeri/categorie/etichette inseriti senza protezione', flagged.length === 0, flagged.length + (flagged.length ? ': ' + flagged.slice(0, 6).join(' || ') : ''));
console.log(res.join('\n')); console.log('prove:', res.length, '| fallite:', res.filter(r => r.startsWith('FALLITO')).length);
