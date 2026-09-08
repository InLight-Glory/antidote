# Antidote — Red Team

**Purpose:** Adversarial review of what is broken, fragile, or likely to bite us — both problems present in the code today and foreseeable ones as the project grows.
**Companion:** [`blue-team.md`](blue-team.md) pairs each theme with a concrete protection. See also [`project-revamp.md`](project-revamp.md).

**Severity legend:** 🔴 High (breaks the game or blocks scaling) · 🟠 Medium (degrades quality/velocity) · 🟡 Low (cosmetic/hygiene).

---

## 1. Current bugs & correctness risks

### 1.1 🔴 The-Gray AI is O(n²) every frame
`updateTheGray` (in `thegray.js`) loops every object and, for each Gray, loops **all** objects again for separation/avoidance, allocating `THREE.Vector3`s inside the inner loop. With the spawner cap at 5 Grays it's tolerable, but Dark-Grey waves add up to 36 more entities during Protect, and the cost scales quadratically. Frame spikes and GC saw-tooth are the visible symptom (partly masked by the `delta` clamp to `0.05` in `main.js`).

### 1.2 🔴 One global entity array scanned by everyone
`window.objects` holds trees, boulders, resources, Grays, Dark-Grey, blueprints, bots, and test cubes. Player collision (`playerIntersectsSolidAt`), curing (`updateCuringMechanic`), collector bots, and the spawner all scan the whole array each frame. Every new entity type makes every system slower and increases the chance of a mis-typed `userData` check hitting the wrong object.

