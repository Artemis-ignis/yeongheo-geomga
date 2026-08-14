import { describe, expect, it } from 'vitest'
import { rollUpgrades, applyChoice } from '../src/combat/upgrades.js'
import { RNG } from '../src/core/RNG.js'
import { BASE_STATS, getCharacter } from '../src/data/characters.js'
import { STARTING_WEAPONS } from '../src/data/unlocks.js'
import { getStage } from '../src/data/stages.js'
import { CombatWorld2D, RUN_SECONDS_2D } from '../src/runtime2d/CombatWorld2D.js'
import {
  BREAKTHROUGH_HEAL_FRACTION_2D,
  DAO_VOW_HEAL_FRACTION_2D,
  prioritizeEmergencyHeal2D,
  upgradeSeedForRun2D,
} from '../src/runtime2d/Game2D.js'
import { DaoVows2D } from '../src/runtime2d/DaoVows2D.js'

const SHOWCASE_SEED = 3185791507
const MID_BOSS_SECONDS = 180
const DAO_MILESTONE_SECONDS = Object.freeze([20, 165, 270])

function applyFirstCard(world, levels, upgradeRng) {
  for (let i = 0; i < levels; i++) {
    const { player } = world
    // Keep the production breakthrough side effects in this fixed-tick probe:
    // it is the same damage/flush/iframes path used by Game2D._breakthrough.
    world.enemies.damageAt(player.x, player.z, 4.6, 20 + player.level * 4, 'array')
    world.flushEnemyDeaths()
    player.heal(player.maxHp * BREAKTHROUGH_HEAL_FRACTION_2D)
    player.invulnTimer = Math.max(player.invulnTimer, 1.2)

    const choices = prioritizeEmergencyHeal2D(rollUpgrades(
      player.loadout, player.stats, upgradeRng, 3, STARTING_WEAPONS, new Set(),
    ), player.hp, player.maxHp)
    const choice = choices[0]
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

function liveValue(field, key) {
  let total = 0
  for (let i = 0; i < field.count; i++) total += field[key][i]
  return total
}

/**
 * A deliberately ordinary keyboard route: hold one cardinal direction for a
 * while, turn around the four directions, and press dash once per second. It
 * mirrors the isolated-browser playtest and does not inspect enemies, aim
 * attacks, or choose a stronger-than-first card.
 */
function runShowcase(
  untilSeconds = MID_BOSS_SECONDS,
  { directionSeconds = 8, dashSeconds = 1.8 } = {},
) {
  const daoVows = new DaoVows2D()
  const upgradeRng = new RNG(upgradeSeedForRun2D(SHOWCASE_SEED))
  const world = new CombatWorld2D({
    character: getCharacter('seolryeong'),
    stage: getStage('jade'),
    progress: { trial: 0, statMods: [], reviveCharges: 0, unlockedWeapons: STARTING_WEAPONS },
    rng: new RNG(SHOWCASE_SEED),
    daoVows,
  })
  world.onLevels = (levels) => applyFirstCard(world, levels, upgradeRng)

  // Match a normal player's actual input cadence. The previous one-second
  // probe retried dash faster than the authored cooldown and hid the late-run
  // crowd pressure seen in the 2560x1600 browser playtest.
  let nextDash = 0.5
  let nextDaoMilestone = 0
  const input = {
    moveX: 0,
    moveZ: 0,
    consumeDash: () => {
      if (world.runTime < nextDash) return false
      nextDash += dashSeconds
      return true
    },
  }
  const cardinalRoute = Object.freeze([
    Object.freeze({ moveX: 1, moveZ: 0 }),
    Object.freeze({ moveX: 0, moveZ: 1 }),
    Object.freeze({ moveX: -1, moveZ: 0 }),
    Object.freeze({ moveX: 0, moveZ: -1 }),
  ])

  // IEEE-754 accumulation can leave 25,200 exact 60 Hz steps a hair below
  // 420. The real rAF loop naturally supplies the crossing tick; include that
  // one boundary tick only for the full-run probe.
  const tickLimit = Math.ceil(untilSeconds * 60) + (untilSeconds >= RUN_SECONDS_2D ? 1 : 0)
  for (let tick = 0; tick < tickLimit && !world.ended; tick++) {
    const direction = cardinalRoute[Math.floor(world.runTime / directionSeconds) % cardinalRoute.length]
    input.moveX = direction.moveX
    input.moveZ = direction.moveZ
    world.update(1 / 60, input)

    while (
      nextDaoMilestone < DAO_MILESTONE_SECONDS.length
      && world.runTime >= DAO_MILESTONE_SECONDS[nextDaoMilestone]
      && !world.ended
    ) {
      const before = daoVows.snapshot()
      const milestone = before.nextMilestone
      const choiceId = milestone === 'pledge'
        ? 'sword'
        : daoVows.availableSelections(milestone)[0].id
      const next = daoVows.select(milestone, choiceId)
      world.applyDaoModifiers(next.combatModifiers, next)
      world.daoVowSnapshot = next
      world.runStats.daoMilestones = next.milestone
      world.player.heal(world.player.maxHp * DAO_VOW_HEAL_FRACTION_2D)
      world.player.invulnTimer = Math.max(world.player.invulnTimer, 1.2)
      nextDaoMilestone += 1
    }
  }

  return {
    world,
    xpBalance: world.pickups.spawnedXp
      - world.pickups.collectedXp
      - liveValue(world.pickups, 'xpValue'),
    stoneBalance: world.pickups.spawnedStones
      - world.pickups.collectedStones
      - liveValue(world.pickups, 'stoneValue'),
  }
}

describe('showcase damage-path balance', () => {
  it('keeps the pristine showcase seed alive to its 180s mid-boss', () => {
    const { world, xpBalance, stoneBalance } = runShowcase()
    const diagnosis = `level=${world.player.level}, kills=${world.player.kills}, taken=${world.runStats.damageTaken.toFixed(1)}`

    expect(BASE_STATS.maxHp).toBe(115)
    expect(world.player.alive).toBe(true)
    expect(world.runTime).toBeCloseTo(MID_BOSS_SECONDS, 8)
    expect(world.spawnedBosses.has(`mid:${world.bossSchedule[0].id}`)).toBe(true)
    expect(world.player.level, diagnosis).toBeGreaterThanOrEqual(10)
    expect(world.player.kills, diagnosis).toBeGreaterThanOrEqual(450)
    expect(world.runStats.damageTaken, diagnosis).toBeGreaterThan(5)
    expect(world.player.reviveCharges).toBe(0)
    expect(xpBalance).toBeCloseTo(0, 4)
    expect(stoneBalance).toBeCloseTo(0, 4)
  })

  it('keeps the authored 420s timeout and 180/330 boss slots unchanged', () => {
    const { world } = runShowcase()
    expect(RUN_SECONDS_2D).toBe(420)
    expect(world.bossSchedule.map((entry) => entry.t)).toEqual([180, 330])
  })

  it('carries the ordinary first-card showcase build through the final boss gate', () => {
    const { world, xpBalance, stoneBalance } = runShowcase(RUN_SECONDS_2D)

    const diagnosis = [
      `time=${world.runTime.toFixed(2)}s`,
      `hp=${world.player.hp.toFixed(1)}/${world.player.maxHp.toFixed(1)}`,
      `level=${world.player.level}`,
      `kills=${world.player.kills}`,
      `taken=${world.runStats.damageTaken.toFixed(1)}`,
      `boss=${world.boss?.def?.id ?? 'none'}:${world.boss?.active ? world.boss.hp.toFixed(1) : 'dead'}`,
      `bossKills=${world.runStats.bossKills}`,
    ].join(', ')
    expect(world.runTime, diagnosis).toBeGreaterThanOrEqual(330)
    expect(world.spawnedBosses.has(`mid:${world.bossSchedule[0].id}`)).toBe(true)
    expect(world.spawnedBosses.has(`final:${world.bossSchedule[1].id}`)).toBe(true)
    expect(world.ended).toBe(true)
    expect(world.victory, diagnosis).toBe(true)
    expect(world.player.alive).toBe(true)
    expect(world.player.level, diagnosis).toBeGreaterThanOrEqual(20)
    expect(world.player.level, diagnosis).toBeLessThanOrEqual(35)
    expect(xpBalance).toBeCloseTo(0, 4)
    expect(stoneBalance).toBeCloseTo(0, 4)
  })

  it('survives the exact slower browser-playtest input cadence through final judgment', () => {
    const { world } = runShowcase(RUN_SECONDS_2D, {
      directionSeconds: 6.5,
      dashSeconds: 3.05,
    })
    const diagnosis = [
      `time=${world.runTime.toFixed(2)}s`,
      `hp=${world.player.hp.toFixed(1)}/${world.player.maxHp.toFixed(1)}`,
      `level=${world.player.level}`,
      `kills=${world.player.kills}`,
      `taken=${world.runStats.damageTaken.toFixed(1)}`,
      `bossKills=${world.runStats.bossKills}`,
    ].join(', ')
    expect(world.ended, diagnosis).toBe(true)
    expect(world.victory, diagnosis).toBe(true)
    expect(world.player.alive, diagnosis).toBe(true)
  })
})
