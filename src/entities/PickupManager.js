import * as THREE from 'three'
import { Pool } from '../core/Pool.js'
import { makeToonMaterial, makeAdditiveMaterial } from '../art/materials.js'
import { uploadInstances } from '../art/instancing.js'
import { glowTexture } from '../art/textures.js'

export const MAX_PICKUPS = 1500
export const PICKUP_KINDS = ['qi', 'stone', 'heal', 'chest']

// Compared as numbers in the per-frame loop; string compares over ~1500 pickups
// every frame are pure waste.
const KIND_QI = 0
const KIND_CHEST = 3

const MAGNET_ACCEL = 34
/**
 * The outer pull on 영기: acceleration against drag, so the drift settles at a
 * terminal 14 / 4 = 3.5 u/s against the player's 5.2.
 *
 * Both halves matter. Acceleration alone has no fixed point — at a gentle
 * 4.2 u/s² an orb passes the player's own speed inside two seconds and reaches
 * 15 u/s by the fourth, so every drop on the map turns into a homing missile
 * and the magnet stat stops meaning anything. Drag is what bounds it, and it is
 * chosen over a hard speed clamp because a clamp leaves the momentum pointing
 * the wrong way: a clamped orb overshoots a moving player and orbits her
 * instead of arriving. Measured over four kiting patterns, the clamp collapsed
 * from 99% collection to 39% between top speeds of 3.2 and 3.8, while drag held
 * 98% across every terminal speed from 2.0 to 3.5.
 */
const DRIFT_ACCEL = 14
const DRIFT_DRAG = 4
export const COLLECT_RADIUS = 0.9

/**
 * Advance one drop toward the player for `dt` and report where it ends up.
 *
 * This is the whole motion rule, kept out of the render loop so
 * `test/economy.test.js` drives the same code the game runs, with no GL context
 * and no canvas. That matters here more than anywhere else in the project: a
 * shipped build collected 14% of the 영기 it dropped — 345 earned, 49 picked up,
 * 145 still lying on the ground at death — and starved the entire level curve
 * by a factor of seven without a single test noticing.
 *
 * 영기 alone has the outer drift. Everything else homes from any distance, so a
 * 영석 or a 회복 is never lost to a fight that moved on.
 *
 * @param {{x: number, z: number, vx: number, vz: number}} o Mutated in place.
 * @param {number} px @param {number} pz Player position.
 * @param {number} magnet The player's hard-pull radius.
 * @param {boolean} isQi
 * @param {number} dt
 * @returns {number} Distance to the player after the step.
 */
export function stepPickup(o, px, pz, magnet, isQi, dt) {
  const dx = px - o.x
  const dz = pz - o.z
  const d = Math.hypot(dx, dz) || 1
  const drifting = isQi && d >= magnet
  const a = (drifting ? DRIFT_ACCEL : MAGNET_ACCEL) * dt
  o.vx += (dx / d) * a
  o.vz += (dz / d) * a
  if (drifting) {
    const k = Math.exp(-DRIFT_DRAG * dt)
    o.vx *= k
    o.vz *= k
  }
  o.x += o.vx * dt
  o.z += o.vz * dt
  return Math.hypot(px - o.x, pz - o.z)
}

const QI_MERGE_THRESHOLD = 600
const QI_MERGE_BATCH = 100

const _dummy = new THREE.Object3D()

/**
 * Drop colours, kept in one table so `test/readability.test.js` can check them
 * against every stage's ground palette.
 *
 * 영기 is deliberately cyan rather than the jade green it used to be. Jade green
 * gems on a jade green plateau were nearly invisible, and 영기 is the one drop
 * the player must track continuously.
 */
export const PICKUP_COLORS = {
  qi: 0x3fd8ff,
  stone: 0xd4ad4e,
  heal: 0xe8546a,
  chest: 0xe8c56a,
}

function kindMesh(kind) {
  switch (kind) {
    // Rim strengths are kept moderate: the bloom threshold sits at 0.95 and a
    // hot rim on hundreds of orbs turns the whole field into white smear.
    case 'qi':
      return {
        geo: new THREE.OctahedronGeometry(0.26, 0),
        mat: makeToonMaterial({ color: PICKUP_COLORS.qi, rim: 0.45, rimColor: 0xbff2ff }),
      }
    case 'stone':
      return {
        geo: new THREE.BoxGeometry(0.26, 0.26, 0.26),
        mat: makeToonMaterial({ color: PICKUP_COLORS.stone, rim: 0.4, rimColor: 0xffe9b0 }),
      }
    case 'heal':
      return {
        geo: new THREE.SphereGeometry(0.26, 10, 8),
        mat: makeToonMaterial({ color: PICKUP_COLORS.heal, rim: 0.45, rimColor: 0xffc0cc }),
      }
    default:
      return {
        geo: new THREE.BoxGeometry(0.8, 0.6, 0.6),
        mat: makeToonMaterial({ color: PICKUP_COLORS.chest, rim: 1.0, rimColor: 0xfff4d0 }),
      }
  }
}

/**
 * 영기 orbs and other drops.
 *
 * Orbs accelerate toward the player inside the magnet radius. When the field
 * fills up, the oldest orbs merge into a single higher-value one so a long
 * uncollected tail can never exhaust the pool.
 */
