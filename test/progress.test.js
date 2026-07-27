import { describe, it, expect } from 'vitest'
import { Progress } from '../src/meta/Progress.js'
import { defaultSave } from '../src/meta/Save.js'
import { META_UPGRADES, getMetaUpgrade, metaCost } from '../src/data/metaUpgrades.js'
import { CHARACTER_UNLOCKS, WEAPON_UNLOCKS, STARTING_WEAPONS } from '../src/data/unlocks.js'
import { computeStats } from '../src/combat/Stats.js'
import { BASE_STATS } from '../src/data/characters.js'

const rich = (stones = 100000) => {
  const s = defaultSave()
  s.stones = stones
  return new Progress(s)
}

describe('meta upgrade table', () => {
  it('gives every upgrade a positive max and cost', () => {
    for (const u of META_UPGRADES) {
      expect(u.max, u.id).toBeGreaterThan(0)
      expect(u.baseCost, u.id).toBeGreaterThan(0)
    }
  })

  it('uses unique ids', () => {
    expect(new Set(META_UPGRADES.map((u) => u.id)).size).toBe(META_UPGRADES.length)
  })

  it('gives every stat upgrade at least one modifier', () => {
    for (const u of META_UPGRADES) {
      if (u.effect) continue
      expect(u.perLevel.length, u.id).toBeGreaterThan(0)
    }
  })

  it('only modifies stats that actually exist', () => {
    const known = new Set([...Object.keys(BASE_STATS), 'tagMight'])
    for (const u of META_UPGRADES) {
      for (const m of u.perLevel) expect(known.has(m.stat), `${u.id}: ${m.stat}`).toBe(true)
    }
  })

  it('makes each level cost more than the last', () => {
    for (const u of META_UPGRADES) {
      if (u.max < 2) continue
      for (let lv = 1; lv < u.max; lv++) {
        expect(metaCost(u, lv), u.id).toBeGreaterThan(metaCost(u, lv - 1))
      }
    }
  })
})

describe('buying upgrades', () => {
  it('starts every upgrade at level 0', () => {
    const p = new Progress()
    for (const u of META_UPGRADES) expect(p.levelOf(u.id)).toBe(0)
  })

  it('deducts the cost and raises the level', () => {
    const p = rich(1000)
    const cost = p.costOf('vitality')
    expect(p.buyUpgrade('vitality')).toBe(true)
    expect(p.levelOf('vitality')).toBe(1)
    expect(p.stones).toBe(1000 - cost)
  })

  it('refuses when the player cannot afford it', () => {
    const p = new Progress()
    expect(p.canAfford('vitality')).toBe(false)
    expect(p.buyUpgrade('vitality')).toBe(false)
    expect(p.levelOf('vitality')).toBe(0)
  })

  it('never spends stones on a failed purchase', () => {
    const p = rich(10)
    p.buyUpgrade('vitality')
    expect(p.stones).toBe(10)
  })

  it('stops at the maximum level', () => {
    const p = rich()
    const max = getMetaUpgrade('reach').max
    for (let i = 0; i < max; i++) expect(p.buyUpgrade('reach')).toBe(true)
    expect(p.isMaxed('reach')).toBe(true)
    expect(p.costOf('reach')).toBeNull()
    expect(p.buyUpgrade('reach')).toBe(false)
    expect(p.levelOf('reach')).toBe(max)
  })

  it('treats an unknown id as maxed rather than crashing', () => {
    const p = rich()
    expect(p.isMaxed('nonsense')).toBe(true)
    expect(p.costOf('nonsense')).toBeNull()
    expect(p.buyUpgrade('nonsense')).toBe(false)
  })
})

describe('statMods', () => {
  it('is empty with nothing bought', () => {
    expect(new Progress().statMods).toEqual([])
  })

  it('emits one copy of the modifiers per owned level', () => {
    const p = rich()
    p.buyUpgrade('edge')
    p.buyUpgrade('edge')
    p.buyUpgrade('edge')
    const edgeMods = p.statMods.filter((m) => m.stat === 'might')
    expect(edgeMods).toHaveLength(3)
  })

  it('feeds computeStats the same way passives do', () => {
    const p = rich()
    p.buyUpgrade('edge')
    p.buyUpgrade('edge')
    const plain = { id: 't', mods: [] }
    const stats = computeStats(plain, {}, p.statMods)
    expect(stats.might).toBeCloseTo(BASE_STATS.might + 0.10, 6)
  })

  it('stacks with character traits and passives', () => {
    const p = rich()
    p.buyUpgrade('swift')
    const character = { id: 't', mods: [{ stat: 'moveSpeed', op: 'mul', value: 0.1 }] }
    const stats = computeStats(character, { lightBody: 1 }, p.statMods)
    expect(stats.moveSpeed).toBeCloseTo(BASE_STATS.moveSpeed * 1.1 * 1.08 * 1.03, 6)
  })

  it('still respects the cooldown floor', () => {
    const p = rich()
    while (p.buyUpgrade('circulation')) { /* max it out */ }
    const stats = computeStats({ id: 't', mods: [] }, { spiritRoot: 5 }, p.statMods)
    expect(stats.cooldown).toBeGreaterThanOrEqual(0.4)
  })
})

