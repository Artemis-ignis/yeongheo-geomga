import { AudioEngine } from '../audio/Audio.js'
import { applyChoice, CONSUMABLES, rollUpgrades } from '../combat/upgrades.js'
import { Clock, FIXED_DT } from '../core/Time.js'
import { Input } from '../core/Input.js'
import { RNG, makeSeed } from '../core/RNG.js'
import { getCharacter, CHARACTERS, isReleasePlayableCharacter } from '../data/characters.js'
import { getPassive } from '../data/passives.js'
import { realmFor } from '../data/realms.js'
import { getStage } from '../data/stages.js'
import { getTrial } from '../data/trials.js'
import { validateData } from '../data/validate.js'
import { getWeapon } from '../data/weapons.js'
import { Progress } from '../meta/Progress.js'
import * as Save from '../meta/Save.js'
import { CodexScreen } from '../ui/CodexScreen.js'
import { DebugOverlay } from '../ui/DebugOverlay.js'
import { HintOverlay } from '../ui/HintOverlay.js'
import { Hud, getDaoVowVisual } from '../ui/Hud.js'
import { LevelUpModal } from '../ui/LevelUpModal.js'
import { PauseScreen } from '../ui/PauseScreen.js'
import { ResultScreen } from '../ui/ResultScreen.js'
import { ShopScreen } from '../ui/ShopScreen.js'
import { TitleScreen } from '../ui/TitleScreen.js'
import { CombatWorld2D } from './CombatWorld2D.js'
import { FrameTelemetry2D } from './FrameTelemetry2D.js'
import { DaoVows2D } from './DaoVows2D.js'
import { CONTEST_PACING_DURATION_SECONDS, CONTEST_PACING_MILESTONE_2D } from './ContestPacing2D.js'
import { HitEventQueue2D } from './ParticleBudget2D.js'
import { PixiPresentation } from './PixiPresentation.js'
import { Quality2D } from './Quality2D.js'
import { validateSpriteManifest } from './spriteManifest.js'
import { mapChunkKey } from './WorldMap2D.js'
import { WorldInteractions2D } from './WorldInteractions2D.js'

const MAX_RENDER_FPS = 60
const GAME_RENDER_INTERVAL = 1000 / MAX_RENDER_FPS
const MENU_RENDER_INTERVAL = 1000 / 30
const BREAKTHROUGH_RADIUS = 8
// A breakthrough is the cadence break in the seven-minute loop. Restoring a
// small but visible amount here lets an ordinary build recover from one bad
// formation without turning the health bar into passive regeneration.
export const BREAKTHROUGH_HEAL_FRACTION_2D = 0.075
export const DAO_VOW_HEAL_FRACTION_2D = 0.12
export const EMERGENCY_HEAL_THRESHOLD_2D = 0.5
// Preserve the opening read: heroine, movement, automatic attack, and dash
// must all be visible before the first full-screen growth decision pauses play.
export const FIRST_LEVEL_MODAL_MIN_SECONDS_2D = 12
// A seven-minute run grants roughly thirty choices. The authored XP curve is
// part of the build fantasy, but two full-screen decisions only a few seconds
// apart make the opening feel like menu navigation rather than combat. Measure
// this in simulation time so time spent reading a card never counts as action.
export const GROWTH_CHOICE_MIN_GAMEPLAY_GAP_SECONDS_2D = 8
export const UPGRADE_RNG_SALT_2D = 0x51f15e37

export function upgradeSeedForRun2D(seed) {
  return ((Number(seed) >>> 0) ^ UPGRADE_RNG_SALT_2D) >>> 0
}

export function canOpenGrowthChoice2D(runTime, lastOpenedAt = Number.NEGATIVE_INFINITY) {
  if (!Number.isFinite(runTime) || runTime + 1e-6 < FIRST_LEVEL_MODAL_MIN_SECONDS_2D) return false
  if (!Number.isFinite(lastOpenedAt)) return true
  return runTime - lastOpenedAt + 1e-6 >= GROWTH_CHOICE_MIN_GAMEPLAY_GAP_SECONDS_2D
}
const RADAR_RADIUS = 72
const RADAR_REFRESH_SECONDS = 0.08
const DAO_MILESTONE_SECONDS = Object.freeze([20, 165, 270])
export const DAO_ICON_IDS_2D = Object.freeze({
  sword: 'sword',
  'returning-edge': 'returning-edge',
  'piercing-edge': 'piercing-edge',
  'sword-ring': 'sword-ring',
  frost: 'frost',
  'frost-shards': 'frost-shards',
  'frost-line': 'frost-line',
  'ice-wall': 'ice-wall',
  spirit: 'spirit',
  'purifying-heart': 'purifying-heart',
  'echoing-heart': 'echoing-heart',
  'shadow-copy': 'shadow-copy',
})
const DAO_ACTION_VOICE_BUDGET_2D = 3
const DAO_ACTION_AUDIO_COOLDOWN_MS_2D = Object.freeze({
  'sword-fan': 180,
  'frost-field': 360,
  'frost-wall': 700,
  'frost-death-shards': 320,
  'spirit-pickup-chain': 140,
  'spirit-overcharge': 900,
  'spirit-purge': 280,
  'spirit-shadow-pull': 800,
  'spirit-attack-clone': 800,
})
const DAO_ACTION_BANNERS_2D = Object.freeze({
  'frost-wall': '설맥 · 빙벽이 맞물렸습니다',
  'spirit-overcharge': '심맥 · 과충전',
  'spirit-purge': '심맥 · 대시 정화',
  'spirit-shadow-pull': '심맥 · 그림자 인력',
  'spirit-attack-clone': '심맥 · 공격 분신',
})
const DAO_ACTION_BANNER_COOLDOWN_MS_2D = 900

// This is the seed recorded by the latest local submission run.  quickStart
// uses it so screenshots, POI routes, formations, upgrade rolls, and boss
// patterns can all be replayed from one published identifier; the detailed
// setup flow keeps fresh random runs for normal play.
export const SHOWCASE_SEED_2D = 3185791507
export const SHOWCASE_RUN_MODE_2D = 'showcase'
export const NORMAL_RUN_MODE_2D = 'normal'

export function isShowcaseRunOptions(options) {
  return options?.mode === SHOWCASE_RUN_MODE_2D
}

function finiteSeed(value) {
  return Number.isFinite(value) ? (Number(value) >>> 0) : null
}

/**
 * Build the options used by the result-screen retry CTA.  The original run's
 * seed remains available in the result replay payload, while the retry is a
 * normal run and explicitly avoids accidentally drawing that same seed.
 */
export function normalRetryOptions2D(seed) {
  const avoidSeed = finiteSeed(seed)
  return avoidSeed === null
    ? { mode: NORMAL_RUN_MODE_2D }
    : { mode: NORMAL_RUN_MODE_2D, avoidSeed }
}

export function prioritizeEmergencyHeal2D(choices, hp, maxHp) {
  const offered = Array.isArray(choices) ? choices.slice() : []
  const ratio = Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 ? hp / maxHp : 1
  if (ratio > EMERGENCY_HEAL_THRESHOLD_2D || offered.some((choice) => choice.id === 'heal')) return offered
  const heal = CONSUMABLES.find((choice) => choice.id === 'heal')
  const replaceIndex = offered.findIndex((choice) => choice.kind !== 'evolution')
  if (heal && replaceIndex >= 0) offered.splice(replaceIndex, 1, { ...heal })
  return offered
}

export function seedForRun(options = null, randomSeed = null) {
  if (isShowcaseRunOptions(options)) return SHOWCASE_SEED_2D
  const candidate = Number.isFinite(randomSeed) ? (randomSeed >>> 0) : makeSeed()
  const avoidSeed = finiteSeed(options?.avoidSeed)
  if (avoidSeed !== null && candidate === avoidSeed) return (candidate + 1) >>> 0
  return candidate
}

/**
 * The contest entry must not inherit a saved trial, meta stat, revive, or
 * weapon unlock. Keep the user's Progress object for the menu and final
 * rewards, but give the showcase combat a pristine run-only Progress.
 */
export function progressForRun(baseProgress, options = null) {
  return isShowcaseRunOptions(options) ? new Progress(Save.defaultSave()) : baseProgress
}

// Before the 20-second milestone there is nothing to select yet. Describe the
// action the player can actually take instead of presenting a premature order.
const FIRST_VOW_OBJECTIVE_2D = '영기를 모아 첫 맹세를 준비하십시오'

