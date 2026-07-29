import * as THREE from 'three'
import { Pool } from '../core/Pool.js'
import { SpatialHash } from '../core/SpatialHash.js'
import { rollDamage, knockbackImpulse } from '../combat/damage.js'
import { ENEMIES, ENEMY_INDEX, scaledDamage, scaledHp, scaledXp } from '../data/enemies.js'
import { waveAt } from '../data/waves.js'
import { rosterFor } from '../data/stages.js'
import { buildEnemyGeometry } from '../art/enemyGeometry.js'
import { makeToonMaterial } from '../art/materials.js'
import { uploadInstances } from '../art/instancing.js'
import { ARENA_RADIUS } from '../world/Terrain.js'

export const MAX_ENEMIES = 900

const CELL_SIZE = 4
const SEPARATION_STRENGTH = 14
const MAX_NEIGHBOURS = 12
const KNOCKBACK_DECAY = 6
const CONTACT_COOLDOWN = 0.5
const BURN_TICK = 0.5
/**
 * Enemies further than this many view-radii from the player are recycled. It
 * doubles as the natural cap on horde size: without it, everything that ever
 * spawned accumulates on the far side of the arena.
 */
const DESPAWN_FACTOR = 1.7

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()

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

    // Reported outward; wired up by Game.
    this.onKill = null
    this.onDamageText = null
    this.onEnemyShot = null
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
    this.freezeT = new Float32Array(MAX_ENEMIES)
    this.burnT = new Float32Array(MAX_ENEMIES)
    this.burnDps = new Float32Array(MAX_ENEMIES)
    this.burnTick = new Float32Array(MAX_ENEMIES)
    this.hitCd = new Float32Array(MAX_ENEMIES)
    this.stateT = new Float32Array(MAX_ENEMIES)
    this.dashT = new Float32Array(MAX_ENEMIES)
    this.flash = new Float32Array(MAX_ENEMIES)
    this.canSplit = new Uint8Array(MAX_ENEMIES)
    this.damage = new Float32Array(MAX_ENEMIES)
    this.xpValue = new Float32Array(MAX_ENEMIES)

    this._queryOut = new Int32Array(256)
    this._neighbours = new Int32Array(64)

    // Footprint per type, for the contact-shadow layer.
    this.typeRadius = Float32Array.from(ENEMIES, (def) => def.radius)

    this.meshes = []
    ENEMIES.forEach((def) => {
      const geo = buildEnemyGeometry(def.id)
      // Colour lives in the geometry's vertex colours, so instanceColor is a
      // pure tint (white = untinted) rather than the creature's base colour.
      const mesh = new THREE.InstancedMesh(
        geo,
        // Rim is deliberately weak and neutral: it is added on top of the shaded
        // colour, so a strong tinted rim washes every creature toward that tint.
        makeToonMaterial({ color: 0xffffff, rim: 0.16, rimColor: 0xdce8ff, vertexColors: true }),
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

  /** Copy every parallel array from one slot to another. */
  _moveSlot(from, to) {
    this.px[to] = this.px[from]; this.pz[to] = this.pz[from]
    this.prevX[to] = this.prevX[from]; this.prevZ[to] = this.prevZ[from]
    this.vx[to] = this.vx[from]; this.vz[to] = this.vz[from]
    this.hp[to] = this.hp[from]; this.maxHp[to] = this.maxHp[from]
    this.type[to] = this.type[from]; this.scale[to] = this.scale[from]
    this.facing[to] = this.facing[from]
    this.slowT[to] = this.slowT[from]; this.slowAmt[to] = this.slowAmt[from]
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

  spawn(enemyId, x, z, runTime, scaleMul = 1, hpMul = 1) {
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
    this.burnT[i] = 0; this.burnDps[i] = 0; this.burnTick[i] = 0
    this.hitCd[i] = 0
    this.stateT[i] = this.rng.next() * 3
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

    const ring = camera.viewRadius + 2
    // Bias spawns toward where the player is heading so the horde stays engaging.
    const moveAngle = Math.atan2(player.x - player.prevX, player.z - player.prevZ)
    for (let n = 0; n < wave.perSpawn; n++) {
      let a = this.rng.angle()
      if (this.rng.chance(0.6) && (player.x !== player.prevX || player.z !== player.prevZ)) {
        a = moveAngle + this.rng.range(-0.9, 0.9)
      }
      let x = player.x + Math.sin(a) * ring
      let z = player.z + Math.cos(a) * ring
      const d = Math.hypot(x, z)
      if (d > ARENA_RADIUS - 2) {
        const k = (ARENA_RADIUS - 2) / d
        x *= k; z *= k
      }
      this.spawn(this.rng.pick(wave.types), x, z, runTime)
    }
  }

  update(dt, runTime, player, camera) {
    this.runTime = runTime
    this._spawnWave(dt, runTime, player, camera)

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

      if (dist * dist > despawnR2) { this._release(i); continue }

      let speed = def.speed * (1 - this.slowAmt[i])
      this.stateT[i] += dt

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

      this.px[i] += (dx / dist) * speed * dt
      this.pz[i] += (dz / dist) * speed * dt
      this.facing[i] = Math.atan2(dx, dz)

      // Knockback velocity, decaying exponentially.
      this.px[i] += this.vx[i] * dt
      this.pz[i] += this.vz[i] * dt
      const decay = Math.exp(-KNOCKBACK_DECAY * dt)
      this.vx[i] *= decay
      this.vz[i] *= decay

      // Separation — without this the horde collapses into one overlapping blob.
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
    }
  }

  clear() {
    this.pool.clear()
    this.grid.clear()
    this.killCount = 0
    this.spawnTimer = 0
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
