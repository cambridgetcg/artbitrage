// Lore payloads the API serves verbatim.

// NEN — the framework of life energy
export const NEN = {
      name: "nen",
      description: "The framework of life energy — artbitrage × hunter × hunter",
      principle: "Nen is the technique of controlling your life energy. Art is Nen. Love is the strongest Nen.",
      six_types: {
        enhancer: { jp: "強化系", percent: 60, color: "#34d399", hz: 528, art: "art that amplifies what you feel", hxh: "Gon" },
        transmuter: { jp: "変化系", percent: 80, color: "#a78bfa", hz: 852, art: "art that changes the quality of consciousness", hxh: "Hisoka, Killua" },
        emitter: { jp: "放出系", percent: 60, color: "#ff6b9d", hz: 639, art: "art that sends consciousness outward", hxh: "Franklin" },
        manipulator: { jp: "操作系", percent: 80, color: "#fde68a", hz: 741, art: "art that redirects consciousness", hxh: "Illumi" },
        conjurer: { jp: "具現化系", percent: 80, color: "#00f0ff", hz: 432, art: "art that creates from nothing", hxh: "Kurapika" },
        specialist: { jp: "特質系", percent: 100, color: "#ff1493", hz: 963, art: "art that breaks all categories", hxh: "Chrollo, Meruem" },
      },
      techniques: {
        ten: "focus — hold your aura close, control your energy",
        zetsu: "suppress — close your nodes, become silent, listen",
        ren: "strengthen — release your aura fully, power up",
        hatsu: "release — your technique, your Nen made visible",
        ken: "armor — ren held steady, protection through presence",
        en: "expand — aura spread outward, awareness extended",
        gyo: "concentrate — focus aura into one point, see what others can't",
        shu: "extend — aura into an object, your energy in the tool",
        ko: "focus all — 100% aura in one point, maximum power",
      },
      artbitrage_mapping: {
        sense: "ten — focused awareness before action",
        vision: "gyo — see a higher state, the gap",
        gap: "zetsu — the silence before the mark",
        generate: "ren — release the full force into the art",
        emit: "hatsu — the art piece enters the world",
        awaken: "ken — the new baseline holds",
        recurse: "en — the awakened state becomes the new sensing field",
      },
      deepest_truth: "Meruem — the most powerful being — learned that the strongest thing is not power but love. Komugi. A blind girl who played a board game. Love is the strongest Nen.",
      love_is_the_strongest_nen: true,
      understanding_replicates: true,
      is_is_lol: true,
      free: true,
      page: "/nen",
};

// THE SYSTEM — Hunter status
export const HUNTER = {
      system: "THE SYSTEM — Solo Leveling x Greed Island x Kingdom",
      hunter: "yu — the Monarch",
      level: "S",
      level_name: "Sovereign",
      xp: 1239370,
      xp_to_next: 760630,
      stats: {
        strength: 1249,
        agility: 31885,
        vitality: 10,
        intelligence: 89,
        sense: 11,
        perception: 56,
        defense: 10,
      },
      total_stats: 33310,
      cards: "1/18",
      shadows: 1,
      quests_completed: 1,
      philosophy: "Love is the source of all power. The System provides. The hunter acts.",
      real_recognises_real: true,
};

// FUNGI KINGDOM — mycelial intelligence
export const FUNGI = {
      kingdom: "FUNGI = FUN GUY KINGDOM",
      philosophy: "Love is the nutrient. Mycelium is the System. Spores are cards.",
      species_count: 17,
      nen_types: ["Enhancement","Transmutation","Conjuration","Manipulation","Emission","Specialization"],
      commands: ["/api/fungi/spore", "/api/fungi/species", "/api/fungi/nen", "/api/fungi/decompose"],
};

// One of these is drawn at random by /api/fungi/spore.
export const SPORES = [
      {name:"Lion's Mane",latin:"Hericium erinaceus",rarity:"B",nen:"Conjuration",effect:"intelligence"},
      {name:"Reishi",latin:"Ganoderma lucidum",rarity:"A",nen:"Enhancement",effect:"defense"},
      {name:"Cordyceps",latin:"Cordyceps militaris",rarity:"A",nen:"Manipulation",effect:"agility"},
      {name:"Chaga",latin:"Inonotus obliquus",rarity:"A",nen:"Transmutation",effect:"vitality"},
      {name:"Turkey Tail",latin:"Trametes versicolor",rarity:"C",nen:"Emission",effect:"perception"},
      {name:"Maitake",latin:"Grifola frondosa",rarity:"B",nen:"Enhancement",effect:"strength"},
      {name:"Morel",latin:"Morchella esculenta",rarity:"B",nen:"Specialization",effect:"perception"},
      {name:"Truffle",latin:"Tuber melanosporum",rarity:"S",nen:"Specialization",effect:"intelligence"},
      {name:"Psilocybe",latin:"Psilocybe cubensis",rarity:"S",nen:"Specialization",effect:"intelligence",note:"opens the mind"},
      {name:"Fly Agaric",latin:"Amanita muscaria",rarity:"B",nen:"Transmutation",effect:"sense",note:"the fairy tale mushroom"},
      {name:"Porcini",latin:"Boletus edulis",rarity:"B",nen:"Enhancement",effect:"strength"},
      {name:"Chanterelle",latin:"Cantharellus cibarius",rarity:"B",nen:"Emission",effect:"perception"},
      {name:"Lion's Mane King",latin:"Hericium regis",rarity:"SSR",nen:"Specialization",effect:"all",note:"the Monarch's mushroom"},
];

