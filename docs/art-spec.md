# Lightning Strike — Pixel-Art Asset Spec (Phase 5)

**Purpose.** The contract a pixel artist works against so sprites drop straight into the
game with zero rework. It defines canvas sizes, the part-layer system, anchor points,
the recolor palette, animation tags, file/naming conventions, and the full asset list.

**Companion docs:** [MVP-SPEC.md](../MVP-SPEC.md) §7 Phase 5 · [GDD.md](../GDD.md) §5–6.

**Division of labor.** This spec + the Canvas renderer + the palette-swap system are built
in-engine. The **sprites are drawn by a human/contractor in Aseprite.** Concept the look
first in Midjourney / Scenario, then produce final art here. Programmer-art placeholders
stand in until real assets land — the game must render (ugly but correct) before art exists.

**Golden rule.** *The sim never sees pixels.* Everything here is presentation over a
deterministic `SkirmishLog`. Art has no gameplay effect.

---

## 1. The one thing that must read

From a mech's sprite **alone**, at lane-board size, a player must be able to tell:

1. **Weapon archetype** — **gun** vs **sword/blade** vs **shield**.
2. **Mobility** — **legs** vs **treads** vs **hover** vs **dive** vs **thruster/jump**.

Everything else (which exact gun, panel detail, glow) is secondary. Silhouette first,
color second, detail last. If a part is ambiguous in silhouette, it fails review.

---

## 2. Canvas sizes & the shared frame

All mech parts are authored **pre-positioned on a shared frame** — an artist draws each part
where it sits on the assembled mech, so composition is just stacking layers (no per-part
offset math in code).

| Subject | Frame (W×H px) | Notes |
|---|---|---|
| Standard mech (player & enemy mechs) | **64 × 64** | Mech body fills ~40w × 58h, centered horizontally, feet on baseline (see anchors). |
| Boss mech (e.g. THE WARDEN) | **128 × 128** | Same anchor logic scaled ×2; more subsystems. |
| Monolithic — Siege Tank | **64 × 48** | Single sprite, no part layers. |
| Monolithic — Turret Nest | **48 × 48** | Single sprite. |
| Monolithic — Mini-Bot (swarm) | **24 × 24** | Single sprite; drawn 3× on screen. |
| Airship (hangar/home view) | **256 × 128** | Single illustration for Phase 5 (static). Animated in Phase 9. |
| Mobility badge icons | **16 × 16** | One per mobility tag (ground/tread/hover/swim/jump/fly). |

**Scaling.** Art is drawn at **1×** and scaled up **integer-only** with nearest-neighbor
(`image-rendering: pixelated`). Never draw at 2× "for detail" — the engine upscales. Target
render sizes: lane board ≈ 1×–2×, combat ≈ 3×–4×, garage preview ≈ 4×.

**Facing.** Author everything **facing right** (weapon toward +X). The engine mirrors
horizontally for the enemy side. Keep art readable when flipped (no baked-in text/asymmetric
insignia that breaks mirrored).

---

## 3. Part-layer system & anchors

A mech is composed of **6 part layers**, one per slot, each its own sprite on the 64×64
frame. The engine stacks them in a fixed **draw order (back → front)**:

```
1. backpack      (behind body)
2. legs          (or tread/hover/dive unit)
3. larm          (BACK arm — shield or secondary)
4. core / torso  (chest, cockpit)
5. head
6. rarm          (FRONT arm — primary weapon)
7. [weapon FX]   (muzzle flash / slash arc / guard shimmer — emitted by the renderer, not baked)
```

**Anchor guide (on the 64×64 canvas, origin top-left, +Y down).** These are *registration
guides* — draw each part so its slot sits at/around its anchor, and every build lines up.

| Slot | Anchor (x,y) | Guidance |
|---|---|---|
| head | 32, 12 | Small; top-center. Visor/eye toward +X. |
| core / torso | 32, 30 | The mass of the body; hosts the **core light** (see palette index 9). |
| rarm (front) | 44, 28 | Shoulder at anchor; forearm + **weapon** extend toward +X (right). |
| larm (back) | 20, 28 | Shoulder at anchor; shield/secondary. Sits *behind* torso. |
| backpack | 32, 20 | Behind torso top; fins/thrusters may rise above and to −X. |
| legs | 32, 46 | Top of hips at anchor; **feet rest on baseline y ≈ 62** (leave 2px). |

