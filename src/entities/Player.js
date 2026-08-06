import * as THREE from 'three'
import { buildChibi } from '../art/ChibiBuilder.js'
import { computeStats, applyMaxHpChange } from '../combat/Stats.js'
import { mitigate } from '../combat/damage.js'
import { xpFor } from '../data/realms.js'

export const DASH_DISTANCE = 6
export const DASH_IFRAMES = 0.35
export const DASH_COOLDOWN = 3.0
export /**
 * Brief invulnerability after any hit. This is what caps incoming damage when
 * the player is surrounded: without it, twenty enemies in contact all land hits
 * on their own cooldowns and being swarmed is instant death regardless of HP.
 */
const MERCY_IFRAMES = 0.4
const AFTERIMAGES = 5
const AFTERIMAGE_LIFE = 0.35

const _scratch = { x: 0, z: 0 }

/**
 * The player: movement, 축지법 dash, health, and cultivation progress.
 *
 * `update` only ever runs on a fixed tick; `render` interpolates between the
 * previous and current simulated position so motion stays smooth above 60Hz.
 */
export class Player {
  constructor(character, scene, terrain, { metaMods = [], reviveCharges = 0 } = {}) {
    this.character = character
    this.scene = scene
    this.terrain = terrain
    // Permanent 단전 upgrades, folded in alongside 공법 on every stat rebuild.
    this.metaMods = metaMods
    this.reviveCharges = reviveCharges

    this.x = 0
    this.z = 0
    this.prevX = 0
    this.prevZ = 0
    this.facing = 0
    this.alive = true

    this.invulnTimer = 0
    this.dashCooldown = 0
    this.hitFlash = 0
    this.actualSpeed = 0

    this.level = 1
    this.xp = 0
    this.stones = 0
    this.kills = 0

    this.loadout = { weapons: {}, passives: {} }
    if (character.startWeapon) this.loadout.weapons[character.startWeapon] = 1

    this.stats = computeStats(character, this.loadout.passives, this.metaMods)
    this.maxHp = this.stats.maxHp
    this.hp = this.maxHp

    this.chibi = buildChibi(character)
    scene.add(this.chibi.root)

    // A small, shadowless cool fill keeps the face, robe layers, and jade
    // hardware readable against the moonlit court. It follows the hero rather
    // than illuminating the whole arena, so the scene keeps its contrast and
    // the light cost stays bounded to one additional light.
    this.heroFill = new THREE.PointLight(0x76c9ff, 1.25, 7.5, 2)
    this.heroFill.position.set(0, 3.05, 2.2)
    scene.add(this.heroFill)

    // Dash trail: a fixed pool of translucent copies, never allocated mid-run.
    this.afterimages = []
    const trailMat = new THREE.MeshBasicMaterial({
      color: character.palette.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    for (let i = 0; i < AFTERIMAGES; i++) {
      const ghost = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.9, 4, 10), trailMat.clone())
      ghost.visible = false
      scene.add(ghost)
      this.afterimages.push({ mesh: ghost, life: 0 })
    }
  }

  get isInvulnerable() {
    return this.invulnTimer > 0
  }

  /** 0..1, how fast she is moving relative to her top speed. Drives animation. */
  get speed01() {
    return Math.min(1, this.actualSpeed / Math.max(0.001, this.stats.moveSpeed))
  }

  get xpNeeded() {
    return xpFor(this.level)
  }

  /** Rebuild stats from the loadout. Call after every upgrade. */
  recomputeStats() {
    const oldMax = this.maxHp
    this.stats = computeStats(this.character, this.loadout.passives, this.metaMods)
    this.maxHp = this.stats.maxHp
    this.hp = Math.min(this.maxHp, applyMaxHpChange(this.hp, oldMax, this.maxHp))
  }

  /** Returns how many levels were gained, so the caller can queue that many modals. */
  addXp(amount) {
    this.xp += amount
    let gained = 0
    while (this.xp >= xpFor(this.level)) {
      this.xp -= xpFor(this.level)
      this.level++
      gained++
    }
    return gained
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }

  takeDamage(rawAmount) {
    if (!this.alive || this.isInvulnerable) return false
    const dealt = mitigate(rawAmount, this.stats.armor)
    this.hp -= dealt
    this.invulnTimer = MERCY_IFRAMES
    this.hitFlash = 0.4
    this.chibi.setExpression('hurt', 0.4)
    // Reported outward so Game can shake, flash and freeze without Player
    // needing to know those systems exist.
    if (this.onHurt) this.onHurt(dealt / Math.max(1, this.maxHp))
    if (this.hp <= 0) {
      // 환혼단 — spend a charge to get back up instead of ending the run.
      if (this.reviveCharges > 0) {
        this.reviveCharges--
        this.hp = this.maxHp * 0.5
        this.invulnTimer = 2.0
        this.revived = true
      } else {
        this.hp = 0
        this.alive = false
      }
    }
    return true
  }

  _dash() {
    let nx = this.x + Math.sin(this.facing) * DASH_DISTANCE
    let nz = this.z + Math.cos(this.facing) * DASH_DISTANCE
    _scratch.x = nx
    _scratch.z = nz
    this.terrain.clampToArena(_scratch)

    // Lay the trail along the path actually travelled.
    for (let i = 0; i < this.afterimages.length; i++) {
      const t = i / (this.afterimages.length - 1 || 1)
      const g = this.afterimages[i]
      g.mesh.position.set(
        this.x + (_scratch.x - this.x) * t,
        0.85,
        this.z + (_scratch.z - this.z) * t,
      )
      g.mesh.visible = true
      g.life = AFTERIMAGE_LIFE * (0.4 + t * 0.6)
      g.mesh.material.opacity = 0.55 * (1 - t * 0.5)
    }

    this.x = _scratch.x
    this.z = _scratch.z
    this.invulnTimer = Math.max(this.invulnTimer, DASH_IFRAMES)
    this.dashCooldown = DASH_COOLDOWN
    this.teleported = true
  }

  update(dt, input) {
    if (!this.alive) return
    this.prevX = this.x
    this.prevZ = this.z
    this.teleported = false

    this.invulnTimer = Math.max(0, this.invulnTimer - dt)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    this.hitFlash = Math.max(0, this.hitFlash - dt)

    const mx = input.moveX
    const mz = input.moveZ
    if (mx !== 0 || mz !== 0) this.facing = Math.atan2(mx, mz)

    const speed = this.stats.moveSpeed
    this.x += mx * speed * dt
    this.z += mz * speed * dt
    _scratch.x = this.x
    _scratch.z = this.z
    this.terrain.clampToArena(_scratch)
    this.x = _scratch.x
    this.z = _scratch.z

    if (input.consumeDash() && this.dashCooldown <= 0) this._dash()

    this.actualSpeed = Math.hypot(this.x - this.prevX, this.z - this.prevZ) / dt

    if (this.stats.regen > 0) this.heal(this.stats.regen * dt)

    for (const g of this.afterimages) {
      if (g.life <= 0) continue
      g.life -= dt
      if (g.life <= 0) {
        g.mesh.visible = false
      } else {
        g.mesh.material.opacity = 0.55 * (g.life / AFTERIMAGE_LIFE)
      }
    }
  }

  /** `alpha` is the fraction of a tick elapsed, for smooth sub-tick motion. */
  render(alpha, dt) {
    // A dash covers 6 units in a single tick; interpolating across it reads as a
    // fast glide instead of a blink, so snap on the tick that teleported.
    const t = this.teleported ? 1 : alpha
    this.chibi.root.position.x = this.prevX + (this.x - this.prevX) * t
    this.chibi.root.position.z = this.prevZ + (this.z - this.prevZ) * t
    const fx = Math.sin(this.facing)
    const fz = Math.cos(this.facing)
    this.heroFill.position.set(
      this.chibi.root.position.x + fx * 2.1,
      3.05,
      this.chibi.root.position.z + fz * 2.1,
    )
    this.chibi.update(dt, this.speed01, this.facing)
  }

  dispose() {
    this.chibi.dispose()
    this.heroFill.removeFromParent()
    for (const g of this.afterimages) {
      g.mesh.geometry.dispose()
      g.mesh.material.dispose()
      g.mesh.removeFromParent()
    }
    this.afterimages.length = 0
  }
}
