/* Service worker Race Tracker.
   13/11/2026 — modalità senza rete: RETE PRIMA, copia salvata solo se la rete manca.
   Con la rete si riceve sempre l'ultima versione (niente versioni vecchie); la copia serve solo offline. */
var CACHE='rt-offline-v2';
var SHELL=['kart_test50.html','manifest.webmanifest','favicon.ico','icons/rt2-180.png','icons/rt2-192.png','icons/rt2-512.png',
  'vendor/firebase-app-compat.js','vendor/firebase-database-compat.js'];
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){return Promise.all(SHELL.map(function(u){return c.add(new Request(u,{cache:'reload'})).catch(function(){});}));}));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(n){return n.indexOf('rt-offline-')===0&&n!==CACHE;}).map(function(n){return caches.delete(n);}));}).then(function(){return self.clients.claim();}));
});
function cacheable(req){
  if(req.method!=='GET')return false;
  var u=new URL(req.url);
  if(u.origin===self.location.origin)return u.search==='';            // pagine/icone senza parametri (il controllo versione ?build= resta solo in rete)
  return u.hostname==='www.gstatic.com'&&u.pathname.indexOf('/firebasejs/')===0;
}
self.addEventListener('fetch', function(e){
  var req=e.request;
  /* 14/11/2026 (app vera e prova): rete prima ma con limite 1,2 s. Se la rete e' lenta (hotspot in pista)
     si apre subito la copia salvata e la rete continua ad aggiornarla in background; il controllo versione
     dell'app (APP_BUILD ogni minuto) ricarica da solo se nel frattempo e' uscita una versione nuova. */
  if(req.mode==='navigate'&&new URL(req.url).origin===self.location.origin){
    var net=fetch(req).then(function(r){if(r.ok&&new URL(req.url).search===''){var c=r.clone();caches.open(CACHE).then(function(ca){ca.put(req,c);});}return r;});
    e.waitUntil(net.catch(function(){}));
    e.respondWith(caches.match(req,{ignoreSearch:true}).then(function(m){
      if(!m)return net;
      return Promise.race([net.catch(function(){return m;}),new Promise(function(res){setTimeout(function(){res(m);},1200);})]);
    }));
    return;
  }
  if(req.mode==='navigate'&&new URL(req.url).origin===self.location.origin){
    e.respondWith(fetch(req).then(function(r){if(r.ok&&new URL(req.url).search===''){var c=r.clone();caches.open(CACHE).then(function(ca){ca.put(req,c);});}return r;})
      .catch(function(){return caches.match(req,{ignoreSearch:true}).then(function(m){return m||caches.match('kart_test50.html');});}));
    return;
  }
  if(!cacheable(req))return;   // tutto il resto (Firebase, Apex, ecc.) va in rete normalmente
  e.respondWith(fetch(req).then(function(r){if(r&&(r.ok||r.type==='opaque')){var c=r.clone();caches.open(CACHE).then(function(ca){ca.put(req,c);});}return r;})
    .catch(function(){return caches.match(req).then(function(m){return m||Response.error();});}));
});

/* Notifiche push (13/11/2026): mostra gli avvisi inviati dal server notifiche del Race Tracker.
   Il tag uguale a quello degli avvisi in app evita doppioni. */
self.addEventListener('push', function(e){
  var d={};try{d=e.data?e.data.json():{};}catch(err){d={title:'Race Tracker',body:e.data?e.data.text():''};}
  e.waitUntil(self.registration.showNotification(d.title||'Race Tracker',{body:d.body||'',tag:d.tag||undefined,renotify:true,vibrate:[300,150,300],data:{url:'kart_test50.html'}}));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url=(e.notification.data&&e.notification.data.url)||'kart_test50.html';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++){if(list[i].url.indexOf('kart_test50')>=0&&'focus' in list[i])return list[i].focus();}
    return self.clients.openWindow(url);
  }));
});
