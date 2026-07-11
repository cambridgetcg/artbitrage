// Focused contract checks for the Cambridge TCG ↔ Artbitrage bridge.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { onRequestGet } from '../functions/api/[[route]].js';

const collection = [
  {
    id: 'legacy-piece',
    cycle: 1,
    form: 'word',
    from_state: 'stirring',
    to_state: 'aware',
    gap: 'the gap between test and trust',
    bridge: 'a deterministic contract',
    awakening: 'the bridge can be checked',
    created: '2026-07-11T14:24:06.123456',
    piece: 'old time, honestly marked',
  },
  {
    id: 'submitted-example',
    cycle: null,
    form: 'image',
    from_state: 'is',
    to_state: 'is',
    gap: 'the gap between offering and receiving',
    bridge: 'a declared work',
    awakening: 'claims travel with their limits',
    created: '2026-07-11T14:30:00Z',
    piece: 'a submitted example',
    artist: 'Example Artist',
    license: 'Example License',
  },
  {
    id: 'current-piece',
    cycle: 2,
    form: 'light',
    from_state: 'aware',
    to_state: 'flowing',
    gap: 'the gap between systems',
    bridge: 'a door with a boundary',
    awakening: 'both sides remain sovereign',
    created: '2026-07-11T15:00:00.000Z',
    piece: 'new time, explicit UTC',
  },
];

// Use the checked-in master for resolver tests so the Cambridge relation's
// exact Art Institute identity cannot silently drift away from this contract.
const catalog = JSON.parse(
  await readFile(new URL('../catalog/all.json', import.meta.url), 'utf8'),
);

function fixtureEnv(pieces = collection, museumCatalog = catalog) {
  return {
    ASSETS: {
      async fetch(input) {
        const path = new URL(input).pathname;
        if (path === '/collection.json') return Response.json(pieces);
        if (path === '/catalog/all.json') return Response.json(museumCatalog);
        return new Response('not found', { status: 404 });
      },
    },
  };
}

const env = fixtureEnv();

