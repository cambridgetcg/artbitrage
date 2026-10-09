#!/usr/bin/env python3
"""Render /unsigned, a room of works whose makers the museum record does not name.

The room text and notes live in assets/unsigned/works.json and are rendered
verbatim. Museum facts come from assets/unsigned/credits.json; this script
refuses to build if the two disagree. Every label keeps a blank maker line.
"""
import html
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'tools/brand'))
from head import icon_links, og_tags  # the 閒 site icon and the room's share card (assets/og/credits.json)
manifest = json.loads((root / 'assets/unsigned/works.json').read_text())
credits = {record['id']: record for record in json.loads((root / 'assets/unsigned/credits.json').read_text())['works']}
room, works = manifest['room'], manifest['works']

e = lambda value: html.escape(str(value), quote=True)
CJK = re.compile(r'[⺀-⿿　-〿㐀-鿿豈-﫿]+')
def text(value):
 """Escape a string and mark its Chinese characters for the reader."""
 return CJK.sub(lambda match: f'<span lang="zh-Hant">{match.group(0)}</span>', e(value))

# Context links are labelled by what they are; an unknown source stops the build.
SOURCE_LABELS = [
 (re.compile(r'^https://www\.artic\.edu/artworks/\d+$'), 'Art Institute of Chicago'),
 (re.compile(r'^https://doi\.org/10\.53269/9780865593213/\d+$'), 'Art Institute catalogue (2025)'),
 (re.compile(r'^https://exhibitions\.psu\.edu/s/african-brilliance/page/catalogue-\d+$'), 'Palmer Museum of Art · African Brilliance'),
]
def source_label(url):
 for pattern, label in SOURCE_LABELS:
  if pattern.match(url):
   return label
 raise SystemExit(f'No label for context source {url}')

WHOLE = 'the whole work'  # what the art link, its hint and the viewer offer, unless the work says otherwise

# The museum record must agree with the room's display manifest.
assert len(works) == 10, 'the room hangs ten works'
assert len({work['id'] for work in works}) == len(works), 'work ids are unique'
for work in works:
 record = credits[work['id']]
 assert re.fullmatch(r'[a-z0-9-]+', work['id']), work['id']
 assert work['image'] == f"/assets/unsigned/{record['file']}" == record['image'], work['id']
 assert work['source'] == record['url'] == f"https://www.artic.edu/artworks/{work['museum_id']}", work['id']
 assert work['museum_id'] == record['museum_id'], work['id']
 assert work['maker'] == record['artist_display'].replace('\n', ' · '), work['id']
 for field in ('title', 'date', 'medium', 'alt', 'width', 'height', 'source_name'):
  assert work[field] == record[field], f"{work['id']}: {field}"
 assert work['looking'] == record['looking_prompts'] and len(work['looking']) == 2, work['id']
 assert record['is_public_domain'] is True and record['license'] == 'CC0', work['id']
 for field in ('chapter', 'headline', 'note', 'kept', 'context', 'provenance', 'context_sources'):
  assert work.get(field), f"{work['id']}: {field}"
 for url in work['context_sources']:
  source_label(url)
 # A work whose image shows only part of it says so wherever the page offers 'the whole work'.
 assert ('view' in work) == (record.get('image_scope', 'whole') == 'section'), f"{work['id']}: view and image_scope agree"
 assert work.get('view', WHOLE) and '<' not in work.get('view', WHOLE), work['id']

WIDE = 2.5  # wider than 5:2 hangs across the whole wall
blank = e(room['blank_caption'])

def picture(work, index):
 loading = 'fetchpriority="high"' if index == 0 else 'loading="lazy" decoding="async"'
 return f'<img src="{e(work["image"])}" width="{work["width"]}" height="{work["height"]}" alt="{e(work["alt"])}" {loading}>'

index_links = ''.join(
 f'<li><a href="#{w["id"]}"><span class="index-number">{i+1:02d}</span><span class="index-chapter">{e(w["chapter"])}</span><span class="index-maker">{text(w["maker"])}</span></a></li>'
 for i, w in enumerate(works))

bays = []
hung = 0  # works hung beside their labels alternate sides of the wall
for i, w in enumerate(works):
 number = f'{i+1:02d}'
 wide = w['width'] / w['height'] > WIDE
 side = '' if wide else (' bay-flip' if hung % 2 else '')
 hung += 0 if wide else 1
 notes = ''.join(f'<p>{e(p)}</p>' for p in w['note'])
 looking = ''.join(f'<li>{e(line)}</li>' for line in w['looking'])
 sources = ''.join(f'<a href="{e(url)}">{e(source_label(url))} <span aria-hidden="true">↗</span></a>' for url in w['context_sources'])
 care = f'<p class="care">{e(w["care"])}</p>' if w.get('care') else ''
 view = w.get('view', WHOLE)
 ratio = f"{w['width'] / w['height']:.4f}".rstrip('0').rstrip('.')
 bays.append(f'''<article class="bay{' bay-wide' if wide else ''}{side}" id="{w['id']}" aria-labelledby="{w['id']}-title">
 <figure class="bay-art"><a class="art-link" data-view-work="{w['id']}" href="{e(w['image'])}" style="--r:{ratio}"><span class="visually-hidden">Look at {e(view)}: </span>{picture(w, i)}</a><figcaption class="art-hint" aria-hidden="true">{number} · {e(view)} <span>⤢</span></figcaption></figure>
 <div class="bay-text">
  <div class="bay-col col-label">
   <div class="label">
    <h2 id="{w['id']}-title">{text(w['title'])}</h2>
    <dl class="tombstone">
     <div class="maker-row"><dt>Maker</dt><dd><span class="blank-line" aria-hidden="true"></span><span class="blank-caption" data-blank-caption>{blank}</span></dd></div>
     <div><dt>Recorded as</dt><dd data-recorded-as>{text(w['maker'])}</dd></div>
     <div><dt>The record keeps</dt><dd>{e(w['kept'])}</dd></div>
    </dl>
   </div>
   <p class="chapter"><span class="chapter-number">{number}</span><span class="chapter-name">{e(w['chapter'])}</span></p>
  </div>
  <div class="bay-col col-reading">
   <div class="reading" data-work-note><p class="eyebrow">What I notice</p><h3>{e(w['headline'])}</h3>{notes}</div>
   <div class="look-for"><p class="eyebrow">Look for</p><ul>{looking}</ul></div>
  </div>
  <div class="bay-col col-museum">
   <div class="museum" data-work-context><p class="eyebrow">From the museum</p><p class="museum-fields">{e(w['date'])} · {e(w['medium'])}</p><p>{e(w['context'])}</p><p class="museum-sources">{sources}</p></div>
   {care}<p class="provenance"><span class="key">Provenance</span> {e(w['provenance'])}</p>
   <a class="record-link" href="{e(w['source'])}">See the museum record <span aria-hidden="true">↗</span></a>
  </div>
 </div>
</article>''')

