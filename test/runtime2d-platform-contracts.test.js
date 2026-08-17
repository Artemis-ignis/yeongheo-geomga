import { describe, expect, it, vi } from 'vitest'
import { Game2D } from '../src/runtime2d/Game2D.js'
import { PixiPresentation } from '../src/runtime2d/PixiPresentation.js'

function chainGraphics() {
  const graphics = {
    clear: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
  }
  graphics.clear.mockReturnValue(graphics)
  graphics.rect.mockReturnValue(graphics)
  graphics.fill.mockReturnValue(graphics)
  return graphics
}

function sprite(width = 256, height = 144) {
  return {
    texture: { width, height },
    width: 0,
    height: 0,
    alpha: 0,
    scale: { set: vi.fn() },
    position: { x: 0, y: 0, set: vi.fn() },
    tileScale: { set: vi.fn() },
  }
}

function resizeFixture() {
  const presentation = Object.create(PixiPresentation.prototype)
  Object.assign(presentation, {
    app: { renderer: { resize: vi.fn() } },
    viewport: { width: 1, height: 1, zoom: 1 },
    _floorTileScale: { x: 1, y: 0.46 },
    backdrop: sprite(),
    backdropWash: chainGraphics(),
    combatSky: chainGraphics(),
    combatVista: sprite(),
    farMountains: sprite(),
    nearMountains: sprite(),
    farMist: sprite(),
    floor: sprite(),
    floorBlendMask: sprite(),
    mapDecalBlendMask: sprite(),
    terrainMask: chainGraphics(),
    horizonMist: sprite(),
    nearMist: sprite(),
    horizonVeil: sprite(),
    titleHero: sprite(),
  })
  return presentation
}

