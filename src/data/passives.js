/**
 * 공법 — passive cultivation techniques. Each caps at level 5.
 *
 * There were six of these and `MAX_PASSIVE_SLOTS` is six, so supply exactly
 * equalled capacity: every run ended holding all of them and the passive half of
 * every level-up was not a choice, it was a queue. Four more make the sixth slot
 * cost something.
 *
 * The new four are deliberately not evolution keys — all six originals are, and
 * pairing more would mean new weapon behaviour rather than new decisions. They
 * cover the stats the game reads and nothing granted: 치명타, 법보 속도와 지속,
 * 갈래, and 인연. Every one of those was live in `computeStats` and reachable
 * only through a character trait or the 단전.
 */
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
  {
    id: 'heartMethod', name: '심법', max: 5,
    desc: '급소를 읽어 치명타가 잦아지고 무거워진다.',
    perLevel: [
      { stat: 'critChance', op: 'add', value: 0.05 },
      { stat: 'critMult', op: 'add', value: 0.12 },
    ],
  },
  {
    id: 'swordRiding', name: '어검결', max: 5,
    desc: '법보가 더 빨리 날고 그 자취가 오래 남는다.',
    perLevel: [
      { stat: 'speedProj', op: 'mul', value: 0.12 },
      { stat: 'duration', op: 'mul', value: 0.1 },
    ],
  },
  {
    /**
     * +0.2 a level, so a maxed 분신결 is exactly one more of everything that
     * counts its projectiles. `WeaponSystem` rounds, so the extra arrives at
     * level 3 and holds — a visible step rather than a number that only shows
     * up at the cap.
     */
    id: 'cloneArt', name: '분신결', max: 5,
    desc: '기가 갈라져 법보가 하나 더 날아간다.',
    perLevel: [{ stat: 'amount', op: 'add', value: 0.2 }],
  },
  {
    /**
     * 인연 weights the upgrade roll, and the roll is where evolutions come from
     * — measured, whether one happens decides the run outright. This is the only
     * in-run way to lean on that.
     */
    id: 'destinedBond', name: '연분', max: 5,
    desc: '좋은 인연이 따라붙어 귀한 것을 만나기 쉬워진다.',
    perLevel: [{ stat: 'luck', op: 'add', value: 0.1 }],
  },
]

export function getPassive(id) {
  return PASSIVES.find((p) => p.id === id)
}
