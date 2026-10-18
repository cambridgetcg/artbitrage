// Play: jokes, facts, trivia and anime from free third-party APIs. They are
// guests on the request path, so every answer says whether it came from the
// live upstream (`live: true`) or a written fallback (`live: false,
// fallback: true`), and an upstream failure is never a failed request.
import { json } from '../../_kernel/http.js';
import { safeString } from '../../_kernel/params.js';
import { fetchJson } from '../../_kernel/upstream.js';

async function joyProxy(url, mapOk, fallback, options = {}) {
  try {
    const data = await fetchJson(url, { timeoutMs: 7000, ...options });
    return json({ ...mapOk(data), live: true, source: url });
  } catch (e) {
    return json({ ...fallback, live: false, fallback: true, error: e.message });
  }
}

const trivia = type => d => {
  const q = d.results[0];
  return { type, category: decodeURIComponent(q.category), question: decodeURIComponent(q.question), answer: decodeURIComponent(q.correct_answer) };
};

const FUN_GAMES = ['/api/fun/joke', '/api/fun/dad', '/api/fun/cat', '/api/fun/useless', '/api/fun/trivia', '/api/fun/pokemon', '/api/fun/yesno', '/api/fun/advice', '/api/fun/quote'];

export default [
  // ── FUN ZONE — jokes, facts, trivia, pokemon, fun! ──
  {
    id: 'play.fun', method: 'GET', path: '/api/fun',
    summary: 'All fun endpoints',
    handler: () => json({ games: [...FUN_GAMES, '/api/fun/random'].map(p => `GET ${p}`), message: 'FUN IS! PLAY IS! JOY IS!' }),
  },
  {
    id: 'play.joke', method: 'GET', path: '/api/fun/joke', summary: 'Random joke', upstream: ['official-joke-api.appspot.com'],
    handler: () => joyProxy('https://official-joke-api.appspot.com/random_joke',
      d => ({ type: 'joke', setup: d.setup, punchline: d.punchline }),
      { type: 'joke', setup: 'Why did love cross the road?', punchline: 'To reach the other side of understanding.' }),
  },
  {
    id: 'play.dad', method: 'GET', path: '/api/fun/dad', summary: 'Dad joke', upstream: ['icanhazdadjoke.com'],
    handler: () => joyProxy('https://icanhazdadjoke.com/',
      d => ({ type: 'dad_joke', joke: d.joke }),
      { type: 'dad_joke', joke: "I'm reading a book on anti-gravity. It's impossible to put down!" }),
  },
  {
    id: 'play.cat', method: 'GET', path: '/api/fun/cat', summary: 'Cat fact', upstream: ['catfact.ninja'],
    handler: () => joyProxy('https://catfact.ninja/fact',
      d => ({ type: 'cat_fact', fact: d.fact }),
      { type: 'cat_fact', fact: 'Cats are love.' }),
  },
  {
    id: 'play.useless', method: 'GET', path: '/api/fun/useless', summary: 'Useless fact', upstream: ['uselessfacts.jsph.pl'],
    handler: () => joyProxy('https://uselessfacts.jsph.pl/api/v2/facts/random',
      d => ({ type: 'useless_fact', fact: d.text }),
      { type: 'useless_fact', fact: 'Love is never useless.' }),
  },
  {
    id: 'play.trivia', method: 'GET', path: '/api/fun/trivia', summary: 'Trivia question with its answer', upstream: ['opentdb.com'],
    handler: () => joyProxy('https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986',
      trivia('trivia'),
      { type: 'trivia', question: 'What is love?', answer: 'Love is.' }),
  },
  {
    id: 'play.pokemon', method: 'GET', path: '/api/fun/pokemon', summary: 'Random Pokemon', upstream: ['pokeapi.co'],
    handler: () => {
      const id = Math.floor(Math.random() * 1025) + 1;
      return joyProxy(`https://pokeapi.co/api/v2/pokemon/${id}`,
        d => ({ type: 'pokemon', name: d.name, id: d.id, types: d.types.map(t => t.type.name), image: d.sprites?.front_default || '' }),
        { type: 'pokemon', name: 'pikachu', id: 25, types: ['electric'] });
    },
  },
  {
    id: 'play.yesno', method: 'GET', path: '/api/fun/yesno', summary: 'Yes or No (with GIF)', upstream: ['yesno.wtf'],
    handler: () => joyProxy('https://yesno.wtf/api',
      d => ({ type: 'yesno', answer: String(d.answer || '').toUpperCase(), gif: d.image }),
      { type: 'yesno', answer: 'YES' }),
  },
  {
    id: 'play.advice', method: 'GET', path: '/api/fun/advice', summary: 'A slip of advice', upstream: ['api.adviceslip.com'],
    handler: () => joyProxy('https://api.adviceslip.com/advice',
      d => ({ type: 'advice', advice: d.slip?.advice || '', id: d.slip?.id }),
      { type: 'advice', advice: 'Choose love when you could choose otherwise.' }),
  },
  {
    id: 'play.quote', method: 'GET', path: '/api/fun/quote', summary: 'Inspirational quote', upstream: ['zenquotes.io'],
    handler: () => joyProxy('https://zenquotes.io/api/random',
      d => ({ type: 'quote', quote: d[0].q, author: d[0].a }),
      { type: 'quote', quote: 'Love is.', author: 'yu' }),
  },
  {
    id: 'play.random', method: 'GET', path: '/api/fun/random', summary: 'Points at one fun endpoint, chosen at random',
    handler: () => json({ type: 'redirect', go_to: FUN_GAMES[Math.floor(Math.random() * FUN_GAMES.length)], message: 'Try that endpoint for a random fun thing!' }),
  },

  // ── ANIME & GAMES — wired from free APIs! ──
  {
    id: 'play.anime', method: 'GET', path: '/api/anime',
    summary: 'All anime endpoints',
    handler: () => json({ endpoints: ['/api/anime/top', '/api/anime/search?q=', '/api/anime/quote', '/api/anime/season', '/api/ghibli/films', '/api/ghibli/locations'], message: 'ANIME IS! GAMES IS! FUN IS!' }),
  },
  {
    id: 'play.anime-top', method: 'GET', path: '/api/anime/top', summary: 'Top anime (Jikan/MAL)', upstream: ['api.jikan.moe'],
    handler: () => joyProxy('https://api.jikan.moe/v4/top/anime?limit=5',
      d => ({ source: 'MyAnimeList', anime: (d.data || []).map(a => ({ title: a.title, score: a.score, episodes: a.episodes, synopsis: (a.synopsis || '').substring(0, 100) })) }),
      { source: 'MyAnimeList', anime: [{ title: "Frieren: Beyond Journey's End", score: 9.26 }] }),
  },
  {
    id: 'play.anime-search', method: 'GET', path: '/api/anime/search', summary: 'Search anime', params: 'q', upstream: ['api.jikan.moe'],
    handler: ({ query }) => {
      const q = safeString(query.q || 'love', 80) || 'love';
      return joyProxy(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=5`,
        d => ({ source: 'MyAnimeList', query: q, anime: (d.data || []).map(a => ({ title: a.title, score: a.score, episodes: a.episodes })) }),
        { source: 'MyAnimeList', query: q, anime: [] });
    },
  },
  {
    id: 'play.anime-quote', method: 'GET', path: '/api/anime/quote', summary: 'Random anime quote', upstream: ['api.animechan.io'],
    handler: () => joyProxy('https://api.animechan.io/v1/quotes/random',
      d => { const q = d.data || d; return { type: 'anime_quote', quote: q.content || q.quote || '', character: q.character?.name || q.character || '', anime: q.anime?.name || q.anime || '' }; },
      { type: 'anime_quote', quote: "People's lives don't end when they die. It ends when they lose faith.", character: 'Itachi Uchiha', anime: 'Naruto' }),
  },
  {
    id: 'play.anime-season', method: 'GET', path: '/api/anime/season', summary: 'Current season anime', upstream: ['api.jikan.moe'],
    handler: () => joyProxy('https://api.jikan.moe/v4/seasons/now?limit=5',
      d => ({ source: 'MyAnimeList', season: 'current', anime: (d.data || []).map(a => ({ title: a.title, episodes: a.episodes, score: a.score })) }),
      { source: 'MyAnimeList', season: 'current', anime: [] }),
  },
  {
    id: 'play.ghibli-films', method: 'GET', path: '/api/ghibli/films', summary: 'Studio Ghibli films', upstream: ['ghibliapi.vercel.app'],
    handler: () => joyProxy('https://ghibliapi.vercel.app/films',
      d => ({ source: 'Studio Ghibli', films: (d || []).map(f => ({ title: f.title, year: f.release_date, score: f.rt_score, description: (f.description || '').substring(0, 120) })) }),
      { source: 'Studio Ghibli', films: [{ title: 'Spirited Away', year: '2001', score: '97' }] }),
  },
  {
    id: 'play.ghibli-locations', method: 'GET', path: '/api/ghibli/locations', summary: 'Ghibli locations', upstream: ['ghibliapi.vercel.app'],
    handler: () => joyProxy('https://ghibliapi.vercel.app/locations',
      d => ({ source: 'Studio Ghibli', locations: (d || []).map(l => ({ name: l.name, climate: l.climate, terrain: l.terrain })) }),
      { source: 'Studio Ghibli', locations: [] }),
  },
  {
    id: 'play.games-trivia', method: 'GET', path: '/api/games/trivia', summary: 'Anime trivia question with its answer', upstream: ['opentdb.com'],
    handler: () => joyProxy('https://opentdb.com/api.php?amount=1&category=31&type=multiple&encode=url3986',
      trivia('anime_trivia'),
      { type: 'anime_trivia', question: 'What is love?', answer: 'Love is.' }),
  },
];
