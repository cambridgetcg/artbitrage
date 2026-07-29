// The Castle crossing is a reference, not a content pipe.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ARTBITRAGE_CASTLE_REFERENCE,
  CASTLE_GATE_REVISION,
  CASTLE_MANIFEST_DIGEST,
  CASTLE_PAYLOAD_DIGEST,
  CASTLE_PRODUCER_PROTOCOL,
  CASTLE_PROTOCOL_MANIFEST_REVISION,
  CASTLE_REFERENCE_SCHEMA,
  CASTLE_SOURCE_REVISION,
  castleReferenceIsDisabled,
} from '../functions/api/castle-reference.js';
import {
  ARTBITRAGE_WAKE,
  ROUTES,
  agentManifest,
} from '../functions/api/agent-manifest.js';
import {
  onRequestGet,
  onRequestOptions,
  onRequestPost,
} from '../functions/api/[[route]].js';

const reference = ARTBITRAGE_CASTLE_REFERENCE;
const gitRevision = /^[0-9a-f]{40}$/;

assert.equal(reference.schema, 'artbitrage.castle-reference/1');
assert.equal(CASTLE_REFERENCE_SCHEMA, 'artbitrage.castle-reference/1');
assert.equal(reference.producer.protocol, 'castle-understanding/v0.1');
assert.equal(CASTLE_PRODUCER_PROTOCOL, 'castle-understanding/v0.1');

for (const revision of [
  CASTLE_PROTOCOL_MANIFEST_REVISION,
  CASTLE_GATE_REVISION,
  CASTLE_SOURCE_REVISION,
]) {
  assert.match(revision, gitRevision);
}
assert.ok(reference.producer.manifest.locator.includes(CASTLE_PROTOCOL_MANIFEST_REVISION));
assert.ok(reference.snapshot.payload.locator.includes(CASTLE_GATE_REVISION));
assert.equal(reference.producer.manifest.digest, CASTLE_MANIFEST_DIGEST);
assert.equal(
  CASTLE_MANIFEST_DIGEST,
  'sha256:41189b8566826d00fcf8b4caf58c8811c6e0fb416323d78439a714a19ed85ae3',
);
assert.equal(reference.producer.manifest.bytes, 1866);
assert.equal(
  reference.producer.manifest.schema.digest,
  'sha256:5503f2dafda0587ca3a3a364965f9d9ce98359951c013abbe5bc0ce0913c314e',
);
assert.equal(reference.producer.manifest.schema.bytes, 6494);
assert.equal(
  reference.producer.manifest.protocol_document.digest,
  'sha256:476dfff40aa3aae8a58da04d018de26d987629970142758e307891862e7b3550',
);
assert.equal(reference.producer.manifest.protocol_document.bytes, 6366);
assert.equal(reference.snapshot.payload.digest, CASTLE_PAYLOAD_DIGEST);
assert.equal(
  CASTLE_PAYLOAD_DIGEST,
  'sha256:f85a43806594bf77a9f17210ae56a83aa8ce6c7d4cdb6b62c15284f7c76ff804',
);
assert.equal(reference.snapshot.payload.bytes, 2239836);
assert.equal(reference.snapshot.forged_at, '2026-07-07T21:45:49.583Z');
assert.deepEqual(reference.snapshot.counts, {
  rooms: 450,
  words: 169,
  open_questions: 13,
  settled_questions: 160,
});
assert.equal(reference.snapshot.source.revision_publicly_resolvable, false);
assert.match(reference.snapshot.source.reachability_note, /rebased away/);
assert.equal(reference.doors.public_gate.currency, 'moving_latest_presentation');
assert.match(reference.doors.public_gate.note, /exact referenced bytes/);