function firstVowHudState2D(runTime, daoSnapshot) {
  if (Number(daoSnapshot?.milestone ?? 0) >= 1 || daoSnapshot?.choices?.pledge != null) return null
  const time = Number.isFinite(runTime) ? runTime : 0
  const countdown = Math.max(0, DAO_MILESTONE_SECONDS[0] - time)
  return {
    milestone: 'pledge',
    countdown,
    countdownSeconds: countdown,
    objective: FIRST_VOW_OBJECTIVE_2D,
    ready: countdown <= 1e-6,
  }
}

function daoRuntimeHudState2D(runtime) {
  if (!runtime) return null
  if (runtime.active === false && runtime.vowId == null) return null
  const active = runtime.active === true || runtime.vowId != null
  const gauge = Number.isFinite(runtime.gauge) ? runtime.gauge : null
  const gaugeMax = Number.isFinite(runtime.gaugeMax) ? runtime.gaugeMax : null
  const chain = Number.isFinite(runtime.spiritChain)
    ? runtime.spiritChain
    : Number.isFinite(runtime.chain) ? runtime.chain : null
  const overchargeActive = Boolean(runtime.overchargeActive)
  const overchargeRemaining = Number.isFinite(runtime.overchargeRemaining)
    ? runtime.overchargeRemaining : null
  return {
    active,
    vowId: runtime.vowId ?? null,
    gauge,
    gaugeMax,
    chain,
    spiritChain: chain,
    overcharge: overchargeActive,
    overchargeActive,
    overchargeRemaining,
  }
}

export function isHudLiveState(state) {
  return state === 'playing'
}

export class Game2D {
  constructor({ canvas, hudRoot, fallbackRoot = null }) {
    this.canvas = canvas
    this.hudRoot = hudRoot
    this.fallbackRoot = fallbackRoot
    this.state = 'boot'
    this.clock = new Clock()
    this.input = new Input(window)
    this.quality = new Quality2D()
    this.presentation = new PixiPresentation(canvas, this.quality)
    this.progress = new Progress(Save.load())
    this.audio = new AudioEngine()
    this.world = null
    this.interactions = null
    this.hitEvents = new HitEventQueue2D()
    this.telemetry = new FrameTelemetry2D({ capacity: 600, longTaskThresholdMs: 50 })
    this.daoVows = null
    this._daoSnapshot = null
    this._eliteEncounters = []
    this._interactionSnapshotKey = ''
    this.stage = null
    this.runCharacterId = null
    this.seed = 0
    this.runOptions = null
    this.runProgress = null
    this.pendingLevels = 0
    this._lastGrowthChoiceAt = Number.NEGATIVE_INFINITY
    this.rerolls = 0
    this.banishes = 0
    this.banished = new Set()
    this._lastFrameAt = undefined
    this._lastPresentedAt = undefined
    this._lastActualRenderAt = undefined
    this._presentedDt = 1 / 60
    this._renderBudgetMs = 0
    this._radarCacheAt = -Infinity
    this._radarCache = []
    this._radarCacheInteractionRevision = -1
    this._radarRevision = 0
    this._lastDir = 0
    this._perf = { workMs: 0, simMs: 0, drawMs: 0 }
    this._daoActionVoiceUsed = 0
    this._daoActionAudioAt = new Map()
    this._daoBannerAt = -Infinity
    this._warmupMs = 0
    this._lastDt = 1 / 60
    this._needsStaticRender = true
    this._hudNeedsRefresh = true
    this._raf = 0
    this._disposed = false
    this.viewZoom = this._loadViewZoom()

    this.hud = new Hud(hudRoot)
    this.modal = new LevelUpModal(hudRoot, this.audio)
    this.title = new TitleScreen(hudRoot, CHARACTERS, this.progress, this.audio)
    this.result = new ResultScreen(hudRoot, this.audio)
    this.shop = new ShopScreen(hudRoot, this.progress, () => this._persist())
    this.codex = new CodexScreen(hudRoot, this.progress)
    this.hints = new HintOverlay(hudRoot, this.progress)
    this.debug = new DebugOverlay(hudRoot)
    this.pause = new PauseScreen(hudRoot, {
      audio: this.audio,
      quality: this.quality,
      onResume: () => this._setPaused(false),
      onQuit: () => this._giveUp(),
    })
    this.hud.hide()

    this.banner = document.createElement('div')
    this.banner.className = 'runtime2d-banner'
    this.banner.hidden = true
    hudRoot.appendChild(this.banner)
    this.contextPanel = null
    this.interactionPrompt = document.createElement('div')
    this.interactionPrompt.className = 'runtime2d-interaction-prompt'
    this.interactionPrompt.hidden = true
    hudRoot.appendChild(this.interactionPrompt)

    // Unlock even while muted: a later M press must be able to resume the same
    // AudioContext in its user-gesture path instead of discovering a null graph
    // after the player has already entered a run.
    this._unlockAudio = () => {
      if (typeof this.audio.ensureUnlocked === 'function') this.audio.ensureUnlocked()
      else this.audio.unlock?.()
    }
    addEventListener('pointerdown', this._unlockAudio)
    addEventListener('keydown', this._unlockAudio)
    this._onResize = () => {
      this.presentation.resize()
      this._needsStaticRender = true
    }
    addEventListener('resize', this._onResize)
    this._onVisibility = () => {
      const hidden = Boolean(document.hidden)
      if (typeof this.audio.setVisibility === 'function') this.audio.setVisibility(hidden)
      else if (hidden) this.audio.suspend?.()
      else this.audio.resume?.()
      if (hidden && this.state === 'playing') this._setPaused(true)
    }
    document.addEventListener('visibilitychange', this._onVisibility)
  }

  async start() {
    if (this._disposed) return
    if (import.meta.env?.DEV) validateData()
    const manifestErrors = validateSpriteManifest()
    if (manifestErrors.length) throw new Error(`2D sprite manifest invalid: ${manifestErrors.join(', ')}`)
    const started = performance.now()
    await this.presentation.init()
    if (this._disposed) {
      // dispose() may have run while the initial asset load was pending. The
      // presentation owns the late-created Pixi app, so tear it down here too.
      this.presentation.destroy()
      return
    }
    this.presentation.setZoom(this.viewZoom)
    this._warmupMs = performance.now() - started
    this.presentation.onContextLost = () => this._handleContextLoss()
    this.presentation.onContextRestored = () => this._handleContextRestore()
    this._showTitle()
    this._raf = requestAnimationFrame((now) => this._frame(now))
  }

  _invalidateRadarCache() {
    this._radarCacheAt = -Infinity
    this._radarCache = []
    this._radarCacheInteractionRevision = -1
    this._radarRevision = (this._radarRevision ?? 0) + 1
  }

  _refreshDaoSnapshot() {
    this._daoSnapshot = this.daoVows?.snapshot?.() ?? null
    return this._daoSnapshot
  }

  _getDaoSnapshot() {
    if (!this.daoVows) return null
    return this._daoSnapshot ?? this._refreshDaoSnapshot()
  }

  _clearRunSession({ clearSelection = false } = {}) {
    const oldWorld = this.world
    if (oldWorld) {
      // A discarded world must not be able to call back into the next run after
      // an async asset load completes or rejects.
      oldWorld.onLevels = null
      oldWorld.onEnd = null
      oldWorld.onHit = null
      oldWorld.onPlayerHurt = null
      oldWorld.onPlayerHeal = null
      oldWorld.onPlayerDash = null
      oldWorld.onEnemyDeath = null
      oldWorld.onBossWarning = null
      oldWorld.onWeaponAudio = null
      oldWorld.onBossTelegraph = null
      oldWorld.onBossImpact = null
      oldWorld.onBossHit = null
      oldWorld.onBossDeath = null
      oldWorld.onPacingMilestone = null
      oldWorld.onFormation = null
      oldWorld.onDaoAction = null
      if (oldWorld.player) oldWorld.player.onHurt = null
    }
    this.world = null
    this.runProgress = null
    this.runOptions = null
    this.interactions = null
    this.rng = null
    this.upgradeRng = null
    this.daoVows = null
    this._daoSnapshot = null
    this._daoActionVoiceUsed = 0
    this._daoActionAudioAt = new Map()
    this._daoBannerAt = -Infinity
    this.hitEvents.clear()
    this.telemetry?.reset()
    this._eliteEncounters.length = 0
    this._interactionSnapshotKey = ''
    this.pendingLevels = 0
    this._lastGrowthChoiceAt = Number.NEGATIVE_INFINITY
    this.rerolls = 0
    this.banishes = 0
    this.banished = new Set()
    this.seed = 0
    this._invalidateRadarCache()
    this._hudNeedsRefresh = true
    this.interactionPrompt.hidden = true
    this.hud.hide()
    this.hints.hide()
    this.pause.hide()
    this.modal.close()
    // Menu sub-screens are separate full-screen nodes. A queued native button
    // activation during retry/loading used to leave the codex over a live run.
    // Hide them without firing their return-to-title callbacks whenever a run
    // or title transition takes ownership of the screen.
    this.shop?.hide?.()
    this.codex?.hide?.()
    this.audio.stopMusic?.()
    this.audio.setDucked?.(false)
    this.input.consumeInteract?.()
    if (clearSelection) {
      this.stage = null
      this.runCharacterId = null
    }
  }

