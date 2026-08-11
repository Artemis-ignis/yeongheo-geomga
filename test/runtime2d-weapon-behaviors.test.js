import { describe, expect, it } from 'vitest'
import { EVOLUTIONS, WEAPONS } from '../src/data/weapons.js'
import { RNG } from '../src/core/RNG.js'
import { getCharacter } from '../src/data/characters.js'
import { getStage } from '../src/data/stages.js'
import { CombatWorld2D, MAX_WEAPON_FIELDS_2D } from '../src/runtime2d/CombatWorld2D.js'
import {
  ALL_WEAPON_DEFINITIONS_2D,
  WEAPON_BEHAVIOR_AXES_2D,
  WEAPON_BEHAVIOR_IDS_2D,
  WEAPON_BEHAVIORS_2D,
  buildWeaponBehavior2D,
  getWeaponBehavior2D,
  getWeaponDataCoverage2D,
  isWeaponBehaviorCoverageComplete2D,
  planWeaponBehavior2D,
  validateWeaponBehaviorCoverage2D,
} from '../src/runtime2d/WeaponBehaviors2D.js'

const ALL = [...WEAPONS, ...EVOLUTIONS]

function makeWorld(seed = 101) {
  const world = new CombatWorld2D({
    character: getCharacter('seolryeong'),
    stage: getStage('jade'),
    progress: { trial: 0, statMods: [], reviveCharges: 0 },
    rng: new RNG(seed),
  })
  world.enemies.spawnTimer = 999
  return world
}

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value))
}

