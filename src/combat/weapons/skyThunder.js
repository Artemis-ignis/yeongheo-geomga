const MAX_PENDING = 16
const TELEGRAPH = 0.4

const _out = new Int32Array(256)

/**
 * 천뢰인 — lightning called down onto enemies after a short telegraph.
 *
 * Pending strikes live in a fixed-size ring so calling the weapon never
 * allocates; extra strikes beyond the cap are simply dropped.
 */
function ensureState(state) {
  if (state.px) return
  state.px = new Float32Array(MAX_PENDING)
  state.pz = new Float32Array(MAX_PENDING)
  state.t = new Float32Array(MAX_PENDING)
  state.active = new Uint8Array(MAX_PENDING)
}

export const skyThunder = {
  fire(ctx) {
    const { player, world } = ctx
    ensureState(ctx.state)
    const state = ctx.state
    const count = Math.max(1, Math.round(ctx.amount))
    const reach = world.camera.viewRadius * 0.85

    const n = world.enemies.queryNear(player.x, player.z, reach, _out)
    if (n === 0) return

    for (let i = 0; i < count; i++) {
      let slot = -1
      for (let s = 0; s < MAX_PENDING; s++) if (!state.active[s]) { slot = s; break }
      if (slot === -1) return

      const e = _out[ctx.rng.int(n)]
      if (!world.enemies.pool.isAlive(e)) continue
      state.px[slot] = world.enemies.px[e]
      state.pz[slot] = world.enemies.pz[e]
      state.t[slot] = TELEGRAPH
      state.active[slot] = 1
      world.vfx.telegraph(state.px[slot], state.pz[slot], 2.4 * ctx.area, TELEGRAPH)
    }
  },

  update(ctx, dt) {
    const state = ctx.state
    if (!state.px) return
    const { world, level, stats } = ctx
    const radius = 2.0 * ctx.area

    for (let s = 0; s < MAX_PENDING; s++) {
      if (!state.active[s]) continue
      state.t[s] -= dt
      if (state.t[s] > 0) continue
      state.active[s] = 0
      const x = state.px[s]
      const z = state.pz[s]
      world.vfx.lightning(x, z, 2.0 * ctx.area)
      world.enemies.damageAt(x, z, radius, level.damage, ctx.weapon.tag, stats, {
        knockback: level.knockback ?? 4,
      })
    }
  },
}
