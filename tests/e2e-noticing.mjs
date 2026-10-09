// Curatorial notes remain readable as a document; all browser requests use local fixtures.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { withBrowser, until, origin } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root));
const html = read('noticing.html').toString();
const script = read('noticing.js').toString();
const manifestPath = 'assets/noticing/works.json';
const publicData = JSON.parse(read(manifestPath));
const embedded = html.match(/<script\b[^>]*id="noticing-data"[^>]*>([\s\S]*?)<\/script>/);
assert.ok(embedded, 'local embedded catalogue supports progressive enhancement');
const data = JSON.parse(embedded[1]);
const byId = new Map(data.works.map(work => [work.id, work]));
assert.ok(data.works.length >= 4, 'a selection of artworks forms the curatorial trail');
assert.equal(byId.size, data.works.length, 'work IDs are unique');
assert.deepEqual([...byId.keys()].sort(), publicData.works.map(work => work.id).sort(), 'public and embedded catalogues contain the same selection');
for (const work of publicData.works) {
  for (const [field, value] of Object.entries(work)) assert.deepEqual(byId.get(work.id)[field], value, `${work.id}: embedded ${field} retains public museum data`);
}
for (const work of data.works) {
  assert.match(work.id, /^[a-z0-9-]+$/);
  for (const field of ['title', 'maker', 'date', 'medium', 'alt', 'source', 'context', 'context_source']) {
    assert.ok(typeof work[field] === 'string' && work[field].trim(), `${work.id}: ${field}`);
  }
  assert.match(work.image, /^\/assets\/(?:noticing|trip|visit|welcome|guide|elements)\/[a-z0-9-]+\.(?:jpg|png|webp)$/);
  assert.match(work.source, /^https:\/\//);
  assert.match(work.context_source, /^https:\/\//);
  assert.ok(work.width > 0 && work.height > 0);
  assert.equal(work.looking.length, 2);
  assert.ok(work.looking.every(line => typeof line === 'string' && line.length > 10));
  assert.ok(Array.isArray(work.noted_details) && work.noted_details.length > 0);
  assert.ok(work.detail && ['x', 'y', 'w', 'h'].every(key => typeof work.detail[key] === 'number' && work.detail[key] >= 0 && work.detail[key] <= 1));
  assert.ok(work.detail.w > 0 && work.detail.h > 0 && work.detail.x + work.detail.w <= 1 && work.detail.y + work.detail.h <= 1, `${work.id} marker fits inside the original image`);
  assert.ok(typeof work.detail.caption === 'string' && work.detail.caption.trim());
  assert.ok(html.includes(`id="${work.id}"`), `${work.id} is a static reading destination`);
  assert.deepEqual(read(work.image.slice(1)), read(`dist${work.image}`), `${work.id} artwork deploy mirror`);
}
for (const file of ['noticing.html', 'noticing.css', 'noticing.js', manifestPath]) {
  assert.deepEqual(read(file), read(`dist/${file}`), `${file} deploy mirror`);
}
new Script(script);
assert.doesNotMatch(html, /<(?:audio|video|iframe)\b|\bautoplay\b/i);
assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|WebSocket|AudioContext|sendBeacon|localStorage|sessionStorage)\b/);

function localTarget(href, from) {
  const target = new URL(href.replaceAll('&amp;', '&'), `${origin}/${from}`);
  assert.ok(['http:', 'https:'].includes(target.protocol), `navigable link: ${href}`);
  if (target.origin !== origin) {
    assert.equal(target.protocol, 'https:', `secure source: ${href}`);
    return;
  }
  const path = decodeURIComponent(target.pathname).replace(/^\//, '');
  const file = !path ? 'index.html' : path.includes('.') ? path : `${path}.html`;
  assert.ok(existsSync(new URL(file, root)), `${from}: ${href} resolves locally`);
  if (target.hash && file.endsWith('.html')) {
    assert.ok(read(file).toString().includes(`id="${decodeURIComponent(target.hash.slice(1))}"`), `${from}: ${href} has a real fragment`);
  }
}
for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) localTarget(match[1], 'noticing.html');
for (const file of ['index.html', 'map.html', 'elements.html']) {
  const page = read(file).toString();
  const entries = [...page.matchAll(/<a\b[^>]*\bhref="((?:\/)?noticing(?:\.html)?(?:[?#][^"]*)?)"/g)];
  assert.ok(entries.length, `${file} leads into the curatorial notes`);
  for (const match of entries) localTarget(match[1], file);
  assert.deepEqual(read(file), read(`dist/${file}`), `${file} integration mirror`);
}
assert.equal(JSON.parse(read('map.json')).groups.flatMap(group => group.rooms).filter(room => room.path === '/noticing').length, 1);
assert.equal(read('sitemap.xml').toString().split('<loc>https://artbitrage.io/noticing</loc>').length - 1, 1);
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));
console.log(`noticing static checks passed: ${data.works.length} complete records, whole artwork mirrors, native fragments, visitor entries and no background requests`);
if (!process.argv.includes('--browser')) process.exit(0);

