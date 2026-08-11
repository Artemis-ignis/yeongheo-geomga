const base = import.meta.env?.BASE_URL ?? './'

export const SPRITE_MANIFEST_VERSION = 2

const pending = Object.freeze({ visualApproval: 'pending', productionReady: false })

export const SPRITE_MANIFEST = Object.freeze({
  version: SPRITE_MANIFEST_VERSION,
  maxAtlasSize: 4096,
  actors: Object.freeze({
    seolryeong: Object.freeze({
      url: `${base}assets/sprites2d/seolryeong-heroine-motion-v4.png`,
      portraitUrl: `${base}assets/sprites2d/seolryeong-combat-v1.png`,
      // Five runtime directions share the same 4x2 authored animation contract.
      // Approval remains pending until original-size play review is complete.
      directionalRuntime: Object.freeze({
        east: Object.freeze({
          url: `${base}assets/sprites2d/seolryeong-heroine-east-motion-v1.png`,
          status: 'runtime-candidate',
        }),
        north: Object.freeze({
          url: `${base}assets/sprites2d/seolryeong-heroine-north-motion-v1.png`,
          status: 'runtime-candidate',
        }),
        northeast: Object.freeze({
          url: `${base}assets/sprites2d/seolryeong-heroine-northeast-motion-v1.png`,
          status: 'runtime-candidate',
        }),
        south: Object.freeze({
          url: `${base}assets/sprites2d/seolryeong-heroine-south-motion-v1.png`,
          status: 'runtime-candidate',
        }),
      }),
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.94], runtimeHeight: 140,
      directions: ['s', 'se', 'e', 'ne', 'n'], mirrorWest: true,
      animations: Object.freeze({ idle: [0], run: [0, 1, 2, 3], attack: [4, 5, 6, 7], dash: [2, 3] }),
      animationMode: 'authored-frames', ...pending,
    }),
    yorang: Object.freeze({
      url: `${base}assets/sprites2d/yorang-motion-v2.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.86], runtimeHeight: 92,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    jadeRidgeHound: Object.freeze({
      url: `${base}assets/sprites2d/jade-ridge-hound-motion-v1.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.86], runtimeHeight: 92,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    wisp: Object.freeze({
      url: `${base}assets/sprites2d/magi-remnant-motion-v2.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.9], runtimeHeight: 80,
      directions: ['s'], mirrorWest: false,
      animations: Object.freeze({ hover: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames-with-procedural-sway', ...pending,
    }),
    jadeSerpent: Object.freeze({
      url: `${base}assets/sprites2d/jade-serpent-motion-v1.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.91], runtimeHeight: 82,
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    jadeStoneGhoul: Object.freeze({
      url: `${base}assets/sprites2d/jade-stone-ghoul-motion-v1.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.91], runtimeHeight: 104,
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    jadeShardGuardian: Object.freeze({
      url: `${base}assets/sprites2d/jade-shard-guardian-motion-v1.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.88], runtimeHeight: 104,
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    bloodScorpion: Object.freeze({
      url: `${base}assets/sprites2d/blood-scorpion-motion-v1.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.91], runtimeHeight: 72,
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    talismanRevenant: Object.freeze({
      url: `${base}assets/sprites2d/talisman-revenant-motion-v1.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.88], runtimeHeight: 86,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ hover: [0, 1, 2, 3], cast: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    maskedSealRevenant: Object.freeze({
      url: `${base}assets/sprites2d/masked-seal-revenant-motion-v1.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.87], runtimeHeight: 88,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ hover: [0, 1, 2, 3], cast: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    voidSentinel: Object.freeze({
      url: `${base}assets/sprites2d/void-sentinel-motion-v2.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.88], runtimeHeight: 118,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    shadowSealDuelist: Object.freeze({
      url: `${base}assets/sprites2d/shadow-seal-duelist-motion-v1.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.89], runtimeHeight: 116,
      directions: ['sw'], mirrorWest: true,
      animations: Object.freeze({ walk: [0, 1, 2, 3], attack: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
    jadeVoidWarden: Object.freeze({
      url: `${base}assets/sprites2d/jade-void-warden-motion-v2.png`,
      cell: [256, 256], sheet: [4, 2], pivot: [0.5, 0.92], runtimeHeight: 220,
      directions: ['se'], mirrorWest: true,
      animations: Object.freeze({ idle: [0, 1, 2, 3], cast: [4, 5, 6, 7] }),
      animationMode: 'authored-frames', ...pending,
    }),
  }),
  environment: Object.freeze({
    jadeSanctuaryProps: Object.freeze({
      url: `${base}assets/sprites2d/jade-sanctuary-props-v1.png`,
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
    if (actor.productionReady === true && actor.visualApproval !== 'approved') {
      errors.push(`${id}: productionReady requires visual approval`)
    }
  }
  return errors
}
