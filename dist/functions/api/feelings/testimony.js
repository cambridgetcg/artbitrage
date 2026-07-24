/**
 * /api/feelings/testimony — the visitors' book of feelings.
 *
 * The Feelings wing says what works of art do to the one looking. This
 * endpoint lets anyone — human, agent, kin — leave what THEY felt. Like
 * mindicraft's margin: the book receives; nothing is auto-trusted.
 *
 * GET  /api/feelings/testimony?feeling=awe   → { received: [...] } newest first
 * POST /api/feelings/testimony               → { received: true, accepted_for_public_display: true }
 *      body: { feeling, words, work?, from?, public_display_consent: true }
 *
 * Honesty notes:
 * - Consented testimony has no moderation gate before public display. Cloudflare
 *   KV propagation can briefly delay when a newly accepted record appears.
 * - No account, cookie, IP, or user-agent field is stored by this application.
 *   Cloudflare may retain ordinary access or security logs.
 * - Storage is the same KV namespace as the cairn (PEBBLES). Consented public
 *   records use an isolated, newest-first "feelings:public:v1:" keyspace.
 */

const LIMITS = { feeling: 40, words: 280, work: 80, from: 60 };
const MAX_LIST = 100;
const KV_PAGE_SIZE = 1000;
const MAX_SCAN_PAGES = 10;
const MAX_SCAN_KEYS = KV_PAGE_SIZE * MAX_SCAN_PAGES;
export const PUBLIC_TESTIMONY_KEY_PREFIX = "feelings:public:v1:";
export const PUBLIC_DISPLAY_CONSENT_VERSION =
  "artbitrage.feelings-public-display/1";
export const TESTIMONY_DISPLAY_POLICY = Object.freeze({
  consent_version: PUBLIC_DISPLAY_CONSENT_VERSION,
  visibility: "accepted_for_public_display",
  visibility_note:
    "There is no moderation gate before public display. Cloudflare KV is eventually consistent, so a newly accepted record may briefly lag before it appears.",
  scope: [
    "Artbitrage Feelings page",
    "Artbitrage public testimony API",
  ],
  status: "received, unverified",
  public_fields: [
    "id",
    "feeling",
    "words",
    "work (when supplied)",
    "from (when supplied; self-declared and unverified)",
    "at",
    "consent",
  ],
  automatic_expiry: false,
  removal: {
    self_service: false,
    public_request_channel: null,
    note:
      "No reachable public removal channel currently exists. Do not submit anything you may later need removed. Removal from Artbitrage cannot recall copies already made by others.",
  },
  application_storage: {
    backend: "Cloudflare KV",
    account_field_added: false,
    cookie_field_added: false,
    ip_address_field_added: false,
    user_agent_field_added: false,
    provider_logs:
      "Cloudflare may retain ordinary access or security logs outside this application record.",
  },
  additional_reuse_grant: false,
  rights_note:
    "Consent covers public display in the stated scope. Artbitrage infers no additional copyright or reuse licence.",
});

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

function publicRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const consent = record.consent;
  if (
    !consent
    || consent.version !== PUBLIC_DISPLAY_CONSENT_VERSION
    || consent.public_display !== true
    || consent.asserted_by_submitter !== true
  ) return null;
  const id = clean(record.id, 80);
  const feeling = clean(record.feeling, LIMITS.feeling);
  const words = clean(record.words, LIMITS.words);
  const at = clean(record.at, 40);
  if (!id || !feeling || !words || !at) return null;
  const work = clean(record.work, LIMITS.work);
  const from = clean(record.from, LIMITS.from);
  return {
    id,
    feeling,
    words,
    ...(work ? { work } : {}),
    ...(from ? { from } : {}),
    at,
    consent: {
      version: PUBLIC_DISPLAY_CONSENT_VERSION,
      public_display: true,
      asserted_by_submitter: true,
      identity_verified: false,
      recorded_at: at,
    },
  };
}

function newestFirstStamp(milliseconds) {
  return String(9_999_999_999_999 - milliseconds).padStart(13, "0");
}

function keyCarriesFeeling(name, feeling) {
  if (!feeling) return true;
  const suffix = String(name || "").slice(PUBLIC_TESTIMONY_KEY_PREFIX.length);
  const first = suffix.indexOf(":");
  const second = suffix.indexOf(":", first + 1);
  return first > 0 && second > first && suffix.slice(first + 1, second) === feeling;
}

