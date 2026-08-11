/**
 * Renderer-independent attack planner for the contest mirror boss.
 *
 * This module deliberately has no runtime or renderer imports.  A caller can
 * ask for the same plan again after a save/load, a replay seek, or a browser
 * resize and receive the same JSON-safe events.  The plan is descriptive:
 * the 2D presentation decides how a line, zone, orbit, or volley is drawn.
 */

export const BOSS_PATTERN_VERSION_2D = 1
export const FINAL_MIRROR_BOSS_ID_2D = 'jadeVoidWarden'
// Release boss tells need enough time to be read on a fixed-tick screen.  The
// authored rows remain the source of truth; this floor only protects fallback
// and legacy metadata rows that were authored below the release contract.
export const MIN_TELEGRAPH_SECONDS_2D = 0.8

const TAU = Math.PI * 2
const MAX_EVENT_COUNT = 16
const MAX_TIME = 1_000_000_000
const MAX_TELEGRAPH_SECONDS = 4
const MAX_ACTIVE_SECONDS = 3
const MAX_DAMAGE_MULTIPLIER = 8

/** Freeze nested plain data without changing the caller's input. */
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

function finiteNonNegative(value, fallback = 0) {
  return Math.max(0, Math.min(MAX_TIME, finite(value, fallback)))
}

function finitePositive(value, fallback = 1) {
  return Math.max(0.001, finite(value, fallback))
}

function clamp(value, minimum, maximum, fallback = minimum) {
  const number = finite(value, fallback)
  return Math.max(minimum, Math.min(maximum, number))
}

function integer(value, fallback = 0) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  return Math.max(minimum, Math.min(maximum, integer(value, fallback)))
}

function roundTime(value) {
  // Keeping times on microsecond boundaries makes JSON snapshots stable even
  // when a caller supplies a value produced by a different frame rate.
  return Math.round(finiteNonNegative(value) * 1_000_000) / 1_000_000
}

function normalizeAngle(value) {
  const angle = finite(value, 0)
  return ((angle % TAU) + TAU) % TAU
}

function roundNumber(value, places = 6) {
  const scale = 10 ** places
  return Math.round(finite(value, 0) * scale) / scale
}

function stableString(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value == null) return ''
  try {
    return JSON.stringify(value, Object.keys(value).sort())
  } catch {
    return ''
  }
}

