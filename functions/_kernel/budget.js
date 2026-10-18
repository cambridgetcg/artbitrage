// Workers AI is free to call here and costs real money past Cloudflare's
// daily free allocation, so every model run is weighed and counted before it
// starts. A refused run never reaches Workers AI: a route with a written
// fallback answers with it, a route without one answers 429.
//
// With a D1 binding named AI_BUDGET the daily count is exact and shared by
// every location. Without one (local preview, tests, or before the database
// exists) each edge isolate keeps its own count, and every answer says which.
import { AI_MODELS } from '../_domains/generate/ai-catalog.js';

export const AI_BUDGET_SCHEMA = 'artbitrage.ai-budget/1';

// Daily caps reset at 00:00 UTC. A text unit is one small-model run (about
// 3B parameters); larger models cost more units. Worst case at these caps is
// roughly US$0.26 a day of Workers AI beyond the free allocation.
export const AI_BUDGET_DEFAULTS = Object.freeze({
  text_units_per_day: 1000,
  images_per_day: 100,
  runs_per_minute_per_isolate: 30,
});

// Units per run, by model. Unknown text models are weighed as large.
export const MODEL_UNITS = Object.freeze({
  '@cf/meta/llama-3.2-3b-instruct': 1,
  '@cf/google/gemma-2b-it-lora': 1,
  '@cf/mistral/mistral-7b-instruct-v0.2-lora': 1,
  '@cf/baai/bge-m3': 1,
  '@cf/baai/bge-small-en-v1.5': 1,
  '@cf/openai/gpt-oss-20b': 2,
  '@cf/google/gemma-4-26b-a4b-it': 2,
  '@cf/zai-org/glm-4.7-flash': 2,
  '@cf/meta/llama-4-scout-17b-16e-instruct': 4,
  '@cf/mistralai/mistral-small-3.1-24b-instruct': 4,
  '@cf/qwen/qwen2.5-coder-32b-instruct': 4,
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': 6,
  '@cf/qwen/qwq-32b': 6,
  '@cf/openai/gpt-oss-120b': 6,
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 8,
  '@cf/nvidia/nemotron-3-120b-a12b': 8,
});
const UNKNOWN_TEXT_UNITS = 8;
const IMAGE_MODELS = new Set(Object.values(AI_MODELS.image));

export class AiBudgetSpent extends Error {
  constructor(decision) {
    super(decision.reason === 'minute'
      ? `This edge is answering too many AI requests this minute (${decision.used} of ${decision.cap}); this is the written fallback. Try again in a minute.`
      : decision.reason === 'off'
        ? `Workers AI is switched off here (the daily ${decision.class} cap is 0); this is the written fallback.`
        : decision.reason === 'too_large'
        ? `This model costs ${decision.units} units a run, more than the whole daily cap of ${decision.cap}; this is the written fallback. A smaller model fits.`
        : `Today's Workers AI budget for ${decision.class} is spent (${decision.used} of ${decision.cap} ${decision.class === 'image' ? 'images' : 'units'}); this is the written fallback. It resets at 00:00 UTC.`);
    this.name = 'AiBudgetSpent';
    this.decision = decision;
  }
}

