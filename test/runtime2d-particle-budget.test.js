import { describe, expect, it } from 'vitest'
import {
  EFFECT_KIND_2D,
  HitEventQueue2D,
  coalesceHitEvents2D,
  planEffectRenderSamples,
  planParticlePool2D,
} from '../src/runtime2d/ParticleBudget2D.js'

describe('ParticleBudget2D', () => {
  it('samples mixed effects with an independent deterministic budget per kind', () => {
    const kind = new Uint8Array([
      ...Array(80).fill(EFFECT_KIND_2D.hit),
      ...Array(30).fill(EFFECT_KIND_2D.ring),
      ...Array(50).fill(EFFECT_KIND_2D.death),
    ])
    const first = planEffectRenderSamples(kind, kind.length, { density: 1, frameId: 17 })
    const second = planEffectRenderSamples(kind, kind.length, { density: 1, frameId: 17 })

    expect(first.byKind[EFFECT_KIND_2D.hit].activeCount).toBe(14)
    expect(first.byKind[EFFECT_KIND_2D.ring].activeCount).toBe(16)
    expect(first.byKind[EFFECT_KIND_2D.death].activeCount).toBe(24)
    expect([...first.indices]).toEqual([...second.indices])
    expect(first.activeCount).toBe(54)
  })

  it('keeps low-density effects above the readability floor', () => {
    const kind = new Uint8Array(100).fill(EFFECT_KIND_2D.hit)
    const plan = planEffectRenderSamples(kind, kind.length, { density: 0 })
    expect(plan.activeCount).toBe(6)
    expect(plan.droppedCount).toBe(94)
  })

  it('separates allocated storage from active ParticleContainer children', () => {
    const plan = planParticlePool2D(1500, {
      budget: 360,
      maximum: 1500,
      previousActiveCount: 1200,
      currentAllocatedCount: 1280,
      allocationBlock: 128,
    })
    expect(plan.activeCount).toBe(360)
    expect(plan.stride).toBeCloseTo(1500 / 360)
    expect(plan.indices).toHaveLength(360)
    expect(plan.allocatedCount).toBe(1280)
    expect(plan.detachCount).toBe(840)
    expect(plan.submittedIndexCount).toBe(2160)
  })

  it('plans zero active particles after a stress burst without losing the storage pool', () => {
    const plan = planParticlePool2D(0, {
      budget: 1200,
      maximum: 1200,
      previousActiveCount: 1200,
      currentAllocatedCount: 1200,
    })
    expect(plan.activeCount).toBe(0)
    expect(plan.allocatedCount).toBe(1200)
    expect(plan.detachCount).toBe(1200)
    expect(plan.submittedQuadCount).toBe(0)
    expect(plan.submittedIndexCount).toBe(0)
  })
})

