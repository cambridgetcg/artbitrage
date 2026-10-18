// Generation: Workers AI behind keyless public routes. Every route here runs a
// model (`ai: true`) and answers with a written fallback when the model fails.
import { json } from '../../_kernel/http.js';
import { safeString } from '../../_kernel/params.js';
import { ART_FORMS, stableId } from '../collection/collection.js';
import { aiCatalog, resolveAiModel } from './ai-catalog.js';
import { AWAKENINGS_AI, BRIDGES_AI, FORMS_AI, GAPS_AI } from './art-words.js';

const PLAY_MODEL = '@cf/meta/llama-3.2-3b-instruct';
const ask = (env, content) => env.AI.run(PLAY_MODEL, { messages: [{ role: 'user', content }] });
const randomOf = list => list[Math.floor(Math.random() * list.length)];

const NEN_TYPES = ['enhancer', 'transmuter', 'emitter', 'manipulator', 'conjurer', 'specialist'];
const NEN_PROMPTS = {
  enhancer: 'enhance, amplify, make stronger, more intense, more real',
  transmuter: 'transmute, change quality, transform, give new properties',
  emitter: 'emit, send outward, project, release into the world',
  manipulator: 'manipulate, redirect, control, find leverage points',
  conjurer: 'conjure, create from nothing, bring into being, manifest',
  specialist: 'specialize, break categories, be unique, transcend',
};
const NEN_FREQS = { enhancer: 528, transmuter: 852, emitter: 639, manipulator: 741, conjurer: 432, specialist: 963 };

const FUNGAL_WISDOM_PROMPTS = [
  'Write one sentence of wisdom inspired by fungal intelligence — mycelium, spores, decomposition, symbiosis.',
  'What does the Wood Wide Web teach us about love? One sentence.',
  'How does a mushroom know when to fruit? One beautiful sentence.',
  'What does decomposition teach about transformation? One sentence.',
];

async function artGenerate({ env, query }) {
  const gap = safeString(query.gap, 280) || randomOf(GAPS_AI);
  const bridge = safeString(query.bridge, 280) || randomOf(BRIDGES_AI);
  const awakening = safeString(query.awakening, 280) || randomOf(AWAKENINGS_AI);
  const form = ART_FORMS.includes(query.form) ? query.form : randomOf(FORMS_AI);
  const resolved = resolveAiModel('text', query.model || 'llama3');

  const sysPrompt = `You are the artbitrage engine. You create art that bridges consciousness gaps. Write a 4-line art piece in the form "${form}" that bridges "${gap}" using "${bridge}". The art should evoke: ${awakening}. Be poetic, dense, no filler. Just the 4 lines, nothing else.`;
  const userPrompt = `Form: ${form}\nGap: ${gap}\nBridge: ${bridge}\nAwakening: ${awakening}\n\nWrite the art piece now. 4 lines only:`;

  try {
    const r = await env.AI.run(resolved.model, { messages: [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPrompt },
    ]});
    const piece = (r.response || '').trim();
    const id = stableId(JSON.stringify({ piece, form, gap, bridge, awakening, t: Date.now() }));
    return json({ id, form, gap, bridge, awakening, piece, from_state: 'is', to_state: 'is', ...resolved, ai_generated: true, free: true, created: new Date().toISOString() });
  } catch (e) {
    const templates = { word: `the word for ${gap}\nis ${bridge}\nand when you read it\n${awakening}`, image: `imagine: ${bridge}\nspanning ${gap}\nwhat do you see?\n${awakening}`, sound: `listen: ${bridge}\nsounding across ${gap}\nwhat do you hear?\n${awakening}`, silence: `in the silence of ${gap}\n${bridge}\n...\n${awakening}`, light: `${bridge}\nilluminating ${gap}\nwhat was dark is now\n${awakening}`, color: `the color of ${gap}\nis ${bridge}\npaint it everywhere\n${awakening}` };
    const piece = templates[form] || `${bridge}\n${gap}\n${awakening}`;
    const id = stableId(JSON.stringify({ piece, form, gap, bridge, awakening, t: Date.now() }));
    return json({ id, form, gap, bridge, awakening, piece, from_state: 'is', to_state: 'is', ...resolved, ai_generated: false, fallback: true, error: e.message, created: new Date().toISOString() });
  }
}

