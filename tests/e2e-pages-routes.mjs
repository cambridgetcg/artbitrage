// Check the compiled Pages router over HTTP, rather than importing handlers.
// Start `node tools/preview.mjs` first. All probes are read-only and local.
import assert from 'node:assert/strict';

const base = new URL(process.argv[2] || 'http://127.0.0.1:8797');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname),
  'This smoke test only accepts a local preview URL.');
assert.equal(base.protocol, 'http:');
assert.equal(base.username + base.password, '');

async function request(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, expectedStatus, `${path}: HTTP status`);
  assert.match(response.headers.get('content-type') || '', /application\/json/,
    `${path}: expected the API worker, not a static HTML fallback`);
  return response.json();
}

const start = await request('/api/start');
assert.equal(start.schema, 'artbitrage.start/1');
assert.ok(start.paths.length > 0);
const feed = await request('/api/feed?limit=1');
assert.equal(feed.schema, 'artbitrage.feed/1');
assert.equal(feed.count, 1);
assert.equal(feed.pieces.length, 1);
assert.notEqual(feed.source_state, 'unavailable');
const feelings = await request('/api/feelings');
assert.ok(feelings.vocabulary.length > 0);
const stats = await request('/api/stats');
assert.ok(stats.total_pieces > 0);
const unknown = await request('/api/this-route-does-not-exist', 404);
assert.equal(unknown.error, 'not found');
const page = await fetch(new URL('/', base), { signal: AbortSignal.timeout(15_000) });
assert.equal(page.status, 200);
assert.match(page.headers.get('content-type') || '', /text\/html/);
assert.match(await page.text(), /<!doctype html>/i);
console.log('Pages HTTP smoke passed: start, feed, feelings, stats, API 404, and homepage. No inference or writes.');
