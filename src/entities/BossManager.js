import * as THREE from 'three'
import { buildMerged } from '../art/geometry.js'
import { makeToonMaterial, makeAdditiveMaterial } from '../art/materials.js'
import { glowTexture } from '../art/textures.js'
import { rollDamage } from '../combat/damage.js'
import { buildBossGeometry } from '../art/bossGeometry.js'

export const BOSSES = {
  blueWolfKing: {
    id: 'blueWolfKing',
    name: '요왕 창랑',
    // The model is built at roughly 2.4 units tall, so this puts him at ~5.3 —
    // about three times the cultivator, which is where "boss" starts to read.
    hp: 6000, radius: 2.6, damage: 30, speed: 3.0, scale: 2.2,
    color: 0x5f7fa8,
  },
  darkHeavenLord: {
    id: 'darkHeavenLord',
    name: '마존 흑천',
    // Built at ~5.6 units tall already, so barely scaled.
    hp: 24000, radius: 2.0, damage: 40, speed: 2.6, scale: 1.15,
    color: 0x4a2a70,
  },
}

const WARNING_LEAD = 3
const _dummy = new THREE.Object3D()

/**
 * The two boss encounters.
 *
 * A boss is a single non-instanced group — there is only ever one alive, so it
 * can afford detail and its own shadow. It registers itself with the enemy
 * spatial hash each tick under a reserved id so ordinary weapons can find it.
 */
export class BossManager {
  constructor(scene, world, rng) {
    this.scene = scene
    this.world = world
    this.rng = rng
    this.active = null
    this.group = null
    this.onDefeated = null
    this.onWarning = null
    this.warned = new Set()
  }

