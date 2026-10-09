// E2E: the map must tell the truth —
// map.json must parse; every room it names must be a real file
// at the repo root; map.html must link every room; sitemap.xml
// must list every internal room exactly once. A map that lies
// is worse than no map: the gap it claims to bridge stays open.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Script } from 'node:vm';
import { withBrowser, until } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const failures = [];
function check(name, fn) {
  try { fn(); } catch (e) { failures.push(`${name}: ${e.message}`); }
}

// (a) map.json parses, and has the shape it promises
let map = null;
check('map.json parses', () => {
  map = JSON.parse(readFileSync(new URL('map.json', root), 'utf8'));
  assert.ok(Array.isArray(map.groups) && map.groups.length > 0, 'groups missing or empty');
});

const rooms = map ? map.groups.flatMap(g => g.rooms || []) : [];
const internal = rooms.filter(r => !r.external);
check('map.json has rooms', () => {
  assert.ok(rooms.length > 0, 'no rooms at all');
  assert.ok(internal.every(r => typeof r.path === 'string' && r.path.startsWith('/')),
    'an internal room path does not start with /');
});

// (b) every internal room path has a matching html file at repo root
for (const room of internal) {
  check(`file exists for ${room.path}`, () => {
    const file = room.path === '/' ? 'index.html' : `${room.path.slice(1)}.html`;
    assert.ok(existsSync(new URL(file, root)), `${file} not found at repo root`);
  });
}

// (c) map.html links every room in map.json (external ones too)
check('map.html readable', () => { readFileSync(new URL('map.html', root), 'utf8'); });
try {
  const html = readFileSync(new URL('map.html', root), 'utf8');
  for (const room of rooms) {
    check(`map.html links ${room.path}`, () => {
      assert.ok(html.includes(`href="${room.path}"`), `no href="${room.path}" in map.html`);
    });
  }
} catch { /* already recorded above */ }

const html = readFileSync(new URL('map.html', root), 'utf8');
const mediaPaths = {
  maples: 'assets/welcome/maples.jpg',
  seurat: 'assets/welcome/seurat.jpg',
  moonrise: 'assets/welcome/moonrise.jpg',
  kandinsky: 'assets/guide/kandinsky.jpg',
};
const artworkCredits = {};
check('artwork assets and source credits', () => {
  for (const directory of ['welcome', 'guide']) {
    const path = `assets/${directory}/credits.json`;
    const source = readFileSync(new URL(path, root), 'utf8');
    assert.equal(readFileSync(new URL(`dist/${path}`, root), 'utf8'), source, `${path} deploy mirror`);
    const credits = JSON.parse(source);
    for (const [key, asset] of Object.entries(mediaPaths)) {
      if (!asset.startsWith(`assets/${directory}/`)) continue;
      const credit = credits.find(item => asset === `assets/${directory}/${item.file}`);
      assert.ok(credit, `${asset} needs a source credit`);
      assert.ok(credit.title && credit.artist && credit.date && credit.source_name && credit.license);
      assert.match(credit.url, /^https:\/\/www\.artic\.edu\/artworks\/\d+$/);
      artworkCredits[key] = credit;
      assert.deepEqual(readFileSync(new URL(`dist/${asset}`, root)), readFileSync(new URL(asset, root)), `${asset} deploy mirror`);
    }
  }
  for (const asset of html.matchAll(/<img\b[^>]*src="([^"]+)"/g)) {
    assert.ok(Object.values(mediaPaths).includes(asset[1].slice(1)), `unexpected image asset ${asset[1]}`);
  }
  assert.match(html, /<fieldset class="view-controls" hidden>/);
  assert.match(html, /id="scene-open"[^>]*href="\/assets\/welcome\/maples\.jpg"/);
});
check('visitor guide and deploy mirrors', () => {
  assert.equal(readFileSync(new URL('dist/map.html', root), 'utf8'), html);
  assert.equal(readFileSync(new URL('dist/map.json', root), 'utf8'), readFileSync(new URL('map.json', root), 'utf8'));
  assert.match(html, /Art helps us feel, understand, and connect/);
  assert.match(html, /directory of named rooms, not a complete inventory/);
  assert.match(html, /rights vary by record/);
  assert.equal((html.match(/<article class="journey">/g) || []).length, 4);
  assert.ok(html.indexOf('class="journeys"') < html.indexOf('id="find"'));
  for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    new Script(script[1]);
    assert.doesNotMatch(script[1], /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/);
  }
});

// (d) sitemap.xml lists every internal room exactly once
check('sitemap honest', () => {
  const xml = readFileSync(new URL('sitemap.xml', root), 'utf8');
  for (const room of internal) {
    const loc = `<loc>https://artbitrage.io${room.path === '/' ? '/' : room.path}</loc>`;
    const count = xml.split(loc).length - 1;
    assert.equal(count, 1, `${room.path} appears ${count} times in sitemap.xml (want exactly 1)`);
  }
  assert.ok(xml.includes('<loc>https://artbitrage.io/map</loc>'), 'sitemap.xml must list /map itself');
});

