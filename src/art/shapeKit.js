import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Geometry helpers for building creatures out of code.
 *
 * Two things separate "a pile of primitives" from "a model": organic shapes that
 * follow a curve rather than a box, and colour that varies across the surface.
 * `buildColored` bakes a colour per part into vertex colours, so one material
 * draws a creature with a dark back, a pale belly and glowing eyes.
 */

const _c = new THREE.Color()

/** Paint every vertex of a geometry a single colour. */
export function paint(geometry, hex) {
  const count = geometry.attributes.position.count
  const colors = new Float32Array(count * 3)
  _c.setHex(hex)
  for (let i = 0; i < count; i++) {
    colors[i * 3 + 0] = _c.r
    colors[i * 3 + 1] = _c.g
    colors[i * 3 + 2] = _c.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/**
 * Blend a second colour in along an axis — a cheap way to get a shaded belly or
 * a gradient from root to tip without a texture.
 */
export function gradient(geometry, fromHex, toHex, axis = 'y') {
  const pos = geometry.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const a = new THREE.Color(fromHex)
  const b = new THREE.Color(toHex)
  let lo = Infinity
  let hi = -Infinity
  const idx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1
  for (let i = 0; i < pos.count; i++) {
    const v = pos.array[i * 3 + idx]
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const span = hi - lo || 1
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.array[i * 3 + idx] - lo) / span
    _c.copy(a).lerp(b, t)
    colors[i * 3 + 0] = _c.r
    colors[i * 3 + 1] = _c.g
    colors[i * 3 + 2] = _c.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/** Push vertices around a little so a primitive stops looking machined. */
export function roughen(geometry, amount = 0.05, seed = 1) {
  const pos = geometry.attributes.position
  let s = seed
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647 - 0.5
  }
  for (let i = 0; i < pos.count; i++) {
    pos.array[i * 3 + 0] += rnd() * amount
    pos.array[i * 3 + 1] += rnd() * amount
    pos.array[i * 3 + 2] += rnd() * amount
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Lean a shape along Z as a function of height.
 *
 * A lathed body is axially symmetric, so it reads as the same blob from every
 * angle no matter how much detail is bolted to the front. Shearing it gives the
 * silhouette a front and a back, which is the cheapest way to make a lathe
 * survive being seen from the side.
 */
export function shear(geometry, amount, { from = 0 } = {}) {
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.array[i * 3 + 1]
    if (y <= from) continue
    pos.array[i * 3 + 2] += (y - from) * amount
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/** Squash or stretch a shape along Z as a function of height — taper a hem, flare a hood. */
export function flare(geometry, atY, amount) {
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.array[i * 3 + 1]
    const k = 1 + amount * Math.max(0, 1 - Math.abs(y - atY) * 2)
    pos.array[i * 3 + 2] *= k
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/** A tapered tube following a list of points — limbs, tails, horns, hair. */
export function limb(points, radii, segments = 14, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  const geo = new THREE.TubeGeometry(curve, segments, 1, radial, false)
  // TubeGeometry has a constant radius, so rescale each ring to taper it.
  const pos = geo.attributes.position
  const ringCount = segments + 1
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    // Piecewise-linear through the supplied radii.
    const f = t * (radii.length - 1)
    const i0 = Math.min(radii.length - 1, Math.floor(f))
    const i1 = Math.min(radii.length - 1, i0 + 1)
    const r = radii[i0] + (radii[i1] - radii[i0]) * (f - i0)
    const centre = curve.getPointAt(t)
    for (let j = 0; j <= radial; j++) {
      const vi = i * (radial + 1) + j
      const x = pos.array[vi * 3 + 0] - centre.x
      const y = pos.array[vi * 3 + 1] - centre.y
      const z = pos.array[vi * 3 + 2] - centre.z
      pos.array[vi * 3 + 0] = centre.x + x * r
      pos.array[vi * 3 + 1] = centre.y + y * r
      pos.array[vi * 3 + 2] = centre.z + z * r
    }
  }
  void ringCount
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** A lathe from a [radius, y] profile — bodies, robes, pots. */
export function revolve(profile, segments = 16) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y))
  const geo = new THREE.LatheGeometry(pts, segments)
  geo.computeVertexNormals()
  return geo
}

/**
 * Merge coloured parts into one buffer.
 *
 * Each part is `[geometry, transform, colorHexOrNull]`. Parts that already carry
 * a colour attribute (from `gradient`) keep it.
 */
export function buildColored(parts) {
  const prepared = []
  for (const [geo, t = {}, hex] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    if (t.sx !== undefined || t.sy !== undefined || t.sz !== undefined) {
      g.scale(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1)
    }
    if (t.rx) g.rotateX(t.rx)
    if (t.ry) g.rotateY(t.ry)
    if (t.rz) g.rotateZ(t.rz)
    g.translate(t.x ?? 0, t.y ?? 0, t.z ?? 0)

    if (!g.attributes.uv) {
      const count = g.attributes.position.count
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
    }
    if (hex !== undefined && hex !== null) paint(g, hex)
    if (!g.attributes.color) paint(g, 0xffffff)
    prepared.push(g)
  }
  const merged = mergeGeometries(prepared, false)
  for (const g of prepared) g.dispose()
  merged.computeBoundingSphere()
  return merged
}
