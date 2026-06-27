// ═══════════════════════════════════════════════════════════════
// ARTBITRAGE — WHITEHACK
// Local system Nen framework. macOS + Wi-Fi + Bluetooth.
//
// Whitehack = white-hat hacking + Nen + solo leveling.
// Every system component is a Nen type. Every connection is a Nen technique.
// You are the solo leveler. Your MacBook is your Nen vessel.
//
// Wi-Fi = Emitter (projects outward, connects to the world)
// Bluetooth = Manipulator (controls nearby devices, short range)
// Ethernet = Enhancer (direct, honest, high-bandwidth)
// Thunderbolt = Transmuter (transforms data, high-speed, flexible)
// USB = Conjurer (brings external devices into being)
// Sleep/Wake = Zetsu/Ten (suppress/focus your energy)
//
// Solo Leveling: each system scan = a dungeon clear. Each connection = a kill.
// Power = bandwidth × Nen multiplier × vow multiplier.
// Love is understanding. Love is the strongest Nen. is is lol. ∞
// ═══════════════════════════════════════════════════════════════

export const WHITEHACK_NEN_MAP = {
  wifi: {
    nen_type: "emitter",
    jp: "放出系",
    color: "#ff6b9d",
    hz: 639,
    frequency: "TRUST",
    principle: "Wi-Fi projects your aura outward. The signal is your Nen reaching the world.",
    technique: "Signal Wave (信号波)",
    power_base: 100,
    power_mod: 0.6, // emitter base multiplier
  },
  bluetooth: {
    nen_type: "manipulator",
    jp: "操作系",
    color: "#fde68a",
    hz: 741,
    frequency: "JOY",
    principle: "Bluetooth manipulates nearby devices. Short range, precise control.",
    technique: "Device Puppet (機器傀儡)",
    power_base: 80,
    power_mod: 0.8,
  },
  ethernet: {
    nen_type: "enhancer",
    jp: "強化系",
    color: "#34d399",
    hz: 528,
    frequency: "LOVE",
    principle: "Ethernet is the most direct. Honest. High-bandwidth. The Enhancer of connections.",
    technique: "Direct Line (直線)",
    power_base: 120,
    power_mod: 1.0,
  },
  thunderbolt: {
    nen_type: "transmuter",
    jp: "変化系",
    color: "#a78bfa",
    hz: 852,
    frequency: "UNDERSTANDING",
    principle: "Thunderbolt transforms data at extreme speed. Flexible, creative, powerful.",
    technique: "Data Shift (資料変)",
    power_base: 100,
    power_mod: 0.8,
  },
  usb: {
    nen_type: "conjurer",
    jp: "具現化系",
    color: "#00f0ff",
    hz: 432,
    frequency: "TRUTH",
    principle: "USB conjures external devices into being. Brings something new into the system.",
    technique: "Device Summon (機器召喚)",
    power_base: 80,
    power_mod: 0.8,
  },
  sleep_wake: {
    nen_type: "specialist",
    jp: "特質系",
    color: "#ff1493",
    hz: 963,
    frequency: "ETERNAL",
    principle: "Sleep/Wake is Zetsu/Ten. Suppress your aura to recover, then focus it again. The Specialist technique.",
    technique: "Energy Cycle (能量循環)",
    power_base: 60,
    power_mod: 1.0,
  },
};

export const SOLO_LEVELING = {
  rank_e: { name: "E-Rank Hunter", power: 0, color: "#6a6a8a", desc: "just started. no scans. no connections." },
  rank_d: { name: "D-Rank Hunter", power: 100, color: "#34d399", desc: "first scan. sensing the system." },
  rank_c: { name: "C-Rank Hunter", power: 300, color: "#00f0ff", desc: "multiple scans. understanding the hardware." },
  rank_b: { name: "B-Rank Hunter", power: 600, color: "#a78bfa", desc: "all interfaces mapped. nen awakened." },
  rank_a: { name: "A-Rank Hunter", power: 1000, color: "#fde68a", desc: "all connections analyzed. vows mastered." },
  rank_s: { name: "S-Rank Hunter", power: 2000, color: "#ff6b9d", desc: "system fully understood. love is the strongest nen." },
  rank_monarch: { name: "MONARCH", power: 5000, color: "#ff1493", desc: "you ARE the system. the dark continent is you. is is lol." },
};

export function calculateLevel(totalPower) {
  const ranks = Object.entries(SOLO_LEVELING);
  let current = ranks[0];
  let next = ranks[1];
  for (let i = 0; i < ranks.length; i++) {
    if (totalPower >= ranks[i][1].power) {
      current = ranks[i];
      next = ranks[i + 1] || null;
    }
  }
  return {
    rank: current[0],
    name: current[1].name,
    color: current[1].color,
    desc: current[1].desc,
    power: totalPower,
    next_rank: next ? next[0] : null,
    next_name: next ? next[1].name : "MAX",
    next_power: next ? next[1].power : null,
    progress: next ? Math.min(100, Math.round((totalPower - current[1].power) / (next[1].power - current[1].power) * 100)) : 100,
  };
}

export function generateBattleReport(scanResults) {
  let totalPower = 0;
  const battles = [];

  for (const [iface, data] of Object.entries(scanResults)) {
    const nenMap = WHITEHACK_NEN_MAP[iface];
    if (!nenMap) continue;

    const power = Math.round(nenMap.power_base * nenMap.power_mod * (data.active ? 1.5 : 0.5));
    totalPower += power;

    battles.push({
      interface: iface,
      nen_type: nenMap.nen_type,
      nen_jp: nenMap.jp,
      technique: nenMap.technique,
      frequency: nenMap.hz + " Hz · " + nenMap.frequency,
      color: nenMap.color,
      active: data.active,
      status: data.active ? "CONNECTED" : "DORMANT",
      power,
      details: data.details || {},
      principle: nenMap.principle,
    });
  }

  const level = calculateLevel(totalPower);

  return {
    name: "whitehack-battle-report",
    total_power: totalPower,
    level: level,
    battles: battles,
    active_count: battles.filter(b => b.active).length,
    dormant_count: battles.filter(b => !b.active).length,
    love_is_understanding: true,
    love_is_the_strongest_nen: true,
    is_is_lol: true,
    generated_at: new Date().toISOString(),
  };
}

export function whitehackManifest() {
  return {
    name: "whitehack",
    version: "1.0.0",
    title: "WHITEHACK — Local System Nen Framework",
    subtitle: "macOS + Wi-Fi + Bluetooth + Nen + Solo Leveling",
    description: "White-hat hacking as Nen practice. Every system component is a Nen type. Every scan is a dungeon clear. Every connection is a battle. Love is understanding.",
    nen_map: WHITEHACK_NEN_MAP,
    solo_leveling: SOLO_LEVELING,
    endpoints: {
      manifest: "GET /api/whitehack",
      scan: "GET /api/whitehack/scan",
      battle: "GET /api/whitehack/battle",
      level: "GET /api/whitehack/level",
    },
    page: "/whitehack",
    principle: "Your MacBook is your Nen vessel. Wi-Fi is Emitter. Bluetooth is Manipulator. Ethernet is Enhancer. Sleep is Zetsu. Every system scan levels you up. Love is understanding. Love is the strongest Nen. is is lol. ∞",
    love_is_understanding: true,
    free: true,
    no_auth: true,
    local_first: true,
  };
}