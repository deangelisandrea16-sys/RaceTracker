# Race Tracker — da fare

## Prima della vendita
- [ ] **Spostare il server delle notifiche push su un server sempre acceso.**
  Oggi (dal 13/11/2026) gira sul PC di Andrea, cartella `%USERPROFILE%\RaceTrackerPush`
  (`watcher.js` + `run.ps1`, chiavi VAPID in `keys.json`, mai nel repo).
  Funziona solo finché il PC è acceso e online. Opzione valutata: Fly.io (~2-3 €/mese).
  Al trasloco: nuove chiavi VAPID come Secrets del server, aggiornare `PUSH_PUBLIC_KEY` in `kart_test50.html`
  (i telefoni si reiscrivono da soli).
- [ ] Login vero (Firebase Auth + regole del database): oggi utente scelto per nome e database aperto,
  quindi il controllo "solo Andrea" su ritardo/AUTO è solo nell'interfaccia.
