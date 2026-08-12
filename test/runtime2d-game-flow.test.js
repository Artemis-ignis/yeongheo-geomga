import { describe, expect, it, vi } from 'vitest'
import {
  BREAKTHROUGH_HEAL_FRACTION_2D, DAO_VOW_HEAL_FRACTION_2D,
  FIRST_LEVEL_MODAL_MIN_SECONDS_2D, GROWTH_CHOICE_MIN_GAMEPLAY_GAP_SECONDS_2D, Game2D,
  canOpenGrowthChoice2D, isHudLiveState,
  prioritizeEmergencyHeal2D,
} from '../src/runtime2d/Game2D.js'
import { DaoVows2D } from '../src/runtime2d/DaoVows2D.js'

function makeHudStateGame() {
  const consumed = new Set()
  const poi = {
    id: 'poi:jade:1:1:reward-source',
    type: 'treasure',
    x: 12,
    z: 0,
    state: 'available',
  }
  const game = Object.create(Game2D.prototype)
  game.world = {
    runTime: 1,
    player: {
      x: 0, z: 0, hp: 100, maxHp: 100, xp: 0, xpNeeded: 100, level: 1,
      stones: 0, dashCooldown: 0, facing: 0,
    },
    enemies: {
      radarSnapshot: vi.fn(() => []),
      killCount: 0,
    },
    projectiles: { count: 0 },
    pickups: { count: 0 },
    interactionsSnapshot: { items: [poi] },
    nearbyPoiId: poi.id,
    weaponCache: [],
    passiveCache: [],
    daoRuntime: {
      vowId: 'spirit',
      gauge: 42,
      gaugeMax: 100,
      spiritChain: 3,
      overchargeActive: true,
      overchargeRemaining: 2.5,
    },
    boss: null,
  }
  game.interactions = {
    consumed,
    isConsumed: (id) => consumed.has(id),
  }
  game._radarCacheAt = -Infinity
  game._radarCache = []
  game._radarCacheInteractionRevision = -1
  game._radarRevision = 0
  game.daoVows = new DaoVows2D()
  game._daoSnapshot = game.daoVows.snapshot()
  return { game, poi, consumed }
}

describe('runtime2d breakthrough sustain', () => {
  it('restores a small, level-scaled amount and queues the choice for frame arbitration', () => {
    const player = {
      x: 2, z: -3, level: 6, maxHp: 120, invulnTimer: 0,
      heal: vi.fn(),
    }
    const game = Object.create(Game2D.prototype)
    Object.assign(game, {
      state: 'playing', pendingLevels: 0, player,
      world: {
        player,
        effects: { spawn: vi.fn() },
        enemies: { damageAt: vi.fn() },
        flushEnemyDeaths: vi.fn(),
      },
      audio: { play: vi.fn() },
      _openNextModal: vi.fn(),
    })

    Game2D.prototype._breakthrough.call(game, 2)

    expect(player.heal).toHaveBeenCalledWith(120 * BREAKTHROUGH_HEAL_FRACTION_2D * 2, 'breakthrough')
    expect(game.pendingLevels).toBe(2)
    expect(player.invulnTimer).toBe(1.2)
    expect(game._openNextModal).not.toHaveBeenCalled()
  })

  it('protects the first twelve seconds from a full-screen growth modal', () => {
    expect(canOpenGrowthChoice2D(FIRST_LEVEL_MODAL_MIN_SECONDS_2D - 0.01)).toBe(false)
    expect(canOpenGrowthChoice2D(FIRST_LEVEL_MODAL_MIN_SECONDS_2D)).toBe(true)
  })

  it('requires active combat time between separate full-screen growth choices', () => {
    const previousChoiceAt = 24.5
    expect(canOpenGrowthChoice2D(
      previousChoiceAt + GROWTH_CHOICE_MIN_GAMEPLAY_GAP_SECONDS_2D - 0.01,
      previousChoiceAt,
    )).toBe(false)
    expect(canOpenGrowthChoice2D(
      previousChoiceAt + GROWTH_CHOICE_MIN_GAMEPLAY_GAP_SECONDS_2D,
      previousChoiceAt,
    )).toBe(true)
    expect(canOpenGrowthChoice2D(120, Number.NEGATIVE_INFINITY)).toBe(true)
  })

  it('puts a heal in a critical-health roll without replacing an evolution', () => {
    const normal = [
      { kind: 'weapon', id: 'flyingSword' },
      { kind: 'passive', id: 'swordArt' },
      { kind: 'weapon', id: 'fireTalisman' },
    ]
    expect(prioritizeEmergencyHeal2D(normal, 34, 100)[0].id).toBe('heal')

    const evolution = [
      { kind: 'evolution', id: 'swordEvolution' },
      { kind: 'passive', id: 'swordArt' },
      { kind: 'weapon', id: 'fireTalisman' },
    ]
    const offered = prioritizeEmergencyHeal2D(evolution, 20, 100)
    expect(offered[0].kind).toBe('evolution')
    expect(offered[1].id).toBe('heal')
  })
})

