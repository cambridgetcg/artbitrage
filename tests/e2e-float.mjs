// 浮室 The Float Room: a charter, a float, a receipt.
// Static: the room's structure, the way home, no outside resources and no I/O in its scripts,
// the plate's quotations word for word, the doors, and the deploy mirrors.
// --browser: floats for real in the isolated Chrome harness (fixtures only; every outside request is refused).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { withBrowser, until, delay } from './helpers/browser.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const source = await read('float.html');

// The room and every page that opens a door to it are published as they are here.
for (const file of ['float.html', 'dark-continent.html', 'map.html', 'map.json', 'explore.html', 'sitemap.xml', '_redirects']) {
  assert.equal(await read(`dist/${file}`), await read(file), `${file}: dist/ mirror is byte-identical (node tools/build-dist.mjs)`);
}

// 1. Threshold: a charter written before setting out. The controls wait for JavaScript; the by-hand way does not.
const tag = id => {
  const found = source.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`));
  assert.ok(found, `#${id} is present`);
  return found[0];
};
assert.match(tag('charter-controls'), /\shidden\b/, 'charter controls appear only once the script is ready');
assert.doesNotMatch(tag('by-hand'), /\shidden\b/, 'without JavaScript the by-hand float stays readable');
const question = tag('question');
for (const attr of ['type="text"', 'maxlength="140"', 'autocomplete="off"', 'spellcheck="false"']) {
  assert.ok(question.includes(attr), `the question input carries ${attr}`);
}
assert.doesNotMatch(question, /\bname=/, 'the question has no form name to submit or remember');
const budgets = [...source.matchAll(/<input type="radio" name="budget" value="(\d+)"( checked)?>/g)];
assert.deepEqual(budgets.map(m => m[1]), ['3', '7', '12'], 'budgets are 3, 7 and 12 minutes');
assert.deepEqual(budgets.filter(m => m[2]).map(m => m[1]), ['3'], 'the smallest budget is the default');
assert.match(tag('hum'), /type="checkbox"/);
assert.doesNotMatch(tag('hum'), /checked/, 'sound is off unless asked for');
assert.match(source, /The way home|the way home/);
assert.match(source, /Escape does the same/);
assert.match(source, /not therapy or a medical device\. If anything feels wrong, come home\./, 'the care line');

// 2. Float: a closed dialog whose only control is the way home.
const dialog = source.match(/<dialog\b([^>]*)>([\s\S]*?)<\/dialog>/);
assert.ok(dialog, 'the float is a dialog');
assert.match(dialog[1], /id="float"/);
assert.doesNotMatch(dialog[1], /\bopen\b/, 'the float starts closed');
const home = dialog[2].match(/<button\b([^>]*)>([^<]*)<\/button>/);
assert.ok(home, 'the come-home control is a real button inside the float');
assert.match(home[1], /id="come-home"/);
assert.doesNotMatch(home[1], /hidden|disabled|inert|aria-hidden|tabindex="-1"/, 'the way home is never hidden or unfocusable');
assert.equal(home[2], '回家 · come home');
assert.equal((dialog[2].match(/<button\b/g) || []).length, 1, 'nothing else to press while floating');
assert.equal((dialog[2].match(/<p\b/g) || []).length, 1, 'one visually hidden description, nothing else to read');
assert.match(dialog[2], /<p class="sr" id="come-home-note">/);

// 3. Return: a receipt that scores no one.
assert.match(tag('return'), /\shidden\b/, 'the receipt waits for a return');
for (const id of ['r-start', 'r-end', 'r-planned', 'r-actual', 'r-by', 'r-question', 'copy-receipt', 'float-again', 'copy-status']) tag(id);
assert.match(tag('r-question-row'), /\shidden\b/, 'no question row unless a question was written');
assert.match(source, /This receipt traces what happened\. It scores no one\./);
assert.match(source, /Nothing was stored or sent\./);

