// Every Workers AI run is weighed and counted before it starts, and a run
// past the day's cap never reaches Workers AI. With D1 (AI_BUDGET) the count
// is exact and atomic; without it, or when D1 fails, each isolate counts for
// itself and says so. Uses Node's SQLite as the D1 stand-in.
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/[[route]].js';
import { budgetCaps, weigh } from '../functions/_kernel/budget.js';
import { sqliteD1 } from './helpers/d1-sqlite.mjs';

let runs = [];
const AI = { async run(model) { runs.push(model); return { response: 'ok', data: [[1, 2]], image: 'iVBOR' }; } };
const base = { ASSETS: { fetch: async () => new Response('not found', { status: 404 }) }, AI, AI_RUNS_PER_MINUTE: '1000' };
async function get(path, env) {
  const res = await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env });
  return { res, json: await res.json(), budget: res.headers.get('x-artbitrage-ai-budget') };
}

// 1. Weights: small models cost one unit, large ones more, unknown ones as large.
assert.deepEqual(weigh('@cf/meta/llama-3.2-3b-instruct'), { class: 'text', units: 1 });
assert.deepEqual(weigh('@cf/meta/llama-3.3-70b-instruct-fp8-fast'), { class: 'text', units: 8 });
assert.deepEqual(weigh('@cf/black-forest-labs/flux-1-schnell'), { class: 'image', units: 1 });
assert.equal(weigh('@cf/someone/new-model').units, 8);
assert.deepEqual(budgetCaps({}), { text_units_per_day: 1000, images_per_day: 100, runs_per_minute_per_isolate: 30 });
assert.equal(budgetCaps({ AI_TEXT_UNITS_PER_DAY: '12' }).text_units_per_day, 12);

// 2. D1: exact daily count; the run that would pass the cap is refused before Workers AI.
let env = { ...base, AI_BUDGET: sqliteD1(), AI_TEXT_UNITS_PER_DAY: '10' };
runs = [];
for (let i = 1; i <= 10; i++) {
  const { res, budget } = await get('/api/ai/generate?prompt=hi', env);
  assert.equal(res.status, 200);
  assert.equal(budget, `ok; text ${i}/10; d1`);
}
let out = await get('/api/ai/generate?prompt=hi', env);
assert.equal(out.res.status, 429);
assert.equal(out.json.error, 'ai_budget_spent');
assert.equal(out.json.budget.enforcement, 'd1');
assert.ok(Number(out.res.headers.get('retry-after')) > 0);
assert.equal(runs.length, 10, 'the refused run never reached Workers AI');

// 3. A route with a written fallback keeps answering, and says the budget is spent.
out = await get('/api/play/haiku', env);
assert.equal(out.res.status, 200);
assert.equal(out.json.haiku, 'Love is.\nJoy is.\nForever.');
assert.match(out.budget, /^spent; text 10\/10; d1$/);

// 4. A large model is refused when its units would pass the cap, even with units left.
env = { ...base, AI_BUDGET: sqliteD1(), AI_TEXT_UNITS_PER_DAY: '12' };
assert.equal((await get('/api/ai/generate?model=llama3-70b', env)).budget, 'ok; text 8/12; d1');
assert.equal((await get('/api/ai/generate?model=llama3-70b', env)).res.status, 429);
assert.equal((await get('/api/ai/generate?model=llama3', env)).budget, 'ok; text 9/12; d1', 'a small run still fits');
out = await get('/api/ai/generate?model=llama3-70b', { ...base, AI_BUDGET: sqliteD1(), AI_TEXT_UNITS_PER_DAY: '5' });
assert.equal(out.res.status, 429, 'a run larger than the whole cap is refused on the first try');
assert.equal(out.json.budget.reason, 'too_large');
assert.match(out.json.message, /more than the whole daily cap/);
assert.equal(out.res.headers.get('retry-after'), null, 'waiting would not help, so no Retry-After');

// 5. Images are counted apart from text.
env = { ...base, AI_BUDGET: sqliteD1(), AI_IMAGES_PER_DAY: '1' };
assert.equal((await onRequestGet({ request: new Request('https://artbitrage.test/api/ai/image'), env })).headers.get('x-artbitrage-ai-budget'), 'ok; image 1/1; d1');
assert.equal((await get('/api/ai/image', env)).res.status, 429);
assert.equal((await get('/api/ai/generate', env)).res.status, 200);

// 6. Parallel requests cannot overspend: exactly the cap is allowed.
env = { ...base, AI_BUDGET: sqliteD1(), AI_TEXT_UNITS_PER_DAY: '7' };
const statuses = (await Promise.all(Array.from({ length: 20 }, () => get('/api/ai/generate', env)))).map(r => r.res.status);
assert.equal(statuses.filter(s => s === 200).length, 7);
assert.equal(statuses.filter(s => s === 429).length, 13);

// 7. /api/ai/budget reports the day's spend from the same count.
out = await get('/api/ai/budget', env);
assert.deepEqual([out.json.enforcement, out.json.used.text, out.json.remaining.text, out.json.caps.text_units_per_day], ['d1', 7, 0, 7]);
assert.match(out.json.note, /every Cloudflare location/);

// 8. Without D1 the isolate counts for itself, and says so.
out = await get('/api/ai/generate', { ...base });
assert.match(out.budget, /^ok; text \d+\/1000; per-isolate$/);
assert.match((await get('/api/ai/budget', { ...base })).json.note, /this edge isolate only/);

// 9. When D1 fails, the guard falls back to counting per isolate instead of failing open or closed.
const broken = { prepare: () => ({ bind() { return this; }, async run() { throw new Error('D1 down'); }, async first() { throw new Error('D1 down'); }, async all() { throw new Error('D1 down'); } }) };
const consoleError = console.error;
console.error = () => {};
out = await get('/api/ai/generate', { ...base, AI_BUDGET: broken });
console.error = consoleError;
assert.equal(out.res.status, 200);
assert.match(out.budget, /per-isolate \(D1 unavailable\)$/);

// 10. The per-isolate burst limit caps runs per minute, whatever the daily count.
env = { ...base, AI_BUDGET: sqliteD1(), AI_RUNS_PER_MINUTE: '0' };
out = await get('/api/ai/generate', env);
assert.equal(out.res.status, 429);
assert.equal(out.json.budget.reason, 'minute');
assert.ok(Number(out.res.headers.get('retry-after')) <= 60);

// 11. The burst limit holds under concurrency: the minute slot is taken before D1 answers.
// A fresh minute, so the isolate's burst count starts at zero.
const realNow = Date.now;
const later = realNow() + 3 * 60 * 1000;
Date.now = () => later;
env = { ...base, AI_BUDGET: sqliteD1(), AI_RUNS_PER_MINUTE: '3' };
const burst = (await Promise.all(Array.from({ length: 10 }, () => get('/api/ai/generate', env)))).map(r => r.res.status);
Date.now = realNow;
assert.equal(burst.filter(s => s === 200).length, 3, `exactly 3 of 10 parallel runs pass a burst limit of 3 (got ${burst.filter(s => s === 200).length})`);

// 12. Routes that never call Workers AI carry no budget header.
assert.equal((await get('/api/ai/models', env)).budget, null);

console.log('AI budget e2e passed: weights, exact D1 count, refusal before Workers AI, fallbacks, large models, images apart, no overspend in parallel, status route, per-isolate and D1-failure modes, burst limit');
