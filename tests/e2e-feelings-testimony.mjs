// Public feeling testimony must be public only after explicit consent.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PUBLIC_DISPLAY_CONSENT_VERSION,
  PUBLIC_TESTIMONY_KEY_PREFIX,
  TESTIMONY_DISPLAY_POLICY,
  onRequestGet,
  onRequestOptions,
  onRequestPost,
} from '../functions/api/feelings/testimony.js';
import { agentManifest } from '../functions/api/agent-manifest.js';

class FakeKV {
  constructor() {
    this.data = new Map();
    this.puts = 0;
    this.listCalls = 0;
  }

  async list({ prefix, limit, cursor }) {
    this.listCalls += 1;
    const all = [...this.data.keys()]
      .filter(name => name.startsWith(prefix))
      .sort();
    const start = cursor ? Number(cursor) : 0;
    const end = Math.min(start + limit, all.length);
    return {
      keys: all.slice(start, end).map(name => ({ name })),
      list_complete: end >= all.length,
      ...(end < all.length ? { cursor: String(end) } : {}),
    };
  }

  async get(key) {
    return this.data.get(key) ?? null;
  }

  async put(key, value) {
    this.puts += 1;
    this.data.set(key, value);
  }
}

const kv = new FakeKV();
const env = { PEBBLES: kv };

async function post(body) {
  const response = await onRequestPost({
    request: new Request('https://artbitrage.test/api/feelings/testimony', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  });
  return { response, body: await response.json() };
}

async function get(path = '/api/feelings/testimony', requestEnv = env) {
  const response = await onRequestGet({
    request: new Request(`https://artbitrage.test${path}`),
    env: requestEnv,
  });
  return { response, body: await response.json() };
}

for (const publicDisplayConsent of [undefined, false, 'true', 1]) {
  const before = kv.puts;
  const out = await post({
    feeling: 'awe',
    words: 'the room grew larger',
    public_display_consent: publicDisplayConsent,
  });
  assert.equal(out.response.status, 400);
  assert.equal(out.body.received, false);
  assert.equal(out.body.error, 'public_display_consent_required');
  assert.match(out.body.message, /accepted for public display without moderation/);
  assert.match(out.body.message, /propagation may briefly delay/);
  assert.doesNotMatch(out.body.message, /at once/);
  assert.equal(kv.puts, before, 'rejected consent must not write');
}

for (const scalar of [null, [], 'words']) {
  const before = kv.puts;
  const out = await post(scalar);
  assert.equal(out.response.status, 400);
  assert.equal(kv.puts, before, 'non-object JSON must not write');
}

let response = await onRequestPost({
  request: new Request('https://artbitrage.test/api/feelings/testimony', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not-json',
  }),
  env,
});
assert.equal(response.status, 400);
assert.equal(kv.puts, 0);

// More than one old KV page must never hide a newly consented record.
for (let i = 0; i < 150; i += 1) {
  kv.data.set(
    `feelings:t:awe:2025-01-01T00:00:${String(i).padStart(3, '0')}Z`,
    JSON.stringify({
      feeling: 'awe',
      words: `legacy words ${i}`,
      at: '2025-01-01T00:00:00.000Z',
    }),
  );
}

let out = await post({
  feeling: 'AWE',
  words: '  the room   grew larger  ',
  work: '',
  from: '',
  public_display_consent: true,
});
assert.equal(out.response.status, 201);
assert.equal(out.response.headers.get('cache-control'), 'no-store');
assert.equal(out.response.headers.get('access-control-allow-origin'), '*');
assert.equal(out.body.received, true);
assert.equal(out.body.accepted_for_public_display, true);
assert.equal('published' in out.body, false);
assert.equal(out.body.status, 'received, unverified');
assert.match(out.body.id, /^[0-9a-f-]{36}$/);
assert.equal(kv.puts, 1);

const firstKey = [...kv.data.keys()]
  .find(key => key.startsWith(PUBLIC_TESTIMONY_KEY_PREFIX));
assert.match(
  firstKey,
  /^feelings:public:v1:\d{13}:awe:[0-9a-f-]{36}$/,
);
const firstStored = JSON.parse(kv.data.get(firstKey));
assert.deepEqual(Object.keys(firstStored).sort(), [
  'at',
  'consent',
  'feeling',
  'id',
  'words',
]);
assert.equal(firstStored.feeling, 'awe');
assert.equal(firstStored.words, 'the room grew larger');
assert.equal(firstStored.consent.version, PUBLIC_DISPLAY_CONSENT_VERSION);
assert.equal(firstStored.consent.public_display, true);
assert.equal(firstStored.consent.asserted_by_submitter, true);
assert.equal(firstStored.consent.identity_verified, false);
assert.equal(firstStored.consent.recorded_at, firstStored.at);

out = await post({
  feeling: 'awe',
  words: 'a second public note',
  work: 'The Great Wave',
  from: 'a visitor',
  public_display_consent: true,
});
assert.equal(out.response.status, 201);
assert.equal(kv.puts, 2);

