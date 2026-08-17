/**
 * The current survival expedition spawn timeline, one band per 30 seconds.
 * `spawnInterval` is seconds between spawn pulses; `perSpawn` is enemies per pulse.
 */
export const RUN_SECONDS = 420

/**
 * Optional 천겁 기록전 pressure curve. It starts with readable packs that teach
 * movement and combat immediately, introduces silhouettes gradually, and
 * grows every band without turning the authored actors into an indistinct
 * debug stress crowd. Density and the off-screen ingress frontier in
 * `CombatWorld2D` are tuned together; changing one requires replaying both the
 * fresh-save and progressed-save paths.
 */
export const WAVES = [
  // The opening now introduces the corrupted mountain ecology in layers.
  // Hunting hounds and the wisps trailing them establish one ink-dark faction first; the
  // brighter jade serpent arrives only after that contact language is learned.
  // The pack director fixes the first primary family to wisps, then adds hounds
  // on its supporting ingress arc.
  // 0-30s: ~1.9 enemies/s. Four-body packs leave lanes between silhouettes.
  { t: 0, spawnInterval: 2.15, perSpawn: 4, types: ['wisp', 'wolf'] },
  // 30-60s: ~2.2 enemies/s. The charger is the first colour and behavior escalation.
  { t: 30, spawnInterval: 1.85, perSpawn: 4, types: ['wisp', 'wolf', 'jadeSerpent'] },
  // 60-120s: actual 1920/2560 play at 80-89% wisps still produced a repeated
  // purple wall even after the wisp gained eight authored poses. Preserve wisps
  // as the majority economy fodder, let the already-taught wolf and serpent own
  // 33-40% of the silhouette mix, and keep the pressure curve climbing smoothly.
  { t: 60, spawnInterval: 2.10, perSpawn: 6, types: ['wisp', 'wisp', 'wolf', 'wolf', 'jadeSerpent'] },
  { t: 90, spawnInterval: 1.82, perSpawn: 7, types: ['wisp', 'wisp', 'wolf', 'wolf', 'jadeSerpent'] },
  { t: 120, spawnInterval: 1.70, perSpawn: 8, types: ['wisp', 'wisp', 'wolf', 'wolf', 'jadeSerpent', 'jadeSerpent'] },
  // 150s: wolves become a clearly recurring contact threat.
  { t: 150, spawnInterval: 1.60, perSpawn: 9, types: ['wisp', 'wisp', 'wolf'] },
  // 180s: ranged pressure arrives as the mid-boss enters; splitter remains a
  // later discovery in the following Jade-only band.
  { t: 180, spawnInterval: 1.55, perSpawn: 10, types: ['wisp', 'wisp', 'wolf', 'talismanGhost'] },
  { t: 210, spawnInterval: 1.23, perSpawn: 8, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'jadeSerpent'] },
  { t: 240, spawnInterval: 1.35, perSpawn: 9, types: ['wisp', 'wolf', 'talismanGhost'] },
  { t: 270, spawnInterval: 1.35, perSpawn: 10, types: ['wolf', 'stoneGhoul', 'talismanGhost', 'jadeSerpent'] },
  { t: 300, spawnInterval: 1.30, perSpawn: 11, types: ['wisp', 'wolf', 'stoneGhoul'] },
  { t: 330, spawnInterval: 1.25, perSpawn: 12, types: ['wolf', 'stoneGhoul', 'stoneGhoul', 'jadeSerpent'] },
  { t: 360, spawnInterval: 1.10, perSpawn: 13, types: ['wisp', 'wolf', 'talismanGhost', 'stoneGhoul'] },
  { t: 390, spawnInterval: 1.00, perSpawn: 14, types: ['wolf', 'stoneGhoul', 'talismanGhost'] },
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