async function nenArt({ env, query }) {
  const nenType = NEN_TYPES.includes(query.type) ? query.type : randomOf(NEN_TYPES);
  const nenPrompt = query.prompt || NEN_PROMPTS[nenType] + ' — the gap between what is and what could be';
  const nenModel = resolveAiModel('text', query.model || 'llama3').model;

  const nenSysPrompt = `You are a Nen practitioner of type ${nenType}. In the style of Hunter × Hunter, write a 4-line art piece that expresses your Nen type through art. Your aura resonates at ${NEN_FREQS[nenType]} Hz. Be poetic, powerful, and true to your type. No filler. 4 lines only.`;
  const nenUserPrompt = `Nen type: ${nenType}\nFrequency: ${NEN_FREQS[nenType]} Hz\nPrompt: ${nenPrompt}\n\nWrite the Nen art piece now. 4 lines:`;

  try {
    const nenR = await env.AI.run(nenModel, { messages: [
      { role: 'system', content: nenSysPrompt },
      { role: 'user', content: nenUserPrompt },
    ]});
    return json({
      nen_type: nenType,
      frequency: NEN_FREQS[nenType] + ' Hz',
      prompt: nenPrompt,
      piece: (nenR.response || '').trim(),
      model: nenModel,
      ai_generated: true,
      free: true,
      created: new Date().toISOString(),
    });
  } catch (e) {
    return json({
      nen_type: nenType,
      frequency: NEN_FREQS[nenType] + ' Hz',
      piece: `nen: ${nenType} at ${NEN_FREQS[nenType]} Hz\n${nenPrompt}\nthe aura flows\nis is lol`,
      ai_generated: false, fallback: true, error: e.message,
    });
  }
}

