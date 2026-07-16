# ART-WORLD-INFRA — what the art world needs, infrastructure-wise

*Survey of 2026-07-16, from a 5-agent research pass (~110 web calls): artists & estates,
museums & institutions, movement of art, collectors & buyers, and the data layer under
all of them. Sequel to [TRADE-MODULE.md](TRADE-MODULE.md), which answered the same
question for auction houses & galleries. Facts carry their dates; sources cited inline.*

## The finding, in one line

**The art world's rules are public, mechanical, and unshipped as code** — incumbents
monetize *knowing* them (consultants, brokers, paywalled databases, 48-hour quotes),
every standard lives as a PDF or prose, and nobody serves the machine-readable layer.
That asymmetry recurs in all five segments, and it maps exactly onto what artbitrage
already is: open reference data + pure computation + strict validation, no keys, no
database, no funds, no take-rate.

A second phrasing, from the data-layer pass: the art world has **standards without
servers** (EDTF dates, CDWA dimensions, Object ID, IPTC artwork fields), **servers
without standards** (every gallery CSV a per-vendor dialect), and **authorities without
crosswalks** (ULAN / Wikidata / VIAF / ISNI, stitched only by volunteers).

## Why now

- **The open commons is shrinking while the rules grow.** Since the 2025 bot wars,
  GLAM institutions are re-fencing: 32 of 43 surveyed orgs deployed anti-crawler
  countermeasures (GLAM-E Lab, June 2025); Cloudflare default-blocks AI crawlers
  (July 2025); Wikimedia and VIAF rate-limits are strangling the free reconciliation
  APIs (2025). Explicitly agent-welcome, static, open reference data is getting *more*
  valuable, not less — and that is artbitrage's exact position.
- **Infrastructure is dying faster than it's built.** NEPIP (the US Nazi-era provenance
  portal) archived July 2024 after 21 years; ARIS, the only art title insurer, stopped
  underwriting — title risk is now uninsurable at any price; IFAR's authentication
  service closed after 50+ years; catalogue-raisonné platforms churned (Artifex Press →
  donated away; panOpticon → wound down). Meanwhile artnet was taken private by
  Beowolff Capital (May 2025), which also owns Artsy — the largest paid and largest
  free price databases now share one undisclosed owner.
- **The rules re-priced themselves in 2025–26.** EU VAT reform effective 2025-01-01
  (Directive 2022/542: FR 5.5%, DE 7%, IT 5%, margin-scheme incompatibility); EU import
  regulation 2019/880 fully live 2025-06-28; US tariff whiplash ending in the Supreme
  Court striking IEEPA tariffs (2026-02-20) with de minimis suspended indefinitely
  (2026-06-24); eATA digital carnets live in 30 countries 2026-06-01; HEAR Act made
  permanent 2026-04-13; Bizot Green Protocol adopted by Getty/LACMA/MOCA/Hammer
  (2026-03). Every change lands as prose; none lands as data.

## The map — five segments, the load-bearing gaps

### Artists & estates

- **Certificates of authenticity have no standard at all** — no law, no field list, no
  schema. Every COA vendor's format *is* its moat (Verisart $1/cert to $99.99/mo;
  Arcual, Fairchain each a proprietary chain-registry). Blockchain COAs secured tokens,
  not data; none interoperate. A $0-budget artist has nothing neutral to conform to.
- **Copyright status is genuinely hard** — "life + 70" is only the headline (French war
  extensions, US publication-based terms, orphan works); existing calculators are
  US-only web forms with no API.
- **Resale right spans 106 countries** (WIPO, 2024-01-01) with divergent thresholds,
  bands, caps, and liable parties; no machine-readable multi-jurisdiction table exists.
  DACS distributed £16.1M in 2024; compliance runs on truthful self-declaration.
- **Consignment splits are quietly abused** (net-vs-retail basis, unagreed deductions,
  vague payment timing; ~30 US states have consignment statutes nobody serves as
  reference). The Siegelaub contract (1971) failed because contracts need bargaining
  power; a *checklist/validator* has no adoption veto.
- **Authentication authority is a vacuum** — Warhol board dissolved 2011 (>$7M legal
  fees on one suit), Basquiat/Haring/Lichtenstein followed, IFAR closed. Opinion is
  radioactive; what's serveable is the bibliographic *fact* of which catalogue
  raisonné / foundation is (or was) the authority of record, with dates and status.
- Catalogue raisonnés cost $500k–$1.3M and a decade+; each project rebuilds its data
  model; platform deaths strand the catalogues. A portable entry schema is the missing
  piece, not another platform.

### Museums & institutions

