// A visit is usable as a document; movement, viewers, and sound add optional layers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { withBrowser, until } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('visit.html', root), 'utf8');
const script = readFileSync(new URL('visit.js', root), 'utf8');
const rooms = [
  { id: 'water', name: 'By the water', image: 'assets/welcome/seurat.jpg', source: '27992', title: 'A Sunday on La Grande Jatte — 1884', maker: 'Georges Seurat · 1884–86' },
  { id: 'dusk', name: 'After dusk', image: 'assets/welcome/moonrise.jpg', source: '64754', title: 'Moonrise', maker: 'George Inness · 1891' },
  { id: 'form', name: 'A quiet form', image: 'assets/welcome/moon-jar.jpg', source: '158472', title: 'Moon Jar', maker: 'Korea · Joseon dynasty' },
  { id: 'poems', name: 'Among poems', image: 'assets/welcome/maples.jpg', source: '127644', title: 'Autumn Maples with Poem Slips', maker: 'Tosa Mitsuoki · c. 1675' },
  { id: 'colour', name: 'Colour in motion', image: 'assets/guide/kandinsky.jpg', source: '8991', title: 'Improvisation No. 30 (Cannons)', maker: 'Vasily Kandinsky · 1913' },
];
const credits = JSON.parse(readFileSync(new URL('assets/visit/credits.json', root), 'utf8'));
assert.equal(credits.length, 10, 'ten companion works have recorded credits');
for (const credit of credits) {
  assert.ok(rooms.some(room => room.id === credit.room), `${credit.id} belongs to an existing room`);
  assert.match(credit.file, /^[a-z0-9-]+\.jpg$/);
  assert.equal(credit.url, `https://www.artic.edu/artworks/${credit.museum_id}`);
  assert.equal(credit.license, 'CC0');
  assert.equal(credit.is_public_domain, true);
  assert.ok(credit.display_title && credit.artist && credit.date && credit.alt && credit.width > 0 && credit.height > 0, `${credit.id} has complete display metadata`);
}
for (const room of rooms) {
  const companions = credits.filter(credit => credit.room === room.id);
  assert.equal(companions.length, 2, `${room.id} has two companions`);
  room.works = [{ ...room, room: room.id }, ...companions.map(credit => ({
    id: credit.id, room: credit.room, image: `assets/visit/${credit.file}`,
    title: credit.display_title, maker: `${credit.artist} · ${credit.date}`,
    source: String(credit.museum_id), alt: credit.alt, width: credit.width, height: credit.height,
  }))];
}
const works = rooms.flatMap(room => room.works);
assert.equal(new Set(works.map(work => work.id)).size, 15, 'all artwork identifiers are unique');
for (const file of ['visit.html', 'visit.css', 'visit.js', 'assets/visit/credits.json', ...works.map(work => work.image)]) {
  assert.deepEqual(readFileSync(new URL(file, root)), readFileSync(new URL(`dist/${file}`, root)), `${file} deploy mirror`);
}
assert.equal((html.match(/class="gallery-room\b/g) || []).length, 5);
for (const room of rooms) {
  assert.ok(html.includes(`id="${room.id}"`), `${room.id} is a real section`);
  assert.ok(html.includes(`href="#${room.id}-companions"`), `${room.id} leads to its companions`);
}
for (const work of works) {
  assert.ok(html.includes(`data-art="${work.id}"`), `${work.id} has an opener`);
  assert.ok(html.includes(`src="${work.image}"`), `${work.id} has local art`);
  assert.ok(html.includes(`href="https://www.artic.edu/artworks/${work.source}"`), `${work.id} retains its museum source`);
  assert.ok(html.includes(`href="${work.image}"`), `${work.id} offers a direct-image fallback`);
}
assert.match(html, /Art helps us feel, understand, and connect/);
assert.equal((html.match(/class="room-companions"/g) || []).length, 5);
assert.equal((html.match(/class="exhibit companion-exhibit"/g) || []).length, 10);
assert.equal((html.match(/<details class="museum-note">/g) || []).length, 15);
assert.equal((html.match(/class="museum-source"/g) || []).length, 15);
assert.doesNotMatch(html, /<audio[^>]*autoplay|<video[^>]*autoplay/i);
assert.equal((html.match(/<audio\b/g) || []).length, 1, 'one shared soundtrack player');
assert.match(html, /<audio\b[^>]*id="gallery-soundtrack"/);
assert.match(html, /src="assets\/audio\/rooms-of-light\.mp3"/);
new Script(script);
assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage)\b/);
assert.doesNotMatch(script, /\bnew\s+(?:window\.)?(?:AudioContext|webkitAudioContext)\b|\bcreateOscillator\s*\(/, 'the local soundtrack replaces realtime synthesis');
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));
console.log('visit static checks passed: five rooms, fifteen works and museum notes, ten companion credits, local images, direct-image fallbacks, deploy mirrors');
if (!process.argv.includes('--browser')) process.exit(0);

