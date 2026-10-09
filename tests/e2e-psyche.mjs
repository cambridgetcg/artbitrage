// The room, its museum records, and the files actually shipped in dist agree.
// --browser uses the repository's isolated Chrome helper and actual local JPEGs.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { onRequestGet } from '../functions/api/[[route]].js';
import { withBrowser, until, origin } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const json = async path => JSON.parse(await read(path));
const key = work => `${work.source}:${work.id}`;
const expectedKeys = ['met:188954', 'met:335682', 'nga:115380', 'met:191329', 'met:207480'];
const source = (await read('psyche.html')).toString();
const wing = await json('catalog/psyche.json');
const index = await json('catalog/index.json');
const all = await json('catalog/all.json');
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'), 'Only --browser is supported');
assert.deepEqual(wing.artworks.map(key), expectedKeys);
assert.equal(wing.count, expectedKeys.length);
assert.equal(new Set(wing.artworks.map(key)).size, wing.count);
// The catalogue with the Psyche wing: pinned, so a silent drop or duplicate in any shard shows up here.
assert.deepEqual([index.total, index.unique_works, index.wings_count], [606, 596, 13], 'catalogue totals: placements, unique works, wings');

for (const path of ['psyche.html', 'catalog/psyche.json', 'catalog/index.json', 'catalog/all.json', 'index.html', 'explore.html', 'map.html', 'map.json', 'sitemap.xml', '_redirects']) {
  assert.deepEqual(await read(path), await read(`dist/${path}`), `${path}: published mirror must match`);
}

const shardNames = (await readdir(new URL('catalog/', root))).filter(name => name.endsWith('.json') && !['all.json', 'index.json'].includes(name)).sort();
const shards = await Promise.all(shardNames.map(name => json(`catalog/${name}`)));
const unique = new Map();
const sourceCounts = {};
for (const shard of shards) {
  assert.equal(shard.count, shard.artworks.length, `${shard.wing}: count agrees with records`);
  const summary = index.wings.find(item => item.wing === shard.wing);
  assert.ok(summary, `${shard.wing}: missing from index`);
  for (const field of ['title', 'description', 'count', 'cover_image']) assert.equal(summary[field], shard[field], `${shard.wing}: ${field}`);
  for (const work of shard.artworks) {
    sourceCounts[work.source_name] = (sourceCounts[work.source_name] || 0) + 1;
    if (!unique.has(key(work))) unique.set(key(work), work);
  }
}
const placements = shards.reduce((sum, shard) => sum + shard.artworks.length, 0);
assert.equal(index.total, placements);
assert.equal(index.unique_works, unique.size);
assert.equal(index.wings_count, shards.length);
assert.deepEqual(index.sources, sourceCounts);
assert.deepEqual(Object.fromEntries(Object.entries(all).filter(([field]) => field !== 'artworks')), index);
assert.equal(all.artworks.length, unique.size);
assert.equal(new Set(all.artworks.map(key)).size, unique.size);
for (const work of all.artworks) assert.deepEqual(work, unique.get(key(work)), `${key(work)}: master matches shard`);

