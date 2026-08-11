import { describe, expect, it } from 'vitest'
import {
  DAO_PLEDGE_MILESTONES_2D,
  DAO_VOW_DEFINITIONS_2D,
  DAO_VOW_IDS_2D,
  DAO_VOW_LIST_2D,
  DaoVows2D,
  applyDaoCombatModifiers2D,
  getDaoCombatModifiers2D,
  getDaoMirrorPattern2D,
  validateDaoVowSelection2D,
} from '../src/runtime2d/DaoVows2D.js'

function complete(vowId, deepening = null, completion = null) {
  const model = new DaoVows2D()
  model.select('pledge', vowId)
  model.select('deepening', deepening ?? vowId)
  model.select('completion', completion ?? vowId)
  return model
}

function expectDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  expect(Object.isFrozen(value)).toBe(true)
  for (const child of Object.values(value)) expectDeepFrozen(child, seen)
}

describe('DaoVows2D', () => {
  it('publishes three immutable Korean vows and exactly three pledge milestones', () => {
    expect(DAO_VOW_IDS_2D).toEqual(['sword', 'frost', 'spirit'])
    expect(DAO_VOW_LIST_2D).toHaveLength(3)
    expect(DAO_PLEDGE_MILESTONES_2D.map((entry) => entry.id)).toEqual([
      'pledge', 'deepening', 'completion',
    ])
    for (const vow of Object.values(DAO_VOW_DEFINITIONS_2D)) {
      expect(vow.name).toMatch(/^(검맥|설맥|심맥)$/)
      expect(vow.description.length).toBeGreaterThan(5)
      expect(vow.palette).toBeTruthy()
      expect(vow.vfx).toBeTruthy()
      expect(vow.milestones).toHaveLength(3)
      expectDeepFrozen(vow)
    }
    expectDeepFrozen(DAO_PLEDGE_MILESTONES_2D)
  })

  it('folds each milestone cumulatively into CombatWorld2D-compatible stats', () => {
    const model = new DaoVows2D()
    const initial = model.getCombatModifiers()
    model.select('pledge', 'sword')
    const pledge = model.getCombatModifiers()
    model.select('deepening', 'returning-edge')
    const deepened = model.getCombatModifiers()
    model.select('completion', 'sword-ring')
    const completeState = model.getCombatModifiers()

    expect(initial.milestone).toBe(0)
    expect(pledge.milestone).toBe(1)
    expect(deepened.milestone).toBe(2)
    expect(completeState.milestone).toBe(3)
    expect(pledge.stats.moveSpeed).toBeGreaterThan(1)
    expect(deepened.projectilePierceAdd).toBeGreaterThan(pledge.projectilePierceAdd)
    expect(completeState.swordRingEnabled).toBe(true)
    expect(completeState.stats).toEqual(expect.objectContaining({
      moveSpeed: completeState.moveSpeedMultiplier,
      might: completeState.damageMultiplier,
      cooldown: completeState.cooldownMultiplier,
    }))

    const base = { maxHp: 100, moveSpeed: 5, might: 1, area: 1, cooldown: 1, amount: 0, regen: 0 }
    expect(applyDaoCombatModifiers2D(base, completeState)).toEqual(expect.objectContaining({
      maxHp: 100 * completeState.stats.maxHp,
      moveSpeed: 5 * completeState.stats.moveSpeed,
      might: completeState.stats.might,
      regen: completeState.stats.regen,
    }))
  })

  it('puts the release-safe sword deepening first without removing the risky branch', () => {
    const model = new DaoVows2D('sword')
    expect(model.availableSelections('deepening').map(({ id }) => id)).toEqual([
      'piercing-edge', 'returning-edge',
    ])
  })

  it('rejects unknown vows, out-of-order milestones, and foreign options without mutation', () => {
    const model = new DaoVows2D()
    expect(() => model.select('pledge', 'void')).toThrow()
    expect(model.milestone).toBe(0)
    expect(model.validateSelection('deepening', 'returning-edge')).toMatchObject({
      valid: false, reason: 'milestone-order', expectedMilestone: 'pledge',
    })
    expect(() => model.select('deepening', 'returning-edge')).toThrow()
    model.select('pledge', 'frost')
    expect(model.isValidSelection('deepening', 'returning-edge')).toBe(false)
    expect(() => model.select('deepening', 'returning-edge')).toThrow()
    expect(model.isValidSelection('deepening', 'frost-shards')).toBe(true)
    expect(() => model.select('pledge', 'spirit')).toThrow()

    expect(validateDaoVowSelection2D({ milestone: 'pledge', choiceId: '심맥' })).toMatchObject({
      valid: true, vowId: 'spirit', choiceId: 'spirit',
    })
  })

  it('is deterministic for identical choices and keeps snapshots JSON-safe and immutable', () => {
    const first = complete('sword', 'returning-edge', 'sword-ring')
    const second = complete('sword', 'returning-edge', 'sword-ring')
    const snapshot = first.snapshot()
    expect(snapshot).toEqual(second.snapshot())
    expectDeepFrozen(snapshot)
    expect(() => JSON.stringify(snapshot)).not.toThrow()
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(() => { snapshot.choices.pledge = 'spirit' }).toThrow()
    expect(first.vowId).toBe('sword')
    expect(first.snapshot().choices.pledge).toBe('sword')

    const saved = JSON.parse(JSON.stringify(first.toSaveState()))
    const restored = DaoVows2D.fromSaveState(saved)
    expect(restored.snapshot()).toEqual(snapshot)
    expect(restored.serializeJson()).toBe(JSON.stringify(first.toSaveState()))
    expect(first.restore({ version: 99, vowId: 'frost' })).toBe(false)
    expect(first.vowId).toBe('sword')
  })

  it('gives sword, frost, and spirit distinct combat, presentation, and mirror output', () => {
    const models = DAO_VOW_IDS_2D.map((id) => complete(id))
    const modifiers = models.map((model) => model.getCombatModifiers())
    const presentations = models.map((model) => model.getPresentation())
    const mirrors = models.map((model) => model.getMirrorPatternMetadata())

    expect(new Set(modifiers.map((entry) => JSON.stringify(entry))).size).toBe(3)
    expect(new Set(presentations.map((entry) => JSON.stringify(entry))).size).toBe(3)
    expect(new Set(mirrors.map((entry) => JSON.stringify(entry))).size).toBe(3)
    expect(modifiers[0].swordFanProjectileAdd).toBeGreaterThan(0)
    expect(modifiers[1].frostFieldCountAdd).toBeGreaterThan(0)
    expect(modifiers[2].spiritGaugeEnabled).toBe(true)
    expect(presentations.map((entry) => entry.name)).toEqual(['검맥', '설맥', '심맥'])
  })

  it('derives the three-phase boss mirror sequence from the chosen vow', () => {
    const sword = complete('sword', 'returning-edge', 'sword-ring').getMirrorPatternMetadata()
    const frost = complete('frost', 'frost-shards', 'ice-wall').getMirrorPatternMetadata()
    const spirit = complete('spirit', 'purifying-heart', 'shadow-copy').getMirrorPatternMetadata()

    expect(sword.sequence.map((phase) => phase.id)).toEqual([
      'straight-sword-rain', 'returning-sword-line', 'closing-sword-ring',
    ])
    expect(frost.sequence.map((phase) => phase.id)).toEqual([
      'radial-frost-ring', 'chain-frost-mines', 'chain-frost-mines',
    ])
    expect(spirit.sequence.map((phase) => phase.id)).toEqual([
      'violet-orb-barrage', 'tracking-shadow-double', 'shadow-summon-overcharge',
    ])
    expect(sword.sequence.map((phase) => phase.phase)).toEqual([1, 2, 3])
    expect(sword.sequence.every((phase) => phase.vowId === 'sword')).toBe(true)
    expect(sword.bossId).toBe('jadeVoidWarden')
    expect(sword.complete).toBe(true)
    expectDeepFrozen(sword)

    const partial = new DaoVows2D({ vowId: 'frost' }).getMirrorPatternMetadata()
    expect(partial.sequence).toHaveLength(1)
    expect(partial.sequence[0].milestone).toBe('pledge')
  })
})
