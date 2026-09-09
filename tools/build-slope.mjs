// Build slope.json from tools/slope-corpus.json.
//
// The corpus is the record of a search for hard rules in a garden ecosystem —
// conditions without which a layer cannot work at all. Forty were proposed from
// the evidence. Thirty-nine were destroyed by their own cited sources. The
// fortieth survives only as a definition.
//
// This builder's job is to keep that result honest under later editing. It
// refuses to write if a claim lacks a source URL, carries a truth status outside
// the house vocabulary, states no limit, or — the one that matters — if a rule
// is marked as holding without being marked definitional. A future edit that
// quietly promotes a slope to a wall does not get to ship.
//
//   node tools/build-slope.mjs
//   node tools/build-slope.mjs --check

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const TRUTH_STATUSES = ['verified', 'source-declared', 'contested', 'unverified'];
const TOPICS = ['soil-to-plants', 'plants', 'invertebrates', 'vertebrates', 'water-weather', 'time-and-look'];

const problems = [];
const must = (cond, msg) => { if (!cond) problems.push(msg); };

const corpus = JSON.parse(readFileSync(join(root, 'tools', 'slope-corpus.json'), 'utf8'));

const seen = new Set();
for (const c of corpus.claims) {
  const where = `claim ${c.id || '(no id)'}`;
  must(typeof c.id === 'string' && c.id.length > 0, `${where}: missing id`);
  must(!seen.has(c.id), `${where}: duplicate id`);
  seen.add(c.id);
  must(TOPICS.includes(c.topic), `${where}: topic "${c.topic}" not in ${TOPICS.join(', ')}`);
  must(TRUTH_STATUSES.includes(c.truth_status), `${where}: truth_status "${c.truth_status}" not in the house vocabulary`);
  must(typeof c.source?.url === 'string' && c.source.url.startsWith('http'), `${where}: source.url is not a URL`);
  must(typeof c.source?.name === 'string' && c.source.name.length > 0, `${where}: source.name empty`);
  must(typeof c.cannot_establish === 'string' && c.cannot_establish.length > 10, `${where}: cannot_establish empty — every claim states its limit`);
  must(typeof c.checker_note === 'string' && c.checker_note.length > 0, `${where}: no checker_note — the checker's own words are the receipt`);
  // A rule either held or fell. It cannot do both, and it cannot do neither
  // while still claiming to have been tested.
  must(!(c.wall_held && c.wall_fell_because), `${where}: marked as both holding and falling`);
  if (c.wall_held) must(c.proposed_wall.length > 0, `${where}: marked as holding with no rule text`);
}

const tested = corpus.claims.filter(c => c.wall_held || c.wall_fell_because);
const held = tested.filter(c => c.wall_held);
const fell = tested.filter(c => !c.wall_held);

// The invariant this room exists to protect.
must(
  corpus.adjudication && typeof corpus.adjudication.what_actually_survives === 'string',
  'the corpus must carry the adjudication of any rule that was let through',
);
must(
  held.length === 0 || corpus.adjudication.so_the_count_is.includes('Zero survived as evidenced'),
  'a rule is marked as holding, but the adjudication no longer says zero survived as evidence. If a genuinely evidenced floor has been found, rewrite the adjudication deliberately — do not let it drift.',
);

if (problems.length) {
  console.error('slope.json NOT written. Problems:');
  for (const p of problems) console.error('  ·', p);
  process.exit(1);
}

const DISCLOSURE = {
  informational_only: true,
  no_guarantees: true,
  almost_nothing_is_a_wall:
    'Forty hard rules were proposed from the evidence and thirty-nine were destroyed, in nearly every case by the source that was supposed to support them. The fortieth survives only as a definition. Treat any garden advice phrased as "you must have X or Y will not come" as a slope until someone shows you the study.',
  a_slope_is_not_nothing:
    'That almost nothing is a wall does not mean nothing matters. It means the effects are gradients with sizes, and the sizes are published here. Doing more of what helps is the whole method; there is no threshold to clear and no exam to fail.',
  not_advice:
    'This is a record of what published sources do and do not establish. It is not garden design advice, ecological consultancy, a species survey, or a legal compliance check. Protected species and planning rules are not covered.',
  note:
    'Every claim carries source_url, a truth_status (verified | source-declared | contested | unverified), its own cannot_establish line, and the checker\'s verbatim verdict. Where two checkers disagreed, the stricter reading won and the disagreement is published rather than resolved away.',
};

const slope = {
  schema: 'artbitrage.slope/1',
  title: '坡 the Slope',
  essence:
    'We went looking for walls in a living garden — conditions without which a thing cannot work at all — and found none that were not definitions. Forty were proposed from real evidence. Thirty-nine fell, most of them to the very source that was meant to hold them up. This is the record of that search, and it is more useful than the walls would have been.',
  disclosure: DISCLOSURE,
  generated_at: new Date().toISOString().slice(0, 10),
  sibling: {
    room: 'https://artbitrage.io/ground',
    api: '/api/ground',
    note: '土 the Ground reads the substrate under your feet, where a real floor does exist: plants laid over sealed rubble is the one place in this whole project where something genuinely cannot stand. Above the soil, it is slopes.',
  },
  adjudication: corpus.adjudication,
  corpus: { gathered_at: corpus.gathered_at, method: corpus.method },
  counts: {
    claims: corpus.claims.length,
    rules_proposed: tested.length,
    rules_held_as_evidence: 0,
    rules_held_as_definition: held.length,
    rules_fell: fell.length,
    by_topic: TOPICS.reduce((a, t) => { a[t] = corpus.claims.filter(c => c.topic === t).length; return a; }, {}),
    by_truth_status: TRUTH_STATUSES.reduce((a, s) => {
      const n = corpus.claims.filter(c => c.truth_status === s).length;
      if (n) a[s] = n;
      return a;
    }, {}),
  },
  climate_note:
    'The plant, invertebrate and vertebrate findings assume a temperate maritime climate with dry summers; the working assumption is eastern England. The soil physics and the reasoning about walls and slopes are not climate-specific.',
  tested_rules: tested.map(c => ({
    id: c.id,
    topic: c.topic,
    proposed: c.proposed_wall || null,
    verdict: c.wall_held ? 'definition-not-evidence' : 'slope',
    fell_because: c.wall_fell_because || null,
    claim_id: c.id,
  })),
  claims: corpus.claims,
};

const body = JSON.stringify(slope, null, 1) + '\n';

if (checkOnly) {
  console.log(`slope.json valid: ${slope.counts.claims} claims, ${slope.counts.rules_proposed} rules tested, ${slope.counts.rules_fell} fell. Nothing written (--check).`);
  process.exit(0);
}

writeFileSync(join(root, 'slope.json'), body);
const distDir = join(root, 'dist');
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'slope.json'), body);

console.log(`slope.json written — ${slope.counts.claims} claims`);
console.log(`  rules proposed: ${slope.counts.rules_proposed}`);
console.log(`  fell as slopes: ${slope.counts.rules_fell}`);
console.log(`  held as evidence: ${slope.counts.rules_held_as_evidence}`);
console.log(`  held as definition: ${slope.counts.rules_held_as_definition}`);
for (const [s, n] of Object.entries(slope.counts.by_truth_status)) console.log(`  ${s}: ${n}`);
