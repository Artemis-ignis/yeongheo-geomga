export const MAP_CHUNK_SIZE = 28
export const MAP_CHUNK_RADIUS_X = 2
export const MAP_CHUNK_RADIUS_Z = 4
export const MAP_GROUND_VARIANTS = 12
export const MAX_ACTIVE_MAP_CHUNKS = (MAP_CHUNK_RADIUS_X * 2 + 1) * (MAP_CHUNK_RADIUS_Z * 2 + 1)
// The streamed window can contain more than the old 96-slot pool. Keep the
// capacity explicit in the map contract so presentation cannot silently drop
// the tail of a chunk when a seed produces several landmarks at once.
// The supported seed sweep currently peaks at 132 props after the authored
// opening is included. 144 leaves a deterministic safety margin for future
// landmark variants while still keeping the pool bounded.
export const RECOMMENDED_ACTIVE_MAP_PROP_CAPACITY = 144
export const MAX_ACTIVE_MAP_PROPS = RECOMMENDED_ACTIVE_MAP_PROP_CAPACITY
export const SUPPORTED_MAP_SEED_MIN = 0
export const SUPPORTED_MAP_SEED_MAX = 9999

// The opening route is a world-space lane, not a screen-space decoration. A
// 10-unit minimum is reserved through the centre and a small additional
// margin keeps prop silhouettes and their contact footprints out of it.
export const OPENING_CORRIDOR_HALF_WIDTH = 5
export const OPENING_CORRIDOR_CLEARANCE = 1.5
export const OPENING_CORRIDOR_MIN_WIDTH = OPENING_CORRIDOR_HALF_WIDTH * 2
export const OPENING_MIN_PROP_SPACING = 6

// At the initial camera frame (the same world-space window used by the
// presentation at 1280x720) all authored opening props must be readable. The
// bounds are intentionally tighter than the whole streamed map so this is a
// content contract rather than a culling implementation detail.
export const OPENING_VIEWPORT_WORLD_BOUNDS = Object.freeze({
  minX: -24,
  maxX: 24,
  minZ: -24,
  maxZ: 22,
})

const PROP_HEIGHTS = Object.freeze([145, 196, 176, 154, 170, 112, 128, 136])
const DEFAULT_MAP_SEED = 0x51f15e

export const MAP_REGION_TYPES = Object.freeze({
  spawn_grove: Object.freeze({ terrainRole: 'sanctuary-plaza', densityBand: 'authored', propVocabulary: [0, 1, 3, 4, 6] }),
  jade_path: Object.freeze({ terrainRole: 'weathered-jade-path', densityBand: 'low', propVocabulary: [1, 5] }),
  jade_grove: Object.freeze({ terrainRole: 'moss-grove', densityBand: 'medium', propVocabulary: [1, 5, 0] }),
  lantern_shrine: Object.freeze({ terrainRole: 'lantern-shrine', densityBand: 'landmark', propVocabulary: [0, 3, 6, 7] }),
  mist_marsh: Object.freeze({ terrainRole: 'mist-marsh', densityBand: 'medium', propVocabulary: [1, 5] }),
  void_rim: Object.freeze({ terrainRole: 'void-rim', densityBand: 'medium', propVocabulary: [2, 3, 6] }),
})

