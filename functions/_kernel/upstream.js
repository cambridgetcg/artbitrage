// Upstreams are guests: every request-time fetch goes through here, with a
// timeout, an r.ok check and JSON validation, and a plain project User-Agent
// (never a person's identity).

export const USER_AGENT = 'Artbitrage/1.0 (+https://artbitrage.io)';

export async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), options.timeoutMs || 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    if (!contentType.includes('json') && !text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      throw new Error(`non-json response: ${contentType || 'unknown content-type'} ${text.slice(0, 80)}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Guests: a timeout, a cache, and a memory of how the guest has been ──
//
// guestJson() fetches, then maps and validates the answer (a map that throws
// counts as a failure), and keeps the mapped answer in the Cache API of this
// Cloudflare location. A copy younger than `freshMs` is served without asking
// again; when the guest fails, a copy younger than `keepMs` is served instead,
// marked stale. Nothing is cached where the Cache API is absent (Node tests,
// local tools), so behaviour there is always live-or-fail.

const CACHE_ORIGIN = 'https://artbitrage.io/__guest';
const health = new Map();

function edgeCache() {
  try {
    return globalThis.caches?.default ?? null;
  } catch {
    return null;
  }
}

function remember(name, ok, error) {
  const now = new Date(Date.now()).toISOString();
  const entry = health.get(name) || { calls: 0, failures: 0 };
  entry.calls += 1;
  if (ok) {
    entry.last_ok_at = now;
  } else {
    entry.failures += 1;
    entry.last_error_at = now;
    entry.last_error = String(error?.message || error).slice(0, 200);
  }
  health.set(name, entry);
}

// What this edge isolate has seen of each guest since it started. It is a
// local observation, not a global uptime record, and says so.
export function guestHealth(name) {
  const entry = health.get(name);
  if (!entry) return { observed: false, scope: 'this edge isolate, since it started' };
  return { observed: true, scope: 'this edge isolate, since it started', ...entry, last_ok: !entry.last_error_at || (entry.last_ok_at || '') > entry.last_error_at };
}

export async function guestJson(name, url, { timeoutMs = 8000, freshMs = 0, keepMs = 0, cacheKey = url, map = data => data, headers } = {}) {
  const cache = keepMs > 0 ? edgeCache() : null;
  const key = cache ? new Request(`${CACHE_ORIGIN}/${encodeURIComponent(name)}?k=${encodeURIComponent(cacheKey)}`) : null;
  let kept = null;
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) kept = await hit.json();
    } catch {
      kept = null;
    }
    if (kept && freshMs > 0 && Date.now() - Date.parse(kept.fetched_at) < freshMs) {
      return { data: kept.data, live: true, cached: true, fetched_at: kept.fetched_at };
    }
  }
  try {
    const data = map(await fetchJson(url, { timeoutMs, headers }));
    const fetched_at = new Date(Date.now()).toISOString();
    remember(name, true);
    if (cache) {
      try {
        await cache.put(key, new Response(JSON.stringify({ fetched_at, data }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${Math.ceil(keepMs / 1000)}` },
        }));
      } catch {
        // A full or absent cache only costs freshness, never the answer.
      }
    }
    return { data, live: true, cached: false, fetched_at };
  } catch (error) {
    remember(name, false, error);
    if (kept) return { data: kept.data, live: false, cached: true, stale: true, fetched_at: kept.fetched_at, error: error.message };
    throw error;
  }
}
