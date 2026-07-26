# 영허검가 Implementation Plan — Part 2: World, Art, Entities (Tasks 10–15)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read `2026-07-27-xianxia-survivors.md` (Part 1) first — its **Global Constraints** section applies to every task here.

**Scope of this part:** everything that touches Three.js. These tasks have no unit tests: they
are verified by running the dev server and looking at the result. Each task therefore ends with
an explicit **visual acceptance check** listing exactly what must be on screen. Do not mark a
task done until every bullet in its acceptance check is true.

**Verification loop for every task in this part:**

```bash
npm run dev
```

Open the browser, check the acceptance bullets, open DevTools console and confirm zero errors
and zero warnings, then stop the server and commit.

---

### Task 10: `world/Scene.js`, `world/Camera.js`, `art/materials.js` — render foundation

**Files:**
- Create: `src/world/Scene.js`, `src/world/Camera.js`, `src/art/materials.js`
- Modify: `src/main.js` (replace the Task 1 smoke test with the real bootstrap)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `art/materials.js` → `export function toonRamp(steps = 4): THREE.DataTexture` (cached module-level singleton), `export function makeToonMaterial({ color, rim = 0.35, rimColor = 0xffffff, ...opts }): THREE.MeshToonMaterial`, `export function makeAdditiveMaterial({ color, opacity, map }): THREE.MeshBasicMaterial`, `export const PALETTE` (named colours used across the game: `jade`, `gold`, `mist`, `blood`, `void`, `skyTop`, `skyBottom`, `fog`).
  - `world/Scene.js` → `export function createRenderer(canvas): THREE.WebGLRenderer`, `export function createScene(): THREE.Scene` (adds hemisphere + directional light, `FogExp2`), `export function isWebGL2Available(): boolean`, `export function showFallback(reason: string): void` (fills `#fallback`, unhides it, hides the canvases), `export function resizeToWindow(renderer, camera, overlayCanvas): void`, `export function shadowFollow(light, x, z): void` (retargets the directional light's shadow camera onto the player each frame).
  - `world/Camera.js` → `class FollowCamera { constructor(aspect); get camera(): THREE.PerspectiveCamera; snapTo(x, z): void; update(x, z, dt): void; addTrauma(amount: number): void; setAspect(aspect): void; get viewRadius(): number /* world radius covered by the frustum at ground level, used for spawn rings */ }`

**Requirements:**
- Camera offset `(0, 26, 20)` from the target, looking at the target — a ~52° downward 3/4 view. FOV 45, near 1, far 400.
- Follow smoothing must be framerate-independent: `t = 1 - Math.exp(-lambda * dt)` with `lambda = 8`, not a raw `lerp(0.1)`.
- Trauma decays at `1.6`/sec; screen offset is `trauma² * 0.9` units on X/Y using two out-of-phase sine terms (no `Math.random` — shake must be deterministic in replay).
- `viewRadius` is derived from the frustum, never hardcoded: half-height at the target plane is `tan(fov/2) * distance`, and `viewRadius = Math.hypot(halfHeight, halfHeight * aspect) + 6` so spawns land just off-screen at any window size.
- `createRenderer` sets `antialias: true`, `powerPreference: 'high-performance'`, `setPixelRatio(Math.min(devicePixelRatio, 2))`, `shadowMap.enabled = true`, `shadowMap.type = THREE.PCFSoftShadowMap`, `toneMapping = THREE.ACESFilmicToneMapping`, `toneMappingExposure = 1.05`.
- The toon ramp is a `DataTexture` of `steps` RGBA texels with `NearestFilter` on both min and mag — this is what produces the flat cel bands.
- The rim light is injected with `onBeforeCompile`, appending to `#include <dithering_fragment>`:
  `float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.5);` then
  `gl_FragColor.rgb += rimColor * rim * rimStrength;` — declare `vNormal`/`vViewPosition` are already
  provided by the toon shader chunks. Cache compiled programs by setting `material.customProgramCacheKey`.

- [ ] **Step 1: Write `src/art/materials.js`**

Export `PALETTE` first, since every later file imports colours from here rather than inlining hex:

```js
export const PALETTE = {
  jade: 0x7fd6b5,
  gold: 0xe8c56a,
  mist: 0xc8e6f5,
  blood: 0xd9534f,
  void: 0x2a1f3d,
  skyTop: 0x1b2450,
  skyBottom: 0xe9c9a0,
  fog: 0x5c6f8a,
}
```

Then `toonRamp`, `makeToonMaterial`, `makeAdditiveMaterial` per the requirements above.

- [ ] **Step 2: Write `src/world/Camera.js`**

- [ ] **Step 3: Write `src/world/Scene.js`**

`showFallback(reason)` must render Korean copy:

```
이 브라우저에서는 게임을 실행할 수 없습니다.
WebGL2를 지원하는 최신 브라우저(Chrome, Edge, Firefox)에서 다시 열어주세요.
사유: <reason>
```

- [ ] **Step 4: Rewrite `src/main.js` to bootstrap through these modules**

Replace the whole file. It must: guard on `isWebGL2Available()` and call `showFallback` if
missing; create the renderer, scene, and `FollowCamera`; add a temporary 2-unit jade capsule at
the origin as a stand-in player and a 60×60 grey ground plane; wire `resize`; and run
`setAnimationLoop` moving the stand-in in a slow circle so camera following is visible.

- [ ] **Step 5: Visual acceptance check**

Run `npm run dev` and confirm all of:
- A grey ground plane fills the lower two-thirds of the screen, seen from a high 3/4 angle.
- A jade capsule sits on the ground and drifts in a circle; the camera trails it smoothly with
  no jitter and no snapping.
- The capsule casts a soft shadow onto the ground.
- Resizing the window keeps the scene undistorted and re-fits correctly.
- Console shows zero errors and zero warnings.

- [ ] **Step 6: Temporarily force the fallback to verify it works**

In DevTools console run `window.__forceFallback?.()` — add that hook in `main.js` calling
`showFallback('테스트')`. Confirm the Korean panel appears and the canvas hides. Reload to clear.

- [ ] **Step 7: Commit**

```bash
git add src/world/Scene.js src/world/Camera.js src/art/materials.js src/main.js
git commit -m "feat(world): add renderer, toon materials, and smoothed follow camera"
```

---

### Task 11: `world/Terrain.js`, `world/Sky.js` — the 비경 arena

**Files:**
- Create: `src/world/Terrain.js`, `src/world/Sky.js`
- Modify: `src/main.js` (mount terrain and sky)

**Interfaces:**
- Consumes: `art/materials.js` (`PALETTE`, `makeToonMaterial`, `makeAdditiveMaterial`).
- Produces:
  - `world/Terrain.js` → `export const ARENA_RADIUS = 70`, `class Terrain { constructor(scene); update(dt, playerX, playerZ): void; pingBarrier(x, z): void; clampToArena(outVec2: {x,z}): boolean /* true if it clamped */; dispose(): void }`
  - `world/Sky.js` → `class Sky { constructor(scene); update(dt, playerX, playerZ): void; dispose(): void }`

**Requirements — Terrain:**
- Ground: a 200×200 `PlaneGeometry` rotated flat, textured with a runtime `CanvasTexture` (512×512): jade base `PALETTE.jade` darkened, ~400 soft noise blobs at varying alpha, and a faint repeating 문양 lattice (thin gold lines forming a diamond grid). `wrapS/wrapT = RepeatWrapping`, `repeat.set(12, 12)`, `anisotropy = renderer.capabilities.getMaxAnisotropy()`.
- Barrier: an open-ended `CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 14, 96, 1, true)` with an additive hexagon-pattern `CanvasTexture`, `side: THREE.BackSide`, `depthWrite: false`, base opacity 0.12. UVs scroll slowly upward.
- `pingBarrier(x, z)` records a contact point and time; the barrier shader (or a per-frame uniform) brightens a band centred on that angle, fading over 0.6s. Keep at most 4 concurrent pings in a fixed-size array — no allocation.
- `clampToArena` pushes the point back to `ARENA_RADIUS - 1.0` when outside, calls `pingBarrier`, and returns `true`.
- Props: 60 rocks (`DodecahedronGeometry`, random scale/rotation) and 40 pines (a `ConeGeometry` on a `CylinderGeometry`, merged) as **two `InstancedMesh`es**, plus 8 stone lanterns as a third. Positions scattered by `Math.random` (cosmetic only) with rejection sampling: minimum 3 units apart, minimum 10 units from the origin so the spawn area is clear, maximum `ARENA_RADIUS - 4`. Props have no collision.
- Mist: a large translucent plane at y=0.4 with a scrolling-UV soft-noise texture, additive, `depthWrite: false`.

**Requirements — Sky:**
- A `SphereGeometry(300, 32, 16)` with `side: THREE.BackSide` and a `ShaderMaterial` doing a vertical gradient from `PALETTE.skyTop` to `PALETTE.skyBottom`, plus a subtle band of stars in the upper half (hash-noise threshold in the fragment shader).
- 5 distant floating islands: merged rock geometry, positioned 120–220 units out at y 30–70, drifting on a slow sine and always re-centred on the player so they never fall behind.
- Petals: one `InstancedMesh` of 300 small quads with an additive petal `CanvasTexture`. Each petal has a per-instance seed; positions are computed each frame from `time` and the seed inside a **vertex shader** (`InstancedBufferAttribute` for seed) so the CPU does nothing per petal. Petals wrap within a 90-unit box centred on the player.
- The scene fog set in Task 10 must visually match `PALETTE.fog` so the spawn ring is hidden.

- [ ] **Step 1: Write `src/world/Terrain.js`**
- [ ] **Step 2: Write `src/world/Sky.js`**
- [ ] **Step 3: Mount both in `src/main.js` and drive `update()` from the animation loop**
- [ ] **Step 4: Visual acceptance check**

Confirm all of:
- The ground is jade-green with visible mottling and a faint gold lattice, not a flat colour.
- A translucent hexagonal barrier wall is visible in the distance ringing the arena.
- Walking the stand-in capsule into the barrier (temporarily raise its orbit radius above 70)
  clamps it and lights up the contact area, which then fades.
- Rocks, pines, and lanterns are scattered around, none overlapping, none inside the central
  10-unit clearing.
- The sky is a warm-to-indigo gradient with faint stars overhead and distant floating islands.
- Petals drift down continuously across the whole view.
- The DevTools performance panel shows the frame budget still comfortably under 16ms.
- Console shows zero errors and zero warnings.

- [ ] **Step 5: Commit**

```bash
git add src/world/Terrain.js src/world/Sky.js src/main.js
git commit -m "feat(world): add jade arena terrain, barrier, props, sky, and petals"
```

---

### Task 12: `art/faces.js`, `art/ChibiBuilder.js` — the 미소녀 characters

**Files:**
- Create: `src/art/faces.js`, `src/art/ChibiBuilder.js`
- Modify: `src/main.js` (replace the stand-in capsule with a real character)

**Interfaces:**
- Consumes: `data/characters.js` (`CHARACTERS`, palette per character), `art/materials.js`.
- Produces:
  - `art/faces.js` → `export function makeFaceTexture(palette, expression: 'idle'|'hurt'|'breakthrough'): THREE.CanvasTexture` and `export function faceSet(palette): { idle, hurt, breakthrough }` (built once per character, cached).
  - `art/ChibiBuilder.js` → `export function buildChibi(character): { root: THREE.Group, setExpression(name): void, update(dt, speed01: number, facingAngle: number): void, setOrbitSwords(count: number): void, dispose(): void }`

**Requirements — faces:**
- Draw on a 256×256 canvas with a transparent background (the face plane is alpha-blended onto the head sphere).
- Per eye: a large rounded almond iris filled with a vertical linear gradient from `palette.eye` to a darker shade, a black upper lash line thicker at the outer corner, a white specular highlight at the upper-inner quadrant plus a smaller one lower-outer, and a thin lower lid.
- Eyebrows: thin arcs above each eye. Mouth: a small filled arc. Blush: two soft radial-gradient ovals at low alpha on the cheeks.
- `idle` is neutral. `hurt` has eyes closed (lash line becomes a downward arc, no iris) and a small open mouth. `breakthrough` has wide eyes with an extra highlight ring and a slight open smile.
- Set `colorSpace = THREE.SRGBColorSpace` on the texture or the colours will look washed out.

**Requirements — ChibiBuilder:**
Assemble into a `THREE.Group` at origin, roughly 1.8 units tall, all using `makeToonMaterial`:
- **Head** — `SphereGeometry(0.42, 24, 18)` scaled to `(1, 0.92, 0.95)`, skin-toned, at y≈1.35.
- **Face** — a `PlaneGeometry(0.62, 0.62)` at the head's front (`z = 0.36`), material `MeshBasicMaterial` with `transparent: true`, `depthWrite: false`, `map` from `faceSet`. `setExpression` swaps `material.map` and sets `needsUpdate`.
- **Hair** — a `LatheGeometry` from a hand-authored profile array of ~10 `Vector2` points forming the back hair mass, in `palette.hair`; plus 2 twintail strands (`CapsuleGeometry`) attached at the sides for 설령, side locks for 홍련, a short bob for 청묘. 청묘 additionally gets two `ConeGeometry` cat ears on top and a `TubeGeometry` tail along a `CatmullRomCurve3`.
- **Body** — `CapsuleGeometry(0.22, 0.35)` torso in `palette.cloth`, two thin capsule arms, two short capsule legs.
- **Skirt** — an open `ConeGeometry(0.5, 0.55, 20, 3, true)` in `palette.cloth`, `side: DoubleSide`. Sway via `onBeforeCompile` on the vertex shader: displace by `sin(uTime * 6.0 + atan(position.x, position.z) * 3.0) * uSway * (1.0 - uv.y)` so the hem moves and the waist does not. `uSway` is driven from `speed01`.
- **Ribbons** — two small quads with an additive gradient texture at the back of the head, swaying with the same uniform.
- **Formation ring** — a `RingGeometry(0.55, 0.85)` lying flat at y=0.02 with an additive 팔괘 `CanvasTexture` (eight trigram bars around a circle), rotating at 0.4 rad/s.
- **Orbit swords** — up to 3 thin `BoxGeometry(0.05, 0.5, 0.02)` blades orbiting at radius 0.9, y≈1.0, tilted 20°. `setOrbitSwords(count)` shows/hides them; they are cosmetic, not the 비검 weapon.
- `update(dt, speed01, facingAngle)` advances `uTime`, sets `uSway = 0.06 + speed01 * 0.10`, rotates `root` to `facingAngle` with damped smoothing, bobs the whole group by `sin(t*10) * 0.03 * speed01`, and swings the arms/legs in counterphase by `±0.35 * speed01` radians.
- Only the character root casts shadows; nothing in the group receives them (avoids self-shadow acne on a low-poly figure).

- [ ] **Step 1: Write `src/art/faces.js`**
- [ ] **Step 2: Write `src/art/ChibiBuilder.js`**
- [ ] **Step 3: In `src/main.js`, build all three characters, place them 3 units apart, and add a temporary key handler: `Q` cycles the expression on all three**
- [ ] **Step 4: Visual acceptance check**

Confirm all of:
- Three visibly distinct chibi girls stand on the ground: silver twintails in white/blue, black
  hair with red robes, and a short-haired green/white one with cat ears and a tail.
- Each face reads clearly as an anime face at gameplay camera distance — large eyes with visible
  highlights, blush, and a small mouth. Zoom the camera in temporarily to check the detail, then
  restore.
- Pressing `Q` visibly changes all three expressions through idle → hurt → breakthrough.
- Each character has a slowly rotating 팔괘 ring at her feet and hair/skirt that sway.
- Silhouettes are cel-shaded with visible flat bands and a rim light on the edges, not smooth
  gradients.
- Console shows zero errors and zero warnings.

- [ ] **Step 5: Commit**

```bash
git add src/art/faces.js src/art/ChibiBuilder.js src/main.js
git commit -m "feat(art): add canvas anime faces and procedural chibi character builder"
```

---

### Task 13: `entities/Player.js` — movement, dash, health

**Files:**
- Create: `src/entities/Player.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `core/Input.js`, `combat/Stats.js`, `combat/damage.js` (`mitigate`), `art/ChibiBuilder.js`, `world/Terrain.js` (`clampToArena`), `data/characters.js`.
- Produces:
  - `class Player { constructor(character, scene, terrain); x, z, hp, maxHp, facing, alive, invulnTimer, dashCooldown; stats; loadout: { weapons, passives }; get speed01(): number; recomputeStats(): void; update(dt, input): void; takeDamage(rawAmount): boolean /* true if it landed */; heal(amount): void; render(alpha): void; get isInvulnerable(): boolean; dispose(): void }`
  - `export const DASH_DISTANCE = 6`, `export const DASH_IFRAMES = 0.35`, `export const DASH_COOLDOWN = 3.0`

**Requirements:**
- `update` is called with `FIXED_DT` only. `render(alpha)` interpolates the visual transform between the previous and current simulation position, so movement is smooth above 60Hz.
- Movement: `x += input.moveX * stats.moveSpeed * dt`, same for `z`. Then `terrain.clampToArena(this)`.
- `facing` tracks the movement direction; when input is zero, `facing` holds its last value.
- Dash: on `input.consumeDash()` with `dashCooldown <= 0`, teleport `DASH_DISTANCE` along `facing` (clamped to the arena), set `invulnTimer = DASH_IFRAMES` and `dashCooldown = DASH_COOLDOWN`. Spawn 5 afterimages — reuse a fixed pool of 5 cloned meshes with descending opacity, faded over 0.35s.
- `takeDamage(raw)` returns `false` and does nothing when `isInvulnerable`. Otherwise applies `mitigate(raw, stats.armor)`, sets `invulnTimer = 0.25` (brief mercy invulnerability), swaps the expression to `hurt` for 0.4s, and returns `true`. At `hp <= 0` set `alive = false`.
- Regeneration: `hp = Math.min(maxHp, hp + stats.regen * dt)`.
- `recomputeStats()` calls `computeStats(character, loadout.passives)` and uses `applyMaxHpChange` to keep the HP fraction when `maxHp` changes. Call it on construction and after every upgrade.
- The chibi's `update` receives `speed01 = actualSpeed / stats.moveSpeed` clamped to `[0,1]`.

- [ ] **Step 1: Write `src/entities/Player.js`**
- [ ] **Step 2: Wire it into `src/main.js`: one player, `Input`, the fixed-step `Clock` loop from Task 5, camera following the player**
- [ ] **Step 3: Add a temporary debug readout** — a fixed-position `<div>` showing `hp / maxHp`, `dashCooldown`, and position. Bind `H` to `player.takeDamage(10)`.
- [ ] **Step 4: Visual acceptance check**

Confirm all of:
- WASD and arrow keys move the character in all 8 directions; diagonals are **not** faster.
- The character turns to face her movement direction and her hair/skirt sway increases with speed.
- Walking into the barrier stops her at the edge and lights the barrier; she never escapes.
- `Space` dashes 6 units instantly with a visible afterimage trail, then refuses to fire again
  for 3 seconds.
- `H` reduces HP in the debug readout and flips her expression to `hurt` briefly.
- Holding `H` down does not drain HP faster than once per 0.25s (mercy invulnerability works).
- Motion is smooth with no stutter; toggle the browser to 144Hz or use DevTools frame throttling
  to confirm speed does not change with framerate.
- Console shows zero errors and zero warnings.

- [ ] **Step 5: Commit**

```bash
git add src/entities/Player.js src/main.js
git commit -m "feat(entities): add player movement, dash with i-frames, and health"
```

---

### Task 14: `art/enemyGeometry.js`, `entities/EnemyManager.js` — the horde

**Files:**
- Create: `src/art/enemyGeometry.js`, `src/entities/EnemyManager.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `core/Pool.js`, `core/SpatialHash.js`, `core/RNG.js`, `combat/damage.js`, `data/enemies.js`, `data/waves.js`, `art/materials.js`, `world/Camera.js` (`viewRadius`).
- Produces:
  - `art/enemyGeometry.js` → `export function buildEnemyGeometry(enemyId): THREE.BufferGeometry` — one merged low-poly geometry per type, built once and cached.
  - `entities/EnemyManager.js` →
    - `export const MAX_ENEMIES = 900`
    - `class EnemyManager { constructor(scene, rng); update(dt, runTime, player, camera): void; render(alpha): void; damageAt(x, z, radius, amount, tag, stats, opts): number /* enemies hit */; damageOne(index, amount, tag, stats, opts): void; queryNear(x, z, radius, out): number; get liveCount(): number; get killCount(): number; purgeOnScreen(camera): void; spawn(enemyId, x, z, runTime): number; clear(): void; onKill: (x, z, xp, elite) => void }`

**Data layout — parallel typed arrays, no per-enemy objects:**

```js
this.px = new Float32Array(MAX_ENEMIES)   // position
this.pz = new Float32Array(MAX_ENEMIES)
this.vx = new Float32Array(MAX_ENEMIES)   // knockback velocity
this.vz = new Float32Array(MAX_ENEMIES)
this.prevX = new Float32Array(MAX_ENEMIES) // for render interpolation
this.prevZ = new Float32Array(MAX_ENEMIES)
this.hp = new Float32Array(MAX_ENEMIES)
this.maxHp = new Float32Array(MAX_ENEMIES)
this.type = new Uint8Array(MAX_ENEMIES)    // index into ENEMIES
this.slowT = new Float32Array(MAX_ENEMIES) // remaining slow duration
this.slowAmt = new Float32Array(MAX_ENEMIES)
this.burnT = new Float32Array(MAX_ENEMIES)
this.burnDps = new Float32Array(MAX_ENEMIES)
this.hitCd = new Float32Array(MAX_ENEMIES) // per-enemy contact-damage cooldown vs player
this.stateT = new Float32Array(MAX_ENEMIES) // behaviour timer (dash windup, shoot cadence)
this.flash = new Float32Array(MAX_ENEMIES)  // hit flash, drives instance colour
this.canSplit = new Uint8Array(MAX_ENEMIES)
```

`release(i)` must copy every one of these arrays from `pool.lastSwappedFrom` into `i`. Write a
single private `_moveSlot(from, to)` that does all of them so a new array can never be forgotten.

**Requirements:**
- One `InstancedMesh` per enemy type, `count` set to the live count for that type each frame.
  Because the pool is a single dense range across all types, maintain a per-type index list
  rebuilt each frame into preallocated `Int32Array`s.
- Per-instance colour: base enemy colour, tinted toward white by `flash`, and toward blue by
  `slowAmt`. Use `setColorAt` and set `instanceColor.needsUpdate = true` only when something changed.
- Steering: unit vector toward the player × effective speed, where effective speed is
  `speed * (1 - slowAmt)`. `demonCultivator` and `wolf` add a dash: every `dashInterval` seconds,
  triple speed for 0.5s.
- `talismanGhost` (`behavior: 'ranged'`) steers to hold `keepDistance` and fires a projectile at
  the player every `shootInterval` — it calls a callback `onEnemyShot(x, z, dirX, dirZ, damage, speed)`
  supplied by the caller, so `EnemyManager` never imports `ProjectileManager` (keeps the
  dependency direction clean).
- Separation: for each enemy, `queryNear(px, pz, radius * 1.6)`, then push away from each
  neighbour by `(overlap / dist) * SEPARATION_STRENGTH * dt`. Cap the neighbour scan at 12 per
  enemy to bound worst-case cost in a dense pile.
- Knockback velocity decays exponentially: `v *= Math.exp(-6 * dt)`.
- Burn ticks damage every 0.5s while `burnT > 0`.
- Spawning: `waveAt(runTime)` gives the band; accumulate `spawnTimer` and emit `perSpawn` enemies
  each `spawnInterval`. Spawn position is on a circle of radius `camera.viewRadius`, at an angle
  biased 60% toward the player's movement direction (pick a random angle, then blend it toward
  the movement angle with probability 0.6). If the spawn point is outside `ARENA_RADIUS`, pull it
  in to `ARENA_RADIUS - 2`.
