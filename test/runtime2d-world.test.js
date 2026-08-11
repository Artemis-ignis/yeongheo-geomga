import { describe, expect, it } from 'vitest'
import { RNG } from '../src/core/RNG.js'
import { getCharacter } from '../src/data/characters.js'
import { ENEMIES } from '../src/data/enemies.js'
import { getStage } from '../src/data/stages.js'
import { DaoVows2D } from '../src/runtime2d/DaoVows2D.js'
import {
  CombatWorld2D, FINAL_BOSS_PHASE_GATE_SECONDS_2D, FINAL_BOSS_WAVE_DENSITY_2D,
  MAX_ENEMIES_2D, MAX_PICKUPS_2D, MAX_PROJECTILES_2D,
} from '../src/runtime2d/CombatWorld2D.js'
import { MIN_TELEGRAPH_SECONDS_2D } from '../src/runtime2d/BossPatterns2D.js'
import { getWeapon } from '../src/data/weapons.js'

function makeWorld(seed = 123) {
  return new CombatWorld2D({
    character: getCharacter('seolryeong'),
    stage: getStage('jade'),
    progress: { trial: 0, statMods: [], reviveCharges: 0 },
    rng: new RNG(seed),
  })
}

const idleInput = { moveX: 0, moveZ: 0, consumeDash: () => false }

function pickupTotals(pickups) {
  let xp = 0
  let stones = 0
  for (let i = 0; i < pickups.count; i++) {
    xp += pickups.xpValue[i]
    stones += pickups.stoneValue[i]
  }
  return { xp, stones, value: xp + stones }
}

