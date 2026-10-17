// The Leonardo room: every public-domain image is recorded, hashed and shipped; quotations come from the
// museums' own notes; the mirror writer and the mirror toggles work, and the room reads without JavaScript.
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

const source = await text('leonardo.html');
const credits = JSON.parse(await text('assets/leonardo/credits.json'));

// 1. What deploys is what was checked.
for (const path of ['leonardo.html', 'assets/leonardo/credits.json', 'vishenskaya.html', 'index.html', 'map.html', 'map.json', 'sitemap.xml', '_redirects']) {
  assert.deepEqual(await read(`dist/${path}`), await read(path), `${path}: dist/ mirror is byte-identical`);
}

// 2. Every image is recorded once, hashed, shipped, used, and public domain at a museum host.
const recorded = new Map();
for (const work of credits.works) {
  assert.equal(work.is_public_domain, true, `${work.id}: museum record says public domain`);
  assert.equal(work.rights.public_domain, true);
  assert.ok(work.rights.credit, `${work.id}: credit line`);
  assert.ok(source.includes(`href="${work.url}"`), `${work.id}: museum record linked in the room`);
  for (const image of work.images) {
    assert.ok(!recorded.has(image.file), `${image.file}: recorded once`);
    recorded.set(image.file, { work, image });
    if (image.source) assert.match(new URL(image.source).hostname, /^(?:images\.metmuseum\.org|www\.artic\.edu)$/, `${image.file}: museum image host`);
    assert.ok(image.processing, `${image.file}: processing stated`);
  }
}
const names = (await readdir(new URL('assets/leonardo/', root))).filter(name => name.endsWith('.jpg')).sort();
assert.deepEqual(names.map(name => `/assets/leonardo/${name}`), [...recorded.keys()].sort(), 'every JPEG has a record and every record a file');
for (const [file, { work, image }] of recorded) {
  const bytes = await read(file.slice(1));
  assert.deepEqual(await read(`dist${file}`), bytes, `${file}: dist/ mirror is byte-identical`);
  assert.equal(bytes.readUInt16BE(0), 0xffd8, `${file}: JPEG start`);
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, `${file}: JPEG end`);
  assert.equal(bytes.length, image.bytes, `${file}: size matches its record`);
  assert.equal(sha(bytes), image.sha256, `${file}: SHA-256 matches its record`);
  if (/Unaltered/.test(image.processing) && image.source_sha256) assert.equal(image.sha256, image.source_sha256, `${file}: unaltered means byte-identical to the source`);
  if (image.role === 'full') assert.ok(source.includes(`href="${file.slice(1)}"`), `${work.id}: the full image is linked directly`);
}
const referenced = new Set([...source.matchAll(/assets\/leonardo\/[a-z-]+\.jpg/g)].map(match => `/${match[0]}`));
assert.deepEqual([...referenced].sort(), [...recorded.keys()].sort(), 'the page references exactly the recorded files');

// 3. Words in quotation marks come from the museums' and library's published notes, as read on 2026-10-17.
const QUOTED = [
  'I will discourse of the hands of each animal to show in what way they vary, as in the bear which has the ligatures of the toes joined above the instep.',
  'dazzling sketches',
  'The most dramatic change occurs in the nose, which in the pen-and-ink drawing appears shorter and straighter.',
  'as is usual for Leonardo',
  'dry and awkward in execution',
  'its magical beauty renders it suspicious',
  'must unquestionably be authentic',
  'these drawings are the only material of Leonardo’s published in print form during his own lifetime',
  'doit se lire dans une glace',
];
for (const words of QUOTED) assert.ok(source.includes(words), `quoted: ${words.slice(0, 50)}`);
assert.match(source, /il ramarro \. fedele allomo/, 'the Met transcription of the lizard inscription');
assert.match(source, /Transcription as published by the Met; translation mine\./);
assert.equal((source.match(/<p class="label">A reading<\/p>/g) || []).length, 6);
assert.match(source, /<i>after<\/i> Leonardo/, 'the grotesque head is labelled as a follower’s copy');

