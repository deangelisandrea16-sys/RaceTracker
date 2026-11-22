/* Race Tracker — copia di prova: script principale (14/11/2026, punto 9: tolto dalla pagina unica).
   RT_JS_BUILD deve essere uguale ad APP_BUILD della pagina: se diverso, la pagina ricarica il file. */
var RT_JS_BUILD='2026-11-22-1240';
// ── Firebase Compat Shim: drop-in replacements for modular API ──
var _fbApp=firebase.initializeApp({apiKey:"AIzaSyB2t6Rm0x-LIMD8iWF_cAUXzdsBUCz6Byg",authDomain:"karting-tools.firebaseapp.com",databaseURL:"https://karting-tools-default-rtdb.firebaseio.com",projectId:"karting-tools",storageBucket:"karting-tools.firebasestorage.app",messagingSenderId:"199360301984",appId:"1:199360301984:web:50252111fe9b47231232c5"});
var _fbDb=firebase.database();
function ref(dbIgnored,path){return path?_fbDb.ref(path):_fbDb.ref();}
function onValue(r,cb,errOrOpts){
  if(typeof errOrOpts==='function'){r.on('value',cb,errOrOpts);}
  else if(errOrOpts&&errOrOpts.onlyOnce){r.once('value',cb);}
  else{r.on('value',cb);}
}
function update(r,data){return r.update(data);}
function set(r,data){return r.set(data);}
function off(r){r.off();}
// db variable used throughout the code — point to the compat database instance
var db=_fbDb;
// Override ref so ref(db,'path') works: db is ignored, path is used
var _origRef=ref;
ref=function(dbOrPath,path){
  if(typeof dbOrPath==='string'){return _fbDb.ref(dbOrPath);}
  return path?_fbDb.ref(path):_fbDb.ref();
};

// ── Firebase snap.val() array fix: compat may return objects for arrays ──
var _origOnValue=onValue;
onValue=function(r,cb,errOrOpts){
  var wrappedCb=function(snap){
    // Wrap snap to auto-convert object arrays
    var origVal=snap.val.bind(snap);
    snap.val=function(){
      var v=origVal();
      return _fixArrays(v);
    };
    cb(snap);
  };
  _origOnValue(r,wrappedCb,errOrOpts);
};
function _fixArrays(obj){
  if(obj===null||obj===undefined||typeof obj!=='object')return obj;
  if(Array.isArray(obj)){return obj.map(_fixArrays);}
  var keys=Object.keys(obj);
  if(!keys.length)return obj;
  // Only convert to array if ALL keys are numeric AND key "0" exists (Firebase array pattern)
  var isNumeric=keys.every(function(k){return/^\d+$/.test(k);});
  if(isNumeric&&obj.hasOwnProperty('0')){
    var maxIdx=Math.max.apply(null,keys.map(Number));
    // Dense check: no huge gaps (real arrays from Firebase are always dense)
    if(maxIdx<keys.length*3){
      var arr=[];
      for(var i=0;i<=maxIdx;i++){arr.push(obj[i]!==undefined?_fixArrays(obj[i]):null);}
      return arr.filter(function(x){return x!==null;});
    }
  }
  // Regular object — recurse into values
  var result={};
  keys.forEach(function(k){result[k]=_fixArrays(obj[k]);});
  return result;
}

// ── CONSTANTS ──
// 15/11/2026 (Andrea): PISTA per ultima, accanto alla pillola dei punti di scatto
const TASKS=["PADDOK","PREGRIGLIA","BILANCIA","REPORTAGE","PISTA"];
const STATUS_CYCLE=["red","green","orange"];
const ALL_TABS=['gare','piloti','programma','entrylist','gara','livetiming','debug'];

// ── DEBUG LOGGING (must be defined early) ──
let debugLogs=[];
function dlog(msg,type){
  type=type||'info';
  debugLogs.push({time:new Date().toLocaleTimeString(),msg,type});
  renderDebugLogs();
}
function renderDebugLogs(){
  const el=document.getElementById('debug-logs');if(!el)return;
  el.innerHTML=debugLogs.map(l=>{
    const colors={ok:'#22c55e',err:'#ef4444',warn:'#fbbf24',info:'var(--text4)'};
    const borderColors={ok:'#16a34a',err:'#dc2626',warn:'#d97706',info:'var(--border)'};
    return'<div style="background:var(--bg3);border:1px solid '+borderColors[l.type]+';border-radius:8px;padding:10px;margin-bottom:6px;font-size:11px;color:'+colors[l.type]+';word-break:break-all">'+l.time+' — '+l.msg+'</div>';
  }).join('');
  el.scrollTop=el.scrollHeight;
}
function renderDebug(){renderDebugLogs();}
// SCHEDULE_AND_ENTRY_PLACEHOLDER
/* 17/11/2026: data di oggi in ora locale (toISOString e' UTC: tra mezzanotte e l'una sbagliava giorno) */
function rtToday(){const d=new Date(),z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());}

// ── DEFAULT DATA (WSK Super Master Franciacorta — used as fallback) ──
const DAYS=["MERCOLEDÌ","GIOVEDÌ","VENERDÌ","SABATO","DOMENICA"];
const SCHEDULE={
  "MERCOLEDÌ":[
    {time:"8.00",cat:"KZ2",label:"KZ2",session:"PROVE LIBERE — Turno 1",type:"parity",filter:"ODD"},
    {time:"8.13",cat:"KZ2",label:"KZ2",session:"",type:"parity",filter:"EVEN"},
    {time:"8.26",cat:"OK",label:"OK",session:"",type:"parity",filter:"ODD"},
    {time:"8.39",cat:"OK",label:"OK",session:"",type:"parity",filter:"EVEN"},
    {time:"8.52",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"ODD"},
    {time:"9.05",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"EVEN"},
    {time:"9.18",cat:"MINI U10",label:"MINI U10",session:"",type:"all"},
    {time:"9.31",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"ODD"},
    {time:"9.44",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"EVEN"},
    {time:"9.57",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"ODD"},
    {time:"10.10",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"EVEN"},
    {time:"10.23",cat:"KZ2",label:"KZ2",session:"PROVE LIBERE — Turno 2",type:"parity",filter:"ODD"},
    {time:"10.36",cat:"KZ2",label:"KZ2",session:"",type:"parity",filter:"EVEN"},
    {time:"10.49",cat:"OK",label:"OK",session:"",type:"parity",filter:"ODD"},
    {time:"11.02",cat:"OK",label:"OK",session:"",type:"parity",filter:"EVEN"},
    {time:"11.15",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"ODD"},
    {time:"11.28",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"EVEN"},
    {time:"11.41",cat:"MINI U10",label:"MINI U10",session:"",type:"all"},
    {time:"11.54",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"ODD"},
    {time:"12.07",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"EVEN"},
    {time:"12.20",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"ODD"},
    {time:"12.33",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"EVEN"},
    {time:"13.25",cat:"KZ2",label:"KZ2",session:"PROVE LIBERE — Turno 3",type:"parity",filter:"ODD"},
    {time:"13.38",cat:"KZ2",label:"KZ2",session:"",type:"parity",filter:"EVEN"},
    {time:"13.51",cat:"OK",label:"OK",session:"",type:"parity",filter:"ODD"},
    {time:"14.04",cat:"OK",label:"OK",session:"",type:"parity",filter:"EVEN"},
    {time:"14.17",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"ODD"},
    {time:"14.30",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"EVEN"},
    {time:"14.43",cat:"MINI U10",label:"MINI U10",session:"",type:"all"},
    {time:"14.56",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"ODD"},
    {time:"15.09",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"EVEN"},
    {time:"15.22",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"ODD"},
    {time:"15.35",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"EVEN"},
    {time:"15.48",cat:"KZ2",label:"KZ2",session:"PROVE LIBERE — Turno 4",type:"parity",filter:"ODD"},
    {time:"16.01",cat:"KZ2",label:"KZ2",session:"",type:"parity",filter:"EVEN"},
    {time:"16.14",cat:"OK",label:"OK",session:"",type:"parity",filter:"ODD"},
    {time:"16.27",cat:"OK",label:"OK",session:"",type:"parity",filter:"EVEN"},
    {time:"16.40",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"ODD"},
    {time:"16.53",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"EVEN"},
    {time:"17.10",cat:"MINI U10",label:"MINI U10",session:"",type:"all"},
    {time:"17.23",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"ODD"},
    {time:"17.36",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"EVEN"},
    {time:"17.49",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"ODD"},
    {time:"18.02",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"EVEN"}
  ],
  "GIOVEDÌ":[
    {time:"8.00",cat:"KZ2",label:"KZ2",session:"PROVE LIBERE — Turno 1",type:"parity",filter:"ODD"},
    {time:"8.13",cat:"KZ2",label:"KZ2",session:"",type:"parity",filter:"EVEN"},
    {time:"8.26",cat:"OK",label:"OK",session:"",type:"parity",filter:"ODD"},
    {time:"8.39",cat:"OK",label:"OK",session:"",type:"parity",filter:"EVEN"},
    {time:"8.52",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"ODD"},
    {time:"9.05",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"EVEN"},
    {time:"9.18",cat:"MINI U10",label:"MINI U10",session:"",type:"all"},
    {time:"9.31",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"ODD"},
    {time:"9.44",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"EVEN"},
    {time:"9.57",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"ODD"},
    {time:"10.10",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"EVEN"},
    {time:"10.23",cat:"KZ2",label:"KZ2",session:"PROVE LIBERE — Turno 2",type:"parity",filter:"ODD"},
    {time:"10.36",cat:"KZ2",label:"KZ2",session:"",type:"parity",filter:"EVEN"},
    {time:"10.49",cat:"OK",label:"OK",session:"",type:"parity",filter:"ODD"},
    {time:"11.02",cat:"OK",label:"OK",session:"",type:"parity",filter:"EVEN"},
    {time:"11.15",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"ODD"},
    {time:"11.28",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"EVEN"},
    {time:"11.41",cat:"MINI U10",label:"MINI U10",session:"",type:"all"},
    {time:"11.54",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"ODD"},
    {time:"12.07",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"EVEN"},
    {time:"12.20",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"ODD"},
    {time:"12.33",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"EVEN"},
    {time:"13.25",cat:"KZ2",label:"KZ2",session:"PROVE LIBERE — Turno 3",type:"parity",filter:"ODD"},
    {time:"13.38",cat:"KZ2",label:"KZ2",session:"",type:"parity",filter:"EVEN"},
    {time:"13.51",cat:"OK",label:"OK",session:"",type:"parity",filter:"ODD"},
    {time:"14.04",cat:"OK",label:"OK",session:"",type:"parity",filter:"EVEN"},
    {time:"14.17",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"ODD"},
    {time:"14.30",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"EVEN"},
    {time:"14.43",cat:"MINI U10",label:"MINI U10",session:"",type:"all"},
    {time:"14.56",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"ODD"},
    {time:"15.09",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"EVEN"},
    {time:"15.22",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"ODD"},
    {time:"15.35",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"EVEN"},
    {time:"15.48",cat:"KZ2",label:"KZ2",session:"PROVE LIBERE — Turno 4",type:"parity",filter:"ODD"},
    {time:"16.01",cat:"KZ2",label:"KZ2",session:"",type:"parity",filter:"EVEN"},
    {time:"16.14",cat:"OK",label:"OK",session:"",type:"parity",filter:"ODD"},
    {time:"16.27",cat:"OK",label:"OK",session:"",type:"parity",filter:"EVEN"},
    {time:"16.40",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"ODD"},
    {time:"16.53",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"EVEN"},
    {time:"17.10",cat:"MINI U10",label:"MINI U10",session:"",type:"all"},
    {time:"17.23",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"ODD"},
    {time:"17.36",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"EVEN"},
    {time:"17.49",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"ODD"},
    {time:"18.02",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"EVEN"}
  ],
  "VENERDÌ":[
    {time:"8.00",cat:"KZ2",label:"KZ2",session:"PROVE LIBERE 1x7'",type:"serie",filter:"1"},
    {time:"8.10",cat:"KZ2",label:"KZ2",session:"",type:"serie",filter:"2"},
    {time:"8.20",cat:"OK",label:"OK",session:"",type:"serie",filter:"1"},
    {time:"8.30",cat:"OK",label:"OK",session:"",type:"serie",filter:"2"},
    {time:"8.40",cat:"OK",label:"OK",session:"",type:"serie",filter:"3"},
    {time:"8.50",cat:"OKJ",label:"OKJunior",session:"",type:"serie",filter:"1"},
    {time:"9.00",cat:"OKJ",label:"OKJunior",session:"",type:"serie",filter:"2"},
    {time:"9.10",cat:"OKJ",label:"OKJunior",session:"",type:"serie",filter:"3"},
    {time:"9.20",cat:"MINI U10",label:"MINI U10",session:"",type:"serie",filter:"1"},
    {time:"9.30",cat:"MINI U10",label:"MINI U10",session:"",type:"serie",filter:"2"},
    {time:"9.40",cat:"MINI GR3",label:"MINI GR3",session:"",type:"serie",filter:"1"},
    {time:"9.50",cat:"MINI GR3",label:"MINI GR3",session:"",type:"serie",filter:"2"},
    {time:"10.00",cat:"OK-NJ",label:"OK-NJ",session:"",type:"serie",filter:"1"},
    {time:"10.10",cat:"OK-NJ",label:"OK-NJ",session:"",type:"serie",filter:"2"},
    {time:"10.20",cat:"KZ2",label:"KZ2",session:"PROVE CRONOMETRATE 6'",type:"serie",filter:"1"},
    {time:"10.30",cat:"KZ2",label:"KZ2",session:"",type:"serie",filter:"2"},
    {time:"10.40",cat:"OK",label:"OK",session:"",type:"serie",filter:"1"},
    {time:"10.50",cat:"OK",label:"OK",session:"",type:"serie",filter:"2"},
    {time:"11.00",cat:"OK",label:"OK",session:"",type:"serie",filter:"3"},
    {time:"11.10",cat:"OKJ",label:"OKJunior",session:"",type:"serie",filter:"1"},
    {time:"11.20",cat:"OKJ",label:"OKJunior",session:"",type:"serie",filter:"2"},
    {time:"11.30",cat:"OKJ",label:"OKJunior",session:"",type:"serie",filter:"3"},
    {time:"11.40",cat:"MINI U10",label:"MINI U10",session:"",type:"serie",filter:"1"},
    {time:"11.50",cat:"MINI U10",label:"MINI U10",session:"",type:"serie",filter:"2"},
    {time:"12.00",cat:"MINI GR3",label:"MINI GR3",session:"",type:"serie",filter:"1"},
    {time:"12.10",cat:"MINI GR3",label:"MINI GR3",session:"",type:"serie",filter:"2"},
    {time:"12.20",cat:"OK-NJ",label:"OK-NJ",session:"",type:"serie",filter:"1"},
    {time:"12.30",cat:"OK-NJ",label:"OK-NJ",session:"",type:"serie",filter:"2"},
    {time:"13.20",cat:"KZ2",label:"KZ2",session:"MANCHES ELIMINATOIRES",type:"group",filter:["A","B"]},
    {time:"13.40",cat:"KZ2",label:"KZ2",session:"",type:"group",filter:["C","D"]},
    {time:"14.00",cat:"OK",label:"OK",session:"",type:"group",filter:["C","E"]},
    {time:"14.20",cat:"OK",label:"OK",session:"",type:"group",filter:["B","D"]},
    {time:"14.40",cat:"OKJ",label:"OKJunior",session:"",type:"group",filter:["C","E"]},
    {time:"15.00",cat:"OKJ",label:"OKJunior",session:"",type:"group",filter:["B","D"]},
    {time:"15.20",cat:"MINI U10",label:"MINI U10",session:"",type:"group",filter:["A","B"]},
    {time:"15.35",cat:"MINI U10",label:"MINI U10",session:"",type:"group",filter:["C","D"]},
    {time:"15.50",cat:"MINI GR3",label:"MINI GR3",session:"",type:"group",filter:["A","B"]},
    {time:"16.05",cat:"MINI GR3",label:"MINI GR3",session:"",type:"group",filter:["C","D"]},
    {time:"16.20",cat:"OK-NJ",label:"OK-NJ",session:"",type:"group",filter:["A","B"]},
    {time:"16.40",cat:"OK-NJ",label:"OK-NJ",session:"",type:"group",filter:["C","D"]},
    {time:"17.00",cat:"OK",label:"OK",session:"",type:"group",filter:["A","E"]},
    {time:"17.20",cat:"OK",label:"OK",session:"",type:"group",filter:["C","D"]},
    {time:"17.40",cat:"OKJ",label:"OKJunior",session:"",type:"group",filter:["A","E"]},
    {time:"18.00",cat:"OKJ",label:"OKJunior",session:"",type:"group",filter:["C","D"]}
  ],
  "SABATO":[
    {time:"8.00",cat:"KZ2",label:"KZ2",session:"WARM UP 5'",type:"parity",filter:"ODD"},
    {time:"8.08",cat:"KZ2",label:"KZ2",session:"",type:"parity",filter:"EVEN"},
    {time:"8.16",cat:"OK",label:"OK",session:"",type:"parity",filter:"ODD"},
    {time:"8.24",cat:"OK",label:"OK",session:"",type:"parity",filter:"EVEN"},
    {time:"8.32",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"ODD"},
    {time:"8.40",cat:"OKJ",label:"OKJ",session:"",type:"parity",filter:"EVEN"},
    {time:"8.48",cat:"MINI U10",label:"MINI U10",session:"",type:"parity",filter:"ODD"},
    {time:"8.56",cat:"MINI U10",label:"MINI U10",session:"",type:"parity",filter:"EVEN"},
    {time:"9.04",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"ODD"},
    {time:"9.12",cat:"MINI GR3",label:"MINI GR3",session:"",type:"parity",filter:"EVEN"},
    {time:"9.20",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"ODD"},
    {time:"9.28",cat:"OK-NJ",label:"OK-NJ",session:"",type:"parity",filter:"EVEN"},
    {time:"9.40",cat:"KZ2",label:"KZ2",session:"MANCHES ELIMINATOIRES",type:"group",filter:["A","C"]},
    {time:"10.00",cat:"KZ2",label:"KZ2",session:"",type:"group",filter:["B","D"]},
    {time:"10.20",cat:"OK",label:"OK",session:"",type:"group",filter:["A","B"]},
    {time:"10.40",cat:"OK",label:"OK",session:"",type:"group",filter:["D","E"]},
    {time:"11.00",cat:"OKJ",label:"OKJ",session:"",type:"group",filter:["A","B"]},
    {time:"11.20",cat:"OKJ",label:"OKJ",session:"",type:"group",filter:["D","E"]},
    {time:"11.40",cat:"MINI U10",label:"MINI U10",session:"",type:"group",filter:["A","C"]},
    {time:"11.55",cat:"MINI U10",label:"MINI U10",session:"",type:"group",filter:["B","D"]},
    {time:"12.10",cat:"MINI GR3",label:"MINI GR3",session:"",type:"group",filter:["A","C"]},
    {time:"12.25",cat:"MINI GR3",label:"MINI GR3",session:"",type:"group",filter:["B","D"]},
    {time:"12.40",cat:"OK-NJ",label:"OK-NJ",session:"",type:"group",filter:["A","C"]},
    {time:"13.00",cat:"OK-NJ",label:"OK-NJ",session:"",type:"group",filter:["B","D"]},
    {time:"13.20",cat:"KZ2",label:"KZ2",session:"",type:"group",filter:["A","D"]},
    {time:"13.40",cat:"KZ2",label:"KZ2",session:"",type:"group",filter:["B","C"]},
    {time:"14.00",cat:"OK",label:"OK",session:"",type:"group",filter:["A","C"]},
    {time:"14.20",cat:"OK",label:"OK",session:"",type:"group",filter:["B","E"]},
    {time:"14.40",cat:"OKJ",label:"OKJ",session:"",type:"group",filter:["A","C"]},
    {time:"15.00",cat:"OKJ",label:"OKJ",session:"",type:"group",filter:["B","E"]},
    {time:"15.20",cat:"MINI U10",label:"MINI U10",session:"",type:"group",filter:["A","D"]},
    {time:"15.35",cat:"MINI U10",label:"MINI U10",session:"",type:"group",filter:["B","C"]},
    {time:"15.50",cat:"MINI GR3",label:"MINI GR3",session:"",type:"group",filter:["A","D"]},
    {time:"16.05",cat:"MINI GR3",label:"MINI GR3",session:"",type:"group",filter:["B","C"]},
    {time:"16.20",cat:"OK-NJ",label:"OK-NJ",session:"",type:"group",filter:["A","D"]},
    {time:"16.40",cat:"OK-NJ",label:"OK-NJ",session:"",type:"group",filter:["B","C"]},
    {time:"17.00",cat:"OK",label:"OK",session:"",type:"group",filter:["A","D"]},
    {time:"17.20",cat:"OK",label:"OK",session:"",type:"group",filter:["B","C"]},
    {time:"17.40",cat:"OKJ",label:"OKJ",session:"",type:"group",filter:["A","D"]},
    {time:"18.00",cat:"OKJ",label:"OKJ",session:"",type:"group",filter:["B","C"]}
  ],
  "DOMENICA":[
    {time:"8.00",cat:"KZ2",label:"KZ2",session:"WARM UP — Prefinal A",type:"prefinal",filter:"A"},
    {time:"8.08",cat:"KZ2",label:"KZ2",session:"",type:"prefinal",filter:"B"},
    {time:"8.16",cat:"OK",label:"OK",session:"",type:"prefinal",filter:"A"},
    {time:"8.24",cat:"OK",label:"OK",session:"",type:"prefinal",filter:"B"},
    {time:"8.32",cat:"OKJ",label:"OKJ",session:"",type:"prefinal",filter:"A"},
    {time:"8.40",cat:"OKJ",label:"OKJ",session:"",type:"prefinal",filter:"B"},
    {time:"8.48",cat:"MINI U10",label:"MINI U10",session:"",type:"prefinal",filter:"A"},
    {time:"8.56",cat:"MINI U10",label:"MINI U10",session:"",type:"prefinal",filter:"B"},
    {time:"9.04",cat:"MINI GR3",label:"MINI GR3",session:"",type:"prefinal",filter:"A"},
    {time:"9.12",cat:"MINI GR3",label:"MINI GR3",session:"",type:"prefinal",filter:"B"},
    {time:"9.20",cat:"OK-NJ",label:"OK-NJ",session:"",type:"prefinal",filter:"A"},
    {time:"9.28",cat:"OK-NJ",label:"OK-NJ",session:"",type:"prefinal",filter:"B"},
    {time:"9.40",cat:"KZ2",label:"KZ2",session:"PREFINAL A",type:"prefinal",filter:"A"},
    {time:"10.00",cat:"KZ2",label:"KZ2",session:"PREFINAL B",type:"prefinal",filter:"B"},
    {time:"10.20",cat:"OK",label:"OK",session:"PREFINAL A",type:"prefinal",filter:"A"},
    {time:"10.40",cat:"OK",label:"OK",session:"PREFINAL B",type:"prefinal",filter:"B"},
    {time:"11.00",cat:"OKJ",label:"OKJ",session:"PREFINAL A",type:"prefinal",filter:"A"},
    {time:"11.20",cat:"OKJ",label:"OKJ",session:"PREFINAL B",type:"prefinal",filter:"B"},
    {time:"11.40",cat:"MINI U10",label:"MINI U10",session:"PREFINAL A",type:"prefinal",filter:"A"},
    {time:"11.55",cat:"MINI U10",label:"MINI U10",session:"PREFINAL B",type:"prefinal",filter:"B"},
    {time:"12.10",cat:"MINI GR3",label:"MINI GR3",session:"PREFINAL A",type:"prefinal",filter:"A"},
    {time:"12.25",cat:"MINI GR3",label:"MINI GR3",session:"PREFINAL B",type:"prefinal",filter:"B"},
    {time:"12.40",cat:"OK-NJ",label:"OK-NJ",session:"PREFINAL A",type:"prefinal",filter:"A"},
    {time:"13.00",cat:"OK-NJ",label:"OK-NJ",session:"PREFINAL B",type:"prefinal",filter:"B"}
  ]
};
// ENTRY_PLACEHOLDER

// ── ENTRY LIST ──
const ENTRY_LIST={
"101":{lastName:"ORLOV",firstName:"MAX",team:"SODIKART",cat:"KZ2",parity:"EVEN"},
"102":{lastName:"AUMAITRE",firstName:"MATHIS",team:"CPB SPORT",cat:"KZ2",parity:"EVEN"},
"103":{lastName:"KASTL",firstName:"MANUEL",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"104":{lastName:"THIEN",firstName:"JAYDEN",team:"CPB SPORT",cat:"KZ2",parity:"EVEN"},
"105":{lastName:"VAN WERVEN",firstName:"DION",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"106":{lastName:"SIIMESVAARA",firstName:"ALVAR",team:"CPB SPORT",cat:"KZ2",parity:"EVEN"},
"107":{lastName:"VAVRA",firstName:"RADEK",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"108":{lastName:"KLEPIKAS",firstName:"HENRIKAS",team:"CPB SPORT",cat:"KZ2",parity:"EVEN"},
"109":{lastName:"WESS",firstName:"ERIC",team:"WESS CHRISTIAN",cat:"KZ2",parity:"ODD"},
"110":{lastName:"ZVARICH",firstName:"MARK",team:"CPB SPORT",cat:"KZ2",parity:"EVEN"},
"112":{lastName:"VAN WALSTIJN",firstName:"SENNA",team:"SODIKART",cat:"KZ2",parity:"EVEN"},
"113":{lastName:"GRAHAM",firstName:"JENSON",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"114":{lastName:"SIACHKO",firstName:"YAUHEN",team:"AKM MOTORSPORT",cat:"KZ2",parity:"EVEN"},
"116":{lastName:"KNUDSEN",firstName:"MORGAN",team:"BIRELART RACING SRL",cat:"KZ2",parity:"EVEN"},
"117":{lastName:"JIANG",firstName:"HOU ZAI",team:"LA MOTORSPORT",cat:"KZ2",parity:"ODD"},
"121":{lastName:"SIZOV",firstName:"ANDREY",team:"MONSTERK FACTORY TEAM",cat:"KZ2",parity:"ODD"},
"122":{lastName:"MARAGLIANO",firstName:"ALEX",team:"CL RACING - TEAM RENDA",cat:"KZ2",parity:"EVEN"},
"123":{lastName:"BESSON",firstName:"HUGO",team:"CL RACING - TEAM RENDA",cat:"KZ2",parity:"ODD"},
"127":{lastName:"SPIRGEL",firstName:"TOM",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"128":{lastName:"BACIUSKA",firstName:"SIMAS",team:"CPB SPORT",cat:"KZ2",parity:"EVEN"},
"129":{lastName:"NOMBLOT",firstName:"JEAN",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"131":{lastName:"SKRIVAN",firstName:"MAREK",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"132":{lastName:"BERTUCA",firstName:"CRISTIAN",team:"BIRELART RACING SRL",cat:"KZ2",parity:"EVEN"},
"133":{lastName:"HILTBRAND",firstName:"PEDRO",team:"BIRELART RACING SRL",cat:"KZ2",parity:"ODD"},
"134":{lastName:"RITONEN",firstName:"MARTTI",team:"BIRELART RACING SRL",cat:"KZ2",parity:"EVEN"},
"135":{lastName:"IDER",firstName:"MICHAEL",team:"BIRELART RACING SRL",cat:"KZ2",parity:"ODD"},
"136":{lastName:"WOLFE",firstName:"NOAH",team:"BIRELART RACING SRL",cat:"KZ2",parity:"EVEN"},
"138":{lastName:"SULEIMAN",firstName:"ZANFARI",team:"BIRELART RACING SRL",cat:"KZ2",parity:"EVEN"},
"139":{lastName:"GUSHIKEN",firstName:"JAYDEN",team:"FORMULA K SRP FACTORY TEAM",cat:"KZ2",parity:"ODD"},
"140":{lastName:"DENNER",firstName:"EMILIEN",team:"FORMULA K SRP FACTORY TEAM",cat:"KZ2",parity:"EVEN"},
"141":{lastName:"KAJAK",firstName:"MARKUS",team:"FORMULA K SRP FACTORY TEAM",cat:"KZ2",parity:"ODD"},
"143":{lastName:"YANKOV",firstName:"ILYAN",team:"FORMULA K SRP FACTORY TEAM",cat:"KZ2",parity:"ODD"},
"144":{lastName:"BROVKO",firstName:"MARK",team:"FORMULA K SRP FACTORY TEAM",cat:"KZ2",parity:"EVEN"},
"145":{lastName:"ALBANESE",firstName:"DANILO",team:"KR MOTORSPORT",cat:"KZ2",parity:"ODD"},
"148":{lastName:"ZALLOCCO",firstName:"ALESSANDRO",team:"KCS RACING",cat:"KZ2",parity:"EVEN"},
"151":{lastName:"VASILE",firstName:"DANIEL",team:"MARANELLO KART",cat:"KZ2",parity:"ODD"},
"153":{lastName:"PALOMBA",firstName:"GIUSEPPE",team:"MARANELLO KART",cat:"KZ2",parity:"ODD"},
"154":{lastName:"SCHLEIMER",firstName:"MAXIMILIAN",team:"CL RACING - TEAM RENDA",cat:"KZ2",parity:"EVEN"},
"158":{lastName:"GUSTAFSSON",firstName:"VIKTOR",team:"CRG RACING TEAM",cat:"KZ2",parity:"EVEN"},
"159":{lastName:"LUYET",firstName:"JEAN",team:"CRG RACING TEAM",cat:"KZ2",parity:"ODD"},
"160":{lastName:"LUYET",firstName:"SAMUEL",team:"CRG RACING TEAM",cat:"KZ2",parity:"EVEN"},
"161":{lastName:"GIRARDET",firstName:"ALOIS",team:"CRG RACING TEAM",cat:"KZ2",parity:"ODD"},
"164":{lastName:"KNOPJES",firstName:"SEM",team:"BIRELART RACING SRL",cat:"KZ2",parity:"EVEN"},
"167":{lastName:"VARBITZALIEV",firstName:"KALOYAN",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"169":{lastName:"JURSE",firstName:"KIPRAS",team:"PASKERACING",cat:"KZ2",parity:"ODD"},
"170":{lastName:"LEUILLET",firstName:"TOM",team:"TONY KART RACING TEAM SRL",cat:"KZ2",parity:"EVEN"},
"171":{lastName:"VIGANO",firstName:"MATTEO",team:"TONY KART RACING TEAM SRL",cat:"KZ2",parity:"ODD"},
"172":{lastName:"CIVICO ESPONA",firstName:"GENIS",team:"TONY KART RACING TEAM SRL",cat:"KZ2",parity:"EVEN"},
"175":{lastName:"ANDRIOTIS",firstName:"PAUL",team:"BIRELART RACING SRL",cat:"KZ2",parity:"ODD"},
"177":{lastName:"MACIA",firstName:"DANIEL",team:"CRG RACING TEAM",cat:"KZ2",parity:"ODD"},
"181":{lastName:"GOLDSTEIN",firstName:"ELIE",team:"TBKART RACING TEAM SRL",cat:"KZ2",parity:"ODD"},
"183":{lastName:"FIORAVANTI",firstName:"PIETRO",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"185":{lastName:"DI BRIGIDA",firstName:"ANDREA",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"189":{lastName:"BOSS",firstName:"KILIAN",team:"SWIZZ EVENZZ",cat:"KZ2",parity:"ODD"},
"190":{lastName:"LACREUSE",firstName:"ENZO",team:"LKR",cat:"KZ2",parity:"EVEN"},
"191":{lastName:"LIWINSKI",firstName:"DAVID",team:"MP KARTRACING",cat:"KZ2",parity:"ODD"},
"192":{lastName:"VAN LEEUWEN",firstName:"QUINTEN",team:"MP KARTRACING",cat:"KZ2",parity:"EVEN"},
"193":{lastName:"VAN DER STRUIJS",firstName:"TOMMIE",team:"MP KARTRACING",cat:"KZ2",parity:"ODD"},
"194":{lastName:"SPAGNI",firstName:"ANDREA",team:"KCS RACING",cat:"KZ2",parity:"EVEN"},
"195":{lastName:"KROZSER",firstName:"MENYHERT",team:"CRG RACING TEAM",cat:"KZ2",parity:"ODD"},
"196":{lastName:"TRAVISANUTTO",firstName:"LORENZO",team:"PAROLIN MOTORSPORT",cat:"KZ2",parity:"EVEN"},
"198":{lastName:"STADTLER",firstName:"OLIVER",team:"FORMULA K SRP FACTORY TEAM",cat:"KZ2",parity:"EVEN"},
"199":{lastName:"KIRKBY",firstName:"JESSE",team:"MULTICUT RACING",cat:"KZ2",parity:"ODD"},
"900":{lastName:"SIMEK",firstName:"DOMINIK",team:"CPB SPORT",cat:"KZ2",parity:"EVEN"},
"901":{lastName:"FRIGOMOSCA",firstName:"ETHAN",team:"CPB SPORT",cat:"KZ2",parity:"ODD"},
"902":{lastName:"SALA",firstName:"FILIPPO",team:"CL RACING - TEAM",cat:"KZ2",parity:"EVEN"},
"201":{lastName:"BAGLIN",firstName:"NOAH",team:"KR MOTORSPORT",cat:"OK",parity:"ODD"},
"202":{lastName:"OWEN",firstName:"ARCHIE",team:"KR MOTORSPORT",cat:"OK",parity:"EVEN"},
"203":{lastName:"MANNI",firstName:"ANDREA",team:"KR MOTORSPORT",cat:"OK",parity:"ODD"},
"204":{lastName:"PESL",firstName:"JINDRICH",team:"TONY KART RACING TEAM SRL",cat:"OK",parity:"EVEN"},
"205":{lastName:"CRISAN",firstName:"ILIE TRISTAN",team:"TONY KART RACING TEAM SRL",cat:"OK",parity:"ODD"},
"206":{lastName:"ZULFIKARI",firstName:"ISKENDER",team:"TONY KART RACING TEAM SRL",cat:"OK",parity:"EVEN"},
"207":{lastName:"CANAL",firstName:"GABRIEL",team:"TONY KART RACING TEAM SRL",cat:"OK",parity:"ODD"},
"208":{lastName:"ARATA",firstName:"ENDO",team:"TONY KART RACING TEAM SRL",cat:"OK",parity:"EVEN"},
"210":{lastName:"PRADIER",firstName:"THOMAS",team:"TONY KART RACING TEAM SRL",cat:"OK",parity:"EVEN"},
"211":{lastName:"ANAGNOSTIADIS",firstName:"JAMES",team:"KR MOTORSPORT",cat:"OK",parity:"ODD"},
"213":{lastName:"SZECSENYI",firstName:"TOBIAS",team:"KR MOTORSPORT",cat:"OK",parity:"ODD"},
"214":{lastName:"NUNEZ",firstName:"PIER-LOUIS",team:"KR MOTORSPORT",cat:"OK",parity:"EVEN"},
"215":{lastName:"SIMONS TORRES",firstName:"ANGELINA",team:"KR MOTORSPORT",cat:"OK",parity:"ODD"},
"217":{lastName:"MANACH",firstName:"BENJAMIN",team:"WARD RACING",cat:"OK",parity:"ODD"},
"218":{lastName:"MARSHALL",firstName:"WILLIAM",team:"WARD RACING",cat:"OK",parity:"EVEN"},
"220":{lastName:"FIRHAND",firstName:"QARRAR",team:"WARD RACING",cat:"OK",parity:"EVEN"},
"221":{lastName:"KERDAL",firstName:"FRANCOIS DARIO",team:"DPK RACING",cat:"OK",parity:"ODD"},
"222":{lastName:"HERNANDEZ",firstName:"EMIL",team:"DPK RACING",cat:"OK",parity:"EVEN"},
"223":{lastName:"SCARBROUGH",firstName:"LILLIAN",team:"RICKY FLYNN MOTORSPORT",cat:"OK",parity:"ODD"},
"224":{lastName:"KORNDER",firstName:"LUKE",team:"RICKY FLYNN MOTORSPORT",cat:"OK",parity:"EVEN"},
"225":{lastName:"WALZ",firstName:"DREW",team:"RICKY FLYNN MOTORSPORT",cat:"OK",parity:"ODD"},
"226":{lastName:"WALZ",firstName:"DEVIN",team:"RICKY FLYNN MOTORSPORT",cat:"OK",parity:"EVEN"},
"227":{lastName:"ARIAS",firstName:"BOSCO",team:"RICKY FLYNN MOTORSPORT",cat:"OK",parity:"ODD"},
"228":{lastName:"LOPEZ",firstName:"MARIANO",team:"FUSION MOTORSPORT",cat:"OK",parity:"EVEN"},
"229":{lastName:"GALAN",firstName:"OSKAR",team:"FUSION MOTORSPORT",cat:"OK",parity:"ODD"},
"230":{lastName:"STALMACH",firstName:"WIKTOR",team:"FUSION MOTORSPORT",cat:"OK",parity:"EVEN"},
"231":{lastName:"POKORNY",firstName:"DANIEL",team:"FUSION MOTORSPORT",cat:"OK",parity:"ODD"},
"232":{lastName:"GALLO",firstName:"MATTEO",team:"FUSION MOTORSPORT",cat:"OK",parity:"EVEN"},
"233":{lastName:"SIMEONOV",firstName:"SVETLEN",team:"FORZA RACING",cat:"OK",parity:"ODD"},
"235":{lastName:"IVANNIKOV",firstName:"VLADIMIR",team:"BIRELART RACING SRL",cat:"OK",parity:"ODD"},
"236":{lastName:"ROUSSEAU",firstName:"GIANMATTEO",team:"BIRELART RACING SRL",cat:"OK",parity:"EVEN"},
"238":{lastName:"MAZZOLA",firstName:"LUDOVICO",team:"BIRELART RACING SRL",cat:"OK",parity:"EVEN"},
"242":{lastName:"SOLOVOV",firstName:"GLEB",team:"CRG RACING TEAM",cat:"OK",parity:"EVEN"},
"243":{lastName:"OCHSTEIN",firstName:"ASHER",team:"CRG RACING TEAM",cat:"OK",parity:"ODD"},
"244":{lastName:"KOSMOPOULOS",firstName:"NEFELI",team:"CRG RACING TEAM",cat:"OK",parity:"EVEN"},
"245":{lastName:"BUSATO",firstName:"RAFAEL",team:"CRG RACING TEAM",cat:"OK",parity:"ODD"},
"246":{lastName:"HOOGENDOORN",firstName:"DEAN",team:"PAROLIN MOTORSPORT",cat:"OK",parity:"EVEN"},
"247":{lastName:"CALLEJA",firstName:"WILLIAM",team:"PAROLIN MOTORSPORT",cat:"OK",parity:"ODD"},
"248":{lastName:"RAYQAL",firstName:"ZARIEF",team:"PAROLIN MOTORSPORT",cat:"OK",parity:"EVEN"},
"250":{lastName:"BLANCO",firstName:"BRUNO",team:"KR MOTORSPORT",cat:"OK",parity:"EVEN"},
"251":{lastName:"SHARP",firstName:"ASTON",team:"VAR BY BIREL",cat:"OK",parity:"ODD"},
"252":{lastName:"SEAH",firstName:"ISAAC",team:"JAMIE GREEN RACING",cat:"OK",parity:"EVEN"},
"253":{lastName:"GREEN",firstName:"ZAC",team:"JAMIE GREEN RACING",cat:"OK",parity:"ODD"},
"255":{lastName:"SCELLES",firstName:"LUKA",team:"VICTORYLANE KARTING",cat:"OK",parity:"ODD"},
"256":{lastName:"PURCELL",firstName:"EVAN",team:"KR MOTORSPORT",cat:"OK",parity:"EVEN"},
"258":{lastName:"KOWALCZYK",firstName:"KLARA",team:"VICTORYLANE KARTING",cat:"OK",parity:"EVEN"},
"259":{lastName:"GONZALEZ",firstName:"MATIAS",team:"BEYOND RACING TEAM",cat:"OK",parity:"ODD"},
"261":{lastName:"STANLEY",firstName:"NICOLA",team:"MP KARTRACING",cat:"OK",parity:"ODD"},
"262":{lastName:"RIS",firstName:"YVES",team:"MP KARTRACING",cat:"OK",parity:"EVEN"},
"263":{lastName:"TAAL",firstName:"LUUK",team:"MP KARTRACING",cat:"OK",parity:"ODD"},
"264":{lastName:"DOMAIN",firstName:"HENRI",team:"MP KARTRACING",cat:"OK",parity:"EVEN"},
"265":{lastName:"STILLER",firstName:"PETER",team:"MP KARTRACING",cat:"OK",parity:"ODD"},
"266":{lastName:"GORECKI",firstName:"PIOTR",team:"KB RACING EXPERIENCE",cat:"OK",parity:"EVEN"},
"267":{lastName:"GORECKI",firstName:"MICHAL",team:"KB RACING EXPERIENCE",cat:"OK",parity:"ODD"},
"268":{lastName:"VISUET CRUZ",firstName:"FERNANDO",team:"MP ACADEMY GAMOTO",cat:"OK",parity:"EVEN"},
"269":{lastName:"LEVAR",firstName:"JURE",team:"HAGEMANN RACING",cat:"OK",parity:"ODD"},
"270":{lastName:"LEVAR",firstName:"ANJA",team:"HAGEMANN RACING",cat:"OK",parity:"EVEN"},
"272":{lastName:"KARA",firstName:"OSMAN AMIN",team:"HAUPT RACING TEAM",cat:"OK",parity:"EVEN"},
"273":{lastName:"DRUMMOND",firstName:"ZAC",team:"FUSION MOTORSPORT",cat:"OK",parity:"ODD"},
"276":{lastName:"SCHAUFLER",firstName:"NIKLAS",team:"DPK RACING",cat:"OK",parity:"EVEN"},
"277":{lastName:"SILKUNAITE",firstName:"VANESA",team:"DPK RACING",cat:"OK",parity:"ODD"},
"278":{lastName:"FRIGG",firstName:"NICOLA",team:"VICTORYLANE KARTING",cat:"OK",parity:"EVEN"},
"279":{lastName:"KRUTOGOLOV",firstName:"LEV",team:"ENERGY CORSE SRL",cat:"OK",parity:"ODD"},
"280":{lastName:"GARST",firstName:"MARCO",team:"KOSKI MOTORSPORT",cat:"OK",parity:"EVEN"},
"281":{lastName:"VIAPIANA",firstName:"VALERIO",team:"KOSKI MOTORSPORT",cat:"OK",parity:"ODD"},
"282":{lastName:"MCGAUGHY",firstName:"MICHAEL",team:"KOSKI MOTORSPORT",cat:"OK",parity:"EVEN"},
"283":{lastName:"RAJPOLD",firstName:"KACPER",team:"VDK RACING",cat:"OK",parity:"ODD"},
"285":{lastName:"ALLEMANN",firstName:"DAN",team:"VDK RACING",cat:"OK",parity:"ODD"},
"289":{lastName:"RUMLENOVA",firstName:"MARTINA",team:"MVM RACING",cat:"OK",parity:"ODD"},
"292":{lastName:"CRISTEA",firstName:"MAX",team:"GULSTAR RACING",cat:"OK",parity:"EVEN"},
"293":{lastName:"KIVILO",firstName:"ARON",team:"LIQUI-MOLY ROLI MOTORSPORT",cat:"OK",parity:"ODD"},
"294":{lastName:"BOTTARO",firstName:"DAVIDE",team:"LENOVO KALI KART TEAM",cat:"OK",parity:"EVEN"},
"296":{lastName:"RASSMUSEN",firstName:"OLIVER",team:"KB RACING EXPERIENCE",cat:"OK",parity:"EVEN"},
"299":{lastName:"COCCHIANELLA",firstName:"ANTONIO",team:"BIRELART RACING SRL",cat:"OK",parity:"ODD"},
"400":{lastName:"KRAFT",firstName:"VINCENT",team:"KART REPUBLIC SWEDEN",cat:"OK",parity:"EVEN"},
"404":{lastName:"ERBERSDOBLER",firstName:"LIAS",team:"HAUPT RACING TEAM",cat:"OK",parity:"EVEN"},
"407":{lastName:"MORELLI",firstName:"YURI",team:"CRG RACING TEAM",cat:"OK",parity:"ODD"},
"409":{lastName:"THIRUMALAISWAMY",firstName:"JUDE",team:"VICTORYLANE KARTING",cat:"OK",parity:"ODD"},
"411":{lastName:"HERMAN",firstName:"GILLES",team:"TONY KART RACING TEAM SRL",cat:"OK",parity:"ODD"},
"413":{lastName:"MALO",firstName:"MATEO",team:"MP KARTRACING",cat:"OK",parity:"ODD"},
"414":{lastName:"WYSZOMIRSKA",firstName:"AMELIA",team:"MP KARTRACING",cat:"OK",parity:"EVEN"},
"415":{lastName:"KINNMARK",firstName:"OLIVER",team:"VDK RACING",cat:"OK",parity:"ODD"},
"416":{lastName:"MIGUEZ",firstName:"MANUEL",team:"VICTORYLANE KARTING",cat:"OK",parity:"EVEN"},
"417":{lastName:"BRYLA",firstName:"ADAM",team:"TEAM DRIVER RACING KART",cat:"OK",parity:"ODD"},
"418":{lastName:"THOMPSON",firstName:"EDWARD",team:"IPERTI BY INTREPID ACADEMY",cat:"OK",parity:"EVEN"},
"301":{lastName:"MIRON LORENTE",firstName:"DANIEL",team:"FUSION MOTORSPORT",cat:"OKJ",parity:"ODD"},
"302":{lastName:"ROST",firstName:"KRISTIAN-ALEXANDER",team:"FUSION MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"304":{lastName:"POINT",firstName:"ALEXANDRE",team:"FUSION MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"305":{lastName:"DI PIETRANTONIO",firstName:"LORENZO",team:"KR MOTORSPORT",cat:"OKJ",parity:"ODD"},
"306":{lastName:"PALACIO",firstName:"LUCAS",team:"KR MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"307":{lastName:"ROBERTSON",firstName:"MASON",team:"KR MOTORSPORT",cat:"OKJ",parity:"ODD"},
"308":{lastName:"RATAJSKI",firstName:"STAN",team:"KR MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"309":{lastName:"NUVOLINI",firstName:"MANY",team:"KR MOTORSPORT",cat:"OKJ",parity:"ODD"},
"310":{lastName:"XIE",firstName:"HUIFEI",team:"KR MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"311":{lastName:"KUMPEN",firstName:"HENRI-CONSTANT",team:"RICKY FLYNN MOTORSPORT",cat:"OKJ",parity:"ODD"},
"312":{lastName:"FRASNELLI",firstName:"JULIAN",team:"TONY KART RACING TEAM SRL",cat:"OKJ",parity:"EVEN"},
"313":{lastName:"WEN",firstName:"YUBO",team:"TONY KART RACING TEAM SRL",cat:"OKJ",parity:"ODD"},
"314":{lastName:"POUJOL",firstName:"JEAN",team:"TONY KART RACING TEAM SRL",cat:"OKJ",parity:"EVEN"},
"315":{lastName:"IANNI",firstName:"ANTONIO",team:"TONY KART RACING TEAM SRL",cat:"OKJ",parity:"ODD"},
"316":{lastName:"BERTOLACCINI",firstName:"MARTIN LUIS",team:"TONY KART RACING TEAM SRL",cat:"OKJ",parity:"EVEN"},
"317":{lastName:"VETTENRANTA",firstName:"OIVA",team:"TONY KART RACING TEAM SRL",cat:"OKJ",parity:"ODD"},
"318":{lastName:"MAZEPIN",firstName:"STEPAN",team:"TONY KART RACING TEAM SRL",cat:"OKJ",parity:"EVEN"},
"319":{lastName:"DIAZ DE LA VEGA",firstName:"SANTIAGO",team:"KR MOTORSPORT",cat:"OKJ",parity:"ODD"},
"320":{lastName:"TRUCHOT",firstName:"ALESSANDRO",team:"KR MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"321":{lastName:"GREEN",firstName:"WILL",team:"KR MOTORSPORT",cat:"OKJ",parity:"ODD"},
"322":{lastName:"SINI",firstName:"OLIVERI",team:"KR MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"324":{lastName:"BOBRESHOV",firstName:"MAXIM",team:"RICKY FLYNN MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"325":{lastName:"MANZANO SUAREZ",firstName:"MIGUEL ENRIQUE",team:"RICKY FLYNN MOTORSPORT",cat:"OKJ",parity:"ODD"},
"326":{lastName:"VAN STAVEREN",firstName:"BILLY",team:"RICKY FLYNN MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"327":{lastName:"GORSKI",firstName:"LEO",team:"RICKY FLYNN MOTORSPORT",cat:"OKJ",parity:"ODD"},
"328":{lastName:"SAMCZYK",firstName:"REMIGIUSZ",team:"FORZA RACING",cat:"OKJ",parity:"EVEN"},
"329":{lastName:"PEZZUTTO",firstName:"ENEA",team:"FORZA RACING",cat:"OKJ",parity:"ODD"},
"330":{lastName:"WESTWOOD",firstName:"BENJAMIN",team:"FORZA RACING",cat:"OKJ",parity:"EVEN"},
"331":{lastName:"ZVARICH",firstName:"MARAT",team:"FORZA RACING",cat:"OKJ",parity:"ODD"},
"332":{lastName:"ROCHA",firstName:"FRANCISCO",team:"FORZA RACING",cat:"OKJ",parity:"EVEN"},
"333":{lastName:"LAZARUS",firstName:"ALEXANDER",team:"FORZA RACING",cat:"OKJ",parity:"ODD"},
"334":{lastName:"NEWSTEAD",firstName:"AUSTIN",team:"FORZA RACING",cat:"OKJ",parity:"EVEN"},
"335":{lastName:"CHELIDZE",firstName:"LEON",team:"FORZA RACING",cat:"OKJ",parity:"ODD"},
"336":{lastName:"GESSESSE",firstName:"BWANA",team:"CRG RACING TEAM",cat:"OKJ",parity:"EVEN"},
"337":{lastName:"PILIPENKO",firstName:"MARK",team:"FORZA RACING",cat:"OKJ",parity:"ODD"},
"338":{lastName:"PIZZONIA",firstName:"ANTONIO",team:"WARD RACING",cat:"OKJ",parity:"EVEN"},
"339":{lastName:"FELDE",firstName:"MAX",team:"WARD RACING",cat:"OKJ",parity:"ODD"},
"340":{lastName:"SEDEK",firstName:"JAN",team:"WARD RACING",cat:"OKJ",parity:"EVEN"},
"341":{lastName:"TAMM",firstName:"ALBERT",team:"PAROLIN MOTORSPORT",cat:"OKJ",parity:"ODD"},
"342":{lastName:"GIRARDELLO",firstName:"GIOELE",team:"PAROLIN MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"343":{lastName:"GIUSTO",firstName:"GIACOMO",team:"PAROLIN MOTORSPORT",cat:"OKJ",parity:"ODD"},
"344":{lastName:"WALLE",firstName:"OSKARI",team:"PAROLIN MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"345":{lastName:"GARCIARCE",firstName:"JUAN",team:"PAROLIN MOTORSPORT",cat:"OKJ",parity:"ODD"},
"346":{lastName:"LEGENKYI",firstName:"OLEKSANDR",team:"CL RACING TEAM",cat:"OKJ",parity:"EVEN"},
"347":{lastName:"ANGELARD",firstName:"JULIA",team:"BIRELART RACING SRL",cat:"OKJ",parity:"ODD"},
"348":{lastName:"REA",firstName:"ACHILLE",team:"BIRELART RACING SRL",cat:"OKJ",parity:"EVEN"},
"349":{lastName:"HUGON",firstName:"SAMUEL",team:"CRG RACING TEAM",cat:"OKJ",parity:"ODD"},
"351":{lastName:"GUTH",firstName:"NICOLAS",team:"CRG RACING TEAM",cat:"OKJ",parity:"ODD"},
"352":{lastName:"KOSMOPOULOS",firstName:"IASON",team:"CRG RACING TEAM",cat:"OKJ",parity:"EVEN"},
"353":{lastName:"BUSATO",firstName:"GUILHERME",team:"CRG RACING TEAM",cat:"OKJ",parity:"ODD"},
"354":{lastName:"NAGY",firstName:"ROLAND",team:"DPK RACING",cat:"OKJ",parity:"EVEN"},
"355":{lastName:"SIMONE",firstName:"ROCCO",team:"DPK RACING",cat:"OKJ",parity:"ODD"},
"356":{lastName:"ZHU",firstName:"ZACK",team:"DPK RACING",cat:"OKJ",parity:"EVEN"},
"360":{lastName:"COBY",firstName:"CHRISTIAN",team:"MP KARTRACING",cat:"OKJ",parity:"EVEN"},
"361":{lastName:"MAKINEN",firstName:"LENNI",team:"MP KARTRACING",cat:"OKJ",parity:"ODD"},
"363":{lastName:"BABICEK",firstName:"ZDENEK",team:"TEPZ RACING TEAM",cat:"OKJ",parity:"ODD"},
"364":{lastName:"PUNDYS",firstName:"JONAS",team:"VICTORYLANE KARTING",cat:"OKJ",parity:"EVEN"},
"365":{lastName:"QUESSADA",firstName:"MARC ANDRIA",team:"VICTORYLANE KARTING",cat:"OKJ",parity:"ODD"},
"366":{lastName:"PELFRENE",firstName:"TEO",team:"VICTORYLANE KARTING",cat:"OKJ",parity:"EVEN"},
"367":{lastName:"NACHAWATI",firstName:"LIAM",team:"RICKY FLYNN MOTORSPORT",cat:"OKJ",parity:"ODD"},
"368":{lastName:"SPENCER",firstName:"OLIVER",team:"BIRELART RACING SRL",cat:"OKJ",parity:"EVEN"},
"369":{lastName:"MULLER",firstName:"TIBERIUS",team:"BEYOND RACING TEAM",cat:"OKJ",parity:"ODD"},
"371":{lastName:"MOLOTA",firstName:"ALEX",team:"HAGEMANN RACING",cat:"OKJ",parity:"ODD"},
"373":{lastName:"DUDKOWSKI",firstName:"KSAWERY",team:"KOSKI MOTORSPORT",cat:"OKJ",parity:"ODD"},
"374":{lastName:"SVOBODA",firstName:"JINDRICH",team:"HAGEMANN RACING",cat:"OKJ",parity:"EVEN"},
"375":{lastName:"OSADCHYI-SUSLOVSKYI",firstName:"VSEVOLOD",team:"KOSKI MOTORSPORT",cat:"OKJ",parity:"ODD"},
"377":{lastName:"BOTTE",firstName:"NIKITA",team:"FORZA RACING",cat:"OKJ",parity:"ODD"},
"378":{lastName:"KOSTRZEWA",firstName:"BLAZEJ",team:"WARD RACING",cat:"OKJ",parity:"EVEN"},
"379":{lastName:"GARDZIELIK",firstName:"JAN",team:"ENERGY CORSE SRL",cat:"OKJ",parity:"ODD"},
"380":{lastName:"SAYER",firstName:"JARLATH",team:"ENERGY CORSE SRL",cat:"OKJ",parity:"EVEN"},
"381":{lastName:"SANCHES",firstName:"FELIPE",team:"ENERGY CORSE SRL",cat:"OKJ",parity:"ODD"},
"382":{lastName:"LAWRENCE",firstName:"AVA JEAN",team:"DPK RACING",cat:"OKJ",parity:"EVEN"},
"384":{lastName:"LOOMETS",firstName:"MARK",team:"LENOVO KALI KART TEAM",cat:"OKJ",parity:"EVEN"},
"385":{lastName:"RIVERA",firstName:"JULIAN",team:"LENOVO KALI KART TEAM",cat:"OKJ",parity:"ODD"},
"386":{lastName:"VLASAK",firstName:"LIBOR",team:"FUSION MOTORSPORT",cat:"OKJ",parity:"EVEN"},
"387":{lastName:"VERBEKE",firstName:"JEF",team:"FORZA RACING",cat:"OKJ",parity:"ODD"},
"389":{lastName:"SULIN",firstName:"MAX",team:"SULIN KIM",cat:"OKJ",parity:"ODD"},
"393":{lastName:"PENTELL",firstName:"KEVIN",team:"WARD RACING",cat:"OKJ",parity:"ODD"},
"396":{lastName:"PULIGHEDDU",firstName:"ALEX",team:"LENOVO KALI KART TEAM",cat:"OKJ",parity:"EVEN"},
"397":{lastName:"DERGUNOV",firstName:"MATVEI",team:"PRIMA RACING",cat:"OKJ",parity:"ODD"},
"399":{lastName:"WILLIAMS",firstName:"HARRY",team:"FORZA RACING",cat:"OKJ",parity:"ODD"},
"801":{lastName:"PRIAM",firstName:"BRUNO",team:"VICTORYLANE KARTING",cat:"OKJ",parity:"ODD"},
"802":{lastName:"KOGAY",firstName:"SAVELIY",team:"VICTORYLANE KARTING",cat:"OKJ",parity:"EVEN"},
"803":{lastName:"IBBOTSON",firstName:"ZACHARY",team:"UBIQ RACING",cat:"OKJ",parity:"ODD"},
"701":{lastName:"PERICO",firstName:"NICCOLO",team:"KR MOTORSPORT",cat:"OK-NJ",parity:"ODD"},
"702":{lastName:"SCHNIEGENBERG",firstName:"COLTON",team:"WARD RACING",cat:"OK-NJ",parity:"EVEN"},
"703":{lastName:"MANASSERO",firstName:"VALENTINO",team:"TONY KART RACING TEAM SRL",cat:"OK-NJ",parity:"ODD"},
"704":{lastName:"LI",firstName:"LINGHAN",team:"TONY KART RACING TEAM SRL",cat:"OK-NJ",parity:"EVEN"},
"705":{lastName:"FELIGIONI",firstName:"AUGUSTIN",team:"TONY KART RACING TEAM SRL",cat:"OK-NJ",parity:"ODD"},
"706":{lastName:"GORUN",firstName:"VICTOR THOMAS",team:"TONY KART RACING TEAM SRL",cat:"OK-NJ",parity:"EVEN"},
"707":{lastName:"HEDFORS",firstName:"ELTON",team:"MODENA KART RACING TEAM",cat:"OK-NJ",parity:"ODD"},
"708":{lastName:"MIR",firstName:"ATIQA",team:"MODENA KART RACING TEAM SRL",cat:"OK-NJ",parity:"EVEN"},
"709":{lastName:"BASESCU PRICOP",firstName:"RADU",team:"MODENA KART RACING TEAM",cat:"OK-NJ",parity:"ODD"},
"711":{lastName:"NANNI",firstName:"ALESSANDRO",team:"MODENA KART RACING TEAM",cat:"OK-NJ",parity:"ODD"},
"712":{lastName:"D ASCOLI",firstName:"LUIGI",team:"MODENA KART RACING TEAM",cat:"OK-NJ",parity:"EVEN"},
"713":{lastName:"VERBA",firstName:"DANILA",team:"MODENA KART RACING TEAM",cat:"OK-NJ",parity:"ODD"},
"715":{lastName:"CORSI",firstName:"TOMMASO",team:"MODENA KART RACING TEAM",cat:"OK-NJ",parity:"ODD"},
"716":{lastName:"KRISTIANSEN",firstName:"PATRIK",team:"MP ACADEMY GAMOTO",cat:"OK-NJ",parity:"EVEN"},
"717":{lastName:"OCIEPA",firstName:"ANTONI",team:"NOVALUX SRL",cat:"OK-NJ",parity:"ODD"},
"718":{lastName:"COTOROBAI",firstName:"ILIA",team:"NOVALUX SRL",cat:"OK-NJ",parity:"EVEN"},
"719":{lastName:"VIZITIU",firstName:"SERBAN",team:"NOVALUX SRL",cat:"OK-NJ",parity:"ODD"},
"720":{lastName:"LAITINEN",firstName:"LEO",team:"PAROLIN FINLAND",cat:"OK-NJ",parity:"EVEN"},
"721":{lastName:"VERDE",firstName:"MARCO",team:"TEAM DRIVER RACING KART",cat:"OK-NJ",parity:"ODD"},
"722":{lastName:"RIEDEL",firstName:"SEBASTIAN",team:"TEAM DRIVER RACING KART",cat:"OK-NJ",parity:"EVEN"},
"723":{lastName:"GORE",firstName:"AXEL",team:"TEAM DRIVER RACING KART",cat:"OK-NJ",parity:"ODD"},
"724":{lastName:"KOLOSOV",firstName:"IOANNIS",team:"MODENA KART RACING TEAM",cat:"OK-NJ",parity:"EVEN"},
"725":{lastName:"DI FILIPPO",firstName:"DAVIDE",team:"DR SRL",cat:"OK-NJ",parity:"ODD"},
"727":{lastName:"CARRER",firstName:"GIOELE",team:"EMME RACING",cat:"OK-NJ",parity:"ODD"},
"728":{lastName:"FARIA",firstName:"PEDRO",team:"FARIA ALEXANDRE",cat:"OK-NJ",parity:"EVEN"},
"729":{lastName:"SIACHKO",firstName:"ARSENIY",team:"AKM MOTORSPORT",cat:"OK-NJ",parity:"ODD"},
"730":{lastName:"WOJCIK",firstName:"DOMINIK",team:"TEAM DRIVER RACING KART",cat:"OK-NJ",parity:"EVEN"},
"731":{lastName:"PULBERE",firstName:"ROBERT",team:"GULSTAR RACING",cat:"OK-NJ",parity:"ODD"},
"732":{lastName:"COSTEA",firstName:"CALIN",team:"GULSTAR RACING",cat:"OK-NJ",parity:"EVEN"},
"740":{lastName:"BRAGEOT",firstName:"MATTIS",team:"AKM MOTORSPORT",cat:"OK-NJ",parity:"EVEN"},
"745":{lastName:"VASQUEZ ALBA",firstName:"DAVID LUIZ",team:"MP ACADEMY GAMOTO",cat:"OK-NJ",parity:"ODD"},
"747":{lastName:"LINDEMAN",firstName:"SENN",team:"LA MOTORSPORT",cat:"OK-NJ",parity:"ODD"},
"749":{lastName:"DZHLILOV",firstName:"NIKITA",team:"MODENA KART RACING TEAM",cat:"OK-NJ",parity:"ODD"},
"750":{lastName:"KOVTUNENKO",firstName:"PLATON",team:"BORSCH RACING",cat:"OK-NJ",parity:"EVEN"},
"751":{lastName:"NEKMOUCHE",firstName:"NEIL",team:"KIDIX DRIVER PERFORMANCE",cat:"OK-NJ",parity:"ODD"},
"753":{lastName:"NOVIELLO",firstName:"GIUSEPPE",team:"TEAM DRIVER RACING KART",cat:"OK-NJ",parity:"ODD"},
"757":{lastName:"MOEHRING",firstName:"HENRI",team:"DOERR MOTORSPORT",cat:"OK-NJ",parity:"ODD"},
"758":{lastName:"CZUB",firstName:"ALEKSANDER",team:"KB RACING EXPERIENCE",cat:"OK-NJ",parity:"EVEN"},
"764":{lastName:"KAHILA",firstName:"HUGO",team:"PAROLIN FINLAND",cat:"OK-NJ",parity:"EVEN"},
"765":{lastName:"OJALA",firstName:"OSKAR",team:"PAROLIN FINLAND",cat:"OK-NJ",parity:"ODD"},
"768":{lastName:"RASMUSSEN",firstName:"CHRISTIAN",team:"MULTICUT RACING",cat:"OK-NJ",parity:"EVEN"},
"769":{lastName:"HAVLIK",firstName:"MATEJ",team:"KB RACING EXPERIENCE",cat:"OK-NJ",parity:"ODD"},
"770":{lastName:"REINERT",firstName:"PATRICK RAY",team:"ARENA E TEAM",cat:"OK-NJ",parity:"EVEN"},
"773":{lastName:"GUGO",firstName:"VLADIMIR",team:"BIRELART RACING SRL",cat:"OK-NJ",parity:"ODD"},
"777":{lastName:"BUZAS",firstName:"GERGO",team:"GULSTAR RACING",cat:"OK-NJ",parity:"ODD"},
"778":{lastName:"PETROSIAN",firstName:"GEORGII",team:"CRG RACING TEAM",cat:"OK-NJ",parity:"EVEN"},
"782":{lastName:"MUZZOLON",firstName:"LUCA",team:"RED FURY KARTING TEAM",cat:"OK-NJ",parity:"EVEN"},
"783":{lastName:"BOSCHETTO",firstName:"EMMA",team:"BOSCHETTO HENRI",cat:"OK-NJ",parity:"ODD"},
"784":{lastName:"PEREMEN",firstName:"LAWRENCE",team:"WARD RACING",cat:"OK-NJ",parity:"EVEN"},
"785":{lastName:"BRAND",firstName:"SEBASTIAN",team:"ARENA E TEAM",cat:"OK-NJ",parity:"ODD"},
"786":{lastName:"URLASS",firstName:"EMILIA",team:"ARENA E TEAM",cat:"OK-NJ",parity:"EVEN"},
"787":{lastName:"GEFWERT",firstName:"NOEL",team:"PAROLIN FINLAND",cat:"OK-NJ",parity:"ODD"},
"788":{lastName:"MORENO",firstName:"IKER",team:"DR SRL",cat:"OK-NJ",parity:"EVEN"},
"789":{lastName:"LONGHITANO",firstName:"AURELIO",team:"SPIRIT-KARTING.CH",cat:"OK-NJ",parity:"ODD"},
"790":{lastName:"DAVOUST",firstName:"MOMCILO",team:"IPERTI BY INTREPID ACADEMY",cat:"OK-NJ",parity:"EVEN"},
"791":{lastName:"SARADPON",firstName:"PHAETHON",team:"IPERTI BY INTREPID ACADEMY",cat:"OK-NJ",parity:"ODD"},
"792":{lastName:"THOMPSON",firstName:"DAISY",team:"IPERTI BY INTREPID ACADEMY",cat:"OK-NJ",parity:"EVEN"},
"793":{lastName:"ASMER",firstName:"ASTON",team:"WARD RACING",cat:"OK-NJ",parity:"ODD"},
"501":{lastName:"GODSCHALK",firstName:"WYNN",team:"KIDIX DRIVER PERFORMANCE",cat:"MINI GR3",parity:"ODD"},
"506":{lastName:"TITZ",firstName:"DEVIN",team:"KIDIX DRIVER PERFORMANCE",cat:"MINI GR3",parity:"EVEN"},
"509":{lastName:"MUIJS",firstName:"CEES",team:"SODIKART",cat:"MINI GR3",parity:"ODD"},
"511":{lastName:"SHEETOV",firstName:"DAVID",team:"BIRELART RACING SRL",cat:"MINI GR3",parity:"ODD"},
"512":{lastName:"GILMORE",firstName:"GIOVANNI DAVID",team:"DR SRL",cat:"MINI GR3",parity:"EVEN"},
"515":{lastName:"NARIO URIAS",firstName:"MAURO FABIAN",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"ODD"},
"516":{lastName:"KOSE",firstName:"OSMAN SELIM",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"EVEN"},
"517":{lastName:"LAUFER",firstName:"MAX",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"ODD"},
"518":{lastName:"GARCIA",firstName:"MATEO",team:"LENOVO KALI KART TEAM",cat:"MINI GR3",parity:"EVEN"},
"519":{lastName:"FRIGERIO",firstName:"FILIPPO",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"ODD"},
"521":{lastName:"CHANG",firstName:"SHUO TING",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"ODD"},
"526":{lastName:"EL GAHOUDI",firstName:"NAHYL",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"EVEN"},
"527":{lastName:"PAPAGEORGIOU",firstName:"ANDREAS",team:"CRG RACING TEAM",cat:"MINI GR3",parity:"ODD"},
"529":{lastName:"MADZHAROV",firstName:"MAXIM",team:"CRG RACING TEAM",cat:"MINI GR3",parity:"ODD"},
"532":{lastName:"SCHELVIS MORON",firstName:"ABRAHAM",team:"CRG RACING TEAM",cat:"MINI GR3",parity:"EVEN"},
"534":{lastName:"EBERGENYI",firstName:"GUIDO",team:"TEAM DRIVER RACING KART",cat:"MINI GR3",parity:"EVEN"},
"537":{lastName:"FERGUSON",firstName:"DANIEL",team:"TEAM DRIVER RACING KART",cat:"MINI GR3",parity:"ODD"},
"538":{lastName:"BUFFO",firstName:"ANDREA",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"EVEN"},
"539":{lastName:"KRALEV",firstName:"LEO",team:"TEAM DRIVER RACING KART",cat:"MINI GR3",parity:"ODD"},
"540":{lastName:"PACE",firstName:"ZANE",team:"TONY KART RACING TEAM SRL",cat:"MINI GR3",parity:"EVEN"},
"541":{lastName:"PADOVANI",firstName:"NAHIL",team:"TONY KART RACING TEAM SRL",cat:"MINI GR3",parity:"ODD"},
"543":{lastName:"BERETTA DUGAT",firstName:"FAREL",team:"TONY KART RACING TEAM SRL",cat:"MINI GR3",parity:"ODD"},
"544":{lastName:"ALMEKDAD",firstName:"GHAZI",team:"TEAM DRIVER RACING KART",cat:"MINI GR3",parity:"EVEN"},
"545":{lastName:"AAGTEN",firstName:"DAVID JOHANNES",team:"TONY KART RACING TEAM SRL",cat:"MINI GR3",parity:"ODD"},
"546":{lastName:"MAIR",firstName:"ALFIE RICHARD",team:"TONY KART RACING TEAM SRL",cat:"MINI GR3",parity:"EVEN"},
"547":{lastName:"MEDEIROS",firstName:"ALVARO",team:"TONY KART RACING TEAM SRL",cat:"MINI GR3",parity:"ODD"},
"548":{lastName:"TAMM",firstName:"JOONAS",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"EVEN"},
"549":{lastName:"DI MUNNO",firstName:"RYAN",team:"BORSCH RACING",cat:"MINI GR3",parity:"ODD"},
"550":{lastName:"MORTA",firstName:"WILLIAM",team:"MP ACADEMY GAMOTO",cat:"MINI GR3",parity:"EVEN"},
"551":{lastName:"GOMEZ CASTRO",firstName:"MATEO",team:"MP ACADEMY GAMOTO",cat:"MINI GR3",parity:"ODD"},
"552":{lastName:"STEINDAL",firstName:"THEO",team:"MP ACADEMY GAMOTO",cat:"MINI GR3",parity:"EVEN"},
"553":{lastName:"MIRARCHI",firstName:"ANTONIO MATTIA",team:"MONSTERK FACTORY TEAM",cat:"MINI GR3",parity:"ODD"},
"554":{lastName:"HALILOVIC",firstName:"DEMIR",team:"DPK RACING",cat:"MINI GR3",parity:"EVEN"},
"557":{lastName:"LENZO",firstName:"ANTONINO ROQUE",team:"NOVALUX SRL",cat:"MINI GR3",parity:"ODD"},
"558":{lastName:"KARJUS",firstName:"KONRAD",team:"NOVALUX SRL",cat:"MINI GR3",parity:"EVEN"},
"561":{lastName:"KORAMO",firstName:"EETU",team:"PAROLIN FINLAND",cat:"MINI GR3",parity:"ODD"},
"562":{lastName:"MACHAC",firstName:"ALEXANDR",team:"PAROLIN MOTORSPORT",cat:"MINI GR3",parity:"EVEN"},
"565":{lastName:"PHAROAH",firstName:"ARTHUR",team:"KIDIX DRIVER PERFORMANCE",cat:"MINI GR3",parity:"ODD"},
"567":{lastName:"GARRETT",firstName:"ALFIE",team:"SODIKART",cat:"MINI GR3",parity:"ODD"},
"569":{lastName:"TUZUNER",firstName:"CAN GUNFER",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"ODD"},
"571":{lastName:"PANTOLI",firstName:"AMINE",team:"SODIKART",cat:"MINI GR3",parity:"ODD"},
"572":{lastName:"PIRVU",firstName:"ADAM",team:"CRG RACING TEAM",cat:"MINI GR3",parity:"EVEN"},
"573":{lastName:"CUETO DOETS",firstName:"PEDRO MARCO",team:"MP ACADEMY GAMOTO",cat:"MINI GR3",parity:"ODD"},
"575":{lastName:"WARAKITSUPACHOK",firstName:"PHAWIN",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"ODD"},
"576":{lastName:"KLINKERS",firstName:"MIK",team:"ENERGY CORSE SRL",cat:"MINI GR3",parity:"EVEN"},
"577":{lastName:"STEC",firstName:"FILIP",team:"ENERGY CORSE SRL",cat:"MINI GR3",parity:"ODD"},
"578":{lastName:"SAGOO",firstName:"RUBEN",team:"TEAM DRIVER RACING KART",cat:"MINI GR3",parity:"EVEN"},
"584":{lastName:"VAN DE COTERLET",firstName:"JULIAN",team:"LENOVO KALI KART TEAM",cat:"MINI GR3",parity:"EVEN"},
"597":{lastName:"OTTAVIANI",firstName:"ALESSIO",team:"OTTAVIANI",cat:"MINI GR3",parity:"ODD"},
"603":{lastName:"LAIDVEE",firstName:"JOHANN",team:"NOVALUX SRL",cat:"MINI GR3",parity:"ODD"},
"605":{lastName:"TROULIS",firstName:"FILIPPOS",team:"LENOVO KALI KART TEAM",cat:"MINI GR3",parity:"ODD"},
"606":{lastName:"SOOFI",firstName:"TARIQ",team:"LENOVO KALI KART TEAM",cat:"MINI GR3",parity:"EVEN"},
"615":{lastName:"SULITKA",firstName:"NOE",team:"SULITKA DUSAN",cat:"MINI GR3",parity:"ODD"},
"616":{lastName:"SKALHAMMAR",firstName:"ELTON",team:"WARD RACING",cat:"MINI GR3",parity:"EVEN"},
"617":{lastName:"RUGET",firstName:"EDOUARD",team:"WARD RACING",cat:"MINI GR3",parity:"ODD"},
"620":{lastName:"DANYLIV",firstName:"NIKOLAI",team:"MVM RACING",cat:"MINI GR3",parity:"EVEN"},
"621":{lastName:"LEPP",firstName:"SIIM",team:"AIX RACING TEAM",cat:"MINI GR3",parity:"ODD"},
"630":{lastName:"BARBO",firstName:"LIAM",team:"SODIKART",cat:"MINI GR3",parity:"EVEN"},
"631":{lastName:"MATIUNIN",firstName:"YEHOR",team:"LA MOTORSPORT",cat:"MINI GR3",parity:"ODD"},
"632":{lastName:"LUTU ARIS",firstName:"ANDREI",team:"BIRELART RACING SRL",cat:"MINI GR3",parity:"EVEN"},
"642":{lastName:"PRABU",firstName:"AARUTHARAN",team:"KART CAMPUS SSD A R.L.",cat:"MINI GR3",parity:"EVEN"},
"643":{lastName:"KLEINER",firstName:"BASTIAN",team:"PANDA KART RACING",cat:"MINI GR3",parity:"ODD"},
"644":{lastName:"PIETRAS",firstName:"NICOLAJ",team:"LA MOTORSPORT",cat:"MINI GR3",parity:"EVEN"},
"645":{lastName:"GOMEZ",firstName:"AXEL",team:"EMILIA KART SRL",cat:"MINI GR3",parity:"ODD"},
"646":{lastName:"SARZINA",firstName:"FRANCESCO",team:"SODIKART",cat:"MINI GR3",parity:"EVEN"},
"647":{lastName:"YOON",firstName:"ISAAC",team:"BABYRACE DRIVER ACADEMY",cat:"MINI GR3",parity:"ODD"},
"655":{lastName:"LOTRIONTE",firstName:"NATHAN",team:"LOTRIONTE GIOVANNI",cat:"MINI GR3",parity:"ODD"},
"502":{lastName:"GODSCHALK",firstName:"ZEV",team:"KIDIX DRIVER PERFORMANCE",cat:"MINI U10",parity:"EVEN"},
"503":{lastName:"WOLFF",firstName:"JACK FYNN",team:"KR MOTORSPORT",cat:"MINI U10",parity:"ODD"},
"504":{lastName:"BOS",firstName:"DENVER",team:"KIDIX DRIVER PERFORMANCE",cat:"MINI U10",parity:"EVEN"},
"505":{lastName:"TICIANELLI",firstName:"ENRICO",team:"KIDIX DRIVER PERFORMANCE",cat:"MINI U10",parity:"ODD"},
"507":{lastName:"BROWN",firstName:"BRODY",team:"KIDIX DRIVER PERFORMANCE",cat:"MINI U10",parity:"ODD"},
"510":{lastName:"TORCHIA",firstName:"FERDINANDO",team:"BIRELART RACING SRL",cat:"MINI U10",parity:"EVEN"},
"513":{lastName:"SPINA",firstName:"MIGUEL",team:"BORSCH RACING",cat:"MINI U10",parity:"ODD"},
"514":{lastName:"EL HAOUTI",firstName:"ISAAC",team:"BABYRACE DRIVER ACADEMY",cat:"MINI U10",parity:"EVEN"},
"520":{lastName:"MIRAS Y MUNOZ",firstName:"SASHA",team:"BABYRACE DRIVER ACADEMY",cat:"MINI U10",parity:"EVEN"},
"525":{lastName:"FRANCISCO",firstName:"JAYDEN",team:"BABYRACE DRIVER ACADEMY",cat:"MINI U10",parity:"ODD"},
"530":{lastName:"MOREIRA",firstName:"AIDEN",team:"CRG RACING TEAM",cat:"MINI U10",parity:"EVEN"},
"531":{lastName:"BRONIKOWSKI",firstName:"OSKAR",team:"CRG RACING TEAM",cat:"MINI U10",parity:"ODD"},
"533":{lastName:"DUBININ",firstName:"OLEKSANDR",team:"BORSCH RACING",cat:"MINI U10",parity:"ODD"},
"535":{lastName:"VENTORINO",firstName:"GIOVANNI",team:"BABYRACE DRIVER ACADEMY",cat:"MINI U10",parity:"ODD"},
"536":{lastName:"WEYTJENS",firstName:"OLIVER",team:"TEAM DRIVER RACING KART",cat:"MINI U10",parity:"EVEN"},
"542":{lastName:"HSUEH",firstName:"BLAKE",team:"TONY KART RACING TEAM SRL",cat:"MINI U10",parity:"EVEN"},
"556":{lastName:"HEJNAR",firstName:"HUGO",team:"MONSTERK FACTORY TEAM",cat:"MINI U10",parity:"EVEN"},
"559":{lastName:"DIACONU",firstName:"ADAM",team:"NOVALUX SRL",cat:"MINI U10",parity:"ODD"},
"560":{lastName:"BORTOV",firstName:"NIKITA",team:"NOVALUX SRL",cat:"MINI U10",parity:"EVEN"},
"563":{lastName:"BURGESS",firstName:"ZAYNE",team:"PAROLIN MOTORSPORT",cat:"MINI U10",parity:"ODD"},
"564":{lastName:"PHAROAH",firstName:"ALBERT",team:"KIDIX DRIVER PERFORMANCE",cat:"MINI U10",parity:"EVEN"},
"568":{lastName:"SCHUBERT",firstName:"MAXIMILIAN",team:"MP ACADEMY GAMOTO",cat:"MINI U10",parity:"EVEN"},
"579":{lastName:"MICALLEF",firstName:"JAKE JORDAN",team:"NOVALUX SRL",cat:"MINI U10",parity:"ODD"},
"580":{lastName:"BERGER",firstName:"JOHAN",team:"BABYRACE DRIVER ACADEMY",cat:"MINI U10",parity:"EVEN"},
"581":{lastName:"ZVARICH",firstName:"MAX",team:"BABYRACE DRIVER ACADEMY",cat:"MINI U10",parity:"ODD"},
"588":{lastName:"BURDA",firstName:"MYKHAILO",team:"BORSCH RACING",cat:"MINI U10",parity:"EVEN"},
"590":{lastName:"SIMONE",firstName:"LEO",team:"PANTANO BY DAM",cat:"MINI U10",parity:"EVEN"},
"596":{lastName:"STASIONIS",firstName:"LUKAS",team:"NOVALUX SRL",cat:"MINI U10",parity:"EVEN"},
"598":{lastName:"CIUEANU",firstName:"DRAGOS",team:"7MOTORSPORT",cat:"MINI U10",parity:"EVEN"},
"599":{lastName:"TODORAN",firstName:"MATEI",team:"7MOTORSPORT",cat:"MINI U10",parity:"ODD"},
"604":{lastName:"JARTTU",firstName:"JAAKKO",team:"PAROLIN FINLAND",cat:"MINI U10",parity:"EVEN"},
"614":{lastName:"MIHAILOV",firstName:"STEN",team:"AIX RACING TEAM",cat:"MINI U10",parity:"EVEN"},
"625":{lastName:"RUMLENA",firstName:"VACLAV",team:"MVM RACING",cat:"MINI U10",parity:"ODD"},
"627":{lastName:"BERNHARD",firstName:"BEN",team:"ENERGY CORSE SRL",cat:"MINI U10",parity:"ODD"},
"635":{lastName:"FALAT",firstName:"HENDRIX",team:"PANTANO BY DAM",cat:"MINI U10",parity:"ODD"},
"636":{lastName:"WOODHALL",firstName:"OLIVER",team:"PANTANO BY DAM",cat:"MINI U10",parity:"EVEN"},
"648":{lastName:"YOON",firstName:"DANIEL",team:"BABYRACE DRIVER ACADEMY",cat:"MINI U10",parity:"EVEN"},
"649":{lastName:"FINEAS",firstName:"MICHAIL",team:"BABYRACE DRIVER ACADEMY",cat:"MINI U10",parity:"ODD"},
"650":{lastName:"PREVILLE",firstName:"CHARLIE",team:"BABYRACE DRIVER ACADEMY",cat:"MINI U10",parity:"EVEN"},
"651":{lastName:"ALLERSKOG",firstName:"WILLIAM",team:"WARD RACING",cat:"MINI U10",parity:"ODD"},
"652":{lastName:"VAVRA",firstName:"JAN",team:"MONSTERK FACTORY TEAM",cat:"MINI U10",parity:"EVEN"},
"653":{lastName:"IANNI",firstName:"STEFANO",team:"IANNI RICCARDO",cat:"MINI U10",parity:"ODD"},
"654":{lastName:"KOTOWSKI",firstName:"JACK",team:"BIRELART RACING SRL",cat:"MINI U10",parity:"EVEN"}
};

const FINALS=[
  {cat:"KZ2",time:"13.35",label:"KZ2 FINAL"},
  {cat:"OK",time:"14.05",label:"OK FINAL"},
  {cat:"OKJ",time:"14.35",label:"OKJ FINAL"},
  {cat:"MINI U10",time:"15.05",label:"MINI U10 FINAL"},
  {cat:"MINI GR3",time:"15.35",label:"MINI GR3 FINAL"},
  {cat:"OK-NJ",time:"16.05",label:"OK-NJ FINAL"}
];

// LOGIC_PLACEHOLDER

// ── MULTI-RACE STATE ──
let races={};
let activeRaceId=localStorage.getItem('rt_race')||'';

// ── MULTI-USER ──
// User from URL param ?user=name or localStorage fallback
function getUserId(){
  const params=new URLSearchParams(window.location.search);
  const urlUser=params.get('user');
  if(urlUser){localStorage.setItem('rt_user',urlUser);return urlUser.toLowerCase().trim();}
  return localStorage.getItem('rt_user')||'';
}
let currentUserId=getUserId();

let _upHl='foto';
function upHlHtml(){return[['foto','<i class="ic ic-hl-foto"></i><span>FOTO</span>'],['video','<i class="ic ic-hl-video"></i><span>VIDEO</span>']]
  .map(([k,h])=>'<div class="hl-option hl-'+k+(_upHl===k?' active':'')+'" onclick="setUpHl(\''+k+'\')">'+h+'</div>').join('');}
function setUpHl(k){_upHl=k;const el=document.getElementById('up-hl');if(el)el.innerHTML=upHlHtml();}
window.setUpHl=setUpHl;
function showUserPicker(){
  // 19/11/2026: con il login l'utente e' quello dell'accesso; solo l'admin puo' passare all'utente di prova per i test
  if(rtAuthGateOn()&&!RT_ADMINS.includes(_rtAuthUser)){openModal(rtAccountHtml());return;}
  // 19/11/2026 (Andrea): con il login niente passaggio agli altri account: solo il proprio utente e l'utente di prova
  if(rtIsAdmin()){rtAdminPanel();return;}
  if(_fbAuth){openModal(rtSwitchHtml());return;}
  _upHl='foto';
  // Get saved users from all races
  let savedUsers=JSON.parse(localStorage.getItem('rt_users')||'[]');
  // Also check current user
  if(currentUserId&&!savedUsers.includes(currentUserId))savedUsers.push(currentUserId);
  
  let usersHtml='';
  if(savedUsers.length){
    usersHtml='<div style="margin-bottom:16px">'
      +savedUsers.map(u=>'<button style="width:100%;padding:14px;background:var(--bg3);border:1.5px solid '+(u===currentUserId?'#22c55e':'var(--border2)')+';border-radius:10px;font-family:inherit;font-size:16px;font-weight:900;color:'+(u===currentUserId?'#22c55e':'var(--text)')+';cursor:pointer;margin-bottom:8px;letter-spacing:2px;text-transform:uppercase" onclick="selectSavedUser(\''+u+'\')">'
        +u+(u===currentUserId?' <i class="ic ic-check"></i>':'')+'</button>').join('')
      +'</div>'
      +'<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">'
      +'<div style="font-size:10px;color:var(--text4);font-weight:700;letter-spacing:1px;margin-bottom:8px">NUOVO UTENTE</div>';
  }

  openModal('<div class="modal-title">Chi sei?</div>'
    +'<div style="font-size:11px;color:var(--text4);margin-bottom:16px">Ogni utente ha i propri piloti, stati e note. Programma e entry list sono condivisi.</div>'
    +usersHtml
    +'<div class="form-group"><label class="form-label">'+(savedUsers.length?'Oppure aggiungi nuovo':'Il tuo nome')+'</label>'
    +'<input class="form-input" id="up-name" placeholder="es. Ricky" style="font-size:20px;font-weight:900;text-transform:lowercase" autocomplete="off"></div>'
    +'<div class="form-group"><label class="form-label">Lavori di più in</label><div class="hl-picker" id="up-hl">'+upHlHtml()+'</div></div>'
    +'<button class="form-submit" onclick="setUser()">ENTRA</button>'
    +(savedUsers.length?'</div>':''));
}

function rtSwitchHtml(){
  const prova=!rtAuthGateOn(),me=_rtAuthUser||'';
  const b=(lbl,on,act)=>['<button class="form-submit" style="margin-bottom:10px;background:',on?'#22c55e':'none',';border:1.5px solid ',on?'#22c55e':'var(--border2,#444)',';color:',on?'#000':'var(--text)','" onclick="',act,'">',lbl,'</button>'].join('');
  const h=['<div class="modal-title">Account</div>'];
  if(prova){h.push('<div style="font-size:13px;margin-bottom:14px">Sei nell\'<b>UTENTE PROVA</b> (dati di test).</div>');
    h.push(b('TORNA AL MIO ACCOUNT',false,"location.href=location.pathname"));return h.join('');}
  h.push(b([String(me).toUpperCase(),' <i class="ic ic-check"></i>'].join(''),true,'closeModal()'));
  h.push(rtAccountHtml().replace('<div class="modal-title">Account</div>',''));
  return h.join('');
}
function selectSavedUser(name){
  if(_fbAuth)return;   // con il login l'utente lo decide l'accesso
  currentUserId=name;
  localStorage.setItem('rt_user',name);
  const url=new URL(window.location);
  url.searchParams.set('user',name);
  window.history.replaceState({},'',url);
  closeModal();
  updateUserHeader();
  if(activeRaceId)listenRaceData(activeRaceId);
}
window.selectSavedUser=selectSavedUser;

function setUser(){
  if(_fbAuth)return;   // con il login l'utente lo decide l'accesso
  const name=document.getElementById('up-name').value.trim().toLowerCase();
  if(!name){alert('Inserisci il tuo nome');return;}
  currentUserId=name;
  localStorage.setItem('rt_user',name);
  // Save to users list
  let savedUsers=JSON.parse(localStorage.getItem('rt_users')||'[]');
  if(!savedUsers.includes(name))savedUsers.push(name);
  localStorage.setItem('rt_users',JSON.stringify(savedUsers));
  // 19/11/2026: lavoro predefinito scelto alla creazione dell'account (non sovrascrive quello di un account gia' esistente)
  try{const hl=_upHl;onValue(ref(db,'settings/'+name+'/defaultHl'),s=>{if(s.val()==null){const u2={};u2['settings/'+name+'/defaultHl']=hl;update(ref(db),u2);}},{onlyOnce:true});}catch(e){}
  // Also save to Firebase for cross-device
  if(activeRaceId){
    const u={};u['races_index/'+activeRaceId+'/knownUsers/'+name]=true;
    update(ref(db),u);
  }
  const url=new URL(window.location);
  url.searchParams.set('user',name);
  window.history.replaceState({},'',url);
  closeModal();
  updateUserHeader();
  if(activeRaceId)listenRaceData(activeRaceId);
}
window.setUser=setUser;
window.showUserPicker=showUserPicker;

/* ══ ACCESSO (19/11/2026, Andrea) — fase 1, senza chiudere il database ══
   Accesso una volta per telefono: Google oppure link via email. Sessione lunga (resta dentro finche' non esci).
   L'account e' collegato all'utente dell'app tramite authEmails/<email> (deciso dall'admin) -> authMap/<uid>.
   ?user=utente+prova resta valido per i test (il database e' ancora aperto: la chiusura e' la fase 3). */
var _fbAuth=null;try{_fbAuth=firebase.auth();}catch(e){_fbAuth=null;}
let _rtAuthUser='';   // utente dell'app ricavato dall'accesso
function rtAuthGateOn(){
  if(!_fbAuth)return false;
  const q=new URLSearchParams(location.search).get('user');
  if(q&&q.toLowerCase().trim()==='utente prova')return false;   // utente di prova per i test
  return true;
}
function rtEmailKey(e){return String(e||'').trim().toLowerCase().replace(/[.#$\[\]\/]/g,',');}
function rtAuthOverlay(html){
  let o=document.getElementById('rt-auth');
  if(!html){if(o)o.remove();return;}
  if(!o){o=document.createElement('div');o.id='rt-auth';document.body.appendChild(o);}
  o.innerHTML=html;try{window.hideLoader&&window.hideLoader();}catch(e){}
}
function rtLoginHtml(msg){
  return ['<div class="ra-box"><div class="ra-title">RACE TRACKER</div><div class="ra-sub">Accedi una volta su questo telefono: poi resti dentro.</div>',
    '<button class="ra-btn ra-google" onclick="rtLoginGoogle()"><span class="ra-g">G</span> Accedi con Google</button>',
    '<div class="ra-or">oppure</div>',
    '<input class="form-input" id="ra-email" type="email" inputmode="email" autocomplete="email" placeholder="la-tua@email.it">',
    '<button class="ra-btn" onclick="rtLoginEmail()">Mandami il link di accesso</button>',
    (msg?['<div class="ra-msg">',msg,'</div>'].join(''):''),'</div>'].join('');
}
function rtAccountHtml(){
  const u=_fbAuth&&_fbAuth.currentUser;
  return ['<div class="modal-title">Account</div><div style="font-size:13px;margin-bottom:6px">Utente: <b>',String(currentUserId||'').toUpperCase(),'</b></div>',
    '<div style="font-size:12px;color:var(--text3);margin-bottom:16px">',(u?String(u.email||''):''),'</div>',
    '<button class="form-submit" style="background:none;border:1.5px solid var(--border2,#444);color:var(--text)" onclick="rtLogout()">ESCI DA QUESTO TELEFONO</button>'].join('');
}
async function rtLoginGoogle(){
  const pr=new firebase.auth.GoogleAuthProvider();pr.setCustomParameters({prompt:'select_account'});
  try{await _fbAuth.signInWithPopup(pr);}
  catch(e){
    if(/popup|operation-not-supported|cancelled/.test(String(e&&e.code))){try{await _fbAuth.signInWithRedirect(pr);return;}catch(e2){e=e2;}}
    rtAuthOverlay(rtLoginHtml('Accesso con Google non riuscito ('+String(e&&e.code||'errore')+'). Prova con il link via email.'));
  }
}
async function rtLoginEmail(){
  const el=document.getElementById('ra-email');const em=String(el&&el.value||'').trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){rtAuthOverlay(rtLoginHtml('Scrivi un indirizzo email valido.'));return;}
  try{
    await _fbAuth.sendSignInLinkToEmail(em,{url:location.origin+location.pathname,handleCodeInApp:true});
    try{localStorage.setItem('rt_login_email',em);}catch(e){}
    rtAuthOverlay(rtLoginHtml('Ti ho mandato il link a <b>'+em.replace(/</g,'&lt;')+'</b>. Aprilo da questo telefono (guarda anche nello spam).'));
  }catch(e){rtAuthOverlay(rtLoginHtml('Invio non riuscito ('+String(e&&e.code||'errore')+'). Riprova tra poco.'));}
}
async function rtLogout(){try{await _fbAuth.signOut();}catch(e){}try{localStorage.removeItem('rt_user');}catch(e){}location.href=location.pathname;}
window.rtLoginGoogle=rtLoginGoogle;window.rtLoginEmail=rtLoginEmail;window.rtLogout=rtLogout;
// account -> utente dell'app: authMap/<uid>, altrimenti authEmails/<email> (deciso dall'admin) e si registra authMap
function rtResolveUser(u){
  return new Promise(res=>{
    onValue(ref(db,'authMap/'+u.uid),s=>{const v=s.val();if(v&&v.user)return res(String(v.user));
      onValue(ref(db,'authEmails/'+rtEmailKey(u.email)),s2=>{const w=s2.val();if(!w)return res('');
        const up={};up['authMap/'+u.uid]={user:String(w),email:String(u.email||''),at:Date.now()};
        update(ref(db),up).then(()=>res(String(w))).catch(()=>res(String(w)));},{onlyOnce:true});},{onlyOnce:true});
  });
}
function rtAuthStart(){
  if(!_fbAuth)return;
  // ritorno dal link via email
  try{if(_fbAuth.isSignInWithEmailLink(location.href)){
    let em='';try{em=localStorage.getItem('rt_login_email')||'';}catch(e){}
    if(!em)em=prompt('Conferma la tua email per completare l\'accesso')||'';
    _fbAuth.signInWithEmailLink(em,location.href).then(()=>{try{localStorage.removeItem('rt_login_email');}catch(e){}history.replaceState({},'',location.pathname);})
      .catch(e=>rtAuthOverlay(rtLoginHtml('Link non valido o scaduto ('+String(e&&e.code||'errore')+'). Chiedine un altro.')));
  }}catch(e){}
  try{_fbAuth.getRedirectResult().catch(e=>{if(rtAuthGateOn())rtAuthOverlay(rtLoginHtml('Accesso con Google non riuscito ('+String(e&&e.code||'errore')+').'));});}catch(e){}
  _fbAuth.onAuthStateChanged(async u=>{
    if(!rtAuthGateOn()){rtAuthOverlay('');return;}
    if(!u){rtAuthOverlay(rtLoginHtml(''));return;}
    const name=await rtResolveUser(u);
    if(!name){rtRequestScreen(u);return;}
    _rtAuthUser=name;rtAuthOverlay('');try{rtWatchRequests();}catch(e){}
    try{const up={};up['authMap/'+u.uid+'/last']=Date.now();update(ref(db),up);}catch(e){}   // ultimo accesso, per il pannello Utenti
    if(currentUserId!==name){
      currentUserId=name;try{localStorage.setItem('rt_user',name);}catch(e){}
      const url=new URL(location);url.searchParams.delete('user');history.replaceState({},'',url);
      updateUserHeader();if(activeRaceId)listenRaceData(activeRaceId);
    }
  });
}
/* ══ RICHIESTE DI ACCESSO e PANNELLO UTENTI (19/11/2026, Andrea) ══
   Mail non abilitata -> l'utente scrive il suo nome -> authRequests/<emailKey>. Solo l'admin (andrea) vede le richieste,
   approva (authEmails + authMap), rifiuta, abilita mail in anticipo, scollega. L'admin vede tutti gli utenti, gli altri solo se stessi.
   NB: finche' il database e' aperto e' un blocco dell'app, non del database (fase 3). */
const RT_ADMINS=['andrea','print'];   // 19/11/2026 (Andrea): super admin, per ora Andrea e Print
const RT_ADMIN='andrea';
let _rtReqOff=null;
function rtEsc(x){return String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function rtCleanName(x){return String(x||'').trim().toLowerCase().replace(/[.#$\[\]\/]/g,'').slice(0,30);}
function rtRequestScreen(u,msg){
  const k=rtEmailKey(u.email);
  onValue(ref(db,'authRequests/'+k),s=>{const r=s.val();
    const h=['<div class="ra-box"><div class="ra-title">RICHIESTA DI ACCESSO</div><div class="ra-sub">',rtEsc(u.email),'</div>'];
    if(r){h.push('<div class="ra-sub">Richiesta inviata come <b>',rtEsc(String(r.name).toUpperCase()),'</b>. Appena l\'amministratore approva entri da solo.</div>');}
    else{h.push('<input class="form-input" id="ra-name" placeholder="Il tuo nome (es. Ricky)" autocomplete="off">',
      '<button class="ra-btn" onclick="rtSendRequest()">Chiedi l\'accesso</button>');}
    if(msg)h.push('<div class="ra-msg">',msg,'</div>');
    h.push('<button class="ra-btn" style="background:none" onclick="rtLogout()">Esci</button></div>');
    rtAuthOverlay(h.join(''));},{onlyOnce:true});
  // quando l'admin approva, si entra senza ricaricare
  if(_rtReqOff)_rtReqOff();
  _rtReqOff=onValue(ref(db,'authMap/'+u.uid),s=>{const v=s.val();if(v&&v.user){if(_rtReqOff){_rtReqOff();_rtReqOff=null;}location.reload();}});
}
function rtSendRequest(){
  const u=_fbAuth&&_fbAuth.currentUser;if(!u)return;
  const el=document.getElementById('ra-name');const n=rtCleanName(el&&el.value);
  if(!n){rtRequestScreen(u,'Scrivi il tuo nome.');return;}
  const up={};up['authRequests/'+rtEmailKey(u.email)]={email:String(u.email||''),uid:u.uid,name:n,at:Date.now()};
  update(ref(db),up).then(()=>rtRequestScreen(u)).catch(()=>rtRequestScreen(u,'Invio non riuscito, riprova.'));
}
window.rtSendRequest=rtSendRequest;
function rtIsAdmin(){return !!_fbAuth&&rtAuthGateOn()&&RT_ADMINS.includes(_rtAuthUser);}
// pannello admin: utenti, richieste, mail abilitate
let _rtAdmTab='req';
function rtAdmTab(t){_rtAdmTab=t;rtAdminPanel();}
window.rtAdmTab=rtAdmTab;
function rtAgo(t){if(!t)return'mai';const m=Math.round((Date.now()-t)/60000);if(m<2)return'adesso';if(m<60)return[m,' min fa'].join('');
  const h=Math.round(m/60);if(h<24)return[h,' h fa'].join('');const d=Math.round(h/24);return d===1?'ieri':[d,' giorni fa'].join('');}
function rtAvatar(n){const c=['#22c55e','#f59e0b','#3b82f6','#ef4444','#a855f7','#14b8a6','#ec4899'];let x=0;String(n).split('').forEach(ch=>x+=ch.charCodeAt(0));
  return['<div class="adm-av" style="background:',c[x%c.length],'">',rtEsc(String(n).charAt(0).toUpperCase()),'</div>'].join('');}
// pannello admin: richieste, utenti, mail
function rtAdminPanel(){
  if(!rtIsAdmin())return;
  Promise.all(['settings','authRequests','authEmails','authMap'].map(k=>new Promise(res=>onValue(ref(db,k),s=>res(s.val()||{}),{onlyOnce:true}))))
  .then(([st,rq,em,mp])=>{
    const users=new Set(Object.keys(st));Object.values(em).forEach(v=>users.add(String(v)));users.delete('utente prova');
    const rqk=Object.keys(rq),emk=Object.keys(em).sort();
    // ultimo accesso e mail per utente
    const info={};Object.keys(mp).forEach(uid=>{const v=mp[uid];if(!v||!v.user)return;const i=info[v.user]||(info[v.user]={last:0,mails:[]});
      i.last=Math.max(i.last,v.last||v.at||0);if(v.email&&!i.mails.includes(v.email))i.mails.push(v.email);});
    const tab=(k,l,n)=>['<button class="adm-tab',_rtAdmTab===k?' on':'','" onclick="rtAdmTab(\'',k,'\')">',l,n?['<span class="adm-cnt">',n,'</span>'].join(''):'','</button>'].join('');
    const h=['<div class="adm"><div class="adm-head"><div class="adm-title">UTENTI</div><div class="adm-me">',rtEsc(String(_rtAuthUser).toUpperCase()),' · SUPER ADMIN</div></div>',
      '<div class="adm-tabs">',tab('req','Richieste',rqk.length),tab('usr','Utenti',0),tab('mail','Mail',0),'</div>'];
    if(_rtAdmTab==='req'){
      if(!rqk.length)h.push('<div class="adm-empty">Nessuna richiesta in attesa</div>');
      rqk.forEach(k=>{const r=rq[k];h.push('<div class="adm-card adm-req"><div class="adm-row">',rtAvatar(r.name),'<div class="adm-who"><div class="adm-mail">',rtEsc(r.email),'</div><div class="adm-sub">',rtAgo(r.at),'</div></div></div>',
        '<label class="adm-lbl">Entra come</label><input class="form-input adm-in" id="rq-',rtEsc(k),'" value="',rtEsc(r.name),'" autocomplete="off">',
        '<div class="adm-btns"><button class="adm-btn ok" onclick="rtApprove(\'',rtEsc(k),'\')">APPROVA</button><button class="adm-btn no" onclick="rtReject(\'',rtEsc(k),'\')">RIFIUTA</button></div></div>');});
    }else if(_rtAdmTab==='usr'){
      [...users].sort().forEach(n=>{const i=info[n]||{last:0,mails:[]},adm=RT_ADMINS.includes(n),me=n===currentUserId;
        h.push('<div class="adm-card',me?' me':'','"><div class="adm-row">',rtAvatar(n),'<div class="adm-who"><div class="adm-name">',rtEsc(n.toUpperCase()),
          '<span class="adm-role',adm?' sa':'','">',adm?'SUPER ADMIN':'UTENTE','</span></div><div class="adm-sub">',i.mails.length?rtEsc(i.mails.join(', ')):'nessuna mail collegata',' · ',rtAgo(i.last),'</div></div>',
          me?'<span class="adm-now">IN USO</span>':['<button class="adm-btn sm" onclick="rtViewAs(\'',rtEsc(n),'\')">GUARDA</button>'].join(''),'</div></div>');});
      h.push('<button class="adm-btn ghost" onclick="location.href=location.pathname+\'?user=utente%20prova\'">UTENTE PROVA (test)</button>');
    }else{
      h.push('<div class="adm-card"><label class="adm-lbl">Abilita una mail</label><input class="form-input adm-in" id="ad-email" type="email" inputmode="email" placeholder="mail@esempio.it" autocomplete="off">',
        '<input class="form-input adm-in" id="ad-name" placeholder="nome utente (es. ricky)" autocomplete="off"><button class="adm-btn ok" onclick="rtAdminAdd()">ABILITA</button></div>');
      emk.forEach(k=>{const n=String(em[k]),used=Object.values(mp).some(v=>v&&rtEmailKey(v.email)===k),lock=RT_ADMINS.includes(n)||rtEmailKey((_fbAuth.currentUser||{}).email)===k;
        h.push('<div class="adm-card"><div class="adm-row">',rtAvatar(n),'<div class="adm-who"><div class="adm-mail">',rtEsc(k.replace(/,/g,'.')),'</div><div class="adm-sub">→ <b>',rtEsc(n.toUpperCase()),'</b>',used?'':' · mai entrato','</div></div>',
          lock?'<span class="adm-now"><i class="ic ic-lock"></i></span>':['<button class="adm-btn sm no" onclick="rtUnlink(\'',rtEsc(k),'\')">SCOLLEGA</button>'].join(''),'</div></div>');});
    }
    h.push('<button class="adm-btn ghost" onclick="rtLogout()">ESCI DA QUESTO TELEFONO</button></div>');
    openModal(h.join(''));
  });
}
function rtApprove(k){
  if(!rtIsAdmin())return;
  onValue(ref(db,'authRequests/'+k),s=>{const r=s.val();if(!r)return rtAdminPanel();
    const el=document.getElementById('rq-'+k);const n=rtCleanName(el&&el.value)||rtCleanName(r.name);if(!n)return;
    const up={};up['authEmails/'+k]=n;up['authMap/'+r.uid]={user:n,email:String(r.email||''),at:Date.now(),by:_rtAuthUser};up['authRequests/'+k]=null;
    update(ref(db),up).then(()=>{if(!Object.keys(up).length)return;rtAdminPanel();});},{onlyOnce:true});
}
function rtReject(k){if(!rtIsAdmin())return;const up={};up['authRequests/'+k]=null;update(ref(db),up).then(rtAdminPanel);}
function rtAdminAdd(){
  if(!rtIsAdmin())return;
  const e=String((document.getElementById('ad-email')||{}).value||'').trim(),n=rtCleanName((document.getElementById('ad-name')||{}).value);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)||!n){alert('Serve una mail valida e un nome utente');return;}
  const up={};up['authEmails/'+rtEmailKey(e)]=n;update(ref(db),up).then(rtAdminPanel);
}
function rtUnlink(k){
  if(!rtIsAdmin())return;
  if(!confirm('Scollegare '+k.replace(/,/g,'.')+'? I suoi dati restano, solo non potra\' piu\' entrare.'))return;
  onValue(ref(db,'authMap'),s=>{const mp=s.val()||{};const up={};up['authEmails/'+k]=null;
    Object.keys(mp).forEach(uid=>{if(mp[uid]&&rtEmailKey(mp[uid].email)===k)up['authMap/'+uid]=null;});
    update(ref(db),up).then(rtAdminPanel);},{onlyOnce:true});
}
function rtViewAs(n){
  if(!rtIsAdmin())return;
  currentUserId=n;try{localStorage.setItem('rt_user',n);}catch(e){}
  closeModal();updateUserHeader();if(activeRaceId)listenRaceData(activeRaceId);
}
window.rtApprove=rtApprove;window.rtReject=rtReject;window.rtAdminAdd=rtAdminAdd;window.rtUnlink=rtUnlink;window.rtViewAs=rtViewAs;window.rtAdminPanel=rtAdminPanel;
// pallino rosso sul nome se ci sono richieste (solo admin)
let _rtReqWatch=false;
function rtWatchRequests(){
  if(_rtReqWatch||!rtIsAdmin())return;_rtReqWatch=true;
  onValue(ref(db,'authRequests'),s=>{const n=Object.keys(s.val()||{}).length;const el=document.getElementById('user-badge');
    if(el){el.style.boxShadow=n?'0 0 0 2px #ef4444':'';el.title=n?n+' richieste di accesso':'';}
    if(n&&!sessionStorage.getItem('rt_req_seen_'+n)){sessionStorage.setItem('rt_req_seen_'+n,'1');try{showToast&&showToast(n+' richiesta di accesso: tocca il tuo nome');}catch(e){}}});
}
function updateUserHeader(){
  const el=document.getElementById('user-badge');
  if(el)el.textContent=currentUserId?currentUserId.toUpperCase():'?';
}

let pilots=[];
let statuses={};
let notes={};
let trackSections=["PARTENZA","CURVA 1","RETTILINEO 1","CURVA 2","ESSE","RETTILINEO 2","ARRIVO"];
let trackStatus={};
// 15/11/2026 (Andrea): punti di scatto in pista, posizionati da ogni operatore sulla piantina, e fatti per pilota
let trackSpots={},spotDone={};
let teams=[];          // team seguiti dall'utente {key,name}
let teamStatuses={};   // pillole dei team
let teamNotes={};      // note dei team
let pilotsView=localStorage.getItem('rt_pview')||'piloti';
let initialized=false;
let activeTab=localStorage.getItem('rt_tab')||'piloti';
if(!ALL_TABS.includes(activeTab))activeTab='piloti';
let activeDay=localStorage.getItem('rt_day')||'';
let pistaView=localStorage.getItem('rt_pista')||'pilota';
let currentEntryList={};
let currentSchedule={};
let currentDays=[];
let currentFinals=[];     // finals for current race
let currentPartito=null;   // 19/11/2026: ultimo turno confermato con PARTITO ADESSO {day,time,at,by} (condiviso)
let currentBreaks=null;   // 19/11/2026: pause ufficiali per giorno {from,to} se la gara ha breaksSrc (letto dal Timetable)
// Durata della sessione dal programma ufficiale (campo "dur" della sessione, es. "12 giri" / "8'").
// Se il live timing riporta un numero di giri diverso (es. giri tolti per ritardo) il server scrive "durLive".
function slotDurText(s){
  if(!s||!s.dur)return'';
  const d=String(s.dur),l=s.durLive?String(s.durLive):'';
  return l&&l!==d?d+' (live: '+l+')':d;
}
function slotDur(slot){if(!slot||!slot.dur)return'';const d=String(slot.dur),l=slot.durLive?String(slot.durLive):'';return '<span class="slot-dur">'+(l&&l!==d?'<s>'+d+'</s> <b>'+l+'</b>':d)+'</span>';}

// ── THEME ──
if(localStorage.getItem('rt_theme')==='light') document.body.classList.add('light');
function applyThemeIcon(){
  const icon=document.getElementById('theme-icon');
  const label=document.getElementById('theme-label');
  const isLight=document.body.classList.contains('light');
  if(icon)icon.innerHTML=isLight?'<i class="ic ic-moon"></i>':'<i class="ic ic-sun"></i>';
  if(label)label.textContent=isLight?'TEMA SCURO':'TEMA CHIARO';
}
applyThemeIcon();
function toggleTheme(){
  document.body.classList.toggle('light');
  localStorage.setItem('rt_theme',document.body.classList.contains('light')?'light':'dark');
  applyThemeIcon();
}
window.toggleTheme=toggleTheme;

// ── SYNC ──
function setSyncStatus(s){
  const el=document.getElementById('sync-status');const dot=document.getElementById('conn-dot');if(!el)return;
  if(s==='ok'){el.textContent='LIVE';el.className='sync-status ok';dot.className='header-dot connected';}
  else if(s==='saving'){el.textContent='SAVING';el.className='sync-status';}
  else{el.textContent='OFFLINE';el.className='sync-status err';dot.className='header-dot';}
}

// ── Banner "senza rete": le modifiche fatte offline restano in coda e partono al ritorno della rete ──
let _rtOfflineTimer=null;
function showOfflineBanner(on){
  let el=document.getElementById('rt-offline');
  if(!on){if(el)el.remove();return;}
  if(!el){el=document.createElement('div');el.id='rt-offline';el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#7c2d12;color:#fff;font-size:12px;font-weight:700;text-align:center;padding:6px 10px;padding-top:calc(6px + env(safe-area-inset-top))';document.body.appendChild(el);}
  const t=window._rtSnapAt?new Date(window._rtSnapAt):null;
  el.innerHTML='<i class="ic ic-offline"></i> Senza rete — dati'+(t?' delle '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'):' salvati')+'. Le modifiche partono appena torna la rete.';
}
function watchConnection(){
  try{onValue(ref(db,'.info/connected'),snap=>{
    clearTimeout(_rtOfflineTimer);
    if(snap.val()===true){_rtOfflineTimer=null;showOfflineBanner(false);if(initialized)setSyncStatus('ok');}
    // 15/11 (Andrea): la barra compare solo se la connessione manca da 30 secondi (all'apertura la connessione impiega qualche secondo)
    else _rtOfflineTimer=setTimeout(()=>{showOfflineBanner(true);setSyncStatus('err');},30000);
  });}catch(e){}
  // 15/11 (Andrea): dopo un periodo in background o ad app chiusa i 30 secondi ripartono da zero al rientro (niente barra mentre si riconnette)
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;
    if(typeof _srvBadSince!=='undefined')_srvBadSince=0;
    if(document.getElementById('rt-offline')||_rtOfflineTimer){clearTimeout(_rtOfflineTimer);showOfflineBanner(false);
      _rtOfflineTimer=setTimeout(()=>{ref(db,'.info/connected').once('value').then(sn=>{if(sn.val()!==true){showOfflineBanner(true);setSyncStatus('err');}});},30000);}});
  window.addEventListener('offline',()=>{clearTimeout(_rtOfflineTimer);_rtOfflineTimer=setTimeout(()=>{if(!navigator.onLine){showOfflineBanner(true);setSyncStatus('err');}},30000);});
}

// ── Barra di stato: ora, ritardo condiviso, connessione ──
function updateStatusBar(){try{
  const n=new Date();const t=document.getElementById('sb-time');if(t)t.textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  const d=document.getElementById('sb-delay');if(d){const v=parseInt(scheduleDelay)||0;d.innerHTML='RITARDO <b class="d">'+(v>0?'+':'')+v+'\''+'</b>'+(apexAuto?' AUTO':'');}
  const c=document.getElementById('sb-conn');const off=!!document.getElementById('rt-offline');if(c){c.className=off?'off':'lv';c.textContent=off?'● OFFLINE':'● LIVE';}
  const h=document.querySelector('.header');if(h)document.documentElement.style.setProperty('--hdr-h',h.offsetHeight+'px');
}catch(e){}}
setInterval(updateStatusBar,5000);setTimeout(updateStatusBar,300);
// ── Scheletro di caricamento finché non arrivano i dati ──
(function(){try{const sk='<div class="skel" style="height:120px"></div><div class="skel" style="height:220px"></div><div class="skel" style="height:120px"></div>';
  ['schedule-content','pilots-list'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.innerHTML.trim())el.innerHTML=sk;});}catch(e){}})();
// ── FIREBASE: RACE LIST ──
let raceListUnsub=null;
let raceDataUnsub=null;

function listenRaces(){
  onValue(ref(db,'races_index'),snap=>{
    races=snap.val()||{};
    dlog('races_index ricevuto: '+Object.keys(races).length+' gare','ok');
    // Sync known users from Firebase to localStorage
    let savedUsers=JSON.parse(localStorage.getItem('rt_users')||'[]');
    Object.values(races).forEach(r=>{
      if(r.knownUsers){Object.keys(r.knownUsers).forEach(u=>{if(!savedUsers.includes(u))savedUsers.push(u);});}
    });
    localStorage.setItem('rt_users',JSON.stringify(savedUsers));
    setSyncStatus('ok');
    // If no active race but races exist, pick first
    if(!activeRaceId||!races[activeRaceId]){
      /* FIX 16/10/2026: niente piu' "prima gara della lista" (era la piu' vecchia, es. ACI con live WSK).
         Si sceglie la gara in corso oggi (startDate<=oggi<=endDate), altrimenti la piu' recente per createdAt. */
      const today=rtToday();
      const ids=Object.keys(races).sort((a,b)=>String((races[b]||{}).createdAt||'').localeCompare(String((races[a]||{}).createdAt||'')));
      const live=ids.find(id=>{const r=races[id]||{};return r.startDate&&r.endDate&&r.startDate<=today&&today<=r.endDate;});
      if(ids.length) switchRace(live||ids[0]);
      else{ initialized=true; renderAll(); }
    } else {
      /* FIX 17/10/2026: se la gara salvata e' gia' finita (endDate passata) e c'e' una gara in corso oggi, passa a quella */
      const _t=rtToday();
      const _cur=races[activeRaceId]||{};
      const _isLive=id=>{const r=races[id]||{};return r.startDate&&r.endDate&&r.startDate<=_t&&_t<=r.endDate;};
      /* 17/11/2026: con piu' gare in corso nello stesso giorno (campionati diversi) si resta sulla gara scelta se e' in corso */
      const _live=_isLive(activeRaceId)?activeRaceId:Object.keys(races).find(_isLive);
      /* 17/10 v2 (idea di Andrea): all'apertura segue il badge IN CORSO (stessa regola: startDate<=oggi<=endDate). Solo al primo caricamento, cosi' una scelta manuale successiva resta. */
      if(_live&&_live!==activeRaceId&&!window._rtAutoPicked){ window._rtAutoPicked=true; switchRace(_live); }
      else { window._rtAutoPicked=true; updateRaceHeader(); if(activeTab==='gare') renderGare(); if(initialized) bootTab(); }
    }
  },err=>{setSyncStatus('err');dlog('races_index: '+err.message,'err');console.error(err);});
}

/* copia dell'ultimo stato ricevuto dal server, base per salvare solo i campi cambiati (vedi rtDiff) */
var RT_SHARED_KEYS=['entryList','schedule','days','finals','trackSections','riskCut','schedDelay','apexAuto','partito'];
var RT_USER_KEYS=['pilots','statuses','notes','trackStatus','teams','teamStatuses','teamNotes','trackSpots','spotDone'];
var _rtBaseShared={},_rtBaseUser={};
function listenRaceData(raceId){
  if(raceDataUnsub) raceDataUnsub();
  _rtUserLiveKey='';
  /* 17/11/2026: i piloti aggiunti valgono solo per la gara in cui sono stati aggiunti */
  try{_rtNewPilots.clear();}catch(e){}
  if(!currentUserId){initialized=true;renderAll();return;}
  
  _rtBaseShared={};_rtBaseUser={};
  const sharedRef=ref(db,'races/'+raceId);
  const userRef=ref(db,'races/'+raceId+'/users/'+currentUserId);
  let sharedData={};let userData={};let sharedReady=false;let userReady=false;let userLive=false;
  // Modalità senza rete: ultima copia dei dati salvata sul dispositivo, mostrata subito e poi sostituita dai dati live
  window._rtLiveSeen=false;window._rtSnapAt=0;
  const snapKey='rt_snap_'+raceId+'_'+currentUserId;
  function saveSnap(){try{localStorage.setItem(snapKey,JSON.stringify({s:sharedData,u:userData,at:Date.now()}));}catch(e){}}
  try{const c=JSON.parse(localStorage.getItem(snapKey)||'null');if(c&&c.s&&c.u){sharedData=c.s;userData=c.u;rtSetBase(sharedData,userData);sharedReady=true;userReady=true;window._rtSnapAt=c.at;setTimeout(()=>{if(!window._rtLiveSeen)mergeAndRender();},0);}}catch(e){}

  function mergeAndRender(){
    if(!sharedReady||!userReady)return;
    currentEntryList=sharedData.entryList||{};window._rtElSig=Date.now();
    window._rtMedia=sharedData.media||{}; // 22/11/2026: contatori ClipSorter (mediaChip)
    currentSchedule=sharedData.schedule||{};
    currentDays=sharedData.days||Object.keys(currentSchedule);
    if(!Array.isArray(currentDays))currentDays=typeof currentDays==='object'?Object.values(currentDays):[];
    currentFinals=sharedData.finals||[];
    currentBreaks=sharedData.breaksSrc?(sharedData.breaks||{}):null;
    currentPartito=sharedData.partito||null;
    riskCutCfg=sharedData.riskCut||{};
    resultStatus=sharedData.resultStatus||{};
    if(!Array.isArray(currentFinals))currentFinals=typeof currentFinals==='object'?Object.values(currentFinals):[];
    trackSections=sharedData.trackSections||["PARTENZA","CURVA 1","RETTILINEO 1","CURVA 2","ESSE","RETTILINEO 2","ARRIVO"];
    // Ritardo e AUTO condivisi per tutta la gara (AUTO acceso di default)
    applySharedDelay(sharedData.schedDelay,sharedData.apexAuto!==false);
    pilots=userData.pilots?Object.values(userData.pilots):[];
    statuses=userData.statuses||{};
    notes=userData.notes||{};
    trackStatus=userData.trackStatus||{};
    _spRaceSpots=userData.trackSpots||{};
    trackSpots=Object.assign({},(_spVenueKey&&_spVenueKey===spotsVenuePath()&&_spVenueSpots)||{},_spRaceSpots);spotDone=userData.spotDone||{};
    try{spotsAttachVenue();}catch(_){}
    teams=userData.teams?Object.values(userData.teams):[];
    teamStatuses=userData.teamStatuses||{};
    teamNotes=userData.teamNotes||{};
    teams.forEach(t=>{
      if(!teamStatuses[t.key])teamStatuses[t.key]={};
      TASKS.forEach(k=>{if(!teamStatuses[t.key][k])teamStatuses[t.key][k]='red';});
      if(teamNotes[t.key]===undefined)teamNotes[t.key]='';
    });
    try{checkEliminations();}catch(e){}
    pilots.forEach(p=>{
      if(!p.group)p.group='';if(!p.prefinal)p.prefinal='';if(!p.serie)p.serie='';if(!p.eliminated)p.eliminated=false;
      // 15/11/2026: la prefinale ufficiale (entry list, aggiornata dal server per tutti) vale piu' del dato salvato sul pilota
      {const _e=currentEntryList&&currentEntryList[p.num];if(_e&&_e.prefinal&&String(_e.prefinal).toUpperCase()!==String(p.prefinal).toUpperCase())p.prefinal=String(_e.prefinal).toUpperCase();
       // 20/11/2026 (Andrea): anche la SERIE ufficiale (scritta dal server dai PDF WSK) vale piu' del dato salvato sul pilota
       if(_e&&_e.serie&&String(_e.serie)!==String(p.serie))p.serie=String(_e.serie);
       // 20/11/2026: e il GRUPPO ufficiale (server, classifica qualifiche WSK), se il pilota non ha l'elenco manche
       if(_e&&_e.group&&!(Array.isArray(p.heats)&&p.heats.length)&&String(_e.group).toUpperCase()!==String(p.group||'').toUpperCase())p.group=String(_e.group).toUpperCase();}
      if(!p.heats)p.heats=[];
      if(!Array.isArray(p.heats))p.heats=typeof p.heats==='object'?Object.values(p.heats):[];
      // 17/11/2026: manche ufficiali dall'entry list (il server le scrive per tutti, es. WSK) unite a quelle del pilota
      {const _e=currentEntryList&&currentEntryList[p.num];const _h=_e&&_e.heats?(Array.isArray(_e.heats)?_e.heats:Object.values(_e.heats)):[];if(_h.length){const _u=new Set(p.heats.map(h=>String(h).trim().toUpperCase()));_h.forEach(h=>_u.add(String(h).trim().toUpperCase()));if(_u.size!==p.heats.length)p.heats=[..._u];}}
      if(!p.inFinal)p.inFinal=false;
      // Normalize highlight to array
      if(p.highlight&&typeof p.highlight==='string')p.highlight=[p.highlight];
      if(p.highlight&&!Array.isArray(p.highlight)&&typeof p.highlight==='object')p.highlight=Object.values(p.highlight);
      if(!p.highlight||!Array.isArray(p.highlight))p.highlight=[];
      if(!statuses[p.num])statuses[p.num]={};
      TASKS.forEach(t=>{if(!statuses[p.num][t])statuses[p.num][t]='red';});
      if(!trackStatus[p.num])trackStatus[p.num]={};
      if(notes[p.num]===undefined)notes[p.num]='';
    });
    if(!activeDay||!currentDays.includes(activeDay)) activeDay=currentDays[0]||'';
    // salvataggi ammessi solo ora: dati locali allineati a quelli appena arrivati dal server
    // allineati anche con la copia salvata sul telefono (senza rete si puo' lavorare e salvare: parte al ritorno della rete)
    _rtUserLiveKey=raceId+'|'+currentUserId;
    setSyncStatus('ok');
    initialized=true;
    // 15/11: con la mappa dei punti aperta non ridisegna tutta l'app a ogni tocco (lentezza): lo fa alla chiusura
    if(window._rtDeferRender){window._rtRenderDirty=true;}else renderAll();
  }

  const unsub1=onValue(sharedRef,snap=>{
    sharedData=snap.val()||{};window._rtLiveSeen=true;saveSnap();rtSetBase(sharedData,null);
    dlog('Dati gara condivisi: entryList='+Object.keys(sharedData.entryList||{}).length+', days='+(sharedData.days||[]).length,'ok');
    sharedReady=true;
    mergeAndRender();
  },err=>{setSyncStatus('err');dlog('shared data: '+err.message,'err');});

  const unsub2=onValue(userRef,snap=>{
    userData=snap.val()||{};saveSnap();rtSetBase(null,userData);userLive=true;_rtUserLiveKey='';
    dlog('Dati utente ['+currentUserId+']: pilots='+Object.keys(userData.pilots||{}).length,'ok');
    userReady=true;
    mergeAndRender();
  },err=>{setSyncStatus('err');dlog('user data: '+err.message,'err');});

  // Storico avvisi condiviso fra i dispositivi dello stesso utente (tel + PC)
  const alertsRef=ref(db,'alertsLog/'+raceId+'/'+currentUserId);
  onValue(alertsRef,snap=>{try{
    const remote=Object.values(snap.val()||{}).filter(a=>a&&a.id);if(!remote.length){renderAlertLog();return;}
    const log=alertLog();const have=new Set(log.map(a=>a.id));let added=false;
    remote.forEach(a=>{if(!have.has(a.id)){log.push({id:a.id,title:a.title,sub:a.sub,kind:a.kind||'',hm:a.hm||'',ts:a.ts||0});added=true;}});
    if(!added)return;
    log.sort((x,y)=>(y.ts||0)-(x.ts||0)||String(y.hm).localeCompare(String(x.hm)));
    localStorage.setItem(alertKey(raceId),JSON.stringify(log.slice(0,300)));renderAlertLog();
  }catch(e){}});
  raceDataUnsub=()=>{off(sharedRef);off(userRef);off(alertsRef);};
}

function switchRace(raceId){
  activeRaceId=raceId;
  localStorage.setItem('rt_race',raceId);
  updateRaceHeader();
  listenRaceData(raceId);
  /* FIX 14/11 16:55: cambiando gara il live della gara precedente (altro circuito) restava collegato e i suoi
     numeri venivano confrontati con i piloti della nuova gara → falsi "USCITO". Ora si scollega e si ricollega subito. */
  try{if(apexWs){apexWs.onclose=null;apexWs.onmessage=null;apexWs.close();}clearTimeout(apexRetry);}catch(e){}
  try{apexWs=null;apexWsKey='';apexGrid.innerHTML='';apexState={cat:'',sess:'',start:'',red:'',at:0};apexConnect();}catch(e){}
}

function updateRaceHeader(){
  const el=document.getElementById('race-header-name');
  if(el&&races[activeRaceId]) el.textContent=races[activeRaceId].name||'';
}

// Start listening
dlog('App avviata — utente: '+(currentUserId||'NON IMPOSTATO'),'info');
dlog('Ascolto gare...','info');
listenRaces();
watchConnection();
if(activeRaceId&&currentUserId) listenRaceData(activeRaceId);
updateUserHeader();
// If no user set, show picker after a short delay (senza login; con il login l'utente arriva dall'accesso)
if(!currentUserId&&!rtAuthGateOn()){
  setTimeout(()=>{try{window.hideLoader&&window.hideLoader();}catch(e){}showUserPicker();},500);
}
rtAuthStart();

// ── SAVE HELPERS ──
function racePath(){return 'races/'+activeRaceId;}
function userPath(){return 'races/'+activeRaceId+'/users/'+currentUserId;}
/* 14/11/2026 (punto 2 criticita'): si salva SOLO cio' che e' cambiato rispetto all'ultima copia ricevuta dal server.
   Prima saveAll() riscriveva entryList/programma/piloti interi: un telefono con dati vecchi poteva cancellare
   i dati giusti scritti dal server o dall'altro utente. Ora: confronto campo per campo (foglia per foglia)
   e scrittura multipla solo dei campi diversi; nessuna scrittura se non e' cambiato nulla. */
function rtClone(x){try{return x==null?null:JSON.parse(JSON.stringify(x));}catch(e){return null;}}
function rtSetBase(sh,us){
  if(sh){const b={};RT_SHARED_KEYS.forEach(k=>{if(sh[k]!==undefined)b[k]=rtClone(sh[k]);});_rtBaseShared=b;}
  if(us){const b={};RT_USER_KEYS.forEach(k=>{if(us[k]!==undefined)b[k]=rtClone(us[k]);});_rtBaseUser=b;}
}
function rtFlat(v,p,out){
  if(v!==null&&typeof v==='object'){Object.keys(v).forEach(k=>rtFlat(v[k],p+'/'+k,out));return out;}
  if(v===undefined||v===null||(typeof v==='number'&&!isFinite(v)))return out;
  out[p]=v;return out;
}
function rtDiff(path,base,local,u){
  const b=rtFlat(rtClone(base),path,{}),l=rtFlat(rtClone(local),path,{});
  const sets=[];
  Object.keys(l).forEach(k=>{if(b[k]!==l[k]){u[k]=l[k];sets.push(k);}});
  Object.keys(b).forEach(k=>{
    if(k in l)return;
    if(sets.some(x=>k.indexOf(x+'/')===0||x.indexOf(k+'/')===0))return; // percorso gia' riscritto sopra o sotto
    u[k]=null;
  });
  return u;
}
function rtWrite(u,what){
  const n=Object.keys(u).length;
  if(!n){dlog('Salvataggio '+(what||'')+': nessuna modifica','info');return Promise.resolve();}
  setSyncStatus('saving');dlog('Salvataggio '+(what||'')+': '+n+' campi','info');
  return update(ref(db),u).then(()=>setSyncStatus('ok')).catch(e=>{setSyncStatus('err');console.error(e);dlog('salvataggio: '+e.message,'err');});
}
/* 15/11/2026 (bug #637 di Andrea): un pilota rimosso tornava indietro. Un dispositivo con dati vecchi in memoria
   (app riaperta dopo ore, cambio utente/gara prima che arrivino i dati nuovi) salvava di nuovo l'elenco vecchio.
   Difese: 1) niente salvataggi finche' non sono arrivati i dati aggiornati dell'utente per QUESTA gara;
   2) un pilota che non c'e' sul server viene ricreato solo se e' stato aggiunto in questa sessione. */
var _rtNewPilots=new Set(),_rtUserLiveKey='';
function saveAll(){
  if(!activeRaceId||!currentUserId)return;
  if(_rtUserLiveKey!==activeRaceId+'|'+currentUserId){dlog('Salvataggio rimandato: dati utente non ancora allineati','warn');clearTimeout(window._rtSaveRetry);window._rtSaveRetry=setTimeout(saveAll,1500);return;}
  const basePil=(_rtBaseUser&&_rtBaseUser.pilots)||{};
  const pilotsObj={};pilots.forEach(p=>{const k=String(p.num);if(basePil[k]||_rtNewPilots.has(k))pilotsObj[p.num]=p;else dlog('Pilota #'+k+' non piu\' sul server: non lo ricreo','warn');});
  const teamsObj={};teams.forEach(t=>teamsObj[t.key]=t);
  const uData={pilots:pilotsObj,statuses,notes,trackStatus,teams:teamsObj,teamStatuses,teamNotes};
  const sData={entryList:currentEntryList,schedule:currentSchedule,days:currentDays,finals:currentFinals,trackSections};
  const u={};
  Object.keys(uData).forEach(k=>rtDiff(userPath()+'/'+k,_rtBaseUser[k],uData[k],u));
  Object.keys(sData).forEach(k=>rtDiff(racePath()+'/'+k,_rtBaseShared[k],sData[k],u));
  rtWrite(u,'tutto');
}
function saveUserField(field,value){
  if(!activeRaceId||!currentUserId)return;
  rtWrite(rtDiff(userPath()+'/'+field,_rtBaseUser[field],value,{}),field);
}
function saveSharedField(field,value){
  if(!activeRaceId)return;
  rtWrite(rtDiff(racePath()+'/'+field,_rtBaseShared[field],value,{}),field);
}

// ── HELPERS ──
function cycleStatus(cur){const i=STATUS_CYCLE.indexOf(cur);return STATUS_CYCLE[(i+1)%STATUS_CYCLE.length];}
function catClass(cat){
  if(cat==='KZ2')return'cat-kz2';if(cat==='OK')return'cat-ok';if(cat==='OKJ')return'cat-okj';
  if(cat==='MINI GR3')return'cat-gr3';if(cat==='MINI U10')return'cat-u10';if(cat==='OK-NJ')return'cat-nj';if(cat==='OKN')return'cat-okn';
  /* 15/11/2026 (Andrea): le categorie cambiano da gara a gara: quelle non note prendono un colore stabile ricavato dal nome */
  const k=String(cat||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!k)return'';
  let hsh=0;for(let i=0;i<k.length;i++)hsh=(hsh*31+k.charCodeAt(i))>>>0;
  return'cat-dyn'+(hsh%8);
}
// Normalizza i nomi categoria scritti in modi diversi dagli organizzatori
function normCat(c){
  const s=String(c||'').trim().toUpperCase().replace(/\s+/g,' ');
  if(s==='OK-N'||s==='OK N'||s==='OKN')return'OKN';
  if(s==='OKNJ'||s==='OK-N J'||s==='OKN J'||s==='OK-N JUNIOR'||s==='OKN JUNIOR')return'OK-NJ';
  return s;
}
function autoParity(num){return parseInt(num)%2===0?'EVEN':'ODD';}
function lookupByNum(num){return currentEntryList[num.toString()]||null;}

// ── GROUP HELPERS ──
// Normalizza qualsiasi valore gruppo in una singola lettera maiuscola ('A'-'E')
// oppure '' se il valore non è valido.
const VALID_GROUPS=['A','B','C','D','E'];
function normalizeGroup(v){
  if(!v&&v!==0)return'';
  const s=String(v).trim().toUpperCase();
  return VALID_GROUPS.includes(s)?s:'';
}
// Restituisce true se il pilota appartiene a uno dei gruppi nell'array filterArr
// filterArr è sempre un array di lettere, es. ['A','B']
function canonCat(c){
  // Normalizza le diciture categoria tra competizioni (WSK/ACI/ecc.)
  // es. "MINI U10"=="MINI GR3 U10"=="MINI GR.3 U10"; "OK"=="OK-N"; "OKJ"=="OK-N JUNIOR"
  var s=String(c||'').toUpperCase().replace(/[.\-_]/g,'').replace(/\s+/g,'');
  if(s.indexOf('U10')>=0)return 'U10';
  if(s.indexOf('MINI')>=0)return 'MINIGR3';
  if(s.indexOf('KZ2')>=0)return 'KZ2';
  // Famiglia OK*: quattro classi DISTINTE (OK, OKJ, OK-N, OK-N JUNIOR) — match esatto, MAI per prefisso
  if(s==='OK')return 'OK';
  if(s==='OKJ'||s==='OKJUNIOR'||s==='OKJR')return 'OKJ';
  if(s==='OKN')return 'OKN';
  if(s==='OKNJ'||s==='OKNJUNIOR'||s==='OKNJR')return 'OKNJ';
  return s;
}
window.canonCat=canonCat;
/* manche gia' pubblicata da WSK per la categoria = almeno un pilota dell'entry list ce l'ha nei suoi heats */
let _hpCache={k:'',m:null};
function heatPublished(cat,key){try{const el=currentEntryList||{};const sig=Object.keys(el).length+'|'+(window._rtElSig||'');
  if(_hpCache.k!==sig||!_hpCache.m){const m={};Object.values(el).forEach(e=>{if(!e)return;const h=Array.isArray(e.heats)?e.heats:Object.values(e.heats||{});h.forEach(x=>{m[canonCat(e.cat)+'|'+String(x).trim().toUpperCase().split('-').map(y=>y.trim()).sort().join('-')]=1;});});_hpCache={k:sig,m};}
  return!!_hpCache.m[canonCat(cat)+'|'+key];}catch(e){return false;}}
function pilotInGroup(pilot,filterArr){
  // NUOVO: se il pilota ha heats[], controlla se questa coppia di gruppi è nella lista
  // es. filterArr=['A','B'] → cerca 'A-B' in pilot.heats
  if(pilot.heats&&Array.isArray(pilot.heats)&&pilot.heats.length){
    const slotKey=filterArr.map(x=>String(x).trim().toUpperCase()).sort().join('-');
    if(pilot.heats.some(h=>{
      const hKey=String(h).trim().toUpperCase().split('-').map(x=>x.trim()).sort().join('-');
      return hKey===slotKey;
    }))return true;
    // 20/11/2026: le manche note (heats) sono solo quelle gia' pubblicate (es. solo A-E venerdi'): per le altre
    // (A-B, A-C, A-D di sabato) si decide col gruppo ufficiale, altrimenti il programma di domani resta vuoto.
    // Se invece quella manche e' gia' pubblicata e il pilota non c'e', vale il documento ufficiale: non c'e'.
    if(heatPublished(pilot.cat,slotKey))return false;
  }
  // FALLBACK LEGACY: usa group singolo (20/11/2026: quello ufficiale dell'entry list se c'e')
  const _e=currentEntryList&&currentEntryList[pilot.num];
  const g=normalizeGroup((_e&&_e.group)||pilot.group);
  if(!g)return false;
  return filterArr.map(x=>String(x).trim().toUpperCase()).includes(g);
}

// Indica se il pilota ha dati gruppo validi (heats[] nuovo o group legacy)
function pilotHasGroupData(pilot){
  if(pilot.heats&&Array.isArray(pilot.heats)&&pilot.heats.length)return true;
  const _e=currentEntryList&&currentEntryList[pilot.num];
  return!!normalizeGroup((_e&&_e.group)||pilot.group);
}

function pilotsForSlot(slot){
  let _pf=false;try{_pf=progFilterOn();}catch(e){}
  return pilots.filter(p=>{
    if(p.eliminated)return false;
    if(_pf&&!myPilotMatches(p,progSearchMode,progSearchTeam,progSearchCat))return false;
    if(canonCat(p.cat)!==canonCat(slot.cat))return false;
    if(slot.type==='all')return true;
    if(slot.type==='parity')return p.parity===slot.filter;
    if(slot.type==='serie'){if(!pSerie(p))return false;return pSerie(p)===String(slot.filter).trim();}
    if(slot.type==='group')return pilotInGroup(p,slot.filter);
    if(slot.type==='prefinal'){if(!p.prefinal)return false;return String(p.prefinal).trim().toUpperCase()===String(slot.filter).trim().toUpperCase();}
    if(slot.type==='list'){if(!Array.isArray(slot.filter))return false;return slot.filter.map(String).includes(String(p.num));}
    return false;
  });
}
// Pilots of a category that are missing the required assignment for a slot type
function pilotsAwaitingData(slot){
  return pilots.filter(p=>{
    if(p.eliminated)return false;
    if(canonCat(p.cat)!==canonCat(slot.cat))return false;
    if(slot.type==='serie'&&!pSerie(p))return true;
    if(slot.type==='group'&&!pilotHasGroupData(p))return true;
    if(slot.type==='prefinal'&&!String(p.prefinal||'').trim())return true;
    return false;
  });
}
function slotFilterLabel(slot){
  if(slot.type==='parity')return slot.filter;
  if(slot.type==='serie')return'SERIE '+slot.filter;
  if(slot.type==='group')return'GRP '+slot.filter.join('+');
  if(slot.type==='prefinal')return'PREF '+slot.filter;
  if(slot.type==='list'){   // 19/11/2026 (Andrea): fascia di numeri del turno (es. 701–762) al posto di "LIST 62" (quanti numeri)
    let f=slot.filter||[];if(!Array.isArray(f))f=Object.values(f);const n=f.map(x=>parseInt(x)).filter(x=>!isNaN(x)).sort((a,b)=>a-b);
    if(!n.length)return'NUMERI';
    return n.length>1&&n[n.length-1]-n[0]===n.length-1?'N° '+n[0]+'–'+n[n.length-1]:(n.length<=3?'N° '+n.join(', '):n.length+' NUMERI');}
  return'ALL';
}
function taskBtn(num,task,small,readonly){
  const s=statuses[num]?.[task]||'red';
  const base=small?'padding:4px 8px;font-size:10px;':'';
  if(readonly)return'<button class="task-btn '+s+'" style="'+base+'cursor:default;pointer-events:none">'+task+'</button>';
  const sz=base?'style="'+base+'"':'';
  return'<button class="task-btn '+s+'" '+sz+' onclick="toggleTask(\''+num+'\',\''+task+'\')">'+task+'</button>';
}

// ── TOGGLE ──
function toggleTask(num,task){
  if(!statuses[num])statuses[num]={};
  statuses[num][task]=cycleStatus(statuses[num][task]||'red');
  pillSave('statuses',statuses);
  if(activeTab==='livetiming'){ // nel Live cambia solo il colore della pillola: niente ridisegno della pagina
    const st=statuses[num][task];
    document.querySelectorAll('button.task-btn').forEach(b=>{if(b.getAttribute('onclick')==="toggleTask('"+num+"','"+task+"')")b.className='task-btn '+st;});
    return;
  }
  pillPaint("toggleTask('"+num+"','"+task+"')",statuses[num][task]);
  pillRenderLater();
}
window.toggleTask=toggleTask;
/* 19/11/2026 (Andrea): "quando premo una pillola c'e' un attimo di lag". La pillola cambia colore subito (solo il suo DOM);
   il ridisegno della scheda (filtri, conteggi) parte dopo, uno solo anche con piu' tocchi di fila. */
function pillPaint(onclickStr,st){
  document.querySelectorAll('[onclick]').forEach(b=>{
    if(b.getAttribute('onclick')!==onclickStr)return;
    STATUS_CYCLE.forEach(c=>b.classList.remove(c));b.classList.add(st);
  });
}
// il salvataggio fa scattare subito il listener locale di Firebase (2 ridisegni completi): qui li si rimanda al ridisegno unico
function pillSave(field,value){
  const prev=window._rtDeferRender;window._rtDeferRender=true;
  try{saveUserField(field,value);}finally{window._rtDeferRender=prev;}
}
/* 19/11/2026 (Andrea): "perche' deve aggiornarsi tutta la pagina?" -> si ridisegna solo quello che dipende dallo stato:
   - filtro STATO attivo: la scheda (il pilota/team puo' dover sparire o comparire);
   - Vista generale aperta: solo il suo corpo (numeri colorati con PISTA);
   - sempre: i contatori "COSA MI MANCA" (solo i numeri). Tutto il resto resta com'e'. */
function missRefresh(){
  const els=document.querySelectorAll('.miss-chips');if(!els.length)return;
  const tmp=document.createElement('div');tmp.innerHTML=missingDashHtml();
  const src=tmp.querySelector('.miss-chips');if(!src)return;
  els.forEach(e=>{e.innerHTML=src.innerHTML;});
}
function pillRenderLater(){
  clearTimeout(window._pillRT);
  window._pillRT=setTimeout(()=>{
    if(window._rtDeferRender)return;   // c'e' un modale interattivo aperto: ridisegna lui alla chiusura
    window._rtRenderDirty=false;
    try{if(document.getElementById('ov-body'))renderOverviewBody();}catch(e){}
    if(filterStatuses.size){
      document.body.classList.add('quiet');try{renderAll();}catch(e){}
      clearTimeout(window._quietT);window._quietT=setTimeout(()=>document.body.classList.remove('quiet'),400);
    }else{try{missRefresh();}catch(e){}}
  },filterStatuses.size?700:150);
}

function toggleTrack(num,section){
  if(!trackStatus[num])trackStatus[num]={};
  trackStatus[num][section]=cycleStatus(trackStatus[num][section]||'none');
  saveUserField('trackStatus',trackStatus);renderPista();
}
window.toggleTrack=toggleTrack;

function saveNote(num){
  const el=document.getElementById('note-'+num);
  if(el){notes[num]=el.value;saveUserField('notes',notes);}
}
window.saveNote=saveNote;

function editPilotNote(num){
  const p=pilots.find(x=>x.num===num);const _e=(currentEntryList||{})[num]||{};
  const _nm=p?p.name:String((_e.lastName||'')+' '+(_e.firstName||'')).trim();
  const cur=(notes[num]||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>'
    +'<div class="modal-title">Nota #'+num+(_nm?' · '+String(_nm).replace(/</g,'&lt;'):'')+'</div>'
    +'<div class="form-group"><textarea class="form-textarea" id="pn-text" style="min-height:120px" placeholder="Commento, appunti, cosa fare...">'+cur+'</textarea></div>'
    +'<button class="form-submit" onclick="savePilotNote(\''+num+'\')">SALVA</button>'
    +reelPickerHtml(num)+(function(){const _p=pilots.find(x=>x.num===String(num));return _p?fotoRowHtml(_p,false):'';})()+persToggleHtml(num));
}
window.editPilotNote=editPilotNote;
function savePilotNote(num){
  const t=document.getElementById('pn-text');
  if(t){notes[num]=t.value;saveUserField('notes',notes);}
  closeModal();
  renderSchedule();
}
window.savePilotNote=savePilotNote;

function missingDashHtml(){
  if(!pilots.length)return'';
  const tot=pilots.length;
  const chips=TASKS.map(t=>{
    const done=pilots.filter(p=>(statuses[p.num]&&statuses[p.num][t])==='green').length;
    const full=done>=tot;
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:56px;padding:8px 4px;border:1px solid '+(full?'var(--accent)':'var(--border)')+';border-radius:10px;background:'+(full?'var(--accent-dim)':'var(--bg3)')+'">'
      +'<span style="font-size:9px;font-weight:800;letter-spacing:.3px;color:var(--text4)">'+t+'</span>'
      +'<span style="font-size:15px;font-weight:900;color:'+(full?'var(--accent)':'var(--text)')+'">'+done+'<span style="font-size:10px;color:var(--text4);font-weight:700">/'+tot+'</span></span>'
      +'</div>';
  }).join('');
  return '<div class="session-divider" style="margin-top:26px">COSA MI MANCA</div>'
    +'<div class="miss-chips" style="display:flex;gap:6px;flex-wrap:wrap">'+chips+'</div>'
    +'<div style="font-size:10px;color:var(--text4);text-align:center;padding:6px 0 2px">verde = completati sui '+tot+' tuoi piloti</div>';
}
window.missingDashHtml=missingDashHtml;

// ── EXPORT/IMPORT ──
function exportData(){
  const data={pilots,statuses,notes,trackSections,trackStatus,entryList:currentEntryList,schedule:currentSchedule,days:currentDays,finals:currentFinals,exportedAt:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='race-tracker-backup.json';a.click();URL.revokeObjectURL(url);
}
window.exportData=exportData;

function importData(event){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(data.pilots)pilots=Array.isArray(data.pilots)?data.pilots:Object.values(data.pilots);
      if(data.statuses)statuses=data.statuses;
      if(data.notes)notes=data.notes;
      if(data.trackSections)trackSections=data.trackSections;
      if(data.trackStatus)trackStatus=data.trackStatus;
      if(data.entryList)currentEntryList=data.entryList;
      if(data.schedule)currentSchedule=data.schedule;
      if(data.days)currentDays=data.days;
      if(data.finals)currentFinals=data.finals;
      saveAll();alert('Dati importati!');
    }catch(err){alert('File non valido');}
  };
  reader.readAsText(file);event.target.value='';
}
window.importData=importData;

// ── TABS + MENU ──
const NAV_LABELS={gara:'GARA',gare:'GARE',piloti:'PILOTI',programma:'PROGRAMMA',entrylist:'ENTRY LIST',livetiming:'LIVE TIMING',debug:'DEBUG'};

function toggleMenu(){document.getElementById('nav-overlay').classList.toggle('open');}
window.toggleMenu=toggleMenu;
function closeMenu(e){if(e.target===document.getElementById('nav-overlay'))document.getElementById('nav-overlay').classList.remove('open');}
window.closeMenu=closeMenu;
function navTo(tab){try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}var ov=document.getElementById('nav-overlay');if(ov)ov.classList.remove('open');showTab(tab);}
window.navTo=navTo;

function hideFabs(){
  const f1=document.getElementById('fab-now');if(f1)f1.classList.remove('visible');
  const f2=document.getElementById('fab-top');if(f2)f2.classList.remove('visible');
  const f3=document.getElementById('fab-top-piloti');if(f3)f3.classList.remove('visible');
  const f4=document.getElementById('fab-bottom');if(f4)f4.classList.remove('visible');
  const f5=document.getElementById('fab-bottom-piloti');if(f5)f5.classList.remove('visible');
  ['fab-top-live','fab-bottom-live'].forEach(i=>{const x=document.getElementById(i);if(x)x.classList.remove('visible');});
  if(_tickTimer){clearInterval(_tickTimer);_tickTimer=null;}
  if(_ltTimer){clearInterval(_ltTimer);_ltTimer=null;}
}

const TAB_ORDER=['gare','piloti','programma','entrylist','gara','livetiming','debug'];
function showTab(tab){
  const _prev=activeTab;
  if(_prev&&_prev!==tab){const el=document.getElementById('tab-'+tab);if(el){const d=TAB_ORDER.indexOf(tab)>TAB_ORDER.indexOf(_prev)?'r':'l';el.classList.remove('tab-in-r','tab-in-l');void el.offsetWidth;el.classList.add('tab-in-'+d);setTimeout(()=>el.classList.remove('tab-in-'+d),320);}}
  activeTab=tab;localStorage.setItem('rt_tab',tab);
  ALL_TABS.forEach(t=>{
    const el=document.getElementById('tab-'+t);if(el)el.style.display=t===tab?'':'none';
  });
  const navCur=document.getElementById('nav-current');
  if(navCur)navCur.textContent=(NAV_LABELS[tab]||tab);
  document.querySelectorAll('.nav-item').forEach(b=>{
    const t=b.getAttribute('onclick')||'';
    const match=t.match(/navTo\('(\w+)'\)/);
    if(match)b.classList.toggle('active',match[1]===tab);
  });
  document.querySelectorAll('.tabbar-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-tab')===tab));
  hideFabs();
  if(tab==='gare')renderGare();
  if(tab==='livetiming'){['fab-top-live','fab-bottom-live'].forEach(i=>{const x=document.getElementById(i);if(x)x.classList.add('visible');});}
  if(tab==='piloti'){renderPilots();const ft=document.getElementById('fab-top-piloti');if(ft)ft.classList.add('visible');const fb=document.getElementById('fab-bottom-piloti');if(fb)fb.classList.add('visible');}
  if(tab==='programma'){
    autoSelectToday();scheduleNeedsScroll=true;
    const dd=document.getElementById('delay-display');
    if(dd)dd.textContent=(scheduleDelay>0?'+':'')+scheduleDelay+' min';
    renderSchedule();
    if(typeof nowSlotKey==='function')_lastNowKey=nowSlotKey();
    applyDelayPerms();
  }
  if(tab==='entrylist')renderEntryList();
  if(tab==='debug')renderDebug();
  if(tab==='livetiming'){reloadLiveTiming();renderLtMyNums();if(typeof apexConnect==='function'&&activeRaceId)apexConnect();renderLtMyTable();}
  if(tab==='gara'){if(typeof apexConnect==='function'&&activeRaceId)apexConnect();renderAlertLog();}
}
window.showTab=showTab;

// ── FILTER ──
// 15/11/2026 (Andrea): filtri multipli e incrociabili.
// Task: piu' task accesi = basta che UNO dei task scelti sia nello stato scelto.
// Stato: piu' colori accesi = uno qualsiasi dei colori scelti.
// Evidenziazione: FOTO e VIDEO si sommano (foto O video); PRIORITA' restringe (solo prioritari).
const filterTasks=new Set(),filterStatuses=new Set(),filterHL=new Set(),filterReel=new Set();   // 20/11/2026: + durata video (reel)
function filtersActive(){return filterStatuses.size>0||filterHL.size>0||filterReel.size>0;}
function syncFilterChips(){
  document.querySelectorAll('.filter-chip[data-fk]').forEach(c=>{
    const k=c.getAttribute('data-fk'),v=c.getAttribute('data-fv');
    const set=k==='task'?filterTasks:k==='status'?filterStatuses:k==='reel'?filterReel:filterHL;
    const on=v==='all'?set.size===0:set.has(v);
    c.classList.toggle('active',on);c.setAttribute('aria-pressed',on);
  });
  // 20/11/2026: quanti filtri sono attivi, sul tasto FILTRI (si vede anche a pannello chiuso)
  const n=filterTasks.size+filterStatuses.size+filterHL.size+filterReel.size,el=document.getElementById('filt-count');
  if(el){el.textContent=n?String(n):'';el.classList.toggle('on',n>0);}
}
function toggleFilterPanel(force){
  const pn=document.getElementById('filt-panel'),bt=document.getElementById('filt-toggle');if(!pn)return;
  const open=typeof force==='boolean'?force:!pn.classList.contains('open');
  pn.classList.toggle('open',open);if(bt)bt.setAttribute('aria-expanded',open);
  try{localStorage.setItem('rt_filters_open',open?'1':'0');}catch(e){}
}
window.toggleFilterPanel=toggleFilterPanel;
(function(){const init=()=>{let o=false;try{o=localStorage.getItem('rt_filters_open')==='1';}catch(e){}toggleFilterPanel(o);syncFilterChips();};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();
function toggleFilter(kind,v){
  const set=kind==='task'?filterTasks:kind==='status'?filterStatuses:kind==='reel'?filterReel:filterHL;
  if(v==='all')set.clear();else if(set.has(v))set.delete(v);else set.add(v);
  try{if(navigator.vibrate)navigator.vibrate(10);}catch(e){}
  syncFilterChips();renderPilots();
}
window.toggleFilter=toggleFilter;
function setFilterTask(t){filterTasks.clear();if(t!=='all')filterTasks.add(t);syncFilterChips();renderPilots();}
window.setFilterTask=setFilterTask;
function setFilterStatus(s){filterStatuses.clear();if(s!=='all')filterStatuses.add(s);syncFilterChips();renderPilots();}
window.setFilterStatus=setFilterStatus;
function statusMatches(s){
  if(!filterStatuses.size)return true;
  const ts=filterTasks.size?[...filterTasks]:TASKS;
  return ts.some(t=>filterStatuses.has(s[t]||'red'));
}
function hlMatches(p){
  if(!filterHL.size)return true;
  const hl=Array.isArray(p.highlight)?p.highlight:[];
  if(filterHL.has('priority')&&hl.indexOf('priority')<0)return false;
  const want=['foto','video'].filter(x=>filterHL.has(x));
  return !want.length||want.some(x=>hl.indexOf(x)>=0);
}
function pilotMatchesFilter(p){
  if(!filtersActive())return true;
  return statusMatches(statuses[p.num]||{})&&hlMatches(p)&&reelMatches(p);
}
// durata video: solo piloti con VIDEO, con la durata scelta (30" se non impostata)
function reelMatches(p){if(!filterReel.size)return true;if(!hasVideo(p))return false;return filterReel.has(String(p.reel||'30'));}

// ══════════════════════════════════════
// DEBUG TAB
// ══════════════════════════════════════
async function runFirebaseTest(){
  debugLogs=[];
  dlog('Inizio test Firebase...','info');

  // Step 1: REST API test on root
  dlog('Step 1: Test REST API root (shallow)...','info');
  try{
    const r=await fetch('https://karting-tools-default-rtdb.firebaseio.com/.json?shallow=true');
    if(r.ok){const d=await r.json();dlog('REST root OK — chiavi: '+Object.keys(d||{}).join(', '),'ok');}
    else{dlog('REST root HTTP '+r.status,'err');}
  }catch(e){dlog('REST root: '+e.message,'err');}

  // Step 2: REST on /tracker (old path)
  dlog('Step 2: Test REST /tracker...','info');
  try{
    const r=await fetch('https://karting-tools-default-rtdb.firebaseio.com/tracker.json?shallow=true');
    if(r.ok){const d=await r.json();dlog(d?'/tracker esiste — chiavi: '+Object.keys(d).join(', '):'/tracker è vuoto/null','ok');}
    else{dlog('/tracker HTTP '+r.status,'err');}
  }catch(e){dlog('/tracker: '+e.message,'err');}

  // Step 3: REST on /races_index
  dlog('Step 3: Test REST /races_index...','info');
  try{
    const r=await fetch('https://karting-tools-default-rtdb.firebaseio.com/races_index.json');
    if(r.ok){const d=await r.json();dlog(d?'/races_index esiste — '+Object.keys(d).length+' gare':'/races_index vuoto — nessuna gara creata','ok');}
    else{dlog('/races_index HTTP '+r.status,'err');}
  }catch(e){dlog('/races_index: '+e.message,'err');}

  // Step 4: REST on active race
  if(activeRaceId){
    dlog('Step 4: Test REST /races/'+activeRaceId+'...','info');
    try{
      const r=await fetch('https://karting-tools-default-rtdb.firebaseio.com/races/'+activeRaceId+'.json?shallow=true');
      if(r.ok){const d=await r.json();dlog(d?'Gara attiva OK — chiavi: '+Object.keys(d).join(', '):'Gara attiva vuota','ok');}
      else{dlog('Gara attiva HTTP '+r.status,'err');}
    }catch(e){dlog('Gara attiva: '+e.message,'err');}
  } else {
    dlog('Step 4: Nessuna gara attiva selezionata','warn');
  }

  // Step 5: SDK WebSocket test
  dlog('Step 5: Test SDK .info/connected...','info');
  onValue(ref(db,'.info/connected'),snap=>{
    if(snap.val()===true)dlog('WebSocket CONNESSO','ok');
    else dlog('WebSocket non connesso','warn');
  },{onlyOnce:true});

  // Step 6: SDK write test
  dlog('Step 6: Test SDK scrittura...','info');
  try{
    await set(ref(db,'_test_ping'),{t:Date.now()});
    dlog('Scrittura SDK OK','ok');
    await set(ref(db,'_test_ping'),null); // cleanup
  }catch(e){
    dlog('Scrittura SDK fallita: '+e.message,'err');
    if(e.message.includes('PERMISSION_DENIED'))dlog('→ Le Firebase Rules bloccano la scrittura! Controlla le rules nella console Firebase.','err');
  }

  // Step 7: State summary
  dlog('Step 7: Stato app...','info');
  dlog('Race ID: '+(activeRaceId||'NESSUNA'),'info');
  dlog('Gare caricate: '+Object.keys(races).length,'info');
  dlog('Piloti: '+pilots.length,'info');
  dlog('Entry list: '+Object.keys(currentEntryList).length+' piloti','info');
  dlog('Schedule: '+currentDays.length+' giorni','info');
  dlog('URL: '+location.href,'info');
  dlog('Test completato ','ok');
}
window.runFirebaseTest=runFirebaseTest;

// ══════════════════════════════════════
// TAB GARE
// ══════════════════════════════════════
// Miniature dei circuiti (14/11/2026): sagoma della pista come icona nella scheda gara. Solo mappe reali, niente inventate.
// Lonato: dalla mappa ufficiale del circuito. Altri: tracciato OpenStreetMap (highway=raceway) semplificato, nord in alto.
const CIRCUIT_MAPS=[
  {re:/franciacorta|castrezzato/i, d:'M22 48L6 47L3 47L1 48L0 50L0 52L1 55L3 56L63 62L68 61L70 60L72 57L80 35L81 33L83 32L86 32L89 33L90 35L90 38L90 42L83 56L82 59L83 61L85 63L88 63L96 62L98 62L100 58L99 31L98 27L96 25L92 24L79 22L75 24L73 25L65 46L63 48L61 49L58 51L54 51L47 50L45 48L45 46L47 43L74 12L77 11L93 15L95 14L98 13L99 12L100 8L100 4L98 2L96 1L75 0L71 1L68 2L32 46L29 47Z'},
  {re:/cremona/i, d:'M57 6L91 11L98 13L99 15L100 17L100 19L99 20L97 22L94 22L89 20L77 15L59 13L57 13L55 14L53 15L52 17L48 29L49 31L51 34L65 39L69 38L70 36L70 35L70 33L59 27L58 26L58 24L59 22L60 21L73 22L77 24L83 40L84 42L83 44L80 46L64 47L58 46L6 26L2 23L1 19L0 16L1 7L1 4L3 2L5 1L9 0L30 3L31 4L32 6L32 8L31 12L29 14L27 14L14 9L12 9L9 10L8 14L9 16L11 18L30 26L32 26L34 26L37 24L41 10L43 7L45 6Z'},
  {re:/sarno|napoli/i, d:'M71 8L73 9L76 12L78 14L80 17L80 21L80 24L79 26L77 27L75 27L72 26L62 19L59 19L52 22L49 23L46 22L39 16L35 17L32 19L32 22L33 25L35 27L51 37L52 37L58 35L63 36L65 39L66 44L65 49L57 61L49 82L44 89L33 99L32 100L30 100L28 98L27 94L28 88L30 83L35 76L36 71L35 67L32 60L32 57L34 55L37 53L48 53L50 51L50 49L50 46L49 44L37 38L36 37L33 37L29 39L26 41L23 44L21 48L20 52L19 57L20 67L20 72L16 81L8 90L5 93L4 93L2 92L0 90L0 88L0 85L2 82L9 73L9 72L5 61L5 55L24 5L26 2L28 1L32 0L36 0Z'},
  {re:/viterbo/i, d:'M35 11L76 0L81 0L86 2L89 6L90 8L93 19L91 22L90 23L85 25L80 28L77 32L76 35L75 38L76 43L80 56L79 59L78 61L53 81L49 82L47 81L46 80L45 77L46 75L47 73L66 59L68 57L68 54L66 49L63 48L60 48L34 73L33 74L32 77L32 80L33 82L35 86L36 90L35 92L29 98L27 100L25 100L22 99L20 95L15 81L15 77L17 74L71 23L73 20L72 17L70 15L68 15L66 15L21 27L18 29L15 33L14 36L15 40L16 42L18 42L21 42L22 41L24 38L25 37L27 36L29 36L31 37L32 38L33 41L33 43L26 51L23 52L18 54L15 53L10 52L8 50L6 48L5 45L0 30L0 28L1 24L2 22L6 19Z'},
  {re:/la\s*conca|muro\s*leccese/i, d:'M6 63L8 66L11 67L68 61L78 63L98 54L100 52L99 48L97 46L93 46L73 52L66 51L60 49L50 36L45 25L46 23L53 18L54 15L49 3L47 1L42 0L39 1L15 11L13 13L13 15L15 20L17 21L20 20L29 16L31 17L32 18L48 50L48 52L46 54L43 55L16 58L14 57L12 54L12 43L14 40L28 33L29 31L27 27L25 27L2 36L1 38L0 40Z'},
  {re:/triscina/i, d:'M35 1L83 57L86 62L87 63L86 65L71 86L59 97L56 99L52 100L48 99L45 98L41 95L32 74L31 70L34 67L34 65L33 60L32 59L25 59L20 57L17 55L1 40L0 38L0 36L1 34L4 33L36 48L40 51L42 55L40 62L45 70L48 80L49 82L51 84L53 84L57 84L60 80L64 67L65 64L64 60L61 58L53 54L50 52L44 42L38 38L30 35L28 33L27 31L27 27L27 26L33 21L34 20L34 17L31 13L29 12L27 12L23 13L20 15L17 23L14 24L12 23L10 22L8 19L8 17L11 10L12 8L15 6L29 0L33 0Z'},
  {re:/ugento|salentina/i, d:'M3 43L0 72L2 79L7 86L26 98L30 97L31 95L34 43L36 40L39 40L42 41L44 50L44 59L41 89L42 91L45 94L49 94L52 93L54 90L55 88L55 70L53 53L50 36L48 33L46 31L44 30L30 29L28 30L25 34L23 67L22 70L19 71L15 71L12 69L11 66L17 15L19 13L22 11L26 11L50 22L63 31L64 34L63 47L63 50L81 61L85 61L91 60L96 58L99 53L100 47L99 43L95 39L91 39L88 40L83 46L81 47L74 44L73 42L76 30L75 28L47 9L24 0L19 0L15 1L10 3L7 8Z'},
  {re:/pista\s*azzurra|jesolo/i, d:'M40 58L20 67L18 66L14 64L0 45L0 41L2 39L4 38L7 39L17 56L19 58L21 59L22 58L25 57L25 56L26 53L24 50L14 37L14 34L16 33L18 32L21 34L23 36L31 49L33 50L36 51L52 43L54 40L53 37L52 36L51 36L30 34L29 33L28 31L28 29L29 27L48 19L49 19L51 20L56 28L58 29L60 30L63 29L66 27L68 25L67 21L58 9L57 7L58 5L59 2L60 1L62 0L67 0L77 7L80 8L83 8L93 5L94 5L98 6L100 8L100 14L93 39L92 40L90 40L77 38L72 40L66 44L58 49Z'},
  {re:/ala\s*karting|kartodromo\s*di\s*ala|\bala\b/i, d:'M8 47L30 4L35 1L41 0L46 1L65 8L69 11L72 15L73 21L69 46L68 50L65 52L62 53L59 52L58 50L57 47L61 28L61 22L59 18L57 15L54 13L50 12L46 11L41 11L38 13L35 15L33 19L10 61L10 66L12 68L15 70L18 70L21 68L23 65L34 33L36 30L40 29L43 29L46 31L47 34L47 49L50 56L55 61L60 64L66 66L70 68L70 70L70 74L68 77L65 79L61 78L50 70L40 61L36 60L33 62L31 65L30 69L31 73L34 76L63 88L66 89L67 91L67 95L66 98L63 100L58 100L39 87L35 85L32 85L22 87L19 86L5 77L2 73L0 68L0 63Z'},
  {re:/zuera/i, d:'M71 16L89 24L94 27L98 33L100 37L100 41L99 45L83 82L81 83L79 83L75 83L73 81L65 71L61 69L58 69L33 73L32 72L31 70L31 68L32 67L34 66L83 52L85 50L87 46L88 44L88 41L87 38L86 35L84 33L81 32L78 31L74 32L72 33L71 41L70 44L68 44L65 44L63 43L40 14L38 14L36 14L34 15L34 17L34 20L37 27L41 33L47 40L48 43L49 46L48 50L45 52L15 61L11 61L3 57L1 55L0 52L0 49L1 45L2 43L6 42L22 38L24 37L26 34L27 29L25 27L21 25L12 22L11 21L10 19L11 16L16 6L20 3L24 1L28 0L31 0L36 1Z'},
  {re:/le\s*mans/i, d:'M2 41L4 70L4 74L9 82L12 86L15 88L19 89L22 88L25 85L26 82L25 81L24 78L17 73L15 69L9 29L10 27L11 25L13 24L36 22L38 22L40 24L42 28L41 34L40 37L37 41L35 42L32 41L27 36L26 36L20 37L19 39L19 40L23 54L25 56L30 57L32 59L33 60L34 78L35 82L53 99L55 100L56 100L58 98L59 96L59 93L58 90L47 81L46 78L46 73L52 68L53 64L52 9L51 6L50 6L47 5L32 13L29 13L28 13L26 11L24 3L21 1L18 0L6 0L4 1L0 13Z'},
  {re:/genk/i, d:'M5 2L13 0L17 0L19 1L64 41L66 46L66 53L65 56L63 57L61 56L59 54L58 47L56 46L50 40L48 39L47 39L39 48L39 50L40 54L57 69L62 70L66 69L68 69L80 58L82 58L85 58L86 59L87 61L87 62L86 65L47 100L42 100L41 99L39 93L38 92L36 92L31 92L29 91L28 91L26 87L26 85L26 82L29 75L32 72L35 72L49 83L52 84L55 82L56 80L55 78L54 76L24 49L23 47L23 45L24 43L29 43L31 42L37 35L38 33L38 31L37 29L25 19L22 18L15 15L7 13L2 11L1 9L0 6L2 4Z'},
  {re:/kristianstad/i, d:'M88 51L77 88L73 93L68 95L65 95L61 94L45 88L44 86L43 84L46 75L45 73L42 71L29 67L25 66L21 66L6 68L2 68L1 67L0 64L0 61L2 56L4 55L7 52L17 49L21 48L22 49L24 54L26 55L27 55L57 53L58 53L60 51L60 49L60 47L58 42L56 41L22 28L17 25L16 23L16 21L16 19L21 17L25 17L42 24L44 24L46 24L59 21L61 20L62 18L61 15L60 14L58 13L49 10L47 7L47 5L48 1L49 0L51 0L74 3L76 5L78 10L77 11L68 25L66 28L66 31L66 34L67 36L68 37L73 39L77 40L79 40L81 39L83 36L83 33L85 19L87 10L92 4L95 3L97 3L98 4L100 8L100 11L99 15Z'},
  {re:/wackersdorf/i, d:'M80 36L63 40L59 39L57 37L57 30L56 27L54 26L50 26L38 29L13 34L10 36L8 39L8 40L9 42L10 44L13 44L20 43L44 34L47 35L48 38L46 41L44 42L36 45L23 47L10 49L8 49L5 49L1 46L0 43L1 37L3 34L8 29L14 27L44 20L49 17L55 9L60 6L75 0L80 0L86 3L88 5L100 25L100 27L99 29L97 30L93 28L89 23L87 16L85 13L84 11L79 9L74 10L60 15L58 16L57 18L58 20L59 21L61 21L63 21L73 17L75 17L79 18L82 28L82 31L82 35Z'},
  {re:/lonato|south\s*garda/i, img:'data:image/webp;base64,UklGRvALAABXRUJQVlA4WAoAAAAQAAAAfwAAfwAAQUxQSIQLAAAB8IZtu2m7trU9pZTaEdu2bTsZDIfCodgYioZjG4ftZNjImLFtDnuM7lZ9H0erpZRWezD+zoiAKMlq2AaktLWxKwt4PJw/oAde/++//JcI45w9yEeEfCdDsAd0ElHBUqVyUFS5wR884RQ3/sS/lvXr/2Y8nF86wB60mes7qPrney+UIiIhGAtiUQhD3PexwHiuQ7BtF3BMywWQ/vmgojHXZhj3c1IIeg+2D5g+ANiWAyBp2yPFshIZxZo88txjjYvI7rlfTQU9DMfDN4+UrvLEgjMeAEc6kPbjpUs30gEAqaeW9K+b6741NWiVb+GqfCuqNuKLNOlyF5J6tmV7AIDf9s3rWyu7vFWGuJ9MOX0NE5MpgXNhUFRLDfw0A4Dvamxdy7SloMBP30x/umpWus8uFZdgowsTpEOd8mOPpkK+6vrZaxkAAMdUTP0fPnq7R51CGlN2zyEv6y9w0YwCtNMeKFK7WeeenRsXMUiUeHjCx3d8xTRiyStIPrPhlY4l2H3gAU7F0uG7FYjrkcCIvbzEqk9O+/QnyGFgRpQwyLiw/ZWOCkbcM3gSVNv3kJSfmOpIxqISVRnyWAB+hhwU2Wo9NGLtySQ1FpXcSD23/VXZA+weSRs4uB0nC9Mv3dC5UzJVPFOoxZjN5+Sw9DSm6Re29Ysjfm/u1Q8WTsj340StF+0/fmL/muFNC2qzixlCNVUiokjbEetie+BAXuL3RMYhgvdJSDPvDqiadGLNuLaldNmgWQFTw4AKtRyx7vi/igcsG8fzc3YvZEZU1pIRzAKn4JiOlF4OACBy6f03OldKyDN9dMz0YhoPFGwTjcVkALCwU/NDCHmD2N04vDUq06LCeI5TsAGkpGrSS97Tm3eADeWNmMCvPJjigZFH4HnpBZUbcF1eZ/oUpy9gYkRUBK2B5ZvLWhUu3PDFpQf/kM75lgQ0rg/r6gdTuiuYywxDsJhhkDcDnl9PvlZQjx2nzh/ZNrZx7syfYuwsLDxBBqdqvut5nUjR3A36zvv6B1/ygPvDTdkF/o/fzOlXP3cI4GcJ7GHX9R0ZvgyaCkV/+3R86/xaSsl4CET7CQ5akDBoCiLYS/GCBUElP1DWKt3e3n1V4gSebZqyKf7Yv2xwEyUveQBQIo7y3obtX4tnkivfgm15vmtGpHz8+5t3Hi+quCuAlliSPxVAVeKMjsDGI9zQRjaX97fFn0g7KtvaavVB0qlNL3cqE09KCn4L10EXEtHJasL1ABmQLDmDUg7O7BGcylKJKBZzqOr7SC9OnHL/A6QUiAEdMuYyqrHpcWrUf963P0MtgZYnP9XNT2f0at/hyYW/wrMxhYRk9CUsfF6rYq2nlp2KSJsVsZVTw685XwZhIHSnmsDBj4kkqBZcHA+H3bqtyFbz6Smf3nJUuDNdaNS1sYQMaXaB45rlSNIyT805mCKfsiDrqS6VhAwNknSFhbNBrHaBie0kKNwQXBcG8RW6vbnnSgRqITZtW+Il25hgQVjlvOXbmE7xKo+hoo+/s09CR8+0IyddwL60oX91roTgSJj4krhB/RHBdDIyS5E1sViy3ah1R/+xNB/WXLlvM2g0LFxK5EzZMTmDCraf+NmfPmDdcCVWCf/8mkelSvkGIthIhkETozJSkcyaaoA/X+nWw5Z+dPLUtxsGVyBiCo3zTfTXr58pJTNf1ReSlHIpZ/CerMRoVVTmBjI9KqPCChdCcBbb1GBhgpNRviT4VikZX0KcanIt6ZtdP8uAajn4OiunD+THNWhKaGGGppbwUC4wBFPDQbJuDBdHdekjJArDVDqVWIwoR5PRO29JB7CQaB9M9MnMBw9cXKxZy5Y1syqN8V2gMTY+JKHLWB1IE3G1xU6sO+48PC+tWNxVOHgkgN2xURnNYggL1lpi/Ok0APh+fc+SpGBGpqQ1LKwiQ1kFNR25dNHgVoU1ThBMrVQF/vE9tM39K3y/ZnDZC34E6ymBx7p3/WVJAJQWIO27t1pJrUdAdDMlS2QRVGU/JE05vWFc+2J6JsUNOgsX7UulAU5p4pzqw/VTy8u+Ve5tdP7MByyl/JuW1HrsHlZZu/7YwlpFZakknGr/AdeKRFSCenr9Kx1KCnl98Ub+ZPhoVcsB/slDjDh9BQu3R5QltfPPP+wc4Jse8Ps36/ZekdHTAeCcW9SjtObaAN80mijB5zKJRrGyf8DxFZBWTSNX90zqXDEoVwPg4N/C7eHiurRLrEIyHCBj/7ut8xBRuem/AY4J4ECfYB1Gw/HfpADwTRMAzPObx3Uonyc+xKHViHhzAzFoIWzg2qZtp5IVuIkolcK59dG0pcm+7X9B7aJyI07OkZZpsCypsH+x+rAJ2DaQsbm1zFwkttt98XmpM1aKiPP37Uvnv/zyk1WrVr09cdKg3n36Tj0J30E7EozHia98C4uCnSnccuTKo38rRMo0HchLcNGcathAeiEpfgQ1uqLxLWA5wI/TgkBUGIuELaxa/+2/SmEodT9h1LOxmuSs2AcHdShBBekWg1ce/Uu+1jYjEQsYSaLwv3DRQc2THMO+TJLOSXtzZkjuoDzGQE+JkrWa/MUvUNT3groXUdUGNgRZlLPVR90PR6UxJRhCaEA6b73n53+t0IfIEBLEj3mW/60h47TUcHZdcDwDwL+fdOdERgioVUIgR+2+sz859+tvGY6LGPrbpOjkxS7IjBELldZUb5q95tMzFi96s6qEjs/DdvGekAeTn7Nk52eaB7wu9PsvpunBsmUvVqZc02Ytnu7Zc+SE8TNWLp/weJDDgtbDcT0APi6uH928iA72FPqgwiIJvgqOg73RXzW+VRGfhaoyQTOooQChoY+zKqbrK2GhwN5otUnnGoxQ1k+rYNvYq+8aeZiORegLuQb5GeOcC6EDHmm9gtbB0RAS0/LUJn1yl0rx2vesyhKC4WBfrkx1jdIyC9Tr1vOll0d2lZBRAbuAEHDGYuCvEKUzPBnwfD8m4ri3vpj7XOMCAczFGI6NwzkYz8xsM+9EEpR82T+xnoYehkDfIE9XwJN6JRdjaw5ZczJJbaFUxPnnu2eIhRgfi9BDUOfDMlxYpoJaV7/duXHmrNFDuz/Somb5gvljhGDuQRE/dY8N2N4PCVJT0GzYyiN/qo1DRIqDlTzEkP5PyDlZaqzVBHctC3p1U/+9eW3//r2bF06Z2L9vxx43YGMWlV/tAhMoXu2P89TpN//rH+UQdGwbmxinMINCDBZHU+BK6BK5vf/bbw/8KYGrjHSmZbuhwNfH5p5lqfSKt6UM4lzbx3WZvPNsCuBbAdkKcbNPcpGImepx9AZsD7g6s1PJeAk6O6+9FRvrHdvSbITlHUqVCMKO8e3LCg1F4DqgKNLzmm9575OgEONILjJiEtsecF3c7i1FEJfJfZYWfYdOnLVw5+4jR678kJRhI5b+ajoKV7Eub32lg/btnMrZW/kOLjJiFOLkkbwkZY+Cq1V67ILv+n8W13EtJvSu4QkFipat16Jrj1GjZy/Y+N6+kxduK5faaoFNv7h1bJtiWuhNSKjgerjBiVGYXy81lJZhlG47bOX+nz0ArofHKT7GGlXQYWEKA48fsP3DqR/d8dRc15CuEU2LkKITYfr7pBiP/asDd9OACes+vG4qu2fZwHOZaYcYYzrk1XYniVWenKUUZ0+iGjL+b1/Qv2nVjosivoUZsR+GcVoATwPYjoIQ+OFxEnf7CzSuRHjO+s8vOvS3soGRGG0y0mswTiHGeMC2LFODkEnnvxyT9y7PEC8q8zUZtPK7y6ZiGrFc37EspLchHq7F6nQdsprXP57Vp2FBIlLnvTFVAYeXfmzSBzcczcedFmGfxqDcr+w7eXDdmNalDSK6x1+ChXiBE1e+y6Tt535N/eXw5AIkMlVhtV3SffTlltBgSZFsRLFrfCxSwYxY36zcf6bMYA/0F8yM0QOv//df/lOEAFZQOCBGAAAAUAYAnQEqgACAAD4xGItEIiGhEEQAIAMEtLdwukgAJ7bEXiCo57Yi8QVHPbEXiCo57Yi8QVHPbEXiCbAA/v/WWAAAAAAAAA=='}
];
function circuitMapHtml(r,active,size){
  size=size||46;const inner=Math.round(size*0.87);
  const t=((r&&r.circuit)||'')+' '+((r&&r.name)||'');
  if(/·/.test((r&&r.circuit)||''))return'';
  const c=CIRCUIT_MAPS.find(x=>x.re.test(t));if(!c)return'';
  const box='flex-shrink:0;width:'+size+'px;height:'+size+'px;border-radius:'+Math.round(size*0.22)+'px;background:var(--bg3);color:'+(active?'var(--rt-orange,#ff5a1f)':'var(--text2)')+';display:flex;align-items:center;justify-content:center';
  if(c.d)return'<span class="race-map" style="'+box+'"><svg viewBox="-6 -6 112 112" width="'+inner+'" height="'+inner+'" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path d="'+c.d+'"/></svg></span>';
  return'<span class="race-map" style="'+box+'"><span style="width:'+(inner+2)+'px;height:'+(inner+2)+'px;background:currentColor;-webkit-mask:url('+c.img+') center/contain no-repeat;mask:url('+c.img+') center/contain no-repeat"></span></span>';
}
function renderGare(){
  const el=document.getElementById('gare-content');
  const raceIds=Object.keys(races).filter(id=>!isDemoRace(id)||canSeeDemo());
  let html='<div style="margin-bottom:16px">'
    +'<button class="mgmt-btn" onclick="openCalendar()" style="border-color:var(--rt-orange,#ff5a1f);color:var(--rt-orange,#ff5a1f);margin-bottom:8px"><i class="ic ic-calendar"></i> GARE DISPONIBILI</button>'
    +'<button class="mgmt-btn" onclick="openNewRace()" style="border-color:#22c55e;color:#22c55e">+ NUOVA GARA</button></div>';

  if(!raceIds.length){
    html+='<div class="empty-state"><p>Nessuna gara. Creane una!</p><p style="margin-top:8px;font-size:11px">Oppure i dati della gara WSK attuale verranno migrati automaticamente.</p></div>';
  } else {
    // Sort by startDate (earliest first), races without dates go to end
    const sorted=raceIds.map(id=>({id,...races[id]})).sort((a,b)=>{
      const da=a.startDate||'9999';const db2=b.startDate||'9999';
      return da.localeCompare(db2);
    });

    const today=new Date().toISOString().split('T')[0];
    let closestIdx=-1;let closestDiff=Infinity;

    html+='<div style="font-size:10px;color:var(--text4);font-weight:700;letter-spacing:1px;margin-bottom:10px">'+raceIds.length+' GARE</div>';
    sorted.forEach((r,idx)=>{
      const id=r.id;
      const isActive=id===activeRaceId;
      const entryCount=r.entryCount||0;
      const pilotCount=isActive?pilots.length:(r.pilotCount||0);
      const startD=r.startDate||'';
      const endD=r.endDate||'';

      // Find closest race to today for auto-scroll
      if(startD){
        const diff=Math.abs(new Date(startD)-new Date(today));
        // Prefer ongoing races (today between start and end)
        const isOngoing=startD<=today&&(endD>=today||!endD);
        if(isOngoing){closestIdx=idx;closestDiff=-1;}
        else if(closestDiff>0&&diff<closestDiff){closestDiff=diff;closestIdx=idx;}
      }

      // Format dates
      let dateStr='';
      if(startD&&endD){
        const s=formatDateShort(startD);const e=formatDateShort(endD);
        dateStr=s+' → '+e;
      } else if(startD){
        dateStr='Dal '+formatDateShort(startD);
      }

      // Is this race ongoing?
      const isOngoing=startD&&startD<=today&&(endD>=today||!endD);

      html+='<div class="race-card'+(isActive?' active-race':'')+'" id="race-card-'+idx+'" onclick="switchRaceAndRender(\''+id+'\')">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
        +'<div style="display:flex;gap:10px;align-items:flex-start;min-width:0">'+circuitMapHtml(r,isActive)+'<div><div class="race-name">'+r.name+(isActive?'<span class="race-badge">ATTIVA</span>':'')+'</div>'
        +'<div class="race-meta">'+(r.circuit||'')+(dateStr?' · '+dateStr:'')+'</div>'
        +'<div class="race-meta" style="margin-top:2px">'+pilotCount+' miei piloti · '+entryCount+' in entry list</div></div></div>'
        +(isOngoing?'<span style="font-size:9px;font-weight:800;color:#22c55e;border:1px solid #22c55e;padding:2px 8px;border-radius:4px;white-space:nowrap">IN CORSO</span>':'')
        +'</div>'
        +'<div style="display:flex;gap:6px;margin-top:10px">'
        +'<button class="io-btn" style="font-size:10px;padding:8px" onclick="event.stopPropagation();openRaceSettings(\''+id+'\')"><i class="ic ic-gear"></i> IMPOSTAZIONI</button>'
        +(isActive?'':'<button class="io-btn" style="font-size:10px;padding:8px;border-color:#ef4444;color:#ef4444" onclick="event.stopPropagation();deleteRace(\''+id+'\')"><i class="ic ic-close"></i> ELIMINA</button>')
        +'</div></div>';
    });

    // Auto-scroll to closest race
    if(closestIdx>=0){
      setTimeout(()=>{
        const card=document.getElementById('race-card-'+closestIdx);
        if(card)card.scrollIntoView({behavior:'smooth',block:'center'});
      },100);
    }
  }
  el.innerHTML=html;
}

function formatDateShort(dateStr){
  if(!dateStr)return'';
  const d=new Date(dateStr+'T00:00:00');
  const months=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  return d.getDate()+' '+months[d.getMonth()];
}

function switchRaceAndRender(id){switchRace(id);renderGare();}
window.switchRaceAndRender=switchRaceAndRender;

// ── ORGANIZZAZIONI E LIVE TIMING: dal catalogo orgs.json (14/11/2026, punto 6) ──
/* Prima organizzazioni, link live, categorie e porte Apex erano scritti nel codice. Ora stanno in orgs.json
   (si modifica senza toccare l'app). Ultima copia letta salvata sul telefono per l'avvio senza rete. */
let ORG_CONFIG={},ORG_KEYS=[],CIRCUIT_LIVE=[],APEX_LIVE_PORTS={};
function applyOrgCatalog(d){
  if(!d||typeof d!=='object'||!d.orgs)return false;
  ORG_CONFIG=d.orgs||{};ORG_KEYS=Object.keys(ORG_CONFIG);
  CIRCUIT_LIVE=(Array.isArray(d.circuitLive)?d.circuitLive:[]).map(x=>{try{return{re:new RegExp(x.match,'i'),url:String(x.url||'')};}catch(e){return null;}}).filter(x=>x&&x.url);
  APEX_LIVE_PORTS=d.apexPorts||{};
  return true;
}
try{applyOrgCatalog(JSON.parse(localStorage.getItem('rt_orgs')||'null'));}catch(e){}
function loadOrgCatalog(){
  fetch('orgs.json',{cache:'no-cache'}).then(r=>r.json()).then(d=>{
    if(!applyOrgCatalog(d))return;
    try{localStorage.setItem('rt_orgs',JSON.stringify(d));}catch(e){}
    dlog('Catalogo organizzazioni: '+ORG_KEYS.length+' org, '+CIRCUIT_LIVE.length+' circuiti','ok');
    try{if(activeRaceId){setLiveTimingSrc();apexConnect();}}catch(e){}
  }).catch(e=>dlog('orgs.json: '+e.message,'err'));
}
loadOrgCatalog();
function orgOptions(sel){
  const ks=ORG_KEYS.slice();if(sel&&!ORG_CONFIG[sel])ks.push(sel); // org della gara non in catalogo: resta selezionabile
  return '<option value="">— organizzazione —</option>'+ks.map(k=>'<option value="'+k+'"'+(k===sel?' selected':'')+'>'+((ORG_CONFIG[k]||{}).label||k)+'</option>').join('');
}
// Live timing automatico: 1) URL scritto nella gara  2) circuito riconosciuto  3) default dell'organizzazione
function resolveLiveUrl(r){
  r=r||{};
  // 19/11/2026 (Andrea): link del sito WSK (wskarting.it/livetiming.asp...) = live Apex 'wsk'. Solo per gare WSK.
  if(r.org==='WSK'&&/wskarting\.it/i.test(String(r.liveTiming||'')))return 'https://www.apex-timing.com/live-timing/wsk/index.html';
  if(r.liveTiming&&String(r.liveTiming).trim())return String(r.liveTiming).trim();
  const cfg=ORG_CONFIG[r.org]||null;
  /* 17/11/2026: organizzatori con live proprio (es. WSK a Lonato usa il suo, non quello del circuito) */
  if(cfg&&cfg.ownLive&&cfg.liveTiming)return cfg.liveTiming;
  const txt=(r.circuit||'')+' '+(r.name||'');
  const c=CIRCUIT_LIVE.find(x=>x.re.test(txt));
  if(c)return c.url;
  return cfg&&cfg.liveTiming?cfg.liveTiming:'';
}
window.resolveLiveUrl=resolveLiveUrl;
/* 19/11/2026 (Andrea): controllo del link live nelle impostazioni gara: si vede subito se l'app si collega al live */
function rtLiveCheck(){
  const el=document.getElementById('rs-lt-chk');if(!el)return;
  const v=k=>String((document.getElementById(k)||{}).value||'').trim();
  const cur=(typeof races!=='undefined'&&races[activeRaceId])||{};
  const r={liveTiming:v('rs-livetiming'),org:v('rs-org')||cur.org||'',circuit:cur.circuit||'',name:cur.name||''};
  const url=resolveLiveUrl(r);const m=url.match(/apex-timing\.com\/live-timing\/([a-z0-9\-]+)\//i);
  const name=m?m[1].toLowerCase():'',port=name?APEX_LIVE_PORTS[name]:0;
  el.innerHTML=name&&port?['<span style="color:#22c55e"><i class="ic ic-check"></i> Collegato al live <b>',name,'</b>',r.liveTiming?'':' (predefinito)','</span>'].join('')
    :name?['<span style="color:#f59e0b"><i class="ic ic-warn"></i> Live <b>',name,'</b> non ancora noto all\'app: niente orari automatici</span>'].join('')
    :'<span style="color:#ef4444"><i class="ic ic-warn"></i> Link non riconosciuto: niente live né orari automatici. Usa il link Apex (apex-timing.com/live-timing/…)</span>';
}
window.rtLiveCheck=rtLiveCheck;
// Embed live timing per-gara: usa l'URL della gara, fallback al default dell'organizzazione
function setLiveTimingSrc(){
  const f=document.getElementById('live-timing-frame');if(!f)return;
  const r=(typeof races!=='undefined'&&races[activeRaceId])?races[activeRaceId]:{};
  const cfg=ORG_CONFIG[r.org]||null;
  const url=resolveLiveUrl(r);
  const lbl=document.getElementById('live-timing-label');
  if(url){ /* 13/11/2026: vista Apex originale rimossa, l'iframe non si carica */ if(lbl)lbl.textContent=''+((cfg&&cfg.label)||'')+' LIVE TIMING'; }
  else { f.removeAttribute('src'); if(lbl)lbl.textContent='LIVE TIMING — imposta organizzazione/URL nelle impostazioni gara'; }
  /* FIX SCHERMO NERO (27/09/2026): l'iframe veniva creato con la tab nascosta e su mobile restava nero
     finche' non si premeva 'Aggiorna'. Ora: flag data-loaded impostato su onload; se entrando nel tab
     l'iframe non risulta caricato, si riassegna src (about:blank -> url) per forzare il load. */
  f.onload=function(){ if(f.getAttribute('src')&&f.getAttribute('src')!=='about:blank')f.dataset.loaded='1'; applyLiveCrop(); };
  /* iframe Apex non più caricato (vista rimossa il 13/11/2026) */
  applyLiveCrop();
}
window.setLiveTimingSrc=setLiveTimingSrc;
/* FIX LIVE BLOCCATO (17/10/2026, Lonato): il tasto Aggiorna non ricaricava (src uguale + loaded=1)
   e su iPhone il socket Apex nell'iframe resta congelato dopo blocco schermo/cambio app.
   Ora: Aggiorna forza il reload; rientrando nell'app sul tab Live l'iframe si ricarica da solo. */
function reloadLiveTiming(){
  const f=document.getElementById('live-timing-frame');if(!f)return;
  f.dataset.loaded='';setLiveTimingSrc();
}
window.reloadLiveTiming=reloadLiveTiming;
let _ltHiddenAt=0;
document.addEventListener('visibilitychange',function(){
  if(document.hidden){_ltHiddenAt=Date.now();return;}
  if(typeof activeTab!=='undefined'&&activeTab==='livetiming'&&Date.now()-_ltHiddenAt>3000)reloadLiveTiming();
});
let _ltTimer=null,_ltPaused=false;
function renderLtMyNums(){
  const box=document.getElementById('lt-mynums');if(!box)return;
  let slotsArr=[];let currentIdx=0;
  try{
    const slots=(typeof currentSchedule!=='undefined'&&currentSchedule)?currentSchedule[activeDay]:null;
    slotsArr=Array.isArray(slots)?slots:(slots&&typeof slots==='object'?Object.values(slots):[]);
    currentIdx=getCurrentSlotIndex(slotsArr);
  }catch(e){slotsArr=[];}
  /* 15/11/2026 (Andrea): solo il turno in corso e quelli dopo, finali comprese; il turno "ORA" si decide dall'orario
     (prima, finiti i turni, restava ferma sull'ultimo turno della mattina) */
  const toM=t=>{const pr=String(t||'').split('.');return parseInt(pr[0])*60+parseInt(pr[1]||0);};
  const nowM=new Date().getHours()*60+new Date().getMinutes()-(scheduleDelay||0);
  const all=slotsArr.map(sl=>({time:sl.time,label:sl.label||sl.cat||'',ps:pilotsForSlot(sl)}));
  if(activeDay===currentDays[currentDays.length-1])[].concat(currentFinals||[]).filter(Boolean).forEach(f=>{
    const ac=pilots.filter(p=>canonCat(p.cat)===canonCat(f.cat));const fin=ac.filter(p=>p.inFinal);
    all.push({time:f.time,label:'FINALE '+(f.cat||''),fc:canonCat(f.cat),ps:fin.length?fin:ac.filter(p=>!p.eliminated)});});
  all.sort((a,b)=>toM(a.time)-toM(b.time));
  let ni=-1;all.forEach((it,i)=>{if(toM(it.time)<=nowM)ni=i;});
  const _lf=liveFinalCat();if(_lf){const li=all.findIndex(it=>it.fc===_lf);if(li>=0)ni=li;}
  const items=[];
  all.forEach(function(it,i){
    if(i<ni)return;const isNow=i===ni;
    if(!it.ps.length&&!isNow)return;
    items.push({time:it.time,label:it.label,nums:it.ps.map(function(p){return p.num;}),now:isNow});
  });
  if(!items.length){box.style.display='none';box.innerHTML='';if(_ltTimer){clearInterval(_ltTimer);_ltTimer=null;}return;}
  box.style.display='block';
  box.innerHTML='<div id="lt-mini" style="display:flex;gap:8px;overflow-x:auto;white-space:nowrap;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px">'
    +items.map(function(it){
      const nums=it.nums.length?it.nums.map(function(n){return '#'+n;}).join(' '):'—';
      return '<div'+(it.now?' id="lt-mini-now"':'')+' style="flex-shrink:0;display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;border:1px solid '+(it.now?'var(--accent)':'var(--border2)')+';background:'+(it.now?'var(--accent-dim)':'var(--bg2)')+'">'
        +'<b style="color:#fbbf24;font-weight:900;font-size:13px;font-variant-numeric:tabular-nums">'+it.time+'</b>'
        +(it.label?'<span style="color:var(--text4);font-weight:700;font-size:10px;letter-spacing:.5px">'+it.label+'</span>':'')
        +'<span style="color:'+(it.now?'var(--accent)':'var(--text)')+';font-weight:800;font-size:13px;font-variant-numeric:tabular-nums">'+nums+'</span>'
        +(it.now?'<span style="color:var(--accent);font-weight:800;font-size:8px;letter-spacing:1px">ORA</span>':'')
        +'</div>';
    }).join('')
    +'</div>';
  const mini=document.getElementById('lt-mini');
  const nowEl=document.getElementById('lt-mini-now');
  if(mini&&nowEl){mini.scrollLeft=Math.max(0,nowEl.offsetLeft-12);}
  if(mini){
    if(!mini._bound){
      mini.addEventListener('touchstart',function(){_ltPaused=true;},{passive:true});
      mini.addEventListener('touchend',function(){setTimeout(function(){_ltPaused=false;},3000);},{passive:true});
      mini._bound=true;
    }
    if(_ltTimer)clearInterval(_ltTimer);
    _ltTimer=setInterval(function(){
      if(_ltPaused)return;
      const max=mini.scrollWidth-mini.clientWidth;
      if(max<=0)return;
      if(mini.scrollLeft>=max){mini.scrollLeft=0;}
      else{mini.scrollLeft=mini.scrollLeft+1;}
    },50);
  }
}
window.renderLtMyNums=renderLtMyNums;
function copyNum(n,btn){
  try{navigator.clipboard.writeText(n);}catch(e){}
  if(btn){const o=btn.innerHTML;btn.innerHTML='<i class="ic ic-check"></i>';setTimeout(function(){btn.innerHTML=o;},900);}
}
window.copyNum=copyNum;
function openLiveTimingTab(){
  const r=(typeof races!=='undefined'&&races[activeRaceId])?races[activeRaceId]:{};
  const cfg=ORG_CONFIG[r.org]||null;
  const url=resolveLiveUrl(r);
  if(url)window.open(url,'_blank','noopener');
  else alert('Nessun URL live timing impostato per questa gara. Impostalo nelle impostazioni gara o scegli un\'organizzazione.');
}
window.openLiveTimingTab=openLiveTimingTab;

// ── LIVE TIMING: modalità compatta (ritaglia l'intestazione apex, mostra dalla classifica in giù) ──
function ltGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}}
function ltSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function liveCropPx(){const v=parseInt(ltGet('rt_lt_crop2','560'),10);return isNaN(v)?560:v;}
function liveCompactOn(){return ltGet('rt_lt_compact','0')==='1';}
function applyLiveCrop(){
  const f=document.getElementById('live-timing-frame');if(!f)return;
  /* LIVE TIMING - RITAGLIO ALTO DISATTIVATO (27/09/2026, gara Viterbo).
   Motivo: le pagine degli organizzatori (es. YouCrono) sono contenitori con banner/header che
   incorporano il vero live timing Apex/LSTiming in un iframe. Il tasto "fullscreen" (4 frecce) del
   live Apex apre la pagina interna a se stante (link_fullscreen con href vuoto, vedi
   apex-timing.com/live-timing/commonv2/javascript/javascript_live_timing.min.js, fn tzfhv).
   Embeddando DIRETTAMENTE l'URL interno (es. https://www.apex-timing.com/live-timing/wsk/index.html)
   la pagina e' gia' pulita: nessun ritaglio necessario. Crop forzato a 0 e controlli nascosti.
   Per una nuova gara: nel campo URL Live Timing mettere l'<iframe src> interno, non la pagina contenitore. */
  // 13/11/2026: riattivato su richiesta di Andrea. Nella vista "Apex originale" si nasconde la parte alta
  // (commenti, migliori settori, mappa, loghi) e si parte dalla striscia "Next" in giù. Regolabile con −/+.
  let _v='mia';try{_v=ltView;}catch(e){_v=ltGet('rt_ltview','mia');}const on=_v==='apex';const px=on?liveCropPx():0;
  f.style.top=(-px)+'px';
  f.style.height='calc(100% + '+px+'px)';
  const adj=document.getElementById('lt-adjust');if(adj)adj.style.display=on?'flex':'none';
  const val=document.getElementById('lt-crop-val');if(val)val.textContent=px+'px';
  const btn=document.getElementById('lt-compact-btn');
  if(btn){btn.style.borderColor=on?'var(--accent)':'var(--border2)';btn.style.color=on?'var(--accent)':'var(--text2)';}
}
function toggleLiveCompact(){
  const on=!liveCompactOn();
  ltSet('rt_lt_compact',on?'1':'0');
  if(on&&!liveCropPx())ltSet('rt_lt_crop','300');
  applyLiveCrop();
}
function nudgeLiveCrop(d,reset){
  if(reset){ltSet('rt_lt_crop2','560');applyLiveCrop();return;}
  let px=liveCropPx()+d;if(px<0)px=0;if(px>2000)px=2000;
  ltSet('rt_lt_crop2',String(px));applyLiveCrop();
}
window.applyLiveCrop=applyLiveCrop;window.toggleLiveCompact=toggleLiveCompact;window.nudgeLiveCrop=nudgeLiveCrop;


// ── CALENDARIO GARE DISPONIBILI (dati da calendar.json, solo fonti ufficiali) ──
let calData=null,calOrg='',calSer='',calQ='';
const calSeriesOf=e=>String(e.name).replace(/\s+R\d+$/,'').replace(/\s+20\d\d$/,'').replace(/^\d+°\s+/,'');
const CAL_MONTHS=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
function calFmt(ev){
  if(!ev.dateFrom)return 'Data da annunciare';
  const a=ev.dateFrom.split('-'),b=(ev.dateTo||ev.dateFrom).split('-');
  const p=[];
  if(a[1]===b[1]){p.push(String(+a[2]),'–',String(+b[2]),' ',CAL_MONTHS[+a[1]-1].slice(0,3));}
  else{p.push(String(+a[2]),' ',CAL_MONTHS[+a[1]-1].slice(0,3),' – ',String(+b[2]),' ',CAL_MONTHS[+b[1]-1].slice(0,3));}
  return p.join('');
}
function calAdded(ev){
  return Object.keys(races||{}).some(id=>{const r=races[id]||{};return r.calId===ev.id||(r.name===ev.name&&ev.dateFrom&&r.startDate===ev.dateFrom);});
}
function openCalendar(){
  calQ='';
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button><div class="modal-title">Gare disponibili</div><input id="cal-q" type="search" placeholder="Cerca gara, circuito, città…" oninput="calQ=this.value;renderCalendar()" autocomplete="off" style="width:100%;min-height:44px;margin:0 0 10px;padding:10px 12px;border-radius:10px;border:1px solid var(--border,#333);background:var(--bg2,#151518);color:var(--text,#eee);font-size:15px;box-sizing:border-box"><div id="cal-body"><div class="empty-state"><p>Caricamento…</p></div></div>');
  if(calData){renderCalendar();return;}
  // 22/11/2026 (Andrea): calendario automatico. Alle gare di calendar.json si aggiungono quelle trovate dal server sui siti ufficiali
  // (calendarAuto/events: solo gare nuove). Se il nodo non risponde si mostra comunque calendar.json.
  const auto=new Promise(res=>{const t=setTimeout(()=>res(null),4000);try{_fbDb.ref('calendarAuto').once('value').then(s=>{clearTimeout(t);res(s.val());}).catch(()=>{clearTimeout(t);res(null);});}catch(e){clearTimeout(t);res(null);}});
  fetch('calendar.json',{cache:'no-cache'}).then(r=>r.json()).then(d=>auto.then(a=>{
    const ids=new Set((d.events||[]).map(e=>e.id));
    const extra=Object.values((a&&a.events)||{}).filter(e=>e&&e.id&&!ids.has(e.id));
    d.events=(d.events||[]).concat(extra);
    if(a&&a.updated&&a.updated>d.updated)d.updated=a.updated;
    calData=d;renderCalendar();})).catch(()=>{
    const el=document.getElementById('cal-body');if(el)el.innerHTML='<div class="empty-state"><p>Calendario non disponibile offline.</p></div>';
  });
}
function setCalOrg(o){calOrg=o;calSer='';renderCalendar();}
function setCalSer(i){const l=window._calSerList||[];calSer=i<0?'':l[i];renderCalendar();}
function renderCalendar(){
  const el=document.getElementById('cal-body');if(!el||!calData)return;
  const today=rtToday();
  const base=calData.events.filter(e=>!(e.dateTo&&e.dateTo<today)&&(!calOrg||e.org===calOrg));
  const sers=calOrg?[...new Set(base.map(calSeriesOf))]:[];window._calSerList=sers;
  const q=String(calQ||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const evs=base.filter(e=>(!calSer||calSeriesOf(e)===calSer)&&(!q||[e.name,e.series,e.org,e.circuit,e.city,(e.cats||[]).join(' ')].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(q)));
  const orgs=[...new Set(calData.events.map(e=>e.org))];
  const h=[];
  h.push('<div class="cal-orgs">');
  [''].concat(orgs).forEach(o=>{
    const lab=o?((ORG_CONFIG[o]||{}).label||o):'Tutte';
    h.push(`<button class="cal-org${o===calOrg?' on':''}" onclick="setCalOrg('${o}')">${lab}</button>`);
  });
  h.push('</div>');
  if(sers.length>1){
    h.push('<div class="cal-orgs cal-sers">');
    h.push(`<button class="cal-org${calSer?'':' on'}" onclick="setCalSer(-1)">Tutte</button>`);
    sers.forEach((x,i)=>h.push(`<button class="cal-org${x===calSer?' on':''}" onclick="setCalSer(${i})">${x.replace(new RegExp('^('+calOrg+'|Rotax MAX Challenge|Champions of the Future|Tillotson|FIA Karting)\\s+','i'),'')}</button>`));
    h.push('</div>');
  }
  const groups={};
  if(!evs.length)h.push('<div class="empty-state"><p>Nessuna gara trovata'+(q?' per “'+String(calQ).replace(/[<>&"]/g,'')+'”':'')+'.</p></div>');
  evs.forEach(e=>{const k=e.month||'zz';(groups[k]=groups[k]||[]).push(e);});
  Object.keys(groups).sort().forEach(k=>{
    const t=k==='zz'?'Data da annunciare':[CAL_MONTHS[+k.slice(5,7)-1],k.slice(0,4)].join(' ');
    h.push(`<div class="cal-month">${t}</div>`);
    groups[k].sort((x,y)=>(x.dateFrom||'9').localeCompare(y.dateFrom||'9')||String(x.org).localeCompare(String(y.org))).forEach(e=>{
      const added=calAdded(e);
      const cats=(e.cats||[]).join(' · ');
      h.push(`<div class="cal-item"><div class="cal-date">${calFmt(e)}</div>${circuitMapHtml({circuit:[e.circuit,e.city].filter(Boolean).join(' '),name:''},false,36)||'<span style="flex:0 0 36px"></span>'}<div class="cal-main">`);
      h.push(`<div class="cal-name">${e.name}</div><div class="cal-sub">${[e.circuit,e.city].filter(Boolean).join(' — ')}</div>`);
      if(cats)h.push(`<div class="cal-cats">${cats}</div>`);
      if(e.status!=='confermato'||e.note)h.push(`<div class="cal-note">${[e.status==='confermato'?'':'Provvisorio',e.note||''].filter(Boolean).join(' · ')}</div>`);
      h.push('</div>');
      h.push(added?'<span class="cal-added">Aggiunta</span>':`<button class="cal-add" onclick="addFromCalendar('${e.id}')">Aggiungi</button>`);
      h.push('</div>');
    });
  });
  if(!evs.length)h.push('<div class="empty-state"><p>Nessuna gara.</p></div>');
  if(calData.pending&&calData.pending.length)h.push(`<div class="cal-pending">${calData.pending.join(' · ')}</div>`);
  h.push(`<div class="cal-pending">Aggiornato al ${calData.updated.split('-').reverse().join('/')} · verifica sempre sul sito ufficiale</div>`);
  el.innerHTML=h.join('');
}
function addFromCalendar(id){
  const e=(calData.events||[]).find(x=>x.id===id);if(!e)return;
  openNewRace();
  const set=(k,v)=>{const i=document.getElementById(k);if(i)i.value=v||'';};
  set('nr-name',e.name);set('nr-circuit',e.circuit);set('nr-org',ORG_CONFIG[e.org]?e.org:'');
  set('nr-start',e.dateFrom);set('nr-end',e.dateTo);
  window._calPendingId=e.id;window._calDraft=null;
  // Bozza entry list preparata dal server dai PDF ufficiali (drafts/<calId>): se c'è, la gara nasce con l'entry list
  try{_fbDb.ref('drafts/'+e.id).once('value').then(s=>{
    const d=s.val();const n=d&&d.entryList?Object.keys(d.entryList).length:0;
    if(!n||window._calPendingId!==e.id)return;window._calDraft=d;
    const b=document.querySelector('.form-submit');
    if(b){const x=document.createElement('div');x.style.cssText='margin:0 0 10px;padding:10px 12px;border-radius:10px;background:rgba(79,214,156,.12);color:#4fd69c;font-size:13px';
      x.textContent='Entry list ufficiale pronta: '+n+' piloti (fonte: '+(d.source||'documenti ufficiali')+'). Verrà caricata con la gara.';b.parentNode.insertBefore(x,b);}
  });}catch(err){}
}
window.openCalendar=openCalendar;window.setCalOrg=setCalOrg;window.setCalSer=setCalSer;window.addFromCalendar=addFromCalendar;
function openNewRace(){
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>'
    +'<div class="modal-title">Nuova Gara</div>'
    +'<div class="form-group"><label class="form-label">Nome Gara</label>'
    +'<input class="form-input" id="nr-name" placeholder="es. WSK Super Master R1"></div>'
    +'<div class="form-group"><label class="form-label">Circuito</label>'
    +'<input class="form-input" id="nr-circuit" placeholder="es. Franciacorta"></div>'
    +'<div class="form-group"><label class="form-label">Organizzazione</label>'
    +'<select class="form-input" id="nr-org">'+orgOptions('')+'</select></div>'
    +'<div class="form-group"><label class="form-label">URL Live Timing (opzionale)</label>'
    +'<input class="form-input" id="nr-livetiming" placeholder="vuoto = default organizzazione"></div>'
    +'<div style="display:flex;gap:8px">'
    +'<div class="form-group" style="flex:1"><label class="form-label">Data Inizio</label>'
    +'<input class="form-input" id="nr-start" type="date"></div>'
    +'<div class="form-group" style="flex:1"><label class="form-label">Data Fine</label>'
    +'<input class="form-input" id="nr-end" type="date"></div></div>'
    +'<button class="form-submit" onclick="createRace()">CREA GARA</button>');
}
window.openNewRace=openNewRace;

function createRace(){
  const name=document.getElementById('nr-name').value.trim();
  const circuit=document.getElementById('nr-circuit').value.trim();
  const org=(document.getElementById('nr-org')||{}).value||'';
  const liveTiming=((document.getElementById('nr-livetiming')||{}).value||'').trim();
  const startDate=document.getElementById('nr-start').value||'';
  const endDate=document.getElementById('nr-end').value||'';
  if(!name){alert('Inserisci il nome');return;}
  const id='race_'+Date.now();
  const raceIndex={name,circuit,org,liveTiming,startDate,endDate,entryCount:0,pilotCount:0,createdAt:new Date().toISOString()};
  let draftEL={};
  if(window._calPendingId){raceIndex.calId=window._calPendingId;
    const d=window._calDraft;
    if(d&&d.calId===window._calPendingId&&d.entryList){
      Object.values(d.entryList).forEach(x=>{if(!x||!x.num)return;draftEL[x.num]={num:String(x.num),lastName:String(x.name||'').toUpperCase(),firstName:'',team:String(x.team||'').toUpperCase(),cat:x.cat||'',parity:parseInt(x.num)%2?'ODD':'EVEN'};});
      raceIndex.entryCount=Object.keys(draftEL).length;raceIndex.entrySource=d.source||'';
    }
    window._calPendingId=null;window._calDraft=null;}
  const u={};
  u['races_index/'+id]=raceIndex;
  u['races/'+id]={pilots:{},statuses:{},notes:{},trackSections:["PARTENZA","CURVA 1","RETTILINEO 1","CURVA 2","ESSE","RETTILINEO 2","ARRIVO"],trackStatus:{},entryList:draftEL,schedule:{},days:[],finals:[]};
  update(ref(db),u).then(()=>{
    switchRace(id);
    closeModal();
    showTab('gare');
  });
}
window.createRace=createRace;

function openRaceSettings(raceId){
  const r=races[raceId];if(!r)return;
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>'
    +'<div class="modal-title"><i class="ic ic-gear"></i> '+r.name+'</div>'
    +'<div class="form-group"><label class="form-label">Nome Gara</label>'
    +'<input class="form-input" id="rs-name" value="'+r.name+'"></div>'
    +'<div class="form-group"><label class="form-label">Circuito</label>'
    +'<input class="form-input" id="rs-circuit" value="'+(r.circuit||'')+'"></div>'
    +'<div class="form-group"><label class="form-label">Organizzazione</label>'
    +'<select class="form-input" id="rs-org" onchange="rtLiveCheck()">'+orgOptions(r.org||'')+'</select></div>'
    +'<div class="form-group"><label class="form-label">URL Live Timing (opzionale)</label>'
    +'<input class="form-input" id="rs-livetiming" value="'+(r.liveTiming||'')+'" placeholder="default organizzazione se vuoto" oninput="rtLiveCheck()">'
    +'<div id="rs-lt-chk" style="font-size:12px;font-weight:700;margin-top:6px"></div></div>'
    +'<div style="display:flex;gap:8px">'
    +'<div class="form-group" style="flex:1"><label class="form-label">Data Inizio</label>'
    +'<input class="form-input" id="rs-start" type="date" value="'+(r.startDate||'')+'"></div>'
    +'<div class="form-group" style="flex:1"><label class="form-label">Data Fine</label>'
    +'<input class="form-input" id="rs-end" type="date" value="'+(r.endDate||'')+'"></div></div>'
    /* 14/11/2026: orari delle premiazioni dal programma ufficiale (servono al server per gli avvisi pole/podio e al Programma) */
    /* 14/11/2026: percorso dei risultati Apex della gara (serve al server multi-gara per seguirla da solo) */
    +'<div class="form-group"><label class="form-label">Risultati ufficiali (link o percorso)</label>'
    +'<input class="form-input" id="rs-apex" placeholder="https://www.apex-timing.com/goracing/results.php?path=/…" value="'+(r.apexPath||'')+'">'
    +'<div style="font-size:11px;color:var(--text4);margin-top:4px">Con questo il server segue la gara da solo: entry list, gruppi, arrivi, live.</div></div>'
    +'<div class="form-group"><label class="form-label">Pagina con i PDF dell\'entry list (facoltativo)</label>'
    +'<input class="form-input" id="rs-elpage" placeholder="https://… (pagina con i PDF Entry List)" value="'+(r.entryListPage||'')+'">'
    +'<div style="font-size:11px;color:var(--text4);margin-top:4px">Prima che i risultati ufficiali abbiano i piloti, l\'app legge i PDF (anche scansionati): piloti segnati DA CONFERMARE.</div></div>'
    +'<div class="form-group"><label class="form-label">Premiazione poleman (se nel programma)</label>'
    +'<input class="form-input" id="rs-aw-pole" type="datetime-local" value="'+(((r.awards||{}).pole)||'')+'"></div>'
    +'<div class="form-group"><label class="form-label">Premiazione finali</label>'
    +'<input class="form-input" id="rs-aw-final" type="datetime-local" value="'+((((r.awards||{}).final)||'')==='dopo'?'':(((r.awards||{}).final)||''))+'">'
    +'<label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;color:var(--text2)"><input type="checkbox" id="rs-aw-dopo"'+((((r.awards||{}).final)||'')==='dopo'?' checked':'')+'> Subito dopo la finale di ogni categoria</label></div>'
    +'<button class="form-submit" onclick="saveRaceSettings(\''+raceId+'\')">SALVA</button>'
    +'<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">'
    +'<div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:12px;letter-spacing:1px">CARICA DATI</div>'
    +'<div class="upload-zone" onclick="document.getElementById(\'ul-entry\').click()">'
    +'<div class="upload-zone-label"><i class="ic ic-list"></i> ENTRY LIST</div>'
    +'<div class="upload-zone-hint">JSON con tutti i piloti iscritti</div>'
    +'<input type="file" id="ul-entry" accept=".json" style="display:none" onchange="uploadEntryList(event,\''+raceId+'\')"></div>'
    +'<div class="upload-zone" onclick="document.getElementById(\'ul-mypilots\').click()">'
    +'<div class="upload-zone-label"><i class="ic ic-star"></i> I MIEI PILOTI</div>'
    +'<div class="upload-zone-hint">JSON con la lista dei tuoi piloti da seguire</div>'
    +'<input type="file" id="ul-mypilots" accept=".json" style="display:none" onchange="uploadMyPilots(event,\''+raceId+'\')"></div>'
    +'<div class="upload-zone" onclick="document.getElementById(\'ul-schedule\').click()">'
    +'<div class="upload-zone-label"><i class="ic ic-calendar"></i> PROGRAMMA</div>'
    +'<div class="upload-zone-hint">JSON con orari e sessioni per giorno</div>'
    +'<input type="file" id="ul-schedule" accept=".json" style="display:none" onchange="uploadSchedule(event,\''+raceId+'\')"></div>'
    +'<div class="upload-zone" onclick="document.getElementById(\'ul-assign\').click()" style="border-color:#fbbf24">'
    +'<div class="upload-zone-label" style="color:#fbbf24"><i class="ic ic-refresh"></i> AGGIORNA ASSEGNAZIONI</div>'
    +'<div class="upload-zone-hint">Gruppi, serie, prefinal dai risultati ufficiali.<br>Piloti assenti = eliminati automaticamente.</div>'
    +'<input type="file" id="ul-assign" accept=".json" style="display:none" onchange="uploadAssignments(event,\''+raceId+'\')"></div>'
    +'<div class="upload-zone" style="border-color:#a78bfa;cursor:pointer" onclick="openWSKPasteModal(\''+raceId+'\')">'
    +'<div class="upload-zone-label" style="color:#a78bfa"><i class="ic ic-download"></i> INCOLLA HEATS DA WSK</div>'
    +'<div class="upload-zone-hint">Incolla il JSON generato dal bookmarklet WSK.<br>Aggiorna automaticamente le heat di tutti i piloti.</div>'
    +'</div>'
    +'<button class="mgmt-btn" style="margin-top:4px;border-color:#a78bfa;color:#a78bfa" onclick="closeModal();showWSKBookmarklet()"><i class="ic ic-bookmark"></i> MOSTRA BOOKMARKLET WSK</button>'
    +'</div>');
  setTimeout(rtLiveCheck,0);
}
window.openRaceSettings=openRaceSettings;

// ── WSK HEATS: paste modal + bookmarklet ──
function openWSKPasteModal(raceId){
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>'
    +'<div class="modal-title"><i class="ic ic-download"></i> Incolla Heats da WSK</div>'
    +'<div style="font-size:11px;color:var(--text4);margin-bottom:14px;line-height:1.6">'
    +'1. Vai su <strong style="color:var(--text)">wskarting.it/results/results.asp</strong><br>'
    +'2. Clicca il bookmarklet <strong style="color:#a78bfa">WSK Heats</strong> nella barra segnalibri<br>'
    +'3. Aspetta qualche secondo, poi incolla qui sotto</div>'
    +'<div class="form-group"><label class="form-label">JSON copiato dal bookmarklet</label>'
    +'<textarea class="form-textarea" id="wsk-paste-input" placeholder=\'[{"num":"563","heats":["B-C","B-D"]}, ...]\' style="min-height:120px;font-size:11px"></textarea></div>'
    +'<button class="form-submit" onclick="applyWSKHeats(\''+raceId+'\')">APPLICA</button>');
  // Prova a leggere dagli appunti automaticamente
  navigator.clipboard.readText().then(text=>{
    if(text&&text.trim().startsWith('[')){
      const el=document.getElementById('wsk-paste-input');
      if(el)el.value=text.trim();
    }
  }).catch(()=>{});
}
window.openWSKPasteModal=openWSKPasteModal;

function applyWSKHeats(raceId){
  const el=document.getElementById('wsk-paste-input');
  if(!el||!el.value.trim()){alert('Incolla il JSON prima');return;}
  try{
    const data=JSON.parse(el.value.trim());
    if(!Array.isArray(data))throw new Error('Formato non valido');
    // Usa uploadAssignments logic direttamente
    const assignMap={};
    data.forEach(a=>{
      const num=a.num?a.num.toString():'';
      if(num&&a.heats)assignMap[num]=a;
    });
    let updated=0;let notFound=0;
    pilots.forEach(p=>{
      const a=assignMap[p.num];
      if(a){
        if(a.heats&&a.heats.length){p.heats=a.heats.map(h=>String(h).trim().toUpperCase());p.group='';}
        if(a.prefinal!==undefined)p.prefinal=a.prefinal;
        if(a.inFinal!==undefined)p.inFinal=a.inFinal;
        updated++;
      } else {
        notFound++;
      }
    });
    // Aggiorna entry list condivisa
    const entryUpdates={};
    data.forEach(a=>{
      const anum=a.num?a.num.toString():'';
      if(anum&&currentEntryList[anum]&&a.heats){
        entryUpdates['races/'+raceId+'/entryList/'+anum+'/heats']=a.heats.map(h=>String(h).trim().toUpperCase());
        entryUpdates['races/'+raceId+'/entryList/'+anum+'/group']='';
      }
    });
    if(Object.keys(entryUpdates).length)update(ref(db),entryUpdates);
    saveAll();
    alert('Heats aggiornate!\n'+updated+' tuoi piloti aggiornati'+(notFound?' ('+notFound+' non trovati tra i tuoi piloti)':''));
    closeModal();
  }catch(e){alert('JSON non valido: '+e.message);}
}
window.applyWSKHeats=applyWSKHeats;

function showWSKBookmarklet(){
  const script='(async()=>{'
    +'await new Promise(r=>{const s=document.createElement(\'script\');s.src=\'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js\';s.onload=r;document.head.appendChild(s);});'
    +'pdfjsLib.GlobalWorkerOptions.workerSrc=\'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js\';'
    +'const base=\'https://www.wskarting.it/\'+sResultsPath;'
    +'const links=[];'
    +'document.querySelectorAll(\'[onclick*="openResult"]\').forEach(a=>{'
    +'const t=a.textContent.trim();'
    +'const fm=a.getAttribute(\'onclick\').match(/openResult\\(\'(.+?)\'\\)/);if(!fm)return;'
    +'const f=fm[1];let cat=null;'
    +'if(f.startsWith(\'miniu10\'))cat=\'MINI U10\';'
    +'else if(f.startsWith(\'minigr3\'))cat=\'MINI GR3\';'
    +'else if(f.startsWith(\'okjunior\'))cat=\'OKJ\';'
    +'else if(f.startsWith(\'ok-njunior\'))cat=\'OK-NJ\';'
    +'else if(f.startsWith(\'kz2\'))cat=\'KZ2\';'
    +'else if(f.startsWith(\'ok_\'))cat=\'OK\';'
    +'if(!cat)return;'
    +'const hm=t.match(/Eliminatory Heats ([A-E]-[A-E])/);'
    +'const wpm=t.match(/Warm UP Prefinal ([AB])/);'
    +'const isFinal=t.trim()===\'FINAL\';'
    +'if(hm)links.push({url:base+f,type:\'heat\',pair:hm[1],cat});'
    +'else if(wpm)links.push({url:base+f,type:\'prefinal\',prefinal:wpm[1],cat});'
    +'else if(isFinal)links.push({url:base+f,type:\'final\',cat});'
    +'});'
    +'const ph={};'
    +'for(const l of links){'
    +'try{'
    +'const pdf=await pdfjsLib.getDocument(l.url).promise;'
    +'const page=await pdf.getPage(1);'
    +'const c=await page.getTextContent();'
    +'const nums=c.items.filter(i=>{const h=Math.round(i.height);const v=i.str.trim();if(!v||!/^\\d{3}$/.test(v))return false;if(l.type===\'heat\')return h===11;return h===7;}).map(i=>i.str.trim());'
    +'nums.forEach(n=>{'
    +'if(!ph[n])ph[n]={heats:[],prefinal:\'\',inFinal:false};'
    +'if(l.type===\'heat\'&&!ph[n].heats.includes(l.pair))ph[n].heats.push(l.pair);'
    +'if(l.type===\'prefinal\')ph[n].prefinal=l.prefinal;'
    +'if(l.type===\'final\')ph[n].inFinal=true;'
    +'});'
    +'}catch(e){}'
    +'}'
    +'const result=Object.entries(ph).map(([num,d])=>{const o={num};if(d.heats.length)o.heats=d.heats.sort();if(d.prefinal)o.prefinal=d.prefinal;if(d.inFinal)o.inFinal=true;return o;}).sort((a,b)=>parseInt(a.num)-parseInt(b.num));'
    +'const json=JSON.stringify(result);'
    +'navigator.clipboard.writeText(json).then(()=>alert(\'\'+Object.keys(ph).length+\' piloti. Torna nell\\\'app e incolla.\')).catch(()=>{prompt(\'Copia:\',json);});'
    +'})();;';

  const bookmarklet='javascript:'+encodeURIComponent(script);

  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>'
    +'<div class="modal-title"><i class="ic ic-bookmark"></i> Bookmarklet WSK Heats</div>'
    +'<div style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.7">'
    +'<strong style="color:var(--text)">Setup una tantum:</strong><br>'
    +'1. Assicurati che la barra segnalibri sia visibile (<strong>Ctrl+Shift+B</strong>)<br>'
    +'2. Trascina il pulsante qui sotto nella barra segnalibri</div>'
    +'<div style="text-align:center;padding:20px 0;background:var(--bg3);border-radius:12px;margin-bottom:16px">'
    +'<a href="'+bookmarklet+'" style="display:inline-block;padding:12px 24px;background:#a78bfa;color:#000;border-radius:8px;font-family:Courier New,monospace;font-weight:900;font-size:14px;text-decoration:none;letter-spacing:1px" '
    +'onclick="event.preventDefault();alert(\'Non cliccare — TRASCINA questo pulsante nella barra segnalibri!\')"><i class="ic ic-bookmark"></i> WSK Heats</a>'
    +'<div style="font-size:10px;color:var(--text4);margin-top:10px;font-weight:600">← TRASCINA NELLA BARRA SEGNALIBRI →</div></div>'
    +'<div style="font-size:12px;color:var(--text3);line-height:1.7">'
    +'<strong style="color:var(--text)">Uso:</strong><br>'
    +'1. Vai su <strong>wskarting.it/results/results.asp</strong><br>'
    +'2. Clicca <strong style="color:#a78bfa">WSK Heats</strong> nella barra segnalibri<br>'
    +'3. Aspetta ~10 secondi → appare conferma<br>'
    +'4. Torna sull\'app → GARE → Impostazioni → <i class="ic ic-download"></i> Incolla Heats</div>');
}
window.showWSKBookmarklet=showWSKBookmarklet;

function saveRaceSettings(raceId){
  const name=document.getElementById('rs-name').value.trim();
  const circuit=document.getElementById('rs-circuit').value.trim();
  const org=(document.getElementById('rs-org')||{}).value||'';
  const liveTiming=((document.getElementById('rs-livetiming')||{}).value||'').trim();
  const startDate=document.getElementById('rs-start').value||'';
  const endDate=document.getElementById('rs-end').value||'';
  if(!name)return;
  const u={};
  u['races_index/'+raceId+'/name']=name;
  u['races_index/'+raceId+'/circuit']=circuit;
  u['races_index/'+raceId+'/org']=org;
  u['races_index/'+raceId+'/liveTiming']=liveTiming;
  u['races_index/'+raceId+'/startDate']=startDate;
  u['races_index/'+raceId+'/endDate']=endDate;
  const apx=((document.getElementById('rs-apex')||{}).value||'').trim();
  let apxPath='';try{apxPath=/^https?:/i.test(apx)?(new URL(apx).searchParams.get('path')||''):apx;}catch(e){apxPath='';}
  apxPath=decodeURIComponent(apxPath||'').trim();if(apxPath&&!apxPath.startsWith('/'))apxPath='/'+apxPath;
  if(apx&&!/^\/[a-z0-9\-_]+\/\d{4}\/[^\s]+$/i.test(apxPath)){alert('Link dei risultati ufficiali non valido');return;}
  u['races_index/'+raceId+'/apexPath']=apxPath||null;
  const elp=((document.getElementById('rs-elpage')||{}).value||'').trim();
  if(elp&&!/^https:\/\//i.test(elp)){alert('La pagina entry list deve iniziare con https://');return;}
  u['races_index/'+raceId+'/entryListPage']=elp||null;
  const awP=((document.getElementById('rs-aw-pole')||{}).value||'').trim();
  const awDopo=!!(document.getElementById('rs-aw-dopo')||{}).checked;
  const awF=awDopo?'dopo':((document.getElementById('rs-aw-final')||{}).value||'').trim();
  u['races_index/'+raceId+'/awards/pole']=awP||null;
  u['races_index/'+raceId+'/awards/final']=awF||null;
  update(ref(db),u).then(()=>{closeModal();});
}
window.saveRaceSettings=saveRaceSettings;

function uploadEntryList(event,raceId){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      // Accept either {num:{...}} or [{num,lastName,...}]
      let entryList={};
      if(Array.isArray(data)){
        data.forEach(d=>{if(d.num)entryList[d.num.toString()]=d;});
      } else {
        entryList=data;
      }
      Object.values(entryList).forEach(d=>{if(d&&d.cat)d.cat=normCat(d.cat);});
      const count=Object.keys(entryList).length;
      const u={};
      u['races/'+raceId+'/entryList']=entryList;
      u['races_index/'+raceId+'/entryCount']=count;
      update(ref(db),u).then(()=>{alert('Entry list caricata: '+count+' piloti');closeModal();});
    }catch(err){alert('File non valido');}
  };
  reader.readAsText(file);event.target.value='';
}
window.uploadEntryList=uploadEntryList;

function uploadMyPilots(event,raceId){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      // Accept [{num, serie?, group?, ...}] or {num:{...}}
      let pilotsList=[];
      if(Array.isArray(data)){
        pilotsList=data;
      } else {
        pilotsList=Object.values(data);
      }
      // For each pilot, look up in entry list to fill details
      const pilotsObj={};const newStatuses={};const newNotes={};const newTrack={};
      // First fetch current entry list
      fetch('https://karting-tools-default-rtdb.firebaseio.com/races/'+raceId+'/entryList.json')
        .then(r=>r.json()).then(el=>{
          el=el||{};
          pilotsList.forEach(mp=>{
            const num=mp.num?mp.num.toString():(mp.number?mp.number.toString():'');
            if(!num)return;
            const entry=el[num]||{};
            const name=mp.name||(entry.lastName&&entry.firstName?entry.lastName+' '+entry.firstName:'')||'';
            const team=mp.team||entry.team||'';
            const cat=mp.cat||entry.cat||'OK';
            pilotsObj[num]={num,name:name.toUpperCase(),team:team.toUpperCase(),cat,parity:autoParity(num),group:mp.group||'',prefinal:mp.prefinal||'',serie:mp.serie?mp.serie.toString():''};
            newStatuses[num]={};TASKS.forEach(t=>newStatuses[num][t]='red');
            newNotes[num]=mp.notes||'';
            newTrack[num]={};
          });
          const count=Object.keys(pilotsObj).length;
          const u={};
          u['races/'+raceId+'/users/'+currentUserId+'/pilots']=pilotsObj;
          u['races/'+raceId+'/users/'+currentUserId+'/statuses']=newStatuses;
          u['races/'+raceId+'/users/'+currentUserId+'/notes']=newNotes;
          u['races/'+raceId+'/users/'+currentUserId+'/trackStatus']=newTrack;
          u['races_index/'+raceId+'/pilotCount']=count;
          update(ref(db),u).then(()=>{alert(''+count+' piloti caricati');closeModal();});
        });
    }catch(err){alert('File non valido');}
  };
  reader.readAsText(file);event.target.value='';
}
window.uploadMyPilots=uploadMyPilots;

function uploadSchedule(event,raceId){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      // Accept {days:[], schedule:{}, finals:[]} or just {DAY_NAME:[slots...]}
      let schedule,days,finals;
      if(data.schedule){
        schedule=data.schedule;days=data.days||Object.keys(data.schedule);finals=data.finals||[];
      } else {
        schedule=data;days=Object.keys(data);finals=[];
      }
      Object.values(schedule).forEach(sl=>{(Array.isArray(sl)?sl:Object.values(sl||{})).forEach(x=>{if(x&&x.cat)x.cat=normCat(x.cat);});});
      (Array.isArray(finals)?finals:Object.values(finals||{})).forEach(f=>{if(f&&f.cat)f.cat=normCat(f.cat);});
      const u={};
      u['races/'+raceId+'/schedule']=schedule;
      u['races/'+raceId+'/days']=days;
      u['races/'+raceId+'/finals']=finals;
      update(ref(db),u).then(()=>{alert('Programma caricato: '+days.length+' giorni');closeModal();});
    }catch(err){alert('File non valido');}
  };
  reader.readAsText(file);event.target.value='';
}
window.uploadSchedule=uploadSchedule;

// Upload assignments: updates heats[]/group/serie/prefinal for existing pilots
// NUOVO formato: [{num:"342", heats:["A-B","A-D"]}, ...]
// LEGACY formato: [{num:"342", group:"A", serie:"1", prefinal:"B"}, ...]
// heats[] è un array di coppie es. ["B-D","B-C"] — il pilota compare in quegli slot
function uploadAssignments(event,raceId){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      let assignments=[];
      if(Array.isArray(data)){
        assignments=data;
      } else {
        assignments=Object.entries(data).map(([num,v])=>({num,...v}));
      }

      const assignMap={};
      const hasHeats=assignments.some(a=>a.heats!==undefined);
      const hasGroup=assignments.some(a=>a.group!==undefined);
      const hasSerie=assignments.some(a=>a.serie!==undefined);
      const hasPrefinal=assignments.some(a=>a.prefinal!==undefined);

      assignments.forEach(a=>{
        const num=a.num?a.num.toString():(a.number?a.number.toString():'');
        if(num)assignMap[num]=a;
      });

      let updated=0;let eliminated=0;let reactivated=0;

      pilots.forEach(p=>{
        const a=assignMap[p.num];
        if(a){
          // NUOVO: heats[] — array di coppie es. ["B-D","B-C"]
          if(a.heats!==undefined){
            p.heats=Array.isArray(a.heats)
              ?a.heats.map(h=>String(h).trim().toUpperCase())
              :[String(a.heats).trim().toUpperCase()];
            // Resetta group legacy per evitare conflitti
            p.group='';
          }
          // LEGACY: group singolo
          if(a.group!==undefined&&a.heats===undefined)p.group=a.group.toString().toUpperCase();
          if(a.serie!==undefined)p.serie=a.serie.toString();
          if(a.prefinal!==undefined)p.prefinal=a.prefinal.toString().toUpperCase();
          if(a.inFinal!==undefined)p.inFinal=!!a.inFinal;
          // eliminated SOLO esplicito: true elimina, false riattiva, assente non tocca
          if(a.eliminated!==undefined){
            const wantElim=!!a.eliminated;
            if(wantElim&&!p.eliminated){p.eliminated=true;eliminated++;}
            if(!wantElim&&p.eliminated){p.eliminated=false;reactivated++;}
          }
          updated++;
        }
        // RIMOSSA auto-eliminazione dei piloti assenti dal file: i ritiri
        // si dichiarano solo con {num, eliminated:true} esplicito.
      });

      // Aggiorna entry list condivisa
      const entryUpdates={};
      assignments.forEach(a=>{
        const anum=a.num?a.num.toString():(a.number?a.number.toString():'');
        if(anum&&currentEntryList[anum]){
          if(a.heats!==undefined){
            entryUpdates['races/'+raceId+'/entryList/'+anum+'/heats']=
              Array.isArray(a.heats)?a.heats.map(h=>String(h).trim().toUpperCase()):[String(a.heats).trim().toUpperCase()];
            entryUpdates['races/'+raceId+'/entryList/'+anum+'/group']='';
          }
          if(a.group!==undefined&&a.heats===undefined)entryUpdates['races/'+raceId+'/entryList/'+anum+'/group']=a.group.toString().toUpperCase();
          if(a.serie!==undefined)entryUpdates['races/'+raceId+'/entryList/'+anum+'/serie']=a.serie.toString();
          if(a.prefinal!==undefined)entryUpdates['races/'+raceId+'/entryList/'+anum+'/prefinal']=a.prefinal.toString().toUpperCase();
          if(a.inFinal!==undefined)entryUpdates['races/'+raceId+'/entryList/'+anum+'/inFinal']=!!a.inFinal;
          if(a.eliminated!==undefined)entryUpdates['races/'+raceId+'/entryList/'+anum+'/eliminated']=!!a.eliminated;
        }
      });
      if(Object.keys(entryUpdates).length)update(ref(db),entryUpdates);

      saveAll();
      let msg='Assegnazioni aggiornate!\n'+updated+' piloti aggiornati';
      if(hasHeats)msg+='\n(formato heats[] — corrispondenza slot precisa)';
      else if(hasGroup)msg+='\n(formato group legacy)';
      if(eliminated)msg+='\n'+eliminated+' piloti eliminati (non in lista)';
      if(reactivated)msg+='\n'+reactivated+' piloti riattivati';
      alert(msg);
      closeModal();
    }catch(err){alert('File non valido: '+err.message);}
  };
  reader.readAsText(file);event.target.value='';
}
window.uploadAssignments=uploadAssignments;

function loadDefaultWSK(raceId){
  if(!confirm('Caricare i dati WSK Super Master Franciacorta predefiniti?'))return;
  const u={};
  u['races/'+raceId+'/entryList']=ENTRY_LIST;
  u['races/'+raceId+'/schedule']=SCHEDULE;
  u['races/'+raceId+'/days']=DAYS;
  u['races/'+raceId+'/finals']=FINALS;
  u['races_index/'+raceId+'/entryCount']=Object.keys(ENTRY_LIST).length;
  update(ref(db),u).then(()=>{alert('Dati WSK caricati');closeModal();});
}
window.loadDefaultWSK=loadDefaultWSK;

function deleteRace(raceId){
  if(!confirm('Eliminare questa gara? Tutti i dati verranno persi.'))return;
  const u={};u['races_index/'+raceId]=null;u['races/'+raceId]=null;
  update(ref(db),u);
}
window.deleteRace=deleteRace;

// ══════════════════════════════════════
// SEARCH — my pilots first + detail sheet
// ══════════════════════════════════════
function filterPilots(q){
  const resultsEl=document.getElementById('pilots-search-results');
  const listEl=document.getElementById('pilots-list');
  const clearBtn=document.getElementById('search-clear-btn');
  if(!q||!q.trim()){resultsEl.style.display='none';listEl.style.display='';if(clearBtn)clearBtn.style.display='none';return;}
  if(clearBtn)clearBtn.style.display='block';
  listEl.style.display='none';resultsEl.style.display='';
  const query=q.trim().toUpperCase();
  const matches=[];
  Object.entries(currentEntryList).forEach(([num,e])=>{
    const nameStr=((e.lastName||'')+' '+(e.firstName||'')).toUpperCase();
    const teamStr=(e.team||'').toUpperCase();
    if(num.startsWith(query)||nameStr.includes(query)||teamStr.includes(query)){
      matches.push({num,name:(e.lastName||'')+' '+(e.firstName||''),team:e.team||'',cat:e.cat||'',parity:e.parity||autoParity(num),isMyPilot:!!pilots.find(p=>p.num===num)});
    }
  });
  if(!matches.length){resultsEl.innerHTML='<div class="empty-state"><p>Nessun risultato</p></div>';return;}
  matches.sort((a,b)=>{if(a.isMyPilot&&!b.isMyPilot)return-1;if(!a.isMyPilot&&b.isMyPilot)return 1;return a.team.localeCompare(b.team)||parseInt(a.num)-parseInt(b.num);});
  const myP=matches.filter(m=>m.isMyPilot);
  const others=matches.filter(m=>!m.isMyPilot);
  const otherGroups={};
  others.forEach(m=>{if(!otherGroups[m.team])otherGroups[m.team]=[];otherGroups[m.team].push(m);});
  let html='<div style="font-size:10px;color:var(--text4);font-weight:700;letter-spacing:1px;margin-bottom:8px">'+matches.length+' RISULTATI</div>';
  if(myP.length){
    html+='<div class="search-group-label" style="color:#22c55e"><i class="ic ic-star"></i> I MIEI PILOTI ('+myP.length+')</div>';
    myP.forEach(m=>{html+=searchResultItem(m);});
  }
  Object.entries(otherGroups).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([team,members])=>{
    html+='<div class="search-group-label">'+team+' ('+members.length+')</div>';
    members.sort((a,b)=>parseInt(a.num)-parseInt(b.num)).forEach(m=>{html+=searchResultItem(m);});
  });
  resultsEl.innerHTML=html;
}
// Riga note del pilota, uguale in tutte le schermate
// Posizione in griglia dalle liste ufficiali Apex (entryList/{num}/grid = {"A-B":1,...}); nessuna stima
function gridPos(num,slot){
  try{
    const key=slotKeyOf(slot);if(!key)return 0;
    const g=(currentEntryList[num]||{}).grid;return(g&&g[key])||0;
  }catch(e){return 0;}
}
// Dopo la manche: posizione d'arrivo dai risultati Apex (entryList/{num}/result = {"A-B":"3"}), badge verde
// Chiavi: manche "A-B"; prefinali "PF-A"/"PF-B"; finale "FIN" (scritte dal server dai documenti ufficiali Apex)
// 20/11/2026: serie del pilota = quella ufficiale dell'entry list (server) se c'e', altrimenti quella salvata
function pSerie(p){const e=p&&currentEntryList&&currentEntryList[p.num];return String((e&&e.serie)||(p&&p.serie)||'').trim();}
// 20/11/2026: sessione (PROVE LIBERE / QUALIFICHE / MANCHE...) del blocco a cui appartiene il turno, nel giorno attivo
function slotSessionOf(slot){let cur='';const arr=((currentSchedule||{})[activeDay]||[]);for(const x of (Array.isArray(arr)?arr:Object.values(arr))){if(!x)continue;if(x.session)cur=x.session;
  if(x===slot||(x.time===slot.time&&x.cat===slot.cat&&x.type===slot.type&&String(x.filter)===String(slot.filter)))return cur;}return '';}
function slotKeyOf(slot){if(!slot)return'';if(slot.type==='prefinal'){const x=String(slot.filter||'').trim().toUpperCase();return x?'PF-'+x:'';}if(slot.type==='final')return'FIN';if(slot.type==='serie'&&/PROV|PRACT|LIBER|WARM/i.test(slotSessionOf(slot))){return activeDay&&slot.time?['PR-',String(activeDay).toUpperCase(),'-',String(slot.time).replace(/[.:]/g,'_')].join(''):'';}if(slot.type==='serie'){const q=String(slot.filter||'').trim().toUpperCase();return q?'Q-S'+q.replace(/^S/,''):'';}if(slot.type==='parity'||slot.type==='all'||slot.type==='list'){return activeDay&&slot.time?['PR-',String(activeDay).toUpperCase(),'-',String(slot.time).replace(/[.:]/g,'_')].join(''):'';}if(slot.type!=='group')return'';const f=Array.isArray(slot.filter)?slot.filter:Object.values(slot.filter||{});return f.map(x=>String(x).trim().toUpperCase()).sort().join('-');}
// la sessione è già finita? (giorno visualizzato vs oggi, orario + ritardo). Prima della partenza si mostra sempre la griglia.
function slotHasRun(slot){
  try{
    if(!slot||!slot.time)return true;
    const days=currentDays||[];const today=typeof autoDayName==='function'?autoDayName():activeDay;
    const di=days.indexOf(activeDay),ti=days.indexOf(today);if(di<0||ti<0)return true;
    if(di<ti)return true;if(di>ti)return false;
    // finita = partenza (con ritardo) + durata dal programma + 5 min di margine per la classifica
    const d=String(slot.durLive||slot.dur||'');let m=15;const g=d.match(/(\d+)\s*giri/i),mm=d.match(/(\d+)\s*'/);if(g)m=Math.ceil(+g[1]*1.1);else if(mm)m=+mm[1];
    const now=new Date();return now.getHours()*60+now.getMinutes()>=slotMins(slot.time)+(scheduleDelay||0)+m+5;
  }catch(e){return true;}
}
/* 14/11/2026 (punto 5): stato classifica scritto dal server (races/<gara>/resultStatus/<CAT>/<sessione>, dall'icona Apex).
   Ufficiale = badge pieno; provvisoria o solo dal live = badge vuoto (bordo). corr = corretta dopo la pubblicazione. */
var resultStatus={};
function resStatusOf(cat,k){try{const c=resultStatus[String(cat||'').replace(/[.#$\[\]\/]/g,'_')]||{};return c[String(k).replace(/[.#$\[\]\/]/g,'_')]||null;}catch(e){return null;}}
function gridBadge(num,slot){
  const k=slotKeyOf(slot);if(!k)return'';
  const e=currentEntryList[num]||{};let r=e.result&&e.result[k];
  // 19/11/2026: prima l'arrivo delle prove era uno solo al giorno per pari/dispari (PAR-<giorno>-<ODD|EVEN>), scritto
  // dall'ultimo turno: si mostra solo sull'ultimo turno di quel tipo della giornata
  if((r===undefined||r===null||r==='')&&slot.type==='parity'&&e.result){try{const f=String(slot.filter||'').trim().toUpperCase();
    const old=e.result[['PAR-',String(activeDay).toUpperCase(),'-',f].join('')];
    if(old){const same=((currentSchedule||{})[activeDay]||[]).filter(x=>x&&x.type==='parity'&&x.cat===slot.cat&&String(x.filter||'').trim().toUpperCase()===f);
      const last=same.sort((a,b)=>slotMins(b.time)-slotMins(a.time))[0];if(last&&last.time===slot.time)r=old;}}catch(x){}}
  const _out=(e.out&&e.out[k])||/^(X|DNF|DNS|RIT|AB|NC|RET|DSQ|SQ)/i.test(String(r||''));
  if(r!==undefined&&r!==null&&r!==''&&slotHasRun(slot)&&_out)
    return'<span title="Uscito: posizione in classifica" style="font-family:\'Chakra Petch\',sans-serif;font-size:12px;font-weight:900;color:#fff;background:#dc2626;border-radius:5px;padding:1px 7px;flex-shrink:0"><i class="ic ic-close"></i>'+(/^\d+$/.test(String(r))?' '+r+'°':/DSQ|SQ/i.test(String(r))?' SQ':'')+'</span>';
  if(r!==undefined&&r!==null&&r!==''&&slotHasRun(slot)){const t=/^\d+$/.test(String(r))?String(r)+'°':String(r).toUpperCase();
    const rs=resStatusOf(e.cat,k),uff=!!(rs&&rs.st==='ufficiale'),cor=!!(rs&&rs.corr);
    const tip=(uff?'Arrivo ufficiale':'Arrivo provvisorio'+(rs?' (classifica non ancora ufficiale)':' (dal live)'))+(cor?' · corretto dopo la pubblicazione':'');
    const sty=uff?'color:#0d0d0f;background:#4fd69c;border:1px solid #4fd69c':'color:#4fd69c;background:transparent;border:1px dashed #4fd69c';
    return'<span title="'+tip+'" style="font-family:\'Chakra Petch\',sans-serif;font-size:12px;font-weight:700;'+sty+';border-radius:5px;padding:0 6px;flex-shrink:0"><i class="ic ic-flag"></i> '+t+(cor?' <span style="color:#facc15">●</span>':'')+'</span>';}
  const n=gridPos(num,slot);
  return n?'<span title="Posizione in griglia (lista ufficiale)" style="font-family:\'Chakra Petch\',sans-serif;font-size:12px;font-weight:700;color:#1a160e;background:#e9d5a8;border-radius:5px;padding:1px 7px;flex-shrink:0">P'+n+'</span>':'';
}
/* 15/11/2026 (Andrea): matita delle note sempre visibile (non solo se c'e' gia' una nota), area di tocco 44px */
function noteBtn(num){const n=String(num).replace(/[^0-9A-Za-z_-]/g,'');
  return'<button onclick="event.stopPropagation();editPilotNote(\''+n+'\')" aria-label="Nota" style="margin:-12px -10px -12px 0;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0;flex-shrink:0;touch-action:manipulation;-webkit-tap-highlight-color:rgba(255,255,255,.15)"><i class="ic ic-note"></i></button>';}
/* 18/11/2026 (Andrea): pilota di un team seguito che compra anche il pacchetto personale -> diventa anche mio pilota
   (pillole e note sue), resta nel riquadro del team con l'etichetta "PERS". La nota gia' scritta sul pilota resta.
   Si segna e si toglie dalla finestra della nota (matita), solo per i piloti dei team seguiti. */
/* 18/11/2026 (Andrea): durata del reel acquistato per pilota (30", 45", 1') — per tutti i miei piloti.
   Si sceglie nella finestra della matita; l'etichetta compare solo se impostata; nella copia per editor "Reel 30"". */
// 19/11/2026 (Andrea): oltre a 30"/45"/1' anche "Clip sfuse" (es. team AKM: clip ogni giorno, niente reel montato)
// 19/11/2026 (Andrea): tolto il 45" dalle scelte (nessun dato lo usava); resta solo l'etichetta per eventuali dati vecchi
const REEL_OPTS=[['30','30"'],['60',"1'"],['clip','Clip sfuse']];
function reelLabel(v){const o=REEL_OPTS.concat([['45','45"']]).find(x=>x[0]===String(v||'30'));return o?o[1]:'30"';}
function reelText(v){return String(v||'')==='clip'?'Clip sfuse':'Reel '+reelLabel(v);}   // testo per copia editor / PDF
/* 18/11/2026 (Andrea): un mio pilota che fa parte di un team seguito = acquisto personale oltre al team -> "PERS" ovunque compare
   (programma, lista piloti, finali, ricerca), sia se segnato dalla matita sia se aggiunto a mano. */
/* 22/11/2026 (Andrea): contatore del materiale gia' smistato dal ClipSorter per il pilota (races/<gara>/media/<utente>/<num> = {c,f,at}).
   Arriva con i dati condivisi della gara (gia' in ascolto). Piccolo e grigio accanto al nome; nascosto se assente o 0/0.
   Si aggancia a persChip perche' persChip e' presente in tutte le righe pilota (lista, dettaglio, programma, griglie/arrivi, ricerca). */
function mediaOf(num){try{const m=(window._rtMedia||{})[currentUserId]||{};const x=m[String(num)];return x&&typeof x==='object'&&((+x.c||0)+(+x.f||0))>0?x:null;}catch(e){return null;}}
function mediaChip(p){const x=p&&mediaOf(p.num);if(!x)return'';
  return '<span class="rt-media" title="Materiale smistato: clip e foto"><i class="ic ic-video"></i>'+(+x.c||0)+'<span class="rt-media-sep">·</span><i class="ic ic-camera"></i>'+(+x.f||0)+'</span>';}
function persChip(p){return persChip0(p)+mediaChip(p);}
function persChip0(p){let ft=null;try{ft=p&&pilots.some(x=>x.num===String(p.num))?followedTeamOf(p.num,p.team||''):null;}catch(e){}
  return ft?'<span title="Pilota del team con acquisto personale" style="font-family:\'Chakra Petch\',sans-serif;font-size:9px;font-weight:700;letter-spacing:.06em;color:#4ade80;border:1px solid rgba(74,222,128,.45);border-radius:4px;padding:0 4px;flex-shrink:0;line-height:14px">PERS</span>':'';}
/* 19/11/2026 (Andrea): la durata del reel vale solo per chi ha il VIDEO; con solo FOTO non compare da nessuna parte */
/* 19/11/2026 (Andrea): PREDISPOSTO — etichette opzionali per chi ha FOTO (es. 'in posa'). Oggi l'elenco e' vuoto:
   finche' FOTO_OPTS resta vuoto non compare nulla (ne' scelte ne' etichette). Per attivarle basta aggiungere voci qui:
   FOTO_OPTS=[['posa','IN POSA'],...]. Scelta multipla, salvata sul pilota in fotoTags; compare solo se il pilota ha FOTO. */
const FOTO_OPTS=[];
function hasFoto(p){let h=p&&p.highlight;if(typeof h==='string')h=[h];if(h&&!Array.isArray(h))h=Object.values(h);return!!(h&&h.includes('foto'));}
function fotoTagsOf(p){let t=p&&p.fotoTags;if(t&&!Array.isArray(t))t=Object.values(t);return(t||[]).filter(v=>FOTO_OPTS.some(o=>o[0]===v));}
function fotoChips(p){if(!FOTO_OPTS.length||!hasFoto(p))return'';
  return fotoTagsOf(p).map(v=>'<span title="Foto" style="font-family:\'Chakra Petch\',sans-serif;font-size:9px;font-weight:700;color:#7dd3fc;border:1px solid rgba(125,211,252,.45);border-radius:4px;padding:0 4px;flex-shrink:0;line-height:14px"><i class="ic ic-hl-foto"></i> '+FOTO_OPTS.find(o=>o[0]===v)[1]+'</span>').join('');}
function fotoRowHtml(p,quick){if(!FOTO_OPTS.length||!hasFoto(p))return'';const on=fotoTagsOf(p);
  return'<div style="display:flex;align-items:center;gap:6px;margin:8px 0 2px;flex-wrap:wrap"><span class="note-label" style="margin:0 4px 0 0">Foto</span>'
    +FOTO_OPTS.map(([v,l])=>'<button onclick="togglePilotFotoTag(\''+p.num+'\',\''+v+'\','+(quick?1:0)+')" style="min-height:36px;padding:0 10px;border-radius:7px;font-family:inherit;font-weight:800;font-size:12px;cursor:pointer;touch-action:manipulation;'
      +(on.includes(v)?'background:#7dd3fc;color:#0b1220;border:1px solid #7dd3fc':'background:none;color:var(--text3);border:1px solid var(--border2,#444)')+'">'+l+'</button>').join('')+'</div>';}
function togglePilotFotoTag(num,v,quick){
  const p=pilots.find(x=>x.num===String(num));if(!p)return;
  const t=document.getElementById(quick?'note-'+p.num:'pn-text');if(t)notes[p.num]=t.value;
  const cur=fotoTagsOf(p);p.fotoTags=cur.includes(v)?cur.filter(x=>x!==v):cur.concat(v);
  saveAll();if(quick){try{renderPilots();}catch(e){}}else{editPilotNote(p.num);try{renderAll();}catch(e){}}
}
window.togglePilotFotoTag=togglePilotFotoTag;
function hasVideo(p){let h=p&&p.highlight;if(typeof h==='string')h=[h];if(h&&!Array.isArray(h))h=Object.values(h);return!!(h&&h.includes('video'));}
function reelChip(p){if(!hasVideo(p))return'';const l=reelLabel(p&&p.reel);
  return l?'<span title="'+(String(p&&p.reel)==='clip'?'Clip sfuse':'Durata reel')+'" style="font-family:\'Chakra Petch\',sans-serif;font-size:13px;font-weight:800;color:#1a160e;background:#e9d5a8;border-radius:6px;padding:2px 8px;flex-shrink:0;line-height:16px;white-space:nowrap"><i class="ic ic-hl-video"></i> '+l+'</span>':'';}
function reelPickerHtml(num){
  const p=pilots.find(x=>x.num===String(num));if(!p||!hasVideo(p))return'';
  return'<div style="margin-top:12px;font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--text4)">REEL</div><div style="display:flex;gap:8px;margin-top:6px">'
    +REEL_OPTS.map(([v,l])=>{const on=String(p.reel||'30')===v;
      return'<button onclick="setPilotReel(\''+p.num+'\',\''+v+'\')" style="flex:1;min-height:44px;border-radius:8px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;'
        +(on?'background:#e9d5a8;color:#1a160e;border:1px solid #e9d5a8':'background:none;color:var(--text3);border:1px solid var(--border2,#444)')+'">'+l+'</button>';}).join('')+'</div>';
}
/* 19/11/2026 (Andrea): durata reel cambiabile direttamente dalla scheda nella lista Piloti */
function reelRowHtml(p){
  if(!hasVideo(p))return'';
  return'<div style="display:flex;align-items:center;gap:6px;margin:8px 0 2px"><span class="note-label" style="margin:0 4px 0 0">Reel</span>'
    +REEL_OPTS.map(([v,l])=>{const on=String(p.reel||'30')===v;
      return'<button onclick="setPilotReelQuick(\''+p.num+'\',\''+v+'\')" style="min-width:52px;min-height:36px;border-radius:7px;font-family:inherit;font-weight:800;font-size:12px;cursor:pointer;touch-action:manipulation;'
        +(on?'background:#e9d5a8;color:#1a160e;border:1px solid #e9d5a8':'background:none;color:var(--text3);border:1px solid var(--border2,#444)')+'">'+l+'</button>';}).join('')+'</div>';
}
function setPilotReelQuick(num,v){
  /* 19/11/2026 (Andrea): quello che vedo e' quello che sta nel DB: si confronta con il valore salvato, non con il predefinito mostrato */
  const p=pilots.find(x=>x.num===String(num));if(!p||String(p.reel||'')===v)return;
  const t=document.getElementById('note-'+p.num);if(t)notes[p.num]=t.value;   // non perdere una nota in scrittura
  p.reel=v;reelPrio(p,v);saveAll();try{renderPilots();}catch(e){}
}
window.setPilotReelQuick=setPilotReelQuick;
function setPilotReel(num,v){
  const p=pilots.find(x=>x.num===String(num));if(!p)return;
  const t=document.getElementById('pn-text');if(t){notes[p.num]=t.value;}
  p.reel=v;reelPrio(p,v);   // 19/11: il reel non puo' restare vuoto
  saveAll();editPilotNote(p.num);try{renderAll();}catch(e){}
}
window.setPilotReel=setPilotReel;
function persToggleHtml(num){
  num=String(num);const e=(currentEntryList||{})[num]||{};const mine=pilots.find(p=>p.num===num);
  let ft=null;try{ft=followedTeamOf(num,(mine&&mine.team)||e.team||'');}catch(err){}
  if(!ft)return'';
  const st='width:100%;margin-top:10px;min-height:44px;border-radius:8px;background:none;font-family:inherit;font-weight:800;font-size:12px;letter-spacing:.05em;cursor:pointer;';
  return mine
    ?'<button style="'+st+'border:1px solid var(--border2,#444);color:var(--text3)" onclick="removeTeamPilotPersonal(\''+num+'\')">TOGLI DAL PERSONALE (resta nel team)</button>'
    :'<button style="'+st+'border:1px solid rgba(74,222,128,.5);color:#4ade80" onclick="savePilotNote(\''+num+'\');addTeamPilotPersonal(\''+num+'\',true)">SEGNA ANCHE PERSONALE</button>';
}
function removeTeamPilotPersonal(num){
  num=String(num);const p=pilots.find(x=>x.num===num);if(!p)return;
  if(!confirm('Togliere #'+num+' dal personale?\nResta nel team, la nota resta.'))return;
  const t=document.getElementById('pn-text');if(t)notes[num]=t.value;
  pilots=pilots.filter(x=>x.num!==num);delete statuses[num];delete trackStatus[num];
  saveAll();closeModal();renderAll();
}
window.removeTeamPilotPersonal=removeTeamPilotPersonal;
function persBtn(num){const n=String(num).replace(/[^0-9A-Za-z_-]/g,'');
  return'<button onclick="event.stopPropagation();addTeamPilotPersonal(\''+n+'\')" aria-label="Anche personale" title="Anche personale" style="min-height:32px;padding:0 8px;border-radius:6px;border:1px solid var(--border2,#333);background:none;color:var(--text3);font-family:\'Chakra Petch\',sans-serif;font-size:10px;font-weight:800;cursor:pointer;flex-shrink:0;touch-action:manipulation">+ PERS.</button>';}
function addTeamPilotPersonal(num,noAsk){
  num=String(num);if(pilots.find(p=>p.num===num))return;
  const e=(currentEntryList||{})[num];if(!e){alert('Pilota non trovato nella entry list');return;}
  const nm=String((e.lastName||'')+' '+(e.firstName||'')).trim();
  if(!noAsk&&!confirm('#'+num+' '+nm+' ha preso anche il pacchetto personale?\nLo aggiungo ai tuoi piloti (resta anche nel team).'))return;
  _rtNewPilots.add(num);
  pilots.push({num,name:nm,team:e.team||'',cat:e.cat||'OK',parity:e.parity||autoParity(num),group:e.group||'',prefinal:e.prefinal||'',serie:e.serie?String(e.serie):'',eliminated:false,highlight:[defaultHl()],reel:defaultHl()==='video'?'30':''});
  statuses[num]={};TASKS.forEach(t=>statuses[num][t]='red');trackStatus[num]={};if(notes[num]===undefined)notes[num]='';
  saveAll();closeModal();renderAll();
}
window.addTeamPilotPersonal=addTeamPilotPersonal;
function noteLine(num){
  const n=String((notes&&notes[num])||'').trim();if(!n)return'';
  const e=n.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return'<div class="note-txt" style="margin-top:4px;white-space:pre-wrap"><i class="ic ic-note"></i> '+e+'</div>';
}
function searchResultItem(m){
  const catCls=catClass(m.cat);const isMine=m.isMyPilot;
  /* 21/11/2026 (Andrea): nei risultati di ricerca stesse indicazioni del resto dell'app: FOTO/VIDEO/PRIORITA', durata reel, PERS, team seguito (contorno colore team) */
  const p=isMine?pilots.find(x=>x.num===String(m.num)):null;let ft=null;try{ft=followedTeamOf(String(m.num),m.team||'');}catch(e){}
  const tc=ft?teamColor(ft.key):'';let hl=p?p.highlight:null;if(typeof hl==='string')hl=[hl];if(hl&&!Array.isArray(hl))hl=Object.values(hl);hl=hl||[];
  const prio=hl.includes('priority');
  const bd=isMine?(prio?'border:2px solid #f59e0b;background:rgba(245,158,11,.08)':'border-color:#22c55e;background:rgba(34,197,94,.06)'):(ft?'border:2px solid '+tc+';background:rgba(255,255,255,.03)':'');
  const badges=hl.map(h=>'<span class="hl-badge hl-'+h+' hl-mini"><i class="ic ic-hl-'+(h==='priority'?'prio':h)+'"></i></span>').join('');
  return'<div class="search-result-item" style="'+bd+'" onclick="openPilotDetail(\''+m.num+'\')">'
    +'<span class="sr-num" style="'+(isMine?'color:#22c55e':ft?'color:'+tc:'')+'">#'+m.num+'</span>'
    +'<div style="flex:1;min-width:0">'
    +'<div class="sr-name" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span>'+m.name+'</span>'
    +(isMine?'<span style="font-size:10px;color:#22c55e;font-weight:800"><i class="ic ic-star"></i> TUO</span>':'')
    +(ft&&!isMine?'<span style="font-size:10px;font-weight:800;color:'+tc+';border:1px solid '+tc+';border-radius:4px;padding:0 4px">TEAM</span>':'')
    +badges+(p?reelChip(p)+fotoChips(p)+persChip(p):mediaChip({num:m.num}))+'</div>'
    +'<div class="sr-team">'+m.team+'</div>'+noteLine(m.num)+'</div>'
    +'<span class="sr-cat '+catCls+'" style="padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800">'+m.cat+'</span></div>';
}
window.filterPilots=filterPilots;
function clearPilotsSearch(){const inp=document.getElementById('pilots-search');if(inp)inp.value='';filterPilots('');}
window.clearPilotsSearch=clearPilotsSearch;

// ── PILOT DETAIL SHEET (from search) ──
function openPilotDetail(num){
  const entry=lookupByNum(num);
  const myPilot=pilots.find(p=>p.num===num);
  const isMine=!!myPilot;
  const name=entry?(entry.lastName+' '+entry.firstName):(myPilot?myPilot.name:'#'+num);
  const team=entry?entry.team:(myPilot?myPilot.team:'');
  const cat=entry?entry.cat:(myPilot?myPilot.cat:'');
  const parity=autoParity(num);
  const catCls=catClass(cat);
  const existingNote=notes[num]||'';
  _addHl=[defaultHl()];_addReel='30';   // 19/11/2026: stessi predefiniti di "Aggiungi pilota"

  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>'
    +'<div class="detail-sheet">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<span style="font-size:28px;font-weight:900">#'+num+'</span>'
    +(isMine?'<span style="font-size:11px;color:#22c55e;font-weight:800;border:1px solid #22c55e;padding:2px 8px;border-radius:4px"><i class="ic ic-star"></i> TUO PILOTA</span>':'')
    +'</div>'
    +'<div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px">'+name+mediaChip({num:num})+'</div>'
    +'<div style="font-size:15px;font-weight:700;color:var(--text3);margin-bottom:8px">'+team+'</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:16px">'
    +'<span class="'+catCls+'" style="font-size:12px;padding:3px 10px;border-radius:6px;font-weight:800;border:1px solid">'+cat+'</span>'
    +'<span class="parity-badge">'+parity+'</span></div>'
    +'<div id="detail-hist" style="margin-bottom:14px"></div>'
    +'<div class="form-group"><label class="form-label">Note su questo pilota</label>'
    +'<textarea class="form-textarea" id="detail-note" placeholder="Appunti, info, osservazioni...">'+existingNote+'</textarea></div>'
    +(isMine?'':'<div class="form-group"><label class="form-label">Lavoro</label><div class="hl-picker" id="f-hl">'+addHlHtml()+'</div></div>'
      +'<div class="form-group" id="f-reel-wrap"'+(_addHl.includes('video')?'':' style="display:none"')+'><label class="form-label">Reel</label><div id="f-reel" style="display:flex;gap:8px">'+addReelHtml()+'</div></div>')
    +'<div class="detail-actions">'
    +'<button class="btn-note-pilot" onclick="saveDetailNote(\''+num+'\')"><i class="ic ic-save"></i> SALVA NOTE</button>'
    +(isMine?'':'<button class="btn-add-pilot" onclick="addPilotFromDetail(\''+num+'\')">+ AGGIUNGI AI MIEI</button>')
    +'</div>'
    +(isMine?'<div style="margin-top:10px"><button class="pilot-edit-btn" style="width:100%;padding:10px;text-align:center" onclick="closeModal();openEditPilot(\''+num+'\')"><i class="ic ic-note"></i> MODIFICA PILOTA</button></div>':'')
    +'</div>');
  loadPilotHistory(String(name).trim());
}
window.openPilotDetail=openPilotDetail;
// Storico risultati del pilota (history/<NOME>/<gara>, scritto dal server dai risultati ufficiali)
function histKeyOf(s){return String(s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'');}
function loadPilotHistory(name){
  const k=histKeyOf(name);if(!k)return;
  try{_fbDb.ref('history/'+k).once('value').then(s=>{
    const el=document.getElementById('detail-hist');if(!el)return;
    const h=s.val();if(!h)return;
    /* 19/11/2026 (Andrea): risultati in gergo di gara — Qualifiche, Manche 1/2/3 (in ordine di programma), Prefinale, Finale.
       Niente coppie di gruppi (A-C...) e niente prove libere / warm up. */
    const entries=Object.entries(h).filter(x=>x[1]);
    const isHeat=k=>/^[A-H]-[A-H]$/.test(k)||/^(M|H)\d$/.test(k);
    const draw=orders=>{
      el.innerHTML='<div class="form-label" style="margin-bottom:6px">Storico gare</div>'+entries.map(x=>x).sort((a,b)=>String(b[1].date||'').localeCompare(String(a[1].date||''))).map(([hk,r])=>{
        const res=r.result||{};const fmt=v=>/^\d+$/.test(String(v))?v+'°':esc(v);
        const ord=(orders&&orders[hk])||{};
        /* 19/11/2026 (Andrea): numero e nome della manche SOLO dal programma di quell'evento (ordine di gara, nome della sessione).
           Se il programma non la riporta non si inventa un numero: resta il nome ufficiale dei gruppi (es. "Manche A-C"). */
        const hk2=Object.keys(res).filter(isHeat);
        const known=hk2.filter(k=>ord[k]!=null||/^(M|H)\d$/.test(k)).sort((a,b)=>(ord[a]?ord[a].i:parseInt(a.slice(1))*1e-3)-(ord[b]?ord[b].i:parseInt(b.slice(1))*1e-3));
        const unknown=hk2.filter(k=>!known.includes(k)).sort();
        const parts=[];
        const qs=Object.keys(res).filter(k=>/^Q/.test(k)).sort();
        qs.forEach((k,i)=>parts.push('Qualifiche'+(qs.length>1?' '+(i+1):'')+' '+fmt(res[k])));
        known.forEach((k,i)=>{const nm=(ord[k]&&ord[k].name)||'Manche';const n=/^(M|H)\d$/.test(k)&&!ord[k]?k.slice(1):(i+1);parts.push(nm+(known.length>1||unknown.length||/^(M|H)\d$/.test(k)?' '+n:'')+' '+fmt(res[k]));});
        unknown.forEach(k=>parts.push('Manche '+esc(k)+' '+fmt(res[k])));
        Object.keys(res).filter(k=>k.startsWith('PF')).sort().forEach(k=>parts.push('Prefinale'+(k.length>3?' '+esc(k.slice(3)):'')+' '+fmt(res[k])));
        if(res.FIN!=null)parts.push('Finale '+fmt(res.FIN));
        const d=r.date?r.date.split('-').reverse().join('/'):'';
        return'<div style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;font-size:12px">'
          +'<div style="font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span>'+esc(r.race)+(d?' · '+d:'')+'</span>'
          +'<span class="'+catClass(r.cat)+'" style="font-size:11px;padding:1px 7px;border-radius:6px;border:1px solid;font-weight:800">'+esc(r.cat)+'</span><span>#'+esc(r.num)+'</span></div>'
          +'<div style="color:var(--text3);margin-top:2px">'+(parts.length?parts.join(' · '):'nessun risultato ancora')+(r.inFinal&&res.FIN==null?' · in finale':'')+(r.eliminated&&!r.inFinal?' · eliminato':'')+'</div></div>';
      }).join('');
    };
    const esc=t=>String(t==null?'':t).replace(/[<>&"]/g,'');
    draw(null);
    // ordine vero delle manche dal programma di quella gara (letto solo se servono, una volta)
    const need=entries.filter(([hk,r])=>Object.keys(r.result||{}).filter(isHeat).length>1);
    if(need.length){const orders={};Promise.all(need.map(([hk,r])=>{const rid=(hk.match(/^(race_\d+|[^_]+(?:_[^_]+)*?)(?:_\d{1,3})?$/)||[])[1]||hk;
      return Promise.all([_fbDb.ref('races/'+rid+'/schedule').once('value'),_fbDb.ref('races/'+rid+'/days').once('value')]).then(([ss,ds])=>{
        const sc=ss.val()||{};let days=ds.val()||Object.keys(sc);if(!Array.isArray(days))days=Object.values(days);const o={};let i=0;
        const nice=t=>{t=String(t||'').trim();if(!t)return'Manche';t=t.charAt(0).toUpperCase()+t.slice(1).toLowerCase();return t.replace(/^Manches$/,'Manche').replace(/^Heats$/,'Heat');};
        days.forEach(dn=>{let arr=sc[dn]||[];if(!Array.isArray(arr))arr=Object.values(arr);let ses='';
          arr.slice().sort((a,b)=>slotMins(a.time)-slotMins(b.time)).forEach(sl=>{i++;if(!sl)return;if(sl.session)ses=sl.session;   // il nome della sessione sta sul primo turno del blocco
            if(sl.type!=='group'||canonCat(sl.cat)!==canonCat(r.cat))return;
            let f=sl.filter||[];if(!Array.isArray(f))f=Object.values(f);const v={i,name:nice(ses)};const k=f.join('-');if(o[k]==null)o[k]=v;const k2=f.slice().reverse().join('-');if(o[k2]==null)o[k2]=v;});});
        orders[hk]=o;}).catch(()=>{});})).then(()=>{if(document.getElementById('detail-hist'))draw(orders);});}
  });}catch(e){}
}

function saveDetailNote(num){
  const el=document.getElementById('detail-note');
  if(el){notes[num]=el.value;saveUserField('notes',notes);alert('Note salvate');}
}
window.saveDetailNote=saveDetailNote;

function addPilotFromDetail(num){
  if(pilots.find(p=>p.num===num)){alert('Già nei tuoi piloti');return;}
  const entry=lookupByNum(num);
  const noteEl=document.getElementById('detail-note');
  const note=noteEl?noteEl.value.trim():'';
  const name=entry?(entry.lastName+' '+entry.firstName).toUpperCase():'PILOTA '+num;
  const team=entry?(entry.team||'').toUpperCase():'';
  const cat=entry?entry.cat:'OK';
  const group=entry&&entry.group?entry.group:'';
  const serie=entry&&entry.serie?entry.serie.toString():'';
  const prefinal=entry&&entry.prefinal?entry.prefinal:'';
  const heats=entry&&entry.heats?entry.heats:[];
  _rtNewPilots.add(String(num));pilots.push({num:num.toString(),name,team,cat,parity:autoParity(num),group,prefinal,serie,heats,eliminated:false,highlight:_addHl.slice(),reel:_addHl.includes('video')?_addReel:''});
  statuses[num]={};TASKS.forEach(t=>statuses[num][t]='red');
  trackStatus[num]={};notes[num]=note;
  // Update pilot count in race index
  const u={};u['races_index/'+activeRaceId+'/pilotCount']=pilots.length;
  update(ref(db),u);
  saveAll();closeModal();
  refreshPilotSearch();
}
window.addPilotFromDetail=addPilotFromDetail;

// Ridisegna subito i risultati della ricerca piloti (es. dopo aver aggiunto un pilota)
function refreshPilotSearch(){
  const res=document.getElementById('pilots-search-results');
  if(!res||res.style.display==='none')return;
  if(pilotSearchMode==='text'){
    const inp=document.getElementById('pilots-search');
    if(inp&&inp.value.trim())filterPilots(inp.value);
  } else {
    renderPilotSearchResults();
  }
}
window.refreshPilotSearch=refreshPilotSearch;

// ══════════════════════════════════════
// TEAM
// ══════════════════════════════════════
function teamKey(name){return String(name||'').trim().toUpperCase().replace(/[.#$\[\]\/]/g,'_')||'_';}
/* 18/11/2026 (Andrea): "AKM MOTORSPORT" e "ASD AKM MOTORSPORT" sono lo stesso team. Per confrontare i team si ignorano
   forme giuridiche (ASD, A.S.D., SSD, SRL, S.R.O., LTD, GMBH...), punteggiatura e accenti. La chiave salvata (teamKey) non cambia. */
const TEAM_LEGAL=new Set(['ASD','SSD','SSDARL','SRL','SRLS','SNC','SAS','SPA','LTD','GMBH','BV','SL','SA','SRO','KFT','OY','AB','INC','LLC','SARL','SAS','EV','UG','AS','DOO']);
function teamNorm(name){
  return String(name||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\./g,'').replace(/[^A-Z0-9]+/g,' ')
    .trim().split(' ').filter(w=>w&&!TEAM_LEGAL.has(w)).join(' ');
}
function sameTeam(a,b){const x=teamNorm(a),y=teamNorm(b);return!!x&&x===y;}
function teamOfKey(t){return t&&(t.name||t.key);}
function escAttr(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');}
// Piloti dell'entry list che appartengono al team, come oggetti simili ai piloti
function teamEntrants(t){
  const out=[];
  Object.entries(currentEntryList).forEach(([num,e])=>{
    if(!e||!(teamKey(e.team)===t.key||sameTeam(e.team,teamOfKey(t))))return;
    let h=e.heats||[];if(!Array.isArray(h))h=typeof h==='object'?Object.values(h):[];
    out.push({num,cat:e.cat||'',parity:e.parity||autoParity(num),serie:e.serie||'',group:e.group||'',prefinal:e.prefinal||'',eliminated:!!e.eliminated,heats:h,name:(e.lastName||'')+' '+(e.firstName||'')});
  });
  return out.sort((a,b)=>parseInt(a.num)-parseInt(b.num));
}
function entrantInSlot(p,slot){
  if(canonCat(p.cat)!==canonCat(slot.cat))return false;
  if(slot.type==='all')return true;
  if(slot.type==='parity')return p.parity===slot.filter;
  if(slot.type==='serie')return!!pSerie(p)&&pSerie(p)===String(slot.filter).trim();
  if(slot.type==='group')return pilotInGroup(p,Array.isArray(slot.filter)?slot.filter:Object.values(slot.filter||{}));
  if(slot.type==='prefinal')return!!p.prefinal&&String(p.prefinal).trim().toUpperCase()===String(slot.filter).trim().toUpperCase();
  if(slot.type==='list')return Array.isArray(slot.filter)&&slot.filter.map(String).includes(String(p.num));
  return false;
}
// Team con almeno un pilota nello slot; se mancano le assegnazioni conta i piloti della categoria in attesa
function teamsForSlot(slot){
  const res=[];
  teams.forEach(t=>{
    const ents=teamEntrants(t).filter(p=>canonCat(p.cat)===canonCat(slot.cat));
    if(!ents.length)return;
    const inSlot=ents.filter(p=>entrantInSlot(p,slot));
    let waiting=[];
    if(slot.type==='serie')waiting=ents.filter(p=>!pSerie(p));
    if(slot.type==='group')waiting=ents.filter(p=>!pilotHasGroupData(p));
    if(slot.type==='prefinal')waiting=ents.filter(p=>!String(p.prefinal||'').trim()&&!p.eliminated); // 22/11: eliminato = non in attesa
    if(inSlot.length||waiting.length)res.push({t,inSlot,waiting});
  });
  return res;
}
/* 19/11/2026 (Andrea): i piloti di un team seguito hanno pillole proprie e indipendenti (prima toccandone una cambiava tutto il team).
   Stato salvato per numero in statuses/<num> come per i miei piloti; senza dato = rosso. */
function teamPilotTaskBtn(num,task){
  const s=(statuses[num]||{})[task]||'red';
  return'<button class="task-btn '+s+'" style="padding:4px 8px;font-size:10px" onclick="toggleTask(\''+num+'\',\''+task+'\')">'+task+'</button>';
}
function teamTaskBtn(key,task,small){
  const s=(teamStatuses[key]||{})[task]||'red';
  const sz=small?'style="padding:4px 8px;font-size:10px"':'';
  return'<button class="task-btn '+s+'" '+sz+' onclick="toggleTeamTask(\''+escAttr(key)+'\',\''+task+'\')">'+task+'</button>';
}
/* 20/11/2026 (Andrea): punti di scatto dei piloti del team in pista, uno per pilota */
function teamSpotsRow(list){if(!venueMap()||!list||!list.length)return'';
  const it=list.map(p=>{const sp=spotPill(p.num);return sp?'<span class="tsp-item"><span class="inner-num">#'+p.num+'</span>'+sp+'</span>':'';}).filter(Boolean);
  return it.length?'<div class="tasks tsp-row" style="margin-top:6px;flex-wrap:wrap">'+it.join('')+'</div>':'';}
function teamsViewHasCards(){try{return teamViewMode()!=='cards';}catch(_){return false;}}
function teamsSlotHtml(slot){
  const list=teamsForSlot(slot);if(!list.length)return'';
  return list.map(({t,inSlot,waiting})=>'<div class="card-inner team-inner"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">'
    +'<span class="inner-num"><i class="ic ic-team"></i></span><span class="inner-name">'+t.name+'</span>'
    +'<span style="font-size:10px;font-weight:800;color:#a78bfa">'+(inSlot.length?inSlot.length+' in pista: '+inSlot.map(p=>'#'+p.num+(gridPos(p.num,slot)?' <span style="color:#e9d5a8">P'+gridPos(p.num,slot)+'</span>':'')).join(' · '):'')
    +(waiting.length?(inSlot.length?' · ':'')+'<i class="ic ic-wait"></i> '+waiting.length+' in attesa':'')+'</span></div>'
    +'<div class="tasks">'+TASKS.map(k=>teamTaskBtn(t.key,k,true)).join('')+'</div>'
    +(teamsViewHasCards()?'':teamSpotsRow(inSlot))
    +(teamNotes[t.key]?'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> '+teamNotes[t.key]+'</div>':'')+'</div>').join('');
}
function addTeam(name){
  const key=teamKey(name);
  if(teams.some(t=>t.key===key||sameTeam(name,teamOfKey(t)))){setPilotsView('team');return;}
  teams.push({key,name:String(name).trim().toUpperCase(),highlight:[defaultHl()],reel:defaultHl()==='video'?'30':''});
  teamStatuses[key]={};TASKS.forEach(k=>teamStatuses[key][k]='red');
  teamNotes[key]='';
  saveAll();renderPilotSearchResults();
}
window.addTeam=addTeam;
/* 19/11/2026 (Andrea): anche il TEAM ha il suo lavoro (FOTO / VIDEO, mai vuoto) e, se VIDEO, la durata del reel di team.
   Si imposta sulla scheda del team (Piloti > Team); alla creazione parte dal predefinito dell'account. */
function teamHl(t){let h=t&&t.highlight;if(typeof h==='string')h=[h];if(h&&!Array.isArray(h))h=Object.values(h);h=(h||[]).filter(x=>x==='foto'||x==='video');return h.length?h:[defaultHl()];}
function teamWork(t){const h=teamHl(t);return{highlight:h,reel:h.includes('video')?String(t.reel||'30'):''};}
function teamWorkChips(t){const w=teamWork(t);
  return w.highlight.map(k=>'<span class="hl-badge hl-'+k+'" style="flex-shrink:0">'+(k==='foto'?'<i class="ic ic-hl-foto"></i> FOTO':'<i class="ic ic-hl-video"></i> VIDEO')+'</span>').join('')+reelChip(w);}
function teamWorkRowHtml(t){const w=teamWork(t);const k=escAttr(t.key);
  const b=(on,lab,click,col)=>'<button onclick="'+click+'" style="min-width:60px;min-height:40px;padding:0 10px;border-radius:8px;font-family:inherit;font-weight:800;font-size:12px;cursor:pointer;touch-action:manipulation;'
    +(on?'background:'+col+';color:#12100c;border:1px solid '+col:'background:none;color:var(--text3);border:1px solid var(--border2,#444)')+'">'+lab+'</button>';
  return'<div style="display:flex;align-items:center;gap:6px;margin:10px 0 2px;flex-wrap:wrap"><span class="note-label" style="margin:0 4px 0 0">Lavoro</span>'
    +b(w.highlight.includes('foto'),'<i class="ic ic-hl-foto"></i> FOTO',"toggleTeamHl('"+k+"','foto')",'#38bdf8')
    +b(w.highlight.includes('video'),'<i class="ic ic-hl-video"></i> VIDEO',"toggleTeamHl('"+k+"','video')",'#ec4899')
    +(w.reel?'<span class="note-label" style="margin:0 4px 0 10px">Reel</span>'+REEL_OPTS.map(([v,l])=>b(w.reel===v,l,"setTeamReel('"+k+"','"+v+"')",'#e9d5a8')).join(''):'')+'</div>';}
function _teamByKey(key){return teams.find(t=>t.key===key);}
function _teamKeepNotes(){teams.forEach(t=>{const el=document.getElementById('tnote-'+t.key);if(el)teamNotes[t.key]=el.value;});}
function toggleTeamHl(key,k){const t=_teamByKey(key);if(!t)return;let h=teamHl(t);
  if(h.includes(k)){if(h.length===1)return;h=h.filter(x=>x!==k);}else h=h.concat(k);
  _teamKeepNotes();t.highlight=h;t.reel=h.includes('video')?String(t.reel||'30'):'';saveAll();try{renderPilots();}catch(e){}}
function setTeamReel(key,v){const t=_teamByKey(key);if(!t)return;_teamKeepNotes();t.highlight=teamHl(t);t.reel=v;saveAll();   // 19/11/2026: si salva anche il lavoro mostrato (predefinito)
 try{renderPilots();}catch(e){}}
window.toggleTeamHl=toggleTeamHl;window.setTeamReel=setTeamReel;
function removeTeam(key){
  if(!confirm('Rimuovere il team?'))return;
  teams=teams.filter(t=>t.key!==key);
  delete teamStatuses[key];delete teamNotes[key];
  saveAll();renderPilots();
}
window.removeTeam=removeTeam;
function toggleTeamTask(key,task){
  if(!teamStatuses[key])teamStatuses[key]={};
  teamStatuses[key][task]=cycleStatus(teamStatuses[key][task]||'red');
  pillSave('teamStatuses',teamStatuses);
  pillPaint("toggleTeamTask('"+escAttr(key).replace(/&quot;/g,'"')+"','"+task+"')",teamStatuses[key][task]);
  pillRenderLater();
}
window.toggleTeamTask=toggleTeamTask;
function saveTeamNote(key){
  const el=document.getElementById('tnote-'+key);if(!el)return;
  teamNotes[key]=el.value;saveUserField('teamNotes',teamNotes);
}
window.saveTeamNote=saveTeamNote;
function setPilotsView(v){
  if(pilotsView!==v)setTimeout(()=>viewSwap(['pilots-list'],v==='team'?'r':'l'),0);
  pilotsView=v;localStorage.setItem('rt_pview',v);
  if(pilotSearchMode!=='text')setPilotSearchMode('text');
  clearPilotsSearch();
  renderPilots();window.scrollTo({top:0});
}
window.setPilotsView=setPilotsView;
function teamMatchesFilter(t){
  if(!filterStatuses.size)return true;
  return statusMatches(teamStatuses[t.key]||{});
}
function renderTeams(){
  const el=document.getElementById('pilots-list');
  if(!teams.length){el.innerHTML='<p class="no-pilots">Nessun team. Cerca per <i class="ic ic-team"></i> TEAM e premi <i class="ic ic-plus"></i> AGGIUNGI TEAM.</p>';return;}
  const filtered=teams.filter(teamMatchesFilter).sort((a,b)=>a.name.localeCompare(b.name));
  const counter='<div style="font-size:11px;font-weight:700;color:var(--text4);margin-bottom:14px;letter-spacing:1px;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;">'
    +(filterStatuses.size?'FILTRO':'TOTALE TEAM')+' <span style="color:var(--text);font-size:18px;font-weight:900;margin-left:8px;">'+filtered.length+(filterStatuses.size?'/'+teams.length:'')+'</span></div>';
  el.innerHTML=counter+filtered.map(t=>{
    const ents=teamEntrants(t);
    const cats=[...new Set(ents.map(p=>p.cat))];
    return'<div class="card team-card"><div class="pilot-header"><div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap">'+cats.map(c=>'<span class="pilot-cat '+catClass(c)+'">'+c+'</span>').join('')+'</div>'
      +'<div style="display:flex;align-items:center;gap:8px;margin-top:3px"><span class="pilot-num"><i class="ic ic-team"></i></span><span class="pilot-name">'+t.name+'</span></div>'
      +'<div class="pilot-team">'+ents.length+' piloti iscritti</div>'
      +'<div class="team-nums">'+ents.map(p=>'<span class="team-num'+(pilots.some(x=>x.num===p.num)?' mine':'')+'" onclick="openPilotDetail(\''+p.num+'\')">#'+p.num+'</span>').join('')+'</div>'
      +'</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px">'
      +'<button class="pilot-edit-btn" style="color:#ef4444;border-color:#ef4444" onclick="removeTeam(\''+escAttr(t.key)+'\')"><i class="ic ic-close"></i> rimuovi</button></div></div>'
      +'<div class="tasks">'+TASKS.map(k=>teamTaskBtn(t.key,k,false)).join('')+'</div>'
      +teamWorkRowHtml(t)
      +'<div class="note-wrap"><span class="note-label">Note</span>'
      +'<textarea class="note-area" id="tnote-'+t.key+'" placeholder="Es. tenda dietro box 12..." onblur="saveTeamNote(\''+escAttr(t.key)+'\')">'+(teamNotes[t.key]||'')+'</textarea></div></div>';
  }).join('');
}

// ══════════════════════════════════════
// VISTA GENERALE GIORNATA
// ══════════════════════════════════════
let ovShowAll=false;
function slotMins(t){const p=String(t).split('.');return parseInt(p[0])*60+parseInt(p[1]||'0');}
function openOverview(){
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>'
    +'<div style="font-size:14px;font-weight:900;margin-bottom:4px"><i class="ic ic-list"></i> '+activeDay+'</div>'
    +'<div style="font-size:10px;color:var(--text4);font-weight:700;margin-bottom:10px">Colore = pillola PISTA · tocca un numero per la scheda</div>'
    +'<button class="pv-btn" id="ov-all" style="width:100%;margin-bottom:10px" onclick="ovShowAll=!ovShowAll;renderOverviewBody()"></button>'
    +'<div id="ov-body"></div>');
  renderOverviewBody();
  setTimeout(()=>{const n=document.querySelector('.ov-row.now');if(n)n.scrollIntoView({block:'center'});},100);
}
window.openOverview=openOverview;
function renderOverviewBody(){
  const body=document.getElementById('ov-body');if(!body)return;
  const btn=document.getElementById('ov-all');if(btn)btn.textContent=ovShowAll?'NASCONDI SESSIONI SENZA MIEI':'MOSTRA TUTTE LE SESSIONI';
  let slots=currentSchedule[activeDay]||[];slots=Array.isArray(slots)?slots:Object.values(slots);
  slots.forEach(s=>{if(s.filter&&!Array.isArray(s.filter)&&typeof s.filter==='object')s.filter=Object.values(s.filter);});
  const {blk:_ob,cnt:_oc}=progBlocks(slots);
  const rows=slots.map((s,i)=>({si:i,time:s.time,cat:s.cat,label:s.label||s.cat,sub:slotFilterLabel(s),ps:pilotsForSlot(s),aw:pilotsAwaitingData(s),ts:teamsForSlot(s)}));
  if(activeDay===currentDays[currentDays.length-1]){
    currentFinals.forEach(f=>{
      const allCat=pilots.filter(p=>canonCat(p.cat)===canonCat(f.cat)&&!p.eliminated);const fin=allCat.filter(p=>p.inFinal);
      rows.push({time:f.time,cat:f.cat,label:f.label||f.cat,sub:'FINALE',ps:fin.length?fin:allCat,aw:[],ts:teams.filter(t=>teamEntrants(t).some(p=>canonCat(p.cat)===canonCat(f.cat))).map(t=>({t,inSlot:[],waiting:[]}))});
    });
  }
  const isToday=autoDayName()===activeDay;
  const nowM=new Date().getHours()*60+new Date().getMinutes()-scheduleDelay;
  let nowIdx=-1;if(isToday)rows.forEach((r,i)=>{if(slotMins(r.time)<=nowM)nowIdx=i;});
  let _ol='';let _ofin=false;
  const html=rows.map((r,i)=>{
    const empty=!r.ps.length&&!r.aw.length&&!r.ts.length;
    // 19/11/2026 (Andrea): inizio di ogni sessione con il suo nome e pausa pranzo, anche qui
    let pre='';
    if(r.si!=null)pre+=lunchHtml(slots,r.si,true);
    if(empty&&!ovShowAll)return pre;
    if(r.si!=null){const b=_ob[r.si];if(b&&b.ses&&b.id!==_ol){pre+=['<div class="session-divider ov-div">',blkLabel(b,_oc),'</div>'].join('');_ol=b.id;}}
    else if(!_ofin){pre+='<div class="session-divider ov-div">FINALI</div>';_ofin=true;}
    const cls=i===nowIdx?' now':(isToday&&i<nowIdx?' past':'');
    const nums=r.ps.map(p=>{const st=(statuses[p.num]||{}).PISTA||'red';return'<span class="ov-n '+st+'" onclick="ovOpenPilot(\''+p.num+'\')">'+p.num+'</span>';}).join('')
      +(r.aw.length?'<span class="ov-n" style="opacity:.5;border-style:dashed"><i class="ic ic-wait"></i>'+r.aw.length+'</span>':'')
      +r.ts.map(({t})=>{const st=(teamStatuses[t.key]||{}).PISTA||'red';return'<span class="ov-t '+st+'" onclick="toggleTeamTask(\''+escAttr(t.key)+'\',\'PISTA\')"><i class="ic ic-team"></i> '+t.name+'</span>';}).join('');
    return pre+'<div class="ov-row'+cls+'"><span class="ov-time">'+r.time+'</span><span class="ov-cat '+catClass(r.cat)+'">'+r.label+'<br><span style="color:var(--text4);font-size:9px">'+r.sub+'</span></span>'
      +'<div class="ov-nums">'+(nums||'<span style="font-size:10px;color:var(--text4)">—</span>')
      +r.ps.filter(p=>String(notes[p.num]||'').trim()).map(p=>'<div class="note-txt" style="width:100%">#'+p.num+' <i class="ic ic-note"></i> '+String(notes[p.num]).replace(/</g,'&lt;')+'</div>').join('')+'</div></div>';
  }).join('');
  body.innerHTML=html||'<div class="empty-state"><p>Nessun tuo pilota o team in questa giornata</p></div>';
}
window.renderOverviewBody=renderOverviewBody;
function ovOpenPilot(num){closeModal();openPilotDetail(num);}
window.ovOpenPilot=ovOpenPilot;
function autoDayName(){
  const names=['DOMENICA','LUNEDÌ','MARTEDÌ','MERCOLEDÌ','GIOVEDÌ','VENERDÌ','SABATO'];
  const n=names[new Date().getDay()];
  const plain=s=>String(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return currentDays.find(d=>plain(d).startsWith(plain(n)))||'';
}

// ── COPIA TUTTI PER EDITOR ──
/* 19/11/2026 (Andrea): un solo tasto ESPORTA PILOTI al posto di Esporta/Importa (backup JSON) e Copia per editor.
   Chiede: copia negli appunti (testo per l'editor) oppure PDF con tutti i dati (stampa -> "Salva come PDF"). */
function openExportPilots(){
  if(!pilots.length&&!teams.length){alert('Nessun pilota da esportare');return;}
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button><div class="modal-title">Esporta piloti</div>'
    +'<button class="form-submit" style="margin-bottom:10px" onclick="closeModal();copyAllForEditor()"><i class="ic ic-list"></i> COPIA NEGLI APPUNTI</button>'
    +'<button class="form-submit" style="background:none;border:1.5px solid var(--border2,#444);color:var(--text)" onclick="closeModal();exportPilotsPdf()"><i class="ic ic-download"></i> PDF CON TUTTI I DATI</button>'
    +'<button class="form-submit" style="margin-top:10px;background:none;border:1.5px solid var(--border2,#444);color:var(--text)" onclick="closeModal();exportPilotsJson()"><i class="ic ic-download"></i> JSON (PILOTI E TEAM)</button>');
}
window.openExportPilots=openExportPilots;
/* 20/11/2026 (Andrea): JSON dei MIEI piloti e team, con account e gara (servira' anche all'esportazione automatica di un altro progetto) */
function exportPilotsJson(){
  const r=(typeof races!=='undefined'&&races&&races[activeRaceId])||{};
  const el=currentEntryList||{};
  const hlOf=p=>{let h=p.highlight;if(typeof h==='string')h=[h];if(h&&!Array.isArray(h))h=Object.values(h);return h||[];};
  const byNum=(a,b)=>(parseInt(a.num)||0)-(parseInt(b.num)||0);
  const pil=p=>{const e=el[p.num]||{};return{num:String(p.num),nome:String(p.name||'').trim(),cat:p.cat||e.cat||'',team:p.team||e.team||'',
    serie:String(e.serie||p.serie||''),gruppo:String(e.group||p.group||''),evidenzia:hlOf(p),reel:hasVideo(p)?String(p.reel||'30'):''};};
  const out={formato:'racetracker-piloti-v1',esportato:new Date().toISOString(),
    account:{utente:currentUserId||'',login:(_fbAuth&&_fbAuth.currentUser&&_fbAuth.currentUser.email)||''},
    gara:{id:activeRaceId||'',nome:r.name||'',circuito:r.circuit||'',organizzazione:r.org||'',inizio:r.startDate||'',fine:r.endDate||''},
    piloti:pilots.slice().sort(byNum).map(pil),
    team:teams.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(t=>{const w=teamWork(t);return{team:t.name,evidenzia:w.highlight,reel:w.reel,
      piloti:teamEntrants(t).sort(byNum).map(p=>{const e=el[p.num]||{};return{num:String(p.num),nome:String(p.name||'').trim(),cat:p.cat||e.cat||'',team:p.team||e.team||'',serie:String(e.serie||''),gruppo:String(e.group||'')};})};})};
  const fname=[r.name||'Gara',r.circuit||'',currentUserId||''].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim()+'.json';
  const blob=new Blob([JSON.stringify(out,null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
}
window.exportPilotsJson=exportPilotsJson;
function exportPilotsPdf(){
  const e=t=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const r=(typeof races!=='undefined'&&races&&races[activeRaceId])||{};
  const stLab={red:'da fare',orange:'in corso',green:'fatto'};
  const hlOf=p=>{let h=p.highlight;if(typeof h==='string')h=[h];if(h&&!Array.isArray(h))h=Object.values(h);return h||[];};
  const work=p=>hlOf(p).map(x=>x==='foto'?'Foto':x==='video'?'Video':x==='priority'?'Priorità':x).join(', ')+(hasVideo(p)?' · '+reelText(p.reel):'');
  const tasks=st=>TASKS.map(k=>'<span class="t '+((st&&st[k])||'red')+'">'+k+'</span>').join(' ');
  const byNum=(a,b)=>(parseInt(a.num)||0)-(parseInt(b.num)||0);
  const rows=pilots.slice().sort((a,b)=>String(a.cat).localeCompare(String(b.cat))||byNum(a,b)).map(p=>{
    let ft=null;try{ft=followedTeamOf(p.num,p.team||'');}catch(x){}
    return'<tr><td class="n">#'+e(p.num)+'</td><td><b>'+e(p.name)+'</b><br><span class="s">'+e(p.team)+(ft?' · anche personale':'')+'</span></td><td>'+e(p.cat)+'</td><td>'+e(work(p))+'</td><td>'+e(notes[p.num]||'')+'</td></tr>';}).join('');
  const trows=teams.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(t=>{const w=teamWork(t);const ents=teamEntrants(t).sort(byNum);
    return'<tr><td colspan="2"><b>'+e(t.name)+'</b><br><span class="s">'+ents.map(p=>'#'+e(p.num)+' '+e(p.name)+(notes[p.num]?' — '+e(notes[p.num]):'')).join('<br>')+'</span></td><td>'+e([...new Set(ents.map(p=>p.cat))].join(', '))+'</td><td>'
      +e(w.highlight.map(x=>x==='foto'?'Foto':'Video').join(', ')+(w.reel?' · '+reelText(w.reel):''))+'</td><td>'+e(teamNotes[t.key]||'')+'</td></tr>';}).join('');
  const head='<tr><th colspan="2">Pilota</th><th>Cat.</th><th>Lavoro</th><th>Note</th></tr>';
  const d=new Date();const when=d.toLocaleDateString('it-IT')+' '+d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  // 19/11/2026 (Andrea): nome del file = NOME EVENTO + NOME CIRCUITO + DATA (la data di inizio gara, gg-mm-aaaa)
  const fname=[r.name||'Gara',r.circuit||'',r.startDate?r.startDate.split('-').reverse().join('-'):''].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim();
  const html='<!doctype html><html lang="it"><head><meta charset="utf-8"><title>'+e(fname)+'</title><style>'
    +'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;margin:16px}h1{font-size:18px;margin:0}h2{font-size:13px;margin:18px 0 6px}.sub{color:#555;margin:2px 0 12px}'
    +'table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eee;font-size:10px}'
    +'.n{font-weight:bold;white-space:nowrap}.s{color:#555;font-size:10px}.t{font-size:8px;padding:1px 3px;border-radius:3px;border:1px solid #999;white-space:nowrap}.t.green{background:#c8f0d2}.t.orange{background:#ffe2a8}.t.red{background:#f7c9c9}'
    +'tr{page-break-inside:avoid}@page{margin:10mm}</style></head><body>'
    +'<h1>'+e(r.name||'Gara')+'</h1><div class="sub">'+e(r.circuit||'')+(r.startDate?' · '+e(r.startDate.split('-').reverse().join('/')):'')+' · utente '+e(currentUserId)+' · esportato '+e(when)+'</div>'
    +(rows?'<h2>Piloti ('+pilots.length+')</h2><table>'+head+rows+'</table>':'')
    +(trows?'<h2>Team ('+teams.length+')</h2><table>'+head.replace('Pilota','Team e piloti')+trows+'</table>':'')
    +'</body></html>';
  // stampa da un riquadro nascosto: nella finestra di stampa si sceglie "Salva come PDF"
  let f=document.getElementById('rt-print');if(f)f.remove();
  f=document.createElement('iframe');f.id='rt-print';f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const w=f.contentWindow;w.document.open();w.document.write(html);w.document.close();
  // alcuni browser prendono il nome del file dal titolo della pagina principale: lo si cambia solo durante la stampa
  const oldTitle=document.title;const back=()=>{document.title=oldTitle;};
  // Su Android "afterprint" scatta subito, prima che il telefono legga il nome: il titolo si rimette solo quando si torna
  // nell'app dopo la stampa (pagina di nuovo visibile, passati almeno 4 s) o comunque dopo 5 minuti.
  document.title=fname;const t0=Date.now();
  const onBack=()=>{if(document.visibilityState==='visible'&&Date.now()-t0>4000){back();document.removeEventListener('visibilitychange',onBack);window.removeEventListener('focus',onBack);}};
  document.addEventListener('visibilitychange',onBack);window.addEventListener('focus',onBack);
  setTimeout(()=>{back();document.removeEventListener('visibilitychange',onBack);window.removeEventListener('focus',onBack);},300000);
  setTimeout(()=>{try{w.focus();w.print();}catch(x){back();alert('Stampa non disponibile su questo dispositivo');}},300);
}
window.exportPilotsPdf=exportPilotsPdf;
function copyAllForEditor(){
  if(!pilots.length){alert('Nessun pilota da copiare');return;}
  const all=pilots.slice();
  // 16/11/2026 (Andrea): piloti dei team seguiti in fondo, in sottoliste con in cima "#NOME TEAM"
  const fmt=p=>{
    // 16/11/2026 (Andrea): chi e' arrivato in finale ha la nota "Arrivato in finale" nella copia per l'editor
    const e=currentEntryList[p.num]||{};const fin=p.inFinal===true||e.inFinal===true;
    const note=[notes[p.num]?notes[p.num].trim():'',fin?'Arrivato in finale':''].filter(Boolean).join(' · ');
    const rl=hasVideo(p)?reelText(p.reel):'';
    const ft=hasFoto(p)?fotoTagsOf(p).map(v=>FOTO_OPTS.find(o=>o[0]===v)[1]).join(', '):'';
    return'#'+p.num+' '+p.name+(rl?' · '+rl:'')+(ft?' · Foto '+ft:'')+(note?'\nNote: '+note:'');
  };
  const byNum=(a,b)=>(parseInt(a.num)||0)-(parseInt(b.num)||0);
  const tOf=p=>{try{return followedTeamOf(p.num,p.team||((currentEntryList[p.num]||{}).team)||'');}catch(e){return null;}};
  // 18/11/2026 (Andrea): i miei piloti che sono anche in un team seguito (acquisto personale) stanno sia tra i personali sia nel team;
  // nella sottolista del team anche i piloti del team (non miei) con una nota scritta
  const loose=all.slice().sort(byNum).map(fmt);
  const parts=loose.length?[loose.join('\n\n')]:[];
  const mineSet=new Set(all.map(p=>String(p.num)));
  teams.forEach(t=>{
    const g=all.filter(p=>{const x=tOf(p);return x&&x.key===t.key;}).map(p=>Object.assign({},p,{_pers:true}));
    Object.keys(notes||{}).forEach(n=>{if(mineSet.has(String(n))||!String(notes[n]||'').trim())return;const e=(currentEntryList||{})[n];if(!e)return;
      let x=null;try{x=followedTeamOf(n,e.team||'');}catch(err){}
      if(x&&x.key===t.key)g.push({num:n,name:String((e.lastName||'')+' '+(e.firstName||'')).trim(),team:e.team||''});});
    g.sort(byNum);
    if(g.length)parts.push('#'+String(t.name||t.key).toUpperCase()+(function(){const w=teamWork(t);return' · '+w.highlight.map(x=>x==='foto'?'Foto':'Video').join(' + ')+(w.reel?' · '+reelText(w.reel):'');})()+'\n\n'+g.map(p=>fmt(p).replace(/^(#\S+ [^\n]*)/,p._pers?'$1 (anche personale)':'$1')).join('\n\n'));});
  const text=parts.join('\n\n\n');
  navigator.clipboard.writeText(text)
    .then(()=>alert('Copiato! '+all.length+' piloti negli appunti.'))
    .catch(()=>{prompt('Copia questo testo:',text);});
}
window.copyAllForEditor=copyAllForEditor;

// ══════════════════════════════════════
// ADVANCED SEARCH — shared helpers
// ══════════════════════════════════════
const CATS=['KZ2','OK','OKN','OKJ','MINI GR3','MINI U10','OK-NJ'];

function getMyTeams(){
  return groupTeamNames(pilots.map(p=>p.team||((currentEntryList[p.num]||{}).team)||''));
}
function myPilotMatches(p,mode,team,cat){
  if(mode==='team')return!!team&&sameTeam(p.team||((currentEntryList[p.num]||{}).team)||'',team);
  if(mode==='cat')return!!cat&&canonCat(p.cat)===canonCat(cat);
  return true;
}
function groupTeamNames(names){
  const g={};names.forEach(n=>{if(!n)return;const k=teamNorm(n)||n;g[k]=g[k]||{c:0,v:{}};g[k].c++;g[k].v[n]=(g[k].v[n]||0)+1;});
  return Object.values(g).map(x=>[Object.entries(x.v).sort((a,b)=>b[1]-a[1]||a[0].length-b[0].length)[0][0],x.c]).sort((a,b)=>a[0].localeCompare(b[0]));
}
function getTeamsFromEntryList(){
  return groupTeamNames(Object.values(currentEntryList).map(e=>e&&e.team));
}

function buildCatGrid(containerId,onClickFn,activeCat){
  const el=document.getElementById(containerId);if(!el)return;
  // Solo le categorie presenti: nell'Entry list quelle della gara, in Piloti/Programma quelle dei miei piloti
  const src=containerId.indexOf('el-')===0?Object.values(currentEntryList||{}).map(e=>e&&e.cat):pilots.map(p=>p.cat);
  const seen=new Map();src.forEach(c=>{if(!c)return;const k=canonCat(c);if(!seen.has(k))seen.set(k,c);});
  const ord=CATS.map(canonCat);
  const list=[...seen.entries()].sort((a,b)=>{const ia=ord.indexOf(a[0]),ib=ord.indexOf(b[0]);return(ia<0?99:ia)-(ib<0?99:ib);}).map(x=>x[1]);
  if(!list.length){el.innerHTML='<div style="font-size:12px;color:var(--text4);padding:8px">Nessuna categoria</div>';return;}
  el.innerHTML=list.map(c=>{
    const cls=catClass(c);const isActive=activeCat===c;
    return'<button class="adv-cat-btn '+cls+(isActive?' active':'')+'" onclick="'+onClickFn+'(\''+c+'\')">'+c+'</button>';
  }).join('');
}

// ── ADVANCED SEARCH: PILOTI tab ──
let pilotSearchMode='text';
let pilotSearchTeam='';
let pilotSearchCat='';

function setPilotSearchMode(mode){
  pilotSearchMode=mode;
  pilotSearchTeam='';pilotSearchCat='';
  ['text','team','cat'].forEach(m=>{
    const btn=document.getElementById('p-mode-'+m);if(btn)btn.classList.toggle('active',m===mode);
    const wrap=document.getElementById('p-search-'+m+'-wrap');if(wrap)wrap.style.display=m===mode?'':'none';
  });
  const resEl=document.getElementById('pilots-search-results');
  const listEl=document.getElementById('pilots-list');
  if(mode==='text'){resEl.style.display='none';listEl.style.display='';}
  else if(mode==='team'){renderPilotTeamList();resEl.style.display='';listEl.style.display='none';renderPilotSearchResults();} // 14/11: niente risultati vecchi della ricerca per nome
  else if(mode==='cat'){buildCatGrid('p-cat-grid','selectPilotCat',pilotSearchCat);resEl.style.display='';listEl.style.display='none';renderPilotSearchResults();}
}
window.setPilotSearchMode=setPilotSearchMode;

function renderPilotTeamList(){
  const q=(document.getElementById('p-team-input')?document.getElementById('p-team-input').value.toUpperCase():'');
  const teams=getMyTeams().filter(([t])=>t.toUpperCase().includes(q));
  const el=document.getElementById('p-team-list');if(!el)return;
  // 18/11/2026 (Andrea): cercando un team che non e' tra quelli dei miei piloti (es. "akm") compaiono i team della gara con "SEGUI TEAM"
  const mineT=new Set(teams.map(([t])=>teamNorm(t)));
  const others=q.length>=2?getTeamsFromEntryList().filter(([t])=>t.toUpperCase().includes(q)&&!mineT.has(teamNorm(t))):[];
  const esc=t=>t.replace(/'/g,"\\'");
  const followed=t=>teams_isFollowed(t);
  let html=teams.map(([t,cnt])=>'<div class="scuderia-item'+(pilotSearchTeam===t?' selected':'')+'" onclick="selectPilotTeam(\''+esc(t)+'\')">'
    +'<span style="flex:1">'+t+'</span><span style="font-size:10px;color:var(--text4);font-weight:700;margin-left:8px">'+cnt+'</span></div>').join('');
  if(others.length)html+='<div style="padding:10px 4px 4px;font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--text4)">TEAM IN GARA</div>'
    +others.map(([t,cnt])=>'<div class="scuderia-item" style="cursor:default"><span style="flex:1">'+t+'</span><span style="font-size:10px;color:var(--text4);font-weight:700;margin:0 8px">'+cnt+' piloti</span>'
      +(followed(t)?'<button class="btn-add-team done" style="min-height:36px;width:auto;margin:0;padding:0 12px" onclick="setPilotsView(\'team\')">SEGUITO</button>'
        :'<button class="btn-add-team" style="min-height:36px;width:auto;margin:0;padding:0 12px" onclick="followTeamFromSearch(\''+esc(t)+'\')">+ SEGUI TEAM</button>')+'</div>').join('');
  el.innerHTML=html||'<div style="padding:14px;font-size:12px;color:var(--text4);text-align:center">Nessun team'+(q.length<2?'':' con questo nome nella gara')+'</div>';
}
function teams_isFollowed(name){try{const k=teamKey(name);return teams.some(t=>t.key===k||sameTeam(name,teamOfKey(t)));}catch(e){return false;}}
function followTeamFromSearch(name){addTeam(name);setPilotsView('team');}
window.followTeamFromSearch=followTeamFromSearch;
window.renderPilotTeamList=renderPilotTeamList;

function selectPilotTeam(team){
  pilotSearchTeam=team;
  renderPilotTeamList();
  renderPilotSearchResults();
}
window.selectPilotTeam=selectPilotTeam;

function selectPilotCat(cat){
  pilotSearchCat=pilotSearchCat===cat?'':cat;
  buildCatGrid('p-cat-grid','selectPilotCat',pilotSearchCat);
  renderPilotSearchResults();
}
window.selectPilotCat=selectPilotCat;

function renderPilotSearchResults(){
  const resEl=document.getElementById('pilots-search-results');if(!resEl)return;
  const listEl=document.getElementById('pilots-list');
  let matches=[];
  if(pilotSearchMode==='team'&&pilotSearchTeam){
    Object.entries(currentEntryList).forEach(([num,e])=>{
      if(sameTeam(e.team||'',pilotSearchTeam))
        matches.push({num,name:(e.lastName||'')+' '+(e.firstName||''),team:e.team||'',cat:e.cat||'',isMyPilot:!!pilots.find(p=>p.num===num)});
    });
  } else if(pilotSearchMode==='cat'&&pilotSearchCat){
    Object.entries(currentEntryList).forEach(([num,e])=>{
      if(e.cat===pilotSearchCat)
        matches.push({num,name:(e.lastName||'')+' '+(e.firstName||''),team:e.team||'',cat:e.cat||'',isMyPilot:!!pilots.find(p=>p.num===num)});
    });
  } else {
    resEl.innerHTML='<div style="font-size:11px;color:var(--text4);padding:10px 0">'+(pilotSearchMode==='team'?'Seleziona un team dalla lista':'Seleziona una categoria')+'</div>';
    listEl.style.display='none';resEl.style.display='';return;
  }
  matches.sort((a,b)=>{if(a.isMyPilot&&!b.isMyPilot)return-1;if(!a.isMyPilot&&b.isMyPilot)return 1;return parseInt(a.num)-parseInt(b.num);});
  // Scheda Piloti: solo i MIEI piloti (gli altri si cercano in Entry list)
  const myP=matches.filter(m=>m.isMyPilot).sort((a,b)=>parseInt(a.num)-parseInt(b.num));
  const others=[];matches=myP;
  let html='<div style="font-size:12px;color:var(--text4);font-weight:700;letter-spacing:1px;margin-bottom:8px">'+myP.length+' TUOI PILOTI</div>';
  if(pilotSearchMode==='team'&&pilotSearchTeam){
    const has=teams_isFollowed(pilotSearchTeam);
    html=(has?'<button class="btn-add-team done" onclick="setPilotsView(\'team\')"><i class="ic ic-star"></i> TEAM GIÀ SEGUITO — APRI TEAM</button>'
      :'<button class="btn-add-team" onclick="addTeam(\''+pilotSearchTeam.replace(/'/g,"\\'")+'\')"><i class="ic ic-plus"></i> AGGIUNGI TEAM</button>')+html;
  }
  if(myP.length){html+='<div class="search-group-label" style="color:#22c55e"><i class="ic ic-star"></i> I MIEI PILOTI ('+myP.length+')</div>';myP.forEach(m=>{html+=searchResultItem(m);});}
  if(others.length){html+='<div class="search-group-label">TUTTI GLI ALTRI ('+others.length+')</div>';others.forEach(m=>{html+=searchResultItem(m);});}
  if(!matches.length)html='<div class="empty-state"><p>Nessuno dei tuoi piloti</p></div>';
  resEl.style.display='';listEl.style.display='none';
  resEl.innerHTML=html;
}

// ── ADVANCED SEARCH: PROGRAMMA tab ──
let progSearchMode='text';
let progSearchTeam='';
let progSearchCat='';

function setProgSearchMode(mode){
  progSearchMode=mode;
  progSearchTeam='';progSearchCat='';
  ['text','team','cat'].forEach(m=>{
    const btn=document.getElementById('prog-mode-'+m);if(btn)btn.classList.toggle('active',m===mode);
    const wrap=document.getElementById('prog-search-'+m+'-wrap');if(wrap)wrap.style.display=m===mode?'':'none';
  });
  const resEl=document.getElementById('prog-search-results');
  if(mode==='text'){resEl.style.display='none';try{renderSchedule();}catch(e){}}
  else if(mode==='team'){renderProgTeamList();resEl.style.display='';resEl.innerHTML='';}
  else if(mode==='cat'){buildCatGrid('prog-cat-grid','selectProgCat',progSearchCat);resEl.style.display='';resEl.innerHTML='';}
}
window.setProgSearchMode=setProgSearchMode;

function renderProgTeamList(){
  const q=(document.getElementById('prog-team-input')?document.getElementById('prog-team-input').value.toUpperCase():'');
  const teams=getMyTeams().filter(([t])=>t.toUpperCase().includes(q));
  const el=document.getElementById('prog-team-list');if(!el)return;
  if(!teams.length){el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--text4);text-align:center">Nessun team</div>';return;}
  el.innerHTML=teams.map(([t,cnt])=>'<div class="scuderia-item'+(progSearchTeam===t?' selected':'')+'" onclick="selectProgTeam(\''+t.replace(/'/g,"\\'")+'\')">'
    +'<span style="flex:1">'+t+'</span><span style="font-size:10px;color:var(--text4);font-weight:700;margin-left:8px">'+cnt+'</span></div>').join('');
}
window.renderProgTeamList=renderProgTeamList;

function selectProgTeam(team){
  progSearchTeam=team;
  renderProgTeamList();
  renderProgSearchResults();
}
window.selectProgTeam=selectProgTeam;

function selectProgCat(cat){
  progSearchCat=progSearchCat===cat?'':cat;
  buildCatGrid('prog-cat-grid','selectProgCat',progSearchCat);
  renderProgSearchResults();
}
window.selectProgCat=selectProgCat;

function progFilterOn(){return(progSearchMode==='team'&&!!progSearchTeam)||(progSearchMode==='cat'&&!!progSearchCat);}
function renderProgSearchResults(){
  const resEl=document.getElementById('prog-search-results');if(!resEl)return;
  // Il filtro team/categoria agisce sul programma stesso, mostrando solo i MIEI piloti distribuiti negli orari
  if(progSearchMode==='team'||progSearchMode==='cat'){
    const n=pilots.filter(p=>!p.eliminated&&myPilotMatches(p,progSearchMode,progSearchTeam,progSearchCat)).length;
    resEl.innerHTML=progFilterOn()?'<div class="prog-filter-chip"><span>'+(progSearchMode==='team'?progSearchTeam:progSearchCat)+' · '+n+' tuoi piloti</span><button onclick="setProgSearchMode(\'text\');renderSchedule()">Togli filtro</button></div>':'';
    renderSchedule();return;
  }
  let targets=[];
  if(progSearchMode==='team'&&progSearchTeam){
    Object.entries(currentEntryList).forEach(([num,e])=>{if((e.team||'')===progSearchTeam)targets.push(num);});
  } else if(progSearchMode==='cat'&&progSearchCat){
    Object.entries(currentEntryList).forEach(([num,e])=>{if(e.cat===progSearchCat)targets.push(num);});
  } else {resEl.innerHTML='<div style="font-size:11px;color:var(--text4);padding:10px 0">Seleziona un team o categoria</div>';return;}
  if(!targets.length){resEl.innerHTML='<div class="empty-state"><p>Nessun risultato</p></div>';return;}
  // Build virtual pilot list from entry list for schedule search
  const fakePilots=targets.map(num=>{
    const e=currentEntryList[num]||{};
    return{num,name:(e.lastName||'')+' '+(e.firstName||''),team:e.team||'',cat:e.cat||'',parity:e.parity||autoParity(num),group:e.group||'',serie:e.serie||'',prefinal:e.prefinal||'',eliminated:false};
  });
  resEl.innerHTML=buildProgResultsHtml(fakePilots);
}

function buildProgResultsHtml(fakePilots){
  const slots=currentSchedule[activeDay]||[];
  let html='';
  slots.forEach(slot=>{
    const ps=fakePilots.filter(p=>{
      if(canonCat(p.cat)!==canonCat(slot.cat))return false;
      if(slot.type==='all')return true;
      if(slot.type==='parity')return p.parity===slot.filter;
      if(slot.type==='serie'){if(!pSerie(p))return false;return pSerie(p)===String(slot.filter).trim();}
      if(slot.type==='group')return pilotInGroup(p,slot.filter);
      if(slot.type==='prefinal'){if(!p.prefinal)return false;return String(p.prefinal).trim().toUpperCase()===String(slot.filter).trim().toUpperCase();}
      if(slot.type==='list'){if(!Array.isArray(slot.filter))return false;return slot.filter.map(String).includes(String(p.num));}
      return false;
    });
    if(!ps.length)return;
    html+='<div class="card" style="margin-bottom:8px"><div class="slot-header">'
      +'<span class="slot-time">'+slot.time+'</span>'
      +'<span class="slot-label '+catClass(slot.cat)+'">'+slot.label+'</span>'
      +'<span class="slot-type">'+slotFilterLabel(slot)+'</span></div><div style="margin-top:8px">';
    ps.forEach(p=>{
      const isMine=!!pilots.find(x=>x.num===p.num);
      html+='<div class="card-inner" style="'+(isMine?'border-color:#22c55e':'')+'"><div style="display:flex;align-items:center;gap:6px">'
        +'<span class="inner-num" style="'+(isMine?'color:#22c55e':'')+'">#'+p.num+'</span>'
        +'<span class="inner-name">'+p.name+(isMine?' <span style="font-size:9px;color:#22c55e;font-weight:800"><i class="ic ic-star"></i></span>':'')+'</span>'
        +'<span class="inner-team-big">'+p.team+'</span></div>'+noteLine(p.num)+'</div>';
    });
    html+='</div></div>';
  });
  if(!html)return'<div class="empty-state"><p>Nessuno in programma per oggi</p></div>';
  return'<div style="font-size:10px;color:var(--text4);font-weight:700;letter-spacing:1px;margin-bottom:8px">'+fakePilots.length+' PILOTI NEL PROGRAMMA DI '+activeDay+'</div>'+html;
}

// ── ADVANCED SEARCH: ENTRY LIST tab ──
let elSearchMode='text';
let elSearchTeam='';
let elSearchCat='';

function setElSearchMode(mode){
  elSearchMode=mode;
  elSearchTeam='';elSearchCat='';
  ['text','team','cat'].forEach(m=>{
    const btn=document.getElementById('el-mode-'+m);if(btn)btn.classList.toggle('active',m===mode);
    const wrap=document.getElementById('el-search-'+m+'-wrap');if(wrap)wrap.style.display=m===mode?'':'none';
  });
  if(mode==='team')renderElTeamList();
  else if(mode==='cat'){buildCatGrid('el-cat-grid','selectElCat',elSearchCat);}
  renderEntryList();
}
window.setElSearchMode=setElSearchMode;

function renderElTeamList(){
  const q=(document.getElementById('el-team-input')?document.getElementById('el-team-input').value.toUpperCase():'');
  const teams=getTeamsFromEntryList().filter(([t])=>t.toUpperCase().includes(q));
  const el=document.getElementById('el-team-list');if(!el)return;
  if(!teams.length){el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--text4);text-align:center">Nessun team</div>';return;}
  el.innerHTML=teams.map(([t,cnt])=>'<div class="scuderia-item'+(elSearchTeam===t?' selected':'')+'" onclick="selectElTeam(\''+t.replace(/'/g,"\\'")+'\')">'
    +'<span style="flex:1">'+t+'</span><span style="font-size:10px;color:var(--text4);font-weight:700;margin-left:8px">'+cnt+'</span></div>').join('');
}
window.renderElTeamList=renderElTeamList;

function selectElTeam(team){
  elSearchTeam=elSearchTeam===team?'':team;
  renderElTeamList();
  renderEntryList();
}
window.selectElTeam=selectElTeam;

function selectElCat(cat){
  elSearchCat=elSearchCat===cat?'':cat;
  buildCatGrid('el-cat-grid','selectElCat',elSearchCat);
  renderEntryList();
}
window.selectElCat=selectElCat;

function clearElSearch(){
  const inp=document.getElementById('el-search-input');if(inp)inp.value='';
  const clr=document.getElementById('el-search-clear');if(clr)clr.style.display='none';
  renderEntryList();
}
window.clearElSearch=clearElSearch;

// ══════════════════════════════════════
// RENDER ENTRY LIST
// ══════════════════════════════════════
function renderEntryList(){
  if(!initialized)return;
  const el=document.getElementById('entry-list-content');if(!el)return;
  const totalBadge=document.getElementById('entry-total-badge');

  const entries=Object.entries(currentEntryList);
  if(!entries.length){
    if(totalBadge)totalBadge.textContent='0 PILOTI';
    el.innerHTML='<div class="empty-state"><p>Nessuna entry list caricata.</p><p style="margin-top:8px;font-size:11px">Vai in GARE → Impostazioni per caricare la entry list.</p></div>';
    return;
  }

  // Filter
  let filtered=entries;
  if(elSearchMode==='text'){
    const q=(document.getElementById('el-search-input')?document.getElementById('el-search-input').value.trim().toUpperCase():'');
    const clr=document.getElementById('el-search-clear');
    if(clr)clr.style.display=q?'block':'none';
    if(q){filtered=filtered.filter(([num,e])=>{
      const nameStr=((e.lastName||'')+' '+(e.firstName||'')).toUpperCase();
      return num.startsWith(q)||nameStr.includes(q)||(e.team||'').toUpperCase().includes(q);
    });}
  } else if(elSearchMode==='team'){
    if(elSearchTeam)filtered=filtered.filter(([,e])=>sameTeam(e.team,elSearchTeam));
    else {
      el.innerHTML='<div style="font-size:11px;color:var(--text4);padding:10px 0;text-align:center">Seleziona un team dalla lista</div>';
      return;
    }
  } else if(elSearchMode==='cat'){
    if(elSearchCat)filtered=filtered.filter(([,e])=>e.cat===elSearchCat);
  }

  // Sort: by cat order then by number
  const catOrder={'KZ2':0,'OK':1,'OKJ':2,'MINI GR3':3,'MINI U10':4,'OK-NJ':5};
  filtered.sort((a,b)=>{
    const ca=catOrder[a[1].cat]??9;const cb=catOrder[b[1].cat]??9;
    if(ca!==cb)return ca-cb;
    return parseInt(a[0])-parseInt(b[0]);
  });

  if(totalBadge)totalBadge.textContent=filtered.length+' PILOTI'+(filtered.length<entries.length?' / '+entries.length+' TOT':'');

  // Group by cat for display
  const groups={};
  filtered.forEach(([num,e])=>{
    const cat=e.cat||'?';
    if(!groups[cat])groups[cat]=[];
    groups[cat].push({num,...e});
  });

  let html='';
  Object.entries(groups).forEach(([cat,members])=>{
    const catCls=catClass(cat);
    html+='<div style="font-size:14px;font-weight:900;letter-spacing:2px;padding:14px 0 6px;border-top:1px solid var(--border);margin-top:6px">'
      +'<span class="'+catCls+'">'+cat+'</span>'
      +' <span style="font-size:11px;font-weight:600;color:var(--text4)">'+members.length+'</span></div>';
    members.forEach(p=>{
      const isMine=!!pilots.find(x=>x.num===p.num);
      html+='<div class="entry-item'+(isMine?' is-mine':'')+'" onclick="openPilotDetail(\''+p.num+'\')">'
        +'<span class="entry-num" style="'+(isMine?'color:#22c55e':'')+'">#'+p.num+'</span>'
        +'<div style="flex:1;min-width:0">'
        +'<div class="entry-name">'+(p.lastName||'')+' '+(p.firstName||'')+(isMine?' <span style="font-size:9px;color:#22c55e;font-weight:800"><i class="ic ic-star"></i> TUO</span>':'')+mediaChip({num:p.num})+'</div>'
        +'<div class="entry-team">'+( p.team||'')+(p.source==='ocr'?' <span title="Letto dal PDF scansionato: verra\' sostituito dai dati ufficiali" style="font-size:9px;font-weight:800;color:#facc15;border:1px dashed #facc15;border-radius:4px;padding:0 5px">DA CONFERMARE</span>':'')+'</div>'+noteLine(p.num)+'</div>'
        +'<div class="entry-badges">'
        +'<span style="font-size:9px;font-weight:700;color:var(--text4);padding:2px 6px;border:1px solid var(--border);border-radius:4px">'+( p.parity||autoParity(p.num))+'</span>'
        +(p.group?'<span style="font-size:9px;font-weight:900;color:#60a5fa;padding:2px 6px;border:1px solid #60a5fa;border-radius:4px">GRP '+p.group+'</span>':'')
        +'</div></div>';
    });
  });

  if(!html)html='<div class="empty-state"><p>Nessun risultato</p></div>';
  el.innerHTML=html;
}
window.renderEntryList=renderEntryList;

// ══════════════════════════════════════
// RENDER PILOTS
// ══════════════════════════════════════
function renderPilots(){
  if(!initialized)return;
  ['piloti','team'].forEach(v=>{const b=document.getElementById('pv-'+v);if(b)b.classList.toggle('active',pilotsView===v);});
  if(pilotsView==='team'&&activeRaceId){renderTeams();return;}
  if(!activeRaceId){document.getElementById('pilots-list').innerHTML='<div class="empty-state"><p>Seleziona una gara dalla tab GARE</p></div>';return;}
  const el=document.getElementById('pilots-list');
  if(!pilots.length){el.innerHTML='<p class="no-pilots">Nessun pilota. Aggiungine uno!</p>';return;}
  const filtered=pilots.filter(p=>pilotMatchesFilter(p));
  const total=pilots.length;
  const showing=filtered.length;
  const counter='<div style="font-size:11px;font-weight:700;color:var(--text4);margin-bottom:14px;letter-spacing:1px;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;">'
    +(filtersActive()?'FILTRO':'TOTALE PILOTI')
    +' <span style="color:var(--text);font-size:18px;font-weight:900;margin-left:8px;">'+showing+(filtersActive()?'/'+total:'')+'</span></div>';
  el.innerHTML=counter+filtered.map((p,i)=>{
    const isElim=p.eliminated;
    const hl=p.highlight||[];
    const hlLabels={foto:'<i class="ic ic-hl-foto"></i> FOTO',video:'<i class="ic ic-hl-video"></i> VIDEO',priority:'<i class="ic ic-hl-prio"></i> PRIORITÀ'};
    const hlCls=hlClassOf(hl);
    return'<div class="card '+hlCls+'">'
    +'<div class="pilot-header">'
    +'<div style="display:flex;align-items:flex-start;gap:10px;">'
    +'<span class="pilot-index">'+(i+1)+'.</span><div>'
    +'<div class="pilot-cat '+catClass(p.cat)+'">'+p.cat+(isElim?' <span style="color:#ef4444;font-size:9px">ELIMINATO</span>':'')+'</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-top:3px">'
    +'<span class="pilot-num">#'+p.num+'</span>'+riskTri(p.num)
    +'<span class="pilot-name">'+p.name+'</span>'+reelChip(p)+fotoChips(p)+persChip(p)+'</div>'
    +'<div class="pilot-team">'+p.team+'</div></div></div>'
    +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px">'
    +(hl.length?'<div class="hl-badges">'+hl.map(function(h){return'<span class="hl-badge hl-'+h+'">'+(hlLabels[h]||h)+'</span>';}).join('')+'</div>':'')
    +'<span class="parity-badge">'+p.parity+'</span>'
    +'<span class="group-badge '+(pilotHasGroupData(p)?'set':'')+'">'
    +(p.heats&&p.heats.length?heatsLabel(p.heats):(p.group?'GRP '+p.group:'GRP ?'))
    +'</span>'
    +'<button class="pilot-edit-btn" onclick="openEditPilot(\''+p.num+'\')"><i class="ic ic-note"></i> modifica</button>'
    +'<button class="pilot-edit-btn" style="color:#ef4444;border-color:#ef4444" onclick="deletePilot(\''+p.num+'\')"><i class="ic ic-close"></i> rimuovi</button>'
    +'</div></div>'
    +'<div class="tasks">'+TASKS.map(t=>taskBtn(p.num,t,false,isElim)).join('')+spotPill(p.num)+'</div>'
    +reelRowHtml(p)+fotoRowHtml(p,true)
    +'<div class="note-wrap"><span class="note-label">Note</span>'
    +'<textarea class="note-area" id="note-'+p.num+'" placeholder="Aggiungi una nota..." onblur="saveNote(\''+p.num+'\')">'+(notes[p.num]||'')+'</textarea></div></div>';
  }).join('')+missingDashHtml();
}

// ══════════════════════════════════════
// RENDER SCHEDULE with auto-scroll
// ══════════════════════════════════════
let scheduleDelay=parseInt(localStorage.getItem('rt_delay')||'0');

// Ritardo condiviso: lo cambia solo l'admin (o l'AUTO da Apex); tutti lo ricevono da Firebase
const DELAY_ADMIN='andrea';
function isDelayAdmin(){return String(currentUserId||'').toLowerCase()===DELAY_ADMIN;}
function applySharedDelay(d,auto){
  const nd=parseInt(d)||0;
  const changed=nd!==scheduleDelay||auto!==apexAuto;
  apexAuto=auto;
  if(nd!==scheduleDelay){setDelayLocal(nd);}
  else if(changed&&typeof renderApexDelay==='function')renderApexDelay();
  applyDelayPerms();
}
/* 15/11/2026 (Andrea): con il live timing collegato il ritardo e' automatico: niente comandi manuali.
   I comandi (-5, +5, 0, modifica) compaiono solo se il live non e' disponibile. */
/* 19/11/2026 (Andrea): gli automatismi contano solo se il live MANDA dati (prima bastava il collegamento aperto:
   con il live muto alla fonte i comandi manuali sparivano lo stesso). Live vivo = un messaggio negli ultimi 10 minuti. */
let apexLastMsgAt=0;
function liveAlive(){return !!apexWsKey&&apexLastMsgAt>0&&Date.now()-apexLastMsgAt<600000;}
function delayManualOn(){return isDelayAdmin()&&!liveAlive();}
setInterval(()=>{try{const was=window._rtManPrev;const now=delayManualOn();if(was!==now){window._rtManPrev=now;applyDelayPerms();if(activeTab==='programma')renderSchedule();}}catch(e){}},60000);
/* 19/11/2026 (Andrea): tasto PARTITO ADESSO, solo quando gli automatismi sono saltati (live muto), per tutti gli account.
   Su 5 turni attorno a quello in corso (2 prima, ORA, 2 dopo), senza conferma (fa perdere tempo). Dopo il tocco il turno mostra in verde
   "PARTITO 11.59 · +23 min" (si capisce che ha preso il comando); toccandolo di nuovo si annulla (torna il ritardo di prima). */
let _partito=null;   // {time, prev, v, at, lab} dell'ultimo tocco su questo telefono
/* 19/11/2026 (Andrea): "con tutti sti tasti la rendiamo incasinata" + "devo sapere l'orario in cui dovevano partire".
   Una sola barra compatta in cima al Programma, solo con il live muto: i turni attorno a ORA indicati come si vedono in pista
   (categoria + dispari/pari, fascia di numeri o gruppo + i miei piloti in quel turno). Un tocco = partito adesso. */
function partitoLabel(sl){
  const f=slotFilterLabel(sl);
  const x=f==='ODD'?'dispari':f==='EVEN'?'pari':f==='ALL'?'tutti':f.replace(/^GRP /,'').replace(/\+/g,'–').replace(/^PREF /,'pref. ').replace(/^SERIE /,'serie ');
  let mine=[];try{mine=pilotsForSlot(sl).map(p=>'#'+p.num);}catch(e){}
  return {cat:String(sl.label||sl.cat||''),sub:x,mine:mine.slice(0,3).join(' ')+(mine.length>3?' +'+(mine.length-3):'')};
}
function partitoBar(slotsArr,curIdx,ds){
  if(ds!=='today'||liveAlive())return'';
  const nowM=new Date().getHours()*60+new Date().getMinutes();
  const ids=new Set();
  if(curIdx>=0)for(let i=Math.max(0,curIdx-2);i<=Math.min(slotsArr.length-1,curIdx+2);i++)ids.add(i);
  try{const lu=lunchOf(slotsArr);const pc=currentPartito;
    [0,lu?lu.idx:-1].forEach(i=>{if(i<0||!slotsArr[i])return;const tm=slotMins(slotsArr[i].time);
      const done=pc&&pc.day===activeDay&&slotMins(pc.time)>=tm;if(!done&&nowM>=tm-15&&nowM<=tm+120)ids.add(i);});}catch(e){}
  if(!ids.size)return'';
  const h=['<div class="partito-bar"><div class="pb-head">LIVE ASSENTE · <b>chi parte adesso?</b></div>'];
  if(_partito&&Date.now()-_partito.at<30*60000){
    const hm=new Date(_partito.at).toTimeString().slice(0,5).replace(':','.');
    const d=_partito.v===0?'in orario':(_partito.v>0?'+':'')+_partito.v+' min';
    h.push('<button class="pb-ok" onclick="partitoAnnulla()"><i class="ic ic-flag"></i> PARTITO ',hm,' · ',_partito.lab||'',' · ',d,' <span>tocca per annullare</span></button>');
  }
  h.push('<div class="pb-chips">');
  [...ids].sort((x,y)=>x-y).forEach(i=>{const sl=slotsArr[i];const l=partitoLabel(sl);
    h.push('<button class="pb-chip',(i===curIdx?' now':''),'" onclick="partitoAdesso(\'',String(sl.time),'\')"><span class="pb-cat ',catClass(sl.cat),'">',l.cat,'</span><span class="pb-sub">',l.sub,'</span>',(l.mine?'<span class="pb-mine">'+l.mine+'</span>':''),'</button>');});
  h.push('</div></div>');
  return h.join('');
}
function partitoAdesso(t){
  if(liveAlive())return;
  const d=new Date();const v=d.getHours()*60+d.getMinutes()-slotMins(t);
  let lab='';try{const arr=currentSchedule[activeDay];const sl=(Array.isArray(arr)?arr:Object.values(arr||{})).find(x=>String(x.time)===String(t));if(sl){const l=partitoLabel(sl);lab=l.cat+' '+l.sub;}}catch(e){}
  _partito={time:String(t),prev:scheduleDelay||0,v,at:Date.now(),lab};
  try{if(navigator.vibrate)navigator.vibrate(25);}catch(e){}
  currentPartito={day:activeDay,time:String(t),at:Date.now(),by:currentUserId||''};
  try{if(activeRaceId)saveSharedField('partito',currentPartito);}catch(e){}
  setDelay(v,true);
}
function partitoAnnulla(){
  if(!_partito)return;const prev=_partito.prev;_partito=null;
  try{if(navigator.vibrate)navigator.vibrate([15,40,15]);}catch(e){}
  setDelay(prev,true);
}
window.partitoAdesso=partitoAdesso;window.partitoAnnulla=partitoAnnulla;
function applyDelayPerms(){
  const man=delayManualOn();
  document.querySelectorAll('[onclick^="setDelay("]').forEach(b=>{if(!b.closest('#apex-delay-box'))b.style.display=man?'':'none';});
  const dd=document.getElementById('delay-display');
  if(dd){dd.style.pointerEvents=man?'':'none';dd.style.borderColor=man?'':'transparent';}
}
window.applyDelayPerms=applyDelayPerms;
function setDelay(d,fromAuto){
  if(!fromAuto&&!isDelayAdmin())return;
  const v=parseInt(d)||0;
  if(activeRaceId)saveSharedField('schedDelay',v);
  setDelayLocal(v);
}
function setDelayLocal(d){
  scheduleDelay=parseInt(d)||0;
  localStorage.setItem('rt_delay',scheduleDelay);
  const el=document.getElementById('delay-display');
  if(el)el.textContent=(scheduleDelay>0?'+':'')+scheduleDelay+' min';
  scheduleNeedsScroll=true;
  renderSchedule();
  if(typeof renderApexDelay==='function')renderApexDelay();
}
window.setDelay=setDelay;

function editDelayManual(){
  if(!isDelayAdmin())return;
  const val=prompt('Inserisci ritardo in minuti (negativo se in anticipo):', scheduleDelay);
  if(val===null)return;
  const n=parseInt(val);
  if(!isNaN(n))setDelay(n);
}
window.editDelayManual=editDelayManual;

let showEliminati=false;
function toggleEliminati(){showEliminati=!showEliminati;scheduleNeedsScroll=false;renderSchedule();}
window.toggleEliminati=toggleEliminati;

function getCurrentSlotIndex(slots){
  const now=new Date();
  const nowMins=now.getHours()*60+now.getMinutes()-scheduleDelay;
  let closest=-1;let closestDiff=Infinity;
  for(let i=0;i<slots.length;i++){
    const parts=slots[i].time.split('.');
    const slotMins=parseInt(parts[0])*60+parseInt(parts[1]);
    const diff=nowMins-slotMins;
    if(diff>=0&&diff<closestDiff){closestDiff=diff;closest=i;}
  }
  const clockIdx=closest===-1?0:closest;
  /* 14/11/2026: la sessione caricata nel live (escono dalla pregriglia, giri di riscaldamento) e' ORA anche prima del verde.
     Solo per oggi; finita la sessione nel live, non si torna indietro rispetto all'orologio. Il ritardo resta calcolato al verde. */
  try{
    /* FIX 14/11 15:20 (Andrea: ORA scattata ben prima dell'uscita dalla pregriglia): il cronometrista carica la sessione
       nel live molto prima. Ora il live vale solo se la sessione e' partita (verde) o se la maggior parte dei kart
       di QUESTA sessione e' in pista (uscita pregriglia/giri di riscaldamento). Altrimenti orologio + ritardo. */
    const _S=(apexGridSess===apexState.cat+'|'+apexState.sess&&typeof ltStaCounts==='function')?ltStaCounts():null;
    const _moving=!!apexState.start||!!(_S&&_S.run>0&&_S.run>=_S.inn);
    if(_moving&&apexWsKey&&apexState.sess&&typeof autoDayName==='function'&&activeDay===autoDayName()){
      const m=apexMatchSlot();
      if(m&&m.slot){const li=slots.findIndex(x=>x&&x.time===m.slot.time&&canonCat(x.cat)===canonCat(m.slot.cat)&&x.type===m.slot.type);
        if(li>=0)return apexFinished?Math.max(li,clockIdx):li;}
    }
  }catch(e){}
  return clockIdx;
}

/* 14/11/2026: riga premiazioni nel Programma (orari da Impostazioni gara → races_index/<gara>/awards) */
function awardsStrip(day){
  try{
    const a=((races[activeRaceId]||{}).awards)||{};const out=[];
    const DN=['DOMENICA','LUNEDI','MARTEDI','MERCOLEDI','GIOVEDI','VENERDI','SABATO'];
    const norm=x=>String(x||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    const onDay=v=>{const d=new Date(v);return!isNaN(d)&&DN[d.getDay()]===norm(day);};
    const hm=v=>{const d=new Date(v);return d.getHours()+'.'+String(d.getMinutes()).padStart(2,'0');};
    if(a.pole&&onDay(a.pole))out.push('Premiazione poleman <b>'+hm(a.pole)+'</b>');
    if(a.final==='dopo'){if(day===currentDays[currentDays.length-1])out.push('Premiazione finali <b>subito dopo ogni finale</b>');}
    else if(a.final&&onDay(a.final))out.push('Premiazione finali <b>'+hm(a.final)+'</b>');
    if(!out.length)return'';
    return'<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);background:var(--bg3);border-left:3px solid #facc15;border-radius:10px;padding:9px 12px;margin-bottom:10px"><i class="ic ic-trophy"></i><span>'+out.join(' · ')+'</span></div>';
  }catch(e){return'';}
}
/* 15/11/2026 (Andrea): il riquadro ORA esiste solo nella giornata di oggi e solo finche' la giornata e' in corso.
   Giornata futura: niente ORA, nessun turno "fatto", il tasto porta in cima. Giornata passata o finita: niente ORA.
   Ricompare la mattina dopo, nella giornata nuova. Fine giornata = ultimo turno (o ultima finale) + 30 min + ritardo. */
/* 15/11/2026 (Andrea): triangolo di rischio finale ovunque compaia un mio pilota (Programma, Live, Piloti, Pista).
   Colori come l'anello della scheda FINALE: verde <25%, giallo 25-49, arancione 50-74, rosso 75+.
   Solo finche' la lista ufficiale della Finale della categoria non e' uscita; mai per eliminati o gia' in finale.
   Stima (riskPct), calcolata al massimo ogni 30 s. */
let _rmCache={at:0,map:null};
function riskMarkMap(){
  if(_rmCache.map&&Date.now()-_rmCache.at<30000)return _rmCache.map;
  const m={};
  try{
    const decided=new Set(pilots.filter(p=>p.inFinal).map(p=>canonCat(p.cat)));
    riskData().forEach(x=>{if(x.none||!x.cut||decided.has(canonCat(x.cat)))return;m[String(x.num)]=riskPct(x);});
  }catch(e){}
  _rmCache={at:Date.now(),map:m};return m;
}
function riskTri(num){
  const n=String(num),p=pilots.find(q=>String(q.num)===n);if(!p||p.eliminated||p.inFinal)return'';
  const v=riskMarkMap()[n];if(v===undefined)return'';
  return'<span class="risk-tri" style="color:'+riskColor(v)+';font-size:11px;line-height:1;flex-shrink:0;display:inline-block">\u25B2</span>';
}
function progDayState(day,slotsArr){
  const plain=s=>String(s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const N=['DOMENICA','LUNEDI','MARTEDI','MERCOLEDI','GIOVEDI','VENERDI','SABATO'];
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const now=new Date(),t=iso(now),r=(races&&races[activeRaceId])||{};
  let st='';
  if(r.startDate&&r.endDate&&r.startDate<=r.endDate){
    if(t<r.startDate)st='future';else if(t>r.endDate)st='past';
    else{
      let found='';const d=new Date(r.startDate+'T12:00:00'),e=new Date(r.endDate+'T12:00:00');
      for(let k=0;k<14&&d<=e;k++,d.setDate(d.getDate()+1)){if(plain(day).startsWith(N[d.getDay()])){found=iso(d);break;}}
      if(found)st=found<t?'past':found>t?'future':'today';
    }
  }
  if(!st){
    const td=autoDayName();
    if(!td)st='future';
    else{const a=currentDays.indexOf(day),b=currentDays.indexOf(td);st=a<b?'past':a>b?'future':'today';}
  }
  if(st!=='today')return st;
  const toM=x=>{const m=String(x||'').match(/(\d{1,2})[.:](\d{2})/);return m?(+m[1])*60+(+m[2]):-1;};
  let last=-1;(slotsArr||[]).forEach(sl=>{last=Math.max(last,toM(sl&&sl.time));});
  if(day===currentDays[currentDays.length-1])(currentFinals||[]).forEach(f=>{last=Math.max(last,toM(f&&f.time));});
  const nowM=now.getHours()*60+now.getMinutes()-(typeof scheduleDelay==='number'?scheduleDelay:0);
  return (last>=0&&nowM>last+30)?'ended':'today';
}
/* ══ METEO (19/11/2026, Andrea) — riga indicativa in cima al Programma per il giorno scelto ══
   Fonte gratuita anche per uso commerciale con attribuzione (crediti in Guida). Solo indicazione: temperatura, vento, fasce di pioggia.
   PROVA: la legge il telefono, al massimo una volta l'ora per sede (copia locale). Prima dell'app vera va spostata sul server
   (una lettura l'ora per gara, scritta nella gara) come deciso per tutte le fonti esterne.
   Coordinate: venues/<chiave>/geo se presente, altrimenti la tabella qui sotto (approssimate, bastano per il meteo). */
const WX_GEO={lonato:[45.4329,10.4853],franciacorta:[45.513,9.985],cremona:[45.085,10.305],sarno:[40.817,14.590],viterbo:[42.420,12.060],
  lemans:[47.939,0.218],ala:[45.760,11.000],zuera:[41.870,-0.800],genk:[50.990,5.560],wackersdorf:[49.320,12.190]};
let _wx={key:'',at:0,ts:null,loading:false};
function wxGeo(){let v=null;try{v=raceVenue();}catch(e){}if(!v)return null;const g=v.geo||WX_GEO[v.key];
  return g?{key:v.key,lat:Number(g.lat!=null?g.lat:g[0]),lon:Number(g.lon!=null?g.lon:g[1])}:null;}
function wxDayDate(day){const r=(typeof races!=='undefined'&&races&&races[activeRaceId])||{};if(!r.startDate)return'';
  const N=['DOMENICA','LUNEDÌ','MARTEDÌ','MERCOLEDÌ','GIOVEDÌ','VENERDÌ','SABATO'];const z=n=>String(n).padStart(2,'0');
  const d=new Date(r.startDate+'T12:00:00'),end=new Date((r.endDate||r.startDate)+'T12:00:00');
  for(let i=0;i<10&&d<=end;i++,d.setDate(d.getDate()+1))if(N[d.getDay()]===day)return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());
  return'';}
function wxLoad(){
  const g=wxGeo();if(!g)return;
  if(_wx.key!==g.key){_wx={key:g.key,at:0,ts:null,loading:false};
    try{const c=JSON.parse(localStorage.getItem('rt_wx_'+g.key)||'null');if(c&&c.v===2&&c.ts&&c.ts[0]&&c.ts[0].s!==undefined){_wx.at=c.at;_wx.ts=c.ts;}}catch(e){}}
  if(_wx.loading||Date.now()-_wx.at<3600000)return;
  _wx.loading=true;_wx.at=Date.now();   // anche se fallisce non si riprova prima di un'ora
  fetch('https://api.met.no/weatherapi/locationforecast/2.0/complete?lat='+g.lat.toFixed(4)+'&lon='+g.lon.toFixed(4))
    .then(r=>r.ok?r.json():null).then(j=>{_wx.loading=false;const ts=j&&j.properties&&j.properties.timeseries;if(!ts)return;
      const old=_wx.ts||[];
      _wx.ts=ts.map(x=>{const d=x.data||{},i=(d.instant||{}).details||{},h1=d.next_1_hours,h6=d.next_6_hours;
        // 21/11/2026 (Andrea): piu' dettaglio: raffiche, direzione del vento, probabilita' e massimo di pioggia (endpoint "complete")
        const hd=((h1||h6||{}).details)||{};
        return{t:x.time,T:i.air_temperature,W:i.wind_speed,G:i.wind_speed_of_gust,D:i.wind_from_direction,p:hd.precipitation_amount!=null?hd.precipitation_amount:null,
          px:hd.precipitation_amount_max,P:hd.probability_of_precipitation,PT:hd.probability_of_thunder,n:h1?1:(h6?6:0),s:String(((h1||h6||{}).summary||{}).symbol_code||'')};});
      // 20/11/2026 (Andrea): la previsione parte da "adesso": si tengono le ore gia' passate (ultimi 3 giorni) cosi' il meteo resta
      // accanto a PROVE LIBERE, QUALIFICHE ecc. anche dopo che sono finite
      try{const first=_wx.ts.length?new Date(_wx.ts[0].t).getTime():Infinity,lim=Date.now()-3*864e5;
        const keep=old.filter(x=>{const t=new Date(x.t).getTime();return t<first&&t>lim&&x.n;});if(keep.length)_wx.ts=keep.concat(_wx.ts);}catch(e){}
      try{localStorage.setItem('rt_wx_'+g.key,JSON.stringify({v:2,at:_wx.at,ts:_wx.ts}));}catch(e){}
      wxRender();}).catch(()=>{_wx.loading=false;});
}
function wxSummary(day){
  const date=wxDayDate(day);if(!date||!_wx.ts)return null;const z=n=>String(n).padStart(2,'0');
  const rows=_wx.ts.map(x=>{const d=new Date(x.t);return Object.assign({h:d.getHours(),ds:d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())},x);}).filter(x=>x.ds===date&&x.h+(x.n||1)>7&&x.h<19);
  if(!rows.length)return null;
  const T=rows.map(x=>x.T).filter(v=>v!=null),W=rows.map(x=>x.W).filter(v=>v!=null);
  // ore di pioggia (07-19): almeno 0,2 mm nell'ora; con dati a 6 ore, la fascia intera se >= 1 mm
  const wet=new Set();rows.forEach(x=>{if(x.p==null)return;if(x.n===1&&x.p>=0.2)wet.add(x.h);if(x.n===6&&x.p>=1)for(let k=x.h;k<x.h+6;k++)if(k>=7&&k<19)wet.add(k);});
  // 19/11/2026 (Andrea): mattina (7-13) e pomeriggio (13-19) separati, ognuno con la sua icona, cosi' si capisce a colpo d'occhio
  const half=(a,b)=>{const hs=[...wet].filter(h=>h>=a&&h<b).sort((x,y)=>x-y),bands=[];hs.forEach(h=>{const l=bands[bands.length-1];if(l&&h===l[1])l[1]=h+1;else bands.push([h,h+1]);});
    const rr=rows.filter(x=>x.h<b&&x.h+(x.n||1)>a);if(!rr.length)return null;
    if(bands.length){const wr=rr.filter(x=>x.p!=null&&((x.n===1&&x.p>=0.2)||(x.n===6&&x.p>=1)));
      const k=wxWorst(wr.map(wxClass));
      // 21/11/2026 (Andrea): intensita' (debole/moderata/forte, mm all'ora nel momento peggiore) e probabilita' massima
      const mmh=Math.max.apply(null,wr.map(x=>Math.max(x.p||0,x.px||0)/(x.n||1)));
      const adj=(k==='rain'||k==='showers'||k==='heavy')?wxRainAdj(mmh):'';
      const pr=rr.map(x=>x.P).filter(v=>v!=null);const P=pr.length?Math.round(Math.max.apply(null,pr)):null;
      return{k,wet:true,txt:(k==='heavy'?'pioggia':WX_TXT[k])+(adj?' '+adj:'')+' '+bands.map(v=>v[0]+'–'+v[1]).join(', '),
        det:(mmh>=0.1?(mmh<10?mmh.toFixed(1).replace('.',','):Math.round(mmh))+' mm/h':'')+(P!=null?(mmh>=0.1?' · ':'')+P+'%':'')};}
    // asciutto: nuvolosita' media della fascia (sereno 0 ... coperto 3); nebbia se prevale
    const cl=rr.map(wxClass);if(cl.filter(x=>x==='fog').length*2>cl.length)return{k:'fog',txt:WX_TXT.fog};
    const sc={sun:0,fair:1,part:2,cloud:3};const v=cl.map(x=>sc[x]!=null?sc[x]:3);const m=Math.round(v.reduce((p,q)=>p+q,0)/v.length);
    const k=['sun','fair','part','cloud'][m];return{k,txt:WX_TXT[k]};};
  // 21/11/2026 (Andrea): vento descritto (calmo ... molto forte), da dove soffia nel momento piu' ventoso, raffiche massime
  let wr0=null;rows.forEach(x=>{if(x.W!=null&&(!wr0||x.W>wr0.W))wr0=x;});
  const G=rows.map(x=>x.G).filter(v=>v!=null);
  const wind=wr0?Math.round(wr0.W*3.6):null,gust=G.length?Math.round(Math.max.apply(null,G)*3.6):null;
  return{tmin:Math.round(Math.min.apply(null,T)),tmax:Math.round(Math.max.apply(null,T)),wind,gust:gust!=null&&wind!=null&&gust>=wind+10?gust:null,
    wdir:wr0&&wr0.D!=null?wxDir(wr0.D):'',wtxt:wind!=null?wxWindAdj(wind):'',am:half(7,13),pm:half(13,19),coarse:rows.some(x=>x.n===6)};
}
/* 19/11/2026 (Andrea): set di icone proprie (niente emoji) che segue il tempo previsto ora per ora:
   sereno, quasi sereno, poco nuvoloso, nuvoloso, nebbia, pioviggine, pioggia, pioggia forte, rovesci, temporale, nevischio, neve. */
const WX_TXT={sun:'sereno',fair:'quasi sereno',part:'poco nuvoloso',cloud:'nuvoloso',fog:'nebbia',drizzle:'pioviggine',rain:'pioggia',heavy:'pioggia forte',
  showers:'rovesci',thunder:'temporale',sleet:'nevischio',snow:'neve'};
// 21/11/2026 (Andrea): sfumature. Pioggia per mm/h (debole < 1, moderata < 4, forte >= 4); vento per km/h (scala Beaufort semplificata)
function wxRainAdj(mmh){return mmh>=4?'forte':mmh>=1?'moderata':'debole';}
function wxWindAdj(k){return k<6?'calmo':k<20?'debole':k<30?'moderato':k<40?'teso':k<60?'forte':'molto forte';}
function wxDir(d){return['N','NE','E','SE','S','SO','O','NO'][Math.round(((Number(d)%360)+360)%360/45)%8];}
const WX_RANK=['sun','fair','part','cloud','fog','drizzle','showers','rain','sleet','snow','heavy','thunder'];
function wxWorst(list){let k='cloud',r=-1;list.forEach(x=>{const i=WX_RANK.indexOf(x);if(i>r){r=i;k=x;}});return k;}
function wxClass(x){const y=String((x&&x.s)||'');const p=x&&x.p!=null?x.p/(x.n||1):0;
  if(/thunder/.test(y))return'thunder';if(/snow/.test(y))return'snow';if(/sleet/.test(y))return'sleet';
  if(/heavyrain/.test(y))return'heavy';if(/lightrain/.test(y))return/showers/.test(y)?'showers':'drizzle';
  if(/rainshowers/.test(y))return'showers';if(/rain/.test(y))return'rain';
  if(/^fog/.test(y))return'fog';if(/^clearsky/.test(y))return'sun';if(/^fair/.test(y))return'fair';if(/^partlycloudy/.test(y))return'part';if(/^cloudy/.test(y))return'cloud';
  return p>=2.5?'heavy':p>=0.5?'rain':p>=0.2?'drizzle':'cloud';}   // copia vecchia senza codice: dalla quantita'
function wxIcon(k,size){const z=size||22;
  const cl=(f,dy)=>'<path transform="translate(0,'+(dy||0)+')" d="M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 8.6 4.7 4.7 0 0 0 7 18z" fill="'+f+'"/>';
  const sun=(x,y,r)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#fbbf24"/>';
  const rays='<g stroke="#fbbf24" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g>';
  const drops=(n,w,col)=>'<g stroke="'+(col||'#60a5fa')+'" stroke-width="'+w+'" stroke-linecap="round">'+[[8,17],[12.5,17],[17,17]].slice(n===1?1:0,n===1?2:n===2?2:3).map(q=>'<path d="M'+q[0]+' '+q[1]+'l-1.2 4"/>').join('')+'</g>';
  const B={
    sun:sun(12,12,5)+rays,
    fair:sun(11,10,5)+'<g stroke="#fbbf24" stroke-width="2" stroke-linecap="round"><path d="M11 1.5v2.5M2.5 10h2.5M4.8 3.8l1.8 1.8M17.2 3.8l-1.8 1.8"/></g><path d="M12 20h7a3 3 0 0 0 .4-5.97A4.1 4.1 0 0 0 12.1 13 3.5 3.5 0 0 0 12 20z" fill="#cbd5e1"/>',
    part:sun(8,8,4.5)+cl('#cbd5e1'),
    cloud:cl('#9ca3af'),
    fog:cl('#9ca3af',-5)+'<g stroke="#9ca3af" stroke-width="2" stroke-linecap="round"><path d="M4 17h16M6 21h12"/></g>',
    drizzle:cl('#94a3b8',-4)+drops(1,2),
    rain:cl('#94a3b8',-4)+drops(2,2.2),
    heavy:cl('#64748b',-4)+drops(3,2.6,'#3b82f6'),
    showers:sun(8,6,4)+cl('#cbd5e1',-3)+drops(2,2.2),
    thunder:cl('#64748b',-4)+'<path d="M13 14l-4 5h3l-1.5 4.5L15 18h-3l1-4z" fill="#fbbf24"/>',
    sleet:cl('#94a3b8',-4)+drops(1,2.2)+'<g fill="#e5e7eb"><circle cx="8" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></g>',
    snow:cl('#94a3b8',-4)+'<g fill="#e5e7eb"><circle cx="8" cy="18" r="1.5"/><circle cx="12.5" cy="21" r="1.5"/><circle cx="17" cy="18" r="1.5"/></g>'};
  return'<svg viewBox="0 0 24 24" width="'+z+'" height="'+z+'" style="vertical-align:-'+Math.round(z/4)+'px;margin-right:4px;flex-shrink:0" aria-hidden="true">'+(B[k]||B.cloud)+'</svg>';}
// icona del tempo previsto all'ora di inizio di un blocco del programma (accanto a PROVE LIBERE, MANCHE...)
function wxSlotIcon(day,time){
  try{const date=wxDayDate(day);if(!date||!_wx.ts)return'';const z=n=>String(n).padStart(2,'0');const hh=parseInt(String(time).split('.')[0]);if(isNaN(hh))return'';
    const x=_wx.ts.find(r=>{const d=new Date(r.t);return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())===date&&d.getHours()<=hh&&hh<d.getHours()+(r.n||1);});
    if(!x||!x.n)return'';const k=wxClass(x);
    const mmh=x.p!=null?Math.max(x.p,x.px||0)/(x.n||1):0;
    const tip=[(k==='heavy'?'pioggia':WX_TXT[k])+((k==='rain'||k==='showers'||k==='heavy')&&mmh>0?' '+wxRainAdj(mmh):''),x.P!=null?Math.round(x.P)+'% pioggia':'',
      x.W!=null?'vento '+Math.round(x.W*3.6)+' km/h'+(x.D!=null?' da '+wxDir(x.D):'')+(x.G!=null&&x.G*3.6>=x.W*3.6+10?', raffiche '+Math.round(x.G*3.6):''):''].filter(Boolean).join(' · ');
    return'<span title="'+tip+'" style="order:2;display:inline-flex;align-items:center;font-style:normal;flex-shrink:0">'+wxIcon(k,24).replace('margin-right:4px','margin-right:0')+'</span>';}catch(e){return'';}
}
function wxRender(){
  const el=document.getElementById('wx-bar');if(!el)return;
  const s=wxSummary(activeDay);if(!s||(!s.am&&!s.pm)){el.style.display='none';return;}
  const seg=(lab,h)=>h?'<span style="white-space:nowrap;margin-right:12px">'+wxIcon(h.k)+'<span style="color:var(--text4);font-size:10px;font-weight:800;letter-spacing:.06em;margin-right:4px">'+lab+'</span>'
    +'<span style="font-weight:900;color:'+(h.wet?'#60a5fa':'var(--text)')+'">'+h.txt+'</span>'
    +(h.det?'<span style="color:var(--text3);font-size:11px;margin-left:4px">('+h.det+')</span>':'')+'</span>':'';
  el.innerHTML='<div style="display:flex;flex-wrap:wrap;align-items:center;row-gap:4px">'+seg('MATTINA',s.am)+seg('POMERIGGIO',s.pm)
    +'<span style="white-space:nowrap;color:var(--text3)">'+s.tmin+'–'+s.tmax+'°'+(s.wind!=null?' · vento '+s.wtxt+' '+s.wind+' km/h'+(s.wdir?' da '+s.wdir:'')+(s.gust?', raffiche '+s.gust:''):'')
    +' <span style="color:var(--text4);font-weight:600;font-size:10px">'+(s.coarse?'(a fasce di 6 ore, indicativo)':'(indicativo)')+'</span></span></div>';
  el.style.display='';
}
/* 19/11/2026 (Andrea): blocchi di sessione calcolati in un solo punto, usati dal Programma e dalla Vista generale.
   L'intestazione si ripete ogni volta che ricomincia il giro delle categorie (es. PROVE LIBERE · TURNO 2).
   Il numero del turno viene dal programma ufficiale quando lo scrive, altrimenti dal ripetersi dello stesso turno. */
function progBlocks(slotsArr){
  const blk=[];const cnt={};
  let ses='',n=0,turn='',seen={};
  slotsArr.forEach(sl=>{
    const tm=String(sl.wsk||'').match(/(\d+)\s*°\s*turn/i);
    const k=[canonCat(sl.cat),sl.type,JSON.stringify(sl.filter||'')].join('|');
    let nw=false;
    if(sl.session&&sl.session!==ses){ses=sl.session;n=0;turn='';nw=true;}
    else if(tm?(turn!==''&&tm[1]!==turn):!!seen[k])nw=true;
    if(nw){n++;seen={};cnt[ses]=(cnt[ses]||0)+1;}
    if(tm)turn=tm[1];
    seen[k]=1;
    blk.push({id:[ses,n].join('#'),ses:ses,num:tm?tm[1]:String(n)});
  });
  return {blk,cnt};
}
function blkLabel(b,cnt){return [b.ses,(cnt[b.ses]>1?[' · TURNO ',b.num].join(''):'')].join('');}
/* 19/11/2026 (Andrea): pausa pranzo segnata nel Programma e nella Vista generale.
   Si ricava dal programma ufficiale: tra un turno e il successivo nessuna sessione per almeno 20 minuti
   (40 se il turno precedente non ha la durata; tarato sul BREAK del timetable WSK FC R2: ven 12.16-12.40, sab 11.50-12.40), con il centro del buco tra le 11.30 e le 14.30. */
function lunchOf(slotsArr){
  // 19/11/2026 (Andrea): se il server ha letto le pause dal Timetable ufficiale, vale solo quello (anche "nessuna pausa")
  if(currentBreaks){
    const ob=currentBreaks[activeDay];if(!ob||!ob.to)return null;
    const mm=t=>{const x=String(t||'').match(/(\d{1,2})[.:](\d{2})/);return x?(+x[1])*60+(+x[2]):-1;};
    const toM=mm(ob.to);const idx=slotsArr.findIndex(x=>mm(x&&x.time)>=toM);if(idx<1)return null;
    const fromM=ob.from?mm(ob.from):mm(slotsArr[idx-1].time);
    return {idx,hasDur:!!ob.from,fromM,toM,from:ob.from||'',to:ob.to,official:true};
  }
  // senza dato ufficiale: si ricava dal programma (buco tra i turni)
  // al massimo una pausa al giorno: il buco piu' lungo con il centro tra le 11.30 e le 14.30
  const m=t=>{const x=String(t||'').match(/(\d{1,2})[.:](\d{2})/);return x?(+x[1])*60+(+x[2]):-1;};
  let best=null;
  for(let i=1;i<slotsArr.length;i++){
    const prev=slotsArr[i-1],next=slotsArr[i];
    const a=m(prev&&prev.time),b=m(next&&next.time);if(a<0||b<0||b<=a)continue;
    const d=parseInt(String((prev&&prev.dur)||''),10);const end=a+(d>0?d:0);
    if(b-end<(d>0?20:40))continue;
    const mid=(end+b)/2;if(mid<11*60+30||mid>14*60+30)continue;
    if(!best||b-end>best.toM-best.fromM)best={idx:i,hasDur:d>0,fromM:end,toM:b};
  }
  if(!best)return null;
  const f=x=>[Math.floor(x/60),'.',String(x%60).padStart(2,'0')].join('');
  best.from=best.hasDur?f(best.fromM):'';best.to=f(best.toM);return best;
}
function lunchHtml(slotsArr,idx,ov){
  const l=lunchOf(slotsArr);if(!l||l.idx!==idx)return'';
  let now=false;
  if(autoDayName()===activeDay){const nm=new Date().getHours()*60+new Date().getMinutes()-(typeof scheduleDelay==='number'?scheduleDelay:0);now=nm>=l.fromM&&nm<l.toM;}
  return ['<div class="lunch-break',(ov?' ov':''),(now?' now':''),'">PAUSA PRANZO<span>',(l.from?[l.from,' – ',l.to].join(''):['riprende alle ',l.to].join('')),'</span></div>'].join('');
}
function renderSchedule(){
  try{wxLoad();wxRender();}catch(e){}
  const dt=document.getElementById('day-tabs');
  dt.innerHTML=currentDays.map(d=>'<button class="day-tab '+(d===activeDay?'active':'')+'" onclick="setDay(\''+d+'\')">'+d+'</button>').join('');
  const el=document.getElementById('schedule-content');
  if(!initialized){el.innerHTML='<div class="loading">Caricamento…</div>';return;}
  if(!currentDays.length){el.innerHTML='<div class="empty-state"><p>Nessun programma caricato.<br>Vai in GARE → Impostazioni per caricare il programma.</p></div>';return;}
  const slots=currentSchedule[activeDay];
  if(!slots){el.innerHTML='<div class="empty-state"><p>Nessun programma per questo giorno</p></div>';return;}
  // Safeguard: ensure slots is an array
  const slotsArr=Array.isArray(slots)?slots:(typeof slots==='object'?Object.values(slots):[]);
  if(!slotsArr.length){el.innerHTML='<div class="empty-state"><p>Nessun programma per questo giorno</p></div>';return;}
  // Fix filter arrays inside slots
  slotsArr.forEach(function(s){if(s.filter&&!Array.isArray(s.filter)&&typeof s.filter==='object')s.filter=Object.values(s.filter);});
  let currentIdx=getCurrentSlotIndex(slotsArr);
  /* FIX 17/10/2026: cornice verde e tasto ORA anche sulle FINALI. Se l'ultima finale (delle mie categorie) gia' partita
     e' dopo l'ultimo turno del programma, la cornice va sulla finale e non sul turno. */
  const _toM=t=>{const m=String(t||'').match(/(\d{1,2})[.:](\d{2})/);return m?(+m[1])*60+(+m[2]):-1;};
  const _nowM=new Date().getHours()*60+new Date().getMinutes()-(typeof scheduleDelay==='number'?scheduleDelay:0);
  let _finalNowKey=null;
  if(activeDay===currentDays[currentDays.length-1]&&currentFinals.length){
    const _myC=new Set(pilots.map(p=>canonCat(p.cat)));
    let _best=-1;
    currentFinals.forEach(f=>{const m=_toM(f.time);if(m>=0&&m<=_nowM&&m>_best){_best=m;_finalNowKey=f.label+'|'+f.time;}}); // 14/11: tutte le finali, anche senza miei piloti
    const _slotM=_toM((slotsArr[currentIdx]||{}).time);
    if(_finalNowKey&&_best>=_slotM)currentIdx=-1; else _finalNowKey=null;
    const _lf=liveFinalCat();if(_lf){const _f=currentFinals.find(x=>canonCat(x.cat)===_lf);if(_f){_finalNowKey=_f.label+'|'+_f.time;currentIdx=-1;}}
  }
  const _ds=progDayState(activeDay,slotsArr);
  if(_ds!=='today'){currentIdx=_ds==='future'?-1:slotsArr.length;_finalNowKey=null;}
  let html='';let lastSession='';
  /* 19/11/2026 (Andrea): l'intestazione si ripete ogni volta che ricomincia il giro delle categorie, anche nella stessa sessione
     (es. PROVE LIBERE · TURNO 2). Il numero del turno viene dal programma ufficiale quando lo scrive, altrimenti dal ripetersi dello stesso turno. */
  const {blk:_blk,cnt:_blkCnt}=progBlocks(slotsArr);
  let _lastBlk='';
  // Quante volte corre oggi ogni mio pilota e quale di queste è lo slot (es. Gara 2/3)
  // Se un turno dipende da dati non ancora ufficiali (prefinale non assegnata, finale non decisa) il totale è "?"
  const _runs={},_unc={},_finIn={};
  const _awaits=(p,sl)=>canonCat(p.cat)===canonCat(sl.cat)&&((sl.type==='serie'&&!String(p.serie||'').trim())||(sl.type==='group'&&!pilotHasGroupData(p))||(sl.type==='prefinal'&&!String(p.prefinal||'').trim()));
  let _sess='';
  slotsArr.forEach((sl,i)=>{if(sl.session)_sess=sl.session;pilots.forEach(p=>{if(p.eliminated)return;
    if(entrantInSlot(p,sl))(_runs[p.num]=_runs[p.num]||[]).push(i);
    else if(_awaits(p,sl)){const u=(_unc[p.num]=_unc[p.num]||{});const k=[_sess,sl.type].join('|');if(!(k in u))u[k]=i;}
  });});
  /* 19/11/2026 (Andrea): stesso conteggio anche per i piloti dei team seguiti che non sono tra i miei */
  const _mineSet=new Set(pilots.map(p=>String(p.num)));const _tCat={};
  _sess='';
  slotsArr.forEach((sl,i)=>{if(sl.session)_sess=sl.session;teamsForSlot(sl).forEach(x=>{
    x.inSlot.forEach(p=>{const n=String(p.num);if(_mineSet.has(n))return;_tCat[n]=p.cat;const l=(_runs[n]=_runs[n]||[]);if(!l.includes(i))l.push(i);});
    x.waiting.forEach(p=>{const n=String(p.num);if(_mineSet.has(n))return;_tCat[n]=p.cat;const u=(_unc[n]=_unc[n]||{});const k=[_sess,sl.type].join('|');if(!(k in u))u[k]=i;});
  });});
  const _lastDay=activeDay===currentDays[currentDays.length-1]&&currentFinals.length;
  if(_lastDay){Object.keys(_tCat).forEach(n=>{const e=(currentEntryList||{})[n]||{};if(e.eliminated)return;
    if(!currentFinals.find(x=>canonCat(x.cat)===canonCat(_tCat[n])))return;
    if(e.inFinal)_finIn[n]=1;else{const u=(_unc[n]=_unc[n]||{});u['FINALE']=1e6;}});}
  if(_lastDay){pilots.forEach(p=>{if(p.eliminated)return;const f=currentFinals.find(x=>canonCat(x.cat)===canonCat(p.cat));if(!f)return;
    const decided=pilots.some(q=>canonCat(q.cat)===canonCat(p.cat)&&q.inFinal);
    if(p.inFinal)_finIn[p.num]=1;else if(!decided){const u=(_unc[p.num]=_unc[p.num]||{});u['FINALE']=1e6;}});}
  const runLabel=(num,i)=>{const l=_runs[num]||[];const u=Object.values(_unc[num]||{});
    const fin=_finIn[num]?1:0;const tot=l.length+fin;const unk=u.length>0;
    const k=i>=1e6?l.length+1:l.indexOf(i)+1;if(i<1e6&&!k)return'';
    const before=u.some(x=>x<i);
    return['Gara ',before?'?':String(k),'/',unk?'?':String(tot)].join('');};
  const runChip=(num,i)=>{const t=runLabel(num,i);if(!t)return'';
    return['<span class="run-chip',(i<currentIdx?' done':''),'" title="Gare di oggi">',t,'</span>'].join('');};
  _progRunChip=runChip;
  slotsArr.forEach((slot,idx)=>{
    const ps=pilotsForSlot(slot);const isNow=idx===currentIdx;
    const awaiting=pilotsAwaitingData(slot);
    let _pf=false;try{_pf=progFilterOn();}catch(e){}
    try{watchUserSettings();}catch(e){}
    const _tv=teamViewMode(),_hl=_tv!=='cards';
    const tHtml=_pf?'':(_tv==='both'?teamsHighlightHtml(slot,ps)+teamsSlotHtml(slot):_hl?teamsHighlightHtml(slot,ps):teamsSlotHtml(slot));
    html+=lunchHtml(slotsArr,idx);
    if(_pf&&!ps.length)return; // con il filtro attivo si vedono solo gli orari dei piloti filtrati
    const _b=_blk[idx];
    if(_b&&_b.ses&&_b.id!==_lastBlk){html+=['<div class="session-divider">',blkLabel(_b,_blkCnt),wxSlotIcon(activeDay,slot.time),'</div>'].join('');_lastBlk=_b.id;}

    // No pilots matched AND some are waiting for data assignment
    if(!ps.length&&awaiting.length&&!tHtml){
      const typeLabel=slot.type==='serie'?'serie':slot.type==='group'?'gruppo':slot.type==='prefinal'?'prefinal':'';
      html+='<div class="card'+(isNow?' slot-now':'')+'" style="opacity:.35;padding:10px 14px" '+(isNow?'id="slot-now"':'')+'>'
        +'<div style="display:flex;align-items:center;gap:8px">'
        +'<span style="font-size:13px;font-weight:900;color:var(--text4)">'+slot.time+'</span>'
        +'<span class="'+catClass(slot.cat)+'" style="font-size:10px;font-weight:800">'+slot.label+'</span>'
        +'<span style="font-size:9px;color:#fbbf24;font-weight:700;margin-left:auto;letter-spacing:1px"><i class="ic ic-wait"></i> ATTESA '+typeLabel.toUpperCase()+'</span>'
        +'</div>'+remLine(slot)+'</div>';
      return;
    }

    // No pilots at all for this slot
    if(!ps.length&&!tHtml&&userSettings.hideEmpty===true&&!isNow)return;
    if(!ps.length&&!tHtml){
      html+='<div class="card'+(isNow?' slot-now':'')+'" style="opacity:.45" '+(isNow?'id="slot-now"':'')+'><div class="slot-header">'
        +'<span class="slot-time">'+slot.time+'</span>'+(isNow?'<span class="now-badge">ORA</span>':'')
        +'<span class="slot-label '+catClass(slot.cat)+'">'+slot.label+'</span>'
        +'<span class="slot-type">'+slotFilterLabel(slot)+'</span>'+slotDur(slot)+'</div>'+remLine(slot)
        +'<div style="font-size:11px;font-weight:700;color:var(--text4);padding:2px 0">— NESSUNO —</div></div>';
      return;
    }

    // Has pilots — show them, plus warning if some are still awaiting
    html+='<div class="card'+(isNow?' slot-now':'')+'" '+(isNow?'id="slot-now"':'')+'><div class="slot-header">'
      +'<span class="slot-time">'+slot.time+'</span>'+(isNow?'<span class="now-badge">ORA</span>':'')
      +'<span class="slot-label '+catClass(slot.cat)+'">'+slot.label+'</span>'
      +'<span class="slot-type">'+slotFilterLabel(slot)+'</span>'+slotDur(slot)+'</div>'
      +remLine(slot)
      +(awaiting.length?'<div style="font-size:9px;color:#fbbf24;font-weight:600;margin-top:4px"><i class="ic ic-wait"></i> '+awaiting.map(p=>'#'+p.num).join(' ')+' in attesa</div>':'')
      +'<div style="margin-top:8px">';
    const _items=[]; // 15/11 (Andrea): raccolti per poter raggruppare i piloti dello stesso team
    ps.forEach(p=>{
      var sh=p.highlight||[];
      var shCls=hlClassOf(sh);
      var shIco={foto:'<i class="ic ic-hl-foto"></i>',video:'<i class="ic ic-hl-video"></i>',priority:'<i class="ic ic-hl-prio"></i>'};
      var _ft=_hl?followedTeamOf(p.num,p.team):null;
      _items.push({num:p.num,key:_ft?_ft.key:null,html:'<div class="card-inner'+(shCls?' '+shCls:'')+(_ft?' tglow':'')+'"'+(_ft?' style="--tc:'+teamColor(_ft.key)+'"':'')+'>'
        +progHead({num:p.num,name:p.name,team:p.team,note:noteBtn(p.num),badges:[riskTri(p.num),gridBadge(p.num,slot)].join(''),
          top:[sh.map(function(h){return['<span class="hl-badge hl-',h,' hl-mini">',(shIco[h]||''),'</span>'].join('');}).join(''),reelChip(p),fotoChips(p)].join(''),
          chips:[persChip(p),(p.group?['<span class="inner-group">GRP ',p.group,'</span>'].join(''):''),runChip(p.num,idx)].join('')})
        +'<div class="tasks">'+TASKS.map(t=>taskBtn(p.num,t,true)).join('')+spotPill(p.num)+'</div>'
        +(notes[p.num]?'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> '+notes[p.num]+'</div>':'')+'</div>'});
    });
    if(_hl&&!_pf){teamsHighlightItems(slot,ps,idx).forEach(x=>_items.push(x));}
    html+=groupSlotItems(_items)+(_hl&&!_pf?teamsWaitingHtml(slot)+(_tv==='both'?teamsSlotHtml(slot):''):tHtml)+'</div></div>';
  });
  updateProgTicker(slotsArr,_ds==='today'?currentIdx:slotsArr.length);
  if(activeDay===currentDays[currentDays.length-1]&&currentFinals.length){
    html+='<div class="session-divider">FINALI</div>';
    const myCanon=new Set(pilots.map(p=>canonCat(p.cat)));
    /* 14/11 20:05 (Andrea): il programma deve essere SEMPRE completo: anche le finali senza miei piloti, come turno vuoto */
    currentFinals.slice().sort((a,b)=>_toM(a.time)-_toM(b.time)).forEach(f=>{
      const allCat=pilots.filter(p=>canonCat(p.cat)===canonCat(f.cat));
      const finalists=allCat.filter(p=>p.inFinal);
      /* 15/11/2026 (Andrea): prima della lista ufficiale = "possibili finalisti", attenuati, dal piu' sicuro al piu' a rischio */
      const _poss=!finalists.length;const _rm=_poss?riskMarkMap():{};
      const ps=finalists.length?finalists:allCat.filter(p=>!p.eliminated).sort((a,b)=>((_rm[String(a.num)]??50)-(_rm[String(b.num)]??50))||((parseInt(a.num)||0)-(parseInt(b.num)||0)));
      const _fNow=_finalNowKey===(f.label+'|'+f.time);
      html+='<div class="final-card'+(_fNow?' slot-now':'')+'"'+(_fNow?' id="slot-now"':'')+'><div class="final-title"><i class="ic ic-trophy"></i> '+f.label+(_fNow?' <span class="now-badge">ORA</span>':'')+'</div>'
        +'<div class="final-row"><span>Partenza</span><span class="final-time">'+f.time+'</span></div>'
        +(slotDurText(f)?'<div class="final-row"><span>Durata</span><span class="final-time">'+slotDurText(f)+'</span></div>':'');
      if(!ps.length)html+='<div style="font-size:12px;color:var(--text4);padding:8px 2px 2px">Nessun tuo pilota in questa finale</div>';
      else if(_poss)html+='<div class="final-poss"><i class="ic ic-wait"></i> Possibili finalisti · lista ufficiale non ancora uscita</div>';
      // 15/11/2026 (Andrea): anche nelle finali riquadro del team e cornici foto/video/priorita', come nei turni
      const _fhl=teamViewMode()!=='cards';const _fItems=[];
      ps.forEach(p=>{
        const _ft=_fhl?followedTeamOf(p.num,p.team):null;const _sc=hlClassOf(p.highlight||[]);
        let html='';
        html+='<div class="card-inner'+(_poss?' final-maybe':'')+(_sc?' '+_sc:'')+(_ft?' tglow':'')+'" style="margin-top:8px'+(_ft?';--tc:'+teamColor(_ft.key):'')+'">'
          +progHead({num:p.num,name:p.name,team:p.team,note:noteBtn(p.num),badges:[riskTri(p.num),gridBadge(p.num,{type:'final'})].join(''),
            top:[(p.highlight||[]).map(function(h){return['<span class="hl-badge hl-',h,' hl-mini"><i class="ic ic-hl-',(h==='priority'?'prio':h),'"></i></span>'].join('');}).join(''),reelChip(p),fotoChips(p)].join(''),
            chips:[persChip(p),(p.eliminated?'':runChip(p.num,1e6))].join('')})
          +'<div class="tasks">'+TASKS.map(t=>taskBtn(p.num,t,true)).join('')+spotPill(p.num)+'</div>'
          +(notes[p.num]?'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> '+notes[p.num]+'</div>':'')+'</div>';
        _fItems.push({num:p.num,key:_ft?_ft.key:null,html});
      });
      html+=groupSlotItems(_fItems,true);
      html+='</div>';
    });
  }
  // -- ELIMINATI / RITIRATI (in fondo, dopo le finali) --
  const _elim=pilots.filter(p=>p.eliminated);
  if(_elim.length){
    html+='<div class="session-divider" style="margin-top:26px">RITIRATI / ELIMINATI ('+_elim.length+')</div>';
    html+='<div class="card" style="padding:10px 12px">';
    html+='<button onclick="toggleEliminati()" style="width:100%;text-align:left;background:none;border:none;color:var(--text3);font-family:inherit;font-size:12px;font-weight:700;letter-spacing:.5px;cursor:pointer;padding:4px 2px">'+(showEliminati?'\u25bc':'\u25b6')+' '+_elim.length+' piloti fuori dai giochi</button>';
    if(showEliminati){
      _elim.slice().sort((a,b)=>parseInt(a.num)-parseInt(b.num)).forEach(p=>{
        html+='<div class="card-inner" style="opacity:.55;border-style:dashed;cursor:pointer;margin-top:6px" onclick="openEditPilot(\''+p.num+'\')"><div style="display:flex;align-items:center;gap:8px">'
          +'<span class="inner-num" style="color:var(--text4)">#'+p.num+'</span>'
          +'<span class="inner-name">'+p.name+'</span>'+reelChip(p)+fotoChips(p)+persChip(p)
          +'<span class="'+catClass(p.cat)+'" style="font-size:9px;font-weight:800;margin-left:auto">'+p.cat+'</span>'
          +'</div>'+noteLine(p.num)+'</div>';
      });
    }
    html+='</div>';
  }
  // -- CRUSCOTTO COSA MI MANCA (in fondo) --
  if(pilots.length){
    const tot=pilots.length;
    const chips=TASKS.map(t=>{
      const done=pilots.filter(p=>(statuses[p.num]&&statuses[p.num][t])==='green').length;
      const full=done>=tot;
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:56px;padding:8px 4px;border:1px solid '+(full?'var(--accent)':'var(--border)')+';border-radius:10px;background:'+(full?'var(--accent-dim)':'var(--bg3)')+'">'
        +'<span style="font-size:9px;font-weight:800;letter-spacing:.3px;color:var(--text4)">'+t+'</span>'
        +'<span style="font-size:15px;font-weight:900;color:'+(full?'var(--accent)':'var(--text)')+'">'+done+'<span style="font-size:10px;color:var(--text4);font-weight:700">/'+tot+'</span></span>'
        +'</div>';
    }).join('');
    html+='<div class="session-divider" style="margin-top:26px">COSA MI MANCA</div>';
    html+='<div class="miss-chips" style="display:flex;gap:6px;flex-wrap:wrap">'+chips+'</div>';
    html+='<div style="font-size:10px;color:var(--text4);text-align:center;padding:6px 0 2px">verde = completati sui '+tot+' tuoi piloti</div>';
  }
  el.innerHTML=awardsStrip(activeDay)+partitoBar(slotsArr,currentIdx,_ds)+(html||'<div class="empty-state"><p>Nessun tuo pilota in questa giornata</p></div>');
  const fab=document.getElementById('fab-now');if(fab)fab.classList.add('visible');
  const fabTop=document.getElementById('fab-top');if(fabTop)fabTop.classList.add('visible');
  const fabBot=document.getElementById('fab-bottom');if(fabBot)fabBot.classList.add('visible');
  /* FIX 14/11/2026: la richiesta di scorrere a ORA si consuma solo quando la sessione ORA e' davvero disegnata
     (prima veniva persa su un render a dati vuoti e il Programma restava in un punto a caso) */
  if(scheduleNeedsScroll&&document.getElementById('slot-now')){
    scheduleNeedsScroll=false;
    setTimeout(()=>{const nowEl=document.getElementById('slot-now');if(nowEl)nowEl.scrollIntoView({behavior:'smooth',block:'center'});},150);
  }
  else if(scheduleNeedsScroll&&_ds!=='today'){ // giornata senza ORA: si parte dalla cima
    scheduleNeedsScroll=false;
    setTimeout(()=>{const sc=document.getElementById('schedule-content');if(sc)sc.scrollIntoView({behavior:'smooth',block:'start'});else window.scrollTo({top:0,behavior:'smooth'});},150);
  }
}
let scheduleNeedsScroll=true;

// Auto-select today's day based on day name matching
function autoSelectToday(){
  if(!currentDays.length)return;
  const dayNames=['DOMENICA','LUNEDÌ','MARTEDÌ','MERCOLEDÌ','GIOVEDÌ','VENERDÌ','SABATO'];
  const todayIdx=new Date().getDay(); // 0=Sunday
  const todayName=dayNames[todayIdx];
  if(currentDays.includes(todayName)){
    activeDay=todayName;
    localStorage.setItem('rt_day',activeDay);
  }
}

function setDay(d){activeDay=d;localStorage.setItem('rt_day',d);scheduleNeedsScroll=true;renderSchedule();}
window.setDay=setDay;

function scrollToNow(){
  const nowEl=document.getElementById('slot-now');
  if(nowEl){nowEl.scrollIntoView({behavior:'smooth',block:'center'});return;}
  const sc=document.getElementById('schedule-content');
  if(sc){sc.scrollIntoView({behavior:'smooth',block:'start'});}
  else{window.scrollTo({top:0,behavior:'smooth'});}
}
window.scrollToNow=scrollToNow;

let _tickTimer=null,_tickPaused=false;
function updateProgTicker(slotsArr,currentIdx){
  const wrap=document.getElementById('prog-ticker-wrap');
  const tick=document.getElementById('prog-ticker');
  if(!wrap||!tick)return;
  const nowM=new Date().getHours()*60+new Date().getMinutes()-scheduleDelay;
  let items=[];
  /* 15/11/2026 (Andrea): solo turni ancora da correre, decisi dall'orario (prima, con una finale in corso,
     ripartiva dall'inizio della giornata); comprese le finali con i miei piloti */
  const toM=t=>{const pr=String(t||'').split('.');return parseInt(pr[0])*60+parseInt(pr[1]||0);};
  const cand=[];
  if(currentIdx<slotsArr.length)slotsArr.forEach((sl,i)=>{if(i>currentIdx&&toM(sl.time)>=nowM-1)cand.push({sl,mine:pilotsForSlot(sl)});});
  if(currentIdx<slotsArr.length&&activeDay===currentDays[currentDays.length-1])[].concat(currentFinals||[]).filter(Boolean).forEach(f=>{
    if(toM(f.time)<nowM-1)return;const _lf=liveFinalCat();if(_lf){const lfF=currentFinals.find(x=>x&&canonCat(x.cat)===_lf);if(lfF&&toM(f.time)<=toM(lfF.time))return;}const all=pilots.filter(p=>canonCat(p.cat)===canonCat(f.cat));const fin=all.filter(p=>p.inFinal);
    cand.push({sl:{time:f.time,label:'FINALE '+(f.cat||''),cat:f.cat},mine:fin.length?fin:all.filter(p=>!p.eliminated)});});
  cand.sort((a,b)=>toM(a.sl.time)-toM(b.sl.time));
  for(const c of cand){if(items.length>=6)break;
    const sl=c.sl;const mine=c.mine;
    if(!mine.length)continue;
    const slM=toM(sl.time);
    const mins=slM-nowM;
    // 15/11 (Andrea): e' il tempo che manca alla partenza, non la durata: "tra 7 min"
    const when=mins<=0?'a breve':'tra '+(mins>=60?Math.floor(mins/60)+'h '+String(mins%60).padStart(2,'0'):mins+' min');
    items.push('<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;margin-right:8px;background:var(--bg3);border:1px solid var(--border2);border-left:3px solid var(--amber);border-radius:20px;font-size:11px;white-space:nowrap">'
      +'<b style="color:var(--amber);font-weight:900">'+sl.time+'</b>'
      +'<span style="color:var(--text3);font-weight:700">'+(sl.label||sl.cat)+'</span>'
      +'<span style="color:var(--text4);font-weight:700;font-size:9px">'+when+'</span>'
      +'<span style="color:var(--text);font-weight:800;font-variant-numeric:tabular-nums">'+mine.map(p=>'#'+p.num).join(' ')+'</span>'
      +'</span>');
  }
  if(!items.length){wrap.style.display='none';if(_tickTimer){clearInterval(_tickTimer);_tickTimer=null;}return;}
  wrap.style.display='block';
  const h=items.join('');
  // 15/11 (Andrea): duplicato solo se serve lo scorrimento (altrimenti lo stesso turno compariva due volte)
  tick.innerHTML=h;
  if(tick.scrollWidth<=tick.clientWidth+4){if(_tickTimer){clearInterval(_tickTimer);_tickTimer=null;}tick.scrollLeft=0;return;}
  tick.innerHTML=h+h;
  if(!tick._bound){
    tick.addEventListener('touchstart',function(){_tickPaused=true;},{passive:true});
    tick.addEventListener('touchend',function(){setTimeout(function(){_tickPaused=false;},2500);},{passive:true});
    tick._bound=true;
  }
  if(_tickTimer)clearInterval(_tickTimer);
  _tickTimer=setInterval(function(){
    if(_tickPaused)return;
    const half=tick.scrollWidth/2;
    if(half<=0)return;
    if(tick.scrollLeft>=half){tick.scrollLeft=tick.scrollLeft-half;}
    else{tick.scrollLeft=tick.scrollLeft+1;}
  },50);
}
window.updateProgTicker=updateProgTicker;

// Auto-refresh current slot every 60 seconds (no page reload)
let _scheduleRefreshTimer=null;
function startScheduleAutoRefresh(){
  if(_scheduleRefreshTimer)clearInterval(_scheduleRefreshTimer);
  // Controlla ogni 10 s se la sessione in corso è cambiata e ridisegna solo in quel caso
  _scheduleRefreshTimer=setInterval(()=>refreshNowHighlight(false),10000);
}
let _lastNowKey='';
function nowSlotKey(){
  try{
    const s=currentSchedule&&currentSchedule[activeDay];if(!s)return'';
    const arr=Array.isArray(s)?s:Object.values(s);
    return activeDay+'|'+getCurrentSlotIndex(arr)+'|'+scheduleDelay+'|'+new Date().toDateString();
  }catch(e){return'';}
}
function refreshNowHighlight(force,scroll){
  const k=nowSlotKey();
  if(!force&&k===_lastNowKey)return;
  _lastNowKey=k;
  if(activeTab==='programma'){
    const ae=document.activeElement;
    if(ae&&ae.id==='prog-search')return; // non disturbare mentre scrivi nella ricerca
    scheduleNeedsScroll=!!scroll;
    renderSchedule();
  }
  if(document.getElementById('ov-body'))renderOverviewBody();
}
window.refreshNowHighlight=refreshNowHighlight;
// Al ritorno nell'app (schermo riacceso, cambio app) aggiorna subito l'evidenziazione
// FIX 14/11/2026: tornando nell'app dopo almeno 30 s, il Programma torna sulla sessione ORA
let _progHiddenAt=0;
document.addEventListener('visibilitychange',()=>{if(document.hidden){_progHiddenAt=Date.now();return;}refreshNowHighlight(true,_progHiddenAt&&Date.now()-_progHiddenAt>30000);});
window.addEventListener('focus',()=>refreshNowHighlight(true));
window.addEventListener('pageshow',()=>refreshNowHighlight(true));
startScheduleAutoRefresh();

// ══════════════════════════════════════
// RITARDO AUTOMATICO DA APEX LIVE TIMING
// Legge dal flusso live di Apex la sessione in pista e l'ora reale della partenza,
// la abbina allo slot del programma e propone (o applica, se AUTO) il ritardo.
// ══════════════════════════════════════
let apexWs=null,apexWsKey='',apexState={cat:'',sess:'',start:'',red:'',at:0},apexRetry=null;
let apexSeen=new Set(),apexIgnore=new Set();
let apexAuto=true;
let apexLastApplied='';
/* 15/11/2026 (Andrea): EVENTO TEST per la demo. La gara con demo:true non usa Apex: il live arriva dal database
   (races/<id>/demoLive = {seq, frame}) scritto dalla pagina Regia, nello stesso formato dei messaggi Apex. */
function isDemoRace(id){const r=(typeof races!=='undefined'&&races[id||activeRaceId])||{};return r.demo===true;}
function canSeeDemo(){return['demo','andrea','utente prova'].includes(String(currentUserId||''));}
let demoLiveUnsub=null,demoLiveSeq=null;
function apexLiveName(){
  const r=(typeof races!=='undefined'&&races[activeRaceId])?races[activeRaceId]:{};
  if(r.demo===true)return'demo';
  const cfg=ORG_CONFIG[r.org]||null;
  const url=resolveLiveUrl(r);
  const m=url.match(/apex-timing\.com\/live-timing\/([a-z0-9\-]+)\//i);
  return m?m[1].toLowerCase():'';
}
function apexConnect(){
  const name=apexLiveName();
  if(name==='demo'){
    const key='demo:'+activeRaceId;if(key===apexWsKey&&demoLiveUnsub)return;
    try{if(apexWs)apexWs.close();}catch(e){}apexWs=null;try{if(demoLiveUnsub)demoLiveUnsub();}catch(e){}
    apexWsKey=key;apexState={cat:'',sess:'',start:'',red:'',at:0};apexNext=null;apexSeen=new Set();apexIgnore=new Set();demoLiveSeq=null;
    const r=ref(db,'races/'+activeRaceId+'/demoLive');
    onValue(r,snap=>{const v=snap.val();if(!v||!v.frame||v.seq===demoLiveSeq)return;demoLiveSeq=v.seq;try{apexParse(String(v.frame));}catch(e){console.warn('demo live',e);}});
    demoLiveUnsub=()=>{try{off(r);}catch(e){}demoLiveUnsub=null;};
    return;
  }
  try{if(demoLiveUnsub)demoLiveUnsub();}catch(e){}
  const port=APEX_LIVE_PORTS[name];
  const key=name&&port?name+':'+port:'';
  if(key===apexWsKey&&apexWs&&apexWs.readyState<=1)return;
  try{if(apexWs)apexWs.close();}catch(e){}
  apexWs=null;apexWsKey=key;apexState={cat:'',sess:'',start:'',red:'',at:0};apexNext=null;apexSeen=new Set();apexIgnore=new Set();
  if(!key){renderApexDelay();return;}
  try{
    apexWs=new WebSocket('wss://live-data.apex-timing.com:'+(port+3)+'/');
    apexWs.onmessage=ev=>{const was=liveAlive();apexLastMsgAt=Date.now();if(!was)try{applyDelayPerms();}catch(e){}apexParse(String(ev.data));};
    apexWs.onclose=()=>{apexWs=null;clearTimeout(apexRetry);apexRetry=setTimeout(()=>{if(!document.hidden){apexWsKey='';apexConnect();}},15000);};
    apexWs.onerror=()=>{};
  }catch(e){}
}
const apexGrid=document.createElement('tbody');
// ══════════════════════════════════════
// AVVISI PIAZZAMENTI (qualifiche top 3 combinata, finale top 5, manche/prefinali top 5)
// Dati live Apex: sempre PROVVISORI (reclami e penalità possono cambiare le posizioni).
// ══════════════════════════════════════
let apexFinished='',apexEvalT=null,apexEvaluatedKey='',apexGridSess='';
function lapMs(t){const m=String(t||'').trim().match(/^(?:(\d+):)?(\d+)\.(\d+)$/);if(!m)return Infinity;return(parseInt(m[1]||'0')*60+parseInt(m[2]))*1000+parseInt((m[3]+'00').slice(0,3));}
function apexSnapshot(){
  const head=apexGrid.querySelector('tr[data-id="r0"]');const col={};
  if(head)head.querySelectorAll('td[data-type]').forEach(td=>{col[td.getAttribute('data-type')]=(td.getAttribute('data-id')||'').replace('c','');});
  const g=(r,t,d)=>{const el=r.querySelector('[data-id="'+r.getAttribute('data-id')+'c'+(col[t]||d)+'"]');return el?el.textContent.trim():'';};
  return[...apexGrid.querySelectorAll('tr[data-id]')].filter(r=>r.getAttribute('data-id')!=='r0')
    .map(r=>({pos:parseInt(g(r,'rk','3'))||parseInt(r.getAttribute('data-pos'))||999,num:g(r,'no','4'),name:g(r,'dr','5'),best:g(r,'blp','12')}))
    .filter(x=>x.num).sort((a,b)=>a.pos-b.pos);
}
function qualiStore(){try{return JSON.parse(localStorage.getItem('rt_quali_'+activeRaceId)||'{}');}catch(e){return{};}}
function apexEvaluate(why){
  clearTimeout(apexEvalT);
  const cat=apexCat(apexState.cat);const ss=rtPfNorm(apexState.sess);
  if(!cat||!ss||!apexState.start)return;
  const key=activeRaceId+'|'+cat+'|'+ss+'|'+apexState.start;
  if(apexEvaluatedKey===key)return;
  if(apexGridSess!==apexState.cat+'|'+apexState.sess)return; // griglia non di questa sessione
  const snap=apexSnapshot();if(!snap.length)return;
  apexEvaluatedKey=key;
  const mine=new Map(pilots.map(p=>[String(p.num),p]));
  // Arrivo delle manche dal live: la pillola della griglia diventa subito verde con la posizione d'arrivo.
  // Provvisorio: il controllo dai risultati ufficiali Apex lo corregge se cambia (reclami/penalità).
  try{
    const mh=ss.match(/HEATS?\s+([A-H])\s*-\s*([A-H])/);
    // solo a manche davvero conclusa: il primo deve aver fatto tutti i giri del programma (o almeno 3 se il programma non li dice).
    // Una partenza annullata o una bandiera rossa a inizio gara NON è un arrivo (14/11: la griglia era stata salvata come arrivo).
    let _done=false;try{const L=apexLapInfo();_done=L.led!==null&&(L.tot?(L.led>=L.tot||(L.fin&&L.led>=L.tot-1)):L.led>=3);}catch(e){}
    // Prove pari/dispari (warm-up, libere): a fine sessione la posizione del live (ordine per miglior giro)
    const mp=ss.match(/\b(EVEN|ODD)\b/);
    let _pfin=why==='finish';try{if(!_pfin)_pfin=apexLapInfo().fin;}catch(e){}
    // 19/11/2026 (Andrea): arrivo delle prove PER TURNO (PR-<giorno>-<orario del turno>), anche per i turni "All" (KZ2, OKN)
    // e per le liste di numeri. Il turno e' quello abbinato dal live (il piu' vicino all'orario, con il ritardo).
    if(!mh&&/WARM|FREE|PRACT/.test(ss)&&!/QUALIF/.test(ss)&&activeRaceId&&_pfin){
      const day=typeof autoDayName==='function'?autoDayName():activeDay;let pk='',inSlot=null;
      try{const ms=apexMatchSlot();const sl=ms&&ms.slot;if(sl&&['parity','all','list','serie'].includes(sl.type)&&sl.time){pk=['PR-',String(day).toUpperCase(),'-',String(sl.time).replace(/[.:]/g,'_')].join('');
        if(sl.type==='list'){const f=Array.isArray(sl.filter)?sl.filter:String(sl.filter||'').split(',');inSlot=new Set(f.map(v=>String(v).trim()));}}}catch(e){}
      if(!pk&&mp)pk=['PAR-',String(day).toUpperCase(),'-',mp[1]].join('');
      const u={};
      if(pk)snap.forEach(x=>{
        if(!x.pos||x.pos>=999)return;const e=currentEntryList[x.num];if(!e||apexCat(e.cat)!==cat)return;if(inSlot&&!inSlot.has(String(x.num)))return;
        e.result=e.result||{};
        if(!e.result[pk]){e.result[pk]=String(x.pos);u['races/'+activeRaceId+'/entryList/'+x.num+'/result/'+pk]=String(x.pos);}
      });
      if(Object.keys(u).length){update(ref(db),u);if(activeTab==='programma')renderSchedule();}
    }
    // Qualifiche (serie S1/S2): posizione nella serie a fine sessione
    const mq=ss.match(/QUALIF[^S]*S\s*(\d)/);
    if(mq&&activeRaceId&&_pfin){const qk='Q-S'+mq[1];const u={};
      snap.forEach(x=>{if(!x.pos||x.pos>=999)return;const e=currentEntryList[x.num];if(!e||apexCat(e.cat)!==cat)return;e.result=e.result||{};
        if(!e.result[qk]){e.result[qk]=String(x.pos);u['races/'+activeRaceId+'/entryList/'+x.num+'/result/'+qk]=String(x.pos);}});
      if(Object.keys(u).length){update(ref(db),u);if(activeTab==='programma')renderSchedule();}}
    // Prefinali e finale: arrivo provvisorio dal live (il server lo sostituisce con l'ufficiale), solo a gara conclusa
    const mpf=rtPfGroup(ss)?[0,rtPfGroup(ss)]:null,mfi=/FINAL/.test(ss)&&!/PREFINAL/.test(ss);
    if((mpf||mfi)&&activeRaceId&&_done){const fk=mpf?'PF-'+mpf[1]:'FIN';const u={};
      snap.forEach(x=>{if(!x.pos||x.pos>=999)return;const e=currentEntryList[x.num];if(!e||apexCat(e.cat)!==cat)return;e.result=e.result||{};
        const v=String(x.pos);if(ltRetOf(x.num)){e.out=e.out||{};e.out[fk]=true;u['races/'+activeRaceId+'/entryList/'+x.num+'/out/'+fk]=true;}if(!e.result[fk]){e.result[fk]=v;u['races/'+activeRaceId+'/entryList/'+x.num+'/result/'+fk]=v;}});
      if(Object.keys(u).length){update(ref(db),u);if(activeTab==='programma')renderSchedule();}}
    if(mh&&activeRaceId&&_done){
      const pair=[mh[1],mh[2]].sort().join('-');const u={};
      snap.forEach(x=>{
        if(!x.pos||x.pos>=999)return;const e=currentEntryList[x.num];if(!e||apexCat(e.cat)!==cat)return;
        e.result=e.result||{};
        const v=String(x.pos);if(ltRetOf(x.num)){e.out=e.out||{};e.out[pair]=true;u['races/'+activeRaceId+'/entryList/'+x.num+'/out/'+pair]=true;}if(!e.result[pair]){e.result[pair]=v;u['races/'+activeRaceId+'/entryList/'+x.num+'/result/'+pair]=v;}
      });
      if(Object.keys(u).length){update(ref(db),u);if(activeTab==='programma')renderSchedule();}
    }
  }catch(e){console.warn('arrivi live',e);}
  if(/QUALIF/.test(ss)){
    // classifica combinata delle serie: miglior giro per pilota
    const st=qualiStore();st[cat]=st[cat]||{};
    snap.forEach(x=>{const ms=lapMs(x.best);if(ms<Infinity)st[cat][x.num]=Math.min(st[cat][x.num]||Infinity,ms);});
    const ser=(ss.match(/S\s*(\d)/)||[])[1]||'';
    st[cat]['_series_'+ser]=1;
    try{localStorage.setItem('rt_quali_'+activeRaceId,JSON.stringify(st));}catch(e){}
    const done=Object.keys(st[cat]).filter(k=>k.startsWith('_series_')).length;
    const rank=Object.entries(st[cat]).filter(([k])=>!k.startsWith('_')).sort((a,b)=>a[1]-b[1]);
    rank.slice(0,3).forEach(([num],i)=>{
      if(!mine.has(num))return;
      const p=mine.get(num);
      rtAlert('quali|'+cat+'|'+num+'|'+(i+1)+'|'+done,(i===0?'<i class="ic ic-trophy"></i> POLE':'<i class="ic ic-medal"></i> P'+(i+1))+' qualifiche '+cat+': #'+num+' '+p.name,
        (done>=2?'Classifica combinata S1+S2':'Dopo la serie '+ser+', manca l\'altra serie')+' · PROVVISORIO, verifica reclami',i===0?'gold':'');
    });
    return;
  }
  const isFinal=/FINAL/.test(ss)&&!/PREFINAL/.test(ss);
  if(!isFinal)return; // regola Andrea 13/11: P1-P5 solo nelle finali (niente manche/prefinali)
  snap.filter(x=>x.pos<=5).forEach(x=>{
    if(!mine.has(x.num))return;
    const p=mine.get(x.num);
    rtAlert('res|'+key+'|'+x.num,(isFinal?'<i class="ic ic-flag"></i> FINALE ':'')+'P'+x.pos+' '+cat+' '+apexState.sess+': #'+x.num+' '+p.name,
      'PROVVISORIO da live timing, verifica reclami',isFinal?'final':'');
  });
}
window.apexEvaluate=apexEvaluate;
// Avviso quando un mio pilota passa a eliminato (dati ufficiali caricati nell'app)
function checkEliminations(){
  if(!activeRaceId)return;
  const k='rt_elim_'+activeRaceId+'_'+currentUserId;
  let prev=null;try{prev=JSON.parse(localStorage.getItem(k)||'null');}catch(e){}
  const now={};pilots.forEach(p=>{now[p.num]=!!p.eliminated;});
  if(prev){pilots.forEach(p=>{if(now[p.num]&&prev[p.num]===false)rtAlert('elim|'+activeRaceId+'|'+p.num,'ELIMINATO: #'+p.num+' '+p.name+' ('+p.cat+')','Da classifica ufficiale caricata · verifica eventuali reclami','');});}
  try{localStorage.setItem(k,JSON.stringify(now));}catch(e){}
}
// Gli avvisi di prova della versione precedente ('test|') non sono avvisi di gara: esclusi
function alertKey(r){return['rt_alerts_',r||activeRaceId,'_',currentUserId||''].join('');}
function alertLog(){try{return JSON.parse(localStorage.getItem(alertKey())||'[]').filter(a=>a&&a.id&&!a.id.startsWith('test|'));}catch(e){return[];}}
// Preferenze notifiche per utente (Firebase notifPrefs/<utente>/<tipo> = false spegne; default acceso).
// Le stesse chiavi le rispetta il server push.
const NOTIF_TYPES=[['programma','Cambi di programma: griglia ufficiale cambiata (miei piloti) e programma ufficiale aggiornato'],['top3','Mio pilota nei primi 3 in manche e prefinale: subito dal live (provvisorio) e quando diventa ufficiale'],['qualifiche','Pole e top 3 in qualifica'],['finali','P1–P5 in finale: dal live (provvisorio) e quando diventa ufficiale'],['eliminati','Eliminati e rischio finale'],['prefinali','Passati a prefinali e finale'],['riepilogo','Riepilogo serale (orari di domani)'],['entrylist','Cambi entry list (miei piloti e team)'],
  ['ritiri','Mio pilota uscito o fermo in pista'],['rossa','Bandiera rossa con i miei piloti in pista'],['partenza','Partita una sessione con i miei piloti'],['prossima','Mio pilota in pista tra 10 minuti'],['ritardo','Ritardo cambiato di 5 minuti o più'],['correzioni','Posizioni cambiate in classifica ufficiale sui miei piloti, con il motivo (penalità, squalifiche)'],['comunicati','Comunicati e documenti ufficiali nuovi'],['promozioni','Mio pilota promosso dopo le verifiche: pole in qualifica o podio in finale']];
// nuove (dal 14/11): spente finché l'utente non le accende
const NOTIF_DEF_OFF=new Set(['top3','ritiri','rossa','partenza','prossima','ritardo','comunicati','promozioni']);   /* 21/11/2026: 'correzioni' (posizioni cambiate) acceso di default */
function notifTypeOn(k){if(notifPrefs.tutte===false)return false;return NOTIF_DEF_OFF.has(k)?notifPrefs[k]===true:notifPrefs[k]!==false;}
const NOTIF_OF={quali:'qualifiche',res:'finali',elim:'eliminati',pref:'prefinali',ritiri:'ritiri',rossa:'rossa',partenza:'partenza',prossima:'prossima',ritardo:'ritardo'};
let notifPrefs={},notifPrefsUser='';
function watchNotifPrefs(){
  if(!currentUserId||notifPrefsUser===currentUserId)return;notifPrefsUser=currentUserId;
  try{onValue(ref(db,'notifPrefs/'+currentUserId),s=>{notifPrefs=s.val()||{};const m=document.getElementById('notif-prefs-body');if(m)renderNotifPrefs();});}catch(e){}
}
function notifOn(id){if(notifPrefs.tutte===false)return false;const k=NOTIF_OF[String(id).split('|')[0]];return!k||notifTypeOn(k);}
function renderNotifPrefs(){
  const b=document.getElementById('notif-prefs-body');if(!b)return;
  const all=notifPrefs.tutte!==false;
  const row=(lbl,chk,on,dis,big)=>'<label style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:6px 2px;border-bottom:1px solid var(--border,#2a2a2e);cursor:pointer;'+(dis?'opacity:.4;pointer-events:none;':'')+'"><span style="font-size:'+(big?'16px;font-weight:900':'15px')+'">'+lbl+'</span><input type="checkbox" '+(on?'checked':'')+' onchange="'+chk+'" style="width:24px;height:24px;flex-shrink:0"></label>';
  b.innerHTML=row('Notifiche attive','setAllNotif(this.checked)',all,false,true)
    +NOTIF_TYPES.map(([k,l])=>row(l,"setNotifPref('"+k+"',this.checked)",all?notifTypeOn(k):false,!all,false)).join('')
    +'<div style="margin-top:10px;font-size:11px;color:var(--text4)">Valgono solo per il tuo profilo ('+currentUserId+'). Ritiro, bandiera rossa, partenza, tra 10 minuti e ritardo per ora arrivano con l\'app aperta.</div>';
}
function setAllNotif(on){
  if(!currentUserId)return;const u={};const base='notifPrefs/'+currentUserId+'/';
  if(!on){const prev={};NOTIF_TYPES.forEach(([k])=>{prev[k]=NOTIF_DEF_OFF.has(k)?notifPrefs[k]===true:notifPrefs[k]!==false;u[base+k]=false;});u[base+'_prima']=prev;u[base+'tutte']=false;}
  else{const prev=notifPrefs._prima||{};NOTIF_TYPES.forEach(([k])=>{u[base+k]=prev[k]!==undefined?!!prev[k]:!NOTIF_DEF_OFF.has(k);});u[base+'tutte']=true;}
  // il server delle notifiche push legge le singole voci: spegnere tutto = spegnere ogni voce
  update(ref(db),u);Object.keys(u).forEach(p=>{notifPrefs[p.slice(base.length)]=u[p];});renderNotifPrefs();
}
window.setAllNotif=setAllNotif;
function setNotifPref(k,on){if(!currentUserId)return;notifPrefs[k]=!!on;const u={};u['notifPrefs/'+currentUserId+'/'+k]=!!on;update(ref(db),u);}
function openNotifPrefs(){
  if(!currentUserId){alert('Scegli prima il tuo utente.');return;}
  watchNotifPrefs();
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button><div class="modal-title">Le mie notifiche</div><div id="notif-prefs-body"></div>');
  renderNotifPrefs();
}
window.openNotifPrefs=openNotifPrefs;window.setNotifPref=setNotifPref;
// ── IMPOSTAZIONI per account (Firebase settings/<utente>): notifiche, team nel programma, colori dei team ──
const TEAM_PALETTE=['#a78bfa','#22d3ee','#f472b6','#34d399','#fb923c','#facc15','#60a5fa','#f87171','#ff1a1a','#ffffff','#ff6a00','#22c55e','#2563eb','#d946ef','#a3e635','#14b8a6','#eab308','#ec4899','#7c3aed','#06b6d4','#84cc16','#f59e0b','#be123c','#94a3b8'];
let userSettings={},userSettingsUser='';
function watchUserSettings(){
  if(!currentUserId||userSettingsUser===currentUserId)return;userSettingsUser=currentUserId;userSettings={};
  try{onValue(ref(db,'settings/'+currentUserId),s=>{userSettings=s.val()||{};applyUserSettings();try{spotsAttachVenue();}catch(_){}try{document.body.classList.add('quiet');renderAll();}catch(e){}if(document.getElementById('settings-body'))renderSettings();});}catch(e){}
}
let _liveDefDone=false;
function applyUserSettings(){
  try{document.body.classList.toggle('big-text',userSettings.bigText===true);}catch(e){}
  if(!_liveDefDone&&userSettings.liveDefault){_liveDefDone=true;const v=userSettings.liveDefault;
    if(v==='last'){ltLastOn=true;}else{ltLastOn=false;ltOnlyMine=v!=='all';}try{renderLtMyTable();}catch(e){}}
}
function setUS(path,val){userSettings[path]=val;setUserSetting(path,val);applyUserSettings();renderSettings();try{document.body.classList.add('quiet');renderAll();}catch(e){}}
window.setUS=setUS;
function setTheme(light){const isL=document.body.classList.contains('light');if(isL!==light)toggleTheme();renderSettings();}
window.setTheme=setTheme;
function teamViewMode(){const v=userSettings.teamView;return v==='highlight'||v==='both'?v:'cards';}
// nomi simili tra una gara e l'altra (es. "AKM MOTORSPORT SRL" = "AKM MOTORSPORT"): usato SOLO per ritrovare il colore del team
function teamNorm(k){return String(k||'').toUpperCase().replace(/[._\-,'’()]/g,' ').replace(/\b(S\s?R\s?L\s?S?|S\s?P\s?A|S\s?N\s?C|S\s?A\s?S|A\s?S\s?D|S\s?S\s?D|LTD|GMBH|BV|SL|SA|TEAM|RACING TEAM)\b/g,' ').replace(/\s+/g,' ').trim();}
function teamColorSimilar(key){const tc=userSettings.teamColors||{};const n=teamNorm(key);if(n.length<3)return'';
  for(const [k,c] of Object.entries(tc)){const m=teamNorm(k);if(!m)continue;if(m===n||(Math.min(m.length,n.length)>=5&&(m.startsWith(n)||n.startsWith(m))))return c;}return'';}
function teamColor(key){const c=(userSettings.teamColors||{})[key]||teamColorSimilar(key);if(c)return c;const i=teams.findIndex(t=>t.key===key);return TEAM_PALETTE[(i<0?0:i)%TEAM_PALETTE.length];}
function followedTeamOf(num,team){const e=(currentEntryList||{})[num]||{};const tm=team||e.team||'';const k=teamKey(tm);return teams.find(t=>t.key===k||sameTeam(tm,teamOfKey(t)))||null;}
function setUserSetting(path,val){if(!currentUserId)return;const u={};u['settings/'+currentUserId+'/'+path]=val;update(ref(db),u);}
function setTeamView(v){userSettings.teamView=v;setUserSetting('teamView',v);renderSettings();try{renderAll();}catch(e){}}
function setTeamColor(k,c){userSettings.teamColors=userSettings.teamColors||{};userSettings.teamColors[k]=c;setUserSetting('teamColors/'+k,c);renderSettings();try{renderAll();}catch(e){}}
/* 15/11/2026 (Andrea): legenda del linguaggio visivo dell'app (Impostazioni → LEGENDA).
   Le "schermate" sono ricostruite con gli stessi stili dell'app, quindi seguono il tema chiaro/scuro.
   Ogni numero nella schermata corrisponde alla spiegazione sotto. */
function openLegend(){
  const N=n=>'<b class="lg-n">'+n+'</b>';
  const ex=(items)=>'<ol class="lg-list">'+items.map(t=>'<li>'+t+'</li>').join('')+'</ol>';
  const toc=[];let secN=0;
  // 15/11/2026 (Andrea): la legenda diventa una guida completa con indice cliccabile e ricerca
  const sec=(t,w)=>{secN++;toc.push([secN,t]);return (secN>1?'<a href="#" class="gd-top" onclick="document.getElementById(\'gd-body\').scrollTop=0;return false">↑ indice</a>':'')+'</div><div class="gd-sec" id="gd-s'+secN+'"><div class="set-sec" style="margin-top:22px">'+t+'</div>'+(w?'<div class="lg-where"><i class="ic ic-eye"></i> <span>Dove: '+w+'</span></div>':'');};
  const chap=t=>{toc.push([0,t]);return '</div><div class="gd-chap">'+t+'</div><div>';};
  const p_=t=>'<p class="gd-p">'+t+'</p>';
  const notif=(t,b)=>'<div class="gd-notif"><div class="gd-notif-app"><i class="ic ic-flag"></i> RACE TRACKER · ora</div><div class="gd-notif-t">'+t+'</div><div class="gd-notif-b">'+b+'</div></div>';
  const shot=html=>'<div class="lg-shot">'+html+'</div>';
  const tri=c=>'<span style="color:'+c+';font-size:11px;line-height:1">▲</span>';
  const badgeGrid='<span style="font-family:\'Chakra Petch\',sans-serif;font-size:12px;font-weight:700;color:#1a160e;background:#e9d5a8;border-radius:5px;padding:1px 7px">P5</span>';
  const badgeUff='<span style="font-family:\'Chakra Petch\',sans-serif;font-size:12px;font-weight:700;color:#0d0d0f;background:#4fd69c;border:1px solid #4fd69c;border-radius:5px;padding:0 6px"><i class="ic ic-flag"></i> 3°</span>';
  const badgeProv='<span style="font-family:\'Chakra Petch\',sans-serif;font-size:12px;font-weight:700;color:#4fd69c;border:1px dashed #4fd69c;border-radius:5px;padding:0 6px"><i class="ic ic-flag"></i> 3°</span>';
  const badgeCorr='<span style="font-family:\'Chakra Petch\',sans-serif;font-size:12px;font-weight:700;color:#0d0d0f;background:#4fd69c;border:1px solid #4fd69c;border-radius:5px;padding:0 6px"><i class="ic ic-flag"></i> 3° <span style="color:#facc15">●</span></span>';
  const badgeOut='<span style="font-family:\'Chakra Petch\',sans-serif;font-size:12px;font-weight:900;color:#fff;background:#dc2626;border-radius:5px;padding:1px 7px"><i class="ic ic-close"></i> 12°</span>';
  const pencil='<span style="display:inline-flex;align-items:center;color:var(--text3);font-size:18px"><i class="ic ic-note"></i></span>';
  const tasks=(st)=>'<div class="tasks">'+TASKS.map((t,i)=>'<button class="task-btn '+(st[i]||'red')+'" style="padding:4px 8px;font-size:10px;pointer-events:none">'+t+'</button>').join('')+'</div>';
  const h=[];
  h.push('<style>.lg-shot{pointer-events:none;border:1px dashed var(--border2);border-radius:12px;padding:10px;margin:8px 0;background:var(--bg);overflow:hidden}.lg-shot .slot-header{flex-wrap:wrap;row-gap:6px}.lg-shot .slot-type{white-space:nowrap}.lg-shot .tasks{flex-wrap:wrap}.lg-row{flex-wrap:wrap}.lg-where{display:flex;gap:6px;align-items:flex-start;font-size:12px;color:var(--text2);background:var(--bg3);border-radius:8px;padding:7px 10px;margin:4px 0 2px}.lg-where b{color:var(--text)}.lg-shot .card{margin-bottom:0}'
    +'.lg-n{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 3px;border-radius:9px;background:var(--accent);color:#000;font-size:10px;font-weight:900;font-style:normal;vertical-align:middle;margin:0 2px;font-family:Arial,sans-serif;line-height:1}'
    +'.lg-list{margin:4px 0 6px 18px;padding:0;font-size:13px;color:var(--text2);line-height:1.4}.lg-list li{margin:4px 0}.lg-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--border);font-size:13px;color:var(--text2)}.lg-row>div:first-child{min-width:96px;display:flex;justify-content:center;gap:4px;flex-wrap:wrap}</style>');
  h.push('<style>.gd-chap{margin:30px 0 4px;padding:8px 12px;border-radius:10px;background:var(--accent);color:#000;font-weight:900;letter-spacing:1px;font-size:13px}.gd-p{font-size:13px;color:var(--text2);line-height:1.45;margin:6px 0}.gd-toc{display:flex;flex-direction:column;gap:2px;margin:8px 0 4px}.gd-toc a{display:block;padding:7px 10px;border-radius:8px;color:var(--text);text-decoration:none;font-size:13px;font-weight:700;background:var(--bg3);min-height:20px}.gd-toc .gd-toc-c{background:none;color:var(--accent);font-size:11px;letter-spacing:1px;padding:10px 4px 2px;font-weight:900}.gd-search{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--border2);background:var(--bg2);color:var(--text);font-size:15px;margin:6px 0}.gd-top{display:inline-block;margin-top:8px;font-size:11px;font-weight:800;color:var(--accent);text-decoration:none}.gd-notif{background:var(--bg3);border-radius:14px;padding:9px 12px;margin:8px 0;border:1px solid var(--border2)}.gd-notif-app{font-size:10px;color:var(--text4);font-weight:700;letter-spacing:.5px}.gd-notif-t{font-size:13px;font-weight:800;color:var(--text);margin-top:2px}.gd-notif-b{font-size:12px;color:var(--text2)}.gd-tag{display:inline-block;font-size:10px;font-weight:800;border-radius:5px;padding:1px 6px;margin:2px 4px 2px 0;border:1px solid var(--border2);color:var(--text3)}.gd-tag.on{border-color:#4fd69c;color:#4fd69c}.gd-tag.off{border-color:#f59e0b;color:#f59e0b}.gd-hide{display:none}</style>');
  h.push('<div style="font-size:12px;color:var(--text3)">Tocca una voce per saltarci, oppure cerca una parola. Nelle schermate di esempio i numeri <b class="lg-n">1</b> rimandano alle spiegazioni sotto. Le notifiche si accendono e spengono in Impostazioni → <b>NOTIFICHE</b>.</div>');
  h.push('<input class="gd-search" id="gd-search" type="search" placeholder="Cerca nella guida (es. priorità, eliminati, ritardo)" oninput="guideSearch(this.value)">');
  h.push('<div id="gd-toc-slot"></div><div>');

  // PRIMI PASSI
  h.push(chap('PRIMI PASSI'));
  h.push(sec('A COSA SERVE L\'APP'));
  h.push(p_('Race Tracker ti dice <b>dove sono i tuoi piloti</b> durante il weekend: quando girano, da dove partono, come arrivano, se passano o sono eliminati. I dati si aggiornano da soli: tu scegli solo <b>chi seguire</b>.'));
  h.push(sec('MENU IN BASSO','sempre visibile in fondo allo schermo'));
  // 15/11 (Andrea): icone prese dal menu vero, cosi' coincidono sempre con l'app
  h.push(shot('<div style="display:flex;justify-content:space-around;font-size:10px;font-weight:800;color:var(--text3);text-align:center">'+[...document.querySelectorAll('#tabbar .tabbar-btn')].map((b,i)=>{const ic=b.querySelector('.ic');return '<div>'+(ic?ic.outerHTML:'')+'<br>'+(b.textContent||'').trim().toUpperCase()+N(i+1)+'</div>';}).join('')+'</div>'));
  h.push(ex([
    '<b>GARE</b>: scegli il weekend di gara su cui lavori.',
    '<b>PILOTI</b>: i piloti che segui, con lavori, note, filtri e foto/video/priorità.',
    '<b>PROGRAMMA</b>: i turni giorno per giorno, con dentro i tuoi piloti.',
    '<b>ENTRY</b>: tutti gli iscritti della gara, da cui aggiungi i piloti da seguire.',
    '<b>GARA</b>: storico degli avvisi ed eliminazioni (chi rischia, chi passa).',
    '<b>LIVE</b>: il cronometraggio in diretta, con i tuoi piloti in evidenza.'
  ]));
  h.push(sec('IN 4 PASSI','dal primo avvio'));
  h.push(ex([
    'In <b>GARE</b> tocca la gara del weekend.',
    'In <b>ENTRY</b> cerca numero, nome o team e aggiungi i piloti da seguire (oppure in Impostazioni segui un intero team).',
    'In Impostazioni → <b>NOTIFICHE</b> attiva le notifiche sul telefono e scegli quali ricevere.',
    'Durante la gara apri <b>PROGRAMMA</b>: il tasto <b>ORA</b> ti porta al turno in corso.'
  ]));

  // GARE
  h.push(chap('GARE'));
  h.push(sec('ELENCO GARE','menu in basso → <b>GARE</b>'));
  h.push(shot('<div class="race-card active-race" style="pointer-events:none"><div style="font-weight:900">TROFEO DELLE INDUSTRIE</div>'+N(1)+'<div style="font-size:12px;color:var(--text3)">South Garda Karting · 12–15 nov</div>'+N(2)+'</div>'));
  h.push(ex([
    'La gara attiva ha il bordo colorato: tutta l\'app si riferisce a lei.',
    'Circuito e date. Tocca un\'altra gara per passare a quella: piloti e note restano separati per gara.'
  ]));

  // PROGRAMMA
  h.push(chap('PROGRAMMA'));
  h.push(sec('PROGRAMMA · un turno','menu in basso → <b>PROGRAMMA</b>, scegli il giorno in alto'));
  h.push(shot('<div class="card slot-now"><div class="slot-header"><span class="slot-time">9.40</span>'+N(1)+'<span class="now-badge">ORA</span>'+N(2)+'<span class="slot-label cat-okn">OKN</span>'+N(3)+'<span class="slot-type">Manche A-B</span><span class="slot-dur">8\'</span>'+N(4)+'</div>'
    +'<div style="margin-top:8px"><div class="card-inner"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap"><span class="inner-num">#404</span>'+N(5)+tri('#f97316')+N(6)+badgeGrid+'<span class="inner-name">ROSSI MARIO</span><span class="run-chip">Gara 2/3</span>'+N(7)+'<span class="inner-team-big">TEAM ESEMPIO</span>'+pencil+N(8)+'</div>'
    +tasks(['green','orange','red','red','red'])+N(9)
    +'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> tenda vicino alla torretta</div>'+N(10)+'</div></div></div>'));
  h.push(ex([
    'Cornice verde + <b>ORA</b>: il turno in corso. Il tasto ORA in basso ti ci riporta.',
    'Categoria, ognuna con il suo colore.',
    'Tipo di turno (prove, manche con i gruppi, prefinale…).',
    'Durata del turno. Se in pista è diversa vedi <s>16 giri</s> <b>14 giri</b>: barrata quella prevista, in grassetto quella vera.',
    '<b>Triangolo</b>: quanto rischia di non entrare in finale. '+tri('#22c55e')+' poco · '+tri('#facc15')+' medio · '+tri('#f97316')+' alto · '+tri('#ef4444')+' molto alto. Sparisce quando escono i finalisti.',
    'Riquadro posizione: prima del turno la <b>griglia</b>, dopo il turno l\'<b>arrivo</b> (vedi “Posizioni”).',
    '<b>Gara 2/3</b>: è la 2ª delle 3 uscite in pista di oggi del pilota. <b>?</b> = non ancora sicuro.',
    'Matita: scrivi o modifica la nota del pilota.',
    'Lavori da fare per il pilota (vedi “Lavori”).',
    'La tua nota sul pilota.'
  ]));
  h.push(sec('PROGRAMMA · posizioni','<b>PROGRAMMA</b>, accanto al numero di ogni tuo pilota'));
  h.push('<div class="lg-row"><div>'+badgeGrid+'</div><div>Posizione in <b>griglia</b>, prima del turno</div></div>');
  h.push('<div class="lg-row"><div>'+badgeUff+'</div><div>Arrivo <b>ufficiale</b> (pieno)</div></div>');
  h.push('<div class="lg-row"><div>'+badgeProv+'</div><div>Arrivo <b>provvisorio</b> (tratteggiato): può ancora cambiare</div></div>');
  h.push('<div class="lg-row"><div>'+badgeCorr+'</div><div>Classifica <b>corretta</b> (penalità, verifiche)</div></div>');
  h.push('<div class="lg-row"><div>'+badgeOut+'</div><div><b>Uscito</b> o ritirato nel turno, con la posizione in classifica</div></div>');
  h.push(sec('PROGRAMMA · turni particolari','<b>PROGRAMMA</b>; le finali sono in fondo all\'ultimo giorno'));
  h.push(shot('<div class="card" style="opacity:.35;padding:10px 14px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:13px;font-weight:900;color:var(--text4)">11.20</span><span class="cat-kz2" style="font-size:10px;font-weight:800">KZ2</span><span style="font-size:9px;color:#fbbf24;font-weight:700;margin-left:auto;letter-spacing:1px"><i class="ic ic-wait"></i> ATTESA PREFINAL</span>'+N(1)+'</div></div>'
    +'<div class="card" style="opacity:.45;margin-top:8px"><div class="slot-header"><span class="slot-time">12.00</span><span class="slot-label cat-u10">MINI U10</span></div><div style="font-size:11px;font-weight:700;color:var(--text4);padding:2px 0">— NESSUNO —</div>'+N(2)+'</div>'
    +'<div class="final-card" style="margin-top:8px"><div class="final-title"><i class="ic ic-trophy"></i> FINALE KZ2</div><div class="final-row"><span>Partenza</span><span class="final-time">16.00</span></div><div style="font-size:12px;color:var(--text4);padding:8px 2px 2px">Nessun tuo pilota in questa finale</div>'+N(3)+'</div>'));
  h.push(ex([
    '<b>ATTESA</b>: non si sa ancora chi gira (gruppi o prefinali non ancora usciti).',
    '<b>NESSUNO</b>: turno senza tuoi piloti.',
    '<b>Finale</b> (bordo giallo): finché non escono i finalisti vedi i “Possibili finalisti”, attenuati, dal più sicuro al più a rischio. Poi restano solo i finalisti.'
  ]));

  // BARRA IN ALTO
  h.push(chap('BARRA IN ALTO E LIVE'));
  h.push(sec('BARRA IN ALTO','in cima allo schermo, sempre visibile'));
  h.push(shot('<div style="display:flex;gap:14px;align-items:center;font-size:12px;font-weight:700;color:var(--text3)"><span>ORA <b style="color:var(--text)">09:31</b></span>'+N(1)+'<span>RITARDO <b style="color:#4fd69c">-2\'</b> AUTO</span>'+N(2)+'<span class="sync-status ok">● LIVE</span>'+N(3)+'</div>'
    +'<div style="margin-top:8px;background:#b3261e;color:#fff;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700">Server notifiche fermo da 14 min</div>'+N(4)));
  h.push(ex([
    'Ora attuale.',
    'Ritardo (+) o anticipo (−) della giornata. <b>AUTO</b> = si aggiorna da solo.',
    '<b>LIVE</b> = dati aggiornati. Senza rete compare “Senza rete”: le tue modifiche partono quando torna.',
    'Le notifiche ad app chiusa potrebbero non arrivare finché la barra non sparisce. L\'app intanto funziona.'
  ]));

  // LIVE
  h.push(sec('LIVE · un tuo pilota','menu in basso → <b>LIVE</b> (vista “Solo miei”)'));
  h.push(shot('<div class="ltbig up" style="position:relative"><div class="pos" style="position:relative">4<span class="mv">▲3</span></div>'+N(1)
    +'<div style="flex:1;min-width:0"><div><span class="num">#404</span>'+tri('#ef4444')+' <span class="nm">ROSSI MARIO</span> <span class="lt-ret box">AI BOX</span>'+N(2)+'</div>'
    +'<div class="tm">TEAM ESEMPIO · +1.234 · best 48.512</div>'+N(3)
    +tasks(['green','green','red','red','red'])+'</div></div>'
    +'<div class="ltbig" style="margin-top:8px"><div class="pos"><span class="lt-x"><i class="ic ic-close"></i></span></div>'+N(4)+'<div style="flex:1"><div><span class="num">#212</span> <span class="nm">BIANCHI LUCA</span></div></div></div>'));
  h.push(ex([
    'Posizione attuale; sotto, <b style="color:#4fd69c">▲3</b> / <b style="color:#ef6a7a">▼2</b> = posizioni guadagnate o perse (non è il triangolo di rischio).',
    '<b>AI BOX</b> = rientrato ai box; <b>FERMO IN PISTA</b> = fermo sul tracciato (prove e qualifiche).',
    'Team, distacco e giro migliore.',
    '<b><i class="ic ic-close"></i> rossa</b> al posto della posizione: ritirato in gara.'
  ]));

  // LAVORI
  h.push(chap('LAVORI ED ELIMINAZIONI'));
  h.push(sec('LAVORI','pillole sotto ogni pilota in <b>PROGRAMMA</b>, <b>LIVE</b> e <b>PILOTI</b>: tocca per cambiare stato'));
  h.push('<div class="lg-row"><div><button class="task-btn red" style="padding:4px 8px;font-size:10px;pointer-events:none">PISTA</button></div><div>Da fare</div></div>');
  h.push('<div class="lg-row"><div><button class="task-btn green" style="padding:4px 8px;font-size:10px;pointer-events:none">PISTA</button></div><div>Fatto (1 tocco)</div></div>');
  h.push('<div class="lg-row"><div><button class="task-btn orange" style="padding:4px 8px;font-size:10px;pointer-events:none">PISTA</button></div><div>A metà (2 tocchi; il 3° torna rosso)</div></div>');

  // ELIMINAZIONI
  h.push(sec('GARA → ELIMINAZIONI','menu in basso → <b>GARA</b> → <b>ELIMINAZIONI</b> → <b>PREFINALE</b> / <b>FINALE</b>'));
  h.push('<div class="lg-row"><div>'+riskRing(12)+riskRing(62)+riskRing(90)+'</div><div>Anello nella scheda <b>FINALE</b>: quanto rischia di non entrare in finale, con gli stessi colori del triangolo.</div></div>');
  h.push('<div class="lg-row"><div><span style="display:inline-block;width:5px;height:24px;background:#22c55e;border-radius:2px"></span><span style="display:inline-block;width:5px;height:24px;background:#6b7280;border-radius:2px"></span><span style="display:inline-block;width:5px;height:24px;background:#ef4444;border-radius:2px"></span></div><div>Barra a sinistra: <b>verde</b> passa · <b>grigia</b> non si sa ancora · <b>rossa</b> fuori</div></div>');

  // PILOTI / TEAM
  h.push(chap('PILOTI E TEAM'));
  h.push(sec('PILOTI DA SEGUIRE (FOTO, VIDEO, PRIORITÀ)','menu in basso → <b>PILOTI</b> → <b>modifica</b> sul pilota → <b>EVIDENZIA PILOTA</b>'));
  h.push(shot('<div class="hl-picker"><div class="hl-option hl-foto active"><i class="ic ic-hl-foto"></i><span>FOTO</span></div><div class="hl-option hl-video"><i class="ic ic-hl-video"></i><span>VIDEO</span></div><div class="hl-option hl-priority active"><i class="ic ic-hl-prio"></i><span>PRIORITÀ</span></div></div>'+N(1)
    +'<div class="card-inner hl-foto hl-prio" style="margin-top:10px"><div style="display:flex;align-items:center;gap:6px"><span class="hl-badge hl-foto hl-mini"><i class="ic ic-hl-foto"></i></span><span class="hl-badge hl-priority hl-mini"><i class="ic ic-hl-prio"></i></span>'+N(2)+'<span class="inner-num">#404</span><span class="inner-name">ROSSI MARIO</span></div></div>'+N(3)
    +'<div class="card-inner hl-both" style="margin-top:8px"><div style="display:flex;align-items:center;gap:6px"><span class="inner-num">#212</span><span class="inner-name">BIANCHI LUCA</span></div></div>'+N(4)));
  h.push(ex([
    'Tocca per accendere o spegnere: si salva subito. Acceso = colorato, spento = grigio.',
    'Nel Programma, accanto al numero: <span class="hl-badge hl-foto hl-mini"><i class="ic ic-hl-foto"></i></span> foto · <span class="hl-badge hl-video hl-mini"><i class="ic ic-hl-video"></i></span> video · <span class="hl-badge hl-priority hl-mini"><i class="ic ic-hl-prio"></i></span> priorità.',
    'Barra a sinistra: <b style="color:#38bdf8">azzurra</b> = foto, <b style="color:#ec4899">magenta</b> = video. Priorità = <b>cornice dorata</b>, in tutta l\'app.',
    'Foto <b>e</b> video: barra doppia azzurra e magenta.'
  ]));
  h.push(sec('PILOTI, TEAM, ENTRY LIST','<b>PILOTI</b> e <b>ENTRY</b>; i team si seguono in Impostazioni → <b>TEAM NEL PROGRAMMA</b>'));
  h.push('<div class="lg-row"><div><span class="tchip" style="--tc:#38bdf8">TEAM</span></div><div>Piloti di un <b>team che segui</b>: riquadro del colore del team con il suo nome, in cima al turno</div></div>');
  h.push('<div class="lg-row"><div><span style="font-size:9px;font-weight:800;color:#facc15;border:1px dashed #facc15;border-radius:4px;padding:0 5px">DA CONFERMARE</span></div><div>Dati non ancora ufficiali: si aggiornano da soli</div></div>');
  h.push('<div class="lg-row"><div><span style="color:#ef4444;font-size:10px;font-weight:800">ELIMINATO</span></div><div>Pilota fuori dalla gara: lo trovi in fondo al Programma</div></div>');

  // FILTRI
  h.push(sec('FILTRI DELLA LISTA PILOTI','menu in basso → <b>PILOTI</b>, sopra la lista'));
  h.push(shot('<div class="filter-row"><span class="filter-row-label">TASK</span><button class="filter-chip">TUTTI</button><button class="filter-chip active">PADDOK</button><button class="filter-chip active">PREGRGL</button></div>'+N(1)
    +'<div class="filter-row"><span class="filter-row-label">STATO</span><button class="filter-chip">TUTTI</button><button class="filter-chip f-red active"><span class="dotc" style="background:#ff5c7a"></span></button><button class="filter-chip f-orange active"><span class="dotc" style="background:#ffb400"></span></button><button class="filter-chip f-green"><span class="dotc" style="background:#21d07a"></span></button></div>'+N(2)
    +'<div class="filter-row"><span class="filter-row-label">EVID.</span><button class="filter-chip">TUTTI</button><button class="filter-chip f-hl-foto"><i class="ic ic-hl-foto"></i> FOTO</button><button class="filter-chip f-hl-video active"><i class="ic ic-hl-video"></i> VIDEO</button><button class="filter-chip f-hl-priority"><i class="ic ic-hl-prio"></i> PRIORITÀ</button></div>'+N(3)));
  h.push(ex([
    '<b>TASK</b>: scegli su quali lavori guardare il colore (anche più di uno).',
    '<b>STATO</b>: il colore da cercare (anche più di uno). Il pilota compare se <b>almeno uno</b> dei lavori scelti ha quel colore.',
    '<b>EVID.</b>: FOTO e VIDEO si sommano. PRIORITÀ lascia solo i prioritari: da sola = tutti i prioritari, con FOTO = prioritari in foto.'
  ]));
  h.push(p_('Esempio: <b>piloti VIDEO con ancora PADDOK o PREGRIGLIA da fare</b>. <b>TUTTI</b> azzera la riga; <b>FILTRO 5/21</b> dice quanti ne vedi.'));
  h.push(sec('GRUPPO DEL PILOTA','<b>PILOTI</b>, a destra di ogni pilota'));
  h.push('<div class="lg-row"><div><span class="group-badge set">GRP B</span></div><div>Gruppo del pilota nelle manche. <b>GRP ?</b> = non ancora noto.</div></div>');

  // PUNTI DI SCATTO
  h.push(sec('PUNTI DI SCATTO IN PISTA','la pillola <i class="ic ic-camera"></i> dopo PISTA, sotto ogni pilota (solo nei circuiti con la mappa del tracciato)'));
  h.push(shot('<div class="tasks" style="max-width:340px">'+['REPORTAGE','PISTA'].map(t=>'<button class="task-btn green" style="pointer-events:none">'+t+'</button>').join('')+'<button class="task-btn spot-pill orange" style="pointer-events:none"><i class="ic ic-camera"></i><span>2/4</span></button></div>'+N(1)
    +'<div class="sp-map noimg" style="margin-top:10px">'
    +[[18,30,1],[52,22,0],[80,55,1],[40,75,0]].map((d,i)=>'<span class="sp-dot'+(d[2]?' on':'')+'" style="left:'+d[0]+'%;top:'+d[1]+'%"><span>'+(d[2]?'<i class="ic ic-check"></i>':(i+1))+'</span></span>').join('')+'</div>'+N(2)
    +'<div class="sp-tools"><span class="sp-btn">⟲</span><span class="sp-btn">⟳</span><span class="sp-btn">＋</span><span class="sp-btn">－</span><span class="sp-btn">⤢</span></div>'+N(3)));
  h.push(ex([
    'Quanti punti hai fatto con quel pilota sul totale dei tuoi punti (2 su 4). Tocca per aprire il tracciato.',
    'Tocca il tracciato dove hai scattato: nasce un punto già spuntato <b style="color:#4fd69c"><i class="ic ic-check"></i></b> per questo pilota; negli altri piloti compare col suo numero, da spuntare. Tocca un punto per spuntarlo o togliere la spunta; <b>tienilo premuto</b> e trascinalo per spostarlo.',
    'Ruota, ingrandisci, riduci e ricentra. Con due dita ingrandisci e ruoti, con un dito sposti.'
  ]));
  // NOTIFICHE
  h.push(chap('NOTIFICHE'));
  h.push(sec('COME FUNZIONANO','menu in basso → <b>GARA</b> (storico) · Impostazioni → <b>NOTIFICHE</b> (interruttori)'));
  h.push(p_('Parlano <b>solo dei tuoi piloti</b> e dei team che segui. Sono brevi: i dettagli li trovi nell\'app. Le ritrovi tutte nella scheda <b>GARA</b>.'));
  h.push('<div class="lg-row"><div><span class="gd-tag on">APP CHIUSA</span></div><div>Arriva anche con l\'app chiusa o il telefono bloccato.</div></div>');
  h.push('<div class="lg-row"><div><span class="gd-tag">APP APERTA</span></div><div>Arriva solo se l\'app è aperta o in secondo piano.</div></div>');
  h.push('<div class="lg-row"><div><span class="gd-tag off">SPENTA DI BASE</span></div><div>Va accesa a mano in Impostazioni → Notifiche.</div></div>');
  h.push('<div class="lg-row"><div><span style="font-weight:900;color:#4fd69c">PROVVISORIO</span></div><div>Può ancora cambiare (reclami, verifiche). Quando diventa ufficiale arriva la conferma.</div></div>');
  NOTIF_TYPES.forEach(([k,l])=>{
    const g=NOTIF_GUIDE[k]||{};
    h.push(sec('NOTIFICA · '+l.split(':')[0].toUpperCase()));
    h.push((g.ex||[]).map(e=>notif(e[0],e[1])).join(''));
    h.push(p_(g.when||l));
    h.push('<div>'+(g.closed?'<span class="gd-tag on">APP CHIUSA</span>':'<span class="gd-tag">APP APERTA</span>')+(NOTIF_DEF_OFF.has(k)?'<span class="gd-tag off">SPENTA DI BASE</span>':'<span class="gd-tag">ACCESA DI BASE</span>')+(notifTypeOn(k)?'<span class="gd-tag on">ORA ACCESA PER TE</span>':'<span class="gd-tag">ORA SPENTA PER TE</span>')+'</div>');
  });

  // IMPOSTAZIONI
  h.push(chap('IMPOSTAZIONI'));
  h.push(sec('COSA PUOI REGOLARE','icona ingranaggio in alto a destra'));
  h.push(ex([
    '<b>Profilo</b>: cambia utente. Ogni utente ha i suoi piloti, note e notifiche.',
    '<b>Aspetto</b>: tema scuro o chiaro (solo su questo telefono).',
    '<b>Leggibilità e avvisi</b>: testo più grande, vibrazione e suono degli avvisi.',
    '<b>Live all\'apertura</b>: cosa mostra il LIVE quando lo apri (solo miei, tutti, ultima gara).',
    '<b>Team nel programma</b>: segui un team intero e scegli il suo colore.',
    '<b>Notifiche</b>: attiva le notifiche sul telefono e accendi o spegni ogni tipo.'
  ]));

  // PROBLEMI
  h.push(chap('PROBLEMI COMUNI'));
  h.push(sec('LE NOTIFICHE ARRIVANO SOLO QUANDO APRO L\'APP'));
  h.push(p_('È il risparmio batteria di Android che blocca Chrome in background. Vai in Impostazioni del telefono → App → <b>Chrome</b> (e l\'app Race Tracker se l\'hai installata) → Batteria → <b>Senza restrizioni</b>, e controlla che le notifiche siano consentite.'));
  h.push(sec('NON VEDO LE ULTIME NOVITÀ'));
  h.push(p_('Chiudi del tutto l\'app e riaprila: si aggiorna da sola.'));
  h.push(sec('BARRA “SERVER NOTIFICHE FERMO”'));
  h.push(p_('L\'app funziona, ma le notifiche ad app chiusa potrebbero non arrivare. Se resta a lungo avvisa chi gestisce l\'app.'));
  h.push(sec('UN DATO È SBAGLIATO'));
  h.push(p_('Griglie, arrivi e finalisti si correggono da soli quando gli organizzatori pubblicano le correzioni (arriva “Classifica corretta”). Note e lavori li modifichi tu.'));
  h.push(sec('CREDITI'));
  h.push(p_('Disegni dei tracciati: © contributori di OpenStreetMap (licenza ODbL).'));
  h.push(p_('Previsioni meteo: dati di MET Norway (Istituto meteorologico norvegese), licenza CC BY 4.0.'));
  h.push('</div>');

  const tocH='<div class="gd-toc">'+toc.map(([n,t])=>n?'<a href="#" onclick="guideGo('+n+');return false">'+t+'</a>':'<div class="gd-toc-c">'+t+'</div>').join('')+'</div>';
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button><div class="modal-title">Guida</div><div id="gd-body" style="max-height:78vh;overflow-y:auto;overflow-x:hidden;padding-right:2px">'+h.join('').replace('<div id="gd-toc-slot"></div>','<div id="gd-toc">'+tocH+'</div>')+'</div>');
}
window.openLegend=openLegend;
function guideGo(n){const b=document.getElementById('gd-body'),e=document.getElementById('gd-s'+n);if(!b||!e)return;b.scrollTop=b.scrollTop+e.getBoundingClientRect().top-b.getBoundingClientRect().top-6;}
window.guideGo=guideGo;
function guideSearch(q){q=String(q||'').trim().toLowerCase();
  document.querySelectorAll('#gd-body .gd-sec').forEach(s=>s.classList.toggle('gd-hide',!!q&&s.textContent.toLowerCase().indexOf(q)<0));
  document.querySelectorAll('#gd-body .gd-chap').forEach(c=>c.classList.toggle('gd-hide',!!q));
  const t=document.getElementById('gd-toc');if(t)t.classList.toggle('gd-hide',!!q);}
window.guideSearch=guideSearch;
// 15/11/2026: dettagli delle notifiche per la guida (esempio, quando arriva, se arriva ad app chiusa)
const NOTIF_GUIDE={
  programma:{closed:true,ex:[['Griglia cambiata · OKN Prefinale A','3 tuoi piloti spostati · apri l\'app'],['Prefinali cambiate · OKN','2 tuoi piloti cambiano gruppo · apri l\'app'],['Programma ufficiale aggiornato','Controlla orari e turni nell\'app']],when:'Cambia la griglia con tuoi piloti spostati, un tuo pilota cambia gruppo di prefinale, o esce un nuovo programma.'},
  top3:{closed:true,ex:[['P1 Prefinal A OKN: #404 ROSSI MARIO','PROVVISORIO da live timing, verifica reclami']],when:'Un tuo pilota chiude nei primi 3 una manche o prefinale: subito a fine gara, poi la conferma ufficiale.'},
  qualifiche:{closed:true,ex:[['POLE qualifiche OKN: #404 ROSSI MARIO','Classifica combinata S1+S2 · PROVVISORIO, verifica reclami']],when:'Un tuo pilota fa la pole o entra nei primi 3 in qualifica.'},
  finali:{closed:true,ex:[['FINALE P2 OKN Final: #404 ROSSI MARIO','PROVVISORIO da live timing, verifica reclami']],when:'Un tuo pilota chiude la finale nei primi 5: subito a fine gara, poi la conferma ufficiale.'},
  eliminati:{closed:true,ex:[['Rischio finale OK-NJ','2 a rischio, 1 fuori zona finale · apri l\'app']],when:'Tuoi piloti a rischio di non entrare in finale, o risultati eliminati.'},
  prefinali:{closed:true,ex:[['Prefinali uscite · OKN','3 tuoi passano · nessun tuo eliminato · apri l\'app'],['Finale OKN adesso disponibile','2 tuoi in finale · #250 eliminato · apri l\'app']],when:'Escono le liste di prefinale e finale: un solo avviso con quanti passano e se ci sono tuoi eliminati.'},
  riepilogo:{closed:true,ex:[['Domani (domenica): 6 piloti in pista','Prima uscita 8.30 · orari nell\'app']],when:'La sera prima di ogni giorno di gara.'},
  entrylist:{closed:true,ex:[['Entry list OKN cambiata','#404 non più iscritto · apri l\'app']],when:'Cambia la lista iscritti per i tuoi piloti o team.'},
  ritiri:{closed:true,ex:[['#404 ROSSI MARIO USCITO','OKN · Prefinal A']],when:'Un tuo pilota esce in gara, rientra ai box o si ferma in pista.'},
  rossa:{closed:true,ex:[['BANDIERA ROSSA OKN','Prefinal A · in pista: #404 #212']],when:'Bandiera rossa durante una sessione con tuoi piloti in pista.'},
  partenza:{closed:true,ex:[['PARTITA OKN · Prefinal A','alle 11.20 · in pista: #404, #212']],when:'Parte una sessione con tuoi piloti in pista.'},
  prossima:{closed:false,ex:[['Tra 10 min: OKN Prefinal A','ore 11.20 · #404 ROSSI MARIO']],when:'Un tuo pilota entra in pista tra circa 10 minuti.'},
  ritardo:{closed:false,ex:[['Ritardo ora +15 min','prima +10 min']],when:'Il ritardo della giornata cambia di almeno 5 minuti.'},
  correzioni:{closed:true,ex:[['Classifica corretta: OKN Prefinal A','#404 P3→P5 · apri l\'app']],when:'Una classifica viene corretta e cambia la posizione di un tuo pilota.'},
  comunicati:{closed:true,ex:[['Nuovo documento ufficiale','Comunicato n. 12']],when:'Esce un nuovo comunicato ufficiale.'},
  promozioni:{closed:true,ex:[['Podio Finale: #404 ROSSI MARIO P3 (OKN)','Era P4, dopo le verifiche è P3']],when:'Dopo le verifiche un tuo pilota sale in pole o sul podio della finale.'}
};
function renderSettings(){
  const b=document.getElementById('settings-body');if(!b)return;
  const v=teamViewMode();
  const opt=(on,lbl,fn)=>'<div class="set-opt'+(on?' on':'')+'" onclick="'+fn+'"><input type="radio" '+(on?'checked':'')+' style="width:20px;height:20px"> '+lbl+'</div>';
  const sw=(on,lbl,fn)=>'<label class="set-opt" style="justify-content:space-between"><span>'+lbl+'</span><input type="checkbox" '+(on?'checked':'')+' onchange="'+fn+'" style="width:24px;height:24px"></label>';
  const light=document.body.classList.contains('light');const lv=userSettings.liveDefault||'mine';
  b.innerHTML='<div class="set-opt" onclick="openLegend()" style="border:1px solid var(--accent);border-radius:10px;margin-bottom:6px"><i class="ic ic-note"></i> <b>GUIDA</b> · come funziona l\'app, simboli e notifiche</div>'
    +'<div class="set-opt" onclick="openRemPanel()" style="border:1px solid #fbbf24;border-radius:10px;margin-bottom:6px"><i class="ic ic-bell"></i> <b>PROMEMORIA</b> · avvisi personali sui turni ('+Object.keys(reminders||{}).length+')</div>'
    +(aiChatAllowed()?'<div class="set-opt" onclick="openAiChat()" style="border:1px solid #a78bfa;border-radius:10px;margin-bottom:6px"><i class="ic ic-chat"></i> <b>CHIEDI ALL\'AI</b> · orari, piloti, rischi</div>':'')
    +(isDelayAdmin()?'<div id="ai-usage-box" class="set-opt" onclick="openAiLog()" style="border:1px solid #a78bfa;border-radius:10px;margin-bottom:6px;display:block"><i class="ic ic-chip"></i> <b>SPESA AI</b> · <span id="ai-usage-txt">…</span><br><span style="font-size:11px;color:var(--text4)">tocca per il registro degli interventi</span></div>':'')
    +(isDelayAdmin()?'<div class="set-opt" onclick="openTtPhoto()" style="border:1px solid #ef4444;border-radius:10px;margin-bottom:6px;display:block"><i class="ic ic-camera"></i> <b>FOTO PROGRAMMA</b> · emergenza<br><span style="font-size:11px;color:var(--text4)">solo se il programma ufficiale non si trova o non si legge</span></div>':'')
    +'<div class="set-sec">PUNTI DI SCATTO</div>'+sw(!(userSettings&&userSettings.spotsPerRace),'Ritrova i punti sulla stessa pista anche nelle prossime gare','setSpotsScope(this.checked)')
    +'<div class="set-sec">PROFILO</div><div class="set-opt" onclick="closeModal();showUserPicker()"><i class="ic ic-user"></i> Cambia utente <span style="margin-left:auto;color:var(--text4)">'+currentUserId+'</span></div>'
    +'<div class="set-sec">ASPETTO (QUESTO TELEFONO)</div>'+opt(!light,'Tema scuro','setTheme(false)')+opt(light,'Tema chiaro','setTheme(true)')
    +'<div class="set-sec">LEGGIBILITÀ E AVVISI</div>'
    +sw(userSettings.bigText===true,'Testo più grande',"setUS('bigText',this.checked)")
    +sw(userSettings.vibra!==false,'Vibrazione degli avvisi',"setUS('vibra',this.checked)")
    +sw(userSettings.suono!==false,'Suono degli avvisi',"setUS('suono',this.checked)")
    +'<div class="set-sec">LIVE ALL\'APERTURA</div>'+opt(lv==='mine','Solo miei',"setUS('liveDefault','mine')")+opt(lv==='all','Tutti',"setUS('liveDefault','all')")+opt(lv==='last','Ultima gara',"setUS('liveDefault','last')")
    +'<div class="set-sec">PROGRAMMA</div>'+sw(userSettings.hideEmpty===true,'Nascondi le sessioni senza miei piloti',"setUS('hideEmpty',this.checked)")
    +'<div class="set-sec">NOTIFICHE SU QUESTO TELEFONO</div><div id="push-device"></div>'
    +'<div class="set-sec">TEAM NEL PROGRAMMA</div>'
    +'<div class="set-opt'+(v==='cards'?' on':'')+'" onclick="setTeamView(\'cards\')"><input type="radio" '+(v==='cards'?'checked':'')+' style="width:20px;height:20px"> Scheda del team sotto ogni sessione</div>'
    +'<div class="set-opt'+(v==='highlight'?' on':'')+'" onclick="setTeamView(\'highlight\')"><input type="radio" '+(v==='highlight'?'checked':'')+' style="width:20px;height:20px"> Piloti del team evidenziati col colore del team</div>'
    +'<div class="set-opt'+(v==='both'?' on':'')+'" onclick="setTeamView(\'both\')"><input type="radio" '+(v==='both'?'checked':'')+' style="width:20px;height:20px"> Entrambi: scheda del team e piloti evidenziati</div>'
    +(teams.length?'<div class="set-sec">COLORI DEI TEAM</div>'+teams.map(t=>'<div style="margin-bottom:10px"><div style="font-size:13px;font-weight:800;margin-bottom:6px"><span class="tchip" style="--tc:'+teamColor(t.key)+'">'+String(t.name).replace(/</g,'&lt;')+'</span></div><div class="sw-row">'
      +TEAM_PALETTE.map(c=>'<span class="sw-dot'+(teamColor(t.key)===c?' on':'')+'" style="background:'+c+'" onclick="setTeamColor(\''+escAttr(t.key)+'\',\''+c+'\')"></span>').join('')+'</div></div>').join(''):'<div style="font-size:12px;color:var(--text4)">Nessun team aggiunto in questa gara.</div>')
    +'<div class="set-sec">LE MIE NOTIFICHE</div><div id="notif-prefs-body"></div>'
    +'<div style="margin-top:10px;font-size:11px;color:var(--text4)">Impostazioni del profilo '+currentUserId+'.</div>';
  renderNotifPrefs();try{renderPushDevice();}catch(e){}
  try{loadAiUsage();}catch(e){}
}
function openSettings(){
  if(!currentUserId){alert('Scegli prima il tuo utente.');return;}
  watchNotifPrefs();watchUserSettings();
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button><div class="modal-title">Impostazioni</div><div id="settings-body"></div>');
  renderSettings();
}
window.openSettings=openSettings;
let _lastDelayNotif=null;
setInterval(()=>{try{
  if(!activeRaceId||!currentUserId)return;
  const day=typeof autoDayName==='function'?autoDayName():activeDay;let arr=currentSchedule[day]||[];arr=Array.isArray(arr)?arr:Object.values(arr);
  const now=new Date();const nm=now.getHours()*60+now.getMinutes();const dl=scheduleDelay||0;
  arr.forEach(sl=>{const st=slotMins(sl.time)+dl;const left=st-nm;if(left<1||left>10)return;
    const ps=pilotsForSlot(sl);if(!ps.length)return;
    rtAlert('prossima|'+activeRaceId+'|'+day+'|'+sl.time+'|'+sl.label+'|'+JSON.stringify(sl.filter||''),'<i class="ic ic-timer"></i> Tra '+left+' min: '+sl.label+' '+(sl.session||''),'ore '+sl.time+(dl?' ('+(dl>0?'+':'')+dl+')':'')+' · '+ps.map(p=>'#'+p.num+' '+p.name).join(', '));});
  if(_lastDelayNotif===null)_lastDelayNotif=dl;
  else if(Math.abs(dl-_lastDelayNotif)>=5){rtAlert('ritardo|'+activeRaceId+'|'+day+'|'+dl+'|'+nm,'<i class="ic ic-wait"></i> Ritardo ora '+(dl>0?'+':'')+dl+' min','prima '+(_lastDelayNotif>0?'+':'')+_lastDelayNotif+' min');_lastDelayNotif=dl;}
}catch(e){}},30000);window.setTeamView=setTeamView;window.setTeamColor=setTeamColor;
setTimeout(watchUserSettings,3000);
// Piloti dei team seguiti, uno per uno con il colore del team (modalità "evidenzia")
/* 15/11/2026 (Andrea): piloti dei team seguiti (non miei) come elementi singoli, per raggrupparli con i miei */
let _progRunChip=null;
/* 19/11/2026 (Andrea): riga pilota del Programma con layout unico e fisso, uguale per miei piloti, piloti dei team e finali.
   Riga 1: numero, rischio, posizione, nome (una riga, tagliato se lungo), matita. Riga 2: team a sinistra, etichette a destra sempre nello stesso ordine. */
function progHead(o){
  return ['<div class="ph">',(o.top?['<div class="ph-0">',o.top,'</div>'].join(''):''),'<div class="ph-1"><span class="inner-num">#',o.num,'</span>',o.badges||'','<span class="inner-name">',o.name,'</span>',o.note||'','</div>',
    '<div class="ph-2"><span class="ph-team">',o.team||'','</span><span class="ph-chips">',o.chips||'','</span></div></div>'].join('');
}
function teamsHighlightItems(slot,ps,idx){
  const mine=new Set(ps.map(p=>String(p.num)));const out=[];
  teamsForSlot(slot).forEach(({t,inSlot})=>{const c=teamColor(t.key);
    inSlot.filter(p=>!mine.has(String(p.num))).forEach(p=>out.push({num:p.num,key:t.key,html:'<div class="card-inner tglow" style="--tc:'+c+'">'
      +progHead({num:p.num,name:String(p.name).replace(/</g,'&lt;'),team:String(t.name).replace(/</g,'&lt;'),note:noteBtn(p.num),badges:gridBadge(p.num,slot),
        chips:[(p.group?['<span class="inner-group">GRP ',p.group,'</span>'].join(''):''),(_progRunChip&&idx!=null?_progRunChip(p.num,idx):'')].join('')})
      +'<div class="tasks">'+TASKS.map(k=>teamPilotTaskBtn(p.num,k)).join('')+spotPill(p.num)+'</div>'
      +(teamNotes[t.key]?'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> '+teamNotes[t.key]+'</div>':'')+noteLine(p.num)+'</div>'}));});
  return out;
}
function teamsWaitingHtml(slot){
  return teamsForSlot(slot).map(({t,waiting})=>waiting.length?'<div style="font-size:10px;font-weight:800;margin:4px 0 8px;color:'+teamColor(t.key)+'"><i class="ic ic-wait"></i> '+String(t.name).replace(/</g,'&lt;')+': '+waiting.length+' in attesa</div>':'').join('');
}
/* 15/11/2026 (Andrea): 2 o piu' piloti dello stesso team seguito nello stesso turno = un riquadro unico in alto, senza linee in mezzo.
   Tutto il resto in ordine di numero. */
function groupSlotItems(items,keepOrder){
  const byNum=keepOrder?(()=>0):(a,b)=>(parseInt(a.num)||0)-(parseInt(b.num)||0);
  const cnt={};items.forEach(x=>{if(x.key)cnt[x.key]=(cnt[x.key]||0)+1;});
  // 15/11/2026 (Andrea): stile unico per tutti i piloti dei team seguiti: riquadro arrotondato con nome team, anche se e' uno solo
  const gk=teams.map(t=>t.key).filter(k=>cnt[k]>=1);
  const out=[];
  gk.forEach(k=>{const g=items.filter(x=>x.key===k).sort(byNum);const t=teams.find(x=>x.key===k)||{name:k};const c=teamColor(k);
    out.push('<div class="tgroup" style="--tc:'+c+'"><div class="tgroup-head"><span class="tchip" style="--tc:'+c+'">'+String(t.name).replace(/</g,'&lt;')+'</span>'+teamWorkChips(t)+'</div>'+g.map(x=>x.html.replace(' tglow','').replace(/<span class="tchip"[^>]*>[^<]*<\/span>/,'')).join('')+'</div>');});
  items.filter(x=>!x.key||!cnt[x.key]||!gk.includes(x.key)).sort(byNum).forEach(x=>out.push(x.html));
  return out.join('');
}
function teamsHighlightHtml(slot,ps){
  const mine=new Set(ps.map(p=>String(p.num)));
  return teamsForSlot(slot).map(({t,inSlot,waiting})=>{
    const c=teamColor(t.key);
    return inSlot.filter(p=>!mine.has(String(p.num))).map(p=>'<div class="card-inner tglow" style="--tc:'+c+'"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">'
      +'<span class="inner-num">#'+p.num+'</span>'+gridBadge(p.num,slot)+'<span class="inner-name">'+String(p.name).replace(/</g,'&lt;')+'</span>'
      +'<span class="tchip" style="--tc:'+c+'">'+String(t.name).replace(/</g,'&lt;')+'</span>'+noteBtn(p.num)+'</div>'
      +'<div class="tasks">'+TASKS.map(k=>teamPilotTaskBtn(p.num,k)).join('')+spotPill(p.num)+'</div>'
      +(teamNotes[t.key]?'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> '+teamNotes[t.key]+'</div>':'')+noteLine(p.num)+'</div>').join('')
      +(waiting.length?'<div style="font-size:10px;font-weight:800;margin:4px 0 8px;color:'+c+'"><i class="ic ic-wait"></i> '+String(t.name).replace(/</g,'&lt;')+': '+waiting.length+' in attesa</div>':'');
  }).join('');
}
setTimeout(watchNotifPrefs,3000);
// Avviso (solo titolare) se il server notifiche/monitor non aggiorna serverStatus/pc da più di 5 minuti
const SERVER_OWNER='andrea';let serverStat=null;
let _srvBadSince=0;
function renderServerBanner(){
  let b=document.getElementById('srv-banner');
  const stale=currentUserId===SERVER_OWNER&&serverStat!==null&&(!serverStat||!serverStat.at||Date.now()-serverStat.at>5*60000||serverStat.watcher===false);
  /* 15/11 (Andrea): l'avviso compare solo se il problema dura piu' di 1 minuto (all'apertura il dato puo' essere vecchio di qualche secondo) */
  if(!stale||document.visibilityState!=='visible'){_srvBadSince=0;if(!stale){_srvNetChk.res='';_srvNetChk.at=0;}if(b&&!stale)b.remove();return;}
  if(!_srvBadSince)_srvBadSince=Date.now();
  if(Date.now()-_srvBadSince<30000){if(b)b.remove();return;}
  if(!b){b=document.createElement('div');b.id='srv-banner';b.style.cssText='position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:9999;background:#b3261e;color:#fff;border-radius:10px;padding:10px 12px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.4)';document.body.appendChild(b);}
  const min=serverStat&&serverStat.at?Math.round((Date.now()-serverStat.at)/60000):null;
  /* 20/11/2026 (Andrea): prima di dire "server fermo" si chiede lo stato direttamente al database (senza la connessione
     dell'app). Se li' e' aggiornato, e' il telefono che non riceve: avviso diverso e ricollegamento automatico. */
  if(_srvNetChk.res==='app'){b.textContent='App non aggiornata da '+(min!==null?min+' min':'un po\'')+': connessione persa, mi ricollego… Se resta, ricarica l\'app.';}
  else b.textContent='Server notifiche fermo'+(min!==null?' da '+min+' min':'')+(serverStat&&serverStat.watcher===false?' (live non attivo)':'')+': le notifiche push non partono.';
  if(Date.now()-_srvNetChk.at>60000){_srvNetChk.at=Date.now();
    fetch('https://karting-tools-default-rtdb.firebaseio.com/serverStatus/pc.json?x='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(v=>{
      const fresh=v&&v.at&&Date.now()-v.at<5*60000&&v.watcher!==false;
      _srvNetChk.res=fresh?'app':'server';
      if(fresh){dlog('Stato server aggiornato sul database ma non nell\'app: mi ricollego','warn');try{_fbDb.goOffline();setTimeout(()=>{try{_fbDb.goOnline();}catch(_){}},800);}catch(_){}}
      renderServerBanner();}).catch(()=>{_srvNetChk.res='app';renderServerBanner();});}
}
const _srvNetChk={at:0,res:''};
setTimeout(()=>{if(currentUserId!==SERVER_OWNER)return;try{onValue(ref(db,'serverStatus/pc'),s=>{serverStat=s.val()||false;renderServerBanner();});}catch(e){}setInterval(renderServerBanner,5000);},5000);
function rtAlert(id,title,sub,kind){
  if(!notifOn(id))return;
  const log=alertLog();if(log.some(a=>a.id===id))return;
  const t=new Date();const hm=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
  log.unshift({id,title,sub,kind,hm,ts:Date.now()});
  try{localStorage.setItem(alertKey(),JSON.stringify(log.slice(0,300)));}catch(e){}
  try{if(currentUserId&&activeRaceId){const k=id.replace(/[.#$\[\]\/]/g,'_');const u={};u['alertsLog/'+activeRaceId+'/'+currentUserId+'/'+k]={id,title,sub,kind:kind||'',hm,ts:Date.now()};update(ref(db),u);}}catch(e){}
  let wrap=document.getElementById('rt-alerts');
  if(!wrap){wrap=document.createElement('div');wrap.id='rt-alerts';wrap.className='rt-alerts';document.body.appendChild(wrap);}
  const el=document.createElement('div');el.className='rt-alert '+(kind||'');
  el.innerHTML='<div style="flex:1">'+title+'<small>'+sub+' · '+hm+'</small></div><span style="cursor:pointer;font-size:16px"><i class="ic ic-close"></i></span>';
  el.onclick=()=>el.remove();wrap.prepend(el);
  setTimeout(()=>{if(el.parentNode)el.remove();},kind==='final'||kind==='gold'?60000:25000);
  try{if(userSettings.vibra!==false&&navigator.vibrate)navigator.vibrate(kind?[300,150,300,150,300]:[200,100,200]);}catch(e){}
  if(userSettings.suono!==false)rtChime(kind);
  try{if('Notification' in window&&Notification.permission==='granted'&&navigator.serviceWorker){navigator.serviceWorker.ready.then(r=>r.showNotification(title.replace(/<[^>]+>/g,''),{body:sub,tag:id,renotify:true,vibrate:[300,150,300]}));}}catch(e){}
  renderAlertLog();
}
window.rtAlert=rtAlert;
// Suono generato (nessun file esterno): campanella morbida con armoniche e coda,
// arpeggio ascendente per pole e finale, due note per gli altri avvisi.
let _rtAudio=null;
function rtChime(kind){
  try{
    _rtAudio=_rtAudio||new (window.AudioContext||window.webkitAudioContext)();
    const a=_rtAudio;if(a.state==='suspended')a.resume();
    const master=a.createGain();master.gain.value=0.35;master.connect(a.destination);
    const notes=(kind==='gold'||kind==='final')?[783.99,987.77,1174.66,1567.98]:kind?[880,1318.51]:[659.25,987.77];
    notes.forEach((f,i)=>{
      const t=a.currentTime+i*0.11;
      [[1,1],[2,0.28],[3,0.12]].forEach(([mult,vol])=>{
        const o=a.createOscillator();const g=a.createGain();
        o.type='sine';o.frequency.value=f*mult;
        g.gain.setValueAtTime(0.0001,t);
        g.gain.exponentialRampToValueAtTime(vol,t+0.012);
        g.gain.exponentialRampToValueAtTime(0.0001,t+(i===notes.length-1?1.4:0.6));
        o.connect(g);g.connect(master);o.start(t);o.stop(t+1.5);
      });
    });
  }catch(e){}
}
window.rtChime=rtChime;
// Permesso notifiche chiesto in modo discreto al primo tocco nell'app (serve un gesto dell'utente)
function askNotifOnce(){
  try{
    if(!('Notification' in window)||Notification.permission!=='default')return;
    if(sessionStorage.getItem('rt_notif_asked')==='1')return;
    sessionStorage.setItem('rt_notif_asked','1');
    Notification.requestPermission().then(p=>{updateNotifBtn();if(p==='granted')subscribePush();});
  }catch(e){}
}
// ── Iscrizione alle notifiche push del server (chiave pubblica VAPID: non è un segreto) ──
const PUSH_PUBLIC_KEY='BD_R-eZh5lukTHhIS5Vnp2RYrswxR9v_zGMZACft8Ump8f_3y3zAMztHzA8j9Zc7hl6XXOale3zVCBn46VKSEpw';
function b64ToU8(b){const p='='.repeat((4-b.length%4)%4);const s=atob((b+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...s].map(c=>c.charCodeAt(0)));}
function subKey(ep){let h=0;for(let i=0;i<ep.length;i++){h=((h<<5)-h+ep.charCodeAt(i))|0;}return'k'+(h>>>0).toString(36)+ep.length;}
async function subscribePush(){
  try{
    if(!currentUserId||!('serviceWorker' in navigator)||!('PushManager' in window)||Notification.permission!=='granted')return;
    try{if(localStorage.getItem('rt_push_off')==='1')return;}catch(e){}
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToU8(PUSH_PUBLIC_KEY)});
    const j=sub.toJSON();
    const u={};u['pushSubs/'+currentUserId+'/'+subKey(j.endpoint)]={sub:j,ua:navigator.userAgent.slice(0,120),at:new Date().toISOString()};
    update(ref(db),u);
  }catch(e){console.warn('push',e);}
}
window.subscribePush=subscribePush;
// ── Pulsante "notifiche su questo telefono" (Impostazioni): attiva anche se all'inizio è stato detto no, oppure disattiva ──
async function pushDeviceState(){
  if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window))return'nosupport';
  const p=Notification.permission;if(p==='denied')return'denied';if(p==='default')return'ask';
  try{if(localStorage.getItem('rt_push_off')==='1')return'off';}catch(e){}
  try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();return sub?'on':'off';}catch(e){return'off';}
}
async function renderPushDevice(){
  const b=document.getElementById('push-device');if(!b)return;const st=await pushDeviceState();
  const btn=(lbl,fn,col)=>'<button onclick="'+fn+'" style="width:100%;min-height:48px;margin-top:6px;border-radius:10px;border:none;font-weight:900;font-size:15px;cursor:pointer;background:'+col+';color:#000">'+lbl+'</button>';
  const txt={on:'<i class="ic ic-check"></i> Attive su questo telefono',off:'<i class="ic ic-belloff"></i> Spente su questo telefono',ask:'<i class="ic ic-bell"></i> Non ancora attivate su questo telefono',denied:'<i class="ic ic-ban"></i> Bloccate dal telefono',nosupport:'Questo browser non riceve notifiche'}[st];
  let h='<div style="font-size:14px;font-weight:800">'+txt+'</div>';
  if(st==='on')h+=btn('Disattiva su questo telefono','pushDeviceOff()','#94a3b8');
  if(st==='off'||st==='ask')h+=btn('Attiva notifiche su questo telefono','pushDeviceOn()','#22c55e');
  if(st==='denied')h+='<div style="font-size:12px;color:var(--text3);margin-top:6px;line-height:1.5">Le hai rifiutate: il telefono non permette all\'app di chiederlo di nuovo.<br><b>iPhone:</b> Impostazioni › Notifiche › Race Tracker › Consenti notifiche.<br><b>Android:</b> tieni premuta l\'icona dell\'app › Info app › Notifiche › attiva.<br>Poi riapri l\'app e premi qui sotto.</div>'+btn('Ho dato il permesso, riprova','pushDeviceOn()','#22c55e');
  if(st==='nosupport')h+='<div style="font-size:12px;color:var(--text3);margin-top:6px">Su iPhone aggiungi l\'app alla schermata Home (Condividi › Aggiungi a Home) e aprila da lì.</div>';
  b.innerHTML=h;
}
async function pushDeviceOn(){
  try{localStorage.removeItem('rt_push_off');}catch(e){}
  try{if(Notification.permission!=='granted'){const p=await Notification.requestPermission();if(p!=='granted'){renderPushDevice();return;}}}catch(e){}
  await subscribePush();try{updateNotifBtn();}catch(e){}renderPushDevice();
}
async function pushDeviceOff(){
  try{localStorage.setItem('rt_push_off','1');}catch(e){}
  // la disiscrizione rende l'indirizzo push non valido: il server smette di usarlo da solo
  try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();}catch(e){}
  renderPushDevice();
}
window.pushDeviceOn=pushDeviceOn;window.pushDeviceOff=pushDeviceOff;
setTimeout(subscribePush,4000);
document.addEventListener('click',askNotifOnce,{once:true,capture:true});
function enableRtNotifications(){try{sessionStorage.removeItem('rt_notif_asked');}catch(e){}askNotifOnce();}
window.enableRtNotifications=enableRtNotifications;
// Solo un'indicazione piccola, e solo se le notifiche non sono attive
function updateNotifBtn(){
  const h=document.getElementById('notif-hint');if(!h)return;
  if(!('Notification' in window)){h.innerHTML='<i class="ic ic-belloff"></i> notifiche: installa la PWA';return;}
  const p=Notification.permission;
  h.innerHTML=p==='granted'?'':p==='denied'?'<i class="ic ic-belloff"></i> notifiche bloccate nelle impostazioni del browser':'<span onclick="enableRtNotifications()" style="cursor:pointer;text-decoration:underline"><i class="ic ic-belloff"></i> attiva notifiche</span>';
}
let alertLogOpen=true;
// ── RISCHIO ELIMINAZIONE (stima) ──
// Punti manche/prefinale: 1° = 0, 2° = 2, 3° = 3… (Art.13). Taglio per gara e categoria (races/<gara>/riskCut/<cat>):
// di base 36 (finale) se la categoria ha almeno 37 piloti, altrimenti nessuna eliminazione.
let riskCutCfg={};
const rkPts=p=>{p=parseInt(p);return isNaN(p)?null:(p===1?0:p);};
function riskCutOf(cat,n){const v=riskCutCfg[cat];if(v===0||v==='0')return 0;if(v)return+v;return n>=37?36:0;}
/* 14/11/2026: formati senza prefinali (es. Rotax Grand Finals: manche → finale). Si guarda il programma della gara. */
function catHasPF(cat){try{const c=canonCat(cat);return(currentDays||[]).some(d=>Object.values(currentSchedule[d]||{}).some(s=>s&&s.type==='prefinal'&&canonCat(s.cat)===c));}catch(e){return true;}}
function riskData(){
  const byCat={};
  Object.entries(currentEntryList||{}).forEach(([num,e])=>{if(!e||!e.cat)return;(byCat[e.cat]=byCat[e.cat]||[]).push([num,e]);});
  const myNums=new Set(pilots.map(p=>String(p.num)));const out=[];
  Object.entries(byCat).forEach(([cat,list])=>{
    const cut=riskCutOf(cat,list.length);
    // 15/11/2026: ritirato / non classificato ('—') = gara fatta, punti da ultimo (prima risultava 'manca')
    const rkP=v=>{const x=rkPts(v);if(x!==null)return x;return(v!==undefined&&v!==null&&String(v).trim()!=='')?list.length:null;};
    const rows=list.map(([num,e])=>{let h=e.heats||[];if(!Array.isArray(h))h=Object.values(h);const res=e.result||{};
      let pts=0,done=0;h.forEach(k=>{const v=rkP(res[k]);if(v!==null){pts+=v;done++;}});
      const pfDone=!catHasPF(cat)||['PF-A','PF-B'].some(k=>rkP(res[k])!==null);if(pfDone&&catHasPF(cat)){const k=rkP(res['PF-A'])!==null?'PF-A':'PF-B';pts+=rkP(res[k]);done++;}
      const left=Math.max(0,h.length-(done-(pfDone&&catHasPF(cat)?1:0)))+(pfDone?0:1);
      const heatsLeft=h.filter(k=>rkP(res[k])===null);
      return{num,e,pts,done,left,heatsLeft,pfDone,avg:done?pts/done:list.length/2};}).filter(r=>r.done>0);
    if(!rows.length||!cut){if(list.some(([n])=>myNums.has(n)))out.push({cat,cut,none:true,n:list.length});return;}
    rows.sort((a,b)=>a.pts-b.pts);rows.forEach((r,i)=>r.rank=i+1);
    const field=Math.ceil(list.length/2)+2; // piloti per gara (manche a gruppi / prefinale)
    rows.filter(r=>myNums.has(r.num)).forEach(r=>{
      let need=null;
      if(r.left>0){for(let p=field;p>=1;p--){const mine=r.pts+rkPts(p)*r.left;let rank=1;rows.forEach(o=>{if(o!==r&&o.pts+o.avg*o.left<mine)rank++;});if(rank<=cut){need=p;break;}}}
      const status=r.left===0?(r.rank<=cut?'safe':'out'):(need===null?'out':need>=Math.ceil(field*0.8)?'safe':'risk');
      const _res=r.e.result||{};const poss=Object.keys(_res).filter(k=>/^[A-H]-[A-H]$|^H\d$|^PF-/.test(k)).map(k=>parseInt(_res[k])).filter(v=>v>0);
      out.push({cat,cut,poss,heatsLeft:r.heatsLeft,pfDone:r.pfDone,pf:String(r.e.prefinal||'').toUpperCase(),num:r.num,name:(pilots.find(p=>String(p.num)===r.num)||{}).name||((r.e.lastName||'')+' '+(r.e.firstName||'')).trim(),pts:r.pts,rank:r.rank,left:r.left,need,status,n:list.length});
    });
  });
  return out;
}
/* gare che mancano a un pilota e prossima gara dal programma */
function riskSafeBlock(d,esc){
  const sf=d.filter(x=>!x.none&&x.status==='safe').sort((a,b)=>String(a.cat).localeCompare(String(b.cat))||a.rank-b.rank);
  if(!sf.length)return'';
  return'<details style="margin-top:14px"><summary style="cursor:pointer;font-size:12px;font-weight:800;letter-spacing:1px;color:var(--text4);padding:8px 0">NON A RISCHIO · '+sf.length+' piloti</summary>'
    +sf.map(x=>'<div style="display:flex;gap:10px;align-items:baseline;font-size:13px;color:var(--text3);padding:5px 2px;border-top:1px solid var(--border)"><span style="color:#22c55e;font-weight:900;min-width:34px">'+x.rank+'°</span><span style="flex:1">#'+esc(x.num)+' '+esc(x.name)+'</span><span style="color:var(--text4);font-size:11px">'+esc(x.cat)+'</span></div>').join('')+'</details>';
}
/* 14/11 21:50 (Andrea): percentuale di rischio di NON entrare in finale, stimata dalle posizioni fatte finora
   (media e regolarita' del pilota) rispetto alla posizione che deve ottenere. Solo stima, le posizioni non si mostrano. */
function _ncdf(z){const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2);let pr=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-pr:pr;}
function riskPct(x){
  if(x.status==='out')return 100;
  if(!x.left)return x.status==='safe'?0:100;
  if(x.need==null)return 100;
  const field=Math.ceil((x.n||40)/2)+2,ps=(x.poss||[]).filter(v=>v>0),k=ps.length;
  let mu=k?ps.reduce((a,b)=>a+b,0)/k:field/2;
  let sd=k>1?Math.sqrt(ps.reduce((a,b)=>a+(b-mu)*(b-mu),0)/(k-1)):field/4;
  sd=Math.max(sd,field/8);mu=(mu*k+field/2)/(k+1);
  const se=sd/Math.sqrt(Math.max(1,x.left));
  const ok=_ncdf((x.need+0.5-mu)/se);
  return Math.round(Math.min(95,Math.max(1,(1-ok)*100))); // stima: mai 0 o 100 se c'e' ancora una gara
}
function riskColor(p){return p<25?'#22c55e':p<50?'#facc15':p<75?'#f97316':'#ef4444';}
function riskRing(p){const c=riskColor(p),r=15,L=2*Math.PI*r,f=Math.max(0.02,p/100)*L;
  return'<div title="Rischio stimato di non entrare in finale" style="position:relative;width:40px;height:40px;flex-shrink:0"><svg width="40" height="40" viewBox="0 0 40 40" style="transform:rotate(-90deg)"><circle cx="20" cy="20" r="'+r+'" fill="none" stroke="var(--bg3)" stroke-width="5"/><circle cx="20" cy="20" r="'+r+'" fill="none" stroke="'+c+'" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+f.toFixed(1)+' '+L.toFixed(1)+'"/></svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:\'Chakra Petch\',sans-serif;font-size:11px;font-weight:700;color:'+c+'">'+p+'%</div></div>';}
function riskLeftTxt(x){const h=(x.heatsLeft||[]);const p=[];if(h.length)p.push(h.length===1?'manche '+h[0]:h.length+' manche ('+h.join(', ')+')');if(!x.pfDone)p.push('prefinale'+(x.pf?' '+x.pf:''));return p.join(' + ');}
function riskNext(x){
  const h=x.heatsLeft||[];
  const label=h.length?'manche '+h[0]:'prefinale'+(x.pf?' '+x.pf:'');
  const art=h.length?'nella manche '+h[0]:'in prefinale'+(x.pf?' '+x.pf:'');
  try{
    const today=typeof autoDayName==='function'?autoDayName():'';
    for(const d of (currentDays||[])){
      for(const sv of Object.values(currentSchedule[d]||{})){
        if(!sv||canonCat(sv.cat)!==canonCat(x.cat))continue;
        const ok=h.length?(sv.type==='group'&&slotKeyOf(sv)===h[0]):(sv.type==='prefinal'&&(!x.pf||String(sv.filter||'').trim().toUpperCase()===x.pf));
        if(ok)return{label,art,when:(d===today?'oggi ':d.charAt(0)+d.slice(1,3).toLowerCase()+' ')+sv.time};
      }
    }
  }catch(e){}
  return{label,art,when:''};
}
function setRiskCut(cat){if(!isDelayAdmin())return;const v=prompt('Taglio per '+cat+' (posizione minima per non essere eliminati, 0 = nessuna eliminazione):',String(riskCutOf(cat,99)));if(v===null)return;const n=parseInt(v);if(isNaN(n)||n<0)return;riskCutCfg[cat]=n;saveSharedField('riskCut',riskCutCfg);renderAlertLog();}
window.setRiskCut=setRiskCut;
/* 14/11/2026: scheda ELIMINAZIONI con sotto-schede A RISCHIO / ELIMINATI */
let riskSub=(function(){try{const v=localStorage.getItem('rt_risksub');return v==='pf'?'pf':'fin';}catch(e){return'fin';}})();
function setRiskSub(v){riskSub=v;try{localStorage.setItem('rt_risksub',v);}catch(e){}renderAlertLog();}
window.setRiskSub=setRiskSub;
/* 14/11 17:45 (Andrea): due schede separate, PREFINALE e FINALE, cosi' non sembra che chi e' "fuori zona finale" non vada in prefinale.
   PREFINALE = ammissione alle prefinali (ufficiale dalle liste Prefinale A/B); FINALE = rischio di non entrare in finale (stima + ufficiale). */
function renderRiskTab(){
  const pf=riskSub==='pf';
  const sw='<div class="pv-switch" style="margin-bottom:10px"><button class="pv-btn'+(pf?' active':'')+'" onclick="setRiskSub(\'pf\')">PREFINALE</button><button class="pv-btn'+(!pf?' active':'')+'" onclick="setRiskSub(\'fin\')">FINALE</button></div>';
  return sw+(pf?renderPfTab():renderRiskList()+renderElimList());
}
function pfOf(p){const e=(currentEntryList||{})[p.num]||{};return String(e.prefinal||p.prefinal||'').trim().toUpperCase();}
/* 21/11/2026 (Andrea): PREVISIONE prefinali finche' non escono le liste ufficiali.
   Regolamento WSK 2026 art. 11: penalita' per manche 0/5/8/9/10 per i primi 5, poi +1 a posizione; non partito = partenti+6.
   Confronto alla pari con la media penalita' per manche; a pari merito vale la qualifica.
   Dal 37° verificato: i primi 72 vanno in prefinale, 1° in A, 2° in B, 3° in A... (dispari A, pari B). E' una stima. */
function pfForecast(cat){
  const el=currentEntryList||{},C=canonCat(cat),isH=k=>/^[A-H]-[A-H]$/.test(k);
  const ents=Object.entries(el).filter(([n,e])=>e&&canonCat(e.cat)===C);
  const size={};ents.forEach(([n,e])=>Object.keys(e.result||{}).filter(isH).forEach(k=>{size[k]=(size[k]||0)+1;}));
  const done=Object.keys(size);if(!done.length)return null;
  const rows=ents.map(([n,e])=>{const g=normalizeGroup(e.group||'');const hs=Array.isArray(e.heats)?e.heats:Object.values(e.heats||{});
    let pts=0,cnt=0;done.forEach(k=>{const r=(e.result||{})[k];const mine=hs.includes(k)||(g&&k.split('-').includes(g));if(!mine&&!r)return;
      const v=parseInt(r);pts+=isNaN(v)?size[k]+6:(v===1?0:v===2?5:v===3?8:v===4?9:v+5);cnt++;});
    const q=Math.min(...Object.entries(e.result||{}).filter(([k])=>/^Q/.test(k)).map(([,v])=>parseInt(v)).filter(x=>!isNaN(x)),999);
    return{n,cnt,pts,avg:cnt?pts/cnt:999,q};}).filter(r=>r.cnt);
  rows.sort((a,b)=>a.avg-b.avg||a.q-b.q);
  const out={total:rows.length,heats:done.length,pos:{}};rows.forEach((r,i)=>{out.pos[r.n]={rk:i+1,cnt:r.cnt,pts:r.pts};});
  /* 21/11/2026 (Andrea): rischio eliminazione in %. Art. 11 WSK: oltre 72 piloti passano i primi 72, altrimenti entrano tutti.
     Simulazione delle manche che mancano: ogni pilota ripete i suoi piazzamenti (±3 posizioni), classifica sui punti totali. */
  try{
    out.cut=rows.length>72?72:0;
    if(out.cut){
      const pen=(v,sz)=>v===1?0:v===2?5:v===3?8:v===4?9:v>sz?sz+6:v+5;
      const sizes=Object.values(size),avgSz=Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length)||30;
      const slots=[];Object.values(currentSchedule||{}).forEach(L=>[].concat(L||[]).forEach(x=>{if(x&&x.type==='group'&&canonCat(x.cat)===C){const f=(Array.isArray(x.filter)?x.filter:Object.values(x.filter||{})).map(y=>String(y).trim().toUpperCase()).sort().join('-');if(f&&!slots.includes(f))slots.push(f);}}));
      const info=rows.map(r=>{const e=el[r.n]||{},g=normalizeGroup(e.group||'');const past=done.map(k=>parseInt((e.result||{})[k])).filter(v=>!isNaN(v));
        const left=g?slots.filter(k=>!done.includes(k)&&k.split('-').includes(g)).length:-1;return{n:r.n,pts:r.pts,q:r.q,past,left,cnt:r.cnt};});
      /* senza gruppo noto: manche che mancano = totale tipico degli altri meno quelle gia' corse (prima restavano a 0 e sembravano al sicuro) */
      const tots=info.filter(x=>x.left>=0).map(x=>x.cnt+x.left).sort((a,b)=>a-b),typ=tots.length?tots[Math.floor(tots.length/2)]:0;
      info.forEach(x=>{if(x.left<0)x.left=Math.max(0,typ-x.cnt);});
      const N=400,bad={};info.forEach(x=>{bad[x.n]=0;});
      if(info.some(x=>x.left)){
        for(let it=0;it<N;it++){
          const tot=info.map(x=>{let t=x.pts;for(let j=0;j<x.left;j++){const b=x.past.length?x.past[Math.floor(Math.random()*x.past.length)]:1+Math.floor(Math.random()*avgSz);
            const v=Math.max(1,Math.min(avgSz+1,b+Math.floor(Math.random()*7)-3));t+=pen(v,avgSz);}return[x.n,t,x.q];});
          tot.sort((a,b)=>a[1]-b[1]||a[2]-b[2]);tot.forEach((x,i)=>{if(i>=out.cut)bad[x[0]]++;});
        }
        info.forEach(x=>{out.pos[x.n].risk=Math.round(100*bad[x.n]/N);out.pos[x.n].left=x.left;});
      }else info.forEach(x=>{out.pos[x.n].risk=out.pos[x.n].rk>out.cut?100:0;out.pos[x.n].left=0;});
    }
  }catch(e){}
  return out;}
function renderPfTab(){
  const esc=x=>String(x||'').replace(/</g,'&lt;');
  const cats=[...new Set(pilots.map(p=>p.cat).filter(Boolean))].sort();
  if(!cats.length)return'<div style="font-size:13px;color:var(--text4);padding:8px 0">Nessun tuo pilota.</div>';
  const h=['<div style="font-size:12px;color:var(--text3);background:var(--bg3);border-radius:10px;padding:9px 12px;margin-bottom:10px">Chi entra nelle <b>prefinali</b>: dalle liste ufficiali Prefinale A/B (dopo la Classifica Intermedia).</div>'];
  cats.forEach(cat=>{
    const ps=pilots.filter(p=>p.cat===cat);
    if(!catHasPF(cat)){h.push('<div class="set-sec">'+esc(cat)+' <span style="font-weight:700;color:var(--text4)">· nessuna prefinale nel programma</span></div>');return;}
    const FC=pfForecast(cat);
    const rows=ps.map(p=>{const g=pfOf(p);const st=g?'in':(p.eliminated?'out':'wait');return{p,g,st,f:FC&&FC.pos[String(p.num)]};}).sort((a,b)=>({out:0,wait:1,in:2}[a.st]-{out:0,wait:1,in:2}[b.st])||((b.f&&b.f.risk||0)-(a.f&&a.f.risk||0))||((b.f?b.f.rk:0)-(a.f?a.f.rk:0))||(+a.p.num)-(+b.p.num));   /* 21/11/2026 (Andrea): in ordine di rischio, come per la finale: piu' a rischio in cima */
    const nIn=rows.filter(r=>r.st==='in').length;
    h.push('<div class="set-sec">'+esc(cat)+' <span style="font-weight:700;color:var(--text4)">· '+(rows.some(r=>r.st!=='wait')?nIn+'/'+rows.length+' in prefinale':FC?'previsione dopo '+FC.heats+' manche corse':'liste non ancora pubblicate')+'</span></div>');
    /* 21/11/2026 (Andrea): come la scheda finale — numero grande a sinistra, colore del rischio, piu' a rischio in cima,
       i sicuri (0%, gia' in prefinale o categoria senza eliminazioni) tutti insieme in fondo, chiusi */
    const card=r=>{let col={in:'#22c55e',out:'#ef4444',wait:'#6b7280'}[r.st],big=r.st==='in'?esc(r.g):r.st==='out'?'<i class="ic ic-close"></i>':'–';
      let t=r.st==='in'?'In <b>prefinale '+esc(r.g)+'</b> (ufficiale)':r.st==='out'?'Non ammesso in prefinale (ufficiale)':'In attesa delle liste prefinali',sub='';
      if(r.st==='wait'&&r.f){const rk=r.f.rk,pr=FC.cut?(r.f.risk??(rk>FC.cut?100:0)):0;big=rk+'°';
        col=FC.cut?riskColor(pr):'#22c55e';
        t=(FC.cut?'<span style="color:'+riskColor(pr)+';font-weight:900">Rischio eliminazione '+pr+'%</span> · ':'<span style="color:#22c55e;font-weight:800">Entrano tutti ('+FC.total+' piloti)</span> · ')+(FC.cut&&rk>FC.cut?'oggi <b>fuori dai primi '+FC.cut+'</b>':'previsione <b>Prefinale '+(rk%2?'A':'B')+'</b>');
        sub=rk+'° su '+FC.total+' · '+r.f.pts+' penalità in '+r.f.cnt+' manche'+(r.f.left?' · '+r.f.left+' da correre':' · manche finite')+(FC.cut?' · passano i primi '+FC.cut:'')+' · stima';}
      return'<div class="card-inner al-row" style="border-left:4px solid '+col+'"><div class="al-time" style="font-size:18px;font-weight:900">'+big+'</div><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900">#'+esc(r.p.num)+' '+esc(r.p.name)+'</div><div style="font-size:13px;color:var(--text2);margin-top:2px">'+t+'</div>'+(sub?'<div style="font-size:11px;color:var(--text4);margin-top:2px">'+sub+'</div>':'')+'</div></div>';};
    const isSafe=r=>r.st==='in'||(r.st==='wait'&&r.f&&(!FC.cut||!(r.f.risk??(r.f.rk>FC.cut?100:0))));
    const risky=rows.filter(r=>!isSafe(r)),safe=rows.filter(isSafe);
    risky.forEach(r=>h.push(card(r)));
    if(!risky.length&&safe.length)h.push('<div style="font-size:12px;color:var(--text4);padding:4px 0 6px">Nessun tuo pilota a rischio.</div>');
    if(safe.length)h.push('<details style="margin:4px 0 10px"><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:13px;font-weight:800;color:#22c55e"><i class="ic ic-check"></i> '+safe.length+(safe.length===1?' pilota al sicuro':' piloti al sicuro')+'</summary>'+safe.map(card).join('')+'</details>');
  });
  return h.join('');
}
function renderElimList(){
  const esc=x=>String(x||'').replace(/</g,'&lt;');
  const off=pilots.filter(p=>p.eliminated&&pfOf(p));const offN=new Set(off.map(p=>String(p.num)));
  if(!off.length)return'';
  const h=['<div class="set-sec" style="margin-top:14px">FUORI DALLA FINALE · ufficiale</div>'];
  off.sort((a,b)=>String(a.cat).localeCompare(String(b.cat))||(+a.num)-(+b.num)).forEach(p=>h.push('<div class="card-inner al-row" style="border-left:4px solid #ef4444"><div class="al-time" style="font-size:13px;font-weight:900">'+esc(p.cat)+'</div><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900">#'+esc(p.num)+' '+esc(p.name)+'</div><div style="font-size:13px;color:var(--text2)">Non in finale (ufficiale) · ha corso la prefinale '+esc(pfOf(p))+'</div></div></div>'));
  return h.join('');
}
function renderRiskList(){
  const d=riskData(); /* 14/11: anche i 'fuori anche vincendo (stima)' restano qui, in cima */const esc=x=>String(x||'').replace(/</g,'&lt;');
  if(!d.length)return'<div style="font-size:13px;color:var(--text4);padding:8px 0">Nessun dato: servono i risultati delle manche.</div>';
  const cats=[...new Set(d.map(x=>x.cat))];const col={risk:'#f59e0b',out:'#ef4444',safe:'#22c55e'};
  return'<div style="font-size:12px;color:var(--text3);background:var(--bg3);border-radius:10px;padding:9px 12px;margin-bottom:10px">Chi rischia di non entrare in <b>finale</b>. Stima dai risultati di manche e prefinale (punti 1°=0, 2°=2, 3°=3…), con la media degli altri proiettata sulle gare che mancano. Non è un dato ufficiale.</div>'
    +cats.map(cat=>{const xs=d.filter(x=>x.cat===cat);const c0=xs[0];
      const head='<div class="set-sec" style="display:flex;align-items:center;gap:8px">'+esc(cat)+' <span style="font-weight:700;color:var(--text4)">· '+(c0.cut?'in finale i primi '+c0.cut:'nessuna eliminazione')+' · '+c0.n+' piloti</span>'+(isDelayAdmin()?'<button onclick="setRiskCut(\''+escAttr(cat)+'\')" style="margin-left:auto;min-height:36px;padding:0 10px;border-radius:8px;border:1px solid var(--border2);background:none;color:var(--text3);font-weight:800;cursor:pointer">TAGLIO</button>':'')+'</div>';
      if(c0.none)return head;
      /* 14/11 16:15 (Andrea): i verdi (non a rischio) non sporcano la lista: tutti insieme in fondo, chiusi */
      const xr=xs.filter(x=>!x.none&&x.status!=='safe');
      if(!xr.length)return head+'<div style="font-size:12px;color:var(--text4);padding:4px 0 10px">Nessun tuo pilota a rischio.</div>';
      return head+xr.sort((a,b)=>({out:0,risk:1,safe:2}[a.status]-{out:0,risk:1,safe:2}[b.status])||riskPct(b)-riskPct(a)||a.rank-b.rank).map(x=>{
        /* 14/11 15:35 (Andrea: testi poco chiari): si dice per COSA rischia (finale), quali gare mancano e la prossima con orario */
        const nx=riskNext(x);const many=x.left>1;
        const t=x.status==='out'?(x.left?'Fuori dalla finale anche vincendo (stima)':'Fuori dalla finale (stima)')
          :x.status==='safe'?(x.left?(x.need>=Math.ceil(x.n/2)+2?'In finale anche arrivando ultimo (stima)':'In finale se arriva almeno P'+x.need+(many?' di media':'')+' (stima)'):'In finale (stima)')
          :'Rischia la <b>FINALE</b>: deve arrivare almeno <b>P'+x.need+'</b> '+(many?'di media nelle '+x.left+' gare che mancano':nx.art);
        const _pp=pilots.find(p=>String(p.num)===String(x.num));const _pg=_pp?pfOf(_pp):'';
        const sub=(_pg?'<span style="color:#22c55e;font-weight:800">In prefinale '+_pg+' (ufficiale)</span> · ':'')+(x.left?'Manca: '+riskLeftTxt(x)+(nx.when?' · prossima '+nx.label+' '+nx.when:''):'Gare finite')+' · '+x.pts+' punti';
        const _rp=riskPct(x);
        return'<div class="card-inner al-row" style="border-left:4px solid '+riskColor(_rp)+'"><div class="al-time" style="font-size:18px;font-weight:900">'+x.rank+'°</div><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900">#'+esc(x.num)+' '+esc(x.name)+'</div><div style="font-size:13px;color:var(--text2);margin-top:2px">'+t+'</div><div style="font-size:11px;color:var(--text4);margin-top:2px">'+sub+'</div></div>'+riskRing(_rp)+'</div>';}).join('');
    }).join('')+riskSafeBlock(d,esc);
}
function toggleAlertLog(){alertLogOpen=!alertLogOpen;renderAlertLog();}
window.toggleAlertLog=toggleAlertLog;
let alertFilter='all';
function setAlertFilter(f){alertFilter=f;renderAlertLog();}
window.setAlertFilter=setAlertFilter;
function alertType(a){
  if(a.id.startsWith('quali|'))return'quali';
  if(a.id.startsWith('elim|'))return'elim';
  if(a.kind==='final')return'final';
  return'race';
}
function renderAlertLog(){
  const box=document.getElementById('alert-log');if(!box)return;
  updateNotifBtn();
  if(!alertLogOpen){box.style.display='none';return;}
  // Solo avvisi dei piloti che sono ADESSO tra i miei (il numero è nel penultimo/ultimo campo dell'id)
  const myNums=new Set(pilots.map(p=>String(p.num)));
  const alNum=a=>{const m=String(a.title||'').match(/#(\d+)/);return m?m[1]:'';};
  const log=alertLog().filter(a=>{const n=alNum(a);return!n||!myNums.size||myNums.has(n);}).sort((x,y)=>(y.ts||0)-(x.ts||0));box.style.display='';
  const cleanSub=t=>String(t||'').replace(/\s*·?\s*PROVVISORIO,?\s*verifica (eventuali )?reclami/ig,'').replace(/\s*·?\s*verifica (eventuali )?reclami/ig,'').replace(/^\s*·\s*|\s*·\s*$/g,'');
  const h=[];
  h.push('<div class="pv-switch" style="margin-bottom:10px"><button class="pv-btn'+(alertFilter!=='risk'?' active':'')+'" onclick="setAlertFilter(\'all\')">AVVISI</button><button class="pv-btn'+(alertFilter==='risk'?' active':'')+'" onclick="setAlertFilter(\'risk\')">ELIMINAZIONI</button></div>');
  if(alertFilter==='risk'){h.push(renderRiskTab());box.innerHTML=h.join('');return;}
  h.push('<div style="font-size:13px;font-weight:600;color:var(--text3);background:var(--bg3);border-radius:10px;padding:9px 12px;margin-bottom:10px">Gli avvisi sono provvisori: verifica eventuali reclami.</div>');
  if(!log.length)h.push('<div style="font-size:13px;color:var(--text4);padding:8px 0">Nessun avviso</div>');
  log.forEach(a=>{const c={quali:'#facc15',final:'#22c55e',elim:'#ef4444',race:'#60a5fa'}[alertType(a)];const sub=cleanSub(a.sub);
    h.push(`<div class="card-inner al-row" style="border-left:4px solid ${c}"><div class="al-time">${a.hm||''}</div><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900;line-height:1.3">${a.title}</div>${sub?`<div style="font-size:12px;color:var(--text4);margin-top:4px">${sub}</div>`:''}</div></div>`);});
  box.innerHTML=h.join('');
}
let _ltRenderT=null;
// Ritirati: colonna stato Apex (si = ai box, ss = fermo in pista; so/sr/su/sd = di nuovo in pista). Conta solo a sessione partita e prima dell'arrivo.
const ltRet={},ltRan={};
function ltIsRace(){return/HEAT|MANCHE|PREFINAL|FINAL|RACE|GARA/i.test(apexState.sess||'')&&!/QUALIF|PRACT|FREE|WARM/i.test(apexState.sess||'');}
function ltScanNoLap(){ // in gara: senza posizione e "No Lap" = non ha completato la gara (vale anche a sessione finita o app aperta dopo)
  try{if(!ltIsRace())return;const head=apexGrid.querySelector('tr[data-id="r0"]');if(!head)return;const col={};
    head.querySelectorAll('td[data-type]').forEach(td=>col[td.getAttribute('data-type')]=(td.getAttribute('data-id')||'').replace('c',''));
    if(!col.no||!col.rk)return;const sk=apexState.cat+'|'+apexState.sess;
    apexGrid.querySelectorAll('tr[data-id]').forEach(r=>{const id=r.getAttribute('data-id');if(id==='r0')return;const g=c=>{const e=r.querySelector('[data-id="'+id+'c'+c+'"]');return e?e.textContent.trim():'';};
      const no=g(col.no);if(!no)return;const rk=g(col.rk);const gap=col.gap?g(col.gap):'';
      if(!rk&&/no\s*lap|dnf|dns|dsq|ritir/i.test(gap)){const k=sk+'|'+no;if(!ltRet[k]){ltRet[k]={t:'si',at:Date.now()};ltRetAlert(no,'si');}}});
  }catch(e){}
}
function ltScanRet(){
  try{
    ltScanNoLap();
    if(!apexState.start||apexFinished)return;
    const head=apexGrid.querySelector('tr[data-id="r0"]');if(!head)return;let sc=null,nc='4';
    head.querySelectorAll('td[data-type]').forEach(td=>{const t=td.getAttribute('data-type');const c=(td.getAttribute('data-id')||'').replace('c','');if(t==='sta')sc=c;if(t==='no')nc=c;});
    if(!sc)return;const sk=apexState.cat+'|'+apexState.sess;
    // ritirato solo se rientra mentre la maggior parte è ancora in pista (a fine sessione rientrano tutti)
    const S=ltStaCounts();let canMark=!!(S&&S.run>S.inn);
    // dopo 3 minuti dalla partenza sono usciti tutti dai box: chi c'è ancora (anche aprendo l'app a gara in corso) è fuori
    let late=false;try{const now=new Date();late=now.getHours()*60+now.getMinutes()-slotMins(apexState.start.replace(':','.'))>=3;}catch(e){}
    if(apexGrid.querySelector('td.sf[data-id$="c'+sc+'"]'))canMark=false;
    try{if(apexLapInfo().fin)canMark=false;}catch(e){}
    apexGrid.querySelectorAll('tr[data-id]').forEach(r=>{const id=r.getAttribute('data-id');if(id==='r0')return;
      const st=r.querySelector('[data-id="'+id+'c'+sc+'"]');const nn=r.querySelector('[data-id="'+id+'c'+nc+'"]');if(!st||!nn)return;
      const no=nn.textContent.trim();if(!no)return;const k=sk+'|'+no;const cl=' '+st.className+' ';
      // 14/11/2026 (Andrea): IN e poi OUT in gara = RITIRATO (croce gialla), conta come uscito anche nella pillola risultati
      if(/ so /.test(cl)&&((ltRet[k]&&ltRet[k].t!=='so')||(!ltRet[k]&&late&&canMark&&ltIsRace()))){ltRan[k]=1;ltRet[k]={t:'so',at:Date.now()};}
      else if(/ (in|so|sr|su|sd) /.test(cl)){ltRan[k]=1;if(ltRet[k]&&ltRet[k].t!=='so')delete ltRet[k];}
      else if((!ltRan[k]&&!late)||!canMark)return; // non ancora uscito in pista in questa sessione: non è un ritiro
      else if(/ si /.test(cl)){if(!ltRet[k]){ltRet[k]={t:'si',at:Date.now()};ltRetAlert(no,'si');}}
      else if(/ ss /.test(cl)&&!apexState.red){if(!ltRet[k]){ltRet[k]={t:'ss',at:Date.now()};ltRetAlert(no,'ss');}}
    });
  }catch(e){}
}
function ltStaCounts(){
  const head=apexGrid.querySelector('tr[data-id="r0"]');if(!head)return null;let sc=null;
  head.querySelectorAll('td[data-type]').forEach(td=>{if(td.getAttribute('data-type')==='sta')sc=(td.getAttribute('data-id')||'').replace('c','');});
  if(!sc)return null;let run=0,inn=0,tot=0;
  apexGrid.querySelectorAll('tr[data-id]').forEach(r=>{const id=r.getAttribute('data-id');if(id==='r0')return;const st=r.querySelector('[data-id="'+id+'c'+sc+'"]');if(!st)return;tot++;
    const cl=' '+st.className+' ';if(/ (in|so|sr|su|sd) /.test(cl))run++;else if(/ (si|ss|sf) /.test(cl))inn++;});
  return{run,inn,tot};
}
function ltMineNums(){return new Set(pilots.map(p=>String(p.num)));}
function ltNameOf(no){const p=pilots.find(x=>String(x.num)===String(no));return p?p.name:'';}
function ltXSpan(r){return'<span class="lt-x'+(r&&r.t==='so'?' so':'')+'"><i class="ic ic-close"></i></span>';}
function ltRetOf(no,sk){return ltRet[(sk||(apexState.cat+'|'+apexState.sess))+'|'+no]||null;}
function ltRetAlert(no,t){try{if(!ltMineNums().has(String(no)))return;if(String(apexWsKey).split(':')[0]!==apexLiveName())return; /* live di un'altra gara: nessun avviso */const sk=apexState.cat+'|'+apexState.sess;
  rtAlert('ritiri|'+activeRaceId+'|'+sk+'|'+no,'<i class="ic ic-redflag"></i> #'+no+' '+ltNameOf(no)+' '+(ltIsRace()?'USCITO':(t==='ss'?'FERMO IN PISTA':'AI BOX')),apexState.cat+' · '+apexState.sess);}catch(e){}}
function ltRetBadge(r){if(!r)return'';const race=r.race!==undefined?r.race:ltIsRace();
  if(race||r.t==='so')return''; // 14/11/2026: in gara basta la croce rossa nella posizione, niente pillola USCITO
  const tx=race?'':(r.t==='ss'?'<i class="ic ic-redflag"></i> FERMO IN PISTA':'AI BOX');
  return' <span class="lt-ret'+(r.t==='si'&&!race?' box':'')+'">'+tx+'</span>';}
function apexGridDirty(){ltScanRet();if(_ltRenderT)return;_ltRenderT=setTimeout(()=>{_ltRenderT=null;renderLtMyTable();try{renderApexDyn();}catch(e){}if(ltFullOn)renderLtFull();},100);}
// ── Classifica live a schermo intero (solo classifica + giro, niente barre) ──
let ltFullOn=false,ltWake=null;const ltFullPrev={},ltFullMv={};
function openLtFull(){
  if(ltFullOn)return;ltFullOn=true;
  let el=document.getElementById('lt-full');
  if(!el){el=document.createElement('div');el.id='lt-full';document.body.appendChild(el);}
  el.style.display='flex';document.body.classList.add('lt-full-open');
  try{history.pushState({ltFull:1},'');}catch(e){}
  try{if(navigator.wakeLock)navigator.wakeLock.request('screen').then(w=>{ltWake=w;}).catch(()=>{});}catch(e){}
  renderLtFull();
}
function closeLtFull(fromPop){
  if(!ltFullOn)return;ltFullOn=false;
  const el=document.getElementById('lt-full');if(el)el.style.display='none';document.body.classList.remove('lt-full-open');
  try{if(ltWake){ltWake.release();ltWake=null;}}catch(e){}
  if(!fromPop){try{if(history.state&&history.state.ltFull)history.back();}catch(e){}}
}
window.addEventListener('popstate',()=>{if(ltFullOn)closeLtFull(true);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ltFullOn)closeLtFull();});
window.openLtFull=openLtFull;window.closeLtFull=closeLtFull;
function renderLtFull(){
  const el=document.getElementById('lt-full');if(!el||!ltFullOn)return;
  const head=apexGrid.querySelector('tr[data-id="r0"]');const col={};
  if(head)head.querySelectorAll('td[data-type]').forEach(td=>{col[td.getAttribute('data-type')]=(td.getAttribute('data-id')||'').replace('c','');});
  const C=(t,d)=>col[t]||d;
  const txt=(r,c)=>{const x=r.querySelector('[data-id="'+r.getAttribute('data-id')+'c'+c+'"]');return x?x.textContent.trim():'';};
  const rows=[...apexGrid.querySelectorAll('tr[data-id]')].filter(r=>r.getAttribute('data-id')!=='r0')
    .map(r=>({r,pos:parseInt(r.getAttribute('data-pos'))||parseInt(txt(r,C('rk','3')))||999})).sort((a,b)=>a.pos-b.pos);
  const myNums=new Set(pilots.map(x=>String(x.num)));
  const _lt=apexLapText();const lap=[_lt,apexDynText(apexDyn.dyn1),apexDynText(apexDyn.dyn2)].filter(x=>x&&!(x!==_lt&&_lt&&/(?:LAP|GIRO|TOUR)\s*\d+\s*\/\s*\d+/i.test(x))).join(' · ');
  const sess=((apexState.cat||'')+' · '+(apexState.sess||'')).replace(/</g,'&lt;');
  const now=Date.now();const sk=apexState.cat+'|'+apexState.sess;
  const out=[];
  if(!el.querySelector('.ltf-list')){el.innerHTML='<div class="ltf-top"><div class="ltf-sess"></div><div class="ltf-lap"></div><button class="ltf-close" onclick="closeLtFull()" aria-label="Chiudi"><i class="ic ic-close"></i></button></div><div class="ltf-list"></div>';}
  el.querySelector('.ltf-sess').innerHTML=lightHtml(false)+' '+sess;
  el.querySelector('.ltf-lap').innerHTML=lap?'<i class="ic ic-timer"></i> '+lap.replace(/</g,'&lt;'):'';
  if(!rows.length)out.push('<div class="ltf-empty">In attesa dei dati live…</div>');
  rows.forEach(({r,pos})=>{
    const no=txt(r,C('no','4'));const mine=myNums.has(no);const k=sk+'|'+no;
    if(ltFullPrev[k]&&ltFullPrev[k]!==pos)ltFullMv[k]={d:ltFullPrev[k]-pos,t:now+4000};ltFullPrev[k]=pos;
    const m=ltFullMv[k];const mv=m&&m.t>now?m.d:0;
    const nm=mine?((pilots.find(x=>String(x.num)===no)||{}).name||txt(r,C('dr','5'))):txt(r,C('dr','5'));
    const tm=((pilots.find(x=>String(x.num)===no)||{}).team)||((currentEntryList[no]||{}).team)||'';
    out.push('<div class="ltf-row'+(mine?' mine':'')+(mv>0?' up':mv<0?' down':'')+'" data-no="'+no+'"><span class="p">'+(ltRetOf(no)?ltXSpan(ltRetOf(no)):(pos<999?pos:'–'))+'</span><span class="n">'+no+'</span><span class="d">'+String(nm).replace(/</g,'&lt;')+ltRetBadge(ltRetOf(no))+'<small>'+String(tm).replace(/</g,'&lt;')+'</small></span>'+(mv?'<span class="mv">'+(mv>0?'▲':'▼')+Math.abs(mv)+'</span>':'')+'</div>');
  });
  const list=el.querySelector('.ltf-list');const ltfFlip=ltCapture(list,sk+'|'+(window.innerWidth>window.innerHeight?'L':'P'));list.innerHTML=out.join('');
  // Tutta la classifica in uno schermo: altezza riga e caratteri calcolati sul numero di piloti
  const n=Math.max(rows.length,1);const land=window.innerWidth>window.innerHeight;
  const per=land?Math.ceil(n/2):n;const rh=Math.max(14,Math.floor((list.clientHeight-4)/per));
  list.style.setProperty('--rh',rh+'px');list.style.setProperty('--fs',Math.max(10,Math.min(22,Math.round(rh*0.62)))+'px');
  ltfFlip();
}
window.addEventListener('resize',()=>{if(ltFullOn)renderLtFull();});
setInterval(()=>{if(ltFullOn)renderLtFull();},1000);
let ltView='mia'; // vista "Apex originale" rimossa il 13/11/2026
let ltOnlyMine=localStorage.getItem('rt_ltmine')!=='0';
function toggleLtMine(v){
  if(ltOnlyMine===v&&!ltLastOn&&!ltNextOn)return;ltLastOn=false;ltNextOn=false;
  ltOnlyMine=v;localStorage.setItem('rt_ltmine',v?'1':'0');
  const box=document.getElementById('lt-mytable');const dir=v?'l':'r';
  if(box){box.classList.remove('swap-r','swap-l');void box.offsetWidth;box.classList.add('swap-'+dir);clearTimeout(window._ltSwT);window._ltSwT=setTimeout(()=>box.classList.remove('swap-r','swap-l'),350);}
  window._ltSwAnim=dir;renderLtMyTable();window._ltSwAnim='';
}
window.toggleLtMine=toggleLtMine;
// ── ULTIMA GARA: quando nel live entra la sessione nuova, l'arrivo della precedente (solo miei) resta qui ──
let ltLastOn=false,ltLast=null;
try{ltLast=JSON.parse(localStorage.getItem('rt_ltlast')||'null');}catch(e){ltLast=null;}
function setLtLast(v){ltLastOn=!!v;if(v)ltNextOn=false;renderLtMyTable();}
/* 20/11/2026 (Andrea): scheda PROSSIMA GARA: i tuoi piloti (e del team) nel prossimo turno, con posizione in griglia e tasti */
let ltNextOn=false;
function setLtNext(v){ltNextOn=!!v;if(v)ltLastOn=false;renderLtMyTable();}
window.setLtNext=setLtNext;
function ltNextSlot(){
  const day=typeof autoDayName==='function'?autoDayName():activeDay;let arr=currentSchedule[day]||[];arr=Array.isArray(arr)?arr:Object.values(arr);if(!arr.length)return null;
  try{if(apexNext&&apexNext.sess){const m=apexMatchFor(apexNext.cat,apexNext.sess,null);if(m&&m.slot)return{slot:m.slot,day,src:'live'};}}catch(e){}
  try{const cur=apexMatchSlot();if(cur&&cur.slot){const i=arr.indexOf(cur.slot);if(i>=0&&arr[i+1])return{slot:arr[i+1],day,src:'programma'};}}catch(e){}
  const nm=new Date().getHours()*60+new Date().getMinutes()-(parseInt(scheduleDelay)||0);
  const nx=arr.find(x=>slotMins(x.time)>=nm);return nx?{slot:nx,day,src:'programma'}:null;}
function renderLtNext(){
  const N=ltNextSlot();if(!N)return'<div class="empty-state"><p>Nessun turno successivo nel programma di oggi.</p></div>';
  const sl=N.slot,d=parseInt(scheduleDelay)||0,at=slotMins(sl.time)+d,hh=String(Math.floor(at/60)%24).padStart(2,'0'),mm=String(at%60).padStart(2,'0');
  const esc=x=>String(x||'').replace(/</g,'&lt;');
  const mine=pilotsForSlot(sl).filter(p=>!p.eliminated).map(p=>({p,ft:null}));const seen=new Set(mine.map(x=>String(x.p.num)));
  try{teamsForSlot(sl).forEach(({t,inSlot})=>inSlot.forEach(p=>{if(seen.has(String(p.num)))return;seen.add(String(p.num));mine.push({p,ft:followedTeamOf(p.num,(currentEntryList[p.num]||{}).team)||t});}));}catch(e){}
  mine.sort((a,b)=>(gridPos(a.p.num,sl)||999)-(gridPos(b.p.num,sl)||999)||(parseInt(a.p.num)||0)-(parseInt(b.p.num)||0));
  const head='<div style="font-size:11px;font-weight:800;color:var(--text3);margin-bottom:6px">'+esc(sl.time)+' '+esc(sl.label||sl.cat)+' '+esc(slotFilterLabel(sl))
    +' <span style="color:var(--text)">· ore '+hh+':'+mm+(d?' (ritardo '+d+'′)':'')+'</span> <span style="color:var(--text4)">· '+mine.length+' tuoi'+(N.src==='live'?' · annunciato dal live':'')+'</span></div>'+remLine(sl);
  if(!mine.length)return head+'<div class="empty-state"><p>Nessun tuo pilota nel prossimo turno.</p></div>';
  return head+mine.map(({p,ft})=>{const no=String(p.num),gp=gridPos(no,sl),isMine=!ft,ent=currentEntryList[no]||{};const nt=String((notes&&notes[no])||'').trim();
    return'<div class="ltbig '+(isMine?hlOfNum(no):hlClassOf(ft.highlight||[])+' tglow')+'"'+(ft?' style="--tc:'+teamColor(ft.key)+'"':'')+' data-no="'+esc(no)+'" onclick="openPilotDetail(\''+esc(no)+'\')">'
      +'<div class="pos">'+(gp?'<span style="font-size:.55em;opacity:.7">P</span>'+gp:'–')+'</div>'
      +'<div style="flex:1;min-width:0"><div><span class="num">#'+esc(no)+'</span>'+riskTri(no)+' <span class="nm">'+esc(p.name||ent.lastName||'')+'</span><span onclick="event.stopPropagation()" style="float:right">'+noteBtn(no)+'</span></div>'
      +'<div class="tm">'+esc(p.team||ent.team||'')+'</div>'
      +(nt?'<div class="note-txt" style="margin-top:2px"><i class="ic ic-note"></i> '+esc(nt)+'</div>':'')
      +'<div class="tasks lt-tasks" onclick="event.stopPropagation()">'+TASKS.map(t=>isMine?taskBtn(no,t,true):teamPilotTaskBtn(no,t)).join('')+spotPill(no)+'</div></div></div>';}).join('');
}
window.setLtLast=setLtLast;
// Apex al cambio sessione può mandare la griglia NUOVA prima dei titoli nuovi: la foto della griglia vecchia si prende appena prima di sostituirla
let ltPre=null,ltPreAt=0;
// "Ultima gara" scatta SOLO quando nella griglia arrivano piloti diversi (la griglia nuova sostituisce i miei),
// non all'arrivo né al cambio del nome sessione. Il nome della sessione è quello attivo alla partenza.
let ltCurLabel='',ltGridNew=false,ltTitleAt=0;
function ltGridNums(root){const head=root.querySelector('tr[data-id="r0"]');let nc='4';
  if(head)head.querySelectorAll('td[data-type]').forEach(td=>{if(td.getAttribute('data-type')==='no')nc=(td.getAttribute('data-id')||'').replace('c','');});
  const out=new Set();root.querySelectorAll('tr[data-id]').forEach(r=>{const id=r.getAttribute('data-id');if(id==='r0')return;const c=r.querySelector('[data-id="'+id+'c'+nc+'"]');const n=c?c.textContent.trim():'';if(n)out.add(n);});return out;}
function ltOnGrid(v){
  try{
    const oldN=ltGridNums(apexGrid);if(!oldN.size)return;
    const tmp=document.createElement('table');tmp.innerHTML=v;const newN=ltGridNums(tmp);
    let same=0;newN.forEach(n=>{if(oldN.has(n))same++;});
    if(newN.size&&same/Math.min(oldN.size,newN.size)>=0.5)return; // stessi piloti (aggiornamento o ripartenza): niente foto
    const key=ltCurLabel||apexGridSess;const snap=ltSnapshot(true,key);
    ltCurLabel='';ltGridNew=true;
    // la griglia vecchia sta per sparire: registra l'arrivo della sessione finita finché i dati sono ancora suoi
    try{if(apexGridSess===apexState.cat+'|'+apexState.sess)apexEvaluate('change');}catch(e){}
    if(snap&&snap.rows&&snap.rows.length&&!(ltLast&&ltLast.key===snap.key&&ltLast.race===snap.race&&Math.abs(ltLast.at-snap.at)<60000)){ltLast=snap;try{localStorage.setItem('rt_ltlast',JSON.stringify(ltLast));}catch(e){}}
  }catch(e){}
}
function ltOnTitle(){return false;
  const recent=Date.now()-ltPreAt<15000;
  if(recent){const p=ltPre;ltPre=null;if(p&&p.rows&&p.rows.length&&!(ltLast&&ltLast.key===p.key&&ltLast.race===p.race)){ltLast=p;try{localStorage.setItem('rt_ltlast',JSON.stringify(ltLast));}catch(e){}}}
  else ltSnapshot();
  return recent;
}
function ltSnapshot(build,forceKey){
  try{
    const key=forceKey||apexGridSess;if(!key||(!build&&ltLast&&ltLast.key===key&&ltLast.race===activeRaceId))return null;
    const head=apexGrid.querySelector('tr[data-id="r0"]');const col={};
    if(head)head.querySelectorAll('td[data-type]').forEach(td=>{col[td.getAttribute('data-type')]=(td.getAttribute('data-id')||'').replace('c','');});
    const C=(t,d)=>col[t]||d;
    const txt=(r,c)=>{const el=r.querySelector('[data-id="'+r.getAttribute('data-id')+'c'+c+'"]');return el?el.textContent.trim():'';};
    const myNums=new Set(pilots.map(x=>String(x.num)));
    // 20/11/2026 (Andrea): anche i piloti dei team seguiti entrano nell'ultima gara
    try{teams.forEach(t=>teamEntrants(t).forEach(e=>myNums.add(String(e.num))));}catch(e){}
    const rows=[...apexGrid.querySelectorAll('tr[data-id]')].filter(r=>r.getAttribute('data-id')!=='r0')
      .map(r=>({no:txt(r,C('no','4')),pos:parseInt(txt(r,C('rk','3')))||parseInt(r.getAttribute('data-pos'))||999,dr:txt(r,C('dr','5')),gap:txt(r,C('gap','13')),blp:txt(r,C('blp','12')),laps:txt(r,C('tlp','14'))})).map(x=>{const rr=ltRet[key+'|'+x.no];if(rr)x.ret={t:rr.t,race:/HEAT|MANCHE|PREFINAL|FINAL|RACE|GARA/i.test(key)&&!/QUALIF|PRACT|FREE|WARM/i.test(key)};return x;})
      .filter(x=>myNums.has(x.no)).sort((a,b)=>a.pos-b.pos);
    if(!rows.length)return null;
    const [cat,sess]=key.split('|');
    const snap={key,race:activeRaceId,cat,sess,at:Date.now(),tot:[...apexGrid.querySelectorAll('tr[data-id]')].length-1,rows};
    if(build)return snap;
    ltLast=snap;
    try{localStorage.setItem('rt_ltlast',JSON.stringify(ltLast));}catch(e){}
  }catch(e){}
  return null;
}
function renderLtLast(){
  const L=ltLast&&ltLast.race===activeRaceId?ltLast:null;
  if(!L)return'<div class="empty-state"><p>Nessuna gara precedente con i tuoi piloti.<br>Appare qui quando nel live entra la sessione successiva.</p></div>';
  const hm=new Date(L.at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  const esc=x=>String(x||'').replace(/</g,'&lt;');
  return'<div style="font-size:11px;font-weight:800;color:var(--text3);margin-bottom:6px"><i class="ic ic-flag"></i> '+esc(L.cat)+' · '+esc(L.sess)+' <span style="color:var(--text4)">· chiusa alle '+hm+' · '+L.tot+' totali · classifica live, non ufficiale</span></div>'
    +L.rows.map(x=>{
      const pl=pilots.find(p=>String(p.num)===x.no)||{};const ent=(currentEntryList&&currentEntryList[x.no])||{};
      const nt=String((notes&&notes[x.no])||'').trim();
      const mine=pilots.some(p=>String(p.num)===x.no);const ft=mine?null:followedTeamOf(x.no,ent.team);
      return'<div class="ltbig '+(mine?hlOfNum(x.no):ft?hlClassOf(ft.highlight||[])+' tglow':'')+'"'+(ft?' style="--tc:'+teamColor(ft.key)+'"':'')+' data-no="'+esc(x.no)+'" onclick="openPilotDetail(\''+esc(x.no)+'\')">'
        +'<div class="pos">'+(x.ret?ltXSpan(x.ret):(x.pos<999?x.pos:'–'))+'</div>'
        +'<div style="flex:1;min-width:0"><div><span class="num">#'+esc(x.no)+'</span>'+riskTri(x.no)+' <span class="nm">'+esc(pl.name||x.dr)+'</span>'+ltRetBadge(x.ret)+'<span onclick="event.stopPropagation()" style="float:right">'+noteBtn(x.no)+'</span></div>'
        +'<div class="tm">'+esc(pl.team||ent.team||'')+(x.gap?' · '+esc(x.gap):'')+(x.blp?' · best '+esc(x.blp):'')+'</div>'
        +(nt?'<div class="note-txt" style="margin-top:2px"><i class="ic ic-note"></i> '+esc(nt)+'</div>':'')
        +'<div class="tasks lt-tasks" onclick="event.stopPropagation()">'+TASKS.map(t=>mine?taskBtn(x.no,t,true):teamPilotTaskBtn(x.no,t)).join('')+spotPill(x.no)+'</div></div></div>';
    }).join('');
}
// Animazione del contenuto quando si cambia vista con un selettore
function viewSwap(ids,dir){ids.forEach(id=>{const el=document.getElementById(id);if(!el)return;el.classList.remove('view-swap-r','view-swap-l');void el.offsetWidth;el.classList.add('view-swap-'+dir);setTimeout(()=>el.classList.remove('view-swap-'+dir),350);});}
function setLtView(v){if(ltView===v)return;const d=v==='apex'?'r':'l';ltView=v;localStorage.setItem('rt_ltview',v);renderLtMyTable();try{applyLiveCrop();}catch(e){}viewSwap(['lt-mytable','lt-wrap'],d);}
window.setLtView=setLtView;
// Classifica live ricostruita dai dati Apex, con i piloti dell'account evidenziati
// Giro attuale / tempo rimanente come su Apex (messaggi dyn1/dyn2 del live)
const apexDyn={};let apexNext=null;
// Semaforo Apex: lg verde, lr rosso, ly giallo, lf bandiera a scacchi (fine)
let apexLight={c:'',at:0};
function lightInfo(){const c=apexLight.c;return({lg:{col:'#22c55e',t:'VERDE'},lr:{col:'#ef4444',t:'ROSSO'},ly:{col:'#facc15',t:'GIALLO'},lf:{col:'#ffffff',t:'FINE'}})[c]||null;}
function lightHtml(big){const c=apexLight.c;if(!c)return'';const sz=big?16:12;
  // tre luci tipo semaforo: rosso, giallo (bandiera gialla), verde; fine gara = scacchi
  if(c==='lf')return'<span class="lt-light" style="display:inline-block;width:'+(sz*2)+'px;height:'+sz+'px;border-radius:4px;background:repeating-conic-gradient(#fff 0 25%,#111 0 50%) 0 0/8px 8px;flex-shrink:0"></span>';
  const dot=(on,col)=>'<span style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+(on?col:'rgba(255,255,255,.12)')+';'+(on?'box-shadow:0 0 10px '+col+';':'')+'flex-shrink:0"></span>';
  return'<span class="lt-light" style="display:inline-flex;align-items:center;gap:4px;padding:3px 5px;border-radius:999px;background:#111;flex-shrink:0">'+dot(c==='lr','#ef4444')+dot(c==='ly','#facc15')+dot(c==='lg','#22c55e')+'</span>';}
function apexDynFmt(ms){ms=Math.max(0,Math.round(ms/1000));const h=Math.floor(ms/3600),m=Math.floor(ms%3600/60),x=ms%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');}
function apexDynText(d){
  if(!d||d.val===undefined||d.val==='')return'';
  let v=String(d.val),extra='';
  if(d.type==='countdown_text'&&v.indexOf('_')>=0){const q=v.split('_');v=q[0];extra=q[1]||'';}
  if(d.type==='countdown'||d.type==='countdown_text'||d.type==='count'){
    let ms=v.indexOf('.')>=0?parseFloat(v)*1000:parseFloat(v);if(isNaN(ms))return'';
    const el=Date.now()-d.at;
    return d.type==='count'?apexDynFmt(ms+el):(apexDynFmt(ms-el)+(extra?' '+extra:'')+(d.type==='countdown'?' rimanenti':''));
  }
  return v.replace(/<[^>]+>/g,'').trim();
}
// Giro attuale = giri del primo in classifica + 1 (colonna giri della griglia Apex); totale dal programma ("12 giri", o durLive se il live li ha cambiati)
function apexLapInfo(){
  let tot=null,led=null,fin=!!apexFinished;
  try{const m=apexMatchSlot();const d=m&&m.slot?String(m.slot.durLive||m.slot.dur||''):'';const t=d.match(/(\d+)\s*giri/i);if(t)tot=+t[1];}catch(e){}
  const head=apexGrid.querySelector('tr[data-id="r0"]');let lc=null;
  if(head)head.querySelectorAll('td[data-type]').forEach(td=>{const ty=(td.getAttribute('data-type')||'').toLowerCase();const tx=td.textContent.trim();if(ty==='tlp'||ty==='lap'||ty==='laps'||/^(giri|giro|laps?|tours?|tr)$/i.test(tx))lc=(td.getAttribute('data-id')||'').replace('c','');});
  if(lc){
    let best=null;
    apexGrid.querySelectorAll('tr[data-id]').forEach(r=>{const id=r.getAttribute('data-id');if(id==='r0')return;const c=r.querySelector('[data-id="'+id+'c'+lc+'"]');const n=c?parseInt(c.textContent):NaN;if(!isNaN(n)&&(best===null||n>best))best=n;});
    led=best;
  }
  // nelle gare Apex scrive il giro in alto ("Lap 4/12") e non manda la colonna giri
  try{const dtx=[apexDynText(apexDyn.dyn1),apexDynText(apexDyn.dyn2)].join(' ');const lm=dtx.match(/(?:LAP|GIRO|TOUR)\s*(\d+)\s*\/\s*(\d+)/i);
    // 20/11/2026: "Lap x/y" di Apex = giri gia' COMPLETATI dal primo (parte da "Lap 0/8", finisce a "Lap 11/11"): il giro in corso e' x+1
    if(lm){const cur=+lm[1],tt=+lm[2];if(!tot)tot=tt;if(led===null)led=apexFinished?Math.max(cur,tt):cur;}}catch(e){}
  if(tot&&led!==null&&led>=tot)fin=true;
  // sessione partita e quasi tutti rientrati = finita (Apex non sempre manda FINISH)
  try{const S=ltStaCounts();if(apexState.start&&S&&S.tot>3&&S.run===0&&S.inn>=S.tot*0.8)fin=true;}catch(e){}
  const dt=[apexDynText(apexDyn.dyn1),apexDynText(apexDyn.dyn2)].join(' ');
  if(/finish|arriv|chequ|scacch/i.test(dt))fin=true;
  return{tot,led,fin};
}
function apexLapText(){
  const L=apexLapInfo();
  if(L.fin)return'ARRIVO';
  // 20/11/2026 (Andrea): nelle gare a giri, all'ultimo giro si scrive "ULTIMO GIRO" (Apex manda "Lap 11/11" o un testo tipo "Last lap")
  try{const dt=[apexDynText(apexDyn.dyn1),apexDynText(apexDyn.dyn2)].join(' ');
    if(/last\s*lap|final\s*lap|ultimo\s*giro|dernier\s*tour|letzte\s*runde/i.test(dt))return'ULTIMO GIRO';
    if(L.tot&&L.led!==null&&L.led+1>=L.tot&&apexState.start)return'ULTIMO GIRO';}catch(e){}
  if(L.led!==null&&L.tot)return'Giro '+Math.min(L.led+1,L.tot)+'/'+L.tot;
  if(L.led!==null&&L.led>0)return'Giro '+(L.led+1);
  return'';
}
function renderApexDyn(){
  const box=document.getElementById('lt-mytable');if(!box||!box.parentNode)return;
  let el=document.getElementById('lt-dyn');
  if(!el){el=document.createElement('div');el.id='lt-dyn';el.style.cssText="display:none;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;padding:10px 14px;border-radius:12px;background:var(--bg2);font-family:'Chakra Petch';font-weight:700";box.parentNode.insertBefore(el,box);}
  const lap=apexLapText();
  const t=[apexDynText(apexDyn.dyn1),apexDynText(apexDyn.dyn2)].filter(x=>x&&!(lap&&/(?:LAP|GIRO|TOUR)\s*\d+\s*\/\s*\d+/i.test(x)));const fin=lap==='ARRIVO';
  const lh=lightHtml(true);
  if((!t.length&&!lap&&!lh)||!apexWsKey){el.style.display='none';return;}
  const sess=((apexState.cat||'')+' '+(apexState.sess||'')).trim();
  el.style.display='flex';
  const ul=lap==='ULTIMO GIRO';
  el.style.outline=fin?'2px solid #fff':ul?'2px solid #facc15':'none';
  el.innerHTML='<span style="display:flex;align-items:center;gap:10px;min-width:0">'+lh+'<span style="font-size:10px;line-height:1.25;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word">'+sess.replace(/</g,'&lt;')+'</span></span><span style="display:flex;align-items:center;gap:12px;white-space:nowrap">'
    +(lap?'<span class="'+(ul?'lt-lastlap':'')+'" style="font-size:'+(fin||ul?'24':'22')+'px;color:'+(fin?'#fff':ul?'#facc15':'var(--rt-orange)')+';font-weight:900">'+(fin?'<i class="ic ic-flag"></i> ':'')+lap+'</span>':'')
    +(t.length&&!fin?'<span style="font-size:16px;color:var(--text2)"><i class="ic ic-timer" style="color:var(--rt-orange)"></i> '+t.join(' · ').replace(/</g,'&lt;')+'</span>':'')+'</span>';
}
/* 14/11/2026: riga PROSSIMA dal "Next" di Apex + controllo sul programma (se l'ordine e' diverso lo segnala) */
function apexNextInfo(){
  if(!apexNext||!apexWsKey)return null;
  // 15/11 (Andrea): dopo l'ultima gara il live annuncia documenti ("Results booklet", premiazioni): non sono sessioni, niente riquadro
  if(/BOOKLET|RESULTS?\b|PREMIAZ|AWARD|PODIUM|CERIMON/i.test(String(apexNext.sess||'')))return null;
  const out={cat:apexNext.cat,sess:apexNext.sess,warn:'',mine:[]};
  try{
    const day=typeof autoDayName==='function'?autoDayName():'';let arr=(day&&currentSchedule[day])||[];arr=Array.isArray(arr)?arr:Object.values(arr);
    if(!arr.length)return out;
    const same=(a,b)=>a&&b&&a.time===b.time&&canonCat(a.cat)===canonCat(b.cat)&&a.type===b.type;
    // 15/11: le finali stanno nell'elenco finali, non tra i turni: prima davano un falso "non trovata nel programma"
    if(/FINAL/i.test(apexNext.sess)&&!/PRE/i.test(apexNext.sess)){
      const fl=[].concat(currentFinals||[]).filter(Boolean);const f=fl.find(x=>canonCat(x.cat)===canonCat(apexNext.cat));
      if(!f){out.warn='finale non trovata nel programma';return out;}
      out.mine=pilots.filter(p=>canonCat(p.cat)===canonCat(f.cat)&&!p.eliminated&&(p.inFinal||!(currentEntryList[p.num]||{}).eliminated)).map(p=>p.num);return out;
    }
    const nm=apexMatchFor(apexNext.cat,apexNext.sess,null);
    if(!nm||!nm.slot){out.warn='non trovata nel programma di oggi';return out;}
    out.mine=pilotsForSlot(nm.slot).map(p=>p.num);
    const cur=apexMatchSlot();const ci=cur&&cur.slot?arr.findIndex(x=>same(x,cur.slot)):-1;
    if(ci>=0){const exp=arr[ci+1];if(exp&&!same(exp,nm.slot))out.warn='nel programma dopo questa c\'era '+(exp.label||exp.cat||'')+' ('+exp.time+')';}
  }catch(e){}
  return out;
}
function renderApexNext(){
  const dyn=document.getElementById('lt-dyn');const box=document.getElementById('lt-mytable');if(!box||!box.parentNode)return;
  let el=document.getElementById('lt-next');
  if(!el){el=document.createElement('div');el.id='lt-next';el.style.cssText="display:none;margin:-4px 0 10px;padding:8px 14px;border-radius:10px;background:var(--bg2);font-size:12px;font-weight:700;color:var(--text3)";box.parentNode.insertBefore(el,box);}
  if(dyn&&dyn.nextSibling!==el)dyn.after(el);
  const n=apexNextInfo();
  if(!n){if(el.style.display!=='none')el.style.display='none';return;}
  const esc=x=>String(x||'').replace(/</g,'&lt;');
  const h='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:10px;letter-spacing:1px;color:var(--text4)">PROSSIMA</span><span style="color:var(--text);text-transform:uppercase">'+esc(n.cat)+' · '+esc(n.sess)+'</span>'
    +(n.mine.length?'<span style="color:var(--rt-orange)">'+n.mine.map(x=>'#'+esc(x)).join(' ')+'</span>':'')+'</div>'
    +(n.warn?'<div style="margin-top:4px;color:#facc15"><i class="ic ic-bell"></i> Ordine diverso dal programma: '+esc(n.warn)+'</div>':'');
  if(el.innerHTML!==h)el.innerHTML=h;el.style.display='block';
}
setInterval(()=>{if(activeTab==='livetiming'&&(apexDyn.dyn1||apexDyn.dyn2||apexState.sess||apexNext)){renderApexDyn();renderApexNext();}},500);
// Sorpassi: freccia ▲/▼ per qualche secondo e scorrimento morbido della card (FLIP)
const ltLastPos={},ltMoveUntil={};
function ltMove(no,pos){
  if(!pos)return 0;const k=apexState.cat+'|'+apexState.sess+'|'+no;const prev=ltLastPos[k];ltLastPos[k]=pos;
  if(prev&&prev!==pos)ltMoveUntil[k]={d:prev-pos,t:Date.now()+4000};
  const m=ltMoveUntil[k];return m&&m.t>Date.now()?m.d:0;
}
/* 14/11/2026: animazione dei sorpassi in tutte le viste del live (Solo miei, Tutti, Ultima gara, schermo intero).
   FLIP: posizione prima del ridisegno -> dopo, la riga scivola al nuovo posto invece di saltare.
   Solo se la vista e' la stessa (cambiando vista niente animazione). */
function ltCapture(box,view){
  const before={};const same=view===undefined||box.dataset.ltView===view;
  if(same)box.querySelectorAll('[data-no]').forEach(el=>{const r=el.getBoundingClientRect();before[el.dataset.no]=[r.left,r.top];});
  return function(){
    if(view!==undefined)box.dataset.ltView=view;
    if(!same||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
    box.querySelectorAll('[data-no]').forEach(el=>{const b=before[el.dataset.no];if(!b)return;const r=el.getBoundingClientRect();const dx=b[0]-r.left,dy=b[1]-r.top;
      if(Math.abs(dy)<2&&Math.abs(dx)<2)return;el.style.transition='none';el.style.transform='translate('+dx+'px,'+dy+'px)';el.style.position=el.style.position||'relative';el.style.zIndex=dy>0?'2':'1';
      requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition='transform .55s cubic-bezier(.22,.85,.26,1)';el.style.transform='';setTimeout(()=>{el.style.zIndex='';},600);}));});
  };
}
setInterval(()=>{if(activeTab==='livetiming'&&Object.values(ltMoveUntil).some(m=>m.t&&m.t<Date.now()&&!m.done)){Object.values(ltMoveUntil).forEach(m=>{if(m.t<Date.now())m.done=true;});renderLtMyTable();}},1000);
function renderLtMyTable(){
  ['mia','apex'].forEach(x=>{const b=document.getElementById('ltv-'+x);if(b)b.classList.toggle('active',ltView===x);});
  const box=document.getElementById('lt-mytable');const wrap=document.getElementById('lt-wrap');
  if(!box)return;
  // 20/11/2026 (Andrea): in SOLO MIEI e ULTIMA GARA niente frecce su/giu' che coprono le schede
  {const tl=document.getElementById('tab-livetiming');if(tl)tl.classList.toggle('lt-nofab',ltView==='mia'&&!!(ltOnlyMine||ltLastOn||ltNextOn));}
  if(ltView!=='mia'){box.style.display='none';if(wrap)wrap.style.display='';return;}
  box.style.display='';if(wrap)wrap.style.display='none';
  if(activeTab!=='livetiming')return;
  const rows=[...apexGrid.querySelectorAll('tr[data-id]')].filter(r=>r.getAttribute('data-id')!=='r0');
  if(!rows.length){box.innerHTML='<div class="empty-state"><p>'+(apexWsKey?'In attesa dei dati live…':'Live timing non disponibile per questa gara')+'</p></div>';return;}
  const txt=(r,c)=>{const el=r.querySelector('[data-id="'+r.getAttribute('data-id')+'c'+c+'"]');return el?el.textContent.trim():'';};
  const cls=(r,c)=>{const el=r.querySelector('[data-id="'+r.getAttribute('data-id')+'c'+c+'"]');return el?el.className:'';};
  // colonne dall'intestazione (data-type), con ripiego sugli indici standard
  const head=apexGrid.querySelector('tr[data-id="r0"]');const col={};
  if(head)head.querySelectorAll('td[data-type]').forEach(td=>{col[td.getAttribute('data-type')]=(td.getAttribute('data-id')||'').replace('c','');});
  const C=(t,d)=>col[t]||d;
  const HL=c=>{const td=head&&head.querySelector('[data-id="c'+c+'"]');return td?td.textContent.trim():'';};
  const ltFlip=ltCapture(box,ltLastOn?'last':ltOnlyMine?'mine':'all');
  const myNums=new Set(pilots.map(x=>String(x.num)));
  const teamNums=new Set();
  try{teams.forEach(t=>teamEntrants(t).forEach(e=>teamNums.add(String(e.num))));}catch(e){}
  const sorted=rows.map(r=>({r,pos:parseInt(r.getAttribute('data-pos'))||999})).sort((a,b)=>a.pos-b.pos);
  const mineCount=sorted.filter(x=>myNums.has(txt(x.r,C('no','4')))).length;
  // 20/11/2026 (Andrea): anche i piloti dei team seguiti contano tra i "tuoi" e prendono il colore del team
  const teamCount=sorted.filter(x=>{const n=txt(x.r,C('no','4'));return !myNums.has(n)&&teamNums.has(n);}).length;
  // 20/11/2026 (Andrea): ordine nel tempo, SOLO MIEI e TUTTI al centro
  const _pvI=ltLastOn?0:ltNextOn?3:ltOnlyMine?1:2;
  const sw='<div class="pv-switch pv4 pvi'+_pvI+(window._ltSwAnim?' anim-'+window._ltSwAnim:'')+'" style="margin-bottom:8px">'
    +'<button class="pv-btn'+(_pvI===0?' active':'')+'" onclick="setLtLast(true)">SCORSA</button>'
    +'<button class="pv-btn'+(_pvI===1?' active':'')+'" onclick="toggleLtMine(true)">SOLO MIEI</button>'
    +'<button class="pv-btn'+(_pvI===2?' active':'')+'" onclick="toggleLtMine(false)">TUTTI</button>'
    +'<button class="pv-btn'+(_pvI===3?' active':'')+'" onclick="setLtNext(true)">PROSSIMA</button></div>';
  if(ltLastOn){box.innerHTML=sw+renderLtLast();ltFlip();return;}
  if(ltNextOn){box.innerHTML=sw+renderLtNext();ltFlip();return;}
  const title='<div style="font-size:11px;font-weight:800;color:var(--text3);margin-bottom:6px">'+(apexState.cat||'')+' · '+(apexState.sess||'')
    +' <span style="color:var(--text)">· '+(mineCount+teamCount)+' tuoi in pista'+(teamCount?' ('+teamCount+' team)':'')+'</span> <span style="color:var(--text4)">· '+sorted.length+' totali</span></div>';
  if(ltOnlyMine){
    const mine=sorted.filter(x=>{const n=txt(x.r,C('no','4'));return myNums.has(n)||teamNums.has(n);});
    box.innerHTML=sw+title+(mine.length?mine.map(({r})=>{
      const no=txt(r,C('no','4'));const tm=!myNums.has(no);
      const nm=(pilots.find(x=>String(x.num)===no)||{}).name||txt(r,C('dr','5'));
      const gap=txt(r,C('gap','13'));
      const ent=(currentEntryList&&currentEntryList[no])||{};
      const pl=pilots.find(x=>String(x.num)===no)||{};
      const team=pl.team||ent.team||'';
      const nt=String((notes&&notes[no])||'').trim();
      const pos=parseInt(txt(r,C('rk','3')))||0;const mv=ltMove(no,pos);
      const rt=ltRetOf(no);
      // 20/11/2026 (Andrea): pilota di un team seguito = trattato come i tuoi (stesso aspetto), con contorno colore team
      const ft=tm?followedTeamOf(no,ent.team):null;const as=!tm||ft;
      const hc=tm?(ft?hlClassOf(ft.highlight||[]):''):hlOfNum(no);
      return'<div class="ltbig '+hc+(tm&&!ft?' team':'')+(ft?' tglow':'')+(rt?' ret':'')+(mv>0?' up':mv<0?' down':'')+'"'+(ft?' style="--tc:'+teamColor(ft.key)+'"':'')+' data-no="'+no+'"'+(as?' onclick="openPilotDetail(\''+no+'\')"':'')+'>'
        +'<div class="pos">'+(rt?ltXSpan(rt):(txt(r,C('rk','3'))||'–'))+(mv?'<span class="mv">'+(mv>0?'▲':'▼')+Math.abs(mv)+'</span>':'')+'</div>'
        +'<div style="flex:1;min-width:0"><div><span class="num">#'+no+'</span>'+(as?riskTri(no):'')+' <span class="nm">'+nm+'</span>'+ltRetBadge(rt)+(as?'<span onclick="event.stopPropagation()" style="float:right">'+noteBtn(no)+'</span>':'')+'</div>'
        +'<div class="tm">'+team+'</div>'
        +(nt?'<div class="note-txt" style="margin-top:2px"><i class="ic ic-note"></i> '+nt.replace(/</g,'&lt;')+'</div>':'')
        +(!tm?'<div class="tasks lt-tasks" onclick="event.stopPropagation()">'+TASKS.map(t=>taskBtn(no,t,true)).join('')+spotPill(no)+'</div>'
          :ft?'<div class="tasks lt-tasks" onclick="event.stopPropagation()">'+TASKS.map(k=>teamPilotTaskBtn(no,k)).join('')+spotPill(no)+'</div>':'')+'</div></div>';
    }).join(''):'<div class="empty-state"><p>Nessun tuo pilota in questa sessione</p></div>');
    ltFlip();return;
  }
  box.innerHTML=sw+title
    +'<table class="ltc"><tr><th>P</th><th>N°</th><th>PILOTA</th><th>TEAM</th></tr>'
    +sorted.map(({r})=>{
      const no=txt(r,C('no','4'));const mine=myNums.has(no);const tm=!mine&&teamNums.has(no);
      const llc=cls(r,C('llp','10'));
      // 20/11/2026 (Andrea): piloti dei team seguiti = riga come i tuoi, con il colore del team a sinistra e sopra/sotto
      const ftr=tm?followedTeamOf(no,((currentEntryList||{})[no]||{}).team):null;
      return'<tr data-no="'+no+'" class="'+(mine?'mine '+hlOfNum(no):ftr?'mine tglow':tm?'team':'')+'"'+(ftr?' style="--tc:'+teamColor(ftr.key)+'"':'')+(mine||ftr?' onclick="openPilotDetail(\''+no+'\')"':'')+'>'
        +'<td>'+(ltRetOf(no)?ltXSpan(ltRetOf(no)):txt(r,C('rk','3')))+'</td><td class="n">'+no+(mine?riskTri(no):'')+'</td><td class="d">'+txt(r,C('dr','5'))+ltRetBadge(ltRetOf(no))+'</td><td class="d" style="color:var(--text3)">'+(((pilots.find(x=>String(x.num)===no)||{}).team)||((currentEntryList&&currentEntryList[no])||{}).team||'')+'</td></tr>'
        +(mine&&String((notes&&notes[no])||'').trim()?'<tr class="mine"><td></td><td colspan="6" class="note-txt" style="white-space:normal"><i class="ic ic-note"></i> '+String(notes[no]).replace(/</g,'&lt;')+'</td></tr>':'');
    }).join('')+'</table>'
    +'<div style="font-size:11px;color:var(--text4);margin-top:6px">Evidenziati i tuoi piloti · tocca un tuo pilota per la scheda</div>';
  ltFlip();
}
window.renderLtMyTable=renderLtMyTable;
function apexParse(txt){
  let changed=false;
  txt.split('\n').forEach(line=>{
    const p=line.split('|');const k=p[0];const v=p.slice(2).join('|');
    if(k==='light'){apexLight={c:String(p[1]||'').trim(),at:Date.now()};try{renderApexDyn();if(ltFullOn)renderLtFull();}catch(e){}return;}
    if(k==='msg'){const m=String(v).replace(/<[^>]*>/g,'').match(/^\s*Next\s*:\s*(.+?)\s+-\s+(.+?)\s*$/i);apexNext=m?{cat:m[1].trim(),sess:m[2].trim(),at:Date.now()}:null;try{renderApexDyn();}catch(e){}return;}
    if(k==='dyn1'||k==='dyn2'){apexDyn[k]={type:p[1]||'text',val:v,at:Date.now()};renderApexDyn();return;}
    if(k==='grid'){ltGridNew=false;ltOnGrid(v);apexGrid.innerHTML=v;
      // griglia con piloti nuovi arrivata PRIMA del nome della sessione nuova: non attribuirla alla sessione vecchia
      apexGridSess=(ltGridNew&&Date.now()-ltTitleAt>20000)?'':apexState.cat+'|'+apexState.sess;apexGridDirty();return;}
    const mc=k.match(/^r(\d+)c(\d+)$/);
    if(mc){const el=apexGrid.querySelector('[data-id="'+k+'"]');if(el){el.className=p[1]||'';el.innerHTML=v;apexGridDirty();}return;}
    if(/^r\d+$/.test(k)&&p[1]==='#'){const row=apexGrid.querySelector('tr[data-id="'+k+'"]');if(row){row.setAttribute('data-pos',p[2]);apexGridDirty();}return;}
    if(k==='title1'){if(apexState.cat!==v){const _rg=ltOnTitle();if(apexState.sess&&apexState.start){apexEvaluate('change');apexState.start='';}apexState.cat=v;ltTitleAt=Date.now();if(_rg||apexGridSess==='')apexGridSess=apexState.cat+'|'+apexState.sess;changed=true;}}
    else if(k==='title2'){if(apexState.sess!==v){const _rg2=ltOnTitle();
      // cambio sessione: le partenze già viste appartengono alla sessione precedente
      if(apexState.sess){apexEvaluate('change');apexIgnore=new Set(apexSeen);}
      apexState.sess=v;ltTitleAt=Date.now();setTimeout(()=>{try{refreshNowHighlight(true);}catch(e){}},50);if(_rg2||apexGridSess===''||(ltGridNew&&apexGridSess.split('|')[1]!==v))apexGridSess=apexState.cat+'|'+apexState.sess;apexFinished='';clearTimeout(apexEvalT);apexState.start='';apexState.red='';changed=true;}}
    else if(k==='com'){
      // ultima partenza registrata: <b>10:43</b><span data-flag="green"></span>START
      const all=[...v.matchAll(/<b>(\d{1,2}:\d{2})<\/b>\s*<span[^>]*data-flag="green"[^>]*><\/span>\s*START/gi)].map(x=>x[1]).filter(t=>!apexIgnore.has(t));
      [...v.matchAll(/<b>(\d{1,2}:\d{2})<\/b>/g)].forEach(x=>apexSeen.add(x[1]));
      // PRIMA partenza della sessione: le ripartenze dopo una bandiera rossa non falsano il ritardo
      if(all.length){
        const first=all.sort((a,b)=>slotMins(a.replace(':','.'))-slotMins(b.replace(':','.')))[0];
        if(apexState.start!==first){apexState.start=first;ltCurLabel=apexState.cat+'|'+apexState.sess;changed=true;
          try{const mine=[...ltGridNums(apexGrid)].filter(n=>ltMineNums().has(n));if(mine.length)rtAlert('partenza|'+activeRaceId+'|'+ltCurLabel+'|'+first,'<i class="ic ic-flag"></i> PARTITA '+apexState.cat+' · '+apexState.sess,'alle '+first+' · in pista: '+mine.map(n=>'#'+n+' '+ltNameOf(n)).join(', '));}catch(e){}}
      }
      const fins=[...v.matchAll(/<b>(\d{1,2}:\d{2})<\/b>\s*<span[^>]*><\/span>\s*FINISH/gi)].map(x=>x[1]).filter(t=>!apexIgnore.has(t));
      if(fins.length&&apexState.start&&!apexFinished){
        apexFinished=fins[0];clearTimeout(apexEvalT);
        // aspetta che tutti passino sotto la bandiera a scacchi, poi valuta
        apexEvalT=setTimeout(()=>apexEvaluate('finish'),isDemoRace()?5000:75000);
      }
      const reds=[...v.matchAll(/<b>(\d{1,2}:\d{2})<\/b>\s*<span[^>]*data-flag="([^"]*)"[^>]*><\/span>\s*([^<]*)/gi)]
        .filter(x=>!apexIgnore.has(x[1])&&(/red|rouge|rossa/i.test(x[2])||/RED|ROSSA|ROUGE/i.test(x[3])))
        .map(x=>x[1])
        // la bandiera rossa conta solo a sessione in corso: quella data dopo l'arrivo è la chiusura della pista
        .filter(t=>{const tm=slotMins(t.replace(':','.'));const st=apexState.start?slotMins(apexState.start.replace(':','.')):-1;
          const fin=fins.length?Math.min(...fins.map(f=>slotMins(f.replace(':','.')))):Infinity;return tm>=st&&tm<fin;});
      const lastRed=reds.length?reds.sort((a,b)=>slotMins(b.replace(':','.'))-slotMins(a.replace(':','.')))[0]:'';
      if(apexState.red!==lastRed){apexState.red=lastRed;changed=true;
        try{if(lastRed){const mine=[...ltGridNums(apexGrid)].filter(n=>ltMineNums().has(n));if(mine.length)rtAlert('rossa|'+activeRaceId+'|'+apexState.cat+'|'+apexState.sess+'|'+lastRed,'<i class="ic ic-redflag"></i> BANDIERA ROSSA '+apexState.cat,apexState.sess+' · in pista: '+mine.map(n=>'#'+n).join(' '));}}catch(e){}}
    }
  });
  if(changed){apexState.at=Date.now();renderApexDelay();try{renderLtMyNums();if(activeTab==='programma')renderSchedule();}catch(e){}}
}
// Traduce categoria e sessione Apex nello slot del programma di oggi
/* 17/11/2026: la categoria del live si cerca prima tra le categorie della gara (entry list), poi con le regole.
   Prima "OK JUNIOR" diventava OK-NJ (la parola JUNIOR bastava): sbagliato quando in gara ci sono sia OKJ sia OK-N JUNIOR. */
function apexCat(t){
  const s=String(t||'').toUpperCase().replace(/\s+/g,' ').trim();
  let r;
  // 19/11/2026 (Andrea): le regole sui nomi valgono SOLO per WSK; le altre organizzazioni hanno categorie e numeri diversi
  let wsk=false;try{wsk=((races||{})[activeRaceId]||{}).org==='WSK';}catch(e){}
  if(!wsk)r=normCat(s);
  else if(/U10/.test(s))r='MINI U10';
  else if(/OK-?N\s*-?\s*J/.test(s))r='OK-NJ';
  else if(/^OK-?N\b/.test(s))r='OKN';
  else if(/^OK\s*-?\s*J/.test(s))r='OKJ';
  else if(/KZ2/.test(s))r='KZ2';
  else if(/^OK\b/.test(s))r='OK';
  else if(/MINI/.test(s))r='MINI GR3';
  else r=normCat(s);
  try{
    const cats=[...new Set(Object.values(currentEntryList||{}).map(e=>e&&e.cat).filter(Boolean))];
    const m=cats.find(c=>canonCat(c)===canonCat(s))||cats.find(c=>canonCat(c)===canonCat(r));
    if(m)return m;
  }catch(e){}
  return r;
}
/* 15/11/2026 (Andrea): se il live dice che in pista c'e' la finale di una categoria, quella e' la finale "ORA"
   (prima valeva solo l'orario: con il ritardo restava sulla finale precedente mentre l'altra era gia' al giro di ricognizione) */
function liveFinalCat(){try{if(!apexWs||apexWs.readyState!==1)return null;const ss=String(apexState.sess||'').toUpperCase();if(!/FINAL/.test(ss)||/PRE/.test(ss))return null;const c=apexCat(apexState.cat);return c?canonCat(c):null;}catch(e){return null;}}
function apexMatchSlot(){return apexMatchFor(apexState.cat,apexState.sess,apexState.start);}
// 22/11/2026 (Andrea): prefinali con qualsiasi nome, tutti i campionati: "Prefinal(e)", "Pre-Final", "Pre Final";
// lettera A/B, numero 1/2 (= A/B) o unica (senza lettera = la prefinale della categoria)
function rtPfNorm(t){return String(t||'').toUpperCase().replace(/PRE[\s\-_]*FINAL/g,'PREFINAL');}
function rtPfGroup(ss){const m=rtPfNorm(ss).match(/PREFINALE?\s*([A-D]|[1-4])\b/);return !m?'':/\d/.test(m[1])?'ABCD'[Number(m[1])-1]:m[1];}
function apexMatchFor(catTxt,sessTxt,startTxt){
  const cat=apexCat(catTxt);const ss=rtPfNorm(sessTxt);
  if(!cat||!ss)return null;
  const today=typeof autoDayName==='function'?autoDayName():activeDay;
  let arr=currentSchedule[today]||[];arr=Array.isArray(arr)?arr:Object.values(arr);
  const want=x=>{
    if(canonCat(x.cat)!==canonCat(cat))return false;
    const f=Array.isArray(x.filter)?x.filter.join('-'):String(x.filter||'');
    let m;
    if(/QUALIF/.test(ss)&&(m=ss.match(/S\s*(\d)/)))return x.type==='serie'&&f===m[1];
    // 20/11/2026: qualifica unica (OKN "Qualifying Practice", senza serie) = turno All/lista della categoria
    if(/QUALIF/.test(ss))return x.type==='all'||x.type==='list';
    // 20/11/2026: prove per serie (WSK "Free Practice Serie N") = turni di tipo serie N (il piu' vicino all'orario)
    if(/(FREE|PRACT|WARM)/.test(ss)&&(m=ss.match(/SERIE?S?\s*(\d)/)))return x.type==='serie'&&f===m[1];
    if(/(FREE|PRACT|WARM)/.test(ss)&&/EVEN|PARI/.test(ss))return x.type==='parity'&&f==='EVEN'&&(/WARM/.test(ss)===/WARM/i.test((x.session||'')+(x.label||''))||true);
    if(/(FREE|PRACT|WARM)/.test(ss)&&/ODD|DISPARI/.test(ss))return x.type==='parity'&&f==='ODD';
    // 19/11/2026: prove senza pari/dispari (KZ2, OKN "All", liste di numeri)
    if(/(FREE|PRACT|WARM)/.test(ss)&&!/QUALIF/.test(ss))return x.type==='all'||x.type==='list';
    if(/HEAT|MANCHE/.test(ss)&&(m=ss.match(/\b([A-H])\s*-\s*([A-H])\b/)))return x.type==='group'&&f.toUpperCase().replace(/\s/g,'')===(m[1]+'-'+m[2]);
    // 22/11/2026: prefinale con lettera/numero = quella del gruppo; unica (OKN "Prefinal") = la prefinale della categoria
    if(/PREFINAL/.test(ss)){const isPf=x.type==='prefinal'||/PREFINAL/.test(rtPfNorm((x.session||'')+' '+(x.label||'')+' '+(x.wsk||'')));
      const g=rtPfGroup(ss);return isPf&&(!g||!f||f.toUpperCase()===g);}
    return false;
  };
  // tra gli slot compatibili prende quello con orario più vicino alla partenza reale
  const cands=arr.filter(want);
  if(!cands.length)return null;
  const st=startTxt?slotMins(String(startTxt).replace(':','.')):null;
  if(st===null){const nm=new Date().getHours()*60+new Date().getMinutes()-(typeof scheduleDelay==='number'?scheduleDelay:0);cands.sort((a,b)=>Math.abs(slotMins(a.time)-nm)-Math.abs(slotMins(b.time)-nm));return{slot:cands[0],delay:null};}
  cands.sort((a,b)=>Math.abs(slotMins(a.time)-st)-Math.abs(slotMins(b.time)-st));
  const slot=cands[0];
  return{slot,delay:st-slotMins(slot.time)};
}
function renderApexDelay(){
  try{applyDelayPerms();}catch(e){}
  const box=document.getElementById('apex-delay-box');if(!box)return;
  if(!apexWsKey||!apexState.sess){box.style.display='none';return;}
  const m=apexMatchSlot();
  box.style.display='';
  const head='<div style="font-size:11px;font-weight:800;color:var(--text3);padding:8px 10px;border:1px solid var(--border2);border-radius:10px;background:var(--bg2)">'
    +'<i class="ic ic-signal"></i> LIVE: '+apexState.cat+' · '+apexState.sess+(apexState.start?' · partita '+apexState.start:'')
    +(apexState.red?'<div style="color:#f87171;margin-top:4px"><i class="ic ic-redflag"></i> Bandiera rossa alle '+apexState.red+': le prossime sessioni probabilmente slittano</div>':'');
  if(!m||m.delay===null){box.innerHTML=head+'<div style="color:var(--text4);margin-top:4px">'+(m?'In attesa della partenza':'Sessione non trovata nel programma di oggi')+'</div></div>';return;}
  const d=m.delay;const lbl=(d>0?'+':'')+d+' min';
  const same=d===scheduleDelay;
  const key=apexState.cat+'|'+apexState.sess+'|'+apexState.start;
  // salto di oltre 20 min rispetto al ritardo attuale = probabile sessione ripetuta (es. dopo bandiera rossa) o fuori programma: niente automatico
  const jump=Math.abs(d-(scheduleDelay||0))>20;
  if(apexAuto&&!same&&!jump&&Math.abs(d)<=120&&apexLastApplied!==key){apexLastApplied=key;setDelay(d,true);return;}
  box.innerHTML=head+'<div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">'
    +(jump&&!same?'<div style="width:100%;color:#fbbf24;font-weight:800"><i class="ic ic-wait"></i> Salto di '+Math.abs(d-(scheduleDelay||0))+' min: sessione ripetuta o fuori programma? Non applicato in automatico</div>':'')
    +'<span>Previsto '+m.slot.time+' → <b style="color:'+(d>0?'#f87171':d<0?'#60a5fa':'#4ade80')+'">'+(d===0?'in orario':lbl)+'</b></span>'
    +(same?'<span style="color:#4ade80"><i class="ic ic-check"></i> applicato</span>':(isDelayAdmin()?'<button onclick="setDelay('+d+')" style="padding:5px 10px;border-radius:7px;border:none;background:#22c55e;color:#000;font-weight:900;font-size:11px;cursor:pointer;font-family:inherit">APPLICA '+lbl+'</button>':''))
    +(isDelayAdmin()&&!apexAuto
      ?'<button onclick="toggleApexAuto()" style="margin-left:auto;padding:5px 8px;border-radius:7px;border:1px solid '+(apexAuto?'#22c55e':'var(--border2)')+';background:none;color:'+(apexAuto?'#22c55e':'var(--text4)')+';font-weight:800;font-size:10px;cursor:pointer;font-family:inherit">AUTO '+(apexAuto?'ON':'OFF')+'</button>'
      :'<span style="margin-left:auto;font-size:10px;font-weight:800;color:'+(apexAuto?'#22c55e':'var(--text4)')+'">AUTO '+(apexAuto?'ON':'OFF')+'</span>')
    +'</div></div>';
}
function toggleApexAuto(){if(!isDelayAdmin())return;apexAuto=!apexAuto;apexLastApplied='';if(activeRaceId)saveSharedField('apexAuto',apexAuto);renderApexDelay();}
window.toggleApexAuto=toggleApexAuto;
setInterval(()=>{if(!document.hidden&&activeRaceId)apexConnect();},20000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&activeRaceId){apexConnect();renderApexDelay();}});
setTimeout(()=>{if(activeRaceId)apexConnect();},3000);

// ── AGGIORNAMENTO AUTOMATICO DELL'APP ──
// Controlla se su GitHub Pages c'è una versione più nuova e ricarica da sola,
// così tutti i dispositivi (anche le PWA su iPhone) restano allineati.
/* APP_BUILD sta nella pagina HTML (kart_staging.html), cosi' il controllo versione legge la pagina */
let _lastUpdateCheck=0;
async function checkAppUpdate(){
  if(Date.now()-_lastUpdateCheck<60000)return;
  _lastUpdateCheck=Date.now();
  try{
    const r=await fetch(location.pathname+'?build='+Date.now(),{cache:'no-store'});
    if(!r.ok)return;
    const t=await r.text();
    const m=t.match(/const APP_BUILD='([^']+)'/);
    if(m&&m[1]!==APP_BUILD){
      const ae=document.activeElement;
      if(ae&&(ae.tagName==='TEXTAREA'||ae.tagName==='INPUT')&&ae.value)return; // non interrompere mentre scrivi
      location.replace(location.pathname+'?v='+m[1]+location.hash);
    }
  }catch(e){}
}
window.checkAppUpdate=checkAppUpdate;
setInterval(checkAppUpdate,120000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAppUpdate();});
setTimeout(checkAppUpdate,5000);

// Programma search
function filterProgramma(q){
  const resultsEl=document.getElementById('prog-search-results');
  const clearBtn=document.getElementById('prog-search-clear');
  const schedEl=document.getElementById('schedule-content');
  if(!q||!q.trim()){
    resultsEl.style.display='none';schedEl.style.display='';
    if(clearBtn)clearBtn.style.display='none';return;
  }
  if(clearBtn)clearBtn.style.display='block';
  schedEl.style.display='none';resultsEl.style.display='';
  const query=q.trim().toUpperCase();
  // Search in my pilots and entry list
  const matches=[];
  // My pilots first
  pilots.forEach(p=>{
    if(p.num.startsWith(query)||p.name.toUpperCase().includes(query)||p.team.toUpperCase().includes(query)){
      matches.push({num:p.num,name:p.name,team:p.team,cat:p.cat,isMine:true,eliminated:p.eliminated});
    }
  });
  // Entry list
  Object.entries(currentEntryList).forEach(([num,e])=>{
    if(matches.find(m=>m.num===num))return;
    const nameStr=((e.lastName||'')+' '+(e.firstName||'')).toUpperCase();
    const teamStr=(e.team||'').toUpperCase();
    if(num.startsWith(query)||nameStr.includes(query)||teamStr.includes(query)){
      matches.push({num,name:(e.lastName||'')+' '+(e.firstName||''),team:e.team||'',cat:e.cat||'',isMine:false});
    }
  });
  if(!matches.length){resultsEl.innerHTML='<div class="empty-state"><p>Nessun risultato</p></div>';return;}
  /* FIX 16/10/2026: ogni risultato mostra i turni di OGGI del pilota e (per i miei piloti) le pillole toccabili */
  const _dn=['DOMENICA','LUNEDÌ','MARTEDÌ','MERCOLEDÌ','GIOVEDÌ','VENERDÌ','SABATO'][new Date().getDay()];
  const _day=currentDays.includes(_dn)?_dn:activeDay;
  let _slots=(currentSchedule&&currentSchedule[_day])||[];
  if(!Array.isArray(_slots))_slots=Object.values(_slots);
  let html='<div style="font-size:10px;color:var(--text4);font-weight:700;margin-bottom:8px">'+matches.length+' RISULTATI · TURNI DI '+(_day||'')+'</div>';
  matches.forEach(m=>{
    const p=m.isMine?pilots.find(x=>x.num===m.num):null;
    const e=currentEntryList[m.num]||{};
    const subj=p||{num:m.num,cat:m.cat,group:e.group||'',serie:e.serie||'',prefinal:e.prefinal||'',heats:Array.isArray(e.heats)?e.heats:[],parity:autoParity(m.num)};
    const turni=_slots.filter(sl=>sl&&sl.cat&&_progSlotMatch(subj,sl));
    html+='<div class="search-result-item" style="flex-direction:column;align-items:stretch;'+(m.isMine?'border-color:#22c55e;background:rgba(34,197,94,.06)':'')+'">'
      +'<div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="openPilotDetail(\''+m.num+'\')">'
      +'<span class="sr-num" style="'+(m.isMine?'color:#22c55e':'')+'">#'+m.num+'</span>'
      +'<div style="flex:1;min-width:0">'
      +'<div class="sr-name">'+m.name+(m.isMine?' <span style="font-size:10px;color:#22c55e;font-weight:800"><i class="ic ic-star"></i></span>':'')+(m.eliminated?' <span style="font-size:9px;color:#ef4444">ELIM</span>':'')+'</div>'
      +'<div style="font-size:13px;font-weight:800;color:var(--text2)">'+m.team+'</div></div>'
      +'<span class="sr-cat '+catClass(m.cat)+'" style="padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800">'+m.cat+'</span></div>'
      +'<div style="margin-top:8px;font-size:12px;font-weight:800;color:var(--text2)">'
      +(turni.length?turni.map(sl=>'<span style="display:inline-block;margin:0 6px 4px 0;padding:3px 8px;border-radius:8px;border:1px solid var(--border2)"><b style="color:#fbbf24">'+sl.time+'</b> '+(sl.session?sl.session+' · ':'')+slotFilterLabel(sl)+'</span>').join(''):'<span style="color:var(--text4)">Nessun turno oggi</span>')
      +'</div>'
      +(p?'<div class="tasks" style="margin-top:6px">'+TASKS.map(t=>'<button class="task-btn '+((statuses[p.num]&&statuses[p.num][t])||'red')+'" style="padding:4px 8px;font-size:10px" onclick="progToggleTask(\''+p.num+'\',\''+t+'\')">'+t+'</button>').join('')+'</div>':'')
      +'</div>';
  });
  resultsEl.innerHTML=html;
}
window.filterProgramma=filterProgramma;
function _progSlotMatch(p,slot){
  if(p.eliminated)return false;
  if(p.cat!==slot.cat)return false;
  if(slot.type==='all')return true;
  if(slot.type==='parity')return p.parity===slot.filter;
  if(slot.type==='serie'){if(!pSerie(p))return false;return pSerie(p)===String(slot.filter).trim();}
  if(slot.type==='group')return pilotInGroup(p,Array.isArray(slot.filter)?slot.filter:[slot.filter]);
  if(slot.type==='prefinal'){if(!p.prefinal)return false;return String(p.prefinal).trim().toUpperCase()===String(slot.filter).trim().toUpperCase();}
  if(slot.type==='list'){if(!Array.isArray(slot.filter))return false;return slot.filter.map(String).includes(String(p.num));}
  return false;
}
function progToggleTask(num,task){
  toggleTask(num,task);
  const inp=document.getElementById('prog-search');
  if(inp&&inp.value.trim())filterProgramma(inp.value);
}
window.progToggleTask=progToggleTask;
function clearProgSearch(){
  const inp=document.getElementById('prog-search');if(inp)inp.value='';
  filterProgramma('');
  const resEl=document.getElementById('prog-search-results');if(resEl)resEl.style.display='none';
  const sched=document.getElementById('schedule-content');if(sched)sched.style.display='';
}
window.clearProgSearch=clearProgSearch;

// ══════════════════════════════════════
// RENDER PISTA
// ══════════════════════════════════════
function showPistaView(v){pistaView=v;localStorage.setItem('rt_pista',v);document.querySelectorAll('.subtab').forEach((b,i)=>b.classList.toggle('active',['pilota','sessione'][i]===v));renderPista();}
window.showPistaView=showPistaView;

function renderPista(){
  const sl=document.getElementById('sections-list');
  if(sl)sl.innerHTML=trackSections.map((s,i)=>'<div class="section-chip" ondblclick="editSectionInline('+i+')">'
    +'<span>'+s+'</span><span class="del" onclick="deleteSection('+i+')"><i class="ic ic-close"></i></span></div>').join('');
  const el=document.getElementById('pista-content');
  if(!pilots.length){el.innerHTML='<div class="empty-state"><p>Nessun pilota</p></div>';return;}
  if(pistaView==='pilota'){
    el.innerHTML=pilots.map(p=>'<div class="card '+hlClassOf(p.highlight)+'">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
      +'<span class="pilot-num">#'+p.num+'</span>'+riskTri(p.num)+'<span class="pilot-name">'+p.name+'</span>'+reelChip(p)+fotoChips(p)+persChip(p)
      +'<span class="pilot-cat '+catClass(p.cat)+'" style="margin-left:auto">'+p.cat+'</span>'+noteBtn(p.num)+'</div>'
      +noteLine(p.num)
      +'<div class="track-grid">'+trackSections.map(s=>{
        const st=trackStatus[p.num]?.[s]||'none';
        return'<button class="track-btn '+(st==='none'?'':st)+'" onclick="toggleTrack(\''+p.num+"','"+s+"')\">"+s+'</button>';
      }).join('')+'</div></div>').join('');
  } else {
    el.innerHTML=trackSections.map(s=>{
      const covered=pilots.filter(p=>(trackStatus[p.num]?.[s]||'none')!=='none');
      return'<div class="card"><div style="font-size:13px;font-weight:800;margin-bottom:8px">'+s
        +' <span style="font-size:11px;color:var(--text4);font-weight:600">'+covered.length+'/'+pilots.length+'</span></div>'
        +'<div class="track-session-grid">'+pilots.map(p=>{
          const st=trackStatus[p.num]?.[s]||'none';
          return'<button class="track-pilot-btn '+(st==='none'?'':st)+'" onclick="toggleTrack(\''+p.num+"','"+s+"')\">#"+p.num+'</button>';
        }).join('')+'</div></div>';
    }).join('');
  }
}
function addSection(){const inp=document.getElementById('new-section-input');const v=inp.value.trim().toUpperCase();if(!v)return;trackSections.push(v);inp.value='';saveSharedField('trackSections',trackSections);renderPista();}
window.addSection=addSection;
function deleteSection(i){if(!confirm('Eliminare?'))return;trackSections.splice(i,1);saveSharedField('trackSections',trackSections);renderPista();}
window.deleteSection=deleteSection;
function editSectionInline(i){const chips=document.querySelectorAll('.section-chip');const chip=chips[i];if(!chip)return;const old=trackSections[i];const inp=document.createElement('input');inp.value=old;inp.className='add-input';inp.style.width='100%';chip.innerHTML='';chip.appendChild(inp);inp.focus();inp.select();const finish=()=>{const v=inp.value.trim().toUpperCase();if(v&&v!==old){trackSections[i]=v;saveSharedField('trackSections',trackSections);}renderPista();};inp.onblur=finish;inp.onkeydown=e=>{if(e.key==='Enter')inp.blur();if(e.key==='Escape')renderPista();};}
window.editSectionInline=editSectionInline;

// ══════════════════════════════════════
// MODAL + ADD/EDIT PILOT
// ══════════════════════════════════════
/* ══ PROMEMORIA PERSONALI (20/11/2026, Andrea) ══
   Agganciati a un turno del programma: scattano X minuti prima dell'orario del turno PIU' il ritardo live.
   Salvati in races/<gara>/reminders/<utente>/<id>; la notifica push la manda il server (monitor), cosi' arriva anche a telefono in tasca. */
let reminders={},_remRef=null,_remKey='';
const REM_BEFORE=[0,5,10,15,20,30,45,60];
function remAttach(){if(!activeRaceId||!currentUserId)return;const k=activeRaceId+'|'+currentUserId;if(k===_remKey)return;_remKey=k;reminders={};
  onValue(ref(db,'races/'+activeRaceId+'/reminders/'+currentUserId),sn=>{if(_remKey!==k)return;reminders=sn.val()||{};window._rtRenderDirty=true;try{remRenderMine();}catch(_){}try{if(activeTab==='programma')renderAll();}catch(_){}});}
function remSlotKey(slot,day){return[day||activeDay,slot.time,slot.cat,[].concat(slot.filter||'').join('-')].join('|');}
function remOfSlot(slot,day){try{remAttach();}catch(_){}const k=remSlotKey(slot,day);return Object.entries(reminders||{}).filter(([id,r])=>r&&r.slot===k);}
function remFindSlot(k){for(const d of currentDays||[]){const sl=(currentSchedule[d]||[]).find(x=>remSlotKey(x,d)===k);if(sl)return{day:d,slot:sl};}return null;}
function remBeforeTxt(b){return b?b+'′ prima':'all\'ora';}
function remLine(slot){const l=remOfSlot(slot);if(!l.length)return'';
  return l.map(([id,r])=>'<div class="rem-line" onclick="event.stopPropagation();openReminder(\''+remSlotKey(slot).replace(/'/g,"\\'")+'\')"><i class="ic ic-bell"></i> '+(r.num?'<b>#'+escAttr(r.num)+'</b> ':'')+escapeHtmlSp(r.text||'Promemoria')+' <span>· '+[].concat(r.before||[]).sort((a,b)=>b-a).map(remBeforeTxt).join(', ')+'</span></div>').join('');}
let _remEdit=null;
function openReminder(k){const f=remFindSlot(k);if(!f)return;
  _remEdit={k,slot:f.slot,day:f.day,before:new Set([10]),num:'',text:''};renderReminder();}
window.openReminder=openReminder;
function renderReminder(){const e=_remEdit;if(!e)return;const sl=e.slot;
  let ps=[];try{ps=pilotsForSlot(sl).map(p=>({num:String(p.num),name:p.name}));teamsForSlot(sl).forEach(x=>x.inSlot.concat(x.waiting||[]).forEach(p=>{if(!ps.some(q=>q.num===String(p.num)))ps.push({num:String(p.num),name:p.name});}));}catch(_){}
  ps.sort((a,b)=>(parseInt(a.num)||0)-(parseInt(b.num)||0));
  const d=parseInt(scheduleDelay)||0,h=[];
  h.push('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>');
  h.push('<button class="rem-back" onclick="openRemPanel()">← Tutti i promemoria</button>');
  h.push('<div class="modal-title"><i class="ic ic-bell"></i> Promemoria · '+escapeHtmlSp(e.day.slice(0,3))+' '+escapeHtmlSp(sl.time)+' '+escapeHtmlSp(sl.label||sl.cat)+' '+escapeHtmlSp(slotFilterLabel(sl))+'</div>');
  h.push('<div class="sp-sub">Orario turno '+sl.time+(d?' + ritardo live '+d+'′':'')+'. Arriva come notifica, anche con l\'app chiusa.</div>');
  const ex=remOfSlot(sl,e.day);
  if(ex.length)h.push('<div class="rem-list">'+ex.map(([id,r])=>'<div class="rem-item"><div>'+(r.num?'<b>#'+escapeHtmlSp(r.num)+'</b> ':'')+escapeHtmlSp(r.text||'Promemoria')+'<br><span>'+[].concat(r.before||[]).sort((a,b)=>b-a).map(remBeforeTxt).join(', ')+'</span></div><button class="pilot-edit-btn" style="color:#ef4444;border-color:#ef4444" onclick="remDelete(\''+id+'\')"><i class="ic ic-close"></i></button></div>').join('')+'</div>');
  h.push('<div class="rem-lbl">Pilota (facoltativo)</div><select id="rem-num" class="add-input" onchange="_remEdit.num=this.value"><option value="">— nessuno —</option>'+ps.map(p=>'<option value="'+p.num+'"'+(e.num===p.num?' selected':'')+'>#'+p.num+' '+escapeHtmlSp(p.name||'')+'</option>').join('')+'</select>');
  h.push('<div class="rem-lbl">Cosa fare</div><input id="rem-text" class="add-input" maxlength="80" placeholder="es. clip pregriglia, bilancia, gara" value="'+escapeHtmlSp(e.text)+'" oninput="_remEdit.text=this.value">');
  h.push('<div class="rem-lbl">Avvisami</div><div class="rem-chips">'+REM_BEFORE.map(b=>'<button class="rem-chip'+(e.before.has(b)?' on':'')+'" onclick="remToggleBefore('+b+')">'+remBeforeTxt(b)+'</button>').join('')+'</div>');
  h.push('<button class="btn-add-pilot" style="width:100%;min-height:48px;margin-top:12px;border-radius:12px;font-weight:900" onclick="remSave()">SALVA PROMEMORIA</button>');
  openModal(h.join(''));}
function remToggleBefore(b){const s=_remEdit.before;if(s.has(b))s.delete(b);else s.add(b);renderReminder();}
function remSave(){const e=_remEdit;if(!e||!activeRaceId||!currentUserId)return;if(!e.before.size){alert('Scegli almeno un momento');return;}
  const id='r'+Date.now().toString(36),sl=e.slot,p=e.num?((pilots.find(x=>String(x.num)===e.num))||spotPilotOf(e.num)||{}):{};
  const val={slot:e.k,day:e.day,time:String(sl.time),cat:sl.cat,label:[sl.label||sl.cat,slotFilterLabel(sl)].filter(Boolean).join(' '),num:e.num||'',name:p.name||'',text:String(e.text||'').trim().slice(0,80),before:[...e.before].sort((a,b)=>b-a),at:Date.now()};
  reminders[id]=val;ref(db,'races/'+activeRaceId+'/reminders/'+currentUserId+'/'+id).set(val).then(()=>{try{if(navigator.vibrate)navigator.vibrate(15);}catch(_){}}).catch(err=>alert('Promemoria non salvato: '+err.message));
  _remEdit={k:e.k,slot:sl,day:e.day,before:new Set([10]),num:'',text:''};renderReminder();window._rtRenderDirty=true;}
function remDelete(id){if(!confirm('Eliminare il promemoria?'))return;delete reminders[id];ref(db,'races/'+activeRaceId+'/reminders/'+currentUserId+'/'+id).remove();renderReminder();window._rtRenderDirty=true;}
/* pannello unico (Impostazioni → PROMEMORIA): cerca il turno e vedi tutti i promemoria della gara */
let _remQ='';
/* 21/11/2026 (Andrea): contatore spesa AI del server (aiUsage/<mese>), visibile solo all'amministratore. Una lettura quando si apre/tocca, nessun listener. */
async function loadAiUsage(force){
  try{if(!isDelayAdmin())return;const el=document.getElementById('ai-usage-txt');if(!el)return;
    const now=new Date(),mon=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    const B='https://karting-tools-default-rtdb.firebaseio.com/aiUsage/';
    const [m,lg,bu]=await Promise.all([fetch(B+mon+'.json').then(r=>r.json()),fetch(B+'log.json?orderBy=%22$key%22&limitToLast=3').then(r=>r.json()).catch(()=>null),fetch(B+'budgetUsd.json').then(r=>r.json()).catch(()=>null)]);
    const bud=parseFloat(bu)||5;
    const eur=x=>'≈ '+(x*0.93).toFixed(x<1?3:2).replace('.',',')+' €';
    if(!m){el.textContent='questo mese: 0 € · nessuna chiamata · budget '+bud+' $';return;}
    const last=Object.values(lg||{}).sort((a,b)=>b.at-a.at)[0];
    const pc=Math.round(100*(m.usd||0)/bud);
    el.innerHTML='questo mese <b>'+eur(m.usd||0)+'</b> <span style="color:'+(pc>=80?'#ef4444':pc>=50?'#f97316':'#22c55e')+';font-weight:800">('+pc+'% di '+bud+' $)</span> · '+(m.calls||0)+' chiamate · '+Math.round(((m.inTok||0)+(m.outTok||0))/1000)+'k token'
      +(last?'<br><span style="font-size:11px;color:var(--text4)">ultima: '+new Date(last.at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' · '+String(last.what||'').replace(/</g,'&lt;')+'</span>':'');
  }catch(e){const el=document.getElementById('ai-usage-txt');if(el)el.textContent='non disponibile';}
}
window.loadAiUsage=loadAiUsage;
/* 21/11/2026 (Andrea): REGISTRO INTERVENTI AI (aiUsage/eventi): quando l'AI interviene, su cosa e cosa decide. Solo admin, lettura singola. */
async function openAiLog(){
  if(!isDelayAdmin())return;const esc=x=>String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button><button class="rem-back" onclick="openSettings()">← Impostazioni</button><div class="modal-title"><i class="ic ic-chip"></i> Registro AI</div><div id="ailog-body" class="sp-sub">Carico…</div>');
  try{const d=await fetch('https://karting-tools-default-rtdb.firebaseio.com/aiUsage/eventi.json?orderBy=%22$key%22&limitToLast=40').then(r=>r.json());
    const L=Object.values(d||{}).sort((a,b)=>b.at-a.at);const el=document.getElementById('ailog-body');if(!el)return;
    const col=e=>/APPLICATO|riassunto|^ok|risposta/i.test(e)?'#22c55e':/riusato/i.test(e)?'#3b82f6':/diverso/i.test(e)?'#ef4444':'#f97316';
    const ico={timetable:'<i class="ic ic-calendar"></i>',classifica:'<i class="ic ic-note"></i>',controllo:'<i class="ic ic-search"></i>',decisione:'<i class="ic ic-flag"></i>',chat:'<i class="ic ic-chat"></i>'};
    el.innerHTML=L.length?L.map(x=>'<div class="card-inner" style="border-left:4px solid '+col(x.esito)+';margin-bottom:6px"><div style="font-size:11px;color:var(--text4)">'+new Date(x.at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' · '+(ico[x.tipo]||'')+' '+esc(x.tipo)+'</div>'
      +'<div style="font-size:13px;font-weight:800;color:'+col(x.esito)+'">'+esc(x.esito)+'</div><div style="font-size:12px;color:var(--text2)">'+esc(x.cosa)+'</div>'+(x.dettaglio?'<div style="font-size:11px;color:var(--text4)">→ '+esc(x.dettaglio)+'</div>':'')+'</div>').join('')
      :'Nessun intervento registrato ancora.';
  }catch(e){const el=document.getElementById('ailog-body');if(el)el.textContent='Registro non disponibile.';}
}
window.openAiLog=openAiLog;
/* 21/11/2026 (Andrea): EMERGENZA "FOTO PROGRAMMA" (solo admin). Casi estremi: Timetable ufficiale introvabile o illeggibile.
   Foto dal telefono → ttPhotoImg/<gara>/<id> (JPEG ridotte) + ttPhoto/<gara>/<id> {status:'nuovo'}. Il server le fa leggere a Sonnet
   (due letture uguali + controlli) e scrive l'anteprima; qui si conferma con APPLICA. Si sostituiscono solo i giorni fotografati.
   Il Timetable ufficiale, appena leggibile, prende il posto del programma da foto. Un solo ascolto, solo mentre la scheda e' aperta. */
let _ttpRef=null,_ttpFiles=[];
function ttpOff(){try{if(_ttpRef)_ttpRef.off();}catch(e){}_ttpRef=null;}
function openTtPhoto(){
  if(!isDelayAdmin()||!activeRaceId)return;ttpOff();_ttpFiles=[];
  openModal('<button class="modal-close" onclick="ttpOff();closeModal()"><i class="ic ic-close"></i></button><button class="rem-back" onclick="ttpOff();openSettings()">← Impostazioni</button><div class="modal-title"><i class="ic ic-camera"></i> Foto programma</div>'
    +'<div class="sp-sub">Emergenza: fotografa il programma esposto in circuito (una foto per pagina, dritta, intera, con il nome del giorno visibile). Lo legge l\'AI due volte: se non è sicura non scrive niente.</div>'
    +'<input id="ttp-in" type="file" accept="image/*" capture="environment" multiple style="display:none" onchange="ttpAdd(this.files)">'
    +'<button class="btn-add-team" style="min-height:48px;width:100%;margin:10px 0;font-weight:900" onclick="document.getElementById(\'ttp-in\').click()"><i class="ic ic-camera"></i> SCATTA / AGGIUNGI FOTO</button>'
    +'<div id="ttp-list" style="display:flex;gap:6px;flex-wrap:wrap"></div><div id="ttp-state" style="margin-top:10px"></div>');
}
function ttpAdd(fl){
  [...(fl||[])].slice(0,8-_ttpFiles.length).forEach(f=>_ttpFiles.push(f));
  const el=document.getElementById('ttp-list');if(!el)return;
  el.innerHTML=_ttpFiles.map((f,i)=>'<img src="'+URL.createObjectURL(f)+'" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">').join('');
  const st=document.getElementById('ttp-state');if(st&&_ttpFiles.length)st.innerHTML='<button class="btn-add-team" style="min-height:48px;width:100%;background:#ef4444;color:#fff;font-weight:900" onclick="ttpSend()">INVIA '+_ttpFiles.length+' FOTO</button>';
}
function ttpJpeg(f){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{const k=Math.min(1,1800/Math.max(im.width,im.height));const c=document.createElement('canvas');
  c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.82).split(',')[1]);};im.onerror=rej;im.src=URL.createObjectURL(f);});}
async function ttpSend(){
  const st=document.getElementById('ttp-state');if(!_ttpFiles.length||!st)return;st.innerHTML='<div class="sp-sub">Preparo le foto…</div>';
  try{const imgs=[];for(const f of _ttpFiles)imgs.push(await ttpJpeg(f));
    const id=String(Date.now());
    await _fbDb.ref('ttPhotoImg/'+activeRaceId+'/'+id).set(imgs);
    await _fbDb.ref('ttPhoto/'+activeRaceId+'/'+id).set({user:currentUserId,at:Date.now(),status:'nuovo',n:imgs.length});
    _ttpRef=_fbDb.ref('ttPhoto/'+activeRaceId+'/'+id);_ttpRef.on('value',sn=>ttpRender(id,sn.val()));
  }catch(e){st.innerHTML='<div style="color:#ef4444;font-weight:800">Invio non riuscito: '+String(e.message||e).replace(/</g,'&lt;')+'</div>';}
}
function ttpRender(id,q){
  const st=document.getElementById('ttp-state');if(!st){ttpOff();return;}if(!q)return;const esc=x=>String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  if(q.status==='nuovo'||q.status==='in lettura'){st.innerHTML='<div class="sp-sub"><i class="ic ic-wait"></i> L\'AI sta leggendo il programma (1–3 minuti)…</div>';return;}
  if(q.status==='in scrittura'){st.innerHTML='<div class="sp-sub"><i class="ic ic-wait"></i> Scrivo il programma…</div>';return;}
  if(q.status==='errore'){ttpOff();st.innerHTML='<div style="color:#ef4444;font-weight:900">Non applicato</div><div class="sp-sub">'+esc(q.motivo)+'</div>';return;}
  if(q.status==='applicato'){ttpOff();st.innerHTML='<div style="color:#22c55e;font-weight:900"><i class="ic ic-check"></i> Programma aggiornato</div><div class="sp-sub">Copia del programma di prima salvata sul server. Appena il Timetable ufficiale si legge, prende il suo posto.</div>';return;}
  if(q.status==='letto'){
    const g=q.giorni||{},tt=q.tt||{};
    const prev=(tt.days||[]).map(d=>'<div style="margin-top:8px;font-weight:900">'+esc(d)+' · '+(g[d]||0)+' turni</div>'
      +((tt.schedule||{})[d]||[]).map(x=>'<div style="font-size:12px;font-family:monospace">'+esc(x.time)+' '+esc(x.cat)+' '+esc([].concat(x.filter||[]).length>6?(x.filter[0]+'–'+x.filter[x.filter.length-1]):[].concat(x.filter||[]).join(' '))+' '+esc(x.type||'')+'</div>').join('')).join('');
    st.innerHTML='<div style="font-weight:900">Letto: '+(q.turni||0)+' turni'+(q.finali?' · '+q.finali+' finali':'')+'</div><div class="sp-sub">Controlla che corrisponda alla foto. Si sostituiscono solo i giorni qui sotto.</div>'+prev
      +'<button class="btn-add-team" style="min-height:48px;width:100%;margin-top:10px;background:#22c55e;color:#000;font-weight:900" onclick="ttpApply(\''+id+'\')">APPLICA AL PROGRAMMA</button>';
  }
}
function ttpApply(id){if(!isDelayAdmin())return;_fbDb.ref('ttPhoto/'+activeRaceId+'/'+id).update({apply:true,applyBy:currentUserId});}
window.openTtPhoto=openTtPhoto;window.ttpAdd=ttpAdd;window.ttpSend=ttpSend;window.ttpApply=ttpApply;window.ttpOff=ttpOff;
/* 21/11/2026 (Andrea): chat AI in pista — per ora solo amministratore. La domanda va in races/<gara>/aiChat/<utente>; risponde il
   server (la chiave non e' mai nell'app). Un solo ascolto, attivo solo mentre la chat e' aperta. */
let _aiChatOff=null,_aiChatMsgs={};
/* 21/11/2026 (Andrea): chat anche per Riccardo; spesa e registro AI restano solo all'amministratore. Il controllo vero e' sul server. */
const AI_CHAT_USERS=['ricki'];
function aiChatAllowed(){return isDelayAdmin()||AI_CHAT_USERS.includes(String(currentUserId||'').toLowerCase());}
function openAiChat(){
  if(!aiChatAllowed()||!activeRaceId)return;
  openModal('<button class="modal-close" onclick="closeAiChat()"><i class="ic ic-close"></i></button><button class="rem-back" onclick="closeAiChat();openSettings()">← Impostazioni</button><div class="modal-title"><i class="ic ic-chat"></i> Chiedi all\'AI</div>'
    +'<div class="sp-sub">Risponde con i dati di questa gara: programma, ritardo, i tuoi piloti e quelli dei team. Non modifica niente.</div>'
    +'<div id="aic-list" style="display:flex;flex-direction:column;gap:8px;margin:10px 0;max-height:50vh;overflow:auto"></div>'
    +'<div style="display:flex;gap:8px"><input id="aic-q" class="add-input" style="flex:1;margin:0" placeholder="Es. chi dei miei corre dopo pranzo?" onkeydown="if(event.key===\'Enter\')aiChatSend()" autocomplete="off">'
    +'<button onclick="aiChatSend()" style="min-width:64px;min-height:44px;border-radius:10px;border:none;background:#a78bfa;color:#111;font-weight:900;font-family:inherit">Invia</button></div>');
  try{if(_aiChatOff)_aiChatOff();}catch(e){}
  const qr=_fbDb.ref('races/'+activeRaceId+'/aiChat/'+currentUserId).limitToLast(10),cb=sn=>{_aiChatMsgs=sn.val()||{};aiChatRender();};
  qr.on('value',cb);_aiChatOff=()=>qr.off('value',cb);
  setTimeout(()=>{const q=document.getElementById('aic-q');if(q)q.focus();},50);
}
function closeAiChat(){try{if(_aiChatOff)_aiChatOff();}catch(e){}_aiChatOff=null;closeModal();}
function aiChatRender(){const el=document.getElementById('aic-list');if(!el)return;const esc=x=>String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>');
  const L=Object.entries(_aiChatMsgs).sort((a,b)=>(a[1].at||0)-(b[1].at||0));
  if(!L.length){el.innerHTML='<div style="font-size:13px;color:var(--text4)">Nessuna domanda ancora.</div>';return;}
  el.innerHTML=L.map(([k,m])=>'<div style="align-self:flex-end;background:var(--bg3);border-radius:10px;padding:8px 10px;font-size:14px;max-width:90%">'+esc(m.q)+'</div>'
    +'<div style="align-self:flex-start;border:1px solid #a78bfa;border-radius:10px;padding:8px 10px;font-size:14px;max-width:95%">'+(m.a?esc(m.a):m.err?'<span style="color:#f97316">'+esc(m.err)+'</span>':'<span style="color:var(--text4)">sta pensando…</span>')+'</div>').join('');
  el.scrollTop=el.scrollHeight;}
function aiChatSend(){const i=document.getElementById('aic-q');const q=(i&&i.value||'').trim();if(!q||!activeRaceId)return;i.value='';
  _fbDb.ref('races/'+activeRaceId+'/aiChat/'+currentUserId).push({q:q.slice(0,500),at:Date.now()}).catch(()=>{});}
window.openAiChat=openAiChat;window.closeAiChat=closeAiChat;window.aiChatSend=aiChatSend;
function openRemPanel(){try{remAttach();}catch(_){}_remEdit=null;
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button><button class="rem-back" onclick="openSettings()">← Impostazioni</button><div class="modal-title"><i class="ic ic-bell"></i> Promemoria</div>'
    +'<div class="sp-sub">Cerca il turno (es. "ok-nj a-e", "16.40", "kz2 sabato") e scegli quando essere avvisato. L\'orario segue il ritardo live.</div>'
    +'<input id="rem-q" class="add-input" type="search" placeholder="Cerca turno…" value="'+escapeHtmlSp(_remQ)+'" oninput="_remQ=this.value;remRenderResults()" autocomplete="off">'
    +'<div id="rem-res"></div><div class="rem-lbl">I tuoi promemoria</div><div id="rem-mine"></div>');
  remRenderResults();remRenderMine();setTimeout(()=>{const q=document.getElementById('rem-q');if(q&&!_remQ)q.focus();},50);}
window.openRemPanel=openRemPanel;
function remSlotText(sl,d){return[d,sl.time,sl.cat,sl.label||'',slotFilterLabel(sl),[].concat(sl.filter||'').join('-')].join(' ');}
function remRenderResults(){const el=document.getElementById('rem-res');if(!el)return;const q=String(_remQ||'').toLowerCase().replace(/[.:]/g,'.').trim();
  if(!q){el.innerHTML='';return;}const tk=q.split(/\s+/).filter(Boolean);const out=[];
  // 20/11/2026 (Andrea): solo turni che devono ancora esserci (giorni passati esclusi; oggi solo da adesso in poi, ritardo compreso)
  let td=-1;try{const tn=autoDayName();td=(currentDays||[]).indexOf(tn);}catch(_){}
  const nowMin=new Date().getHours()*60+new Date().getMinutes(),dl=parseInt(scheduleDelay)||0;
  const future=(d,sl)=>{const di=(currentDays||[]).indexOf(d);if(td<0)return true;if(di<td)return false;if(di>td)return true;return hm2minRem(sl.time)+dl>=nowMin;};
  (currentDays||[]).forEach(d=>(currentSchedule[d]||[]).forEach(sl=>{if(!future(d,sl))return;const t=remSlotText(sl,d).toLowerCase().replace(/[.:]/g,'.');if(tk.every(x=>t.indexOf(x)>=0))out.push({d,sl});}));
  el.innerHTML=out.length?'<div class="rem-list">'+out.slice(0,25).map(({d,sl})=>{const k=remSlotKey(sl,d),n=remOfSlot(sl,d).length;
    return'<div class="rem-res" onclick="openReminder(\''+k.replace(/'/g,"\\'")+'\')"><b>'+escapeHtmlSp(d.slice(0,3))+' '+escapeHtmlSp(sl.time)+'</b> <span class="'+catClass(sl.cat)+'">'+escapeHtmlSp(sl.label||sl.cat)+'</span> '+escapeHtmlSp(slotFilterLabel(sl))+(n?' <i><i class="ic ic-bell"></i> '+n+'</i>':'')+'</div>';}).join('')+'</div>'
    :'<div class="sp-sub">Nessun turno trovato.</div>';}
function remRenderMine(){const el=document.getElementById('rem-mine');if(!el)return;const l=Object.entries(reminders||{}).filter(([,r])=>r);
  const ord=d=>(currentDays||[]).indexOf(d);l.sort((a,b)=>ord(a[1].day)-ord(b[1].day)||hm2minRem(a[1].time)-hm2minRem(b[1].time));
  el.innerHTML=l.length?'<div class="rem-list">'+l.map(([id,r])=>'<div class="rem-item" onclick="openReminder(\''+String(r.slot).replace(/'/g,"\\'")+'\')"><div><b>'+escapeHtmlSp(String(r.day||'').slice(0,3))+' '+escapeHtmlSp(r.time)+'</b> '+escapeHtmlSp(r.label||r.cat||'')+'<br>'+(r.num?'#'+escapeHtmlSp(r.num)+' ':'')+escapeHtmlSp(r.text||'')+' <span>· '+[].concat(r.before||[]).map(remBeforeTxt).join(', ')+'</span></div><span style="font-size:18px">›</span></div>').join('')+'</div>'
    :'<div class="sp-sub">Nessun promemoria per questa gara.</div>';}
function hm2minRem(t){const p=String(t||'').split(/[.:]/);return(parseInt(p[0])||0)*60+(parseInt(p[1])||0);}
window.remToggleBefore=remToggleBefore;window.remSave=remSave;window.remDelete=remDelete;
function openModal(html){document.getElementById('modal-inner').innerHTML=html;document.getElementById('modal').style.display='flex';}
function closeModal(){document.getElementById('modal').style.display='none';try{spotPillsRefresh();}catch(_){}if(window._rtDeferRender){window._rtDeferRender=false;if(window._rtRenderDirty){window._rtRenderDirty=false;try{renderAll();}catch(e){}}}}
function closeModalOutside(e){if(e.target===document.getElementById('modal'))closeModal();}
window.closeModal=closeModal;window.closeModalOutside=closeModalOutside;

let _entryPreview=null;
/* 19/11/2026 (Andrea): ogni account ha un lavoro predefinito (FOTO o VIDEO) scelto alla creazione dell'account;
   andrea = VIDEO, gli altri senza scelta = FOTO. Reel predefinito 30". Foto/video e reel non possono restare vuoti. */
function defaultHl(){const v=(typeof userSettings!=='undefined'&&userSettings&&userSettings.defaultHl)||'';return v==='video'||v==='foto'?v:(currentUserId==='andrea'?'video':'foto');}
let _addHl=[],_addReel='30';
function addHlHtml(){return[['foto','<i class="ic ic-hl-foto"></i><span>FOTO</span>'],['video','<i class="ic ic-hl-video"></i><span>VIDEO</span>'],['priority','<i class="ic ic-hl-prio"></i><span>PRIORITÀ</span>']]
  .map(([k,h])=>'<div class="hl-option hl-'+k+(_addHl.includes(k)?' active':'')+'" onclick="toggleAddHl(\''+k+'\')">'+h+'</div>').join('');}
function toggleAddHl(k){if(_addHl.includes(k)){if(_addHl.length===1)return;_addHl=_addHl.filter(x=>x!==k);}else _addHl=_addHl.concat(k);   // mai vuoto
  const el=document.getElementById('f-hl');if(el)el.innerHTML=addHlHtml();
  const w=document.getElementById('f-reel-wrap');if(w)w.style.display=_addHl.includes('video')?'':'none';}
function addReelHtml(){return REEL_OPTS.map(([v,l])=>'<button type="button" onclick="setAddReel(\''+v+'\')" style="flex:1;min-height:44px;border-radius:8px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;'
  +(_addReel===v?'background:#e9d5a8;color:#1a160e;border:1px solid #e9d5a8':'background:none;color:var(--text3);border:1px solid var(--border2,#444)')+'">'+l+'</button>').join('');}
function setAddReel(v){_addReel=v;const el=document.getElementById('f-reel');if(el)el.innerHTML=addReelHtml();
  // 20/11/2026 (Andrea): video da 1' = priorita' automatica (si puo' togliere a mano)
  if(v==='60'&&!_addHl.includes('priority')){_addHl=_addHl.concat('priority');const h=document.getElementById('f-hl');if(h)h.innerHTML=addHlHtml();}}
/* stessa regola per piloti e team gia' inseriti: passando a 1' si aggiunge PRIORITA' (solo in quel momento) */
function reelPrio(o,v){if(!o||v!=='60')return;const h=Array.isArray(o.highlight)?o.highlight.slice():(o.highlight?[o.highlight]:[]);if(!h.includes('priority')){h.push('priority');o.highlight=h;}}
window.setAddReel=setAddReel;
window.toggleAddHl=toggleAddHl;
function openAddPilot(){
  if(!activeRaceId){alert('Seleziona prima una gara dalla tab GARE');return;}
  _addHl=[defaultHl()];_addReel='30';
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>'
    +'<div class="modal-title">Aggiungi Pilota</div>'
    +'<div class="form-group"><label class="form-label">Numero Kart</label>'
    +'<input class="form-input" id="f-num" placeholder="es. 342" type="number" oninput="previewFromNum(this.value)" autocomplete="off" style="font-size:22px;font-weight:900"></div>'
    // 18/11/2026 (Andrea): foto / video scelti gia' quando si aggiunge il pilota (stesse evidenziazioni del pilota)
    +'<div class="form-group"><label class="form-label">Lavoro</label><div class="hl-picker" id="f-hl">'+addHlHtml()+'</div></div>'
    +'<div class="form-group" id="f-reel-wrap"'+(_addHl.includes('video')?'':' style="display:none"')+'><label class="form-label">Reel</label><div id="f-reel" style="display:flex;gap:8px">'+addReelHtml()+'</div></div>'
    +'<div id="f-preview" style="display:none;background:var(--bg3);border:2px solid #22c55e;border-radius:10px;padding:12px;margin-bottom:12px">'
    +'<div style="font-size:10px;color:#22c55e;letter-spacing:2px;font-weight:700;margin-bottom:8px"><i class="ic ic-check"></i> TROVATO IN ENTRY LIST</div>'
    +'<div id="f-preview-content"></div>'
    +'<div class="form-group" style="margin-top:10px;margin-bottom:10px"><label class="form-label">Note — opzionale</label>'
    +'<textarea class="form-textarea" id="f-note" placeholder="Note opzionali..."></textarea></div>'
    +'<button onclick="confirmFromEntryList()" style="width:100%;padding:12px;background:#22c55e;color:#000;border:none;border-radius:8px;font-family:inherit;font-weight:900;font-size:13px;letter-spacing:2px;cursor:pointer">AGGIUNGI</button></div>'
    +'<div id="f-manual" style="display:none">'
    +'<div style="font-size:10px;color:#f59e0b;letter-spacing:2px;font-weight:700;margin-bottom:10px;padding:8px;background:rgba(245,158,11,.1);border-radius:6px"><i class="ic ic-warn"></i> NON IN ENTRY LIST — INSERIMENTO MANUALE</div>'
    +'<div class="form-group"><label class="form-label">Nome Cognome</label><input class="form-input" id="f-name" placeholder="es. ROSSI MARIO"></div>'
    +'<div class="form-group"><label class="form-label">Team</label><input class="form-input" id="f-team" placeholder="es. TEAM NAME"></div>'
    +'<div class="form-group"><label class="form-label">Categoria</label>'
    +'<select class="form-select" id="f-cat"><option>KZ2</option><option>OK</option><option>OKN</option><option>OKJ</option><option>MINI GR3</option><option>MINI U10</option><option>OK-NJ</option></select></div>'
    +'<div id="f-parity-display" style="font-size:11px;color:var(--text4);margin-bottom:10px"></div>'
    +'<div class="form-group"><label class="form-label">Note</label>'
    +'<textarea class="form-textarea" id="f-note-m" placeholder="Note opzionali..."></textarea></div>'
    +'<button class="form-submit" onclick="savePilotManual()">AGGIUNGI MANUALMENTE</button></div>');
}
window.openAddPilot=openAddPilot;

function previewFromNum(val){
  const num=val.trim();const preview=document.getElementById('f-preview');const manual=document.getElementById('f-manual');
  const parDisp=document.getElementById('f-parity-display');
  if(parDisp&&num)parDisp.textContent='Parità: '+autoParity(num)+' (automatica)';
  if(!num||num.length<2){preview.style.display='none';manual.style.display='none';_entryPreview=null;return;}
  const entry=lookupByNum(num);
  if(entry){
    _entryPreview={num,...entry};
    document.getElementById('f-preview-content').innerHTML=
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
      +'<span style="font-size:22px;font-weight:900">#'+num+'</span>'
      +'<span style="font-size:16px;font-weight:800">'+(entry.lastName||'')+' '+(entry.firstName||'')+'</span></div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<span class="'+catClass(entry.cat)+'" style="font-size:11px;padding:2px 8px;border-radius:6px;font-weight:800">'+(entry.cat||'')+'</span>'
      +'<span style="font-size:11px;color:var(--text4);font-weight:700">'+(entry.parity||autoParity(num))+'</span>'
      +'<span style="font-size:11px;color:var(--text4)">'+(entry.team||'')+'</span></div>';
    preview.style.display='block';manual.style.display='none';
  } else {_entryPreview=null;preview.style.display='none';if(num.length>=3)manual.style.display='block';}
}
window.previewFromNum=previewFromNum;

function confirmFromEntryList(){
  if(!_entryPreview)return;const num=_entryPreview.num.toString();
  if(pilots.find(p=>p.num===num)){alert('Numero già presente');return;}
  const note=document.getElementById('f-note')?document.getElementById('f-note').value.trim():'';
  const group=_entryPreview.group||'';
  const serie=_entryPreview.serie?_entryPreview.serie.toString():'';
  const prefinal=_entryPreview.prefinal||'';
  _rtNewPilots.add(String(num));pilots.push({num,name:(_entryPreview.lastName||'')+' '+(_entryPreview.firstName||''),team:_entryPreview.team||'',cat:_entryPreview.cat||'OK',parity:_entryPreview.parity||autoParity(num),group,prefinal,serie,eliminated:false,highlight:_addHl.slice(),reel:_addHl.includes('video')?_addReel:''});
  statuses[num]={};TASKS.forEach(t=>statuses[num][t]='red');trackStatus[num]={};notes[num]=note;
  const u={};u['races_index/'+activeRaceId+'/pilotCount']=pilots.length;update(ref(db),u);
  saveAll();closeModal();
}
window.confirmFromEntryList=confirmFromEntryList;

function savePilotManual(){
  const num=document.getElementById('f-num').value.trim();
  const name=(document.getElementById('f-name')?document.getElementById('f-name').value.trim().toUpperCase():'');
  const team=(document.getElementById('f-team')?document.getElementById('f-team').value.trim().toUpperCase():'');
  const cat=document.getElementById('f-cat')?document.getElementById('f-cat').value:'OK';
  const note=document.getElementById('f-note-m')?document.getElementById('f-note-m').value.trim():'';
  if(!num||!name||!team){alert('Compila tutti i campi');return;}
  if(pilots.find(p=>p.num===num)){alert('Numero già presente');return;}
  _rtNewPilots.add(String(num));pilots.push({num,name,team,cat,parity:autoParity(num),group:'',prefinal:'',serie:'',heats:[],eliminated:false,highlight:_addHl.slice(),reel:_addHl.includes('video')?_addReel:''});
  statuses[num]={};TASKS.forEach(t=>statuses[num][t]='red');trackStatus[num]={};notes[num]=note;
  const u={};u['races_index/'+activeRaceId+'/pilotCount']=pilots.length;update(ref(db),u);
  saveAll();closeModal();
}
window.savePilotManual=savePilotManual;

function openEditPilot(num){
  const p=pilots.find(x=>x.num===num);if(!p)return;
  /* FIX 16/10/2026 (ROK Superfinal): categorie dalla gara attiva + categoria attuale del pilota, cosi' SALVA non la sovrascrive con KZ2 */
  const cats=[...new Set([p.cat].concat(Object.values(currentEntryList||{}).map(e=>e&&e.cat),pilots.map(x=>x.cat),['KZ2','OK','OKN','OKJ','MINI GR3','MINI U10','OK-NJ']).filter(Boolean))];
  const hl=p.highlight||[];
  openModal('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>'
    +'<div class="modal-title">Modifica #'+p.num+'</div>'
    +(p.eliminated?'<div style="background:#1c0303;border:1px solid #dc2626;border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px;font-weight:700;color:#f87171;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center"><span><i class="ic ic-ban"></i> ELIMINATO</span><button style="font-size:10px;color:#f87171;background:none;border:1px solid #dc2626;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:inherit;font-weight:700" onclick="toggleEliminated(\''+num+'\')">RIATTIVA</button></div>':'')
    +'<div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="ef-name" value="'+p.name+'"></div>'
    +'<div class="form-group"><label class="form-label">Team</label><input class="form-input" id="ef-team" value="'+p.team+'"></div>'
    +'<div class="form-group"><label class="form-label">Categoria</label>'
    +'<select class="form-select" id="ef-cat">'+cats.map(c=>'<option'+(c===p.cat?' selected':'')+'>'+c+'</option>').join('')+'</select></div>'
    +'<div style="font-size:11px;color:var(--text4);margin-bottom:14px;padding:8px 12px;background:var(--bg3);border-radius:6px">Parità: <strong style="color:var(--text)">'+p.parity+'</strong> <span style="font-size:9px">(auto da #'+p.num+')</span></div>'
    +'<div class="form-group"><label class="form-label">Gruppo (A-E)</label>'
    +'<select class="form-select" id="ef-group"><option value=""'+(!p.group?' selected':'')+'>—</option>'+['A','B','C','D','E'].map(g=>'<option'+(p.group===g?' selected':'')+'>'+g+'</option>').join('')+'</select></div>'
    +'<div class="form-group"><label class="form-label">Prefinal (A/B)</label>'
    +'<select class="form-select" id="ef-prefinal"><option value=""'+(!p.prefinal?' selected':'')+'>—</option>'+['A','B'].map(g=>'<option'+(p.prefinal===g?' selected':'')+'>'+g+'</option>').join('')+'</select></div>'
    +'<div class="form-group"><label class="form-label">Serie (1/2/3)</label>'
    +'<select class="form-select" id="ef-serie"><option value=""'+(!p.serie?' selected':'')+'>—</option>'+['1','2','3'].map(g=>'<option'+(p.serie===g?' selected':'')+'>'+g+'</option>').join('')+'</select></div>'
    +'<div class="form-group"><label class="form-label">Evidenzia pilota</label>'
    +'<div style="font-size:10px;color:var(--text4);margin-bottom:8px">Puoi selezionare più opzioni · si salva subito, senza SALVA</div>'
    +'<div id="ef-hl-saved" style="font-size:11px;font-weight:800;color:#4fd69c;opacity:0;transition:opacity .3s;height:14px"></div>'+'<div class="hl-picker" id="ef-hl-picker">'
    +'<button type="button" class="hl-option hl-foto'+(hl.indexOf("foto")>=0?' active':'')+'" data-hl="foto" aria-pressed="'+(hl.indexOf("foto")>=0)+'" onclick="toggleHL(this,\''+p.num+'\')"><i class="ic ic-hl-foto"></i><span>FOTO</span></button>'
    +'<button type="button" class="hl-option hl-video'+(hl.indexOf("video")>=0?' active':'')+'" data-hl="video" aria-pressed="'+(hl.indexOf("video")>=0)+'" onclick="toggleHL(this,\''+p.num+'\')"><i class="ic ic-hl-video"></i><span>VIDEO</span></button>'
    +'<button type="button" class="hl-option hl-priority'+(hl.indexOf("priority")>=0?' active':'')+'" data-hl="priority" aria-pressed="'+(hl.indexOf("priority")>=0)+'" onclick="toggleHL(this,\''+p.num+'\')"><i class="ic ic-hl-prio"></i><span>PRIORITÀ</span></button>'
    +'</div></div>'
    +'<div id="ef-extras">'+efExtrasHtml(p)+'</div>'
    +'<button class="form-submit" onclick="updatePilot(\''+num+'\')">SALVA</button>'
    +'<button class="form-delete" onclick="deletePilot(\''+num+'\')">Elimina pilota</button>');
}
window.openEditPilot=openEditPilot;

/* 15/11/2026 (Andrea): FOTO/VIDEO/PRIORITA' si salvano subito al tocco, senza premere SALVA */
/* 19/11/2026 (Andrea): in Modifica pilota tutto e' editabile: durata reel (se VIDEO), etichette foto (se FOTO, quando esisteranno),
   personale/team. Si salva subito come le evidenziazioni. */
function efExtrasHtml(p){
  let h='';
  if(hasVideo(p))h+='<div class="form-group"><label class="form-label">Durata reel</label><div style="display:flex;gap:8px">'
    +REEL_OPTS.map(([v,l])=>{const on=String(p.reel||'30')===v;
      return'<button type="button" onclick="setPilotReelEdit(\''+p.num+'\',\''+v+'\')" style="flex:1;min-height:44px;border-radius:8px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;'
        +(on?'background:#e9d5a8;color:#1a160e;border:1px solid #e9d5a8':'background:none;color:var(--text3);border:1px solid var(--border2,#444)')+'">'+l+'</button>';}).join('')+'</div></div>';
  if(FOTO_OPTS.length&&hasFoto(p))h+='<div class="form-group"><label class="form-label">Foto</label><div style="display:flex;gap:8px;flex-wrap:wrap">'
    +FOTO_OPTS.map(([v,l])=>'<button type="button" onclick="toggleFotoTagEdit(\''+p.num+'\',\''+v+'\')" style="min-height:44px;padding:0 12px;border-radius:8px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;'
      +(fotoTagsOf(p).includes(v)?'background:#7dd3fc;color:#0b1220;border:1px solid #7dd3fc':'background:none;color:var(--text3);border:1px solid var(--border2,#444)')+'">'+l+'</button>').join('')+'</div></div>';
  return h+persToggleHtml(p.num);
}
function efRefresh(p){const el=document.getElementById('ef-extras');if(el)el.innerHTML=efExtrasHtml(p);try{renderAll();}catch(e){}}
function setPilotReelEdit(num,v){const p=pilots.find(x=>x.num===String(num));if(!p)return;p.reel=v;reelPrio(p,v);saveAll();efRefresh(p);try{const pk=document.querySelector('#ef-hl-picker .hl-option[data-hl="priority"]');if(pk&&v==='60'){pk.classList.add('active');pk.setAttribute('aria-pressed','true');}}catch(_){}}
function toggleFotoTagEdit(num,v){const p=pilots.find(x=>x.num===String(num));if(!p)return;const c=fotoTagsOf(p);p.fotoTags=c.includes(v)?c.filter(x=>x!==v):c.concat(v);saveAll();efRefresh(p);}
window.setPilotReelEdit=setPilotReelEdit;window.toggleFotoTagEdit=toggleFotoTagEdit;
function toggleHL(btn,num){
  // FOTO/VIDEO non possono restare entrambi spenti
  if(num!==undefined&&btn.classList.contains('active')&&/^(foto|video)$/.test(btn.getAttribute('data-hl')||'')){
    const other=document.querySelector('#ef-hl-picker .hl-option.active[data-hl="'+(btn.getAttribute('data-hl')==='foto'?'video':'foto')+'"]');if(!other)return;}
  const on=btn.classList.toggle('active');btn.setAttribute('aria-pressed',on);try{if(navigator.vibrate)navigator.vibrate(15);}catch(e){}
  if(num===undefined)return;const p=pilots.find(x=>String(x.num)===String(num));if(!p)return;
  const h=[];document.querySelectorAll('#ef-hl-picker .hl-option.active').forEach(b=>{const v=b.getAttribute('data-hl');if(v)h.push(v);});
  p.highlight=h;
  if(h.includes('video')&&!String(p.reel||''))p.reel='30';   // 19/11/2026: il reel mostrato (30") si salva davvero
  saveAll();
  {const ex=document.getElementById('ef-extras');if(ex)ex.innerHTML=efExtrasHtml(p);}
  const lb=document.getElementById('ef-hl-saved');if(lb){lb.textContent='Salvato';lb.style.opacity=1;clearTimeout(lb._t);lb._t=setTimeout(()=>{lb.style.opacity=0;},1500);}
  try{renderAll();}catch(e){}}

/* ══ PUNTI DI SCATTO IN PISTA (15/11/2026, Andrea) ══
   Ogni operatore ha i SUOI punti (dove si mette lui, non solo curve). Piantina per gara in trackMaps/<gara>. */
function spotIds(){return Object.keys(trackSpots||{}).sort((a,b)=>(trackSpots[a].o||0)-(trackSpots[b].o||0));}
function spotCount(num){const ids=spotIds(),d=(spotDone&&spotDone[num])||{};return[ids.filter(i=>d[i]).length,ids.length];}
/* 20/11/2026 (Andrea): punti di scatto anche per i piloti dei team seguiti (non aggiunti uno per uno) */
function spotPilotOf(num){const n=String(num);const p=pilots.find(x=>String(x.num)===n);if(p)return p;
  const e=(currentEntryList||{})[n];if(!e||!followedTeamOf(n,e.team))return null;return{num:n,name:e.name||((e.lastName||'')+' '+(e.firstName||'')).trim(),team:e.team||'',cat:e.cat||''};}
function spotPill(num){
  if(!venueMap())return'';
  if(!spotPilotOf(num))return'';
  const[f,t]=spotCount(num),cls=!t?'none':f===t?'green':f?'orange':'red';
  return'<button class="task-btn spot-pill '+cls+'" data-sp="'+String(num).replace(/"/g,'')+'" aria-label="Punti di scatto in pista" onclick="event.stopPropagation();openSpots(\''+num+'\')"><i class="ic ic-camera"></i>'+(t?'<span>'+f+'/'+t+'</span>':'')+'</button>';
}
/* 20/11/2026 (Andrea): il conteggio sulla fotocamera si aggiorna subito in tutte le schermate, senza aspettare il ridisegno */
function spotPillsRefresh(num){const sel=num!=null?'.spot-pill[data-sp="'+String(num).replace(/"/g,'')+'"]':'.spot-pill[data-sp]';
  document.querySelectorAll(sel).forEach(b=>{const n=b.getAttribute('data-sp');const[f,t]=spotCount(n),cls=!t?'none':f===t?'green':f?'orange':'red';
    b.classList.remove('none','green','orange','red');b.classList.add(cls);let sp=b.querySelector('span');if(t){if(!sp){sp=document.createElement('span');b.appendChild(sp);}sp.textContent=f+'/'+t;}else if(sp)sp.remove();});}
let _spNum=null,_spTrash=false,_spMarkMode=false;
/* 15/11 (Andrea): la mappa e' legata al LUOGO (sede), non a campionato o organizzazione.
   venues/<chiave> = {name, aliases[], map:{vb,d,w}}: la sede si riconosce dal circuito della gara.
   Senza mappa per la sede la pillola dei punti di scatto non compare. */
let _venues=null,_spBg=null;
function loadSpBg(){if(_spBg!==null)return;_spBg='';ref(db,'appAssets/mapBg/img').once('value').then(sn=>{_spBg=sn.val()||'';const vp=document.getElementById('sp-vp');if(vp&&_spBg){vp.style.setProperty('--spbg','url("'+_spBg+'")');vp.classList.add('hasbg');}}).catch(()=>{});}
function loadVenues(){if(_venues!==null)return;_venues={};ref(db,'venues').once('value').then(sn=>{_venues=sn.val()||{};try{spotsAttachVenue();}catch(_){}try{renderAll();}catch(_){}}).catch(()=>{_venues={};});}
function raceVenue(){
  const r=(typeof races!=='undefined'&&races&&races[activeRaceId])||{};const c=String(r.circuit||r.name||'').toLowerCase();
  if(!_venues||!c)return null;
  for(const k of Object.keys(_venues)){const v=_venues[k]||{};const al=[].concat(v.aliases||[]).map(a=>String(a).toLowerCase());if(al.some(a=>a&&c.indexOf(a)>=0))return Object.assign({key:k},v);}
  return null;
}
function venueMap(){if(_venues===null){loadVenues();return null;}const v=raceVenue();return v&&v.map&&v.map.d?v:null;}
let _spView={r:0,z:1,x:0,y:0,t:0};
function spViewKey(){const v=venueMap();return'rt_spview_'+(v?v.key:'');}
function openSpots(num){loadSpBg();window._rtDeferRender=true;_spSize=null;_spNum=String(num);_spTrash=false;try{const _vr=((venueMap()||{}).map||{}).rot||0;_spView={r:_vr,z:1,x:0,y:0,t:52};}catch(_){_spView={r:0,z:1,x:0,y:0,t:52};}renderSpots();}
window.openSpots=openSpots;
function spotNo(id){const sp=trackSpots[id]||{};if(sp.k)return sp.k;return spotIds().indexOf(id)+1;}
function renderSpots(){
  const p=spotPilotOf(_spNum);const v=venueMap();if(!p||!v){closeModal();return;}
  const d=(spotDone[_spNum])||{},ids=spotIds(),[f,t]=spotCount(_spNum);
  const h=[];
  h.push('<button class="modal-close" onclick="closeModal()"><i class="ic ic-close"></i></button>');
  h.push('<button class="sp-trash'+(_spTrash?' on':'')+'" onclick="spotsToggleTrash()" aria-label="Modalità cestino: elimina punti" aria-pressed="'+_spTrash+'"><i class="ic ic-trash"></i></button>');
  h.push('<div class="modal-title">#'+p.num+' '+escapeHtmlSp(p.name||'')+'</div>');
  h.push('<div class="sp-sub">'+(_spMarkMode?'<b style="color:#38bdf8">RIFERIMENTO</b> · tocca il punto del circuito (es. ingresso pregriglia) e dagli un nome':_spTrash?'<b style="color:#ef4444">CESTINO</b> · tocca un punto per eliminarlo per tutti i piloti':(t?'Fatti <b>'+f+'/'+t+'</b> · ':'')+'tocca la pista dove hai scattato')+'</div>');
  const w=v.map.w||10,dd=v.map.d;
  h.push('<div class="sp-vp'+(spotsOverview()?' over':'')+(_spTrash?' trash':'')+(_spView.t?' td':'')+(_spBg?' hasbg':'')+'" id="sp-vp"'+(_spBg?' style="--spbg:url(&quot;'+_spBg+'&quot;)"':'')+'><div class="sp-stage" id="sp-stage">');
  h.push('<svg viewBox="'+v.map.vb+'" preserveAspectRatio="none" class="sp-svg">'
    +'<path d="'+dd+'" class="sp-track-shadow" style="stroke-width:'+(w+6)+'"/>'
    +'<path d="'+dd+'" class="sp-track-edge" style="stroke-width:'+(w+4)+'"/>'
    +'<path d="'+dd+'" class="sp-kerb" style="stroke-width:'+(w+4)+'"/>'
    +'<path d="'+dd+'" class="sp-track" style="stroke-width:'+w+'"/>'
    +'<path d="'+dd+'" class="sp-track-line" style="stroke-width:'+Math.max(.6,w/14)+'"/>'+spotsSectorsSvg(v)+'</svg>');
  h.push('</div><button class="sp-back" onclick="event.stopPropagation();spotsBackAll()" onpointerdown="event.stopPropagation()" aria-label="Torna a tutte le curve">← CURVE</button><div class="sp-secl" id="sp-secl">'+spotsSectorsLbl(v)+'</div><div class="sp-marks" id="sp-marks">'+spotsMarksHtml(v)+'</div><div class="sp-dots" id="sp-dots">');
  ids.forEach(id=>{const on=!!d[id],n=spotNo(id);
    h.push('<button class="sp-dot'+(on?' on':'')+'" data-id="'+id+'" aria-label="Punto '+n+(on?' fatto':' da fare')+'"><span>'+(on?'<i class="ic ic-check"></i>':n)+'</span>'+(on?'<em>'+n+'</em>':'')+'</button>');});
  h.push('</div></div>');
  h.push('<div class="sp-tools"><button class="sp-btn" onclick="spotsRotate(-30)" aria-label="Ruota a sinistra">⟲</button><button class="sp-btn" onclick="spotsRotate(30)" aria-label="Ruota a destra">⟳</button><button class="sp-btn" onclick="spotsZoom(1.4)" aria-label="Ingrandisci">＋</button><button class="sp-btn" onclick="spotsZoom(1/1.4)" aria-label="Riduci">－</button><button class="sp-btn" onclick="spotsResetView()" aria-label="Centra">⤢</button>'+(currentUserId===SERVER_OWNER?'<button class="sp-btn'+(_spMarkMode?' on':'')+'" onclick="spotsToggleMark()" aria-label="Aggiungi riferimento del circuito"><i class="ic ic-pin"></i></button>':'')+'</div>');
  h.push('<div class="sp-hint sp-hint-over">Tocca una curva per ingrandirla. ⤢ torna alla vista intera.</div>');
  if(t&&!_spTrash)h.push('<div class="sp-hint sp-hint-zoom">I numeri sono punti da spuntare. Tieni premuto un punto per spostarlo. Due dita: zoom e rotazione.</div>');
  openModal(h.join(''));
  spotsLayout(false);spotsBindGestures();
  if(spotsOverview()&&!_spMarkMode){let ci=null;try{ci=localStorage.getItem(spotsCurveKey());}catch(_){}if(ci!==null&&ci!=='')spotsZoomCurve(parseInt(ci),false);}
}
let _spM=null;
function spotsMatrix(Sw,Sh,W,H){
  const P=new DOMMatrix([1,0,0,0, 0,1,0,0, 0,0,1,-1/Math.max(W,H,300)/1.6, 0,0,0,1]);
  const m=new DOMMatrix().translateSelf(W/2+_spView.x,H/2+_spView.y);m.multiplySelf(P);
  if(_spView.t)m.rotateSelf(_spView.t,0,0);
  m.rotateSelf(0,0,_spView.r);m.scaleSelf(_spView.z,_spView.z);m.translateSelf(-Sw/2,-Sh/2);return m;
}
let _spSize=null,_spRaf=0;
function spotsLayoutSoon(){if(_spRaf)return;_spRaf=requestAnimationFrame(()=>{_spRaf=0;spotsLayout(false);});}
function spotsLayout(anim){
  const vp=document.getElementById('sp-vp'),st=document.getElementById('sp-stage'),v=venueMap();if(!vp||!st||!v)return;
  const W=vp.clientWidth,H=vp.clientHeight;
  if(!_spSize||_spSize.W!==W||_spSize.H!==H){
    const vb=String(v.map.vb).split(/\s+/).map(Number),a=vb[2]/vb[3],Wf=W-16,Hf=H-16;
    const rot=((Math.round(_spView.r/90)*90)%180+180)%180===90;
    let Sw=rot?Math.min(Hf,Wf*a):Math.min(Wf,Hf*a);let Sh=Sw/a;if(!rot&&Sh>Hf){Sh=Hf;Sw=Sh*a;}if(rot&&Sh>Wf){Sh=Wf;Sw=Sh*a;}
    if(_spView.t){const k=1.02;Sw*=k;Sh*=k;}
    _spSize={W,H,Sw,Sh};
  }
  const Sw=_spSize.Sw,Sh=_spSize.Sh;
  {const ov=spotsOverview();vp.classList.toggle('over',ov);document.querySelectorAll('.sp-hint-over').forEach(x=>x.style.display=ov?'':'none');document.querySelectorAll('.sp-hint-zoom').forEach(x=>x.style.display=ov?'none':'');}
  st.style.width=Sw+'px';st.style.height=Sh+'px';
  const tr=anim?'transform .55s cubic-bezier(.25,.8,.25,1)':'none';st.style.transition=tr;
  const m=spotsMatrix(Sw,Sh,W,H);_spM={m,Sw,Sh};
  st.style.transform=m.toString();
  const mk=(v.marks)||{};document.querySelectorAll('#sp-marks .sp-mark').forEach(b=>{const sp=mk[b.getAttribute('data-mid')];if(!sp)return;
    const q=m.transformPoint(new DOMPoint(sp.x/100*Sw,sp.y/100*Sh,0,1));b.style.transition=anim?'left .55s cubic-bezier(.25,.8,.25,1),top .55s cubic-bezier(.25,.8,.25,1)':'none';b.style.left=(q.x/q.w)+'px';b.style.top=(q.y/q.w)+'px';});
  document.querySelectorAll('#sp-secl .sp-sec-l').forEach(b=>{const q=m.transformPoint(new DOMPoint(+b.getAttribute('data-x')/100*Sw,+b.getAttribute('data-y')/100*Sh,0,1));b.style.left=(q.x/q.w)+'px';b.style.top=(q.y/q.w)+'px';});
  document.querySelectorAll('#sp-dots .sp-dot').forEach(b=>{const sp=trackSpots[b.getAttribute('data-id')];if(!sp)return;
    const q=m.transformPoint(new DOMPoint(sp.x/100*Sw,sp.y/100*Sh,0,1));b.style.transition=anim?'left .55s cubic-bezier(.25,.8,.25,1),top .55s cubic-bezier(.25,.8,.25,1)':'none';b.style.left=(q.x/q.w)+'px';b.style.top=(q.y/q.w)+'px';});
}
/* 20/11/2026 (Andrea): i punti si sovrapponevano. Mappa divisa in SETTORI: in panoramica si vedono solo i settori
   (con fatti/totali), tocco un settore → zoom lì e da quel momento si toccano/aggiungono i punti. "Vista intera" torna indietro. */
const SP_SEC_ZOOM=1.25;
function spotsOverview(){return _spView.z<SP_SEC_ZOOM;}
/* 20/11/2026 (Andrea): un settore per CURVA. Le curve si ricavano dal tracciato: si campiona la pista ogni ~3 unita'
   e si marcano i tratti dove la direzione cambia piu' di 25°; i tratti consecutivi formano una curva (C1, C2... nel senso di marcia). */
let _spCurves=null;
function spotsCurves(v){
  if(_spCurves&&_spCurves.k===v.key)return _spCurves;
  const vb=String(v.map.vb).split(/\s+/).map(Number),[x0,y0,VW,VH]=vb,out={k:v.key,vb,list:[]};
  try{const ns='http://www.w3.org/2000/svg',sv=document.createElementNS(ns,'svg'),pa=document.createElementNS(ns,'path');
    pa.setAttribute('d',v.map.d);sv.appendChild(pa);sv.style.cssText='position:absolute;width:0;height:0;visibility:hidden';document.body.appendChild(sv);
    const L=pa.getTotalLength(),N=Math.max(60,Math.round(L/3)),pts=[];for(let i=0;i<N;i++){const q=pa.getPointAtLength(L*i/N);pts.push([q.x,q.y]);}sv.remove();
    const Wn=4,at=i=>pts[((i%N)+N)%N],hd=i=>{const a=at(i-Wn),b=at(i+Wn);return Math.atan2(b[1]-a[1],b[0]-a[0]);};
    const cur=pts.map((_,i)=>{let t=hd(i+Wn)-hd(i-Wn);t=((t+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return Math.abs(t)>25*Math.PI/180;});
    let st=cur.findIndex(c=>!c);if(st<0)st=0;let run=null;const grp=[];
    for(let j=0;j<N;j++){const i=(st+j)%N;if(cur[i])(run=run||[]).push(i);else if(run){grp.push(run);run=null;}}if(run)grp.push(run);
    grp.forEach(g=>{const xs=g.map(i=>pts[i][0]),ys=g.map(i=>pts[i][1]);
      out.list.push({pts:g.map(i=>pts[i]),cx:xs.reduce((a,b)=>a+b,0)/xs.length,cy:ys.reduce((a,b)=>a+b,0)/ys.length,
        x1:Math.min(...xs),x2:Math.max(...xs),y1:Math.min(...ys),y2:Math.max(...ys)});});
  }catch(_){}
  _spCurves=out;return out;}
/* curva piu' vicina a un punto in % della mappa */
function spotsCurveOf(x,y,cv){const px=cv.vb[0]+x/100*cv.vb[2],py=cv.vb[1]+y/100*cv.vb[3];let bi=-1,bd=1e9;
  cv.list.forEach((c,i)=>c.pts.forEach(q=>{const d=(q[0]-px)*(q[0]-px)+(q[1]-py)*(q[1]-py);if(d<bd){bd=d;bi=i;}}));return bi;}
function spotsCurveCounts(cv){const d=(spotDone[_spNum])||{},cnt={};
  spotIds().forEach(id=>{const sp=trackSpots[id];if(!sp)return;const k=spotsCurveOf(sp.x,sp.y,cv);if(k<0)return;cnt[k]=cnt[k]||[0,0];cnt[k][1]++;if(d[id])cnt[k][0]++;});return cnt;}
function spotsSectorsSvg(v){const cv=spotsCurves(v),cnt=spotsCurveCounts(cv),o=['<g class="sp-secs">'];
  cv.list.forEach((c,i)=>{const k=cnt[i],cl=!k?'':k[0]===k[1]?' ok':k[0]?' part':' todo';
    o.push('<polyline class="sp-sec'+cl+'" points="'+c.pts.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')+'" style="stroke-width:'+((v.map.w||10)+8)+'"/>');});
  o.push('</g>');return o.join('');}
function spotsSectorsLbl(v){const cv=spotsCurves(v),cnt=spotsCurveCounts(cv),[x0,y0,VW,VH]=cv.vb;
  return cv.list.map((c,i)=>{const k=cnt[i],cl=!k?'':k[0]===k[1]?' ok':k[0]?' part':' todo';
    return'<span class="sp-sec-l'+cl+'" data-x="'+((c.cx-x0)/VW*100)+'" data-y="'+((c.cy-y0)/VH*100)+'"><b>C'+(i+1)+'</b>'+(k?'<i>'+k[0]+'/'+k[1]+'</i>':'')+'</span>';}).join('');}
function spotsZoomSector(cx,cy){const v=venueMap(),vp=document.getElementById('sp-vp');if(!v||!vp||!_spSize)return;
  const cv=spotsCurves(v);if(!cv.list.length){spotsZoom(3);return;}
  const q0=spotsToMap(cx,cy);const i=spotsCurveOf(q0.x,q0.y,cv);if(i<0)return;spotsZoomCurve(i,true);}
/* 20/11/2026 (Andrea): la curva scelta resta quella aperta anche per gli altri piloti della stessa gara */
function spotsCurveKey(){return'rt_spcurve_'+(activeRaceId||'');}
/* 20/11/2026 (Andrea): ogni curva ricorda come l'hai girata (rotazione, 3D, zoom, spostamento), per account e tracciato,
   di gara in gara: userSpotViews/<utente>/<sede>/<curva> */
let _spViews={},_spViewsKey='',_spCurCurve=null,_spViewT=0;
function spotsViewsAttach(){const v=venueMap();if(!v||!currentUserId)return;const p='userSpotViews/'+currentUserId+'/'+v.key;if(p===_spViewsKey)return;_spViewsKey=p;_spViews={};
  onValue(ref(db,p),sn=>{if(_spViewsKey===p)_spViews=sn.val()||{};});}
function spotsCurveCenter(i){const v=venueMap(),cv=spotsCurves(v),c=cv.list[i];if(!c||!_spSize)return null;const[x0,y0,VW,VH]=cv.vb;const sx=_spView.x,sy=_spView.y;_spView.x=0;_spView.y=0;
  const m=spotsMatrix(_spSize.Sw,_spSize.Sh,_spSize.W,_spSize.H),q=m.transformPoint(new DOMPoint((c.cx-x0)/VW*_spSize.Sw,(c.cy-y0)/VH*_spSize.Sh,0,1));_spView.x=sx;_spView.y=sy;
  return{x:_spSize.W/2-q.x/q.w,y:_spSize.H/2-q.y/q.w};}
function spotsSaveView(){if(_spCurCurve===null||spotsOverview()||!currentUserId)return;const v=venueMap();if(!v)return;clearTimeout(_spViewT);
  _spViewT=setTimeout(()=>{const i=_spCurCurve;if(i===null)return;const c0=spotsCurveCenter(i);if(!c0)return;
    const val={r:Math.round(_spView.r*10)/10,t:_spView.t||0,z:Math.round(_spView.z*100)/100,dx:Math.round(_spView.x-c0.x),dy:Math.round(_spView.y-c0.y)};
    const o=_spViews[i];if(o&&o.r===val.r&&o.t===val.t&&o.z===val.z&&o.dx===val.dx&&o.dy===val.dy)return;
    _spViews[i]=val;try{ref(db,'userSpotViews/'+currentUserId+'/'+v.key+'/'+i).set(val);}catch(_){}},700);}
function spotsZoomCurve(i,anim){const v=venueMap();if(!v||!_spSize)return;const cv=spotsCurves(v);const c=cv.list[i];if(!c)return;const[x0,y0,VW,VH]=cv.vb,pad=12;
  try{localStorage.setItem(spotsCurveKey(),String(i));}catch(_){}
  try{spotsViewsAttach();}catch(_){}_spCurCurve=i;const sv=_spViews[i];
  if(sv){_spView.r=+sv.r||0;if(!!sv.t!==!!_spView.t){_spView.t=sv.t||0;const vp=document.getElementById('sp-vp');if(vp)vp.classList.toggle('td',!!_spView.t);}}
  const bw=(c.x2-c.x1+2*pad)/VW*_spSize.Sw,bh=(c.y2-c.y1+2*pad)/VH*_spSize.Sh;
  _spView.z=sv&&sv.z?Math.max(SP_SEC_ZOOM,Math.min(8,+sv.z)):Math.max(2,Math.min(8,Math.min(_spSize.W,_spSize.H)*0.9/Math.max(bw,bh,1)));_spView.x=0;_spView.y=0;
  const m=spotsMatrix(_spSize.Sw,_spSize.Sh,_spSize.W,_spSize.H),q=m.transformPoint(new DOMPoint((c.cx-x0)/VW*_spSize.Sw,(c.cy-y0)/VH*_spSize.Sh,0,1));
  _spView.x=_spSize.W/2-q.x/q.w+(sv?(+sv.dx||0):0);_spView.y=_spSize.H/2-q.y/q.w+(sv?(+sv.dy||0):0);
  if(anim){try{if(navigator.vibrate)navigator.vibrate(15);}catch(_){}}
  spotsLayout(anim);}
function spotsBackAll(){try{localStorage.removeItem(spotsCurveKey());}catch(_){}_spCurCurve=null;spotsResetView();}
window.spotsBackAll=spotsBackAll;
function spotsToggle3D(){_spView.t=_spView.t?0:52;const vp=document.getElementById('sp-vp');if(vp)vp.classList.toggle('td',!!_spView.t);document.querySelectorAll('.sp-tools .sp-btn').forEach(b=>{if(b.textContent==='3D')b.classList.toggle('on',!!_spView.t);});spotsLayout(true);spotsSaveView();}
window.spotsToggle3D=spotsToggle3D;
function spotsRotate(dg){const a=dg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=_spView.x,y=_spView.y;_spView.x=x*c-y*s;_spView.y=x*s+y*c;_spView.r+=dg;spotsLayout(true);spotsSaveView();}
function spotsZoom(k){_spView.z=Math.max(.6,Math.min(8,_spView.z*k));spotsLayout(true);spotsSaveView();}
function spotsResetView(){const vr=((venueMap()||{}).map||{}).rot||0;_spView.z=1;_spView.x=0;_spView.y=0;_spView.r=vr+Math.round((_spView.r-vr)/360)*360;spotsLayout(true);}
window.spotsRotate=spotsRotate;window.spotsZoom=spotsZoom;window.spotsResetView=spotsResetView;
/* punto dello schermo -> posizione % sulla mappa (inverso di traslazione, rotazione, zoom) */
function spotsToMap(cx,cy){
  const vp=document.getElementById('sp-vp');if(!vp||!_spM)return{x:-1,y:-1};const r=vp.getBoundingClientRect(),m=_spM.m;
  const X=cx-r.left,Y=cy-r.top;
  const a1=m.m11-X*m.m14,b1=m.m21-X*m.m24,c1=X*m.m44-m.m41,a2=m.m12-Y*m.m14,b2=m.m22-Y*m.m24,c2=Y*m.m44-m.m42;
  const det=a1*b2-a2*b1;if(Math.abs(det)<1e-9)return{x:-1,y:-1};
  const lx=(c1*b2-c2*b1)/det,ly=(a1*c2-a2*c1)/det;return{x:lx/_spM.Sw*100,y:ly/_spM.Sh*100};
}
function spotsBindGestures(){
  const vp=document.getElementById('sp-vp');if(!vp)return;const pts=new Map();let g=null,moved=false,downT=null;
  let drag=null,holdT=0;
  vp.onpointerdown=e=>{try{vp.setPointerCapture(e.pointerId);}catch(_){}pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    clearTimeout(holdT);drag=null;
    if(pts.size===1){moved=false;downT=e.target.closest('.sp-dot');g={x:e.clientX,y:e.clientY,vx:_spView.x,vy:_spView.y};
      // 15/11 (Andrea): tieni premuto un punto mezzo secondo e trascinalo per spostarlo
      if(downT&&!_spTrash){const id=downT.getAttribute('data-id');holdT=setTimeout(()=>{if(moved||pts.size!==1)return;drag={id,el:downT};downT.classList.add('drag');try{if(navigator.vibrate)navigator.vibrate(25);}catch(_){}},450);}}
    else if(pts.size===2){const[a,b]=[...pts.values()];moved=true;g={d:Math.hypot(b.x-a.x,b.y-a.y),an:Math.atan2(b.y-a.y,b.x-a.x),z:_spView.z,r:_spView.r,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,px:_spView.x,py:_spView.y};}};
  vp.onpointermove=e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===2&&g&&g.d){const[a,b]=[...pts.values()];_spView.z=Math.max(.6,Math.min(8,g.z*Math.hypot(b.x-a.x,b.y-a.y)/g.d));_spView.r=g.r+(Math.atan2(b.y-a.y,b.x-a.x)-g.an)*180/Math.PI;_spView.x=g.px+((a.x+b.x)/2-g.mx);_spView.y=g.py+((a.y+b.y)/2-g.my);spotsLayoutSoon();}
    else if(pts.size===1&&drag){const q=spotsToMap(e.clientX,e.clientY);const sp=trackSpots[drag.id];if(sp){sp.x=Math.round(q.x*10)/10;sp.y=Math.round(q.y*10)/10;drag.el.style.left=(e.clientX-vp.getBoundingClientRect().left)+'px';drag.el.style.top=(e.clientY-vp.getBoundingClientRect().top)+'px';}}
    else if(pts.size===1&&g&&g.vx!==undefined){const dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.abs(dx)+Math.abs(dy)>8){moved=true;clearTimeout(holdT);}if(moved){_spView.x=g.vx+dx;_spView.y=g.vy+dy;spotsLayoutSoon();}}};
  const up=e=>{clearTimeout(holdT);if(drag){const d=drag;drag=null;pts.delete(e.pointerId);d.el.classList.remove('drag');spotsSave();spotsLayout(false);g=null;return;}
    const wasTap=pts.size===1&&!moved;pts.delete(e.pointerId);
    if(wasTap&&spotsOverview()&&!_spMarkMode){spotsZoomSector(e.clientX,e.clientY);}
    else if(wasTap){const mt=e.target.closest&&e.target.closest('.sp-mark');if(mt&&_spTrash){spotsDelMark(mt.getAttribute('data-mid'));}else if(_spMarkMode){spotsAddMark(e.clientX,e.clientY);}else if(downT)spotsTap(downT.getAttribute('data-id'));else spotsAddAt(e.clientX,e.clientY);}
    if(!pts.size){g=null;spotsSaveView();}else if(pts.size===1){const q=[...pts.values()][0];g={x:q.x,y:q.y,vx:_spView.x,vy:_spView.y};}};
  vp.onwheel=e=>{e.preventDefault();_spView.z=Math.max(.6,Math.min(8,_spView.z*(e.deltaY<0?1.12:1/1.12)));spotsLayoutSoon();};
  vp.onpointerup=up;vp.onpointercancel=e=>{pts.delete(e.pointerId);if(!pts.size)g=null;};
}
function escapeHtmlSp(t){return String(t||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
/* un'unica scrittura per punti e spunte: con due scritture separate l'aggiornamento locale della prima
   ricaricava le spunte vecchie prima di salvare la seconda (punti che sparivano o si rinumeravano) */
/* 20/11/2026 (Andrea): i PUNTI appartengono all'account e al tracciato (userSpots/<utente>/<sede>), cosi' tornando
   sulla stessa pista in un'altra gara si ritrovano. Le SPUNTE restano per gara. I punti della gara vengono copiati
   nel tracciato la prima volta (solo aggiunta, niente viene tolto dalla gara). */
let _spVenueSpots=null,_spVenueKey='',_spRaceSpots={};
/* 21/11/2026 (Andrea): scelta per account in Impostazioni — punti ritrovati sulla stessa pista nelle gare successive (predefinito)
   oppure solo per questa gara (userSettings.spotsPerRace). I punti del tracciato restano salvati: si ritrovano riattivando l'opzione. */
function spotsVenuePath(){if(userSettings&&userSettings.spotsPerRace)return'';const v=venueMap();return v&&currentUserId?'userSpots/'+currentUserId+'/'+v.key:'';}
function setSpotsScope(keep){userSettings.spotsPerRace=!keep;setUserSetting('spotsPerRace',!keep);
  try{if(_spVenueKey){off(ref(db,_spVenueKey));}}catch(_){}_spVenueKey='';_spVenueSpots=null;
  trackSpots=Object.assign({},_spRaceSpots||{});if(keep)spotsAttachVenue();window._rtRenderDirty=true;try{renderAll();}catch(_){}renderSettings();}
window.setSpotsScope=setSpotsScope;
function spotsAttachVenue(){try{spotsViewsAttach();}catch(_){}const p=spotsVenuePath();
  if(!p&&_spVenueKey){try{off(ref(db,_spVenueKey));}catch(_){}_spVenueKey='';_spVenueSpots=null;trackSpots=Object.assign({},_spRaceSpots||{});window._rtRenderDirty=true;}
  if(!p||p===_spVenueKey)return;_spVenueKey=p;_spVenueSpots=null;
  trackSpots=Object.assign({},_spRaceSpots||{});
  onValue(ref(db,p),sn=>{if(_spVenueKey!==p)return;_spVenueSpots=sn.val()||{};
    const miss={};Object.keys(_spRaceSpots||{}).forEach(id=>{if(!_spVenueSpots[id])miss[p+'/'+id]=_spRaceSpots[id];});
    if(Object.keys(miss).length){update(ref(db),miss).catch(()=>{});dlog('Punti di scatto copiati nel tracciato: '+Object.keys(miss).length,'info');}
    const nx=Object.assign({},_spVenueSpots,_spRaceSpots||{});const ch=JSON.stringify(nx)!==JSON.stringify(trackSpots||{});trackSpots=nx;
    if(ch){window._rtRenderDirty=true;try{if(document.getElementById('sp-dots'))spotsRefresh();else renderAll();}catch(_){}}});}
function spotsSave(){if(!activeRaceId||!currentUserId)return;const u={};
  {const p=spotsVenuePath();if(p&&_spVenueSpots){const all=new Set([...Object.keys(_spVenueSpots),...Object.keys(trackSpots||{})]);
    all.forEach(id=>{const a=_spVenueSpots[id]||null,b=(trackSpots||{})[id]||null;if(JSON.stringify(a)!==JSON.stringify(b))u[p+'/'+id]=b;});
    // copie locali subito allineate: altrimenti un aggiornamento in arrivo rimetterebbe il punto appena eliminato
    _spVenueSpots=JSON.parse(JSON.stringify(trackSpots||{}));}}
  _spRaceSpots=JSON.parse(JSON.stringify(trackSpots||{}));
  rtDiff(userPath()+'/trackSpots',_rtBaseUser.trackSpots,trackSpots,u);rtDiff(userPath()+'/spotDone',_rtBaseUser.spotDone,spotDone,u);rtWrite(u,'punti di scatto');}
function spotsRefresh(){
  const dl=document.getElementById('sp-dots'),sub=document.querySelector('.sp-sub');if(!dl){renderSpots();return;}
  const d=(spotDone[_spNum])||{},[f,t]=spotCount(_spNum);
  if(sub)sub.innerHTML=_spTrash?'<b style="color:#ef4444">CESTINO</b> · tocca un punto per eliminarlo per tutti i piloti':(t?'Fatti <b>'+f+'/'+t+'</b> · ':'')+'tocca la pista dove hai scattato';
  {const os=document.querySelector('#sp-stage .sp-secs'),sl=document.getElementById('sp-secl'),v=venueMap();if(os&&v){os.insertAdjacentHTML('afterend',spotsSectorsSvg(v));os.remove();}if(sl&&v)sl.innerHTML=spotsSectorsLbl(v);}
  dl.innerHTML=spotIds().map(id=>{const on=!!d[id],n=spotNo(id);return'<button class="sp-dot'+(on?' on':'')+'" data-id="'+id+'" aria-label="Punto '+n+(on?' fatto':' da fare')+'"><span>'+(on?'<i class="ic ic-check"></i>':n)+'</span>'+(on?'<em>'+n+'</em>':'')+'</button>';}).join('');
  spotsLayout(false);
}
function spotsMarksHtml(v){const mk=(v&&v.marks)||{};return Object.keys(mk).map(k=>'<span class="sp-mark" data-mid="'+k+'"><i><i class="ic ic-pin"></i></i>'+escapeHtmlSp(mk[k].n||'')+'</span>').join('');}
function spotsToggleMark(){_spMarkMode=!_spMarkMode;renderSpots();}
window.spotsToggleMark=spotsToggleMark;
function spotsAddMark(cx,cy){const v=venueMap();if(!v)return;const q=spotsToMap(cx,cy);const n=prompt('Nome del riferimento (es. Ingresso pregriglia). Vuoto = annulla');
  if(!n||!n.trim())return;const id='m'+Date.now().toString(36);const val={x:Math.round(q.x*10)/10,y:Math.round(q.y*10)/10,n:n.trim().slice(0,30)};
  ref(db,'venues/'+v.key+'/marks/'+id).set(val).then(()=>{_venues[v.key].marks=Object.assign({},_venues[v.key].marks||{},{[id]:val});_spMarkMode=false;renderSpots();});}
function spotsDelMark(mid){const v=venueMap();if(!v||currentUserId!==SERVER_OWNER)return;if(!confirm('Eliminare il riferimento?'))return;
  ref(db,'venues/'+v.key+'/marks/'+mid).remove().then(()=>{delete _venues[v.key].marks[mid];renderSpots();});}
function spotsToggleTrash(){_spTrash=!_spTrash;const vp=document.getElementById('sp-vp'),b=document.querySelector('.sp-trash');if(vp)vp.classList.toggle('trash',_spTrash);if(b)b.classList.toggle('on',_spTrash);spotsRefresh();}
window.spotsToggleTrash=spotsToggleTrash;
function spotsAddAt(cx,cy){
  if(_spTrash)return;
  const q=spotsToMap(cx,cy);if(q.x<-100||q.x>200||q.y<-100||q.y>200)return;
  const id='s'+Date.now().toString(36);
  const k=spotIds().reduce((mx,i)=>Math.max(mx,spotNo(i)),0)+1;
  trackSpots[id]={x:Math.round(q.x*10)/10,y:Math.round(q.y*10)/10,o:Date.now(),k:k};
  if(!spotDone[_spNum])spotDone[_spNum]={};spotDone[_spNum][id]=1;
  try{if(navigator.vibrate)navigator.vibrate(12);}catch(_){}
  spotsSave();window._rtRenderDirty=true;spotsRefresh();try{spotPillsRefresh(null);}catch(_){}
}
window.spotsAddAt=spotsAddAt;
function spotsTap(id){
  if(_spTrash){
    // 20/11/2026 (Andrea): conferma prima di eliminare (un punto cancellato perde le spunte di tutti i piloti)
    const nP=Object.keys(spotDone||{}).filter(n=>spotDone[n]&&spotDone[n][id]).length;
    if(!confirm('Eliminare il punto '+spotNo(id)+'?'+(nP?' È segnato su '+nP+(nP===1?' pilota':' piloti')+': le spunte si perdono.':'')))return;
    delete trackSpots[id];Object.keys(spotDone).forEach(n=>{if(spotDone[n])delete spotDone[n][id];});
    try{if(navigator.vibrate)navigator.vibrate([20,40,20]);}catch(_){}
  }else{
    if(!spotDone[_spNum])spotDone[_spNum]={};
    if(spotDone[_spNum][id])delete spotDone[_spNum][id];else spotDone[_spNum][id]=1;
    try{if(navigator.vibrate)navigator.vibrate(12);}catch(_){}
  }
  spotsSave();window._rtRenderDirty=true;spotsRefresh();try{spotPillsRefresh(null);}catch(_){}
}
window.spotsTap=spotsTap;

/* 15/11/2026 (Andrea): le manche A-B, B-D, B-C hanno in comune solo la B = il pilota e' del gruppo B */
function heatsGroup(heats){if(!Array.isArray(heats)||!heats.length)return'';let common=null;
  heats.forEach(h=>{const l=new Set(String(h).toUpperCase().split(/[^A-Z]+/).filter(Boolean));common=common?new Set([...common].filter(x=>l.has(x))):l;});
  return common&&common.size===1?[...common][0]:'';}
function heatsLabel(heats){const g=heatsGroup(heats);return g?'GRP '+g:heats.join(' ');}
window.heatsGroup=heatsGroup;
/* 15/11/2026 (Andrea): classe di evidenziazione del pilota (foto/video/entrambi) + priorita' */
function hlOfNum(no){const p=pilots.find(q=>String(q.num)===String(no));return p?hlClassOf(p.highlight):'';}
function hlClassOf(hl){hl=Array.isArray(hl)?hl:[];const f=hl.indexOf('foto')>=0,v=hl.indexOf('video')>=0;return(f&&v?'hl-both':f?'hl-foto':v?'hl-video':'')+(hl.indexOf('priority')>=0?' hl-prio':'');}
window.toggleHL=toggleHL;

function toggleEliminated(num){
  const p=pilots.find(x=>x.num===num);if(!p)return;
  p.eliminated=!p.eliminated;
  saveAll();
  openEditPilot(num);
}
window.toggleEliminated=toggleEliminated;

function updatePilot(num){
  const p=pilots.find(x=>x.num===num);if(!p)return;
  p.name=document.getElementById('ef-name').value.trim().toUpperCase();
  p.team=document.getElementById('ef-team').value.trim().toUpperCase();
  p.cat=document.getElementById('ef-cat').value;
  p.group=document.getElementById('ef-group').value;
  p.prefinal=document.getElementById('ef-prefinal').value;
  p.serie=document.getElementById('ef-serie').value;
  var btns=document.querySelectorAll('#ef-hl-picker .hl-option.active');
  var h=[];for(var i=0;i<btns.length;i++){var v=btns[i].getAttribute('data-hl');if(v)h.push(v);}
  p.highlight=h;
  saveAll();closeModal();
}
window.updatePilot=updatePilot;

function deletePilot(num){
  if(!confirm('Eliminare?'))return;
  pilots=pilots.filter(p=>p.num!==num);
  delete statuses[num];delete trackStatus[num];delete notes[num];
  const u={};u['races_index/'+activeRaceId+'/pilotCount']=pilots.length;update(ref(db),u);
  saveAll();closeModal();
  refreshPilotSearch();
}
window.deletePilot=deletePilot;

/* FIX 14/11/2026: all'apertura la scheda salvata veniva mostrata prima che gare e dati fossero caricati
   (Live senza Apex, Programma senza ORA) e restava vuota finche' non si toccava il menu.
   Ora, appena gara + dati sono pronti (copia locale e poi dati live), la scheda viene riaperta una volta. */
let _bootTabKey='';
function bootTab(){
  if(!initialized||!activeRaceId||typeof races==='undefined'||!races[activeRaceId])return false;
  const k=activeRaceId+'|'+(window._rtLiveSeen?'L':'S');
  if(_bootTabKey===k)return false;
  _bootTabKey=k;showTab(activeTab);try{window.hideLoader&&window.hideLoader();}catch(e){}return true;
}
window.bootTab=bootTab;
function renderAll(){
  if(bootTab())return;
  if(initialized&&(!activeRaceId||!currentUserId)){try{window.hideLoader&&window.hideLoader();}catch(e){}}
  if(activeTab==='livetiming'){try{renderLtMyNums();if(activeRaceId)apexConnect();}catch(e){}}
  if(activeTab==='gara'){try{if(activeRaceId)apexConnect();}catch(e){}}
  if(activeTab==='gare')renderGare();
  if(activeTab==='piloti')renderPilots();
  if(activeTab==='programma')renderSchedule();
  if(activeTab==='entrylist')renderEntryList();
}

// ── MIGRATION: if old data exists at /tracker, offer to migrate ──
/* 17/11/2026: migrazione dalla v3 disattivata (leggeva tutto il vecchio nodo a ogni apertura) */
if(false)onValue(ref(db,'tracker'),snap=>{
  const old=snap.val();
  if(old&&old.pilots&&!Object.keys(races).length&&currentUserId){
    const banner=document.createElement('div');
    banner.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#1c1003;border-top:2px solid #fbbf24;padding:16px;z-index:300;text-align:center;font-family:Courier New,monospace;';
    banner.innerHTML='<div style="font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:8px">Trovati dati esistenti ('+Object.keys(old.pilots).length+' piloti)</div>'
      +'<button onclick="doMigrate()" style="padding:10px 20px;background:#fbbf24;color:#000;border:none;border-radius:8px;font-weight:900;font-family:inherit;cursor:pointer;margin-right:8px">MIGRA ALLA V4</button>'
      +'<button onclick="this.parentElement.remove()" style="padding:10px 20px;background:none;color:#fbbf24;border:1px solid #fbbf24;border-radius:8px;font-weight:700;font-family:inherit;cursor:pointer">IGNORA</button>';
    document.body.appendChild(banner);
    window.doMigrate=function(){
      banner.innerHTML='<div style="color:#fbbf24;font-weight:700">Migrazione in corso...</div>';
      const id='race_'+Date.now();
      const u={};
      u['races_index/'+id]={name:'WSK Super Master Franciacorta',circuit:'Franciacorta',entryCount:Object.keys(ENTRY_LIST).length,pilotCount:Object.keys(old.pilots).length,createdAt:new Date().toISOString()};
      // Shared data
      u['races/'+id+'/entryList']=ENTRY_LIST;
      u['races/'+id+'/schedule']=SCHEDULE;
      u['races/'+id+'/days']=DAYS;
      u['races/'+id+'/finals']=FINALS;
      u['races/'+id+'/trackSections']=old.trackSections||["PARTENZA","CURVA 1","RETTILINEO 1","CURVA 2","ESSE","RETTILINEO 2","ARRIVO"];
      // User-specific data under current user
      u['races/'+id+'/users/'+currentUserId]={pilots:old.pilots,statuses:old.statuses||{},notes:old.notes||{},trackStatus:old.trackStatus||{}};
      update(ref(db),u).then(()=>{banner.remove();switchRace(id);showTab('piloti');});
    };
  }
},{onlyOnce:true});

// Init: show correct tab
showTab(activeTab);


/* 20/11/2026 (Andrea): tasti ↑ ↓ del Programma: un tocco = turno precedente/successivo, doppio tocco = inizio/fine */
let _progStepAt=0,_progStepDir=0;
function progStep(dir){
  const now=Date.now();
  if(now-_progStepAt<350&&_progStepDir===dir){_progStepAt=0;clearTimeout(window._progFixT);   // niente riallineamento del primo tocco
    window.scrollTo({top:dir<0?0:document.body.scrollHeight,behavior:'smooth'});return;}
  _progStepAt=now;_progStepDir=dir;
  const off=progTopCover()+6;
  const cards=[...document.querySelectorAll('#schedule-content .slot-header')].map(x=>x.closest('.card')).filter(Boolean);
  if(!cards.length){window.scrollTo({top:dir<0?0:document.body.scrollHeight,behavior:'smooth'});return;}
  let target=null;
  if(dir>0)target=cards.find(c=>c.getBoundingClientRect().top>off+4);
  else{const prev=cards.filter(c=>c.getBoundingClientRect().top<off-4);target=prev[prev.length-1];}
  if(!target){window.scrollTo({top:dir<0?0:document.body.scrollHeight,behavior:'smooth'});return;}
  window.scrollTo({top:window.scrollY+target.getBoundingClientRect().top-off,behavior:'smooth'});
  // le barre in alto possono comparire/sparire durante lo scorrimento: a fine corsa si riallinea l'intestazione del turno
  clearTimeout(window._progFixT);window._progFixT=setTimeout(()=>{const d=target.getBoundingClientRect().top-(progTopCover()+6);
    if(Math.abs(d)>3)window.scrollTo({top:window.scrollY+d,behavior:'smooth'});},650);
}
window.progStep=progStep;
// altezza coperta in alto da barre fisse (testata, barra di stato, barre della pagina): si scende finche' si trova contenuto che scorre
function progTopCover(){
  const x=Math.round(window.innerWidth/2);let y=0;
  const fixedUp=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){const p=getComputedStyle(e).position;if(p==='sticky'||p==='fixed')return true;}return false;};
  for(;y<Math.min(400,window.innerHeight/2);y+=2){const el=document.elementFromPoint(x,y);if(!el||!fixedUp(el))break;}
  return y;
}
