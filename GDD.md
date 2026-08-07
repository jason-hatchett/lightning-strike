# ⚡ Lightning Strike — Game Design Document (Vision)

*Working title. A web-based tactics-battler where you don't pilot the mech and you don't pick units — you build machines part by part, set their combat instincts, and send them up the lane. When they meet an enemy, the fight resolves itself in a cutscene you set up but don't touch.*

**Doc type:** Vision doc — pitch, pillars, and feature breadth. Implementation detail comes later.
**Version:** 0.3 (part-based mechs — per-part HP, Core-kill, disable/degrade, Heal vs Full-Repair)

---

## 1. Elevator Pitch

**Lightning Strike ⚡** is a browser-based mech tactics-battler. You are the ops director aboard a battle-airship, bolting together disposable war machines from scavenged parts and sending them up multi-lane battlefields. You never pilot them. Instead, each part you bolt on grants the mech a **combat ability** and a **trigger condition** — its instincts. When a mech advances into an enemy, the encounter resolves as a short, **skippable auto-combat cutscene**: both sides fire their abilities in initiative order, exactly as their loadouts and tactics dictate. Your genius (or ruin) was decided in the garage.

Between fights, integrity carries over and attrition builds — so your only live lever is **Lightning in a Bottle** (**Lightning** for short), the director's reserve: spend it on the lane to repair a battered mech or pre-load a decisive ability before the next clash.

It's *Unicorn Overlord*'s "the tactics you set are the game" auto-resolve, welded to *Armored Core*'s "the build IS the game" obsession, wrapped in neon, synth, and a high-score chase. Pilots are cheap. The airship is forever. Lose a run, keep the swagger, launch again.

---

## 2. Design Pillars

1. **The build is the game.** Fun lives in the garage. Every part is two decisions at once — a stat and an ability with a condition. Skirmishes are the *reveal* of a plan, not a place you play.
2. **Set instincts, don't steer.** Combat is auto-resolved and hands-off. The player's craft is loadout + tactics (conditions/priorities) beforehand, and a few high-impact **Lightning** calls between fights. No twitch, no micromanagement.
3. **Fast, legible, replayable.** Skirmish cutscenes are short and skippable. A defeat is a shrug and a restart, not a tragedy. Neon-arcade clarity: you should read a fight's outcome as it plays, or skip straight to the result.
4. **Expendable pilots, eternal ship.** Death is a mechanic, not a punishment. The meta-game is upgrading the airship; the moment-to-moment is throwing brave idiots at cannons.

---

## 3. Fantasy & Tone

**Retro-arcade. Neon, synthwave, high-score energy.** Style over lore. The world is a backdrop for the loop, not a novel:

- CRT-glow UI, chunky pixel/vector mechs, chiptune-adjacent synth score, screen-shake and big damage numbers.
- Combat cutscenes are punchy and stylized — ability names flash, initiative order reads left-to-right, hits land with juice. Always one tap from skipping to the result.
- Minimal narrative in radio-chatter one-liners and mission flavor text, never long cutscenes.
- Pilots are named, disposable, and slightly ridiculous ("ROOK-7," "callsign: MEATBALL"). You get attached anyway. That's the joke.
- Failure screen is a leaderboard flex: distance flown, scrap earned, mechs lost. **Run it back.**

---

## 4. Core Loop

```
GARAGE (build mechs + set tactics)  →  DEPLOY (assign up to 3 mechs to lanes)
        ↑                                        ↓
   SHOP / SALVAGE  ←  OVERWORLD (airship) ←  LANE RUN (advance → auto-resolved
                                              skirmishes; spend Lightning between them)
```

1. **Garage** — Assemble mechs from parts (stats + abilities). Set each ability's trigger condition (its tactics).
2. **Overworld** — Pilot the airship across a node map. Choose your next deployment; risk vs. reward per node.
3. **Lane run** — Assign mechs to lanes. Each mech advances up its lane; contact with an enemy/obstacle triggers an auto-resolved **skirmish**. Integrity persists between skirmishes. Spend **Lightning** on the lane to heal or pre-buff.
4. **Aftermath** — Collect scrap and parts. Repair or scrap survivors. Bury the dead (cheaply).
5. **Shop / Safe node** — Trade parts, buy repairs, spend currency.
6. Repeat until the run ends (victory node or total loss), then bank meta-progress on the ship and relaunch.

---

## 5. Mech Construction (AC6-lite, ability-driven)

Every mech is **six slots, one part per slot.** Each part does two things: it **always adds flat stats**, and it **may grant one active combat ability**. Weapons always grant an ability — their attack. Other parts grant abilities only sometimes; the rest are pure stat parts.