  _showTitle() {
    this._clearRunSession({ clearSelection: true })
    this.state = 'title'
    this._lastActualRenderAt = undefined
    this.hud.reset?.()
    this.result.hide()
    this.presentation.showTitle()
    this.title.show({
      onStart: (id, stageId, options) => this._startRun(id, stageId, options),
      onUnlock: () => this._persist(),
      onShop: () => {
        if (this.state !== 'title') return
        this.state = 'shop'
        this.title.hide()
        this.shop.show(() => { this.state = 'title'; this.title.show() })
      },
      onCodex: () => {
        if (this.state !== 'title') return
        this.state = 'codex'
        this.title.hide()
        this.codex.show(() => { this.state = 'title'; this.title.show() })
      },
    })
    this._needsStaticRender = true
  }

  async _startRun(characterId, stageId, options = null) {
    if (this._disposed) return
    if (this.state === 'loading') return
    const selectedCharacterId = isReleasePlayableCharacter(characterId) ? characterId : 'seolryeong'
    this.state = 'loading'
    this._clearRunSession()
    const avoidSeed = finiteSeed(options?.avoidSeed)
    this.runOptions = isShowcaseRunOptions(options)
      ? { mode: SHOWCASE_RUN_MODE_2D }
      : options?.mode === NORMAL_RUN_MODE_2D
        ? {
            mode: NORMAL_RUN_MODE_2D,
            ...(avoidSeed === null ? {} : { avoidSeed }),
          }
        : null
    this.runProgress = progressForRun(this.progress, this.runOptions)
    this.runCharacterId = selectedCharacterId
    this._banner('비경을 펼치는 중…', 0)
    this.title.hide()
    this.result.hide()
    this.stage = getStage(stageId ?? 'jade')
    this.hud.reset?.()
    this.presentation.showTitle()

    try {
      const unlocked = typeof this.audio.ensureUnlocked === 'function'
        ? this.audio.ensureUnlocked()
        : this.audio.unlock?.()
      if (!this.audio.muted && unlocked !== false) {
        this.audio.startMusic(this.stage?.id ?? 'jade')
      }
      await this.presentation.prepareRunAssets(this.stage?.id ?? 'jade')
    } catch (error) {
      if (this._disposed) return
      console.error('2D run assets failed to load', error)
      this._showTitle()
      this._banner('비경 자원을 불러오지 못했습니다. 다시 시도해 주세요.', 3)
      return
    }

    if (this._disposed) return
    // Asset preparation is asynchronous. Reassert exclusive screen ownership
    // before publishing `playing`, even if a stale focused menu button emitted
    // a native click while the title was disappearing.
    this.shop?.hide?.()
    this.codex?.hide?.()

    this.seed = seedForRun(this.runOptions)
    this.rng = new RNG(this.seed)
    // Combat hit rolls are intentionally noisy. Keep the three offered growth
    // cards on their own deterministic stream so a Dao that fires more often
    // cannot silently reroll the player's entire build.
    this.upgradeRng = new RNG(upgradeSeedForRun2D(this.seed))
    this.interactions = new WorldInteractions2D({ seed: this.seed, stageId: this.stage?.id ?? 'jade' })
    this.hitEvents.clear()
    this._eliteEncounters.length = 0
    this._interactionSnapshotKey = ''
    this.pendingLevels = 0
    this._lastGrowthChoiceAt = Number.NEGATIVE_INFINITY
    this.rerolls = this.runProgress.rerollCharges
    this.banishes = this.runProgress.banishCharges
    this.banished = new Set()
    this._invalidateRadarCache()
    this.daoVows = new DaoVows2D()
    this._refreshDaoSnapshot()
    this.world = new CombatWorld2D({
      character: getCharacter(selectedCharacterId), stage: this.stage, progress: this.runProgress, rng: this.rng,
      daoVows: this.daoVows,
    })
    this.world.onLevels = (levels) => this._breakthrough(levels)
    this.world.onEnd = (victory) => this._endRun(victory)
    this.world.onHit = (x, z, tag, crit, amount) => {
      this.hitEvents.enqueue(x, z, tag, crit, amount)
    }
    this.world.onWeaponAudio = (event) => this._playWeaponAudio(event)
    this.world.onBossTelegraph = (event) => this._playBossCue('telegraph', event)
    this.world.onBossImpact = (event) => this._playBossCue('impact', event)
    this.world.onBossHit = (event) => this._playBossCue('hit', event)
    this.world.onBossDeath = (event) => this._playBossCue('death', event)
    this.world.onPlayerHurt = (amount) => {
      const player = this.world?.player
      this.audio.play('hurt')
      if (!player) return
      this.world.effects.spawn(1, player.x, player.z, 0.24, 1.6, 0xff6f78)
      this.presentation?.spawnDamageNumber?.(player.x, player.z, amount, false, 'hurt')
    }
    this.world.onPlayerHeal = (amount) => {
      const player = this.world?.player
      this.audio.play('heal')
      if (!player) return
      this.world.effects.spawn(2, player.x, player.z, 0.38, 2.8, 0x73e3bd)
      this.presentation?.spawnDamageNumber?.(player.x, player.z, amount, false, 'heal')
    }
    this.world.onPlayerDash = (event) => {
      this.audio.play('dash', { pan: this._panAt(event?.toX ?? this.world?.player?.x ?? 0) })
    }
    this.world.onEnemyDeath = (event) => {
      this.audio.play('kill', {
        pan: this._panAt(event?.x ?? this.world?.player?.x ?? 0),
        priority: event?.elite ? 58 : 46,
      })
    }
    this.world.onBossWarning = (def, encounter = null) => {
      const final = encounter?.final === true
      this.audio.play(final ? 'finalBoss' : 'boss')
      this._banner(final ? `최종 마존 · ${def.name}` : def.name, final ? 2.8 : 2)
      this.progress.markSeen('bosses', def.id)
    }
    this.world.onPacingMilestone = (event) => {
      if (event.id === CONTEST_PACING_MILESTONE_2D.poiEmphasis) {
        this._banner('비경의 영맥이 열렸습니다 · 표식을 찾아가세요', 2.6)
      } else if (event.id === CONTEST_PACING_MILESTONE_2D.hardTimeout) {
        this.audio.play('timeout')
        this._banner('천겁의 시간이 다했습니다', 2)
      }
    }
    this.world.onFormation = (event) => {
      const name = event.kind === 'ring' ? '포위진' : event.kind === 'pincer' ? '협격진' : '벽진'
      this.audio.play('formation', { pan: this._audioPanFor(event) })
      this._banner(`마기의 진 · ${name}`, 1.8)
    }
    this.world.onDaoAction = (action) => this._handleDaoAction(action)
    this._refreshWorldInteractions(true)
    this.presentation.startRun(this.world.snapshot)
    this.hud.show()
    this._hideBanner()
    this.state = 'playing'
    this.clock.reset()
    this._lastActualRenderAt = undefined
    this._presentedDt = 1 / 60
    this._needsStaticRender = true
  }

  _persist() {
    this.hints.persistInto(this.progress.state)
    Save.save(this.progress.toSaveState())
  }

  _loadViewZoom() {
    try {
      const saved = JSON.parse(localStorage?.getItem('yeongheo.view') ?? 'null')
      return Number.isFinite(saved?.zoom) ? Math.max(0.85, Math.min(1.25, saved.zoom)) : 1
    } catch {
      return 1
    }
  }

