/**
 * Allocation-light behavior contracts for the Pixi/Canvas 2D weapon roster.
 *
 * The renderer consumes these descriptions; it does not need to know about
 * Three.js weapon modules.  Each row is compiled once at module load and all
 * per-level values are kept as immutable plain data.  A simulation tick can
 * therefore reuse its own typed-array pools instead of allocating an object
 * for every projectile, status tick, or sound request.
 */

import { EVOLUTIONS, WEAPONS } from '../data/weapons.js'

export const WEAPON_BEHAVIOR_VERSION_2D = 1
export const WEAPON_BEHAVIOR_AXES_2D = Object.freeze([
  'trajectory', 'collision', 'residualField', 'status', 'audio',
])

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null
}

function positive(value, fallback = 1) {
  return Math.max(0.001, finite(value, fallback))
}

function nonNegative(value, fallback = 0) {
  return Math.max(0, finite(value, fallback))
}

function integer(value, fallback = 0) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback
}

function clamp(value, minimum, maximum, fallback = minimum) {
  const number = finite(value, fallback)
  return Math.max(minimum, Math.min(maximum, number))
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  return Math.max(minimum, Math.min(maximum, integer(value, fallback)))
}

function safeString(value, fallback = '') {
  return typeof value === 'string' && value.length <= 512 ? value : fallback
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const key of Object.keys(value)) out[key] = cloneData(value[key])
  return out
}

function round(value, places = 4) {
  const scale = 10 ** places
  return Math.round(finite(value, 0) * scale) / scale
}

function read(value, ...keys) {
  if (!value || typeof value !== 'object') return null
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null) return value[key]
  }
  return null
}