describe('HitEventQueue2D', () => {
  it('coalesces a 500-hit frame inside presentation budgets without losing damage', () => {
    const events = Array.from({ length: 500 }, (_, i) => ({
      x: (i % 25) * 0.12,
      z: Math.floor(i / 25) * 0.12,
      tag: i % 2 ? 'sword' : 'lightning',
      crit: i === 377,
      amount: i % 7 + 1,
    }))
    const expectedDamage = events.reduce((sum, event) => sum + event.amount, 0)
    const result = coalesceHitEvents2D(events)

    expect(result.summary.acceptedCount).toBe(500)
    expect(result.summary.totalDamage).toBe(expectedDamage)
    expect(result.summary.hasCrit).toBe(true)
    expect(result.damageNumbers.length).toBeLessThanOrEqual(20)
    expect(result.hitEffects.length).toBeLessThanOrEqual(32)
    expect(result.audio.length).toBeLessThanOrEqual(4)
    expect(result.damageNumbers.reduce((sum, event) => sum + event.amount, 0)).toBe(expectedDamage)
    expect(result.damageNumbers.some((event) => event.crit)).toBe(true)
  })

  it('does not merge nearby hits with different presentation tags prematurely', () => {
    const result = coalesceHitEvents2D([
      { x: 0, z: 0, tag: 'fire', crit: false, amount: 11 },
      { x: 0.1, z: 0.1, tag: 'poison', crit: true, amount: 13 },
    ])
    expect(result.summary.spatialGroupCount).toBe(2)
    expect(result.damageNumbers.map((event) => event.tag)).toEqual(['fire', 'poison'])
    expect(result.audio.map((event) => event.tag)).toEqual(['poison', 'fire'])
  })

  it('compacts distant overflow groups while preserving per-tag totals', () => {
    const events = Array.from({ length: 60 }, (_, i) => ({
      x: i * 5,
      z: 0,
      tag: i % 3 === 0 ? 'fire' : i % 3 === 1 ? 'poison' : 'sword',
      crit: i === 59,
      amount: i + 0.25,
    }))
    const result = coalesceHitEvents2D(events, { damageNumberBudget: 12 })
    const tagTotals = new Map()
    for (const group of result.damageNumbers) {
      for (const tag of group.tags) tagTotals.set(tag.tag, (tagTotals.get(tag.tag) ?? 0) + tag.amount)
    }
    for (const tag of ['fire', 'poison', 'sword']) {
      const expected = events.filter((event) => event.tag === tag).reduce((sum, event) => sum + event.amount, 0)
      expect(tagTotals.get(tag)).toBeCloseTo(expected, 10)
    }
    expect(result.damageNumbers).toHaveLength(12)
    expect(result.damageNumbers.some((event) => event.crit)).toBe(true)
  })

  it('is deterministic for an identical frame and rotates only when frameId changes', () => {
    const events = Array.from({ length: 90 }, (_, i) => ({
      x: i * 3, z: i % 4, tag: 'sword', crit: i % 19 === 0, amount: 1,
    }))
    const first = coalesceHitEvents2D(events, { frameId: 42 })
    const second = coalesceHitEvents2D(events, { frameId: 42 })
    const next = coalesceHitEvents2D(events, { frameId: 43 })
    expect(first).toEqual(second)
    expect(first.hitEffects.map((event) => event.x)).not.toEqual(next.hitEffects.map((event) => event.x))
    expect(first.summary).toEqual(next.summary)
  })

  it('flushes queued events once and advances its deterministic frame', () => {
    const queue = new HitEventQueue2D()
    queue.enqueue(1, 2, 'sword', false, 9)
    queue.enqueue(1.2, 2.1, 'sword', true, 14)
    const result = queue.flush()
    expect(result.summary.totalDamage).toBe(23)
    expect(result.summary.hasCrit).toBe(true)
    expect(queue.count).toBe(0)
    expect(queue.flush().summary.acceptedCount).toBe(0)
  })

  it('grows its typed queue without dropping burst hits', () => {
    const queue = new HitEventQueue2D(16)
    for (let i = 0; i < 600; i++) queue.enqueue(i * 0.01, 0, 'sword', i === 599, 2)
    expect(queue.count).toBe(600)
    const result = queue.flush()
    expect(result.summary.acceptedCount).toBe(600)
    expect(result.summary.totalDamage).toBe(1200)
    expect(result.summary.hasCrit).toBe(true)
  })

  it('rejects invalid events without contaminating totals', () => {
    const result = coalesceHitEvents2D([
      { x: 0, z: 0, tag: 'sword', crit: false, amount: 5 },
      { x: Number.NaN, z: 0, tag: 'sword', crit: true, amount: 99 },
      { x: 0, z: 0, tag: 'sword', crit: true, amount: -2 },
    ])
    expect(result.summary.acceptedCount).toBe(1)
    expect(result.summary.rejectedCount).toBe(2)
    expect(result.summary.totalDamage).toBe(5)
    expect(result.summary.hasCrit).toBe(false)
  })
})
