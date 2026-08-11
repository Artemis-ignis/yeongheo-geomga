import { showFallback } from './world/webglSupport.js'

const canvas = document.getElementById('scene')
const overlayCanvas = document.getElementById('overlay')
const hudRoot = document.getElementById('hud')
const fallbackRoot = document.getElementById('fallback')
const params = new URLSearchParams(location.search)

async function boot() {
  // Legacy 3D remains available only to local developers while the 2D cutover
  // is being compared. This branch is removed by the production build, so its
  // Three.js graph and GLB assets cannot leak into the shipped entry point.
  if (import.meta.env.DEV && params.get('renderer') === '3d') {
    const legacyModule = './core/Game.js'
    const { Game } = await import(/* @vite-ignore */ legacyModule)
    const game = new Game({ canvas, overlayCanvas, hudRoot })
    game.start()
    window.__game = game
    window.__rendererMode = 'legacy-3d'
    return
  }

  const { Game2D } = await import('./runtime2d/Game2D.js')
  const game = new Game2D({ canvas, overlayCanvas, hudRoot, fallbackRoot })
  await game.start()
  if (game._disposed) return
  window.__game = game
  window.__game2d = game
  window.__rendererMode = 'pixi-2d'
  window.__game2dDiagnostics = () => game.diagnostics()
  if (import.meta.env.DEV) {
    window.__forceBoss = (id) => game.forceBoss(id)
    window.__forceLevelUp = () => game.forceLevelUp()
    window.__stress2d = (options) => game.stress(options)
    const qaMode = params.get('qa')
    if (qaMode === 'stress') {
      await game._startRun('seolryeong', 'jade')
      game.world.onLevels = () => {}
      game.world.player.takeDamage = () => false
      game.stress({ enemies: 900, projectiles: 1200, pickups: 1500 })
      game.debug.toggle()
    } else if (qaMode === 'boss') {
      await game._startRun('seolryeong', 'jade')
      game.world.player.takeDamage = () => false
      game.forceBoss('jadeVoidWarden')
    } else if (qaMode === 'result') {
      await game._startRun('seolryeong', 'jade')
      game.world.runTime = 185
      const savedProgress = structuredClone(game.progress.toSaveState())
      const persist = game._persist
      game._persist = () => {}
      game._endRun(false)
      game.progress.state = savedProgress
      game._persist = persist
    }
  }
}

try {
  await boot()
} catch (error) {
  console.error(error)
  showFallback(`2.5D 렌더러를 시작하지 못했습니다.\n${error?.message ?? error}`)
}
