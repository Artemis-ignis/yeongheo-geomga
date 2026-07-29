import * as THREE from 'three'
import { makeAdditiveMaterial, makeToonMaterial } from '../../art/materials.js'
import { glowTexture } from '../../art/textures.js'
import { buildMerged } from '../../art/geometry.js'
import { findNearest } from './flyingSword.js'

const _out = new Int32Array(256)
const _targets = new Int32Array(24)

/**
 * The second wave of 법보.
 *
 * These lean on effects the first eight do not cover: a lingering aura, a wide
 * spread, a knockback pulse, a returning blade, ground eruptions, and a pull.
 * Together they give the upgrade pool enough shape that two runs can play
 * genuinely differently.
 */

// ---- 만독장 ----------------------------------------------------------------

function venomAttach(ctx) {
  const state = ctx.state
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    makeAdditiveMaterial({ color: 0x8de06a, opacity: 0.28, map: glowTexture() }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.frustumCulled = false
  ctx.world.scene.add(mesh)
  state.mesh = mesh
  state.timer = 0
  state.spin = 0
}

function venomDetach(ctx) {
  const state = ctx.state
  if (!state.mesh) return
  state.mesh.geometry.dispose()
  state.mesh.material.dispose()
  state.mesh.removeFromParent()
  state.mesh = null
}

/** A poison cloud that follows her and eats away at whatever stands in it. */
export const venomMist = {
  attach: venomAttach,
  detach: venomDetach,
  update(ctx, dt) {
    const state = ctx.state
    if (!state.mesh) return
    const { player, world, level, stats } = ctx
    const radius = 3.4 * ctx.area

    state.spin += dt * 0.35
    state.mesh.position.set(player.x, 0.09, player.z)
    state.mesh.scale.setScalar(radius * 2.3)
    state.mesh.rotation.z = state.spin
    state.mesh.material.opacity = 0.22 + Math.sin(state.spin * 2.4) * 0.05

    state.timer -= dt
    if (state.timer > 0) return
    state.timer += ctx.cooldown
    world.enemies.damageAt(player.x, player.z, radius, level.damage, ctx.weapon.tag, stats, {})
    const n = world.enemies.queryNear(player.x, player.z, radius, _out)
    for (let k = 0; k < n; k++) {
      const e = _out[k]
      if (!world.enemies.pool.isAlive(e)) continue
      world.enemies.applyBurn(e, level.burn ?? 0, ctx.duration)
      world.enemies.applySlow(e, 0.2, 0.6)
    }
  },
}

export const plagueTide = venomMist

// ---- 암기비침 --------------------------------------------------------------

/** A fan of needles: individually weak, collectively a wall. */
export const hiddenNeedles = {
  fire(ctx) {
    const { player, world, level, stats } = ctx
    const count = Math.max(1, Math.round(ctx.amount))
    const found = findNearest(world.enemies, player.x, player.z, 1, _targets)
    let base = player.facing
    if (found > 0) {
      const e = _targets[0]
      base = Math.atan2(world.enemies.px[e] - player.x, world.enemies.pz[e] - player.z)
    }
    // Spread widens with count so more needles cover more arc, not just overlap.
    const spread = Math.min(Math.PI * 1.9, 0.24 * count)
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) - 0.5
      const a = base + t * spread
      world.projectiles.spawn('sword', {
        x: player.x, z: player.z, y: 1.0,
        dirX: Math.sin(a), dirZ: Math.cos(a),
        speed: ctx.speed,
        damage: level.damage,
        radius: 0.4 * ctx.area,
        pierce: level.pierce ?? 1,
        life: 1.5,
        knockback: level.knockback ?? 1,
        tag: ctx.weapon.tag,
        stats,
      })
    }
  },
}

export const needleStorm = {
  fire(ctx) {
    // Same weapon, but a full ring rather than a fan.
    const { player, world, level, stats } = ctx
    const count = Math.max(1, Math.round(ctx.amount))
    const base = ctx.rng.angle()
    for (let i = 0; i < count; i++) {
      const a = base + (i / count) * Math.PI * 2
      world.projectiles.spawn('sword', {
        x: player.x, z: player.z, y: 1.0,
        dirX: Math.sin(a), dirZ: Math.cos(a),
        speed: ctx.speed,
        damage: level.damage,
        radius: 0.45 * ctx.area,
        pierce: level.pierce ?? 3,
        life: 1.6,
        knockback: level.knockback ?? 2,
        tag: ctx.weapon.tag,
        stats,
      })
    }
  },
}

// ---- 금종파 ----------------------------------------------------------------

/** A ring pulse that shoves the horde off her. Crowd control, not damage. */
export const bellToll = {
  fire(ctx) {
    const { player, world, level, stats } = ctx
    const radius = 5.2 * ctx.area
    world.vfx.shockRing(player.x, player.z, radius)
    world.camera.addTrauma(0.14)
    world.enemies.damageAt(player.x, player.z, radius, level.damage, ctx.weapon.tag, stats, {
      knockback: level.knockback ?? 12,
    })
  },
}

// ---- 청강인 ----------------------------------------------------------------

/**
 * A blade that flies out, stalls, and returns. Implemented as an outbound
 * projectile that spawns its return leg on expiry — simpler and more reliable
 * than steering a single one through a reversal.
 */
