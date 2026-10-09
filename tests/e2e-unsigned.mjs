// Unsigned · 無名 — ten works whose makers the museum record does not name.
// Static checks keep the page, the manifest, the credits and the deploy mirrors in
// agreement; --browser drives the isolated local Chrome with fixture bytes only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { withBrowser, until, origin, delay } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root));
const html = read('unsigned.html').toString();
const script = read('unsigned.js').toString();
const style = read('unsigned.css').toString();
const manifestPath = 'assets/unsigned/works.json';
const creditsPath = 'assets/unsigned/credits.json';
const manifest = JSON.parse(read(manifestPath));
const credits = JSON.parse(read(creditsPath)).works;
const { room, works } = manifest;

const decode = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const textOf = fragment => decode(fragment.replace(/<[^>]+>/g, ''));
const escapeAttr = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
function jpegSize(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'JPEG starts with SOI');
  for (let i = 2; i < bytes.length;) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  throw new Error('no JPEG frame header');
}

// The embedded catalogue is the public manifest, byte for byte in meaning.
const embedded = html.match(/<script\b[^>]*type="application\/json"[^>]*id="unsigned-data"[^>]*>([\s\S]*?)<\/script>/);
assert.ok(embedded, 'local embedded catalogue supports progressive enhancement');
assert.doesNotMatch(embedded[1], /</, 'embedded JSON escapes every <');
assert.deepEqual(JSON.parse(embedded[1]), manifest, 'embedded and public manifests agree');

