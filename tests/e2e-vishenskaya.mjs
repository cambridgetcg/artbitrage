// The guest room for a living painter: every image is recorded, the artist's works stay out of the open
// catalogue and API, and the "come closer" walk works with and without JavaScript.
// --browser uses the repository's isolated Chrome helper and the actual local JPEGs.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { withBrowser, until, origin } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const text = async path => (await read(path)).toString('utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'), 'Only --browser is supported');

const source = await text('vishenskaya.html');
const credits = JSON.parse(await text('assets/vishenskaya/credits.json'));

// 1. What deploys is what was checked.
for (const path of ['vishenskaya.html', 'assets/vishenskaya/credits.json', 'tools/receipts/vishenskaya/artic-captures.json', 'index.html', 'map.html', 'map.json', 'sitemap.xml', '_redirects']) {
  if (path.startsWith('tools/')) continue; // receipts are kept, not deployed
  assert.deepEqual(await read(`dist/${path}`), await read(path), `${path}: dist/ mirror is byte-identical`);
}

// 2. Every image file is recorded, hashed, shipped, and used; nothing recorded is missing from the page.
const recorded = new Map();
for (const work of [...credits.works, ...credits.museum_works]) {
  for (const image of work.images) {
    assert.ok(!recorded.has(image.file), `${image.file}: recorded once`);
    recorded.set(image.file, { work, image });
  }
}
const assetNames = (await readdir(new URL('assets/vishenskaya/', root))).filter(name => name.endsWith('.jpg')).sort();
assert.deepEqual(assetNames.map(name => `/assets/vishenskaya/${name}`), [...recorded.keys()].sort(), 'every JPEG in the folder has a record, and every record has a file');
for (const [file, { work, image }] of recorded) {
  const bytes = await read(file.slice(1));
  assert.deepEqual(await read(`dist${file}`), bytes, `${file}: dist/ mirror is byte-identical`);
  assert.equal(bytes.readUInt16BE(0), 0xffd8, `${file}: JPEG start`);
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, `${file}: JPEG end`);
  assert.equal(bytes.length, image.bytes, `${file}: size matches its record`);
  assert.equal(sha(bytes), image.sha256, `${file}: SHA-256 matches its record`);
  assert.ok(source.includes(file.slice(1)), `${file}: used by the room`);
  if (image.source) assert.equal(new URL(image.source).protocol, 'https:', `${file}: https source`);
  assert.ok(image.processing, `${file}: processing is stated`);
  if (image.role === 'full') assert.ok(source.includes(`href="${file.slice(1)}"`), `${work.id}: the full image is linked directly`);
}
const referenced = new Set([...source.matchAll(/assets\/vishenskaya\/[a-z-]+\.jpg/g)].map(match => `/${match[0]}`));
assert.deepEqual([...referenced].sort(), [...recorded.keys()].sort(), 'the page references exactly the recorded files');

// 3. The artist's rights stay hers: not CC0, not in the catalogue, the River or any API.
assert.equal(credits.works.length, 3);
for (const work of credits.works) {
  assert.equal(work.artist, 'Anna Vishenskaya');
  assert.equal(work.rights.public_domain, false, `${work.id}: not public domain`);
  assert.equal(work.rights.reusable, false, `${work.id}: not reusable`);
  assert.equal(work.rights.copyright, '© Anna Vishenskaya');
  assert.match(work.rights.permission, /permission/);
  for (const image of work.images) {
    if (image.source) assert.match(new URL(image.source).hostname, /^(?:cdn\.b12\.io|cdn\.shopify\.com)$/, `${image.file}: from the artist's own site or shop`);
  }
}
for (const work of credits.museum_works) {
  assert.equal(work.is_public_domain, true, `${work.id}: museum record says public domain`);
  assert.equal(work.rights.public_domain, true);
  assert.ok(source.includes(`href="${work.url}"`), `${work.id}: museum record linked in the room`);
  for (const image of work.images) {
    if (image.source) assert.match(new URL(image.source).hostname, /^(?:www\.artic\.edu|images\.metmuseum\.org)$/, `${image.file}: museum image host`);
  }
}
const catalogFiles = (await readdir(new URL('catalog/', root))).filter(name => name.endsWith('.json'));
for (const name of catalogFiles) assert.doesNotMatch(await text(`catalog/${name}`), /vishenskaya/i, `catalog/${name}: the living artist's works are not in the open catalogue`);
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) out.push(...await walk(`${path}/`)); else out.push(path);
  }
  return out;
}
for (const path of (await walk('functions/')).filter(path => /\.(?:js|mjs|json)$/.test(path))) {
  assert.doesNotMatch(await text(path), /vishenskaya/i, `${path}: no API route serves the artist's images`);
}
assert.match(source, /are © Anna Vishenskaya and appear here with her permission/);
assert.match(source, /they are not public domain or CC0, and they are not part of the open catalogue, the River or the API/);
assert.match(source, /<meta name="robots" content="noimageindex">/, 'image search does not index the artist’s images from this domain');

