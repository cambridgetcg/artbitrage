# ART-WORLD-INFRA — what the art world needs, infrastructure-wise

*Working opportunity survey, reviewed 2026-07-23. It covers artists and estates,
museums and institutions, movement of art, collectors and buyers, and the shared data
layer. It follows [TRADE-MODULE.md](TRADE-MODULE.md). This is a prioritisation memo,
not an exhaustive market census or legal advice. Material factual and legal claims
link to their retained provenance; product gaps are explicitly framed as hypotheses.*

## The finding, in one line

**Working thesis:** many useful art-world rules and standards are public and formal
enough to encode, but are delivered as legislation, guidance, PDFs, forms, and prose
rather than small reusable data products.

That is a good fit for artbitrage: source-linked reference data, pure computation, and
strict validation, with no accounts, custody, funds, or take-rate. It is not a blank
standards landscape. [Getty CDWA] describes about 540 art-cataloguing categories and
a core subset, [ICOM Object ID] defines a minimal object-identification method, and
[EDTF] standardises uncertain and approximate dates. The opportunity is to map and
serve established work carefully, not replace it.

[Getty CDWA]: https://www.getty.edu/publications/categories-description-works-art/general-guidelines/
[ICOM Object ID]: https://icom.museum/en/resources/standards-guidelines/objectid/
[EDTF]: https://www.loc.gov/standards/datetime/edtf.html

## Why now

- Several rule changes are recent and machine-actionable. EU member states had to
  apply [Directive (EU) 2022/542] from 2025-01-01; its art-market consequence includes
  a restriction on using the margin scheme where a reduced rate was applied upstream.
  The EU cultural-goods import regime's licence and importer-statement obligations
  applied from 2025-06-28 under [Regulation (EU) 2019/880].
- Paper workflows are becoming digital without becoming easy to integrate. The ICC
  says its [eATA Carnet system] became available in 30 countries on 2026-06-01.
  That makes a dated, country-specific decision layer more useful, while the customs
  system itself remains outside artbitrage's scope.
- Holocaust-era provenance obligations remain live. The US
  [HEAR Act, Public Law 119-82] made the Act's limitation rule permanent on
  2026-04-13, while relevant records remain distributed across institutions
  catalogued by the US National Archives' [International Research Portal].
- Automated access to public knowledge is changing. Cloudflare changed the default
  for new domains to block AI training crawlers unless the owner opts in
  ([2025-07-01 announcement]), and Wikimedia's 2025–26 plan describes authentication
  and tiered access for high-volume scraping and API use ([Wikimedia plan]). Static,
  versioned datasets with clear licences and source dates are therefore useful
  complements to live upstream APIs.

[Directive (EU) 2022/542]: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022L0542
[Regulation (EU) 2019/880]: https://eur-lex.europa.eu/eli/reg/2019/880/oj
[eATA Carnet system]: https://iccwbo.org/business-solutions/ata-carnet/eata-carnet/
[HEAR Act, Public Law 119-82]: https://www.govinfo.gov/content/pkg/PLAW-119publ82/pdf/PLAW-119publ82.pdf
[International Research Portal]: https://www.archives.gov/research/holocaust/international-resources
[2025-07-01 announcement]: https://blog.cloudflare.com/content-independence-day-no-ai-crawl-without-compensation/
[Wikimedia plan]: https://meta.wikimedia.org/wiki/Wikimedia_Foundation_Annual_Plan/2025-2026/Product_%26_Technology_OKRs

## The map — five segments and their most promising gaps

### Artists and estates

- **Copyright-status helper.** “Life plus 70” is not enough to determine every work's
  status. UK guidance says duration depends on the work, author, and creation or
  publication circumstances ([UK IPO guidance]); the US Copyright Office likewise
  separates post-1978 authorial works, works made for hire, and older publication-based
  rules ([Circular 15A]). A calculator can expose its inputs and rule source, but
  should never present an uncertain result as legal clearance.
- **Artist's resale right reference.** WIPO says the right has been implemented in
  more than 80 countries and is not mandatory under the Berne Convention
  ([WIPO resale-right overview]). Implementations differ, so the useful data is
  jurisdiction, effective date, primary law, threshold, bands, cap, liable party, and
  reciprocity—not a bare global count. WIPO's [implementation toolkit] is a useful
  design source, not a substitute for national law.
- **Consignment checklist.** Requirements vary by jurisdiction. As a concrete example,
  Oregon treats specified art and sale proceeds as trust property and requires written
  contracts to cover listed terms ([ORS 359.200–359.255]). A useful product would ask
  about the split basis, permitted deductions, payment timing, trust treatment, risk,
  and termination, while linking to the applicable primary law.
