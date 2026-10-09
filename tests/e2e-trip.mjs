// Good Trip: isolated local fixtures, silent audio, and in-page mocked POSTs only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { withBrowser, until, origin } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root));
const html = read('trip.html').toString();
const legacy = JSON.parse(html.match(/<script type="application\/json" id="dataset">([\s\S]*?)<\/script>/)[1]).works;
const manifestFile = 'assets/visit/works.json';
const catalogueFile = 'assets/trip/works.json';
const manifest = JSON.parse(read(manifestFile));
const catalogue = JSON.parse(read(catalogueFile));
const routeIds = ['water-air', 'quiet-forms', 'colour-light'];
const legacyPaths = new Set(legacy.map(work => work.img));
const curatedByImage = new Map(catalogue.works.map(work => [work.image, work]));
const imagePaths = new Set([...legacyPaths, ...manifest.map(work => work.image), ...curatedByImage.keys()]);

assert.equal(legacy.length, 70, 'the wider collection retains all seventy works');
for (const work of legacy) {
  assert.match(work.img, /^\/art\/[^/]+\.jpg$/);
  assert.ok(read(`dist${work.img}`).length > 0);
}
assert.equal(catalogue.works.length, 19, 'thirteen gallery works and six new works form the gentle curated collection');
assert.equal(new Set(catalogue.works.map(work => work.id)).size, catalogue.works.length, 'curated IDs are unique');
for (const id of routeIds) {
  const route = catalogue.routes.find(route => route.id === id);
  assert.ok(route?.title && route.description, `${id} has a visitor-facing label and description`);
  assert.ok(catalogue.works.filter(work => work.route === id).length >= 2, `${id} can move between works`);
}
for (const work of catalogue.works) {
  assert.ok(routeIds.includes(work.route));
  assert.ok(work.id && work.title && work.maker && work.alt);
  assert.match(work.image, /^\/assets\/(?:trip|visit|welcome|guide)\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/);
  assert.match(work.source, /^https:\/\/www\.artic\.edu\/artworks\/\d+(?:\/[a-z0-9-]+)?$/);
  assert.equal(work.looking.length, 2);
  assert.ok(work.looking.every(prompt => typeof prompt === 'string' && prompt.trim().length > 10));
  assert.deepEqual(read(work.image.slice(1)), read(`dist${work.image}`), `${work.id} image mirror`);
}
const handoffOnly = new Set(['hokusai-great-wave', 'colour']);
for (const work of manifest) assert.equal(catalogue.works.some(item => item.image === work.image), !handoffOnly.has(work.id), `${work.id} curated/handoff boundary`);
assert.equal(catalogue.works.filter(work => !manifest.some(item => item.image === work.image)).length, 6, 'six additional works');
const attributedWork = catalogue.works.find(work => work.id === 'hartley-movement');
assert.ok(attributedWork?.attribution, 'the licensed Hartley photograph has its attribution');
assert.match(attributedWork.attributionSource, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
assert.equal(attributedWork.attributionLicense, 'https://creativecommons.org/licenses/by-sa/4.0/');
for (const file of ['trip.html', 'trip.js', 'trip.css', 'breathing.js', 'breathing.css', manifestFile, catalogueFile]) {
  assert.deepEqual(read(file), read(`dist/${file}`), `${file} deploy mirror`);
}
new Script(read('trip.js').toString());
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(match[1]);
assert.match(html, /<script[^>]+src="(?:\/)?trip\.js(?:\?[^\"]*)?"/);
assert.match(html, /<link[^>]+href="(?:\/)?trip\.css(?:\?[^\"]*)?"/);
assert.doesNotMatch(html, /<(?:audio|video)[^>]*autoplay/i);
assert.doesNotMatch(html, /<dialog\b[^>]*id="trip-(?:breath|anchor)-surface"/);
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));
console.log(`trip static checks passed: seventy wider works, ${catalogue.works.length} verified curated works, three routes, shared inline guide, sources/assets/mirrors and external-script syntax`);
if (!process.argv.includes('--browser')) process.exit(0);

