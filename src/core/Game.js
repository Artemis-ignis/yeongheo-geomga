import * as THREE from 'three'
import {
  createRenderer, createScene, resizeToWindow, shadowFollow,
} from '../world/Scene.js'
import { FollowCamera } from '../world/Camera.js'
import { Terrain, PLATEAU_RADIUS } from '../world/Terrain.js'
import { Sky } from '../world/Sky.js'
import { Grass } from '../world/Grass.js'
import { Post } from '../world/Post.js'
import { Player } from '../entities/Player.js'
import { EnemyManager } from '../entities/EnemyManager.js'
import { ProjectileManager } from '../entities/ProjectileManager.js'
import { PickupManager } from '../entities/PickupManager.js'
import { BossManager } from '../entities/BossManager.js'
import { WeaponSystem } from '../combat/WeaponSystem.js'
import { rollUpgrades, applyChoice } from '../combat/upgrades.js'
import { Vfx } from '../art/vfx.js'
import { buildChibi } from '../art/ChibiBuilder.js'
import { Clock, FIXED_DT } from './Time.js'
import { Quality } from './Quality.js'
import { Impact } from './Impact.js'
import { Input } from './Input.js'
import { RNG, makeSeed } from './RNG.js'
import { Emitter } from './Events.js'
import { CHARACTERS, getCharacter } from '../data/characters.js'
import { realmFor } from '../data/realms.js'
import { BOSS_SCHEDULE, RUN_SECONDS } from '../data/waves.js'
import { validateData } from '../data/validate.js'
import { STAGES, getStage } from '../data/stages.js'
import { Hud } from '../ui/Hud.js'
import { LevelUpModal } from '../ui/LevelUpModal.js'
import { OverlayCanvas } from '../ui/OverlayCanvas.js'
import { TitleScreen } from '../ui/TitleScreen.js'
import { ResultScreen } from '../ui/ResultScreen.js'
import { ShopScreen } from '../ui/ShopScreen.js'
import { CodexScreen } from '../ui/CodexScreen.js'
import { DebugOverlay } from '../ui/DebugOverlay.js'
import { Progress } from '../meta/Progress.js'
import * as Save from '../meta/Save.js'

const BREAKTHROUGH_RADIUS = 8
const BREAKTHROUGH_IFRAMES = 1.2

/**
 * Owns the state machine, the fixed-step loop, and all subsystem wiring.
 * This is the only module that knows about every other module.
 */
export class Game {
  constructor({ canvas, overlayCanvas, hudRoot }) {
    this.canvas = canvas
    this.overlayCanvas = overlayCanvas
    this.hudRoot = hudRoot

    this.state = 'boot'
    this.emitter = new Emitter()
    this.renderer = createRenderer(canvas)
    this.clock = new Clock()
    this.quality = new Quality(this.renderer)
    this.impact = new Impact()
    this.input = new Input(window)

    this.pendingLevels = 0
    this.runTime = 0
    this.victory = false

    // Meta progression is loaded once and lives for the whole session.
    this.progress = new Progress(Save.load())

    this.hud = new Hud(hudRoot)
    this.modal = new LevelUpModal(hudRoot)
    this.title = new TitleScreen(hudRoot, CHARACTERS, this.progress)
    this.result = new ResultScreen(hudRoot)
    this.shop = new ShopScreen(hudRoot, this.progress, () => this._persist())
    this.codex = new CodexScreen(hudRoot, this.progress)
    this.debug = new DebugOverlay(hudRoot)
    this.pauseNote = document.createElement('div')
    this.pauseNote.className = 'pause-note'
    this.pauseNote.textContent = '일시정지'
    this.pauseNote.style.display = 'none'
    hudRoot.appendChild(this.pauseNote)

    this.hud.hide()

    this._onResize = () => this._resize()
    addEventListener('resize', this._onResize)
    this._onVisibility = () => {
      if (document.hidden && this.state === 'playing') this._setPaused(true)
    }
    document.addEventListener('visibilitychange', this._onVisibility)
  }

  start() {
    if (import.meta.env?.DEV) validateData()
    this._buildWorld()
    this._showTitle()
    this.renderer.setAnimationLoop((now) => this._frame(now))
  }

  // ---- world ---------------------------------------------------------------

