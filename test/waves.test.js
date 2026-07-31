import { describe, it, expect } from 'vitest'
import { WAVES, RUN_SECONDS, waveAt, BOSS_SCHEDULE } from '../src/data/waves.js'
import { ENEMIES } from '../src/data/enemies.js'

const enemyIds = new Set(ENEMIES.map((e) => e.id))

describe('wave timeline', () => {
  it('starts at t=0', () => {
    expect(WAVES[0].t).toBe(0)
  })

  it('is strictly increasing in t', () => {
    for (let i = 1; i < WAVES.length; i++) {
      expect(WAVES[i].t).toBeGreaterThan(WAVES[i - 1].t)
    }
  })

  it('covers the whole 15-minute run', () => {
    expect(RUN_SECONDS).toBe(900)
    expect(WAVES[WAVES.length - 1].t).toBeLessThanOrEqual(RUN_SECONDS)
  })

  it('has no gap larger than 60 seconds', () => {
    for (let i = 1; i < WAVES.length; i++) {
      expect(WAVES[i].t - WAVES[i - 1].t).toBeLessThanOrEqual(60)
    }
  })

  it('only references known enemy ids', () => {
    for (const w of WAVES) {
      for (const id of w.types ?? []) expect(enemyIds.has(id)).toBe(true)
    }
  })

  it('lets every band spawn something', () => {
    for (const w of WAVES) {
      expect(w.types.length).toBeGreaterThan(0)
      expect(w.spawnInterval).toBeGreaterThan(0)
      expect(w.perSpawn).toBeGreaterThan(0)
    }
  })

  it('schedules both bosses at the specified times', () => {
    expect(WAVES.find((w) => w.t === 480)?.boss).toBe('blueWolfKing')
    expect(WAVES.find((w) => w.t === 900)?.boss).toBe('darkHeavenLord')
    expect(BOSS_SCHEDULE).toEqual([
      { t: 480, id: 'blueWolfKing' },
      { t: 900, id: 'darkHeavenLord' },
    ])
  })

  it('never eases off on spawn pressure outside boss bands', () => {
    const rates = WAVES.filter((w) => !w.boss).map((w) => w.perSpawn / w.spawnInterval)
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1])
    }
  })

  /**
   * The shape of the curve, not just its monotonicity.
   *
   * Every assertion above passed against a table that produced no threat for
   * eleven of a run's fifteen minutes — a scripted player finished it with her
   * health never below 94% — because "never eases off" is satisfied by a curve
   * that rises far too slowly to matter. These pin the two ends that the
   * measurement actually cared about.
   */
  const rateAt = (t) => { const w = waveAt(t); return w.perSpawn / w.spawnInterval }

  it('puts something in the opening without burying a level-1 법보', () => {
    // This used to assert the opening stayed under 2 spawns a second, on the
    // theory that a single starting weapon cannot clear a crowd. Measured on a
    // fresh save — no 단전, which is what a first run is — that produced two and
    // a half minutes in which nothing came within contact range at all, and a
    // death at 4:11 the moment 석귀 arrived. Both ends are pinned now: enough to
    // fight, not enough to drown.
    expect(rateAt(0)).toBeGreaterThan(3)
    expect(rateAt(0)).toBeLessThan(5)
    // And it must not open at anything like the closing pressure.
    expect(rateAt(0)).toBeLessThan(rateAt(870) / 10)
  })

  it('closes with a swarm, which is what her plateaued build has left to fight', () => {
    // Her power plateaus around minute ten: six 법보 and six 공법 all cap at
    // level 5. Enemy health cannot answer that without killing her at four
    // minutes on the way up, so the late game has to come from numbers.
    expect(rateAt(870)).toBeGreaterThan(90)
    expect(rateAt(870) / rateAt(0)).toBeGreaterThan(20)
  })

  /**
   * The property that replaced two assertions written around a back-loaded
   * table: they pinned the opening under 8 spawns a second and the close at more
   * than ten times the seven-minute mark, and both were satisfied only because
   * the middle of the run was flat.
   *
   * That flat stretch was the last dead zone left. Measured on a maxed 단전, the
   * per-minute danger column read 0,0,7,0,0,0,0,0,0,0,0,6,35,39,33 — eight
   * consecutive minutes with nothing in them, because pressure sat between 5.9
   * and 9.5 a second from 2:00 to 7:30 and then exploded. The table is now one
   * geometric curve end to end, which is what the file's own opening comment
   * claimed it was all along: pressure doubles roughly every three minutes.
   */
  it('doubles pressure on a steady clock instead of saving it all for the end', () => {
    const bands = WAVES.filter((w) => !w.boss)
    const rate = (w) => w.perSpawn / w.spawnInterval
    const steps = []
    for (let i = 1; i < bands.length; i++) steps.push(rate(bands[i]) / rate(bands[i - 1]))

    // Every band grows, and none of them lurches.
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i], `band ${bands[i + 1].t}s`).toBeGreaterThan(1.0)
      expect(steps[i], `band ${bands[i + 1].t}s lurches`).toBeLessThan(1.35)
    }
    // No flat stretch: the middle of the run has to climb like the rest of it.
    const middle = bands.filter((w) => w.t >= 120 && w.t <= 450)
    expect(rate(middle.at(-1)) / rate(middle[0]), 'the mid game is a plateau').toBeGreaterThan(3)

    // A doubling time near three minutes, measured over the whole table rather
    // than asserted band by band.
    const halvings = Math.log2(rate(bands.at(-1)) / rate(bands[0]))
    const doublingMinutes = (bands.at(-1).t - bands[0].t) / 60 / halvings
    expect(doublingMinutes).toBeGreaterThan(2.4)
    expect(doublingMinutes).toBeLessThan(3.6)
  })

  it('ramps into the swarm rather than stepping into it', () => {
    // No single band may more than double on the one before it, or the jump
    // reads as the game breaking rather than as pressure arriving.
    const bands = WAVES.filter((w) => !w.boss && w.t >= 420)
    for (let i = 1; i < bands.length; i++) {
      const jump = (bands[i].perSpawn / bands[i].spawnInterval) / (bands[i - 1].perSpawn / bands[i - 1].spawnInterval)
      expect(jump, `band at ${bands[i].t}s jumps ${jump.toFixed(2)}x`).toBeLessThan(2)
    }
  })

  it('waveAt returns the active band', () => {
    expect(waveAt(0).t).toBe(0)
    expect(waveAt(29).t).toBe(0)
    expect(waveAt(30).t).toBe(30)
    expect(waveAt(899).t).toBe(870)
    expect(waveAt(-5).t).toBe(0)
    expect(waveAt(99999).t).toBe(900)
  })
})
