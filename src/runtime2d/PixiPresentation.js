import {
  Application, Assets, Container, Graphics, Particle, ParticleContainer, Rectangle, Sprite, Text, Texture, TilingSprite,
} from 'pixi.js'
import { ENEMIES } from '../data/enemies.js'
import {
  cameraFollowStep2D, projectWorld, depthBucket, directionFor, isOnScreen, SORT_BUCKETS, viewportPresentationScale,
} from './projection.js'
import { SPRITE_MANIFEST } from './spriteManifest.js'
import {
  CONTACT_INTENT_SECONDS_2D, MAX_PROJECTILES_2D, MAX_PICKUPS_2D, MAX_WEAPON_FIELDS_2D,
} from './CombatWorld2D.js'
import { choosePixiBackend, probeWebGLRenderer } from './backend.js'
import { planEffectRenderSamples, planParticlePool2D } from './ParticleBudget2D.js'
import {
  MAP_CHUNK_SIZE, MAP_GROUND_VARIANTS, MAX_ACTIVE_MAP_CHUNKS, MAX_ACTIVE_MAP_PROPS,
  activeMapChunks, hashMapCell, mapChunkKey, propsForMapChunk,
} from './WorldMap2D.js'

const base = import.meta.env?.BASE_URL ?? './'
const ENVIRONMENT_URL = `${base}assets/environment/jade-sanctuary-environment-v2.png`
const STONE_URL = `${base}assets/materials/environment/jade-pavilion-stone-v1.png`
const JADE_GROUND_URL = `${base}assets/materials/environment/jade-sanctuary-ground-material-v2.png`
const JADE_GROUND_FALLBACK_URL = `${base}assets/materials/environment/jade-highland-ground-v1.png`
const _screen = { x: 0, y: 0, unit: 24 }
const _segmentStart = { x: 0, y: 0, unit: 24 }
const _segmentEnd = { x: 0, y: 0, unit: 24 }
const _enemyIntentPresentation = {
  visible: false, preContact: false, remaining: 0, duration: 0.3,
}
const COMBAT_HORIZON_RATIO = 0.19
const TERRAIN_TILE_SIZE = 512
const TERRAIN_ATLAS_PADDING = 2
const TERRAIN_ATLAS_COLUMNS = 4
const TERRAIN_ATLAS_ROWS = Math.ceil(MAP_GROUND_VARIANTS / TERRAIN_ATLAS_COLUMNS)
const TERRAIN_ATLAS_WIDTH = TERRAIN_ATLAS_COLUMNS * (TERRAIN_TILE_SIZE + TERRAIN_ATLAS_PADDING * 2)
const TERRAIN_ATLAS_HEIGHT = TERRAIN_ATLAS_ROWS * (TERRAIN_TILE_SIZE + TERRAIN_ATLAS_PADDING * 2)
const TERRAIN_BYTES_PER_PIXEL = 4
const TERRAIN_ATLAS_BYTES = TERRAIN_ATLAS_WIDTH * TERRAIN_ATLAS_HEIGHT * TERRAIN_BYTES_PER_PIXEL
const JADE_DECAL_EDGE_FEATHER = 88
const JADE_WORLD_PROJECTION_ASPECT = 2.52

/**
 * Runtime-facing limits for the streamed 2D presentation. The atlas is one
 * GPU allocation containing twelve authored 512px terrain variants; the small
 * gutters prevent linear filtering from sampling a neighbouring variant.
 */
export const RUNTIME2D_RENDER_BUDGET = Object.freeze({
  terrainTileSize: TERRAIN_TILE_SIZE,
  terrainVariantCount: MAP_GROUND_VARIANTS,
  terrainAtlasColumns: TERRAIN_ATLAS_COLUMNS,
  terrainAtlasRows: TERRAIN_ATLAS_ROWS,
  terrainAtlasWidth: TERRAIN_ATLAS_WIDTH,
  terrainAtlasHeight: TERRAIN_ATLAS_HEIGHT,
  terrainTextureMemoryBytes: TERRAIN_ATLAS_BYTES,
  terrainTextureMemoryMB: TERRAIN_ATLAS_BYTES / (1024 * 1024),
  maxTextureMemoryMB: 16,
  maxTerrainDrawCalls: 2,
  maxDrawCalls: 25,
})

/**
 * Jade uses a seamless material as the continuous world surface, then adds
 * transparent, world-anchored procedural detail per streamed region. This is
 * deliberately not a viewport-sized environment painting: camera travel moves
 * through a repeating material field while regional wear, paths and mineral
 * seams break the wallpaper read without exposing square image islands.
 */
export const JADE_GROUND_COMPOSITION_2D = Object.freeze({
  base: 'procedural-authored-material-composite',
  baseAsset: 'jade-sanctuary-ground-material-v2',
  fallbackAsset: 'jade-highland-ground-v1',
  authoredDetail: 'world-anchored-procedural-region-decals',
  repeatsAuthoredPlate: false,
  baseTiling: 'periodic-wrapped-material-islands',
  synthesisSize: 1536,
  authoredCropMode: 'multi-crop-rotated-soft-islands',
  landmarkMotifs: 'seed-specific-procedural',
  // Keep the material below actor scale. At the previous 1.55 scale a single
  // synthesized period was wider than a 1920px viewport, so the arena still
  // read as one large ground image even though the source crops were blended.
  // A 0.4 Y/X ratio preserves the world's oblique projection while showing
  // enough independent material structure during camera travel.
  floorTileScale: Object.freeze({ x: 0.9, y: 0.36 }),
  decalAlpha: 0.96,
  decalOverlap: 1.1,
  decalEdgeFeather: 78,
})

/**
 * Pick a materially different source window for each streamed jade variant.
 *
 * The source painting is intentionally larger than one chunk, but using one
 * fixed 940px crop left every variant with almost the same paving and grass
 * silhouette. At gameplay scale that read as a repeated screenshot even when
 * chunk seams were perfectly feathered. Varying crop scale, origin and both
 * mirror axes gives the twelve resident variants distinct material structure
 * without allocating another source texture.
 */
export function jadeGroundCropPlan2D(seed, sourceWidth = 1254, sourceHeight = 1254) {
  const width = Math.max(1, Math.floor(Number(sourceWidth) || 1))
  const height = Math.max(1, Math.floor(Number(sourceHeight) || 1))
  const maximum = Math.min(width, height)
  let state = (Math.imul((Math.floor(Number(seed) || 0) ^ 0x6d2b79f5), 0x9e3779b1)) >>> 0
  const random = () => {
    state = (Math.imul(state ^ (state >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0
    return state / 4294967296
  }
  const minimum = Math.min(maximum, Math.max(1, Math.round(maximum * 0.58)))
  const upper = Math.min(maximum, Math.max(minimum, Math.round(maximum * 0.96)))
  const crop = Math.max(1, Math.round(minimum + random() * Math.max(0, upper - minimum)))
  const transform = Math.abs(Math.floor(Number(seed) || 0)) % 4
  return Object.freeze({
    crop,
    sx: Math.round(random() * Math.max(0, width - crop)),
    sy: Math.round(random() * Math.max(0, height - crop)),
    flipX: transform === 1 || transform === 3,
    flipY: transform === 2 || transform === 3,
    transform,
  })
}

export const RUNTIME2D_POOL_LIMITS = Object.freeze({
  projectiles: MAX_PROJECTILES_2D,
  pickups: MAX_PICKUPS_2D,
  weaponFields: MAX_WEAPON_FIELDS_2D,
})

/**
 * Hostile projectiles deliberately use a separate atlas and silhouette set.
 * Keeping the family label stable preserves the coarse combat contract while
 * the per-slot shape/frame makes an incoming attack readable from the wisp
 * enemy body and from friendly projectiles.
 */
export const HOSTILE_PROJECTILE_PRESENTATION = Object.freeze([
  Object.freeze({ family: 'hostile', shape: 'lance', frame: 0, scaleX: 0.86, scaleY: 0.18, rotationOffset: 0, spin: 0.08, pulse: 0.06, alpha: 0.96, tint: 0xff7f91 }),
  Object.freeze({ family: 'hostile', shape: 'orb', frame: 1, scaleX: 0.42, scaleY: 0.42, rotationOffset: 0, spin: 0.44, pulse: 0.18, alpha: 0.88, tint: 0xd37dff }),
  Object.freeze({ family: 'hostile', shape: 'shard', frame: 2, scaleX: 0.68, scaleY: 0.25, rotationOffset: -0.26, spin: -0.22, pulse: 0.1, alpha: 0.94, tint: 0xff8cc8 }),
  Object.freeze({ family: 'hostile', shape: 'sigil', frame: 3, scaleX: 0.5, scaleY: 0.5, rotationOffset: Math.PI / 4, spin: 0.72, pulse: 0.26, alpha: 0.82, tint: 0x9e91ff }),
])

const HOSTILE_PROJECTILE_VISUAL = HOSTILE_PROJECTILE_PRESENTATION[0]

/**
 * Friendly projectile presentation is intentionally data-only. Each kind uses
 * a frame from one procedural atlas, plus a distinct aspect, orientation and
 * palette so the fixed ParticleContainer can batch all seven families.
 */
export const PROJECTILE_PRESENTATION = Object.freeze({
  1: Object.freeze({ family: 'sword', frame: 0, scaleX: 0.62, scaleY: 0.18, rotationOffset: 0, spin: 0.04, pulse: 0.04, alpha: 0.95, tint: 0xe8f8ff }),
  2: Object.freeze({ family: 'fire', frame: 1, scaleX: 0.38, scaleY: 0.38, rotationOffset: 0.2, spin: 0.18, pulse: 0.12, alpha: 0.9, tint: 0xff7a43 }),
  3: Object.freeze({ family: 'ice', frame: 2, scaleX: 0.54, scaleY: 0.22, rotationOffset: -0.16, spin: 0.02, pulse: 0.14, alpha: 0.92, tint: 0x8edcff }),
  4: Object.freeze({ family: 'thunder', frame: 3, scaleX: 0.48, scaleY: 0.24, rotationOffset: Math.PI / 4, spin: 0.7, pulse: 0.16, alpha: 0.94, tint: 0xb98cff }),
  5: Object.freeze({ family: 'void', frame: 4, scaleX: 0.36, scaleY: 0.36, rotationOffset: Math.PI / 8, spin: -0.45, pulse: 0.3, alpha: 0.78, tint: 0x7e63c7 }),
  6: Object.freeze({ family: 'needle', frame: 5, scaleX: 0.78, scaleY: 0.1, rotationOffset: -0.08, spin: 0.04, pulse: 0.05, alpha: 0.93, tint: 0xf6d88a }),
  7: Object.freeze({ family: 'wind', frame: 6, scaleX: 0.58, scaleY: 0.3, rotationOffset: 0.34, spin: 0.65, pulse: 0.22, alpha: 0.82, tint: 0x77efcf }),
})

export const WEAPON_FIELD_PRESENTATION = Object.freeze({
  1: Object.freeze({ family: 'array', frame: 0, scaleX: 1, scaleY: 0.52, rotationSpeed: 0.18, pulse: 0.08, alpha: 0.62, tint: 0x72e0af }),
  2: Object.freeze({ family: 'fire', frame: 1, scaleX: 1.08, scaleY: 0.6, rotationSpeed: -0.12, pulse: 0.12, alpha: 0.68, tint: 0xff7a43 }),
  3: Object.freeze({ family: 'poison', frame: 2, scaleX: 0.94, scaleY: 0.48, rotationSpeed: 0.08, pulse: 0.1, alpha: 0.7, tint: 0x73d39c }),
  4: Object.freeze({ family: 'void', frame: 3, scaleX: 1.12, scaleY: 0.64, rotationSpeed: -0.2, pulse: 0.14, alpha: 0.64, tint: 0x8f73d6 }),
})

function weaponVisualSignature({ mode, trajectory, collision, status, projectile, field }) {
  return Object.freeze({
    axes: Object.freeze({ mode, trajectory, collision, status }),
    projectile: Object.freeze(projectile),
    field: Object.freeze(field),
  })
}

/**
 * Every authored weapon/evolution has an explicit visual contract. The
 * descriptor axes are retained beside the runtime values so a new behavior
 * cannot silently fall back to a generic projectile shape. Both consumers
 * still point at the seven-cell projectile atlas and the shared field atlas.
 */
export const WEAPON_VISUAL_SIGNATURES = Object.freeze({
  flyingSword: weaponVisualSignature({
    mode: 'homingProjectile', trajectory: 'homing', collision: 'piercing', status: 'knockback',
    projectile: { family: 'sword', frame: 0, scaleX: 0.72, scaleY: 0.23, rotationOffset: 0.02, spin: 0.04, pulse: 0.07, alpha: 0.97, tint: 0xd4f7ff },
    field: { family: 'swordSeal', frame: 0, scaleX: 0.92, scaleY: 0.42, rotationSpeed: 0.1, pulse: 0.06, alpha: 0.34, tint: 0x9deaff },
  }),
  fireTalisman: weaponVisualSignature({
    mode: 'lobbedBlast', trajectory: 'lob', collision: 'blast', status: 'burn',
    projectile: { family: 'fire', frame: 1, scaleX: 0.4, scaleY: 0.4, rotationOffset: 0.18, spin: 0.18, pulse: 0.12, alpha: 0.9, tint: 0xff7a43 },
    field: { family: 'emberMark', frame: 1, scaleX: 1, scaleY: 0.56, rotationSpeed: -0.12, pulse: 0.13, alpha: 0.52, tint: 0xff9c4c },
  }),
  thunderOrb: weaponVisualSignature({
    mode: 'orbitContact', trajectory: 'orbit', collision: 'contact', status: 'orbit-knockback',
    projectile: { family: 'thunderOrb', frame: 3, scaleX: 0.34, scaleY: 0.34, rotationOffset: 0.34, spin: 1.8, pulse: 0.16, alpha: 0.94, tint: 0xb98cff },
    field: { family: 'orbitSeal', frame: 2, scaleX: 0.8, scaleY: 0.44, rotationSpeed: 0.4, pulse: 0.18, alpha: 0.4, tint: 0xc6a8ff },
  }),
  frostPalm: weaponVisualSignature({
    mode: 'frostCone', trajectory: 'cone', collision: 'area', status: 'slow',
    projectile: { family: 'ice', frame: 2, scaleX: 0.58, scaleY: 0.22, rotationOffset: -0.16, spin: 0.02, pulse: 0.14, alpha: 0.92, tint: 0x8edcff },
    field: { family: 'frostRing', frame: 3, scaleX: 0.9, scaleY: 0.46, rotationSpeed: -0.05, pulse: 0.16, alpha: 0.45, tint: 0x9deaff },
  }),
  baguaArray: weaponVisualSignature({
    mode: 'persistentArray', trajectory: 'groundAnchor', collision: 'areaTick', status: 'persistent',
    projectile: { family: 'baguaGlyph', frame: 4, scaleX: 0.34, scaleY: 0.34, rotationOffset: 0.1, spin: 0.3, pulse: 0.2, alpha: 0.8, tint: 0x72e0af },
    field: { family: 'baguaArray', frame: 0, scaleX: 0.95, scaleY: 0.5, rotationSpeed: 0.18, pulse: 0.18, alpha: 0.62, tint: 0x72e0af },
  }),
  vajra: weaponVisualSignature({
    mode: 'piercingLine', trajectory: 'line', collision: 'infinitePierce', status: 'knockback',
    projectile: { family: 'vajra', frame: 5, scaleX: 0.76, scaleY: 0.12, rotationOffset: 0, spin: 0, pulse: 0.03, alpha: 0.96, tint: 0xf6d88a },
    field: { family: 'vajraImprint', frame: 4, scaleX: 0.75, scaleY: 0.32, rotationSpeed: 0, pulse: 0.07, alpha: 0.34, tint: 0xf6d88a },
  }),
  spiritButterfly: weaponVisualSignature({
    mode: 'driftingHoming', trajectory: 'driftHoming', collision: 'piercing', status: 'slow',
    projectile: { family: 'spiritWing', frame: 6, scaleX: 0.4, scaleY: 0.3, rotationOffset: 0.45, spin: 0.65, pulse: 0.22, alpha: 0.82, tint: 0x9bf2e1 },
    field: { family: 'butterflyVeil', frame: 5, scaleX: 1.04, scaleY: 0.7, rotationSpeed: 0.18, pulse: 0.2, alpha: 0.42, tint: 0x9bf2e1 },
  }),
  venomMist: weaponVisualSignature({
    mode: 'poisonField', trajectory: 'groundAnchor', collision: 'areaTick', status: 'burn-persistent',
    projectile: { family: 'venomMist', frame: 6, scaleX: 0.3, scaleY: 0.26, rotationOffset: -0.2, spin: -0.3, pulse: 0.26, alpha: 0.76, tint: 0x73d39c },
    field: { family: 'venomMist', frame: 2, scaleX: 0.98, scaleY: 0.54, rotationSpeed: -0.24, pulse: 0.26, alpha: 0.68, tint: 0x73d39c },
  }),
  hiddenNeedles: weaponVisualSignature({
    mode: 'spreadProjectile', trajectory: 'spread', collision: 'piercing', status: 'knockback',
    projectile: { family: 'needle', frame: 5, scaleX: 0.78, scaleY: 0.1, rotationOffset: -0.08, spin: 0.04, pulse: 0.05, alpha: 0.93, tint: 0xf6d88a },
    field: { family: 'needleMark', frame: 4, scaleX: 0.82, scaleY: 0.34, rotationSpeed: 0.08, pulse: 0.1, alpha: 0.35, tint: 0xf6d88a },
  }),
  bellToll: weaponVisualSignature({
    mode: 'radialPulse', trajectory: 'radial', collision: 'ring', status: 'knockback',
    projectile: { family: 'bellWave', frame: 4, scaleX: 0.42, scaleY: 0.42, rotationOffset: 0, spin: 0.95, pulse: 0.24, alpha: 0.8, tint: 0xffdb87 },
    field: { family: 'bellWave', frame: 6, scaleX: 1.15, scaleY: 0.6, rotationSpeed: 0.3, pulse: 0.24, alpha: 0.54, tint: 0xffdb87 },
  }),
  windBlade: weaponVisualSignature({
    mode: 'returningBlade', trajectory: 'outAndBack', collision: 'piercing', status: 'return-knockback',
    projectile: { family: 'wind', frame: 6, scaleX: 0.64, scaleY: 0.2, rotationOffset: 0.34, spin: 0.85, pulse: 0.12, alpha: 0.93, tint: 0x77efcf },
    field: { family: 'windMark', frame: 5, scaleX: 0.85, scaleY: 0.4, rotationSpeed: -0.18, pulse: 0.18, alpha: 0.4, tint: 0x77efcf },
  }),
  earthSpike: weaponVisualSignature({
    mode: 'groundEruption', trajectory: 'groundBurst', collision: 'multiArea', status: 'knockback',
    projectile: { family: 'earthSpike', frame: 2, scaleX: 0.28, scaleY: 0.62, rotationOffset: Math.PI / 2, spin: 0, pulse: 0.22, alpha: 0.86, tint: 0xd6b37a },
    field: { family: 'earthRift', frame: 7, scaleX: 0.7, scaleY: 0.76, rotationSpeed: 0.4, pulse: 0.25, alpha: 0.58, tint: 0xd6b37a },
  }),
  voidOrb: weaponVisualSignature({
    mode: 'pullingOrb', trajectory: 'stationaryOrb', collision: 'areaTick', status: 'pull',
    projectile: { family: 'void', frame: 4, scaleX: 0.4, scaleY: 0.4, rotationOffset: Math.PI / 8, spin: -0.45, pulse: 0.3, alpha: 0.78, tint: 0x7e63c7 },
    field: { family: 'voidWell', frame: 3, scaleX: 1.2, scaleY: 0.7, rotationSpeed: -0.3, pulse: 0.32, alpha: 0.64, tint: 0x8f73d6 },
  }),
  skyThunder: weaponVisualSignature({
    mode: 'delayedStrike', trajectory: 'targetMarker', collision: 'areaStrike', status: 'delayed-knockback',
    projectile: { family: 'skyThunder', frame: 3, scaleX: 0.28, scaleY: 0.62, rotationOffset: Math.PI / 2, spin: 0.6, pulse: 0.32, alpha: 0.84, tint: 0xd5b9ff },
    field: { family: 'thunderMarker', frame: 6, scaleX: 1.05, scaleY: 0.45, rotationSpeed: 0.6, pulse: 0.3, alpha: 0.5, tint: 0xd5b9ff },
  }),
  myriadSwords: weaponVisualSignature({
    mode: 'returningSwordRain', trajectory: 'radialReturn', collision: 'piercing', status: 'return-knockback',
    projectile: { family: 'swordRain', frame: 0, scaleX: 0.92, scaleY: 0.12, rotationOffset: -0.12, spin: 1.2, pulse: 0.1, alpha: 0.96, tint: 0xf4fbff },
    field: { family: 'swordRainSeal', frame: 7, scaleX: 1.25, scaleY: 0.45, rotationSpeed: 0.9, pulse: 0.22, alpha: 0.46, tint: 0xc7f3ff },
  }),
  infernoSea: weaponVisualSignature({
    mode: 'fireFieldBlast', trajectory: 'lob', collision: 'blast', status: 'burn-persistent',
    projectile: { family: 'inferno', frame: 1, scaleX: 0.52, scaleY: 0.52, rotationOffset: 0.45, spin: 0.3, pulse: 0.2, alpha: 0.96, tint: 0xff542f },
    field: { family: 'infernoSea', frame: 1, scaleX: 1.32, scaleY: 0.78, rotationSpeed: -0.35, pulse: 0.28, alpha: 0.78, tint: 0xff542f },
  }),
  violetThunder: weaponVisualSignature({
    mode: 'chainingOrbit', trajectory: 'orbit', collision: 'chain', status: 'orbit-chain',
    projectile: { family: 'violetChain', frame: 3, scaleX: 0.42, scaleY: 0.26, rotationOffset: 0.76, spin: 2.8, pulse: 0.24, alpha: 0.96, tint: 0xd1aaff },
    field: { family: 'violetChainSeal', frame: 6, scaleX: 0.92, scaleY: 0.52, rotationSpeed: 0.85, pulse: 0.34, alpha: 0.5, tint: 0xd1aaff },
  }),
  frozenSky: weaponVisualSignature({
    mode: 'freezeShatterCone', trajectory: 'cone', collision: 'area', status: 'freeze-shatter',
    projectile: { family: 'frozenSky', frame: 2, scaleX: 0.7, scaleY: 0.34, rotationOffset: -0.42, spin: 0.25, pulse: 0.22, alpha: 0.95, tint: 0xc7f7ff },
    field: { family: 'frozenSky', frame: 3, scaleX: 1.3, scaleY: 0.7, rotationSpeed: -0.32, pulse: 0.3, alpha: 0.6, tint: 0xc7f7ff },
  }),
  plagueTide: weaponVisualSignature({
    mode: 'poisonSeaField', trajectory: 'groundAnchor', collision: 'areaTick', status: 'burn-persistent',
    projectile: { family: 'plagueTide', frame: 6, scaleX: 0.56, scaleY: 0.46, rotationOffset: -0.55, spin: -0.6, pulse: 0.32, alpha: 0.9, tint: 0x4fe09c },
    field: { family: 'plagueTide', frame: 7, scaleX: 1.55, scaleY: 0.9, rotationSpeed: -0.5, pulse: 0.4, alpha: 0.8, tint: 0x4fe09c },
  }),
  needleStorm: weaponVisualSignature({
    mode: 'needleRain', trajectory: 'spread', collision: 'piercing', status: 'knockback',
    projectile: { family: 'needleRain', frame: 5, scaleX: 0.94, scaleY: 0.15, rotationOffset: 0.26, spin: 0.6, pulse: 0.15, alpha: 0.97, tint: 0xfff0a8 },
    field: { family: 'needleRainMark', frame: 5, scaleX: 1.18, scaleY: 0.5, rotationSpeed: 0.18, pulse: 0.3, alpha: 0.46, tint: 0xfff0a8 },
  }),
})

export const WEAPON_VISUAL_SIGNATURE_IDS = Object.freeze(Object.keys(WEAPON_VISUAL_SIGNATURES))

function signatureForBehavior(behavior) {
  const id = behavior?.id ?? behavior?.weaponId
  return WEAPON_VISUAL_SIGNATURES[id] ?? null
}

export function projectilePresentationFor(kind, hostile = false) {
  if (hostile) return HOSTILE_PROJECTILE_VISUAL
  return PROJECTILE_PRESENTATION[kind] ?? PROJECTILE_PRESENTATION[1]
}

/** Pick a stable hostile silhouette without introducing a second particle pool. */
export function hostileProjectileVisualFor(field, index = 0) {
  const color = Number(field?.color?.[index] ?? 0) >>> 0
  const kind = Number(field?.kind?.[index] ?? 5) >>> 0
  const uid = Number(field?.uid?.[index] ?? index) >>> 0
  const slot = ((color ^ (kind * 17) ^ (uid * 31) ^ (index * 13)) >>> 0) % HOSTILE_PROJECTILE_PRESENTATION.length
  return HOSTILE_PROJECTILE_PRESENTATION[slot]
}

export function projectilePresentationForBehavior(behavior, kind, hostile = false) {
  if (hostile) return HOSTILE_PROJECTILE_VISUAL
  return signatureForBehavior(behavior)?.projectile ?? projectilePresentationFor(kind)
}

function mixTint2D(sourceColor, targetColor) {
  if (!Number.isFinite(sourceColor) || sourceColor === 0 || sourceColor === 0xffffff) return targetColor
  const source = sourceColor >>> 0
  const target = targetColor >>> 0
  const mix = (shift) => Math.round((((source >>> shift) & 0xff) * 0.46) + (((target >>> shift) & 0xff) * 0.54))
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

function blendTint2D(sourceColor, targetColor, amount = 0.5) {
  const source = Number(sourceColor) >>> 0
  const target = Number(targetColor) >>> 0
  const t = Math.max(0, Math.min(1, Number(amount) || 0))
  const mix = (shift) => Math.round((((source >>> shift) & 0xff) * (1 - t)) + (((target >>> shift) & 0xff) * t))
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

export function projectileTint2D(kind, sourceColor = 0xffffff) {
  return mixTint2D(sourceColor, projectilePresentationFor(kind).tint)
}

export function projectileTintForBehavior2D(behavior, kind, sourceColor = 0xffffff) {
  return mixTint2D(sourceColor, projectilePresentationForBehavior(behavior, kind).tint)
}

export function weaponFieldVisualFor(kind) {
  return WEAPON_FIELD_PRESENTATION[kind] ?? WEAPON_FIELD_PRESENTATION[1]
}

export function weaponFieldVisualForBehavior(behavior, kind) {
  return signatureForBehavior(behavior)?.field ?? weaponFieldVisualFor(kind)
}

export function weaponFieldPulse2D(life, maxLife, time, slot = 0, amplitude = 0.1) {
  const remaining = Math.max(0, Math.min(1, life / Math.max(0.05, maxLife)))
  const phase = time * (2.5 + (slot % 3) * 0.16) + slot * 0.73
  const pulse = Math.max(0.03, Math.min(0.4, amplitude))
  return (0.9 + Math.sin(phase) * pulse) * (0.74 + remaining * 0.26)
}

export const COMBAT_HORIZON_RATIO_2D = COMBAT_HORIZON_RATIO

// The combat floor remains present all the way to the top of the viewport so
// actors never detach from the arena. Only its distant value is reduced,
// allowing the procedural mountain and mist bands to supply depth behind it.
export const COMBAT_HORIZON_PRESENTATION_2D = Object.freeze({
  maskChannel: 'alpha',
  topFloorAlpha: 0.12,
  horizonVeilAlpha: 0.12,
  farMountainAlpha: 0.38,
  nearMountainAlpha: 0.44,
  farMountainHeightRatio: 0.38,
  nearMountainHeightRatio: 0.42,
})

export function attachCombatGroundMasks2D(floor, floorMask, decalLayer, decalMask) {
  floor?.setMask?.({ mask: floorMask, channel: COMBAT_HORIZON_PRESENTATION_2D.maskChannel })
  decalLayer?.setMask?.({ mask: decalMask, channel: COMBAT_HORIZON_PRESENTATION_2D.maskChannel })
}

export function combatRenderBands2D(width, height) {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const horizonY = Math.round(safeHeight * COMBAT_HORIZON_RATIO)
  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    horizonY,
    farTop: 0,
    farBottom: horizonY,
    groundTop: horizonY,
    groundBottom: safeHeight,
  })
}

/**
 * Snapshot interpolation can briefly expose a stale facing value while the
 * player is moving. Deriving the active frame from the actual X/Z delta keeps
 * the five authored views distinct at narrow 1280px captures as well as wide
 * screens, while idle still preserves the last explicit facing angle.
 */
export function heroDirectionFor(player) {
  const facing = Number.isFinite(player?.facing) ? player.facing : 0
  const dx = Number(player?.x ?? 0) - Number(player?.prevX ?? 0)
  const dz = Number(player?.z ?? 0) - Number(player?.prevZ ?? 0)
  const hasMotion = Number(player?.speed01 ?? 0) > 0.08 && Math.hypot(dx, dz) > 0.0001
  return directionFor(hasMotion ? Math.atan2(dx, dz) : facing)
}

export function directionalHeroFrames(frames, direction) {
  return {
    n: frames?.seolryeongN,
    ne: frames?.seolryeongNe,
    e: frames?.seolryeongE,
    se: frames?.seolryeong,
    s: frames?.seolryeongS,
  }[direction?.key] ?? frames?.seolryeongS ?? frames?.seolryeong
}

export const HERO_COMBAT_HEIGHT_TARGETS_2D = Object.freeze({
  baselineViewportHeight: 1080,
  baselineHeight: 176,
  largeViewportHeight: 1600,
  largeHeight: 248,
  minimumHeight: 118,
})

/**
 * Keep the heroine readable without turning her into a portrait pasted over
 * the arena. The authored runtime height is normalized to the visual targets
 * instead of being treated as a literal pixel height. Transparent authoring
 * padding means 140 authored pixels need 176px at 1080p and 248px at 1600p
 * for the visible body to retain its intended combat silhouette.
 */
export function heroCombatHeight2D(viewportHeight, runtimeHeight = 0) {
  const height = Math.max(1, Number(viewportHeight) || 1)
  const authoredHeight = Math.max(96, Number(runtimeHeight) || 140)
  const baseline = HERO_COMBAT_HEIGHT_TARGETS_2D.baselineHeight
  const large = HERO_COMBAT_HEIGHT_TARGETS_2D.largeHeight
  const span = HERO_COMBAT_HEIGHT_TARGETS_2D.largeViewportHeight
    - HERO_COMBAT_HEIGHT_TARGETS_2D.baselineViewportHeight
  const viewportHeightTarget = height <= HERO_COMBAT_HEIGHT_TARGETS_2D.baselineViewportHeight
    ? baseline * height / HERO_COMBAT_HEIGHT_TARGETS_2D.baselineViewportHeight
    : baseline + (large - baseline) * Math.min(1, (height - HERO_COMBAT_HEIGHT_TARGETS_2D.baselineViewportHeight) / span)
  const authoredRatio = authoredHeight / 140
  return Math.max(
    HERO_COMBAT_HEIGHT_TARGETS_2D.minimumHeight,
    viewportHeightTarget * authoredRatio,
  )
}

export function heroSlashPresentation2D(
  facing = 0,
  attackTimer = 0,
  heroHeight = HERO_COMBAT_HEIGHT_TARGETS_2D.baselineHeight,
  unit = 32,
  depthUnit = 12,
) {
  const duration = 0.32
  const remaining = Math.max(0, Math.min(duration, Number(attackTimer) || 0))
  const progress = 1 - remaining / duration
  const worldDx = Math.sin(Number(facing) || 0)
  const worldDz = Math.cos(Number(facing) || 0)
  const screenDx = worldDx
  const screenDy = worldDz * Math.max(0.1, Number(depthUnit) || 1) / Math.max(1, Number(unit) || 1)
  const magnitude = Math.max(0.0001, Math.hypot(screenDx, screenDy))
  const nx = screenDx / magnitude
  const ny = screenDy / magnitude
  const height = Math.max(1, Number(heroHeight) || 1)
  return {
    visible: remaining > 0,
    rotation: Math.atan2(ny, nx),
    // Keep the full stroke in front of the heroine. The previous centered
    // crescent was technically directional, but its dim rear half still read
    // as a large halo around the body in real 1920px combat captures.
    offsetX: nx * height * 0.46,
    offsetY: -height * 0.46 + ny * height * 0.18,
    width: height * 0.92,
    height: height * 0.46,
    alpha: Math.max(0, Math.sin(progress * Math.PI)) * 0.9,
  }
}

export const BOSS_MIN_SCREEN_HEIGHT_RATIO_2D = 0.18

export function bossCombatHeight2D(viewportHeight, runtimeHeight = 220, presentationScale = 1) {
  const height = Math.max(1, Number(viewportHeight) || 1)
  const authoredHeight = Math.max(1, Number(runtimeHeight) || 220)
  const scale = Math.max(0.8, Number(presentationScale) || 1)
  return Math.max(height * BOSS_MIN_SCREEN_HEIGHT_RATIO_2D, authoredHeight * scale)
}

// These pivots are sampled from the last opaque row in each authored 256px
// frame. A single manifest pivot made wide props float by up to 18px and made
// low-profile enemies alternately sink and hover as their animation advanced.
const ACTOR_FOOT_PIVOTS_2D = Object.freeze({
  seolryeong: Object.freeze([0.945, 0.945, 0.945, 0.945, 0.945, 0.945, 0.945, 0.945]),
  seolryeongE: Object.freeze([0.945, 0.938, 0.938, 0.938, 0.945, 0.93, 0.93, 0.93]),
  seolryeongN: Object.freeze([0.922, 0.898, 0.914, 0.922, 0.883, 0.875, 0.875, 0.875]),
  // The northeast atlas has the same opaque contact row in all eight cells.
  // Per-frame guesses made the heroine's feet hop by up to 18px at 1080p.
  seolryeongNe: Object.freeze(Array(8).fill(244 / 256)),
  seolryeongS: Object.freeze([0.961, 0.961, 0.961, 0.961, 0.914, 0.953, 0.953, 0.953]),
  yorang: Object.freeze([0.797, 0.797, 0.781, 0.75, 0.734, 0.727, 0.727, 0.75]),
  jadeSerpent: Object.freeze([0.953, 0.953, 0.953, 0.945, 0.953, 0.953, 0.953, 0.953]),
  jadeStoneGhoul: Object.freeze([0.953, 0.953, 0.953, 0.953, 0.953, 0.953, 0.953, 0.953]),
  bloodScorpion: Object.freeze([0.844, 0.852, 0.844, 0.844, 0.742, 0.805, 0.836, 0.828]),
  talismanRevenant: Object.freeze([0.906, 0.891, 0.906, 0.914, 0.859, 0.867, 0.883, 0.859]),
  voidSentinel: Object.freeze([0.898, 0.906, 0.906, 0.914, 0.836, 0.859, 0.82, 0.867]),
  jadeVoidWarden: Object.freeze([0.945, 0.938, 0.945, 0.938, 0.922, 0.922, 0.914, 0.93]),
  wisp: Object.freeze([0.82]),
  prop: Object.freeze([0.844, 0.867, 0.867, 0.836, 0.891, 0.789, 0.805, 0.758]),
})

const HERO_DIRECTION_PIVOT_KEY_2D = Object.freeze({
  n: 'seolryeongN', ne: 'seolryeongNe', e: 'seolryeongE', se: 'seolryeong', s: 'seolryeongS',
})

export function actorFootPivot2D(key, frame = 0) {
  const pivots = ACTOR_FOOT_PIVOTS_2D[key]
  const index = Math.max(0, Math.floor(Number(frame) || 0))
  if (pivots) return pivots[index % pivots.length]
  return SPRITE_MANIFEST.actors[key]?.pivot?.[1] ?? 0.9
}

export function heroFootPivot2D(directionKey, frame = 0) {
  return actorFootPivot2D(HERO_DIRECTION_PIVOT_KEY_2D[directionKey] ?? 'seolryeongS', frame)
}

const DEFAULT_GROUNDING_PROFILE_2D = Object.freeze({
  shadowWidth: 0.44, shadowHeight: 0.1, shadowOffsetY: 1,
  shadowAlpha: 0.66, minShadowWidth: 22, minShadowHeight: 7,
  contactWidth: 0.76, contactHeight: 0.3, contactLift: 0.08,
  contactAlpha: 0.12, contactTint: 0x74c9b4, visualScale: 1,
})

const ACTOR_GROUNDING_PROFILES_2D = Object.freeze({
  hero: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.46, shadowHeight: 0.105, shadowAlpha: 0.8, minShadowWidth: 44, minShadowHeight: 12, contactAlpha: 0.08 }),
  wisp: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.38, shadowHeight: 0.085, shadowAlpha: 0.52, minShadowWidth: 20, minShadowHeight: 7, contactWidth: 0.8, contactHeight: 0.44, contactLift: 0.14, contactAlpha: 0.3, contactTint: 0xb08cff, visualScale: 1.18 }),
  // Grounded enemies keep their separation light on the contact row. Lifting
  // it into the torso made the glow disappear behind the opaque sprite and
  // left the actor reading as a floating cut-out on the dark jade floor.
  yorang: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.84, shadowHeight: 0.105, shadowAlpha: 0.87, contactWidth: 1.12, contactHeight: 0.22, contactLift: 0.01, contactAlpha: 0.46, contactTint: 0x8ccfff, visualScale: 1.55 }),
  jadeSerpent: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.64, shadowHeight: 0.105, shadowAlpha: 0.84, contactWidth: 1, contactHeight: 0.24, contactLift: 0.015, contactAlpha: 0.4, contactTint: 0x7df4cf, visualScale: 1.38 }),
  jadeStoneGhoul: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.64, shadowHeight: 0.11, shadowAlpha: 0.87, contactWidth: 0.98, contactHeight: 0.24, contactLift: 0.01, contactAlpha: 0.4, contactTint: 0x7bd9b7, visualScale: 1.35 }),
  bloodScorpion: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.86, shadowHeight: 0.095, shadowAlpha: 0.86, contactWidth: 1.12, contactHeight: 0.2, contactLift: 0, contactAlpha: 0.44, contactTint: 0xffa078, visualScale: 1.42 }),
  talismanRevenant: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.42, shadowHeight: 0.085, shadowAlpha: 0.6, contactWidth: 0.84, contactHeight: 0.44, contactLift: 0.15, contactAlpha: 0.32, contactTint: 0xa88cff, visualScale: 1.34 }),
  voidSentinel: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.56, shadowHeight: 0.105, shadowAlpha: 0.84, contactWidth: 0.94, contactHeight: 0.24, contactLift: 0.01, contactAlpha: 0.4, contactTint: 0x72e0d4, visualScale: 1.32 }),
  jadeVoidWarden: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.46, shadowHeight: 0.09, shadowAlpha: 0.72, minShadowWidth: 92, minShadowHeight: 20, contactWidth: 0.8, contactHeight: 0.34, contactLift: 0.1, contactAlpha: 0.23, contactTint: 0x60d9bd }),
})

