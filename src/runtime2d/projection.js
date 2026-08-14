export const SORT_BUCKETS = 64

/**
 * Camera follow is presentation-only, so it must not change its response when
 * the render loop delivers a 16.7ms, 33ms, or 100ms frame.  The exponential
 * step below is frame-rate independent: equal elapsed time converges to the
 * same point regardless of how it is partitioned into render frames.
 */
// A very stiff follow (the previous value was 8) pinned the heroine to the
// edge of a small dead zone almost immediately. World coordinates were moving,
// but the floor did most of the visible travelling and locomotion read like a
// treadmill. Let the authored stride lead the camera, then catch up smoothly.
export const CAMERA_FOLLOW_RESPONSE_2D = 5.2

export function cameraFollowFactor2D(dtSeconds, response = CAMERA_FOLLOW_RESPONSE_2D) {
  const dt = Math.max(0, Math.min(0.25, Number(dtSeconds) || 0))
  const rate = Math.max(0, Number(response) || 0)
  return rate > 0 ? 1 - Math.exp(-rate * dt) : 0
}

export function cameraFollowStep2D(current, target, dtSeconds, response = CAMERA_FOLLOW_RESPONSE_2D) {
  const from = Number(current)
  const to = Number(target)
  if (!Number.isFinite(to)) return Number.isFinite(from) ? from : 0
  if (!Number.isFinite(from)) return to
  return from + (to - from) * cameraFollowFactor2D(dtSeconds, response)
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Keep authored 1080p combat silhouettes at the same physical proportion on
 * high-resolution displays. 2560x1600 used to show more world while every
 * actor stayed at its 1080p pixel height, making the game look zoomed out and
 * empty on the target laptop.
 */
export function viewportPresentationScale(viewport) {
  const width = Math.max(1, viewport?.width ?? 1)
  const height = Math.max(1, viewport?.height ?? 1)
  return clamp(Math.min(width / 1920, height / 1080), 0.8, 1.36)
}

/**
 * Fixed three-quarter projection used by both the renderer and its tests.
 * Simulation continues to live on the X/Z plane; only presentation compresses
 * depth so actors read as standing on the painted sanctuary floor.
 */
export function projectWorld(x, z, cameraX, cameraZ, viewport, out = {}) {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.height)
  // Sixty world units remain visible horizontally at both 1920x1080 and
  // 2560x1600. The previous 32px ceiling widened the latter to eighty units.
  const unit = clamp(width / 60, 19, 46) * clamp(viewport.zoom ?? 1, 0.85, 1.25)
  // Depth is derived from viewport height, not horizontal sprite scale. Using
  // `unit * .56` put a 25-unit spawn ring above the painted horizon on wide
  // screens, so wolves and floor props appeared to float in the sky. This keeps
  // the complete combat ring between the horizon and the near edge at every
  // supported aspect ratio while preserving horizontal readability.
  const depthUnit = clamp(height / 90, 7.5, 18) * clamp(viewport.zoom ?? 1, 0.85, 1.25)
  out.x = width * 0.5 + (x - cameraX) * unit
  out.y = height * 0.57 + (z - cameraZ) * depthUnit
  out.unit = unit
  out.depthUnit = depthUnit
  return out
}

/** Exact inverse used by click-to-move and visual contract tests. */
export function unprojectScreen(screenX, screenY, cameraX, cameraZ, viewport, out = {}) {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.height)
  const zoom = clamp(viewport.zoom ?? 1, 0.85, 1.25)
  const unit = clamp(width / 60, 19, 46) * zoom
  const depthUnit = clamp(height / 90, 7.5, 18) * zoom
  out.x = cameraX + (screenX - width * 0.5) / unit
  out.z = cameraZ + (screenY - height * 0.57) / depthUnit
  return out
}

/**
 * Let the heroine visibly cross a compact screen-space window before the
 * camera follows. Locking her to the exact focal point made valid world
 * movement read like a treadmill with a video sliding underneath it.
 */
export function cameraTargetWithDeadZone2D(
  cameraX,
  cameraZ,
  playerX,
  playerZ,
  viewport,
  moving = true,
  out = {},
) {
  const fromX = Number.isFinite(Number(cameraX)) ? Number(cameraX) : 0
  const fromZ = Number.isFinite(Number(cameraZ)) ? Number(cameraZ) : 0
  const targetX = Number.isFinite(Number(playerX)) ? Number(playerX) : fromX
  const targetZ = Number.isFinite(Number(playerZ)) ? Number(playerZ) : fromZ

  // Once the player releases movement, freeze the presentation camera where
  // it is. Finishing the previous follow interpolation after the heroine has
  // stopped makes only the floor and props drift for several more frames.
  if (!moving) {
    out.x = fromX
    out.z = fromZ
    return out
  }

  const screen = projectWorld(targetX, targetZ, fromX, fromZ, viewport, {})
  const centerX = Math.max(1, viewport?.width ?? 1) * 0.5
  const centerY = Math.max(1, viewport?.height ?? 1) * 0.57
  // The heroine must visibly traverse the arena before the camera moves. The
  // former 114px horizontal / 61px vertical window at the real Chrome viewport
  // was exhausted in a fraction of a stride and recreated the exact
  // "stationary actor over a scrolling video" failure reported in play.
  // These bounds still retain the full robe and sword inside compact windows.
  const deadZoneX = clamp(centerX * 0.26, 136, 260)
  const deadZoneY = clamp(Math.max(1, viewport?.height ?? 1) * 0.14, 72, 150)
  const offsetX = screen.x - centerX
  const offsetY = screen.y - centerY

  out.x = fromX
  out.z = fromZ
  if (offsetX > deadZoneX) out.x += (offsetX - deadZoneX) / screen.unit
  else if (offsetX < -deadZoneX) out.x += (offsetX + deadZoneX) / screen.unit
  if (offsetY > deadZoneY) out.z += (offsetY - deadZoneY) / screen.depthUnit
  else if (offsetY < -deadZoneY) out.z += (offsetY + deadZoneY) / screen.depthUnit
  return out
}

export function depthBucket(screenY, height, buckets = SORT_BUCKETS) {
  const normalized = clamp(screenY / Math.max(1, height), 0, 0.999999)
  return Math.floor(normalized * buckets)
}

/** Five authored directions; west-facing variants mirror their east partner. */
export function directionFor(angle) {
  const tau = Math.PI * 2
  const a = ((angle % tau) + tau) % tau
  const dx = Math.sin(a)
  const dz = Math.cos(a)
  const mirror = dx < -0.18
  const ax = Math.abs(dx)
  if (dz < -0.72) return { key: 'n', mirror }
  if (dz > 0.72) return { key: 's', mirror }
  if (ax > 0.78) return { key: 'e', mirror }
  return { key: dz < 0 ? 'ne' : 'se', mirror }
}

export function isOnScreen(screenX, screenY, viewport, margin = 160) {
  return screenX >= -margin
    && screenX <= viewport.width + margin
    && screenY >= -margin
    && screenY <= viewport.height + margin
}
