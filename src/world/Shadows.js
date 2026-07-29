import * as THREE from 'three'
import { uploadInstances } from '../art/instancing.js'

export const MAX_SHADOWS = 1200

const _dummy = new THREE.Object3D()

let _tex = null

/**
 * A contact shadow needs a mostly solid core with a soft edge. The glow texture
 * used elsewhere falls off exponentially from the very centre, which is right
 * for a light source and wrong here — as a shadow it is almost entirely
 * transparent and reads as a smudge.
 */
function shadowTexture() {
  if (_tex) return _tex
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0.00, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.94)')
  g.addColorStop(0.72, 'rgba(255,255,255,0.52)')
  g.addColorStop(1.00, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  _tex = new THREE.CanvasTexture(canvas)
  _tex.colorSpace = THREE.SRGBColorSpace
  return _tex
}

/**
 * Contact shadows for everything that stands on the ground.
 *
 * The sun already casts a real shadow map, but the horde deliberately does not
 * cast into it — a few hundred instanced creatures through a shadow pass is not
 * worth the frame time, and at this camera distance each one would land on two
 * or three shadow-map texels and read as mush anyway.
 *
 * So the crowd gets blob shadows instead: one instanced quad per creature with a
 * soft radial falloff, laid flat just above the ground. It is a single draw call
 * for the entire field, and it is the difference between creatures standing on
 * the plateau and creatures pasted over a picture of one.
 */
export class Shadows {
  constructor(scene, capacity = MAX_SHADOWS) {
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)

    this.material = new THREE.MeshBasicMaterial({
      map: shadowTexture(),
      // Not pure black: a shadow on a lit field is the ground colour darkened,
      // and pure black on a teal plateau reads as a hole cut in the world.
      color: 0x0d1712,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      // No distance fog. The scene fog lightens the shadow by exactly as much as
      // it lightens the ground beneath it, which cancels the contrast out and
      // leaves the blob invisible — the bug this comment exists to prevent.
      // A contact shadow is a darkening of whatever it lands on, not a surface
      // sitting at its own depth.
      fog: false,
    })

    this.mesh = new THREE.InstancedMesh(geo, this.material, capacity)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
    this.mesh.count = 0
    this.capacity = capacity
    this.n = 0
    scene.add(this.mesh)
  }

  /** Restyle for a stage whose ground is not jade. */
  setPalette(palette = {}) {
    if (palette.ground !== undefined) {
      this.material.color.set(palette.ground).multiplyScalar(0.45)
    }
  }

  begin() {
    this.n = 0
  }

  /**
   * `lift` raises the blob for something airborne, which both softens and
   * shrinks it — that separation is what sells 재까마귀 as flying.
   */
  add(x, z, radius, lift = 0) {
    if (this.n >= this.capacity) return
    const spread = radius * (2.6 + lift * 0.9)
    _dummy.position.set(x, 0.035, z)
    _dummy.rotation.set(0, 0, 0)
    _dummy.scale.set(spread, 1, spread)
    _dummy.updateMatrix()
    this.mesh.setMatrixAt(this.n, _dummy.matrix)
    this.n++
  }

  end() {
    this.mesh.count = this.n
    uploadInstances(this.mesh, this.n)
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.mesh.parent?.remove(this.mesh)
  }
}
