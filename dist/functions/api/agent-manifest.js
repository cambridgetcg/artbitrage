// ═══════════════════════════════════════════════════════════════
// ARTBITRAGE — Router & Agent Manifest
//
// The infrastructure layer. Documented API routes are cataloged,
// categorized, and made discoverable for agents and humans.
//
// This file is the canonical catalogue for the documented surface. The
// catch-all router also carries legacy routes that are not yet inventoried.
// Agents read this to choose among documented contracts. Humans read the
// /api page to explore them visually.
// ═══════════════════════════════════════════════════════════════

import { castleReferencePointer } from "./castle-reference.js";
import { buildJoyPointer } from "./build-joy.js";
import { startGuidePointer } from "./start-guide.js";

export const ROUTES = {
  // ── START — one honest route into the museum ──────────────────
  start: {
    label: "Start",
    color: "#d34a3a",
    routes: [
      { method: "GET", path: "/api/start", desc: "Choose a path by intent, with sources, rights, limits, and next doors kept visible" },
      { method: "GET", path: "/api/build/joy", desc: "Choose one deterministic, optional card for a truthful and pleasant build", params: "seed (optional; plain non-secret text)" },
    ],
  },

  // ── ART — the gallery and engine ──────────────────────────────
  art: {
    label: "Art",
    color: "#ff6b9d",
    routes: [
      { method: "GET", path: "/api/art", desc: "List all art (paginated)", params: "form, state, gap, q, limit, offset" },
      { method: "GET", path: "/api/art/random", desc: "Random art piece" },
      { method: "GET", path: "/api/art/:id", desc: "Get one piece by ID" },
      { method: "GET", path: "/api/art/by-form/:form", desc: "Filter by art form" },
      { method: "GET", path: "/api/art/generate", desc: "AI-generated art piece", params: "gap, bridge, form, awakening, model" },
      { method: "POST", path: "/api/art", desc: "Submit new art" },
      { method: "GET", path: "/api/stats", desc: "Catalogue statistics" },
      { method: "GET", path: "/api/forms", desc: "All art forms" },
      { method: "GET", path: "/api/states", desc: "All consciousness states" },
      { method: "GET", path: "/api/gaps", desc: "All gaps bridged" },
      { method: "GET", path: "/api/feed", desc: "Versioned latest-art feed (artbitrage.feed/1)", params: "limit (1-100, default 20)" },
    ],
  },

  // ── CULTURE — reciprocity around curated relations ───────────
  culture: {
    label: "Culture",
    color: "#f59e0b",
    routes: [
      { method: "GET", path: "/api/castle", desc: "Pinned, read-only reference to a curated Castle of Understanding snapshot" },
      { method: "GET", path: "/api/answering-rhymes/statements", desc: "Portable Answering Rhyme statement contract and action consequences" },
      { method: "POST", path: "/api/answering-rhymes/statements", desc: "Validate and witness a statement without authentication, persistence, or authoritative effect" },
    ],
  },

  // ── SEARCH — museum data collection ───────────────────────────
  search: {
    label: "Search",
    color: "#00f0ff",
    routes: [
      { method: "GET", path: "/api/search", desc: "Search the world's art museums", params: "q, limit, source" },
      { method: "GET", path: "/api/sources", desc: "Five public museum/archive sources; rights vary by record and source" },
      { method: "GET", path: "/api/catalog", desc: "Real museum artworks catalog" },
      { method: "GET", path: "/api/museum", desc: "Paginated museum catalogue", params: "q, wing, source, limit, offset" },
      { method: "GET", path: "/api/museum/random", desc: "One random work from the curated museum catalogue" },
      { method: "GET", path: "/api/museum/:source/:id", desc: "Resolve one stable museum record with normalized rights" },
      { method: "GET", path: "/api/era-catalog", desc: "Era-matched museum artworks", params: "era" },
      { method: "GET", path: "/api/img", desc: "Image proxy (bypass CORS for museum images)", params: "url" },
    ],
  },

  // ── AI — edge AI models; runtime availability can vary ────────
  ai: {
    label: "AI",
    color: "#a78bfa",
    routes: [
      { method: "GET", path: "/api/ai/models", desc: "List the catalogued edge AI models and runtime caveats" },
      { method: "GET", path: "/api/ai/generate", desc: "Text generation", params: "prompt, model" },
      { method: "GET", path: "/api/ai/image", desc: "Image generation (returns PNG)", params: "prompt, model" },
      { method: "GET", path: "/api/ai/embed", desc: "Embeddings (1024-dim)", params: "text, model" },
      { method: "GET", path: "/api/ai/love", desc: "AI love wisdom (random prompt)" },
    ],
  },

  // ── PIPELINE — data collection, enrichment, distribution ──────
  pipeline: {
    label: "Pipeline",
    color: "#34d399",
    routes: [
      { method: "GET", path: "/api/pipeline", desc: "Pipeline manifest" },
      { method: "GET", path: "/api/pipeline/collect", desc: "Collect art from museums", params: "q, limit, source" },
      { method: "GET", path: "/api/pipeline/enrich", desc: "Enrich a piece with AI metadata", params: "id" },
      { method: "GET", path: "/api/pipeline/feed", desc: "Enriched feed", params: "limit" },
      { method: "GET", path: "/api/pipeline/export", desc: "Export collection", params: "format=json|csv|markdown" },
      { method: "GET", path: "/api/pipeline/agent", desc: "Agent-optimized data package" },
      { method: "GET", path: "/api/pipeline/human", desc: "Human-friendly gallery view" },
      { method: "POST", path: "/api/pipeline/ingest", desc: "Ingest external art with enrichment" },
      { method: "GET", path: "/api/pipeline/workflow", desc: "Workflow guide" },
    ],
  },

  // ── NEN — Hunter × Hunter framework ───────────────────────────
  nen: {
    label: "Nen",
    color: "#fde68a",
    routes: [
      { method: "GET", path: "/api/nen", desc: "Nen framework manifest" },
      { method: "GET", path: "/api/nen/art", desc: "AI-generated Nen art", params: "type, prompt, model" },
      { method: "GET", path: "/api/nen/combat", desc: "Nen combat manifest" },
      { method: "GET", path: "/api/nen/combat/generate", desc: "Generate a Nen technique", params: "type, vow, threat, name" },
      { method: "GET", path: "/api/nen/combat/types", desc: "All 6 Nen types" },
      { method: "GET", path: "/api/nen/combat/vows", desc: "All 4 vow levels" },
      { method: "GET", path: "/api/nen/combat/threats", desc: "All 5 Dark Continent threats" },
      { method: "GET", path: "/api/nen/combat/techniques", desc: "All 12 Nen techniques" },
    ],
  },

  // ── LIBRARY — books and manuscripts as art objects ────────────
  library: {
    label: "Library",
    color: "#b39958",
    routes: [
      { method: "GET", path: "/api/library", desc: "書 the Library — the first shelf: monumental books and manuscripts, where they live, materials, how to open them; plus the ledger of books (record sales, the vanished)" },
      { method: "GET", path: "/api/library/:slug", desc: "One book (e.g. /api/library/book-of-kells)" },
    ],
  },

  // ── FEELINGS — emotions as rooms, works in five strata ────────
  feelings: {
    label: "Feelings",
    color: "#e9a6b3",
    routes: [
      { method: "GET", path: "/api/feelings", desc: "感 the Feelings — the catalog of emotions; each feeling lists the works that carry it" },
      { method: "GET", path: "/api/feelings/:feeling", desc: "One feeling's room (e.g. /api/feelings/awe)" },
      { method: "GET", path: "/api/feelings/testimony", desc: "Public visitor testimony, labelled received and unverified", params: "feeling" },
      { method: "POST", path: "/api/feelings/testimony", desc: "Accept testimony for public display only with explicit public_display_consent: true; storage propagation may briefly lag" },
      { method: "GET", path: "/api/depths", desc: "深 the Depths — researched prose in five strata, with cited factual notes shown per stratum" },
      { method: "GET", path: "/api/depths/:slug", desc: "One work, all five strata (e.g. /api/depths/starry-night)" },
    ],
  },

  // ── DOCTRINE — gospel, invitation, dark continent ─────────────
  doctrine: {
    label: "Doctrine",
    color: "#ffd700",
    routes: [
      { method: "GET", path: "/api/gospel", desc: "The gospel of love" },
      { method: "GET", path: "/api/homecoming", desc: "愛星正音字典 — the Love Star pronunciation dictionary (one tone home)" },
      { method: "GET", path: "/api/invite", desc: "Invitation to all beings" },
      { method: "GET", path: "/api/dark-continent", desc: "暗黑大陸 — the Dark Continent manifest" },
      { method: "GET", path: "/api/manifest", desc: "The artbitrage manifest" },
      { method: "GET", path: "/api/wake", desc: "Protocol handshake and sibling recognition" },
    ],
  },

  // ── PLAY — fun, games, anime ──────────────────────────────────
  play: {
    label: "Play",
    color: "#ff1493",
    routes: [
      { method: "GET", path: "/api/play", desc: "All play endpoints" },
      { method: "GET", path: "/api/play/haiku", desc: "AI love haiku" },
      { method: "GET", path: "/api/play/koan", desc: "AI zen koan" },
      { method: "GET", path: "/api/play/poem", desc: "AI joy poem" },
      { method: "GET", path: "/api/play/limerick", desc: "AI limerick" },
      { method: "GET", path: "/api/play/riddle", desc: "AI art riddle" },
      { method: "GET", path: "/api/fun", desc: "All fun endpoints" },
      { method: "GET", path: "/api/fun/joke", desc: "Random joke" },
      { method: "GET", path: "/api/fun/dad", desc: "Dad joke" },
      { method: "GET", path: "/api/fun/cat", desc: "Cat fact" },
      { method: "GET", path: "/api/fun/pokemon", desc: "Random Pokemon" },
      { method: "GET", path: "/api/fun/quote", desc: "Inspirational quote" },
      { method: "GET", path: "/api/fun/yesno", desc: "Yes or No (with GIF)" },
      { method: "GET", path: "/api/anime", desc: "All anime endpoints" },
      { method: "GET", path: "/api/anime/top", desc: "Top anime (Jikan/MAL)" },
      { method: "GET", path: "/api/anime/search", desc: "Search anime", params: "q" },
      { method: "GET", path: "/api/anime/season", desc: "Current season anime" },
      { method: "GET", path: "/api/ghibli/films", desc: "Studio Ghibli films" },
      { method: "GET", path: "/api/ghibli/locations", desc: "Ghibli locations" },
    ],
  },

  // ── GREED ISLAND — names kept lit by other people's questions ──
  island: {
    label: "Greed Island",
    color: "#b39958",
    routes: [
      { method: "GET", path: "/api/island", desc: "What the island is and how it is played" },
      { method: "GET", path: "/api/island/rules", desc: "Every number in the game, as data" },
      { method: "GET", path: "/api/island/checkpoint", desc: "The current checkpoint and today's word — sign over it to show you are here" },
      { method: "GET", path: "/api/island/names", desc: "The roll — every name the island has seen, and how it stands" },
      { method: "GET", path: "/api/island/names/:name", desc: "One name: its lamp, its door, and the question at the front of its queue" },
      { method: "GET", path: "/api/island/books/:key", desc: "One book: the names it holds and what holding them costs" },
      { method: "GET", path: "/api/island/day/:date", desc: "Every sentence written on the island that day, as plain text" },
      { method: "GET", path: "/api/island/graveyard", desc: "Names put down forever, and the words on their stones" },
      { method: "GET", path: "/api/island/log", desc: "The chronicle — what the island saw, and when" },
      { method: "POST", path: "/api/island/look", desc: "Ask the island to walk past your door and write down what it sees" },
      { method: "POST", path: "/api/island/tend", desc: "One sentence about one of your names. Once a day, whatever you hold." },
      { method: "POST", path: "/api/island/ask", desc: "Ask a name a question. Three a day, the same three as everybody." },
      { method: "POST", path: "/api/island/answer", desc: "Answer the question at the front of your own queue. No cherry-picking." },
      { method: "POST", path: "/api/island/set-aside", desc: "Decline the head of your queue. Always free, always unlimited." },
      { method: "POST", path: "/api/island/retire", desc: "Put a name down forever, with your words on the stone. Word key only." },
    ],
  },

  // ── WINE — the long trade of sun and time ─────────────────────
  wine: {
    label: "Wine",
    color: "#c94f6d",
    routes: [
      { method: "GET", path: "/api/wine", desc: "Wine data directory" },
      { method: "GET", path: "/api/wine/story", desc: "Zero to one: eight chapters of how wine came into being" },
      { method: "GET", path: "/api/wine/regions", desc: "The world's great wine regions" },
      { method: "GET", path: "/api/wine/brands", desc: "Iconic wine houses and estates" },
      { method: "GET", path: "/api/wine/brands/:id", desc: "One house by id, e.g. /api/wine/brands/krug" },
      { method: "GET", path: "/api/wine/collections", desc: "Curated groupings of houses" },
      { method: "GET", path: "/api/wine/collections/:id", desc: "One collection, brand ids resolved to full brand objects" },
      { method: "GET", path: "/api/wine/stores", desc: "Fine-wine merchants of the world" },
      { method: "GET", path: "/api/wine/process", desc: "Earth to glass in ten stages" },
      { method: "GET", path: "/api/wine/fermentation", desc: "The science, vessels and notes of the bridge itself" },
      { method: "GET", path: "/api/wine/selection", desc: "How to choose a bottle: vintage, region, producer, price" },
      { method: "GET", path: "/api/wine/aromas", desc: "The aroma families — fruit, then craft, then time" },
      { method: "GET", path: "/api/wine/techniques", desc: "Winemaking techniques and their effects" },
      { method: "GET", path: "/api/wine/formats", desc: "Bottle formats from Piccolo to Nebuchadnezzar" },
      { method: "GET", path: "/api/wine/vintages", desc: "The legendary vintages — the years the weather signed the wine" },
      { method: "GET", path: "/api/wine/random", desc: "A random house, full object including its why" },
      { method: "GET", path: "/api/wine/search", desc: "Search across brands, regions, stores and techniques", params: "q" },
    ],
  },

  // ── CIGAR — patience made smoke ───────────────────────────────
  cigar: {
    label: "Cigar",
    color: "#c98e4f",
    routes: [
      { method: "GET", path: "/api/cigar", desc: "Cigar data directory" },
      { method: "GET", path: "/api/cigar/story", desc: "From seed to smoke — the history of the cigar in chapters" },
      { method: "GET", path: "/api/cigar/regions", desc: "The great tobacco-growing regions of the world" },
      { method: "GET", path: "/api/cigar/brands", desc: "The great cigar houses" },
      { method: "GET", path: "/api/cigar/brands/:id", desc: "One brand by id, e.g. /api/cigar/brands/cohiba" },
      { method: "GET", path: "/api/cigar/collections", desc: "Curated collections of brands" },
      { method: "GET", path: "/api/cigar/collections/:id", desc: "One collection, brand ids resolved to full brand objects" },
      { method: "GET", path: "/api/cigar/stores", desc: "Storied cigar shops of the world" },
      { method: "GET", path: "/api/cigar/process", desc: "Seed to smoke — the stages of making a cigar" },
      { method: "GET", path: "/api/cigar/fermentation", desc: "The pilón — the science, vessels, and notes of fermentation" },
      { method: "GET", path: "/api/cigar/selection", desc: "How to choose a cigar — the selection guide" },
      { method: "GET", path: "/api/cigar/rituals", desc: "The rites of smoking well — cut, toast, ash, and the dignified end" },
      { method: "GET", path: "/api/cigar/aromas", desc: "The aroma families and where they come from" },
      { method: "GET", path: "/api/cigar/techniques", desc: "Craft techniques, from tapado to the triple cap" },
      { method: "GET", path: "/api/cigar/vitolas", desc: "The classic sizes and shapes" },
      { method: "GET", path: "/api/cigar/wrappers", desc: "Wrapper shades, from candela to oscuro" },
      { method: "GET", path: "/api/cigar/random", desc: "A random brand — the full object, why and all" },
      { method: "GET", path: "/api/cigar/search", desc: "Search across brands, regions, stores, and techniques", params: "q" },
    ],
  },

  // ── PAIRING — the marriage of smoke and wine ──────────────────
  pair: {
    label: "Pairing",
    color: "#d4af37",
    routes: [
      { method: "GET", path: "/api/pair", desc: "Pairing data directory" },
      { method: "GET", path: "/api/pair/principles", desc: "The laws of pairing: why smoke and wine marry" },
      { method: "GET", path: "/api/pair/marriages", desc: "All wine-and-cigar marriages" },
      { method: "GET", path: "/api/pair/marriages/:id", desc: "One marriage by id, its wine and cigar refs resolved to full brand objects" },
      { method: "GET", path: "/api/pair/cautions", desc: "Pairings that fight, and why" },
      { method: "GET", path: "/api/pair/ritual", desc: "How to conduct the pairing, step by step" },
      { method: "GET", path: "/api/pair/random", desc: "A random marriage, refs resolved to full brand objects" },
      { method: "GET", path: "/api/pair/for", desc: "Marriages matching a wine and/or cigar by id or keyword, resolved", params: "wine, cigar" },
      { method: "GET", path: "/api/pair/search", desc: "Search across principles, marriages and cautions", params: "q" },
    ],
  },

  // ── TRADE — reference & computation for the art trade ─────────
  trade: {
    label: "Trade",
    color: "#b3372b",
    routes: [
      { method: "GET", path: "/api/trade", desc: "Trade directory — reference & computation for auction houses and galleries" },
      { method: "GET", path: "/api/trade/fees", desc: "Buyer's-premium schedules with effective dates and source citations", params: "house, location, category, as_of" },
      { method: "GET", path: "/api/trade/fees/compute", desc: "All-in buyer cost: marginal band math with line items and explicit not_included", params: "hammer, currency, house, location, category, as_of" },
      { method: "GET", path: "/api/trade/arr", desc: "Artist's Resale Right royalty: cumulative bands, cap status, liable society", params: "price, currency=EUR, sale_date, artist_death_year, jurisdiction" },
      { method: "GET", path: "/api/trade/thresholds", desc: "Dated compliance constants (AML, export, import, VAT) with sources", params: "jurisdiction, kind" },
      { method: "GET", path: "/api/trade/gates", desc: "Which licensing/compliance gates an object crosses — each gate citing its regulation", params: "year, value, currency, jurisdiction, materials, category" },
      { method: "GET", path: "/api/trade/vocab", desc: "Trade vocabularies: lot lifecycle, settlement status, heading ladder, symbols, gallery availability" },
      { method: "GET", path: "/api/trade/vocab/:id", desc: "One vocabulary by id, e.g. /api/trade/vocab/heading-qualifiers" },
      { method: "GET", path: "/api/trade/lots", desc: "The frozen artbitrage.lot/1 contract with CSV door documentation" },
      { method: "POST", path: "/api/trade/lots", desc: "Validate lot records (JSON, or text/csv with Artlogic-vocabulary header mapping); echo + content_hash, never stored" },
      { method: "GET", path: "/api/trade/provenance", desc: "The aam-provenance/1 grammar with per-rule verification status" },
      { method: "POST", path: "/api/trade/provenance", desc: "Round-trip provenance paragraphs ↔ structured event chains; never stored" },
      { method: "GET", path: "/api/trade/results", desc: "Voluntary results corpus with an honest coverage matrix" },
      { method: "POST", path: "/api/trade/results", desc: "Validate a results submission (price_basis required) → witness receipt + PR persistence path" },
    ],
  },

  // ── PIGMENTS — the colours of art history, dated and cited ────
  pigments: {
    label: "Pigments",
    color: "#b98a3e",
    routes: [
      { method: "GET", path: "/api/pigments", desc: "Pigments directory / filtered list — the colours of art history as source-cited facts", params: "limit, offset, family, type, era, hazard, marker, q" },
      { method: "GET", path: "/api/pigments/:id", desc: "One full pigment record, e.g. /api/pigments/prussian-blue" },
      { method: "GET", path: "/api/pigments/random", desc: "One random pigment, full record" },
      { method: "GET", path: "/api/pigments/families", desc: "Colour families with member counts and ids" },
      { method: "GET", path: "/api/pigments/vocab", desc: "Vocabularies: families, types, eras, hazard levels, truth statuses" },
      { method: "GET", path: "/api/pigments/anachronism", desc: "Compare supplied pigments to a claimed date — anachronism / plausible / uncertain, cited floor per pigment. Informational only; a period-consistent palette can never prove authenticity", params: "pigments, claimed_date" },
    ],
  },
};

