# Lightning Strike — Roadmap / Deferred Work

Running list of follow-ups intentionally deferred. Newest context at top of each
section. See [MVP-SPEC.md](../MVP-SPEC.md) for the phase plan and
[docs/art-spec.md](art-spec.md) for the art contract.

## Mechanics (Phase 6) — status effects

Landed 2026-08-24: a deterministic status-effect system in the sim
(`burn` DoT, `emp` stun), applied by an optional `status` rider on attacks, plus
two opt-in weapons — `tesla` (TESLA Lance, EMP) and `flamer` (INFERNO Jet, burn).
Status-free fights stay byte-identical, so all prior golden snapshots are
unchanged. Covered by `tests/status.test.js`.

Follow-ups:
- [ ] **Sprites for `tesla` + `flamer`** (art, parked) — new r-arm ids have no
      sprite yet, so that layer is absent in the garage/combat. Add via the
      Spartan pipeline when art resumes.
- [x] **Enemy that inflicts status** — `arc` (ARC EMITTER, EMP) and `pyro`
      (PYRO DRONE, burn) added to `EN`, wired into mission **SCORCHED EARTH**
      (id 6). Reuse the turret/bot mono sprites for now (see art follow-up).
      Covered by tests + a mission-integrity invariant. *(2026-08-24)*
- [ ] **Status-aware tactics** — firing conditions that read status, e.g.
      `when-enemy-stunned` / `target-burning`.
- [x] **Persistent status badge** on combat cards — the sim now emits
      `statusChanges` (per-unit active statuses + remaining rounds) on apply/tick,
      and the cutscene renders live pips (🔥/⚡ with a countdown) that tick down
      and clear on expiry. *(2026-08-24)*

## Art (Phase 5) — deferred

Context: the Spartan/gunmetal sprite catalog + renderer landed 2026-08-24
(branch `phase5-sprite-art`, merged to `main`). The spec-§9 minimum set is done
and wired into the garage, hangar, and combat lanes. PixelLab budget at that
point: **~11 trial generations remaining** of 40.

### Remaining placeholder parts (still old programmer-art, visible in-game)
Highest priority — these clash with the finished sprites when equipped/encountered.
Fits in one PixelLab pass (~8 generations).
- [ ] Mono enemies: `tank` (Siege Tank), `turret` (Turret Nest) — appear in
      missions 1–2 next to the new sprites.
- [ ] Backpacks: `misspod`, `repairpod`, `drone`, `jumpjet`.
- [ ] Legs: `spider`, `hover`.

### Animation
- [ ] Mono-enemy frames: `tank` / `turret` / `bot` are idle-only, so they don't
      play `act` / `hit` in the skirmish cutscene (they still get the card
      acting-glow + dead-dim). Generate act/hit/disabled strips.

### Renderer polish
- [ ] Apply the hangar tight-crop treatment (`drawMechCropped`) to the large
      garage chassis preview so it fills its panel too.

### Not-yet-touched spec assets (art-spec §8)
- [ ] `airship` illustration — 256×128 (static for Phase 5).
- [ ] Six mobility badge icons — 16×16 (ground / tread / hover / swim / jump / fly).
- [ ] Bespoke **Warden** boss — 128×128. Currently borrows catalog parts via a
      styled loadout in `EN.warden.sprite`; spec calls for a distinct silhouette.

### Pipeline notes
- Style ref: `art-input/download.jpg`. Workflow: PixelLab → crop to slot region
  → hue-snap to master palette → `tools/bundle_sprites.py`. Conform configs from
  the last pass are worth re-deriving (they lived in a scratchpad, not the repo).
