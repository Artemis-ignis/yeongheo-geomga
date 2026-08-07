import * as THREE from 'three'

/**
 * Camera rig offset from the player, tuned against captured frames: close enough
 * that the character reads at a glance, steep enough that a horde closing from
 * every side stays legible.
 */
// A slightly lower three-quarter angle gives the hero a readable torso and
// weapon silhouette while keeping enough ground visible for a survivor horde.
export const OFFSET = new THREE.Vector3(0, 8.0, 14.5)
const FOLLOW_LAMBDA = 8
const TRAUMA_DECAY = 1.6
const MAX_SHAKE = 0.9

/**
 * How far the player may pull the camera in or out.
 *
 * There was no zoom at all — one fixed rig, which is cramped on a small window
 * and wasteful on a large one, and there is no reason a player should not decide
 * how much of the field they want to see.
 *
 * The range is deliberately narrow at the near end: below about 0.8 the horde
 * arrives from outside the frame with no warning, which is not a preference,
 * it is a broken game.
 */
export const ZOOM_MIN = 0.8
export const ZOOM_MAX = 1.9
const ZOOM_STEP = 0.12
const ZOOM_LAMBDA = 12

const _target = new THREE.Vector3()
const _corner = new THREE.Vector3()
// The run HUD occupies the upper centre of the screen. Aim a little above the
// ground origin so the player's face and weapon settle below that DOM layer
// instead of being hidden behind the timer at the default survivor framing.
// The authored Seolryeong presentation shell is 4.55 units tall. A low target
// made her face and crown disappear behind the run timer, leaving only a white
// robe column in the survivor view. Aim through the upper torso so the face,
// sword hand and shoulder layers settle below the HUD without shrinking the
// hero or changing the combat collider.
const LOOK_TARGET_Y = 0.86

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
    // Portrait screens otherwise frame the shrine and player too tightly. A
    // wider rig keeps the incoming ring readable without changing spawn logic.
    const portraitZoom = aspect < 0.82 ? 1.42 : 1
    /**
     * What the player asked for, and where the rig actually is — eased, so a
     * wheel notch is a movement rather than a jump cut.
     */
    this.zoom = portraitZoom * 0.82
    this._zoom = portraitZoom
    this.setAspect(aspect)
    this.snapTo(0, 0)
  }

  /**
   * Pull the camera in or out. Clamped, and deliberately does not touch
   * `viewRadius`.
   *
   * `viewRadius` decides where enemies enter the arena, so letting zoom move it
   * would mean zooming out spawns them further away and zooming in brings them
   * closer — a difficulty slider disguised as a view preference. The spawn ring
   * stays measured at the default rig; zoom changes only what you can see.
   */
  setZoom(z) {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
    return this.zoom
  }

  nudgeZoom(steps) {
    return this.setZoom(this.zoom + steps * ZOOM_STEP)
  }

  setAspect(aspect) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    this._recomputeViewRadius()
  }

  /** Dev-time rig tuning; also recomputes the spawn ring. */
  setOffset(y, z, fov = this.camera.fov) {
    OFFSET.set(0, y, z)
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
    this._recomputeViewRadius()
    this._place()
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
    this._zoom += (this.zoom - this._zoom) * (1 - Math.exp(-ZOOM_LAMBDA * dt))
    this.time += dt
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY * dt)
    this._place()
  }

  /** Pulls the rig in toward the player for a hit punch. 0 = neutral. */
  setPunch(amount) {
    this.punch = amount
  }

  _place() {
    const shake = this.trauma * this.trauma * MAX_SHAKE
    const sx = Math.sin(this.time * 37.1) * shake
    const sy = Math.sin(this.time * 29.7 + 1.7) * shake
    // A punch scales the whole offset, so the camera dips toward the action.
    const k = (1 - (this.punch ?? 0) * 0.06) * this._zoom
    this.camera.position.set(
      this.x + OFFSET.x + sx,
      OFFSET.y * k + sy,
      this.z + OFFSET.z * k,
    )
    _target.set(this.x + sx * 0.4, LOOK_TARGET_Y, this.z)
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
    probe.lookAt(0, LOOK_TARGET_Y, 0)
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
    // A corner ray above the horizon means the ground view is unbounded. Clamp so
    // the spawn ring stays a usable distance instead of running off to infinity —
    // enemies spawning 200 units away would never reach the player.
    const raw = missed ? Math.max(maxDist, 60) : maxDist
    this.viewRadius = Math.min(raw, 90) + 6
  }
}
