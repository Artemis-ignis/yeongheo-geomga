/** @typedef {{ stat: string, op: 'add'|'mul', value: number, tag?: string }} StatMod */

/** Element tags a 법보 can carry. Character traits can boost a single tag. */
export const TAGS = ['sword', 'fire', 'thunder', 'ice', 'array']

export const BASE_STATS = Object.freeze({
  maxHp: 100,
  moveSpeed: 5.2,
  armor: 0,
  might: 1.0,
  area: 1.0,
  cooldown: 1.0,
  speedProj: 1.0,
  duration: 1.0,
  amount: 0,
  // Radius of the hard pull. At 3.0 against a move speed of 5.7 an orb dropped
  // behind a retreating player was simply never reached.
  magnet: 5.0,
  luck: 1.0,
  growth: 1.0,
  critChance: 0.05,
  critMult: 2.0,
  regen: 0,
})

export const CHARACTERS = [
  {
    id: 'seolryeong',
    name: '설령',
    path: '한빙검파 검수',
    desc: '검을 몸의 연장처럼 다루는 한빙검파의 막내 제자.',
    traits: ['이동속도 +10%', '검류 법보 피해 +15%'],
    startWeapon: 'flyingSword',
    // Silver hair needs a saturated robe under it, or she reads as one white
    // blob at gameplay distance.
    palette: { hair: 0xeaf3fd, hairRoot: 0x6b86ae, accent: 0x7ec8ff, cloth: 0x3f74b8, trim: 0xd9e8f7, eye: 0x2f9bdd, skin: 0xfbe3d6 },
    mods: [
      { stat: 'moveSpeed', op: 'mul', value: 0.1 },
      { stat: 'tagMight', op: 'add', value: 0.15, tag: 'sword' },
    ],
  },
  {
    id: 'hongryeon',
    name: '홍련',
    path: '염화종 부법사',
    desc: '부적 한 장으로 산을 태운다는 염화종의 기재.',
    traits: ['범위 +15%', '화염 법보 피해 +25%'],
    startWeapon: 'fireTalisman',
    palette: { hair: 0x59202a, hairRoot: 0x1d0d13, accent: 0xff7a4d, cloth: 0xd94b3a, trim: 0xe8c56a, eye: 0xffb347, skin: 0xfbe3d6 },
    mods: [
      { stat: 'area', op: 'add', value: 0.15 },
      { stat: 'tagMight', op: 'add', value: 0.25, tag: 'fire' },
    ],
  },
  {
    id: 'cheongmyo',
    name: '청묘',
    path: '요족 혈맥 체수',
    desc: '요족의 피를 이어받아 맨몸으로 뇌기를 두르는 소녀.',
    traits: ['최대 기혈 +30%', '초당 기혈 회복 0.4'],
    startWeapon: 'thunderOrb',
    palette: { hair: 0x3f6f5c, hairRoot: 0x152720, accent: 0x9be8c8, cloth: 0xeaf7f0, trim: 0x4f8f75, eye: 0xffd95e, skin: 0xfbe3d6 },
    mods: [
      { stat: 'maxHp', op: 'mul', value: 0.3 },
      { stat: 'regen', op: 'add', value: 0.4 },
    ],
  },
  {
    id: 'byeongna',
    name: '벽라',
    path: '만독곡 약사',
    desc: '독과 약이 한 뿌리임을 아는 만독곡의 어린 약사.',
    traits: ['범위 +20%', '지속피해 법보 위력 +20%'],
    startWeapon: 'venomMist',
    palette: { hair: 0x4a7d42, hairRoot: 0x1a2e18, accent: 0x9ee86a, cloth: 0x4f7a3e, trim: 0xe0f0b0, eye: 0x7ad84a, skin: 0xfbe3d6 },
    mods: [
      { stat: 'area', op: 'add', value: 0.2 },
      { stat: 'tagMight', op: 'add', value: 0.2, tag: 'array' },
    ],
  },
  {
    id: 'mukyeon',
    name: '묵연',
    path: '무영문 암기수',
    desc: '그림자에서 나고 자란 무영문의 암기수. 발소리가 없다.',
    traits: ['재시전 -12%', '치명타 확률 +12%'],
    startWeapon: 'hiddenNeedles',
    palette: { hair: 0x2e2745, hairRoot: 0x0f0b1a, accent: 0xb08cff, cloth: 0x2e2842, trim: 0x8f74d0, eye: 0xc4a4ff, skin: 0xf6ddd0 },
    mods: [
      { stat: 'cooldown', op: 'add', value: -0.12 },
      { stat: 'critChance', op: 'add', value: 0.12 },
    ],
  },
  {
    id: 'baengno',
    name: '백로',
    path: '천음각 율사',
    desc: '금(琴) 한 줄로 산을 울린다는 천음각의 율사.',
    traits: ['획득 범위 +50%', '경험치 +20%'],
    startWeapon: 'bellToll',
    palette: { hair: 0xf3e3b8, hairRoot: 0x8d6c38, accent: 0xffd98a, cloth: 0xc9a94e, trim: 0xfff2c8, eye: 0xf0b840, skin: 0xfbe3d6 },
    mods: [
      { stat: 'magnet', op: 'mul', value: 0.5 },
      { stat: 'growth', op: 'mul', value: 0.2 },
    ],
  },
]

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id)
}
