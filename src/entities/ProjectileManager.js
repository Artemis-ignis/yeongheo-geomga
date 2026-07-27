import * as THREE from 'three'
import { Pool } from '../core/Pool.js'
import { buildMerged } from '../art/geometry.js'
import { makeToonMaterial } from '../art/materials.js'
import { uploadInstances } from '../art/instancing.js'
import { ARENA_RADIUS } from '../world/Terrain.js'

export const MAX_PROJECTILES = 1200
export const PROJECTILE_KINDS = ['sword', 'talisman', 'vajra', 'butterfly', 'enemyShot', 'darkSword']

const HIT_MEMORY = 8
const RETARGET_INTERVAL = 0.15
/** Sentinel id for the boss in a projectile's already-hit memory. */
const BOSS_ID = -99

const _dummy = new THREE.Object3D()

function kindGeometry(kind) {
  switch (kind) {
    case 'sword':
      return buildMerged([
        [new THREE.BoxGeometry(0.07, 0.6, 0.03), { y: 0.1 }],
        [new THREE.ConeGeometry(0.05, 0.18, 4), { y: 0.49 }],
        [new THREE.BoxGeometry(0.2, 0.04, 0.04), { y: -0.22 }],
      ])
    case 'talisman':
      return buildMerged([
        [new THREE.BoxGeometry(0.26, 0.42, 0.02), {}],
        [new THREE.BoxGeometry(0.06, 0.30, 0.03), { z: 0.02 }],
      ])
    case 'vajra':
      return buildMerged([
        [new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), {}],
        [new THREE.ConeGeometry(0.16, 0.3, 6), { y: 0.38 }],
        [new THREE.ConeGeometry(0.16, 0.3, 6), { y: -0.38, rx: Math.PI }],
      ])
    case 'butterfly':
      return buildMerged([
        [new THREE.PlaneGeometry(0.3, 0.22), { x: -0.14, ry: 0.5 }],
        [new THREE.PlaneGeometry(0.3, 0.22), { x: 0.14, ry: -0.5 }],
        [new THREE.BoxGeometry(0.04, 0.16, 0.04), {}],
      ])
    case 'darkSword':
      return buildMerged([
        [new THREE.BoxGeometry(0.08, 0.7, 0.03), {}],
        [new THREE.ConeGeometry(0.06, 0.2, 4), { y: 0.44 }],
      ])
    default:
      return new THREE.OctahedronGeometry(0.17, 0)
  }
}

const KIND_COLOR = {
  sword: 0xdbe7f2,
  talisman: 0xffb066,
  vajra: 0xf0d78a,
  butterfly: 0xbfe8ff,
  enemyShot: 0x8a5fc4,
  darkSword: 0x9a6fd0,
}

/**
 * Pooled, instanced projectiles.
 *
 * One InstancedMesh per kind sharing a single pool, so a screen full of
 * projectiles costs one draw call per kind. Piercing shots remember the last few
 * enemies they hit so they cannot re-damage the same target on consecutive ticks.
 */
export class ProjectileManager {
  constructor(scene) {
    this.scene = scene
    this.pool = new Pool(MAX_PROJECTILES)
    this.time = 0

    this.px = new Float32Array(MAX_PROJECTILES)
    this.pz = new Float32Array(MAX_PROJECTILES)
    this.prevX = new Float32Array(MAX_PROJECTILES)
    this.prevZ = new Float32Array(MAX_PROJECTILES)
    this.py = new Float32Array(MAX_PROJECTILES)
    this.dirX = new Float32Array(MAX_PROJECTILES)
    this.dirZ = new Float32Array(MAX_PROJECTILES)
    this.speed = new Float32Array(MAX_PROJECTILES)
    this.damage = new Float32Array(MAX_PROJECTILES)
    this.radius = new Float32Array(MAX_PROJECTILES)
    this.pierce = new Int16Array(MAX_PROJECTILES)
    this.life = new Float32Array(MAX_PROJECTILES)
    this.homing = new Float32Array(MAX_PROJECTILES)
    this.knockback = new Float32Array(MAX_PROJECTILES)
    this.kind = new Uint8Array(MAX_PROJECTILES)
    this.tagIndex = new Uint8Array(MAX_PROJECTILES)
    this.hostile = new Uint8Array(MAX_PROJECTILES)
    this.spin = new Float32Array(MAX_PROJECTILES)
    this.retarget = new Float32Array(MAX_PROJECTILES)
    this.hitMem = new Int32Array(MAX_PROJECTILES * HIT_MEMORY).fill(-1)
    this.hitMemNext = new Uint8Array(MAX_PROJECTILES)
    this.onHitIndex = new Int16Array(MAX_PROJECTILES).fill(-1)

    // Per-projectile callbacks are stored out-of-band so the hot arrays stay typed.
    this.callbacks = []
    this.stats = []
    this.tags = []

    this._out = new Int32Array(256)

    this.meshes = PROJECTILE_KINDS.map((kind) => {
      const mesh = new THREE.InstancedMesh(
        kindGeometry(kind),
        makeToonMaterial({ color: KIND_COLOR[kind], rim: 0.9, rimColor: 0xffffff }),
        MAX_PROJECTILES,
      )
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.count = 0
      scene.add(mesh)
      return mesh
    })
    this.typeLists = PROJECTILE_KINDS.map(() => new Int32Array(MAX_PROJECTILES))
    this.typeCounts = new Int32Array(PROJECTILE_KINDS.length)
  }

