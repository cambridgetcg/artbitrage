import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import { onRequestGet } from '../functions/api/[[route]].js';

const root = new URL('../', import.meta.url).pathname;
const originalFetch = globalThis.fetch;

const env = {
  ASSETS: {
    async fetch(url) {
      const path = new URL(url).pathname.replace(/^\//, '') || 'index.html';
      try {
        const text = await readFile(join(root, path), 'utf8');
        return new Response(text, { status: 200, headers: { 'Content-Type': path.endsWith('.json') ? 'application/json' : 'text/plain' } });
      } catch {
        return new Response('not found', { status: 404 });
      }
    },
  },
  AI: { async run() { return { response: 'ok' }; } },
};

async function get(path) {
  const res = await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env });
  let body;
  const ct = res.headers.get('Content-Type') || '';
  if (ct.includes('json')) body = await res.json();
  else body = await res.arrayBuffer();
  return { res, body };
}

try {
  let out = await get('/api/catalog');
  assert.equal(out.res.status, 200);
  assert.equal(out.body.name, 'ARTBITRAGE Catalog');
  assert.ok(out.body.artworks.length >= 1);
  assert.ok(out.body.artworks.every(a => a.title && a.url && a.license));

  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('text-response')) {
      return new Response('not an image', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
  };

  out = await get('/api/img?url=' + encodeURIComponent('https://www.artic.edu/iiif/2/example/full/200,/0/default.jpg'));
  assert.equal(out.res.status, 200);
  assert.equal(out.res.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(out.res.headers.get('X-Artbitrage-Image-Host'), 'www.artic.edu');

  out = await get('/api/img?url=' + encodeURIComponent('http://www.artic.edu/iiif/2/example.jpg'));
  assert.equal(out.res.status, 403);
  assert.equal(out.body.error, 'https required');

  out = await get('/api/img?url=' + encodeURIComponent('https://evil.example/?next=artic.edu'));
  assert.equal(out.res.status, 403);
  assert.equal(out.body.error, 'domain not allowed');
  assert.equal(out.body.host, 'evil.example');

  out = await get('/api/img?url=' + encodeURIComponent('https://notartic.edu/image.jpg'));
  assert.equal(out.res.status, 403);
  assert.equal(out.body.error, 'domain not allowed');

  out = await get('/api/img?url=' + encodeURIComponent('https://www.artic.edu/text-response'));
  assert.equal(out.res.status, 415);
  assert.equal(out.body.error, 'not an image');

  // Catalog page must escape data before innerHTML insertion.
  const html = await readFile(join(root, 'catalog.html'), 'utf8');
  const script = html.split('<script>', 2)[1].split('</script>', 1)[0];
  const rendered = [];
  const elements = new Map();
  function el(id) {
    if (!elements.has(id)) elements.set(id, { id, textContent: '', innerHTML: '', appendChild() {} });
    return elements.get(id);
  }
  const sandbox = {
    window: { location: { origin: 'https://artbitrage.test' } },
    URL,
    document: { getElementById: el },
    setTimeout,
    fetch: async () => Response.json({
      artworks: [{
        title: '<img src=x onerror=alert(1)>',
        artist: '<b>Artist</b>',
        date: '2026',
        medium: '<script>bad</script>',
        source: '<bad>',
        query: '<love>',
        image: 'https://www.artic.edu/img.jpg',
        lqip: 'data:image/gif;base64,AAAA',
        alt_text: '<alt bad>',
        url: 'javascript:alert(1)',
        license: 'CC0',
      }],
      sources: ['x'],
    }),
  };
  await vm.runInNewContext(`(async()=>{ ${script} await new Promise(r=>setTimeout(r,0)); })()`, sandbox, { timeout: 1000 });
  const grid = el('grid').innerHTML;
  assert.ok(grid.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(grid.includes('&lt;b&gt;Artist&lt;/b&gt;'));
  assert.ok(!grid.includes('<img src=x onerror=alert(1)>'));
  assert.ok(!grid.includes('<script>bad</script>'));
  assert.ok(grid.includes('src="data:image/gif;base64,AAAA"'), 'LQIP data URL should render directly');
  assert.ok(grid.includes('alt="&lt;alt bad&gt;"'), 'alt text should be escaped');
  assert.ok(!grid.includes('javascript:alert(1)'), 'javascript: source link must be stripped');

  console.log('artbitrage catalog e2e passed');
} finally {
  globalThis.fetch = originalFetch;
}
