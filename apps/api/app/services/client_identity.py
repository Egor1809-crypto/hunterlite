"""Stable portraits for the fictional reference catalog; no generated client facts."""

import json
import re
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name("portrait_catalog.json").read_text())


def client_identity(slug: str | None = None, *, name: str = "", brief: str = "") -> dict:
    # Older sessions may predate the slug; require an exact catalog name match.
    if slug not in CATALOG:
        slug = next((key for key, item in CATALOG.items() if item["name"] == name), None)
    item = CATALOG.get(slug)
    if item is None:
        return {"age": None, "gender": None, "portrait_url": None}
    # Prefer the current dossier age when present; the manifest records seed age.
    match = re.search(r"Кто:\s*[^\n]*?,\s*(\d{2})\s*(?:год|лет)", brief)
    age = int(match[1]) if match else item["age"]
    return {"age": age, "gender": item["gender"], "portrait_url": f"/portraits/{slug}.png"}
