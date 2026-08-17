import { describe, expect, it } from 'vitest'
import {
  MAP_CHUNK_SIZE, MAP_GROUND_VARIANTS, MAX_ACTIVE_MAP_CHUNKS,
  MAX_ACTIVE_MAP_PROPS, OPENING_CORRIDOR_CLEARANCE,
  OPENING_CORRIDOR_HALF_WIDTH, OPENING_CORRIDOR_MIN_WIDTH,
  OPENING_MIN_PROP_SPACING, OPENING_VIEWPORT_WORLD_BOUNDS,
  RECOMMENDED_ACTIVE_MAP_PROP_CAPACITY,
  SUPPORTED_MAP_SEED_MAX, SUPPORTED_MAP_SEED_MIN,
  activeMapPropCapacityInvariant, activeMapPropCount,
  MAP_REGION_TYPES, activeMapChunks, hashMapCell, mapChunkAt, mapChunkKey,
  mapRegionForChunk, mapRegionNoise2D, propsForMapChunk,
} from '../src/runtime2d/WorldMap2D.js'
import { projectWorld } from '../src/runtime2d/projection.js'

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
    expect(opening).toHaveLength(16)
    expect(opening.filter((prop) => prop.landmark)).toHaveLength(2)
    expect(new Set(opening.map((prop) => prop.frame))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]))
    expect(new Set(opening.map((prop) => `${prop.x}:${prop.z}`)).size).toBe(opening.length)
    expect(opening.filter(({ x, z }) => (
      x >= OPENING_VIEWPORT_WORLD_BOUNDS.minX
      && x <= OPENING_VIEWPORT_WORLD_BOUNDS.maxX
      && z >= OPENING_VIEWPORT_WORLD_BOUNDS.minZ
      && z <= OPENING_VIEWPORT_WORLD_BOUNDS.maxZ
    ))).toHaveLength(16)
    for (const prop of first) {
      expect(prop.x).toBeGreaterThan(7 * MAP_CHUNK_SIZE)
      expect(prop.x).toBeLessThan(8 * MAP_CHUNK_SIZE)
      expect(prop.z).toBeGreaterThan(-4 * MAP_CHUNK_SIZE)
      expect(prop.z).toBeLessThan(-3 * MAP_CHUNK_SIZE)
    }
    expect(hashMapCell(7, -4)).not.toBe(hashMapCell(8, -4))
  })

  it('keeps an asymmetric 16-prop sanctuary opening readable and navigable', () => {
    const opening = [
      ...propsForMapChunk(-1, -1, 123),
      ...propsForMapChunk(0, -1, 123),
      ...propsForMapChunk(-1, 0, 123),
      ...propsForMapChunk(0, 0, 123),
    ]
    const positions = new Set(opening.map(({ x, z }) => `${x}:${z}`))
    const left = opening.filter(({ x }) => x < 0)
    const right = opening.filter(({ x }) => x > 0)
    const minDistanceFromRoute = Math.min(...opening.map(({ x }) => Math.abs(x)))
    const radialBands = new Set(opening.map(({ x, z }) => {
      const distance = Math.hypot(x, z)
      return distance >= 20 ? 'far' : distance >= 10 ? 'mid' : 'near'
    }))

    expect(opening).toHaveLength(16)
    expect(positions.size).toBe(16)
    expect(left.length).toBeGreaterThan(0)
    expect(right.length).toBeGreaterThan(0)
    expect(left.map(({ x, z }) => `${(-x).toFixed(2)}:${z.toFixed(2)}`).sort())
      .not.toEqual(right.map(({ x, z }) => `${x.toFixed(2)}:${z.toFixed(2)}`).sort())
    expect(radialBands).toEqual(new Set(['far', 'mid', 'near']))
    expect(minDistanceFromRoute).toBeGreaterThanOrEqual(
      OPENING_CORRIDOR_HALF_WIDTH + OPENING_CORRIDOR_CLEARANCE,
    )
    expect(OPENING_CORRIDOR_MIN_WIDTH).toBeGreaterThanOrEqual(10)
    for (let i = 0; i < opening.length; i++) {
      for (let j = i + 1; j < opening.length; j++) {
        expect(Math.hypot(opening[i].x - opening[j].x, opening[i].z - opening[j].z))
          .toBeGreaterThanOrEqual(OPENING_MIN_PROP_SPACING)
      }
    }
    expect(opening.filter((prop) => prop.landmark)).toHaveLength(2)
  })

  it.each([
    { width: 1280, height: 720, zoom: 1 },
    { width: 1920, height: 1080, zoom: 1 },
    { width: 2560, height: 1600, zoom: 1 },
  ])('keeps the authored opening clusters legible at %j', (viewport) => {
    const opening = [
      ...propsForMapChunk(-1, -1, 123),
      ...propsForMapChunk(0, -1, 123),
      ...propsForMapChunk(-1, 0, 123),
      ...propsForMapChunk(0, 0, 123),
    ]
    const projected = opening.map((prop) => projectWorld(prop.x, prop.z, 0, 0, viewport))
    let minimumProjectedSeparation = Infinity
    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        minimumProjectedSeparation = Math.min(
          minimumProjectedSeparation,
          Math.hypot(projected[i].x - projected[j].x, projected[i].y - projected[j].y),
        )
      }
    }
    expect(new Set(opening.map((prop) => prop.cluster))).toEqual(new Set([
      'far-threshold', 'left-ruin', 'right-shrine', 'near-reeds',
    ]))
    expect(new Set(opening.map((prop) => prop.scale)).size).toBeGreaterThanOrEqual(12)
    expect(opening.every((prop) => prop.rotation === 0)).toBe(true)
    // 1280 is the tightest supported view. The authored sprite heights are
    // below this spacing at presentation scale, so no two edge silhouettes
    // collapse into one sticker-like mass.
    expect(minimumProjectedSeparation).toBeGreaterThanOrEqual(100)
  })

  it('reports a deterministic active-window capacity invariant for supported seeds', () => {
    expect(RECOMMENDED_ACTIVE_MAP_PROP_CAPACITY).toBeGreaterThanOrEqual(128)
    expect(MAX_ACTIVE_MAP_PROPS).toBeGreaterThanOrEqual(RECOMMENDED_ACTIVE_MAP_PROP_CAPACITY)
    const first = activeMapPropCapacityInvariant()
    const second = activeMapPropCapacityInvariant()

    expect(first).toEqual(second)
    expect(first.seedStart).toBe(SUPPORTED_MAP_SEED_MIN)
    expect(first.seedEnd).toBe(SUPPORTED_MAP_SEED_MAX)
    expect(first.maxCount).toBeGreaterThanOrEqual(16)
    expect(first.maxCount).toBeLessThanOrEqual(MAX_ACTIVE_MAP_PROPS)
    expect(first.withinCapacity).toBe(true)
    expect(activeMapPropCount(0, 0, first.maxSeed)).toBe(first.maxCount)
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