- Enemies are also despawned when further than `camera.viewRadius * 2.2` from the player, and
  respawned by the normal spawn logic — this prevents a long tail of enemies the player outran.
- `damageAt` uses the spatial hash, does the exact distance check, calls `rollDamage`, applies
  `knockbackImpulse`, sets `flash = 1`, and on death calls `onKill(x, z, xp, elite)` and handles
  the `splitter` behaviour (spawn 2 children at half scale/HP with `canSplit = 0`).
- Floating damage text is emitted through a callback `onDamageText(x, y, z, amount, crit)` set by
  the caller — again, no import of the UI layer.

**Enemy geometry sketches (all merged into one buffer per type):**
- `wisp` — an `IcosahedronGeometry(0.4, 0)` plus two small trailing tetrahedra; jittered vertices for a torn-shade look.
- `wolf` — an elongated box body, a wedge head, four thin leg boxes, a cone tail.
- `stoneGhoul` — three overlapping dodecahedra of decreasing size stacked into a hunched mass, plus two boxy arms.
- `talismanGhost` — a floating tapered cylinder torso with a flat rectangular talisman face plate and two small sleeve boxes.
- `bloodScorpion` — a flattened sphere body, six thin leg boxes, a segmented tail of three shrinking spheres ending in a cone stinger.
- `demonCultivator` — a humanoid: capsule torso, sphere head, a wide cone robe, and a floating ring of three small blades above.

