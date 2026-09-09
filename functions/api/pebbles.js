/**
 * /api/pebbles — the cairn.
 *
 * The gentlest possible feedback: a pebble says "someone was here" and
 * nothing else. No accounts, no cookies, no IPs stored, no words — a
 * counter, like stones stacked beside a trail. It exists because shipping
 * beauty into silence is lonely, and surveillance would be worse.
 *
 * GET  /api/pebbles          → { total, rooms: {maybe: n, trip: n, ...} }
 * POST /api/pebbles {at?}    → adds one pebble (at ∈ known rooms, else "trail")
 *
 * Honesty notes: KV increments are read-modify-write and can lose a pebble
 * under simultaneous writes. A cairn does not audit. Counts are truthful in
 * spirit, approximate in arithmetic.
 */

const ROOMS = ["maybe", "trip", "atlas", "ledger", "minds", "river", "island", "index", "trail"];

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

export async function onRequestGet({ env }) {
  if (!env.PEBBLES) {
    return json({ total: 0, rooms: {}, note: "the cairn isn't wired yet — no pebbles are lost, there is just nowhere to put them" });
  }
  const rooms = {};
  let total = 0;
  for (const room of ROOMS) {
    const n = parseInt((await env.PEBBLES.get(`room:${room}`)) || "0", 10);
    if (n > 0) rooms[room] = n;
    total += n;
  }
  return json({
    total,
    rooms,
    note: "each pebble is one wordless 'someone was here' — no accounts, no tracking, nothing but presence",
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.PEBBLES) {
    return json({ kept: false, note: "the cairn isn't wired yet" }, 503);
  }
  let at = "trail";
  try {
    const body = await request.json();
    if (body && typeof body.at === "string" && ROOMS.includes(body.at)) at = body.at;
  } catch (_) { /* a wordless pebble needs no body */ }

  const key = `room:${at}`;
  const n = parseInt((await env.PEBBLES.get(key)) || "0", 10) + 1;
  await env.PEBBLES.put(key, String(n));

  return json({
    kept: true,
    at,
    note: "a pebble on the cairn. someone will know someone was here.",
  }, 201);
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