/** Deterministic integer hash so streamed chunks never change when revisited. */
export function hashMapCell(x, z, seed = DEFAULT_MAP_SEED) {
  let h = (Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(z | 0, 0x5f356495) ^ seed) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

function unitFloat(hash) {
  return (hash >>> 0) / 4294967296
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

/** Low-frequency deterministic field shared by terrain, props and future POIs. */
export function mapRegionNoise2D(chunkX, chunkZ, seed = DEFAULT_MAP_SEED) {
  const scale = 3.25
  const x = (chunkX + 0.5) / scale
  const z = (chunkZ + 0.5) / scale
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const tx = smoothstep(x - x0)
  const tz = smoothstep(z - z0)
  const sample = (sx, sz) => unitFloat(hashMapCell(sx, sz, seed ^ 0x735a2d91))
  return lerp(
    lerp(sample(x0, z0), sample(x0 + 1, z0), tx),
    lerp(sample(x0, z0 + 1), sample(x0 + 1, z0 + 1), tx),
    tz,
  )
}

/**
 * Semantic region contract inspired by WorldClaw's shared layout map. Region
 * weights come from a continuous field, so neighbouring chunks transition
 * gradually; the primary label controls authored prop vocabulary while the
 * full weight set remains available to presentation and POI systems.
 */
export function mapRegionForChunk(chunkX, chunkZ, seed = DEFAULT_MAP_SEED, stageId = 'jade') {
  if ((chunkX === -1 || chunkX === 0) && (chunkZ === -1 || chunkZ === 0)) {
    return {
      id: 'spawn_grove', secondaryId: 'jade_path', mix: 0, weights: { spawn_grove: 1 },
      ...MAP_REGION_TYPES.spawn_grove,
    }
  }

  const stageSalt = stageId === 'ember' ? 0xe6b04a11 : stageId === 'frost' ? 0xf2057a31 : 0
  const regionSeed = seed ^ stageSalt
  const noise = mapRegionNoise2D(chunkX, chunkZ, regionSeed)
  const root = hashMapCell(chunkX, chunkZ, regionSeed ^ 0x42d4a7c1)
  const pathCenter = Math.sin(chunkZ * 0.38 + (regionSeed & 255) * 0.013) * 1.65
  const pathWeight = Math.max(0, 1 - Math.abs(chunkX - pathCenter) / 1.35)
  const shrineWeight = root % 23 === 0 ? 1 : 0
  const raw = {
    jade_path: pathWeight * 1.18,
    jade_grove: Math.max(0, 1 - Math.abs(noise - 0.52) / 0.34),
    lantern_shrine: shrineWeight,
    mist_marsh: Math.max(0, 1 - Math.abs(noise - 0.2) / 0.28),
    void_rim: Math.max(0, 1 - Math.abs(noise - 0.84) / 0.3),
  }
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1
  const weights = Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, value / total]))
  const ranked = Object.entries(weights).sort((a, b) => b[1] - a[1])
  const id = ranked[0]?.[0] ?? 'jade_grove'
  const secondaryId = ranked[1]?.[0] ?? id
  const leadingTotal = (ranked[0]?.[1] ?? 1) + (ranked[1]?.[1] ?? 0)
  const mix = leadingTotal > 0 ? (ranked[1]?.[1] ?? 0) / leadingTotal : 0
  return { id, secondaryId, mix, weights, ...MAP_REGION_TYPES[id] }
}

export function mapChunkAt(x, z) {
  return {
    x: Math.floor(x / MAP_CHUNK_SIZE),
    z: Math.floor(z / MAP_CHUNK_SIZE),
  }
}

export function mapChunkKey(x, z) {
  const chunk = mapChunkAt(x, z)
  return `${chunk.x}:${chunk.z}`
}

export function activeMapChunks(cameraX, cameraZ, seed = DEFAULT_MAP_SEED, stageId = 'jade') {
  const center = mapChunkAt(cameraX, cameraZ)
  const chunks = []
  for (let z = center.z - MAP_CHUNK_RADIUS_Z; z <= center.z + MAP_CHUNK_RADIUS_Z; z++) {
    for (let x = center.x - MAP_CHUNK_RADIUS_X; x <= center.x + MAP_CHUNK_RADIUS_X; x++) {
      const region = mapRegionForChunk(x, z, seed, stageId)
      const variantSalt = Object.keys(MAP_REGION_TYPES).indexOf(region.id) * 3
      chunks.push({
        x, z, key: `${x}:${z}`,
        variant: (hashMapCell(x, z, seed) + variantSalt) % MAP_GROUND_VARIANTS,
        regionId: region.id,
        secondaryRegionId: region.secondaryId,
        regionMix: region.mix,
        terrainRole: region.terrainRole,
        densityBand: region.densityBand,
      })
    }
  }
  return chunks
}

