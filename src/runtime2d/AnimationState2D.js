export const ANIMATION_STATES = Object.freeze(['idle', 'run', 'dash', 'attack', 'hurt', 'death'])
export const AUTHORED_DIRECTIONS = Object.freeze(['n', 'ne', 'e', 'se', 's'])

export const ANIMATION_PRIORITY = Object.freeze({
  idle: 0,
  run: 10,
  attack: 40,
  dash: 60,
  hurt: 80,
  death: 100,
})

export const DEFAULT_ANIMATION_TIMING = Object.freeze({
  idle: Object.freeze({ fps: 6, loop: true, holdLast: false, fallbackDuration: 0 }),
  run: Object.freeze({ fps: 10, loop: true, holdLast: false, fallbackDuration: 0 }),
  dash: Object.freeze({ fps: 16, loop: false, holdLast: false, fallbackDuration: 0.16 }),
  attack: Object.freeze({ fps: 12.5, loop: false, holdLast: false, fallbackDuration: 0.32 }),
  hurt: Object.freeze({ fps: 12, loop: false, holdLast: false, fallbackDuration: 0.25 }),
  death: Object.freeze({ fps: 10, loop: false, holdLast: true, fallbackDuration: Infinity }),
})

const ACTION_EVENTS = Object.freeze({ attack: 'attack', dash: 'dash', hurt: 'hurt', death: 'death' })
const EPSILON = 1e-9

function finitePositive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function freezeFrames(frames) {
  return Object.freeze(Array.isArray(frames) ? [...frames] : [])
}

/**
 * Quantize a simulation heading to the five authored east-side directions.
 * Angles use the combat world's convention: 0=south, PI/2=east. West-facing
 * sectors reuse the matching east texture through an explicit mirror flag.
 */
export function quantizeDirection(angle = 0) {
  const heading = Number.isFinite(angle) ? angle : 0
  const tau = Math.PI * 2
  const normalized = ((heading + Math.PI) % tau + tau) % tau - Math.PI
  let sector = Math.round(normalized / (Math.PI / 4))
  if (sector === -4 || sector === 4) return { key: 'n', mirror: false }
  const mirror = sector < 0
  sector = Math.abs(sector)
  if (sector === 0) return { key: 's', mirror: false }
  if (sector === 1) return { key: 'se', mirror }
  if (sector === 2) return { key: 'e', mirror }
  return { key: 'ne', mirror }
}

export function directionFromVector(x, z, fallbackAngle = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || (Math.abs(x) < EPSILON && Math.abs(z) < EPSILON)) {
    return quantizeDirection(fallbackAngle)
  }
  return quantizeDirection(Math.atan2(x, z))
}

export function createPresentationMetadata({ cell, pivot, runtimeHeight }) {
  if (!Array.isArray(cell) || cell.length !== 2 || cell.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new TypeError('AnimationState2D requires a positive [width, height] cell')
  }
  if (!Array.isArray(pivot) || pivot.length !== 2 || pivot.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new TypeError('AnimationState2D requires a normalized [x, y] foot pivot')
  }
  if (!Number.isFinite(runtimeHeight) || runtimeHeight <= 0) {
    throw new TypeError('AnimationState2D requires a positive runtimeHeight')
  }
  const uniformScale = runtimeHeight / cell[1]
  return Object.freeze({
    cell: Object.freeze([...cell]),
    anchor: Object.freeze([...pivot]),
    footPivotPx: Object.freeze([pivot[0] * cell[0], pivot[1] * cell[1]]),
    runtimeHeight,
    uniformScale,
  })
}

function normalizeClip(state, raw = {}) {
  const defaults = DEFAULT_ANIMATION_TIMING[state]
  const source = Array.isArray(raw) ? { frames: raw } : (raw ?? {})
  const sharedFrames = Array.isArray(source.frames) ? freezeFrames(source.frames) : null
  const directions = {}
  for (const direction of AUTHORED_DIRECTIONS) {
    const frames = source.directions?.[direction] ?? source[direction]
    if (Array.isArray(frames)) directions[direction] = freezeFrames(frames)
  }
  return Object.freeze({
    fps: finitePositive(source.fps, defaults.fps),
    loop: source.loop ?? defaults.loop,
    holdLast: source.holdLast ?? defaults.holdLast,
    fallbackDuration: source.fallbackDuration ?? defaults.fallbackDuration,
    requiredFrames: Math.max(1, Math.floor(source.requiredFrames ?? 1)),
    frames: sharedFrames,
    directions: Object.freeze(directions),
  })
}

function makeAvailableFramePredicate(availableFrames) {
  if (Number.isInteger(availableFrames) && availableFrames >= 0) {
    return (frame) => frame >= 0 && frame < availableFrames
  }
  if (Array.isArray(availableFrames) || availableFrames instanceof Set) {
    const frameSet = new Set(availableFrames)
    return (frame) => frameSet.has(frame)
  }
  return (frame) => Number.isInteger(frame) && frame >= 0
}

export function createAnimationProfile({ clips = {}, availableFrames, cell, pivot, runtimeHeight }) {
  const normalizedClips = {}
  for (const state of ANIMATION_STATES) {
    if (clips[state] != null) normalizedClips[state] = normalizeClip(state, clips[state])
  }
  return Object.freeze({
    clips: Object.freeze(normalizedClips),
    presentation: createPresentationMetadata({ cell, pivot, runtimeHeight }),
    hasFrame: makeAvailableFramePredicate(availableFrames),
  })
}

