const TAU = Math.PI * 2

/** Keep the roster split and the ingress lane split on the same contract. */
export const ENEMY_PACK_PRIMARY_RATIO_2D = 0.60

/** Conservative projected half-extents of the playable 2D envelope. */
export const ENEMY_INGRESS_VIEW_ENVELOPE_2D = Object.freeze({
  radiusX: 29,
  radiusZ: 28,
})

export const ENEMY_INGRESS_GEOMETRY_2D = Object.freeze({
  radiusXMin: 36,
  radiusXMax: 41,
  radiusZMin: 42,
  radiusZMax: 47,
  primaryArcRadians: 0.34,
  secondaryArcOffsetMin: 0.72,
  secondaryArcOffsetMax: 1.08,
  angularJitter: 0.035,
})

/** Formation bodies must remain a coherent set-piece while they travel in. */
export const FORMATION_INGRESS_ARRIVAL_SECONDS_2D = 0.8

// A formation warning is a directional ground accent, not a second authored
// ring around the heroine. Keep its centre just inside the projected edge and
// its radius small enough that the accent stays within that visible envelope.
export const FORMATION_WARNING_EDGE_INSET_2D = 3.5
export const FORMATION_WARNING_RADIUS_MIN_2D = 1.8
export const FORMATION_WARNING_RADIUS_MAX_2D = 3.0
export const FORMATION_WARNING_RADIUS_SCALE_2D = 0.16

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

/**
 * Conservative lower-bound travel time from the nearest ingress axis to the
 * gameplay envelope. This keeps the spawn-delay contract testable without
 * depending on renderer projection internals.
 */
export function enemyIngressArrivalDelaySeconds2D(
  speed,
  geometry = ENEMY_INGRESS_GEOMETRY_2D,
) {
  const safeSpeed = Math.max(0.001, Math.abs(finite(speed, 0)))
  const radiusX = Math.max(0, finite(geometry?.radiusXMin, 0))
  const radiusZ = Math.max(0, finite(geometry?.radiusZMin, 0))
  return Math.min(radiusX, radiusZ) / safeSpeed
}

function packT(index, count) {
  if (count <= 1) return 0
  return index / (count - 1) * 2 - 1
}

function formationLocalPoints(event) {
  const radius = Math.max(0, finite(event?.radius, 0))
  const angles = Array.isArray(event?.angles) ? event.angles : []
  return angles.map((angle) => ({
    x: Math.sin(finite(angle)) * radius,
    z: Math.cos(finite(angle)) * radius,
  }))
}

/**
 * Rigidly translate an authored formation to one off-screen ingress side.
 *
 * The returned points share the exact local coordinates of the original
 * ring/wall/pincer. Only the carrier centre changes, so pairwise distances,
 * wall arcs and pincer gaps remain authored rather than collapsing into a
 * generic pack. The closest point clears the projected envelope by enough
 * world distance to guarantee the requested arrival delay at the supplied
 * enemy speed.
 */
export function formationIngressTransform2D(
  event,
  anchor = { x: 0, z: 0 },
  {
    speed = 1,
    arrivalSeconds = FORMATION_INGRESS_ARRIVAL_SECONDS_2D,
    side = null,
  } = {},
) {
  const localPoints = formationLocalPoints(event)
  const extentX = localPoints.reduce((max, point) => Math.max(max, Math.abs(point.x)), 0)
  const safeSpeed = Math.max(0.001, Math.abs(finite(speed, 1)))
  const safeArrival = Math.max(
    FORMATION_INGRESS_ARRIVAL_SECONDS_2D,
    Math.max(0, finite(arrivalSeconds, FORMATION_INGRESS_ARRIVAL_SECONDS_2D)),
  )
  const anchorX = finite(anchor?.x)
  const anchorZ = finite(anchor?.z)
  const ingressSide = side === null || side === undefined
    ? ((finite(event?.seed, 0) >>> 0) & 1 ? 1 : -1)
    : (Number(side) >= 0 ? 1 : -1)
  const envelopeEdge = ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX + 0.5
  const nearestPointEdge = envelopeEdge + safeSpeed * safeArrival
  const centerX = anchorX + ingressSide * (nearestPointEdge + extentX)
  const centerZ = anchorZ
  const points = localPoints.map((point) => Object.freeze({
    x: centerX + point.x,
    z: centerZ + point.z,
  }))
  return Object.freeze({
    centerX,
    centerZ,
    anchorX,
    anchorZ,
    side: ingressSide,
    rotation: 0,
    speed: safeSpeed,
    arrivalSeconds: safeArrival,
    localPoints: Object.freeze(localPoints.map((point) => Object.freeze(point))),
    points: Object.freeze(points),
  })
}

/** Measure the slowest member's time from ingress to the projected envelope. */
export function formationIngressArrivalDelaySeconds2D(transform, speed = transform?.speed) {
  const points = Array.isArray(transform?.points) ? transform.points : []
  if (points.length === 0) return 0
  const safeSpeed = Math.max(0.001, Math.abs(finite(speed, 1)))
  const edgeX = ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX + 0.5
  const edgeZ = ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusZ + 0.5
  const clearance = Math.min(...points.map((point) => Math.max(
    Math.abs(point.x - finite(transform.anchorX)) - edgeX,
    Math.abs(point.z - finite(transform.anchorZ)) - edgeZ,
  )))
  return Math.max(0, clearance) / safeSpeed
}

