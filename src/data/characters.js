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
  magnet: 3.0,
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
    palette: { hair: 0xdfe9f5, accent: 0x8fd0ff, cloth: 0xf2f7ff, trim: 0x6aa9d8, eye: 0x66c2ff, skin: 0xfbe3d6 },
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
    palette: { hair: 0x2b1c22, accent: 0xff7a4d, cloth: 0xd94b3a, trim: 0xe8c56a, eye: 0xffb347, skin: 0xfbe3d6 },
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
    palette: { hair: 0x36584a, accent: 0x9be8c8, cloth: 0xeaf7f0, trim: 0x4f8f75, eye: 0xffd95e, skin: 0xfbe3d6 },
    mods: [
      { stat: 'maxHp', op: 'mul', value: 0.3 },
      { stat: 'regen', op: 'add', value: 0.4 },
    ],
  },
]

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id)
}