/** A small non-cryptographic hash; unlike Math.random it is replay-friendly. */
function hashString(value) {
  let hash = 0x811c9dc5
  const text = stableString(value)
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function hashValues(...values) {
  let hash = 0x9e3779b9
  for (const value of values) {
    const part = typeof value === 'number'
      ? (Number.isFinite(value) ? Math.trunc(value) : 0)
      : hashString(value)
    hash ^= part >>> 0
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0
    hash = (hash + 0xc2b2ae35) >>> 0
  }
  hash ^= hash >>> 16
  return Math.imul(hash, 0x27d4eb2d) >>> 0
}

function unitHash(...values) {
  return hashValues(...values) / 0x1_0000_0000
}

function normalizeSeed(value) {
  if (Number.isFinite(value)) return Math.trunc(value) >>> 0
  if (typeof value === 'bigint') return Number(value & 0xffff_ffffn) >>> 0
  if (typeof value === 'string' || typeof value === 'boolean') return hashString(value)
  return hashString(stableString(value))
}

const VOW_ALIASES = Object.freeze({
  sword: 'sword',
  swords: 'sword',
  swordline: 'sword',
  swordcone: 'sword',
  jian: 'sword',
  jianmai: 'sword',
  geommaek: 'sword',
  geommaekdo: 'sword',
  검: 'sword',
  검맥: 'sword',
  geommaek: 'sword',
  frost: 'frost',
  snow: 'frost',
  ice: 'frost',
  frostline: 'frost',
  seolmaek: 'frost',
  seolmaekdo: 'frost',
  설: 'frost',
  설맥: 'frost',
  spirit: 'spirit',
  shadow: 'spirit',
  heart: 'spirit',
  spiritclone: 'spirit',
  simmaek: 'spirit',
  simmaekdo: 'spirit',
  심: 'spirit',
  심맥: 'spirit',
})

function keyOf(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeVowId(value) {
  const key = keyOf(value)
  return VOW_ALIASES[key] ?? null
}

const PHASE_ALIASES = Object.freeze({
  '1': 1,
  basic: 1,
  base: 1,
  opening: 1,
  first: 1,
  기본: 1,
  '2': 2,
  deepening: 2,
  advanced: 2,
  middle: 2,
  second: 2,
  심화: 2,
  '3': 3,
  complete: 3,
  completion: 3,
  final: 3,
  last: 3,
  third: 3,
  완성: 3,
})

function normalizePhase(value) {
  if (typeof value === 'string' && PHASE_ALIASES[keyOf(value)]) return PHASE_ALIASES[keyOf(value)]
  if (Number.isFinite(value)) return clampInteger(value, 1, 3, 1)
  return 1
}

const PATTERN_ALIASES = Object.freeze({
  swordline: 'swordLine',
  'sword-line': 'swordLine',
  line: 'swordLine',
  swordcone: 'swordCone',
  'sword-cone': 'swordCone',
  cone: 'swordCone',
  swordring: 'swordRing',
  'sword-ring': 'swordRing',
  ring: 'swordRing',
  frostzone: 'frostZone',
  'frost-zone': 'frostZone',
  zone: 'frostZone',
  frostlane: 'frostLane',
  'frost-lane': 'frostLane',
  frostmine: 'frostMine',
  'frost-mine': 'frostMine',
  spiritorbit: 'spiritOrbit',
  'spirit-orbit': 'spiritOrbit',
  orbit: 'spiritOrbit',
  spiritclone: 'spiritClone',
  'spirit-clone': 'spiritClone',
  spiritburst: 'spiritBurst',
  'spirit-burst': 'spiritBurst',
  radial: 'radialVolley',
  radialvolley: 'radialVolley',
  'radial-volley': 'radialVolley',
  fallback: 'radialVolley',

  // Dao mirror branches are authored by DaoVows2D rather than by the base
  // catalogue.  Keep their ids stable in the replay contract even though
  // their geometry is resolved below from the selected branch.
  'returning-sword-line': 'returning-sword-line',
  'piercing-sword-cross': 'piercing-sword-cross',
  'chain-frost-mines': 'chain-frost-mines',
  'returning-sword-ring': 'returning-sword-ring',
  'piercing-sword-ring': 'piercing-sword-ring',
  'chain-frost-mines-shards': 'chain-frost-mines-shards',
  'cutting-ice-line': 'cutting-ice-line',
  'chain-frost-wall-shards': 'chain-frost-wall-shards',
  'cutting-ice-wall-line': 'cutting-ice-wall-line',
  'tracking-shadow-double': 'tracking-shadow-double',
  'tracking-shadow-double-purge': 'tracking-shadow-double-purge',
  'tracking-shadow-double-echo': 'tracking-shadow-double-echo',
  'shadow-summon-overcharge': 'shadow-summon-overcharge',
  'shadow-summon-overcharge-purge': 'shadow-summon-overcharge-purge',
  'shadow-summon-overcharge-echo': 'shadow-summon-overcharge-echo',
})

function normalizePatternId(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  return PATTERN_ALIASES[raw.toLowerCase()] ?? null
}

const PALETTE_BY_VOW = Object.freeze({
  sword: 'mirrorSword',
  frost: 'mirrorFrost',
  spirit: 'mirrorSpirit',
  fallback: 'mirrorFallback',
})

const PATTERN_ROWS = {
  swordLine: {
    patternId: 'swordLine', vowId: 'sword', phase: 1,
    paletteKey: PALETTE_BY_VOW.sword, geometryType: 'line',
    telegraphDuration: 0.82, activeDuration: 0.24, recoveryDuration: 0.48,
    damageMultiplier: 0.95, avoidable: true,
    geometry: { length: 13, width: 1.05 },
  },
  swordCone: {
    patternId: 'swordCone', vowId: 'sword', phase: 2,
    paletteKey: PALETTE_BY_VOW.sword, geometryType: 'cone',
    telegraphDuration: 0.88, activeDuration: 0.26, recoveryDuration: 0.5,
    damageMultiplier: 1.12, avoidable: true,
    geometry: { length: 11.5, arcRadians: 0.76, innerRadius: 0.7 },
  },
  swordRing: {
    patternId: 'swordRing', vowId: 'sword', phase: 3,
    paletteKey: PALETTE_BY_VOW.sword, geometryType: 'radial',
    telegraphDuration: 0.94, activeDuration: 0.3, recoveryDuration: 0.58,
    damageMultiplier: 1.26, avoidable: true,
    geometry: { radius: 7.3, projectileCount: 8, projectileSpeed: 8.5 },
  },
  frostZone: {
    patternId: 'frostZone', vowId: 'frost', phase: 1,
    paletteKey: PALETTE_BY_VOW.frost, geometryType: 'zone',
    telegraphDuration: 0.8, activeDuration: 0.72, recoveryDuration: 0.46,
    damageMultiplier: 0.84, avoidable: true,
    geometry: { shape: 'circle', radius: 2.15, lingerSeconds: 1.1 },
  },
  frostLane: {
    patternId: 'frostLane', vowId: 'frost', phase: 2,
    paletteKey: PALETTE_BY_VOW.frost, geometryType: 'zone',
    telegraphDuration: 0.86, activeDuration: 0.68, recoveryDuration: 0.52,
    damageMultiplier: 1.02, avoidable: true,
    geometry: { shape: 'lane', length: 11.5, width: 1.6, lingerSeconds: 0.9 },
  },
  frostMine: {
    patternId: 'frostMine', vowId: 'frost', phase: 3,
    paletteKey: PALETTE_BY_VOW.frost, geometryType: 'zone',
    telegraphDuration: 0.92, activeDuration: 0.7, recoveryDuration: 0.56,
    damageMultiplier: 1.18, avoidable: true,
    geometry: { shape: 'cluster', radius: 1.45, count: 3, lingerSeconds: 1.2 },
  },
  spiritOrbit: {
    patternId: 'spiritOrbit', vowId: 'spirit', phase: 1,
    paletteKey: PALETTE_BY_VOW.spirit, geometryType: 'orbit',
    telegraphDuration: 0.78, activeDuration: 0.34, recoveryDuration: 0.44,
    damageMultiplier: 0.88, avoidable: true,
    geometry: { radius: 4.2, projectileCount: 4, projectileSpeed: 5.8, orbitTurns: 0.5 },
  },
  spiritClone: {
    patternId: 'spiritClone', vowId: 'spirit', phase: 2,
    paletteKey: PALETTE_BY_VOW.spirit, geometryType: 'orbit',
    telegraphDuration: 0.84, activeDuration: 0.38, recoveryDuration: 0.5,
    damageMultiplier: 1.04, avoidable: true,
    geometry: { radius: 5.3, projectileCount: 5, cloneCount: 1, projectileSpeed: 6.4, orbitTurns: 0.75 },
  },
  spiritBurst: {
    patternId: 'spiritBurst', vowId: 'spirit', phase: 3,
    paletteKey: PALETTE_BY_VOW.spirit, geometryType: 'orbit',
    telegraphDuration: 0.92, activeDuration: 0.4, recoveryDuration: 0.58,
    damageMultiplier: 1.22, avoidable: true,
    geometry: { radius: 5.9, projectileCount: 7, cloneCount: 2, projectileSpeed: 7.1, orbitTurns: 1 },
  },
  radialVolley: {
    patternId: 'radialVolley', vowId: 'fallback', phase: 1,
    paletteKey: PALETTE_BY_VOW.fallback, geometryType: 'radial',
    telegraphDuration: 0.72, activeDuration: 0.22, recoveryDuration: 0.42,
    damageMultiplier: 0.62, avoidable: true,
    geometry: { radius: 6.6, projectileCount: 6, projectileSpeed: 6.2 },
  },
}

/**
 * DaoVows2D owns the narrative mirror ids, while this planner owns the
 * renderer-neutral geometry.  These rows bridge the two without mutating the
 * authored metadata.  Completion rows intentionally retain the selected
 * deepening branch, so phase three is not silently the same fight for both
 * choices of a vow.
 */
const DAO_MIRROR_BRANCH_ROWS_2D = deepFreeze({
  sword: {
    'returning-edge': {
      2: {
        patternId: 'returning-sword-line', vowId: 'sword', phase: 2,
        choiceId: 'returning-edge', intent: 'returning-edge',
        paletteKey: 'mirrorSwordReturn', color: 0x9dcfff,
        geometryType: 'line', geometry: { length: 14.6, width: 0.92 },
        telegraphDuration: 0.9, activeDuration: 0.3, recoveryDuration: 0.54,
        damageMultiplier: 1.16, avoidable: true,
      },
      3: {
        patternId: 'returning-sword-ring', vowId: 'sword', phase: 3,
        choiceId: 'returning-edge', intent: 'returning-completion',
        paletteKey: 'mirrorSwordReturn', color: 0x9dcfff,
        geometryType: 'radial', geometry: { radius: 7.8, projectileCount: 10, projectileSpeed: 8.8 },
        telegraphDuration: 0.98, activeDuration: 0.34, recoveryDuration: 0.62,
        damageMultiplier: 1.31, avoidable: true,
      },
    },
    'piercing-edge': {
      2: {
        patternId: 'piercing-sword-cross', vowId: 'sword', phase: 2,
        choiceId: 'piercing-edge', intent: 'piercing-edge',
        paletteKey: 'mirrorSwordPierce', color: 0x8fbaf4,
        geometryType: 'cone', geometry: { length: 13.1, arcRadians: 1.12, innerRadius: 0.45 },
        telegraphDuration: 0.92, activeDuration: 0.28, recoveryDuration: 0.52,
        damageMultiplier: 1.2, avoidable: true,
      },
      3: {
        patternId: 'piercing-sword-ring', vowId: 'sword', phase: 3,
        choiceId: 'piercing-edge', intent: 'piercing-completion',
        paletteKey: 'mirrorSwordPierce', color: 0x8fbaf4,
        geometryType: 'radial', geometry: { radius: 8.8, projectileCount: 12, projectileSpeed: 9.4 },
        telegraphDuration: 1.02, activeDuration: 0.32, recoveryDuration: 0.6,
        damageMultiplier: 1.36, avoidable: true,
      },
    },
  },
  frost: {
    'frost-shards': {
      2: {
        patternId: 'chain-frost-mines-shards', vowId: 'frost', phase: 2,
        choiceId: 'frost-shards', intent: 'shard-chain',
        paletteKey: 'mirrorFrostShards', color: 0x8bdfff,
        geometryType: 'zone', geometry: { shape: 'cluster', radius: 1.25, count: 4, lingerSeconds: 1.35 },
        telegraphDuration: 0.9, activeDuration: 0.76, recoveryDuration: 0.56,
        damageMultiplier: 1.08, avoidable: true,
      },
      3: {
        patternId: 'chain-frost-wall-shards', vowId: 'frost', phase: 3,
        choiceId: 'frost-shards', intent: 'shard-chain-completion',
        paletteKey: 'mirrorFrostShards', color: 0x8bdfff,
        geometryType: 'zone', geometry: { shape: 'wall', radius: 1.6, width: 2.05, length: 12.5, count: 5, lingerSeconds: 1.4 },
        telegraphDuration: 0.99, activeDuration: 0.82, recoveryDuration: 0.62,
        damageMultiplier: 1.24, avoidable: true,
      },
    },
    'frost-line': {
      2: {
        patternId: 'cutting-ice-line', vowId: 'frost', phase: 2,
        choiceId: 'frost-line', intent: 'cutting-line',
        paletteKey: 'mirrorFrostLine', color: 0x97e8ff,
        geometryType: 'zone', geometry: { shape: 'lane', length: 14.2, width: 1.2, radius: 1.05, lingerSeconds: 1.02 },
        telegraphDuration: 0.92, activeDuration: 0.72, recoveryDuration: 0.58,
        damageMultiplier: 1.08, avoidable: true,
      },
      3: {
        patternId: 'cutting-ice-wall-line', vowId: 'frost', phase: 3,
        choiceId: 'frost-line', intent: 'cutting-wall-completion',
        paletteKey: 'mirrorFrostLine', color: 0x97e8ff,
        geometryType: 'zone', geometry: { shape: 'wall', length: 16, width: 2.65, radius: 1.2, count: 2, lingerSeconds: 1.08 },
        telegraphDuration: 1.01, activeDuration: 0.78, recoveryDuration: 0.64,
        damageMultiplier: 1.3, avoidable: true,
      },
    },
  },
  spirit: {
    'purifying-heart': {
      2: {
        patternId: 'tracking-shadow-double-purge', vowId: 'spirit', phase: 2,
        choiceId: 'purifying-heart', intent: 'tracking-shadow-purge',
        paletteKey: 'mirrorSpiritPurge', color: 0xa67aff,
        geometryType: 'orbit', geometry: { radius: 5.2, projectileCount: 5, cloneCount: 1, projectileSpeed: 6.7, orbitTurns: 0.8 },
        telegraphDuration: 0.88, activeDuration: 0.42, recoveryDuration: 0.54,
        damageMultiplier: 1.1, avoidable: true,
      },
      3: {
        patternId: 'shadow-summon-overcharge-purge', vowId: 'spirit', phase: 3,
        choiceId: 'purifying-heart', intent: 'purifying-overcharge',
        paletteKey: 'mirrorSpiritPurge', color: 0xa67aff,
        geometryType: 'orbit', geometry: { radius: 6.5, projectileCount: 9, cloneCount: 3, projectileSpeed: 7.5, orbitTurns: 1.2 },
        telegraphDuration: 1, activeDuration: 0.46, recoveryDuration: 0.64,
        damageMultiplier: 1.3, avoidable: true,
      },
    },
    'echoing-heart': {
      2: {
        patternId: 'tracking-shadow-double-echo', vowId: 'spirit', phase: 2,
        choiceId: 'echoing-heart', intent: 'tracking-shadow-echo',
        paletteKey: 'mirrorSpiritEcho', color: 0xb887ff,
        geometryType: 'radial', geometry: { radius: 5.1, projectileCount: 6, projectileSpeed: 6.5 },
        telegraphDuration: 0.9, activeDuration: 0.36, recoveryDuration: 0.52,
        damageMultiplier: 1.08, avoidable: true,
      },
      3: {
        patternId: 'shadow-summon-overcharge-echo', vowId: 'spirit', phase: 3,
        choiceId: 'echoing-heart', intent: 'echo-overcharge',
        paletteKey: 'mirrorSpiritEcho', color: 0xffcb70,
        geometryType: 'radial', geometry: { radius: 8.2, projectileCount: 11, projectileSpeed: 8.1 },
        telegraphDuration: 1.04, activeDuration: 0.42, recoveryDuration: 0.6,
        damageMultiplier: 1.28, avoidable: true,
      },
    },
  },
})

const DEFAULT_PATTERN_ROWS = deepFreeze(PATTERN_ROWS)

const PHASE_PATTERN_IDS = deepFreeze({
  sword: ['swordLine', 'swordCone', 'swordRing'],
  frost: ['frostZone', 'frostLane', 'frostMine'],
  spirit: ['spiritOrbit', 'spiritClone', 'spiritBurst'],
  fallback: ['radialVolley', 'radialVolley', 'radialVolley'],
})

/**
 * Stable public metadata.  `phases` is intentionally an array so UI and QA
 * code can display the same basic/deepening/complete order as the planner.
 */
export const MIRROR_PATTERN_METADATA_2D = deepFreeze({
  bossId: FINAL_MIRROR_BOSS_ID_2D,
  vows: {
    sword: {
      vowId: 'sword', paletteKey: PALETTE_BY_VOW.sword,
      phases: PHASE_PATTERN_IDS.sword.map((id) => DEFAULT_PATTERN_ROWS[id]),
    },
    frost: {
      vowId: 'frost', paletteKey: PALETTE_BY_VOW.frost,
      phases: PHASE_PATTERN_IDS.frost.map((id) => DEFAULT_PATTERN_ROWS[id]),
    },
    spirit: {
      vowId: 'spirit', paletteKey: PALETTE_BY_VOW.spirit,
      phases: PHASE_PATTERN_IDS.spirit.map((id) => DEFAULT_PATTERN_ROWS[id]),
    },
    fallback: {
      vowId: 'fallback', paletteKey: PALETTE_BY_VOW.fallback,
      phases: PHASE_PATTERN_IDS.fallback.map((id) => DEFAULT_PATTERN_ROWS[id]),
    },
  },
})

// Descriptive aliases make the contract easy to discover without coupling a
// future caller to one spelling of "mirror pattern metadata".
export const BOSS_MIRROR_PATTERNS_2D = MIRROR_PATTERN_METADATA_2D
export const BOSS_PATTERN_METADATA_2D = MIRROR_PATTERN_METADATA_2D
export const MIRROR_VOW_IDS_2D = Object.freeze(['sword', 'frost', 'spirit'])
export const BOSS_PATTERN_PHASE_SEQUENCES_2D = PHASE_PATTERN_IDS

function readProperty(value, ...names) {
  if (!value || typeof value !== 'object') return null
  for (const name of names) {
    try {
      if (value[name] !== undefined && value[name] !== null) return value[name]
    } catch {
      // A malformed getter should behave like unknown metadata and select the
      // safe fallback instead of escaping into the combat loop.
    }
  }
  return null
}

function patternFromValue(value) {
  if (typeof value === 'string') return normalizePatternId(value)
  if (!value || typeof value !== 'object') return null
  return normalizePatternId(readProperty(value, 'patternId', 'pattern', 'id', 'type', 'kind'))
}

function phaseValue(value, phase) {
  if (Array.isArray(value)) return value[phase - 1] ?? value[value.length - 1] ?? null
  if (!value || typeof value !== 'object') return value ?? null
  const aliases = [String(phase), phase === 1 ? 'basic' : phase === 2 ? 'deepening' : 'complete', phase === 1 ? 'base' : phase === 2 ? 'advanced' : 'final']
  for (const alias of aliases) {
    if (value[alias] !== undefined) return value[alias]
  }
  return null
}

function patternRowsFromMetadata(metadata, phase) {
  if (!metadata || typeof metadata !== 'object') return null
  const phases = readProperty(metadata, 'phases', 'patterns', 'sequence', 'mirrorPatterns')
  const phaseEntry = phaseValue(phases, phase)
  if (phaseEntry !== null) return phaseEntry
  const direct = readProperty(metadata, 'patternId', 'pattern', 'id', 'type', 'kind')
  if (direct !== null) return metadata
  return null
}

function metadataForVow(metadata, vowId) {
  if (!metadata || typeof metadata !== 'object') return metadata
  const byVow = readProperty(metadata, 'vows', 'patternsByVow', 'mirrorVows')
  if (!byVow || typeof byVow !== 'object') return metadata
  const direct = byVow[vowId]
  if (direct && typeof direct === 'object') return direct
  for (const [alias, canonical] of Object.entries(VOW_ALIASES)) {
    if (canonical === vowId && byVow[alias] && typeof byVow[alias] === 'object') return byVow[alias]
  }
  return null
}

function metadataChoiceForPhase(metadata, phase, phaseEntry = null) {
  const entryChoice = readProperty(phaseEntry, 'choiceId', 'choice', 'branch', 'optionId')
  if (entryChoice != null) return keyOf(entryChoice)
  const choices = readProperty(metadata, 'choices', 'selectedChoices', 'selections')
  if (choices && typeof choices === 'object') {
    const aliases = phase === 1
      ? ['pledge', 'basic', '1']
      : phase === 2 ? ['deepening', 'advanced', '2'] : ['completion', 'complete', 'final', '3']
    const choice = readProperty(choices, ...aliases)
    if (choice != null) return keyOf(choice)
  }
  return null
}

/**
 * Resolve a Dao branch before the generic pattern catalogue.  The phase 3
 * completion option is authored as one option per vow, so its branch identity
 * is inherited from the selected phase 2 option by design.
 */
function daoMirrorBranchDescriptor(vowId, phase, metadata, phaseEntry = null) {
  const branches = DAO_MIRROR_BRANCH_ROWS_2D[vowId]
  if (!branches || !metadata || typeof metadata !== 'object') return null
  const phases = readProperty(metadata, 'phases', 'sequence', 'patternSequence', 'patterns')
  const phaseTwoEntry = phaseValue(phases, 2)
  const currentChoice = metadataChoiceForPhase(metadata, phase, phaseEntry)
  const phaseTwoChoice = metadataChoiceForPhase(metadata, 2, phaseTwoEntry)
  const choice = phase === 3 ? phaseTwoChoice ?? currentChoice : currentChoice ?? phaseTwoChoice
  if (!choice) return null
  return branches[choice]?.[phase] ?? null
}

function inferVowFromPattern(patternId) {
  if (typeof patternId !== 'string') return 'fallback'
  if (patternId === 'swordLine' || patternId === 'swordCone' || patternId === 'swordRing'
    || patternId.includes('sword')) return 'sword'
  if (patternId === 'frostZone' || patternId === 'frostLane' || patternId === 'frostMine'
    || patternId.includes('frost') || patternId.includes('ice')) return 'frost'
  if (patternId === 'spiritOrbit' || patternId === 'spiritClone' || patternId === 'spiritBurst'
    || patternId.includes('shadow') || patternId.includes('spirit')) return 'spirit'
  return 'fallback'
}

function metadataVow(value) {
  return normalizeVowId(readProperty(value, 'vowId', 'vow', 'mirrorVow', 'mirrorVowId', 'dao'))
}

function selectVow({ phase, vowId, vowIds, metadata, mirrorPattern }) {
  const direct = normalizeVowId(vowId)
  if (direct) return { vowId: direct, sourceVowId: typeof vowId === 'string' ? vowId : direct }

  if (Array.isArray(vowIds) && vowIds.length) {
    const selected = vowIds[phase - 1] ?? vowIds[vowIds.length - 1]
    const normalized = normalizeVowId(selected)
    if (normalized) return { vowId: normalized, sourceVowId: typeof selected === 'string' ? selected : normalized }
  }

  if (metadata && typeof metadata === 'object') {
    const metadataDirect = metadataVow(metadata)
    if (metadataDirect) return { vowId: metadataDirect, sourceVowId: metadataDirect }
  }

  const pattern = patternFromValue(mirrorPattern)
  if (pattern) return { vowId: inferVowFromPattern(pattern), sourceVowId: inferVowFromPattern(pattern) }
  if (typeof mirrorPattern === 'string') {
    const normalized = normalizeVowId(mirrorPattern)
    if (normalized) return { vowId: normalized, sourceVowId: mirrorPattern }
  }
  return { vowId: 'sword', sourceVowId: 'sword' }
}

function descriptorFor(vowId, phase) {
  const ids = PHASE_PATTERN_IDS[vowId] ?? PHASE_PATTERN_IDS.fallback
  return DEFAULT_PATTERN_ROWS[ids[phase - 1] ?? ids[ids.length - 1]] ?? DEFAULT_PATTERN_ROWS.radialVolley
}

function metadataPatternLabel(value) {
  const raw = readProperty(value, 'patternId', 'pattern', 'id')
  return typeof raw === 'string' && raw.trim().length <= 96 ? raw.trim() : null
}

function descriptorCandidate({ phase, vowId, metadata, mirrorPattern }) {
  const patternCandidate = patternRowsFromMetadata(metadata, phase)
    ?? patternRowsFromMetadata(mirrorPattern, phase)
    ?? patternFromValue(mirrorPattern)
  const candidatePatternId = patternFromValue(patternCandidate)
  const fallback = descriptorFor(vowId, phase)
  const daoBranch = daoMirrorBranchDescriptor(vowId, phase, metadata, patternCandidate)
  const mirrorPatternId = metadataPatternLabel(patternCandidate)
  if (daoBranch) {
    const authoredColor = readProperty(patternCandidate, 'color', 'paletteColor')
    const authoredIntent = readProperty(patternCandidate, 'intent', 'purpose')
    const branchWithMetadata = {
      ...daoBranch,
      ...(Number.isFinite(authoredColor) ? { color: clampInteger(authoredColor, 0, 0xffffff, daoBranch.color) } : {}),
      ...(typeof authoredIntent === 'string' && authoredIntent.trim() ? { intent: authoredIntent.trim() } : {}),
    }
    return {
      ...fallback,
      ...(patternCandidate && typeof patternCandidate === 'object' ? patternCandidate : {}),
      ...branchWithMetadata,
      patternId: branchWithMetadata.patternId,
      mirrorPatternId: mirrorPatternId ?? branchWithMetadata.patternId,
      source: 'metadata',
    }
  }
  if (candidatePatternId && DEFAULT_PATTERN_ROWS[candidatePatternId]) {
    if (patternCandidate && typeof patternCandidate === 'object') {
      return {
        ...DEFAULT_PATTERN_ROWS[candidatePatternId],
        ...patternCandidate,
        patternId: candidatePatternId,
        mirrorPatternId: mirrorPatternId ?? candidatePatternId,
        source: 'metadata',
      }
    }
    return { ...DEFAULT_PATTERN_ROWS[candidatePatternId], mirrorPatternId: mirrorPatternId ?? candidatePatternId, source: 'metadata' }
  }
  if (patternCandidate && typeof patternCandidate === 'object') {
    const type = normalizePatternId(readProperty(patternCandidate, 'patternId', 'pattern', 'type', 'kind'))
    const base = (type && DEFAULT_PATTERN_ROWS[type]) || fallback
    return {
      ...base,
      ...patternCandidate,
      patternId: type || base.patternId,
      mirrorPatternId: mirrorPatternId ?? candidatePatternId ?? base.patternId,
      source: 'metadata',
    }
  }
  return { ...fallback, source: 'catalogue' }
}

function geometryTypeFrom(value, fallback) {
  const normalized = keyOf(value)
  if (normalized === 'line' || normalized === 'swordline') return 'line'
  if (normalized === 'cone' || normalized === 'swordcone') return 'cone'
  if (normalized === 'zone' || normalized === 'ground' || normalized === 'groundzone') return 'zone'
  if (normalized === 'orbit' || normalized === 'clone' || normalized === 'orbitshots') return 'orbit'
  if (normalized === 'radial' || normalized === 'volley' || normalized === 'radialvolley') return 'radial'
  return fallback
}

function safePalette(value, fallback) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim()
  return normalized && normalized.length <= 64 ? normalized : fallback
}

function safeText(value, fallback = null, limit = 240) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim()
  return normalized && normalized.length <= limit ? normalized : fallback
}

