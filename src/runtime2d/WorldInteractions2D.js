import {
  MAP_CHUNK_SIZE,
  activeMapChunks,
  hashMapCell,
  mapRegionForChunk,
  mapChunkAt,
} from './WorldMap2D.js'

export const WORLD_INTERACTIONS_VERSION = 1
export const DEFAULT_INTERACTION_SEED = 0x7a11ce

export const POI_TYPE = Object.freeze({
  altar: 'altar',
  treasure: 'treasure',
  eliteSeal: 'elite_seal',
  healingSpring: 'healing_spring',
})

const POI_TYPES = Object.freeze(Object.values(POI_TYPE))
const POI_RADIUS = Object.freeze({
  [POI_TYPE.altar]: 2.4,
  [POI_TYPE.treasure]: 2.1,
  [POI_TYPE.eliteSeal]: 2.8,
  [POI_TYPE.healingSpring]: 2.5,
})

const GUIDANCE_POI_CHUNKS = Object.freeze([
  Object.freeze({ x: 1, z: 0 }),
  Object.freeze({ x: 0, z: 1 }),
  Object.freeze({ x: -2, z: 0 }),
  Object.freeze({ x: 0, z: -2 }),
])

/**
 * Region-to-POI affinity is a presentation/layout contract, not a hard
 * placement rule. Every type keeps a non-zero baseline so a streamed world
 * can still surface the full authored interaction vocabulary, while the
 * shared region weights make a shrine feel different from a marsh or the
 * void rim. Values are relative weights (1 = neutral).
 */
export const POI_REGION_AFFINITY = Object.freeze({
  spawn_grove: Object.freeze({ altar: 1.25, treasure: 0.9, elite_seal: 0.2, healing_spring: 1.35 }),
  jade_path: Object.freeze({ altar: 0.82, treasure: 1.55, elite_seal: 0.92, healing_spring: 0.86 }),
  jade_grove: Object.freeze({ altar: 1.0, treasure: 1.35, elite_seal: 0.84, healing_spring: 1.0 }),
  lantern_shrine: Object.freeze({ altar: 2.7, treasure: 0.62, elite_seal: 0.48, healing_spring: 0.9 }),
  mist_marsh: Object.freeze({ altar: 0.68, treasure: 0.76, elite_seal: 0.58, healing_spring: 2.65 }),
  void_rim: Object.freeze({ altar: 0.55, treasure: 0.78, elite_seal: 2.8, healing_spring: 0.46 }),
})

function hashText(value) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

function unitFloat(hash) {
  return (hash >>> 0) / 4294967296
}

function normalizeStageId(stageId) {
  return String(stageId || 'jade').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'jade'
}

function poiPrefix(stageId, seed) {
  return `poi:${stageId}:${(seed >>> 0).toString(16)}:`
}

function freezePoi(poi) {
  return Object.freeze({
    id: poi.id,
    type: poi.type,
    regionId: poi.regionId,
    x: poi.x,
    z: poi.z,
    chunkX: poi.chunkX,
    chunkZ: poi.chunkZ,
    interactionRadius: poi.interactionRadius,
  })
}

