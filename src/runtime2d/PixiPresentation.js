import {
  Application, Assets, ColorMatrixFilter, Container, Graphics, Particle, ParticleContainer,
  Rectangle, Sprite, Text, Texture, TilingSprite,
} from 'pixi.js'
import { ENEMIES } from '../data/enemies.js'
import {
  createWorldFrame2D, groundTileOffsetFromFrame2D, projectWorldWithFrame2D,
  depthBucket, directionFor, isOnScreen, SORT_BUCKETS, viewportPresentationScale,
} from './projection.js'
import { WorldCamera2D } from './WorldCamera2D.js'
import { SPRITE_MANIFEST } from './spriteManifest.js'
import {
  bossReactionClipDuration2D, bossReactionPresentationDuration2D, bossReactionTiming2D,
  CONTACT_INTENT_SECONDS_2D, HERO_DEATH_REACTION_SECONDS_2D, HERO_HURT_REACTION_SECONDS_2D,
  MAX_PROJECTILES_2D, MAX_PICKUPS_2D, MAX_WEAPON_FIELDS_2D,
} from './CombatWorld2D.js'
import { choosePixiBackend, probeWebGLRenderer } from './backend.js'
import { planEffectRenderSamples, planParticlePool2D } from './ParticleBudget2D.js'
import {
  MAP_CHUNK_SIZE, MAP_GROUND_VARIANTS, MAX_ACTIVE_MAP_CHUNKS, MAX_ACTIVE_MAP_PROPS,
  MAP_REGION_TYPES, activeMapChunks, hashMapCell, mapChunkKey, propsForMapChunk,
} from './WorldMap2D.js'

const base = import.meta.env?.BASE_URL ?? './'
const ENVIRONMENT_URL = `${base}assets/environment/jade-sanctuary-environment-v2.webp`
const STONE_URL = `${base}assets/materials/environment/jade-pavilion-stone-v1.webp`
const JADE_GROUND_URL = `${base}assets/materials/environment/jade-mountain-courtyard-ground-v4.webp`
const JADE_GROUND_FALLBACK_URL = `${base}assets/materials/environment/jade-highland-ground-v1.webp`
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
const JADE_DECAL_EDGE_FEATHER = 96
const JADE_WORLD_PROJECTION_ASPECT = 2.52
const JADE_REGION_VARIANTS = 2

/**
 * Render at the monitor's native CSS-to-device pixel density. Effects may be
 * thinned on a slow machine, but the heroine, props and ground must never be
 * rasterized below one backing pixel per CSS pixel: doing so makes fine alpha
 * edges shimmer while the camera moves. The upper cap avoids runaway canvas
 * allocations on unusually dense displays.
 */
export function nativeRenderResolution2D(qualityScale = 1, devicePixelRatio = 1) {
  const quality = Math.max(0.85, Number(qualityScale) || 1)
  const density = Math.max(1, Number(devicePixelRatio) || 1)
  return Math.max(1, Math.min(2, quality * density))
}

/**
 * The authored actor plates are photographic/ink silhouettes, not nearest-
 * sampled pixel art. Keep their source sampler explicit and disable mipmaps
 * so a 384x256 cell does not switch between implicit filtering paths when it
 * is reduced to roughly 90 CSS pixels on a 1280px window. Actor geometry is
 * snapped by Pixi to the renderer's native backing-pixel grid below; that
 * removes subpixel alpha-edge shimmer without changing the authored size.
 */
export const ACTOR_TEXTURE_RENDER_CONTRACT_2D = Object.freeze({
  scaleMode: 'linear',
  autoGenerateMipmaps: false,
  mipmaps: 'disabled',
  roundPixels: true,
})

export function configureActorTexture2D(texture) {
  const source = texture?.source
  if (!source) return texture
  source.scaleMode = ACTOR_TEXTURE_RENDER_CONTRACT_2D.scaleMode
  source.autoGenerateMipmaps = ACTOR_TEXTURE_RENDER_CONTRACT_2D.autoGenerateMipmaps
  return texture
}

export function configureActorSprite2D(sprite) {
  if (sprite) sprite.roundPixels = ACTOR_TEXTURE_RENDER_CONTRACT_2D.roundPixels
  return sprite
}

/**
 * The combat atlas is assembled from several authored sources (character
 * plates, creature plates and shrine props). A shared grade is deliberately
 * applied at the scene boundary so those sources read as one ink-and-jade
 * world instead of unrelated photographic cut-outs. This is a presentation
 * treatment only: it never mutates source textures or gameplay colours.
 */
export const REALM_ART_DIRECTION_2D = Object.freeze({
  treatment: 'ink-jade-unified-grade',
  saturation: -0.2,
  contrast: 0.05,
  brightness: 1.04,
})

function createRealmArtGrade2D() {
  const grade = new ColorMatrixFilter()
  grade.saturate(REALM_ART_DIRECTION_2D.saturation, false)
  grade.contrast(REALM_ART_DIRECTION_2D.contrast, true)
  grade.brightness(REALM_ART_DIRECTION_2D.brightness, true)
  return grade
}

export const JADE_REGION_TEXTURE_ORDER_2D = Object.freeze(Object.keys(MAP_REGION_TYPES))

export function jadeRegionTextureIndex2D(regionId, variant = 0) {
  const fallback = JADE_REGION_TEXTURE_ORDER_2D.indexOf('jade_grove')
  const regionIndex = JADE_REGION_TEXTURE_ORDER_2D.indexOf(regionId)
  const safeRegionIndex = regionIndex >= 0 ? regionIndex : Math.max(0, fallback)
  const safeVariant = Math.abs(Math.floor(Number(variant) || 0)) % JADE_REGION_VARIANTS
  return safeRegionIndex * JADE_REGION_VARIANTS + safeVariant
}

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
  base: 'wrapped-aperiodic-material',
  baseAsset: 'jade-mountain-courtyard-ground-v4',
  fallbackAsset: 'jade-highland-ground-v1',
  authoredDetail: 'world-anchored-material-biomes',
  repeatsAuthoredPlate: false,
  baseTiling: 'wrapped-feathered-source-mosaic',
  viewportPlate: false,
  synthesisSize: 2048,
  authoredCropMode: 'seeded-wrapped-feather-crops',
  landmarkMotifs: 'seed-specific-nonsymbolic-material-forms',
  // The runtime surface contains dozens of wrapped, feathered source crops.
  // Its visible stones stay below actor scale while its outer period remains
  // larger than the viewport, so neither a hard seam nor a recognisable copy
  // of the original plate can slide through the frame.
  // A shorter, seamless macro period keeps the source from reading as one
  // giant photograph sliding underneath the actors. The ratio still matches
  // the projected depth, so stones remain materially proportioned.
  floorTileScale: Object.freeze({ x: 0.66, y: 0.4092 }),
  decalAlpha: 0.6,
  decalOverlap: 1.045,
  decalEdgeFeather: 96,
  layers: Object.freeze(['macro-base', 'world-chunk-detail', 'near-contact']),
  worldAnchored: true,
  baseline: 'shared-world-frame-foot-y',
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

// The opening fodder must read as a hostile spirit, not as ambient motes or
// dropped qi. Keep its mask upright and let only the body sway. Pickups use the
// opposite motion language: compact faceted gems that rotate continuously.
export const WISP_THREAT_PRESENTATION_2D = Object.freeze({
  silhouette: 'upright-eyed-wraith',
  baseHeight: 84,
  rotationAmplitude: 0.065,
  rotationRate: 2.1,
  alphaBase: 0.93,
  alphaPulse: 0.04,
})

export const PICKUP_PRESENTATION_2D = Object.freeze({
  qi: Object.freeze({
    baseScale: 0.35, pulseAmplitude: 0.045, alpha: 0.86,
    ageFadeStart: 7, ageFadeDuration: 25, minimumAlpha: 0.38,
  }),
  stone: Object.freeze({ baseScale: 0.58, pulseAmplitude: 0.045, alpha: 0.98 }),
})

export function wispThreatRotation2D(time, uid = 0) {
  return Math.sin(
    (Number(time) || 0) * WISP_THREAT_PRESENTATION_2D.rotationRate
      + (Number(uid) || 0) * 0.31,
  ) * WISP_THREAT_PRESENTATION_2D.rotationAmplitude
}

const ENEMY_MOTION_KEY_SALTS_2D = Object.freeze({
  wisp: 0x13a5f271,
  yorang: 0x2c6d3b87,
  jadeRidgeHound: 0x694bc2f1,
  jadeSerpent: 0x35f19ac3,
  jadeStoneGhoul: 0x47b2e56d,
  jadeShardGuardian: 0x8fb31e4d,
  bloodScorpion: 0x59c8712f,
  talismanRevenant: 0x6ae34d95,
  maskedSealRevenant: 0x3cb7a159,
  voidSentinel: 0x7d14b6e9,
  shadowSealDuelist: 0x4e6f2a91,
})

function enemyMotionNoise2D(uid, salt) {
  let value = (Math.floor(Number(uid) || 0) >>> 0) ^ (salt >>> 0)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000
}

/**
 * Authored silhouette swaps need low local discrepancy, not merely a good
 * global hash. Enemy ids arrive at regular roster strides; the general motion
 * hash could therefore turn ten visible demon cultivators into a 9:1 split.
 * This Weyl-style sequence stays deterministic per uid while keeping the
 * common 2-7 slot wave strides close to an even visual mixture.
 */
function enemySilhouetteVariant2D(uid, salt) {
  const value = (
    (Math.imul(Math.floor(Number(uid) || 0) >>> 0, 0x165667b1) >>> 0)
    + (salt >>> 0)
  ) >>> 0
  return value / 0x100000000
}

/**
 * Consecutive enemies are born in the same spawn pulse. A linear phase offset
 * made those neighbours advance in visible triplets, which read like a stamped
 * formation even though the atlas contained four frames. Cache this profile per
 * uid and spread phase, tempo and a restrained silhouette variation without
 * changing collision, movement, grounding or authored texture identity.
 */
export function enemyMotionProfile2D(uid = 0, key = 'wisp') {
  const salt = ENEMY_MOTION_KEY_SALTS_2D[key] ?? 0x1f123bb5
  const talismanFamily = key === 'talismanRevenant' || key === 'maskedSealRevenant'
  const sentinelFamily = key === 'voidSentinel' || key === 'shadowSealDuelist'
  const floating = key === 'wisp' || talismanFamily
  const stampProne = key === 'jadeStoneGhoul'
    || key === 'jadeShardGuardian'
    || talismanFamily
    || sentinelFamily
  const phase = enemyMotionNoise2D(uid, salt)
  const tempoSpread = stampProne ? 0.15 : 0.1
  const tempo = 1 - tempoSpread
    + enemyMotionNoise2D(uid, salt ^ 0x9e3779b9) * tempoSpread * 2
  const scaleSpread = key === 'jadeStoneGhoul' || key === 'jadeShardGuardian' ? 0.09
    : talismanFamily ? 0.075
      : sentinelFamily ? 0.07 : 0.06
  const scale = 1 - scaleSpread
    + enemyMotionNoise2D(uid, salt ^ 0x85ebca6b) * scaleSpread * 2
  const aspectRange = key === 'wisp' ? 0.1
    : talismanFamily ? 0.065
      : key === 'jadeStoneGhoul' || key === 'jadeShardGuardian' ? 0.055
        : sentinelFamily ? 0.04 : floating ? 0.045 : 0.018
  const aspect = 1 + (enemyMotionNoise2D(uid, salt ^ 0xc2b2ae35) * 2 - 1) * aspectRange
  const leanRange = key === 'wisp' ? 0.018
    : talismanFamily ? 0.016
      : key === 'jadeStoneGhoul' || key === 'jadeShardGuardian' ? 0.006
        : sentinelFamily ? 0.01 : 0
  const lean = (enemyMotionNoise2D(uid, salt ^ 0x27d4eb2f) * 2 - 1) * leanRange
  const bobScale = 0.86 + enemyMotionNoise2D(uid, salt ^ 0x165667b1) * 0.28
  const palette = enemyMotionNoise2D(uid, salt ^ 0xa24baed5)
  return Object.freeze({ phase, tempo, scale, aspect, lean, bobScale, palette })
}

export function enemyLocomotionFrame2D(indices, time, fps, motion) {
  const profile = motion ?? enemyMotionProfile2D(0)
  return loopingFrameIndex(
    indices,
    time,
    fps * profile.tempo,
    profile.phase * indices.length,
  )
}

/**
 * Locomotion is driven by the authored idle/run clip only while the actor has
 * actually advanced in the simulation. A stopped or frozen enemy must hold
 * the first authored pose; wall-clock animation otherwise makes its feet move
 * while its body is pinned in place.
 */
export function enemyMotionActive2D(field, index, threshold = 0.0001) {
  if (Number(field?.freezeTimer?.[index]) > 0) return false
  const x = Number(field?.x?.[index])
  const z = Number(field?.z?.[index])
  const prevX = Number(field?.prevX?.[index])
  const prevZ = Number(field?.prevZ?.[index])
  if (![x, z, prevX, prevZ].every(Number.isFinite)) return false
  return Math.hypot(x - prevX, z - prevZ) > Math.max(0, Number(threshold) || 0)
}

export function enemyLocomotionFrameIndex2D(indices, time, fps, motion, moving = true) {
  if (!Array.isArray(indices) || indices.length === 0) return 0
  return moving ? enemyLocomotionFrame2D(indices, time, fps, motion) : indices?.[0] ?? 0
}

export function pickupVisualScale2D(stone, presentationScale = 1, pulse = 0) {
  const profile = stone ? PICKUP_PRESENTATION_2D.stone : PICKUP_PRESENTATION_2D.qi
  const viewportScale = Math.max(0.8, Math.min(1.5, Number(presentationScale) || 1))
  const normalizedPulse = Math.max(-1, Math.min(1, Number(pulse) || 0))
  return profile.baseScale * viewportScale * (1 + normalizedPulse * profile.pulseAmplitude)
}

