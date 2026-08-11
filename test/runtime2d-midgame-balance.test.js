import { describe, expect, it } from 'vitest'
import { rollUpgrades, applyChoice } from '../src/combat/upgrades.js'
import { RNG } from '../src/core/RNG.js'
import { getCharacter } from '../src/data/characters.js'
import { STARTING_WEAPONS } from '../src/data/unlocks.js'
import { getStage } from '../src/data/stages.js'
import { CombatWorld2D } from '../src/runtime2d/CombatWorld2D.js'
import { BREAKTHROUGH_HEAL_FRACTION_2D, upgradeSeedForRun2D } from '../src/runtime2d/Game2D.js'

const MID_BOSS_SECONDS = 180
const SEEDS = [1, 17, 123, 999]

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
    return level === 0
      ? (Object.keys(player.loadout.weapons).length < 4 ? 950 : 250)
      : 700 + level * 30
  }
  return 0
}

function applyLevels(world, levels, upgradeRng) {
  for (let i = 0; i < levels; i++) {
    // Match the production breakthrough side effect without pausing the
    // fixed-tick probe: level-up damage flushes deaths and creates pickups.
    world.enemies.damageAt(
      world.player.x,
      world.player.z,
      4.6,
      20 + world.player.level * 4,
      'array',
    )
    world.enemies.flushDeaths()
    world.player.heal(world.player.maxHp * BREAKTHROUGH_HEAL_FRACTION_2D)
    world.player.invulnTimer = Math.max(world.player.invulnTimer, 1.2)

    const choices = rollUpgrades(
      world.player.loadout,
      world.player.stats,
      upgradeRng,
      3,
      STARTING_WEAPONS,
      new Set(),
    )
    const choice = choices.reduce((best, candidate) => (
      upgradeScore(candidate, world.player) > upgradeScore(best, world.player)
        ? candidate
        : best
    ), choices[0])
    applyChoice(world.player.loadout, choice)
    if (choice.kind === 'consumable') {
      if (choice.id === 'heal') world.player.heal(world.player.maxHp * 0.3)
      else if (choice.id === 'purge') world.purge()
      else if (choice.id === 'stones') world.player.stones += 200
    }
    world.player.recomputeStats()
    world.rebuildLoadoutCache()
  }
}

function liveValue(field, values) {
  let total = 0
  for (let i = 0; i < field.count; i++) total += values[i]
  return total
}

function runMidgame(seed) {
  const upgradeRng = new RNG(upgradeSeedForRun2D(seed))
  const world = new CombatWorld2D({
    character: getCharacter('seolryeong'),
    stage: getStage('jade'),
    progress: { trial: 0, statMods: [], reviveCharges: 0 },
    rng: new RNG(seed),
  })
  world.onLevels = (levels) => applyLevels(world, levels, upgradeRng)
  const input = {
    moveX: 0,
    moveZ: 0,
    consumeDash: () => {
      const index = world.enemies.nearest(world.player.x, world.player.z)
      return index >= 0 && Math.hypot(
        world.enemies.x[index] - world.player.x,
        world.enemies.z[index] - world.player.z,
      ) < 8
    },
  }

  for (let tick = 0; tick < MID_BOSS_SECONDS * 60 && !world.ended; tick++) {
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
    kills: world.player.kills,
    midBossReached: world.spawnedBosses.has(`mid:${world.bossSchedule[0].id}`),
    xpBalance: world.pickups.spawnedXp
      - world.pickups.collectedXp
      - liveValue(world.pickups, world.pickups.xpValue),
    stoneBalance: world.pickups.spawnedStones
      - world.pickups.collectedStones
      - liveValue(world.pickups, world.pickups.stoneValue),
  }
}

describe('60-180s 2D combat pacing', () => {
  it('keeps every fixed-seed damage route alive into the 180s mid-boss', () => {
    const results = SEEDS.map(runMidgame)

    for (const [index, result] of results.entries()) {
      const seed = SEEDS[index]
      expect(result.alive, `seed ${seed} died at ${result.time.toFixed(2)}s`).toBe(true)
      expect(result.time, `seed ${seed} run time`).toBeCloseTo(MID_BOSS_SECONDS, 8)
      expect(result.midBossReached, `seed ${seed} mid-boss`).toBe(true)
      // Reaching the checkpoint must represent an active run, not a harmless
      // low-density simulation: every seed has a meaningful build and clear.
      expect(result.level, `seed ${seed} level`).toBeGreaterThanOrEqual(13)
      expect(result.kills, `seed ${seed} kills`).toBeGreaterThanOrEqual(600)
      expect(result.xpBalance, `seed ${seed} XP ledger`).toBeCloseTo(0, 4)
      expect(result.stoneBalance, `seed ${seed} stone ledger`).toBeCloseTo(0, 4)
    }
  })
})
