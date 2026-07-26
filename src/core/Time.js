export const FIXED_DT = 1 / 60
const MAX_FRAME = 0.25
const MAX_TICKS = 5

/**
 * Fixed-timestep accumulator. Simulation never sees a variable dt, so balance is
 * identical at 60Hz and 144Hz.
 */
export class Clock {
  constructor() {
    this.accumulator = 0
  }

  /** Feed real elapsed seconds; returns how many fixed ticks to simulate. */
  step(realDt) {
    this.accumulator += Math.min(realDt, MAX_FRAME)
    let ticks = 0
    while (this.accumulator >= FIXED_DT && ticks < MAX_TICKS) {
      this.accumulator -= FIXED_DT
      ticks++
    }
    // Hit the tick cap: drop the backlog rather than banking it forever.
    if (this.accumulator >= FIXED_DT) this.accumulator = FIXED_DT * 0.999
    return ticks
  }

  /** Fractional progress toward the next tick, for render interpolation. */
  get alpha() {
    return this.accumulator / FIXED_DT
  }

  reset() {
    this.accumulator = 0
  }
}