- **Neutral COA profile — discovery hypothesis.** This review did not identify a
  public, jurisdiction-neutral certificate-of-authenticity schema with stable
  interoperability rules. That is a bounded search result, not proof that none exists.
  Before building, interview artists, estates, conservators, and existing providers;
  distinguish creator attestation from third-party authentication.
- **Portable catalogue entry.** Do not start from zero: CDWA supplies descriptive
  guidance and core fields, and explains that it is not itself a data model
  ([CDWA guidance]). A portable profile should map to CDWA/LIDO and retain source,
  uncertainty, and attribution history.

[UK IPO guidance]: https://www.gov.uk/government/publications/copyright-notice-duration-of-copyright-term/copyright-notice-duration-of-copyright-term
[Circular 15A]: https://www.copyright.gov/circs/circ15a.pdf
[WIPO resale-right overview]: https://www.wipo.int/en/web/copyright/activities/resale-right
[implementation toolkit]: https://www.wipo.int/edocs/mdocs/copyright/en/sccr_45/sccr_45_inf_2.pdf
[ORS 359.200–359.255]: https://www.oregonlegislature.gov/bills_laws/ors/ors359.html
[CDWA guidance]: https://www.getty.edu/publications/categories-description-works-art/general-guidelines/

### Museums and institutions

- **Loan-cycle schemas.** Common source documents include AAM's
  [General Facility Report], the [UKRG facilities report], and NEMO's
  [standard loan agreement]. A mapping plus validator could reduce repeated entry
  while keeping completed reports private. Field-level reuse and copyright
  permissions must be checked before copying any form.
- **Environmental checks with context.** The [CIMAM Bizot Green Protocol] gives
  starting points of 40–60% relative humidity, a maximum 10% RH change in 24 hours,
  and 16–25°C for many objects. It explicitly says these are not universally
  prescriptive and that vulnerable materials need conservator evaluation. A checker
  must preserve those qualifications rather than turn the ranges into universal
  pass/fail rules.
- **Object ID JSON profile.** [ICOM Object ID] describes nine information categories
  plus four documentation steps, available in 17 languages. Interpol calls it an
  international description standard and explains the fields used for its stolen-art
  database ([Interpol Object ID]). A JSON profile and validator could implement the
  published method without claiming a new standard.
- **Indemnity reference.** The US Arts and Artifacts Indemnity Program publishes
  current single-exhibition and aggregate limits: $1.0B/$7.5B for domestic exhibitions
  and $1.8B/$15B for international exhibitions ([NEA program]). The UK
  [Government Indemnity Scheme] is a cost-free alternative to commercial insurance
  for eligible loans to public institutions. Eligibility and deadlines should be
  dated records, not hard-coded forever.
- **Provenance triage, never adjudication.** The NARA
  [International Research Portal] demonstrates that relevant records are distributed
  across many archives. A submitted provenance chain can be checked for missing
  intervals and directed to sources, but a gap is not evidence of looting and an
  automated tool cannot decide title or restitution.

[General Facility Report]: https://www.aam-us.org/2023/08/01/general-facility-report/
[UKRG facilities report]: https://www.ukregistrarsgroup.org/wp-content/uploads/2013/06/UKRG-Facilities-report.pdf
[standard loan agreement]: https://www.ne-mo.org/fileadmin/Dateien/public/NEMO_Standard_Loan_Agreement/NEMO_Standard_Loan_Agreement.pdf
[CIMAM Bizot Green Protocol]: https://www.cimam.org/sustainability-and-ecology-museum-practice/bizot-green-protocol/
[Interpol Object ID]: https://www.interpol.int/Crimes/Cultural-heritage-crime/Object-ID
[NEA program]: https://www.arts.gov/impact/arts-and-artifacts-indemnity-program
[Government Indemnity Scheme]: https://www.gov.uk/guidance/government-indemnity-scheme

### Movement of art

- **Export-gate table.** Rules differ by destination, direction of travel, category,
  age, value, and protected status. EU exports use the categories and thresholds in
  [Regulation (EC) 116/2009]; Germany publishes distinct intra-EU and external
  thresholds ([German official table]); and Italy's culture ministry says a 2026 law
  raised its threshold for specified works by deceased artists more than 70 years old
  from €13,500 to €50,000, subject to exceptions ([Italian reform summary]). These
  are examples, not a complete global table.
- **VAT and margin-scheme helper.** [Directive (EU) 2022/542] provides the EU-level
  rule, but current rates and implementation must be sourced per member state and
  effective date. The calculator should compare scenarios and show assumptions, not
  recommend a tax treatment.
- **Carnet estimator and route explainer.** US Commerce describes an ATA Carnet as
  generally valid for up to one year and notes that it does not replace required
  licences ([US ATA guide]). The US issuing body says security is usually 40% of
  shipment value, with exceptions including 55% for India ([USCIB security guide]).
  Fees, security, accepted uses, and country participation require regular
  re-verification.