// 4. No outside resources, no storage, no network in the page's scripts.
assert.doesNotMatch(source, /<(?:img|iframe|audio|video|object|embed|form|canvas|picture|source)\b/i);
assert.doesNotMatch(source, /<script\b[^>]*\bsrc=|\b(?:src|srcset|poster)=|@import|url\s*\(/i);
for (const [link] of source.matchAll(/<link\b[^>]*>/g)) {
  if (/rel="canonical"/.test(link)) continue;
  assert.match(link, /href="\/[^/]/, `${link} stays on this site`);
}
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert.equal(scripts.length, 2);
scripts.forEach(script => new Script(script));
assert.doesNotMatch(scripts.join('\n'),
  /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|cookie|serviceWorker|Worker|importScripts|postMessage)\b|\bimport\s*\(/,
  'the room makes no request and keeps nothing');

// 5. The plate: Lilly's words exactly as printed (checked against the archive.org scans), and its sources linked.
const plain = source.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/[‘’]/g, "'");
for (const quote of [
  'The original theory was wrong.',
  'chooses his own times for beginning, ending, and the total duration of exposure',
  'especially variables important to survival',
  "return to 'subject status' temporarily and bring a safety man back into the situation.",
  'No person under the influence of drugs should be allowed in the tank.',
  "a point of view from over twenty years' work in the tank with and without chemical aids.",
  'a lock that can either be broken from the outside, or opened from the outside in case of an emergency.',
  "There is no guarantee that one's current model does match the reality, no matter how certain one feels about the high quality of the match. Feelings of awe, reverence, sacredness and certainty are also adaptable metaprograms, attachable to any model, not just the best fitting one.",
  'control of the secrecy of his individual data',
]) assert.ok(plain.includes(quote), `plate quotes Lilly exactly: “${quote.slice(0, 48)}…”`);
for (const href of [
  'https://archive.org/details/the-deep-self-john-lilly',
  'https://archive.org/details/JohnC.LillyTHECENTEROFTHECYCLONEanAutobiographyOfInnerSpace',
  'https://archive.org/details/lilly-john-c-programming-and-metaprogramming-in-the-human-biocomputer',
  'https://pmc.ncbi.nlm.nih.gov/articles/PMC6899429/',
  'https://orionmagazine.org/article/a-mind-in-the-water/',
  'https://www.theguardian.com/environment/2014/jun/08/the-dolphin-who-loved-me',
]) assert.ok(source.includes(`href="${href}"`), `source linked: ${href}`);
assert.ok(plain.includes('“Experiments in Solitude, in Maximum Achievable Physical Isolation with Water Suspension, of Intact Healthy Persons”'),
  'the 1961 paper is named by its full printed title');
assert.match(plain, /representation|speaking for someone does not waive their rights/);
assert.match(plain, /parallels, not an inheritance/);
assert.equal((source.match(/lang="yue-Hant"/g) || []).length >= 20, true, 'the plate speaks both languages');

// 6. Doors: registered like every room, one door from the Dark Continent, and every local link real.
const map = JSON.parse(await read('map.json'));
assert.equal(map.groups.flatMap(group => group.rooms).filter(room => room.path === '/float').length, 1, 'map.json names the room once');
const dark = await read('dark-continent.html');
assert.equal((dark.match(/href="float\.html"/g) || []).length, 1, 'one door from the Dark Continent');
assert.ok(dark.slice(dark.indexOf('<footer>')).includes('<a href="float.html">浮室 an inner expedition</a>'), 'the door sits in its footer');
const explore = await read('explore.html');
const wings = explore.split('<div class="wings rise">')[1].split('</div>')[0];
const doors = [...wings.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]);
assert.equal(doors[doors.indexOf('dark-continent.html') + 1], 'float.html', 'the collection hangs the room beside the Dark Continent');
assert.match(await read('_redirects'), /^\/float\/\s+\/float 301$/m);
for (const [, href] of source.matchAll(/href="([^"#:]+\.html)"/g)) {
  assert.ok(existsSync(new URL(`../${href}`, import.meta.url)), `${href} exists`);
}
console.log('浮室 static PASS: charter (question · 3/7/12 · hum off · way home), one-button float, hidden receipt, no outside resources or I/O, nine quotations and the 1961 title exact, six sources, doors and mirrors.');

assert.ok(process.argv.slice(2).every(arg => arg === '--browser'), 'only --browser is accepted');
if (process.argv.includes('--browser')) await withBrowser('float', async b => {
  const { load, evaluate, viewport, media, send, shot, requests } = b;
  const tap = async selector => {
    const at = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'center', behavior:'instant'}); const r = el.getBoundingClientRect(); return {x:r.x + r.width / 2, y:r.y + r.height / 2}; })()`);
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
  };
  const escape = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  };
  const view = () => evaluate(`(() => {
    const byId = id => document.getElementById(id);
    const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible';
    const home = byId('come-home'), r = home.getBoundingClientRect(), d = byId('float-dark').getBoundingClientRect();
    return {
      width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      threshold: shown(byId('threshold')), controls: shown(byId('charter-controls')), byHand: shown(byId('by-hand')),
      open: byId('float').open, deep: byId('float-dark').classList.contains('deep'),
      covers: d.left <= 0 && d.top <= 0 && d.right >= innerWidth && d.bottom >= innerHeight,
      transition: getComputedStyle(byId('float-dark')).transitionDuration,
      glow: getComputedStyle(document.querySelector('.glow')).animationName,
      home: { shown: shown(home), opacity: getComputedStyle(home).opacity, color: getComputedStyle(home).color,
        inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, h: r.height },
      focused: document.activeElement && document.activeElement.id,
      receipt: shown(byId('return')),
      by: byId('r-by').textContent, planned: byId('r-planned').textContent, actual: byId('r-actual').textContent,
      start: byId('r-start').textContent, end: byId('r-end').textContent,
      question: byId('r-question').textContent, questionRow: shown(byId('r-question-row')),
      status: byId('copy-status').textContent,
      kept: [localStorage.length, sessionStorage.length, document.cookie],
      floating: document.documentElement.classList.contains('floating'),
      plate: shown(byId('plate')) && getComputedStyle(document.querySelector('#plate .leaf')).opacity === '1',
      small: Array.from(document.querySelectorAll('#charter-controls button, #charter-controls .choice, #charter-controls .check, #charter-controls input[type=text], #return button'))
        .filter(shown).filter(el => el.getBoundingClientRect().height < 44).map(el => el.id || el.textContent.trim())
    };
  })()`);
  const contrast = (fg, bg) => {
    const lum = rgb => {
      const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(n => Number(n) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [a, c] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (c + 0.05);
  };
  const fits = v => assert.ok(v.scrollWidth <= v.width + 1, `no horizontal scroll at ${v.width}px (${v.scrollWidth})`);
  const floatingWell = v => {
    assert.equal(v.open, true); assert.equal(v.covers, true, 'the dark covers the whole screen');
    assert.equal(v.floating, true, 'the page behind does not scroll');
    assert.ok(v.home.shown && v.home.opacity === '1' && v.home.inView && v.home.h >= 44, 'the way home is on screen');
    assert.ok(contrast(v.home.color, 'rgb(1, 2, 3)') >= 4.5, `come home stays readable (${contrast(v.home.color, 'rgb(1, 2, 3)').toFixed(2)}:1)`);
  };
  const accelerated = `(() => { const wait = window.setTimeout; window.setTimeout = (fn, ms, ...rest) => wait(fn, ms >= 60000 ? 400 : ms, ...rest); })();`;

  // A: set out with a question and seven minutes; Escape comes home.
  await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await load({ html: source });
  let v = await view();
  assert.ok(v.threshold && v.controls && !v.byHand && !v.receipt && !v.open);
  assert.deepEqual(v.small, [], 'charter controls are at least 44px tall');
  fits(v);
  await shot('desktop-threshold', '#threshold');
  await delay(300);
  const settled = requests.length;
  await evaluate(`document.getElementById('question').focus()`);
  await send('Input.insertText', { text: 'what is underneath the noise?' });
  await tap('input[name="budget"][value="7"]');
  await tap('#set-out');
  await until(() => evaluate(`document.getElementById('float').open`), 'the float opens');
  v = await view();
  floatingWell(v);
  assert.equal(v.deep, true); assert.equal(v.transition, '20s', 'the dark arrives slowly');
  assert.equal(v.focused, 'come-home', 'focus waits on the way home');
  await delay(400);
  await escape();
  await until(async () => (await view()).receipt, 'Escape brings you home to a receipt', 5000);
  v = await view();
  assert.match(v.by, /^you · /); assert.match(v.planned, /^7 min · 7 分鐘$/); assert.match(v.actual, /^\d+ s · \d+ 秒$/);
  assert.ok(v.start && v.end, 'the receipt names when you set out and came back');
  assert.equal(v.question, 'what is underneath the noise?'); assert.equal(v.questionRow, true);
  assert.equal(v.focused, 'return-title'); assert.equal(v.open, false); assert.equal(v.floating, false); assert.equal(v.threshold, false);
  assert.deepEqual(v.kept, [0, 0, ''], 'nothing stored');
  assert.deepEqual(v.small, [], 'receipt buttons are at least 44px tall');
  await shot('desktop-receipt', '#receipt');
  await tap('#copy-receipt');
  await until(async () => (await view()).status !== '', 'copying says what happened');
  await tap('#float-again');
  v = await view();
  assert.ok(v.threshold && !v.receipt && v.focused === 'question');

  // B: the come-home button, pressed, with the hum asked for.
  await tap('#hum');
  await tap('#set-out');
  await until(() => evaluate(`document.getElementById('float').open`), 'the float opens again');
  await delay(300);
  await tap('#come-home');
  await until(async () => (await view()).receipt, 'the button brings you home', 5000);
  v = await view();
  assert.match(v.by, /^you · /);
  // The browser may retry the site icon on its own (the harness refuses it); the room itself asks for nothing.
  const iconKit = /^\/(?:favicon[\w.-]*|apple-touch-icon\.png|site\.webmanifest)$/;
  assert.deepEqual(requests.slice(settled).map(r => r.url).filter(url => !iconKit.test(new URL(url).pathname)), [], 'floating, the hum and the receipt make no request');

  // C: reduced motion dims at once, and the spent budget brings you home (timers ≥ 1 min shortened to 0.4 s).
  await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await load({ html: source, init: accelerated });
  await tap('#set-out');
  v = await view();
  floatingWell(v);
  assert.equal(v.transition, '0s', 'reduced motion: an instant dim'); assert.equal(v.glow, 'none', 'reduced motion: the light does not breathe');
  await shot('reduced-float');
  await until(async () => (await view()).receipt, 'the budget brings you home', 5000);
  v = await view();
  assert.match(v.by, /^the budget · /); assert.match(v.planned, /^3 min · 3 分鐘$/); assert.equal(v.questionRow, false);

  // D: with motion, the budget's return is gentle, and the way home still answers during it.
  await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await load({ html: source, init: accelerated });
  await tap('#set-out');
  await until(() => evaluate(`document.getElementById('float').open && !document.getElementById('float-dark').classList.contains('deep')`), 'the budget begins the return');
  v = await view();
  assert.equal(v.transition, '8s', 'a spent budget fades back slowly'); floatingWell(v);
  await delay(500);
  assert.equal((await view()).receipt, false, 'still on the way back');
  await tap('#come-home');
  await until(async () => (await view()).receipt, 'pressing come home during the return finishes it', 3000);
  assert.match((await view()).by, /^the budget · /, 'the receipt keeps who ended it');

  // E: phone widths.
  for (const width of [320, 390]) {
    await viewport(width, 800, true);
    await load({ html: source });
    v = await view(); fits(v); assert.deepEqual(v.small, []);
    if (width === 390) await shot('mobile-threshold');
    await tap('#set-out');
    floatingWell(await view());
    await tap('#come-home');
    await until(async () => (await view()).receipt, `home at ${width}px`, 5000);
    fits(await view());
    if (width === 390) await shot('mobile-receipt', '#receipt');
  }
  await viewport(1440);

  // F: without JavaScript the room is a plate and a by-hand float.
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await load({ html: source });
  v = await view();
  assert.ok(v.byHand && !v.controls && !v.open && !v.receipt && v.plate, 'no-JS: by-hand note, no controls, the plate readable');
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  console.log('浮室 browser PASS: question + 7 min → Escape home; button home with the hum; reduced-motion instant dim + budget home; gentle 8 s budget return still answers the button; 320/390 px; no-JS by-hand; zero requests, nothing stored.');
});