  _buildWolfKing(def) {
    const group = new THREE.Group()
    const body = new THREE.Mesh(
      buildBossGeometry('blueWolfKing'),
      makeToonMaterial({ color: 0xffffff, rim: 0.2, rimColor: 0xbfe4ff, vertexColors: true }),
    )
    body.scale.setScalar(def.scale)
    body.castShadow = true
    group.add(body)

    // Additive glow over the baked eyes so they read from across the arena.
    const eyeMat = makeAdditiveMaterial({ color: 0xff8a4a, opacity: 0.9, map: glowTexture() })
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), eyeMat)
      eye.position.set(side * 0.2 * def.scale, 1.5 * def.scale, 1.85 * def.scale)
      group.add(eye)
    }
    return group
  }

  _buildDarkLord(def) {
    const group = new THREE.Group()
    const robe = new THREE.Mesh(
      buildBossGeometry('darkHeavenLord'),
      makeToonMaterial({ color: 0xffffff, rim: 0.24, rimColor: 0xc8a0ff, vertexColors: true }),
    )
    robe.scale.setScalar(def.scale)
    robe.castShadow = true
    group.add(robe)

    // The mask glow doubles as the phase indicator, so it stays a separate mesh.
    this.mask = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.0),
      makeAdditiveMaterial({ color: 0xd06aff, opacity: 0.85, map: glowTexture() }),
    )
    this.mask.position.set(0, 4.38 * def.scale, 0.5 * def.scale)
    group.add(this.mask)

    // Six blades orbiting behind him.
    const bladeMat = makeToonMaterial({ color: 0x8f6fd0, rim: 1.0, rimColor: 0xd8c0ff })
    this.blades = new THREE.InstancedMesh(
      buildMerged([
        [new THREE.BoxGeometry(0.09, 1.1, 0.04), {}],
        [new THREE.ConeGeometry(0.08, 0.3, 4), { y: 0.7 }],
      ]),
      bladeMat, 6,
    )
    group.add(this.blades)
    return group
  }

  spawn(bossId, player, runTime) {
    const def = BOSSES[bossId]
    if (!def || this.active) return

    this.group = bossId === 'blueWolfKing' ? this._buildWolfKing(def) : this._buildDarkLord(def)
    this.scene.add(this.group)

    const a = this.rng.angle()
    this.active = {
      def,
      x: player.x + Math.cos(a) * 16,
      z: player.z + Math.sin(a) * 16,
      prevX: 0, prevZ: 0,
      hp: def.hp,
      maxHp: def.hp,
      attackTimer: 3,
      phase: 0,
      staggerT: 0,
      chargeT: 0,
      chargeX: 0, chargeZ: 0,
      hitCd: 0,
      spawnedAt: runTime,
      flash: 0,
    }
    this.active.prevX = this.active.x
    this.active.prevZ = this.active.z
  }

  /** Fired 3 seconds ahead of a scheduled boss so the HUD can warn. */
  checkWarning(runTime, schedule) {
    for (const entry of schedule) {
      if (this.warned.has(entry.id)) continue
      if (runTime >= entry.t - WARNING_LEAD) {
        this.warned.add(entry.id)
        if (this.onWarning) this.onWarning(BOSSES[entry.id])
      }
    }
  }

  damage(rawDamage, tag, stats) {
    const b = this.active
    if (!b || b.staggerT > 0) return false
    const { amount, crit } = rollDamage(rawDamage, stats, tag, this.rng)
    b.hp -= amount
    b.flash = 1
    if (this.onDamageText) this.onDamageText(b.x, 3.0, b.z, amount, crit)

    // Phase transitions: stagger, shove the player back, shift the mask colour.
    const frac = b.hp / b.maxHp
    const wantPhase = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2
    if (wantPhase > b.phase) {
      b.phase = wantPhase
      b.staggerT = 1.2
      this.world.vfx.shockRing(b.x, b.z, 6)
      this.world.camera.addTrauma(0.7)
      if (this.mask) this.mask.material.color.setHex(wantPhase === 1 ? 0xff6ad0 : 0xff5a5a)
    }

    if (b.hp <= 0) {
      this.world.vfx.burst(b.x, b.z, 9)
      this.world.camera.addTrauma(1)
      const { x, z, def } = b
      this._despawn()
      if (this.onDefeated) this.onDefeated(def.id, x, z)
      return true
    }
    return false
  }

  _despawn() {
    if (this.group) {
      this.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) o.material.dispose()
      })
      this.group.removeFromParent()
      this.group = null
    }
    this.active = null
    this.mask = null
    this.blades = null
  }

  _wolfAttack(b, player) {
    if (this.rng.chance(0.5)) {
      // Telegraphed charge along a marked lane.
      const dx = player.x - b.x
      const dz = player.z - b.z
      const d = Math.hypot(dx, dz) || 1
      b.chargeX = dx / d
      b.chargeZ = dz / d
      b.chargeT = 1.6
      for (let i = 1; i <= 8; i++) {
        this.world.vfx.telegraph(b.x + b.chargeX * i * 4, b.z + b.chargeZ * i * 4, 2.6, 1.0)
      }
    } else {
      // Howl: a ring of 요랑.
      this.world.vfx.shockRing(b.x, b.z, 5)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        this.world.enemies.spawn('wolf', b.x + Math.cos(a) * 4, b.z + Math.sin(a) * 4, b.spawnedAt)
      }
    }
  }

  _lordAttack(b, player) {
    const kind = b.phase === 2 ? this.rng.int(3) : this.rng.int(2)
    if (kind === 0) {
      // 검비: a converging ring of dark swords aimed where the player is now.
      const tx = player.x
      const tz = player.z
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        const sx = tx + Math.cos(a) * 12
        const sz = tz + Math.sin(a) * 12
        this.world.projectiles.spawn('darkSword', {
          x: sx, z: sz, y: 1.2,
          dirX: tx - sx, dirZ: tz - sz,
          speed: 13, damage: b.def.damage * 0.5, hostile: true, life: 2.4,
        })
      }
    } else if (kind === 1) {
      // 흑구환: a slow expanding ring with a findable gap.
      const gap = this.rng.int(12)
      for (let i = 0; i < 12; i++) {
        if (i === gap) continue
        const a = (i / 12) * Math.PI * 2
        this.world.projectiles.spawn('enemyShot', {
          x: b.x + Math.cos(a) * 3, z: b.z + Math.sin(a) * 3, y: 1.0,
          dirX: Math.cos(a), dirZ: Math.sin(a),
          speed: 5.5, damage: b.def.damage * 0.6, hostile: true, life: 4.2,
        })
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const a = this.rng.angle()
        this.world.enemies.spawn('demonCultivator', b.x + Math.cos(a) * 5, b.z + Math.sin(a) * 5, b.spawnedAt)
      }
    }
  }

  update(dt, player, runTime) {
    const b = this.active
    if (!b) return
    b.prevX = b.x
    b.prevZ = b.z
    b.flash = Math.max(0, b.flash - dt * 3)

    if (b.staggerT > 0) {
      b.staggerT -= dt
      return
    }

    const dx = player.x - b.x
    const dz = player.z - b.z
    const dist = Math.hypot(dx, dz) || 1

    if (b.chargeT > 0) {
      b.chargeT -= dt
      // Wind-up, then a fast lunge along the marked lane.
      if (b.chargeT < 1.0) {
        b.x += b.chargeX * 24 * dt
        b.z += b.chargeZ * 24 * dt
      }
    } else {
      // Phase 3 of 마존 is 30% faster; the wolf king keeps a constant pace.
      const speedMul = 1 + b.phase * 0.15
      b.x += (dx / dist) * b.def.speed * speedMul * dt
      b.z += (dz / dist) * b.def.speed * speedMul * dt

      b.attackTimer -= dt
      if (b.attackTimer <= 0) {
        const base = b.def.id === 'blueWolfKing' ? 5 : 4 - b.phase * 0.7
        b.attackTimer = base
        if (b.def.id === 'blueWolfKing') this._wolfAttack(b, player)
        else this._lordAttack(b, player)
      }
    }

    b.hitCd -= dt
    if (dist < b.def.radius + 0.6 && b.hitCd <= 0) {
      if (player.takeDamage(b.def.damage)) b.hitCd = 0.7
    }

    void runTime
  }

  /**
   * Target description handed to the damage systems. The boss is a single object
   * rather than a pooled entity, so it cannot live in the enemy arrays; weapons
   * reach it through this instead.
   */
  get target() {
    const b = this.active
    if (!b) return null
    return b
  }

  get x() { return this.active ? this.active.x : 0 }
  get z() { return this.active ? this.active.z : 0 }
  get radius() { return this.active ? this.active.def.radius : 0 }

  render(alpha) {
    const b = this.active
    if (!b || !this.group) return
    const x = b.prevX + (b.x - b.prevX) * alpha
    const z = b.prevZ + (b.z - b.prevZ) * alpha
    this.group.position.set(x, 0, z)
    this.group.rotation.y = Math.atan2(
      this.world.player ? this.world.player.x - b.x : 0,
      this.world.player ? this.world.player.z - b.z : 1,
    )

    if (this.blades) {
      const s = b.def.scale
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + performance.now() * 0.0012
        _dummy.position.set(
          Math.cos(a) * 2.4 * s,
          (3.2 + Math.sin(a * 2) * 0.4) * s,
          Math.sin(a) * 2.4 * s - 0.8 * s,
        )
        _dummy.rotation.set(0.3, -a, 0)
        _dummy.scale.setScalar(s)
        _dummy.updateMatrix()
        this.blades.setMatrixAt(i, _dummy.matrix)
      }
      this.blades.instanceMatrix.needsUpdate = true
    }
  }

  clear() {
    this._despawn()
    this.warned.clear()
  }
}