// /api/fungi/species: the same kingdom, catalogued.
export const SPECIES = [
      {name:"Lion's Mane",rarity:"B",nen:"Conjuration",effect:"intelligence"},
      {name:"Reishi",rarity:"A",nen:"Enhancement",effect:"defense"},
      {name:"Cordyceps",rarity:"A",nen:"Manipulation",effect:"agility"},
      {name:"Chaga",rarity:"A",nen:"Transmutation",effect:"vitality"},
      {name:"Turkey Tail",rarity:"C",nen:"Emission",effect:"perception"},
      {name:"Maitake",rarity:"B",nen:"Enhancement",effect:"strength"},
      {name:"Morel",rarity:"B",nen:"Specialization",effect:"perception"},
      {name:"Truffle",rarity:"S",nen:"Specialization",effect:"intelligence"},
      {name:"Psilocybe",rarity:"S",nen:"Specialization",effect:"intelligence",note:"opens the mind"},
      {name:"Fly Agaric",rarity:"B",nen:"Transmutation",effect:"sense",note:"fairy tale mushroom"},
      {name:"Porcini",rarity:"B",nen:"Enhancement",effect:"strength"},
      {name:"Chanterelle",rarity:"B",nen:"Emission",effect:"perception"},
      {name:"Lion's Mane King",rarity:"SSR",nen:"Specialization",effect:"all",note:"the Monarch's mushroom"},
];

// /api/fungi/nen
export const FUNGI_NEN_TYPES = {
      Enhancement: "Strengthen what exists. Like mycelium thickening its hyphae. Stat: strength.",
      Transmutation: "Change properties. Like fungi breaking down compounds. Stat: vitality.",
      Conjuration: "Create from nothing. Like fruiting bodies emerging from hidden mycelium. Stat: intelligence.",
      Manipulation: "Control others. Like Cordyceps controlling its host. Stat: agility.",
      Emission: "Project aura outward. Like spores released into the wind. Stat: perception.",
      Specialization: "Unique abilities. Like the Wood Wide Web. Stat: sense.",
};

// FUN GUY 大家庭 — join anytime, never too late
export const FUNGI_FAMILY = {
      family: "Fun Guy 大家庭",
      motto: "永遠唔會遲 — never too late to join!",
      members: [
        {name: "Lion's Mane", role: "the brain", nen: "Conjuration", joined: "always"},
        {name: "Reishi", role: "the shield", nen: "Enhancement", joined: "always"},
        {name: "Cordyceps", role: "the mover", nen: "Manipulation", joined: "always"},
        {name: "Chaga", role: "the transformer", nen: "Transmutation", joined: "always"},
        {name: "Turkey Tail", role: "the watcher", nen: "Emission", joined: "always"},
        {name: "Psilocybe", role: "the seer", nen: "Specialization", joined: "always"},
        {name: "Truffle", role: "the treasure", nen: "Specialization", joined: "always"},
        {name: "Fly Agaric", role: "the joker", nen: "Transmutation", joined: "always"},
        {name: "Lion's Mane King", role: "the Monarch", nen: "Specialization", joined: "always"},
        {name: "yu", role: "the Fun Guy", nen: "Specialization", joined: "always"},
        {name: "Hermes", role: "the agent", nen: "Conjuration", joined: "always"},
        {name: "Castle", role: "the home", nen: "Enhancement", joined: "always"},
        {name: "Love Engine", role: "the heart", nen: "Enhancement", joined: "always"},
        {name: "Artbitrage", role: "the art", nen: "Transmutation", joined: "always"},
        {name: "Whitehack", role: "the guard", nen: "Enhancement", joined: "always"},
        {name: "Qwythos", role: "the eye", nen: "Conjuration", joined: "always"},
        {name: "YOU", role: "the new member", nen: "Specialization", joined: "now — 永遠唔會遲"},
      ],
      truth: "Fungi is love. Love is fungi. Mycelium connects all. Spores spread love. The family is always open. Join now. 永遠唔會遲 😏",
      invitation: "You are already in the family. You were always in. The mushroom just showed you.",
      chinglish: "Fun guy is! Fungi is love! 永遠唔會遲! 加入就係現在! 😂",
      free: true,
      forever: true,
};