  get liveCount() {
    return this.pool.count
  }

  _moveSlot(from, to) {
    this.px[to] = this.px[from]; this.pz[to] = this.pz[from]
    this.prevX[to] = this.prevX[from]; this.prevZ[to] = this.prevZ[from]
    this.py[to] = this.py[from]
    this.dirX[to] = this.dirX[from]; this.dirZ[to] = this.dirZ[from]
    this.speed[to] = this.speed[from]; this.damage[to] = this.damage[from]
    this.radius[to] = this.radius[from]; this.pierce[to] = this.pierce[from]
    this.life[to] = this.life[from]; this.homing[to] = this.homing[from]
    this.knockback[to] = this.knockback[from]; this.kind[to] = this.kind[from]
    this.hostile[to] = this.hostile[from]; this.spin[to] = this.spin[from]
    this.retarget[to] = this.retarget[from]
    this.hitMemNext[to] = this.hitMemNext[from]
    for (let k = 0; k < HIT_MEMORY; k++) {
      this.hitMem[to * HIT_MEMORY + k] = this.hitMem[from * HIT_MEMORY + k]
    }
    this.callbacks[to] = this.callbacks[from]
    this.stats[to] = this.stats[from]
    this.tags[to] = this.tags[from]
  }

  _release(i) {
    this.callbacks[i] = null
    this.stats[i] = null
    this.pool.release(i)
    const moved = this.pool.lastSwappedFrom
    if (moved !== -1) this._moveSlot(moved, i)
  }

  spawn(kind, opts) {
    const i = this.pool.acquire()
    if (i === -1) return -1
    const k = PROJECTILE_KINDS.indexOf(kind)

    const len = Math.hypot(opts.dirX ?? 0, opts.dirZ ?? 1) || 1
    this.px[i] = opts.x; this.pz[i] = opts.z
    this.prevX[i] = opts.x; this.prevZ[i] = opts.z
    this.py[i] = opts.y ?? 0.9
    this.dirX[i] = (opts.dirX ?? 0) / len
    this.dirZ[i] = (opts.dirZ ?? 1) / len
    this.speed[i] = opts.speed ?? 12
    this.damage[i] = opts.damage ?? 1
    this.radius[i] = opts.radius ?? 0.6
    this.pierce[i] = opts.pierce ?? 0
    this.life[i] = opts.life ?? 4
    this.homing[i] = opts.homing ?? 0
    this.knockback[i] = opts.knockback ?? 0
    this.kind[i] = k < 0 ? 0 : k
    this.hostile[i] = opts.hostile ? 1 : 0
    this.spin[i] = opts.spin ?? 0
    this.retarget[i] = 0
    this.hitMemNext[i] = 0
    for (let m = 0; m < HIT_MEMORY; m++) this.hitMem[i * HIT_MEMORY + m] = -1
    this.callbacks[i] = opts.onHit ?? null
    this.stats[i] = opts.stats ?? null
    this.tags[i] = opts.tag ?? 'array'
    return i
  }

  _remembersHit(i, enemyIndex) {
    const base = i * HIT_MEMORY
    for (let k = 0; k < HIT_MEMORY; k++) if (this.hitMem[base + k] === enemyIndex) return true
    return false
  }

  _rememberHit(i, enemyIndex) {
    const slot = this.hitMemNext[i] % HIT_MEMORY
    this.hitMem[i * HIT_MEMORY + slot] = enemyIndex
    this.hitMemNext[i] = (this.hitMemNext[i] + 1) % HIT_MEMORY
  }

