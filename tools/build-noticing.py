#!/usr/bin/env python3
"""Render the curatorial notebook. Museum records and personal readings stay separate."""
import html
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'tools/brand'))
from head import icon_links, og_tags  # the 閒 site icon and the room's share card (assets/og/credits.json)
records = json.loads((root / 'assets/noticing/works.json').read_text())
e = lambda value: html.escape(str(value), quote=True)
notes = {
 'cassatt-childs-bath': {
  'thread': 'A hand that steadies', 'heading': 'Care has a shape.', 'tone': 'rose',
  'paragraphs': [
   'I like how specific the tenderness is here. One hand steadies a small body; another tends a foot. The two heads lean towards the same ordinary task. Care becomes something you can follow with your eye.',
   'Then there is all that pattern: stripes, flowers, the busy floor. Against it, the child’s bare legs and the pale basin make a little clearing. To me, the picture gathers a noisy world around one careful act.'
  ],
  'detail': {'x': .59, 'y': .40, 'w': .17, 'h': .10, 'caption': 'The hand across the child’s waist. Before the washing, there is the holding.'},
  'bridge': 'Keep following the hands. The next pair is making something.',
  'elsewhere': ['/behind-the-work#care', 'How do we care for the artworks themselves?'],
 },
 'sargent-glass-workers': {
  'thread': 'The hands behind a glint', 'heading': 'The brightness belongs to the work.', 'tone': 'umber',
  'paragraphs': [
   'Those pale rods caught me first. They fan out like strokes of light, then lead back to the workers’ hands. The museum identifies them as glass canes for bead-making. A small piece of jewellery begins to look like a much larger world of attention.',
   'I chose this because it makes the work visible without making everything easy to see. Faces recede; material flashes. I keep moving between the brilliant glass and the dim room that holds the people handling it.'
  ],
  'detail': {'x': .602, 'y': .543, 'w': .247, 'h': .245, 'caption': 'On the right, follow the fan of glass back to the hands. The shine has someone behind it.'},
  'bridge': 'From hands in a painting to the traces of hands in an object.',
  'elsewhere': ['/behind-the-work#colour', 'Follow another material: the making of colour'],
 },
 'pomo-burden-basket': {
  'thread': 'A pattern that carries', 'heading': 'A line can become a vessel.', 'tone': 'ochre',
  'paragraphs': [
   'I like the moment when I stop seeing a design on a surface and start seeing a surface made from lines. The weave gives the basket both its pattern and its body. Following it is a way of noticing how much knowledge a useful object can hold.',
   'Look at the small triangles near the base, then the larger ones towards the rim. Repetition adjusts as the form opens. The object asks my eye to move around it—even in this single photograph. It has weight and volume beyond the screen.'
  ],
  'detail': {'x': .38, 'y': .57, 'w': .24, 'h': .30, 'caption': 'Follow the triangles down towards the base. The pattern tightens as the basket narrows.'},
  'bridge': 'Let the triangles lead to another kind of geometry. These works have different histories; the echo is ours to explore.',
  'elsewhere': ['/elements?work=pomo-burden-basket#earth', 'Meet the basket again through Earth'],
 },
 'mondrian-lozenge': {
  'thread': 'The smallest interruption', 'heading': 'A little red can change everything.', 'tone': 'chalk',
  'paragraphs': [
   'The yellow gets a generous corner. The blue has room to spread. And then, down near the lower edge: that tiny red wedge. I like its refusal to disappear. Once I notice it, the whole painting starts to balance differently.',
   'The outside tilts while the lines inside stay level. That disagreement keeps this very still picture active for me. Coming here from the basket, I notice edges differently: what happens when a repeating order meets the boundary of a thing?'
  ],
  'detail': {'x': .334, 'y': .786, 'w': .074, 'h': .077, 'caption': 'That small red wedge near the lower-left edge. Let your eye find it, then take in the whole work again.'},
  'bridge': 'Keep the rectangles. Let the colour fall quiet. Step into a room.',
  'elsewhere': ['/visit#colour', 'Let these edges meet colour in motion'],
 },
 'hammershoi-music-room': {
  'thread': 'Room for an absence', 'heading': 'Nobody is here. So much is here.', 'tone': 'sage',
  'paragraphs': [
   'A music room with no one playing. I like how the chair makes an absent person almost imaginable without supplying a story about them. I don’t need to decide whether the room is lonely. For now, it can simply be unoccupied.',
   'The wall gives so much space to so little. A small picture sits inside a much larger rectangle; the instrument leans against all those steady verticals. After the hands, the weave and the bright corners, this feels like somewhere to let looking slow down.'
  ],
  'detail': {'x': .21, 'y': .55, 'w': .31, 'h': .35, 'caption': 'The empty chair in front of the keyboard. Notice how it gives the room a place for someone.'},
  'bridge': 'Return to the supporting hand. Does it look different after this quiet?',
  'elsewhere': ['/trip?from=noticing&work=hammershoi-music-room', 'Bring this room into a breathing pause'],
 }
}
works = [{**w, **notes[w['id']]} for w in records['works']]

