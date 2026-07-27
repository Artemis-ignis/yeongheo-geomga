const _out = new Int32Array(256)
const CONE_HALF_ANGLE = Math.PI / 4

/**
 * Cone blast in the facing direction.
 *
 * `onEach` receives every enemy inside the cone, so 빙백장 can slow and its
 * evolution can freeze without duplicating the geometry test.
 */
export function frostCone(ctx, onEach) {
  const { player, world, level, stats } = ctx
  const reach = 4.5 * ctx.area
  const fx = Math.sin(player.facing)
  const fz = Math.cos(player.facing)

  world.vfx.burst(player.x + fx * reach * 0.5, player.z + fz * reach * 0.5, reach * 0.7, 1.0)

  const n = world.enemies.queryNear(player.x, player.z, reach, _out)
  const hits = []
  for (let k = 0; k < n; k++) {
    const e = _out[k]
    if (!world.enemies.pool.isAlive(e)) continue
    const dx = world.enemies.px[e] - player.x
    const dz = world.enemies.pz[e] - player.z
    const d = Math.hypot(dx, dz)
    if (d > reach || d < 1e-4) continue
    // Inside the cone half-angle around the facing direction.
    if ((dx / d) * fx + (dz / d) * fz < Math.cos(CONE_HALF_ANGLE)) continue
    hits.push(e)
  }

  // Apply status first: damage can kill and compact the pool, invalidating indices.
  for (const e of hits) {
    if (!world.enemies.pool.isAlive(e)) continue
    onEach(e)
  }
  for (let i = hits.length - 1; i >= 0; i--) {
    const e = hits[i]
    if (!world.enemies.pool.isAlive(e)) continue
    world.enemies.damageOne(e, level.damage, ctx.weapon.tag, stats, {
      knockback: level.knockback ?? 0,
      dirX: world.enemies.px[e] - player.x,
      dirZ: world.enemies.pz[e] - player.z,
    })
  }
}

/** 빙백장 — a frost cone that slows everything it touches. */
export const frostPalm = {
  fire(ctx) {
    frostCone(ctx, (e) => {
      ctx.world.enemies.applySlow(e, ctx.level.slow ?? 0.4, ctx.duration)
    })
  },
}
