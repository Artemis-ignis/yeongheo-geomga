/** 금강저 — a heavy piercing bolt that shoves the horde aside. */
export const vajra = {
  fire(ctx) {
    const { player, world, level, stats } = ctx
    const count = Math.max(1, Math.round(ctx.amount))
    // Captured now: `ctx` is reused and mutated every tick, so anything read
    // inside a deferred hit callback must be pulled out at fire time.
    const tag = ctx.weapon.tag
    const damage = level.damage
    const knockback = level.knockback ?? 10

    for (let i = 0; i < count; i++) {
      // Fan around the facing direction: 0, -15°, +15°, -30°, ...
      const step = Math.ceil(i / 2) * 0.26 * (i % 2 ? 1 : -1)
      const a = player.facing + step
      const dirX = Math.sin(a)
      const dirZ = Math.cos(a)
      world.projectiles.spawn('vajra', {
        x: player.x, z: player.z, y: 1.0,
        dirX, dirZ,
        speed: ctx.speed,
        damage,
        radius: 0.95 * ctx.area,
        pierce: level.pierce ?? 999,
        life: 3,
        knockback,
        spin: 9,
        tag,
        stats,
        onHit: (hx, hz, e) => {
          world.enemies.damageOne(e, damage, tag, stats, { knockback, dirX, dirZ })
          world.vfx.spark(hx, hz, 1.0, 1.1)
          // Heavy hits kick the camera so the weapon feels as weighty as it looks.
          world.camera.addTrauma(0.06)
        },
      })
    }
  },
}
