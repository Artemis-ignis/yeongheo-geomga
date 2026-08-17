import { describe, expect, it } from 'vitest'
import { RNG } from '../src/core/RNG.js'
import {
  ENEMY_INGRESS_GEOMETRY_2D,
  ENEMY_INGRESS_VIEW_ENVELOPE_2D,
  ENEMY_PACK_PRIMARY_RATIO_2D,
  EnemySpawnDirector2D,
  FORMATION_INGRESS_ARRIVAL_SECONDS_2D,
  FORMATION_WARNING_EDGE_INSET_2D,
  FORMATION_WARNING_RADIUS_MAX_2D,
  FORMATION_WARNING_RADIUS_MIN_2D,
  enemyIngressArrivalDelaySeconds2D,
  enemyPackTypeAt2D,
  enemyPopulationBudget2D,
  formationIngressArrivalDelaySeconds2D,
  formationIngressWarning2D,
  formationIngressTransform2D,
} from '../src/runtime2d/EnemySpawnDirector2D.js'
import { STAGES } from '../src/data/stages.js'
import { WAVES } from '../src/data/waves.js'
import { formationAngles } from '../src/data/formations.js'
import { getCharacter } from '../src/data/characters.js'
import { getEnemy } from '../src/data/enemies.js'
import {
  CombatWorld2D, SCREEN_SUMMON_MIN_CLEARANCE_2D, SCREEN_SUMMON_TELEGRAPH_SECONDS_2D,
} from '../src/runtime2d/CombatWorld2D.js'

function angularDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

function formationPoints(kind, count, radius, facing = 0, arc = 1.4) {
  return formationAngles(kind, count, facing, arc).map((angle) => ({
    x: Math.sin(angle) * radius,
    z: Math.cos(angle) * radius,
  }))
}

function pairwiseDistances(points) {
  const distances = []
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      distances.push(Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z))
    }
  }
  return distances
}

function circularGaps(points, centerX = 0, centerZ = 0) {
  const angles = points
    .map((point) => Math.atan2(point.x - centerX, point.z - centerZ))
    .sort((a, b) => a - b)
  const gaps = []
  for (let i = 0; i < angles.length; i++) {
    const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI * 2
    gaps.push(next - angles[i])
  }
  return gaps.sort((a, b) => a - b)
}

