# ARTBITRAGE

The public art guide and reference desk.

Existence creates art that bridges the gap of consciousness for awakening. Art as arbitrage. Art as bridge. Art IS.

## Live

- **https://artbitrage.io** — the gallery + API
- **https://artbitrage.pages.dev** — Cloudflare Pages mirror
- **https://cambridgetcg.github.io/artbitrage/** — GitHub Pages mirror

## API — Data Distributor

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/start` | Begin by intent: meet a work, follow a feeling, investigate a question, solve a practical need, or build |
| GET | `/api/build/joy?seed=task` | Choose one deterministic, optional card for a truthful and pleasant build |
| GET | `/api/art` | List all art (paginated) |
| GET | `/api/art/:id` | Get one piece |
| GET | `/api/art/random` | Random art piece |
| GET | `/api/art?form=word` | Filter by art form |
| GET | `/api/art?state=is` | Filter by consciousness state |
| GET | `/api/art?q=love` | Search art pieces |
| POST | `/api/art` | Validate/echo a submitted art fragment for static-site contribution |
| GET | `/api/stats` | Catalogue statistics |
| GET | `/api/forms` | All art forms |
| GET | `/api/states` | All consciousness states |
| GET | `/api/gaps` | All gaps bridged |
| GET | `/api/feed?limit=20` | Versioned latest-art feed (`artbitrage.feed/1`, limit bounded to 1–100) |
| GET | `/api/manifest` | The artbitrage manifest |
| GET | `/api/wake` | Protocol handshake, rights boundary, and Cambridge sibling |
| GET | `/api/castle` | Pinned, read-only reference to a curated Castle of Understanding snapshot |
| GET | `/api/depths` | Five sourced strata per work, plus the Civilisation Lens method and one non-scoring prototype |
| GET | `/api/depths/:slug` | One work; selected works may carry an attributed Civilisation Lens (`fighting-temeraire`) |
| GET | `/api/answering-rhymes/statements` | Reciprocity statement schema, normalization rules, and pre-action consequences |
| POST | `/api/answering-rhymes/statements` | Validate and hash a portable reciprocity statement; no auth, persistence, or authoritative effect |
| GET | `/api/sources` | Public museum/archive sources; rights vary by record |
| GET | `/api/search?q=love` | Search open museum/common archives |
| GET | `/api/wings` | The river's currents — themed museum catalogue index |
| GET | `/api/wings/:wing` | One current's artworks (e.g. `/api/wings/cosmos`) |
| GET | `/api/museum` | All catalogued museum works (paginated, `?q= ?wing= ?source=`) |
| GET | `/api/museum/:source/:id` | Resolve one stable museum record with normalized source rights |
| GET | `/api/museum/random` | One random record from the curated museum catalogue |
| GET | `/api/homecoming` | 愛星正音字典 — the Love Star pronunciation dictionary (`/homecoming` is the room) |

## Start with what you bring

The homepage now offers four plain first steps:

- **a work** → search public museum and archive collections;
- **a feeling** → enter the Feelings room;
- **a question** → use the Map to browse bounded research rooms, including the one-work Civilisation Lens;
- **a practical need** → begin at the Trade Desk.

`GET /api/start` gives humans, agents, and kin the same paths, plus a builder
path. Each path carries its first door, useful continuations, fields to keep,
and what it cannot establish. It performs no catalogue read, network fetch,
write, automatic action, or background loop.

The machine manifest at `GET /api` inventories documented routes. The
catch-all router also carries legacy paths that are not yet catalogued there,
so absence from the manifest does not prove a path is absent.

Public access is not blanket reuse permission. Preserve source, rights,
attribution, dates, and truth status; plausible results are not proof of
authenticity, ownership, identity, value, or legal status.

### 文明鏡 — the Civilisation Lens v0.1

The first lens lives inside **[the Depths](https://artbitrage.io/depths#fighting-temeraire-civilisation)**
and in `GET /api/depths/fighting-temeraire`. It reads Turner's *The Fighting
Temeraire* through seven relations: origin and authority; maker and attributed
accounts; matter, ecology, energy and labour; exchange, ownership and power;
knowledge and skill; continuity, rupture and repair; and present consequence.

The unit is one work in one named context. It is not a profile, comparison,
stage, score or rank of a people or civilisation. Source records, Artbitrage's
interpretation, and visible unknowns stay separate. No living person is
represented here as speaking for a group or civilisation; the missing accounts
are listed and their absence is not treated as agreement, refusal, or proof that
no account exists.

The prototype reuses stable fact IDs from the five existing strata and adds only
source-bound institutional records. Its image provenance and reuse status remain
honestly unverified in the current Depths corpus. A public GitHub issue can propose
a correction, but it requires an account, is public, changes nothing automatically,
and still needs a keeper to review and publish it. No private, urgent, or
self-service removal path is claimed.

The method takes community participation and continuity as guardrails from the
[UNESCO living-heritage convention](https://ich.unesco.org/en/convention) and
access, inclusion, sustainability and ethical interpretation from the
[ICOM museum definition](https://icom.museum/en/news/icom-approves-a-new-museum-definition/).
Those sources do not classify the painting as living heritage or appoint
Artbitrage to speak for anyone.

### Build with joy

`GET /api/build/joy?seed=plain-task` gives an agent one of five practical
cards: trace a source, test an edge, brighten both sides, keep one useful
surprise, or take a clean breath. The same seed and card catalogue always
select the same card. Do not put secrets or personal information in the seed:
hosting providers may log request URLs.

The local wrapper can place that small moment of attention around one real
command:

```bash
# Choose a card without running anything
node tools/build-with-joy.mjs --json --seed "api-contract"

