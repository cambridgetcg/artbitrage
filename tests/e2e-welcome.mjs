import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { withBrowser, until } from './helpers/browser.mjs';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const welcomeScript = await readFile(new URL('welcome.js', root), 'utf8');
const visit = await readFile(new URL('visit.html', root), 'utf8');
const arrivals = [
  { id:'water', image:'assets/welcome/seurat.jpg', title:'A Sunday on La Grande Jatte — 1884', maker:'Georges Seurat · 1884–86', source:'27992' },
  { id:'dusk', image:'assets/welcome/moonrise.jpg', title:'Moonrise', maker:'George Inness · 1891', source:'64754' },
  { id:'form', image:'assets/welcome/moon-jar.jpg', title:'Moon Jar', maker:'Korea · Joseon dynasty · late 17th–mid-18th century', source:'158472' },
  { id:'poems', image:'assets/welcome/maples.jpg', title:'Autumn Maples with Poem Slips', maker:'Tosa Mitsuoki · c. 1675', source:'127644' },
  { id:'colour', image:'assets/guide/kandinsky.jpg', title:'Improvisation No. 30 (Cannons)', maker:'Vasily Kandinsky · 1913', source:'8991' },
];
for (const file of ['index.html', 'welcome.css', 'welcome.js', 'explore.html']) {
  assert.equal(await readFile(new URL(file, root), 'utf8'), await readFile(new URL('dist/' + file, root), 'utf8'), file + ' deploy mirror');
}
for (const match of html.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
  const path = match[1];
  // A root-relative path (the shared icon links: /favicon.svg, /site.webmanifest …) is a file at the site root, i.e. the repo root.
  if (!/^(https?:|data:)/.test(path)) await access(new URL(path.replace(/^\/(?!\/)/, ''), root));
}
assert.match(html, /id="why"/);
assert.match(html, /Why all these rooms/);
assert.match(html, /feel more deeply, understand more fully, and connect/);
assert.equal((html.match(/<h1\b/g) || []).length, 1);
assert.equal((html.match(/data-hero-scene=/g) || []).length, 5);
assert.match(html, /class="arrival-views" hidden/);
assert.doesNotMatch(html, /<(?:audio|video)\b/i);
assert.doesNotMatch(welcomeScript, /\b(?:AudioContext|webkitAudioContext|Audio|createOscillator)\b/);
for (const room of arrivals) {
  assert.ok(visit.includes(`id="${room.id}"`), `${room.id} is a real gallery destination`);
  assert.ok(html.includes(`data-arrival="${room.id}"`));
  assert.deepEqual(await readFile(new URL(room.image, root)), await readFile(new URL(`dist/${room.image}`, root)), `${room.image} deploy mirror`);
}
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));
console.log('welcome static checks passed');
if (!process.argv.includes('--browser')) process.exit(0);
const works = JSON.parse(await readFile(new URL('catalog/all.json', root), 'utf8'));
const route = async (url) => {
  if (url.pathname === '/catalog/all.json') return { type: 'application/json', body: JSON.stringify(works) };
  if (/^\/(welcome\.(css|js)|assets\/welcome\/[a-z-]+\.jpg|assets\/guide\/kandinsky\.jpg|assets\/noticing\/cassatt-childs-bath\.jpg|assets\/psyche\/canova-t\.jpg|assets\/vishenskaya\/poignant-wonder-t\.jpg)$/.test(url.pathname)) {
    return { type: url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.js') ? 'text/javascript' : 'image/jpeg', body: await readFile(new URL(url.pathname.slice(1), root)) };
  }
  return null;
};
const init = `(() => {
  window.__audioStarts = 0;
  window.AudioContext = window.webkitAudioContext = class { constructor(){ window.__audioStarts++; throw new Error('The homepage must not start audio'); } };
  window.__setHidden = hidden => {
    Object.defineProperty(document, 'hidden', {configurable:true, get:()=>hidden});
    document.dispatchEvent(new Event('visibilitychange'));
  };
})();`;
await withBrowser('welcome', async browser => {
  const { load, viewport, evaluate, click, media, send, shot, requests } = browser;
  const layout = async label => {
    const state = await evaluate(`({width:innerWidth, contentWidth:document.documentElement.scrollWidth, smallControls:[...document.querySelectorAll('a,button,input,summary')].filter(el=>{const r=el.getBoundingClientRect();return el.getClientRects().length && getComputedStyle(el).visibility!=='hidden' && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth;}).filter(el=>el.getBoundingClientRect().height<43.9).map(el=>({tag:el.tagName,text:el.textContent.trim().slice(0,70),height:el.getBoundingClientRect().height}))})`);
    assert.ok(state.contentWidth <= state.width + 1, `${label}: no overflow at ${state.width}px`);
    assert.deepEqual(state.smallControls, [], `${label}: visible controls are at least 44px high`);
  };
  const scrollTo = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({behavior:'instant',block:'start'})`);
  const imageLoaded = selector => until(() => evaluate(`document.querySelector(${JSON.stringify(selector)})?.naturalWidth > 0`), `${selector} image loads`);
  const expectArrival = async room => {
    const state = await evaluate(`({view:document.querySelector('#arrival').dataset.view, current:[...document.querySelectorAll('[data-hero-scene].is-current')].map(img=>img.dataset.heroScene), exposed:[...document.querySelectorAll('[data-hero-scene]')].filter(img=>img.getAttribute('aria-hidden')!=='true').map(img=>img.dataset.heroScene), pressed:[...document.querySelectorAll('[data-arrival][aria-pressed="true"]')].map(button=>button.dataset.arrival), title:document.querySelector('#arrival-credit cite').textContent, maker:document.querySelector('#arrival-credit span').textContent, begin:document.querySelector('#begin-visit').getAttribute('href'), image:document.querySelector('#arrival-art-open').getAttribute('href'), aura:document.querySelector('#arrival-aura').getAttribute('src')})`);
    assert.equal(state.view, room.id);
    assert.deepEqual(state.current, [room.id]);
    assert.deepEqual(state.exposed, [room.id], 'only the selected artwork is exposed to assistive technology');
    assert.deepEqual(state.pressed, [room.id]);
    assert.equal(state.title, room.title);
    assert.equal(state.maker, room.maker);
    assert.equal(state.begin, `visit.html#${room.id}`);
    assert.equal(state.image, room.image);
    assert.equal(state.aura, room.image);
    await imageLoaded(`[data-hero-scene="${room.id}"]`);
    await until(() => evaluate(`Array.from(document.querySelectorAll('[data-hero-scene]')).every(image => {const style=getComputedStyle(image);const visible=image.dataset.heroScene === ${JSON.stringify(room.id)};return (visible ? Number(style.opacity)>0 && style.visibility==='visible' : Number(style.opacity)===0 && style.visibility==='hidden') && image.getAnimations().every(animation=>!(animation instanceof CSSTransition) || animation.playState!=='running');})`), 'arrival crossfade completes');
  };
  const closeViewer = async escape => {
    if (escape) {
      await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await send('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    } else await click('#arrival-viewer .viewer-close');
    await until(() => evaluate(`!document.querySelector('#arrival-viewer').open && document.activeElement === document.querySelector('#arrival-art-open')`), 'artwork viewer closes and restores focus');
  };
  const openViewer = async room => {
    await click('#arrival-art-open');
    await imageLoaded('#arrival-viewer-image');
    const state = await evaluate(`({open:document.querySelector('#arrival-viewer').open,title:document.querySelector('#arrival-viewer-title').textContent,maker:document.querySelector('#arrival-viewer-maker').textContent,source:document.querySelector('#arrival-viewer-source').getAttribute('href'),image:document.querySelector('#arrival-viewer-image').getAttribute('src'),alt:document.querySelector('#arrival-viewer-image').alt,focus:document.activeElement.matches('#arrival-viewer .viewer-close')})`);
    assert.equal(state.open, true);
    assert.equal(state.title, room.title);
    assert.equal(state.maker, room.maker);
    assert.equal(state.source, `https://www.artic.edu/artworks/${room.source}`);
    assert.equal(state.image, room.image);
    assert.ok(state.alt);
    assert.equal(state.focus, true);
  };
  await media([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await load({ html, path: '/index.html', route, init });
  await expectArrival(arrivals[0]);
  await until(() => evaluate(`document.querySelector('#arrival').classList.contains('is-visible')`), 'arrival visibility is tracked');
  assert.equal(await evaluate('document.body.dataset.motion'), 'on');
  assert.equal(await evaluate('window.__audioStarts'), 0);
  assert.equal(await evaluate(`document.querySelector('.arrival-views').hidden`), false);
  await shot('desktop-welcome');
  for (const [index, room] of arrivals.entries()) {
    await click(`[data-arrival="${room.id}"]`);
    await expectArrival(room);
    await shot(`desktop-arrival-${room.id}`, '#arrival');
    await openViewer(room);
    await closeViewer(index % 2 === 0);
  }
  await click('[data-arrival="water"]');
  await expectArrival(arrivals[0]);
  assert.ok(await evaluate(`document.querySelector('#arrival').getAnimations({subtree:true}).some(animation=>animation.playState==='running')`), 'visible arrival has ambient movement');
  await click('#home-motion');
  assert.equal(await evaluate('document.body.dataset.motion'), 'off');
  assert.equal(await evaluate(`document.querySelector('#home-motion').getAttribute('aria-pressed')`), 'false');
  await until(() => evaluate(`document.querySelector('#arrival').getAnimations({subtree:true}).every(animation=>animation.playState!=='running')`), 'motion toggle stops ambient animation');
  await click('#home-motion');
  assert.equal(await evaluate('document.body.dataset.motion'), 'on');
  await evaluate('__setHidden(true)');
  assert.equal(await evaluate(`document.querySelector('#arrival').classList.contains('is-visible')`), false);
  await evaluate('__setHidden(false)');
  await until(() => evaluate(`document.querySelector('#arrival').classList.contains('is-visible')`), 'visible document resumes its chosen motion mode');
  await scrollTo('#search');
  await until(() => evaluate(`!document.querySelector('#arrival').classList.contains('is-visible')`), 'offscreen arrival stops being marked visible');
  await until(() => evaluate(`document.querySelector('#arrival').getAnimations({subtree:true}).every(animation=>animation.playState!=='running')`), 'offscreen arrival has no running animation');
  await evaluate('[...document.querySelectorAll("img")].forEach(img => img.loading = "eager")');
  await until(() => evaluate('[...document.images].filter(img=>img.getAttribute("src")?.startsWith("assets/")).every(img=>img.naturalWidth>0)'), 'all local artwork loads');
  await shot('desktop-why', '#why');
  await shot('desktop-rooms', '.shape-section');
  await shot('desktop-notebook', '.notebook-door');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.notebook-art img')).objectFit`), 'contain', 'the notebook doorway preserves the whole artwork');
  await shot('desktop-reading', '#reading');
  await shot('desktop-search', '#search');
  await shot('desktop-full', 'body');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await viewport(width);
    for (const selector of ['#arrival','.hero-actions','.arrival-views','#why','.shape-section','.notebook-door','#start','#reading','#search','.closing','.site-footer']) {
      await scrollTo(selector);
      await layout(`${selector} at ${width}px`);
    }
  }
  await viewport(390, 844, true);
  await scrollTo('#arrival');
  await expectArrival(arrivals[0]);
  await shot('mobile-welcome');
  await shot('mobile-hero', '.hero');
  await openViewer(arrivals[0]);
  await layout('mobile artwork viewer');
  await closeViewer(true);
  assert.equal(await evaluate('window.__audioStarts'), 0, 'homepage interaction never starts audio');
  await viewport(1440);
  await click('[data-query="sea"]');
  await until(() => evaluate('document.querySelectorAll(".result").length > 0'), 'museum search');
  assert.match(await evaluate('document.querySelector("#search-status").textContent'), /Showing 12 of \d+ works for “sea”/);
  await click('#search-more');
  assert.match(await evaluate('document.querySelector("#search-status").textContent'), /Showing 24 of/);
  assert.equal(requests.filter(r => r.url.endsWith('/catalog/all.json')).length, 1, 'catalogue fetched once');
  await evaluate('document.querySelector("#q").value="Monet"; document.querySelector("#search-form").requestSubmit()');
  await until(() => evaluate('document.querySelector("#search-status").textContent.includes("“Monet”")'), 'second search');
  assert.equal(requests.filter(r => r.url.endsWith('/catalog/all.json')).length, 1, 'repeat search uses loaded catalogue');
  await evaluate('document.querySelector("#q").value="no-such-work-zzzz"; document.querySelector("#search-form").requestSubmit()');
  await until(() => evaluate('document.querySelector("#search-status").textContent.startsWith("No works found")'), 'empty results');
  assert.equal(await evaluate('document.querySelectorAll(".result").length'), 0);
  assert.equal(await evaluate('document.querySelector("#search-more").hidden'), true);
  await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await evaluate('getComputedStyle(document.documentElement).scrollBehavior'), 'auto');
  assert.equal(await evaluate('document.body.dataset.motion'), 'off');
  assert.equal(await evaluate(`document.querySelector('#home-motion').disabled`), true);
  await scrollTo('#arrival');
  assert.ok(await evaluate(`document.querySelector('#arrival').getAnimations({subtree:true}).every(animation=>animation.playState!=='running')`), 'reduced motion stops all hero animation');
  await load({ html, path: '/index.html', init, route: async (url) => url.pathname === '/catalog/all.json' ? {status:503, type:'application/json', body:'{}'} : route(url) });
  await click('[data-query="moon"]');
  await until(() => evaluate('document.querySelector("#search-status").textContent.includes("could not load")'), 'failed fetch explanation');
  const unsafe = { artworks: [{ title: '<img src=x onerror=alert(1)>', artist: 'Moon', url: 'javascript:alert(1)', image: 'javascript:alert(1)' }] };
  await load({html, path:'/index.html', init, route: async url => url.pathname === '/catalog/all.json' ? {type:'application/json',body:JSON.stringify(unsafe)} : route(url)});
  await click('[data-query="moon"]');
  await until(() => evaluate('document.querySelectorAll(".result").length === 1'), 'untrusted catalogue fixture');
  assert.equal(await evaluate('document.querySelector(".result h3").textContent'), unsafe.artworks[0].title);
  assert.equal(await evaluate('document.querySelectorAll(".result img,.result a,.result script").length'),0);
  assert.match(await evaluate('document.querySelector(".result").textContent'), /unverified/);
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await load({ html, path:'/index.html', route });
  assert.equal(await evaluate('document.querySelector("h1").innerText'), 'Art brings\nus closer.');
  assert.ok(await evaluate('document.querySelector("#why").textContent.includes("Artbitrage began")'));
  assert.equal(await evaluate('document.querySelectorAll(".front-door-paths a").length'),4);
  assert.ok(await evaluate('document.querySelector("noscript").textContent.includes("browse the collection")'));
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.arrival-views')).display`), 'none');
  assert.equal(await evaluate(`document.querySelector('#home-motion').hidden`), true);
  assert.equal(await evaluate('document.body.dataset.motion'), 'off');
  await expectArrival(arrivals[0]);
  assert.equal(await evaluate(`document.querySelector('#arrival-viewer').open`), false);
  await click('#arrival-art-open');
  await until(() => evaluate(`location.pathname === '/assets/welcome/seurat.jpg' && document.querySelector('img')?.naturalWidth > 0`), 'no-JavaScript direct artwork link works');
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  console.log('welcome browser passed: five arrival views and real gallery destinations, artwork viewer + focus return, optional/offscreen/reduced motion, no audio, 320–1440px, search pagination/error/unsafe data, and no-JavaScript purpose/navigation/artwork');
});
