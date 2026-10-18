// The baked collection answers exactly as the whole collection.json would,
// even for awkward collections, and never answers from a bake that does not
// describe the collection this deployment publishes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequestGet } from '../functions/api/[[route]].js';
import { bakeCollection } from '../tools/build-dist.mjs';

const piece = (id, form, extra = {}) => ({ id, cycle: 1, form, from_state: 'is', to_state: 'is', gap: `gap ${form}`, bridge: 'b', awakening: 'a', created: '2026-10-01T00:00:00Z', piece: `${id} ${form}`, ...extra });

function site(collection, bakeOf = collection) {
  const text = JSON.stringify(collection);
  const bakedText = JSON.stringify(bakeOf);
  const files = new Map([['/collection.json', text]]);
  if (bakeOf) {
    for (const [path, body] of bakeCollection(bakeOf, { collectionSha256: createHash('sha256').update(bakedText).digest('hex'), collectionBytes: Buffer.byteLength(bakedText) })) files.set(path, body);
  }
  return { ASSETS: { async fetch(url) { const p = decodeURIComponent(new URL(url).pathname); return files.has(p) ? new Response(files.get(p)) : new Response('nf', { status: 404 }); } } };
}
async function answer(env, path) {
  const res = await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env });
  const body = (await res.text()).replace(/"(generated_at|updated|fed_at|as_of)": "[^"]+"/g, '"$1": "-"');
  return { status: res.status, body, from: res.headers.get('x-artbitrage-collection') };
}

// 1. Awkward collections: built-in-named forms and ids, duplicates, non-string ids, many pages, empty.
const awkward = [
  ...Array.from({ length: 230 }, (_, i) => piece(`p${i}`, ['word', 'constructor', '__proto__', 'toString'][i % 4])),
  piece('__proto__', 'word'), piece('constructor', 'glow'), piece('p3', 'echo', { note: 'a duplicate id; the first one wins' }),
  piece(42, 'word'), piece('no-form', undefined), piece('Café ✓', 'light'),
];
const paths = [
  '/api/stats', '/api/forms', '/api/gaps', '/api/feed?limit=100', '/api/art', '/api/art?offset=95&limit=10', '/api/art?offset=230&limit=100', '/api/art?offset=5000',
  '/api/art/p0', '/api/art/p3', '/api/art/__proto__', '/api/art/constructor', '/api/art/42', '/api/art/nope', `/api/art/${encodeURIComponent('Café ✓')}`,
  '/api/art/by-form/constructor', '/api/art/by-form/__proto__', '/api/art/by-form/toString', '/api/art/by-form/word', '/api/art/by-form/nope', '/api/art/by-form/unknown',
  '/api/pipeline/feed?limit=50', '/api/pipeline/agent', '/api/pipeline/human',
];
for (const collection of [awkward, []]) {
  const baked = site(collection);
  const whole = site(collection, null);
  for (const path of paths) {
    const [a, b] = [await answer(baked, path), await answer(whole, path)];
    assert.equal(a.status, b.status, `${path}: status`);
    assert.ok(a.body === b.body, `${path}: the bake must answer as the whole collection does (${collection.length} pieces); first difference near ${[...a.body].findIndex((ch, i) => ch !== b.body[i])}`);
    if (!path.startsWith('/api/pipeline/')) assert.equal(b.from, 'whole', `${path}: labelled as answered from the whole collection`);
  }
}
assert.equal((await answer(site(awkward), '/api/stats')).from, 'baked', 'a current bake is used');

// 2. A stale bake (dist/collection.json changed, the bake did not) is never trusted.
const before = awkward.slice(0, 200);
const after = [...before, piece('fresh-1', 'word')];
const stale = site(after, before);
let out = await answer(stale, '/api/art/fresh-1');
assert.deepEqual([out.status, out.from], [200, 'whole'], 'a new id is found through the whole collection, not refused by the old bake');
out = await answer(stale, '/api/stats');
assert.equal(out.from, 'whole');
assert.match(out.body, /"total_pieces": 201/);

console.log(`collection bake e2e passed: ${paths.length} paths identical baked and whole on an awkward and an empty collection; a stale bake is never used`);
