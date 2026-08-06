import * as THREE from 'three'
import { Pool } from '../core/Pool.js'
import { SpatialHash } from '../core/SpatialHash.js'
import { rollDamage, knockbackImpulse } from '../combat/damage.js'
import { ENEMIES, ENEMY_INDEX, scaledDamage, scaledHp, scaledXp } from '../data/enemies.js'
import { waveAt } from '../data/waves.js'
import { FORMATIONS, formationAngles, formationType } from '../data/formations.js'
import { rosterFor } from '../data/stages.js'
import { TRIAL } from '../data/trials.js'
import { buildEnemyGeometry } from '../art/enemyGeometry.js'
import { makeToonMaterial } from '../art/materials.js'
import { uploadInstances } from '../art/instancing.js'
import { ARENA_RADIUS } from '../world/Terrain.js'

export const MAX_ENEMIES = 900

/** Enemy defs keyed by id, for `formationType`. */
const ENEMY_BY_ID = Object.fromEntries(ENEMIES.map((e) => [e.id, e]))

const CELL_SIZE = 4
const SEPARATION_STRENGTH = 14
const MAX_NEIGHBOURS = 12
// Exact spacing is only readable near the player. The outer ring keeps its
// steering but skips the neighbour query that causes late-wave CPU spikes.
const SEPARATION_RANGE = 18
const KNOCKBACK_DECAY = 6
const CONTACT_COOLDOWN = 0.5
const BURN_TICK = 0.5
/**
 * Enemies further than this many view-radii from the player are brought round to
 * the front — see `_recycle`. Horde size is bounded by the wave table alone, so
 * this no longer doubles as a population cap.
 */
const DESPAWN_FACTOR = 1.7

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()
/** Scratch for `_entryPoint`, which runs once per spawn and once per recycle. */
const _entry = { x: 0, z: 0 }

/**
 * How far out enemies enter, as a fraction of the view radius.
 *
 * This is the quietest of the balance levers and the most structural. At 1.0 an
 * enemy appears 29 units away, and the 결계 is only 36 — so "just off screen"
 * was in practice the far rim of the whole arena. A 마기 잔영 at speed 2.4 needs
 * twelve seconds to cross that against a player standing still, and never
 * crosses it against one who is moving at 5.7. That is why a run could hold a
 * hundred live enemies and still report no threat: they were a tail, not a ring.
 *
 * 0.75 was measured, not guessed. Over four fresh-save runs each, against the
 * shipped table:
 *
 *   ring   1.00   survived 251 s avg, 86% of minutes with no threat
 *   ring   0.75   survived 290 s avg, 43%
 *   ring   0.55   survived 216 s avg, 50%
 *   ring   0.40   survived 227 s avg, 50%
 *
 * Below 0.75 it stops buying anything and starts costing survival, because
 * enemies arrive before the opening 법보 can thin them. Paired with the denser
 * opening in `waves.js` it takes a first run from 251 s to 351 s while halving
 * the dead minutes, and it leaves a maxed 단전 alone: 820 and 814 s against 821
 * and 817 shipped.
 *
 * Held in an object so `src/dev/balanceProbe.js` can sweep it against a real run
 * rather than against a copy of the module.
 */
export const SPAWN_RING = { mul: 0.75 }

/**
 * The horde.
 *
 * Enemies live in parallel typed arrays with one InstancedMesh per type, so a
 * 500+ crowd costs a handful of draw calls and no per-entity objects. All
 * neighbour queries go through a spatial hash rebuilt each tick.
 *
 * This module never imports the projectile, pickup, or UI layers — it reports
 * outward through callbacks so the dependency graph stays acyclic.
 */
