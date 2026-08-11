import { describe, expect, it } from 'vitest'
import {
  ANIMATION_PRIORITY,
  AnimationState2D,
  auditAnimationProfile,
  createAnimationProfile,
  directionFromVector,
  quantizeDirection,
} from '../src/runtime2d/AnimationState2D.js'

function frames(start) {
  return {
    n: [start, start + 1],
    ne: [start + 2, start + 3],
    e: [start + 4, start + 5],
    se: [start + 6, start + 7],
    s: [start + 8, start + 9],
  }
}

function profile(overrides = {}) {
  return createAnimationProfile({
    availableFrames: 60,
    cell: [256, 256],
    pivot: [0.5, 0.875],
    runtimeHeight: 128,
    clips: {
      idle: { directions: frames(0), fps: 4, loop: true },
      run: { directions: frames(10), fps: 10, loop: true },
      attack: { directions: frames(20), fps: 10 },
      dash: { directions: frames(30), fps: 20 },
      hurt: { directions: frames(40), fps: 10 },
      death: { directions: frames(50), fps: 5, holdLast: true },
      ...overrides,
    },
  })
}

describe('AnimationState2D', () => {
  it('uses death > hurt > dash > attack > run > idle priority', () => {
    expect(ANIMATION_PRIORITY.death).toBeGreaterThan(ANIMATION_PRIORITY.hurt)
    expect(ANIMATION_PRIORITY.hurt).toBeGreaterThan(ANIMATION_PRIORITY.dash)
    expect(ANIMATION_PRIORITY.dash).toBeGreaterThan(ANIMATION_PRIORITY.attack)

    const state = new AnimationState2D(profile(), { moving: true })
    expect(state.snapshot().state).toBe('run')
    expect(state.dispatch('attack')).toBe(true)
    expect(state.dispatch('dash')).toBe(true)
    expect(state.dispatch('attack')).toBe(false)
    expect(state.dispatch('hurt')).toBe(true)
    expect(state.dispatch('dash')).toBe(false)
    expect(state.dispatch('death')).toBe(true)
    expect(state.dispatch('hurt')).toBe(false)
    expect(state.snapshot().state).toBe('death')
  })

  it('quantizes five authored directions and mirrors only western sectors', () => {
    expect(quantizeDirection(0)).toEqual({ key: 's', mirror: false })
    expect(quantizeDirection(Math.PI / 4)).toEqual({ key: 'se', mirror: false })
    expect(quantizeDirection(Math.PI / 2)).toEqual({ key: 'e', mirror: false })
    expect(quantizeDirection(3 * Math.PI / 4)).toEqual({ key: 'ne', mirror: false })
    expect(quantizeDirection(Math.PI)).toEqual({ key: 'n', mirror: false })
    expect(quantizeDirection(-Math.PI / 4)).toEqual({ key: 'se', mirror: true })
    expect(quantizeDirection(-Math.PI / 2)).toEqual({ key: 'e', mirror: true })
    expect(quantizeDirection(-3 * Math.PI / 4)).toEqual({ key: 'ne', mirror: true })
    expect(directionFromVector(-1, 0)).toEqual({ key: 'e', mirror: true })
  })

  it('advances authored frames at clip fps and loops without padding', () => {
    const state = new AnimationState2D(profile())
    expect(state.snapshot().frame).toBe(8)
    expect(state.update(0.249).frame).toBe(8)
    expect(state.update(0.001).frame).toBe(9)
    expect(state.update(0.25).frame).toBe(8)
  })

  it('returns to the current locomotion state when a one-shot completes', () => {
    const state = new AnimationState2D(profile(), { moving: true })
    state.dispatch('attack')
    expect(state.snapshot().state).toBe('attack')
    expect(state.update(0.199).state).toBe('attack')
    expect(state.update(0.001).state).toBe('run')
    state.dispatch('stop')
    expect(state.snapshot().state).toBe('idle')
  })

  it('restarts a one-shot when a new event of the same priority arrives', () => {
    const state = new AnimationState2D(profile())
    state.dispatch('attack')
    state.update(0.11)
    expect(state.snapshot().frameIndex).toBe(1)
    state.dispatch('attack')
    expect(state.snapshot().frameIndex).toBe(0)
  })

  it('holds the authored final death frame until an explicit reset', () => {
    const state = new AnimationState2D(profile())
    state.dispatch('death')
    expect(state.update(10).frame).toBe(59)
    expect(state.snapshot()).toMatchObject({ state: 'death', complete: true, holdLast: true })
    state.dispatch('reset', { moving: false })
    expect(state.snapshot().state).toBe('idle')
  })

  it('exposes normalized foot pivot and signed scale metadata', () => {
    const state = new AnimationState2D(profile(), { facing: -Math.PI / 2 })
    const snapshot = state.snapshot()
    expect(snapshot.presentation.anchor).toEqual([0.5, 0.875])
    expect(snapshot.presentation.footPivotPx).toEqual([128, 224])
    expect(snapshot.presentation.uniformScale).toBe(0.5)
    expect(snapshot.scale).toEqual({ x: -0.5, y: 0.5 })
  })

  it('reports missing directions and unavailable frames as explicit fallback', () => {
    const missingDirection = profile({ attack: { directions: { s: [20, 21] }, fps: 10 } })
    const east = new AnimationState2D(missingDirection, { facing: Math.PI / 2 })
    east.dispatch('attack')
    expect(east.snapshot()).toMatchObject({
      state: 'fallback', requestedState: 'attack', frame: null,
      fallback: { active: true, reason: 'missing-direction' },
    })

    const unavailable = createAnimationProfile({
      availableFrames: 2,
      cell: [128, 128], pivot: [0.5, 0.9], runtimeHeight: 64,
      clips: { idle: { frames: [0, 3], fps: 4 } },
    })
    expect(new AnimationState2D(unavailable).snapshot().fallback.reason).toBe('unavailable-frame')
  })

  it('rejects duplicated or insufficient frames instead of cloning a still', () => {
    const duplicate = profile({ idle: { frames: [0, 0], requiredFrames: 2 } })
    expect(new AnimationState2D(duplicate).snapshot()).toMatchObject({
      state: 'fallback', frame: null, fallback: { reason: 'duplicate-frames' },
    })

    const still = profile({ idle: { frames: [0], requiredFrames: 2 } })
    const snapshot = new AnimationState2D(still).snapshot()
    expect(snapshot).toMatchObject({
      state: 'fallback', requestedState: 'idle', frame: null,
      fallback: { reason: 'insufficient-frames' },
    })
    expect(auditAnimationProfile(still)).toContain('idle.n: insufficient-frames')
  })

  it('updates facing during locked actions without changing their priority state', () => {
    const state = new AnimationState2D(profile())
    state.dispatch('hurt')
    state.dispatch('move', { x: -1, z: 0 })
    expect(state.snapshot()).toMatchObject({ state: 'hurt', direction: 'e', mirror: true })
    expect(state.update(0.2).state).toBe('run')
  })
})
