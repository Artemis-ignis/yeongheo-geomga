/**
 * The 15-minute spawn timeline, one band per 30 seconds.
 * `spawnInterval` is seconds between spawn pulses; `perSpawn` is enemies per pulse.
 */
export const RUN_SECONDS = 900

/**
 * The opening used to be deliberately sparse, on the reasoning that a player
 * holding one level-1 법보 cannot clear a crowd. That reasoning was sound and
 * the numbers were far too timid. Measured on a fresh save — no 단전 at all,
 * which is what a first run actually is — it produced two and a half minutes in
 * which nothing ever came within contact range: 86% of the run's minutes at zero
 * threat, then death at 4:11 the moment 석귀 arrived with four times the health
 * of anything seen so far. Boring, then abrupt.
 *
 * The opening now starts at 3.8 spawns a second and climbs smoothly to the 9.5
 * the table already reached at 7:30, instead of crawling from 1.3. The first
 * attempt simply tripled the first six bands, which measured well and was wrong:
 * it put 9.2 a second at 2:30 and then dropped back to 3.2 at 3:00, a cliff
 * downward in the middle of the run. `test/waves.test.js` caught it, which is
 * the entire reason that test exists.
 *
 * Density cannot carry an opening by itself: more enemies is more 영기, which is
 * levels, which is damage, and the danger column barely moves. It works only in
 * company with the shorter entry ring in `EnemyManager.SPAWN_RING`, which is
 * what lets any of them arrive at all.
 *
 * From 7:00 the counts ramp to roughly three times what they were, and that is
 * where the run's only real threat comes from. Measured with `window.__probe`
 * over full runs, the shipped table let a scripted player finish 864 seconds of
 * 900 with her health never below 94% and eleven of fifteen minutes containing
 * no enemy within contact range at all. The cause is that her power plateaus —
 * six 법보 and six 공법 all cap at level 5, so she is finished building by
 * minute ten — at a level no amount of enemy health can answer. Raising enemy HP
 * to make the last five minutes bite needed roughly 34x, and that multiplier
 * killed her at four minutes on the way there; the quadratic term simply cannot
 * be steep late without being steep in the middle.
 *
 * Numbers are the answer, not damage. At these counts the late game holds three
 * to four hundred live enemies, her health falls to 63%, and danger exposure in
 * the last six minutes runs 13% to 40% instead of zero. Tuned against a scripted
 * player that kites and dashes but does not aim, so a competent human should
 * have room where it dies around 13:30.
 */
export const WAVES = [
  { t: 0, spawnInterval: 1.60, perSpawn: 6, types: ['wisp'] },
  { t: 30, spawnInterval: 1.50, perSpawn: 6, types: ['wisp'] },
  { t: 60, spawnInterval: 1.45, perSpawn: 7, types: ['wisp'] },
  { t: 90, spawnInterval: 1.40, perSpawn: 7, types: ['wisp', 'wolf'] },
  { t: 120, spawnInterval: 1.35, perSpawn: 8, types: ['wisp', 'wolf'] },
  { t: 150, spawnInterval: 1.30, perSpawn: 8, types: ['wisp', 'wolf', 'stoneGhoul', 'emberSprite', 'frostWolf'] },
  { t: 180, spawnInterval: 1.25, perSpawn: 8, types: ['wisp', 'wolf', 'stoneGhoul'] },
  { t: 210, spawnInterval: 1.20, perSpawn: 8, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'jadeSerpent', 'emberSprite', 'frostWolf'] },
  { t: 240, spawnInterval: 1.15, perSpawn: 8, types: ['wisp', 'wolf', 'talismanGhost'] },
  { t: 270, spawnInterval: 1.10, perSpawn: 8, types: ['wolf', 'talismanGhost', 'bloodScorpion', 'jadeSerpent', 'ashRaven', 'snowWraith'] },
  { t: 300, spawnInterval: 1.05, perSpawn: 8, types: ['wisp', 'wolf', 'bloodScorpion'] },
  { t: 330, spawnInterval: 1.00, perSpawn: 8, types: ['wolf', 'stoneGhoul', 'bloodScorpion', 'jadeSerpent', 'ashRaven', 'snowWraith'] },
  { t: 360, spawnInterval: 0.95, perSpawn: 8, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 390, spawnInterval: 0.90, perSpawn: 8, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'magmaBrute', 'glacierWarden'] },
  // The ramp starts here.
  { t: 420, spawnInterval: 0.88, perSpawn: 8, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 450, spawnInterval: 0.84, perSpawn: 8, types: ['wolf', 'stoneGhoul', 'demonCultivator', 'magmaBrute', 'glacierWarden'] },
  { t: 480, boss: 'blueWolfKing', spawnInterval: 1.60, perSpawn: 4, types: ['wolf'] },
  { t: 510, spawnInterval: 0.82, perSpawn: 11, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 540, spawnInterval: 0.78, perSpawn: 12, types: ['wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 570, spawnInterval: 0.76, perSpawn: 15, types: ['wisp', 'wolf', 'talismanGhost', 'demonCultivator'] },
  { t: 600, spawnInterval: 0.72, perSpawn: 16, types: ['wolf', 'stoneGhoul', 'bloodScorpion', 'demonCultivator', 'magmaBrute', 'glacierWarden'] },
  { t: 630, spawnInterval: 0.70, perSpawn: 19, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 660, spawnInterval: 0.66, perSpawn: 21, types: ['wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 690, spawnInterval: 0.64, perSpawn: 24, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 720, spawnInterval: 0.60, perSpawn: 26, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'bloodScorpion', 'jadeSerpent', 'ashRaven', 'snowWraith'] },
  { t: 750, spawnInterval: 0.58, perSpawn: 30, types: ['wisp', 'wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 780, spawnInterval: 0.55, perSpawn: 34, types: ['wolf', 'talismanGhost', 'bloodScorpion', 'demonCultivator'] },
  { t: 810, spawnInterval: 0.52, perSpawn: 38, types: ['wisp', 'wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 840, spawnInterval: 0.50, perSpawn: 43, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'demonCultivator', 'magmaBrute', 'glacierWarden'] },
  { t: 870, spawnInterval: 0.46, perSpawn: 48, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 900, boss: 'darkHeavenLord', spawnInterval: 2.00, perSpawn: 4, types: ['wisp', 'demonCultivator'] },
]

/** The wave band active at a given run time, clamped at both ends. */
export function waveAt(seconds) {
  const t = Math.max(0, seconds)
  let found = WAVES[0]
  for (let i = 0; i < WAVES.length; i++) {
    if (WAVES[i].t <= t) found = WAVES[i]
    else break
  }
  return found
}

/** Boss ids in spawn order, with the time each appears. */
export const BOSS_SCHEDULE = WAVES.filter((w) => w.boss).map((w) => ({ t: w.t, id: w.boss }))
