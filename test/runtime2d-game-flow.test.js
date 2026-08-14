import { describe, expect, it, vi } from 'vitest'
import {
  BREAKTHROUGH_HEAL_FRACTION_2D, DAO_VOW_HEAL_FRACTION_2D,
  FIRST_LEVEL_MODAL_MIN_SECONDS_2D, GROWTH_CHOICE_MIN_GAMEPLAY_GAP_SECONDS_2D, Game2D,
  applyJourneyLegacy2D, canOpenGrowthChoice2D, daoVowsForRun2D, expeditionGuardianSpawnPositions2D,
  clickMoveVector2D, expeditionObjective2D, isHudLiveState, resolveStoryPropCollision2D,
  prioritizeEmergencyHeal2D, snapStoryClickTarget2D, STORY_INTERACTION_MARGIN_2D, worldDirectionLabel2D,
} from '../src/runtime2d/Game2D.js'
import { DaoVows2D } from '../src/runtime2d/DaoVows2D.js'
import { getJourneyChapterForStage } from '../src/data/journey.js'
import { investigationCluePois, WorldInteractions2D } from '../src/runtime2d/WorldInteractions2D.js'

describe('authored expedition objective copy', () => {
  const chapter = getJourneyChapterForStage('jade')
  const poi = { id: 'route:0', type: 'altar', routeIndex: 0, x: 10, z: 4 }
  const interactions = {
    currentRoutePoi: () => poi,
    stateForPoi: () => 'dormant',
    investigationProgressFor: () => ({ found: 1, total: 3, complete: false }),
    nearestUnfoundInvestigationClue: () => ({ x: 4, z: 8 }),
  }

  it('distinguishes travel, guardian combat, interaction and the final guardian', () => {
    expect(expeditionObjective2D(interactions, 0, null, chapter)).toContain('흔적')
    expect(expeditionObjective2D(interactions, 0, null, chapter, { x: 0, z: 0 })).toContain('남동쪽 11보')
    interactions.stateForPoi = () => 'active'
    expect(expeditionObjective2D(interactions, 0, null, chapter)).toContain('대조')
    expect(expeditionObjective2D(interactions, 0, null, chapter, { x: 0, z: 0 }))
      .toContain('흔적 1/3 · 다음 흔적 남동쪽 9보')
    const record = { id: 'route:1', type: 'treasure', routeIndex: 1, x: 36, z: 24 }
    interactions.currentRoutePoi = () => record
    expect(expeditionObjective2D(interactions, 1, {
      active: true, def: { id: 'blueWolfKing', name: '요왕 창랑' },
    }, chapter)).toBe('비경 문서를 삼킨 요왕 창랑을 격파하십시오')
    interactions.stateForPoi = () => 'cleared'
    interactions.currentRoutePoi = () => poi
    expect(expeditionObjective2D(interactions, 0, null, chapter)).toContain('판독')
    expect(expeditionObjective2D(interactions, 3, {
      active: true, def: { name: '옥허진장' },
    }, chapter)).toContain('옥허진장')
  })

  it('turns screen-aligned world offsets into readable bearings', () => {
    expect(worldDirectionLabel2D(12, 2)).toBe('동쪽')
    expect(worldDirectionLabel2D(-12, 2)).toBe('서쪽')
    expect(worldDirectionLabel2D(2, -12)).toBe('북쪽')
    expect(worldDirectionLabel2D(2, 12)).toBe('남쪽')
    expect(worldDirectionLabel2D(8, -7)).toBe('북동쪽')
    expect(worldDirectionLabel2D(-8, 7)).toBe('남서쪽')
  })
})

describe('integrated survivor-journey progression', () => {
  it('keeps Dao build branches active in both authored and challenge runs', () => {
    expect(daoVowsForRun2D({ mode: 'expedition' })).toBeInstanceOf(DaoVows2D)
    expect(daoVowsForRun2D({ mode: 'survival' })).toBeInstanceOf(DaoVows2D)
  })
})

describe('click-to-move browser input', () => {
  it('normalizes travel and stops inside the authored arrival radius', () => {
    expect(clickMoveVector2D({ x: 0, z: 0 }, { x: 3, z: 4 })).toEqual({ x: 0.6, z: 0.8, arrived: false })
    expect(clickMoveVector2D({ x: 2.8, z: 4 }, { x: 3, z: 4 })).toEqual({ x: 0, z: 0, arrived: true })
  })

  it('stops a far story click at the active clue instead of overshooting it', () => {
    const clue = { x: 0, z: 9, interactionRadius: 1 }
    const interactions = {
      currentRoutePoi: () => ({ id: 'route:0', x: 0, z: 12 }),
      nearestUnfoundInvestigationClue: () => clue,
    }
    expect(snapStoryClickTarget2D({ x: 0, z: 0 }, { x: 0.5, z: 24 }, interactions))
      .toEqual({ x: 0, z: 9 })
    const offRoute = { x: 24, z: 6 }
    expect(snapStoryClickTarget2D({ x: 0, z: 0 }, offRoute, interactions)).toBe(offRoute)
  })
})