const fixtures = new Set(['visit.css', 'visit.js', 'breathing.css', 'breathing.js', ...works.map(work => work.image)]);
const route = url => {
  const path = url.pathname.slice(1);
  if (!fixtures.has(path)) return null;
  return { type: path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'image/jpeg', body: readFileSync(new URL(path, root)) };
};

// Media lifecycle is controlled without decoding or output. A separate test
// checks the real MP3 and a muted native player. Drift timers stay deterministic.
const init = `(() => {
  const audio = window.__audio = { playCalls:0, pauseCalls:0, mode:'resolve', pending:[], callsInGesture:[] };
  const states=new WeakMap(), state=el=>{if(!states.has(el))states.set(el,{paused:true,time:0});return states.get(el);};
  Object.defineProperty(HTMLMediaElement.prototype,'paused',{configurable:true,get(){return state(this).paused;}});
  Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{configurable:true,get(){return state(this).time;},set(value){state(this).time=value;}});
  let inClick=false;
  document.addEventListener('click',()=>{inClick=true;queueMicrotask(()=>{inClick=false;});},true);
  HTMLMediaElement.prototype.play=function(){
    audio.playCalls++;audio.callsInGesture.push(inClick);
    if(audio.mode==='reject')return Promise.reject(new DOMException('Playback denied for test','NotAllowedError'));
    state(this).paused=false;this.dispatchEvent(new Event('play'));
    if(audio.mode==='pending')return new Promise((resolve,reject)=>audio.pending.push({resolve,reject,element:this}));
    return Promise.resolve().then(()=>{if(!state(this).paused)this.dispatchEvent(new Event('playing'));});
  };
  HTMLMediaElement.prototype.pause=function(){
    audio.pauseCalls++;
    if(!state(this).paused){state(this).paused=true;this.dispatchEvent(new Event('pause'));}
  };
  window.__resolvePlay=()=>{const next=audio.pending.shift();if(!next)throw new Error('No pending play');next.resolve();};
  window.AudioContext=window.webkitAudioContext=class{constructor(){throw new Error('The soundtrack must not create a realtime AudioContext');}};
  window.__setHidden = hidden => {
    Object.defineProperty(document, 'hidden', { configurable:true, get:()=>hidden });
    Object.defineProperty(document, 'visibilityState', { configurable:true, get:()=>hidden?'hidden':'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const set = window.setTimeout.bind(window), clear = window.clearTimeout.bind(window);
  const timers = window.__driftTimers = new Map();
  window.setTimeout = (callback, delay, ...args) => {
    const id = set(() => { timers.delete(id); callback(...args); }, delay);
    if (delay === 45000) timers.set(id, () => callback(...args));
    return id;
  };
  window.clearTimeout = id => { timers.delete(id); clear(id); };
  window.__fireDrift = () => {
    const first = timers.entries().next().value;
    if (!first) throw new Error('No active drift timer');
    const [id, callback] = first; window.clearTimeout(id); callback();
  };
})();`;

