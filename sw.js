/* Service worker "passante" (12/11/2026): serve solo a rendere l'app installabile.
   NON mette nulla in cache: ogni richiesta va in rete come senza service worker,
   quindi niente versioni vecchie. Per rimuoverlo basta cancellare questo file e la registrazione. */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(){ /* nessun respondWith: il browser gestisce la richiesta normalmente */ });

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