Provide `assets/_reference/skeleton.png` (a 64×64 guide layer with anchors + baseline marked)
as the Aseprite template — **every part file starts from this template** so registration is
automatic.

**Weapon reach.** The front weapon may extend to x ≈ 60 (gun barrel) or above the frame line
for a raised sword — keep the tip inside the 64×64 bounds (clip = broken art).

---

## 4. Weapon & mobility silhouette families

Parts inherit a **silhouette family** from their archetype so a *new* part is instantly
readable. Artists: match the family; vary the detail.

**Weapons (arm slots)**
| Family | Archetypes | Silhouette rules |
|---|---|---|
| **Gun** | kinetic, explosive | Horizontal barrel(s) extending +X past the fist; visible muzzle at index 9 (energy). Bulk = back-heavy. |
| **Sword / blade** | energy (melee) | Long straight/edged blade rising +X/up from a hilt; blade core on trim ramp (glows). Thin, diagonal. |
| **Shield** | shield | Broad vertical plate on the **back (larm) side**, wider than an arm; small emblem at index 9. |
| **Fist / none** | utility arm, empty | Compact hand, no protrusion — reads as "unarmed." |

**Mobility (legs slot + fly/jump backpacks)**
| Family | Tag | Silhouette rules |
|---|---|---|
| Bipedal | ground | Two distinct legs + feet. The default. |
| Treads | tread | Trapezoidal track unit, visible road wheels — **no legs**. Wide, low. |
| Hover | hover | Skirt/pod with a gap under it; faint jet at index 9 — feet off ground. |
| Dive | swim | Finned/streamlined legs, flipper feet. |
| Thruster / Jump | fly / jump (backpack) | Jetpack/jump nozzles on the **backpack** layer; add exhaust at index 9. |

The **16×16 mobility badge** is a redundant readability aid, not a replacement for silhouette.

---

## 5. Recolor: the indexed palette (critical)

The 5 per-mech color schemes and the enemy palette are applied by **runtime palette swap**,
so **one sheet serves all schemes.** This only works if *all art uses the shared master
palette below* — no off-palette colors, no anti-alias blending outside these entries.

**Master ramp (the source colors artists paint with).** Load `assets/palette.gpl` in Aseprite
and paint **only** from it.

| Index | Role | Master hex | Recolored? |
|---|---|---|---|
| 0 | transparent | — | — |
| 1 | base — shadow | `#0e1526` | ✅ swaps with scheme base |
| 2 | base — mid | `#16233f` | ✅ |
| 3 | base — light | `#243a63` | ✅ |
| 4 | secondary — shadow | `#0c6f82` | ✅ swaps with scheme secondary |
| 5 | secondary — mid | `#17aecb` | ✅ |
| 6 | secondary — light | `#22e0ff` | ✅ |
| 7 | trim / energy — mid | `#c79a1f` | ✅ swaps with scheme trim |
| 8 | trim / energy — light | `#ffd23e` | ✅ |
| 9 | core / muzzle / FX glow | `#ffffff` | ✅ (tinted toward trim) |
| 10 | outline | `#05070d` | ❌ fixed |
| 11 | neutral metal — dark | `#3a4763` | ❌ fixed |
| 12 | neutral metal — light | `#8f9fc0` | ❌ fixed |

- **Base ramp (1–3)** = core/body plating. **Secondary ramp (4–6)** = arms / legs / backpack.
  **Trim ramp (7–9)** = weapon energy, accents, mobility jets, core light, badge.
- **Outline (10) and neutral metals (11–12) never recolor** — they keep every scheme grounded
  and readable. Use metals for pistons, joints, barrels.
- Keep it **flat + ramped** (2–3 shades per material). No gradients, no soft AA.

**The 5 player schemes + enemy ramp** (each = base / secondary / trim hex triplets the engine
maps indices 1–3 / 4–6 / 7–9 onto; give shadow/mid/light for each):