function makeDaoFlowGame() {
  const modal = {
    isOpen: false,
    choices: [],
    onPick: null,
    open: vi.fn((choices, onPick) => {
      modal.isOpen = true
      modal.choices = choices
      modal.onPick = onPick
    }),
    handleKey: vi.fn(),
  }
  const world = {
    runTime: 0,
    runStats: { daoMilestones: 0 },
    player: { loadout: {}, hp: 50, maxHp: 100, invulnTimer: 0, heal: vi.fn() },
    applyDaoModifiers: vi.fn(),
  }
  const daoVows = new DaoVows2D()
  const game = Object.create(Game2D.prototype)
  Object.assign(game, {
    state: 'playing',
    world,
    daoVows,
    _daoSnapshot: daoVows.snapshot(),
    _lastGrowthChoiceAt: Number.NEGATIVE_INFINITY,
    modal,
    audio: { play: vi.fn() },
    _banner: vi.fn(),
    _needsStaticRender: false,
    _hudNeedsRefresh: false,
  })
  return { game, world, modal }
}

function makeFrameGame(state) {
  const world = {
    runTime: 42,
    snapshot: null,
    player: { hp: 100, maxHp: 100, loadout: {} },
    boss: null,
    update: vi.fn(),
  }
  const input = {
    poll: vi.fn(),
    consumeZoom: vi.fn(() => 0),
    consumeDebug: vi.fn(() => false),
    consumeQuality: vi.fn(() => false),
    consumeMute: vi.fn(() => false),
    consumePause: vi.fn(() => false),
    consumeSlot: vi.fn(() => 0),
    consumeConfirm: vi.fn(() => false),
    consumeInteract: vi.fn(),
    moveX: 0,
  }
  const game = Object.create(Game2D.prototype)
  Object.assign(game, {
    state,
    world,
    input,
    modal: { handleKey: vi.fn(), isOpen: true },
    clock: { step: vi.fn(() => 1), reset: vi.fn(), alpha: 0 },
    presentation: { render: vi.fn() },
    audio: { update: vi.fn(), setDucked: vi.fn() },
    hud: { update: vi.fn() },
    hints: { update: vi.fn(), hide: vi.fn() },
    pause: { show: vi.fn(), hide: vi.fn() },
    progress: { rerollCharges: 0, banishCharges: 0 },
    interactionPrompt: { hidden: false },
    telemetry: { record: vi.fn() },
    debug: { update: vi.fn() },
    quality: { sample: vi.fn() },
    _disposed: false,
    _raf: 0,
    _lastFrameAt: 0,
    _lastPresentedAt: undefined,
    _lastActualRenderAt: undefined,
    _presentedDt: 1 / 60,
    _renderBudgetMs: 0,
    _lastDt: 1 / 60,
    _needsStaticRender: true,
    _perf: { workMs: 0, simMs: 0, drawMs: 0 },
    _hudNeedsRefresh: false,
    _radarRevision: 0,
    _banished: new Set(),
    _updateEliteEncounters: vi.fn(),
    _updateWorldInteractions: vi.fn(),
    _invalidateRadarCache: vi.fn(),
    _flushHitPresentation: vi.fn(),
    _debugState: vi.fn(() => ({})),
    _hintState: vi.fn(() => ({})),
    _hudState: vi.fn(() => ({})),
  })
  return { game, world, input }
}

