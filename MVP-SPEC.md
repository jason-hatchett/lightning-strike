# ⚡ Lightning Strike — Phased MVP / Vertical-Slice Spec

*Companion to [GDD.md](GDD.md). The vision doc says what the game is; this says what we build first, in what order, and where the scope line is.*

**Doc type:** Buildable spec — systems, data models, phase plan, exit criteria.
**Version:** 0.3 (part-based mechs: per-part HP, Core-kill, disable/degrade, Heal vs Full-Repair)

> **Changed in 0.3 (this rev):** Mechs are now **part-based** — every part has its own **HP**; the **Core is the kill** (Core HP 0 = destroyed), other parts at 0 are **disabled** (ability lost — but a disabled **weapon degrades to a broken fallback**, never silent). Attacks pick a **part-target** (default Core) so you can disable-before-kill. **Heal** (top up HP) and **Full-Repair** (revive a disabled part) are distinct skill types; Lightning gains a Full-Repair action. Part HP + disabled state **persist across a lane**. Enemies are **part-based** (mechs/bosses) or **monolithic** (tanks/swarms/turrets — single HP, no parts). See [GDD §5.3](GDD.md).
>
> **Changed in 0.2:** Combat is no longer a real-time lane brawl. It's an **auto-resolved, skippable skirmish** triggered on contact (Unicorn Overlord–style). Each part grants **flat stats + optionally one active ability**; weapons always grant their attack. Abilities fire by **initiative + player-set trigger conditions**, gated by **cooldowns (no action-point budget)**. **Range** stat removed; **Stability → Armor**. The old **OVERLOAD** live meter is replaced by **Lightning in a Bottle** (**Lightning**). The game is renamed **Lightning Strike ⚡**. The earlier realtime prototype is a throwaway reference, not the build target.

---

## 1. What the MVP Must Prove

One thesis: **the garage-and-tactics loop is fun, and watching it resolve is satisfying.** If building a mech, setting its instincts, and watching a skirmish play out your plan isn't satisfying, nothing downstream saves it.

Three risky-fun questions, front-loaded:

1. Is building a mech — **stats + an ability with a condition per part** — legible and satisfying? (AC6 stat-delta preview + a readable tactics editor.)
2. Does the **auto-resolved skirmish cutscene** deliver the reveal thrill — readable when watched, frictionless when skipped?
3. Does the **tactics layer** (conditions/initiative) create real "my setup won this" moments, and does **Lightning + integrity attrition** make the between-fight layer matter?

Everything else (three lanes, node-map runs, ship meta, economy, bosses) layers on after those land.

---

## 2. Scope Cut Line

| **IN for vertical slice** | **OUT until later phases** |
|---|---|
| 6-slot mech builder, one part per slot | Weight/energy/heat budgets (AC6-full) |
| Part = flat stats + **own HP** + optional 1 ability | Ability rarity tiers, compound conditions, combos |
| Stats: Integrity *(distributed to part HP)*, Firepower, Armor, Speed(initiative), Charge | Range stat (removed entirely) |
| **Part HP · Core-kill · disable (weapons degrade to a fallback) · part-target tactic · Heal vs Full-Repair** | Enemy-part scouting/intel; per-slot HP fine-tuning |
| Per-ability **trigger condition** editor (small preset list) | Fully freeform tactics scripting |
| Deterministic, **round-based auto-resolve** | Realtime anything |
| Skippable skirmish **cutscene** with initiative order + cooldowns | Polished VFX / full juice pass |
| **Part HP + disabled/degraded state persist** across a single lane run | Cross-run persistence, permadeath economy |
| **Lightning**: out-of-combat repair + full-repair + one pre-combat set-up | Full Lightning ability set, per-mech vs shared tuning |
| 1 lane → later 3 lanes | Overworld node map, airship travel |
| — | Terrain gating + mobility tags (arrives Phase 4 with multi-lane) |
| ~24 parts (incl. ~14 ability-granting), 3 enemy tactics sets | Faction variety, scouting/intel |
| Hand-authored 4-skirmish tutorial ramp | Roguelike run structure |
| Local save (browser storage) | Accounts, cloud save, ship meta |

**Rule:** if a feature doesn't serve one of the three thesis questions, it waits.

---

## 3. Tech Posture

Recommendation (the non-negotiable is *deterministic*):

