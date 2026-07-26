# 靈墟劍歌 (영허검가) — Design Spec

**Date:** 2026-07-27
**Status:** Approved
**Type:** Three.js browser game — Vampire Survivors-like, 미소녀 + 선협(仙俠) theme

---

## 1. Overview

A single-player, browser-based arena survival game ("뱀서라이크"). The player controls one of
three cultivator girls on a floating jade plateau, moves with WASD, and all attacks fire
automatically. Enemies spawn in escalating waves for 15 minutes. Killing enemies drops 영기
orbs; collecting them raises the player's 경지 (cultivation realm), which opens a choice of
three upgrades. Surviving to 15:00 spawns the final boss; killing it wins the run.

**Success criteria**

1. 500+ simultaneous enemies at 60fps on integrated graphics.
2. A full 15-minute run is completable and loseable — both endings reachable.
3. The three characters play distinctly from the first 30 seconds.
4. Every balance number lives in `src/data/`, editable without touching logic.
5. Pure-logic modules are unit tested and pass.

**Explicitly out of scope**

- Audio of any kind. No SFX, no music, no `audio/` module. (Dropped by user decision.)
- Meta-progression, unlocks, save files, achievements.
- Multiplayer, networking, backend.
- Mobile/touch controls. Keyboard only.
- External art assets. Every visual is generated in code at runtime.

---

## 2. Theme Mapping

| Vampire Survivors concept | This game |
|---|---|
| Level up | 경지 돌파 (境界突破) |
| XP gem | 영기(靈氣) 구슬 |
| Weapon | 법보(法寶) |
| Passive item | 공법(功法) |
| Map | 비경(秘境) — misty floating jade plateau ringed by a 결계 barrier |
| Chest | 비경 보고 (秘境寶庫) |
| Win | 승천(昇天) |
| Lose | 좌화(坐化) |
| HP | 기혈(氣血) |

---

## 3. Player Characters

Three characters, selected on the title screen with `1`/`2`/`3` or by clicking a card.

| id | Name | Path | Start 법보 | Trait |
|---|---|---|---|---|
| `seolryeong` | 설령 (雪靈) | 한빙검파 검수 | `flyingSword` | `moveSpeed` ×+0.10, `tagMight.sword` +0.15 |
| `hongryeon` | 홍련 (紅蓮) | 염화종 부법사 | `fireTalisman` | `area` +0.15, `tagMight.fire` +0.25 |
| `cheongmyo` | 청묘 (靑猫) | 요족 혈맥 체수 | `thunderOrb` | `maxHp` ×+0.30, `regen` +0.4 |

Base stats shared by all characters (before traits):

```
maxHp        100
moveSpeed    5.2   (units/sec)
armor        0
might        1.00  (damage multiplier)
area         1.00  (radius/size multiplier)
cooldown     1.00  (cooldown multiplier — lower is faster)
speedProj    1.00  (projectile speed multiplier)
duration     1.00  (effect duration multiplier)
amount       0     (flat extra projectiles)
magnet       3.0   (pickup radius, units)
luck         1.00
growth       1.00  (XP gain multiplier)
critChance   0.05
critMult     2.0
regen        0
```

Plus `tagMight`, a map of element tag → additive damage bonus, defaulting to
`{ sword: 0, fire: 0, thunder: 0, ice: 0, array: 0 }`. Every weapon declares a `tag`; its final
damage multiplier is `stats.might + stats.tagMight[weapon.tag]`. This is the mechanism behind
character traits like 설령's "검류 법보 피해 +15%".

### Visual construction (`art/ChibiBuilder.js`)

Each character is assembled at runtime from Three.js primitives, no external models:

- **Head** — `SphereGeometry` slightly squashed on Y.
- **Face** — a `CanvasTexture` from `art/faces.js`, applied to a plane parented to the front of
  the head. Drawn with Canvas2D: large iris with a vertical gradient, two specular highlights,
  upper lash line, small mouth, blush ovals. Three variants per character: `idle`, `hurt`,
  `breakthrough`. The active variant is swapped by assigning `material.map`.
- **Hair** — `LatheGeometry` for the silhouette/back mass, plus 2–4 `CapsuleGeometry` strands
  for twintails/side locks. Hair strands sway via a small vertex shader offset driven by
  velocity and time.
- **Body** — `CapsuleGeometry` torso, thin capsule arms/legs.
- **Skirt** — open `ConeGeometry`; vertex shader displaces the hem by
  `sin(time*k + angle) * swayAmount`, where `swayAmount` scales with player speed.