- **The whole loan pipeline is PDF and Word** — AAM General Facility Report (2019),
  UKRG facility/courier documents, NEMO standard loan agreement: hundreds of fields
  re-answered per venue, per lender, forever. Nobody owns this space digitally.
- **Environmental rules are pure functions published as PDFs** — Bizot 2023
  (16–25°C / 40–60% RH, ±10% RH per 24h), ASHRAE climate classes, lux-hour budgets
  (50 lux sensitive-class, ~33k–450k lux-h budgets, ~3-year rest periods). The
  National Gallery's open-source Lux Allowance Calculator proves computability —
  it's a web page, not an API.
- **Object ID** — the ICOM/Getty 9-category minimal description standard, endorsed by
  FBI/Interpol, exists as a one-page PDF checklist in 17 languages. No JSON schema,
  no validator, anywhere.
- **Indemnity schemes are computable eligibility buried in guidelines** — US Arts &
  Artifacts: $1.0B/exhibition domestic within $7.5B aggregate, $1.8B/$15B
  international, fixed deadlines; UK GIS free but 3-months-ahead by emailed form.
  Six-figure premium decisions made by reading prose.
- **Provenance/restitution reference is scattering just as the law hardens** — NEPIP
  gone (2024-07), >100k covered objects in US museums with ~10% publicly researched
  (WJRO, 2025-09-25), Washington Best Practices (2024-03) and the permanent HEAR Act
  (2026-04-13) still PDF-only. Rules and red-flag logic (a 1933–45 continental-Europe
  gap in a provenance chain is *detectable*) are serveable; a looted-art registry is not.
- Migration between collection systems is "80% data cleaning" (Lucidea); 34% of small
  museums run collections on FileMaker/Access/Excel (Canadian Heritage, 2016). The
  missing piece is a validation layer, not another CMS.

### Movement of art (shipping, customs, insurance)

- **Export licensing is the clearest structural void found.** Every country a different
  age+value threshold — France €300k paintings (2025), Germany 75yr/€300k intra-EU vs
  50yr/€150k external, Italy 70yr/€13.5k with a €50k exemption from 2026-05-04, China
  era-based cutoffs, India 100-year ban, US none. UNESCO's CultNatLaws is a document
  index, not a threshold table. **No machine-readable multi-jurisdiction table exists
  anywhere.** artbitrage already serves the UK slice; the world mirror is unbuilt.
- **The 2025 EU VAT reform created a computable-but-uncomputed decision**: import at
  the reduced rate (FR 5.5% / DE 7% / IT 5%) *or* preserve margin-scheme eligibility —
  deterministic arithmetic on published rates, currently sold as per-transaction tax
  advice.
- **ATA carnets are priced by table, decided by folklore** — USCIB fees $255–$545 by
  value band, bonds 40% (60% Brazil, 55% India), validity 6/12/48 months, carnet-vs-
  temporary-admission a per-fair judgment call bought as consultancy. eATA went live
  in 30 countries 2026-06-01; the decision logic is still nowhere as data.
- **~60% of fine-art claims are transit-related** (AXA XL), which makes the condition
  report at each handover the load-bearing legal document — and there is no open
  interchange schema for it (Articheck from £55/mo, Horus: each proprietary).
- HS chapter 97 boundary logic is stable treaty text nobody serves: first 12 castings
  = original sculpture, hand-executed plates for prints, 100-year antique rule, 6.6%
  penalty duty on misclassified antiques.
- Quoting stays opaque end-to-end: 48–72h turnarounds, "contact sales" APIs (ARTA),
  proprietary algorithms (Convelio), no published rate cards in storage either.

### Collectors & buyers

- **The buyer pays retail for prose**: $110/lot for the stolen-art search the trade
  treats as standard (Art Loss Register; Interpol's 57k-object database is free but
  unintegrated), $3,000–4,000 per catalogue-raisonné inclusion request (WPI), $29+/mo
  to see a price, 1.5–2.5% for title insurance that no longer exists.
- **Due-diligence norms are already checklists** — the Geneva RAM toolkit (client DD /
  artwork DD / transaction DD with red-flag taxonomy) plus the OFAC art advisory
  (>$100k, 2020-10-30) — published as web prose, never as schema. ⚠️ RAM states no
  explicit license; codify independently from the underlying public rules with
  citation, or ask.
- **Tax mechanics are fully mechanical and fully scattered**: UK chattels £6,000
  exemption + 5/3 marginal relief + wasting-asset rules (HS293); US 28% collectibles
  rate, §1031 gone since 2018, donation gates at $5k/$20k/$50k (qualified appraisal /
  attach appraisal / Art Advisory Panel referral, 26 CFR 1.170A-17).
