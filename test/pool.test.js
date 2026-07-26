import { describe, it, expect } from 'vitest'
import { Pool } from '../src/core/Pool.js'

describe('Pool', () => {
  it('hands out dense indices starting at 0', () => {
    const p = new Pool(4)
    expect(p.acquire()).toBe(0)
    expect(p.acquire()).toBe(1)
    expect(p.acquire()).toBe(2)
    expect(p.count).toBe(3)
  })

  it('returns -1 and counts a drop when at capacity', () => {
    const p = new Pool(2)
    p.acquire()
    p.acquire()
    expect(p.acquire()).toBe(-1)
    expect(p.dropped).toBe(1)
    expect(p.count).toBe(2)
  })

  it('keeps the live range dense after a middle release', () => {
    const p = new Pool(4)
    p.acquire()
    p.acquire()
    p.acquire()
    p.release(0)
    expect(p.count).toBe(2)
    expect(p.isAlive(0)).toBe(true)
    expect(p.isAlive(1)).toBe(true)
    expect(p.isAlive(2)).toBe(false)
  })

  it('reports which slot was swapped into the released one', () => {
    const p = new Pool(4)
    p.acquire()
    p.acquire()
    p.acquire()
    p.release(0)
    expect(p.lastSwappedFrom).toBe(2)
  })

  it('reports -1 when releasing the last live slot', () => {
    const p = new Pool(4)
    p.acquire()
    p.acquire()
    p.release(1)
    expect(p.lastSwappedFrom).toBe(-1)
  })

  it('ignores releasing a dead slot', () => {
    const p = new Pool(4)
    p.acquire()
    p.release(0)
    p.release(0)
    expect(p.count).toBe(0)
  })

  it('survives many acquire/release cycles without leaking', () => {
    const p = new Pool(64)
    for (let cycle = 0; cycle < 10000; cycle++) {
      const n = 1 + (cycle % 64)
      for (let i = 0; i < n; i++) p.acquire()
      while (p.count > 0) p.release(p.count - 1)
    }
    expect(p.count).toBe(0)
    expect(p.acquire()).toBe(0)
  })

  it('clear() frees everything', () => {
    const p = new Pool(4)
    p.acquire()
    p.acquire()
    p.clear()
    expect(p.count).toBe(0)
    expect(p.isAlive(0)).toBe(false)
  })
})
