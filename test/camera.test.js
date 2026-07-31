import { describe, it, expect } from 'vitest'
import { FollowCamera, ZOOM_MIN, ZOOM_MAX } from '../src/world/Camera.js'

describe('FollowCamera zoom', () => {
  it('clamps to the usable range', () => {
    const cam = new FollowCamera(16 / 9)
    expect(cam.setZoom(0.1)).toBe(ZOOM_MIN)
    expect(cam.setZoom(99)).toBe(ZOOM_MAX)
  })

  it('does not move the spawn ring', () => {
    // The whole reason zoom is allowed: it must be a view preference, not a
    // difficulty slider. `viewRadius` decides where enemies enter the arena.
    const cam = new FollowCamera(16 / 9)
    const before = cam.viewRadius
    cam.setZoom(ZOOM_MAX)
    cam.update(0, 0, 1)
    expect(cam.viewRadius).toBe(before)
  })

  it('eases toward the requested zoom rather than jumping', () => {
    const cam = new FollowCamera(16 / 9)
    const y0 = cam.camera.position.y
    cam.setZoom(ZOOM_MAX)
    cam.update(0, 0, 1 / 60)
    const y1 = cam.camera.position.y
    expect(y1).toBeGreaterThan(y0)
    // One 60Hz tick must not cover even half the distance to the target.
    expect(y1).toBeLessThan((y0 + y0 * ZOOM_MAX) / 2)
  })

  it('pulls the rig in when zoomed all the way down', () => {
    const cam = new FollowCamera(16 / 9)
    const y0 = cam.camera.position.y
    cam.setZoom(ZOOM_MIN)
    for (let i = 0; i < 120; i++) cam.update(0, 0, 1 / 60)
    expect(cam.camera.position.y).toBeLessThan(y0)
    expect(cam.camera.position.y).toBeCloseTo(y0 * ZOOM_MIN, 1)
  })

  it('nudge accumulates in steps and stops at the limits', () => {
    const cam = new FollowCamera(16 / 9)
    for (let i = 0; i < 50; i++) cam.nudgeZoom(1)
    expect(cam.zoom).toBe(ZOOM_MAX)
    for (let i = 0; i < 50; i++) cam.nudgeZoom(-1)
    expect(cam.zoom).toBe(ZOOM_MIN)
  })
})
