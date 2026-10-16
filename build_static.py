"""Turns the editor into plain files in dist/, ready for free static hosting such as Cloudflare Pages.

    python build_static.py

Each language becomes its own page (dist/index.html for English, dist/pl/index.html for Polish),
next to a copy of static/.
"""

import shutil
from pathlib import Path

from app import BASE_DIR, LANGUAGES, app, page_path

DIST = BASE_DIR / "dist"


def build(dist=DIST):
    if dist.exists():
        shutil.rmtree(dist)
    shutil.copytree(BASE_DIR / "static", dist / "static")
    client = app.test_client()
    for lang in LANGUAGES:
        path = page_path(lang)
        response = client.get(path)
        if response.status_code != 200:
            raise SystemExit(f"{path} returned {response.status_code}")
        page = dist / path.strip("/") / "index.html"
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_bytes(response.data)
    return dist


if __name__ == "__main__":
    print(f"Built {build()}")
