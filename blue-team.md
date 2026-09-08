# Antidote — Blue Team

**Purpose:** Defensive playbook — the protections, guardrails, and practices that keep Antidote stable, performant, secure, and maintainable as it grows.
**Companion:** Each section answers a theme in [`red-team.md`](red-team.md). Sequencing lives in [`project-revamp.md`](project-revamp.md).

**Priority legend:** 🟥 Do before beta · 🟧 Do during Stage 1–2 · 🟩 Ongoing / when the trigger arrives.

---

## 1. Immediate guardrails (cheap, high-value, safe during alpha)

These reduce risk without architectural change and mostly satisfy `aiPlan.md` P3.

- 🟥 **Silence production logs.** Default `enableDebugLogs = false`; route every `console.log` through `debugLog` so the console shows only real errors (backtick key already toggles it). *(red-team §3)*
- 🟧 **Strip dev artifacts for the shipped entry.** Remove `TestCubeOrange`/`TestCubeBlue`; gate `startTestSpawn()` behind the debug flag; keep the dev `9` key. *(red-team §3)*
- 🟧 **Throttle frame-error logging.** In the animate `catch`, log the first error, then rate-limit (e.g. once/second) and after N consecutive errors show the existing load-error overlay instead of spamming. This turns an infinite console flood into a diagnosable failure. *(red-team §3)*
- 🟩 **Add a favicon and remove the `{interaction_text}` placeholder** in `index.php`. *(red-team §3)*
- 🟧 **Clamp effective movement per frame.** Cap displacement to a fraction of the smallest collider so sprint can't tunnel; or fall back to substepping the move. *(red-team §1.3)*
- 🟧 **Add world bounds.** Clamp the player (and units) to the playable region, or add a soft wall / kill-plane + respawn. *(red-team §1.4)*

---

## 2. Performance protections