describe('CombatWorld2D', () => {
  it('exposes borrowed typed-array render views and preserves the start weapon', () => {
    const world = makeWorld()
    expect(Object.isFrozen(world.snapshot)).toBe(true)
    expect(world.snapshot.enemies.x).toBeInstanceOf(Float32Array)
    expect(world.snapshot.projectiles.x).toBeInstanceOf(Float32Array)
    expect(world.snapshot.pickups.x).toBeInstanceOf(Float32Array)
    expect(world.weaponCache).toEqual([{ id: 'flyingSword', level: 1 }])
  })

  it('runs the canonical opening wave and weapon on a fixed tick', () => {
    const world = makeWorld()
    for (let i = 0; i < 120; i++) world.update(1 / 60, idleInput)
    expect(world.runTime).toBeCloseTo(2)
    expect(world.enemies.count).toBeGreaterThan(0)
    expect(world.projectiles.count).toBeGreaterThan(0)
    world.player.attackTimer = 0
    world._fireWeapon('flyingSword', 1)
    expect(world.player.attackTimer).toBeGreaterThan(0)
  })

  it('emits semantic dash, explicit-heal, and enemy-death feedback events', () => {
    const world = makeWorld()
    const feedback = { dash: [], heal: [], death: [] }
    world.onPlayerDash = (event) => feedback.dash.push(event)
    world.onPlayerHeal = (amount, source) => feedback.heal.push({ amount, source })
    world.onEnemyDeath = (event) => feedback.death.push(event)

    let dash = true
    world.player.update(1 / 60, {
      moveX: 1, moveZ: 0,
      consumeDash: () => { const pressed = dash; dash = false; return pressed },
    })
    expect(feedback.dash).toHaveLength(1)
    expect(feedback.dash[0].toX).toBeGreaterThan(feedback.dash[0].fromX)

    world.player.hp = world.player.maxHp - 20
    world.player.heal(5)
    expect(feedback.heal).toEqual([])
    world.player.heal(7, 'spring')
    expect(feedback.heal).toEqual([{ amount: 7, source: 'spring' }])

    world.enemies.spawn('wolf', 3, 0, world.runTime)
    world.enemies.dead[0] = 1
    world.flushEnemyDeaths()
    expect(feedback.death).toHaveLength(1)
    expect(feedback.death[0]).toMatchObject({ enemyId: 'wolf', elite: false })
  })

  it('opens with a readable mixed pack instead of six repeated silhouettes', () => {
    const world = makeWorld()
    world.enemies.update(1 / 60, 1 / 60, world.player)
    const ids = Array.from({ length: world.enemies.count }, (_, i) => ENEMIES[world.enemies.type[i]].id)
    expect(ids).toContain('wisp')
    expect(ids).toContain('wolf')
    expect(new Set(ids).size).toBeGreaterThan(1)
  })

  it('filters 2D wave packs through the selected stage roster', () => {
    const stage = { ...getStage('jade'), roster: ['wolf'] }
    const world = new CombatWorld2D({
      character: getCharacter('seolryeong'), stage,
      progress: { trial: 0, statMods: [], reviveCharges: 0 }, rng: new RNG(9),
    })
    world.enemies.update(1 / 60, 1 / 60, world.player)
    const ids = Array.from({ length: world.enemies.count }, (_, i) => ENEMIES[world.enemies.type[i]].id)
    expect(new Set(ids)).toEqual(new Set(['wolf']))
  })

  it('preserves distinct hover and dash movement states for the opening enemies', () => {
    const world = makeWorld()
    world.enemies.spawn('wisp', 8, 0, 0)
    world.enemies.spawn('wolf', -8, 0, 0)
    expect(world.enemies.behavior[0]).toBe(4)
    expect(world.enemies.behavior[1]).toBe(5)
    world.enemies.shotCd[1] = 0
    world.enemies.update(1 / 60, 1, world.player)
    expect(world.enemies.attackTimer[1]).toBeGreaterThan(0)
  })

  it('connects authored formations to the production enemy field exactly once', () => {
    const world = makeWorld(17)
    world.runTime = 75
    expect(world.formations.formationSeen).toBe(false)
    const dispatched = world.formations.update(world.runTime, { player: world.player }, (event) => world._spawnFormation(event))
    expect(dispatched).toBe(1)
    expect(world.formations.formationSeen).toBe(true)
    expect(world.enemies.count).toBe(14)
    expect(world.formations.update(world.runTime, { player: world.player }, (event) => world._spawnFormation(event))).toBe(0)
    expect(world.enemies.count).toBe(14)
  })

  it('holds a charger windup before consuming its burst window', () => {
    const world = makeWorld()
    world.enemies.spawn('jadeSerpent', 8, 0, 0)
    world.enemies.shotCd[0] = 0
    world.enemies.update(1 / 60, 1, world.player)
    const authoredBurst = world.enemies.burstTimer[0]
    expect(world.enemies.windup[0]).toBeGreaterThan(0)
    for (let i = 0; i < 12; i++) world.enemies.update(1 / 60, 1 + i / 60, world.player)
    expect(world.enemies.burstTimer[0]).toBeCloseTo(authoredBurst)
  })

  it('shows a contact intent before damage without changing the collision radius', () => {
    const world = makeWorld()
    world.enemies.spawnTimer = 999
    world.enemies.spawn('wisp', 1.55, 0, 60)
    world.enemies.hitCd[0] = 0
    const hpBeforeIntent = world.player.hp

    world.enemies.update(1 / 60, 60, world.player)

    expect(world.enemies.contactIntentTimer[0]).toBeGreaterThan(0)
    expect(world.enemies.attackTimer[0]).toBe(0)
    expect(world.player.hp).toBe(hpBeforeIntent)

    world.enemies.x[0] = 0.9
    world.enemies.z[0] = 0
    world.enemies.update(1 / 60, 60 + 1 / 60, world.player)

    expect(world.player.hp).toBeLessThan(hpBeforeIntent)
    expect(world.enemies.contactIntentTimer[0]).toBe(0)
    expect(world.enemies.attackTimer[0]).toBeGreaterThan(0)
  })

  it('splits blood scorpions into finite non-recursive brood on death', () => {
    const world = makeWorld()
    world.enemies.spawn('bloodScorpion', 4, 0, 0)
    world.enemies.dead[0] = 1
    world.enemies.flushDeaths()
    expect(world.enemies.count).toBe(2)
    expect(Array.from(world.enemies.behavior.slice(0, 2))).toEqual([0, 0])
    expect(world.enemies.radius[0]).toBeLessThan(0.7)
  })

  it('lets the player travel beyond the old 42-unit arena wall', () => {
    const world = makeWorld()
    const moving = { moveX: 1, moveZ: 0, consumeDash: () => false }
    for (let i = 0; i < 600; i++) world.player.update(1 / 60, moving)
    expect(world.player.x).toBeGreaterThan(42)
  })

  it('spawns the authored jade boss without importing the 3D manager', () => {
    const world = makeWorld()
    world.spawnBoss('jadeVoidWarden')
    expect(world.boss.def.name).toBe('옥허진장')
    expect(world.boss.maxHp).toBe(14000)
  })

  it('bounds ambient adds and suppresses overlapping formations during the final duel', () => {
    const world = makeWorld()
    world.runTime = 330
    world.spawnBoss('jadeVoidWarden')
    expect(FINAL_BOSS_WAVE_DENSITY_2D).toBeLessThan(0.2)

    world.enemies._spawnWave(0, world.runTime, world.player)
    expect(world.enemies.count).toBe(2)

    const accepted = world._spawnFormation({ count: 22 })
    expect(accepted).toBe(true)
    expect(world.enemies.count).toBe(2)
  })

  it('keeps the scheduled final boss alive long enough to show all three phases', () => {
    const world = makeWorld()
    world.runTime = 330
    world.spawnBoss('jadeVoidWarden')
    const maxHp = world.boss.maxHp

    world.damageBoss(maxHp * 20, 'sword')
    expect(world.boss.hp).toBeCloseTo(maxHp * 0.67)
    expect(world.boss.active).toBe(true)

    world.runTime = 330 + FINAL_BOSS_PHASE_GATE_SECONDS_2D[0]
    world.damageBoss(maxHp * 20, 'sword')
    expect(world.boss.hp).toBeCloseTo(maxHp * 0.34)

    world.runTime = 330 + FINAL_BOSS_PHASE_GATE_SECONDS_2D[1]
    world.damageBoss(maxHp * 20, 'sword')
    expect(world.boss.hp).toBeCloseTo(maxHp * 0.01)

    world.runTime = 330 + FINAL_BOSS_PHASE_GATE_SECONDS_2D[2]
    world.damageBoss(maxHp * 20, 'sword')
    expect(world.boss.active).toBe(false)
    expect(world.victory).toBe(true)
    expect(world.ended).toBe(false)
    expect(world.player.invulnTimer).toBeGreaterThan(4)
  })

  it('does not emit a boss-hit event when a phase floor absorbs all damage', () => {
    const world = makeWorld(606)
    world.runTime = 330
    world.spawnBoss('jadeVoidWarden')
    const events = []
    world.onBossHit = (event) => events.push(event)
    const maxHp = world.boss.maxHp

    world.damageBoss(maxHp * 20, 'sword')
    expect(events).toHaveLength(1)
    const hpAtFloor = world.boss.hp
    world.damageBoss(maxHp * 20, 'sword')

    expect(world.boss.hp).toBe(hpAtFloor)
    expect(events).toHaveLength(1)
  })

  it('telegraphs a Dao-mirrored boss pattern before executing its hazard', () => {
    const world = makeWorld()
    world.spawnBoss('jadeVoidWarden')
    world.daoVows = { vowId: 'sword' }
    world.runTime = 10
    world.boss.attackCd = 0
    world._updateBoss(0)
    const event = world.boss.pendingPattern
    expect(event).toBeTruthy()
    expect(world.boss.castDuration).toBeGreaterThanOrEqual(MIN_TELEGRAPH_SECONDS_2D)
    expect(world.projectiles.count).toBe(0)

    world.runTime = event.executeAt
    world._updateBoss(0)
    expect(world.boss.pendingPattern).toBe(null)
    expect(world.projectiles.count).toBeGreaterThan(0)
  })

  it('snapshots cast origin, target and planned angle while freezing the boss', () => {
    const world = makeWorld(406)
    world.spawnBoss('jadeVoidWarden')
    world.player.x = 0
    world.player.z = 0
    world.boss.x = 8
    world.boss.z = 0
    world.boss.prevX = 8
    world.boss.prevZ = 0
    world.runTime = 10
    world.boss.attackCd = 0

    world._updateBoss(0)
    const event = world.boss.pendingPattern
    expect(event.patternType).toBe('line')
    expect(event.castOriginX).toBe(8)
    expect(event.castOriginZ).toBe(0)
    expect(event.castTargetX).toBe(0)
    expect(event.castTargetZ).toBe(0)
    expect(event.castAngle).toBe(event.geometry.angle)
    expect(event.castDirection).toEqual(event.geometry.direction)

    const castX = world.boss.x
    const castZ = world.boss.z
    world._updateBoss(0.25)
    expect(world.boss.x).toBe(castX)
    expect(world.boss.z).toBe(castZ)

    // A late boss-position change must not move the impact back to the live
    // boss. The cast snapshot remains the only origin used by the bullets.
    world.boss.x = 100
    world.boss.z = 100
    world.runTime = event.executeAt
    world._updateBoss(0)
    expect(world.projectiles.count).toBeGreaterThan(0)
    expect(Math.hypot(
      world.projectiles.x[0] - event.castOriginX,
      world.projectiles.z[0] - event.castOriginZ,
    )).toBeLessThanOrEqual(event.geometry.width * 0.5 + 0.00001)
    const projectileAngle = Math.atan2(world.projectiles.dz[0], world.projectiles.dx[0])
    const angleDelta = Math.abs(Math.atan2(
      Math.sin(projectileAngle - event.castAngle),
      Math.cos(projectileAngle - event.castAngle),
    ))
    expect(angleDelta).toBeLessThan(0.00001)
  })

  it('uses the planned cone sector instead of retargeting to the player at impact', () => {
    const world = makeWorld(407)
    const dao = new DaoVows2D({ vowId: 'sword' })
    dao.select('deepening', 'piercing-edge')
    dao.select('completion', 'sword-ring')
    world.daoVows = dao
    world.spawnBoss('jadeVoidWarden')
    world.boss.hp = world.boss.maxHp * 0.5
    world.runTime = 10
    world.boss.attackCd = 0
    world._updateBoss(0)
    const event = world.boss.pendingPattern
    expect(event.patternType).toBe('cone')

    // Move after the tell. Every spawned angle must remain inside the
    // snapshotted sector, even though the player's live position changed.
    world.player.x = event.castOriginX - Math.cos(event.castAngle) * 20
    world.player.z = event.castOriginZ - Math.sin(event.castAngle) * 20
    world.runTime = event.executeAt
    world._updateBoss(0)
    const arc = event.geometry.arcRadians
    for (let index = 0; index < world.projectiles.count; index++) {
      const angle = Math.atan2(world.projectiles.dz[index], world.projectiles.dx[index])
      const delta = Math.abs(Math.atan2(
        Math.sin(angle - event.castAngle),
        Math.cos(angle - event.castAngle),
      ))
      expect(delta).toBeLessThanOrEqual(arc * 0.5 + 0.00001)
    }
  })

  it.each([
    ['cluster', 'frost-shards', 'ice-wall', 0.5],
    ['wall', 'frost-line', 'ice-wall', 0.2],
  ])('collides against the authored %s zone placement', (_shape, deepening, completion, ratio) => {
    const world = makeWorld(408 + (_shape === 'wall' ? 1 : 0))
    const dao = new DaoVows2D({ vowId: 'frost' })
    dao.select('deepening', deepening)
    dao.select('completion', completion)
    world.daoVows = dao
    world.spawnBoss('jadeVoidWarden')
    world.boss.hp = world.boss.maxHp * ratio
    world.runTime = 10
    world.boss.attackCd = 0
    world._updateBoss(0)
    const event = world.boss.pendingPattern
    expect(event.patternType).toBe('zone')
    expect(event.geometry.shape).toBe(_shape)
    expect(event.zoneInstances).toHaveLength(event.geometry.count)

    const placement = event.zoneInstances[event.zoneInstances.length - 1]
    world.player.x = placement.x
    world.player.z = placement.z
    world.player.invulnTimer = 0
    const hpBefore = world.player.hp
    world.runTime = event.executeAt
    world._updateBoss(0)
    expect(world.player.hp).toBeLessThan(hpBefore)
    expect(world.bossZoneFields).toHaveLength(1)
  })

  it('emits one deterministic boss telegraph -> impact -> hit -> death lifecycle', () => {
    const world = makeWorld(404)
    world.daoVows = { vowId: 'sword' }
    const events = []
    world.onBossTelegraph = (event) => events.push(event)
    world.onBossImpact = (event) => events.push(event)
    world.onBossHit = (event) => events.push(event)
    world.onBossDeath = (event) => events.push(event)
    world.spawnBoss('jadeVoidWarden')
    world.runTime = 10
    world.boss.hp = world.boss.maxHp * 0.5
    world.boss.attackCd = 0

    world._updateBoss(0)
    const telegraph = world.boss.pendingPattern
    world._updateBoss(0)
    expect(events.map((event) => event.stage)).toEqual(['telegraph'])

    world.runTime = telegraph.executeAt
    world._updateBoss(0)
    world._updateBoss(0)
    expect(events.map((event) => event.stage)).toEqual(['telegraph', 'impact'])

    world.boss.hp = 1
    world.damageBoss(1000, 'sword')
    world.damageBoss(1000, 'sword')
    expect(events.map((event) => event.stage)).toEqual(['telegraph', 'impact', 'hit', 'death'])
    for (const event of events) {
      expect(event).toEqual(expect.objectContaining({
        patternId: telegraph.patternId,
        phase: telegraph.phase,
        vowId: telegraph.vowId,
        intent: expect.any(String),
        crit: expect.any(Boolean),
        damage: expect.any(Number),
        final: true,
      }))
    }
    expect(new Set(events.map((event) => event.eventId)).size).toBe(events.length)
  })

  it('routes a real player projectile collision through boss hit and death callbacks', () => {
    const world = makeWorld(405)
    world.spawnBoss('jadeVoidWarden')
    world.boss.x = world.player.x + 1.4
    world.boss.z = world.player.z
    world.boss.hp = 1
    const events = []
    world.onBossHit = (event) => events.push(event)
    world.onBossDeath = (event) => events.push(event)
    world._fireWeapon('flyingSword', 1)
    world.projectiles.update(0.1)
    expect(events.map((event) => event.stage)).toEqual(['hit', 'death'])
    expect(events.every((event) => Number.isFinite(event.damage)
      && typeof event.crit === 'boolean' && event.final === true)).toBe(true)
  })

  it('passes the selected Dao branch metadata into the final boss planner', () => {
    const planFor = (deepening) => {
      const world = makeWorld(77)
      const dao = new DaoVows2D({ vowId: 'sword' })
      dao.select('deepening', deepening)
      dao.select('completion', 'sword-ring')
      world.daoVows = dao
      world.spawnBoss('jadeVoidWarden')
      world.runTime = 10
      world.boss.hp = world.boss.maxHp * 0.5
      world.boss.attackCd = 0
      world._updateBoss(0)
      return { event: world.boss.pendingPattern, color: world.boss.patternColor }
    }
    const returning = planFor('returning-edge')
    const piercing = planFor('piercing-edge')
    expect(returning.event.patternId).toBe('returning-sword-line')
    expect(piercing.event.patternId).toBe('piercing-sword-cross')
    expect(returning.event.patternType).toBe('line')
    expect(piercing.event.patternType).toBe('cone')
    expect(returning.event.paletteKey).not.toBe(piercing.event.paletteKey)
    expect(returning.event.intent).not.toBe(piercing.event.intent)
    expect(returning.color).toBe(returning.event.paletteColor)
    expect(piercing.color).toBe(piercing.event.paletteColor)
    expect(returning.event.telegraphDuration).toBeGreaterThanOrEqual(MIN_TELEGRAPH_SECONDS_2D)
    expect(piercing.event.telegraphDuration).toBeGreaterThanOrEqual(MIN_TELEGRAPH_SECONDS_2D)
  })

  it.each([
    ['검맥·회귀검선', {
      vowId: 'sword', deepening: 'returning-edge', completion: 'sword-ring',
      patterns: ['swordLine', 'returning-sword-line', 'returning-sword-ring'],
    }],
    ['검맥·관통검선', {
      vowId: 'sword', deepening: 'piercing-edge', completion: 'sword-ring',
      patterns: ['swordLine', 'piercing-sword-cross', 'piercing-sword-ring'],
    }],
    ['설맥·냉기파편', {
      vowId: 'frost', deepening: 'frost-shards', completion: 'ice-wall',
      patterns: ['frostZone', 'chain-frost-mines-shards', 'chain-frost-wall-shards'],
    }],
    ['설맥·절단빙선', {
      vowId: 'frost', deepening: 'frost-line', completion: 'ice-wall',
      patterns: ['frostZone', 'cutting-ice-line', 'cutting-ice-wall-line'],
    }],
    ['심맥·정화', {
      vowId: 'spirit', deepening: 'purifying-heart', completion: 'shadow-copy',
      patterns: ['spiritOrbit', 'tracking-shadow-double-purge', 'shadow-summon-overcharge-purge'],
    }],
    ['심맥·공명', {
      vowId: 'spirit', deepening: 'echoing-heart', completion: 'shadow-copy',
      patterns: ['spiritOrbit', 'tracking-shadow-double-echo', 'shadow-summon-overcharge-echo'],
    }],
  ])('routes %s through all three final-boss phases in the real world', (_label, branch) => {
    const dao = new DaoVows2D({ vowId: branch.vowId })
    dao.select('deepening', branch.deepening)
    dao.select('completion', branch.completion)
    const world = new CombatWorld2D({
      character: getCharacter('seolryeong'),
      stage: getStage('jade'),
      progress: { trial: 0, statMods: [], reviveCharges: 0 },
      rng: new RNG(1000 + branch.patterns.length),
      daoVows: dao,
    })
    world.spawnBoss('jadeVoidWarden')

    const events = []
    for (const [index, ratio] of [0.8, 0.5, 0.2].entries()) {
      world.boss.active = true
      world.boss.pendingPattern = null
      world.boss.attackCd = 0
      world.boss.hp = world.boss.maxHp * ratio
      world.runTime = 10 + index
      world._updateBoss(0)
      events.push(world.boss.pendingPattern)
    }

    expect(events.map((event) => event.patternId)).toEqual(branch.patterns)
    expect(events.map((event) => event.phase)).toEqual([1, 2, 3])
    expect(events.every((event) => event.vowId === branch.vowId)).toBe(true)
    expect(events.every((event) => event.geometry
      && event.telegraphDuration >= MIN_TELEGRAPH_SECONDS_2D)).toBe(true)
  })

  it('retries the final boss until the occupied boss slot becomes available', () => {
    const world = makeWorld()
    expect(world.bossSchedule.map((entry) => entry.t)).toEqual([180, 330])
    world.runTime = 480
    world._updateBoss(0)
    expect(world.boss.def.id).toBe('blueWolfKing')
    expect(world.spawnedBosses.has('mid:blueWolfKing')).toBe(true)

    world.runTime = 900
    world._updateBoss(0)
    expect(world.boss.def.id).toBe('blueWolfKing')
    expect(world.spawnedBosses.has('final:jadeVoidWarden')).toBe(false)

    world.boss.active = false
    world._updateBoss(0)
    expect(world.boss.def.id).toBe('jadeVoidWarden')
    expect(world.spawnedBosses.has('final:jadeVoidWarden')).toBe(true)
  })

  it('applies might and crit exactly once to player projectiles', () => {
    const world = makeWorld()
    world.player.stats = {
      ...world.player.stats,
      might: 2,
      critChance: 0,
      amount: 0,
      tagMight: { ...world.player.stats.tagMight, sword: 0 },
    }
    world.enemies.spawn('stoneGhoul', 1, 0, 0)
    world.enemies.spawnTimer = 999
    world.enemies.update(0, 0, world.player)
    const hpBefore = world.enemies.hp[0]
    const rawDamage = getWeapon('flyingSword').levels[0].damage

    world._spawnFan(getWeapon('flyingSword'), 1, 1)
    expect(world.projectiles.damage[0]).toBe(rawDamage)
    world.projectiles.update(0.001)
    expect(hpBefore - world.enemies.hp[0]).toBe(rawDamage * 2)
  })

  it('applies stage HP and spirit-stone reward multipliers in the 2D runtime', () => {
    const jade = makeWorld(4)
    const ember = new CombatWorld2D({
      character: getCharacter('seolryeong'), stage: getStage('ember'),
      progress: { trial: 0, statMods: [], reviveCharges: 0 }, rng: new RNG(4),
    })
    const frost = new CombatWorld2D({
      character: getCharacter('seolryeong'), stage: getStage('frost'),
      progress: { trial: 0, statMods: [], reviveCharges: 0 }, rng: new RNG(4),
    })
    for (const world of [jade, ember, frost]) world.enemies.spawn('wisp', 1, 0, 0)
    expect(ember.enemies.maxHp[0] / jade.enemies.maxHp[0]).toBeCloseTo(1.25)
    expect(frost.enemies.maxHp[0] / jade.enemies.maxHp[0]).toBeCloseTo(1.55)

    jade.pickups.spawn(0, 0, 10, true)
    ember.pickups.spawn(0, 0, 10, true)
    frost.pickups.spawn(0, 0, 10, true)
    expect(ember.pickups.value[0] / jade.pickups.value[0]).toBeCloseTo(1.35)
    expect(frost.pickups.value[0] / jade.pickups.value[0]).toBeCloseTo(1.8)
  })

  it('merges adjacent drops and recycles saturated slots without losing either economy', () => {
    const world = makeWorld(31)
    const pickups = world.pickups
    pickups.spawn(0, 0, 2, false)
    pickups.spawn(1, 0, 3, false)
    expect(pickups.count).toBe(1)
    expect(pickups.value[0]).toBe(5)

    for (let i = 1; i < MAX_PICKUPS_2D; i++) pickups.spawn(i * 2, 100, 1, false)
    pickups.update(2, world.player, () => {})
    const before = pickupTotals(pickups)
    expect(pickups.count).toBe(MAX_PICKUPS_2D)

    pickups.spawn(0, 0, 7, false)
    pickups.spawn(0, 0, 11, true)
    const after = pickupTotals(pickups)
    expect(after.xp).toBeCloseTo(before.xp + 7)
    expect(after.stones).toBeCloseTo(before.stones + 11 * world.stage.stoneScale)
    expect(after.value).toBeCloseTo(before.value + 7 + 11 * world.stage.stoneScale)
    expect(pickups.count).toBe(MAX_PICKUPS_2D)
    expect(pickups.dropped).toBe(0)
    expect(Array.from({ length: pickups.count }, (_, i) => pickups.x[i] === 0 && pickups.z[i] === 0)).toContain(true)
  })

  it('clamps the deterministic 420-second timeout result and preserves pickup value', () => {
    const simulate = (seed) => {
      const world = makeWorld(seed)
      const pickups = world.pickups
      for (let i = 0; i < 24; i++) pickups.spawn(60 + i * 2, 60, i + 1, i % 4 === 0)
      // Isolate the authoritative clock and pickup ledger for a fast fixed-tick
      // simulation; combat systems are covered by the surrounding world tests.
      world.enemies.update = () => {}
      world._updateBoss = () => {}
      world._updateWeapons = () => {}
      world.projectiles.update = () => {}
      world.weaponFields.update = () => {}
      world.formations.update = () => 0
      world.effects.update = () => {}
      world.player.takeDamage = () => false
      let recordedRunTime = null
      world.onEnd = () => { recordedRunTime = world.runTime }
      for (let i = 0; i < 25201 && !world.ended; i++) world.update(1 / 60, idleInput)
      const totals = pickupTotals(pickups)
      return {
        runTime: world.runTime,
        recordedRunTime,
        ended: world.ended,
        dropped: pickups.dropped,
        totals,
        spawnedXp: pickups.spawnedXp,
        spawnedStones: pickups.spawnedStones,
        collectedXp: pickups.collectedXp,
        collectedStones: pickups.collectedStones,
      }
    }

    const first = simulate(91)
    const second = simulate(91)
    expect(first).toEqual(second)
    expect(first.ended).toBe(true)
    expect(first.runTime).toBe(420)
    expect(first.recordedRunTime).toBe(420)
    expect(first.dropped).toBe(0)
    expect(first.collectedXp + first.totals.xp).toBeCloseTo(first.spawnedXp)
    expect(first.collectedStones + first.totals.stones).toBeCloseTo(first.spawnedStones)
  })

  it('keeps all pools inside the declared stress limits', () => {
    expect(MAX_ENEMIES_2D).toBe(900)
    expect(MAX_PROJECTILES_2D).toBe(1200)
    expect(MAX_PICKUPS_2D).toBe(4096)
    const world = makeWorld()
    for (let i = 0; i < MAX_ENEMIES_2D + 20; i++) world.enemies.spawn('wisp', i % 30, i % 20, 0)
    expect(world.enemies.count).toBe(MAX_ENEMIES_2D)
    expect(world.enemies.dropped).toBe(20)
  })
})