### 1.3 🟠 Fast movement can tunnel through colliders
`PLAYER_SPEED = 8` with `SPRINT_MULTIPLIER = 3` yields 24 units/s. Collision is discrete AABB resolution done after the move, with no swept test. At sprint speed against thin/small colliders, the player can pass through. (The comment "moves 29 times faster" is also simply wrong — it's 3×.)

### 1.4 🟠 No world bounds — walk off the map into the void
The ground is a finite `1000×1000` plane. The grounding fix only triggers when the player AABB reaches `y <= 0`, which is the plane's level everywhere, but nothing stops the player from walking past the plane's edge; beyond it there is no ground reference and the world is empty. There is no boundary, kill-plane, or respawn.

### 1.5 🟠 Cure pipeline is a boolean state soup
The cure flow is driven by many independent flags on each Gray: `isStunned`, `stunTimer`, `isSubdued`, `isBeingSubdued`, `isPatchPlaced`, `isProtecting`, `isCuredHost`, `isWorker`, `cureAttemptCount`. They are set/cleared across `thegray.js` and `curing_mechanic.js`. On patch completion `stunTimer` is set to `9999` as a sentinel. Any missed transition leaves a Gray in an impossible state (e.g. `isPatchPlaced` true but `isStunned` cleared). This is exactly why `aiPlan.md` marks A8/A9 (full cure, failed-cure death) 🔴 unverified.

### 1.6 🟠 Monkeypatching own functions is brittle
`thegray.js` reassigns its own declarations: `_originalCreateTheGray = createTheGray; createTheGray = function(...) {...}` (same for `addRandomHitPoint`) to bolt on `takeDamage` handlers. If the file were ever evaluated twice, or if bundling changes evaluation order, this double-wraps or breaks. The handler attachment belongs inside the creation function.

### 1.7 🟡 Hit-point damage color math is wrong
`hitPointTakeDamage` computes `percent = this.userData.health / 3` but hit-point health is `75` (`HIT_POINT_HEALTH`). The intended fade never renders correctly (percent is effectively always clamped high). Cosmetic, but a symptom of magic numbers.

### 1.8 🟡 Collector bots are unbalanced and pick the wrong "home"
`_findHomeBuilding` iterates and keeps the **last** matching building rather than the nearest. A bot chopping a tree calls `damageTree(tree, 999)`, destroying a whole tree in one tick and adding a flat `+5` cargo — trivializing the wood economy.

### 1.9 🟡 Duplicated pickup/harvest logic
Collector bots reimplement wood-pile removal instead of reusing `pickupResource` semantics, so any future change (e.g. drop tables, partial stacks) must be made in two places.

---

## 2. Performance & memory

- 🟠 **Per-frame allocations in hot loops.** `curing_mechanic.js` creates `new THREE.Raycaster()` every frame while aiming; `player.js` builds a `Box3` per object per frame (and again in the vertical pass); the day/night cycle `.clone()`s several colors every frame. Individually cheap, collectively a steady GC drip.
- 🟠 **Fog recomputed wholesale each frame.** `updateFogOfWar` calls `revealAt` for the player *and every completed building* every frame, and `_refreshFogVisuals` then walks all `40×40 = 1600` tiles. It should only run when the player crosses a cell boundary or a building completes.
- 🟡 **No render/entity budget.** Nothing caps particle count growth paths or warns when frame time blows past budget.

---

## 3. Dev artifacts shipping in "production"

- 🟠 **Verbose logging on by default.** `enableDebugLogs = true`; many call sites use `console.log` directly (right-click handling in `player.js`, most of `curing_mechanic.js`) and bypass the `debugLog` gate entirely. Console spam hides real errors (`aiPlan.md` P3.6).
- 🟡 **Test cubes in the scene.** `TestCubeOrange` and `TestCubeBlue` are always added in `main.js`.
- 🟡 **5-second test spawn.** `startTestSpawn()` is called unconditionally in `init()` (`aiPlan.md` P3.4 wants it gone for alpha).
- 🟡 **Leftover template text.** `index.php` still contains the literal `{interaction_text}` placeholder and has no `favicon.ico` (guaranteed 404).
- 🟠 **Infinite error spam risk.** The animate loop catches and `console.error`s per frame; a persistent frame error logs every frame forever with no throttle or circuit-breaker.

---

## 4. Dead / divergent code

- 🟠 **Two HUDs, one wired.** `hud.js` builds the live HUD; `index.tsx` + `components/PlayerHUD.tsx` build a second, unwired React HUD targeting `#react-hud-root` (absent from `index.php`). It cannot even run — there is no bundler, and browsers can't execute the JSX/TS imports directly. It's dead weight that will drift from the real HUD.
- 🟡 **No `package.json` / build tooling** despite `.tsx` files existing. The TypeScript path is aspirational only.

---

## 5. Third-party & supply chain

- 🔴 **CDN is a single point of failure.** Three.js `r128` and `PointerLockControls 0.128.0` load from two different CDNs. No network → black screen. The two are also version-mismatched (r128 vs 0.128.0), which is currently compatible but not guaranteed across upgrades.
- 🟠 **No Subresource Integrity (SRI).** The CDN `<script>` tags have no integrity hashes; a compromised or hijacked CDN could inject arbitrary JS into every session.
- 🟠 **Pinned to an ancient engine.** r128 (2021) forgoes years of Three.js fixes and perf work; upgrading later will be a larger, riskier jump the longer it waits.

---

## 6. Foreseeable risks (as the project grows)

### 6.1 The future PHP/DB backend (design doc §7, `aiPlan.md` P4)
Today `index.php` only echoes `time()`. The moment it accepts input or persists data, the classic web risks apply and none are mitigated yet:

- 🔴 **SQL injection** if queries are built by string concatenation instead of prepared statements.
- 🔴 **XSS** if any server value (scores, names, chat) is echoed into HTML without escaping — note the current cache-buster echoes directly into attributes.
- 🟠 **No CSRF protection, auth, or rate limiting** for any future write endpoint.
- 🔴 **Client-authoritative state.** All game state lives client-side. If scores/progress are ever submitted to a server (or multiplayer is added), a trivially modified client can forge anything. Any competitive or persistent feature needs server-side validation / anti-cheat.

### 6.2 Scaling content
- 🟠 As entity types multiply (leaders, invaders, more buildings), the mega-array + boolean-flag patterns compound. Without registries and a state machine, each addition is a regression risk.
- 🟠 **Balance drift.** Constants duplicated across files (ranges, damage, costs) will silently diverge; there is no single balance source.

### 6.3 Platform & UX
- 🟠 **Desktop-only input.** Pointer-lock + keyboard only; no touch/gamepad, despite the design mentioning tap. Mobile users get nothing.
- 🟡 **No WebGL context-loss handling** (`webglcontextlost`/`restored`); a GPU reset kills the session.
- 🟡 **No accessibility.** Color-coded cure states (cyan/yellow/green) with no secondary cue; no remappable keys; no subtitles path for future audio.
- 🟡 **No save/resume.** `restartGame()` is a full `location.reload()`; all progress is lost on death or refresh.

---

## 7. Testing gaps

- 🔴 **No automated tests at all.** Verification is entirely manual (`aiPlanLoop.md`). Boot regressions (P0.1) recur because nothing guards them.
- 🟠 **Pure logic is untested but testable.** The fog grid (`worldToGrid`/`isPositionRevealed`), blueprint economy (`depositResources`/`checkCompletion`), and cure transitions are deterministic and could run in Node today.
- 🟠 **No lint or type-check** to catch the duplicate-global / typo / wrong-magic-number classes before runtime.

---

## 8. Top risks, ranked

| # | Risk | Sev | Where |
|---|------|-----|-------|
| 1 | O(n²) AI + full-array scans won't scale | 🔴 | `thegray.js`, all per-frame systems |
| 2 | Cure boolean-soup → unverifiable A8/A9 | 🟠 | `curing_mechanic.js`, `thegray.js` |
| 3 | CDN SPOF + no SRI + ancient pin | 🔴 | `index.php` script tags |
| 4 | Future backend has no injection/XSS/CSRF/anti-cheat story | 🔴 | `index.php` (future) |
| 5 | Dev artifacts + log spam in production entry | 🟠 | `main.js`, `thegray-spawner.js`, logging |
| 6 | No automated tests / CI boot gate | 🔴 | repo-wide |
| 7 | Tunneling at sprint speed; no world bounds | 🟠 | `player.js` |
| 8 | Dead React HUD diverging from live HUD | 🟠 | `index.tsx`, `components/` |

Each item maps to a mitigation in [`blue-team.md`](blue-team.md).
