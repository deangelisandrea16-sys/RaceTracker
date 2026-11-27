# Registro modifiche (app) — da riportare nel registro comune "APPKARTPH24 GARE" stato/registro-modifiche.md

| data e ora | chi | dove | cosa e perche' | commit | come tornare indietro |
|---|---|---|---|---|---|
| 27/11/2026 16:30 | Claude Code (seconda revisione) | app, ramo `revisione-2`, solo copia `revisione/` + `kart_revisione.html` (vera e prova NON toccate, niente pubblicato) | caricamento entry list da file: campi a oggetto (result, out) uniti voce per voce, null ignorati (prima cancellava gli altri arrivi del pilota); prova `tools/test_upload_entry.js` | 768daf5 | non unire `revisione-2`, oppure `git revert 768daf5` |
| 27/11/2026 16:30 | Claude Code (seconda revisione) | app, ramo `revisione-2`, copia `revisione/` | ascolto dati condivisi: un dato cambiato due volte durante il primo caricamento non torna al valore vecchio | 6a9f6f5 | `git revert 6a9f6f5` |
| 27/11/2026 16:30 | Claude Code (seconda revisione) | app, ramo `revisione-2` | build revisione 2026-11-27-1700 (pagina e file allineati) | c9b2405 | `git revert c9b2405` |
| 27/11/2026 17:05 | Claude Code (seconda revisione, giro 2) | app, ramo `revisione-2`, copia `revisione/` | testi protetti (nomi, team, numeri, categorie, etichette, live, calendario); avvisi mostrati come testo con le sole icone | 841a658 | `git revert 841a658` |
| 27/11/2026 17:05 | Claude Code (seconda revisione, giro 2) | app, ramo NUOVO `revisione-prova` (da main), file nuovi `revisione-prova/` + `kart_revisione_prova.html` | prova attuale + correzioni revisione-2 unite; prova e vera NON toccate, niente pubblicato | 333cd75 | non unire il ramo; i file sono nuovi (nessun file esistente cambiato) |
| 27/11/2026 17:05 | Claude Code (seconda revisione, giro 2) | app, ramo `revisione` | unione di `revisione-2` in `revisione` (ramo di lavoro) | merge | `git revert -m 1 <merge>` su revisione |
