import { describe, it, expect } from 'vitest'
import { RNG, makeSeed } from '../src/core/RNG.js'

describe('RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new RNG(12345)
    const b = new RNG(12345)
    const seqA = Array.from({ length: 50 }, () => a.next())
    const seqB = Array.from({ length: 50 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('diverges for different seeds', () => {
    const a = new RNG(1)
    const b = new RNG(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('stays within [0, 1)', () => {
    const r = new RNG(999)
    for (let i = 0; i < 5000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int() returns integers in [0, maxExclusive)', () => {
    const r = new RNG(7)
    for (let i = 0; i < 2000; i++) {
      const v = r.int(6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
    }
  })

  it('range() spans the requested interval', () => {
    const r = new RNG(42)
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 5000; i++) {
      const v = r.range(-3, 7)
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    expect(min).toBeGreaterThanOrEqual(-3)
    expect(max).toBeLessThan(7)
    expect(min).toBeLessThan(-2.5)
    expect(max).toBeGreaterThan(6.5)
  })

  it('pick() only returns members of the array', () => {
    const r = new RNG(3)
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 200; i++) expect(arr).toContain(r.pick(arr))
  })

  it('chance(0) is never true and chance(1) is always true', () => {
    const r = new RNG(5)
    for (let i = 0; i < 200; i++) {
      expect(r.chance(0)).toBe(false)
      expect(r.chance(1)).toBe(true)
    }
  })

  it('angle() covers the full circle', () => {
    const r = new RNG(17)
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 5000; i++) {
      const v = r.angle()
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeLessThan(Math.PI * 2)
    expect(min).toBeLessThan(0.05)
    expect(max).toBeGreaterThan(Math.PI * 2 - 0.05)
  })

  it('makeSeed returns a 32-bit unsigned integer', () => {
    for (let i = 0; i < 100; i++) {
      const s = makeSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThan(2 ** 32)
    }
  })
})
