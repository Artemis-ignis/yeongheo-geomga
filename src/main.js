import { showFallback } from './ui/fallback.js'

const canvas = document.getElementById('scene')
const hudRoot = document.getElementById('hud')
const fallbackRoot = document.getElementById('fallback')
const params = new URLSearchParams(location.search)

async function boot() {
  const { Game2D } = await import('./runtime2d/Game2D.js')
  const game = new Game2D({ canvas, hudRoot, fallbackRoot })
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
    } else if (qaMode === 'wolf-crowd') {
      await game._startRun('seolryeong', 'jade')
      game.world.onLevels = () => {}
      game.world.player.takeDamage = () => false
      game.world.weaponCache = []
      game.world.enemies.spawnTimer = 999
      const roster = [
        'wolf', 'stoneGhoul', 'wolf', 'talismanGhost',
        'bloodScorpion', 'demonCultivator', 'jadeSerpent',
      ]
      const player = game.world.player
      for (let index = 0; index < 72; index++) {
        const angle = index * 2.399963
        const radius = 5.4 + (index % 12) * 0.78
        game.world.enemies.spawn(
          roster[index % roster.length],
          player.x + Math.cos(angle) * radius,
          player.z + Math.sin(angle) * radius,
          game.world.runTime,
          100,
        )
      }
      for (let index = 0; index < game.world.enemies.count; index++) {
        game.world.enemies.speed[index] = 0
        game.world.enemies.damage[index] = 0
        game.world.enemies.hitCd[index] = 999
        game.world.enemies.shotCd[index] = 999
      }
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
