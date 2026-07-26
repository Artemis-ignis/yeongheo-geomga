# 영허검가 Implementation Plan — Part 3: Weapons, UI, Bosses, Polish (Tasks 16–24)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Read Part 1 (`2026-07-27-xianxia-survivors.md`) first — its **Global Constraints** apply throughout. Part 2 (`-part2.md`) covers Tasks 10–15.

Same verification loop as Part 2: `npm run dev`, check every acceptance bullet, confirm a clean
console, stop the server, commit.

---

### Task 16: `combat/WeaponSystem.js` + the four evolvable 법보

**Files:**
- Create: `src/combat/WeaponSystem.js`
- Create: `src/combat/weapons/flyingSword.js`, `fireTalisman.js`, `thunderOrb.js`, `frostPalm.js`
- Create: `src/combat/weapons/index.js` (id → module registry)
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `data/weapons.js`, `combat/Stats.js`, `entities/ProjectileManager.js`, `entities/EnemyManager.js`, `art/vfx.js`.
- Produces:
  - `combat/weapons/index.js` → `export const WEAPON_MODULES: Record<string, WeaponModule>`, `export function getWeaponModule(id)`.
  - A `WeaponModule` is `{ fire(ctx): void, update?(ctx, dt): void, attach?(ctx): void, detach?(ctx): void }`.
  - `ctx` is a single reused object (no per-call allocation): `{ player, stats, level, weapon, world: { projectiles, enemies, vfx, terrain, camera }, rng, runTime }` where `level` is the resolved `WeaponLevel` and `weapon` is the `Weapon` definition (for `tag`).
  - `combat/WeaponSystem.js` → `class WeaponSystem { constructor(world, rng); sync(loadout): void; update(dt, player, stats, runTime): void; render(alpha): void; get equipped(): {id, level}[] }`
    - `sync` diffs the loadout against the current equipped set, calling `detach`/`attach` on modules that were removed/added (needed because `thunderOrb` owns persistent meshes), and resets timers only for newly added weapons.

**Cooldown and stat composition (from the spec):**
- `effectiveCooldown = level.cooldown * stats.cooldown`
- `effectiveAmount = (level.amount ?? 1) + stats.amount`
- `effectiveSpeed = (level.speed ?? 0) * stats.speedProj`
- `effectiveArea = (level.area ?? 1) * stats.area`
- `effectiveDuration = (level.duration ?? 0) * stats.duration`
- `level.damage` is passed raw; `rollDamage` applies `might` and `tagMight`.

**Weapon behaviours:**
- **`flyingSword`** — `fire` finds the `effectiveAmount` nearest enemies (query the hash at
  increasing radii, 12 → 24 → 40, stopping once enough are found) and spawns one homing `sword`
  projectile per target, fanned by ±12° when there are fewer targets than projectiles. Homing
  rate 4 rad/s. Falls back to the player's facing direction when no enemy is in range.
- **`fireTalisman`** — `fire` picks `effectiveAmount` random enemies within 20 units and spawns a
  `talisman` projectile with `homing: 1.5`. `onHit` calls `vfx.burst`, then
  `enemies.damageAt(x, z, 2.2 * effectiveArea, level.damage, 'fire', stats)` and applies burn
  (`burnDps = level.burn`, `burnT = effectiveDuration`) to everything in the blast.
- **`thunderOrb`** — persistent. `attach` creates an `InstancedMesh` of `level.count` glowing
  spheres parented to the scene; `update` places them on a circle of radius `1.6 * effectiveArea`
  around the player, rotating at `level.speed` rad/s, and every `effectiveCooldown` seconds
  damages enemies within `0.55 * effectiveArea` of each orb. Each enemy has a per-orb hit
  cooldown so a stationary enemy is not hit every tick. `detach` disposes the mesh.
  When `level.count` changes, rebuild the instanced mesh.
- **`frostPalm`** — `fire` emits a cone in the player's facing direction: query the hash at
  `4.5 * effectiveArea`, keep only enemies whose angle to `facing` is within 45°, damage them,
  and set `slowAmt = level.slow`, `slowT = effectiveDuration`. Spawn a fan-shaped additive VFX
  quad that scales outward and fades over 0.3s.

- [ ] **Step 1: Write `src/combat/weapons/index.js` with the registry (populate as modules are added)**
- [ ] **Step 2: Write the four weapon modules**
- [ ] **Step 3: Write `src/combat/WeaponSystem.js`**
- [ ] **Step 4: In `src/main.js`, give the player a real `loadout` seeded with her `startWeapon` at level 1, call `weaponSystem.sync(player.loadout)` on change, and drive `update`/`render`. Add temporary debug keys:** `Z` levels every equipped weapon by 1 (capped at 5), `X` grants the next unowned weapon.
- [ ] **Step 5: Visual acceptance check**

