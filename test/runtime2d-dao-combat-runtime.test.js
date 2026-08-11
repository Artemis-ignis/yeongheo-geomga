import { describe, expect, it } from 'vitest'
import { DaoVows2D } from '../src/runtime2d/DaoVows2D.js'
import {
  DAO_COMBAT_ACTION_2D,
  DaoCombatRuntime2D,
  EMPTY_ACTIONS,
} from '../src/runtime2d/DaoCombatRuntime2D.js'

function snapshotFor(vowId, deepening, completion) {
  const model = new DaoVows2D({ vowId })
  if (deepening) model.select('deepening', deepening)
  if (completion) model.select('completion', completion)
  return model.snapshot()
}

function runtimeFor(vowId, deepening, completion, options = {}) {
  return new DaoCombatRuntime2D({
    snapshot: snapshotFor(vowId, deepening, completion),
    ...options,
  })
}

function flatten(ticks) { return ticks.flatMap((actions) => actions) }

describe('DaoCombatRuntime2D', () => {
  it('reuses a frozen shared empty action array when the queue is empty', () => {
    const runtime = new DaoCombatRuntime2D({ seed: 17 })
    const first = runtime.drainActions()
    const second = runtime.drainActions(0)
    const tick = runtime.tick({})

    expect(first).toBe(EMPTY_ACTIONS)
    expect(second).toBe(first)
    expect(tick).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(runtime.queueSize).toBe(0)
  })

  it('is a no-op when the Dao vow is unselected', () => {
    const runtime = new DaoCombatRuntime2D({ seed: 17 })
    const actions = runtime.tick({
      moving: true,
      dash: { id: 'dash-1', from: { x: 0, z: 0 }, to: { x: 1, z: 1 } },
      pickup: { id: 'pickup-1' },
      frozenDeaths: [{ id: 'enemy-1', status: 'frozen' }],
      runEnded: true,
    })

    expect(actions).toEqual([])
    expect(runtime.vowId).toBeNull()
    expect(runtime.queueSize).toBe(0)
    expect(runtime.snapshot().spirit.gauge).toBe(0)
  })

  it('charges sword movement into additional and returning sword-fan actions', () => {
    const additional = runtimeFor('sword', null, null, { fixedDt: 0.25, seed: 4 })
    const additionalActions = flatten([
      additional.tick({ moving: true, x: 1, z: 2 }),
      additional.tick({ moving: true, x: 1, z: 2 }),
      additional.tick({ moving: true, x: 1, z: 2 }),
    ])
    const extra = additionalActions.find((action) => action.type === DAO_COMBAT_ACTION_2D.swordFan)
    expect(extra).toMatchObject({ mode: 'additional', count: 4, returnHits: 0 })
    expect(extra.origin).toEqual({ x: 1, z: 2 })

    const returning = runtimeFor('sword', 'returning-edge', null, { fixedDt: 0.25, seed: 4 })
    const returningActions = flatten([
      returning.tick({ moving: true }),
      returning.tick({ moving: true }),
      returning.tick({ moving: true }),
    ])
    expect(returningActions.find((action) => action.type === DAO_COMBAT_ACTION_2D.swordFan)).toMatchObject({
      mode: 'returning', returnHits: 1,
    })

    expect(additional.swordCharge).toBeCloseTo(0.1, 6)
    expect(additional.tick({ moving: false })).toEqual([])
    expect(additional.swordCharge).toBe(0)
  })

  it('emits one deterministic completion ring per identified dash and carries sword modifiers', () => {
    const runtime = runtimeFor('sword', 'returning-edge', 'sword-ring', { fixedDt: 0.25, seed: 14 })
    const first = runtime.tick({
      dash: { id: 'dash-1', from: { x: 0, z: 0 }, to: { x: 0, z: 6 } },
      moving: true, x: 0, z: 6,
    })
    const duplicate = runtime.tick({
      dash: { id: 'dash-1', from: { x: 0, z: 0 }, to: { x: 0, z: 6 } },
      moving: true, x: 0, z: 6,
    })
    const later = flatten([
      runtime.tick({ moving: true, x: 0, z: 6 }),
      runtime.tick({ moving: true, x: 0, z: 6 }),
    ])
    const ring = first.find((action) => action.type === DAO_COMBAT_ACTION_2D.swordRing)
    const fan = [...first, ...duplicate, ...later]
      .find((action) => action.type === DAO_COMBAT_ACTION_2D.swordFan)

    expect(ring).toMatchObject({
      dashId: 'dash-1', position: { x: 0, z: 6 }, radius: 4.2, push: 8, duration: 0.45,
    })
    expect(first.filter((action) => action.type === DAO_COMBAT_ACTION_2D.swordRing)).toHaveLength(1)
    expect(duplicate.filter((action) => action.type === DAO_COMBAT_ACTION_2D.swordRing)).toEqual([])
    expect(fan).toMatchObject({ pierceAdd: 1, returnDelay: 0.26, returnHits: 1, mode: 'returning' })
    expect(runtime.snapshot().seen.swordDash).toEqual(['dash-1'])

    const piercing = runtimeFor('sword', 'piercing-edge', null, { fixedDt: 0.25, seed: 14 })
    const piercingActions = flatten([
      piercing.tick({ moving: true }),
      piercing.tick({ moving: true }),
      piercing.tick({ moving: true }),
    ])
    expect(piercingActions.find((action) => action.type === DAO_COMBAT_ACTION_2D.swordFan))
      .toMatchObject({ pierceAdd: 2, returnDelay: 0, returnHits: 0, mode: 'additional' })
  })

  it('turns two nearby frost dash fields into one wall/slow sequence and shards frozen deaths once', () => {
    const runtime = runtimeFor('frost', 'frost-shards', 'ice-wall', { seed: 9 })
    const first = runtime.tick({
      dash: { id: 'dash-1', from: { x: 0, z: 0 }, to: { x: 1, z: 0 } },
      frozenDeaths: [{ id: 'enemy-1', x: 3, z: 2, status: 'frozen' }],
    })
    const duplicateDeath = runtime.tick({
      frozenDeaths: [{ id: 'enemy-1', x: 3, z: 2, status: 'frozen' }],
    })
    const fields = first.filter((action) => action.type === DAO_COMBAT_ACTION_2D.frostField)
    const slows = first.filter((action) => action.type === DAO_COMBAT_ACTION_2D.frostSlow)
    const walls = first.filter((action) => action.type === DAO_COMBAT_ACTION_2D.frostWall)
    const shards = first.filter((action) => action.type === DAO_COMBAT_ACTION_2D.frostDeathShards)

    expect(fields).toHaveLength(2)
    expect(slows).toHaveLength(2)
    expect(walls).toHaveLength(1)
    expect(walls[0].fromFieldId).not.toBe(walls[0].toFieldId)
    expect(shards).toHaveLength(1)
    expect(shards[0]).toMatchObject({ count: 3, deathId: 'enemy-1' })
    expect(duplicateDeath.filter((action) => action.type === DAO_COMBAT_ACTION_2D.frostDeathShards)).toEqual([])

    const serialized = runtime.serialize()
    expect(serialized.frost.fields).toHaveLength(2)
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized)
  })

  it('chains spirit pickups into overcharge, spends purge gauge on dash, then emits shadow pull and clone at end', () => {
    const runtime = runtimeFor('spirit', 'purifying-heart', 'shadow-copy', { seed: 22 })
    runtime.setSpiritGauge(runtime.gaugeMax - 18)
    const overcharge = runtime.tick({ pickup: { id: 'pickup-1' } })
    expect(overcharge.map((action) => action.type)).toEqual([
      DAO_COMBAT_ACTION_2D.spiritPickup,
      DAO_COMBAT_ACTION_2D.spiritOvercharge,
    ])
    expect(runtime.overchargeActive).toBe(true)
    expect(runtime.gauge).toBe(runtime.gaugeMax)

    const purge = runtime.tick({
      dash: { id: 'dash-1', from: { x: 0, z: 0 }, to: { x: 2, z: 0 } },
    })
    expect(purge).toHaveLength(1)
    expect(purge[0]).toMatchObject({ type: DAO_COMBAT_ACTION_2D.spiritPurge, cost: 40, cycle: 1 })
    expect(runtime.gauge).toBe(runtime.gaugeMax - 40)

    const ending = runtime.tick({ overchargeEnded: true })
    expect(ending.map((action) => action.type)).toEqual([
      DAO_COMBAT_ACTION_2D.spiritShadowPull,
      DAO_COMBAT_ACTION_2D.spiritAttackClone,
    ])
    expect(ending[0]).toMatchObject({ reason: 'overcharge-end', count: 2, radius: 4 })
    expect(ending[1]).toMatchObject({ reason: 'overcharge-end', count: 2 })
    expect(runtime.tick({ overchargeEnded: true })).toEqual([])
  })

  it('prevents duplicate identified dash/pickup/death events without sharing subsystem latches', () => {
    const runtime = runtimeFor('spirit', 'purifying-heart', 'shadow-copy', { seed: 3 })
    runtime.setSpiritGauge(runtime.gaugeMax - 18)
    runtime.tick({ pickup: { id: 'pickup-1' } })
    const firstDash = runtime.tick({
      dash: { id: 'dash-1', from: { x: 0, z: 0 }, to: { x: 1, z: 0 } },
    })
    const duplicateDash = runtime.tick({
      dash: { id: 'dash-1', from: { x: 0, z: 0 }, to: { x: 1, z: 0 } },
    })
    expect(firstDash.filter((action) => action.type === DAO_COMBAT_ACTION_2D.spiritPurge)).toHaveLength(1)
    expect(duplicateDash.filter((action) => action.type === DAO_COMBAT_ACTION_2D.spiritPurge)).toEqual([])

    const pickupDuplicate = runtime.tick({ pickup: { id: 'pickup-1' } })
    expect(pickupDuplicate.filter((action) => action.type === DAO_COMBAT_ACTION_2D.spiritPickup)).toEqual([])

    const frost = runtimeFor('frost', 'frost-shards', 'ice-wall')
    const death = { id: 'frozen-1', x: 1, z: 1, frozen: true }
    expect(frost.tick({ frozenDeaths: [death] }).filter((action) => action.type === DAO_COMBAT_ACTION_2D.frostDeathShards)).toHaveLength(1)
    expect(frost.tick({ frozenDeaths: [death] }).filter((action) => action.type === DAO_COMBAT_ACTION_2D.frostDeathShards)).toEqual([])
  })

  it('is seed-deterministic and restores fixed-tick state for identical future inputs', () => {
    const input = [
      { moving: true, x: 2, z: -1 },
      { moving: true, x: 2, z: -1 },
      { moving: true, x: 2, z: -1 },
      { frozenDeaths: [{ id: 'enemy-1', x: 2, z: 4, status: 'frozen' }] },
    ]
    const a = runtimeFor('frost', 'frost-shards', 'ice-wall', { fixedDt: 0.25, seed: 77 })
    const b = runtimeFor('frost', 'frost-shards', 'ice-wall', { fixedDt: 0.25, seed: 77 })
    const aActions = flatten(input.map((tick) => a.tick(tick)))
    const bActions = flatten(input.map((tick) => b.tick(tick)))
    expect(aActions).toEqual(bActions)

    const saved = JSON.parse(JSON.stringify(a.serialize()))
    const restored = DaoCombatRuntime2D.fromSaveState(saved)
    expect(restored.snapshot()).toEqual(a.snapshot())
    const next = { dash: { id: 'dash-after-save', from: { x: 0, z: 0 }, to: { x: 1, z: 0 } } }
    expect(restored.tick(next)).toEqual(a.tick(next))
    expect(restored.snapshot()).toEqual(a.snapshot())
  })
})
