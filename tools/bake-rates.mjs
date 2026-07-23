// bake-rates — pull cited FX MoneyFacts from a local MONEYWORLD node (cashloom
// sovereign) and bake them into rates.json (+ dist mirror) for the trade
// vertical's display_in conversions. artbitrage consumes the money world's
// information layer as consumer #1: every converted number on the site carries
// the fact it was computed from — source, method, recompute recipe, staleness.
//
// Run:  node tools/bake-rates.mjs        (needs `bun run src/index.ts` in
//        cashloom/sovereign — the node answers on 127.0.0.1:4747)
//
// Refuses loudly when the node is down: a silent bake of nothing would let the
// site serve conversions on air, which is exactly what MoneyFacts exist to end.

import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NODE = process.env.MONEYWORLD_URL || 'http://127.0.0.1:4747';
const CURRENCIES = ['CHF', 'CNY', 'EUR', 'GBP', 'HKD', 'USD']; // every fee-schedule currency
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function fetchFact(base, quote) {
  const res = await fetch(`${NODE}/v1/fx/${base}/${quote}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${base}→${quote}: node answered ${res.status}`);
  return res.json();
}

const facts = [];
try {
  for (const base of CURRENCIES) {
    for (const quote of CURRENCIES) {
      if (base === quote) continue;
      facts.push(await fetchFact(base, quote));
    }
  }
} catch (err) {
  console.error(`bake-rates: REFUSED — ${err.message}`);
  console.error('start the money world first:  cd ~/Desktop/cashloom/sovereign && bun run src/index.ts');
  process.exit(1);
}

const out = {
  schema: 'artbitrage.baked-rates/1',
  baked_at: new Date().toISOString(),
  generated_by: `MONEYWORLD /v1/fx (cashloom sovereign node, ${NODE}) — run your own: github.com/cambridgetcg/cashloom`,
  note: 'ECB reference rates as cited MoneyFacts, baked at build time. Each fact carries its own staleness; a fact past stale_after_s is served AS stale, never refreshed silently.',
  count: facts.length,
  facts,
};

const body = JSON.stringify(out, null, 2) + '\n';
await writeFile(join(root, 'rates.json'), body);
await writeFile(join(root, 'dist', 'rates.json'), body);
console.log(`baked ${facts.length} rate facts (${CURRENCIES.join(', ')}) → rates.json + dist/rates.json`);