const images = new Map();
for (const work of wing.artworks) {
  assert.equal(work.wing, 'psyche');
  assert.equal(work.rights.public_domain, true);
  assert.equal(work.rights.status, 'source-declared');
  assert.equal(work.rights.license, work.license);
  assert.equal(work.rights.source_url, work.url);
  assert.ok(work.rights.credit);
  assert.match(work.as_of, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(work.note_status, 'Artbitrage interpretation');
  for (const field of ['url', 'record_source', 'source_image']) {
    const url = new URL(work[field]);
    assert.equal(url.protocol, 'https:');
    assert.ok(/(?:^|\.)(?:metmuseum\.org|nga\.gov)$/.test(url.hostname), `${key(work)} ${field}: museum source`);
  }
  assert.ok(source.includes(`href="${work.url}"`), `${key(work)}: direct record link in room`);
  for (const field of ['image', 'thumbnail']) {
    const url = new URL(work[field]);
    assert.equal(url.origin, 'https://artbitrage.io');
    // A curated room's images live in assets/<room>/, at the repo root (what tools/preview.mjs serves) and byte-identical in dist/ (what deploys).
    assert.match(url.pathname, /^\/assets\/psyche\/[a-z]+(?:-t)?\.jpg$/);
    const bytes = await read(`dist${url.pathname}`);
    assert.deepEqual(await read(url.pathname.slice(1)), bytes, `${url.pathname}: published mirror must match`);
    assert.equal(bytes.readUInt16BE(0), 0xffd8, `${url.pathname}: JPEG start`);
    assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, `${url.pathname}: JPEG end`);
    assert.ok(bytes.length > 1000, `${url.pathname}: non-empty image`);
    if (field === 'image') {
      assert.match(work.image_sha256, /^[a-f0-9]{64}$/);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), work.image_sha256, `${key(work)}: source image SHA-256`);
      assert.ok(source.includes(`href="${url.pathname.slice(1)}"`), `${key(work)}: closer view opens the shipped image`);
      assert.ok(source.includes(`${url.pathname.slice(1)} `), `${key(work)}: full image is a responsive candidate`);
    } else {
      assert.equal(createHash('sha256').update(bytes).digest('hex'), work.thumbnail_sha256, `${key(work)}: thumbnail SHA-256`);
      assert.ok(source.includes(`src="${url.pathname.slice(1)}"`), `${key(work)}: room uses the shipped thumbnail fallback`);
    }
    images.set(url.pathname, bytes);
  }
}
assert.equal((source.match(/class="image-frame"/g) || []).length, wing.count);
// Each frame is named "Look closer at …" and described by its image's alt; each closer link names its work too.
for (const [frame, describedBy] of source.matchAll(/<a class="image-frame"[^>]*aria-describedby="([^"]+)"[^>]*>/g)) {
  assert.match(frame, /aria-label="Look closer at [^"]+"/);
  assert.match(source, new RegExp(`<img id="${describedBy}" [^>]*alt="[^"]{30,}"`), `${describedBy}: frame description is the image alt`);
}
assert.equal((source.match(/<a class="image-frame"[^>]*aria-describedby=/g) || []).length, wing.count);
assert.equal((source.match(/<a class="closer"[^>]*aria-label="Look closer at [^"]+">Look closer<\/a>/g) || []).length, wing.count);
assert.match(source, /<a href="https:\/\/ai-love\.cc\/">YOUSPEAK<\/a>/, 'YOUSPEAK links to its public home');
// The shared 閒 icon block (tools/brand/head.py): the browser may ask for exactly these site-root files, nothing else.
const iconFiles = new Set([...source.slice(0, source.indexOf('</head>')).matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)" href="([^"]+)"/g)].map(match => match[1]));
assert.deepEqual([...iconFiles].sort(), ['/apple-touch-icon.png', '/favicon-16.png', '/favicon-32.png', '/favicon.ico', '/favicon.svg', '/site.webmanifest'], 'the room carries the shared icon block');
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
scripts.forEach(script => new Script(script));
assert.doesNotMatch(scripts.join('\n'), /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|setInterval)\b/);
for (const [tag] of source.matchAll(/<(?:script|link)\b[^>]*>/g)) {
  if (!/\brel="canonical"/.test(tag)) assert.doesNotMatch(tag, /(?:src|href)="https?:/);
}
const home = (await read('index.html')).toString();
assert.equal((home.match(/href="psyche\.html"/g) || []).length, 1);
assert.match(home, /href="explore\.html"/, 'foyer leads to the collection');
const collection = (await read('explore.html')).toString();
const collectionWings = collection.split('<div class="wings rise">')[1].split('</div>')[0];
const collectionDoors = [...collectionWings.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]);
assert.equal(collectionDoors.filter(href => href === 'psyche.html').length, 1);
assert.equal(collectionDoors[collectionDoors.indexOf('river.html') + 1], 'psyche.html', 'Psyche has a collection door beside the River');
assert.match(source, /href="map.html#wings"/, 'room returns to the current visitor guide');
assert.ok((await json('map.json')).groups.flatMap(group => group.rooms).some(room => room.path === '/psyche'));
const map = (await read('map.html')).toString();
assert.ok(map.includes('href="/psyche"'));
assert.match(map, /id="wings"/, 'room return anchor exists');
assert.equal((await read('sitemap.xml')).toString().split('<loc>https://artbitrage.io/psyche</loc>').length - 1, 1);

const env = { ASSETS: { async fetch(url) {
  const path = new URL(url).pathname;
  try { return new Response(await read(`dist${path}`), { headers: { 'Content-Type': 'application/json' } }); }
  catch { return new Response('not found', { status: 404 }); }
} } };
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => { throw new Error('Museum routes must use local catalogue assets'); };
  async function get(path) {
    const response = await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env });
    assert.equal(response.status, 200, path);
    return response.json();
  }
  assert.deepEqual(await get('/api/wings/psyche'), wing);
  assert.deepEqual((await get('/api/museum?wing=psyche')).artworks.map(key), expectedKeys);
  for (const work of wing.artworks) {
    const record = await get(`/api/museum/${work.source}/${work.id}`);
    assert.equal(key(record), key(work));
    assert.equal(record.url, work.url);
    assert.equal(record.rights.status, 'source-declared');
    assert.equal(record.rights.license_verified, false);
  }
} finally { globalThis.fetch = originalFetch; }
console.log(`Psyche static PASS: ${wing.count} sourced works; ${unique.size} unique / ${placements} placements; JPEG hashes, mirrors, doors and museum routes agree.`);

