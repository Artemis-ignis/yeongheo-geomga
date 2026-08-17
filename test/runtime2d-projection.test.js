import { describe, expect, it } from 'vitest'
import {
  createWorldFrame2D, depthBucket, directionFor, groundTileOffset2D,
  isOnScreen, projectWorld, projectWorldWithFrame2D, unprojectScreen,
  SORT_BUCKETS, viewportPresentationScale, WORLD_DEPTH_RATIO_2D,
} from '../src/runtime2d/projection.js'
import {
  cameraDampingFactor2D, cameraLookAhead2D, WorldCamera2D,
  WORLD_CAMERA_MAX_TRAIL_2D,
} from '../src/runtime2d/WorldCamera2D.js'

describe('runtime2d projection', () => {
  it('keeps the camera target at the gameplay focal point', () => {
    const out = projectWorld(12, -4, 12, -4, { width: 1920, height: 1080, zoom: 1 })
    expect(out.x).toBe(960)
    expect(out.y).toBeCloseTo(583.2)
    expect(out.unit).toBeCloseTo(1080 / 33)
    expect(out.depthUnit / out.unit).toBeCloseTo(WORLD_DEPTH_RATIO_2D)
  })

  it('preserves a readable field of view on both release viewports', () => {
    const fullHd = projectWorld(10, 0, 0, 0, { width: 1920, height: 1080, zoom: 1 })
    const target = projectWorld(10, 0, 0, 0, { width: 2560, height: 1600, zoom: 1 })
    expect(fullHd.x - 960).toBeCloseTo((1080 / 33) * 10)
    expect(target.x - 1280).toBeCloseTo((2560 / 58) * 10)
    expect(viewportPresentationScale({ width: 2560, height: 1600 })).toBeCloseTo(4 / 3)
  })

  it('uses one projection frame for every world layer', () => {
    const viewport = { width: 1280, height: 720, zoom: 1 }
    const frame = createWorldFrame2D(4, -3, viewport)
    const viaFrame = projectWorldWithFrame2D(9, 7, frame)
    const direct = projectWorld(9, 7, 4, -3, viewport)
    expect(viaFrame).toEqual(direct)
    expect(viaFrame.y - frame.originY).toBeCloseTo(10 * frame.unit * WORLD_DEPTH_RATIO_2D)
  })

  it('places the offscreen ingress ring beyond the visible floor edges', () => {
    const viewport = { width: 1420, height: 709, zoom: 1 }
    const far = projectWorld(0, -33, 0, 0, viewport)
    const near = projectWorld(0, 33, 0, 0, viewport)
    expect(far.y).toBeLessThan(0)
    expect(near.y).toBeGreaterThan(viewport.height)
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

  it('keeps camera convergence stable across 30, 60 and 144 FPS', () => {
    const converge = (framesPerSecond) => {
      const camera = new WorldCamera2D({ snapDistance: 1000, lookAheadSeconds: 0, maxTrail: 1000 })
      camera.reset(0, 0)
      const step = 1 / framesPerSecond
      for (let i = 0; i < framesPerSecond; i++) {
        camera.update({ x: 6, z: -4, actualSpeed: 1, facing: 0 }, step)
      }
      return { x: camera.x, z: camera.z }
    }
    const at30 = converge(30)
    const at60 = converge(60)
    const at144 = converge(144)
    expect(at30.x).toBeCloseTo(at60.x, 8)
    expect(at60.x).toBeCloseTo(at144.x, 8)
    expect(at30.z).toBeCloseTo(at144.z, 8)
    expect(cameraDampingFactor2D(0)).toBe(0)
    expect(cameraDampingFactor2D(0.1)).toBeGreaterThan(0)
  })

  it('follows continuously without a page gate and snaps only on teleports', () => {
    const camera = new WorldCamera2D({ snapDistance: 1000, lookAheadSeconds: 0 })
    camera.reset(0, 0)
    camera.update({ x: 1, z: 0, actualSpeed: 5, facing: Math.PI / 2 }, 1 / 60)
    expect(camera.x).toBeGreaterThan(0)
    expect(camera.x).toBeLessThan(1)

    camera.update({ x: 20, z: 10, actualSpeed: 0, teleported: true }, 1 / 60)
    expect(camera.x).toBe(20)
    expect(camera.z).toBe(10)
  })

  it('lets locomotion cross the screen while keeping a bounded continuous trail', () => {
    const camera = new WorldCamera2D()
    camera.reset(0, 0)
    const player = { x: 0, z: 0, actualSpeed: 8, facing: Math.PI / 2 }
    for (let i = 0; i < 90; i++) {
      player.x += player.actualSpeed / 60
      camera.update(player, 1 / 60)
    }
    const trail = Math.hypot(player.x - camera.x, player.z - camera.z)
    // At release aspect ratios this is roughly seven percent of the screen
    // width: enough visible traversal to stop reading as a treadmill, while
    // the continuous camera still keeps threats around the heroine readable.
    expect(trail).toBeGreaterThan(3)
    expect(trail).toBeLessThanOrEqual(WORLD_CAMERA_MAX_TRAIL_2D)
  })

  it('uses restrained look-ahead and holds zero velocity after stopping', () => {
    const lead = cameraLookAhead2D(Math.PI / 2, 20)
    expect(lead.x).toBeGreaterThan(0)
    expect(lead.x).toBeLessThanOrEqual(0.7)
    expect(Math.abs(lead.z)).toBeLessThan(0.000001)

    const viewport = { width: 1920, height: 1080, zoom: 1 }
    const frame = createWorldFrame2D(0, 0, viewport)
    const simulateStop = (framesPerSecond, direction) => {
      const camera = new WorldCamera2D({ snapDistance: 1000, lookAheadSeconds: 0 })
      camera.reset(0, 0)
      const dt = 1 / framesPerSecond
      const player = { x: 0, z: 0, actualSpeed: 8, facing: Math.atan2(direction.x, direction.z) }
      for (let i = 0; i < framesPerSecond; i++) {
        player.x += direction.x * player.actualSpeed * dt
        player.z += direction.z * player.actualSpeed * dt
        camera.update(player, dt)
      }
      const beforeStop = { x: camera.x, z: camera.z }
      player.actualSpeed = 0
      for (let i = 0; i < framesPerSecond; i++) camera.update(player, dt)
      const afterStop = { x: camera.x, z: camera.z }
      const stopDelta = Math.hypot(
        (afterStop.x - beforeStop.x) * frame.unit,
        (afterStop.z - beforeStop.z) * frame.depthUnit,
      )
      return { camera, player, stopDelta }
    }

    for (const framesPerSecond of [30, 60, 144]) {
      for (const direction of [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: Math.SQRT1_2, z: Math.SQRT1_2 }]) {
        const result = simulateStop(framesPerSecond, direction)
        expect(result.stopDelta).toBeLessThanOrEqual(4)
        expect(result.camera.velocityX).toBe(0)
        expect(result.camera.velocityZ).toBe(0)
        expect(result.camera.moving).toBe(false)
      }
    }
  })

  it('round-trips screen points into the same projected world position', () => {
    const viewport = { width: 1422, height: 739, zoom: 1 }
    const projected = projectWorld(11.75, -6.5, 3, 2, viewport)
    const world = unprojectScreen(projected.x, projected.y, 3, 2, viewport)
    expect(world.x).toBeCloseTo(11.75)
    expect(world.z).toBeCloseTo(-6.5)
  })

  it.each([
    { width: 1280, height: 720, zoom: 1 },
    { width: 1920, height: 1080, zoom: 1 },
    { width: 2560, height: 1600, zoom: 1 },
  ])('anchors ground and world layers to the same camera displacement at %j', (viewport) => {
    const worldPoint = { x: 11.75, z: -6.5 }
    const frameA = createWorldFrame2D(3, -2, viewport)
    const frameB = createWorldFrame2D(4.5, 0.25, viewport)
    const actorA = projectWorldWithFrame2D(worldPoint.x, worldPoint.z, frameA)
    const actorB = projectWorldWithFrame2D(worldPoint.x, worldPoint.z, frameB)
    const presentationScale = viewportPresentationScale(viewport)
    const tileScaleX = 0.92 * presentationScale
    const tileScaleY = 0.5704 * presentationScale
    const groundA = groundTileOffset2D(frameA.cameraX, frameA.cameraZ, viewport, tileScaleX, tileScaleY)
    const groundB = groundTileOffset2D(frameB.cameraX, frameB.cameraZ, viewport, tileScaleX, tileScaleY)
    const groundDelta = { x: groundB.x - groundA.x, y: groundB.y - groundA.y }
    const actorDelta = { x: actorB.x - actorA.x, y: actorB.y - actorA.y }

    expect(groundDelta.x).toBeCloseTo(actorDelta.x)
    expect(groundDelta.y).toBeCloseTo(actorDelta.y)
    expect(groundDelta.x).toBeCloseTo(-(frameB.cameraX - frameA.cameraX) * frameA.unit)
    expect(groundDelta.y).toBeCloseTo(-(frameB.cameraZ - frameA.cameraZ) * frameA.depthUnit)
  })
})
