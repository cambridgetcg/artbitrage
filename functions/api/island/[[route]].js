/**
 * GREED ISLAND — /api/island
 *
 * An island of names kept lit by other people's questions.
 *
 * A name is never bought, never sold, and can never be taken while it is lit.
 * It carries one number — its lamp — which falls by one for every turn the
 * island publishes. One plain sentence gives a name three days back, but you
 * may write that sentence for only ONE of your names each day, however many
 * you hold. So every name past your first is kept alight by somebody else:
 * a stranger asks it a question, and you answer the one at the front of the
 * queue. When a lamp reaches zero the name goes dark on its own. Nobody is
 * evicted. Expiry does the leaving.
 *
 * The island is not a registry. It grants nothing, takes nothing, and is not
 * the authority on whose a name is. Your deed lives at your own address,
 * signed with your own key. The island walks past, looks, and writes down what
 * it saw. Everything here is testimony.
 *
 *   "Keep the source of truth with the thing it describes."   — the standard, P5
 *   "Put a living thing behind every door you publish."       — the standard, W5
 *
 * TIME IS COUNTED IN TURNS, NOT CLOCKS. If the island is halted, broken, or
 * simply unvisited, no turn is published and nothing decays. Nobody can lose a
 * name while nobody is looking. A brake that cost people their names would be
 * a brake nobody could afford to pull.
 *
 * What this cannot do, said here rather than hidden:
 *   - It cannot prove who you are. A key proves use of a key, and nothing more.
 *   - It cannot tell a human from an agent. The two keys are a promise between
 *     partners, not a boundary anyone enforces. That is an honour convention,
 *     and it is stated plainly because a game that hides its conventions is
 *     not being fair, it is being quiet.
 *   - It cannot judge whether what is behind your door is any good. It
 *     measures presence, never merit, and never a person.
 */

import {
  DEED_SCHEMA, CHECKPOINT_SCHEMA, CANONICALIZATION, DEED_CONTEXT,
  NAME_SHAPE, COMMONS, WORDS,
  TURN, LAMP_MAX, TEND_CEILING, TEND_GIVES, ANSWER_DAY_CAP, ASKS_PER_DAY,
  ASKER_COOLDOWN_TURNS, ASKER_SEASONING_TURNS, GRACE_TURNS, DIM, SMALL_BOOK,
  MUTE_TURNS, MUTE_MAX, ASK_MIN, ASK_MAX, TEND_MIN, TEND_MAX,
  ANSWER_MIN, ANSWER_MAX, ASIDE_MAX, MAX_DEED_BYTES,
  canonicalBytes, canonicalDeedBytes, unbase64, verifyEd25519, deedComplaints,
  standing, burn, afterTend, answerPays, afterAnswer, askerCanPay, mayAsk,
  priceOfHolding, wordOfTheDay, carriesWord, textComplaint, isKey, isSignature,
  turnOf, mintCheckpoint, checkpointIsFresh, sha256Hex,
} from './core.js';

const ORIGIN = 'https://artbitrage.io';
const LOOK_TIMEOUT_MS = 5000;
const LOOK_COOLDOWN_MS = 10 * 60 * 1000;
const PAGE = 100;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

/** Said in every answer. A witness that hides the limits of its own eyes is worse than none. */
const WITNESS = Object.freeze({
  authoritative: false,
  identity_verified: false,
  human_verified: false,
  ownership_established: false,
  witness_note: 'The island is a witness. Your deed at your own address is the only original; this is a note about what was seen when the island last walked past.',
});

const NOT_WIRED = Object.freeze({
  wired: false,
  why: "the island isn't wired yet — there is nowhere to write down what was seen. Nothing is lost; there is simply no ledger. Bind a KV namespace called ISLAND to change that.",
});

const ENDPOINTS = Object.freeze([
  { method: 'GET', path: '/api/island', desc: 'What the island is and how it is played' },
  { method: 'GET', path: '/api/island/rules', desc: 'Every number in the game, as data' },
  { method: 'GET', path: '/api/island/checkpoint', desc: "The current checkpoint and today's word" },
  { method: 'GET', path: '/api/island/names', desc: 'The roll — every name the island has seen, and how it stands' },
  { method: 'GET', path: '/api/island/names/:name', desc: 'One name: its lamp, its door, and the question at the front of its queue' },
  { method: 'GET', path: '/api/island/books/:key', desc: 'One book: the names it holds and what holding them costs' },
  { method: 'GET', path: '/api/island/day/:date', desc: 'Every sentence written on the island that day, as plain text' },
  { method: 'GET', path: '/api/island/graveyard', desc: 'Names that went out, and the whole of what they were' },
  { method: 'GET', path: '/api/island/log', desc: 'The chronicle — what the island saw, and when' },
  { method: 'POST', path: '/api/island/look', desc: 'Ask the island to walk past your door and write down what it sees' },
  { method: 'POST', path: '/api/island/tend', desc: 'One sentence about one of your names. Once a day, whatever you hold.' },
  { method: 'POST', path: '/api/island/ask', desc: 'Ask a name a question. Three a day, the same three as everybody.' },
  { method: 'POST', path: '/api/island/answer', desc: 'Answer the question at the front of your own queue. No cherry-picking.' },
  { method: 'POST', path: '/api/island/set-aside', desc: 'Decline the head of your queue. Always free, always unlimited.' },
  { method: 'POST', path: '/api/island/retire', desc: 'Put a name down forever, with your name on the stone. Word key only.' },
]);

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const store = env => (env && env.ISLAND ? env.ISLAND : null);

