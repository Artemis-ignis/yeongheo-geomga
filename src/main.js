import {
  createRenderer, createScene, isWebGL2Available,
  resizeToWindow, shadowFollow, showFallback,
} from './world/Scene.js'
import { FollowCamera } from './world/Camera.js'
import { Terrain } from './world/Terrain.js'
import { Sky } from './world/Sky.js'
import { Player } from './entities/Player.js'
import { EnemyManager } from './entities/EnemyManager.js'
import { ProjectileManager } from './entities/ProjectileManager.js'
import { WeaponSystem } from './combat/WeaponSystem.js'
import { Vfx } from './art/vfx.js'
import { Clock, FIXED_DT } from './core/Time.js'
import { Input } from './core/Input.js'
import { RNG, makeSeed } from './core/RNG.js'
import { getCharacter } from './data/characters.js'
import { validateData } from './data/validate.js'
import { installCapture, installStepper } from './dev/capture.js'

const canvas = document.getElementById('scene')
const overlayCanvas = document.getElementById('overlay')

if (!isWebGL2Available()) {
  showFallback('WebGL2 컨텍스트를 생성할 수 없습니다')
} else {
  boot()
}

function boot() {
  if (import.meta.env.DEV) validateData()

  const renderer = createRenderer(canvas)
  const scene = createScene()
  const follow = new FollowCamera(Math.max(1, innerWidth) / Math.max(1, innerHeight))
  const sun = scene.userData.sun

  const seed = makeSeed()
  const rng = new RNG(seed)
  const input = new Input(window)
  const terrain = new Terrain(scene)
  const sky = new Sky(scene)

  const player = new Player(getCharacter('seolryeong'), scene, terrain)
  const enemies = new EnemyManager(scene, rng)
  const projectiles = new ProjectileManager(scene)
  const vfx = new Vfx(scene)

  // The context weapons act through. Nothing here imports the UI layer.
  const world = { scene, enemies, projectiles, vfx, terrain, camera: follow }
  const weapons = new WeaponSystem(world, rng)
  weapons.sync(player.loadout, player, player.stats)

  enemies.onKill = (x, z, xp, def, wasFrozen) => {
    vfx.deathPuff(x, z)
    // 한천빙봉: a frozen enemy shatters, chaining through packed groups.
    if (wasFrozen) {
      vfx.burst(x, z, 3.0)
      enemies.damageAt(x, z, 3.0, 40, 'ice', player.stats, {})
    }
  }
  enemies.onEnemyShot = (x, z, dx, dz, damage, speed) => {
    projectiles.spawn('enemyShot', {
      x, z, y: 1.0, dirX: dx, dirZ: dz, speed, damage, hostile: true, life: 5,
    })
  }

  let runTime = 0
  follow.snapTo(player.x, player.z)

  resizeToWindow(renderer, follow, overlayCanvas)
  addEventListener('resize', () => resizeToWindow(renderer, follow, overlayCanvas))

  function update(dt) {
    runTime += dt
    player.update(dt, input)
    enemies.update(dt, runTime, player, follow)
    weapons.update(dt, player, player.stats, runTime)
    projectiles.update(dt, enemies, player)
    vfx.update(dt)
    terrain.update(dt, player.x, player.z)
    sky.update(dt, player.x, player.z)
    follow.update(player.x, player.z, dt)
  }

  function draw(alpha, dt) {
    player.render(alpha, dt)
    enemies.render(alpha)
    projectiles.render(alpha)
    shadowFollow(sun, player.x, player.z)
    renderer.render(scene, follow.camera)
  }

  const clock = new Clock()
  let last = performance.now()
  renderer.setAnimationLoop((now) => {
    const dt = (now - last) / 1000
    last = now
    const ticks = clock.step(dt)
    for (let i = 0; i < ticks; i++) update(FIXED_DT)
    draw(clock.alpha, dt)
  })

  if (import.meta.env.DEV) {
    window.__scene = scene
    window.__world = { terrain, sky, follow, renderer, player, enemies, projectiles, vfx, weapons, input, rng }
    window.__stats = () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      enemies: enemies.liveCount,
      projectiles: projectiles.liveCount,
      kills: enemies.killCount,
      dropped: enemies.pool.dropped + projectiles.pool.dropped,
      runTime: +runTime.toFixed(1),
      hp: +player.hp.toFixed(1),
      level: player.level,
      seed,
    })
    window.__setTime = (t) => { runTime = t }
    window.__give = (id, level = 1) => {
      player.loadout.weapons[id] = level
      player.recomputeStats()
      weapons.sync(player.loadout, player, player.stats)
      return player.loadout.weapons
    }
    window.__givePassive = (id, level = 1) => {
      player.loadout.passives[id] = level
      player.recomputeStats()
      weapons.sync(player.loadout, player, player.stats)
      return player.loadout.passives
    }
    installStepper(update, FIXED_DT)
    installCapture(renderer, (w, h) => {
      follow.setAspect(w / h)
      draw(1, 1 / 60)
    })
  }
}
