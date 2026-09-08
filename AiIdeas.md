# Antidote — AI Ideas: Uniqueness, Replayability & Game Feel

**Purpose:** A creative-direction backlog of ideas to make Antidote *distinct*, *replayable*, and *satisfying to touch*. This is a menu, not a mandate — pick what fits after the alpha loop in [`aiPlan.md`](aiPlan.md) is solid. Nothing here overrides alpha scope.
**Companions:** [`projectScope.txt`](projectScope.txt) (long-term vision) · [`project-revamp.md`](project-revamp.md) (how to build the foundation these ideas need).

The core fantasy is already unusual: **you don't just kill enemies — you *cure* them, at real risk, and they become people you can lose.** Every idea below leans into that hook: the tension between the fast, safe *kill* and the slow, costly, meaningful *cure*.

---

## 1. The pillar: make "cure vs. kill" the whole game

The 5-step cure (Impede → Subdue → Administer → Protect → Evac) is Antidote's signature. Everything should orbit it.

- **The Kill Ledger.** Killing a Gray is instant and safe but spawns Dark-Grey swarms (already in design) *and* leaves a permanent mark — a growing "corruption" meter on the world. Curing lowers it. The world visibly rots (desaturation, spreading dark ground) the more you kill, so the "easy" choice has a slow cost you can *see*.
- **Named hosts.** Every Gray is a former person with a generated name, a one-line history, and a portrait glyph. Curing "Mara, botanist" lands differently than curing "enemy #7". Losing a host on a failed second attempt should sting.
- **Attachment via utility.** Cured hosts become workers/leaders with real, named perks. Losing one you'd invested in is a genuine setback, not just a stat tick — this is the emotional engine of replay.

---

## 2. Replayability systems

### 2.1 Procedural regions & seeds
Build on the design's 12-region ambition, but make each **run** a fresh seed: region layout, resource richness, Gray density, and biome hazards vary. A shareable seed code lets players compete on the same world. (Requires the seedable RNG in [`blue-team.md`](blue-team.md) §4.)

### 2.2 Roguelike run modifiers ("Strains")
Each run, the parasite manifests as a random **Strain** with 1–2 mutators, e.g.:
- *Twitch Strain* — Grays flee when impeded; harder to pin the hit-points.
- *Brittle Strain* — antidote sweet-spot is narrower but Protect is shorter.
- *Hive Strain* — killing a Gray spawns double Dark-Grey but curing heals nearby infected slightly.
- *Nocturnal Strain* — Grays are docile by day, aggressive at night (ties to the existing day/night cycle in `main.js`).

Mutators recombine → high replay variety from a small content set.

### 2.3 Meta-progression between runs
A persistent "field journal": each cured archetype unlocks lore, a passive, or a new tool. Death isn't wasted — you bank knowledge. Keeps the sandbox's "lose only on death" loop rewarding across sessions.

### 2.4 Dynamic difficulty via *noise*
Aggression scales with how much **attention** you draw, not a timer. Shooting, failed Administer minigames (design says it "alerts enemies"), and completed buildings raise a noise level that pulls more Grays and shortens spawn intervals. Stealth-curing a whole region silently is a viable, expressive strategy — as is going loud.

### 2.5 Optional objectives & mutator relics
Per-region optional goals ("cure 3 hosts without firing a shot", "no buildings lost") grant relics that alter future runs. Rewards mastery of the cure, not just survival.

---

## 3. Making the cure deeper (not just longer)

- **Per-step skill expression.** Each step already has a distinct verb (aim, hold, pressure-balance, zone-defense, escort). Add small skill ceilings: perfect-impede bonuses, Administer "overcharge" for a faster Protect at higher overfill risk, Evac routes that trade speed for safety.
- **Host cooperation.** During Protect/Evac the host can act if you've earned trust — warning you of swarms, briefly self-defending, or pointing toward the base. Turns a passive escort into a duo.
- **Triage decisions.** Multiple downed hosts, limited antidote: choose who to save. The one you leave may die or turn. Scarcity makes the choice matter.
- **Leaders with emergent traits** (design §Leadership): 4 strengths / 1–3 weaknesses generated per host, with synergy/anti-synergy between assigned leaders. Team-building depth without hand-authored units.