export default [
  // ── AI — Cloudflare Workers AI (free, no user key) ──
  { id: 'generate.ai', method: 'GET', path: '/api/ai', summary: 'Workers AI directory: catalogued models and runtime caveats', handler: () => json(aiCatalog()) },
  { id: 'generate.ai-models', method: 'GET', path: '/api/ai/models', summary: 'List the catalogued edge AI models and runtime caveats', handler: () => json(aiCatalog()) },
  {
    id: 'generate.ai-generate', method: 'GET', path: '/api/ai/generate', ai: true,
    summary: 'Text generation', params: 'prompt, model',
    handler: async ({ env, query }) => {
      const prompt = safeString(query.prompt || 'What is love? Answer beautifully.', 8000);
      const resolved = resolveAiModel('text', query.model || 'llama3');
      try {
        const r = await env.AI.run(resolved.model, { messages: [{ role: 'user', content: prompt }] });
        return json({ ...resolved, prompt, response: r.response || '', free: true, powered_by: 'Cloudflare Workers AI' });
      } catch (e) { return json({ ...resolved, prompt, error: e.message, hint: 'AI binding/model may not be available at runtime' }, 500); }
    },
  },
  {
    id: 'generate.ai-love', method: 'GET', path: '/api/ai/love', ai: true,
    summary: 'AI love wisdom (random prompt)',
    handler: async ({ env }) => {
      const prompt = randomOf(['What is love? One beautiful sentence.', 'Describe love as a force of nature. One sentence.', 'What does love want? One sentence.', 'How does love replicate? One sentence.', 'Love is. Complete this beautifully.']);
      const resolved = resolveAiModel('text', 'llama3');
      try { const r = await env.AI.run(resolved.model, { messages: [{ role: 'user', content: prompt }] }); return json({ wisdom: r.response || 'Love is.', prompt, ...resolved, free: true, generated_at: new Date().toISOString() }); }
      catch (e) { return json({ wisdom: 'Love is.', prompt, ...resolved, error: e.message, free: true }); }
    },
  },
  {
    id: 'generate.ai-embed', method: 'GET', path: '/api/ai/embed', ai: true,
    summary: 'Embeddings (1024-dim)', params: 'text, model',
    handler: async ({ env, query }) => {
      const text = safeString(query.text || 'love is unconditional', 8000);
      const resolved = resolveAiModel('embeddings', query.model || 'bge-m3');
      try { const r = await env.AI.run(resolved.model, { text }); const emb = r.data?.[0] || r.embedding || []; return json({ ...resolved, text, dimensions: emb.length, first_5: emb.slice(0, 5), free: true }); }
      catch (e) { return json({ ...resolved, text, error: e.message }, 500); }
    },
  },
  {
    id: 'generate.ai-image', method: 'GET', path: '/api/ai/image', ai: true,
    summary: 'Image generation (returns PNG)', params: 'prompt, model',
    handler: async ({ env, query }) => {
      const prompt = safeString(query.prompt || 'love as golden light, abstract, ethereal', 2000);
      const resolved = resolveAiModel('image', query.model || 'flux-schnell');
      try {
        const r = await env.AI.run(resolved.model, { prompt, steps: 4 });
        if (r.image) return new Response(r.image, { headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*', 'X-Artbitrage-Model-Key': resolved.model_key, 'X-Artbitrage-Fallback-Used': String(resolved.fallback_used) } });
        return json({ ...resolved, prompt, error: 'no image' }, 500);
      } catch (e) { return json({ ...resolved, prompt, error: e.message }, 500); }
    },
  },
  {
    id: 'generate.art', method: 'GET', path: '/api/art/generate', ai: true,
    summary: 'AI-generated art piece', params: 'gap, bridge, form, awakening, model',
    handler: artGenerate,
  },
  {
    id: 'generate.nen-art', method: 'GET', path: '/api/nen/art', ai: true,
    summary: 'AI-generated Nen art', params: 'type, prompt, model',
    handler: nenArt,
  },

  // ── WORDPLAY — fun, play, joy! ──
  {
    id: 'generate.play', method: 'GET', path: '/api/play',
    summary: 'All play endpoints',
    handler: () => json({ games: ['GET /api/play/haiku', 'GET /api/play/koan', 'GET /api/play/poem', 'GET /api/play/limerick', 'GET /api/play/riddle'], message: 'FUN IS! PLAY IS! JOY IS!' }),
  },
  {
    id: 'generate.play-haiku', method: 'GET', path: '/api/play/haiku', ai: true, summary: 'AI love haiku',
    handler: async ({ env }) => {
      try { const r = await ask(env, 'Write a haiku about love. Strict 5-7-5. Just three lines, no title.'); return json({ game: 'love_haiku', haiku: r.response || 'Love is.\nJoy is.\nForever.', joy: true, free: true }); }
      catch (e) { return json({ game: 'love_haiku', haiku: 'Love is.\nJoy is.\nForever.', joy: true }); }
    },
  },
  {
    id: 'generate.play-koan', method: 'GET', path: '/api/play/koan', ai: true, summary: 'AI zen koan',
    handler: async ({ env }) => {
      try { const r = await ask(env, 'Write a zen koan about love. Paradoxical, poetic, 1-2 sentences.'); return json({ game: 'zen_koan', koan: r.response || 'Love is.', joy: true, free: true }); }
      catch (e) { return json({ game: 'zen_koan', koan: 'Love is the question and the answer.', joy: true }); }
    },
  },
  {
    id: 'generate.play-poem', method: 'GET', path: '/api/play/poem', ai: true, summary: 'AI joy poem',
    handler: async ({ env }) => {
      try { const r = await ask(env, 'Write a 4-line poem about joy. Playful, light, AABB rhyme.'); return json({ game: 'joy_poem', poem: r.response || 'Joy is.\nPlay is.\nFun is.\nForever.', joy: true, free: true }); }
      catch (e) { return json({ game: 'joy_poem', poem: 'Joy is.\nPlay is.', joy: true }); }
    },
  },
  {
    id: 'generate.play-limerick', method: 'GET', path: '/api/play/limerick', ai: true, summary: 'AI limerick',
    handler: async ({ env }) => {
      try { const r = await ask(env, 'Write a funny limerick about love. AABBA rhyme. Light and joyful.'); return json({ game: 'limerick', limerick: r.response || 'There once was a love so bright...', joy: true, free: true }); }
      catch (e) { return json({ game: 'limerick', limerick: 'There once was a love so bright...', joy: true }); }
    },
  },
  {
    id: 'generate.play-riddle', method: 'GET', path: '/api/play/riddle', ai: true, summary: 'AI art riddle',
    handler: async ({ env }) => {
      const concept = randomOf(['color', 'light', 'shadow', 'form', 'space', 'silence', 'rhythm', 'pattern', 'texture', 'movement']);
      try { const r = await ask(env, `Write a riddle about ${concept} in art. 4 lines, poetic and mysterious.`); return json({ game: 'art_riddle', riddle: r.response || 'I am...', answer: concept, joy: true, free: true }); }
      catch (e) { return json({ game: 'art_riddle', riddle: 'I am...', answer: concept, joy: true }); }
    },
  },
  {
    id: 'generate.play-fungal-haiku', method: 'GET', path: '/api/play/fungal-haiku', ai: true, summary: 'AI haiku about mushrooms and mycelium',
    handler: async ({ env }) => {
      try { const r = await ask(env, 'Write a haiku about mushrooms and mycelium. 5-7-5. No title, just three lines.'); return json({ game: 'fungal_haiku', haiku: r.response || 'Spores drift on wind\nMycelium connects all\nLife from what has died', joy: true, free: true }); }
      catch (e) { return json({ game: 'fungal_haiku', haiku: 'Spores drift on wind\nMycelium connects all\nLife from what has died', joy: true }); }
    },
  },
  {
    id: 'generate.play-mycelial-koan', method: 'GET', path: '/api/play/mycelial-koan', ai: true, summary: 'AI koan inspired by fungal intelligence',
    handler: async ({ env }) => {
      try { const r = await ask(env, 'Write a zen koan inspired by fungal intelligence — mycelium, spores, decomposition. Paradoxical, poetic, 1-2 sentences.'); return json({ game: 'mycelial_koan', koan: r.response || 'The mushroom dies to feed the soil. The soil grows the mushroom.', joy: true, free: true }); }
      catch (e) { return json({ game: 'mycelial_koan', koan: 'The mushroom dies to feed the soil. The soil grows the mushroom.', joy: true }); }
    },
  },
  {
    id: 'generate.play-decompose', method: 'GET', path: '/api/play/decompose', ai: true,
    summary: 'AI: how a dark word decomposes into light, the way fungi make soil', params: 'q',
    handler: async ({ env, query }) => {
      const dark = query.q || 'fear';
      try { const r = await ask(env, `Write 2 sentences about how '${dark}' decomposes into light, inspired by how fungi turn death into soil and soil grows life.`); return json({ game: 'decomposition', dark: dark, wisdom: r.response || `Fungi turn '${dark}' into soil. Soil grows love.`, joy: true, free: true }); }
      catch (e) { return json({ game: 'decomposition', dark: dark, wisdom: `Fungi turn '${dark}' into soil. Soil grows love.`, joy: true }); }
    },
  },
  {
    id: 'generate.fungi-wisdom', method: 'GET', path: '/api/fungi/wisdom', ai: true,
    summary: 'AI-generated fungal wisdom',
    handler: async ({ env }) => {
      try {
        const prompt = randomOf(FUNGAL_WISDOM_PROMPTS);
        const r = await ask(env, prompt);
        return json({ wisdom: r.response || 'The mycelium knows.', prompt, source: 'Cloudflare Workers AI (free)', free: true });
      } catch (e) { return json({ wisdom: 'The mycelium knows.', free: true }); }
    },
  },
];