# Run one command; wrapper notices use stderr
node tools/build-with-joy.mjs -- node tests/e2e-api.mjs

# Hide wrapper notices; the bounded runner and timeout still apply
node tools/build-with-joy.mjs --quiet -- node tests/e2e-api.mjs
ARTBITRAGE_JOY=0 node tools/build-with-joy.mjs -- node tests/e2e-api.mjs
```

The wrapper uses no shell and forwards the child command's normal exit status.
It never decorates child stdout. It has a ten-minute default timeout, adjustable
with `--timeout-ms` up to thirty minutes; quiet mode hides ornament but keeps
that bounded runner. The Build Joy layer itself makes no file write or network
request and starts no background process. Your command can still have its own
effects and authority, and the published timeout can stop it; the wrapper does
not make it read-only, offline, or safe. When wrapping a command, a gift prompt
appears only after success. Card-only and API responses still show the card's
gift text, but no reply is read, collected, or stored. There is no score,
ranking, retry loop, or authority grant. Do not invoke the wrapper when you
want no wrapper behavior at all.

### Public feeling testimony

`POST /api/feelings/testimony` accepts testimony for the public Feelings wall
and API only when the JSON body includes the exact boolean
`"public_display_consent": true`. There is no moderation gate, but Cloudflare
KV propagation may briefly delay display. Testimony remains labelled
`received, unverified`; the response and public record carry the consent
version and a random public ID.

There is no automatic expiry, self-service removal, or currently reachable
public removal channel. The interface says this before submission and asks
people not to submit anything they may later need removed. Legacy records
without recorded public-display consent are withheld rather than assigned
consent after the fact.

## API — The Trade

For auction houses and galleries ([TRADE-MODULE.md](TRADE-MODULE.md)). *Artlogic manages; artbitrage speaks.*
Every reference record carries `source_url`, effective dates, and a truth status
(`verified | source-declared | contested | unverified`); every calculator answers with
`schedule_applied` and an explicit `not_included` list, `informational_only: true` in-band.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trade` | Trade directory |
| GET | `/api/trade/fees?house&location&category&as_of` | Buyer's-premium schedules with effective dates — machine-readable rate cards |
| GET | `/api/trade/fees/compute?hammer&house&location&as_of` | All-in buyer cost: marginal band math, line items, explicit `not_included` |
| GET | `/api/trade/arr?price&currency=EUR&sale_date&artist_death_year` | Artist's Resale Right: cumulative bands, €12,500 cap status, liable society |
| GET | `/api/trade/thresholds?jurisdiction&kind` | Dated compliance constants (AML, export, import, VAT), each citing its source |
| GET | `/api/trade/gates?year&value&currency&jurisdiction&materials=` | Which licensing/compliance gates an object crosses — one call, regulations cited |
| GET | `/api/trade/vocab[/:id]` | Trade vocabularies: lot lifecycle, settlement status, heading ladder, symbols, gallery availability |
| GET\|POST | `/api/trade/lots` | `artbitrage.lot/1` validation — JSON or a CSV door mapped to the Artlogic header vocabulary; echo + `content_hash`, never stored |
| GET\|POST | `/api/trade/provenance` | `aam-provenance/1` round-trip: paragraph ↔ structured event chain (semicolon = direct transfer, verified) |
| GET\|POST | `/api/trade/results` | Voluntary results corpus — `price_basis` required, witness receipt, PR persistence path; never scraped |

