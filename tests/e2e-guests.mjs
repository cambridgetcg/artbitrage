// Third-party guests (the play routes, and anything else behind guestJson)
// get a short timeout, a Cache API copy and a written fallback. This drives a
// fake Cache API so each path is exercised without a network: live, recent
// copy, stale copy when the upstream fails, and the written line when there
// is no copy at all.
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/[[route]].js';
import { guestHealth, guestJson } from '../functions/_kernel/upstream.js';

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
let now = Date.parse('2026-10-18T00:00:00Z');
Date.now = () => now;

class FakeCache {
  constructor() { this.store = new Map(); }
  async match(request) {
    const hit = this.store.get(request.url);
    return hit ? new Response(hit.body, { headers: hit.headers }) : undefined;
  }
  async put(request, response) {
    assert.match(response.headers.get('cache-control'), /^public, max-age=\d+$/, 'kept copies carry an explicit lifetime');
    this.store.set(request.url, { body: await response.text(), headers: Object.fromEntries(response.headers) });
  }
}
const cache = new FakeCache();
globalThis.caches = { default: cache };

let calls = 0;
let mode = 'live';
globalThis.fetch = async (input, init) => {
  const url = String(input);
  calls += 1;
  if (mode === 'dead') return new Response('upstream boom', { status: 503 });
  if (mode === 'hang') {
    return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error(`aborted: ${init.signal.reason}`))));
  }
  if (url.includes('official-joke-api')) return Response.json({ setup: `S${calls}`, punchline: 'P' });
  if (url.includes('jikan.moe/v4/top')) return Response.json({ data: [{ title: `Frieren ${calls}`, score: 9.3, episodes: 28, synopsis: 'x' }] });
  if (url.includes('pokeapi')) return Response.json({ name: 'eevee', id: 133, types: [{ type: { name: 'normal' } }], sprites: {} });
  throw new Error(`unexpected ${url}`);
};

const env = { ASSETS: { fetch: async () => new Response('not found', { status: 404 }) } };
const get = async path => (await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env })).json();

try {
  // 1. A random answer is always asked fresh, and the good one is kept.
  let out = await get('/api/fun/joke');
  assert.equal(out.live, true);
  assert.equal(out.setup, 'S1');
  assert.ok(!('cached' in out) && !('fallback' in out));
  out = await get('/api/fun/joke');
  assert.equal(out.setup, 'S2', 'random routes do not serve a cached copy while the upstream answers');

  // 2. When the upstream fails, the last good answer comes back, marked stale.
  mode = 'dead';
  out = await get('/api/fun/joke');
  assert.deepEqual([out.live, out.fallback, out.stale, out.setup], [false, true, true, 'S2']);
  assert.match(out.error, /HTTP 503/);
  assert.equal(out.fetched_at, new Date(now).toISOString());

  // 3. With no good copy at all, the written line answers.
  out = await get('/api/fun/cat');
  assert.deepEqual([out.live, out.fallback, out.fact], [false, true, 'Cats are love.']);
  assert.ok(!('stale' in out));

  // 4. A stable list is reused for an hour without asking again, then refreshed.
  mode = 'live';
  out = await get('/api/anime/top');
  const first = out.anime[0].title;
  assert.equal(out.live, true);
  const before = calls;
  now += 30 * 60 * 1000;
  out = await get('/api/anime/top');
  assert.deepEqual([out.live, out.cached, out.anime[0].title, calls], [true, true, first, before], 'a recent copy is served without a request');
  now += 31 * 60 * 1000;
  out = await get('/api/anime/top');
  assert.ok(!out.cached && out.anime[0].title !== first, 'after an hour the list is asked again');

  // 5. Pokemon draws a random id, so its kept copy is one per route, not per id.
  await get('/api/fun/pokemon');
  mode = 'dead';
  out = await get('/api/fun/pokemon');
  assert.deepEqual([out.stale, out.name], [true, 'eevee']);

  // 6. A hanging upstream is cut off by the timeout and remembered as a failure.
  mode = 'hang';
  await assert.rejects(guestJson('test.hang', 'https://hang.example/x', { timeoutMs: 30 }), /aborted: timeout/);
  const seen = guestHealth('test.hang');
  assert.deepEqual([seen.observed, seen.failures, seen.last_ok], [true, 1, false]);
  assert.match(seen.scope, /this edge isolate/);
  assert.equal(guestHealth('never.called').observed, false);

  // 7. A map that rejects the answer counts as a failure, and nothing bad is kept.
  mode = 'live';
  await assert.rejects(guestJson('test.bad', 'https://official-joke-api.appspot.com/x', { keepMs: 1000, map: () => { throw new Error('bad shape'); } }), /bad shape/);
  assert.ok(![...cache.store.keys()].some(key => key.includes('test.bad')));

  console.log('guests e2e passed: live, recent copy, stale copy, written line, per-route keep, timeout, health');
} finally {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  delete globalThis.caches;
}