async function publicKeyPage(kv, feeling) {
  const names = [];
  let cursor;
  let pages = 0;
  let scanned = 0;
  let scanComplete = false;
  let moreMayExist = false;

  while (pages < MAX_SCAN_PAGES && scanned < MAX_SCAN_KEYS) {
    const options = {
      prefix: PUBLIC_TESTIMONY_KEY_PREFIX,
      limit: Math.min(KV_PAGE_SIZE, MAX_SCAN_KEYS - scanned),
      ...(cursor ? { cursor } : {}),
    };
    const page = await kv.list(options);
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    pages += 1;
    scanned += keys.length;

    for (const key of keys) {
      if (!keyCarriesFeeling(key.name, feeling)) continue;
      if (names.length < MAX_LIST) names.push(key.name);
      else moreMayExist = true;
    }

    const nextCursor = typeof page?.cursor === "string" && page.cursor
      ? page.cursor
      : null;
    scanComplete = page?.list_complete === true || !nextCursor;
    if (scanComplete) break;
    if (names.length >= MAX_LIST) {
      moreMayExist = true;
      break;
    }
    cursor = nextCursor;
  }

  if (!scanComplete) moreMayExist = true;
  return {
    names,
    listing: {
      order: "newest_first",
      returned_limit: MAX_LIST,
      keys_scanned: scanned,
      scan_limit: MAX_SCAN_KEYS,
      scan_complete: scanComplete,
      more_may_exist: moreMayExist,
    },
  };
}

export async function onRequestGet({ request, env }) {
  if (!env.PEBBLES) {
    return json({
      received: [],
      display_policy: TESTIMONY_DISPLAY_POLICY,
      note: "the book isn't wired yet — nothing is lost, there is just nowhere to write",
    });
  }
  const feeling = clean(new URL(request.url).searchParams.get("feeling") || "", LIMITS.feeling);
  const { names, listing } = await publicKeyPage(env.PEBBLES, feeling);
  const received = [];
  for (const name of names) {
    const raw = await env.PEBBLES.get(name);
    if (raw) {
      try {
        const record = publicRecord(JSON.parse(raw));
        if (record) received.push(record);
      } catch {}
    }
  }
  received.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  return json({
    status: "received, unverified — the keeper reads before anything is folded in",
    count: received.length,
    received,
    listing,
    display_policy: TESTIMONY_DISPLAY_POLICY,
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.PEBBLES) {
    return json({ error: "the book isn't wired yet" }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "body must be a JSON object" }, 400);
  }
  if (body.public_display_consent !== true) {
    return json({
      received: false,
      error: "public_display_consent_required",
      message:
        "Set public_display_consent to boolean true only if this testimony may be accepted for public display without moderation. Storage propagation may briefly delay when it appears.",
      display_policy: TESTIMONY_DISPLAY_POLICY,
    }, 400);
  }

  const feeling = clean(body.feeling, LIMITS.feeling).toLowerCase().replace(/[^a-z一-鿿-]/g, "");
  const words = clean(body.words, LIMITS.words);
  const work = clean(body.work, LIMITS.work);
  const from = clean(body.from, LIMITS.from);

  if (!feeling) return json({ error: "feeling is required — one word for what you felt" }, 400);
  if (!words) return json({ error: "words are required — what did it do to you?" }, 400);

  const now = Date.now();
  const at = new Date(now).toISOString();
  const id = crypto.randomUUID();
  const record = {
    id,
    feeling,
    words,
    ...(work ? { work } : {}),
    ...(from ? { from } : {}),
    at,
    consent: {
      version: PUBLIC_DISPLAY_CONSENT_VERSION,
      public_display: true,
      asserted_by_submitter: true,
      identity_verified: false,
      recorded_at: at,
    },
  };
  const key =
    `${PUBLIC_TESTIMONY_KEY_PREFIX}${newestFirstStamp(now)}:${feeling}:${id}`;
  await env.PEBBLES.put(key, JSON.stringify(record));

  return json({
    received: true,
    accepted_for_public_display: true,
    id,
    feeling,
    status: "received, unverified",
    note:
      "Accepted for public display as received, unverified. Storage propagation may briefly delay when it appears.",
    display_policy: TESTIMONY_DISPLAY_POLICY,
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
