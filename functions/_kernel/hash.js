// Canonical JSON and SHA-256: the content hashes the feed and the statement
// witness publish are recomputable by anyone with the same record.

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