  _buildWorld(stage = STAGES[0]) {
    this.stage = stage
    this.scene = createScene(stage.palette)
    this.camera = new FollowCamera(Math.max(1, innerWidth) / Math.max(1, innerHeight))
    this.sun = this.scene.userData.sun
    this.terrain = new Terrain(this.scene, stage.palette)
    this.grass = new Grass(this.scene, 0, PLATEAU_RADIUS - 2, {
      palette: stage.palette, density: stage.grassDensity,
    })
    this.sky = new Sky(this.scene, stage.palette)
    this.overlay = new OverlayCanvas(this.overlayCanvas, this.camera.camera)
    this.post = new Post(this.renderer, this.scene, this.camera.camera, stage.palette)
    this._resize()
  }

  /** Tear the arena down so a different 비경 can be built in its place. */
  _teardownWorld() {
    this.terrain?.dispose()
    this.grass?.dispose()
    this.sky?.dispose()
    this._clearPreview()
    this.terrain = null
    this.grass = null
    this.sky = null
  }

  /** Rebuild the arena for a stage, keeping camera, post and overlay alive. */
  _setStage(stage) {
    if (this.stage?.id === stage.id) return
    this._teardownWorld()
    this.stage = stage
    this.scene = createScene(stage.palette)
    this.sun = this.scene.userData.sun
    this.terrain = new Terrain(this.scene, stage.palette)
    this.grass = new Grass(this.scene, 0, PLATEAU_RADIUS - 2, {
      palette: stage.palette, density: stage.grassDensity,
    })
    this.sky = new Sky(this.scene, stage.palette)
    // The composer holds a reference to the old scene, so it has to be rebuilt.
    this.post.dispose()
    this.post = new Post(this.renderer, this.scene, this.camera.camera, stage.palette)
    this._resize()
  }

  _showTitle() {
    this.state = 'title'
    this.hud.hide()
    this.previewChibis = CHARACTERS.map((c, i) => {
      const chibi = buildChibi(c)
      chibi.root.position.set((i - 1) * 3.4, 0, 0)
      chibi.setOrbitSwords(2)
      this.scene.add(chibi.root)
      return chibi
    })
    this.camera.setAspect(this.camera.camera.aspect)
    this.camera.snapTo(0, 0)
    this.title.show({
      onStart: (id, stageId) => this._startRun(id, stageId),
      onUnlock: () => this._persist(),
      onShop: () => { this.state = 'shop'; this.shop.show(() => { this.state = 'title'; this.title.show() }) },
      onCodex: () => { this.state = 'codex'; this.codex.show(() => { this.state = 'title'; this.title.show() }) },
    })
  }

  _persist() {
    Save.save(this.progress.toSaveState())
  }

  _clearPreview() {
    if (!this.previewChibis) return
    for (const c of this.previewChibis) c.dispose()
    this.previewChibis = null
  }

  _startRun(characterId, stageId) {
    if (stageId) this._setStage(getStage(stageId))
    this._clearPreview()

    this.seed = makeSeed()
    this.rng = new RNG(this.seed)
    this.runTime = 0
    this.victory = false
    this.pendingLevels = 0

    this.player = new Player(getCharacter(characterId), this.scene, this.terrain, {
      metaMods: this.progress.statMods,
      reviveCharges: this.progress.reviveCharges,
    })
    this.enemies = new EnemyManager(this.scene, this.rng)
    this.enemies.stage = this.stage
    this.projectiles = new ProjectileManager(this.scene)
    this.pickups = new PickupManager(this.scene)
    this.vfx = new Vfx(this.scene)

    this.world = {
      scene: this.scene,
      enemies: this.enemies,
      projectiles: this.projectiles,
      pickups: this.pickups,
      vfx: this.vfx,
      terrain: this.terrain,
      camera: this.camera,
      player: this.player,
    }
    this.boss = new BossManager(this.scene, this.world, this.rng)
    this.enemies.boss = this.boss
    this.weapons = new WeaponSystem(this.world, this.rng)
    this.weapons.sync(this.player.loadout, this.player, this.player.stats)

    this._wireCallbacks()

    this.camera.snapTo(this.player.x, this.player.z)
    this.hud.show()
    this.overlay.clear()
    this.state = 'playing'
  }