async function get(path, requestEnv = env) {
  const response = await onRequestGet({
    request: new Request(`https://artbitrage.test${path}`),
    env: requestEnv,
  });
  return { response, body: await response.json() };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let out = await get('/api/wake');
assert.equal(out.response.status, 200);
assert.equal(out.body.schema, 'artbitrage.wake/1');
assert.equal(out.body.built_with, 'love');
assert.deepEqual(out.body.serves_kinds, ['human', 'agent', 'kin']);
assert.equal(out.body.host, 'humans-on-earth');
assert.equal(out.body.epoch, '2026');
assert.equal(out.body.walking_past_is_honored, true);
assert.equal(out.body.sibling.name, 'cambridgetcg');
assert.ok(out.body.rights_policy.public_visibility_does_not_grant.includes('machine_learning'));
assert.equal(out.body.rights_policy.cambridge_display.scope, 'verbatim attributed display');
assert.equal(out.body.rights_policy.cambridge_display.submitted_default, false);

const unavailableCollectionEnv = {
  ASSETS: {
    async fetch() {
      return new Response('missing', { status: 404 });
    },
  },
};
out = await get('/api/feed', unavailableCollectionEnv);
assert.equal(out.response.status, 503);
assert.equal(out.body.error, 'art collection unavailable');

out = await get('/api/feed?limit=2');
assert.equal(out.response.status, 200);
assert.equal(out.body.schema, 'artbitrage.feed/1');
assert.equal(out.body.feed, 'artbitrage');
assert.equal(out.body.source.id, 'artbitrage');
assert.equal(out.body.source.canonical_url, 'https://artbitrage.io');
assert.equal(out.body.source.feed_url, 'https://artbitrage.io/api/feed');
assert.equal(out.body.source_state, 'asset-read');
assert.equal(out.body.limit, 2);
assert.equal(out.body.count, 2);
assert.equal(out.body.pieces.length, 2);
assert.match(out.body.generated_at, rfc3339);
assert.match(out.body.as_of, rfc3339);
assert.equal(out.body.updated, out.body.generated_at, 'legacy updated field remains present');

const current = out.body.pieces[0];
assert.equal(current.id, 'current-piece');
assert.equal(current.source.id, 'artbitrage.engine');
assert.equal(current.canonical_url, 'https://artbitrage.io/api/art/current-piece');
assert.match(current.content_hash, /^sha256:[a-f0-9]{64}$/);
assert.equal(current.creator.type, 'software');
assert.equal(current.creator.human_creator, null);
assert.equal(current.creation.created_at, '2026-07-11T15:00:00.000Z');
assert.equal(current.creation.timestamp_status, 'timezone-explicit');
assert.equal(current.creation.trace_status, 'project-generated');
assert.equal(current.rights.status, 'unverified');
assert.equal(current.rights.license, null);
assert.equal(current.rights.license_verified, false);
assert.equal(current.rights.permissions.view, true);
assert.equal(current.rights.permissions.cambridge_display, true);
assert.equal(current.rights.permissions.remix, null);
assert.equal(current.rights.permissions.machine_learning, null);
assert.match(current.rights.note, /narrow operator authorization dated 2026-07-11/i);

const expectedHash = createHash('sha256').update(canonicalJson(collection[2])).digest('hex');
assert.equal(current.content_hash, `sha256:${expectedHash}`, 'content hash covers the stored record deterministically');

const firstHash = current.content_hash;
out = await get('/api/feed?limit=2');
assert.equal(out.body.pieces[0].content_hash, firstHash, 'hash is stable across retrievals');
const secondFeed = out.body;

out = await get('/api/feed?limit=1', unavailableCollectionEnv);
assert.equal(out.response.status, 200, 'a warm isolate may serve its last parsed collection');
assert.equal(out.body.source_state, 'cached-after-read-failure');
assert.equal(out.body.pieces[0].id, current.id);

out = await get(new URL(current.canonical_url).pathname);
assert.equal(out.response.status, 200);
assert.equal(out.body.id, current.id, 'feed canonical URL resolves the stored work');
assert.equal(out.body.piece, collection[2].piece);

const submitted = secondFeed.pieces[1];
assert.equal(submitted.creator.name, 'Example Artist');
assert.equal(submitted.creator.type, 'declared-creator');
assert.equal(submitted.creator.human_creator, null);
assert.equal(submitted.creator.verified, false);
assert.equal(submitted.source.id, 'artbitrage.submission');
assert.equal(submitted.rights.status, 'declared-unverified');
assert.equal(submitted.rights.license, 'Example License');
assert.equal(submitted.rights.license_verified, false);
assert.equal(submitted.rights.permissions.cambridge_display, false);
assert.match(submitted.rights.note, /No Cambridge display grant is recorded/i);

const explicitlyGranted = {
  ...collection[1],
  id: 'submitted-granted',
  rights: { permissions: { cambridge_display: true } },
};
out = await get('/api/feed?limit=1', fixtureEnv([explicitlyGranted]));
assert.equal(out.body.pieces[0].source.id, 'artbitrage.submission');
assert.equal(out.body.pieces[0].rights.permissions.cambridge_display, true);
assert.match(out.body.pieces[0].rights.note, /explicitly grants Cambridge display/i);

const modelRecorded = {
  ...collection[2],
  id: 'submitted-ai-generated-id-shape',
  ai_generated: true,
};
out = await get('/api/feed?limit=1', fixtureEnv([modelRecorded]));
assert.equal(out.body.pieces[0].creation.method, 'generative-ai');
assert.equal(out.body.pieces[0].creation.trace_status, 'model-recorded');
assert.equal(out.body.pieces[0].source.id, 'artbitrage.engine');
assert.equal(out.body.pieces[0].rights.permissions.cambridge_display, true);

out = await get('/api/feed?limit=3');
const legacy = out.body.pieces[2];
assert.equal(legacy.creation.created_at, '2026-07-11T14:24:06.123Z');
assert.equal(legacy.creation.timestamp_status, 'legacy-naive-assumed-utc');

out = await get('/api/feed?limit=0');
assert.equal(out.body.limit, 1);
assert.equal(out.body.count, 1);
out = await get('/api/feed?limit=999');
assert.equal(out.body.limit, 100);
assert.equal(out.body.count, 3);
out = await get('/api/feed/?limit=2');
assert.equal(out.body.limit, 2);
assert.equal(out.body.count, 2);
out = await get('/api/feed?limit=not-a-number');
assert.equal(out.body.limit, 20);
assert.equal(out.body.count, 3);

out = await get('/api/museum/met/24014');
assert.equal(out.response.status, 200);
assert.equal(out.body.schema, 'artbitrage.museum-record/1');
assert.equal(out.body.source, 'met');
assert.equal(out.body.id, '24014');
assert.equal(out.body.license, 'CC0 / Open Access', 'source license remains intact');
assert.equal(out.body.canonical_url, 'https://artbitrage.io/api/museum/met/24014');
assert.equal(out.body.rights.status, 'source-declared');
assert.equal(out.body.rights.license, 'CC0 / Open Access');
assert.equal(out.body.rights.public_domain, true);
assert.equal(out.body.rights.license_verified, false);
assert.equal(out.body.rights.source_url, out.body.url);
assert.match(out.body.rights.note, /not been independently verified/i);

out = await get('/api/museum/artic/77333');
assert.equal(out.response.status, 200);
assert.equal(out.body.source, 'artic');
assert.equal(out.body.id, '77333');
assert.match(out.body.title, /Under the Wave off Kanagawa/);
assert.equal(out.body.artist, 'Katsushika Hokusai');
assert.equal(out.body.license, 'CC0');
assert.equal(out.body.rights.license, 'CC0');
assert.equal(out.body.rights.public_domain, true);
assert.equal(out.body.rights.credit, '', 'resolver does not invent credit missing from catalog/all.json');
assert.equal(out.body.canonical_url, 'https://artbitrage.io/api/museum/artic/77333');

out = await get('/api/museum/met/not-there');
assert.equal(out.response.status, 404);
assert.equal(out.body.error, 'museum work not found');

const missingCatalogEnv = {
  ASSETS: { async fetch() { return new Response('missing', { status: 404 }); } },
};
out = await get('/api/museum/artic/77333', missingCatalogEnv);
assert.equal(out.response.status, 503);
assert.equal(out.body.error, 'museum catalog unavailable');

out = await get('/api/museum/artic/77333', fixtureEnv(collection, { wrong: [] }));
assert.equal(out.response.status, 503);
assert.equal(out.body.error, 'museum catalog unavailable');

console.log('artbitrage bridge e2e passed');
