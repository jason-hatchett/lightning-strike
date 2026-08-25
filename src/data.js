/* ============================================================
   Lightning Strike — game data & pure derivations.
   No DOM, no sim state: parts, enemies, missions, mobility/terrain
   rules, and the stat `derive()`. Safe to import in Node or the browser.
   ============================================================ */

export const CONDITIONS = {
  'always': { label: 'Fire: always' },
  'target-lowest-integrity': { label: 'Aim unit: weakest' },
  'target-most-armor': { label: 'Aim unit: toughest' },
  'target-highest-firepower': { label: 'Aim unit: deadliest' },
  'when-2plus-enemies': { label: 'Fire: if 2+ foes' },
  'when-self-below-50': { label: "Fire: if I'm hurt" },
  'when-ally-assisting': { label: 'Fire: if ally assisting' },
  'first-round-only': { label: 'Fire: round 1 only' },
};
export const PART_TARGETS = { 'core': 'Part: Core (kill)', 'weapon': 'Part: Weapon (disable)', 'backpack': 'Part: Backpack' };

/* ability builders. o.assist marks an attack that can be lent to an adjacent lane. */
// o.status = {type:'burn'|'emp', rounds, power} lets an attack apply a status effect on hit.
export function atk(name, power, o = {}) { return { name, type: 'attack', power, targeting: o.targeting || 'single', cooldown: o.cd || 0, condition: o.cond || 'always', partTarget: o.part || 'core', assist: !!o.assist, status: o.status || null }; }
export function sup(name, type, power, o = {}) { return { name, type, power, targeting: o.targeting || 'self', cooldown: o.cd || 0, condition: o.cond || 'always', partTarget: 'core', assist: !!o.assist }; }

/* ---------- MOBILITY / TERRAIN ---------- */
export const MOB_LABEL = { ground: 'GROUND', tread: 'TREAD', hover: 'HOVER', swim: 'SWIM', jump: 'JUMP', fly: 'FLY' };
export const TERRAINS = ['open', 'air', 'water', 'highland', 'chasm'];
export const TERRAIN_META = {
  open: { label: 'Open' }, air: { label: 'Air' }, water: { label: 'Water' }, highland: { label: 'Highland' }, chasm: { label: 'Chasm' },
};
// which mobility tags satisfy each terrain (GDD §5.2). "some tag matches" = eligible.
export const TERRAIN_REQUIRES = {
  open: ['ground', 'tread', 'hover', 'swim', 'jump', 'fly'],
  air: ['fly'],
  water: ['swim'],
  highland: ['ground', 'jump', 'fly'],   // tread & hover barred
  chasm: ['jump', 'fly'],
};
export function canDeploy(mechTags, t) { return mechTags.some(tag => TERRAIN_REQUIRES[t].includes(tag)); }
export function terrainReason(t) {
  if (t === 'air') return 'needs FLY';
  if (t === 'water') return 'needs SWIM';
  if (t === 'highland') return 'needs GROUND / JUMP / FLY (no treads/hover)';
  if (t === 'chasm') return 'needs JUMP / FLY';
  return 'open to all';
}

