import { describe, it, expect } from 'vitest'
import { FORMATIONS, formationAngles } from '../src/data/formations.js'
import { ENEMY_INDEX } from '../src/data/enemies.js'
import { RUN_SECONDS } from '../src/data/waves.js'

/**
 * 진 are the run's texture. The wave table gives a correct average and no
 * shape — measured over full runs, whole minutes pass at zero danger not
 * because too little spawns but because nothing ever arrives together.
 *
 * `formationAngles` is pure, so the shapes are checkable without a scene. What
 * matters is that each named kind is actually a different shape: a "ring" that
 * left a gap, or a "wall" that quietly surrounded her, would play as the same
 * drizzle it was meant to break up.
 */

/** Largest angular gap between consecutive members, in radians. */
function widestGap(angles) {
  const sorted = angles.map((a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((x, y) => x - y)
  let worst = sorted[0] + Math.PI * 2 - sorted[sorted.length - 1]
  for (let i = 1; i < sorted.length; i++) worst = Math.max(worst, sorted[i] - sorted[i - 1])
  return worst
}

describe('formation shapes', () => {
  it('closes a ring all the way round', () => {
    const a = formationAngles('ring', 16, 0)
    expect(a).toHaveLength(16)
    // No gap wider than a comfortable stride: a ring with a hole in it is just
    // an arc, and she walks out of it without ever making a decision.
    expect(widestGap(a)).toBeLessThan(0.5)
  })

  it('leaves a wall open behind her', () => {
    const a = formationAngles('wall', 12, 0, 1.5)
    // Everything inside the stated arc, on the side she is heading.
    for (const x of a) expect(Math.abs(x)).toBeLessThanOrEqual(1.5 / 2 + 1e-9)
    // And therefore a way out: the gap is the rest of the circle.
    expect(widestGap(a)).toBeGreaterThan(Math.PI)
  })

  it('gives a pincer two arms and two ways out', () => {
    const a = formationAngles('pincer', 18, 0, 1.1)
    const ahead = a.filter((x) => Math.abs(Math.atan2(Math.sin(x), Math.cos(x))) < Math.PI / 2)
    expect(ahead.length, 'one arm swallowed the other').toBeGreaterThan(a.length / 3)
    expect(ahead.length).toBeLessThan((a.length * 2) / 3)
    // Two gaps, at the sides — each smaller than a wall's single opening.
    expect(widestGap(a)).toBeGreaterThan(0.8)
    expect(widestGap(a)).toBeLessThan(Math.PI)
  })

  it('orients to where she is running', () => {
    for (const kind of ['wall', 'pincer']) {
      const north = formationAngles(kind, 10, 0, 1.4)
      const east = formationAngles(kind, 10, Math.PI / 2, 1.4)
      for (let i = 0; i < north.length; i++) {
        expect(east[i] - north[i]).toBeCloseTo(Math.PI / 2, 6)
      }
    }
  })

  it('handles a single member without dividing by zero', () => {
    for (const kind of ['ring', 'wall', 'pincer']) {
      const a = formationAngles(kind, 1, 0, 1.4)
      expect(a).toHaveLength(1)
      expect(Number.isFinite(a[0]), `${kind} produced ${a[0]}`).toBe(true)
    }
  })
})

describe('the formation timeline', () => {
  it('names only enemies that exist', () => {
    for (const f of FORMATIONS) {
      expect(ENEMY_INDEX.has(f.type), `"${f.type}" is not in the enemy table`).toBe(true)
    }
  })

  it('is ordered, so the spawner can walk it with one index', () => {
    for (let i = 1; i < FORMATIONS.length; i++) {
      expect(FORMATIONS[i].t).toBeGreaterThan(FORMATIONS[i - 1].t)
    }
  })

  it('stays inside the run', () => {
    expect(FORMATIONS[0].t).toBeGreaterThan(30)
    expect(FORMATIONS[FORMATIONS.length - 1].t).toBeLessThan(RUN_SECONDS)
  })

  it('stays an event rather than becoming the background', () => {
    // Roughly one every ninety seconds. Any tighter and a 진 stops reading as an
    // interruption, which is the only thing it is for.
    for (let i = 1; i < FORMATIONS.length; i++) {
      expect(FORMATIONS[i].t - FORMATIONS[i - 1].t, `${FORMATIONS[i].t}s crowds the one before`).toBeGreaterThanOrEqual(60)
    }
    expect(FORMATIONS.length / (RUN_SECONDS / 60)).toBeLessThan(1)
  })

  it('spawns inside the 결계 but outside arm\'s reach', () => {
    for (const f of FORMATIONS) {
      expect(f.radius).toBeGreaterThan(10)
      expect(f.radius).toBeLessThan(20)
      expect(f.count).toBeGreaterThan(8)
    }
  })
})
