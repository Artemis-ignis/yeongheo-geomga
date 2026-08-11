import { describe, expect, it } from 'vitest'
import {
  NORMAL_RUN_MODE_2D,
  SHOWCASE_RUN_MODE_2D,
  SHOWCASE_SEED_2D,
  isShowcaseRunOptions,
  normalRetryOptions2D,
  progressForRun,
  seedForRun,
} from '../src/runtime2d/Game2D.js'
import { STARTING_WEAPONS } from '../src/data/unlocks.js'
import { Progress } from '../src/meta/Progress.js'
import { defaultSave } from '../src/meta/Save.js'

describe('2D showcase entry contract', () => {
  it('uses the published seed only for quickStart/showcase runs', () => {
    expect(SHOWCASE_SEED_2D).toBe(3185791507)
    expect(isShowcaseRunOptions({ mode: SHOWCASE_RUN_MODE_2D })).toBe(true)
    expect(seedForRun({ mode: SHOWCASE_RUN_MODE_2D }, 7)).toBe(SHOWCASE_SEED_2D)
    expect(seedForRun(null, 7)).toBe(7)
  })

  it('keeps same-seed reproduction separate from a fresh normal retry', () => {
    const retry = normalRetryOptions2D(SHOWCASE_SEED_2D)
    expect(retry).toEqual({ mode: NORMAL_RUN_MODE_2D, avoidSeed: SHOWCASE_SEED_2D })
    expect(seedForRun(retry, SHOWCASE_SEED_2D)).toBe((SHOWCASE_SEED_2D + 1) >>> 0)
    expect(seedForRun({ mode: NORMAL_RUN_MODE_2D, avoidSeed: 7 }, 7)).toBe(8)
    expect(seedForRun({ mode: NORMAL_RUN_MODE_2D, avoidSeed: 7 }, 8)).toBe(8)
  })

  it('starts showcase combat from pristine trial and meta state without mutating the save', () => {
    const saved = defaultSave()
    saved.trial = 3
    saved.upgrades = { might: 4, revive: 2 }
    saved.unlockedWeapons.push('voidOrb')
    saved.records.bestTime = 700
    const progress = new Progress(saved)
    const run = progressForRun(progress, { mode: SHOWCASE_RUN_MODE_2D })

    expect(run).not.toBe(progress)
    expect(run.trial).toBe(0)
    expect(run.statMods).toEqual([])
    expect(run.reviveCharges).toBe(0)
    expect(run.unlockedWeapons).toEqual(STARTING_WEAPONS)
    expect(progress.trial).toBe(3)
    expect(progress.levelOf('might')).toBe(4)
    expect(progress.unlockedWeapons).toContain('voidOrb')
    expect(progress.records.bestTime).toBe(700)
  })

  it('keeps the normal setup flow attached to the saved Progress object', () => {
    const progress = new Progress(defaultSave())
    expect(progressForRun(progress)).toBe(progress)
  })
})
