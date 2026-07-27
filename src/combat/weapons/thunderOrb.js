import * as THREE from 'three'
import { makeToonMaterial } from '../../art/materials.js'

const _dummy = new THREE.Object3D()
const _out = new Int32Array(256)

const ORB_HIT_COOLDOWN = 0.35

/**
 * 뇌령주 — orbs circling the cultivator, damaging what they sweep through.
 *
 * Persistent: it owns an InstancedMesh, so it rebuilds on level change (orb
 * count grows) and must clean up on detach or an orphaned mesh is left behind.
 */
function attach(ctx) {
  const state = ctx.state
  const count = ctx.level.count ?? 3
  const geo = new THREE.SphereGeometry(0.22, 12, 10)
  const mat = makeToonMaterial({ color: 0xcfe4ff, rim: 1.0, rimColor: 0x88bbff })
  state.mesh = new THREE.InstancedMesh(geo, mat, count)
  state.mesh.frustumCulled = false
  state.count = count
  state.angle = 0
  state.timer = 0
  // Per-orb, per-enemy hit cooldowns keep a stationary target from being hit
  // every single tick.
  state.cooldowns = new Map()
  ctx.world.scene.add(state.mesh)
}

function detach(ctx) {
  const state = ctx.state
  if (!state.mesh) return
  state.mesh.geometry.dispose()
  state.mesh.material.dispose()
  state.mesh.removeFromParent()
  state.mesh = null
  state.cooldowns?.clear()
}

export const thunderOrb = {
  attach,
  detach,

  update(ctx, dt) {
    const state = ctx.state
    if (!state.mesh) return
    const { player, world, level, stats } = ctx
    const radius = 1.7 * ctx.area
    state.angle += (level.speed ?? 2.4) * dt

    for (const [key, t] of state.cooldowns) {
      const next = t - dt
      if (next <= 0) state.cooldowns.delete(key)
      else state.cooldowns.set(key, next)
    }

    state.timer -= dt
    const canHit = state.timer <= 0
    if (canHit) state.timer += ctx.cooldown

    for (let i = 0; i < state.count; i++) {
      const a = state.angle + (i / state.count) * Math.PI * 2
      const ox = player.x + Math.cos(a) * radius
      const oz = player.z + Math.sin(a) * radius
      _dummy.position.set(ox, 1.0 + Math.sin(a * 2 + state.angle) * 0.15, oz)
      _dummy.scale.setScalar(ctx.area)
      _dummy.updateMatrix()
      state.mesh.setMatrixAt(i, _dummy.matrix)

      if (!canHit) continue
      const hitR = 0.55 * ctx.area
      const n = world.enemies.queryNear(ox, oz, hitR, _out)
      for (let k = 0; k < n; k++) {
        const e = _out[k]
        if (!world.enemies.pool.isAlive(e)) continue
        const dx = world.enemies.px[e] - ox
        const dz = world.enemies.pz[e] - oz
        if (dx * dx + dz * dz > hitR * hitR) continue
        const key = i * 100000 + e
        if (state.cooldowns.has(key)) continue
        state.cooldowns.set(key, ORB_HIT_COOLDOWN)
        world.enemies.damageOne(e, level.damage, ctx.weapon.tag, stats, {
          knockback: level.knockback ?? 0, dirX: dx, dirZ: dz,
        })
        world.vfx.spark(ox, oz, 1.0, 0.6)
        if (ctx.onOrbHit) ctx.onOrbHit(ox, oz, e)
      }
    }
    state.mesh.instanceMatrix.needsUpdate = true
  },
}