describe('WeaponBehaviors2D', () => {
  it('covers every authored base and evolution id exactly once', () => {
    expect(ALL_WEAPON_DEFINITIONS_2D).toHaveLength(20)
    expect(WEAPON_BEHAVIOR_IDS_2D).toEqual(ALL.map((weapon) => weapon.id))
    expect(Object.keys(WEAPON_BEHAVIORS_2D)).toEqual(ALL.map((weapon) => weapon.id))
    expect(validateWeaponBehaviorCoverage2D()).toMatchObject({ ok: true, errors: [] })
    expect(isWeaponBehaviorCoverageComplete2D()).toBe(true)
  })

  it('gives every weapon at least two mechanical identity axes', () => {
    expect(WEAPON_BEHAVIOR_AXES_2D).toEqual(['trajectory', 'collision', 'residualField', 'status', 'audio'])
    for (const weapon of ALL) {
      const descriptor = getWeaponBehavior2D(weapon.id)
      expect(descriptor, weapon.id).toBeTruthy()
      expect(descriptor.identityAxes.length, weapon.id).toBeGreaterThanOrEqual(2)
      expect(descriptor.identityAxes).toContain('trajectory')
      expect(descriptor.identityAxes).toContain('collision')
      expect(descriptor.audio.kind, weapon.id).toBeTruthy()
      expect(descriptor.allocation.strategy, weapon.id).toBe('fixed-pool')
      expect(descriptor.allocation.perTickAllocations, weapon.id).toBe(0)
    }
  })

  it('explicitly exposes the authored special mechanics', () => {
    const expectEnabled = (id, effect) => {
      const descriptor = getWeaponBehavior2D(id)
      expect(descriptor.statusEffects[effect].enabled, `${id}.${effect}`).toBe(true)
    }
    expectEnabled('fireTalisman', 'burn')
    expectEnabled('infernoSea', 'burn')
    expectEnabled('frostPalm', 'slow')
    expectEnabled('frozenSky', 'slow')
    expectEnabled('frozenSky', 'freeze')
    expectEnabled('frozenSky', 'shatter')
    expectEnabled('violetThunder', 'chain')
    expectEnabled('windBlade', 'return')
    expectEnabled('myriadSwords', 'return')
    expectEnabled('voidOrb', 'pull')
    expectEnabled('thunderOrb', 'orbit')
    expectEnabled('violetThunder', 'orbit')
    for (const id of ['baguaArray', 'infernoSea', 'venomMist', 'plagueTide']) {
      expect(getWeaponBehavior2D(id).residualField.enabled, id).toBe(true)
      expect(getWeaponBehavior2D(id).residualField.persistent, id).toBe(true)
    }
    for (const weapon of ALL.filter((row) => row.levels.some((level) => Object.hasOwn(level, 'knockback')))) {
      expect(getWeaponBehavior2D(weapon.id).statusEffects.knockback.enabled, weapon.id).toBe(true)
    }
  })

  it('reports no unconsumed source fields for every authored level row', () => {
    for (const weapon of ALL) {
      const coverage = getWeaponDataCoverage2D(weapon.id)
      expect(coverage.complete, weapon.id).toBe(true)
      expect(coverage.unconsumedFields, weapon.id).toEqual([])
      for (const field of Object.keys(weapon)) {
        expect(coverage.consumedFields, `${weapon.id}.${field}`).toContain(field)
      }
      const levelFields = new Set(weapon.levels.flatMap((level) => Object.keys(level)))
      for (const field of levelFields) {
        expect(coverage.consumedFields, `${weapon.id}.levels.${field}`).toContain(`levels.${field}`)
      }
    }
  })

  it('keeps level data, descriptors, and plan aliases immutable and JSON-safe', () => {
    const first = getWeaponBehavior2D('frozenSky', 1)
    const second = getWeaponBehavior2D('frozenSky', 1)
    expect(second).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.levelData)).toBe(true)
    expect(Object.isFrozen(first.trajectory)).toBe(true)
    expect(Object.isFrozen(first.statusEffects.freeze)).toBe(true)
    expect(() => { first.levelData.shatter = 0 }).toThrow()
    expect(() => { first.axes.push('bad') }).toThrow()
    expect(jsonRoundTrip(first)).toEqual(first)
    expect(planWeaponBehavior2D('frozenSky', 1)).toEqual(first)
  })

  it('is deterministic for custom input, clamps invalid levels, and has a safe unknown-id result', () => {
    const definition = {
      id: 'customPulse', name: 'Custom', tag: 'test', desc: 'test',
      levels: [{ damage: 1, cooldown: 0.5, amount: 2, speed: 4, area: 1, pull: 3 }],
    }
    const first = buildWeaponBehavior2D(definition, { level: 0 })
    const second = buildWeaponBehavior2D({ ...definition, levels: [{ ...definition.levels[0] }] }, { level: 99 })
    expect(first).toEqual(second)
    expect(first.levelData.pull).toBe(3)
    expect(first.unconsumedFields).toEqual([])
    expect(getWeaponBehavior2D('does-not-exist')).toBeNull()
    expect(buildWeaponBehavior2D({ id: 'empty', levels: [] })).toBeNull()
  })

  it('consumes every descriptor through the live fixed-pool weapon path', () => {
    const world = makeWorld()
    const audioEvents = []
    world.onWeaponAudio = (event) => audioEvents.push(event)
    for (const weapon of ALL) {
      world._fireWeapon(weapon.id, 1)
      expect(world.weaponBehaviorUsage.has(weapon.id), weapon.id).toBe(true)
      expect(world.weaponBehaviorAxesUsed.get(weapon.id), weapon.id)
        .toEqual(getWeaponBehavior2D(weapon.id).identityAxes)
    }
    expect(audioEvents.filter((event) => event.stage === 'launch')).toHaveLength(ALL.length)
    expect(world.weaponAudioCount).toBe(audioEvents.length)
    expect(audioEvents.every((event) => event.weaponId && event.kind && event.tag)).toBe(true)
    expect(world.projectiles.count).toBeGreaterThan(0)
    expect(world.weaponFields.count).toBeGreaterThan(0)
    expect(world.weaponFields.count).toBeLessThanOrEqual(MAX_WEAPON_FIELDS_2D)
    expect(world.snapshot.weaponFields).toBe(world.weaponFields)
  })

  it('emits launch, field, impact, and status audio contracts without field-tick flooding', () => {
    const world = makeWorld()
    const events = []
    world.onWeaponAudio = (event) => events.push(event)
    for (const weapon of ALL) world._fireWeapon(weapon.id, 1)

    const launches = events.filter((event) => event.stage === 'launch')
    const fields = events.filter((event) => event.stage === 'field')
    expect(launches).toHaveLength(ALL.length)
    expect(fields.length).toBeGreaterThan(0)
    expect(launches.every((event) => event.audio.weaponId === event.weaponId
      && event.audio.kind === event.kind && event.audio.tag === event.tag)).toBe(true)

    const fieldWorld = makeWorld(202)
    const fieldEvents = []
    fieldWorld.onWeaponAudio = (event) => fieldEvents.push(event)
    fieldWorld._fireWeapon('plagueTide', 1)
    const creationFieldCount = fieldEvents.filter((event) => event.stage === 'field').length
    for (let tick = 0; tick < 20; tick++) {
      fieldWorld.runTime += 0.1
      fieldWorld.weaponFields.update(0.1)
    }
    const tickFieldCount = fieldEvents.filter((event) => event.stage === 'field').length
    expect(creationFieldCount).toBe(1)
    expect(tickFieldCount).toBeLessThanOrEqual(4)

    const hitWorld = makeWorld(303)
    const hitEvents = []
    hitWorld.onWeaponAudio = (event) => hitEvents.push(event)
    hitWorld.enemies.spawn('wisp', 1.4, 0, 0)
    hitWorld.enemies.update(0, 0, hitWorld.player)
    hitWorld._fireWeapon('fireTalisman', 1)
    hitWorld.projectiles.update(0.1)
    expect(hitEvents.some((event) => event.stage === 'impact')).toBe(true)
    expect(hitEvents.some((event) => event.stage === 'status' && event.status === 'burn')).toBe(true)
  })

  it('applies status, pull, orbit, return, and persistent field contracts in simulation', () => {
    const fire = makeWorld()
    fire.enemies.spawn('wisp', 1.4, 0, 0)
    fire.enemies.update(0, 0, fire.player)
    fire._fireWeapon('fireTalisman', 1)
    fire.projectiles.update(0.1)
    expect(fire.enemies.burnTimer[0]).toBeGreaterThan(0)

    const frost = makeWorld()
    frost.enemies.spawn('wisp', 0, 3.2, 0)
    frost.enemies.update(0, 0, frost.player)
    frost._fireWeapon('frostPalm', 1)
    expect(frost.enemies.slowTimer[0]).toBeGreaterThan(0)

    const orbit = makeWorld()
    orbit._fireWeapon('thunderOrb', 1)
    expect(orbit.projectiles.orbit[0]).toBe(1)
    expect(orbit.projectiles.behaviorDescriptor[0].trajectory.orbit).toBe(true)

    const returning = makeWorld()
    returning._fireWeapon('windBlade', 1)
    expect(returning.projectiles.returnAt[0]).toBeGreaterThan(0)
    returning.projectiles.update(returning.projectiles.returnAt[0] + 0.01)
    expect(returning.projectiles.returnPhase[0]).toBe(1)

    const pull = makeWorld()
    pull.enemies.spawn('wisp', 2, 0, 0)
    pull.enemies.update(0, 0, pull.player)
    pull._fireWeapon('voidOrb', 1)
    const before = Math.hypot(pull.enemies.x[0], pull.enemies.z[0])
    pull.weaponFields.update(0.6)
    expect(Math.hypot(pull.enemies.x[0], pull.enemies.z[0])).toBeLessThan(before)

    const field = makeWorld()
    field._fireWeapon('baguaArray', 1)
    expect(field.weaponFields.count).toBe(1)
    expect(field.weaponFields.behavior[0].residualField.persistent).toBe(true)
  })

  it('bounds persistent fields without allocating beyond the fixed pool', () => {
    const world = makeWorld()
    const behavior = getWeaponBehavior2D('baguaArray')
    for (let i = 0; i < MAX_WEAPON_FIELDS_2D + 7; i++) {
      world.weaponFields.spawn({
        behavior, x: i, z: 0, radius: 1, life: 1, damage: 1, tag: 'array',
      })
    }
    expect(world.weaponFields.count).toBe(MAX_WEAPON_FIELDS_2D)
    expect(world.weaponFields.dropped).toBe(7)
  })
})