function sanitizeDescriptor(raw, vowId, phase) {
  const fallback = descriptorFor(vowId, phase)
  const patternId = normalizePatternId(raw.patternId) ?? fallback.patternId
  const geometryType = geometryTypeFrom(
    readProperty(raw, 'geometryType', 'geometry', 'shape', 'kind', 'type'),
    fallback.geometryType,
  )
  const geometrySource = raw.geometry && typeof raw.geometry === 'object' ? raw.geometry : raw
  const telegraphDuration = clamp(
    readProperty(raw, 'telegraphDuration', 'telegraphSeconds', 'telegraph'),
    MIN_TELEGRAPH_SECONDS_2D,
    MAX_TELEGRAPH_SECONDS,
    Math.max(MIN_TELEGRAPH_SECONDS_2D, fallback.telegraphDuration),
  )
  const activeDuration = clamp(
    readProperty(raw, 'activeDuration', 'duration', 'dangerSeconds'),
    0.05,
    MAX_ACTIVE_SECONDS,
    fallback.activeDuration,
  )
  const recoveryDuration = clamp(
    readProperty(raw, 'recoveryDuration', 'recoverySeconds', 'cooldown'),
    0.2,
    8,
    fallback.recoveryDuration,
  )
  const damageMultiplier = clamp(
    readProperty(raw, 'damageMultiplier', 'damage', 'multiplier'),
    0,
    MAX_DAMAGE_MULTIPLIER,
    fallback.damageMultiplier,
  )
  const avoidableValue = readProperty(raw, 'avoidable')
  const unavoidableValue = readProperty(raw, 'unavoidable')
  const avoidable = typeof avoidableValue === 'boolean'
    ? avoidableValue
    : typeof unavoidableValue === 'boolean' ? !unavoidableValue : fallback.avoidable
  const paletteKey = safePalette(readProperty(raw, 'paletteKey', 'palette', 'paletteId'), fallback.paletteKey)
  const geometry = geometrySource && typeof geometrySource === 'object' ? geometrySource : fallback.geometry
  const mirrorPatternId = safeText(readProperty(raw, 'mirrorPatternId', 'authoredPatternId', 'sourcePatternId'))
    ?? metadataPatternLabel(raw)
  const choiceId = safeText(readProperty(raw, 'choiceId', 'choice', 'branch', 'optionId'))
  const intent = safeText(readProperty(raw, 'intent', 'purpose', 'meaning'))
  const telegraphHint = safeText(readProperty(raw, 'telegraphHint', 'telegraphText', 'telegraph'))
  const safeSpace = safeText(readProperty(raw, 'safeSpace', 'safeZone', 'safe'))
  const impact = safeText(readProperty(raw, 'impact', 'impactText', 'effect'))
  const vfx = safeText(readProperty(raw, 'vfx', 'vfxKey', 'visual'))
  const colorValue = readProperty(raw, 'color', 'colorHex', 'paletteColor')
  return {
    patternId,
    vowId: normalizeVowId(readProperty(raw, 'vowId', 'vow')) ?? inferVowFromPattern(patternId),
    phase,
    paletteKey,
    geometryType,
    telegraphDuration,
    activeDuration,
    recoveryDuration,
    damageMultiplier,
    avoidable,
    geometry,
    mirrorPatternId,
    choiceId,
    intent: intent ?? patternId,
    telegraphHint,
    safeSpace,
    impact,
    vfx,
    paletteColor: Number.isFinite(colorValue) ? clampInteger(colorValue, 0, 0xffffff, 0) : null,
    source: raw.source ?? 'metadata',
  }
}

