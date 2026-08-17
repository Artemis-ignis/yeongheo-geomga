import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AudioEngine } from '../src/audio/Audio.js'
import {
  createWorldFrame2D,
  projectWorld,
  projectWorldWithFrame2D,
} from '../src/runtime2d/projection.js'
import { WorldCamera2D } from '../src/runtime2d/WorldCamera2D.js'

const gameSource = readFileSync(
  fileURLToPath(new URL('../src/runtime2d/Game2D.js', import.meta.url)),
  'utf8',
)
const presentationSource = readFileSync(
  fileURLToPath(new URL('../src/runtime2d/PixiPresentation.js', import.meta.url)),
  'utf8',
)
const shopSource = readFileSync(
  fileURLToPath(new URL('../src/ui/ShopScreen.js', import.meta.url)),
  'utf8',
)
const codexSource = readFileSync(
  fileURLToPath(new URL('../src/ui/CodexScreen.js', import.meta.url)),
  'utf8',
)
const uiCss = readFileSync(
  fileURLToPath(new URL('../styles/ink-ui.css', import.meta.url)),
  'utf8',
)

const RELEASE_VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080, zoom: 1 },
  { name: '2560x1600', width: 2560, height: 1600, zoom: 1 },
]

const TRAVEL_DIRECTIONS = [
  { name: 'cardinal-east', facing: Math.PI / 2 },
  { name: 'cardinal-south', facing: 0 },
  { name: 'diagonal-south-east', facing: Math.PI / 4 },
]

function screenDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function simulateCameraTravel(viewport, facing, movingFrames = 90) {
  const camera = new WorldCamera2D({ snapDistance: 1000 })
  const player = { x: 0, z: 0, actualSpeed: 8, facing }
  const focalPoint = { x: viewport.width / 2, y: viewport.height * 0.54 }
  camera.reset(player.x, player.z)

  const samples = []
  for (let frame = 0; frame < movingFrames; frame += 1) {
    player.x += Math.sin(facing) * player.actualSpeed / 60
    player.z += Math.cos(facing) * player.actualSpeed / 60
    camera.update(player, 1 / 60)
    samples.push(projectWorld(player.x, player.z, camera.x, camera.z, viewport))
  }

  const preStop = samples.at(-1)
  player.actualSpeed = 0
  const stopSamples = []
  for (let frame = 0; frame < 90; frame += 1) {
    camera.update(player, 1 / 60)
    stopSamples.push(projectWorld(player.x, player.z, camera.x, camera.z, viewport))
  }

  return { camera, focalPoint, player, samples, preStop, stopSamples }
}

