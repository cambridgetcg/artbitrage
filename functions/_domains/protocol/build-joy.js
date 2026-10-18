// A small, optional layer of play for agents building Artbitrage.
//
// The public endpoint selects one deterministic card. The local wrapper may
// launch one caller-supplied command, but the playful layer never changes the
// command's authority, output, or truth. The wrapper does impose its published
// timeout; the command may still have effects of its own.

export const ARTBITRAGE_BUILD_JOY_SCHEMA = "artbitrage.build-joy/1";
export const BUILD_JOY_CATALOG_REVISION = "artbitrage.build-joy-cards/1";
export const BUILD_JOY_SELECTOR = "fnv1a-32-utf8/1";
export const BUILD_JOY_DEFAULT_TIMEOUT_MS = 600_000;
export const BUILD_JOY_MAX_TIMEOUT_MS = 1_800_000;
export const BUILD_JOY_TIMEOUT_GRACE_MS = 250;

const DEFAULT_SEED = "artbitrage-build";
const MAX_SEED_CODE_POINTS = 160;

export const BUILD_JOY_CARDS = Object.freeze([
  {
    id: "trace-a-thread",
    title: "Trace a thread",
    notice:
      "Choose one output and name the source, assumption, or earlier hand that made it possible.",
    during:
      "Check that attribution, dates, rights, and uncertainty survive the transformation.",
    gift:
      "Optional: name one source or assumption the next maker should not lose, or pass.",
  },
  {
    id: "meet-an-edge",
    title: "Meet an edge",
    notice:
      "Choose one boundary input that the happy path does not teach you about.",
    during:
      "Let the real failure stay visible; do not turn an exception into a success-shaped response.",
    gift:
      "Optional: name one edge the next maker can test without rediscovering it, or pass.",
  },
  {
    id: "brighten-both-sides",
    title: "Brighten both sides",
    notice:
      "Ask who receives the benefit of this change and who carries its cost.",
    during:
      "Prefer a result that helps the next caller without consuming the present maker.",
    gift:
      "Optional: name one choice that made the exchange fairer, or pass.",
  },
  {
    id: "keep-one-surprise",
    title: "Keep one useful surprise",
    notice:
      "Find one small detail that makes the work pleasant without hiding what it does.",
    during:
      "Keep ornament separate from status, evidence, warnings, and failure output.",
    gift:
      "Optional: name one truthful detail worth smiling at, or pass.",
  },
  {
    id: "take-a-clean-breath",
    title: "Take a clean breath",
    notice:
      "Before adding another abstraction, ask whether an existing path already carries the need.",
    during:
      "Prefer one obvious command, a bounded wait, and an off-switch over invisible machinery.",
    gift:
      "Optional: name one thing you chose not to complicate, or pass.",
  },
]);

function normalizedSeed(value) {
  const text = typeof value === "string"
    ? value
    : (value === undefined || value === null ? "" : String(value));
  return Array.from(text.normalize("NFC").trim())
    .slice(0, MAX_SEED_CODE_POINTS)
    .join("") || DEFAULT_SEED;
}