- **Customs classification reference.** WCO Chapter 97 includes the international
  headings for art, collectors' pieces, and antiques ([WCO Chapter 97]). Details such
  as the “first 12 castings” rule and additional duty for some misclassified antiques
  appear in the current US schedule ([US HTS 9703]) and must be labelled US-specific,
  not described as universal treaty text.
- **EU cultural-goods import gate.** [Regulation (EU) 2019/880] distinguishes goods
  requiring an import licence from those requiring an importer statement. A helper
  can identify the likely route and source provision, but the importer remains
  responsible for the declaration and evidence.

[Regulation (EC) 116/2009]: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32009R0116
[German official table]: https://www.kulturgutschutz-deutschland.de/EN/Service/Publications/UebersichtWertgrenzenEN.pdf?__blob=publicationFile&v=2
[Italian reform summary]: https://creativitacontemporanea.cultura.gov.it/miart-2026/
[US ATA guide]: https://www.trade.gov/ata-carnet
[USCIB security guide]: https://www.atacarnet.com/Must-I-Provide-Security
[WCO Chapter 97]: https://www.wcotradetools.org/en/harmonized-system/2022/en/2197
[US HTS 9703]: https://hts.usitc.gov/search?query=9703

### Collectors and buyers

- **Due-diligence checklist.** The Responsible Art Market [due-diligence toolkit]
  separates client, artwork, and transaction checks and says its guidance is
  risk-based, non-exhaustive, and not a new uniform legal standard. The US Treasury's
  [2020 OFAC advisory] urges particular caution for certain high-value art
  transactions but says the advisory is explanatory and has no force of law. A schema
  should preserve those limits and be authored independently unless reuse permission
  is confirmed.
- **UK chattels calculator.** HMRC's current [HS293] covers chattels, while its
  [CG76577 manual] gives the £6,000 threshold and statutory five-thirds marginal-relief
  formula. A calculator needs tax-year versioning and must separate non-wasting from
  wasting assets.
- **US collectibles and exchange rules.** IRS [Topic 409] states that net collectibles
  gain can be taxed at a maximum 28% rate. IRS guidance says exchanges completed after
  2017 qualify under section 1031 only for real property ([like-kind exchange guide]),
  so artwork does not qualify.
- **US charitable-contribution intake.** IRS [Form 8283 instructions] generally require
  a qualified appraisal and Section B for property over $5,000 and require a complete
  signed appraisal to accompany the return for art deductions of $20,000 or more.
  [Publication 561] describes the optional Statement of Value request for an art
  contribution of $50,000 or more. These are distinct requirements, not three versions
  of one “approval gate.”
- **Portable object dossier — opportunity hypothesis.** A locally controlled export
  package could map Object ID and CDWA fields, documents, sources, and checksums.
  Validate the need with collectors, estates, lenders, and insurers before building a
  new vault product.

[due-diligence toolkit]: https://www.responsibleartmarket.org/guidelines/art-transaction-due-diligence-toolkit/toolkit/
[2020 OFAC advisory]: https://ofac.treasury.gov/system/files/126/ofac_art_advisory_10302020.pdf
[HS293]: https://www.gov.uk/government/publications/chattels-and-capital-gains-tax-hs293-self-assessment-helpsheet
[CG76577 manual]: https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg76577
[Topic 409]: https://www.irs.gov/taxtopics/tc409
[like-kind exchange guide]: https://www.irs.gov/businesses/small-businesses-self-employed/like-kind-exchanges-real-estate-tax-tips
[Form 8283 instructions]: https://www.irs.gov/instructions/i8283
[Publication 561]: https://www.irs.gov/publications/p561

### The data layer

- **Reuse existing descriptive standards.** [CDWA guidance] is guidance rather than a
  data model; its former CDWA Lite XML schema was incorporated into LIDO
  ([CDWA Lite]). New JSON work should publish mappings and declared departures instead
  of implying that no art data standards exist.
- **Parse uncertain dates to EDTF.** The Library of Congress [EDTF] profile defines
  levels 0, 1, and 2 and records its incorporation into ISO 8601-2. A parser can return
  the source string, parsed interval, EDTF level, and warnings rather than silently
  guessing.
- **Preserve artwork metadata in images.** IPTC's current Photo Metadata Standard
  includes a structured Artwork or Object field ([IPTC 2025.1]). This should be part
  of the crosswalk for image-bearing records.
- **Make romanisation explicit.** The Library of Congress maintains
  [ALA-LC romanisation tables] and separate conversion guidance. Variant generation
  should record the language, table, version, and direction; it must not overwrite the
  supplied name.
- **Offer historical-money methods, not one “true value.”** The Bank of England
  publishes an [inflation calculator] and explains its sources, formula, and limits.
  A reusable converter can expose the selected index and method, preserve the original
  currency notation, and avoid treating purchasing power as market value.