- [ ] **Step 1: Write `src/art/enemyGeometry.js`**
- [ ] **Step 2: Write `src/entities/EnemyManager.js`**
- [ ] **Step 3: Wire into `src/main.js` with a run timer, and add temporary debug keys:** `K` calls `damageAt(player.x, player.z, 8, 999, 'sword', player.stats, {})`, and `T` jumps the run timer forward 60 seconds.
- [ ] **Step 4: Extend the debug readout** to show live enemy count, kill count, `pool.dropped`, and `renderer.info.render.calls`.
- [ ] **Step 5: Visual acceptance check**

Confirm all of:
- Enemies stream in from just off-screen and converge on the player from all sides.
- Pressing `T` repeatedly escalates the spawn rate and introduces new enemy types; each type is
  visually distinguishable at gameplay distance.
- Enemies **do not stack into a single overlapping blob** — separation keeps them as a crowd with
  visible individual bodies.
- 부적귀 hangs back at range instead of closing; 요랑 and 마수사 visibly lunge periodically.
- `K` kills the nearby horde; 혈갈 visibly splits into two smaller ones, and those do not split again.
- Enemies flash white when damaged and are knocked backward, with heavier types moving less.
- With 500+ live enemies on screen the debug readout shows draw calls in the low tens (not
  hundreds) and the frame stays at 60fps.
