import {
  MAP_CHUNK_SIZE,
  activeMapChunks,
  hashMapCell,
  mapRegionForChunk,
  mapChunkAt,
} from './WorldMap2D.js'
import {
  getJourneyChapterForStage,
  journeyBeat,
  journeyLayoutFor,
  journeyRewardRoll,
} from '../data/journey.js'

export const WORLD_INTERACTIONS_VERSION = 5
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
const INVESTIGATION_CLUE_RADIUS = 1.75

const GUIDANCE_POI_CHUNKS = Object.freeze([
  Object.freeze({ x: 1, z: 0 }),
  Object.freeze({ x: 0, z: 1 }),
  Object.freeze({ x: -2, z: 0 }),
  Object.freeze({ x: 0, z: -2 }),
])

export const EXPEDITION_ROUTE_TYPES = Object.freeze([
  POI_TYPE.altar,
  POI_TYPE.treasure,
  POI_TYPE.eliteSeal,
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
    nodeId: typeof poi.nodeId === 'string' ? poi.nodeId : null,
    type: poi.type,
    regionId: poi.regionId,
    x: poi.x,
    z: poi.z,
    chunkX: poi.chunkX,
    chunkZ: poi.chunkZ,
    interactionRadius: poi.interactionRadius,
    routeIndex: Number.isInteger(poi.routeIndex) ? poi.routeIndex : null,
    beatId: typeof poi.beatId === 'string' ? poi.beatId : null,
    required: poi.required === true,
    riskTier: Math.max(0, Math.trunc(poi.riskTier ?? 0)),
    requires: Object.freeze([...(poi.requires ?? [])]),
    next: Object.freeze([...(poi.next ?? [])]),
    title: poi.title ?? null,
    approach: poi.approach ?? null,
    active: poi.active ?? null,
    resolved: poi.resolved ?? null,
    reward: poi.reward ?? null,
    guardians: Object.freeze([...(poi.guardians ?? [])]),
  })
}

/**
 * Materialise the seed-specific expedition graph as stable streamed POIs.
 * Required beats retain their legacy route-index ids for save compatibility;
 * optional nodes use their authored node id so they remain unique across
 * topology variants.
 */
