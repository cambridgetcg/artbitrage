#!/usr/bin/env python3
"""Render the static Five Phases gallery from its curated local manifest."""
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'assets/elements/works.json').read_text())
works = {work['id']: work for work in data['works']}
phases = {phase['id']: phase for phase in data['phases']}
e = lambda value: html.escape(str(value), quote=True)
headings = {'wood': 'Things reaching outward.', 'fire': 'Where the light begins.', 'earth': 'Something to rest on.', 'metal': 'The shape of a glint.', 'water': 'Follow the current.'}

def image(work, extra=''):
    return f'<img src="{e(work["image"])}" width="{work["width"]}" height="{work["height"]}" alt="{e(work["alt"])}" {extra}>'

nav = ''.join(f'<a href="#{p["id"]}" data-phase-link="{p["id"]}"><span class="han" lang="zh-Hant">{p["han"]}</span><strong>{p["title"]}</strong><small>{e(p["quality"])}</small></a>' for p in data['phases'])
sections = []
for p in data['phases']:
    work = works[p['works'][0]]
    next_phase = phases[p['next']]
    other = next((phase for phase in work['phases'] if phase != p['id']), None)
    echo = f'<a class="element-link" data-work-echo data-cross-phase href="?work={e(work["id"])}#{other}">See this work through {phases[other]["title"]} ↗</a>' if other else '<a class="element-link" data-work-echo data-cross-phase hidden></a>'
    choices = []
    for wid in p['works']:
        w = works[wid]
        choices.append(f'''<a href="{e(w['image'])}" data-work-choice="{wid}" aria-label="Look at {e(w['title'])}">{image(w, 'loading="lazy"')}<h4>{e(w['title'])}</h4><p>{e(w['maker'])}</p><span class="choice-hint">Spend a moment ↗</span></a>''')
    sections.append(f'''<section id="{p['id']}" class="phase-panel" data-phase-panel aria-labelledby="{p['id']}-heading">
 <div class="phase-heading"><div><p class="eyebrow"><span lang="zh-Hant">{p['han']}</span> {p['title']} / {e(p['quality'])}</p><h2 id="{p['id']}-heading" data-phase-heading tabindex="-1">{headings[p['id']]}</h2></div><p>{e(p['intro'])}</p></div>
 <div class="element-room">
  <figure class="main-work"><div class="art-field"><div class="art-atmosphere" aria-hidden="true" style="background-image:url('{e(work['image'])}')"></div><a data-full-image href="{e(work['image'])}" aria-label="Open the whole image of {e(work['title'])}">{image(work, 'data-main-image ' + ('fetchpriority="high"' if p['id']=='wood' else 'loading="lazy"'))}</a></div><figcaption><h3 data-work-title>{e(work['title'])}</h3><p data-work-maker>{e(work['maker'])} · {e(work['date'])}</p><a class="element-link" data-work-source href="{e(work['source'])}">Museum record ↗</a></figcaption></figure>
  <div class="looking-notes"><p class="eyebrow">What pulls your eye?</p><p class="looking-prompt" data-work-prompt>{e(work['looking'][0])}</p><p class="work-affinity" data-work-affinity>{e(work['affinity'][p['id']])}</p><p class="material-label"><span>The material</span><b data-work-medium>{e(work['medium'])}</b></p><div class="work-actions"><a class="element-button" data-work-stay href="/trip?from=elements&amp;phase={p['id']}&amp;work={e(work['id'])}">Stay &amp; breathe with this work ◯</a><a class="element-link" data-work-behind href="{e(work['behind'])}">Go behind the work ↗</a>{echo}</div></div>
 </div>
 <div class="companion-heading"><h3>Three ways into {p['title'].lower()}.</h3><p>Choose a work. Notice what changes.</p></div><div class="phase-works">{''.join(choices)}</div>
 <a class="phase-next" data-phase-next href="#{p['next']}"><span class="han" lang="zh-Hant" aria-hidden="true">{next_phase['han']}</span><span><small>{p['title']} → {next_phase['title']} / Follow an echo</small><strong>{e(p['bridge'])}</strong></span><span class="arrow" aria-hidden="true">↗</span></a>
</section>''')

