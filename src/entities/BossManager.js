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
  jadeVoidWarden: {
    id: 'jadeVoidWarden',
    name: '옥허진장',
    // A final boss built from the jade guardian reference: tall enough to own
    // the frame, but not so large that its weapon and halo leave the arena.
    hp: 28000, radius: 2.8, damage: 46, speed: 2.5, scale: 0.98,
    color: 0x3d9e8c,
    referenceAsset: 'characters/jade-void-warden-boss-reference-v2.png',
  },
  /**
   * 한천비경's own mid boss. Built at ~4.6 units tall, so barely scaled.
   *
   * She was written as a caster who stands off while 창랑 charges, and measured
   * against the same build on the same ground that made her nearly unkillable:
   * the player landed 82 damage a second on 창랑 and 17 on her. This game's kit
   * is built around things coming to you — 팔괘진 is an aura at the player's
   * feet and 뇌령주 orbits her — so two thirds of a typical loadout simply
   * cannot reach something that keeps its distance. A boss that never closes is
   * not a hard boss here, it is an immune one.
   *
   * So she closes, at 2.7 against 창랑's 3.0, and the difference between them
   * lives in the pattern table instead: he commits to charges and she marks the
   * ground. Her health is set from the DPS she actually takes rather than from
   * looking bigger than his number.
   */
  riverMaiden: {
    id: 'riverMaiden',
    name: '설녀 빙하',
    hp: 6600, radius: 2.2, damage: 34, speed: 2.7, scale: 1.15,
    color: 0x5f93bd,
  },
}

/**
 * Which builder makes which boss. A table rather than a chain of `===`, so
 * adding one is a data change and forgetting to wire it is a crash at spawn
 * rather than silently getting the wrong model.
 */
const BOSS_BUILDERS = {
  blueWolfKing(def) { return this._buildWolfKing(def) },
  darkHeavenLord(def) { return this._buildDarkLord(def) },
  jadeVoidWarden(def) { return this._buildJadeVoidWarden(def) },
  riverMaiden(def) { return this._buildRiverMaiden(def) },
}

const WARNING_LEAD = 3
const _dummy = new THREE.Object3D()

/**
 * Move order per phase, cycled rather than rolled.
 *
 * Attacks used to be picked at random, which means the fight has no rhythm and
 * nothing to learn — the player can only react, never anticipate, and two runs
 * against the same boss feel the same amount of arbitrary. A fixed cycle that
 * grows as the boss loses health gives each phase a shape, and gives a player
 * who has seen the fight before an actual advantage.
 */
export const BOSS_PATTERNS = {
  blueWolfKing: [
    ['charge', 'howl'],
    ['charge', 'stomp', 'howl'],
    ['stomp', 'charge', 'sweep', 'howl'],
  ],
  darkHeavenLord: [
    ['swordRing', 'gapRing'],
    ['starfall', 'swordRing', 'gapRing'],
    ['voidZone', 'starfall', 'swordRing', 'summon'],
  ],
  jadeVoidWarden: [
    ['jadePulse', 'gapRing'],
    ['jadePulse', 'swordRing', 'summon'],
    ['jadePulse', 'swordRing', 'gapRing', 'summon'],
  ],
  /**
   * She never charges. Every move is placed on the ground at range, so the
   * fight is about reading marks rather than about dodging a body — the
   * opposite of 창랑, who is nothing but body.
   */
  riverMaiden: [
    ['starfall', 'gapRing'],
    ['starfall', 'swordRing', 'gapRing'],
    ['voidZone', 'starfall', 'gapRing', 'swordRing'],
  ],
}

/** How long a marked patch of ground waits before it detonates. */
const ZONE_TELL = 1.15

/**
 * Moves heavy enough to leave the boss winded afterwards, and for how long.
 *
 * Every one of these commits the boss to something it cannot cancel — a charge
 * it has to finish, a barrage it has to finish throwing. Being open afterwards
 * is what makes surviving them worth something.
 */
const WINDED_AFTER = {
  charge: 1.8, stomp: 1.5, sweep: 1.9, voidZone: 2.4, starfall: 1.6,
}

