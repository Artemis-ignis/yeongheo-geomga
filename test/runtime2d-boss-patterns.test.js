import { describe, expect, it } from 'vitest'
import {
  BOSS_PATTERN_PHASE_SEQUENCES_2D,
  FINAL_MIRROR_BOSS_ID_2D,
  MIN_TELEGRAPH_SECONDS_2D,
  MIRROR_PATTERN_METADATA_2D,
  bossPatternSequence2D,
  isBossPatternPlan2D,
  nextBossPatternEvent2D,
  planBossPatterns2D,
  validateBossPatternPlan2D,
} from '../src/runtime2d/BossPatterns2D.js'
import { DaoVows2D } from '../src/runtime2d/DaoVows2D.js'

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value))
}

function selectedDaoMirror(vowId, deepening, completion) {
  const dao = new DaoVows2D({ vowId })
  dao.select('deepening', deepening)
  dao.select('completion', completion)
  return dao.getMirrorPatternMetadata()
}

describe('BossPatterns2D', () => {
  it('covers the three mirror vows with distinct phase sequences', () => {
    expect(Object.keys(BOSS_PATTERN_PHASE_SEQUENCES_2D)).toEqual(['sword', 'frost', 'spirit', 'fallback'])
    for (const vowId of ['sword', 'frost', 'spirit']) {
      const sequence = bossPatternSequence2D(vowId)
      expect(sequence).toHaveLength(3)
      expect(new Set(sequence).size).toBe(3)
      expect(MIRROR_PATTERN_METADATA_2D.vows[vowId].phases.map((row) => row.patternId)).toEqual(sequence)
    }
  })

  it('plans readable telegraph -> danger -> safe windows for every vow phase', () => {
    for (const vowId of ['sword', 'frost', 'spirit']) {
      for (const phase of [1, 2, 3]) {
        const plan = planBossPatterns2D({
          bossId: FINAL_MIRROR_BOSS_ID_2D,
          phase,
          time: 315.25,
          seed: 0x51f15e,
          vowId,
        })
        expect(plan.fallback).toBe(false)
        expect(plan.events.length).toBeGreaterThan(0)
        expect(plan.events[0].vowId).toBe(vowId)
        expect(plan.events[0].telegraphDuration).toBeGreaterThanOrEqual(MIN_TELEGRAPH_SECONDS_2D)
        expect(plan.events[0].executeAt).toBeGreaterThanOrEqual(plan.events[0].telegraphStart + MIN_TELEGRAPH_SECONDS_2D)
        expect(plan.events[0].geometry.type).toMatch(/line|cone|zone|orbit|radial/)
        expect(plan.events[0].paletteKey).toEqual(expect.any(String))
        expect(plan.events[0].damageMultiplier).toBeGreaterThanOrEqual(0)
        expect(validateBossPatternPlan2D(plan)).toEqual({ ok: true, errors: [] })
      }
    }
  })

  it('enforces the release 0.8 second telegraph floor for legacy metadata', () => {
    const plan = planBossPatterns2D({
      bossId: FINAL_MIRROR_BOSS_ID_2D,
      phase: 1,
      time: 1,
      seed: 77,
      mirrorPatternMetadata: {
        vowId: 'sword',
        phases: [{ patternId: 'swordLine', telegraphDuration: 0.05 }],
      },
      eventCount: 1,
    })
    expect(MIN_TELEGRAPH_SECONDS_2D).toBe(0.8)
    expect(plan.events[0].telegraphDuration).toBe(0.8)
    expect(plan.events[0].executeAt - plan.events[0].telegraphStart).toBe(0.8)
    expect(validateBossPatternPlan2D(plan)).toEqual({ ok: true, errors: [] })
  })

  it('keeps hazard windows ordered even when metadata marks attacks unavoidable', () => {
    const plan = planBossPatterns2D({
      phase: 2,
      time: 12,
      seed: 'showcase-avoidance',
      mirrorPatternMetadata: {
        vowId: 'frost',
        phases: [{ patternId: 'frostZone', avoidable: false, telegraphDuration: 0.36, activeDuration: 1.1 },
          { patternId: 'frostLane', avoidable: false, telegraphDuration: 0.36, activeDuration: 1.1 },
          { patternId: 'frostMine', avoidable: false, telegraphDuration: 0.36, activeDuration: 1.1 }],
      },
    })
    for (let index = 1; index < plan.events.length; index++) {
      expect(plan.events[index].dangerStart).toBeGreaterThanOrEqual(plan.events[index - 1].dangerEnd)
    }
    expect(plan.events.every((event) => event.unavoidable)).toBe(true)
    expect(isBossPatternPlan2D(plan)).toBe(true)
  })

  it('is deterministic for equal inputs and changes authored direction with the seed', () => {
    const input = { bossId: FINAL_MIRROR_BOSS_ID_2D, phase: 3, time: 381.125, seed: 44, vowIds: ['sword', 'frost', 'spirit'] }
    const first = planBossPatterns2D(input)
    const second = planBossPatterns2D({ ...input })
    expect(second).toEqual(first)
    expect(jsonRoundTrip(first)).toEqual(first)
    const other = planBossPatterns2D({ ...input, seed: 45 })
    expect(other.events[0].geometry.angle).not.toBe(first.events[0].geometry.angle)
    expect(other.events.map((event) => event.executeAt)).toEqual(first.events.map((event) => event.executeAt))
  })

  it('accepts metadata and vow aliases without mutating the metadata', () => {
    const metadata = {
      vowId: '설맥',
      phases: ['frostZone', 'frostLane', 'frostMine'],
    }
    const before = jsonRoundTrip(metadata)
    const plan = planBossPatterns2D({ bossId: FINAL_MIRROR_BOSS_ID_2D, phase: '완성', time: 4, seed: 'a', mirrorPatternMetadata: metadata })
    expect(plan.vowId).toBe('frost')
    expect(plan.patternId).toBe('frostMine')
    expect(metadata).toEqual(before)
  })

  it('consumes Dao deepening metadata and carries each branch into phase 2 and 3', () => {
    const branches = [
      {
        vowId: 'sword',
        completion: 'sword-ring',
        left: ['returning-edge', 'returning-sword-line', 'returning-sword-ring'],
        right: ['piercing-edge', 'piercing-sword-cross', 'piercing-sword-ring'],
      },
      {
        vowId: 'frost',
        completion: 'ice-wall',
        left: ['frost-shards', 'chain-frost-mines-shards', 'chain-frost-wall-shards'],
        right: ['frost-line', 'cutting-ice-line', 'cutting-ice-wall-line'],
      },
      {
        vowId: 'spirit',
        completion: 'shadow-copy',
        left: ['purifying-heart', 'tracking-shadow-double-purge', 'shadow-summon-overcharge-purge'],
        right: ['echoing-heart', 'tracking-shadow-double-echo', 'shadow-summon-overcharge-echo'],
      },
    ]
    for (const branch of branches) {
      const leftMetadata = selectedDaoMirror(branch.vowId, branch.left[0], branch.completion)
      const rightMetadata = selectedDaoMirror(branch.vowId, branch.right[0], branch.completion)
      for (const phase of [2, 3]) {
        const left = planBossPatterns2D({
          bossId: FINAL_MIRROR_BOSS_ID_2D, vowId: branch.vowId, phase, time: 24, seed: 88,
          mirrorPatternMetadata: leftMetadata, eventCount: 1,
        })
        const right = planBossPatterns2D({
          bossId: FINAL_MIRROR_BOSS_ID_2D, vowId: branch.vowId, phase, time: 24, seed: 88,
          mirrorPatternMetadata: rightMetadata, eventCount: 1,
        })
        expect(left.fallback).toBe(false)
        expect(right.fallback).toBe(false)
        expect(left.patternId).toBe(branch.left[phase - 1])
        expect(right.patternId).toBe(branch.right[phase - 1])
        expect(left.patternId).not.toBe(right.patternId)
        expect(left.geometry).not.toEqual(right.geometry)
        expect(left.paletteKey).not.toBe(right.paletteKey)
        expect(left.intent).not.toBe(right.intent)
        expect(left.choiceId).not.toBe(right.choiceId)
        expect(left.events[0].telegraphDuration).toBeGreaterThanOrEqual(MIN_TELEGRAPH_SECONDS_2D)
        expect(right.events[0].telegraphDuration).toBeGreaterThanOrEqual(MIN_TELEGRAPH_SECONDS_2D)
        expect(left.events[0].telegraphHint).toEqual(expect.any(String))
        expect(left.phaseSequence[phase - 1]).toBe(left.patternId)
        expect(right.phaseSequence[phase - 1]).toBe(right.patternId)
      }
    }
  })

  it('uses a low-damage radial fallback for invalid or unsafe inputs', () => {
    const invalid = planBossPatterns2D({
      bossId: 'not-a-boss', phase: Number.NaN, time: Infinity, seed: { circular: null },
      mirrorPatternMetadata: { vowId: 'unknown', phases: [{ type: 'not-a-pattern' }] },
    })
    expect(invalid.fallback).toBe(true)
    expect(invalid.fallbackReason).toMatch(/unknown-boss|invalid-mirror-metadata/)
    expect(invalid.events[0].patternId).toBe('radialVolley')
    expect(invalid.events[0].geometry.type).toBe('radial')
    expect(invalid.events[0].damageMultiplier).toBeLessThan(1)
    expect(validateBossPatternPlan2D(invalid).ok).toBe(true)
    expect(() => JSON.stringify(invalid)).not.toThrow()
  })

  it('returns recursively immutable plans and immutable event helpers', () => {
    const plan = planBossPatterns2D({ phase: 1, vowId: 'sword', seed: 99 })
    expect(Object.isFrozen(plan)).toBe(true)
    expect(Object.isFrozen(plan.events)).toBe(true)
    expect(Object.isFrozen(plan.events[0])).toBe(true)
    expect(Object.isFrozen(plan.events[0].geometry)).toBe(true)
    expect(Object.isFrozen(plan.events[0].geometry.direction)).toBe(true)
    expect(() => plan.events.push({})).toThrow()
    expect(() => { plan.events[0].geometry.type = 'zone' }).toThrow()
    const event = nextBossPatternEvent2D({ phase: 3, vowId: 'spirit', seed: 8 })
    expect(Object.isFrozen(event)).toBe(true)
    expect(Object.isFrozen(event.geometry)).toBe(true)
  })
})
