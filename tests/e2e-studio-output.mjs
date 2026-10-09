// Generated content and provider errors are data, never executable page markup.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../studio.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = new Map();
const rawOutputWrites = [];
class Element {
  constructor(tag = 'div', id = '') {
    this.tag = tag;
    this.id = id;
    this.children = [];
    this.attributes = {};
    this.value = '';
    this.classList = { remove() {} };
  }
  set textContent(value) { this.text = String(value); this.markup = ''; this.children = []; }
  get textContent() { return this.text; }
  set innerHTML(value) {
    if (this.id === 'output') rawOutputWrites.push(value);
    this.markup = value;
    this.text = '';
    this.children = [];
  }
  get innerHTML() { return this.markup; }
  setAttribute(name, value) { this.attributes[name] = value; }
  appendChild(child) { this.children.push(child); }
  querySelectorAll() { return []; }
  addEventListener() {}
}
function element(id) {
  if (!elements.has(id)) elements.set(id, new Element('div', id));
  return elements.get(id);
}

const payload = '<img src=x onerror="globalThis.compromised=true">';
let response;
const revoked = [];
const sandbox = {
  document: { getElementById: element, createElement: tag => new Element(tag) },
  URL: { createObjectURL: () => 'blob:generated-image', revokeObjectURL: url => revoked.push(url) },
  fetch: async url => url === '/api/ai/models'
    ? Response.json({ models: { text: { text: 'text-model' }, image: { image: 'image-model' }, embeddings: { embed: 'embed-model' }, vision: { vision: 'vision-model' } } })
    : response(),
};
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { timeout: 1000 });
await new Promise(resolve => setImmediate(resolve));
assert.match(element('model-grid').innerHTML, /<button type="button"[^>]+data-name="text"/);
assert.match(element('model-grid').innerHTML, /<button type="button" disabled[^>]+data-name="vision"/);

async function run(type, reply) {
  response = reply;
  element('prompt').value = payload;
  element('type-select').value = type;
  element('model-select').value = payload;
  await sandbox.runModel();
  assert.equal(element('run-btn').disabled, false);
  assert.equal(element('output').attributes['aria-busy'], 'false');
  assert.equal(sandbox.compromised, undefined);
}

await run('text', () => Response.json({ response: payload, model_key: payload }));
assert.equal(element('output').textContent, payload);
assert.ok(element('meta').textContent.includes(payload));

await run('image', () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }));
const image = element('output').children[0];
assert.equal(image.tag, 'img');
assert.equal(image.alt, 'AI generated: ' + payload);
assert.equal(image.src, 'blob:generated-image');

await run('image', () => Response.json({ error: payload }, { status: 503 }));
assert.equal(element('output').textContent, payload);
assert.deepEqual(revoked, ['blob:generated-image']);

await run('embed', () => Response.json({ error: payload }, { status: 503 }));
assert.equal(element('output').textContent, 'Could not generate just now. ' + payload);

await run('text', () => { throw new Error(payload); });
assert.equal(element('output').textContent, 'Could not generate just now. ' + payload);
assert.deepEqual(rawOutputWrites, [], 'Untrusted output must never enter an HTML parser');
console.log('artbitrage studio output e2e passed (text, images, provider errors, resource cleanup, API-only model state)');