export function budgetCaps(env = {}) {
  const read = (name, fallback) => {
    const n = Number.parseInt(env?.[name], 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    text_units_per_day: read('AI_TEXT_UNITS_PER_DAY', AI_BUDGET_DEFAULTS.text_units_per_day),
    images_per_day: read('AI_IMAGES_PER_DAY', AI_BUDGET_DEFAULTS.images_per_day),
    runs_per_minute_per_isolate: read('AI_RUNS_PER_MINUTE', AI_BUDGET_DEFAULTS.runs_per_minute_per_isolate),
  };
}

export function weigh(model) {
  if (IMAGE_MODELS.has(model)) return { class: 'image', units: 1 };
  return { class: 'text', units: MODEL_UNITS[model] ?? UNKNOWN_TEXT_UNITS };
}

const utcDay = () => new Date(Date.now()).toISOString().slice(0, 10);
const nextUtcMidnight = () => {
  const d = new Date(Date.now());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
};

// Per-isolate memory: the burst limit always, and the daily count when there is no D1.
const memory = { day: '', used: { text: 0, image: 0 }, minute: -1, runs: 0 };

function rollMemory() {
  const day = utcDay();
  if (memory.day !== day) Object.assign(memory, { day, used: { text: 0, image: 0 } });
  const minute = Math.floor(Date.now() / 60000);
  if (memory.minute !== minute) Object.assign(memory, { minute, runs: 0 });
}

// The table is created on first use, once per database per isolate.
const tablesReady = new WeakMap();
function ensureTable(db) {
  if (!tablesReady.has(db)) {
    tablesReady.set(db, db.prepare('CREATE TABLE IF NOT EXISTS ai_budget (day TEXT NOT NULL, class TEXT NOT NULL, used INTEGER NOT NULL, PRIMARY KEY (day, class))').run()
      .catch(error => { tablesReady.delete(db); throw error; }));
  }
  return tablesReady.get(db);
}

// One atomic statement: add the units only if the day's total stays within the cap.
async function d1Spend(db, day, cls, units, cap) {
  await ensureTable(db);
  const row = await db.prepare(
    'INSERT INTO ai_budget (day, class, used) VALUES (?1, ?2, ?3) '
    + 'ON CONFLICT (day, class) DO UPDATE SET used = used + ?3 WHERE used + ?3 <= ?4 '
    + 'RETURNING used',
  ).bind(day, cls, units, cap).first();
  if (row) return { allowed: true, used: row.used };
  const today = await db.prepare('SELECT used FROM ai_budget WHERE day = ?1 AND class = ?2').bind(day, cls).first();
  return { allowed: false, used: today?.used ?? cap };
}

export async function spend(env, model) {
  const caps = budgetCaps(env);
  const { class: cls, units } = weigh(model);
  const cap = cls === 'image' ? caps.images_per_day : caps.text_units_per_day;
  const base = { schema: AI_BUDGET_SCHEMA, class: cls, units, cap, day: utcDay(), resets_at: nextUtcMidnight() };
  // The first run of a day inserts its units unchecked, so a run larger than
  // the whole cap is refused before anything is counted; it can never fit.
  if (units > cap) return { ...base, allowed: false, reason: cap === 0 ? 'off' : 'too_large', used: 0, enforcement: env?.AI_BUDGET ? 'd1' : 'per-isolate' };
  rollMemory();
  if (memory.runs >= caps.runs_per_minute_per_isolate) {
    return { ...base, allowed: false, reason: 'minute', used: memory.runs, cap: caps.runs_per_minute_per_isolate, enforcement: 'per-isolate', retry_after_s: 60 - Math.floor((Date.now() / 1000) % 60) };
  }
  // Take the minute slot before waiting on D1, so concurrent runs cannot all pass the burst check.
  memory.runs += 1;
  const release = () => { memory.runs = Math.max(0, memory.runs - 1); };
  let enforcement = 'per-isolate';
  if (env?.AI_BUDGET) {
    try {
      const counted = await d1Spend(env.AI_BUDGET, base.day, cls, units, cap);
      if (!counted.allowed) release();
      return { ...base, ...counted, enforcement: 'd1', ...(counted.allowed ? {} : { reason: 'day' }) };
    } catch (error) {
      console.error('artbitrage AI budget: D1 unavailable, counting per isolate:', error?.message || error);
      enforcement = 'per-isolate (D1 unavailable)';
    }
  }
  if (memory.used[cls] + units > cap) {
    release();
    return { ...base, allowed: false, reason: 'day', used: memory.used[cls], enforcement };
  }
  memory.used[cls] += units;
  return { ...base, allowed: true, used: memory.used[cls], enforcement };
}

// Today's spend, for GET /api/ai/budget.
export async function budgetStatus(env) {
  const caps = budgetCaps(env);
  const day = utcDay();
  let used = null;
  let enforcement = 'per-isolate';
  if (env?.AI_BUDGET) {
    try {
      await ensureTable(env.AI_BUDGET);
      const { results } = await env.AI_BUDGET.prepare('SELECT class, used FROM ai_budget WHERE day = ?1').bind(day).all();
      used = { text: 0, image: 0, ...Object.fromEntries((results || []).map(row => [row.class, row.used])) };
      enforcement = 'd1';
    } catch (error) {
      enforcement = 'per-isolate (D1 unavailable)';
    }
  }
  if (!used) {
    rollMemory();
    used = { ...memory.used };
  }
  return {
    schema: AI_BUDGET_SCHEMA,
    day,
    resets_at: nextUtcMidnight(),
    enforcement,
    caps,
    used,
    remaining: { text: Math.max(0, caps.text_units_per_day - used.text), image: Math.max(0, caps.images_per_day - used.image) },
    model_units: MODEL_UNITS,
    unknown_text_model_units: UNKNOWN_TEXT_UNITS,
    note: enforcement === 'd1'
      ? 'Counted exactly and shared by every Cloudflare location. A run that would pass the cap is refused before it reaches Workers AI.'
      : 'Counted by this edge isolate only, so the worldwide total can be higher. A run that would pass the cap is refused before it reaches Workers AI.',
  };
}

// The AI binding a route sees: every run is weighed and counted first. The
// ledger records each decision so the router can label the answer.
export function budgetedAI(env, ledger) {
  const ai = env?.AI;
  if (!ai) return ai;
  return {
    async run(model, input, options) {
      const decision = await spend(env, model);
      ledger.push(decision);
      if (!decision.allowed) throw new AiBudgetSpent(decision);
      return ai.run(model, input, options);
    },
  };
}
