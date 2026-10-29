# Antidote — AI Build Plan

**Purpose:** Single source of truth for agents automating work on this repo until **Alpha Polished** is reached.  
**Companion:** [`aiPlanLoop.md`](aiPlanLoop.md) — the repeatable session workflow.  
**Long-term vision:** [`projectScope.txt`](projectScope.txt) (full game; do **not** implement all of it in alpha).

---

## 1. Alpha definition of done

The alpha is **polished** when all items below pass manual smoke tests with **zero red console errors** on a hard-refreshed page.

| # | Criterion | Status |
|---|-----------|--------|
| A1 | Game loads via `index.php`; scene visible (not black); HUD updates | 🟡 partial |
| A2 | FPS movement (WASD, sprint, jump) smooth — no ground jitter while strafing | 🟢 fixed |
| A3 | Gather wood (trees → pile → click collect) and stone (boulders); HUD reflects inventory | 🟡 partial |
| A4 | Map mode (`M`): build preview (`B` → radial menu); place blueprint; deposit with `E` in range | 🟡 partial |
| A5 | Main base completes; player heals inside base radius; stats track buildings | 🟡 unverified |
| A6 | Collector buildings spawn bots that gather and deposit wood/stone | 🔴 unverified |
| A7 | The-Gray spawns (15 min interval + dev `9` key); contact damages player | 🟡 partial |
| A8 | Full 5-step cure on one Gray: Impede → Subdue → Administer → Protect → Evac | 🔴 unverified |
| A9 | 2nd failed cure attempt kills host (not game over); player death shows death screen + restart | 🔴 unverified |
| A10 | Fog of war lazy-inits on first map view; cleared cells allow unit select/move | 🔴 unverified |
| A11 | Interaction info modal shows for in-range targets (tree, boulder, wood, blueprint) | 🟢 done |
| A12 | No duplicate global `const`/`let` across classic scripts (see §4) | 🟢 done |

**Legend:** 🟢 done · 🟡 implemented but needs verification/fix · 🔴 not verified or broken

Update status emoji in this table after each agent session (see `aiPlanLoop.md` §5).

---

## 2. Alpha scope (in) vs out

### In scope (build & polish)

- **Sandbox** endless run; **lose condition = player death only**
- **Wood / stone** economy; manual gather + collector bots
- **Base building** from map mode; main base + collector structures
- **5-step cure:** Impede → Subdue → Administer → **Protect** (stay near host, Dark-Grey swarms) → **Evac** (lead to base, host → 100% health)
- **Cure failure:** 2nd failed attempt = **dead host**, not game over
- **Fog of war** + map unit control when fog cleared
- **The-Gray** AI + spawner; **Dark-Grey** swarms during Protect
- **Vanilla HUD** (`hud.js`) — no React HUD in production entry (`index.php`)
- **Local PHP** hosting only; Three.js from CDN

### Out of scope (do not implement until post-alpha)

- 12 regions, conquest phase, invader waves
- Leadership system, cured-human NPCs as leaders
- Food / antidote component economy beyond cure minigame
- Sound, multiplayer, database persistence
- React entry (`index.tsx`, `components/`) — experimental; **do not wire into `index.php`** unless user explicitly asks
- Full RTS army, alliances, 3rd-person camera

---

## 3. Architecture quick reference

### Entry & run

```
URL: http://localhost:11011/Dev/ANTIDOTE%20game%20project/antidote2/index.php
Hard refresh after JS changes: Ctrl+Shift+R
```

### Script load order (`index.php`)

Classic scripts share **one global lexical scope** for top-level `const`/`let`. Never duplicate names across files.

```
game_state.js → darkgrey.js → fog_of_war.js → collector_bots.js → unit_control.js
→ interaction_modal.js (IIFE) → thegray.js → thegray-spawner.js → player.js
→ curing_mechanic.js → main.js (ES module) → hud.js
```