// 4. Accessibility and page hygiene.
for (const [img] of source.matchAll(/<img\b[^>]*>/g)) {
  assert.match(img, /\balt="[^"]{40,}"/, 'every image has a real description');
  assert.match(img, /\bwidth="\d+" height="\d+"/, 'every image reserves its space');
}
const iconFiles = new Set([...source.slice(0, source.indexOf('</head>')).matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)" href="([^"]+)"/g)].map(match => match[1]));
assert.deepEqual([...iconFiles].sort(), ['/apple-touch-icon.png', '/favicon-16.png', '/favicon-32.png', '/favicon.ico', '/favicon.svg', '/site.webmanifest']);
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(scripts.length, 1);
scripts.forEach(script => new Script(script));
assert.doesNotMatch(scripts.join('\n'), /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|setInterval|innerHTML)\b/);
for (const [tag] of source.matchAll(/<(?:script|link|img|image)\b[^>]*>/g)) {
  if (!/\brel="canonical"/.test(tag)) assert.doesNotMatch(tag, /(?:src|href|srcset)="https?:/, 'no third-party scripts, styles or images');
}

// 5. Doors, including the spelling it was asked for by.
const home = await text('index.html');
assert.equal((home.match(/href="leonardo\.html"/g) || []).length, 2, 'the foyer door: image and text link');
assert.equal(JSON.parse(await text('map.json')).groups.flatMap(group => group.rooms).filter(room => room.path === '/leonardo').length, 1);
assert.equal(((await text('map.html')).match(/href="\/leonardo"/g) || []).length, 1);
assert.equal((await text('sitemap.xml')).split('<loc>https://artbitrage.io/leonardo</loc>').length - 1, 1);
const redirects = await text('_redirects');
for (const path of ['/leonardo/', '/davinci', '/da-vinci', '/davincii']) assert.match(redirects, new RegExp(`^${path.replace(/[/-]/g, '\\$&')}\\s+/leonardo 301$`, 'm'), `${path} redirects`);
assert.match(await text('vishenskaya.html'), /href="leonardo\.html"/, 'the two guest rooms point at each other');
assert.match(source, /href="vishenskaya\.html#rhymes"/);
console.log(`Leonardo static PASS: ${recorded.size} images hashed and mirrored; ${credits.works.length} records public domain; ${QUOTED.length} quotations present.`);

if (process.argv.includes('--browser')) await withBrowser('leonardo', async b => {
  const route = async url => {
    if (/^\/assets\/leonardo\/[a-z-]+\.jpg$/.test(url.pathname)) return { type: 'image/jpeg', body: await read(url.pathname.slice(1)) };
    return null;
  };
  const eager = async () => {
    await b.evaluate('[...document.images].forEach(img => { img.loading = "eager"; })');
    await until(() => b.evaluate('[...document.images].every(img => img.complete && img.naturalWidth > 0)'), 'every local image loads', 20000);
    await until(() => b.evaluate('[...document.querySelectorAll("svg image")].length === 7'), 'scale drawing images present');
  };
  await b.load({ html: source, path: '/leonardo.html', route });
  await eager();
  const state = () => b.evaluate(`({
    form: document.getElementById('mirror-form').hidden,
    output: document.getElementById('mirror-output').textContent,
    flip: getComputedStyle(document.getElementById('mirror-output')).transform,
    toggles: [...document.querySelectorAll('[data-mirror] .toggle')].map(el => [el.hidden, el.getAttribute('aria-pressed'), el.textContent]),
    mirrored: [...document.querySelectorAll('[data-mirror]')].map(el => el.classList.contains('is-mirrored')),
    width: innerWidth, contentWidth: document.documentElement.scrollWidth
  })`);
  let s = await state();
  assert.equal(s.form, false, 'the mirror writer appears with JavaScript');
  assert.equal(s.output, 'Read it in a mirror');
  assert.match(s.flip, /^matrix\(-1, 0, 0, 1/, 'the output is flipped left to right');
  assert.deepEqual(s.toggles, [[false, 'false', 'Hold up a mirror'], [false, 'false', 'Hold up a mirror']]);
  assert.equal(s.contentWidth, s.width, 'no horizontal scroll on desktop');
  await b.shot('desktop-intro', '.intro');
  await b.evaluate(`(() => { const input = document.getElementById('mirror-input'); input.value = 'hello Leonardo'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  s = await state();
  assert.equal(s.output, 'hello Leonardo', 'typing writes in mirror script');
  await b.evaluate(`(() => { const input = document.getElementById('mirror-input'); input.value = '   '; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  assert.equal((await state()).output, 'Read it in a mirror', 'an empty line falls back to the default');
  await b.shot('desktop-mirror', '#mirror');
  await b.shot('desktop-scale', '#scale');

  await b.click('#lizard-recto .toggle');
  await new Promise(resolve => setTimeout(resolve, 900));
  s = await state();
  assert.deepEqual(s.mirrored, [true, false]);
  assert.deepEqual(s.toggles[0], [false, 'true', 'Put the mirror away']);
  assert.match(await b.evaluate(`document.querySelector('#lizard-recto .mirror-state').textContent`), /runs left to right/);
  assert.match(await b.evaluate(`getComputedStyle(document.querySelector('#lizard-recto img')).transform`), /^matrix\(-1, 0, 0, 1/);
  await b.shot('desktop-lizard-mirrored', '#lizard');
  await b.click('#lizard-recto .toggle');
  s = await state();
  assert.deepEqual([s.mirrored[0], s.toggles[0][2]], [false, 'Hold up a mirror']);
  assert.equal(await b.evaluate(`document.querySelector('#lizard-recto .mirror-state').textContent`), '');
  await b.shot('desktop-solids', '#solids');
  await b.shot('desktop-closing', '#closing');

  await b.viewport(390, 844, true);
  await b.load({ html: source, path: '/leonardo.html', route });
  await eager();
  s = await state();
  assert.ok(s.contentWidth <= s.width, `no horizontal page scroll at 390px (${s.contentWidth} > ${s.width})`);
  assert.ok(await b.evaluate(`document.querySelector('.scale-box').scrollWidth > document.querySelector('.scale-box').clientWidth`), 'the scale drawing scrolls inside its own box on a phone');
  const small = await b.evaluate(`[...document.querySelectorAll('a, button, input')].filter(el => el.getClientRects().length && !el.closest('[hidden]')).filter(el => el.getBoundingClientRect().height < 44 && !el.closest('p, li, blockquote, figcaption, q')).map(el => el.textContent.trim() || el.id)`);
  assert.deepEqual(small, [], 'standalone controls are at least 44px tall');
  await b.shot('mobile-intro');
  await b.shot('mobile-lizard', '#lizard');

  await b.viewport(1440);
  await b.send('Emulation.setScriptExecutionDisabled', { value: true });
  await b.load({ html: source, path: '/leonardo.html', route });
  const noJs = await b.evaluate(`({
    form: document.getElementById('mirror-form').hidden,
    sample: document.getElementById('mirror-output').textContent,
    toggles: [...document.querySelectorAll('.toggle')].every(el => el.hidden),
    inscription: document.querySelector('.inscription').textContent.includes('green lizard'),
    images: document.querySelectorAll('.frame img').length
  })`);
  assert.deepEqual(noJs, { form: true, sample: 'Read it in a mirror', toggles: true, inscription: true, images: 9 }, 'without JavaScript the room reads fully and shows no dead controls');
  await b.send('Emulation.setScriptExecutionDisabled', { value: false });

  const outside = b.requests.filter(request => !request.url.startsWith(origin) && !request.url.startsWith('data:'));
  assert.deepEqual(outside.map(request => request.url), [], 'the room asks nothing of any outside host');
});
