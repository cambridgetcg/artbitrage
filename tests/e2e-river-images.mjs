// Exercise the River's real preload, display and retry functions without a
// browser or network. Preview assets must come from the preview deployment.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

assert.deepEqual(process.argv.slice(2), [], 'static test only: no --browser mode');
const source = await readFile(new URL('../river.html', import.meta.url), 'utf8');
assert.equal(await readFile(new URL('../dist/river.html', import.meta.url), 'utf8'), source, 'River source and deployment mirror agree');
const declaration = name => {
  const match = source.match(new RegExp(`^function ${name}\\([^]*?^\\}`, 'm'));
  assert.ok(match, `River function ${name} exists`);
  return match[0];
};
const code = ['imageURL', 'preload', 'playMoment'].map(declaration).join('\n');
const preview = 'https://psyche-lamp.artbitrage.pages.dev';
const canonical = 'https://artbitrage.io/assets/psyche/canova.jpg';
const legacy = 'https://artbitrage.io/art/artic-moonrise.jpg';
const museum = 'https://images.metmuseum.org/CRDImages/es/original/DP248228.jpg';
const element = () => ({
  style: { setProperty() {} },
  classList: { add() {}, remove() {}, toggle() {} },
  appendChild() {},
});
const images = [];
const state = { works: [], idx: -1, gen: 0, sinceBridge: 0, bridges: [], wing: 'psyche' };
const sandbox = {
  URL, location: { origin: preview }, innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1,
  state, HOLD_MS: 20000, ENTER_MS: 3000, BRIDGE_EVERY: 4,
  document: { createElement: element },
  Image: class { constructor() { images.push(this); } },
  clearTimers() {}, hideWhisper() {}, after() {}, updateRiverLine() {},
  activeMomentEl: element, nextMomentEl: element,
  currentWork: () => state.works[state.idx],
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const resolve = value => sandbox.imageURL(value);
assert.equal(resolve(canonical), `${preview}/assets/psyche/canova.jpg`);
assert.equal(resolve(`${canonical}?size=large#detail`), `${preview}/assets/psyche/canova.jpg?size=large#detail`);
assert.equal(resolve(legacy), `${preview}/art/artic-moonrise.jpg`, 'older owned /art/ files also travel with the deployment');
for (const value of [museum, 'https://api.nga.gov/iiif/example/full/800,/0/default.jpg',
  'https://artbitrage.io/catalog/cover.jpg', 'https://artbitrage.io/articles/image.jpg',
  'https://artbitrage.io.evil.example/art/image.jpg', 'https://user@artbitrage.io/art/image.jpg',
  'http://artbitrage.io/art/image.jpg', 'https://artbitrage.io/assetsx/image.jpg', 'https://user@artbitrage.io/assets/psyche/canova.jpg',
  'assets/psyche/canova.jpg', '/assets/psyche/canova.jpg',
  '//images.metmuseum.org/image.jpg', 'data:image/gif;base64,AAAA']) {
  assert.equal(resolve(value), value, `non-owned reference remains unchanged: ${value}`);
}
sandbox.location.origin = 'https://artbitrage.io';
assert.equal(resolve(canonical), canonical, 'production URL remains unchanged on production');
sandbox.location.origin = 'http://localhost:8080';
assert.equal(resolve(canonical), 'http://localhost:8080/assets/psyche/canova.jpg', 'local preview uses local assets');
sandbox.location.origin = preview;

for (const width of [1200, 2000]) {
  sandbox.innerWidth = width;
  state.works = [
    { image: canonical, image_large: canonical.replace('.jpg', '-large.jpg') },
    { image: museum, image_large: museum.replace('.jpg', '-large.jpg') },
  ];
  state.idx = -1;
  state.sinceBridge = 0;
  images.length = 0;
  sandbox.playMoment(1);
  assert.equal(images.length, 4, 'three preloads and one displayed image');
  const suffix = width > 1500 ? '-large.jpg' : '.jpg';
  assert.equal(images[0].src, museum.replace('.jpg', suffix), 'museum preload remains external');
  assert.equal(images[1].src, `${preview}/assets/psyche/canova${suffix}`, 'owned preload uses this deployment');
  const displayed = images[3];
  assert.equal(displayed.src, `${preview}/assets/psyche/canova${suffix}`, 'display uses this deployment');
  assert.equal(displayed.crossOrigin, 'anonymous');
  displayed.onerror();
  assert.equal(images.length, 5);
  assert.equal(images[4].src, `${preview}/assets/psyche/canova.jpg`, 'retry uses this deployment and normal-size fallback');
  assert.equal(images[4].crossOrigin, undefined, 'retry still omits crossOrigin');
}
console.log('River image PASS: deployment-local owned assets in preloads/display/retry, museum URLs preserved, production/local origins, source/dist parity.');
