/**
 * The current survival expedition spawn timeline, one band per 30 seconds.
 * `spawnInterval` is seconds between spawn pulses; `perSpawn` is enemies per pulse.
 */
export const RUN_SECONDS = 420

/**
 * Seven-minute pressure curve. It starts with readable packs that teach
 * movement and combat immediately, introduces silhouettes gradually, and
 * grows every band without turning the authored actors into an indistinct
 * debug stress crowd. Density and the shorter entry ring in
 * `CombatWorld2D` are tuned together; changing one requires replaying both the
 * fresh-save and progressed-save paths.
 */
export const WAVES = [
  // Do not spend the first ninety seconds showing one repeated silhouette.
  // Duplicate ids are intentional weights: wisps stay the opening fodder while
  // authored melee reads are introduced one at a time. The ranged ghost arrives
  // only after the player has seen and understood those two melee reads.
  // 0-30s: ~2.1 enemies/s. Four-body packs leave lanes between silhouettes.
  { t: 0, spawnInterval: 2.15, perSpawn: 4, types: ['wisp', 'wolf', 'jadeSerpent'] },
  // 30-60s: ~2.3 enemies/s. The charger is the first escalation.
  { t: 30, spawnInterval: 1.85, perSpawn: 4, types: ['wisp', 'wolf', 'jadeSerpent'] },
  // 60-120s: actual 1920/2560 play at 80-89% wisps still produced a repeated
  // purple wall even after the wisp gained eight authored poses. Preserve wisps
  // as the majority economy fodder and keep total spawn pressure unchanged, but
  // let the already-taught wolf and serpent own 33-40% of the silhouette mix.
  { t: 60, spawnInterval: 1.75, perSpawn: 5, types: ['wisp', 'wisp', 'wolf', 'wolf', 'jadeSerpent'] },
  { t: 90, spawnInterval: 1.75, perSpawn: 6, types: ['wisp', 'wisp', 'wolf', 'wolf', 'jadeSerpent'] },
  { t: 120, spawnInterval: 1.75, perSpawn: 7, types: ['wisp', 'wisp', 'wolf', 'wolf', 'jadeSerpent', 'jadeSerpent'] },
  // 150s: wolves become a clearly recurring contact threat.
  { t: 150, spawnInterval: 1.55, perSpawn: 7, types: ['wisp', 'wisp', 'wolf'] },
  // 180s: ranged pressure arrives as the mid-boss enters; splitter remains a
  // later discovery in the unchanged 210s band.
  { t: 180, spawnInterval: 1.55, perSpawn: 8, types: ['wisp', 'wisp', 'wolf', 'talismanGhost'] },
  { t: 210, spawnInterval: 1.40, perSpawn: 8, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'jadeSerpent', 'emberSprite', 'frostWolf'] },
  { t: 240, spawnInterval: 1.40, perSpawn: 9, types: ['wisp', 'wolf', 'talismanGhost'] },
  { t: 270, spawnInterval: 1.40, perSpawn: 10, types: ['wolf', 'talismanGhost', 'bloodScorpion', 'jadeSerpent', 'ashRaven', 'snowWraith'] },
  { t: 300, spawnInterval: 1.35, perSpawn: 11, types: ['wisp', 'wolf', 'bloodScorpion'] },
  { t: 330, spawnInterval: 1.30, perSpawn: 12, types: ['wolf', 'stoneGhoul', 'bloodScorpion', 'jadeSerpent', 'ashRaven', 'snowWraith'] },
  { t: 360, spawnInterval: 1.15, perSpawn: 13, types: ['wisp', 'wolf', 'talismanGhost', 'bloodScorpion'] },
  { t: 390, spawnInterval: 1.05, perSpawn: 14, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'magmaBrute', 'glacierWarden'] },
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
 * When a boss appears, and which slot it fills. This schedule owns timing while
 * the 비경 decides who walks out — see `scheduleFor`.
 */
export const BOSS_SCHEDULE = Object.freeze([
  Object.freeze({ t: 180, id: 'blueWolfKing', slot: 'mid' }),
  Object.freeze({ t: 330, id: 'darkHeavenLord', slot: 'final' }),
])

/**
 * The schedule for a given 비경.
 *
 * Every stage declares `bosses: { mid, final }`. The authored schedule provides
 * stable times and defaults; a stage may replace either boss without moving it.
 */
export function scheduleFor(stage) {
  const chosen = stage?.bosses
  if (!chosen) return BOSS_SCHEDULE
  return BOSS_SCHEDULE.map((e) => ({ ...e, id: chosen[e.slot] ?? e.id }))
}