Confirm all of:
- Starting as 설령, 비검 fires automatically on a ~1.1s cadence and homes onto the nearest enemy.
- Starting as 홍련, 화염부 arcs into the horde and detonates with a visible burst; hit enemies
  keep taking damage afterward (burn ticks).
- Starting as 청묘, 뇌령주 orbits her continuously and damages anything it sweeps through, with no
  runaway damage on a stationary target.
- `X` then `Z` builds up a mixed loadout; 빙백장 fires a visible frost cone in the facing direction
  and slowed enemies visibly move slower and tint blue.
- `Z` up to level 5 visibly increases projectile count and firing rate.
- Switching weapons in and out (via `X`) never leaves an orphaned orb mesh in the scene.
- Console shows zero errors and zero warnings.

- [ ] **Step 6: Commit**

```bash
git add src/combat/WeaponSystem.js src/combat/weapons src/main.js
git commit -m "feat(combat): add weapon system and the four evolvable 법보"
```

---

### Task 17: The remaining four 법보

**Files:**
- Create: `src/combat/weapons/baguaArray.js`, `vajra.js`, `spiritButterfly.js`, `skyThunder.js`
- Modify: `src/combat/weapons/index.js`

**Interfaces:**
- Consumes: same `ctx` contract as Task 16.
- Produces: four more entries in `WEAPON_MODULES`.

**Weapon behaviours:**
- **`baguaArray`** — persistent. `attach` creates a flat additive 팔괘 ring mesh; `update` keeps it
  under the player, scales it to `3.0 * effectiveArea`, and rotates it at 0.6 rad/s. Every
  `effectiveCooldown` it calls `enemies.damageAt(player.x, player.z, 3.0 * effectiveArea, level.damage, 'array', stats)`.
  Runs on a self-managed timer inside `update` (not the standard fire cadence) so the ring stays
  visible between ticks — set the weapon's standard timer to never fire by having `fire` be a no-op.
- **`vajra`** — `fire` spawns `effectiveAmount` `vajra` projectiles along the player's facing
  direction, spread ±15°, with `pierce: 999` and `knockback: level.knockback`. On each hit add
  camera trauma 0.08 so heavy hits feel weighty.
- **`spiritButterfly`** — `fire` spawns `effectiveAmount` `butterfly` projectiles in evenly-spaced
  directions around the player with `homing: 2.0`, low `speed`, and `life = effectiveDuration`.
  Butterflies ignore the arena bound (they may leave and come back) — exempt this kind from the
  out-of-arena despawn.
- **`skyThunder`** — `fire` picks `effectiveAmount` random enemies within the camera view radius.
  For each, spawn a telegraph decal (a thin additive ring that shrinks over 0.4s) and schedule the
  strike. Because there is no allocation allowed in the hot loop, keep a fixed-size array of 16
  pending strikes `{x, z, t, damage}` in the module's own state; `update` counts them down and on
  expiry calls `vfx.lightning` plus `enemies.damageAt(x, z, 2.0 * effectiveArea, ...)`.
  If all 16 slots are busy, drop the extra strike.

- [ ] **Step 1: Write the four modules**
- [ ] **Step 2: Register them in `src/combat/weapons/index.js`**
- [ ] **Step 3: Visual acceptance check**

Confirm all of:
- 팔괘진 is a continuously visible rotating formation under the player that steadily melts anything
  standing in it.
- 금강저 punches a clean corridor through the horde and shoves enemies violently aside, with a
  small camera kick.
- 영접부 releases butterflies that wander outward, then curve back onto enemies and stick around
  for several seconds.
- 천뢰인 shows a shrinking ring telegraph, then a lightning strike lands exactly there and kills
  what is underneath.
- Owning all 8 weapons at once still holds 60fps with a large horde.
- Console shows zero errors and zero warnings.

- [ ] **Step 4: Commit**

```bash
git add src/combat/weapons
git commit -m "feat(combat): add 팔괘진, 금강저, 영접부, 천뢰인"
```

---

### Task 18: `entities/PickupManager.js` — 영기, leveling, breakthrough

**Files:**
- Create: `src/entities/PickupManager.js`
- Modify: `src/entities/Player.js` (add `xp`, `level`, `stones`), `src/main.js`

