# Lightning Strike

A lane-based mech **auto-battler** prototype. You never pilot your mechs — you
build up to three in the garage, set their instincts, assign them to battlefield
lanes, and each fight resolves on its own from a deterministic simulation.

See [GDD.md](GDD.md) for the design, [MVP-SPEC.md](MVP-SPEC.md) for the phase
plan, [docs/art-spec.md](docs/art-spec.md) for the pixel-art contract, and
[docs/roadmap.md](docs/roadmap.md) for deferred work.

## Getting started

```bash
npm install
npm run dev      # Vite dev server (hot reload) — the playable prototype
npm test         # Vitest: sim golden tests + data invariants
npm run build    # dist/index.html — one self-contained file (for hosting / Artifact)
```

## Structure

The prototype is a small Vite app. The **simulation is pure and DOM-free**, so
it is unit-tested in isolation; the UI replays the resulting log.

```
index.html          # app shell (markup + styles); loads src/main.js
src/
  data.js           # parts, enemies, missions, mobility/terrain rules, derive()  (pure)
  sim.js            # resolveSkirmish() + combat helpers — deterministic, seeded  (pure)
  schemes.js        # the 13 colour schemes + master ramp                          (pure data)
  render.js         # sprite compositor + palette-swap (canvas)                    (browser)
  ui.js             # state, garage/deploy/lane screens, skirmish cutscene         (browser)
  main.js           # entry point
assets/             # sprite sheets (assets/sprites.js is the bundled data-URI pack)
tools/              # bundle_sprites.py, gen_placeholders.py (art pipeline)
tests/              # Vitest suites
render-demo.html    # standalone sprite/scheme showcase (separate from the game)
```

### Determinism & tests

`resolveSkirmish(runMech, enemyDefs, seed, …)` is a pure function of its inputs
(seeded `mulberry32`), so combat is reproducible. `tests/sim.test.js` locks exact
outcomes with **golden snapshots** — a balance or content change surfaces as an
explicit diff. Regenerate intentionally with `npx vitest -u`.

### Art pipeline

Sprites are authored/generated on the master palette, conformed, then bundled
into `assets/sprites.js` via `python tools/bundle_sprites.py`. The renderer
recolours them per scheme at runtime. See [docs/art-spec.md](docs/art-spec.md).