describe('enemy offscreen spawn director', () => {
  it('composes each ingress as one dominant family plus one support family', () => {
    const roster = ['wisp', 'wolf', 'jadeSerpent']
    const pack = Array.from({ length: 10 }, (_, index) => (
      enemyPackTypeAt2D(roster, index, 10, 1)
    ))
    const primaryCount = Math.round(10 * ENEMY_PACK_PRIMARY_RATIO_2D)
    expect(pack.slice(0, primaryCount)).toEqual(Array(primaryCount).fill('wolf'))
    expect(pack.slice(primaryCount)).toEqual(Array(10 - primaryCount).fill('jadeSerpent'))
    expect(new Set(pack).size).toBe(2)
    expect(enemyPackTypeAt2D(['wisp'], 3, 4, 99)).toBe('wisp')
  })

  it('keeps ingress outside the view envelope with an explicit arrival-delay contract', () => {
    expect(ENEMY_INGRESS_GEOMETRY_2D.radiusXMin).toBeGreaterThan(0)
    expect(ENEMY_INGRESS_GEOMETRY_2D.radiusZMin).toBeGreaterThan(0)
    expect(enemyIngressArrivalDelaySeconds2D(4.2)).toBeGreaterThanOrEqual(8)
    expect(enemyIngressArrivalDelaySeconds2D(4.2)).toBeLessThan(10)
    expect(enemyIngressArrivalDelaySeconds2D(2.4)).toBeGreaterThan(14)
    expect(enemyIngressArrivalDelaySeconds2D(2.4)).toBeLessThan(18)
    const director = new EnemySpawnDirector2D(new RNG(12)).beginPulse()
    for (let index = 0; index < 64; index++) {
      const point = director.point({ x: 0, z: 0 }, index, 64)
      const dx = Math.abs(point.x)
      const dz = Math.abs(point.z)
      expect(dx >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX + 0.5
        || dz >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusZ + 0.5).toBe(true)
    }
  })

  it('declares only Jade Sanctuary enemy ids in every wave', () => {
    const jadeStage = STAGES.find((stage) => stage.id === 'jade')
    const jadeIds = new Set(jadeStage.roster)
    const foreignIds = WAVES.flatMap((wave) => wave.types.filter((type) => !jadeIds.has(type)))
    expect(foreignIds).toEqual([])
  })

  it('places every normal wave outside the projected gameplay envelope', () => {
    const director = new EnemySpawnDirector2D(new RNG(211)).beginPulse()
    const player = { x: 18, z: -9 }
    for (let index = 0; index < 64; index++) {
      const point = director.point(player, index, 64)
      const dx = point.x - player.x
      const dz = point.z - player.z
      expect(Math.hypot(
        dx / ENEMY_INGRESS_GEOMETRY_2D.radiusXMin,
        dz / ENEMY_INGRESS_GEOMETRY_2D.radiusZMin,
      )).toBeGreaterThanOrEqual(0.99)
    }
  })

  it('keeps the standard Jade runtime wave on the shared ingress path', () => {
    const stage = STAGES.find((entry) => entry.id === 'jade')
    const world = new CombatWorld2D({
      character: getCharacter('seolryeong'),
      stage,
      progress: { trial: 0, statMods: [], reviveCharges: 0 },
      rng: new RNG(211),
    })
    world.enemies.update(1 / 60, 1.25, world.player)
    expect(world.enemies.count).toBeGreaterThan(0)
    for (let index = 0; index < world.enemies.count; index++) {
      const dx = Math.abs(world.enemies.x[index] - world.player.x)
      const dz = Math.abs(world.enemies.z[index] - world.player.z)
      expect(dx >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX + 0.5
        || dz >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusZ + 0.5).toBe(true)
    }
  })

  it('keeps authored POI groups on ingress instead of their interaction point', () => {
    const stage = STAGES.find((entry) => entry.id === 'jade')
    const world = new CombatWorld2D({
      character: getCharacter('seolryeong'),
      stage,
      progress: { trial: 0, statMods: [], reviveCharges: 0 },
      rng: new RNG(97),
    })
    const spawned = world.enemies.spawnIngressGroup(
      [{ id: 'wisp', hpMul: 1.1 }, { id: 'wolf', hpMul: 1.1 }, { id: 'stoneGhoul', hpMul: 1.1 }],
      world.player,
      world.runTime,
    )
    expect(spawned).toHaveLength(3)
    for (let index = 0; index < world.enemies.count; index++) {
      const dx = Math.abs(world.enemies.x[index] - world.player.x)
      const dz = Math.abs(world.enemies.z[index] - world.player.z)
      expect(dx >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX + 0.5
        || dz >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusZ + 0.5).toBe(true)
    }
  })

  it('routes an authored formation through ingress instead of screen pop-in', () => {
    const stage = STAGES.find((entry) => entry.id === 'jade')
    const world = new CombatWorld2D({
      character: getCharacter('seolryeong'),
      stage,
      progress: { trial: 0, statMods: [], reviveCharges: 0 },
      rng: new RNG(17),
    })
    world.runTime = 75
    const dispatched = world.formations.update(
      world.runTime, { player: world.player }, (event) => world._spawnFormation(event),
    )
    expect(dispatched).toBe(1)
    expect(world.enemies.count).toBe(14)
    expect(world.runStats.formations).toBe(1)
    for (let index = 0; index < world.enemies.count; index++) {
      const dx = Math.abs(world.enemies.x[index] - world.player.x)
      const dz = Math.abs(world.enemies.z[index] - world.player.z)
      expect(dx >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX + 0.5
        || dz >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusZ + 0.5).toBe(true)
    }
  })

  it.each([
    ['ring', 14, 10, 0, 1.4, 2.4],
    ['wall', 12, 15, 0.65, 1.5, 4.2],
    ['pincer', 12, 16, -0.4, 1.1, 4.2],
  ])('rigidly translates %s geometry while preserving its ingress contract', (
    kind, count, radius, facing, arc, speed,
  ) => {
    const event = {
      kind, count, radius, arc, facing, seed: 0xabc123,
      angles: formationAngles(kind, count, facing, arc),
    }
    const anchor = { x: 7, z: -11 }
    const original = formationPoints(kind, count, radius, facing, arc)
    const transform = formationIngressTransform2D(event, anchor, { speed })
    const repeat = formationIngressTransform2D(event, anchor, { speed })
    expect(repeat).toEqual(transform)
    expect(pairwiseDistances(transform.points)).toHaveLength(pairwiseDistances(original).length)
    pairwiseDistances(transform.points).forEach((distance, index) => {
      expect(distance).toBeCloseTo(pairwiseDistances(original)[index], 8)
    })
    const originalGaps = circularGaps(original)
    const translatedGaps = circularGaps(transform.points, transform.centerX, transform.centerZ)
    translatedGaps.forEach((gap, index) => expect(gap).toBeCloseTo(originalGaps[index], 8))
    for (const point of transform.points) {
      const dx = Math.abs(point.x - anchor.x)
      const dz = Math.abs(point.z - anchor.z)
      expect(dx >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX + 0.5
        || dz >= ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusZ + 0.5).toBe(true)
    }
    expect(formationIngressArrivalDelaySeconds2D(transform, speed))
      .toBeGreaterThanOrEqual(FORMATION_INGRESS_ARRIVAL_SECONDS_2D - 1e-6)
  })

  it('uses the rigid transform in the real CombatWorld formation path', () => {
    const stage = STAGES.find((entry) => entry.id === 'jade')
    const world = new CombatWorld2D({
      character: getCharacter('seolryeong'),
      stage,
      progress: { trial: 0, statMods: [], reviveCharges: 0 },
      rng: new RNG(17),
    })
    world.runTime = 75
    let event = null
    world.formations.update(world.runTime, { player: world.player }, (next) => {
      event = next
      return world._spawnFormation(next)
    })
    const speed = getEnemy(event.type).speed * event.haste
    const transform = formationIngressTransform2D(event, world.player, { speed })
    expect(world.enemies.count).toBe(event.count)
    for (let index = 0; index < event.count; index++) {
      expect(world.enemies.x[index]).toBeCloseTo(transform.points[index].x, 5)
      expect(world.enemies.z[index]).toBeCloseTo(transform.points[index].z, 5)
    }
    expect(formationIngressArrivalDelaySeconds2D(transform, speed))
      .toBeGreaterThanOrEqual(FORMATION_INGRESS_ARRIVAL_SECONDS_2D - 1e-6)
  })

  it('places the formation warning near the matching visible ingress edge', () => {
    const stage = STAGES.find((entry) => entry.id === 'jade')
    const makeWorld = () => new CombatWorld2D({
      character: getCharacter('seolryeong'),
      stage,
      progress: { trial: 0, statMods: [], reviveCharges: 0 },
      rng: new RNG(17),
    })
    const first = makeWorld()
    const second = makeWorld()
    first.runTime = second.runTime = 75
    let firstCallback = null
    let firstIngress = null
    let secondIngress = null
    first.onFormation = (event, ingress) => {
      firstCallback = event
      firstIngress = ingress
    }
    second.onFormation = (_event, ingress) => { secondIngress = ingress }

    first.formations.update(first.runTime, { player: first.player }, (event) => first._spawnFormation(event))
    second.formations.update(second.runTime, { player: second.player }, (event) => second._spawnFormation(event))

    expect(firstCallback?.ingress).toEqual(firstIngress)
    expect(secondIngress).toEqual(firstIngress)
    const warning = firstIngress.warning
    const transform = formationIngressTransform2D(
      firstCallback,
      first.player,
      { speed: getEnemy(firstCallback.type).speed * firstCallback.haste },
    )
    expect(warning.side).toBe(transform.side)
    expect(Math.sign(warning.x - first.player.x)).toBe(transform.side)
    expect(Math.abs(warning.x - first.player.x)).toBeCloseTo(
      ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX - FORMATION_WARNING_EDGE_INSET_2D,
      6,
    )
    expect(Math.abs(warning.x - first.player.x))
      .toBeGreaterThan(ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX * 0.75)
    expect(warning.z).toBeCloseTo(first.player.z, 6)
    expect(warning.radius).toBeGreaterThanOrEqual(FORMATION_WARNING_RADIUS_MIN_2D)
    expect(warning.radius).toBeLessThanOrEqual(FORMATION_WARNING_RADIUS_MAX_2D)
    expect(first.effects.count).toBe(1)
    expect(first.effects.x[0]).toBeCloseTo(warning.x, 5)
    expect(first.effects.z[0]).toBeCloseTo(warning.z, 5)
    expect(first.effects.radius[0]).toBeCloseTo(warning.radius, 5)
  })

  it('telegraphs scheduled boss activation and never reserves an active body early', () => {
    const stage = STAGES.find((entry) => entry.id === 'jade')
    const world = new CombatWorld2D({
      character: getCharacter('seolryeong'),
      stage,
      progress: { trial: 0, statMods: [], reviveCharges: 0 },
      rng: new RNG(29),
    })
    world.runTime = 12
    expect(world.spawnBossTelegraphed('blueWolfKing')).toBe(true)
    expect(world.boss).toBeNull()
    expect(world._pendingBossSummon?.activateAt).toBeCloseTo(
      12 + SCREEN_SUMMON_TELEGRAPH_SECONDS_2D,
    )
    world.player.x = world._pendingBossSummon.x
    world.player.z = world._pendingBossSummon.z
    world.runTime += SCREEN_SUMMON_TELEGRAPH_SECONDS_2D - 0.01
    world._updateBoss(0)
    expect(world.boss).toBeNull()
    world.runTime += 0.01
    world._updateBoss(0)
    expect(world.boss?.active).toBe(true)
    expect(Math.hypot(world.boss.x - world.player.x, world.boss.z - world.player.z))
      .toBeGreaterThanOrEqual(world.boss.def.radius + SCREEN_SUMMON_MIN_CLEARANCE_2D - 1e-6)
  })

  it('builds short readable pressure arcs instead of surrounding the heroine', () => {
    const director = new EnemySpawnDirector2D(new RNG(75)).beginPulse()
    const primary = Array.from({ length: 12 }, (_, index) => (
      director.point({ x: 0, z: 0 }, index, 12, false, {})
    ))
    const secondary = Array.from({ length: 5 }, (_, index) => (
      director.point({ x: 0, z: 0 }, index, 5, true, {})
    ))
    expect(Math.max(...primary.map((point) => angularDistance(point.angle, director.primaryAngle))))
      .toBeLessThanOrEqual(ENEMY_INGRESS_GEOMETRY_2D.primaryArcRadians
        + ENEMY_INGRESS_GEOMETRY_2D.angularJitter + 0.0001)
    expect(angularDistance(director.secondaryAngle, director.primaryAngle))
      .toBeGreaterThanOrEqual(ENEMY_INGRESS_GEOMETRY_2D.secondaryArcOffsetMin)
    expect(angularDistance(director.secondaryAngle, director.primaryAngle))
      .toBeLessThanOrEqual(ENEMY_INGRESS_GEOMETRY_2D.secondaryArcOffsetMax)
    expect(secondary).toHaveLength(5)
  })

  it('caps clutter while still growing pressure across a long run', () => {
    expect(enemyPopulationBudget2D(0)).toBe(64)
    expect(enemyPopulationBudget2D(180)).toBe(184)
    expect(enemyPopulationBudget2D(600)).toBe(240)
    expect(enemyPopulationBudget2D(600, true)).toBe(96)
  })
})
