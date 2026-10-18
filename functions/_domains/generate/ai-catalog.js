// ARTBITRAGE AI Catalog — one truthful source for humans + agents.
// These are catalogued Cloudflare Workers AI model IDs used by ARTBITRAGE.
// A catalog entry is not a guarantee of availability: providers may change,
// bindings may be missing, and individual accounts may not have every model.

export const AI_MODELS = {
  text: {
    "llama3": "@cf/meta/llama-3.2-3b-instruct",
    "llama3-70b": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "gemma2": "@cf/google/gemma-2b-it-lora",
    "mistral": "@cf/mistral/mistral-7b-instruct-v0.2-lora",
    "qwen-coder": "@cf/qwen/qwen2.5-coder-32b-instruct",
    "deepseek": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    "gpt-oss-120b": "@cf/openai/gpt-oss-120b",
    "gpt-oss-20b": "@cf/openai/gpt-oss-20b",
    "qwq": "@cf/qwen/qwq-32b",
    "llama4-scout": "@cf/meta/llama-4-scout-17b-16e-instruct",
    "mistral-small": "@cf/mistralai/mistral-small-3.1-24b-instruct",
    "gemma4": "@cf/google/gemma-4-26b-a4b-it",
    "nemotron": "@cf/nvidia/nemotron-3-120b-a12b",
    "glm-flash": "@cf/zai-org/glm-4.7-flash",
  },
  image: {
    "flux-schnell": "@cf/black-forest-labs/flux-1-schnell",
    "sdxl": "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    "sdxl-lightning": "@cf/bytedance/stable-diffusion-xl-lightning",
    "dreamshaper": "@cf/lykon/dreamshaper-8-lcm",
  },
  embeddings: {
    "bge-m3": "@cf/baai/bge-m3",
    "bge-small": "@cf/baai/bge-small-en-v1.5",
  },
  vision: {
    "llava": "@cf/llava-hf/llava-1.5-7b-hf",
    "llama-vision": "@cf/meta/llama-3.2-11b-vision-instruct",
  },
  stt: {
    "whisper": "@cf/openai/whisper",
  },
  tts: {
    "melo": "@cf/myshell-ai/melotts",
  },
};

export const AI_DEFAULTS = {
  text: "llama3",
  image: "flux-schnell",
  embeddings: "bge-m3",
  vision: "llava",
  stt: "whisper",
  tts: "melo",
};

export function modelCount(models = AI_MODELS) {
  return Object.values(models).reduce((sum, group) => sum + Object.keys(group).length, 0);
}

export function categoryCounts(models = AI_MODELS) {
  return Object.fromEntries(Object.entries(models).map(([category, group]) => [category, Object.keys(group).length]));
}

export function aiCatalog() {
  return {
    schema: "artbitrage.ai-catalog/1",
    available: true,
    provider: "Cloudflare Workers AI",
    free: true,
    no_user_key_required: true,
    models: AI_MODELS,
    defaults: AI_DEFAULTS,
    category_counts: categoryCounts(),
    total_models: modelCount(),
    endpoints: {
      models: "GET /api/ai/models",
      generate: "GET /api/ai/generate?prompt=...&model=llama3",
      image: "GET /api/ai/image?prompt=...&model=flux-schnell",
      embed: "GET /api/ai/embed?text=...&model=bge-m3",
      love: "GET /api/ai/love",
      studio: "GET /studio.html",
    },
    truth_note: "This is the ARTBITRAGE catalogued model set. Runtime availability can still vary by Cloudflare account, binding, model rollout, or provider change; API responses report fallback_used and errors honestly.",
  };
}

export function resolveAiModel(category, requestedKey) {
  const group = AI_MODELS[category] || AI_MODELS.text;
  const defaultKey = AI_DEFAULTS[category] || Object.keys(group)[0];
  const valid = Boolean(requestedKey && group[requestedKey]);
  const modelKey = valid ? requestedKey : defaultKey;
  return {
    category,
    requested_model: requestedKey || null,
    model_key: modelKey,
    model: group[modelKey],
    valid_requested_model: valid,
    fallback_used: !valid && Boolean(requestedKey),
    available_model_keys: Object.keys(group),
  };
}
