// e2e — /api/playlist: 樂 the Playlist. Two shelves that must never blur:
// records we only name, and music we may actually play. Runs WITHOUT a dev
// server (ASSETS mocked from disk, like tests/e2e-ground.mjs).
//
// The load-bearing group is the last one: no route may serve or link audio for
// the listening shelf, no response may lose the boundary, and no lyric may
// appear anywhere in the data.
//
// Run: node tests/e2e-playlist.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onRequestGet, onRequestOptions } from '../functions/api/playlist/[[route]].js';
import { onRequestGet as onBareGet } from '../functions/api/playlist.js';

const root = new URL('../', import.meta.url).pathname;

const env = {
  ASSETS: {
    async fetch(url) {
      const path = new URL(url).pathname.replace(/^\//, '') || 'index.html';
      try {
        return new Response(await readFile(join(root, path), 'utf8'), { status: 200 });
      } catch {
        return new Response('not found', { status: 404 });
      }
    },
  },
};

async function get(path, handler = onRequestGet) {
  const res = await handler({ request: new Request(`https://artbitrage.test${path}`), env });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* text endpoint */ }
  return { res, json, text };
}

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1; }
}

console.log('\n樂 the Playlist — /api/playlist\n');

await test('the directory answers with both shelves named', async () => {
  const { res, json } = await get('/api/playlist');
  assert.equal(res.status, 200);
  assert.equal(json.schema, 'artbitrage.playlist/1');
  assert.ok(json.shelves.listening && json.shelves.playable);
  assert.equal(json.counts.listening, 23);
  assert.ok(Array.isArray(json.endpoints) && json.endpoints.length >= 7);
});

await test('the bare path re-export answers identically', async () => {
  const a = await get('/api/playlist');
  const b = await get('/api/playlist', onBareGet);
  assert.equal(b.res.status, 200);
  assert.equal(b.json.counts.listening, a.json.counts.listening);
});

await test('CORS preflight is answered', async () => {
  const res = await onRequestOptions();
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
});

await test('every listening track carries a real MusicBrainz id and an argued room', async () => {
  const { json } = await get('/api/playlist/listening?limit=50');
  assert.equal(json.total, 23);
  for (const t of json.tracks) {
    assert.match(t.mbid, /^[0-9a-f-]{36}$/, `${t.title} has no MBID`);
    assert.equal(t.musicbrainz, `https://musicbrainz.org/recording/${t.mbid}`, `${t.title} link mismatch`);
    assert.ok(t.room.startsWith('/'), `${t.title} has no room`);
    assert.ok(t.why_this_room.length > 10, `${t.title} placed with no argument`);
    assert.ok(t.artist && t.title);
  }
});

await test('each named room resolves, and an unknown one teaches', async () => {
  const { json } = await get('/api/playlist/room/slope');
  assert.equal(json.track.room, '/slope');
  assert.match(json.track.why_this_room, /gradient|wall/i);
  const withSlash = await get('/api/playlist/room//ground');
  assert.equal(withSlash.json.track.room, '/ground');
  const bad = await get('/api/playlist/room/nowhere');
  assert.equal(bad.res.status, 404);
  assert.ok(bad.json.valid_rooms.includes('/maybe'));
});