const PROP_GROUNDING_PROFILES_2D = Object.freeze([
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.46, shadowHeight: 0.085, contactWidth: 0.76, contactAlpha: 0.16, contactTint: 0xf0b85e }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.4, shadowHeight: 0.08, contactWidth: 0.66, contactAlpha: 0.11 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.35, shadowHeight: 0.078, contactWidth: 0.58, contactAlpha: 0.13 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.72, shadowHeight: 0.095, contactWidth: 0.92, contactAlpha: 0.14 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.34, shadowHeight: 0.075, contactWidth: 0.58, contactAlpha: 0.11 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.7, shadowHeight: 0.1, contactWidth: 0.92, contactAlpha: 0.1 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.82, shadowHeight: 0.075, contactWidth: 1, contactAlpha: 0.09 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.56, shadowHeight: 0.085, contactWidth: 0.82, contactAlpha: 0.17, contactTint: 0xf0b85e }),
])

/** Material grade shared by every sanctuary prop. The atlas has brighter
 * baked highlights than the combat floor; these frame-specific multipliers
 * bring stone, cloth and foliage back into the same jade/slate value range. */
export const PROP_MATERIAL_TINTS_2D = Object.freeze([
  0xd2dbd4, 0xc2d2c8, 0xc3d0ca, 0xc0cec8,
  0xc4d4cf, 0xbac8c0, 0xbdccc4, 0xd1d7cc,
])

/** Shared semantic-region grade used by terrain decals and prop materials. */
export const REGION_TERRAIN_PRESENTATION_2D = Object.freeze({
  spawn_grove: Object.freeze({ tint: 0xe4eee5, alpha: 0.94, propTint: 0xd9e6d8 }),
  jade_path: Object.freeze({ tint: 0xd3ddd2, alpha: 0.82, propTint: 0xd2d9cc }),
  jade_grove: Object.freeze({ tint: 0xc2dcc9, alpha: 1, propTint: 0xc7dbc8 }),
  lantern_shrine: Object.freeze({ tint: 0xe3d9bc, alpha: 1, propTint: 0xead8b2 }),
  mist_marsh: Object.freeze({ tint: 0xb9d4d4, alpha: 0.9, propTint: 0xc2d9d7 }),
  void_rim: Object.freeze({ tint: 0xcfbfda, alpha: 0.98, propTint: 0xd2c3dc }),
})

export function actorGroundingProfile2D(key = 'default', frame = 0) {
  if (key === 'prop' || key === 'poi') {
    const index = Math.max(0, Math.floor(Number(frame) || 0))
    return PROP_GROUNDING_PROFILES_2D[index % PROP_GROUNDING_PROFILES_2D.length]
  }
  return ACTOR_GROUNDING_PROFILES_2D[key] ?? DEFAULT_GROUNDING_PROFILE_2D
}

export const HERO_GROUND_MARKER_2D = Object.freeze({
  widthRatio: 0.46,
  heightRatio: 0.11,
  offsetY: 2,
  alpha: 0.12,
  rotation: 0,
})

export const HERO_AURA_PRESENTATION_2D = Object.freeze({
  widthRatio: 0.66,
  heightRatio: 0.18,
  alpha: 0.1,
  invulnerableAlpha: 0.26,
})

/**
 * A restrained ink rim separates the heroine from both dark terrain and pale
 * attack effects. It reuses the current animation texture in the same normal
 * blend batch: unlike a full-screen outline filter, only the expanded edge is
 * visible after the opaque hero sprite is drawn over it.
 */
export const HERO_READABILITY_RIM_2D = Object.freeze({
  scale: 1.04,
  alpha: 0.5,
  invulnerableAlpha: 0.36,
  tint: 0x8cc9d8,
  hitTint: 0xff9ca4,
  zOffset: -0.01,
})

export const BOSS_FOCUS_2D = Object.freeze({
  radius: 8,
  minimumAlpha: 0.42,
})

export function enemyBossFocusAlpha2D(distance, bossActive = false, elite = false) {
  if (!bossActive || elite) return 1
  const value = Number(distance)
  if (!Number.isFinite(value) || value >= BOSS_FOCUS_2D.radius) return 1
  const normalized = Math.max(0, value) / BOSS_FOCUS_2D.radius
  const smooth = normalized * normalized * (3 - 2 * normalized)
  return BOSS_FOCUS_2D.minimumAlpha + (1 - BOSS_FOCUS_2D.minimumAlpha) * smooth
}

/**
 * Fade only actors that physically overlap the heroine. The enemy remains
 * visible and fully simulated, but the player silhouette and ground danger
 * marker stay readable when a dense horde crosses the same depth bucket.
 */
export function enemyHeroOverlapAlpha2D(distance) {
  const value = Number(distance)
  if (!Number.isFinite(value) || value >= 2.8) return 1
  if (value <= 0) return 0.58
  return 0.58 + 0.42 * (value / 2.8)
}

const BOSS_INTENT_LABELS_2D = Object.freeze({
  radialVolley: '전방위 탄막',
  swordLine: '직선 베기',
  swordCone: '부채꼴 참격',
  swordRing: '검환 폭발',
  frostZone: '빙결 장판',
  frostLane: '빙결 가로막',
  frostMine: '빙결 지뢰',
  spiritOrbit: '영체 선회',
  spiritClone: '영체 분신',
  spiritBurst: '영체 폭발',
})

export function bossIntentLabel2D(patternId, patternType = '') {
  const key = typeof patternId === 'string' ? patternId.trim() : ''
  if (BOSS_INTENT_LABELS_2D[key]) return BOSS_INTENT_LABELS_2D[key]
  const type = typeof patternType === 'string' ? patternType.trim().toLowerCase() : ''
  if (type === 'zone') return '위험 장판'
  if (type === 'cone') return '부채꼴 공격'
  if (type === 'line') return '직선 공격'
  if (type === 'orbit') return '추적 공격'
  if (type === 'radial') return '전방위 공격'
  return key ? key.replace(/[-_]+/g, ' ') : '공격 전조'
}

/** Renderer-only profile for the active cast. It mirrors the simulation's
 * target/geometry metadata without changing the fixed-tick combat contract. */
export function bossTelegraphProfile2D(boss) {
  const pattern = boss?.pendingPattern ?? boss?.lastPattern ?? null
  const geometry = pattern?.geometry ?? {}
  const type = pattern?.patternType ?? pattern?.geometryType ?? geometry.type ?? 'radial'
  const angle = Number.isFinite(pattern?.castAngle)
    ? pattern.castAngle : Number.isFinite(geometry.angle) ? geometry.angle : 0
  const castOriginX = Number.isFinite(pattern?.castOriginX) ? pattern.castOriginX : Number(boss?.x) || 0
  const castOriginZ = Number.isFinite(pattern?.castOriginZ) ? pattern.castOriginZ : Number(boss?.z) || 0
  const originX = castOriginX + (Number(geometry.origin?.x) || 0)
  const originZ = castOriginZ + (Number(geometry.origin?.z) || 0)
  const castTargetX = Number.isFinite(pattern?.castTargetX)
    ? pattern.castTargetX : Number.isFinite(pattern?.targetX) ? pattern.targetX : originX
  const castTargetZ = Number.isFinite(pattern?.castTargetZ)
    ? pattern.castTargetZ : Number.isFinite(pattern?.targetZ) ? pattern.targetZ : originZ
  const zoneX = castTargetX + (Number(geometry.center?.x) || 0)
  const zoneZ = castTargetZ + (Number(geometry.center?.z) || 0)
  const rawRadius = Number(geometry.radius)
  const rawLength = Number(geometry.length)
  const length = Math.max(0.1, Number.isFinite(rawLength) ? rawLength : type === 'line' ? 13 : 11.5)
  const width = Math.max(0.1, Number(geometry.width) || 1.6)
  const radius = type === 'line' || type === 'cone'
    ? Math.max(3.8, length * 0.58)
    : Math.max(3.8, Number.isFinite(rawRadius) ? rawRadius : 6.6)
  const shape = geometry.shape ?? type
  let instances = Array.isArray(pattern?.zoneInstances)
    ? pattern.zoneInstances.map((instance) => ({ ...instance }))
    : []
  if (type === 'zone' && instances.length === 0) {
    const count = Math.max(1, Math.min(8, Math.trunc(Number(geometry.count) || 1)))
    if (shape === 'cluster') {
      const spacing = Math.max(1.1, radius * 1.65)
      instances = Array.from({ length: count }, (_, index) => {
        const instanceAngle = angle + Math.PI * 2 * index / count
        return {
          shape: 'circle',
          x: zoneX + Math.cos(instanceAngle) * spacing,
          z: zoneZ + Math.sin(instanceAngle) * spacing,
          radius,
        }
      })
    } else if (shape === 'wall') {
      const shardLength = length / count
      instances = Array.from({ length: count }, (_, index) => {
        const offset = -length * 0.5 + shardLength * (index + 0.5)
        return {
          shape: 'rect',
          x: zoneX + Math.cos(angle) * offset,
          z: zoneZ + Math.sin(angle) * offset,
          angle,
          length: shardLength,
          width,
        }
      })
    } else if (shape === 'lane') {
      instances = [{ shape: 'rect', x: zoneX, z: zoneZ, angle, length, width }]
    } else {
      instances = [{ shape: 'circle', x: zoneX, z: zoneZ, radius }]
    }
  }
  return Object.freeze({
    id: pattern?.patternId ?? boss?.patternId ?? 'radialVolley',
    type,
    shape,
    x: type === 'zone' ? zoneX : originX,
    z: type === 'zone' ? zoneZ : originZ,
    angle,
    radius,
    length,
    width,
    arcRadians: Math.max(0.1, Number(geometry.arcRadians) || 0.8),
    innerRadius: Math.max(0, Number(geometry.innerRadius) || 0),
    instances: Object.freeze(instances.map((instance) => Object.freeze(instance))),
    color: boss?.def?.id === 'blueWolfKing' ? 0x6ca8ff : (boss?.patternColor ?? boss?.def?.color ?? 0xff6f9e),
    label: bossIntentLabel2D(pattern?.intent ?? boss?.patternIntent ?? pattern?.patternId, type),
  })
}

