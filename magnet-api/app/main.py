from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
import os
import re
import requests

app = FastAPI(title="Magnet API", version="2.0")

API_TOKEN = os.getenv("API_TOKEN", "")
DOWNLOADS_ROOT = os.getenv("DOWNLOADS_ROOT", "/downloads")
MOVIES_ROOT = os.getenv("MOVIES_ROOT")
ANIME_MOVIES_ROOT = os.getenv("ANIME_MOVIES_ROOT")
SERIES_ROOT = os.getenv("SERIES_ROOT")

CATEGORY_ROOTS = {
    "Movies": MOVIES_ROOT,
    "AnimeMovies": ANIME_MOVIES_ROOT,
    "Series": SERIES_ROOT,
}

QB_URL = os.getenv("QB_URL", "http://qbittorrent:8080").rstrip("/")
QB_USER = os.getenv("QB_USER", "")
QB_PASS = os.getenv("QB_PASS", "")

MAGNET_RE = re.compile(r"^magnet:\?xt=urn:btih:[a-zA-Z0-9]+")

class MagnetRequest(BaseModel):
    magnet: str = Field(..., min_length=10)
    title: str | None = None
    year: int | None = None
    folder: str | None = None
    category: str | None = None

def require_token(auth_header: str | None):
    if not API_TOKEN:
        raise RuntimeError("API_TOKEN is not set. Refusing to run insecurely.")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth_header.split(" ", 1)[1].strip()
    if token != API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")

def safe_join(root: str, subpath: str | None) -> str:
    if not subpath:
        return root
    subpath = subpath.replace("\\", "/").lstrip("/")
    if ".." in subpath.split("/"):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    return f"{root.rstrip('/')}/{subpath}"

def resolve_save_path(folder: str | None, category: str | None) -> str:
    if category in CATEGORY_ROOTS and CATEGORY_ROOTS[category]:
        base_root = CATEGORY_ROOTS[category].rstrip("/")
        return safe_join(base_root, folder)

    if folder in CATEGORY_ROOTS and CATEGORY_ROOTS[folder]:
        return CATEGORY_ROOTS[folder].rstrip("/")

    return safe_join(DOWNLOADS_ROOT, folder)

def qb_login(session: requests.Session):
    if not QB_USER or not QB_PASS:
        raise HTTPException(status_code=500, detail="qBittorrent credentials not configured")

    r = session.post(
        f"{QB_URL}/api/v2/auth/login",
        data={"username": QB_USER, "password": QB_PASS},
        timeout=10,
    )

    if r.status_code != 200 or r.text.strip() != "Ok.":
        raise HTTPException(status_code=502, detail="qBittorrent login failed")

def qb_add_magnet(session: requests.Session, magnet: str, savepath: str):
    r = session.post(
        f"{QB_URL}/api/v2/torrents/add",
        data={
            "urls": magnet,
            "savepath": savepath,
            "autoTMM": "false",
        },
        timeout=15,
    )

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"qBittorrent add failed (HTTP {r.status_code})")

@app.get("/health")
def health():
    return {"ok": True, "qb_url": QB_URL}

@app.post("/api/magnet")
def add_magnet(payload: MagnetRequest, authorization: str | None = Header(default=None)):
    require_token(authorization)

    if not MAGNET_RE.match(payload.magnet):
        raise HTTPException(status_code=400, detail="Invalid magnet link format")

    save_path = resolve_save_path(payload.folder, payload.category)

    with requests.Session() as s:
        qb_login(s)
        qb_add_magnet(s, payload.magnet, save_path)

    return {
        "received": True,
        "queued_in_qbittorrent": True,
        "title": payload.title,
        "year": payload.year,
        "save_path": save_path,
    }
