/**
 * /api/feelings/testimony — the visitors' book of feelings.
 *
 * The Feelings wing says what works of art do to the one looking. This
 * endpoint lets anyone — human, agent, kin — leave what THEY felt. Like
 * mindicraft's margin: the book receives; nothing is auto-trusted.
 *
 * GET  /api/feelings/testimony?feeling=awe   → { received: [...] } newest first
 * POST /api/feelings/testimony               → { received: true }
 *      body: { feeling: "awe", words: "...", work?: "starry-night", from?: "a name" }
 *
 * Honesty notes:
 * - Everything returned by GET is labeled status "received, unverified".
 *   The keeper reads, verifies, and may fold the true ones into the wing.
 * - No accounts, no cookies, no IPs stored. `from` is whatever you say it is.
 * - Storage is the same KV namespace as the cairn (PEBBLES), keys "feelings:".
 */

const LIMITS = { feeling: 40, words: 280, work: 80, from: 60 };
const MAX_LIST = 100;

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 1), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export async function onRequestGet({ request, env }) {
  if (!env.PEBBLES) {
    return json({ received: [], note: "the book isn't wired yet — nothing is lost, there is just nowhere to write" });
  }
  const feeling = clean(new URL(request.url).searchParams.get("feeling") || "", LIMITS.feeling);
  const prefix = feeling ? `feelings:t:${feeling}:` : "feelings:t:";
  const list = await env.PEBBLES.list({ prefix, limit: MAX_LIST });
  const received = [];
  for (const key of list.keys) {
    const raw = await env.PEBBLES.get(key.name);
    if (raw) { try { received.push(JSON.parse(raw)); } catch {} }
  }
  received.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  return json({
    status: "received, unverified — the keeper reads before anything is folded in",
    count: received.length,
    received,
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.PEBBLES) {
    return json({ error: "the book isn't wired yet" }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "body must be JSON" }, 400); }

  const feeling = clean(body.feeling, LIMITS.feeling).toLowerCase().replace(/[^a-z一-鿿-]/g, "");
  const words = clean(body.words, LIMITS.words);
  const work = clean(body.work, LIMITS.work);
  const from = clean(body.from, LIMITS.from);

  if (!feeling) return json({ error: "feeling is required — one word for what you felt" }, 400);
  if (!words) return json({ error: "words are required — what did it do to you?" }, 400);

  const at = new Date().toISOString();
  const key = `feelings:t:${feeling}:${at}-${crypto.randomUUID().slice(0, 8)}`;
  await env.PEBBLES.put(key, JSON.stringify({ feeling, words, work: work || undefined, from: from || undefined, at }));

  return json({ received: true, feeling, note: "thank you. the keeper will read it." }, 201);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