- **Language:** TypeScript throughout. Shared types between UI and sim.
- **Sim:** Pure TS module, **no DOM, no `Math.random`.** `resolveSkirmish(config, seed) → SkirmishLog`. The round-based model makes this trivially deterministic — a step up from the realtime prototype. Seeded PRNG (mulberry32/xorshift) only.
- **UI (garage/tactics/menus):** React (or Svelte). Two crafted surfaces: the **loadout builder** (stat-delta preview) and the **tactics editor** (per-ability condition pickers).
- **Cutscene render:** Canvas 2D (or PixiJS later). The renderer **replays a `SkirmishLog`** — an ordered list of resolved actions — and can fast-forward/skip to the final frame. It computes no gameplay.
- **State/save:** JSON in `localStorage`. No backend.
- **Build:** Vite, static deploy.

Architectural line, now even sharper than 0.1: **the sim emits a `SkirmishLog`; the cutscene is pure playback of that log.** Skip = jump to last log entry. Determinism + a serializable log is the foundation for replays, weekly seeds, and any future leaderboard.

---

## 4. Core Data Models

Sketch, not final schema.

```ts
type SlotType = 'head' | 'core' | 'rarm' | 'larm' | 'backpack' | 'legs';  // 6 slots

interface Part {
  id: string;
  name: string;
  slot: SlotType;
  alsoFits?: SlotType[];            // cross-slot: missiles/shields fit larm|backpack
  archetype: 'kinetic'|'energy'|'explosive'|'shield'|'utility'|'chassis'|'mobility';
  stats: PartStats;                 // ALWAYS applied (flat)
  ability?: AbilityDef;             // weapons: always present (their attack). others: sometimes
  brokenAbility?: AbilityDef;       // weapons only: the degraded fallback used when this part is disabled
  tags?: MobilityTag[];             // Phase 4: legs grant base tag; backpacks add FLY/JUMP
}

// Every equipped part has its own HP. Base HP by slot; the part's own integrity stat hardens it.
// The Core carries survival — Core HP 0 = mech destroyed. Other parts at 0 = disabled (ability lost).
const SLOT_BASE_HP: Record<SlotType, number> = { core:120, legs:70, rarm:55, larm:55, backpack:55, head:40 };
// partMaxHp(part) = SLOT_BASE_HP[part.slot] + (part.stats.integrity ?? 0)

// Phase 4 (multi-lane). Legs grant exactly one base tag; a backpack may add FLY or JUMP.
type MobilityTag = 'ground' | 'tread' | 'hover' | 'swim' | 'fly' | 'jump';
type TerrainType = 'open' | 'air' | 'water' | 'highland' | 'chasm';

// A mech's tag set = union of its parts' tags. Eligibility is a pure pre-deployment gate;
// terrain never enters resolveSkirmish() (gate-only — no in-combat modifier).
const TERRAIN_REQUIRES: Record<TerrainType, MobilityTag[]> = {
  open:     ['ground','tread','hover','swim','fly','jump'], // anyone
  air:      ['fly'],
  water:    ['swim'],
  highland: ['ground','jump','fly'],   // tread & hover barred
  chasm:    ['jump','fly'],
};
function canDeploy(mechTags: MobilityTag[], t: TerrainType): boolean {
  return mechTags.some(tag => TERRAIN_REQUIRES[t].includes(tag));
}

interface PartStats {               // additive; range is gone
  integrity?: number;
  firepower?: number;
  armor?: number;                   // was 'stability'
  speed?: number;                   // initiative + lane pace
  charge?: number;                  // feeds Lightning
}

interface AbilityDef {
  id: string;
  name: string;
  type: 'attack' | 'defense' | 'heal' | 'full-repair' | 'buff' | 'trap';
  power: number;                    // attack: dmg base · heal/full-repair: hp restored · defense: guard
  targeting: 'single' | 'multi' | 'self' | 'ally';
  cooldown: number;                 // in rounds; 0 = every round
  initiativeMod?: number;           // + acts earlier
  defaultCondition: ConditionId;    // sensible preset; player can override
  defaultPartTarget?: PartTargetId; // attacks only; defaults to 'core' (go for the kill)
  assistable?: boolean;             // can be lent into an adjacent lane (later phase)
}
// heal = restore hp to living parts (never revives a disabled one);
// full-repair = clear a disabled part's latch, restore to full, re-enable its action.

// player-selectable per ability, in the garage tactics editor
type ConditionId =
  | 'always'
  | 'target-lowest-integrity'
  | 'target-most-armor'
  | 'target-highest-firepower'
  | 'when-2plus-enemies'
  | 'when-self-below-50'
  | 'first-round-only';

// attacks ALSO pick which part to hit. Monolithic enemies (tanks/swarms) ignore this.
type PartTargetId = 'core' | 'weapon' | 'backpack' | 'head' | 'legs';

interface PartState {                             // per equipped slot; persists across a lane run
  slot: SlotType;
  hp: number; maxHp: number;                      // hits 0 -> disabled (latched)
  disabled: boolean;                              // latched at first 0; cleared ONLY by full-repair
}
interface Mech {
  id: string;
  pilotName: string;
  loadout: Record<SlotType, string | null>;      // slot -> Part.id
  tactics: Record<string, ConditionId>;          // abilityId -> chosen firing/target condition
  partTargets: Record<string, PartTargetId>;     // per attack ability -> which enemy part to aim at
  parts: Record<SlotType, PartState>;            // CURRENT part HP + disable state, persists
  derived: DerivedStats;
}
// alive === parts.core.hp > 0.  A disabled non-core part loses its ability; a disabled WEAPON
// instead swaps to part.brokenAbility (weak fallback) — never fully toothless. Flat stats always stay.
interface DerivedStats { firepower; armor; speed; charge; }  // integrity now lives per-part, not here

// EnemyUnit is EITHER part-based (mech/boss: has parts + Core-kill + disabling, like a Mech)
// OR monolithic (tank/swarm/turret: a single hp pool, no parts, no disabling). Both can co-exist.
interface SkirmishConfig {
  seed: number;
  player: Mech;                     // (later: assisting mechs)
  enemies: EnemyUnit[];             // duel / swarm / trap; each part-based or monolithic
}

interface SkirmishLog {             // sim output; cutscene + tests consume this
  seed: number;
  rounds: RoundLog[];               // each round: ordered ResolvedAction[]
  result: 'win' | 'lose';
  playerPartsAfter: Record<SlotType, PartState>;  // carried forward: hp + disabled per part
}
interface ResolvedAction {
  round: number; actor: string; abilityId: string;
  targetPart?: SlotType;            // which part was hit (undefined for monolithic targets)
  targets: string[]; damage: number[];
  disabled?: string[];              // parts/units disabled by this action
  effect?: 'heal'|'full-repair'|'guard'|'buff'|'degrade'; // for render + assertions
}
```