const assets = new Set(['trip.js', 'trip.css', 'breathing.js', 'breathing.css', ...[...imagePaths].filter(path => !legacyPaths.has(path)).map(path => path.slice(1))]);
let manifestMode = 'normal', catalogueMode = 'normal', failArt = false, failContext = false, holdArt = false;
let releaseManifest, releaseCatalogue, releaseImage, heldImage;
const route = async url => {
  if (url.pathname === `/${manifestFile}` || url.pathname === `/${catalogueFile}`) {
    const isVisit = url.pathname === `/${manifestFile}`;
    const mode = isVisit ? manifestMode : catalogueMode;
    if (mode === 'failed') return { status: 503, type: 'application/json', body: '{}' };
    const response = { type: 'application/json', body: JSON.stringify(isVisit ? manifest : catalogue) };
    if (mode === 'held') return new Promise(resolve => {
      if (isVisit) releaseManifest = () => resolve(response);
      else releaseCatalogue = () => resolve(response);
    });
    return response;
  }
  if (imagePaths.has(url.pathname)) {
    const failed = failArt || (failContext && url.pathname === manifest.find(work => work.id === 'poems').image);
    const response = failed ? { status: 404, type: 'image/jpeg', body: '' }
      : { type: url.pathname.endsWith('.png') ? 'image/png' : url.pathname.endsWith('.webp') ? 'image/webp' : 'image/jpeg', body: read(legacyPaths.has(url.pathname) ? `dist${url.pathname}` : url.pathname.slice(1)) };
    if (holdArt) {
      holdArt = false;
      heldImage = url.pathname;
      return new Promise(resolve => { releaseImage = () => resolve(response); });
    }
    return response;
  }
  const path = url.pathname.slice(1);
  if (!assets.has(path)) return null;
  return { type: path.endsWith('.js') ? 'text/javascript' : 'text/css', body: read(path) };
};

const init = `(() => {
  window.__injected=0;
  const audio=window.__audio={created:0,resumes:0,suspends:0,mode:'normal',pending:[],values:[]};
  const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(value){this.value=value;audio.values.push(value);},linearRampToValueAtTime(value){this.value=value;audio.values.push(value);},setTargetAtTime(value){this.value=value;audio.values.push(value);}});
  class MockAudioContext {
    constructor(){audio.created++;this.currentTime=0;this.destination={};this.state='suspended';}
    createGain(){return{gain:param(),connect(){}};}createBiquadFilter(){return{frequency:param(),Q:param(),connect(){}};}
    createOscillator(){return{frequency:param(),detune:param(),connect(){},start(){}};}
    resume(){audio.resumes++;if(audio.mode==='reject')return Promise.reject(new Error('Audio denied'));if(audio.mode==='pending')return new Promise(resolve=>audio.pending.push(()=>{this.state='running';resolve();}));this.state='running';return Promise.resolve();}
    suspend(){audio.suspends++;this.state='suspended';return Promise.resolve();}
  }
  window.AudioContext=window.webkitAudioContext=MockAudioContext;
  HTMLMediaElement.prototype.play=function(){throw new Error('No real media playback in Trip tests');};
  window.__imageEvents=[];
  const NativeImage=window.Image;
  window.Image=function(...args){const image=new NativeImage(...args);for(const type of ['load','error'])image.addEventListener(type,()=>__imageEvents.push({src:new URL(image.src,location.href).pathname,type}));return image;};
  window.Image.prototype=NativeImage.prototype;
  const originalFetch=fetch.bind(window);
  window.__posts={count:0,status:503};window.__manifestReads=0;window.__catalogueReads=0;
  window.fetch=(url,options={})=>{
    if((options.method||'GET').toUpperCase()==='POST'){__posts.count++;if(url!=='/api/pebbles')throw new Error('Unexpected POST');return Promise.resolve(new Response('{}',{status:__posts.status,headers:{'content-type':'application/json'}}));}
    return originalFetch(url,options).then(async response=>{if(url==='/assets/visit/works.json'){await response.clone().text();__manifestReads++;}if(url==='/assets/trip/works.json'){await response.clone().text();__catalogueReads++;}return response;});
  };
  window.__setHidden=hidden=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});document.dispatchEvent(new Event('visibilitychange'));};
  const originalSet=setTimeout.bind(window),originalClear=clearTimeout.bind(window);let id=-1000;
  const timers=window.__timers=new Map();
  window.setTimeout=(callback,delay,...args)=>{if([4000,7000,12000,55000,67000].includes(delay)){const key=id--;timers.set(key,{delay,run:()=>callback(...args)});return key;}return originalSet(callback,delay,...args);};
  window.clearTimeout=key=>{if(timers.has(key))timers.delete(key);else originalClear(key);};
  window.__fireDrift=()=>{const next=Array.from(timers).find(([,timer])=>[55000,67000].includes(timer.delay));if(!next)throw new Error('No drift timer');timers.delete(next[0]);next[1].run();};
  window.__finishCreditFade=()=>{const next=Array.from(timers).find(([,timer])=>timer.delay===12000);if(!next)throw new Error('No attribution fade timer');timers.delete(next[0]);next[1].run();};
})();`;