| Scheme | base (sh/mid/lt) | secondary (sh/mid/lt) | trim (mid/lt) |
|---|---|---|---|
| **Vanguard** | `#0e1526 #16233f #243a63` | `#0c6f82 #17aecb #22e0ff` | `#c79a1f #ffd23e` |
| **Ember** | `#1a120c #2a1c10 #45301a` | `#8a3a12 #d2641e #ff8a3e` | `#b5311f #ff5a3e` |
| **Venom** | `#0a1a12 #10261a #1c4230` | `#2f7d2a #58c23a #7dff6b` | `#0c7f96 #22e0ff` |
| **Sovereign** | `#141026 #1e1636 #322a5c` | `#5a3a8a #8a5fc8 #b98cff` | `#b5236a #ff2e88` |
| **Warhound** | `#141014 #241820 #3a2a34` | `#8a1f3a #d2244f #ff3b6b` | `#c9c9d6 #ffffff` |
| **Scarlet** (R) | `#3a0e10 #7a1c22 #b83038` | `#0c6f82 #17aecb #22e0ff` | `#ffcf3e #ffe98f` |
| **Solar** (O) | `#3a1e08 #7a3e12 #c66a1e` | `#123a6e #2a6ec2 #4aa8ff` | `#ffd23e #fff0a0` |
| **Amber** (Y) | `#3a2e08 #786218 #c9a52a` | `#123a6e #2a6ec2 #4aa8ff` | `#ff6a2e #ffb46b` |
| **Verdant** (G) | `#0e2a14 #1a5226 #2c8c3e` | `#7a5a12 #c9a52a #ffe066` | `#ff3b6b #ff85a8` |
| **Azure** (B) | `#0e1a3a #1a2f70 #2c4ec8` | `#0c6f82 #17aecb #22e0ff` | `#ffd23e #fff0a0` |
| **Indigo** (I) | `#14123a #221e6e #3a34b4` | `#5a3a8a #8a5fc8 #b98cff` | `#22e0ff #a8f4ff` |
| **Amethyst** (V) | `#2a0e3a #521c74 #8230b8` | `#8a1f5a #d2246e #ff3b9b` | `#ffd23e #fff0a0` |
| **Enemy (hostile)** | `#160a10 #2a1420 #48212f` | `#8a1f2a #d22436 #ff3b4b` | `#c98a1f #ffb43e` |

Enemies always use the hostile ramp regardless of any player scheme, so **friend-vs-foe reads
instantly.** Bosses use the hostile ramp with a distinct trim (call it out per boss later).

---

## 6. Animation

Small frame counts — this is auto-battle, not a fighting game. Author with **Aseprite tags**
(exact tag names below). Suggested playback ≈ **8–12 fps**.

| Tag | Frames | Used when | Notes |
|---|---|---|---|
| `idle` | 1–2 | default | Subtle bob / power hum. Frame 0 is the static pose used on lane board & garage. |
| `act` | 3–4 | this part's ability fires | Gun: recoil + muzzle. Sword: wind-up + slash. Shield: brace. Non-weapon parts can reuse idle. |
| `hit` | 2 | this part takes damage | Flash/shudder (renderer also does a white flash — keep art subtle). |
| `disabled` | 1 | part HP hits 0 | Sparking/cracked/dark. Weapons: broken-but-present (they degrade, not vanish). |
| `destroyed` | 1–2 | **core only** | Wreck/blown pose for the death frame. |

Only the **acting part** plays `act`; other layers hold `idle` frame 0. The renderer drives
which tag+frame each layer shows from the `SkirmishLog`. Weapon FX (muzzle flash, slash arc,
guard shimmer) are **drawn by the engine** at the weapon tip — you don't have to animate
projectiles, but leave room at the muzzle/blade tip.

---

## 7. Files, export & naming

**Author:** one `.aseprite` per part, from the skeleton template, using `palette.gpl`.
**Export (per file):** a horizontal-strip PNG **+** Aseprite JSON (frame tags), via
`File ▸ Export Sprite Sheet` → *Sheet type: Horizontal*, *JSON Data: Array*, *Tags: on*.

```
Aseprite CLI (per part):
aseprite -b rarm_vulcan.aseprite --sheet rarm_vulcan.png --data rarm_vulcan.json \
         --sheet-type horizontal --list-tags --format json-array
```

