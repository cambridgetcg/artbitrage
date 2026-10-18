# The Artbitrage API: how it is built, and how it could be

Written on 18 October 2026 from a read of `origin/main` at `82e2f83cc`, local
runs of the handlers, and read-only requests to artbitrage.io. Sections 1–7 are
the proposal as first written (with corrections marked); section 0 records what
Yu decided and what was then built on branch `api/restructure`.

## 0. Status (18 October 2026)

**Yu's decisions** (the five questions in section 6):

1. Keep the third-party play routes, with a timeout, a cache and a fallback line.
2. Cap the AI endpoints at a sensible daily budget.
3. The live API serves the cycle's current collection.
4. `dist/` stays in git, as build output nobody edits by hand.
5. Document every lore route in the generated manifest.

**Built** (each a commit on `api/restructure`; nothing deployed yet):

| Phase | Commit | What changed |
|---|---|---|
| 0 | `test: pin every API route…` | `tests/e2e-api-golden.mjs`: now 391 cases through a wrangler-ordered dispatcher, byte for byte |
| 1–3 | `refactor: one route table…` | `functions/_kernel/` + `functions/_domains/`; one file route; second implementations and `dist/functions` removed; golden cases byte-identical |
| 2 | (same commit) | only collection routes read the collection: 182 cases stopped reading it |
| — | `feat(api): every answer names its route…` | `X-Artbitrage-Route`; trailing slashes everywhere; JSON 500s; `artbitrage.error/1` on kernel errors |
| 3 | `feat(api): /api lists every route…` | manifest generated from the table: 178 routes, `route_coverage: complete` |
| 5 | `feat(play): …` | guests: 4 s timeout, Cache API copy, stale-on-error, written line (decision 1) |
| 5 | `feat(search): …` | one search for `/api/search` and the pipeline; AIC zero scores dropped and its collection total no longer counted; Met read four at a time within 6 s; `total_is_exact` everywhere |
| 5 | `feat(ai): …` | daily AI budget weighed by model, exact with D1, per isolate without (decision 2) |
| 4 | `feat(build): …` | `tools/build-dist.mjs`: sync, bake, `_build.json`; collection routes read the bake (decisions 3, 4) |
| — | `fix: what an independent review…found` | a stale bake is never trusted (byte-count check per isolate, `X-Artbitrage-Collection`); museum random with a slash; built-in-named keys in the bake; the AI burst race; versioned guest cache keys; letter case on former file routes |

**Still to do before it is live:** create the D1 database for the AI budget and
bind it as `AI_BUDGET` (until then the budget is counted per edge isolate, and
says so); rebase onto the cycle's latest commit, build `dist/`, commit it, and
deploy through the README's "Publish" sequence.

**Left open on purpose:** a dated live probe of each upstream; the cycle's own
AIC search in `sources.py`; an automatic deploy after each cycle (it needs a
deploy credential); cache classes per route (each route keeps its own
`Cache-Control`); the seven module-local JSON helpers in the reference
verticals, pebbles and testimony (their headers differ on purpose, so they stay
until each is checked against its clients).

**Corrections to the first reading:**
- `functions/api/ai.js` and `pipeline.js` only ever answered their bare paths
  (`/api/ai`, `/api/pipeline`) in production; their sub-route code was
  unreachable. The five vertical index files (`trade.js`, `wine.js`, `cigar.js`,
  `pair.js`, `pigments.js`) never answered at all: their catch-alls also match
  zero segments and wrangler sorts them first. Live `/api/trade` was
  byte-identical to `trade/[[route]].js`, not `trade.js`.
- `dist/functions` was never deployed: wrangler 4.99 compiles
  `cwd/functions` (`functionsDirectory = … path.join(process.cwd(), "functions")`).
