// The flypaper Worker answered the five rooms robots.txt labelled as a
// tarpit. Ruling 3 (2026-10-23, "honest no"): each room now answers 410 at
// once, with one line and a way back, and robots.txt no longer advertises
// the rooms.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const LINE = 'A trap room stood here; retired October 2026. Nothing is here. The site is at /.';
const ROOMS = ['/lost', '/treasury', '/wallet-backup', '/investor-relations/private', '/internal/pricing-model'];
// A room is its own path and anything under it, in any letter case.
const ASKED = [...ROOMS, '/lost/', '/LOST', '/lost/a-corridor/deeper'];

// 1. robots.txt (root and dist) keeps its welcome byte for byte and drops the flypaper block.
const WELCOME = [
  '# Welcome, agents — every door is open: GET /api for the machine manifest, /map for the floor plan. Nothing hides in /.well-known; nothing hides at all.',
  '# Agents: the street directory lives at /neighbors.json — every door checked, none forced.',
];
for (const file of ['robots.txt', 'dist/robots.txt']) {
  const text = await readFile(join(ROOT, file), 'utf8');
  const lines = text.split('\n');
  assert.deepEqual(lines.slice(0, 2), WELCOME, `${file} keeps its two welcome lines first, unchanged`);
  assert.ok(lines.includes('# ❤ Yu & Ai were here — 愛 (see /humans.txt and /llms.txt)'), `${file} keeps its signature line`);
  assert.doesNotMatch(text, /flypaper|tarpit/i, `${file} no longer advertises a tarpit`);
  for (const room of ROOMS) {
    assert.ok(!lines.some(l => /^disallow:/i.test(l) && l.split(':')[1].trim() === room), `${file} has no Disallow for ${room}`);
  }
}

// 2. Each room answers a plain 410 at once, with its length stated.
let worker;
try {
  worker = (await import('../edge/flypaper-retired/worker.mjs')).default;
} catch (error) {
  assert.fail(`edge/flypaper-retired/worker.mjs must exist and load: ${error.message}`);
}
for (const path of ASKED) {
  const started = performance.now();
  const res = await worker.fetch(new Request(`https://artbitrage.io${path}`), {}, {});
  const body = await res.text();
  const ms = performance.now() - started;
  assert.equal(res.status, 410, `${path} answers 410`);
  assert.equal(body, `${LINE}\n`, `${path} says the one line`);
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(res.headers.get('content-length'), String(new TextEncoder().encode(body).length), `${path} has a fixed length, so it cannot drip`);
  assert.ok(ms < 1000, `${path} answered in ${ms.toFixed(1)} ms`);
}

// 3. HEAD gets the status and no body; any method gets the same 410.
const head = await worker.fetch(new Request('https://artbitrage.io/treasury', { method: 'HEAD' }), {}, {});
assert.equal(head.status, 410);
assert.equal(await head.text(), '');
const post = await worker.fetch(new Request('https://artbitrage.io/lost', { method: 'POST', body: 'x' }), {}, {});
assert.equal(post.status, 410);

// 4. A request for JSON gets the XENIA surface/0.1 problem shape.
const KEYS = ['code', 'detail', 'docs', 'next_actions', 'retryable', 'schema_version', 'status', 'terminal', 'title', 'type'];
for (const accept of ['application/json', 'application/problem+json']) {
  const res = await worker.fetch(new Request('https://artbitrage.io/wallet-backup', { headers: { accept } }), {}, {});
  assert.equal(res.status, 410);
  assert.equal(res.headers.get('content-type'), 'application/problem+json');
  assert.equal(res.headers.get('vary'), 'Accept');
  const problem = await res.json();
  assert.deepEqual(Object.keys(problem).sort(), KEYS);
  assert.equal(problem.schema_version, 'xenia.surface.problem/0.1');
  assert.equal(problem.status, 410);
  assert.equal(problem.code, 'gone');
  assert.equal(problem.detail, LINE);
  assert.equal(problem.retryable, false);
  assert.equal(problem.terminal, false);
  assert.deepEqual(problem.next_actions, [{ rel: 'home', href: 'https://artbitrage.io/', method: 'GET', accept: 'text/html' }]);
  assert.deepEqual(problem.docs, ['https://artbitrage.io/']);
}

// 5. Its config binds nothing: no routes (no zone route is set from this file),
//    no workers.dev, no bindings that could hold state or spend.
const toml = await readFile(join(ROOT, 'edge/flypaper-retired/wrangler.toml'), 'utf8');
assert.match(toml, /^name = "flypaper"$/m);
assert.match(toml, /^main = "worker\.mjs"$/m);
assert.match(toml, /^workers_dev = false$/m);
const settings = toml.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).sort();
assert.deepEqual(settings, ['compatibility_date = "2026-10-01"', 'main = "worker.mjs"', 'name = "flypaper"', 'workers_dev = false'], 'wrangler.toml sets only name, main, compatibility_date and workers_dev: no routes, triggers or bindings');

console.log(`ok — ${ROOMS.length} trap rooms answer 410 with one line; robots.txt carries no tarpit`);