export function pickupVisualAlpha2D(stone, age = 0) {
  const profile = stone ? PICKUP_PRESENTATION_2D.stone : PICKUP_PRESENTATION_2D.qi
  if (stone || !Number.isFinite(profile.ageFadeStart)) return profile.alpha
  const fade = Math.max(0, Math.min(1,
    ((Number(age) || 0) - profile.ageFadeStart) / profile.ageFadeDuration,
  ))
  return Math.max(profile.minimumAlpha, profile.alpha * (1 - fade * 0.56))
}

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
  2: Object.freeze({ family: 'fire', shape: 'talisman-comet', preserveAtlasColor: true, frame: 1, scaleX: 0.54, scaleY: 0.32, rotationOffset: 0.035, spin: 0.04, pulse: 0.06, alpha: 0.94, tint: 0xff8a4f }),
  3: Object.freeze({ family: 'ice', frame: 2, scaleX: 0.54, scaleY: 0.22, rotationOffset: -0.16, spin: 0.02, pulse: 0.14, alpha: 0.92, tint: 0x8edcff }),
  4: Object.freeze({ family: 'thunder', shape: 'thunder-orb', preserveAtlasColor: true, frame: 3, scaleX: 0.38, scaleY: 0.38, rotationOffset: 0.22, spin: 1.1, pulse: 0.1, alpha: 0.96, tint: 0xb98cff }),
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
    projectile: { family: 'fire', shape: 'talisman-comet', preserveAtlasColor: true, frame: 1, scaleX: 0.56, scaleY: 0.34, rotationOffset: 0.03, spin: 0.04, pulse: 0.06, alpha: 0.94, tint: 0xff8a4f },
    field: { family: 'emberMark', frame: 1, scaleX: 1, scaleY: 0.56, rotationSpeed: -0.12, pulse: 0.13, alpha: 0.52, tint: 0xff9c4c },
  }),
  thunderOrb: weaponVisualSignature({
    mode: 'orbitContact', trajectory: 'orbit', collision: 'contact', status: 'orbit-knockback',
    projectile: { family: 'thunderOrb', shape: 'thunder-orb', preserveAtlasColor: true, frame: 3, scaleX: 0.36, scaleY: 0.36, rotationOffset: 0.12, spin: 1.15, pulse: 0.1, alpha: 0.96, tint: 0xb98cff },
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
    projectile: { family: 'inferno', shape: 'inferno-talisman-comet', preserveAtlasColor: true, frame: 1, scaleX: 0.72, scaleY: 0.42, rotationOffset: 0.06, spin: 0.06, pulse: 0.1, alpha: 0.98, tint: 0xff6038 },
    field: { family: 'infernoSea', frame: 1, scaleX: 1.32, scaleY: 0.78, rotationSpeed: -0.35, pulse: 0.28, alpha: 0.78, tint: 0xff542f },
  }),
  violetThunder: weaponVisualSignature({
    mode: 'chainingOrbit', trajectory: 'orbit', collision: 'chain', status: 'orbit-chain',
    projectile: { family: 'violetChain', shape: 'violet-thunder-orb', preserveAtlasColor: true, frame: 3, scaleX: 0.44, scaleY: 0.44, rotationOffset: 0.38, spin: 1.6, pulse: 0.14, alpha: 1, tint: 0xd1aaff },
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

// Orbit weapons pulse far more often than their three-second simulation
// lifetime. Keeping every collision body visible turns the evolved thunder
// weapon into a solid necklace that hides the heroine, boss and safe space.
// Simulation remains authoritative; the renderer keeps angularly distributed
// representatives while hit/death effects still expose every real impact.
// The budget is shared by every simultaneous friendly orbit behavior. A late
// build can evolve thunderOrb and then learn thunderOrb again; budgeting each
// behavior separately produced 28 near-identical pearls around the heroine.
export const ORBIT_PROJECTILE_RENDER_CAP_2D = 14

export function selectOrbitProjectileRenderIndices2D(
  indices,
  field,
  cap = ORBIT_PROJECTILE_RENDER_CAP_2D,
) {
  const source = Array.isArray(indices) ? indices : Array.from(indices ?? [])
  const safeCap = Math.max(1, Math.trunc(Number(cap) || ORBIT_PROJECTILE_RENDER_CAP_2D))
  const groups = new Map()
  let orbitingCount = 0

  for (const index of source) {
    const hostile = field?.hostile?.[index] === 1
    const behavior = field?.behaviorDescriptor?.[index]
    const orbiting = field?.orbit?.[index] === 1 || Boolean(behavior?.trajectory?.orbit)
    if (hostile || !orbiting) continue
    const key = behavior?.id ?? behavior?.weaponId ?? `kind:${field?.kind?.[index] ?? 0}`
    const group = groups.get(key) ?? []
    group.push(index)
    groups.set(key, group)
    orbitingCount++
  }

  if (orbitingCount <= safeCap) return source

  const keep = new Set()
  const tau = Math.PI * 2
  const entries = Array.from(groups.values())
  const budgets = new Array(entries.length).fill(0)
  let remaining = safeCap

  // Give every simultaneous orbit behavior a readable share before filling
  // spare slots. This avoids either the base or evolved 법보 disappearing when
  // their simulation body counts differ.
  while (remaining > 0) {
    let assigned = false
    for (let groupIndex = 0; groupIndex < entries.length && remaining > 0; groupIndex++) {
      if (budgets[groupIndex] >= entries[groupIndex].length) continue
      budgets[groupIndex]++
      remaining--
      assigned = true
    }
    if (!assigned) break
  }

  for (let groupIndex = 0; groupIndex < entries.length; groupIndex++) {
    const group = entries[groupIndex]
    const groupBudget = budgets[groupIndex]
    if (groupBudget <= 0) continue
    if (group.length <= groupBudget) {
      for (const index of group) keep.add(index)
      continue
    }

    const buckets = new Array(groupBudget).fill(-1)
    const bucketAges = new Array(groupBudget).fill(Infinity)
    for (const index of group) {
      const rawAngle = Number(field?.orbitAngle?.[index]) || 0
      const angle = ((rawAngle % tau) + tau) % tau
      const bucket = Math.min(groupBudget - 1, Math.floor(angle / tau * groupBudget))
      const age = Math.max(0, Number(field?.age?.[index]) || 0)
      if (buckets[bucket] < 0 || age < bucketAges[bucket]) {
        buckets[bucket] = index
        bucketAges[bucket] = age
      }
    }
    let keptForGroup = 0
    for (const index of buckets) {
      if (index < 0) continue
      keep.add(index)
      keptForGroup++
    }
    // Identical cast phases can occupy the same sector. Fill the remaining
    // budget in stable field order instead of leaving a lopsided half-ring.
    for (const index of group) {
      if (keptForGroup >= groupBudget) break
      if (keep.has(index)) continue
      keep.add(index)
      keptForGroup++
    }
  }

  return source.filter((index) => {
    const hostile = field?.hostile?.[index] === 1
    const behavior = field?.behaviorDescriptor?.[index]
    const orbiting = field?.orbit?.[index] === 1 || Boolean(behavior?.trajectory?.orbit)
    return hostile || !orbiting || keep.has(index)
  })
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

function sameWeaponFieldSemantic2D(field, left, right) {
  const leftBehavior = field.behavior?.[left]
  const rightBehavior = field.behavior?.[right]
  const leftSemantic = leftBehavior?.id ?? leftBehavior?.weaponId ?? null
  const rightSemantic = rightBehavior?.id ?? rightBehavior?.weaponId ?? null
  if (leftSemantic != null || rightSemantic != null) return leftSemantic === rightSemantic
  return (field.kind?.[left] ?? 0) === (field.kind?.[right] ?? 0)
    && (field.tag?.[left] ?? '') === (field.tag?.[right] ?? '')
}

/**
 * Persistent fields keep every collision body in the simulation, but a
 * late-game build can place 6-20 copies of the same glyph around one target.
 * Collapse only deeply overlapping copies of the same semantic field into one
 * crisp visual envelope. Distinct weapons, spaced coverage and Dao wall
 * segments retain individual glyphs and the simulation pool is never mutated.
 */
export function planWeaponFieldVisuals2D(field, output = [], marks = null) {
  const count = Math.min(Math.max(0, Math.trunc(field.count ?? 0)), MAX_WEAPON_FIELDS_2D)
  const assigned = marks?.length >= count ? marks : new Uint16Array(Math.max(1, count))
  assigned.fill(0, 0, count)
  let planned = 0

  for (let seed = 0; seed < count; seed++) {
    if (assigned[seed] !== 0) continue
    const clusterId = planned + 1
    assigned[seed] = clusterId
    const segment = field.segment?.[seed] === 1
    const seedX = Number(field.x?.[seed])
    const seedZ = Number(field.z?.[seed])
    const seedRadius = Math.max(0.1, Number(field.radius?.[seed]) || 0.1)
    let memberCount = 1
    let sumX = Number.isFinite(seedX) ? seedX : 0
    let sumZ = Number.isFinite(seedZ) ? seedZ : 0

    if (!segment && Number.isFinite(seedX) && Number.isFinite(seedZ)) {
      for (let other = seed + 1; other < count; other++) {
        if (assigned[other] !== 0 || field.segment?.[other] === 1) continue
        if (!sameWeaponFieldSemantic2D(field, seed, other)) continue
        const otherX = Number(field.x?.[other])
        const otherZ = Number(field.z?.[other])
        if (!Number.isFinite(otherX) || !Number.isFinite(otherZ)) continue
        const otherRadius = Math.max(0.1, Number(field.radius?.[other]) || 0.1)
        const deepOverlap = Math.max(0.8, Math.min(seedRadius, otherRadius) * 0.45)
        const dx = otherX - seedX
        const dz = otherZ - seedZ
        if (dx * dx + dz * dz > deepOverlap * deepOverlap) continue
        assigned[other] = clusterId
        memberCount++
        sumX += otherX
        sumZ += otherZ
      }
    }

    const centerX = sumX / memberCount
    const centerZ = sumZ / memberCount
    let envelopeRadius = seedRadius
    let renderIndex = seed
    let bestRemaining = -1
    for (let member = seed; member < count; member++) {
      if (assigned[member] !== clusterId) continue
      const memberX = Number(field.x?.[member])
      const memberZ = Number(field.z?.[member])
      const memberRadius = Math.max(0.1, Number(field.radius?.[member]) || 0.1)
      if (Number.isFinite(memberX) && Number.isFinite(memberZ)) {
        envelopeRadius = Math.max(
          envelopeRadius,
          Math.hypot(memberX - centerX, memberZ - centerZ) + memberRadius,
        )
      }
      const remaining = (Number(field.life?.[member]) || 0)
        / Math.max(0.05, Number(field.maxLife?.[member]) || 0.05)
      if (remaining > bestRemaining) {
        bestRemaining = remaining
        renderIndex = member
      }
    }

    const entry = output[planned] ?? (output[planned] = {})
    entry.index = renderIndex
    entry.x = segment ? seedX : centerX
    entry.z = segment ? seedZ : centerZ
    entry.radius = segment ? seedRadius : envelopeRadius
    entry.overlapCount = memberCount
    planned++
  }
  output.length = planned
  return output
}

export const COMBAT_HORIZON_RATIO_2D = COMBAT_HORIZON_RATIO

// Gameplay uses one opaque projected ground plane. A second horizon or skyline
// introduces a conflicting perspective and makes world motion read like a page
// sliding underneath screen-space actors.
export const COMBAT_HORIZON_PRESENTATION_2D = Object.freeze({
  mode: 'single-ground-plane',
  maskChannel: 'alpha',
  topFloorAlpha: 1,
  horizonVeilAlpha: 0,
  farMountainAlpha: 0,
  nearMountainAlpha: 0,
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
const HERO_DIRECTION_HYSTERESIS_RADIANS_2D = 0.16

function wrappedAngleDistance2D(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

function heroDirectionCenter2D(direction) {
  const sign = direction?.mirror ? -1 : 1
  if (direction?.key === 'n') return Math.PI
  if (direction?.key === 'ne') return sign * Math.PI * 0.75
  if (direction?.key === 'e') return sign * Math.PI * 0.5
  if (direction?.key === 'se') return sign * Math.PI * 0.25
  return 0
}

export function heroDirectionFor(player, previousDirection = null) {
  const facing = Number.isFinite(player?.facing) ? player.facing : 0
  const dx = Number(player?.x ?? 0) - Number(player?.prevX ?? 0)
  const dz = Number(player?.z ?? 0) - Number(player?.prevZ ?? 0)
  const hasMotion = Number(player?.speed01 ?? 0) > 0.08 && Math.hypot(dx, dz) > 0.0001
  const angle = hasMotion ? Math.atan2(dx, dz) : facing
  const candidate = directionFor(angle)
  if (!hasMotion || !previousDirection) return candidate
  if (candidate.key === previousDirection.key && candidate.mirror === previousDirection.mirror) {
    return candidate
  }
  // Near the north/south centre line, a tiny interpolated X delta must not
  // flip the whole 256px sheet every frame.
  if (candidate.key === previousDirection.key && Math.abs(Math.sin(angle)) < 0.32) {
    return previousDirection
  }
  const candidateDistance = wrappedAngleDistance2D(angle, heroDirectionCenter2D(candidate))
  const previousDistance = wrappedAngleDistance2D(angle, heroDirectionCenter2D(previousDirection))
  return previousDistance <= candidateDistance + HERO_DIRECTION_HYSTERESIS_RADIANS_2D
    ? previousDirection
    : candidate
}

/**
 * Enemy sectors use the same five authored views as the hero where available.
 * Keep the last sector while the raw facing angle is within the same 0.16 rad
 * hysteresis band; this prevents a one-pixel target/aim change from swapping a
 * reaction mirror or a north/south atlas during a one-shot clip.
 */
const ENEMY_DIRECTION_HYSTERESIS_RADIANS_2D = 0.16

function enemyDirectionMatches2D(angle, previousDirection) {
  const resolved = directionFor(angle)
  if (resolved.key !== previousDirection?.key) return false
  // North/south reaction atlases do not mirror, so their west/east bit is not
  // a visible state transition worth holding.
  return resolved.mirror === previousDirection?.mirror
    || resolved.key === 'n' || resolved.key === 's'
}

function enemyDirectionBoundaryDistance2D(angle, previousDirection) {
  const previousCenter = heroDirectionCenter2D(previousDirection)
  const delta = Math.atan2(
    Math.sin(previousCenter - angle),
    Math.cos(previousCenter - angle),
  )
  if (Math.abs(delta) < 0.000001) return Number.POSITIVE_INFINITY
  let low = 0
  let high = 1
  // Walk from the new sector back toward the previous sector and locate its
  // actual threshold. This respects the authored directionFor() boundaries;
  // comparing only pose centres would make the S/SE and SE/E bands asymmetric.
  for (let iteration = 0; iteration < 24; iteration++) {
    const mid = (low + high) * 0.5
    const probe = angle + delta * mid
    if (enemyDirectionMatches2D(probe, previousDirection)) high = mid
    else low = mid
  }
  return Math.abs(delta) * high
}

export function enemyDirectionFor2D(facing = 0, previousDirection = null) {
  const angle = Number.isFinite(facing) ? facing : 0
  const candidate = directionFor(angle)
  if (!previousDirection) return { angle, direction: candidate }
  if (enemyDirectionMatches2D(angle, previousDirection)) {
    return { angle, direction: candidate }
  }
  if (enemyDirectionBoundaryDistance2D(angle, previousDirection) <= ENEMY_DIRECTION_HYSTERESIS_RADIANS_2D) {
    return { angle: heroDirectionCenter2D(previousDirection), direction: previousDirection }
  }
  return { angle, direction: candidate }
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

export function directionalHeroReactionFrames(frames, direction) {
  return {
    n: frames?.seolryeongReactionN,
    ne: frames?.seolryeongReactionNe,
    e: frames?.seolryeongReactionE,
    se: frames?.seolryeongReaction,
    s: frames?.seolryeongReactionS,
  }[direction?.key] ?? frames?.seolryeongReactionS ?? frames?.seolryeongReaction
}

/** Resolve the streamed ground texture without discarding semantic regions. */
export function mapDecalTextureIndex2D(stageId, chunk) {
  if (!chunk) return 0
  return stageId === 'jade'
    ? jadeRegionTextureIndex2D(chunk.regionId, chunk.variant)
    : Math.max(0, Math.floor(Number(chunk.variant) || 0))
}

/**
 * Renderer-side map capacity contract. A streamed map must never silently
 * lose the last prop because the presentation pool is smaller than the pure
 * world generator. `_refreshMapChunks` records this result every refresh and
 * exposes the dropped count to QA/telemetry when a future content change
 * exceeds the bounded pool.
 */
export function mapPropPoolDiagnostic(activeCount, poolCapacity = MAX_ACTIVE_MAP_PROPS) {
  const active = Math.max(0, Math.floor(Number(activeCount) || 0))
  const capacity = Math.max(0, Math.floor(Number(poolCapacity) || 0))
  const droppedCount = Math.max(0, active - capacity)
  return Object.freeze({
    activeCount: active,
    poolCapacity: capacity,
    droppedCount,
    withinCapacity: droppedCount === 0,
  })
}

export function actorMirrorForFacing2D(actorKey, facing = 0) {
  const actor = SPRITE_MANIFEST.actors[actorKey]
  if (!actor?.mirrorWest) return false
  const authoredDirection = actor.directions?.[0] ?? 's'
  const horizontal = Math.sin(Number.isFinite(facing) ? facing : 0)
  // Single-direction atlases are authored either toward screen-left (SW) or
  // screen-right (SE). Mirror from that authored baseline, not from a global
  // assumption that was backwards for every SW atlas.
  if (authoredDirection.endsWith('w')) return horizontal > 0.15
  if (authoredDirection.endsWith('e')) return horizontal < -0.15
  return false
}

export function enemyDirectionalTextureKey2D(actorKey, directionKey) {
  const directionName = directionKey === 'n' ? 'north' : directionKey === 's' ? 'south' : null
  if (!directionName || !SPRITE_MANIFEST.actors[actorKey]?.directionalRuntime?.[directionName]?.url) return null
  return `${actorKey}${directionName === 'north' ? 'N' : 'S'}`
}

export function directionalEnemyFrames2D(frames, actorKey, facing = 0) {
  const direction = directionFor(Number.isFinite(facing) ? facing : 0)
  const directionalKey = enemyDirectionalTextureKey2D(actorKey, direction.key)
  if (directionalKey && Array.isArray(frames?.[directionalKey]) && frames[directionalKey].length) {
    return Object.freeze({
      frames: frames[directionalKey], directionKey: direction.key,
      pivotKey: directionalKey, mirror: false,
    })
  }
  return Object.freeze({
    frames: frames?.[actorKey] ?? [], directionKey: direction.key,
    pivotKey: actorKey, mirror: actorMirrorForFacing2D(actorKey, facing),
  })
}

function enemyReactionTextureKeyForDirection2D(actorKey, directionName = 'default') {
  if (!SPRITE_MANIFEST.actors[actorKey]?.reactionRuntime?.[directionName]?.url) return null
  if (directionName === 'north') return `${actorKey}ReactionN`
  if (directionName === 'south') return `${actorKey}ReactionS`
  return `${actorKey}Reaction`
}

export function enemyReactionTextureKey2D(actorKey, directionKey) {
  const directionName = directionKey === 'n' ? 'north' : directionKey === 's' ? 'south' : 'default'
  return enemyReactionTextureKeyForDirection2D(actorKey, directionName)
    ?? enemyReactionTextureKeyForDirection2D(actorKey, 'default')
}

export function directionalEnemyReactionFrames2D(frames, actorKey, facing = 0) {
  const direction = directionFor(Number.isFinite(facing) ? facing : 0)
  const reactionKey = enemyReactionTextureKey2D(actorKey, direction.key)
  if (!reactionKey || !Array.isArray(frames?.[reactionKey]) || !frames[reactionKey].length) return null
  const directional = reactionKey.endsWith('ReactionN') || reactionKey.endsWith('ReactionS')
  return Object.freeze({
    frames: frames[reactionKey], directionKey: direction.key,
    pivotKey: reactionKey, mirror: directional ? false : actorMirrorForFacing2D(actorKey, facing),
  })
}

export const JADE_VOID_WARDEN_REACTION_ATLAS_2D = Object.freeze({
  textureKey: 'jadeVoidWardenReaction',
  url: SPRITE_MANIFEST.actors.jadeVoidWarden.reactionRuntime.default.url,
  cell: Object.freeze([...SPRITE_MANIFEST.actors.jadeVoidWarden.reactionCell]),
  sheet: Object.freeze([...SPRITE_MANIFEST.actors.jadeVoidWarden.reactionSheet]),
  frameCount: SPRITE_MANIFEST.actors.jadeVoidWarden.reactionSheet[0]
    * SPRITE_MANIFEST.actors.jadeVoidWarden.reactionSheet[1],
})

export function enemyReactionFrameIndex2D(actor, state, remaining, duration) {
  const frames = actor?.reactionAnimations?.[state]
  if (!Array.isArray(frames) || frames.length === 0) return null
  return oneShotFrameIndex(frames, Math.max(0, Number(remaining) || 0), Math.max(0.001, Number(duration) || 0.001))
}

/**
 * Resolve a boss reaction frame from the manifest's authored timing. The
 * extra final frame interval represented by `holdLast` is deliberately part
 * of the same presentation window used by CombatWorld2D for result timing.
 */
export function bossReactionFrameIndex2D(actor, state, remaining) {
  const frames = actor?.reactionAnimations?.[state]
  const timing = bossReactionTiming2D(actor, state)
  const clipDuration = bossReactionClipDuration2D(actor, state)
  const presentationDuration = bossReactionPresentationDuration2D(actor, state)
  if (!Array.isArray(frames) || frames.length === 0 || !timing || !(clipDuration > 0)) return null
  const safeRemaining = Math.max(0, Number(remaining) || 0)
  const elapsed = presentationDuration - safeRemaining
  if (elapsed >= clipDuration) return timing.holdLast ? frames.at(-1) : null
  if (elapsed < 0) return frames[0]
  return oneShotFrameIndex(frames, clipDuration - elapsed, clipDuration)
}

const ENEMY_DIRECTIONAL_RUNTIME_ASSETS_2D = Object.freeze(
  Object.entries(SPRITE_MANIFEST.actors).flatMap(([actorKey, actor]) => {
    if (actorKey === 'seolryeong') return []
    return Object.entries(actor.directionalRuntime ?? {}).flatMap(([directionName, entry]) => {
      const directionKey = directionName === 'north' ? 'n' : directionName === 'south' ? 's' : null
      const textureKey = directionKey ? enemyDirectionalTextureKey2D(actorKey, directionKey) : null
      return textureKey && entry?.url
        ? [Object.freeze({ actorKey, actor, directionName, textureKey, url: entry.url })]
        : []
    })
  }),
)

const ENEMY_REACTION_RUNTIME_ASSETS_2D = Object.freeze(
  Object.entries(SPRITE_MANIFEST.actors).flatMap(([actorKey, actor]) => {
    if (actorKey === 'seolryeong') return []
    return Object.entries(actor.reactionRuntime ?? {}).flatMap(([directionName, entry]) => {
      const textureKey = enemyReactionTextureKeyForDirection2D(actorKey, directionName)
      return textureKey && entry?.url
        ? [Object.freeze({ actorKey, actor, directionName, textureKey, url: entry.url })]
        : []
    })
  }),
)

export const HERO_COMBAT_HEIGHT_TARGETS_2D = Object.freeze({
  baselineViewportHeight: 1080,
  baselineHeight: 196,
  largeViewportHeight: 1600,
  largeHeight: 276,
  minimumHeight: 134,
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
  moving = false,
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
  const locomotionScale = moving ? 0.74 : 1
  return {
    visible: remaining > 0,
    rotation: Math.atan2(ny, nx),
    // Keep the full stroke in front of the heroine. The previous centered
    // crescent was technically directional, but its dim rear half still read
    // as a large halo around the body in real 1920px combat captures.
    offsetX: nx * height * (moving ? 0.56 : 0.46),
    offsetY: -height * (moving ? 0.4 : 0.46) + ny * height * 0.18,
    width: height * 0.92 * locomotionScale,
    height: height * 0.46 * locomotionScale,
    alpha: Math.max(0, Math.sin(progress * Math.PI)) * (moving ? 0.62 : 0.9),
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
export const PROP_OPAQUE_BOTTOM_ROWS_2D = Object.freeze([215, 222, 222, 213, 227, 202, 205, 193])

const ACTOR_FOOT_PIVOTS_2D = Object.freeze({
  // The v4 heroine plates share a fixed 384x256 cell, but their opaque foot
  // row is not literally identical: the alpha>=0.5 bottom scan is 239-241
  // depending on the authored pose. Use that measured row per frame instead
  // of pretending the old 242px pivot is exact; the two-row span is below one
  // CSS pixel at the smallest supported presentation height.
  seolryeong: Object.freeze([241, 241, 241, 240, 241, 240, 241, 240, 241, 241, 240, 240, 240, 240, 241, 241].map((row) => row / 256)),
  seolryeongE: Object.freeze([240, 240, 240, 240, 240, 240, 241, 240, 240, 240, 241, 240, 240, 240, 240, 241].map((row) => row / 256)),
  seolryeongN: Object.freeze([240, 240, 240, 240, 241, 241, 241, 241, 240, 240, 240, 240, 240, 240, 241, 241].map((row) => row / 256)),
  seolryeongNe: Object.freeze([240, 240, 241, 240, 241, 240, 240, 240, 240, 240, 240, 240, 239, 240, 241, 240].map((row) => row / 256)),
  seolryeongS: Object.freeze([241, 241, 241, 240, 240, 241, 240, 240, 240, 241, 240, 240, 241, 240, 241, 240].map((row) => row / 256)),
  yorang: Object.freeze([0.797, 0.797, 0.781, 0.75, 0.734, 0.727, 0.727, 0.75]),
  yorangN: Object.freeze(Array(8).fill(232 / 256)),
  yorangS: Object.freeze(Array(8).fill(232 / 256)),
  jadeRidgeHoundN: Object.freeze(Array(8).fill(232 / 256)),
  jadeRidgeHoundS: Object.freeze(Array(8).fill(232 / 256)),
  jadeRidgeHound: Object.freeze([
    206 / 256, 206 / 256, 206 / 256, 206 / 256,
    194 / 256, 186 / 256, 201 / 256, 198 / 256,
  ]),
  jadeSerpent: Object.freeze([0.953, 0.953, 0.953, 0.945, 0.953, 0.953, 0.953, 0.953]),
  jadeSerpentN: Object.freeze(Array(8).fill(244 / 256)),
  jadeSerpentS: Object.freeze(Array(8).fill(244 / 256)),
  jadeStoneGhoul: Object.freeze([0.953, 0.953, 0.953, 0.953, 0.953, 0.953, 0.953, 0.953]),
  jadeShardGuardian: Object.freeze([
    223 / 256, 221 / 256, 221 / 256, 225 / 256,
    221 / 256, 218 / 256, 230 / 256, 225 / 256,
  ]),
  bloodScorpion: Object.freeze([0.844, 0.852, 0.844, 0.844, 0.742, 0.805, 0.836, 0.828]),
  talismanRevenant: Object.freeze([0.906, 0.891, 0.906, 0.914, 0.859, 0.867, 0.883, 0.859]),
  maskedSealRevenant: Object.freeze([
    217 / 256, 223 / 256, 214 / 256, 223 / 256,
    215 / 256, 209 / 256, 207 / 256, 210 / 256,
  ]),
  voidSentinel: Object.freeze([0.898, 0.906, 0.906, 0.914, 0.836, 0.859, 0.82, 0.867]),
  shadowSealDuelist: Object.freeze([
    232 / 256, 232 / 256, 231 / 256, 232 / 256,
    215 / 256, 220 / 256, 217 / 256, 217 / 256,
  ]),
  jadeVoidWarden: Object.freeze([0.945, 0.938, 0.945, 0.938, 0.922, 0.922, 0.914, 0.93]),
  wisp: Object.freeze([0.902, 0.895, 0.898, 0.906, 0.824, 0.848, 0.832, 0.824]),
  prop: Object.freeze(PROP_OPAQUE_BOTTOM_ROWS_2D.map((row) => row / 256)),
})

// Reaction atlases are not guaranteed to share the locomotion sheet's bottom
// row. The yorang north/south sheets contain a shorter death collapse, so
// sample contact rows per frame instead of making hurt/death poses float.
const ACTOR_REACTION_FOOT_PIVOTS_2D = Object.freeze({
  yorangReaction: Object.freeze(Array(8).fill(231 / 256)),
  yorangReactionN: Object.freeze([219, 219, 219, 218, 202, 201, 202, 202].map((row) => row / 256)),
  yorangReactionS: Object.freeze([208, 207, 209, 209, 204, 204, 204, 204].map((row) => row / 256)),
  jadeRidgeHoundReaction: Object.freeze(Array(8).fill(231 / 256)),
  jadeRidgeHoundReactionN: Object.freeze([231, 231, 231, 230, 231, 231, 231, 230].map((row) => row / 256)),
  jadeRidgeHoundReactionS: Object.freeze([231, 231, 231, 231, 230, 230, 231, 230].map((row) => row / 256)),
  jadeSerpentReaction: Object.freeze(Array(8).fill(232 / 256)),
  jadeSerpentReactionN: Object.freeze(Array(8).fill(232 / 256)),
  jadeSerpentReactionS: Object.freeze(Array(8).fill(232 / 256)),
  jadeStoneGhoulReaction: Object.freeze(Array(8).fill(232 / 256)),
  jadeStoneGhoulReactionN: Object.freeze(Array(8).fill(232 / 256)),
  jadeStoneGhoulReactionS: Object.freeze(Array(8).fill(232 / 256)),
})

const HERO_DIRECTION_PIVOT_KEY_2D = Object.freeze({
  n: 'seolryeongN', ne: 'seolryeongNe', e: 'seolryeongE', se: 'seolryeong', s: 'seolryeongS',
})

const HERO_REACTION_PIVOT_KEY_2D = Object.freeze({
  n: 'seolryeongReactionN', ne: 'seolryeongReactionNe', e: 'seolryeongReactionE',
  se: 'seolryeongReaction', s: 'seolryeongReactionS',
})

const HERO_REACTION_FOOT_PIVOTS_2D = Object.freeze({
  seolryeongReaction: Object.freeze([243, 243, 243, 243, 243, 242, 243, 242].map((row) => row / 256)),
  seolryeongReactionE: Object.freeze([243, 243, 243, 243, 243, 243, 237, 243].map((row) => row / 256)),
  seolryeongReactionN: Object.freeze([242, 242, 243, 242, 242, 242, 242, 242].map((row) => row / 256)),
  seolryeongReactionNe: Object.freeze([243, 243, 243, 242, 243, 243, 241, 243].map((row) => row / 256)),
  seolryeongReactionS: Object.freeze([243, 243, 243, 243, 242, 242, 243, 242].map((row) => row / 256)),
})

const HERO_REACTION_PRESENTATION_SCALES_2D = Object.freeze({
  // One fixed scale per directional reaction clip; never resize individual
  // hurt/death frames, which would read as a visible pop.
  n: 1.076, ne: 0.998, e: 1.04, se: 0.976, s: 0.963,
})

export function actorFootPivot2D(key, frame = 0) {
  const pivots = ACTOR_FOOT_PIVOTS_2D[key]
    ?? ACTOR_REACTION_FOOT_PIVOTS_2D[key]
    ?? HERO_REACTION_FOOT_PIVOTS_2D[key]
  const index = Math.max(0, Math.floor(Number(frame) || 0))
  if (pivots) return pivots[index % pivots.length]
  const actorKey = String(key).replace(/Reaction(?:N|S)?$/, '')
  return SPRITE_MANIFEST.actors[actorKey]?.reactionPivot?.[1]
    ?? SPRITE_MANIFEST.actors[actorKey]?.pivot?.[1]
    ?? 0.9
}

/**
 * Authored prop contact contract. The sprite anchor, shadow baseline and
 * irregular footprint all resolve to the same opaque bottom row; keeping this
 * calculation pure makes the 1080p contact tolerance testable without Pixi.
 */
export function propGroundContactProfile2D(frame = 0, renderedHeight = 196) {
  const index = Math.max(0, Math.floor(Number(frame) || 0)) % PROP_OPAQUE_BOTTOM_ROWS_2D.length
  const height = Math.max(1, Number(renderedHeight) || 1)
  const opaqueBottomRatio = PROP_OPAQUE_BOTTOM_ROWS_2D[index] / 256
  const pivot = actorFootPivot2D('prop', index)
  return Object.freeze({
    frame: index,
    opaqueBottomRow: PROP_OPAQUE_BOTTOM_ROWS_2D[index],
    opaqueBottomRatio,
    pivot,
    renderedHeight: height,
    contactOffsetPx: 0,
    contactErrorPx: (opaqueBottomRatio - pivot) * height,
  })
}

export function heroFootPivot2D(directionKey, frame = 0) {
  return actorFootPivot2D(HERO_DIRECTION_PIVOT_KEY_2D[directionKey] ?? 'seolryeongS', frame)
}

export function heroReactionFootPivot2D(directionKey, frame = 0) {
  return actorFootPivot2D(HERO_REACTION_PIVOT_KEY_2D[directionKey] ?? 'seolryeongReactionS', frame)
}

export function heroReactionPresentationScale2D(directionKey = 's') {
  return HERO_REACTION_PRESENTATION_SCALES_2D[directionKey] ?? HERO_REACTION_PRESENTATION_SCALES_2D.s
}

/**
 * All hero ground cues use the same rendered height as the sampled sprite.
 * Reaction clips have one stable directional scale, so shadow, aura and
 * contact marker cannot pop back to the motion height for one frame.
 */
export function heroGroundingHeight2D(heroHeight, directionKey = 's', reactionState = null) {
  const height = Math.max(0, Number(heroHeight) || 0)
  return height * (reactionState ? heroReactionPresentationScale2D(directionKey) : 1)
}

const DEFAULT_GROUNDING_PROFILE_2D = Object.freeze({
  shadowWidth: 0.44, shadowHeight: 0.1, shadowOffsetY: 1,
  shadowAlpha: 0.66, minShadowWidth: 22, minShadowHeight: 7,
  contactWidth: 0.76, contactHeight: 0.3, contactLift: 0.08,
  contactAlpha: 0.12, contactTint: 0x74c9b4, visualScale: 1,
})

const ACTOR_GROUNDING_PROFILES_2D = Object.freeze({
  hero: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.5, shadowHeight: 0.065, shadowAlpha: 0.68, minShadowWidth: 46, minShadowHeight: 8, contactAlpha: 0 }),
  wisp: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.5, shadowHeight: 0.068, shadowAlpha: 0.64, minShadowWidth: 27, minShadowHeight: 7, contactWidth: 0.62, contactHeight: 0.1, contactLift: 0, contactAlpha: 0, contactTint: 0x6e665e, visualScale: 1.34 }),
  // The authored shadow is the primary ground contact. Keep only a tight,
  // low-alpha blue bounce at the paws: the former wide bright ellipse moved
  // with every wolf like a luminous platform and hid the real soft shadow.
  yorang: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.74, shadowHeight: 0.055, shadowAlpha: 0.66, contactWidth: 0.7, contactHeight: 0.06, contactLift: 0, contactAlpha: 0, contactTint: 0x5f6270, visualScale: 1.08 }),
  jadeRidgeHound: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.74, shadowHeight: 0.055, shadowAlpha: 0.66, contactWidth: 0.7, contactHeight: 0.06, contactLift: 0, contactAlpha: 0, contactTint: 0x53685c, visualScale: 1.08 }),
  jadeSerpent: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.62, shadowHeight: 0.055, shadowAlpha: 0.68, contactAlpha: 0, visualScale: 1.12 }),
  jadeStoneGhoul: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.64, shadowHeight: 0.068, shadowAlpha: 0.68, contactAlpha: 0, visualScale: 1.34 }),
  jadeShardGuardian: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.58, shadowHeight: 0.064, shadowAlpha: 0.68, contactAlpha: 0, visualScale: 1.34 }),
  bloodScorpion: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.8, shadowHeight: 0.05, shadowAlpha: 0.68, contactAlpha: 0, visualScale: 1.14 }),
  talismanRevenant: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.48, shadowHeight: 0.075, shadowAlpha: 0.68, contactWidth: 0.66, contactHeight: 0.12, contactLift: 0.02, contactAlpha: 0.04, contactTint: 0x6e665e, visualScale: 1.36 }),
  maskedSealRevenant: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.56, shadowHeight: 0.075, shadowAlpha: 0.68, contactWidth: 0.7, contactHeight: 0.11, contactLift: 0.02, contactAlpha: 0.035, contactTint: 0x6e665e, visualScale: 1.36 }),
  voidSentinel: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.52, shadowHeight: 0.07, shadowAlpha: 0.56, contactAlpha: 0, visualScale: 1.22 }),
  shadowSealDuelist: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.55, shadowHeight: 0.07, shadowAlpha: 0.56, contactAlpha: 0, visualScale: 1.22 }),
  jadeVoidWarden: Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.46, shadowHeight: 0.09, shadowAlpha: 0.72, minShadowWidth: 92, minShadowHeight: 20, contactWidth: 0.8, contactHeight: 0.34, contactLift: 0.1, contactAlpha: 0.23, contactTint: 0x60d9bd }),
})