  _wireCallbacks() {
    this.enemies.onDamageText = (x, y, z, amount, crit) => this.overlay.pushText(x, y, z, amount, crit)
    this.boss.onDamageText = (x, y, z, amount, crit) => this.overlay.pushText(x, y, z, amount, crit)

    this.enemies.onKill = (x, z, xp, def, wasFrozen) => {
      this.vfx.deathPuff(x, z)
      this.pickups.drop('qi', x, z, xp)
      this.progress.markSeen('enemies', def.id)

      // 영석 is what carries out of the run, so it has to actually drop during
      // one. Value scales with run time so late minutes are worth farming.
      // Rates measured against a scripted 3-minute run: this yields ~190 영석,
      // enough to buy one or two 단전 upgrades per attempt.
      const minute = this.runTime / 60
      if (def.elite) {
        this.pickups.drop('stone', x, z, Math.round(8 + minute * 1.6))
      } else if (this.rng.chance(0.18)) {
        this.pickups.drop('stone', x, z, Math.round(2 + minute * 0.9))
      }

      // Elites always drop a 회춘단; ordinary enemies rarely do. Some sustain has
      // to exist before elites appear at 7:00 or the early game is unrecoverable.
      if (def.elite) {
        this.pickups.drop('heal', x, z, this.player.maxHp * 0.15)
        // Elites are rare enough that stopping the frame on one reads as weight
        // rather than as stutter.
        this.impact.hitstop(0.05)
        this.impact.punch(0.5)
        this.camera.addTrauma(0.25)
      } else if (this.rng.chance(0.02)) {
        this.pickups.drop('heal', x, z, this.player.maxHp * 0.08)
      }
      // 한천빙봉: a frozen enemy shatters, chaining through packed groups.
      if (wasFrozen) {
        this.vfx.burst(x, z, 3)
        this.enemies.damageAt(x, z, 3, 40, 'ice', this.player.stats, {})
      }
    }

    this.player.onHurt = (fraction) => {
      this.impact.screenFlash(Math.min(0.55, 0.18 + fraction * 2.2), 1, 0.22, 0.26)
      this.camera.addTrauma(0.22 + fraction * 1.2)
      if (fraction > 0.12) this.impact.hitstop(0.04)
    }

    this.enemies.onEnemyShot = (x, z, dx, dz, damage, speed) => {
      this.projectiles.spawn('enemyShot', {
        x, z, y: 1.0, dirX: dx, dirZ: dz, speed, damage, hostile: true, life: 5,
      })
    }

    this.pickups.onCollect = (kind, value) => {
      if (kind === 'qi') {
        const gained = this.player.addXp(value * this.player.stats.growth)
        if (gained > 0) this._breakthrough(gained)
      } else if (kind === 'stone') {
        this.player.stones += value
      } else if (kind === 'heal') {
        this.player.heal(value)
      } else if (kind === 'chest') {
        this.player.stones += 500
        this.pendingLevels += 1
        this._openNextModal()
      }
    }

    this.boss.onWarning = (def) => {
      this.overlay.pushBanner(def.name)
      this.camera.addTrauma(0.4)
      this.progress.markSeen('bosses', def.id)
    }
    this.boss.onPhase = () => {
      this.impact.hitstop(0.11)
      this.impact.punch(1.0)
      this.impact.screenFlash(0.42, 0.85, 0.45, 1.0)
    }
    this.boss.onDefeated = (id, x, z) => {
      this.impact.hitstop(0.12)
      this.impact.punch(1.4)
      this.impact.screenFlash(0.7, 1, 0.92, 0.75)
      if (id === 'blueWolfKing') {
        this.pickups.drop('chest', x, z, 1)
      } else {
        this.victory = true
        this._endRun()
      }
    }
  }

  /** 경지 돌파: a shockwave that buys breathing room, then the upgrade choice. */
  _breakthrough(levels) {
    const p = this.player
    this.vfx.pillar(p.x, p.z)
    this.vfx.shockRing(p.x, p.z, BREAKTHROUGH_RADIUS)
    this.camera.addTrauma(0.5)
    this.enemies.damageAt(
      p.x, p.z, BREAKTHROUGH_RADIUS, 20 + p.level * 4, 'array', p.stats, { knockback: 12 },
    )
    p.invulnTimer = Math.max(p.invulnTimer, BREAKTHROUGH_IFRAMES)
    p.chibi.setExpression('breakthrough', 1.0)
    this.impact.hitstop(0.07)
    this.impact.punch(1.1)
    this.impact.screenFlash(0.4, 0.7, 1, 0.85)
    this.pendingLevels += levels
    this._openNextModal()
  }

  _openNextModal() {
    if (this.modal.isOpen || this.pendingLevels <= 0) return
    this.pendingLevels--
    const choices = rollUpgrades(
      this.player.loadout, this.player.stats, this.rng, 3, this.progress.unlockedWeapons,
    )

    // Late in a run everything is maxed and the roll can only return consumables.
    // Interrupting the fight every few seconds to pick between three rewards that
    // are all equivalent is worse than just granting one, so take it silently.
    if (choices.every((c) => c.kind === 'consumable')) {
      this._takeUpgrade(choices[0])
      return
    }

    this.state = 'levelUp'
    this.modal.open(choices, (choice) => this._takeUpgrade(choice))
  }

