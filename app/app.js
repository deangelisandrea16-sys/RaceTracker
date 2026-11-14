/* Race Tracker — copia di prova: script principale (14/11/2026, punto 9: tolto dalla pagina unica).
   RT_JS_BUILD deve essere uguale ad APP_BUILD della pagina: se diverso, la pagina ricarica il file. */
var RT_JS_BUILD='2026-11-14-2010';
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
const TASKS=["PADDOK","PREGRIGLIA","BILANCIA","PISTA","REPORTAGE"];
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

function showUserPicker(){
  // Get saved users from all races
  let savedUsers=JSON.parse(localStorage.getItem('rt_users')||'[]');
  // Also check current user
  if(currentUserId&&!savedUsers.includes(currentUserId))savedUsers.push(currentUserId);
  
  let usersHtml='';
  if(savedUsers.length){
    usersHtml='<div style="margin-bottom:16px">'
      +savedUsers.map(u=>'<button style="width:100%;padding:14px;background:var(--bg3);border:1.5px solid '+(u===currentUserId?'#22c55e':'var(--border2)')+';border-radius:10px;font-family:inherit;font-size:16px;font-weight:900;color:'+(u===currentUserId?'#22c55e':'var(--text)')+';cursor:pointer;margin-bottom:8px;letter-spacing:2px;text-transform:uppercase" onclick="selectSavedUser(\''+u+'\')">'
        +u+(u===currentUserId?' ✓':'')+'</button>').join('')
      +'</div>'
      +'<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">'
      +'<div style="font-size:10px;color:var(--text4);font-weight:700;letter-spacing:1px;margin-bottom:8px">NUOVO UTENTE</div>';
  }

  openModal('<div class="modal-title">Chi sei?</div>'
    +'<div style="font-size:11px;color:var(--text4);margin-bottom:16px">Ogni utente ha i propri piloti, stati e note. Programma e entry list sono condivisi.</div>'
    +usersHtml
    +'<div class="form-group"><label class="form-label">'+(savedUsers.length?'Oppure aggiungi nuovo':'Il tuo nome')+'</label>'
    +'<input class="form-input" id="up-name" placeholder="es. Ricky" style="font-size:20px;font-weight:900;text-transform:lowercase" autocomplete="off"></div>'
    +'<button class="form-submit" onclick="setUser()">ENTRA</button>'
    +(savedUsers.length?'</div>':''));
}

function selectSavedUser(name){
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
  const name=document.getElementById('up-name').value.trim().toLowerCase();
  if(!name){alert('Inserisci il tuo nome');return;}
  currentUserId=name;
  localStorage.setItem('rt_user',name);
  // Save to users list
  let savedUsers=JSON.parse(localStorage.getItem('rt_users')||'[]');
  if(!savedUsers.includes(name))savedUsers.push(name);
  localStorage.setItem('rt_users',JSON.stringify(savedUsers));
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

function updateUserHeader(){
  const el=document.getElementById('user-badge');
  if(el)el.textContent=currentUserId?currentUserId.toUpperCase():'?';
}

let pilots=[];
let statuses={};
let notes={};
let trackSections=["PARTENZA","CURVA 1","RETTILINEO 1","CURVA 2","ESSE","RETTILINEO 2","ARRIVO"];
let trackStatus={};
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
    if(snap.val()===true){showOfflineBanner(false);if(initialized)setSyncStatus('ok');}
    else _rtOfflineTimer=setTimeout(()=>{showOfflineBanner(true);setSyncStatus('err');},4000);
  });}catch(e){}
  window.addEventListener('offline',()=>{showOfflineBanner(true);setSyncStatus('err');});
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
      const today=new Date().toISOString().slice(0,10);
      const ids=Object.keys(races).sort((a,b)=>String((races[b]||{}).createdAt||'').localeCompare(String((races[a]||{}).createdAt||'')));
      const live=ids.find(id=>{const r=races[id]||{};return r.startDate&&r.endDate&&r.startDate<=today&&today<=r.endDate;});
      if(ids.length) switchRace(live||ids[0]);
      else{ initialized=true; renderAll(); }
    } else {
      /* FIX 17/10/2026: se la gara salvata e' gia' finita (endDate passata) e c'e' una gara in corso oggi, passa a quella */
      const _t=new Date().toISOString().slice(0,10);
      const _cur=races[activeRaceId]||{};
      const _live=Object.keys(races).find(id=>{const r=races[id]||{};return r.startDate&&r.endDate&&r.startDate<=_t&&_t<=r.endDate;});
      /* 17/10 v2 (idea di Andrea): all'apertura segue il badge IN CORSO (stessa regola: startDate<=oggi<=endDate). Solo al primo caricamento, cosi' una scelta manuale successiva resta. */
      if(_live&&_live!==activeRaceId&&!window._rtAutoPicked){ window._rtAutoPicked=true; switchRace(_live); }
      else { window._rtAutoPicked=true; updateRaceHeader(); if(activeTab==='gare') renderGare(); if(initialized) bootTab(); }
    }
  },err=>{setSyncStatus('err');dlog('❌ races_index: '+err.message,'err');console.error(err);});
}

