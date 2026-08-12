import { META_UPGRADES, getMetaUpgrade, metaCost } from '../data/metaUpgrades.js'
import { unlockCost } from '../data/unlocks.js'
import { getTrial, unlockedTrials } from '../data/trials.js'
import { evaluate } from '../data/achievements.js'
import { defaultSave } from './Save.js'

/**
 * Runtime model over the save state.
 *
 * Pure logic — no DOM or renderer dependency — so the whole meta economy is unit testable.
 * Game owns one of these for the lifetime of the session and writes it back
 * through Save whenever it changes.
 */
export class Progress {
  constructor(saveState = defaultSave()) {
    this.state = saveState
    // Backfill anything a save predating a feature is missing. Save.load()
    // normalises too, but Progress is also constructed directly (tests, and any
    // future migration path), and a missing list here is a crash on first click.
    const base = defaultSave()
    for (const key of ['unlockedCharacters', 'unlockedWeapons', 'unlockedStages']) {
      if (!Array.isArray(this.state[key])) this.state[key] = [...base[key]]
    }
    if (!this.state.upgrades || typeof this.state.upgrades !== 'object') this.state.upgrades = {}
    if (!this.state.seen) this.state.seen = { ...base.seen }
    if (!Array.isArray(this.state.hintsSeen)) this.state.hintsSeen = []
    if (!Array.isArray(this.state.achievements)) this.state.achievements = []
    if (!Array.isArray(this.state.stagesCleared)) this.state.stagesCleared = []
    if (!this.state.records) this.state.records = { ...base.records }
    if (!Number.isFinite(this.state.stones)) this.state.stones = 0
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

  /**
   * 영석 carried out of a run: 재물운, times whatever 시련 the run was fought on.
   *
   * A tier that is harder and pays the same is a tier nobody sensible picks.
   */
  get stoneMultiplier() {
    const up = getMetaUpgrade('fortune')
    return (1 + this.levelOf('fortune') * (up?.effectValue ?? 0)) * getTrial(this.trial).stones
  }

  /**
   * 시련 — the hardest tier earned, and the one selected for the next run.
   *
   * The unlock is derived from `records.bestTime` rather than stored, so it can
   * never drift out of step with the record that earns it, and an old save
   * arrives with whatever its history already deserves.
   */
  get maxTrial() {
    return unlockedTrials(this.state.records?.bestTime ?? 0)
  }

  get trial() {
    return Math.min(this.state.trial ?? 0, this.maxTrial)
  }

  setTrial(id) {
    this.state.trial = Math.max(0, Math.min(id, this.maxTrial))
    return this.state.trial
  }

  /** 환혼단 — how many times a run can continue past death. */
  get reviveCharges() {
    const up = getMetaUpgrade('revive')
    return this.levelOf('revive') * (up?.effectValue ?? 0)
  }

  /** How many times a run may re-draw its 경지 돌파 cards. */
  get rerollCharges() {
    const up = getMetaUpgrade('insightRoll')
    return this.levelOf('insightRoll') * (up?.effectValue ?? 0)
  }

  /** How many options a run may strike from its pool for good. */
  get banishCharges() {
    const up = getMetaUpgrade('sealing')
    return this.levelOf('sealing') * (up?.effectValue ?? 0)
  }

  // ---- unlocks -------------------------------------------------------------

  _unlockList(kind) {
    if (kind === 'characters') return this.state.unlockedCharacters
    if (kind === 'stages') return this.state.unlockedStages
    return this.state.unlockedWeapons
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

  get achievements() {
    return this.state.achievements
  }

  hasAchievement(id) {
    return this.state.achievements.includes(id)
  }

  /** Career totals in the shape the career-scope 업적 tests expect. */
  get careerSummary() {
    const r = this.state.records
    return {
      runs: r.runs, victories: r.victories, totalKills: r.totalKills,
      bestTime: r.bestTime, bestLevel: r.bestLevel,
      unlockedCharacters: this.state.unlockedCharacters.length,
      unlockedWeapons: this.state.unlockedWeapons.length,
      stagesCleared: this.state.stagesCleared.length,
    }
  }

  /**
   * Bank every 업적 a finished run earned, and pay for them.
   *
   * Career records are updated by `recordRun` before this is called, so a run
   * that pushes a lifetime total over a threshold earns the career 업적 in the
   * same breath rather than one run later.
   */
  awardAchievements(run) {
    const earned = evaluate(run, this.careerSummary, this.state.achievements)
    for (const a of earned) {
      this.state.achievements.push(a.id)
      this.state.stones += a.stones ?? 0
    }
    return earned
  }

  /** Remember a completed 비경, which the 삼경답파 업적 counts. */
  markStageCleared(stageId) {
    if (!stageId || this.state.stagesCleared.includes(stageId)) return false
    this.state.stagesCleared.push(stageId)
    return true
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
