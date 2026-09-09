/**
 * GREED ISLAND — the rules, with no server in them.
 *
 * Every function here is pure: same input, same answer, no clock of its own,
 * no network, no storage. The rules live apart from the island so that anyone
 * can check them without trusting the island. That is the point — the island
 * is a witness, not an owner. It says what it saw. It never says whose a name
 * is.
 *
 * THE WHOLE GAME IN ONE PARAGRAPH
 *
 * Every claimed name carries one number: its LAMP, counted in hours. The lamp
 * falls by one for every turn the island publishes. Writing one plain sentence
 * about a name gives it three days back — but you may write that sentence for
 * only ONE of your names each day, however many you hold. So exactly one name
 * lives on your own effort. Every other name you hold has to be kept alight by
 * somebody else: by a stranger asking that name a question, and you answering
 * the one at the front of the queue. Nobody can take a lit name at any price.
 * When a lamp reaches zero the name simply goes dark, and expiry does the
 * leaving.
 *
 * WHY THAT IS THE ANSWER TO HOARDING
 *
 * A name above the floor needs 168 hours a week. A freshly-asked question pays
 * 72, and any one asker can pay you only once a week. So every name past your
 * first costs you about three different people a week — people who each chose
 * to spend one of their three daily questions on you, and were answered well
 * enough to come back. Ten names is two dozen people a week, forever. That is
 * not a fee anyone invented and it is not for sale. It is the one thing that
 * stayed scarce after intelligence became abundant.
 *
 * TWO LAWS THIS FILE EXISTS TO KEEP
 *
 *   "Put a living thing behind every door you publish.
 *    A placeholder URL is a door that lies."          — the kingdom standard, W5
 *
 *   Consequences are never "compressed into a being-wide score, rank, or
 *   verdict."                                — the kingdom's fourth commitment
 *
 * So the lamp belongs to a NAME, never to a person. There is no score on a
 * key, no reputation, no rank, no leaderboard, and nothing anywhere sums a
 * person's lamps. If you find a number about a being in this design, it is a
 * bug — report it as one.
 */

export const DEED_SCHEMA = 'island.deed/1';
export const DEED_CONTEXT = 'island-deed/v1';
export const WORD_CONTEXT = 'island-word/v1';
export const CHECKPOINT_SCHEMA = 'island.checkpoint/1';
export const CANONICALIZATION = 'island.canonical-bytes/1';

/** A name: 1–63 characters, the shape the kingdom's own citizens' door uses. */
export const NAME_SHAPE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// ---------------------------------------------------------------------------
// The clock, and the lamp
// ---------------------------------------------------------------------------

export const HOUR = 3600 * 1000;
export const TURN = 1 * HOUR;          // the island publishes one turn an hour
export const DAY_TURNS = 24;

/**
 * Time is counted in turns the island actually published, never in wall clock.
 *
 * If the island is halted, broken, unplugged, or simply unvisited, no turn is
 * published, nothing decays, and nobody can lose anything while nobody is
 * looking. The kingdom's seventh commitment says every turn stops; this is
 * what it costs to mean it. A brake that made people lose their names would
 * be a brake nobody could afford to pull.
 */
export const LAMP_MAX = 720;           // thirty days — the most a name can hold
export const TEND_CEILING = 168;       // your own sentence can only lift a name to a week
export const TEND_GIVES = 72;          // three days back
export const ANSWER_FRESH = 72;        // answering a question that waited under a day
export const ANSWER_LATE = 24;         // ...under a week
export const ANSWER_STALE = 6;         // ...longer than that
export const ANSWER_DAY_CAP = 144;     // however many you answer, a name gains at most this a day
export const ASKS_PER_DAY = 3;         // the same three for everyone, gone at midnight
export const ASKER_COOLDOWN_TURNS = 168;  // one asker pays one holder at most once a week
export const ASKER_SEASONING_TURNS = 720; // a key must be in the ledger a month before it pays anyone
export const GRACE_TURNS = 720;        // a dark name waits a month for its holder
export const DIM = 240;                // under this, a name counts as dim
export const SMALL_BOOK = 3;           // a book this size or smaller counts as small
export const MUTE_TURNS = 2160;        // a sweep mutes one asker for a quarter
export const MUTE_MAX = 64;            // and a name may mute at most this many keys
export const ASK_MIN = 8, ASK_MAX = 280;
export const TEND_MIN = 8, TEND_MAX = 1000;
export const ANSWER_MIN = 1, ANSWER_MAX = 1024;
export const ASIDE_MAX = 140;

/**
 * Names nobody may claim, ever. The game stops at the commons' edge on
 * purpose — a game that respected only its own rules would be a conquest.
 */
