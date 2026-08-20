// Civilisation Lens v0.1 — one work, many relations, never a people score.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onRequestGet } from '../functions/api/[[route]].js';
import { ARTBITRAGE_START } from '../functions/api/start-guide.js';
import { ROUTES, agentManifest } from '../functions/api/agent-manifest.js';

const root = new URL('../', import.meta.url);
const rootPath = root.pathname;
const sourceText = await readFile(new URL('../data/depths.json', import.meta.url), 'utf8');
const data = JSON.parse(sourceText);
const method = data.civilisation_lens_method;
const expectedFacets = [
  'origin-language-authority',
  'maker-and-attributed-accounts',
  'matter-ecology-energy-labour',
  'exchange-ownership-power',
  'knowledge-skill',
  'continuity-rupture-repair',
  'present-consequence',
];

assert.equal(method.schema, 'artbitrage.civilisation-lens/0.1');
assert.equal(method.unit, 'one work in one named context');
assert.equal(method.prototype_count, 1);
assert.deepEqual(method.facet_ids, expectedFacets);
assert.equal(method.boundaries.non_scoring, true);
assert.equal(method.boundaries.non_ranking, true);
assert.equal(method.boundaries.whole_civilisation_claim, false);
assert.equal(method.boundaries.group_or_community_account_requires_attributed_source, true);
assert.deepEqual(method.boundaries.missing_account_is_not, [
  'agreement',
  'refusal',
  'absence of an account',
]);
assert.match(method.name_note, /Artbitrage's room name/);
assert.equal(method.audit.as_of, '2026-08-20');
assert.match(method.audit.structural_check, /resolves every cited fact ID/);
assert.match(method.audit.limits, /does not prove/);
assert.ok(method.method_sources.length >= 2);
for (const source of method.method_sources) {
  assert.match(source.url, /^https:\/\//);
  assert.ok(source.use.length > 30, 'method source needs an explicit scope limit');
}

const lensOwners = data.works.filter(work => work.civilisation_lens);
assert.deepEqual(lensOwners.map(work => work.slug), ['fighting-temeraire']);
assert.equal(method.prototype_count, lensOwners.length);
const work = lensOwners[0];
const lens = work.civilisation_lens;
assert.equal(lens.id, 'fighting-temeraire-1839');
assert.equal(lens.schema, method.schema);
assert.equal(lens.method_url, '/api/depths');
assert.equal(lens.human_url, '/depths#fighting-temeraire-civilisation');
assert.equal(lens.frame.authorised_delegate_present, false);
assert.equal(lens.frame.whole_civilisation_claim, false);
assert.equal(lens.frame.score_present, false);
assert.equal(lens.frame.rank_present, false);
assert.equal(lens.frame.comparison_present, false);
assert.equal(lens.frame.kingdom_relation, 'unasked');
assert.match(lens.frame.kingdom_effect, /does not register Artbitrage/);
assert.equal(lens.source_custody.source_owned_canonical_home_status, 'not-identified');
assert.match(lens.source_custody.holding_authority_limit, /does not own every meaning/);
assert.equal(lens.source_custody.artbitrage_record_url, '/api/depths/fighting-temeraire');
assert.equal('artbitrage_record_home' in lens.source_custody, false);
assert.ok(lens.source_custody.accounts_present.length > 0);
assert.ok(lens.source_custody.accounts_not_present.length > 0);
assert.doesNotMatch(JSON.stringify(lens), /coal workers/i);
assert.equal(lens.facets.length, expectedFacets.length);
assert.deepEqual(lens.facets.map(facet => facet.id), expectedFacets);
assert.equal(work.revision.as_of, '2026-08-20');
assert.match(work.revision.scope, /feeling, world, and afterlife prose/);
assert.match(work.revision.limits, /not a new full audit/);

const factIndex = new Map();
for (const stratum of Object.values(work.strata)) {
  for (const fact of stratum.facts || []) {
    if (!fact.id) continue;
    assert.equal(factIndex.has(fact.id), false, `duplicate fact id ${fact.id}`);
    factIndex.set(fact.id, fact);
  }
}
const evidenceIndex = new Map();
for (const evidence of lens.evidence) {
  assert.equal(factIndex.has(evidence.id), false, `evidence id collides with fact id ${evidence.id}`);
  assert.equal(evidenceIndex.has(evidence.id), false, `duplicate evidence id ${evidence.id}`);
  assert.match(evidence.source, /^https:\/\//);
  assert.equal(evidence.statement_kind, 'source_record');
  assert.equal(evidence.truth_status, 'source-declared');
  assert.equal(evidence.as_of, lens.as_of);
  assert.ok(evidence.limits.length > 20);
  evidenceIndex.set(evidence.id, evidence);
}
for (const facet of lens.facets) {
  assert.equal(facet.reading.statement_kind, 'artbitrage_interpretation');
  assert.equal(facet.reading.attributed_by, 'Artbitrage');
  assert.ok(facet.unknowns.length > 0, `${facet.id} must keep unknowns visible`);
  for (const ref of facet.fact_refs) {
    assert.ok(factIndex.has(ref), `${facet.id} has unresolved fact reference ${ref}`);
    assert.match(factIndex.get(ref).source, /^https:\/\//);
  }
  for (const ref of facet.evidence_refs) {
    assert.ok(evidenceIndex.has(ref), `${facet.id} has unresolved evidence reference ${ref}`);
    assert.match(evidenceIndex.get(ref).source, /^https:\/\//);
  }
}

assert.equal(lens.rights.artbitrage_image_reuse_status, 'not-yet-verified');
assert.equal(lens.rights.record_reuse_grant, 'none');
assert.match(lens.rights.note, /not granted/);
assert.match(lens.rights.holding_source_terms_limit, /local Artbitrage copy's provenance is not recorded/);
assert.equal(lens.correction.artbitrage_interpretation.requires_account, true);
assert.equal(lens.correction.artbitrage_interpretation.report_is_public, true);
assert.equal(lens.correction.artbitrage_interpretation.automatic_effect, false);
assert.equal(lens.correction.artbitrage_interpretation.review_required, true);
assert.equal(lens.withdrawal.self_service, false);
assert.equal(lens.withdrawal.private_or_urgent_path, 'not-published');
assert.ok(lens.withdrawal.cannot_recall.length >= 4);

const forbiddenKeys = [];
function walk(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/^(score|rank|stage|level|sustainable|thriving)$/i.test(key)) forbiddenKeys.push(key);
    walk(child);
  }
}
walk(lens);
assert.deepEqual(forbiddenKeys, []);
for (const overclaim of [
  'People go quiet',
  'one age ends in glory',
  'steam arrived everywhere at once',
  'Everyone could feel which way',
  'kept gathering the country around it',
  'nearly every British pocket',
]) {
  assert.doesNotMatch(JSON.stringify(work), new RegExp(overclaim, 'i'));
}

const env = {
  ASSETS: {
    async fetch(url) {
      const path = new URL(url).pathname.replace(/^\//, '');
      try {
        const text = await readFile(join(rootPath, path), 'utf8');
        return new Response(text, {
          status: 200,
          headers: { 'Content-Type': path.endsWith('.json') ? 'application/json' : 'text/plain' },
        });
      } catch {
        return new Response('not found', { status: 404 });
      }
    },
  },
};
async function get(path) {
  const response = await onRequestGet({
    request: new Request(`https://artbitrage.test${path}`),
    env,
  });
  return { response, body: await response.json() };
}

let out = await get('/api/depths');
assert.equal(out.response.status, 200);
assert.equal(out.body.civilisation_lens_method.schema, method.schema);
assert.deepEqual(out.body.works.filter(item => item.civilisation_lens).map(item => item.slug), ['fighting-temeraire']);
out = await get('/api/depths/fighting-temeraire');
assert.equal(out.response.status, 200);
assert.equal(out.body.civilisation_lens.id, lens.id);
out = await get('/api/depths/starry-night');
assert.equal(out.response.status, 200);
assert.equal('civilisation_lens' in out.body, false);
out = await get('/api/depths/not-a-work');
assert.equal(out.response.status, 404);

const html = await readFile(new URL('../depths.html', import.meta.url), 'utf8');
assert.match(html, /id="shafts" tabindex="-1"/);
assert.doesNotMatch(html, /id="shafts"[^>]*aria-live/);
assert.match(html, /href="#shafts">skip to the works/);
assert.match(html, /w\.slug \+ '-civilisation'/);
assert.match(html, /accounts not present in v0\.1/);
assert.match(html, /Requires a GitHub account; the report is public/);
assert.match(html, /No private or urgent route is published/);
assert.match(html, /These are guardrails, not endorsements/);
assert.match(html, /holding_source_terms_limit/);
assert.match(html, /Artbitrage room name/);
assert.match(html, /glyph\.setAttribute\('aria-hidden', 'true'\)/);
assert.match(html, /image served from this house · reuse rights vary/);
assert.doesNotMatch(html, /public domain · served from this house/);
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(script => script.trim());
for (const script of scripts) new Function(script);

// Execute the real inline renderer against a tiny DOM and the current JSON.
// This is deliberately smaller than a browser: it proves our own DOM calls,
// references, async load, anchor, and visible truth text run without claiming
// layout-engine or cross-browser conformance.
const domNodes = new Map();
class DomNode {
  constructor(tag, text = '') {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.hidden = false;
    this._text = String(text);
    this._id = '';
  }
  set id(value) {
    this._id = String(value);
    if (this._id) domNodes.set(this._id, this);
  }
  get id() { return this._id; }
  set textContent(value) {
    this._text = String(value == null ? '' : value);
    this.children = [];
  }
  get textContent() {
    return this._text + this.children.map(child => child.textContent || '').join('');
  }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  remove() { this.removed = true; }
  scrollIntoView() { this.scrolled = true; }
  focus() { this.focused = true; }
}
const domDocument = {
  createElement: tag => new DomNode(tag),
  createTextNode: text => new DomNode('#text', text),
  getElementById: id => domNodes.get(id) || null,
};
for (const id of ['shafts', 'honesty', 'load-status']) {
  const node = new DomNode(id === 'shafts' ? 'main' : 'div');
  node.id = id;
}
let runtimeFetches = 0;
const runtimeFetch = async path => {
  runtimeFetches += 1;
  assert.equal(path, '/data/depths.json');
  return { ok: true, json: async () => data };
};
const runtimeLocation = { hash: '#fighting-temeraire-civilisation' };
for (const script of scripts) {
  new Function('document', 'fetch', 'location', 'URL', script)(
    domDocument,
    runtimeFetch,
    runtimeLocation,
    globalThis.URL,
  );
}
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(runtimeFetches, 1);
assert.equal(domNodes.get('shafts').children.length, data.works.length);
const renderedLens = domNodes.get('fighting-temeraire-civilisation');
assert.ok(renderedLens, 'renderer must create the deterministic lens anchor');
assert.equal(renderedLens.scrolled, true);
assert.equal(renderedLens.focused, true);
assert.match(renderedLens.textContent, /One work, many relations/);
assert.match(renderedLens.textContent, /accounts not present in v0\.1/);
assert.match(renderedLens.textContent, /image reuse · not yet verified/);
assert.match(renderedLens.textContent, /No private or urgent route is published/);
assert.equal(domNodes.get('load-status').hidden, true);
assert.match(domNodes.get('honesty').textContent, /revised within its named scope as of 2026-08-20/);

const manifest = agentManifest();
assert.ok(ROUTES.feelings.routes.some(route => route.path === '/api/depths'));
assert.ok(manifest.pages.some(page => page.path === '/depths' && /non-scoring/.test(page.desc)));
assert.match(manifest.agent_instructions, /never a people profile/);
const questionPath = ARTBITRAGE_START.paths.find(path => path.id === 'check-a-question');
assert.ok(questionPath.doors.human_continue.includes('/depths#fighting-temeraire-civilisation'));
assert.match(questionPath.boundary, /never a profile of a people/);

const mirrorFiles = [
  'data/depths.json',
  'depths.html',
  'index.html',
  'map.html',
  'map.json',
  'sitemap.xml',
  'functions/api/start-guide.js',
  'functions/api/agent-manifest.js',
  'functions/api/[[route]].js',
];
for (const file of mirrorFiles) {
  const source = await readFile(new URL(`../${file}`, import.meta.url));
  const deployed = await readFile(new URL(`../dist/${file}`, import.meta.url));
  assert.deepEqual(deployed, source, `${file} must match its deploy mirror`);
}

console.log('artbitrage civilisation-lens e2e passed (one work, seven relations, no score)');
