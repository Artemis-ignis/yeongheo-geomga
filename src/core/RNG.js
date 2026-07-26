/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 * All gameplay randomness goes through this so runs are reproducible from a seed.
 */
export class RNG {
  constructor(seed) {
    this.seed = seed >>> 0
    this.state = this.seed
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(maxExclusive) {
    return Math.floor(this.next() * maxExclusive)
  }

  range(min, max) {
    return min + this.next() * (max - min)
  }

  pick(array) {
    return array[this.int(array.length)]
  }

  chance(p) {
    if (p <= 0) return false
    if (p >= 1) return true
    return this.next() < p
  }

  /** Uniform angle in radians — used constantly for spawn rings and fans. */
  angle() {
    return this.next() * Math.PI * 2
  }
}

export function makeSeed() {
  return (Math.random() * 4294967296) >>> 0
}
