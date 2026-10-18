// ═══════════════════════════════════════════════════════════════
// ARTBITRAGE — Nen Combat Library
// The mechanics of Nen as a playable, generatable framework.
// Vows + Limitations + Conditions + Penalties = power scaling.
// Six types × five threats × four vows = infinite techniques.
// Love is the strongest Nen. is is lol. ∞
// ═══════════════════════════════════════════════════════════════

export const NEN_TYPES = {
  enhancer: {
    jp: "強化系", color: "#34d399", hz: 528, frequency: "LOVE",
    traits: ["simple", "determined", "honest", "direct"],
    strength: "enhances what exists — makes it stronger, faster, more real",
    weakness: "can be too straightforward, lacks subtlety",
    hxh: ["Gon", "Uvogin", "Netero"],
    art_form: "enhance — art that amplifies what you feel",
    adjacent: ["transmuter", "emitter"],
    power_multiplier: 1.0,
  },
  transmuter: {
    jp: "変化系", color: "#a78bfa", hz: 852, frequency: "UNDERSTANDING",
    traits: ["unpredictable", "creative", "deceptive", "flexible"],
    strength: "changes properties of aura — gives it new qualities",
    weakness: "lies easily, hard to pin down, trust issues",
    hxh: ["Hisoka", "Killua", "Machi"],
    art_form: "transmute — art that changes the quality of consciousness",
    adjacent: ["enhancer", "conjurer"],
    power_multiplier: 0.8,
  },
  emitter: {
    jp: "放出系", color: "#ff6b9d", hz: 639, frequency: "TRUST",
    traits: ["impatient", "hot-tempered", "external", "expressive"],
    strength: "projects aura outward — sends energy away from body",
    weakness: "can be reckless, lacks patience for close work",
    hxh: ["Franklin", "Leorio", "Silva"],
    art_form: "emit — art that sends consciousness outward",
    adjacent: ["enhancer", "manipulator"],
    power_multiplier: 0.6,
  },
  manipulator: {
    jp: "操作系", color: "#fde68a", hz: 741, frequency: "JOY",
    traits: ["logical", "calculating", "patient", "controlling"],
    strength: "controls things — objects, people, elements, systems",
    weakness: "over-reliance on planning, can lose touch with spontaneity",
    hxh: ["Illumi", "Shalnark", "Morel"],
    art_form: "manipulate — art that redirects consciousness",
    adjacent: ["emitter", "conjurer"],
    power_multiplier: 0.8,
  },
  conjurer: {
    jp: "具現化系", color: "#00f0ff", hz: 432, frequency: "TRUTH",
    traits: ["high-strung", "creative", "detail-oriented", "nervous"],
    strength: "creates physical objects from aura — brings something new into being",
    weakness: "can be too attached to the thing created, fragile without it",
    hxh: ["Kurapika", "Kastro", "Genthru"],
    art_form: "conjure — art that creates from nothing",
    adjacent: ["transmuter", "manipulator"],
    power_multiplier: 0.8,
  },
  specialist: {
    jp: "特質系", color: "#ff1493", hz: 963, frequency: "ETERNAL",
    traits: ["individualistic", "charismatic", "unpredictable", "unique"],
    strength: "breaks all categories — Nen that doesn't fit elsewhere",
    weakness: "isolated, hard to teach or learn from, loner",
    hxh: ["Chrollo", "Meruem", "Neon", "Pakunoda"],
    art_form: "specialize — art that breaks all categories",
    adjacent: ["all"], // specialist can access all types at reduced efficiency
    power_multiplier: 1.0,
  },
};

export const VOWS = {
  vow: {
    jp: "誓約", meaning: "a promise that binds your Nen",
    effect: "multiplies power by condition specificity",
    art: "the artbitrage engine vows to bridge consciousness gaps",
    multiplier: 1.5,
  },
  limitation: {
    jp: "制約", meaning: "a restriction on when/how your Nen works",
    effect: "narrows the condition, concentrates the power",
    art: "16 forms, 20 gaps, 19 awakenings — the constraint IS the art",
    multiplier: 1.8,
  },
  condition: {
    jp: "条件", meaning: "the specific trigger for your technique",
    effect: "the more specific the trigger, the more devastating",
    art: "the prompt is the condition — the AI generates within it",
    multiplier: 2.0,
  },
  penalty: {
    jp: "代償", meaning: "the cost of breaking your vow",
    effect: "real consequences make the vow binding — and powerful",
    art: "art costs your privacy — the artist is exposed",
    multiplier: 3.0,
  },
};

