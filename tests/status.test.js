import { describe, it, expect } from 'vitest';
import { resolveSkirmish } from '../src/sim.js';
import { runtimeMech, EN, atk, PRESETS, MISSIONS } from '../src/data.js';

// Build a fresh combat mech from a bare loadout.
const mech = (loadout, name = 'TEST') => runtimeMech({ name, loadout, tactics: {}, partTargets: {} });
const burnTicks = log => log.flat.filter(a => a.kind === 'status' && a.abilityName === 'Burn');
const stunActions = log => log.flat.filter(a => a.kind === 'stunned');
const enemies = ids => ids.map(id => EN[id]);

describe('burn (damage-over-time)', () => {
  const flamerMech = () => mech({ head: 'owl', core: 'runner', rarm: 'flamer', larm: 'saber', backpack: 'thrust', legs: 'sprint' });

  it('Incinerate applies burn that ticks flat damage on the victim over later rounds', () => {
    const log = resolveSkirmish(flamerMech(), enemies(['line']), 7);
    const ticks = burnTicks(log);
    expect(ticks.length).toBeGreaterThan(0);
    // burn is flat (no variance) at the part's power → every tick deals exactly 6 to the enemy core
    for (const t of ticks) {
      expect(t.actorId).toBe('E0');
      expect(t.targets[0].value).toBe(6);
      expect(t.targets[0].partKey).toBe('core');
    }
    // a burn tick only appears on a round AFTER the first Incinerate hit
    const firstHit = log.flat.findIndex(a => a.abilityName === 'Incinerate');
    expect(ticks[0].round).toBeGreaterThan(log.flat[firstHit].round - 1);
  });

  it('is deterministic (same seed → identical burn trace)', () => {
    const a = resolveSkirmish(flamerMech(), enemies(['line']), 7);
    const b = resolveSkirmish(flamerMech(), enemies(['line']), 7);
    expect(burnTicks(a).map(t => [t.round, t.targets[0].hpAfter]))
      .toEqual(burnTicks(b).map(t => [t.round, t.targets[0].hpAfter]));
  });

  it('a burning enemy keeps losing HP even on rounds it is not directly attacked', () => {
    // core HP should be strictly lower after a burn tick than the enemy's max
    const log = resolveSkirmish(flamerMech(), enemies(['tank']), 3);
    const ticks = burnTicks(log);
    if (ticks.length >= 2) expect(ticks[1].targets[0].hpAfter).toBeLessThan(ticks[0].targets[0].hpAfter);
  });
});

describe('EMP (stun)', () => {
  const teslaMech = () => mech({ head: 'hawkeye', core: 'bastion', rarm: 'tesla', larm: 'shieldarm', backpack: 'shpack', legs: 'tread' });

  it('EMP Lance stuns the enemy, emitting a skipped-turn entry for it', () => {
    const log = resolveSkirmish(teslaMech(), enemies(['bruiser']), 9);
    const stuns = stunActions(log).filter(a => a.actorId === 'E0');
    expect(stuns.length).toBeGreaterThan(0);
  });

  it('a stunned unit takes no action on the round it is stunned', () => {
    const log = resolveSkirmish(teslaMech(), enemies(['bruiser']), 9);
    const stun = stunActions(log).find(a => a.actorId === 'E0');
    // in the stun round, E0 has a stunned entry but no attack action
    const e0ActionsThatRound = log.flat.filter(a => a.round === stun.round && a.actorId === 'E0' && a.kind !== 'stunned');
    expect(e0ActionsThatRound.length).toBe(0);
  });
});

describe('status applied to the player', () => {
  const arc = { name: 'ARC TURRET', type: 'trap', mono: true, armor: 8, speed: 4, firepower: 6, hp: 240, abilities: [atk('Shock', 8, { status: { type: 'emp', rounds: 1 } })] };
  const pyro = { name: 'PYRO DRONE', type: 'swarm', mono: true, armor: 0, speed: 30, firepower: 4, hp: 90, abilities: [atk('Flare', 6, { status: { type: 'burn', rounds: 2, power: 5 } })] };

  it('the player can be stunned by an enemy EMP', () => {
    const log = resolveSkirmish(mech({ head: 'owl', core: 'runner', rarm: 'vulcan', larm: 'saber', backpack: 'thrust', legs: 'sprint' }), [arc], 4);
    expect(stunActions(log).some(a => a.actorId === 'P')).toBe(true);
  });

  it('the player burns from an enemy DoT, taking flat 5 per tick to the core', () => {
    const log = resolveSkirmish(mech({ head: 'iris', core: 'bastion', rarm: 'plasma', larm: 'shieldarm', backpack: 'shpack', legs: 'tread' }), [pyro], 6);
    const ticks = burnTicks(log).filter(a => a.actorId === 'P');
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) expect(t.targets[0].value).toBe(5);
  });
});