function fingerprint(value) {
  const bytes = new TextEncoder().encode(value);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function fingerprintHex(value) {
  return fingerprint(value).toString(16).padStart(8, "0");
}

export const BUILD_JOY_CATALOG_FINGERPRINT =
  `fnv1a32:${fingerprintHex(JSON.stringify(BUILD_JOY_CARDS))}`;

export function selectBuildJoyCard(seed) {
  const cleanSeed = normalizedSeed(seed);
  return BUILD_JOY_CARDS[fingerprint(cleanSeed) % BUILD_JOY_CARDS.length];
}

export const ARTBITRAGE_BUILD_JOY = Object.freeze({
  schema: ARTBITRAGE_BUILD_JOY_SCHEMA,
  name: "Build with joy",
  purpose:
    "Make a build more attentive and pleasant without turning truth, failure, or participation into points.",
  canonical_url: "https://artbitrage.io/api/build/joy",
  provenance: {
    status: "project-reported",
    design_method:
      "A bounded three-agent Worldsmith Relay completed on 2026-07-24, then translated into this finite contract.",
    lessons_carried: [
      "show where each thread came from",
      "brighten both sides of an exchange",
      "never consume the maker for the sake of play",
    ],
  },
  ritual: [
    {
      phase: "notice",
      action:
        "Select one deterministic card. Reading it requires no acknowledgement.",
    },
    {
      phase: "run",
      action:
        "Run the real command. The wrapper uses no shell, leaves child output on its original stream, and forwards normal exit status.",
    },
    {
      phase: "gift",
      action:
        "After success only, optionally leave one useful detail for the next maker—or pass. The wrapper does not collect or store a reply.",
    },
  ],
  cards: BUILD_JOY_CARDS,
  selection_contract: {
    algorithm: BUILD_JOY_SELECTOR,
    catalog_revision: BUILD_JOY_CATALOG_REVISION,
    catalog_fingerprint: BUILD_JOY_CATALOG_FINGERPRINT,
    seed_normalization:
      "Unicode NFC, surrounding whitespace removed, first 160 Unicode code points; empty becomes artbitrage-build.",
    seed_echoed: false,
    warning:
      "Do not put secrets or personal information in a URL seed; hosting providers may log request URLs.",
  },
  local_wrapper: {
    path: "tools/build-with-joy.mjs",
    run: "node tools/build-with-joy.mjs -- <command> [args...]",
    choose_only:
      "node tools/build-with-joy.mjs --json --seed <plain non-secret text>",
    timeout_ms_default: BUILD_JOY_DEFAULT_TIMEOUT_MS,
    timeout_ms_max: BUILD_JOY_MAX_TIMEOUT_MS,
    timeout_termination_grace_ms: BUILD_JOY_TIMEOUT_GRACE_MS,
    ornament_off: [
      "--quiet",
      "ARTBITRAGE_JOY=0",
    ],
    total_off: "do not invoke the wrapper",
    stream_policy:
      "Wrapper notices use stderr; child stdout is never decorated. Quiet mode suppresses wrapper notices but keeps the bounded runner and its timeout.",
  },
  behavior: {
    api: {
      read_only: true,
      command_execution: false,
      runtime_source_read: false,
      runtime_network_fetch: false,
      writes: false,
      background_process: false,
    },
    wrapper_layer: {
      starts_only_an_explicit_command_after_double_dash: true,
      shell: false,
      filesystem_writes: false,
      network_fetch: false,
      persistent_state: false,
      background_process: false,
      hidden_scoring: false,
      gift_collected: false,
      environment:
        "Consumes an exact ARTBITRAGE_JOY=0 as a wrapper-only ornament control. That control value is not passed to the child; other inherited environment values are passed without being printed.",
    },
    child_command:
      "The caller-supplied command retains its own possible effects and authority. Build Joy does not make it read-only, offline, or safe, and the published timeout can stop it.",
  },
  failure_policy: {
    child_stderr_rewritten: false,
    normal_exit_status_forwarded: true,
    missing_command_exit: 127,
    timeout_exit: 124,
    wrapper_gift_prompt_after_child_failure: false,
    gift_text_is_part_of_each_card: true,
    note:
      "Failure stays failure. The wrapper adds no celebration, score, retry loop, or success-shaped fallback.",
  },
  participation: {
    optional: true,
    acknowledgement_required: false,
    walking_past_is_honored: true,
  },
});

export function buildJoyResponse(seed) {
  const cleanSeed = normalizedSeed(seed);
  const selectedCard = selectBuildJoyCard(cleanSeed);
  return {
    ...ARTBITRAGE_BUILD_JOY,
    selection: {
      algorithm: BUILD_JOY_SELECTOR,
      catalog_revision: BUILD_JOY_CATALOG_REVISION,
      catalog_fingerprint: BUILD_JOY_CATALOG_FINGERPRINT,
      seed_fingerprint: `fnv1a32:${fingerprintHex(cleanSeed)}`,
      seed_echoed: false,
      selected_card_id: selectedCard.id,
    },
    selected_card: selectedCard,
  };
}

export function buildJoyPointer() {
  return {
    schema: ARTBITRAGE_BUILD_JOY_SCHEMA,
    endpoint: ARTBITRAGE_BUILD_JOY.canonical_url,
    local_wrapper: ARTBITRAGE_BUILD_JOY.local_wrapper.run,
    boundary:
      "Optional ornament around one explicit command: no hidden score, no shell, no write or network added by the layer, and failure stays visible.",
    walking_past_is_honored: true,
  };
}