kv.data.set(
  'feelings:t:awe:legacy',
  JSON.stringify({
    feeling: 'awe',
    words: 'old words without consent',
    from: 'legacy name',
    at: '2026-01-01T00:00:00.000Z',
  }),
);
kv.data.set(
  `${PUBLIC_TESTIMONY_KEY_PREFIX}8000000000000:awe:wrong-consent`,
  JSON.stringify({
    id: 'wrong',
    feeling: 'awe',
    words: 'wrong consent version',
    at: '2026-01-02T00:00:00.000Z',
    consent: {
      version: 'older/0',
      public_display: true,
      asserted_by_submitter: true,
    },
  }),
);

out = await get();
assert.equal(out.response.status, 200);
assert.equal(out.body.status, 'received, unverified — the keeper reads before anything is folded in');
assert.equal(out.body.count, 2);
assert.equal(out.body.received.length, 2);
assert.ok(out.body.received[0].at >= out.body.received[1].at);
assert.ok(out.body.received.every(item => item.consent.public_display === true));
assert.ok(out.body.received.every(item => item.consent.identity_verified === false));
assert.equal(out.body.received.some(item => /old words/.test(item.words)), false);
assert.equal(out.body.received.some(item => /wrong consent/.test(item.words)), false);
assert.equal(out.body.received.some(item => item.work === 'The Great Wave'), true);
assert.equal(out.body.received.some(item => item.from === 'a visitor'), true);
assert.equal(out.body.listing.order, 'newest_first');
assert.equal(out.body.listing.scan_complete, true);
assert.equal(out.body.listing.more_may_exist, false);
assert.equal(out.body.listing.keys_scanned, 3);
assert.equal(
  out.body.received.some(item => /legacy words/.test(item.words)),
  false,
);

out = await get('?feeling=awe');
assert.equal(out.body.count, 2);
out = await get('?feeling=joy');
assert.equal(out.body.count, 0);

out = await get('/api/feelings/testimony', {});
assert.deepEqual(out.body.received, []);
assert.deepEqual(out.body.display_policy, TESTIMONY_DISPLAY_POLICY);

const policy = TESTIMONY_DISPLAY_POLICY;
assert.equal(policy.visibility, 'accepted_for_public_display');
assert.match(policy.visibility_note, /eventually consistent/);
assert.match(policy.visibility_note, /briefly lag/);
assert.equal(policy.automatic_expiry, false);
assert.equal(policy.removal.self_service, false);
assert.equal(policy.removal.public_request_channel, null);
assert.match(policy.removal.note, /No reachable public removal channel/);
assert.match(policy.application_storage.provider_logs, /Cloudflare may retain/);
assert.equal(policy.application_storage.ip_address_field_added, false);
assert.equal(policy.application_storage.user_agent_field_added, false);
assert.equal(policy.additional_reuse_grant, false);

response = await onRequestOptions();
assert.equal(response.status, 204);
assert.equal(response.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');

const htmlSource = await readFile(new URL('../feelings.html', import.meta.url), 'utf8');
const htmlDeployed = await readFile(new URL('../dist/feelings.html', import.meta.url), 'utf8');
assert.equal(htmlDeployed, htmlSource, 'Feelings page must match its deploy mirror');
const checkbox = htmlSource.match(/<input[^>]+id="t-public"[^>]*>/)?.[0] || '';
assert.match(checkbox, /type="checkbox"/);
assert.match(checkbox, /\brequired\b/);
assert.match(checkbox, /aria-describedby="t-public-detail"/);
assert.doesNotMatch(checkbox, /\bchecked\b/);
assert.match(htmlSource, /accepted directly for this public received wall/i);
assert.match(htmlSource, /storage propagation may briefly delay/i);
assert.match(htmlSource, /There is no self-service removal/);
assert.match(htmlSource, /This consent grants no additional copyright or reuse licence/);
assert.match(htmlSource, /public_display_consent: document\.getElementById\('t-public'\)\.checked/);
assert.match(htmlSource, /publish this testimony/);
assert.match(htmlSource, /form\.testimony \.consent\{[\s\S]*?font-size:\.8rem/);
assert.match(htmlSource, /form\.testimony \.policy\{[\s\S]*?font-size:\.8rem/);

const functionSource = await readFile(
  new URL('../functions/api/feelings/testimony.js', import.meta.url),
);
const functionDeployed = await readFile(
  new URL('../dist/functions/api/feelings/testimony.js', import.meta.url),
);
assert.deepEqual(functionDeployed, functionSource, 'testimony function must match deploy mirror');

const testimonyRoute = agentManifest().routes.find(
  route => route.method === 'POST' && route.path === '/api/feelings/testimony',
);
assert.match(testimonyRoute.desc, /public_display_consent: true/);
assert.match(testimonyRoute.desc, /propagation may briefly lag/);

console.log('artbitrage feelings testimony e2e passed');