const PROP_GROUNDING_PROFILES_2D = Object.freeze([
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.42, shadowHeight: 0.036, shadowAlpha: 0.5, contactAlpha: 0 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.44, shadowHeight: 0.04, shadowAlpha: 0.52, contactAlpha: 0 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.38, shadowHeight: 0.036, shadowAlpha: 0.52, contactAlpha: 0 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.72, shadowHeight: 0.044, shadowAlpha: 0.5, contactAlpha: 0 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.34, shadowHeight: 0.034, shadowAlpha: 0.48, contactAlpha: 0 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.64, shadowHeight: 0.044, shadowAlpha: 0.5, contactAlpha: 0 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.74, shadowHeight: 0.038, shadowAlpha: 0.52, contactAlpha: 0 }),
  Object.freeze({ ...DEFAULT_GROUNDING_PROFILE_2D, shadowWidth: 0.54, shadowHeight: 0.038, shadowAlpha: 0.5, contactAlpha: 0 }),
])

export const PROP_GROUND_FOOTPRINT_2D = Object.freeze({
  alpha: 0.28,
  widthScale: 1.28,
  heightScale: 2.25,
  minimumHeight: 12,
})

/** Material grade shared by every sanctuary prop. The atlas has brighter
 * baked highlights than the combat floor; these frame-specific multipliers
 * bring stone, cloth and foliage back into the same jade/slate value range. */
export const PROP_MATERIAL_TINTS_2D = Object.freeze([
  // The prop atlas is already authored in the same jade-stone family as the
  // new ground material. Keep one cool slate grade across every frame and
  // reserve the only warm accent for firelight, so props never look pasted
  // from a brighter scene.
  0xcbd8d2, 0xb9c9c2, 0xb5c6bf, 0xb8c7c0,
  0xb4c5bf, 0xb0c1ba, 0xb4c5be, 0xc2b79b,
])

/** Shared semantic-region grade used by terrain decals and prop materials. */
export const REGION_TERRAIN_PRESENTATION_2D = Object.freeze({
  // Regions vary by value and humidity, not by unrelated hue families. This
  // keeps the whole sanctuary in one ink-wash jade palette while the shrine
  // lanterns supply a controlled amber landmark.
  spawn_grove: Object.freeze({ tint: 0xb5c9c0, alpha: 0.72, propTint: 0xbaccc3 }),
  jade_path: Object.freeze({ tint: 0x9eb5ad, alpha: 0.58, propTint: 0xaebfb8 }),
  jade_grove: Object.freeze({ tint: 0x9fbeaa, alpha: 0.72, propTint: 0xb1c4b8 }),
  lantern_shrine: Object.freeze({ tint: 0xb5b39a, alpha: 0.68, propTint: 0xc0b99e }),
  mist_marsh: Object.freeze({ tint: 0x96b4b5, alpha: 0.64, propTint: 0xa9c2be }),
  void_rim: Object.freeze({ tint: 0x98a7b0, alpha: 0.62, propTint: 0xaebbc0 }),
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
  // A permanent bright disc competes with the contact shadow and reads like
  // an editor selection ring. Keep the shape only for the invulnerability cue.
  alpha: 0,
  rotation: 0,
})

export const HERO_AURA_PRESENTATION_2D = Object.freeze({
  widthRatio: 0.66,
  heightRatio: 0.18,
  alpha: 0.035,
  invulnerableAlpha: 0.22,
})

