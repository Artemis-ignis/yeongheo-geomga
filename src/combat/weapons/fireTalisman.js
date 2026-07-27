import { findNearest } from './flyingSword.js'

const _targets = new Int32Array(16)
const _burnOut = new Int32Array(256)

/**
 * Detonate a fire blast.
 *
 * Takes plain values rather than the weapon context: `ctx` is a single reused
 * object mutated every tick, so a projectile that reads it on impact would use
 * whichever weapon happened to fire most recently.
 */
export function fireBlast(world, x, z, p) {
  world.vfx.burst(x, z, p.radius)
  world.enemies.damageAt(x, z, p.radius, p.damage, p.tag, p.stats, { knockback: p.knockback })
  if (p.burn > 0) {
    const n = world.enemies.queryNear(x, z, p.radius, _burnOut)
    for (let k = 0; k < n; k++) {
      const e = _burnOut[k]
      if (!world.enemies.pool.isAlive(e)) continue
      world.enemies.applyBurn(e, p.burn, p.duration)
    }
  }
}

/** Build the immutable blast description for one shot. */
export function blastParams(ctx, radiusMul = 1) {
  return {
    radius: 2.2 * ctx.area * radiusMul,
    damage: ctx.level.damage,
    burn: ctx.level.burn ?? 0,
    duration: ctx.duration,
    knockback: ctx.level.knockback ?? 1,
    tag: ctx.weapon.tag,
    stats: ctx.stats,
  }
}

/**
 * Throw `count` talismans at nearby enemies, or scatter them if none are near.
 * `onImpact(x, z)` fires after the blast, letting the evolution drop a fire field.
 */
export function throwTalismans(ctx, params, onImpact = null) {
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
      const a = ctx.rng.angle()
      dx = Math.sin(a)
      dz = Math.cos(a)
    }
    world.projectiles.spawn('talisman', {
      x: player.x, z: player.z, y: 1.1,
      dirX: dx, dirZ: dz,
      speed: ctx.speed,
      damage: level.damage,
      radius: 0.7,
      pierce: 0,
      life: 3,
      homing: 1.5,
      spin: 6,
      tag: ctx.weapon.tag,
      stats,
      onHit: (hx, hz) => {
        fireBlast(world, hx, hz, params)
        if (onImpact) onImpact(hx, hz)
      },
    })
  }
}

/** 화염부 — lobbed talismans that detonate and leave a burn. */
export const fireTalisman = {
  fire(ctx) {
    throwTalismans(ctx, blastParams(ctx))
  },
}
