import * as THREE from 'three'

/**
 * Surface detail — the 선협 equivalent of greebling.
 *
 * A lathe-turned robe is a smooth cone until something interrupts it. Real
 * garments and armour read as made because they carry seams, piping, fittings
 * and repeated hardware. These helpers emit `buildColored`-style parts, so any
 * model can be decorated without touching how it was built.
 *
 * Everything here is cheap: the parts merge into the same buffer as their host,
 * so an enemy with forty studs still costs one draw call.
 */

/** A ring band around a form — belts, collars, sleeve cuffs, armour rims. */
export function trimBand(radius, y, height, color, { taper = 1, segments = 16 } = {}) {
  return [
    new THREE.CylinderGeometry(radius * taper, radius, height, segments, 1, true),
    { y },
    color,
  ]
}

/**
 * Repeated hardware around a circle — studs, rivets, gems, lantern fittings.
 * The single strongest "this was manufactured" cue available.
 */
export function studRing(count, radius, y, color, {
  size = 0.03, shape = 'sphere', tilt = 0, phase = 0,
} = {}) {
  const parts = []
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2
    const geo = shape === 'box'
      ? new THREE.BoxGeometry(size * 2, size * 2.6, size)
      : shape === 'gem'
        ? new THREE.OctahedronGeometry(size, 0)
        : new THREE.SphereGeometry(size, 6, 5)
    parts.push([geo, {
      x: Math.cos(a) * radius,
      y,
      z: Math.sin(a) * radius,
      ry: -a,
      rx: tilt,
    }, color])
  }
  return parts
}

/**
 * A thin raised seam following a lathe profile, like piping stitched down the
 * front of a robe. `profile` is the same [radius, y] list the form was built
 * from.
 */
export function piping(profile, color, { thickness = 0.012, at = 0, lift = 1.01 } = {}) {
  const points = profile.map(([r, y]) => new THREE.Vector3(
    Math.cos(at) * r * lift, y, Math.sin(at) * r * lift,
  ))
  const curve = new THREE.CatmullRomCurve3(points)
  return [new THREE.TubeGeometry(curve, profile.length * 3, thickness, 5, false), {}, color]
}

/** Evenly spaced vertical seams around a form. */
export function panelSeams(count, profile, color, opts = {}) {
  const parts = []
  for (let i = 0; i < count; i++) {
    parts.push(piping(profile, color, { ...opts, at: (i / count) * Math.PI * 2 }))
  }
  return parts
}

/**
 * A shoulder or hem plate: a shallow curved shell, the sort of fitting that
 * breaks up a silhouette without adding a whole new mass.
 */
export function plate(radius, y, color, { arc = 0.9, thickness = 0.02, tiltX = 0 } = {}) {
  const geo = new THREE.SphereGeometry(
    radius, 12, 8, -arc / 2, arc, Math.PI * 0.32, Math.PI * 0.26,
  )
  void thickness
  return [geo, { y, rx: tiltX }, color]
}

/** A hanging tassel — cord plus a weighted end. Very 선협. */
export function tassel(x, y, z, length, cordColor, beadColor) {
  return [
    [new THREE.CylinderGeometry(0.008, 0.008, length, 5), { x, y: y - length / 2, z }, cordColor],
    [new THREE.OctahedronGeometry(0.035, 0), { x, y: y - length, z }, beadColor],
    [new THREE.ConeGeometry(0.028, 0.09, 6), { x, y: y - length - 0.06, z }, beadColor],
  ]
}
