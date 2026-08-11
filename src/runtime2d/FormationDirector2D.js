import { ENEMIES } from '../data/enemies.js'
import { FORMATIONS, formationAngles, formationType } from '../data/formations.js'

/**
 * Version of the serialised formation timeline state.
 *
 * The director is intentionally independent from CombatWorld2D.  The world can
 * decide whether it has enough enemy capacity to accept an event and return
 * `false`; the director keeps that event leased so the next fixed tick retries
 * the exact same formation instead of silently losing it.
 */
export const FORMATION_DIRECTOR_VERSION = 1
export const DEFAULT_FORMATION_SEED = 0x51f15e

const EMPTY_OPTIONS = Object.freeze({})
// Fixed-delta accumulation (for example, 74 * (1 / 60)) can undershoot a
// declared whole-second boundary by a few ulps. Keep that numerical noise from
// adding a visible one-frame delay, while remaining far below a simulation
// tick.
const TIME_EPSILON = 1e-7

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

function normalizeSeed(value) {
  return (Number.isFinite(value) ? value : DEFAULT_FORMATION_SEED) >>> 0
}

function mix32(value) {
  let x = value >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}

function unitFloat(value) {
  return mix32(value) / 0x100000000
}

function mapById(definitions) {
  const out = Object.create(null)
  for (const definition of definitions ?? []) {
    if (definition?.id) out[definition.id] = definition
  }
  return out
}

function normalizeById(byId, enemies) {
  if (byId instanceof Map) {
    const out = Object.create(null)
    for (const [id, definition] of byId) out[id] = definition
    return out
  }
  return byId ?? mapById(enemies)
}

function readPlayer(context) {
  const value = context ?? EMPTY_OPTIONS
  const player = value.player ?? value
  const x = finiteOr(player.x ?? player.playerX, 0)
  const z = finiteOr(player.z ?? player.playerZ, 0)
  const previousX = finiteOr(player.prevX, x)
  const previousZ = finiteOr(player.prevZ, z)
  const moving = player.moving === true || previousX !== x || previousZ !== z
  let facing = finiteOr(player.facing, 0)
  if (!Number.isFinite(player.facing) && moving) facing = Math.atan2(x - previousX, z - previousZ)
  return { x, z, facing, moving }
}

function eventId(seed, index, formation) {
  return `formation:${(seed >>> 0).toString(16)}:${index}:${formation.t}:${formation.kind}`
}

/**
 * Allocation-light deterministic director for `FORMATIONS`.
 *
 * Normal fixed ticks should call `update(runTime, context, onEvent)` (absolute
 * run time in seconds).  The callback is synchronous; any return value other
 * than explicit `false` acknowledges the event.  A failed callback leaves the
 * event pending and the next tick receives the same immutable descriptor.
 *
 * `tick(dt, context, onEvent)` is provided for callers that keep only a fixed
 * delta.  It advances an internal clock and delegates to the same path.
 */
export class FormationDirector2D {
  constructor({
    formations = FORMATIONS,
    seed = DEFAULT_FORMATION_SEED,
    roster = null,
    enemies = ENEMIES,
    byId = null,
    onEvent = null,
    time = 0,
  } = {}) {
    if (!Array.isArray(formations)) throw new TypeError('FormationDirector2D formations must be an array')

    this.formations = formations
    this.seed = normalizeSeed(seed)
    this.roster = Array.isArray(roster) && roster.length > 0 ? roster : null
    this.byId = normalizeById(byId, enemies)
    this.onEvent = typeof onEvent === 'function' ? onEvent : null

    this.nextIndex = 0
    this.lastRunTime = Math.max(0, finiteOr(time, 0))
    this.formationSeen = false
    this.retryCount = 0

    // A contiguous timeline only needs one cursor. The byte array makes the
    // "exactly once" invariant observable without allocating a Set per run.
    this.completed = new Uint8Array(formations.length)
    this._pending = null
    this._pendingAnchor = null
    this._pendingIndex = -1
    this._clock = this.lastRunTime
  }

  get pendingEvent() {
    return this._pending
  }

  get pendingIndex() {
    return this._pendingIndex
  }

  get nextFormationIndex() {
    return this.nextIndex
  }

  get completeCount() {
    return this.nextIndex
  }

  get done() {
    return this.nextIndex >= this.formations.length && this._pending === null
  }

  /** Advance an absolute fixed-tick timestamp and dispatch all due events. */
  update(runTime, context = EMPTY_OPTIONS, handler = null) {
    if (typeof context === 'function') {
      handler = context
      context = EMPTY_OPTIONS
    }
    const time = Math.max(this.lastRunTime, finiteOr(runTime, this.lastRunTime))
    this.lastRunTime = time
    this._clock = Math.max(this._clock, time)
    return this._dispatch(time, context, handler)
  }