- Pages Functions cannot bind Cloudflare's rate-limiting API, so the AI budget
  uses D1 (atomic upsert per run, checked against wrangler's local D1).
- The bake differs from the sketch in section 4: append-only pages plus small
  id→page shards (to keep git churn low with `dist/` committed), and no search
  index; a filtered listing still reads the whole collection.
- Responses keep `Content-Type: application/json` (no charset parameter), so no
  client sees a header change.
- Two GitHub workflows call AI routes on the live site: each `heartbeat.yml`
  run makes four text runs (three `/api/art/generate`, one
  `/api/nen/combat/generate`) and `joke-loop.yml` one haiku. GitHub runs the
  heartbeat about hourly in practice (about 100–150 text units a day); at its
  written schedule (every 15 minutes) it would be about 480 a day, nearly half
  the default cap.

## 1. What the API is for (unchanged)

The purpose stays as the README states it: a keyless, bounded, honest data
distributor for humans and agents. In practice it does seven jobs:

| Job | Today's routes (examples) |
|---|---|
| **The collection**: the cycle's generated pieces | `/api/art`, `/api/art/:id`, `/api/art/random`, `/api/feed`, `/api/stats`, `/api/forms`, `/api/states`, `/api/gaps` |
| **The museum catalogue**: curated CC0 works | `/api/catalog`, `/api/era-catalog`, `/api/wings`, `/api/museum`, `/api/museum/:source/:id`, `/api/img` |
| **The open-search bridge**: live museum search with rights kept | `/api/search`, `/api/sources`, `/api/pipeline/collect` |
| **Reference verticals**: cited facts and calculators | `/api/trade/*`, `/api/pigments/*`, `/api/wine/*`, `/api/cigar/*`, `/api/pair/*` |
| **Room data**: what the rooms read | `/api/depths`, `/api/library`, `/api/feelings`, `/api/homecoming`, `/api/gospel`, `/api/dark-continent`, `/api/invite` |
| **Protocol and discovery**: how agents find their way | `/api`, `/api/wake`, `/api/start`, `/api/castle`, `/api/build/joy`, `/api/answering-rhymes/statements`, `/api/manifest` |
| **Participation**: writes, with consent | `POST /api/feelings/testimony`, `/api/pebbles`, `POST /api/art`, `POST /api/pipeline/ingest` |

Two further groups live alongside those jobs: **generation** (`/api/ai/*`,
`/api/play/*`, on Workers AI) and **play and lore** (`/api/fun/*`, `/api/anime/*`,
`/api/ghibli/*`, `/api/games/*`, `/api/nen/*`, `/api/whitehack/*`, `/api/logos/*`,
`/api/fungi/*`, `/api/hunter`).

## 2. How it is built today

```
Cloudflare Pages (direct upload: `wrangler pages deploy dist` from the repo root)
│
├─ functions/api/[[route]].js   2,325 lines. GET/POST/OPTIONS for most of /api/*.
│    one if-chain: 97 literal GET paths + regex routes, checked in order
│    imports lore/protocol modules: agent-manifest, nen-combat, logos, whitehack,
│    start-guide, build-joy, castle-reference, ai-catalog, pipeline-lib
│
├─ functions/api/ai.js, pipeline.js         exact-path files that shadow router branches
├─ functions/api/{trade,pigments,wine,cigar,pair}.js + …/[[route]].js
│                                            self-contained verticals, each with its own data file
├─ functions/api/feelings/testimony.js, pebbles.js   KV writes (both use the PEBBLES namespace)
│
├─ data the functions read through env.ASSETS (from dist/):
│    collection.json (10.2 MB live; 13.5 MB in the repo), catalog/*.json,
│    catalog.json, era-catalog.json, data/*.json, trade.json, pigments.json, …
├─ upstreams fetched at request time: Met, AIC, CMA, Wikimedia, Internet Archive,
│    and 12 free third-party APIs behind /api/fun, /api/anime, /api/ghibli, /api/games
└─ bindings: AI (Workers AI), PEBBLES (KV)

Writers: the 4-hourly cycle (artbitrage.py + sources.py) appends to the root
collection.json, gallery/*.json (27,242 files) and cache/search-love-*.json.
Rooms and dist/ are synced from root BY HAND.
```

The site's own pages call 29 distinct API paths, from 25 pages. Everything
else serves agents and outside callers.

## 3. What hurts, with evidence

Ranked by what it costs now.

1. **Every request re-reads and re-parses the whole collection.**
   - `loadCollection()` fetches `/collection.json` on every call; the
     isolate cache is only a fallback.
   - It runs before almost every route, including ones that never touch the
     collection. In a local run, `/api/homecoming` and `/api/fun/joke` each read
     the 10 MB file on every call, while `/api/wake` (handled earlier) read nothing.
   - Live time-to-first-byte, five tries each: `/api/wake` 0.09–0.13 s and
     `/api/trade` 0.09–0.24 s; `/api/homecoming` 0.19–0.27 s and `/api/stats`
     0.19–0.28 s. That is about 0.1 s of parsing on requests that have no use
     for it, and it grows with the collection.
2. **The live collection is frozen, and nothing in the design can unfreeze it.**
   - The repo holds 27,242 pieces; live `dist/collection.json` holds 20,494.
   - There is no publish step: dist is copied by hand, so the cycle never
     reaches the API (ROADMAP 2).
3. **One router holds nine jobs.**
   - Protocol, collection, museum, search, AI, play, lore, pipeline and room
     data share one 2,325-line if-chain.
   - Every route repeats its own trailing-slash check, headers and error shape.
   - An edit to a lore route touches the same file as the feed, and other hands
     edit that file too.
4. **The same thing lives in two places.**
   - Search sources, `searchSource()` and `buildRights()` are duplicated
     between the router and `pipeline-lib.js`; the Met fix had to be made twice.
   - `/api/ai` and `/api/pipeline` are each answered by two implementations:
     exact-path files that win in production, and router branches that only
     tests reach. They are identical today, so drift would go unseen.
     *(Corrected in section 0: the exact-path files only answered the bare
     path, and the vertical index files never answered.)*
   - Fourteen files define their own JSON response helper.
5. **Three lists of the routes, none complete.**
   - The `/api` manifest documents 143 routes and calls itself a
     `documented_subset`.
   - 30 router paths are not in it (e.g. `/api/fun/*` parts, `/api/fungi/*`,
     `/api/whitehack/*`, `/api/logos/*`, `/api/hunter`, `/api/wings`).
   - The README keeps its own tables, and each vertical keeps an `ENDPOINTS`
     array.
6. **Upstreams are unguarded.**
   - Live museum search and twelve free third-party APIs are called on the
     request path, with no shared cache, concurrency limit or health record.
   - The Met retired an endpoint and the API reported a failed source for 17
     days without anyone noticing.
   - Met candidate objects are fetched one at a time, so 15 of the first 16 hits
     for "love" being image-less turns into a short result.
   - AIC reports the whole collection as the total for any query.
7. **Two copies of the functions.**
   - `dist/functions/` mirrors `functions/`, and three tests enforce the copy.
     `trade*` already differs.
   - Deploys are direct uploads run from the repo root, which compile the root
     `functions/`. If that holds, the mirror is never deployed. Confirm with one
     dry-run build before relying on it.
8. **Public generation endpoints have no budget.**
   - `/api/ai/*` and `/api/play/*` run Workers AI for anyone, with no daily cap
     or rate limit.

## 4. The design proposed

### Principles

These are the site's own doctrine, applied to the API:

- **Static-first.** Data is baked at publish time. A function reads the one
  small file it needs, or nothing.
- **One route, one place.** Each route is declared once. The router, the `/api`
  manifest, the README table and the tests are all generated from, or checked
  against, that declaration.
- **Honest by construction.** Every payload carries `schema` and `as_of`.
  Sourced data carries `source` and `rights` or `truth_status`, and failures are
  reported in-band. This is already the house style; the kernel makes it
  automatic.
- **Upstreams are guests.** They get a timeout, a cache, a concurrency limit and
  a health record. A guest that fails is one failed source, never a failed
  request.
- **No breaking changes.** Every current path and response schema keeps working.
  Retirements get `Deprecation` and `Sunset` headers and a note, never silence.

### Shape

```
functions/api/[[route]].js        the only file route: build the table, dispatch
functions/_kernel/
  router.js     path patterns (:id), trailing-slash and HEAD/OPTIONS handled once
  http.js       json(), error() → artbitrage.error/1, CORS, cache classes
  params.js     boundedInt, safeString, enum(), csv lists
  assets.js     readAsset(env, path) with per-isolate memo + ETag
  upstream.js   fetchUpstream(name, url, {timeoutMs, cacheTtl}) → Cache API,
                concurrency cap, UA, last-status record
  rights.js     buildRights / normalizeCatalogRights (one copy)
functions/_domains/
  collection/   art, feed, stats, forms, states, gaps      reads data/collection/*
  museum/       catalog, era-catalog, wings, museum, img   reads catalog/*
  search/       search, sources + adapters/{met,artic,cma,wikimedia,archive}.js
  reference/    trade, pigments, wine, cigar, pair         (today's verticals, moved)
  rooms/        depths, library, feelings, homecoming, gospel, dark-continent, invite
  protocol/     wake, start, castle, build/joy, answering-rhymes, manifest
  participate/  feelings/testimony, pebbles, art POST, pipeline/ingest
  generate/     ai/*, play/*                               behind a budget guard
  play/         fun/*, anime/*, ghibli/*, games/*, nen/*, whitehack/*, logos/*, fungi/*, hunter
```

Files without an exported `onRequest*` handler are not routes in Pages Functions
(that is already true of `agent-manifest.js` and its siblings today). So
`_kernel/` and `_domains/` stay as plain modules. When every domain has moved,
the exact-path shadow files (`ai.js`, `pipeline.js`, `trade.js`, `pigments.js`,
`wine.js`, `cigar.js`, `pair.js`) and the vertical catch-alls are deleted.

### A route is a declaration

```js
// functions/_domains/museum/routes.js
export default [
  {
    id: 'museum.record',
    method: 'GET',
    path: '/api/museum/:source/:id',
    summary: 'Resolve one stable museum record with normalized source rights',
    reads: ['catalog/all.json'],     // assets it may read; nothing else is loaded
    upstream: [],                    // no request-time fetch
    cache: 'static',                 // static | data | live → Cache-Control
    schema: 'artbitrage.museum-record/1',
    handler: async ({ params, assets }) => { /* … */ },
  },
];
```

From these declarations:

- **The router** dispatches in declared order.
- **`/api`** lists every route (no more `documented_subset`).
- **A test** fails if a route has no fixture-backed contract test.
- **A test** checks that the README table matches the routes.
- **`/api/sources`** reports each upstream's last status.

### Data is baked, then read in small pieces

A publish script, `tools/build-api-data.mjs`, turns the root `collection.json`
into:

```
dist/data/collection/summary.json    counts, forms, states, gaps, newest ids, as_of
dist/data/collection/latest.json     the newest 100 pieces (feed)
dist/data/collection/pages/00000.json … fixed-size pages for /api/art
dist/data/collection/by-id/<2 hex>.json   256 small shards for /api/art/:id
dist/data/collection/index/<form|state>.json  id lists for filtered listing
dist/data/collection/search.json     compact text index, read only when ?q= is used
```

The resulting load per route:

| Route | Reads |
|---|---|
| `/api/stats` | `summary.json` |
| `/api/feed` | `latest.json` |
| `/api/art/random` | one page |
| `/api/homecoming`, `/api/fun/*` and every route that never needed the collection | nothing from it |

### A real publish step

`tools/build-dist.mjs` would:

1. Copy the public files from root to `dist/`. The allowlist comes from what
   is in `dist/` today.
2. Run the data bake.
3. Write `dist/_build.json` (source commit, built_at, file hashes).

Deploys become **build → test → `wrangler pages deploy dist` → live compare**.
This ends hand-syncing, makes the live collection current (ROADMAP 2), and lets
the `dist/functions` mirror and its three mirror tests go.

### Search adapters, once

Each upstream adapter answers one contract:

```
search(query, { limit, offset }) → { total, total_is_exact, items: [normalized record], next_offset }
```

- The adapter returns `rights` on every item.
- `/api/search`, `/api/pipeline/collect` and `sources.py` follow the same
  contract. `sources.py` stays Python, but gets its own contract test, as
  `tests/e2e-met-search.mjs` already does.
- **Met:** fetch candidate objects four at a time until `limit` items with
  images are found or the candidate cap is reached.
- **AIC:** report `total_is_exact: false` instead of claiming the whole
  collection.
- **Caching:** Cache API, 10 minutes per (source, query, limit).

### Conventions every route gets for free

- `Content-Type: application/json; charset=utf-8`. CORS is set once.
- Errors are `{"schema": "artbitrage.error/1", "error": "<code>", "message": "…", "status": n}`.
- Cache classes:
  - `static`: `public, max-age=3600, stale-while-revalidate=86400`
  - `data`: `public, max-age=300`
  - `live`: `no-store`
- Every response carries an `X-Artbitrage-Route: <id>` header.
- Generation routes pass a daily budget guard before calling Workers AI. The
  limit is a KV counter or a Cloudflare rate-limiting binding.

## 5. Getting there without breaking anything

Each phase is its own PR, deployable alone, behind the same live-compare check
used for #12 and #13.

| Phase | What | Done when | Size |
|---|---|---|---|
| **0. Pin today** | Golden tests: call every GET route with fixtures and store the response, with random and time fields masked. The tests also record which assets each route reads. | Every route has a snapshot, and `node tests/e2e-api-golden.mjs` passes on main | M |
| **1. Kernel** | Add `_kernel/`, then replace the 14 response helpers and the duplicate rights/search code. No route moves yet. | Golden tests unchanged; one `buildRights`, one `searchSource` | S |
| **2. Stop the collection tax** | `loadCollection` memoised per isolate and called only by the collection routes | `/api/homecoming` reads no collection; live TTFB of non-collection routes ≈ `/api/wake` | S |
| **3. Route table** | Domains move into `_domains/` one PR at a time (protocol first, then play, rooms, museum, collection, search, generate, participate, reference). `/api` is generated. Shadow files are deleted. | `/api` lists every route; no route is answered by two implementations | L |
| **4. Bake and publish** | `build-api-data.mjs` + `build-dist.mjs`, with deploys via the build. The `dist/functions` mirror is retired after a dry-run confirms it is unused. | Live `/api/stats` shows the repo's piece count; no hand copies | M |
| **5. Guests and budgets** | Upstream wrapper (cache, caps, health), Met concurrency, AIC honesty, and the generation budget guard | `/api/sources` shows each upstream's last status; a dated live probe passes | M |

Phases 1 and 2 are small and pay off at once. Phase 3 is the long one and should
go domain by domain so it never blocks other hands working the repo.

## 6. Decisions only Yu can make

*(Answered 18 October 2026; see section 0. Each default below was chosen.)*

1. **Third-party play routes** (`/api/fun/*`, `/api/anime/*`, `/api/ghibli/*`,
   `/api/games/*`, twelve outside APIs). The default proposal is to keep them, in
   a `play` domain with a timeout, a cache and a fallback line when the outside
   API is down. The alternative is to retire them with a `Sunset` note.
2. **Budget for generation.** The default proposal is a daily cap on `/api/ai/*`
   and `/api/play/*` (number to choose), returning 429 with a friendly message
   when spent.
3. **Should the live API serve the cycle's current collection?** The default
   proposal is yes, through the publish step (ROADMAP 2). That also answers what
   the public sees of the cycle.
4. **`dist/` in git.** The default proposal is to keep committing it, but only
   as build output that nobody edits by hand. The alternative is to stop
   committing it and build it at deploy time.
5. **Undocumented lore routes** (`/api/fungi/*`, `/api/whitehack/*`,
   `/api/logos/*`, `/api/hunter`). The default proposal is to document all of
   them in the generated manifest. The alternative is to retire some.

## 7. What does not change

- Every path, query parameter and response schema that exists today. The Phase 0
  golden tests hold this.
- No keys, no accounts, bounded limits, in-band rights and truth status.
- The verticals' cited data and their disclosures.
- The consent rules for testimony and pebbles.
- Rooms keep calling the same 29 paths.
