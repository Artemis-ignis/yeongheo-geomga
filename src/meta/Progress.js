import { META_UPGRADES, getMetaUpgrade, metaCost } from '../data/metaUpgrades.js'
import { unlockCost } from '../data/unlocks.js'
import { defaultSave } from './Save.js'

/**
 * Runtime model over the save state.
 *
 * Pure logic — no DOM, no three.js — so the whole meta economy is unit testable.
 * Game owns one of these for the lifetime of the session and writes it back
 * through Save whenever it changes.
 */
export class Progress {
  constructor(saveState = defaultSave()) {
    this.state = saveState
  }

  get stones() {
    return this.state.stones
  }

  get records() {
    return this.state.records
  }

  levelOf(id) {
    return this.state.upgrades[id] ?? 0
  }

  isMaxed(id) {
    const up = getMetaUpgrade(id)
    return up ? this.levelOf(id) >= up.max : true
  }

  /** Cost of the next level, or null when maxed or unknown. */
  costOf(id) {
    const up = getMetaUpgrade(id)
    if (!up || this.isMaxed(id)) return null
    return metaCost(up, this.levelOf(id))
  }

  canAfford(id) {
    const cost = this.costOf(id)
    return cost !== null && this.stones >= cost
  }

  buyUpgrade(id) {
    if (!this.canAfford(id)) return false
    this.state.stones -= this.costOf(id)
    this.state.upgrades[id] = this.levelOf(id) + 1
    return true
  }

  /** StatMods to hand to computeStats, one copy per owned level. */
  get statMods() {
    const mods = []
    for (const up of META_UPGRADES) {
      const level = this.levelOf(up.id)
      for (let i = 0; i < level; i++) mods.push(...up.perLevel)
    }
    return mods
  }

  /** 재물운 — multiplier applied to 영석 carried out of a run. */
  get stoneMultiplier() {
    const up = getMetaUpgrade('fortune')
    return 1 + this.levelOf('fortune') * (up?.effectValue ?? 0)
  }

  /** 환혼단 — how many times a run can continue past death. */
  get reviveCharges() {
    const up = getMetaUpgrade('revive')
    return this.levelOf('revive') * (up?.effectValue ?? 0)
  }

  // ---- unlocks -------------------------------------------------------------

  _unlockList(kind) {
    return kind === 'characters' ? this.state.unlockedCharacters : this.state.unlockedWeapons
  }

  isUnlocked(kind, id) {
    return this._unlockList(kind).includes(id)
  }

  unlockCostOf(kind, id) {
    if (this.isUnlocked(kind, id)) return null
    return unlockCost(kind, id)
  }

  canAffordUnlock(kind, id) {
    const cost = this.unlockCostOf(kind, id)
    return cost !== null && this.stones >= cost
  }

  unlock(kind, id) {
    if (!this.canAffordUnlock(kind, id)) return false
    this.state.stones -= this.unlockCostOf(kind, id)
    this._unlockList(kind).push(id)
    return true
  }

  get unlockedWeapons() {
    return this.state.unlockedWeapons
  }

  get unlockedCharacters() {
    return this.state.unlockedCharacters
  }

  // ---- run bookkeeping -----------------------------------------------------

  addStones(amount) {
    const n = Math.max(0, Math.round(amount))
    this.state.stones += n
    return n
  }

  /** Record what the player has encountered, for the 도감. */
  markSeen(kind, id) {
    const list = this.state.seen[kind]
    if (!list || list.includes(id)) return false
    list.push(id)
    return true
  }

  hasSeen(kind, id) {
    return this.state.seen[kind]?.includes(id) ?? false
  }

  /** Fold a finished run into the lifetime records. Returns which bests improved. */
  recordRun({ runTime, level, kills, victory }) {
    const r = this.state.records
    const beat = { time: false, level: false }
    r.runs++
    if (victory) r.victories++
    r.totalKills += kills
    if (runTime > r.bestTime) { r.bestTime = runTime; beat.time = true }
    if (level > r.bestLevel) { r.bestLevel = level; beat.level = true }
    return beat
  }

  toSaveState() {
    return this.state
  }
}
