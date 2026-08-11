/**
 * Deterministic pacing director for the contest vertical slice.
 *
 * The authoritative run is seven minutes (420 seconds).  The director owns
 * only time and one-shot milestone state; presentation and combat systems
 * consume the immutable events returned by `advance`.
 */

export const CONTEST_PACING_VERSION_2D = 1
export const CONTEST_PACING_MODEL_VERSION_2D = CONTEST_PACING_VERSION_2D
export const CONTEST_PACING_DURATION_SECONDS = 420
export const CONTEST_PACING_HARD_TIMEOUT_SECONDS = CONTEST_PACING_DURATION_SECONDS

export const CONTEST_PACING_MILESTONE_2D = Object.freeze({
  firstOath: 'firstOath',
  poiEmphasis: 'poiEmphasis',
  midBoss: 'midBoss',
  finalBoss: 'finalBoss',
  hardTimeout: 'hardTimeout',
})

const MILESTONE_IDS = Object.freeze([
  CONTEST_PACING_MILESTONE_2D.firstOath,
  CONTEST_PACING_MILESTONE_2D.poiEmphasis,
  CONTEST_PACING_MILESTONE_2D.midBoss,
  CONTEST_PACING_MILESTONE_2D.finalBoss,
  CONTEST_PACING_MILESTONE_2D.hardTimeout,
])

/**
 * Times are the exact crossing points used by the director.  The event
 * objects are shared and frozen, so a caller cannot alter a later run.
 */
export const CONTEST_PACING_MILESTONES_2D = Object.freeze([
  Object.freeze({ id: CONTEST_PACING_MILESTONE_2D.firstOath, atSeconds: 20 }),
  Object.freeze({ id: CONTEST_PACING_MILESTONE_2D.poiEmphasis, atSeconds: 120 }),
  Object.freeze({ id: CONTEST_PACING_MILESTONE_2D.midBoss, atSeconds: 180 }),
  Object.freeze({ id: CONTEST_PACING_MILESTONE_2D.finalBoss, atSeconds: 330 }),
  Object.freeze({ id: CONTEST_PACING_MILESTONE_2D.hardTimeout, atSeconds: 420 }),
])
export const CONTEST_PACING_MILESTONES = CONTEST_PACING_MILESTONES_2D
export const CONTEST_PACING_MILESTONE_IDS_2D = MILESTONE_IDS
export const CONTEST_PACING_MILESTONE_IDS = MILESTONE_IDS

const EMPTY_EVENTS = Object.freeze([])
const ALL_MILESTONES_MASK = (1 << MILESTONE_IDS.length) - 1
const HARD_TIMEOUT_MASK = 1 << (MILESTONE_IDS.length - 1)

const MILESTONE_ALIASES = new Map([
  ['firstoath', CONTEST_PACING_MILESTONE_2D.firstOath],
  ['first-oath', CONTEST_PACING_MILESTONE_2D.firstOath],
  ['oath', CONTEST_PACING_MILESTONE_2D.firstOath],
  ['맹세', CONTEST_PACING_MILESTONE_2D.firstOath],
  ['poiemphasis', CONTEST_PACING_MILESTONE_2D.poiEmphasis],
  ['poi-emphasis', CONTEST_PACING_MILESTONE_2D.poiEmphasis],
  ['poi', CONTEST_PACING_MILESTONE_2D.poiEmphasis],
  ['제단', CONTEST_PACING_MILESTONE_2D.poiEmphasis],
  ['중간보스', CONTEST_PACING_MILESTONE_2D.midBoss],
  ['midboss', CONTEST_PACING_MILESTONE_2D.midBoss],
  ['mid-boss', CONTEST_PACING_MILESTONE_2D.midBoss],
  ['finalboss', CONTEST_PACING_MILESTONE_2D.finalBoss],
  ['final-boss', CONTEST_PACING_MILESTONE_2D.finalBoss],
  ['최종보스', CONTEST_PACING_MILESTONE_2D.finalBoss],
  ['hardtimeout', CONTEST_PACING_MILESTONE_2D.hardTimeout],
  ['hard-timeout', CONTEST_PACING_MILESTONE_2D.hardTimeout],
  ['timeout', CONTEST_PACING_MILESTONE_2D.hardTimeout],
  ['타임아웃', CONTEST_PACING_MILESTONE_2D.hardTimeout],
])

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function canonicalMilestoneId(value) {
  if (Number.isInteger(value) && value >= 0 && value < MILESTONE_IDS.length) return MILESTONE_IDS[value]
  if (typeof value !== 'string') return null
  const exact = value.trim()
  if (MILESTONE_IDS.includes(exact)) return exact
  const lower = exact.toLowerCase()
  return MILESTONE_ALIASES.get(lower)
    ?? MILESTONE_ALIASES.get(lower.replaceAll('_', '-'))
    ?? MILESTONE_ALIASES.get(lower.replaceAll(' ', '-'))
    ?? null
}

