import { describe, expect, it } from 'vitest'
import { rollUpgrades, applyChoice } from '../src/combat/upgrades.js'
import { RNG } from '../src/core/RNG.js'
import { BASE_STATS, getCharacter } from '../src/data/characters.js'
import { STARTING_WEAPONS } from '../src/data/unlocks.js'
import { getStage } from '../src/data/stages.js'
import { WAVES, waveAt } from '../src/data/waves.js'
import {
  CombatWorld2D, openingIncomingDamageScale2D, openingMercyIFrames2D,
} from '../src/runtime2d/CombatWorld2D.js'
import { BREAKTHROUGH_HEAL_FRACTION_2D, upgradeSeedForRun2D } from '../src/runtime2d/Game2D.js'

const OPENING_SECONDS = 60
const OPENING_TICKS = OPENING_SECONDS * 60
const SEEDS = [1, 17, 123, 999, 2024, 31415, 424242, 777777, 987654321, 0xdeadbeef]

function upgradeScore(choice, player) {
  if (choice.kind === 'evolution') return 10_000
  if (choice.kind === 'consumable') {
    return choice.id === 'heal' ? 1_400 : choice.id === 'purge' ? 1_200 : 50
  }
  if (choice.kind === 'passive') {
    const value = {
      guardianAura: 1_150,
      goldenCore: 850,
      lightBody: 760,
      spiritRoot: 670,
      farSight: 560,
      swordArt: 650,
      heartMethod: 500,
      cloneArt: 470,
      destinedBond: 300,
    }
    return (value[choice.id] ?? 300) + (player.loadout.passives[choice.id] ?? 0) * 8
  }
  if (choice.kind === 'weapon') {
    const level = player.loadout.weapons[choice.id] ?? 0
    // Fill the four fresh-save weapon slots before specialising the first one.
    return level === 0
      ? (Object.keys(player.loadout.weapons).length < 4 ? 950 : 250)
      : 700 + level * 30
  }
  return 0
}

function applyOpeningLevel(world, levels, upgradeRng) {
  const player = world.player
  for (let i = 0; i < levels; i++) {
    // This is the production breakthrough contract, kept in the test harness
    // so level-up choices do not pause a fixed-tick survival measurement.
    world.enemies.damageAt(player.x, player.z, 4.6, 20 + player.level * 4, 'array')
    world.enemies.flushDeaths()
    player.heal(player.maxHp * BREAKTHROUGH_HEAL_FRACTION_2D)
    player.invulnTimer = Math.max(player.invulnTimer, 1.2)

    const choices = rollUpgrades(
      player.loadout, player.stats, upgradeRng, 3, STARTING_WEAPONS, new Set(),
    )
    const choice = choices.reduce((best, candidate) => (
      upgradeScore(candidate, player) > upgradeScore(best, player) ? candidate : best
    ), choices[0])
    applyChoice(player.loadout, choice)
    if (choice.kind === 'consumable') {
      if (choice.id === 'heal') player.heal(player.maxHp * 0.3)
      else if (choice.id === 'purge') world.purge()
      else if (choice.id === 'stones') player.stones += 200
    }
    player.recomputeStats()
    world.rebuildLoadoutCache()
  }
}

function makeOpeningWorld(seed) {
  const upgradeRng = new RNG(upgradeSeedForRun2D(seed))
  const world = new CombatWorld2D({
    character: getCharacter('seolryeong'),
    stage: getStage('jade'),
    progress: { trial: 0, statMods: [], reviveCharges: 0 },
    rng: new RNG(seed),
  })
  world.onLevels = (levels) => applyOpeningLevel(world, levels, upgradeRng)
  return world
}