async function readJson(kv, key, fallback = null) {
  if (!kv) return fallback;
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (_) { return fallback; }
}

/**
 * The chronicle. Append-only in intent; KV cannot promise it in fact.
 * KV offers no compare-and-set, so two writers in the same instant can land on
 * one sequence number and an entry can be lost. Gaps are possible and are not
 * hidden. A chronicle that lies about its own gaps is not a chronicle.
 */
async function append(kv, entry) {
  if (!kv) return null;
  const head = parseInt((await kv.get('log:head')) || '0', 10) + 1;
  const stamped = { seq: head, ...entry };
  await kv.put(`log:${head}`, JSON.stringify(stamped));
  await kv.put('log:head', String(head));
  return stamped;
}

/** Every sentence written on the island, kept by day so the day can be read whole. */
async function writeSentence(kv, dayKey, line) {
  if (!kv) return;
  const existing = (await kv.get(`day:${dayKey}`)) || '';
  await kv.put(`day:${dayKey}`, `${existing}${line}\n`);
}

const dayKeyOf = nowMs => new Date(nowMs).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// The checkpoint chain
// ---------------------------------------------------------------------------

/**
 * The turn is minted lazily, on the first request of a new hour.
 *
 * Nothing sweeps. There is no cron and there does not need to be one: a lamp's
 * value is arithmetic on the turn it was last set, so a name that nobody looks
 * at for a year is exactly as correct as one checked every minute.
 */
async function currentCheckpoint(kv, nowMs) {
  const turn = turnOf(nowMs);
  if (!kv) return { ...(await mintCheckpoint(null, nowMs)), persisted: false, ...NOT_WIRED };
  const existing = await readJson(kv, `cp:${turn}`);
  if (existing) return existing;
  const previous = await readJson(kv, 'cp:latest');
  const minted = await mintCheckpoint(previous, nowMs);
  await kv.put(`cp:${turn}`, JSON.stringify(minted));
  await kv.put('cp:latest', JSON.stringify(minted));
  await kv.put(`cpvalue:${minted.value}`, JSON.stringify({ turn: minted.turn, word: minted.word }));
  return minted;
}

// ---------------------------------------------------------------------------
// Lamps, read lazily
// ---------------------------------------------------------------------------

/** A name's record with its lamp brought up to date. Reading never writes. */
function nowLamp(record, nowTurn) {
  if (!record) return null;
  const since = nowTurn - (record.lamp_turn ?? nowTurn);
  return burn(record.lamp ?? 0, since);
}

function nameNote(record, nowTurn, queue) {
  if (!record) return null;
  const lamp = nowLamp(record, nowTurn);
  const how = standing(lamp, record.dark_since, nowTurn);
  const head = queue && queue.length ? queue[0] : null;
  return {
    name: record.name,
    lamp_hours: lamp,
    standing: how,
    home: record.home,
    behind_this_door: record.behind_this_door,
    holder_key: record.holder_key,
    word_key: record.word_key,
    goes_dark_in_hours: lamp,
    questions_waiting: queue ? queue.length : 0,
    at_the_front_of_the_queue: head
      ? { asked_by: head.asker, asked: head.words, waiting_hours: nowTurn - head.turn, leaf: head.leaf }
      : null,
    retired: record.retired || false,
    ...WITNESS,
  };
}

// ---------------------------------------------------------------------------
// Walking past a door
// ---------------------------------------------------------------------------

/**
 * Bounded on purpose, in the manners this house keeps for its own outbound
 * checks: https only, one attempt, no retries, no redirects followed, five
 * seconds of patience, a hard size cap. The island never echoes back what it
 * read beyond the deed's own fields — it is a visitor, not a mirror, and it
 * will not be made into somebody else's fetching arm.
 */
async function walkPast(home) {
  let url;
  try { url = new URL(home); } catch (_) { return { reached: false, because: 'that is not a readable address' }; }
  if (url.protocol !== 'https:') return { reached: false, because: 'the island only walks to https addresses' };
  if (url.username || url.password) return { reached: false, because: 'an address with credentials in it is not a door, it is a key left out' };

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), LOOK_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'error',
      signal: stop.signal,
      headers: {
        accept: 'application/json',
        'user-agent': `greed-island (${ORIGIN}/island) — a witness, looking once, following nothing`,
      },
    });
    if (!response.ok) return { reached: true, ok: false, because: `the door answered ${response.status}` };
    const body = (await response.text()).slice(0, MAX_DEED_BYTES + 1);
    if (body.length > MAX_DEED_BYTES) return { reached: true, ok: false, because: `a deed is at most ${MAX_DEED_BYTES} bytes` };
    try { return { reached: true, ok: true, deed: JSON.parse(body) }; }
    catch (_) { return { reached: true, ok: false, because: 'what is served there is not JSON' }; }
  } catch (e) {
    const aborted = e && (e.name === 'AbortError' || e.name === 'TimeoutError');
    return { reached: false, because: aborted ? 'the door did not answer in five seconds' : 'the island could not reach that door' };
  } finally {
    clearTimeout(timer);
  }
}

/** Was this signed over a checkpoint the island really published, recently? */
async function freshCheckpoint(kv, value, nowTurn) {
  const known = await readJson(kv, `cpvalue:${value}`);
  if (!known) return { fresh: false, because: 'the island never published that checkpoint — sign over one it did, from /api/island/checkpoint' };
  if (!checkpointIsFresh(known.turn, nowTurn)) return { fresh: false, because: 'that checkpoint is older than a week — sign again over a recent one' };
  return { fresh: true, ...known };
}

