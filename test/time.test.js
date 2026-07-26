import { describe, it, expect } from 'vitest'
import { Clock, FIXED_DT } from '../src/core/Time.js'

describe('Clock', () => {
  it('exposes a 60Hz fixed timestep', () => {
    expect(FIXED_DT).toBeCloseTo(1 / 60, 10)
  })

  it('runs one tick for one fixed step of real time', () => {
    expect(new Clock().step(FIXED_DT)).toBe(1)
  })

  it('accumulates sub-step time instead of dropping it', () => {
    const c = new Clock()
    expect(c.step(FIXED_DT * 0.6)).toBe(0)
    expect(c.step(FIXED_DT * 0.6)).toBe(1)
  })

  it('runs multiple ticks for a long frame', () => {
    expect(new Clock().step(FIXED_DT * 3)).toBe(3)
  })

  it('clamps a huge frame so it cannot spiral', () => {
    expect(new Clock().step(10)).toBeLessThanOrEqual(5)
  })

  it('does not bank unbounded time across a stall', () => {
    const c = new Clock()
    c.step(10)
    expect(c.step(0)).toBe(0)
  })

  it('reports an alpha in [0, 1)', () => {
    const c = new Clock()
    c.step(FIXED_DT * 1.5)
    expect(c.alpha).toBeGreaterThanOrEqual(0)
    expect(c.alpha).toBeLessThan(1)
  })

  it('reset() clears the accumulator', () => {
    const c = new Clock()
    c.step(FIXED_DT * 0.9)
    c.reset()
    expect(c.step(FIXED_DT * 0.5)).toBe(0)
    expect(c.alpha).toBeCloseTo(0.5, 5)
  })

  it('simulates the same number of ticks per second at any framerate', () => {
    const at60 = new Clock()
    const at144 = new Clock()
    let ticks60 = 0
    let ticks144 = 0
    for (let i = 0; i < 60; i++) ticks60 += at60.step(1 / 60)
    for (let i = 0; i < 144; i++) ticks144 += at144.step(1 / 144)
    expect(ticks60).toBe(60)
    expect(Math.abs(ticks144 - 60)).toBeLessThanOrEqual(1)
  })
})
