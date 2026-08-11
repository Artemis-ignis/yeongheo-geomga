import { describe, expect, it } from 'vitest'
import { MAP_CHUNK_SIZE } from '../src/runtime2d/WorldMap2D.js'
import {
  POI_REGION_AFFINITY,
  POI_TYPE,
  WORLD_INTERACTIONS_VERSION,
  WorldInteractions2D,
  activeWorldPois,
  guidancePoiChunk,
  poiForMapChunk,
} from '../src/runtime2d/WorldInteractions2D.js'

function findPois(seed = 12345, stageId = 'jade', wanted = 1) {
  const found = []
  for (let z = -30; z <= 30 && found.length < wanted; z++) {
    for (let x = -30; x <= 30 && found.length < wanted; x++) {
      const poi = poiForMapChunk(x, z, seed, stageId)
      if (poi) found.push(poi)
    }
  }
  return found
}

describe('streamed 2D world interactions', () => {
  it('reconstructs stable POI ids, types and positions after a chunk revisit', () => {
    const [poi] = findPois(44, 'jade')
    expect(poi).toBeTruthy()
    expect(poiForMapChunk(poi.chunkX, poi.chunkZ, 44, 'jade')).toEqual(poi)
    expect(Object.isFrozen(poi)).toBe(true)
    expect(poi.regionId).toBeTruthy()
    expect(poi.x).toBeGreaterThan(poi.chunkX * MAP_CHUNK_SIZE)
    expect(poi.x).toBeLessThan((poi.chunkX + 1) * MAP_CHUNK_SIZE)
    expect(poi.z).toBeGreaterThan(poi.chunkZ * MAP_CHUNK_SIZE)
    expect(poi.z).toBeLessThan((poi.chunkZ + 1) * MAP_CHUNK_SIZE)
    expect(poiForMapChunk(0, 0, 44, 'jade')).toBeNull()

    const otherStage = poiForMapChunk(poi.chunkX, poi.chunkZ, 44, 'frost')
    expect(otherStage?.id).not.toBe(poi.id)
  })

  it('distributes all four authored interaction types in the deterministic world', () => {
    const types = new Set()
    for (let z = -40; z <= 40; z++) {
      for (let x = -40; x <= 40; x++) {
        const poi = poiForMapChunk(x, z, 991, 'jade')
        if (poi) types.add(poi.type)
      }
    }
    expect(types).toEqual(new Set(Object.values(POI_TYPE)))
  })

  it('keeps the opening sanctuary safe and exposes the shared region affinity contract', () => {
    for (const z of [-1, 0]) {
      for (const x of [-1, 0]) {
        expect(poiForMapChunk(x, z, 991, 'jade')).toBeNull()
      }
    }
    expect(POI_REGION_AFFINITY.lantern_shrine.altar).toBeGreaterThan(1)
    expect(POI_REGION_AFFINITY.jade_path.treasure).toBeGreaterThan(1)
    expect(POI_REGION_AFFINITY.jade_grove.treasure).toBeGreaterThan(1)
    expect(POI_REGION_AFFINITY.void_rim.elite_seal).toBeGreaterThan(1)
    expect(POI_REGION_AFFINITY.mist_marsh.healing_spring).toBeGreaterThan(1)
  })

  it('guarantees one deterministic first POI just outside the safe opening', () => {
    for (const seed of [1, 44, 991, 31337]) {
      const chunk = guidancePoiChunk(seed, 'jade')
      expect([[1, 0], [0, 1], [-2, 0], [0, -2]]).toContainEqual([chunk.x, chunk.z])
      const poi = poiForMapChunk(chunk.x, chunk.z, seed, 'jade')
      expect(poi).toBeTruthy()
      expect(poi.chunkX).toBe(chunk.x)
      expect(poi.chunkZ).toBe(chunk.z)
      expect(activeWorldPois(0, 0, seed, 'jade').some((candidate) => candidate.id === poi.id)).toBe(true)
    }
    expect(guidancePoiChunk(991, 'jade')).toEqual(guidancePoiChunk(991, 'jade'))
  })

  it('detects proximity and publishes each reward exactly once', () => {
    const [poi] = findPois(777, 'jade')
    const world = new WorldInteractions2D({ seed: 777, stageId: 'jade' })
    expect(world.interact(poi.x + 50, poi.z + 50)).toBeNull()
    expect(world.findNearby(poi.x, poi.z)?.id).toBe(poi.id)

    const event = world.interact(poi.x, poi.z)
    expect(event).toMatchObject({
      id: `${poi.id}:reward`,
      type: 'poi_reward',
      poiId: poi.id,
      poiType: poi.type,
    })
    expect(event.reward.kind).toMatch(/blessing|treasure|elite_encounter|healing/)
    expect(world.interact(poi.x, poi.z)).toBeNull()
    expect(world.drainEvents()).toEqual([event])
    expect(world.drainEvents()).toEqual([])
  })

  it('round-trips only pure save data and restores consumed POIs after streaming away', () => {
    const [poi] = findPois(8128, 'jade')
    const first = new WorldInteractions2D({ seed: 8128, stageId: 'jade' })
    first.interact(poi.x, poi.z)

    const saved = JSON.parse(JSON.stringify(first.toSaveState()))
    expect(saved).toEqual({
      version: WORLD_INTERACTIONS_VERSION,
      seed: 8128,
      stageId: 'jade',
      consumed: [poi.id],
    })

    // Rebuilding the streamed chunk in a new runtime must preserve its state.
    const restored = new WorldInteractions2D({ seed: 8128, stageId: 'jade', saveState: saved })
    expect(restored.isConsumed(poi.id)).toBe(true)
    expect(restored.findNearby(poi.x, poi.z)).toBeNull()
    const snapshot = restored.getRenderSnapshot(poi.x, poi.z)
    expect(snapshot.items.find((item) => item.id === poi.id)?.state).toBe('consumed')

    // A run from another stage/seed cannot accidentally inherit consumed ids.
    const unrelated = new WorldInteractions2D({ seed: 8128, stageId: 'frost', saveState: saved })
    expect(unrelated.toSaveState().consumed).toEqual([])
  })

  it('provides an immutable, JSON-safe render snapshot for the active stream window', () => {
    const [poi] = findPois(31337, 'jade')
    const world = new WorldInteractions2D({ seed: 31337, stageId: 'jade' })
    const snapshot = world.getRenderSnapshot(poi.x, poi.z)
    const item = snapshot.items.find((candidate) => candidate.id === poi.id)
    expect(item).toMatchObject({ id: poi.id, state: 'available' })
    expect(item.regionId).toBe(poi.regionId)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.items)).toBe(true)
    expect(Object.isFrozen(item)).toBe(true)
    expect(() => JSON.parse(JSON.stringify(snapshot))).not.toThrow()
    expect(activeWorldPois(poi.x, poi.z, 31337, 'jade')).toEqual(world.getActivePois(poi.x, poi.z))
  })
})
