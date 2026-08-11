import { describe, expect, it } from 'vitest'
import {
  MAP_CHUNK_SIZE, MAP_GROUND_VARIANTS, MAX_ACTIVE_MAP_CHUNKS,
  MAP_REGION_TYPES, activeMapChunks, hashMapCell, mapChunkAt, mapChunkKey,
  mapRegionForChunk, mapRegionNoise2D, propsForMapChunk,
} from '../src/runtime2d/WorldMap2D.js'

describe('streamed 2D world map', () => {
  it('streams a stable active window around any world position', () => {
    const chunks = activeMapChunks(180, -240)
    expect(chunks).toHaveLength(MAX_ACTIVE_MAP_CHUNKS)
    expect(chunks.some((chunk) => chunk.key === mapChunkKey(180, -240))).toBe(true)
    expect(activeMapChunks(180, -240)).toEqual(chunks)
    expect(chunks.every((chunk) => chunk.variant >= 0 && chunk.variant < MAP_GROUND_VARIANTS)).toBe(true)
    expect(chunks.every((chunk) => MAP_REGION_TYPES[chunk.regionId])).toBe(true)
    expect(chunks.every((chunk) => chunk.terrainRole && chunk.densityBand)).toBe(true)
  })

  it('shares a deterministic soft semantic region field across neighbouring chunks', () => {
    const seed = 0x1234abcd
    const region = mapRegionForChunk(7, -4, seed)
    const weightTotal = Object.values(region.weights).reduce((sum, value) => sum + value, 0)

    expect(mapRegionForChunk(7, -4, seed)).toEqual(region)
    expect(weightTotal).toBeCloseTo(1, 8)
    expect(MAP_REGION_TYPES[region.id]).toBeDefined()
    expect(region.mix).toBeGreaterThanOrEqual(0)
    expect(region.mix).toBeLessThanOrEqual(0.5)
    expect(Math.abs(mapRegionNoise2D(7, -4, seed) - mapRegionNoise2D(8, -4, seed))).toBeLessThan(0.5)
  })

  it('keeps the authored opening plaza inside one shared sanctuary region', () => {
    const openingChunks = activeMapChunks(0, 0, 77).filter(({ x, z }) =>
      (x === -1 || x === 0) && (z === -1 || z === 0))
    expect(openingChunks).toHaveLength(4)
    expect(new Set(openingChunks.map((chunk) => chunk.regionId))).toEqual(new Set(['spawn_grove']))
    expect(openingChunks.every((chunk) => chunk.terrainRole === 'sanctuary-plaza')).toBe(true)
  })

  it('changes chunks instead of clamping travel to the opening plaza', () => {
    expect(mapChunkAt(0, 0)).toEqual({ x: 0, z: 0 })
    expect(mapChunkAt(MAP_CHUNK_SIZE * 12 + 1, -MAP_CHUNK_SIZE * 9 - 1)).toEqual({ x: 12, z: -10 })
  })

  it('recreates sparse decoration deterministically inside each chunk', () => {
    const first = propsForMapChunk(7, -4, 123)
    expect(propsForMapChunk(7, -4, 123)).toEqual(first)
    const opening = [
      ...propsForMapChunk(-1, -1, 123),
      ...propsForMapChunk(0, -1, 123),
      ...propsForMapChunk(-1, 0, 123),
      ...propsForMapChunk(0, 0, 123),
    ]
    expect(opening).toHaveLength(5)
    expect(opening.every((prop) => prop.landmark)).toBe(true)
    expect(new Set(opening.map((prop) => prop.frame)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(opening.map((prop) => `${prop.x}:${prop.z}`)).size).toBe(opening.length)
    for (const prop of first) {
      expect(prop.x).toBeGreaterThan(7 * MAP_CHUNK_SIZE)
      expect(prop.x).toBeLessThan(8 * MAP_CHUNK_SIZE)
      expect(prop.z).toBeGreaterThan(-4 * MAP_CHUNK_SIZE)
      expect(prop.z).toBeLessThan(-3 * MAP_CHUNK_SIZE)
    }
    expect(hashMapCell(7, -4)).not.toBe(hashMapCell(8, -4))
  })

  it('builds authored landmark clusters instead of isolated random props', () => {
    let cluster = null
    for (let z = -20; z <= 20 && !cluster; z++) {
      for (let x = -20; x <= 20; x++) {
        const props = propsForMapChunk(x, z)
        if (props.length >= 4 && props.every((prop) => prop.landmark)) {
          cluster = props
          break
        }
      }
    }
    expect(cluster).not.toBeNull()
    expect(new Set(cluster.map((prop) => `${prop.x.toFixed(2)}:${prop.z.toFixed(2)}`)).size).toBe(cluster.length)
  })
})
