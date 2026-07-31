import { TRIAL } from './trials.js'

/**
 * 마기에 물든 요괴와 마수사들. `hp`/`damage`/`xp` are the values at run time 0:00.
 *
 * The roster carries twice the health, half the contact damage and twice the
 * 영기 it used to. All three together, because none of them works alone.
 *
 * The problem was that her 법보 were a wall. Measured, a run spent 2.6% of its
 * frames with any enemy inside contact range; with `damageOne` stubbed out so
 * her weapons did nothing, 27-33%. Her damage was absorbing the spawn table
 * whole, and nothing ever reached her — which is why enemy speed to 1.8x,
 * spawn density, entry distance, 회복 drops and knockback taken to zero all
 * moved the outcome by nothing.
 *
 * Health is the only lever that cuts her clear rate. On its own it fails: at 2x
 * health alone she kills half as much, earns half the 영기, and evolutions —
 * which decide the run outright — collapse from six runs in eight to two.
 * Doubling 영기 with it is what breaks that coupling, so toughness costs kill
 * *rate* without costing income. Halving contact damage is what stops the
 * resulting crowd from being instant death rather than pressure.
 *
 * Together, over eight fresh-save runs each:
 *
 *   frames inside contact range   2.6%  ->  18.3%
 *   median survival               266 s ->  280 s
 *   minutes after the third with
 *     no threat in them            67%  ->   28%
 *   level at death                  22  ->    29
 *   runs reaching an evolution     6/8  ->   6/8
 *
 * 3x/0.4x/3x was also measured: exposure 20% and every run evolving, but the
 * median falls to 233 s. 2x is the corner.
 *
 * Ranged damage (`shotDamage`) is deliberately not halved. Tagging every point
 * of damage by source, two runs in three took *all* of it from 부적귀 and 설귀
 * and none from contact, so the shots are the roster's real teeth and the
 * measurement above was taken with them left alone.
 */
export const ENEMIES = [
  {
    // Drifts in on a weave. It is a leftover of 마기, not a hunter.
    id: 'wisp', name: '마기 잔영',
    hp: 16, speed: 2.4, damage: 3, radius: 0.45, kbResist: 0.0, xp: 2,
    behavior: 'drifter', color: 0x8b6fd6, scale: 0.7,
    driftArc: 0.85, driftRate: 1.3,
  },
  {
    id: 'wolf', name: '요랑',
    hp: 32, speed: 4.2, damage: 5, radius: 0.55, kbResist: 0.1, xp: 4,
    behavior: 'dasher', color: 0x5f7fa8, scale: 0.85, dashInterval: 4.0,
  },
  {
    // Slow to start, hard to shake once it is moving.
    id: 'stoneGhoul', name: '석귀',
    hp: 180, speed: 1.5, damage: 9, radius: 0.95, kbResist: 0.7, xp: 10,
    behavior: 'lumberer', color: 0x7d7466, scale: 1.05,
    rampTime: 8, rampTo: 1.2, loseSight: 24,
  },
  {
    id: 'talismanGhost', name: '부적귀',
    hp: 44, speed: 2.0, damage: 4, radius: 0.55, kbResist: 0.2, xp: 6,
    behavior: 'ranged', color: 0xc7b56a, scale: 0.85,
    shootInterval: 2.5, keepDistance: 10, shotSpeed: 9, shotDamage: 8,
  },
  {
    id: 'bloodScorpion', name: '혈갈',
    hp: 68, speed: 3.0, damage: 6, radius: 0.7, kbResist: 0.3, xp: 8,
    behavior: 'splitter', color: 0xa3324a, scale: 0.95, splitInto: 2,
  },
  {
    // Reads noticeably larger than the rank and file. An elite that is the same
    // size as the trash around it is an elite the player does not notice until
    // it has already hit them.
    id: 'demonCultivator', name: '마수사',
    hp: 320, speed: 3.4, damage: 11, radius: 0.95, kbResist: 0.5, xp: 30,
    behavior: 'flanker', color: 0x6b3fa0, scale: 1.22, elite: true,
    flankArc: 0.95, flankClose: 5, flankSpread: 14,
  },

  // ---- 청람비경 ----------------------------------------------------------
  {
    // A glass cannon: the fastest thing on the plateau and the hardest hitter
    // for its cost, but it dies to a single solid hit. Kill it on approach.
    // Coils, then strikes in a straight line. The wind-up is the counterplay:
    // it hits harder than anything else this early and is dodgeable on sight.
    id: 'jadeSerpent', name: '청사',
    hp: 40, speed: 4.2, damage: 8, radius: 0.5, kbResist: 0.1, xp: 6,
    behavior: 'charger', color: 0x4fbf8a, scale: 0.9,
    chargeInterval: 2.9, chargeWindup: 0.5, chargeTime: 0.55, chargeSpeed: 3.6,
  },

  // ---- 적염비경 ----------------------------------------------------------
  {
    // Darts and stalls. Faster than she is, but only in bursts.
    id: 'emberSprite', name: '화정',
    hp: 28, speed: 3.6, damage: 5, radius: 0.5, kbResist: 0.05, xp: 4,
    behavior: 'flicker', color: 0xff8a3c, scale: 0.75, flickerRate: 5.2,
  },
  {
    id: 'magmaBrute', name: '용암귀',
    hp: 420, speed: 1.7, damage: 13, radius: 1.0, kbResist: 0.75, xp: 18,
    behavior: 'lumberer', color: 0xd0442a, scale: 1.15,
    rampTime: 7, rampTo: 1.35, loseSight: 26,
  },
  {
    // Dives and peels away rather than pressing, so it is a nuisance that
    // interrupts rather than a body in the wall.
    id: 'ashRaven', name: '재까마귀',
    hp: 40, speed: 5.4, damage: 6, radius: 0.5, kbResist: 0.0, xp: 6,
    behavior: 'skirmisher', color: 0x8a5a4a, scale: 0.85,
    skirmishRange: 2.4, skirmishBack: 0.6,
  },

  // ---- 한천비경 ----------------------------------------------------------
  {
    // Hunts as a pack: curves wide on the approach so a group arrives from
    // several sides at once instead of stacking into one line.
    id: 'frostWolf', name: '설랑',
    hp: 52, speed: 4.4, damage: 6, radius: 0.55, kbResist: 0.15, xp: 6,
    behavior: 'flanker', color: 0xa8d8ea, scale: 0.9,
    flankArc: 1.25, flankClose: 3.5, flankSpread: 11,
  },
  {
    id: 'snowWraith', name: '설귀',
    hp: 80, speed: 2.2, damage: 7, radius: 0.6, kbResist: 0.25, xp: 10,
    behavior: 'ranged', color: 0xd0e8f4, scale: 1.0,
    shootInterval: 2.2, keepDistance: 11, shotSpeed: 10, shotDamage: 12,
  },
  {
    // The slowest thing in the game and the hardest to escape once it starts.
    id: 'glacierWarden', name: '빙벽수',
    hp: 640, speed: 1.3, damage: 15, radius: 1.15, kbResist: 0.85, xp: 28,
    behavior: 'lumberer', color: 0x7fb4d8, scale: 1.3, elite: true,
    rampTime: 11, rampTo: 1.6, loseSight: 30,
  },
]

