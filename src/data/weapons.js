/**
 * 법보(法寶) — the auto-firing weapons.
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
    id: 'flyingSword', name: '비검', hanja: '飛劍', tag: 'sword',
    desc: '가장 가까운 적을 추적하는 검을 날린다.',
    pairPassive: 'swordArt', evolvesTo: 'myriadSwords',
    levels: [
      { damage: 12, cooldown: 1.10, amount: 1, speed: 18, pierce: 2, area: 1.0, knockback: 2 },
      { damage: 15, cooldown: 1.05, amount: 2, speed: 18, pierce: 2, area: 1.0, knockback: 2 },
      { damage: 18, cooldown: 1.00, amount: 2, speed: 20, pierce: 3, area: 1.1, knockback: 2 },
      { damage: 22, cooldown: 0.90, amount: 3, speed: 20, pierce: 3, area: 1.1, knockback: 3 },
      { damage: 28, cooldown: 0.80, amount: 4, speed: 22, pierce: 4, area: 1.2, knockback: 3 },
    ],
  },
  {
    id: 'fireTalisman', name: '화염부', hanja: '火焰符', tag: 'fire',
    desc: '적에게 부적을 던져 터뜨리고 화상을 남긴다.',
    pairPassive: 'goldenCore', evolvesTo: 'infernoSea',
    levels: [
      { damage: 16, cooldown: 1.60, amount: 1, speed: 12, area: 1.0, burn: 4, duration: 3 },
      { damage: 20, cooldown: 1.50, amount: 1, speed: 12, area: 1.15, burn: 5, duration: 3 },
      { damage: 24, cooldown: 1.40, amount: 2, speed: 13, area: 1.25, burn: 6, duration: 3.5 },
      { damage: 30, cooldown: 1.30, amount: 2, speed: 13, area: 1.4, burn: 8, duration: 4 },
      { damage: 38, cooldown: 1.15, amount: 3, speed: 14, area: 1.6, burn: 10, duration: 4 },
    ],
  },
  {
    id: 'thunderOrb', name: '뇌령주', hanja: '雷靈珠', tag: 'thunder',
    desc: '몸 주위를 도는 뇌기 구슬이 닿는 적을 지진다.',
    pairPassive: 'spiritRoot', evolvesTo: 'violetThunder',
    levels: [
      { damage: 10, cooldown: 0.45, count: 2, area: 1.0, speed: 2.2, knockback: 2 },
      { damage: 13, cooldown: 0.45, count: 3, area: 1.0, speed: 2.4, knockback: 2 },
      { damage: 16, cooldown: 0.40, count: 4, area: 1.1, speed: 2.6, knockback: 2 },
      { damage: 20, cooldown: 0.40, count: 5, area: 1.2, speed: 2.8, knockback: 3 },
      { damage: 26, cooldown: 0.35, count: 6, area: 1.3, speed: 3.0, knockback: 3 },
    ],
  },
  {
    id: 'frostPalm', name: '빙백장', hanja: '氷魄掌', tag: 'ice',
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
    id: 'baguaArray', name: '팔괘진', hanja: '八卦陣', tag: 'array',
    desc: '발밑에 진법을 펼쳐 범위 안의 적을 지속적으로 태운다.',
    levels: [
      { damage: 5, cooldown: 0.50, area: 1.0 },
      { damage: 6, cooldown: 0.48, area: 1.2 },
      { damage: 8, cooldown: 0.45, area: 1.4 },
      { damage: 10, cooldown: 0.42, area: 1.6 },
      { damage: 13, cooldown: 0.38, area: 1.9 },
    ],
  },
  {
    id: 'vajra', name: '금강저', hanja: '金剛杵', tag: 'array',
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
    id: 'spiritButterfly', name: '영접부', hanja: '靈蝶符', tag: 'array',
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
    id: 'skyThunder', name: '천뢰인', hanja: '天雷引', tag: 'thunder',
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
    id: 'myriadSwords', name: '만검귀종', hanja: '萬劍歸宗', tag: 'sword',
    desc: '하늘의 모든 검이 그대에게 돌아온다. 끊임없이 검비가 쏟아진다.',
    evolutionOf: 'flyingSword',
    levels: [{ damage: 34, cooldown: 0.22, amount: 2, speed: 26, pierce: 3, area: 1.6, knockback: 3 }],
  },
  {
    id: 'infernoSea', name: '분천화해', hanja: '焚天火海', tag: 'fire',
    desc: '터진 자리에 불바다가 남아 계속 타오른다.',
    evolutionOf: 'fireTalisman',
    levels: [{ damage: 44, cooldown: 0.95, amount: 3, speed: 14, area: 1.9, burn: 14, duration: 5 }],
  },
  {
    id: 'violetThunder', name: '자소신뢰', hanja: '紫霄神雷', tag: 'thunder',
    desc: '구슬에서 뻗은 뇌전이 주변의 적으로 연쇄한다.',
    evolutionOf: 'thunderOrb',
    levels: [{ damage: 32, cooldown: 0.30, count: 7, area: 1.5, speed: 3.4, knockback: 4, chain: 2, chainRange: 6 }],
  },
  {
    id: 'frozenSky', name: '한천빙봉', hanja: '寒天氷封', tag: 'ice',
    desc: '적을 완전히 얼려붙이고, 부서질 때 냉기가 터진다.',
    evolutionOf: 'frostPalm',
    levels: [{ damage: 52, cooldown: 1.40, area: 2.0, slow: 0.95, duration: 3, knockback: 7, shatter: 40 }],
  },
]

const ALL_WEAPONS = [...WEAPONS, ...EVOLUTIONS]

export function getWeapon(id) {
  return ALL_WEAPONS.find((w) => w.id === id)
}
