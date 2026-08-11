import { describe, expect, it } from 'vitest'
import {
  cameraFollowFactor2D, cameraFollowStep2D, depthBucket, directionFor, isOnScreen, projectWorld,
  SORT_BUCKETS, viewportPresentationScale,
} from '../src/runtime2d/projection.js'

describe('runtime2d projection', () => {
  it('keeps the camera target at the gameplay focal point', () => {
    const out = projectWorld(12, -4, 12, -4, { width: 1920, height: 1080, zoom: 1 })
    expect(out.x).toBe(960)
    expect(out.y).toBeCloseTo(615.6)
    expect(out.unit).toBe(32)
  })

  it('preserves the horizontal field of view on the 2560x1600 target laptop', () => {
    const fullHd = projectWorld(10, 0, 0, 0, { width: 1920, height: 1080, zoom: 1 })
    const target = projectWorld(10, 0, 0, 0, { width: 2560, height: 1600, zoom: 1 })
    expect(fullHd.x - 960).toBeCloseTo(320)
    expect(target.x - 1280).toBeCloseTo(426.6667, 3)
    expect(viewportPresentationScale({ width: 2560, height: 1600 })).toBeCloseTo(4 / 3)
  })

  it('compresses world depth for a three-quarter floor', () => {
    const center = projectWorld(0, 0, 0, 0, { width: 1280, height: 720, zoom: 1 })
    const forward = projectWorld(0, 10, 0, 0, { width: 1280, height: 720, zoom: 1 })
    expect(forward.y - center.y).toBeCloseTo(80)
  })

  it('keeps the full spawn ring on the painted ground at wide aspect ratios', () => {
    const far = projectWorld(0, -25, 0, 0, { width: 1420, height: 709, zoom: 1 })
    const near = projectWorld(0, 25, 0, 0, { width: 1420, height: 709, zoom: 1 })
    expect(far.y).toBeGreaterThanOrEqual(709 * 0.27)
    expect(near.y).toBeLessThan(709)
  })

  it('selects authored directions and mirrors west', () => {
    expect(directionFor(0)).toEqual({ key: 's', mirror: false })
    expect(directionFor(Math.PI / 2)).toEqual({ key: 'e', mirror: false })
    expect(directionFor(-Math.PI / 2)).toEqual({ key: 'e', mirror: true })
    expect(directionFor(Math.PI)).toEqual({ key: 'n', mirror: false })
  })

  it('clamps depth to exactly 64 buckets', () => {
    expect(depthBucket(-100, 720)).toBe(0)
    expect(depthBucket(10000, 720)).toBe(SORT_BUCKETS - 1)
    expect(isOnScreen(-159, 360, { width: 1280, height: 720 })).toBe(true)
    expect(isOnScreen(-161, 360, { width: 1280, height: 720 })).toBe(false)
  })

  it('keeps camera follow stable across 16.7, 33 and 100ms render frames', () => {
    const perFrame = [16.7, 33, 100].map((milliseconds) => (
      cameraFollowStep2D(0, 100, milliseconds / 1000)
    ))
    expect(perFrame[0]).toBeGreaterThan(0)
    expect(perFrame[0]).toBeLessThan(perFrame[1])
    expect(perFrame[1]).toBeLessThan(perFrame[2])
    expect(perFrame.every((value) => value < 100)).toBe(true)

    const converge = (frameMilliseconds) => {
      let position = 0
      let elapsed = 0
      while (elapsed < 1000) {
        const step = Math.min(frameMilliseconds, 1000 - elapsed)
        position = cameraFollowStep2D(position, 100, step / 1000)
        elapsed += step
      }
      return position
    }
    const at16 = converge(16.7)
    const at33 = converge(33)
    const at100 = converge(100)
    expect(at16).toBeCloseTo(at33, 8)
    expect(at33).toBeCloseTo(at100, 8)
    expect(cameraFollowFactor2D(0)).toBe(0)
    expect(cameraFollowFactor2D(0.1)).toBeGreaterThan(0)
  })
})