`main.js` imports (module scope, safe): `collisions.js`, `Level1.js`, `trees.js`, `boulders.js`, `base_building.js`, `build_manager.js`, `radial_menu.js` — exposed on `window.*`.

### Orchestration

| Layer | File | Role |
|-------|------|------|
| Orchestrator | `main.js` | Scene, cameras, animate loop, map toggle, blueprint preview |
| Player | `player.js` | Movement, shooting, gather, deposit, input |
| Cure | `curing_mechanic.js` | Steps 2–5 UI/logic |
| Gray AI | `thegray.js` | Step 1 hit points, AI, contact damage |
| Enemies | `darkgrey.js` | Protect-phase swarms |
| Build | `base_building.js`, `blueprints_config.js`, `build_manager.js`, `radial_menu.js` | Placement, deposits, completion |
| World | `Level1.js`, `trees.js`, `boulders.js` | Procedural map |
| Meta | `game_state.js`, `hud.js` | Health, death, stats HUD |
| UX | `interaction_modal.js` | Context modal near crosshair |
| Map | `fog_of_war.js`, `unit_control.js` | Fog + unit orders |

### Key globals (integration contract)

| Global | Set by | Used for |
|--------|--------|----------|
| `window.controls`, `window.camera`, `window.objects`, `window.scene` | `main.js` / `player.js` | Raycasts, movement |
| `window.playerInventory` | `player.js` | `{ wood, stone }` |
| `window.INTERACTION_RANGE`, `window.GATHER_RANGE` | `interaction_modal.js` | Range checks |
| `window.InteractionModal` | `interaction_modal.js` | Target resolve, modal |
| `window.initPlayer`, `window.updatePlayer` | `player.js` | Lifecycle |
| `window.updateCuringMechanic`, `window.requestPatchApplicationStart` | `curing_mechanic.js` | Cure flow |
| `window.createTheGray`, `window.updateTheGray` | `thegray.js` | Enemies |
| `window.toggleMapView` | `main.js` | Map mode |
| `window.BaseBuilding`, `window.BuildManager`, `window.RadialMenu` | modules via `main.js` | Building |
| `window.damagePlayer`, `window.isPlayerDead`, `window.updateBaseHealing` | `game_state.js` | Health/death |

### Controls

| Input | Action |
|-------|--------|
| Click | Lock pointer (FPS) |
| WASD | Move |
| Shift | Sprint |
| Space | Jump |
| Left click | Shoot / chop / mine / collect (in range) |
| Right click hold | Antidote minigame on patch |
| E | Deposit blueprint resources (reticle on blueprint) / hold to subdue |
| M | Toggle map / FPS |
| B (map only) | Radial build menu |
| 9 (debug) | Spawn The-Gray nearby |

---

## 4. Known pitfalls (read before editing)

1. **Duplicate top-level bindings** — Classic scripts in `index.php` share scope. `interaction_modal.js` is wrapped in an IIFE; new classic files should use IIFEs or unique names. Constants like `INTERACTION_RANGE` live on `window` from `interaction_modal.js` only.
2. **Functions nested inside `initPlayer`** — Must be top-level if called from other top-level functions (see `pickupResource` bug).
3. **`setPreviewType` every frame** — Must be idempotent; recreating mesh each frame caused black screen.
4. **Fog init at startup** — Lazy-init on first map view only (`ensureFogOfWar`).
5. **Ground / `playerOnGround`** — Do not reset grounded state before ground test; use `min.y <= 0` when falling.
6. **CDN warnings** — Edge “Tracking Prevention blocked storage” for Three.js CDN is harmless.
7. **Delta spikes** — `main.js` clamps `clock.getDelta()` to `0.05`; keep cap if touching animate loop.

---

## 5. Priority backlog

Work top to bottom. Mark items `[x]` when smoke test passes.

### P0 — Boot & core loop (blockers)