- **Props** — two ribbon quads, a 팔괘 formation ring decal at the feet
  (`RingGeometry` with an additive canvas texture, slowly rotating), and 3 orbiting 비검 (thin
  boxes) whose orbit radius/speed reflect the equipped weapon set.

Materials use a shared toon ramp (`art/materials.js`) — a 4-step gradient texture on
`MeshToonMaterial` — plus a rim-light term injected via `onBeforeCompile`, giving the flat
cel-shaded anime look without a full custom shader pipeline.

---

## 4. 법보 (Weapons) — 8

Each weapon has levels 1–5. Level 1 is acquisition. Four weapons evolve when the weapon is at
Lv5 **and** its paired 공법 is at Lv5; the evolution replaces the weapon and is offered as a
normal upgrade choice.

| id | Name | Tag | Behavior | Pair | Evolution |
|---|---|---|---|---|---|
| `flyingSword` | 비검 (飛劍) | `sword` | Homing projectile at nearest enemy; pierces 2 | `swordArt` | `myriadSwords` 만검귀종 — continuous sword rain over a radius around the player |
| `fireTalisman` | 화염부 (火焰符) | `fire` | Lobbed at a random enemy in range; AoE burst + burn DoT | `goldenCore` | `infernoSea` 분천화해 — burst leaves a lingering fire field |
| `thunderOrb` | 뇌령주 (雷靈珠) | `thunder` | N orbs orbiting the player; damage on contact, per-target hit cooldown | `spiritRoot` | `violetThunder` 자소신뢰 — orbs chain lightning to 2 nearby enemies |
| `frostPalm` | 빙백장 (氷魄掌) | `ice` | Cone blast in facing direction; applies 40% slow | `guardianAura` | `frozenSky` 한천빙봉 — freezes; frozen enemies shatter for AoE damage on death |
| `baguaArray` | 팔괘진 (八卦陣) | `array` | Persistent formation under the player; ticks damage to enemies inside | — | — |
| `vajra` | 금강저 (金剛杵) | `array` | Heavy projectile in facing direction; infinite pierce, strong knockback | — | — |
| `spiritButterfly` | 영접부 (靈蝶符) | `array` | Many slow homing butterflies, low damage, long lifetime | — | — |
| `skyThunder` | 천뢰인 (天雷引) | `thunder` | Strikes random on-screen enemies after a 0.4s telegraph | — | — |

### Weapon data shape (`data/weapons.js`)

```js
{
  id: 'flyingSword',
  name: '비검',
  hanja: '飛劍',
  tag: 'sword',
  desc: '가장 가까운 적을 추적하는 검을 날린다.',
  pairPassive: 'swordArt',
  evolvesTo: 'myriadSwords',
  levels: [
    // index 0 = Lv1
    { damage: 12, cooldown: 1.10, amount: 1, speed: 18, pierce: 2, area: 1.0 },
    { damage: 15, cooldown: 1.05, amount: 2, speed: 18, pierce: 2, area: 1.0 },
    { damage: 18, cooldown: 1.00, amount: 2, speed: 20, pierce: 3, area: 1.1 },
    { damage: 22, cooldown: 0.90, amount: 3, speed: 20, pierce: 3, area: 1.1 },
    { damage: 28, cooldown: 0.80, amount: 4, speed: 22, pierce: 4, area: 1.2 },
  ],
}
```

Only fields a weapon actually uses need to be present, but a boot-time validator asserts that
every level entry has `damage` and `cooldown`, that `tag` is one of the known tags, that
`pairPassive`/`evolvesTo` reference existing ids, and that every weapon has exactly 5 level
entries (evolutions have 1).

**How level fields combine with stats.** A weapon's `area` field is a *shape* multiplier for
that weapon specifically; the effective size is `level.area * stats.area`. Likewise
`amount` → `level.amount + stats.amount`, `speed` → `level.speed * stats.speedProj`, and
`cooldown` → `level.cooldown * stats.cooldown`. `damage` is passed raw into `applyDamage`,
which applies `might` and `tagMight`.

### Firing model (`combat/WeaponSystem.js`)

Each equipped weapon holds `{ id, level, timer }`. Every fixed tick:

```
timer -= dt
effectiveCooldown = level.cooldown * stats.cooldown
if timer <= 0:
    timer += effectiveCooldown
    weaponModule.fire(ctx)   // ctx = { player, stats, level, world, rng }
```