/* copia dell'ultimo stato ricevuto dal server, base per salvare solo i campi cambiati (vedi rtDiff) */
var RT_SHARED_KEYS=['entryList','schedule','days','finals','trackSections','riskCut','schedDelay','apexAuto'];
var RT_USER_KEYS=['pilots','statuses','notes','trackStatus','teams','teamStatuses','teamNotes'];
var _rtBaseShared={},_rtBaseUser={};
function listenRaceData(raceId){
  if(raceDataUnsub) raceDataUnsub();
  if(!currentUserId){initialized=true;renderAll();return;}
  
  _rtBaseShared={};_rtBaseUser={};
  const sharedRef=ref(db,'races/'+raceId);
  const userRef=ref(db,'races/'+raceId+'/users/'+currentUserId);
  let sharedData={};let userData={};let sharedReady=false;let userReady=false;
  // Modalità senza rete: ultima copia dei dati salvata sul dispositivo, mostrata subito e poi sostituita dai dati live
  window._rtLiveSeen=false;window._rtSnapAt=0;
  const snapKey='rt_snap_'+raceId+'_'+currentUserId;
  function saveSnap(){try{localStorage.setItem(snapKey,JSON.stringify({s:sharedData,u:userData,at:Date.now()}));}catch(e){}}
  try{const c=JSON.parse(localStorage.getItem(snapKey)||'null');if(c&&c.s&&c.u){sharedData=c.s;userData=c.u;rtSetBase(sharedData,userData);sharedReady=true;userReady=true;window._rtSnapAt=c.at;setTimeout(()=>{if(!window._rtLiveSeen)mergeAndRender();},0);}}catch(e){}

  function mergeAndRender(){
    if(!sharedReady||!userReady)return;
    currentEntryList=sharedData.entryList||{};
    currentSchedule=sharedData.schedule||{};
    currentDays=sharedData.days||Object.keys(currentSchedule);
    if(!Array.isArray(currentDays))currentDays=typeof currentDays==='object'?Object.values(currentDays):[];
    currentFinals=sharedData.finals||[];
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
      if(!p.heats)p.heats=[];
      if(!Array.isArray(p.heats))p.heats=typeof p.heats==='object'?Object.values(p.heats):[];
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
    setSyncStatus('ok');
    initialized=true;
    renderAll();
  }

  const unsub1=onValue(sharedRef,snap=>{
    sharedData=snap.val()||{};window._rtLiveSeen=true;saveSnap();rtSetBase(sharedData,null);
    dlog('Dati gara condivisi: entryList='+Object.keys(sharedData.entryList||{}).length+', days='+(sharedData.days||[]).length,'ok');
    sharedReady=true;
    mergeAndRender();
  },err=>{setSyncStatus('err');dlog('❌ shared data: '+err.message,'err');});

  const unsub2=onValue(userRef,snap=>{
    userData=snap.val()||{};saveSnap();rtSetBase(null,userData);
    dlog('Dati utente ['+currentUserId+']: pilots='+Object.keys(userData.pilots||{}).length,'ok');
    userReady=true;
    mergeAndRender();
  },err=>{setSyncStatus('err');dlog('❌ user data: '+err.message,'err');});

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
// If no user set, show picker after a short delay
if(!currentUserId){
  setTimeout(()=>{try{window.hideLoader&&window.hideLoader();}catch(e){}showUserPicker();},500);
}

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
  return update(ref(db),u).then(()=>setSyncStatus('ok')).catch(e=>{setSyncStatus('err');console.error(e);dlog('❌ salvataggio: '+e.message,'err');});
}
function saveAll(){
  if(!activeRaceId||!currentUserId)return;
  const pilotsObj={};pilots.forEach(p=>pilotsObj[p.num]=p);
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
  if(cat==='MINI GR3')return'cat-gr3';if(cat==='MINI U10')return'cat-u10';if(cat==='OK-NJ')return'cat-nj';if(cat==='OKN')return'cat-okn';return'';
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
function pilotInGroup(pilot,filterArr){
  // NUOVO: se il pilota ha heats[], controlla se questa coppia di gruppi è nella lista
  // es. filterArr=['A','B'] → cerca 'A-B' in pilot.heats
  if(pilot.heats&&Array.isArray(pilot.heats)&&pilot.heats.length){
    const slotKey=filterArr.map(x=>String(x).trim().toUpperCase()).sort().join('-');
    return pilot.heats.some(h=>{
      const hKey=String(h).trim().toUpperCase().split('-').map(x=>x.trim()).sort().join('-');
      return hKey===slotKey;
    });
  }
  // FALLBACK LEGACY: usa group singolo
  const g=normalizeGroup(pilot.group);
  if(!g)return false;
  return filterArr.map(x=>String(x).trim().toUpperCase()).includes(g);
}

// Indica se il pilota ha dati gruppo validi (heats[] nuovo o group legacy)
function pilotHasGroupData(pilot){
  if(pilot.heats&&Array.isArray(pilot.heats)&&pilot.heats.length)return true;
  return!!normalizeGroup(pilot.group);
}

function pilotsForSlot(slot){
  let _pf=false;try{_pf=progFilterOn();}catch(e){}
  return pilots.filter(p=>{
    if(p.eliminated)return false;
    if(_pf&&!myPilotMatches(p,progSearchMode,progSearchTeam,progSearchCat))return false;
    if(canonCat(p.cat)!==canonCat(slot.cat))return false;
    if(slot.type==='all')return true;
    if(slot.type==='parity')return p.parity===slot.filter;
    if(slot.type==='serie'){if(!p.serie)return false;return String(p.serie).trim()===String(slot.filter).trim();}
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
    if(slot.type==='serie'&&!String(p.serie||'').trim())return true;
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
  if(slot.type==='list')return'LIST '+(Array.isArray(slot.filter)?slot.filter.length:0);
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
  saveUserField('statuses',statuses);
  if(activeTab==='livetiming'){ // nel Live cambia solo il colore della pillola: niente ridisegno della pagina
    const st=statuses[num][task];
    document.querySelectorAll('button.task-btn').forEach(b=>{if(b.getAttribute('onclick')==="toggleTask('"+num+"','"+task+"')")b.className='task-btn '+st;});
    return;
  }
  // ridisegno senza animazione di comparsa: niente lampeggio toccando una pillola
  document.body.classList.add('quiet');renderAll();
  clearTimeout(window._quietT);window._quietT=setTimeout(()=>document.body.classList.remove('quiet'),400);
}
window.toggleTask=toggleTask;

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
  const p=pilots.find(x=>x.num===num);
  const cur=(notes[num]||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  openModal('<button class="modal-close" onclick="closeModal()">✕</button>'
    +'<div class="modal-title">Nota #'+num+(p?' · '+p.name:'')+'</div>'
    +'<div class="form-group"><textarea class="form-textarea" id="pn-text" style="min-height:120px" placeholder="Commento, appunti, cosa fare...">'+cur+'</textarea></div>'
    +'<button class="form-submit" onclick="savePilotNote(\''+num+'\')">SALVA</button>');
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
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'+chips+'</div>'
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
      saveAll();alert('✅ Dati importati!');
    }catch(err){alert('❌ File non valido');}
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
let filterTask='all';
let filterStatus='all';

function setFilterTask(t){
  filterTask=t;
  document.querySelectorAll('.filter-row:first-child .filter-chip').forEach(c=>{
    const m=(c.getAttribute('onclick')||'').match(/setFilterTask\('(\w+)'\)/);
    if(m)c.classList.toggle('active',m[1]===t);
  });
  renderPilots();
}
window.setFilterTask=setFilterTask;

function setFilterStatus(s){
  filterStatus=s;
  document.querySelectorAll('.filter-row:nth-child(2) .filter-chip').forEach(c=>{
    const m=(c.getAttribute('onclick')||'').match(/setFilterStatus\('(\w+)'\)/);
    if(m)c.classList.toggle('active',m[1]===s);
  });
  renderPilots();
}
window.setFilterStatus=setFilterStatus;

function pilotMatchesFilter(p){
  if(filterTask==='all'&&filterStatus==='all')return true;
  const s=statuses[p.num]||{};
  if(filterTask!=='all'&&filterStatus!=='all'){
    return s[filterTask]===filterStatus;
  }
  if(filterTask!=='all'){
    return true; // show all with any status for that task
  }
  // filterStatus only
  return TASKS.some(t=>s[t]===filterStatus);
}

// ══════════════════════════════════════
// DEBUG TAB
// ══════════════════════════════════════
async function runFirebaseTest(){
  debugLogs=[];
  dlog('🚀 Inizio test Firebase...','info');

  // Step 1: REST API test on root
  dlog('Step 1: Test REST API root (shallow)...','info');
  try{
    const r=await fetch('https://karting-tools-default-rtdb.firebaseio.com/.json?shallow=true');
    if(r.ok){const d=await r.json();dlog('✅ REST root OK — chiavi: '+Object.keys(d||{}).join(', '),'ok');}
    else{dlog('❌ REST root HTTP '+r.status,'err');}
  }catch(e){dlog('❌ REST root: '+e.message,'err');}

  // Step 2: REST on /tracker (old path)
  dlog('Step 2: Test REST /tracker...','info');
  try{
    const r=await fetch('https://karting-tools-default-rtdb.firebaseio.com/tracker.json?shallow=true');
    if(r.ok){const d=await r.json();dlog(d?'✅ /tracker esiste — chiavi: '+Object.keys(d).join(', '):'⚠️ /tracker è vuoto/null','ok');}
    else{dlog('❌ /tracker HTTP '+r.status,'err');}
  }catch(e){dlog('❌ /tracker: '+e.message,'err');}

  // Step 3: REST on /races_index
  dlog('Step 3: Test REST /races_index...','info');
  try{
    const r=await fetch('https://karting-tools-default-rtdb.firebaseio.com/races_index.json');
    if(r.ok){const d=await r.json();dlog(d?'✅ /races_index esiste — '+Object.keys(d).length+' gare':'⚠️ /races_index vuoto — nessuna gara creata','ok');}
    else{dlog('❌ /races_index HTTP '+r.status,'err');}
  }catch(e){dlog('❌ /races_index: '+e.message,'err');}

  // Step 4: REST on active race
  if(activeRaceId){
    dlog('Step 4: Test REST /races/'+activeRaceId+'...','info');
    try{
      const r=await fetch('https://karting-tools-default-rtdb.firebaseio.com/races/'+activeRaceId+'.json?shallow=true');
      if(r.ok){const d=await r.json();dlog(d?'✅ Gara attiva OK — chiavi: '+Object.keys(d).join(', '):'⚠️ Gara attiva vuota','ok');}
      else{dlog('❌ Gara attiva HTTP '+r.status,'err');}
    }catch(e){dlog('❌ Gara attiva: '+e.message,'err');}
  } else {
    dlog('Step 4: Nessuna gara attiva selezionata','warn');
  }

  // Step 5: SDK WebSocket test
  dlog('Step 5: Test SDK .info/connected...','info');
  onValue(ref(db,'.info/connected'),snap=>{
    if(snap.val()===true)dlog('✅ WebSocket CONNESSO','ok');
    else dlog('⚠️ WebSocket non connesso','warn');
  },{onlyOnce:true});

  // Step 6: SDK write test
  dlog('Step 6: Test SDK scrittura...','info');
  try{
    await set(ref(db,'_test_ping'),{t:Date.now()});
    dlog('✅ Scrittura SDK OK','ok');
    await set(ref(db,'_test_ping'),null); // cleanup
  }catch(e){
    dlog('❌ Scrittura SDK fallita: '+e.message,'err');
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
  dlog('Test completato ✓','ok');
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
  const raceIds=Object.keys(races);
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
        +(isActive?'':'<button class="io-btn" style="font-size:10px;padding:8px;border-color:#ef4444;color:#ef4444" onclick="event.stopPropagation();deleteRace(\''+id+'\')">✕ ELIMINA</button>')
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
  }).catch(e=>dlog('❌ orgs.json: '+e.message,'err'));
}
loadOrgCatalog();
function orgOptions(sel){
  const ks=ORG_KEYS.slice();if(sel&&!ORG_CONFIG[sel])ks.push(sel); // org della gara non in catalogo: resta selezionabile
  return '<option value="">— organizzazione —</option>'+ks.map(k=>'<option value="'+k+'"'+(k===sel?' selected':'')+'>'+((ORG_CONFIG[k]||{}).label||k)+'</option>').join('');
}
// Live timing automatico: 1) URL scritto nella gara  2) circuito riconosciuto  3) default dell'organizzazione
function resolveLiveUrl(r){
  r=r||{};
  if(r.liveTiming&&String(r.liveTiming).trim())return String(r.liveTiming).trim();
  const txt=(r.circuit||'')+' '+(r.name||'');
  const c=CIRCUIT_LIVE.find(x=>x.re.test(txt));
  if(c)return c.url;
  const cfg=ORG_CONFIG[r.org]||null;
  return cfg&&cfg.liveTiming?cfg.liveTiming:'';
}
window.resolveLiveUrl=resolveLiveUrl;
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
  const items=[];
  slotsArr.forEach(function(slot,idx){
    const mine=pilotsForSlot(slot);
    const isNow=idx===currentIdx;
    if(!mine.length&&!isNow)return;
    items.push({time:slot.time,label:slot.label||slot.cat||'',nums:mine.map(function(p){return p.num;}),now:isNow});
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
  if(btn){const o=btn.innerHTML;btn.innerHTML='✓';setTimeout(function(){btn.innerHTML=o;},900);}
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
  openModal('<button class="modal-close" onclick="closeModal()">✕</button><div class="modal-title">Gare disponibili</div><input id="cal-q" type="search" placeholder="Cerca gara, circuito, città…" oninput="calQ=this.value;renderCalendar()" autocomplete="off" style="width:100%;min-height:44px;margin:0 0 10px;padding:10px 12px;border-radius:10px;border:1px solid var(--border,#333);background:var(--bg2,#151518);color:var(--text,#eee);font-size:15px;box-sizing:border-box"><div id="cal-body"><div class="empty-state"><p>Caricamento…</p></div></div>');
  if(calData){renderCalendar();return;}
  fetch('calendar.json',{cache:'no-cache'}).then(r=>r.json()).then(d=>{calData=d;renderCalendar();}).catch(()=>{
    const el=document.getElementById('cal-body');if(el)el.innerHTML='<div class="empty-state"><p>Calendario non disponibile offline.</p></div>';
  });
}
function setCalOrg(o){calOrg=o;calSer='';renderCalendar();}
function setCalSer(i){const l=window._calSerList||[];calSer=i<0?'':l[i];renderCalendar();}
function renderCalendar(){
  const el=document.getElementById('cal-body');if(!el||!calData)return;
  const today=new Date().toISOString().slice(0,10);
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
  openModal('<button class="modal-close" onclick="closeModal()">✕</button>'
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
  openModal('<button class="modal-close" onclick="closeModal()">✕</button>'
    +'<div class="modal-title"><i class="ic ic-gear"></i> '+r.name+'</div>'
    +'<div class="form-group"><label class="form-label">Nome Gara</label>'
    +'<input class="form-input" id="rs-name" value="'+r.name+'"></div>'
    +'<div class="form-group"><label class="form-label">Circuito</label>'
    +'<input class="form-input" id="rs-circuit" value="'+(r.circuit||'')+'"></div>'
    +'<div class="form-group"><label class="form-label">Organizzazione</label>'
    +'<select class="form-input" id="rs-org">'+orgOptions(r.org||'')+'</select></div>'
    +'<div class="form-group"><label class="form-label">URL Live Timing (opzionale)</label>'
    +'<input class="form-input" id="rs-livetiming" value="'+(r.liveTiming||'')+'" placeholder="default organizzazione se vuoto"></div>'
    +'<div style="display:flex;gap:8px">'
    +'<div class="form-group" style="flex:1"><label class="form-label">Data Inizio</label>'
    +'<input class="form-input" id="rs-start" type="date" value="'+(r.startDate||'')+'"></div>'
    +'<div class="form-group" style="flex:1"><label class="form-label">Data Fine</label>'
    +'<input class="form-input" id="rs-end" type="date" value="'+(r.endDate||'')+'"></div></div>'
    /* 14/11/2026: orari delle premiazioni dal programma ufficiale (servono al server per gli avvisi pole/podio e al Programma) */
    /* 14/11/2026: percorso dei risultati Apex della gara (serve al server multi-gara per seguirla da solo) */
    +'<div class="form-group"><label class="form-label">Risultati Apex (link o percorso)</label>'
    +'<input class="form-input" id="rs-apex" placeholder="https://www.apex-timing.com/goracing/results.php?path=/…" value="'+(r.apexPath||'')+'">'
    +'<div style="font-size:11px;color:var(--text4);margin-top:4px">Con questo il server segue la gara da solo: entry list, gruppi, arrivi, live.</div></div>'
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
    +'<button class="mgmt-btn" style="margin-top:8px;border-color:#60a5fa;color:#60a5fa" onclick="loadDefaultWSK(\''+raceId+'\')"><i class="ic ic-refresh"></i> CARICA DATI WSK PREDEFINITI</button>'
    +'<button class="mgmt-btn" style="margin-top:4px;border-color:#a78bfa;color:#a78bfa" onclick="closeModal();showWSKBookmarklet()"><i class="ic ic-bookmark"></i> MOSTRA BOOKMARKLET WSK</button>'
    +'</div>');
}
window.openRaceSettings=openRaceSettings;

// ── WSK HEATS: paste modal + bookmarklet ──
function openWSKPasteModal(raceId){
  openModal('<button class="modal-close" onclick="closeModal()">✕</button>'
    +'<div class="modal-title"><i class="ic ic-download"></i> Incolla Heats da WSK</div>'
    +'<div style="font-size:11px;color:var(--text4);margin-bottom:14px;line-height:1.6">'
    +'1. Vai su <strong style="color:var(--text)">wskarting.it/results/results.asp</strong><br>'
    +'2. Clicca il bookmarklet <strong style="color:#a78bfa">WSK Heats</strong> nella barra segnalibri<br>'
    +'3. Aspetta qualche secondo, poi incolla qui sotto</div>'
    +'<div class="form-group"><label class="form-label">JSON copiato dal bookmarklet</label>'
    +'<textarea class="form-textarea" id="wsk-paste-input" placeholder=\'[{"num":"563","heats":["B-C","B-D"]}, ...]\' style="min-height:120px;font-size:11px"></textarea></div>'
    +'<button class="form-submit" onclick="applyWSKHeats(\''+raceId+'\')">✅ APPLICA</button>');
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
    alert('✅ Heats aggiornate!\n'+updated+' tuoi piloti aggiornati'+(notFound?' ('+notFound+' non trovati tra i tuoi piloti)':''));
    closeModal();
  }catch(e){alert('❌ JSON non valido: '+e.message);}
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
    +'navigator.clipboard.writeText(json).then(()=>alert(\'✅ \'+Object.keys(ph).length+\' piloti. Torna nell\\\'app e incolla.\')).catch(()=>{prompt(\'Copia:\',json);});'
    +'})();;';

  const bookmarklet='javascript:'+encodeURIComponent(script);

  openModal('<button class="modal-close" onclick="closeModal()">✕</button>'
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
  if(apx&&!/^\/[a-z0-9\-_]+\/\d{4}\/[^\s]+$/i.test(apxPath)){alert('Link dei risultati Apex non valido');return;}
  u['races_index/'+raceId+'/apexPath']=apxPath||null;
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
      update(ref(db),u).then(()=>{alert('✅ Entry list caricata: '+count+' piloti');closeModal();});
    }catch(err){alert('❌ File non valido');}
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
          update(ref(db),u).then(()=>{alert('✅ '+count+' piloti caricati');closeModal();});
        });
    }catch(err){alert('❌ File non valido');}
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
      update(ref(db),u).then(()=>{alert('✅ Programma caricato: '+days.length+' giorni');closeModal();});
    }catch(err){alert('❌ File non valido');}
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
      let msg='✅ Assegnazioni aggiornate!\n'+updated+' piloti aggiornati';
      if(hasHeats)msg+='\n(formato heats[] — corrispondenza slot precisa)';
      else if(hasGroup)msg+='\n(formato group legacy)';
      if(eliminated)msg+='\n'+eliminated+' piloti eliminati (non in lista)';
      if(reactivated)msg+='\n'+reactivated+' piloti riattivati';
      alert(msg);
      closeModal();
    }catch(err){alert('❌ File non valido: '+err.message);}
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
  update(ref(db),u).then(()=>{alert('✅ Dati WSK caricati');closeModal();});
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
function slotKeyOf(slot){if(!slot)return'';if(slot.type==='prefinal'){const x=String(slot.filter||'').trim().toUpperCase();return x?'PF-'+x:'';}if(slot.type==='final')return'FIN';if(slot.type==='serie'){const q=String(slot.filter||'').trim().toUpperCase();return q?'Q-S'+q.replace(/^S/,''):'';}if(slot.type==='parity'){const p=String(slot.filter||'').trim().toUpperCase();return p&&activeDay?'PAR-'+String(activeDay).toUpperCase()+'-'+p:'';}if(slot.type!=='group')return'';const f=Array.isArray(slot.filter)?slot.filter:Object.values(slot.filter||{});return f.map(x=>String(x).trim().toUpperCase()).sort().join('-');}
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
  const e=currentEntryList[num]||{};const r=e.result&&e.result[k];
  const _out=(e.out&&e.out[k])||/^(X|DNF|DNS|RIT|AB|NC|RET|DSQ|SQ)/i.test(String(r||''));
  if(r!==undefined&&r!==null&&r!==''&&slotHasRun(slot)&&_out)
    return'<span title="Uscito: posizione in classifica" style="font-family:\'Chakra Petch\';font-size:12px;font-weight:900;color:#fff;background:#dc2626;border-radius:5px;padding:1px 7px;flex-shrink:0">✕'+(/^\d+$/.test(String(r))?' '+r+'°':/DSQ|SQ/i.test(String(r))?' SQ':'')+'</span>';
  if(r!==undefined&&r!==null&&r!==''&&slotHasRun(slot)){const t=/^\d+$/.test(String(r))?String(r)+'°':String(r).toUpperCase();
    const rs=resStatusOf(e.cat,k),uff=!!(rs&&rs.st==='ufficiale'),cor=!!(rs&&rs.corr);
    const tip=(uff?'Arrivo ufficiale (Apex)':'Arrivo provvisorio'+(rs?' (Apex)':' (dal live)'))+(cor?' · corretto dopo la pubblicazione':'');
    const sty=uff?'color:#0d0d0f;background:#4fd69c;border:1px solid #4fd69c':'color:#4fd69c;background:transparent;border:1px dashed #4fd69c';
    return'<span title="'+tip+'" style="font-family:\'Chakra Petch\';font-size:12px;font-weight:700;'+sty+';border-radius:5px;padding:0 6px;flex-shrink:0"><i class="ic ic-flag"></i> '+t+(cor?' <span style="color:#facc15">●</span>':'')+'</span>';}
  const n=gridPos(num,slot);
  return n?'<span title="Posizione in griglia (lista ufficiale)" style="font-family:\'Chakra Petch\';font-size:12px;font-weight:700;color:#1a160e;background:#e9d5a8;border-radius:5px;padding:1px 7px;flex-shrink:0">P'+n+'</span>':'';
}
function noteLine(num){
  const n=String((notes&&notes[num])||'').trim();if(!n)return'';
  const e=n.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return'<div class="note-txt" style="margin-top:4px;white-space:pre-wrap"><i class="ic ic-note"></i> '+e+'</div>';
}
function searchResultItem(m){
  const catCls=catClass(m.cat);const isMine=m.isMyPilot;
  return'<div class="search-result-item" style="'+(isMine?'border-color:#22c55e;background:rgba(34,197,94,.06)':'')+'" onclick="openPilotDetail(\''+m.num+'\')">'
    +'<span class="sr-num" style="'+(isMine?'color:#22c55e':'')+'">#'+m.num+'</span>'
    +'<div style="flex:1;min-width:0">'
    +'<div class="sr-name">'+m.name+(isMine?' <span style="font-size:10px;color:#22c55e;font-weight:800"><i class="ic ic-star"></i> TUO</span>':'')+'</div>'
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

  openModal('<button class="modal-close" onclick="closeModal()">✕</button>'
    +'<div class="detail-sheet">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    +'<span style="font-size:28px;font-weight:900">#'+num+'</span>'
    +(isMine?'<span style="font-size:11px;color:#22c55e;font-weight:800;border:1px solid #22c55e;padding:2px 8px;border-radius:4px"><i class="ic ic-star"></i> TUO PILOTA</span>':'')
    +'</div>'
    +'<div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px">'+name+'</div>'
    +'<div style="font-size:15px;font-weight:700;color:var(--text3);margin-bottom:8px">'+team+'</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:16px">'
    +'<span class="'+catCls+'" style="font-size:12px;padding:3px 10px;border-radius:6px;font-weight:800;border:1px solid">'+cat+'</span>'
    +'<span class="parity-badge">'+parity+'</span></div>'
    +'<div id="detail-hist" style="margin-bottom:14px"></div>'
    +'<div class="form-group"><label class="form-label">Note su questo pilota</label>'
    +'<textarea class="form-textarea" id="detail-note" placeholder="Appunti, info, osservazioni...">'+existingNote+'</textarea></div>'
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
    const rows=Object.values(h).filter(Boolean).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    const esc=t=>String(t==null?'':t).replace(/[<>&"]/g,'');
    el.innerHTML='<div class="form-label" style="margin-bottom:6px">Storico gare</div>'+rows.map(r=>{
      const res=r.result||{};const keys=Object.keys(res).sort((a,b)=>(a.length-b.length)||a.localeCompare(b));
      const fmt=v=>/^\d+$/.test(String(v))?v+'°':esc(v);
      const parts=keys.map(x=>(x==='FIN'?'Finale':x.startsWith('PF-')?'Pref. '+x.slice(3):x)+' '+fmt(res[x]));
      const d=r.date?r.date.split('-').reverse().join('/'):'';
      return'<div style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;font-size:12px">'
        +'<div style="font-weight:800;color:var(--text)">'+esc(r.race)+(d?' · '+d:'')+' · '+esc(r.cat)+' #'+esc(r.num)+'</div>'
        +'<div style="color:var(--text3);margin-top:2px">'+(parts.length?parts.join(' · '):'nessun risultato ancora')+(r.inFinal?' · in finale':'')+(r.eliminated&&!r.inFinal?' · eliminato':'')+'</div></div>';
    }).join('');
  });}catch(e){}
}

