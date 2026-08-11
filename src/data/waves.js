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
 * From there the whole table is one geometric curve: every band is about 12.6%
 * heavier than the one before, so pressure doubles every 2.9 minutes and closes
 * at 104 spawns a second against 3.8 at the start. That is what this comment
 * claimed the table did long before it was true.
 *
 * It was back-loaded instead, and the middle paid for it. Counts sat between
 * 5.9 and 9.5 a second from 2:00 to 7:30 and then exploded, which on a maxed
 * 단전 produced a per-minute danger column of
 * 0,0,7,0,0,0,0,0,0,0,0,6,35,39,33 — eight consecutive minutes with nothing in
 * them at all. Filling the middle costs the fresh run about 10% of its length
 * (median 245 s to 221 s) and removes its dead minutes entirely: every minute
 * after the third now has something in it, where 27% of them did not.
 *
 * Numbers rather than damage, because her power plateaus — six 법보 and six 공법
 * all cap at level 5, so she is finished building by minute ten at a level no
 * amount of enemy health can answer. Raising enemy HP enough to make the last
 * five minutes bite needed roughly 34x and killed her at four minutes on the way
 * there; a quadratic steep at the end is steep in the middle too.
 *
 * Tuned against a scripted player that kites and dashes but does not aim, so a
 * competent human should have room where it dies.
 */
export const WAVES = [
  // Do not spend the first ninety seconds showing one repeated silhouette.
  // Duplicate ids are intentional weights: wisps stay the opening fodder while
  // authored melee reads are introduced one at a time. The ranged ghost arrives
  // only after the player has seen and understood those two melee reads.
  // 0-30s: ~3.03 enemies/s. Keep the first read to melee fodder and wolves.
  { t: 0, spawnInterval: 1.65, perSpawn: 5, types: ['wisp', 'wisp', 'wolf'] },
  // 30-60s: ~3.33 enemies/s. The charger is the first escalation.
  { t: 30, spawnInterval: 1.50, perSpawn: 5, types: ['wisp', 'wisp', 'wisp', 'wisp', 'wolf', 'jadeSerpent'] },
  // 60-120s: keep wisps dominant, but alternate a small melee/charger weight.
  // A full minute of one silhouette read as content repetition even though the
  // measured density was healthy; duplicated wisps preserve the survivable
  // economy while the returning wolf/serpent makes movement decisions visible.
  { t: 60, spawnInterval: 1.45, perSpawn: 6, types: [...Array(19).fill('wisp'), 'wolf'] },
  { t: 90, spawnInterval: 1.40, perSpawn: 7, types: [...Array(19).fill('wisp'), 'jadeSerpent'] },
  { t: 120, spawnInterval: 1.35, perSpawn: 8, types: [...Array(38).fill('wisp'), 'wolf', 'jadeSerpent'] },
  // 150s: wolves become a clearly recurring contact threat.
  { t: 150, spawnInterval: 1.30, perSpawn: 9, types: ['wisp', 'wisp', 'wolf'] },
  // 180s: ranged pressure arrives as the mid-boss enters; splitter remains a
  // later discovery in the unchanged 210s band.
  { t: 180, spawnInterval: 1.25, perSpawn: 10, types: ['wisp', 'wisp', 'wolf', 'talismanGhost'] },
  { t: 210, spawnInterval: 1.20, perSpawn: 10, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'jadeSerpent', 'emberSprite', 'frostWolf'] },
  { t: 240, spawnInterval: 1.15, perSpawn: 11, types: ['wisp', 'wolf', 'talismanGhost'] },
  { t: 270, spawnInterval: 1.10, perSpawn: 12, types: ['wolf', 'talismanGhost', 'bloodScorpion', 'jadeSerpent', 'ashRaven', 'snowWraith'] },
  { t: 300, spawnInterval: 1.05, perSpawn: 13, types: ['wisp', 'wolf', 'bloodScorpion'] },
  { t: 330, spawnInterval: 1.00, perSpawn: 14, types: ['wolf', 'stoneGhoul', 'bloodScorpion', 'jadeSerpent', 'ashRaven', 'snowWraith'] },
  { t: 360, spawnInterval: 0.95, perSpawn: 15, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 390, spawnInterval: 0.90, perSpawn: 16, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'magmaBrute', 'glacierWarden'] },
  // The ramp starts here.
  { t: 420, spawnInterval: 0.88, perSpawn: 17, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 450, spawnInterval: 0.84, perSpawn: 19, types: ['wolf', 'stoneGhoul', 'demonCultivator', 'magmaBrute', 'glacierWarden'] },
  { t: 480, boss: 'blueWolfKing', spawnInterval: 1.60, perSpawn: 4, types: ['wolf'] },
  { t: 510, spawnInterval: 0.82, perSpawn: 21, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 540, spawnInterval: 0.78, perSpawn: 22, types: ['wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 570, spawnInterval: 0.76, perSpawn: 24, types: ['wisp', 'wolf', 'talismanGhost', 'demonCultivator'] },
  { t: 600, spawnInterval: 0.72, perSpawn: 26, types: ['wolf', 'stoneGhoul', 'bloodScorpion', 'demonCultivator', 'magmaBrute', 'glacierWarden'] },
  { t: 630, spawnInterval: 0.70, perSpawn: 28, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 660, spawnInterval: 0.66, perSpawn: 30, types: ['wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 690, spawnInterval: 0.64, perSpawn: 33, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 720, spawnInterval: 0.60, perSpawn: 35, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'bloodScorpion', 'jadeSerpent', 'ashRaven', 'snowWraith'] },
  { t: 750, spawnInterval: 0.58, perSpawn: 38, types: ['wisp', 'wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 780, spawnInterval: 0.55, perSpawn: 40, types: ['wolf', 'talismanGhost', 'bloodScorpion', 'demonCultivator'] },
  { t: 810, spawnInterval: 0.52, perSpawn: 43, types: ['wisp', 'wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 840, spawnInterval: 0.50, perSpawn: 46, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'demonCultivator', 'magmaBrute', 'glacierWarden'] },
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

/**
 * When a boss appears, and which slot it fills. The wave table sets the timing;
 * the 비경 decides who walks out — see `scheduleFor`.
 */
export const BOSS_SCHEDULE = WAVES.filter((w) => w.boss)
  .map((w, i, all) => ({ t: w.t, id: w.boss, slot: i === all.length - 1 ? 'final' : 'mid' }))

/**
 * The schedule for a given 비경.
 *
 * Every stage declares `bosses: { mid, final }` and, until now, nothing read it:
 * the ids came straight off the wave table, so all three 비경 fought the same
 * two. The declaration was dead data that looked like a feature. This resolves
 * it, and falls back to whatever the wave table named for a stage that has not
 * chosen — which is what keeps a stage without its own boss working.
 */
export function scheduleFor(stage) {
  const chosen = stage?.bosses
  if (!chosen) return BOSS_SCHEDULE
  return BOSS_SCHEDULE.map((e) => ({ ...e, id: chosen[e.slot] ?? e.id }))
}