The **`SkirmishLog`** is the contract between sim, cutscene, and tests. It's what the cutscene animates, what "skip" jumps through, and what a future replay/leaderboard stores.

---

## 5. Skirmish Resolution Model

Round-based, deterministic, non-interactive. **Terrain/mobility (Phase 4) never enters this model** — it's a pre-deployment eligibility gate only, so the sim stays clean and deterministic.

1. **Trigger:** on the lane, a mech advances into an enemy/obstacle zone → `resolveSkirmish` runs to completion, producing a `SkirmishLog`. (Optionally the player spent Lightning for a pre-combat set-up first — see §6.)
2. **Per round:** build an initiative order of all living units on both sides (by Speed + ability `initiativeMod`). Walk it; for each unit, evaluate its abilities:
   - an ability **fires** if off cooldown **and** its condition holds (target exists / self-HP threshold / round number / enemy count).
   - **no AP budget** — cooldowns and conditions are the only gates.
   - **attacks** pick a target unit (condition) *and* a target part (`partTarget`, default `core`). `damage = power × firepowerScale(attacker) − target.armor`, floored at a chip minimum, applied to that **part's** HP. A weapon whose own part is disabled fires its `brokenAbility` instead.
   - **part hits 0 →** disabled (latched). A **Core** at 0 (or a monolithic unit at 0) → destroyed. A disabled weapon degrades; other disabled parts go silent. Monolithic enemies skip all part logic (one pool).
   - **heal** restores part HP to living parts (never revives a disabled one); **full-repair** clears a disabled part's latch, restores it, and re-enables the action.
