/**
 * 법보 — the auto-firing weapons.
 *
 * Level fields combine with the player's stats as:
 *   cooldown -> level.cooldown * stats.cooldown
 *   amount   -> level.amount + stats.amount
 *   speed    -> level.speed * stats.speedProj
 *   area     -> level.area * stats.area
 *   duration -> level.duration * stats.duration
 *   damage   -> passed raw into rollDamage, which applies might + tagMight
 */
export const WEAPONS = [
  {
    id: 'flyingSword', name: '비검', tag: 'sword',
    desc: '가장 가까운 적을 추적하는 검을 날린다.',
    pairPassive: 'swordArt', evolvesTo: 'myriadSwords',
    levels: [
      { damage: 24, cooldown: 1.10, amount: 1, speed: 18, pierce: 2, area: 1.0, knockback: 2 },
      { damage: 30, cooldown: 1.05, amount: 2, speed: 18, pierce: 2, area: 1.0, knockback: 2 },
      { damage: 36, cooldown: 1.00, amount: 2, speed: 20, pierce: 3, area: 1.1, knockback: 2 },
      { damage: 44, cooldown: 0.90, amount: 3, speed: 20, pierce: 3, area: 1.1, knockback: 3 },
      { damage: 56, cooldown: 0.80, amount: 4, speed: 22, pierce: 4, area: 1.2, knockback: 3 },
    ],
  },
  {
    id: 'fireTalisman', name: '화염부', tag: 'fire',
    desc: '적에게 부적을 던져 터뜨리고 화상을 남긴다.',
    pairPassive: 'goldenCore', evolvesTo: 'infernoSea',
    levels: [
      { damage: 32, cooldown: 1.60, amount: 1, speed: 12, area: 1.0, burn: 4, duration: 3 },
      { damage: 40, cooldown: 1.50, amount: 1, speed: 12, area: 1.15, burn: 5, duration: 3 },
      { damage: 48, cooldown: 1.40, amount: 2, speed: 13, area: 1.25, burn: 6, duration: 3.5 },
      { damage: 60, cooldown: 1.30, amount: 2, speed: 13, area: 1.4, burn: 8, duration: 4 },
      { damage: 76, cooldown: 1.15, amount: 3, speed: 14, area: 1.6, burn: 10, duration: 4 },
    ],
  },
  {
    id: 'thunderOrb', name: '뇌령주', tag: 'thunder',
    desc: '몸 주위를 도는 뇌기 구슬이 닿는 적을 지진다.',
    pairPassive: 'spiritRoot', evolvesTo: 'violetThunder',
    levels: [
      { damage: 23, cooldown: 0.45, count: 2, area: 1.0, speed: 2.2, knockback: 2 },
      { damage: 29, cooldown: 0.45, count: 3, area: 1.0, speed: 2.4, knockback: 2 },
      { damage: 36, cooldown: 0.40, count: 4, area: 1.1, speed: 2.6, knockback: 2 },
      { damage: 45, cooldown: 0.40, count: 5, area: 1.2, speed: 2.8, knockback: 3 },
      { damage: 59, cooldown: 0.35, count: 6, area: 1.3, speed: 3.0, knockback: 3 },
    ],
  },
  {
    id: 'frostPalm', name: '빙백장', tag: 'ice',
    desc: '진행 방향으로 냉기를 뿜어 적을 얼려 붙인다.',
    pairPassive: 'guardianAura', evolvesTo: 'frozenSky',
    levels: [
      { damage: 14, cooldown: 2.20, area: 1.0, slow: 0.40, duration: 2.0, knockback: 4 },
      { damage: 18, cooldown: 2.10, area: 1.15, slow: 0.40, duration: 2.0, knockback: 4 },
      { damage: 23, cooldown: 2.00, area: 1.30, slow: 0.45, duration: 2.5, knockback: 5 },
      { damage: 29, cooldown: 1.85, area: 1.45, slow: 0.50, duration: 2.5, knockback: 5 },
      { damage: 38, cooldown: 1.70, area: 1.65, slow: 0.55, duration: 3.0, knockback: 6 },
    ],
  },
  {
    id: 'baguaArray', name: '팔괘진', tag: 'array',
    desc: '발밑에 진법을 펼쳐 범위 안의 적을 지속적으로 태운다.',
    levels: [
      { damage: 10, cooldown: 0.50, area: 1.0 },
      { damage: 12, cooldown: 0.48, area: 1.2 },
      { damage: 16, cooldown: 0.45, area: 1.4 },
      { damage: 20, cooldown: 0.42, area: 1.6 },
      { damage: 26, cooldown: 0.38, area: 1.9 },
    ],
  },
  {
    id: 'vajra', name: '금강저', tag: 'array',
    desc: '정면으로 금강저를 쏘아 모든 것을 꿰뚫고 밀어낸다.',
    levels: [
      { damage: 30, cooldown: 2.40, amount: 1, speed: 14, pierce: 999, area: 1.0, knockback: 10 },
      { damage: 38, cooldown: 2.30, amount: 1, speed: 15, pierce: 999, area: 1.15, knockback: 11 },
      { damage: 46, cooldown: 2.15, amount: 2, speed: 15, pierce: 999, area: 1.25, knockback: 12 },
      { damage: 58, cooldown: 2.00, amount: 2, speed: 16, pierce: 999, area: 1.40, knockback: 13 },
      { damage: 74, cooldown: 1.85, amount: 3, speed: 17, pierce: 999, area: 1.60, knockback: 15 },
    ],
  },
  {
    id: 'spiritButterfly', name: '영접부', tag: 'array',
    desc: '느리게 떠도는 영접이 적을 찾아 달라붙는다.',
    levels: [
      { damage: 7, cooldown: 1.80, amount: 3, speed: 5.0, pierce: 1, area: 1.0, duration: 6 },
      { damage: 9, cooldown: 1.70, amount: 4, speed: 5.0, pierce: 1, area: 1.0, duration: 6 },
      { damage: 11, cooldown: 1.60, amount: 6, speed: 5.5, pierce: 2, area: 1.1, duration: 7 },
      { damage: 14, cooldown: 1.50, amount: 8, speed: 5.5, pierce: 2, area: 1.1, duration: 7 },
      { damage: 18, cooldown: 1.35, amount: 10, speed: 6.0, pierce: 3, area: 1.2, duration: 8 },
    ],
  },
  {
    id: 'venomMist', name: '만독장', tag: 'array',
    desc: '발밑에서 독무가 피어올라 닿는 적을 서서히 녹인다.',
    pairPassive: 'lightBody', evolvesTo: 'plagueTide',
    levels: [
      { damage: 4, cooldown: 0.55, area: 1.0, burn: 3, duration: 3 },
      { damage: 5, cooldown: 0.52, area: 1.2, burn: 4, duration: 3.5 },
      { damage: 7, cooldown: 0.48, area: 1.4, burn: 5, duration: 4 },
      { damage: 9, cooldown: 0.44, area: 1.65, burn: 7, duration: 4.5 },
      { damage: 12, cooldown: 0.40, area: 1.95, burn: 9, duration: 5 },
    ],
  },
  {
    id: 'hiddenNeedles', name: '암기비침', tag: 'sword',
    desc: '소매에서 바늘을 흩뿌린다. 하나하나는 약하나 수가 많다.',
    pairPassive: 'farSight', evolvesTo: 'needleStorm',
    levels: [
      { damage: 6, cooldown: 0.95, amount: 4, speed: 20, pierce: 1, area: 1.0, knockback: 1 },
      { damage: 8, cooldown: 0.90, amount: 5, speed: 21, pierce: 1, area: 1.0, knockback: 1 },
      { damage: 10, cooldown: 0.85, amount: 7, speed: 22, pierce: 2, area: 1.1, knockback: 1 },
      { damage: 13, cooldown: 0.78, amount: 9, speed: 23, pierce: 2, area: 1.1, knockback: 2 },
      { damage: 17, cooldown: 0.70, amount: 12, speed: 25, pierce: 3, area: 1.2, knockback: 2 },
    ],
  },
  {
    id: 'bellToll', name: '금종파', tag: 'thunder',
    desc: '종을 울려 사방으로 음파를 밀어낸다. 닿는 적이 밀려난다.',
    levels: [
      { damage: 18, cooldown: 2.30, area: 1.0, knockback: 12 },
      { damage: 23, cooldown: 2.15, area: 1.2, knockback: 13 },
      { damage: 29, cooldown: 2.00, area: 1.4, knockback: 14 },
      { damage: 37, cooldown: 1.85, area: 1.6, knockback: 16 },
      { damage: 48, cooldown: 1.70, area: 1.9, knockback: 18 },
    ],
  },
  {
    id: 'windBlade', name: '청강인', tag: 'sword',
    desc: '바람의 칼날이 날아갔다가 되돌아온다.',
    levels: [
      { damage: 20, cooldown: 1.70, amount: 1, speed: 16, pierce: 999, area: 1.0, duration: 2.2, knockback: 3 },
      { damage: 25, cooldown: 1.60, amount: 1, speed: 17, pierce: 999, area: 1.15, duration: 2.3, knockback: 3 },
      { damage: 31, cooldown: 1.50, amount: 2, speed: 18, pierce: 999, area: 1.3, duration: 2.4, knockback: 4 },
      { damage: 39, cooldown: 1.38, amount: 2, speed: 19, pierce: 999, area: 1.45, duration: 2.5, knockback: 4 },
      { damage: 50, cooldown: 1.25, amount: 3, speed: 20, pierce: 999, area: 1.65, duration: 2.6, knockback: 5 },
    ],
  },
  {
    id: 'earthSpike', name: '지룡참', tag: 'array',
    desc: '땅을 뚫고 돌창이 솟아 적을 꿰뚫는다.',
    levels: [
      { damage: 26, cooldown: 2.10, amount: 3, area: 1.0, knockback: 6 },
      { damage: 33, cooldown: 1.95, amount: 4, area: 1.1, knockback: 6 },
      { damage: 41, cooldown: 1.80, amount: 6, area: 1.2, knockback: 7 },
      { damage: 52, cooldown: 1.65, amount: 8, area: 1.35, knockback: 8 },
      { damage: 68, cooldown: 1.50, amount: 10, area: 1.55, knockback: 9 },
    ],
  },
  {
    id: 'voidOrb', name: '혼원구', tag: 'ice',
    desc: '허공에 구를 띄워 주변의 적을 빨아들인다.',
    levels: [
      { damage: 9, cooldown: 0.60, amount: 1, speed: 7, area: 1.0, duration: 3.0 },
      { damage: 12, cooldown: 0.56, amount: 1, speed: 7, area: 1.2, duration: 3.2 },
      { damage: 15, cooldown: 0.52, amount: 2, speed: 8, area: 1.35, duration: 3.4 },
      { damage: 19, cooldown: 0.48, amount: 2, speed: 8, area: 1.5, duration: 3.6 },
      { damage: 25, cooldown: 0.44, amount: 3, speed: 9, area: 1.7, duration: 4.0 },
    ],
  },
  {
    id: 'skyThunder', name: '천뢰인', tag: 'thunder',
    desc: '하늘에서 벼락을 끌어내려 적을 내리친다.',
    levels: [
      { damage: 34, cooldown: 3.00, amount: 1, area: 1.0, knockback: 4 },
      { damage: 42, cooldown: 2.80, amount: 2, area: 1.1, knockback: 4 },
      { damage: 52, cooldown: 2.60, amount: 3, area: 1.2, knockback: 5 },
      { damage: 64, cooldown: 2.35, amount: 4, area: 1.3, knockback: 5 },
      { damage: 82, cooldown: 2.10, amount: 6, area: 1.5, knockback: 6 },
    ],
  },
]