await withBrowser('visit', async b => {
  const { load, evaluate, viewport, media, send, click, shot, requests } = b;
  const keypress = async (key, code, physicalKey = key) => {
    await send('Input.dispatchKeyEvent', { type:'keyDown', key, code:physicalKey, windowsVirtualKeyCode:code });
    await send('Input.dispatchKeyEvent', { type:'keyUp', key, code:physicalKey, windowsVirtualKeyCode:code });
  };
  const active = id => until(() => evaluate(`document.body.dataset.room === ${JSON.stringify(id)} && document.querySelector('.gallery-room.is-active')?.id === ${JSON.stringify(id)} && document.querySelector('.room-stops [aria-current="location"]')?.getAttribute('href') === ${JSON.stringify('#' + id)}`), `active room becomes ${id}`);
  const imageLoaded = selector => until(() => evaluate(`document.querySelector(${JSON.stringify(selector)})?.naturalWidth > 0`), `${selector} image loads`);
  const navigate = async id => { await click(`.room-stops a[href="#${id}"]`); await active(id); };
  const openerFor = work => `.artwork-view[data-art="${work.id}"]`;
  const exhibitFor = work => `.exhibit:has(> ${openerFor(work)})`;
  const reveal = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  const layout = async label => {
    const state = await evaluate(`({width:innerWidth, contentWidth:document.documentElement.scrollWidth, smallControls:Array.from(document.querySelectorAll('a,button,input,summary')).filter(el=>{const rect=el.getBoundingClientRect(); return el.getClientRects().length && getComputedStyle(el).visibility!=='hidden' && rect.bottom>0 && rect.top<innerHeight && rect.right>0 && rect.left<innerWidth;}).filter(el=>{const rect=el.getBoundingClientRect();return rect.height<43.9 || rect.width<43.9;}).map(el=>({tag:el.tagName,text:el.textContent.trim().slice(0,70),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))})`);
    assert.ok(state.contentWidth <= state.width + 1, `${label}: overflow ${state.contentWidth}/${state.width}`);
    assert.deepEqual(state.smallControls, [], `${label}: controls have at least 44px width and height`);
  };
  const closeDialog = async (id, opener, escape = false) => {
    if (escape) await keypress('Escape', 27);
    else await click(`#${id} .dialog-close`);
    await until(() => evaluate(`!document.getElementById(${JSON.stringify(id)}).open && document.activeElement === document.querySelector(${JSON.stringify(opener)})`), `${id} closes and restores focus`);
  };
  const viewerState = async (room, index) => {
    const work = room.works[index];
    await imageLoaded('#viewer-image');
    assert.deepEqual(await evaluate(`({
      open:document.querySelector('#art-viewer').open,
      title:document.querySelector('#viewer-title').textContent,
      maker:document.querySelector('#viewer-maker').textContent.trim(),
      image:new URL(document.querySelector('#viewer-image').src).pathname,
      source:document.querySelector('#viewer-source').getAttribute('href'),
      position:document.querySelector('#viewer-position').textContent,
      previousDisabled:document.querySelector('#viewer-previous').disabled,
      nextDisabled:document.querySelector('#viewer-next').disabled
    })`), {
      open:true, title:work.title, maker:work.maker, image:`/${work.image}`,
      source:`https://www.artic.edu/artworks/${work.source}`,
      position:`${room.name} · ${index + 1} of 3`, previousDisabled:index === 0, nextDisabled:index === 2,
    }, `${work.id}: viewer metadata, room position, and bounds`);
    assert.equal(await evaluate(`document.querySelector('#viewer-image').alt === document.querySelector(${JSON.stringify(openerFor(work) + ' img')}).alt`), true, `${work.id}: viewer retains image description`);
  };

  await media([{ name:'prefers-reduced-motion', value:'no-preference' }]);
  await load({ html, route, init });
  await imageLoaded('#water .artwork');
  await active('water');
  assert.equal(await evaluate('window.__audio.playCalls'), 0, 'arrival never starts audio');
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed')`), 'false');
  assert.equal(await evaluate(`document.querySelector('#sound-label').textContent`), 'Play music');
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').paused`), true);
  assert.equal(await evaluate(`document.querySelector('.volume-control').hidden`), true);
  await layout('desktop arrival');
  await shot('desktop-arrival');

  const driftState = async on => {
    assert.equal(await evaluate(`document.querySelector('#drift-toggle').getAttribute('aria-pressed')`), String(on));
    assert.equal(await evaluate('__driftTimers.size'), on ? 1 : 0, 'drift owns exactly one timer only while active');
  };
  await driftState(false);
  assert.equal(await evaluate('document.body.dataset.motion'), 'on');
  assert.ok(await evaluate(`document.getAnimations().some(animation => animation.playState === 'running')`), 'motion mode animates the room atmosphere');
  await click('#motion-toggle');
  assert.equal(await evaluate('document.body.dataset.motion'), 'off');
  assert.equal(await evaluate(`document.querySelector('#motion-toggle').getAttribute('aria-pressed')`), 'false');
  await click('#motion-toggle');
  assert.equal(await evaluate('document.body.dataset.motion'), 'on');
  await click('#drift-toggle');
  await driftState(true);
  await evaluate('__fireDrift()');
  await active('dusk');
  assert.equal(await evaluate('location.hash'), '#dusk');
  await driftState(true);
  await click('#drift-toggle');
  await driftState(false);

  // A touch or Space on the active toggle must pause, not restart, the drift.
  await click('#drift-toggle');
  await evaluate(`document.querySelector('#drift-toggle').dispatchEvent(new Event('touchstart',{bubbles:true}))`);
  await click('#drift-toggle');
  await driftState(false);
  await click('#drift-toggle');
  await evaluate(`document.querySelector('#drift-toggle').focus()`);
  await keypress(' ', 32, 'Space');
  await driftState(false);

  await click('#drift-toggle');
  await navigate('form');
  await driftState(false);
  await click('#drift-toggle');
  await send('Input.dispatchMouseEvent', { type:'mouseWheel', x:100, y:300, deltaX:0, deltaY:160 });
  await until(() => evaluate(`document.querySelector('#drift-toggle').getAttribute('aria-pressed') === 'false'`), 'manual wheel movement pauses drift');
  await driftState(false);
  await click('#drift-toggle');
  await evaluate('__setHidden(true)');
  await driftState(false);
  await evaluate('__setHidden(false)');
  await driftState(false);
  await navigate('colour');
  await click('#drift-toggle');
  await active('water');
  await driftState(true);
  await click('#drift-toggle');
  await navigate('poems');
  await click('#drift-toggle');
  await evaluate('__fireDrift()');
  await active('colour');
  await evaluate('__fireDrift()');
  await driftState(false);
  assert.match(await evaluate(`document.querySelector('#drift-status').textContent`), /last room/);

  // Normal anchors and the room-map dialog lead to the same five real rooms.
  await media([{ name:'prefers-reduced-motion', value:'reduce' }]);
  assert.equal(await evaluate('document.body.dataset.motion'), 'off');
  assert.equal(await evaluate(`document.querySelector('#motion-toggle').disabled && document.querySelector('#drift-toggle').disabled`), true);
  assert.ok(await evaluate(`document.getAnimations().every(animation => animation.playState !== 'running')`), 'reduced motion stops animation');
  await driftState(false);
  await navigate('dusk');
  await imageLoaded('#dusk .artwork');
  await shot('desktop-dusk');
  await click('#room-map-toggle');
  assert.equal(await evaluate(`document.querySelector('#room-map').open`), true);
  assert.equal(await evaluate(`document.activeElement.matches('#room-map .dialog-close')`), true);
  await closeDialog('room-map', '#room-map-toggle', true);
  await click('#room-map-toggle');
  await closeDialog('room-map', '#room-map-toggle');
  await click('#room-map-toggle');
  await click('[data-map-room="2"]');
  await active('form');
  assert.equal(await evaluate(`document.querySelector('#room-map').open`), false);
  assert.equal(await evaluate('document.activeElement.id'), 'form');
  await imageLoaded('#form .artwork');
  await shot('desktop-object-room');

  for (const [index, room] of rooms.entries()) {
    await navigate(room.id);
    assert.equal(await evaluate(`document.querySelector('#room-count').textContent`), `${String(index + 1).padStart(2, '0')} / 05`);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#${room.id} .artwork-view'),link=>link.dataset.art)`), room.works.map(work => work.id), `${room.id}: original then two companions`);
    assert.equal(await evaluate(`document.querySelectorAll('#${room.id} > .room-inner > .room-companions > .companion-grid > .companion-exhibit').length`), 2);
    assert.equal(await evaluate(`document.querySelector('#${room.id} .companions-footer a').getAttribute('href')`), index < 4 ? `#${rooms[index + 1].id}` : '#between-works');
    for (const [workIndex, work] of room.works.entries()) {
      const exhibit = exhibitFor(work), opener = openerFor(work), note = `${exhibit} .museum-note`;
      await reveal(opener);
      await imageLoaded(`${opener} img`);
      await click(`${note} summary`);
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(note)}).open`), true);
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(note + ' .museum-source')}).getAttribute('href')`), `https://www.artic.edu/artworks/${work.source}`);
      assert.ok(await evaluate(`document.querySelector(${JSON.stringify(note + ' .note-body')}).innerText.length > 100`), `${work.id}: museum note is available`);
      if (work.alt) {
        assert.deepEqual(await evaluate(`(() => {const image=document.querySelector(${JSON.stringify(opener + ' img')});return {alt:image.alt,width:image.naturalWidth,height:image.naturalHeight};})()`), {alt:work.alt,width:work.width,height:work.height}, `${work.id}: credited image and dimensions`);
      }
      await click(`${note} summary`);
      await click(opener);
      await viewerState(room, workIndex);
      assert.equal(await evaluate(`document.activeElement.matches('#art-viewer .dialog-close')`), true);
      if (workIndex === 0) {
        // Each room is a bounded group of three. Buttons and arrow keys agree.
        await click('#viewer-previous');
        await keypress('ArrowLeft', 37);
        await viewerState(room, 0);
        await click('#viewer-next');
        await viewerState(room, 1);
        await evaluate(`document.querySelector('#viewer-next').focus()`);
        await keypress(' ', 32, 'Space');
        await viewerState(room, 2);
        assert.equal(await evaluate(`document.activeElement.id`), 'viewer-previous', 'the enabled button receives focus at the last work');
        await click('#viewer-next');
        await keypress('ArrowRight', 39);
        await viewerState(room, 2);
        await keypress('ArrowLeft', 37);
        await viewerState(room, 1);
        await keypress(' ', 32, 'Space');
        await viewerState(room, 0);
        assert.equal(await evaluate(`document.activeElement.id`), 'viewer-next', 'the enabled button receives focus at the first work');
        await keypress('ArrowRight', 39);
        await viewerState(room, 1);
        await keypress('ArrowLeft', 37);
        await viewerState(room, 0);
        // Return from another work must still focus the link that opened the dialog.
        await click('#viewer-next');
        await viewerState(room, 1);
      }
      await closeDialog('art-viewer', opener, (index + workIndex) % 2 === 0);
      const closedTitle = await evaluate(`document.querySelector('#viewer-title').textContent`);
      await keypress('ArrowRight', 39);
      assert.equal(await evaluate(`document.querySelector('#viewer-title').textContent`), closedTitle, 'arrow navigation is scoped to the open viewer');
      assert.equal(await evaluate(`document.querySelector('#art-viewer').open`), false);
    }
    if (room.id === 'water' || room.id === 'poems') await shot(`desktop-${room.id}-companions`, `#${room.id}-companions`);
  }
  assert.equal(await evaluate('window.__audio.playCalls'), 0, 'navigation, notes, and viewers never start sound');
  assert.ok(!requests.some(request=>new URL(request.url).pathname.endsWith('.mp3')), 'the soundtrack is not requested before Play');

  // The one native player starts synchronously inside the gesture and keeps its
  // position while wandering. Header and native media controls share state.
  await click('#sound-toggle');
  await until(() => evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed') === 'true'`), 'sound starts by choice');
  assert.equal(await evaluate('__audio.playCalls'), 1);
  assert.equal(await evaluate('__audio.callsInGesture[0]'), true, 'play runs within the original click handler');
  assert.equal(await evaluate(`document.querySelector('#sound-label').textContent`), 'Pause music');
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').volume`), .65);
  assert.equal(await evaluate(`document.querySelector('.volume-control').hidden`), false);
  await evaluate(`document.querySelector('#gallery-soundtrack').currentTime=23`);
  await navigate('dusk');
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').currentTime`), 23, 'room changes preserve the soundtrack position');
  assert.equal(await evaluate('__audio.playCalls'), 1, 'room changes do not start a second player');
  await evaluate(`const volume=document.querySelector('#sound-volume'); volume.value='12'; volume.dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').volume`), .12, 'volume input changes the real media property');
  await click('#sound-toggle');
  await until(() => evaluate(`document.querySelector('#gallery-soundtrack').paused`), 'switching sound off pauses audio');
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed')`), 'false');
  await evaluate(`document.querySelector('#gallery-soundtrack').play()`);
  await until(() => evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed') === 'true'`), 'native playback updates the header');
  await evaluate(`document.querySelector('#gallery-soundtrack').dispatchEvent(new Event('waiting'))`);
  assert.match(await evaluate(`document.querySelector('#sound-status').textContent`), /loading/i);
  await evaluate(`document.querySelector('#gallery-soundtrack').pause()`);
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed')`), 'false', 'native pause updates the header');
  assert.doesNotMatch(await evaluate(`document.querySelector('#sound-status').textContent`), /loading|is playing/i, 'native pause clears stale buffering/playing messages');
  await click('#sound-toggle');
  const pauseCount = await evaluate('__audio.pauseCalls');
  await evaluate('__setHidden(true)');
  await until(() => evaluate(`__audio.pauseCalls > ${pauseCount} && document.querySelector('#sound-toggle').getAttribute('aria-pressed') === 'false' && document.querySelector('#gallery-soundtrack').paused`), 'hidden page stops sound');
  const playCount = await evaluate('__audio.playCalls');
  await evaluate('__setHidden(false)');
  assert.equal(await evaluate('__audio.playCalls'), playCount, 'returning to the page does not restart sound');
  await click('#sound-toggle');
  await evaluate(`window.dispatchEvent(new Event('pagehide'))`);
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').paused`), true, 'pagehide also pauses audio');

  // A cancelled or superseded loading promise must not revive playback later.
  await evaluate(`__audio.mode='pending'`);
  await click('#sound-toggle');
  assert.equal(await evaluate('__audio.pending.length'), 1);
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').disabled`), false, 'loading remains cancellable');
  assert.match(await evaluate(`document.querySelector('#sound-status').textContent`), /loading/i);
  await click('#sound-toggle');
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').paused`), true);
  await evaluate('__resolvePlay()');
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed')`), 'false', 'late play resolution cannot undo cancellation');
  await click('#sound-toggle');
  await evaluate('__setHidden(true)');
  await evaluate('__resolvePlay()');
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').paused`), true, 'hidden while loading stays paused after resolution');
  await evaluate('__setHidden(false)');
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed')`), 'false');

  await click('#sound-toggle');
  await evaluate(`document.querySelector('#gallery-soundtrack').pause()`);
  assert.doesNotMatch(await evaluate(`document.querySelector('#sound-status').textContent`), /loading/i, 'native pause during the initial request clears loading');
  await evaluate('__resolvePlay()');
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').paused`), true, 'late resolution after native pause stays paused');

  await click('#sound-toggle');
  await click('#sound-toggle');
  await click('#sound-toggle');
  assert.equal(await evaluate('__audio.pending.length'), 2, 'a new request can start while the cancelled promise is unresolved');
  await evaluate('__resolvePlay()');
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').paused`), false, 'an old resolution cannot stop the newer request');
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed')`), 'true');
  await evaluate('__resolvePlay()');
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').paused`), false);
  await click('#sound-toggle');

  await evaluate(`__audio.mode='reject'`);
  await click('#sound-toggle');
  await until(() => evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed') === 'false' && !document.querySelector('#sound-toggle').disabled`), 'play rejection restores a usable button');
  assert.match(await evaluate(`document.querySelector('#sound-status').textContent`), /could not|unable|failed|couldn.t/i);
  assert.ok(await evaluate(`(() => {const status=document.querySelector('#sound-status'),rect=status.getBoundingClientRect();return !status.hidden && getComputedStyle(status).visibility!=='hidden' && rect.width>1 && rect.height>1 && !status.classList.contains('sr-only');})()`), 'playback failure is visible');
  await evaluate(`__audio.mode='resolve'`);
  await click('#sound-toggle');
  await evaluate(`document.querySelector('#gallery-soundtrack').dispatchEvent(new Event('error'))`);
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed')`), 'false', 'media load/decode error clears the playing state');
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').paused`), true);
  assert.match(await evaluate(`document.querySelector('#sound-status').textContent`), /could not|unable|failed|couldn.t/i);
  const errorGuidance = await evaluate(`document.querySelector('#sound-status').textContent`);
  await evaluate(`document.querySelector('#gallery-soundtrack').dispatchEvent(new Event('pause'))`);
  assert.equal(await evaluate(`document.querySelector('#sound-status').textContent`), errorGuidance, 'the later native pause event preserves load/decode error guidance');

  for (const width of [320, 390, 768, 1440]) {
    await viewport(width, 900, width < 600);
    await navigate('water');
    await layout(`arrival at ${width}px`);
    if (width === 390) {
      await shot('mobile-arrival');
      await shot('mobile-first-room', '#water');
      await click('#room-map-toggle');
      await layout('mobile room map');
      await closeDialog('room-map', '#room-map-toggle');
      await click('#water .artwork-view');
      await imageLoaded('#viewer-image');
      await layout('mobile artwork viewer');
      await closeDialog('art-viewer', '#water .artwork-view', true);
    }
    for (const room of rooms) {
      for (const work of room.works.slice(1)) {
        const exhibit = exhibitFor(work), opener = openerFor(work), note = `${exhibit} .museum-note`;
        await reveal(opener);
        await imageLoaded(`${opener} img`);
        await active(room.id);
        await layout(`${work.id} at ${width}px`);
        assert.ok(await evaluate(`(() => {const rect=document.querySelector(${JSON.stringify(exhibit)}).getBoundingClientRect();return rect.left >= 0 && rect.right <= innerWidth + 1;})()`), `${work.id}: companion fits at ${width}px`);
        await click(`${note} summary`);
        await reveal(`${note} .museum-source`);
        await layout(`${work.id} open note at ${width}px`);
        await click(`${note} summary`);
      }
    }
    if (width === 390) {
      await shot('mobile-water-companions', '#water-companions');
      const work = rooms[2].works[1], opener = openerFor(work);
      await reveal(opener);
      await click(opener);
      await viewerState(rooms[2], 1);
      await layout('mobile companion viewer');
      await shot('mobile-companion-viewer');
      await closeDialog('art-viewer', opener, true);
    }
  }

  await send('Emulation.setScriptExecutionDisabled', { value:true });
  await load({ html, route });
  assert.equal(await evaluate(`document.querySelectorAll('.gallery-room').length`), 5);
  assert.equal(await evaluate(`document.querySelectorAll('.gallery-room .museum-source').length`), 15);
  assert.equal(await evaluate(`document.querySelectorAll('.companion-exhibit').length`), 10);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.gallery-room')).every(room=>getComputedStyle(room).display!=='none' && getComputedStyle(room).visibility!=='hidden')`));
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('#room-map-toggle').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('#motion-toggle').hidden && document.querySelector('#drift-toggle').hidden`), true);
  await click('.soundtrack-card summary');
  assert.ok(await evaluate(`(() => {const player=document.querySelector('#gallery-soundtrack');return player.controls && player.preload==='none' && player.loop && !player.autoplay && player.getClientRects().length>0;})()`), 'without JavaScript the native soundtrack controls remain available');
  assert.ok(!requests.some(request=>new URL(request.url).pathname.endsWith('.mp3')), 'opening soundtrack details does not fetch or play the file');
  await click('.soundtrack-card summary');
  await viewport(320, 900, true);
  await click('.room-stops a[href="#poems"]');
  await until(() => evaluate(`location.hash === '#poems'`), 'no-JavaScript room anchors work');
  await click('#poems .museum-note summary');
  assert.equal(await evaluate(`document.querySelector('#poems .museum-note').open`), true);
  await layout('no-JavaScript notes at 320px');
  for (const room of rooms) {
    await click(`#${room.id} .room-copy .wander-link`);
    await until(() => evaluate(`location.hash === ${JSON.stringify('#' + room.id + '-companions')}`), `no-JavaScript ${room.id} companion invitation works`);
    for (const work of room.works.slice(1)) {
      const exhibit = exhibitFor(work), opener = openerFor(work), note = `${exhibit} .museum-note`;
      await reveal(opener);
      await imageLoaded(`${opener} img`);
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(opener)}).getAttribute('href')`), work.image);
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(exhibit + ' cite')}).textContent`), work.title);
      await click(`${note} summary`);
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(note)}).open`), true);
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(note + ' .museum-source')}).getAttribute('href')`), `https://www.artic.edu/artworks/${work.source}`);
      await reveal(`${note} .museum-source`);
      await layout(`${work.id}: no-JavaScript note at 320px`);
    }
  }
  const fallback = rooms[3].works[2];
  await click(openerFor(fallback));
  await until(() => evaluate(`location.pathname === ${JSON.stringify('/' + fallback.image)} && document.querySelector('img')?.naturalWidth > 0`), 'no-JavaScript companion link opens its full image');
  assert.ok(requests.every(request => new URL(request.url).origin === 'http://127.0.0.1:48179'), 'visit never requests an external origin');
  console.log('visit browser passed: five rooms and fifteen artworks, bounded viewer buttons/arrows + focus return, all museum notes, companion layout at 320–1440px, no-JavaScript companion navigation/images, opt-in drift + manual/hidden stops, touch/Space pause, reduced motion, and opt-in sound + hidden stop');
});
