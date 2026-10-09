// Five phases: whole artworks, deliberate navigation, and local fixtures only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { withBrowser, until, origin } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root));
const html = read('elements.html').toString();
const script = read('elements.js').toString();
const data = JSON.parse(read('assets/elements/works.json'));
const phases = ['wood', 'fire', 'earth', 'metal', 'water'];
const byId = new Map(data.works.map(work => [work.id, work]));
const phaseById = new Map(data.phases.map(phase => [phase.id, phase]));
assert.deepEqual(data.phases.map(phase => phase.id), phases);
assert.equal(byId.size, data.works.length, 'work identifiers are unique');
assert.equal(data.works.length, 13, 'thirteen works form fifteen encounters, with deliberate echoes');
assert.equal(data.phases.reduce((sum, phase) => sum + phase.works.length, 0), 15, 'five phases hold fifteen artwork encounters');
for (const phase of data.phases) {
  assert.equal(phase.works.length, 3);
  assert.ok(phase.han && phase.title && phase.quality && phase.intro && phase.bridge);
  assert.equal(phase.next, phases[(phases.indexOf(phase.id) + 1) % phases.length]);
  assert.match(html, new RegExp(`id="${phase.id}"`));
  for (const id of phase.works) assert.ok(byId.get(id)?.phases.includes(phase.id), `${id} belongs in ${phase.id}`);
}
for (const work of data.works) {
  for (const field of ['title', 'maker', 'date', 'medium', 'alt', 'source']) assert.ok(typeof work[field] === 'string' && work[field].trim(), `${work.id}: ${field}`);
  assert.match(work.image, /^\/assets\/(?:elements|trip|visit|welcome|guide)\/[a-z0-9-]+\.(?:jpg|png|webp)$/);
  assert.match(work.source, /^https:\/\//);
  assert.ok(work.width > 0 && work.height > 0);
  assert.ok(Array.isArray(work.looking) && work.looking.length >= 2 && work.looking.every(line => typeof line === 'string' && line.length > 10));
  assert.ok(work.phases.length && work.phases.every(phase => phaseById.get(phase)?.works.includes(work.id)));
  assert.deepEqual(read(work.image.slice(1)), read(`dist${work.image}`), `${work.id} whole artwork deploy mirror`);
  if (work.attribution) {
    assert.match(work.attributionSource, /^https:\/\//);
    assert.match(work.attributionLicense, /^https:\/\//);
  }
}
for (const file of ['elements.html', 'elements.css', 'elements.js', 'assets/elements/works.json']) {
  assert.deepEqual(read(file), read(`dist/${file}`), `${file} deploy mirror`);
}
const embedded = html.match(/<script\b[^>]*id="elements-data"[^>]*>([\s\S]*?)<\/script>/);
assert.ok(embedded, 'a locally available catalogue drives progressive enhancement');
assert.deepEqual(JSON.parse(embedded[1]), data, 'embedded and public catalogues agree');
new Script(script);
assert.doesNotMatch(html, /<(?:audio|video|iframe)\b|\bautoplay\b/i);
assert.doesNotMatch(script, /\b(?:AudioContext|WebSocket|sendBeacon|localStorage|sessionStorage)\b/);
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));
console.log('elements static checks passed: five phases, fifteen encounters, membership, complete local sources/assets, embedded catalogue and deploy mirrors');
if (!process.argv.includes('--browser')) process.exit(0);

const tripHtml = read('trip.html').toString();
const visitWorks = JSON.parse(read('assets/visit/works.json'));
const tripWorks = JSON.parse(read('assets/trip/works.json'));
const assets = new Set(['elements.js', 'elements.css', 'trip.js', 'trip.css', 'breathing.js', 'breathing.css',
  'assets/elements/works.json', 'assets/visit/works.json', 'assets/trip/works.json',
  ...[...data.works, ...visitWorks, ...tripWorks.works].map(work => work.image.slice(1))]);
let manifestMode = 'normal', releaseManifest;
const route = async url => {
  if (url.pathname === '/trip') return { body: tripHtml };
  if (url.pathname === '/elements') return { body: html };
  const path = url.pathname.slice(1);
  if (!assets.has(path)) return null;
  const response = { body: read(path), type: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.json') ? 'application/json' : 'image/jpeg' };
  if (path === 'assets/elements/works.json') {
    if (manifestMode === 'failed') return { status: 503, body: '{}', type: 'application/json' };
    if (manifestMode === 'held') return new Promise(resolve => { releaseManifest = () => resolve(response); });
  }
  return response;
};
const init = `(() => {
  window.__audioCalls = 0;
  HTMLMediaElement.prototype.play = function(){ __audioCalls++; throw new Error('No audible media in elements tests'); };
  window.AudioContext = window.webkitAudioContext = class { constructor(){ __audioCalls++; throw new Error('No realtime audio in elements tests'); } };
  const originalFetch = fetch.bind(window);
  window.fetch = (url, options={}) => {
    if ((options.method || 'GET').toUpperCase() !== 'GET') throw new Error('No writes in elements tests');
    return originalFetch(url, options);
  };
  const NativeImage = window.Image, srcProperty = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  window.__imageControl = { mode:'normal', held:[], attempts:[], completed:[] };
  window.Image = function(...args) {
    const image = new NativeImage(...args);
    Object.defineProperty(image, 'src', {
      configurable:true, get(){ return srcProperty.get.call(image); },
      set(value) {
        const mode=__imageControl.mode; __imageControl.mode='normal'; __imageControl.attempts.push(value);
        const run=()=>srcProperty.set.call(image,value);
        image.addEventListener('load',()=>__imageControl.completed.push(value),{once:true});
        if(mode==='fail') queueMicrotask(()=>image.onerror?.(new Event('error')));
        else if(mode==='hold') __imageControl.held.push(run);
        else run();
      }
    });
    return image;
  };
  window.Image.prototype = NativeImage.prototype;
  window.__setHidden = hidden => { Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden}); document.dispatchEvent(new Event('visibilitychange')); };
})();`;

await withBrowser('elements', async b => {
  const { load, evaluate, click, send, viewport, media, shot, requests } = b;
  const frames = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const releaseHeldImage = async () => {
    const completed = await evaluate('__imageControl.completed.length');
    await evaluate('__imageControl.held.shift()()');
    await until(() => evaluate(`__imageControl.completed.length>${completed}`), 'the formerly held image really finishes');
    await frames();
  };
  const press = async (key, code, text) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, windowsVirtualKeyCode: code, ...(text ? { text } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: code });
  };
  const visiblePhase = () => evaluate(`Array.from(document.querySelectorAll('[data-phase-panel]')).filter(panel=>!panel.hidden&&getComputedStyle(panel).display!=='none').map(panel=>panel.id)`);
  const shown = () => evaluate(`(()=>{const p=document.querySelector('[data-phase-panel]:not([hidden])');return{phase:p.id,title:p.querySelector('[data-work-title]').textContent,maker:p.querySelector('[data-work-maker]').textContent,medium:p.querySelector('[data-work-medium]').textContent,image:p.querySelector('[data-main-image]').getAttribute('src'),alt:p.querySelector('[data-main-image]').alt,source:p.querySelector('[data-work-source]').getAttribute('href'),full:p.querySelector('[data-full-image]').getAttribute('href'),stay:p.querySelector('[data-work-stay]').getAttribute('href'),prompt:p.querySelector('[data-work-prompt]').textContent,affinity:p.querySelector('[data-work-affinity]').textContent,selected:Array.from(p.querySelectorAll('[data-work-choice][aria-current="true"]'),a=>a.dataset.workChoice)};})()`);
  const selected = async (phase, id = phaseById.get(phase).works[0]) => {
    const work = byId.get(id);
    await until(() => evaluate(`document.body.dataset.phase===${JSON.stringify(phase)}&&document.querySelector('#${phase} [data-work-title]').textContent===${JSON.stringify(work.title)}`), `selected ${phase}: ${id}`);
    await frames();
    assert.deepEqual(await visiblePhase(), [phase]);
    const actual = await shown();
    assert.equal(actual.image, work.image); assert.equal(actual.alt, work.alt);
    assert.equal(actual.source, work.source); assert.equal(actual.full, work.image);
    assert.deepEqual(actual.selected, [id]);
    assert.ok(actual.maker.includes(work.maker)); assert.ok(actual.medium.includes(work.medium));
    assert.ok(work.looking.includes(actual.prompt)); assert.ok(actual.affinity.trim());
    const stay = new URL(actual.stay, origin);
    assert.equal(stay.pathname, '/trip'); assert.equal(stay.searchParams.get('from'), 'elements');
    assert.equal(stay.searchParams.get('phase'), phase); assert.equal(stay.searchParams.get('work'), id);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#phase-nav [aria-current="true"]'),a=>a.dataset.phaseLink)`), [phase]);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-phase-panel]'),panel=>({id:panel.id,inert:panel.inert})).filter(panel=>panel.inert).map(panel=>panel.id)`), phases.filter(id => id !== phase));
    return actual;
  };
  const open = async suffix => {
    const url = origin + '/elements' + suffix;
    await evaluate(`history.replaceState(null,'',${JSON.stringify(url)});window.__beforeNavigation=true`);
    await send('Page.reload');
    await until(() => evaluate(`!window.__beforeNavigation&&document.readyState==='complete'&&!!document.querySelector('#phase-nav')&&document.querySelectorAll('[data-phase-panel]:not([hidden])').length===1`), 'enhanced phase gallery loads');
    await frames();
  };
  const targets = async () => {
    const state = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:Array.from(document.querySelectorAll('a,button,summary,select')).filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&(r.height<43.9||r.width<43.9);}).map(el=>({text:el.textContent.trim(),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))})`);
    assert.ok(state.scroll <= state.width + 1, `page fits ${state.width}px`);
    assert.deepEqual(state.bad, [], `visible targets are 44px at ${state.width}px`);
  };
  await load({ html, path: '/elements', route, init });
  await selected('wood');
  assert.equal(await evaluate('__audioCalls'), 0);
  await shot('five-phases-arrival-desktop');
  for (const phase of phases) {
    await click(`#phase-nav [data-phase-link="${phase}"]`);
    await selected(phase);
    for (const id of phaseById.get(phase).works) {
      await click(`#${phase} [data-work-choice="${id}"]`);
      await selected(phase, id);
      assert.equal(await evaluate('location.hash'), `#${phase}`);
      assert.equal(await evaluate(`new URLSearchParams(location.search).get('work')`), id);
    }
  }
  // Native keyboard activation remains at the originating phase link.
  await evaluate(`document.querySelector('#phase-nav [data-phase-link="wood"]').focus()`);
  await press('Enter', 13, '\r'); await selected('wood');
  assert.equal(await evaluate(`document.activeElement.dataset.phaseLink`), 'wood');
  assert.ok(await evaluate(`document.activeElement.matches(':focus-visible')&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2`));
  const woodSecond = phaseById.get('wood').works[1];
  await evaluate(`document.querySelector('#wood [data-work-choice="${woodSecond}"]').focus()`);
  await press('Enter', 13, '\r'); await selected('wood', woodSecond);
  assert.equal(await evaluate(`document.activeElement.dataset.workChoice`), woodSecond);
  await evaluate(`document.querySelector('#wood [data-phase-next]').focus()`);
  await press('Enter', 13, '\r'); await selected('fire');
  assert.equal(await evaluate(`document.activeElement===document.querySelector('#fire [data-phase-heading]')`), true, 'the next-phase action moves focus out of the panel being hidden');

  // The URL is a durable state; browser history also restores the exact work.
  await open(`?work=${woodSecond}#wood`); await selected('wood', woodSecond);
  await click('#phase-nav [data-phase-link="fire"]'); await selected('fire');
  await evaluate('history.back()'); await selected('wood', woodSecond);
  await evaluate('history.forward()'); await selected('fire');
  // Content anchors are native document navigation, independent of artwork choice.
  const metalFirst = phaseById.get('metal').works[0];
  await open(`?work=${metalFirst}#metal`); await selected('metal', metalFirst);
  const beforeContentLink = await shown();
  for (const selector of ['.intro-note a[href="#about-phases"]', '.skip[href="#elements-stage"]']) {
    const destination = await evaluate(`document.querySelector(${JSON.stringify(selector)}).hash`);
    await click(selector);
    await until(() => evaluate(`location.hash===${JSON.stringify(destination)}`), 'native content anchor is preserved');
    await frames();
    assert.deepEqual(await shown(), beforeContentLink, 'reading a content section keeps the selected artwork and phase');
    assert.equal(await evaluate('location.hash'), destination);
    await evaluate('history.back()');
    await until(() => evaluate(`location.hash==='#metal'`), 'back returns to the selected artwork address');
    await selected('metal', metalFirst);
  }
  for (const destination of ['#about-phases', '#elements-stage', '#main']) {
    await open(destination); await selected('wood');
    assert.equal(await evaluate('location.hash'), destination, 'an initial content fragment survives enhancement');
  }
  const shared = data.works.find(work => work.phases.length > 1);
  const [sharedFrom, sharedTo] = shared.phases;
  await open(`?work=${shared.id}#${sharedFrom}`); await selected(sharedFrom, shared.id);
  const sharedBefore = await shown();
  await click(`#${sharedFrom} [data-work-echo]`); await selected(sharedTo, shared.id);
  const sharedAfter = await shown();
  assert.equal(sharedAfter.image, sharedBefore.image, 'an echo keeps the same whole artwork');
  assert.notEqual(sharedAfter.affinity, sharedBefore.affinity, 'the shared artwork has a new phase-specific invitation');
  for (const phase of phases) {
    const id = phaseById.get(phase).works[2];
    await open(`?work=${id}#${phase}`); await selected(phase, id);
  }
  for (const suffix of ['#unknown', '?work=%3Cimg%20src=x%20onerror=alert(1)%3E#wood', '#wood%00', '#%E0%A4%A']) {
    await open(suffix); await selected('wood');
    assert.equal(await evaluate(`document.querySelectorAll('[onerror]').length`), 0);
  }
  await open('?work=not-a-work#water'); await selected('water');
  const wrongPhaseWork = data.works.find(work => !work.phases.includes('wood'));
  assert.ok(wrongPhaseWork);
  await open(`?work=${wrongPhaseWork.id}#wood`); await selected('wood');

  // Pending images cannot change captions or navigation before the artwork loads.
  await open(''); await selected('wood');
  const before = await shown(), beforeURL = await evaluate('location.href');
  await evaluate(`__imageControl.mode='hold'`);
  await click('#phase-nav [data-phase-link="fire"]');
  await until(() => evaluate('__imageControl.held.length===1'), 'the next phase image is held');
  assert.deepEqual(await shown(), before); assert.equal(await evaluate('location.href'), beforeURL);
  await click('#phase-nav [data-phase-link="earth"]'); await selected('earth');
  const after = await shown(), afterURL = await evaluate('location.href');
  await releaseHeldImage();
  assert.deepEqual(await shown(), after, 'a late image cannot replace the chosen phase');
  assert.equal(await evaluate('location.href'), afterURL);
  await evaluate(`__imageControl.mode='fail'`);
  await click('#phase-nav [data-phase-link="metal"]');
  await until(() => evaluate(`!document.querySelector('#elements-retry').hidden&&document.querySelector('#elements-status').textContent.trim().length>0`), 'failed image leaves a visible retry');
  assert.deepEqual(await shown(), after, 'image failure keeps the complete old work and its caption');
  assert.equal(await evaluate('location.href'), afterURL);
  await evaluate(`document.querySelector('#elements-retry').focus()`); await press('Enter', 13, '\r'); await selected('metal');
  assert.equal(await evaluate(`document.querySelector('#elements-retry').hidden`), true);
  assert.equal(await evaluate(`document.activeElement===document.querySelector('#metal [data-phase-heading]')`), true, 'successful retry leaves focus on the new phase heading');
  for (const leave of [`__setHidden(true)`, `dispatchEvent(new Event('pagehide'))`]) {
    const heldBefore = await shown();
    await evaluate(`__imageControl.mode='hold'`); await click('#phase-nav [data-phase-link="water"]');
    await until(() => evaluate('__imageControl.held.length===1'), 'a page-leave image is held');
    await evaluate(leave); await releaseHeldImage(); await evaluate('__setHidden(false)'); await frames();
    assert.deepEqual(await shown(), heldBefore, 'leaving cancels pending navigation without resuming it');
  }
  const historyBefore = await shown(), historyURL = await evaluate('location.href');
  await evaluate(`__imageControl.mode='hold';location.hash='#water'`);
  await until(() => evaluate('__imageControl.held.length===1'), 'native hash navigation waits for its image');
  await evaluate('__setHidden(true)'); await releaseHeldImage(); await evaluate('__setHidden(false)'); await frames();
  assert.deepEqual(await shown(), historyBefore, 'cancelled history navigation keeps the displayed work');
  assert.equal(await evaluate('location.href'), historyURL, 'cancelled history navigation restores a truthful address');
  await evaluate(`__imageControl.mode='hold'`); await click('#phase-nav [data-phase-link="fire"]');
  await until(() => evaluate('__imageControl.held.length===1'), 'an artwork request is pending before reading about the phases');
  await click('.intro-note a[href="#about-phases"]');
  await until(() => evaluate(`location.hash==='#about-phases'`), 'content anchor takes precedence over pending artwork navigation');
  await releaseHeldImage();
  assert.deepEqual(await shown(), historyBefore, 'the abandoned image cannot change the artwork after a content link');
  assert.equal(await evaluate('location.hash'), '#about-phases', 'cancellation preserves the requested content fragment');

  for (const width of [320, 390, 601, 768, 1024, 1440]) {
    await viewport(width, 900, width < 600);
    for (const phase of phases) {
      await click(`#phase-nav [data-phase-link="${phase}"]`); await selected(phase);
      for (const selector of ['#phase-nav', `#${phase} [data-main-image]`, `#${phase} [data-phase-next]`]) {
        await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`); await targets();
      }
      const image = await evaluate(`(()=>{const image=document.querySelector('#${phase} [data-main-image]'),r=image.getBoundingClientRect();return{fit:getComputedStyle(image).objectFit,loaded:image.complete&&image.naturalWidth>0,width:r.width,height:r.height,left:r.left,right:r.right};})()`);
      assert.equal(image.fit, 'contain'); assert.ok(image.loaded && image.width > 100 && image.height > 100);
      assert.ok(image.left >= -1 && image.right <= width + 1);
      if (width === 390 && phase === 'water') await shot('water-mobile');
      if (width === 320 && phase === 'wood') {
        await evaluate(`document.querySelector('#phase-nav').scrollIntoView({block:'start',behavior:'instant'})`); await shot('five-phase-navigation-320');
        await shot('wood-panel-320', '#wood');
      }
    }
  }
  await viewport(1440, 1000); await click('#phase-nav [data-phase-link="metal"]'); await selected('metal');
  await evaluate(`scrollTo({top:0,behavior:'instant'})`); await shot('metal-desktop');
  await shot('metal-panel-desktop', '#metal');
  await click('#phase-nav [data-phase-link="fire"]'); await selected('fire'); await shot('fire-panel-desktop', '#fire');
  await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await click('#phase-nav [data-phase-link="water"]'); await selected('water');
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).scrollBehavior`), 'auto');
  assert.equal(await evaluate(`document.getAnimations().filter(animation=>animation.playState==='running').length`), 0);
  assert.equal(await evaluate('__audioCalls'), 0);

  // The same work arrives in the quiet room, still, with a validated return path.
  const tripOpen = async suffix => {
    await evaluate(`history.replaceState(null,'',${JSON.stringify(origin + '/trip' + suffix)});window.__beforeNavigation=true`);
    await send('Page.reload');
    await until(() => evaluate(`!window.__beforeNavigation&&document.readyState==='complete'&&!!document.querySelector('#trip-breath-host')?.breathing`), 'quiet room loads');
  };
  const contextWork = data.works.find(work => work.phases.length === 1) || data.works[0];
  const contextPhase = contextWork.phases[0];
  const tripContext = async phase => {
    await tripOpen(`?from=elements&phase=${phase}&work=${contextWork.id}`);
    await until(() => evaluate(`document.querySelector('#trip-stage')?.dataset.work===${JSON.stringify(contextWork.id)}`), 'the elemental artwork arrives in the quiet room');
    assert.equal(await evaluate('document.body.dataset.drifting'), 'false');
    assert.equal(await evaluate(`document.querySelector('#trip-return').getAttribute('href')`), `/elements?work=${contextWork.id}#${contextPhase}`);
    assert.equal(await evaluate('__audioCalls'), 0);
  };
  await tripContext(contextPhase);
  await tripContext('not-a-phase');
  await tripContext('https%3A%2F%2Fexample.com');
  await tripOpen(`?from=elements&phase=${sharedTo}&work=${shared.id}`);
  await until(() => evaluate(`document.querySelector('#trip-stage')?.dataset.work===${JSON.stringify(shared.id)}`), 'shared artwork handoff loads');
  assert.equal(await evaluate(`document.querySelector('#trip-return').getAttribute('href')`), `/elements?work=${shared.id}#${sharedTo}`, 'a shared work returns to the valid phase the visitor chose');
  manifestMode = 'failed';
  await tripOpen(`?from=elements&phase=${contextPhase}&work=${contextWork.id}`);
  await until(() => evaluate(`/could not be opened/i.test(document.querySelector('#trip-entry-status').textContent)`), 'missing elemental catalogue has an honest fallback');
  assert.equal(await evaluate('document.body.dataset.mode'), 'entry'); manifestMode = 'normal';
  manifestMode = 'held'; releaseManifest = null;
  await tripOpen(`?from=elements&phase=${contextPhase}&work=${contextWork.id}`);
  await until(() => Boolean(releaseManifest), 'elemental handoff catalogue is held');
  await click('#trip-just-breathe');
  await until(() => evaluate(`document.body.dataset.practice==='breathe'&&!!document.querySelector('#trip-stage .is-current img')?.naturalWidth&&!document.querySelector('#trip-next').disabled`), 'visitor starts their own breath');
  const manualWork = await evaluate(`document.querySelector('#trip-stage').dataset.work`);
  releaseManifest(); manifestMode = 'normal'; await frames(); await frames();
  assert.equal(await evaluate('document.body.dataset.practice'), 'breathe');
  assert.equal(await evaluate(`document.querySelector('#trip-stage').dataset.work`), manualWork);

  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await load({ html, path: '/elements', route });
  assert.deepEqual(await visiblePhase(), phases, 'all five chapters remain readable without JavaScript');
  assert.equal(await evaluate(`document.querySelectorAll('[data-work-choice]').length`), 15);
  const staticChoices = await evaluate(`Array.from(document.querySelectorAll('[data-work-choice]'),a=>({id:a.dataset.workChoice,href:a.getAttribute('href')}))`);
  for (const choice of staticChoices) assert.equal(choice.href, byId.get(choice.id).image, 'a no-script artwork link opens the whole image');
  await viewport(320, 900, true);
  for (const phase of phases) {
    await evaluate(`document.getElementById('${phase}').scrollIntoView({block:'start',behavior:'instant'})`); await targets();
    assert.ok(await evaluate(`document.querySelector('#${phase} [data-main-image]').getBoundingClientRect().height>100`));
  }
  await shot('five-phases-nojs-320');
  assert.ok(!requests.some(request => /\/api\/|\.(?:mp3|wav)(?:$|\?)/.test(new URL(request.url).pathname)), 'no API writes, tracking or sound requests');
  assert.ok(requests.every(request => new URL(request.url).origin === origin), 'all served artwork and code is local');
  console.log('elements browser passed: fifteen choices, atomic phase/work navigation, history and malformed URLs, cancellation/failure/retry, keyboard focus, 320–1440px, reduced motion, still quiet-room handoff and full no-JavaScript reading');
});