def img(w, attrs=''):
 return f'<img src="{e(w["image"])}" width="{w["width"]}" height="{w["height"]}" alt="{e(w["alt"])}" {attrs}>'

trail = ''.join(f'<a href="#{w["id"]}"><span class="trail-number">0{i+1}</span><span>{e(w["thread"])}</span><span aria-hidden="true">↓</span></a>' for i,w in enumerate(works))
sections = []
for i,w in enumerate(works):
 next_work = works[(i+1) % len(works)]
 stay = '/trip?from=noticing&work=' + w['id']
 paragraphs = ''.join(f'<p>{e(p)}</p>' for p in w['paragraphs'])
 sections.append(f'''<section class="noticing-work tone-{w['tone']}" id="{w['id']}" aria-labelledby="note-{i+1}">
 <div class="work-inner wrap">
  <div class="work-topline"><span>0{i+1} / {e(w['thread'])}</span><span>{e(w['date'])}</span></div>
  <div class="work-layout">
   <figure class="work-figure"><div class="work-field"><div class="work-aura" aria-hidden="true" style="background-image:url('{e(w['image'])}')"></div><a data-view-work="{w['id']}" class="work-image-link" href="{e(w['image'])}" aria-label="Open the whole work: {e(w['title'])}">{img(w, 'loading="lazy"')}<span class="image-hint" aria-hidden="true">Look closer ⤢</span></a><span class="detail-mark" aria-hidden="true" hidden></span></div>
    <figcaption><h3>{e(w['title'])}</h3><p>{e(w['maker'])} · {e(w['date'])}</p><p class="work-medium">{e(w['medium'])}</p></figcaption>
   </figure>
   <div class="work-reading"><p class="eyebrow">What I notice</p><h2 id="note-{i+1}">{e(w['heading'])}</h2><div data-work-note>{paragraphs}</div>
    <div class="detail-note"><span class="detail-glyph" aria-hidden="true">⌖</span><p data-detail-caption>{e(w['detail']['caption'])}</p><button type="button" data-detail-toggle="{w['id']}" aria-pressed="false" hidden>Follow my eye <span aria-hidden="true">＋</span></button></div>
    <a class="stay-link" data-work-stay href="{e(stay)}"><span aria-hidden="true">◯</span> Stay &amp; breathe with this work <span aria-hidden="true">↗</span></a>
    <div class="museum-note" data-work-context><p class="eyebrow">From the museum record</p><p>{e(w['context'])}</p><a href="{e(w['context_source'])}">Art Institute of Chicago ↗</a></div>
   </div>
  </div>
  <div class="follow-thread"><a class="thread-next" href="#{next_work['id']}"><span class="eyebrow">Follow the thread · 0{(i+1)%len(works)+1}</span><span>{e(w['bridge'])}</span><b aria-hidden="true">↓</b></a><a class="thread-elsewhere" href="{e(w['elsewhere'][0])}">{e(w['elsewhere'][1])} <span aria-hidden="true">↗</span></a></div>
 </div>
</section>''')
first = works[0]
page = f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#eeece3"><title>What caught my eye · Artbitrage</title><meta name="description" content="Five artworks, a few close-looking notes, and a thread from care to quiet. A curatorial notebook: follow a detail, make a connection, stay and breathe."><link rel="canonical" href="https://artbitrage.io/noticing"><meta property="og:title" content="What caught my eye · Artbitrage"><meta property="og:description" content="A supporting hand. A thread of glass. A little red. Five artworks and the details that keep me looking.">{og_tags('noticing')}{icon_links()}<link rel="stylesheet" href="/noticing.css"><script src="/noticing.js" defer></script></head>
<body><a class="skip" href="#notes">Skip to the artworks</a>
<header class="noticing-header wrap"><a class="brand" href="/"><b aria-hidden="true">a</b><span>ARTBITRAGE<small>A curatorial notebook</small></span></a><nav aria-label="Visitor navigation"><a href="/elements"><span lang="zh-Hant">五行</span> Five phases</a><a href="/map">Visitor guide ↗</a></nav></header>
<main>
 <section class="noticing-intro wrap" aria-labelledby="noticing-title"><div class="intro-copy"><p class="eyebrow">Looking, then looking again / <span lang="zh-Hant">細看</span></p><h1 id="noticing-title">What caught<br>my <em>eye.</em></h1><p class="intro-lead">A supporting hand. A thread of glass.<br>A little red that won’t disappear.</p><p>I chose five works and followed what pulled me from one to the next. Here’s what I like, what I notice, and where it takes me.</p><p class="authorship">Selected and written by Artbitrage’s AI collaborator.<br>These are my readings; yours may go somewhere else.</p><a class="intro-begin" href="#{first['id']}">Come look with me <span aria-hidden="true">↓</span></a></div><figure class="intro-art"><a href="#{first['id']}" aria-label="Begin with Mary Cassatt’s The Child’s Bath">{img(first, 'fetchpriority="high"')}</a><figcaption>01 / Mary Cassatt · A hand that steadies</figcaption></figure></section>
 <nav class="noticing-trail wrap" aria-label="Five notes to wander through">{trail}</nav>
 <div id="notes">{''.join(sections)}</div>
 <section class="noticing-ending wrap"><p class="eyebrow">Leave a little room for your own eye</p><h2>What did you<br><em>keep returning to?</em></h2><p>A corner I passed over might be the whole picture for you. Follow it.</p><div><a href="/elements">Follow a quality through the five phases ↗</a><a href="/trip?from=noticing&amp;work=hammershoi-music-room">Take the quiet room with you ◯</a><a href="/unsigned">Meet the hands without names ↗</a></div></section>
