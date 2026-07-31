import * as THREE from 'three'
import { blastParams, fireBlast, throwTalismans } from './fireTalisman.js'
import { frostCone } from './frostPalm.js'
import { thunderOrb } from './thunderOrb.js'
import { makeAdditiveMaterial } from '../../art/materials.js'
import { glowTexture } from '../../art/textures.js'

const _out = new Int32Array(256)

/**
 * 만검귀종 — sword rain.
 *
 * No target search: swords fall continuously over an area around the cultivator,
 * which is what makes the evolution feel categorically different from 비검.
 */
export const myriadSwords = {
  fire(ctx) {
    const { player, world, level, stats } = ctx
    const count = Math.max(1, Math.round(ctx.amount))
    const spread = 10 * ctx.area

    for (let i = 0; i < count; i++) {
      const a = ctx.rng.angle()
      const r = Math.sqrt(ctx.rng.next()) * spread
      const tx = player.x + Math.cos(a) * r
      const tz = player.z + Math.sin(a) * r
      // Launched from above and outside, converging on the target point.
      const fromA = ctx.rng.angle()
      world.projectiles.spawn('sword', {
        x: tx + Math.cos(fromA) * 6, z: tz + Math.sin(fromA) * 6, y: 1.1,
        dirX: -Math.cos(fromA), dirZ: -Math.sin(fromA),
        speed: ctx.speed,
        damage: level.damage,
        radius: 0.7 * ctx.area,
        pierce: level.pierce ?? 3,
        life: 1.0,
        homing: 2.5,
        knockback: level.knockback ?? 3,
        tag: ctx.weapon.tag,
        stats,
      })
    }
  },
}

/** 분천화해 — blasts leave lingering fire fields. */
const MAX_FIELDS = 12

function ensureFields(ctx) {
  const state = ctx.state
  if (state.fx) return
  state.fx = new Float32Array(MAX_FIELDS)
  state.fz = new Float32Array(MAX_FIELDS)
  state.ft = new Float32Array(MAX_FIELDS)
  state.fr = new Float32Array(MAX_FIELDS)
  state.tick = new Float32Array(MAX_FIELDS)
  state.next = 0

  const geo = new THREE.PlaneGeometry(1, 1)
  /**
   * 0.24, down from 0.55, because these stack and additive layers sum.
   *
   * A field is one plane, and 염해 keeps up to a dozen of them alive at once
   * across overlapping ground. Measured with twelve live, the frame read mean
   * luminance 0.438 at saturation 0.54 — saturation *falling* is the tell, it
   * means the orange had summed its way to near-white. 설령's navy robe came out
   * bleached and the burning ground was a flat yellow blob rather than burning
   * ground.
   *
   *   0.55  luma 0.438  sat 0.54
   *   0.34  luma 0.366  sat 0.77
   *   0.24  luma 0.350  sat 0.76
   *
   * At 0.24 a single field still reads as fire and twelve of them read as a
   * scorched patch you can still see the grass and the character through.
   */
  const mat = makeAdditiveMaterial({ color: 0xff7a3c, opacity: 0.24, map: glowTexture() })
  state.mesh = new THREE.InstancedMesh(geo, mat, MAX_FIELDS)
  state.mesh.frustumCulled = false
  state.dummy = new THREE.Object3D()
  ctx.world.scene.add(state.mesh)
}

export const infernoSea = {
  attach(ctx) {
    ensureFields(ctx)
  },

  detach(ctx) {
    const state = ctx.state
    if (!state.mesh) return
    state.mesh.geometry.dispose()
    state.mesh.material.dispose()
    state.mesh.removeFromParent()
    state.mesh = null
    state.fx = null
  },

  fire(ctx) {
    ensureFields(ctx)
    const state = ctx.state
    const params = blastParams(ctx)
    // Captured now — `ctx` is reused and will hold another weapon's values by the
    // time a talisman actually lands.
    const radius = params.radius
    const duration = ctx.duration

    throwTalismans(ctx, params, (hx, hz) => {
      addField(state, hx, hz, radius, duration)
    })
  },

  update(ctx, dt) {
    ensureFields(ctx)
    const state = ctx.state
    const { world, level, stats } = ctx
    const dummy = state.dummy
    let live = 0

    for (let i = 0; i < MAX_FIELDS; i++) {
      if (state.ft[i] <= 0) continue
      state.ft[i] -= dt
      state.tick[i] -= dt
      if (state.tick[i] <= 0) {
        state.tick[i] += 0.4
        world.enemies.damageAt(state.fx[i], state.fz[i], state.fr[i], level.burn ?? 10, ctx.weapon.tag, stats, {})
      }
      dummy.position.set(state.fx[i], 0.1, state.fz[i])
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.setScalar(state.fr[i] * 2.4)
      dummy.updateMatrix()
      state.mesh.setMatrixAt(live++, dummy.matrix)
    }
    state.mesh.count = live
    state.mesh.instanceMatrix.needsUpdate = true
  },
}

/** Drop a lingering fire field, overwriting the oldest when the ring is full. */
function addField(state, x, z, radius, duration) {
  if (!state.fx) return
  const i = state.next % MAX_FIELDS
  state.next++
  state.fx[i] = x
  state.fz[i] = z
  state.fr[i] = radius
  state.ft[i] = duration
  state.tick[i] = 0
}

/** 자소신뢰 — orbs that chain lightning to nearby enemies. */
export const violetThunder = {
  attach: thunderOrb.attach,
  detach: thunderOrb.detach,

  update(ctx, dt) {
    const { world, level, stats } = ctx
    const chain = level.chain ?? 2
    const range = level.chainRange ?? 6
    const tag = ctx.weapon.tag

    // Reuse the orb behaviour, then chain outward from each contact point.
    ctx.onOrbHit = (ox, oz, hitIndex) => {
      let hops = 0
      const n = world.enemies.queryNear(ox, oz, range, _out)
      for (let k = 0; k < n && hops < chain; k++) {
        const e = _out[k]
        if (e === hitIndex || !world.enemies.pool.isAlive(e)) continue
        world.vfx.lightning(world.enemies.px[e], world.enemies.pz[e], 1.2)
        world.enemies.damageOne(e, level.damage * 0.6, tag, stats, {})
        hops++
      }
    }
    thunderOrb.update(ctx, dt)
    ctx.onOrbHit = null
  },
}

/** 한천빙봉 — freezes solid; frozen enemies shatter for area damage on death. */
export const frozenSky = {
  fire(ctx) {
    frostCone(ctx, (e) => {
      ctx.world.enemies.freeze(e, ctx.duration)
    })
  },
}
