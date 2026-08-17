export const SORT_BUCKETS = 64
export const WORLD_FOCAL_Y_RATIO_2D = 0.54
export const WORLD_DEPTH_RATIO_2D = 0.62

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
export function createWorldFrame2D(cameraX, cameraZ, viewport, out = {}) {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.height)
  const zoom = clamp(viewport.zoom ?? 1, 0.85, 1.25)
  // A single frame owns every world-to-screen conversion for the rendered
  // image. The old 0.37 depth scale crushed enemies and props into the same
  // horizontal bands. A 0.62 floor ratio keeps the three-quarter view while
  // restoring enough world depth for readable crowd spacing.
  const unit = clamp(Math.min(width / 58, height / 33), 19, 46) * zoom
  const depthUnit = unit * WORLD_DEPTH_RATIO_2D
  out.cameraX = Number(cameraX) || 0
  out.cameraZ = Number(cameraZ) || 0
  out.originX = width * 0.5
  out.originY = height * WORLD_FOCAL_Y_RATIO_2D
  out.width = width
  out.height = height
  out.unit = unit
  out.depthUnit = depthUnit
  return out
}

export function projectWorldWithFrame2D(x, z, frame, out = {}) {
  out.x = frame.originX + (x - frame.cameraX) * frame.unit
  out.y = frame.originY + (z - frame.cameraZ) * frame.depthUnit
  out.unit = frame.unit
  out.depthUnit = frame.depthUnit
  return out
}

export function projectWorld(x, z, cameraX, cameraZ, viewport, out = {}) {
  const frame = createWorldFrame2D(cameraX, cameraZ, viewport, {})
  return projectWorldWithFrame2D(x, z, frame, out)
}

/** Exact inverse used by click-to-move and visual contract tests. */
export function unprojectScreen(screenX, screenY, cameraX, cameraZ, viewport, out = {}) {
  const frame = createWorldFrame2D(cameraX, cameraZ, viewport, {})
  out.x = frame.cameraX + (screenX - frame.originX) / frame.unit
  out.z = frame.cameraZ + (screenY - frame.originY) / frame.depthUnit
  return out
}

/**
 * Resolve the only camera-dependent offset allowed for the tiled ground.
 *
 * The floor is a world material, not a screen-space animation. Keeping this
 * calculation beside `projectWorld` makes it impossible for the ground to
 * acquire a second time-based drift that the actor/prop layers do not share.
 */
export function groundTileOffset2D(cameraX, cameraZ, viewport, tileScaleX = 1, tileScaleY = 1, out = {}) {
  const frame = createWorldFrame2D(cameraX, cameraZ, viewport, {})
  return groundTileOffsetFromFrame2D(frame, tileScaleX, tileScaleY, out)
}

export function groundTileOffsetFromFrame2D(frame, _tileScaleX = 1, _tileScaleY = 1, out = {}) {
  // `tilePosition` is already expressed in the TilingSprite's local pixels.
  // Its tileScale is a separate texture transform, so dividing by it here
  // makes the material drift at a different rate from projected actors.
  // Keep the legacy arguments for the existing call sites, but make the
  // camera displacement exactly the same as the shared world frame.
  out.x = -frame.cameraX * frame.unit
  out.y = -frame.cameraZ * frame.depthUnit
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
