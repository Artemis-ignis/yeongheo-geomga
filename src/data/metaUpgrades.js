/**
 * 단전 — permanent upgrades bought with 영석 between runs.
 *
 * `perLevel` uses exactly the same StatMod shape as 공법 in passives.js, so
 * computeStats consumes both through one code path. Upgrades whose effect is not
 * a stat (영석 획득량, 부활) carry an `effect` tag instead and are read by
 * Progress directly.
 */
export const META_UPGRADES = [
  {
    id: 'vitality', name: '기혈증진', max: 8,
    desc: '단전에 기혈을 쌓아 최대 기혈이 늘어난다.',
    baseCost: 60, costGrowth: 1.55,
    perLevel: [{ stat: 'maxHp', op: 'mul', value: 0.06 }],
  },
  {
    id: 'edge', name: '검기연마', max: 8,
    desc: '검기를 벼려 모든 법보의 위력이 오른다.',
    baseCost: 80, costGrowth: 1.60,
    perLevel: [{ stat: 'might', op: 'add', value: 0.05 }],
  },
  {
    id: 'swift', name: '축지숙련', max: 5,
    desc: '축지의 이치를 익혀 몸놀림이 빨라진다.',
    baseCost: 70, costGrowth: 1.60,
    perLevel: [{ stat: 'moveSpeed', op: 'mul', value: 0.03 }],
  },
  {
    id: 'circulation', name: '기혈운행', max: 5,
    desc: '기의 회전이 빨라져 법보의 재시전이 짧아진다.',
    baseCost: 100, costGrowth: 1.70,
    perLevel: [{ stat: 'cooldown', op: 'add', value: -0.03 }],
  },
  {
    id: 'bulwark', name: '금강불괴', max: 5,
    desc: '몸을 단련해 받는 피해를 줄인다.',
    baseCost: 90, costGrowth: 1.60,
    perLevel: [{ stat: 'armor', op: 'add', value: 1 }],
  },
  {
    id: 'reach', name: '천리감응', max: 4,
    desc: '멀리 있는 영기까지 감응해 끌어당긴다.',
    baseCost: 50, costGrowth: 1.50,
    perLevel: [{ stat: 'magnet', op: 'mul', value: 0.15 }],
  },
  {
    id: 'insight', name: '혜안', max: 4,
    desc: '눈이 밝아져 좋은 인연을 만날 확률이 오른다.',
    baseCost: 90, costGrowth: 1.60,
    perLevel: [{ stat: 'luck', op: 'add', value: 0.08 }],
  },
  {
    id: 'mending', name: '소생술', max: 4,
    desc: '스스로 기혈을 돌려 조금씩 회복한다.',
    baseCost: 110, costGrowth: 1.70,
    perLevel: [{ stat: 'regen', op: 'add', value: 0.15 }],
  },
  {
    id: 'fortune', name: '재물운', max: 5,
    desc: '출정에서 얻는 영석이 늘어난다.',
    baseCost: 70, costGrowth: 1.55,
    effect: 'stoneGain', effectValue: 0.12,
    perLevel: [],
  },
  {
    id: 'revive', name: '환혼단', max: 1,
    desc: '쓰러져도 한 번은 기혈 절반으로 되살아난다.',
    baseCost: 1200, costGrowth: 1,
    effect: 'revive', effectValue: 1,
    perLevel: [],
  },
  /**
   * The two charges that turn 경지 돌파 from a formality back into a decision.
   *
   * With six 법보 slots and six 공법 slots, a roll late in a run routinely offers
   * three things the player has deliberately not built toward — and with no way
   * to refuse, taking a dead upgrade was mandatory. Skipping is free and always
   * available; asking again, and striking something from the run for good, are
   * the things worth buying.
   */
  {
    id: 'insightRoll', name: '점괘', max: 4,
    desc: '경지 돌파에서 패를 다시 뽑을 수 있다.',
    baseCost: 150, costGrowth: 1.65,
    effect: 'reroll', effectValue: 1,
    perLevel: [],
  },
  {
    id: 'sealing', name: '봉인술', max: 3,
    desc: '이번 출정에서 원치 않는 패를 아예 지운다.',
    baseCost: 220, costGrowth: 1.7,
    effect: 'banish', effectValue: 1,
    perLevel: [],
  },
]

export const META_INDEX = new Map(META_UPGRADES.map((u) => [u.id, u]))

export function getMetaUpgrade(id) {
  return META_INDEX.get(id)
}

/** Cost of buying the next level, given how many are already owned. */
export function metaCost(upgrade, ownedLevel) {
  return Math.round(upgrade.baseCost * upgrade.costGrowth ** ownedLevel)
}
