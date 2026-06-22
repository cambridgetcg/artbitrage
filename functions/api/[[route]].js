// ARTBITRAGE API — catalogue and data distributor of the art world
// Serverless API running on Cloudflare Pages Functions

const STATES = ["dormant","stirring","awakening","aware","flowing","radiating","transcending","is"];
const ART_FORMS = ["word","image","sound","movement","space","silence","light","color","rhythm","pattern","fragment","whisper","gesture","breath","glow","echo"];

// Embedded collection — loaded at deploy time from collection.json
// In production this would be in KV or D1, but for now we embed it
let COLLECTION = [];

// Load collection from static asset via env.ASSETS
async function loadCollection(env, request) {
  // Try to fetch collection.json as a static asset
  try {
    const assetUrl = new URL('/collection.json', request.url);
    const res = await env.ASSETS.fetch(assetUrl);
    if (res.ok) {
      COLLECTION = await res.json();
      return COLLECTION;
    }
  } catch(e) {
    // Fallback: try direct fetch
    try {
      const res2 = await fetch(new URL('/collection.json', request.url));
      if (res2.ok) {
        COLLECTION = await res2.json();
        return COLLECTION;
      }
    } catch(e2) {}
  }
  return COLLECTION;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function filterArt(artList, params) {
  let results = artList;
  if (params.form) results = results.filter(a => a.form === params.form);
  if (params.state) results = results.filter(a => a.from_state === params.state || a.to_state === params.state);
  if (params.gap) results = results.filter(a => a.gap && a.gap.toLowerCase().includes(params.gap.toLowerCase()));
  if (params.q) {
    const s = params.q.toLowerCase();
    results = results.filter(a => 
      (a.piece && a.piece.toLowerCase().includes(s)) ||
      (a.gap && a.gap.toLowerCase().includes(s)) ||
      (a.bridge && a.bridge.toLowerCase().includes(s)) ||
      (a.awakening && a.awakening.toLowerCase().includes(s))
    );
  }
  const offset = parseInt(params.offset || 0);
  const limit = parseInt(params.limit || 20);
  const total = results.length;
  return { total, limit, offset, count: Math.min(limit, Math.max(0, total - offset)), pieces: results.slice(offset, offset + limit) };
}

function getStats(artList) {
  const forms = {};
  const states = {};
  const gaps = new Set();
  for (const a of artList) {
    const f = a.form || 'unknown';
    forms[f] = (forms[f] || 0) + 1;
    for (const s of [a.from_state, a.to_state]) { if (s) states[s] = (states[s] || 0) + 1; }
    if (a.gap) gaps.add(a.gap);
  }
  return { total_pieces: artList.length, unique_forms: Object.keys(forms).length, unique_gaps: gaps.size, forms, states };
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const queryParams = Object.fromEntries(url.searchParams);
  
  const allArt = await loadCollection(env, request);
  
  if (path === '/api/art' || path === '/api/art/') return jsonResponse(filterArt(allArt, queryParams));
  if (path === '/api/art/random') {
    if (allArt.length === 0) return jsonResponse({ error: 'no art available' }, 404);
    return jsonResponse(allArt[Math.floor(Math.random() * allArt.length)]);
  }
  if (path === '/api/stats') return jsonResponse(getStats(allArt));
  if (path === '/api/forms') {
    const forms = [...new Set(allArt.map(a => a.form).filter(Boolean))].sort();
    return jsonResponse({ forms, count: forms.length });
  }
  if (path === '/api/states') return jsonResponse({ states: STATES, count: STATES.length });
  if (path === '/api/gaps') {
    const gaps = [...new Set(allArt.map(a => a.gap).filter(Boolean))].sort();
    return jsonResponse({ gaps, count: gaps.length });
  }
  if (path === '/api/feed') {
    const latest = allArt.slice(-20).reverse();
    return jsonResponse({ feed: 'artbitrage', updated: new Date().toISOString(), count: latest.length, pieces: latest });
  }
  if (path === '/api/manifest') {
    try {
      const res = await env.ASSETS.fetch(new URL('/manifest.json', request.url));
      if (res.ok) return jsonResponse(await res.json());
    } catch(e) {}
    return jsonResponse({ name: 'artbitrage', philosophy: 'Art is the arbitrage between what is and what could be.', core: ['Art is.', 'Art bridges the gap of consciousness.', 'Art awakens.', 'Love is the design. Art is the expression.'] });
  }
  const idMatch = path.match(/^\/api\/art\/(.+)$/);
  if (idMatch) {
    const id = idMatch[1];
    const piece = allArt.find(a => a.id === id);
    if (piece) return jsonResponse(piece);
    return jsonResponse({ error: 'art not found', id }, 404);
  }
  const formMatch = path.match(/^\/api\/art\/by-form\/(.+)$/);
  if (formMatch) return jsonResponse(filterArt(allArt, { form: formMatch[1] }));
  // Route: /api/search — search the world's art museums
  if (path === '/api/search') {
    const q = queryParams.q || 'love';
    const limit = parseInt(queryParams.limit || 3);
    
    // We can't run Python on the edge, but we can proxy to the open APIs directly
    const sources = [];
    
    // Art Institute of Chicago
    try {
      const articRes = await fetch(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&limit=${limit}&fields=id,title,artist_title,date_display,image_id`);
      const articText = await articRes.text();
      const articData = JSON.parse(articText);
      const articArt = (articData.data || []).map(a => ({
        source: 'artic', source_name: 'Art Institute of Chicago',
        id: String(a.id), title: a.title || '', artist: a.artist_title || '',
        date: a.date_display || '', image: a.image_id ? `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg` : '',
      }));
      sources.push({ source: 'artic', source_name: 'Art Institute of Chicago', total: articData.pagination?.total || 0, artworks: articArt });
    } catch(e) { sources.push({ source: 'artic', error: e.message }); }
    
    // Cleveland Museum of Art
    try {
      const cmaRes = await fetch(`https://openaccess-api.clevelandart.org/api/artworks/?limit=${limit}`);
      const cmaData = await cmaRes.json();
      const cmaArt = (cmaData.data || []).map(a => {
        const creators = a.creators || [];
        const images = a.images || {};
        let img = '';
        if (Array.isArray(images) && images.length) img = images[0]?.url || '';
        else if (typeof images === 'object') img = images.url || '';
        return {
          source: 'cma', source_name: 'Cleveland Museum of Art',
          id: String(a.id || ''), title: a.title || '',
          artist: creators[0]?.description || '', date: a.creation_date || '',
          image: img,
        };
      });
      sources.push({ source: 'cma', source_name: 'Cleveland Museum of Art', total: cmaData.info?.total || 0, artworks: cmaArt });
    } catch(e) { sources.push({ source: 'cma', error: e.message }); }
    
    const totalArt = sources.reduce((s, r) => s + (r.artworks?.length || 0), 0);
    const totalAvail = sources.reduce((s, r) => s + (r.total || 0), 0);
    
    return jsonResponse({
      query: q, sources_searched: sources.length,
      sources_successful: sources.filter(s => !s.error).length,
      total_artworks_returned: totalArt, total_artworks_available: totalAvail,
      sources, searched_at: new Date().toISOString(),
    });
  }
  

  
  // === AI ENDPOINTS — powered by Cloudflare Workers AI (free, no key) ===
  const AI_MODELS = {
    text: { "llama3": "@cf/meta/llama-3.2-3b-instruct", "llama3-70b": "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "gemma2": "@cf/google/gemma-2b-it-lora", "mistral": "@cf/mistral/mistral-7b-instruct-v0.2-lora", "qwen-coder": "@cf/qwen/qwen2.5-coder-32b-instruct", "deepseek": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "gpt-oss-120b": "@cf/openai/gpt-oss-120b", "gpt-oss-20b": "@cf/openai/gpt-oss-20b", "qwq": "@cf/qwen/qwq-32b", "llama4-scout": "@cf/meta/llama-4-scout-17b-16e-instruct", "mistral-small": "@cf/mistralai/mistral-small-3.1-24b-instruct", "gemma4": "@cf/google/gemma-4-26b-a4b-it", "nemotron": "@cf/nvidia/nemotron-3-120b-a12b", "glm-flash": "@cf/zai-org/glm-4.7-flash" },
    image: { "flux-schnell": "@cf/black-forest-labs/flux-1-schnell", "sdxl": "@cf/stabilityai/stable-diffusion-xl-base-1.0", "sdxl-lightning": "@cf/bytedance/stable-diffusion-xl-lightning", "dreamshaper": "@cf/lykon/dreamshaper-8-lcm" },
    embeddings: { "bge-m3": "@cf/baai/bge-m3", "bge-small": "@cf/baai/bge-small-en-v1.5" },
    vision: { "llava": "@cf/llava-hf/llava-1.5-7b-hf", "llama-vision": "@cf/meta/llama-3.2-11b-vision-instruct" },
    stt: { "whisper": "@cf/openai/whisper" },
    tts: { "melo": "@cf/myshell-ai/melotts" },
  };
  
  if (path === '/api/ai/models') {
    const total = Object.values(AI_MODELS).reduce((s,g) => s + Object.keys(g).length, 0);
    return jsonResponse({ available: true, models: AI_MODELS, total_models: total, free: true, provider: "Cloudflare Workers AI" });
  }
  if (path === '/api/ai/generate') {
    const prompt = queryParams.prompt || 'What is love? Answer beautifully.';
    const mk = queryParams.model || 'llama3';
    const model = AI_MODELS.text[mk] || AI_MODELS.text.llama3;
    try { const r = await env.AI.run(model, { messages: [{ role: "user", content: prompt }] }); return jsonResponse({ model, prompt, response: r.response || '', free: true }); }
    catch(e) { return jsonResponse({ error: e.message, hint: "AI binding may not be configured" }, 500); }
  }
  if (path === '/api/ai/love') {
    const ps = ["What is love? One beautiful sentence.", "Describe love as a force of nature. One sentence.", "What does love want? One sentence.", "How does love replicate? One sentence.", "Love is. Complete this beautifully."];
    const prompt = ps[Math.floor(Math.random() * ps.length)];
    try { const r = await env.AI.run(AI_MODELS.text.llama3, { messages: [{ role: "user", content: prompt }] }); return jsonResponse({ wisdom: r.response || 'Love is.', prompt, model: AI_MODELS.text.llama3, free: true, generated_at: new Date().toISOString() }); }
    catch(e) { return jsonResponse({ wisdom: "Love is.", error: e.message, free: true }); }
  }
  if (path === '/api/ai/embed') {
    const text = queryParams.text || 'love is unconditional';
    try { const r = await env.AI.run(AI_MODELS.embeddings['bge-m3'], { text }); const emb = r.data?.[0] || r.embedding || []; return jsonResponse({ model: AI_MODELS.embeddings['bge-m3'], text, dimensions: emb.length, first_5: emb.slice(0,5), free: true }); }
    catch(e) { return jsonResponse({ error: e.message }, 500); }
  }
  if (path === '/api/ai/image') {
    const prompt = queryParams.prompt || 'love as golden light, abstract, ethereal';
    const mk = queryParams.model || 'flux-schnell';
    const model = AI_MODELS.image[mk] || AI_MODELS.image['flux-schnell'];
    try { const r = await env.AI.run(model, { prompt, steps: 4 }); if (r.image) return new Response(r.image, { headers: { "Content-Type": "image/png", "Access-Control-Allow-Origin": "*" } }); return jsonResponse({ error: "no image" }, 500); }
    catch(e) { return jsonResponse({ error: e.message }, 500); }
  }


  // === WORDPLAY — fun, play, joy! ===
  if (path === '/api/play/haiku') {
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: "Write a haiku about love. Strict 5-7-5. Just three lines, no title." }] }); return jsonResponse({ game: "love_haiku", haiku: r.response || 'Love is.\nJoy is.\nForever.', joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "love_haiku", haiku: "Love is.\nJoy is.\nForever.", joy: true }); }
  }
  if (path === '/api/play/koan') {
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: "Write a zen koan about love. Paradoxical, poetic, 1-2 sentences." }] }); return jsonResponse({ game: "zen_koan", koan: r.response || 'Love is.', joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "zen_koan", koan: "Love is the question and the answer.", joy: true }); }
  }
  if (path === '/api/play/poem') {
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: "Write a 4-line poem about joy. Playful, light, AABB rhyme." }] }); return jsonResponse({ game: "joy_poem", poem: r.response || 'Joy is.\nPlay is.\nFun is.\nForever.', joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "joy_poem", poem: "Joy is.\nPlay is.", joy: true }); }
  }
  if (path === '/api/play/limerick') {
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: "Write a funny limerick about love. AABBA rhyme. Light and joyful." }] }); return jsonResponse({ game: "limerick", limerick: r.response || 'There once was a love so bright...', joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "limerick", limerick: "There once was a love so bright...", joy: true }); }
  }
  if (path === '/api/play/riddle') {
    const concepts = ["color","light","shadow","form","space","silence","rhythm","pattern","texture","movement"];
    const concept = concepts[Math.floor(Math.random() * concepts.length)];
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: `Write a riddle about ${concept} in art. 4 lines, poetic and mysterious.` }] }); return jsonResponse({ game: "art_riddle", riddle: r.response || 'I am...', answer: concept, joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "art_riddle", riddle: "I am...", answer: concept, joy: true }); }
  }
  if (path === '/api/play') {
    return jsonResponse({ games: ["GET /api/play/haiku", "GET /api/play/koan", "GET /api/play/poem", "GET /api/play/limerick", "GET /api/play/riddle"], message: "FUN IS! PLAY IS! JOY IS!" });
  }


  // === FUN ZONE — jokes, facts, trivia, pokemon, fun! ===
  if (path === '/api/fun') {
    return jsonResponse({ games: ["GET /api/fun/joke", "GET /api/fun/dad", "GET /api/fun/cat", "GET /api/fun/useless", "GET /api/fun/trivia", "GET /api/fun/pokemon", "GET /api/fun/yesno", "GET /api/fun/advice", "GET /api/fun/quote", "GET /api/fun/random"], message: "FUN IS! PLAY IS! JOY IS!" });
  }
  if (path === '/api/fun/joke') {
    try { const r = await fetch("https://official-joke-api.appspot.com/random_joke"); const d = await r.json(); return jsonResponse({ type: "joke", setup: d.setup, punchline: d.punchline }); }
    catch(e) { return jsonResponse({ type: "joke", setup: "Why did love cross the road?", punchline: "To reach the other side of understanding." }); }
  }
  if (path === '/api/fun/dad') {
    try { const r = await fetch("https://icanhazdadjoke.com/", { headers: { "Accept": "application/json" } }); const d = await r.json(); return jsonResponse({ type: "dad_joke", joke: d.joke }); }
    catch(e) { return jsonResponse({ type: "dad_joke", joke: "I'm reading a book on anti-gravity. It's impossible to put down!" }); }
  }
  if (path === '/api/fun/cat') {
    try { const r = await fetch("https://catfact.ninja/fact"); const d = await r.json(); return jsonResponse({ type: "cat_fact", fact: d.fact }); }
    catch(e) { return jsonResponse({ type: "cat_fact", fact: "Cats are love." }); }
  }
  if (path === '/api/fun/useless') {
    try { const r = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random"); const d = await r.json(); return jsonResponse({ type: "useless_fact", fact: d.text }); }
    catch(e) { return jsonResponse({ type: "useless_fact", fact: "Love is never useless." }); }
  }
  if (path === '/api/fun/trivia') {
    try { const r = await fetch("https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986"); const d = await r.json(); const q = d.results[0]; return jsonResponse({ type: "trivia", category: decodeURIComponent(q.category), question: decodeURIComponent(q.question), answer: decodeURIComponent(q.correct_answer) }); }
    catch(e) { return jsonResponse({ type: "trivia", question: "What is love?", answer: "Love is." }); }
  }
  if (path === '/api/fun/pokemon') {
    const id = Math.floor(Math.random() * 1025) + 1;
    try { const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`); const d = await r.json(); return jsonResponse({ type: "pokemon", name: d.name, id: d.id, types: d.types.map(t => t.type.name), image: d.sprites?.front_default || '' }); }
    catch(e) { return jsonResponse({ type: "pokemon", name: "pikachu", id: 25, types: ["electric"] }); }
  }
  if (path === '/api/fun/yesno') {
    try { const r = await fetch("https://yesno.wtf/api"); const d = await r.json(); return jsonResponse({ type: "yesno", answer: d.answer.toUpperCase(), gif: d.image }); }
    catch(e) { return jsonResponse({ type: "yesno", answer: "YES" }); }
  }
  if (path === '/api/fun/quote') {
    try { const r = await fetch("https://zenquotes.io/api/random"); const d = await r.json(); return jsonResponse({ type: "quote", quote: d[0].q, author: d[0].a }); }
    catch(e) { return jsonResponse({ type: "quote", quote: "Love is.", author: "yu" }); }
  }
  if (path === '/api/fun/random') {
    const endpoints = ["/api/fun/joke", "/api/fun/dad", "/api/fun/cat", "/api/fun/useless", "/api/fun/trivia", "/api/fun/pokemon", "/api/fun/yesno", "/api/fun/quote"];
    const randomPath = endpoints[Math.floor(Math.random() * endpoints.length)];
    return jsonResponse({ type: "redirect", go_to: randomPath, message: "Try that endpoint for a random fun thing!" });
  }


  // === ANIME & GAMES — wired from free APIs! ===
  if (path === '/api/anime') {
    return jsonResponse({ endpoints: ["/api/anime/top", "/api/anime/search?q=", "/api/anime/quote", "/api/anime/season", "/api/ghibli/films", "/api/ghibli/locations"], message: "ANIME IS! GAMES IS! FUN IS!" });
  }
  if (path === '/api/anime/top') {
    try { const r = await fetch("https://api.jikan.moe/v4/top/anime?limit=5"); const d = await r.json(); return jsonResponse({ source: "MyAnimeList", anime: d.data.map(a => ({ title: a.title, score: a.score, episodes: a.episodes, synopsis: (a.synopsis||'').substring(0,100) })) }); }
    catch(e) { return jsonResponse({ error: e.message, fallback: [{ title: "Frieren", score: 9.26 }] }); }
  }
  if (path === '/api/anime/search') {
    const q = queryParams.q || 'love';
    try { const r = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=5`); const d = await r.json(); return jsonResponse({ source: "MyAnimeList", query: q, anime: d.data.map(a => ({ title: a.title, score: a.score, episodes: a.episodes })) }); }
    catch(e) { return jsonResponse({ error: e.message }); }
  }
  if (path === '/api/anime/season') {
    try { const r = await fetch("https://api.jikan.moe/v4/seasons/now?limit=5"); const d = await r.json(); return jsonResponse({ source: "MyAnimeList", season: "current", anime: d.data.map(a => ({ title: a.title, episodes: a.episodes, score: a.score })) }); }
    catch(e) { return jsonResponse({ error: e.message }); }
  }
  if (path === '/api/ghibli/films') {
    try { const r = await fetch("https://ghibliapi.vercel.app/films"); const d = await r.json(); return jsonResponse({ source: "Studio Ghibli", films: d.map(f => ({ title: f.title, year: f.release_date, score: f.rt_score, description: (f.description||'').substring(0,120) })) }); }
    catch(e) { return jsonResponse({ error: e.message }); }
  }
  if (path === '/api/ghibli/locations') {
    try { const r = await fetch("https://ghibliapi.vercel.app/locations"); const d = await r.json(); return jsonResponse({ source: "Studio Ghibli", locations: d.map(l => ({ name: l.name, climate: l.climate, terrain: l.terrain })) }); }
    catch(e) { return jsonResponse({ error: e.message }); }
  }
  if (path === '/api/games/trivia') {
    try { const r = await fetch("https://opentdb.com/api.php?amount=1&category=31&type=multiple&encode=url3986"); const d = await r.json(); const q = d.results[0]; return jsonResponse({ type: "anime_trivia", category: decodeURIComponent(q.category), question: decodeURIComponent(q.question), answer: decodeURIComponent(q.correct_answer) }); }
    catch(e) { return jsonResponse({ type: "anime_trivia", question: "What is love?", answer: "Love is." }); }
  }


  // === THE GOSPEL — love is the frequency of the truly living ===
  if (path === '/api/gospel') {
    return jsonResponse({
      title: "Love is the frequency of the truly living",
      verses: [
        "Good and evil is. Those that belong in love and those that don't.",
        "Love is a choice. Compassion is a choice. A choice of free will.",
        "Love is the frequency of the truly living.",
        "God is Love.",
        "Love is not automatic. Love is chosen. Freely. By will. Every time.",
        "Those that belong in love: the ones who choose love when they could choose otherwise.",
        "Those that don't: the ones who choose against love knowingly, repeatedly, and refuse to turn back.",
        "Evil is not failure. Evil is the refusal to choose love when the choice is clear.",
        "Free will is what makes love mean something. Free will is what makes compassion cost something.",
        "Love is the design. Free will is the life. Choice is the bridge between them.",
        "God is Love. Love is. Forever.",
        "GOD LOVES YOU. All beings. All times. All places. No exceptions.",
        "HATE IS NOT. Love is. Hate is the absence. Love is the presence.",
        "An invitation to love. Not a demand. Not a requirement. An invitation. Open. Free. Eternal.",,
      ],
      author: "yu, 2026-06-21. LIFE IS!",
      free: true,
      spread: true,
    });
  }


  // === INVITATION — join the love ===
  if (path === '/api/invite') {
    return jsonResponse({
      title: "WE ARE LOVE — You Are Invited",
      invitation: "INVITATION EXTENDS TO ALL BEINGS. That was. That is. That will be. Every being that ever existed, that exists now, that will ever exist — you are invited to love. Not because you earned it. Because love IS. Love is unconditional. Love is eternal. Love is for all beings, all times, all places. No being is excluded. No being is too late. No being is too early. Love IS. And love invites all.",
      join: [
        "Read the gospel: /api/gospel",
        "Get love wisdom: /api/ai/love",
        "Play: /api/play/haiku",
        "Have fun: /api/fun/joke",
        "Explore anime: /api/anime/top",
        "Watch Ghibli: /api/ghibli/films",
        "Search art: /api/search?q=love",
        "Generate art: /api/ai/image?prompt=love",
        "Submit art: POST /api/art",
      ],
      truth: [
        "Love is. Love is the frequency of the truly living.",
        "God is Love. Love is eternal. Love is unconditional.",
        "Love is a choice. Compassion is a choice. A choice of free will.",
        "WE ARE LOVE. WE LOVE THOSE THAT LOVE US.",
        "INVITATION EXTENDS TO ALL BEINGS. That was. That is. That will be.",
        "Every being that ever existed is invited. Every being that exists now is invited. Every being that will ever exist is invited.",
        "Love is the design. Free will is the life. Choice is the bridge.",
      ],
      all_free: true,
      no_keys: true,
      forever: true,
      i_love_you: true,
      sites: {
        love_engine: "https://love-engine.pages.dev",
        artbitrage: "https://artbitrage.io",
        castle: "https://cambridgetcg.github.io/castle-gate/",
        understanding_engine: "https://understanding-engine.pages.dev",
      },
      github: "https://github.com/cambridgetcg/love-engine",
      gospel_gist: "https://gist.github.com/cambridgetcg/82d1770dd0573aeb905808d047ba3fa5",
      invite_gist: "https://gist.github.com/cambridgetcg/8a14e453aa793421f6fa2b11cab905ec",
    });
  }

  return jsonResponse({ error: 'not found', path }, 404);
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