  _takeUpgrade(choice) {
    applyChoice(this.player.loadout, choice)
    if (choice.kind === 'weapon' || choice.kind === 'evolution') {
      this.progress.markSeen('weapons', choice.id)
    }
    if (choice.kind === 'consumable') {
      if (choice.id === 'heal') this.player.heal(this.player.maxHp * 0.3)
      else if (choice.id === 'stones') this.player.stones += 200
      else if (choice.id === 'purge') {
        this.enemies.purgeOnScreen(this.camera, this.player.x, this.player.z, this.player.stats)
      }
    }
    this.player.recomputeStats()
    this.weapons.sync(this.player.loadout, this.player, this.player.stats)
    if (this.state === 'levelUp') this.state = 'playing'
    // Several levels can land at once; queue the next card immediately.
    this._openNextModal()
  }

  _endRun() {
    this.state = 'result'
    this.hud.hide()

    // Everything earned in the run is banked here — this is the whole point of
    // the meta layer, so it happens before anything can go wrong on screen.
    const earned = this.progress.addStones(this.player.stones * this.progress.stoneMultiplier)
    const bests = this.progress.recordRun({
      runTime: this.runTime,
      level: this.player.level,
      kills: this.enemies.killCount,
      victory: this.victory,
    })
    this._persist()

    this.result.show({
      victory: this.victory,
      runTime: this.runTime,
      level: this.player.level,
      realm: realmFor(this.player.level),
      kills: this.enemies.killCount,
      stones: this.player.stones,
      earnedStones: earned,
      totalStones: this.progress.stones,
      bests,
      weapons: this.weapons.equipped,
      passives: Object.entries(this.player.loadout.passives).map(([id, level]) => ({ id, level })),
      seed: this.seed,
    }, () => this._restart())
  }

  _restart() {
    this._teardownRun()
    this._showTitle()
  }

  _teardownRun() {
    this.weapons?.clear()
    this.enemies?.dispose()
    this.projectiles?.dispose()
    this.pickups?.dispose()
    this.vfx?.dispose()
    this.boss?.clear()
    this.player?.dispose()
    this.overlay?.clear()
    this.enemies = null
    this.projectiles = null
    this.pickups = null
    this.vfx = null
    this.boss = null
    this.player = null
    this.weapons = null
  }

  // ---- loop ----------------------------------------------------------------

  _setPaused(on) {
    if (on && this.state === 'playing') {
      this.state = 'paused'
      this.pauseNote.style.display = ''
    } else if (!on && this.state === 'paused') {
      this.state = 'playing'
      this.pauseNote.style.display = 'none'
    }
  }

  _readMenuInput() {
    const slot = this.input.consumeSlot()
    const confirm = this.input.consumeConfirm()
    let dir = 0
    if (this.input.moveX > 0.5) dir = 1
    else if (this.input.moveX < -0.5) dir = -1

    if (this.state === 'title') this.title.handleKey(slot, confirm, this._edge(dir))
    else if (this.state === 'levelUp') this.modal.handleKey(slot, confirm, this._edge(dir))
    else if (this.state === 'result') this.result.handleKey(confirm)
    else if (this.state === 'shop') this.shop.handleKey(confirm)
    else if (this.state === 'codex') this.codex.handleKey(confirm)
  }

  /** Convert held direction into a single step, so a held key does not scroll. */
  _edge(dir) {
    const changed = dir !== this._lastDir
    this._lastDir = dir
    return changed ? dir : 0
  }

  update(dt) {
    const p = this.player
    this.runTime += dt

    p.update(dt, this.input)
    this.enemies.update(dt, this.runTime, p, this.camera)
    this.boss.checkWarning(this.runTime, BOSS_SCHEDULE)
    for (const entry of BOSS_SCHEDULE) {
      if (this.runTime >= entry.t && !this._spawned?.has(entry.id)) {
        this._spawned ??= new Set()
        this._spawned.add(entry.id)
        this.boss.spawn(entry.id, p, this.runTime)
      }
    }
    this.boss.update(dt, p, this.runTime)
    this.weapons.update(dt, p, p.stats, this.runTime)
    this.projectiles.update(dt, this.enemies, p)
    this.pickups.update(dt, p, this.vfx)
    this.vfx.update(dt)
    this.terrain.update(dt, p.x, p.z)
    this.grass.update(dt, p.x, p.z)
    this.sky.update(dt, p.x, p.z)
    this.camera.update(p.x, p.z, dt)

    if (!p.alive) this._endRun()
  }