function hashString(value) {
  const text = typeof value === 'string' ? value : String(value ?? '')
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function normalizeSeed(value) {
  if (Number.isFinite(value)) return Math.trunc(value) >>> 0
  if (typeof value === 'bigint') return Number(value & 0xffff_ffffn) >>> 0
  return hashString(value)
}

function hashValues(...values) {
  let hash = 0x9e3779b9
  for (const value of values) {
    const part = typeof value === 'number' ? integer(value) : hashString(value)
    hash ^= part >>> 0
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0
  }
  return hash >>> 0
}

function cloneRows(rows) {
  return Array.isArray(rows) ? rows.map((row) => cloneData(row ?? {})) : []
}

function fieldValue(row, name, fallback = null) {
  return Object.prototype.hasOwnProperty.call(row, name) ? row[name] : fallback
}

function unionLevelFields(rows) {
  const fields = new Set()
  for (const row of rows) {
    for (const key of Object.keys(row)) fields.add(key)
  }
  return [...fields].sort()
}

function sourceFieldPaths(definition, rows) {
  const top = Object.keys(definition).sort()
  const levelFields = unionLevelFields(rows)
  const paths = []
  for (const key of top) {
    paths.push(key)
    if (key === 'levels') continue
  }
  for (const key of levelFields) paths.push(`levels.${key}`)
  return [...new Set(paths)]
}

function coverageFor(definition, rows) {
  const sourceFields = sourceFieldPaths(definition, rows)
  // `levelData` is copied into the descriptor, so even a field with no
  // special mechanic remains available to the production 2D consumer.
  const consumedFields = [...sourceFields]
  const fieldConsumers = {}
  for (const path of consumedFields) {
    fieldConsumers[path] = path.startsWith('levels.') ? 'levelData' : 'identity'
  }
  return {
    sourceFields,
    consumedFields,
    unconsumedFields: [],
    fieldConsumers,
    complete: true,
  }
}

/*
 * The shape vocabulary is authored separately from numeric level values.  A
 * spec never owns mutable state and only describes what a renderer should
 * allocate/reuse.  `implicit` effects are still explicit in the output; this
 * matters for pull, return, orbit, and persistent fields whose source table
 * has no dedicated numeric column.
 */
const SPECS = {
  flyingSword: {
    mode: 'homingProjectile', trajectoryKind: 'homing', collisionKind: 'piercing',
    audioKind: 'blade', implicit: {},
  },
  fireTalisman: {
    mode: 'lobbedBlast', trajectoryKind: 'lob', collisionKind: 'blast',
    audioKind: 'fire', effects: { burn: 'field' },
  },
  thunderOrb: {
    mode: 'orbitContact', trajectoryKind: 'orbit', collisionKind: 'contact',
    audioKind: 'thunder', effects: { orbit: 'field', knockback: 'field' },
  },
  frostPalm: {
    mode: 'frostCone', trajectoryKind: 'cone', collisionKind: 'area',
    audioKind: 'frost', effects: { slow: 'field', knockback: 'field' },
  },
  baguaArray: {
    mode: 'persistentArray', trajectoryKind: 'groundAnchor', collisionKind: 'areaTick',
    audioKind: 'array', field: { kind: 'array', persistent: true, lifetime: null },
  },
  vajra: {
    mode: 'piercingLine', trajectoryKind: 'line', collisionKind: 'infinitePierce',
    audioKind: 'metal', effects: { knockback: 'field' },
  },
  spiritButterfly: {
    mode: 'driftingHoming', trajectoryKind: 'driftHoming', collisionKind: 'piercing',
    audioKind: 'spirit', effects: { slow: 'implicit' },
  },
  venomMist: {
    mode: 'poisonField', trajectoryKind: 'groundAnchor', collisionKind: 'areaTick',
    audioKind: 'poison', field: { kind: 'poison', persistent: true, lifetime: 'duration' },
    effects: { burn: 'field' },
  },
  hiddenNeedles: {
    mode: 'spreadProjectile', trajectoryKind: 'spread', collisionKind: 'piercing',
    audioKind: 'needle', effects: { knockback: 'field' },
  },
  bellToll: {
    mode: 'radialPulse', trajectoryKind: 'radial', collisionKind: 'ring',
    audioKind: 'bell', effects: { knockback: 'field' },
  },
  windBlade: {
    mode: 'returningBlade', trajectoryKind: 'outAndBack', collisionKind: 'piercing',
    audioKind: 'wind', effects: { return: 'implicit', knockback: 'field' },
  },
  earthSpike: {
    mode: 'groundEruption', trajectoryKind: 'groundBurst', collisionKind: 'multiArea',
    audioKind: 'earth', effects: { knockback: 'field' },
  },
  voidOrb: {
    mode: 'pullingOrb', trajectoryKind: 'stationaryOrb', collisionKind: 'areaTick',
    audioKind: 'void', effects: { pull: 'implicit' },
  },
  skyThunder: {
    mode: 'delayedStrike', trajectoryKind: 'targetMarker', collisionKind: 'areaStrike',
    audioKind: 'thunderStrike', effects: { knockback: 'field' },
  },
  myriadSwords: {
    mode: 'returningSwordRain', trajectoryKind: 'radialReturn', collisionKind: 'piercing',
    audioKind: 'bladeRain', effects: { return: 'implicit', knockback: 'field' },
  },
  infernoSea: {
    mode: 'fireFieldBlast', trajectoryKind: 'lob', collisionKind: 'blast',
    audioKind: 'inferno', field: { kind: 'fire', persistent: true, lifetime: 'duration' },
    effects: { burn: 'field' },
  },
  violetThunder: {
    mode: 'chainingOrbit', trajectoryKind: 'orbit', collisionKind: 'chain',
    audioKind: 'chainThunder', effects: { orbit: 'field', chain: 'field', knockback: 'field' },
  },
  frozenSky: {
    mode: 'freezeShatterCone', trajectoryKind: 'cone', collisionKind: 'area',
    audioKind: 'freeze', effects: { slow: 'field', freeze: 'implicit', shatter: 'field', knockback: 'field' },
  },
  plagueTide: {
    mode: 'poisonSeaField', trajectoryKind: 'groundAnchor', collisionKind: 'areaTick',
    audioKind: 'plague', field: { kind: 'poison', persistent: true, lifetime: 'duration' },
    effects: { burn: 'field' },
  },
  needleStorm: {
    mode: 'needleRain', trajectoryKind: 'spread', collisionKind: 'piercing',
    audioKind: 'needleRain', effects: { knockback: 'field' },
  },
}

const DEFAULT_SPEC = {
  mode: 'projectile', trajectoryKind: 'direct', collisionKind: 'contact', audioKind: 'generic',
  effects: {},
}

function specFor(definition) {
  const authored = SPECS[definition.id]
  if (authored) return authored
  const text = `${definition.id ?? ''} ${definition.desc ?? ''}`.toLowerCase()
  const spec = { ...DEFAULT_SPEC, effects: {} }
  if (text.includes('orbit') || text.includes('주위')) spec.trajectoryKind = 'orbit'
  if (text.includes('return') || text.includes('되돌')) spec.trajectoryKind = 'outAndBack'
  if (text.includes('pull') || text.includes('빨아')) spec.effects.pull = 'implicit'
  if (text.includes('field') || text.includes('장판') || text.includes('무')) {
    spec.field = { kind: 'generic', persistent: true, lifetime: 'duration' }
  }
  return spec
}

function effectValue(row, field, implicit, fallback = 0) {
  if (field && Object.prototype.hasOwnProperty.call(row, field)) {
    return nonNegative(row[field], fallback)
  }
  return implicit ? fallback : 0
}

function effectRecord(row, name, source, options = {}) {
  const field = options.field ?? null
  const implicit = source === 'implicit'
  const enabled = source === 'field'
    ? Object.prototype.hasOwnProperty.call(row, field)
    : implicit
  let value = enabled ? effectValue(row, field, implicit, options.fallback ?? 1) : 0
  if (name === 'slow') value = clamp(value, 0, 1, 0)
  if (name === 'freeze') value = enabled ? 1 : 0
  if (name === 'return' || name === 'orbit' || name === 'pull') value = enabled ? 1 : 0
  return {
    enabled,
    value: round(value),
    amount: round(value),
    sourceField: enabled
      ? (source === 'field' ? `levels.${field}` : `implicit:${options.reason ?? name}`)
      : null,
    durationSeconds: fieldValue(row, 'duration', null) == null
      ? null : round(nonNegative(row.duration)),
  }
}

function effectTable(row, spec) {
  const effects = spec.effects ?? {}
  const authoredKnockback = Object.prototype.hasOwnProperty.call(row, 'knockback')
  const knockbackSource = effects.knockback ?? (authoredKnockback ? 'field' : null)
  const out = {
    burn: effectRecord(row, 'burn', effects.burn, { field: 'burn', fallback: 0, reason: 'burn' }),
    slow: effectRecord(row, 'slow', effects.slow, { field: 'slow', fallback: 0, reason: 'slow' }),
    freeze: effectRecord(row, 'freeze', effects.freeze, { fallback: 1, reason: 'freeze' }),
    shatter: effectRecord(row, 'shatter', effects.shatter, { field: 'shatter', fallback: 0, reason: 'shatter' }),
    chain: effectRecord(row, 'chain', effects.chain, { field: 'chain', fallback: 0, reason: 'chain' }),
    return: effectRecord(row, 'return', effects.return, { fallback: 1, reason: 'return' }),
    pull: effectRecord(row, 'pull', effects.pull, { fallback: 1, reason: 'pull' }),
    knockback: effectRecord(row, 'knockback', knockbackSource, { field: 'knockback', fallback: 0, reason: 'knockback' }),
    orbit: effectRecord(row, 'orbit', effects.orbit, { field: 'count', fallback: 1, reason: 'orbit' }),
  }
  if (out.pull.enabled && out.pull.value === 1) {
    out.pull.strength = round(Math.max(1, nonNegative(row.area, 1) * 3))
  } else {
    out.pull.strength = 0
  }
  out.knockback.strength = out.knockback.value
  out.chain.hops = out.chain.value
  out.shatter.damage = out.shatter.value
  return out
}

function buildResidualField(row, spec) {
  const field = spec.field
  if (!field) {
    return {
      enabled: false, kind: null, persistent: false, lifetimeSeconds: null,
      radiusScale: 0, tickSeconds: null, sourceField: null,
    }
  }
  const lifetime = field.lifetime === 'duration'
    ? finiteOrNull(row.duration)
    : field.lifetime
  return {
    enabled: true,
    kind: safeString(field.kind, 'generic'),
    persistent: Boolean(field.persistent),
    lifetimeSeconds: lifetime == null ? null : round(Math.max(0, lifetime)),
    radiusScale: round(clamp(row.area, 0.1, 12, 1)),
    tickSeconds: round(clamp(row.cooldown, 0.05, 10, 0.5)),
    sourceField: Number.isFinite(row.duration) ? 'levels.duration' : 'implicit:persistent-field',
  }
}

function buildTrajectory(row, spec, effects) {
  const count = clampInteger(row.amount ?? row.count, 1, 999, 1)
  const speed = finiteOrNull(row.speed)
  const duration = finiteOrNull(row.duration)
  const orbit = effects.orbit.enabled
  return {
    kind: safeString(spec.trajectoryKind, 'direct'),
    mode: safeString(spec.mode, 'projectile'),
    count,
    amount: finiteOrNull(row.amount),
    speed,
    areaScale: round(clamp(row.area, 0.1, 20, 1)),
    lifetimeSeconds: duration == null ? null : round(Math.max(0, duration)),
    cooldownSeconds: round(positive(row.cooldown, 1)),
    orbit,
    orbitCount: orbit ? count : 0,
    returning: effects.return.enabled,
    target: ['homing', 'driftHoming'].includes(spec.trajectoryKind) ? 'nearest' : 'direction-or-anchor',
    sourceFields: Object.freeze(['levels.amount', 'levels.count', 'levels.speed', 'levels.area', 'levels.duration', 'levels.cooldown']),
  }
}

function buildCollision(row, spec, effects, field) {
  return {
    kind: safeString(spec.collisionKind, 'contact'),
    damage: round(nonNegative(row.damage, 0)),
    radiusScale: round(clamp(row.area, 0.1, 20, 1)),
    pierce: finiteOrNull(row.pierce),
    contactCount: clampInteger(row.amount ?? row.count, 1, 999, 1),
    chainHops: effects.chain.hops,
    chainRange: finiteOrNull(row.chainRange),
    appliesArea: field.enabled || ['blast', 'area', 'areaTick', 'ring', 'multiArea', 'areaStrike'].includes(spec.collisionKind),
    knockback: effects.knockback.strength,
    sourceFields: Object.freeze(['levels.damage', 'levels.area', 'levels.pierce', 'levels.amount', 'levels.count', 'levels.chain', 'levels.chainRange', 'levels.knockback']),
  }
}

function buildAudio(definition, spec, field, effects) {
  const cueBase = `weapon.${safeString(definition.id, 'unknown')}`
  return {
    kind: safeString(spec.audioKind, 'generic'),
    launchCue: `${cueBase}.launch`,
    impactCue: `${cueBase}.impact`,
    statusCue: effects.freeze.enabled ? `${cueBase}.freeze` : effects.burn.enabled ? `${cueBase}.burn` : null,
    fieldCue: field.enabled ? `${cueBase}.field` : null,
    loop: Boolean(field.enabled || effects.orbit.enabled),
    tag: safeString(definition.tag, 'unknown'),
    sourceFields: Object.freeze(['id', 'tag', 'desc']),
  }
}

function identityAxes(trajectory, collision, field, effects, audio) {
  const axes = ['trajectory', 'collision']
  if (field.enabled) axes.push('residualField')
  if (Object.values(effects).some((effect) => effect.enabled)) axes.push('status')
  if (audio && audio.kind) axes.push('audio')
  return Object.freeze([...new Set(axes)])
}

function allocationContract(row, spec, field, effects) {
  const count = clampInteger(row.amount ?? row.count, 1, 999, 1)
  return {
    strategy: 'fixed-pool',
    storage: 'typed-array-friendly',
    reuse: true,
    dynamicAllocation: false,
    perTickAllocations: 0,
    maxProjectiles: count,
    maxFields: field.enabled ? 12 : 0,
    maxPendingStrikes: spec.trajectoryKind === 'targetMarker' ? count : 0,
    maxChainHops: effects.chain.hops,
    maxOrbitBodies: effects.orbit.enabled ? count : 0,
    maxStatusSlots: Object.values(effects).filter((effect) => effect.enabled).length,
    poolSize: Math.max(count, field.enabled ? 12 : 0),
    maxActive: Math.max(count, field.enabled ? 12 : 0),
    overflow: 'drop-oldest',
  }
}

function levelDescriptor(definition, row, level, maxLevel, spec, coverage) {
  const sourceRow = cloneData(row)
  const effects = effectTable(sourceRow, spec)
  const residualField = buildResidualField(sourceRow, spec)
  const trajectory = buildTrajectory(sourceRow, spec, effects)
  const collision = buildCollision(sourceRow, spec, effects, residualField)
  const audio = buildAudio(definition, spec, residualField, effects)
  const axes = identityAxes(trajectory, collision, residualField, effects, audio)
  return {
    version: WEAPON_BEHAVIOR_VERSION_2D,
    id: safeString(definition.id, 'unknown'),
    weaponId: safeString(definition.id, 'unknown'),
    name: safeString(definition.name, definition.id ?? '법보'),
    tag: safeString(definition.tag, 'unknown'),
    level,
    maxLevel,
    evolutionOf: safeString(definition.evolutionOf, null),
    pairPassive: safeString(definition.pairPassive, null),
    evolvesTo: safeString(definition.evolvesTo, null),
    mode: safeString(spec.mode, 'projectile'),
    identityAxes: axes,
    axes,
    levelData: sourceRow,
    trajectory,
    collision,
    residualField,
    field: residualField,
    persistentField: residualField,
    statusEffects: effects,
    status: effects,
    effects,
    audio,
    audioCue: audio.impactCue,
    allocation: allocationContract(sourceRow, spec, residualField, effects),
    dataCoverage: coverage,
    fieldCoverage: coverage,
    consumedFields: coverage.consumedFields,
    consumes: coverage.consumedFields,
    unconsumedFields: coverage.unconsumedFields,
    unusedDataFields: coverage.unconsumedFields,
  }
}

function compileDefinition(definition) {
  if (!definition || typeof definition !== 'object') return null
  const rows = cloneRows(definition.levels)
  if (rows.length === 0) return null
  const spec = specFor(definition)
  const coverage = coverageFor(definition, rows)
  const levels = rows.map((row, index) => levelDescriptor(
    definition, row, index + 1, rows.length, spec, coverage,
  ))
  const base = {
    id: safeString(definition.id, 'unknown'),
    weaponId: safeString(definition.id, 'unknown'),
    name: safeString(definition.name, definition.id ?? '법보'),
    tag: safeString(definition.tag, 'unknown'),
    desc: safeString(definition.desc, ''),
    pairPassive: safeString(definition.pairPassive, null),
    evolvesTo: safeString(definition.evolvesTo, null),
    evolutionOf: safeString(definition.evolutionOf, null),
    levelCount: levels.length,
    mode: levels[0].mode,
    identityAxes: levels[0].identityAxes,
    axes: levels[0].axes,
    levels,
    defaultLevel: levels[0],
    trajectory: levels[0].trajectory,
    collision: levels[0].collision,
    residualField: levels[0].residualField,
    field: levels[0].residualField,
    persistentField: levels[0].residualField,
    statusEffects: levels[0].statusEffects,
    status: levels[0].statusEffects,
    effects: levels[0].statusEffects,
    audio: levels[0].audio,
    audioCue: levels[0].audioCue,
    allocation: levels[0].allocation,
    dataCoverage: coverage,
    fieldCoverage: coverage,
    consumedFields: coverage.consumedFields,
    consumes: coverage.consumedFields,
    unconsumedFields: coverage.unconsumedFields,
    unusedDataFields: coverage.unconsumedFields,
  }
  return deepFreeze(base)
}

const ALL_DEFINITIONS_2D = Object.freeze([...WEAPONS, ...EVOLUTIONS])
const COMPILED = Object.create(null)
for (const definition of ALL_DEFINITIONS_2D) {
  const compiled = compileDefinition(definition)
  if (compiled) COMPILED[compiled.id] = compiled
}

export const WEAPON_BEHAVIOR_IDS_2D = Object.freeze(ALL_DEFINITIONS_2D.map((definition) => definition.id))
export const WEAPON_BEHAVIORS_2D = deepFreeze({ ...COMPILED })
export const WEAPON_BEHAVIOR_CATALOG_2D = WEAPON_BEHAVIORS_2D

function levelNumber(level) {
  if (level && typeof level === 'object') return levelNumber(read(level, 'level', 'rank'))
  return clampInteger(level, 1, 999, 1)
}

/** Immutable catalogue row selected for one level; unknown ids return null. */
export function getWeaponBehavior2D(id, level = 1) {
  if (id && typeof id === 'object') {
    level = read(id, 'level', 'rank') ?? level
    id = read(id, 'weaponId', 'id', 'weapon')
  }
  const base = COMPILED[id]
  if (!base) return null
  const selected = base.levels[levelNumber(level) - 1] ?? base.levels[base.levels.length - 1]
  return selected
}

export const describeWeaponBehavior2D = getWeaponBehavior2D
export const weaponBehaviorFor2D = getWeaponBehavior2D

/**
 * Compile an authored row or a caller-provided weapon definition.  Supplying
 * `level` returns the selected immutable level row; omitting it returns the
 * full multi-level descriptor.
 */
export function buildWeaponBehavior2D(definition, options = {}) {
  const compiled = compileDefinition(definition)
  if (!compiled) return null
  const level = read(options, 'level', 'rank')
  return level == null ? compiled : compiled.levels[levelNumber(level) - 1] ?? compiled.defaultLevel
}

export function buildWeaponBehaviorDescriptors2D(definitions = ALL_DEFINITIONS_2D) {
  const rows = Array.isArray(definitions)
    ? definitions
    : definitions && Array.isArray(definitions.weapons) && Array.isArray(definitions.evolutions)
      ? [...definitions.weapons, ...definitions.evolutions]
      : Object.values(definitions ?? {})
  const out = {}
  for (const definition of rows) {
    const compiled = compileDefinition(definition)
    if (compiled) out[compiled.id] = compiled
  }
  return deepFreeze(out)
}

/** Alias used by consumers that call this stage a behavior planner. */
export function planWeaponBehavior2D(input, level = 1) {
  if (input && typeof input === 'object') {
    return getWeaponBehavior2D({
      weaponId: read(input, 'weaponId', 'id', 'weapon'),
      level: read(input, 'level', 'rank') ?? level,
    })
  }
  return getWeaponBehavior2D(input, level)
}

export function weaponDataCoverage2D(definition) {
  const compiled = typeof definition === 'string'
    ? COMPILED[definition]
    : compileDefinition(definition)
  if (!compiled) return null
  return compiled.dataCoverage
}

export const getWeaponDataCoverage2D = weaponDataCoverage2D

/** Validate roster ids and prove that every authored field has a consumer. */
export function validateWeaponBehaviorCoverage2D(
  definitions = ALL_DEFINITIONS_2D,
  descriptors = null,
) {
  const rows = Array.isArray(definitions) ? definitions : Object.values(definitions ?? {})
  const compiled = descriptors ?? buildWeaponBehaviorDescriptors2D(rows)
  const errors = []
  const seen = new Set()
  for (const definition of rows) {
    const id = definition?.id
    if (!id || seen.has(id)) {
      errors.push(`duplicate-or-missing-id:${id ?? 'unknown'}`)
      continue
    }
    seen.add(id)
    const descriptor = compiled[id]
    if (!descriptor) {
      errors.push(`missing-descriptor:${id}`)
      continue
    }
    const expected = sourceFieldPaths(definition, definition.levels ?? [])
    const consumed = new Set(descriptor.dataCoverage?.consumedFields ?? [])
    for (const field of expected) {
      if (!consumed.has(field)) errors.push(`${id}:unconsumed:${field}`)
    }
    for (const field of descriptor.dataCoverage?.unconsumedFields ?? []) {
      errors.push(`${id}:unconsumed:${field}`)
    }
    if ((descriptor.identityAxes?.length ?? 0) < 2) errors.push(`${id}:fewer-than-two-identity-axes`)
  }
  for (const id of Object.keys(compiled)) {
    if (!seen.has(id)) errors.push(`descriptor-without-data:${id}`)
  }
  return deepFreeze({ ok: errors.length === 0, errors, ids: [...seen] })
}

export function isWeaponBehaviorCoverageComplete2D(value = validateWeaponBehaviorCoverage2D()) {
  return Boolean(value?.ok)
}

export const ALL_WEAPON_DEFINITIONS_2D = ALL_DEFINITIONS_2D
