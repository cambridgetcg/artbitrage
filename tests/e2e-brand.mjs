// The 閒 icon and the room share cards: files, deploy mirrors, credits and <head> tags.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const text = path => read(path).toString('utf8');
const mirrored = path => assert.deepEqual(read(`dist/${path}`), read(path), `${path}: dist/ mirror is byte-identical`);
const escapeAttr = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');
const headOf = html => html.slice(0, html.indexOf('</head>'));

// 1. The icon kit sits at the site root (and in dist/, which is what deploys).
const ICON_FILES = ['favicon.svg', 'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'site.webmanifest', 'assets/brand/mark.svg'];
for (const file of ICON_FILES) { assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${file} exists`); mirrored(file); }
const pngSize = buf => (assert.equal(buf.subarray(1, 4).toString(), 'PNG'), [buf.readUInt32BE(16), buf.readUInt32BE(20)]);
for (const [file, size] of [['favicon-16.png', 16], ['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
  assert.deepEqual(pngSize(read(file)), [size, size], `${file} is ${size}px square`);
}
const ico = read('favicon.ico');
assert.equal(ico.readUInt16LE(2), 1, 'favicon.ico is an icon'); assert.equal(ico[6], 32, 'favicon.ico holds a 32px frame');
const webmanifest = JSON.parse(text('site.webmanifest'));
assert.equal(webmanifest.short_name, 'Artbitrage');
assert.equal(webmanifest.theme_color, '#17271f');
for (const icon of webmanifest.icons) {
  assert.deepEqual(pngSize(read(icon.src.slice(1))), icon.sizes.split('x').map(Number), `${icon.src} matches its declared size`);
}
assert.match(text('favicon.svg'), /@media \(max-width:22px\)/, 'the SVG favicon swaps in the hinted 16px cut');
assert.match(text('assets/brand/mark.svg'), /fill="currentColor"/, 'the bare mark takes its colour from the page');
// /manifest.json stays the philosophy document, not a web-app manifest.
const philosophy = JSON.parse(text('manifest.json'));
mirrored('manifest.json');
for (const key of ['icons', 'start_url', 'theme_color', 'display']) assert.ok(!(key in philosophy), `manifest.json has no ${key}`);
assert.equal(philosophy.name, 'artbitrage');

// 2. The icon links, the same block on every human-facing main page (and the old neon rings are gone).
const ICON_LINKS = [
  '<!-- 閒 the gap: the artbitrage.io icon. Every file sits at the site root. /manifest.json stays the philosophy document. -->',
  '<link rel="icon" href="/favicon.ico" sizes="32x32">',
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
  '<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">',
  '<link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<link rel="manifest" href="/site.webmanifest">',
];
// /still-we-meet is left out on purpose: its own test holds it to zero outbound links and zero <link> tags,
// so it carries neither the icon block nor its share tags until the owner decides otherwise. Its card
// (assets/og/still-we-meet.jpg) is still made and checked below; no page points at it yet.
const ROOMS = { index: 'home', visit: 'visit', elements: 'elements', noticing: 'noticing', unsigned: 'unsigned', map: 'map',
  explore: 'explore', 'behind-the-work': 'behind-the-work', trip: 'trip', studio: 'studio',
  catalog: 'catalog', pigments: 'pigments', psyche: 'psyche' };
assert.doesNotMatch(headOf(text('still-we-meet.html')), /<link\b|og:image/, 'still-we-meet.html keeps its zero-link head');
mirrored('still-we-meet.html');
const THEME = { index: '#121018', visit: '#17271f', elements: '#1e2922', noticing: '#eeece3', unsigned: '#1c211d',
  'behind-the-work': '#242d27', trip: '#19231e', psyche: '#100f10' };
const ICON_PAGES = [...Object.keys(ROOMS), '404', 'api-explorer', 'logos', 'nen-combat', 'nen-tuner', 'whitehack'];
for (const page of ICON_PAGES) {
  const file = `${page}.html`;
  mirrored(file);
  const head = headOf(text(file));
  const block = ICON_LINKS.join('\n');
  assert.ok(head.includes(block) || head.includes(ICON_LINKS.join('')), `${file}: carries the icon block`);
  for (const line of ICON_LINKS) assert.equal(head.split(line).length - 1, 1, `${file}: ${line.slice(0, 40)} once`);
  assert.equal((head.match(/rel="icon"/g) || []).length, 4, `${file}: only the kit's icons`);
  assert.doesNotMatch(head, /data:image\/svg\+xml[^"]*circle/, `${file}: the neon ring icon is gone`);
  assert.doesNotMatch(head, /href="\/manifest\.json"/, `${file}: never links the philosophy document as a manifest`);
  const themes = [...head.matchAll(/<meta name="theme-color" content="([^"]+)">/g)].map(match => match[1]);
  assert.ok(themes.length <= 1, `${file}: at most one theme-color`);
  if (THEME[page]) assert.deepEqual(themes, [THEME[page]], `${file}: theme-color ${THEME[page]}`);
}
assert.match(text('nen.html'), /<link rel="icon" href="data:image\/svg\+xml,[^"]*念/, 'nen keeps its own 念 icon');

// 3. The cards: one per room, 1200x630, at most 200 KB, mirrored, and recorded in credits.json.
const credits = JSON.parse(text('assets/og/credits.json'));
mirrored('assets/og/credits.json');
assert.equal(credits.cards.length, 14);
// The museums a card's work may come from: each one's object-page URL and its open-access API record.
const MUSEUMS = {
  'Art Institute of Chicago': { url: /^https:\/\/www\.artic\.edu\/artworks\/(\d+)$/, api: id => `https://api.artic.edu/api/v1/artworks/${id}` },
  'The Metropolitan Museum of Art': { url: /^https:\/\/www\.metmuseum\.org\/art\/collection\/search\/(\d+)$/, api: id => `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}` },
};
assert.equal(credits.how.generator, 'tools/brand/gen_card.py');
assert.ok(existsSync(new URL('../tools/brand/gen_card.py', import.meta.url)) && existsSync(new URL('../tools/brand/rooms.json', import.meta.url)));
const jpegSize = buf => {
  assert.equal(buf.readUInt16BE(0), 0xffd8, 'a JPEG');
  for (let i = 2; i < buf.length;) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('no JPEG frame header');
};
const bySlug = {};
for (const card of credits.cards) {
  bySlug[card.slug] = card;
  const file = card.card.slice(1);
  assert.equal(file, `assets/og/${card.slug}.jpg`);
  assert.equal(card.og_image, `https://artbitrage.io/assets/og/${card.slug}.jpg`);
  const bytes = read(file);
  mirrored(file);
  assert.deepEqual(jpegSize(bytes), [1200, 630], `${file} is 1200x630`);
  assert.ok(bytes.length <= 200 * 1024, `${file} is at most 200 KB`);
  assert.equal(bytes.length, card.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), card.sha256, `${file}: sha256 matches credits.json`);
  assert.ok(card.alt && card.alt.length <= 420, `${file}: has alt text`);
  if (card.shows === 'typographic') {
    assert.ok(card.far_wall && (card.far_wall.glyph || card.far_wall.lettering), `${card.slug}: says what the far wall carries`);
  } else {
    const art = card.shows.artwork;
    for (const field of ['title', 'date', 'museum', 'museum_url', 'image', 'record_source']) assert.ok(art[field], `${card.slug}: artwork ${field}`);
    const museum = MUSEUMS[art.museum];
    assert.ok(museum, `${card.slug}: the work's museum is one this test knows (${art.museum})`);
    assert.match(art.museum_url, museum.url);
    assert.ok(existsSync(new URL(`../dist${art.image}`, import.meta.url)), `${card.slug}: the work's image is deployed`);
    assert.equal(card.hanging.work_pixels_identical_in_master, true, `${card.slug}: the work's pixels are untouched`);
    assert.ok(card.hanging.scale <= 1, `${card.slug}: never upscaled`);
    // R2: a work whose image has no credits file of its own carries its at-source rights check on the card.
    if (!/credits\.json/.test(art.record_source.split(';')[0]) || /has no credits\.json/.test(art.record_source)) {
      assert.equal(art.api_source, museum.api(art.museum_url.match(museum.url)[1]), `${card.slug}: museum API record`);
      assert.equal(art.is_public_domain, true, `${card.slug}: the museum marks it public domain`);
      assert.equal(art.copyright_notice, null);
      assert.match(art.rights_verified_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      const image = read(`dist${art.image}`);
      assert.equal(image.length, art.image_bytes, `${card.slug}: image bytes`);
      assert.equal(createHash('sha256').update(image).digest('hex'), art.image_sha256, `${card.slug}: image sha256`);
    }
  }
}
assert.equal(bySlug.unsigned.shows, 'typographic', '/unsigned names no work on its card');
assert.equal(bySlug.unsigned.far_wall.glyph, '無名');
assert.equal(bySlug.unsigned.room_name, 'Hands without names');
assert.equal(bySlug.explore.shows.artwork.api_source, 'https://api.artic.edu/api/v1/artworks/15468', '/explore card records its at-source check');
// Every work on a card is from the Art Institute of Chicago, except /psyche's Canova, which is the Met's.
assert.deepEqual(credits.cards.filter(card => card.shows !== 'typographic' && card.shows.artwork.museum !== 'Art Institute of Chicago').map(card => card.slug), ['psyche']);
assert.equal(bySlug.psyche.shows.artwork.api_source, 'https://collectionapi.metmuseum.org/public/collection/v1/objects/188954', '/psyche card records its at-source check');
// …and it is the room's own catalogued image: the same museum record and the same bytes as catalog/psyche.json.
const psycheWork = JSON.parse(text('catalog/psyche.json')).artworks.find(work => work.url === bySlug.psyche.shows.artwork.museum_url);
assert.ok(psycheWork, '/psyche card shows a work from its own room');
assert.equal(`https://artbitrage.io${bySlug.psyche.shows.artwork.image}`, psycheWork.image, '/psyche card hangs the full image, not the -t thumbnail');
assert.equal(bySlug.psyche.shows.artwork.image_sha256, psycheWork.image_sha256, '/psyche card image matches the room record');
assert.equal(bySlug.psyche.shows.artwork.title, psycheWork.title);
assert.equal(bySlug.psyche.shows.artwork.maker, psycheWork.artist);
assert.equal(bySlug.psyche.shows.artwork.date, psycheWork.date);
assert.equal(psycheWork.rights.public_domain, true);

// 4. Each room page points its share tags at its own card.
for (const [page, slug] of Object.entries(ROOMS)) {
  const head = headOf(text(`${page}.html`));
  const card = bySlug[slug];
  const meta = (attr, name) => [...head.matchAll(new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`, 'g'))].map(match => match[1]);
  assert.deepEqual(meta('property', 'og:image'), [card.og_image], `${page}: og:image is its card`);
  assert.deepEqual(meta('property', 'og:image:width'), ['1200']);
  assert.deepEqual(meta('property', 'og:image:height'), ['630']);
  assert.deepEqual(meta('property', 'og:image:alt'), [escapeAttr(card.alt).replace(/&#x27;/g, "'")], `${page}: og:image:alt describes the card`);
  assert.deepEqual(meta('property', 'og:site_name'), ['Artbitrage']);
  assert.deepEqual(meta('name', 'twitter:card'), ['summary_large_image']);
  assert.deepEqual(meta('name', 'twitter:image'), [card.og_image]);
  assert.equal(meta('property', 'og:title').length, 1, `${page}: one og:title`);
  assert.equal(meta('property', 'og:description').length, 1, `${page}: one og:description`);
}

console.log(`brand checks passed: ${ICON_FILES.length} icon files, icon block on ${ICON_PAGES.length} pages, ${credits.cards.length} share cards with credits, og/twitter tags on ${Object.keys(ROOMS).length} rooms, dist mirrors byte-identical`);