/**
 * A restrained ink rim separates the heroine from both dark terrain and pale
 * attack effects. It reuses the current animation texture in the same normal
 * blend batch: unlike a full-screen outline filter, only the expanded edge is
 * visible after the opaque hero sprite is drawn over it.
 */
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
export function enemyHeroOverlapAlpha2D(distance, textureKey = '') {
  const value = Number(distance)
  if (!Number.isFinite(value) || value >= 3.2) return 1
  // Do not move enemies out of valid contact range just to protect the frame.
  // The numerous small wraiths instead yield more of their authored opacity at
  // the exact overlap point; collision, damage and pathing remain authoritative.
  const minimum = textureKey === 'wisp' ? 0.22 : 0.48
  if (value <= 0) return minimum
  return minimum + (1 - minimum) * (value / 3.2)
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

function drawBossTelegraph2D(graphics, profile, worldFrame, viewport, castProgress) {
  graphics.clear()
  const pulse = Math.sin(Math.max(0, Math.min(1, castProgress)) * Math.PI)
  const ink = 0x261d19
  // Pattern metadata often carries near-white frost values. Passing those
  // through directly makes the world-space polygon look like an editor gizmo.
  // Preserve the blue wolf's authored cool warning; all jade/void casts use
  // the UI system's cinnabar danger ink.
  const cinnabar = profile.color === 0x6ca8ff ? 0x537b8d : 0xa9362b
  const fillAlpha = 0.055 + pulse * 0.075
  const washAlpha = 0.11 + pulse * 0.08
  const strokeAlpha = 0.72 + pulse * 0.2
  const strokeWidth = Math.max(1.5, viewportPresentationScale(viewport) * 1.8)
  for (const shape of bossTelegraphWorldShapes2D(profile)) {
    const points = []
    for (const point of shape) {
      const screen = { x: 0, y: 0, unit: 24 }
      projectWorldWithFrame2D(point.x, point.z, worldFrame, screen)
      points.push(screen.x, screen.y + 2)
    }
    if (points.length < 6) continue
    graphics.poly(points, true)
      .fill({ color: ink, alpha: washAlpha })
      .stroke({ color: ink, alpha: 0.68, width: strokeWidth + 2.1 })
    graphics.poly(points, true)
      .fill({ color: cinnabar, alpha: fillAlpha })
      .stroke({ color: cinnabar, alpha: strokeAlpha, width: strokeWidth })
  }
}
const POI_PRESENTATION = Object.freeze({
  altar: Object.freeze({ frame: 7, height: 164, glyph: '수', color: 0xf2c76f }),
  treasure: Object.freeze({ frame: 3, height: 154, glyph: '보', color: 0x8edcff }),
  elite_seal: Object.freeze({ frame: 2, height: 176, glyph: '봉', color: 0xe969a1 }),
  healing_spring: Object.freeze({ frame: 5, height: 118, glyph: '회', color: 0x73e3bd }),
  evidence: Object.freeze({ frame: 5, height: 92, glyph: '흔', color: 0x8fc6b1, groundTrace: true }),
  false_trace: Object.freeze({ frame: 1, height: 112, glyph: '적', color: 0x91aaa3, groundTrace: true }),
})

export const INVESTIGATION_TRACE_PRESENTATION_2D = Object.freeze({
  'sword-scar': Object.freeze({ texture: 'swordScarTrace', width: 148, height: 60, glyph: '검' }),
  'beast-trail': Object.freeze({ texture: 'beastTrailTrace', width: 138, height: 66, glyph: '족' }),
  'seal-ash': Object.freeze({ texture: 'sealAshTrace', width: 104, height: 64, glyph: '인' }),
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
    ctx.translate(64, 52)
    const aura = ctx.createRadialGradient(0, -5, 4, 0, -5, 43)
    aura.addColorStop(0, 'rgba(255,255,255,.58)')
    aura.addColorStop(0.46, 'rgba(224,213,255,.24)')
    aura.addColorStop(1, 'rgba(137,105,196,0)')
    ctx.fillStyle = aura
    ctx.beginPath()
    ctx.arc(0, -5, 43, 0, Math.PI * 2)
    ctx.fill()

    // Three downward remnants make the creature float while preserving one
    // upright read. Radial arms and full-body spin made this family look like
    // the decorative motes and qi rewards that share the opening battlefield.
    ctx.lineCap = 'round'
    for (const [x, bend, alpha, width] of [[-16, -25, 0.68, 5], [0, 10, 0.78, 6], [16, 25, 0.64, 4]]) {
      ctx.strokeStyle = `rgba(235,228,255,${alpha})`
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x, 20)
      ctx.bezierCurveTo(x + bend * 0.22, 31, x + bend * 0.34, 41, x + bend * 0.5, 51)
      ctx.stroke()
    }

    // A broad hood, dark face and paired eye slits survive at the authored
    // 50-70px runtime size. Grayscale values intentionally accept per-species
    // tinting without losing the hostile light-dark hierarchy.
    const body = ctx.createLinearGradient(0, -35, 0, 30)
    body.addColorStop(0, 'rgba(255,255,255,.98)')
    body.addColorStop(0.42, 'rgba(220,208,244,.96)')
    body.addColorStop(1, 'rgba(111,91,147,.88)')
    ctx.fillStyle = body
    ctx.strokeStyle = 'rgba(255,255,255,.9)'
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.moveTo(0, -36)
    ctx.lineTo(10, -25)
    ctx.bezierCurveTo(29, -22, 35, -5, 28, 12)
    ctx.bezierCurveTo(22, 28, 10, 33, 0, 38)
    ctx.bezierCurveTo(-10, 33, -22, 28, -28, 12)
    ctx.bezierCurveTo(-35, -5, -29, -22, -10, -25)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'rgba(20,10,35,.94)'
    ctx.beginPath()
    ctx.ellipse(0, -5, 20, 16, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,.98)'
    ctx.beginPath()
    ctx.moveTo(-15, -10)
    ctx.lineTo(-3, -6)
    ctx.lineTo(-14, -2)
    ctx.closePath()
    ctx.moveTo(15, -10)
    ctx.lineTo(3, -6)
    ctx.lineTo(14, -2)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = 'rgba(35,17,55,.82)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-27, 5)
    ctx.lineTo(-41, 17)
    ctx.moveTo(27, 5)
    ctx.lineTo(41, 17)
    ctx.stroke()
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
function jadeGroundDetailTexture(seed, regionId = 'jade_grove') {
  return canvasTexture(512, 512, (ctx, width, height) => {
    let state = (seed * 0x9e3779b1) >>> 0
    const random = () => {
      state = (Math.imul(state ^ (state >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0
      return state / 4294967296
    }

    ctx.clearRect(0, 0, width, height)
    const palettes = {
      // The opening uses the same low-contrast material wash as the path;
      // keeping it below a separate plate value lets the authored prop
      // clusters define the clearing without painting a second arena.
      spawn_grove: ['rgba(123,151,139,.16)', 'rgba(165,171,149,.08)'],
      jade_path: ['rgba(126,158,149,.2)', 'rgba(153,166,143,.12)'],
      jade_grove: ['rgba(91,145,116,.24)', 'rgba(145,177,142,.11)'],
      lantern_shrine: ['rgba(177,160,111,.22)', 'rgba(147,154,129,.11)'],
      mist_marsh: ['rgba(92,151,151,.22)', 'rgba(141,176,168,.11)'],
      void_rim: ['rgba(108,133,145,.21)', 'rgba(126,151,148,.1)'],
    }
    const palette = palettes[regionId] ?? palettes.jade_grove

    // Region identity is a soft value-temperature drift in the same stone
    // material, never a second map drawing. No paths, rings, editor-like
    // splines or symbolic plates are painted over the authored ground.
    for (let i = 0; i < 5; i++) {
      const x = 96 + random() * (width - 192)
      const y = 96 + random() * (height - 192)
      const radius = 118 + random() * 128
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, palette[i % palette.length])
      gradient.addColorStop(0.58, palette[(i + 1) % palette.length])
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }

    // World-anchored material forms make travel cross distinct ground instead
    // of sliding one photograph under the actors. Every form is irregular and
    // non-symbolic: worn stone, moss, damp mineral deposits or fractures.
    const materialAlpha = regionId === 'jade_grove' || regionId === 'mist_marsh' ? 0.23 : 0.18
    for (let i = 0; i < 18; i++) {
      const x = 38 + random() * (width - 76)
      const y = 38 + random() * (height - 76)
      const rx = 16 + random() * (regionId === 'jade_path' ? 64 : 42)
      const ry = 8 + random() * (regionId === 'mist_marsh' ? 30 : 18)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate((random() - 0.5) * 1.7)
      ctx.beginPath()
      const points = 9
      for (let point = 0; point < points; point++) {
        const angle = point / points * Math.PI * 2
        const rough = 0.72 + random() * 0.5
        const px = Math.cos(angle) * rx * rough
        const py = Math.sin(angle) * ry * rough
        if (point === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      if (regionId === 'mist_marsh') ctx.fillStyle = `rgba(18,66,65,${materialAlpha})`
      else if (regionId === 'void_rim') ctx.fillStyle = `rgba(30,42,48,${materialAlpha})`
      else if (regionId === 'lantern_shrine') ctx.fillStyle = `rgba(136,124,88,${materialAlpha})`
      else if (regionId === 'jade_grove') ctx.fillStyle = `rgba(40,99,68,${materialAlpha})`
      else ctx.fillStyle = `rgba(137,151,137,${materialAlpha})`
      ctx.fill()
      ctx.restore()
    }

    const fractureColor = regionId === 'lantern_shrine'
      ? 'rgba(74,61,44,.27)'
      : regionId === 'void_rim'
        ? 'rgba(12,24,31,.38)'
        : 'rgba(23,55,52,.27)'
    ctx.strokeStyle = fractureColor
    ctx.lineCap = 'round'
    for (let i = 0; i < 22; i++) {
      let x = 28 + random() * (width - 56)
      let y = 28 + random() * (height - 56)
      ctx.lineWidth = 0.8 + random() * (regionId === 'void_rim' ? 2.2 : 1.35)
      ctx.beginPath()
      ctx.moveTo(x, y)
      const segments = 2 + Math.floor(random() * 3)
      for (let segment = 0; segment < segments; segment++) {
        x += (random() - 0.5) * 34
        y += 8 + random() * 24
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Wide transparent borders let neighbouring world chunks overlap without
    // exposing a rectangular edge while the camera travels.
    ctx.globalCompositeOperation = 'destination-in'
    const feather = JADE_GROUND_COMPOSITION_2D.decalEdgeFeather
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

/** A weathered origin clearing establishes place without drawing a debug
 * circle, world-axis cross, range ring, or radial measurement spokes. */
function jadeSpawnPlazaTexture() {
  return canvasTexture(768, 768, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height)
    const cx = width * 0.48
    const cy = height * 0.53
    let state = 0x4f1bbcdc
    const random = () => {
      state = (Math.imul(state ^ (state >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0
      return state / 4294967296
    }

    // Three offset, weathered beds form a clearing without a radial disc. The
    // overlap is intentionally lopsided, so the origin reads as worn ground
    // joined to the route rather than a debug ellipse around the player.
    const drawBed = (offsetX, offsetY, scaleX, scaleY, alpha) => {
      ctx.save()
      ctx.translate(cx + offsetX, cy + offsetY)
      ctx.scale(scaleX, scaleY)
      const wash = ctx.createLinearGradient(-260, -190, 260, 220)
      wash.addColorStop(0, `rgba(70,86,79,${alpha})`)
      wash.addColorStop(0.58, `rgba(43,65,57,${alpha * 0.78})`)
      wash.addColorStop(1, 'rgba(16,51,42,0)')
      ctx.fillStyle = wash
      ctx.beginPath()
      ctx.moveTo(-270, -58)
      ctx.bezierCurveTo(-228, -186, -88, -238, 24, -206)
      ctx.bezierCurveTo(122, -234, 250, -126, 216, -22)
      ctx.bezierCurveTo(276, 76, 122, 196, 12, 156)
      ctx.bezierCurveTo(-94, 214, -246, 132, -214, 30)
      ctx.bezierCurveTo(-292, -12, -296, -30, -270, -58)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    drawBed(-36, -42, 1.02, 0.84, 0.5)
    drawBed(102, 38, 0.68, 0.72, 0.38)
    drawBed(-122, 88, 0.56, 0.62, 0.32)

    // Two offset, curved approaches imply travel without forming a crosshair.
    ctx.lineCap = 'round'
    for (const [widthPx, color] of [[76, 'rgba(48,66,60,.46)'], [3, 'rgba(178,198,174,.1)']]) {
      ctx.strokeStyle = color
      ctx.lineWidth = widthPx
      ctx.beginPath()
      ctx.moveTo(-48, cy - 184)
      ctx.bezierCurveTo(cx - 236, cy - 154, cx - 136, cy - 70, cx - 44, cy - 28)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx + 74, cy + 38)
      ctx.bezierCurveTo(cx + 178, cy + 84, cx + 202, cy + 190, width + 44, height - 84)
      ctx.stroke()
    }

    // Irregular flagstones and moss islands break the clearing into natural
    // scale cues; none repeat around a shared radius or circular marker.
    for (let i = 0; i < 24; i++) {
      const x = cx + (random() - 0.5) * 490
      const y = cy + (random() - 0.5) * 390
      const rx = 18 + random() * 44
      const ry = 10 + random() * 24
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate((random() - 0.5) * 1.2)
      ctx.fillStyle = i % 4 === 0 ? 'rgba(31,87,63,.26)' : 'rgba(78,91,82,.28)'
      ctx.strokeStyle = 'rgba(10,29,28,.34)'
      ctx.lineWidth = 2 + random() * 2
      ctx.beginPath()
      for (let point = 0; point < 7; point++) {
        const angle = point / 7 * Math.PI * 2
        const rough = 0.72 + random() * 0.46
        const px = Math.cos(angle) * rx * rough
        const py = Math.sin(angle) * ry * rough
        if (point === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      if (i % 3 !== 0) ctx.stroke()
      ctx.restore()
    }

    ctx.strokeStyle = 'rgba(8,23,24,.48)'
    ctx.lineCap = 'round'
    for (const points of [
      [[cx - 220, cy - 58], [cx - 166, cy - 24], [cx - 118, cy - 52], [cx - 82, cy - 32]],
      [[cx + 62, cy + 178], [cx + 118, cy + 126], [cx + 176, cy + 142]],
      [[cx + 164, cy - 142], [cx + 106, cy - 102], [cx + 128, cy - 58]],
      [[cx - 42, cy + 82], [cx - 10, cy + 52], [cx + 34, cy + 64]],
    ]) {
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
      ctx.stroke()
    }
  })
}

/**
 * Build one wrapped, aperiodic combat surface from the authored stone source.
 *
 * Repeating the 1254px painting directly exposed either a viewport-sized plate
 * or obvious mirrored cracks, depending on scale. This synthesis samples many
 * different source windows, feathers each into its neighbours, and draws every
 * patch through both opposite edges. The resulting outer texture is seamless,
 * but no recognisable copy of the original painting survives inside it.
 */
function composedJadeGroundTexture(source, size = JADE_GROUND_COMPOSITION_2D.synthesisSize) {
  return canvasTexture(size, size, (ctx, width, height) => {
    let state = 0x51f15e
    const random = () => {
      state = (Math.imul(state ^ (state >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0
      return state / 4294967296
    }

    ctx.fillStyle = '#314641'
    ctx.fillRect(0, 0, width, height)

    // Broad wrapped value fields keep any uncovered transition in the same
    // mountain-jade family. They carry no symbols or editor-like geometry.
    for (let i = 0; i < 18; i++) {
      const cx = random() * width
      const cy = random() * height
      const radius = 260 + random() * 430
      const value = i % 3 === 0 ? '17,34,32' : i % 3 === 1 ? '67,91,79' : '47,73,67'
      for (const ox of [-width, 0, width]) {
        for (const oy of [-height, 0, height]) {
          const gradient = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, radius)
          gradient.addColorStop(0, `rgba(${value},.16)`)
          gradient.addColorStop(1, `rgba(${value},0)`)
          ctx.fillStyle = gradient
          ctx.fillRect(cx + ox - radius, cy + oy - radius, radius * 2, radius * 2)
        }
      }
    }

    const patchSize = 704
    const patch = document.createElement('canvas')
    patch.width = patchSize
    patch.height = patchSize
    const patchCtx = patch.getContext('2d')
    for (let i = 0; i < 54; i++) {
      patchCtx.clearRect(0, 0, patchSize, patchSize)
      patchCtx.globalCompositeOperation = 'source-over'
      patchCtx.globalAlpha = 1
      const sourceSpan = Math.max(280, Math.min(
        source.width,
        Math.round(source.width * (0.28 + random() * 0.28)),
      ))
      const sx = random() * Math.max(0, source.width - sourceSpan)
      const sy = random() * Math.max(0, source.height - sourceSpan)
      patchCtx.drawImage(
        source,
        sx, sy, sourceSpan, sourceSpan,
        0, 0, patchSize, patchSize,
      )

      const grade = patchCtx.createLinearGradient(0, 0, patchSize, patchSize)
      grade.addColorStop(0, i % 3 === 0 ? 'rgba(39,72,60,.13)' : 'rgba(76,92,80,.06)')
      grade.addColorStop(1, i % 4 === 0 ? 'rgba(12,31,31,.18)' : 'rgba(13,27,29,.08)')
      patchCtx.fillStyle = grade
      patchCtx.fillRect(0, 0, patchSize, patchSize)

      patchCtx.globalCompositeOperation = 'destination-in'
      const maskX = patchSize * (0.46 + (random() - 0.5) * 0.08)
      const maskY = patchSize * (0.5 + (random() - 0.5) * 0.08)
      const mask = patchCtx.createRadialGradient(maskX, maskY, 18, maskX, maskY, patchSize * 0.5)
      mask.addColorStop(0, 'rgba(255,255,255,.98)')
      mask.addColorStop(0.62, 'rgba(255,255,255,.96)')
      mask.addColorStop(0.84, 'rgba(255,255,255,.72)')
      mask.addColorStop(1, 'rgba(255,255,255,0)')
      patchCtx.fillStyle = mask
      patchCtx.fillRect(0, 0, patchSize, patchSize)
      patchCtx.globalCompositeOperation = 'source-over'

      const cx = random() * width
      const cy = random() * height
      const rotation = Math.floor(random() * 4) * Math.PI * 0.5
      const mirror = random() < 0.5 ? -1 : 1
      const scale = 0.76 + random() * 0.42
      const drawSize = patchSize * scale
      ctx.globalAlpha = 0.84 + random() * 0.14
      for (const ox of [-width, 0, width]) {
        for (const oy of [-height, 0, height]) {
          ctx.save()
          ctx.translate(cx + ox, cy + oy)
          ctx.rotate(rotation)
          ctx.scale(mirror, 1)
          ctx.drawImage(patch, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize)
          ctx.restore()
        }
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = 'rgba(132,153,139,.13)'
    ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'
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
  alpha: 0.36,
  edgeVignetteAlpha: 0.2,
  topDepthAlpha: 0.09,
  bottomDepthAlpha: 0.04,
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

function propFootprintTexture() {
  return canvasTexture(160, 96, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height)
    // An irregular occlusion stain merges a cut-out prop into the authored
    // paving. A radial ellipse looked like a selection disc, so the footprint
    // is deliberately asymmetric and broken at its perimeter.
    const soil = ctx.createLinearGradient(20, 38, 142, 70)
    soil.addColorStop(0, 'rgba(6,15,15,.18)')
    soil.addColorStop(0.42, 'rgba(3,10,11,.72)')
    soil.addColorStop(0.7, 'rgba(13,31,25,.46)')
    soil.addColorStop(1, 'rgba(38,77,54,.08)')
    ctx.fillStyle = soil
    ctx.beginPath()
    ctx.moveTo(11, 58)
    ctx.bezierCurveTo(24, 39, 44, 45, 58, 38)
    ctx.bezierCurveTo(78, 29, 93, 43, 112, 37)
    ctx.bezierCurveTo(132, 31, 151, 46, 148, 60)
    ctx.bezierCurveTo(145, 74, 120, 69, 105, 76)
    ctx.bezierCurveTo(83, 84, 67, 70, 49, 77)
    ctx.bezierCurveTo(30, 84, 8, 74, 11, 58)
    ctx.fill()
    ctx.fillStyle = 'rgba(8,23,20,.26)'
    ctx.beginPath()
    ctx.moveTo(35, 43)
    ctx.bezierCurveTo(51, 29, 79, 36, 87, 48)
    ctx.bezierCurveTo(76, 56, 49, 59, 35, 43)
    ctx.fill()
    ctx.strokeStyle = 'rgba(107,148,101,.18)'
    ctx.lineCap = 'round'
    for (const [x, y, length, lean] of [
      [22, 61, 10, -4], [39, 69, 13, 4], [57, 72, 8, -2], [105, 72, 10, 3],
      [128, 66, 13, -4], [140, 58, 9, 2], [47, 42, 7, 3], [117, 42, 8, -3],
    ]) {
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + lean, y - length * 0.62, x + lean * 0.4, y - length)
      ctx.stroke()
    }
  })
}

function shadowTexture() {
  return canvasTexture(96, 48, (ctx) => {
    const gradient = ctx.createRadialGradient(48, 24, 2, 48, 24, 45)
    // Concentrate occlusion directly below the sampled foot pivot. A broad,
    // evenly blurred ellipse detached actors from the floor; a short dark core
    // plus a soft falloff reads as weight without painting a visible platform.
    gradient.addColorStop(0, 'rgba(0,0,0,.76)')
    gradient.addColorStop(0.22, 'rgba(0,0,0,.66)')
    gradient.addColorStop(0.62, 'rgba(0,0,0,.22)')
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

    // fire talisman: the atlas cell points along +X so the pooled projectile's
    // travel rotation reads as velocity. The previous upright flame became a
    // flat orange icon when rotated and repeated; a parchment head, cinnabar
    // seal and tapering ember tail now read as an authored flying talisman.
    translate(1)
    drawGlow(-3, 0, 'rgba(255,111,46,.42)', 45)
    const emberTail = ctx.createLinearGradient(-55, 0, 8, 0)
    emberTail.addColorStop(0, 'rgba(255,64,30,0)')
    emberTail.addColorStop(0.38, 'rgba(255,73,30,.58)')
    emberTail.addColorStop(0.78, 'rgba(255,168,58,.9)')
    emberTail.addColorStop(1, 'rgba(255,232,146,.96)')
    ctx.fillStyle = emberTail
    ctx.beginPath()
    ctx.moveTo(-57, 0)
    ctx.bezierCurveTo(-43, -5, -34, -15, -8, -10)
    ctx.lineTo(10, -6)
    ctx.lineTo(10, 6)
    ctx.lineTo(-8, 10)
    ctx.bezierCurveTo(-34, 15, -43, 5, -57, 0)
    ctx.closePath()
    ctx.fill()

    ctx.lineCap = 'round'
    for (const [y, width, alpha] of [[-7, 3, 0.68], [0, 4, 0.92], [7, 2, 0.54]]) {
      ctx.strokeStyle = `rgba(255,224,128,${alpha})`
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(-48, y * 0.45)
      ctx.quadraticCurveTo(-25, y * 1.15, 6, y * 0.55)
      ctx.stroke()
    }

    ctx.fillStyle = '#50151b'
    ctx.beginPath()
    ctx.moveTo(-9, -17)
    ctx.lineTo(30, -13)
    ctx.lineTo(46, 0)
    ctx.lineTo(30, 13)
    ctx.lineTo(-9, 17)
    ctx.lineTo(-3, 0)
    ctx.closePath()
    ctx.fill()

    const parchment = ctx.createLinearGradient(-6, -11, 39, 11)
    parchment.addColorStop(0, '#fff4bf')
    parchment.addColorStop(0.52, '#efbd63')
    parchment.addColorStop(1, '#ff7845')
    ctx.fillStyle = parchment
    ctx.beginPath()
    ctx.moveTo(-5, -11)
    ctx.lineTo(27, -8)
    ctx.lineTo(39, 0)
    ctx.lineTo(27, 8)
    ctx.lineTo(-5, 11)
    ctx.lineTo(0, 0)
    ctx.closePath()
    ctx.fill()

    // A tiny original seal remains legible as a red centre stroke at combat
    // scale without depending on a font or an external icon asset.
    ctx.strokeStyle = '#a9282d'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(7, -7)
    ctx.lineTo(18, -4)
    ctx.lineTo(9, 0)
    ctx.lineTo(21, 4)
    ctx.lineTo(10, 8)
    ctx.moveTo(24, -7)
    ctx.lineTo(24, 7)
    ctx.stroke()
    ctx.fillStyle = '#fff3b3'
    ctx.beginPath()
    ctx.arc(39, 0, 3.5, 0, Math.PI * 2)
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

    // thunder pearl: orbit weapons are described and simulated as spirit
    // orbs. The former long zigzag became a ring of purple handwriting when
    // five copies orbited the heroine. Keep every mark inside a compact pearl
    // silhouette so its position and contact radius remain immediately clear.
    translate(3)
    drawGlow(0, 0, 'rgba(181,126,255,.52)', 46)
    const thunderPearl = ctx.createRadialGradient(-9, -11, 2, 0, 0, 29)
    thunderPearl.addColorStop(0, '#ffffff')
    thunderPearl.addColorStop(0.18, '#e9ddff')
    thunderPearl.addColorStop(0.5, '#b788ff')
    thunderPearl.addColorStop(0.8, '#6842b5')
    thunderPearl.addColorStop(1, '#24194f')
    ctx.fillStyle = thunderPearl
    ctx.beginPath()
    ctx.arc(0, 0, 28, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(239,225,255,.94)'
    ctx.lineWidth = 2.5
    ctx.stroke()

    ctx.save()
    ctx.scale(1, 0.58)
    ctx.strokeStyle = 'rgba(214,181,255,.72)'
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.arc(0, 0, 37, -2.72, -0.22)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, 37, 0.42, 2.92)
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = '#fbf7ff'
    ctx.beginPath()
    ctx.arc(-7, -8, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d7b8ff'
    for (let index = 0; index < 4; index++) {
      const angle = index * Math.PI * 0.5 + Math.PI * 0.25
      ctx.save()
      ctx.translate(Math.cos(angle) * 37, Math.sin(angle) * 21)
      ctx.rotate(angle + Math.PI * 0.25)
      ctx.fillRect(-3, -3, 6, 6)
      ctx.restore()
    }
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
    const halo = ctx.createRadialGradient(0, 0, 3, 0, 0, 22)
    halo.addColorStop(0, 'rgba(205,255,250,.34)')
    halo.addColorStop(1, 'rgba(102,221,232,0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(0, 0, 22, 0, Math.PI * 2)
    ctx.fill()

    const gradient = ctx.createLinearGradient(-12, -17, 12, 17)
    gradient.addColorStop(0, '#f1fcff')
    gradient.addColorStop(0.45, '#7bd9f0')
    gradient.addColorStop(1, '#2c7790')
    ctx.fillStyle = gradient
    ctx.strokeStyle = 'rgba(225,255,250,.96)'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(0, -18)
    ctx.lineTo(14, -2)
    ctx.lineTo(0, 18)
    ctx.lineTo(-14, -2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle = 'rgba(240,255,255,.82)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -16)
    ctx.lineTo(0, 16)
    ctx.moveTo(-12, -2)
    ctx.lineTo(0, 3)
    ctx.lineTo(12, -2)
    ctx.stroke()
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

function swordScarTraceTexture() {
  return canvasTexture(256, 112, (ctx) => {
    ctx.clearRect(0, 0, 256, 112)
    const dust = ctx.createRadialGradient(130, 62, 4, 130, 62, 92)
    dust.addColorStop(0, 'rgba(94,145,128,.18)')
    dust.addColorStop(1, 'rgba(80,122,111,0)')
    ctx.fillStyle = dust
    ctx.fillRect(24, 8, 208, 96)
    ctx.lineCap = 'round'
    for (const [offset, width, alpha] of [[0, 5.6, .92], [15, 3.4, .72], [-14, 2.3, .58]]) {
      ctx.beginPath()
      ctx.moveTo(28 + offset, 88)
      ctx.quadraticCurveTo(114 + offset, 53, 226 + offset * .25, 23)
      ctx.strokeStyle = `rgba(11,25,25,${alpha})`
      ctx.lineWidth = width
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(35 + offset, 84)
      ctx.quadraticCurveTo(120 + offset, 49, 222 + offset * .25, 20)
      ctx.strokeStyle = `rgba(151,191,176,${alpha * .62})`
      ctx.lineWidth = Math.max(1.2, width * .42)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(116,157,143,.42)'
    for (const [x, y, r] of [[61,78,4],[92,65,2.5],[157,42,3],[194,31,2]]) {
      ctx.beginPath(); ctx.moveTo(x-r,y); ctx.lineTo(x+r*.7,y-r*.6); ctx.lineTo(x+r,y+r*.5); ctx.closePath(); ctx.fill()
    }
  })
}

function beastTrailTraceTexture() {
  return canvasTexture(224, 128, (ctx) => {
    ctx.clearRect(0, 0, 224, 128)
    const paw = (x, y, scale, angle) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale)
      ctx.fillStyle = 'rgba(22,39,36,.78)'
      ctx.beginPath()
      ctx.moveTo(-11, 7)
      ctx.bezierCurveTo(-10, -1, -5, -5, 0, -4)
      ctx.bezierCurveTo(7, -5, 12, 1, 10, 8)
      ctx.bezierCurveTo(5, 13, -5, 14, -11, 7)
      ctx.fill()
      for (const [tx, ty, lean] of [[-10,-7,-2],[-3,-12,-1],[5,-11,1],[12,-5,2]]) {
        ctx.beginPath()
        ctx.moveTo(tx, ty - 6)
        ctx.quadraticCurveTo(tx + lean + 5, ty, tx, ty + 6)
        ctx.quadraticCurveTo(tx - 4, ty + 1, tx, ty - 6)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(101,134,122,.30)'; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(-8, 8); ctx.quadraticCurveTo(0, 3, 8, 8); ctx.stroke()
      ctx.restore()
    }
    paw(43, 91, 1.08, -.16)
    paw(105, 65, .9, .12)
    paw(167, 36, .76, -.1)
    const smear = ctx.createLinearGradient(16, 108, 205, 18)
    smear.addColorStop(0, 'rgba(44,71,63,.16)'); smear.addColorStop(1, 'rgba(44,71,63,0)')
    ctx.strokeStyle = smear; ctx.lineWidth = 9; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(21,111); ctx.lineTo(205,18); ctx.stroke()
  })
}

function sealAshTraceTexture() {
  return canvasTexture(192, 128, (ctx) => {
    ctx.clearRect(0, 0, 192, 128)
    const wet = ctx.createRadialGradient(96, 71, 6, 96, 71, 64)
    wet.addColorStop(0, 'rgba(83,145,141,.16)'); wet.addColorStop(1, 'rgba(83,145,141,0)')
    ctx.fillStyle = wet; ctx.fillRect(22, 10, 148, 108)
    const scraps = [
      [45,61,49,25,-.18], [102,45,42,24,.16], [92,87,55,22,-.06],
    ]
    for (const [x,y,w,h,a] of scraps) {
      ctx.save(); ctx.translate(x,y); ctx.rotate(a)
      ctx.fillStyle='rgba(54,78,73,.62)'; ctx.fillRect(-w/2,-h/2,w,h)
      ctx.strokeStyle='rgba(139,174,158,.4)'; ctx.lineWidth=1.5; ctx.strokeRect(-w/2,-h/2,w,h)
      ctx.strokeStyle='rgba(143,73,61,.62)'; ctx.lineWidth=2
      ctx.beginPath(); ctx.moveTo(-w*.24,0); ctx.lineTo(w*.22,0); ctx.moveTo(0,-h*.3); ctx.lineTo(0,h*.3); ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle='rgba(103,141,129,.36)'
    for (const [x,y,r] of [[31,92,3],[61,105,2],[135,87,3],[153,66,2],[116,111,2]]) {
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill()
    }
  })
}

/**
 * A restrained broken cinnabar seal for ordinary enemy wind-ups. It avoids the
 * complete concentric circles and measurement ticks of the shared navigation
 * ring, which looked like an editor trigger once flattened onto the ground.
 */
function enemyIntentSealTexture() {
  return canvasTexture(128, 96, (ctx) => {
    ctx.translate(64, 48)
    const wash = ctx.createRadialGradient(0, 0, 5, 0, 0, 52)
    wash.addColorStop(0, 'rgba(255,255,255,.18)')
    wash.addColorStop(0.52, 'rgba(255,255,255,.045)')
    wash.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = wash
    ctx.beginPath()
    ctx.ellipse(0, 0, 48, 25, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255,255,255,.92)'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 5.5
    // Two asymmetric brush fangs communicate a forward strike without the
    // closed rings, ticks, or radial measurement language of debug gizmos.
    ctx.beginPath()
    ctx.moveTo(-48, 15)
    ctx.quadraticCurveTo(-25, -17, -6, 4)
    ctx.lineTo(-17, 20)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(48, 10)
    ctx.quadraticCurveTo(27, -14, 8, 3)
    ctx.lineTo(19, 19)
    ctx.stroke()

    ctx.save()
    ctx.rotate(Math.PI / 4)
    ctx.lineWidth = 3
    ctx.strokeRect(-8, -8, 16, 16)
    ctx.fillStyle = 'rgba(255,255,255,.88)'
    ctx.fillRect(-3, -3, 6, 6)
    ctx.restore()
  })
}

/**
 * Use the latest simulation step as the visible locomotion contract. A stale
 * speed value can survive an input keyup, but when x/z did not advance the
 * renderer must immediately return to the authored idle pose.
 */
export function heroMotionActive2D({
  actualSpeed = 0, speed01 = 0, worldStep = 0, dashing = 0, teleported = false,
} = {}) {
  if (Number(dashing) > 0) return true
  if (teleported) return false
  const step = Math.max(0, Number(worldStep) || 0)
  if (step <= 0.0001) return false
  return Number(speed01) > 0.08 || Number(actualSpeed) > 0.08 || step > 0.0005
}

export function heroIdleFrames2D(heroDef, directionKey = 'se') {
  const directionalIdle = heroDef?.idleFramesByDirection?.[directionKey]
  if (Array.isArray(directionalIdle) && directionalIdle.length) return directionalIdle
  return heroDef?.animations?.idle ?? [0]
}

export function heroAnimationFrameIndex2D(heroDef, {
  moving = false, dashing = 0, attackTimer = 0, time = 0,
  travelDistance = null, runFrames = null, directionKey = 'se',
} = {}) {
  const animations = heroDef?.animations ?? {}
  // The motion atlas does not use frame zero as a universal idle; its
  // direction-specific neutral pose is authored in the attack/recovery tail.
  const idle = heroIdleFrames2D(heroDef, directionKey)
  const run = runFrames ?? animations.run ?? idle
  const dash = animations.dash ?? run
  const attack = animations.attack ?? idle
  if (dashing > 0) return oneShotFrameIndex(dash, dashing, 0.16)
  // Automatic attacks must not replace a locomotion cycle while the player is
  // moving; the directional slash VFX already communicates those hits.
  if (moving && Number.isFinite(travelDistance)) {
    const phase = Math.floor(Math.max(0, travelDistance) / HERO_RUN_FRAME_DISTANCE_2D)
    return run[phase % run.length]
  }
  if (moving) return loopingFrameIndex(run, time, 8)
  // A stopped simulation tick is an immediate idle contract; there is no
  // transition settle window that can hold the legs-apart run pose after keyup.
  if (attackTimer > 0) return oneShotFrameIndex(attack, attackTimer, 0.32)
  return idle[0]
}

export function heroReactionFrameIndex2D(heroDef, {
  alive = true, hurtTimer = 0, deathTimer = 0, time = 0,
} = {}) {
  const reactions = heroDef?.reactionAnimations ?? {}
  const idle = reactions.idle ?? [0]
  const hurt = reactions.hurt ?? idle
  const death = reactions.death ?? hurt
  if (!alive) return oneShotFrameIndex(death, deathTimer, HERO_DEATH_REACTION_SECONDS_2D)
  if (hurtTimer > 0) return oneShotFrameIndex(hurt, hurtTimer, HERO_HURT_REACTION_SECONDS_2D)
  return loopingFrameIndex(idle, time, 1.5)
}

export function heroReactionState2D(player) {
  if (player?.alive === false) return 'death'
  if ((Number(player?.hurtTimer) || 0) > 0) return 'hurt'
  return null
}

// Eight authored poses now cover the same travel distance that the old
// four-frame loop covered. Keeping 0.92 here made a full stride take 1.4s and
// read as ice skating at the base 5.2 world-units/s movement speed.
export const HERO_RUN_FRAME_DISTANCE_2D = 0.46

export function heroGroundedRunFrames2D(heroDef, directionKey = 's') {
  const run = heroDef?.animations?.run ?? heroDef?.animations?.idle ?? [0]
  // All v2 directional sheets are authored and normalized as grounded cycles.
  return run
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

export function enemyTextureKey2D(id, uid = 0) {
  if (id === 'wisp') return 'wisp'
  if (id === 'talismanGhost' || id === 'snowWraith') {
    return enemyMotionNoise2D(uid, 0x36d84b71) < 0.5
      ? 'talismanRevenant'
      : 'maskedSealRevenant'
  }
  if (id === 'jadeSerpent') return 'jadeSerpent'
  if (id === 'stoneGhoul') {
    return enemyMotionNoise2D(uid, 0x9ad47c31) < 0.5
      ? 'jadeStoneGhoul'
      : 'jadeShardGuardian'
  }
  if (id === 'bloodScorpion') return 'bloodScorpion'
  // The cobalt-marked yorang is the chapter's named beast encounter. Mixing
  // that saturated boss identity into every ordinary hound pack made the Jade
  // arena look like two unrelated asset sets. Rank-and-file wolves therefore
  // keep the slate/jade ridge-hound silhouette; the boss renderer still uses
  // the authored yorang sheets directly.
  if (id === 'wolf') return 'jadeRidgeHound'
  if (id === 'demonCultivator') {
    return enemySilhouetteVariant2D(uid, 0x7451c2e9) < 0.5
      ? 'voidSentinel'
      : 'shadowSealDuelist'
  }
  throw new RangeError(`적 ${id}에는 전용 런타임 모션 시트가 없습니다.`)
}

function isWolfActorKey2D(key) {
  return key === 'yorang' || key === 'jadeRidgeHound'
}

/**
 * Shared atlas silhouettes still need species identity. Keep authored texture
 * detail by mixing each enemy's palette toward white instead of applying a
 * dark full-strength multiply. The authored wraith also keeps most of its
 * cyan-violet material detail while still accepting stage-specific identity.
 */
const ENEMY_VARIANT_TINT_TARGETS_2D = Object.freeze({
  wisp: Object.freeze([0xb8aec8, 0x91c5c3]),
  yorang: Object.freeze([0x718a7b, 0x7d8991]),
  jadeRidgeHound: Object.freeze([0x6f8879, 0x81948a]),
  jadeSerpent: Object.freeze([0x718c77, 0x8b927a]),
  jadeStoneGhoul: Object.freeze([0x8d988f, 0x789d8b]),
  jadeShardGuardian: Object.freeze([0x879a8d, 0x72a28e]),
  bloodScorpion: Object.freeze([0x8c7470, 0x947f70]),
  talismanRevenant: Object.freeze([0x978fac, 0x86a5ab]),
  maskedSealRevenant: Object.freeze([0xa38fab, 0x79a9ad]),
  voidSentinel: Object.freeze([0x85969d, 0x9b8ca4]),
  shadowSealDuelist: Object.freeze([0x91899f, 0x83a0a3]),
})

export function enemyActorTint2D(color, textureKey = 'wisp', hitFlash = false, variant = 0.5) {
  if (hitFlash) return 0xffb6b6
  const source = Number.isFinite(color) ? (color >>> 0) : 0xffffff
  const baseTint = blendTint2D(source, 0xffffff, textureKey === 'wisp' ? 0.58 : 0.54)
  const targets = ENEMY_VARIANT_TINT_TARGETS_2D[textureKey]
  if (!targets) return baseTint
  const numericVariant = Number(variant)
  const normalized = Number.isFinite(numericVariant)
    ? Math.max(0, Math.min(1, numericVariant))
    : 0.5
  const target = blendTint2D(targets[0], targets[1], normalized)
  // The shared material grade applies at every variant, including the middle.
  // Variation stays inside the ink-jade range rather than exposing a saturated
  // source colour whenever the seeded palette happens to land near 0.5.
  const amount = (textureKey === 'wisp' ? 0.6 : 0.7)
    + Math.abs(normalized - 0.5) * 0.06
  return blendTint2D(baseTint, target, amount)
}

function enemyRuntimeBaseHeight2D(key, elite = false) {
  const actor = SPRITE_MANIFEST.actors[key]
  if (!actor) return 80
  if (key === 'wisp') return WISP_THREAT_PRESENTATION_2D.baseHeight
  if (isWolfActorKey2D(key)) return actor.runtimeHeight * (elite ? 1.18 : 1)
  if (key === 'shadowSealDuelist' || key === 'voidSentinel') {
    return actor.runtimeHeight * (elite ? 1.06 : 0.9)
  }
  return actor.runtimeHeight
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
    this.worldCamera = new WorldCamera2D()
    this.worldFrame = createWorldFrame2D(0, 0, this.viewport, {})
    this.playerX = 0
    this.playerZ = 0
    this.heroTravelDistance = 0
    this.heroLastWorldX = 0
    this.heroLastWorldZ = 0
    this.heroFrameKey = ''
    this.heroDirectionState = null
    this.heroReactionDirectionState = null
    this.time = 0
    this.runActive = false
    this.lastRenderMs = 0
    this.drawCalls = 0
    this.triangles = 0
    this.backendLabel = 'PixiJS WebGL'
    this.gpuLabel = 'unknown'
    this.enemyPool = []
    this.enemyDeathPool = []
    this.enemyDeathCursor = 0
    this.effectPool = []
    this.weaponFieldPool = []
    this.weaponFieldVisualPlan = []
    this.weaponFieldClusterMarks = new Uint16Array(MAX_WEAPON_FIELDS_2D)
    this.propPool = []
    this.poiPool = []
    this.mapDecalPool = []
    this.mapDecalTextures = []
    this.mapPropDiagnostics = mapPropPoolDiagnostic(0, MAX_ACTIVE_MAP_PROPS)
    this.damageTextPool = []
    this.damageTextCursor = 0
    this.damageTextSerial = 0
    this.activeMapChunkKey = ''
    this.mapSeed = 0x51f15e
    this._groundStageId = ''
    this.groundBaseTextures = null
    this.generatedFloorBase = null
    this._groundChunkAlpha = 0.9
    this._floorTileScale = { x: 1, y: 0.62 }
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

  _syncWorldFrame(shakeX = 0, shakeZ = 0) {
    createWorldFrame2D(
      this.cameraX + shakeX,
      this.cameraZ + shakeZ,
      this.viewport,
      this.worldFrame,
    )
  }

  _projectWorld(x, z, out = _screen) {
    if (!this.worldFrame) {
      this.worldFrame = createWorldFrame2D(this.cameraX, this.cameraZ, this.viewport, {})
    }
    return projectWorldWithFrame2D(x, z, this.worldFrame, out)
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
      antialias: true,
      autoDensity: true,
      resolution: nativeRenderResolution2D(this.quality.scale, window.devicePixelRatio),
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
    // Keep the title backdrop, arena materials, actors, props and effects in
    // one authored value range. DOM surfaces use the same ink/jade tokens in
    // styles/ink-ui.css; this is the corresponding runtime art-direction
    // boundary for the Pixi scene.
    this.realmArtGrade = createRealmArtGrade2D()
    stage.filters = [this.realmArtGrade]

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
    this.floor.tint = 0xd4e0da
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
    // The opening is authored by the same streamed floor-detail and prop
    // clusters as the rest of the sanctuary. A separately scaled origin
    // plate made the first screen read like a debug arena placed on top of the
    // world, so no screen-sized plaza sprite is allocated or rendered here.
    this.spawnPlaza = null

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
      jadeRidgeHound: Texture.WHITE,
      jadeSerpent: Texture.WHITE,
      jadeStoneGhoul: Texture.WHITE,
      jadeShardGuardian: Texture.WHITE,
      bloodScorpion: Texture.WHITE,
      talismanRevenant: Texture.WHITE,
      maskedSealRevenant: Texture.WHITE,
      voidSentinel: Texture.WHITE,
      shadowSealDuelist: Texture.WHITE,
      jadeVoidWarden: Texture.WHITE,
      jadeVoidWardenReaction: Texture.WHITE,
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
      swordScarTrace: swordScarTraceTexture(),
      beastTrailTrace: beastTrailTraceTexture(),
      sealAshTrace: sealAshTraceTexture(),
      enemyIntentSeal: enemyIntentSealTexture(),
      bossTelegraph: bossTelegraphTexture(),
      hit: impactTexture(),
      death: deathTexture(),
      contactLight: contactLightTexture(),
      propFootprint: propFootprintTexture(),
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
    configureActorSprite2D(this.heroAura)
    this.heroAura.anchor.set(0.5)
    this.heroAura.blendMode = 'add'
    this.heroAura.visible = false
    this.groundLightLayer.addChild(this.heroAura)

    this.heroShadow = new Sprite(this.textures.shadow)
    configureActorSprite2D(this.heroShadow)
    this.heroShadow.anchor.set(0.5)
    this.shadowLayer.addChild(this.heroShadow)
    this.hero = new Sprite(this.textures.seolryeong)
    configureActorSprite2D(this.hero)
    this.hero.anchor.set(0.5, SPRITE_MANIFEST.actors.seolryeong.pivot[1])
    this.actorBuckets[32].addChild(this.hero)

    this.bossShadow = new Sprite(this.textures.shadow)
    configureActorSprite2D(this.bossShadow)
    this.bossShadow.anchor.set(0.5)
    this.bossShadow.visible = false
    this.shadowLayer.addChild(this.bossShadow)
    this.bossContact = new Sprite(this.textures.contactLight)
    configureActorSprite2D(this.bossContact)
    this.bossContact.anchor.set(0.5)
    this.bossContact.blendMode = 'add'
    this.bossContact.visible = false
    this.contactLightLayer.addChild(this.bossContact)
    this.bossIntent = new Sprite(this.textures.ring)
    configureActorSprite2D(this.bossIntent)
    this.bossIntent.anchor.set(0.5)
    this.bossIntent.visible = false
    this.shadowLayer.addChild(this.bossIntent)
    this.bossDangerZone = new Graphics()
    this.bossDangerZone.visible = false
    this.bossDangerZone.blendMode = 'normal'
    this.groundLightLayer.addChild(this.bossDangerZone)
    this.boss = new Sprite(this.textures.jadeVoidWarden)
    configureActorSprite2D(this.boss)
    this.boss.anchor.set(0.5, SPRITE_MANIFEST.actors.jadeVoidWarden.pivot[1])
    this.boss.visible = false
    this.actorBuckets[32].addChild(this.boss)

    this.heroMarker = new Sprite(this.textures.ring)
    configureActorSprite2D(this.heroMarker)
    this.heroMarker.anchor.set(0.5)
    this.heroMarker.blendMode = 'normal'
    this.heroMarker.visible = false
    // The marker is ground information. Rendering it in the late effect layer
    // drew the ring over the heroine's boots and made it look like a tilted UI
    // disc attached to her body.
    this.groundLightLayer.addChild(this.heroMarker)

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
    this._ensureEnemyDeaths(48)
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
        ...Object.values(SPRITE_MANIFEST.actors.seolryeong.reactionRuntime).map((entry) => entry.url),
        SPRITE_MANIFEST.actors.wisp.url,
        SPRITE_MANIFEST.actors.yorang.url,
        ...ENEMY_DIRECTIONAL_RUNTIME_ASSETS_2D.map((entry) => entry.url),
        ...ENEMY_REACTION_RUNTIME_ASSETS_2D.map((entry) => entry.url),
        SPRITE_MANIFEST.actors.jadeRidgeHound.url,
        SPRITE_MANIFEST.actors.jadeSerpent.url,
        SPRITE_MANIFEST.actors.jadeStoneGhoul.url,
        SPRITE_MANIFEST.actors.jadeShardGuardian.url,
        SPRITE_MANIFEST.actors.bloodScorpion.url,
        SPRITE_MANIFEST.actors.talismanRevenant.url,
        SPRITE_MANIFEST.actors.maskedSealRevenant.url,
        SPRITE_MANIFEST.actors.voidSentinel.url,
        SPRITE_MANIFEST.actors.shadowSealDuelist.url,
        SPRITE_MANIFEST.actors.jadeVoidWarden.url,
        JADE_VOID_WARDEN_REACTION_ATLAS_2D.url,
        SPRITE_MANIFEST.environment.jadeSanctuaryProps.url,
      ])
      if (this._destroyed || !this.app) return
      this.groundBaseTextures = {
        jade: Texture.from(jadeGroundUrl),
        default: Texture.from(STONE_URL),
      }
      this.floor.texture = this.groundBaseTextures.jade
      this._replaceGroundTextures(stageId)
      const actorTexture = (url) => configureActorTexture2D(Texture.from(url))
      this.textures.wisp = actorTexture(SPRITE_MANIFEST.actors.wisp.url)
      this.textures.yorang = actorTexture(SPRITE_MANIFEST.actors.yorang.url)
      for (const entry of ENEMY_DIRECTIONAL_RUNTIME_ASSETS_2D) {
        this.textures[entry.textureKey] = actorTexture(entry.url)
      }
      for (const entry of ENEMY_REACTION_RUNTIME_ASSETS_2D) {
        this.textures[entry.textureKey] = actorTexture(entry.url)
      }
      this.textures.jadeRidgeHound = actorTexture(SPRITE_MANIFEST.actors.jadeRidgeHound.url)
      this.textures.jadeSerpent = actorTexture(SPRITE_MANIFEST.actors.jadeSerpent.url)
      this.textures.jadeStoneGhoul = actorTexture(SPRITE_MANIFEST.actors.jadeStoneGhoul.url)
      this.textures.jadeShardGuardian = actorTexture(SPRITE_MANIFEST.actors.jadeShardGuardian.url)
      this.textures.bloodScorpion = actorTexture(SPRITE_MANIFEST.actors.bloodScorpion.url)
      this.textures.talismanRevenant = actorTexture(SPRITE_MANIFEST.actors.talismanRevenant.url)
      this.textures.maskedSealRevenant = actorTexture(SPRITE_MANIFEST.actors.maskedSealRevenant.url)
      this.textures.voidSentinel = actorTexture(SPRITE_MANIFEST.actors.voidSentinel.url)
      this.textures.shadowSealDuelist = actorTexture(SPRITE_MANIFEST.actors.shadowSealDuelist.url)
      this.textures.jadeVoidWarden = actorTexture(SPRITE_MANIFEST.actors.jadeVoidWarden.url)
      this.textures.seolryeong = actorTexture(SPRITE_MANIFEST.actors.seolryeong.url)
      this.textures.seolryeongE = actorTexture(SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.east.url)
      this.textures.seolryeongN = actorTexture(SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.north.url)
      this.textures.seolryeongNe = actorTexture(SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.northeast.url)
      this.textures.seolryeongS = actorTexture(SPRITE_MANIFEST.actors.seolryeong.directionalRuntime.south.url)
      this.textures.seolryeongReaction = actorTexture(SPRITE_MANIFEST.actors.seolryeong.reactionRuntime.southeast.url)
      this.textures.seolryeongReactionE = actorTexture(SPRITE_MANIFEST.actors.seolryeong.reactionRuntime.east.url)
      this.textures.seolryeongReactionN = actorTexture(SPRITE_MANIFEST.actors.seolryeong.reactionRuntime.north.url)
      this.textures.seolryeongReactionNe = actorTexture(SPRITE_MANIFEST.actors.seolryeong.reactionRuntime.northeast.url)
      this.textures.seolryeongReactionS = actorTexture(SPRITE_MANIFEST.actors.seolryeong.reactionRuntime.south.url)
      this.textures.jadeSanctuaryProps = Texture.from(SPRITE_MANIFEST.environment.jadeSanctuaryProps.url)
      this.frames.seolryeong = sliceFrames(this.textures.seolryeong, SPRITE_MANIFEST.actors.seolryeong)
      this.frames.seolryeongE = sliceFrames(this.textures.seolryeongE, SPRITE_MANIFEST.actors.seolryeong)
      this.frames.seolryeongN = sliceFrames(this.textures.seolryeongN, SPRITE_MANIFEST.actors.seolryeong)
      this.frames.seolryeongNe = sliceFrames(this.textures.seolryeongNe, SPRITE_MANIFEST.actors.seolryeong)
      this.frames.seolryeongS = sliceFrames(this.textures.seolryeongS, SPRITE_MANIFEST.actors.seolryeong)
      const heroReactionDef = {
        cell: SPRITE_MANIFEST.actors.seolryeong.reactionCell,
        sheet: SPRITE_MANIFEST.actors.seolryeong.reactionSheet,
      }
      this.frames.seolryeongReaction = sliceFrames(this.textures.seolryeongReaction, heroReactionDef)
      this.frames.seolryeongReactionE = sliceFrames(this.textures.seolryeongReactionE, heroReactionDef)
      this.frames.seolryeongReactionN = sliceFrames(this.textures.seolryeongReactionN, heroReactionDef)
      this.frames.seolryeongReactionNe = sliceFrames(this.textures.seolryeongReactionNe, heroReactionDef)
      this.frames.seolryeongReactionS = sliceFrames(this.textures.seolryeongReactionS, heroReactionDef)
      this.frames.wisp = sliceFrames(this.textures.wisp, SPRITE_MANIFEST.actors.wisp)
      this.frames.yorang = sliceFrames(this.textures.yorang, SPRITE_MANIFEST.actors.yorang)
      for (const entry of ENEMY_DIRECTIONAL_RUNTIME_ASSETS_2D) {
        this.frames[entry.textureKey] = sliceFrames(this.textures[entry.textureKey], entry.actor)
      }
      for (const entry of ENEMY_REACTION_RUNTIME_ASSETS_2D) {
        this.frames[entry.textureKey] = sliceFrames(this.textures[entry.textureKey], {
          cell: entry.actor.reactionCell,
          sheet: entry.actor.reactionSheet,
        })
      }
      // Keep the final boss reaction binding explicit. The generic enemy
      // reaction table also contains this runtime-candidate atlas, but the
      // boss renderer has a separate death window and must never silently
      // fall back to its idle/cast motion sheet if that table changes.
      this.textures.jadeVoidWardenReaction = actorTexture(JADE_VOID_WARDEN_REACTION_ATLAS_2D.url)
      this.frames.jadeVoidWardenReaction = sliceFrames(this.textures.jadeVoidWardenReaction, {
        cell: JADE_VOID_WARDEN_REACTION_ATLAS_2D.cell,
        sheet: JADE_VOID_WARDEN_REACTION_ATLAS_2D.sheet,
      })
      this.frames.jadeRidgeHound = sliceFrames(
        this.textures.jadeRidgeHound, SPRITE_MANIFEST.actors.jadeRidgeHound,
      )
      this.frames.jadeSerpent = sliceFrames(this.textures.jadeSerpent, SPRITE_MANIFEST.actors.jadeSerpent)
      this.frames.jadeStoneGhoul = sliceFrames(
        this.textures.jadeStoneGhoul, SPRITE_MANIFEST.actors.jadeStoneGhoul,
      )
      this.frames.jadeShardGuardian = sliceFrames(
        this.textures.jadeShardGuardian, SPRITE_MANIFEST.actors.jadeShardGuardian,
      )
      this.frames.bloodScorpion = sliceFrames(
        this.textures.bloodScorpion, SPRITE_MANIFEST.actors.bloodScorpion,
      )
      this.frames.talismanRevenant = sliceFrames(
        this.textures.talismanRevenant, SPRITE_MANIFEST.actors.talismanRevenant,
      )
      this.frames.maskedSealRevenant = sliceFrames(
        this.textures.maskedSealRevenant, SPRITE_MANIFEST.actors.maskedSealRevenant,
      )
      this.frames.voidSentinel = sliceFrames(this.textures.voidSentinel, SPRITE_MANIFEST.actors.voidSentinel)
      this.frames.shadowSealDuelist = sliceFrames(
        this.textures.shadowSealDuelist, SPRITE_MANIFEST.actors.shadowSealDuelist,
      )
      this.frames.jadeVoidWarden = sliceFrames(this.textures.jadeVoidWarden, SPRITE_MANIFEST.actors.jadeVoidWarden)
      this.frames.jadeSanctuaryProps = sliceFrames(
        this.textures.jadeSanctuaryProps, SPRITE_MANIFEST.environment.jadeSanctuaryProps,
      )
      this.hero.texture = this.frames.seolryeong[heroIdleFrames2D(
        SPRITE_MANIFEST.actors.seolryeong, 'se',
      )[0]]
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
    // The authored floor is intentionally low-contrast; a restrained jade
    // grade keeps its stone/moss values in the same cool family as the
    // sanctuary props without turning the arena into a grey debug plate.
    this.floor.tint = jade ? 0xf0f4ee : 0xffffff
    this._groundChunkAlpha = jade ? JADE_GROUND_COMPOSITION_2D.decalAlpha : 0.78
    this.mapDecalTextures = Array.from(
      { length: MAP_GROUND_VARIANTS },
      (_, i) => jade
        ? jadeGroundDetailTexture(
            i + 11,
            JADE_REGION_TEXTURE_ORDER_2D[Math.floor(i / JADE_REGION_VARIANTS)] ?? 'jade_grove',
          )
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
      const contact = new Sprite(this.textures.propFootprint)
      contact.anchor.set(0.5)
      contact.blendMode = 'normal'
      contact.visible = false
      this.contactLightLayer.addChild(contact)
      const entry = {
        x: 0, z: 0, height: 120, scale: 1, rotation: 0, cluster: 'edge',
        frame: 0, active: false, groundingKey: 'prop',
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
      const trace = new Sprite(this.textures.swordScarTrace)
      trace.anchor.set(0.5)
      trace.visible = false
      this.groundLightLayer.addChild(trace)
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
      const entry = { sprite, trace, shadow, glow, marker, badge, bucket: 0, groundingKey: 'poi', frame: 7 }
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
    this.farMountains.visible = false
    this.nearMountains.visible = false
    this.farMist.visible = false
    this.floor.visible = running
    this.mapDecalLayer.visible = running
    this.floorRunes.visible = false
    if (this.terrainGrade) this.terrainGrade.visible = false
    this.horizonMist.visible = false
    this.nearMist.visible = false
    this.horizonVeil.visible = false
    this.groundLightLayer.visible = running
    this.weaponFieldLayer.visible = running
    for (const entry of this.propPool) {
      entry.sprite.visible = running && entry.active
      // Keep one small, frame-specific contact shadow. The previous blanket
      // disable removed the only screen-space cue that the atlas object was
      // planted on the projected floor.
      entry.shadow.visible = running && entry.active
      entry.glow.visible = running && entry.active && (entry.frame === 0 || entry.frame === 7)
      entry.contact.visible = false
    }
    if (!running) {
      for (const entry of this.enemyDeathPool) {
        entry.life = 0
        entry.sprite.visible = false
        entry.shadow.visible = false
      }
      for (const entry of this.poiPool) {
        entry.sprite.visible = false
        entry.trace.visible = false
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
      const intent = new Sprite(this.textures.enemyIntentSeal)
      configureActorSprite2D(intent)
      intent.anchor.set(0.5)
      intent.visible = false
      this.shadowLayer.addChild(intent)
      const shadow = new Sprite(this.textures.shadow)
      configureActorSprite2D(shadow)
      shadow.anchor.set(0.5)
      shadow.visible = false
      this.shadowLayer.addChild(shadow)
      const contact = new Sprite(this.textures.contactLight)
      configureActorSprite2D(contact)
      contact.anchor.set(0.5)
      contact.blendMode = 'add'
      contact.visible = false
      this.contactLightLayer.addChild(contact)
      const sprite = new Sprite(this.textures.wisp)
      configureActorSprite2D(sprite)
      sprite.anchor.set(0.5, 0.88)
      sprite.visible = false
      const entry = {
        sprite, shadow, contact, intent, bucket: 0, key: 'wisp', frame: 0,
        motionUid: 0, motion: enemyMotionProfile2D(0, 'wisp'),
        direction: null, reactionFacing: null, reactionActive: false,
      }
      this.actorBuckets[0].addChild(sprite)
      this.enemyPool.push(entry)
    }
  }

  _ensureEnemyDeaths(count) {
    const target = Math.min(Math.max(0, count), 96)
    while (this.enemyDeathPool.length < target) {
      const shadow = new Sprite(this.textures.shadow)
      configureActorSprite2D(shadow)
      shadow.anchor.set(0.5)
      shadow.visible = false
      this.shadowLayer.addChild(shadow)
      const sprite = new Sprite(this.textures.wisp)
      configureActorSprite2D(sprite)
      sprite.anchor.set(0.5, 0.9)
      sprite.visible = false
      const entry = {
        sprite, shadow, bucket: 0, key: '', groundingKey: '', frame: 0,
        enemyId: '', x: 0, z: 0, facing: 0, elite: false, frozen: false,
        life: 0, maxLife: 0.78, motion: enemyMotionProfile2D(0, 'wisp'),
      }
      this.actorBuckets[0].addChild(sprite)
      this.enemyDeathPool.push(entry)
    }
  }

  spawnEnemyDeath(event) {
    if (!this.runActive || !this._runAssetsReady || !event || this.enemyDeathPool.length === 0) return false
    let key = ''
    try {
      key = enemyTextureKey2D(event.enemyId, event.id)
    } catch {
      return false
    }
    const actor = SPRITE_MANIFEST.actors[key]
    if (!actor?.reactionAnimations?.death?.length || !actor.reactionRuntime) return false
    let slot = this.enemyDeathPool.findIndex((entry) => entry.life <= 0)
    if (slot < 0) slot = this.enemyDeathCursor++ % this.enemyDeathPool.length
    const entry = this.enemyDeathPool[slot]
    entry.key = key
    entry.groundingKey = key
    entry.enemyId = event.enemyId
    entry.x = Number(event.x) || 0
    entry.z = Number(event.z) || 0
    entry.facing = Number.isFinite(event.facing) ? event.facing : 0
    entry.elite = Boolean(event.elite)
    entry.frozen = Boolean(event.frozen)
    entry.life = entry.maxLife = 0.78
    entry.motion = enemyMotionProfile2D(event.id, key)
    entry.frame = actor.reactionAnimations.death[0]
    entry.sprite.visible = true
    entry.shadow.visible = true
    return true
  }

  _renderEnemyDeaths(dt) {
    for (const entry of this.enemyDeathPool) {
      if (entry.life <= 0) {
        entry.sprite.visible = false
        entry.shadow.visible = false
        continue
      }
      entry.life = Math.max(0, entry.life - Math.max(0, Number(dt) || 0))
      if (entry.life <= 0) {
        entry.sprite.visible = false
        entry.shadow.visible = false
        continue
      }
      const actor = SPRITE_MANIFEST.actors[entry.key]
      const directional = directionalEnemyReactionFrames2D(this.frames, entry.key, entry.facing)
      if (!actor || !directional) {
        entry.life = 0
        entry.sprite.visible = false
        entry.shadow.visible = false
        continue
      }
      entry.frame = enemyReactionFrameIndex2D(actor, 'death', entry.life, entry.maxLife)
        ?? actor.reactionAnimations.death.at(-1)
      entry.sprite.texture = directional.frames[entry.frame]
      entry.sprite.anchor.set(0.5, actorFootPivot2D(directional.pivotKey, entry.frame))
      const def = ENEMIES.find((candidate) => candidate.id === entry.enemyId)
        ?? ENEMIES[0]
      const grounding = actorGroundingProfile2D(entry.key, entry.frame)
      const visualHeight = enemyRuntimeBaseHeight2D(entry.key, entry.elite)
        * this._presentationScale * (def?.scale ?? 1) * grounding.visualScale * entry.motion.scale
      const fade = Math.min(1, entry.life / (entry.maxLife * 0.18))
      const tint = entry.frozen
        ? blendTint2D(enemyActorTint2D(def?.color, entry.key, false, entry.motion.palette), 0xd8f7ff, 0.42)
        : enemyActorTint2D(def?.color, entry.key, false, entry.motion.palette)
      this._placeActor(entry, entry.x, entry.z, visualHeight, fade, entry.facing, tint, 0, directional.mirror)
      entry.sprite.blendMode = 'normal'
      entry.sprite.rotation = 0
      entry.sprite.scale.x *= entry.motion.aspect
      entry.shadow.alpha *= 0.88 * fade
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
      this._projectWorld(entry.x, entry.z, _screen)
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
    this.app.renderer.resolution = nativeRenderResolution2D(scale, window.devicePixelRatio)
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
    // Moving the window between monitors can change Windows display scaling
    // without changing the selected quality mode.
    this.app.renderer.resolution = nativeRenderResolution2D(
      this.quality?.scale ?? 1,
      window.devicePixelRatio,
    )
    this.viewport.width = width
    this.viewport.height = height
    this._presentationScale = viewportPresentationScale(this.viewport)
    this._syncWorldFrame()
    this.app.renderer.resize(width, height)
    cover(this.backdrop, width, height)
    this.backdropBaseX = this.backdrop.position.x
    this.backdropBaseY = this.backdrop.position.y
    this.backdropWash.clear().rect(0, 0, width, height).fill({ color: 0x06101a, alpha: 0.36 })
    this.combatSky.clear()
      .rect(0, 0, width, height).fill({ color: 0xaaa393 })
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
    this.heroReactionDirectionState = null
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
    for (const entry of this.enemyPool) {
      entry.sprite.visible = false
      entry.shadow.visible = false
      entry.contact.visible = false
      entry.intent.visible = false
    }
    for (const entry of this.enemyDeathPool) {
      entry.life = 0
      entry.sprite.visible = false
      entry.shadow.visible = false
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
    this.worldCamera.reset(snapshot.player.x, snapshot.player.z)
    this.cameraX = this.worldCamera.x
    this.cameraZ = this.worldCamera.z
    this._syncWorldFrame()
    this.playerX = snapshot.player.x
    this.playerZ = snapshot.player.z
    this.heroTravelDistance = 0
    this.heroLastWorldX = snapshot.player.x
    this.heroLastWorldZ = snapshot.player.z
    this.heroFrameKey = ''
    this.heroDirectionState = null
    this.heroReactionDirectionState = null
    for (const entry of this.enemyPool) {
      entry.key = ''
      entry.motionUid = 0
      entry.direction = null
      entry.reactionFacing = null
      entry.reactionActive = false
    }
    for (const entry of this.enemyDeathPool) {
      entry.life = 0
      entry.sprite.visible = false
      entry.shadow.visible = false
    }
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
    let activePropCount = 0
    for (let i = 0; i < this.mapDecalPool.length; i++) {
      const entry = this.mapDecalPool[i]
      const chunk = chunks[i]
      entry.active = Boolean(chunk)
      entry.sprite.visible = Boolean(chunk)
      if (!chunk) continue
      entry.x = (chunk.x + 0.5) * MAP_CHUNK_SIZE
      entry.z = (chunk.z + 0.5) * MAP_CHUNK_SIZE
      entry.variant = mapDecalTextureIndex2D(this._groundStageId, chunk)
      // Use the semantic-region index calculated above. The old assignment
      // accidentally went back to the raw chunk variant, so paths, groves,
      // shrines and marshes all sampled the same first six generic textures.
      entry.sprite.texture = this.mapDecalTextures[entry.variant % this.mapDecalTextures.length]
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
        activePropCount++
        // Keep iterating so the diagnostic reports the complete generated
        // count. A capacity regression must be visible to QA, never silently
        // hidden by an early break.
        if (propIndex >= this.propPool.length) continue
        const target = this.propPool[propIndex++]
        target.active = true
        target.x = prop.x
        target.z = prop.z
        target.height = prop.height
        target.scale = prop.scale ?? 1
        // Rigid shrine props are upright billboards. Their authored variation
        // is expressed by cluster, frame and scale; rotating the screen plane
        // would tilt the base away from the shared world foot baseline.
        target.rotation = 0
        target.cluster = prop.cluster ?? 'edge'
        target.frame = prop.frame
        target.landmark = Boolean(prop.landmark)
        target.regionId = prop.regionId ?? chunk.regionId
        target.sprite.texture = this.frames.jadeSanctuaryProps[prop.frame]
      }
    }
    this.mapPropDiagnostics = mapPropPoolDiagnostic(activePropCount, this.propPool.length)
    if (!this.mapPropDiagnostics.withinCapacity) {
      this.onMapPropCapacityViolation?.(this.mapPropDiagnostics)
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
      this._projectWorld(entry.x, entry.z, _screen)
      entry.sprite.position.set(_screen.x, _screen.y)
      const overlap = this._groundStageId === 'jade' ? JADE_GROUND_COMPOSITION_2D.decalOverlap : 1.01
      entry.sprite.width = MAP_CHUNK_SIZE * _screen.unit * overlap
      entry.sprite.height = MAP_CHUNK_SIZE * _screen.depthUnit * overlap
      entry.sprite.visible = isOnScreen(_screen.x, _screen.y, this.viewport, entry.sprite.width)
    }
  }

  _placeActor(entry, x, z, height, alpha, facing, tint, bob = 0, mirrorOverride = null) {
    this._projectWorld(x, z, _screen)
    const sprite = entry.sprite
    const shadow = entry.shadow
    const mirror = typeof mirrorOverride === 'boolean'
      ? mirrorOverride
      : actorMirrorForFacing2D(entry.groundingKey ?? entry.key, facing)
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
      const contactProfile = propGroundContactProfile2D(entry.frame, visualHeight)
      entry.sprite.anchor.y = contactProfile.pivot
      const materialTint = PROP_MATERIAL_TINTS_2D[entry.frame % PROP_MATERIAL_TINTS_2D.length]
      const regionTint = REGION_TERRAIN_PRESENTATION_2D[entry.regionId]?.propTint ?? materialTint
      this._placeActor(entry, entry.x, entry.z, visualHeight, 1, 0, blendTint2D(materialTint, regionTint, 0.08))
      const grounding = actorGroundingProfile2D('prop', entry.frame)
      entry.shadow.tint = 0x29453d
      // The atlas silhouettes have no baked contact on the authored floor.
      // Keep only this short, jade-graded occlusion cue; the core stays under
      // the sampled foot pivot and never becomes a floating selection disc.
      entry.shadow.alpha = Math.min(0.52, grounding.shadowAlpha * 0.98)
        * (entry.sprite.visible ? 1 : 0)
      // Match the contact shadow to the actual frame silhouette instead of
      // leaving a barely visible generic ellipse above the prop's feet. The
      // narrow, dark oval is an occlusion cue, not a selection/debug ring.
      entry.shadow.width = Math.max(18, visualHeight * grounding.shadowWidth)
      entry.shadow.height = Math.max(6, visualHeight * Math.max(0.05, grounding.shadowHeight * 1.1))
      entry.shadow.visible = entry.sprite.visible
      // Props use a dedicated irregular soil/moss footprint below the tight
      // contact shadow. This is world-ground material, not a glowing ring: it
      // remains low-contrast and shares the region's jade value.
      entry.contact.position.set(_screen.x, _screen.y + contactProfile.contactOffsetPx)
      entry.contact.width = entry.shadow.width * PROP_GROUND_FOOTPRINT_2D.widthScale
      entry.contact.height = Math.max(
        PROP_GROUND_FOOTPRINT_2D.minimumHeight,
        entry.shadow.height * PROP_GROUND_FOOTPRINT_2D.heightScale,
      )
      entry.contact.tint = blendTint2D(0x718774, regionTint, 0.42)
      entry.contact.alpha = PROP_GROUND_FOOTPRINT_2D.alpha
      entry.contact.visible = entry.sprite.visible
      // Never rotate a planter or stone from its base. Only the cloth banner
      // receives a restrained whole-cell sway; the other props stay planted.
      // Only the hanging banner receives a near-zero cloth sway. Stone,
      // lantern and planter silhouettes stay vertically authored and planted.
      entry.sprite.rotation = entry.frame === 4
        ? Math.sin(this.time * 1.7 + entry.phase) * 0.004 : 0
      const lit = entry.frame === 0 || entry.frame === 7
      entry.glow.visible = lit && entry.sprite.visible
      if (lit) {
        entry.glow.position.set(entry.shadow.position.x, entry.shadow.position.y - visualHeight * 0.16)
        const flicker = 0.9 + Math.sin(this.time * 6.7 + entry.phase) * 0.1
        entry.glow.width = visualHeight * 1.02 * flicker
        entry.glow.height = visualHeight * 0.46 * flicker
        entry.glow.alpha = 0.21 * flicker
      }
      const edge = Math.min(_screen.x, this.viewport.width - _screen.x, _screen.y, this.viewport.height - _screen.y)
      const fade = Math.max(0, Math.min(1, (edge + 45) / 125))
      entry.sprite.alpha *= fade
      entry.shadow.alpha *= fade
      entry.contact.alpha *= fade
      entry.glow.alpha *= fade
    }
  }

  _renderPois(snapshot, nearbyId = null) {
    const items = snapshot?.items ?? []
    for (let i = 0; i < this.poiPool.length; i++) {
      const entry = this.poiPool[i]
      const item = items[i]
      if (!item) {
        entry.sprite.visible = false
        entry.trace.visible = false
        entry.shadow.visible = false
        entry.glow.visible = false
        entry.marker.visible = false
        entry.badge.visible = false
        continue
      }
      const config = POI_PRESENTATION[item.type] ?? POI_PRESENTATION.altar
      const visualHeight = config.height * this._presentationScale
      const available = item.state !== 'locked' && item.state !== 'consumed'
      const nearby = available && item.id === nearbyId
      if (config.groundTrace) {
        const traceConfig = INVESTIGATION_TRACE_PRESENTATION_2D[item.clueId]
          ?? INVESTIGATION_TRACE_PRESENTATION_2D['sword-scar']
        this._projectWorld(item.x, item.z, _screen)
        entry.sprite.visible = false
        entry.shadow.visible = false
        entry.trace.texture = this.textures[traceConfig.texture]
        entry.trace.position.set(_screen.x, _screen.y + 1)
        entry.trace.width = traceConfig.width * this._presentationScale
        entry.trace.height = traceConfig.height * this._presentationScale
        entry.trace.alpha = available ? (nearby ? 0.98 : 0.74) : 0.12
        entry.trace.visible = isOnScreen(_screen.x, _screen.y, this.viewport, traceConfig.width)
        const pulse = 0.95 + Math.sin(this.time * (nearby ? 4.2 : 1.8) + i) * (nearby ? 0.06 : 0.025)
        entry.glow.position.set(_screen.x, _screen.y)
        entry.glow.width = traceConfig.width * this._presentationScale * 1.3 * pulse
        entry.glow.height = traceConfig.height * this._presentationScale * 0.82 * pulse
        entry.glow.tint = config.color
        entry.glow.alpha = available ? (nearby ? 0.14 : 0.045) : 0
        entry.glow.visible = entry.trace.visible && available
        entry.marker.position.set(_screen.x, _screen.y + 3)
        entry.marker.width = traceConfig.width * 0.9 * pulse
        entry.marker.height = traceConfig.height * 0.55 * pulse
        entry.marker.rotation = 0
        entry.marker.tint = config.color
        // The trace itself is the world clue. A ring marker turns it into an
        // editor-style target gizmo, so navigation stays in the radar/objective
        // copy and the ground remains a believable sanctuary floor.
        entry.marker.alpha = 0
        entry.marker.visible = false
        entry.badge.text = traceConfig.glyph
        entry.badge.position.set(_screen.x, _screen.y - traceConfig.height * this._presentationScale * 0.72)
        entry.badge.tint = config.color
        entry.badge.scale.set(0.68)
        entry.badge.alpha = nearby ? 0.82 : 0
        entry.badge.visible = entry.trace.visible && nearby
        continue
      }
      entry.trace.visible = false
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
      entry.marker.width = 96 * pulse
      entry.marker.height = 28 * pulse
      entry.marker.rotation = 0
      entry.marker.tint = config.color
      // A persistent bright ellipse under every point of interest read like an
      // editor trigger volume. The ring now appears only at interaction range;
      // the prop's authored glow remains the distant navigation cue.
      entry.marker.alpha = available && nearby ? 0.46 : 0
      entry.marker.visible = entry.sprite.visible && available && nearby
      // The old always-on Hangul badge floated above the prop like an editor
      // gizmo. Navigation belongs to the radar and objective copy; reveal the
      // seal glyph only in interaction range so the altar carries the distant
      // silhouette instead of a debug-like label.
      entry.badge.text = config.glyph
      entry.badge.position.set(_screen.x, _screen.y - visualHeight * 0.84)
      entry.badge.tint = config.color
      entry.badge.scale.set(0.82)
      entry.badge.alpha = nearby ? 0.88 : 0
      entry.badge.visible = entry.sprite.visible && nearby
    }
  }

  _renderEnemies(field, alpha) {
    if (field.count > this.enemyPool.length) this._ensureEnemies(Math.min(900, Math.ceil(field.count / 64) * 64))
    for (let i = 0; i < field.count; i++) {
      const entry = this.enemyPool[i]
      const def = ENEMIES[field.type[i]] ?? ENEMIES[0]
      const key = enemyTextureKey2D(def.id, field.uid[i])
      const attackDuration = enemyAttackPresentationDuration2D(def, field.behavior[i])
      const intentPresentation = resolveEnemyIntentPresentation2D(
        _enemyIntentPresentation,
        field.attackTimer[i],
        field.contactIntentTimer?.[i],
        attackDuration,
      )
      if (entry.key !== key || entry.motionUid !== field.uid[i]) {
        entry.key = key
        entry.motionUid = field.uid[i]
        entry.motion = enemyMotionProfile2D(field.uid[i], key)
        entry.direction = null
        entry.reactionFacing = null
        entry.reactionActive = false
      }
      const motion = entry.motion
      const actor = SPRITE_MANIFEST.actors[key]
      const wolfActor = isWolfActorKey2D(key)
      const attacking = intentPresentation.visible
      const hurt = field.flash[i] > 0 && actor.reactionAnimations?.hurt?.length > 0
      const directionState = enemyDirectionFor2D(field.facing[i], entry.direction)
      entry.direction = directionState.direction
      const facing = directionState.angle
      if (hurt) {
        if (!entry.reactionActive) {
          entry.reactionFacing = facing
          entry.reactionActive = true
        }
      } else if (entry.reactionActive) {
        entry.reactionFacing = null
        entry.reactionActive = false
      }
      const reactionFacing = entry.reactionActive && Number.isFinite(entry.reactionFacing)
        ? entry.reactionFacing : facing
      const renderFacing = entry.reactionActive ? reactionFacing : facing
      const locomotion = actor.animations.walk ?? actor.animations.hover ?? actor.animations.idle
      const attack = actor.animations.attack ?? actor.animations.cast ?? locomotion
      const locomotionActive = enemyMotionActive2D(field, i)
      entry.frame = hurt
        ? enemyReactionFrameIndex2D(actor, 'hurt', field.flash[i], 0.14)
        : attacking
          ? oneShotFrameIndex(attack, intentPresentation.remaining, intentPresentation.duration)
          : enemyLocomotionFrameIndex2D(locomotion, this.time, wolfActor ? 9 : 7, motion, locomotionActive)
      const x = field.prevX[i] + (field.x[i] - field.prevX[i]) * alpha
      const z = field.prevZ[i] + (field.z[i] - field.prevZ[i]) * alpha
      const directional = hurt
        ? directionalEnemyReactionFrames2D(this.frames, key, renderFacing)
        : directionalEnemyFrames2D(this.frames, key, renderFacing)
      const normalDirectional = directionalEnemyFrames2D(this.frames, key, renderFacing)
      const resolvedDirectional = directional ?? normalDirectional
      entry.sprite.texture = resolvedDirectional.frames[entry.frame]
        ?? normalDirectional.frames[entry.frame]
        ?? this.frames[key][entry.frame]
      entry.sprite.anchor.set(
        hurt ? actor.reactionPivot?.[0] ?? 0.5 : 0.5,
        actorFootPivot2D(resolvedDirectional.pivotKey, entry.frame),
      )
      const baseHeight = enemyRuntimeBaseHeight2D(key, Boolean(field.elite[i]))
      const motionPhase = motion.phase * Math.PI * 2
      // The authored locomotion cells already contain the weight transfer and
      // hover cadence. Applying a second sinusoidal bob to the whole quad
      // moved the contact shadow away from the feet and made a grounded enemy
      // look like a sticker floating over a separately scrolling floor. Keep
      // a restrained sway only for the explicitly airborne wisp family.
      const pulse = key === 'wisp'
        ? Math.sin(this.time * 5 * motion.tempo + motionPhase) * 2.2 * motion.bobScale
        : 0
      const tint = enemyActorTint2D(def.color ?? 0xa880db, key, field.flash[i] > 0, motion.palette)
      const spawnProgress = Math.max(0, Math.min(1, (field.age?.[i] ?? 1) / 0.24))
      const spawnEase = 1 - (1 - spawnProgress) ** 3
      const grounding = actorGroundingProfile2D(key, entry.frame)
      const visualHeight = baseHeight * this._presentationScale * (def.scale ?? 1) * grounding.visualScale
        * motion.scale * (0.78 + spawnEase * 0.22)
      this._placeActor(entry, x, z, visualHeight,
        (field.dead[i] ? 0.25 : 1) * spawnEase,
        renderFacing, tint, pulse, resolvedDirectional.mirror)
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
        const overlapAlpha = enemyHeroOverlapAlpha2D(Math.hypot(x - player.x, z - player.z), key)
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
      entry.contact.visible = entry.sprite.visible && (field.elite?.[i] || grounding.contactAlpha > 0)
      if (key === 'wisp') {
        // Additive wisps interleaved with opaque actors forced a blend-state
        // break at almost every depth-sorted enemy (400+ draws in stress QA).
        // Their authored alpha and local glow still read cleanly in normal mode
        // while the entire horde stays in Pixi's multi-texture batch.
        entry.sprite.blendMode = 'normal'
        const wispSway = wispThreatRotation2D(this.time, field.uid[i])
        entry.sprite.rotation = wispSway + motion.lean
        entry.sprite.alpha *= WISP_THREAT_PRESENTATION_2D.alphaBase
          + Math.sin(this.time * 4.4 + field.uid[i]) * WISP_THREAT_PRESENTATION_2D.alphaPulse
        entry.sprite.scale.x *= (1 + wispSway * 0.32) * motion.aspect
        entry.sprite.scale.y *= 1 - Math.abs(wispSway) * 0.12
      } else {
        entry.sprite.blendMode = 'normal'
        // Do not rotate or squash an entire authored sprite to manufacture a
        // walk cycle. That transforms the feet and shadow independently from
        // the painted pose and is the source of the visible jitter/hover.
        // `motion.aspect` is a stable per-instance silhouette variation, not a
        // per-frame deformation, so the horde retains identity without wobble.
        entry.sprite.rotation = 0
        entry.sprite.scale.x *= motion.aspect
        if (field.flash[i] > 0) {
          entry.sprite.scale.x *= 1.055
          entry.sprite.scale.y *= 1.055
        }
      }
      const intent = entry.intent
      intent.visible = intentPresentation.visible && entry.sprite.visible
      if (intent.visible) {
        const intentProgress = Math.max(0, Math.min(1,
          1 - intentPresentation.remaining / intentPresentation.duration,
        ))
        const intentScale = Math.max(0.28, baseHeight * this._presentationScale / 360)
        intent.position.set(_screen.x, _screen.y + 4)
        intent.scale.set(intentScale * (1.04 + intentProgress * 0.22), intentScale * 0.58)
        intent.rotation = Math.sin(this.time * 2.4 + field.uid[i]) * 0.035
        intent.tint = field.behavior[i] === 1
          ? 0xff7c96
          : intentPresentation.preContact ? 0xffb85c : 0xf2c76f
        intent.alpha = (intentPresentation.preContact ? 0.24 : 0.16)
          + Math.sin(intentProgress * Math.PI) * 0.34
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
    this._projectWorld(x, z, _screen)
    // The latest snapshot's x/z step is authoritative for locomotion. A
    // stale speed/keyup value cannot keep a run pose alive when the world is
    // already stationary, while repeated renders of one moving snapshot still
    // retain the run contract.
    const motionStep = Math.hypot(
      Number(player.x) - Number(player.prevX),
      Number(player.z) - Number(player.prevZ),
    )
    const moving = heroMotionActive2D({
      actualSpeed: player.actualSpeed,
      speed01: player.speed01,
      worldStep: motionStep,
      dashing: player.dashing,
      teleported: player.teleported,
    })
    const heroDef = SPRITE_MANIFEST.actors.seolryeong
    const heroHeight = heroCombatHeight2D(this.viewport.height, heroDef.runtimeHeight)
    const reactionState = heroReactionState2D(player)
    const normalDirection = heroDirectionFor(player, this.heroDirectionState)
    this.heroDirectionState = normalDirection
    let direction = normalDirection
    if (reactionState) {
      if (this.heroReactionDirectionState?.state === reactionState) {
        direction = this.heroReactionDirectionState.direction
      } else {
        this.heroReactionDirectionState = { state: reactionState, direction: normalDirection }
      }
    } else {
      this.heroReactionDirectionState = null
    }
    const directionalFrames = directionalHeroFrames(this.frames, direction)
    const reactionFrames = directionalHeroReactionFrames(this.frames, direction)
    const travelStep = Math.hypot(
      player.x - this.heroLastWorldX,
      player.z - this.heroLastWorldZ,
    )
    if (moving && player.dashing <= 0 && !player.teleported && travelStep <= 2) {
      this.heroTravelDistance += travelStep
    }
    this.heroLastWorldX = player.x
    this.heroLastWorldZ = player.z
    // Idle belongs to the same normalized motion atlas as locomotion. The
    // separate reaction atlas is intentionally taller and is reserved for
    // hurt/death only; using it for idle made every start and stop resize the
    // heroine by roughly eleven percent.
    const heroRenderHeight = heroGroundingHeight2D(heroHeight, direction.key, reactionState)
    const frame = reactionState
      ? heroReactionFrameIndex2D(heroDef, {
          alive: player.alive,
          hurtTimer: player.hurtTimer,
          deathTimer: player.deathTimer,
          time: this.time,
        })
      : heroAnimationFrameIndex2D(heroDef, {
          moving,
          dashing: player.dashing,
          attackTimer: player.attackTimer,
          time: this.time,
          travelDistance: this.heroTravelDistance,
          runFrames: heroGroundedRunFrames2D(heroDef, direction.key),
          directionKey: direction.key,
        })
    const nextTexture = reactionState ? reactionFrames?.[frame] : directionalFrames[frame]
    this.heroFrameKey = `${direction.key}:${direction.mirror ? 1 : 0}:${reactionState ?? 'motion'}:${frame}`
    if (nextTexture) this.hero.texture = nextTexture
    this.hero.anchor.y = reactionState
      ? heroReactionFootPivot2D(direction.key, frame)
      : heroFootPivot2D(direction.key, frame)
    setHeight(this.hero, heroRenderHeight, direction.mirror)
    // The authored run poses already contain weight transfer. Additional
    // synthetic bob, lean and breathing scale moved the body independently of
    // its sampled foot row and made the heroine appear to hover or resize.
    this.hero.position.set(_screen.x, _screen.y)
    this.hero.rotation = 0
    this.hero.tint = player.hitFlash > 0 ? 0xffdddd : 0xffffff
    this.hero.alpha = player.alive && player.invulnTimer > 0 ? 0.9 : 1
    this.hero.zIndex = _screen.y
    const grounding = actorGroundingProfile2D('hero', frame)
    this.heroShadow.position.set(_screen.x, _screen.y + grounding.shadowOffsetY)
    this.heroShadow.width = Math.max(grounding.minShadowWidth, heroRenderHeight * grounding.shadowWidth)
    this.heroShadow.height = Math.max(grounding.minShadowHeight, heroRenderHeight * grounding.shadowHeight)
    this.heroShadow.alpha = grounding.shadowAlpha
    this.heroAura.position.set(_screen.x, _screen.y + 1)
    const auraPulse = 0.96 + Math.sin(this.time * 2.4) * 0.04
    this.heroAura.width = heroRenderHeight * HERO_AURA_PRESENTATION_2D.widthRatio * auraPulse
    this.heroAura.height = heroRenderHeight * HERO_AURA_PRESENTATION_2D.heightRatio * auraPulse
    this.heroAura.alpha = player.invulnTimer > 0
      ? HERO_AURA_PRESENTATION_2D.invulnerableAlpha
      : HERO_AURA_PRESENTATION_2D.alpha
    this.heroAura.visible = this.hero.visible && player.alive
    this.heroMarker.position.set(_screen.x, _screen.y + HERO_GROUND_MARKER_2D.offsetY)
    this.heroMarker.width = heroRenderHeight * HERO_GROUND_MARKER_2D.widthRatio * auraPulse
    this.heroMarker.height = heroRenderHeight * HERO_GROUND_MARKER_2D.heightRatio * auraPulse
    this.heroMarker.alpha = player.invulnTimer > 0 ? 0.26 : HERO_GROUND_MARKER_2D.alpha
    this.heroMarker.tint = 0xa9ecff
    this.heroMarker.rotation = HERO_GROUND_MARKER_2D.rotation
    this.heroMarker.visible = this.hero.visible && player.alive
    const bucket = depthBucket(_screen.y, this.viewport.height)
    if (this.hero.parent !== this.actorBuckets[bucket]) this.actorBuckets[bucket].addChild(this.hero)
    const slash = heroSlashPresentation2D(
      player.facing,
      player.attackTimer,
      heroHeight,
      _screen.unit,
      _screen.depthUnit,
      moving,
    )
    this.heroSlash.position.set(_screen.x + slash.offsetX, _screen.y + slash.offsetY)
    this.heroSlash.width = slash.width
    this.heroSlash.height = slash.height
    this.heroSlash.rotation = slash.rotation
    this.heroSlash.alpha = slash.alpha
    this.heroSlash.tint = 0xd9f8ff
    this.heroSlash.visible = slash.visible && slash.alpha > 0.02 && this.hero.visible
      && reactionState !== 'hurt' && reactionState !== 'death'
  }

  _updateBossCastPill(boss, profile) {
    const pill = this.bossCastPill
    if (!pill) return
    const castTimer = Number(boss?.castTimer ?? 0)
    if (!boss?.active || boss.reactionState || castTimer <= 0 || !profile) {
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
    const reactionActive = Boolean(boss?.reactionState && boss.reactionTimer > 0)
    if (!boss || (!boss.active && !reactionActive)) {
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
    this._projectWorld(x, z, _screen)
    const wolfBoss = boss.def.id === 'blueWolfKing'
    const bossDef = wolfBoss ? SPRITE_MANIFEST.actors.yorang : SPRITE_MANIFEST.actors.jadeVoidWarden
    const bossFacing = Number.isFinite(boss.facing)
      ? boss.facing
      : Math.atan2(this.cameraX - boss.x, this.cameraZ - boss.z)
    const reactionFacing = reactionActive && Number.isFinite(boss.reactionFacing)
      ? boss.reactionFacing
      : bossFacing
    const directional = wolfBoss && !reactionActive
      ? directionalEnemyFrames2D(this.frames, 'yorang', bossFacing)
      : null
    const reactionDirectional = reactionActive && wolfBoss
      ? directionalEnemyReactionFrames2D(this.frames, 'yorang', reactionFacing)
      : null
    const bossFrames = reactionActive
      ? reactionDirectional?.frames ?? this.frames.jadeVoidWardenReaction ?? []
      : directional?.frames ?? this.frames.jadeVoidWarden ?? []
    const idleFrames = bossDef.animations.idle ?? bossDef.animations.walk
    const castFrames = bossDef.animations.cast ?? bossDef.animations.attack ?? idleFrames
    const castActive = boss.active && !reactionActive && boss.castTimer > 0
    const reactionFrame = reactionActive
      ? bossReactionFrameIndex2D(bossDef, boss.reactionState, boss.reactionTimer)
      : null
    const frame = reactionActive
      ? reactionFrame ?? bossDef.reactionAnimations?.[boss.reactionState]?.[0] ?? 0
      : castActive
        ? oneShotFrameIndex(castFrames, boss.castTimer, boss.castDuration ?? 0.58)
        : loopingFrameIndex(idleFrames, this.time, wolfBoss ? 7 : 5)
    this.boss.texture = bossFrames[frame] ?? this.boss.texture
    const groundingKey = wolfBoss ? 'yorang' : 'jadeVoidWarden'
    const pivotKey = reactionActive
      ? reactionDirectional?.pivotKey ?? (wolfBoss ? 'yorangReaction' : 'jadeVoidWardenReaction')
      : directional?.pivotKey ?? groundingKey
    this.boss.anchor.set(0.5, actorFootPivot2D(pivotKey, frame))
    const mirror = reactionActive
      ? reactionDirectional?.mirror ?? actorMirrorForFacing2D(groundingKey, reactionFacing)
      : directional?.mirror ?? actorMirrorForFacing2D(groundingKey, bossFacing)
    const authoredHeight = wolfBoss
      ? Math.max(220, bossDef.runtimeHeight * 2.55)
      : boss.def.id === 'jadeVoidWarden' ? bossDef.runtimeHeight : 210
    const height = bossCombatHeight2D(this.viewport.height, authoredHeight, this._presentationScale)
    setHeight(this.boss, height, mirror)
    // Boss contact is resolved by the sampled foot pivot just like every other
    // actor. A second sinusoidal lift, even when small, makes its shadow and
    // the projected ground disagree during camera travel.
    this.boss.position.set(_screen.x, _screen.y)
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
      this.bossIntent.tint = wolfBoss ? 0x537b8d : 0xa9362b
      this.bossIntent.alpha = 0.16 + Math.sin(castProgress * Math.PI) * 0.15
    }
    const profile = bossTelegraphProfile2D(boss)
    if (this.bossDangerZone) {
      this.bossDangerZone.visible = castActive
      if (castActive) {
        const castProgress = 1 - boss.castTimer / Math.max(0.001, boss.castDuration ?? 0.58)
        drawBossTelegraph2D(
          this.bossDangerZone, profile, this.worldFrame, this.viewport, castProgress,
        )
      }
    }
    this._updateBossCastPill(boss, profile)
    const bucket = depthBucket(_screen.y, this.viewport.height)
    if (this.boss.parent !== this.actorBuckets[bucket]) this.actorBuckets[bucket].addChild(this.boss)
  }

  _renderWeaponFields(field) {
    const plan = planWeaponFieldVisuals2D(
      field ?? { count: 0 }, this.weaponFieldVisualPlan, this.weaponFieldClusterMarks,
    )
    const count = plan.length
    for (let slot = 0; slot < count; slot++) {
      const item = plan[slot]
      const i = item.index
      const sprite = this.weaponFieldPool[slot]
      const kind = field.kind?.[i] ?? 1
      const behavior = field.behavior?.[i]
      const visual = weaponFieldVisualForBehavior(behavior, kind)
      const life = Number.isFinite(field.life?.[i]) ? field.life[i] : 0
      const maxLife = Number.isFinite(field.maxLife?.[i]) ? field.maxLife[i] : 1
      const statusPulse = behavior?.statusEffects?.freeze?.enabled || behavior?.statusEffects?.burn?.enabled ? 0.035 : 0
      const pulse = weaponFieldPulse2D(life, maxLife, this.time, i, visual.pulse + statusPulse)
      const collisionScale = Math.max(0.72, Math.min(1.45, behavior?.collision?.radiusScale ?? 1))
      const radius = Math.max(0.8, item.radius * (0.92 + collisionScale * 0.08))

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
        this._projectWorld(fromX, fromZ, _segmentStart)
        this._projectWorld(toX, toZ, _segmentEnd)
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

      this._projectWorld(item.x, item.z, _screen)
      const onScreen = isOnScreen(_screen.x, _screen.y, this.viewport, 90)
      const diameter = Math.max(34, Math.min(420, radius * _screen.unit * 2))
      const baseScale = diameter / Math.max(1, this.textures.weaponField.width)
      sprite.position.set(_screen.x, _screen.y + 1)
      sprite.scale.set(baseScale * visual.scaleX * pulse, baseScale * visual.scaleY * pulse)
      sprite.texture = this.textures.weaponFieldFrames?.[visual.frame] ?? this.textures.weaponField
      // The texture is already authored as a perspective-flattened ground
      // ellipse. Rotating that screen-space ellipse makes the field stand up
      // like a shield; pulse the glyph instead and keep its ground axis fixed.
      sprite.rotation = 0
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
    const renderIndices = selectOrbitProjectileRenderIndices2D(plan.indices, field)
    let friendlyCount = 0
    let hostileCount = 0
    for (const i of renderIndices) {
      if (field.hostile[i] === 1) hostileCount++
      else friendlyCount++
    }
    this.friendlyProjectilePool.setActiveCount(friendlyCount)
    this.hostileProjectilePool.setActiveCount(hostileCount)
    let friendlySlot = 0
    let hostileSlot = 0
    for (const i of renderIndices) {
      const hostile = field.hostile[i] === 1
      const item = hostile
        ? this.hostileProjectilePool.items[hostileSlot++]
        : this.friendlyProjectilePool.items[friendlySlot++]
      const x = field.prevX[i] + (field.x[i] - field.prevX[i]) * alpha
      const z = field.prevZ[i] + (field.z[i] - field.prevZ[i]) * alpha
      this._projectWorld(x, z, _screen)
      item.x = _screen.x
      item.y = _screen.y
      const kind = field.kind?.[i] ?? 1
      const behavior = field.behaviorDescriptor?.[i]
      const visual = hostile
        ? hostileProjectileVisualFor(field, i)
        : projectilePresentationForBehavior(behavior, kind, false)
      if (!hostile) {
        item.texture = this.textures.projectileFrames[visual.frame]
        // The fire cell is already a multi-colour parchment/seal/flame asset.
        // Multiplicative tint collapsed those authored values into one orange
        // stamp, so only that explicit signature keeps its atlas colours.
        item.tint = visual.preserveAtlasColor
          ? 0xffffff
          : projectileTintForBehavior2D(behavior, kind, field.color[i])
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
      this._projectWorld(x, z, _screen)
      item.x = _screen.x
      const pickupPulse = Math.sin(this.time * 4 + field.phase[i])
      item.y = _screen.y - 8 * this._presentationScale + pickupPulse * 3.5 * this._presentationScale
      item.rotation = this.time * 0.9 + field.phase[i]
      item.scaleX = item.scaleY = pickupVisualScale2D(field.stone[i], this._presentationScale, pickupPulse)
      item.tint = field.stone[i] ? 0xf4d878 : 0x91dff4
      item.alpha = isOnScreen(_screen.x, _screen.y, this.viewport, 60)
        ? pickupVisualAlpha2D(field.stone[i], field.age?.[i] ?? 0)
        : 0
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
      this._projectWorld(field.x[i], field.z[i], _screen)
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
    this._presentedDt = Math.min(Math.max(0, Number(dt) || 0), 0.1)
    this.time += Math.min(dt, 0.1)
    if (this.runActive) {
      const targetX = snapshot.player.prevX + (snapshot.player.x - snapshot.player.prevX) * alpha
      const targetZ = snapshot.player.prevZ + (snapshot.player.z - snapshot.player.prevZ) * alpha
      this.playerX = targetX
      this.playerZ = targetZ
      this.worldCamera.update({
        x: targetX,
        z: targetZ,
        facing: snapshot.player.facing,
        actualSpeed: snapshot.player.actualSpeed,
        teleported: snapshot.player.teleported,
      }, dt)
      this.cameraX = this.worldCamera.x
      this.cameraZ = this.worldCamera.z
      const shake = Math.max(0, Number(snapshot.world.shake) || 0)
      const shakeX = shake > 0 ? Math.sin(this.time * 83) * shake * 0.035 : 0
      const shakeZ = shake > 0 ? Math.cos(this.time * 71) * shake * 0.035 : 0
      // Shake is a one-frame projection offset. It must never be accumulated
      // into the camera, otherwise the world and click inverse slowly drift.
      this._syncWorldFrame(shakeX, shakeZ)
      groundTileOffsetFromFrame2D(
        this.worldFrame,
        this.floor.tileScale.x,
        this.floor.tileScale.y,
        _screen,
      )
      this.floor.tilePosition.set(_screen.x, _screen.y)
      this._projectWorld(0, 0, _screen)
      this.floorRunes.position.set(_screen.x, _screen.y)
      this.floorRunes.width = 24 * _screen.unit
      this.floorRunes.height = 24 * _screen.depthUnit
      this.floorRunes.visible = isOnScreen(_screen.x, _screen.y, this.viewport, this.floorRunes.width * 0.5)
      this._refreshMapChunks()
      this._renderMapChunks()
      this._renderWeaponFields(snapshot.weaponFields)
      this._renderProps()
      this._renderPois(snapshot.world.interactionsSnapshot, snapshot.world.nearbyPoiId)
      this._renderEnemies(snapshot.enemies, alpha)
      this._renderEnemyDeaths(dt)
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
      'realmArtGrade', 'backdrop', 'backdropWash', 'combatSky', 'combatVista', 'farMountains', 'nearMountains', 'farMist',
      'floor', 'floorBlendMask', 'mapDecalLayer', 'mapDecalBlendMask', 'terrainMask', 'floorRunes', 'terrainGrade', 'spawnPlaza',
      'horizonMist', 'nearMist', 'horizonVeil', 'groundLightLayer', 'contactLightLayer', 'weaponFieldLayer', 'shadowLayer',
      'actorRoot', 'actorBuckets', 'friendlyProjectileContainer', 'hostileProjectileContainer',
      'pickupContainer', 'effectLayer', 'damageTextLayer', 'textures', 'frames', 'groundBaseTextures',
      'generatedFloorBase',
      'friendlyProjectilePool', 'hostileProjectilePool', 'pickupPool', 'heroAura', 'heroShadow', 'hero',
      'bossShadow', 'bossContact', 'bossIntent', 'bossDangerZone', 'boss', 'heroMarker', 'heroSlash', 'titleHero',
    ]) this[key] = null
    this.bossCastPill?.remove()
    this.bossCastPill = null
    this.enemyPool = []
    this.enemyDeathPool = []
    this.enemyDeathCursor = 0
    this.effectPool = []
    this.weaponFieldPool = []
    this.weaponFieldVisualPlan = []
    this.weaponFieldClusterMarks = null
    this.propPool = []
    this.poiPool = []
    this.mapDecalPool = []
    this.mapDecalTextures = []
    this.mapPropDiagnostics = mapPropPoolDiagnostic(0, MAX_ACTIVE_MAP_PROPS)
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