**Interfaces:**
- Consumes: `core/Pool.js`, `data/realms.js` (`xpFor`, `realmFor`), `art/vfx.js`, `art/materials.js`.
- Produces:
  - `export const MAX_PICKUPS = 1500`
  - `export const PICKUP_KINDS = ['qi', 'stone', 'heal', 'chest']`
  - `class PickupManager { constructor(scene); drop(kind, x, z, value): void; update(dt, player, vfx): void; render(alpha): void; clear(): void; onCollect: (kind, value) => void }`
  - Player gains: `xp: number`, `level: number`, `stones: number`, `addXp(amount): number /* levels gained */`.

**Requirements:**
- One `InstancedMesh` per kind: `qi` a small jade octahedron that bobs and spins, `stone` a gold
  cube, `heal` a red-pink sphere, `chest` a larger gold box with a glow ring.
- Magnetism: within `stats.magnet` units, accelerate toward the player at 30 u/s²; within 0.8
  units, collect. A collected `qi` calls `player.addXp(value * stats.growth)`.
- `addXp` loops while `xp >= xpFor(level)`, subtracting and incrementing, returning the number of
  levels gained (a big pickup can grant several at once).
- Breakthrough, fired once per level gained: `vfx.pillar` + `vfx.shockRing`, camera trauma 0.5,
  `enemies.damageAt(player.x, player.z, 8, 20 + level * 4, 'array', stats, { knockback: 12 })`,
  `player.invulnTimer = 1.2`, expression → `breakthrough` for 1.0s, and an event
  `emitter.emit('levelUp', { level })` which the UI listens to. The upgrade modal opens **after**
  the shockwave resolves, so the player gets breathing room.
- Enemy kills call `pickups.drop('qi', x, z, xp)`. Elites also drop a `heal`. The 8:00 boss drops
  a `chest`.
- To keep the field from filling with hundreds of uncollected orbs, when live `qi` exceeds 600,
  merge the oldest 100 into a single higher-value orb at their centroid.

- [ ] **Step 1: Write `src/entities/PickupManager.js`**
- [ ] **Step 2: Add `xp`/`level`/`stones`/`addXp` to `src/entities/Player.js`**
- [ ] **Step 3: Wire `EnemyManager.onKill` → `pickups.drop`, and `pickups.onCollect` → level-up handling in `src/main.js`**
- [ ] **Step 4: Extend the debug readout with level, xp / xpFor(level), and stone count**
- [ ] **Step 5: Visual acceptance check**

Confirm all of:
- Killed enemies drop jade orbs that bob and spin.
- Orbs within the magnet radius accelerate toward the player and are absorbed.
- The debug readout's XP climbs and the level increments at the right threshold.
- Each level up fires a light pillar, an expanding ring that visibly blasts nearby enemies back,
  a camera shake, and a brief `breakthrough` expression.
- Killing an elite 마수사 drops a red healing pickup that restores HP.
- Farming a huge pile of orbs never drives `pool.dropped` above 0 (the merge kicks in).
- Console shows zero errors and zero warnings.

- [ ] **Step 6: Commit**

```bash
git add src/entities/PickupManager.js src/entities/Player.js src/main.js
git commit -m "feat(entities): add 영기 pickups, leveling, and 경지 돌파 shockwave"
```

---

### Task 19: `ui/icons.js`, `ui/OverlayCanvas.js`, `ui/Hud.js`

**Files:**
- Create: `src/ui/icons.js`, `src/ui/OverlayCanvas.js`, `src/ui/Hud.js`
- Modify: `styles/hud.css`, `src/main.js` (remove the temporary debug `<div>`)

**Interfaces:**
- Consumes: `data/weapons.js`, `data/passives.js`, `data/realms.js`, `core/Events.js`.
- Produces:
  - `ui/icons.js` → `export function iconFor(id): string /* data URL, cached */` — a distinct 64×64 procedural glyph per weapon and passive id, drawn on canvas.
  - `ui/OverlayCanvas.js` → `class OverlayCanvas { constructor(canvasEl, camera); resize(w, h): void; pushText(x, y, z, text, color, crit): void; pushWarning(text): void; render(dt): void; clear(): void }` — fixed pool of 120 floating texts, no allocation per hit.
  - `ui/Hud.js` → `class Hud { constructor(rootEl, emitter); setCharacter(character): void; update(state): void; show(): void; hide(): void; dispose(): void }` where `state` is `{ hp, maxHp, xp, xpNeeded, level, realm, runTime, kills, stones, weapons: {id, level}[], passives: {id, level}[], dashCooldown }`.

**Requirements — OverlayCanvas:**
- The overlay canvas sits above the WebGL canvas with `pointer-events: none`, sized to the same
  device pixel ratio.
