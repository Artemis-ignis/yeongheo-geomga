import * as THREE from 'three'

const OFFSET = new THREE.Vector3(0, 26, 20)
const FOLLOW_LAMBDA = 8
const TRAUMA_DECAY = 1.6
const MAX_SHAKE = 0.9

const _target = new THREE.Vector3()
const _corner = new THREE.Vector3()

/**
 * Top-down 3/4 follow camera.
 *
 * Smoothing is exponential in dt (`1 - e^(-λ·dt)`) so it behaves identically at
 * 60Hz and 144Hz. Shake is driven by a decaying `trauma` value with deterministic
 * sine noise, never Math.random, so a seeded replay stays reproducible.
 */
export class FollowCamera {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 400)
    this.x = 0
    this.z = 0
    this.trauma = 0
    this.time = 0
    this.viewRadius = 40
    this.setAspect(aspect)
    this.snapTo(0, 0)
  }

  setAspect(aspect) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    this._recomputeViewRadius()
  }

  snapTo(x, z) {
    this.x = x
    this.z = z
    this._place()
  }

  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  update(x, z, dt) {
    const t = 1 - Math.exp(-FOLLOW_LAMBDA * dt)
    this.x += (x - this.x) * t
    this.z += (z - this.z) * t
    this.time += dt
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY * dt)
    this._place()
  }

  _place() {
    const shake = this.trauma * this.trauma * MAX_SHAKE
    const sx = Math.sin(this.time * 37.1) * shake
    const sy = Math.sin(this.time * 29.7 + 1.7) * shake
    this.camera.position.set(this.x + OFFSET.x + sx, OFFSET.y + sy, this.z + OFFSET.z)
    _target.set(this.x + sx * 0.4, 0, this.z)
    this.camera.lookAt(_target)
  }

  /**
   * World-space radius the frustum covers at ground level, used to spawn enemies
   * just off-screen at any window size. Computed by unprojecting the four NDC
   * corners onto y=0 — exact, and only re-run on resize.
   */
  _recomputeViewRadius() {
    // Measure from a neutral position so the result is independent of where the
    // camera currently is.
    const probe = this.camera.clone()
    probe.position.set(OFFSET.x, OFFSET.y, OFFSET.z)
    probe.lookAt(0, 0, 0)
    probe.updateMatrixWorld(true)

    let maxDist = 0
    let missed = false
    for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      _corner.set(nx, ny, 0.5).unproject(probe)
      const dir = _corner.sub(probe.position)
      if (dir.y >= -1e-4) { missed = true; continue }
      const k = -probe.position.y / dir.y
      const gx = probe.position.x + dir.x * k
      const gz = probe.position.z + dir.z * k
      maxDist = Math.max(maxDist, Math.hypot(gx, gz))
    }
    // A corner ray above the horizon means the view is effectively unbounded;
    // fall back to a generous ring rather than spawning enemies in view.
    this.viewRadius = (missed ? Math.max(maxDist, 70) : maxDist) + 6
  }
}