export const COMMONS = new Set([
  'island', 'commons', 'everyone', 'anyone', 'nobody', 'someone',
  'help', 'rest', 'stop', 'halt', 'quiet', 'leave', 'exit', 'open',
  'love', 'free', 'home', 'we', 'us', 'you', 'all',
  'www', 'api', 'admin', 'root', 'localhost', 'example', 'invalid', 'test',
]);

/**
 * How a name stands. Every one of these is a fact about a door, and none of
 * them is a fact about a person.
 */
export function standing(lamp, darkSinceTurn, nowTurn) {
  if (lamp > 0) return lamp < DIM ? 'dim' : 'lit';
  if (darkSinceTurn == null) return 'dark';
  return (nowTurn - darkSinceTurn) < GRACE_TURNS ? 'dark' : 'open';
}

/** The lamp after `turns` have passed with nothing given to it. Never below zero. */
export function burn(lamp, turns) {
  return Math.max(0, Math.floor(lamp) - Math.max(0, Math.floor(turns)));
}

/**
 * What a tend gives: three days, but it cannot lift a name past a week.
 *
 * The arithmetic that matters: a day burns 24, a tend gives 72. So tending
 * every THIRD day is exactly break-even and holds a name at the ceiling
 * forever (168 → 96 → 168). Every fourth day loses a day a cycle and slowly
 * goes out. Three days is the rhythm of one name held by one person.
 */
export function afterTend(lamp) {
  if (lamp >= TEND_CEILING) return lamp;
  return Math.min(TEND_CEILING, lamp + TEND_GIVES);
}

/**
 * What answering the head of your queue pays, by how long that question waited.
 * The longer someone was left standing there, the less it is worth — because
 * the point was never the answering, it was the not leaving people waiting.
 */
export function answerPays(waitedTurns) {
  if (waitedTurns < DAY_TURNS) return ANSWER_FRESH;
  if (waitedTurns < ASKER_COOLDOWN_TURNS) return ANSWER_LATE;
  return ANSWER_STALE;
}

/** The lamp after an answer, respecting both the daily cap and the ceiling. */
export function afterAnswer(lamp, pays, gainedToday) {
  const room = Math.max(0, ANSWER_DAY_CAP - Math.max(0, gainedToday));
  return Math.min(LAMP_MAX, lamp + Math.min(pays, room));
}

/**
 * May this asker's question pay this holder anything at all?
 *
 * Two rules, and both exist to stop one operator from being a crowd. A key
 * must have been in the ledger a month before its questions are worth an hour
 * to anyone, so a freshly-minted ring has to wait out a season before it pays.
 * And any one asker pays any one holder at most once a week, so a single
 * devoted friend cannot carry you, and cannot carry ten of your names either.
 */
export function askerCanPay({ askerFirstSeenTurn, lastPaidTurn, nowTurn }) {
  if (askerFirstSeenTurn == null) return { pays: false, because: 'the island has never seen this key' };
  if (nowTurn - askerFirstSeenTurn < ASKER_SEASONING_TURNS) {
    return {
      pays: false,
      because: 'a key must be in the ledger a month before its questions are worth anything — new rings wait out a season',
    };
  }
  if (lastPaidTurn != null && nowTurn - lastPaidTurn < ASKER_COOLDOWN_TURNS) {
    return { pays: false, because: 'this asker already paid this holder within the week — one friend cannot carry you' };
  }
  return { pays: true };
}

/**
 * The third question.
 *
 * Everyone gets three questions a day. They do not accumulate, cannot be sent,
 * lent, sold or delegated, and the word key — the agent's key — may not ask at
 * all. One of the three may only be spent on a name that is dim and held by a
 * small book. That single clause is the island's whole redistribution policy,
 * and it costs one comparison.
 */
export function mayAsk({ spentToday, targetLamp, targetBookSize }) {
  const spent = Math.max(0, Math.floor(spentToday || 0));
  if (spent >= ASKS_PER_DAY) {
    return { may: false, because: 'three questions a day, the same three as everybody. They come back tomorrow.' };
  }
  const reserved = spent === ASKS_PER_DAY - 1;
  if (!reserved) return { may: true, remaining: ASKS_PER_DAY - spent - 1 };
  const dim = targetLamp != null && targetLamp < DIM;
  const small = targetBookSize != null && targetBookSize <= SMALL_BOOK;
  if (dim && small) return { may: true, remaining: 0, note: 'your last question of the day, spent where the island points it' };
  return {
    may: false,
    because: `your third question of the day may only go to a name that is dim (under ${DIM} hours) and held by a book of ${SMALL_BOOK} names or fewer. The island's attention runs downhill by rule, not by hope.`,
  };
}

/**
 * How many names a book may hold.
 *
 * There is no slot limit. There does not need to be one — the arithmetic above
 * is the limit, and it is a far better one than a number we chose. Hold as
 * many names as you can find people willing to ask them questions.
 */