- `pushText` projects the world point through the camera to screen space once at push time, then
  the text rises 40px and fades over 0.8s in screen space (cheaper and steadier than re-projecting).
- Crits render larger, in gold, with a thicker dark outline. Normal hits are white.
- Draw with a single `ctx.font` set per size class to avoid font thrash; batch by iterating the
  pool in order.
- The whole overlay clears and redraws each frame; skip the redraw entirely when the pool is empty.

**Requirements — Hud (DOM):**
- **Top centre** — the run timer as `MM:SS` in a large tabular-numeral font, with the 경지 name +
  hanja above it and the level as a small badge.
- **Top left** — kill count and 영석 count with small procedural icons.
- **Under the timer** — a full-width thin XP bar in jade that fills toward the next level.
- **Bottom left** — the 기혈 bar: a red fill with a slower white "damage ghost" layer behind it
  that catches up over 0.4s, plus `hp / maxHp` in text. Below it, a small dash-cooldown pip that
  desaturates while on cooldown.
- **Bottom right** — two rows of six slots. Each slot shows the icon, and five level pips beneath.
  Empty slots are dim outlines. A newly acquired or upgraded slot flashes gold for 0.5s.
- All numbers update in place by writing `textContent` on cached element references — never
  rebuild innerHTML per frame.
- The whole HUD is `pointer-events: none` except elements marked `.clickable`.

- [ ] **Step 1: Write `src/ui/icons.js`** — 14 distinct glyphs (8 weapons, 6 passives) plus a
  fallback. Each should be readable at 32px: 비검 a blade, 화염부 a talisman with a flame, 뇌령주
  a circled bolt, 빙백장 a snowflake palm, 팔괘진 a trigram ring, 금강저 a vajra, 영접부 a butterfly,
  천뢰인 a lightning bolt from a cloud; 검결 a sword hilt, 경신공 a feather, 호신강기 a shield,
  영근 a root/sprout, 천리안 an eye, 금단 a pill.
- [ ] **Step 2: Write `src/ui/OverlayCanvas.js`**
- [ ] **Step 3: Write `src/ui/Hud.js` and the matching CSS in `styles/hud.css`**
- [ ] **Step 4: Wire `EnemyManager.onDamageText` → `overlay.pushText`, and drive `hud.update(state)` once per rendered frame in `src/main.js`. Delete the temporary debug div.**
- [ ] **Step 5: Visual acceptance check**

Confirm all of:
- Damage numbers pop off every hit, rise, and fade; crits are visibly larger and gold.
- Hundreds of simultaneous hits do not drop the framerate and do not create DOM nodes (check the
  Elements panel — the node count must stay flat during combat).
- The timer counts up in `MM:SS`, the 경지 name changes at level 5 (연기 → 축기), and the XP bar
  fills and resets each level.
- The 기혈 bar drops on damage with the white ghost trailing behind, and regenerates for 청묘.
- The dash pip greys out for 3 seconds after a dash.
- Weapon and passive slots populate with legible distinct icons, and level pips fill as items
  level up. A freshly upgraded slot flashes.
- The HUD stays readable and correctly positioned at 1280×720, 1920×1080, and a narrow window.
- Console shows zero errors and zero warnings.

- [ ] **Step 6: Commit**

```bash
git add src/ui/icons.js src/ui/OverlayCanvas.js src/ui/Hud.js styles/hud.css src/main.js
git commit -m "feat(ui): add HUD, procedural icons, and floating combat text overlay"
```

---

### Task 20: `ui/LevelUpModal.js` — the 돌파 choice

**Files:**
- Create: `src/ui/LevelUpModal.js`
- Modify: `styles/hud.css`, `src/main.js`

**Interfaces:**
- Consumes: `combat/upgrades.js` (`rollUpgrades`, `applyChoice`), `ui/icons.js`.
- Produces: `class LevelUpModal { constructor(rootEl); open(choices, onPick: (choice) => void): void; close(): void; get isOpen(): boolean; handleKey(slot: number, confirm: boolean): void }`

**Requirements:**
- Opening the modal pushes the game into the `levelUp` state: `simulate` stops, `render` continues,
  so the frozen battlefield stays visible behind a dimmed backdrop.
- Three vertical cards, each showing: the icon, the name with hanja beneath, a level transition
  (`Lv2 → Lv3`, or `신규 습득` for a new item), and the description.
- Evolution cards get a gold border, an animated sheen, and a `進化 · 진화` banner across the top.
- Consumable cards get a jade border.
- Cards are selectable with `1`/`2`/`3`, with arrow keys + `Enter`, and by clicking (cards carry
  `.clickable`). The focused card is visibly highlighted.
