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

  it('keeps the opening sparse enough for one level-1 법보', () => {
    // At 0:00 she has a single weapon and cannot clear a crowd.
    expect(rateAt(0)).toBeLessThan(2)
    expect(rateAt(60)).toBeLessThan(3)
  })

  it('closes with a swarm, which is where the run gets its only real threat', () => {
    // Her power plateaus around minute ten: six 법보 and six 공법 all cap at
    // level 5. Enemy health cannot answer that without killing her at four
    // minutes on the way up, so the late game has to come from numbers.
    expect(rateAt(870) / rateAt(420)).toBeGreaterThan(10)
    expect(rateAt(870)).toBeGreaterThan(90)
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
