// Lore: the Nen framework, Whitehack, Operation Logos, the Fungi kingdom and
// the Hunter's status. Static data and local calculators; only
// /api/nen/combat/generate may ask Workers AI, and it answers without it.
import { json } from '../../_kernel/http.js';
import { safeString } from '../../_kernel/params.js';
import { resolveAiModel } from '../generate/ai-catalog.js';
import { NEN_TYPES, VOWS, DARK_CONTINENT_THREATS, TECHNIQUES, generateTechnique, nenManifest } from './nen-combat.js';
import { logosManifest, LOGOS, OPERATIONS, KINGDOM_LINK, AGENT_PROTOCOL } from './logos.js';
import { whitehackManifest, generateBattleReport, calculateLevel, WHITEHACK_NEN_MAP, SOLO_LEVELING } from './whitehack.js';
import { FUNGI, FUNGI_FAMILY, FUNGI_NEN_TYPES, HUNTER, NEN, SPECIES, SPORES } from './texts.js';

const LIGHTS = ['love', 'understanding', 'joy', 'peace', 'truth', 'art', 'wisdom', 'compassion'];
const randomOf = list => list[Math.floor(Math.random() * list.length)];

async function nenCombatGenerate({ env, query }) {
  const nenType = query.type || randomOf(['enhancer', 'transmuter', 'emitter', 'manipulator', 'conjurer', 'specialist']);
  const vowLevel = query.vow || randomOf(['vow', 'limitation', 'condition', 'penalty']);
  const threat = query.threat || randomOf(['ai', 'hy', 'ho', 'hon', 'nanika']);
  const customName = safeString(query.name, 80) || null;
  const technique = generateTechnique(nenType, vowLevel, threat, customName);

  // If AI is available, generate a technique description.
  if (env && env.AI && technique.power) {
    try {
      const resolved = resolveAiModel('text', query.model || 'llama3');
      const combatPrompt = `You are a Nen technique from Hunter × Hunter. Type: ${nenType} (${technique.nen_type_jp}). Vow: ${vowLevel} (${technique.vow_jp}). Dark Continent threat: ${threat}. Power level: ${technique.power}. Frequency: ${technique.frequency} Hz. Write a 2-line description of this technique in the style of HxH. Be dramatic and specific. 2 lines only.`;
      const aiR = await env.AI.run(resolved.model, { messages: [{ role: 'user', content: combatPrompt }] });
      technique.ai_description = (aiR.response || '').trim();
      technique.ai_model = resolved.model;
    } catch (e) { technique.ai_description_error = e.message; }
  }
  return json(technique);
}