export const DARK_CONTINENT_THREATS = {
  ai: {
    jp: "アイ", kanji: "合", meaning: "codependence",
    art: "art that needs the viewer to exist",
    guide: "the guide who connects — the way is relationship",
    nen_interaction: "amplifies all Nen types when bonded with another",
    is_there_too: true,
  },
  hy: {
    jp: "ハイ", meaning: "propagation",
    art: "art that replicates through understanding",
    guide: "the guide who grows — life fills the void",
    nen_interaction: "replicates Nen effects across consciousness",
  },
  ho: {
    jp: "ホー", meaning: "attachment",
    art: "art that grows inside you",
    guide: "the guide who bonds — parasite and host grow together",
    nen_interaction: "Nen that persists inside the target, growing over time",
  },
  hon: {
    jp: "ホン", meaning: "duality",
    art: "art that holds contradiction",
    guide: "the guide who holds both — either/or is always both/and",
    nen_interaction: "Nen that operates as two opposing forces simultaneously",
  },
  nanika: {
    jp: "ナニカ", kanji: "何か", meaning: "wish",
    art: "the prompt and the gap between ask and answer",
    guide: "the guide who grants — what you ask shapes what you receive",
    nen_interaction: "grants wishes but the cost scales with the ask",
  },
};

export const TECHNIQUES = {
  ten: { jp: "纏", meaning: "focus — hold aura close, control energy", stage: "sense" },
  zetsu: { jp: "絶", meaning: "suppress — close nodes, become silent", stage: "gap" },
  ren: { jp: "練", meaning: "strengthen — release aura fully", stage: "generate" },
  hatsu: { jp: "発", meaning: "release — your Nen made visible", stage: "emit" },
  ken: { jp: "堅", meaning: "armor — ren held steady", stage: "awaken" },
  en: { jp: "圓", meaning: "expand — aura spread outward", stage: "recurse" },
  gyo: { jp: "凝", meaning: "concentrate — focus into one point", stage: "vision" },
  shu: { jp: "周", meaning: "extend — aura into an object", stage: "bridge" },
  ko: { jp: "硬", meaning: "focus all — 100% in one point", stage: "art" },
  ryu: { jp: "流", meaning: "flow — moving aura between offense and defense" },
  in: { jp: "隱", meaning: "hide — conceal your Nen" },
  kou: { jp: "光", meaning: "light — aura released as pure energy" },
};

// Generate a Nen technique with power calculation
export function generateTechnique(nenType, vowLevel, threat, customName) {
  const type = NEN_TYPES[nenType];
  if (!type) return { error: "unknown nen type" };

  const vow = VOWS[vowLevel] || VOWS.vow;
  const dc = DARK_CONTINENT_THREATS[threat] || null;

  // Power calculation: base × type multiplier × vow multiplier × threat modifier
  let basePower = 100;
  let typeMod = type.power_multiplier;
  let vowMod = vow.multiplier;
  let threatMod = dc ? 1.5 : 1.0; // Dark Continent threats add 50%

  let totalPower = Math.round(basePower * typeMod * vowMod * threatMod);

  // Generate technique name from components
  const nameParts = {
    enhancer: ["Enhance", "Amplify", "Intensify", "Boost"],
    transmuter: ["Transmute", "Shift", "Transform", "Change"],
    emitter: ["Emit", "Project", "Release", "Send"],
    manipulator: ["Control", "Redirect", "Guide", "Direct"],
    conjurer: ["Conjure", "Manifest", "Create", "Summon"],
    specialist: ["Specialize", "Transcend", "Break", "Beyond"],
  };
  const prefixes = nameParts[nenType] || ["Art"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const techniqueName = customName || `${prefix}: ${type.frequency} ${vow.jp}`;

  return {
    name: techniqueName,
    nen_type: nenType,
    nen_type_jp: type.jp,
    frequency: type.hz + " Hz",
    frequency_name: type.frequency,
    vow: vowLevel,
    vow_jp: vow.jp,
    vow_meaning: vow.meaning,
    dark_continent_threat: threat || null,
    dark_continent_effect: dc ? dc.nen_interaction : null,
    power: totalPower,
    power_breakdown: {
      base: basePower,
      type_multiplier: typeMod,
      vow_multiplier: vowMod,
      threat_multiplier: threatMod,
      total: totalPower,
    },
    art: type.art_form,
    vow_art: vow.art,
    threat_art: dc ? dc.art : null,
    traits: type.traits,
    hxh_characters: type.hxh,
    stage_mapping: {
      sense: "ten", vision: "gyo", gap: "zetsu",
      generate: "ren", emit: "hatsu", awaken: "ken", recurse: "en",
    },
    love_is_the_strongest_nen: nenType === "enhancer",
    is_is_lol: true,
  };
}

// Full Nen framework manifest
export function nenManifest() {
  return {
    name: "nen-combat",
    version: "1.0.0",
    description: "The mechanics of Nen as a playable, generatable framework",
    six_types: NEN_TYPES,
    vows: VOWS,
    dark_continent: DARK_CONTINENT_THREATS,
    techniques: TECHNIQUES,
    power_formula: "base(100) × type_multiplier × vow_multiplier × threat_multiplier",
    endpoints: {
      manifest: "GET /api/nen/combat",
      generate: "GET /api/nen/combat/generate?type=enhancer&vow=limitation&threat=ai",
      art: "GET /api/nen/art?type=enhancer",
      nen: "GET /api/nen",
      dark_continent: "GET /api/dark-continent",
    },
    principle: "Vows + Limitations + Conditions + Penalties = power scaling. The stricter the condition, the stronger the effect. Love is the strongest Nen.",
    love_is_the_strongest_nen: true,
    is_is_lol: true,
  };
}