function point(x, z) {
  return { x: roundNumber(x), z: roundNumber(z) }
}

function buildGeometry(descriptor, seed, phase, cycle, index) {
  const geometry = descriptor.geometry && typeof descriptor.geometry === 'object'
    ? descriptor.geometry : descriptor
  const orientation = normalizeAngle(unitHash(seed, descriptor.patternId, phase, cycle, index) * TAU)
  const direction = point(Math.cos(orientation), Math.sin(orientation))
  const common = {
    type: descriptor.geometryType,
    kind: descriptor.geometryType,
    anchor: 'player',
    space: 'relative',
    angle: roundNumber(orientation),
    direction,
  }

  if (descriptor.geometryType === 'line') {
    return {
      ...common,
      shape: 'line',
      origin: point(0, 0),
      length: clamp(readProperty(geometry, 'length', 'range'), 1, 64, 13),
      width: clamp(readProperty(geometry, 'width', 'radius'), 0.1, 12, 1.05),
    }
  }
  if (descriptor.geometryType === 'cone') {
    return {
      ...common,
      shape: 'cone',
      origin: point(0, 0),
      length: clamp(readProperty(geometry, 'length', 'range'), 1, 64, 11.5),
      arcRadians: clamp(readProperty(geometry, 'arcRadians', 'angleSpan', 'spread'), 0.1, TAU, 0.76),
      innerRadius: clamp(readProperty(geometry, 'innerRadius'), 0, 10, 0.7),
    }
  }
  if (descriptor.geometryType === 'zone') {
    const shape = typeof readProperty(geometry, 'shape') === 'string'
      ? readProperty(geometry, 'shape').trim().toLowerCase() : 'circle'
    const offsetDistance = clamp(readProperty(geometry, 'offsetDistance', 'distance'), 0, 12, 1.8)
    const count = clampInteger(readProperty(geometry, 'count', 'zoneCount'), 1, 8, shape === 'cluster' ? 3 : 1)
    return {
      ...common,
      type: 'zone',
      kind: 'zone',
      shape: ['circle', 'lane', 'cluster', 'wall'].includes(shape) ? shape : 'circle',
      center: point(direction.x * offsetDistance, direction.z * offsetDistance),
      radius: clamp(readProperty(geometry, 'radius'), 0.4, 24, 2.15),
      width: clamp(readProperty(geometry, 'width'), 0.2, 16, 1.6),
      length: clamp(readProperty(geometry, 'length'), 0.5, 64, 11.5),
      count,
      lingerSeconds: clamp(readProperty(geometry, 'lingerSeconds', 'linger'), 0, 8, 1),
    }
  }
  if (descriptor.geometryType === 'orbit') {
    const projectileCount = clampInteger(readProperty(geometry, 'projectileCount', 'shots', 'count'), 1, 24, 4)
    const radius = clamp(readProperty(geometry, 'radius'), 0.5, 32, 4.2)
    const orbitTurns = clamp(readProperty(geometry, 'orbitTurns', 'turns'), 0.1, 4, 0.5)
    const projectileSpeed = clamp(readProperty(geometry, 'projectileSpeed', 'speed'), 0.1, 32, 6)
    const shotAngles = []
    for (let shot = 0; shot < projectileCount; shot++) {
      shotAngles.push(roundNumber(normalizeAngle(orientation + TAU * shot / projectileCount)))
    }
    return {
      ...common,
      type: 'orbit',
      kind: 'orbit',
      center: point(0, 0),
      radius: roundNumber(radius),
      projectileCount,
      shotCount: projectileCount,
      projectileSpeed: roundNumber(projectileSpeed),
      orbitTurns: roundNumber(orbitTurns),
      cloneCount: clampInteger(readProperty(geometry, 'cloneCount', 'clones'), 0, 4, 0),
      shotAngles,
    }
  }

  const projectileCount = clampInteger(readProperty(geometry, 'projectileCount', 'shots', 'count'), 1, 32, 6)
  const radius = clamp(readProperty(geometry, 'radius'), 0.5, 32, 6.6)
  const projectileSpeed = clamp(readProperty(geometry, 'projectileSpeed', 'speed'), 0.1, 32, 6.2)
  return {
    ...common,
    type: 'radial',
    kind: 'radial',
    center: point(0, 0),
    radius: roundNumber(radius),
    projectileCount,
    projectileSpeed: roundNumber(projectileSpeed),
    angleStep: roundNumber(TAU / projectileCount),
    startAngle: roundNumber(orientation),
  }
}