// Ten works, each with a complete record that matches the credits file.
assert.equal(works.length, 10, 'the room hangs ten works');
assert.equal(credits.length, 10, 'credits hold ten records');
assert.equal(new Set(works.map(work => work.id)).size, 10, 'work IDs are unique');
assert.deepEqual(credits.map(record => record.id), works.map(work => work.id), 'credits follow the room order');
const roomStrings = ['slug', 'path', 'title', 'html_title', 'subtitle', 'eyebrow', 'glyph', 'meta_description', 'blank_caption', 'signature', 'credit_note'];
for (const key of roomStrings) assert.ok(typeof room[key] === 'string' && room[key].trim(), `room.${key}`);
assert.equal(room.path, '/unsigned');
for (const [index, work] of works.entries()) {
  const record = credits[index];
  assert.match(work.id, /^[a-z0-9-]+$/);
  assert.match(work.image, /^\/assets\/unsigned\/[a-z0-9-]+\.jpg$/);
  assert.equal(work.image, `/assets/unsigned/${work.id}.jpg`);
  assert.equal(work.source, `https://www.artic.edu/artworks/${work.museum_id}`, `${work.id} links its AIC record`);
  for (const field of ['title', 'maker', 'date', 'medium', 'alt', 'source_name', 'chapter', 'headline', 'kept', 'context', 'provenance']) {
    assert.ok(typeof work[field] === 'string' && work[field].trim(), `${work.id}: ${field}`);
  }
  assert.ok(Array.isArray(work.note) && work.note.length >= 1 && work.note.every(line => line.length > 40), `${work.id}: note`);
  assert.equal(work.looking.length, 2, `${work.id}: two looking prompts`);
  assert.ok(Array.isArray(work.context_sources) && work.context_sources.length && work.context_sources.every(url => url.startsWith('https://')));
  assert.ok(work.context_sources.includes(work.source), `${work.id}: context links the museum record`);
  // Provenance and rights (R1–R5, R9).
  assert.equal(record.museum_id, work.museum_id);
  assert.equal(record.url, work.source);
  assert.equal(record.api_source, `https://api.artic.edu/api/v1/artworks/${work.museum_id}`);
  assert.equal(record.is_public_domain, true, `${work.id}: museum marks it public domain`);
  assert.equal(record.license, 'CC0', `${work.id}: CC0`);
  assert.equal(record.license_url, 'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.equal(record.source_name, 'Art Institute of Chicago');
  assert.equal(record.image, work.image);
  assert.equal(record.file, `${work.id}.jpg`);
  assert.equal(work.maker, record.artist_display.replace(/\n/g, ' · '), `${work.id}: maker is the museum's own line`);
  for (const field of ['title', 'date', 'medium', 'alt', 'width', 'height']) assert.deepEqual(work[field], record[field], `${work.id}: ${field} matches credits`);
  assert.deepEqual(work.looking, record.looking_prompts, `${work.id}: looking prompts come from the record`);
  for (const field of ['accession_number', 'image_source', 'credit_line', 'modifications', 'rights_note', 'download_receipt', 'verified_at']) {
    assert.ok(record[field], `${work.id}: credits keep ${field}`);
  }
  assert.match(record.image_source, /^https:\/\/www\.artic\.edu\/iiif\/2\/[0-9a-f-]+\/full\/843,\/0\/default\.jpg$/, `${work.id}: the museum's own IIIF reproduction`);
  assert.match(record.verified_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  for (const field of ['display_title', 'context_source', 'text_licence_note', 'sensitivities', 'alt', 'looking_prompt']) assert.ok(record[field], `${work.id}: credits keep ${field}`);
  assert.equal(record.context_source, work.source, `${work.id}: context source is the museum record`);
  assert.ok(Array.isArray(record.context_sources) && record.context_sources.length, `${work.id}: context sources`);
  assert.ok(!('image_note' in record) && !('copied_from' in record), `${work.id}: no pre-adoption or ambiguous mirror fields`);
  // The capture receipt lives in the repository (never in dist/), and shows the artwork page's own
  // 200 response for exactly this image URL with exactly these bytes.
  assert.equal(record.capture_log, `tools/receipts/unsigned/${work.id}.json`, `${work.id}: capture log path`);
  assert.ok(!existsSync(new URL(`dist/${record.capture_log}`, root)), `${work.id}: receipts are not deployed`);
  const receipt = JSON.parse(read(record.capture_log));
  assert.equal(receipt.id, work.id); assert.equal(receipt.sha256, record.sha256); assert.equal(receipt.image_source, record.image_source);
  const responses = [];
  (function walk(node) { if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object') { responses.push(node); Object.values(node).forEach(walk); } })(receipt.capture_log);
  assert.ok(responses.some(item => item.url === record.image_source && item.status === 200 && item.sha256 === record.sha256 && item.bytes === record.bytes), `${work.id}: receipt holds the page's own response for these bytes`);
  assert.equal(Boolean(work.view), record.image_scope === 'section', `${work.id}: only an image of part of the work says so`);
  // Integrity (R4, R10): the bytes on disk are the bytes recorded.
  const bytes = read(work.image.slice(1));
  assert.equal(bytes.length, record.bytes, `${work.id}: bytes`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, `${work.id}: sha256`);
  assert.deepEqual(jpegSize(bytes), { width: record.width, height: record.height }, `${work.id}: natural pixels`);
  assert.deepEqual(read(`dist${work.image}`), bytes, `${work.id}: artwork deploy mirror`);
}

// The page renders every string verbatim, and keeps the blank maker line on all ten labels.
const creditsText = read(creditsPath).toString();
assert.doesNotMatch(creditsText, /\/Users\/|\/private\/tmp|scratchpad|_capture\/|_superseded\//, 'the public credits name no local paths or files outside the repository');
const head = html.slice(0, html.indexOf('</head>'));
assert.match(html, /^<!DOCTYPE html>\n<html lang="en">/);
assert.ok(head.includes(`<title>${escapeAttr(room.html_title)}</title>`));
assert.ok(head.includes(`<meta name="description" content="${escapeAttr(room.meta_description)}">`));
assert.ok(head.includes('<link rel="canonical" href="https://artbitrage.io/unsigned">'));
assert.match(head, /<meta name="theme-color" content="#1c211d">/);
assert.match(head, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
const page = textOf(html.replace(/<script\b[\s\S]*?<\/script>/g, ''));
for (const line of [room.eyebrow, room.subtitle, ...room.intro, ...room.closing, room.signature, room.credit_note]) {
  assert.ok(page.includes(line), `room text is verbatim: ${line.slice(0, 40)}`);
}
assert.ok(html.includes(`<span lang="zh-Hant">${room.glyph}</span>`), '無名 is marked as Chinese');
assert.match(html, new RegExp(`<h1 id="unsigned-title">${room.h1[0]}<br><em>${room.h1[1].replace('.', '\\.')}</em></h1>`), 'two-line title');
assert.ok(html.includes('href="/assets/unsigned/credits.json"'), 'the credit note links the full record');
assert.match(html, /<footer class="room-footer wrap">[\s\S]*?<a href="\/assets\/unsigned\/credits\.json">Artwork &amp; image credits[\s\S]*?<\/footer>/, 'the footer links the credits record');
for (const path of ['/noticing', '/map', '/visit']) assert.match(html, new RegExp(`class="onward"[\\s\\S]*href="${path}"`), `onward to ${path}`);
assert.match(html, /<header class="room-header"><a class="brand" href="\/"[^>]*><span class="brand-mark" aria-hidden="true">a<\/span><span class="brand-name">ARTBITRAGE<small>A room without names<\/small>/);
assert.match(html, /<nav aria-label="Visitor navigation"><a href="\/noticing">[\s\S]*?<a href="\/map">/);
assert.match(html, /<a class="skip" href="#works">/);
const blankCaptions = [...html.matchAll(/<span class="blank-caption" data-blank-caption>([^<]*)<\/span>/g)].map(match => decode(match[1]));
assert.deepEqual(blankCaptions, Array(10).fill(room.blank_caption), 'every label says the record does not name the maker');
assert.equal((html.match(/<span class="blank-line" aria-hidden="true"><\/span>/g) || []).length, 10, 'every label keeps an empty maker line');
const images = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
const artImages = images.filter(tag => /src="\/assets\/unsigned\//.test(tag));
assert.equal(artImages.length, 10, 'one picture per work on the page');
for (const [index, work] of works.entries()) {
  const block = html.match(new RegExp(`<article class="bay[^"]*" id="${work.id}"[\\s\\S]*?</article>`));
  assert.ok(block, `${work.id} is a static destination`);
  const bay = block[0], text = textOf(bay);
  const wide = work.width / work.height > 2.5;
  assert.equal(/class="bay bay-wide/.test(bay), wide, `${work.id}: only works wider than 5:2 span the wall`);
  const tag = artImages[index];
  assert.ok(bay.includes(tag), `${work.id}: picture sits in its own bay`);
  assert.ok(tag.includes(`src="${work.image}"`) && tag.includes(`width="${work.width}"`) && tag.includes(`height="${work.height}"`), `${work.id}: natural pixel attributes`);
  assert.ok(tag.includes(`alt="${escapeAttr(work.alt)}"`), `${work.id}: alt from the record`);
  if (index === 0) { assert.match(tag, /fetchpriority="high"/); assert.doesNotMatch(tag, /loading="lazy"/); }
  else assert.match(tag, /loading="lazy" decoding="async"/, `${work.id}: later pictures wait`);
  assert.ok(bay.includes(`data-view-work="${work.id}" href="${work.image}"`), `${work.id}: no-JS link opens the whole image`);
  // The link is named by its words and the picture's own description, never by an aria-label that would hide it.
  const view = work.view || 'the whole work';
  const link = bay.match(/<a class="art-link"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(link && !/aria-label/.test(link[0]), `${work.id}: art link has no aria-label`);
  assert.ok(link[1].startsWith(`<span class="visually-hidden">Look at ${escapeAttr(view)}: </span><img`), `${work.id}: link name is “Look at ${view}:” then the alt`);
  const ratio = Number(link[0].match(/style="--r:([0-9.]+)"/)[1]);
  assert.ok(Math.abs(ratio - work.width / work.height) < 0.001, `${work.id}: the link carries the work's ratio`);
  assert.ok(bay.includes(`<figcaption class="art-hint" aria-hidden="true">${String(index + 1).padStart(2, '0')} · ${escapeAttr(view)} <span>`), `${work.id}: the hint says what the image shows`);
  assert.ok(bay.includes(`href="${work.source}"`), `${work.id}: links artic.edu/artworks/${work.museum_id}`);
  assert.match(bay, new RegExp(`<a class="record-link" href="${work.source.replace(/[.]/g, '\\.')}">See the museum record`));
  for (const url of work.context_sources) assert.ok(bay.includes(`href="${escapeAttr(url)}"`), `${work.id}: context source ${url}`);
  assert.match(bay, new RegExp(`<h2 id="${work.id}-title">`));
  const strings = [work.title, work.chapter, work.headline, ...work.note, ...work.looking, work.kept, work.context, work.provenance, work.date, work.medium, room.blank_caption];
  if (work.care) strings.push(work.care);
  for (const line of strings) assert.ok(text.includes(line), `${work.id}: verbatim “${line.slice(0, 40)}”`);
  assert.ok(text.includes(`Recorded as${work.maker}`), `${work.id}: Recorded as the museum's maker line`);
  assert.ok(text.includes(String(index + 1).padStart(2, '0')), `${work.id}: chapter number`);
  assert.equal(/class="care"/.test(bay), Boolean(work.care), `${work.id}: care line only when written`);
  // Museum context stays separate from the personal reading (R7).
  const reading = bay.match(/<div class="reading" data-work-note>[\s\S]*?<\/div>/)[0];
  assert.ok(!reading.includes(work.context), `${work.id}: museum context is not inside the reading`);
}
assert.equal(images.length, 11, 'ten works plus the empty viewer image');
assert.match(html, /<img id="unsigned-viewer-image" alt="">/);
assert.match(html, /<p id="unsigned-viewer-view">The whole work<\/p>/);
assert.deepEqual(works.filter(work => work.view).map(work => [work.id, work.view]), [['peach-blossom-spring', 'one section of the scroll']], 'only the scroll is shown in part');
assert.match(style, /\.visually-hidden\{position:absolute!important/);

// Mirrors, safety and registration.
for (const file of ['unsigned.html', 'unsigned.css', 'unsigned.js', manifestPath, creditsPath, 'map.html', 'map.json', 'sitemap.xml', '_redirects', 'noticing.html']) {
  assert.deepEqual(read(file), read(`dist/${file}`), `${file} deploy mirror`);
}
new Script(script);
assert.doesNotMatch(html, /<(?:audio|video|iframe|embed|object)\b|\bautoplay\b/i, 'no media or autoplay');
assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|AudioContext|Audio|sendBeacon|localStorage|sessionStorage|setInterval|requestAnimationFrame)\b/, 'no background requests, audio or timers');
assert.doesNotMatch(style, /@import|url\(\s*['"]?https?:/i, 'no remote styles');
assert.match(style, /prefers-reduced-motion:\s*reduce/);
assert.match(style, /:focus-visible\{outline:2px solid/);
assert.doesNotMatch(html, /<script\b[^>]*\bsrc="https?:|<link\b[^>]*rel="stylesheet"[^>]*href="https?:/i, 'no remote scripts or styles');

function localTarget(href, from) {
  const target = new URL(decode(href), `${origin}/${from}`);
  assert.ok(['http:', 'https:'].includes(target.protocol), `navigable link: ${href}`);
  if (target.origin !== origin) { assert.equal(target.protocol, 'https:', `secure source: ${href}`); return; }
  const path = decodeURIComponent(target.pathname).replace(/^\//, '');
  const file = !path ? 'index.html' : path.includes('.') ? path : `${path}.html`;
  assert.ok(existsSync(new URL(file, root)), `${from}: ${href} resolves locally`);
  if (target.hash && file.endsWith('.html')) {
    assert.ok(read(file).toString().includes(`id="${decodeURIComponent(target.hash.slice(1))}"`), `${from}: ${href} has a real fragment`);
  }
}
for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) localTarget(match[1], 'unsigned.html');
for (const file of ['map.html', 'noticing.html']) {
  const entries = [...read(file).toString().matchAll(/<a\b[^>]*\bhref="(\/unsigned(?:[?#][^"]*)?)"/g)];
  assert.ok(entries.length, `${file} leads into /unsigned`);
  for (const match of entries) localTarget(match[1], file);
}
const map = read('map.html').toString();
assert.match(map, /<ol class="steps">[\s\S]*?<a href="\/unsigned">[\s\S]*?<\/ol>/, 'map journey lists the room');
assert.match(map, /<a class="room" href="\/unsigned"><span class="glyph" lang="zh-Hant">無名<\/span><h3>Unsigned<\/h3>/, 'map directory card');
const mapRooms = JSON.parse(read('map.json')).groups.flatMap(group => group.rooms).filter(entry => entry.path === '/unsigned');
assert.equal(mapRooms.length, 1);
assert.equal(mapRooms[0].name, 'Unsigned'); assert.equal(mapRooms[0].cjk, '無名');
assert.equal(read('sitemap.xml').toString().split('<loc>https://artbitrage.io/unsigned</loc>').length - 1, 1);
assert.match(read('_redirects').toString(), /^\/unsigned\/\s+\/unsigned 301$/m);
assert.match(read('README.md').toString(), /`\/unsigned`/);
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));
console.log(`unsigned static checks passed: ${works.length} works, verbatim room text, ${blankCaptions.length} blank maker lines, credits match bytes/sha256/pixels, deploy mirrors, local links, registration and no background requests`);
if (!process.argv.includes('--browser')) process.exit(0);

const assets = new Set(['unsigned.css', 'unsigned.js', manifestPath, creditsPath, ...works.map(work => work.image.slice(1))]);
const route = async url => {
  const path = url.pathname.slice(1);
  if (!assets.has(path)) return null;
  return { body: read(path), type: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.json') ? 'application/json' : 'image/jpeg' };
};
const init = `(() => {
  window.__audioCalls=0;
  HTMLMediaElement.prototype.play=function(){window.__audioCalls++;return Promise.reject(new Error('No media in this room'));};
  window.AudioContext=window.webkitAudioContext=class{constructor(){window.__audioCalls++;throw new Error('No realtime audio in this room');}};
})();`;

await withBrowser('unsigned', async b => {
  const { load, evaluate, click, send, viewport, media, shot, requests } = b;
  const frames = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const press = async (key, code, text) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, windowsVirtualKeyCode: code, ...(text ? { text } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: code });
  };
  const fits = async label => {
    const state = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:Array.from(document.querySelectorAll('a,button,summary')).filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&(r.height<43.9||r.width<43.9);}).map(el=>({text:el.textContent.trim().slice(0,60),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))})`);
    assert.ok(state.scroll <= state.width, `${label}: no horizontal overflow at ${state.width}px (${state.scroll})`);
    assert.deepEqual(state.bad, [], `${label}: visible controls have 44px targets at ${state.width}px`);
  };
  const whole = async work => {
    await evaluate(`document.getElementById(${JSON.stringify(work.id)}).scrollIntoView({block:'start',behavior:'instant'})`);
    await until(() => evaluate(`(()=>{const image=document.querySelector('[data-view-work="${work.id}"] img');return image.complete&&image.naturalWidth>0;})()`), `${work.id} loads`);
    const image = await evaluate(`(()=>{const image=document.querySelector('[data-view-work="${work.id}"] img'),r=image.getBoundingClientRect();return{naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,width:r.width,height:r.height,left:r.left,right:r.right,fit:getComputedStyle(image).objectFit,attrWidth:+image.getAttribute('width'),attrHeight:+image.getAttribute('height')};})()`);
    assert.equal(image.naturalWidth, work.width, `${work.id}: natural width equals the attribute`);
    assert.equal(image.naturalHeight, work.height, `${work.id}: natural height equals the attribute`);
    assert.equal(image.attrWidth, work.width); assert.equal(image.attrHeight, work.height);
    assert.equal(image.fit, 'contain');
    assert.ok(Math.abs(image.width / image.height - work.width / work.height) < 0.015, `${work.id}: shown whole at its natural aspect`);
    assert.ok(image.width > 100 && image.left >= -1 && image.right <= (await evaluate('innerWidth')) + 1, `${work.id}: whole picture is on the wall`);
    return image;
  };
  const opened = async work => {
    const opener = `[data-view-work="${work.id}"]`;
    await evaluate(`document.querySelector(${JSON.stringify(opener)}).focus()`);
    await press('Enter', 13, '\r');
    await until(() => evaluate(`document.querySelector('#unsigned-viewer').open&&document.querySelector('#unsigned-viewer-image').complete&&document.querySelector('#unsigned-viewer-image').naturalWidth>0`), 'viewer opens with the whole work');
    const state = await evaluate(`(()=>{const d=document.querySelector('#unsigned-viewer'),image=document.querySelector('#unsigned-viewer-image');return{modal:d.matches(':modal'),focus:d.contains(document.activeElement),image:image.getAttribute('src'),alt:image.alt,fit:getComputedStyle(image).objectFit,title:document.querySelector('#unsigned-viewer-title').textContent,maker:document.querySelector('#unsigned-viewer-maker').textContent,source:document.querySelector('#unsigned-viewer-source').getAttribute('href'),width:d.clientWidth,scroll:d.scrollWidth};})()`);
    assert.equal(state.modal, true); assert.equal(state.focus, true, 'focus moves into the viewer');
    assert.equal(state.image, work.image); assert.equal(state.alt, work.alt); assert.equal(state.fit, 'contain');
    assert.equal(state.title, work.title); assert.equal(state.source, work.source);
    assert.ok(state.maker.includes(room.blank_caption) && state.maker.includes(work.maker), 'viewer keeps the blank maker and the museum line');
    const marks = await evaluate(`(()=>({view:document.querySelector('#unsigned-viewer-view').textContent,status:document.querySelector('#unsigned-viewer-status').textContent,title:Array.from(document.querySelectorAll('#unsigned-viewer-title [lang]')).map(span=>[span.lang,span.textContent]),maker:Array.from(document.querySelectorAll('#unsigned-viewer-maker [lang]')).map(span=>[span.lang,span.textContent])}))()`);
    const view = work.view || 'the whole work';
    assert.equal(marks.view, view[0].toUpperCase() + view.slice(1), `${work.id}: the viewer says what the image shows`);
    assert.equal(marks.status, '', 'status clears once the image is in');
    const cjk = text => text.match(/[\u2e80-\u2fff\u3000-\u303f\u3400-\u9fff\uf900-\ufaff]+/g) || [];
    assert.deepEqual(marks.title, cjk(work.title).map(run => ['zh-Hant', run]), `${work.id}: Chinese in the viewer title keeps its language`);
    assert.deepEqual(marks.maker, cjk(work.maker).map(run => ['zh-Hant', run]), `${work.id}: Chinese in the viewer maker line keeps its language`);
    assert.ok(state.scroll <= state.width + 1, 'viewer fits');
    return opener;
  };
  const nameOf = async selector => {
    const { root: documentNode } = await send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await send('DOM.querySelector', { nodeId: documentNode.nodeId, selector });
    const { nodes } = await send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    return nodes[0].name.value;
  };
  const closed = async opener => {
    await until(() => evaluate(`!document.querySelector('#unsigned-viewer').open`), 'viewer closes');
    await frames();
    assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(opener)})`), true, 'focus returns to the exact artwork');
  };

  // Every picture holds its final box before its bytes arrive, so nothing shifts and fragment
  // links land on the right work. The images here arrive 600 ms late, as on a slow connection.
  const slow = async url => { const response = route(url); if (response && response.type === 'image/jpeg') await delay(600); return response; };
  const landing = async (width, height, mobile, id, label) => {
    await viewport(width, height, mobile);
    await load({ html, path: '/unsigned', route: slow, init });
    const boxes = await evaluate(`Array.from(document.querySelectorAll('[data-view-work] img')).map(image=>{const r=image.getBoundingClientRect();return{complete:image.complete,width:r.width,height:r.height,ratio:+image.getAttribute('width')/+image.getAttribute('height')};})`);
    assert.ok(boxes.some(box => !box.complete), `${label}: some pictures are still on their way`);
    for (const box of boxes) assert.ok(box.width > 100 && Math.abs(box.width / box.height - box.ratio) < 0.015, `${label}: a picture holds its box before it loads (${JSON.stringify(box)})`);
    await click(`.index a[href="#${id}"]`);
    // Wait until the smooth scroll has come to rest and the pictures it passed have had time to arrive.
    await until(async () => {
      const before = await evaluate('scrollY'); await delay(300);
      return before > 0 && before === await evaluate('scrollY')
        && await evaluate(`Array.from(document.querySelectorAll('[data-view-work] img')).filter(image=>{const r=image.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}).every(image=>image.complete)`);
    }, `${label}: the scroll comes to rest`, 15000);
    await delay(1200);
    const top = await evaluate(`document.getElementById(${JSON.stringify(id)}).getBoundingClientRect().top`);
    assert.ok(Math.abs(top) <= 2, `${label}: the register lands on #${id} (top ${top})`);
  };
  await landing(390, 844, true, 'sunburst-quilt-kentucky', 'phone, slow images');
  await landing(768, 1024, true, 'bushong-womans-overskirt', 'tablet, slow images');
  await viewport(1280, 900);
  await load({ html, path: '/unsigned', route: slow, init });
  await until(() => evaluate(`document.querySelector('[data-view-work] img').complete`), 'the first picture arrives');
  await delay(200);
  const shift = await evaluate(`new Promise(resolve=>{let sum=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)sum+=entry.value;}).observe({type:'layout-shift',buffered:true});setTimeout(()=>resolve(sum),200);})`);
  assert.ok(shift < 0.01, `desktop arrival does not shift as pictures load (CLS ${shift})`);
  for (const [index, work] of works.entries()) {
    const view = work.view || 'the whole work';
    assert.equal(await nameOf(`.bay:nth-child(${index + 1}) [data-view-work]`), `Look at ${view}: ${work.alt}`, `${work.id}: the link's accessible name carries the picture's description`);
  }
  await load({ html, path: '/unsigned', route, init });
  assert.equal(await evaluate('__audioCalls'), 0);
  assert.equal(await evaluate(`document.querySelector('#unsigned-viewer').open`), false, 'viewer waits for a visitor');
  assert.equal(await evaluate(`document.querySelectorAll('[data-blank-caption]').length`), 10);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.blank-line')).every(line=>line.textContent===''&&line.getBoundingClientRect().width>40&&parseFloat(getComputedStyle(line).borderBottomWidth)>=1)`), 'blank maker lines are drawn and empty');
  await fits('arrival 1280');
  await shot('unsigned-arrival-1280');
  for (const work of works) { await whole(work); await fits(`${work.id} 1280`); }
  await shot('unsigned-bay-1280', `#${works[1].id}`);
  for (const work of [works[0], works[3]]) {
    const opener = await opened(work);
    if (work === works[0]) await shot('unsigned-viewer-1280');
    await press('Escape', 27); await closed(opener);
    await opened(work); await click('#unsigned-viewer [data-viewer-close]'); await closed(opener);
  }
  let opener = await opened(works[1]);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 2, y: 2, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 2, y: 2, button: 'left', clickCount: 1 });
  await closed(opener);
  for (const { id } of works) {
    await click(`.index a[href="#${id}"]`); await frames();
    assert.equal(await evaluate('location.hash'), `#${id}`, 'the register links to each bay');
  }
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.ok(await evaluate(`document.activeElement!==document.body&&document.activeElement.matches(':focus-visible')&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2`), 'keyboard focus is visible');

  for (const width of [390, 360]) {
    await viewport(width, 844, true); await evaluate(`scrollTo({top:0,behavior:'instant'})`); await frames();
    await fits(`arrival ${width}`);
    if (width === 390) await shot('unsigned-arrival-390');
    for (const work of works) { await whole(work); await fits(`${work.id} ${width}`); }
    if (width === 390) await shot('unsigned-wide-390', `#${works[2].id}`);
    opener = await opened(works[2]);
    // A scroll on a phone keeps up to its natural height in the viewer and pans sideways.
    const pan = await evaluate(`(()=>{const art=document.querySelector('#unsigned-viewer .viewer-art'),image=document.querySelector('#unsigned-viewer-image'),r=image.getBoundingClientRect();return{width:r.width,height:r.height,area:art.clientHeight,scrollWidth:art.scrollWidth,clientWidth:art.clientWidth};})()`);
    assert.ok(Math.abs(pan.height - Math.min(pan.area, works[2].height)) <= 1, `viewer shows the scroll at up to its natural height (${JSON.stringify(pan)})`);
    assert.ok(Math.abs(pan.width / pan.height - works[2].width / works[2].height) < 0.015 && pan.scrollWidth > pan.clientWidth + 100, 'the scroll pans sideways in the viewer');
    const controls = await evaluate(`Array.from(document.querySelectorAll('#unsigned-viewer a,#unsigned-viewer button')).map(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})`);
    for (const control of controls) {
      assert.ok(control.width >= 43.9 && control.height >= 43.9, 'viewer controls have 44px targets');
      assert.ok(control.left >= -1 && control.right <= width + 1 && control.top >= -1 && control.bottom <= 845, 'viewer controls stay on screen');
    }
    if (width === 390) await shot('unsigned-viewer-390');
    await press('Escape', 27); await closed(opener);
  }

  // A short landscape phone: the caption sits beside the work, which shows larger than on the wall.
  await viewport(844, 390, true); await evaluate(`scrollTo({top:0,behavior:'instant'})`); await frames();
  const inline = await whole(works[0]);
  opener = await opened(works[0]);
  const landscape = await evaluate(`(()=>{const image=document.querySelector('#unsigned-viewer-image'),r=image.getBoundingClientRect(),scale=Math.min(r.width/image.naturalWidth,r.height/image.naturalHeight),caption=document.querySelector('#unsigned-viewer .viewer-bottom').getBoundingClientRect();return{height:image.naturalHeight*scale,right:r.right,captionLeft:caption.left};})()`);
  assert.ok(landscape.height >= inline.height, `landscape viewer shows the work at least as large as the wall does (${landscape.height} vs ${inline.height})`);
  assert.ok(landscape.captionLeft >= landscape.right - 1, 'landscape viewer puts the caption beside the work');
  await press('Escape', 27); await closed(opener);

  await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).scrollBehavior`), 'auto');
  assert.equal(await evaluate(`document.getAnimations().filter(animation=>animation.playState==='running').length`), 0);
  assert.equal(await evaluate('__audioCalls'), 0);
  assert.equal(await evaluate(`document.querySelectorAll('audio,video,iframe,[autoplay]').length`), 0);

  // Without JavaScript the room is a complete document.
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await load({ html, path: '/unsigned', route }); await viewport(360, 844, true);
  assert.equal(await evaluate(`document.querySelector('#unsigned-viewer').open`), false);
  for (const work of works) {
    await evaluate(`document.getElementById(${JSON.stringify(work.id)}).scrollIntoView({block:'start',behavior:'instant'})`);
    await fits(`no-JS ${work.id}`);
    const record = await evaluate(`(()=>{const bay=document.getElementById(${JSON.stringify(work.id)});return{note:bay.querySelector('[data-work-note]').textContent,context:bay.querySelector('[data-work-context]').textContent,blank:bay.querySelector('[data-blank-caption]').textContent,recorded:bay.querySelector('[data-recorded-as]').textContent,full:bay.querySelector('[data-view-work]').getAttribute('href'),record:bay.querySelector('.record-link').getAttribute('href')};})()`);
    assert.ok(record.note.includes(work.headline) && work.note.every(line => record.note.includes(line)));
    assert.ok(record.context.includes(work.context));
    assert.equal(record.blank, room.blank_caption); assert.equal(record.recorded, work.maker);
    assert.equal(record.full, work.image, 'no-script artwork link opens the whole image');
    assert.equal(record.record, work.source);
  }
  await shot('unsigned-nojs-360');
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  assert.ok(requests.every(request => new URL(request.url).origin === origin), 'all assets are served locally');
  assert.ok(!requests.some(request => /\/api\/|\.(?:mp3|wav|ogg|m4a)(?:$|\?)/.test(new URL(request.url).pathname)), 'no API, tracking or sound requests');
  assert.ok(!requests.some(request => /\.json$/.test(new URL(request.url).pathname)), 'the page never fetches its manifest');
  console.log('unsigned browser passed: boxes held before slow images arrive, register lands on its work at 390 and 768, desktop CLS under 0.01, art links named by their alt text, 1280/390/360 without overflow, 44px targets, whole works at natural pixels and aspect, viewer open/close with Escape, Close and backdrop and focus return, viewer says what the image shows and keeps Chinese marked, scroll pans on phones, caption beside the work in landscape, register fragments, visible focus, reduced motion, no media, complete no-JavaScript document');
});
