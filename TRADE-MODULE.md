# TRADE MODULE — tailoring the artbitrage API for auction houses & galleries

*Determination of 2026-07-16, from a 16-agent research pass (7 market sweeps, 3 gap sweeps,
1 codebase-conventions read, 3 competing designs, 1 judge). Facts cited inline; numbers
carry their dates because this market re-prices its own fees yearly.*

## The determination

The trade does not need another system — it needs a **free reference-and-computation layer
it can call from inside the tools it already has**. Every incumbent sells either a silo
(Artlogic, Arternal — no public APIs, CSV-only interchange) or a toll booth (artnet per-seat
subscriptions, LiveArt contract-gated data, marketplace commissions). The one legally safe,
structurally unserved position is open reference data + pure computation + strict validation,
with **no keys, no database, no funds, no take-rate** — which is exactly what artbitrage
already is. One line: **Artlogic manages; artbitrage speaks.**

## Part I — how the trade actually operates (what shaped the design)

### Auction houses

- **Fee schedules churn and live in prose.** Sotheby's NY buyer's premium as of 2026-02-13:
  28% to $2m / 22% to $8m / 15% above ([sothebys.com/en/articles/sothebys-fee-structure](https://www.sothebys.com/en/articles/sothebys-fee-structure));
  Bonhams US runs an extra low-value band (28% to $50k / 27% to $1m / 21% to $6m / 14.5% above)
  ([bonhams.com](https://www.bonhams.com/how-to-buy/buyers-premium-united-states/));
  Phillips' 2026-04-12 card is the highest at entry (29/22/15)
  ([phillips.com rate card PDF](https://www.dist.phillips.com/content/web/docs/forms/BuyersPremium.pdf)).
  The majors changed rates **three times in 2024–2026** (Sotheby's shipped a simplified
  20/10 structure in May 2024 and reversed it by February 2025). No machine-readable source
  for any of this exists anywhere. Cross-house price comparisons are wrong by 15–29% without
  the premium math.
- **Cataloguing language is a graded authenticity code.** Christie's 5-year authenticity
  warranty covers only the UPPERCASE heading; "Attributed to…" and the rest of the qualifier
  ladder carry no warranty. The ladder is an enumerable taxonomy no one serves as data.
- **Condition reports are free, on request, guidance-only; lots sell "as is."** There is no
  industry-standard condition-report structure (Articheck is the closest proprietary thing).
- **Settlement is a lifecycle, not a moment.** Buyers pay within ~5 days (48h online-only);
  sellers are paid ~30–45 days later, only if the buyer pays. Title passes on cleared funds.
  In mainland China roughly half of RMB 10m+ lots have historically settled late or not at
  all — **"sold" is not a boolean**; `lifecycle_state` and `settlement_status` are separate
  fields.
- **Bidder registration is a KYC gate** (photo ID, beneficial ownership for companies,
  possible deposits/credit limits) — houses already run AML; they need reference numbers,
  not another compliance vendor.
- **Export licensing bites after the sale.** UK ACE thresholds (frozen since 2002): £180k
  oil paintings / £65k most objects / £0 manuscripts & UK archaeological finds
  ([artscouncil.org.uk](https://www.artscouncil.org.uk/supporting-arts-museums-and-libraries/export-licensing)).

### Galleries

- Primary-market splits cluster near 50/50 with artists; seller terms at auction are
  **negotiated, not schedulable** — the module serves buyer-side rate cards and marks
  seller commission as deal terms.
- The operational wire format is **the spreadsheet**: inventory leaves Artlogic and enters
  fairs, viewing rooms, and websites as CSV, re-keyed each time. Data-entry duplication is
  the number-one documented pain.
- Holds, pre-sales, fair reserves: gallery availability states
  (`available|on_hold|pre_sold|sold|on_consignment|on_loan`) are a real state machine no
  open vocabulary captures.

### Compliance (the mechanical, repeated parts)

- **EU/UK AML**: art market participants trigger customer due diligence at **€10,000**
  (including linked transactions); UK AMPs register with HMRC.
- **Artist's Resale Right**: cumulative bands (4% to €50k, then 3/1/0.5/0.25%) capped at
  **€12,500 per resale**, eligibility turning on artist life dates (70 years pma) — "the
  single most mechanical, most repeated compliance calculation in the trade" (DACS/ADAGP).
- **Materials gates**: CITES species, UK Ivory Act exemption certificates, EU import
  regulation 2019/880 age/value gates.
- All of these are **dated constants scattered across PDFs** — a served, versioned,
  source-cited threshold dataset replaces the PDF hunt.

### Why the niche is unserved (sourcing legality — the critic's round)

Aggregating auction data without consent is what makes incumbents closed and lawsuits
common: EU database-right case law (*Innoweb*, *Ryanair*) makes screen-scraping per-se
risky; French courts fined catalogue republication ~€1M twice (*Camard*). The **only
legally clean sourcing channel is voluntary submission** — the Barnebys model, where houses
feed data in exchange for distribution and deep links routing bidders back to them. We adopt
the consent economics without the pay-per-click toll. Facts (prices, dates, dimensions) are
the safest field class; verbatim catalogue prose and house photography are never ours to
serve.

### Privacy (the second critic round)

Provenance chains name people. Post-*Sovim* (ECJ 2022, beneficial-ownership registers),
serving named living private parties through an open API is untenable — and houses
contractually cannot feed it anyway. The Getty "Private collection" convention becomes
schema: `{ref: 'party:sha256:…', display: 'Private collection, Switzerland', role,
living_status, anonymity_reason}`. And never `stolen: true` booleans — only sourced claim
registrations: `{registry: 'lostart.de', date, status: 'unresolved'}`.

### Agents (honest assessment)

AI cataloguing assistance is real and current (vendor features, house pilots); ML price
estimation is a crowded proprietary field; **agent bidding is speculative — no house
accepts it today**. The module is therefore agent-*readable* everywhere (schemas, enums,
cited sources, machine handshakes we already ship) but bets nothing on agent *transactions*.

## Part II — the module

Four pillars, each mapping onto machinery that already exists in `functions/api/`:

| Pillar | What | Existing machinery |
|---|---|---|
| **Reference** (GET) | fee schedules, thresholds, vocab, heading ladder | static JSON + `loadCollection`, cache 3600 |
| **Computation** (GET) | premium math, ARR, licensing gates | pure functions, stateless, replayable |
| **Validation** (POST) | lot / provenance / results records | strict toolkit, canonical-JSON sha256 witness, `202 persisted:false` |
| **Voluntary submission** | houses feed their own results | witness receipt + PR/redeploy persistence path |

### Phase-one endpoints (three waves)

**Wave 1 — pure static + pure math (zero legal or upstream risk):**

| Endpoint | Purpose |
|---|---|
| `GET /api/trade` | self-describing directory, dual human/agent summary |
| `GET /api/trade/fees?house&location&category&as_of` | buyer's-premium bands with `effective_from/to` — first machine-readable rate cards anywhere |
| `GET /api/trade/fees/compute?hammer&currency&house&location&as_of` | all-in cost, line items, `schedule_applied`, explicit `not_included` |
| `GET /api/trade/arr?price&currency&sale_date&artist_death_year` | ARR bands, €12,500 cap status, liable society, `informational_only: true` |
| `GET /api/trade/thresholds?jurisdiction&as_of` | dated compliance constants with `source_url` per entry |
| `GET /api/trade/gates?year&value&currency&jurisdiction&materials=` | "does this object cross a licensing gate in X" in one call, each gate citing its regulation |
| `GET /api/trade/vocab[/:id]` | lifecycle, settlement_status, heading-qualifier ladder, catalogue symbols, gallery availability states; mediums mapped to Getty AAT (ODC-By attribution) |

**Wave 2 — strict validation (clones the answering-rhyme toolkit):**

| Endpoint | Purpose |
|---|---|
| `GET\|POST /api/trade/lots` | GET serves frozen `artbitrage.lot/1` contract; POST validates JSON **or `text/csv`** (fuzzy Artlogic-shaped header mapping, then strict re-validation), echoes normalized record + `content_hash`, never stores |
| `GET\|POST /api/trade/provenance` | GET publishes the versioned AAM punctuation grammar (semicolon = transfer, period = gap); POST round-trips paragraph ↔ `artbitrage.provenance-chain/1` |

**Wave 3 — the flywheel:**

| Endpoint | Purpose |
|---|---|
| `GET\|POST /api/trade/results` | houses submit their own results: validation + witness receipt + `next_steps` to the PR persistence path; GET serves the corpus with an **honest coverage matrix** — thin stated plainly, never fake-full |

### Schema sketches

`artbitrage.lot/1` — the syndication record: Object ID nine-field core (`type, materials,
measurements{value,unit,normalized_cm}, inscriptions, distinguishing_features, title,
subject, date_period, maker`), `heading {display, qualifier_code, warranty_bearing}`,
`estimate`, `reserve_exists: bool|null`, **separate** `lifecycle` and `settlement` blocks,
`compliance_flags {species_materials[], made_before, arr_candidate, export_gate_candidates[]}`,
multi-script `maker_names [{script:'Hani', value:'張大千'}, {value:'Zhang Daqian', system:'pinyin'}]`,
`prices.fee_schedule_ref`, `rights`, `content_hash`.

`artbitrage.provenance-chain/1` — ordered events with the pseudonymous party block above,
`method: purchase|gift|descent|consignment|unknown`, dated with status, `claim_registrations[]`,
`display_string`, `grammar: 'aam-provenance/1'`, `parse_warnings[]`.

`artbitrage.fee-schedule/1` — `bands [{over, up_to, rate}]`, `extras [{name, basis, rate,
status: 'source-declared|contested|unverified'}]`, `payment_deadline_days`,
`deposit_required` (mainland schedules carry flat premiums + deposits), `effective_from/to`,
`source_url`, `license_verified: false`.

### Truth-labeling rules (non-negotiable)

- Every reference record: `source_url`, effective dates, `license_verified`.
- Conflicting sources ship as `status: 'contested'` **with both citations** (e.g. HMRC
  premises fee £300 vs £400).
- Every calculator: `schedule_applied` in-band, explicit `not_included`,
  `informational_only: true, legal_advice: false`.
- Every POST: full non-capability block; `202`, `persisted: false`; witness receipts say
  plainly that `witnessed_at` is unattested.

### Adoption path — value on first curl

Day 1, no signup: a cataloguer calls `fees/compute` instead of hand-reading three PDF rate
cards; a registrar pastes a provenance paragraph into `provenance` and files the structured
chain with the due-diligence pack. Day 2: the registrar POSTs the CSV they already export
from Artlogic and gets back normalized records, Object ID gaps, species flags, AAT-mapped
mediums. Day 3: the house submits last sale's results and becomes openly citable with deep
links routing bidders home. Each step stands alone; nothing requires migrating anything.

## Part III — explicitly NOT built

1. **Scraped calendars/lot aggregation** — *Innoweb*/ToS; partner feeds only.
2. **Verbatim catalogue text or house photography** — *Camard* (~€1M, twice), *Infopaq*;
   facts only, our own neutral machine text.
3. **Bidding, payments, escrow, guarantees** — we cannot hold funds; that layer is the
   incumbents' fee extraction, and our position is distribution without a take-rate.
4. **Named living-party registries, entity resolution on private persons, stolen/looted
   flags** — *Sovim*, slander-of-title risk; sourced claim registrations only.
5. **Black-box valuations** — LiveArt/Wondeur sell scores; an open layer wins with
   reproducible comparables and methodology or nothing.
6. **A gallery CMS / any persistence** — that is a worse Artlogic. The moat is freshness,
   normalization quality, and being the schema other tools speak through.

## Part IV — phase two (deferred, with reasons)

- `GET /api/trade/reconcile` (artist-name reconciliation over Wikidata + pinyin/Wade-Giles
  variant tables) — valuable, but a live upstream dependency and a real curation project.
- `artbitrage.condition-report/1` — publishing an open condition standard is the product,
  and deserves practitioner input, not a v1 guess.
- Linked Art / LIDO serializations — heavy; CSV→lot/1 is the 80% case and ships in wave 2.
- `POST /api/trade/intents` (witnessed consign/bid intents) — cut: no house accepts agent
  transactions today, and witnessing a "bid interest" gestures at effect we disclaim.
  Revisit when a real house asks.

## Appendix — verify before encoding (the critic's caution list)

The fee/threshold datasets are a permanent editorial liability; these specific claims from
the research corpus are **contested or thinly sourced** and must be re-verified against
primary sources before they enter `trade.json`: Phillips Priority Bidding discount (single
PDF); Sotheby's overhead premium surviving the 2026 restructure; Christie's Sept 2025 bands
(cited via a Sotheby's article); guarantee share (72.9% is share of evening-sale *value*,
not lots); Gavelist cataloguing economics (vendor calculator, internally inconsistent);
Art Basel booth pricing units (per-sqm vs per-sqft garbled); HMRC premises fee (£300 vs
£400); Artprice/artnet coverage counts (marketing figures); "Artlogic/Arternal have no
public API" (directory-listing evidence only — confirm with vendors); US antiquities-rule
status (verify via Federal Register). Sotheby's seller commission is negotiated deal terms,
not a schedulable rate — never encode it as one.

---

*Research provenance: workflow `wf_3f187214-be9`, 16 agents, 284 web/tool calls, all
dimensions returned. The judge's synthesis (enrichment spine; portable-records schemas;
agent-native's `gates` endpoint and disclosure blocks; intents cut) is adopted in full.*