export const windBlade = {
  fire(ctx) {
    const { player, world, level, stats } = ctx
    const count = Math.max(1, Math.round(ctx.amount))
    const tag = ctx.weapon.tag
    const damage = level.damage
    const life = (ctx.duration || 2.2) * 0.5
    const speed = ctx.speed
    const radius = 0.85 * ctx.area

    for (let i = 0; i < count; i++) {
      const step = Math.ceil(i / 2) * 0.5 * (i % 2 ? 1 : -1)
      const a = player.facing + step
      const dirX = Math.sin(a)
      const dirZ = Math.cos(a)
      world.projectiles.spawn('vajra', {
        x: player.x, z: player.z, y: 1.0,
        dirX, dirZ, speed, damage,
        radius, pierce: 999, life, spin: 14,
        knockback: level.knockback ?? 3,
        tag, stats,
        onExpire: (ex, ez) => {
          // The return leg homes back to wherever she is now.
          const bx = player.x - ex
          const bz = player.z - ez
          world.projectiles.spawn('vajra', {
            x: ex, z: ez, y: 1.0,
            dirX: bx, dirZ: bz, speed: speed * 1.15, damage,
            radius, pierce: 999, life: life * 1.6, spin: -14,
            knockback: level.knockback ?? 3,
            homing: 3.5, tag, stats,
          })
        },
      })
    }
  },
}

// ---- 지룡참 ----------------------------------------------------------------

/** Stone spikes erupting under nearby enemies. */
export const earthSpike = {
  fire(ctx) {
    const { player, world, level, stats } = ctx
    const count = Math.max(1, Math.round(ctx.amount))
    const reach = 12 * ctx.area
    const found = findNearest(world.enemies, player.x, player.z, count, _targets)

    for (let i = 0; i < count; i++) {
      let x
      let z
      if (i < found) {
        const e = _targets[i]
        x = world.enemies.px[e]
        z = world.enemies.pz[e]
      } else {
        const a = ctx.rng.angle()
        const r = 2 + ctx.rng.next() * reach
        x = player.x + Math.cos(a) * r
        z = player.z + Math.sin(a) * r
      }
      world.vfx.spark(x, z, 0.5, 1.4)
      world.vfx.telegraph(x, z, 1.5 * ctx.area, 0.18)
      world.enemies.damageAt(x, z, 1.5 * ctx.area, level.damage, ctx.weapon.tag, stats, {
        knockback: level.knockback ?? 6,
      })
    }
  },
}

// ---- 혼원구 ----------------------------------------------------------------

const MAX_ORBS = 6

function voidAttach(ctx) {
  const state = ctx.state
  state.x = new Float32Array(MAX_ORBS)
  state.z = new Float32Array(MAX_ORBS)
  state.t = new Float32Array(MAX_ORBS)
  state.next = 0
  const geo = buildMerged([
    [new THREE.SphereGeometry(0.42, 14, 10), {}],
    [new THREE.TorusGeometry(0.62, 0.05, 6, 18), { rx: Math.PI / 2 }],
  ])
  state.mesh = new THREE.InstancedMesh(
    geo, makeToonMaterial({ color: 0x6a4fd0, rim: 1.0, rimColor: 0xd0b8ff }), MAX_ORBS,
  )
  state.mesh.frustumCulled = false
  state.mesh.count = 0
  state.dummy = new THREE.Object3D()
  ctx.world.scene.add(state.mesh)
}

function voidDetach(ctx) {
  const state = ctx.state
  if (!state.mesh) return
  state.mesh.geometry.dispose()
  state.mesh.material.dispose()
  state.mesh.removeFromParent()
  state.mesh = null
}

/** A singularity that drags the horde inward while it grinds them down. */
export const voidOrb = {
  attach: voidAttach,
  detach: voidDetach,

  fire(ctx) {
    const state = ctx.state
    if (!state.x) return
    const count = Math.max(1, Math.round(ctx.amount))
    for (let i = 0; i < count; i++) {
      const slot = state.next % MAX_ORBS
      state.next++
      const a = ctx.rng.angle()
      const r = 3 + ctx.rng.next() * 6
      state.x[slot] = ctx.player.x + Math.cos(a) * r
      state.z[slot] = ctx.player.z + Math.sin(a) * r
      state.t[slot] = ctx.duration || 3
    }
  },

  update(ctx, dt) {
    const state = ctx.state
    if (!state.mesh) return
    const { world, level, stats } = ctx
    const pull = 9 * ctx.area
    const radius = 1.5 * ctx.area
    let live = 0

    for (let i = 0; i < MAX_ORBS; i++) {
      if (state.t[i] <= 0) continue
      state.t[i] -= dt
      const x = state.x[i]
      const z = state.z[i]

      // Drag everything nearby toward the centre, then grind what reaches it.
      const n = world.enemies.queryNear(x, z, pull, _out)
      for (let k = 0; k < n; k++) {
        const e = _out[k]
        if (!world.enemies.pool.isAlive(e)) continue
        const dx = x - world.enemies.px[e]
        const dz = z - world.enemies.pz[e]
        const d = Math.hypot(dx, dz) || 1
        const force = (1 - Math.min(1, d / pull)) * 7 * dt
        world.enemies.px[e] += (dx / d) * force
        world.enemies.pz[e] += (dz / d) * force
      }
      world.enemies.damageAt(x, z, radius, level.damage * dt * 4, ctx.weapon.tag, stats, {})

      state.dummy.position.set(x, 1.1, z)
      state.dummy.rotation.set(0, state.t[i] * 3, state.t[i] * 1.4)
      state.dummy.scale.setScalar(ctx.area * (0.6 + Math.min(1, state.t[i]) * 0.4))
      state.dummy.updateMatrix()
      state.mesh.setMatrixAt(live++, state.dummy.matrix)
    }
    state.mesh.count = live
    state.mesh.instanceMatrix.needsUpdate = true
  },
}
