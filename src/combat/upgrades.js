import { WEAPONS, getWeapon } from '../data/weapons.js'
import { PASSIVES, getPassive } from '../data/passives.js'

export const MAX_WEAPON_SLOTS = 6
export const MAX_PASSIVE_SLOTS = 6

const WEIGHT_OWNED_WEAPON = 100
const WEIGHT_OWNED_PASSIVE = 80
const WEIGHT_NEW_WEAPON = 60
const WEIGHT_NEW_PASSIVE = 50
const WEIGHT_EVOLUTION = 400
export const OPENING_WEAPON_FLOOR = 4
export const OPENING_DEFENSE_IDS = Object.freeze(['guardianAura', 'goldenCore'])

export const CONSUMABLES = [
  { kind: 'consumable', id: 'heal', name: '회춘단', desc: '기혈을 30% 회복한다.' },
  { kind: 'consumable', id: 'stones', name: '영석 주머니', desc: '영석 200개를 얻는다.' },
  { kind: 'consumable', id: 'purge', name: '정화부', desc: '화면 안의 모든 적을 소멸시킨다.' },
]

/**
 * Level the paired 공법 must reach before its 법보 can evolve.
 *
 * This was the 공법's own maximum, and that requirement was quietly deciding
 * every run. Maxing a 법보 is five correct picks out of a random three-card
 * draw and maxing its partner is five more, so an evolution cost ten of the
 * twenty-odd upgrades a first run ever sees — and only if the draw offered the
 * right pair. Measured over eight fresh-save runs it happened zero times.
 *
 * That mattered because evolutions are not a bonus here, they are the run.
 * Sorted by how long they lasted, runs split into two populations with nothing
 * between them: no evolution and dead at 240-285 s, or three evolutions and
 * alive at 815. The gate sat just past where runs end, so the game was a
 * lottery on whether the draw happened to hand over a matching pair in time.
 *
 * At 1 — the paired 공법 merely owned, which is the convention the genre
 * settled on — four runs in eight reach an evolution, the median run gains 14%,
 * and time spent inside contact range goes from 2.8% to 6.6%. Held in an object
 * so the balance probe can sweep it; the sweep is what found this.
 */
export const EVOLUTION_GATE = { passiveLevel: 1 }

/**
 * Luck only matters if it changes relative weights. The previous roll multiplied
 * every candidate by the same value, which cancels out during normalization and
 * made 연분/혜안 mathematically inert. It now favours run-defining opportunities
 * (new kit and especially evolutions) while owned incremental levels keep their
 * baseline weight.
 */
export function luckWeightMultiplier(luck, opportunity = 'owned') {
  const normalized = Math.min(3, Math.max(0.25, Number.isFinite(luck) ? luck : 1))
  if (opportunity === 'evolution') return normalized ** 1.5
  if (opportunity === 'new') return normalized
  return 1
}

/** A weapon can evolve once it is maxed and its paired 공법 has come far enough. */
export function canEvolve(loadout, weapon) {
  if (!weapon?.evolvesTo || !weapon.pairPassive) return false
  if (loadout.weapons[weapon.id] !== weapon.levels.length) return false
  const passive = getPassive(weapon.pairPassive)
  const needed = Math.min(passive.max, EVOLUTION_GATE.passiveLevel)
  return (loadout.passives[weapon.pairPassive] ?? 0) >= needed
}

