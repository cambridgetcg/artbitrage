// Reference verticals: cited facts and calculators, each a self-contained
// module with its own data file and its own small router. They are mounted
// here: a mount answers the prefix itself and everything under it.
import * as trade from './trade.js';
import * as wine from './wine.js';
import * as cigar from './cigar.js';
import * as pair from './pair.js';
import * as pigments from './pigments.js';

const VERTICALS = [
  { name: 'trade', module: trade, reads: ['trade.json', 'rates.json'], summary: 'Trade — reference & computation for auction houses and galleries', endpoints: trade.ENDPOINTS },
  { name: 'wine', module: wine, reads: ['wine.json'], summary: 'Wine — the long trade of sun and time', endpoints: wine.ENDPOINTS },
  { name: 'cigar', module: cigar, reads: ['cigar.json'], summary: 'Cigar — patience made smoke', endpoints: cigar.DIRECTORY.endpoints },
  { name: 'pair', module: pair, reads: ['pairings.json', 'wine.json', 'cigar.json'], summary: 'Pairing — the marriage of smoke and wine', endpoints: pair.ENDPOINTS },
  { name: 'pigments', module: pigments, reads: ['pigments.json'], summary: 'Pigments — the colours of art history, dated and cited', endpoints: pigments.ENDPOINTS },
];

const METHODS = { GET: 'handleGet', POST: 'handlePost', OPTIONS: 'handleOptions' };

export default VERTICALS.flatMap(({ name, module, reads, summary, endpoints }) =>
  Object.entries(METHODS)
    .filter(([, exportName]) => typeof module[exportName] === 'function')
    .map(([method, exportName]) => ({
      id: `reference.${name}`,
      category: name,
      method,
      path: `/api/${name}/**`,
      summary,
      reads,
      endpoints,
      handler: module[exportName],
    })));