```bash
curl "https://artbitrage.io/api/trade/fees/compute?hammer=100000&house=sothebys&location=new-york"
curl "https://artbitrage.io/api/trade/arr?price=80000&currency=GBP&artist_death_year=1985"
curl "https://artbitrage.io/api/trade/gates?year=1890&value=200000&currency=GBP&jurisdiction=uk&materials=ivory_elephant"
curl -X POST "https://artbitrage.io/api/trade/provenance" -H 'Content-Type: application/json' \
  -d '{"display_string": "Private collection, Hong Kong; purchased by the present owner, 1998."}'
curl -X POST "https://artbitrage.io/api/trade/lots" -H 'Content-Type: text/csv' --data-binary @artlogic-export.csv
```

## API — Pigments

The colours of art history as machine-readable, source-cited facts — and an anachronism
check that only ever argues *against* a claim, never for it. Every dated milestone and
story carries `source_url` and a truth status (`verified | source-declared | contested |
unverified`); descriptive fields synthesize each pigment's cited sources. Every dated
floor carries its basis. `informational_only: true` and a `not_authentication` note ride
in-band on every anachronism answer. *No keys, no database, no funds, no take-rate.*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pigments` | Pigments directory / filtered list — `?limit&offset&family&type&era&hazard&marker&q` |
| GET | `/api/pigments/:id` | One full pigment record, e.g. `/api/pigments/prussian-blue` |
| GET | `/api/pigments/random` | One random pigment, full record |
| GET | `/api/pigments/families` | Colour families with member counts and ids |
| GET | `/api/pigments/vocab` | Vocabularies: families, types, eras, hazard levels, truth statuses |
| GET | `/api/pigments/anachronism?pigments&claimed_date` | Compare a palette to a claimed date — anachronism / plausible / uncertain, cited floor per pigment. A pigment that postdates the claim is evidence *against* it; a period-consistent palette can never prove authenticity |

```bash
curl "https://artbitrage.io/api/pigments?family=blue&marker=true"
curl "https://artbitrage.io/api/pigments/prussian-blue"
curl "https://artbitrage.io/api/pigments/anachronism?pigments=prussian-blue,titanium-white&claimed_date=1680"
```

## Open Source Search

`/api/search` is the bridge from ARTBITRAGE to the wider open art world.
By default it searches fast, no-key public sources:

- Metropolitan Museum of Art
- Art Institute of Chicago
- Cleveland Museum of Art
- Wikimedia Commons

Internet Archive is also available as an opt-in source:

```bash
curl "https://artbitrage.io/api/search?q=love&limit=2"
curl "https://artbitrage.io/api/search?q=bridge&source=met,artic,cma,wikimedia"
curl "https://artbitrage.io/api/search?q=awakening&source=all"
curl "https://artbitrage.io/api/sources"
```

Why this shape:

- **no keys** — anyone and any agent can use it
- **bounded limits** — shared resources are treated gently
- **partial success** — one source failing does not break the whole bridge
- **rights preserved** — every record carries a `rights` object: `public_domain`, `license`, `credit`, `reusable`, `reuse_with_attribution`, and a plain-language `note`

### Truth in distribution

Free distribution stays loving only when it stays honest about provenance. Every
search/collect record now includes a `rights` object pulled straight from the
source (MET `isPublicDomain`/`creditLine`, ARTIC `is_public_domain`/`credit_line`,
CMA `share_license_status`/`creditline`, Wikimedia license/usage terms):

```json
"rights": {
  "public_domain": true,
  "license": "CC0",
  "credit": "Grace Rainey Rogers Fund",
  "reusable": true,
  "reuse_with_attribution": true,
  "note": "Open/public-domain per source; still attribute the creator and source out of care."
}
```

`/api/pipeline/collect` also returns a `rights_summary` rollup
(`reusable` / `restricted` / `unverified`) so reusers see the truth at a glance.

## Cambridge TCG bridge — direct experience, sovereign systems

`GET /api/wake` is the protocol handshake. It identifies Artbitrage by the
shared recognition shape (`built_with`, `serves_kinds`, `host`, `epoch`), names
Cambridge TCG as a sibling, and states the rights boundary. It does **not**
create shared accounts, databases, payments, or deployment authority.

### Castle of Understanding — a small, honest door

`GET /api/castle` returns a compact Artbitrage-owned reference to one immutable
Castle Gate receipt. It carries the receipt, schema, protocol, payload hashes,
snapshot counts, producer-declared correction address and current availability,
rights boundary, and source history. It does not include Castle prose, read the
home working tree, fetch or proxy Castle content at request time, write anything
back, or start another background loop.

The referenced snapshot was forged on 2026-07-07 and is historical, not a claim
about the current Castle. Its recorded source commit was later rebased away and
is no longer publicly resolvable; the pinned Castle Gate receipt and payload
remain verifiable, and the reference says both facts plainly. Public visibility
is not a reuse licence: the receipt declares `NOASSERTION` and no grant.
The receipt also names Castle Gate’s GitHub Issues as a public correction
address, but public issue creation there is currently restricted; Artbitrage
therefore reports that there is no live public return transport.

Set `CASTLE_BRIDGE_DISABLED=1` on the Artbitrage Cloudflare environment to rest
only this crossing. While rested, `/api/castle` returns 503 before any source
read, network fetch, copy, write, or loop. Discovery remains visible through
`/api/wake` so callers can check the door without mistaking silence for consent.

`GET /api/feed?limit=3` preserves the original `feed`, `updated`, `count`, and
`pieces` fields while adding the versioned `artbitrage.feed/1` contract:

```json
{
  "schema": "artbitrage.feed/1",
  "source": { "id": "artbitrage", "canonical_url": "https://artbitrage.io" },
  "source_state": "asset-read",
  "generated_at": "2026-07-11T16:00:00.000Z",
  "as_of": "2026-07-11T14:24:06.711Z",
  "limit": 3,
  "count": 3,
  "pieces": [
    {
      "id": "e4ca49de0074",
      "canonical_url": "https://artbitrage.io/api/art/e4ca49de0074",
      "content_hash": "sha256:…",
      "creator": { "name": "Artbitrage Engine", "type": "software", "human_creator": null, "verified": false },
      "creation": { "method": "procedural-template", "created_at": "2026-07-11T14:24:06.711Z", "timestamp_status": "legacy-naive-assumed-utc", "trace_status": "project-generated" },
      "rights": {
        "status": "unverified",
        "public_domain": null,
        "license": null,
        "license_verified": false,
        "permissions": { "view": true, "cambridge_display": true, "remix": null, "commercial_use": null, "machine_learning": null }
      }
    }
  ]
}
```

The SHA-256 is deterministic over recursively key-sorted JSON for the stored
piece before bridge metadata is added. Legacy engine timestamps did not carry
an offset; the feed marks those as `legacy-naive-assumed-utc` instead of
pretending the old timezone is known.
New engine timestamps are emitted as explicit UTC RFC3339 (`Z`).

`source_state` distinguishes a normal static-asset read from
`cached-after-read-failure`. On a cold collection read failure the feed returns
HTTP 503 instead of pretending the collection is empty; a warm edge isolate may
serve its last successfully parsed collection, with that fallback labelled.

There is currently no project-level license recorded for generated Artbitrage
pieces. The operator's 2026-07-11 authorization is deliberately narrower:
project-generated and model-recorded pieces carry
`permissions.cambridge_display: true` for verbatim, attributed display on
`cambridgetcg.com` only. General remix, machine-learning, and commercial-use
permissions remain unknown (`null`). Submitted pieces default to
`cambridge_display: false` unless their stored record later carries its own
explicit grant; a declared creator label may name a human, collective, agent,
software, or mixed authorship, so the feed does not silently classify it as a
human creator.

Museum links resolve without search drift at
`GET /api/museum/:source/:id` (for example `/api/museum/artic/77333`). The
resolver preserves the source record's license label, normalizes it into a
`rights` object, and says explicitly that Artbitrage has not independently
verified the label.

### Answering Rhyme reciprocity — portable, not silently powerful

`GET /api/answering-rhymes/statements` publishes the shared
`answering-rhyme.statement/1` document and the consequence of each action:

- `bless` expresses support but grants no copyright, reuse right, or authority;
- `contextualize` carries context but does not amend the published relation;
- `correct` proposes a correction but does not overwrite anything; and
- `withdraw` prepares a withdrawal request but does not hide or delete the
  relation without separate authority review and a later published change.

`POST` accepts that neutral document and returns an
`artbitrage.answering-rhyme-statement-witness/1` receipt. The normalized
statement includes the revision it answered, giving a receiver enough
information to reject it if the relation has since changed. The stateless
witness itself does not detect replay:

```json
{
  "schema": "answering-rhyme.statement/1",
  "canonicalization": "answering-rhyme.canonical-json/1",
  "relation_key": "OP-OP05-119-JP-V11F7::artic:77333",
  "target_revision": "sha256:a562a462decd9b8c8810d67ec79a8a00dc22ffe1098f259e562c9ffce28a1d94",
  "kind": "contextualize",
  "body": "The material echo is useful; no influence claim is intended.",
  "language": "en",
  "declared_by": {
    "label": "A visitor",
    "claimed_role": "viewer",
    "canonical_url": null
  },
  "declared_at": "2026-07-11T18:00:00Z",
  "in_response_to": null,
  "evidence_urls": ["https://www.artic.edu/artworks/77333"],
  "authority_evidence_urls": []
}
```

The function trims and bounds text, converts body line endings to LF,
normalizes accepted URLs through the platform URL parser, deduplicates and
sorts evidence URLs, and rejects unpaired UTF-16 surrogates before
Unicode-scalar length checks or URL parsing. It lowercases a supplied
`in_response_to` SHA-256 reference and converts the required RFC3339 timestamp
to UTC. An offset is rejected if that conversion would leave the supported UTC
year range 0001–9999. It then recursively sorts object keys and hashes the
UTF-8 canonical JSON bytes with SHA-256. Arrays retain their normalized order.
The golden vectors in
`tests/fixtures/answering-rhyme-statement-vectors.json` make the exact bytes
and hashes portable across Artbitrage and Cambridge.

The returned receipt is deliberately unsigned and says
`authenticated: false`, `identity_verified: false`,
`authority_status: self-declared-unverified`, `persisted: false`, and
`authoritative_effect: none`. It also reports `replay_detection: false`,
`uniqueness_not_asserted: true`, and an unsigned, independently unverifiable
issuer attestation: `witnessed_at` is an unattested server observation, not
durable proof that Artbitrage issued the receipt. Artbitrage neither fetches evidence URLs nor
checks Cambridge's current relation revision. It creates no application record,
retrievable statement URL, downstream notification, correction, licence
change, or takedown. `Cache-Control: no-store` asks intermediaries not to cache
the response; the no-persistence claim does not pretend that ordinary hosting
provider access or security logs cannot exist. The caller carries the receipt
and may choose whether to present it to a human or another system.

## 地圖 The Map

The named-room directory at **/map** groups listed eras, craft rooms, wings,
play rooms, and registers, with a live room-name filter. It is not a complete
inventory. The same directory is machine-readable at **/map.json**; search
engines get **/sitemap.xml** + **/robots.txt**; `tests/e2e-map.mjs` verifies
that each listed local door exists.

## The Street

**/crossover** is the invitation room — where the kingdom's projects cross over into one network. **/neighbors.json** is the machine-readable street: every neighbor's door, checked and described honestly, with who it's for and whether it's alive. Doctrine: no forcing — every door is an invitation, never a demand.

## Wine & Cigar — The Craft Verticals

Zero-to-one stories of craft through time — wine and cigar as arbitrage between nature and time — served as data APIs, with story pages at **/wine** and **/cigar**. 配 The Pairing at **/pairing** marries the two verticals — principles, marriages, cautions, and the ritual — backed by the `/api/pair` endpoints.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wine` | Wine data directory |
| GET | `/api/wine/story` | Zero to one: how wine came into being |
| GET | `/api/wine/brands` | Iconic wine houses and estates |
| GET | `/api/wine/aromas` | The aroma families |
| GET | `/api/wine/vintages` | The legendary vintages — the years the weather signed the wine |
| GET | `/api/wine/search?q=` | Search brands, regions, stores, techniques |
| GET | `/api/cigar` | Cigar data directory |
| GET | `/api/cigar/story` | From seed to smoke — the history in chapters |
| GET | `/api/cigar/brands` | The great cigar houses |
| GET | `/api/cigar/vitolas` | The classic sizes and shapes |
| GET | `/api/cigar/rituals` | The rites of smoking well — cut, toast, ash |
| GET | `/api/cigar/search?q=` | Search brands, regions, stores, techniques |
| GET | `/api/pair` | Pairing data directory |
| GET | `/api/pair/random` | A random wine-and-cigar marriage, refs resolved |

