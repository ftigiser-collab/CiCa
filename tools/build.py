#!/usr/bin/env python3
"""Baut CiCa-Buddy: index.html (alles eingebettet), manifest.webmanifest, sw.js, icons/."""
import base64, json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, DIST = ROOT / "src", ROOT
SW_VERSION = "cica-v1.1.0"

def b64(p):
    return base64.b64encode((SRC / p).read_bytes()).decode()

css = (SRC / "style.css").read_text()
css = css.replace("{{FONT400}}", b64("atkinson-hyperlegible-latin-400-normal.woff2"))
css = css.replace("{{FONT700}}", b64("atkinson-hyperlegible-latin-700-normal.woff2"))
js = (SRC / "app.js").read_text()
html = (SRC / "shell.html").read_text().replace("{{CSS}}", css).replace("{{JS}}", js)
(DIST / "index.html").write_text(html)

manifest = {
    "id": "/CiCa/",
    "name": "CiCa-Buddy — CVVHDF mit Citrat",
    "short_name": "CiCa-Buddy",
    "description": "Klinische Probleme unter CVVHDF mit regionaler Citratantikoagulation lösen (Marburger Empfehlung, Prismaflex/Prismax).",
    "lang": "de",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "orientation": "any",
    "background_color": "#F2F6F5",
    "theme_color": "#13303A",
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
    ]
}
(DIST / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

sw = f"""// CiCa-Buddy Service Worker – beim Update VERSION hochzählen
const VERSION = '{SW_VERSION}';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => {{
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', e => {{
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {{
    // HTML: erst Netz (sofortige Updates), sonst Cache
    e.respondWith(fetch(req).then(r => {{ const cp = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', cp)); return r; }})
      .catch(() => caches.match('./index.html')));
  }} else {{
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(r => {{ const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); return r; }})));
  }}
}});
"""
(DIST / "sw.js").write_text(sw)
(DIST / ".nojekyll").write_text("")
print("index.html", len(html) // 1024, "KB")
