// build-pigments — assemble pigments.json (+ dist mirror) for the pigment/colour
// vertical from the researched corpus (tools/pigments-corpus.json), applying the
// fact-check corrections in the open and adding an honest sRGB swatch per record.
//
// Additive by design: mirrors tools/bake-rates.mjs (writes root + dist copy).
// The corpus snapshot date is pinned below so rebuilding is deterministic.
// Advance it deliberately whenever the researched corpus changes.
//
// Run:  node tools/build-pigments.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_SNAPSHOT_DATE = '2026-07-23';

const pigments = JSON.parse(await readFile(join(root, 'tools', 'pigments-corpus.json'), 'utf8'));
const byId = Object.fromEntries(pigments.map((p) => [p.id, p]));

// ── helpers ─────────────────────────────────────────────────────
const applied = [];
function note(id, field, what) { applied.push({ pigment_id: id, field, applied: what }); }
function addSource(p, url) { if (!p.sources.includes(url)) p.sources.push(url); }
function replaceOnce(haystack, needle, replacement, ctx) {
  if (!haystack.includes(needle)) throw new Error(`build-pigments: expected text not found for ${ctx}: "${needle}"`);
  return haystack.replace(needle, replacement);
}

// ══ FACT-CHECK CORRECTIONS ══════════════════════════════════════
// 1) tyrian-purple — MAJOR/blocker: synthetic-existence floor is 1903
//    (Sachs & Kempf), not 1914. Friedländer (1909) only confirmed the
//    synthetic compound is identical to ancient Tyrian purple.
{
  const p = byId['tyrian-purple'];
  const sf = p.dates.synthetic_from;
  sf.year = 1903;
  sf.text = "6,6'-dibromoindigo was first synthesised in the laboratory by Sachs & Kempf in 1903 (a second route by Sachs & Sechel followed in 1904). Paul Friedländer's 1909 work determined the structure and confirmed the synthetic compound was identical to ancient Tyrian purple — it did not first make it. It was never synthesised at commercial scale, so any pre-1903 occurrence is necessarily natural murex extract.";
  sf.truth_status = 'verified';
  sf.source_url = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6236399/';
  addSource(p, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6236399/');
  p.production = replaceOnce(
    p.production,
    'First laboratory synthesis reported 1914 (Friedländer having determined the structure in 1909);',
    'First laboratory synthesis reported 1903 (Sachs & Kempf), with a second route in 1904; Friedländer determined the structure in 1909 and confirmed the synthetic compound was identical to ancient Tyrian purple;',
    'tyrian-purple.production'
  );
  p.anachronism_marker.note = replaceOnce(
    p.anachronism_marker.note,
    'Since it was never made synthetically before 1909/1914,',
    'Since it was never made synthetically before 1903,',
    'tyrian-purple.anachronism_marker'
  );
  note('tyrian-purple', 'dates.synthetic_from.year', '1914 → 1903 (Sachs & Kempf); truth_status → verified; production + marker text corrected');
}

// 2) cochineal-carmine — minor: first-use date is genuinely debated; soften
//    the overclaimed 'verified' to 'source-declared' and state the earlier bound.
{
  const p = byId['cochineal-carmine'];
  p.dates.first_attested.truth_status = 'source-declared';
  p.dates.first_attested.text += ' Authoritative Andean-textile sources place cochineal use considerably earlier (Paracas/Nasca tradition, cited as early as ~2000-2300 BCE), so the earliest date is unsettled and c.700 BCE stands only as a conservative lower bound.';
  addSource(p, 'https://andeantextilearts.org/cochineal-a-simple-bug-on-a-cactus-pad/');
  note('cochineal-carmine', 'dates.first_attested.truth_status', 'verified → source-declared; earlier Andean bound noted');
}

// 3) ultramarine — minor: earliest pigment-use date is debated (Kizil 3rd–4th c
//    predates the 600 CE Bamiyan floor); soften 'verified' to 'source-declared'.
//    The HARD synthetic floor (1826/1828) is correct and untouched.
{
  const p = byId['ultramarine-natural-lapis-lazuli'];
  p.dates.first_attested.truth_status = 'source-declared';
  addSource(p, 'https://www.artsupplies.co.uk/blog/artists-pigments-a-history-of-ultramarine-blue/');
  note('ultramarine-natural-lapis-lazuli', 'dates.first_attested.truth_status', 'verified → source-declared (Kizil predates the Bamiyan floor)');
}

// 4) vermilion-cinnabar — minor: flat type='mineral' mis-signals natural
//    provenance. It is dual-origin; the art-dominant form is ancient SYNTHETIC
//    vermilion, chemically identical to the mineral (both PR106).
{
  const p = byId['vermilion-cinnabar'];
  p.type = 'mineral-or-synthetic-inorganic';
  p.type_note = 'Dual-origin pigment: natural cinnabar (mined mineral HgS) and synthetic vermilion (dry-process HgS from mercury + sulfur, ancient and the art-dominant form), chemically identical (both PR106). Presence is NOT evidence of natural mineral origin.';
  note('vermilion-cinnabar', 'type', "mineral → mineral-or-synthetic-inorganic (+ type_note); dual-origin made explicit");
}

// 5) indian-yellow — minor: the Journal of the Society of Arts inquiry was
//    T. N. Mukharji's 1883 investigation and report (not 1886; he investigated
//    locally in Monghyr rather than 'sending investigators').
{
  const p = byId['indian-yellow'];
  p.stories[2].text = "Its origins were a genuine mystery to 19th-century Europe. Prompted by Sir Joseph Hooker's 1883 inquiry, T. N. Mukharji investigated locally in Monghyr, Bengal, tracing the 'purree of India' to the cattle owners there, and reported his findings in the Journal of the Society of Arts in 1883 (some secondary sources repeat an erroneous 1886 date).";
  p.stories[2].source_url = 'https://en.wikipedia.org/wiki/Indian_yellow';
  addSource(p, 'https://en.wikipedia.org/wiki/Indian_yellow');
  note('indian-yellow', 'stories[2]', 'inquiry date 1886 → 1883 (Mukharji), local investigation corrected');
}

// 6) lead-white — minor: the specific 'Maria Gunning died of ceruse' attribution
//    is disputed (DIB: died of tuberculosis). Do not launder it as source-declared.
{
  const p = byId['lead-white'];
  p.stories[0].text = "As the cosmetic 'Venetian ceruse' it whitened fashionable complexions from antiquity through the 18th c., and lead cosmetics are blamed for chronic poisoning, skin damage and death. Maria Gunning, Countess of Coventry (d. 1760), is the name usually cited — but her cause of death is disputed: the Dictionary of Irish Biography records she died of tuberculosis, and death-by-ceruse may be a later legend.";
  p.stories[0].source_url = 'https://www.dib.ie/biography/gunning-maria-a3688';
  p.stories[0].truth_status = 'contested';
  addSource(p, 'https://www.dib.ie/biography/gunning-maria-a3688');
  note('lead-white', 'stories[0].truth_status', 'source-declared → contested; Gunning attribution softened per DIB');
}

// ── honest sRGB swatches (approximate — a screen cannot render grade,
//    grind, binder, layering, age, or Egyptian blue's near-IR luminescence) ──
const SWATCH = {
  'egyptian-blue': '#1346A6',
  'tyrian-purple': '#66023C',
  'lead-white': '#F4F1E9',
  'vermilion-cinnabar': '#E34234',
  'ultramarine-natural-lapis-lazuli': '#1B3F9B',
  'cochineal-carmine': '#9E1B32',
  'prussian-blue': '#013A63',
  'indian-yellow': '#E3A72F',
  'mummy-brown': '#4A2C1A',
  'scheeles-green': '#5E9C3A',
  'emerald-green': '#17A589',
  'cobalt-blue': '#1B4FA0',
  'titanium-white': '#FBFBF7',
  'mauveine': '#8E4585',
  'viridian': '#2E8B7A',
  'cadmium-yellow': '#F4C400',
};
for (const p of pigments) {
  const hex = SWATCH[p.id];
  if (!hex) throw new Error(`build-pigments: no swatch defined for ${p.id}`);
  p.swatch = { hex, approximate: true };
}

// ── assemble ────────────────────────────────────────────────────
const out = {
  schema: 'artbitrage.pigments/1',
  essence: 'The pigments of art history as machine-readable, source-cited facts: what each colour is, when it first appears, and when it could not yet exist. A dating tool that only ever argues AGAINST a claim, never for it. No keys, no database, no funds, no take-rate.',
  disclosure: {
    informational_only: true,
    authentication_advice: false,
    not_authentication: 'A pigment that postdates the claimed date is strong evidence AGAINST authenticity; a period-consistent palette can NEVER prove authenticity. Real pigment identification needs lab analysis (XRF/Raman/cross-section); this endpoint only reasons over pigments you supply, using first-attested dates that themselves carry uncertainty.',
    note: 'Reference facts over cited pigment histories. Every dated milestone and story carries source_url plus a truth_status (verified | source-declared | contested | unverified); descriptive fields are syntheses from each pigment’s cited sources list. First-attested and invention dates carry their own uncertainty; confirm against the primary source and real analysis before drawing a conclusion. Never an authentication, valuation, or legal judgement.',
  },
  swatch_note: 'Every swatch hex is an honest sRGB approximation only. Real pigment appearance depends on grade, grind, binder, layering and age; effects like Egyptian blue\'s near-infrared luminescence cannot be shown on a screen at all.',
  generated_at: CORPUS_SNAPSHOT_DATE,
  count: pigments.length,
  pigments,
};

const body = JSON.stringify(out, null, 2) + '\n';
await writeFile(join(root, 'pigments.json'), body);
await writeFile(join(root, 'dist', 'pigments.json'), body);

console.log(`built pigments.json + dist/pigments.json — ${pigments.length} pigments`);
console.log(`corrections applied: ${applied.length}`);
for (const a of applied) console.log(`  • ${a.pigment_id} [${a.field}] — ${a.applied}`);