function propAt(
  chunkX,
  chunkZ,
  frame,
  localX,
  localZ,
  scale = 1,
  landmark = false,
  rotation = 0,
  cluster = 'edge',
) {
  return {
    x: chunkX * MAP_CHUNK_SIZE + localX,
    z: chunkZ * MAP_CHUNK_SIZE + localZ,
    frame,
    scale,
    // Environment plates are upright billboards. The authored tilt value is
    // kept as layout metadata for audit tooling, but never becomes a screen
    // plane rotation that could break the shared foot baseline.
    rotation: 0,
    cluster,
    height: PROP_HEIGHTS[frame] * scale,
    landmark,
  }
}

function landmarkProps(chunkX, chunkZ, root) {
  const center = MAP_CHUNK_SIZE * 0.5
  const type = (root >>> 8) % 4
  const jitter = unitFloat(hashMapCell(chunkX, chunkZ, root ^ 0x41c64e6d)) * 1.8 - 0.9
  const tilt = (index) => (
    unitFloat(hashMapCell(chunkX * 5 + index, chunkZ * 7 - index, root ^ 0x3c6ef372)) - 0.5
  ) * 0.28

  // Landmark silhouettes follow authored arrangements instead of random scatter.
  // A player can recognise a shrine, ruined gate or grove when returning through
  // the streamed world, which is what makes a large survivor map feel explored.
  if (type === 0) {
    return [
      propAt(chunkX, chunkZ, 3, center, center + 1.2, 1.08, true, tilt(0), 'landmark'),
      propAt(chunkX, chunkZ, 0, center - 5.6, center - 2.6, 0.92, true, tilt(1), 'landmark'),
      propAt(chunkX, chunkZ, 0, center + 5.6, center - 2.6, 0.92, true, tilt(2), 'landmark'),
      propAt(chunkX, chunkZ, 7, center + jitter, center + 5.2, 0.92, true, tilt(3), 'landmark'),
    ]
  }
  if (type === 1) {
    return [
      propAt(chunkX, chunkZ, 6, center - 4.2, center, 1.04, true, tilt(0), 'landmark'),
      propAt(chunkX, chunkZ, 6, center + 4.2, center, 1.04, true, tilt(1), 'landmark'),
      propAt(chunkX, chunkZ, 2, center, center - 2.8, 1.08, true, tilt(2), 'landmark'),
      propAt(chunkX, chunkZ, 4, center, center + 4.6, 0.96, true, tilt(3), 'landmark'),
    ]
  }
  if (type === 2) {
    return [
      propAt(chunkX, chunkZ, 1, center - 4.8, center - 1.4, 1.08, true, tilt(0), 'landmark'),
      propAt(chunkX, chunkZ, 1, center + 3.6, center + 2.2, 0.96, true, tilt(1), 'landmark'),
      propAt(chunkX, chunkZ, 5, center + 0.8, center - 4.2, 1.02, true, tilt(2), 'landmark'),
      propAt(chunkX, chunkZ, 0, center - 1.4, center + 5.3, 0.86, true, tilt(3), 'landmark'),
    ]
  }
  return [
    propAt(chunkX, chunkZ, 7, center, center, 1.12, true, tilt(0), 'landmark'),
    propAt(chunkX, chunkZ, 4, center - 5.2, center + 1.4, 0.98, true, tilt(1), 'landmark'),
    propAt(chunkX, chunkZ, 2, center + 5.1, center + 0.6, 0.94, true, tilt(2), 'landmark'),
    propAt(chunkX, chunkZ, 0, center - 3.8, center - 4.5, 0.82, true, tilt(3), 'landmark'),
    propAt(chunkX, chunkZ, 0, center + 3.8, center - 4.5, 0.82, true, tilt(4), 'landmark'),
  ]
}

