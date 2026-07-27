/**
 * The 15-minute spawn timeline, one band per 30 seconds.
 * `spawnInterval` is seconds between spawn pulses; `perSpawn` is enemies per pulse.
 */
export const RUN_SECONDS = 900

export const WAVES = [
  // The opening is deliberately sparse: at 0:00 the player has one level-1 법보
  // and cannot clear a crowd. Pressure roughly doubles every three minutes.
  { t: 0, spawnInterval: 1.60, perSpawn: 2, types: ['wisp'] },
  { t: 30, spawnInterval: 1.50, perSpawn: 2, types: ['wisp'] },
  { t: 60, spawnInterval: 1.45, perSpawn: 3, types: ['wisp'] },
  { t: 90, spawnInterval: 1.40, perSpawn: 3, types: ['wisp', 'wolf'] },
  { t: 120, spawnInterval: 1.35, perSpawn: 3, types: ['wisp', 'wolf'] },
  { t: 150, spawnInterval: 1.30, perSpawn: 4, types: ['wisp', 'wolf', 'stoneGhoul'] },
  { t: 180, spawnInterval: 1.25, perSpawn: 4, types: ['wisp', 'wolf', 'stoneGhoul'] },
  { t: 210, spawnInterval: 1.20, perSpawn: 4, types: ['wolf', 'stoneGhoul', 'talismanGhost'] },
  { t: 240, spawnInterval: 1.15, perSpawn: 5, types: ['wisp', 'wolf', 'talismanGhost'] },
  { t: 270, spawnInterval: 1.10, perSpawn: 5, types: ['wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 300, spawnInterval: 1.05, perSpawn: 5, types: ['wisp', 'wolf', 'bloodScorpion'] },
  { t: 330, spawnInterval: 1.00, perSpawn: 6, types: ['wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 360, spawnInterval: 0.95, perSpawn: 6, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 390, spawnInterval: 0.90, perSpawn: 6, types: ['wolf', 'stoneGhoul', 'talismanGhost'] },
  { t: 420, spawnInterval: 0.88, perSpawn: 7, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 450, spawnInterval: 0.84, perSpawn: 7, types: ['wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 480, boss: 'blueWolfKing', spawnInterval: 1.60, perSpawn: 4, types: ['wolf'] },
  { t: 510, spawnInterval: 0.82, perSpawn: 8, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 540, spawnInterval: 0.78, perSpawn: 8, types: ['wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 570, spawnInterval: 0.76, perSpawn: 9, types: ['wisp', 'wolf', 'talismanGhost', 'demonCultivator'] },
  { t: 600, spawnInterval: 0.72, perSpawn: 9, types: ['wolf', 'stoneGhoul', 'bloodScorpion', 'demonCultivator'] },
  { t: 630, spawnInterval: 0.70, perSpawn: 10, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 660, spawnInterval: 0.66, perSpawn: 10, types: ['wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 690, spawnInterval: 0.64, perSpawn: 11, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
  { t: 720, spawnInterval: 0.60, perSpawn: 11, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'bloodScorpion'] },
  { t: 750, spawnInterval: 0.58, perSpawn: 12, types: ['wisp', 'wolf', 'stoneGhoul', 'demonCultivator'] },
  { t: 780, spawnInterval: 0.55, perSpawn: 13, types: ['wolf', 'talismanGhost', 'bloodScorpion', 'demonCultivator'] },
  { t: 810, spawnInterval: 0.52, perSpawn: 14, types: ['wisp', 'wolf', 'stoneGhoul', 'bloodScorpion'] },
  { t: 840, spawnInterval: 0.50, perSpawn: 15, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'demonCultivator'] },
  { t: 870, spawnInterval: 0.46, perSpawn: 16, types: ['wisp', 'wolf', 'bloodScorpion', 'demonCultivator'] },
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