- [x] P0.1 Console clean on load: no `SyntaxError`, no `initPlayer not found`, spawner has `controls` + `createTheGray`
- [ ] P0.2 Wood loop: chop tree → pile spawns → modal → click collect → HUD wood increases
- [ ] P0.3 Stone loop: mine boulder in range → stone in HUD
- [ ] P0.4 Player death: Gray contact → health 0 → death screen → Restart reloads

### P1 — Build & economy

- [ ] P1.1 Map mode: `M` → `B` → select Base → preview follows cursor (green/red validity)
- [ ] P1.2 Deposit wood/stone with `E` on blueprint in range; building completes
- [ ] P1.3 Main base registers; standing in heal radius restores player HP
- [ ] P1.4 Wood/stone collector completes → bots spawn → resources increase over time

### P2 — Cure pipeline (one full success path)

- [ ] P2.1 Impede: shoot all hit points → Gray stunned
- [ ] P2.2 Subdue: hold `E` near patch → progress bar completes
- [ ] P2.3 Administer: right-click minigame → sweet spot held → success
- [ ] P2.4 Protect: stay in radius ~45s; Dark-Grey swarms spawn; leaving too long fails step
- [ ] P2.5 Evac: lead Gray to main base; host healed; `hostsHealed` increments
- [ ] P2.6 Second cure failure on same host → host dies; sandbox continues

### P3 — Map & polish

- [ ] P3.1 Fog reveals around player/buildings; hidden areas opaque on map
- [ ] P3.2 Select unit on cleared map cell; click ground to move
- [ ] P3.3 Cure phase label + protect bar readable; modal hides during cure UI
- [ ] P3.4 Dev spawner: restore 15 min interval for alpha (disable 5s test spawn if still present)
- [ ] P3.5 Add `favicon.ico` or suppress 404 (cosmetic)
- [ ] P3.6 Remove or gate verbose `console.log` spam for alpha
- [ ] P3.7 Update `projectScope.txt` checkboxes OR add note pointing to this file

### P4 — Post-alpha (only if user asks)

- React HUD migration, sound, balance pass, dat.GUI debug panel, PHP persistence

---

## 6. Smoke test script (manual)

Run after every meaningful change. Record pass/fail in session notes.

1. Hard refresh `index.php` — scene + HUD visible within 3s
2. Click to lock — position debug updates when moving
3. Strafe A/D 5s on open ground — no vertical jitter
4. Chop one tree, collect wood pile — inventory +1
5. Mine one boulder — stone increases
6. `M` → `B` → Base preview visible moving mouse
7. (If Gray present) Shoot hit points → subdue prompt appears
8. Console: **zero uncaught errors**

---

## 7. File touch guide

| Task | Likely files |
|------|----------------|
| Movement / gather | `player.js`, `interaction_modal.js` |
| Cure steps | `curing_mechanic.js`, `thegray.js`, `darkgrey.js` |
| Building | `base_building.js`, `main.js`, `blueprints_config.js`, `radial_menu.js` |
| HUD / death | `hud.js`, `game_state.js`, `index.php` |
| Map / fog / units | `fog_of_war.js`, `unit_control.js`, `main.js` |
| Bots | `collector_bots.js`, `base_building.js` |
| Spawner | `thegray-spawner.js`, `main.js` |
| New classic script | wrap in IIFE; add to `index.php` in correct order |

---

## 8. Session log (agents append)

| Date | Agent focus | Result |
|------|-------------|--------|
| 2026-06-04 | Initial aiPlan | Created aiPlan.md + aiPlanLoop.md |
| | Fixed duplicate globals, pickupResource, strafe jitter | A2, A11 improved |
| 2026-10-29 | P0.1 boot gate | 🟢 PASS: `node scripts/antidote-boot-test.mjs` — canvas, initPlayer, controls, createTheGray, updateSpawner; classic script duplicate scan clean |

---

*When alpha criteria A1–A12 are all 🟢 and P0–P3 checkboxes are `[x]`, declare **Alpha Polished** in the session log and stop feature work unless the user expands scope.*