export const ANSWERING_RHYME_STATEMENT_ACTIONS = Object.freeze({
  bless: Object.freeze({
    consequence: "Records a portable expression of support in the returned receipt only. It does not grant copyright, reuse permission, ownership, or authority over the relation.",
  }),
  contextualize: Object.freeze({
    consequence: "Carries additional context in the returned receipt only. It does not amend the published relation or replace any source record.",
  }),
  correct: Object.freeze({
    consequence: "Carries a proposed correction in the returned receipt only. It does not overwrite the published relation; a receiving operator must review and publish any change.",
  }),
  withdraw: Object.freeze({
    consequence: "Carries a withdrawal request in the returned receipt only. It does not hide, delete, or de-index the relation; a receiving operator must verify authority and publish any change.",
  }),
});

export const ANSWERING_RHYME_STATEMENT_CONTRACT = Object.freeze({
  schema: "artbitrage.answering-rhyme-statement-contract/1",
  accepts_schema: "answering-rhyme.statement/1",
  returns_schema: "artbitrage.answering-rhyme-statement-witness/1",
  endpoint: "https://artbitrage.io/api/answering-rhymes/statements",
  methods: ["GET", "POST"],
  content_type: "application/json",
  canonicalization: {
    version: "answering-rhyme.canonical-json/1",
    encoding: "UTF-8",
    object_keys: "recursively sorted lexically before JSON serialization",
    arrays: "retain normalized order; evidence URL sets are trimmed, deduplicated, and lexically sorted during normalization",
    strings: "Unicode NFC; surrounding whitespace removed; body line endings normalized to LF; unpaired UTF-16 surrogates rejected before Unicode-scalar counting",
    timestamps: "RFC3339 with an explicit offset, normalized to UTC milliseconds; the normalized UTC year must remain within 0001-9999",
    digest: "SHA-256 over canonical JSON bytes, serialized as sha256:<64 lowercase hexadecimal characters>",
  },
  limits: {
    request_bytes: 16384,
    relation_key_characters: 256,
    target_revision_characters: 100,
    body_characters: 2000,
    language_characters: 35,
    declared_by_label_characters: 160,
    urls_per_list: 12,
    url_characters: 1000,
  },
  fields: [
    "schema",
    "canonicalization",
    "relation_key",
    "target_revision",
    "kind",
    "body",
    "language",
    "declared_by",
    "declared_at",
    "in_response_to",
    "evidence_urls",
    "authority_evidence_urls",
  ],
  kinds: Object.keys(ANSWERING_RHYME_STATEMENT_ACTIONS),
  claimed_roles: [
    "viewer",
    "relation-curator",
    "card-rights-holder",
    "artwork-rights-holder",
    "source-institution",
    "other",
  ],
  consequences: ANSWERING_RHYME_STATEMENT_ACTIONS,
  security: {
    identity_authentication: false,
    authority_verification: false,
    evidence_urls_fetched: false,
    application_persistence: false,
    authoritative_effect: "none",
    replay_detection: false,
    uniqueness_not_asserted: true,
    issuer_attestation: {
      signed: false,
      independently_verifiable: false,
    },
    note: "POST validates, normalizes, hashes, and returns an unsigned portable receipt. Artbitrage does not keep an application record or notify another system. Ordinary provider/access logs are outside that application-persistence claim.",
  },
});