---

## 4. Game feel — the "juice" layer

Currently there is **no audio and minimal feedback**. This is the single biggest, cheapest win for feel.

### 4.1 Audio (highest impact)
- Layered ambient bed that shifts with day/night and corruption level.
- Distinct, readable SFX per cure step; a rising musical motif that resolves on a successful Evac and sours on a failed cure.
- Diegetic parasite "chittering" that grows with nearby Gray/Dark-Grey count — an audio radar.

### 4.2 Visual juice
- **Hit-stop & screen shake** on impactful hits (impede completion, overfill failure, host death) — small, tasteful, tunable.
- **Impact particles & decals** already partially exist (`particles` in `main.js`); expand with sparks on hit-point pops and antidote mist during Administer.
- **Readable state telegraphs.** Beyond color (accessibility!), add silhouettes/icons above Grays for each cure state; a sweet-spot "lock" flash when Administer pressure is dialed in.
- **The Protect ring as a stage.** Make the radiation pool pulse, brighten as the timer fills, and flash on swarm-wave arrival so defense feels choreographed.
- **Post-processing pass** (once the build step lands): subtle bloom on antidote/stun cyan, vignette + desaturation driven by the corruption meter, depth-of-field on the map view.

### 4.3 Camera & motion
- Speed-based FOV kick when sprinting; a gentle landing dip; head-bob toggle.
- Smooth map-mode transition (zoom/tilt) instead of a hard cut, reinforcing the FPS↔RTS duality.

### 4.4 Haptics & tactility
- Gamepad rumble tied to Administer pressure (once input abstraction exists, [`blue-team.md`](blue-team.md) §7): the controller *breathes* with the sweet-spot.

---

## 5. Story & world uniqueness

- **You are the last engineer, not a soldier.** Reframe combat as triage. The narrative reward for curing is rebuilding a community; the cost of killing is a quieter, emptier world.
- **The world remembers.** Cured hosts populate your base and reference their rescue; regions you cured stay green, regions you cleared by force stay gray. Your run tells a visible story on the map.
- **Environmental storytelling** via low-poly set-pieces — abandoned camps, the last stand of a prior engineer — seeded procedurally so lore feels discovered, not narrated.
- **Escalating extra-terrestrial pressure** (design §Conquest) framed as the *reason* the antidote matters: every person you save is another defender against the real endgame threat.

---

## 6. "Small but memorable" quick wins

Low-cost touches with outsized feel/identity payoff:

- A cured host waving at you when you pass the base.
- The corruption meter as a single, always-visible world-tint rather than a UI bar.
- Naming your first cured host in the death-screen stats ("You saved Mara, and 4 others").
- A photo-mode on the map view for sharing seeds.
- Distinct footstep/'"cure complete" stingers so success is *heard* before it's read.

---

## 7. Prioritization lens

When choosing what to build, weigh each idea on:

1. **Leans on the cure pillar?** (If not, deprioritize.)
2. **Replay multiplier vs. content cost?** (Favor systems that recombine — Strains, seeds, mutators — over one-off content.)
3. **Feel-per-hour?** (Audio and juice are cheap and transformative; do them early in Stage 3.)
4. **Foundation ready?** (Seeds/pooling/post-processing depend on [`project-revamp.md`](project-revamp.md) Stages 1–2 and the build step.)

**Suggested first slice after alpha:** audio + basic juice (§4.1–4.2) for immediate feel, then Strains + seeds (§2.1–2.2) for replay, then named hosts + the Kill Ledger (§1) to make the core choice *matter*.