function buildCandidates(loadout, stats, unlockedWeapons, banished) {
  const out = []
  const gone = (id) => banished !== null && banished !== undefined && banished.has(id)
  const luck = stats.luck ?? 1
  const weaponCount = Object.keys(loadout.weapons).length
  const passiveCount = Object.keys(loadout.passives).length

  for (const w of WEAPONS) {
    // A locked 법보 is invisible to the roll. Its evolution follows it, since an
    // evolution can only ever come from a weapon the player already has.
    if (unlockedWeapons && !unlockedWeapons.includes(w.id)) continue
    if (gone(w.id)) continue
    const level = loadout.weapons[w.id] ?? 0

    if (canEvolve(loadout, w) && !loadout.weapons[w.evolvesTo]) {
      const evo = getWeapon(w.evolvesTo)
      out.push({
        weight: WEIGHT_EVOLUTION * luckWeightMultiplier(luck, 'evolution'),
        choice: {
          kind: 'evolution', id: evo.id, name: evo.name,
          desc: evo.desc, replaces: w.id, fromLevel: level, toLevel: 1,
        },
      })
      continue
    }

    if (level === 0) {
      if (weaponCount >= MAX_WEAPON_SLOTS) continue
      out.push({
        weight: WEIGHT_NEW_WEAPON * luckWeightMultiplier(luck, 'new'),
        choice: { kind: 'weapon', id: w.id, name: w.name, desc: w.desc, fromLevel: 0, toLevel: 1 },
      })
    } else if (level < w.levels.length) {
      out.push({
        weight: WEIGHT_OWNED_WEAPON,
        choice: { kind: 'weapon', id: w.id, name: w.name, desc: w.desc, fromLevel: level, toLevel: level + 1 },
      })
    }
  }

  for (const p of PASSIVES) {
    if (gone(p.id)) continue
    const level = loadout.passives[p.id] ?? 0
    if (level >= p.max) continue
    if (level === 0 && passiveCount >= MAX_PASSIVE_SLOTS) continue
    out.push({
      weight: level === 0
        ? WEIGHT_NEW_PASSIVE * luckWeightMultiplier(luck, 'new')
        : WEIGHT_OWNED_PASSIVE,
      choice: { kind: 'passive', id: p.id, name: p.name, desc: p.desc, fromLevel: level, toLevel: level + 1 },
    })
  }

  return out
}

/**
 * Draw `count` distinct weighted choices without replacement.
 *
 * `unlockedWeapons` filters the pool to what the player owns permanently; pass
 * null (the default) to offer everything.
 */
/**
 * `banished` is a Set of ids the player has struck from this run's pool.
 *
 * With six weapon slots and six passive slots, a roll late in a run can offer
 * three things the player has deliberately not built toward, and without a way
 * to refuse, the 경지 돌파 that should be a decision becomes a formality. Banish
 * is the strongest of the three answers to that: reroll asks again, skip
 * declines once, banish means never again this run.
 */
export function rollUpgrades(loadout, stats, rng, count = 3, unlockedWeapons = null, banished = null) {
  const pool = buildCandidates(loadout, stats, unlockedWeapons, banished)
  const picked = []

  // The first highlighted card must never turn a fresh run into a lottery.
  // Until the player has four distinct 법보, reserve one random new 법보 as
  // card one. Once that floor is met, reserve one defensive 공법 if the build
  // has neither. The other two cards remain fully weighted choices and the
  // player may ignore the safety card; an unsophisticated first-card route is
  // simply guaranteed a viable foundation.
  const weaponCount = Object.keys(loadout.weapons).length
  let safetyIndex = -1
  if (weaponCount < OPENING_WEAPON_FLOOR) {
    const candidates = []
    for (let i = 0; i < pool.length; i++) {
      const choice = pool[i].choice
      if (choice.kind === 'weapon' && choice.fromLevel === 0) candidates.push(i)
    }
    if (candidates.length > 0) safetyIndex = candidates[rng.int(candidates.length)]
  } else if (!OPENING_DEFENSE_IDS.some((id) => (loadout.passives[id] ?? 0) > 0)) {
    safetyIndex = pool.findIndex(({ choice }) => (
      choice.kind === 'passive' && OPENING_DEFENSE_IDS.includes(choice.id)
    ))
  }
  if (safetyIndex >= 0 && picked.length < count) {
    picked.push(pool[safetyIndex].choice)
    pool.splice(safetyIndex, 1)
  }

  while (picked.length < count && pool.length > 0) {
    let total = 0
    for (const c of pool) total += c.weight
    let roll = rng.next() * total
    let index = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight
      if (roll <= 0) { index = i; break }
    }
    picked.push(pool[index].choice)
    pool.splice(index, 1)
  }

  // Everything maxed out — hand out consumables rather than an empty modal.
  let fallback = 0
  while (picked.length < count) {
    picked.push({ ...CONSUMABLES[fallback % CONSUMABLES.length] })
    fallback++
  }
  return picked
}

/** Mutate the loadout to reflect a taken choice. */
export function applyChoice(loadout, choice) {
  if (choice.kind === 'weapon') {
    loadout.weapons[choice.id] = choice.toLevel
  } else if (choice.kind === 'passive') {
    loadout.passives[choice.id] = choice.toLevel
  } else if (choice.kind === 'evolution') {
    delete loadout.weapons[choice.replaces]
    loadout.weapons[choice.id] = 1
  }
  // Consumables act on live run state, not the loadout — the caller resolves them.
}
