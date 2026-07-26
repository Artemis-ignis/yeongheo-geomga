/**
 * Pure damage math — no world state, no side effects, fully unit-testable.
 *
 * The mutating half (applying HP loss, spawning floating text, triggering death)
 * lives in EnemyManager alongside the arrays it mutates.
 */

/** Roll one hit: might + matching tag bonus, then a crit check. */
export function rollDamage(rawDamage, stats, tag, rng) {
  const tagBonus = stats.tagMight?.[tag] ?? 0
  let amount = rawDamage * (stats.might + tagBonus)
  const crit = rng.chance(stats.critChance)
  if (crit) amount *= stats.critMult
  return { amount: Math.max(1, Math.round(amount)), crit }
}

/** Knockback force after the target's resistance. */
export function knockbackImpulse(force, kbResist) {
  return Math.max(0, force * (1 - kbResist))
}

/** Incoming damage to the player after flat armor, floored at 1. */
export function mitigate(rawDamage, armor) {
  return Math.max(1, rawDamage - armor)
}