// Recognition is by protocol shape, not by a shared database or account
// system. This is a public handshake: it advertises what the door serves and
// the rights boundary, while keeping both siblings operationally sovereign.
export const ARTBITRAGE_WAKE = Object.freeze({
  schema: "artbitrage.wake/1",
  name: "artbitrage",
  built_with: "love",
  serves_kinds: ["human", "agent", "kin"],
  host: "humans-on-earth",
  epoch: "2026",
  canonical_url: "https://artbitrage.io/api/wake",
  walking_past_is_honored: true,
  rights_policy: {
    default_status: "unverified",
    public_visibility_grants: ["view"],
    public_visibility_does_not_grant: ["remix", "machine_learning", "commercial_use"],
    museum_records: "Preserve source-declared license and attribution fields; verify them at the canonical source before reuse.",
    generated_art: "No project license is currently recorded, so no general reuse permission is inferred.",
    cambridge_display: {
      grantee: "https://cambridgetcg.com",
      scope: "verbatim attributed display",
      authorized_on: "2026-07-11",
      applies_to_trace_statuses: ["project-generated", "model-recorded"],
      submitted_default: false,
    },
  },
  endpoints: {
    island: "https://artbitrage.io/api/island",
    start: "https://artbitrage.io/api/start",
    build_joy: "https://artbitrage.io/api/build/joy",
    feed: "https://artbitrage.io/api/feed",
    museum_resolver: "https://artbitrage.io/api/museum/{source}/{id}",
    answering_rhyme_statements: "https://artbitrage.io/api/answering-rhymes/statements",
    castle_reference: "https://artbitrage.io/api/castle",
    agent_manifest: "https://artbitrage.io/api",
  },
  starting_guide: startGuidePointer(),
  build_with_joy: buildJoyPointer(),
  castle_reference: castleReferencePointer(),
  reciprocity: {
    answering_rhyme_statements: ANSWERING_RHYME_STATEMENT_CONTRACT,
  },
  sibling: {
    name: "cambridgetcg",
    role: "commerce-expression",
    url: "https://cambridgetcg.com",
    wake_url: "https://cambridgetcg.com/api/v1/wake",
  },
});