  _saveViewZoom() {
    try {
      localStorage?.setItem('yeongheo.view', JSON.stringify({ zoom: this.viewZoom }))
    } catch {
      // The setting remains valid for this session when storage is unavailable.
    }
  }

  _banner(text, seconds = 1.4) {
    this.banner.textContent = text
    this.banner.hidden = false
    this.banner.classList.remove('show')
    void this.banner.offsetWidth
    this.banner.classList.add('show')
    clearTimeout(this._bannerTimer)
    if (seconds > 0) this._bannerTimer = setTimeout(() => this._hideBanner(), seconds * 1000)
  }

  _hideBanner() {
    clearTimeout(this._bannerTimer)
    this.banner.hidden = true
  }

  _breakthrough(levels) {
    if (!this.world || this.state !== 'playing') return
    const player = this.world.player
    this.audio.play('breakthrough')
    this.world.effects.spawn(2, player.x, player.z, 0.8, BREAKTHROUGH_RADIUS, 0x9edfff)
    this.world.enemies.damageAt(player.x, player.z, BREAKTHROUGH_RADIUS, 20 + player.level * 4, 'array')
    this.world.flushEnemyDeaths?.()
    player.heal(player.maxHp * BREAKTHROUGH_HEAL_FRACTION_2D * Math.max(1, levels), 'breakthrough')
    player.invulnTimer = Math.max(player.invulnTimer, 1.2)
    this.pendingLevels += levels
  }

  _openNextModal(refunded = false) {
    if (!this.world || this.modal.isOpen) return
    if (!refunded && !canOpenGrowthChoice2D(this.world.runTime, this._lastGrowthChoiceAt)) return
    if (!refunded) {
      if (!Number.isFinite(this.pendingLevels) || this.pendingLevels <= 0) return
      this.pendingLevels--
    }
    const player = this.world.player
    const choices = prioritizeEmergencyHeal2D(rollUpgrades(
      player.loadout, player.stats, this.upgradeRng ?? this.rng, 3,
      this.runProgress?.unlockedWeapons ?? this.progress.unlockedWeapons, this.banished,
    ), player.hp, player.maxHp)
    if (choices.every((choice) => choice.kind === 'consumable')) {
      this._takeUpgrade(choices[0])
      return
    }
    if (!refunded) this._lastGrowthChoiceAt = this.world.runTime
    this.state = 'levelUp'
    this._needsStaticRender = true
    this.modal.open(choices, (choice) => this._takeUpgrade(choice), {
      charges: { reroll: this.rerolls, banish: this.banishes },
      onReroll: () => {
        if (this.rerolls <= 0) { this._openNextModal(true); return }
        this.rerolls--
        this.world.runStats.rerollsUsed++
        if (typeof this.audio.playUiCue === 'function') this.audio.playUiCue('confirm')
        else this.audio.play('uiMove')
        this._openNextModal(true)
      },
      onBanish: (choice) => {
        if (this.banishes <= 0) { this._openNextModal(true); return }
        this.banishes--
        this.world.runStats.banishesUsed++
        this.banished.add(choice.kind === 'evolution' ? choice.replaces : choice.id)
        if (typeof this.audio.playUiCue === 'function') this.audio.playUiCue('confirm')
        else this.audio.play('uiMove')
        this._banner(`${choice.name} 봉인`, 1.2)
        this._openNextModal(true)
      },
      onSkip: () => {
        if (typeof this.audio.playUiCue === 'function') this.audio.playUiCue('confirm')
        else this.audio.play('uiMove')
        this.state = 'playing'
        this._hudNeedsRefresh = true
        this._openNextModal()
      },
      hint: '공격은 자동 · 영기를 모아 성장합니다  |  1·2·3 선택 · Enter 확정',
    })
  }

  _takeUpgrade(choice) {
    if (!this.world) return
    const player = this.world.player
    applyChoice(player.loadout, choice)
    if (choice.kind === 'evolution') this.world.runStats.evolutions++
    if (choice.kind === 'weapon' || choice.kind === 'evolution') {
      (this.runProgress ?? this.progress).markSeen('weapons', choice.id)
    }
    if (choice.kind === 'consumable') {
      if (choice.id === 'heal') player.heal(player.maxHp * 0.3, 'consumable')
      else if (choice.id === 'stones') player.stones += 200
      else if (choice.id === 'purge') this.world.purge()
    }
    player.recomputeStats()
    this.world.rebuildLoadoutCache()
    if (choice.kind === 'evolution') this.audio.play('evolution')
    else if (choice.id !== 'heal') this.audio.play('levelPick')
    if (this.state === 'levelUp') this.state = 'playing'
    if (this.state === 'playing') this._hudNeedsRefresh = true
    this._openNextModal()
  }

  _checkDaoMilestone() {
    if (!this.world || !this.daoVows || this.state !== 'playing' || this.modal.isOpen) return
    const milestone = this.daoVows.milestone
    if (milestone >= DAO_MILESTONE_SECONDS.length) return
    if (this.world.runTime + 1e-6 < DAO_MILESTONE_SECONDS[milestone]) return
    if (!canOpenGrowthChoice2D(this.world.runTime, this._lastGrowthChoiceAt)) return
    this._openDaoVowModal()
  }

  _openDaoVowModal() {
    const snapshot = this._getDaoSnapshot()
    if (!snapshot?.nextMilestone || !this.world) return
    const options = this.daoVows.availableSelections(snapshot.nextMilestone)
    const milestoneName = snapshot.nextMilestone === 'pledge' ? '맹세'
      : snapshot.nextMilestone === 'deepening' ? '심화' : '완성'
    const pledge = snapshot.nextMilestone === 'pledge'
    const choices = options.map((option, index) => {
      const daoPresentation = getDaoVowVisual(pledge ? {
        vowId: option.id,
        name: option.name,
        hanja: option.hanja,
        palette: option.palette,
        vfx: option.vfx,
        activeVfx: option.milestones?.[0]?.options?.[0]?.vfx ?? option.vfx?.pledge,
        milestone: 0,
      } : {
        ...snapshot.presentation,
        activeVfx: option.vfx ?? snapshot.presentation?.activeVfx,
      })
      return {
        kind: 'dao',
        id: option.id,
        iconId: DAO_ICON_IDS_2D[option.id] ?? DAO_ICON_IDS_2D[this.daoVows.vowId] ?? 'sword',
        name: option.name,
        desc: option.shortDescription ?? option.description ?? '',
        step: `${milestoneName} · ${index + 1}`,
        daoPresentation,
        daoIdentity: daoPresentation.identity,
        daoPalette: daoPresentation.palette,
        daoVfx: daoPresentation.activeVfx,
        daoGlyph: daoPresentation.glyph,
        ariaLabel: `${milestoneName} 선택 · ${pledge ? option.name : snapshot.vowName} · ${option.name} · ${option.description ?? ''}`,
      }
    })
    this._lastGrowthChoiceAt = this.world.runTime
    this.state = 'daoVow'
    this._needsStaticRender = true
    this.audio.play('breakthrough')
    this.modal.open(choices, (choice) => this._takeDaoVow(choice), {
      title: snapshot.nextMilestone === 'pledge' ? '천겁의 맹세' : `${snapshot.vowName} · ${milestoneName}`,
      variant: 'dao',
      actions: false,
      hint: '고른 도는 이번 생의 전투와 마지막 마존을 함께 바꿉니다.',
    })
  }

  _takeDaoVow(choice) {
    if (!choice || !this.daoVows || !this.world) return
    const milestone = this._getDaoSnapshot()?.nextMilestone
    if (!milestone) return
    const next = this.daoVows.select(milestone, choice.id)
    this._daoSnapshot = next
    this.world.applyDaoModifiers(next.combatModifiers, next)
    this.world.daoVowSnapshot = next
    this.world.runStats.daoMilestones = next.milestone
    this.world.player.heal(this.world.player.maxHp * DAO_VOW_HEAL_FRACTION_2D, 'dao')
    this.world.player.invulnTimer = Math.max(this.world.player.invulnTimer, 1.2)
    this.state = 'playing'
    this._hudNeedsRefresh = true
    this._needsStaticRender = true
    this.audio.play('daoSelect')
    this._banner(`${next.vowName} · ${next.milestones[next.milestone - 1].choiceName}`, 2.2)
    this._openNextModal()
  }