function saveDetailNote(num){
  const el=document.getElementById('detail-note');
  if(el){notes[num]=el.value;saveUserField('notes',notes);alert('✅ Note salvate');}
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
  pilots.push({num:num.toString(),name,team,cat,parity:autoParity(num),group,prefinal,serie,heats,eliminated:false});
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
function escAttr(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');}
// Piloti dell'entry list che appartengono al team, come oggetti simili ai piloti
function teamEntrants(t){
  const out=[];
  Object.entries(currentEntryList).forEach(([num,e])=>{
    if(!e||teamKey(e.team)!==t.key)return;
    let h=e.heats||[];if(!Array.isArray(h))h=typeof h==='object'?Object.values(h):[];
    out.push({num,cat:e.cat||'',parity:e.parity||autoParity(num),serie:e.serie||'',group:e.group||'',prefinal:e.prefinal||'',heats:h,name:(e.lastName||'')+' '+(e.firstName||'')});
  });
  return out.sort((a,b)=>parseInt(a.num)-parseInt(b.num));
}
function entrantInSlot(p,slot){
  if(canonCat(p.cat)!==canonCat(slot.cat))return false;
  if(slot.type==='all')return true;
  if(slot.type==='parity')return p.parity===slot.filter;
  if(slot.type==='serie')return!!p.serie&&String(p.serie).trim()===String(slot.filter).trim();
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
    if(slot.type==='serie')waiting=ents.filter(p=>!String(p.serie||'').trim());
    if(slot.type==='group')waiting=ents.filter(p=>!pilotHasGroupData(p));
    if(slot.type==='prefinal')waiting=ents.filter(p=>!String(p.prefinal||'').trim());
    if(inSlot.length||waiting.length)res.push({t,inSlot,waiting});
  });
  return res;
}
function teamTaskBtn(key,task,small){
  const s=(teamStatuses[key]||{})[task]||'red';
  const sz=small?'style="padding:4px 8px;font-size:10px"':'';
  return'<button class="task-btn '+s+'" '+sz+' onclick="toggleTeamTask(\''+escAttr(key)+'\',\''+task+'\')">'+task+'</button>';
}
function teamsSlotHtml(slot){
  const list=teamsForSlot(slot);if(!list.length)return'';
  return list.map(({t,inSlot,waiting})=>'<div class="card-inner team-inner"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">'
    +'<span class="inner-num"><i class="ic ic-team"></i></span><span class="inner-name">'+t.name+'</span>'
    +'<span style="font-size:10px;font-weight:800;color:#a78bfa">'+(inSlot.length?inSlot.length+' in pista: '+inSlot.map(p=>'#'+p.num+(gridPos(p.num,slot)?' <span style="color:#e9d5a8">P'+gridPos(p.num,slot)+'</span>':'')).join(' · '):'')
    +(waiting.length?(inSlot.length?' · ':'')+'<i class="ic ic-wait"></i> '+waiting.length+' in attesa':'')+'</span></div>'
    +'<div class="tasks">'+TASKS.map(k=>teamTaskBtn(t.key,k,true)).join('')+'</div>'
    +(teamNotes[t.key]?'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> '+teamNotes[t.key]+'</div>':'')+'</div>').join('');
}
function addTeam(name){
  const key=teamKey(name);
  if(teams.some(t=>t.key===key)){setPilotsView('team');return;}
  teams.push({key,name:String(name).trim().toUpperCase()});
  teamStatuses[key]={};TASKS.forEach(k=>teamStatuses[key][k]='red');
  teamNotes[key]='';
  saveAll();renderPilotSearchResults();
}
window.addTeam=addTeam;
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
  saveUserField('teamStatuses',teamStatuses);renderAll();
  if(document.getElementById('ov-body'))renderOverviewBody();
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
  if(filterStatus==='all')return true;
  const s=teamStatuses[t.key]||{};
  if(filterTask!=='all')return s[filterTask]===filterStatus;
  return TASKS.some(k=>s[k]===filterStatus);
}
function renderTeams(){
  const el=document.getElementById('pilots-list');
  if(!teams.length){el.innerHTML='<p class="no-pilots">Nessun team. Cerca per <i class="ic ic-team"></i> TEAM e premi <i class="ic ic-plus"></i> AGGIUNGI TEAM.</p>';return;}
  const filtered=teams.filter(teamMatchesFilter).sort((a,b)=>a.name.localeCompare(b.name));
  const counter='<div style="font-size:11px;font-weight:700;color:var(--text4);margin-bottom:14px;letter-spacing:1px;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;">'
    +(filterStatus!=='all'?'FILTRO':'TOTALE TEAM')+' <span style="color:var(--text);font-size:18px;font-weight:900;margin-left:8px;">'+filtered.length+(filterStatus!=='all'?'/'+teams.length:'')+'</span></div>';
  el.innerHTML=counter+filtered.map(t=>{
    const ents=teamEntrants(t);
    const cats=[...new Set(ents.map(p=>p.cat))];
    return'<div class="card team-card"><div class="pilot-header"><div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap">'+cats.map(c=>'<span class="pilot-cat '+catClass(c)+'">'+c+'</span>').join('')+'</div>'
      +'<div style="display:flex;align-items:center;gap:8px;margin-top:3px"><span class="pilot-num"><i class="ic ic-team"></i></span><span class="pilot-name">'+t.name+'</span></div>'
      +'<div class="pilot-team">'+ents.length+' piloti iscritti</div>'
      +'<div class="team-nums">'+ents.map(p=>'<span class="team-num'+(pilots.some(x=>x.num===p.num)?' mine':'')+'" onclick="openPilotDetail(\''+p.num+'\')">#'+p.num+'</span>').join('')+'</div>'
      +'</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px">'
      +'<button class="pilot-edit-btn" style="color:#ef4444;border-color:#ef4444" onclick="removeTeam(\''+escAttr(t.key)+'\')">✕ rimuovi</button></div></div>'
      +'<div class="tasks">'+TASKS.map(k=>teamTaskBtn(t.key,k,false)).join('')+'</div>'
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
  openModal('<button class="modal-close" onclick="closeModal()">✕</button>'
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
  const rows=slots.map(s=>({time:s.time,cat:s.cat,label:s.label||s.cat,sub:slotFilterLabel(s),ps:pilotsForSlot(s),aw:pilotsAwaitingData(s),ts:teamsForSlot(s)}));
  if(activeDay===currentDays[currentDays.length-1]){
    currentFinals.forEach(f=>{
      const allCat=pilots.filter(p=>canonCat(p.cat)===canonCat(f.cat)&&!p.eliminated);const fin=allCat.filter(p=>p.inFinal);
      rows.push({time:f.time,cat:f.cat,label:f.label||f.cat,sub:'FINALE',ps:fin.length?fin:allCat,aw:[],ts:teams.filter(t=>teamEntrants(t).some(p=>canonCat(p.cat)===canonCat(f.cat))).map(t=>({t,inSlot:[],waiting:[]}))});
    });
  }
  const isToday=autoDayName()===activeDay;
  const nowM=new Date().getHours()*60+new Date().getMinutes()-scheduleDelay;
  let nowIdx=-1;if(isToday)rows.forEach((r,i)=>{if(slotMins(r.time)<=nowM)nowIdx=i;});
  const html=rows.map((r,i)=>{
    const empty=!r.ps.length&&!r.aw.length&&!r.ts.length;
    if(empty&&!ovShowAll)return'';
    const cls=i===nowIdx?' now':(isToday&&i<nowIdx?' past':'');
    const nums=r.ps.map(p=>{const st=(statuses[p.num]||{}).PISTA||'red';return'<span class="ov-n '+st+'" onclick="ovOpenPilot(\''+p.num+'\')">'+p.num+'</span>';}).join('')
      +(r.aw.length?'<span class="ov-n" style="opacity:.5;border-style:dashed"><i class="ic ic-wait"></i>'+r.aw.length+'</span>':'')
      +r.ts.map(({t})=>{const st=(teamStatuses[t.key]||{}).PISTA||'red';return'<span class="ov-t '+st+'" onclick="toggleTeamTask(\''+escAttr(t.key)+'\',\'PISTA\')"><i class="ic ic-team"></i> '+t.name+'</span>';}).join('');
    return'<div class="ov-row'+cls+'"><span class="ov-time">'+r.time+'</span><span class="ov-cat '+catClass(r.cat)+'">'+r.label+'<br><span style="color:var(--text4);font-size:9px">'+r.sub+'</span></span>'
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
function copyAllForEditor(){
  if(!pilots.length){alert('Nessun pilota da copiare');return;}
  const all=pilots.slice();
  const text=all.map(p=>{
    const note=notes[p.num]?notes[p.num].trim():'';
    return'#'+p.num+' '+p.name+(note?'\nNote: '+note:'');
  }).join('\n\n');
  navigator.clipboard.writeText(text)
    .then(()=>alert('✅ Copiato! '+all.length+' piloti negli appunti.'))
    .catch(()=>{prompt('Copia questo testo:',text);});
}
window.copyAllForEditor=copyAllForEditor;

// ══════════════════════════════════════
// ADVANCED SEARCH — shared helpers
// ══════════════════════════════════════
const CATS=['KZ2','OK','OKN','OKJ','MINI GR3','MINI U10','OK-NJ'];

function getMyTeams(){
  const t={};pilots.forEach(p=>{const tm=p.team||((currentEntryList[p.num]||{}).team)||'';if(tm)t[tm]=(t[tm]||0)+1;});
  return Object.entries(t).sort((a,b)=>a[0].localeCompare(b[0]));
}
function myPilotMatches(p,mode,team,cat){
  if(mode==='team')return!!team&&((p.team||((currentEntryList[p.num]||{}).team)||'')===team);
  if(mode==='cat')return!!cat&&canonCat(p.cat)===canonCat(cat);
  return true;
}
function getTeamsFromEntryList(){
  const teams={};
  Object.values(currentEntryList).forEach(e=>{
    if(e.team)teams[e.team]=(teams[e.team]||0)+1;
  });
  return Object.entries(teams).sort((a,b)=>a[0].localeCompare(b[0]));
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
  if(!teams.length){el.innerHTML='<div style="padding:14px;font-size:12px;color:var(--text4);text-align:center">Nessun team</div>';return;}
  el.innerHTML=teams.map(([t,cnt])=>'<div class="scuderia-item'+(pilotSearchTeam===t?' selected':'')+'" onclick="selectPilotTeam(\''+t.replace(/'/g,"\\'")+'\')">'
    +'<span style="flex:1">'+t+'</span><span style="font-size:10px;color:var(--text4);font-weight:700;margin-left:8px">'+cnt+'</span></div>').join('');
}
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
      if((e.team||'')=== pilotSearchTeam)
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
    const tk=teamKey(pilotSearchTeam);const has=teams.some(t=>t.key===tk);
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
      if(slot.type==='serie'){if(!p.serie)return false;return String(p.serie).trim()===String(slot.filter).trim();}
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
    if(elSearchTeam)filtered=filtered.filter(([,e])=>e.team===elSearchTeam);
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
        +'<div class="entry-name">'+(p.lastName||'')+' '+(p.firstName||'')+(isMine?' <span style="font-size:9px;color:#22c55e;font-weight:800"><i class="ic ic-star"></i> TUO</span>':'')+'</div>'
        +'<div class="entry-team">'+( p.team||'')+'</div>'+noteLine(p.num)+'</div>'
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
    +((filterTask!=='all'||filterStatus!=='all')?'FILTRO':'TOTALE PILOTI')
    +' <span style="color:var(--text);font-size:18px;font-weight:900;margin-left:8px;">'+showing+((filterTask!=='all'||filterStatus!=='all')?'/'+total:'')+'</span></div>';
  el.innerHTML=counter+filtered.map((p,i)=>{
    const isElim=p.eliminated;
    const hl=p.highlight||[];
    const hlLabels={foto:'<i class="ic ic-camera"></i> FOTO',video:'<i class="ic ic-video"></i> VIDEO',priority:'<i class="ic ic-star"></i> PRIORITÀ'};
    const hlCls=hl.indexOf('foto')>=0&&hl.indexOf('video')>=0?'hl-both':hl.length===1?'hl-'+hl[0]:'';
    return'<div class="card '+hlCls+'">'
    +'<div class="pilot-header">'
    +'<div style="display:flex;align-items:flex-start;gap:10px;">'
    +'<span class="pilot-index">'+(i+1)+'.</span><div>'
    +'<div class="pilot-cat '+catClass(p.cat)+'">'+p.cat+(isElim?' <span style="color:#ef4444;font-size:9px">ELIMINATO</span>':'')+'</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-top:3px">'
    +'<span class="pilot-num">#'+p.num+'</span>'
    +'<span class="pilot-name">'+p.name+'</span></div>'
    +'<div class="pilot-team">'+p.team+'</div></div></div>'
    +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px">'
    +(hl.length?'<div class="hl-badges">'+hl.map(function(h){return'<span class="hl-badge hl-'+h+'">'+(hlLabels[h]||h)+'</span>';}).join('')+'</div>':'')
    +'<span class="parity-badge">'+p.parity+'</span>'
    +'<span class="group-badge '+(pilotHasGroupData(p)?'set':'')+'">'
    +(p.heats&&p.heats.length?p.heats.join(' '):(p.group?'GRP '+p.group:'GRP ?'))
    +'</span>'
    +'<button class="pilot-edit-btn" onclick="openEditPilot(\''+p.num+'\')"><i class="ic ic-note"></i> modifica</button>'
    +'<button class="pilot-edit-btn" style="color:#ef4444;border-color:#ef4444" onclick="deletePilot(\''+p.num+'\')">✕ rimuovi</button>'
    +'</div></div>'
    +'<div class="tasks">'+TASKS.map(t=>taskBtn(p.num,t,false,isElim)).join('')+'</div>'
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
function applyDelayPerms(){
  const adm=isDelayAdmin();
  document.querySelectorAll('[onclick^="setDelay("]').forEach(b=>{b.style.display=adm?'':'none';});
  const dd=document.getElementById('delay-display');
  if(dd){dd.style.pointerEvents=adm?'':'none';}
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
function renderSchedule(){
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
  }
  let html='';let lastSession='';
  // Quante volte corre oggi ogni mio pilota e quale di queste è lo slot (es. Gara 2/3)
  // Se un turno dipende da dati non ancora ufficiali (prefinale non assegnata, finale non decisa) il totale è "?"
  const _runs={},_unc={},_finIn={};
  const _awaits=(p,sl)=>canonCat(p.cat)===canonCat(sl.cat)&&((sl.type==='serie'&&!String(p.serie||'').trim())||(sl.type==='group'&&!pilotHasGroupData(p))||(sl.type==='prefinal'&&!String(p.prefinal||'').trim()));
  let _sess='';
  slotsArr.forEach((sl,i)=>{if(sl.session)_sess=sl.session;pilots.forEach(p=>{if(p.eliminated)return;
    if(entrantInSlot(p,sl))(_runs[p.num]=_runs[p.num]||[]).push(i);
    else if(_awaits(p,sl)){const u=(_unc[p.num]=_unc[p.num]||{});const k=[_sess,sl.type].join('|');if(!(k in u))u[k]=i;}
  });});
  const _lastDay=activeDay===currentDays[currentDays.length-1]&&currentFinals.length;
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
  slotsArr.forEach((slot,idx)=>{
    const ps=pilotsForSlot(slot);const isNow=idx===currentIdx;
    const awaiting=pilotsAwaitingData(slot);
    let _pf=false;try{_pf=progFilterOn();}catch(e){}
    try{watchUserSettings();}catch(e){}
    const _tv=teamViewMode(),_hl=_tv!=='cards';
    const tHtml=_pf?'':(_tv==='both'?teamsHighlightHtml(slot,ps)+teamsSlotHtml(slot):_hl?teamsHighlightHtml(slot,ps):teamsSlotHtml(slot));
    if(_pf&&!ps.length)return; // con il filtro attivo si vedono solo gli orari dei piloti filtrati
    if(slot.session&&slot.session!==lastSession){html+='<div class="session-divider">'+slot.session+'</div>';lastSession=slot.session;}

    // No pilots matched AND some are waiting for data assignment
    if(!ps.length&&awaiting.length&&!tHtml){
      const typeLabel=slot.type==='serie'?'serie':slot.type==='group'?'gruppo':slot.type==='prefinal'?'prefinal':'';
      html+='<div class="card'+(isNow?' slot-now':'')+'" style="opacity:.35;padding:10px 14px" '+(isNow?'id="slot-now"':'')+'>'
        +'<div style="display:flex;align-items:center;gap:8px">'
        +'<span style="font-size:13px;font-weight:900;color:var(--text4)">'+slot.time+'</span>'
        +'<span class="'+catClass(slot.cat)+'" style="font-size:10px;font-weight:800">'+slot.label+'</span>'
        +'<span style="font-size:9px;color:#fbbf24;font-weight:700;margin-left:auto;letter-spacing:1px"><i class="ic ic-wait"></i> ATTESA '+typeLabel.toUpperCase()+'</span>'
        +'</div></div>';
      return;
    }

    // No pilots at all for this slot
    if(!ps.length&&!tHtml&&userSettings.hideEmpty===true&&!isNow)return;
    if(!ps.length&&!tHtml){
      html+='<div class="card'+(isNow?' slot-now':'')+'" style="opacity:.45" '+(isNow?'id="slot-now"':'')+'><div class="slot-header">'
        +'<span class="slot-time">'+slot.time+'</span>'+(isNow?'<span class="now-badge">ORA</span>':'')
        +'<span class="slot-label '+catClass(slot.cat)+'">'+slot.label+'</span>'
        +'<span class="slot-type">'+slotFilterLabel(slot)+'</span>'+slotDur(slot)+'</div>'
        +'<div style="font-size:11px;font-weight:700;color:var(--text4);padding:2px 0">— NESSUNO —</div></div>';
      return;
    }

    // Has pilots — show them, plus warning if some are still awaiting
    html+='<div class="card'+(isNow?' slot-now':'')+'" '+(isNow?'id="slot-now"':'')+'><div class="slot-header">'
      +'<span class="slot-time">'+slot.time+'</span>'+(isNow?'<span class="now-badge">ORA</span>':'')
      +'<span class="slot-label '+catClass(slot.cat)+'">'+slot.label+'</span>'
      +'<span class="slot-type">'+slotFilterLabel(slot)+'</span>'+slotDur(slot)+'</div>'
      +(awaiting.length?'<div style="font-size:9px;color:#fbbf24;font-weight:600;margin-top:4px"><i class="ic ic-wait"></i> '+awaiting.map(p=>'#'+p.num).join(' ')+' in attesa</div>':'')
      +'<div style="margin-top:8px">';
    ps.forEach(p=>{
      var sh=p.highlight||[];
      var shCls=sh.indexOf('foto')>=0&&sh.indexOf('video')>=0?'hl-both':sh.length===1?'hl-'+sh[0]:'';
      var shIco={foto:'<i class="ic ic-camera"></i>',video:'<i class="ic ic-video"></i>',priority:'<i class="ic ic-star"></i>'};
      var _ft=_hl?followedTeamOf(p.num,p.team):null;
      html+='<div class="card-inner'+(shCls?' '+shCls:'')+(_ft?' tglow':'')+'"'+(_ft?' style="--tc:'+teamColor(_ft.key)+'"':'')+'><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'
        +(sh.length?sh.map(function(h){return'<span class="hl-badge hl-'+h+'" style="padding:1px 5px;font-size:8px">'+(shIco[h]||'')+'</span>';}).join(''):'')
        +'<span class="inner-num">#'+p.num+'</span>'+gridBadge(p.num,slot)+'<span class="inner-name">'+p.name+'</span>'+runChip(p.num,idx)
        +(p.group?'<span class="inner-group">GRP '+p.group+'</span>':'')
        +'<span class="inner-team-big">'+p.team+'</span>'
        +'<button onclick="editPilotNote(\''+p.num+'\')" style="margin-left:6px;background:none;border:none;color:var(--text4);font-size:14px;cursor:pointer;padding:0 2px;flex-shrink:0"><i class="ic ic-note"></i></button></div>'
        +'<div class="tasks">'+TASKS.map(t=>taskBtn(p.num,t,true)).join('')+'</div>'
        +(notes[p.num]?'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> '+notes[p.num]+'</div>':'')+'</div>';
    });
    html+=tHtml+'</div></div>';
  });
  updateProgTicker(slotsArr,currentIdx);
  if(activeDay===currentDays[currentDays.length-1]&&currentFinals.length){
    html+='<div class="session-divider">FINALI</div>';
    const myCanon=new Set(pilots.map(p=>canonCat(p.cat)));
    /* 14/11 20:05 (Andrea): il programma deve essere SEMPRE completo: anche le finali senza miei piloti, come turno vuoto */
    currentFinals.slice().sort((a,b)=>_toM(a.time)-_toM(b.time)).forEach(f=>{
      const allCat=pilots.filter(p=>canonCat(p.cat)===canonCat(f.cat));
      const finalists=allCat.filter(p=>p.inFinal);
      const ps=finalists.length?finalists:allCat;
      const _fNow=_finalNowKey===(f.label+'|'+f.time);
      html+='<div class="final-card'+(_fNow?' slot-now':'')+'"'+(_fNow?' id="slot-now"':'')+'><div class="final-title"><i class="ic ic-trophy"></i> '+f.label+(_fNow?' <span class="now-badge">ORA</span>':'')+'</div>'
        +'<div class="final-row"><span>Partenza</span><span class="final-time">'+f.time+'</span></div>'
        +(slotDurText(f)?'<div class="final-row"><span>Durata</span><span class="final-time">'+slotDurText(f)+'</span></div>':'');
      if(!ps.length)html+='<div style="font-size:12px;color:var(--text4);padding:8px 2px 2px">Nessun tuo pilota in questa finale</div>';
      ps.forEach(p=>{
        html+='<div class="card-inner" style="margin-top:8px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'
          +'<span class="inner-num">#'+p.num+'</span>'+gridBadge(p.num,{type:'final'})+'<span class="inner-name">'+p.name+'</span>'+(p.eliminated?'':runChip(p.num,1e6))
          +'<span class="inner-team-big">'+p.team+'</span></div>'
          +'<div class="tasks">'+TASKS.map(t=>taskBtn(p.num,t,true)).join('')+'</div>'
          +(notes[p.num]?'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> '+notes[p.num]+'</div>':'')+'</div>';
      });
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
          +'<span class="inner-name">'+p.name+'</span>'
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
    html+='<div style="display:flex;gap:6px;flex-wrap:wrap">'+chips+'</div>';
    html+='<div style="font-size:10px;color:var(--text4);text-align:center;padding:6px 0 2px">verde = completati sui '+tot+' tuoi piloti</div>';
  }
  el.innerHTML=awardsStrip(activeDay)+(html||'<div class="empty-state"><p>Nessun tuo pilota in questa giornata</p></div>');
  const fab=document.getElementById('fab-now');if(fab)fab.classList.add('visible');
  const fabTop=document.getElementById('fab-top');if(fabTop)fabTop.classList.add('visible');
  const fabBot=document.getElementById('fab-bottom');if(fabBot)fabBot.classList.add('visible');
  /* FIX 14/11/2026: la richiesta di scorrere a ORA si consuma solo quando la sessione ORA e' davvero disegnata
     (prima veniva persa su un render a dati vuoti e il Programma restava in un punto a caso) */
  if(scheduleNeedsScroll&&document.getElementById('slot-now')){
    scheduleNeedsScroll=false;
    setTimeout(()=>{const nowEl=document.getElementById('slot-now');if(nowEl)nowEl.scrollIntoView({behavior:'smooth',block:'center'});},150);
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
  for(let i=currentIdx+1;i<slotsArr.length&&items.length<6;i++){
    const sl=slotsArr[i];const mine=pilotsForSlot(sl);
    if(!mine.length)continue;
    const pr=sl.time.split('.');const slM=parseInt(pr[0])*60+parseInt(pr[1]);
    const mins=slM-nowM;
    const when=mins<=0?'a breve':(mins>=60?Math.floor(mins/60)+'h'+(mins%60):mins+'min');
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
function apexLiveName(){
  const r=(typeof races!=='undefined'&&races[activeRaceId])?races[activeRaceId]:{};
  const cfg=ORG_CONFIG[r.org]||null;
  const url=resolveLiveUrl(r);
  const m=url.match(/apex-timing\.com\/live-timing\/([a-z0-9\-]+)\//i);
  return m?m[1].toLowerCase():'';
}
function apexConnect(){
  const name=apexLiveName();const port=APEX_LIVE_PORTS[name];
  const key=name&&port?name+':'+port:'';
  if(key===apexWsKey&&apexWs&&apexWs.readyState<=1)return;
  try{if(apexWs)apexWs.close();}catch(e){}
  apexWs=null;apexWsKey=key;apexState={cat:'',sess:'',start:'',red:'',at:0};apexNext=null;apexSeen=new Set();apexIgnore=new Set();
  if(!key){renderApexDelay();return;}
  try{
    apexWs=new WebSocket('wss://live-data.apex-timing.com:'+(port+3)+'/');
    apexWs.onmessage=ev=>apexParse(String(ev.data));
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
  const cat=apexCat(apexState.cat);const ss=String(apexState.sess||'').toUpperCase();
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
    const mh=ss.match(/HEATS?\s+([A-D])\s*-\s*([A-D])/);
    // solo a manche davvero conclusa: il primo deve aver fatto tutti i giri del programma (o almeno 3 se il programma non li dice).
    // Una partenza annullata o una bandiera rossa a inizio gara NON è un arrivo (14/11: la griglia era stata salvata come arrivo).
    let _done=false;try{const L=apexLapInfo();_done=L.led!==null&&(L.tot?(L.led>=L.tot||(L.fin&&L.led>=L.tot-1)):L.led>=3);}catch(e){}
    // Prove pari/dispari (warm-up, libere): a fine sessione la posizione del live (ordine per miglior giro)
    const mp=ss.match(/\b(EVEN|ODD)\b/);
    let _pfin=why==='finish';try{if(!_pfin)_pfin=apexLapInfo().fin;}catch(e){}
    if(!mh&&mp&&/WARM|FREE|PRACT/.test(ss)&&!/QUALIF/.test(ss)&&activeRaceId&&_pfin){
      const day=typeof autoDayName==='function'?autoDayName():activeDay;const pk='PAR-'+String(day).toUpperCase()+'-'+mp[1];const u={};
      snap.forEach(x=>{
        if(!x.pos||x.pos>=999)return;const e=currentEntryList[x.num];if(!e||apexCat(e.cat)!==cat)return;
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
    const mpf=ss.match(/PREFINAL[E]?\s+([AB])\b/),mfi=/FINAL/.test(ss)&&!/PREFINAL/.test(ss);
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
  if(prev){pilots.forEach(p=>{if(now[p.num]&&prev[p.num]===false)rtAlert('elim|'+activeRaceId+'|'+p.num,'❌ ELIMINATO: #'+p.num+' '+p.name+' ('+p.cat+')','Da classifica ufficiale caricata · verifica eventuali reclami','');});}
  try{localStorage.setItem(k,JSON.stringify(now));}catch(e){}
}
// Gli avvisi di prova della versione precedente ('test|') non sono avvisi di gara: esclusi
function alertKey(r){return['rt_alerts_',r||activeRaceId,'_',currentUserId||''].join('');}
function alertLog(){try{return JSON.parse(localStorage.getItem(alertKey())||'[]').filter(a=>a&&a.id&&!a.id.startsWith('test|'));}catch(e){return[];}}
// Preferenze notifiche per utente (Firebase notifPrefs/<utente>/<tipo> = false spegne; default acceso).
// Le stesse chiavi le rispetta il server push.
const NOTIF_TYPES=[['qualifiche','Pole e top 3 in qualifica'],['finali','P1–P5 in finale'],['eliminati','Eliminati e rischio finale'],['prefinali','Passati a prefinali e finale'],['riepilogo','Riepilogo serale (orari di domani)'],['entrylist','Cambi entry list (miei piloti e team)'],
  ['ritiri','Mio pilota uscito o fermo in pista'],['rossa','Bandiera rossa con i miei piloti in pista'],['partenza','Partita una sessione con i miei piloti'],['prossima','Mio pilota in pista tra 10 minuti'],['ritardo','Ritardo cambiato di 5 minuti o più'],['correzioni','Correzioni ufficiali sui miei piloti (reclami, penalità)'],['comunicati','Comunicati e documenti ufficiali nuovi'],['promozioni','Mio pilota promosso dopo le verifiche: pole in qualifica o podio in finale']];
// nuove (dal 14/11): spente finché l'utente non le accende
const NOTIF_DEF_OFF=new Set(['ritiri','rossa','partenza','prossima','ritardo','correzioni','comunicati','promozioni']);
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
  openModal('<button class="modal-close" onclick="closeModal()">✕</button><div class="modal-title">Le mie notifiche</div><div id="notif-prefs-body"></div>');
  renderNotifPrefs();
}
window.openNotifPrefs=openNotifPrefs;window.setNotifPref=setNotifPref;
// ── IMPOSTAZIONI per account (Firebase settings/<utente>): notifiche, team nel programma, colori dei team ──
const TEAM_PALETTE=['#a78bfa','#22d3ee','#f472b6','#34d399','#fb923c','#facc15','#60a5fa','#f87171','#ff1a1a','#ffffff','#ff6a00','#22c55e','#2563eb','#d946ef','#a3e635','#14b8a6','#eab308','#ec4899','#7c3aed','#06b6d4','#84cc16','#f59e0b','#be123c','#94a3b8'];
let userSettings={},userSettingsUser='';
function watchUserSettings(){
  if(!currentUserId||userSettingsUser===currentUserId)return;userSettingsUser=currentUserId;userSettings={};
  try{onValue(ref(db,'settings/'+currentUserId),s=>{userSettings=s.val()||{};applyUserSettings();try{document.body.classList.add('quiet');renderAll();}catch(e){}if(document.getElementById('settings-body'))renderSettings();});}catch(e){}
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
function followedTeamOf(num,team){const e=(currentEntryList||{})[num]||{};const k=teamKey(team||e.team||'');return teams.find(t=>t.key===k)||null;}
function setUserSetting(path,val){if(!currentUserId)return;const u={};u['settings/'+currentUserId+'/'+path]=val;update(ref(db),u);}
function setTeamView(v){userSettings.teamView=v;setUserSetting('teamView',v);renderSettings();try{renderAll();}catch(e){}}
function setTeamColor(k,c){userSettings.teamColors=userSettings.teamColors||{};userSettings.teamColors[k]=c;setUserSetting('teamColors/'+k,c);renderSettings();try{renderAll();}catch(e){}}
function renderSettings(){
  const b=document.getElementById('settings-body');if(!b)return;
  const v=teamViewMode();
  const opt=(on,lbl,fn)=>'<div class="set-opt'+(on?' on':'')+'" onclick="'+fn+'"><input type="radio" '+(on?'checked':'')+' style="width:20px;height:20px"> '+lbl+'</div>';
  const sw=(on,lbl,fn)=>'<label class="set-opt" style="justify-content:space-between"><span>'+lbl+'</span><input type="checkbox" '+(on?'checked':'')+' onchange="'+fn+'" style="width:24px;height:24px"></label>';
  const light=document.body.classList.contains('light');const lv=userSettings.liveDefault||'mine';
  b.innerHTML='<div class="set-sec">PROFILO</div><div class="set-opt" onclick="closeModal();showUserPicker()"><i class="ic ic-user"></i> Cambia utente <span style="margin-left:auto;color:var(--text4)">'+currentUserId+'</span></div>'
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
}
function openSettings(){
  if(!currentUserId){alert('Scegli prima il tuo utente.');return;}
  watchNotifPrefs();watchUserSettings();
  openModal('<button class="modal-close" onclick="closeModal()">✕</button><div class="modal-title">Impostazioni</div><div id="settings-body"></div>');
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
function teamsHighlightHtml(slot,ps){
  const mine=new Set(ps.map(p=>String(p.num)));
  return teamsForSlot(slot).map(({t,inSlot,waiting})=>{
    const c=teamColor(t.key);
    return inSlot.filter(p=>!mine.has(String(p.num))).map(p=>'<div class="card-inner tglow" style="--tc:'+c+'"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">'
      +'<span class="inner-num">#'+p.num+'</span>'+gridBadge(p.num,slot)+'<span class="inner-name">'+String(p.name).replace(/</g,'&lt;')+'</span>'
      +'<span class="tchip" style="--tc:'+c+'">'+String(t.name).replace(/</g,'&lt;')+'</span></div>'
      +'<div class="tasks">'+TASKS.map(k=>teamTaskBtn(t.key,k,true)).join('')+'</div>'
      +(teamNotes[t.key]?'<div class="note-txt" style="margin-top:6px"><i class="ic ic-note"></i> '+teamNotes[t.key]+'</div>':'')+'</div>').join('')
      +(waiting.length?'<div style="font-size:10px;font-weight:800;margin:4px 0 8px;color:'+c+'"><i class="ic ic-wait"></i> '+String(t.name).replace(/</g,'&lt;')+': '+waiting.length+' in attesa</div>':'');
  }).join('');
}
setTimeout(watchNotifPrefs,3000);
// Avviso (solo titolare) se il server notifiche/monitor non aggiorna serverStatus/pc da più di 5 minuti
const SERVER_OWNER='andrea';let serverStat=null;
function renderServerBanner(){
  let b=document.getElementById('srv-banner');
  const stale=currentUserId===SERVER_OWNER&&serverStat!==null&&(!serverStat||!serverStat.at||Date.now()-serverStat.at>5*60000||serverStat.watcher===false);
  if(!stale){if(b)b.remove();return;}
  if(!b){b=document.createElement('div');b.id='srv-banner';b.style.cssText='position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:9999;background:#b3261e;color:#fff;border-radius:10px;padding:10px 12px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.4)';document.body.appendChild(b);}
  const min=serverStat&&serverStat.at?Math.round((Date.now()-serverStat.at)/60000):null;
  b.textContent='Server notifiche fermo'+(min!==null?' da '+min+' min':'')+(serverStat&&serverStat.watcher===false?' (live non attivo)':'')+': le notifiche push non partono.';
}
setTimeout(()=>{if(currentUserId!==SERVER_OWNER)return;try{onValue(ref(db,'serverStatus/pc'),s=>{serverStat=s.val()||false;renderServerBanner();});}catch(e){}setInterval(renderServerBanner,60000);},5000);
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
  el.innerHTML='<div style="flex:1">'+title+'<small>'+sub+' · '+hm+'</small></div><span style="cursor:pointer;font-size:16px">✕</span>';
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
    const rows=list.map(([num,e])=>{let h=e.heats||[];if(!Array.isArray(h))h=Object.values(h);const res=e.result||{};
      let pts=0,done=0;h.forEach(k=>{const v=rkPts(res[k]);if(v!==null){pts+=v;done++;}});
      const pfDone=!catHasPF(cat)||['PF-A','PF-B'].some(k=>rkPts(res[k])!==null);if(pfDone&&catHasPF(cat)){const k=rkPts(res['PF-A'])!==null?'PF-A':'PF-B';pts+=rkPts(res[k]);done++;}
      const left=Math.max(0,h.length-(done-(pfDone&&catHasPF(cat)?1:0)))+(pfDone?0:1);
      const heatsLeft=h.filter(k=>rkPts(res[k])===null);
      return{num,e,pts,done,left,heatsLeft,pfDone,avg:done?pts/done:list.length/2};}).filter(r=>r.done>0);
    if(!rows.length||!cut){if(list.some(([n])=>myNums.has(n)))out.push({cat,cut,none:true,n:list.length});return;}
    rows.sort((a,b)=>a.pts-b.pts);rows.forEach((r,i)=>r.rank=i+1);
    const field=Math.ceil(list.length/2)+2; // piloti per gara (manche a gruppi / prefinale)
    rows.filter(r=>myNums.has(r.num)).forEach(r=>{
      let need=null;
      if(r.left>0){for(let p=field;p>=1;p--){const mine=r.pts+rkPts(p)*r.left;let rank=1;rows.forEach(o=>{if(o!==r&&o.pts+o.avg*o.left<mine)rank++;});if(rank<=cut){need=p;break;}}}
      const status=r.left===0?(r.rank<=cut?'safe':'out'):(need===null?'out':need>=Math.ceil(field*0.8)?'safe':'risk');
      out.push({cat,cut,heatsLeft:r.heatsLeft,pfDone:r.pfDone,pf:String(r.e.prefinal||'').toUpperCase(),num:r.num,name:(pilots.find(p=>String(p.num)===r.num)||{}).name||((r.e.lastName||'')+' '+(r.e.firstName||'')).trim(),pts:r.pts,rank:r.rank,left:r.left,need,status,n:list.length});
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
function pfOf(p){const e=(currentEntryList||{})[p.num]||{};return String(p.prefinal||e.prefinal||'').trim().toUpperCase();}
function renderPfTab(){
  const esc=x=>String(x||'').replace(/</g,'&lt;');
  const cats=[...new Set(pilots.map(p=>p.cat).filter(Boolean))].sort();
  if(!cats.length)return'<div style="font-size:13px;color:var(--text4);padding:8px 0">Nessun tuo pilota.</div>';
  const h=['<div style="font-size:12px;color:var(--text3);background:var(--bg3);border-radius:10px;padding:9px 12px;margin-bottom:10px">Chi entra nelle <b>prefinali</b>: dalle liste ufficiali Prefinale A/B (dopo la Classifica Intermedia).</div>'];
  cats.forEach(cat=>{
    const ps=pilots.filter(p=>p.cat===cat);
    if(!catHasPF(cat)){h.push('<div class="set-sec">'+esc(cat)+' <span style="font-weight:700;color:var(--text4)">· nessuna prefinale nel programma</span></div>');return;}
    const rows=ps.map(p=>{const g=pfOf(p);const st=g?'in':(p.eliminated?'out':'wait');return{p,g,st};}).sort((a,b)=>({out:0,wait:1,in:2}[a.st]-{out:0,wait:1,in:2}[b.st])||(+a.p.num)-(+b.p.num));
    const nIn=rows.filter(r=>r.st==='in').length;
    h.push('<div class="set-sec">'+esc(cat)+' <span style="font-weight:700;color:var(--text4)">· '+(rows.some(r=>r.st!=='wait')?nIn+'/'+rows.length+' in prefinale':'liste non ancora pubblicate')+'</span></div>');
    rows.forEach(r=>{const col={in:'#22c55e',out:'#ef4444',wait:'#6b7280'}[r.st];
      const t=r.st==='in'?'In <b>prefinale '+esc(r.g)+'</b> (ufficiale)':r.st==='out'?'Non ammesso in prefinale (ufficiale)':'In attesa delle liste prefinali';
      h.push('<div class="card-inner al-row" style="border-left:4px solid '+col+'"><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900">#'+esc(r.p.num)+' '+esc(r.p.name)+'</div><div style="font-size:13px;color:var(--text2);margin-top:2px">'+t+'</div></div></div>');});
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
      return head+xr.sort((a,b)=>({out:0,risk:1,safe:2}[a.status]-{out:0,risk:1,safe:2}[b.status])||a.rank-b.rank).map(x=>{
        /* 14/11 15:35 (Andrea: testi poco chiari): si dice per COSA rischia (finale), quali gare mancano e la prossima con orario */
        const nx=riskNext(x);const many=x.left>1;
        const t=x.status==='out'?(x.left?'Fuori dalla finale anche vincendo (stima)':'Fuori dalla finale (stima)')
          :x.status==='safe'?(x.left?(x.need>=Math.ceil(x.n/2)+2?'In finale anche arrivando ultimo (stima)':'In finale se arriva almeno P'+x.need+(many?' di media':'')+' (stima)'):'In finale (stima)')
          :'Rischia la <b>FINALE</b>: deve arrivare almeno <b>P'+x.need+'</b> '+(many?'di media nelle '+x.left+' gare che mancano':nx.art);
        const _pp=pilots.find(p=>String(p.num)===String(x.num));const _pg=_pp?pfOf(_pp):'';
        const sub=(_pg?'<span style="color:#22c55e;font-weight:800">In prefinale '+_pg+' (ufficiale)</span> · ':'')+(x.left?'Manca: '+riskLeftTxt(x)+(nx.when?' · prossima '+nx.label+' '+nx.when:''):'Gare finite')+' · '+x.pts+' punti';
        return'<div class="card-inner al-row" style="border-left:4px solid '+col[x.status]+'"><div class="al-time" style="font-size:18px;font-weight:900">'+x.rank+'°</div><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900">#'+esc(x.num)+' '+esc(x.name)+'</div><div style="font-size:13px;color:var(--text2);margin-top:2px">'+t+'</div><div style="font-size:11px;color:var(--text4);margin-top:2px">'+sub+'</div></div></div>';}).join('');
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
function ltXSpan(r){return'<span class="lt-x'+(r&&r.t==='so'?' so':'')+'">✕</span>';}
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
  if(!el.querySelector('.ltf-list')){el.innerHTML='<div class="ltf-top"><div class="ltf-sess"></div><div class="ltf-lap"></div><button class="ltf-close" onclick="closeLtFull()" aria-label="Chiudi">✕</button></div><div class="ltf-list"></div>';}
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
  if(ltOnlyMine===v&&!ltLastOn)return;ltLastOn=false;
  ltOnlyMine=v;localStorage.setItem('rt_ltmine',v?'1':'0');
  const box=document.getElementById('lt-mytable');const dir=v?'l':'r';
  if(box){box.classList.remove('swap-r','swap-l');void box.offsetWidth;box.classList.add('swap-'+dir);clearTimeout(window._ltSwT);window._ltSwT=setTimeout(()=>box.classList.remove('swap-r','swap-l'),350);}
  window._ltSwAnim=dir;renderLtMyTable();window._ltSwAnim='';
}
window.toggleLtMine=toggleLtMine;
// ── ULTIMA GARA: quando nel live entra la sessione nuova, l'arrivo della precedente (solo miei) resta qui ──
let ltLastOn=false,ltLast=null;
try{ltLast=JSON.parse(localStorage.getItem('rt_ltlast')||'null');}catch(e){ltLast=null;}
function setLtLast(v){ltLastOn=!!v;renderLtMyTable();}
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
      return'<div class="ltbig" data-no="'+esc(x.no)+'" onclick="openPilotDetail(\''+esc(x.no)+'\')">'
        +'<div class="pos">'+(x.ret?ltXSpan(x.ret):(x.pos<999?x.pos:'–'))+'</div>'
        +'<div style="flex:1;min-width:0"><div><span class="num">#'+esc(x.no)+'</span> <span class="nm">'+esc(pl.name||x.dr)+'</span>'+ltRetBadge(x.ret)+'</div>'
        +'<div class="tm">'+esc(pl.team||ent.team||'')+(x.gap?' · '+esc(x.gap):'')+(x.blp?' · best '+esc(x.blp):'')+'</div>'
        +(nt?'<div class="note-txt" style="margin-top:2px"><i class="ic ic-note"></i> '+esc(nt)+'</div>':'')
        +'<div class="tasks lt-tasks" onclick="event.stopPropagation()">'+TASKS.map(t=>taskBtn(x.no,t,true)).join('')+'</div></div></div>';
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
    if(lm){const cur=+lm[1],tt=+lm[2];if(!tot)tot=tt;if(led===null)led=apexFinished?Math.max(cur,tt):cur-1;}}catch(e){}
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
  el.style.outline=fin?'2px solid #fff':'none';
  el.innerHTML='<span style="display:flex;align-items:center;gap:10px;min-width:0">'+lh+'<span style="font-size:10px;line-height:1.25;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word">'+sess.replace(/</g,'&lt;')+'</span></span><span style="display:flex;align-items:center;gap:12px;white-space:nowrap">'
    +(lap?'<span style="font-size:'+(fin?'24':'22')+'px;color:'+(fin?'#fff':'var(--rt-orange)')+';font-weight:900">'+(fin?'<i class="ic ic-flag"></i> ':'')+lap+'</span>':'')
    +(t.length&&!fin?'<span style="font-size:16px;color:var(--text2)"><i class="ic ic-timer" style="color:var(--rt-orange)"></i> '+t.join(' · ').replace(/</g,'&lt;')+'</span>':'')+'</span>';
}
/* 14/11/2026: riga PROSSIMA dal "Next" di Apex + controllo sul programma (se l'ordine e' diverso lo segnala) */
function apexNextInfo(){
  if(!apexNext||!apexWsKey)return null;
  const out={cat:apexNext.cat,sess:apexNext.sess,warn:'',mine:[]};
  try{
    const day=typeof autoDayName==='function'?autoDayName():'';let arr=(day&&currentSchedule[day])||[];arr=Array.isArray(arr)?arr:Object.values(arr);
    if(!arr.length)return out;
    const same=(a,b)=>a&&b&&a.time===b.time&&canonCat(a.cat)===canonCat(b.cat)&&a.type===b.type;
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
  if(ltView!=='mia'){box.style.display='none';if(wrap)wrap.style.display='';return;}
  box.style.display='';if(wrap)wrap.style.display='none';
  if(activeTab!=='livetiming')return;
  const rows=[...apexGrid.querySelectorAll('tr[data-id]')].filter(r=>r.getAttribute('data-id')!=='r0');
  if(!rows.length){box.innerHTML='<div class="empty-state"><p>'+(apexWsKey?'In attesa dei dati live di Apex…':'Live timing Apex non disponibile per questa gara')+'</p></div>';return;}
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
  const sw='<div class="pv-switch pv3'+(window._ltSwAnim?' anim-'+window._ltSwAnim:'')+'" style="margin-bottom:8px">'
    +'<button class="pv-btn'+(ltOnlyMine&&!ltLastOn?' active':'')+'" onclick="toggleLtMine(true)">SOLO MIEI</button>'
    +'<button class="pv-btn'+(!ltOnlyMine&&!ltLastOn?' active':'')+'" onclick="toggleLtMine(false)">TUTTI</button>'
    +'<button class="pv-btn'+(ltLastOn?' active':'')+'" onclick="setLtLast(true)">ULTIMA GARA</button></div>';
  if(ltLastOn){box.innerHTML=sw+renderLtLast();ltFlip();return;}
  const title='<div style="font-size:11px;font-weight:800;color:var(--text3);margin-bottom:6px">'+(apexState.cat||'')+' · '+(apexState.sess||'')
    +' <span style="color:var(--text)">· '+mineCount+' tuoi in pista</span> <span style="color:var(--text4)">· '+sorted.length+' totali</span></div>';
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
      return'<div class="ltbig'+(tm?' team':'')+(rt?' ret':'')+(mv>0?' up':mv<0?' down':'')+'" data-no="'+no+'"'+(tm?'':' onclick="openPilotDetail(\''+no+'\')"')+'>'
        +'<div class="pos">'+(rt?ltXSpan(rt):(txt(r,C('rk','3'))||'–'))+(mv?'<span class="mv">'+(mv>0?'▲':'▼')+Math.abs(mv)+'</span>':'')+'</div>'
        +'<div style="flex:1;min-width:0"><div><span class="num">#'+no+'</span> <span class="nm">'+nm+'</span>'+ltRetBadge(rt)+'</div>'
        +'<div class="tm">'+team+'</div>'

        +(nt?'<div class="note-txt" style="margin-top:2px"><i class="ic ic-note"></i> '+nt.replace(/</g,'&lt;')+'</div>':'')
        +(tm?'':'<div class="tasks lt-tasks" onclick="event.stopPropagation()">'+TASKS.map(t=>taskBtn(no,t,true)).join('')+'</div>')+'</div></div>';
    }).join(''):'<div class="empty-state"><p>Nessun tuo pilota in questa sessione</p></div>');
    ltFlip();return;
  }
  box.innerHTML=sw+title
    +'<table class="ltc"><tr><th>P</th><th>N°</th><th>PILOTA</th><th>TEAM</th></tr>'
    +sorted.map(({r})=>{
      const no=txt(r,C('no','4'));const mine=myNums.has(no);const tm=!mine&&teamNums.has(no);
      const llc=cls(r,C('llp','10'));
      return'<tr data-no="'+no+'" class="'+(mine?'mine':tm?'team':'')+'"'+(mine?' onclick="openPilotDetail(\''+no+'\')"':'')+'>'
        +'<td>'+(ltRetOf(no)?ltXSpan(ltRetOf(no)):txt(r,C('rk','3')))+'</td><td class="n">'+no+'</td><td class="d">'+txt(r,C('dr','5'))+ltRetBadge(ltRetOf(no))+'</td><td class="d" style="color:var(--text3)">'+(((pilots.find(x=>String(x.num)===no)||{}).team)||((currentEntryList&&currentEntryList[no])||{}).team||'')+'</td></tr>'
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
        apexEvalT=setTimeout(()=>apexEvaluate('finish'),75000);
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
  if(changed){apexState.at=Date.now();renderApexDelay();}
}
// Traduce categoria e sessione Apex nello slot del programma di oggi
function apexCat(t){
  const s=String(t||'').toUpperCase().replace(/\s+/g,' ').trim();
  if(/U10/.test(s))return'MINI U10';
  if(/MINI/.test(s))return'MINI GR3';
  if(/OK-?N\s*J|OKN\s*J|JUNIOR/.test(s)&&/OK/.test(s))return'OK-NJ';
  if(/^OK-?N\b|^OKN$/.test(s))return'OKN';
  if(/KZ2/.test(s))return'KZ2';
  if(/^OKJ|OK JUNIOR/.test(s))return'OKJ';
  if(/^OK\b/.test(s))return'OK';
  return normCat(s);
}
function apexMatchSlot(){return apexMatchFor(apexState.cat,apexState.sess,apexState.start);}
function apexMatchFor(catTxt,sessTxt,startTxt){
  const cat=apexCat(catTxt);const ss=String(sessTxt||'').toUpperCase();
  if(!cat||!ss)return null;
  const today=typeof autoDayName==='function'?autoDayName():activeDay;
  let arr=currentSchedule[today]||[];arr=Array.isArray(arr)?arr:Object.values(arr);
  const want=x=>{
    if(canonCat(x.cat)!==canonCat(cat))return false;
    const f=Array.isArray(x.filter)?x.filter.join('-'):String(x.filter||'');
    let m;
    if(/QUALIF/.test(ss)&&(m=ss.match(/S\s*(\d)/)))return x.type==='serie'&&f===m[1];
    if(/(FREE|PRACT|WARM)/.test(ss)&&/EVEN|PARI/.test(ss))return x.type==='parity'&&f==='EVEN'&&(/WARM/.test(ss)===/WARM/i.test((x.session||'')+(x.label||''))||true);
    if(/(FREE|PRACT|WARM)/.test(ss)&&/ODD|DISPARI/.test(ss))return x.type==='parity'&&f==='ODD';
    if(/HEAT|MANCHE/.test(ss)&&(m=ss.match(/\b([A-D])\s*-\s*([A-D])\b/)))return x.type==='group'&&f.toUpperCase().replace(/\s/g,'')===(m[1]+'-'+m[2]);
    if(/PREFINAL/.test(ss)&&(m=ss.match(/PREFINAL[E]?\s+([AB])\b/)))return x.type==='prefinal'&&f.toUpperCase()===m[1];
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
  const box=document.getElementById('apex-delay-box');if(!box)return;
  if(!apexWsKey||!apexState.sess){box.style.display='none';return;}
  const m=apexMatchSlot();
  box.style.display='';
  const head='<div style="font-size:11px;font-weight:800;color:var(--text3);padding:8px 10px;border:1px solid var(--border2);border-radius:10px;background:var(--bg2)">'
    +'<i class="ic ic-signal"></i> APEX: '+apexState.cat+' · '+apexState.sess+(apexState.start?' · partita '+apexState.start:'')
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
    +(same?'<span style="color:#4ade80">✓ applicato</span>':(isDelayAdmin()?'<button onclick="setDelay('+d+')" style="padding:5px 10px;border-radius:7px;border:none;background:#22c55e;color:#000;font-weight:900;font-size:11px;cursor:pointer;font-family:inherit">APPLICA '+lbl+'</button>':''))
    +(isDelayAdmin()
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
/* APP_BUILD sta nella pagina HTML (kart_test50.html), cosi' il controllo versione legge la pagina */
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
  if(slot.type==='serie'){if(!p.serie)return false;return String(p.serie).trim()===String(slot.filter).trim();}
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
    +'<span>'+s+'</span><span class="del" onclick="deleteSection('+i+')">✕</span></div>').join('');
  const el=document.getElementById('pista-content');
  if(!pilots.length){el.innerHTML='<div class="empty-state"><p>Nessun pilota</p></div>';return;}
  if(pistaView==='pilota'){
    el.innerHTML=pilots.map(p=>'<div class="card">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
      +'<span class="pilot-num">#'+p.num+'</span><span class="pilot-name">'+p.name+'</span>'
      +'<span class="pilot-cat '+catClass(p.cat)+'" style="margin-left:auto">'+p.cat+'</span></div>'
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
function openModal(html){document.getElementById('modal-inner').innerHTML=html;document.getElementById('modal').style.display='flex';}
function closeModal(){document.getElementById('modal').style.display='none';}
function closeModalOutside(e){if(e.target===document.getElementById('modal'))closeModal();}
window.closeModal=closeModal;window.closeModalOutside=closeModalOutside;

let _entryPreview=null;
function openAddPilot(){
  if(!activeRaceId){alert('Seleziona prima una gara dalla tab GARE');return;}
  openModal('<button class="modal-close" onclick="closeModal()">✕</button>'
    +'<div class="modal-title">Aggiungi Pilota</div>'
    +'<div class="form-group"><label class="form-label">Numero Kart</label>'
    +'<input class="form-input" id="f-num" placeholder="es. 342" type="number" oninput="previewFromNum(this.value)" autocomplete="off" style="font-size:22px;font-weight:900"></div>'
    +'<div id="f-preview" style="display:none;background:var(--bg3);border:2px solid #22c55e;border-radius:10px;padding:12px;margin-bottom:12px">'
    +'<div style="font-size:10px;color:#22c55e;letter-spacing:2px;font-weight:700;margin-bottom:8px">✓ TROVATO IN ENTRY LIST</div>'
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
  pilots.push({num,name:(_entryPreview.lastName||'')+' '+(_entryPreview.firstName||''),team:_entryPreview.team||'',cat:_entryPreview.cat||'OK',parity:_entryPreview.parity||autoParity(num),group,prefinal,serie,eliminated:false});
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
  pilots.push({num,name,team,cat,parity:autoParity(num),group:'',prefinal:'',serie:'',heats:[],eliminated:false});
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
  openModal('<button class="modal-close" onclick="closeModal()">✕</button>'
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
    +'<div style="font-size:10px;color:var(--text4);margin-bottom:8px">Puoi selezionare più opzioni</div>'
    +'<div class="hl-picker" id="ef-hl-picker">'
    +'<button class="hl-option'+(hl.indexOf("foto")>=0?' active':'')+'" data-hl="foto" onclick="toggleHL(this)"><i class="ic ic-camera"></i> FOTO</button>'
    +'<button class="hl-option'+(hl.indexOf("video")>=0?' active':'')+'" data-hl="video" onclick="toggleHL(this)"><i class="ic ic-video"></i> VIDEO</button>'
    +'<button class="hl-option'+(hl.indexOf("priority")>=0?' active':'')+'" data-hl="priority" onclick="toggleHL(this)"><i class="ic ic-star"></i> PRIORITÀ</button>'
    +'</div></div>'
    +'<button class="form-submit" onclick="updatePilot(\''+num+'\')">SALVA</button>'
    +'<button class="form-delete" onclick="deletePilot(\''+num+'\')">Elimina pilota</button>');
}
window.openEditPilot=openEditPilot;

function toggleHL(btn){btn.classList.toggle('active');}
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
onValue(ref(db,'tracker'),snap=>{
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