export function expeditionRoutePois(seed = DEFAULT_INTERACTION_SEED, stageId = 'jade', chapter = null) {
  seed >>>= 0
  stageId = normalizeStageId(stageId)
  chapter ??= getJourneyChapterForStage(stageId)
  const layout = journeyLayoutFor(seed, chapter)
  const stageSeed = (seed ^ hashText(stageId)) >>> 0
  return Object.freeze(layout.nodes.map((node) => {
    const authored = node.position
    const chunk = authored ? mapChunkAt(authored.x, authored.z) : node.chunk
    const margin = 8
    const span = MAP_CHUNK_SIZE - margin * 2
    const routeIndex = node.required ? chapter.route.findIndex((beat) => beat.id === node.beatId) : null
    const xHash = hashMapCell(chunk.x * 13 + (routeIndex ?? 0), chunk.z * 7, stageSeed ^ 0x6c8e9cf5)
    const zHash = hashMapCell(chunk.x * 5, chunk.z * 17 + (routeIndex ?? 0), stageSeed ^ 0x9e3779b9)
    const x = authored?.x ?? chunk.x * MAP_CHUNK_SIZE + margin + unitFloat(xHash) * span
    const z = authored?.z ?? chunk.z * MAP_CHUNK_SIZE + margin + unitFloat(zHash) * span
    const type = node.type ?? EXPEDITION_ROUTE_TYPES[routeIndex ?? 0]
    return freezePoi({
      id: `${poiPrefix(stageId, seed)}route:${node.required ? routeIndex : node.id}`,
      nodeId: node.id,
      type,
      regionId: mapRegionForChunk(chunk.x, chunk.z, seed, stageId).id,
      x,
      z,
      chunkX: chunk.x,
      chunkZ: chunk.z,
      interactionRadius: POI_RADIUS[type],
      routeIndex,
      beatId: node.beatId,
      required: node.required,
      riskTier: node.riskTier,
      requires: node.requires,
      next: node.next,
      title: node.title,
      approach: node.approach,
      active: node.active,
      resolved: node.resolved,
      reward: node.reward,
      guardians: node.guardians,
    })
  }))
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

function rewardForExpeditionPoi(poi, seed, beat = null) {
  const authored = beat?.reward ?? poi?.reward
  if (!authored) return rewardForPoi(poi, seed)
  const root = hashText(`${poi.id}:${seed >>> 0}:expedition-reward`)
  if (authored.options?.length) {
    return Object.freeze({
      ...authored,
      title: authored.title,
      description: authored.description,
      options: authored.options,
      spiritStones: journeyRewardRoll(authored.spiritStones, unitFloat(root)),
      experience: journeyRewardRoll(authored.experience, unitFloat(root >>> 9)),
    })
  }
  const reward = { ...authored }
  if (Array.isArray(authored.spiritStones)) {
    reward.spiritStones = journeyRewardRoll(authored.spiritStones, unitFloat(root))
  }
  if (Array.isArray(authored.experience)) {
    reward.experience = journeyRewardRoll(authored.experience, unitFloat(root >>> 9))
  }
  return Object.freeze(reward)
}

function distanceSq(aX, aZ, bX, bZ) {
  const dx = aX - bX
  const dz = aZ - bZ
  return dx * dx + dz * dz
}

/**
 * Turn an authored investigation into physical, separately readable traces.
 * These are not generic rewards: each clue carries a conclusion and only the
 * complete set unlocks the chapter landmark where the player draws a verdict.
 */
export function investigationCluePois(poi, beat) {
  if (!poi || beat?.encounter?.kind !== 'investigation') return Object.freeze([])
  const clues = beat.encounter.clues ?? []
  return Object.freeze(clues.map((clue, index) => Object.freeze({
    id: `${poi.id}:clue:${clue.id ?? index}`,
    type: clue.type === 'false_trace' ? 'false_trace' : 'evidence',
    parentPoiId: poi.id,
    clueId: clue.id ?? String(index),
    label: clue.label ?? '이름 없는 흔적',
    observation: clue.observation ?? '',
    regionId: poi.regionId,
    x: poi.x + (Number(clue.offset?.x) || 0),
    z: poi.z + (Number(clue.offset?.z) || 0),
    chunkX: poi.chunkX,
    chunkZ: poi.chunkZ,
    interactionRadius: INVESTIGATION_CLUE_RADIUS,
    routeIndex: poi.routeIndex,
    beatId: poi.beatId,
  })))
}

/**
 * Stateful owner for one-run POI consumption. All public save/snapshot data is
 * JSON-safe and contains no Pixi objects, callbacks, Sets or typed-array views.
 */
export class WorldInteractions2D {
  constructor({ seed = DEFAULT_INTERACTION_SEED, stageId = 'jade', mode = 'survival', chapter = null, saveState = null } = {}) {
    this.seed = seed >>> 0
    this.stageId = normalizeStageId(stageId)
    this.mode = mode === 'expedition' ? 'expedition' : 'survival'
    this.chapter = chapter ?? getJourneyChapterForStage(this.stageId)
    this.route = this.mode === 'expedition' ? expeditionRoutePois(this.seed, this.stageId, this.chapter) : null
    this.layout = this.mode === 'expedition' ? journeyLayoutFor(this.seed, this.chapter) : null
    this.requiredIds = new Set(this.layout?.requiredIds ?? [])
    this.consumed = new Set()
    this.requiredCompleted = new Set()
    this.optionalCompleted = new Set()
    this.guardians = new Map()
    this.investigations = new Map()
    this.pendingEvents = []
    if (saveState) this.restore(saveState)
  }

  isConsumed(id) {
    const poi = typeof id === 'string' ? this._routePoiById(id) : null
    return this.consumed.has(poi?.id ?? id)
  }

  _routePoiById(id) {
    return this.route?.find((poi) => poi.id === id || poi.nodeId === id) ?? null
  }

  isRequiredPoi(poiOrId) {
    const poi = typeof poiOrId === 'string' ? this._routePoiById(poiOrId) : poiOrId
    return Boolean(poi?.required === true || (poi?.nodeId && this.requiredIds.has(poi.nodeId)))
  }

  _prerequisitesComplete(poi) {
    if (!poi?.requires?.length) return true
    return poi.requires.every((requiredId) => {
      const required = this._routePoiById(requiredId)
      return Boolean(required && this.consumed.has(required.id))
    })
  }

  availableRoutePois() {
    if (!this.route) return []
    return this.route.filter((poi) => !this.consumed.has(poi.id) && this._prerequisitesComplete(poi))
  }

  currentRequiredPoi() {
    return this.route?.find((poi) => poi.required && !this.consumed.has(poi.id)) ?? null
  }

  requiredProgressFor() {
    const total = this.requiredIds.size
    const completed = this.route?.filter((poi) => poi.required && this.consumed.has(poi.id)).length ?? 0
    return Object.freeze({ completed, total, complete: total > 0 && completed >= total })
  }

  optionalProgressFor() {
    const total = this.route?.filter((poi) => !poi.required).length ?? 0
    const completed = this.route?.filter((poi) => !poi.required && this.consumed.has(poi.id)).length ?? 0
    return Object.freeze({ completed, total, complete: total > 0 && completed >= total })
  }

  getActivePois(cameraX, cameraZ) {
    if (this.route) {
      const active = new Set(activeMapChunks(cameraX, cameraZ, this.seed, this.stageId).map((chunk) => `${chunk.x}:${chunk.z}`))
      return this.route.filter((poi) => active.has(`${poi.chunkX}:${poi.chunkZ}`))
    }
    return activeWorldPois(cameraX, cameraZ, this.seed, this.stageId)
  }

  currentRoutePoi() {
    // Compatibility alias for legacy objective/collision callers. New code
    // should use currentRequiredPoi() when it needs the mandatory story node.
    return this.currentRequiredPoi()
  }

  stateForPoi(poiOrId) {
    const id = typeof poiOrId === 'string' ? poiOrId : poiOrId?.id
    if (!id) return 'locked'
    const clue = this._investigationClueById(id)
    if (clue) return this.investigations.get(clue.parentPoiId)?.has(clue.clueId) ? 'consumed' : 'available'
    const poi = this._routePoiById(id) ?? poiOrId
    const resolvedId = poi?.id ?? id
    if (this.consumed.has(id) || this.consumed.has(resolvedId)) return 'consumed'
    if (!this.route) return 'available'
    if (!poi || !this._prerequisitesComplete(poi)) return 'locked'
    const beat = journeyBeat(this.chapter, poi.routeIndex)
    if (beat?.encounter?.kind === 'investigation') {
      const progress = this.investigationProgressFor(poi)
      if (progress.complete) return 'cleared'
      return progress.found > 0 ? 'active' : 'dormant'
    }
    return this.guardians.get(resolvedId) ?? 'dormant'
  }

  _investigationClueById(id) {
    if (!this.route || typeof id !== 'string') return null
    for (const poi of this.route) {
      const beat = journeyBeat(this.chapter, poi.routeIndex)
      for (const clue of investigationCluePois(poi, beat)) if (clue.id === id) return clue
    }
    return null
  }

  investigationProgressFor(poiOrId) {
    const poi = typeof poiOrId === 'string'
      ? this._routePoiById(poiOrId)
      : poiOrId
    const beat = poi ? journeyBeat(this.chapter, poi.routeIndex) : null
    const clues = investigationCluePois(poi, beat)
    const found = this.investigations.get(poi?.id)?.size ?? 0
    return Object.freeze({ found: Math.min(found, clues.length), total: clues.length, complete: clues.length > 0 && found >= clues.length })
  }

  /** Closest unread physical trace, used by the authored case guidance. */
  nearestUnfoundInvestigationClue(poiOrId, playerX, playerZ) {
    if (!Number.isFinite(playerX) || !Number.isFinite(playerZ)) return null
    const poi = typeof poiOrId === 'string'
      ? this._routePoiById(poiOrId)
      : poiOrId
    const beat = poi ? journeyBeat(this.chapter, poi.routeIndex) : null
    const found = this.investigations.get(poi?.id) ?? new Set()
    let nearest = null
    let nearestDistanceSq = Infinity
    for (const clue of investigationCluePois(poi, beat)) {
      if (found.has(clue.clueId)) continue
      const d2 = distanceSq(playerX, playerZ, clue.x, clue.z)
      if (d2 >= nearestDistanceSq) continue
      nearest = clue
      nearestDistanceSq = d2
    }
    return nearest
  }

  markGuardianCleared(poiId) {
    const poi = this._routePoiById(poiId)
    const resolvedId = poi?.id ?? poiId
    if (!this.route || !poi || this.guardians.get(resolvedId) !== 'active') return false
    this.guardians.set(resolvedId, 'cleared')
    return true
  }

  findNearby(playerX, playerZ, extraRadius = 0) {
    if (!Number.isFinite(playerX) || !Number.isFinite(playerZ)) return null
    extraRadius = Number.isFinite(extraRadius) ? Math.max(0, extraRadius) : 0
    const center = mapChunkAt(playerX, playerZ)
    let nearest = null
    let nearestDistanceSq = Infinity

    if (this.route) {
      for (const poi of this.availableRoutePois()) {
        const beat = journeyBeat(this.chapter, poi.routeIndex)
        if (beat?.encounter?.kind === 'investigation') {
          let nearestClue = null
          let nearestClueDistanceSq = Infinity
          const found = this.investigations.get(poi.id) ?? new Set()
          for (const clue of investigationCluePois(poi, beat)) {
            if (found.has(clue.clueId)) continue
            const radius = clue.interactionRadius + extraRadius
            const d2 = distanceSq(playerX, playerZ, clue.x, clue.z)
            if (d2 <= radius * radius && d2 < nearestClueDistanceSq) {
              nearestClue = clue
              nearestClueDistanceSq = d2
            }
          }
          if (nearestClue) return nearestClue
          if (!this.investigationProgressFor(poi).complete) continue
        }
        const radius = poi.interactionRadius + extraRadius
        const d2 = distanceSq(playerX, playerZ, poi.x, poi.z)
        if (d2 <= radius * radius && d2 < nearestDistanceSq) {
          nearest = poi
          nearestDistanceSq = d2
        }
      }
      return nearest
    }

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

    if (poi.parentPoiId && poi.clueId) {
      const found = this.investigations.get(poi.parentPoiId) ?? new Set()
      if (found.has(poi.clueId)) return null
      found.add(poi.clueId)
      this.investigations.set(poi.parentPoiId, found)
      const progress = this.investigationProgressFor(poi.parentPoiId)
      const event = Object.freeze({
        id: `${poi.id}:found`, type: 'investigation_clue_found',
        poiId: poi.id, parentPoiId: poi.parentPoiId, clueId: poi.clueId,
        poiType: poi.type, beatId: poi.beatId, routeIndex: poi.routeIndex,
        label: poi.label, observation: poi.observation,
        found: progress.found, total: progress.total, complete: progress.complete,
        x: poi.x, z: poi.z,
      })
      this.pendingEvents.push(event)
      return event
    }

    if (this.route) {
      let state = this.stateForPoi(poi)
      if (state === 'dormant') {
        const beat = journeyBeat(this.chapter, poi.routeIndex)
        const safeOptional = !poi.required && poi.riskTier <= 0
        if (beat?.encounter?.kind !== 'investigation' && !safeOptional) {
          this.guardians.set(poi.id, 'active')
          const event = Object.freeze({
            id: `${poi.id}:guardian`,
            type: 'poi_guardian_requested',
            poiId: poi.id,
            poiType: poi.type,
            beatId: poi.beatId,
            routeIndex: poi.routeIndex,
            nodeId: poi.nodeId,
            required: poi.required,
            riskTier: poi.riskTier,
            guardianIds: poi.guardians,
            x: poi.x,
            z: poi.z,
          })
          this.pendingEvents.push(event)
          return event
        }
      }
      if (state !== 'cleared' && !(state === 'dormant' && !poi.required && poi.riskTier <= 0)) return null
    }

    // Consume before publishing the event so even a re-entrant caller cannot
    // receive the same reward twice.
    this.consumed.add(poi.id)
    if (this.route && poi.required) this.requiredCompleted.add(poi.id)
    else if (this.route) this.optionalCompleted.add(poi.id)
    const beat = this.route ? journeyBeat(this.chapter, poi.routeIndex) : null
    const reward = this.route ? rewardForExpeditionPoi(poi, this.seed, beat) : rewardForPoi(poi, this.seed)
    const event = Object.freeze({
      id: `${poi.id}:reward`,
      type: 'poi_reward',
      poiId: poi.id,
      poiType: poi.type,
      beatId: poi.beatId,
      routeIndex: poi.routeIndex,
      nodeId: poi.nodeId,
      required: poi.required,
      riskTier: poi.riskTier,
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
      chapterId: this.chapter?.id ?? null,
      topologyId: this.layout?.topologyId ?? null,
      consumed: [...this.consumed].sort(),
      requiredCompleted: [...this.requiredCompleted].sort(),
      optionalCompleted: [...this.optionalCompleted].sort(),
      guardians: Object.fromEntries([...this.guardians].sort(([a], [b]) => a.localeCompare(b))),
      investigations: Object.fromEntries([...this.investigations]
        .filter(([, clues]) => clues.size > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, clues]) => [id, [...clues].sort()])),
    }
  }

  restore(state) {
    this.consumed.clear()
    this.requiredCompleted.clear()
    this.optionalCompleted.clear()
    this.guardians.clear()
    this.investigations.clear()
    this.pendingEvents.length = 0
    if (!state || typeof state !== 'object') return false
    if ((state.seed >>> 0) !== this.seed || normalizeStageId(state.stageId) !== this.stageId) return false
    if (state.chapterId && state.chapterId !== this.chapter?.id) return false
    if (state.topologyId && state.topologyId !== this.layout?.topologyId) return false

    const prefix = poiPrefix(this.stageId, this.seed)
    const routeIds = new Set(this.route?.map((poi) => poi.id) ?? [])
    const applyConsumed = (id) => {
      if (typeof id !== 'string' || !id.startsWith(prefix) || id.length > 128 || (this.route && !routeIds.has(id))) return
      this.consumed.add(id)
      const poi = this._routePoiById(id)
      if (poi?.required) this.requiredCompleted.add(id)
      else if (poi) this.optionalCompleted.add(id)
    }
    if (Array.isArray(state.consumed)) {
      for (const id of state.consumed) applyConsumed(id)
    }
    if (this.route && state.guardians && typeof state.guardians === 'object') {
      for (const [id, status] of Object.entries(state.guardians)) {
        if (routeIds.has(id) && (status === 'active' || status === 'cleared')) this.guardians.set(id, status)
      }
    }
    if (Array.isArray(state.requiredCompleted)) for (const id of state.requiredCompleted) applyConsumed(id)
    if (Array.isArray(state.optionalCompleted)) for (const id of state.optionalCompleted) applyConsumed(id)
    if (this.route && state.investigations && typeof state.investigations === 'object') {
      for (const poi of this.route) {
        const beat = journeyBeat(this.chapter, poi.routeIndex)
        const valid = new Set(investigationCluePois(poi, beat).map((clue) => clue.clueId))
        const restored = Array.isArray(state.investigations[poi.id])
          ? state.investigations[poi.id].filter((clueId) => valid.has(clueId))
          : []
        if (restored.length > 0) this.investigations.set(poi.id, new Set(restored))
      }
    }
    return true
  }

  getRenderSnapshot(cameraX, cameraZ) {
    const expanded = []
    for (const poi of this.getActivePois(cameraX, cameraZ)) {
      const beat = journeyBeat(this.chapter, poi.routeIndex)
      if (this.route && this.currentRequiredPoi()?.id === poi.id && beat?.encounter?.kind === 'investigation') {
        expanded.push(...investigationCluePois(poi, beat))
      }
      expanded.push(poi)
    }
    const items = expanded.map((poi) => Object.freeze({
      id: poi.id,
      type: poi.type,
      regionId: poi.regionId,
      x: poi.x,
      z: poi.z,
      chunkX: poi.chunkX,
      chunkZ: poi.chunkZ,
      interactionRadius: poi.interactionRadius,
      state: this.stateForPoi(poi),
      nodeId: poi.nodeId,
      required: poi.required,
      riskTier: poi.riskTier,
      routeIndex: poi.routeIndex,
      beatId: poi.beatId,
      parentPoiId: poi.parentPoiId ?? null,
      clueId: poi.clueId ?? null,
    }))
    return Object.freeze({
      version: WORLD_INTERACTIONS_VERSION,
      stageId: this.stageId,
      chapterId: this.chapter?.id ?? null,
      topologyId: this.layout?.topologyId ?? null,
      required: this.requiredProgressFor(),
      optional: this.optionalProgressFor(),
      items: Object.freeze(items),
    })
  }
}
