# Antidote — Project Revamp Plan

**Purpose:** A pragmatic, staged plan for making Antidote a better game and a healthier codebase, grounded in the current implementation.
**Companions:** [`aiPlan.md`](aiPlan.md) (alpha scope & backlog) · [`aiPlanLoop.md`](aiPlanLoop.md) (session workflow) · [`red-team.md`](red-team.md) (risks) · [`blue-team.md`](blue-team.md) (protections) · [`AiIdeas.md`](AiIdeas.md) (creative direction).

This document is deliberately opinionated. It does **not** replace `aiPlan.md`'s alpha definition — finish alpha first. It describes what "good" looks like afterward and the refactors that unlock it.

---

## 1. Where the project is today

Antidote is a single-page Three.js game served by PHP (`index.php`) with no build step. Systems are split across classic `<script>` files that share one global lexical scope, plus one ES module (`main.js`) that imports the rest and hangs everything off `window.*`.

**Strengths**
- Clear separation of concern by *file* (player, cure, enemies, building, fog, units).
- A documented integration contract (`aiPlan.md` §3) and a repeatable session loop.
- A surprisingly complete gameplay vision: gather → build → cure (5 steps) → defend → evac.
- Boot is defensive: `init()` and the animate loop are wrapped in `try/catch` with a visible load-error path.

**Structural liabilities** (expanded in [`red-team.md`](red-team.md))
- One global `window.objects` array holds *every* entity; most systems scan it every frame (`updateTheGray` is O(n²)).
- Heavy per-frame allocation (`new THREE.Vector3/Box3/Raycaster` in hot loops) creates GC pressure.
- State for the cure pipeline is a scatter of booleans (`isStunned`, `isSubdued`, `isBeingSubdued`, `isPatchPlaced`, `isProtecting`, `isCuredHost`, `isWorker`) with no single source of truth.
- Dev artifacts ship in the "production" entry: two test cubes, a 5-second test spawn, and verbose `console.log`.
- Two competing HUDs: the live vanilla `hud.js` and an unwired React HUD (`index.tsx`, `components/`) that cannot run without a bundler.
- Balance constants are duplicated and scattered across many files.
- Third-party code is loaded from CDNs at ancient, mismatched versions with no integrity hashes and no offline fallback.

---

## 2. Guiding principles for the revamp

1. **Finish alpha before refactoring for beta.** Ship the loop in `aiPlan.md` §1 first; use this plan for what comes after (and for low-risk cleanups that help alpha).
2. **Small, reversible steps.** Every change should leave the game bootable and the console clean.
3. **One source of truth per concept.** Entity lists, balance constants, and cure state each get a single owner.
4. **Make the hot path cheap.** No per-frame allocation or full-array scans in `animateFrame`.
5. **Prove it with tests.** Pure logic (economy, fog grid, cure transitions) should be unit-testable in Node without a browser.
6. **Pick one HUD stack.** Either delete the React path or make it the real HUD — do not carry both.

---

## 3. Staged roadmap

### Stage 0 — Alpha hardening (no architecture change)
Low-risk cleanups that also satisfy `aiPlan.md` P3 items.

- Gate all logging behind `debugLog`; default `enableDebugLogs = false` for a clean console (`aiPlan.md` P3.6).
- Remove the two test cubes (`TestCubeOrange`, `TestCubeBlue`) from `main.js`.
- Retire `startTestSpawn()`'s 5-second spawn for alpha; keep the dev `9` key (`aiPlan.md` P3.4).
- Add a `favicon.ico` (or a `<link rel="icon" href="data:,">`) to kill the 404 (`aiPlan.md` P3.5).
- Replace the leftover literal `{interaction_text}` placeholder in `index.php`.

### Stage 1 — Tooling & hygiene
Make the codebase measurable and safe to change.

- **Introduce a build step (Vite).** Bundle the ES-module graph, enable minification and hashed asset filenames, and give the TypeScript/React files a real home. This removes the `?v=<?php echo time(); ?>` cache-buster hack and the "classic scripts share one global scope" foot-gun.
- **Self-host Three.js** at a single pinned version and drop the mismatched CDN pair (`three r128` + `PointerLockControls 0.128.0`). Add Subresource Integrity if any CDN remains. See [`blue-team.md`](blue-team.md) §Supply chain.
- **Add ESLint + a type-check pass.** Even for JS, `// @ts-check` + JSDoc catches the duplicate-global and typo classes of bug.
- **Add CI** (GitHub Actions): lint, type-check, and a headless Puppeteer smoke test that boots `index.php` and asserts zero uncaught console errors (automates `aiPlan.md` P0.1).

### Stage 2 — Core architecture
Fix the scaling and correctness liabilities.