function bossRectPoints2D(x, z, angle, length, width, originAnchored = false) {
  const directionX = Math.cos(angle)
  const directionZ = Math.sin(angle)
  const lateralX = -directionZ
  const lateralZ = directionX
  const centerX = originAnchored ? x + directionX * length * 0.5 : x
  const centerZ = originAnchored ? z + directionZ * length * 0.5 : z
  const halfLength = length * 0.5
  const halfWidth = width * 0.5
  return [
    { x: centerX - directionX * halfLength - lateralX * halfWidth, z: centerZ - directionZ * halfLength - lateralZ * halfWidth },
    { x: centerX + directionX * halfLength - lateralX * halfWidth, z: centerZ + directionZ * halfLength - lateralZ * halfWidth },
    { x: centerX + directionX * halfLength + lateralX * halfWidth, z: centerZ + directionZ * halfLength + lateralZ * halfWidth },
    { x: centerX - directionX * halfLength + lateralX * halfWidth, z: centerZ - directionZ * halfLength + lateralZ * halfWidth },
  ]
}

function bossCirclePoints2D(x, z, radius, segments = 28) {
  return Array.from({ length: segments }, (_, index) => {
    const angle = Math.PI * 2 * index / segments
    return { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius }
  })
}

/** Exact world-space hazard silhouettes shared by the visual telegraph tests
 * and the Pixi renderer. They intentionally mirror CombatWorld2D collision
 * geometry so a player never sees a safe patch that the simulation can hit. */
export function bossTelegraphWorldShapes2D(profile) {
  if (!profile) return []
  if (profile.type === 'line') {
    return [bossRectPoints2D(profile.x, profile.z, profile.angle, profile.length, profile.width, true)]
  }
  if (profile.type === 'cone') {
    const segments = 18
    const start = profile.angle - profile.arcRadians * 0.5
    const outer = Array.from({ length: segments + 1 }, (_, index) => {
      const angle = start + profile.arcRadians * index / segments
      return { x: profile.x + Math.cos(angle) * profile.length, z: profile.z + Math.sin(angle) * profile.length }
    })
    if (profile.innerRadius <= 0) return [[{ x: profile.x, z: profile.z }, ...outer]]
    const inner = Array.from({ length: segments + 1 }, (_, index) => {
      const angle = start + profile.arcRadians * (segments - index) / segments
      return { x: profile.x + Math.cos(angle) * profile.innerRadius, z: profile.z + Math.sin(angle) * profile.innerRadius }
    })
    return [[...outer, ...inner]]
  }
  if (profile.type === 'zone') {
    return profile.instances.map((instance) => instance.shape === 'rect'
      ? bossRectPoints2D(instance.x, instance.z, instance.angle, instance.length, instance.width)
      : bossCirclePoints2D(instance.x, instance.z, instance.radius))
  }
  return [bossCirclePoints2D(profile.x, profile.z, profile.radius)]
}

function drawBossTelegraph2D(graphics, profile, cameraX, cameraZ, viewport, castProgress) {
  graphics.clear()
  const pulse = Math.sin(Math.max(0, Math.min(1, castProgress)) * Math.PI)
  const fillAlpha = 0.12 + pulse * 0.1
  const strokeAlpha = 0.58 + pulse * 0.3
  const strokeWidth = Math.max(2, viewportPresentationScale(viewport) * 2.4)
  for (const shape of bossTelegraphWorldShapes2D(profile)) {
    const points = []
    for (const point of shape) {
      const screen = { x: 0, y: 0, unit: 24 }
      projectWorld(point.x, point.z, cameraX, cameraZ, viewport, screen)
      points.push(screen.x, screen.y + 2)
    }
    if (points.length < 6) continue
    graphics.poly(points, true)
      .fill({ color: profile.color, alpha: fillAlpha })
      .stroke({ color: profile.color, alpha: strokeAlpha, width: strokeWidth })
  }
}
const POI_PRESENTATION = Object.freeze({
  altar: Object.freeze({ frame: 7, height: 142, glyph: '祭', color: 0xf2c76f }),
  treasure: Object.freeze({ frame: 3, height: 154, glyph: '寶', color: 0x8edcff }),
  elite_seal: Object.freeze({ frame: 2, height: 176, glyph: '封', color: 0xe969a1 }),
  healing_spring: Object.freeze({ frame: 5, height: 118, glyph: '泉', color: 0x73e3bd }),
})

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  draw(ctx, width, height)
  return Texture.from(canvas)
}

function radialTexture(inner, outer = 'rgba(255,255,255,0)') {
  return canvasTexture(64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31)
    gradient.addColorStop(0, inner)
    gradient.addColorStop(0.35, inner)
    gradient.addColorStop(1, outer)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  })
}

// The floor uses a real alpha mask for the sky-to-ground transition. This
// lightweight veil remains only as a low-alpha atmospheric tint; it must not
// be the thing hiding a hard sprite edge.
function horizonBlendTexture() {
  return canvasTexture(512, 256, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(8,18,27,0)')
    gradient.addColorStop(0.12, 'rgba(17,39,46,.1)')
    gradient.addColorStop(0.24, 'rgba(35,67,70,.28)')
    gradient.addColorStop(0.38, 'rgba(57,95,95,.52)')
    gradient.addColorStop(0.5, 'rgba(57,96,91,.62)')
    gradient.addColorStop(0.64, 'rgba(45,82,77,.48)')
    gradient.addColorStop(0.8, 'rgba(20,46,46,.24)')
    gradient.addColorStop(1, 'rgba(7,18,24,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  })
}

// A 512px alpha mask is stretched to the viewport and applied to the full
// screen-space floor. The feather follows a deterministic low-frequency
// per-column wave, so the horizon is an atmospheric contour rather than a
// shared one-pixel join. Alpha is zero above the transition and reaches 1
// well below it, preserving a fully authored ground plane for the arena.
function floorBlendMaskTexture() {
  return canvasTexture(512, 512, (ctx, width, height) => {
    const image = ctx.createImageData(width, height)
    const pixels = image.data
    const smoothstep = (value) => {
      const t = Math.max(0, Math.min(1, value))
      return t * t * (3 - 2 * t)
    }
    for (let y = 0; y < height; y++) {
      const normalizedY = y / (height - 1)
      for (let x = 0; x < width; x++) {
        const normalizedX = x / (width - 1)
        const horizon = 0.205
          + Math.sin(normalizedX * Math.PI * 3.6 + 0.7) * 0.055
          + Math.sin(normalizedX * Math.PI * 8.4 + 1.9) * 0.025
          + Math.sin(normalizedX * Math.PI * 19.5 + 0.3) * 0.012
        // Begin just above the viewport so no in-frame scanline is the first
        // non-transparent row. The floor is only ~1% visible at y=0, reaches
        // its midpoint around the authored horizon, and becomes fully opaque
        // below it. Varying the denominator per column retains the soft,
        // irregular atmospheric contour without introducing a new edge.
        const feather = smoothstep((normalizedY + 0.03) / (horizon + 0.265))
        // The floor is always present as a translucent aerial plane. A low
        // top value reveals the procedural skyline without creating a hard
        // seam; the irregular feather reaches a fully opaque play surface.
        const baseAlpha = COMBAT_HORIZON_PRESENTATION_2D.topFloorAlpha
        const alpha = Math.round((baseAlpha + feather * (1 - baseAlpha)) * 255)
        const offset = (y * width + x) * 4
        pixels[offset] = 255
        pixels[offset + 1] = 255
        pixels[offset + 2] = 255
        pixels[offset + 3] = alpha
      }
    }
    ctx.putImageData(image, 0, 0)
  })
}

function wispTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.translate(64, 64)
    const aura = ctx.createRadialGradient(0, 0, 3, 0, 0, 38)
    aura.addColorStop(0, 'rgba(248,244,255,1)')
    aura.addColorStop(0.18, 'rgba(183,222,255,.95)')
    aura.addColorStop(0.46, 'rgba(131,102,220,.48)')
    aura.addColorStop(1, 'rgba(81,45,154,0)')
    ctx.fillStyle = aura
    ctx.beginPath()
    ctx.arc(0, 0, 40, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3)
      ctx.strokeStyle = `rgba(151,205,255,${0.48 - i * 0.08})`
      ctx.lineWidth = 5 - i
      ctx.beginPath()
      ctx.moveTo(9, -4)
      ctx.bezierCurveTo(30, -15, 43, 7, 54, -2)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,255,255,.96)'
    ctx.beginPath()
    ctx.arc(-4, -5, 6, 0, Math.PI * 2)
    ctx.fill()
  })
}

function slashTexture() {
  return canvasTexture(192, 104, (ctx) => {
    const glow = ctx.createLinearGradient(12, 88, 184, 34)
    glow.addColorStop(0, 'rgba(105,204,255,0)')
    glow.addColorStop(0.24, 'rgba(89,207,255,.34)')
    glow.addColorStop(0.68, 'rgba(186,243,255,.9)')
    glow.addColorStop(0.9, 'rgba(255,255,255,.98)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.strokeStyle = glow
    ctx.lineCap = 'round'
    ctx.lineWidth = 18
    ctx.beginPath()
    ctx.moveTo(12, 88)
    ctx.bezierCurveTo(58, 70, 112, 10, 184, 34)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(244,254,255,.98)'
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(30, 79)
    ctx.bezierCurveTo(78, 54, 123, 19, 178, 34)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(117,224,255,.48)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(52, 86)
    ctx.quadraticCurveTo(116, 44, 168, 43)
    ctx.stroke()
  })
}

function impactTexture() {
  return canvasTexture(96, 96, (ctx) => {
    ctx.translate(48, 48)
    ctx.lineCap = 'round'
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.18
      const inner = i % 2 ? 7 : 11
      const outer = i % 2 ? 25 : 35
      ctx.strokeStyle = i % 2 ? 'rgba(168,229,255,.65)' : 'rgba(247,253,255,.94)'
      ctx.lineWidth = i % 2 ? 2 : 3
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,255,255,.96)'
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-4, -4, 8, 8)
  })
}

function deathTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.translate(64, 64)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + (i % 3) * 0.12
      const distance = 18 + (i % 4) * 9
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance * 0.72
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle + Math.PI / 4)
      ctx.fillStyle = i % 3 === 0 ? 'rgba(231,248,255,.9)' : 'rgba(139,181,236,.58)'
      const size = 3 + (i % 3)
      ctx.fillRect(-size, -size, size * 2, size * 2)
      ctx.restore()
    }
    ctx.strokeStyle = 'rgba(170,218,255,.45)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 24, 0, Math.PI * 2)
    ctx.stroke()
  })
}

function mistRibbonTexture() {
  return canvasTexture(768, 180, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height)
    const lobes = [
      [92, 100, 110, 50, 0.2], [238, 80, 150, 58, 0.16], [410, 110, 180, 54, 0.18],
      [590, 74, 150, 48, 0.14], [730, 112, 120, 46, 0.18],
    ]
    for (const [x, y, rx, ry, alpha] of lobes) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, rx)
      gradient.addColorStop(0, `rgba(158,205,218,${alpha})`)
      gradient.addColorStop(0.62, `rgba(105,161,177,${alpha * 0.54})`)
      gradient.addColorStop(1, 'rgba(70,115,132,0)')
      ctx.fillStyle = gradient
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(1, ry / rx)
      ctx.beginPath()
      ctx.arc(0, 0, rx, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  })
}

function drawBrokenTerrainMotif(ctx, random, width, height, seed) {
  const motif = Math.abs(seed) % 4
  const cx = width * (0.28 + random() * 0.44)
  const cy = height * (0.28 + random() * 0.44)
  const radius = 44 + random() * 54
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(random() * Math.PI * 2)
  ctx.scale(0.76 + random() * 0.5, 0.68 + random() * 0.38)
  ctx.strokeStyle = 'rgba(112,209,178,.115)'
  ctx.lineCap = 'round'
  ctx.lineWidth = 2.2 + random() * 1.8

  if (motif === 0) {
    // Two eroded crescents with deliberately different gaps.
    for (let i = 0; i < 2; i++) {
      const start = 0.18 + random() * 1.1
      const span = Math.PI * (0.72 + random() * 0.48)
      ctx.beginPath()
      ctx.arc(0, 0, radius * (0.68 + i * 0.34), start, start + span)
      ctx.stroke()
    }
  } else if (motif === 1) {
    // A collapsed triangular ward: no complete icon survives.
    const points = Array.from({ length: 3 }, (_, i) => {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 3
      return [Math.cos(angle) * radius, Math.sin(angle) * radius]
    })
    for (let i = 0; i < 3; i++) {
      const a = points[i]
      const b = points[(i + 1) % 3]
      const insetA = 0.12 + random() * 0.12
      const insetB = 0.12 + random() * 0.18
      ctx.beginPath()
      ctx.moveTo(a[0] + (b[0] - a[0]) * insetA, a[1] + (b[1] - a[1]) * insetA)
      ctx.lineTo(b[0] + (a[0] - b[0]) * insetB, b[1] + (a[1] - b[1]) * insetB)
      ctx.stroke()
    }
  } else if (motif === 2) {
    // Offset stepping seals read as remnants of a path, not a stamped tile.
    for (let i = -2; i <= 2; i++) {
      ctx.save()
      ctx.translate(i * radius * 0.48, Math.sin(i * 1.7) * radius * 0.24)
      ctx.rotate(i * 0.28)
      ctx.strokeRect(-radius * 0.16, -radius * 0.11, radius * 0.32, radius * 0.22)
      ctx.restore()
    }
  } else {
    // A branching mineral fault provides a non-symbolic landmark.
    ctx.beginPath()
    ctx.moveTo(-radius, radius * 0.42)
    let x = -radius
    let y = radius * 0.42
    for (let i = 0; i < 6; i++) {
      x += radius * (0.24 + random() * 0.16)
      y += (random() - 0.5) * radius * 0.62
      ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-radius * 0.08, 0)
    ctx.lineTo(radius * 0.3, -radius * 0.72)
    ctx.stroke()
  }
  ctx.restore()
}

