/* Service worker "passante" (12/11/2026): serve solo a rendere l'app installabile.
   NON mette nulla in cache: ogni richiesta va in rete come senza service worker,
   quindi niente versioni vecchie. Per rimuoverlo basta cancellare questo file e la registrazione. */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(){ /* nessun respondWith: il browser gestisce la richiesta normalmente */ });
