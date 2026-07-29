/** 마기에 물든 요괴와 마수사들. `hp`/`damage`/`xp` are the values at run time 0:00. */
export const ENEMIES = [
  {
    id: 'wisp', name: '마기 잔영',
    hp: 8, speed: 2.4, damage: 6, radius: 0.45, kbResist: 0.0, xp: 1,
    behavior: 'chase', color: 0x8b6fd6, scale: 0.7,
  },
  {
    id: 'wolf', name: '요랑',
    hp: 16, speed: 4.2, damage: 10, radius: 0.55, kbResist: 0.1, xp: 2,
    behavior: 'dasher', color: 0x5f7fa8, scale: 0.85, dashInterval: 4.0,
  },
  {
    id: 'stoneGhoul', name: '석귀',
    hp: 90, speed: 1.5, damage: 18, radius: 0.95, kbResist: 0.7, xp: 5,
    behavior: 'chase', color: 0x7d7466, scale: 1.05,
  },
  {
    id: 'talismanGhost', name: '부적귀',
    hp: 22, speed: 2.0, damage: 8, radius: 0.55, kbResist: 0.2, xp: 3,
    behavior: 'ranged', color: 0xc7b56a, scale: 0.85,
    shootInterval: 2.5, keepDistance: 10, shotSpeed: 9, shotDamage: 8,
  },
  {
    id: 'bloodScorpion', name: '혈갈',
    hp: 34, speed: 3.0, damage: 12, radius: 0.7, kbResist: 0.3, xp: 4,
    behavior: 'splitter', color: 0xa3324a, scale: 0.95, splitInto: 2,
  },
  {
    id: 'demonCultivator', name: '마수사',
    hp: 160, speed: 3.4, damage: 22, radius: 0.85, kbResist: 0.5, xp: 15,
    behavior: 'dasher', color: 0x6b3fa0, scale: 1.0, elite: true, dashInterval: 4,
  },

  // ---- 청람비경 ----------------------------------------------------------
  {
    // A glass cannon: the fastest thing on the plateau and the hardest hitter
    // for its cost, but it dies to a single solid hit. Kill it on approach.
    id: 'jadeSerpent', name: '청사',
    hp: 20, speed: 5.0, damage: 16, radius: 0.5, kbResist: 0.1, xp: 3,
    behavior: 'dasher', color: 0x4fbf8a, scale: 0.9, dashInterval: 3.0,
  },

  // ---- 적염비경 ----------------------------------------------------------
  {
    id: 'emberSprite', name: '화정',
    hp: 14, speed: 3.6, damage: 9, radius: 0.5, kbResist: 0.05, xp: 2,
    behavior: 'chase', color: 0xff8a3c, scale: 0.75,
  },
  {
    id: 'magmaBrute', name: '용암귀',
    hp: 210, speed: 1.7, damage: 26, radius: 1.0, kbResist: 0.75, xp: 9,
    behavior: 'chase', color: 0xd0442a, scale: 1.15,
  },
  {
    id: 'ashRaven', name: '재까마귀',
    hp: 20, speed: 5.4, damage: 11, radius: 0.5, kbResist: 0.0, xp: 3,
    behavior: 'dasher', color: 0x8a5a4a, scale: 0.85, dashInterval: 2.6,
  },

  // ---- 한천비경 ----------------------------------------------------------
  {
    id: 'frostWolf', name: '설랑',
    hp: 26, speed: 4.4, damage: 12, radius: 0.55, kbResist: 0.15, xp: 3,
    behavior: 'dasher', color: 0xa8d8ea, scale: 0.9, dashInterval: 3.4,
  },
  {
    id: 'snowWraith', name: '설귀',
    hp: 40, speed: 2.2, damage: 14, radius: 0.6, kbResist: 0.25, xp: 5,
    behavior: 'ranged', color: 0xd0e8f4, scale: 1.0,
    shootInterval: 2.2, keepDistance: 11, shotSpeed: 10, shotDamage: 12,
  },
  {
    id: 'glacierWarden', name: '빙벽수',
    hp: 320, speed: 1.3, damage: 30, radius: 1.15, kbResist: 0.85, xp: 14,
    behavior: 'chase', color: 0x7fb4d8, scale: 1.3, elite: true,
  },
]

export const ENEMY_INDEX = new Map(ENEMIES.map((e, i) => [e.id, i]))

export function getEnemy(id) {
  return ENEMIES[ENEMY_INDEX.get(id)]
}

/** Enemies get tougher as the run goes on. Speed deliberately does not scale. */
export function scaledHp(enemy, minutes) {
  return enemy.hp * (1 + minutes * 0.28 + (minutes / 6) ** 2)
}

export function scaledDamage(enemy, minutes) {
  return enemy.damage * (1 + minutes * 0.06)
}

export function scaledXp(enemy, minutes) {
  return Math.ceil(enemy.xp * (1 + minutes * 0.05))
}
