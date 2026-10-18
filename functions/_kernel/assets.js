// Static data ships with the deploy and is read through env.ASSETS. A
// deployment's assets never change under a running isolate, so a successful
// parse may be kept for the isolate's life.

const memo = new Map();

export async function readJsonAsset(env, request, path, { keep = false } = {}) {
  if (keep && memo.has(path)) return memo.get(path);
  try {
    const res = await env.ASSETS.fetch(new URL(path, request.url));
    if (!res.ok) return null;
    const data = await res.json();
    if (keep) memo.set(path, data);
    return data;
  } catch (e) {
    return null;
  }
}
