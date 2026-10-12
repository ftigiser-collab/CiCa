#!/usr/bin/env python3
"""Rendert die App-Icons aus einem SVG mit Playwright."""
import pathlib
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(parents=True, exist_ok=True)

def svg(size, maskable=False, rounded=True):
    # Ring = Kreislauf, gelber Tropfen = Citrat am Eintritt, blauer Punkt = Calcium
    pad = 0.12 if maskable else 0.0
    s = 64
    inner = f'''<g transform="translate({s*pad} {s*pad}) scale({1-2*pad})">
      <path d="M44 16a20 20 0 1 0 6 18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <path d="M50 9c3.6 4.6 5.6 8 5.6 10.6a5.6 5.6 0 0 1-11.2 0C44.4 17 46.4 13.6 50 9z" fill="#E8B400"/>
      <circle cx="32" cy="32" r="5" fill="#7FA3E0"/></g>'''
    rx = 0 if (maskable or not rounded) else 14
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 64 64"><rect width="64" height="64" rx="{rx}" fill="#13303A"/>{inner}</svg>'

jobs = [("icon-192.png", 192, False, True), ("icon-512.png", 512, False, True),
        ("icon-512-maskable.png", 512, True, False), ("apple-touch-icon.png", 180, False, False)]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    for name, size, mask, rnd in jobs:
        pg.set_viewport_size({"width": size, "height": size})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg(size, mask, rnd)}</body></html>')
        pg.locator("svg").screenshot(path=str(OUT / name), omit_background=True)
    b.close()
print("icons ok")