const tripHtml = read('trip.html').toString();
const visitWorks = JSON.parse(read('assets/visit/works.json'));
const tripWorks = JSON.parse(read('assets/trip/works.json'));
const elementWorks = JSON.parse(read('assets/elements/works.json'));
const assets = new Set(['noticing.js', 'noticing.css', 'trip.js', 'trip.css', 'breathing.js', 'breathing.css',
  manifestPath, 'assets/visit/works.json', 'assets/trip/works.json', 'assets/elements/works.json',
  ...[...data.works, ...visitWorks, ...tripWorks.works, ...elementWorks.works].map(work => work.image.slice(1))]);
let manifestMode = 'normal', releaseManifest;
const route = async url => {
  if (url.pathname === '/trip') return { body: tripHtml };
  if (url.pathname === '/noticing') return { body: html };
  const path = url.pathname.slice(1);
  if (!assets.has(path)) return null;
  const response = { body: read(path), type: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.json') ? 'application/json' : 'image/jpeg' };
  if (path === manifestPath) {
    if (manifestMode === 'failed') return { status: 503, body: '{}', type: 'application/json' };
    if (manifestMode === 'held') return new Promise(resolve => { releaseManifest = () => resolve(response); });
    if (manifestMode === 'unsafe-image') return { ...response, body: JSON.stringify({ ...data, works: data.works.map(work => ({ ...work, image: 'https://example.com/remote.jpg' })) }) };
    if (manifestMode === 'unsafe-source') return { ...response, body: JSON.stringify({ ...data, works: data.works.map(work => ({ ...work, source: 'javascript:window.__injected=1' })) }) };
  }
  return response;
};
const init = `(() => {
  window.__injected=0; window.__audioCalls=0; window.__noticingReads=0;
  HTMLMediaElement.prototype.play=function(){window.__audioCalls++;return Promise.reject(new Error('No media in noting tests'));};
  HTMLMediaElement.prototype.pause=function(){};
  window.AudioContext=window.webkitAudioContext=class{constructor(){window.__audioCalls++;throw new Error('No realtime audio in noting tests');}};
  const originalFetch=fetch.bind(window);
  window.fetch=(url,options={})=>{
    if((options.method||'GET').toUpperCase()!=='GET')throw new Error('No mutations in noting tests');
    return originalFetch(url,options).then(async response=>{if(url==='/assets/noticing/works.json'){await response.clone().text();window.__noticingReads++;}return response;});
  };
  const NativeImage=window.Image,srcProperty=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  window.__imageControl={mode:new URLSearchParams(location.search).get('image-test')||'normal',held:[],completed:[]};
  window.Image=function(...args){
    const image=new NativeImage(...args);
    Object.defineProperty(image,'src',{configurable:true,get:()=>srcProperty.get.call(image),set(value){
      const mode=__imageControl.mode;__imageControl.mode='normal';
      const run=()=>srcProperty.set.call(image,value);
      image.addEventListener('load',()=>__imageControl.completed.push(value),{once:true});
      if(mode==='fail')queueMicrotask(()=>image.onerror?.(new Event('error')));
      else if(mode==='hold')__imageControl.held.push(run);
      else run();
    }});return image;
  };window.Image.prototype=NativeImage.prototype;
})();`;

await withBrowser('noticing', async b => {
  const { load, evaluate, click, send, viewport, media, shot, requests } = b;
  const frames = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const press = async (key, code, text) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, windowsVirtualKeyCode: code, ...(text ? { text } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: code });
  };
  const targets = async label => {
    const state = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:Array.from(document.querySelectorAll('a,button,summary,select')).filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&(r.height<43.9||r.width<43.9);}).map(el=>({text:el.textContent.trim().slice(0,60),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))})`);
    assert.ok(state.scroll <= state.width + 1, `${label}: page fits ${state.width}px`);
    assert.deepEqual(state.bad, [], `${label}: visible controls have 44px targets at ${state.width}px`);
  };
  const chapter = () => load({ html, path: '/noticing', route, init });
  const viewer = async work => {
    const opener = `[data-view-work="${work.id}"]`;
    await evaluate(`document.querySelector(${JSON.stringify(opener)}).focus()`);
    await press('Enter', 13, '\r');
    await until(() => evaluate(`document.querySelector('#noticing-viewer').open&&document.querySelector('#noticing-viewer-image').complete&&document.querySelector('#noticing-viewer-image').naturalWidth>0`), 'whole-art viewer opens and loads');
    const actual = await evaluate(`(()=>{const dialog=document.querySelector('#noticing-viewer'),image=document.querySelector('#noticing-viewer-image');return{modal:dialog.matches(':modal'),image:image.getAttribute('src'),alt:image.alt,fit:getComputedStyle(image).objectFit,title:document.querySelector('#noticing-viewer-title').textContent,source:document.querySelector('#noticing-viewer-source').getAttribute('href'),stay:document.querySelector('#noticing-viewer-stay').getAttribute('href'),focus:dialog.contains(document.activeElement)};})()`);
    assert.equal(actual.modal, true); assert.equal(actual.focus, true);
    assert.equal(actual.image, work.image); assert.equal(actual.alt, work.alt);
    assert.equal(actual.title, work.title); assert.equal(actual.source, work.source); assert.equal(actual.fit, 'contain');
    const stay = new URL(actual.stay, origin);
    assert.equal(stay.pathname, '/trip'); assert.equal(stay.searchParams.get('from'), 'noticing'); assert.equal(stay.searchParams.get('work'), work.id);
    return opener;
  };
  const closed = async opener => {
    await until(() => evaluate(`!document.querySelector('#noticing-viewer').open`), 'viewer closes');
    assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(opener)})`), true, 'viewer returns focus to its exact artwork');
  };
  const open = async suffix => {
    await evaluate(`history.replaceState(null,'',${JSON.stringify(origin + '/noticing')}+${JSON.stringify(suffix)});window.__beforeNavigation=true`);
    await send('Page.reload');
    await until(() => evaluate(`!window.__beforeNavigation&&document.readyState==='complete'&&!!document.querySelector('#noticing-viewer')`), 'direct note document loads');
    await frames();
  };
  const marker = async (work, visible) => {
    const actual = await evaluate(`(()=>{const section=document.getElementById(${JSON.stringify(work.id)}),mark=section.querySelector('.detail-mark'),image=section.querySelector('[data-view-work] img'),r=image.getBoundingClientRect(),s=getComputedStyle(image),m=mark.getBoundingClientRect();const left=r.left+parseFloat(s.borderLeftWidth)+parseFloat(s.paddingLeft),top=r.top+parseFloat(s.borderTopWidth)+parseFloat(s.paddingTop),width=r.width-parseFloat(s.borderLeftWidth)-parseFloat(s.borderRightWidth)-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),height=r.height-parseFloat(s.borderTopWidth)-parseFloat(s.borderBottomWidth)-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom),scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;return{pressed:section.querySelector('[data-detail-toggle]').getAttribute('aria-pressed'),decorative:mark.getAttribute('aria-hidden'),visible:!!mark.getClientRects().length&&getComputedStyle(mark).visibility!=='hidden'&&getComputedStyle(mark).opacity!=='0',caption:section.querySelector('[data-detail-caption]').textContent,image:{left:left+(width-w)/2,top:top+(height-h)/2,width:w,height:h},mark:{left:m.left,top:m.top,width:m.width,height:m.height}};})()`);
    assert.equal(actual.pressed, String(visible)); assert.equal(actual.visible, visible);
    assert.equal(actual.decorative, 'true'); assert.ok(actual.caption.includes(work.detail.caption));
    if (visible) {
      for (const [key, expected] of Object.entries({ left: actual.image.left + actual.image.width * work.detail.x, top: actual.image.top + actual.image.height * work.detail.y, width: actual.image.width * work.detail.w, height: actual.image.height * work.detail.h })) {
        assert.ok(Math.abs(actual.mark[key] - expected) < 3, `${work.id}: detail ${key} follows the contained whole image`);
      }
      assert.ok(actual.mark.width > 0 && actual.mark.height > 0);
    }
  };

  await chapter();
  assert.equal(await evaluate('__audioCalls'), 0);
  assert.ok(await evaluate(`/AI/i.test(document.body.textContent)`), 'curatorial voice is attributed on the public page');
  assert.equal(await evaluate(`document.querySelector('#noticing-viewer').open`), false, 'viewer waits for a visitor');
  await shot('noticing-arrival-desktop');
  for (const work of data.works) {
    const section = await evaluate(`(()=>{const section=document.getElementById(${JSON.stringify(work.id)});return{notes:section.querySelector('[data-work-note]')?.textContent,context:section.querySelector('[data-work-context]')?.textContent,contextSources:Array.from(section.querySelectorAll('[data-work-context] a'),a=>a.href),full:section.querySelector('[data-view-work]')?.getAttribute('href'),image:section.querySelector('[data-view-work] img')?.getAttribute('src'),contained:section.querySelector('[data-work-note]')?.contains(section.querySelector('[data-work-context]'))};})()`);
    assert.ok(section.notes?.trim().length > 80, `${work.id} has a sustained curator observation`);
    assert.ok(section.context?.includes(work.context), `${work.id} retains its sourced museum context`);
    assert.ok(section.contextSources.includes(work.context_source), `${work.id} links to the context source`);
    assert.equal(section.contained, false, 'museum context is separate from the personal reading');
    assert.equal(section.full, work.image); assert.equal(section.image, work.image);
    await open(`#${work.id}`);
    assert.equal(await evaluate('location.hash'), `#${work.id}`, 'direct note fragment survives enhancement');
    assert.ok(await evaluate(`document.getElementById(${JSON.stringify(work.id)}).getBoundingClientRect().height>0`));
    await until(() => evaluate(`document.querySelector('[data-view-work="${work.id}"] img').naturalWidth>0`), 'the detail artwork loads');
    await marker(work, false);
    await click(`[data-detail-toggle="${work.id}"]`); await frames(); await marker(work, true);
    const opener = await viewer(work);
    await press('Escape', 27); await closed(opener);
    await marker(work, true);
    await viewer(work); await click('#noticing-viewer [data-viewer-close]'); await closed(opener);
    await marker(work, true);
    await click(`[data-detail-toggle="${work.id}"]`); await marker(work, false);
  }
  const first = data.works[0];
  await open('');
  let opener = await viewer(first);
  const rect = await evaluate(`(()=>{const r=document.querySelector('#noticing-viewer').getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom};})()`);
  assert.ok(rect.left > 2 || rect.top > 2, 'desktop modal has a usable backdrop');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1, y: 1, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1, y: 1, button: 'left', clickCount: 1 });
  await closed(opener);
  // Internal links are ordinary document navigation and keep their exact destination.
  const threads = await evaluate(`Array.from(document.querySelectorAll('a[href^="#"]')).filter(a=>${JSON.stringify([...byId.keys()])}.includes(a.hash.slice(1))).map(a=>({href:a.getAttribute('href'),text:a.textContent.trim()}))`);
  assert.ok(threads.length >= data.works.length, 'artworks are connected by native reading links');
  for (const { href } of threads.slice(0, data.works.length)) {
    await click(`a[href="${href}"]`); await frames();
    assert.equal(await evaluate('location.hash'), href);
  }
  for (const hash of ['#unknown', '#%3Cimg%20src=x%20onerror=window.__injected=1%3E', '#%E0%A4%A']) {
    await open(hash); assert.equal(await evaluate('__injected'), 0);
    assert.equal(await evaluate(`document.querySelector('#noticing-viewer').open`), false);
  }
  for (const width of [320, 390, 768, 1440]) {
    await viewport(width, 900, width < 600); await evaluate(`scrollTo({top:0,behavior:'instant'})`); await targets('arrival');
    if (width === 390) await shot('noticing-arrival-mobile');
    for (const work of data.works) {
      await evaluate(`document.getElementById(${JSON.stringify(work.id)}).scrollIntoView({block:'start',behavior:'instant'})`); await targets(work.id);
      await until(() => evaluate(`(()=>{const image=document.querySelector('[data-view-work="${work.id}"] img');return image.complete&&image.naturalWidth>0;})()`), 'static whole artwork loads');
      const image = await evaluate(`(()=>{const image=document.querySelector('[data-view-work="${work.id}"] img'),r=image.getBoundingClientRect();return{fit:getComputedStyle(image).objectFit,width:r.width,height:r.height,left:r.left,right:r.right};})()`);
      assert.equal(image.fit, 'contain'); assert.ok(image.width > 100 && image.height > 100);
      assert.ok(image.left >= -1 && image.right <= width + 1);
      await click(`[data-detail-toggle="${work.id}"]`); await frames(); await marker(work, true);
      if (width === 390 && work === first) await shot('noticing-detail-mobile', `#${work.id} .work-field`);
      if (width === 1440 && ['sargent-glass-workers', 'mondrian-lozenge'].includes(work.id)) await shot(`noticing-detail-${work.id}`, `#${work.id}`);
      await viewport(width + 20, 900, width < 600); await frames(); await marker(work, true);
      await viewport(width, 900, width < 600); await frames(); await marker(work, true);
      await click(`[data-detail-toggle="${work.id}"]`); await marker(work, false);
      if (width === 390 && work === first) await shot('noticing-first-mobile');
    }
  }
  for (const [width, height] of [[320, 568], [390, 700], [844, 390], [1440, 1000]]) {
    await viewport(width, height, width < 600);
    opener = await viewer(first);
    const layout = await evaluate(`(()=>{const d=document.querySelector('#noticing-viewer'),image=document.querySelector('#noticing-viewer-image');return{width:d.clientWidth,scroll:d.scrollWidth,imageHeight:image.getBoundingClientRect().height,controls:Array.from(d.querySelectorAll('a,button')).filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return{id:el.id,text:el.textContent.trim().slice(0,40),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})};})()`);
    assert.ok(layout.scroll <= layout.width + 1); assert.ok(layout.imageHeight >= 80, 'modal retains room for the artwork');
    for (const control of layout.controls) {
      assert.ok(control.width >= 43.9 && control.height >= 43.9, `${control.id} has a 44px modal target`);
      assert.ok(control.left >= -1 && control.right <= width + 1 && control.top >= -1 && control.bottom <= height + 1, `${control.id || control.text} stays on-screen at ${width}x${height}`);
    }
    await shot(`noticing-viewer-${width}x${height}`); await press('Escape', 27); await closed(opener);
  }
  await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).scrollBehavior`), 'auto');
  assert.equal(await evaluate(`document.getAnimations().filter(animation=>animation.playState==='running').length`), 0);
  assert.equal(await evaluate('__audioCalls'), 0);

  const tripOpen = async suffix => {
    await evaluate(`history.replaceState(null,'',${JSON.stringify(origin + '/trip')}+${JSON.stringify(suffix)});window.__beforeNavigation=true`);
    await send('Page.reload');
    await until(() => evaluate(`!window.__beforeNavigation&&document.readyState==='complete'&&!!document.querySelector('#trip-breath-host')?.breathing`), 'quiet room loads');
  };
  const handoff = async work => {
    await tripOpen(`?from=noticing&work=${work.id}`);
    await until(() => evaluate(`document.querySelector('#trip-stage')?.dataset.work===${JSON.stringify(work.id)}`), 'the noted work arrives in the quiet room');
    assert.equal(await evaluate('document.body.dataset.drifting'), 'false');
    assert.equal(await evaluate(`document.querySelector('#trip-breath-host').breathing.running`), false);
    assert.equal(await evaluate(`document.querySelector('#trip-return').getAttribute('href')`), `/noticing#${work.id}`);
    assert.equal(await evaluate(`document.querySelector('#trip-art-source').getAttribute('href')`), work.source);
    assert.equal(await evaluate(`document.querySelector('#trip-stage .is-current img').getAttribute('src')`), work.image);
    assert.equal(await evaluate('__audioCalls'), 0);
  };
  for (const work of data.works) await handoff(work);
  for (const mode of ['failed', 'unsafe-image', 'unsafe-source']) {
    manifestMode = mode;
    await tripOpen(`?from=noticing&work=${first.id}`);
    await until(() => evaluate(`/could not be opened/i.test(document.querySelector('#trip-entry-status').textContent)`), `${mode} handoff has an honest fallback`);
    assert.equal(await evaluate('document.body.dataset.mode'), 'entry');
    assert.equal(await evaluate('__injected'), 0);
    manifestMode = 'normal';
  }
  await tripOpen(`?from=noticing&work=${first.id}&image-test=fail`);
  await until(() => evaluate(`/could not be opened/i.test(document.querySelector('#trip-entry-status').textContent)`), 'failed handoff image keeps the entry readable');
  assert.equal(await evaluate('document.body.dataset.mode'), 'entry');
  for (const work of ['not-a-work', '%3Cimg%20src=x%20onerror=window.__injected=1%3E']) {
    await tripOpen(`?from=noticing&work=${work}&return=https%3A%2F%2Fexample.com`);
    if (work === 'not-a-work') await until(() => evaluate('window.__noticingReads===1'), 'unknown handoff catalogue settles');
    await frames();
    assert.equal(await evaluate('document.body.dataset.mode'), 'entry');
    assert.ok(!(await evaluate(`document.querySelector('#trip-return').getAttribute('href')`)).startsWith('http'));
    assert.equal(await evaluate('__injected'), 0);
  }
  manifestMode = 'held'; releaseManifest = null;
  await tripOpen(`?from=noticing&work=${first.id}`);
  await until(() => Boolean(releaseManifest), 'the curatorial handoff catalogue is held');
  await click('#trip-just-breathe');
  await until(() => evaluate(`document.body.dataset.practice==='breathe'&&!!document.querySelector('#trip-stage .is-current img')?.naturalWidth&&!document.querySelector('#trip-next').disabled`), 'visitor starts their own still practice');
  const manualWork = await evaluate(`document.querySelector('#trip-stage').dataset.work`);
  releaseManifest(); manifestMode = 'normal';
  await until(() => evaluate('__noticingReads===1'), 'delayed handoff catalogue finishes'); await frames();
  assert.equal(await evaluate('document.body.dataset.practice'), 'breathe');
  assert.equal(await evaluate(`document.querySelector('#trip-stage').dataset.work`), manualWork, 'late handoff cannot replace the visitor choice');
  await tripOpen(`?from=noticing&work=${first.id}&image-test=hold`);
  await until(() => evaluate('__imageControl.held.length===1'), 'handoff image is held after the catalogue resolves');
  await click('#trip-just-breathe');
  await until(() => evaluate(`document.body.dataset.practice==='breathe'&&!!document.querySelector('#trip-stage .is-current img')?.naturalWidth&&!document.querySelector('#trip-next').disabled`), 'visitor chooses a practice while the handoff image is pending');
  const manualAfterImage = await evaluate(`document.querySelector('#trip-stage').dataset.work`);
  const completed = await evaluate('__imageControl.completed.length');
  await evaluate('__imageControl.held.shift()()');
  await until(() => evaluate(`__imageControl.completed.length>${completed}`), 'the cancelled handoff image eventually arrives'); await frames();
  assert.equal(await evaluate('document.body.dataset.practice'), 'breathe');
  assert.equal(await evaluate(`document.querySelector('#trip-stage').dataset.work`), manualAfterImage, 'late image cannot replace the visitor choice');

  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await load({ html, path: '/noticing', route }); await viewport(320, 900, true);
  assert.equal(await evaluate(`document.querySelector('#noticing-viewer').open`), false);
  for (const work of data.works) {
    await evaluate(`document.getElementById(${JSON.stringify(work.id)}).scrollIntoView({block:'start',behavior:'instant'})`); await targets(`no-JS ${work.id}`);
    const record = await evaluate(`(()=>{const section=document.getElementById(${JSON.stringify(work.id)});return{height:section.getBoundingClientRect().height,note:section.querySelector('[data-work-note]').textContent,context:section.querySelector('[data-work-context]').textContent,full:section.querySelector('[data-view-work]').getAttribute('href')};})()`);
    assert.ok(record.height > 100 && record.note.length > 80 && record.context.includes(work.context));
    assert.equal(record.full, work.image, 'no-script artwork link opens the original whole image');
    assert.equal(await evaluate(`document.querySelector('[data-detail-toggle="${work.id}"]').getClientRects().length`), 0, 'no-script detail reading does not show an inert control');
  }
  await shot('noticing-nojs-320');
  assert.ok(requests.every(request => new URL(request.url).origin === origin), 'all gallery assets are served locally');
  assert.ok(!requests.some(request => /\/api\/|\.(?:mp3|wav)(?:$|\?)/.test(new URL(request.url).pathname)), 'no API mutations, tracking or sound requests');
  console.log('noticing browser passed: attributed readings and museum context, native thread fragments, full-art modal/focus, 320–1440px and short landscape, reduced motion, exact still handoffs, failures and late-response cancellation, complete no-JavaScript reading');
});