- Picking calls `applyChoice(player.loadout, choice)`, then `player.recomputeStats()`, then
  `weaponSystem.sync(player.loadout)`, then resolves consumables (`heal` → `player.heal(maxHp*0.3)`,
  `stones` → `player.stones += 200`, `purge` → `enemies.purgeOnScreen(camera)`), then closes.
- If several levels were gained at once, queue the modals and open the next one after the first
  closes.
- The modal must never open while already open — guard on `isOpen`.

- [ ] **Step 1: Write `src/ui/LevelUpModal.js` and its CSS**
- [ ] **Step 2: Wire it to the `levelUp` event and the game state machine in `src/main.js`**
- [ ] **Step 3: Visual acceptance check**

Confirm all of:
- Leveling up freezes the action and shows three cards over a dimmed, still-rendered battlefield.
- All three input methods select a card, and the highlight tracks the focused one.
- Taking a weapon upgrade immediately changes its behaviour in-game (more projectiles, faster fire).
- Taking a passive immediately changes stats (e.g. 경신공 makes movement visibly faster).
- Maxing 비검 and 검결 offers 만검귀종 with a gold evolution card.
- Gaining two levels from one big pickup shows two modals in sequence, not one.
- Once all six weapon slots are full, no new weapons are ever offered.
- Console shows zero errors and zero warnings.

- [ ] **Step 4: Commit**

```bash
git add src/ui/LevelUpModal.js styles/hud.css src/main.js
git commit -m "feat(ui): add 경지 돌파 upgrade modal with evolution cards"
```

---

### Task 21: The four evolutions

**Files:**
- Create: `src/combat/weapons/myriadSwords.js`, `infernoSea.js`, `violetThunder.js`, `frozenSky.js`
- Modify: `src/combat/weapons/index.js`, `src/entities/EnemyManager.js` (freeze state)

**Interfaces:**
- Consumes: the same `ctx` contract; `EnemyManager` gains `freezeT: Float32Array` and a
  `freeze(index, duration)` method plus shatter handling in its death path.
- Produces: four more `WEAPON_MODULES` entries.

**Behaviours:**
- **`myriadSwords` (만검귀종)** — no target search. Every fire (0.22s cadence) spawns
  `effectiveAmount` swords from a random point 14 units above and around the player, falling
  onto random ground points within `10 * effectiveArea` units, damaging on impact. Reads as a
  continuous sword rain.
- **`infernoSea` (분천화해)** — same as `fireTalisman` but `onHit` also creates a persistent fire
  field: a fixed pool of 12 fields `{x, z, radius, t, dps}`, each an additive ground quad,
  ticking damage every 0.4s for `effectiveDuration`. New fields replace the oldest when full.
- **`violetThunder` (자소신뢰)** — same orbit as `thunderOrb`, plus on each orb hit, chain to
  `level.chain` further enemies within `level.chainRange`, drawing a `vfx.lightning` segment
  between each pair and dealing 60% damage per hop.
- **`frozenSky` (한천빙봉)** — the frost cone applies `freeze` (a 0.95 slow, effectively frozen)
  for `effectiveDuration` and tints the enemy near-white-blue. An enemy that dies while frozen
  calls `enemies.damageAt(x, z, 3.0, level.shatter, 'ice', stats)` — a chain-shatter that clears
  packed groups.

- [ ] **Step 1: Add `freezeT` and `freeze()` to `EnemyManager`, including the `_moveSlot` copy and shatter-on-death**
- [ ] **Step 2: Write the four evolution modules and register them**
- [ ] **Step 3: Visual acceptance check** (use the `Z`/`X` debug keys plus a passive-granting debug key to reach the evolutions quickly)

Confirm all of:
- 만검귀종 rains swords continuously from the sky over a wide area around the player.
- 분천화해 leaves burning ground patches that keep killing after the explosion.
- 자소신뢰 draws visible lightning arcs hopping between enemies.
- 한천빙봉 freezes enemies solid (near-white tint, effectively stationary), and killing one
  detonates a frost blast that cascades through the frozen group.
- Evolving removes the base weapon from the HUD slots and inserts the evolution.
- Console shows zero errors and zero warnings.

- [ ] **Step 4: Commit**

```bash
git add src/combat/weapons src/entities/EnemyManager.js
git commit -m "feat(combat): add the four 법보 evolutions"
```

---

### Task 22: `entities/BossManager.js` — 요왕 창랑 and 마존 흑천