3. **Traps** are one-sided enemy scripts (fixed ability sequence, no player-side targeting beyond breaking through).
4. **End:** one side destroyed (all cores / monolithic units at 0), or a trap resolves. The player's remaining **part states** write to `SkirmishLog.playerPartsAfter` and persist to the next skirmish — damage *and* disabled latches carry forward.
5. **Cutscene:** the renderer plays `rounds` in order — ability name flashes, initiative reads left→right, hits land. **Skip** jumps to the final frame + result. Determinism means skip and watch reach the identical outcome.

**Determinism gate (Phase 0):** identical `(config, seed)` → identical `SkirmishLog`, asserted in CI.

---

## 6. Lightning in a Bottle (out-of-combat lever)

Replaces the realtime OVERLOAD meter from v0.1. **Lightning** (short name) is a shared reserve, charges from each mech's Charge stat over lane travel + on skirmish wins. Spent **only outside the cutscene**:

- **Repair** — restore **part HP** to a mech between skirmishes (the chip-attrition valve; does **not** revive a disabled part).
- **Full-Repair** — revive one **disabled part**: clear the latch, restore it to full, re-enable its action / un-degrade its weapon.
- **Pre-combat set-up** — at the instant of engagement, optionally spend Lightning to **empower or guarantee one ability** for the coming skirmish (e.g., force it round-1, or +power). Injected into `SkirmishConfig` before `resolveSkirmish` runs — so it's still fully deterministic.

Slice ships **Repair + Full-Repair + one pre-combat set-up option**; the fuller Lightning menu and per-mech-vs-shared tuning are later.

---

## 7. Phase Plan

Each phase is independently demoable with a hard exit criterion.

### Phase 0 — Skeleton & determinism harness
- Repo, Vite, TS, seeded PRNG, sim/render/UI split.
- `resolveSkirmish()` stub returns a canned `SkirmishLog`; a trivial canvas replays it with a skip button.
- **Exit:** identical `(config, seed)` → byte-identical `SkirmishLog` across 100 runs (unit test). Protects everything downstream.

### Phase 1 — The Garage (thesis Q1)
- 6-slot builder, ~12 starter parts (stats always; abilities on all weapons + some others).
- Live derived-stat preview with hover deltas. Cross-slot rule enforced.
- **Minimal tactics editor:** for each granted ability, pick a condition from the preset list (defaults pre-filled).
- Save/load a mech to localStorage.
- **Exit:** you can build a mech, see how parts change stats *and* what abilities/conditions result, and it feels good to fiddle. (Playtest gut-check.)

### Phase 2 — One skirmish, the reveal (thesis Q2)
- Real `resolveSkirmish`: rounds, initiative, conditions, cooldowns, damage. **Part-based units** — each part has HP, **Core-kill** decides win/lose, a disabled weapon swaps to its broken fallback. Monolithic enemies (swarm bots, turrets) use a single pool.
- Canvas **cutscene** replaying the log (part HP bars, a "DISABLED / DEGRADED" flash) + **Skip to result.**
- Wire Garage → engage → skirmish → result.
- Content: a 1v1 duel and a swarm (Missions 1 shape).
- **Exit:** a stranger builds a mech, watches a skirmish, understands *why* it won/lost from the playback, and wants to re-tune. Skip feels good on a retry.

### Phase 3 — Tactics depth + Lightning + attrition (thesis Q3)  ← GO/NO-GO
- Trap encounter (one-sided) + **part HP and disabled/degraded state persist** across a short lane of 3 skirmishes.
- **Part-target tactics** (aim at Core / weapon / support) join the condition editor. Lightning: charges over the lane, **Repair** part HP + **Full-Repair** a disabled part between fights, **one pre-combat set-up** spend.
- An authored fight where **default tactics lose but a smart re-order — or disabling the enemy's weapon instead of racing its Core — wins.** Proves the layer.
- **Exit:** players report "my setup / my Lightning call won that." **If the three thesis questions aren't all "yes" here, iterate before building breadth.**