// 4. The artist's words appear exactly as she published them; interpretations are labelled as ours.
const ARTIST_WORDS = [
  'I have created my own universe. It exists at the edge of things, between day and night, between the physical and the unseen, between what we know and what we can only feel.',
  'Their intimate scale demands close attention, compelling the viewer into an unusual proximity. Only at this distance does the image fully reveal itself, returning the gaze as much as it receives it.',
  '<i>Hello, Darkness</i> explores the encounter with one’s own shadow. Inspired by Jung’s concept of the shadow, the work is about turning towards the parts of ourselves we fear or reject, rather than escaping them. Darkness here is not evil, but something familiar that asks to be recognised and integrated.',
  '<i>Veritas</i> is about the nature of truth and its tendency to reveal itself. Even when hidden, buried or distorted, truth eventually finds its way to the surface and crystallises into something that can no longer be ignored. The work reflects my interest in truth as a force that exists independently of our willingness to see it.',
  'Working primarily in oil on traditional wooden panels, I have developed a slow, layered process inspired by medieval painting techniques. Each work unfolds gradually over weeks or months, allowing the image to reveal itself in its own time.',
];
for (const words of ARTIST_WORDS) assert.ok(source.includes(words), `artist's words verbatim: ${words.slice(0, 48)}…`);
assert.equal((source.match(/<p class="label">A reading<\/p>/g) || []).length, 3);
assert.equal((source.match(/<p class="returned" data-returned>/g) || []).length, 3);
assert.match(source, /The artist has published no note for this work/, 'Poignant Wonder: no invented artist note');
assert.match(source, /not the artist’s statements/);