- **Art-secured lending is $34–40B (2025)** gated on USPAP appraisals, LTV 50–70%,
  with no way to compare all-in borrowing cost and nothing that validates whether an
  appraisal report even contains the elements the IRS requires.
- Only 34% of collectors use dedicated documentation systems; ~$992B of art changes
  hands over the next decade (Deloitte Art & Finance 2025). Records die with vendor
  subscriptions; estates inherit chaos. The fix that fits: a portable dossier schema,
  not another vault.

### The data layer

- **There is no ISBN for art.** The Art Identification Standard consortium said so
  itself (2020) and has shipped nothing in six years — every attempt couples the ID to
  a monetizable registry. The workable open move is not a registry but a **record
  fingerprint convention** (canonical-JSON sha256 over creator-QID + normalized title +
  year-range + dimensions-mm + collection + inventory-number) — deduplication without
  authority claims. artbitrage already has the hashing machinery.
- **Free reconciliation is being rate-limited to death** (Wikimedia mid-2025 blocking
  ~30% of OpenRefine requests; VIAF aggressive limits since 2025-01). Static,
  versioned crosswalk tables (ULAN ↔ Wikidata ↔ VIAF, ODC-By + CC0 licensed) are the
  right shape; live proxying is not.
- **Romanization chaos is a real cataloguing cost** — "Ch'i Pai-shih" and "Qi Baishi"
  as two rows; the concordances exist as PDFs (FU Berlin) and library guides, never
  JSON. Korean (McCune-Reischauer vs Revised) and Japanese (Hepburn variants,
  name order) add layers.
- **Nobody serves historical money**: provenance chains carry guineas, pre-decimal
  £sd, francs, reichsmarks; the conversion tools are academic web forms with
  restricted terms (MeasuringWorth). Open government series (ONS, BLS, BoE/Fed) can
  back a static table + stateless converter that states its method in-band.
- **Dates ship as free text** ("ca. 1503–6", "fl. 1420s", "Tang dynasty") though the
  standard exists (LoC EDTF, in ISO 8601-2). The one serious open museum MCP server
  (open-museum-mcp, v0.9.0, 2026-06) had to hand-roll "dynasty-aware date parsing" —
  independent proof the served parser is missing.
- **No maintained map of which museum APIs are alive.** Rijksmuseum killed five legacy
  APIs 2026-01-05 (the replacements dropped key requirements); Europeana and
  Smithsonian added keys; the community wiki is a decade stale.

## The build list — ranked across all segments

Three families, each cloning machinery that already exists in `functions/api/`.

### A. Schemas + validators (clones the lot/provenance toolkit; POST validates, never stores)

| # | What | Why it wins |
|---|---|---|
| A1 | **COA schema** (`artbitrage.coa/1`) | Zero standard exists; every vendor format is a moat; pure schema+validate, no registry, no opinion |
| A2 | **Object ID schema** (`artbitrage.objectid/1`) | ICOM/FBI/Interpol-endorsed 9 fields, PDF-only since 1999; tiny, universal, high legitimacy |
| A3 | **Condition-report-at-handover schema** | 60% of claims are transit; every proprietary tool fragments the space. (TRADE-MODULE deferred the full condition standard for practitioner input — the *handover* slice is narrower and shippable) |
| A4 | **Loan-cycle schemas**: facility report, loan agreement, courier brief | Largest per-registrar pain; AAM sells a PDF, UKRG posts Word files. Schema and validator only — completed reports are confidential, never hosted |
| A5 | **Due-diligence checklist schema** + red-flag vocabulary | RAM/OFAC/AML rules are public and checklist-shaped; mind the RAM license caveat |
| A6 | **Consignment checklist schema** + state/country statute reference | Encodes the known abuse points (split basis, deduction whitelist, payment deadline, trust clause) |
| A7 | **Qualified-appraisal (USPAP/IRS) report validator** | Straight from 26 CFR 1.170A-17 + Form 8283; validates structure, never value; serves both lending and donation gates |
| A8 | **Catalogue-raisonné entry schema** | Platform churn proves estates need portability more than platforms |

### B. Reference tables + calculators (clones fees/ARR/thresholds/gates; dated, source-cited, `informational_only: true`)

