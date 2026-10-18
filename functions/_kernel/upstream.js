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
