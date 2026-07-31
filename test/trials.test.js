import { describe, it, expect, afterEach } from 'vitest'
import { TRIALS, TRIAL, getTrial, applyTrial, unlockedTrials } from '../src/data/trials.js'
import { ENEMIES, scaledHp, scaledDamage } from '../src/data/enemies.js'
import { Progress } from '../src/meta/Progress.js'
import { defaultSave } from '../src/meta/Save.js'

/**
 * 시련 exist because the enemy table cannot serve both ends of the meta at once.
 *
 * A 단전 bought to the last level gives 1.59x health, +5 armour, 1.4x might and
 * 1.16x speed, and past minute five that build's clear rate exceeds anything the
 * wave table can present: measured, minutes five to eleven ran at zero contact
 * even against rings of 1600-health elites hastened past her own speed. Twelve
 * enemy-side levers were swept and only health moved it, and pushing health far
 * enough to matter late killed a fresh save at four minutes on the way there.
 *
 * So the table scales and the player chooses when. These pin the properties that
 * make that a ladder rather than a trap.
 */

afterEach(() => { applyTrial(0) })

describe('시련 tiers', () => {
  it('starts at an untouched 비경', () => {
    const base = getTrial(0)
    expect(base.hp).toBe(1)
    expect(base.damage).toBe(1)
    expect(base.speed).toBe(1)
    expect(base.density).toBe(1)
    expect(base.stones).toBe(1)
    expect(base.unlockSeconds).toBe(0)
  })

  it('gets harder in every dimension, monotonically', () => {
    for (let i = 1; i < TRIALS.length; i++) {
      for (const key of ['hp', 'damage', 'speed', 'density', 'stones', 'unlockSeconds']) {
        expect(TRIALS[i][key], `${key} eases off at tier ${i}`).toBeGreaterThan(TRIALS[i - 1][key])
      }
    }
  })

  it('never lets the roster outrun her outright', () => {
    // The whole game is built on kiting. A tier that makes the ordinary horde
    // faster than the player does not raise difficulty, it deletes a mechanic.
    const playerTop = 5.2 * 1.1 * 1.16 // base, 설령's trait, a maxed 축지숙련
    for (const t of TRIALS) {
      for (const e of ENEMIES) {
        expect(e.speed * t.speed, `${t.name}: ${e.name} outruns her`).toBeLessThan(playerTop)
      }
    }
  })

  it('pays for the risk it asks for', () => {
    // Reward has to climb at least as fast as enemy health, or the tier is a
    // worse way to earn 영석 than the one below it.
    for (const t of TRIALS.slice(1)) {
      expect(t.stones / TRIALS[0].stones).toBeGreaterThan(1)
      expect(t.stones).toBeGreaterThan(1 + (t.hp - 1) * 0.3)
    }
  })

  it('applies live to the scaling functions and restores', () => {
    const wisp = ENEMIES[0]
    const baseHp = scaledHp(wisp, 5)
    const baseDmg = scaledDamage(wisp, 5)
    const t = applyTrial(3)
    expect(scaledHp(wisp, 5)).toBeCloseTo(baseHp * t.hp, 6)
    expect(scaledDamage(wisp, 5)).toBeCloseTo(baseDmg * t.damage, 6)
    applyTrial(0)
    expect(scaledHp(wisp, 5)).toBeCloseTo(baseHp, 6)
    expect(TRIAL.hp).toBe(1)
  })

  it('falls back to 평지 for an id that does not exist', () => {
    expect(getTrial(99).id).toBe(0)
    expect(getTrial(undefined).id).toBe(0)
    expect(applyTrial(-3).id).toBe(0)
  })
})

describe('시련 unlocking', () => {
  it('opens nothing before the first run', () => {
    expect(unlockedTrials(0)).toBe(0)
  })

  it('opens one tier at a time as the best time grows', () => {
    for (const t of TRIALS) {
      expect(unlockedTrials(t.unlockSeconds)).toBeGreaterThanOrEqual(t.id)
      if (t.id > 0) expect(unlockedTrials(t.unlockSeconds - 1)).toBe(t.id - 1)
    }
  })

  it('never opens more than the table has', () => {
    expect(unlockedTrials(1e9)).toBe(TRIALS[TRIALS.length - 1].id)
  })
})

describe('시련 on the save', () => {
  const fresh = () => new Progress(JSON.parse(JSON.stringify(defaultSave())))

  it('clamps a selection to what has been earned', () => {
    const p = fresh()
    expect(p.maxTrial).toBe(0)
    p.setTrial(4)
    expect(p.trial, 'a new save picked the hardest tier').toBe(0)
  })

  it('lets a selection stand once the time is on the record', () => {
    const p = fresh()
    p.recordRun({ runTime: TRIALS[2].unlockSeconds, level: 30, kills: 900, victory: false })
    expect(p.maxTrial).toBe(2)
    expect(p.setTrial(2)).toBe(2)
    expect(p.trial).toBe(2)
  })

  it('drops a stale selection if the save is somehow ahead of the record', () => {
    // Reading rather than storing the unlock means an edited or migrated save
    // cannot leave a tier selected that its history never earned.
    const p = fresh()
    p.state.trial = 4
    expect(p.trial).toBe(0)
  })

  it('multiplies the 영석 a run pays out', () => {
    const p = fresh()
    const plain = p.stoneMultiplier
    p.recordRun({ runTime: TRIALS[3].unlockSeconds, level: 40, kills: 1200, victory: false })
    p.setTrial(3)
    expect(p.stoneMultiplier).toBeCloseTo(plain * TRIALS[3].stones, 6)
  })
})