await withBrowser('trip', async b => {
  const { load, evaluate, click, send, media, viewport, shot, requests } = b;
  const modeButtons = { look: '#trip-look', breathe: '#trip-breathe', ground: '#trip-anchor' };
  const modePanels = { look: 'trip-look-surface', breathe: 'trip-breath-surface', ground: 'trip-anchor-surface' };
  const frames = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const shown = () => evaluate(`({title:document.querySelector('#trip-art-title').textContent,maker:document.querySelector('#trip-art-maker').textContent,image:document.querySelector('#trip-stage .is-current img')?.getAttribute('src'),source:document.querySelector('#trip-art-source').getAttribute('href')})`);
  const loaded = () => until(() => evaluate(`!!document.querySelector('#trip-stage .is-current img')?.naturalWidth&&!document.querySelector('#trip-next').disabled`), 'an artwork loads');
  const driftCount = () => evaluate(`Array.from(__timers.values()).filter(timer=>[55000,67000].includes(timer.delay)).length`);
  const guideRunning = () => evaluate(`document.querySelector('#trip-breath-host').breathing.running`);
  const catalogueReady = async () => { await until(() => evaluate('__catalogueReads===1'), 'the route catalogue settles'); await frames(); };
  const open = async (query = '', waitCatalogue = true) => {
    const url = origin + '/trip.html' + query;
    const result = await send('Page.navigate', { url });
    assert.ok(!result.errorText, result.errorText);
    await until(() => evaluate(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&document.querySelector('#trip-start')?.hidden===false&&!!document.querySelector('#trip-breath-host')?.breathing`), 'Trip document loads');
    if (waitCatalogue) await catalogueReady();
  };
  const expectMode = async mode => {
    assert.equal(await evaluate('document.body.dataset.practice'), mode);
    for (const [name, selector] of Object.entries(modeButtons)) {
      const state = await evaluate(`(()=>{const button=document.querySelector(${JSON.stringify(selector)}),panel=document.getElementById(${JSON.stringify(modePanels[name])});return{pressed:button.getAttribute('aria-pressed'),controls:button.getAttribute('aria-controls'),tag:panel.tagName,hidden:panel.hidden,inert:panel.inert};})()`);
      assert.equal(state.pressed, String(name === mode), `${name} selected state`);
      assert.equal(state.controls, modePanels[name]);
      assert.equal(state.tag, 'SECTION');
      assert.equal(state.hidden, name !== mode, `${name} visibility`);
      assert.equal(state.inert, name !== mode, `${name} focus boundary`);
    }
    assert.equal(await evaluate(`document.querySelector('#trip-stage .is-current img').getBoundingClientRect().width>0`), true, 'art stays on the shared stage');
  };
  const activate = async mode => {
    const selector = modeButtons[mode];
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`),true,'the native mode button receives focus before keyboard activation');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await expectMode(mode);
    assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`), true, 'mode selection preserves keyboard focus');
  };
  const collection = async id => {
    await evaluate(`(()=>{const select=document.querySelector('#trip-collection');select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await loaded();
    assert.equal(await evaluate(`document.querySelector('#trip-collection').value`), id);
    const work = await shown();
    if (id === 'wider') {
      assert.ok(legacyPaths.has(work.image));
      assert.equal(work.source, '/atlas');
      assert.equal(await evaluate(`document.querySelector('#trip-art-source').textContent`), 'Explore the Atlas ↗');
      assert.match(await evaluate(`document.querySelector('#trip-collection-note').textContent`), /wider|seventy|70/i);
    } else {
      assert.equal(curatedByImage.get(work.image)?.route, id, 'selection comes from its chosen route');
      assert.equal(work.source, curatedByImage.get(work.image).source);
    }
  };
  const layout = async label => {
    const state = await evaluate(`(()=>{const image=document.querySelector('#trip-stage .is-current img');return{width:innerWidth,page:document.documentElement.scrollWidth,fit:image?getComputedStyle(image).objectFit:null,small:Array.from(document.querySelectorAll('a,button,input,select,summary')).filter(el=>{const r=el.getBoundingClientRect();return el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&(r.height<43.9||r.width<43.9);}).map(el=>({id:el.id,text:el.textContent.trim().slice(0,45),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))};})()`);
    assert.ok(state.page <= state.width + 1, `${label}: page fits`);
    assert.deepEqual(state.small, [], `${label}: 44px controls`);
    if (state.fit) assert.equal(state.fit, 'contain', `${label}: the whole artwork remains visible`);
  };
  const holdAutomatic = async () => {
    releaseImage = null; heldImage = null; holdArt = true;
    await evaluate('__imageEvents=[];__fireDrift()');
    await until(() => Boolean(releaseImage), 'automatic image request is held');
  };
  const releaseHeld = async () => {
    const image = heldImage;
    releaseImage();
    await until(() => evaluate(`__imageEvents.some(event=>event.src===${JSON.stringify(image)})`), 'the delayed native image event arrives');
    await frames();
  };

  await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await load({ html, path: '/trip.html', route, init });
  await catalogueReady();
  assert.equal(await evaluate('document.body.dataset.mode'), 'entry');
  assert.equal(await evaluate('__audio.created'), 0);
  assert.equal(await evaluate('__posts.count'), 0);
  assert.equal(await driftCount(), 0);
  assert.equal(await guideRunning(), false);
  assert.deepEqual(await evaluate(`Array.from(document.querySelector('#trip-collection').options,option=>option.value)`), [...routeIds, 'wider']);
  assert.equal(await evaluate(`document.querySelector('#trip-collection').value`), 'water-air');
  assert.equal(await evaluate(`document.querySelectorAll('[data-trip-sound]').length`), 1, 'one global sound control');
  await shot('trip-entry-desktop');

  await click('#trip-just-breathe'); await loaded(); await expectMode('breathe');
  assert.equal(await evaluate('document.body.dataset.mode'), 'art');
  assert.equal(await guideRunning(), false, 'entering Breathe does not start a count');
  assert.equal(await driftCount(), 0, 'Just breathe opens a still artwork');
  await click('#trip-breath-host .breath-switch');
  assert.equal(await guideRunning(), true);
  await activate('look');
  assert.equal(await guideRunning(), false);
  assert.equal(await evaluate('__timers.size'), 0);
  await activate('breathe'); assert.equal(await guideRunning(), false, 'returning does not restart a guide');
  await click('#trip-exit');
  assert.equal(await evaluate('document.body.dataset.mode'), 'entry');
  assert.equal(await evaluate(`document.activeElement.id`), 'trip-start');

  await click('#trip-start'); await loaded(); await expectMode('look');
  assert.equal(await evaluate('document.body.dataset.drifting'), 'true');
  assert.equal(await driftCount(), 1);
  const first = await shown(); await evaluate('__fireDrift()');
  await until(async () => (await shown()).image !== first.image, 'automatic drift advances'); await loaded();
  assert.deepEqual(await evaluate(`Array.from(__timers.values()).filter(timer=>[55000,67000].includes(timer.delay)).map(timer=>timer.delay)`), [67000]);
  await activate('breathe'); assert.equal(await driftCount(), 1, 'Breathe preserves chosen drift');
  await click('#trip-breath-host .breath-switch');
  const beforeBreathDrift = await shown(); await evaluate('__fireDrift()');
  await until(async () => (await shown()).image !== beforeBreathDrift.image, 'the artwork drifts alongside breathing'); await loaded();
  assert.equal(await guideRunning(), true); assert.equal(await driftCount(), 1);
  await shot('trip-breathe-desktop', '#trip-gallery');
  const beforeManual = await shown(); await click('#trip-next'); await loaded();
  assert.notEqual((await shown()).image, beforeManual.image);
  assert.equal(await driftCount(), 0, 'manual Next pauses artwork drift');
  assert.equal(await guideRunning(), true, 'manual Next preserves the chosen guide');
  await activate('look'); assert.equal(await guideRunning(), false);
  const lookingWork = curatedByImage.get((await shown()).image);
  const lookingFirst = await evaluate(`document.querySelector('#trip-looking-prompt').textContent`);
  assert.ok(lookingWork.looking.includes(lookingFirst));
  await click('#trip-looking-next');
  const lookingSecond = await evaluate(`document.querySelector('#trip-looking-prompt').textContent`);
  assert.ok(lookingWork.looking.includes(lookingSecond)); assert.notEqual(lookingSecond, lookingFirst);

  const groundingWork = await shown(); await click('#trip-pause'); await activate('ground');
  assert.equal(await driftCount(), 0); assert.equal(await guideRunning(), false);
  assert.equal(await evaluate(`document.querySelector('#trip-pause').disabled`), true);
  const prompts = [];
  for (let i = 0; i < 6; i++) { prompts.push(await evaluate(`document.querySelector('#trip-anchor-prompt').textContent`)); await click('#trip-anchor-next'); }
  assert.ok(prompts[0].includes(lookingWork.looking[0]));
  assert.ok(prompts[2].includes(lookingWork.looking[1]));
  assert.equal(new Set(prompts).size, 6, 'grounding has six distinct artwork/room prompts');
  assert.deepEqual(await shown(), groundingWork, 'grounding prompts keep the work steady');
  await shot('trip-ground-desktop', '#trip-gallery');
  await click('#trip-pause'); assert.equal(await driftCount(), 0, 'Ground cannot accidentally start drift');
  await activate('look'); assert.equal(await driftCount(), 0, 'leaving Ground stays still');
  assert.equal(await evaluate('__audio.created'), 0, 'art and practice controls never start audio');
  for (const id of routeIds) await collection(id);
  await collection('wider');

  // A held automatic request must never replace a picture after a stop boundary.
  for (const stop of ['pause', 'ground', 'hidden', 'pagehide', 'exit']) {
    await open(); await click('#trip-start'); await loaded();
    const stable = await shown(); await holdAutomatic();
    if (stop === 'pause') await click('#trip-pause');
    if (stop === 'ground') await activate('ground');
    if (stop === 'hidden') await evaluate('__setHidden(true)');
    if (stop === 'pagehide') await evaluate(`window.dispatchEvent(new Event('pagehide'))`);
    if (stop === 'exit') await click('#trip-exit');
    assert.equal(await driftCount(), 0, `${stop} cancels drift`);
    await releaseHeld();
    assert.deepEqual(await shown(), stable, `${stop} rejects a stale artwork and its metadata`);
    if (stop === 'hidden') await evaluate('__setHidden(false)');
    assert.equal(await driftCount(), 0, `${stop} does not implicitly resume`);
  }
  await open(); await click('#trip-start'); await loaded(); await holdAutomatic();
  await collection('quiet-forms'); const newCollectionWork = await shown();
  await releaseHeld();
  assert.deepEqual(await shown(), newCollectionWork, 'a previous route cannot overwrite the newly selected route');
  assert.equal(await driftCount(), 0);

  // Sound remains explicitly chosen and cancellation-safe, without real output.
  await evaluate(`__audio.mode='reject'`); await click('#trip-sound');
  await until(() => evaluate(`/could not start/i.test(document.querySelector('#trip-audio-status').textContent)`), 'sound failures are explained');
  assert.equal(await evaluate(`document.querySelector('#trip-sound').getAttribute('aria-pressed')`), 'false');
  await evaluate(`__audio.mode='pending'`); await click('#trip-sound'); await click('#trip-sound');
  await evaluate('__audio.pending.shift()()');
  assert.equal(await evaluate(`document.querySelector('#trip-sound').getAttribute('aria-pressed')`), 'false', 'late resume cannot undo cancellation');
  await evaluate(`__audio.mode='normal'`); await click('#trip-sound');
  await until(() => evaluate(`document.querySelector('#trip-sound').getAttribute('aria-pressed')==='true'`), 'sound starts by choice');
  await click('#trip-pause'); await activate('breathe'); await click('#trip-breath-host .breath-switch');
  await evaluate('__setHidden(true)');
  assert.equal(await driftCount(), 0); assert.equal(await guideRunning(), false);
  assert.equal(await evaluate(`document.querySelector('#trip-sound').getAttribute('aria-pressed')`), 'false');
  const resumes = await evaluate('__audio.resumes'); await evaluate('__setHidden(false)');
  assert.equal(await evaluate('__audio.resumes'), resumes); assert.equal(await guideRunning(), false); assert.equal(await driftCount(), 0);
  await click('#trip-sound'); await click('#trip-pause'); await click('#trip-breath-host .breath-switch');
  await evaluate(`window.dispatchEvent(new Event('pagehide'))`);
  assert.equal(await driftCount(), 0); assert.equal(await guideRunning(), false);
  assert.equal(await evaluate(`document.querySelector('#trip-sound').getAttribute('aria-pressed')`), 'false');
  await evaluate(`__audio.mode='pending'`); await click('#trip-sound'); await evaluate('__setHidden(true);__audio.pending.shift()()');
  assert.equal(await evaluate(`document.querySelector('#trip-sound').getAttribute('aria-pressed')`), 'false', 'hidden page rejects a pending audio start');
  await evaluate('__setHidden(false)');
  await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await evaluate(`document.querySelector('#trip-pause').disabled`), true);
  await activate('look'); await shot('trip-art-desktop');

  // Visit handoffs retain their verified record and start still in Look.
  for (const work of [manifest[0], manifest.find(work => work.id === 'cycladic-figure'), manifest.find(work => work.id === 'poems'), ...manifest.filter(work => handoffOnly.has(work.id))]) {
    await open(`?work=${work.id}&room=colour`); await loaded(); await expectMode('look');
    assert.deepEqual(await shown(), { title: work.title, maker: work.maker, image: work.image, source: work.source });
    assert.equal(await evaluate(`document.querySelector('#trip-return').getAttribute('href')`), `/visit#${work.room}`);
    assert.equal(await evaluate('document.body.dataset.drifting'), 'false'); assert.equal(await evaluate('__audio.created'), 0);
  }
  for (const [query, back] of [['?work=missing&room=dusk', '/visit#dusk'], ['?room=water', '/visit#water'], ['?work=' + encodeURIComponent('<img src=x onerror=__injected=1>') + '&room=javascript:bad', '/visit']]) {
    await open(query); await until(() => evaluate(`!document.querySelector('#trip-entry-status').textContent.startsWith('Opening')`), 'invalid handoff settles');
    assert.equal(await evaluate('document.body.dataset.mode'), 'entry'); assert.equal(await evaluate('__injected'), 0);
    assert.equal(await evaluate(`document.querySelector('#trip-return').getAttribute('href')`), back);
  }
  manifestMode = 'failed'; await open('?work=poems');
  await until(() => evaluate(`/could not be opened/i.test(document.querySelector('#trip-entry-status').textContent)`), 'manifest failure preserves entry');
  assert.equal(await evaluate('document.body.dataset.mode'), 'entry'); manifestMode = 'normal';
  failContext = true; await open('?work=poems');
  await until(() => evaluate(`/could not be opened/i.test(document.querySelector('#trip-entry-status').textContent)`), 'context image failure preserves entry'); failContext = false;
  manifestMode = 'held'; releaseManifest = null; await open('?work=poems');
  await until(() => Boolean(releaseManifest), 'visit manifest is held');
  await click('#trip-just-breathe'); await loaded(); const chosen = await shown();
  releaseManifest(); manifestMode = 'normal';
  await until(() => evaluate('__manifestReads===1'), 'delayed visit manifest is consumed'); await frames();
  assert.deepEqual(await shown(), chosen); await expectMode('breathe');
  assert.equal(await evaluate(`document.querySelector('#trip-entry-status').textContent`), '');

  // A gallery image can arrive before its richer looking prompts. Enrich the
  // displayed step without resetting either practice or the visitor's place.
  const lateWork = manifest.find(work => work.id === 'poems');
  const latePrompts = catalogue.works.find(work => work.id === lateWork.id).looking;
  for (const practice of ['look', 'ground']) {
    catalogueMode = 'held'; releaseCatalogue = null; await open(`?work=${lateWork.id}`, false);
    await until(() => Boolean(releaseCatalogue), 'the handoff catalogue is held');
    await loaded(); await expectMode('look');
    await click('#trip-looking-next');
    if (practice === 'ground') { await activate('ground'); await click('#trip-anchor-next'); await click('#trip-anchor-next'); }
    const before = await shown();
    const step = await evaluate(`document.querySelector('#trip-anchor-step').textContent`);
    assert.notEqual(await evaluate(`document.querySelector('#trip-looking-prompt').textContent`), latePrompts[1], 'handoff begins with a generic prompt while the catalogue is pending');
    releaseCatalogue(); catalogueMode = 'normal'; await catalogueReady();
    assert.deepEqual(await shown(), before, 'late prompts preserve the displayed work and metadata');
    await expectMode(practice);
    assert.equal(await evaluate(`document.querySelector('#trip-looking-prompt').textContent`), latePrompts[1], 'the second looking prompt is enriched without resetting its index');
    assert.equal(await evaluate(`document.querySelector('#trip-anchor-step').textContent`), step, 'late prompts preserve the grounding step');
    assert.equal(await evaluate(`document.querySelector('#trip-anchor-prompt').textContent`), latePrompts[practice === 'ground' ? 1 : 0], 'the current grounding prompt is refreshed in place');
    assert.equal(await driftCount(), 0); assert.equal(await guideRunning(), false);
  }

  catalogueMode = 'held'; releaseCatalogue = null; await open('', false);
  await until(() => Boolean(releaseCatalogue), 'curated catalogue is held');
  await click('#trip-just-breathe'); await collection('wider'); const widerChoice = await shown();
  releaseCatalogue(); catalogueMode = 'normal'; await catalogueReady();
  assert.equal(await evaluate(`document.querySelector('#trip-collection').value`), 'wider');
  assert.deepEqual(await shown(), widerChoice, 'late curated response preserves the visitor’s wider-collection choice');
  await expectMode('breathe');
  catalogueMode = 'failed'; await open(); await click('#trip-just-breathe'); await loaded();
  assert.equal((await shown()).image, '/assets/welcome/moon-jar.jpg', 'catalogue failure still provides the Moon Jar');
  assert.equal(await guideRunning(), false); catalogueMode = 'normal';

  failArt = true; await open(); const requestStart = requests.length; await click('#trip-start');
  await until(() => evaluate(`!document.querySelector('#trip-retry').hidden`), 'bounded image failures expose Retry', 25000);
  const failures = requests.slice(requestStart).filter(request => imagePaths.has(new URL(request.url).pathname));
  assert.ok(failures.length > 0 && failures.length <= catalogue.works.length, `curated failure recovery is bounded (${failures.length} requests)`);
  assert.equal(await evaluate('document.body.dataset.drifting'), 'false');
  assert.equal(await evaluate(`document.querySelector('#trip-next').disabled`), false);
  failArt = false; await click('#trip-retry'); await loaded();
  assert.equal(await evaluate(`document.querySelector('#trip-retry').hidden`), true);
  await click('#trip-exit'); assert.equal(await evaluate('__posts.count'), 0); await click('#trip-pebble');
  await until(() => evaluate(`/could not/i.test(document.querySelector('#trip-pebble-status').textContent)`), 'mocked failed pebble permits retry');
  assert.equal(await evaluate(`document.querySelector('#trip-pebble').disabled`), false);
  await evaluate('__posts.status=200'); await click('#trip-pebble');
  await until(() => evaluate(`document.querySelector('#trip-pebble').textContent==='A pebble left'`), 'only a successful mocked response confirms a pebble');

  for (const [width, height] of [[320, 900], [390, 844], [768, 900], [1440, 900], [844, 390]]) {
    await viewport(width, height, width < 600); await open('?work=poems&room=poems'); await loaded(); await layout(`Look at ${width}px`);
    const work = await shown();
    for (const mode of ['breathe', 'ground', 'look']) {
      await activate(mode); assert.deepEqual(await shown(), work); await layout(`${mode} at ${width}px`);
      await evaluate(`document.getElementById(${JSON.stringify(modePanels[mode])}).scrollIntoView({block:'center',behavior:'instant'})`);
      await layout(`${mode} controls at ${width}px`);
      if (mode === 'breathe' && width === 390) {
        await click('#trip-breath-host .breath-switch');
        await evaluate(`window.scrollTo({top:document.querySelector('#trip-stage').getBoundingClientRect().top+scrollY-12,behavior:'instant'})`);
        const together = await evaluate(`(()=>{const art=document.querySelector('#trip-stage').getBoundingClientRect(),cue=document.querySelector('.breath-cue').getBoundingClientRect();return{height:innerHeight,artTop:art.top,artBottom:art.bottom,cueTop:cue.top,cueBottom:cue.bottom}})()`);
        assert.ok(together.artTop>=0&&together.artBottom<=together.height&&together.cueTop>=0&&together.cueBottom<=together.height, 'the whole stage and breathing cue coexist at390×844: '+JSON.stringify(together));
        await shot('trip-breath-mobile'); await shot('trip-breath-mobile-full', '#trip-gallery');
      }
    }
    await click('#trip-exit'); await layout(`entry at ${width}px`); if (width === 390) await shot('trip-entry-mobile');
  }
  await viewport(320, 900, true); await open(); await click('#trip-just-breathe'); await loaded();
  await collection(attributedWork.route);
  const routeSize=catalogue.works.filter(work=>work.route===attributedWork.route).length;
  for(let i=0;i<routeSize&&(await shown()).image!==attributedWork.image;i++){await click('#trip-next');await loaded();}
  assert.equal((await shown()).image,attributedWork.image,'the attributed work appears in its route');
  assert.equal(await evaluate(`document.querySelector('#trip-art-credit').hidden`),false);
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#trip-art-credit a'),a=>a.getAttribute('href'))`),[attributedWork.attributionSource,attributedWork.attributionLicense]);
  assert.ok(await evaluate(`document.querySelector('#trip-art-credit').textContent.includes(${JSON.stringify(attributedWork.title)})`), 'the attribution identifies its artwork');
  await layout('Hartley attribution at320px'); await shot('trip-hartley-320','#trip-gallery');

  // The outgoing licensed photograph remains visible during a crossfade, so
  // its credit must remain until that fade completes or is explicitly ended.
  await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const creditTimerCount = () => evaluate(`Array.from(__timers.values()).filter(timer=>timer.delay===12000).length`);
  for (const ending of ['elapsed', 'paused']) {
    for (let i=0;i<routeSize&&(await shown()).image!==attributedWork.image;i++){await click('#trip-next');await loaded();}
    assert.equal((await shown()).image, attributedWork.image);
    await click('#trip-pause'); await evaluate('__fireDrift()');
    await until(async () => (await shown()).image !== attributedWork.image, 'drift begins a fade away from the attributed work'); await loaded();
    assert.equal(await evaluate(`document.querySelector('#trip-art-credit').hidden`), false, 'outgoing photograph credit remains through the fade');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#trip-art-credit a'),a=>a.getAttribute('href'))`), [attributedWork.attributionSource,attributedWork.attributionLicense]);
    assert.equal(await creditTimerCount(), 1, 'one fade completion controls credit cleanup');
    if (ending === 'elapsed') await evaluate('__finishCreditFade()');
    else await click('#trip-pause');
    assert.equal(await creditTimerCount(), 0, `${ending} clears the credit timer`);
    assert.equal(await evaluate(`document.querySelector('#trip-art-credit').hidden`), true, `${ending} removes credit after the photograph leaves the stage`);
    assert.equal(await evaluate(`document.querySelectorAll('#trip-art-credit a').length`), 0);
    assert.equal(await driftCount(), ending === 'elapsed' ? 1 : 0, 'credit cleanup leaves drift in its chosen state');
  }

  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await load({ html, path: '/trip.html', route }); await viewport(320, 900, true);
  assert.ok(await evaluate(`document.querySelector('noscript').textContent.includes('own pace')`));
  assert.equal(await evaluate(`document.querySelector('#trip-start').hidden&&document.querySelector('#trip-just-breathe').hidden`), true);
  await until(() => evaluate(`document.querySelector('.trip-entry-art img').naturalWidth>0`), 'no-JavaScript whole artwork loads');
  await layout('no-JavaScript entry at 320px'); await shot('trip-nojs-320');
  assert.ok(requests.every(request => new URL(request.url).origin === origin), 'Trip makes no external requests');
  assert.ok(!requests.some(request => new URL(request.url).pathname === '/api/pebbles'), 'POSTs remained mocked inside the page');
  console.log('trip browser passed: curated/wider collections, shared artwork + inline practices, independent drift/guide, stale-image cancellation, silent audio, verified/late handoffs, fallback and bounded recovery, mocked pebbles, responsive and no-JavaScript entry');
});
