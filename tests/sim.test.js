import { describe, it, expect } from 'vitest';
import { resolveSkirmish } from '../src/sim.js';
import { runtimeMech, PRESETS, EN } from '../src/data.js';

// Compact, stable digest of a skirmish log — enough to catch any behavioural drift
// without snapshotting the whole object graph.
function digest(log) {
  return {
    result: log.result,
    coreAfter: log.coreAfter,
    coreMax: log.coreMax,
    rounds: log.flat.length ? Math.max(...log.flat.map(a => a.round)) : 0,
    actions: log.flat.length,
    trace: log.flat.map(a =>
      `R${a.round} ${a.actorId} ${a.abilityName}${a.broken ? '~' : ''} -> ` +
      a.targets.map(t =>
        t.heal ? `${t.unitId} heal+${t.value}=${t.hpAfter}`
          : t.revived ? `${t.unitId}/${t.partKey} revived`
            : `${t.unitId}${t.partKey ? '/' + t.partKey : ''} -${t.value}=${t.hpAfter}${t.disabled ? ' [x]' : ''}${t.blocked ? ' [block]' : ''}`
      ).join(', ') + (a.kind === 'guard' ? ` guard+${a.value}` : a.kind === 'buff' ? ` fp+${a.value}` : '')
    ),
  };
}
const enemies = ids => ids.map(id => EN[id]);
const preset = name => PRESETS.find(p => p.name === name);

describe('resolveSkirmish — determinism', () => {
  it('is a pure function of its inputs (same seed → identical log)', () => {
    const a = resolveSkirmish(runtimeMech(preset('ROOK-7')), enemies(['scrap']), 12345);
    const b = resolveSkirmish(runtimeMech(preset('ROOK-7')), enemies(['scrap']), 12345);
    expect(digest(a)).toEqual(digest(b));
  });
  it('different seeds can produce different traces', () => {
    const a = resolveSkirmish(runtimeMech(preset('SWIFT-2')), enemies(['line']), 1);
    const b = resolveSkirmish(runtimeMech(preset('SWIFT-2')), enemies(['line']), 999);
    // damage variance is seeded, so at least the numeric trace should differ
    expect(a.flat.map(x => x.targets.map(t => t.value))).not.toEqual(b.flat.map(x => x.targets.map(t => t.value)));
  });
  it('does not mutate the shared preset / enemy catalog objects', () => {
    const before = JSON.stringify({ p: preset('OTTER-9'), e: EN.warden });
    resolveSkirmish(runtimeMech(preset('OTTER-9')), enemies(['warden']), 42);
    expect(JSON.stringify({ p: preset('OTTER-9'), e: EN.warden })).toBe(before);
  });
});

describe('resolveSkirmish — invariants', () => {
  it('never runs past MAX_ROUNDS and always yields a win/lose', () => {
    for (const name of ['ROOK-7', 'SWIFT-2', 'OTTER-9']) {
      for (const seed of [1, 2, 3, 7, 101]) {
        const log = resolveSkirmish(runtimeMech(preset(name)), enemies(['tank', 'sniper']), seed);
        expect(['win', 'lose']).toContain(log.result);
        expect(log.flat.every(a => a.round >= 1 && a.round <= 18)).toBe(true);
      }
    }
  });
  it('reports player part HP after the fight for every equipped slot', () => {
    const log = resolveSkirmish(runtimeMech(preset('ROOK-7')), enemies(['bruiser']), 5);
    for (const slot of ['head', 'core', 'rarm', 'larm', 'backpack', 'legs'])
      expect(log.playerPartsAfter[slot]).toMatchObject({ hp: expect.any(Number), maxHp: expect.any(Number) });
  });
});

// Golden snapshots — lock exact combat outcomes so future content/balance edits
// surface as an explicit diff. Regenerate intentionally with `vitest -u`.
describe('resolveSkirmish — golden logs', () => {
  const scenarios = [
    ['ROOK-7 vs Scrap', 'ROOK-7', ['scrap'], 10007],
    ['SWIFT-2 vs Turret+Line', 'SWIFT-2', ['turret', 'line'], 20007],
    ['OTTER-9 vs Tank+Sniper', 'OTTER-9', ['tank', 'sniper'], 30007],
    ['ROOK-7 vs Warden', 'ROOK-7', ['warden'], 40007],
    ['SWIFT-2 vs Bot swarm', 'SWIFT-2', ['bot', 'bot', 'bot'], 31000],
  ];
  for (const [label, name, foes, seed] of scenarios) {
    it(label, () => {
      expect(digest(resolveSkirmish(runtimeMech(preset(name)), enemies(foes), seed))).toMatchSnapshot();
    });
  }
});
