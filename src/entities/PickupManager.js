import * as THREE from 'three'
import { Pool } from '../core/Pool.js'
import { makeToonMaterial, makeAdditiveMaterial } from '../art/materials.js'
import { glowTexture } from '../art/textures.js'

export const MAX_PICKUPS = 1500
export const PICKUP_KINDS = ['qi', 'stone', 'heal', 'chest']

const MAGNET_ACCEL = 34
const COLLECT_RADIUS = 0.9
const QI_MERGE_THRESHOLD = 600
const QI_MERGE_BATCH = 100

const _dummy = new THREE.Object3D()

function kindMesh(kind) {
  switch (kind) {
    case 'qi':
      return {
        geo: new THREE.OctahedronGeometry(0.24, 0),
        mat: makeToonMaterial({ color: 0x7fe8c8, rim: 1.0, rimColor: 0xd8fff0 }),
      }
    case 'stone':
      return {
        geo: new THREE.BoxGeometry(0.26, 0.26, 0.26),
        mat: makeToonMaterial({ color: 0xe8c56a, rim: 0.9, rimColor: 0xfff0c0 }),
      }
    case 'heal':
      return {
        geo: new THREE.SphereGeometry(0.26, 10, 8),
        mat: makeToonMaterial({ color: 0xff7a8a, rim: 1.0, rimColor: 0xffd0d8 }),
      }
    default:
      return {
        geo: new THREE.BoxGeometry(0.8, 0.6, 0.6),
        mat: makeToonMaterial({ color: 0xe8c56a, rim: 1.0, rimColor: 0xfff4d0 }),
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
   */
  _mergeOldest() {
    let cx = 0
    let cz = 0
    let total = 0
    let merged = 0
    for (let i = 0; i < this.pool.count && merged < QI_MERGE_BATCH; i++) {
      if (PICKUP_KINDS[this.kind[i]] !== 'qi') continue
      cx += this.px[i]
      cz += this.pz[i]
      total += this.value[i]
      merged++
    }
    if (merged < 2) return
    for (let n = 0; n < merged; n++) {
      for (let i = 0; i < this.pool.count; i++) {
        if (PICKUP_KINDS[this.kind[i]] === 'qi') { this._release(i); break }
      }
    }
    this.drop('qi', cx / merged, cz / merged, total)
  }

  update(dt, player, vfx) {
    this.time += dt

    let qiCount = 0
    for (let i = 0; i < this.pool.count; i++) if (PICKUP_KINDS[this.kind[i]] === 'qi') qiCount++
    if (qiCount > QI_MERGE_THRESHOLD) this._mergeOldest()

    const magnet = player.stats.magnet
    const magnet2 = magnet * magnet
    this.chestGlow.visible = false

    for (let i = this.pool.count - 1; i >= 0; i--) {
      this.age[i] += dt
      const dx = player.x - this.px[i]
      const dz = player.z - this.pz[i]
      const d2 = dx * dx + dz * dz

      if (PICKUP_KINDS[this.kind[i]] === 'chest') {
        this.chestGlow.visible = true
        this.chestGlow.position.set(this.px[i], 0.05, this.pz[i])
      }

      if (d2 < magnet2 || PICKUP_KINDS[this.kind[i]] !== 'qi') {
        const d = Math.sqrt(d2) || 1
        this.vx[i] += (dx / d) * MAGNET_ACCEL * dt
        this.vz[i] += (dz / d) * MAGNET_ACCEL * dt
      }
      this.px[i] += this.vx[i] * dt
      this.pz[i] += this.vz[i] * dt

      if (d2 < COLLECT_RADIUS * COLLECT_RADIUS) {
        const kind = PICKUP_KINDS[this.kind[i]]
        const value = this.value[i]
        this._release(i)
        if (vfx) vfx.spark(player.x, player.z, 1.1, 0.7)
        if (this.onCollect) this.onCollect(kind, value)
      }
    }
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
      mesh.instanceMatrix.needsUpdate = true
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
