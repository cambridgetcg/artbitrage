// Stateless reciprocity contract checks for Answering Rhymes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { onRequestGet, onRequestOptions, onRequestPost } from '../functions/api/[[route]].js';

const endpoint = 'https://artbitrage.test/api/answering-rhymes/statements';
const vectors = JSON.parse(
  await readFile(new URL('./fixtures/answering-rhyme-statement-vectors.json', import.meta.url), 'utf8'),
);
assert.equal(vectors.schema, 'answering-rhyme.statement-golden-vectors/1');
assert.equal(vectors.canonicalization, 'answering-rhyme.canonical-json/1');
assert.equal(vectors.vectors.length, 3);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function get(path = '/api/answering-rhymes/statements', env = {}) {
  const response = await onRequestGet({
    request: new Request(`https://artbitrage.test${path}`),
    env,
  });
  return { response, body: await response.json() };
}

async function postRaw(body, { contentType = 'application/json', env = {} } = {}) {
  const headers = contentType === null ? {} : { 'content-type': contentType };
  const response = await onRequestPost({
    request: new Request(endpoint, { method: 'POST', headers, body }),
    env,
  });
  return { response, body: await response.json() };
}

async function post(value, options) {
  return postRaw(JSON.stringify(value), options);
}

async function postChunks(chunks) {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const response = await onRequestPost({
    request: new Request(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: stream,
      duplex: 'half',
    }),
    env: {},
  });
  return { response, body: await response.json() };
}

const unavailableAssets = {
  ASSETS: {
    async fetch() {
      throw new Error('statement discovery must not load or fetch an asset');
    },
  },
};

let out = await get('/api/answering-rhymes/statements', unavailableAssets);
assert.equal(out.response.status, 200);
assert.equal(out.body.schema, 'artbitrage.answering-rhyme-statement-contract/1');
assert.equal(out.body.accepts_schema, 'answering-rhyme.statement/1');
assert.equal(out.body.returns_schema, 'artbitrage.answering-rhyme-statement-witness/1');
assert.equal(out.body.canonicalization.version, 'answering-rhyme.canonical-json/1');
assert.deepEqual(out.body.kinds, ['bless', 'contextualize', 'correct', 'withdraw']);
assert.equal(out.body.limits.request_bytes, 16384);
assert.equal(out.body.limits.target_revision_characters, 100);
assert.equal(out.body.limits.body_characters, 2000);
assert.equal(out.body.limits.language_characters, 35);
assert.equal(out.body.security.identity_authentication, false);
assert.equal(out.body.security.application_persistence, false);
assert.equal(out.body.security.authoritative_effect, 'none');
assert.equal(out.body.security.replay_detection, false);
assert.equal(out.body.security.uniqueness_not_asserted, true);
assert.equal(out.body.security.issuer_attestation.signed, false);

out = await get('/api/wake', unavailableAssets);
assert.equal(
  out.body.endpoints.answering_rhyme_statements,
  'https://artbitrage.io/api/answering-rhymes/statements',
);
assert.equal(
  out.body.reciprocity.answering_rhyme_statements.canonicalization.version,
  'answering-rhyme.canonical-json/1',
);

let preflight = await onRequestOptions({
  request: new Request(endpoint, { method: 'OPTIONS' }),
});
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
assert.match(preflight.headers.get('access-control-allow-methods') || '', /GET, POST, OPTIONS/);
assert.equal(preflight.headers.get('access-control-allow-credentials'), null);

preflight = await onRequestOptions({
  request: new Request('https://artbitrage.test/api/submit', { method: 'OPTIONS' }),
});
assert.equal(preflight.status, 200, 'existing preflight status remains unchanged elsewhere');

