# NAS Magnet Helper (Firefox)

Eine kleine Firefox-Erweiterung, die auf der aktuell geöffneten Seite einen Magnet-Link und ein potentielles Erscheinungsjahr ausliest. Im Popup kann ein eigener Titel ergänzt werden. Alle drei Werte werden anschließend an eine konfigurierbare NAS-API gesendet, die den Download z.B. nach `/EmblyFiles/Movies/<Titel> (<Jahr>)` anlegen kann.

## Verwendung
1. Erweiterung im Entwicklermodus in Firefox laden (about:debugging ➜ "This Firefox" ➜ "Temporary Add-on" ➜ `manifest.json` auswählen).
2. Eine Seite mit Magnet-Link öffnen. Das Popup liest Magnet-Link, Jahr und einen Titelvorschlag aus.
3. NAS-API-URL im Popup eintragen (z.B. `http://nas.local:5000/api/magnet`). Die URL wird in `storage.sync` gespeichert.
4. Titel anpassen und auf **"An NAS senden"** klicken. Das Hintergrundskript sendet ein JSON:
   ```json
   {
     "magnetLink": "magnet:?xt=...",
     "title": "Mein Film",
     "year": "2024",
     "targetFolder": "/EmblyFiles/Movies/Mein Film (2024)"
   }
   ```

## Dateien
- `manifest.json` – Manifest v2 für Firefox.
- `content-script.js` – Extrahiert Magnet-Link, Jahr und einen Titelvorschlag von der Seite.
- `popup.html` / `popup.css` / `popup.js` – UI zum Anzeigen der gefundenen Daten und Trigger für den NAS-Request.
- `background.js` – Kümmert sich um das Speichern der NAS-URL und sendet die JSON-Anfrage.

> Hinweis: Falls eigene Icons verwendet werden sollen, können sie bei Bedarf in der `manifest.json` referenziert werden.
