# CiCa-Buddy

CVVHDF mit regionaler Citratantikoagulation (Prismaflex/Prismax, Prismocitrate 18/0 oder Regiocit + Phoxilium) – klinische Probleme lösen nach der Marburger Therapieempfehlung.

App: https://ftigiser-collab.github.io/CiCa/

## Was drin ist
- **BGA-Auswertung:** Werte eintragen, die App schlägt den nächsten Schritt vor (Ca²⁺-Ausgleich, Citratdosis, Dialysat, Blutfluss) – Akkumulationsverdacht sperrt alles, was mehr Citrat zum Patienten bringt.
- **13 Problemseiten:** Alkalose, Azidose, Postfilter-Ca²⁺, Patienten-Ca²⁺, Citratakkumulation, Clotting, Dosis/Clearance, Natrium, Kalium, Magnesium, Phosphat, Leberversagen/Laktat, Pause/Stopp – jeweils mit konkretem Von-auf-Wert, Begründung und worauf zu achten ist.
- **Einstellungen:** Ist-Werte am Gerät, abgeleitete Größen (PBP, Ablauf-/UF-Dosis, Filtrationsfraktion), Startwerte und gewichtsadaptierte Tabelle nach Marburg.
- **Wissen:** Kreislaufschema, Formeln, Lösungszusammensetzung. Abkürzungen und Quellen.

Offline-fähig, installierbar (Android/Chrome, iOS/Safari). Werte bleiben nur lokal im Browser.

## Aufbau
- `index.html` – die gesamte App (CSS, JS, Schrift eingebettet)
- `manifest.webmanifest`, `sw.js`, `icons/` – PWA
- `src/` – Quellen (`app.js`, `style.css`, `shell.html`, Schriften)
- `tools/build.py` – baut `index.html`, Manifest und `sw.js` aus `src/`; `tools/icons.py` rendert die Icons

## Update
`src/` ändern, `python3 tools/build.py` ausführen, bei jeder Veröffentlichung `SW_VERSION` in `tools/build.py` hochzählen.

Arbeitshilfe – ersetzt nicht die ärztliche Beurteilung, Hausstandards und Herstellerangaben.
