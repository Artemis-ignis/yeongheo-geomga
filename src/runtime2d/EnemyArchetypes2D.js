/**
 * Renderer-independent combat and readability contracts for the PixiJS runtime.
 *
 * Authored enemy rows remain the source of truth. Archetype defaults only fill
 * missing values, while the scaling API applies run-time difficulty without
 * mutating either the catalogue row or this module's shared metadata.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

function nonNegative(value, fallback) {
  return Math.max(0, finite(value, fallback))
}

function positive(value, fallback) {
  return Math.max(0.001, finite(value, fallback))
}

export const ENEMY_ARCHETYPE_IDS_2D = Object.freeze([
  'grunt',
  'charger',
  'ranged',
  'tank',
  'elite',
  'boss',
])

export const ENEMY_ARCHETYPES_2D = deepFreeze({
  grunt: {
    id: 'grunt', label: '일반', threat: 1,
    stats: { hp: 32, damage: 5, speed: 3.0, radius: 0.55, xp: 4, attackCooldown: 0.72 },
    behavior: { tags: ['pursue', 'contact', 'swarm'], preferredRange: 0, telegraphSeconds: 0.12 },
    visual: {
      silhouette: 'compact', runtimeHeight: [58, 78], accent: 0x9c7bd8,
      marker: 'none', healthBar: 'none', priority: 1, animationBias: 'walk',
    },
    scaling: { timeHpWeight: 1, timeDamageWeight: 1, rewardWeight: 1 },
  },
  charger: {
    id: 'charger', label: '돌진', threat: 2,
    stats: { hp: 44, damage: 8, speed: 4.2, radius: 0.55, xp: 6, attackCooldown: 2.9 },
    behavior: {
      tags: ['pursue', 'windup', 'dash', 'recovery'], preferredRange: 7,
      telegraphSeconds: 0.5, burstSpeedMultiplier: 2.15,
    },
    visual: {
      silhouette: 'forward-leaning', runtimeHeight: [62, 86], accent: 0xffb55e,
      marker: 'lane', healthBar: 'none', priority: 2, animationBias: 'lunge',
    },
    scaling: { timeHpWeight: 0.92, timeDamageWeight: 1, rewardWeight: 1 },
  },
  ranged: {
    id: 'ranged', label: '원거리', threat: 2,
    stats: { hp: 64, damage: 7, speed: 2.2, radius: 0.6, xp: 8, attackCooldown: 2.3 },
    behavior: {
      tags: ['kite', 'projectile', 'keep-distance', 'cast'], preferredRange: 10,
      telegraphSeconds: 0.42, projectileSpeed: 9,
    },
    visual: {
      silhouette: 'tall-caster', runtimeHeight: [70, 94], accent: 0xff7c96,
      marker: 'cast-ring', healthBar: 'none', priority: 3, animationBias: 'cast',
    },
    scaling: { timeHpWeight: 0.86, timeDamageWeight: 1, rewardWeight: 1 },
  },
  tank: {
    id: 'tank', label: '탱커', threat: 3,
    stats: { hp: 300, damage: 11, speed: 1.5, radius: 1.0, xp: 16, attackCooldown: 0.92 },
    behavior: {
      tags: ['pursue', 'contact', 'unstoppable', 'body-block'], preferredRange: 0,
      telegraphSeconds: 0.3, knockbackResistance: 0.75,
    },
    visual: {
      silhouette: 'wide-heavy', runtimeHeight: [92, 128], accent: 0xa89982,
      marker: 'heavy-shadow', healthBar: 'damaged', priority: 4, animationBias: 'stomp',
    },
    scaling: { timeHpWeight: 1.12, timeDamageWeight: 0.94, rewardWeight: 1 },
  },
  elite: {
    id: 'elite', label: '정예', threat: 5,
    stats: { hp: 420, damage: 14, speed: 2.8, radius: 1.05, xp: 30, attackCooldown: 0.78 },
    behavior: {
      tags: ['pursue', 'special', 'resistant', 'priority-target'], preferredRange: 4,
      telegraphSeconds: 0.5, knockbackResistance: 0.7,
    },
    visual: {
      silhouette: 'ornate-large', runtimeHeight: [118, 168], accent: 0xf2c76f,
      marker: 'elite-ring', healthBar: 'always', priority: 6, animationBias: 'command',
    },
    scaling: { timeHpWeight: 0.82, timeDamageWeight: 0.9, rewardWeight: 1 },
  },
  boss: {
    id: 'boss', label: '보스', threat: 10,
    stats: { hp: 8000, damage: 32, speed: 2.6, radius: 2.4, xp: 120, attackCooldown: 2.2 },
    behavior: {
      tags: ['phase', 'cast', 'area-denial', 'projectile', 'unstoppable'], preferredRange: 5,
      telegraphSeconds: 0.72, phaseThresholds: [0.66, 0.33],
    },
    visual: {
      silhouette: 'screen-anchor', runtimeHeight: [176, 220], accent: 0xe969a1,
      marker: 'boss-intent', healthBar: 'boss', priority: 10, animationBias: 'phase',
    },
    // Boss catalogue HP is encounter-authored. Difficulty changes it, elapsed
    // time does not, preventing a late spawn from being scaled twice.
    scaling: { timeHpWeight: 0, timeDamageWeight: 0, rewardWeight: 1 },
  },
})

export const ENEMY_DIFFICULTY_PRESETS_2D = deepFreeze({
  story: { hp: 0.72, damage: 0.68, spawn: 0.82, reward: 0.9 },
  normal: { hp: 1, damage: 1, spawn: 1, reward: 1 },
  hard: { hp: 1.25, damage: 1.15, spawn: 1.1, reward: 1.08 },
  nightmare: { hp: 1.55, damage: 1.35, spawn: 1.22, reward: 1.2 },
})

export const ENEMY_RUN_SCALING_2D = deepFreeze({
  hpLinearPerMinute: 0.28,
  hpQuadraticPeriodMinutes: 6,
  damageLinearPerMinute: 0.06,
})

export function getEnemyArchetype2D(id) {
  return ENEMY_ARCHETYPES_2D[id] ?? null
}

/** Map an authored catalogue row to one of the six runtime contracts. */
export function classifyEnemyArchetype2D(definition = {}) {
  if (definition.archetype && ENEMY_ARCHETYPES_2D[definition.archetype]) return definition.archetype
  if (definition.isBoss || definition.role === 'boss'
    || (finite(definition.hp, 0) >= 5000 && finite(definition.radius, 0) >= 1.8)) return 'boss'
  if (definition.elite) return 'elite'
  if (definition.behavior === 'ranged') return 'ranged'
  if (definition.behavior === 'lumberer') return 'tank'
  if (['charger', 'dasher', 'skirmisher', 'flicker'].includes(definition.behavior)) return 'charger'
  return 'grunt'
}