describe('non-stat effects', () => {
  it('has no stone bonus and no revives by default', () => {
    const p = new Progress()
    expect(p.stoneMultiplier).toBe(1)
    expect(p.reviveCharges).toBe(0)
  })

  it('raises the stone multiplier per 재물운 level', () => {
    const p = rich()
    p.buyUpgrade('fortune')
    p.buyUpgrade('fortune')
    expect(p.stoneMultiplier).toBeCloseTo(1.24, 6)
  })

  it('grants a revive charge from 환혼단', () => {
    const p = rich()
    p.buyUpgrade('revive')
    expect(p.reviveCharges).toBe(1)
  })

  it('keeps effect-only upgrades out of statMods', () => {
    const p = rich()
    p.buyUpgrade('fortune')
    p.buyUpgrade('revive')
    expect(p.statMods).toEqual([])
  })
})

describe('unlocks', () => {
  it('starts with the free weapons only', () => {
    const p = new Progress()
    for (const id of STARTING_WEAPONS) expect(p.isUnlocked('weapons', id)).toBe(true)
    for (const u of WEAPON_UNLOCKS) expect(p.isUnlocked('weapons', u.id)).toBe(false)
  })

  it('starts with one character', () => {
    const p = new Progress()
    expect(p.isUnlocked('characters', 'seolryeong')).toBe(true)
    for (const u of CHARACTER_UNLOCKS) expect(p.isUnlocked('characters', u.id)).toBe(false)
  })

  it('buys a locked weapon and deducts its cost', () => {
    const p = rich(1000)
    expect(p.unlock('weapons', 'vajra')).toBe(true)
    expect(p.isUnlocked('weapons', 'vajra')).toBe(true)
    expect(p.stones).toBe(1000 - 450)
  })

  it('refuses an unaffordable unlock', () => {
    const p = rich(10)
    expect(p.unlock('characters', 'hongryeon')).toBe(false)
    expect(p.isUnlocked('characters', 'hongryeon')).toBe(false)
    expect(p.stones).toBe(10)
  })

  it('cannot buy the same unlock twice', () => {
    const p = rich()
    p.unlock('weapons', 'vajra')
    const after = p.stones
    expect(p.unlock('weapons', 'vajra')).toBe(false)
    expect(p.stones).toBe(after)
  })

  it('reports no cost for something already unlocked', () => {
    expect(new Progress().unlockCostOf('weapons', 'flyingSword')).toBeNull()
  })
})

describe('run bookkeeping', () => {
  it('accumulates stones as whole numbers', () => {
    const p = new Progress()
    expect(p.addStones(120.6)).toBe(121)
    expect(p.stones).toBe(121)
  })

  it('ignores negative awards', () => {
    const p = rich(50)
    p.addStones(-100)
    expect(p.stones).toBe(50)
  })

  it('tracks lifetime records and reports new bests', () => {
    const p = new Progress()
    const first = p.recordRun({ runTime: 120, level: 8, kills: 300, victory: false })
    expect(first).toEqual({ time: true, level: true })
    expect(p.records.runs).toBe(1)
    expect(p.records.totalKills).toBe(300)

    const worse = p.recordRun({ runTime: 60, level: 4, kills: 100, victory: false })
    expect(worse).toEqual({ time: false, level: false })
    expect(p.records.bestTime).toBe(120)
    expect(p.records.runs).toBe(2)
    expect(p.records.totalKills).toBe(400)
  })

  it('counts victories separately', () => {
    const p = new Progress()
    p.recordRun({ runTime: 900, level: 40, kills: 9000, victory: true })
    expect(p.records.victories).toBe(1)
  })

  it('records each thing seen only once', () => {
    const p = new Progress()
    expect(p.markSeen('enemies', 'wolf')).toBe(true)
    expect(p.markSeen('enemies', 'wolf')).toBe(false)
    expect(p.hasSeen('enemies', 'wolf')).toBe(true)
    expect(p.hasSeen('enemies', 'wisp')).toBe(false)
  })

  it('ignores an unknown codex category', () => {
    expect(() => new Progress().markSeen('nope', 'x')).not.toThrow()
  })
})