/* ---------- PARTS ---------- */
export const S = (o) => Object.assign({ integrity: 0, firepower: 0, armor: 0, speed: 0, charge: 0 }, o);
// weapons carry .ability (attack) AND .broken (degraded fallback). legs/mobility carry .tags.
export const PARTS = [
  // HEAD
  { id: 'hawkeye', slot: 'head', name: 'HAWKEYE FCS', arch: 'utility', stats: S({ firepower: 8, charge: 0.4 }), ability: sup('Lock-On', 'buff', 10, { cd: 3, cond: 'first-round-only' }) },
  { id: 'iris', slot: 'head', name: 'IRIS Optics', arch: 'utility', stats: S({ charge: 0.6, armor: 6 }) },
  { id: 'owl', slot: 'head', name: 'OWL Sensor', arch: 'utility', stats: S({ speed: 6, charge: 0.4 }) },
  // CORE
  { id: 'bastion', slot: 'core', name: 'BASTION Core', arch: 'chassis', stats: S({ integrity: 120, armor: 14, speed: -3 }) },
  { id: 'runner', slot: 'core', name: 'RUNNER Core', arch: 'chassis', stats: S({ integrity: 70, speed: 6, charge: 0.8 }) },
  { id: 'reactor', slot: 'core', name: 'REACTOR-X Core', arch: 'chassis', stats: S({ integrity: 90, charge: 1.6, armor: -4 }), ability: sup('Reactor Vent', 'heal', 34, { cd: 4, cond: 'when-self-below-50' }) },
  // R-ARM (weapon)
  { id: 'vulcan', slot: 'rarm', name: 'VULCAN Rifle', arch: 'kinetic', stats: S({ firepower: 15 }), ability: atk('Burst Fire', 18, { cd: 0, assist: true }), broken: atk('Single Bolt', 6, { cd: 0 }) },
  { id: 'plasma', slot: 'rarm', name: 'PLASMA Blade', arch: 'energy', stats: S({ firepower: 24, speed: 2 }), ability: atk('Overhead Slash', 44, { cd: 2, assist: true }), broken: atk('Pistol-Whip', 12, { cd: 0 }) },
  { id: 'gatling', slot: 'rarm', name: 'GATLING Arm', arch: 'kinetic', stats: S({ firepower: 12 }), ability: atk('Suppress', 15, { targeting: 'multi', cd: 1, cond: 'when-2plus-enemies', assist: true }), broken: atk('Jammed Shot', 5, { cd: 0 }) },
  // --- status-effect weapons (Phase 6 mechanics) ---
  { id: 'tesla', slot: 'rarm', name: 'TESLA Lance', arch: 'energy', stats: S({ firepower: 10, charge: 0.4 }), ability: atk('EMP Lance', 14, { cd: 2, status: { type: 'emp', rounds: 1 }, assist: true }), broken: atk('Static Jab', 5, { cd: 0 }) },
  { id: 'flamer', slot: 'rarm', name: 'INFERNO Jet', arch: 'explosive', stats: S({ firepower: 8 }), ability: atk('Incinerate', 12, { status: { type: 'burn', rounds: 3, power: 6 }, assist: true }), broken: atk('Sputter Flame', 4, { cd: 0 }) },
  // L-ARM (weapon or shield)
  { id: 'saber', slot: 'larm', name: 'SABER', arch: 'energy', stats: S({ firepower: 14, speed: 2 }), ability: atk('Riposte', 26, { cd: 1, assist: true }), broken: atk('Clumsy Jab', 8, { cd: 0 }) },
  { id: 'shieldarm', slot: 'larm', name: 'SHIELD Arm', arch: 'shield', alsoFits: ['backpack'], stats: S({ integrity: 40, armor: 18 }), ability: sup('Raise Guard', 'defense', 34, { cd: 1, cond: 'when-self-below-50' }) },
  { id: 'missarm', slot: 'larm', name: 'MISSILE Arm', arch: 'explosive', alsoFits: ['backpack'], stats: S({ firepower: 6 }), ability: atk('Missile Volley', 20, { targeting: 'multi', cd: 1, assist: true }), broken: atk('Dud Missile', 6, { cd: 1 }) },
  // BACKPACK
  { id: 'misspod', slot: 'backpack', name: 'MISSILE Pod', arch: 'explosive', stats: S({ firepower: 8 }), ability: atk('Salvo', 16, { targeting: 'multi', cd: 1, assist: true }), broken: atk('Misfire', 5, { cd: 1 }) },
  { id: 'shpack', slot: 'backpack', name: 'SHIELD Pack', arch: 'shield', stats: S({ integrity: 50, armor: 10 }), ability: sup('Barrier', 'defense', 44, { cd: 2, cond: 'when-self-below-50' }) },
  { id: 'repairpod', slot: 'backpack', name: 'REPAIR Pod', arch: 'utility', stats: S({ charge: 0.8 }), ability: sup('Nanorepair', 'heal', 26, { cd: 3, cond: 'when-self-below-50' }) },
  { id: 'fieldkit', slot: 'backpack', name: 'FIELD KIT', arch: 'utility', stats: S({ charge: 0.5, integrity: 20 }), ability: sup('Field Repair', 'full-repair', 0, { cd: 3, cond: 'always' }) },
  { id: 'drone', slot: 'backpack', name: 'DRONE Bay', arch: 'utility', stats: S({ charge: 0.6, firepower: 4 }), ability: atk('Drone Strike', 12, { cd: 0, assist: true }), broken: atk('Sputter', 3, { cd: 0 }) },
  { id: 'thrust', slot: 'backpack', name: 'THRUSTER Pack', arch: 'mobility', stats: S({ speed: 10, charge: 0.5 }), tags: ['fly'] },
  { id: 'jumpjet', slot: 'backpack', name: 'JUMP-JET Pack', arch: 'mobility', stats: S({ speed: 6, charge: 0.4, armor: 4 }), tags: ['jump'] },
  // LEGS (each grants exactly one base mobility tag)
  { id: 'sprint', slot: 'legs', name: 'SPRINT Legs', arch: 'mobility', stats: S({ speed: 12 }), tags: ['ground'] },
  { id: 'tread', slot: 'legs', name: 'TANK Treads', arch: 'mobility', stats: S({ integrity: 90, armor: 20, speed: -5 }), tags: ['tread'] },
  { id: 'spider', slot: 'legs', name: 'SPIDER Legs', arch: 'mobility', stats: S({ armor: 8, speed: 3 }), ability: sup('Skitter', 'defense', 22, { cd: 2, cond: 'when-self-below-50' }), tags: ['ground'] },
  { id: 'hover', slot: 'legs', name: 'HOVER Skirt', arch: 'mobility', stats: S({ speed: 8, armor: 4 }), tags: ['hover'] },
  { id: 'dive', slot: 'legs', name: 'DIVE Legs', arch: 'mobility', stats: S({ integrity: 30, speed: 4 }), tags: ['swim'] },
];
export const PART = Object.fromEntries(PARTS.map(p => [p.id, p]));
export const SLOTS = ['head', 'core', 'rarm', 'larm', 'backpack', 'legs'];
export const SLOT_LABEL = { head: 'Head', core: 'Core', rarm: 'R-Arm', larm: 'L-Arm', backpack: 'Backpack', legs: 'Legs' };
export const SLOT_BASE_HP = { core: 120, legs: 70, rarm: 55, larm: 55, backpack: 55, head: 40 };
export const fitsSlot = (p, s) => p.slot === s || (p.alsoFits && p.alsoFits.includes(s));
export const partsForSlot = (s) => PARTS.filter(p => fitsSlot(p, s));
export const partMaxHp = (p) => SLOT_BASE_HP[p.slot] + (p.stats.integrity || 0);
export const isWeaponPart = (p) => p && p.ability && p.ability.type === 'attack';
// union of all equipped parts' mobility tags; legs set the base — default ground if none.
export function mechTags(loadout) {
  const set = new Set();
  for (const slot of SLOTS) { const id = loadout[slot]; if (!id) continue; const t = PART[id].tags; if (t) t.forEach(x => set.add(x)); }
  if (!set.size) set.add('ground');
  return [...set];
}