function normalizedDeltaSeconds(value) {
  if (value !== null && typeof value === 'object') {
    value = value.dtSeconds ?? value.deltaSeconds ?? value.seconds ?? value.dt
  }
  if (value === Number.POSITIVE_INFINITY) return CONTEST_PACING_DURATION_SECONDS
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return value
}

function parseStateInput(state) {
  if (typeof state === 'string') {
    try {
      state = JSON.parse(state)
    } catch {
      return null
    }
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  if (state.saveState != null) return parseStateInput(state.saveState)
  if (state.state != null && state.elapsedSeconds == null && state.elapsed == null) {
    return parseStateInput(state.state)
  }
  return state
}

function readElapsedSeconds(state) {
  const raw = state.elapsedSeconds ?? state.elapsed ?? state.timeSeconds ?? 0
  if (typeof raw !== 'number' || !Number.isFinite(raw)
    || raw < 0 || raw > CONTEST_PACING_DURATION_SECONDS) return null
  return raw
}

function maskFromValue(value) {
  if (Number.isInteger(value) && value >= 0 && value <= ALL_MILESTONES_MASK) return value
  if (!Array.isArray(value)) return null

  let mask = 0
  for (const entry of value) {
    const rawId = entry && typeof entry === 'object' ? entry.id ?? entry.milestone : entry
    const id = canonicalMilestoneId(rawId)
    if (!id) return null
    mask |= 1 << MILESTONE_IDS.indexOf(id)
  }
  return mask
}

function stateMask(state) {
  if (state.fired != null) return maskFromValue(state.fired)
  if (state.triggered != null) return maskFromValue(state.triggered)
  if (state.triggeredIds != null) return maskFromValue(state.triggeredIds)
  if (state.firedMask != null) return maskFromValue(state.firedMask)
  if (state.milestones != null) return maskFromValue(state.milestones)
  return 0
}

function firedIds(mask) {
  const ids = []
  for (let index = 0; index < MILESTONE_IDS.length; index++) {
    if ((mask & (1 << index)) !== 0) ids.push(MILESTONE_IDS[index])
  }
  return ids
}

function eventListForMask(mask, elapsedSeconds) {
  let count = 0
  for (let index = 0; index < CONTEST_PACING_MILESTONES_2D.length; index++) {
    const bit = 1 << index
    if ((mask & bit) === 0 && elapsedSeconds >= CONTEST_PACING_MILESTONES_2D[index].atSeconds) {
      count++
    }
  }
  if (count === 0) return EMPTY_EVENTS

  const events = new Array(count)
  let outputIndex = 0
  for (let index = 0; index < CONTEST_PACING_MILESTONES_2D.length; index++) {
    const bit = 1 << index
    if ((mask & bit) === 0 && elapsedSeconds >= CONTEST_PACING_MILESTONES_2D[index].atSeconds) {
      events[outputIndex++] = CONTEST_PACING_MILESTONES_2D[index]
    }
  }
  return events
}

/**
 * Owns the contest clock and emits each pacing milestone at most once.
 * `advance` consumes elapsed seconds, not wall-clock timestamps.
 */
export class ContestPacing2D {
  constructor(options = null) {
    this._elapsedSeconds = 0
    this._firedMask = 0
    this._timedOut = false

    if (options !== null) {
      const state = typeof options === 'object' && options.saveState != null
        ? options.saveState
        : typeof options === 'object' && options.state != null
          ? options.state
          : options
      this.restore(state)
    }
  }

  get elapsedSeconds() { return this._elapsedSeconds }
  get elapsed() { return this._elapsedSeconds }
  get timedOut() { return this._timedOut }
  get completed() { return this._timedOut }
  get done() { return this._timedOut }

  get nextMilestone() {
    for (let index = 0; index < MILESTONE_IDS.length; index++) {
      if ((this._firedMask & (1 << index)) === 0) return MILESTONE_IDS[index]
    }
    return null
  }

  get firedMilestones() {
    return Object.freeze(firedIds(this._firedMask))
  }

  /** Advance by elapsed seconds and return newly crossed milestones in order. */
  advance(deltaSeconds) {
    const delta = normalizedDeltaSeconds(deltaSeconds)
    const next = Math.min(
      CONTEST_PACING_DURATION_SECONDS,
      this._elapsedSeconds + delta,
    )
    this._elapsedSeconds = Number.isFinite(next)
      ? next
      : CONTEST_PACING_DURATION_SECONDS

    const events = eventListForMask(this._firedMask, this._elapsedSeconds)
    if (events.length === 0) return EMPTY_EVENTS

    for (const event of events) {
      const index = MILESTONE_IDS.indexOf(event.id)
      this._firedMask |= 1 << index
    }
    if ((this._firedMask & HARD_TIMEOUT_MASK) !== 0) this._timedOut = true
    return Object.freeze(events)
  }

  update(deltaSeconds) { return this.advance(deltaSeconds) }
  tick(deltaSeconds) { return this.advance(deltaSeconds) }
  step(deltaSeconds) { return this.advance(deltaSeconds) }

  /** Advance to an absolute elapsed time without ever moving the clock back. */
  advanceTo(elapsedSeconds) {
    if (elapsedSeconds === Number.POSITIVE_INFINITY) return this.advance(CONTEST_PACING_DURATION_SECONDS)
    if (typeof elapsedSeconds !== 'number' || !Number.isFinite(elapsedSeconds)) return EMPTY_EVENTS
    const target = Math.min(CONTEST_PACING_DURATION_SECONDS, Math.max(0, elapsedSeconds))
    return this.advance(Math.max(0, target - this._elapsedSeconds))
  }

  reset() {
    this._elapsedSeconds = 0
    this._firedMask = 0
    this._timedOut = false
    return this
  }

  /** Return the minimal immutable JSON save shape. */
  toSaveState() {
    return deepFreeze({
      version: CONTEST_PACING_VERSION_2D,
      elapsedSeconds: this._elapsedSeconds,
      fired: firedIds(this._firedMask),
      timedOut: this._timedOut,
    })
  }

  serialize() { return this.toSaveState() }
  serializeJson() { return JSON.stringify(this.toSaveState()) }
  toJSON() { return this.toSaveState() }

  /** Public immutable state view; aliases are intentionally kept small. */
  snapshot() { return this.toSaveState() }
  getSnapshot() { return this.snapshot() }

  /** Restore atomically; invalid state leaves the current director untouched. */
  restore(input) {
    const state = parseStateInput(input)
    if (!state) return false
    if (state.version != null && state.version !== CONTEST_PACING_VERSION_2D) return false

    const elapsedSeconds = readElapsedSeconds(state)
    const mask = stateMask(state)
    if (elapsedSeconds === null || mask === null) return false

    // Milestones are a strict temporal prefix.  A save cannot contain a
    // later event while omitting an earlier one, even when it was produced by
    // a malformed external caller.
    let expectedPrefixMask = 0
    for (let index = 0; index < MILESTONE_IDS.length; index++) {
      if ((mask & (1 << index)) === 0) break
      expectedPrefixMask |= 1 << index
    }
    if (mask !== expectedPrefixMask) return false

    for (let index = 0; index < MILESTONE_IDS.length; index++) {
      if ((mask & (1 << index)) !== 0
        && elapsedSeconds < CONTEST_PACING_MILESTONES_2D[index].atSeconds) return false
    }

    const timedOut = state.timedOut === true || state.timeout === true
    if (timedOut && elapsedSeconds < CONTEST_PACING_DURATION_SECONDS) return false
    if (timedOut && (mask & HARD_TIMEOUT_MASK) === 0) return false
    if ((mask & HARD_TIMEOUT_MASK) !== 0 && elapsedSeconds < CONTEST_PACING_DURATION_SECONDS) return false

    this._elapsedSeconds = elapsedSeconds
    this._firedMask = mask
    this._timedOut = timedOut || (mask & HARD_TIMEOUT_MASK) !== 0
    return true
  }

  restoreState(state) { return this.restore(state) }

  static fromSaveState(state) {
    const director = new ContestPacing2D()
    if (!director.restore(state)) throw new RangeError('ContestPacing2D 저장 상태가 올바르지 않습니다.')
    return director
  }

  static deserialize(state) { return ContestPacing2D.fromSaveState(state) }
  static fromJSON(state) { return ContestPacing2D.fromSaveState(state) }
}

export const ContestMilestoneDirector2D = ContestPacing2D
export const ContestPacingDirector2D = ContestPacing2D

export function createContestPacing2D(options) {
  return new ContestPacing2D(options)
}

export function restoreContestPacing2D(state) {
  return ContestPacing2D.fromSaveState(state)
}