assert.equal(reference.rights.spdx, 'NOASSERTION');
assert.equal(reference.rights.grant, 'none_declared');
assert.equal(reference.authority.automatic_action, 'never');
assert.deepEqual(reference.authority.grants, []);
for (const flag of [
  'castle_content_included',
  'content_copied_into_artbitrage',
  'runtime_fetch_or_proxy',
  'reads_home_working_tree',
  'writes_back_to_castle',
  'background_loop_added',
]) {
  assert.equal(reference.crossing[flag], false, `${flag} must remain false`);
}
assert.equal(reference.lifecycle.scheduled_refresh, false);
assert.match(reference.lifecycle.update_rule, /mutable canonical response/);
assert.equal(reference.return.automatic_ingest_into_castle, false);
assert.equal(reference.return.public_submission_available, false);
assert.equal(reference.return.transport, null);
assert.equal(
  reference.return.declared_by_receipt.field,
  'return.public_correction',
);
assert.match(reference.return.note, /public issue creation is currently restricted/);
assert.equal(reference.walking_past_is_honored, true);
assert.doesNotMatch(JSON.stringify(reference), /\/Users\/|~\/|file:\/\//);

assert.equal(castleReferenceIsDisabled({ CASTLE_BRIDGE_DISABLED: '1' }), true);
for (const value of [undefined, '', '0', 'true', 1, true]) {
  assert.equal(castleReferenceIsDisabled({ CASTLE_BRIDGE_DISABLED: value }), false);
}

let assetReads = 0;
let networkFetches = 0;
const env = {
  ASSETS: {
    async fetch() {
      assetReads += 1;
      throw new Error('the Castle reference must not read static assets');
    },
  },
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  networkFetches += 1;
  throw new Error('the Castle reference must not fetch the network');
};

async function request(handler, path, requestEnv = env, method = 'GET') {
  return handler({
    request: new Request(`https://artbitrage.test${path}`, { method }),
    env: requestEnv,
  });
}

try {
  for (const path of ['/api/castle', '/api/castle/']) {
    const response = await request(onRequestGet, path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(response.headers.get('allow'), 'GET, OPTIONS');
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
    assert.deepEqual(await response.json(), reference);
  }
  assert.equal(assetReads, 0);
  assert.equal(networkFetches, 0);

  const resting = await request(
    onRequestGet,
    '/api/castle',
    { ...env, CASTLE_BRIDGE_DISABLED: '1' },
  );
  assert.equal(resting.status, 503);
  assert.equal(resting.headers.get('cache-control'), 'no-store, max-age=0');
  assert.deepEqual((await resting.json()).facts, {
    source_read: false,
    network_fetch: false,
    content_copied: false,
    write_attempted: false,
    loop_started: false,
  });
  assert.equal(assetReads, 0);
  assert.equal(networkFetches, 0);

  const wakeResponse = await request(onRequestGet, '/api/wake');
  assert.equal(wakeResponse.status, 200);
  const wake = await wakeResponse.json();
  assert.equal(
    wake.endpoints.castle_reference,
    'https://artbitrage.io/api/castle',
  );
  assert.equal(wake.castle_reference.schema, CASTLE_REFERENCE_SCHEMA);
  assert.equal(wake.castle_reference.availability, 'check_endpoint');
  assert.deepEqual(wake, ARTBITRAGE_WAKE);
  assert.equal(assetReads, 0);
  assert.equal(networkFetches, 0);

  const options = await request(onRequestOptions, '/api/castle', env, 'OPTIONS');
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('allow'), 'GET, OPTIONS');
  assert.equal(options.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  assert.doesNotMatch(options.headers.get('access-control-allow-methods'), /POST/);

  const post = await request(onRequestPost, '/api/castle', env, 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, OPTIONS');
  assert.equal((await post.json()).error, 'method_not_allowed');
} finally {
  globalThis.fetch = originalFetch;
}

const manifest = agentManifest();
const castleRoutes = manifest.routes.filter(
  route => route.method === 'GET' && route.path === '/api/castle',
);
assert.equal(castleRoutes.length, 1);
assert.equal(manifest.version, '2.6.0');
assert.equal(manifest.castle_reference.schema, CASTLE_REFERENCE_SCHEMA);
assert.match(manifest.agent_instructions, /never a Castle proxy or action grant/);
assert.ok(ROUTES.culture.routes.some(route => route.path === '/api/castle'));

for (const file of [
  'castle-reference.js',
  'agent-manifest.js',
  '[[route]].js',
]) {
  const source = await readFile(new URL(`../functions/api/${file}`, import.meta.url));
  const deployed = await readFile(new URL(`../dist/functions/api/${file}`, import.meta.url));
  assert.deepEqual(deployed, source, `${file} must match its Cloudflare deploy mirror`);
}

console.log('castle reference e2e passed');