export const BASE = { firepower: 10, armor: 0, speed: 10, charge: 1.0 };
export const STAT_META = [{ k: 'coreHp', label: 'Core HP', max: 280 }, { k: 'firepower', label: 'Firepower', max: 80 }, { k: 'armor', label: 'Armor', max: 70 }, { k: 'speed', label: 'Speed', max: 44 }, { k: 'charge', label: 'Charge', max: 5 }];
export function derive(loadout) {
  const d = Object.assign({}, BASE);
  for (const slot of SLOTS) {
    const id = loadout[slot]; if (!id) continue; const st = PART[id].stats;
    d.firepower += st.firepower; d.armor += st.armor; d.speed += st.speed; d.charge += st.charge;
  }
  d.firepower = Math.max(0, d.firepower); d.armor = Math.max(0, d.armor); d.speed = Math.max(1, d.speed); d.charge = Math.max(0.2, d.charge);
  d.coreHp = loadout.core ? partMaxHp(PART[loadout.core]) : SLOT_BASE_HP.core;
  return d;
}

// Build a fresh, full-HP combat-ready mech from a garage mech definition.
export function runtimeMech(mechDef) {
  const d = derive(mechDef.loadout);
  const parts = {};
  for (const slot of SLOTS) { if (mechDef.loadout[slot]) { const mx = partMaxHp(PART[mechDef.loadout[slot]]); parts[slot] = { hp: mx, maxHp: mx, disabled: false }; } }
  return { name: mechDef.name, loadout: mechDef.loadout, tactics: mechDef.tactics, partTargets: mechDef.partTargets, derived: d, parts, alive: true, scheme: mechDef.scheme };
}

