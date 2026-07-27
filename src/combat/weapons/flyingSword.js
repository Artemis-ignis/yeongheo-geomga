const _out = new Int32Array(256)

/** Find up to `want` distinct nearest enemies, widening the search as needed. */
export function findNearest(enemies, x, z, want, into) {
  let found = 0
  for (const radius of [12, 24, 40]) {
    const n = enemies.queryNear(x, z, radius, _out)
    found = 0
    for (let k = 0; k < n && found < into.length; k++) {
      const e = _out[k]
      if (!enemies.pool.isAlive(e)) continue
      into[found++] = e
    }
    if (found >= want) break
  }
  // Partial selection sort — we only need the closest `want`.
  const limit = Math.min(want, found)
  for (let a = 0; a < limit; a++) {
    let best = a
    let bestD = Infinity
    for (let b = a; b < found; b++) {
      const e = into[b]
      const dx = enemies.px[e] - x
      const dz = enemies.pz[e] - z
      const d = dx * dx + dz * dz
      if (d < bestD) { bestD = d; best = b }
    }
    const t = into[a]; into[a] = into[best]; into[best] = t
  }
  return limit
}

const _targets = new Int32Array(16)

/** 비검 — homing swords that seek the nearest enemies and pierce. */
export const flyingSword = {
  fire(ctx) {
    const { player, world, level, stats } = ctx
    const count = Math.max(1, Math.round(ctx.amount))
    const found = findNearest(world.enemies, player.x, player.z, count, _targets)

    for (let i = 0; i < count; i++) {
      let dx
      let dz
      if (i < found) {
        const e = _targets[i]
        dx = world.enemies.px[e] - player.x
        dz = world.enemies.pz[e] - player.z
      } else {
        // Nothing in range: fan out along her facing so the weapon never idles.
        const spread = (i - found + 1) * 0.21 * (i % 2 ? 1 : -1)
        dx = Math.sin(player.facing + spread)
        dz = Math.cos(player.facing + spread)
      }
      world.projectiles.spawn('sword', {
        x: player.x, z: player.z, y: 1.0,
        dirX: dx, dirZ: dz,
        speed: ctx.speed,
        damage: level.damage,
        radius: 0.62 * ctx.area,
        pierce: level.pierce ?? 1,
        life: 2.6,
        homing: 4,
        knockback: level.knockback ?? 0,
        tag: ctx.weapon.tag,
        stats,
      })
    }
  },
}