if (process.argv.includes('--browser')) await withBrowser('psyche', async b => {
  const { evaluate, load, viewport, media, send, shot, requests } = b;
  const route = (url, type) => type === 'Image' && images.has(url.pathname) ? { body: images.get(url.pathname), type: 'image/jpeg' } : null;
  const keypress = async (key, code, keyCode, text) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, ...(text ? { text } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  };
  const state = () => evaluate(`(() => {
    const visible = node => { const s = getComputedStyle(node); return s.display !== 'none' && s.visibility === 'visible' && Number(s.opacity) > 0 && !!node.getBoundingClientRect().height; };
    return { width: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      scale: visualViewport ? visualViewport.scale : 1,
      text: document.querySelector('main').innerText,
      images: [...document.querySelectorAll('.image-frame img')].map(img => ({ loaded: img.complete && img.naturalWidth > 0, width: img.naturalWidth, visible: visible(img), alt: img.alt })),
      open: document.querySelector('dialog').open,
      fallback: [...document.querySelectorAll('.image-error')].map(visible),
      animations: document.getAnimations().filter(a => a.playState === 'running').length
    };
  })()`);
  const readable = view => {
    // clientWidth, not innerWidth: under mobile emulation Chrome zooms out to fit any overflow, so innerWidth grows with it.
    assert.ok(view.scrollWidth <= view.clientWidth, `overflow: ${view.scrollWidth}/${view.clientWidth}`);
    assert.equal(view.scale, 1, `no zoom-out to fit overflow at ${view.clientWidth}px`);
    assert.equal(view.images.length, wing.count);
    assert.match(view.text, /YOUSPEAK/);
    for (const name of ['Canova', 'Giovanni David', 'Picot', 'Rodin', 'Reymond']) assert.ok(view.text.includes(name), `${name}: readable without disclosure controls`);
  };
  async function revealImages() {
    for (let i = 0; i < wing.count; i++) {
      await evaluate(`document.querySelectorAll('.image-frame')[${i}].scrollIntoView({behavior:'instant',block:'center'})`);
      await until(async () => (await state()).images[i].loaded, `museum JPEG ${i + 1} decoded`);
    }
  }
  await load({ html: source, route });
  await revealImages();
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await viewport(width, 1000, width < 800);
    const view = await state(); readable(view);
    assert.ok(view.images.every(image => image.loaded && image.visible && image.alt.length > 30));
    await evaluate('window.scrollTo(0,0)');
    if (width !== 320) await shot(`room-${width}`);
  }
  await viewport(1440);
  await evaluate(`document.querySelector('.image-frame').focus()`);
  await keypress('Enter', 'Enter', 13, '\r');
  await until(async () => (await state()).open, 'keyboard opens the closer view');
  await until(() => evaluate(`document.querySelector('.dialog-image').naturalWidth > 0`), 'closer-view JPEG decoded');
  assert.ok(await evaluate(`document.activeElement.matches('.dialog-close')`), 'modal starts on its close button');
  await keypress('Escape', 'Escape', 27);
  await until(async () => !(await state()).open, 'Escape closes the closer view');
  await until(() => evaluate(`document.body.style.overflow === '' && document.activeElement === document.querySelector('.image-frame')`), 'close event restores page scrolling and opener focus');
  assert.ok(await evaluate(`document.activeElement === document.querySelector('.image-frame')`), 'Escape returns focus to the opener');
  assert.equal(await evaluate('document.body.style.overflow'), '');
  await keypress('Enter', 'Enter', 13, '\r');
  await until(async () => (await state()).open, 'reopen the closer view');
  await keypress('Enter', 'Enter', 13, '\r');
  await until(async () => !(await state()).open, 'keyboard close button closes dialog');
  await until(() => evaluate(`document.body.style.overflow === '' && document.activeElement === document.querySelector('.image-frame')`), 'close button restores page scrolling and opener focus');
  assert.ok(await evaluate(`document.activeElement === document.querySelector('.image-frame')`));
  await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  readable(await state());
  assert.equal((await state()).animations, 0, 'reduced motion has no ongoing animation');
  await media();

  await load({ html: source, route: (url, type) => /^\/assets\/psyche\/canova(?:-t)?\.jpg$/.test(url.pathname) ? { status: 404, body: 'missing', type: 'text/plain' } : route(url, type) });
  await until(async () => (await state()).fallback[0], 'failed image has a visible fallback');
  readable(await state());
  assert.ok(await evaluate(`document.querySelector('#works a[href="${wing.artworks[0].url}"]') !== null`), 'museum source survives image failure');
  await evaluate(`document.querySelector('.image-frame').focus()`);
  await keypress('Enter', 'Enter', 13, '\r');
  await until(() => evaluate(`document.querySelector('dialog').open && !document.querySelector('.dialog-error').hidden`), 'failed closer view explains missing image');
  await keypress('Escape', 'Escape', 27);

  await send('Emulation.setScriptExecutionDisabled', { value: true });
  try {
    await viewport(320, 1000, true);
    await load({ html: source, route });
    await revealImages();
    readable(await state());
    assert.ok((await state()).images.every(image => image.loaded && image.visible));
    assert.equal((await state()).open, false);
    assert.ok(await evaluate(`document.querySelector('.image-frame').getAttribute('href') === 'assets/psyche/canova.jpg'`), 'no-JS image link remains usable');
  } finally { await send('Emulation.setScriptExecutionDisabled', { value: false }); }
  for (const request of requests) {
    const url = new URL(request.url);
    assert.equal(url.origin, origin, `unexpected external runtime request: ${request.url}`);
    assert.ok((request.resourceType === 'Document' && url.pathname === '/psyche.html') || (request.resourceType === 'Image' && images.has(url.pathname)) || url.pathname === '/favicon.ico' || iconFiles.has(url.pathname), `unexpected runtime request: ${request.resourceType} ${request.url}`);
  }
  console.log('Psyche browser PASS: actual shipped JPEG decoding, no sideways scroll or zoom-out at 320/390/768/1024/1280/1440px, keyboard dialog/focus, failed-image messages, reduced motion, readable no-JS and no external runtime calls.');
});