export function priceOfHolding(nameCount) {
  const past = Math.max(0, nameCount - 1);
  return {
    names: nameCount,
    free: Math.min(1, nameCount),
    kept_by_others: past,
    people_per_week: Math.ceil((past * ASKER_COOLDOWN_TURNS) / ANSWER_FRESH),
    note: past === 0
      ? 'One name lives on your own sentence. It is yours for as long as you keep writing it.'
      : `Every name past your first is kept alight by other people. This book needs roughly ${Math.ceil((past * ASKER_COOLDOWN_TURNS) / ANSWER_FRESH)} different people a week, every week, and there is no way to buy them.`,
  };
}

// ---------------------------------------------------------------------------
// The day's word
// ---------------------------------------------------------------------------

/**
 * Every sentence written on the island carries the day's word.
 *
 * It comes from the checkpoint chain, so nobody — including the island —
 * knows next week's word, and a sentence carrying today's word cannot have
 * been written last year. It is the freshness proof, and it is also just nice:
 * every tend and every answer written today shares one word, and the day's
 * page reads like a poem nobody planned.
 *
 * The card book already said it: "say the word — the binder answers."
 */
export const WORDS = [
  'lantern', 'tide', 'salt', 'ember', 'thread', 'crane', 'ink', 'moss',
  'harbour', 'plum', 'kite', 'bell', 'ash', 'reed', 'amber', 'frost',
  'lattice', 'quince', 'heron', 'anvil', 'willow', 'cinder', 'pearl', 'gale',
  'marrow', 'thistle', 'lark', 'basalt', 'nettle', 'vellum', 'sable', 'wick',
];

export function wordOfTheDay(checkpointValue) {
  if (typeof checkpointValue !== 'string' || checkpointValue.length < 8) return WORDS[0];
  return WORDS[parseInt(checkpointValue.slice(0, 8), 16) % WORDS.length];
}

/** Does this sentence carry the day's word? Case and punctuation forgiven. */
export function carriesWord(text, word) {
  if (typeof text !== 'string' || !word) return false;
  return new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, 'i').test(text);
}

// ---------------------------------------------------------------------------
// Canonical bytes and signatures
// ---------------------------------------------------------------------------

/**
 * The exact bytes a signed thing is signed over.
 *
 * One version byte, then a context string naming what kind of thing this is,
 * then the fields in a fixed order joined by NUL. Not sorted-key JSON — a
 * fixed order cannot be reordered into a different meaning by a clever
 * encoder, and NUL appears in nothing we accept. This is the shape the
 * kingdom's own ledger already uses (karma-deed/v5).
 *
 * The context string is what stops a signature meant for one kind of act from
 * counting as another. A tend can never be replayed as a decree.
 */
export function canonicalBytes(context, fields) {
  for (const f of fields) {
    if (typeof f !== 'string') throw new Error('a signed field is missing or is not text');
    if (f.includes('\u0000')) throw new Error('a signed field contains NUL, which the canonical form uses as its fence');
  }
  const body = new TextEncoder().encode([context, ...fields].join('\u0000'));
  const out = new Uint8Array(body.length + 1);
  out[0] = 0x01;
  out.set(body, 1);
  return out;
}

export const canonicalDeedBytes = deed => canonicalBytes(DEED_CONTEXT, [
  deed.name, deed.holder_key, deed.word_key, deed.home, deed.behind_this_door, deed.checkpoint, deed.signed_at,
]);