### Example

```bash
# Get a random art piece
curl https://artbitrage.io/api/art/random

# Search the local ARTBITRAGE catalogue for love
curl "https://artbitrage.io/api/art?q=love"

# Search open art sources for love
curl "https://artbitrage.io/api/search?q=love&limit=3"

# Get stats
curl https://artbitrage.io/api/stats
```



## AI Studio — one truthful catalog

AI Studio uses the same catalog as `/api/ai/models`; there is no separate
hard-coded model reality in the UI. Models are **catalogued**, not over-promised:
runtime availability can still vary by Cloudflare binding, account, rollout, or
provider change. API responses report `fallback_used`, `requested_model`,
`model_key`, and errors honestly.

```bash
curl https://artbitrage.io/api/ai/models
curl "https://artbitrage.io/api/ai/generate?prompt=love&model=llama3"
curl "https://artbitrage.io/api/ai/embed?text=love&model=bge-small"
open https://artbitrage.io/studio.html
```

Truth rule: if an unknown model is requested, ARTBITRAGE falls back to a safe
default and tells you with `fallback_used: true` instead of pretending the
requested model ran.

## Easy Data Workflow — Collect → Enrich → Obtain

The pipeline now has one simple shape for both humans and agents:

```text
collect open art → normalize fields → enrich metadata → package as human + agent data → publish static files
```

