import * as THREE from 'three'
import { mergeGeometries as threeMerge } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Geometry assembly helpers.
 *
 * Everything in the game is built from primitives at runtime, so the common move
 * is: create a few primitives, translate/rotate them into place, and merge them
 * into a single buffer that an InstancedMesh can draw in one call.
 */

/**
 * Merge parts into one buffer. Each part is `[geometry, {x,y,z, rx,ry,rz, sx,sy,sz}]`.
 *
 * Parts are normalised to non-indexed first: three's primitives are inconsistent
 * (polyhedra are non-indexed, cylinders and boxes are indexed) and mergeGeometries
 * refuses a mix. These props are small enough that the extra vertices are free.
 */
export function buildMerged(parts) {
  const prepared = []
  for (const [geo, t = {}] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    if (t.sx !== undefined || t.sy !== undefined || t.sz !== undefined) {
      g.scale(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1)
    }
    if (t.rx) g.rotateX(t.rx)
    if (t.ry) g.rotateY(t.ry)
    if (t.rz) g.rotateZ(t.rz)
    g.translate(t.x ?? 0, t.y ?? 0, t.z ?? 0)
    if (!g.attributes.uv) {
      // mergeGeometries requires matching attribute sets across all parts.
      const count = g.attributes.position.count
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
    }
    g.deleteAttribute('color')
    prepared.push(g)
  }
  const merged = threeMerge(prepared, false)
  for (const g of prepared) g.dispose()
  merged.computeBoundingSphere()
  return merged
}

export { threeMerge as mergeGeometries }