export const EVOLUTIONS = [
  {
    id: 'myriadSwords', name: '만검귀종', tag: 'sword',
    desc: '하늘의 모든 검이 그대에게 돌아온다. 끊임없이 검비가 쏟아진다.',
    evolutionOf: 'flyingSword',
    levels: [{ damage: 34, cooldown: 0.22, amount: 2, speed: 26, pierce: 3, area: 1.6, knockback: 3 }],
  },
  {
    id: 'infernoSea', name: '분천화해', tag: 'fire',
    desc: '터진 자리에 불바다가 남아 계속 타오른다.',
    evolutionOf: 'fireTalisman',
    levels: [{ damage: 44, cooldown: 0.95, amount: 3, speed: 14, area: 1.9, burn: 14, duration: 5 }],
  },
  {
    id: 'violetThunder', name: '자소신뢰', tag: 'thunder',
    desc: '구슬에서 뻗은 뇌전이 주변의 적으로 연쇄한다.',
    evolutionOf: 'thunderOrb',
    levels: [{ damage: 32, cooldown: 0.30, count: 7, area: 1.5, speed: 3.4, knockback: 4, chain: 2, chainRange: 6 }],
  },
  {
    id: 'frozenSky', name: '한천빙봉', tag: 'ice',
    desc: '적을 완전히 얼려붙이고, 부서질 때 냉기가 터진다.',
    evolutionOf: 'frostPalm',
    levels: [{ damage: 52, cooldown: 1.40, area: 2.0, slow: 0.95, duration: 3, knockback: 7, shatter: 40 }],
  },
  {
    id: 'plagueTide', name: '만독창천', tag: 'array',
    desc: '독무가 온 비경에 퍼져 숨쉬는 모든 것을 좀먹는다.',
    evolutionOf: 'venomMist',
    levels: [{ damage: 16, cooldown: 0.30, area: 3.1, burn: 20, duration: 6 }],
  },
  {
    id: 'needleStorm', name: '만천화우', tag: 'sword',
    desc: '하늘을 가릴 만큼의 바늘이 사방으로 쏟아진다.',
    evolutionOf: 'hiddenNeedles',
    levels: [{ damage: 22, cooldown: 0.34, amount: 14, speed: 27, pierce: 3, area: 1.3, knockback: 2 }],
  },
]

const ALL_WEAPONS = [...WEAPONS, ...EVOLUTIONS]

export function getWeapon(id) {
  return ALL_WEAPONS.find((w) => w.id === id)
}
