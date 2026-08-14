import { describe, expect, it } from 'vitest'
import { ENEMIES } from '../src/data/enemies.js'
import { FORMATIONS } from '../src/data/formations.js'
import { RUN_SECONDS } from '../src/data/waves.js'
import {
  DEFAULT_FORMATION_SEED,
  FORMATION_DIRECTOR_VERSION,
  FormationDirector2D,
} from '../src/runtime2d/FormationDirector2D.js'

function player(x = 4, z = -7, facing = Math.PI / 3) {
  return { player: { x, z, facing, prevX: x - 0.1, prevZ: z - 0.08 } }
}

function runToEnd(seed = DEFAULT_FORMATION_SEED, handler = null) {
  const director = new FormationDirector2D({ seed })
  const events = []
  const onEvent = (event) => {
    events.push(event)
    return handler?.(event)
  }
  for (let tick = 0; tick <= RUN_SECONDS * 60; tick++) {
    director.update(tick / 60, player(), onEvent)
  }
  return { director, events }
}

describe('FormationDirector2D fixed-tick timeline', () => {
  it('emits every declared event exactly once and marks formationSeen on the first event', () => {
    const director = new FormationDirector2D({ seed: 44 })
    const events = []

    expect(director.formationSeen).toBe(false)
    for (let tick = 0; tick < FORMATIONS[0].t * 60; tick++) {
      expect(director.update(tick / 60, player(), (event) => { events.push(event) })).toBe(0)
      expect(director.formationSeen).toBe(false)
    }

    expect(director.update(FORMATIONS[0].t, player(), (event) => { events.push(event) })).toBe(1)
    expect(director.formationSeen).toBe(true)
    for (let tick = FORMATIONS[0].t * 60 + 1; tick <= RUN_SECONDS * 60; tick++) {
      director.update(tick / 60, player(), (event) => { events.push(event) })
    }
    expect(events.map((event) => event.index)).toEqual(FORMATIONS.map((_, i) => i))
    expect(new Set(events.map((event) => event.id)).size).toBe(FORMATIONS.length)
    expect(director.done).toBe(true)
    expect(director.nextFormationIndex).toBe(FORMATIONS.length)
  })

  it('is deterministic for a fixed seed and context, including event anchors', () => {
    const first = runToEnd(0x12345678)
    const second = runToEnd(0x12345678)
    expect(second.events).toEqual(first.events)
    expect(second.director.toSaveState()).toEqual(first.director.toSaveState())

    const different = runToEnd(0x12345679)
    expect(different.events.map((event) => event.id)).not.toEqual(first.events.map((event) => event.id))
    // A moving player fixes its heading, so ring geometry is equal while the
    // event identity/seed remains different. This is intentional determinism.
    expect(different.events[1].angles).toEqual(first.events[1].angles)
  })

  it('resolves a formation type to the toughest enemy allowed by the roster', () => {
    const byId = Object.fromEntries(ENEMIES.map((enemy) => [enemy.id, enemy]))
    const target = { ...FORMATIONS[FORMATIONS.length - 1], type: 'glacierWarden' }
    const jade = new FormationDirector2D({ formations: [target], seed: 7, roster: ['wisp', 'wolf', 'demonCultivator'], byId })
    const frost = new FormationDirector2D({ formations: [target], seed: 7, roster: ['wisp', 'wolf', 'glacierWarden'], byId })

    const jadeEvent = jade.poll(target.t, player())
    const frostEvent = frost.poll(target.t, player())
    expect(jadeEvent.type).toBe('demonCultivator')
    expect(frostEvent.type).toBe('glacierWarden')
    expect(jadeEvent.wantedType).toBe('glacierWarden')
  })

  it('retries a failed spawn without changing or duplicating the event', () => {
    const director = new FormationDirector2D({ seed: 99 })
    const attempts = []
    const accepted = []
    let failures = 2
    const handler = (event) => {
      attempts.push({ id: event.id, index: event.index, centerX: event.centerX, centerZ: event.centerZ })
      if (failures-- > 0) return false
      accepted.push(event)
      return true
    }

    expect(director.update(75, player(), handler)).toBe(0)
    expect(director.formationSeen).toBe(true)
    expect(director.pendingIndex).toBe(0)
    expect(director.update(76, player(100, 100), handler)).toBe(0)
    expect(director.pendingIndex).toBe(0)
    expect(director.update(77, player(200, 200), handler)).toBe(1)
    expect(accepted).toHaveLength(1)
    expect(attempts).toHaveLength(3)
    expect(new Set(attempts.map((attempt) => attempt.id)).size).toBe(1)
    expect(new Set(attempts.map((attempt) => `${attempt.centerX}:${attempt.centerZ}`)).size).toBe(1)

    // The next due event is still pending until its own successful callback;
    // later timeline entries cannot leapfrog a failed one.
    expect(director.nextFormationIndex).toBe(1)
  })

  it('serializes and restores both a completed cursor and a pending retry anchor', () => {
    const original = new FormationDirector2D({ seed: 8128 })
    const first = original.poll(75, player(1, 2, 0.2))
    expect(original.commit(first)).toBe(true)
    const pending = original.poll(140, player(8, 9, 0.7))
    expect(pending.index).toBe(1)
    expect(original.retry(pending)).toBe(true)

    const saved = original.toSaveState()
    expect(saved).toMatchObject({
      version: FORMATION_DIRECTOR_VERSION,
      seed: 8128,
      nextIndex: 1,
      formationSeen: true,
      retryCount: 1,
      pending: { index: 1, x: 8, z: 9, facing: 0.7 },
    })

    const restored = new FormationDirector2D({ seed: 8128 })
    expect(restored.restore(JSON.parse(JSON.stringify(saved)))).toBe(true)
    expect(restored.retryCount).toBe(1)
    const restoredPending = restored.poll(999, player(1000, 1000, 2.1))
    expect(restoredPending).toEqual(pending)
    expect(restored.commit(restoredPending)).toBe(true)
    expect(restored.nextFormationIndex).toBe(2)
    expect(restored.formationSeen).toBe(true)

    const wrongSeed = new FormationDirector2D({ seed: 8129 })
    expect(wrongSeed.restore(saved)).toBe(false)
    expect(wrongSeed.nextFormationIndex).toBe(0)
  })

  it('supports fixed-delta ticks without allocating a per-tick event list', () => {
    const director = new FormationDirector2D({ seed: 1 })
    let emitted = 0
    for (let i = 0; i < 74 * 60; i++) emitted += director.tick(1 / 60, player(), () => {})
    expect(emitted).toBe(0)
    expect(director.pendingEvent).toBeNull()
    expect(director.formationSeen).toBe(false)
    expect(director.tick(1, player(), () => {})).toBe(1)
    expect(director.formationSeen).toBe(true)
  })
})
