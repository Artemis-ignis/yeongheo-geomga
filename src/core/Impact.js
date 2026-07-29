/**
 * Hit feel.
 *
 * Damage numbers going up is information; *impact* is what makes a hit feel
 * like it landed. Three cheap effects carry almost all of it:
 *
 * - hitstop: freeze the simulation for a few frames on a heavy hit, so the blow
 *   reads as a collision rather than a number changing.
 * - a brief zoom punch on the camera.
 * - a full-screen flash when the player is hurt or a boss changes phase.
 *
 * Everything here is time-based and framerate-independent.
 */
export class Impact {
  constructor() {
    this.freeze = 0
    this.zoom = 0
    this.flash = 0
    this.flashColor = [1, 0.3, 0.3]
  }

  /** Freeze the simulation briefly. Called for boss hits, kills, breakthroughs. */
  hitstop(seconds) {
    this.freeze = Math.max(this.freeze, Math.min(0.12, seconds))
  }

  /** Positive punches the camera in, negative pushes it out. */
  punch(amount) {
    this.zoom = Math.max(this.zoom, amount)
  }

  screenFlash(strength, r = 1, g = 0.3, b = 0.3) {
    this.flash = Math.max(this.flash, strength)
    this.flashColor[0] = r
    this.flashColor[1] = g
    this.flashColor[2] = b
  }

  /** Returns true while the simulation should stay frozen. */
  get frozen() {
    return this.freeze > 0
  }

  /**
   * Advanced with real time, never simulation time — hitstop has to keep
   * counting down while the simulation it is pausing is not running.
   */
  update(realDt) {
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - realDt)
    if (this.zoom > 0) this.zoom = Math.max(0, this.zoom - realDt * 3.2)
    if (this.flash > 0) this.flash = Math.max(0, this.flash - realDt * 3.6)
  }

  reset() {
    this.freeze = 0
    this.zoom = 0
    this.flash = 0
  }
}
