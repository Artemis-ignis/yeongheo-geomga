import { BASE_STATS, TAGS } from '../data/characters.js'
import { getPassive } from '../data/passives.js'

export const COOLDOWN_FLOOR = 0.4

/**
 * Rebuild the full stat block from scratch.
 *
 * Always recomputed from base — never patched incrementally — so a bad increment
 * can never drift the numbers over a 15-minute run.
 *
 *   value = (base + Σ add) * Π (1 + mul)
 *
 * `tagMight` is a separate map of element tag → additive damage bonus, so a trait
 * like 설령's "검류 법보 피해 +15%" applies to sword weapons only.
 */
export function computeStats(character, passiveLevels) {
  const adds = {}
  const muls = {}
  const tagMight = {}
  for (const tag of TAGS) tagMight[tag] = 0

  const apply = (mod) => {
    if (mod.stat === 'tagMight') {
      tagMight[mod.tag] += mod.value
      return
    }
    if (mod.op === 'add') adds[mod.stat] = (adds[mod.stat] ?? 0) + mod.value
    else muls[mod.stat] = (muls[mod.stat] ?? 1) * (1 + mod.value)
  }

  for (const mod of character.mods ?? []) apply(mod)

  for (const id in passiveLevels ?? {}) {
    const level = passiveLevels[id]
    if (!level) continue
    const passive = getPassive(id)
    if (passive === undefined) continue
    for (let i = 0; i < level; i++) {
      for (const mod of passive.perLevel) apply(mod)
    }
  }

  const out = { tagMight }
  for (const key in BASE_STATS) {
    out[key] = (BASE_STATS[key] + (adds[key] ?? 0)) * (muls[key] ?? 1)
  }
  if (out.cooldown < COOLDOWN_FLOOR) out.cooldown = COOLDOWN_FLOOR
  return out
}

/** Keep the player at the same health fraction when their max HP changes. */
export function applyMaxHpChange(currentHp, oldMax, newMax) {
  if (oldMax <= 0) return newMax
  return (currentHp / oldMax) * newMax
}