first = works[0]
intro = ''.join(f'<p>{e(p)}</p>' for p in room['intro'])
closing = ''.join(f'<p>{e(p)}</p>' for p in room['closing'])
title_lines = '<br>'.join([e(room['h1'][0]), f'<em>{e(room["h1"][1])}</em>'])
data = json.dumps(manifest, ensure_ascii=False).replace('<', chr(92) + 'u003c')
page = f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#1c211d"><title>{e(room['html_title'])}</title><meta name="description" content="{e(room['meta_description'])}"><link rel="canonical" href="https://artbitrage.io{e(room['path'])}"><meta property="og:title" content="{e(room['title'])} · Hands without names · Artbitrage"><meta property="og:description" content="{e(room['meta_description'])}">{og_tags('unsigned')}{icon_links()}<link rel="stylesheet" href="/unsigned.css"><script src="/unsigned.js" defer></script></head>
<body><a class="skip" href="#works">Skip to the works</a>
<header class="room-header"><a class="brand" href="/" aria-label="Artbitrage home"><span class="brand-mark" aria-hidden="true">a</span><span class="brand-name">ARTBITRAGE<small>{e(room['subtitle'])}</small></span></a><nav aria-label="Visitor navigation"><a href="/noticing">The notebook</a><a href="/map">Visitor guide <span aria-hidden="true">↗</span></a></nav></header>
<main id="main">
 <section class="intro wrap" aria-labelledby="unsigned-title">
  <div class="intro-head"><p class="eyebrow">{e(room['eyebrow'])} / <span lang="zh-Hant">{e(room['glyph'])}</span></p><h1 id="unsigned-title">{title_lines}</h1></div>
  <div class="intro-body">{intro}</div>
  <div class="intro-sign" aria-hidden="true"><span class="seal"></span><span class="sign-line"></span><span class="sign-caption">{blank}</span></div>
 </section>
 <nav class="index wrap" aria-label="Ten works in this room"><ol>{index_links}</ol></nav>
 <div id="works" class="works wrap">{''.join(bays)}</div>
 <section class="ending wrap" aria-labelledby="ending-title">
  <h2 id="ending-title" class="eyebrow">Leaving the room</h2>
  <div class="ending-text">{closing}</div>
  <p class="signature"><span class="signature-text">{e(room['signature'])}</span><span class="signature-line" aria-hidden="true"></span></p>
  <div class="credit"><p>{e(room['credit_note'])}</p><a href="/assets/unsigned/credits.json">Open the credits record <span aria-hidden="true">↗</span></a></div>
  <nav class="onward" aria-label="Keep walking"><a href="/noticing">What caught my eye <span aria-hidden="true">↗</span></a><a href="/map">Visitor guide <span aria-hidden="true">↗</span></a><a href="/visit">A gallery visit <span aria-hidden="true">↗</span></a></nav>
 </section>
</main>
<footer class="room-footer wrap"><p>Artbitrage · Feel, understand, connect.</p><p><span lang="zh-Hant">{e(room['glyph'])}</span> · {e(room['subtitle'])}</p><nav aria-label="Room records"><a href="/assets/unsigned/credits.json">Artwork &amp; image credits <span aria-hidden="true">↗</span></a></nav></footer>
<dialog id="unsigned-viewer" aria-labelledby="unsigned-viewer-title"><div class="viewer-shell"><div class="viewer-top"><p id="unsigned-viewer-view">{e(WHOLE[0].upper() + WHOLE[1:])}</p><button type="button" data-viewer-close autofocus>Close <span aria-hidden="true">×</span></button></div><div class="viewer-art"><img id="unsigned-viewer-image" alt=""><p id="unsigned-viewer-status" role="status"></p></div><div class="viewer-bottom"><div><h2 id="unsigned-viewer-title"></h2><p id="unsigned-viewer-maker"></p></div><a id="unsigned-viewer-source">Museum record <span aria-hidden="true">↗</span></a></div></div></dialog>
<script type="application/json" id="unsigned-data">{data}</script>
</body></html>
'''
for target in [root / 'unsigned.html', root / 'dist/unsigned.html']:
 target.write_text(page)
print(f'Rendered {len(works)} works without names, each with a blank maker line.')
