#!/usr/bin/env python3
"""Create an authorized static snapshot of yingzhang.xyz for GitHub Pages."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE_ORIGIN = "https://yingzhang.xyz"
TARGET_ORIGIN = "https://harrison-f.github.io/yingzhang-site-rebuild"
ROOT = Path(__file__).resolve().parents[1]
ROUTES = (
    "/",
    "/1-2026off",
    "/2-doors-to-freedom",
    "/3-2025off",
    "/4-tyranny-tracker",
    "/5-fab9-brand",
    "/6-dicators-laundromat",
    "/7-esc-tyranny",
    "/8-nyid",
    "/9-fab9-environment",
)
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36"


def fetch(route: str) -> bytes:
    request = Request(SOURCE_ORIGIN + route, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=60) as response:
        content_type = response.headers.get("Content-Type", "")
        if response.status != 200 or "text/html" not in content_type:
            raise RuntimeError(f"{route}: HTTP {response.status}, {content_type}")
        return response.read()


def rewrite(html: str, route: str) -> str:
    # Framer serializes URLs both literally and JSON-escaped in generated HTML.
    html = html.replace(SOURCE_ORIGIN.replace("/", r"\/"), TARGET_ORIGIN.replace("/", r"\/"))
    html = html.replace(SOURCE_ORIGIN, TARGET_ORIGIN)

    # The source uses extensionless routes, where "./#fragment" points home.
    # GitHub Pages canonicalizes project routes to directories with trailing
    # slashes, so make those home-navigation targets explicit.
    for fragment in ("work", "section-about", "section-contact"):
        html = html.replace(f"./#{fragment}", f"{TARGET_ORIGIN}/#{fragment}")
    if route != "/":
        html = html.replace('href="./"', f'href="{TARGET_ORIGIN}/"')

    # Framer's client router treats its original root-relative navigation as a
    # user-site route and can drop the GitHub Pages project prefix after
    # hydration. Preserve the rewritten DOM destination by handling only links
    # that explicitly target this Pages site before Framer's router sees them.
    routing_fix = f'''<script data-github-pages-routing-fix>
document.addEventListener("click",function(event){{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest("a[href]");
  if(!link||!link.href.startsWith("{TARGET_ORIGIN}/"))return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign(link.href);
}},true);
</script>
'''
    return html.replace("</body>", routing_fix + "</body>")


def output_path(route: str) -> Path:
    return ROOT / "index.html" if route == "/" else ROOT / route.lstrip("/") / "index.html"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    pages = []
    external_assets: set[str] = set()

    for route in ROUTES:
        source = fetch(route)
        source_text = source.decode("utf-8")
        if "<!-- Made in Framer" not in source_text:
            raise RuntimeError(f"{route}: expected Framer export marker was not found")

        rendered = rewrite(source_text, route).encode("utf-8")
        destination = output_path(route)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(rendered)

        external_assets.update(
            url.replace("&amp;", "&")
            for url in re.findall(
                r'https://framerusercontent\.com/(?:images|assets)/[^"\'<>\\)\s]+',
                source_text,
            )
        )
        pages.append(
            {
                "route": route,
                "source_sha256": sha256(source),
                "published_sha256": sha256(rendered),
                "bytes": len(rendered),
            }
        )
        print(f"snapshotted {route} -> {destination.relative_to(ROOT)} ({len(rendered):,} bytes)")

    fetched_at = datetime.now(timezone.utc).isoformat()
    manifest = {
        "source": SOURCE_ORIGIN,
        "target": TARGET_ORIGIN,
        "fetched_at": fetched_at,
        "pages": pages,
        "external_asset_count": len(external_assets),
        "external_assets": sorted(external_assets),
    }
    (ROOT / "snapshot-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    (ROOT / ".nojekyll").write_text("", encoding="utf-8")
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(
            f"  <url><loc>{TARGET_ORIGIN}{route if route == '/' else route + '/'}</loc></url>\n"
            for route in ROUTES
        )
        + "</urlset>\n",
        encoding="utf-8",
    )
    print(f"recorded {len(external_assets)} external Framer assets")


if __name__ == "__main__":
    main()