function makeAudioWiringGame() {
  const game = Object.create(Game2D.prototype)
  Object.assign(game, {
    world: { player: { x: 0 } },
    audio: {
      playWeaponCue: vi.fn(() => true),
      play: vi.fn(() => true),
    },
  })
  return game
}

describe('Game2D run-state integration', () => {
  it('keeps HUD dynamic updates live only during active play', () => {
    expect(isHudLiveState('playing')).toBe(true)
    expect(isHudLiveState('paused')).toBe(false)
    expect(isHudLiveState('levelUp')).toBe(false)
    expect(isHudLiveState('result')).toBe(false)
  })

  it('removes a consumed POI from the next radar snapshot immediately', () => {
    const { game, poi, consumed } = makeHudStateGame()

    const before = Game2D.prototype._hudState.call(game)
    expect(before.radar).toContainEqual(expect.objectContaining({
      poi: true, poiId: poi.id, poiType: 'treasure', nearby: true,
    }))

    consumed.add(poi.id)
    poi.state = 'consumed'
    game._radarRevision++
    const after = Game2D.prototype._hudState.call(game)
    expect(after.radar.some((point) => point.poiId === poi.id)).toBe(false)
    expect(after.radar).toEqual([])
  })

  it('exposes the first Dao objective and live Dao runtime state as optional HUD fields', () => {
    const { game } = makeHudStateGame()

    const before = Game2D.prototype._hudState.call(game)
    expect(before.firstVow).toMatchObject({
      milestone: 'pledge',
      countdown: 19,
      objective: expect.any(String),
      ready: false,
    })
    expect(before.firstVowCountdown).toBe(19)
    expect(before.firstVowObjective).toBe(before.firstVow.objective)
    expect(before.daoRuntime).toMatchObject({
      active: true,
      gauge: 42,
      gaugeMax: 100,
      chain: 3,
      spiritChain: 3,
      overcharge: true,
      overchargeActive: true,
      overchargeRemaining: 2.5,
    })

    game.world.runTime = 20
    game.daoVows.select('pledge', 'spirit')
    game._daoSnapshot = game.daoVows.snapshot()
    const after = Game2D.prototype._hudState.call(game)
    expect(after.firstVow).toBeNull()
    expect(after.firstVowCountdown).toBeNull()
    expect(after.firstVowObjective).toBeNull()
  })

  it('returns to a fully wired title state after run asset loading fails', async () => {
    const oldWorld = {
      onLevels: vi.fn(),
      onEnd: vi.fn(),
      onHit: vi.fn(),
      onPlayerHurt: vi.fn(),
      onBossWarning: vi.fn(),
      onWeaponAudio: vi.fn(),
      onBossTelegraph: vi.fn(),
      onBossImpact: vi.fn(),
      onBossHit: vi.fn(),
      onBossDeath: vi.fn(),
      player: { onHurt: vi.fn() },
    }
    let titleHandlers
    const game = Object.create(Game2D.prototype)
    Object.assign(game, {
      state: 'result',
      world: oldWorld,
      interactions: { consumed: new Set() },
      rng: {},
      hitEvents: { clear: vi.fn() },
      _eliteEncounters: [],
      _interactionSnapshotKey: 'old',
      pendingLevels: 2,
      rerolls: 1,
      banishes: 1,
      banished: new Set(['old']),
      seed: 44,
      _radarCacheAt: 4,
      _radarCache: [{ poi: true }],
      _radarCacheInteractionRevision: 2,
      _radarRevision: 0,
      _hudNeedsRefresh: false,
      interactionPrompt: { hidden: false },
      hud: { hide: vi.fn(), reset: vi.fn() },
      hints: { hide: vi.fn() },
      pause: { hide: vi.fn() },
      modal: { close: vi.fn() },
      shop: { hide: vi.fn(), show: vi.fn() },
      codex: { hide: vi.fn(), show: vi.fn() },
      audio: {
        muted: false,
        unlock: vi.fn(),
        startMusic: vi.fn(),
        stopMusic: vi.fn(),
      },
      input: { consumeInteract: vi.fn() },
      title: {
        hide: vi.fn(),
        show: vi.fn((handlers) => { titleHandlers = handlers }),
      },
      result: { hide: vi.fn() },
      presentation: {
        showTitle: vi.fn(),
        prepareRunAssets: vi.fn().mockRejectedValue(new Error('missing test asset')),
      },
      _banner: vi.fn(),
      _needsStaticRender: false,
      stage: { id: 'jade' },
      runCharacterId: 'seolryeong',
    })

    await Game2D.prototype._startRun.call(game, 'seolryeong', 'jade')

    expect(game.state).toBe('title')
    expect(game.world).toBeNull()
    expect(game.interactions).toBeNull()
    expect(game.stage).toBeNull()
    expect(game.runCharacterId).toBeNull()
    expect(game.audio.stopMusic).toHaveBeenCalled()
    expect(game.presentation.showTitle).toHaveBeenCalled()
    expect(game.shop.hide).toHaveBeenCalled()
    expect(game.codex.hide).toHaveBeenCalled()
    expect(typeof titleHandlers.onStart).toBe('function')
    expect(typeof titleHandlers.onShop).toBe('function')
    expect(typeof titleHandlers.onCodex).toBe('function')
    expect(oldWorld.onEnd).toBeNull()
    expect(oldWorld.onWeaponAudio).toBeNull()
    expect(oldWorld.onBossDeath).toBeNull()
    expect(oldWorld.player.onHurt).toBeNull()
    game.state = 'playing'
    titleHandlers.onShop()
    titleHandlers.onCodex()
    expect(game.state).toBe('playing')
    expect(game.shop.show).not.toHaveBeenCalled()
    expect(game.codex.show).not.toHaveBeenCalled()
    expect(game._banner).toHaveBeenLastCalledWith(
      '비경 자원을 불러오지 못했습니다. 다시 시도해 주세요.', 3,
    )
  })

  it('opens the Dao modal once at 20/165/270 seconds and advances only after a choice', () => {
    const { game, world, modal } = makeDaoFlowGame()
    const thresholds = [20, 165, 270]

    thresholds.forEach((seconds, index) => {
      world.runTime = seconds
      game.state = 'playing'
      Game2D.prototype._checkDaoMilestone.call(game)

      expect(game.state).toBe('daoVow')
      expect(modal.open).toHaveBeenCalledTimes(index + 1)
      expect(modal.choices.length).toBeGreaterThan(0)
      expect(world.runTime).toBe(seconds)

      const choice = modal.choices[0]
      const onPick = modal.onPick
      modal.isOpen = false
      onPick(choice)
      expect(game.state).toBe('playing')
      expect(game.daoVows.milestone).toBe(index + 1)
      expect(world.runTime).toBe(seconds)
      expect(world.player.heal).toHaveBeenLastCalledWith(100 * DAO_VOW_HEAL_FRACTION_2D, 'dao')
      expect(world.player.invulnTimer).toBe(1.2)

      // The same threshold is already represented by the selected milestone;
      // a second check must not reopen the modal.
      Game2D.prototype._checkDaoMilestone.call(game)
      expect(modal.open).toHaveBeenCalledTimes(index + 1)
    })
  })

  it('defers a Dao choice when another full-screen growth decision just closed', () => {
    const { game, world, modal } = makeDaoFlowGame()
    game._lastGrowthChoiceAt = 14
    world.runTime = 20

    Game2D.prototype._checkDaoMilestone.call(game)
    expect(game.state).toBe('playing')
    expect(modal.open).not.toHaveBeenCalled()

    world.runTime = 14 + GROWTH_CHOICE_MIN_GAMEPLAY_GAP_SECONDS_2D
    Game2D.prototype._checkDaoMilestone.call(game)
    expect(game.state).toBe('daoVow')
    expect(modal.open).toHaveBeenCalledOnce()
  })

  it('carries each Dao choice presentation identity into the modal contract', () => {
    const { game, modal } = makeDaoFlowGame()
    Game2D.prototype._openDaoVowModal.call(game)

    expect(modal.choices).toHaveLength(3)
    expect(new Set(modal.choices.map((choice) => choice.daoIdentity)).size).toBe(3)
    expect(new Set(modal.choices.map((choice) => choice.daoVfx)).size).toBe(3)
    expect(new Set(modal.choices.map((choice) => choice.daoGlyph)).size).toBe(3)
    for (const choice of modal.choices) {
      expect(choice.daoPresentation.palette).toBeTruthy()
      expect(choice.daoPresentation.activeVfx).toBe(choice.daoVfx)
      expect(choice.ariaLabel).toContain('선택')
    }
  })

  it('keeps one Dao snapshot reference across HUD/modal reads and replaces it on selection', () => {
    const { game, modal } = makeDaoFlowGame()
    const initial = game._daoSnapshot
    const snapshot = vi.spyOn(game.daoVows, 'snapshot')

    Game2D.prototype._openDaoVowModal.call(game)
    expect(snapshot).not.toHaveBeenCalled()

    const choice = modal.choices[0]
    modal.isOpen = false
    modal.onPick(choice)
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(game._daoSnapshot).not.toBe(initial)

    Game2D.prototype._openDaoVowModal.call(game)
    expect(snapshot).toHaveBeenCalledTimes(1)
  })

  it('exposes the cached Dao snapshot through HUD and diagnostics without resnapshotting', () => {
    const { game } = makeHudStateGame()
    const cached = game._daoSnapshot
    const snapshot = vi.spyOn(game.daoVows, 'snapshot')

    const hud = Game2D.prototype._hudState.call(game)
    expect(hud.daoVow).toBe(cached)
    expect(snapshot).not.toHaveBeenCalled()

    Object.assign(game, {
      telemetry: { snapshot: vi.fn(() => ({ sampleCount: 0 })) },
      audio: null,
      presentation: { backendLabel: 'test', gpuLabel: 'test', drawCalls: 0, triangles: 0 },
      state: 'playing',
      _presentedDt: 1 / 60,
      _perf: { workMs: 0, simMs: 0, drawMs: 0 },
      quality: { scale: 1 },
      _warmupMs: 0,
    })
    const diagnostics = Game2D.prototype.diagnostics.call(game)
    expect(diagnostics.daoVow).toBe(cached)
    expect(snapshot).not.toHaveBeenCalled()
  })

  it('does not update runTime while the Dao modal is open and preserves it through pause/resume', () => {
    const { game, world } = makeFrameGame('daoVow')
    const frozenTime = world.runTime
    const previousRaf = globalThis.requestAnimationFrame
    const previousDocument = globalThis.document
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('document', { hidden: false })

    try {
      Game2D.prototype._frame.call(game, 1000)
      expect(world.update).not.toHaveBeenCalled()
      expect(world.runTime).toBe(frozenTime)

      game.state = 'playing'
      Game2D.prototype._setPaused.call(game, true)
      expect(game.state).toBe('paused')
      expect(game.audio.setDucked).toHaveBeenCalledWith(true)
      expect(world.runTime).toBe(frozenTime)

      Game2D.prototype._frame.call(game, 1016.67)
      expect(world.update).not.toHaveBeenCalled()
      expect(world.runTime).toBe(frozenTime)

      Game2D.prototype._setPaused.call(game, false)
      expect(game.state).toBe('playing')
      expect(game.audio.setDucked).toHaveBeenCalledWith(false)
      expect(world.runTime).toBe(frozenTime)
      expect(game.clock.reset).toHaveBeenCalled()
    } finally {
      if (previousRaf === undefined) delete globalThis.requestAnimationFrame
      else globalThis.requestAnimationFrame = previousRaf
      if (previousDocument === undefined) delete globalThis.document
      else globalThis.document = previousDocument
    }
  })

  it('resumes audio before handling the M mute edge when the run began muted', () => {
    const { game, input } = makeFrameGame('playing')
    const audio = game.audio
    audio.muted = true
    audio._musicOn = false
    audio.toggleMute = vi.fn(() => {
      audio.muted = !audio.muted
      return audio.muted
    })
    audio.ensureUnlocked = vi.fn(() => true)
    audio.startMusic = vi.fn()
    game.stage = { id: 'jade' }
    game._banner = vi.fn()
    input.consumeMute = vi.fn(() => true)

    const previousRaf = globalThis.requestAnimationFrame
    const previousDocument = globalThis.document
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('document', { hidden: false })
    try {
      Game2D.prototype._frame.call(game, 1000)
      expect(audio.ensureUnlocked).toHaveBeenCalledTimes(1)
      expect(audio.startMusic).toHaveBeenCalledWith('jade')
      expect(game._banner).toHaveBeenCalledWith('소리 켜짐', 1.2)
    } finally {
      if (previousRaf === undefined) delete globalThis.requestAnimationFrame
      else globalThis.requestAnimationFrame = previousRaf
      if (previousDocument === undefined) delete globalThis.document
      else globalThis.document = previousDocument
    }
  })

  it('routes combat callbacks to phase-specific audio cues with deterministic panning', () => {
    const game = makeAudioWiringGame()

    Game2D.prototype._playWeaponAudio.call(game, {
      kind: 'blade', stage: 'launch', tag: 'sword', x: 8,
    })
    expect(game.audio.playWeaponCue).toHaveBeenCalledWith('blade', 'launch', {
      tag: 'sword', pan: 0.35, priority: 18,
    })

    Game2D.prototype._playWeaponAudio.call(game, {
      kind: 'frost', stage: 'field', tag: 'ice',
    })
    expect(game.audio.playWeaponCue).toHaveBeenLastCalledWith('frost', 'field', {
      tag: 'ice', pan: 0, priority: 30,
    })

    for (const [stage, cue] of [
      ['telegraph', 'bossTelegraph'],
      ['impact', 'bossImpact'],
      ['hit', 'bossHit'],
      ['death', 'bossDeath'],
    ]) {
      Game2D.prototype._playBossCue.call(game, stage, {
        eventId: `boss:${stage}`, patternId: 'dao-sword-line', phase: 2,
      })
      expect(game.audio.play).toHaveBeenLastCalledWith(cue, expect.objectContaining({ pan: 0 }))
    }
  })

  it('discards the same-frame dash edge when a Dao or level-up confirm returns to play', () => {
    const { game } = makeDaoFlowGame()
    for (const state of ['daoVow', 'levelUp']) {
      let dashLatched = true
      const discardDash = vi.fn(() => { dashLatched = false })
      game.input = {
        consumeSlot: vi.fn(() => 0),
        consumeConfirm: vi.fn(() => true),
        consumeDash: vi.fn(() => {
          const value = dashLatched
          dashLatched = false
          return value
        }),
        discardDash,
        moveX: 0,
      }
      game.state = state
      game.modal.handleKey = vi.fn(() => { game.state = 'playing' })
      Game2D.prototype._readMenuInput.call(game)

      expect(discardDash).toHaveBeenCalledTimes(1)
      expect(game.input.consumeDash()).toBe(false)
    }
  })

  it('waits for neutral input before the result screen accepts keyboard confirmation', () => {
    const game = Object.create(Game2D.prototype)
    let confirm = true
    let moveZ = 1
    Object.assign(game, {
      state: 'result',
      _resultAwaitNeutral: true,
      _lastDir: 1,
      input: {
        consumeSlot: vi.fn(() => 0),
        consumeConfirm: vi.fn(() => confirm),
        discardDash: vi.fn(),
        moveX: 0,
        get moveZ() { return moveZ },
      },
      result: { handleKey: vi.fn() },
    })

    Game2D.prototype._readMenuInput.call(game)
    expect(game.result.handleKey).not.toHaveBeenCalled()
    expect(game._resultAwaitNeutral).toBe(true)

    confirm = false
    moveZ = 0
    Game2D.prototype._readMenuInput.call(game)
    expect(game._resultAwaitNeutral).toBe(false)
    expect(game.result.handleKey).not.toHaveBeenCalled()

    confirm = true
    Game2D.prototype._readMenuInput.call(game)
    expect(game.result.handleKey).toHaveBeenCalledWith(true, 0)
  })

  it('closes any growth modal before presenting the result screen', () => {
    const game = Object.create(Game2D.prototype)
    const modal = { close: vi.fn() }
    const result = { show: vi.fn() }
    const progress = {
      stones: 0,
      addStones: vi.fn(() => 0),
      recordRun: vi.fn(() => ({})),
      markStageCleared: vi.fn(),
      awardAchievements: vi.fn(() => []),
    }
    Object.assign(game, {
      state: 'levelUp',
      world: {
        runTime: 420,
        player: { level: 20, stones: 0 },
        enemies: { killCount: 100 },
        runStats: { damageDealt: 1000 },
        weaponCache: [{ id: 'myriadSwords', level: 1 }],
        passiveCache: [{ id: 'swordArt', level: 1 }],
        finalBossId: 'jadeVoidWarden',
        boss: {
          active: false,
          def: { id: 'jadeVoidWarden', name: '옥허진장' },
          phase: 2,
          patternPhase: 3,
          patternId: 'closing-sword-ring',
          patternVowId: 'sword',
        },
      },
      runProgress: { stoneMultiplier: 1, trial: 1 },
      progress,
      stage: { id: 'jade', name: '청람비경' },
      runCharacterId: 'seolryeong',
      seed: 1,
      interactionPrompt: { hidden: false },
      hud: { hide: vi.fn() },
      hints: { hide: vi.fn() },
      pause: { hide: vi.fn() },
      modal,
      audio: { stopMusic: vi.fn(), setDucked: vi.fn(), play: vi.fn() },
      result,
      _persist: vi.fn(),
      _getDaoSnapshot: vi.fn(() => ({
        vowId: 'sword',
        mirrorPattern: {
          bossId: 'jadeVoidWarden',
          bossName: '옥허진장',
          vowId: 'sword',
          phases: [
            { phase: 1, id: 'straight-sword-rain', patternId: 'straight-sword-rain', name: '직선 검우' },
            { phase: 2, id: 'piercing-sword-cross', patternId: 'piercing-sword-cross', name: '교차 관통선' },
            { phase: 3, id: 'closing-sword-ring', patternId: 'closing-sword-ring', name: '닫히는 검환' },
          ],
        },
      })),
      _needsStaticRender: false,
    })

    Game2D.prototype._endRun.call(game, true)

    expect(modal.close).toHaveBeenCalledOnce()
    expect(result.show).toHaveBeenCalledOnce()
    expect(game.state).toBe('result')

    const [payload, handlers] = result.show.mock.calls[0]
    expect(payload.stage).toEqual({ id: 'jade', name: '청람비경' })
    expect(payload.trial).toBe(1)
    expect(payload.trialInfo).toMatchObject({ id: 1, name: '역풍' })
    expect(payload.evolutionIds).toEqual(['myriadSwords'])
    expect(payload.buildIds).toEqual({
      weapons: ['myriadSwords'], passives: ['swordArt'], evolutions: ['myriadSwords'],
    })
    expect(payload.build.evolutions).toEqual([{
      id: 'myriadSwords', name: '만검귀종', evolutionOf: 'flyingSword',
    }])
    expect(payload.boss).toMatchObject({
      id: 'jadeVoidWarden', name: '옥허진장', phase: 3, patternId: 'closing-sword-ring',
    })
    expect(payload.boss.phases.map((phase) => phase.patternId)).toEqual([
      'straight-sword-rain', 'piercing-sword-cross', 'closing-sword-ring',
    ])
    expect(payload.replay).toMatchObject({
      seed: 1, mode: 'normal', characterId: 'seolryeong', stageId: 'jade', trialId: 1,
    })
    expect(payload.replayData).toBe(payload.replay)

    game._startRun = vi.fn()
    handlers.onRestart()
    expect(game._startRun).toHaveBeenCalledWith(
      'seolryeong', 'jade', { mode: 'normal', avoidSeed: 1 },
    )
  })

  it('reports simulation movement and dash activity to the hint overlay', () => {
    const game = Object.create(Game2D.prototype)
    game.world = {
      runTime: 3,
      player: { actualSpeed: 0.2, dashing: 0.1, level: 1, stones: 0, hp: 1, maxHp: 1 },
      enemies: { killCount: 0, count: 0 },
      pickups: { count: 0 },
      boss: null,
      formations: null,
    }
    game._maxedWeaponWaiting = vi.fn(() => null)

    expect(Game2D.prototype._hintState.call(game)).toMatchObject({ moved: true, dashed: true })
  })
})
