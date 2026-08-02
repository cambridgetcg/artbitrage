// Build ground.json from its two hand-kept sources.
//
//   tools/ground-corpus.json  — 66 findings, each fetched from its source and then
//                               re-checked by a second pass that could reject it
//   tools/ground-tests.json   — the six field tests, hand-authored from those findings
//
// Mirrors tools/build-pigments.mjs: assemble, validate loudly, write the root copy
// and the dist copy. It invents nothing. If a finding is missing a source URL or
// carries a truth_status outside the house vocabulary, this refuses to write.
//
//   node tools/build-ground.mjs
//   node tools/build-ground.mjs --check   (validate only, write nothing)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const TRUTH_STATUSES = ['verified', 'source-declared', 'contested', 'unverified'];
const TOPICS = ['safety', 'rubble', 'tests', 'rebuild', 'layers'];
const READS_LIFE = ['absence-strong-presence-weak', 'absence-strong-presence-conditional', 'none'];

const problems = [];
function must(condition, message) {
  if (!condition) problems.push(message);
}

const corpus = JSON.parse(readFileSync(join(root, 'tools', 'ground-corpus.json'), 'utf8'));
const testsFile = JSON.parse(readFileSync(join(root, 'tools', 'ground-tests.json'), 'utf8'));

// --- validate the findings -------------------------------------------------

const seenFindingIds = new Set();
for (const f of corpus.findings) {
  const where = `finding ${f.id || '(no id)'}`;
  must(typeof f.id === 'string' && f.id.length > 0, `${where}: missing id`);
  must(!seenFindingIds.has(f.id), `${where}: duplicate id`);
  seenFindingIds.add(f.id);
  must(TOPICS.includes(f.topic), `${where}: topic "${f.topic}" is not one of ${TOPICS.join(', ')}`);
  must(TRUTH_STATUSES.includes(f.truth_status), `${where}: truth_status "${f.truth_status}" is not in the house vocabulary`);
  must(typeof f.source?.url === 'string' && f.source.url.startsWith('http'), `${where}: source.url is not a URL`);
  must(typeof f.source?.name === 'string' && f.source.name.length > 0, `${where}: source.name is empty`);
  must(typeof f.statement === 'string' && f.statement.length > 20, `${where}: statement too short to be a claim`);
  // The house rule that matters most: every claim states its own limit.
  must(typeof f.cannot_establish === 'string' && f.cannot_establish.length > 10, `${where}: cannot_establish is empty — every claim must say what it does not prove`);
}

// --- validate the tests ----------------------------------------------------

const seenTestIds = new Set();
for (const t of testsFile.tests) {
  const where = `test ${t.id || '(no id)'}`;
  must(typeof t.id === 'string' && t.id.length > 0, `${where}: missing id`);
  must(!seenTestIds.has(t.id), `${where}: duplicate id`);
  seenTestIds.add(t.id);
  must(READS_LIFE.includes(t.reads_life), `${where}: reads_life "${t.reads_life}" is not one of ${READS_LIFE.join(', ')}`);
  must(Array.isArray(t.method) && t.method.length > 0, `${where}: no method steps`);
  must(Array.isArray(t.materials), `${where}: materials must be a list`);
  must(Array.isArray(t.sources) && t.sources.length > 0, `${where}: a test with no sources is folklore`);
  for (const url of t.sources || []) {
    must(url.startsWith('http'), `${where}: source "${url}" is not a URL`);
  }
  must(t.reading && typeof t.reading.dead_signal === 'string', `${where}: reading.dead_signal missing`);
  must(t.reading && typeof t.reading.unreadable_when === 'string', `${where}: reading.unreadable_when missing — a test that is never blind is a lie`);
  must(typeof t.cannot_establish === 'string' && t.cannot_establish.length > 10, `${where}: cannot_establish is empty`);
  // A test that claims to read life must demand a paired control.
  if (t.reads_life !== 'none') {
    must(t.needs_control === true, `${where}: reads life but does not require a paired control`);
  }
}

