/**
 * 해금 — what a new player starts with, and what 영석 buys.
 *
 * Everything is a straight purchase rather than a hidden condition: a locked
 * item whose requirement is invisible just reads as missing content, and the
 * 영석 economy is the point of the meta layer anyway.
 */

export const STARTING_CHARACTERS = ['seolryeong']

export const STARTING_WEAPONS = ['flyingSword', 'fireTalisman', 'thunderOrb', 'baguaArray']

export const CHARACTER_UNLOCKS = [
  { id: 'hongryeon', cost: 600 },
  { id: 'cheongmyo', cost: 1400 },
  { id: 'byeongna', cost: 2000 },
  { id: 'mukyeon', cost: 2800 },
  { id: 'baengno', cost: 3600 },
]

export const WEAPON_UNLOCKS = [
  { id: 'frostPalm', cost: 300 },
  { id: 'vajra', cost: 450 },
  { id: 'hiddenNeedles', cost: 500 },
  { id: 'spiritButterfly', cost: 600 },
  { id: 'venomMist', cost: 700 },
  { id: 'skyThunder', cost: 800 },
  { id: 'windBlade', cost: 950 },
  { id: 'bellToll', cost: 1100 },
  { id: 'earthSpike', cost: 1300 },
  { id: 'voidOrb', cost: 1600 },
]

export const STAGE_UNLOCKS = [
  { id: 'ember', cost: 900 },
  { id: 'frost', cost: 2200 },
]

const CHARACTER_COSTS = new Map(CHARACTER_UNLOCKS.map((u) => [u.id, u.cost]))
const WEAPON_COSTS = new Map(WEAPON_UNLOCKS.map((u) => [u.id, u.cost]))
const STAGE_COSTS = new Map(STAGE_UNLOCKS.map((u) => [u.id, u.cost]))

/** Cost to unlock, or null if the id is not purchasable (already free, or unknown). */
export function unlockCost(kind, id) {
  const table = kind === 'characters' ? CHARACTER_COSTS
    : kind === 'stages' ? STAGE_COSTS
      : WEAPON_COSTS
  return table.has(id) ? table.get(id) : null
}