Each weapon lives in `combat/weapons/<id>.js` and exports `{ fire(ctx), update?(ctx, dt) }`.
`update` exists only for persistent weapons (`thunderOrb`, `baguaArray`, evolutions with
fields). Weapons never touch the renderer directly — they request projectiles/effects from
`ProjectileManager` and `vfx`.

---

## 5. 공법 (Passives) — 6

| id | Name | Per level | Max |
|---|---|---|---|
| `swordArt` | 검결 (劍訣) | `might` +0.10 | 5 |
| `lightBody` | 경신공 (輕身功) | `moveSpeed` ×+0.08 | 5 |
| `guardianAura` | 호신강기 (護身罡氣) | `maxHp` ×+0.15, `armor` +1 | 5 |
| `spiritRoot` | 영근 (靈根) | `cooldown` −0.08 | 5 |
| `farSight` | 천리안 (千里眼) | `magnet` ×+0.25, `growth` ×+0.10 | 5 |
| `goldenCore` | 금단 (金丹) | `area` +0.12, `regen` +0.3 | 5 |

Slot caps: **6 법보 + 6 공법**. Once both are full, the upgrade roll only offers level-ups of
already-owned items and consumables.

---

## 6. Stat Aggregation (`combat/Stats.js`)

Stats are recomputed from scratch whenever the loadout changes (never incrementally patched):

```
value = (base + Σ flatBonuses) * Π (1 + pctBonuses)
```

Per-stat rule table:

- `might`, `area`, `armor`, `regen`, `amount`, `critChance` — **additive** (flat).
- `moveSpeed`, `maxHp`, `magnet`, `growth`, `speedProj`, `duration` — **multiplicative**.
- `cooldown` — additive reduction, **clamped to a floor of 0.40** (max 60% CDR).

`maxHp` increases preserve the current HP *fraction*. Character traits are applied as an
implicit passive at level 1 that is always present.

---

## 7. 경지 (Realms) & Leveling

XP required for level `n` (1-indexed, level 1 → 2 costs `xpFor(1)`):

```
xpFor(n) = floor(5 + n * 8 + (n^1.55) * 2.4)
```

Realm titles displayed in the HUD:

| Level | 경지 |
|---|---|
| 1–4 | 연기 (練氣) |
| 5–9 | 축기 (築基) |
| 10–14 | 결단 (結丹) |
| 15–19 | 원영 (元嬰) |
| 20–24 | 화신 (化神) |
| 25–29 | 연허 (煉虛) |
| 30+ | 대승 (大乘) |

**Breakthrough effect** (on every level up): a light pillar VFX, an expanding shockwave ring
that deals `20 + level * 4` damage and knocks back everything within 8 units, and 1.2s of
invulnerability. This fires *before* the upgrade modal opens, so the player gets breathing room.

### Upgrade roll (`combat/upgrades.js`)

Offer 3 choices. Candidate pool, weighted:

1. Owned weapon below Lv5 → weight 100
2. Owned passive below Lv5 → weight 80
3. New weapon (if weapon slots < 6) → weight 60
4. New passive (if passive slots < 6) → weight 50
5. Available evolution (weapon Lv5 + pair passive Lv5) → weight 400 (near-guaranteed offer)

Weights are multiplied by `stats.luck`. Rolls are without replacement. If the pool is empty
(everything maxed), offer 3 consumables: 기혈 회복 30%, 영석 +200, 전체 화면 정화(모든 적 처치).

---

## 8. Enemies

| id | Name | HP@0min | Speed | Damage | Radius | KB resist | XP | Behavior |
|---|---|---|---|---|---|---|---|---|
| `wisp` | 마기 잔영 | 8 | 2.4 | 6 | 0.45 | 0.0 | 1 | Direct chase. Swarm filler. |
| `wolf` | 요랑 (妖狼) | 16 | 4.6 | 10 | 0.55 | 0.1 | 2 | Chases; periodically dashes 2× speed for 0.5s. |
| `stoneGhoul` | 석귀 (石鬼) | 90 | 1.5 | 18 | 0.95 | 0.7 | 5 | Slow tank. |
| `talismanGhost` | 부적귀 (符鬼) | 22 | 2.0 | 8 | 0.55 | 0.2 | 3 | Keeps 10 units distance, fires a dark talisman every 2.5s. |
| `bloodScorpion` | 혈갈 (血蝎) | 34 | 3.0 | 12 | 0.7 | 0.3 | 4 | On death splits into 2 half-scale, half-HP children (children do not split again). |
| `demonCultivator` | 마수사 (魔修士) | 160 | 3.4 | 22 | 0.85 | 0.5 | 15 | Elite. Floats, dashes at the player every 4s, has a health bar. |

