# MagnetCatcher (Firefox)

MagnetCatcher grabs magnet links and metadata from the active tab, enriches them with a clean title, and fires everything to your NAS or download API with one click. The extension remembers your API URL and optional token so you can keep sending downloads without copy-paste.

## Highlights
- 🔍 Auto-detects magnet links, release year, and a sensible title.
- 🚀 Fires a single-button JSON request to your NAS or download API.
- 🔑 Ships an optional bearer token (stored in `storage.sync`) for authenticated endpoints.
- 🧠 Cleans up years and auto-builds a destination folder (`<Title>` or `<Title> (<Year>)`).

## Quick install (Firefox temporary add-on)
1. Open `about:debugging`.
2. Choose **This Firefox** ➜ **Load Temporary Add-on**.
3. Pick `Firefox-Extension/manifest.json` from this repo.

## Usage
1. Open a page with a magnet link (e.g., a torrent indexer).
2. Open the popup – magnet link, year, and title are pre-filled.
3. Enter your NAS URL and optional token (saved for next time).
4. Adjust the title if needed and click **Send to NAS**.
5. The background script reports status back in the popup.

## API payload
The extension sends a `POST` to your configured NAS URL with this body:
```json
{
  "magnet": "magnet:?xt=...",
  "title": "My Movie",
  "year": 2024,
  "folder": "My Movie (2024)"
}
```
If a token is saved, it is included as `Authorization: Bearer <token>`.

## Files
- `Firefox-Extension/manifest.json` – Manifest v2 configuring the popup, background script, and content script.
- `Firefox-Extension/content-script.js` – Extracts magnet link, year, and title from the page.
- `Firefox-Extension/popup.*` – Popup UI (HTML, CSS, JS) with status and toast messages.
- `Firefox-Extension/background.js` – Stores NAS URL/token and sends the JSON request.
- `Firefox-Extension/icons/` – App icons.

> Tip: If you want custom icons, update their paths in `manifest.json`.