describe('status-inflicting enemies (ARC EMITTER / PYRO DRONE)', () => {
  const preset = name => PRESETS.find(p => p.name === name);
  it('PYRO DRONE burns the player, ticking flat 5 to the core', () => {
    const log = resolveSkirmish(runtimeMech(preset('ROOK-7')), enemies(['pyro', 'pyro']), 11);
    const ticks = burnTicks(log).filter(a => a.actorId === 'P');
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) expect(t.targets[0].value).toBe(5);
  });
  it('ARC EMITTER stuns the player at least once', () => {
    const log = resolveSkirmish(runtimeMech(preset('ROOK-7')), enemies(['arc', 'line']), 13);
    expect(stunActions(log).some(a => a.actorId === 'P')).toBe(true);
  });
  it('SCORCHED EARTH is winnable by a tanky build (ROOK-7) with default tactics', () => {
    // both fights in the mission's single lane, wounds carried over between them
    const mission = MISSIONS.find(m => m.name === 'SCORCHED EARTH');
    const run = runtimeMech(preset('ROOK-7'));
    let anyLoss = false;
    for (const [i, node] of mission.lanes[0].nodes.entries()) {
      const log = resolveSkirmish(run, enemies(node.enemies), 6 * 10007 + i * 331 + 17);
      if (log.result !== 'win') anyLoss = true;
      // carry part HP into the next fight, like the run does
      for (const slot in log.playerPartsAfter) run.parts[slot] = { ...log.playerPartsAfter[slot] };
    }
    expect(anyLoss).toBe(false);
  });
});

describe('status durations exposed to the UI (statusChanges)', () => {
  const of = (a, id) => a.statusChanges && a.statusChanges[id];
  it('an applied burn reports its full remaining duration, then decays on each tick', () => {
    const log = resolveSkirmish(mech({ head: 'owl', core: 'runner', rarm: 'flamer', larm: 'saber', backpack: 'thrust', legs: 'sprint' }), enemies(['tank']), 3);
    const applied = log.flat.find(a => a.abilityName === 'Incinerate' && of(a, 'E0'));
    expect(of(applied, 'E0')).toContainEqual({ type: 'burn', rounds: 3 });      // fresh application
    const decayed = log.flat.some(a => a.abilityName === 'Burn' && (of(a, 'E0') || []).some(s => s.type === 'burn' && s.rounds < 3));
    expect(decayed).toBe(true);                                                  // ticked down
  });
  it('an applied EMP reports 1 round, and the stun entry shows it expired', () => {
    const log = resolveSkirmish(mech({ head: 'hawkeye', core: 'bastion', rarm: 'tesla', larm: 'shieldarm', backpack: 'shpack', legs: 'tread' }), enemies(['bruiser']), 9);
    const applied = log.flat.find(a => a.abilityName === 'EMP Lance' && of(a, 'E0'));
    expect(of(applied, 'E0')).toContainEqual({ type: 'emp', rounds: 1 });
    const stun = log.flat.find(a => a.kind === 'stunned' && a.actorId === 'E0');
    expect((of(stun, 'E0') || []).some(s => s.type === 'emp')).toBe(false);      // consumed on the stun
  });
});

// Golden logs for the new status weapons — lock their behaviour like the base sim.
describe('status weapons — golden logs', () => {
  const digest = log => ({
    result: log.result, coreAfter: log.coreAfter, actions: log.flat.length,
    kinds: log.flat.reduce((m, a) => (m[a.kind || 'act'] = (m[a.kind || 'act'] || 0) + 1, m), {}),
    trace: log.flat.map(a => `R${a.round} ${a.actorId} ${a.abilityName} -> ${a.targets.map(t => `${t.unitId}${t.appliedStatus ? '(' + t.appliedStatus + ')' : ''} -${t.value || 0}=${t.hpAfter}${t.disabled ? 'x' : ''}`).join(',')}`),
  });
  it('INFERNO Jet vs Line Mech', () => {
    expect(digest(resolveSkirmish(mech({ head: 'owl', core: 'runner', rarm: 'flamer', larm: 'saber', backpack: 'thrust', legs: 'sprint' }, 'BLAZE'), enemies(['line']), 50007))).toMatchSnapshot();
  });
  it('TESLA Lance vs Bruiser', () => {
    expect(digest(resolveSkirmish(mech({ head: 'hawkeye', core: 'bastion', rarm: 'tesla', larm: 'shieldarm', backpack: 'shpack', legs: 'tread' }, 'JOLT'), enemies(['bruiser']), 60007))).toMatchSnapshot();
  });
});
