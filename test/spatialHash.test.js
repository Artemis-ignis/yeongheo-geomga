import { describe, it, expect } from 'vitest'
import { SpatialHash } from '../src/core/SpatialHash.js'
import { RNG } from '../src/core/RNG.js'

function bruteForce(points, x, z, radius) {
  const r2 = radius * radius
  const hits = []
  for (let i = 0; i < points.length; i += 2) {
    const dx = points[i] - x
    const dz = points[i + 1] - z
    if (dx * dx + dz * dz <= r2) hits.push(i / 2)
  }
  return hits
}

describe('SpatialHash', () => {
  it('returns nothing when empty', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(64)
    expect(grid.query(0, 0, 10, out)).toBe(0)
  })

  it('finds a point at the query centre', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(64)
    grid.insert(7, 1.5, -2.5)
    const n = grid.query(1.5, -2.5, 1, out)
    expect(n).toBe(1)
    expect(out[0]).toBe(7)
  })

  it('never omits a point within the radius (randomised vs brute force)', () => {
    const rng = new RNG(2024)
    const grid = new SpatialHash(4)
    const out = new Int32Array(2048)
    const points = []
    for (let i = 0; i < 800; i++) {
      const x = rng.range(-60, 60)
      const z = rng.range(-60, 60)
      points.push(x, z)
      grid.insert(i, x, z)
    }
    for (let t = 0; t < 200; t++) {
      const qx = rng.range(-60, 60)
      const qz = rng.range(-60, 60)
      const qr = rng.range(0.5, 12)
      const n = grid.query(qx, qz, qr, out)
      const returned = new Set()
      for (let i = 0; i < n; i++) returned.add(out[i])
      for (const id of bruteForce(points, qx, qz, qr)) {
        expect(returned.has(id)).toBe(true)
      }
    }
  })

  it('handles negative coordinates', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(64)
    grid.insert(1, -13.2, -41.9)
    expect(grid.query(-13.2, -41.9, 0.5, out)).toBe(1)
    expect(out[0]).toBe(1)
  })

  it('handles a radius spanning many cells', () => {
    const grid = new SpatialHash(2)
    const out = new Int32Array(256)
    for (let i = 0; i < 100; i++) grid.insert(i, i * 0.5 - 25, 0)
    expect(grid.query(0, 0, 30, out)).toBe(100)
  })

  it('clear() empties the grid', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(64)
    grid.insert(1, 0, 0)
    grid.clear()
    expect(grid.query(0, 0, 10, out)).toBe(0)
  })

  it('reuses cell arrays across clears so steady state does not allocate', () => {
    const grid = new SpatialHash(4)
    for (let i = 0; i < 50; i++) grid.insert(i, i, 0)
    grid.clear()
    const pooled = grid.freeLists.length
    expect(pooled).toBeGreaterThan(0)
    for (let i = 0; i < 50; i++) grid.insert(i, i, 0)
    expect(grid.freeLists.length).toBeLessThan(pooled + 1)
  })

  it('does not overflow the caller-supplied out array', () => {
    const grid = new SpatialHash(4)
    const out = new Int32Array(5)
    for (let i = 0; i < 50; i++) grid.insert(i, 0, 0)
    expect(grid.query(0, 0, 10, out)).toBeLessThanOrEqual(5)
  })
})
