import { describe, it, expect } from 'vitest';
import { derive, mechTags, canDeploy, partMaxHp, PART, PARTS, EN, PRESETS, partsForSlot, isWeaponPart } from '../src/data.js';

describe('derive() — stat aggregation', () => {
  it('sums equipped part stats over the base and floors to sane minimums', () => {
    const d = derive({ core: 'bastion', legs: 'tread', rarm: 'vulcan' });
    // base armor 0 + bastion 14 + tread 20 = 34; speed base10 -3 (bastion) -5 (tread) = 2
    expect(d.armor).toBe(34);
    expect(d.speed).toBe(2);
    expect(d.firepower).toBe(10 + 15); // base + vulcan
    expect(d.coreHp).toBe(partMaxHp(PART.bastion)); // 120 base + 120 integrity = 240
  });
  it('clamps speed and charge to their minimums', () => {
    const d = derive({}); // empty loadout
    expect(d.speed).toBeGreaterThanOrEqual(1);
    expect(d.charge).toBeGreaterThanOrEqual(0.2);
    expect(d.coreHp).toBe(120); // SLOT_BASE_HP.core when no core equipped
  });
});

describe('mechTags() + canDeploy() — mobility gating', () => {
  it('defaults to ground when nothing grants a tag', () => {
    expect(mechTags({})).toEqual(['ground']);
  });
  it('unions leg + backpack mobility tags', () => {
    const tags = mechTags({ legs: 'sprint', backpack: 'thrust' });
    expect(tags.sort()).toEqual(['fly', 'ground']);
  });
  it('gates terrain by tag (air needs fly, water needs swim, highland bars tread)', () => {
    expect(canDeploy(mechTags({ legs: 'sprint' }), 'air')).toBe(false);
    expect(canDeploy(mechTags({ legs: 'sprint', backpack: 'thrust' }), 'air')).toBe(true);
    expect(canDeploy(mechTags({ legs: 'dive' }), 'water')).toBe(true);
    expect(canDeploy(mechTags({ legs: 'tread' }), 'highland')).toBe(false);
    expect(canDeploy(mechTags({ legs: 'sprint' }), 'highland')).toBe(true);
  });
});

describe('catalog integrity', () => {
  it('every part id is unique and maps back through PART', () => {
    const ids = PARTS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PARTS) expect(PART[p.id]).toBe(p);
  });
  it('every slot has at least one equippable part', () => {
    for (const slot of ['head', 'core', 'rarm', 'larm', 'backpack', 'legs'])
      expect(partsForSlot(slot).length).toBeGreaterThan(0);
  });
  it('classifies weapon parts by attack ability', () => {
    expect(isWeaponPart(PART.vulcan)).toBe(true);
    expect(isWeaponPart(PART.shieldarm)).toBeFalsy(); // shield = defense support, not a weapon
    expect(isWeaponPart(PART.iris)).toBeFalsy();       // no ability at all
  });
  it('every preset is a valid, fully-equipped loadout', () => {
    for (const m of PRESETS)
      for (const slot of ['head', 'core', 'rarm', 'larm', 'backpack', 'legs'])
        expect(PART[m.loadout[slot]]).toBeTruthy();
  });
  it('every enemy is either mono (hp+abilities) or part-based (parts[])', () => {
    for (const [id, def] of Object.entries(EN)) {
      if (def.mono) { expect(def.hp).toBeGreaterThan(0); expect(def.abilities.length).toBeGreaterThan(0); }
      else { expect(def.parts.some(p => p.isCore)).toBe(true); }
    }
  });
});