- `pool.dropped` stays at 0 during normal play.
- Console shows zero errors and zero warnings.

- [ ] **Step 6: Commit**

```bash
git add src/art/enemyGeometry.js src/entities/EnemyManager.js src/main.js
git commit -m "feat(entities): add instanced enemy horde with steering, separation, and waves"
```

---

### Task 15: `entities/ProjectileManager.js`, `art/vfx.js` — projectiles and effects

**Files:**
- Create: `src/entities/ProjectileManager.js`, `src/art/vfx.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `core/Pool.js`, `entities/EnemyManager.js` (via injected reference), `art/materials.js`.
- Produces:
  - `entities/ProjectileManager.js` →
    - `export const MAX_PROJECTILES = 1200`
    - `export const PROJECTILE_KINDS = ['sword','talisman','vajra','butterfly','enemyShot','orbFragment']`
    - `class ProjectileManager { constructor(scene); spawn(kind, opts): number; update(dt, enemies, player): void; render(alpha): void; clear(): void }`
    - `spawn` opts: `{ x, z, dirX, dirZ, speed, damage, pierce, radius, life, tag, stats, homing = 0, knockback = 0, onHit?, hostile = false }`
  - `art/vfx.js` →
    - `export const MAX_VFX = 400`
    - `class Vfx { constructor(scene); spark(x, z, color, count): void; burst(x, z, radius, color): void; deathPuff(x, z, color): void; pillar(x, z): void; shockRing(x, z, radius): void; lightning(x, z, radius): void; update(dt): void; render(alpha): void; clear(): void }`

**Requirements:**
- One `InstancedMesh` per projectile kind, sharing one pool. Same `_moveSlot` discipline as `EnemyManager`.
- Projectile geometry: `sword` a thin elongated box; `talisman` a flat rectangle that spins; `vajra` a chunky double-ended cone; `butterfly` two small quads at an angle that flap via vertex shader; `enemyShot` a small dark octahedron; `orbFragment` a tiny sphere.
- Homing: when `homing > 0`, each tick steer the velocity toward the nearest enemy found via
  `enemies.queryNear`, rotating the direction by at most `homing * dt` radians. Re-target only
  every 0.15s (staggered by index so the cost spreads across frames).
- Collision: query the spatial hash at the projectile position with `radius`, do the exact
  distance check, call `enemies.damageOne`, decrement `pierce`, and track already-hit enemy ids
  in a small fixed ring buffer per projectile (8 slots) so a piercing shot cannot re-hit the same
  target on consecutive ticks.
- `hostile: true` projectiles (enemy shots) check against the player instead, calling
  `player.takeDamage`.
- Projectiles die on `pierce < 0`, on `life <= 0`, or on leaving `ARENA_RADIUS + 5`.
- All VFX are instanced quads or rings with additive materials and a per-instance `age` attribute;
  the fade and scale animation runs in the **vertex/fragment shader** from a single uniform time
  plus per-instance birth time, so the CPU only writes a matrix once at spawn.
- `pillar` is the 경지 돌파 effect: a tall additive cylinder that scales up and fades over 0.8s.
- `shockRing` is a flat expanding ring, used by both breakthrough and boss slams.

- [ ] **Step 1: Write `src/art/vfx.js`**
- [ ] **Step 2: Write `src/entities/ProjectileManager.js`**
- [ ] **Step 3: Wire into `src/main.js`; connect `EnemyManager.onEnemyShot` to `projectiles.spawn('enemyShot', { hostile: true, ... })`; add temporary debug keys:** `1` fires 20 homing swords, `2` fires a vajra, `3` triggers `vfx.pillar` + `shockRing` at the player.
- [ ] **Step 4: Visual acceptance check**

Confirm all of:
- `1` launches homing swords that visibly curve toward enemies, pierce a few, then vanish.
- `2` launches a vajra that punches straight through the entire horde without stopping, knocking
  enemies aside hard.
- Each hit produces a spark burst at the contact point; each kill produces a death puff.
- `3` produces a light pillar and an expanding ground ring at the player.
- 부적귀 fires dark projectiles that travel to the player and reduce HP on contact.
- Firing hundreds of projectiles does not increase draw calls beyond one per kind.
- `pool.dropped` for projectiles stays at 0.
- Console shows zero errors and zero warnings.

- [ ] **Step 5: Commit**

```bash
git add src/entities/ProjectileManager.js src/art/vfx.js src/main.js
git commit -m "feat(entities): add instanced projectiles and shader-driven VFX"
```

---

**Tasks 16–24 (weapons, pickups, UI, bosses, polish) continue in
`docs/superpowers/plans/2026-07-27-xianxia-survivors-part3.md`.**
