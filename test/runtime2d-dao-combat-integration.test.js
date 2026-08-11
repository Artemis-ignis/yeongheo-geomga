import { describe, expect, it, vi } from 'vitest'
import { RNG } from '../src/core/RNG.js'
import { getCharacter } from '../src/data/characters.js'
import { getStage } from '../src/data/stages.js'
import { DaoVows2D } from '../src/runtime2d/DaoVows2D.js'
import {
  CombatWorld2D,
  MAX_PROJECTILES_2D,
  MAX_WEAPON_FIELDS_2D,
} from '../src/runtime2d/CombatWorld2D.js'
import { Game2D } from '../src/runtime2d/Game2D.js'

const idle = { moveX: 0, moveZ: 0, consumeDash: () => false }

function worldFor(vowId, deepening = null, completion = null, seed = 701) {
  const dao = new DaoVows2D({ vowId })
  if (deepening) dao.select('deepening', deepening)
  if (completion) dao.select('completion', completion)
  return new CombatWorld2D({
    character: getCharacter('seolryeong'),
    stage: getStage('jade'),
    progress: { trial: 0, statMods: [], reviveCharges: 0 },
    rng: new RNG(seed),
    daoVows: dao,
  })
}

describe('DaoCombatRuntime2D gameplay integration', () => {
  it('is world-owned, ticks exactly once, and applies cumulative snapshots without reset', () => {
    const world = worldFor('sword', null, null)
    expect(world.daoRuntime).toBeTruthy()
    world.update(1 / 60, { moveX: 1, moveZ: 0, consumeDash: () => false })
    const chargeBefore = world.daoRuntime.swordCharge
    const tickBefore = world.daoRuntime.tickIndex

    const dao = new DaoVows2D({ vowId: 'sword' })
    dao.select('deepening', 'returning-edge')
    world.applyDaoModifiers(dao.snapshot().combatModifiers, dao.snapshot())

    expect(world.daoRuntime.tickIndex).toBe(tickBefore)
    expect(world.daoRuntime.swordCharge).toBeCloseTo(chargeBefore, 8)
    world.update(1 / 60, { moveX: 1, moveZ: 0, consumeDash: () => false })
    expect(world.daoRuntime.tickIndex).toBe(tickBefore + 1)
  })

  it('routes a dash once through runtime, with a stable world-tick id and no legacy duplicate', () => {
    const world = worldFor('spirit', 'purifying-heart', 'shadow-copy')
    const actions = []
    world.onDaoAction = (action) => actions.push(action)
    world.daoRuntime.setSpiritGauge(world.daoRuntime.gaugeMax - 18)
    world.pickups.spawn(0, 0, 1)
    world.update(1 / 60, idle)
    world.player.dashCooldown = 0
    const effectBeforeDash = world.effects.count
    let dash = true
    world.update(1 / 60, { moveX: 0, moveZ: 0, consumeDash: () => {
      const result = dash
      dash = false
      return result
    } })

    const purges = actions.filter((action) => action.type === 'spirit-purge')
    expect(purges).toHaveLength(1)
    expect(purges[0].source).toBe('dash:2:1')
    // Departure streak + arrival flash + the single Dao purge effect. The
    // extra arrival cue is presentation only; the Dao action remains unique.
    expect(world.effects.count - effectBeforeDash).toBe(3)
  })

  it('executes the completed sword ring once through the runtime action path', () => {
    const world = worldFor('sword', 'returning-edge', 'sword-ring')
    world.enemies.spawnTimer = Infinity
    world.weaponTimers.set('flyingSword', 10)
    world.enemies.spawn('wolf', 0, 6, 0)
    world.enemies.grid.clear()
    for (let i = 0; i < world.enemies.count; i++) {
      world.enemies.grid.insert(i, world.enemies.x[i], world.enemies.z[i])
    }

    const actions = []
    world.onDaoAction = (action) => actions.push(action)
    const damageAt = vi.spyOn(world.enemies, 'damageAt')
    const effectBefore = world.effects.count

    let pressed = true
    world.player.dashCooldown = 0
    world.update(1 / 60, {
      moveX: 0,
      moveZ: 0,
      consumeDash: () => {
        const current = pressed
        pressed = false
        return current
      },
    })

    const rings = actions.filter((action) => action.type === 'sword-ring')
    expect(rings).toHaveLength(1)
    expect(rings[0]).toMatchObject({
      dashId: 'dash:1:1',
      radius: 4.2,
      push: 8,
      duration: 0.45,
      position: { x: 0, z: 6.48 },
    })
    expect(damageAt).toHaveBeenCalledTimes(1)
    expect(world.enemies.hp[0]).toBeLessThan(32)
    // dash VFX + ring VFX; a hit flash may add one more effect.
    expect(world.effects.count - effectBefore).toBeGreaterThanOrEqual(2)
    expect(world._applyDaoDash({ fromX: 0, fromZ: 0, toX: 0, toZ: 6 })).toBe(false)
    damageAt.mockRestore()
  })

  it('consumes Dao piercing and returning timing on the custom sword projectile', () => {
    const world = worldFor('sword', 'returning-edge', 'sword-ring')
    world.projectiles.count = 0
    world._dispatchDaoAction({
      type: 'sword-fan', mode: 'returning', count: 1, spread: 0,
      returnHits: 1, pierceAdd: 1, returnDelay: 0.26, origin: { x: 0, z: 0 },
    })
    expect(world.projectiles.pierce[0]).toBe(3)
    expect(world.projectiles.returnAt[0]).toBeCloseTo(0.26, 5)

    world.projectiles.count = 0
    world._dispatchDaoAction({
      type: 'sword-fan', mode: 'additional', count: 1, spread: 0,
      returnHits: 0, pierceAdd: 2, returnDelay: 0, origin: { x: 0, z: 0 },
    })
    expect(world.projectiles.pierce[0]).toBe(3)
    expect(world.projectiles.returnAt[0]).toBe(0)
  })

  it('uses the bounded field pool for a real frost wall segment, not a midpoint disc', () => {
    const world = worldFor('frost', 'frost-shards', 'ice-wall')
    const inside = world.enemies.spawn('wolf', 3, 0, 0)
    const outside = world.enemies.spawn('wolf', 3, 4, 0)
    expect(inside && outside).toBe(true)
    world.enemies.grid.clear()
    for (let i = 0; i < world.enemies.count; i++) {
      world.enemies.grid.insert(i, world.enemies.x[i], world.enemies.z[i])
    }
    const insideHp = world.enemies.hp[0]
    const outsideHp = world.enemies.hp[1]
    world._dispatchDaoAction({
      type: 'frost-wall',
      position: { x: 3, z: 0 }, distance: 6, radius: 0.6, duration: 1,
      slowMultiplier: 0.4, fromFieldId: 0, toFieldId: 0,
    })
    const fieldIndex = 0
    expect(world.weaponFields.count).toBe(1)
    expect(world.weaponFields.segment[fieldIndex]).toBe(1)
    expect(world.weaponFields.fromX[fieldIndex]).toBeCloseTo(0, 5)
    expect(world.weaponFields.toX[fieldIndex]).toBeCloseTo(6, 5)
    world.weaponFields.tick[fieldIndex] = 0
    world.weaponFields.update(1 / 60)
    expect(world.enemies.hp[0]).toBeLessThan(insideHp)
    expect(world.enemies.hp[1]).toBe(outsideHp)
  })

  it('emits pickup-chain once per UID while preserving the XP ledger and authored gauge gain', () => {
    const world = worldFor('spirit')
    const actions = []
    world.onDaoAction = (action) => actions.push(action)
    world.pickups.spawn(0, 0, 10, false)
    world.update(1 / 60, idle)
    world.update(1 / 60, idle)
    const pickups = actions.filter((action) => action.type === 'spirit-pickup-chain')
    expect(pickups).toHaveLength(1)
    expect(pickups[0].gain).toBe(18)
    expect(world.pickups.collectedXp).toBe(10)
    expect(world.pickups.count).toBe(0)
  })

  it('queues frozen purge deaths for the next fixed tick once, including the shard action', () => {
    const world = worldFor('frost', 'frost-shards')
    const actions = []
    world.onDaoAction = (action) => actions.push(action)
    world.enemies.spawn('wolf', 1, 0, 0)
    world.enemies.freezeTimer[0] = 1
    world.purge()
    world.purge()
    world.update(1 / 60, idle)
    world.update(1 / 60, idle)
    expect(actions.filter((action) => action.type === 'frost-death-shards')).toHaveLength(1)
  })

  it('drains pending frozen deaths before a direct give-up final tick', () => {
    const world = worldFor('frost', 'frost-shards')
    const actions = []
    world.onDaoAction = (action) => actions.push(action)
    world.enemies.spawn('wolf', 1, 0, 0)
    world.enemies.freezeTimer[0] = 1
    world.enemies.dead[0] = 1
    world.purge()
    expect(world._daoPendingDeathEvents).toHaveLength(1)
    world.endRun(false)
    expect(actions.filter((action) => action.type === 'frost-death-shards')).toHaveLength(1)
    expect(world.ended).toBe(true)
  })

  it('does not lose run-end shadow actions before world end', () => {
    const world = worldFor('spirit', 'purifying-heart', 'shadow-copy')
    const actions = []
    world.onDaoAction = (action) => actions.push(action)
    world.daoRuntime.setSpiritGauge(world.daoRuntime.gaugeMax - 18)
    world.pickups.spawn(0, 0, 1)
    world.update(1 / 60, idle)
    world.player.alive = false
    world.update(1 / 60, idle)
    expect(world.ended).toBe(true)
    expect(actions.map((action) => action.type)).toEqual(expect.arrayContaining([
      'spirit-shadow-pull', 'spirit-attack-clone',
    ]))
  })

  it('dispatches all ten authored actions through gameplay pools/callbacks', () => {
    const world = worldFor('spirit', 'purifying-heart', 'shadow-copy')
    const dispatched = []
    world.onDaoAction = (action) => dispatched.push(action.type)
    const actions = [
      { type: 'sword-fan', mode: 'additional', count: 2, spread: 0.2, returnHits: 0, origin: { x: 0, z: 0 } },
      { type: 'frost-field', fieldId: 1, dashSerial: 1, position: { x: 0, z: 0 }, radius: 2, duration: 1, slowMultiplier: 0.4 },
      { type: 'frost-slow', fieldId: 1, position: { x: 0, z: 0 }, radius: 2, duration: 1, slowMultiplier: 0.4 },
      { type: 'frost-wall', position: { x: 1, z: 0 }, distance: 2, radius: 0.5, duration: 1, slowMultiplier: 0.4, fromFieldId: 1, toFieldId: 1 },
      { type: 'frost-death-shards', position: { x: 0, z: 0 }, count: 3, radius: 1.4, angle: 0 },
      { type: 'spirit-pickup-chain', chain: 1, gauge: 18, gain: 18 },
      { type: 'spirit-overcharge', cycle: 1, gauge: 200, maxGauge: 200, duration: 3, attackDensity: 1.5, magnetMultiplier: 1.4 },
      { type: 'spirit-purge', position: { x: 0, z: 0 }, radius: 4, cost: 40, gauge: 160, cycle: 1 },
      { type: 'spirit-shadow-pull', radius: 4, count: 2, cycle: 1, reason: 'run-end' },
      { type: 'spirit-attack-clone', count: 2, cycle: 1, angle: 0, damageMultiplier: 1.5, reason: 'run-end' },
    ]
    for (const action of actions) world._dispatchDaoAction(action)
    expect(new Set(dispatched)).toEqual(new Set(actions.map((action) => action.type)))
    expect(world.projectiles.count).toBeGreaterThan(0)
    expect(world.weaponFields.count).toBeGreaterThan(0)
    expect(world.projectiles.count).toBeLessThanOrEqual(MAX_PROJECTILES_2D)
    expect(world.weaponFields.count).toBeLessThanOrEqual(MAX_WEAPON_FIELDS_2D)
    expect(world.player.daoRuntimeBoost?.active).toBe(true)
  })

  it('honors attack-clone damage multipliers and consumes shadow count without expansion', () => {
    const world = worldFor('spirit', 'purifying-heart', 'shadow-copy')
    world._dispatchDaoAction({
      type: 'spirit-attack-clone', count: 1, angle: 0, damageMultiplier: 1.5,
    })
    expect(world.projectiles.damage[0]).toBeCloseTo(22.5)

    const pull = vi.spyOn(world.enemies, 'pullLimitedAt')
    world._dispatchDaoAction({ type: 'spirit-shadow-pull', radius: 4, count: 2 })
    expect(pull).toHaveBeenCalledWith(0, 0, 4, 2, 4, 1 / 60)
    pull.mockRestore()
  })

  it('turns spirit pickup chains into an immediate combat pulse', () => {
    const world = worldFor('spirit')
    const damageAt = vi.spyOn(world.enemies, 'damageAt')
    world._dispatchDaoAction({ type: 'spirit-pickup-chain', chain: 3, gauge: 54, gain: 18 })
    expect(damageAt).toHaveBeenCalledWith(
      world.player.x,
      world.player.z,
      expect.any(Number),
      expect.any(Number),
      'thunder',
    )
    const [, , radius, damage] = damageAt.mock.calls[0]
    expect(radius).toBeGreaterThanOrEqual(3.5)
    expect(damage).toBeGreaterThan(0)
    damageAt.mockRestore()
  })

  it('keeps action pools bounded when Dao dispatch arrives at capacity', () => {
    const world = worldFor('sword')
    for (let i = 0; i < MAX_PROJECTILES_2D; i++) {
      world.projectiles.spawn({ x: 0, z: 0, dx: 1, dz: 0, speed: 1, life: 5 })
    }
    for (let i = 0; i < MAX_WEAPON_FIELDS_2D; i++) {
      world.weaponFields.spawn({ x: i, z: 0, life: 5, radius: 1 })
    }
    world._dispatchDaoAction({
      type: 'sword-fan', mode: 'additional', count: 8, spread: 0.2, returnHits: 0, origin: { x: 0, z: 0 },
    })
    world._dispatchDaoAction({
      type: 'frost-wall', position: { x: 0, z: 0 }, distance: 2, radius: 1, duration: 1,
      slowMultiplier: 0.4, fromFieldId: 0, toFieldId: 0,
    })
    expect(world.projectiles.count).toBe(MAX_PROJECTILES_2D)
    expect(world.weaponFields.count).toBe(MAX_WEAPON_FIELDS_2D)
    expect(world.projectiles.dropped).toBeGreaterThan(0)
    expect(world.weaponFields.dropped).toBeGreaterThan(0)
  })

  it('connects Dao actions to Game2D HUD/banner/audio and can be cleaned up', () => {
    const game = Object.create(Game2D.prototype)
    game._hudNeedsRefresh = false
    game.state = 'playing'
    game.audio = { play: vi.fn(), playWeaponCue: vi.fn(() => true) }
    game._banner = vi.fn()
    game._audioPanFor = vi.fn(() => 0)
    game.world = { player: { x: 0, z: 0 } }
    expect(Game2D.prototype._handleDaoAction.call(game, {
      type: 'spirit-overcharge', cycle: 1,
    })).toBe(true)
    expect(game._hudNeedsRefresh).toBe(true)
    expect(game.audio.play).toHaveBeenCalledWith('breakthrough')
    expect(game._banner).toHaveBeenCalledWith('심맥 · 과충전', 1.8)
  })

  it('keeps Dao audio single-owned and budgets repeated voices/banners', () => {
    const game = Object.create(Game2D.prototype)
    game._hudNeedsRefresh = false
    game.state = 'playing'
    game.audio = { play: vi.fn(), playWeaponCue: vi.fn(() => true) }
    game._banner = vi.fn()
    game._audioPanFor = vi.fn(() => 0)

    for (const type of ['sword-fan', 'frost-field', 'frost-wall', 'spirit-attack-clone']) {
      Game2D.prototype._handleDaoAction.call(game, { type })
    }
    Game2D.prototype._handleDaoAction.call(game, { type: 'frost-slow' })
    Game2D.prototype._handleDaoAction.call(game, { type: 'frost-death-shards' })

    expect(game.audio.playWeaponCue.mock.calls.length).toBeLessThanOrEqual(3)
    expect(game._banner).toHaveBeenCalledTimes(1)
    expect(game._banner).toHaveBeenCalledWith('설맥 · 빙벽이 맞물렸습니다', 0.9)
  })

  it('does not replay Dao frost field audio on persistent ticks', () => {
    const world = worldFor('frost')
    world.onWeaponAudio = vi.fn()
    world._dispatchDaoAction({
      type: 'frost-field', fieldId: 1, position: { x: 0, z: 0 }, radius: 2,
      duration: 1, slowMultiplier: 0.4,
    })
    world.weaponFields.tick[0] = 0
    world.weaponFields.update(1 / 60)
    expect(world.onWeaponAudio).not.toHaveBeenCalled()
  })
})