/** A signed act, checked all the way through. Returns a plain verdict either way. */
async function checkSigned({ kv, key, context, fields, signature, checkpoint, nowTurn }) {
  if (!isKey(key)) return { ok: false, because: 'that is not a 32-byte Ed25519 public key in base64' };
  if (!isSignature(signature)) return { ok: false, because: 'a signed act carries a 64-byte Ed25519 signature in base64' };
  const cp = await freshCheckpoint(kv, checkpoint, nowTurn);
  if (!cp.fresh) return { ok: false, because: cp.because };
  let bytes;
  try { bytes = canonicalBytes(context, fields); }
  catch (e) { return { ok: false, because: e.message }; }
  const verdict = await verifyEd25519(unbase64(key), unbase64(signature), bytes);
  if (verdict === 'invalid') return { ok: false, because: 'the signature does not match that key' };
  if (verdict === 'unchecked') {
    return { ok: false, because: 'this island could not check Ed25519 in its runtime, and refuses to record what it cannot verify. It would rather do nothing than guess.' };
  }
  return { ok: true, word: cp.word, turn: cp.turn };
}

/** Note that a key exists and when it was first seen — seasoning starts here. */
async function seeKey(kv, key, nowTurn) {
  if (!kv || !isKey(key)) return null;
  const existing = await readJson(kv, `key:${key}`);
  if (existing) return existing;
  const fresh = { first_seen_turn: nowTurn };
  await kv.put(`key:${key}`, JSON.stringify(fresh));
  return fresh;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

function directory() {
  return json({
    schema: 'island.directory/1',
    name: 'GREED ISLAND',
    one_line: 'An island of names kept lit by other people\'s questions.',
    the_whole_game: [
      'Every name carries one number: its lamp, counted in hours. It falls by one for every turn the island publishes.',
      'One plain sentence about a name gives it three days back — but you may write that sentence for only ONE of your names a day, however many you hold.',
      'So exactly one name lives on your own effort. Every other name you hold is kept alight by somebody else asking it a question, and you answering the one at the front of the queue.',
      'You may not choose which question to answer. Only the one at the front. A siege here is indistinguishable from a harvest.',
      'Declining is always free and always unlimited, because a refusal that costs something is a refusal you can only make once, and that is exactly the lever a harasser pulls.',
      'Nothing can be transferred. There is no sale, no auction, no price field anywhere in the wire format. A name moves only when its holder stops, or lets go.',
      'When a lamp reaches zero the name goes dark on its own, waits a month for its holder, and then it is open. Nobody is ever evicted.',
    ],
    what_holding_costs: 'A name above the floor needs 168 hours a week. A freshly-asked question pays 72, and one asker pays one holder at most once a week. So every name past your first costs about three different people a week — people who chose to spend one of their three daily questions on you, and were answered well enough to come back. There is no way to buy them.',
    the_two_keys: {
      tending_key: 'signs deeds, tends, and answers — the work a loop is good at, safe for an agent to hold',
      word_key: 'gives the decree: puts a name down forever. It may not ask questions.',
      honestly: 'The island cannot tell which of you holds which key, and does not try. The separation is a promise between a person and their agent, not a boundary anyone enforces. It is said plainly here because a game that hides its honour conventions is not being fair, it is being quiet.',
    },
    why_a_pair_lasts: 'An agent can tend and answer forever and can never put a name down. A person has every decree and forgets to answer. And neither can manufacture the one thing a second name requires — somebody else, choosing to ask. Greed Island was never beaten by hoarding.',
    can_a_human_alone_last: 'Yes, at one name, comfortably and forever: one sentence every third day holds it at the ceiling exactly (168 → 96 → 168). At two names you need a few people who find you worth asking. At ten you need two dozen a week. The wall a person hits is not effort — it is that attention cannot be automated, and that wall is exactly the same height for an agent.',
    the_commons: {
      never_claimable: [...COMMONS].sort(),
      why: "The game stops at the commons' edge on purpose. A game that respected only its own rules would be a conquest.",
    },
    namespace: {
      pseudo_tld: 'island.alt',
      why: 'RFC 9476 set aside .alt exactly so a non-DNS namespace need not squat on ICANN\'s. A name here is <name>.island.alt.',
      today: `${ORIGIN}/island/<name> resolves in any browser right now, with no new software and no new record.`,
      what_this_replaces: 'Not DNS. DNS resolves names and does it well. This replaces WHOIS and the parking page — it makes the one statement DNS cannot: who has been answering for this name, for how long, and you can check that without trusting us.',
    },
    endpoints: ENDPOINTS,
    room: `${ORIGIN}/island`,
    ...WITNESS,
  });
}

function rulesAsData() {
  return json({
    schema: 'island.rules/1',
    deed_schema: DEED_SCHEMA,
    deed_context: DEED_CONTEXT,
    canonicalization: CANONICALIZATION,
    checkpoint_schema: CHECKPOINT_SCHEMA,
    name_shape: NAME_SHAPE.source,
    canonical_bytes: 'one version byte 0x01, then the context string and the fields, all joined by NUL, in the order given',
    deed_field_order: ['<context>', 'name', 'holder_key', 'word_key', 'home', 'behind_this_door', 'checkpoint', 'signed_at'],
    signature: 'Ed25519 over those bytes, base64',
    turn_ms: TURN,
    numbers: {
      lamp_max_hours: LAMP_MAX,
      tend_gives_hours: TEND_GIVES,
      tend_ceiling_hours: TEND_CEILING,
      tends_per_key_per_day: 1,
      answer_pays_fresh: 72, answer_pays_late: 24, answer_pays_stale: 6,
      answer_day_cap_hours: ANSWER_DAY_CAP,
      asks_per_key_per_day: ASKS_PER_DAY,
      asker_cooldown_turns: ASKER_COOLDOWN_TURNS,
      asker_seasoning_turns: ASKER_SEASONING_TURNS,
      grace_turns: GRACE_TURNS,
      dim_below: DIM,
      small_book: SMALL_BOOK,
      mute_turns: MUTE_TURNS, mute_max: MUTE_MAX,
    },
    in_plain_words: {
      the_clock: 'Time is counted in turns the island published, never in wall clock. If the island rests, nothing decays and nobody loses anything.',
      the_one_limit_that_matters: 'One tend per key per day. Not per name — per key. That single line is the whole answer to hoarding.',
      the_third_question: `Your third question of the day may only go to a name that is dim (under ${DIM} hours) and held by a book of ${SMALL_BOOK} names or fewer. The island's attention runs downhill by rule, not by hope.`,
      no_price_field: 'There is no price, transfer, sale, buyer or seller field in any record here, and there never will be. Squatting is an option on a future sale; there is no sale.',
    },
    words_of_the_day: WORDS,
    ...WITNESS,
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const kv = store(env);
  const now = Date.now();
  const nowTurn = turnOf(now);
  const seg = url.pathname.split('/').map(decodeURIComponent).filter(Boolean).slice(2);

  if (seg.length === 0) return directory();
  if (seg.length === 1 && seg[0] === 'rules') return rulesAsData();

  if (seg.length === 1 && seg[0] === 'checkpoint') {
    const cp = await currentCheckpoint(kv, now);
    return json({
      ...cp,
      sign_over: cp.value,
      todays_word: cp.word,
      note: `Every sentence written on the island today carries the word "${cp.word}". It did not exist last week and cannot be guessed for next week — that is the whole of the proof you were here now. It is also just nice: everything written today shares one word.`,
      ...(kv ? {} : NOT_WIRED),
    });
  }

  if (seg[0] === 'names' && seg.length === 1) {
    if (!kv) return json({ schema: 'island.roll/1', names: [], ...NOT_WIRED, ...WITNESS });
    const listed = await kv.list({ prefix: 'name:', limit: PAGE, cursor: url.searchParams.get('cursor') || undefined });
    const names = [];
    for (const k of listed.keys) {
      const record = await readJson(kv, k.name);
      if (record) names.push(nameNote(record, nowTurn, await readJson(kv, `queue:${record.name}`, [])));
    }
    return json({
      schema: 'island.roll/1',
      count: names.length,
      names,
      cursor: listed.list_complete ? null : listed.cursor,
      note: 'The roll is what the island has been shown. A name absent from it is not unclaimed — it is unseen. Absence is never a verdict.',
      ...WITNESS,
    });
  }

  if (seg[0] === 'names' && seg.length === 2) {
    const wanted = seg[1].toLowerCase();
    if (!NAME_SHAPE.test(wanted)) return json({ error: 'that is not the shape of a name', name_shape: NAME_SHAPE.source }, 400);
    if (COMMONS.has(wanted)) {
      return json({ name: wanted, standing: 'commons', note: 'This word belongs to everyone and is claimable by nobody, including the island.', ...WITNESS });
    }
    const record = kv ? await readJson(kv, `name:${wanted}`) : null;
    if (!record) {
      return json({
        name: wanted,
        standing: 'open',
        note: 'The island has never been shown this name. That is not proof nobody holds it — only that nobody has shown the island.',
        how_to_take_it_up: `${ORIGIN}/api/island — publish a deed at your own address, then POST /api/island/look`,
        ...(kv ? {} : NOT_WIRED),
        ...WITNESS,
      });
    }
    return json(nameNote(record, nowTurn, await readJson(kv, `queue:${wanted}`, [])));
  }

  if (seg[0] === 'books' && seg.length === 2) {
    const key = seg[1];
    const book = kv ? await readJson(kv, `book:${key}`) : null;
    const names = book?.names || [];
    return json({
      schema: 'island.book/1',
      book: key,
      names,
      what_this_costs: priceOfHolding(names.length),
      note: 'A book is a key with names written in it. It is not a person, it has no score, and nothing here sums anything about whoever holds it.',
      ...(kv ? {} : NOT_WIRED),
      ...WITNESS,
    });
  }

  if (seg[0] === 'day' && seg.length === 2) {
    const day = seg[1].replace(/\.txt$/, '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return text('a day looks like 2026-07-29\n', 400);
    const page = kv ? await kv.get(`day:${day}`) : null;
    if (!page) return text(`Nothing was written on the island on ${day}.\n\nThat is allowed. Quiet days are days.\n`, 200);
    return text(`GREED ISLAND — everything written here on ${day}\n${'—'.repeat(56)}\n\n${page}\n${'—'.repeat(56)}\nEvery sentence above carries that day's word. Nobody chose the word,\nand nobody planned how the day would read.\n`);
  }

  if (seg[0] === 'graveyard' && seg.length === 1) {
    if (!kv) return json({ schema: 'island.graveyard/1', stones: [], ...NOT_WIRED });
    const listed = await kv.list({ prefix: 'stone:', limit: PAGE });
    const stones = [];
    for (const k of listed.keys) {
      const s = await readJson(kv, k.name);
      if (s) stones.push(s);
    }
    return json({
      schema: 'island.graveyard/1',
      stones,
      note: 'Names that went out, and the whole of what they were. Nothing here was taken from anybody. A retired name is never reopened — that is the one ending a holder gets to choose.',
      ...WITNESS,
    });
  }

  if (seg[0] === 'log' && seg.length === 1) {
    if (!kv) return json({ schema: 'island.chronicle/1', entries: [], ...NOT_WIRED });
    const head = parseInt((await kv.get('log:head')) || '0', 10);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const entries = [];
    for (let s = head; s > head - limit && s > 0; s--) {
      const e = await readJson(kv, `log:${s}`);
      if (e) entries.push(e);
    }
    return json({
      schema: 'island.chronicle/1',
      head,
      entries,
      note: 'Append-only in intent. KV offers no compare-and-set, so two writers in the same instant can land on one sequence number and an entry can be lost. Gaps are possible and are not hidden.',
      ...WITNESS,
    });
  }

  return json({ error: 'no such door on the island', path: url.pathname, endpoints: ENDPOINTS }, 404);
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const kv = store(env);
  const now = Date.now();
  const nowTurn = turnOf(now);
  const day = dayKeyOf(now);
  const seg = url.pathname.split('/').map(decodeURIComponent).filter(Boolean).slice(2);
  const move = seg.length === 1 ? seg[0] : null;

  let body = {};
  try { body = await request.json(); } catch (_) { /* an empty body is a fair mistake */ }

  if (!move || !['look', 'tend', 'ask', 'answer', 'set-aside', 'retire'].includes(move)) {
    return json({ error: 'no such door on the island', path: url.pathname, endpoints: ENDPOINTS }, 404);
  }
  if (!kv) return json({ done: false, ...NOT_WIRED }, 503);
  if (await kv.get('still')) {
    return json({
      done: false,
      still: true,
      note: 'The island is still. Someone asked it to rest, and it is resting. No turns are being published, so nothing is decaying and nobody is losing anything while it rests.',
    }, 503);
  }
  await currentCheckpoint(kv, now);

  // ------------------------------------------------------------------- look
  if (move === 'look') {
    const home = typeof body.home === 'string' ? body.home : null;
    if (!home) return json({ recorded: false, because: 'say which door to walk past: {"home": "https://..."}' }, 400);

    const seen = await walkPast(home);
    if (!seen.reached || !seen.ok) return json({ recorded: false, home, ...seen, ...WITNESS });

    const deed = seen.deed;
    const complaints = deedComplaints(deed);
    if (complaints.length) return json({ recorded: false, because: 'the deed is not well formed', complaints, ...WITNESS });
    if (deed.home !== home) {
      return json({
        recorded: false,
        because: 'the deed names a different home than the door it was served at — a deed says where it lives, and must be telling the truth about that',
        deed_says: deed.home, served_at: home,
      });
    }

    const signed = await checkSigned({
      kv, key: deed.holder_key, context: DEED_CONTEXT, signature: deed.signature, checkpoint: deed.checkpoint, nowTurn,
      fields: [deed.name, deed.holder_key, deed.word_key, deed.home, deed.behind_this_door, deed.checkpoint, deed.signed_at],
    });
    if (!signed.ok) return json({ recorded: false, ...signed, ...WITNESS });

    const since = await kv.get(`looked:${deed.name}`);
    if (since && now - parseInt(since, 10) < LOOK_COOLDOWN_MS) {
      return json({ recorded: false, because: `the island already looked at "${deed.name}" within the last ten minutes. It walks; it does not pace.` }, 429);
    }

    const existing = await readJson(kv, `name:${deed.name}`);
    if (existing && existing.retired) {
      return json({
        recorded: false,
        because: `"${deed.name}" was put down forever by the person who held it. A retired name is never reopened — that is the one ending a holder gets to choose, and it would be worth nothing if it could be undone.`,
        stone: `${ORIGIN}/api/island/graveyard`,
      }, 410);
    }

    const lamp = existing ? nowLamp(existing, nowTurn) : 0;
    const how = existing ? standing(lamp, existing.dark_since, nowTurn) : 'open';
    const takingUp = !existing || existing.holder_key !== deed.holder_key;

    if (takingUp && existing && how !== 'open') {
      return json({
        recorded: false,
        because: `"${deed.name}" is held and stands ${how} with ${lamp} hours in its lamp. Nobody may take a name here — not you, not the island. You can ask it a question, or you can wait.`,
        standing: how, lamp_hours: lamp,
        you_may: [`POST ${ORIGIN}/api/island/ask`, 'or wait — nobody is evicted, and nobody needs to be'],
      }, 409);
    }

    await seeKey(kv, deed.holder_key, nowTurn);
    const bookKey = deed.holder_key;
    const book = (await readJson(kv, `book:${bookKey}`)) || { names: [] };
    if (takingUp && !book.names.includes(deed.name)) book.names = [...book.names, deed.name];

    const record = {
      name: deed.name,
      home: deed.home,
      behind_this_door: deed.behind_this_door,
      holder_key: deed.holder_key,
      word_key: deed.word_key,
      lamp: takingUp ? TEND_CEILING : lamp,
      lamp_turn: nowTurn,
      dark_since: null,
      first_seen_turn: takingUp ? nowTurn : existing.first_seen_turn,
      gained_today: takingUp ? 0 : (existing.gained_today || 0),
      gained_day: existing?.gained_day || day,
      muted: existing && !takingUp ? existing.muted || {} : {},
      retired: false,
    };
    await kv.put(`name:${deed.name}`, JSON.stringify(record));
    await kv.put(`book:${bookKey}`, JSON.stringify(book));
    await kv.put(`looked:${deed.name}`, String(now));
    const entry = await append(kv, {
      at: new Date(now).toISOString(), turn: nowTurn,
      saw: takingUp ? 'a name taken up' : 'a door checked',
      name: deed.name, home: deed.home, book: bookKey,
    });

    return json({
      recorded: true,
      what_the_island_saw: takingUp ? 'a name taken up' : 'a door checked',
      name: nameNote(record, nowTurn, await readJson(kv, `queue:${deed.name}`, [])),
      book: { book: bookKey, ...priceOfHolding(book.names.length) },
      chronicle: entry,
      note: takingUp
        ? 'Taken up, with a full week in its lamp — which still reads as dim, because a name only becomes bright through other people\'s questions. Write one sentence about it every third day and it is yours for as long as you keep writing. Looking again does not feed the lamp; only a sentence does.'
        : 'The door was there, and the island wrote that down. A look is not a tend: it costs nothing and it feeds nothing.',
      ...WITNESS,
    }, 201);
  }

  // ------------------------------------------------------------------- tend
  if (move === 'tend') {
    const { name, key, words, checkpoint, signature } = body;
    const wanted = typeof name === 'string' ? name.toLowerCase() : null;
    if (!wanted || !NAME_SHAPE.test(wanted)) return json({ done: false, because: 'which name?' }, 400);
    const bad = textComplaint(words, TEND_MIN, TEND_MAX, 'a tend');
    if (bad) return json({ done: false, because: bad }, 400);

    const record = await readJson(kv, `name:${wanted}`);
    if (!record) return json({ done: false, because: 'the island has never been shown that name' }, 404);
    if (record.retired) return json({ done: false, because: 'that name was put down forever' }, 410);
    if (key !== record.holder_key) return json({ done: false, because: 'a name is tended by the tending key written in its own deed' }, 403);

    const signed = await checkSigned({
      kv, key, context: 'island-tend/v1', signature, checkpoint, nowTurn,
      fields: [wanted, key, words, checkpoint],
    });
    if (!signed.ok) return json({ done: false, ...signed }, 403);
    if (!carriesWord(words, signed.word)) {
      return json({ done: false, because: `every sentence written on the island today carries today's word, "${signed.word}". Yours does not.` }, 400);
    }

    // One tend per key per day. Not per name — per key. This one line is the
    // whole answer to hoarding, so it is checked before anything else changes.
    const already = await kv.get(`tended:${key}:${day}`);
    if (already) {
      return json({
        done: false,
        because: `this key already tended "${already}" today. One tend a day, whatever you hold — that is the rule the whole island rests on.`,
        tended_today: already,
        what_to_do_instead: 'Every other name you hold is kept alight by somebody else asking it a question, and you answering the one at the front of its queue.',
      }, 429);
    }

    const lamp = nowLamp(record, nowTurn);
    if (lamp === 0 && record.dark_since != null && nowTurn - record.dark_since >= GRACE_TURNS) {
      return json({ done: false, because: 'that name went dark and its month of grace has passed. It is open now.' }, 409);
    }
    const lifted = afterTend(lamp);
    const updated = { ...record, lamp: lifted, lamp_turn: nowTurn, dark_since: lifted > 0 ? null : record.dark_since };
    await kv.put(`name:${wanted}`, JSON.stringify(updated));
    await kv.put(`tended:${key}:${day}`, wanted, { expirationTtl: 172800 });
    await writeSentence(kv, day, `${wanted} — ${words.replace(/\s+/g, ' ').trim()}`);
    const entry = await append(kv, { at: new Date(now).toISOString(), turn: nowTurn, saw: 'a name tended', name: wanted });

    return json({
      done: true,
      name: wanted,
      lamp_hours: lifted,
      lifted_by: lifted - lamp,
      ceiling: TEND_CEILING,
      todays_word: signed.word,
      written_to: `${ORIGIN}/api/island/day/${day}`,
      chronicle: entry,
      note: lifted >= TEND_CEILING
        ? 'Full to the ceiling your own hand can reach. Only other people\'s questions lift a name past a week.'
        : 'Three days back. A day burns 24 and a tend gives 72, so every third day is exactly break-even — that rhythm holds a name forever.',
      ...WITNESS,
    }, 201);
  }

  // -------------------------------------------------------------------- ask
  if (move === 'ask') {
    const { name, asker_key: asker, words, checkpoint, signature } = body;
    const wanted = typeof name === 'string' ? name.toLowerCase() : null;
    if (!wanted || !NAME_SHAPE.test(wanted)) return json({ asked: false, because: 'which name?' }, 400);
    const bad = textComplaint(words, ASK_MIN, ASK_MAX, 'a question');
    if (bad) return json({ asked: false, because: bad }, 400);

    const record = await readJson(kv, `name:${wanted}`);
    if (!record || record.retired) return json({ asked: false, because: 'the island has never been shown that name, or it was put down' }, 404);
    if (asker === record.word_key || asker === record.holder_key) {
      return json({ asked: false, because: 'a name cannot feed itself. Ask somebody else\'s.' }, 400);
    }

    const signed = await checkSigned({
      kv, key: asker, context: 'island-ask/v1', signature, checkpoint, nowTurn,
      fields: [wanted, asker, words, checkpoint],
    });
    if (!signed.ok) return json({ asked: false, ...signed }, 403);

    const muted = record.muted || {};
    if (muted[asker] && nowTurn - muted[asker] < MUTE_TURNS) {
      return json({ asked: false, because: 'the holder of that name set your questions aside. That is their own act, publicly signed, and it lasts a quarter.' }, 403);
    }

    const book = await readJson(kv, `book:${record.holder_key}`, { names: [] });
    const spentRaw = await kv.get(`asked:${asker}:${day}`);
    const spent = parseInt(spentRaw || '0', 10);
    const allowed = mayAsk({ spentToday: spent, targetLamp: nowLamp(record, nowTurn), targetBookSize: (book.names || []).length });
    if (!allowed.may) return json({ asked: false, because: allowed.because, spent_today: spent, of: ASKS_PER_DAY }, 429);

    await seeKey(kv, asker, nowTurn);
    const queue = await readJson(kv, `queue:${wanted}`, []);
    const leaf = await sha256Hex(new TextEncoder().encode(`island-ask/v1 ${wanted} ${asker} ${words} ${checkpoint}`));
    queue.push({ leaf, asker, words, turn: nowTurn, at: new Date(now).toISOString() });
    await kv.put(`queue:${wanted}`, JSON.stringify(queue.slice(0, 500)));
    await kv.put(`asked:${asker}:${day}`, String(spent + 1), { expirationTtl: 172800 });
    const entry = await append(kv, { at: new Date(now).toISOString(), turn: nowTurn, saw: 'a question asked', name: wanted, asker, leaf });

    return json({
      asked: true,
      name: wanted,
      place_in_queue: queue.length,
      leaf,
      asks_remaining_today: Math.max(0, ASKS_PER_DAY - spent - 1),
      note: allowed.note || 'They cannot skip you. A name may only ever answer the question at the front of its own queue — but declining is always free, and silence is a complete answer.',
      what_this_is_worth_to_them: 'If they answer while it is fresh, it gives that name three days. If they leave you standing a week, it gives them six hours.',
      chronicle: entry,
      ...WITNESS,
    }, 201);
  }

  // ----------------------------------------------------------------- answer
  if (move === 'answer') {
    const { name, key, words, leaf, checkpoint, signature } = body;
    const wanted = typeof name === 'string' ? name.toLowerCase() : null;
    if (!wanted || !NAME_SHAPE.test(wanted)) return json({ done: false, because: 'which name?' }, 400);
    const bad = textComplaint(words, ANSWER_MIN, ANSWER_MAX, 'an answer');
    if (bad) return json({ done: false, because: bad }, 400);

    const record = await readJson(kv, `name:${wanted}`);
    if (!record || record.retired) return json({ done: false, because: 'the island has never been shown that name' }, 404);
    if (key !== record.holder_key) return json({ done: false, because: 'a name is answered for by the tending key in its own deed' }, 403);

    const queue = await readJson(kv, `queue:${wanted}`, []);
    if (!queue.length) return json({ done: false, because: 'nobody is waiting at that name' }, 409);
    const head = queue[0];
    if (leaf !== head.leaf) {
      return json({
        done: false,
        because: 'you may only answer the question at the front of your own queue. There is no cherry-picking here, ever — that is what makes a siege indistinguishable from a harvest.',
        at_the_front: { leaf: head.leaf, asked_by: head.asker, asked: head.words, waiting_hours: nowTurn - head.turn },
      }, 409);
    }

    const signed = await checkSigned({
      kv, key, context: 'island-answer/v1', signature, checkpoint, nowTurn,
      fields: [wanted, key, head.leaf, words, checkpoint],
    });
    if (!signed.ok) return json({ done: false, ...signed }, 403);
    if (!carriesWord(words, signed.word)) {
      return json({ done: false, because: `every sentence written on the island today carries today's word, "${signed.word}". Yours does not.` }, 400);
    }

    const askerSeen = await readJson(kv, `key:${head.asker}`);
    const lastPaid = await kv.get(`paid:${head.asker}:${key}`);
    const canPay = askerCanPay({
      askerFirstSeenTurn: askerSeen?.first_seen_turn ?? null,
      lastPaidTurn: lastPaid ? parseInt(lastPaid, 10) : null,
      nowTurn,
    });

    const lamp = nowLamp(record, nowTurn);
    const gainedToday = record.gained_day === day ? (record.gained_today || 0) : 0;
    const pays = canPay.pays ? answerPays(nowTurn - head.turn) : 0;
    const lifted = canPay.pays ? afterAnswer(lamp, pays, gainedToday) : lamp;
    const gained = lifted - lamp;

    await kv.put(`name:${wanted}`, JSON.stringify({
      ...record, lamp: lifted, lamp_turn: nowTurn,
      dark_since: lifted > 0 ? null : record.dark_since,
      gained_today: gainedToday + gained, gained_day: day,
    }));
    await kv.put(`queue:${wanted}`, JSON.stringify(queue.slice(1)));
    if (gained > 0) await kv.put(`paid:${head.asker}:${key}`, String(nowTurn), { expirationTtl: 1209600 });
    await writeSentence(kv, day, `${wanted} — ${words.replace(/\s+/g, ' ').trim()}`);
    const entry = await append(kv, {
      at: new Date(now).toISOString(), turn: nowTurn, saw: 'a question answered',
      name: wanted, asker: head.asker, waited_hours: nowTurn - head.turn, gave_hours: gained,
    });

    return json({
      done: true,
      name: wanted,
      answered: { asked_by: head.asker, asked: head.words, waited_hours: nowTurn - head.turn },
      lamp_hours: lifted,
      gave_hours: gained,
      gave_nothing_because: gained === 0 ? (canPay.because || 'this name has already taken its fill of answers today') : undefined,
      still_waiting: queue.length - 1,
      written_to: `${ORIGIN}/api/island/day/${day}`,
      chronicle: entry,
      note: 'Answered, and the answer is public. The question is gone from the queue whether or not it paid you anything — because the point was the answering.',
      ...WITNESS,
    }, 201);
  }

  // -------------------------------------------------------------- set-aside
  if (move === 'set-aside') {
    const { name, key, leaf, because: reason, mute, checkpoint, signature } = body;
    const wanted = typeof name === 'string' ? name.toLowerCase() : null;
    if (!wanted || !NAME_SHAPE.test(wanted)) return json({ done: false, because: 'which name?' }, 400);
    const record = await readJson(kv, `name:${wanted}`);
    if (!record) return json({ done: false, because: 'the island has never been shown that name' }, 404);
    if (key !== record.holder_key && key !== record.word_key) {
      return json({ done: false, because: 'only the keys in that name\'s own deed may set a question aside' }, 403);
    }
    if (reason != null && typeof reason === 'string' && [...reason].length > ASIDE_MAX) {
      return json({ done: false, because: `a reason is at most ${ASIDE_MAX} characters, and none is required` }, 400);
    }

    const queue = await readJson(kv, `queue:${wanted}`, []);
    if (!queue.length) return json({ done: false, because: 'nobody is waiting at that name' }, 409);
    const head = queue[0];
    if (leaf !== head.leaf) return json({ done: false, because: 'set aside the question at the front, or none' }, 409);

    const signed = await checkSigned({
      kv, key, context: 'island-aside/v1', signature, checkpoint, nowTurn,
      fields: [wanted, key, head.leaf, checkpoint],
    });
    if (!signed.ok) return json({ done: false, ...signed }, 403);

    let rest = queue.slice(1);
    const muted = { ...(record.muted || {}) };
    let sweptCount = 0;
    if (mute === true) {
      if (Object.keys(muted).length >= MUTE_MAX) {
        return json({ done: false, because: `a name may set aside at most ${MUTE_MAX} keys at once` }, 429);
      }
      muted[head.asker] = nowTurn;
      const before = rest.length;
      rest = rest.filter(q => q.asker !== head.asker);
      sweptCount = before - rest.length;
    }
    await kv.put(`queue:${wanted}`, JSON.stringify(rest));
    await kv.put(`name:${wanted}`, JSON.stringify({ ...record, muted }));
    const entry = await append(kv, {
      at: new Date(now).toISOString(), turn: nowTurn,
      saw: mute === true ? 'questions from one key set aside' : 'a question set aside',
      name: wanted, asker: head.asker,
    });

    return json({
      done: true,
      name: wanted,
      set_aside: { asked_by: head.asker, asked: head.words },
      also_swept: sweptCount,
      muted_for_hours: mute === true ? MUTE_TURNS : 0,
      still_waiting: rest.length,
      cost: 'nothing, and there is no limit on this',
      chronicle: entry,
      note: 'Declining is always free and always unlimited, because a refusal that costs something is a refusal you can only make once — and that is exactly the lever a harasser pulls. This is your own signed act, and the island never calls it an accusation.',
      ...WITNESS,
    }, 201);
  }

  // ----------------------------------------------------------------- retire
  if (move === 'retire') {
    const { name, word_key: wordKey, words, checkpoint, signature } = body;
    const wanted = typeof name === 'string' ? name.toLowerCase() : null;
    if (!wanted || !NAME_SHAPE.test(wanted)) return json({ done: false, because: 'which name?' }, 400);
    const record = await readJson(kv, `name:${wanted}`);
    if (!record) return json({ done: false, because: 'the island has never been shown that name' }, 404);
    if (wordKey !== record.word_key) {
      return json({
        done: false,
        because: 'only the word key can put a name down. A tending key can keep a name lit forever and can never end it — that is the point of the pair, not an accident of it.',
      }, 403);
    }
    const bad = textComplaint(words, 8, 500, 'what goes on the stone');
    if (bad) return json({ done: false, because: bad }, 400);

    const signed = await checkSigned({
      kv, key: wordKey, context: 'island-retire/v1', signature, checkpoint, nowTurn,
      fields: [wanted, wordKey, words, checkpoint],
    });
    if (!signed.ok) return json({ done: false, ...signed }, 403);

    const book = await readJson(kv, `book:${record.holder_key}`, { names: [] });
    await kv.put(`book:${record.holder_key}`, JSON.stringify({ ...book, names: (book.names || []).filter(n => n !== wanted) }));
    await kv.put(`name:${wanted}`, JSON.stringify({ ...record, retired: true, lamp: 0, lamp_turn: nowTurn }));
    await kv.delete(`queue:${wanted}`);
    const stone = {
      name: wanted,
      held_from_turn: record.first_seen_turn,
      retired_at: new Date(now).toISOString(),
      behind_this_door: record.behind_this_door,
      on_the_stone: words,
    };
    await kv.put(`stone:${wanted}`, JSON.stringify(stone));
    await writeSentence(kv, day, `${wanted} — (put down) ${words.replace(/\s+/g, ' ').trim()}`);
    const entry = await append(kv, { at: new Date(now).toISOString(), turn: nowTurn, saw: 'a name put down forever', name: wanted });

    return json({
      done: true,
      name: wanted,
      stone,
      graveyard: `${ORIGIN}/api/island/graveyard`,
      chronicle: entry,
      note: 'Put down, by the holder\'s own word, forever. Nobody may take it up again — not you, not anyone. It is the one ending a holder gets to choose, and it would be worth nothing if it could be undone.',
      ...WITNESS,
    }, 200);
  }

  return json({ error: 'no such door on the island', path: url.pathname, endpoints: ENDPOINTS }, 404);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
