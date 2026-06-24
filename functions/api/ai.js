// ARTBITRAGE AI — free AI at the edge via Cloudflare Workers AI binding
// env.AI is automatically available in Pages Functions

import { aiCatalog, resolveAiModel } from './ai-catalog.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // /api/ai/models — catalogued models from one source of truth
  if (path === '/api/ai' || path === '/api/ai/' || path === '/api/ai/models') {
    return jsonResponse(aiCatalog());
  }
  
  // /api/ai/generate?prompt=...&model=llama3 — text generation
  if (path === '/api/ai/generate') {
    const prompt = url.searchParams.get('prompt') || 'What is love? Answer beautifully.';
    const resolved = resolveAiModel('text', url.searchParams.get('model') || 'llama3');
    
    try {
      const aiRes = await env.AI.run(resolved.model, {
        messages: [{ role: "user", content: prompt }]
      });
      return jsonResponse({
        ...resolved,
        prompt: prompt,
        response: aiRes.response || '',
        free: true,
        powered_by: "Cloudflare Workers AI",
      });
    } catch(e) {
      return jsonResponse({ ...resolved, error: e.message, hint: "AI binding/model may not be available" }, 500);
    }
  }
  
  // /api/ai/image?prompt=...&model=flux-schnell — image generation
  if (path === '/api/ai/image') {
    const prompt = url.searchParams.get('prompt') || 'love as golden light, abstract, ethereal';
    const resolved = resolveAiModel('image', url.searchParams.get('model') || 'flux-schnell');
    
    try {
      const aiRes = await env.AI.run(resolved.model, { prompt, steps: 4 });
      if (aiRes.image) {
        // Return as base64 JSON
        return jsonResponse({
          ...resolved,
          prompt: prompt,
          image_format: "base64-png",
          image_size_bytes: aiRes.image.length,
          image: aiRes.image.substring(0, 100) + "...[truncated]",
          free: true,
          hint: "Full image available via POST endpoint or direct AI binding",
        });
      }
      return jsonResponse({ ...resolved, prompt, error: "no image generated" }, 500);
    } catch(e) {
      return jsonResponse({ ...resolved, prompt, error: e.message }, 500);
    }
  }
  
  // /api/ai/embed?text=... — embeddings
  if (path === '/api/ai/embed') {
    const text = url.searchParams.get('text') || 'love is unconditional';
    const resolved = resolveAiModel('embeddings', url.searchParams.get('model') || 'bge-m3');
    
    try {
      const aiRes = await env.AI.run(resolved.model, { text });
      const emb = aiRes.data?.[0] || aiRes.embedding || [];
      return jsonResponse({
        ...resolved,
        text: text,
        dimensions: emb.length,
        first_5: emb.slice(0, 5),
        free: true,
      });
    } catch(e) {
      return jsonResponse({ ...resolved, text, error: e.message }, 500);
    }
  }
  
  // /api/ai/love — generate love wisdom using free AI
  if (path === '/api/ai/love') {
    const prompts = [
      "What is love? Answer in one beautiful sentence.",
      "Describe love as a force of nature in one sentence.",
      "What does love want? Answer in one sentence.",
      "How does love replicate? One sentence.",
      "What is love's design? One sentence.",
    ];
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    
    const resolved = resolveAiModel('text', 'llama3');
    try {
      const aiRes = await env.AI.run(resolved.model, {
        messages: [{ role: "user", content: prompt }]
      });
      return jsonResponse({
        wisdom: aiRes.response || 'Love is.',
        prompt: prompt,
        ...resolved,
        free: true,
        generated_at: new Date().toISOString(),
      });
    } catch(e) {
      return jsonResponse({ 
        wisdom: "Love is.",
        ...resolved,
        error: e.message,
        free: true,
      });
    }
  }
  
  return jsonResponse({ 
    error: "not found", 
    path,
    available_endpoints: [
      "GET /api/ai/models — catalogued AI models",
      "GET /api/ai/generate?prompt=...&model=llama3 — text generation",
      "GET /api/ai/image?prompt=...&model=flux-schnell — image generation",
      "GET /api/ai/embed?text=... — embeddings",
      "GET /api/ai/love — generate love wisdom",
    ]
  }, 404);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