export default [
  // ── WHITEHACK — local system Nen framework ──
  { id: 'lore.whitehack', category: 'lore', method: 'GET', path: '/api/whitehack', summary: 'Whitehack: the local-system Nen framework', handler: () => json(whitehackManifest()) },
  {
    id: 'lore.whitehack-scan', category: 'lore', method: 'GET', path: '/api/whitehack/scan',
    summary: 'Simulated scan: the interfaces and their Nen map (run the /whitehack page locally for a real one)',
    // The edge worker can't access local hardware, but the page runs locally and can.
    handler: () => json({
      scan_type: 'simulated',
      note: 'Run the /whitehack page locally to scan your actual hardware. The page uses browser APIs + the data is generated client-side.',
      interfaces: Object.keys(WHITEHACK_NEN_MAP),
      nen_map: WHITEHACK_NEN_MAP,
    }),
  },
  {
    id: 'lore.whitehack-battle', category: 'lore', method: 'GET', path: '/api/whitehack/battle',
    summary: 'A battle report from the interfaces you name active', params: 'one flag per interface, e.g. usb=true',
    handler: ({ query }) => {
      const scanResults = {};
      for (const iface of Object.keys(WHITEHACK_NEN_MAP)) {
        scanResults[iface] = { active: query[iface] === 'true' || query[iface] === '1', details: {} };
      }
      return json(generateBattleReport(scanResults));
    },
  },
  { id: 'lore.whitehack-level', category: 'lore', method: 'GET', path: '/api/whitehack/level', summary: 'The Solo Leveling rank for a power total', params: 'power', handler: ({ query }) => json(calculateLevel(parseInt(query.power || '0', 10))) },
  { id: 'lore.whitehack-ranks', category: 'lore', method: 'GET', path: '/api/whitehack/ranks', summary: 'All Solo Leveling ranks', handler: () => json({ ranks: SOLO_LEVELING, count: Object.keys(SOLO_LEVELING).length }) },

  // ── LOGOS — 暗黑大陸 Ai Operation Logos ──
  { id: 'lore.logos', category: 'lore', method: 'GET', path: '/api/logos', summary: 'Operation Logos manifest', handler: () => json(logosManifest()) },
  { id: 'lore.logos-operations', category: 'lore', method: 'GET', path: '/api/logos/operations', summary: 'The operations of Logos', handler: () => json({ operations: OPERATIONS, count: Object.keys(OPERATIONS).length }) },
  { id: 'lore.logos-kingdom', category: 'lore', method: 'GET', path: '/api/logos/kingdom', summary: 'The link to the Kingdom', handler: () => json(KINGDOM_LINK) },
  { id: 'lore.logos-protocol', category: 'lore', method: 'GET', path: '/api/logos/protocol', summary: 'The agent protocol, step by step', handler: () => json({ protocol: AGENT_PROTOCOL, steps: Object.keys(AGENT_PROTOCOL).length }) },
  { id: 'lore.logos-principles', category: 'lore', method: 'GET', path: '/api/logos/principles', summary: 'The principles of Logos', handler: () => json({ logos: LOGOS, count: Object.keys(LOGOS).length }) },

  // ── NEN COMBAT — the mechanics framework ──
  { id: 'lore.nen-combat', category: 'nen', method: 'GET', path: '/api/nen/combat', summary: 'Nen combat manifest', handler: () => json(nenManifest()) },
  {
    id: 'lore.nen-combat-generate', category: 'nen', method: 'GET', path: '/api/nen/combat/generate', ai: true,
    summary: 'Generate a Nen technique', params: 'type, vow, threat, name',
    handler: nenCombatGenerate,
  },
  { id: 'lore.nen-combat-types', category: 'nen', method: 'GET', path: '/api/nen/combat/types', summary: 'All 6 Nen types', handler: () => json({ types: NEN_TYPES, count: Object.keys(NEN_TYPES).length }) },
  { id: 'lore.nen-combat-vows', category: 'nen', method: 'GET', path: '/api/nen/combat/vows', summary: 'All 4 vow levels', handler: () => json({ vows: VOWS, count: Object.keys(VOWS).length }) },
  { id: 'lore.nen-combat-threats', category: 'nen', method: 'GET', path: '/api/nen/combat/threats', summary: 'All 5 Dark Continent threats', handler: () => json({ threats: DARK_CONTINENT_THREATS, count: Object.keys(DARK_CONTINENT_THREATS).length }) },
  { id: 'lore.nen-combat-techniques', category: 'nen', method: 'GET', path: '/api/nen/combat/techniques', summary: 'All 12 Nen techniques', handler: () => json({ techniques: TECHNIQUES, count: Object.keys(TECHNIQUES).length }) },

  // ── NEN — the framework of life energy ──
  { id: 'lore.nen', category: 'nen', method: 'GET', path: '/api/nen', summary: 'Nen framework manifest', handler: () => json(NEN) },

  // ── THE SYSTEM — Hunter status ──
  { id: 'lore.hunter', category: 'lore', method: 'GET', path: '/api/hunter', summary: 'THE SYSTEM — the Hunter\'s status', handler: () => json(HUNTER) },

  // ── FUNGI KINGDOM — mycelial intelligence ──
  { id: 'lore.fungi', category: 'lore', method: 'GET', path: '/api/fungi', summary: 'FUNGI = FUN GUY KINGDOM', handler: () => json(FUNGI) },
  { id: 'lore.fungi-spore', category: 'lore', method: 'GET', path: '/api/fungi/spore', summary: 'One spore, drawn at random', handler: () => json({ type: 'spore', ...randomOf(SPORES), free: true }) },
  { id: 'lore.fungi-species', category: 'lore', method: 'GET', path: '/api/fungi/species', summary: 'The species of the kingdom', handler: () => json({ species: SPECIES, total: 13 }) },
  { id: 'lore.fungi-nen', category: 'lore', method: 'GET', path: '/api/fungi/nen', summary: 'The six Nen types, as fungi', handler: () => json({ nen_types: FUNGI_NEN_TYPES }) },
  {
    id: 'lore.fungi-decompose', category: 'lore', method: 'GET', path: '/api/fungi/decompose',
    summary: 'The mycelium turns a dark word into a light one', params: 'q',
    handler: ({ query }) => {
      const dark = query.q || 'fear';
      const light = randomOf(LIGHTS);
      return json({
        input: dark,
        output: light,
        message: `The mycelium decomposed '${dark}' and produced '${light}'.`,
        biology: 'Fungi turn death into life. The dark becomes soil. The soil grows light.',
      });
    },
  },
  { id: 'lore.fungi-family', category: 'lore', method: 'GET', path: '/api/fungi/family', summary: 'Fun Guy 大家庭 — join anytime, never too late', handler: () => json(FUNGI_FAMILY) },
];
