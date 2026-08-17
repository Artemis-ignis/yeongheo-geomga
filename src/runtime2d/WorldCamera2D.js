const CAMERA_MIN_DT_2D = 1 / 240
const CAMERA_MAX_DT_2D = 0.1

// Let the heroine visibly cross the floor before the camera catches her. A
// high response effectively pins her to the focal point and makes valid
// world-space movement read as a treadmill. This is still one continuous
// camera; it simply carries a bounded elastic trail while moving.
export const WORLD_CAMERA_RESPONSE_2D = 1.8
export const WORLD_CAMERA_LOOK_AHEAD_SECONDS_2D = 0.025
export const WORLD_CAMERA_MAX_LOOK_AHEAD_2D = 0.45
export const WORLD_CAMERA_MAX_TRAIL_2D = 5.5
export const WORLD_CAMERA_SNAP_DISTANCE_2D = 12

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

export function cameraDampingFactor2D(dtSeconds, response = WORLD_CAMERA_RESPONSE_2D) {
  const dt = Math.max(0, Math.min(CAMERA_MAX_DT_2D, finite(dtSeconds)))
  const rate = Math.max(0, finite(response))
  return rate === 0 || dt === 0 ? 0 : 1 - Math.exp(-rate * dt)
}

export function cameraLookAhead2D(facing, speed, seconds = WORLD_CAMERA_LOOK_AHEAD_SECONDS_2D) {
  const distance = Math.min(
    WORLD_CAMERA_MAX_LOOK_AHEAD_2D,
    Math.max(0, finite(speed)) * Math.max(0, finite(seconds)),
  )
  return Object.freeze({
    x: Math.sin(finite(facing)) * distance,
    z: Math.cos(finite(facing)) * distance,
  })
}

/**
 * One continuous survivor-camera.
 *
 * The old renderer held a large screen page and then dragged the world to a
 * new anchor after the heroine crossed an outer gate. That is the exact
 * scroll-at-the-edge sensation a player reported. This camera has no page or
 * gate. It follows the simulation every frame with a short movement lead and
 * enters an explicit zero-velocity hold when locomotion ends, while teleports
 * reset atomically.
 */
export class WorldCamera2D {
  constructor({
    response = WORLD_CAMERA_RESPONSE_2D,
    lookAheadSeconds = WORLD_CAMERA_LOOK_AHEAD_SECONDS_2D,
    maxTrail = WORLD_CAMERA_MAX_TRAIL_2D,
    snapDistance = WORLD_CAMERA_SNAP_DISTANCE_2D,
  } = {}) {
    this.response = response
    this.lookAheadSeconds = lookAheadSeconds
    this.maxTrail = maxTrail
    this.snapDistance = snapDistance
    this.x = 0
    this.z = 0
    this.targetX = 0
    this.targetZ = 0
    this.velocityX = 0
    this.velocityZ = 0
    this.moving = false
    this.initialized = false
  }

  reset(x = 0, z = 0) {
    this.x = this.targetX = finite(x)
    this.z = this.targetZ = finite(z)
    this.velocityX = this.velocityZ = 0
    this.moving = false
    this.initialized = true
    return this
  }

  update(player, dtSeconds) {
    const playerX = finite(player?.x, this.x)
    const playerZ = finite(player?.z, this.z)
    if (!this.initialized) return this.reset(playerX, playerZ)

    const teleported = Boolean(player?.teleported)
      || Math.hypot(playerX - this.x, playerZ - this.z) > Math.max(1, finite(this.snapDistance, 8))
    if (teleported) return this.reset(playerX, playerZ)

    const speed = Math.max(0, finite(player?.actualSpeed))
    const moving = speed > 0.05

    // Stop is an explicit zero-velocity state. The camera is intentionally
    // allowed to carry a bounded trail while locomotion is active, but once
    // the simulation reports no movement it must not continue easing toward
    // the heroine and make the floor appear to slide under a stationary
    // player. The next moving update resumes the same continuous follow.
    if (!moving) {
      this.velocityX = 0
      this.velocityZ = 0
      this.targetX = this.x
      this.targetZ = this.z
      this.moving = false
      return this
    }

    const lead = cameraLookAhead2D(player?.facing, speed, this.lookAheadSeconds)
    this.targetX = playerX + lead.x
    this.targetZ = playerZ + lead.z

    const dt = Math.max(CAMERA_MIN_DT_2D, Math.min(CAMERA_MAX_DT_2D, finite(dtSeconds, 1 / 60)))
    const factor = cameraDampingFactor2D(dt, this.response)
    const previousX = this.x
    const previousZ = this.z
    this.x += (this.targetX - this.x) * factor
    this.z += (this.targetZ - this.z) * factor
    this.velocityX = (this.x - previousX) / dt
    this.velocityZ = (this.z - previousZ) / dt
    this.moving = true

    // Keep diagonal and cardinal travel inside the same screen-space range
    // without reintroducing a rectangular dead-zone or page transition.
    const trailX = playerX - this.x
    const trailZ = playerZ - this.z
    const trail = Math.hypot(trailX, trailZ)
    const maxTrail = Math.max(0.1, finite(this.maxTrail, WORLD_CAMERA_MAX_TRAIL_2D))
    if (trail > maxTrail) {
      const scale = maxTrail / trail
      this.x = playerX - trailX * scale
      this.z = playerZ - trailZ * scale
    }

    return this
  }
}