function inspectClip(profile, state, direction) {
  const clip = profile.clips[state]
  if (!clip) return { ok: false, reason: 'missing-clip', frames: null, clip: null }
  const frames = clip.frames ?? clip.directions[direction]
  if (!frames) return { ok: false, reason: 'missing-direction', frames: null, clip }
  if (frames.length < clip.requiredFrames) return { ok: false, reason: 'insufficient-frames', frames, clip }
  if (new Set(frames).size !== frames.length) return { ok: false, reason: 'duplicate-frames', frames, clip }
  if (frames.some((frame) => !Number.isInteger(frame) || frame < 0)) {
    return { ok: false, reason: 'invalid-frame', frames, clip }
  }
  if (frames.some((frame) => !profile.hasFrame(frame))) {
    return { ok: false, reason: 'unavailable-frame', frames, clip }
  }
  return { ok: true, reason: null, frames, clip }
}

/** Returns every missing direction/frame defect without fabricating replacements. */
export function auditAnimationProfile(profile) {
  const errors = []
  for (const state of ANIMATION_STATES) {
    for (const direction of AUTHORED_DIRECTIONS) {
      const result = inspectClip(profile, state, direction)
      if (!result.ok) errors.push(`${state}.${direction}: ${result.reason}`)
      if (profile.clips[state]?.frames) break
    }
  }
  return errors
}

export class AnimationState2D {
  constructor(profile, { facing = 0, moving = false } = {}) {
    this.profile = profile?.presentation ? profile : createAnimationProfile(profile ?? {})
    this.state = moving ? 'run' : 'idle'
    this.elapsed = 0
    this.facing = Number.isFinite(facing) ? facing : 0
    this.moving = Boolean(moving)
  }

  dispatch(event, payload = {}) {
    if (event === 'reset') {
      this.moving = Boolean(payload.moving)
      if (Number.isFinite(payload.facing)) this.facing = payload.facing
      this._transition(this.moving ? 'run' : 'idle', true)
      return true
    }
    if (event === 'face') {
      if (Number.isFinite(payload.angle)) this.facing = payload.angle
      return true
    }
    if (event === 'move') {
      this.moving = payload.moving ?? true
      if (Number.isFinite(payload.angle)) this.facing = payload.angle
      else if (Number.isFinite(payload.x) && Number.isFinite(payload.z)
        && (Math.abs(payload.x) >= EPSILON || Math.abs(payload.z) >= EPSILON)) {
        this.facing = Math.atan2(payload.x, payload.z)
      }
      this._resolveLocomotion()
      return true
    }
    if (event === 'stop') {
      this.moving = false
      this._resolveLocomotion()
      return true
    }
    if (event === 'complete') {
      if (this.state === 'death') return false
      this._transition(this.moving ? 'run' : 'idle')
      return true
    }
    const nextState = ACTION_EVENTS[event]
    if (!nextState) return false
    if (this.state === 'death') return false
    if (ANIMATION_PRIORITY[nextState] < ANIMATION_PRIORITY[this.state]) return false
    this._transition(nextState, true)
    return true
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new TypeError('AnimationState2D.update requires a non-negative finite dt')
    this.elapsed += dt
    if (this.state === 'idle' || this.state === 'run' || this.state === 'death') return this.snapshot()
    const direction = quantizeDirection(this.facing)
    const resolved = inspectClip(this.profile, this.state, direction.key)
    const duration = resolved.ok
      ? resolved.frames.length / resolved.clip.fps
      : (resolved.clip?.fallbackDuration ?? DEFAULT_ANIMATION_TIMING[this.state].fallbackDuration)
    if (this.elapsed + EPSILON >= duration) this._transition(this.moving ? 'run' : 'idle')
    return this.snapshot()
  }

  snapshot() {
    const direction = quantizeDirection(this.facing)
    const resolved = inspectClip(this.profile, this.state, direction.key)
    const presentation = this.profile.presentation
    if (!resolved.ok) {
      return Object.freeze({
        state: 'fallback',
        requestedState: this.state,
        direction: direction.key,
        mirror: direction.mirror,
        frame: null,
        frameIndex: -1,
        elapsed: this.elapsed,
        complete: false,
        fallback: Object.freeze({ active: true, reason: resolved.reason }),
        presentation,
        scale: Object.freeze({ x: direction.mirror ? -presentation.uniformScale : presentation.uniformScale, y: presentation.uniformScale }),
      })
    }

    const { frames, clip } = resolved
    const rawIndex = Math.floor((this.elapsed + EPSILON) * clip.fps)
    const frameIndex = clip.loop
      ? rawIndex % frames.length
      : Math.min(frames.length - 1, rawIndex)
    const duration = frames.length / clip.fps
    const complete = !clip.loop && this.elapsed + EPSILON >= duration
    return Object.freeze({
      state: this.state,
      requestedState: this.state,
      direction: direction.key,
      mirror: direction.mirror,
      frame: frames[frameIndex],
      frameIndex,
      elapsed: this.elapsed,
      duration,
      complete,
      holdLast: clip.holdLast,
      fallback: Object.freeze({ active: false, reason: null }),
      presentation,
      scale: Object.freeze({ x: direction.mirror ? -presentation.uniformScale : presentation.uniformScale, y: presentation.uniformScale }),
    })
  }

  _resolveLocomotion() {
    if (ANIMATION_PRIORITY[this.state] <= ANIMATION_PRIORITY.run) {
      this._transition(this.moving ? 'run' : 'idle')
    }
  }

  _transition(nextState, restart = false) {
    if (nextState === this.state && !restart) return
    this.state = nextState
    this.elapsed = 0
  }
}
