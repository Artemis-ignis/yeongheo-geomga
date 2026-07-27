import { isWebGL2Available, showFallback } from './world/Scene.js'
import { Game } from './core/Game.js'
import { installCapture, installStepper } from './dev/capture.js'

const canvas = document.getElementById('scene')
const overlayCanvas = document.getElementById('overlay')
const hudRoot = document.getElementById('hud')

if (!isWebGL2Available()) {
  showFallback('WebGL2 컨텍스트를 생성할 수 없습니다')
} else {
  const game = new Game({ canvas, overlayCanvas, hudRoot })
  game.start()

  if (import.meta.env.DEV) {
    window.__game = game
    window.__forceFallback = () => showFallback('테스트')
    installStepper((dt) => { if (game.state === 'playing') game.update(dt) }, 1 / 60)
    installCapture(game.renderer, (w, h) => {
      game.camera.setAspect(w / h)
      game.post.setSize(w, h)
      game.draw(1, 1 / 60)
    })
  }
}