  /** Alias used by callers that prefer an explicit absolute-time name. */
  advance(runTime, context = EMPTY_OPTIONS, handler = null) {
    return this.update(runTime, context, handler)
  }

  /** Advance by a fixed delta, then dispatch any formations whose time passed. */
  tick(dt, context = EMPTY_OPTIONS, handler = null) {
    if (typeof context === 'function') {
      handler = context
      context = EMPTY_OPTIONS
    }
    const delta = Math.max(0, finiteOr(dt, 0))
    this._clock += delta
    return this.update(this._clock, context, handler)
  }

  step(dt, context = EMPTY_OPTIONS, handler = null) {
    return this.tick(dt, context, handler)
  }

  /**
   * Lease the next due event without acknowledging it.
   *
   * This is useful when the world must preflight capacity before spawning. The
   * caller must call `commit(event)` after a successful spawn or `retry(event)`
   * after a failed preflight.
   */
  poll(runTime, context = EMPTY_OPTIONS) {
    const time = Math.max(this.lastRunTime, finiteOr(runTime, this.lastRunTime))
    this.lastRunTime = time
    this._clock = Math.max(this._clock, time)
    if (this._pending) return this._pending
    if (this.nextIndex >= this.formations.length) return null
    const formation = this.formations[this.nextIndex]
    if (!formation || formation.t > time + TIME_EPSILON) return null
    return this._lease(this.nextIndex, context)
  }

  /** A callback-friendly polling alias. */
  dispatch(runTime, context = EMPTY_OPTIONS, handler = null) {
    return this.update(runTime, context, handler)
  }

  /** Mark the currently leased formation as successfully accepted. */
  commit(eventOrIndex = this._pending) {
    const index = this._eventIndex(eventOrIndex)
    if (index < 0 || index !== this.nextIndex || !this._pending || index !== this._pendingIndex) return false
    this.completed[index] = 1
    this.nextIndex = index + 1
    this._pending = null
    this._pendingAnchor = null
    this._pendingIndex = -1
    this.retryCount = 0
    return true
  }

  acknowledge(eventOrIndex = this._pending) {
    return this.commit(eventOrIndex)
  }

  /** Keep the lease alive for the next fixed tick after a failed spawn. */
  retry(eventOrIndex = this._pending) {
    const index = this._eventIndex(eventOrIndex)
    if (index < 0 || index !== this.nextIndex || !this._pending || index !== this._pendingIndex) return false
    this.retryCount++
    return true
  }

  /** Clear a pending lease without marking it complete. */
  release(eventOrIndex = this._pending) {
    const index = this._eventIndex(eventOrIndex)
    if (index < 0 || index !== this.nextIndex || index !== this._pendingIndex) return false
    this._pending = null
    this._pendingAnchor = null
    this._pendingIndex = -1
    this.retryCount = 0
    return true
  }

  /**
   * Serialize only deterministic cursor/anchor state.  The formation descriptor
   * itself is rebuilt from the same data table on restore, avoiding a large save
   * payload while preserving a pending event's exact world anchor.
   */
  toSaveState() {
    return {
      version: FORMATION_DIRECTOR_VERSION,
      seed: this.seed,
      nextIndex: this.nextIndex,
      formationSeen: this.formationSeen,
      lastRunTime: this.lastRunTime,
      retryCount: this.retryCount,
      pending: this._pendingAnchor
        ? {
            index: this._pendingIndex,
            x: this._pendingAnchor.x,
            z: this._pendingAnchor.z,
            facing: this._pendingAnchor.facing,
          }
        : null,
    }
  }

  snapshot() {
    return this.toSaveState()
  }

  serialize() {
    return this.toSaveState()
  }

  serializeJson() {
    return JSON.stringify(this.toSaveState())
  }

  toJSON() {
    return this.toSaveState()
  }

  restoreState(state) {
    return this.restore(state)
  }

  /** Restore cursor state; returns false for incompatible state. */
  restore(state) {
    if (!state || typeof state !== 'object') return false
    if (state.version !== FORMATION_DIRECTOR_VERSION) return false
    if (!Number.isFinite(state.seed) || (state.seed >>> 0) !== state.seed || state.seed !== this.seed) return false

    const next = Math.trunc(state.nextIndex)
    if (!Number.isInteger(next) || next < 0 || next > this.formations.length) return false
    const pending = state.pending
    if (pending !== null && pending !== undefined) {
      if (!Number.isInteger(pending.index) || pending.index !== next || next >= this.formations.length) return false
      if (![pending.x, pending.z, pending.facing].every(Number.isFinite)) return false
    }
    const retryCount = state.retryCount === undefined ? 0 : state.retryCount
    if (!Number.isInteger(retryCount) || retryCount < 0) return false

    this.nextIndex = next
    this.completed.fill(0)
    this.completed.fill(1, 0, next)
    this.lastRunTime = Math.max(0, finiteOr(state.lastRunTime, this.lastRunTime))
    this._clock = this.lastRunTime
    this.formationSeen = state.formationSeen === true || next > 0 || Boolean(pending)
    this.retryCount = retryCount
    this._pending = null
    this._pendingIndex = -1
    this._pendingAnchor = null
    if (pending) {
      this._pendingIndex = next
      this._pendingAnchor = { x: pending.x, z: pending.z, facing: pending.facing }
      this._pending = this._buildEvent(next, this._pendingAnchor)
    }
    return true
  }

