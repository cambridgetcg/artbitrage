import assert from 'node:assert/strict';
import { aiCatalog, modelCount, resolveAiModel } from '../functions/api/ai-catalog.js';
import { onRequestGet as catchallGet } from '../functions/api/[[route]].js';
import { onRequestGet as aiGet } from '../functions/api/ai.js';

const env = {
  ASSETS: { async fetch() { return new Response('[]', { headers: { 'Content-Type': 'application/json' } }); } },
  AI: {
    async run(model, input) {
      if (input?.text) return { data: [[1, 2, 3]] };
      if (input?.prompt) return { image: new Uint8Array([1, 2, 3]) };
      return { response: `ok:${model}` };
    },
  },
};

async function jsonFrom(handler, path) {
  const res = await handler({ request: new Request(`https://artbitrage.test${path}`), env });
  assert.equal(res.status, 200);
  return res.json();
}

const catalog = aiCatalog();
assert.equal(catalog.schema, 'artbitrage.ai-catalog/1');
assert.equal(catalog.total_models, modelCount());
assert.equal(catalog.total_models, 24);
assert.deepEqual(resolveAiModel('text', 'bad-key'), {
  category: 'text',
  requested_model: 'bad-key',
  model_key: 'llama3',
  model: catalog.models.text.llama3,
  valid_requested_model: false,
  fallback_used: true,
  available_model_keys: Object.keys(catalog.models.text),
});

const fromCatchall = await jsonFrom(catchallGet, '/api/ai/models');
const fromAi = await jsonFrom(aiGet, '/api/ai/models');
assert.deepEqual(fromCatchall.models, fromAi.models);
assert.deepEqual(fromCatchall.defaults, fromAi.defaults);
assert.equal(fromCatchall.total_models, fromAi.total_models);

let generated = await jsonFrom(catchallGet, '/api/ai/generate?prompt=hi&model=bad-key');
assert.equal(generated.fallback_used, true);
assert.equal(generated.model_key, 'llama3');
assert.match(generated.response, /^ok:/);

generated = await jsonFrom(aiGet, '/api/ai/generate?prompt=hi&model=bad-key');
assert.equal(generated.fallback_used, true);
assert.equal(generated.model_key, 'llama3');
assert.match(generated.response, /^ok:/);

console.log('artbitrage AI catalog e2e passed');