**Scaling.** At run time `t` minutes, each enemy's effective HP is
`baseHp * (1 + t * 0.28 + (t/6)^2)` and its damage is `baseDamage * (1 + t * 0.06)`.
Speed does not scale. XP value is `ceil(baseXp * (1 + t * 0.05))`.

**Rendering.** One `InstancedMesh` per enemy type. Geometry per type is built once in
`art/enemyGeometry.js` by merging primitives (`BufferGeometryUtils.mergeGeometries`) into a
single buffer. Instance color varies subtly per enemy (`instanceColor`) so the crowd doesn't
look like clones. Enemies do not cast shadows; only the player does.

**Movement.** Each tick: steer toward the player at `speed`, then apply separation — for each
enemy, query the spatial hash for neighbours within `radius*1.6` and apply a push force away.
This keeps the horde as a *crowd* instead of a single overlapping blob, and costs O(n) with the
grid.

### Bosses (`entities/BossManager.js`)

**8:00 — 요왕 창랑 (妖王 蒼狼).** Giant wolf. HP 6,000. Two attacks on a shared 5s timer:
telegraphed charge across the arena (1s wind-up, red ground decal), and summoning 8 `wolf`.
Drops a 비경 보고 chest on death (grants a free upgrade + 500 영석).

**15:00 — 마존 흑천 (魔尊 黑天).** Humanoid dark cultivator. HP 24,000, three phases at 100–66%,
66–33%, 33–0%:

1. **검비(劍雨)** — rains dark swords in a ring pattern around the player.
2. **흑구환(黑球環)** — spawns a rotating ring of slow orbs that expands outward.
3. **소환(召喚)** — continuously summons `demonCultivator` while alternating the two attacks.

Killing it ends the run in victory. Dying to it ends the run in defeat. If the player somehow
survives without killing it, the run continues until one of those happens.

### Wave timeline (`data/waves.js`)

A declarative table, one entry per 30-second band from 0:00 to 15:00:

```js
{ t: 0,   spawnInterval: 1.2, perSpawn: 3,  types: ['wisp'] },
{ t: 60,  spawnInterval: 1.1, perSpawn: 4,  types: ['wisp', 'wolf'] },
...
{ t: 480, boss: 'blueWolfKing' },
...
{ t: 900, boss: 'darkHeavenLord', spawnInterval: 2.0, perSpawn: 4, types: [...] },
```

The validator asserts entries are strictly increasing in `t`, cover 0→900 with no gap, and
reference only existing enemy ids. Spawns appear on a ring just outside the camera frustum
(radius derived from the camera, not hardcoded), at a random angle, biased 60% toward the
player's movement direction so the horde stays engaging.

---

## 9. World (`world/`)

- **Ground** — a 200×200 plane with a procedurally generated `CanvasTexture`: jade-green base,
  soft noise mottling, and a faint repeating 문양 lattice. Tiled ×12.
- **Barrier** — the playable area is a circle of radius 70. A translucent cylinder with an
  additive hexagonal-pattern texture marks the 결계. The player is hard-clamped inside it; the
  barrier brightens and ripples when the player touches it. Enemies spawn outside and walk in.
- **Props** — ~60 instanced rocks, ~40 instanced pines (cone + cylinder), and 8 stone lanterns,
  scattered by seeded RNG with a minimum-distance rejection so they don't overlap. Purely
  decorative; no collision (collision with scenery is miserable in a horde game).
- **Sky** — a large inverted sphere with a vertical gradient shader (deep indigo → pale gold at
  the horizon). Distant floating islands drift slowly. Fog (`FogExp2`) matched to the horizon
  colour hides the spawn ring.
- **Ambience** — an instanced petal system (~300 quads) drifting down and sideways, plus a
  low-lying mist plane with scrolling UVs.

**Lighting.** `HemisphereLight` (sky/ground tint) + one `DirectionalLight` with a tight shadow
camera that follows the player, `shadowMapSize` 1024. Toon materials mean lighting is cheap.

### Camera (`world/Camera.js`)

Perspective camera, fixed orientation, positioned at `player + (0, 26, 20)` looking at the
player — roughly a 52° downward 3/4 view. Follows with critically-damped smoothing
(`lerp` factor derived from dt so it is framerate-independent). Trauma-based shake: a `trauma`
value in [0,1] decays at 1.6/sec, and offset is `trauma² * maxOffset * noise(t)`. Boss slams
and breakthroughs add trauma.