function eventId(bossId, phase, descriptor, executeAt, index) {
  const timeKey = String(roundNumber(executeAt, 6))
  return `${bossId}:p${phase}:${descriptor.vowId}:${descriptor.patternId}:${index}:${hashString(timeKey).toString(16)}`
}

function normalizeOptions(input, legacyPhase, legacyTime, legacySeed, legacyMetadata) {
  if (typeof input === 'string') {
    return {
      bossId: input,
      phase: legacyPhase,
      time: legacyTime,
      seed: legacySeed,
      mirrorPattern: legacyMetadata,
    }
  }
  if (!input || typeof input !== 'object') return {}
  return input
}

function chooseMirrorMetadata(options) {
  return readProperty(options, 'mirrorPatternMetadata', 'metadata', 'mirror')
}

function eventCountFrom(options) {
  const requested = readProperty(options, 'eventCount', 'count', 'maxEvents')
  if (requested !== null) return clampInteger(requested, 1, MAX_EVENT_COUNT, 3)
  const horizon = readProperty(options, 'horizonSeconds', 'horizon')
  if (horizon !== null && Number.isFinite(horizon)) return clampInteger(Math.ceil(Math.max(0, horizon) / 2), 1, MAX_EVENT_COUNT, 3)
  return 3
}

function safeBossId(value) {
  return typeof value === 'string' && value.trim() === FINAL_MIRROR_BOSS_ID_2D
    ? FINAL_MIRROR_BOSS_ID_2D : FINAL_MIRROR_BOSS_ID_2D
}