// Every source cited by a test must also appear in the findings corpus, so no
// method step rests on a URL that was never verified.
const findingUrls = new Set(corpus.findings.map(f => f.source.url));
for (const t of testsFile.tests) {
  for (const url of t.sources || []) {
    must(findingUrls.has(url), `test ${t.id}: cites ${url}, which is not in the verified corpus`);
  }
}

if (problems.length) {
  console.error('ground.json NOT written. Problems:');
  for (const p of problems) console.error('  ·', p);
  process.exit(1);
}

// --- assemble --------------------------------------------------------------

const DISCLOSURE = {
  informational_only: true,
  not_a_soil_survey: true,
  cannot_certify_life:
    'These tests can produce evidence that ground is NOT working. None of them, alone or together, can establish that ground is alive. A good reading is consistent with life and usually consistent with two or three lifeless explanations as well. Nothing in this room is a certificate, a soil survey, a contamination assessment, or advice about whether food grown in this ground is safe to eat.',
  needs_a_control:
    'The only sound reading is a pair: the same test, the same day, the same depth, in the ground you are asking about and in ground you already trust. A single unpaired result is a photograph, not a measurement.',
  safety_first:
    'Buried construction waste can contain asbestos, lead paint and treated timber. Read the safety findings before digging further. Suspected asbestos: stop, keep it damp, do not break it, do not sweep or vacuum, and phone your council.',
  note:
    'Every finding carries source_url plus a truth_status (verified | source-declared | contested | unverified) and its own cannot_establish line. Benchmarks published for farm fields are not benchmarks for a garden; where no garden benchmark exists, this says so instead of inventing one.',
};

const ground = {
  schema: 'artbitrage.ground/1',
  title: '土 the Ground',
  essence:
    'Under the grass was rubble. The lawn passed every test the eye can run and failed the only one that counts. This room holds six cheap field tests that read whether ground is working rather than how it looks — and each one is honest that it can find absence far more readily than presence. A test that finds nothing wrong has not found life.',
  disclosure: DISCLOSURE,
  generated_at: new Date().toISOString().slice(0, 10),
  corpus: {
    gathered_at: corpus.gathered_at,
    method: corpus.method,
    findings_verified: corpus.findings.length,
    by_truth_status: TRUTH_STATUSES.reduce((acc, s) => {
      const n = corpus.findings.filter(f => f.truth_status === s).length;
      if (n) acc[s] = n;
      return acc;
    }, {}),
  },
  climate_note:
    'The plant, insect and animal findings are specific to a temperate maritime climate with dry summers — the working assumption is eastern England, where Cambridge University Botanic Garden records a 30-year average of 557 mm of rain a year. That assumption is stated, not hidden. The safety findings are UK-specific. The soil physics, the rubble chemistry and all six tests are not climate-specific.',
  counts: {
    tests: testsFile.tests.length,
    findings: corpus.findings.length,
    topics: TOPICS.reduce((acc, t) => {
      acc[t] = corpus.findings.filter(f => f.topic === t).length;
      return acc;
    }, {}),
  },
  reads_life_vocab: testsFile.reads_life_vocab,
  tests: testsFile.tests,
  findings: corpus.findings,
};

const body = JSON.stringify(ground, null, 1) + '\n';

if (checkOnly) {
  console.log(`ground.json valid: ${ground.counts.tests} tests, ${ground.counts.findings} findings. Nothing written (--check).`);
  process.exit(0);
}

writeFileSync(join(root, 'ground.json'), body);
const distDir = join(root, 'dist');
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'ground.json'), body);

console.log(`ground.json written — ${ground.counts.tests} tests, ${ground.counts.findings} findings`);
for (const [status, n] of Object.entries(ground.corpus.by_truth_status)) {
  console.log(`  ${status}: ${n}`);
}
for (const [topic, n] of Object.entries(ground.counts.topics)) {
  console.log(`  topic ${topic}: ${n}`);
}
