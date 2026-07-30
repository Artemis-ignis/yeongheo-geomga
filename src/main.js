import { isWebGL2Available, showFallback } from './world/Scene.js'
import { Game } from './core/Game.js'
import { installCapture, installStepper, installUICapture } from './dev/capture.js'
import { installBalanceProbe } from './dev/balanceProbe.js'
import {
  installToneCheck, installModelTone, checkTone, MODEL_TONE_LIMITS,
} from './dev/toneCheck.js'

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
    installStepper((dt) => game.stepFrame(dt), 1 / 60)
    const drawAt = (w, h) => {
      game.camera.setAspect(w / h)
      game.post.setSize(w, h)
      game.draw(1, 1 / 60)
    }
    installCapture(game.renderer, drawAt)
    installUICapture(hudRoot)
    installBalanceProbe(game)
    installToneCheck(game.renderer, drawAt)
    installModelTone(game.renderer, game.scene, game.camera.camera, () => {
      // Subjects: the horde plus whichever character is on screen.
      const subjects = []
      for (const m of game.enemies?.meshes ?? []) subjects.push(m)
      const roots = game.player ? [game.player.chibi.root] : (game.previewChibis ?? []).map((c) => c.root)
      for (const root of roots) root.traverse((o) => { if (o.isMesh) subjects.push(o) })
      if (game.boss?.group) game.boss.group.traverse((o) => { if (o.isMesh) subjects.push(o) })
      return subjects
    })

    window.__toneCheck = () => {
      const tone = window.__tone()
      const models = window.__modelTone()
      return {
        tone,
        models,
        problems: [
          ...checkTone(tone),
          ...checkTone(models, MODEL_TONE_LIMITS).map((p) => `models: ${p}`),
        ],
      }
    }
  }
}
