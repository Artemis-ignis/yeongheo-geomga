import { rollUpgrades, applyChoice } from '../../src/combat/upgrades.js'
import { RNG } from '../../src/core/RNG.js'
import { getCharacter } from '../../src/data/characters.js'
import { STARTING_WEAPONS } from '../../src/data/unlocks.js'
import { getStage } from '../../src/data/stages.js'
import { CombatWorld2D, RUN_SECONDS_2D } from '../../src/runtime2d/CombatWorld2D.js'
import {
  BREAKTHROUGH_HEAL_FRACTION_2D,
  DAO_VOW_HEAL_FRACTION_2D,
  prioritizeEmergencyHeal2D,
  upgradeSeedForRun2D,
} from '../../src/runtime2d/Game2D.js'
import { DaoVows2D } from '../../src/runtime2d/DaoVows2D.js'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const RELEASE_BALANCE_SEEDS_2D = Object.freeze([
  1, 17, 123, 999, 2024, 424242, 987654321, 3185791507,
])

export const RELEASE_DAO_BRANCHES_2D = Object.freeze([
  Object.freeze({ id: 'sword-returning', vow: 'sword', deepening: 'returning-edge', completion: 'sword-ring' }),
  Object.freeze({ id: 'sword-piercing', vow: 'sword', deepening: 'piercing-edge', completion: 'sword-ring' }),
  Object.freeze({ id: 'frost-shards', vow: 'frost', deepening: 'frost-shards', completion: 'ice-wall' }),
  Object.freeze({ id: 'frost-line', vow: 'frost', deepening: 'frost-line', completion: 'ice-wall' }),
  Object.freeze({ id: 'spirit-purifying', vow: 'spirit', deepening: 'purifying-heart', completion: 'shadow-copy' }),
  Object.freeze({ id: 'spirit-echoing', vow: 'spirit', deepening: 'echoing-heart', completion: 'shadow-copy' }),
])

const DAO_MILESTONES = Object.freeze([
  Object.freeze({ time: 20, id: 'pledge' }),
  Object.freeze({ time: 165, id: 'deepening' }),
  Object.freeze({ time: 270, id: 'completion' }),
])