function runOpening(seed) {
  const world = makeOpeningWorld(seed)
  const input = {
    moveX: 0,
    moveZ: 0,
    // A deterministic kiting rule: turn away from a close enemy, orbit the
    // centre at a readable distance, and dash whenever the dash is available.
    consumeDash: () => {
      const index = world.enemies.nearest(world.player.x, world.player.z)
      if (index < 0) return false
      return Math.hypot(
        world.enemies.x[index] - world.player.x,
        world.enemies.z[index] - world.player.z,
      ) < 8
    },
  }

  for (let tick = 0; tick < OPENING_TICKS && !world.ended; tick++) {
    const player = world.player
    const index = world.enemies.nearest(player.x, player.z)
    const radius = Math.hypot(player.x, player.z)
    const enemyDistance = index >= 0
      ? Math.hypot(world.enemies.x[index] - player.x, world.enemies.z[index] - player.z)
      : Infinity

    if (index >= 0 && enemyDistance < 9) {
      const dx = player.x - world.enemies.x[index]
      const dz = player.z - world.enemies.z[index]
      const distance = Math.hypot(dx, dz) || 1
      input.moveX = dx / distance
      input.moveZ = dz / distance
    } else if (radius < 8) {
      const distance = radius || 1
      input.moveX = player.x / distance
      input.moveZ = player.z / distance
    } else if (radius > 13) {
      input.moveX = -player.x / radius
      input.moveZ = -player.z / radius
    } else {
      input.moveX = -player.z / (radius || 1)
      input.moveZ = player.x / (radius || 1)
    }
    world.update(1 / 60, input)
  }

  return {
    alive: world.player.alive,
    time: world.runTime,
    level: world.player.level,
    hp: world.player.hp,
  }
}

describe('opening combat balance', () => {
  it('ramps contact damage through the tutorial minute without a cliff', () => {
    expect(openingIncomingDamageScale2D(0)).toBeCloseTo(0.38)
    expect(openingIncomingDamageScale2D(30)).toBeCloseTo(0.69)
    expect(openingIncomingDamageScale2D(60)).toBe(1)
    expect(openingIncomingDamageScale2D(120)).toBe(1)
    expect(openingMercyIFrames2D(0)).toBeCloseTo(1.02)
    expect(openingMercyIFrames2D(30)).toBeCloseTo(0.85)
    expect(openingMercyIFrames2D(60)).toBeCloseTo(0.68)
  })
  it('holds the intended opening rate, enemy reads, and magnet range', () => {
    const rateAt = (seconds) => {
      const wave = waveAt(seconds)
      return wave.perSpawn / wave.spawnInterval
    }
    // Four-body packs at a slower pulse preserve visible lanes around the
    // heroine. The prior 3+ enemies/s contract produced the debug-stress wall
    // seen in the actual Chrome capture even though the simulation survived.
    expect(rateAt(0)).toBeCloseTo(4 / 2.15, 2)
    expect(rateAt(30)).toBeCloseTo(4 / 1.85, 2)
    expect(BASE_STATS.magnet).toBeGreaterThanOrEqual(6.5)
    expect(BASE_STATS.magnet).toBeLessThanOrEqual(7)

    const firstCharger = WAVES.find((wave) => wave.types.includes('jadeSerpent'))
    const firstRangedOrSplitter = WAVES.find((wave) => (
      wave.types.includes('talismanGhost') || wave.types.includes('bloodScorpion')
    ))
    expect(firstCharger?.t).toBe(0)
    expect(firstRangedOrSplitter?.t).toBeGreaterThanOrEqual(180)
    for (const time of [60, 90, 120]) {
      const silhouettes = new Set(waveAt(time).types)
      expect(silhouettes.size, `${time}s wave repeats one silhouette`).toBeGreaterThanOrEqual(2)
      const wispRatio = waveAt(time).types.filter((type) => type === 'wisp').length
        / waveAt(time).types.length
      expect(wispRatio, `${time}s wave loses fodder identity`).toBeGreaterThanOrEqual(1 / 3)
      expect(wispRatio, `${time}s wave becomes a one-silhouette stamp wall`).toBeLessThanOrEqual(0.5)
    }
  })

  it('keeps ten fixed-seed opening runs alive through 60s', () => {
    const results = SEEDS.map(runOpening)
    for (const [index, result] of results.entries()) {
      expect(result.alive, `seed ${SEEDS[index]} ended at ${result.time.toFixed(2)}s`).toBe(true)
      expect(result.time).toBeCloseTo(OPENING_SECONDS, 8)
      expect(result.level, `seed ${SEEDS[index]} level`).toBeGreaterThanOrEqual(5)
      expect(result.hp, `seed ${SEEDS[index]} hp`).toBeGreaterThanOrEqual(10)
    }
  })
})