function choosePoiType(chunkX, chunkZ, stageSeed, region) {
  const regionWeights = region?.weights ?? { [region?.id ?? 'jade_grove']: 1 }
  const weights = POI_TYPES.map((type) => {
    const affinity = Object.entries(regionWeights).reduce((sum, [regionId, weight]) => {
      return sum + weight * (POI_REGION_AFFINITY[regionId]?.[type] ?? 1)
    }, 0)
    // Keep every authored type viable even when a region has a strong
    // signature. The baseline is intentionally small, so affinity remains
    // visible without making the result deterministic by region alone.
    return 0.18 + affinity
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = unitFloat(hashMapCell(
    chunkX * 31 + 23,
    chunkZ * 17 - 7,
    stageSeed ^ 0x5e2f9a17,
  )) * total
  for (let i = 0; i < POI_TYPES.length; i++) {
    roll -= weights[i]
    if (roll < 0) return POI_TYPES[i]
  }
  return POI_TYPES[POI_TYPES.length - 1]
}

/**
 * Reserve one nearby, non-opening chunk as the first exploration landmark.
 * The choice stays seed/stage deterministic and keeps the four authored spawn
 * chunks clear, while guaranteeing the 120-second POI objective has a real
 * radar target rather than depending entirely on the one-in-five scatter.
 */
export function guidancePoiChunk(seed = DEFAULT_INTERACTION_SEED, stageId = 'jade') {
  const normalizedStageId = normalizeStageId(stageId)
  const stageSeed = ((seed >>> 0) ^ hashText(normalizedStageId)) >>> 0
  return GUIDANCE_POI_CHUNKS[hashMapCell(3, -7, stageSeed ^ 0x3f5a9d21) % GUIDANCE_POI_CHUNKS.length]
}

/**
 * Returns the one persistent point of interest authored for a map chunk.
 *
 * Generation is deliberately pure: the result depends only on chunk, seed and
 * stage. It may therefore be discarded with a streamed chunk and reconstructed
 * later without moving the POI or changing its stable save identifier.
 */
export function poiForMapChunk(chunkX, chunkZ, seed = DEFAULT_INTERACTION_SEED, stageId = 'jade') {
  chunkX |= 0
  chunkZ |= 0
  seed >>>= 0
  stageId = normalizeStageId(stageId)

  // Keep the entire authored opening sanctuary clear. Roughly one in five
  // later chunks receives a POI, enough to make exploration meaningful
  // without turning every screen into a row of vending machines.
  const region = mapRegionForChunk(chunkX, chunkZ, seed, stageId)
  if (region.id === 'spawn_grove') return null
  const stageSeed = (seed ^ hashText(stageId)) >>> 0
  const root = hashMapCell(chunkX, chunkZ, stageSeed)
  const guidanceChunk = guidancePoiChunk(seed, stageId)
  const isGuidancePoi = chunkX === guidanceChunk.x && chunkZ === guidanceChunk.z
  if (!isGuidancePoi && root % 5 !== 0) return null

  const type = choosePoiType(chunkX, chunkZ, stageSeed, region)
  const margin = 6.5
  const span = MAP_CHUNK_SIZE - margin * 2
  const xHash = hashMapCell(chunkX * 17 + 3, chunkZ * 7 - 11, stageSeed ^ 0xa341316c)
  const zHash = hashMapCell(chunkX * 5 - 13, chunkZ * 19 + 7, stageSeed ^ 0xc8013ea4)

  return freezePoi({
    id: `${poiPrefix(stageId, seed)}${chunkX}:${chunkZ}`,
    type,
    regionId: region.id,
    x: chunkX * MAP_CHUNK_SIZE + margin + unitFloat(xHash) * span,
    z: chunkZ * MAP_CHUNK_SIZE + margin + unitFloat(zHash) * span,
    chunkX,
    chunkZ,
    interactionRadius: POI_RADIUS[type],
  })
}

export function activeWorldPois(cameraX, cameraZ, seed = DEFAULT_INTERACTION_SEED, stageId = 'jade') {
  const pois = []
  for (const chunk of activeMapChunks(cameraX, cameraZ, seed, stageId)) {
    const poi = poiForMapChunk(chunk.x, chunk.z, seed, stageId)
    if (poi) pois.push(poi)
  }
  return pois
}

function rewardForPoi(poi, seed) {
  const roll = hashText(`${poi.id}:${seed >>> 0}:reward`)
  if (poi.type === POI_TYPE.altar) {
    const blessings = ['power', 'haste', 'area', 'fortune']
    return Object.freeze({ kind: 'blessing', stat: blessings[roll % blessings.length], amount: 0.08 + ((roll >>> 5) % 5) * 0.01 })
  }
  if (poi.type === POI_TYPE.treasure) {
    return Object.freeze({ kind: 'treasure', spiritStones: 18 + (roll % 18), experience: 24 + ((roll >>> 8) % 25) })
  }
  if (poi.type === POI_TYPE.eliteSeal) {
    return Object.freeze({ kind: 'elite_encounter', tier: 1 + (roll % 3), victoryExperience: 65 + ((roll >>> 9) % 36) })
  }
  return Object.freeze({ kind: 'healing', healthFraction: 0.32 + (roll % 4) * 0.04 })
}

function distanceSq(aX, aZ, bX, bZ) {
  const dx = aX - bX
  const dz = aZ - bZ
  return dx * dx + dz * dz
}

/**
 * Stateful owner for one-run POI consumption. All public save/snapshot data is
 * JSON-safe and contains no Pixi objects, callbacks, Sets or typed-array views.
 */
export class WorldInteractions2D {
  constructor({ seed = DEFAULT_INTERACTION_SEED, stageId = 'jade', saveState = null } = {}) {
    this.seed = seed >>> 0
    this.stageId = normalizeStageId(stageId)
    this.consumed = new Set()
    this.pendingEvents = []
    if (saveState) this.restore(saveState)
  }

  isConsumed(id) {
    return this.consumed.has(id)
  }

  getActivePois(cameraX, cameraZ) {
    return activeWorldPois(cameraX, cameraZ, this.seed, this.stageId)
  }

  findNearby(playerX, playerZ, extraRadius = 0) {
    if (!Number.isFinite(playerX) || !Number.isFinite(playerZ)) return null
    extraRadius = Number.isFinite(extraRadius) ? Math.max(0, extraRadius) : 0
    const center = mapChunkAt(playerX, playerZ)
    let nearest = null
    let nearestDistanceSq = Infinity

    // The POI margin and maximum interaction radius mean a 3x3 chunk search is
    // sufficient even while the player stands directly on a chunk boundary.
    for (let z = center.z - 1; z <= center.z + 1; z++) {
      for (let x = center.x - 1; x <= center.x + 1; x++) {
        const poi = poiForMapChunk(x, z, this.seed, this.stageId)
        if (!poi || this.consumed.has(poi.id)) continue
        const radius = poi.interactionRadius + extraRadius
        const d2 = distanceSq(playerX, playerZ, poi.x, poi.z)
        if (d2 <= radius * radius && d2 < nearestDistanceSq) {
          nearest = poi
          nearestDistanceSq = d2
        }
      }
    }
    return nearest
  }

  interact(playerX, playerZ, extraRadius = 0) {
    const poi = this.findNearby(playerX, playerZ, extraRadius)
    if (!poi) return null

    // Consume before publishing the event so even a re-entrant caller cannot
    // receive the same reward twice.
    this.consumed.add(poi.id)
    const reward = rewardForPoi(poi, this.seed)
    const event = Object.freeze({
      id: `${poi.id}:reward`,
      type: 'poi_reward',
      poiId: poi.id,
      poiType: poi.type,
      x: poi.x,
      z: poi.z,
      reward,
    })
    this.pendingEvents.push(event)
    return event
  }

  drainEvents() {
    if (this.pendingEvents.length === 0) return []
    const events = this.pendingEvents.slice()
    this.pendingEvents.length = 0
    return events
  }

  toSaveState() {
    return {
      version: WORLD_INTERACTIONS_VERSION,
      seed: this.seed,
      stageId: this.stageId,
      consumed: [...this.consumed].sort(),
    }
  }

  restore(state) {
    this.consumed.clear()
    this.pendingEvents.length = 0
    if (!state || typeof state !== 'object') return false
    if ((state.seed >>> 0) !== this.seed || normalizeStageId(state.stageId) !== this.stageId) return false

    const prefix = poiPrefix(this.stageId, this.seed)
    if (Array.isArray(state.consumed)) {
      for (const id of state.consumed) {
        if (typeof id === 'string' && id.startsWith(prefix) && id.length <= 128) this.consumed.add(id)
      }
    }
    return true
  }

  getRenderSnapshot(cameraX, cameraZ) {
    const items = this.getActivePois(cameraX, cameraZ).map((poi) => Object.freeze({
      id: poi.id,
      type: poi.type,
      regionId: poi.regionId,
      x: poi.x,
      z: poi.z,
      chunkX: poi.chunkX,
      chunkZ: poi.chunkZ,
      interactionRadius: poi.interactionRadius,
      state: this.consumed.has(poi.id) ? 'consumed' : 'available',
    }))
    return Object.freeze({
      version: WORLD_INTERACTIONS_VERSION,
      stageId: this.stageId,
      items: Object.freeze(items),
    })
  }
}