| # | What | Why it wins |
|---|---|---|
| B1 | **Multi-jurisdiction export-gate table + calculator** | The clearest void found; extends the existing `/api/trade/gates` UK logic worldwide (FR/DE/IT/EU-116/2009/CN/IN/US) |
| B2 | **VAT + margin-scheme calculator** (post-2025 EU reform) | Deterministic arithmetic currently sold as tax advice; pairs with the existing all-in cost calculator |
| B3 | **Global ARR table (106 jurisdictions)** | Natural extension of the shipped UK ARR endpoint; WIPO-derived facts |
| B4 | **Copyright-status calculator** (life dates + jurisdiction → status) | Term-rule tables incl. war extensions and US publication rules; caller supplies facts |
| B5 | **Collector tax calculators**: UK chattels/CGT 5/3 relief, US collectibles 28%, donation thresholds | Statutory, dated, identical in character to shipped thresholds |
| B6 | **ATA carnet estimator + carnet-vs-TA decision tree** | Fee/bond/validity tables public; timed to the eATA rollout (2026-06) |
| B7 | **Indemnity reference** (US A&A limits/deadlines, UK GIS rules) + eligibility check | Rarely-changing published numbers; six-figure decisions |
| B8 | **Environmental math**: lux-hour budgets, Bizot/ASHRAE spec check | Pure functions over published numbers; Bizot adoption wave makes it timely |
| B9 | **HS chapter-97 boundary reference** (12 castings, hand-executed plates, 100-year rule) | Stable treaty text; link out to live tariff APIs, never mirror them |
| B10 | **Restitution rules layer**: Washington Best Practices definitions, HEAR Act status, per-country body directory, 1933–45 gap detection over a submitted provenance chain | Extends the shipped provenance-chain grammar; rules, never a registry |

### C. Data plumbing (static-first, no live upstream)

| # | What | Why it wins |
|---|---|---|
| C1 | **Circa-date parser → EDTF** | Highest value-to-effort in the whole survey; deterministic, zero upstream, proven demand |
| C2 | **Dimension-string parser** ("20 1/8 × 13 in. (sheet)" → mm + qualifier) | Small, pairs with existing CSV round-trip validation |
| C3 | **Romanization variant tables** (pinyin↔Wade-Giles, MR↔RR, Hepburn) + artist-name crosswalk (ULAN↔Wikidata↔VIAF), static JSON | Rescues what live reconciliation APIs are losing to rate limits; ODC-By/CC0 sources |
| C4 | **Historical currency tables + converter** (method stated in-band; £sd and guineas as vocabulary) | Fills the "£12,000 in 1962 → today" provenance hole; open government series only |
| C5 | **Museum-API liveness registry** (`artbitrage.api-registry/1`) | 2025–26 churn proves need; nobody maintains the map; static with re-verification dates |
| C6 | **Record-fingerprint convention** (named, documented canonical-JSON sha256 recipe) | Already built — needs a name and a page, honestly framed as dedup, not identity |

## Never build (the constitution, restated across all five passes)

1. **No registries, no persistence** — not for COAs, titles, condition reports,
   facility reports, looted-art claims, or artwork IDs. Serve the schema; never hold
   the records. (The AIS consortium's six fruitless years are the cautionary tale.)
2. **No opinions** — authentication ($7M Warhol lesson; sued even after disbanding),
   valuation, price recommendation, attribution adjudication. Schemas about *evidence*
   and report *completeness* are the boundary.
3. **No funds** — no payments, escrow, lending, insurance quoting/binding, royalty
   collection, fractional anything.
4. **No proprietary data** — no scraped prices (artnet/Artprice moats; *Innoweb*,
   *Camard*), no ALR replication, no MeasuringWorth terms violations. Voluntary
   submission and open government/CC0/ODC-By sources only.
5. **No live proxying** of rate-limited upstreams (Wikidata, VIAF, tariff feeds) —
   static-first, versioned, cached forever.
6. **No filing into government systems** (ICG, licence portals) — artbitrage's role
   ends at "you need a licence; here is the authority, the threshold, and the form."

## Verify before encoding

The same discipline as TRADE-MODULE's appendix — these entered the corpus thinly
sourced and need primary-source confirmation before they enter served JSON: the
resale-right rules of most of the 106 jurisdictions (WIPO Lex per-country texts);
French/German/Italian export thresholds against gazette texts (the €300k figure is
press-reported); ATA bond percentages per destination (USCIB tables move); US tariff
refund mechanics (unresolved as of 2026-02); RAM toolkit licensing; CARFAC/W.A.G.E.
fee-schedule licenses before ingestion; insurance rate norms (0.5–2% is folklore-grade;
the one hard data point, ~0.14%, contradicts it); Bizot exact wording from CIMAM, not
press; EDTF profile choice (level 1 vs 2). Every number above carries its source date
in the research corpus; re-verify anything older than its subject's churn rate.

---

*Research provenance: five parallel agents, 2026-07-16, ~110 web searches/fetches,
all five dimensions returned. Full per-segment reports (with complete URL citations)
live in the session transcript; this file is the synthesis and determination.*
