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

## Runbook

Task-oriented operations for working on the app.

### Run the prototype locally

```bash
npm run dev        # serves http://localhost:5173 (next free port if taken); hot-reloads
```

This is the playable game. **Opening `index.html` directly over `file://` does
not work** — it loads ES modules, which browsers block on `file://`. Use the dev
server, or build the standalone file (below), which *does* open directly.

### Run / update tests

```bash
npm test           # run the whole Vitest suite once (CI-style)
npm run test:watch # re-run on change while developing
npx vitest -u      # UPDATE golden snapshots — only after an INTENTIONAL balance/
                   # content change; review the snapshot diff before committing
```

The suite covers the deterministic sim (golden combat logs), status effects, and
data/catalog invariants. A snapshot diff you did not intend means a change
altered combat — investigate before updating.

### Build the standalone / artifact file

```bash
npm run build      # -> dist/index.html  (~140 KB, fully self-contained)
```

All JS/CSS and the base64 sprite pack are inlined, with **zero external
requests** — so it opens directly in a browser (over `file://` too), hosts
anywhere static, and satisfies the Artifact CSP. `dist/` is gitignored; it is a
build product — regenerate as needed.

### Regenerate sprites

```bash
python tools/bundle_sprites.py   # rebuild assets/sprites.js from the PNGs
npm run build                    # fold the new pack into dist/index.html
```

Author/replace art per [docs/art-spec.md](docs/art-spec.md) first.
`render-demo.html` is a standalone showcase (drag-drop art, preview every
scheme, palette lint) — open it directly; it is separate from the game.

### Troubleshooting

- **Port already in use** — Vite auto-increments, or pass `--port <N>`.
- **`esbuild` postinstall warning on `npm install`** — benign here; the platform
  binary is present. Verify: `node -e "console.log(require('esbuild').version)"`.
- **A combat/garage part shows no sprite** — that `slot/id` has no art yet (see
  [roadmap](docs/roadmap.md)); the layer is skipped and the mechanics still work.

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

## Artifact

The prototype is published as a **private** Claude Artifact — a hosted,
point-in-time snapshot of the built single-file app (it does **not** auto-sync
with the repo):

> **Lightning Strike — Prototype v0.4**
> https://claude.ai/code/artifact/b29eb5b1-6f18-4dc5-823d-34e9e9e5e4ae

### Refresh it after changes

1. **Build** the self-contained file:
   ```bash
   npm run build      # -> dist/index.html
   ```
2. **Republish** `dist/index.html` to the **same URL** above. In Claude Code,
   ask Claude to *"refresh the artifact"* — it republishes via the Artifact tool
   with `url=` that link, keeping the URL stable. (The publish step goes through
   Claude's Artifact tooling; there is no plain shell command for it.)

Notes:

- **Keep the same URL.** Passing the existing link updates in place; publishing
  without it mints a *separate* artifact.
- The artifact is private until you share it from the page's share menu
  (`/artifacts` in the Claude Code terminal, or the gallery at
  `claude.ai/code/artifacts`).
- Artifacts run under a strict CSP (no external requests), so the file must be
  self-contained — the Vite single-file build already inlines everything
  (JS, CSS, and the sprite pack), so no manual inlining is needed.