function openingPlazaProps(chunkX, chunkZ) {
  // One authored sanctuary threshold, split only because it crosses the
  // streamed chunk boundary. This is a composition of four asymmetric edge
  // clusters rather than a ring or a set of evenly spaced stickers:
  // `far-threshold` establishes the approach, `left-ruin` and `right-shrine`
  // frame the route, and `near-reeds` gives the player a quiet foreground
  // edge. The central world-space lane remains empty for movement and enemy
  // ingress; all props carry authored rotation and scale variation so a
  // repeated atlas frame does not form a recognisable grid.
  // Frames 4 (banner) and 3 (guardian) are the two landmark anchors.
  const authored = {
    '-1:-1': [
      { frame: 4, x: -21, z: -21, scale: 1.12, rotation: -0.11, landmark: true, cluster: 'far-threshold' },
      { frame: 0, x: -14, z: -17, scale: 0.78, rotation: 0.18, landmark: false, cluster: 'far-threshold' },
      { frame: 6, x: -22, z: -6, scale: 1.02, rotation: -0.08, landmark: false, cluster: 'left-ruin' },
      { frame: 7, x: -15, z: -8, scale: 0.92, rotation: 0.14, landmark: false, cluster: 'left-ruin' },
      { frame: 5, x: -19, z: 0, scale: 0.76, rotation: -0.22, landmark: false, cluster: 'left-ruin' },
    ],
    '0:-1': [
      { frame: 2, x: -8.5, z: -20, scale: 1.06, rotation: 0.09, landmark: false, cluster: 'far-threshold' },
      { frame: 1, x: -19, z: -13, scale: 0.86, rotation: -0.17, landmark: false, cluster: 'far-threshold' },
      { frame: 3, x: 16, z: -8, scale: 0.88, rotation: 0.13, landmark: true, cluster: 'right-shrine' },
      { frame: 0, x: 9, z: -1, scale: 0.94, rotation: -0.15, landmark: false, cluster: 'right-shrine' },
    ],
    '-1:0': [
      { frame: 3, x: -23, z: 7, scale: 0.82, rotation: -0.1, landmark: false, cluster: 'left-ruin' },
      { frame: 2, x: -14, z: 7, scale: 0.74, rotation: -0.18, landmark: false, cluster: 'left-ruin' },
      { frame: 5, x: 15, z: 6, scale: 0.8, rotation: -0.2, landmark: false, cluster: 'right-shrine' },
      { frame: 6, x: 22, z: 7, scale: 0.96, rotation: 0.12, landmark: false, cluster: 'right-shrine' },
    ],
    '0:0': [
      { frame: 1, x: 10, z: 16, scale: 0.92, rotation: 0.2, landmark: false, cluster: 'near-reeds' },
      { frame: 7, x: 18, z: 19, scale: 1.02, rotation: -0.14, landmark: false, cluster: 'near-reeds' },
      { frame: 0, x: 24, z: 16, scale: 0.82, rotation: 0.1, landmark: false, cluster: 'right-shrine' },
    ],
  }[`${chunkX}:${chunkZ}`]
  if (!authored) return null
  return authored.map(({ frame, x, z, scale, rotation, landmark, cluster }) => propAt(
    chunkX,
    chunkZ,
    frame,
    x - chunkX * MAP_CHUNK_SIZE,
    z - chunkZ * MAP_CHUNK_SIZE,
    scale,
    landmark,
    rotation,
    cluster,
  ))
}

/**
 * Sparse world decoration for a chunk. Props are deliberately kept away from
 * chunk edges and the origin spawn plaza; the world remains navigable instead
 * of turning into a wall of decorative cut-outs.
 */
