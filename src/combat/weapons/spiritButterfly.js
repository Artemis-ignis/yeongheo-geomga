/** 영접부 — slow spirit butterflies that drift out and then hunt. */
export const spiritButterfly = {
  fire(ctx) {
    const { player, world, level, stats } = ctx
    const count = Math.max(1, Math.round(ctx.amount))
    const base = ctx.rng.angle()

    for (let i = 0; i < count; i++) {
      const a = base + (i / count) * Math.PI * 2
      world.projectiles.spawn('butterfly', {
        x: player.x, z: player.z, y: 1.2,
        dirX: Math.sin(a), dirZ: Math.cos(a),
        speed: ctx.speed,
        damage: level.damage,
        radius: 0.55 * ctx.area,
        pierce: level.pierce ?? 1,
        life: ctx.duration || 6,
        homing: 2.0,
        tag: ctx.weapon.tag,
        stats,
      })
    }
  },
}
