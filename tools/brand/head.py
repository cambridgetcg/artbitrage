"""The shared <head> pieces for artbitrage.io pages: the 閒 icon links and a room's share-card tags.

The page generators (tools/build-elements.py, tools/build-noticing.py, tools/build-unsigned.py)
import this; the hand-written pages carry the same tags, one per line. tests/e2e-brand.mjs checks
both against assets/og/credits.json, which tools/brand/gen_card.py writes beside the cards.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

ICON_LINKS = (
    '<!-- 閒 the gap: the artbitrage.io icon. Every file sits at the site root. /manifest.json stays the philosophy document. -->',
    '<link rel="icon" href="/favicon.ico" sizes="32x32">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">',
    '<link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
)


def card(slug):
    """A room's card record from assets/og/credits.json."""
    cards = json.loads((ROOT / 'assets/og/credits.json').read_text(encoding='utf-8'))['cards']
    for c in cards:
        if c['slug'] == slug:
            return c
    raise KeyError(f'no share card for {slug!r} in assets/og/credits.json (run tools/brand/gen_card.py)')


def icon_links(sep=''):
    return sep.join(ICON_LINKS)


def og_tags(slug, sep=''):
    """og:image (+ size, alt, site name) and the Twitter large-image card for a room."""
    c = card(slug)
    return sep.join((
        f'<meta property="og:image" content="{c["og_image"]}">',
        f'<meta property="og:image:width" content="{c["width"]}">',
        f'<meta property="og:image:height" content="{c["height"]}">',
        f'<meta property="og:image:alt" content="{html.escape(c["alt"], quote=True)}">',
        '<meta property="og:site_name" content="Artbitrage">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:image" content="{c["og_image"]}">',
    ))