export class PickupManager {
  constructor(scene) {
    this.scene = scene
    this.pool = new Pool(MAX_PICKUPS)
    this.time = 0
    this.onCollect = null

    this.px = new Float32Array(MAX_PICKUPS)
    this.pz = new Float32Array(MAX_PICKUPS)
    this.vx = new Float32Array(MAX_PICKUPS)
    this.vz = new Float32Array(MAX_PICKUPS)
    this.value = new Float32Array(MAX_PICKUPS)
    this.kind = new Uint8Array(MAX_PICKUPS)
    this.age = new Float32Array(MAX_PICKUPS)
    this._mergeBuf = new Int32Array(QI_MERGE_BATCH)
    this._step = { x: 0, z: 0, vx: 0, vz: 0 }

    this.meshes = PICKUP_KINDS.map((kind) => {
      const { geo, mat } = kindMesh(kind)
      const mesh = new THREE.InstancedMesh(geo, mat, MAX_PICKUPS)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.count = 0
      scene.add(mesh)
      return mesh
    })
    this.typeLists = PICKUP_KINDS.map(() => new Int32Array(MAX_PICKUPS))
    this.typeCounts = new Int32Array(PICKUP_KINDS.length)

    // A soft glow under the chest so it reads as a reward, not scenery.
    this.chestGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      makeAdditiveMaterial({ color: 0xffe08a, opacity: 0.7, map: glowTexture() }),
    )
    this.chestGlow.rotation.x = -Math.PI / 2
    this.chestGlow.position.y = 0.05
    this.chestGlow.visible = false
    scene.add(this.chestGlow)
  }

  get liveCount() {
    return this.pool.count
  }

  _moveSlot(from, to) {
    this.px[to] = this.px[from]; this.pz[to] = this.pz[from]
    this.vx[to] = this.vx[from]; this.vz[to] = this.vz[from]
    this.value[to] = this.value[from]; this.kind[to] = this.kind[from]
    this.age[to] = this.age[from]
  }

  _release(i) {
    this.pool.release(i)
    const moved = this.pool.lastSwappedFrom
    if (moved !== -1) this._moveSlot(moved, i)
  }

  drop(kind, x, z, value) {
    const k = PICKUP_KINDS.indexOf(kind)
    if (k === -1) return -1
    const i = this.pool.acquire()
    if (i === -1) return -1
    this.px[i] = x
    this.pz[i] = z
    this.vx[i] = 0
    this.vz[i] = 0
    this.value[i] = value
    this.kind[i] = k
    this.age[i] = 0
    return i
  }

  /**
   * Fold the oldest orbs into one. Without this a player who outruns the horde
   * leaves hundreds of orbs behind and eventually starves the pool.
   *
   * Single pass: gather the victims, then release them high-index-first so the
   * pool's swap-with-last never invalidates an index still to be freed. The
   * previous version rescanned the whole pool once per merged orb, which cost
   * ~150k operations in a single frame.
   */
  _mergeOldest() {
    const victims = this._mergeBuf
    let count = 0
    let cx = 0
    let cz = 0
    let total = 0
    for (let i = 0; i < this.pool.count && count < QI_MERGE_BATCH; i++) {
      if (this.kind[i] !== KIND_QI) continue
      victims[count++] = i
      cx += this.px[i]
      cz += this.pz[i]
      total += this.value[i]
    }
    if (count < 2) return
    for (let n = count - 1; n >= 0; n--) this._release(victims[n])
    this.drop('qi', cx / count, cz / count, total)
  }

  update(dt, player, vfx) {
    this.time += dt

    const magnet = player.stats.magnet
    this.chestGlow.visible = false
    const o = this._step

    let qiCount = 0
    for (let i = this.pool.count - 1; i >= 0; i--) {
      const kind = this.kind[i]
      if (kind === KIND_QI) qiCount++
      this.age[i] += dt

      if (kind === KIND_CHEST) {
        this.chestGlow.visible = true
        this.chestGlow.position.set(this.px[i], 0.05, this.pz[i])
      }

      // The drift on 영기 is what makes retreating a legitimate strategy rather
      // than a way to forfeit the run's rewards — see `stepPickup`. One scratch
      // object carries the state in and out so a thousand orbs a frame allocate
      // nothing.
      o.x = this.px[i]; o.z = this.pz[i]
      o.vx = this.vx[i]; o.vz = this.vz[i]
      const d = stepPickup(o, player.x, player.z, magnet, kind === KIND_QI, dt)
      this.px[i] = o.x; this.pz[i] = o.z
      this.vx[i] = o.vx; this.vz[i] = o.vz

      if (d < COLLECT_RADIUS) {
        const value = this.value[i]
        this._release(i)
        if (vfx) vfx.spark(player.x, player.z, 1.1, 0.7)
        if (this.onCollect) this.onCollect(PICKUP_KINDS[kind], value)
      }
    }

    if (qiCount > QI_MERGE_THRESHOLD) this._mergeOldest()
  }

  render() {
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
        const bob = Math.sin(this.time * 3 + i * 0.7) * 0.12
        _dummy.position.set(this.px[i], 0.55 + bob, this.pz[i])
        _dummy.rotation.set(0, this.time * 1.6 + i, 0)
        // Big merged orbs are visibly bigger, so the reward reads at a glance.
        _dummy.scale.setScalar(1 + Math.min(1.4, Math.log2(Math.max(1, this.value[i])) * 0.18))
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
    this.chestGlow.visible = false
  }

  dispose() {
    for (const m of this.meshes) {
      m.geometry.dispose()
      m.material.dispose()
      m.removeFromParent()
    }
    this.chestGlow.geometry.dispose()
    this.chestGlow.material.dispose()
    this.chestGlow.removeFromParent()
    this.meshes.length = 0
  }
}