| Slot | Fantasy | Typical fittings | Example ability granted |
|------|---------|------------------|-------------------------|
| **Head** | Sensors & targeting | Targeting computers, scanners | *Lock-On* (buff: next attack can't miss / +power) |
| **Core** | Chassis & reactor | Sets base Integrity + Charge | *Reactor Vent* (self-repair burst) — or pure stat |
| **R-Arm** | Primary weapon *(always an attack)* | Rifles, blades, gatlings | *Burst Fire* (single-target attack) |
| **L-Arm** | Secondary weapon or shield | Blades, missiles, **shield packs** | *Raise Guard* (defense) / *Overhead Slash* (attack) |
| **Backpack** | Shoulder-mounted heavy gear | Missile pods, drone bays, **shield packs**, thrusters | *Missile Salvo* (multi-target attack) |
| **Legs** | Mobility & poise | Boosters, treads, spider legs | *Evade* (dodge next hit) — or pure stat |

> **Cross-slot rule (unchanged):** most items key to a slot type, but a few are cross-slot. Missile launchers and shield packs fit **L-Arm or Backpack** — the AC6 "hold it or shoulder it?" tension. Weapon items always grant their attack ability wherever they're equipped.

**Up to 6 abilities per mech.** A max build (all six slots ability-granting) fields six distinct abilities in a fight. A stat-heavy build fields fewer abilities but hits harder / soaks more — a real tradeoff, not a strict upgrade.

### 5.1 Stats (post-revision)

Five derived stats. **Range is removed** (encounters are discrete, not spatial). **Stability is renamed Armor.**

- **Integrity** — the mech's total HP, **distributed across its parts** (the Core takes the largest share; see §5.3). Part HP **persists between skirmishes** (attrition matters). Topped up by Heal / Lightning; disabled parts revived only by Full-Repair.
- **Firepower** — scales the power of this mech's attack abilities.
- **Armor** *(was Stability)* — flat damage reduction on incoming hits.
- **Speed** — **Initiative**: who acts earlier each round. Also sets lane-travel pace between skirmishes.
- **Charge** — how fast this mech feeds the shared **Lightning** reserve.

*(Weight/energy/heat budgets remain a possible "AC6-full" expansion — deliberately out of v1 scope.)*

### 5.2 Mobility tags & terrain (multi-lane)

Parts also grant **mobility tags** — passive keywords, *not* stats. **Legs set the base tag** — one of **GROUND / TREAD / HOVER / SWIM** — and a **Backpack** can add **FLY** or **JUMP** on top. A mech's tag set is the union of what its parts grant (e.g. GROUND legs + a jetpack = GROUND + FLY).

Tags exist for one reason: **they gate which lanes a mech may be deployed to** once battles go multi-lane (see §6.1). A jetpack opens air lanes; a boost-jump pack clears chasms; tank TREADs are barred from highland. Crucially, **terrain is a pure deployment gate — it confers no in-combat modifier.** A jetpack might still grant an always-on evasion *ability* (that's the part doing its job), but the *terrain itself* never buffs or debuffs the fight. This keeps lane assignment a real puzzle without piling math onto combat.

*(The single-lane slice ignores terrain entirely; it arrives with multi-lane battles in Phase 4.)*

### 5.3 Part HP, disabling & repair

Every mech — yours and every enemy **mech/boss** — is a set of parts, and **each part has its own HP.** The Integrity stat is the pool, distributed across the slots with the **Core** taking the lion's share; durability parts (shield packs, treads, heavy cores) harden the specific part they sit on. Part HP and damage **persist across a lane run.**

- **The Core is the kill.** A mech is destroyed only when its **Core HP hits 0.** Every other part can be knocked out without ending the fight.
- **Disable a part → lose its action.** Drop a non-Core part to 0 HP and it's **disabled**: its ability can't fire. Flat stats stay (a disabled leg still gives its speed) — only the *action* is lost.
- **Weapons degrade, they don't vanish.** A disabled **primary weapon** falls back to a **broken attack** — a fraction of the real thing: a blade becomes a pistol-whip, automatic fire becomes a single bolt, a targeting-boosted rifle fires uncalibrated. A mech is never fully toothless, just badly downgraded until repaired.
- **Disabled is latched.** Once at 0, a part stays disabled even if its HP is later healed above 0 — **only a Full-Repair brings the action back.**

Two distinct support skill types handle this:
- **Heal** — restores HP to living parts; **never revives a disabled one.**
- **Full-Repair** — targets a **disabled** part, restores it to full, and **re-enables its action** (un-degrades the weapon).

**Monolithic enemies** — **tanks, drone swarms, turrets** — have **no parts:** one HP pool, nothing targetable, no disabling. They die at 0 and can share a battle with part-based mechs. (Player mechs are always part-based.)

**Inspiration to mine:** Armored Core 6's part catalog and garage UI (tabbed slots, live stat-delta preview, weapon archetypes). *Unicorn Overlord*'s **tactics system** (per-skill trigger conditions, initiative order, cooldown-gated auto-resolve) and its **equipment-granted item skills**. Borrow AC6's legibility and UO's "your setup fights for you" depth.

---

## 6. Battle System

### 6.1 Engagement (on the lane)
- Up to **3 parallel lanes.** The player deploys **up to 3 mechs**, at most one per lane.
- Each lane is a track seeded with **enemy mechs, tanks, obstacles/traps,** and **assist points.**
- A mech **auto-advances** up its lane (pace set by Speed). When it moves into an enemy or obstacle's zone, a **skirmish** begins.
- **Integrity persists** across every skirmish in the lane run — you carry your wounds forward. This is the attrition spine that makes Lightning and build durability matter.

#### Terrain & deployment eligibility (multi-lane)

Each lane has a **dominant terrain** that gates which mechs can be assigned to it, checked against the mech's **mobility tags** (§5.2) *before* deployment. If a mech lacks the terrain's requirement, it simply isn't an option for that lane — so the lane loadout is a puzzle: the right lane needs the right chassis. **Terrain is gate-only** — once a mech is in, terrain adds nothing to the fight itself.

| Mobility tag | Open | Air | Water *(submerged)* | Highland | Chasm |
|---|:--:|:--:|:--:|:--:|:--:|
| **GROUND** (bipedal) | ✓ | – | – | ✓ | – |
| **TREAD** (heavy tracks) | ✓ | – | – | ✗ *barred* | – |
| **HOVER** | ✓ | – | – | ✗ | – |
| **SWIM** | ✓ | – | ✓ | – | – |
| **JUMP** (boost-jump pack) | ✓ | – | – | ✓ | ✓ |
| **FLY** (jetpack) | ✓ | ✓ | – | ✓ | ✓ |

*✓ eligible · – lacks the capability · ✗ explicitly barred.* Tags stack, so a GROUND+FLY mech can take Open, Air, Highland, and Chasm lanes — but not Water (flying doesn't help you fight submerged; that needs SWIM). Pure-TREAD mechs are the extreme tradeoff: superb armor, but stuck on Open lanes.

**Hybrid granularity — lane gate + segment features.** The dominant terrain gates *entry*; **segments along the lane** add local features. A mech with the matching tag passes a segment freely; one without it hits a **hazard** — a trap-style skirmish or a costly detour (attrition), never a stat penalty (still gate-only in spirit). Example: an Open lane with a mid-run **chasm segment** — a JUMP/FLY mech skips it, a plain GROUND mech takes a hazard crossing. So even *eligible* builds want the right mobility add-ons.

### 6.2 The skirmish (auto-resolved, skippable)
Contact triggers a short **mini-cutscene** that plays out a fully pre-determined exchange. The player has **no live input** during it — it can be **watched or skipped to the result** at any time.

- Combat runs in **rounds.** Each round, every eligible ability on both sides resolves in **initiative order** (by Speed).
- An ability fires when **(a)** it's **off cooldown** and **(b)** its **trigger condition** is met (see 6.3). There is **no action-point budget** — across a multi-round skirmish, cooldowns and conditions are the only gates. All six of a mech's abilities can go off in a long enough fight.
- **Damage** = base power × attacker Firepower scaling − target Armor, applied to the **targeted part** (default: the Core — see §6.3). Reduce a part to 0 to **disable** it; reduce a **Core** to 0 to **destroy** the mech (§5.3). Monolithic enemies just have one pool.
- Skirmish ends when one side is destroyed (Core down, or a monolithic unit at 0) or an objective is met. Surviving mechs carry their remaining **part HP and any disabled/degraded parts** onward.

The cutscene is where the "reveal" lives now: you watch your tactics pay off or fall apart, then move on. Juice and skippability are both first-class — this must be satisfying to watch *and* frictionless to skip on a re-run.

### 6.3 Abilities & Tactics (the UO layer)
Each ability carries: **type** (attack / defense / **heal** / **full-repair** / buff / trap), **base power**, **cooldown** (in rounds), an **initiative modifier**, and a player-set **trigger condition**. In the garage, the player sets each ability's condition — this is the strategic heart, the equivalent of *Unicorn Overlord*'s tactics.

Example conditions:
- **Targeting:** *enemy with lowest Integrity* · *most-armored enemy* · *highest-Firepower enemy* · *when 2+ enemies (multi-hit)*
- **Firing:** *always* · *when my Integrity < 50%* · *first round only* · *when an ally is assisting this lane*
- **Part-target (attacks):** beyond *which enemy*, an attack tactic picks *which part* — **Core** (go for the kill; the default) or a specific subsystem: their **weapon** (degrade their offense), their **backpack/support** (strip a shield or heal). Monolithic enemies ignore this — they have no parts. Disable-before-kill is a new tactical axis: soften a dangerous mech, or race its Core.

Tune conditions so a defensive ability guards at the right moment, a finisher targets the weakened enemy, a **Full-Repair** fires the instant a weapon goes down, and a heavy attack opens the fight. A great loadout with bad tactics loses; the skill is in both.

### 6.4 Encounter types
- **1v1 duel** — enemy mech with its own ability set and tactics. A test of build-vs-build.
- **Swarm** — several mini-bots with simple attacks; rewards multi-target abilities and staying power.
- **Obstacle / trap** — **one-sided:** the trap enacts a scripted sequence against you (mine detonation, turret volley, ambush). Your defensive abilities and Armor decide how much you shrug off before you break through.

**Part-based vs monolithic:** **mechs and bosses** are part-based (targetable subsystems you can disable); **tanks, drone swarms, and turrets** are monolithic (one HP pool, nothing to disable). A single battle can mix both — a boss flanked by a swarm.

### 6.5 Lightning in a Bottle — the director's lever
With combat non-interactive, the player's live agency moves to **the lane between fights.** **Lightning in a Bottle** (**Lightning** for short) is a shared reserve that charges from each mech's Charge stat and from winning skirmishes. It is spent **outside combat**:

- **Repair** — restore **part HP** to a battered mech (the answer to chip attrition; does **not** revive a disabled part).
- **Full-Repair** — revive one **disabled part**, restoring its action and un-degrading its weapon before the next fight.
- **Pre-buff** — apply a temporary boost to a mech before it engages.
- **Pre-combat set-up lever** — at the moment of engagement, optionally spend Lightning to *guarantee* or *empower* one ability for the coming skirmish (e.g., force it to fire round one, or spike its power). This is the one decision point at each clash.

No Lightning is spent *during* the cutscene — the fight is already determined once it begins. (*The game is titled **Lightning Strike ⚡**; the reserve shares the name by design — you're bottling the same lightning your mechs strike with, then spending it to intervene.*)

### 6.6 Assist points (lane-crossing hook, reframed)
At an **assist point**, a mech can commit to **support an adjacent lane** instead of pushing forward. When a neighbor enters a skirmish, an assisting mech **lends an ability into that fight** (its assist-tagged ability joins the neighbor's initiative order). This makes lane assignment a real question — who holds the middle, and is that mech a bruiser or a support build whose best abilities are conditioned on *"when an ally is assisting."* Terrain sharpens it further: the mech that *can* deploy to the awkward air or water lane may not be the one you'd have picked to hold it, forcing assist coverage from a neighbor.

### 6.7 Boss skirmish
Some missions climax against a **boss mech**: a single massive threat where all three lanes converge and every player mech can assist the fight at once — a six-, twelve-, or eighteen-ability melee resolved in one long cutscene. The boss is a part-based mech writ large, with multiple **subsystems** (weapon arms, backpack, core). Part-target tactics let you **disable a subsystem to shut down its nastiest ability** — blow the weapon arm to blunt its damage, strip the backpack to kill its heal — or race its **Core** for the kill. Coordinated tactics + a well-timed Lightning pre-buff or Full-Repair break it before it breaks all three of your mechs.

---

## 7. Onboarding: The Ramp

- **Mission 1 — one lane, one mech, one duel.** Build a mech, watch a single auto-resolved skirmish, learn that *the parts fight for you.* No tactics editing yet (sensible defaults), no Lightning.
- **Mission 2 — a trap, then a fight.** Introduces integrity persistence: the trap chips you, so you arrive at the duel already hurt. Teaches attrition.
- **Mission 3 — tactics unlocked.** Player sets trigger conditions *and* part-targets; a fight is authored so the *default* tactics lose but a smart re-order — or **disabling the enemy's weapon instead of chipping its Core** — wins. Teaches the UO layer: conditions + part-targeting.
- **Mission 4 — Lightning + two lanes + first assist point.** Full kit: repair part HP, **Full-Repair a weapon that got knocked out**, pre-buff, cross-lane assist. The second lane carries **terrain** (e.g. an air lane) only a FLY-equipped mech can enter — teaching deployment eligibility and forcing a garage rethink before you deploy.
- **First boss** shortly after — teaches convergence and coordinated tactics.

Each step adds exactly one concept, learned by watching a fight you set up.

---

## 8. Overworld & Meta-Progression

### 8.1 The airship
The player commands a **battle-airship** traversing a **node-map run** (branching paths, à la FTL / Slay the Spire). Node types:

- **Deployment nodes** — a lane run to fight. Risk tiers signaled up front (scrap payout vs. threat).
- **Safe nodes** — shops (trade parts ↔ currency, buy repairs), pilot recruitment, ship-system tinkering.
- **Salvage/event nodes** — quick risk/reward beats; a chance at rare parts and new abilities.
- **Boss node** — gates the end of a region.

### 8.2 Roguelike run structure — "expendable pilots, eternal ship"
- **Within a run:** you build a stable of mechs and pilots. Integrity attrition and lost mechs are the pressure. Scavenge parts/scrap from every fight to keep fielding fresh machines.
- **Run ends** on reaching the final victory node *or* losing your last deployable mech with no scrap to rebuild.
- **Across runs:** the **airship persists.** Permanent meta-progression lives on the ship:
  - Unlock new part/ability categories and shop inventory tiers into the pool.
  - Upgrade ship systems: bigger garage, faster Lightning baseline, better salvage yields, extra starting scrap, new starting pilots.
  - Cosmetic/flex unlocks feeding the high-score/leaderboard fantasy.

The emotional contract: **you never lose the ship, so a failed run is fuel, not grief.**

### 8.3 Economy
Two resources:
- **Currency** — from mission payouts; spent in shops on parts/repairs/pilots.
- **Scrap** — from salvaged wreckage; the raw material to build/repair mechs in the field between shops.

Design tension: salvage the enemy for scrap (build now) or preserve the payout (bank currency)? Integrity persistence means a reckless win still costs you — attrition is the third, invisible currency.

---

## 9. Feature Breadth (Vision — not all v1)

- **Ability pool & rarity** — commons → rares; rare parts carry stronger or unique abilities and richer conditions.
- **Deeper tactics** — compound conditions ("lowest-Integrity enemy, but only round 2+"), ability chaining/combos.
- **Pilot traits** — cheap pilots come with a quirk (steady aim, reckless, salvage-hound) that flavors a build.
- **Faction/enemy variety** — swarms, sniper mechs, shield walls, trap-heavy lanes — each pressures different tactics.
- **Weekly seed / leaderboard** — deterministic auto-resolve makes shared seeds and reproducible runs natural. Core to the arcade fantasy.
- **Endless mode** — post-campaign infinite escalation.

---

## 10. Platform & Tech Posture (light)

- **Web-first**, plays in a browser. **Deterministic, seeded, round-based auto-resolve** — the non-interactive combat model makes this cleaner than a realtime sim, and it's what the weekly-seed/leaderboard fantasy needs.
- Zero twitch input; all decisions are pre-battle (loadout + tactics) or discrete Lightning calls between fights.
- Garage/tactics UI legibility is the biggest craft investment: the AC6 stat-delta preview *plus* a readable tactics/conditions editor.

---

## 11. Open Questions (for later docs)

- Lightning economy specifics: shared pool vs. per-mech? Charge rate tuning against attrition pace.
- How much of an enemy's tactics is visible to the player before engaging (scouting)?
- Cooldown units — rounds only, or some abilities on "once per skirmish"?
- Number of lanes locked at 3, or late-region experiments?
- Terrain: do enemies respect the same mobility gates? How many terrain types per region, and can a lane's terrain be *changed* mid-run (flooding, collapse)?
- Part HP: how is the Integrity pool split across slots, and how big is the Core's share? How many disable-targets does the tactic expose — every slot, or a short list (Core / weapon / support)? Do enemies get scouting on *your* parts?
- MVP scope cut line — see the companion spec.

---

*Sources of inspiration: Armored Core 6 (part system, garage UI, weapon archetypes), Unicorn Overlord (tactics/conditions + initiative auto-resolve, equipment-granted item skills), Ogre Battle (hands-off resolution of a plan you set), FTL / Slay the Spire (roguelike node-map runs, expendable resources, meta-unlocks).*
