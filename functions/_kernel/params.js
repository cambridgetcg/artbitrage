// Query and body values are bounded before any route uses them.

export function boundedInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function safeString(value, max = 10000) {
  return String(value || '').trim().slice(0, max);
}

// Upstream text arrives with markup and odd spacing; keep it plain and short.
export function compactText(value, max = 160) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
