const base = import.meta.env?.BASE_URL ?? './'

export const SPRITE_MANIFEST_VERSION = 4

const pending = Object.freeze({ visualApproval: 'pending', productionReady: false })

export const SPRITE_MANIFEST = Object.freeze({
  version: SPRITE_MANIFEST_VERSION,
  maxAtlasSize: 4096,
  actors: Object.freeze({
    seolryeong: Object.freeze({
      url: `${base}assets/sprites2d/seolryeong-heroine-southeast-motion-v2.webp`,
      portraitUrl: `${base}assets/sprites2d/seolryeong-combat-v1.webp`,
      // Five runtime directions share one identity and one 16-frame contract:
      // eight grounded run poses followed by eight sword-attack poses.
      // Approval remains pending until original-size play review is complete.
      directionalRuntime: Object.freeze({
        east: Object.freeze({
          url: `${base}assets/sprites2d/seolryeong-heroine-east-motion-v2.webp`,
          status: 'runtime-candidate',
        }),
        north: Object.freeze({
          url: `${base}assets/sprites2d/seolryeong-heroine-north-motion-v3.webp`,
          status: 'runtime-candidate',
        }),
        northeast: Object.freeze({
          url: `${base}assets/sprites2d/seolryeong-heroine-northeast-motion-v2.webp`,
          status: 'runtime-candidate',
        }),
        south: Object.freeze({
          url: `${base}assets/sprites2d/seolryeong-heroine-south-motion-v3.webp`,
          status: 'runtime-candidate',
        }),
      }),
      reactionRuntime: Object.freeze({
        east: Object.freeze({ url: `${base}assets/sprites2d/seolryeong-heroine-east-reaction-v1.webp`, status: 'runtime-candidate' }),
        southeast: Object.freeze({ url: `${base}assets/sprites2d/seolryeong-heroine-southeast-reaction-v1.webp`, status: 'runtime-candidate' }),
        north: Object.freeze({ url: `${base}assets/sprites2d/seolryeong-heroine-north-reaction-v1.webp`, status: 'runtime-candidate' }),
        northeast: Object.freeze({ url: `${base}assets/sprites2d/seolryeong-heroine-northeast-reaction-v1.webp`, status: 'runtime-candidate' }),
        south: Object.freeze({ url: `${base}assets/sprites2d/seolryeong-heroine-south-reaction-v1.webp`, status: 'runtime-candidate' }),
      }),
      cell: [384, 256], sheet: [4, 4], pivot: [0.5, 242 / 256], runtimeHeight: 140,
      reactionCell: [384, 256], reactionSheet: [4, 2], reactionPivot: [0.5, 244 / 256],
      directions: ['s', 'se', 'e', 'ne', 'n'], mirrorWest: true,
      animations: Object.freeze({
        idle: [0],
        run: [0, 1, 2, 3, 4, 5, 6, 7],
        attack: [8, 9, 10, 11, 12, 13, 14, 15],
        dash: [2, 3, 4, 5],
      }),
      reactionAnimations: Object.freeze({
        idle: [0, 1], hurt: [2, 3], death: [4, 5, 6, 7],
      }),
      animationMode: 'authored-frames', ...pending,
    }),
    yorang: Object.freeze({
      url: `${base}assets/sprites2d/yorang-motion-v2.webp`,
      directionalRuntime: Object.freeze({
        north: Object.freeze({
          url: `${base}assets/sprites2d/yorang-north-motion-v5.webp`,
          status: 'runtime-candidate',
        }),
        south: Object.freeze({
          url: `${base}assets/sprites2d/yorang-south-motion-v4.webp`,
          status: 'runtime-candidate',
        }),
      }),
      reactionRuntime: Object.freeze({
        default: Object.freeze({
          url: `${base}assets/sprites2d/yorang-reaction-v1.webp`,
          status: 'runtime-candidate',
        }),
        north: Object.freeze({
          url: `${base}assets/sprites2d/yorang-north-reaction-v1.webp`,
          status: 'runtime-candidate',
        }),
        south: Object.freeze({
          url: `${base}assets/sprites2d/yorang-south-reaction-v1.webp`,
          status: 'runtime-candidate',
        }),
      }),
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.86], runtimeHeight: 92,
      reactionCell: [256, 256], reactionSheet: [4, 2], reactionPivot: [0.5, 232 / 256],
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      reactionAnimations: Object.freeze({ hurt: [0, 1], death: [2, 3, 4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    jadeRidgeHound: Object.freeze({
      url: `${base}assets/sprites2d/jade-ridge-hound-motion-v1.webp`,
      directionalRuntime: Object.freeze({
        north: Object.freeze({ url: `${base}assets/sprites2d/jade-ridge-hound-north-motion-v2.webp`, status: 'runtime-candidate' }),
        south: Object.freeze({ url: `${base}assets/sprites2d/jade-ridge-hound-south-motion-v2.webp`, status: 'runtime-candidate' }),
      }),
      reactionRuntime: Object.freeze({
        default: Object.freeze({ url: `${base}assets/sprites2d/jade-ridge-hound-reaction-v1.webp`, status: 'runtime-candidate' }),
        north: Object.freeze({ url: `${base}assets/sprites2d/jade-ridge-hound-north-reaction-v1.webp`, status: 'runtime-candidate' }),
        south: Object.freeze({ url: `${base}assets/sprites2d/jade-ridge-hound-south-reaction-v1.webp`, status: 'runtime-candidate' }),
      }),
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.86], runtimeHeight: 92,
      reactionCell: [256, 256], reactionSheet: [4, 2], reactionPivot: [0.5, 232 / 256],
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      reactionAnimations: Object.freeze({ hurt: [0, 1], death: [2, 3, 4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    wisp: Object.freeze({
      url: `${base}assets/sprites2d/magi-remnant-motion-v2.webp`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.9], runtimeHeight: 80,
      directions: ['s'], mirrorWest: false,
      animations: Object.freeze({ hover: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames-with-procedural-sway', ...pending,
    }),
    jadeSerpent: Object.freeze({
      url: `${base}assets/sprites2d/jade-serpent-motion-v1.webp`,
      directionalRuntime: Object.freeze({
        north: Object.freeze({ url: `${base}assets/sprites2d/jade-serpent-north-motion-v2.webp`, status: 'runtime-candidate' }),
        south: Object.freeze({ url: `${base}assets/sprites2d/jade-serpent-south-motion-v2.webp`, status: 'runtime-candidate' }),
      }),
      reactionRuntime: Object.freeze({
        default: Object.freeze({ url: `${base}assets/sprites2d/jade-serpent-reaction-v1.webp`, status: 'runtime-candidate' }),
        north: Object.freeze({ url: `${base}assets/sprites2d/jade-serpent-north-reaction-v1.webp`, status: 'runtime-candidate' }),
        south: Object.freeze({ url: `${base}assets/sprites2d/jade-serpent-south-reaction-v1.webp`, status: 'runtime-candidate' }),
      }),
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.91], runtimeHeight: 82,
      reactionCell: [256, 256], reactionSheet: [4, 2], reactionPivot: [0.5, 232 / 256],
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      reactionAnimations: Object.freeze({ hurt: [0, 1], death: [2, 3, 4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    jadeStoneGhoul: Object.freeze({
      url: `${base}assets/sprites2d/jade-stone-ghoul-motion-v1.webp`,
      directionalRuntime: Object.freeze({
        north: Object.freeze({ url: `${base}assets/sprites2d/jade-stone-ghoul-north-motion-v2.webp`, status: 'runtime-candidate' }),
        south: Object.freeze({ url: `${base}assets/sprites2d/jade-stone-ghoul-south-motion-v2.webp`, status: 'runtime-candidate' }),
      }),
      reactionRuntime: Object.freeze({
        default: Object.freeze({ url: `${base}assets/sprites2d/jade-stone-ghoul-reaction-v1.webp`, status: 'runtime-candidate' }),
        north: Object.freeze({ url: `${base}assets/sprites2d/jade-stone-ghoul-north-reaction-v1.webp`, status: 'runtime-candidate' }),
        south: Object.freeze({ url: `${base}assets/sprites2d/jade-stone-ghoul-south-reaction-v1.webp`, status: 'runtime-candidate' }),
      }),
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.91], runtimeHeight: 104,
      reactionCell: [256, 256], reactionSheet: [4, 2], reactionPivot: [0.5, 232 / 256],
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      reactionAnimations: Object.freeze({ hurt: [0, 1], death: [2, 3, 4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    jadeShardGuardian: Object.freeze({
      url: `${base}assets/sprites2d/jade-shard-guardian-motion-v1.webp`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.88], runtimeHeight: 104,
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    bloodScorpion: Object.freeze({
      url: `${base}assets/sprites2d/blood-scorpion-motion-v1.webp`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.91], runtimeHeight: 72,
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    talismanRevenant: Object.freeze({
      url: `${base}assets/sprites2d/talisman-revenant-motion-v1.webp`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.88], runtimeHeight: 86,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ hover: [0, 1, 2, 3], cast: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    maskedSealRevenant: Object.freeze({
      url: `${base}assets/sprites2d/masked-seal-revenant-motion-v1.webp`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.87], runtimeHeight: 88,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ hover: [0, 1, 2, 3], cast: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    voidSentinel: Object.freeze({
      url: `${base}assets/sprites2d/void-sentinel-motion-v2.webp`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.88], runtimeHeight: 118,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    shadowSealDuelist: Object.freeze({
      url: `${base}assets/sprites2d/shadow-seal-duelist-motion-v1.webp`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.89], runtimeHeight: 116,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    jadeVoidWarden: Object.freeze({
      url: `${base}assets/sprites2d/jade-void-warden-motion-v2.webp`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.92], runtimeHeight: 220,
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ idle: [0, 1, 2, 3], cast: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
  }),
  environment: Object.freeze({
    jadeSanctuaryProps: Object.freeze({
      url: `${base}assets/sprites2d/jade-sanctuary-props-v1.webp`,
      cell: [256, 256], sheet: [4, 2], count: 8,
      ...pending,
    }),
  }),
})

export function validateSpriteManifest(manifest = SPRITE_MANIFEST) {
  const errors = []
  if (manifest.version !== SPRITE_MANIFEST_VERSION) errors.push('unsupported manifest version')
  if (manifest.maxAtlasSize > 4096) errors.push('atlas exceeds 4096px')
  for (const [id, actor] of Object.entries(manifest.actors ?? {})) {
    if (!actor.url) errors.push(`${id}: missing url`)
    if (!Array.isArray(actor.pivot) || actor.pivot.length !== 2) errors.push(`${id}: invalid pivot`)
    else if (actor.pivot.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) errors.push(`${id}: pivot out of bounds`)
    if (!Number.isFinite(actor.runtimeHeight) || actor.runtimeHeight <= 0) errors.push(`${id}: invalid runtimeHeight`)
    if (!Array.isArray(actor.directions) || actor.directions.length === 0) errors.push(`${id}: no directions`)
    const columns = actor.sheet?.[0]
    const rows = actor.sheet?.[1]
    const frameCount = columns * rows
    if (!Number.isInteger(columns) || !Number.isInteger(rows) || frameCount <= 0) errors.push(`${id}: invalid sheet`)
    for (const [name, frames] of Object.entries(actor.animations ?? {})) {
      if (!Array.isArray(frames) || frames.length === 0) {
        errors.push(`${id}.${name}: empty animation`)
        continue
      }
      if (new Set(frames).size !== frames.length) errors.push(`${id}.${name}: duplicate frames`)
      if (frames.some((frame) => !Number.isInteger(frame) || frame < 0 || frame >= frameCount)) {
        errors.push(`${id}.${name}: frame out of range`)
      }
    }
    if (actor.reactionRuntime) {
      const reactionColumns = actor.reactionSheet?.[0]
      const reactionRows = actor.reactionSheet?.[1]
      const reactionFrameCount = reactionColumns * reactionRows
      if (!Number.isInteger(reactionColumns) || !Number.isInteger(reactionRows) || reactionFrameCount <= 0) {
        errors.push(`${id}: invalid reaction sheet`)
      }
      if (!Array.isArray(actor.reactionCell) || actor.reactionCell.length !== 2) {
        errors.push(`${id}: invalid reaction cell`)
      }
      if (!Array.isArray(actor.reactionPivot) || actor.reactionPivot.length !== 2) {
        errors.push(`${id}: invalid reaction pivot`)
      }
      const requiredReactionDirections = id === 'seolryeong' || actor.role === 'hero'
        ? ['east', 'southeast', 'north', 'northeast', 'south']
        : ['default', ...Object.keys(actor.directionalRuntime ?? {})]
      for (const direction of requiredReactionDirections) {
        if (!actor.reactionRuntime?.[direction]?.url) errors.push(`${id}: missing ${direction} reaction runtime`)
      }
      for (const [name, frames] of Object.entries(actor.reactionAnimations ?? {})) {
        if (!Array.isArray(frames) || frames.length === 0) {
          errors.push(`${id}.reaction.${name}: empty animation`)
          continue
        }
        if (new Set(frames).size !== frames.length) errors.push(`${id}.reaction.${name}: duplicate frames`)
        if (frames.some((frame) => !Number.isInteger(frame) || frame < 0 || frame >= reactionFrameCount)) {
          errors.push(`${id}.reaction.${name}: frame out of range`)
        }
      }
    }
    if (actor.productionReady === true && actor.visualApproval !== 'approved') {
      errors.push(`${id}: productionReady requires visual approval`)
    }
  }
  return errors
}
