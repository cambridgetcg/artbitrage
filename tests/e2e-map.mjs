// E2E: the map must tell the truth —
// map.json must parse; every room it names must be a real file
// at the repo root; map.html must link every room; sitemap.xml
// must list every internal room exactly once. A map that lies
// is worse than no map: the gap it claims to bridge stays open.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

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