### Phase 4 — Three lanes + terrain + assist points
- Up to 3 mechs, one per lane; lane assignment UI.
- **Terrain gating (mobility tags):** each lane has a `TerrainType`; the assignment UI only offers mechs whose tags pass `canDeploy` (§4). Legs grant the base tag; backpacks add FLY/JUMP. Show *why* a mech is ineligible so the player can re-equip in the garage before deploying. Gate-only — terrain does **not** enter `resolveSkirmish`.
- **Hybrid segments:** a lane may carry a segment feature (e.g. a chasm) that a matching-tag mech passes free, else triggers a hazard skirmish or attrition detour — reuses the trap/encounter machinery, no new combat math.
- Assist points: an assisting mech lends an `assistable` ability into a neighbor's skirmish (joins its initiative order).
- Conditions like *when-ally-assisting* become meaningful.
- Content: Missions 3–4 (two-lane, then a terrain-gated three-lane).
- **Exit:** lane assignment is a real decision — terrain forces build/coverage choices; support builds feel distinct from bruisers.

### Phase 5 — Visual identity: see your mechs (NEW)
The sim and `SkirmishLog` are untouched — this is **pure playback + presentation** (§3). A **part-driven renderer** draws each mech from its loadout so you can *read* a build at a glance; combat becomes something you watch mechs *do*, not just bars and numbers. Art is **pixel-art sprites** (authored in Aseprite): they fit the game's CRT/scanline UI, recolor cleanly by palette swap, animate easily, and stay readable at lane-board size — deeper art & free-form player customization are Phase 9.
- **Part-driven mech sprite** — compose a mech from **per-part sprite layers** stacked at fixed anchor points: a core/body, two arms by weapon archetype (**gun** for kinetic/explosive, **sword/blade** for energy melee, **shield** for shield parts), a backpack, and **legs that read the mobility tag** (bipedal / treads / hover / dive / thruster-jump). A small **mobility badge** reinforces it.
- **Asset pipeline & spec** — define the contract art must hit so sprites drop straight in: a **sprite sheet per slot** with named animation tags (idle / act / hit / disabled), documented **anchor points** so parts align across any build, and an **indexed 3-ramp palette** (base / secondary / trim) so recolor is a pure palette swap. Concept the look first in Midjourney / Scenario, then produce in **Aseprite** against this spec; programmer-art placeholders stand in until real assets land. (Claude defines the spec + builds the renderer; a human/contractor draws the sprites.)
- **Garage live preview** — the mech you're building is drawn and updates as you swap parts (alongside the existing stat-delta preview).
- **Color schemes (per mech)** — pick one of **5 preset schemes** per mech in the garage, each a **base + secondary + trim** triad applied by **palette swap** (base = core/body plating; secondary = arms / legs / backpack; trim = weapon energy, accents & mobility badge). Proposed set: **Vanguard** (steel-navy / cyan / amber), **Ember** (gunmetal / orange / red), **Venom** (dark-green / lime / cyan), **Sovereign** (indigo / violet / magenta), **Warhound** (charcoal / magenta / white). **Enemies use a fixed hostile ramp** (rust / red-magenta / amber) so friend-vs-foe reads instantly whatever schemes the player picks.
- **Combat visualization (Canvas 2D)** — the cutscene replays the `SkirmishLog` as posed mechs: an actor emotes/lunges and shows a muzzle-flash / slash / guard when it acts, the struck **part flashes and visibly breaks** when disabled. Still **skippable to the final frame**, still deterministic (visual only), still respects `prefers-reduced-motion`.
- **Airship home view** — a visual of your airship on the hangar/home screen (static illustration for now; it becomes navigable in Phase 7).
- **Minimum bar (must-have):** from a mech's appearance alone you can tell its **weapon (gun / sword / shield)** and its **mobility tag**.
- **Exit:** you can see the mech you built in the garage, watch mechs take actions in combat, and identify any mech's weapon + mobility at a glance; the `SkirmishLog` contract and determinism are unchanged.

### Phase 6 — First boss
- Single boss mech with subsystems mapped to slot vocabulary; convergent lanes; all mechs assist.
- One long cutscene; focus-fire via targeting conditions.
- **Exit:** beatable by coordinated tactics, unfair by brute force.

### Phase 7 — Run structure & economy
- Node-map overworld, **airship travel** (the airship shown on the home screen in Phase 5 becomes navigable — you pilot it across the node map); currency + scrap; one shop; field repair/build from scrap.
- Expendable pilots: lost mechs gone for the run. Run ends on victory node or last-mech loss.
- **Exit:** a full short run (5–8 nodes) plays start to finish and poses salvage-vs-payout + attrition questions.