- 🟧 **Typed entity registries.** Replace blanket `window.objects` scans with per-type lists so each system iterates only relevant entities. Keep `window.objects` as a transitional compatibility view. *(red-team §1.2)*
- 🟧 **Spatial index.** A uniform grid / bucket structure for neighbor queries collapses `updateTheGray`'s O(n²) and the player's per-object AABB test toward O(n). *(red-team §1.1)*
- 🟧 **Scratch objects & pooling.** Preallocate module-level `Vector3`/`Box3`/`Raycaster` and reuse them; pool particles, hit-points, and Dark-Grey meshes to end create/dispose churn. Cache static world AABBs (trees/boulders/buildings don't move). *(red-team §2)*
- 🟧 **Event-driven fog.** Recompute reveal + repaint tiles only on cell-boundary crossings or building completion, not every frame. *(red-team §2)*
- 🟩 **Perf budget in dev.** Add a toggleable `stats.js` meter and a frame-time assertion in the smoke test so regressions are visible. *(red-team §2, §7)*

---

## 3. Correctness & maintainability protections

- 🟧 **Cure finite state machine.** One owner, one enum (`IMPEDE → SUBDUE → ADMINISTER → PROTECT → EVAC`, plus `FAILED`/`DEAD`), explicit transitions, no sentinel values like `stunTimer = 9999`. Makes `aiPlan.md` A8/A9 verifiable and unit-testable. *(red-team §1.5)*
- 🟧 **Attach behavior at creation.** Fold `takeDamage` assignment into `createTheGray`/`addRandomHitPoint` and delete the self-monkeypatch. *(red-team §1.6)*
- 🟧 **Central balance config.** Single `config`/`balance` module for speeds, ranges, costs, timers, and damage. Fix the wrong divisor in hit-point color math while consolidating (`/HIT_POINT_HEALTH`, not `/3`). *(red-team §1.7, §6.2)*
- 🟩 **Shared harvest/pickup helpers.** Bots and the player call the same resource routines; fix `_findHomeBuilding` to choose the nearest and rebalance bot harvest so it doesn't one-shot trees. *(red-team §1.8, §1.9)*
- 🟩 **One HUD.** Delete the unwired React HUD or, in Stage 1, make it the real HUD behind the build and delete `hud.js`. Never carry both. *(red-team §4)*

---

## 4. Tooling, tests & CI (the safety net)

- 🟧 **Build step (Vite).** Bundle the module graph, minify, and emit content-hashed filenames — retiring the `?v=<?php echo time(); ?>` cache-buster and the "classic scripts share global scope" hazard. Gives the TS/React path a real runtime. *(red-team §4, §5)*
- 🟧 **Lint + type-check.** ESLint plus `// @ts-check`/JSDoc (or full TS) to catch duplicate globals, typos, and wrong constants before runtime. *(red-team §7)*
- 🟥 **Unit tests for pure logic.** Fog grid (`worldToGrid`/`isPositionRevealed`), blueprint economy (`depositResources`/`checkCompletion`), and the new cure FSM run headless in Node/Vitest. *(red-team §7)*
- 🟥 **CI boot gate.** GitHub Actions runs lint + type-check + unit tests, then a headless Puppeteer smoke test that loads `index.php` and **fails on any uncaught console error** — automating `aiPlan.md` P0.1 so boot regressions can't merge. *(red-team §7)*
- 🟩 **Deterministic RNG option.** A seedable PRNG (behind a flag) makes spawns/hit-points reproducible for tests and bug repro. *(red-team §7)*

---

## 5. Supply-chain & client hardening

- 🟥 **Self-host Three.js** at one pinned version; drop the two-CDN, version-mismatched setup. *(red-team §5)*
- 🟧 **Subresource Integrity** on any remaining third-party `<script>`/`<link>` (integrity + crossorigin). *(red-team §5)*
- 🟧 **Graceful asset-failure path.** Extend the existing `typeof THREE === 'undefined'` guard into a user-facing "assets failed to load — retry" overlay so a CDN blip isn't a silent black screen. *(red-team §5)*
- 🟩 **Content Security Policy.** Once assets are self-hosted, ship a strict CSP header (default-src 'self', explicit allowances) to blunt XSS and rogue injection. *(red-team §5, §6.1)*
- 🟩 **Planned engine-upgrade path.** Budget a Three.js upgrade off r128 before the API gap grows; do it after the build step exists so it's testable. *(red-team §5)*

---

## 6. Backend security (activate the moment `index.php` does more than echo `time()`)

These are gates, not suggestions — do not ship a write endpoint without them. *(red-team §6.1)*

- 🟥 **Prepared statements / parameterized queries only.** Never concatenate user input into SQL.
- 🟥 **Output escaping.** Escape every server-emitted value on the way into HTML/attributes/JS contexts. Audit the current `time()` echo pattern before reusing it for anything user-influenced.
- 🟥 **Server-authoritative state + validation.** Treat the client as hostile: validate and recompute any submitted score/progress server-side. Assume the client is modified. Essential before any leaderboard, persistence, or multiplayer.
- 🟧 **CSRF tokens, authentication, rate limiting** on all write endpoints; sessions over HTTPS with secure, `HttpOnly`, `SameSite` cookies.
- 🟧 **Secrets via environment/secret store**, never committed; least-privilege DB credentials.
- 🟩 **Input size/type limits & structured logging** for abuse detection.

---

## 7. Platform, UX & resilience

- 🟧 **Input abstraction layer.** Centralize bindings; add gamepad and a touch scheme (design doc mentions tap); make keys rebindable. *(red-team §6.3)*
- 🟩 **WebGL context-loss handling.** Listen for `webglcontextlost`/`webglcontextrestored`, pause the loop, and rebuild GPU resources on restore. *(red-team §6.3)*
- 🟩 **Save/resume.** Persist sandbox stats, inventory, buildings, and cured hosts to `localStorage`; replace blind `location.reload()` restart with a clean state reset. *(red-team §6.3)*
- 🟩 **Accessibility.** Pair every color-coded state with a shape/icon/label, honor reduced-motion, provide remappable controls and a subtitles path for future audio. *(red-team §6.3)*

---

## 8. Protection-to-risk matrix

| red-team risk | Primary protection(s) | Priority |
|---------------|------------------------|----------|
| O(n²) AI + full-array scans (§1.1–1.2) | Typed registries + spatial index + pooling (§2) | 🟧 |
| Cure boolean soup (§1.5) | Cure FSM + unit tests (§3, §4) | 🟧/🟥 |
| CDN SPOF, no SRI, old pin (§5) | Self-host + SRI + CSP + upgrade path (§5) | 🟥/🟧 |
| Future backend injection/XSS/CSRF/cheat (§6.1) | Backend security gates (§6) | 🟥 |
| Dev artifacts + log spam (§3) | Immediate guardrails (§1) | 🟥/🟧 |
| No tests / boot regressions (§7) | Unit tests + CI boot gate (§4) | 🟥 |
| Tunneling / no world bounds (§1.3–1.4) | Move clamp + bounds (§1) | 🟧 |
| Dead React HUD (§4) | Pick one HUD (§3) | 🟩 |

**Definition of "protected":** every 🔴 in `red-team.md` has a landed mitigation, CI blocks boot regressions, the hot path allocates nothing per frame, and no write endpoint ships without the §6 gates.