export const ENEMY_INDEX = new Map(ENEMIES.map((e, i) => [e.id, i]))

export function getEnemy(id) {
  return ENEMIES[ENEMY_INDEX.get(id)]
}

/**
 * How toughness grows over a run. Speed deliberately does not scale — a roster
 * that outruns the player removes the kiting the whole game is built on.
 *
 * Kept as data rather than literals inside `scaledHp` so `window.__sweep` can
 * move one term at a time and read the danger column back out. Every number
 * below was chosen from that table, not from taste.
 */
export const HP_SCALING = { linear: 0.28, quadPeriod: 6 }

/**
 * Enemies get tougher as the run goes on.
 *
 * The late game is answered by numbers, not health — see the note on WAVES.
 * Steepening the quadratic instead was tried twice and measured both times:
 * `quadPeriod` 4.6 lands inside run-to-run noise, and the 2.8 that does bite at
 * fifteen minutes kills the player at four on the way there, because a
 * quadratic steep at the end is steep in the middle too.
 *
 * A flat toughness multiplier over the whole curve was also tried, at 1.15, and
 * removed. It appeared to put danger into the first half of the run, but that
 * reading came from runs measured against a browser save with the entire 단전
 * bought — the confound `withMeta` in the balance probe now exists to prevent.
 * Compared properly on a fresh save it sits inside noise (223/264/223 seconds
 * against 233/270/195), and it costs the invariant that an enemy at 0:00 has the
 * health its table row says it has.
 *
 * The opening was fixed where the measurement actually pointed: more of them,
 * entering closer. See `WAVES` and `EnemyManager.SPAWN_RING`.
 */
export function scaledHp(enemy, minutes) {
  return enemy.hp * TRIAL.hp
    * (1 + minutes * HP_SCALING.linear + (minutes / HP_SCALING.quadPeriod) ** 2)
}

export function scaledDamage(enemy, minutes) {
  return enemy.damage * TRIAL.damage * (1 + minutes * 0.06)
}

export function scaledXp(enemy, minutes) {
  return Math.ceil(enemy.xp * (1 + minutes * 0.05))
}
