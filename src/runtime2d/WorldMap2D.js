export const MAP_CHUNK_SIZE = 28
export const MAP_CHUNK_RADIUS_X = 2
export const MAP_CHUNK_RADIUS_Z = 4
export const MAP_GROUND_VARIANTS = 12
export const MAX_ACTIVE_MAP_CHUNKS = (MAP_CHUNK_RADIUS_X * 2 + 1) * (MAP_CHUNK_RADIUS_Z * 2 + 1)
export const MAX_ACTIVE_MAP_PROPS = 96

const PROP_HEIGHTS = Object.freeze([145, 196, 176, 154, 170, 112, 128, 136])
const DEFAULT_MAP_SEED = 0x51f15e

export const MAP_REGION_TYPES = Object.freeze({
  spawn_grove: Object.freeze({ terrainRole: 'sanctuary-plaza', densityBand: 'authored', propVocabulary: [0, 1, 3, 4, 6] }),
  jade_path: Object.freeze({ terrainRole: 'weathered-jade-path', densityBand: 'low', propVocabulary: [0, 2, 4, 6] }),
  jade_grove: Object.freeze({ terrainRole: 'moss-grove', densityBand: 'medium', propVocabulary: [0, 1, 5, 7] }),
  lantern_shrine: Object.freeze({ terrainRole: 'lantern-shrine', densityBand: 'landmark', propVocabulary: [0, 3, 4, 7] }),
  mist_marsh: Object.freeze({ terrainRole: 'mist-marsh', densityBand: 'medium', propVocabulary: [0, 1, 5] }),
  void_rim: Object.freeze({ terrainRole: 'void-rim', densityBand: 'medium', propVocabulary: [2, 4, 6, 7] }),
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

function propAt(chunkX, chunkZ, frame, localX, localZ, scale = 1, landmark = false) {
  return {
    x: chunkX * MAP_CHUNK_SIZE + localX,
    z: chunkZ * MAP_CHUNK_SIZE + localZ,
    frame,
    height: PROP_HEIGHTS[frame] * scale,
    landmark,
  }
}

function landmarkProps(chunkX, chunkZ, root) {
  const center = MAP_CHUNK_SIZE * 0.5
  const type = (root >>> 8) % 4
  const jitter = unitFloat(hashMapCell(chunkX, chunkZ, root ^ 0x41c64e6d)) * 1.8 - 0.9

  // Landmark silhouettes follow authored arrangements instead of random scatter.
  // A player can recognise a shrine, ruined gate or grove when returning through
  // the streamed world, which is what makes a large survivor map feel explored.
  if (type === 0) {
    return [
      propAt(chunkX, chunkZ, 3, center, center + 1.2, 1.08, true),
      propAt(chunkX, chunkZ, 0, center - 5.6, center - 2.6, 0.92, true),
      propAt(chunkX, chunkZ, 0, center + 5.6, center - 2.6, 0.92, true),
      propAt(chunkX, chunkZ, 7, center + jitter, center + 5.2, 0.92, true),
    ]
  }
  if (type === 1) {
    return [
      propAt(chunkX, chunkZ, 6, center - 4.2, center, 1.04, true),
      propAt(chunkX, chunkZ, 6, center + 4.2, center, 1.04, true),
      propAt(chunkX, chunkZ, 2, center, center - 2.8, 1.08, true),
      propAt(chunkX, chunkZ, 4, center, center + 4.6, 0.96, true),
    ]
  }
  if (type === 2) {
    return [
      propAt(chunkX, chunkZ, 1, center - 4.8, center - 1.4, 1.08, true),
      propAt(chunkX, chunkZ, 1, center + 3.6, center + 2.2, 0.96, true),
      propAt(chunkX, chunkZ, 5, center + 0.8, center - 4.2, 1.02, true),
      propAt(chunkX, chunkZ, 0, center - 1.4, center + 5.3, 0.86, true),
    ]
  }
  return [
    propAt(chunkX, chunkZ, 7, center, center, 1.12, true),
    propAt(chunkX, chunkZ, 4, center - 5.2, center + 1.4, 0.98, true),
    propAt(chunkX, chunkZ, 2, center + 5.1, center + 0.6, 0.94, true),
    propAt(chunkX, chunkZ, 0, center - 3.8, center - 4.5, 0.82, true),
    propAt(chunkX, chunkZ, 0, center + 3.8, center - 4.5, 0.82, true),
  ]
}

function openingPlazaProps(chunkX, chunkZ) {
  const authored = {
    '-1:-1': [
      { frame: 4, x: -15, z: -10, scale: 1.02 },
    ],
    '0:-1': [
      { frame: 3, x: 12, z: -14, scale: 0.88 },
    ],
    '-1:0': [
      { frame: 1, x: -12, z: 13, scale: 1.05 },
      { frame: 0, x: -18, z: 18, scale: 0.86 },
    ],
    '0:0': [
      { frame: 6, x: 14, z: 11, scale: 0.96 },
    ],
  }[`${chunkX}:${chunkZ}`]
  if (!authored) return null
  return authored.map(({ frame, x, z, scale }) => propAt(
    chunkX,
    chunkZ,
    frame,
    x - chunkX * MAP_CHUNK_SIZE,
    z - chunkZ * MAP_CHUNK_SIZE,
    scale,
    true,
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
  for (let i = 0; i < count; i++) {
    const hx = hashMapCell(chunkX * 7 + i * 17, chunkZ * 11 - i * 5, seed ^ 0x92d68ca2)
    const hz = hashMapCell(chunkX * 13 - i * 3, chunkZ * 5 + i * 19, seed ^ 0x68bc21eb)
    const margin = 5
    const span = MAP_CHUNK_SIZE - margin * 2
    const localX = margin + unitFloat(hx) * span
    const localZ = margin + unitFloat(hz) * span
    const vocabulary = region.propVocabulary ?? MAP_REGION_TYPES.jade_grove.propVocabulary
    const frame = vocabulary[hashMapCell(chunkX, chunkZ, seed + i + 1) % vocabulary.length]
    props.push({
      x: chunkX * MAP_CHUNK_SIZE + localX,
      z: chunkZ * MAP_CHUNK_SIZE + localZ,
      frame,
      height: PROP_HEIGHTS[frame] * (0.92 + unitFloat(hx ^ hz) * 0.16),
      landmark: false,
      regionId: region.id,
    })
  }
  return props
}