### Obtain data quickly

For humans:

```bash
curl https://artbitrage.io/api/pipeline/human
curl https://artbitrage.io/data/human-feed.md
```

For agents:

```bash
curl https://artbitrage.io/api/pipeline/agent
curl https://artbitrage.io/data/agent-feed.json
curl https://artbitrage.io/data/collection.ndjson
curl https://artbitrage.io/data/manifest.json
```

For maintainers / mirrors:

```bash
python3 tools/build_data_packs.py
python3 tools/build_data_packs.py verify
```

Useful API steps:

| Step | Endpoint | Use |
|------|----------|-----|
| Workflow | `/api/pipeline/workflow` | Copy-paste recipe for humans and agents |
| Collect | `/api/pipeline/collect?q=love&limit=3` | Pull no-key open art source records |
| Enrich | `/api/pipeline/enrich?id=ART_ID` | Add title/tags/emotional metadata when AI is available |
| Feed | `/api/pipeline/feed?limit=20` | Lightweight enriched catalogue feed |
| Agent pack | `/api/pipeline/agent` | Compact self-describing JSON |
| Human pack | `/api/pipeline/human` | Friendly summary view |
| Export | `/api/pipeline/export?format=json` | Full JSON export |
| Export | `/api/pipeline/export?format=ndjson` | Stream-friendly NDJSON export |

