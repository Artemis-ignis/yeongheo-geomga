/** 공법 — passive cultivation techniques. Each caps at level 5. */
export const PASSIVES = [
  {
    id: 'swordArt', name: '검결', max: 5,
    desc: '모든 법보의 위력이 오른다.',
    perLevel: [{ stat: 'might', op: 'add', value: 0.1 }],
  },
  {
    id: 'lightBody', name: '경신공', max: 5,
    desc: '몸이 가벼워져 더 빨리 움직인다.',
    perLevel: [{ stat: 'moveSpeed', op: 'mul', value: 0.08 }],
  },
  {
    id: 'guardianAura', name: '호신강기', max: 5,
    desc: '기혈이 늘고 피해를 흘려낸다.',
    perLevel: [
      { stat: 'maxHp', op: 'mul', value: 0.15 },
      { stat: 'armor', op: 'add', value: 1 },
    ],
  },
  {
    id: 'spiritRoot', name: '영근', max: 5,
    desc: '영기 회전이 빨라져 법보의 재시전이 짧아진다.',
    perLevel: [{ stat: 'cooldown', op: 'add', value: -0.08 }],
  },
  {
    id: 'farSight', name: '천리안', max: 5,
    desc: '멀리 있는 영기까지 끌어당기고 더 많이 흡수한다.',
    perLevel: [
      { stat: 'magnet', op: 'mul', value: 0.25 },
      { stat: 'growth', op: 'mul', value: 0.1 },
    ],
  },
  {
    id: 'goldenCore', name: '금단', max: 5,
    desc: '단전이 여물어 법보의 범위가 넓어지고 기혈이 회복된다.',
    perLevel: [
      { stat: 'area', op: 'add', value: 0.12 },
      { stat: 'regen', op: 'add', value: 0.3 },
    ],
  },
]

export function getPassive(id) {
  return PASSIVES.find((p) => p.id === id)
}
