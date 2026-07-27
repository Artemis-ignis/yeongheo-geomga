/** 마기에 물든 요괴와 마수사들. `hp`/`damage`/`xp` are the values at run time 0:00. */
export const ENEMIES = [
  {
    id: 'wisp', name: '마기 잔영', hanja: '魔氣殘影',
    hp: 8, speed: 2.4, damage: 6, radius: 0.45, kbResist: 0.0, xp: 1,
    behavior: 'chase', color: 0x8b6fd6, scale: 0.7,
  },
  {
    id: 'wolf', name: '요랑', hanja: '妖狼',
    hp: 16, speed: 4.6, damage: 10, radius: 0.55, kbResist: 0.1, xp: 2,
    behavior: 'dasher', color: 0x5f7fa8, scale: 0.85, dashInterval: 3.2,
  },
  {
    id: 'stoneGhoul', name: '석귀', hanja: '石鬼',
    hp: 90, speed: 1.5, damage: 18, radius: 0.95, kbResist: 0.7, xp: 5,
    behavior: 'chase', color: 0x7d7466, scale: 1.05,
  },
  {
    id: 'talismanGhost', name: '부적귀', hanja: '符鬼',
    hp: 22, speed: 2.0, damage: 8, radius: 0.55, kbResist: 0.2, xp: 3,
    behavior: 'ranged', color: 0xc7b56a, scale: 0.85,
    shootInterval: 2.5, keepDistance: 10, shotSpeed: 9, shotDamage: 8,
  },
  {
    id: 'bloodScorpion', name: '혈갈', hanja: '血蝎',
    hp: 34, speed: 3.0, damage: 12, radius: 0.7, kbResist: 0.3, xp: 4,
    behavior: 'splitter', color: 0xa3324a, scale: 0.95, splitInto: 2,
  },
  {
    id: 'demonCultivator', name: '마수사', hanja: '魔修士',
    hp: 160, speed: 3.4, damage: 22, radius: 0.85, kbResist: 0.5, xp: 15,
    behavior: 'dasher', color: 0x6b3fa0, scale: 1.0, elite: true, dashInterval: 4,
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