**Files:**
- Create: `src/entities/BossManager.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `art/materials.js`, `art/vfx.js`, `entities/EnemyManager.js`, `entities/ProjectileManager.js`, `combat/damage.js`, `data/waves.js`.
- Produces:
  - `class BossManager { constructor(scene, enemies, projectiles, vfx); spawn(bossId, player, runTime): void; update(dt, player, runTime): void; render(alpha): void; damage(amount, tag, stats): void; get active(): BossState | null; clear(): void; onBossDefeated: (bossId, x, z) => void; onWarning: (name) => void }`
  - A boss is a single non-instanced `THREE.Group` built from primitives — there is only ever one,
    so it can afford detail and its own shadow.

**요왕 창랑 (`blueWolfKing`) — spawns at 8:00:**
- HP 6,000, radius 2.6, contact damage 30, knockback-immune.
- Body: an oversized `wolf` silhouette at 3.5× scale with a spiked mane (a ring of cones), glowing
  eyes (small additive spheres), and a three-tailed rear.
- Shared 5s attack timer alternating two attacks:
  - **돌진** — 1.0s wind-up with a red ground decal marking the charge lane, then a 0.6s dash across
    the arena at 22 u/s, damaging anything in the lane. Camera trauma 0.6 on impact with the wall.
  - **소환** — howls and spawns 8 `wolf` in a ring around itself.
- On death: `vfx.burst` at large radius, drops a `chest` pickup, and `onBossDefeated` fires.

**마존 흑천 (`darkHeavenLord`) — spawns at 15:00:**
- HP 24,000, radius 2.0, contact damage 40, knockback-immune.
- Body: a humanoid ~4 units tall — dark robe cone, capsule torso, sphere head with a featureless
  additive mask, and six blades orbiting behind him.
- Three phases at 100–66%, 66–33%, 33–0%, each 30% faster than the last:
  1. **검비(劍雨)** — every 3s, spawns a ring of 16 dark swords at radius 12 that converge on the
     player's position at the time of the cast.
  2. **흑구환(黑球環)** — every 4s, spawns a ring of 12 slow orbs at radius 3 that expand outward to
     radius 25 over 4s. The player must find a gap.
  3. **소환(召喚)** — every 5s summons 3 `demonCultivator`, while continuing to alternate attacks 1 and 2.
- Phase transitions trigger a brief invulnerable stagger (1.2s), a shockwave that pushes the
  player back, and a colour shift on the mask.
- On death: a long white-out burst, and `onBossDefeated('darkHeavenLord')` → victory.

**Shared requirements:**
- `onWarning(name)` fires 3 seconds before the spawn so the HUD can slide in a warning band.
- Boss HP renders as a dedicated wide bar at the top of the HUD (add this to `Hud.update`).
- Boss damage goes through `rollDamage` like any enemy, so `might`/`tagMight`/crit all apply.
  Weapons target the boss by including it in `enemies.queryNear` results — register the boss in
  the spatial hash each tick with a reserved id (`-1` sentinel handled by `damageOne`).

- [ ] **Step 1: Write `src/entities/BossManager.js`**
- [ ] **Step 2: Add the boss HP bar and warning band to `src/ui/Hud.js` + CSS**
- [ ] **Step 3: Wire spawn timing from the wave table and `onBossDefeated` into the run state in `src/main.js`. Add a debug key `B` to spawn each boss immediately.**
- [ ] **Step 4: Visual acceptance check**

Confirm all of:
- A warning band slides in 3 seconds before each boss, naming it.
- 요왕 창랑 is unmistakably larger than any normal enemy, telegraphs its charge with a visible
  ground lane, then dashes along exactly that lane.
- Its howl spawns a ring of 요랑.
- All eight weapons visibly damage the boss, and the boss HP bar drains accordingly.
- 마존 흑천's sword rain converges on where the player *was*, so moving dodges it.
- The expanding orb ring has a findable gap.
- Phase transitions stagger him and visibly change his colour and attack tempo.
- Killing 요왕 창랑 drops a chest that grants an upgrade when collected.
- Killing 마존 흑천 ends the run.
- Console shows zero errors and zero warnings.

- [ ] **Step 5: Commit**

```bash
git add src/entities/BossManager.js src/ui/Hud.js styles/hud.css src/main.js
git commit -m "feat(entities): add 요왕 창랑 and 마존 흑천 boss encounters"
```

---

### Task 23: `core/Game.js`, `ui/TitleScreen.js`, `ui/ResultScreen.js` — the full run

**Files:**
- Create: `src/core/Game.js`, `src/ui/TitleScreen.js`, `src/ui/ResultScreen.js`
- Modify: `src/main.js` (reduce to a thin bootstrap), `styles/hud.css`

**Interfaces:**
- Consumes: everything built so far.
- Produces:
  - `core/Game.js` → `class Game { constructor({ canvas, overlayCanvas, hudRoot }); start(): void; dispose(): void }` — owns the state machine, the fixed-step loop, and all subsystem wiring. This is the only module that knows about every other module.
    - States: `boot → title → playing ⇄ levelUp ⇄ paused → result`, plus `error`.
    - `levelUp` and `paused` freeze `simulate` but keep `render` running.
  - `ui/TitleScreen.js` → `class TitleScreen { constructor(rootEl, characters); show(onStart: (characterId) => void): void; hide(): void; update(dt): void }`
  - `ui/ResultScreen.js` → `class ResultScreen { constructor(rootEl); show(result, onRestart): void; hide(): void }` where `result` is `{ victory: boolean, runTime, level, realm, kills, stones, weapons, passives, seed }`.

**Requirements — TitleScreen:**
- The game title 靈墟劍歌 rendered vertically in large hanja on the left, with 영허검가 beneath it
  and a one-line tagline: `— 마기가 삼킨 비경에서, 검을 든 소녀들의 이야기 —`.
- Three character cards. Each card contains a live rotating 3D preview of that chibi, rendered
  into a small `WebGLRenderTarget` and displayed via a canvas — one shared renderer, three
  render targets, updated at 30fps to keep the cost down.
- Each card shows name + hanja, path, starting 법보 with its icon, and the two trait lines.
- Select with `1`/`2`/`3`, arrows + `Enter`, or click. Start begins the run.
- Controls legend at the bottom: `WASD 이동 · Space 축지법 · P 일시정지 · 공격은 자동`.

**Requirements — ResultScreen:**
- 승천(昇天) in gold for victory, 좌화(坐化) in muted grey-blue for defeat, with a matching
  one-line flavour text.
- A stat block: 생존 시간, 도달 경지 (name + hanja + level), 처치 수, 영석, and the run seed.
- The final loadout as two rows of icons with level pips.
- A `다시 도전` button returning to the title screen with everything fully reset.

**Requirements — Game:**
- Owns a single `Emitter` passed to the UI so the simulation never imports UI modules.
- `pause` toggles on `P`/`Escape` and shows a simple centred `일시정지` overlay with the controls
  legend. `visibilitychange` to hidden auto-pauses.
- The frame callback is wrapped in `try/catch`; an uncaught error transitions to the `error` state,
  stops the loop, and shows a panel with the message, the stack, and the run seed.
- `validateData()` runs once at boot in dev (`import.meta.env.DEV`); a failure shows the same
  error panel with the validation message.
- Restarting must fully reset every subsystem — call `clear()` on every manager, dispose the
  player's meshes, and construct a fresh `RNG` from a new seed. Verify no meshes leak across runs.

- [ ] **Step 1: Write `src/core/Game.js`, moving all wiring out of `main.js`**
- [ ] **Step 2: Reduce `src/main.js` to: WebGL2 guard, construct `Game`, `start()`**
- [ ] **Step 3: Write `src/ui/TitleScreen.js` and `src/ui/ResultScreen.js` plus their CSS**
- [ ] **Step 4: Remove every temporary debug key added in Tasks 10–22 except `F3`**
- [ ] **Step 5: Full playthrough acceptance check**

Confirm all of:
- The title screen shows the vertical hanja title and three cards, each with a live rotating 3D
  character preview.
- Selecting each of the three characters starts a run with the correct starting 법보 and traits.
- A complete 15-minute run is playable start to finish without errors: waves escalate, both bosses
  appear on schedule, and killing 마존 흑천 shows the 승천 screen.
- Dying shows the 좌화 screen with correct stats.
- `다시 도전` returns to the title and a second run behaves identically to the first — check
  `renderer.info.memory.geometries` and `.textures` before and after a restart to confirm nothing
  leaks.
- `P` pauses and resumes; switching browser tabs auto-pauses.
- Throwing a deliberate error (temporarily add `throw new Error('test')` inside the loop) shows the
  error panel rather than freezing. Remove it afterward.
- Console shows zero errors and zero warnings across a whole run.

- [ ] **Step 6: Commit**

```bash
git add src/core/Game.js src/ui/TitleScreen.js src/ui/ResultScreen.js src/main.js styles/hud.css
git commit -m "feat: add game state machine, title screen, and result screen"
```

---

### Task 24: Debug overlay, performance pass, README

**Files:**
- Create: `src/ui/DebugOverlay.js`, `README.md`
- Modify: `src/core/Game.js`, and whichever hot paths the profile identifies

**Interfaces:**
- Produces: `class DebugOverlay { constructor(rootEl); toggle(): void; update(stats): void }` where
  `stats` is `{ fps, ms, enemies, projectiles, pickups, vfx, drawCalls, triangles, dropped, seed, state }`.

**Requirements:**
- `F3` toggles the overlay. It is hidden by default and must not affect the frame budget when hidden.
- FPS is a 30-frame rolling average, not an instantaneous value.
- `dropped` aggregates `pool.dropped` across every manager — a non-zero value means a capacity is
  too low and must be investigated, not ignored.

**Performance pass — do these in order, measuring after each:**

1. Profile a 12:00+ run with the Chrome Performance panel. Record the top three self-time entries.
2. Confirm no allocation in steady state: take two heap snapshots 30 seconds apart during combat;
   the delta must be near zero. If it is not, find the allocating call — the usual culprits are a
   `new THREE.Vector3()` in an update loop or an array literal in a hot function.
3. Confirm draw calls stay under 40 with a full horde plus a boss.
4. If the frame budget is still over 16ms with 500+ enemies, in this order: reduce the separation
   neighbour cap from 12 to 8; stagger enemy AI so only half the enemies re-evaluate steering each
   tick (alternate on `index & 1`); reduce shadow map to 512.
5. Re-verify at the end that 500+ enemies still hold 60fps.

**README.md** must cover: what the game is, how to run it (`npm install`, `npm run dev`), controls,
the three characters, a short description of the 법보/공법 systems, the architecture in a paragraph
(fixed timestep, instancing, spatial hash, data-driven balance), how to run tests, and where to
change balance numbers (`src/data/`). Written in Korean, since it is a Korean-language game.

- [ ] **Step 1: Write `src/ui/DebugOverlay.js` and wire `F3` in `Game.js`**
- [ ] **Step 2: Run the profiling steps and record the before/after numbers in the commit message**
- [ ] **Step 3: Apply optimisations only where the profile justifies them**
- [ ] **Step 4: Write `README.md`**
- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: PASS, all tests across all files.

- [ ] **Step 6: Verify the production build**

```bash
npm run build
```

Expected: succeeds with no errors. Then:

```bash
npm run preview
```

Play for two minutes in the built version and confirm it behaves identically to dev.

- [ ] **Step 7: Final acceptance check**

Confirm all of:
- `F3` shows the overlay; FPS reads a stable 60 during heavy combat.
- Draw calls stay under 40 with a full horde plus a boss.
- Heap delta over 30 seconds of combat is near zero.
- Every pool's `dropped` counter is 0 after a full 15-minute run.
- `npm test` passes.
- `npm run build` succeeds and `npm run preview` plays correctly.
- README instructions work from a clean checkout.

- [ ] **Step 8: Commit**

```bash
git add src/ui/DebugOverlay.js src/core/Game.js README.md
git commit -m "feat: add debug overlay, performance pass, and README"
```

---

## Plan Self-Review

Checked against the spec:

| Spec section | Covered by |
|---|---|
| 1 Overview / success criteria | Tasks 23 (full run), 24 (perf, 500+ @60fps) |
| 2 Theme mapping | Tasks 6 (data), 19/20/23 (UI copy) |
| 3 Player characters + visuals | Tasks 6, 12, 13 |
| 4 법보 ×8 + firing model | Tasks 6, 16, 17 |
| 5 공법 ×6 | Tasks 6, 7 |
| 6 Stat aggregation | Task 7 |
| 7 경지 / leveling / upgrade roll | Tasks 6, 9, 18, 20 |
| 8 Enemies, scaling, bosses, waves | Tasks 6, 14, 22 |
| 9 World / camera | Tasks 10, 11 |
| 10 Engine core | Tasks 2, 3, 4, 5, 23 |
| 11 Combat resolution + floating text | Tasks 8, 14, 19 |
| 12 UI | Tasks 19, 20, 23 |
| 13 File structure | All — matches exactly, minus `audio/` (out of scope) |
| 14 Error handling | Tasks 6 (validate), 10 (WebGL2 fallback), 23 (frame try/catch), 24 (pool counters) |
| 15 Testing | Tasks 2–9 (unit), Parts 2–3 (visual acceptance checks) |
| 16 Controls | Tasks 5, 13, 23 |

No spec section is unimplemented. The only deliberate omission is the audio module, dropped by
explicit user decision and recorded in the Global Constraints.