function fallbackReason(options, metadata, candidate) {
  const requestedBoss = readProperty(options, 'bossId', 'boss')
  if (requestedBoss != null && requestedBoss !== FINAL_MIRROR_BOSS_ID_2D) return 'unknown-boss'
  if (metadata != null && candidate.source === 'catalogue' && !patternFromValue(metadata)) return 'invalid-mirror-metadata'
  return null
}

/** Return the immutable three-phase pattern id sequence for a vow. */
export function bossPatternSequence2D(vowId = 'sword', metadata = null) {
  const normalized = normalizeVowId(vowId) ?? 'fallback'
  const scopedMetadata = metadataForVow(metadata, normalized)
  const candidate = scopedMetadata && typeof scopedMetadata === 'object'
    ? readProperty(scopedMetadata, 'phases', 'patterns', 'sequence', 'mirrorPatterns') : null
  const sequence = []
  for (let phase = 1; phase <= 3; phase++) {
    const raw = phaseValue(candidate, phase)
    const branch = daoMirrorBranchDescriptor(normalized, phase, scopedMetadata, raw)
    const pattern = branch?.patternId
      ?? patternFromValue(raw)
      ?? PHASE_PATTERN_IDS[normalized][phase - 1]
    sequence.push(pattern && (DEFAULT_PATTERN_ROWS[pattern] || PATTERN_ALIASES[String(pattern).toLowerCase()])
      ? pattern : PHASE_PATTERN_IDS.fallback[phase - 1])
  }
  return Object.freeze(sequence)
}

