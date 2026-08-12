/**
 * 시련 — difficulty tiers the player opts into, unlocked by surviving.
 *
 * This exists because twelve enemy-side levers were swept against the same
 * problem and none of them could solve it. A 단전 bought out to the last level
 * gives 1.59x health, +5 armour, 1.4x might and 1.16x move speed, and by minute
 * five that build's clear rate exceeds anything the wave table can put in front
 * of it. Measured, minutes five through eleven ran at zero contact — with rings
 * of 1600-health elites, hastened past her own speed, arriving nine units away.
 * Enemy health is the only lever that moves it, and pushed far enough to matter
 * late it kills a fresh save at four minutes on the way there.
 *
 * The problem is that one enemy table has to serve a player with nothing and a
 * player who has bought everything, and no single table can. Every game this one
 * is measured against solves it the same way: the table scales, and the player
 * chooses when. So the reward for finishing the shop is not a quieter run, it is
 * permission to fight something that can actually reach you.
 *
 * Multipliers are read live by `EnemyManager`, `scaledHp` and the spawn loop
 * through `TRIAL`, so a tier costs no per-enemy state.
 *
 * `stones` is not a courtesy. A tier that is harder and pays the same is a tier
 * nobody sensible picks.
 */
export const TRIALS = [
  {
    id: 0, name: '평지',
    desc: '있는 그대로의 비경.',
    hp: 1, damage: 1, speed: 1, density: 1, stones: 1,
    unlockSeconds: 0,
  },
  {
    id: 1, name: '역풍',
    desc: '마기가 짙다. 요괴가 질기고 수가 늘어난다.',
    hp: 1.8, damage: 1.15, speed: 1.05, density: 1.35, stones: 1.4,
    unlockSeconds: 300,
  },
  {
    id: 2, name: '탁류',
    desc: '흐름이 탁하다. 밀려오는 것을 베어낼 수 없다.',
    hp: 3.2, damage: 1.35, speed: 1.1, density: 1.8, stones: 2.0,
    unlockSeconds: 420,
  },
  {
    id: 3, name: '겁화',
    desc: '겁의 불길. 한 순간도 멈춰 설 수 없다.',
    hp: 5.5, damage: 1.6, speed: 1.16, density: 2.4, stones: 2.8,
    unlockSeconds: 540,
  },
  {
    id: 4, name: '멸도',
    desc: '길이 끊긴 자리. 여기서 살아 돌아온 자는 없다.',
    hp: 9.0, damage: 1.9, speed: 1.22, density: 3.2, stones: 4.0,
    unlockSeconds: 660,
  },
]

export const TRIAL_INDEX = new Map(TRIALS.map((t) => [t.id, t]))

export function getTrial(id) {
  return TRIAL_INDEX.get(id) ?? TRIALS[0]
}

/**
 * Live tier multipliers. One object rather than a parameter threaded through
 * every spawn, because `scaledHp` is called from three places and the wave loop
 * reads density every pulse.
 */
export const TRIAL = { hp: 1, damage: 1, speed: 1, density: 1 }

export function applyTrial(id) {
  const t = getTrial(id)
  TRIAL.hp = t.hp
  TRIAL.damage = t.damage
  TRIAL.speed = t.speed
  TRIAL.density = t.density
  return t
}

/**
 * The highest tier a player has earned, given their best survival time.
 *
 * Unlocking on time survived rather than on victory means a player who is
 * clearly outgrowing a tier gets the next one without having to finish a
 * fifteen-minute run they are no longer learning anything from. Each tier is
 * gated on time at *any* tier, so grinding the easiest one still opens the
 * ladder — slowly.
 */
export function unlockedTrials(bestTime) {
  let n = 0
  for (const t of TRIALS) if (bestTime >= t.unlockSeconds) n = t.id
  return n
}
