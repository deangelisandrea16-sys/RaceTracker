# Registro modifiche (app) — da riportare nel registro comune "APPKARTPH24 GARE" stato/registro-modifiche.md

| data e ora | chi | dove | cosa e perche' | commit | come tornare indietro |
|---|---|---|---|---|---|
| 27/11/2026 16:30 | Claude Code (seconda revisione) | app, ramo `revisione-2`, solo copia `revisione/` + `kart_revisione.html` (vera e prova NON toccate, niente pubblicato) | caricamento entry list da file: campi a oggetto (result, out) uniti voce per voce, null ignorati (prima cancellava gli altri arrivi del pilota); prova `tools/test_upload_entry.js` | 768daf5 | non unire `revisione-2`, oppure `git revert 768daf5` |
| 27/11/2026 16:30 | Claude Code (seconda revisione) | app, ramo `revisione-2`, copia `revisione/` | ascolto dati condivisi: un dato cambiato due volte durante il primo caricamento non torna al valore vecchio | 6a9f6f5 | `git revert 6a9f6f5` |
| 27/11/2026 16:30 | Claude Code (seconda revisione) | app, ramo `revisione-2` | build revisione 2026-11-27-1700 (pagina e file allineati) | c9b2405 | `git revert c9b2405` |