- **API registry — discovery project.** Institutions expose data under different
  authentication, licensing, paging, and stability conditions; for example,
  Smithsonian metadata access requires registration for an API key
  ([Smithsonian FAQ]). First inventory official documentation and re-check dates. Do
  not claim universal coverage or proxy upstream services.
- **Record fingerprint — proposed convention.** A canonical-JSON hash can help detect
  duplicate records. It is not an artwork identifier, proof of identity, provenance,
  title, or authenticity; any published recipe must define normalisation and
  versioning exactly.

[CDWA Lite]: https://www.getty.edu/publications/categories-description-works-art/cdwa-lite/
[IPTC 2025.1]: https://www.iptc.org/std/photometadata/specification/IPTC-PhotoMetadata-2025.1.html
[ALA-LC romanisation tables]: https://www.loc.gov/catdir/cpso/roman
[inflation calculator]: https://www.bankofengland.co.uk/monetary-policy/inflation/inflation-calculator
[Smithsonian FAQ]: https://www.si.edu/openaccess/faq

## Provisional build roadmap

The ordering below is a product hypothesis. Each item begins with practitioner
interviews, a source-and-licence audit, and fixtures from real documents. Only then
should it become a public endpoint under `functions/api/`.

### Phase 1 — narrow schemas and parsers

1. **Object ID JSON profile and validator** — small, established input model; retain
   ICOM terminology and map every field.
2. **Circa-date to EDTF parser** — return candidate parses, confidence/warnings, and
   the untouched source string.
3. **Dimension-string parser** — normalise units to millimetres while preserving
   qualifier, component, precision, and original text.
4. **Consignment checklist** — begin with one verified jurisdiction and a
   jurisdiction-neutral contract-completeness layer.

### Phase 2 — dated reference tables and pure calculators

1. **Export-gate reference** — launch one jurisdiction at a time; include direction,
   category, age/value tests, currency, exceptions, authority, source, effective date,
   and `informational_only: true`.
2. **UK chattels calculator** — a narrow statutory formula with tax-year fixtures.
3. **EU VAT/margin scenario calculator** — only after national implementations and
   rates are sourced independently.
4. **ATA Carnet estimator** — separate eligibility, fees, security, validity, and
   destination-specific exceptions.
5. **Indemnity reference** — source-dated US and UK records with no application
   submission.

### Phase 3 — larger crosswalks

1. **Loan-cycle mappings** — map facility report, loan agreement, courier, and
   handover concepts without hosting confidential completed forms.
2. **Due-diligence vocabulary** — independently encode public legal requirements and
   clearly attributed non-binding guidance.
3. **Copyright and resale-right tables** — jurisdiction-by-jurisdiction primary-law
   review, effective-date history, and explicit indeterminate results.
4. **CDWA/LIDO/Object ID/IPTC crosswalk** — publish provenance and lossiness for every
   mapping.
5. **Historical-currency series and museum-API registry** — static releases with
   method, licence, version, and checked-at metadata.

## Boundaries

1. **No registries or persistence** for COAs, title claims, condition reports,
   facility reports, looted-art claims, or artwork identity. Serve schemas and checks;
   do not hold the records.
2. **No opinions** on authenticity, attribution, valuation, title, sanctions
   clearance, tax treatment, or restitution. Validate structure and show sourced
   rules, uncertainty, and escalation points.
3. **No funds or regulated transaction execution**: no payments, escrow, lending,
   insurance binding, royalty collection, or fractional ownership.
4. **No proprietary-data ingestion without rights.** Prefer primary law, official
   guidance, and clearly licensed open data; record the licence with each dataset.
5. **No live proxying as a default.** Publish versioned static releases when licences
   permit, and link users to live authorities for the final check.
6. **No filing into government systems.** Explain the likely gate, cite the authority,
   and hand off.

## Verify before encoding

- Treat “no public schema/service was found” as a research finding with a search date,
  not a universal fact. Repeat discovery before committing to a product.
- Verify every national legal rule against primary legislation and official guidance;
  store jurisdiction, effective date, source URL, retrieval date, and supersession
  status. Do not infer national VAT rates from the EU directive.
- Confirm permissions before reproducing form fields, Object ID translations, RAM
  material, standards text, or third-party crosswalks. Linking to a public page does
  not establish a reuse licence.
- Keep guidance distinct from law. RAM, Bizot, and OFAC each state qualifications that
  must travel with any encoded rule.
- Make ambiguous outputs first-class: `unknown`, `needs_expert_review`, and competing
  interpretations are valid results.
- Add automated link checking, but retain a manual review cadence; a reachable page can
  still be stale or superseded.

---

*Research provenance: this working synthesis was source-audited on 2026-07-23. The
direct links in this document are the retained provenance; no external session
transcript is required to audit its material claims.*