function groundChunkTexture(source, seed, stageId = 'jade', authoredTerrain = false) {
  return canvasTexture(512, 512, (ctx, width, height) => {
    let state = (seed * 0x9e3779b1) >>> 0
    const random = () => {
      state = (Math.imul(state ^ (state >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0
      return state / 4294967296
    }

    if (authoredTerrain) ctx.clearRect(0, 0, width, height)
    else {
      ctx.fillStyle = '#14242d'
      ctx.fillRect(0, 0, width, height)
    }
    if (source?.width && source?.height) {
      const plan = authoredTerrain
        ? jadeGroundCropPlan2D(seed, source.width, source.height)
        : {
            crop: Math.min(source.width, source.height, 940),
            sx: random() * Math.max(0, source.width - Math.min(source.width, source.height, 940)),
            sy: random() * Math.max(0, source.height - Math.min(source.width, source.height, 940)),
            flipX: seed % 2 === 0,
            flipY: false,
          }
      // The world projection compresses Z to roughly 40% of X. Sampling a
      // matching wide source window before the sprite is projected prevents
      // stones, grass and seals from being stretched into 2.5:1 stickers.
      const sourceWidth = plan.crop
      const sourceHeight = authoredTerrain
        ? Math.max(1, Math.min(source.height, Math.round(sourceWidth / JADE_WORLD_PROJECTION_ASPECT)))
        : plan.crop
      const sourceYRange = Math.max(0, source.height - sourceHeight)
      const sourceY = authoredTerrain ? random() * sourceYRange : plan.sy
      ctx.save()
      ctx.translate(plan.flipX ? width : 0, plan.flipY ? height : 0)
      ctx.scale(plan.flipX ? -1 : 1, plan.flipY ? -1 : 1)
      ctx.drawImage(source, plan.sx, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)
      ctx.restore()
    }

    if (!authoredTerrain) {
      const terrain = stageId === 'ember'
        ? {
            wash: 'rgba(66,39,31,.34)', center: 'rgba(92,52,38,.34)', mid: 'rgba(92,52,38,.18)',
            edge: 'rgba(92,52,38,0)', blade: 'rgba(172,91,51,.24)',
          }
        : stageId === 'frost'
          ? {
              wash: 'rgba(70,82,111,.3)', center: 'rgba(111,130,158,.32)', mid: 'rgba(111,130,158,.17)',
              edge: 'rgba(111,130,158,0)', blade: 'rgba(199,226,243,.26)',
            }
          : {
              wash: 'rgba(22,57,49,.34)', center: 'rgba(37,83,69,.36)', mid: 'rgba(37,83,69,.2)',
              edge: 'rgba(37,83,69,0)', blade: 'rgba(104,177,140,.4)',
            }

      // The stage is an environment, not a colour filter over the same dungeon.
      // Ember turns the paving to ash and frost leaves wind-scoured snow. Large
      // feathered islands keep neighbouring chunks from exposing hard seams.
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = terrain.wash
      ctx.fillRect(0, 0, width, height)
      const patchCount = 8
      const terrainPatches = []
      for (let i = 0; i < patchCount; i++) {
        const x = random() * width
        const y = random() * height
        const rx = 110 + random() * 220
        const ry = 80 + random() * 170
        terrainPatches.push({ x, y, rx, ry })
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, rx)
        gradient.addColorStop(0, terrain.center)
        gradient.addColorStop(0.58, terrain.mid)
        gradient.addColorStop(1, terrain.edge)
        ctx.fillStyle = gradient
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(1, ry / rx)
        ctx.beginPath()
        ctx.arc(0, 0, rx, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      ctx.strokeStyle = terrain.blade
      ctx.lineWidth = stageId === 'jade' ? 2.1 : 1.4
      const bladeCount = stageId === 'jade' ? 220 : 120
      for (let i = 0; i < bladeCount; i++) {
        const patch = terrainPatches[i % terrainPatches.length]
        const angle = random() * Math.PI * 2
        const distance = Math.sqrt(random()) * 0.78
        const x = patch.x + Math.cos(angle) * patch.rx * distance
        const y = patch.y + Math.sin(angle) * patch.ry * distance
        const length = (stageId === 'jade' ? 10 : 4) + random() * (stageId === 'jade' ? 18 : 10)
        const blades = stageId === 'jade' && i % 3 === 0 ? 3 : 1
        for (let n = 0; n < blades; n++) {
          const spread = (n - (blades - 1) * 0.5) * 4
          ctx.beginPath()
          ctx.moveTo(x + spread, y)
          ctx.quadraticCurveTo(x + spread + length * 0.35, y - length, x + spread + length, y - length * 0.72)
          ctx.stroke()
        }
      }
    }

    if (!authoredTerrain) {
      // Procedural-only stages receive seeded wear and sparse landmarks. The
      // authored jade material already carries stone/moss detail, so adding
      // these lines on top made the arena read as a giant UI diagram.
      ctx.globalCompositeOperation = 'multiply'
      for (let i = 0; i < 9; i++) {
        const x = random() * width
        const y = random() * height
        const radius = 70 + random() * 170
        const moss = i % 3 === 0
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, moss ? 'rgba(31,78,63,.34)' : 'rgba(4,10,17,.3)')
        gradient.addColorStop(1, 'rgba(12,20,26,0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'screen'
      ctx.lineCap = 'round'
      for (let i = 0; i < 18; i++) {
        let x = 20 + random() * (width - 40)
        let y = 20 + random() * (height - 40)
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(76,168,140,.12)' : 'rgba(158,193,202,.08)'
        ctx.lineWidth = 0.7 + random() * 1.5
        ctx.beginPath()
        ctx.moveTo(x, y)
        for (let n = 0; n < 4; n++) {
          x += (random() - 0.5) * 80
          y += (random() - 0.5) * 80
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      if (seed % 4 === 0) {
        ctx.strokeStyle = 'rgba(52,127,105,.12)'
        ctx.lineWidth = 38
        ctx.beginPath()
        ctx.moveTo(-40, height * (0.28 + random() * 0.3))
        ctx.bezierCurveTo(width * 0.3, height * 0.1, width * 0.58, height * 0.86, width + 40, height * 0.58)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(137,212,187,.1)'
        ctx.lineWidth = 3
        ctx.stroke()
      }
      if (seed % 5 === 0 || seed % 7 === 0) drawBrokenTerrainMotif(ctx, random, width, height, seed)
    }
    // The authored material is an irregular detail island, not a softened
    // square plate. Six overlapping alpha lobes expose the continuous macro
    // base between stone/moss fragments, breaking the screenshot-grid read.
    ctx.globalCompositeOperation = 'destination-in'
    if (authoredTerrain) {
      const mask = document.createElement('canvas')
      mask.width = width
      mask.height = height
      const maskCtx = mask.getContext('2d')
      maskCtx.clearRect(0, 0, width, height)
      // Preserve a continuous low-opacity material bed inside every region.
      // Earlier all-or-nothing lobes exposed huge empty macro areas and made
      // the remaining stone patches look like floating islands.
      maskCtx.fillStyle = 'rgba(255,255,255,.4)'
      maskCtx.fillRect(0, 0, width, height)
      maskCtx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 6; i++) {
        const column = i % 3
        const row = Math.floor(i / 3)
        const x = width * ((column + 0.5) / 3) + (random() - 0.5) * 82
        const y = height * ((row + 0.5) / 2) + (random() - 0.5) * 96
        const rx = 128 + random() * 92
        const ry = 102 + random() * 82
        const gradient = maskCtx.createRadialGradient(x, y, 4, x, y, rx)
        gradient.addColorStop(0, 'rgba(255,255,255,.96)')
        gradient.addColorStop(0.5, 'rgba(255,255,255,.82)')
        gradient.addColorStop(0.78, 'rgba(255,255,255,.34)')
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        maskCtx.fillStyle = gradient
        maskCtx.save()
        maskCtx.translate(x, y)
        maskCtx.scale(1, ry / rx)
        maskCtx.beginPath()
        maskCtx.arc(0, 0, rx, 0, Math.PI * 2)
        maskCtx.fill()
        maskCtx.restore()
      }
      maskCtx.globalCompositeOperation = 'source-over'
      ctx.drawImage(mask, 0, 0)
    }
    // Fade all four borders into the shared base so neighbouring variants
    // cannot reveal square seams while the camera moves.
    const feather = authoredTerrain ? JADE_DECAL_EDGE_FEATHER : 30
    for (const [x0, y0, x1, y1, stops] of [
      [0, 0, feather, 0, [[0, 0], [1, 1]]],
      [width, 0, width - feather, 0, [[0, 0], [1, 1]]],
      [0, 0, 0, feather, [[0, 0], [1, 1]]],
      [0, height, 0, height - feather, [[0, 0], [1, 1]]],
    ]) {
      const mask = ctx.createLinearGradient(x0, y0, x1, y1)
      for (const [offset, alpha] of stops) mask.addColorStop(offset, `rgba(255,255,255,${alpha})`)
      ctx.fillStyle = mask
      ctx.fillRect(0, 0, width, height)
    }
    ctx.globalCompositeOperation = 'source-over'
    const shade = ctx.createLinearGradient(0, 0, 0, height)
    shade.addColorStop(0, 'rgba(12,24,31,.02)')
    shade.addColorStop(1, 'rgba(2,8,13,.13)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, width, height)
  })
}

/**
 * Transparent, world-anchored macro detail for the jade arena.
 *
 * The authored 1254px ground material is intentionally kept as one continuous
 * panning surface so it never exposes square crop seams. On its own, however,
 * it still reads as a single photograph sliding under the actors. These soft
 * decals give every streamed map chunk different moss beds, weathered paths,
 * mineral seams and the occasional broken formation mark. They contain no
 * opaque base pixels and feather to zero on every edge, so neighbouring chunks
 * can overlap without rebuilding the old tiled-photo grid.
 */
function jadeGroundDetailTexture(seed) {
  return canvasTexture(512, 512, (ctx, width, height) => {
    let state = (seed * 0x9e3779b1) >>> 0
    const random = () => {
      state = (Math.imul(state ^ (state >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0
      return state / 4294967296
    }

    ctx.clearRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'

    // Broad islands alter the macro value structure without hiding the
    // material's authored paving and grass detail.
    for (let i = 0; i < 7; i++) {
      const x = 48 + random() * (width - 96)
      const y = 48 + random() * (height - 96)
      const rx = 90 + random() * 165
      const ry = 56 + random() * 112
      const dark = i % 3 !== 0
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, rx)
      // The source material already carries fine texture; these broad,
      // feathered value islands are the low-cost macro break that keeps the
      // arena from reading as a flat photograph while remaining below combat
      // telegraphs and actor silhouettes.
      gradient.addColorStop(0, dark ? 'rgba(3,12,16,.32)' : 'rgba(35,92,72,.27)')
      gradient.addColorStop(0.56, dark ? 'rgba(8,22,25,.18)' : 'rgba(45,112,86,.13)')
      gradient.addColorStop(1, 'rgba(4,16,19,0)')
      ctx.fillStyle = gradient
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(1, ry / rx)
      ctx.beginPath()
      ctx.arc(0, 0, rx, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Broken mineral seams make camera travel legible. Their low opacity keeps
    // them below hostile telegraphs and pickup silhouettes.
    ctx.lineCap = 'round'
    for (let i = 0; i < 11; i++) {
      let x = 40 + random() * (width - 80)
      let y = 40 + random() * (height - 80)
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(91,192,156,.13)' : 'rgba(137,177,180,.08)'
      ctx.lineWidth = 0.8 + random() * 2.2
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let n = 0; n < 5; n++) {
        x += (random() - 0.5) * 76
        y += (random() - 0.5) * 58
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    if (seed % 3 === 0) {
      const y = height * (0.3 + random() * 0.4)
      ctx.strokeStyle = 'rgba(4,15,18,.17)'
      ctx.lineWidth = 46
      ctx.beginPath()
      ctx.moveTo(-52, y)
      ctx.bezierCurveTo(width * 0.28, y - 90, width * 0.68, y + 105, width + 52, y - 28)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(103,174,145,.07)'
      ctx.lineWidth = 4
      ctx.stroke()
    }

    if (seed % 5 === 0) {
      ctx.save()
      ctx.translate(width * (0.34 + random() * 0.32), height * (0.34 + random() * 0.32))
      ctx.rotate(random() * Math.PI)
      ctx.strokeStyle = 'rgba(112,213,180,.11)'
      ctx.lineWidth = 3
      for (const radius of [44, 78]) {
        ctx.beginPath()
        ctx.arc(0, 0, radius, 0.22, Math.PI * 1.72)
        ctx.stroke()
      }
      ctx.restore()
    }

    // A wide feather guarantees there is no first visible row or square edge.
    ctx.globalCompositeOperation = 'destination-in'
    const feather = 78
    for (const [x0, y0, x1, y1] of [
      [0, 0, feather, 0], [width, 0, width - feather, 0],
      [0, 0, 0, feather], [0, height, 0, height - feather],
    ]) {
      const mask = ctx.createLinearGradient(x0, y0, x1, y1)
      mask.addColorStop(0, 'rgba(255,255,255,0)')
      mask.addColorStop(1, 'rgba(255,255,255,1)')
      ctx.fillStyle = mask
      ctx.fillRect(0, 0, width, height)
    }
    ctx.globalCompositeOperation = 'source-over'
  })
}

/**
 * Build one continuous periodic material field from several generated-material
 * crops. Each island is softly masked, rotated and copied across opposite
 * borders, so the final texture wraps without exposing the source as a single
 * plate or recreating square streamed-chunk bands.
 */
function composedJadeGroundTexture(source, size = JADE_GROUND_COMPOSITION_2D.synthesisSize) {
  return canvasTexture(size, size, (ctx, width, height) => {
    let state = 0x8a31d5e7
    const random = () => {
      state = (Math.imul(state ^ (state >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0
      return state / 4294967296
    }
    const wrappedOffsets = [-1, 0, 1]

    ctx.fillStyle = '#20373a'
    ctx.fillRect(0, 0, width, height)

    // Periodic low-frequency value structure keeps the material from feeling
    // uniformly airbrushed while preserving a calm combat-readability floor.
    for (let i = 0; i < 26; i++) {
      const x = random() * width
      const y = random() * height
      const radius = 150 + random() * 360
      const color = i % 3 === 0 ? 'rgba(5,17,22,.2)' : 'rgba(49,91,75,.22)'
      for (const ox of wrappedOffsets) {
        for (const oy of wrappedOffsets) {
          const px = x + ox * width
          const py = y + oy * height
          const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius)
          gradient.addColorStop(0, color)
          gradient.addColorStop(1, 'rgba(9,23,26,0)')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(px, py, radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    for (let i = 0; i < 16; i++) {
      const patch = document.createElement('canvas')
      patch.width = 512
      patch.height = 512
      const patchCtx = patch.getContext('2d')
      const plan = jadeGroundCropPlan2D(i + 31, source.width, source.height)
      patchCtx.save()
      patchCtx.translate(plan.flipX ? patch.width : 0, plan.flipY ? patch.height : 0)
      patchCtx.scale(plan.flipX ? -1 : 1, plan.flipY ? -1 : 1)
      patchCtx.drawImage(source, plan.sx, plan.sy, plan.crop, plan.crop, 0, 0, patch.width, patch.height)
      patchCtx.restore()
      patchCtx.fillStyle = 'rgba(6,24,24,.14)'
      patchCtx.fillRect(0, 0, patch.width, patch.height)

      patchCtx.globalCompositeOperation = 'destination-in'
      const mask = patchCtx.createRadialGradient(256, 256, 42, 256, 256, 250)
      mask.addColorStop(0, 'rgba(255,255,255,.96)')
      mask.addColorStop(0.58, 'rgba(255,255,255,.82)')
      mask.addColorStop(0.82, 'rgba(255,255,255,.34)')
      mask.addColorStop(1, 'rgba(255,255,255,0)')
      patchCtx.fillStyle = mask
      patchCtx.fillRect(0, 0, patch.width, patch.height)
      patchCtx.globalCompositeOperation = 'source-over'

      const column = i % 4
      const row = Math.floor(i / 4)
      const x = width * ((column + 0.5) / 4) + (random() - 0.5) * 150
      const y = height * ((row + 0.5) / 4) + (random() - 0.5) * 150
      const patchSize = 600 + random() * 180
      const rotation = (random() - 0.5) * 0.72
      for (const ox of wrappedOffsets) {
        for (const oy of wrappedOffsets) {
          ctx.save()
          ctx.translate(x + ox * width, y + oy * height)
          ctx.rotate(rotation)
          ctx.globalAlpha = 0.56
          ctx.drawImage(patch, -patchSize * 0.5, -patchSize * 0.5, patchSize, patchSize)
          ctx.restore()
        }
      }
    }

    // Small material flecks provide scale without competing with enemies.
    ctx.lineCap = 'round'
    for (let i = 0; i < 180; i++) {
      const x = random() * width
      const y = random() * height
      const length = 3 + random() * 12
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(93,168,137,.13)' : 'rgba(155,178,169,.07)'
      ctx.lineWidth = 0.7 + random() * 1.4
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + length, y - length * (0.25 + random() * 0.35))
      ctx.stroke()
    }
  })
}

function macroGroundTexture(stageId = 'jade') {
  return canvasTexture(1024, 1024, (ctx, width, height) => {
    let state = stageId === 'ember' ? 0xe6b04a11 : stageId === 'frost' ? 0xf2057a31 : 0x51f15e
    const random = () => {
      state = (Math.imul(state ^ (state >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0
      return state / 4294967296
    }
    const palette = stageId === 'ember'
      ? { base: '#241a19', light: 'rgba(91,52,38,.34)', dark: 'rgba(7,8,12,.34)', line: 'rgba(184,88,49,.09)' }
      : stageId === 'frost'
        ? { base: '#18212e', light: 'rgba(90,114,146,.3)', dark: 'rgba(7,11,19,.36)', line: 'rgba(178,218,242,.08)' }
        : { base: '#20383b', light: 'rgba(64,111,94,.4)', dark: 'rgba(8,17,23,.16)', line: 'rgba(105,177,150,0)' }
    ctx.fillStyle = palette.base
    ctx.fillRect(0, 0, width, height)

    // Low-frequency value islands establish large geography without carrying
    // any recognisable repeated photograph or paving grid.
    for (let i = 0; i < 34; i++) {
      const x = random() * width
      const y = random() * height
      const radius = 120 + random() * 330
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, i % 3 === 0 ? palette.dark : palette.light)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    if (stageId !== 'jade') {
      ctx.strokeStyle = palette.line
      ctx.lineCap = 'round'
      for (let i = 0; i < 42; i++) {
        let x = random() * width
        let y = random() * height
        ctx.lineWidth = 0.8 + random() * 2.2
        ctx.beginPath()
        ctx.moveTo(x, y)
        for (let n = 0; n < 5; n++) {
          x += (random() - 0.5) * 130
          y += (random() - 0.5) * 130
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }

    if (stageId === 'jade') {
      // Fine, directionally consistent mineral and grass marks stop the base
      // from reading as a flat colour wash wherever feathered decals overlap.
      // They are procedural and low contrast, so no landmark can visibly tile.
      ctx.lineCap = 'round'
      for (let i = 0; i < 360; i++) {
        const x = random() * width
        const y = random() * height
        const length = 3 + random() * 10
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(102,171,142,.11)' : 'rgba(121,157,164,.065)'
        ctx.lineWidth = 0.5 + random() * 1.1
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.quadraticCurveTo(x + length * 0.2, y - length, x + length, y - length * 0.68)
        ctx.stroke()
      }
    }

    const shade = ctx.createLinearGradient(0, 0, 0, height)
    shade.addColorStop(0, 'rgba(3,8,13,.1)')
    shade.addColorStop(0.52, 'rgba(15,29,33,0)')
    shade.addColorStop(1, 'rgba(2,6,10,.18)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, width, height)
  })
}

export const TERRAIN_GRADE_2D = Object.freeze({
  alpha: 0.46,
  edgeVignetteAlpha: 0.28,
  topDepthAlpha: 0.12,
  bottomDepthAlpha: 0.06,
})

function terrainGradeTexture() {
  return canvasTexture(512, 512, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height)
    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.54, width * 0.08, width * 0.5, height * 0.54, width * 0.72)
    vignette.addColorStop(0, 'rgba(18,42,43,0)')
    vignette.addColorStop(0.56, 'rgba(5,17,22,.035)')
    vignette.addColorStop(1, `rgba(1,7,11,${TERRAIN_GRADE_2D.edgeVignetteAlpha})`)
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, width, height)
    const depth = ctx.createLinearGradient(0, 0, 0, height)
    depth.addColorStop(0, `rgba(7,18,24,${TERRAIN_GRADE_2D.topDepthAlpha})`)
    depth.addColorStop(0.36, 'rgba(26,57,53,0)')
    depth.addColorStop(1, `rgba(2,8,12,${TERRAIN_GRADE_2D.bottomDepthAlpha})`)
    ctx.fillStyle = depth
    ctx.fillRect(0, 0, width, height)
  })
}

function contactLightTexture() {
  return canvasTexture(128, 64, (ctx, width, height) => {
    const glow = ctx.createRadialGradient(width * 0.5, height * 0.52, 1, width * 0.5, height * 0.52, width * 0.47)
    glow.addColorStop(0, 'rgba(255,255,255,.42)')
    glow.addColorStop(0.42, 'rgba(255,255,255,.2)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)
  })
}

function shadowTexture() {
  return canvasTexture(96, 48, (ctx) => {
    const gradient = ctx.createRadialGradient(48, 24, 2, 48, 24, 45)
    gradient.addColorStop(0, 'rgba(0,0,0,.58)')
    gradient.addColorStop(0.6, 'rgba(0,0,0,.3)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 96, 48)
  })
}

function swordTexture() {
  return canvasTexture(96, 24, (ctx) => {
    const gradient = ctx.createLinearGradient(4, 12, 92, 12)
    gradient.addColorStop(0, 'rgba(130,207,255,0)')
    gradient.addColorStop(0.18, '#93d8ff')
    gradient.addColorStop(0.78, '#f7fdff')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.strokeStyle = gradient
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(5, 12)
    ctx.lineTo(88, 12)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.9)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(32, 10)
    ctx.lineTo(88, 12)
    ctx.lineTo(32, 14)
    ctx.stroke()
  })
}

function projectileAtlasTexture() {
  const cell = 128
  const atlas = canvasTexture(cell * 7, cell, (ctx) => {
    const drawGlow = (x, y, color, radius = 30) => {
      const glow = ctx.createRadialGradient(x, y, 2, x, y, radius)
      glow.addColorStop(0, color)
      glow.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    const translate = (index) => {
      ctx.save()
      ctx.translate(index * cell + cell * 0.5, cell * 0.5)
    }
    const finish = () => ctx.restore()

    // sword: an unmistakable flying-sword silhouette: tapered trail, cyan
    // core, bright edge and a separated guard instead of a white streak.
    translate(0)
    drawGlow(0, 0, 'rgba(155,225,255,.34)', 42)
    ctx.fillStyle = 'rgba(77,193,255,.34)'
    ctx.beginPath()
    ctx.moveTo(-53, -8)
    ctx.lineTo(30, -5)
    ctx.lineTo(50, 0)
    ctx.lineTo(30, 5)
    ctx.lineTo(-53, 8)
    ctx.closePath()
    ctx.fill()
    const swordGradient = ctx.createLinearGradient(-49, 0, 49, 0)
    swordGradient.addColorStop(0, 'rgba(130,207,255,0)')
    swordGradient.addColorStop(0.22, '#93d8ff')
    swordGradient.addColorStop(0.8, '#f7fdff')
    swordGradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.strokeStyle = swordGradient
    ctx.lineCap = 'round'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(-48, 0)
    ctx.lineTo(46, 0)
    ctx.stroke()
    ctx.strokeStyle = '#c8f6ff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-35, 0)
    ctx.lineTo(42, 0)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.96)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-8, -4)
    ctx.lineTo(45, 0)
    ctx.lineTo(-8, 4)
    ctx.stroke()
    ctx.strokeStyle = '#b9eeff'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(-17, -9)
    ctx.lineTo(-17, 9)
    ctx.stroke()
    finish()

    // fire: a compact ember with a rising split flame.
    translate(1)
    drawGlow(0, 8, 'rgba(255,105,45,.48)', 38)
    ctx.fillStyle = '#ff7a43'
    ctx.beginPath()
    ctx.moveTo(-23, 22)
    ctx.bezierCurveTo(-36, 5, -17, -2, -10, -20)
    ctx.bezierCurveTo(-1, -10, 0, -2, 6, -15)
    ctx.bezierCurveTo(19, -3, 33, 3, 25, 22)
    ctx.bezierCurveTo(13, 34, -12, 34, -23, 22)
    ctx.fill()
    ctx.fillStyle = '#ffe6a4'
    ctx.beginPath()
    ctx.moveTo(-11, 18)
    ctx.bezierCurveTo(-15, 7, -4, 3, 0, -8)
    ctx.bezierCurveTo(8, 3, 14, 8, 10, 18)
    ctx.bezierCurveTo(5, 24, -5, 24, -11, 18)
    ctx.fill()
    finish()

    // ice: a long diamond shard with two cold facets.
    translate(2)
    drawGlow(0, 0, 'rgba(126,224,255,.32)', 42)
    ctx.fillStyle = '#8edcff'
    ctx.strokeStyle = '#e7fbff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-49, 0)
    ctx.lineTo(-17, -16)
    ctx.lineTo(47, 0)
    ctx.lineTo(-17, 16)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(239,255,255,.82)'
    ctx.beginPath()
    ctx.moveTo(-17, -16)
    ctx.lineTo(47, 0)
    ctx.lineTo(-17, 0)
    ctx.closePath()
    ctx.fill()
    finish()

    // thunder: a jagged bolt, intentionally diagonally biased.
    translate(3)
    drawGlow(0, 0, 'rgba(185,140,255,.38)', 42)
    ctx.strokeStyle = '#e9ddff'
    ctx.lineWidth = 8
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(-45, -19)
    ctx.lineTo(-7, -19)
    ctx.lineTo(-28, 2)
    ctx.lineTo(10, 2)
    ctx.lineTo(-15, 28)
    ctx.stroke()
    ctx.strokeStyle = '#a979ff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-42, -18)
    ctx.lineTo(-6, -18)
    ctx.lineTo(-27, 3)
    ctx.lineTo(10, 3)
    ctx.lineTo(-14, 27)
    ctx.stroke()
    finish()

    // void: a rotating sigil for the friendly fifth kind (hostile kind 5 is
    // kept on its separate wisp pool and never enters this atlas).
    translate(4)
    drawGlow(0, 0, 'rgba(126,99,199,.42)', 43)
    ctx.strokeStyle = '#bda8ff'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, 28, 0, Math.PI * 2)
    ctx.stroke()
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = '#765cc0'
    ctx.lineWidth = 3
    ctx.strokeRect(-18, -18, 36, 36)
    ctx.fillStyle = '#efe7ff'
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, Math.PI * 2)
    ctx.fill()
    finish()

    // needle: the narrow gold projectile must read as a precise line at scale.
    translate(5)
    drawGlow(0, 0, 'rgba(246,216,138,.24)', 34)
    ctx.strokeStyle = '#fff2ba'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-53, 0)
    ctx.lineTo(48, 0)
    ctx.stroke()
    ctx.fillStyle = '#f6d88a'
    ctx.beginPath()
    ctx.moveTo(49, 0)
    ctx.lineTo(34, -8)
    ctx.lineTo(39, 0)
    ctx.lineTo(34, 8)
    ctx.closePath()
    ctx.fill()
    finish()

    // wind: three offset crescent strokes, wider and more rotational than a
    // blade while still sharing the same direction-facing atlas cell.
    translate(6)
    drawGlow(0, 0, 'rgba(119,239,207,.28)', 42)
    ctx.strokeStyle = '#b9fff0'
    ctx.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = 5 - i
      ctx.beginPath()
      ctx.arc(-5 + i * 5, 0, 38 - i * 8, -0.75, 0.72)
      ctx.stroke()
    }
    finish()
  })
  const frames = []
  for (let index = 0; index < 7; index++) {
    frames.push(new Texture({
      source: atlas.source,
      frame: new Rectangle(index * cell, 0, cell, cell),
    }))
  }
  return { atlas, frames }
}

function hostileProjectileAtlasTexture() {
  const cell = 128
  const atlas = canvasTexture(cell * 4, cell, (ctx) => {
    const glow = (x, y, color, radius = 38) => {
      const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, 'rgba(20,8,38,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    const translate = (index) => {
      ctx.save()
      ctx.translate(index * cell + cell * 0.5, cell * 0.5)
    }
    const finish = () => ctx.restore()

    // lance: a red-violet arrowhead with a dark spine, never confused with a
    // friendly cyan sword or the wisp's circular body.
    translate(0)
    glow(0, 0, 'rgba(255,74,111,.42)', 44)
    ctx.fillStyle = '#7d214d'
    ctx.beginPath()
    ctx.moveTo(-53, -8)
    ctx.lineTo(30, -5)
    ctx.lineTo(51, 0)
    ctx.lineTo(30, 5)
    ctx.lineTo(-53, 8)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ff8096'
    ctx.beginPath()
    ctx.moveTo(-45, -3)
    ctx.lineTo(45, 0)
    ctx.lineTo(-45, 3)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#ffd0da'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(10, -4)
    ctx.lineTo(51, 0)
    ctx.lineTo(10, 4)
    ctx.stroke()
    finish()

    // orb: a compact hostile core with a broken warning ring.
    translate(1)
    glow(0, 0, 'rgba(197,90,255,.48)', 44)
    const orb = ctx.createRadialGradient(-8, -8, 2, 0, 0, 29)
    orb.addColorStop(0, '#fff1ff')
    orb.addColorStop(0.24, '#e98cff')
    orb.addColorStop(0.7, '#8a3fbd')
    orb.addColorStop(1, '#321543')
    ctx.fillStyle = orb
    ctx.beginPath()
    ctx.arc(0, 0, 25, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffc8ff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, 35, -0.92, 1.04)
    ctx.stroke()
    ctx.strokeStyle = '#5e2b93'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, 35, 1.42, 2.48)
    ctx.stroke()
    finish()

    // shard: an asymmetric thorn that points along travel and reads at small
    // scale even when its tint is mixed with a boss pattern colour.
    translate(2)
    glow(0, 0, 'rgba(255,84,170,.38)', 44)
    ctx.fillStyle = '#7b235f'
    ctx.beginPath()
    ctx.moveTo(-49, 0)
    ctx.lineTo(-20, -18)
    ctx.lineTo(-8, -5)
    ctx.lineTo(34, -26)
    ctx.lineTo(21, 0)
    ctx.lineTo(42, 12)
    ctx.lineTo(-11, 8)
    ctx.lineTo(-22, 23)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ff94cc'
    ctx.beginPath()
    ctx.moveTo(-38, 0)
    ctx.lineTo(-18, -10)
    ctx.lineTo(27, -18)
    ctx.lineTo(16, 0)
    ctx.closePath()
    ctx.fill()
    finish()

    // sigil: a rotating warning ring with four teeth, not a soft enemy orb.
    translate(3)
    glow(0, 0, 'rgba(126,118,255,.42)', 44)
    ctx.strokeStyle = '#d7d0ff'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, 27, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = '#6b57d2'
    ctx.lineWidth = 5
    for (let index = 0; index < 4; index++) {
      ctx.save()
      ctx.rotate(index * Math.PI * 0.5 + Math.PI * 0.25)
      ctx.beginPath()
      ctx.moveTo(25, 0)
      ctx.lineTo(45, -7)
      ctx.lineTo(38, 0)
      ctx.lineTo(45, 7)
      ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = '#fff3ff'
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    ctx.fill()
    finish()
  })
  const frames = []
  for (let index = 0; index < 4; index++) {
    frames.push(new Texture({
      source: atlas.source,
      frame: new Rectangle(index * cell, 0, cell, cell),
    }))
  }
  return { atlas, frames }
}

function weaponFieldAtlasTexture() {
  const cellWidth = 192
  const cellHeight = 96
  const colors = [
    ['rgba(224,255,249,.42)', 'rgba(115,224,190,.16)', 'rgba(235,255,249,.78)'],
    ['rgba(255,184,91,.46)', 'rgba(255,94,48,.18)', 'rgba(255,236,166,.82)'],
    ['rgba(145,255,183,.4)', 'rgba(62,185,114,.16)', 'rgba(203,255,213,.72)'],
    ['rgba(198,173,255,.44)', 'rgba(93,61,177,.18)', 'rgba(239,229,255,.82)'],
    ['rgba(246,216,138,.4)', 'rgba(155,111,43,.15)', 'rgba(255,246,196,.82)'],
    ['rgba(155,255,231,.4)', 'rgba(47,173,160,.15)', 'rgba(220,255,248,.82)'],
    ['rgba(213,185,255,.46)', 'rgba(106,77,206,.17)', 'rgba(246,235,255,.86)'],
    ['rgba(210,226,255,.44)', 'rgba(87,116,188,.17)', 'rgba(239,246,255,.86)'],
  ]
  const atlas = canvasTexture(cellWidth * colors.length, cellHeight, (ctx) => {
    for (let frame = 0; frame < colors.length; frame++) {
      const [inner, outer, line] = colors[frame]
      ctx.save()
      ctx.translate(frame * cellWidth + cellWidth * 0.5, cellHeight * 0.5)
      const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 88)
      glow.addColorStop(0, inner)
      glow.addColorStop(0.48, outer)
      glow.addColorStop(1, 'rgba(82,126,184,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.ellipse(0, 0, 88, 40, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = line
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(0, 0, 79, 31, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = outer
      ctx.lineWidth = 1.5
      for (const radius of [24, 49, 68]) {
        ctx.beginPath()
        ctx.ellipse(0, 0, radius, radius * 0.42, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.strokeStyle = line
      ctx.fillStyle = line
      if (frame === 0) {
        for (let index = 0; index < 8; index++) {
          ctx.save()
          ctx.rotate((Math.PI * 2 * index) / 8)
          ctx.beginPath()
          ctx.moveTo(73, 0)
          ctx.lineTo(60, -4)
          ctx.lineTo(64, 0)
          ctx.lineTo(60, 4)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      } else if (frame === 1) {
        for (let index = 0; index < 5; index++) {
          ctx.save()
          ctx.rotate((index - 2) * 0.22)
          ctx.beginPath()
          ctx.moveTo(0, -9)
          ctx.lineTo(23 + index * 4, 22)
          ctx.lineTo(0, 15)
          ctx.lineTo(-23 - index * 4, 22)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      } else if (frame === 2) {
        for (let index = 0; index < 10; index++) {
          const angle = (Math.PI * 2 * index) / 10
          ctx.beginPath()
          ctx.arc(Math.cos(angle) * 57, Math.sin(angle) * 22, 4 + (index % 3), 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (frame === 3) {
        ctx.save()
        ctx.rotate(Math.PI / 4)
        ctx.strokeRect(-22, -22, 44, 44)
        ctx.fillRect(-5, -5, 10, 10)
        ctx.restore()
      } else if (frame === 4) {
        for (let index = 0; index < 12; index++) {
          ctx.save()
          ctx.rotate((Math.PI * 2 * index) / 12)
          ctx.fillRect(53, -2, 21, 4)
          ctx.restore()
        }
      } else if (frame === 5) {
        ctx.lineWidth = 3
        for (let index = 0; index < 3; index++) {
          ctx.beginPath()
          ctx.arc(-16 + index * 16, 0, 30 - index * 5, -0.9, 0.9)
          ctx.stroke()
        }
      } else if (frame === 6) {
        for (let index = 0; index < 3; index++) {
          ctx.beginPath()
          ctx.ellipse(0, 0, 28 + index * 15, 12 + index * 5, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      } else {
        ctx.lineWidth = 3
        for (let index = 0; index < 4; index++) {
          ctx.save()
          ctx.rotate((index - 1.5) * 0.34)
          ctx.beginPath()
          ctx.moveTo(-12, -24)
          ctx.lineTo(7, -4)
          ctx.lineTo(-8, 8)
          ctx.lineTo(17, 28)
          ctx.stroke()
          ctx.restore()
        }
      }
      ctx.restore()
    }
  })
  const frames = []
  for (let frame = 0; frame < colors.length; frame++) {
    frames.push(new Texture({
      source: atlas.source,
      frame: new Rectangle(frame * cellWidth, 0, cellWidth, cellHeight),
    }))
  }
  return { atlas, frames }
}

function weaponFieldWallTexture() {
  return canvasTexture(256, 96, (ctx, width, height) => {
    const glow = ctx.createLinearGradient(0, height * 0.5, width, height * 0.5)
    glow.addColorStop(0, 'rgba(91,211,255,0)')
    glow.addColorStop(0.18, 'rgba(104,220,255,.26)')
    glow.addColorStop(0.5, 'rgba(210,252,255,.54)')
    glow.addColorStop(0.82, 'rgba(104,220,255,.26)')
    glow.addColorStop(1, 'rgba(91,211,255,0)')
    ctx.strokeStyle = glow
    ctx.lineCap = 'round'
    ctx.lineWidth = 24
    ctx.beginPath()
    ctx.moveTo(8, height * 0.56)
    ctx.lineTo(width - 8, height * 0.56)
    ctx.stroke()

    // A row of translucent ice shards gives the segment a physical edge. The
    // sprite is rotated by the world-space endpoints at render time.
    for (let index = 0; index < 8; index++) {
      const x = 13 + index * 33
      const top = 12 + (index % 3) * 5
      const bottom = 82 - ((index + 1) % 3) * 4
      ctx.fillStyle = index % 2 ? 'rgba(112,220,255,.58)' : 'rgba(214,250,255,.72)'
      ctx.beginPath()
      ctx.moveTo(x - 15, bottom)
      ctx.lineTo(x - 7, top + 14)
      ctx.lineTo(x + 2, top)
      ctx.lineTo(x + 9, top + 20)
      ctx.lineTo(x + 16, bottom)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(237,255,255,.82)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x + 2, top)
      ctx.lineTo(x + 4, bottom - 5)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(238,255,255,.92)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(8, height * 0.56)
    ctx.lineTo(width - 8, height * 0.56)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(91,199,255,.78)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(8, height * 0.66)
    ctx.lineTo(width - 8, height * 0.66)
    ctx.stroke()
  })
}

function pickupTexture() {
  return canvasTexture(48, 48, (ctx) => {
    ctx.translate(24, 24)
    ctx.rotate(Math.PI / 4)
    const gradient = ctx.createLinearGradient(-10, -10, 10, 10)
    gradient.addColorStop(0, '#f1fcff')
    gradient.addColorStop(0.45, '#7bd9f0')
    gradient.addColorStop(1, '#2c7790')
    ctx.fillStyle = gradient
    ctx.strokeStyle = 'rgba(220,255,245,.9)'
    ctx.lineWidth = 2
    ctx.fillRect(-10, -10, 20, 20)
    ctx.strokeRect(-10, -10, 20, 20)
  })
}

function ringTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.translate(64, 64)
    for (const [radius, alpha, line] of [[48, 0.9, 3], [37, 0.45, 1], [25, 0.3, 1]]) {
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`
      ctx.lineWidth = line
      ctx.stroke()
    }
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = 'rgba(255,255,255,.65)'
      ctx.fillRect(44, -2, 9, 4)
    }
  })
}

function bossTelegraphTexture() {
  return canvasTexture(256, 256, (ctx) => {
    ctx.translate(128, 128)
    const fill = ctx.createRadialGradient(0, 0, 12, 0, 0, 118)
    fill.addColorStop(0, 'rgba(255,255,255,.18)')
    fill.addColorStop(0.56, 'rgba(255,255,255,.1)')
    fill.addColorStop(0.86, 'rgba(255,255,255,.035)')
    fill.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(0, 0, 118, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineCap = 'round'
    ctx.setLineDash([14, 10])
    for (const [radius, alpha, width] of [[111, 0.88, 4], [83, 0.5, 2], [48, 0.34, 2]]) {
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`
      ctx.lineWidth = width
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(255,255,255,.48)'
    ctx.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * 88, Math.sin(angle) * 88)
      ctx.lineTo(Math.cos(angle) * 116, Math.sin(angle) * 116)
      ctx.stroke()
    }
  })
}

function floorRuneTexture() {
  return canvasTexture(1024, 1024, (ctx) => {
    ctx.translate(512, 512)
    ctx.strokeStyle = 'rgba(116,224,190,.18)'
    ctx.lineWidth = 3
    for (const radius of [120, 220, 360, 470]) {
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(157,214,255,.12)'
    ctx.lineWidth = 2
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6)
      ctx.beginPath()
      ctx.moveTo(122, 0)
      ctx.lineTo(468, 0)
      ctx.stroke()
    }
  })
}

function stoneFallbackTexture() {
  return canvasTexture(192, 192, (ctx) => {
    ctx.fillStyle = '#172833'
    ctx.fillRect(0, 0, 192, 192)
    ctx.strokeStyle = 'rgba(145,185,196,.18)'
    ctx.lineWidth = 2
    for (let y = 0; y <= 192; y += 48) {
      const offset = (y / 48) % 2 ? 24 : 0
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(192, y)
      ctx.stroke()
      for (let x = offset; x <= 192; x += 48) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, Math.min(192, y + 48))
        ctx.stroke()
      }
    }
  })
}

function mountainTexture(color, mist, phase = 0) {
  return canvasTexture(1800, 520, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height)
    const drawRidge = (baseRatio, amplitude, alpha, offset) => {
      const count = 24
      const points = []
      for (let i = 0; i <= count; i++) {
        const x = (i / count) * width
        const ridge = Math.sin(i * 1.31 + offset) * amplitude * 0.32
          + Math.sin(i * 0.47 + offset * 1.7) * amplitude * 0.46
          + Math.sin(i * 2.17 + offset * 0.6) * amplitude * 0.12
        points.push({ x, y: height * baseRatio - ridge })
      }
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.filter = phase < 1 ? 'blur(4px)' : 'blur(2px)'
      ctx.beginPath()
      ctx.moveTo(0, height)
      ctx.lineTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        const previous = points[i - 1]
        const current = points[i]
        ctx.quadraticCurveTo(
          previous.x,
          previous.y,
          (previous.x + current.x) * 0.5,
          (previous.y + current.y) * 0.5,
        )
      }
      const last = points[points.length - 1]
      ctx.quadraticCurveTo(last.x, last.y, width, last.y)
      ctx.lineTo(width, height)
      ctx.closePath()
      const gradient = ctx.createLinearGradient(0, height * 0.26, 0, height)
      gradient.addColorStop(0, color)
      gradient.addColorStop(0.7, '#0d2027')
      gradient.addColorStop(1, '#071016')
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.restore()
    }
    drawRidge(0.64, 72, 0.42, phase + 1.3)
    drawRidge(0.53, 112, 0.88, phase)
    const haze = ctx.createLinearGradient(0, height * 0.25, 0, height)
    haze.addColorStop(0, 'rgba(120,182,177,0)')
    haze.addColorStop(0.58, mist)
    haze.addColorStop(1, 'rgba(6,13,18,0)')
    ctx.fillStyle = haze
    ctx.fillRect(0, 0, width, height)
  })
}

function sliceFrames(texture, definition) {
  const [columns, rows] = definition.sheet
  const [cellWidth, cellHeight] = definition.cell
  const frames = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      frames.push(new Texture({
        source: texture.source,
        frame: new Rectangle(column * cellWidth, row * cellHeight, cellWidth, cellHeight),
      }))
    }
  }
  return frames
}

function loopingFrameIndex(indices, time, fps, phase = 0) {
  const index = Math.floor(time * fps + phase) % indices.length
  return indices[index < 0 ? index + indices.length : index]
}

function loopingFrame(frames, indices, time, fps, phase = 0) {
  return frames[loopingFrameIndex(indices, time, fps, phase)]
}

function oneShotFrameIndex(indices, remaining, duration) {
  const progress = Math.max(0, Math.min(0.999, 1 - remaining / duration))
  return indices[Math.floor(progress * indices.length)]
}

export function enemyAttackPresentationDuration2D(def, behavior = 0) {
  if (behavior === 5) {
    return Math.max(0.34, (def?.chargeWindup ?? 0.24) + (def?.chargeTime ?? 0.42))
  }
  if (behavior === 7) return 0.2
  if (behavior === 1) return 0.34
  return 0.3
}

export function resolveEnemyIntentPresentation2D(
  target,
  attackTimer,
  contactIntentTimer,
  attackDuration,
) {
  const output = target ?? {}
  const attackRemaining = Math.max(0, Number(attackTimer) || 0)
  const contactRemaining = Math.max(0, Number(contactIntentTimer) || 0)
  if (attackRemaining > 0) {
    output.visible = true
    output.preContact = false
    output.remaining = attackRemaining
    output.duration = Math.max(0.01, Number(attackDuration) || 0.3)
    return output
  }
  output.visible = contactRemaining > 0
  output.preContact = contactRemaining > 0
  output.remaining = contactRemaining
  output.duration = CONTACT_INTENT_SECONDS_2D
  return output
}

function oneShotFrame(frames, indices, remaining, duration) {
  return frames[oneShotFrameIndex(indices, remaining, duration)]
}

function cover(sprite, width, height) {
  const textureWidth = Math.max(1, sprite.texture.width)
  const textureHeight = Math.max(1, sprite.texture.height)
  const scale = Math.max(width / textureWidth, height / textureHeight)
  sprite.scale.set(scale)
  sprite.position.set((width - textureWidth * scale) * 0.5, (height - textureHeight * scale) * 0.5)
}

function setHeight(sprite, height, mirror = false) {
  const scale = height / Math.max(1, sprite.texture.height)
  sprite.scale.set(mirror ? -scale : scale, scale)
}

function enemyTextureKey(id) {
  if (id === 'wisp') return 'wisp'
  if (id === 'talismanGhost' || id === 'snowWraith') return 'talismanRevenant'
  if (id === 'jadeSerpent') return 'jadeSerpent'
  if (id === 'stoneGhoul') return 'jadeStoneGhoul'
  if (id === 'bloodScorpion') return 'bloodScorpion'
  if (id === 'wolf' || id === 'frostWolf' || id === 'ashRaven') return 'yorang'
  if (id === 'demonCultivator' || id === 'magmaBrute' || id === 'glacierWarden') return 'voidSentinel'
  return 'wisp'
}

/**
 * Shared atlas silhouettes still need species identity. Keep authored texture
 * detail by mixing each enemy's palette toward white instead of applying a
 * dark full-strength multiply; wisps are already flat-color particles.
 */
export function enemyActorTint2D(color, textureKey = 'wisp', hitFlash = false) {
  if (hitFlash) return 0xffb6b6
  const source = Number.isFinite(color) ? (color >>> 0) : 0xffffff
  return textureKey === 'wisp' ? source : blendTint2D(source, 0xffffff, 0.64)
}

class ParticlePool {
  constructor(container, texture, maximum) {
    this.container = container
    this.texture = texture
    this.maximum = maximum
    this.items = []
    this.activeCount = 0
    this.container.texture = texture
  }

  ensure(count) {
    const target = Math.min(count, this.maximum)
    while (this.items.length < target) {
      const particle = new Particle({
        texture: this.texture, x: -9999, y: -9999, anchorX: 0.5, anchorY: 0.5,
        scaleX: 0, scaleY: 0, alpha: 0,
      })
      this.items.push(particle)
    }
  }

  setActiveCount(count) {
    const target = Math.max(0, Math.min(count, this.maximum))
    this.ensure(target)
    if (target > this.activeCount) {
      this.container.addParticle(...this.items.slice(this.activeCount, target))
    } else if (target < this.activeCount) {
      this.container.removeParticles(target, this.activeCount)
    }
    this.activeCount = target
  }

  hideFrom(index) {
    this.setActiveCount(index)
  }
}

export class PixiPresentation {
  constructor(canvas, quality) {
    this.canvas = canvas
    this.quality = quality
    this.app = null
    this.viewport = { width: 1, height: 1, zoom: 1 }
    this.cameraX = 0
    this.cameraZ = 0
    this.time = 0
    this.runActive = false
    this.lastRenderMs = 0
    this.drawCalls = 0
    this.triangles = 0
    this.backendLabel = 'PixiJS WebGL'
    this.gpuLabel = 'unknown'
    this.enemyPool = []
    this.effectPool = []
    this.weaponFieldPool = []
    this.propPool = []
    this.poiPool = []
    this.mapDecalPool = []
    this.mapDecalTextures = []
    this.damageTextPool = []
    this.damageTextCursor = 0
    this.damageTextSerial = 0
    this.activeMapChunkKey = ''
    this.mapSeed = 0x51f15e
    this._groundStageId = ''
    this.groundBaseTextures = null
    this.generatedFloorBase = null
    this._groundChunkAlpha = 0.9
    this._floorTileScale = { x: 1, y: 0.46 }
    this._combatHorizonY = 0
    this.frames = {}
    this._contextLost = false
    this._runAssetsReady = false
    this._runAssetsPromise = null
    this._countingDraws = false
    this._frameDrawCalls = 0
    this._frameTriangles = 0
    this._glMetricHandle = null
    this._destroyed = false
  }

  async init() {
    if (this._destroyed) return
    // The first paint needs only the sanctuary and the selected heroine. Enemy,
    // boss and material sheets wait until the player commits to a run, keeping
    // the title payload below the 5 MB delivery gate.
    await Assets.load([ENVIRONMENT_URL, SPRITE_MANIFEST.actors.seolryeong.portraitUrl])
    if (this._destroyed) return
    const probe = probeWebGLRenderer()
    const requestedBackend = new URLSearchParams(location.search).get('backend') ?? ''
    const backend = choosePixiBackend(probe.label, requestedBackend)
    const app = new Application()
    await app.init({
      canvas: this.canvas,
      autoStart: false,
      preference: backend,
      preferWebGLVersion: 2,
      antialias: false,
      autoDensity: true,
      resolution: this.quality.scale,
      background: '#04080d',
      powerPreference: 'high-performance',
      clearBeforeRender: true,
    })
    if (this._destroyed) {
      app.destroy(true, true)
      return
    }
    app.ticker.stop()
    this.app = app

    const gl = app.renderer.gl
    if (gl) {
      const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
      this.backendLabel = webgl2 ? 'PixiJS WebGL2' : 'PixiJS WebGL1'
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) this.gpuLabel = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'unknown'
      this._installDrawMetrics()
    } else {
      this.backendLabel = 'PixiJS Canvas2D (software WebGL fallback)'
      this.gpuLabel = probe.label
    }
    this.canvas.addEventListener('webglcontextlost', this._onContextLost = (event) => {
      event.preventDefault()
      this._contextLost = true
      this.onContextLost?.()
    })
    this.canvas.addEventListener('webglcontextrestored', this._onContextRestored = () => {
      this._contextLost = false
      this._installDrawMetrics()
      this.onContextRestored?.()
    })

    this._buildScene()
    this.resize()
    this.quality.onChange = (scale) => this.setResolution(scale)
  }

  _installDrawMetrics() {
    const gl = this.app?.renderer?.gl
    if (!gl || this._glMetricHandle?.gl === gl) return
    this._restoreDrawMetrics()
    const originals = {
      drawElements: gl.drawElements?.bind(gl),
      drawElementsInstanced: gl.drawElementsInstanced?.bind(gl),
      drawArrays: gl.drawArrays?.bind(gl),
    }
    try {
      if (originals.drawElements) {
        gl.drawElements = (mode, count, type, offset) => {
          if (this._countingDraws) {
            this._frameDrawCalls++
            if (mode === gl.TRIANGLES) this._frameTriangles += count / 3
          }
          return originals.drawElements(mode, count, type, offset)
        }
      }
      if (originals.drawElementsInstanced) {
        gl.drawElementsInstanced = (mode, count, type, offset, instances) => {
          if (this._countingDraws) {
            this._frameDrawCalls++
            if (mode === gl.TRIANGLES) this._frameTriangles += (count / 3) * instances
          }
          return originals.drawElementsInstanced(mode, count, type, offset, instances)
        }
      }
      if (originals.drawArrays) {
        gl.drawArrays = (mode, first, count) => {
          if (this._countingDraws) {
            this._frameDrawCalls++
            if (mode === gl.TRIANGLES) this._frameTriangles += count / 3
          }
          return originals.drawArrays(mode, first, count)
        }
      }
      this._glMetricHandle = { gl, originals }
    } catch {
      this._glMetricHandle = null
    }
  }

  _restoreDrawMetrics() {
    const handle = this._glMetricHandle
    if (!handle) return
    const { gl, originals } = handle
    if (originals.drawElements) gl.drawElements = originals.drawElements
    if (originals.drawElementsInstanced) gl.drawElementsInstanced = originals.drawElementsInstanced
    if (originals.drawArrays) gl.drawArrays = originals.drawArrays
    this._glMetricHandle = null
  }

  _buildScene() {
    const stage = this.app.stage
    stage.eventMode = 'none'

    this.backdrop = new Sprite(Texture.from(ENVIRONMENT_URL))
    stage.addChild(this.backdrop)

    this.backdropWash = new Graphics()
      .rect(0, 0, 10, 10)
      .fill({ color: 0x06101a, alpha: 0.36 })
    stage.addChild(this.backdropWash)

    this.combatSky = new Graphics()
    stage.addChild(this.combatSky)

    // The authored vista belongs to the title only. It remains allocated for
    // title continuity but is never rendered in combat: overlaying this full
    // perspective plate behind a moving top-down floor made the arena look
    // like a screenshot with sprites pasted on top.
    this.combatVista = new Sprite(Texture.from(ENVIRONMENT_URL))
    this.combatVista.alpha = 0
    this.combatVista.tint = 0xc7d9e2
    stage.addChild(this.combatVista)

    this.farMountains = new Sprite(mountainTexture('#274952', 'rgba(107,177,170,.2)', 0.8))
    this.nearMountains = new Sprite(mountainTexture('#19333d', 'rgba(79,151,148,.16)', 2.3))
    this.farMountains.alpha = COMBAT_HORIZON_PRESENTATION_2D.farMountainAlpha
    this.nearMountains.alpha = COMBAT_HORIZON_PRESENTATION_2D.nearMountainAlpha
    stage.addChild(this.farMountains, this.nearMountains)

    this.farMist = new TilingSprite({ texture: mistRibbonTexture(), width: 1, height: 1 })
    this.farMist.alpha = 0.16
    stage.addChild(this.farMist)

    this.floor = new TilingSprite({ texture: stoneFallbackTexture(), width: 1, height: 1 })
    this.floor.alpha = 0.94
    this.floor.tint = 0xb2c4d0
    this.floor.blendMode = 'normal'
    stage.addChild(this.floor)
    this.floorBlendMask = new Sprite(floorBlendMaskTexture())
    this.floorBlendMask.renderable = false
    stage.addChild(this.floorBlendMask)
    // Combat is a continuous top-down arena. A horizon mask belongs to a
    // side-view scene and exposed the static vista underneath the floor.

    this.mapDecalLayer = new Container()
    stage.addChild(this.mapDecalLayer)
    this.mapDecalBlendMask = new Sprite(this.floorBlendMask.texture)
    this.mapDecalBlendMask.renderable = false
    stage.addChild(this.mapDecalBlendMask)
    attachCombatGroundMasks2D(
      this.floor,
      this.floorBlendMask,
      this.mapDecalLayer,
      this.mapDecalBlendMask,
    )
    this.terrainMask = new Graphics()
    this.terrainMask.visible = false
    stage.addChild(this.terrainMask)
    this.mapDecalTextures = [canvasTexture(2, 2, (ctx) => ctx.clearRect(0, 0, 2, 2))]
    for (let i = 0; i < MAX_ACTIVE_MAP_CHUNKS; i++) {
      const sprite = new Sprite(this.mapDecalTextures[0])
      sprite.anchor.set(0.5)
      sprite.visible = false
      this.mapDecalLayer.addChild(sprite)
      this.mapDecalPool.push({ sprite, x: 0, z: 0, active: false })
    }

    this.floorRunes = new Sprite(floorRuneTexture())
    this.floorRunes.anchor.set(0.5)
    this.floorRunes.alpha = 0
    stage.addChild(this.floorRunes)

    // A restrained screen-space grade ties the streamed materials together and
    // reserves a calm value range around the player without hiding world detail.
    this.terrainGrade = new Sprite(terrainGradeTexture())
    this.terrainGrade.alpha = TERRAIN_GRADE_2D.alpha
    stage.addChild(this.terrainGrade)

    this.horizonMist = new Sprite(radialTexture('rgba(174,218,255,.28)', 'rgba(89,134,190,0)'))
    this.horizonMist.anchor.set(0.5)
    this.horizonMist.blendMode = 'normal'
    this.horizonMist.alpha = 0.2
    stage.addChild(this.horizonMist)

    this.nearMist = new TilingSprite({ texture: mistRibbonTexture(), width: 1, height: 1 })
    this.nearMist.alpha = 0.08
    this.nearMist.tint = 0xb8d6e2
    stage.addChild(this.nearMist)

    // Low-alpha atmospheric support over the actual alpha-composited terrain
    // edge. Actors and telegraphs are added later, so this remains terrain-only.
    this.horizonVeil = new Sprite(horizonBlendTexture())
    this.horizonVeil.alpha = COMBAT_HORIZON_PRESENTATION_2D.horizonVeilAlpha
    this.horizonVeil.blendMode = 'normal'
    stage.addChild(this.horizonVeil)

    this.groundLightLayer = new Container()
    stage.addChild(this.groundLightLayer)
    this.contactLightLayer = new Container()
    this.groundLightLayer.addChild(this.contactLightLayer)

    this.weaponFieldLayer = new Container()
    stage.addChild(this.weaponFieldLayer)

    this.shadowLayer = new Container()
    stage.addChild(this.shadowLayer)

    this.actorRoot = new Container()
    this.actorBuckets = []
    for (let i = 0; i < SORT_BUCKETS; i++) {
      const bucket = new Container()
      bucket.sortableChildren = true
      this.actorRoot.addChild(bucket)
      this.actorBuckets.push(bucket)
    }
    stage.addChild(this.actorRoot)

    this.friendlyProjectileContainer = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
    })
    this.hostileProjectileContainer = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
    })
    this.pickupContainer = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
    })
    stage.addChild(this.friendlyProjectileContainer, this.hostileProjectileContainer, this.pickupContainer)

    this.effectLayer = new Container()
    stage.addChild(this.effectLayer)

    this.damageTextLayer = new Container()
    stage.addChild(this.damageTextLayer)

    const projectileAtlas = projectileAtlasTexture()
    const hostileProjectileAtlas = hostileProjectileAtlasTexture()
    const weaponFieldAtlas = weaponFieldAtlasTexture()
    const weaponFieldWall = weaponFieldWallTexture()
    this.textures = {
      seolryeongPortrait: Texture.from(SPRITE_MANIFEST.actors.seolryeong.portraitUrl),
      seolryeong: Texture.WHITE,
      yorang: Texture.WHITE,
      jadeSerpent: Texture.WHITE,
      jadeStoneGhoul: Texture.WHITE,
      bloodScorpion: Texture.WHITE,
      talismanRevenant: Texture.WHITE,
      voidSentinel: Texture.WHITE,
      jadeVoidWarden: Texture.WHITE,
      wisp: wispTexture(),
      shadow: shadowTexture(),
      sword: projectileAtlas.frames[0],
      projectileAtlas: projectileAtlas.atlas,
      projectileFrames: projectileAtlas.frames,
      hostileProjectileAtlas: hostileProjectileAtlas.atlas,
      hostileProjectileFrames: hostileProjectileAtlas.frames,
      weaponFieldAtlas: weaponFieldAtlas.atlas,
      weaponFieldFrames: weaponFieldAtlas.frames,
      weaponField: weaponFieldAtlas.frames[0],
      weaponFieldWall,
      slash: slashTexture(),
      pickup: pickupTexture(),
      ring: ringTexture(),
      bossTelegraph: bossTelegraphTexture(),
      hit: impactTexture(),
      death: deathTexture(),
      contactLight: contactLightTexture(),
      warmGlow: radialTexture('rgba(255,196,92,.34)', 'rgba(255,142,38,0)'),
      heroAura: radialTexture('rgba(187,244,255,.28)', 'rgba(76,170,210,0)'),
    }

    this.friendlyProjectilePool = new ParticlePool(
      this.friendlyProjectileContainer, this.textures.projectileAtlas, MAX_PROJECTILES_2D,
    )
    this.hostileProjectilePool = new ParticlePool(
      this.hostileProjectileContainer, this.textures.hostileProjectileAtlas, MAX_PROJECTILES_2D,
    )
    this.pickupPool = new ParticlePool(this.pickupContainer, this.textures.pickup, MAX_PICKUPS_2D)
    this._ensureWeaponFields(MAX_WEAPON_FIELDS_2D)

    this.heroAura = new Sprite(this.textures.heroAura)
    this.heroAura.anchor.set(0.5)
    this.heroAura.blendMode = 'add'
    this.heroAura.visible = false
    this.groundLightLayer.addChild(this.heroAura)

    this.heroShadow = new Sprite(this.textures.shadow)
    this.heroShadow.anchor.set(0.5)
    this.shadowLayer.addChild(this.heroShadow)
    this.hero = new Sprite(this.textures.seolryeong)
    this.hero.anchor.set(0.5, SPRITE_MANIFEST.actors.seolryeong.pivot[1])
    this.actorBuckets[32].addChild(this.hero)

    this.bossShadow = new Sprite(this.textures.shadow)
    this.bossShadow.anchor.set(0.5)
    this.bossShadow.visible = false
    this.shadowLayer.addChild(this.bossShadow)
    this.bossContact = new Sprite(this.textures.contactLight)
    this.bossContact.anchor.set(0.5)
    this.bossContact.blendMode = 'add'
    this.bossContact.visible = false
    this.contactLightLayer.addChild(this.bossContact)
    this.bossIntent = new Sprite(this.textures.ring)
    this.bossIntent.anchor.set(0.5)
    this.bossIntent.visible = false
    this.shadowLayer.addChild(this.bossIntent)
    this.bossDangerZone = new Graphics()
    this.bossDangerZone.visible = false
    this.bossDangerZone.blendMode = 'normal'
    this.groundLightLayer.addChild(this.bossDangerZone)
    this.boss = new Sprite(this.textures.jadeVoidWarden)
    this.boss.anchor.set(0.5, SPRITE_MANIFEST.actors.jadeVoidWarden.pivot[1])
    this.boss.visible = false
    this.actorBuckets[32].addChild(this.boss)

    this.heroMarker = new Sprite(this.textures.ring)
    this.heroMarker.anchor.set(0.5)
    this.heroMarker.blendMode = 'normal'
    this.heroMarker.visible = false
    // The marker is ground information. Rendering it in the late effect layer
    // drew the ring over the heroine's boots and made it look like a tilted UI
    // disc attached to her body.
    this.groundLightLayer.addChild(this.heroMarker)

    this.heroReadability = new Sprite(this.textures.seolryeong)
    this.heroReadability.anchor.set(0.5, SPRITE_MANIFEST.actors.seolryeong.pivot[1])
    this.heroReadability.blendMode = 'normal'
    this.heroReadability.visible = false
    // Keep the rim in the same depth bucket and texture batch as the heroine.
    // Re-adding the hero also makes the intended back-to-front order explicit.
    this.actorBuckets[32].addChild(this.heroReadability, this.hero)

    this.bossCastPill = typeof document === 'undefined' ? null : document.createElement('div')
    if (this.bossCastPill) {
      this.bossCastPill.className = 'hud-boss-cast hud-boss-cast-pixi'
      this.bossCastPill.hidden = true
      this.bossCastPill.setAttribute('role', 'status')
      this.bossCastPill.setAttribute('aria-live', 'polite')
      document.getElementById('hud')?.appendChild(this.bossCastPill)
    }
    this._bossCastPillKey = ''

    this.heroSlash = new Sprite(this.textures.slash)
    this.heroSlash.anchor.set(0.5)
    // Local additive light is safe here because the quad is only the sword arc;
    // the old defect was a viewport-sized additive flash on every attack.
    this.heroSlash.blendMode = 'add'
    this.heroSlash.visible = false
    this.effectLayer.addChild(this.heroSlash)

    this._ensureDamageTexts(12)

    this.titleHero = new Sprite(this.textures.seolryeongPortrait)
    this.titleHero.anchor.set(0.5, 1)
    this.titleHero.alpha = 0.92
    stage.addChild(this.titleHero)

    // Prewarm enough objects for the first several waves. Later additions are
    // created in small batches instead of allocating a 900-object horde at boot.
    this._ensureEnemies(160)
    this.friendlyProjectilePool.ensure(256)
    this.hostileProjectilePool.ensure(128)
    this.pickupPool.ensure(256)
    this._setSceneMode(false)
  }

  async prepareRunAssets(stageId = 'jade') {
    if (this._destroyed) return
    if (this._runAssetsReady) {
      this._replaceGroundTextures(stageId)
      return
    }
    if (this._runAssetsPromise) return this._runAssetsPromise
    this._runAssetsPromise = (async () => {
      let jadeGroundUrl = JADE_GROUND_URL
      try {
        await Assets.load(JADE_GROUND_URL)
      } catch {
        // Keep old builds runnable if the new material is omitted from a stale
        // deployment, but never load both multi-megabyte ground textures during
        // the normal path.
        jadeGroundUrl = JADE_GROUND_FALLBACK_URL
        await Assets.load(JADE_GROUND_FALLBACK_URL)
      }
      await Assets.load([
        STONE_URL,
        SPRITE_MANIFEST.actors.seolryeong.url,
        SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.east.url,
        SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.north.url,
        SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.northeast.url,
        SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.south.url,
        SPRITE_MANIFEST.actors.yorang.url,
        SPRITE_MANIFEST.actors.jadeSerpent.url,
        SPRITE_MANIFEST.actors.jadeStoneGhoul.url,
        SPRITE_MANIFEST.actors.bloodScorpion.url,
        SPRITE_MANIFEST.actors.talismanRevenant.url,
        SPRITE_MANIFEST.actors.voidSentinel.url,
        SPRITE_MANIFEST.actors.jadeVoidWarden.url,
        SPRITE_MANIFEST.environment.jadeSanctuaryProps.url,
      ])
      if (this._destroyed || !this.app) return
      this.groundBaseTextures = {
        jade: Texture.from(jadeGroundUrl),
        default: Texture.from(STONE_URL),
      }
      this.floor.texture = this.groundBaseTextures.jade
      this._replaceGroundTextures(stageId)
      this.textures.yorang = Texture.from(SPRITE_MANIFEST.actors.yorang.url)
      this.textures.jadeSerpent = Texture.from(SPRITE_MANIFEST.actors.jadeSerpent.url)
      this.textures.jadeStoneGhoul = Texture.from(SPRITE_MANIFEST.actors.jadeStoneGhoul.url)
      this.textures.bloodScorpion = Texture.from(SPRITE_MANIFEST.actors.bloodScorpion.url)
      this.textures.talismanRevenant = Texture.from(SPRITE_MANIFEST.actors.talismanRevenant.url)
      this.textures.voidSentinel = Texture.from(SPRITE_MANIFEST.actors.voidSentinel.url)
      this.textures.jadeVoidWarden = Texture.from(SPRITE_MANIFEST.actors.jadeVoidWarden.url)
      this.textures.seolryeong = Texture.from(SPRITE_MANIFEST.actors.seolryeong.url)
      this.textures.seolryeongE = Texture.from(SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.east.url)
      this.textures.seolryeongN = Texture.from(SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.north.url)
      this.textures.seolryeongNe = Texture.from(SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.northeast.url)
      this.textures.seolryeongS = Texture.from(SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.south.url)
      this.textures.jadeSanctuaryProps = Texture.from(SPRITE_MANIFEST.environment.jadeSanctuaryProps.url)
      this.frames.seolryeong = sliceFrames(this.textures.seolryeong, SPRITE_MANIFEST.actors.seolryeong)
      this.frames.seolryeongE = sliceFrames(this.textures.seolryeongE, SPRITE_MANIFEST.actors.seolryeong)
      this.frames.seolryeongN = sliceFrames(this.textures.seolryeongN, SPRITE_MANIFEST.actors.seolryeong)
      this.frames.seolryeongNe = sliceFrames(this.textures.seolryeongNe, SPRITE_MANIFEST.actors.seolryeong)
      this.frames.seolryeongS = sliceFrames(this.textures.seolryeongS, SPRITE_MANIFEST.actors.seolryeong)
      this.frames.yorang = sliceFrames(this.textures.yorang, SPRITE_MANIFEST.actors.yorang)
      this.frames.jadeSerpent = sliceFrames(this.textures.jadeSerpent, SPRITE_MANIFEST.actors.jadeSerpent)
      this.frames.jadeStoneGhoul = sliceFrames(
        this.textures.jadeStoneGhoul, SPRITE_MANIFEST.actors.jadeStoneGhoul,
      )
      this.frames.bloodScorpion = sliceFrames(
        this.textures.bloodScorpion, SPRITE_MANIFEST.actors.bloodScorpion,
      )
      this.frames.talismanRevenant = sliceFrames(
        this.textures.talismanRevenant, SPRITE_MANIFEST.actors.talismanRevenant,
      )
      this.frames.voidSentinel = sliceFrames(this.textures.voidSentinel, SPRITE_MANIFEST.actors.voidSentinel)
      this.frames.jadeVoidWarden = sliceFrames(this.textures.jadeVoidWarden, SPRITE_MANIFEST.actors.jadeVoidWarden)
      this.frames.jadeSanctuaryProps = sliceFrames(
        this.textures.jadeSanctuaryProps, SPRITE_MANIFEST.environment.jadeSanctuaryProps,
      )
      this.hero.texture = this.frames.seolryeong[0]
      this.boss.texture = this.frames.jadeVoidWarden[0]
      this._buildProps()
      this._buildPois()
      for (const entry of this.enemyPool) entry.key = ''
      this._runAssetsReady = true
    })()
    try {
      await this._runAssetsPromise
    } finally {
      this._runAssetsPromise = null
    }
  }

  _replaceGroundTextures(stageId) {
    if (this._groundStageId === stageId) return
    const jade = stageId === 'jade'
    const decalTexture = this.groundBaseTextures?.[stageId]
      ?? this.groundBaseTextures?.jade
      ?? this.groundBaseTextures?.default
      ?? this.floor.texture
    const terrainSource = decalTexture.source?.resource
    const previousFloorBase = this.generatedFloorBase
    // Jade is a purpose-built seamless material. Other stages retain their
    // inexpensive procedural macro base until they receive equivalent assets.
    const baseTexture = jade && terrainSource?.width && terrainSource?.height
      ? composedJadeGroundTexture(terrainSource)
      : macroGroundTexture(stageId)
    this.generatedFloorBase = baseTexture
    this.floor.texture = baseTexture
    previousFloorBase?.destroy(true)
    const previous = this.mapDecalTextures
    this._floorTileScale = jade ? JADE_GROUND_COMPOSITION_2D.floorTileScale : { x: 2.45, y: 1.5 }
    const presentationScale = this._presentationScale ?? viewportPresentationScale(this.viewport)
    this.floor.tileScale.set(
      this._floorTileScale.x * presentationScale,
      this._floorTileScale.y * presentationScale,
    )
    this.floor.alpha = jade ? 1 : 0.9
    this.floor.tint = 0xffffff
    this._groundChunkAlpha = jade ? JADE_GROUND_COMPOSITION_2D.decalAlpha : 0.78
    this.mapDecalTextures = Array.from(
      { length: MAP_GROUND_VARIANTS },
      (_, i) => jade
        ? jadeGroundDetailTexture(i + 11)
        : groundChunkTexture(terrainSource, i + 11, stageId, false),
    )
    for (const texture of previous) texture.destroy(true)
    this._groundStageId = stageId
    this.activeMapChunkKey = ''
  }

  _buildProps() {
    if (this.propPool.length > 0) return
    for (let i = 0; i < MAX_ACTIVE_MAP_PROPS; i++) {
      const shadow = new Sprite(this.textures.shadow)
      shadow.anchor.set(0.5)
      shadow.visible = false
      this.shadowLayer.addChild(shadow)
      const sprite = new Sprite(this.frames.jadeSanctuaryProps[0])
      sprite.anchor.set(0.5, 0.9)
      sprite.visible = false
      const glow = new Sprite(this.textures.warmGlow)
      glow.anchor.set(0.5)
      glow.blendMode = 'add'
      glow.visible = false
      this.groundLightLayer.addChild(glow)
      const contact = new Sprite(this.textures.contactLight)
      contact.anchor.set(0.5)
      contact.blendMode = 'add'
      contact.visible = false
      this.contactLightLayer.addChild(contact)
      const entry = {
        x: 0, z: 0, height: 120, frame: 0, active: false, groundingKey: 'prop',
        sprite, shadow, glow, contact, bucket: 0, phase: i * 0.73,
      }
      this.actorBuckets[0].addChild(sprite)
      this.propPool.push(entry)
    }
  }

  _buildPois() {
    if (this.poiPool.length > 0) return
    for (let i = 0; i < MAX_ACTIVE_MAP_CHUNKS; i++) {
      const shadow = new Sprite(this.textures.shadow)
      shadow.anchor.set(0.5)
      shadow.visible = false
      this.shadowLayer.addChild(shadow)
      const sprite = new Sprite(this.frames.jadeSanctuaryProps[7])
      sprite.anchor.set(0.5, 0.9)
      sprite.visible = false
      const glow = new Sprite(this.textures.warmGlow)
      glow.anchor.set(0.5)
      glow.blendMode = 'add'
      glow.visible = false
      this.groundLightLayer.addChild(glow)
      const marker = new Sprite(this.textures.ring)
      marker.anchor.set(0.5)
      marker.blendMode = 'add'
      marker.visible = false
      this.groundLightLayer.addChild(marker)
      const badge = new Text({
        text: '', anchor: 0.5, resolution: 1,
        style: {
          fontFamily: 'Malgun Gothic, sans-serif', fontSize: 20, fontWeight: '900',
          fill: 0xffffff, stroke: { color: 0x071017, width: 5 },
        },
      })
      badge.visible = false
      this.effectLayer.addChild(badge)
      const entry = { sprite, shadow, glow, marker, badge, bucket: 0, groundingKey: 'poi', frame: 7 }
      this.actorBuckets[0].addChild(sprite)
      this.poiPool.push(entry)
    }
  }

  _setSceneMode(running) {
    this.backdrop.visible = !running
    this.backdropWash.visible = !running
    this.titleHero.visible = !running
    this.combatSky.visible = running
    this.combatVista.visible = false
    this.farMountains.visible = running
    this.nearMountains.visible = running
    this.farMist.visible = running
    this.floor.visible = running
    this.mapDecalLayer.visible = running
    this.floorRunes.visible = false
    if (this.terrainGrade) this.terrainGrade.visible = running
    this.horizonMist.visible = running
    this.nearMist.visible = running
    this.horizonVeil.visible = running
    this.groundLightLayer.visible = running
    this.weaponFieldLayer.visible = running
    for (const entry of this.propPool) {
      entry.sprite.visible = running && entry.active
      entry.shadow.visible = running && entry.active
      entry.glow.visible = running && entry.active && (entry.frame === 0 || entry.frame === 7)
      entry.contact.visible = running && entry.active
    }
    if (!running) {
      for (const entry of this.poiPool) {
        entry.sprite.visible = false
        entry.shadow.visible = false
        entry.glow.visible = false
        entry.marker.visible = false
        entry.badge.visible = false
      }
    }
  }

  _ensureEnemies(count) {
    const target = Math.min(count, 900)
    while (this.enemyPool.length < target) {
      const intent = new Sprite(this.textures.ring)
      intent.anchor.set(0.5)
      intent.visible = false
      this.shadowLayer.addChild(intent)
      const shadow = new Sprite(this.textures.shadow)
      shadow.anchor.set(0.5)
      shadow.visible = false
      this.shadowLayer.addChild(shadow)
      const contact = new Sprite(this.textures.contactLight)
      contact.anchor.set(0.5)
      contact.blendMode = 'add'
      contact.visible = false
      this.contactLightLayer.addChild(contact)
      const sprite = new Sprite(this.textures.wisp)
      sprite.anchor.set(0.5, 0.88)
      sprite.visible = false
      const entry = { sprite, shadow, contact, intent, bucket: 0, key: 'wisp', frame: 0 }
      this.actorBuckets[0].addChild(sprite)
      this.enemyPool.push(entry)
    }
  }

  _ensureEffects(count) {
    while (this.effectPool.length < count && this.effectPool.length < 256) {
      const sprite = new Sprite(this.textures.hit)
      sprite.anchor.set(0.5)
      sprite.visible = false
      sprite.blendMode = 'normal'
      this.effectLayer.addChild(sprite)
      this.effectPool.push(sprite)
    }
  }

  _ensureWeaponFields(count) {
    const target = Math.min(count, MAX_WEAPON_FIELDS_2D)
    while (this.weaponFieldPool.length < target) {
      const sprite = new Sprite(this.textures.weaponField)
      sprite.anchor.set(0.5)
      sprite.visible = false
      sprite.blendMode = 'normal'
      this.weaponFieldLayer.addChild(sprite)
      this.weaponFieldPool.push(sprite)
    }
  }

  _ensureDamageTexts(count) {
    while (this.damageTextPool.length < count) {
      const label = new Text({
        text: '',
        anchor: 0.5,
        resolution: 1,
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 18,
          fontWeight: '900',
          fill: 0xffffff,
          stroke: { color: 0x071017, width: 3 },
        },
      })
      label.visible = false
      this.damageTextLayer.addChild(label)
      this.damageTextPool.push({
        label, x: 0, z: 0, life: 0, maxLife: 0.54, crit: false, offsetX: 0, offsetY: 0,
      })
    }
  }

  spawnDamageNumber(x, z, amount, crit = false, tag = 'sword') {
    if (!Number.isFinite(amount) || amount <= 0 || this.damageTextPool.length === 0) return
    let slot = this.damageTextPool.findIndex((entry) => entry.life <= 0)
    if (slot < 0) slot = this.damageTextCursor++ % this.damageTextPool.length
    const entry = this.damageTextPool[slot]
    entry.x = x
    entry.z = z
    entry.life = entry.maxLife = crit ? 0.66 : 0.5
    entry.crit = crit
    const serial = this.damageTextSerial++
    entry.offsetX = ((serial % 5) - 2) * 6
    entry.offsetY = (serial % 3) * 3
    const healing = tag === 'heal'
    const playerHurt = tag === 'hurt'
    entry.label.text = `${healing ? '+ ' : playerHurt ? '− ' : crit ? '✦ ' : ''}${Math.max(1, Math.round(amount))}`
    entry.label.tint = crit ? 0xffdf76
      : healing ? 0x7ff0bc
        : playerHurt ? 0xff7a82
      : tag === 'fire' ? 0xff9b73
        : tag === 'poison' ? 0x9bea91
          : tag === 'lightning' ? 0xd9c2ff : 0xd8f4ff
    entry.label.visible = true
  }

  _renderDamageNumbers(dt) {
    for (const entry of this.damageTextPool) {
      if (entry.life <= 0) {
        entry.label.visible = false
        continue
      }
      entry.life = Math.max(0, entry.life - dt)
      const progress = 1 - entry.life / entry.maxLife
      projectWorld(entry.x, entry.z, this.cameraX, this.cameraZ, this.viewport, _screen)
      const scale = this._presentationScale ?? 1
      entry.label.position.set(
        _screen.x + entry.offsetX * scale,
        _screen.y - (28 + entry.offsetY + progress * 30) * scale,
      )
      const pop = 0.78 + Math.sin(Math.min(1, progress * 2.5) * Math.PI) * (entry.crit ? 0.42 : 0.24)
      entry.label.scale.set(pop * scale)
      entry.label.alpha = progress < 0.68 ? 1 : Math.max(0, (1 - progress) / 0.32)
      entry.label.visible = entry.life > 0 && isOnScreen(_screen.x, _screen.y, this.viewport, 80)
    }
  }

  setResolution(scale) {
    if (!this.app) return
    this.app.renderer.resolution = Math.max(0.85, scale)
    this.resize()
  }

  setZoom(zoom) {
    this.viewport.zoom = Math.max(0.85, Math.min(1.25, zoom))
    return this.viewport.zoom
  }

  resize() {
    if (!this.app) return
    const width = Math.max(1, window.innerWidth)
    const height = Math.max(1, window.innerHeight)
    this.viewport.width = width
    this.viewport.height = height
    this._presentationScale = viewportPresentationScale(this.viewport)
    this.app.renderer.resize(width, height)
    cover(this.backdrop, width, height)
    this.backdropBaseX = this.backdrop.position.x
    this.backdropBaseY = this.backdrop.position.y
    this.backdropWash.clear().rect(0, 0, width, height).fill({ color: 0x06101a, alpha: 0.36 })
    this.combatSky.clear()
      .rect(0, 0, width, height).fill({ color: 0x071017 })
    cover(this.combatVista, width, height)
    this.combatVista.width *= 1.08
    this.combatVista.height *= 1.08
    this.combatVista.position.x -= width * 0.04
    this.combatVista.position.y -= height * 0.04
    this.combatVistaBaseX = this.combatVista.position.x
    this.combatVistaBaseY = this.combatVista.position.y
    this.farMountains.width = width * 1.24
    this.farMountains.height = height * COMBAT_HORIZON_PRESENTATION_2D.farMountainHeightRatio
    this.farMountainsBaseX = -width * 0.12
    this.farMountains.position.set(this.farMountainsBaseX, -height * 0.03)
    this.nearMountains.width = width * 1.3
    this.nearMountains.height = height * COMBAT_HORIZON_PRESENTATION_2D.nearMountainHeightRatio
    this.nearMountainsBaseX = -width * 0.15
    this.nearMountains.position.set(this.nearMountainsBaseX, -height * 0.015)
    this.farMist.width = width * 1.35
    this.farMist.height = Math.max(100, height * 0.18)
    this.farMist.position.set(-width * 0.15, height * 0.13)
    this._combatHorizonY = Math.round(height * COMBAT_HORIZON_RATIO)
    // The floor is viewport-sized; the alpha mask below determines where it
    // enters the scene. This avoids a second sprite edge when the camera pans.
    this.floor.width = width
    this.floor.height = height
    this.floor.position.set(0, 0)
    this.floor.tileScale.set(
      this._floorTileScale.x * this._presentationScale,
      this._floorTileScale.y * this._presentationScale,
    )
    this.floorBlendMask.width = width
    this.floorBlendMask.height = height
    this.floorBlendMask.position.set(0, 0)
    this.mapDecalBlendMask.width = width
    this.mapDecalBlendMask.height = height
    this.mapDecalBlendMask.position.set(0, 0)
    if (this.terrainGrade) {
      this.terrainGrade.width = width
      this.terrainGrade.height = height
      this.terrainGrade.position.set(0, 0)
    }
    const horizonOverlap = Math.max(30, Math.min(64, height * 0.045))
    const floorTop = this._combatHorizonY - horizonOverlap
    this.terrainMask.clear()
      .rect(0, floorTop, width, height - floorTop)
      .fill({ color: 0xffffff })
    this.horizonMist.position.set(width * 0.5, this._combatHorizonY + height * 0.015)
    this.horizonMist.scale.set(width / 42, Math.max(2, height / 180))
    this.nearMist.width = width * 1.5
    this.nearMist.height = height
    this.nearMist.position.set(-width * 0.25, 0)
    this.nearMist.alpha = 0.06
    const veilHeight = Math.max(168, height * 0.28)
    this.horizonVeil.width = width
    this.horizonVeil.height = veilHeight
    this.horizonVeil.position.set(0, this._combatHorizonY - veilHeight * 0.5)
    this.titleHero.position.set(width * 0.76, height * 1.03)
    setHeight(this.titleHero, Math.min(height * 0.86, 820), false)
  }

  showTitle() {
    this.runActive = false
    this._setSceneMode(false)
    this.hero.visible = false
    this.heroAura.visible = false
    this.heroShadow.visible = false
    this.boss.visible = false
    this.bossShadow.visible = false
    this.bossContact.visible = false
    this.bossIntent.visible = false
    this.bossDangerZone.visible = false
    this._updateBossCastPill(null, null)
    this.heroSlash.visible = false
    this.heroMarker.visible = false
    this.heroReadability.visible = false
    for (const entry of this.enemyPool) {
      entry.sprite.visible = false
      entry.shadow.visible = false
      entry.contact.visible = false
      entry.intent.visible = false
    }
    for (const entry of this.damageTextPool) {
      entry.life = 0
      entry.label.visible = false
    }
    for (const entry of this.poiPool) {
      entry.sprite.visible = false
      entry.shadow.visible = false
      entry.glow.visible = false
      entry.marker.visible = false
      entry.badge.visible = false
    }
    this.friendlyProjectilePool.hideFrom(0)
    this.hostileProjectilePool.hideFrom(0)
    this.pickupPool.hideFrom(0)
  }

  startRun(snapshot) {
    this.runActive = true
    this._setSceneMode(true)
    this.hero.visible = true
    this.heroAura.visible = true
    this.heroShadow.visible = true
    this.cameraX = snapshot.player.x
    this.cameraZ = snapshot.player.z
    const stageId = snapshot.world.stage?.id ?? 'jade'
    this.mapSeed = Array.from(stageId).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0
    this.activeMapChunkKey = ''
    this._refreshMapChunks()
  }

  _refreshMapChunks() {
    const key = mapChunkKey(this.cameraX, this.cameraZ)
    if (key === this.activeMapChunkKey) return
    this.activeMapChunkKey = key
    const chunks = activeMapChunks(this.cameraX, this.cameraZ, this.mapSeed, this._groundStageId)
    let propIndex = 0
    for (let i = 0; i < this.mapDecalPool.length; i++) {
      const entry = this.mapDecalPool[i]
      const chunk = chunks[i]
      entry.active = Boolean(chunk)
      entry.sprite.visible = Boolean(chunk)
      if (!chunk) continue
      entry.x = (chunk.x + 0.5) * MAP_CHUNK_SIZE
      entry.z = (chunk.z + 0.5) * MAP_CHUNK_SIZE
      entry.variant = chunk.variant
      entry.sprite.texture = this.mapDecalTextures[chunk.variant]
      entry.regionId = chunk.regionId
      const primaryRegion = REGION_TERRAIN_PRESENTATION_2D[chunk.regionId]
        ?? REGION_TERRAIN_PRESENTATION_2D.jade_grove
      const secondaryRegion = REGION_TERRAIN_PRESENTATION_2D[chunk.secondaryRegionId]
        ?? primaryRegion
      entry.sprite.alpha = Math.min(
        1,
        this._groundChunkAlpha * primaryRegion.alpha * (0.94 + (chunk.variant % 4) * 0.02),
      )
      entry.sprite.tint = blendTint2D(primaryRegion.tint, secondaryRegion.tint, chunk.regionMix)
      for (const prop of propsForMapChunk(chunk.x, chunk.z, this.mapSeed, this._groundStageId)) {
        if (propIndex >= this.propPool.length) break
        const target = this.propPool[propIndex++]
        target.active = true
        target.x = prop.x
        target.z = prop.z
        target.height = prop.height
        target.frame = prop.frame
        target.landmark = Boolean(prop.landmark)
        target.regionId = prop.regionId ?? chunk.regionId
        target.sprite.texture = this.frames.jadeSanctuaryProps[prop.frame]
      }
    }
    for (let i = propIndex; i < this.propPool.length; i++) {
      this.propPool[i].active = false
      this.propPool[i].sprite.visible = false
      this.propPool[i].shadow.visible = false
      this.propPool[i].glow.visible = false
      this.propPool[i].contact.visible = false
    }
  }

  _renderMapChunks() {
    for (const entry of this.mapDecalPool) {
      if (!entry.active) continue
      projectWorld(entry.x, entry.z, this.cameraX, this.cameraZ, this.viewport, _screen)
      entry.sprite.position.set(_screen.x, _screen.y)
      const overlap = this._groundStageId === 'jade' ? JADE_GROUND_COMPOSITION_2D.decalOverlap : 1.01
      entry.sprite.width = MAP_CHUNK_SIZE * _screen.unit * overlap
      entry.sprite.height = MAP_CHUNK_SIZE * _screen.depthUnit * overlap
      entry.sprite.visible = isOnScreen(_screen.x, _screen.y, this.viewport, entry.sprite.width)
    }
  }

  _placeActor(entry, x, z, height, alpha, facing, tint, bob = 0) {
    projectWorld(x, z, this.cameraX, this.cameraZ, this.viewport, _screen)
    const sprite = entry.sprite
    const shadow = entry.shadow
    const mirror = Math.sin(facing) < -0.15
    setHeight(sprite, height, mirror)
    sprite.position.set(_screen.x, _screen.y + bob)
    sprite.zIndex = _screen.y
    sprite.alpha = alpha
    sprite.tint = tint
    sprite.visible = isOnScreen(_screen.x, _screen.y, this.viewport)
    const grounding = actorGroundingProfile2D(entry.groundingKey ?? entry.key, entry.frame)
    shadow.position.set(_screen.x, _screen.y + grounding.shadowOffsetY)
    shadow.width = Math.max(grounding.minShadowWidth, height * grounding.shadowWidth)
    shadow.height = Math.max(grounding.minShadowHeight, height * grounding.shadowHeight)
    shadow.alpha = alpha * grounding.shadowAlpha
    shadow.visible = sprite.visible
    const bucket = depthBucket(_screen.y, this.viewport.height)
    if (entry.bucket !== bucket) {
      entry.bucket = bucket
      this.actorBuckets[bucket].addChild(sprite)
    }
  }

  _renderProps() {
    for (const entry of this.propPool) {
      if (!entry.active) {
        entry.sprite.visible = false
        entry.shadow.visible = false
        entry.glow.visible = false
        entry.contact.visible = false
        continue
      }
      const visualHeight = entry.height * this._presentationScale
      const playerDistance = Math.hypot(entry.x - this.cameraX, entry.z - this.cameraZ)
      const playerFade = Math.max(0.22, Math.min(1, (playerDistance - 1.8) / 3.5))
      entry.sprite.anchor.y = actorFootPivot2D('prop', entry.frame)
      const materialTint = PROP_MATERIAL_TINTS_2D[entry.frame % PROP_MATERIAL_TINTS_2D.length]
      const regionTint = REGION_TERRAIN_PRESENTATION_2D[entry.regionId]?.propTint ?? materialTint
      this._placeActor(entry, entry.x, entry.z, visualHeight, playerFade, 0, blendTint2D(materialTint, regionTint, 0.18))
      entry.sprite.rotation = entry.frame === 1 || entry.frame === 4
        ? Math.sin(this.time * (entry.frame === 4 ? 1.7 : 1.15) + entry.phase) * 0.008 : 0
      const lit = entry.frame === 0 || entry.frame === 7
      entry.glow.visible = lit && entry.sprite.visible
      if (lit) {
        entry.glow.position.set(entry.shadow.position.x, entry.shadow.position.y - visualHeight * 0.16)
        const flicker = 0.9 + Math.sin(this.time * 6.7 + entry.phase) * 0.1
        entry.glow.width = visualHeight * 1.02 * flicker
        entry.glow.height = visualHeight * 0.46 * flicker
        entry.glow.alpha = 0.21 * flicker * playerFade
      }
      const grounding = actorGroundingProfile2D('prop', entry.frame)
      entry.contact.position.set(entry.shadow.position.x, entry.shadow.position.y)
      const footprint = entry.landmark ? 1.16 : 1
      entry.contact.width = Math.max(26, visualHeight * grounding.contactWidth) * footprint
      entry.contact.height = Math.max(8, visualHeight * grounding.contactHeight) * (entry.landmark ? 1.08 : 1)
      entry.contact.tint = grounding.contactTint
      entry.contact.alpha = grounding.contactAlpha * playerFade * (entry.landmark ? 0.86 : 0.72)
      entry.contact.visible = entry.sprite.visible
      const edge = Math.min(_screen.x, this.viewport.width - _screen.x, _screen.y, this.viewport.height - _screen.y)
      const fade = Math.max(0, Math.min(1, (edge + 45) / 125))
      entry.sprite.alpha *= fade
      entry.shadow.alpha *= (entry.landmark ? 0.96 : 0.9) * fade
      entry.shadow.width *= entry.landmark ? 1.18 : 1.1
      entry.contact.alpha *= fade
    }
  }

  _renderPois(snapshot, nearbyId = null) {
    const items = snapshot?.items ?? []
    for (let i = 0; i < this.poiPool.length; i++) {
      const entry = this.poiPool[i]
      const item = items[i]
      if (!item) {
        entry.sprite.visible = false
        entry.shadow.visible = false
        entry.glow.visible = false
        entry.marker.visible = false
        entry.badge.visible = false
        continue
      }
      const config = POI_PRESENTATION[item.type] ?? POI_PRESENTATION.altar
      const visualHeight = config.height * this._presentationScale
      const available = item.state === 'available'
      const nearby = available && item.id === nearbyId
      entry.frame = config.frame
      entry.sprite.texture = this.frames.jadeSanctuaryProps[config.frame]
      entry.sprite.anchor.y = actorFootPivot2D('prop', config.frame)
      this._placeActor(entry, item.x, item.z, visualHeight, available ? 1 : 0.28, 0, 0xffffff)
      entry.shadow.alpha *= available ? 0.9 : 0.3
      const pulse = 0.92 + Math.sin(this.time * (nearby ? 5.4 : 2.2) + i) * (nearby ? 0.1 : 0.035)
      entry.glow.position.set(_screen.x, _screen.y - visualHeight * 0.18)
      entry.glow.width = visualHeight * (nearby ? 1.55 : 1.12) * pulse
      entry.glow.height = visualHeight * 0.55 * pulse
      entry.glow.tint = config.color
      entry.glow.alpha = available ? (nearby ? 0.52 : 0.25) : 0.05
      entry.glow.visible = entry.sprite.visible
      entry.marker.position.set(_screen.x, _screen.y + 5)
      entry.marker.width = (nearby ? 116 : 88) * pulse
      entry.marker.height = (nearby ? 42 : 32) * pulse
      entry.marker.rotation = this.time * (nearby ? 0.72 : 0.25)
      entry.marker.tint = config.color
      entry.marker.alpha = available ? (nearby ? 0.62 : 0.28) : 0.08
      entry.marker.visible = entry.sprite.visible
      entry.badge.text = config.glyph
      entry.badge.position.set(_screen.x, _screen.y - visualHeight - 13 * this._presentationScale)
      entry.badge.tint = config.color
      entry.badge.scale.set(nearby ? 1.18 : 0.9)
      entry.badge.alpha = available ? (nearby ? 1 : 0.78) : 0.22
      entry.badge.visible = entry.sprite.visible
    }
  }

  _renderEnemies(field, alpha) {
    if (field.count > this.enemyPool.length) this._ensureEnemies(Math.min(900, Math.ceil(field.count / 64) * 64))
    for (let i = 0; i < field.count; i++) {
      const entry = this.enemyPool[i]
      const def = ENEMIES[field.type[i]] ?? ENEMIES[0]
      const key = enemyTextureKey(def.id)
      const attackDuration = enemyAttackPresentationDuration2D(def, field.behavior[i])
      const intentPresentation = resolveEnemyIntentPresentation2D(
        _enemyIntentPresentation,
        field.attackTimer[i],
        field.contactIntentTimer?.[i],
        attackDuration,
      )
      if (entry.key !== key) entry.key = key
      if (key !== 'wisp') {
        const actor = SPRITE_MANIFEST.actors[key]
        const attacking = intentPresentation.visible
        const locomotion = actor.animations.walk ?? actor.animations.hover ?? actor.animations.idle
        const attack = actor.animations.attack ?? actor.animations.cast ?? locomotion
        entry.frame = attacking
          ? oneShotFrameIndex(attack, intentPresentation.remaining, intentPresentation.duration)
          : loopingFrameIndex(locomotion, this.time, key === 'yorang' ? 9 : 7, field.uid[i] * 0.37)
        entry.sprite.texture = this.frames[key][entry.frame]
      } else {
        entry.frame = 0
        entry.sprite.texture = this.textures.wisp
      }
      entry.sprite.anchor.set(0.5, actorFootPivot2D(key, entry.frame))
      const x = field.prevX[i] + (field.x[i] - field.prevX[i]) * alpha
      const z = field.prevZ[i] + (field.z[i] - field.prevZ[i]) * alpha
      const baseHeight = key === 'wisp' ? 72
        : key === 'yorang' ? SPRITE_MANIFEST.actors.yorang.runtimeHeight * (field.elite[i] ? 1.18 : 1)
          : key === 'jadeSerpent' ? SPRITE_MANIFEST.actors.jadeSerpent.runtimeHeight
          : key === 'jadeStoneGhoul' ? SPRITE_MANIFEST.actors.jadeStoneGhoul.runtimeHeight
          : key === 'bloodScorpion' ? SPRITE_MANIFEST.actors.bloodScorpion.runtimeHeight
          : key === 'talismanRevenant' ? SPRITE_MANIFEST.actors.talismanRevenant.runtimeHeight
          : SPRITE_MANIFEST.actors.voidSentinel.runtimeHeight * (field.elite[i] ? 1.06 : 0.9)
      const stride = Math.sin(this.time * (key === 'yorang' ? 12 : 8.5) + field.uid[i] * 0.91)
      const locomotionBob = key === 'yorang' ? -Math.abs(stride) * 2.4
        : key === 'voidSentinel' ? -Math.abs(stride) * 1.2 : 0
      const pulse = key === 'wisp' ? Math.sin(this.time * 5 + field.uid[i]) * 4
        : key === 'talismanRevenant' ? Math.sin(this.time * 3.5 + field.uid[i]) * 2.5
          : locomotionBob
      const tint = enemyActorTint2D(def.color ?? 0xa880db, key, field.flash[i] > 0)
      const sizeVariation = 1 + ((field.uid[i] % 7) - 3) * 0.012
      const spawnProgress = Math.max(0, Math.min(1, (field.age?.[i] ?? 1) / 0.24))
      const spawnEase = 1 - (1 - spawnProgress) ** 3
      const grounding = actorGroundingProfile2D(key, entry.frame)
      const visualHeight = baseHeight * this._presentationScale * (def.scale ?? 1) * grounding.visualScale
        * sizeVariation * (0.78 + spawnEase * 0.22)
      this._placeActor(entry, x, z, visualHeight,
        (field.dead[i] ? 0.25 : 1) * spawnEase,
        field.facing[i], tint, pulse)
      // During a boss encounter the boss silhouette is the current objective.
      // Fade only ordinary mobs in its local radius; distant enemies and elite
      // variants retain their authored opacity so the arena does not turn into
      // a blanket dim layer.
      const boss = field.world?.boss
      const bossActive = Boolean(boss?.active)
      const bossDistance = bossActive && Number.isFinite(boss.x) && Number.isFinite(boss.z)
        ? Math.hypot(x - boss.x, z - boss.z) : Number.POSITIVE_INFINITY
      const bossFocusAlpha = enemyBossFocusAlpha2D(bossDistance, bossActive, Boolean(field.elite?.[i]))
      entry.sprite.alpha *= bossFocusAlpha
      entry.shadow.alpha *= 0.74 + bossFocusAlpha * 0.26
      const player = field.world?.player
      if (player) {
        const overlapAlpha = enemyHeroOverlapAlpha2D(Math.hypot(x - player.x, z - player.z))
        entry.sprite.alpha *= overlapAlpha
        entry.shadow.alpha *= 0.72 + overlapAlpha * 0.28
      }
      const contactPulse = 0.94 + Math.sin(this.time * 2.8 + field.uid[i] * 0.61) * 0.06
      entry.contact.position.set(_screen.x, _screen.y + grounding.shadowOffsetY - visualHeight * grounding.contactLift)
      entry.contact.width = Math.max(20, visualHeight * grounding.contactWidth) * contactPulse
      entry.contact.height = Math.max(7, visualHeight * grounding.contactHeight) * contactPulse
      entry.contact.tint = field.flash[i] > 0
        ? 0xff8d8d
        : blendTint2D(
            mixTint2D(def.color ?? grounding.contactTint, grounding.contactTint),
            0xe5fbff,
            key === 'wisp' ? 0 : 0.22,
          )
      entry.contact.alpha = grounding.contactAlpha * spawnEase
        * (field.dead[i] ? 0.22 : field.elite?.[i] ? 1.35 : 1) * bossFocusAlpha
      entry.contact.visible = entry.sprite.visible
      if (key === 'wisp') {
        // Additive wisps interleaved with opaque actors forced a blend-state
        // break at almost every depth-sorted enemy (400+ draws in stress QA).
        // Their authored alpha and local glow still read cleanly in normal mode
        // while the entire horde stays in Pixi's multi-texture batch.
        entry.sprite.blendMode = 'normal'
        entry.sprite.rotation = this.time * 0.72 + field.uid[i] * 0.31
        entry.sprite.alpha *= 0.82 + Math.sin(this.time * 4.4 + field.uid[i]) * 0.1
      } else {
        entry.sprite.blendMode = 'normal'
        const attackKick = field.attackTimer[i] > 0
          ? Math.sin((field.attackTimer[i] / attackDuration) * Math.PI) * 0.055
          : 0
        entry.sprite.rotation = stride * (key === 'yorang' ? 0.018 : 0.01) + attackKick
        entry.sprite.scale.x *= 1 + stride * (key === 'yorang' ? 0.026 : 0.012)
        entry.sprite.scale.y *= 1 - stride * (key === 'yorang' ? 0.018 : 0.008)
        if (field.flash[i] > 0) {
          entry.sprite.scale.x *= 1.055
          entry.sprite.scale.y *= 1.055
        }
        entry.shadow.alpha *= 0.8 + Math.abs(stride) * 0.14
      }
      const intent = entry.intent
      intent.visible = intentPresentation.visible && entry.sprite.visible
      if (intent.visible) {
        const intentProgress = Math.max(0, Math.min(1,
          1 - intentPresentation.remaining / intentPresentation.duration,
        ))
        const intentScale = Math.max(0.28, baseHeight * this._presentationScale / 360)
        intent.position.set(_screen.x, _screen.y + 4)
        intent.scale.set(intentScale * (1.12 + intentProgress * 0.18), intentScale * 0.48)
        intent.rotation = -this.time * 0.7
        intent.tint = field.behavior[i] === 1
          ? 0xff7c96
          : intentPresentation.preContact ? 0xffb85c : 0xf2c76f
        intent.alpha = (intentPresentation.preContact ? 0.28 : 0.2)
          + Math.sin(intentProgress * Math.PI) * 0.24
      }
    }
    for (let i = field.count; i < this.enemyPool.length; i++) {
      this.enemyPool[i].sprite.visible = false
      this.enemyPool[i].shadow.visible = false
      this.enemyPool[i].contact.visible = false
      this.enemyPool[i].intent.visible = false
    }
  }

  _renderHero(player, alpha) {
    const t = player.teleported ? 1 : alpha
    const x = player.prevX + (player.x - player.prevX) * t
    const z = player.prevZ + (player.z - player.prevZ) * t
    projectWorld(x, z, this.cameraX, this.cameraZ, this.viewport, _screen)
    const moving = player.speed01 > 0.08
    const heroDef = SPRITE_MANIFEST.actors.seolryeong
    const heroHeight = heroCombatHeight2D(this.viewport.height, heroDef.runtimeHeight)
    const direction = heroDirectionFor(player)
    const directionalFrames = directionalHeroFrames(this.frames, direction)
    let frame = heroDef.animations.idle[0]
    if (player.attackTimer > 0) {
      frame = oneShotFrameIndex(heroDef.animations.attack, player.attackTimer, 0.32)
    } else if (player.dashing > 0) {
      frame = oneShotFrameIndex(heroDef.animations.dash, player.dashing, 0.16)
    } else if (moving) {
      frame = loopingFrameIndex(heroDef.animations.run, this.time, 10)
    }
    this.hero.texture = directionalFrames[frame]
    this.hero.anchor.y = heroFootPivot2D(direction.key, frame)
    // Grounded locomotion may lift a foot, but the body must never oscillate
    // below the sampled contact row. Idle motion is carried by the breath scale.
    const bob = moving ? -Math.abs(Math.sin(this.time * 10)) * 0.85 : 0
    setHeight(this.hero, heroHeight, direction.mirror)
    if (!moving && player.attackTimer <= 0 && player.dashing <= 0) {
      const breath = Math.sin(this.time * 2.2)
      this.hero.scale.x *= 1 - breath * 0.004
      this.hero.scale.y *= 1 + breath * 0.012
    }
    this.hero.position.set(_screen.x, _screen.y + bob)
    this.hero.rotation = 0
    this.hero.tint = player.hitFlash > 0 ? 0xffdddd : 0xffffff
    this.hero.alpha = player.invulnTimer > 0 ? 0.9 : 1
    this.hero.zIndex = _screen.y
    const grounding = actorGroundingProfile2D('hero', frame)
    this.heroShadow.position.set(_screen.x, _screen.y + grounding.shadowOffsetY)
    this.heroShadow.width = Math.max(grounding.minShadowWidth, heroHeight * grounding.shadowWidth)
    this.heroShadow.height = Math.max(grounding.minShadowHeight, heroHeight * grounding.shadowHeight)
    this.heroShadow.alpha = grounding.shadowAlpha
    this.heroAura.position.set(_screen.x, _screen.y + 1)
    const auraPulse = 0.96 + Math.sin(this.time * 2.4) * 0.04
    this.heroAura.width = heroHeight * HERO_AURA_PRESENTATION_2D.widthRatio * auraPulse
    this.heroAura.height = heroHeight * HERO_AURA_PRESENTATION_2D.heightRatio * auraPulse
    this.heroAura.alpha = player.invulnTimer > 0
      ? HERO_AURA_PRESENTATION_2D.invulnerableAlpha
      : HERO_AURA_PRESENTATION_2D.alpha
    this.heroAura.visible = this.hero.visible
    this.heroMarker.position.set(_screen.x, _screen.y + HERO_GROUND_MARKER_2D.offsetY)
    this.heroMarker.width = heroHeight * HERO_GROUND_MARKER_2D.widthRatio * auraPulse
    this.heroMarker.height = heroHeight * HERO_GROUND_MARKER_2D.heightRatio * auraPulse
    this.heroMarker.alpha = player.invulnTimer > 0 ? 0.26 : HERO_GROUND_MARKER_2D.alpha
    this.heroMarker.tint = 0xa9ecff
    this.heroMarker.rotation = HERO_GROUND_MARKER_2D.rotation
    this.heroMarker.visible = this.hero.visible
    this.heroReadability.texture = this.hero.texture
    this.heroReadability.anchor.y = this.hero.anchor.y
    this.heroReadability.position.set(this.hero.position.x, this.hero.position.y)
    this.heroReadability.scale.set(
      this.hero.scale.x * HERO_READABILITY_RIM_2D.scale,
      this.hero.scale.y * HERO_READABILITY_RIM_2D.scale,
    )
    this.heroReadability.rotation = this.hero.rotation
    this.heroReadability.tint = player.hitFlash > 0
      ? HERO_READABILITY_RIM_2D.hitTint : HERO_READABILITY_RIM_2D.tint
    this.heroReadability.alpha = player.invulnTimer > 0
      ? HERO_READABILITY_RIM_2D.invulnerableAlpha : HERO_READABILITY_RIM_2D.alpha
    this.heroReadability.zIndex = this.hero.zIndex + HERO_READABILITY_RIM_2D.zOffset
    this.heroReadability.visible = this.hero.visible
    const bucket = depthBucket(_screen.y, this.viewport.height)
    if (this.heroReadability.parent !== this.actorBuckets[bucket]) {
      this.actorBuckets[bucket].addChild(this.heroReadability)
    }
    if (this.hero.parent !== this.actorBuckets[bucket]) this.actorBuckets[bucket].addChild(this.hero)
    const slash = heroSlashPresentation2D(
      player.facing,
      player.attackTimer,
      heroHeight,
      _screen.unit,
      _screen.depthUnit,
    )
    this.heroSlash.position.set(_screen.x + slash.offsetX, _screen.y + slash.offsetY)
    this.heroSlash.width = slash.width
    this.heroSlash.height = slash.height
    this.heroSlash.rotation = slash.rotation
    this.heroSlash.alpha = slash.alpha
    this.heroSlash.tint = 0xd9f8ff
    this.heroSlash.visible = slash.visible && slash.alpha > 0.02 && this.hero.visible
  }

  _updateBossCastPill(boss, profile) {
    const pill = this.bossCastPill
    if (!pill) return
    const castTimer = Number(boss?.castTimer ?? 0)
    if (!boss?.active || castTimer <= 0 || !profile) {
      pill.hidden = true
      pill.classList.remove('show')
      this._bossCastPillKey = ''
      return
    }
    const tenths = Math.max(0, Math.ceil(castTimer * 10))
    const key = `${profile.id}|${profile.label}|${tenths}|${profile.color}`
    if (key !== this._bossCastPillKey) {
      this._bossCastPillKey = key
      pill.textContent = `전조 · ${profile.label} · ${(tenths / 10).toFixed(1)}초`
      pill.style.setProperty('--boss-cast-color', `#${(profile.color >>> 0).toString(16).padStart(6, '0')}`)
    }
    pill.hidden = false
    pill.classList.add('show')
  }

  _renderBoss(boss, alpha) {
    if (!boss?.active) {
      this.boss.visible = false
      this.bossShadow.visible = false
      this.bossContact.visible = false
      this.bossIntent.visible = false
      if (this.bossDangerZone) this.bossDangerZone.visible = false
      this._updateBossCastPill(null, null)
      return
    }
    this.boss.visible = true
    this.bossShadow.visible = true
    this.bossContact.visible = true
    const x = boss.prevX + (boss.x - boss.prevX) * alpha
    const z = boss.prevZ + (boss.z - boss.prevZ) * alpha
    projectWorld(x, z, this.cameraX, this.cameraZ, this.viewport, _screen)
    const wolfBoss = boss.def.id === 'blueWolfKing'
    const bossDef = wolfBoss ? SPRITE_MANIFEST.actors.yorang : SPRITE_MANIFEST.actors.jadeVoidWarden
    const bossFrames = wolfBoss ? this.frames.yorang : this.frames.jadeVoidWarden
    const idleFrames = bossDef.animations.idle ?? bossDef.animations.walk
    const castFrames = bossDef.animations.cast ?? bossDef.animations.attack ?? idleFrames
    const castActive = boss.castTimer > 0
    const frame = castActive
      ? oneShotFrameIndex(castFrames, boss.castTimer, boss.castDuration ?? 0.58)
      : loopingFrameIndex(idleFrames, this.time, wolfBoss ? 7 : 5)
    this.boss.texture = bossFrames[frame]
    const groundingKey = wolfBoss ? 'yorang' : 'jadeVoidWarden'
    this.boss.anchor.set(0.5, actorFootPivot2D(groundingKey, frame))
    const mirror = boss.x > this.cameraX
    const authoredHeight = wolfBoss
      ? Math.max(220, bossDef.runtimeHeight * 2.55)
      : boss.def.id === 'jadeVoidWarden' ? bossDef.runtimeHeight : 210
    const height = bossCombatHeight2D(this.viewport.height, authoredHeight, this._presentationScale)
    setHeight(this.boss, height, mirror)
    this.boss.position.set(_screen.x, _screen.y - Math.abs(Math.sin(this.time * 2.1)) * 1.2)
    this.boss.tint = boss.hitFlash > 0
      ? 0xffffff
      : wolfBoss
        ? 0x6ca8ff
        : boss.def.id === 'jadeVoidWarden'
          ? 0xffffff
          : enemyActorTint2D(boss.def.color, 'jadeVoidWarden')
    this.boss.zIndex = _screen.y
    const grounding = actorGroundingProfile2D(groundingKey, frame)
    this.bossShadow.position.set(_screen.x, _screen.y + grounding.shadowOffsetY)
    this.bossShadow.width = Math.max(grounding.minShadowWidth, height * grounding.shadowWidth)
    this.bossShadow.height = Math.max(grounding.minShadowHeight, height * grounding.shadowHeight)
    this.bossShadow.alpha = grounding.shadowAlpha
    const contactPulse = 0.96 + Math.sin(this.time * 2.4) * 0.04
    this.bossContact.position.set(_screen.x, _screen.y + grounding.shadowOffsetY - height * grounding.contactLift)
    this.bossContact.width = Math.max(104, height * grounding.contactWidth) * contactPulse
    this.bossContact.height = Math.max(28, height * grounding.contactHeight) * contactPulse
    this.bossContact.tint = boss.def.id === 'jadeVoidWarden'
      ? grounding.contactTint
      : mixTint2D(boss.def.color, grounding.contactTint)
    this.bossContact.alpha = grounding.contactAlpha
    this.bossIntent.visible = castActive
    if (this.bossIntent.visible) {
      const castProgress = 1 - boss.castTimer / Math.max(0.001, boss.castDuration ?? 0.58)
      this.bossIntent.position.set(_screen.x, _screen.y + 8)
      this.bossIntent.scale.set(1.32 + castProgress * 0.48, 0.54 + castProgress * 0.14)
      this.bossIntent.rotation = this.time * 0.8
      this.bossIntent.tint = wolfBoss ? 0x6ca8ff : boss.patternColor ?? boss.def.color
      this.bossIntent.alpha = 0.34 + Math.sin(castProgress * Math.PI) * 0.3
    }
    const profile = bossTelegraphProfile2D(boss)
    if (this.bossDangerZone) {
      this.bossDangerZone.visible = castActive
      if (castActive) {
        const castProgress = 1 - boss.castTimer / Math.max(0.001, boss.castDuration ?? 0.58)
        drawBossTelegraph2D(
          this.bossDangerZone, profile, this.cameraX, this.cameraZ, this.viewport, castProgress,
        )
      }
    }
    this._updateBossCastPill(boss, profile)
    const bucket = depthBucket(_screen.y, this.viewport.height)
    if (this.boss.parent !== this.actorBuckets[bucket]) this.actorBuckets[bucket].addChild(this.boss)
  }

  _renderWeaponFields(field) {
    const count = Math.min(field?.count ?? 0, MAX_WEAPON_FIELDS_2D)
    for (let i = 0; i < count; i++) {
      const sprite = this.weaponFieldPool[i]
      const kind = field.kind?.[i] ?? 1
      const behavior = field.behavior?.[i]
      const visual = weaponFieldVisualForBehavior(behavior, kind)
      const life = Number.isFinite(field.life?.[i]) ? field.life[i] : 0
      const maxLife = Number.isFinite(field.maxLife?.[i]) ? field.maxLife[i] : 1
      const statusPulse = behavior?.statusEffects?.freeze?.enabled || behavior?.statusEffects?.burn?.enabled ? 0.035 : 0
      const pulse = weaponFieldPulse2D(life, maxLife, this.time, i, visual.pulse + statusPulse)
      const collisionScale = Math.max(0.72, Math.min(1.45, behavior?.collision?.radiusScale ?? 1))
      const radius = Math.max(0.8, (field.radius?.[i] ?? 1) * (0.92 + collisionScale * 0.08))

      const fromX = Number(field.fromX?.[i])
      const fromZ = Number(field.fromZ?.[i])
      const toX = Number(field.toX?.[i])
      const toZ = Number(field.toZ?.[i])
      const worldSegmentLength = Math.hypot(toX - fromX, toZ - fromZ)
      const hasSegment = (field.segment?.[i] === 1 || worldSegmentLength > 0.05)
        && Number.isFinite(fromX) && Number.isFinite(fromZ)
        && Number.isFinite(toX) && Number.isFinite(toZ)
        && worldSegmentLength > 0.05

      if (hasSegment && this.textures.weaponFieldWall) {
        projectWorld(fromX, fromZ, this.cameraX, this.cameraZ, this.viewport, _segmentStart)
        projectWorld(toX, toZ, this.cameraX, this.cameraZ, this.viewport, _segmentEnd)
        const segmentX = (_segmentStart.x + _segmentEnd.x) * 0.5
        const segmentY = (_segmentStart.y + _segmentEnd.y) * 0.5 + 1
        const segmentPixels = Math.max(48, Math.min(760,
          Math.hypot(_segmentEnd.x - _segmentStart.x, _segmentEnd.y - _segmentStart.y)))
        const thickness = Math.max(18, Math.min(128, radius * _screen.unit * 0.62))
        const onScreen = isOnScreen(segmentX, segmentY, this.viewport, Math.max(90, thickness))
        const wallScaleX = segmentPixels / Math.max(1, this.textures.weaponFieldWall.width)
        const wallScaleY = thickness / Math.max(1, this.textures.weaponFieldWall.height)
        sprite.texture = this.textures.weaponFieldWall
        sprite.position.set(segmentX, segmentY)
        sprite.scale.set(wallScaleX * visual.scaleX * pulse, wallScaleY * visual.scaleY * pulse)
        sprite.rotation = Math.atan2(_segmentEnd.y - _segmentStart.y, _segmentEnd.x - _segmentStart.x)
        sprite.tint = mixTint2D(field.color?.[i], visual.tint)
        sprite.alpha = onScreen
          ? Math.min(0.9, (0.28 + (life / Math.max(0.05, maxLife)) * 0.38) * visual.alpha * pulse)
          : 0
        sprite.visible = onScreen
        continue
      }

      projectWorld(field.x[i], field.z[i], this.cameraX, this.cameraZ, this.viewport, _screen)
      const onScreen = isOnScreen(_screen.x, _screen.y, this.viewport, 90)
      const diameter = Math.max(34, Math.min(420, radius * _screen.unit * 2))
      const baseScale = diameter / Math.max(1, this.textures.weaponField.width)
      sprite.position.set(_screen.x, _screen.y + 1)
      sprite.scale.set(baseScale * visual.scaleX * pulse, baseScale * visual.scaleY * pulse)
      sprite.texture = this.textures.weaponFieldFrames?.[visual.frame] ?? this.textures.weaponField
      const orbitAngle = behavior?.trajectory?.orbit ? (field.orbitAngle?.[i] ?? 0) * 0.12 : 0
      sprite.rotation = this.time * visual.rotationSpeed + orbitAngle + (i % 5) * 0.08
      sprite.tint = mixTint2D(field.color?.[i], visual.tint)
      sprite.alpha = onScreen
        ? Math.min(0.82, (0.24 + (life / Math.max(0.05, maxLife)) * 0.34) * visual.alpha * pulse)
        : 0
      sprite.visible = onScreen
    }
    for (let i = count; i < this.weaponFieldPool.length; i++) this.weaponFieldPool[i].visible = false
  }

  _renderProjectiles(field, alpha) {
    const plan = planParticlePool2D(field.count, {
      budget: MAX_PROJECTILES_2D,
      maximum: MAX_PROJECTILES_2D,
      previousActiveCount: this.friendlyProjectilePool.activeCount + this.hostileProjectilePool.activeCount,
      currentAllocatedCount: this.friendlyProjectilePool.items.length + this.hostileProjectilePool.items.length,
      frameId: Math.floor(this.time * 60),
    })
    let friendlyCount = 0
    let hostileCount = 0
    for (const i of plan.indices) {
      if (field.hostile[i] === 1) hostileCount++
      else friendlyCount++
    }
    this.friendlyProjectilePool.setActiveCount(friendlyCount)
    this.hostileProjectilePool.setActiveCount(hostileCount)
    let friendlySlot = 0
    let hostileSlot = 0
    for (const i of plan.indices) {
      const hostile = field.hostile[i] === 1
      const item = hostile
        ? this.hostileProjectilePool.items[hostileSlot++]
        : this.friendlyProjectilePool.items[friendlySlot++]
      const x = field.prevX[i] + (field.x[i] - field.prevX[i]) * alpha
      const z = field.prevZ[i] + (field.z[i] - field.prevZ[i]) * alpha
      projectWorld(x, z, this.cameraX, this.cameraZ, this.viewport, _screen)
      item.x = _screen.x
      item.y = _screen.y
      const kind = field.kind?.[i] ?? 1
      const behavior = field.behaviorDescriptor?.[i]
      const visual = hostile
        ? hostileProjectileVisualFor(field, i)
        : projectilePresentationForBehavior(behavior, kind, false)
      if (!hostile) {
        item.texture = this.textures.projectileFrames[visual.frame]
        item.tint = projectileTintForBehavior2D(behavior, kind, field.color[i])
      } else {
        item.texture = this.textures.hostileProjectileFrames?.[visual.frame] ?? this.textures.wisp
        item.tint = mixTint2D(field.color?.[i], visual.tint)
      }
      const trajectory = behavior?.trajectory
      const effects = behavior?.statusEffects
      const orbiting = Boolean(trajectory?.orbit || effects?.orbit?.enabled)
      const returning = Boolean(trajectory?.returning || effects?.return?.enabled)
      const orbitAngle = orbiting ? (field.orbitAngle?.[i] ?? 0) * 0.08 : 0
      const returnAngle = returning && field.returnPhase?.[i] ? Math.PI : 0
      const collisionScale = Math.max(0.78, Math.min(1.28, behavior?.collision?.radiusScale ?? 1))
      const modeScale = behavior?.mode === 'delayedStrike' ? 1.08 : behavior?.mode === 'radialPulse' ? 0.94 : 1
      const statusScale = effects?.freeze?.enabled ? 1.08 : effects?.burn?.enabled ? 1.035 : effects?.slow?.enabled ? 0.97 : 1
      const statusAlpha = effects?.freeze?.enabled ? 1 : effects?.burn?.enabled ? 0.96 : 1
      const motion = Math.sin(this.time * (2.2 + visual.spin) + i * 0.61)
      const pulseX = 1 + motion * visual.pulse
      const pulseY = 1 - motion * visual.pulse * 0.38
      item.rotation = Math.atan2(field.dz[i] * 0.56, field.dx[i])
        + visual.rotationOffset + this.time * visual.spin * 0.08 + orbitAngle + returnAngle
      item.scaleX = visual.scaleX * collisionScale * modeScale * statusScale * pulseX
      item.scaleY = visual.scaleY * collisionScale * modeScale * statusScale * pulseY
      item.alpha = isOnScreen(_screen.x, _screen.y, this.viewport, 60)
        ? visual.alpha * statusAlpha * (0.9 + Math.abs(motion) * 0.1)
        : 0
    }
    // UVs are static particle attributes in Pixi. The atlas stays one shared
    // source (one batch), while this marks the frame selection dirty after a
    // pooled slot changes projectile kind.
    if (friendlyCount > 0) this.friendlyProjectileContainer.update()
    if (hostileCount > 0) this.hostileProjectileContainer.update()
  }

  _renderPickups(field, alpha) {
    const budget = Math.max(96, Math.floor(360 * this.quality.effectsDensity))
    const plan = planParticlePool2D(field.count, {
      budget,
      maximum: MAX_PICKUPS_2D,
      previousActiveCount: this.pickupPool.activeCount,
      currentAllocatedCount: this.pickupPool.items.length,
      frameId: Math.floor(this.time * 60),
    })
    this.pickupPool.setActiveCount(plan.activeCount)
    for (let slot = 0; slot < plan.activeCount; slot++) {
      const i = plan.indices[slot]
      const item = this.pickupPool.items[slot]
      const x = field.prevX[i] + (field.x[i] - field.prevX[i]) * alpha
      const z = field.prevZ[i] + (field.z[i] - field.prevZ[i]) * alpha
      projectWorld(x, z, this.cameraX, this.cameraZ, this.viewport, _screen)
      item.x = _screen.x
      item.y = _screen.y - 6 + Math.sin(this.time * 4 + field.phase[i]) * 3
      item.rotation = this.time * 0.9 + field.phase[i]
      item.scaleX = item.scaleY = field.stone[i] ? 0.38 : 0.22
      item.tint = field.stone[i] ? 0xf4d878 : 0x91dff4
      item.alpha = isOnScreen(_screen.x, _screen.y, this.viewport, 60) ? 0.84 : 0
    }
  }

  _renderEffects(field) {
    const plan = planEffectRenderSamples(field.kind, field.count, {
      density: this.quality.effectsDensity,
      frameId: Math.floor(this.time * 60),
    })
    this._ensureEffects(plan.activeCount)
    for (let slot = 0; slot < plan.activeCount; slot++) {
      const i = plan.indices[slot]
      const sprite = this.effectPool[slot]
      projectWorld(field.x[i], field.z[i], this.cameraX, this.cameraZ, this.viewport, _screen)
      const progress = 1 - field.life[i] / Math.max(0.001, field.maxLife[i])
      sprite.visible = true
      sprite.position.set(_screen.x, _screen.y)
      sprite.tint = field.color[i]
      const isRing = field.kind[i] === 2 || field.kind[i] === 3 || field.kind[i] === 4
      const isDeath = field.kind[i] === 5
      sprite.texture = isRing ? this.textures.ring : isDeath ? this.textures.death : this.textures.hit
      const requestedDiameter = field.radius[i] * _screen.unit * 2
      const diameter = isRing ? Math.min(260, requestedDiameter)
        : isDeath ? Math.min(110, requestedDiameter * 1.55) : Math.min(62, requestedDiameter)
      const scale = (diameter / Math.max(1, sprite.texture.width))
        * (isRing ? 0.5 + progress * 0.55 : isDeath ? 0.72 + progress * 0.7 : 0.72 + progress * 0.22)
      sprite.scale.set(scale, scale * (isRing ? 0.56 : 1))
      sprite.alpha = (1 - progress) * (isRing ? 0.3 : isDeath ? 0.72 : 0.62)
      sprite.rotation = isRing ? this.time * 0.2 : isDeath ? progress * 0.55 : progress * 0.2
    }
    for (let i = plan.activeCount; i < this.effectPool.length; i++) this.effectPool[i].visible = false
  }

  render(snapshot, alpha, dt) {
    if (!this.app || this._contextLost) return
    const started = performance.now()
    this.time += Math.min(dt, 0.1)
    if (this.runActive) {
      const targetX = snapshot.player.prevX + (snapshot.player.x - snapshot.player.prevX) * alpha
      const targetZ = snapshot.player.prevZ + (snapshot.player.z - snapshot.player.prevZ) * alpha
      this.cameraX = cameraFollowStep2D(this.cameraX, targetX, dt)
      this.cameraZ = cameraFollowStep2D(this.cameraZ, targetZ, dt)
      const shake = snapshot.world.shake
      if (shake > 0) {
        this.cameraX += Math.sin(this.time * 83) * shake * 0.035
        this.cameraZ += Math.cos(this.time * 71) * shake * 0.035
      }
      this.combatVista.position.set(
        this.combatVistaBaseX + Math.sin(this.cameraX * 0.018) * 12,
        this.combatVistaBaseY + Math.sin(this.cameraZ * 0.012) * 5,
      )
      this.farMountains.position.x = this.farMountainsBaseX - Math.sin(this.cameraX * 0.012) * 18
      this.nearMountains.position.x = this.nearMountainsBaseX - Math.sin(this.cameraX * 0.02) * 28
      projectWorld(this.cameraX, this.cameraZ, this.cameraX, this.cameraZ, this.viewport, _screen)
      this.floor.tilePosition.set(
        -this.cameraX * _screen.unit / Math.max(0.001, this.floor.tileScale.x),
        -this.cameraZ * _screen.depthUnit / Math.max(0.001, this.floor.tileScale.y),
      )
      projectWorld(0, 0, this.cameraX, this.cameraZ, this.viewport, _screen)
      this.floorRunes.position.set(_screen.x, _screen.y)
      this.floorRunes.width = 24 * _screen.unit
      this.floorRunes.height = 24 * _screen.depthUnit
      this.floorRunes.visible = isOnScreen(_screen.x, _screen.y, this.viewport, this.floorRunes.width * 0.5)
      this.nearMist.tilePosition.set(-this.time * 11 - this.cameraX * 2.1, Math.sin(this.time * 0.38) * 8)
      this._refreshMapChunks()
      this._renderMapChunks()
      this._renderWeaponFields(snapshot.weaponFields)
      this._renderProps()
      this._renderPois(snapshot.world.interactionsSnapshot, snapshot.world.nearbyPoiId)
      this._renderEnemies(snapshot.enemies, alpha)
      this._renderHero(snapshot.player, alpha)
      this._renderBoss(snapshot.world.boss, alpha)
      this._renderProjectiles(snapshot.projectiles, alpha)
      this._renderPickups(snapshot.pickups, alpha)
      this._renderEffects(snapshot.effects)
      this._renderDamageNumbers(dt)
    } else {
      this.titleHero.rotation = Math.sin(this.time * 0.8) * 0.006
      this.titleHero.position.y = this.viewport.height * 1.03 + Math.sin(this.time * 1.2) * 3
      this.floor.tilePosition.x = Math.sin(this.time * 0.05) * 8
    }
    this._frameDrawCalls = 0
    this._frameTriangles = 0
    this._countingDraws = true
    try {
      this.app.renderer.render({ container: this.app.stage })
    } finally {
      this._countingDraws = false
    }
    if (this._glMetricHandle) {
      this.drawCalls = this._frameDrawCalls
      this.triangles = Math.round(this._frameTriangles)
    } else {
      this.drawCalls = null
      this.triangles = null
    }
    this.lastRenderMs = performance.now() - started
  }

  _releaseSceneReferences() {
    for (const key of [
      'backdrop', 'backdropWash', 'combatSky', 'combatVista', 'farMountains', 'nearMountains', 'farMist',
      'floor', 'floorBlendMask', 'mapDecalLayer', 'mapDecalBlendMask', 'terrainMask', 'floorRunes', 'terrainGrade',
      'horizonMist', 'nearMist', 'horizonVeil', 'groundLightLayer', 'contactLightLayer', 'weaponFieldLayer', 'shadowLayer',
      'actorRoot', 'actorBuckets', 'friendlyProjectileContainer', 'hostileProjectileContainer',
      'pickupContainer', 'effectLayer', 'damageTextLayer', 'textures', 'frames', 'groundBaseTextures',
      'generatedFloorBase',
      'friendlyProjectilePool', 'hostileProjectilePool', 'pickupPool', 'heroAura', 'heroShadow', 'hero',
      'bossShadow', 'bossContact', 'bossIntent', 'bossDangerZone', 'boss', 'heroMarker', 'heroReadability', 'heroSlash', 'titleHero',
    ]) this[key] = null
    this.bossCastPill?.remove()
    this.bossCastPill = null
    this.enemyPool = []
    this.effectPool = []
    this.weaponFieldPool = []
    this.propPool = []
    this.poiPool = []
    this.mapDecalPool = []
    this.mapDecalTextures = []
    this.damageTextPool = []
    this._floorTileScale = null
    this._runAssetsReady = false
    this._runAssetsPromise = null
    this.activeMapChunkKey = ''
  }

  destroy() {
    this._destroyed = true
    if (this.canvas) {
      if (this._onContextLost) this.canvas.removeEventListener('webglcontextlost', this._onContextLost)
      if (this._onContextRestored) this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored)
    }
    this._restoreDrawMetrics()
    if (this.app) this.app.destroy(true, true)
    this.app = null
    this.onContextLost = null
    this.onContextRestored = null
    this._onContextLost = null
    this._onContextRestored = null
    this._releaseSceneReferences()
  }
}