page = '''<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#1e2922"><title>五行 — Five ways of looking · Artbitrage</title><meta name="description" content="Follow wood, fire, earth, metal and water through art. A gallery of growth, warmth, texture and reflection, inspired by the five phases."><link rel="canonical" href="https://artbitrage.io/elements"><meta property="og:title" content="五行 — Five ways of looking · Artbitrage"><meta property="og:description" content="A branch, an ember, a vessel, a glint. Start with what pulls you, and follow the connections."><meta property="og:image" content="https://artbitrage.io/assets/visit/hiroshige-plum-garden.jpg"><link rel="stylesheet" href="elements.css"><script src="elements.js" defer></script></head>
<body data-phase="wood">
<a class="skip" href="#elements-stage">Skip to the artworks</a>
<header class="element-header"><a class="element-brand" href="/"><b aria-hidden="true">a</b><span>ARTBITRAGE<small>五行 · Five ways of looking</small></span></a><nav aria-label="Visitor navigation"><a href="/visit">The gallery ↗</a><a href="/map">Visitor guide</a></nav></header>
<main id="main" class="wrap">
 <section class="element-intro" aria-labelledby="elements-title"><div><p class="eyebrow"><span lang="zh-Hant">五行</span> A gallery of changing things</p><h1 id="elements-title">Follow what<br><em>pulls you.</em></h1></div><p class="intro-note">A branch. An ember. A vessel. A glint of light.<br>Begin with a quality you notice, and let it carry you from one work to another.<br><a href="#about-phases">A little about the five phases ↓</a></p></section>
 <nav id="phase-nav" class="phase-nav" aria-label="Choose a phase">NAV</nav>
 <p id="elements-status" class="elements-feedback" role="status" aria-live="polite"></p><button id="elements-retry" class="element-button" type="button" hidden>Try that work again</button>
 <div id="elements-stage">SECTIONS</div>
 <section id="about-phases" class="about-phases" aria-labelledby="about-title"><div><p class="eyebrow">One work, more than one way in</p><h2 id="about-title">A circle of changes.</h2><div class="phase-cycle" aria-label="Wood, Fire, Earth, Metal, Water, returning to Wood"><span lang="zh-Hant">木</span><b aria-hidden="true">→</b><span lang="zh-Hant">火</span><b aria-hidden="true">→</b><span lang="zh-Hant">土</span><b aria-hidden="true">→</b><span lang="zh-Hant">金</span><b aria-hidden="true">→</b><span lang="zh-Hant">水</span><b aria-hidden="true">↶</b></div><p>A moon jar can speak of earth when you follow its rounded form, and fire when you imagine its making. A golden screen can lead you through branches or through light. Try meeting the same work from another side.</p></div><div><p>This gallery takes inspiration from 五行 (wǔxíng), the five phases of Chinese thought: wood, fire, earth, metal and water. The tradition attends to change and relationships; our rooms follow its generating cycle.</p><p>The connections between these artworks are Artbitrage’s invitations to look. Each work keeps its own history, materials and museum record.</p><details><summary>A note on 五行 and these pairings +</summary><p>“Five phases” is one translation of 五行. Wood, fire, earth, metal and water are understood through their interactions. Here they offer a route across artworks made in different places and traditions.</p><p>Our pairings do not claim that the artists used this framework. A painted reflection belongs here through what we see; a bronze sculpture also belongs through what it is made from.</p><a href="https://iep.utm.edu/wuxing/">Internet Encyclopedia of Philosophy · Wuxing ↗</a></details><a class="element-link" href="/behind-the-work">Follow materials, making and care ↗</a><p>A pattern can lead somewhere unexpected. Follow the Pomo basket into a notebook of working hands, painted edges and quiet rooms.</p><a class="element-link" href="/noticing#pomo-burden-basket">What caught my eye · open the notebook ↗</a></div></section>
</main>
<footer class="element-footer wrap"><p>Artbitrage · Feel, understand, connect.<br>Thirteen works. Fifteen encounters. Your own way through.</p><a href="/noticing">Keep looking · the notebook ↗</a><a href="/map">Choose another room ↗</a></footer>
<script type="application/json" id="elements-data">DATA</script>
</body></html>
'''
page = page.replace('NAV', nav).replace('SECTIONS', '\n'.join(sections)).replace('DATA', json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'))
for target in [root / 'elements.html', root / 'dist/elements.html']:
    target.write_text(page)
print('Rendered five phases, fifteen encounters, thirteen works.')