  reset({ seed = this.seed, time = 0 } = {}) {
    this.seed = normalizeSeed(seed)
    this.nextIndex = 0
    this.lastRunTime = Math.max(0, finiteOr(time, 0))
    this._clock = this.lastRunTime
    this.formationSeen = false
    this.retryCount = 0
    this.completed.fill(0)
    this._pending = null
    this._pendingAnchor = null
    this._pendingIndex = -1
  }

  /** Iterate members without allocating a positions array. */
  forEachMember(eventOrIndex, callback) {
    if (typeof callback !== 'function') return 0
    const event = typeof eventOrIndex === 'object'
      ? eventOrIndex
      : this._buildEvent(eventOrIndex, this._pendingIndex === eventOrIndex
        ? this._pendingAnchor
        : { x: 0, z: 0, facing: this._seededFacing(eventOrIndex) })
    if (!event) return 0
    const angles = event.angles
    for (let i = 0; i < angles.length; i++) {
      const angle = angles[i]
      callback(
        i,
        event.centerX + Math.sin(angle) * event.radius,
        event.centerZ + Math.cos(angle) * event.radius,
        angle,
        event,
      )
    }
    return angles.length
  }

  _dispatch(time, context, handler) {
    let dispatched = 0
    const callback = typeof handler === 'function' ? handler : this.onEvent
    while (true) {
      const event = this._pending ?? this._due(time, context)
      if (!event) break
      if (callback && callback(event) === false) {
        this.retry(event)
        break
      }
      if (!this.commit(event)) break
      dispatched++
    }
    return dispatched
  }

  _due(time, context) {
    if (this._pending || this.nextIndex >= this.formations.length) return this._pending
    const formation = this.formations[this.nextIndex]
    if (!formation || formation.t > time + TIME_EPSILON) return null
    return this._lease(this.nextIndex, context)
  }

  _lease(index, context) {
    const player = readPlayer(context)
    let facing = player.facing
    // A stationary wall/pincer still needs a stable orientation. It is seeded
    // per event rather than drawn from a mutable RNG, so retry/resume is exact.
    if (!player.moving && !Number.isFinite(context?.player?.facing ?? context?.facing)) facing = this._seededFacing(index)
    this._pendingIndex = index
    this._pendingAnchor = { x: player.x, z: player.z, facing }
    this.formationSeen = true
    this._pending = this._buildEvent(index, this._pendingAnchor)
    return this._pending
  }

  _buildEvent(index, anchor) {
    const formation = this.formations[index]
    if (!formation) return null
    const wantedType = formation.type
    const type = formationType(wantedType, this.roster, this.byId)
    const arc = finiteOr(formation.arc, 1.4)
    const count = Math.max(0, Math.trunc(finiteOr(formation.count, 0)))
    const angles = formationAngles(formation.kind, count, anchor?.facing ?? 0, arc)
    const event = {
      id: eventId(this.seed, index, formation),
      index,
      ordinal: index,
      t: formation.t,
      kind: formation.kind,
      wantedType,
      type,
      count,
      radius: finiteOr(formation.radius, 0),
      arc,
      haste: finiteOr(formation.haste, 1),
      centerX: finiteOr(anchor?.x, 0),
      centerZ: finiteOr(anchor?.z, 0),
      facing: finiteOr(anchor?.facing, 0),
      angles,
      seed: mix32(this.seed ^ Math.imul(index + 1, 0x9e3779b9)),
    }
    Object.freeze(angles)
    return Object.freeze(event)
  }

  _eventIndex(eventOrIndex) {
    if (Number.isInteger(eventOrIndex)) return eventOrIndex
    if (eventOrIndex && Number.isInteger(eventOrIndex.index)) return eventOrIndex.index
    return -1
  }

  _seededFacing(index) {
    return unitFloat(this.seed ^ Math.imul(index + 1, 0x9e3779b9)) * Math.PI * 2
  }
}

export function createFormationDirector2D(options) {
  return new FormationDirector2D(options)
}

export function formationDirectorFromSaveState(state, options = {}) {
  const director = new FormationDirector2D({ ...options, seed: options.seed ?? state?.seed })
  if (!director.restore(state)) throw new RangeError('FormationDirector2D 저장 상태가 올바르지 않습니다.')
  return director
}