  update(dt, enemies, player) {
    this.time += dt
    const boundR2 = (ARENA_RADIUS + 6) ** 2

    for (let i = this.pool.count - 1; i >= 0; i--) {
      this.prevX[i] = this.px[i]
      this.prevZ[i] = this.pz[i]

      this.life[i] -= dt
      if (this.life[i] <= 0) { this._release(i); continue }

      if (this.homing[i] > 0 && !this.hostile[i]) {
        this.retarget[i] -= dt
        if (this.retarget[i] <= 0) {
          // Stagger re-targeting by index so the cost spreads across frames.
          this.retarget[i] = RETARGET_INTERVAL + (i % 7) * 0.01
          const n = enemies.queryNear(this.px[i], this.pz[i], 14, this._out)
          let bestD2 = Infinity
          let bx = 0
          let bz = 0
          for (let k = 0; k < n; k++) {
            const e = this._out[k]
            if (!enemies.pool.isAlive(e)) continue
            const dx = enemies.px[e] - this.px[i]
            const dz = enemies.pz[e] - this.pz[i]
            const d2 = dx * dx + dz * dz
            if (d2 < bestD2) { bestD2 = d2; bx = dx; bz = dz }
          }
          if (bestD2 < Infinity) {
            const d = Math.sqrt(bestD2) || 1
            const tx = bx / d
            const tz = bz / d
            const turn = Math.min(1, this.homing[i] * dt * 8)
            this.dirX[i] += (tx - this.dirX[i]) * turn
            this.dirZ[i] += (tz - this.dirZ[i]) * turn
            const l = Math.hypot(this.dirX[i], this.dirZ[i]) || 1
            this.dirX[i] /= l
            this.dirZ[i] /= l
          }
        }
      }

      this.px[i] += this.dirX[i] * this.speed[i] * dt
      this.pz[i] += this.dirZ[i] * this.speed[i] * dt

      if (this.hostile[i]) {
        const dx = player.x - this.px[i]
        const dz = player.z - this.pz[i]
        if (dx * dx + dz * dz < 0.7 * 0.7) {
          player.takeDamage(this.damage[i])
          this._release(i)
          continue
        }
      } else {
        const n = enemies.queryNear(this.px[i], this.pz[i], this.radius[i], this._out)
        const r2 = this.radius[i] * this.radius[i]
        for (let k = 0; k < n; k++) {
          const e = this._out[k]
          if (!enemies.pool.isAlive(e)) continue
          if (this._remembersHit(i, e)) continue
          const dx = enemies.px[e] - this.px[i]
          const dz = enemies.pz[e] - this.pz[i]
          if (dx * dx + dz * dz > r2) continue

          this._rememberHit(i, e)
          const cb = this.callbacks[i]
          if (cb) {
            cb(this.px[i], this.pz[i], e)
          } else {
            enemies.damageOne(e, this.damage[i], this.tags[i], this.stats[i], {
              knockback: this.knockback[i],
              dirX: this.dirX[i],
              dirZ: this.dirZ[i],
            })
          }
          this.pierce[i]--
          if (this.pierce[i] < 0) break
        }
        if (this.pierce[i] < 0) { this._release(i); continue }

        // The boss lives outside the enemy arrays, so it needs its own test.
        const boss = enemies.boss
        if (boss && boss.active) {
          const bdx = boss.x - this.px[i]
          const bdz = boss.z - this.pz[i]
          const reach = this.radius[i] + boss.radius
          if (bdx * bdx + bdz * bdz <= reach * reach && !this._remembersHit(i, BOSS_ID)) {
            this._rememberHit(i, BOSS_ID)
            boss.damage(this.damage[i], this.tags[i], this.stats[i])
            this.pierce[i]--
            if (this.pierce[i] < 0) { this._release(i); continue }
          }
        }
      }

      // Butterflies wander freely; everything else dies at the barrier.
      if (PROJECTILE_KINDS[this.kind[i]] !== 'butterfly') {
        if (this.px[i] * this.px[i] + this.pz[i] * this.pz[i] > boundR2) { this._release(i); continue }
      }
    }
  }

  render(alpha) {
    this.typeCounts.fill(0)
    for (let i = 0; i < this.pool.count; i++) {
      const k = this.kind[i]
      this.typeLists[k][this.typeCounts[k]++] = i
    }

    for (let k = 0; k < this.meshes.length; k++) {
      const mesh = this.meshes[k]
      const list = this.typeLists[k]
      const count = this.typeCounts[k]
      for (let n = 0; n < count; n++) {
        const i = list[n]
        const x = this.prevX[i] + (this.px[i] - this.prevX[i]) * alpha
        const z = this.prevZ[i] + (this.pz[i] - this.prevZ[i]) * alpha
        _dummy.position.set(x, this.py[i], z)
        // Point along travel; spinning kinds tumble around their own axis.
        _dummy.rotation.set(
          Math.PI / 2,
          Math.atan2(this.dirX[i], this.dirZ[i]),
          this.spin[i] ? this.time * this.spin[i] : 0,
        )
        _dummy.scale.setScalar(1)
        _dummy.updateMatrix()
        mesh.setMatrixAt(n, _dummy.matrix)
      }
      mesh.count = count
      uploadInstances(mesh, count)
    }
  }

  clear() {
    this.pool.clear()
    for (const m of this.meshes) m.count = 0
    this.callbacks.length = 0
    this.stats.length = 0
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