  _poiPrompt(type) {
    if (type === 'altar') return 'E · 제단에서 축복 받기'
    if (type === 'treasure') return 'E · 비경 보물 열기'
    if (type === 'elite_seal') return 'E · 정예 봉인 해제'
    return 'E · 회복 샘 사용하기'
  }

  _applyPoiReward(event) {
    if (!event || !this.world) return
    const player = this.world.player
    const reward = event.reward
    if (reward.kind === 'blessing') {
      const mod = reward.stat === 'power'
        ? { stat: 'might', op: 'mul', value: reward.amount }
        : reward.stat === 'haste'
          ? { stat: 'cooldown', op: 'add', value: -reward.amount }
          : reward.stat === 'area'
            ? { stat: 'area', op: 'add', value: reward.amount }
            : { stat: 'luck', op: 'mul', value: reward.amount }
      player.metaMods.push(mod)
      player.recomputeStats()
      this._banner('제단의 축복이 깃들었습니다', 1.6)
    } else if (reward.kind === 'treasure') {
      player.stones += reward.spiritStones
      const levels = player.addXp(reward.experience)
      if (levels > 0) this.world.onLevels?.(levels)
      this._banner(`영석 ${reward.spiritStones} · 영기 ${reward.experience}`, 1.6)
    } else if (reward.kind === 'elite_encounter') {
      const count = 1 + reward.tier
      const uids = new Set()
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2
        const uid = this.world.enemies.nextUid
        const spawned = this.world.enemies.spawn(
          'demonCultivator', event.x + Math.cos(angle) * 5.2, event.z + Math.sin(angle) * 5.2,
          this.world.runTime, 1 + reward.tier * 0.3, 1 + reward.tier * 0.08,
        )
        if (spawned) uids.add(uid)
      }
      if (uids.size > 0) {
        this._eliteEncounters.push({ uids, experience: reward.victoryExperience, x: event.x, z: event.z })
      } else {
        const levels = player.addXp(reward.victoryExperience)
        if (levels > 0) this.world.onLevels?.(levels)
      }
      this.world.effects.spawn(2, event.x, event.z, 0.9, 6.2, 0xe5b75d)
      this._banner(`정예 봉인 해제 · ${uids.size}체 출현`, 1.8)
    } else if (reward.kind === 'healing') {
      player.heal(player.maxHp * reward.healthFraction, 'spring')
      this.world.effects.spawn(2, event.x, event.z, 0.7, 4.5, 0x73e3bd)
      this._banner('회복 샘의 기운으로 체력을 회복했습니다', 1.6)
    }
    if (reward.kind !== 'healing') this.audio.play('levelPick')
    this._refreshWorldInteractions(true)
  }

  _refreshWorldInteractions(force = false) {
    if (!this.world || !this.interactions) return
    const player = this.world.player
    const key = `${mapChunkKey(player.x, player.z)}:${this.interactions.consumed.size}`
    if (force || key !== this._interactionSnapshotKey) {
      this.world.interactionsSnapshot = this.interactions.getRenderSnapshot(player.x, player.z)
      this._interactionSnapshotKey = key
      this._invalidateRadarCache()
    }
    const nearby = this.interactions.findNearby(player.x, player.z, 0.45)
    this.world.nearbyPoiId = nearby?.id ?? null
    this.interactionPrompt.hidden = !nearby || this.state !== 'playing'
    if (nearby) this.interactionPrompt.textContent = this._poiPrompt(nearby.type)
  }

  _updateWorldInteractions() {
    const requested = this.input.consumeInteract()
    if (!this.world || !this.interactions || this.state !== 'playing') {
      this.interactionPrompt.hidden = true
      return
    }
    this._refreshWorldInteractions()
    if (!requested) return
    const player = this.world.player
    const event = this.interactions.interact(player.x, player.z, 0.45)
    if (event) this._invalidateRadarCache()
    for (const event of this.interactions.drainEvents()) this._applyPoiReward(event)
  }

  _flushHitPresentation() {
    if (this.hitEvents.count === 0) return
    // The simulation can emit hundreds of legitimate hits per frame. Six
    // spatially coalesced readouts retain their full damage totals and crit
    // state without covering the heroine with a 24-label wall of numbers.
    const batch = this.hitEvents.flush({
      mergeRadius: 2.6,
      damageNumberBudget: 6,
      audioVoiceBudget: 3,
    })
    for (const hit of batch.damageNumbers) {
      this.presentation.spawnDamageNumber(hit.x, hit.z, hit.amount, hit.crit, hit.tag)
    }
    // Normal impacts are already voiced by the semantic weapon cue. Layering a
    // generic click on every landed hit turns a mature build into white noise;
    // retain only the rare critical accent here.
    for (const voice of batch.audio) {
      if (voice.crit) this.audio.play('crit', { tag: voice.tag, pan: this._panAt(voice.x) })
    }
  }

  _updateEliteEncounters() {
    if (!this.world || this._eliteEncounters.length === 0) return
    const enemies = this.world.enemies
    const survivors = []
    for (const encounter of this._eliteEncounters) {
      let alive = false
      for (let i = 0; i < enemies.count && !alive; i++) {
        if (!enemies.dead[i] && encounter.uids.has(enemies.uid[i])) alive = true
      }
      if (alive) {
        survivors.push(encounter)
        continue
      }
      const levels = this.world.player.addXp(encounter.experience)
      if (levels > 0) this.world.onLevels?.(levels)
      this.world.effects.spawn(2, encounter.x, encounter.z, 0.8, 5.4, 0xf2c76f)
      this.audio.play('levelPick')
      this._banner(`정예 격파 · 영기 ${encounter.experience}`, 1.7)
    }
    this._eliteEncounters = survivors
  }

  _setPaused(on) {
    if (on && this.state === 'playing') {
      this.state = 'paused'
      this.audio.setDucked?.(true)
      this.pause.show(this._hudState(), this.world?.player.loadout)
      this._needsStaticRender = true
    } else if (!on && this.state === 'paused') {
      this.state = 'playing'
      this.audio.setDucked?.(false)
      this.pause.hide()
      this.clock.reset()
      this._lastActualRenderAt = undefined
      this._hudNeedsRefresh = true
    }
  }

  _giveUp() {
    if (!this.world) return
    this.pause.hide()
    if (typeof this.world.endRun === 'function') this.world.endRun(false)
    else {
      this.world.ended = true
      this._endRun(false)
    }
  }

  _replayData() {
    const trialId = Number.isFinite(this.runProgress?.trial) ? this.runProgress.trial : 0
    const mode = this.runOptions?.mode === SHOWCASE_RUN_MODE_2D
      ? SHOWCASE_RUN_MODE_2D : NORMAL_RUN_MODE_2D
    const seed = finiteSeed(this.seed) ?? 0
    return {
      seed,
      mode,
      characterId: this.runCharacterId ?? null,
      stageId: this.stage?.id ?? null,
      trialId,
      // These options are the same-seed reproduction contract. Retry uses a
      // separate normalRetryOptions2D(seed) object below and never reuses them.
      options: { mode },
    }
  }

  _resultBuildData() {
    const weapons = Array.isArray(this.world?.weaponCache) ? this.world.weaponCache : []
    const passives = Array.isArray(this.world?.passiveCache) ? this.world.passiveCache : []
    const weaponIds = weapons.map((item) => item?.id).filter(Boolean)
    const passiveIds = passives.map((item) => item?.id).filter(Boolean)
    const recordedEvolutionIds = Array.isArray(this.world?.runStats?.evolutionIds)
      ? this.world.runStats.evolutionIds.filter(Boolean) : []
    const evolutionIds = [...new Set([
      ...recordedEvolutionIds,
      ...weaponIds.filter((id) => Boolean(getWeapon(id)?.evolutionOf)),
    ])]
    const weaponBuild = weapons.map((item) => ({
      id: item?.id ?? null,
      name: getWeapon(item?.id)?.name ?? item?.id ?? null,
      level: item?.level ?? null,
    }))
    const passiveBuild = passives.map((item) => ({
      id: item?.id ?? null,
      name: getPassive(item?.id)?.name ?? item?.id ?? null,
      level: item?.level ?? null,
    }))
    const evolutions = evolutionIds.map((id) => ({
      id,
      name: getWeapon(id)?.name ?? id,
      evolutionOf: getWeapon(id)?.evolutionOf ?? null,
    }))
    return {
      evolutionIds,
      buildIds: {
        weapons: weaponIds,
        passives: passiveIds,
        evolutions: evolutionIds,
      },
      build: {
        weapons: weaponBuild,
        passives: passiveBuild,
        evolutions,
      },
    }
  }

  _resultBossSummary() {
    const world = this.world
    const boss = world?.boss ?? null
    const finalBossId = world?.finalBossId ?? world?.bossSchedule?.at?.(-1)?.id ?? null
    const mirror = this._getDaoSnapshot()?.mirrorPattern ?? null
    const recordedPhases = Array.isArray(world?.runStats?.bossPhases)
      ? world.runStats.bossPhases : null
    const phaseRows = recordedPhases ?? (Array.isArray(mirror?.phases) ? mirror.phases : [])
    if (!boss && !phaseRows.length && !mirror?.vowId) return null
    const phases = phaseRows.map((phase) => ({
      phase: phase?.phase ?? null,
      id: phase?.id ?? phase?.patternId ?? null,
      patternId: phase?.patternId ?? phase?.id ?? null,
      name: phase?.name ?? null,
      vowId: phase?.vowId ?? null,
      choiceId: phase?.choiceId ?? null,
    }))
    const bossId = finalBossId ?? boss?.def?.id ?? mirror?.bossId ?? null
    const bossName = boss?.def?.id === bossId
      ? boss.def.name ?? null
      : mirror?.bossName ?? boss?.def?.name ?? null
    const currentPattern = boss?.pendingPattern ?? boss?.lastPattern ?? null
    const currentPhase = Number.isFinite(boss?.patternPhase)
      ? boss.patternPhase
      : Number.isFinite(currentPattern?.phase)
        ? currentPattern.phase
        : Number.isFinite(boss?.phase) ? boss.phase + 1 : null
    const current = boss ? {
      id: boss.def?.id ?? null,
      name: boss.def?.name ?? null,
      final: boss.def?.id === finalBossId,
      active: boss.active === true,
      phase: currentPhase,
      patternId: boss.patternId ?? currentPattern?.patternId ?? null,
      vowId: boss.patternVowId ?? currentPattern?.vowId ?? null,
      intent: boss.patternIntent ?? currentPattern?.intent ?? null,
    } : null
    return {
      id: bossId,
      name: bossName,
      final: Boolean(bossId && bossId === finalBossId),
      phase: current?.phase ?? null,
      patternId: current?.patternId ?? null,
      vowId: current?.vowId ?? mirror?.vowId ?? null,
      phases,
      phaseSummary: phases,
      current,
    }
  }

  _endRun(victory) {
    if (!this.world || this.state === 'result') return
    this.state = 'result'
    this._resultAwaitNeutral = true
    this.interactionPrompt.hidden = true
    this.hud.hide()
    this.hints.hide()
    this.pause.hide()
    this.modal.close()
    this.audio.stopMusic()
    this.audio.setDucked?.(false)
    this.audio.play(victory ? 'victory' : 'defeat')

    const player = this.world.player
    const runProgress = this.runProgress ?? this.progress
    const earned = this.progress.addStones(player.stones * runProgress.stoneMultiplier)
    const bests = this.progress.recordRun({
      runTime: this.world.runTime, level: player.level, kills: this.world.enemies.killCount, victory,
    })
    if (victory) this.progress.markStageCleared(this.stage?.id)
    const achievements = this.progress.awardAchievements({
      runTime: this.world.runTime,
      level: player.level,
      kills: this.world.enemies.killCount,
      victory,
      trial: runProgress.trial,
      weaponCount: this.world.weaponCache.length,
      ...this.world.runStats,
    })
    this._persist()
    const replay = this._replayData()
    const buildData = this._resultBuildData()
    const trialId = replay.trialId
    const trial = getTrial(trialId)
    const stage = this.stage ? {
      id: this.stage.id ?? null,
      name: this.stage.name ?? null,
    } : null
    const boss = this._resultBossSummary()
    const restartCharacterId = this.runCharacterId
    const restartStageId = this.stage?.id
    this.result.show({
      victory,
      runTime: this.world.runTime,
      level: player.level,
      realm: realmFor(player.level),
      kills: this.world.enemies.killCount,
      damageDealt: this.world.runStats.damageDealt,
      stones: player.stones,
      earnedStones: earned,
      totalStones: this.progress.stones,
      bests,
      achievements,
      weapons: this.world.weaponCache,
      passives: this.world.passiveCache,
      daoVow: this._getDaoSnapshot(),
      seed: this.seed,
      stage,
      stageId: stage?.id ?? null,
      stageName: stage?.name ?? null,
      trial: trialId,
      trialId,
      trialInfo: trial ? {
        id: trial.id,
        name: trial.name,
        hanja: trial.hanja,
        desc: trial.desc,
      } : null,
      ...buildData,
      boss,
      bossId: boss?.id ?? null,
      bossName: boss?.name ?? null,
      bossPhases: boss?.phases ?? [],
      replay,
      // Alias retained for consumers that call the payload a replay record.
      replayData: replay,
    }, {
      // A result retry is deliberately a fresh normal run. `replay` above is
      // the separate same-seed reproduction record for QA and sharing.
      onRestart: () => this._startRun(
        restartCharacterId, restartStageId, normalRetryOptions2D(replay.seed),
      ),
      onMenu: () => this._showTitle(),
    })
    this._needsStaticRender = true
  }

  _readMenuInput() {
    const slot = this.input.consumeSlot()
    const confirm = this.input.consumeConfirm()
    if (this.state === 'result' && this._resultAwaitNeutral) {
      const moving = Math.abs(this.input.moveX ?? 0) > 0.2 || Math.abs(this.input.moveZ ?? 0) > 0.2
      if (!moving && !confirm && !slot) this._resultAwaitNeutral = false
      this.input.discardDash?.()
      this._lastDir = 0
      return
    }
    const modalOwnsConfirm = this.state === 'levelUp' || this.state === 'daoVow'
    let dir = 0
    if (this.input.moveX > 0.5) dir = 1
    else if (this.input.moveX < -0.5) dir = -1
    if (this.state === 'title') this.title.handleKey(slot, confirm, this._edge(dir))
    else if (modalOwnsConfirm) this.modal.handleKey(slot, confirm, this._edge(dir))
    else if (this.state === 'result') this.result.handleKey(confirm, this._edge(dir))
    else if (this.state === 'shop') this.shop.handleKey(confirm)
    else if (this.state === 'codex') this.codex.handleKey(confirm)
    // Space and the gamepad south face latch both confirm and dash. A modal
    // pick closes the modal and returns to `playing` synchronously, so discard
    // the same physical press before the simulation branch can consume it.
    if (modalOwnsConfirm) {
      if (typeof this.input.discardDash === 'function') this.input.discardDash()
      else this.input.consumeDash?.()
    }
  }

  _edge(dir) {
    const changed = dir !== this._lastDir
    this._lastDir = dir
    return changed ? dir : 0
  }

  _hudState() {
    const player = this.world?.player
    if (!player) return {
      hp: 1, maxHp: 1, xp: 0, xpNeeded: 1, level: 1, realm: realmFor(1), runTime: 0,
      kills: 0, stones: 0, dashCooldown: 0, radar: [], radarRevision: this._radarRevision,
      weapons: [], passives: [], boss: null, runId: 0,
      firstVow: null, firstVowCountdown: null, firstVowObjective: null, daoRuntime: null,
    }
    const interactionRevision = this.interactions?.consumed?.size ?? 0
    const radarTime = Number.isFinite(this.world.runTime) ? this.world.runTime : 0
    if (
      radarTime < this._radarCacheAt
      || radarTime - this._radarCacheAt >= RADAR_REFRESH_SECONDS
      || interactionRevision !== this._radarCacheInteractionRevision
    ) {
      this._radarCacheAt = radarTime
      const enemyPoints = this.world.enemies.radarSnapshot(player.x, player.z)
      const poiPoints = []
      const poiRadius = RADAR_RADIUS
      for (const poi of this.world.interactionsSnapshot?.items ?? []) {
        if (poi.state !== 'available' || this.interactions?.isConsumed?.(poi.id)) continue
        const dx = poi.x - player.x
        const dz = poi.z - player.z
        const distanceSq = dx * dx + dz * dz
        if (distanceSq > poiRadius * poiRadius) continue
        poiPoints.push({
          x: dx / poiRadius,
          z: dz / poiRadius,
          poi: true,
          poiId: poi.id,
          poiType: poi.type,
          nearby: poi.id === this.world.nearbyPoiId,
        })
      }
      this._radarCache = enemyPoints.concat(poiPoints)
      this._radarCacheInteractionRevision = interactionRevision
    }
    const boss = this.world.boss?.active ? this.world.boss : null
    const daoVow = this._getDaoSnapshot()
    const firstVow = firstVowHudState2D(this.world.runTime, daoVow)
    const daoRuntime = daoRuntimeHudState2D(
      this.world.daoRuntime ?? this.world.daoCombatRuntime ?? null,
    )
    return {
      hp: player.hp,
      maxHp: player.maxHp,
      xp: player.xp,
      xpNeeded: player.xpNeeded,
      level: player.level,
      realm: realmFor(player.level),
      runTime: this.world.runTime,
      kills: this.world.enemies.killCount,
      stones: Math.round(player.stones),
      dashCooldown: player.dashCooldown,
      playerHeading: player.facing,
      radar: this._radarCache,
      radarRevision: this._radarRevision,
      runId: this.seed,
      weapons: this.world.weaponCache,
      passives: this.world.passiveCache,
      daoVow,
      firstVow,
      firstVowCountdown: firstVow?.countdown ?? null,
      firstVowObjective: firstVow?.objective ?? null,
      daoRuntime,
      boss: boss ? {
        name: boss.def.name, hp: boss.hp, maxHp: boss.maxHp, referenceAsset: boss.def.referenceAsset ?? null,
      } : null,
    }
  }

  _maxedWeaponWaiting() {
    const loadout = this.world?.player.loadout
    if (!loadout) return null
    for (const id in loadout.weapons) {
      const def = getWeapon(id)
      if (!def?.evolvesTo || !def.pairPassive) continue
      if (loadout.weapons[id] !== def.levels.length || loadout.weapons[def.evolvesTo]) continue
      if ((loadout.passives[def.pairPassive] ?? 0) > 0) continue
      return { weapon: def.name, passive: getPassive(def.pairPassive)?.name ?? def.pairPassive }
    }
    return null
  }

  _hintState() {
    const world = this.world
    const player = world?.player
    return {
      runTime: world?.runTime ?? 0,
      level: player?.level ?? 1,
      kills: world?.enemies.killCount ?? 0,
      stones: player?.stones ?? 0,
      hpFraction: player ? player.hp / player.maxHp : 1,
      qiOnGround: world?.pickups.count ?? 0,
      nearbyEnemies: world?.enemies.count ?? 0,
      bossAlive: Boolean(world?.boss?.active),
      moved: Number.isFinite(player?.actualSpeed) && player.actualSpeed > 0.05,
      dashed: Number.isFinite(player?.dashing) && player.dashing > 0,
      maxedWeapon: this._maxedWeaponWaiting(),
      formationSeen: Boolean(world?.formations?.formationSeen),
    }
  }

  _debugState(dt) {
    return {
      dt: this.presentation.runActive ? this._presentedDt : dt,
      state: this.state,
      drawCalls: this.presentation.drawCalls,
      triangles: this.presentation.triangles,
      enemies: this.world?.enemies.count ?? 0,
      projectiles: this.world?.projectiles.count ?? 0,
      pickups: this.world?.pickups.count ?? 0,
      dropped: (this.world?.enemies.dropped ?? 0)
        + (this.world?.projectiles.dropped ?? 0)
        + (this.world?.pickups.dropped ?? 0),
      scale: this.quality.scale,
      backend: this.presentation.backendLabel,
      seed: this.seed,
      shaderWarmupMs: this._warmupMs,
      workMs: this._perf.workMs,
      simMs: this._perf.simMs,
      drawMs: this._perf.drawMs,
    }
  }

  _frame(now) {
    if (this._disposed) return
    this._raf = requestAnimationFrame((next) => this._frame(next))
    if (document.hidden) {
      this._lastFrameAt = now
      this._lastPresentedAt = now
      this._renderBudgetMs = 0
      return
    }
    const elapsedMs = this._lastFrameAt === undefined ? 16.67 : Math.min(250, now - this._lastFrameAt)
    this._lastFrameAt = now
    const dt = elapsedMs / 1000
    this._lastDt = dt
    const frameStart = performance.now()
    this._daoActionVoiceUsed = 0

    this.input.poll()
    const zoomSteps = this.input.consumeZoom()
    if (zoomSteps !== 0) {
      this.viewZoom = this.presentation.setZoom(this.viewZoom + zoomSteps * 0.05)
      this._saveViewZoom()
      this._needsStaticRender = true
    }
    if (this.input.consumeDebug()) this.debug.toggle()
    if (this.input.consumeQuality()) this._banner(`화질 ${this.quality.cycle()}`, 1.4)
    if (this.input.consumeMute()) {
      const muted = this.audio.toggleMute()
      if (!muted) {
        // The global keydown listener normally unlocks before this RAF edge is
        // consumed. Keep the edge self-sufficient for synthetic input and for
        // browsers that defer the event dispatch.
        const ensure = this.audio.ensureUnlocked ?? this.audio.unlock
        const unlocked = typeof ensure === 'function' ? ensure.call(this.audio) : false
        if (unlocked && this.audio._musicOn === false && this.stage?.id
          && typeof this.audio.startMusic === 'function') {
          this.audio.startMusic(this.stage.id)
        }
      }
      this._banner(muted ? '음소거' : '소리 켜짐', 1.2)
    }
    if (this.input.consumePause() && (this.state === 'playing' || this.state === 'paused')) {
      this._setPaused(this.state === 'playing')
    }
    this._readMenuInput()

    const simStart = performance.now()
    if (this.state === 'playing' && this.world) {
      const ticks = this.clock.step(dt)
      for (let i = 0; i < ticks; i++) {
        this.world.update(FIXED_DT, this.input)
        this._checkDaoMilestone()
        if (this.state !== 'playing') break
      }
      if (this.state === 'playing') this._openNextModal()
      this._updateEliteEncounters()
      this._updateWorldInteractions()
    } else {
      this.clock.reset()
      this.input.consumeInteract()
      this.interactionPrompt.hidden = true
    }
    this._perf.simMs = performance.now() - simStart

    if (this.world && (this.state === 'playing' || this.state === 'levelUp' || this.state === 'daoVow' || this.state === 'paused')) {
      if (isHudLiveState(this.state)) {
        this.hud.update(this._hudState(), dt)
        this._hudNeedsRefresh = false
      }
      this.audio.update(dt, {
        runTime: this.world.runTime,
        runSeconds: CONTEST_PACING_DURATION_SECONDS,
        hpFraction: this.world.player.hp / this.world.player.maxHp,
        bossAlive: Boolean(this.world.boss?.active),
      })
    }
    if (this.state === 'playing') this.hints.update(dt, this._hintState())
    else this.hints.hide()

    const interactive = this.state === 'playing'
    const staticWorld = this.state === 'levelUp' || this.state === 'daoVow' || this.state === 'paused' || this.state === 'result'
    const interval = interactive ? GAME_RENDER_INTERVAL : MENU_RENDER_INTERVAL
    if (this._lastPresentedAt === undefined) this._renderBudgetMs = interval
    else {
      const callbackDelta = Math.max(0, now - this._lastPresentedAt)
      this._renderBudgetMs -= callbackDelta
    }
    this._lastPresentedAt = now
    const renderDue = this._renderBudgetMs <= 0 || this._needsStaticRender
    if (renderDue && (!staticWorld || this._needsStaticRender || this.state === 'result')) {
      this._renderBudgetMs += interval
      if (this._renderBudgetMs <= 0) this._renderBudgetMs = interval
      const drawStart = performance.now()
      if (this._lastActualRenderAt !== undefined) {
        this._presentedDt = Math.min(0.25, Math.max(0.001, (now - this._lastActualRenderAt) / 1000))
      }
      this._lastActualRenderAt = now
      this._flushHitPresentation()
      this.presentation.render(this.world?.snapshot ?? null, this.clock.alpha, this._presentedDt)
      this._perf.drawMs = performance.now() - drawStart
      this._needsStaticRender = false
    }
    this._perf.workMs = performance.now() - frameStart
    if (this.state === 'playing') {
      this.telemetry.record(elapsedMs, this._perf.workMs, this._perf.simMs, this._perf.drawMs)
    }
    this.debug.update(this._debugState(dt))
    if (this.state === 'playing') this.quality.sample(this._perf.workMs)
  }

  _panAt(x) {
    const dx = x - (this.world?.player.x ?? 0)
    return Math.max(-1, Math.min(1, dx / 16)) * 0.7
  }

  _audioPanFor(event) {
    const x = Number.isFinite(event?.x) ? event.x
      : Number.isFinite(event?.centerX) ? event.centerX
        : Number.isFinite(event?.targetX) ? event.targetX
          : Number.isFinite(event?.position?.x) ? event.position.x
            : null
    return x === null ? 0 : this._panAt(x)
  }

  _playWeaponAudio(event) {
    if (!event || typeof this.audio?.playWeaponCue !== 'function') return false
    const stage = event.stage ?? 'impact'
    const kind = event.kind ?? event.audio?.kind ?? 'generic'
    const tag = event.tag ?? event.audio?.tag ?? kind
    const priority = Number.isFinite(event.priority) ? event.priority : {
      launch: 18,
      impact: 36,
      field: 30,
      status: 42,
    }[stage] ?? 32
    return this.audio.playWeaponCue(kind, stage, {
      tag,
      pan: this._audioPanFor(event),
      priority,
    })
  }

  _handleDaoAction(action) {
    if (!action) return false
    this._hudNeedsRefresh = true
    const position = action.position ?? action.origin ?? null
    const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now() : Date.now()
    const audioAt = this._daoActionAudioAt ?? (this._daoActionAudioAt = new Map())
    const voiceUsed = this._daoActionVoiceUsed ?? 0
    const voiceBudget = this._daoActionVoiceBudget ?? DAO_ACTION_VOICE_BUDGET_2D
    const audioCooldown = DAO_ACTION_AUDIO_COOLDOWN_MS_2D[action.type]
      ?? DAO_ACTION_AUDIO_COOLDOWN_MS_2D['spirit-attack-clone']
    const lastAudioAt = audioAt.get(action.type) ?? -Infinity
    const initialCue = action.type !== 'frost-slow'
      && voiceUsed < voiceBudget
      && now - lastAudioAt >= audioCooldown
    if (initialCue) {
      if (action.type === 'spirit-pickup-chain') {
        this.audio.play?.('pickup')
      } else if (action.type === 'spirit-overcharge') {
        this.audio.play?.('breakthrough')
      } else {
        this._playWeaponAudio({
          x: position?.x,
          z: position?.z,
          tag: action.type,
          kind: action.type?.startsWith('sword') ? 'sword'
            : action.type?.startsWith('frost') ? 'frost'
              : action.type?.includes('purge') || action.type?.includes('overcharge') ? 'thunder'
                : 'spirit',
          stage: action.type === 'sword-fan' || action.type === 'spirit-attack-clone' ? 'launch'
            : action.type === 'frost-field' || action.type === 'frost-wall' ? 'field'
              : action.type === 'spirit-pickup-chain' ? 'status' : 'impact',
        })
      }
      audioAt.set(action.type, now)
      this._daoActionVoiceUsed = voiceUsed + 1
    }

    const banner = DAO_ACTION_BANNERS_2D[action.type]
    const lastBannerAt = Number.isFinite(this._daoBannerAt) ? this._daoBannerAt : -Infinity
    if (banner && now - lastBannerAt >= DAO_ACTION_BANNER_COOLDOWN_MS_2D) {
      this._banner(banner, action.type === 'spirit-overcharge' ? 1.8 : 0.9)
      this._daoBannerAt = now
    }
    return true
  }

  _playBossCue(stage, event) {
    const cue = {
      telegraph: 'bossTelegraph',
      impact: 'bossImpact',
      hit: 'bossHit',
      death: 'bossDeath',
    }[stage]
    if (!cue || typeof this.audio?.play !== 'function') return false
    return this.audio.play(cue, {
      pan: this._audioPanFor(event),
      priority: {
        telegraph: 92,
        impact: 96,
        hit: 90,
        death: 108,
      }[stage],
    })
  }

  _handleContextLoss() {
    if (this.state === 'playing') this._setPaused(true)
    if (!this.contextPanel) {
      this.contextPanel = document.createElement('div')
      this.contextPanel.className = 'runtime2d-context-panel'
      this.contextPanel.textContent = '그래픽 연결을 복구하는 중입니다…'
      this.hudRoot.appendChild(this.contextPanel)
    }
  }

  _handleContextRestore() {
    this.contextPanel?.remove()
    this.contextPanel = null
    this._needsStaticRender = true
  }

  forceLevelUp() {
    if (!this.world || this.state !== 'playing') return false
    this._breakthrough(1)
    return true
  }

  forceBoss(id = 'jadeVoidWarden') {
    if (!this.world) return false
    this.world.spawnBoss(id)
    return true
  }

  stress({ enemies = 900, projectiles = 1200, pickups = 1500 } = {}) {
    if (!this.world) return null
    const player = this.world.player
    while (this.world.enemies.count < Math.min(900, enemies)) {
      const n = this.world.enemies.count
      const angle = n * 2.399963
      const radius = 7 + (n % 22) * 0.72
      this.world.enemies.spawn(n % 7 === 0 ? 'demonCultivator' : n % 3 === 0 ? 'wolf' : 'wisp',
        player.x + Math.cos(angle) * radius, player.z + Math.sin(angle) * radius, this.world.runTime)
    }
    while (this.world.projectiles.count < Math.min(1200, projectiles)) {
      const n = this.world.projectiles.count
      const angle = n * 0.37
      this.world.projectiles.spawn({
        x: player.x + Math.cos(angle) * 4,
        z: player.z + Math.sin(angle) * 4,
        dx: Math.cos(angle), dz: Math.sin(angle), speed: 4, life: 8, damage: 1, pierce: 999,
      })
    }
    while (this.world.pickups.count < Math.min(1500, pickups)) {
      const n = this.world.pickups.count
      const angle = n * 2.399963
      const radius = 4 + (n % 24) * 0.55
      this.world.pickups.spawn(player.x + Math.cos(angle) * radius, player.z + Math.sin(angle) * radius, 1)
    }
    return this.diagnostics()
  }

  diagnostics() {
    const rolling = this.telemetry.snapshot()
    const audio = this.audio?.diagnostics?.() ?? this.audio?.getVoiceDiagnostics?.() ?? null
    return {
      renderer: this.presentation.backendLabel,
      gpu: this.presentation.gpuLabel,
      state: this.state,
      daoVow: this._getDaoSnapshot(),
      fps: Math.round(1 / Math.max(0.001, this._presentedDt)),
      frameMs: this._perf.workMs,
      simMs: this._perf.simMs,
      drawMs: this._perf.drawMs,
      drawCalls: this.presentation.drawCalls,
      triangles: this.presentation.triangles,
      enemies: this.world?.enemies.count ?? 0,
      projectiles: this.world?.projectiles.count ?? 0,
      pickups: this.world?.pickups.count ?? 0,
      resolution: this.quality.scale,
      warmupMs: this._warmupMs,
      rolling,
      audio,
    }
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    cancelAnimationFrame(this._raf)
    clearTimeout(this._bannerTimer)
    this._clearRunSession({ clearSelection: true })

    if (this.presentation) {
      this.presentation.onContextLost = null
      this.presentation.onContextRestored = null
    }

    // main.js exposes debug handles for the current instance. Clear only
    // handles that still belong to this game, so a newer instance cannot be
    // accidentally detached during a late disposal.
    if (typeof window !== 'undefined') {
      const ownsGame = window.__game === this
      const ownsGame2d = window.__game2d === this
      if (ownsGame) window.__game = null
      if (ownsGame2d) {
        window.__game2d = null
        window.__game2dDiagnostics = null
        window.__forceBoss = null
        window.__forceLevelUp = null
        window.__stress2d = null
      }
    }
    removeEventListener('resize', this._onResize)
    removeEventListener('pointerdown', this._unlockAudio)
    removeEventListener('keydown', this._unlockAudio)
    document.removeEventListener('visibilitychange', this._onVisibility)
    this.audio.dispose()
    this.input.dispose()
    this.presentation.destroy()
    this.hud.dispose()
    this.modal.dispose()
    this.title.dispose()
    this.result.dispose()
    this.shop.dispose()
    this.codex.dispose()
    this.debug.dispose()
    this.banner.remove()
    this.contextPanel?.remove()
    this.interactionPrompt?.remove()
  }
}
