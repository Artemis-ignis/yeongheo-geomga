import { describe, it, expect } from 'vitest'
import { STAGES, getStage, rosterFor } from '../src/data/stages.js'
import { ENEMIES } from '../src/data/enemies.js'
import { WAVES } from '../src/data/waves.js'
import { BOSSES } from '../src/entities/BossManager.js'
import { Progress } from '../src/meta/Progress.js'
import { defaultSave } from '../src/meta/Save.js'
import { STAGE_UNLOCKS } from '../src/data/unlocks.js'

const enemyIds = new Set(ENEMIES.map((e) => e.id))

describe('stage table', () => {
  it('ships at least three arenas with unique ids', () => {
    expect(STAGES.length).toBeGreaterThanOrEqual(3)
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGES.length)
  })

  it('gives every stage a full palette', () => {
    const required = [
      'ground', 'groundMoss', 'grassBase', 'grassTip', 'pine', 'stone',
      'fog', 'skyTop', 'skyMid', 'skyHaze', 'skyBottom', 'abyss', 'barrier',
    ]
    for (const s of STAGES) {
      for (const key of required) {
        expect(typeof s.palette[key], `${s.id}.${key}`).toBe('number')
      }
    }
  })

  it('only rosters enemies that exist', () => {
    for (const s of STAGES) {
      for (const id of s.roster ?? []) expect(enemyIds.has(id), `${s.id}: ${id}`).toBe(true)
    }
  })

  it('names bosses that exist', () => {
    for (const s of STAGES) {
      expect(BOSSES[s.bosses.mid], s.id).toBeDefined()
      expect(BOSSES[s.bosses.final], s.id).toBeDefined()
    }
  })

  it('makes the first stage free and the rest cost something', () => {
    expect(STAGES[0].unlockCost).toBe(0)
    for (const s of STAGES.slice(1)) expect(s.unlockCost).toBeGreaterThan(0)
  })

  it('gets harder and more rewarding down the list', () => {
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i].hpScale).toBeGreaterThan(STAGES[i - 1].hpScale)
      expect(STAGES[i].stoneScale).toBeGreaterThan(STAGES[i - 1].stoneScale)
    }
  })

  it('keeps stage unlock prices in step with the stage table', () => {
    for (const u of STAGE_UNLOCKS) {
      expect(getStage(u.id).unlockCost, u.id).toBe(u.cost)
    }
  })

  it('falls back to the first stage for an unknown id', () => {
    expect(getStage('nonsense')).toBe(STAGES[0])
  })
})

describe('rosterFor', () => {
  const jade = getStage('jade')
  const ember = getStage('ember')

  it('passes everything through when a stage has no roster', () => {
    // Every shipped stage now names its own roster, so this covers the fallback
    // a new stage gets before its bestiary is decided.
    const types = ['wisp', 'stoneGhoul']
    expect(rosterFor({ id: 'draft', roster: null }, types)).toBe(types)
  })

  it('keeps fire and ice creatures out of the plateau', () => {
    const out = rosterFor(jade, ['wisp', 'emberSprite', 'frostWolf'])
    expect(out).toEqual(['wisp'])
  })

  it('filters a band down to the stage roster', () => {
    expect(rosterFor(ember, ['wisp', 'stoneGhoul'])).toEqual(['wisp'])
  })

  it('never returns an empty list, which would silently stop spawning', () => {
    // 석귀 is not in the ember roster, so this band would filter to nothing.
    const out = rosterFor(ember, ['stoneGhoul'])
    expect(out.length).toBeGreaterThan(0)
    expect(ember.roster).toContain(out[0])
  })

  it('leaves every shipped wave band spawnable on every stage', () => {
    for (const s of STAGES) {
      for (const band of WAVES) {
        const out = rosterFor(s, band.types ?? [])
        expect(out.length, `${s.id} @ t=${band.t}`).toBeGreaterThan(0)
        for (const id of out) expect(enemyIds.has(id)).toBe(true)
      }
    }
  })
})

describe('stage unlocking', () => {
  it('starts with only the first stage', () => {
    const p = new Progress()
    expect(p.isUnlocked('stages', 'jade')).toBe(true)
    for (const u of STAGE_UNLOCKS) expect(p.isUnlocked('stages', u.id)).toBe(false)
  })

  it('buys a stage and deducts its cost', () => {
    const s = defaultSave()
    s.stones = 5000
    const p = new Progress(s)
    expect(p.unlock('stages', 'ember')).toBe(true)
    expect(p.isUnlocked('stages', 'ember')).toBe(true)
    expect(p.stones).toBe(5000 - getStage('ember').unlockCost)
  })

  it('refuses an unaffordable stage', () => {
    const p = new Progress()
    expect(p.unlock('stages', 'frost')).toBe(false)
    expect(p.isUnlocked('stages', 'frost')).toBe(false)
  })

  it('survives a save written before stages existed', () => {
    const p = new Progress({ ...defaultSave(), unlockedStages: undefined })
    expect(() => p.isUnlocked('stages', 'jade')).not.toThrow()
  })
})
