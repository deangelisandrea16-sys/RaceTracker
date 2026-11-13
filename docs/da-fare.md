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

## Monitor automatico (server sul PC, poi online)
Deciso il 13/11/2026. Da installare nel server del PC (`%USERPROFILE%\RaceTrackerPush`), poi spostare online
(eventuale aiuto IA via API key, sempre come Secret del server, mai nel repo).
- [ ] 3 volte a settimana: controlla le gare in arrivo (`calendar.json` + Apex) e inserisce entry list e programma appena pubblicati.
- [ ] In gara: live timing, classifiche, assegnazioni (gruppi/prefinali/finali), eliminazioni.
- [ ] Comunicati e correzioni ufficiali (reclami, penalità, classifiche corrette) → aggiorna griglia/arrivo e avvisa.
- [ ] Ritardo automatico dal confronto partenze reali / programma, valido per tutti.
- [ ] Controllo di salute: avviso se il monitor è fermo o Apex non risponde.
- [ ] Riepilogo serale: passati, eliminati, orari di domani dei propri piloti.
- [ ] Avviso se un mio pilota sparisce dalla entry list o compare un nuovo pilota di un mio team.
- [ ] Storico risultati per pilota nella scheda.
Regole: solo dati ufficiali, mai dedurre; backup prima di ogni scrittura su Firebase; avvisi separati per utente.