if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} map check(s) FAILED`);
  process.exit(1);
}
console.log(`artbitrage map e2e passed (${rooms.length} rooms: json parses, every door real, every link drawn, sitemap honest)`);

// Optional real-browser checks reuse the repository's isolated Chrome harness.
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));
if (process.argv.includes('--browser')) await withBrowser('map', async b => {
  const { load, evaluate, viewport, media, send, click, shot, requests } = b;
  const route = url => {
    const path = url.pathname.slice(1);
    return Object.values(mediaPaths).includes(path)
      ? { type: 'image/jpeg', body: readFileSync(new URL(path, root)) }
      : null;
  };
  const keypress = async (key, code) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
  };
  const imageLoaded = selector => until(() => evaluate(`(() => {const image = document.querySelector(${JSON.stringify(selector)}); return image.complete && image.naturalWidth > 0;})()`), `${selector} artwork loads`);
  const expectScene = async key => {
    const scene = await evaluate(`({current: Array.from(document.querySelectorAll('[data-scene].is-current'), image => image.dataset.scene), pressed: Array.from(document.querySelectorAll('[data-view][aria-pressed="true"]'), button => button.dataset.view), title: document.querySelector('#scene-credit cite').textContent, maker: document.querySelector('#scene-credit span').textContent, art: document.querySelector('#scene-open').dataset.art, href: document.querySelector('#scene-open').getAttribute('href')})`);
    assert.deepEqual(scene.current, [key]);
    assert.deepEqual(scene.pressed, [key]);
    assert.equal(scene.title, artworkCredits[key].title);
    assert.equal(scene.maker, `${artworkCredits[key].artist} · ${artworkCredits[key].date}`);
    assert.equal(scene.art, key);
    assert.equal(scene.href, `/${mediaPaths[key]}`);
    await imageLoaded(`[data-scene="${key}"]`);
    await until(() => evaluate(`Array.from(document.querySelectorAll('[data-scene]')).every(image => Number(getComputedStyle(image).opacity) === (image.dataset.scene === ${JSON.stringify(key)} ? 1 : 0))`), 'selected backdrop finishes its transition');
  };
  const openArtwork = async (selector, key) => {
    await click(selector);
    await imageLoaded('#art-image');
    const state = await evaluate(`(() => {const image = document.querySelector('#art-image'); const rect = image.getBoundingClientRect(); return {open:document.querySelector('#art-dialog').open, title:document.querySelector('#art-title').textContent, maker:document.querySelector('#art-maker').textContent, source:document.querySelector('#art-source').getAttribute('href'), image:image.getAttribute('src'), alt:image.alt, prompt:document.querySelector('#art-prompt').textContent, focusedClose:document.activeElement.matches('.dialog-close'), naturalRatio:image.naturalWidth / image.naturalHeight, renderedRatio:rect.width / rect.height};})()`);
    assert.equal(state.open, true);
    assert.equal(state.title, artworkCredits[key].title);
    assert.equal(state.maker, `${artworkCredits[key].artist} · ${artworkCredits[key].date}`);
    assert.equal(state.source, artworkCredits[key].url);
    assert.equal(state.image, `/${mediaPaths[key]}`);
    assert.ok(state.alt && state.prompt);
    assert.equal(state.focusedClose, true);
    assert.ok(Math.abs(state.renderedRatio - state.naturalRatio) < .01, 'whole artwork retains its aspect ratio');
  };
  const closeArtwork = async (opener, escape = false) => {
    if (escape) await keypress('Escape', 27);
    else await click('.dialog-close');
    await until(() => evaluate(`!document.querySelector('#art-dialog').open && document.activeElement === document.querySelector(${JSON.stringify(opener)})`), 'closing artwork returns focus to opener');
  };
  const visibleRooms = () => evaluate(`Array.from(document.querySelectorAll('a.room')).filter(room => !room.hidden).map(room => room.getAttribute('href'))`);
  const layout = async () => {
    const state = await evaluate(`({width: innerWidth, contentWidth: document.documentElement.scrollWidth, smallTargets: Array.from(document.querySelectorAll('a, button, input')).filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').filter(el => el.getBoundingClientRect().height < 44).map(el => el.textContent)})`);
    assert.ok(state.contentWidth <= state.width + 1, `horizontal overflow at ${state.width}px`);
    assert.deepEqual(state.smallTargets, [], 'visible controls have at least 44px height');
  };
  await load({ html, route });
  assert.equal(await evaluate(`document.querySelector('.view-controls').hidden`), false);
  await expectScene('maples');
  assert.equal((await visibleRooms()).length, rooms.length);
  await layout();
  await shot('desktop-guide');
  await shot('desktop-artwork-hero', '.hero');
  for (const key of ['maples', 'seurat', 'moonrise']) {
    await click(`[data-view="${key}"]`);
    await expectScene(key);
    await openArtwork('#scene-open', key);
    await closeArtwork('#scene-open', key === 'seurat');
  }
  await click('[data-view="maples"]');
  for (const key of ['maples', 'moonrise', 'seurat', 'kandinsky']) {
    const link = `.journey-art .art-open[data-art="${key}"]`;
    await openArtwork(link, key);
    await closeArtwork(link, key === 'kandinsky');
  }
  await evaluate(`document.querySelector('.journeys').scrollIntoView({behavior:'instant'})`);
  await until(() => evaluate(`Array.from(document.querySelectorAll('.journey-art img')).every(image => image.complete && image.naturalWidth > 0)`), 'all journey artworks load');
  await shot('desktop-artwork-journeys', '.journeys');
  const nonImageRequests = () => requests.filter(request => request.resourceType !== 'Image').length;
  const requestCount = nonImageRequests();
  await evaluate(`document.getElementById('find').focus()`);
  await send('Input.insertText', { text: 'wine' });
  const wineRooms = await visibleRooms();
  assert.ok(wineRooms.includes('/wine') && wineRooms.includes('/pairing'));
  assert.ok(wineRooms.length < rooms.length);
  assert.match(await evaluate(`document.getElementById('find-status').textContent`), new RegExp(`${wineRooms.length} of ${rooms.length} named rooms match`));
  assert.equal(await evaluate(`document.querySelector('.journeys').getBoundingClientRect().height > 0`), true);
  await click('#clear-search');
  assert.equal((await visibleRooms()).length, rooms.length);
  assert.equal(await evaluate(`document.activeElement.id`), 'find');
  await send('Input.insertText', { text: '川' });
  assert.deepEqual(await visibleRooms(), ['/river']);
  await click('#clear-search');
  await send('Input.insertText', { text: 'no such room 72914' });
  assert.deepEqual(await visibleRooms(), []);
  assert.equal(await evaluate(`document.getElementById('no-results').hidden`), false);
  assert.match(await evaluate(`document.getElementById('find-status').textContent`), /^0 of /);
  await click('#clear-search');
  assert.equal(nonImageRequests(), requestCount, 'search does not make non-image network requests');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.ok(await evaluate(`document.activeElement.matches(':focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2`));
  for (const width of [320, 390, 768, 1024]) {
    await viewport(width, 900, width < 600);
    await layout();
    if (width === 390) {
      await evaluate(`scrollTo({top:0,behavior:'instant'})`);
      await shot('mobile-guide');
      await shot('mobile-artwork-hero', '.hero');
      await openArtwork('#scene-open', 'maples');
      await layout();
      await closeArtwork('#scene-open', true);
    }
  }
  await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).scrollBehavior`), 'auto');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.hero-art img')).transitionDuration`), '0s');
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await load({ html, route });
  await imageLoaded('[data-scene="maples"]');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.view-controls')).display`), 'none');
  await expectScene('maples');
  assert.equal(await evaluate(`document.querySelector('#art-dialog').open`), false);
  const fallbackLinks = await evaluate(`Array.from(document.querySelectorAll('.art-open'), link => ({key:link.dataset.art, href:link.getAttribute('href')}))`);
  assert.equal(fallbackLinks.length, 5);
  for (const link of fallbackLinks) assert.equal(link.href, `/${mediaPaths[link.key]}`, 'artwork links retain a direct-image fallback');
  assert.equal((await visibleRooms()).length, rooms.length, 'all directory links remain available without JavaScript');
  assert.equal(await evaluate(`document.querySelectorAll('.steps a').length`), 12);
  assert.equal(await evaluate(`document.querySelectorAll('.steps a[href="/unsigned"]').length`), 1, 'the room without names remains available without JavaScript');
  assert.equal(await evaluate(`document.querySelectorAll('.steps a[href="/noticing"]').length`), 1, 'the looking notebook remains available without JavaScript');
  assert.equal(await evaluate(`document.querySelectorAll('.steps a[href="/elements"]').length`), 1, 'the five-phase journey remains available without JavaScript');
  assert.equal(await evaluate(`document.querySelectorAll('.steps a[href="/behind-the-work"]').length`), 1, 'the new making-and-care journey remains available without JavaScript');
  await viewport(320, 900, true);
  await layout();
  await click('#scene-open');
  await until(() => evaluate(`location.pathname === '/assets/welcome/maples.jpg' && !document.querySelector('main') && document.querySelector('img')?.naturalWidth > 0`), 'no-JavaScript artwork link opens the image directly');
  console.log('map browser passed: three backdrops, source-matched artwork dialogs, Escape/Close focus return, four journey artworks, text/CJK/no-result search, no network search, 320–1440px, reduced motion, and no-JavaScript image/navigation fallbacks');
});
