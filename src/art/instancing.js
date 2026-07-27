/**
 * Upload only the live slice of an InstancedMesh's buffers.
 *
 * An InstancedMesh allocates its attribute buffers at full capacity, and setting
 * `needsUpdate` re-uploads all of it — for our pools that is 900 enemies, 1200
 * projectiles and 1500 pickups worth of matrices every frame even when a
 * handful are alive. Across every mesh that came to ~1.2 MB per frame of pure
 * bus traffic, which was by far the largest cost in the frame.
 *
 * `addUpdateRange` narrows the upload to the range actually written.
 */
export function uploadInstances(mesh, count, colorDirty = false) {
  const m = mesh.instanceMatrix
  m.clearUpdateRanges()
  if (count > 0) m.addUpdateRange(0, count * 16)
  m.needsUpdate = count > 0

  const c = mesh.instanceColor
  if (c && colorDirty) {
    c.clearUpdateRanges()
    if (count > 0) c.addUpdateRange(0, count * 3)
    c.needsUpdate = count > 0
  }
}