describe('runtime2d release regressions', () => {
  it.each(RELEASE_VIEWPORTS.flatMap((viewport) => (
    TRAVEL_DIRECTIONS.map((direction) => ({ viewport, direction }))
  )))('keeps $viewport.name $direction.name movement visible and settles after stopping', ({ viewport, direction }) => {
    const { focalPoint, samples, preStop, stopSamples } = simulateCameraTravel(
      viewport,
      direction.facing,
    )
    const distances = samples.map((sample) => screenDistance(sample, focalPoint))
    const frameDeltas = samples.slice(1).map((sample, index) => screenDistance(sample, samples[index]))

    // A bounded camera trail must let the heroine visibly traverse the floor;
    // a focal-point pin would make every direction read like a treadmill.
    expect(Math.max(...distances)).toBeGreaterThan(viewport.width * 0.035)
    // Camera response must remain continuous instead of producing a page/gate
    // jump at an edge. The threshold is deliberately generous versus the
    // measured 2.5-5.5 px per 60 Hz frame.
    expect(Math.max(...frameDeltas)).toBeLessThan(viewport.width * 0.01)
    expect(screenDistance(preStop, focalPoint)).toBeGreaterThan(viewport.width * 0.03)

    // Stopping is a zero-velocity hold, not a second easing pass toward the
    // focal point. The player's last moving screen position must stay put so
    // the floor cannot continue sliding underneath a stationary player.
    const stopDeltas = stopSamples.map((sample, index) => screenDistance(
      sample,
      index === 0 ? preStop : stopSamples[index - 1],
    ))
    expect(Math.max(...stopDeltas)).toBeLessThanOrEqual(0.5)
    expect(screenDistance(stopSamples.at(-1), preStop)).toBeLessThanOrEqual(0.5)
  })

  it.each(RELEASE_VIEWPORTS)('preserves player/prop/projectile offsets through camera travel at $name', (viewport) => {
    const camera = new WorldCamera2D({ snapDistance: 1000, lookAheadSeconds: 0 })
    const player = { x: 1.25, z: -2.5, actualSpeed: 6, facing: Math.PI / 4 }
    const propOffset = { x: 3.5, z: 2.25 }
    const projectileOffset = { x: -1, z: -2 }
    camera.reset(player.x, player.z)

    let initialRelations = null
    for (let frameIndex = 0; frameIndex < 120; frameIndex += 1) {
      player.x += Math.sin(player.facing) * player.actualSpeed / 60
      player.z += Math.cos(player.facing) * player.actualSpeed / 60
      // Move each presentation layer with the same simulation sample. This
      // isolates camera travel from gameplay-relative motion.
      const prop = { x: player.x + propOffset.x, z: player.z + propOffset.z }
      const projectile = {
        x: player.x + projectileOffset.x,
        z: player.z + projectileOffset.z,
      }
      camera.update(player, 1 / 60)
      const frame = createWorldFrame2D(camera.x, camera.z, viewport, {})
      const playerScreen = projectWorldWithFrame2D(player.x, player.z, frame, {})
      const propScreen = projectWorldWithFrame2D(prop.x, prop.z, frame, {})
      const projectileScreen = projectWorldWithFrame2D(projectile.x, projectile.z, frame, {})
      const relations = {
        propX: propScreen.x - playerScreen.x,
        propY: propScreen.y - playerScreen.y,
        projectileX: projectileScreen.x - playerScreen.x,
        projectileY: projectileScreen.y - playerScreen.y,
      }

      if (!initialRelations) initialRelations = relations
      expect(relations.propX).toBeCloseTo(initialRelations.propX, 8)
      expect(relations.propY).toBeCloseTo(initialRelations.propY, 8)
      expect(relations.projectileX).toBeCloseTo(initialRelations.projectileX, 8)
      expect(relations.projectileY).toBeCloseTo(initialRelations.projectileY, 8)
      expect(relations.propX).toBeCloseTo(propOffset.x * frame.unit, 8)
      expect(relations.propY).toBeCloseTo(propOffset.z * frame.depthUnit, 8)
      expect(relations.projectileX).toBeCloseTo(projectileOffset.x * frame.unit, 8)
      expect(relations.projectileY).toBeCloseTo(projectileOffset.z * frame.depthUnit, 8)
    }
  })

  it('routes player, props, enemies and projectiles through one camera-owned projection frame', () => {
    expect(presentationSource).toMatch(/_projectWorld\(x, z, out = _screen\)\s*\{[\s\S]*?projectWorldWithFrame2D\(x, z, this\.worldFrame, out\)/)
    for (const method of ['_placeActor', '_renderProps', '_renderEnemies', '_renderProjectiles']) {
      const methodStart = presentationSource.indexOf(`  ${method}(`)
      expect(methodStart, `${method} must exist`).toBeGreaterThanOrEqual(0)
      const methodBody = presentationSource.slice(methodStart, methodStart + 5000)
      const projectionCall = method === '_renderEnemies'
        ? 'this._placeActor('
        : 'this._projectWorld('
      expect(methodBody, `${method} must use shared world projection`).toContain(projectionCall)
    }
  })

  it('keeps shop and codex tabs paired with bounded, keyboard-addressable panes', () => {
    for (const tab of ['cultivation', 'affinity']) {
      expect(shopSource).toMatch(new RegExp(
        `role="tab"[^>]*data-shop-tab="${tab}"[^>]*aria-controls="shop-pane-${tab}"`,
      ))
      expect(shopSource).toContain(`data-shop-pane="${tab}"`)
    }
    for (const tab of ['weapons', 'enemies', 'bosses', 'achievements', 'records']) {
      expect(codexSource).toMatch(new RegExp(
        `role="tab"[^>]*data-codex-tab="${tab}"[^>]*aria-controls="codex-pane-${tab}"`,
      ))
      expect(codexSource).toContain(`data-codex-pane="${tab}"`)
    }

    for (const source of [shopSource, codexSource]) {
      expect(source).toMatch(/tab\.setAttribute\('aria-selected', String\(selected\)\)/)
      expect(source).toMatch(/tab\.tabIndex = selected \? 0 : -1/)
      expect(source).toMatch(/for \(const pane of this\.panes\) pane\.hidden = pane\.dataset\.[a-z]+Pane !== tabId/)
      expect(source).toMatch(/const keys = \['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/)
    }

    expect(uiCss).toMatch(/\.shop-inner\s*\{[^}]*height:\s*min\(820px, calc\(100dvh - 40px\)\)[^}]*overflow:\s*hidden/s)
    expect(uiCss).toMatch(/\.shop-scroll\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s)
    expect(uiCss).toMatch(/\.shop-pane,\s*\.codex-pane\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow:\s*auto/s)
  })

  it('locks Game2D to silent-only audio without constructing a browser audio context', () => {
    expect(gameSource).toMatch(/this\.audio = new AudioEngine\(\{ silentOnly: true \}\)/)
    expect(gameSource).toMatch(/this\._unlockAudio = \(\) => \{\s*if \(this\.audio\.silentOnly\) return/s)
    expect(gameSource).toMatch(/const unlocked = this\.audio\.silentOnly\s*\n\s*\? false/s)
    expect(gameSource).toMatch(/if \(this\.audio\.silentOnly\) \{\s*this\._banner\('이 빌드에서는 소리를 재생하지 않습니다'/s)

    let factoryCalls = 0
    const storage = {
      getItem: () => JSON.stringify({ version: 2, muted: false, master: 1, music: 1, sfx: 1 }),
      setItem: () => {},
    }
    const audio = new AudioEngine({
      silentOnly: true,
      storage,
      contextFactory: () => {
        factoryCalls += 1
        throw new Error('silent-only audio must not request AudioContext')
      },
    })

    expect(audio.silentOnly).toBe(true)
    expect(audio.muted).toBe(true)
    expect(audio.ensureUnlocked()).toBe(false)
    expect(audio.unlock()).toBe(false)
    expect(audio.toggleMute()).toBe(true)
    audio.setMuted(false)
    expect(audio.muted).toBe(true)
    expect(factoryCalls).toBe(0)
  })
})