await test('every playable item names an exact licence that was actually fetched', async () => {
  const { json } = await get('/api/playlist/playable');
  assert.ok(json.total >= 8);
  for (const p of json.items) {
    assert.equal(p.fetched_ok, true, `${p.title}: licence not fetched`);
    assert.match(p.license_url, /^https?:\/\//, `${p.title}: no licence URL`);
    assert.notEqual(p.license.trim().toLowerCase(), 'creative commons', `${p.title}: licence not specific`);
    assert.equal(typeof p.attribution_required, 'boolean');
    if (p.attribution_required) assert.ok(p.attribution_string.length > 10, `${p.title}: no credit line`);
    assert.ok(p.cannot_establish.length > 5, `${p.title}: states no limit`);
  }
});

await test('playable filters separate credit-free from attribution, and NC from commercial', async () => {
  const free = await get('/api/playlist/playable?attribution=none');
  assert.ok(free.json.items.every(p => !p.attribution_required));
  const nc = await get('/api/playlist/playable?commercial=no');
  assert.ok(nc.json.items.every(p => p.commercial_ok === false));
  assert.ok(nc.json.total >= 1, 'the non-commercial item should be findable — it is the one that becomes a problem if this site ever monetizes');
});

await test('the licensing rule leads, and the findings carry sources', async () => {
  const { json } = await get('/api/playlist/licensing');
  assert.match(json.the_rule, /at least two rights|composition and the recording/i);
  assert.ok(json.findings.length >= 5);
  for (const f of json.findings) assert.match(f.license_url, /^https?:\/\//);
});

await test('the promise ledger judges ten real rooms and refuses one', async () => {
  const { json } = await get('/api/playlist/promises');
  assert.equal(json.count, 10);
  assert.equal(json.keepable, 7);
  const refused = json.ledger.filter(l => l.verdict === 'not-keepable-as-written');
  assert.equal(refused.length, 1);
  assert.equal(refused[0].room, '/popart');
  const half = json.ledger.find(l => l.verdict === 'half-keepable');
  assert.match(half.why, /Stravinsky/);
  assert.match(half.why, /2041/);
});

await test('what was dropped is published, not quietly removed', async () => {
  const { json } = await get('/api/playlist/dropped');
  assert.equal(json.count, 1);
  assert.match(json.dropped[0].seed_title, /Kingdoms/);
  assert.match(json.dropped[0].why, /No recording named/i);
  assert.equal(json.corrections_made, 3);
});

await test('the plain-text shelf is servable and carries the boundary in words', async () => {
  const { res, text } = await get('/api/playlist/text');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /^text\/plain/);
  assert.match(text, /hosts none of this and grants no rights/);
  assert.equal(text.split('\n').filter(l => l.includes(' — ') && l.includes('[/')).length, 23);
});

// --- the line this room exists to hold --------------------------------------

await test('no route serves or links audio for the listening shelf', async () => {
  const AUDIO = /\.(mp3|ogg|wav|flac|m4a|aac|opus)(\?|"|$)/i;
  const { json } = await get('/api/playlist/listening?limit=50');
  for (const t of json.tracks) {
    for (const [k, v] of Object.entries(t)) {
      if (typeof v === 'string') {
        assert.ok(!AUDIO.test(v), `${t.title}: field ${k} points at audio — the listening shelf links to facts, never to the music`);
      }
    }
  }
});

await test('every response keeps the boundary, whatever part you read', async () => {
  const paths = [
    '/api/playlist',
    '/api/playlist/listening?limit=50',
    '/api/playlist/room/maybe',
    '/api/playlist/playable',
    '/api/playlist/licensing',
    '/api/playlist/promises',
    '/api/playlist/dropped',
  ];
  for (const p of paths) {
    const { json } = await get(p);
    assert.equal(json.audio_hosted_here, false, `${p} lost the hosting boundary`);
    assert.equal(json.rights_granted_here, 'none', `${p} lost the rights boundary`);
    assert.equal(json.disclosure.hosts_no_audio, true, `${p} lost its disclosure`);
    assert.match(json.disclosure.curation_is_opinion, /taste|opinion/i);
  }
});

await test('the data carries no lyrics, and says so', async () => {
  const raw = await readFile(join(root, 'playlist.json'), 'utf8');
  const data = JSON.parse(raw);
  assert.match(data.disclosure.no_lyrics, /No lyric/);
  // A crude but real guard: nothing in the corpus should be a long quoted line
  // of song text. Every long string here should be prose about music.
  const quoted = raw.match(/"[^"]{4,}"/g) || [];
  const suspicious = quoted.filter(s => /\b(chorus|verse|refrain|sings?:|lyric)\b/i.test(s) && s.length > 120);
  assert.deepEqual(suspicious, [], `possible lyric content: ${suspicious.slice(0, 2).join(' | ')}`);
});

await test('an unknown route 404s with the endpoint list', async () => {
  const { res, json } = await get('/api/playlist/nowhere/deeper');
  assert.equal(res.status, 404);
  assert.ok(Array.isArray(json.endpoints));
});

console.log(`\n  ${passed} passed\n`);
