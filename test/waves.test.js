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

  it('waveAt returns the active band', () => {
    expect(waveAt(0).t).toBe(0)
    expect(waveAt(29).t).toBe(0)
    expect(waveAt(30).t).toBe(30)
    expect(waveAt(899).t).toBe(870)
    expect(waveAt(-5).t).toBe(0)
    expect(waveAt(99999).t).toBe(900)
  })
})