---

## 10. Engine Core (`core/`)

### Game loop (`core/Game.js`, `core/Time.js`)

Fixed timestep with an accumulator:

```
FIXED_DT = 1/60
accumulator += min(realDt, 0.25)      // clamp to avoid spiral-of-death after a tab switch
while accumulator >= FIXED_DT:
    simulate(FIXED_DT)
    accumulator -= FIXED_DT
alpha = accumulator / FIXED_DT
render(alpha)                          // interpolate visual transforms
```

Gameplay is therefore deterministic w.r.t. tick count and independent of display refresh rate.

**State machine:** `boot → title → charSelect → playing ⇄ levelUp ⇄ paused → result`.
`levelUp` and `paused` freeze `simulate` but keep `render` running.

### Spatial hash (`core/SpatialHash.js`)

Uniform grid, cell size 4 units, backed by a `Map<int, number[]>` keyed by
`(cx * 73856093) ^ (cz * 19349663)`. Rebuilt each tick from the live enemy array (rebuild is
cheaper than incremental updates at this entity count and has no stale-key bugs).
API: `clear()`, `insert(index, x, z)`, `query(x, z, radius, out[]) -> count`.

### Pool (`core/Pool.js`)

Fixed-capacity pool over parallel typed arrays where possible (`Float32Array` for positions and
velocities, `Uint8Array` for alive flags). `acquire()` returns an index or `-1` when full;
`release(i)` swaps with the last live element to keep the live range dense. Exceeding capacity
drops the spawn and increments a counter surfaced in the debug overlay — never grows unbounded.

Capacities: enemies 900, projectiles 1,200, pickups 1,500, VFX 400, floating texts 120.

### RNG (`core/RNG.js`)

`mulberry32` seeded PRNG. The run seed is shown on the result screen. All gameplay randomness
(waves, upgrade rolls, crits, spawn angles) goes through it; cosmetic randomness (petals) may
use `Math.random`.

### Input (`core/Input.js`)

Keyboard only. WASD + arrows for movement (normalized diagonal), `Space` for dash, `P`/`Escape`
for pause, `1`–`3` for character select, `Enter`/click to confirm. Tracks key state in a `Set`;
`blur` clears it so the player doesn't slide away when they alt-tab.

**Dash (축지법):** 6-unit instant displacement in the movement direction, 0.35s of
invulnerability, 3.0s cooldown, with a fading afterimage trail. If no direction is held, dashes
in the last-faced direction.

---

## 11. Combat Resolution (`combat/damage.js`)

```
applyDamage(enemy, rawDamage, source, opts):
    dmg = rawDamage * (stats.might + stats.tagMight[source.tag])
    isCrit = rng() < stats.critChance
    if isCrit: dmg *= stats.critMult
    dmg = max(1, round(dmg))
    enemy.hp -= dmg
    emitFloatingText(enemy.pos, dmg, isCrit)
    applyKnockback(enemy, dir, opts.knockback * (1 - enemy.kbResist))
    if enemy.hp <= 0: killEnemy(enemy, source)
```

Enemy → player contact damage is continuous with a 0.5s per-enemy hit cooldown, reduced by
`armor` flat and blocked entirely during i-frames. On hit: red screen vignette pulse, camera
trauma +0.25, face texture swaps to `hurt` for 0.4s.

**Floating text** is drawn on a 2D overlay canvas (`ui/OverlayCanvas.js`) layered above the
WebGL canvas — positions are projected from world space each frame and drawn with `fillText`.
No DOM nodes are created or destroyed during combat.

---

## 12. UI (`ui/`) — HTML + CSS

The HUD is real DOM over the canvas, styled in `styles/hud.css`. Fonts are system CJK stacks
(`Noto Sans KR`, `Malgun Gothic`, sans-serif) — no webfont downloads.

- **Top bar** — 경지 name + level, XP bar, run timer, kill count, 영석 count.
- **Bottom left** — 기혈 bar with a delayed "damage ghost" trail.
- **Bottom right** — weapon/passive slot grid. Icons are canvas-drawn in `ui/icons.js` (one
  small procedural glyph per item) and cached as data URLs. Level pips under each slot.
- **Level-up modal** — three vertical cards showing icon, name + hanja, level arrow
  (`Lv2 → Lv3`), and the delta description. Evolutions get a gold border and a 進化 banner.
  Keyboard-selectable with `1`/`2`/`3` and arrows.