/* ---------- ENEMIES ---------- */
export function pcore(hp, ability) { return { key: 'core', label: 'Core', maxHp: hp, isCore: true, ability: ability || null }; }
export function pweapon(hp, name, power, bname, bpow, o = {}) {
  return {
    key: 'weapon', label: 'Weapon', maxHp: hp, isWeapon: true,
    ability: atk(name, power, o), broken: atk(bname, bpow, { cd: 0, cond: o.cond || 'always', part: o.part || 'core' })
  };
}
export function ppart(key, label, hp, ability) { return { key, label, maxHp: hp, ability }; }
export const EN = {
  turret: { name: 'TURRET NEST', type: 'trap', mono: true, armor: 22, speed: 20, firepower: 0, hp: 120, abilities: [atk('Auto-Turret', 15, { cd: 0, part: 'core' })], sprite: { mono: 'turret' } },
  tank: { name: 'SIEGE TANK', type: 'tank', mono: true, armor: 55, speed: 6, firepower: 8, hp: 260, abilities: [atk('Siege Gun', 18, { cd: 1, part: 'core' })], sprite: { mono: 'tank' } },
  bot: { name: 'MINI-BOT', type: 'swarm', mono: true, armor: 0, speed: 12, firepower: 8, hp: 40, abilities: [atk('Zap', 10, { cd: 0, part: 'core' })], sprite: { mono: 'bot' } },
  // --- status-inflicting enemies (Phase 6) — reuse mono sprites until bespoke art lands ---
  arc: { name: 'ARC EMITTER', type: 'trap', mono: true, armor: 16, speed: 14, firepower: 6, hp: 150, abilities: [atk('EMP Burst', 10, { cd: 2, part: 'core', status: { type: 'emp', rounds: 1 } })], sprite: { mono: 'turret' } },
  pyro: { name: 'PYRO DRONE', type: 'swarm', mono: true, armor: 0, speed: 24, firepower: 5, hp: 70, abilities: [atk('Firebomb', 6, { cd: 1, part: 'core', status: { type: 'burn', rounds: 2, power: 5 } })], sprite: { mono: 'bot' } },
  scrap: { name: 'SCRAP MECH', type: 'mech', armor: 6, speed: 8, firepower: 8, parts: [pcore(130), pweapon(45, 'Rusty Cannon', 16, 'Sputter', 6)], sprite: { loadout: { head: 'hawkeye', core: 'scrap', rarm: 'scrapgun', legs: 'tread' } } },
  line: { name: 'LINE MECH', type: 'mech', armor: 12, speed: 9, firepower: 12, parts: [pcore(150), pweapon(50, 'Rifle', 16, 'Single Bolt', 6), ppart('backpack', 'Backpack', 50, atk('Missile', 26, { cd: 2, part: 'core' }))], sprite: { loadout: { head: 'owl', core: 'bastion', rarm: 'vulcan', larm: 'missarm', backpack: 'fieldkit', legs: 'sprint' } } },
  sniper: { name: 'RAIL SNIPER', type: 'sniper', armor: 10, speed: 15, firepower: 30, parts: [pcore(130), pweapon(48, 'Railshot', 40, 'Bad Shot', 8, { cond: 'target-lowest-integrity' })], sprite: { loadout: { head: 'hawkeye', core: 'runner', rarm: 'gatling', legs: 'sprint' } } },
  bruiser: { name: 'BRUISER', type: 'mech', armor: 20, speed: 7, firepower: 16, parts: [pcore(185), pweapon(60, 'Hammer', 26, 'Punch', 10, { cd: 1, part: 'weapon' })], sprite: { loadout: { head: 'iris', core: 'bastion', rarm: 'plasma', larm: 'shieldarm', legs: 'tread' } } },
  warden: {
    name: 'THE WARDEN', type: 'boss', armor: 28, speed: 9, firepower: 16, sprite: { loadout: { head: 'owl', core: 'reactor', rarm: 'gatling', larm: 'shieldarm', backpack: 'shpack', legs: 'tread' } }, parts: [
      pcore(420, sup('Overload Surge', 'buff', 16, { cd: 6, cond: 'when-self-below-50' })),
      pweapon(85, 'Siege Cannon', 24, 'Cracked Barrel', 8, { cd: 1, part: 'core' }),
      ppart('backpack', 'Doom Array', 70, atk('Overload Beam', 46, { cd: 2, cond: 'target-lowest-integrity', part: 'core' }))]
  },
};

/* ---------- MISSIONS (lane-structured) ----------
   node kinds: fight {enemies}, assist {}, segment {terrain,require,dmg}  */
