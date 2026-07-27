const TARGET_MS = 16.7
const RAISE_MS = 13.0
const SAMPLES = 45
const SETTLE = 40

export const MIN_SCALE = 0.6
export const MAX_SCALE = 1.35

/**
 * Adaptive render resolution.
 *
 * The scene is fill-rate bound — a lot of large additive surfaces (mist, the
 * 결계, petals, formation rings, every VFX layer) overlap the whole screen. On a
 * high-DPI display a fixed pixel ratio of 2 means rendering four times the
 * pixels of a 1x buffer, and that is what makes it stutter rather than anything
 * in the simulation.
 *
 * So instead of guessing a ratio, measure frames and adjust: drop resolution
 * when frames run long, recover it when there is headroom. Only the backbuffer
 * scales — the HUD is DOM and stays crisp.
 */
export class Quality {
  constructor(renderer, { min = MIN_SCALE, max = MAX_SCALE } = {}) {
    this.renderer = renderer
    this.min = min
    this.max = max
    this.scale = Math.min(max, devicePixelRatio || 1)
    this.samples = new Float32Array(SAMPLES)
    this.cursor = 0
    this.cooldown = SETTLE
    this.locked = false
    this.changes = 0
  }

  /** Pin the resolution, e.g. when the player picks a fixed quality setting. */
  lock(scale) {
    this.locked = true
    this.scale = Math.max(this.min, Math.min(this.max, scale))
    this._apply()
  }

  unlock() {
    this.locked = false
    this.cooldown = SETTLE
  }

  /**
   * F4 cycles 자동 → 낮음 → 높음. Automatic adjustment is right for most
   * machines, but a player who can see it stuttering should be able to force the
   * issue without digging through code.
   */
  cycle() {
    if (!this.locked) { this.lock(this.min); this.mode = '낮음'; return this.mode }
    if (this.scale <= this.min) { this.lock(this.max); this.mode = '높음'; return this.mode }
    this.unlock()
    this.mode = '자동'
    return this.mode
  }

  get averageMs() {
    const n = Math.min(SAMPLES, this.cursor)
    if (n === 0) return 0
    let total = 0
    for (let i = 0; i < n; i++) total += this.samples[i]
    return total / n
  }

  _apply() {
    this.renderer.setPixelRatio(this.scale)
    // setPixelRatio alone does not resize the backbuffer; re-apply the CSS size.
    this.renderer.setSize(Math.max(1, innerWidth), Math.max(1, innerHeight), false)
    this.changes++
  }

  /** Feed one frame's duration in milliseconds. */
  sample(ms) {
    if (this.locked) return
    // Ignore hitches from tab switches and the first frames after a state change.
    if (ms > 250) return
    this.samples[this.cursor % SAMPLES] = ms
    this.cursor++

    if (this.cursor < SAMPLES) return
    if (this.cooldown > 0) { this.cooldown--; return }

    const avg = this.averageMs
    if (avg > TARGET_MS && this.scale > this.min) {
      this.scale = Math.max(this.min, this.scale - 0.15)
      this.cooldown = SETTLE
      this._apply()
    } else if (avg < RAISE_MS && this.scale < this.max) {
      // Recover slowly so it cannot oscillate against the drop threshold.
      this.scale = Math.min(this.max, this.scale + 0.05)
      this.cooldown = SETTLE * 2
      this._apply()
    }
  }
}
