// E2E: the era-journey module must tell the truth —
// every era gallery script must parse, render its cards, and show
// real line breaks (no literal "\n"); era-nav must add honest
// "look it up" links to every named Key Work.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ERA_PAGES = ['prehistoric','medieval','renaissance','baroque','romanticism','impressionism','modernism','popart','ai','wine','cigar'];

function lastScript(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  return scripts[scripts.length - 1];
}

function renderStaticGallery(code) {
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

async function renderAiGallery(code, data, { reducedMotion = true } = {}) {
  const elements = new Map();
  const requests = [];

  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.attributes = {};
      this.listeners = {};
      this.style = {};
      this._text = '';
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    remove() {
      this.removed = true;
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }

    addEventListener(name, listener) {
      this.listeners[name] = listener;
    }

    scrollIntoView() {}
    reset() {}

    getContext() {
      return null;
    }

    set textContent(value) {
      this._text = String(value);
    }

    get textContent() {
      return [this._text, ...this.children.map(child => child.textContent)]
        .filter(Boolean)
        .join('\n');
    }
  }

  const elementForId = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const sandbox = {
    document: {
      getElementById: elementForId,
      createElement: tag => new Element(tag),
      createTextNode: text => {
        const node = new Element('#text');
        node.textContent = text;
        return node;
      },
    },
    window: {
      matchMedia: () => ({ matches: reducedMotion }),
    },
    location: { hash: '' },
    requestAnimationFrame() {},
    setTimeout() {},
    async fetch(url) {
      requests.push(String(url));
      if (url !== '/data/ai.json') throw new Error(`unexpected fetch: ${url}`);
      return {
        ok: true,
        async json() {
          return data;
        },
      };
    },
  };

  vm.runInNewContext(code, sandbox, { timeout: 1000 });
  await new Promise(resolve => setImmediate(resolve));

  const cards = elementForId('panes').children;
  return {
    bodies: cards.map(child => child.textContent),
    cards,
    requests,
  };
}

const AI_DATA = JSON.parse(
  readFileSync(new URL('../data/ai.json', import.meta.url), 'utf8'),
);

let failures = 0;
for (const name of ERA_PAGES) {
  const html = readFileSync(new URL(`../${name}.html`, import.meta.url), 'utf8');
  try {
    let bodies;
    if (name === 'ai') {
      const rendered = await renderAiGallery(lastScript(html), AI_DATA);
      bodies = rendered.bodies;
      assert.ok(AI_DATA.works.length > 0, 'ai: real data should contain works');
      assert.deepEqual(rendered.requests, ['/data/ai.json']);
      assert.equal(
        bodies.length,
        AI_DATA.works.length,
        'ai: every data work should render once',
      );
      for (const [index, work] of AI_DATA.works.entries()) {
        const card = rendered.cards[index];
        const body = bodies[index];
        assert.equal(card.id, work.slug, `ai: wrong work order at ${work.slug}`);
        assert.equal(card.className, 'work');
        for (const text of [
          work.title,
          work.maker,
          work.floors.happened.text,
          work.floors.feel.text,
          work.floors.leaves.text,
        ]) {
          assert.ok(body.includes(text), `ai: ${work.slug} lost rendered text`);
        }
      }

      const noCanvas = await renderAiGallery(
        lastScript(html),
        AI_DATA,
        { reducedMotion: false },
      );
      assert.equal(
        noCanvas.cards.length,
        AI_DATA.works.length,
        'ai: unavailable canvas context must not block the gallery',
      );
    } else {
      bodies = renderStaticGallery(lastScript(html));
    }
    assert.ok(bodies.length >= 1, `${name}: gallery rendered no cards`);
    const joined = bodies.join('\n');
    assert.ok(!/\\n/.test(joined), `${name}: literal backslash-n leaked into output`);
    if (name !== 'ai') {
      assert.ok(joined.includes('\n'), `${name}: no real newlines rendered`);
    }
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