/**
 * Place a restrained, visible warning for a travelling formation.
 *
 * The actual members enter from one deterministic side. The warning therefore
 * sits just inside that same side of the projected envelope, rather than at
 * the authored player-centred event anchor. It is intentionally independent
 * of the large authored formation radius so a ring cannot become a debug
 * gizmo around the heroine.
 */
export function formationIngressWarning2D(event, transform, anchor = null) {
  const source = transform ?? {}
  const anchorX = finite(anchor?.x, finite(source.anchorX, 0))
  const anchorZ = finite(anchor?.z, finite(source.anchorZ, 0))
  const side = Number(source.side) >= 0 ? 1 : -1
  const envelopeEdgeX = ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX
  const inset = FORMATION_WARNING_EDGE_INSET_2D
  const radius = Math.max(
    FORMATION_WARNING_RADIUS_MIN_2D,
    Math.min(
      FORMATION_WARNING_RADIUS_MAX_2D,
      Math.abs(finite(event?.radius, 0)) * FORMATION_WARNING_RADIUS_SCALE_2D,
    ),
  )
  const x = anchorX + side * Math.max(0, envelopeEdgeX - inset)
  const z = anchorZ
  return Object.freeze({
    x,
    z,
    radius,
    side,
    envelopeEdgeX: anchorX + side * envelopeEdgeX,
    envelopeEdgeZ: anchorZ,
    inset,
  })
}

/**
 * Give each ingress pulse a dominant silhouette and at most one supporting
 * silhouette. Cycling every body through the full roster made a four-enemy
 * pulse look like unrelated assets appearing together, even when the stage
 * roster itself was valid.
 */
export function enemyPackTypeAt2D(
  types,
  index,
  count,
  offset = 0,
  primaryRatio = ENEMY_PACK_PRIMARY_RATIO_2D,
) {
  const roster = Array.isArray(types) && types.length ? types : ['wisp']
  const safeCount = Math.max(1, Math.floor(finite(count, 1)))
  const safeIndex = Math.max(0, Math.min(safeCount - 1, Math.floor(finite(index))))
  const primaryCount = Math.max(1, Math.min(
    safeCount,
    Math.round(safeCount * Math.max(0.5,
      Math.min(1, finite(primaryRatio, ENEMY_PACK_PRIMARY_RATIO_2D)))),
  ))
  const start = ((Math.floor(finite(offset)) % roster.length) + roster.length) % roster.length
  return safeIndex < primaryCount
    ? roster[start]
    : roster[(start + 1) % roster.length]
}

/**
 * Deterministic elliptical off-screen ingress.
 *
 * The screen projection has different horizontal and depth scales, so a
 * circular simulation ring is not reliably off-screen. This ellipse follows
 * the actual 2D projection envelope. Each pulse occupies one short arc (and an
 * optional adjacent arc), creating a readable direction of pressure instead
 * of materialising bodies all around the heroine.
 */
export class EnemySpawnDirector2D {
  constructor(rng, geometry = ENEMY_INGRESS_GEOMETRY_2D) {
    this.rng = rng
    this.geometry = geometry
    this.primaryAngle = 0
    this.secondaryAngle = 0
  }

  beginPulse() {
    this.primaryAngle = this.rng.range(0, TAU)
    const sign = this.rng.chance(0.5) ? 1 : -1
    this.secondaryAngle = this.primaryAngle + sign * this.rng.range(
      this.geometry.secondaryArcOffsetMin,
      this.geometry.secondaryArcOffsetMax,
    )
    return this
  }

  point(player, index, count, secondary = false, out = {}) {
    const center = secondary ? this.secondaryAngle : this.primaryAngle
    const lane = packT(Math.max(0, index | 0), Math.max(1, count | 0))
    const angle = center
      + lane * this.geometry.primaryArcRadians
      + this.rng.range(-this.geometry.angularJitter, this.geometry.angularJitter)
    const radiusX = this.rng.range(this.geometry.radiusXMin, this.geometry.radiusXMax)
    const radiusZ = this.rng.range(this.geometry.radiusZMin, this.geometry.radiusZMax)
    let offsetX = Math.cos(angle) * radiusX
    let offsetZ = Math.sin(angle) * radiusZ
    // A radial ellipse can be outside the nominal radius while still landing
    // inside the rectangular screen at a diagonal. Push only those samples to
    // the nearest outside edge; the half-unit clearance prevents sprite
    // bounds from peeking in at the exact viewport edge.
    const minOutsideX = ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusX + 0.5
    const minOutsideZ = ENEMY_INGRESS_VIEW_ENVELOPE_2D.radiusZ + 0.5
    const absX = Math.abs(offsetX)
    const absZ = Math.abs(offsetZ)
    if (absX < minOutsideX && absZ < minOutsideZ) {
      const scale = Math.max(
        minOutsideX / Math.max(absX, 0.001),
        minOutsideZ / Math.max(absZ, 0.001),
      )
      offsetX *= scale
      offsetZ *= scale
    }
    out.x = finite(player?.x) + offsetX
    out.z = finite(player?.z) + offsetZ
    out.angle = angle
    return out
  }
}

export function enemyPopulationBudget2D(runTime, bossActive = false) {
  const seconds = Math.max(0, finite(runTime))
  // The old 40 -> 100 cap allowed a slow fixed-seed route to spawn fewer than
  // 475 bodies by the 180s checkpoint, making the commercial-density gate
  // mathematically unreachable. Keep the readable pack size, but let defeated
  // bodies refill a larger population envelope over time.
  const normalBudget = Math.min(240, 64 + Math.floor(seconds / 60) * 40)
  return bossActive ? Math.min(normalBudget, 96) : normalBudget
}