function applyOrdinaryFirstCard(world, levels, upgradeRng) {
  for (let i = 0; i < levels; i++) {
    const { player } = world
    world.enemies.damageAt(player.x, player.z, 4.6, 20 + player.level * 4, 'array')
    world.flushEnemyDeaths()
    player.heal(player.maxHp * BREAKTHROUGH_HEAL_FRACTION_2D)
    player.invulnTimer = Math.max(player.invulnTimer, 1.2)

    const choices = prioritizeEmergencyHeal2D(rollUpgrades(
      player.loadout,
      player.stats,
      upgradeRng,
      3,
      STARTING_WEAPONS,
      new Set(),
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

export function runReleaseBranch2D(seed, branch, untilSeconds = RUN_SECONDS_2D) {
  const daoVows = new DaoVows2D()
  const upgradeRng = new RNG(upgradeSeedForRun2D(seed))
  const world = new CombatWorld2D({
    character: getCharacter('seolryeong'),
    stage: getStage('jade'),
    progress: {
      trial: 0,
      statMods: [],
      reviveCharges: 0,
      unlockedWeapons: STARTING_WEAPONS,
    },
    rng: new RNG(seed),
    daoVows,
  })
  world.onLevels = (levels) => applyOrdinaryFirstCard(world, levels, upgradeRng)

  let finalBossEntryHp = null
  world.onBossWarning = (_boss, event) => {
    if (event?.final) finalBossEntryHp = world.player.hp / world.player.maxHp
  }

  let nextDash = 0.5
  let nextDao = 0
  const input = {
    moveX: 0,
    moveZ: 0,
    consumeDash: () => {
      if (world.runTime < nextDash) return false
      nextDash += 1.8
      return true
    },
  }
  const route = Object.freeze([
    Object.freeze({ moveX: 1, moveZ: 0 }),
    Object.freeze({ moveX: 0, moveZ: 1 }),
    Object.freeze({ moveX: -1, moveZ: 0 }),
    Object.freeze({ moveX: 0, moveZ: -1 }),
  ])

  const tickLimit = Math.ceil(untilSeconds * 60) + (untilSeconds >= RUN_SECONDS_2D ? 1 : 0)
  for (let tick = 0; tick < tickLimit && !world.ended; tick++) {
    const direction = route[Math.floor(world.runTime / 8) % route.length]
    input.moveX = direction.moveX
    input.moveZ = direction.moveZ
    world.update(1 / 60, input)

    while (nextDao < DAO_MILESTONES.length
      && world.runTime >= DAO_MILESTONES[nextDao].time
      && !world.ended) {
      const milestone = DAO_MILESTONES[nextDao].id
      const choiceId = milestone === 'pledge' ? branch.vow : branch[milestone]
      const snapshot = daoVows.select(milestone, choiceId)
      world.applyDaoModifiers(snapshot.combatModifiers, snapshot)
      world.daoVowSnapshot = snapshot
      world.runStats.daoMilestones = snapshot.milestone
      world.player.heal(world.player.maxHp * DAO_VOW_HEAL_FRACTION_2D)
      world.player.invulnTimer = Math.max(world.player.invulnTimer, 1.2)
      nextDao++
    }
  }

  return {
    seed,
    branch: branch.id,
    time: Number(world.runTime.toFixed(3)),
    finalBossEntryHp,
    alive: world.player.alive,
    ended: world.ended,
    victory: world.victory,
    hp: Number(world.player.hp.toFixed(2)),
    maxHp: Number(world.player.maxHp.toFixed(2)),
    level: world.player.level,
    kills: world.player.kills,
    damageTaken: Number(world.runStats.damageTaken.toFixed(2)),
    damageDealt: Number(world.runStats.damageDealt.toFixed(2)),
    bossKills: world.runStats.bossKills,
  }
}

export function summarizeReleaseBranchRuns2D(runs) {
  return RELEASE_DAO_BRANCHES_2D.map((branch) => {
    const rows = runs.filter((run) => run.branch === branch.id)
    const entries = rows.filter((run) => run.finalBossEntryHp != null)
    const victories = rows.filter((run) => run.victory)
    const hpFractions = entries.map((run) => run.finalBossEntryHp).sort((a, b) => a - b)
    const median = hpFractions.length === 0 ? null
      : hpFractions.length % 2 === 1
        ? hpFractions[Math.floor(hpFractions.length / 2)]
        : (hpFractions[hpFractions.length / 2 - 1] + hpFractions[hpFractions.length / 2]) / 2
    return {
      branch: branch.id,
      runs: rows.length,
      finalBossEntries: entries.length,
      victories: victories.length,
      winRate: rows.length ? victories.length / rows.length : 0,
      entryHpMin: hpFractions[0] ?? null,
      entryHpMedian: median,
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const branchFilter = args.find((arg) => arg.startsWith('--branch='))?.slice('--branch='.length)
  const requestedSeeds = args.filter((arg) => !arg.startsWith('--')).map(Number).filter(Number.isFinite)
  const seeds = requestedSeeds.length ? requestedSeeds : RELEASE_BALANCE_SEEDS_2D
  const branches = branchFilter
    ? RELEASE_DAO_BRANCHES_2D.filter((branch) => branch.id.startsWith(branchFilter))
    : RELEASE_DAO_BRANCHES_2D
  if (branches.length === 0) throw new RangeError(`Unknown branch filter: ${branchFilter}`)
  const runs = []
  for (const branch of branches) {
    for (const seed of seeds) {
      const run = runReleaseBranch2D(seed, branch)
      runs.push(run)
      process.stdout.write(`${JSON.stringify(run)}\n`)
    }
  }
  process.stdout.write(`${JSON.stringify({ summary: summarizeReleaseBranchRuns2D(runs) }, null, 2)}\n`)
}