for (const vector of vectors.vectors) {
  out = await post(vector.input, { env: unavailableAssets });
  assert.equal(out.response.status, 200, vector.name);
  assert.match(out.response.headers.get('cache-control') || '', /no-store/);
  assert.equal(out.response.headers.get('location'), null, 'a stateless witness has no retrievable URL');
  assert.equal(out.body.schema, 'artbitrage.answering-rhyme-statement-witness/1');
  assert.equal(out.body.statement_schema, 'answering-rhyme.statement/1');
  assert.equal(out.body.canonicalization, 'answering-rhyme.canonical-json/1');
  assert.deepEqual(out.body.statement, vector.normalized, `${vector.name}: normalized statement`);
  assert.equal(canonicalJson(out.body.statement), vector.canonical_json, `${vector.name}: canonical bytes`);
  assert.equal(out.body.content_hash, vector.content_hash, `${vector.name}: portable hash`);
  assert.equal(
    `sha256:${createHash('sha256').update(vector.canonical_json, 'utf8').digest('hex')}`,
    vector.content_hash,
    `${vector.name}: independent digest`,
  );
  assert.equal(out.body.authenticated, false);
  assert.equal(out.body.identity_verified, false);
  assert.equal(out.body.authority_status, 'self-declared-unverified');
  assert.equal(out.body.target_status, 'not-checked');
  assert.equal(out.body.target_check.fetched, false);
  assert.equal(out.body.persisted, false);
  assert.equal(out.body.persistence.status, 'not-persisted-by-application');
  assert.equal(out.body.persistence.retrievable_url, null);
  assert.match(out.body.persistence.note, /access or security logs/i);
  assert.equal(out.body.authoritative_effect, 'none');
  assert.equal(out.body.replay_detection, false);
  assert.equal(out.body.uniqueness_not_asserted, true);
  assert.equal(out.body.issuer_attestation.signed, false);
  assert.equal(out.body.issuer_attestation.independently_verifiable, false);
  assert.equal(out.body.effects.published_relation_changed, false);
  assert.equal(out.body.effects.rights_or_license_changed, false);
  assert.equal(out.body.effects.content_hidden_or_deleted, false);
  assert.equal(out.body.effects.operator_or_sibling_notified, false);
  assert.equal(out.body.authority_evidence.fetched, false);
  assert.equal(out.body.portability.signed, false);
}

const base = vectors.vectors[0].input;
const consequenceTerms = {
  bless: /does not grant copyright/i,
  contextualize: /does not amend the published relation/i,
  correct: /does not overwrite the published relation/i,
  withdraw: /does not hide, delete, or de-index/i,
};
for (const [kind, consequence] of Object.entries(consequenceTerms)) {
  out = await post({ ...base, kind, body: `${kind} statement` });
  assert.equal(out.response.status, 200, kind);
  assert.match(out.body.consequence, consequence, kind);
  assert.equal(out.body.authoritative_effect, 'none', kind);
}

out = await post(base, { contentType: 'text/plain' });
assert.equal(out.response.status, 415);
assert.equal(out.body.error, 'unsupported_media_type');
assert.equal(out.body.persisted, false);

out = await post(base, { contentType: 'application/json; charset="utf-8"' });
assert.equal(out.response.status, 200, 'quoted UTF-8 charset is accepted');

out = await post(base, { contentType: 'application/json; charset=iso-8859-1' });
assert.equal(out.response.status, 415, 'non-UTF-8 JSON charset is rejected');

out = await post(base, { contentType: 'application/json; profile=anything' });
assert.equal(out.response.status, 415, 'arbitrary content-type parameters are rejected');

out = await postRaw('{not json');
assert.equal(out.response.status, 400);
assert.equal(out.body.error, 'invalid_json');

out = await post({ ...base, surprise: true });
assert.equal(out.response.status, 400);
assert.equal(out.body.error, 'invalid_statement');
assert.ok(out.body.issues.some(issue => issue.code === 'unknown_field'));

const { target_revision: _targetRevision, ...missingRevision } = base;
out = await post(missingRevision);
assert.equal(out.response.status, 400);
assert.ok(out.body.issues.some(issue => issue.path === '$.target_revision'));