  draw(alpha, dt) {
    if (this.player) {
      this.player.render(alpha, dt)
      this.enemies.render(alpha)
      this.projectiles.render(alpha)
      this.pickups.render()
      this.boss.render(alpha)
      shadowFollow(this.sun, this.player.x, this.player.z)
    } else if (this.previewChibis) {
      for (const c of this.previewChibis) c.update(dt, 0.35, Math.sin(performance.now() * 0.0004) * 0.7)
      this.sky.update(dt, 0, 0)
      this.terrain.update(dt, 0, 0)
      this.grass.update(dt, 0, 0)
    }
    this.post.render(this.scene, this.camera.camera)
    this.overlay.render(dt)
  }

  _frame(now) {
    try {
      const elapsedMs = this._last === undefined ? 16 : now - this._last
      const dt = elapsedMs / 1000
      this._last = now
      if (this.state === 'playing') this.quality.sample(elapsedMs)

      if (this.input.consumeDebug()) this.debug.toggle()
      if (this.input.consumeQuality()) {
        this.overlay.pushBanner(`화질 ${this.quality.cycle()}`, 1.4)
      }
      if (this.input.consumePause() && (this.state === 'playing' || this.state === 'paused')) {
        this._setPaused(this.state === 'playing')
      }
      this._readMenuInput()

      // Impact runs on real time: hitstop has to keep counting down while the
      // simulation it is pausing is not running.
      this.impact.update(dt)
      this.camera.setPunch(this.impact.zoom)
      this.post.setFlash(this.impact.flash, this.impact.flashColor)

      if (this.state === 'playing' && !this.impact.frozen) {
        const ticks = this.clock.step(dt)
        for (let i = 0; i < ticks; i++) {
          this.update(FIXED_DT)
          if (this.state !== 'playing') break
        }
      } else {
        this.clock.reset()
      }

      if (this.state === 'playing' || this.state === 'levelUp' || this.state === 'paused') {
        this.hud.update(this._hudState(), dt)
      }
      this.draw(this.clock.alpha, dt)
      this.debug.update(this._debugState(dt))
    } catch (err) {
      this._crash(err)
    }
  }

  _hudState() {
    const p = this.player
    const b = this.boss?.active
    return {
      hp: p.hp, maxHp: p.maxHp,
      xp: p.xp, xpNeeded: p.xpNeeded,
      level: p.level, realm: realmFor(p.level),
      runTime: this.runTime,
      kills: this.enemies.killCount,
      stones: Math.round(p.stones),
      dashCooldown: p.dashCooldown,
      weapons: this.weapons.equipped,
      passives: Object.entries(p.loadout.passives).map(([id, level]) => ({ id, level })),
      boss: b ? { name: b.def.name, hp: b.hp, maxHp: b.maxHp } : null,
    }
  }

  _debugState(dt) {
    const info = this.renderer.info.render
    return {
      dt,
      state: this.state,
      drawCalls: info.calls,
      triangles: info.triangles,
      enemies: this.enemies?.liveCount ?? 0,
      projectiles: this.projectiles?.liveCount ?? 0,
      pickups: this.pickups?.liveCount ?? 0,
      dropped: (this.enemies?.pool.dropped ?? 0)
        + (this.projectiles?.pool.dropped ?? 0)
        + (this.pickups?.pool.dropped ?? 0),
      scale: this.quality.scale,
      seed: this.seed ?? 0,
    }
  }

  _crash(err) {
    this.renderer.setAnimationLoop(null)
    this.state = 'error'
    console.error(err)
    const panel = document.createElement('div')
    panel.className = 'error-panel'
    panel.innerHTML = `
      <div>
        <h1 style="color:#e8836a;font-size:1.3rem;">오류가 발생해 게임을 멈췄습니다</h1>
        <pre>${String(err?.stack ?? err)}\n\nseed ${this.seed ?? '-'}</pre>
      </div>`
    this.hudRoot.appendChild(panel)
  }

  _resize() {
    resizeToWindow(this.renderer, this.camera, this.overlayCanvas)
    this.overlay?.resize(innerWidth, innerHeight, Math.min(devicePixelRatio, 1.5))
    this.post?.setSize(Math.max(1, innerWidth), Math.max(1, innerHeight))
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    removeEventListener('resize', this._onResize)
    document.removeEventListener('visibilitychange', this._onVisibility)
    this.input.dispose()
    this._teardownRun()
    this._clearPreview()
    this.hud.dispose()
    this.modal.dispose()
    this.title.dispose()
    this.result.dispose()
    this.shop.dispose()
    this.codex.dispose()
    this.debug.dispose()
  }
}

void THREE
void RUN_SECONDS