export const getBossPatternSequence2D = bossPatternSequence2D

/**
 * Build a deterministic future cast window.  Invalid input never escapes a
 * renderer-facing exception: the planner falls back to a low-damage radial
 * volley with a readable telegraph.
 */
export function planBossPatterns2D(
  input = {}, legacyPhase = 1, legacyTime = 0, legacySeed = 0, legacyMetadata = null,
) {
  const options = normalizeOptions(input, legacyPhase, legacyTime, legacySeed, legacyMetadata)
  const rawPhase = readProperty(options, 'phase')
  const rawPhaseIndex = readProperty(options, 'phaseIndex')
  const requestedPhase = rawPhase !== null ? rawPhase : rawPhaseIndex === null ? null : finite(rawPhaseIndex, 0) + 1
  const phase = normalizePhase(requestedPhase)
  const time = roundTime(readProperty(options, 'time', 'runTime', 'elapsedSeconds', 'at', 'now'))
  const seed = normalizeSeed(readProperty(options, 'seed', 'showcaseSeed'))
  const metadata = chooseMirrorMetadata(options)
  const vowSelection = selectVow({
    phase,
    vowId: readProperty(options, 'vowId', 'mirrorVowId', 'mirrorVow'),
    vowIds: readProperty(options, 'vowIds', 'mirrorVows'),
    metadata,
    mirrorPattern: readProperty(options, 'mirrorPattern', 'pattern'),
  })
  const scopedMetadata = metadataForVow(metadata, vowSelection.vowId)
  const rawDescriptor = descriptorCandidate({
    phase,
    vowId: vowSelection.vowId,
    metadata: scopedMetadata,
    mirrorPattern: readProperty(options, 'mirrorPattern', 'pattern'),
  })
  const patternInput = readProperty(options, 'mirrorPattern', 'pattern')
  const requestedBoss = readProperty(options, 'bossId', 'boss')
  const unknownBoss = requestedBoss != null && requestedBoss !== FINAL_MIRROR_BOSS_ID_2D
  const explicitMetadata = metadata != null
  const objectPatternInput = patternInput && typeof patternInput === 'object'
  const badMetadata = (explicitMetadata && rawDescriptor.source !== 'metadata')
    || (objectPatternInput && rawDescriptor.source !== 'metadata')
  const forceFallback = unknownBoss || badMetadata
  const descriptor = forceFallback
    ? { ...DEFAULT_PATTERN_ROWS.radialVolley, source: 'fallback' }
    : sanitizeDescriptor(rawDescriptor, vowSelection.vowId, phase)
  const candidate = badMetadata ? { source: 'catalogue' } : rawDescriptor
  const reason = forceFallback
    ? (unknownBoss ? 'unknown-boss' : fallbackReason(options, metadata, candidate) ?? 'invalid-mirror-metadata')
    : fallbackReason(options, metadata, descriptor)
  const bossId = safeBossId(readProperty(options, 'bossId', 'boss'))
  const count = eventCountFrom(options)
  const cycle = Math.floor(time / 12)
  const events = []
  let cursor = time
  let lastUnavoidableEnd = time
  for (let index = 0; index < count; index++) {
    const eventDescriptor = sanitizeDescriptor(descriptor, descriptor.vowId || vowSelection.vowId, phase)
    // A fixed slot plus a bounded deterministic offset gives seeds a visible
    // difference while retaining a proof-friendly gap between hazards.
    const offset = index === 0 ? 0 : 0.06 + unitHash(seed, phase, cycle, index, 'slot') * 0.18
    const telegraphStart = Math.max(cursor, time + (index === 0 ? 0 : offset))
    const telegraphDuration = Math.max(MIN_TELEGRAPH_SECONDS_2D, eventDescriptor.telegraphDuration)
    let executeAt = telegraphStart + telegraphDuration
    if (!eventDescriptor.avoidable) executeAt = Math.max(executeAt, lastUnavoidableEnd)
    executeAt = roundTime(executeAt)
    const activeUntil = roundTime(executeAt + Math.max(0.05, eventDescriptor.activeDuration))
    const recoveryEnd = roundTime(activeUntil + Math.max(0.2, eventDescriptor.recoveryDuration))
    const unavoidable = !eventDescriptor.avoidable
    const geometry = buildGeometry(eventDescriptor, seed, phase, cycle, index)
    const event = {
      id: eventId(bossId, phase, eventDescriptor, executeAt, index),
      bossId,
      phase,
      phaseIndex: phase - 1,
      sequenceIndex: index,
      vowId: eventDescriptor.vowId,
      mirrorVowId: eventDescriptor.vowId,
      patternId: eventDescriptor.patternId,
      pattern: eventDescriptor.patternId,
      mirrorPatternId: eventDescriptor.mirrorPatternId,
      authoredPatternId: eventDescriptor.mirrorPatternId,
      patternType: geometry.type,
      paletteKey: eventDescriptor.paletteKey,
      palette: eventDescriptor.paletteKey,
      paletteColor: eventDescriptor.paletteColor,
      choiceId: eventDescriptor.choiceId,
      intent: eventDescriptor.intent,
      telegraphHint: eventDescriptor.telegraphHint,
      safeSpace: eventDescriptor.safeSpace,
      impact: eventDescriptor.impact,
      vfx: eventDescriptor.vfx,
      telegraphDuration: roundNumber(telegraphDuration),
      telegraphSeconds: roundNumber(telegraphDuration),
      telegraphStart: roundTime(telegraphStart),
      telegraphAt: roundTime(telegraphStart),
      startTime: roundTime(telegraphStart),
      executeAt,
      executeTime: executeAt,
      impactTime: executeAt,
      activeDuration: roundNumber(activeUntil - executeAt),
      activeUntil,
      dangerStart: executeAt,
      dangerEnd: activeUntil,
      recoveryUntil: recoveryEnd,
      avoidable: !unavoidable,
      unavoidable,
      damageMultiplier: roundNumber(clamp(eventDescriptor.damageMultiplier, 0, MAX_DAMAGE_MULTIPLIER, 0.62)),
      geometry,
      telegraph: {
        startAt: roundTime(telegraphStart),
        duration: roundNumber(telegraphDuration),
        executeAt,
      },
      hazardWindow: { start: executeAt, end: activeUntil },
      safeWindow: { start: activeUntil, end: recoveryEnd },
    }
    events.push(event)
    cursor = recoveryEnd
    if (unavoidable) lastUnavoidableEnd = activeUntil
  }

  const phaseSequence = bossPatternSequence2D(vowSelection.vowId, metadata)
  const fallback = reason !== null || descriptor.patternId === 'radialVolley' && vowSelection.vowId === 'fallback'
  const result = {
    version: BOSS_PATTERN_VERSION_2D,
    bossId,
    requestedBossId: typeof readProperty(options, 'bossId', 'boss') === 'string'
      ? readProperty(options, 'bossId', 'boss') : bossId,
    phase,
    phaseIndex: phase - 1,
    time,
    seed,
    vowId: vowSelection.vowId,
    mirrorVowId: vowSelection.vowId,
    sourceVowId: vowSelection.sourceVowId,
    phaseSequence,
    sequence: phaseSequence,
    fallback,
    fallbackReason: reason,
    minTelegraphSeconds: MIN_TELEGRAPH_SECONDS_2D,
    events,
    primaryEvent: events[0],
  }
  // The top-level aliases make the single-primary-event use case ergonomic,
  // while `events` remains the canonical replay format.
  if (events[0]) {
    result.patternId = events[0].patternId
    result.pattern = events[0].pattern
    result.mirrorPatternId = events[0].mirrorPatternId
    result.paletteKey = events[0].paletteKey
    result.paletteColor = events[0].paletteColor
    result.choiceId = events[0].choiceId
    result.intent = events[0].intent
    result.telegraphDuration = events[0].telegraphDuration
    result.executeAt = events[0].executeAt
    result.geometry = events[0].geometry
    result.damageMultiplier = events[0].damageMultiplier
  }
  return deepFreeze(result)
}