- **Boss warning** — a full-width band that slides in with the boss's name.
- **Title screen** — vertical hanja title, three character cards with a live 3D preview of the
  chibi model rotating in a small dedicated render target.
- **Result screen** — 승천/좌화 banner, time survived, kills, level reached, final loadout
  grid, seed, and a restart button.

---

## 13. File Structure

```
3D게임/
  index.html
  package.json
  vite.config.js
  styles/
    hud.css
  src/
    main.js
    core/      Game.js  Time.js  Input.js  SpatialHash.js  Pool.js  RNG.js  Events.js
    world/     Scene.js  Camera.js  Terrain.js  Sky.js
    art/       faces.js  ChibiBuilder.js  enemyGeometry.js  materials.js  vfx.js
    entities/  Player.js  EnemyManager.js  ProjectileManager.js  PickupManager.js  BossManager.js
    combat/    WeaponSystem.js  Stats.js  damage.js  upgrades.js
               weapons/  flyingSword.js  fireTalisman.js  thunderOrb.js  frostPalm.js
                         baguaArray.js  vajra.js  spiritButterfly.js  skyThunder.js
                         myriadSwords.js  infernoSea.js  violetThunder.js  frozenSky.js
    data/      characters.js  weapons.js  passives.js  enemies.js  waves.js  realms.js  validate.js
    ui/        Hud.js  LevelUpModal.js  TitleScreen.js  ResultScreen.js  OverlayCanvas.js  icons.js
  test/        stats.test.js  spatialHash.test.js  pool.test.js  upgrades.test.js
               rng.test.js  waves.test.js  damage.test.js
  docs/superpowers/specs/
```

**Dependency direction.** `data/` depends on nothing. `core/` depends on nothing. `combat/`
depends on `core/` + `data/`. `entities/` depends on `core/` + `combat/` + `art/`. `ui/` depends
on `data/` and reads state via `Events`. `world/` depends on `art/`. `Game.js` is the only
module that wires them together. No module reaches "upward"; there are no import cycles.

---

## 14. Error Handling

- **No WebGL2** — `Scene.js` detects this at boot and renders a styled fallback panel with the
  reason instead of a black screen.
- **Frame loop** — wrapped in `try/catch`. An uncaught error stops the loop, logs the stack, and
  shows an error panel with the message and seed rather than freezing silently.
- **Data validation** — `data/validate.js` runs at boot in dev mode and throws with a precise
  message if any weapon references a nonexistent `pairPassive`/`evolvesTo`, any wave references
  an unknown enemy id, the wave timeline has a gap or is non-monotonic, or a weapon has the
  wrong number of level entries.
- **Pool exhaustion** — silently drops the spawn and increments a counter shown in the debug
  overlay (`F3`). Never allocates during the run.
- **Tab visibility** — `visibilitychange` auto-pauses, and the accumulator clamp prevents a
  catch-up spiral on return.

---

## 15. Testing

Vitest, node environment, no DOM or WebGL required. Only pure logic is tested:

| File | Covers |
|---|---|
| `stats.test.js` | Additive vs multiplicative rules; cooldown floor clamp; maxHp changes preserve HP fraction; character traits applied |
| `spatialHash.test.js` | Query results match brute-force over randomized point sets; negative coordinates; empty grid; radius spanning many cells |
| `pool.test.js` | acquire/release keeps the live range dense; `-1` at capacity; released indices are reusable; no leaks over 10k cycles |
| `upgrades.test.js` | Never offers a maxed item; respects the 6+6 slot caps; offers an evolution when conditions are met; falls back to consumables when the pool is empty; always returns exactly 3 distinct choices |
| `rng.test.js` | Same seed → same sequence; different seeds diverge; output stays in [0,1) |
| `waves.test.js` | Timeline is monotonic, gapless, covers 0→900; every enemy id exists; boss entries at 480 and 900 |
| `damage.test.js` | Crit math; `might` scaling; damage floor of 1; knockback scales with resist |

Visual/perf verification is manual: run `npm run dev`, play a run, and confirm with the `F3`
debug overlay that FPS holds at 60 with 500+ live enemies.

---

## 16. Controls

| Key | Action |
|---|---|
| `W A S D` / arrows | 이동 |
| — | 공격은 전부 자동 |
| `Space` | 축지법 (대시, 무적 프레임) |
| `P` / `Esc` | 일시정지 |
| `1` `2` `3` | 캐릭터 선택 / 업그레이드 선택 |
| `Enter` | 확인 |
| `F3` | 디버그 오버레이 (FPS, 엔티티 수, 드로우콜) |
