/* ============================================================
   Lightning Strike — deterministic skirmish simulation.
   Pure: same (runMech, enemyDefs, seed, prebuff, assistSpec) always
   yields the same SkirmishLog. No DOM. The renderer replays the log.
   ============================================================ */
import { PART, SLOTS, SLOT_LABEL, partMaxHp, isWeaponPart } from './data.js';

export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- combat tuning ----
export const FP_SCALE = 0.8, ARMOR_DIV = 130, ARMOR_CAP = 0.6, CHIP = 3, MULTI_MULT = 0.6, VAR = 0.12, MAX_ROUNDS = 18;

export function buildPlayerSimUnit(runMech) {
  const parts = [];
  for (const slot of SLOTS) {
    const id = runMech.loadout[slot]; if (!id) continue; const p = PART[id];
    const ps = runMech.parts[slot];
    const part = {
      key: slot, label: SLOT_LABEL[slot], slot, maxHp: partMaxHp(p), hp: ps.hp, disabled: ps.disabled,
      isCore: slot === 'core', isWeapon: isWeaponPart(p),
      ability: p.ability ? Object.assign({}, p.ability) : null, broken: p.broken ? Object.assign({}, p.broken) : null,
      cond: (runMech.tactics[slot] || (p.ability && p.ability.condition) || 'always'),
      pt: (runMech.partTargets[slot] || (p.ability && p.ability.partTarget) || 'core')
    };
    parts.push(part);
  }
  const d = runMech.derived;
  return { id: 'P', side: 'player', name: runMech.name, type: 'mech', mono: false, armor: d.armor, speed: d.speed, firepower: d.firepower, guard: 0, cds: {}, status: [], parts, hasAssist: false, sprite: { loadout: runMech.loadout, scheme: runMech.scheme || 'Vanguard' } };
}
export function buildAssistSimUnit(spec) {
  // a lent unit: one attack, side player, never targeted (enemies aim only at P), never dies.
  return {
    id: 'A', side: 'player', name: spec.name + ' ⟲', type: 'assist', mono: true, hp: 9999, maxHp: 9999,
    armor: 0, speed: spec.speed, firepower: spec.firepower, guard: 0, cds: {}, status: [], isAssist: true,
    abilities: [Object.assign({}, spec.ability, { key: 'a0', cond: 'always', pt: 'core' })]
  };
}
export function buildEnemySimUnit(def, idx) {
  const id = 'E' + idx;
  if (def.mono) {
    return {
      id, side: 'enemy', name: def.name, type: def.type, mono: true, armor: def.armor, speed: def.speed, firepower: def.firepower,
      hp: def.hp, maxHp: def.hp, guard: 0, cds: {}, status: [], sprite: def.sprite,
      abilities: def.abilities.map((a, i) => Object.assign({}, a, { key: 'm' + i, cond: a.condition, pt: a.partTarget || 'core' }))
    };
  }
  const parts = def.parts.map(p => ({
    key: p.key, label: p.label, maxHp: p.maxHp, hp: p.maxHp, disabled: false, isCore: !!p.isCore, isWeapon: !!p.isWeapon,
    ability: p.ability ? Object.assign({}, p.ability) : null, broken: p.broken ? Object.assign({}, p.broken) : null,
    cond: p.ability ? p.ability.condition : 'always', pt: p.ability ? (p.ability.partTarget || 'core') : 'core'
  }));
  return { id, side: 'enemy', name: def.name, type: def.type, mono: false, armor: def.armor, speed: def.speed, firepower: def.firepower, guard: 0, cds: {}, status: [], parts, sprite: def.sprite };
}
const corePart = u => u.parts && u.parts.find(p => p.isCore);
const unitAlive = u => u.isAssist ? true : (u.mono ? u.hp > 0 : (corePart(u) ? corePart(u).hp > 0 : false));
function coreFrac(u) { if (u.mono) return u.hp / u.maxHp; const c = corePart(u); return c ? c.hp / c.maxHp : 0; }
function activeAbilities(u) {
  if (u.mono) return u.abilities.map(a => ({ src: a, key: a.key, name: a.name, type: a.type, power: a.power, targeting: a.targeting, cooldown: a.cooldown, cond: a.cond, pt: a.pt, status: a.status || null, broken: false }));
  const out = [];
  for (const part of u.parts) {
    if (part.disabled) {
      if (part.isWeapon && part.broken) out.push({ src: part.broken, key: part.key, name: part.broken.name, type: 'attack', power: part.broken.power, targeting: part.broken.targeting || 'single', cooldown: part.broken.cooldown || 0, cond: part.cond, pt: part.pt, status: part.broken.status || null, broken: true });
      continue;
    }
    if (part.ability) out.push({ src: part.ability, key: part.key, name: part.ability.name, type: part.ability.type, power: part.ability.power, targeting: part.ability.targeting, cooldown: part.ability.cooldown, cond: part.cond, pt: part.pt, status: part.ability.status || null, broken: false });
  }
  return out;
}
function condFiringMet(cond, u, foes, round) {
  switch (cond) {
    case 'first-round-only': return round === 1;
    case 'when-self-below-50': return coreFrac(u) < 0.5;
    case 'when-2plus-enemies': return foes.length >= 2;
    case 'when-ally-assisting': return !!u.hasAssist;
    default: return true;
  }
}
function chooseTargetUnit(cond, foes) {
  const hpOf = u => u.mono ? u.hp : corePart(u).hp;
  if (cond === 'target-lowest-integrity') return foes.reduce((a, b) => hpOf(b) < hpOf(a) ? b : a);
  if (cond === 'target-most-armor') return foes.reduce((a, b) => b.armor > a.armor ? b : a);
  if (cond === 'target-highest-firepower') return foes.reduce((a, b) => b.firepower > a.firepower ? b : a);
  return foes[0];
}
function choosePart(ptId, target) {
  if (target.mono) return null;
  if (ptId === 'core') return corePart(target);
  let p;
  if (ptId === 'weapon') p = target.parts.find(x => x.isWeapon && !x.disabled);
  else if (ptId === 'backpack') p = target.parts.find(x => x.key === 'backpack' && !x.disabled);
  return p || corePart(target);
}
// Add or refresh a status effect on a unit (longer duration / stronger power wins).
function addStatus(target, s) {
  if (!target.status) target.status = [];
  const ex = target.status.find(x => x.type === s.type);
  if (ex) { ex.rounds = Math.max(ex.rounds, s.rounds); ex.power = Math.max(ex.power || 0, s.power || 0); }
  else target.status.push({ type: s.type, rounds: s.rounds, power: s.power || 0 });
}
// Resolve a unit's active statuses at the start of its turn: burn deals flat (no-rng,
// deterministic) damage; emp flags a skipped action. Returns {stunned}. Ticks emit a
// log entry so the cutscene can show them. Runs only when the unit has statuses, so
// status-free fights are byte-identical to before.
function tickStatus(u, round, flat) {
  if (!u.status || !u.status.length) return { stunned: false };
  let stunned = false;
  for (const s of u.status) {
    if (s.type === 'emp') { stunned = true; }
    else if (s.type === 'burn') {
      const part = u.mono ? null : corePart(u);
      const dealt = s.power;
      let hpAfter;
      if (u.mono) { u.hp = Math.max(0, u.hp - dealt); hpAfter = u.hp; }
      else { part.hp = Math.max(0, part.hp - dealt); hpAfter = part.hp; }
      const disabled = !u.mono && part.hp <= 0;
      const killed = u.mono ? u.hp <= 0 : (part.isCore && part.hp <= 0);
      flat.push({
        round, actorId: u.id, actorName: u.name, actorSide: u.side, abilityName: 'Burn', kind: 'status', type: 'status',
        targets: [{ unitId: u.id, partKey: part ? part.key : 'core', partLabel: part ? part.label : null, name: u.name, value: dealt, hpAfter, blocked: false, disabled, killed, appliedStatus: 'burn' }]
      });
    }
  }
  u.status = u.status.map(s => ({ type: s.type, rounds: s.rounds - 1, power: s.power })).filter(s => s.rounds > 0);
  return { stunned };
}
export function resolveSkirmish(runMech, enemyDefs, seed, prebuff, assistSpec) {
  const rng = mulberry32(seed >>> 0);
  const P = buildPlayerSimUnit(runMech);
  const assistU = assistSpec ? buildAssistSimUnit(assistSpec) : null;
  P.hasAssist = !!assistU;
  const Es = enemyDefs.map((d, i) => buildEnemySimUnit(d, i));
  const allies = assistU ? [P, assistU] : [P];
  const all = () => [...allies, ...Es];
  const aliveArr = arr => arr.filter(unitAlive);
  const units0 = all().map(u => ({
    id: u.id, side: u.side, name: u.name, type: u.type, mono: u.mono, armor: u.armor, speed: u.speed, isAssist: !!u.isAssist, sprite: u.sprite,
    hp: u.mono ? u.hp : undefined, maxHp: u.mono ? u.maxHp : undefined,
    parts: u.mono ? undefined : u.parts.map(p => ({ key: p.key, label: p.label, maxHp: p.maxHp, startHp: p.hp, isCore: p.isCore, isWeapon: p.isWeapon, startDisabled: p.disabled }))
  }));
  const flat = []; let result = null;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (!unitAlive(P)) { result = 'lose'; break; }
    if (aliveArr(Es).length === 0) { result = 'win'; break; }
    const order = aliveArr(all()).slice().sort((a, b) => (b.speed - a.speed) || (a.side === 'player' ? -1 : 1));
    for (const u of order) {
      if (!unitAlive(u)) continue;
      const st = tickStatus(u, round, flat);          // burn ticks / emp stun
      if (!unitAlive(P)) { result = 'lose'; break; }
      if (aliveArr(Es).length === 0) { result = 'win'; break; }
      if (st.stunned) { flat.push({ round, actorId: u.id, actorName: u.name, actorSide: u.side, abilityName: 'STUNNED', kind: 'stunned', type: 'stunned', targets: [] }); continue; }
      const foes = u.side === 'player' ? aliveArr(Es) : (unitAlive(P) ? [P] : []);
      if (foes.length === 0) continue;
      u.guard = 0;
      const abils = activeAbilities(u).sort((a, b) => prio(a) - prio(b));
      for (const A of abils) {
        if ((u.cds[A.key] || 0) > 0) continue;
        const isPB = (u.side === 'player' && !u.isAssist && prebuff && prebuff.key === A.key && round === 1);
        if (A.type === 'attack') { if ((u.side === 'player' ? aliveArr(Es) : [P]).filter(unitAlive).length === 0) break; }
        if (A.type === 'full-repair') { if (!u.parts || !u.parts.some(p => p.disabled && !p.isCore)) continue; }
        if (A.type === 'heal') { if (!u.parts || !u.parts.some(p => !p.disabled && p.hp < p.maxHp)) { if (!(u.mono && u.hp < u.maxHp)) continue; } }
        if (!isPB && !condFiringMet(A.cond, u, foes, round)) continue;
        const act = applyAbility(u, A, (u.side === 'player' ? aliveArr(Es) : [P]), rng, round, isPB ? prebuff.mult : 1);
        if (!act) continue;
        u.cds[A.key] = A.cooldown || 0;
        flat.push(act);
        if (!unitAlive(P)) { result = 'lose'; break; }
        if (aliveArr(Es).length === 0) { result = 'win'; break; }
      }
      if (result) break;
    }
    for (const u of all()) for (const k in u.cds) if (u.cds[k] > 0) u.cds[k]--;
    if (result) break;
  }
  if (!result) result = aliveArr(Es).length === 0 ? 'win' : 'lose';
  const partsAfter = {};
  for (const p of P.parts) partsAfter[p.slot] = { hp: Math.max(0, Math.round(p.hp)), maxHp: p.maxHp, disabled: p.disabled };
  return { units: units0, flat, result, playerPartsAfter: partsAfter, coreAfter: Math.max(0, Math.round(corePart(P).hp)), coreMax: corePart(P).maxHp };
}
function prio(a) { return a.type === 'buff' ? 0 : a.type === 'full-repair' ? 1 : a.type === 'heal' ? 2 : a.type === 'defense' ? 3 : 4; }
function applyDamage(target, part, raw, rng) {
  let dmg = raw * (1 + (rng() * 2 - 1) * VAR);
  dmg = dmg * (1 - Math.min(ARMOR_CAP, target.armor / ARMOR_DIV));
  let blocked = false;
  if (target.guard > 0) { const ab = Math.min(target.guard, dmg); target.guard -= ab; dmg -= ab; if (dmg <= 0.5) blocked = true; }
  const dealt = blocked ? 0 : Math.max(CHIP, Math.round(dmg));
  let hpAfter, disabled = false, killed = false;
  if (target.mono) { target.hp = Math.max(0, target.hp - dealt); hpAfter = target.hp; killed = target.hp <= 0; }
  else {
    part.hp = Math.max(0, part.hp - dealt); hpAfter = part.hp;
    if (part.hp <= 0 && !part.disabled) { part.disabled = true; disabled = true; } if (part.disabled) disabled = true;
    killed = part.isCore && part.hp <= 0;
  }
  return { unitId: target.id, partKey: part ? part.key : 'core', value: dealt, hpAfter, blocked, disabled, killed };
}
function applyAbility(u, A, foes, rng, round, mult) {
  const act = { round, actorId: u.id, actorName: u.name, actorSide: u.side, abilityName: A.name, broken: A.broken, type: A.type, targets: [] };
  if (A.type === 'attack') {
    const power = A.power * (mult || 1); const base = power + u.firepower * FP_SCALE;
    let tgts;
    if (A.targeting === 'multi') { tgts = foes.slice(); }
    else { tgts = [chooseTargetUnit(A.cond, foes)]; }
    for (const t of tgts) {
      const part = choosePart(A.pt, t);
      const raw = base * (A.targeting === 'multi' ? MULTI_MULT : 1);
      const res = applyDamage(t, part, raw, rng);
      if (A.status && res.value > 0 && !res.killed) { addStatus(t, A.status); res.appliedStatus = A.status.type; }
      act.targets.push(Object.assign({ name: t.name, partLabel: part ? part.label : null }, res));
    }
  } else if (A.type === 'heal') {
    const cand = u.parts ? u.parts.filter(p => !p.disabled && p.hp < p.maxHp) : [];
    if (!cand.length) return null;
    const part = cand.reduce((a, b) => b.hp < a.hp ? b : a);
    part.hp = Math.min(part.maxHp, part.hp + A.power);
    act.kind = 'heal'; act.value = A.power; act.targets.push({ unitId: u.id, partKey: part.key, partLabel: part.label, name: u.name, value: A.power, hpAfter: part.hp, heal: true });
  } else if (A.type === 'full-repair') {
    const dis = u.parts.filter(p => p.disabled && !p.isCore); if (!dis.length) return null;
    const part = dis.find(p => p.isWeapon) || dis[0];
    part.disabled = false; part.hp = part.maxHp;
    act.kind = 'full-repair'; act.targets.push({ unitId: u.id, partKey: part.key, partLabel: part.label, name: u.name, hpAfter: part.hp, revived: true });
  } else if (A.type === 'defense') { u.guard += Math.round(A.power); act.kind = 'guard'; act.value = Math.round(A.power); }
  else if (A.type === 'buff') { u.firepower += Math.round(A.power); act.kind = 'buff'; act.value = Math.round(A.power); }
  return act;
}
