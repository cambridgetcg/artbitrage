// E2E: the FUN/ANIME joy proxy module must tell the truth —
// every endpoint must (1) resolve (no advertised-but-missing routes),
// (2) flag live vs fallback honestly, and (3) never throw when upstream fails.
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/[[route]].js';

const env = {
  ASSETS: { async fetch() { return new Response('[]', { headers: { 'Content-Type': 'application/json' } }); } },
  AI: { async run() { return { response: 'joy' }; } },
};
const originalFetch = globalThis.fetch;

async function get(path) {
  const res = await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env });
  return { res, json: await res.json() };
}

// Upstream payloads keyed by host fragment
function liveMock() {
  globalThis.fetch = async (input) => {
    const u = String(input);
    if (u.includes('official-joke-api')) return Response.json({ setup: 'S', punchline: 'P' });
    if (u.includes('icanhazdadjoke')) return Response.json({ joke: 'dad' });
    if (u.includes('catfact')) return Response.json({ fact: 'cats' });
    if (u.includes('uselessfacts')) return Response.json({ text: 'fact' });
    if (u.includes('opentdb')) return Response.json({ results: [{ category: 'C', question: 'Q', answer: 'A', correct_answer: 'A' }] });
    if (u.includes('pokeapi')) return Response.json({ name: 'pikachu', id: 25, types: [{ type: { name: 'electric' } }], sprites: { front_default: 'x' } });
    if (u.includes('yesno')) return Response.json({ answer: 'yes', image: 'g' });
    if (u.includes('adviceslip')) return Response.json({ slip: { id: 1, advice: 'be kind' } });
    if (u.includes('zenquotes')) return Response.json([{ q: 'love', a: 'yu' }]);
    if (u.includes('jikan.moe/v4/top')) return Response.json({ data: [{ title: 'Frieren', score: 9.3, episodes: 28, synopsis: 'x' }] });
    if (u.includes('jikan.moe/v4/anime')) return Response.json({ data: [{ title: 'A', score: 8, episodes: 12 }] });
    if (u.includes('jikan.moe/v4/seasons')) return Response.json({ data: [{ title: 'S', episodes: 12, score: 8 }] });
    if (u.includes('animechan')) return Response.json({ data: { content: 'C', character: { name: 'Itachi' }, anime: { name: 'Naruto' } } });
    if (u.includes('ghibliapi') && u.includes('films')) return Response.json([{ title: 'Spirited Away', release_date: '2001', rt_score: '97', description: 'x' }]);
    if (u.includes('ghibliapi') && u.includes('locations')) return Response.json([{ name: 'L', climate: 'c', terrain: 't' }]);
    throw new Error('unexpected ' + u);
  };
}

function deadMock() {
  globalThis.fetch = async () => new Response('upstream boom', { status: 503 });
}

const liveEndpoints = [
  ['/api/fun/joke', 'setup'],
  ['/api/fun/dad', 'joke'],
  ['/api/fun/cat', 'fact'],
  ['/api/fun/useless', 'fact'],
  ['/api/fun/trivia', 'question'],
  ['/api/fun/pokemon', 'name'],
  ['/api/fun/yesno', 'answer'],
  ['/api/fun/advice', 'advice'],
  ['/api/fun/quote', 'quote'],
  ['/api/anime/top', 'anime'],
  ['/api/anime/search?q=love', 'anime'],
  ['/api/anime/quote', 'quote'],
  ['/api/anime/season', 'anime'],
  ['/api/ghibli/films', 'films'],
  ['/api/ghibli/locations', 'locations'],
  ['/api/games/trivia', 'question'],
];

try {
  // 1. Live path: every endpoint resolves with live:true and expected field.
  liveMock();
  for (const [path, field] of liveEndpoints) {
    const { res, json } = await get(path);
    assert.equal(res.status, 200, `${path} status`);
    assert.equal(json.live, true, `${path} should be live`);
    assert.ok(field in json, `${path} missing field ${field}`);
    assert.ok(!('fallback' in json), `${path} should not be fallback when live`);
  }

  // 2. Dead upstream: every endpoint still resolves gracefully with fallback flags.
  deadMock();
  for (const [path, field] of liveEndpoints) {
    const { res, json } = await get(path);
    assert.equal(res.status, 200, `${path} fallback status`);
    assert.equal(json.live, false, `${path} should report not-live`);
    assert.equal(json.fallback, true, `${path} should report fallback`);
    assert.ok(field in json, `${path} fallback missing field ${field}`);
    assert.ok(json.error, `${path} fallback should carry error reason`);
  }

  // 3. The two previously advertised-but-missing endpoints are real (not 404 menu items).
  globalThis.fetch = originalFetch;
  const funIndex = (await get('/api/fun')).json;
  for (const adv of funIndex.games) {
    if (adv.includes('/api/fun/random')) continue;
    const p = adv.replace('GET ', '').trim();
    const { res } = await get(p);
    assert.equal(res.status, 200, `advertised ${p} must resolve, not 404`);
  }
  const animeIndex = (await get('/api/anime')).json;
  for (const p of animeIndex.endpoints) {
    if (p.includes('search?q=')) continue; // covered above
    const { res } = await get(p);
    assert.equal(res.status, 200, `advertised ${p} must resolve, not 404`);
  }

  console.log('artbitrage joy e2e passed (' + liveEndpoints.length + ' endpoints: live + graceful fallback + no missing routes)');
} finally {
  globalThis.fetch = originalFetch;
}