### Phase 8 — Ship meta-progression
- Persistent airship: unlock part/ability categories, upgrade garage / Lightning baseline / salvage / starting kit.
- Failure screen with run stats (leaderboard-shaped, local).
- **Exit:** losing a run feels like fuel — you immediately re-spend meta-currency and relaunch.

### Phase 9 — Visual customization & juice (NEW, later polish)
Deepens Phase 5's placeholder visuals once the game loop is complete.
- **Player customization** — beyond the 5 preset ramps, free palette editing (custom base/secondary/trim), decals/emblems, optional part-skin variants — make a mech *look* yours.
- **Richer art & animation** — higher-fidelity sprites, more animation frames, weapon-specific VFX (tracer, beam, sparks), destruction/wreck states.
- **Juice pass** — screen shake, hit-stop, impact flashes, sound hooks — tuned to stay satisfying to *watch* and frictionless to *skip*.
- **Airship & garage polish** — the airship and hangar get the same finish.
- **Exit:** the game reads as *styled*, not schematic; players can make a mech visually their own; the skip path stays instant.

*(Post-MVP: ability rarity/combos, weekly seeds + real leaderboard, endless mode, faction variety, pilot traits, deeper tactics.)*

---

## 8. Vertical-Slice Content Targets

Slice = **Phases 0–3.** Minimum to test the thesis:

- **Parts:** ~24 total, ≥3 per slot so builds diverge. ~14 grant abilities (all weapons + select others); the rest are pure-stat. Include the cross-slot missile + shield packs.
- **Abilities:** ~12 distinct (attack / defense / heal / **full-repair** / buff / trap) so a 6-slot build reads as a real kit — plus a **broken fallback attack per weapon** for when its part is disabled.
- **Conditions & part-targets:** the 7 condition presets in §4, plus the part-target presets (Core / weapon / support).
- **Encounters:** the 4-step ramp — duel → trap+duel (attrition) → tactics + disable-gated fight → Lightning (repair/full-repair)+assist. Enemy sides get authored tactics too.
- **Enemies:** 3 archetypes — **monolithic** swarm mini-bots + gun-tank (single HP), and a **part-based** boss-lite mech with disable-able subsystems — to pressure different tactics.

---

## 9. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Auto-resolved fights are boring to *watch* | Phase 2 is the test; invest in cutscene readability + a fast, satisfying skip. If the reveal doesn't land, fix pacing before adding systems. |
| Tactics editor is fiddly / opaque | Keep to a small preset condition list for the slice; strong defaults so a fight is winnable without touching it; teach one concept per mission. |
| Determinism breaks (floats, Date, Math.random) | Phase 0 gate + CI identical-log test; lint-ban non-seeded randomness in the sim. |
| Cooldown-only (no AP) fights drag or snowball | Tune round caps and cooldowns; ensure fights resolve in a few rounds; watch for degenerate all-defense stalls. |
| Integrity persistence feels punishing, not tense | Lightning repair must be generous enough that skill recovers attrition; surface carried-over integrity clearly at each engagement. |
| Part HP adds a second layer players can't read | Compact part strip — Core prominent, limbs as pips; flash DISABLED / DEGRADED clearly; **default part-target = Core** so a player who ignores it still plays a coherent kill-the-thing game. |
| Builds collapse to one dominant kit | Stat-vs-ability tradeoff (fewer abilities = more raw stats) + enemy tactics that punish mono-strategies. |
| Terrain gating feels like a "gotcha" (wrong mech, can't deploy) | Show eligibility + the missing tag *before* committing; always allow a garage re-equip before deploy; never gate the only viable lane behind a tag the player can't yet obtain. |
| Scope creep from the vision doc | The §2 cut line is the contract; new ideas go to the GDD backlog, not the slice. |

---

## 10. Definition of Done (Vertical Slice)

- A player, cold, can: build a 6-slot mech → set a condition/part-target or two → engage → watch (or skip) an auto-resolved skirmish where parts get disabled and a weapon degrades → carry part HP + disables forward → spend Lightning to Repair / Full-Repair / pre-buff → win (Core down) or lose → re-tune → retry — all in the browser, no instructions needed.
- The sim is deterministic and covered by an identical-log test; skip and watch always agree.
- All three thesis questions (§1) answered "yes" in playtest, or a clear iteration plan if not.

---

*Next doc after this: a content/balance spreadsheet (part stat + ability tables, condition-tuned enemy tactics) once Phase 1 part/ability shapes are locked.*