export const planBossPattern2D = planBossPatterns2D
export const planFinalBossPattern2D = planBossPatterns2D
export const buildBossPatternPlan2D = planBossPatterns2D

/** Return one event for consumers that tick one attack at a time. */
export function nextBossPatternEvent2D(input = {}, ...legacy) {
  const plan = planBossPatterns2D({
    ...(typeof input === 'object' && input ? input : { bossId: input }),
    eventCount: 1,
  }, ...legacy)
  return plan.primaryEvent
}

/** Structural validation for QA and safe integration boundaries. */
export function validateBossPatternPlan2D(plan) {
  const errors = []
  if (!plan || typeof plan !== 'object') errors.push('plan-not-object')
  if (!Array.isArray(plan?.events) || plan.events.length === 0) errors.push('events-empty')
  if (plan?.events) {
    let previousEnd = -Infinity
    for (const [index, event] of plan.events.entries()) {
      if (!event || typeof event !== 'object') {
        errors.push(`event-${index}-not-object`)
        continue
      }
      if (event.telegraphDuration < MIN_TELEGRAPH_SECONDS_2D) errors.push(`event-${index}-short-telegraph`)
      if (!(event.executeAt >= event.telegraphStart + event.telegraphDuration - 0.00001)) errors.push(`event-${index}-execute-before-telegraph`)
      if (!(event.dangerEnd >= event.dangerStart)) errors.push(`event-${index}-negative-danger-window`)
      if (event.dangerStart < previousEnd - 0.00001) errors.push(`event-${index}-overlapping-hazard`)
      if (!event.geometry || typeof event.geometry.type !== 'string') errors.push(`event-${index}-missing-geometry`)
      if (typeof event.paletteKey !== 'string') errors.push(`event-${index}-missing-palette`)
      if (!Number.isFinite(event.damageMultiplier) || event.damageMultiplier < 0) errors.push(`event-${index}-invalid-damage`)
      previousEnd = Math.max(previousEnd, event.dangerEnd)
    }
  }
  return deepFreeze({ ok: errors.length === 0, errors })
}

export function isBossPatternPlan2D(value) {
  return validateBossPatternPlan2D(value).ok
}
