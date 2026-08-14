import { describe, it, expect } from 'vitest'
import { ACHIEVEMENTS, evaluate, getAchievement } from '../src/data/achievements.js'
import { Progress } from '../src/meta/Progress.js'
import { defaultSave } from '../src/meta/Save.js'

/** A run nobody could earn anything from, to be overridden per test. */
const nothing = {
  runTime: 0, level: 1, kills: 0, victory: false, trial: 0,
  weaponCount: 1, evolutions: 0, bossKills: 0, damageTaken: 99,
  rerollsUsed: 0, banishesUsed: 0, objectivesCompleted: 0, decisionCount: 0,
}
const career = {
  runs: 0, victories: 0, totalKills: 0, bestTime: 0, bestLevel: 0,
  unlockedCharacters: 1, unlockedWeapons: 4, stagesCleared: 0,
  chaptersCleared: 0, expeditionVictories: 0, survivalVictories: 0,
}

describe('achievement table', () => {
  it('has unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })

  it('every entry is complete and pays something', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name, a.id).toBeTruthy()
      expect(a.desc, a.id).toBeTruthy()
      expect(typeof a.test, a.id).toBe('function')
      expect(['run', 'career'], a.id).toContain(a.scope)
      expect(a.stones, a.id).toBeGreaterThan(0)
    }
  })

  it('awards nothing for a run that did nothing', () => {
    expect(evaluate(nothing, career, [])).toHaveLength(0)
  })

  it('never re-awards something already earned', () => {
    const run = { ...nothing, kills: 500 }
    const first = evaluate(run, career, [])
    expect(first.length).toBeGreaterThan(0)
    const again = evaluate(run, career, first.map((a) => a.id))
    expect(again).toHaveLength(0)
  })

  it('accepts either a Set or an array of earned ids', () => {
    const run = { ...nothing, kills: 500 }
    const ids = evaluate(run, career, []).map((a) => a.id)
    expect(evaluate(run, career, new Set(ids))).toHaveLength(0)
  })

  it('survives a malformed run record instead of losing the whole award', () => {
    // One broken predicate must not take the rest of the table down with it.
    expect(() => evaluate(undefined, career, [])).not.toThrow()
    expect(() => evaluate(null, null, [])).not.toThrow()
  })

  it('reads career-scope entries against career totals, not the run', () => {
    // A single run with 1000 kills is not a career of 1000 kills.
    const bigRun = { ...nothing, kills: 1000 }
    const earned = evaluate(bigRun, career, []).map((a) => a.id)
    expect(earned).not.toContain('slayer1000')
    const earnedCareer = evaluate(nothing, { ...career, totalKills: 1000 }, []).map((a) => a.id)
    expect(earnedCareer).toContain('slayer1000')
  })

  it('gates 무흔 on taking no damage at all', () => {
    const clean = { ...nothing, runTime: 200, damageTaken: 0 }
    expect(evaluate(clean, career, []).map((a) => a.id)).toContain('untouched')
    const grazed = { ...clean, damageTaken: 1 }
    expect(evaluate(grazed, career, []).map((a) => a.id)).not.toContain('untouched')
  })

  it('gates 일도양단 on a clear with no charges spent', () => {
    const pure = { ...nothing, victory: true, rerollsUsed: 0, banishesUsed: 0 }
    expect(evaluate(pure, career, []).map((a) => a.id)).toContain('noSkip')
    const helped = { ...pure, rerollsUsed: 1 }
    expect(evaluate(helped, career, []).map((a) => a.id)).not.toContain('noSkip')
  })

  it('does not award timed 천겁 feats during authored exploration', () => {
    const ids = evaluate({
      ...nothing, mode: 'expedition', runTime: 500, trial: 3,
    }, career, []).map((a) => a.id)
    expect(ids).not.toContain('survive5')
    expect(ids).not.toContain('survive10')
    expect(ids).not.toContain('trialRunner')
  })

  it('makes chapter progress and its decision the first authored goals', () => {
    expect(ACHIEVEMENTS.slice(0, 3).map((entry) => entry.id)).toEqual([
      'firstMeridian', 'sealedDecision', 'clear',
    ])
    const ids = evaluate({
      ...nothing, mode: 'expedition', objectivesCompleted: 3, decisionCount: 1, victory: true,
    }, career, []).map((entry) => entry.id)
    expect(ids).toEqual(expect.arrayContaining(['firstMeridian', 'sealedDecision', 'clear']))
  })
})

describe('banking achievements', () => {
  it('pays 영석 and remembers what it paid for', () => {
    const p = new Progress(defaultSave())
    const before = p.stones
    const earned = p.awardAchievements({ ...nothing, kills: 150 })
    expect(earned.length).toBeGreaterThan(0)
    const owed = earned.reduce((n, a) => n + a.stones, 0)
    expect(p.stones).toBe(before + owed)
    for (const a of earned) expect(p.hasAchievement(a.id)).toBe(true)
  })

  it('pays only once for the same feat', () => {
    const p = new Progress(defaultSave())
    p.awardAchievements({ ...nothing, kills: 150 })
    const after = p.stones
    expect(p.awardAchievements({ ...nothing, kills: 150 })).toHaveLength(0)
    expect(p.stones).toBe(after)
  })

  it('counts a 비경 as cleared once', () => {
    const p = new Progress(defaultSave())
    expect(p.markStageCleared('jade')).toBe(true)
    expect(p.markStageCleared('jade')).toBe(false)
    expect(p.careerSummary.stagesCleared).toBe(1)
  })

  it('earns 삼귀 on the third main-journey completion, not from optional trials', () => {
    const p = new Progress(defaultSave())
    for (let i = 0; i < 2; i++) p.recordRun({ runTime: 420, level: 20, kills: 500, victory: true, mode: 'survival' })
    expect(p.awardAchievements({ ...nothing }).map((a) => a.id)).not.toContain('allStages')
    for (let i = 0; i < 3; i++) p.recordRun({ runTime: 240, level: 20, kills: 300, victory: true, mode: 'expedition' })
    const ids = p.awardAchievements({ ...nothing, victory: true }).map((a) => a.id)
    expect(ids).toContain('allStages')
  })

  it('keeps the authored challenge and collection achievements reachable', () => {
    expect(getAchievement('survive10').test({ runTime: 420 })).toBe(true)
    expect(getAchievement('allCharacters').test({ unlockedWeapons: 14 })).toBe(true)
    expect(getAchievement('allStages').test({ expeditionVictories: 3 })).toBe(true)
  })

  it('survives a save round-trip', () => {
    const a = new Progress(defaultSave())
    a.awardAchievements({ ...nothing, kills: 150 })
    const kept = [...a.achievements]
    expect(new Progress(a.toSaveState()).achievements).toEqual(kept)
  })

  it('a save written before 업적 existed still loads', () => {
    const old = defaultSave()
    delete old.achievements
    delete old.stagesCleared
    const p = new Progress(old)
    expect(p.achievements).toEqual([])
    expect(() => p.awardAchievements({ ...nothing, kills: 150 })).not.toThrow()
  })

  it('every id the table can award is a real entry', () => {
    const p = new Progress(defaultSave())
    p.awardAchievements({
      runTime: 9999, level: 99, kills: 9999, victory: true, trial: 9,
      weaponCount: 6, evolutions: 9, bossKills: 9, damageTaken: 0,
      rerollsUsed: 0, banishesUsed: 0,
    })
    for (const id of p.achievements) expect(getAchievement(id), id).toBeTruthy()
  })
})
