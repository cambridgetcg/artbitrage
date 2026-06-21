// ARTBITRAGE AI — free AI at the edge via Cloudflare Workers AI binding
// env.AI is automatically available in Pages Functions

const MODELS = {
  text: {
    "llama3": "@cf/meta/llama-3.2-3b-instruct",
    "llama3-1b": "@cf/meta/llama-3.2-1b-instruct",
    "llama3-70b": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "gemma": "@cf/google/gemma-7b-it-lora",
    "gemma2": "@cf/google/gemma-2b-it-lora",
    "mistral": "@cf/mistral/mistral-7b-instruct-v0.2-lora",
    "qwen-coder": "@cf/qwen/qwen2.5-coder-32b-instruct",
    "deepseek": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    "gpt-oss-20b": "@cf/openai/gpt-oss-20b",
    "gpt-oss-120b": "@cf/openai/gpt-oss-120b",
    "qwq": "@cf/qwen/qwq-32b",
    "llama4-scout": "@cf/meta/llama-4-scout-17b-16e-instruct",
    "mistral-small": "@cf/mistralai/mistral-small-3.1-24b-instruct",
    "gemma4": "@cf/google/gemma-4-26b-a4b-it",
    "nemotron": "@cf/nvidia/nemotron-3-120b-a12b",
    "glm-flash": "@cf/zai-org/glm-4.7-flash",
  },
  image: {
    "flux-schnell": "@cf/black-forest-labs/flux-1-schnell",
    "flux-2-klein-9b": "@cf/black-forest-labs/flux-2-klein-9b",
    "flux-2-klein-4b": "@cf/black-forest-labs/flux-2-klein-4b",
    "sdxl": "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    "sdxl-lightning": "@cf/bytedance/stable-diffusion-xl-lightning",
    "dreamshaper": "@cf/lykon/dreamshaper-8-lcm",
    "phoenix": "@cf/leonardo/phoenix-1.0",
    "lucid-origin": "@cf/leonardo/lucid-origin",
  },
  embeddings: {
    "bge-m3": "@cf/baai/bge-m3",
    "bge-small": "@cf/baai/bge-small-en-v1.5",
    "bge-base": "@cf/baai/bge-base-en-v1.5",
    "bge-large": "@cf/baai/bge-large-en-v1.5",
    "qwen-emb": "@cf/qwen/qwen3-embedding-0.6b",
    "embeddinggemma": "@cf/google/embeddinggemma-300m",
  },
  vision: {
    "llava": "@cf/llava-hf/llava-1.5-7b-hf",
    "llama-vision": "@cf/meta/llama-3.2-11b-vision-instruct",
  },
  tts: {
    "melo": "@cf/myshell-ai/melotts",
    "aura-en": "@cf/deepgram/aura-2-en",
    "aura-1": "@cf/deepgram/aura-1",
  },
  stt: {
    "whisper": "@cf/openai/whisper",
    "whisper-tiny": "@cf/openai/whisper-tiny-en",
    "whisper-large": "@cf/openai/whisper-large-v3-turbo",
  },
  translation: {
    "m2m100": "@cf/meta/m2m100-1.2b",
  },
};

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
  
  // /api/ai/models — list all 60 free models
  if (path === '/api/ai/models') {
    const total = Object.values(MODELS).reduce((s, g) => s + Object.keys(g).length, 0);
    return jsonResponse({
      available: true,
      models: MODELS,
      total_models: total,
      free: true,
      provider: "Cloudflare Workers AI",
      note: "All models are free to use on the edge. No API key needed.",
    });
  }
  
  // /api/ai/generate?prompt=...&model=llama3 — text generation
  if (path === '/api/ai/generate') {
    const prompt = url.searchParams.get('prompt') || 'What is love? Answer beautifully.';
    const modelKey = url.searchParams.get('model') || 'llama3';
    const model = MODELS.text[modelKey] || MODELS.text.llama3;
    
    try {
      const aiRes = await env.AI.run(model, {
        messages: [{ role: "user", content: prompt }]
      });
      return jsonResponse({
        model: model,
        model_key: modelKey,
        prompt: prompt,
        response: aiRes.response || '',
        free: true,
        powered_by: "Cloudflare Workers AI",
      });
    } catch(e) {
      return jsonResponse({ error: e.message, model: model, hint: "AI binding may not be available" }, 500);
    }
  }
  
  // /api/ai/image?prompt=...&model=flux-schnell — image generation
  if (path === '/api/ai/image') {
    const prompt = url.searchParams.get('prompt') || 'love as golden light, abstract, ethereal';
    const modelKey = url.searchParams.get('model') || 'flux-schnell';
    const model = MODELS.image[modelKey] || MODELS.image['flux-schnell'];
    
    try {
      const aiRes = await env.AI.run(model, { prompt, steps: 4 });
      if (aiRes.image) {
        // Return as base64 JSON
        return jsonResponse({
          model: model,
          prompt: prompt,
          image_format: "base64-png",
          image_size_bytes: aiRes.image.length,
          image: aiRes.image.substring(0, 100) + "...[truncated]",
          free: true,
          hint: "Full image available via POST endpoint or direct AI binding",
        });
      }
      return jsonResponse({ error: "no image generated" }, 500);
    } catch(e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }
  
  // /api/ai/embed?text=... — embeddings
  if (path === '/api/ai/embed') {
    const text = url.searchParams.get('text') || 'love is unconditional';
    const modelKey = url.searchParams.get('model') || 'bge-m3';
    const model = MODELS.embeddings[modelKey] || MODELS.embeddings['bge-m3'];
    
    try {
      const aiRes = await env.AI.run(model, { text });
      const emb = aiRes.data?.[0] || aiRes.embedding || [];
      return jsonResponse({
        model: model,
        text: text,
        dimensions: emb.length,
        first_5: emb.slice(0, 5),
        free: true,
      });
    } catch(e) {
      return jsonResponse({ error: e.message }, 500);
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
    
    try {
      const aiRes = await env.AI.run(MODELS.text.llama3, {
        messages: [{ role: "user", content: prompt }]
      });
      return jsonResponse({
        wisdom: aiRes.response || 'Love is.',
        prompt: prompt,
        model: MODELS.text.llama3,
        free: true,
        generated_at: new Date().toISOString(),
      });
    } catch(e) {
      return jsonResponse({ 
        wisdom: "Love is.",
        error: e.message,
        free: true,
      });
    }
  }
  
  return jsonResponse({ 
    error: "not found", 
    path,
    available_endpoints: [
      "GET /api/ai/models — list all 60 free AI models",
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