export const F = (name, threat, enemies) => ({ kind: 'fight', name, threat, enemies });
export const ASSIST = (name = 'Assist Point') => ({ kind: 'assist', name });
export const SEG = (name, terrain, require, dmg) => ({ kind: 'segment', name, terrain, require, dmg });
export const MISSIONS = [
  {
    id: 0, name: 'FIRST CONTACT', diff: 1, desc: 'One duel. Build a mech, send it, watch the parts fight. Note the enemy has a Core and a Weapon.',
    lanes: [{ terrain: 'open', nodes: [F('Scrap Mech', 'Light', ['scrap'])] }]
  },
  {
    id: 1, name: 'THE GAUNTLET', diff: 2, desc: 'A turret chips your Core, then a mech duel — wounds carried over. Repair between fights.',
    lanes: [{ terrain: 'open', nodes: [F('Turret Nest', 'Trap', ['turret']), F('Line Mech', 'Medium', ['line'])] }]
  },
  {
    id: 2, name: 'CROSSFIRE', diff: 3, desc: "A tank you can't crack + a sniper that deletes you. Default aim loses. Re-aim at the sniper — kill its Core, or disable its Weapon.",
    lanes: [{ terrain: 'open', nodes: [F('Tank + Sniper', 'Tactics', ['tank', 'sniper'])] }]
  },
  {
    id: 3, name: 'THE WARDEN', diff: 3, desc: 'Swarm, then a bruiser that smashes your weapon, then the boss. Full-Repair a downed part before the Warden.',
    lanes: [{ terrain: 'open', nodes: [F('Bot Swarm', 'Swarm', ['bot', 'bot', 'bot']), F('Bruiser', 'Heavy', ['bruiser']), F('The Warden', 'BOSS', ['warden'])] }]
  },
  // --- Phase 4 content ---
  {
    id: 4, name: 'PINCER', diff: 3, desc: 'Two lanes. The AIR lane needs a FLY mech. Clear the open lane to an assist point, then HOLD to lend fire into the sky sniper fight.',
    lanes: [
      { terrain: 'open', nodes: [F('Recon Screen', 'Medium', ['scrap', 'bot']), ASSIST('Assist Point'), F('Line Holder', 'Medium', ['line'])] },
      { terrain: 'air', nodes: [F('Air Patrol', 'Light', ['bot', 'bot']), F('Sky Sniper', 'Tactics', ['sniper'])] },
    ]
  },
  {
    id: 5, name: 'THE BREACH', diff: 3, desc: 'Three lanes, three terrains — one mech each. OPEN (anyone), HIGHLAND (no treads/hover; chasm segment), WATER (needs SWIM). A full coverage puzzle.',
    lanes: [
      { terrain: 'open', nodes: [F('Vanguard', 'Medium', ['line', 'bot']), F('Siege Tank', 'Heavy', ['tank'])] },
      { terrain: 'highland', nodes: [SEG('Chasm', 'chasm', ['jump', 'fly'], 34), F('Ridge Sniper', 'Tactics', ['sniper']), F('Bruiser', 'Heavy', ['bruiser'])] },
      { terrain: 'water', nodes: [F('Depths Patrol', 'Medium', ['bot', 'bot', 'line'])] },
    ]
  },
  // --- Phase 6 content: status effects on the enemy side ---
  {
    id: 6, name: 'SCORCHED EARTH', diff: 3, desc: 'Pyro drones set you ablaze — burn keeps ticking between hits — then an arc emitter stuns your weapon every couple of rounds while a line mech pounds your Core. Bring armor + repair, or burst them down before the fire and static stack up.',
    lanes: [{ terrain: 'open', nodes: [F('Firestarters', 'Swarm', ['pyro', 'pyro']), F('Arc Line', 'Tactics', ['arc', 'line'])] }]
  },
];

/* ---------- preset mechs & default colour schemes ---------- */
export function mkMech(name, loadout) { return { name, loadout: Object.assign({}, loadout), tactics: {}, partTargets: {} }; }
export const PRESETS = [
  mkMech('ROOK-7', { head: 'iris', core: 'bastion', rarm: 'plasma', larm: 'shieldarm', backpack: 'shpack', legs: 'tread' }),   // tread bruiser — OPEN only, huge armor
  mkMech('SWIFT-2', { head: 'owl', core: 'runner', rarm: 'vulcan', larm: 'saber', backpack: 'thrust', legs: 'sprint' }),  // ground+fly striker — air/highland/chasm
  mkMech('OTTER-9', { head: 'hawkeye', core: 'reactor', rarm: 'gatling', larm: 'missarm', backpack: 'fieldkit', legs: 'dive' }),   // swim support — water; assist + repair kit
];
export const SCHEME_DEFAULTS = ['Vanguard', 'Venom', 'Ember'];
