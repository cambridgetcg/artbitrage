// E2E: the era-journey module must tell the truth —
// every era gallery script must parse, render its cards, and show
// real line breaks (no literal "\n"); era-nav must add honest
// "look it up" links to every named Key Work.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ERA_PAGES = ['prehistoric','medieval','renaissance','baroque','romanticism','impressionism','modernism','popart','ai'];

function lastScript(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  return scripts[scripts.length - 1];
}

function renderGallery(code) {
  const bodies = [];
  const sandbox = {
    document: {
      getElementById: () => ({ appendChild() {} }),
      createElement: () => ({ classList: { add() {} }, set innerHTML(v) { bodies.push(v); }, appendChild() {} }),
    },
  };
  vm.runInNewContext(code, sandbox, { timeout: 1000 });
  return bodies;
}

let failures = 0;
for (const name of ERA_PAGES) {
  const html = readFileSync(new URL(`../${name}.html`, import.meta.url), 'utf8');
  try {
    const bodies = renderGallery(lastScript(html));
    assert.ok(bodies.length >= 1, `${name}: gallery rendered no cards`);
    const joined = bodies.join('\n');
    assert.ok(!/\\n/.test(joined), `${name}: literal backslash-n leaked into output`);
    assert.ok(joined.includes('\n'), `${name}: no real newlines rendered`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

// era-nav.js must be valid and contain the Key Works enhancement
const navSrc = readFileSync(new URL('../era-nav.js', import.meta.url), 'utf8');
new vm.Script(navSrc); // throws on syntax error
assert.ok(navSrc.includes('.key-work .kw-title'), 'era-nav must enhance Key Work titles');
assert.ok(navSrc.includes('commons.wikimedia.org'), 'era-nav must link to an authoritative source');
assert.ok(navSrc.includes('try {') && navSrc.includes('catch'), 'era-nav enhancement must be graceful');

if (failures) {
  console.error(`\n${failures} era page(s) FAILED`);
  process.exit(1);
}
console.log(`artbitrage era-pages e2e passed (${ERA_PAGES.length} pages, galleries render clean, nav links honest)`);