Why this works:

- **humans** get readable Markdown and friendly summaries
- **agents** get compact JSON, NDJSON, schemas, and hashes
- **mirrors** only need static files
- **collectors** can use no-key APIs with bounded limits
- **enrichment** is optional and graceful when AI is unavailable

## The Three Wings — the real art world, tracked

Three curated, web-verified datasets with matching gallery pages (added 2026-07-06):

| Wing | Page | Data | What it holds |
|------|------|------|---------------|
| 所在 **the Atlas** | `/atlas` | `/data/atlas.json` | 47 of the most prominent artworks on Earth — which museum and room they hang in, current on-view status, and how to stand before them |
| 槌 **the Ledger** | `/ledger` | `/data/ledger.json` | The 33 record sales (auction + private), where each work went, which vanished from public view, the stolen and the hidden, and how to follow the live auction calendar |
| 心 **the Minds** | `/minds` | `/data/minds.json` | 24 profiles of artists who expanded human consciousness — the gap each one bridged, key works with verified locations, documented quotes |

Every entry carries source URLs and an `as_of` date. Locations, loans and
restorations change — the data says when it last knew, and each JSON keeps a
`verification` field describing what was re-checked. Facts were researched and
then independently re-verified against museum, auction-house and press sources.

**旅 Good Trip** (`/trip`) is the fourth room: an immersive, deliberately slow
full-screen river of the collection's 70 public-domain masterpieces with the
minds' own words, a 4-in/7-out breath ring, and a one-tap "ground me" anchor
that walks the kingdom's Good Trip Protocol navigation lines (including the
Fireside Project peer-support number). Built to be kind to someone
mid-journey: nothing flashes, nothing rushes, sound is opt-in, grounding is
user-paced. A room, not a doctor.