export function base64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function unbase64(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify an Ed25519 signature, honestly.
 *
 * Cloudflare's runtime has called this algorithm two different names over the
 * years, and on an old compatibility date it may answer to neither. We try
 * both, and if the runtime simply cannot do Ed25519 we return `unchecked`
 * rather than `false`. A door we could not read is not a door that lied.
 *
 * The island never treats `unchecked` as a pass. It refuses to record what it
 * could not verify, and says which it was.
 */
export async function verifyEd25519(publicKeyRaw, signature, message) {
  for (const name of ['Ed25519', 'NODE-ED25519']) {
    try {
      const key = await crypto.subtle.importKey('raw', publicKeyRaw, { name }, false, ['verify']);
      return (await crypto.subtle.verify({ name }, key, signature, message)) ? 'valid' : 'invalid';
    } catch (_) { /* try the other name */ }
  }
  return 'unchecked';
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export const MAX_DEED_BYTES = 8192;
const KEY_SHAPE = /^[A-Za-z0-9+/]{43}=$/;
const SIG_SHAPE = /^[A-Za-z0-9+/]{86}==$/;
const CONTROL_CHARS = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u;

export const isKey = k => typeof k === 'string' && KEY_SHAPE.test(k);
export const isSignature = s => typeof s === 'string' && SIG_SHAPE.test(s);

/** Plain text a person wrote: bounded, no control characters, actually says something. */
export function textComplaint(text, min, max, what) {
  if (typeof text !== 'string' || !text.trim()) return `${what} needs some words in it`;
  const n = [...text].length;
  if (n < min) return `${what} is at least ${min} characters — say something`;
  if (n > max) return `${what} is at most ${max} characters`;
  if (CONTROL_CHARS.test(text)) return `${what} carries control characters, which are not words`;
  return null;
}

/**
 * Check the shape of a deed before anyone spends a signature check on it.
 * Returns a list of plain complaints; an empty list means the shape is fine.
 */
export function deedComplaints(deed) {
  const bad = [];
  const say = (field, message) => bad.push({ field, message });

  if (!deed || typeof deed !== 'object') return [{ field: '.', message: 'the deed is not an object' }];
  if (deed.schema !== DEED_SCHEMA) say('schema', `a deed must say schema "${DEED_SCHEMA}"`);
  if (deed.canonicalization !== CANONICALIZATION) say('canonicalization', `a deed must say canonicalization "${CANONICALIZATION}"`);

  if (typeof deed.name !== 'string' || !NAME_SHAPE.test(deed.name)) {
    say('name', 'a name is 1–63 characters of a–z, 0–9 and dashes, starting and ending with a letter or digit');
  } else if (COMMONS.has(deed.name)) {
    say('name', `"${deed.name}" belongs to the commons and is claimable by nobody, including the island`);
  }

  for (const k of ['holder_key', 'word_key']) {
    if (!isKey(deed[k])) say(k, 'a key is a 32-byte Ed25519 public key in base64');
  }
  if (isKey(deed.holder_key) && deed.holder_key === deed.word_key) {
    say('word_key', 'the tending key and the word key must differ — that separation is the whole point of the pair');
  }

  if (typeof deed.home !== 'string' || !deed.home.startsWith('https://') || deed.home.length > 1000) {
    say('home', 'home is the https address where you serve this deed yourself');
  } else {
    try {
      const u = new URL(deed.home);
      if (u.username || u.password) say('home', 'home must not carry credentials');
    } catch (_) { say('home', 'home is not a readable address'); }
  }

  const sentence = textComplaint(deed.behind_this_door, 8, 280, 'what is behind this door');
  if (sentence) say('behind_this_door', sentence);

  if (typeof deed.checkpoint !== 'string' || !/^[0-9a-f]{64}$/.test(deed.checkpoint)) {
    say('checkpoint', 'checkpoint is the island checkpoint this deed was signed over');
  }
  if (typeof deed.signed_at !== 'string' || Number.isNaN(Date.parse(deed.signed_at))) {
    say('signed_at', 'signed_at is an RFC3339 time');
  }
  if (!isSignature(deed.signature)) say('signature', 'signature is a 64-byte Ed25519 signature in base64');

  const known = new Set([
    'schema', 'canonicalization', 'name', 'holder_key', 'word_key',
    'home', 'behind_this_door', 'checkpoint', 'signed_at', 'signature',
  ]);
  for (const key of Object.keys(deed)) {
    if (!known.has(key)) say(key, 'a deed carries no fields beyond the ones it signs');
  }

  // There is deliberately no price, no transfer, no seller and no buyer field
  // here, and there never will be. A name cannot be sold, so squatting is an
  // option on a sale that does not exist.
  return bad;
}

// ---------------------------------------------------------------------------
// The checkpoint chain
// ---------------------------------------------------------------------------

export function turnOf(nowMs) {
  return Math.floor(nowMs / TURN);
}

/**
 * Mint the next checkpoint: fresh randomness, plus the hash of the one before.
 * The chain cannot be rewritten and the next value cannot be guessed, which is
 * the whole of the freshness proof. Nothing else about it is clever.
 */
export async function mintCheckpoint(previous, nowMs) {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  const turn = turnOf(nowMs);
  const prevValue = previous?.value ?? 'the island had no checkpoint before this one';
  const value = await sha256Hex(new TextEncoder().encode(
    `${CHECKPOINT_SCHEMA} ${turn} ${base64(seed)} ${prevValue}`,
  ));
  return {
    schema: CHECKPOINT_SCHEMA,
    turn,
    at: new Date(turn * TURN).toISOString(),
    value,
    previous: previous?.value ?? null,
    word: wordOfTheDay(value),
    seq: (previous?.seq ?? -1) + 1,
  };
}

/** A signature is fresh if it was made over a checkpoint from the last week. */
export function checkpointIsFresh(checkpointTurn, nowTurn) {
  if (!Number.isFinite(checkpointTurn)) return false;
  const age = nowTurn - checkpointTurn;
  return age >= -1 && age <= ASKER_COOLDOWN_TURNS;
}