out = await post({ ...base, canonicalization: 'some-other-canonicalization' });
assert.equal(out.response.status, 400);
assert.ok(out.body.issues.some(issue => issue.path === '$.canonicalization'));

out = await post({ ...base, body: 'control\u0000character' });
assert.equal(out.response.status, 400);
assert.ok(out.body.issues.some(issue => issue.code === 'control_character'));

out = await post({ ...base, relation_key: 'unsafe\nkey' });
assert.equal(out.response.status, 400, 'LF is a control outside body text');
assert.ok(out.body.issues.some(issue => issue.path === '$.relation_key' && issue.code === 'control_character'));

out = await post({
  ...base,
  kind: ' BLESS ',
  declared_by: { ...base.declared_by, claimed_role: ' VIEWER ' },
});
assert.equal(out.response.status, 200);
assert.equal(out.body.statement.kind, 'bless');
assert.equal(out.body.statement.declared_by.claimed_role, 'viewer');

out = await post({
  ...base,
  declared_by: { ...base.declared_by, label: '😀'.repeat(160) },
});
assert.equal(out.response.status, 200, '160 astral Unicode scalars fit the label boundary');

out = await post({
  ...base,
  declared_by: { ...base.declared_by, label: '😀'.repeat(161) },
});
assert.equal(out.response.status, 400, '161 astral Unicode scalars exceed the label boundary');
assert.ok(out.body.issues.some(issue => issue.path === '$.declared_by.label' && issue.code === 'too_long'));

out = await post({ ...base, body: 'x'.repeat(2001) });
assert.equal(out.response.status, 400);
assert.ok(out.body.issues.some(issue => issue.path === '$.body' && issue.code === 'too_long'));

out = await post({ ...base, body: 'x'.repeat(17000) });
assert.equal(out.response.status, 413);
assert.equal(out.body.error, 'request_too_large');

const encoder = new TextEncoder();
out = await postChunks([
  encoder.encode('{"body":"'),
  encoder.encode('x'.repeat(10000)),
  encoder.encode('x'.repeat(7000)),
  encoder.encode('"}'),
]);
assert.equal(out.response.status, 413, 'chunked bodies are bounded without Content-Length');
assert.equal(out.body.error, 'request_too_large');

out = await postChunks([new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d])]);
assert.equal(out.response.status, 400);
assert.equal(out.body.error, 'invalid_encoding');

out = await post({
  ...base,
  evidence_urls: ['http://evidence.example/not-https'],
});
assert.equal(out.response.status, 400);
assert.ok(out.body.issues.some(issue => issue.path === '$.evidence_urls[0]' && issue.code === 'invalid_url'));

out = await post({
  ...base,
  declared_by: { ...base.declared_by, canonical_url: 'https://example.com/has a space' },
});
assert.equal(out.response.status, 400, 'internal URL whitespace is rejected before URL serialization');
assert.ok(out.body.issues.some(issue => issue.path === '$.declared_by.canonical_url' && issue.code === 'invalid_url'));

out = await post({
  ...base,
  declared_by: {
    ...base.declared_by,
    canonical_url: `https://example.com/${'a/../'.repeat(220)}`,
  },
});
assert.equal(out.response.status, 400, 'an overlong raw URL cannot canonicalize around the input limit');
assert.ok(out.body.issues.some(issue => issue.path === '$.declared_by.canonical_url' && issue.code === 'too_long'));

out = await post({
  ...base,
  evidence_urls: Array.from({ length: 13 }, (_, index) => `https://evidence.example/${index}`),
});
assert.equal(out.response.status, 400);
assert.ok(out.body.issues.some(issue => issue.path === '$.evidence_urls' && issue.code === 'too_many_items'));

out = await post({ ...base, declared_at: '2026-02-30T12:00:00Z' });
assert.equal(out.response.status, 400);
assert.ok(out.body.issues.some(issue => issue.path === '$.declared_at'));

console.log('artbitrage reciprocity e2e passed');