/**
 * Return independent encounter multipliers. `speed` intentionally stays at 1:
 * scaling pursuit speed removes kiting rather than creating fair difficulty.
 */
export function getEnemyDifficultyScaling2D({
  difficulty = 'normal', elapsedSeconds = 0, archetype = 'grunt', threat = 1,
} = {}) {
  const preset = ENEMY_DIFFICULTY_PRESETS_2D[difficulty]
  if (!preset) throw new RangeError(`Unknown enemy difficulty: ${difficulty}`)
  const profile = getEnemyArchetype2D(archetype)
  if (!profile) throw new RangeError(`Unknown enemy archetype: ${archetype}`)
  const minutes = nonNegative(elapsedSeconds, 0) / 60
  const threatScale = Math.max(0.5, finite(threat, 1))
  const hpTime = 1 + profile.scaling.timeHpWeight * (
    minutes * ENEMY_RUN_SCALING_2D.hpLinearPerMinute
    + (minutes / ENEMY_RUN_SCALING_2D.hpQuadraticPeriodMinutes) ** 2
  )
  const damageTime = 1 + profile.scaling.timeDamageWeight
    * minutes * ENEMY_RUN_SCALING_2D.damageLinearPerMinute
  return Object.freeze({
    hp: preset.hp * hpTime * (0.9 + threatScale * 0.1),
    damage: preset.damage * damageTime * (0.94 + threatScale * 0.06),
    speed: 1,
    spawn: preset.spawn,
    reward: preset.reward * profile.scaling.rewardWeight,
  })
}

/** Build the immutable row that EnemyField2D can copy into its typed arrays. */
export function buildEnemyRuntimeProfile2D(definition = {}, options = {}) {
  const archetypeId = options.archetype ?? classifyEnemyArchetype2D(definition)
  const archetype = getEnemyArchetype2D(archetypeId)
  if (!archetype) throw new RangeError(`Unknown enemy archetype: ${archetypeId}`)
  const base = {
    hp: positive(definition.hp, archetype.stats.hp),
    damage: nonNegative(definition.damage, archetype.stats.damage),
    speed: nonNegative(definition.speed, archetype.stats.speed),
    radius: positive(definition.radius, archetype.stats.radius),
    xp: nonNegative(definition.xp, archetype.stats.xp),
    attackCooldown: positive(
      definition.shootInterval ?? definition.dashInterval ?? definition.chargeInterval,
      archetype.stats.attackCooldown,
    ),
  }
  const scale = getEnemyDifficultyScaling2D({
    difficulty: options.difficulty,
    elapsedSeconds: options.elapsedSeconds,
    archetype: archetypeId,
    threat: options.threat,
  })
  const color = Number.isInteger(definition.color) ? definition.color : archetype.visual.accent
  return deepFreeze({
    id: definition.id ?? archetypeId,
    name: definition.name ?? archetype.label,
    archetypeId,
    threat: archetype.threat,
    stats: {
      hp: base.hp * scale.hp,
      damage: base.damage * scale.damage,
      speed: base.speed * scale.speed,
      radius: base.radius,
      xp: Math.ceil(base.xp * scale.reward),
      attackCooldown: base.attackCooldown,
    },
    behavior: { ...archetype.behavior, sourceBehavior: definition.behavior ?? archetypeId },
    visual: {
      ...archetype.visual,
      accent: color,
      authoredScale: positive(definition.scale, 1),
    },
    scaling: scale,
  })
}
