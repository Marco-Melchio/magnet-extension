import os
import re
import json
import subprocess
from datetime import datetime
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

MOVIES_DIR = os.environ.get("MOVIES_DIR", "/EmblyFiles/Movies")
SERIES_DIR = os.environ.get("SERIES_DIR", "/EmblyFiles/Series")
QUEUE_FILE = os.environ.get("QUEUE_FILE", "/data/queue.jsonl")
ARIA2C_BIN = os.environ.get("ARIA2C_BIN", "aria2c")

def cors(resp):
    # Für dein LAN/Extension-Test: offen. Später besser mit Token + Origin einschränken.
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Auth-Token"
    return resp


@app.after_request
def add_cors_headers(resp):
    """Sorge dafür, dass jede Antwort die CORS-Header enthält (auch Fehlerfälle)."""
    return cors(resp)

def sanitize_name(s: str) -> str:
    if not s:
        return ""
    s = s.strip()

    # Windows/SMB + Synology safe: verbotene Zeichen raus
    s = re.sub(r'[\\/:*?"<>|]+', " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    # Sehr lange Namen begrenzen (optional)
    return s[:120].strip()

def target_base_dir(media_type: str) -> str:
    # media_type: "movie" oder "series"
    if (media_type or "").lower() == "series":
        return SERIES_DIR
    return MOVIES_DIR

def ensure_folder(title: str, year: str, media_type: str) -> str:
    safe_title = sanitize_name(title)
    safe_year = re.sub(r"\D", "", year or "")[:4]

    if not safe_title:
        raise ValueError("Empty folder name after sanitization")

    folder = safe_title
    if safe_year:
        folder = f"{safe_title} ({safe_year})"

    base = target_base_dir(media_type)
    full = os.path.join(base, folder)

    os.makedirs(full, exist_ok=True)
    return full

def append_queue(item: dict):
    os.makedirs(os.path.dirname(QUEUE_FILE), exist_ok=True)
    with open(QUEUE_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")

def start_download(magnet: str, dest: str):
    os.makedirs(dest, exist_ok=True)
    cmd = [
        ARIA2C_BIN,
        "--seed-time=0",
        "--enable-dht=true",
        "--continue=true",
        "--max-connection-per-server=4",
        "--dir",
        dest,
        magnet,
    ]
    # Asynchronous start; aria2c handles the transfer and exits when done
    try:
        subprocess.Popen(cmd)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Downloader binary not found: {ARIA2C_BIN}") from exc
    except OSError as exc:
        raise RuntimeError(f"Failed to start download: {exc}") from exc

@app.route("/intake", methods=["OPTIONS"])
def intake_options():
    return cors(make_response("", 204))

@app.route("/intake", methods=["POST"])
def intake():
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    year = (data.get("year") or "").strip()
    media_type = (data.get("type") or "movie").strip().lower()  # "movie" oder "series"
    magnet = (data.get("magnet") or "").strip()
    page_url = (data.get("pageUrl") or "").strip()

    if not title:
        return cors(make_response(jsonify({"ok": False, "error": "Missing title"}), 400))

    if not magnet:
        return cors(make_response(jsonify({"ok": False, "error": "Missing magnet link"}), 400))

    # Ordner erstellen
    try:
        folder_path = ensure_folder(title, year, media_type)
    except ValueError as exc:
        return cors(make_response(jsonify({"ok": False, "error": str(exc)}), 400))

    # In Queue protokollieren
    item = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "title": title,
        "year": year,
        "type": media_type,
        "folder": folder_path,
        "magnet": magnet,
        "pageUrl": page_url
    }
    append_queue(item)

    # Download starten
    try:
        start_download(magnet, folder_path)
    except RuntimeError as exc:
        return cors(make_response(jsonify({"ok": False, "error": str(exc)}), 500))

    return cors(make_response(jsonify({
        "ok": True,
        "createdFolder": folder_path,
        "message": "Download gestartet"
    }), 200))

@app.route("/health", methods=["GET"])
def health():
    return cors(make_response(jsonify({"ok": True}), 200))

if __name__ == "__main__":
    # 0.0.0.0, damit Synology Port-Mapping funktioniert
    app.run(host="0.0.0.0", port=8787)