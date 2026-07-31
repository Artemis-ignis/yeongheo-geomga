import { describe, it, expect } from 'vitest'
import { Grass } from '../src/world/Grass.js'

/** Enough of a scene for Grass to attach to; it never reads anything back. */
const fakeScene = () => ({ add() {}, remove() {} })

const OUTER = 46

describe('grass field', () => {
  it('covers the frustum at every zoom the camera allows', () => {
    // The field wraps at uTileSize. If that ever falls below the visible
    // diameter the tile's own seam walks across the ground as a hard edge of
    // grass — the failure this sizing exists to prevent.
    const g = new Grass(fakeScene(), 0, OUTER, { density: 0.02 })
    for (const viewRadius of [18, 27.3, 40]) {
      for (const zoom of [0.8, 1, 1.35, 1.9]) {
        g.setView(viewRadius, zoom)
        const tile = g.material.uniforms.uTileSize.value
        expect(tile).toBeGreaterThan(2 * viewRadius * zoom)
      }
    }
  })

  it('never collapses the tile to nothing on a degenerate viewport', () => {
    const g = new Grass(fakeScene(), 0, OUTER, { density: 0.02 })
    g.setView(0, 1)
    expect(g.material.uniforms.uTileSize.value).toBeGreaterThan(1)
  })

  it('scales the count with the stage density', () => {
    const sparse = new Grass(fakeScene(), 0, OUTER, { density: 0.02 })
    const dense = new Grass(fakeScene(), 0, OUTER, { density: 0.05 })
    expect(dense.mesh.geometry.instanceCount)
      .toBeGreaterThan(sparse.mesh.geometry.instanceCount)
  })

  it('authors every blade inside the tile it wraps at', () => {
    // A blade placed outside the build tile lands in the neighbouring copy and
    // shows up as a clump that pops when the wrap carries it over.
    const g = new Grass(fakeScene(), 0, OUTER, { density: 0.02 })
    const off = g.mesh.geometry.attributes.aOffset.array
    const build = g.material.uniforms.uTileBuild.value
    let worst = 0
    for (let i = 0; i < off.length; i += 3) {
      worst = Math.max(worst, Math.abs(off[i]), Math.abs(off[i + 2]))
    }
    // Half a tile, plus the tuft spread a blade may sit out from its centre.
    expect(worst).toBeLessThan(build / 2 + 1)
  })
})

describe('grass density scaling', () => {
  const fake = () => ({ add() {}, remove() {} })

  it('thins the field without reallocating it', () => {
    const g = new Grass(fake(), 0, OUTER, { density: 0.05 })
    const full = g.fullCount
    const buffer = g.mesh.geometry.attributes.aOffset.array
    g.setDensityScale(0.5)
    expect(g.mesh.geometry.instanceCount).toBeLessThan(full)
    expect(g.mesh.geometry.instanceCount).toBeGreaterThan(full * 0.4)
    // Same buffer: a prefix of a randomly-ordered field is already a uniform
    // random subset, so nothing has to be rebuilt to thin it.
    expect(g.mesh.geometry.attributes.aOffset.array).toBe(buffer)
    g.setDensityScale(1)
    expect(g.mesh.geometry.instanceCount).toBe(full)
  })

  it('never draws more blades than it built, or none at all', () => {
    const g = new Grass(fake(), 0, OUTER, { density: 0.05 })
    for (const f of [-5, 0, 0.01, 0.5, 1, 4]) {
      g.setDensityScale(f)
      expect(g.mesh.geometry.instanceCount).toBeGreaterThan(0)
      expect(g.mesh.geometry.instanceCount).toBeLessThanOrEqual(g.fullCount)
    }
  })
})