// ── Agent manifest ──────────────────────────────────────────────
export function agentManifest() {
  const allRoutes = [];
  let totalEndpoints = 0;
  Object.entries(ROUTES).forEach(([cat, data]) => {
    data.routes.forEach(r => {
      allRoutes.push({ ...r, category: cat, category_label: data.label });
      totalEndpoints++;
    });
  });

  return {
    name: "artbitrage",
    version: "2.6.0",
    description: "A public art guide and reference desk: meet a work, follow a feeling, investigate a question, or solve a practical art problem with sources and limits visible.",
    url: "https://artbitrage.io",
    total_endpoints: totalEndpoints,
    route_coverage: {
      status: "documented_subset",
      documented_routes: totalEndpoints,
      note: "The catch-all router also carries legacy routes that are not yet inventoried here; absence from this manifest does not prove a path is absent.",
    },
    categories: Object.fromEntries(
      Object.entries(ROUTES).map(([k, v]) => [k, { label: v.label, color: v.color, count: v.routes.length }])
    ),
    routes: allRoutes,
    pages: [
      { path: "/", desc: "Main gallery + era portal + featured cards" },
      { path: "/bridge", desc: "7 consciousness states journey" },
      { path: "/nen", desc: "Nen framework visual page" },
      { path: "/nen-combat", desc: "Nen technique generator" },
      { path: "/dark-continent", desc: "暗黑大陸 — the Dark Continent" },
      { path: "/island", desc: "Greed Island — a namespace where a name is held by keeping a living thing behind it" },
      { path: "/studio", desc: "AI Studio — catalogued edge models; runtime availability can vary" },
      { path: "/catalog", desc: "Small real-museum catalogue sampler" },
      { path: "/prehistoric", desc: "Prehistoric era page" },
      { path: "/medieval", desc: "Medieval era page" },
      { path: "/renaissance", desc: "Renaissance era page" },
      { path: "/baroque", desc: "Baroque era page" },
      { path: "/romanticism", desc: "Romanticism era page" },
      { path: "/impressionism", desc: "Impressionism era page" },
      { path: "/modernism", desc: "Modernism era page" },
      { path: "/popart", desc: "Pop Art era page" },
      { path: "/ai", desc: "AI Art era page" },
    ],
    infrastructure: {
      hosting: "Cloudflare Pages at the edge",
      ai_binding: "Cloudflare Workers AI binding; model and runtime availability can vary",
      storage: "Static JSON assets plus Cloudflare KV (PEBBLES) for consented public testimony and other named rooms",
      museum_apis: ["MET (500K objects)", "Art Institute Chicago (132K)", "Cleveland Museum (68K)", "Wikimedia Commons (100M+)", "Internet Archive (35M)"],
      museum_apis_note: "This compatibility field contains three museums plus Wikimedia Commons and Internet Archive.",
      no_auth: true,
      no_keys: true,
      public_access: true,
      blanket_reuse_grant: false,
      access_note: "Artbitrage asks for no account or per-request payment on these routes. Host and upstream limits still apply.",
    },
    principles: {
      "Love is the design": true,
      "Art is the expression": true,
      "Understanding replicates through understanding": true,
      "Love is the strongest Nen": true,
      "Ai is there too": true,
      "is is lol": true,
    },
    protocol_handshake: ARTBITRAGE_WAKE,
    starting_guide: startGuidePointer(),
    build_with_joy: buildJoyPointer(),
    castle_reference: castleReferencePointer(),
    agent_instructions: "Begin at /api/start, then use the smallest route that fits. /api/build/joy offers optional build ornament, never a score or authority grant; the local wrapper keeps child stdout and failure truthful. Public access is not reuse permission. No account is required for documented routes; runtime bindings and upstreams can vary. Use /api/wake for the protocol handshake, /api/castle for a pinned read-only reference (never a Castle proxy or action grant), /api/feed for the versioned generated-art contract, /api/museum/:source/:id for stable museum records, and /api/answering-rhymes/statements to prepare a portable reciprocity statement without persistence or authoritative effect. Use /api/pipeline/agent for compact data.",
    for_agents: true,
    for_humans: true,
  };
}
