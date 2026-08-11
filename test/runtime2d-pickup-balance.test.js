import { describe, expect, it } from 'vitest'
import { RNG } from '../src/core/RNG.js'
import { getCharacter } from '../src/data/characters.js'
import { getStage } from '../src/data/stages.js'
import { CombatWorld2D, PICKUP_MERGE_RADIUS_2D } from '../src/runtime2d/CombatWorld2D.js'

function makeWorld(seed = 17) {
  return new CombatWorld2D({
    character: getCharacter('seolryeong'),
    stage: getStage('jade'),
    progress: { trial: 0, statMods: [], reviveCharges: 0 },
    rng: new RNG(seed),
  })
}

function liveValue(field, values) {
  let total = 0
  for (let i = 0; i < field.count; i++) total += values[i]
  return total
}

describe('2D pickup ledgers', () => {
  it('compacts a local kill cluster without merging distinct reward fields', () => {
    const world = makeWorld()
    world.pickups.spawn(0, 0, 2, false)
    world.pickups.spawn(PICKUP_MERGE_RADIUS_2D * 0.9, 0, 3, false)
    expect(world.pickups.count).toBe(1)
    expect(world.pickups.xpValue[0]).toBe(5)

    world.pickups.spawn(PICKUP_MERGE_RADIUS_2D * 2.1, 0, 7, false)
    expect(world.pickups.count).toBe(2)
    expect(liveValue(world.pickups, world.pickups.xpValue)).toBe(12)
    expect(world.pickups.spawnedXp).toBe(12)
  })

  it('defers level callbacks until compaction and preserves XP and stone value', () => {
    const world = makeWorld()

    // Put a stone before the XP pickup so the old synchronous callback would
    // re-enter while the descending swap-remove loop still owns index 0.
    world.pickups.spawn(0, 0, 5, true)
    world.pickups.spawn(0.5, 0, 15, false)
    world.enemies.spawn('wisp', 0, 0, 0)
    world.enemies.dead[0] = 1

    let callbackCount = 0
    let countAtCallback = -1
    world.pickups.update(0, world.player, (levels) => {
      callbackCount += levels
      countAtCallback = world.pickups.count
      // This is the production breakthrough side effect: a level can flush a
      // death and append a new XP pickup while the callback is running.
      world.enemies.flushDeaths()
    })

    expect(callbackCount).toBe(1)
    // Both original slots are gone before the callback is allowed to mutate
    // the pool. The flush above therefore leaves one new, fully accounted XP
    // slot instead of changing the loop's cursor mid-iteration.
    expect(countAtCallback).toBe(0)
    expect(world.pickups.count).toBe(1)
    expect(world.pickups.dropped).toBe(0)

    const liveXp = liveValue(world.pickups, world.pickups.xpValue)
    const liveStones = liveValue(world.pickups, world.pickups.stoneValue)
    expect(world.pickups.spawnedXp - world.pickups.collectedXp - liveXp).toBeCloseTo(0, 6)
    expect(world.pickups.spawnedStones - world.pickups.collectedStones - liveStones).toBeCloseTo(0, 6)
    expect(world.player.stones).toBeCloseTo(world.pickups.collectedStones, 6)
  })
})