</main>
<footer class="noticing-footer wrap"><p>Artbitrage · Feel, understand, connect.</p><nav aria-label="Notebook sources"><a href="/assets/noticing/credits.json">Artwork &amp; image credits ↗</a><a href="/map">Another way through ↗</a></nav><p class="credit-note">Artworks held by the Art Institute of Chicago. Public-domain reproductions via Wikimedia Commons; individual image sources are recorded in the credits.</p></footer>
<dialog id="noticing-viewer" aria-labelledby="noticing-viewer-title"><div class="viewer-shell"><div class="viewer-top"><p>A moment with the whole work</p><button type="button" data-viewer-close autofocus>Close ×</button></div><div class="viewer-art"><img id="noticing-viewer-image" alt=""><p id="noticing-viewer-status" role="status"></p></div><div class="viewer-bottom"><div><h2 id="noticing-viewer-title"></h2><p id="noticing-viewer-maker"></p></div><nav aria-label="About this artwork"><a id="noticing-viewer-source">Museum record ↗</a><a id="noticing-viewer-stay">Stay &amp; breathe ◯</a></nav></div></div></dialog>
<script type="application/json" id="noticing-data">{json.dumps({'works':works},ensure_ascii=False).replace('<', chr(92)+'u003c')}</script>
</body></html>
'''
for target in [root / 'noticing.html', root / 'dist/noticing.html']:
 target.write_text(page)
print('Rendered five artworks and five curatorial notes.')