- **Entity registries by type.** Replace the single `window.objects` scan with typed collections (`grays`, `boulders`, `trees`, `resources`, `darkGrey`, `bots`, `blueprints`, `solids`). Systems iterate only what they need.
- **Spatial partitioning.** A uniform grid or simple bucket index for neighbor queries turns `updateTheGray`'s O(n²) separation/avoidance and the player's per-object AABB test into near-O(n).
- **Scratch objects / pooling.** Preallocate reusable `Vector3`/`Box3`/`Raycaster` instances; pool particles, hit-points, and Dark-Grey meshes instead of create/dispose churn.
- **Central config module.** Move balance constants (speeds, ranges, costs, timers) into one `config.js`/`balance.ts` so tuning is one file, not twelve.
- **Cure state machine.** Model the 5 steps as an explicit finite state machine (`IMPEDE → SUBDUE → ADMINISTER → PROTECT → EVAC`, plus `FAILED`/`DEAD`) with one owner, replacing the boolean soup. This directly de-risks `aiPlan.md` A8/A9.
- **Fix incremental work.** Fog reveal recomputes and repaints all 1,600 tiles every frame; only recompute on cell-boundary crossings or building completion.

### Stage 3 — Systems & content depth
Once the core is solid, deepen the game (see [`AiIdeas.md`](AiIdeas.md)).

- Event bus for cross-system messages (`hostHealed`, `buildingCompleted`, `playerDamaged`) to decouple HUD, audio, and stats from gameplay code.
- Save/resume via `localStorage` (sandbox stats, inventory, buildings, cured hosts).
- Input abstraction: rebindable keys, gamepad, and a touch scheme (the design doc already imagines "tap").
- Audio system (currently entirely absent) — the single biggest "game feel" gap.
- World bounds / larger streamed world instead of a fixed 1,000×1,000 plane the player can walk off.

### Stage 4 — Beta polish
- Difficulty curve, onboarding/tutorial for the non-obvious cure flow, settings menu, and accessibility pass (colorblind-safe cues, remappable controls, subtitles for future audio).

---

## 4. Focused refactor recipes

### 4.1 Unify the HUD
Decide now. Recommended: keep the lightweight vanilla `hud.js` for alpha, and either delete `index.tsx`/`components/` or, in Stage 1, migrate the HUD to React behind the Vite build and delete `hud.js`. Do **not** ship both. Today `index.tsx` targets `#react-hud-root`, which does not exist in `index.php`, so it would only log an error if ever loaded.

### 4.2 Kill the mega-array
Introduce an `Entities` module:

```
Entities.add(mesh, type)      // pushes to typed list(s) and window.objects (transitional)
Entities.remove(mesh)         // removes from all lists + disposes
Entities.byType('the_gray')   // returns the typed list
Entities.near(pos, radius)    // spatial query via grid buckets
```

Migrate one consumer at a time (`thegray.js` first — biggest win), keeping `window.objects` as a compatibility view until all readers move over.

### 4.3 Make the frame cheap
- Preallocate module-level scratch vectors in `player.js`, `thegray.js`, `curing_mechanic.js`, `darkgrey.js`.
- Reuse a single `Raycaster` per system instead of `new THREE.Raycaster()` per frame (curing and aim checks create them each call).
- Recompute Box3s only for objects that moved; static trees/boulders/buildings can cache their world AABB.

### 4.4 Tame third-party risk
Vendor Three.js locally, pin the version, and add an offline check so a CDN outage doesn't produce a black screen. `main.js` already guards `typeof THREE === 'undefined'`; extend that to a user-facing "assets failed to load" retry.

---

## 5. Success metrics

- **Boot:** zero uncaught console errors on hard refresh (CI-enforced).
- **Performance:** stable 60 fps with 5 Grays + 3 full Dark-Grey waves (36 swarm units) on a mid-range laptop; no GC saw-tooth in the frame-time graph.
- **Maintainability:** balance tuning touches one file; adding an entity type does not require editing every system.
- **Testability:** economy, fog grid, and cure transitions covered by Node unit tests.
- **Content:** the full alpha smoke script (`aiPlan.md` §6) passes end-to-end, then the beta additions in §3 land without regressing it.

---

## 6. Sequencing summary

| Stage | Theme | Gate to start |
|-------|-------|---------------|
| 0 | Alpha hardening / cleanup | anytime (helps alpha) |
| 1 | Build tooling, self-host deps, lint, CI | after alpha loop is playable |
| 2 | Entity registries, spatial index, config, cure FSM | after Stage 1 gives a safety net |
| 3 | Event bus, save/load, input, audio, world bounds | after Stage 2 stabilizes the core |
| 4 | Difficulty, onboarding, settings, accessibility | pre-beta |

Keep each stage shippable. If a stage destabilizes the alpha smoke script, stop and stabilize before continuing.