describe('authored expedition boss encounters', () => {
  it('stages story guardians beyond the prop instead of on top of the heroine', () => {
    const event = { x: 10, z: 4 }
    const player = { x: 8.5, z: 4.5 }
    const positions = expeditionGuardianSpawnPositions2D(event, player, 3)
    expect(positions).toHaveLength(3)
    for (const point of positions) {
      expect(Math.hypot(point.x - event.x, point.z - event.z)).toBeCloseTo(6.8)
      expect(Math.hypot(point.x - player.x, point.z - player.z)).toBeGreaterThan(6.8)
    }
  })

  it('keeps the heroine ground contact outside an authored story prop', () => {
    const player = { x: 10.4, z: 4.2, prevX: 8, prevZ: 4 }
    expect(resolveStoryPropCollision2D(player, { x: 10, z: 4 })).toBe(true)
    expect(Math.hypot(player.x - 10, player.z - 4)).toBeCloseTo(2.65)
    expect(resolveStoryPropCollision2D(player, { x: 10, z: 4 })).toBe(false)
  })

  it('keeps the completed investigation reachable outside the prop collision ring', () => {
    const interactions = new WorldInteractions2D({
      seed: 99,
      stageId: 'jade',
      mode: 'expedition',
    })
    const poi = interactions.currentRoutePoi()
    const beat = interactions.chapter.route[0]
    for (const clue of investigationCluePois(poi, beat)) {
      interactions.interact(clue.x, clue.z)
    }
    // The old 2.85-unit lookup band sat only 0.20 units outside the collision
    // ring and was easy to skip between fixed updates. Camera-relative click
    // travel can settle just below four units while the prop fills the contact
    // silhouette, so that visible arrival must still resolve.
    const contactX = poi.x + 3.8
    expect(interactions.findNearby(contactX, poi.z, 0.45)).toBeNull()
    expect(interactions.findNearby(contactX, poi.z, STORY_INTERACTION_MARGIN_2D)?.id).toBe(poi.id)
  })

  it('automatically publishes the investigation conclusion at the visible prop edge', () => {
    const interactions = new WorldInteractions2D({
      seed: 99,
      stageId: 'jade',
      mode: 'expedition',
    })
    const poi = interactions.currentRoutePoi()
    for (const clue of investigationCluePois(poi, interactions.chapter.route[0])) {
      interactions.interact(clue.x, clue.z)
    }
    interactions.drainEvents()
    const game = Object.create(Game2D.prototype)
    const applyPoiReward = vi.fn()
    Object.assign(game, {
      state: 'playing',
      world: { player: { x: poi.x + 3.8, z: poi.z }, nearbyPoiId: null },
      interactions,
      journeyChapter: interactions.chapter,
      input: { consumeInteract: vi.fn(() => false) },
      interactionPrompt: { hidden: true, textContent: '' },
      _interactionSnapshotKey: '',
      _invalidateRadarCache: vi.fn(),
      _applyPoiReward: applyPoiReward,
    })

    Game2D.prototype._updateWorldInteractions.call(game)

    expect(interactions.isConsumed(poi.id)).toBe(true)
    expect(applyPoiReward).toHaveBeenCalledWith(expect.objectContaining({
      type: 'poi_reward', poiId: poi.id,
    }))
  })

  it('applies a persistent chapter decision to the next expedition stats', () => {
    const player = { metaMods: [], recomputeStats: vi.fn() }
    const world = { player }
    const legacy = { choiceId: 'record-truth', mods: [{ stat: 'might', op: 'mul', value: 0.06 }] }
    expect(applyJourneyLegacy2D(world, legacy)).toBe(true)
    expect(player.metaMods).toEqual([{ stat: 'might', op: 'mul', value: 0.06 }])
    expect(player.recomputeStats).toHaveBeenCalledOnce()
    expect(applyJourneyLegacy2D(world, legacy)).toBe(false)
    expect(player.metaMods).toHaveLength(1)
    expect(player.recomputeStats).toHaveBeenCalledOnce()
    expect(applyJourneyLegacy2D({ player }, null)).toBe(false)
  })

  it('returns a defeated route boss to its exact story POI before the final guardian', () => {
    const game = Object.create(Game2D.prototype)
    const onLevels = vi.fn()
    Object.assign(game, {
      world: {
        player: { addXp: vi.fn(() => 1) },
        onLevels,
        effects: { spawn: vi.fn() },
      },
      interactions: { markGuardianCleared: vi.fn(() => true) },
      _expeditionBossEncounter: {
        bossId: 'blueWolfKing', poiId: 'route:1', x: 20, z: 30, experience: 115,
      },
      _refreshWorldInteractions: vi.fn(),
      _banner: vi.fn(),
    })

    expect(Game2D.prototype._completeExpeditionBossEncounter.call(game, {
      bossId: 'jadeVoidWarden', bossName: '옥허진장',
    })).toBe(false)
    expect(game.interactions.markGuardianCleared).not.toHaveBeenCalled()

    expect(Game2D.prototype._completeExpeditionBossEncounter.call(game, {
      bossId: 'blueWolfKing', bossName: '창랑',
    })).toBe(true)
    expect(game.world.player.addXp).toHaveBeenCalledWith(115)
    expect(onLevels).toHaveBeenCalledWith(1)
    expect(game.interactions.markGuardianCleared).toHaveBeenCalledWith('route:1')
    expect(game._banner).toHaveBeenCalledWith('창랑 격파 · 봉인 문서를 회수하십시오', 2.5)
    expect(game._expeditionBossEncounter).toBeNull()
  })

  it('turns a recovered story record into a combat consequence and persistent decision', () => {
    const game = Object.create(Game2D.prototype)
    const modal = {
      isOpen: false,
      open: vi.fn((choices, onPick) => { modal.choices = choices; modal.onPick = onPick; modal.isOpen = true }),
    }
    const player = {
      metaMods: [], maxHp: 100, stones: 0,
      recomputeStats: vi.fn(), heal: vi.fn(), addXp: vi.fn(() => 0),
    }
    const decision = vi.fn(() => true)
    Object.assign(game, {
      state: 'playing', modal,
      world: { player, runTime: 44 },
      progress: { recordJourneyDecision: decision },
      journeyChapter: { id: 'jade:guardian' },
      _journeyDecisions: new Map(),
      _persist: vi.fn(),
      _banner: vi.fn(),
      _needsStaticRender: false,
      _lastGrowthChoiceAt: Number.NEGATIVE_INFINITY,
    })
    const reward = {
      kind: 'story-choice', title: '봉인 문서의 결단', description: '기록을 어떻게 다룰지 정하십시오.',
      spiritStones: 32, experience: 50,
      options: [{
        id: 'record-truth', name: '진상을 새기다', iconId: 'echoing-heart', desc: '법보 위력 +10%',
        outcome: '문서 원본을 천하록에 보존했습니다.', mods: [{ stat: 'might', op: 'mul', value: 0.1 }],
      }],
    }

    expect(Game2D.prototype._openJourneyChoice.call(game, reward, { id: 'sealed-record' })).toBe(true)
    expect(game._lastGrowthChoiceAt).toBe(44)
    modal.isOpen = false
    modal.onPick(modal.choices[0])

    expect(player.metaMods).toContainEqual({ stat: 'might', op: 'mul', value: 0.1 })
    expect(player.stones).toBe(32)
    expect(player.addXp).toHaveBeenCalledWith(50)
    expect(decision).toHaveBeenCalledWith('jade:guardian', expect.objectContaining({
      beatId: 'sealed-record', choiceId: 'record-truth',
    }))
    expect(game._journeyDecisions.get('sealed-record')).toMatchObject({ choiceId: 'record-truth' })
    expect(game._persist).toHaveBeenCalledOnce()
    expect(game.state).toBe('playing')
  })
})

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
      sanctum: { hide: vi.fn(), show: vi.fn() },
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
    expect(typeof titleHandlers.onEnter).toBe('function')
    expect(typeof titleHandlers.onCodex).toBe('function')
    expect(oldWorld.onEnd).toBeNull()
    expect(oldWorld.onWeaponAudio).toBeNull()
    expect(oldWorld.onBossDeath).toBeNull()
    expect(oldWorld.player.onHurt).toBeNull()
    game.state = 'playing'
    titleHandlers.onCodex()
    expect(game.state).toBe('playing')
    expect(game.sanctum.show).not.toHaveBeenCalled()
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

  it('advances presentation motion by the elapsed render interval on high-refresh displays', () => {
    const { game } = makeFrameGame('playing')
    game._lastFrameAt = 1016.67
    game._lastPresentedAt = 1016.67
    game._lastActualRenderAt = 1000
    game._renderBudgetMs = 0
    game._needsStaticRender = false

    const previousRaf = globalThis.requestAnimationFrame
    const previousDocument = globalThis.document
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('document', { hidden: false })

    try {
      Game2D.prototype._frame.call(game, 1033.34)

      expect(game.presentation.render).toHaveBeenCalledTimes(1)
      expect(game._presentedDt).toBeCloseTo(0.03334, 4)
      expect(game.presentation.render.mock.calls[0][2]).toBe(game._presentedDt)
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