export function propsForMapChunk(chunkX, chunkZ, seed = DEFAULT_MAP_SEED, stageId = 'jade', suppliedRegion = null) {
  const region = suppliedRegion ?? mapRegionForChunk(chunkX, chunkZ, seed, stageId)
  const openingPlaza = openingPlazaProps(chunkX, chunkZ)
  if (openingPlaza) return openingPlaza.map((prop) => ({ ...prop, regionId: 'spawn_grove' }))
  const root = hashMapCell(chunkX, chunkZ, seed)
  const landmark = region.id === 'lantern_shrine' || root % 19 === 0
  if (landmark) return landmarkProps(chunkX, chunkZ, root).map((prop) => ({ ...prop, regionId: region.id }))
  const count = region.densityBand === 'medium' ? 2 + (root % 5 === 0 ? 1 : 0) : 1 + (root % 3 === 0 ? 1 : 0)
  const props = []
  const margin = 5
  const span = MAP_CHUNK_SIZE - margin * 2
  const anchorXHash = hashMapCell(chunkX * 7 + 3, chunkZ * 11 - 5, seed ^ 0x92d68ca2)
  const anchorZHash = hashMapCell(chunkX * 13 - 3, chunkZ * 5 + 7, seed ^ 0x68bc21eb)
  const anchorX = margin + unitFloat(anchorXHash) * span
  const anchorZ = margin + unitFloat(anchorZHash) * span
  for (let i = 0; i < count; i++) {
    const hx = hashMapCell(chunkX * 7 + i * 17, chunkZ * 11 - i * 5, seed ^ 0x92d68ca2)
    const hz = hashMapCell(chunkX * 13 - i * 3, chunkZ * 5 + i * 19, seed ^ 0x68bc21eb)
    const angle = unitFloat(hx) * Math.PI * 2
    const distance = i === 0 ? 0 : 2.8 + unitFloat(hz) * 3.8
    const localX = Math.max(margin, Math.min(MAP_CHUNK_SIZE - margin, anchorX + Math.cos(angle) * distance))
    const localZ = Math.max(margin, Math.min(MAP_CHUNK_SIZE - margin, anchorZ + Math.sin(angle) * distance))
    const vocabulary = region.propVocabulary ?? MAP_REGION_TYPES.jade_grove.propVocabulary
    const frame = vocabulary[hashMapCell(chunkX, chunkZ, seed + i + 1) % vocabulary.length]
    const scale = 0.92 + unitFloat(hx ^ hz) * 0.16
    props.push({
      x: chunkX * MAP_CHUNK_SIZE + localX,
      z: chunkZ * MAP_CHUNK_SIZE + localZ,
      frame,
      scale,
      rotation: 0,
      cluster: landmark ? 'landmark' : region.id,
      height: PROP_HEIGHTS[frame] * scale,
      landmark: false,
      regionId: region.id,
    })
  }
  return props
}

/**
 * Count every prop that the presentation must be able to retain for one
 * streamed window. This deliberately shares the exact chunk and prop
 * generators used by production, making capacity checks a pure deterministic
 * map invariant rather than a renderer-side estimate.
 */
export function activeMapPropCount(cameraX = 0, cameraZ = 0, seed = DEFAULT_MAP_SEED, stageId = 'jade') {
  return activeMapChunks(cameraX, cameraZ, seed, stageId)
    .reduce((count, chunk) => count + propsForMapChunk(chunk.x, chunk.z, seed, stageId).length, 0)
}

/**
 * Scan a supported seed range and report the worst active-window count. The
 * result is pure and intentionally includes the seed that produced the max so
 * a failing visual/runtime build can be reproduced exactly.
 */
export function activeMapPropCapacityInvariant({
  cameraX = 0,
  cameraZ = 0,
  stageId = 'jade',
  seedStart = SUPPORTED_MAP_SEED_MIN,
  seedEnd = SUPPORTED_MAP_SEED_MAX,
  capacity = MAX_ACTIVE_MAP_PROPS,
} = {}) {
  const start = Math.max(0, Math.min(0xffffffff, Math.trunc(seedStart)))
  const end = Math.max(start, Math.min(0xffffffff, Math.trunc(seedEnd)))
  let maxCount = 0
  let maxSeed = start
  for (let seed = start; seed <= end; seed++) {
    const count = activeMapPropCount(cameraX, cameraZ, seed, stageId)
    if (count > maxCount) {
      maxCount = count
      maxSeed = seed
    }
    // Avoid uint32 wraparound if a caller asks for the final representable
    // seed. Supported production ranges never reach this branch.
    if (seed === 0xffffffff) break
  }
  return Object.freeze({
    cameraX,
    cameraZ,
    stageId,
    seedStart: start,
    seedEnd: end,
    maxCount,
    maxSeed,
    capacity,
    withinCapacity: maxCount <= capacity,
  })
}
