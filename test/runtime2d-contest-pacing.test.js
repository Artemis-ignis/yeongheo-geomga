import { describe, expect, it } from 'vitest'
import {
  CONTEST_PACING_DURATION_SECONDS,
  CONTEST_PACING_MILESTONE_2D,
  CONTEST_PACING_MILESTONES_2D,
  ContestPacing2D,
} from '../src/runtime2d/ContestPacing2D.js'

const ids = (events) => events.map((event) => event.id)

describe('ContestPacing2D', () => {
  it('emits each authority milestone at its exact crossing once', () => {
    const director = new ContestPacing2D()

    expect(director.advance(19.999)).toEqual([])
    expect(director.advance(0.001)).toEqual([
      { id: CONTEST_PACING_MILESTONE_2D.firstOath, atSeconds: 20 },
    ])
    expect(director.advance(0)).toEqual([])
    expect(director.advance(99.999)).toEqual([])
    expect(director.advance(0.001)).toEqual([
      { id: CONTEST_PACING_MILESTONE_2D.poiEmphasis, atSeconds: 120 },
    ])

    expect(director.elapsedSeconds).toBe(120)
    expect(director.nextMilestone).toBe(CONTEST_PACING_MILESTONE_2D.midBoss)
    expect(director.firedMilestones).toEqual([
      CONTEST_PACING_MILESTONE_2D.firstOath,
      CONTEST_PACING_MILESTONE_2D.poiEmphasis,
    ])
  })

  it('does not miss or reorder milestones when one large dt crosses every boundary', () => {
    const director = new ContestPacing2D()
    const events = director.advance(421)

    expect(ids(events)).toEqual(CONTEST_PACING_MILESTONES_2D.map(({ id }) => id))
    expect(events).toEqual(CONTEST_PACING_MILESTONES_2D)
    expect(director.elapsedSeconds).toBe(CONTEST_PACING_DURATION_SECONDS)
    expect(director.timedOut).toBe(true)
    expect(director.nextMilestone).toBeNull()
    expect(director.advance(100)).toEqual([])
    expect(director.advance(0)).toEqual([])
  })

  it('round-trips serialized state without duplicating prior events', () => {
    const original = new ContestPacing2D()
    expect(ids(original.advance(21))).toEqual([CONTEST_PACING_MILESTONE_2D.firstOath])

    const saved = JSON.parse(JSON.stringify(original.serialize()))
    const restored = ContestPacing2D.fromSaveState(saved)
    expect(restored.snapshot()).toEqual(original.snapshot())
    expect(restored.advance(99)).toEqual([
      { id: CONTEST_PACING_MILESTONE_2D.poiEmphasis, atSeconds: 120 },
    ])

    const resumed = new ContestPacing2D({ saveState: original.serializeJson() })
    expect(ids(resumed.advance(399))).toEqual([
      CONTEST_PACING_MILESTONE_2D.poiEmphasis,
      CONTEST_PACING_MILESTONE_2D.midBoss,
      CONTEST_PACING_MILESTONE_2D.finalBoss,
      CONTEST_PACING_MILESTONE_2D.hardTimeout,
    ])
    expect(resumed.timedOut).toBe(true)
  })

  it('handles invalid dt safely and keeps invalid restore attempts atomic', () => {
    const director = new ContestPacing2D()
    expect(director.advance(Number.NaN)).toEqual([])
    expect(director.advance(-10)).toEqual([])
    expect(director.advance({ dtSeconds: 20 })).toEqual([
      { id: CONTEST_PACING_MILESTONE_2D.firstOath, atSeconds: 20 },
    ])

    const before = director.snapshot()
    expect(director.restore({ version: 999, elapsedSeconds: 300, fired: [] })).toBe(false)
    expect(director.restore({ version: 1, elapsedSeconds: 100, fired: ['hardTimeout'] })).toBe(false)
    expect(director.snapshot()).toEqual(before)

    director.reset()
    expect(director.snapshot()).toEqual({
      version: 1,
      elapsedSeconds: 0,
      fired: [],
      timedOut: false,
    })
  })

  it('keeps save snapshots immutable and JSON-safe', () => {
    const director = new ContestPacing2D()
    director.advance(180)
    const snapshot = director.snapshot()

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.fired)).toBe(true)
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(() => { snapshot.elapsedSeconds = 999 }).toThrow()
    expect(() => { snapshot.fired.push('finalBoss') }).toThrow()
  })
})