// 5. Accessibility and page hygiene.
for (const [, id] of source.matchAll(/<a class="panel"[^>]*aria-describedby="([^"]+)"/g)) {
  assert.match(source, new RegExp(`<img id="${id}" [^>]*alt="[^"]{60,}"`), `${id}: the panel is described by its image's alt`);
}
assert.equal((source.match(/<a class="panel"[^>]*aria-describedby=/g) || []).length, 3);
for (const [img] of source.matchAll(/<img\b[^>]*>/g)) {
  assert.match(img, /\balt="[^"]{30,}"/, 'every image has a real description');
  assert.match(img, /\bwidth="\d+" height="\d+"/, 'every image reserves its space');
}
const iconFiles = new Set([...source.slice(0, source.indexOf('</head>')).matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)" href="([^"]+)"/g)].map(match => match[1]));
assert.deepEqual([...iconFiles].sort(), ['/apple-touch-icon.png', '/favicon-16.png', '/favicon-32.png', '/favicon.ico', '/favicon.svg', '/site.webmanifest'], 'the room carries the shared icon block');
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(scripts.length, 1);
scripts.forEach(script => new Script(script));
assert.doesNotMatch(scripts.join('\n'), /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|setInterval)\b/);
for (const [tag] of source.matchAll(/<(?:script|link|img)\b[^>]*>/g)) {
  if (!/\brel="canonical"/.test(tag)) assert.doesNotMatch(tag, /(?:src|href|srcset)="https?:/, 'no third-party scripts, styles or images');
}
assert.match(source, /prefers-reduced-motion:reduce/);
assert.match(source, /id="corridor-hold"/, 'the moving corridor can be held still');

// 6. Doors: the foyer, the visitor guide, the sitemap and the short paths lead here once each.
const home = await text('index.html');
assert.equal((home.match(/href="vishenskaya\.html"/g) || []).length, 3, 'the foyer door (image and text link) and the footer credit for the foyer palette');
assert.match(home, /class="footer-palette">The foyer’s sky, floor and thread of gold come from Anna Vishenskaya’s panels/);
assert.match(home, /© the artist/);
assert.ok(JSON.parse(await text('map.json')).groups.flatMap(group => group.rooms).filter(room => room.path === '/vishenskaya').length === 1);
assert.equal(((await text('map.html')).match(/href="\/vishenskaya"/g) || []).length, 1);
assert.equal((await text('sitemap.xml')).split('<loc>https://artbitrage.io/vishenskaya</loc>').length - 1, 1);
const redirects = await text('_redirects');
assert.match(redirects, /^\/vishenskaya\/\s+\/vishenskaya 301$/m);
assert.match(redirects, /^\/anna-vishenskaya\s+\/vishenskaya 301$/m);
assert.match(source, /href="map.html#wings"/, 'room returns to the visitor guide');
console.log(`Vishenskaya static PASS: ${recorded.size} images hashed and mirrored; ${credits.works.length} works kept out of the open catalogue and API; ${ARTIST_WORDS.length} quotations verbatim.`);

if (process.argv.includes('--browser')) await withBrowser('vishenskaya', async b => {
  const route = async url => {
    if (/^\/assets\/vishenskaya\/[a-z-]+\.jpg$/.test(url.pathname)) return { type: 'image/jpeg', body: await read(url.pathname.slice(1)) };
    return null;
  };
  const html = source;
  const state = () => b.evaluate(`({
    js: document.documentElement.classList.contains('js'),
    width: innerWidth, contentWidth: document.documentElement.scrollWidth,
    buttons: [...document.querySelectorAll('[data-closer]')].map(el => ({hidden: el.hidden, pressed: el.getAttribute('aria-pressed'), text: el.textContent})),
    walls: [...document.querySelectorAll('[data-wall]')].map(el => ({close: el.classList.contains('is-close'), real: el.classList.contains('is-true')})),
    returned: [...document.querySelectorAll('.returned-text')].map(el => el.textContent),
    labels: [...document.querySelectorAll('.panel')].map(el => el.getAttribute('aria-label')),
    hold: (b => b && {hidden: b.hidden, pressed: b.getAttribute('aria-pressed')})(document.getElementById('corridor-hold')),
    still: document.querySelector('.corridor').classList.contains('is-still'),
    images: [...document.images].every(img => img.complete && img.naturalWidth > 0)
  })`);
  const eager = async () => {
    await b.evaluate('[...document.images].forEach(img => { img.loading = "eager"; })');
    await until(() => b.evaluate('[...document.images].every(img => img.complete && img.naturalWidth > 0)'), 'every local image loads', 20000);
  };

  // With JavaScript: the works hang far, the corridor moves and can be held still.
  await b.load({ html, path: '/vishenskaya.html', route });
  await eager();
  let s = await state();
  assert.equal(s.js, true);
  assert.ok(s.images, 'all images decode');
  assert.deepEqual(s.buttons.map(button => [button.hidden, button.pressed, button.text]), Array(3).fill([false, 'false', 'Come closer']));
  assert.deepEqual(s.returned, ['', '', ''], 'the returned questions wait to be earned');
  assert.ok(s.labels.every(label => label.startsWith('Come closer to ')));
  assert.deepEqual(s.hold, { hidden: false, pressed: 'false' });
  assert.equal(s.contentWidth, s.width, 'no horizontal scroll on desktop');
  await b.shot('desktop-threshold', '.intro');
  await b.click('#corridor-hold');
  s = await state();
  assert.deepEqual([s.still, s.hold.pressed], [true, 'true'], 'the corridor holds still on request');
  await b.shot('desktop-corridor', '.threshold');
  assert.match(await b.evaluate(`document.querySelector('#works .returned .label').textContent`), /stay a little/, 'the waiting label says what to do');
  const farHeight = await b.evaluate(`document.querySelector('#darkness-wall img').getBoundingClientRect().height`);

  // Come closer: the work grows, and after twelve seconds of staying close, it asks back.
  await b.click('#works [data-closer]');
  await until(() => b.evaluate(`document.querySelector('#darkness-wall').classList.contains('is-close')`), 'first wall comes closer');
  await new Promise(resolve => setTimeout(resolve, 1300));
  const closeHeight = await b.evaluate(`document.querySelector('#darkness-wall img').getBoundingClientRect().height`);
  assert.ok(closeHeight > farHeight * 1.8, `the painting grows when you come closer (${farHeight} → ${closeHeight})`);
  s = await state();
  assert.deepEqual(s.buttons[0], { hidden: false, pressed: 'true', text: 'Step back' });
  assert.equal(s.returned[0], '', 'not yet: the gaze takes time');
  await until(() => b.evaluate(`document.querySelectorAll('.returned-text')[0].textContent.length > 0`), 'the painting asks back', 16000);
  s = await state();
  assert.equal(s.returned[0], 'What have you been walking away from, that only wanted to be greeted?');
  assert.equal(await b.evaluate(`document.querySelector('#works .returned .label').textContent`), 'The painting asks back');
  assert.deepEqual(s.returned.slice(1), ['', ''], 'only the work you stayed with answers');
  await b.shot('desktop-close-darkness', '#works');
  await b.click('#works [data-closer]');
  s = await state();
  assert.deepEqual([s.walls[0].close, s.buttons[0].text, s.returned[0].length > 0], [false, 'Come closer', true], 'stepping back keeps what was asked');

  // About its real height, then closer again clears the true-size view.
  await b.click('[data-true-size]');
  s = await state();
  assert.equal(s.walls[1].real, true);
  assert.equal(await b.evaluate(`document.querySelector('.true-note').hidden`), false);
  const cm = await b.evaluate(`(() => { const probe = document.createElement('div'); probe.style.height = '19.5cm'; document.body.append(probe); const h = probe.getBoundingClientRect().height; probe.remove(); return h; })()`);
  const realHeight = await b.evaluate(`document.querySelector('#wonder-wall img').getBoundingClientRect().height`);
  assert.ok(Math.abs(realHeight - cm) < 2, `Poignant Wonder at its listed 19.5 cm (${realHeight}px vs ${cm}px)`);
  await b.evaluate(`document.querySelector('#wonder-wall img').decode()`);
  await b.shot('desktop-wonder-real', '#wonder');
  await b.click('#wonder [data-closer]');
  s = await state();
  assert.deepEqual([s.walls[1].close, s.walls[1].real], [true, false]);
  assert.equal(await b.evaluate(`document.querySelector('[data-true-size]').getAttribute('aria-pressed')`), 'false');
  await b.evaluate(`document.querySelector('#veritas').scrollIntoView()`);
  await b.shot('desktop-veritas-day', '#veritas');
  await b.shot('desktop-rhymes', '#rhymes');
  await b.shot('desktop-process', '#process');
  await b.shot('desktop-artist', '#artist');
  await b.shot('desktop-footer', '.colophon');

  // Reduced motion: no corridor animation and no hold button to press.
  await b.media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await b.load({ html, path: '/vishenskaya.html', route });
  s = await state();
  assert.equal(s.hold.hidden, true, 'nothing moves, so nothing needs holding');
  assert.equal(await b.evaluate(`getComputedStyle(document.querySelector('.c-floor')).animationName`), 'none');
  await b.media([]);

  // Phone width: no sideways scroll, the walk still works.
  await b.viewport(390, 844, true);
  await b.load({ html, path: '/vishenskaya.html', route });
  await eager();
  s = await state();
  assert.ok(s.contentWidth <= s.width, `no horizontal scroll at 390px (${s.contentWidth} > ${s.width})`);
  const small = await b.evaluate(`[...document.querySelectorAll('a, button')].filter(el => el.getClientRects().length && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden').filter(el => el.getBoundingClientRect().height < 44 && !el.closest('p, li, blockquote, figcaption')).map(el => el.textContent.trim())`);
  assert.deepEqual(small, [], 'standalone controls are at least 44px tall');
  await b.shot('mobile-intro');
  await b.click('#veritas [data-closer]');
  await new Promise(resolve => setTimeout(resolve, 1300));
  await b.shot('mobile-veritas-close', '#veritas-wall');

  // Without JavaScript: everything is readable, the questions are simply there.
  await b.viewport(1440);
  await b.send('Emulation.setScriptExecutionDisabled', { value: true });
  await b.load({ html, path: '/vishenskaya.html', route });
  const noJs = await b.evaluate(`({
    js: document.documentElement.classList.contains('js'),
    buttons: [...document.querySelectorAll('[data-closer], [data-true-size], #corridor-hold')].every(el => el.hidden),
    returned: [...document.querySelectorAll('.returned-text')].map(el => el.textContent),
    labels: [...document.querySelectorAll('.panel')].map(el => el.getAttribute('aria-label')),
    hrefs: [...document.querySelectorAll('.panel')].map(el => el.getAttribute('href'))
  })`);
  assert.equal(noJs.js, false);
  assert.equal(noJs.buttons, true, 'no dead buttons without JavaScript');
  assert.ok(noJs.returned.every(question => question.endsWith('?')), 'the questions are readable without JavaScript');
  assert.ok(noJs.labels.every(label => label.startsWith('Open the full image of ')));
  assert.deepEqual(noJs.hrefs, ['assets/vishenskaya/hello-darkness.jpg', 'assets/vishenskaya/poignant-wonder.jpg', 'assets/vishenskaya/veritas.jpg']);
  await b.send('Emulation.setScriptExecutionDisabled', { value: false });

  const outside = b.requests.filter(request => !request.url.startsWith(origin) && !request.url.startsWith('data:'));
  assert.deepEqual(outside.map(request => request.url), [], 'the room asks nothing of any outside host');
});
