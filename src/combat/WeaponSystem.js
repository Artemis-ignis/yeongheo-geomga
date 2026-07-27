import { getWeapon } from '../data/weapons.js'
import { getWeaponModule } from './weapons/index.js'

/**
 * Owns the equipped 법보, ticks their cooldowns, and fires them.
 *
 * Weapons never touch the renderer. They receive a context object and request
 * projectiles and effects through it, so the whole set stays data-driven and the
 * dependency direction is one-way.
 */
export class WeaponSystem {
  constructor(world, rng) {
    this.world = world
    this.rng = rng
    this.slots = []
    // One reused context object — firing must not allocate.
    this.ctx = {
      player: null, stats: null, level: null, weapon: null,
      world, rng, runTime: 0, dt: 0,
      cooldown: 1, amount: 1, speed: 0, area: 1, duration: 0,
      state: null,
    }
  }

  get equipped() {
    return this.slots.map((s) => ({ id: s.id, level: s.level }))
  }

  /** Diff the loadout against what is equipped, attaching and detaching as needed. */
  sync(loadout, player, stats) {
    const ctx = this.ctx
    ctx.player = player
    ctx.stats = stats

    // Remove weapons no longer in the loadout.
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const slot = this.slots[i]
      if (loadout.weapons[slot.id] === undefined) {
        if (slot.module.detach) {
          ctx.weapon = slot.def
          ctx.state = slot.state
          slot.module.detach(ctx)
        }
        this.slots.splice(i, 1)
      }
    }

    for (const id in loadout.weapons) {
      const level = loadout.weapons[id]
      let slot = this.slots.find((s) => s.id === id)
      if (slot === undefined) {
        const def = getWeapon(id)
        const module = getWeaponModule(id)
        if (!def || !module) continue
        slot = { id, def, module, level, timer: 0, state: {} }
        this.slots.push(slot)
        if (module.attach) {
          ctx.weapon = def
          ctx.level = def.levels[level - 1]
          ctx.state = slot.state
          module.attach(ctx)
        }
      } else if (slot.level !== level) {
        slot.level = level
        // Persistent weapons rebuild their meshes when the level changes.
        if (slot.module.attach && slot.module.detach) {
          ctx.weapon = slot.def
          ctx.level = slot.def.levels[level - 1]
          ctx.state = slot.state
          slot.module.detach(ctx)
          slot.module.attach(ctx)
        }
      }
    }
  }

  _prepare(slot, player, stats, runTime, dt) {
    const ctx = this.ctx
    const level = slot.def.levels[Math.min(slot.level, slot.def.levels.length) - 1]
    ctx.player = player
    ctx.stats = stats
    ctx.weapon = slot.def
    ctx.level = level
    ctx.state = slot.state
    ctx.runTime = runTime
    ctx.dt = dt
    ctx.cooldown = level.cooldown * stats.cooldown
    ctx.amount = (level.amount ?? 1) + stats.amount
    ctx.speed = (level.speed ?? 0) * stats.speedProj
    ctx.area = (level.area ?? 1) * stats.area
    ctx.duration = (level.duration ?? 0) * stats.duration
    return ctx
  }

  update(dt, player, stats, runTime) {
    for (const slot of this.slots) {
      const ctx = this._prepare(slot, player, stats, runTime, dt)
      if (slot.module.update) slot.module.update(ctx, dt)
      if (!slot.module.fire) continue
      slot.timer -= dt
      if (slot.timer <= 0) {
        slot.timer += ctx.cooldown
        slot.module.fire(ctx)
      }
    }
  }

  render(alpha) {
    for (const slot of this.slots) {
      if (slot.module.render) {
        this.ctx.state = slot.state
        slot.module.render(this.ctx, alpha)
      }
    }
  }

  clear() {
    const ctx = this.ctx
    for (const slot of this.slots) {
      if (slot.module.detach) {
        ctx.weapon = slot.def
        ctx.state = slot.state
        slot.module.detach(ctx)
      }
    }
    this.slots.length = 0
  }
}