describe('runtime2d platform contracts', () => {
  it('resizes the Pixi viewport and uses a native fallback when quality is absent', () => {
    const presentation = resizeFixture()
    const previousWindow = globalThis.window

    try {
      for (const [width, height] of [[1280, 720], [1920, 1080], [2560, 1440]]) {
        globalThis.window = { innerWidth: width, innerHeight: height }
        PixiPresentation.prototype.resize.call(presentation)

        expect(presentation.viewport).toMatchObject({ width, height })
        expect(presentation.app.renderer.resize).toHaveBeenLastCalledWith(width, height)
        expect(presentation.app.renderer.resolution).toBe(1)
        expect(presentation.terrainMask.rect).toHaveBeenLastCalledWith(
          0,
          expect.any(Number),
          width,
          expect.any(Number),
        )
      }
      expect(presentation.app.renderer.resize).toHaveBeenCalledTimes(3)
    } finally {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
    }
  })

  it('pauses on context loss, keeps one recovery panel, and requests a static redraw on restore', () => {
    const panel = { className: '', textContent: '', remove: vi.fn() }
    const game = Object.create(Game2D.prototype)
    Object.assign(game, {
      state: 'playing',
      contextPanel: null,
      hudRoot: { appendChild: vi.fn() },
      _setPaused: vi.fn(),
      _needsStaticRender: false,
    })
    const previousDocument = globalThis.document
    globalThis.document = { createElement: vi.fn(() => panel) }

    try {
      Game2D.prototype._handleContextLoss.call(game)
      game.state = 'paused'
      Game2D.prototype._handleContextLoss.call(game)
      expect(game._setPaused).toHaveBeenCalledTimes(1)
      expect(game._setPaused).toHaveBeenCalledWith(true)
      expect(game.hudRoot.appendChild).toHaveBeenCalledTimes(1)
      expect(game.contextPanel).toBe(panel)

      Game2D.prototype._handleContextRestore.call(game)
      expect(panel.remove).toHaveBeenCalledTimes(1)
      expect(game.contextPanel).toBeNull()
      expect(game._needsStaticRender).toBe(true)
    } finally {
      if (previousDocument === undefined) delete globalThis.document
      else globalThis.document = previousDocument
    }
  })

  it('does not resurrect the game when dispose wins the initial async start race', async () => {
    let resolveInit
    const init = new Promise((resolve) => { resolveInit = resolve })
    const presentation = {
      init: vi.fn(() => init),
      destroy: vi.fn(),
      setZoom: vi.fn(),
    }
    const game = Object.create(Game2D.prototype)
    Object.assign(game, {
      _disposed: false,
      presentation,
      viewZoom: 1,
      _showTitle: vi.fn(),
    })

    const starting = Game2D.prototype.start.call(game)
    expect(presentation.init).toHaveBeenCalledTimes(1)
    game._disposed = true
    resolveInit()
    await starting

    expect(presentation.destroy).toHaveBeenCalledTimes(1)
    expect(presentation.setZoom).not.toHaveBeenCalled()
    expect(game._showTitle).not.toHaveBeenCalled()
  })

  it('fully destroys Pixi resources and releases presentation-owned references', () => {
    const app = { destroy: vi.fn() }
    const canvas = { removeEventListener: vi.fn() }
    const presentation = Object.create(PixiPresentation.prototype)
    Object.assign(presentation, {
      app,
      canvas,
      _onContextLost: vi.fn(),
      _onContextRestored: vi.fn(),
      _restoreDrawMetrics: vi.fn(),
      enemyPool: [{}],
      effectPool: [{}],
      weaponFieldPool: [{}],
      propPool: [{}],
      poiPool: [{}],
      mapDecalPool: [{}],
      mapDecalTextures: [{}],
      damageTextPool: [{}],
      onContextLost: vi.fn(),
      onContextRestored: vi.fn(),
    })

    PixiPresentation.prototype.destroy.call(presentation)

    expect(app.destroy).toHaveBeenCalledWith(true, true)
    expect(presentation.app).toBeNull()
    expect(presentation._destroyed).toBe(true)
    expect(presentation.enemyPool).toEqual([])
    expect(presentation.mapDecalTextures).toEqual([])
    expect(presentation.onContextLost).toBeNull()
    expect(presentation.onContextRestored).toBeNull()
    expect(canvas.removeEventListener).toHaveBeenCalledTimes(2)
  })

  it('dispose clears world callbacks and current debug globals exactly once', () => {
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousCancel = globalThis.cancelAnimationFrame
    const previousRemove = globalThis.removeEventListener
    const world = {
      onDaoAction: vi.fn(),
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
      onPacingMilestone: vi.fn(),
      onFormation: vi.fn(),
      player: { onHurt: vi.fn() },
    }
    const game = Object.create(Game2D.prototype)
    const dispose = vi.fn()
    Object.assign(game, {
      _disposed: false,
      _raf: 1,
      _bannerTimer: 2,
      world,
      daoVows: {},
      _daoSnapshot: {},
      _eliteEncounters: [{}],
      hitEvents: { clear: vi.fn() },
      telemetry: { reset: vi.fn() },
      _invalidateRadarCache: vi.fn(),
      interactionPrompt: { hidden: false, remove: vi.fn() },
      hud: { hide: vi.fn(), dispose },
      hints: { hide: vi.fn() },
      pause: { hide: vi.fn() },
      modal: { close: vi.fn(), dispose },
      audio: { stopMusic: vi.fn(), setDucked: vi.fn(), dispose },
      input: { consumeInteract: vi.fn(), dispose },
      presentation: { onContextLost: vi.fn(), onContextRestored: vi.fn(), destroy: dispose },
      title: { dispose },
      result: { dispose },
      shop: { dispose },
      codex: { dispose },
      debug: { dispose },
      banner: { remove: vi.fn() },
      contextPanel: null,
      _onResize: vi.fn(),
      _unlockAudio: vi.fn(),
      _onVisibility: vi.fn(),
    })
    globalThis.window = {
      __game: game,
      __game2d: game,
      __game2dDiagnostics: vi.fn(),
      __forceBoss: vi.fn(),
      __forceLevelUp: vi.fn(),
      __stress2d: vi.fn(),
    }
    globalThis.document = { removeEventListener: vi.fn() }
    globalThis.cancelAnimationFrame = vi.fn()
    globalThis.removeEventListener = vi.fn()

    try {
      Game2D.prototype.dispose.call(game)
      Game2D.prototype.dispose.call(game)

      expect(game.world).toBeNull()
      expect(world.onPlayerHurt).toBeNull()
      expect(world.onBossWarning).toBeNull()
      expect(world.player.onHurt).toBeNull()
      expect(globalThis.window.__game).toBeNull()
      expect(globalThis.window.__game2d).toBeNull()
      expect(globalThis.window.__game2dDiagnostics).toBeNull()
      expect(dispose).toHaveBeenCalledTimes(10)
      expect(globalThis.cancelAnimationFrame).toHaveBeenCalledTimes(1)
    } finally {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
      if (previousDocument === undefined) delete globalThis.document
      else globalThis.document = previousDocument
      if (previousCancel === undefined) delete globalThis.cancelAnimationFrame
      else globalThis.cancelAnimationFrame = previousCancel
      if (previousRemove === undefined) delete globalThis.removeEventListener
      else globalThis.removeEventListener = previousRemove
    }
  })
})