**Folder layout** (delivered into the repo):
```
assets/
  _reference/skeleton.png        # 64×64 anchor+baseline template
  palette.gpl                    # master palette (indices above)
  mechs/
    head/    hawkeye.png hawkeye.json  iris.png ...
    core/    bastion.png ...
    rarm/    vulcan.png ...
    larm/    saber.png ...
    backpack/misspod.png ...
    legs/    sprint.png ...
  enemies/   tank.png turret.png bot.png  scrap/ line/ sniper/ bruiser/ warden/ (part-based → same slot layout)
  airship/   airship.png
  badges/    ground.png tread.png hover.png swim.png jump.png fly.png
```

**Naming = the part `id` from the game data** (below). Filenames are lowercase, exactly the id.
The engine keys sprites by `slot/id`, so a mismatch = missing art.

---

## 8. Full asset list (from the current build)

Every id below needs a sprite. **Family** tells the artist the silhouette to hit. (Source of
truth: `PARTS` and `EN` in `src/data.js`.)

**HEAD** (`utility`): `hawkeye`, `iris`, `owl` — small sensor heads; vary the eye/antenna.
**CORE** (`chassis`): `bastion` (heavy/tanky), `runner` (slim/fast), `reactor` (glowing vents).
**R-ARM** (weapon): `vulcan` *gun*, `plasma` *sword*, `gatling` *gun (multi-barrel)*.
**L-ARM**: `saber` *sword*, `shieldarm` *shield*, `missarm` *gun (missile, boxy)*.
**BACKPACK**: `misspod` *(missile box)*, `shpack` *(shield fins)*, `repairpod` *(utility drone/tank)*,
`fieldkit` *(toolkit)*, `drone` *(bay)*, `thrust` *(jetpack — grants FLY, add nozzles)*,
`jumpjet` *(jump nozzles — grants JUMP)*.
**LEGS**: `sprint` *bipedal*, `tread` *treads*, `spider` *bipedal (multi-joint)*,
`hover` *hover skirt*, `dive` *finned/swim*.

**ENEMIES — monolithic (single sprite):** `turret`, `tank`, `bot`.
**ENEMIES — part-based (same 6-slot layout, hostile ramp):** `scrap`, `line`, `sniper`,
`bruiser`, and boss `warden` (128×128). For part-based enemies, deliver at least core + weapon
layers; reuse silhouette families.

**Also:** `airship.png`, the 6 mobility `badges/`, and the `skeleton.png` template.

---

## 9. Minimum deliverable to unblock the build

To render the 3 preset mechs (ROOK / SWIFT / OTTER) + basic combat, the first drop needs just:

- Cores: `bastion`, `runner`, `reactor`
- Arms: `vulcan` (gun), `plasma` (sword), `gatling` (gun), `saber` (sword), `shieldarm` (shield), `missarm` (gun)
- Backpacks: `shpack`, `thrust`, `fieldkit`
- Legs: `tread`, `sprint`, `dive`
- Heads: `iris`, `owl`, `hawkeye`
- One enemy: `scrap` (part-based) + `bot` (monolithic)
- `skeleton.png`, `palette.gpl`

Everything else can follow. The renderer will show labeled placeholder boxes for any missing id.

---

## 10. Renderer contract (engine side — for reference)

- **Canvas 2D**, `imageSmoothingEnabled = false`, integer scale.
- Composite the 6 part layers per §3 draw order; each layer shows its current `{tag, frame}`.
- Apply the chosen scheme via a **color LUT** (master ramp hex → scheme hex) at load, caching
  one recolored sheet per (part, scheme). Indices 10–12 pass through unchanged.
- Drive tags/frames from the `SkirmishLog`: on a `ResolvedAction`, the actor's weapon layer
  plays `act`; targets' hit part plays `hit`; a disabled part latches `disabled`; core at 0
  plays `destroyed`. **Skip** jumps to the final composited frame. Determinism unaffected.
- Respect `prefers-reduced-motion`: hold idle frame 0, cross-fade instead of animating.

---

*Open questions for the artist kickoff:* exact mech proportions (chunky-chibi vs lanky),
outline weight (1px hard vs selective), and whether bosses get bespoke silhouettes or scaled
mech parts. Lock these against a first concept pass before producing the full catalog.