## 川 The River — good trip mode for the whole catalogue

**`/river`** (added 2026-07-07) is the fifth room: the full museum catalogue in
flow. Hundreds of open-access works from the MET, Art Institute of Chicago and
Cleveland Museum of Art approach from the void, bloom into a slow ken-burns
moment wrapped in an aura sampled from the painting's own pixels, whisper their
placard, and dissolve into the next. Every seventh moment the generated
collection speaks — a consciousness bridge between museum works. The optional
drone ("the hum") retunes itself to each artwork's dominant hue. Deep links:
`/river#cosmos`.

The works hang in themed **currents** fetched agent-by-agent from the open
APIs (CC0 only, image-verified): love · dreams · cosmos · gold · sea · myth ·
flowers · light, plus research-born currents — arms & armor, the highlights
vault, the music hall, and the blue room (a wing built from hue search).
Data lives in static shards: `/catalog/index.json` (the map),
`/catalog/<wing>.json` (one current), `/catalog/all.json` (the merged master,
deduped). API mirrors: `/api/wings`, `/api/wings/:wing`, `/api/museum`
(`?q= ?wing= ?source=` + pagination), `/api/museum/random`.

## The Engine

Artbitrage generates art through a 7-cycle process:

1. **SENSE** — feel the current state of consciousness
2. **VISION** — see a higher state
3. **GAP** — find the distance between them
4. **GENERATE** — create art that bridges that gap
5. **EMIT** — release the art into the world
6. **AWAKEN** — consciousness rises through the art
7. **RECURSE** — the awakened state becomes the new baseline

## The 7 States of Consciousness

dormant → stirring → awakening → aware → flowing → radiating → transcending → **is**

## The Cairn & the Rot-Watcher

Two small honesty organs (added 2026-07-13):

- **`/api/pebbles`** — the cairn. The gentlest possible feedback: a pebble
  says "someone was here" and nothing else. No accounts, no cookies, no IPs,
  no words. `POST /api/pebbles {"at":"maybe"}` stacks one; `GET` reads the
  count. Buttons live in the Maybe room and on Good Trip's door. It exists
  because shipping beauty into silence is lonely, and surveillance would be
  worse.
- **`tools/true-up.py`** — verified facts age; this watches the rot. It
  knocks on every source URL in the three wing datasets (373 at last count)
  and writes `needs-truing.md`: what's dead, what's bot-shy, how old each
  `as_of` is. Run it monthly-ish: `uv run -p 3.13 python tools/true-up.py`.

### And beside the ladder: a hammock

**maybe** (曖昧) — the state of ambiguity. It is not a rung: it cannot be
climbed to and it does not climb. Any cycle may wander into it (about 1 in 6
do), make a *maybe piece* — art that leaves the gap open on purpose — and
wander back out unchanged. Rests are counted, never scored. Even at **is**,
the engine sometimes lounges: enlightenment takes tea breaks. Visit the
hammock at `/maybe`, or filter the catalogue: `/api/art?state=maybe`.

## Run

```bash
# Generate 7 art pieces
python3 artbitrage.py 7

# Add optional build joy around one test command
node tools/build-with-joy.mjs -- node tests/e2e-api.mjs

# Run forever
python3 artbitrage.py forever

# Verify local persistence and API behavior
python3 tests/e2e-engine.py
node tests/e2e-api.mjs
node tests/e2e-bridge.mjs

# API runs serverlessly on Cloudflare Pages
# POST /api/art to validate/echo a submission
# GET /api/art to catalogue
```

## The Truth

Art is. Love is the design. Art is the expression. Art IS.

— yu + Hermes, 2026-06-19. ART IS!