export class EnemyManager {
  constructor(scene, rng) {
    this.scene = scene
    this.rng = rng
    this.pool = new Pool(MAX_ENEMIES)
    this.grid = new SpatialHash(CELL_SIZE)
    this.killCount = 0
    this.spawnTimer = 0
    /** Index of the next 진 to fire; formations are ordered by time. */
    this._nextFormation = 0

    // Reported outward; wired up by Game.
    this.onKill = null
    this.onFormation = null
    this.onDamageText = null
    // Fired at the point of contact, separately from the damage number, so the
    // impact can be drawn where the blow actually landed.
    this.onHit = null
    this.onEnemyShot = null
    // Fired when a charger starts its wind-up, so the tell can be drawn.
    this.onTelegraph = null
    // The boss is a single detailed object, not a pooled entity, so area damage
    // has to consider it separately. Set by Game; null when no boss is alive.
    this.boss = null

    this.px = new Float32Array(MAX_ENEMIES)
    this.pz = new Float32Array(MAX_ENEMIES)
    this.prevX = new Float32Array(MAX_ENEMIES)
    this.prevZ = new Float32Array(MAX_ENEMIES)
    this.vx = new Float32Array(MAX_ENEMIES)
    this.vz = new Float32Array(MAX_ENEMIES)
    this.hp = new Float32Array(MAX_ENEMIES)
    this.maxHp = new Float32Array(MAX_ENEMIES)
    this.type = new Uint8Array(MAX_ENEMIES)
    this.scale = new Float32Array(MAX_ENEMIES)
    this.facing = new Float32Array(MAX_ENEMIES)
    this.slowT = new Float32Array(MAX_ENEMIES)
    this.slowAmt = new Float32Array(MAX_ENEMIES)
    /**
     * Per-instance speed multiplier, 1 for everything that walks in normally.
     *
     * Only 진 members carry anything else. The roster is deliberately slower
     * than the player — the note on `scaledHp` explains why, and it is right:
     * a horde that outruns her deletes the kiting the whole game is built on.
     * But taken absolutely it also means nothing can ever close on a player who
     * is simply leaving, and the numbers say so. She starts at 5.7 and a bought
     * 단전 puts her at 6.6, while the fastest thing in the table is 재까마귀 at
     * 5.4 and every elite is a tank at 1.3 to 3.4. Measured on a maxed save,
     * minutes five through eleven ran at zero contact even with rings of elites
     * dropped nine units away: they were still walking when she left.
     *
     * A 진 is an ambush rather than a chase, so its members get to move like one.
     */
    this.haste = new Float32Array(MAX_ENEMIES).fill(1)
    this.freezeT = new Float32Array(MAX_ENEMIES)
    this.burnT = new Float32Array(MAX_ENEMIES)
    this.burnDps = new Float32Array(MAX_ENEMIES)
    this.burnTick = new Float32Array(MAX_ENEMIES)
    this.hitCd = new Float32Array(MAX_ENEMIES)
    this.stateT = new Float32Array(MAX_ENEMIES)
    this.dashT = new Float32Array(MAX_ENEMIES)
    this.flash = new Float32Array(MAX_ENEMIES)
    this.canSplit = new Uint8Array(MAX_ENEMIES)
    // Signed flank offset, and the locked direction of a committed charge.
    this.orbit = new Float32Array(MAX_ENEMIES)
    this.chargeX = new Float32Array(MAX_ENEMIES)
    this.chargeZ = new Float32Array(MAX_ENEMIES)
    this.damage = new Float32Array(MAX_ENEMIES)
    this.xpValue = new Float32Array(MAX_ENEMIES)

    this._queryOut = new Int32Array(256)
    this._neighbours = new Int32Array(64)

    // Footprint per type, for the contact-shadow layer.
    this.typeRadius = Float32Array.from(ENEMIES, (def) => def.radius)

    // Per-creature animation phase, so a crowd of one type does not breathe in
    // unison. Written once at spawn and packed into the instanced attribute
    // during render, because the pool index and the draw index differ.
    this.animPhase = new Float32Array(MAX_ENEMIES)
    this.animBuffers = []

    this.meshes = []
    ENEMIES.forEach((def) => {
      const geo = buildEnemyGeometry(def.id)
      // (phase, movement) per instance, consumed by the vertex shader.
      const anim = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ENEMIES * 2), 2)
      anim.setUsage(THREE.DynamicDrawUsage)
      geo.setAttribute('aAnim', anim)
      this.animBuffers.push(anim)
      // Colour lives in the geometry's vertex colours, so instanceColor is a
      // pure tint (white = untinted) rather than the creature's base colour.
      const mesh = new THREE.InstancedMesh(
        geo,
        // Rim is deliberately weak and neutral: it is added on top of the shaded
        // colour, so a strong tinted rim washes every creature toward that tint.
        makeToonMaterial({
          color: 0xffffff, rim: 0.16, rimColor: 0xdce8ff,
          vertexColors: true, creatureAnim: true,
        }),
        MAX_ENEMIES,
      )
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.count = 0
      scene.add(mesh)
      this.meshes.push(mesh)
    })
    // No inverted-hull outline on enemies: the creatures are merged from many
    // overlapping parts and so are not watertight, which lets an inner part's
    // inflated back-faces land in front and swallow the whole model. The baked
    // vertex colours carry the silhouette on their own.
    // Per-type index lists, rebuilt each frame into preallocated buffers.
    this.typeLists = ENEMIES.map(() => new Int32Array(MAX_ENEMIES))
    this.typeCounts = new Int32Array(ENEMIES.length)
    // Whether a type had any tinted instance last frame; drives colour uploads.
    this._colorDirty = ENEMIES.map(() => true)
  }

  get liveCount() {
    return this.pool.count
  }

  /** Compact tactical readout for the DOM radar. The full horde stays in GPU
   * instancing; only nearby threat positions cross the UI boundary. */
  radarSnapshot(x, z, radius = 28, limit = 96) {
    const radius2 = radius * radius
    const points = []
    for (let i = 0; i < this.pool.count && points.length < limit; i++) {
      const dx = this.px[i] - x
      const dz = this.pz[i] - z
      if (dx * dx + dz * dz > radius2) continue
      const def = ENEMIES[this.type[i]]
      points.push({
        x: dx / radius,
        z: dz / radius,
        elite: Boolean(def.elite),
        ranged: def.behavior === 'ranged',
      })
    }
    return points
  }

  /** Copy every parallel array from one slot to another. */
  _moveSlot(from, to) {
    this.px[to] = this.px[from]; this.pz[to] = this.pz[from]
    this.prevX[to] = this.prevX[from]; this.prevZ[to] = this.prevZ[from]
    this.vx[to] = this.vx[from]; this.vz[to] = this.vz[from]
    this.hp[to] = this.hp[from]; this.maxHp[to] = this.maxHp[from]
    this.type[to] = this.type[from]; this.scale[to] = this.scale[from]
    this.facing[to] = this.facing[from]
    this.slowT[to] = this.slowT[from]; this.slowAmt[to] = this.slowAmt[from]
    this.haste[to] = this.haste[from]
    this.freezeT[to] = this.freezeT[from]
    this.burnT[to] = this.burnT[from]; this.burnDps[to] = this.burnDps[from]
    this.burnTick[to] = this.burnTick[from]
    this.hitCd[to] = this.hitCd[from]; this.stateT[to] = this.stateT[from]
    this.dashT[to] = this.dashT[from]; this.flash[to] = this.flash[from]
    this.canSplit[to] = this.canSplit[from]
    this.damage[to] = this.damage[from]; this.xpValue[to] = this.xpValue[from]
  }

  _release(i) {
    this.pool.release(i)
    const moved = this.pool.lastSwappedFrom
    if (moved !== -1) this._moveSlot(moved, i)
  }

  spawn(enemyId, x, z, runTime, scaleMul = 1, hpMul = 1, haste = 1) {
    const t = ENEMY_INDEX.get(enemyId)
    if (t === undefined) return -1
    const i = this.pool.acquire()
    if (i === -1) return -1

    const def = ENEMIES[t]
    const minutes = runTime / 60
    this.px[i] = x; this.pz[i] = z
    this.prevX[i] = x; this.prevZ[i] = z
    this.vx[i] = 0; this.vz[i] = 0
    this.maxHp[i] = scaledHp(def, minutes) * hpMul * (this.stage?.hpScale ?? 1)
    this.hp[i] = this.maxHp[i]
    this.type[i] = t
    this.scale[i] = def.scale * scaleMul
    this.facing[i] = 0
    this.slowT[i] = 0; this.slowAmt[i] = 0; this.freezeT[i] = 0
    this.haste[i] = haste
    this.burnT[i] = 0; this.burnDps[i] = 0; this.burnTick[i] = 0
    this.hitCd[i] = 0
    this.stateT[i] = this.rng.next() * 3
    this.animPhase[i] = this.rng.next() * Math.PI * 2
    // Half the pack goes left, half right, with varied commitment.
    this.orbit[i] = (this.rng.next() < 0.5 ? -1 : 1) * (0.55 + this.rng.next() * 0.45)
    this.chargeX[i] = 0
    this.chargeZ[i] = 0
    this.dashT[i] = 0
    this.flash[i] = 0
    this.canSplit[i] = def.behavior === 'splitter' && scaleMul >= 1 ? 1 : 0
    this.damage[i] = scaledDamage(def, minutes)
    this.xpValue[i] = scaledXp(def, minutes) * (scaleMul >= 1 ? 1 : 0.5)
    return i
  }

  queryNear(x, z, radius, out) {
    return this.grid.query(x, z, radius, out)
  }

  freeze(i, duration) {
    this.freezeT[i] = Math.max(this.freezeT[i], duration)
    this.slowAmt[i] = 0.95
    this.slowT[i] = Math.max(this.slowT[i], duration)
  }

  applySlow(i, amount, duration) {
    if (amount >= this.slowAmt[i]) this.slowAmt[i] = amount
    this.slowT[i] = Math.max(this.slowT[i], duration)
  }

  applyBurn(i, dps, duration) {
    this.burnDps[i] = Math.max(this.burnDps[i], dps)
    this.burnT[i] = Math.max(this.burnT[i], duration)
  }

  /** Damage one enemy by index. Returns true if it died. */
  damageOne(i, rawDamage, tag, stats, opts = {}) {
    if (!this.pool.isAlive(i)) return false
    const { amount, crit } = rollDamage(rawDamage, stats, tag, this.rng)
    this.hp[i] -= amount
    this.flash[i] = 1

    if (this.onDamageText) {
      this.onDamageText(this.px[i], 1.0 * this.scale[i], this.pz[i], amount, crit)
    }
    if (this.onHit) {
      // Power scales with how big a bite this took out of the target, so a
      // chip tick and a killing blow do not throw the same shower.
      const power = 0.6 + Math.min(1, amount / Math.max(1, this.maxHp[i])) * 1.4
      this.onHit(this.px[i], this.pz[i], tag, crit, opts.dirX ?? 0, opts.dirZ ?? 0, power)
    }

    const kb = opts.knockback ?? 0
    if (kb > 0) {
      const def = ENEMIES[this.type[i]]
      const dx = opts.dirX ?? 0
      const dz = opts.dirZ ?? 0
      const len = Math.hypot(dx, dz) || 1
      const force = knockbackImpulse(kb, def.kbResist)
      this.vx[i] += (dx / len) * force
      this.vz[i] += (dz / len) * force
    }

    if (this.hp[i] <= 0) {
      this._kill(i)
      return true
    }
    return false
  }

  /** Damage everything within `radius`. Returns how many were hit. */
  damageAt(x, z, radius, rawDamage, tag, stats, opts = {}) {
    const n = this.grid.query(x, z, radius, this._queryOut)
    const r2 = radius * radius
    let hits = 0
    // Collect first: killing mid-iteration compacts the pool and shuffles indices.
    const victims = this._neighbours
    let count = 0
    for (let k = 0; k < n && count < victims.length; k++) {
      const i = this._queryOut[k]
      if (!this.pool.isAlive(i)) continue
      const dx = this.px[i] - x
      const dz = this.pz[i] - z
      if (dx * dx + dz * dz > r2) continue
      victims[count++] = i
    }
    // Descending order so a swap-with-last release never invalidates a pending index.
    for (let k = 0; k < count; k++) {
      for (let j = k + 1; j < count; j++) {
        if (victims[j] > victims[k]) { const t = victims[k]; victims[k] = victims[j]; victims[j] = t }
      }
    }
    for (let k = 0; k < count; k++) {
      const i = victims[k]
      if (!this.pool.isAlive(i)) continue
      opts.dirX = this.px[i] - x
      opts.dirZ = this.pz[i] - z
      this.damageOne(i, rawDamage, tag, stats, opts)
      hits++
    }

    if (this.boss && this.boss.active) {
      const bdx = this.boss.x - x
      const bdz = this.boss.z - z
      const reach = radius + this.boss.radius
      if (bdx * bdx + bdz * bdz <= reach * reach) {
        this.boss.damage(rawDamage, tag, stats)
        hits++
      }
    }
    return hits
  }

  _kill(i) {
    const def = ENEMIES[this.type[i]]
    const x = this.px[i]
    const z = this.pz[i]
    const xp = this.xpValue[i]
    const wasFrozen = this.freezeT[i] > 0
    const splits = this.canSplit[i] ? (def.splitInto ?? 0) : 0

    this.killCount++
    this._release(i)

    if (this.onKill) this.onKill(x, z, xp, def, wasFrozen)
    for (let s = 0; s < splits; s++) {
      const a = this.rng.angle()
      this.spawn(def.id, x + Math.cos(a) * 0.6, z + Math.sin(a) * 0.6, this.runTime ?? 0, 0.6, 0.5)
    }
  }

  /** Clear everything currently on screen — the 정화부 consumable. */
  purgeOnScreen(camera, playerX, playerZ, stats) {
    const r = camera.viewRadius
    for (let i = this.pool.count - 1; i >= 0; i--) {
      const dx = this.px[i] - playerX
      const dz = this.pz[i] - playerZ
      if (dx * dx + dz * dz <= r * r) this.damageOne(i, 99999, 'array', stats, {})
    }
  }

  /**
   * Where a newcomer should appear: just past the view edge, usually in front of
   * the player. Shared by spawning and recycling so a recycled enemy is
   * indistinguishable from a fresh one.
   */
  _entryPoint(player, camera, out) {
    const ring = (camera.viewRadius + 2) * SPAWN_RING.mul
    const moveAngle = Math.atan2(player.x - player.prevX, player.z - player.prevZ)
    let a = this.rng.angle()
    if (this.rng.chance(0.6) && (player.x !== player.prevX || player.z !== player.prevZ)) {
      a = moveAngle + this.rng.range(-0.9, 0.9)
    }
    let x = player.x + Math.sin(a) * ring
    let z = player.z + Math.cos(a) * ring
    const d = Math.hypot(x, z)
    if (d > ARENA_RADIUS - 2) {
      const k = (ARENA_RADIUS - 2) / d
      x *= k
      z *= k
    }
    out.x = x
    out.z = z
  }

  /**
   * Bring an enemy that has fallen far behind round to the front rather than
   * deleting it. An enemy the player fought her way past is pressure she earned;
   * throwing it away spends the wave table's budget on nothing.
   *
   * Be clear about how little this currently does. The trigger is
   * `viewRadius * DESPAWN_FACTOR` = 46.4 units, and the whole arena is 36 across
   * its radius, so almost nothing ever gets far enough away: measured over five
   * minutes of a real run, this fires twice. The release it replaced was equally
   * inert, which means the old comment here — that it capped horde size — was
   * simply not true of the shipped game.
   *
   * So this is a correctness fix, not a difficulty one. The reason the game has
   * no difficulty curve lies elsewhere and is still open: enemies enter at the
   * view edge, 29 units out, against a player who starts at 5.2 and climbs, and
   * a maxed 팔괘진 holds a kill ring at three to four units that almost nothing
   * crosses. Danger exposure sits at zero for eleven of fifteen minutes and her
   * health never drops below 89 percent. Raising enemy HP eightfold and enemy
   * speed twofold each moved that by nothing at all.
   */
  _recycle(i, player, camera) {
    this._entryPoint(player, camera, _entry)
    this.px[i] = _entry.x
    this.pz[i] = _entry.z
    this.prevX[i] = _entry.x
    this.prevZ[i] = _entry.z
    // Behaviours key off `stateT` for dashes, charges and ramps. Arriving
    // mid-windup would fire an attack out of nowhere.
    this.stateT[i] = 0
    this.hitCd[i] = 0
  }

  /**
   * Fire any 진 whose time has passed since the last tick.
   *
   * Independent of the wave table — a formation is on top of the drizzle, not
   * instead of it, so the average pressure the table encodes is preserved and
   * only its texture changes.
   */
  _spawnFormations(runTime, player) {
    while (this._nextFormation < FORMATIONS.length && FORMATIONS[this._nextFormation].t <= runTime) {
      const f = FORMATIONS[this._nextFormation++]
      // A 진 still has to be made of things that belong in this 비경, or the
      // stage rosters stop meaning anything — but the substitute has to be the
      // toughest thing the 비경 allows, not the first. See `formationType`.
      const type = formationType(f.type, this.stage?.roster, ENEMY_BY_ID)
      // Orient to where she is going, so a wall is the thing she was running
      // toward rather than a surprise behind her.
      const moving = player.x !== player.prevX || player.z !== player.prevZ
      const facing = moving
        ? Math.atan2(player.x - player.prevX, player.z - player.prevZ)
        : this.rng.angle()
      for (const a of formationAngles(f.kind, f.count, facing, f.arc)) {
        let x = player.x + Math.sin(a) * f.radius
        let z = player.z + Math.cos(a) * f.radius
        const d = Math.hypot(x, z)
        if (d > ARENA_RADIUS - 2) {
          const k = (ARENA_RADIUS - 2) / d
          x *= k
          z *= k
        }
        this.spawn(type, x, z, runTime, 1, 1, f.haste ?? 1)
      }
      if (this.onFormation) this.onFormation(f)
    }
  }

  _spawnWave(dt, runTime, player, camera) {
    const band = waveAt(runTime)
    // The stage narrows which enemies a band may draw, so each 비경 fights
    // differently without needing its own wave table.
    const wave = this.stage
      ? { ...band, types: rosterFor(this.stage, band.types ?? []) }
      : band
    if (!wave.types || wave.types.length === 0) return
    this.spawnTimer -= dt
    if (this.spawnTimer > 0) return
    this.spawnTimer += wave.spawnInterval

    // 시련 raises the count rather than shortening the interval, so the pulse
    // rhythm the table encodes survives the tier.
    const perSpawn = Math.round(wave.perSpawn * TRIAL.density)
    for (let n = 0; n < perSpawn; n++) {
      this._entryPoint(player, camera, _entry)
      this.spawn(this.rng.pick(wave.types), _entry.x, _entry.z, runTime)
    }
  }

  update(dt, runTime, player, camera) {
    this.runTime = runTime
    this._spawnWave(dt, runTime, player, camera)
    this._spawnFormations(runTime, player)

    // Rebuild the broadphase from the live set.
    this.grid.clear()
    for (let i = 0; i < this.pool.count; i++) this.grid.insert(i, this.px[i], this.pz[i])

    const despawnR2 = (camera.viewRadius * DESPAWN_FACTOR) ** 2

    for (let i = this.pool.count - 1; i >= 0; i--) {
      const def = ENEMIES[this.type[i]]
      this.prevX[i] = this.px[i]
      this.prevZ[i] = this.pz[i]

      if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - dt * 4)
      if (this.hitCd[i] > 0) this.hitCd[i] -= dt
      if (this.slowT[i] > 0) {
        this.slowT[i] -= dt
        if (this.slowT[i] <= 0) { this.slowAmt[i] = 0; this.freezeT[i] = 0 }
      }
      if (this.freezeT[i] > 0) this.freezeT[i] -= dt

      if (this.burnT[i] > 0) {
        this.burnT[i] -= dt
        this.burnTick[i] -= dt
        if (this.burnTick[i] <= 0) {
          this.burnTick[i] += BURN_TICK
          this.hp[i] -= this.burnDps[i] * BURN_TICK
          if (this.hp[i] <= 0) { this._kill(i); continue }
        }
      }

      const dx = player.x - this.px[i]
      const dz = player.z - this.pz[i]
      const dist = Math.hypot(dx, dz) || 1

      if (dist * dist > despawnR2) { this._recycle(i, player, camera); continue }

      let speed = def.speed * TRIAL.speed * this.haste[i] * (1 - this.slowAmt[i])
      this.stateT[i] += dt

      // Steering direction, normalised. Straight at the player unless a
      // behaviour below turns it: everything used to beeline, which made twelve
      // creature types move identically and made a crowd a wall rather than
      // something with a shape to read.
      let mx = dx / dist
      let mz = dz / dist

      if (def.behavior === 'dasher') {
        const interval = def.dashInterval ?? 4
        if (this.dashT[i] > 0) {
          this.dashT[i] -= dt
          // 2.2x, not 3x: at 3x a 요랑 outruns the player outright and there is
          // no counterplay except being somewhere else already.
          speed *= 2.2
        } else if (this.stateT[i] >= interval) {
          this.stateT[i] = 0
          this.dashT[i] = 0.5
        }
      } else if (def.behavior === 'flanker') {
        // Curve in rather than converge. The arc is widest far out and unwinds
        // to nothing at the kill distance, so a pack spreads around the player
        // on the approach and still commits at the end. Each creature keeps its
        // own signed offset, so they take opposite sides instead of queueing.
        const closeR = def.flankClose ?? 4
        const spread = def.flankSpread ?? 12
        const t = Math.min(1, Math.max(0, (dist - closeR) / spread))
        const arc = this.orbit[i] * t * (def.flankArc ?? 1.15)
        const c = Math.cos(arc)
        const s = Math.sin(arc)
        mx = (dx / dist) * c - (dz / dist) * s
        mz = (dx / dist) * s + (dz / dist) * c
      } else if (def.behavior === 'charger') {
        // Wind up in place, then commit to a straight line. The tell is the
        // whole point: a fast enemy with no warning is unfair, and the same
        // enemy with half a second of warning is a dodge the player earns.
        const windup = def.chargeWindup ?? 0.55
        const runFor = def.chargeTime ?? 0.6
        if (this.dashT[i] > 0) {
          this.dashT[i] -= dt
          speed *= def.chargeSpeed ?? 3.4
          mx = this.chargeX[i]
          mz = this.chargeZ[i]
        } else if (this.stateT[i] >= (def.chargeInterval ?? 3.2)) {
          if (this.stateT[i] < (def.chargeInterval ?? 3.2) + windup) {
            speed = 0
            if (this.onTelegraph && this.stateT[i] - dt < (def.chargeInterval ?? 3.2)) {
              this.onTelegraph(this.px[i], this.pz[i], dx / dist, dz / dist, windup)
            }
          } else {
            this.stateT[i] = 0
            this.dashT[i] = runFor
            this.chargeX[i] = dx / dist
            this.chargeZ[i] = dz / dist
          }
        }
      } else if (def.behavior === 'drifter') {
        // Wanders in on a slow weave instead of tracking. A remnant of 마기 is
        // not chasing anybody — and a cloud of them arriving on different
        // curves is a shape the player can slip between, where a cloud of
        // straight-line chasers is just a wall.
        const weave = Math.sin(this.stateT[i] * (def.driftRate ?? 1.5) + this.animPhase[i])
          * (def.driftArc ?? 0.7)
        const c = Math.cos(weave)
        const s = Math.sin(weave)
        mx = (dx / dist) * c - (dz / dist) * s
        mz = (dx / dist) * s + (dz / dist) * c
      } else if (def.behavior === 'flicker') {
        // Darts and stalls. A spark does not travel at a constant rate, and the
        // stalls are what make 화정 dodgeable despite being faster than she is.
        const beat = Math.sin(this.stateT[i] * (def.flickerRate ?? 4.5) + this.animPhase[i])
        speed *= beat > 0 ? 1.7 : 0.25
      } else if (def.behavior === 'lumberer') {
        // Builds momentum the longer it has been walking. A heavy that moves at
        // one speed forever is furniture the player strolls around; one that is
        // slow to start and hard to shake once it is moving has to be dealt
        // with. Losing sight of the player resets it, which is what makes
        // kiting a real answer rather than a formality.
        const ramp = Math.min(1, this.stateT[i] / (def.rampTime ?? 9))
        speed *= 0.55 + ramp * (def.rampTo ?? 1.05)
        if (dist > (def.loseSight ?? 26)) this.stateT[i] = 0
      } else if (def.behavior === 'skirmisher') {
        // Dive, then peel away before it can be punished. Reads as a bird.
        const backFor = def.skirmishBack ?? 0.55
        if (this.dashT[i] > 0) {
          this.dashT[i] -= dt
          speed = -speed * 0.85
        } else if (dist < (def.skirmishRange ?? 2.2)) {
          this.dashT[i] = backFor
        }
      } else if (def.behavior === 'ranged') {
        const keep = def.keepDistance ?? 10
        if (dist < keep * 0.85) speed = -speed * 0.8
        else if (dist < keep * 1.15) speed = 0
        if (this.stateT[i] >= (def.shootInterval ?? 2.5)) {
          this.stateT[i] = 0
          if (this.onEnemyShot) {
            this.onEnemyShot(
              this.px[i], this.pz[i], dx / dist, dz / dist,
              def.shotDamage ?? 8, def.shotSpeed ?? 9,
            )
          }
        }
      }

      this.px[i] += mx * speed * dt
      this.pz[i] += mz * speed * dt
      // Faces the player even while circling, so a flanker reads as stalking
      // rather than as walking sideways past.
      this.facing[i] = Math.atan2(dx, dz)

      // Knockback velocity, decaying exponentially.
      this.px[i] += this.vx[i] * dt
      this.pz[i] += this.vz[i] * dt
      const decay = Math.exp(-KNOCKBACK_DECAY * dt)
      this.vx[i] *= decay
      this.vz[i] *= decay

      // Separation — without this the horde collapses into one overlapping blob.
      if (dist < SEPARATION_RANGE) {
        const sepR = def.radius * 1.6
        const n = this.grid.query(this.px[i], this.pz[i], sepR, this._neighbours)
        const limit = Math.min(n, MAX_NEIGHBOURS)
        for (let k = 0; k < limit; k++) {
          const j = this._neighbours[k]
          if (j === i || !this.pool.isAlive(j)) continue
          const ox = this.px[i] - this.px[j]
          const oz = this.pz[i] - this.pz[j]
          const d2 = ox * ox + oz * oz
          if (d2 >= sepR * sepR || d2 < 1e-6) continue
          const d = Math.sqrt(d2)
          const push = ((sepR - d) / sepR) * SEPARATION_STRENGTH * dt
          this.px[i] += (ox / d) * push
          this.pz[i] += (oz / d) * push
        }
      }

      // Contact damage.
      if (dist < def.radius + 0.5 && this.hitCd[i] <= 0) {
        if (player.takeDamage(this.damage[i])) this.hitCd[i] = CONTACT_COOLDOWN
      }
    }
  }

  /**
   * `shadows` is optional and is filled from this same loop — the interpolated
   * position is already in hand here, so grounding the horde costs one extra
   * matrix write per creature rather than a second walk over the pool.
   */
  render(alpha, shadows = null) {
    this.typeCounts.fill(0)
    for (let i = 0; i < this.pool.count; i++) {
      const t = this.type[i]
      this.typeLists[t][this.typeCounts[t]++] = i
    }

    for (let t = 0; t < this.meshes.length; t++) {
      const mesh = this.meshes[t]
      const list = this.typeLists[t]
      const count = this.typeCounts[t]
      const animAttr = this.animBuffers[t]
      const anim = animAttr.array

      // Most enemies are their plain base colour most of the time. Re-uploading
      // the whole colour buffer every frame for a handful of tinted instances is
      // wasted bandwidth, so only touch it when a tint is actually in play.
      let colorDirty = this._colorDirty[t]
      let anyTint = false

      for (let k = 0; k < count; k++) {
        const i = list[k]
        const x = this.prevX[i] + (this.px[i] - this.prevX[i]) * alpha
        const z = this.prevZ[i] + (this.pz[i] - this.prevZ[i]) * alpha
        _dummy.position.set(x, 0, z)
        _dummy.rotation.set(0, this.facing[i], 0)
        _dummy.scale.setScalar(this.scale[i])
        _dummy.updateMatrix()
        mesh.setMatrixAt(k, _dummy.matrix)
        if (shadows !== null) shadows.add(x, z, this.typeRadius[t])

        // Movement amount drives how hard the creature strides. Frozen and
        // heavily slowed enemies settle into an idle sway instead, which is a
        // free readability win: a stopped enemy looks stopped.
        const speed = Math.hypot(this.vx[i], this.vz[i])
        anim[k * 2] = this.animPhase[i]
        anim[k * 2 + 1] = Math.min(1, speed / 4)

        const tinted = this.freezeT[i] > 0 || this.slowAmt[i] > 0 || this.flash[i] > 0
        if (tinted) anyTint = true
        if (!tinted && !colorDirty && mesh.instanceColor) continue

        // White multiplies the baked vertex colour through unchanged.
        _color.setRGB(1, 1, 1)
        if (this.freezeT[i] > 0) _color.lerp(FREEZE_TINT, 0.75)
        else if (this.slowAmt[i] > 0) _color.lerp(SLOW_TINT, this.slowAmt[i] * 0.6)
        if (this.flash[i] > 0) _color.lerp(FLASH_TINT, this.flash[i] * 0.9)
        mesh.setColorAt(k, _color)
        colorDirty = true
      }

      // Keep writing for one more frame after the last tint clears, so the
      // instances that were tinted get reset to base.
      this._colorDirty[t] = anyTint

      mesh.count = count
      uploadInstances(mesh, count, colorDirty)

      // Two floats per creature, so a partial upload is worth the bookkeeping
      // for the same reason the matrices get one.
      animAttr.clearUpdateRanges()
      if (count > 0) animAttr.addUpdateRange(0, count * 2)
      animAttr.needsUpdate = count > 0
    }
  }

  /** Advances the crowd's idle and stride motion. Real time, not sim time. */
  setAnimTime(t) {
    for (const m of this.meshes) m.material.userData.time.value = t
  }

  clear() {
    this.pool.clear()
    this.grid.clear()
    this.killCount = 0
    this.spawnTimer = 0
    this._nextFormation = 0
    for (const m of this.meshes) m.count = 0
  }

  dispose() {
    for (const m of this.meshes) {
      m.geometry.dispose()
      m.material.dispose()
      m.removeFromParent()
    }
    this.meshes.length = 0
  }
}

// Multiplied over the baked vertex colours, so these are tints, not colours.
const FLASH_TINT = new THREE.Color(4.5, 4.5, 4.5)
const SLOW_TINT = new THREE.Color(0.55, 0.8, 1.4)
const FREEZE_TINT = new THREE.Color(0.8, 1.25, 1.6)