/** Damage multiplier inside the punish window. */
const WINDED_MULTIPLIER = 1.7

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
    // Ground marked by an attack, waiting to resolve.
    this.pending = []
    this._windedTell = 0
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

  _buildRiverMaiden(def) {
    const group = new THREE.Group()
    const body = new THREE.Mesh(
      buildBossGeometry('riverMaiden'),
      makeToonMaterial({ color: 0xffffff, rim: 0.3, rimColor: 0xdff2ff, vertexColors: true }),
    )
    body.scale.setScalar(def.scale)
    body.castShadow = true
    group.add(body)

    // One cold light where her face is. 창랑 gets two hot eyes low down; hers is
    // a single pale one held high, so the two read apart at a glance even in
    // silhouette.
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      makeAdditiveMaterial({ color: 0x9fe4ff, opacity: 0.8, map: glowTexture() }),
    )
    glow.position.set(0, 3.66 * def.scale, 0.38 * def.scale)
    group.add(glow)
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

  _buildJadeVoidWarden(def) {
    const group = new THREE.Group()
    const body = new THREE.Mesh(
      buildBossGeometry('jadeVoidWarden'),
      makeToonMaterial({ color: 0xffffff, rim: 0.28, rimColor: 0xb9fff0, vertexColors: true }),
    )
    body.scale.setScalar(def.scale)
    body.castShadow = true
    group.add(body)

    // The chest core and seal plates are separate so the phase change and the
    // orbit can communicate state without rebuilding the cached body geometry.
    this.wardenCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.33, 2),
      makeAdditiveMaterial({ color: 0x8cffe7, opacity: 0.92, map: glowTexture() }),
    )
    this.wardenCore.position.set(0, 3.48 * def.scale, 1.02 * def.scale)
    group.add(this.wardenCore)

    this.wardenCoreRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.035, 8, 32),
      makeAdditiveMaterial({ color: 0x52e6c0, opacity: 0.8 }),
    )
    this.wardenCoreRing.position.copy(this.wardenCore.position)
    this.wardenCoreRing.rotation.x = Math.PI / 2
    group.add(this.wardenCoreRing)

    const sealMaterial = makeToonMaterial({ color: 0x8bbeb2, rim: 0.32, rimColor: 0xd8fff2 })
    this.wardenSeals = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.30, 0.54, 0.08), sealMaterial, 5,
    )
    this.wardenSeals.castShadow = false
    this.wardenSeals.frustumCulled = false
    group.add(this.wardenSeals)
    return group
  }

  spawn(bossId, player, runTime) {
    const def = BOSSES[bossId]
    if (!def || this.active) return

    this.group = BOSS_BUILDERS[bossId].call(this, def)
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
      moveIndex: 0,
      windedT: 0,
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
    const { amount: rolled, crit } = rollDamage(rawDamage, stats, tag, this.rng)
    // Winded after a heavy move: the punish window. Without it the fight has no
    // rhythm — the player attacks continuously whatever the boss does, and a
    // boss becomes a wall of hit points rather than something with openings to
    // read and take.
    const amount = b.windedT > 0 ? rolled * WINDED_MULTIPLIER : rolled
    b.hp -= amount
    b.flash = 1
    if (this.onDamageText) this.onDamageText(b.x, 3.0, b.z, amount, crit || b.windedT > 0)

    // Phase transitions: stagger, shove the player back, shift the mask colour.
    const frac = b.hp / b.maxHp
    const wantPhase = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2
    if (wantPhase > b.phase) {
      b.phase = wantPhase
      b.staggerT = 1.2
      this.world.vfx.shockRing(b.x, b.z, 6)
      this.world.camera.addTrauma(0.7)
      if (this.onPhase) this.onPhase(wantPhase)
      if (this.mask) this.mask.material.color.setHex(wantPhase === 1 ? 0xff6ad0 : 0xff5a5a)
      if (this.wardenCore) {
        this.wardenCore.material.color.setHex(wantPhase === 1 ? 0x70f2d0 : 0xffb36b)
      }
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
    this.wardenCore = null
    this.wardenCoreRing = null
    this.wardenSeals = null
  }

  /**
   * Mark a patch of ground now, resolve it later.
   *
   * `safe: true` inverts it: the marked circle is the only place that is *not*
   * hit, so instead of stepping out of a puddle the player has to run into one.
   * That single inversion is what stops every boss AoE being the same dodge.
   */
  _zone(x, z, radius, damage, { delay = ZONE_TELL, safe = false } = {}) {
    this.pending.push({ x, z, radius, damage, t: delay, safe })
    if (safe) {
      // Drawn as a ring of marks around the rim, so it reads as a boundary to
      // get inside rather than as a puddle to avoid.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        this.world.vfx.telegraph(x + Math.cos(a) * radius, z + Math.sin(a) * radius, 1.3, delay)
      }
    } else {
      this.world.vfx.telegraph(x, z, radius, delay)
    }
  }

  _resolveZones(dt, player) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const zone = this.pending[i]
      zone.t -= dt
      if (zone.t > 0) continue
      this.pending.splice(i, 1)

      const inside = Math.hypot(player.x - zone.x, player.z - zone.z) <= zone.radius
      if (inside !== zone.safe) player.takeDamage(zone.damage)
      this.world.vfx.burst(zone.x, zone.z, zone.radius * (zone.safe ? 1.4 : 1))
      this.world.camera.addTrauma(zone.safe ? 0.5 : 0.25)
    }
  }

  _move(name, b, player) {
    switch (name) {
      case 'charge': {
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
        break
      }

      case 'howl': {
        this.world.vfx.shockRing(b.x, b.z, 5)
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          this.world.enemies.spawn('wolf', b.x + Math.cos(a) * 4, b.z + Math.sin(a) * 4, b.spawnedAt)
        }
        break
      }

      case 'stomp': {
        // Three impacts walking outward from the boss toward the player, so
        // standing still is punished and running through the gaps is not.
        const dx = player.x - b.x
        const dz = player.z - b.z
        const d = Math.hypot(dx, dz) || 1
        for (let i = 1; i <= 3; i++) {
          this._zone(
            b.x + (dx / d) * i * 5, b.z + (dz / d) * i * 5, 3.4, b.def.damage * 0.7,
            { delay: 0.7 + i * 0.34 },
          )
        }
        break
      }

      case 'sweep': {
        // An arc of impacts across the player's side of the arena.
        const base = Math.atan2(player.z - b.z, player.x - b.x)
        for (let i = 0; i < 7; i++) {
          const a = base + (i - 3) * 0.34
          this._zone(
            b.x + Math.cos(a) * 8, b.z + Math.sin(a) * 8, 3.0, b.def.damage * 0.6,
            { delay: 0.8 + i * 0.11 },
          )
        }
        break
      }

      case 'starfall': {
        // Rain, biased at where the player is standing but not homing.
        for (let i = 0; i < 7; i++) {
          const a = this.rng.angle()
          const r = this.rng.range(0, 9)
          this._zone(
            player.x + Math.cos(a) * r, player.z + Math.sin(a) * r, 2.6, b.def.damage * 0.55,
            { delay: 0.9 + i * 0.16 },
          )
        }
        break
      }

      case 'voidZone': {
        // 흑천멸계: everything outside the circle burns. Run in, not out.
        const a = this.rng.angle()
        this._zone(
          b.x + Math.cos(a) * 6, b.z + Math.sin(a) * 6, 4.6, b.def.damage * 1.5,
          { delay: 2.1, safe: true },
        )
        break
      }

      case 'jadePulse': {
        // The warden's signature move is a delayed pulse: the array flash says
        // "read the centre", while the telegraph ring gives a clean beat to
        // leave it before the jade shock resolves.
        const radius = 4.2 + b.phase * 0.65
        this.world.vfx.arrayFlash(b.x, b.z, radius)
        this.world.vfx.telegraph(b.x, b.z, radius, 1.15)
        this._zone(b.x, b.z, radius, b.def.damage * 0.75, { delay: 1.15 })
        break
      }

      case 'summon': {
        for (let i = 0; i < 3; i++) {
          const a = this.rng.angle()
          this.world.enemies.spawn('demonCultivator', b.x + Math.cos(a) * 5, b.z + Math.sin(a) * 5, b.spawnedAt)
        }
        break
      }

      case 'swordRing':
        this._lordAttack(b, player, 0)
        break

      case 'gapRing':
        this._lordAttack(b, player, 1)
        break

      default:
        break
    }
  }

  _lordAttack(b, player, kind) {
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
    }
  }

  update(dt, player, runTime) {
    // Marked ground resolves even while the boss is staggered or dying: an
    // attack already committed to has to land, or a phase change becomes a free
    // cancel of whatever was in the air.
    if (this.pending.length > 0) this._resolveZones(dt, player)

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
    } else if (b.windedT > 0) {
      // Rooted and open. It does not advance, does not attack, and the ring at
      // its feet says so — a window the player cannot see is not a window, and
      // the extra damage alone would just feel like inconsistent numbers.
      b.windedT -= dt
      this._windedTell -= dt
      if (this._windedTell <= 0) {
        this._windedTell = 0.28
        this.world.vfx.openingRing(b.x, b.z, b.def.radius * 1.5)
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
        const phases = BOSS_PATTERNS[b.def.id]
        const cycle = phases[Math.min(b.phase, phases.length - 1)]
        const name = cycle[b.moveIndex % cycle.length]
        this._move(name, b, player)
        b.moveIndex++
        // Heavy moves leave it open. Later phases recover faster, which is most
        // of what makes the last third of the fight feel like a different one.
        const winded = WINDED_AFTER[name]
        if (winded) b.windedT = winded * (1 - b.phase * 0.18)
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

    if (this.wardenSeals) {
      const t = performance.now() * 0.001
      const s = b.def.scale
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.72 + i * (Math.PI * 1.44 / 4) + t * 0.22
        _dummy.position.set(
          Math.cos(a) * 1.38 * s,
          (4.52 + Math.sin(a) * 1.38) * s,
          -0.62 * s,
        )
        _dummy.rotation.set(0.08, 0, a + Math.PI / 2)
        _dummy.scale.setScalar(1 + Math.sin(t * 2.4 + i) * 0.05)
        _dummy.updateMatrix()
        this.wardenSeals.setMatrixAt(i, _dummy.matrix)
      }
      this.wardenSeals.instanceMatrix.needsUpdate = true
    }
    if (this.wardenCore) {
      const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.08
      this.wardenCore.scale.setScalar(pulse)
      this.wardenCore.rotation.y += 0.012
      if (this.wardenCoreRing) this.wardenCoreRing.rotation.z += 0.018
    }
  }

  _clearZones() {
    this.pending.length = 0
  }

  clear() {
    this._clearZones()
    this._despawn()
    this.warned.clear()
  }
}
