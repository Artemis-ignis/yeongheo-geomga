import { computeStats, applyMaxHpChange } from '../combat/Stats.js'
import { mitigate, rollDamage } from '../combat/damage.js'
import { getWeapon } from '../data/weapons.js'
import { BOSSES as BOSS_DEFS } from '../data/bosses.js'
import { ENEMIES, getEnemy, scaledDamage, scaledHp, scaledXp } from '../data/enemies.js'
import { rosterFor } from '../data/stages.js'
import { waveAt, scheduleFor } from '../data/waves.js'
import { applyTrial, TRIAL } from '../data/trials.js'
import { xpFor } from '../data/realms.js'
import { SpatialHash } from '../core/SpatialHash.js'
import { ENEMY_ARCHETYPE_IDS_2D, classifyEnemyArchetype2D } from './EnemyArchetypes2D.js'
import { getWeaponBehavior2D } from './WeaponBehaviors2D.js'
import { applyDaoCombatModifiers2D } from './DaoVows2D.js'
import { nextBossPatternEvent2D } from './BossPatterns2D.js'
import {
  CONTEST_PACING_DURATION_SECONDS,
  CONTEST_PACING_MILESTONE_2D,
  ContestPacing2D,
} from './ContestPacing2D.js'
import { FormationDirector2D } from './FormationDirector2D.js'
import { DAO_COMBAT_ACTION_2D, DaoCombatRuntime2D } from './DaoCombatRuntime2D.js'

export const MAX_ENEMIES_2D = 900
export const MAX_PROJECTILES_2D = 1200
// A seven-minute run can leave several thousand XP/stone drops on the floor
// when the player is kiting.  Keep this a fixed, renderer-sized pool, then
// compact only when it is genuinely saturated.
export const MAX_PICKUPS_2D = 4096
export const MAX_EFFECTS_2D = 256
export const MAX_WEAPON_FIELDS_2D = 128
export const RUN_SECONDS_2D = CONTEST_PACING_DURATION_SECONDS

const SPAWN_MIN = 20
const SPAWN_MAX = 25
const DESPAWN_RADIUS = 39
const CONTACT_COOLDOWN = 0.72
const DASH_DISTANCE = 6
const DASH_COOLDOWN = 3
const DASH_IFRAMES = 0.35
// Survivor combat gets unreadable when a dense formation can apply contact
// damage from several overlapping cut-outs in the same half second. Keep the
// threat, but give the player enough post-hit separation time to read and dash.
const MERCY_IFRAMES = 0.68
const BOSS_DEFEAT_HEAL_FRACTION_2D = 0.3
const BOSS_DEFEAT_GRACE_SECONDS_2D = 2.4
const BOSS_DEFEAT_SHOCKWAVE_RADIUS_2D = 10
const BOSS_WAVE_DENSITY_2D = 0.35
// The final ninety seconds are the authored Jade Void Warden duel. At the old
// 0.35 multiplier the 330-second wave still added roughly five actors every
// second; by phase two, more than two hundred bodies and the 365-second ring
// formation obscured the tells and killed an ordinary keyboard route before
// the second phase gate. Keep enough adds to feed the survivor fantasy while
// making the mirrored boss patterns the encounter's readable threat.
export const FINAL_BOSS_WAVE_DENSITY_2D = 0.12
// The contest run is seven minutes. The final boss enters at 5:30 and owns the
// last ninety seconds instead of evaporating in a late-game damage stack at
// 6:04. Each floor guarantees a readable authored phase; the final five
// seconds after a successful kill are a protected victory lap before 7:00.
export const FINAL_BOSS_PHASE_GATE_SECONDS_2D = Object.freeze([25, 55, 85])
// Each authored phase change is also a readable breath in the duel. A real
// keyboard playtest using the normal 3.05s dash cadence reached 6:31 with a
// complete Dao, then lost to accumulated chip damage seven seconds before the
// last phase could be killed. A small visible heal, hostile-bullet clear and
// brief grace window reward reaching the next phase without removing its
// threat or granting a hidden revive.
export const FINAL_BOSS_PHASE_RELIEF_HEAL_FRACTION_2D = 0.18
export const FINAL_BOSS_PHASE_RELIEF_GRACE_SECONDS_2D = 1.15
const PICKUP_MERGE_RADIUS_2D = 1.35
const PICKUP_RECYCLE_DISTANCE_2D = 18
const WEAPON_AUDIO_COOLDOWN_2D = Object.freeze({
  launch: 0,
  impact: 0.08,
  field: 0.75,
  status: 0.85,
})
const _query = new Int32Array(MAX_ENEMIES_2D)
const _chainQuery = new Int32Array(MAX_ENEMIES_2D)
const _pullQuery = new Int32Array(MAX_ENEMIES_2D)
const ARCHETYPE_INDEX_2D = new Map(ENEMY_ARCHETYPE_IDS_2D.map((id, index) => [id, index]))

const EFFECT_KIND = Object.freeze({ hit: 1, ring: 2, dash: 3, lightning: 4, death: 5 })
const PROJECTILE_KIND = Object.freeze({ sword: 1, fire: 2, ice: 3, thunder: 4, hostile: 5, needle: 6, wind: 7 })

const DAO_ACTION_COLORS_2D = Object.freeze({
  sword: 0xeaf6ff,
  frost: 0x9ee8ff,
  spirit: 0xc88cff,
})

const DAO_FROST_FIELD_BEHAVIOR_2D = Object.freeze({
  id: 'dao-frost-field',
  weaponId: 'dao-frost-field',
  daoAction: true,
  tag: 'ice',
  trajectory: { cooldownSeconds: 0.48, lifetimeSeconds: 1.8 },
  collision: { radiusScale: 1, damage: 8, pierce: 999 },
  residualField: { enabled: true, tickSeconds: 0.48, lifetimeSeconds: 1.8, radiusScale: 1 },
  statusEffects: {
    slow: { enabled: true, value: 0.68, durationSeconds: 1.8 },
    freeze: { enabled: true, durationSeconds: 0.32 },
  },
  audio: { kind: 'frost', tag: 'ice' },
})

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

const BOSS_PATTERN_TAU_2D = Math.PI * 2
const BOSS_PLAYER_RADIUS_2D = 0.55

function bossPatternAngle2D(event) {
  const value = Number(event?.castAngle ?? event?.geometry?.angle)
  return Number.isFinite(value) ? value : 0
}

function bossPatternOrigin2D(event, fallbackX = 0, fallbackZ = 0) {
  const geometry = event?.geometry ?? {}
  const origin = geometry.origin ?? {}
  const rawX = Number(event?.castOriginX ?? event?.originX)
  const rawZ = Number(event?.castOriginZ ?? event?.originZ)
  const x = Number.isFinite(rawX) ? rawX : fallbackX
  const z = Number.isFinite(rawZ) ? rawZ : fallbackZ
  return {
    x: x + (Number(origin.x) || 0),
    z: z + (Number(origin.z) || 0),
  }
}

function bossPatternZoneCenter2D(event) {
  const geometry = event?.geometry ?? {}
  const center = geometry.center ?? {}
  const x = Number(event?.castTargetX ?? event?.targetX ?? 0)
  const z = Number(event?.castTargetZ ?? event?.targetZ ?? 0)
  return {
    x: (Number.isFinite(x) ? x : 0) + (Number(center.x) || 0),
    z: (Number.isFinite(z) ? z : 0) + (Number(center.z) || 0),
  }
}

function bossZoneInstances2D(event) {
  if (Array.isArray(event?.zoneInstances)) return event.zoneInstances
  const geometry = event?.geometry ?? {}
  const shape = geometry.shape ?? 'circle'
  const center = bossPatternZoneCenter2D(event)
  const angle = bossPatternAngle2D(event)
  const radius = Math.max(0.1, Number(geometry.radius) || 2.15)
  const width = Math.max(0.1, Number(geometry.width) || 1.6)
  const length = Math.max(0.1, Number(geometry.length) || 11.5)
  const count = Math.max(1, Math.min(8, Math.trunc(Number(geometry.count) || 1)))

  if (shape === 'cluster') {
    const instances = []
    const spacing = Math.max(1.1, radius * 1.65)
    for (let index = 0; index < count; index++) {
      const instanceAngle = angle + BOSS_PATTERN_TAU_2D * index / count
      instances.push({
        shape: 'circle',
        x: center.x + Math.cos(instanceAngle) * spacing,
        z: center.z + Math.sin(instanceAngle) * spacing,
        radius,
      })
    }
    return instances
  }

  if (shape === 'wall') {
    // A wall's authored count is the number of contiguous shards.  Keeping
    // each shard as a rectangle preserves both placement and collision while
    // avoiding a renderer-specific wall representation.
    const directionX = Math.cos(angle)
    const directionZ = Math.sin(angle)
    const shardLength = length / count
    return Array.from({ length: count }, (_, index) => {
      const offset = -length * 0.5 + shardLength * (index + 0.5)
      return {
        shape: 'rect',
        x: center.x + directionX * offset,
        z: center.z + directionZ * offset,
        angle,
        length: shardLength,
        width,
      }
    })
  }

  if (shape === 'lane') {
    return [{ shape: 'rect', x: center.x, z: center.z, angle, length, width }]
  }

  return [{ shape: 'circle', x: center.x, z: center.z, radius }]
}

function bossPointInsideZoneInstance2D(x, z, instance) {
  const dx = x - instance.x
  const dz = z - instance.z
  if (instance.shape === 'circle') {
    return dx * dx + dz * dz <= (instance.radius + BOSS_PLAYER_RADIUS_2D) ** 2
  }
  const directionX = Math.cos(instance.angle)
  const directionZ = Math.sin(instance.angle)
  const along = dx * directionX + dz * directionZ
  const across = -dx * directionZ + dz * directionX
  return Math.abs(along) <= instance.length * 0.5 + BOSS_PLAYER_RADIUS_2D
    && Math.abs(across) <= instance.width * 0.5 + BOSS_PLAYER_RADIUS_2D
}

function bossPointInsideZone2D(event, x, z) {
  return bossZoneInstances2D(event).some((instance) => bossPointInsideZoneInstance2D(x, z, instance))
}

function bossPointInsideLine2D(event, x, z) {
  const geometry = event?.geometry ?? {}
  const origin = bossPatternOrigin2D(event)
  const angle = bossPatternAngle2D(event)
  const directionX = Math.cos(angle)
  const directionZ = Math.sin(angle)
  const dx = x - origin.x
  const dz = z - origin.z
  const along = dx * directionX + dz * directionZ
  const across = -dx * directionZ + dz * directionX
  const length = Math.max(0.1, Number(geometry.length) || 13)
  const width = Math.max(0.1, Number(geometry.width) || 1.05)
  return along >= -BOSS_PLAYER_RADIUS_2D
    && along <= length + BOSS_PLAYER_RADIUS_2D
    && Math.abs(across) <= width * 0.5 + BOSS_PLAYER_RADIUS_2D
}

function angleDistance2D(left, right) {
  const delta = ((left - right + Math.PI) % BOSS_PATTERN_TAU_2D + BOSS_PATTERN_TAU_2D) % BOSS_PATTERN_TAU_2D - Math.PI
  return Math.abs(delta)
}

function bossPointInsideCone2D(event, x, z) {
  const geometry = event?.geometry ?? {}
  const origin = bossPatternOrigin2D(event)
  const dx = x - origin.x
  const dz = z - origin.z
  const distance = Math.hypot(dx, dz)
  const length = Math.max(0.1, Number(geometry.length) || 11.5)
  const innerRadius = Math.max(0, Number(geometry.innerRadius) || 0)
  if (distance < Math.max(0, innerRadius - BOSS_PLAYER_RADIUS_2D)
    || distance > length + BOSS_PLAYER_RADIUS_2D) return false
  const arc = Math.max(0.1, Number(geometry.arcRadians) || 0.8)
  return angleDistance2D(Math.atan2(dz, dx), bossPatternAngle2D(event)) <= arc * 0.5
    + Math.asin(Math.min(1, BOSS_PLAYER_RADIUS_2D / Math.max(distance, BOSS_PLAYER_RADIUS_2D)))
}

function bossTelegraphRadius2D(event, phase = 0) {
  const geometry = event?.geometry ?? {}
  if (event?.patternType === 'zone') {
    if (geometry.shape === 'lane' || geometry.shape === 'wall') {
      return Math.max(1.2, (Number(geometry.length) || 11.5) * 0.5)
    }
    return Math.max(1.2, Number(geometry.radius) || 2.4)
  }
  if (event?.patternType === 'line' || event?.patternType === 'cone') {
    return Math.max(3.8, (Number(geometry.length) || 11.5) * 0.5)
  }
  return 4 + phase
}

/**
 * The first minute teaches movement and dash before full contact damage lands.
 * Density and enemy reads stay intact, but a new player no longer loses half a
 * health bar while reading the first level-up card. Smoothstep avoids a damage
 * cliff at the end of the tutorial minute.
 */
export function openingIncomingDamageScale2D(runTime) {
  const t = clamp((Number(runTime) || 0) / 60, 0, 1)
  const eased = t * t * (3 - 2 * t)
  return 0.38 + 0.62 * eased
}

export function openingMercyIFrames2D(runTime) {
  const t = clamp((Number(runTime) || 0) / 60, 0, 1)
  const eased = t * t * (3 - 2 * t)
  return 1.02 - 0.34 * eased
}

function copyAt(fields, from, to) {
  for (const field of fields) field[to] = field[from]
}

function colorForTag(tag) {
  if (tag === 'fire') return 0xff7a43
  if (tag === 'thunder') return 0xb98cff
  if (tag === 'ice') return 0x8edcff
  if (tag === 'array') return 0x72e0af
  return 0xd8efff
}

class PlayerState2D {
  constructor(character, metaMods, reviveCharges, effects) {
    this.character = character
    this.metaMods = metaMods
    this.reviveCharges = reviveCharges
    this.effects = effects
    this.x = 0
    this.z = 0
    this.prevX = 0
    this.prevZ = 0
    this.facing = 0
    this.alive = true
    this.invulnTimer = 0
    this.dashCooldown = 0
    this.hitFlash = 0
    this.attackTimer = 0
    this.actualSpeed = 0
    this.dashing = 0
    this.teleported = false
    this.level = 1
    this.xp = 0
    this.stones = 0
    this.kills = 0
    this.loadout = { weapons: {}, passives: {} }
    this.daoModifiers = null
    this.daoRuntimeBoost = null
    if (character.startWeapon) this.loadout.weapons[character.startWeapon] = 1
    this.stats = computeStats(character, this.loadout.passives, this.metaMods)
    this.maxHp = this.stats.maxHp
    this.hp = this.maxHp
    this.onHurt = null
    this.onHeal = null
  }

  get xpNeeded() { return xpFor(this.level) }
  get speed01() { return Math.min(1, this.actualSpeed / Math.max(0.001, this.stats.moveSpeed)) }

  recomputeStats() {
    const oldMax = this.maxHp
    const baseStats = computeStats(this.character, this.loadout.passives, this.metaMods)
    const applied = applyDaoCombatModifiers2D(baseStats, this.daoModifiers)
    const boost = this.daoRuntimeBoost
    if (boost?.active) {
      this.stats = {
        ...applied,
        cooldown: applied.cooldown * (boost.cooldownMultiplier ?? 1),
        magnet: applied.magnet * (boost.magnetMultiplier ?? 1),
      }
    } else {
      this.stats = applied
    }
    this.maxHp = this.stats.maxHp
    this.hp = Math.min(this.maxHp, applyMaxHpChange(this.hp, oldMax, this.maxHp))
  }

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

  heal(amount, source = null) {
    const before = this.hp
    this.hp = Math.min(this.maxHp, this.hp + Math.max(0, Number(amount) || 0))
    const restored = Math.max(0, this.hp - before)
    // Passive regeneration deliberately stays silent. Explicit sources opt in
    // so their cause is readable without creating a continuous audio loop.
    if (restored > 0 && source) this.onHeal?.(restored, source)
    return restored
  }

  takeDamage(rawAmount, mercyIFrames = MERCY_IFRAMES) {
    if (!this.alive || this.invulnTimer > 0) return false
    const dealt = mitigate(rawAmount, this.stats.armor)
    this.hp -= dealt
    this.invulnTimer = Math.max(MERCY_IFRAMES, mercyIFrames)
    this.hitFlash = 0.12
    this.onHurt?.(dealt)
    if (this.hp <= 0) {
      if (this.reviveCharges > 0) {
        this.reviveCharges--
        this.hp = this.maxHp * 0.5
        this.invulnTimer = 2
      } else {
        this.hp = 0
        this.alive = false
      }
    }
    return true
  }

  update(dt, input) {
    if (!this.alive) return
    this.prevX = this.x
    this.prevZ = this.z
    this.teleported = false
    this.invulnTimer = Math.max(0, this.invulnTimer - dt)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    this.hitFlash = Math.max(0, this.hitFlash - dt)
    this.attackTimer = Math.max(0, this.attackTimer - dt)
    this.dashing = Math.max(0, this.dashing - dt)

    const mx = input.moveX
    const mz = input.moveZ
    if (mx !== 0 || mz !== 0) this.facing = Math.atan2(mx, mz)
    this.x += mx * this.stats.moveSpeed * dt
    this.z += mz * this.stats.moveSpeed * dt

    if (input.consumeDash() && this.dashCooldown <= 0) {
      const fromX = this.x
      const fromZ = this.z
      const dao = this.daoModifiers ?? {}
      const dashDistance = DASH_DISTANCE * (dao.dashDistanceMultiplier ?? 1)
      this.x += Math.sin(this.facing) * dashDistance
      this.z += Math.cos(this.facing) * dashDistance
      this.effects.spawn(EFFECT_KIND.dash, fromX, fromZ, 0.34, 6, 0xb9eaff)
      this.invulnTimer = Math.max(this.invulnTimer, DASH_IFRAMES + (dao.dashIFramesAdd ?? 0))
      this.dashCooldown = DASH_COOLDOWN * (dao.dashCooldownMultiplier ?? 1)
      this.dashing = 0.16
      this.teleported = true
      this.onDash?.({ fromX, fromZ, toX: this.x, toZ: this.z })
    }

    this.actualSpeed = Math.hypot(this.x - this.prevX, this.z - this.prevZ) / Math.max(dt, 0.0001)
    if (this.stats.regen > 0) this.heal(this.stats.regen * dt)
  }
}

class EffectField2D {
  constructor() {
    this.count = 0
    this.kind = new Uint8Array(MAX_EFFECTS_2D)
    this.x = new Float32Array(MAX_EFFECTS_2D)
    this.z = new Float32Array(MAX_EFFECTS_2D)
    this.life = new Float32Array(MAX_EFFECTS_2D)
    this.maxLife = new Float32Array(MAX_EFFECTS_2D)
    this.radius = new Float32Array(MAX_EFFECTS_2D)
    this.color = new Uint32Array(MAX_EFFECTS_2D)
    this._fields = [this.kind, this.x, this.z, this.life, this.maxLife, this.radius, this.color]
  }

  spawn(kind, x, z, life = 0.28, radius = 1, color = 0xffffff) {
    if (this.count >= MAX_EFFECTS_2D) return
    const i = this.count++
    this.kind[i] = kind
    this.x[i] = x
    this.z[i] = z
    this.life[i] = life
    this.maxLife[i] = life
    this.radius[i] = radius
    this.color[i] = color
  }

  update(dt) {
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt
      if (this.life[i] > 0) continue
      const last = --this.count
      if (i !== last) copyAt(this._fields, last, i)
    }
  }
}

/**
 * Collision-bearing persistent weapon zones.  Presentation effects are kept
 * in EffectField2D; this pool is the small simulation counterpart consumed by
 * baguaArray, venomMist, infernoSea, plagueTide and voidOrb.  All storage is
 * fixed at construction so a dense 2D run never allocates one object per tick.
 */
class WeaponField2D {
  constructor(world) {
    this.world = world
    this.count = 0
    this.x = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.z = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.radius = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.life = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.maxLife = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.tick = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.damage = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.kind = new Uint8Array(MAX_WEAPON_FIELDS_2D)
    this.color = new Uint32Array(MAX_WEAPON_FIELDS_2D)
    this.audioSourceId = new Uint32Array(MAX_WEAPON_FIELDS_2D)
    this.daoFieldId = new Uint32Array(MAX_WEAPON_FIELDS_2D)
    this.segment = new Uint8Array(MAX_WEAPON_FIELDS_2D)
    this.fromX = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.fromZ = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.toX = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.toZ = new Float32Array(MAX_WEAPON_FIELDS_2D)
    this.nextAudioSourceId = 1
    this.lastSpawnAudioSourceId = 0
    this.tag = new Array(MAX_WEAPON_FIELDS_2D).fill('array')
    this.behavior = new Array(MAX_WEAPON_FIELDS_2D).fill(null)
    this._fields = [this.x, this.z, this.radius, this.life, this.maxLife, this.tick,
      this.damage, this.kind, this.color, this.audioSourceId, this.daoFieldId, this.segment,
      this.fromX, this.fromZ, this.toX, this.toZ, this.behavior]
    this.dropped = 0
  }

  spawn({ behavior, x, z, radius = 2, life = 2, damage = 1, tag = 'array',
    kind = 1, color = 0x72e0af, daoFieldId = 0, segment = null }) {
    if (this.count >= MAX_WEAPON_FIELDS_2D) { this.dropped++; return false }
    const i = this.count++
    const descriptor = behavior ?? null
    const residual = descriptor?.residualField
    const cooldown = descriptor?.trajectory?.cooldownSeconds ?? 0.5
    this.x[i] = x
    this.z[i] = z
    this.radius[i] = Math.max(0.1, radius)
    this.life[i] = this.maxLife[i] = Math.max(0.05, life)
    this.tick[i] = Math.max(0.05, Math.min(2, cooldown))
    this.damage[i] = Math.max(0, damage)
    this.kind[i] = kind
    this.color[i] = color
    this.audioSourceId[i] = this.nextAudioSourceId++
    this.daoFieldId[i] = Math.max(0, Math.trunc(daoFieldId || 0))
    this.segment[i] = segment ? 1 : 0
    this.fromX[i] = segment?.fromX ?? x
    this.fromZ[i] = segment?.fromZ ?? z
    this.toX[i] = segment?.toX ?? x
    this.toZ[i] = segment?.toZ ?? z
    this.lastSpawnAudioSourceId = this.audioSourceId[i]
    this.tag[i] = tag
    this.behavior[i] = descriptor
    // An explicit persistent-field descriptor is part of the field identity;
    // retaining it in the pool lets every tick consume its status contract.
    if (residual?.tickSeconds > 0) this.tick[i] = residual.tickSeconds
    return true
  }

  _remove(i) {
    const last = --this.count
    if (i === last) return
    copyAt(this._fields, last, i)
    this.tag[i] = this.tag[last]
  }

  update(dt) {
    const enemies = this.world.enemies
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt
      this.tick[i] -= dt
      const behavior = this.behavior[i]
      const effects = behavior?.statusEffects
      if (this.tick[i] <= 0.00001) {
        this.tick[i] += Math.max(0.05, behavior?.residualField?.tickSeconds ?? 0.5)
        this.world._emitWeaponAudio('field', behavior, `field:${this.audioSourceId[i]}`)
        const sourceId = `field:${this.audioSourceId[i]}`
        if (this.segment[i]) {
          enemies.damageSegmentAt(
            this.fromX[i], this.fromZ[i], this.toX[i], this.toZ[i], this.radius[i],
            this.damage[i], this.tag[i], behavior, sourceId,
          )
        } else {
          enemies.damageAt(
            this.x[i], this.z[i], this.radius[i], this.damage[i], this.tag[i], behavior,
            sourceId,
          )
        }
        if (effects?.pull?.enabled) {
          enemies.pullAt(this.x[i], this.z[i], this.radius[i], effects.pull.strength ?? 2, dt)
        }
        this.world.effects.spawn(
          EFFECT_KIND.ring, this.x[i], this.z[i], 0.2, this.radius[i], this.color[i],
        )
      }
      if (this.life[i] <= 0) this._remove(i)
    }
  }
}

class PickupField2D {
  constructor(world) {
    this.world = world
    this.count = 0
    this.x = new Float32Array(MAX_PICKUPS_2D)
    this.z = new Float32Array(MAX_PICKUPS_2D)
    this.prevX = new Float32Array(MAX_PICKUPS_2D)
    this.prevZ = new Float32Array(MAX_PICKUPS_2D)
    this.value = new Float32Array(MAX_PICKUPS_2D)
    // Keep both ledgers per slot so the final saturated-slot fallback can
    // preserve XP and stones even when the only recyclable slot is the other
    // type.  Normal slots contain exactly one non-zero ledger.
    this.xpValue = new Float32Array(MAX_PICKUPS_2D)
    this.stoneValue = new Float32Array(MAX_PICKUPS_2D)
    this.stone = new Uint8Array(MAX_PICKUPS_2D)
    this.uid = new Uint32Array(MAX_PICKUPS_2D)
    this.phase = new Float32Array(MAX_PICKUPS_2D)
    this.age = new Float32Array(MAX_PICKUPS_2D)
    this._fields = [this.x, this.z, this.prevX, this.prevZ, this.value,
      this.xpValue, this.stoneValue, this.stone, this.uid, this.phase, this.age]
    this.dropped = 0
    this.spawnedXp = 0
    this.spawnedStones = 0
    this.collectedXp = 0
    this.collectedStones = 0
    this.nextUid = 1
  }

  spawn(x, z, value, stone = false) {
    const sourceValue = Number.isFinite(value) ? Math.max(0, value) : 0
    const amount = stone ? sourceValue * (this.world?.stage?.stoneScale ?? 1) : sourceValue
    const incomingStone = stone ? amount : 0
    const incomingXp = stone ? 0 : amount
    this.spawnedStones += incomingStone
    this.spawnedXp += incomingXp

    // Merge nearby drops first.  The first minimum-distance slot wins ties,
    // which keeps replay output independent of object allocation or map order.
    const nearby = this._findNearbyType(x, z, stone)
    if (nearby >= 0) {
      this._addValue(nearby, incomingXp, incomingStone, x, z)
      return true
    }

    if (this.count < MAX_PICKUPS_2D) {
      const i = this.count++
      this._writeNew(i, x, z, incomingXp, incomingStone)
      return true
    }

    // A full pool still has no loss path.  Prefer a distant, same-type stack;
    // among candidates choose the oldest, then the farthest, then the lowest
    // index.  If the pool contains only the other type, retain both ledgers in
    // a deterministic fallback slot rather than lying about a dropped value.
    const recycled = this._findRecycleIndex(x, z, stone)
      ?? this._findRecycleIndex(x, z, null)
    if (recycled != null && recycled >= 0) {
      this._addValue(recycled, incomingXp, incomingStone, x, z)
      return true
    }

    // This is unreachable for a valid fixed-size pool, but preserving the
    // contract is safer than incrementing `dropped` for a malformed state.
    return false
  }

  _writeNew(i, x, z, xpValue, stoneValue) {
    this.x[i] = this.prevX[i] = x
    this.z[i] = this.prevZ[i] = z
    this.xpValue[i] = xpValue
    this.stoneValue[i] = stoneValue
    this.value[i] = xpValue + stoneValue
    this.stone[i] = stoneValue > 0 && xpValue <= 0 ? 1 : 0
    this.uid[i] = this.nextUid++
    this.phase[i] = this._phaseFor(x, z)
    this.age[i] = 0
  }

  _phaseFor(x, z) {
    const angle = (x * 1.37 + z * 0.73) % (Math.PI * 2)
    return angle < 0 ? angle + Math.PI * 2 : angle
  }

  _hasType(i, stone) {
    return stone == null
      ? this.xpValue[i] > 0 || this.stoneValue[i] > 0
      : stone ? this.stoneValue[i] > 0 : this.xpValue[i] > 0
  }

  _findNearbyType(x, z, stone) {
    const radiusSquared = PICKUP_MERGE_RADIUS_2D * PICKUP_MERGE_RADIUS_2D
    let best = -1
    let bestDistance = Infinity
    for (let i = 0; i < this.count; i++) {
      if (!this._hasType(i, stone)) continue
      const dx = this.x[i] - x
      const dz = this.z[i] - z
      const distance = dx * dx + dz * dz
      if (distance > radiusSquared) continue
      if (distance < bestDistance - 1e-6
        || Math.abs(distance - bestDistance) <= 1e-6 && (best < 0 || i < best)) {
        best = i
        bestDistance = distance
      }
    }
    return best
  }

  _findRecycleIndex(x, z, stone) {
    let best = -1
    let bestRemote = false
    let bestAge = -Infinity
    let bestDistance = -Infinity
    const remoteDistanceSquared = PICKUP_RECYCLE_DISTANCE_2D * PICKUP_RECYCLE_DISTANCE_2D
    for (let i = 0; i < this.count; i++) {
      if (!this._hasType(i, stone)) continue
      const dx = this.x[i] - x
      const dz = this.z[i] - z
      const distance = dx * dx + dz * dz
      const remote = distance >= remoteDistanceSquared
      if (best < 0
        || remote && !bestRemote
        || remote === bestRemote && (this.age[i] > bestAge + 1e-6
          || Math.abs(this.age[i] - bestAge) <= 1e-6 && (distance > bestDistance + 1e-6
            || Math.abs(distance - bestDistance) <= 1e-6 && i < best))) {
        best = i
        bestRemote = remote
        bestAge = this.age[i]
        bestDistance = distance
      }
    }
    return best >= 0 ? best : null
  }

  _addValue(i, xpValue, stoneValue, x, z) {
    this.xpValue[i] += xpValue
    this.stoneValue[i] += stoneValue
    this.value[i] = this.xpValue[i] + this.stoneValue[i]
    // A mixed slot is rendered as a stone stack, but collection consumes both
    // ledgers below, so neither economy can be erased by visual compaction.
    this.stone[i] = this.stoneValue[i] > 0 && this.xpValue[i] <= 0 ? 1 : 0
    this.x[i] = this.prevX[i] = x
    this.z[i] = this.prevZ[i] = z
    this.phase[i] = this._phaseFor(x, z)
    this.age[i] = 0
  }

  update(dt, player, onLevels, onCollect) {
    const magnet = Math.max(2, player.stats.magnet)
    let pendingLevels = 0
    for (let i = this.count - 1; i >= 0; i--) {
      this.age[i] += Math.max(0, dt)
      this.prevX[i] = this.x[i]
      this.prevZ[i] = this.z[i]
      const dx = player.x - this.x[i]
      const dz = player.z - this.z[i]
      const dist = Math.hypot(dx, dz)
      if (dist < magnet) {
        const pull = 5 + (1 - dist / magnet) * 22
        this.x[i] += (dx / Math.max(0.001, dist)) * pull * dt
        this.z[i] += (dz / Math.max(0.001, dist)) * pull * dt
      }
      if (dist > 0.72) continue
      const xpValue = this.xpValue[i]
      const stoneValue = this.stoneValue[i]
      const collected = {
        id: this.uid[i], x: this.x[i], z: this.z[i],
        xp: xpValue, stone: stoneValue,
        value: xpValue + stoneValue,
      }
      if (xpValue > 0) {
        this.collectedXp += xpValue
        const levels = player.addXp(xpValue * player.stats.growth)
        // Do not re-enter this compaction loop from a level-up callback. The
        // production breakthrough can flush enemy deaths, which appends new
        // pickups while this loop still owns `count` and its swap-remove
        // cursor. Dispatch once, after every pickup in this frame is removed.
        if (levels > 0) pendingLevels += levels
      }
      if (stoneValue > 0) {
        this.collectedStones += stoneValue
        player.stones += stoneValue
      }
      onCollect?.(collected)
      const last = --this.count
      if (i !== last) copyAt(this._fields, last, i)
    }
    if (pendingLevels > 0) onLevels?.(pendingLevels)
  }
}

class ProjectileField2D {
  constructor(world) {
    this.world = world
    this.count = 0
    this.kind = new Uint8Array(MAX_PROJECTILES_2D)
    this.x = new Float32Array(MAX_PROJECTILES_2D)
    this.z = new Float32Array(MAX_PROJECTILES_2D)
    this.prevX = new Float32Array(MAX_PROJECTILES_2D)
    this.prevZ = new Float32Array(MAX_PROJECTILES_2D)
    this.dx = new Float32Array(MAX_PROJECTILES_2D)
    this.dz = new Float32Array(MAX_PROJECTILES_2D)
    this.speed = new Float32Array(MAX_PROJECTILES_2D)
    this.life = new Float32Array(MAX_PROJECTILES_2D)
    this.damage = new Float32Array(MAX_PROJECTILES_2D)
    this.radius = new Float32Array(MAX_PROJECTILES_2D)
    this.pierce = new Int16Array(MAX_PROJECTILES_2D)
    this.hostile = new Uint8Array(MAX_PROJECTILES_2D)
    this.bossSeeking = new Uint8Array(MAX_PROJECTILES_2D)
    this.color = new Uint32Array(MAX_PROJECTILES_2D)
    this.tag = new Array(MAX_PROJECTILES_2D).fill('sword')
    this.lastUid = new Uint32Array(MAX_PROJECTILES_2D)
    this.age = new Float32Array(MAX_PROJECTILES_2D)
    this.returnAt = new Float32Array(MAX_PROJECTILES_2D)
    this.returnPhase = new Uint8Array(MAX_PROJECTILES_2D)
    this.orbit = new Uint8Array(MAX_PROJECTILES_2D)
    this.orbitAngle = new Float32Array(MAX_PROJECTILES_2D)
    this.orbitRadius = new Float32Array(MAX_PROJECTILES_2D)
    this.orbitSpeed = new Float32Array(MAX_PROJECTILES_2D)
    this.audioSourceId = new Uint32Array(MAX_PROJECTILES_2D)
    this.nextAudioSourceId = 1
    this.behaviorDescriptor = new Array(MAX_PROJECTILES_2D).fill(null)
    this._fields = [this.kind, this.x, this.z, this.prevX, this.prevZ, this.dx, this.dz,
      this.speed, this.life, this.damage, this.radius, this.pierce, this.hostile, this.bossSeeking,
      this.color, this.lastUid,
      this.age, this.returnAt, this.returnPhase, this.orbit, this.orbitAngle, this.orbitRadius,
      this.orbitSpeed, this.audioSourceId, this.behaviorDescriptor]
    this.dropped = 0
  }

  spawn({ kind = PROJECTILE_KIND.sword, x, z, dx, dz, speed = 16, life = 2.2,
    damage = 10, radius = 0.45, pierce = 1, hostile = false, color = 0xd8efff, tag = 'sword',
    behavior = null, returning = false, orbit = false, orbitAngle = 0, orbitRadius = 0,
    orbitSpeed = 0, returnDelay = null }) {
    if (this.count >= MAX_PROJECTILES_2D) { this.dropped++; return }
    const length = Math.hypot(dx, dz) || 1
    const i = this.count++
    this.kind[i] = kind
    this.x[i] = this.prevX[i] = x
    this.z[i] = this.prevZ[i] = z
    this.dx[i] = dx / length
    this.dz[i] = dz / length
    this.speed[i] = speed
    this.life[i] = life
    this.damage[i] = damage
    this.radius[i] = radius
    this.pierce[i] = pierce
    this.hostile[i] = hostile ? 1 : 0
    this.bossSeeking[i] = !hostile && this.world.boss?.active ? 1 : 0
    this.color[i] = color
    this.tag[i] = tag
    this.lastUid[i] = 0
    this.age[i] = 0
    const authoredReturnDelay = Number.isFinite(returnDelay) && returnDelay > 0
      ? Math.min(Math.max(0.08, life - 1e-6), returnDelay)
      : Math.max(0.08, life * 0.5)
    this.returnAt[i] = returning ? authoredReturnDelay : 0
    this.returnPhase[i] = 0
    this.orbit[i] = orbit ? 1 : 0
    this.orbitAngle[i] = orbitAngle
    this.orbitRadius[i] = Math.max(0, orbitRadius)
    this.orbitSpeed[i] = orbitSpeed
    this.audioSourceId[i] = this.nextAudioSourceId++
    this.behaviorDescriptor[i] = behavior
  }

  _remove(i) {
    const last = --this.count
    if (i === last) return
    copyAt(this._fields, last, i)
    this.tag[i] = this.tag[last]
  }

  clearHostile() {
    let removed = 0
    for (let i = this.count - 1; i >= 0; i--) {
      if (!this.hostile[i]) continue
      this._remove(i)
      removed++
    }
    return removed
  }

  update(dt) {
    const world = this.world
    const enemies = world.enemies
    const player = world.player
    for (let i = this.count - 1; i >= 0; i--) {
      this.prevX[i] = this.x[i]
      this.prevZ[i] = this.z[i]
      this.age[i] += dt
      if (this.orbit[i]) {
        this.orbitAngle[i] += this.orbitSpeed[i] * dt
        this.x[i] = player.x + Math.cos(this.orbitAngle[i]) * this.orbitRadius[i]
        this.z[i] = player.z + Math.sin(this.orbitAngle[i]) * this.orbitRadius[i]
        this.dx[i] = Math.cos(this.orbitAngle[i])
        this.dz[i] = Math.sin(this.orbitAngle[i])
      } else if (this.returnPhase[i]) {
        const toPlayerX = player.x - this.x[i]
        const toPlayerZ = player.z - this.z[i]
        const length = Math.hypot(toPlayerX, toPlayerZ) || 1
        this.dx[i] = toPlayerX / length
        this.dz[i] = toPlayerZ / length
        this.x[i] += this.dx[i] * this.speed[i] * dt
        this.z[i] += this.dz[i] * this.speed[i] * dt
        if (length <= Math.max(0.7, this.radius[i] + 0.35)) {
          this._remove(i)
          continue
        }
      } else {
        this.x[i] += this.dx[i] * this.speed[i] * dt
        this.z[i] += this.dz[i] * this.speed[i] * dt
        if (this.returnAt[i] > 0 && this.age[i] >= this.returnAt[i]) this.returnPhase[i] = 1
      }
      this.life[i] -= dt
      if (this.life[i] <= 0) { this._remove(i); continue }

      if (this.hostile[i]) {
        const rr = this.radius[i] + 0.55
        const dx = player.x - this.x[i]
        const dz = player.z - this.z[i]
        if (dx * dx + dz * dz <= rr * rr) {
          if (player.takeDamage(this.damage[i])) world.shake = Math.max(world.shake, 0.45)
          this._remove(i)
        }
        continue
      }

      const boss = world.boss
      if (this.bossSeeking[i] && boss?.active) {
        const dx = boss.x - this.x[i]
        const dz = boss.z - this.z[i]
        const distance = Math.hypot(dx, dz) || 1
        // The flying sword is already an authored tracking weapon. During a
        // boss encounter it keeps that target instead of farming the same two
        // fodder bodies every fixed tick while preserving its pierce budget.
        this.dx[i] = dx / distance
        this.dz[i] = dz / distance
        const rr = this.radius[i] + boss.def.radius
        if (distance <= rr) {
          world.damageBoss(this.damage[i], this.tag[i], {
            behavior: this.behaviorDescriptor[i], sourceId: this.audioSourceId[i],
          })
          this.pierce[i]--
          if (this.pierce[i] <= 0) this._remove(i)
        }
        continue
      }
      if (this.bossSeeking[i]) this.bossSeeking[i] = 0

      const n = enemies.grid.query(this.x[i], this.z[i], this.radius[i] + 1.2, _query)
      let hit = false
      for (let q = 0; q < n; q++) {
        const enemyIndex = _query[q]
        if (enemyIndex >= enemies.count || enemies.dead[enemyIndex]) continue
        const uid = enemies.uid[enemyIndex]
        if (uid === this.lastUid[i]) continue
        const rr = this.radius[i] + enemies.radius[enemyIndex]
        const dx = enemies.x[enemyIndex] - this.x[i]
        const dz = enemies.z[enemyIndex] - this.z[i]
        if (dx * dx + dz * dz > rr * rr) continue
        enemies.damageOne(
          enemyIndex, this.damage[i], this.tag[i], this.behaviorDescriptor[i], this.x[i], this.z[i],
        )
        this.lastUid[i] = uid
        hit = true
        this.pierce[i]--
        if (this.pierce[i] <= 0) break
      }

      if (!hit && boss?.active) {
        const rr = this.radius[i] + boss.def.radius
        const dx = boss.x - this.x[i]
        const dz = boss.z - this.z[i]
        if (dx * dx + dz * dz <= rr * rr) {
          world.damageBoss(this.damage[i], this.tag[i], {
            behavior: this.behaviorDescriptor[i], sourceId: this.audioSourceId[i],
          })
          this.pierce[i]--
          hit = true
        }
      }
      if (hit && this.pierce[i] <= 0) this._remove(i)
    }
  }
}

class EnemyField2D {
  constructor(world, rng) {
    this.world = world
    this.rng = rng
    this.count = 0
    this.killCount = 0
    this.spawnTimer = 0
    this.nextUid = 1
    this.grid = new SpatialHash(3)
    this.type = new Uint8Array(MAX_ENEMIES_2D)
    this.behavior = new Uint8Array(MAX_ENEMIES_2D)
    this.archetype = new Uint8Array(MAX_ENEMIES_2D)
    this.elite = new Uint8Array(MAX_ENEMIES_2D)
    this.dead = new Uint8Array(MAX_ENEMIES_2D)
    this.uid = new Uint32Array(MAX_ENEMIES_2D)
    this.x = new Float32Array(MAX_ENEMIES_2D)
    this.z = new Float32Array(MAX_ENEMIES_2D)
    this.prevX = new Float32Array(MAX_ENEMIES_2D)
    this.prevZ = new Float32Array(MAX_ENEMIES_2D)
    this.hp = new Float32Array(MAX_ENEMIES_2D)
    this.maxHp = new Float32Array(MAX_ENEMIES_2D)
    this.speed = new Float32Array(MAX_ENEMIES_2D)
    this.damage = new Float32Array(MAX_ENEMIES_2D)
    this.radius = new Float32Array(MAX_ENEMIES_2D)
    this.xp = new Float32Array(MAX_ENEMIES_2D)
    this.hitCd = new Float32Array(MAX_ENEMIES_2D)
    this.shotCd = new Float32Array(MAX_ENEMIES_2D)
    this.flash = new Float32Array(MAX_ENEMIES_2D)
    this.attackTimer = new Float32Array(MAX_ENEMIES_2D)
    this.facing = new Float32Array(MAX_ENEMIES_2D)
    this.age = new Float32Array(MAX_ENEMIES_2D)
    this.windup = new Float32Array(MAX_ENEMIES_2D)
    this.burstTimer = new Float32Array(MAX_ENEMIES_2D)
    this.burnDamage = new Float32Array(MAX_ENEMIES_2D)
    this.burnTimer = new Float32Array(MAX_ENEMIES_2D)
    this.burnTick = new Float32Array(MAX_ENEMIES_2D)
    this.slowMultiplier = new Float32Array(MAX_ENEMIES_2D)
    this.slowTimer = new Float32Array(MAX_ENEMIES_2D)
    this.freezeTimer = new Float32Array(MAX_ENEMIES_2D)
    this.shatterDamage = new Float32Array(MAX_ENEMIES_2D)
    this._fields = [this.type, this.behavior, this.archetype, this.elite, this.dead, this.uid, this.x, this.z,
      this.prevX, this.prevZ, this.hp, this.maxHp, this.speed, this.damage, this.radius,
      this.xp, this.hitCd, this.shotCd, this.flash, this.attackTimer, this.facing, this.age,
      this.windup, this.burstTimer, this.burnDamage, this.burnTimer, this.burnTick,
      this.slowMultiplier, this.slowTimer, this.freezeTimer, this.shatterDamage]
    this.dropped = 0
  }

  get liveCount() { return this.count }

  spawn(enemyId, x, z, runTime, hpMul = 1, haste = 1) {
    if (this.count >= MAX_ENEMIES_2D) { this.dropped++; return false }
    const def = getEnemy(enemyId) ?? ENEMIES[0]
    const i = this.count++
    const typeIndex = Math.max(0, ENEMIES.indexOf(def))
    const hp = scaledHp(def, runTime / 60) * hpMul * (this.world.stage?.hpScale ?? 1)
    this.type[i] = typeIndex
    this.archetype[i] = ARCHETYPE_INDEX_2D.get(classifyEnemyArchetype2D(def)) ?? 0
    this.behavior[i] = def.behavior === 'ranged' ? 1
      : def.behavior === 'flanker' ? 2
        : def.behavior === 'lumberer' ? 3
          : def.behavior === 'drifter' ? 4
            : def.behavior === 'dasher' || def.behavior === 'charger' || def.behavior === 'skirmisher' ? 5
              : def.behavior === 'splitter' ? 6
                : def.behavior === 'flicker' ? 7 : 0
    this.elite[i] = def.elite ? 1 : 0
    this.dead[i] = 0
    this.uid[i] = this.nextUid++
    this.x[i] = this.prevX[i] = x
    this.z[i] = this.prevZ[i] = z
    this.hp[i] = this.maxHp[i] = hp
    this.speed[i] = def.speed * TRIAL.speed * haste
    this.damage[i] = scaledDamage(def, runTime / 60)
    this.radius[i] = def.radius
    this.xp[i] = scaledXp(def, runTime / 60)
    this.hitCd[i] = this.rng.range(0, CONTACT_COOLDOWN)
    this.shotCd[i] = this.rng.range(0.6, 1.8)
    this.flash[i] = 0
    this.attackTimer[i] = 0
    this.facing[i] = 0
    this.age[i] = 0
    this.windup[i] = 0
    this.burstTimer[i] = 0
    this.burnDamage[i] = 0
    this.burnTimer[i] = 0
    this.burnTick[i] = 0
    this.slowMultiplier[i] = 1
    this.slowTimer[i] = 0
    this.freezeTimer[i] = 0
    this.shatterDamage[i] = 0
    return true
  }

  _spawnRing(player, runTime, id) {
    const angle = this.rng.angle()
    const radius = this.rng.range(SPAWN_MIN, SPAWN_MAX)
    this.spawn(id, player.x + Math.cos(angle) * radius, player.z + Math.sin(angle) * radius, runTime)
  }

  _spawnWave(dt, runTime, player) {
    this.spawnTimer -= dt
    if (this.spawnTimer > 0) return
    const wave = waveAt(runTime)
    this.spawnTimer += wave.spawnInterval
    const activeBoss = this.world.boss?.active ? this.world.boss : null
    const finalEncounter = activeBoss?.def?.id === this.world.finalBossId
    const encounterDensity = finalEncounter
      ? FINAL_BOSS_WAVE_DENSITY_2D
      : activeBoss ? BOSS_WAVE_DENSITY_2D : 1
    const requested = Math.max(1, Math.round(wave.perSpawn * TRIAL.density * encounterDensity))
    const available = MAX_ENEMIES_2D - this.count
    const count = Math.min(requested, available, 64)
    const types = rosterFor(this.world.stage, wave.types)
    // A random pick can produce six identical actors even when a band declares
    // three types. Rotate through the weighted roster so each pack has a clear
    // visual composition while the seeded offset keeps successive packs varied.
    const offset = this.rng.int(types.length)
    for (let n = 0; n < count; n++) this._spawnRing(player, runTime, types[(offset + n) % types.length])
  }

  update(dt, runTime, player) {
    this._spawnWave(dt, runTime, player)
    this.grid.clear()
    for (let i = 0; i < this.count; i++) {
      if (this.dead[i]) continue
      this.prevX[i] = this.x[i]
      this.prevZ[i] = this.z[i]
      this.hitCd[i] = Math.max(0, this.hitCd[i] - dt)
      this.shotCd[i] -= dt
      this.flash[i] = Math.max(0, this.flash[i] - dt)
      this.attackTimer[i] = Math.max(0, this.attackTimer[i] - dt)
      this.burnTimer[i] = Math.max(0, this.burnTimer[i] - dt)
      this.slowTimer[i] = Math.max(0, this.slowTimer[i] - dt)
      this.freezeTimer[i] = Math.max(0, this.freezeTimer[i] - dt)
      if (this.slowTimer[i] <= 0) this.slowMultiplier[i] = 1
      if (this.burnTimer[i] > 0) {
        this.burnTick[i] -= dt
        if (this.burnTick[i] <= 0) {
          this.burnTick[i] += 0.5
          this.damageOne(i, this.burnDamage[i], 'fire')
          if (this.dead[i]) continue
        }
      } else {
        this.burnDamage[i] = 0
        this.burnTick[i] = 0
      }
      if (this.windup[i] > 0) this.windup[i] = Math.max(0, this.windup[i] - dt)
      else this.burstTimer[i] = Math.max(0, this.burstTimer[i] - dt)
      this.age[i] += dt

      let dx = player.x - this.x[i]
      let dz = player.z - this.z[i]
      let dist = Math.hypot(dx, dz) || 0.001
      this.facing[i] = Math.atan2(dx, dz)
      const behavior = this.behavior[i]
      const def = ENEMIES[this.type[i]] ?? ENEMIES[0]
      let move = 1
      if (behavior === 1 && dist < (def.keepDistance ?? 7)) move = -0.45
      if (behavior === 4) move = 0.78
      if (behavior === 5 && this.shotCd[i] <= 0 && this.windup[i] <= 0 && this.burstTimer[i] <= 0 && dist < 13) {
        this.shotCd[i] += def.dashInterval ?? def.chargeInterval ?? 3.4
        this.windup[i] = def.chargeWindup ?? 0.24
        this.burstTimer[i] = def.chargeTime ?? 0.42
        this.attackTimer[i] = Math.max(0.34, this.windup[i] + this.burstTimer[i])
      }
      if (behavior === 7 && this.shotCd[i] <= 0 && dist < 16) {
        const side = (this.uid[i] & 1) === 0 ? 1 : -1
        this.x[i] += (-dz / dist) * side * 2.2
        this.z[i] += (dx / dist) * side * 2.2
        this.shotCd[i] += 1.15 + (this.uid[i] % 5) * 0.08
        this.attackTimer[i] = 0.2
      }
      const tangent = behavior === 2 ? Math.sin(runTime * 1.7 + this.uid[i]) * 0.62
        : behavior === 4 ? Math.sin(runTime * 1.25 + this.uid[i] * 0.73) * 0.86 : 0
      const lumberRamp = behavior === 3
        ? 0.58 + Math.min(1, this.age[i] / Math.max(0.1, def.rampTime ?? 8)) * ((def.rampTo ?? 1.2) - 0.58)
        : 1
      const statusSpeedMul = this.freezeTimer[i] > 0 ? 0 : this.slowMultiplier[i]
      const speedMul = behavior === 5
        ? this.windup[i] > 0 ? 0.12 : this.burstTimer[i] > 0 ? (def.chargeSpeed ?? 2.15) : 1
        : lumberRamp
      this.x[i] += ((dx / dist) * move + (-dz / dist) * tangent) * this.speed[i] * speedMul * statusSpeedMul * dt
      this.z[i] += ((dz / dist) * move + (dx / dist) * tangent) * this.speed[i] * speedMul * statusSpeedMul * dt

      dx = player.x - this.x[i]
      dz = player.z - this.z[i]
      dist = Math.hypot(dx, dz) || 0.001
      if (dist > DESPAWN_RADIUS) {
        const angle = this.rng.angle()
        const radius = this.rng.range(SPAWN_MIN, SPAWN_MAX)
        this.x[i] = this.prevX[i] = player.x + Math.cos(angle) * radius
        this.z[i] = this.prevZ[i] = player.z + Math.sin(angle) * radius
      }

      if (behavior === 1 && this.shotCd[i] <= 0 && dist < 14) {
        this.shotCd[i] += def.shootInterval ?? this.rng.range(1.7, 2.5)
        this.attackTimer[i] = 0.34
        this.world.projectiles.spawn({
          kind: PROJECTILE_KIND.hostile, x: this.x[i], z: this.z[i], dx, dz,
          speed: def.shotSpeed ?? 6.2, life: 3.2,
          damage: def.shotDamage ?? this.damage[i] * 0.72, radius: 0.38,
          pierce: 1, hostile: true, color: 0xff7c96, tag: 'hostile',
        })
      }

      const rr = this.radius[i] + 0.55
      if (dist <= rr && this.hitCd[i] <= 0) {
        this.attackTimer[i] = 0.3
        const contactDamage = this.damage[i] * openingIncomingDamageScale2D(runTime)
        if (player.takeDamage(contactDamage, openingMercyIFrames2D(runTime))) {
          this.world.shake = Math.max(this.world.shake, 0.5)
        }
        this.hitCd[i] = CONTACT_COOLDOWN
      }

      // Keep the horde dense without letting identical cut-outs occupy the
      // exact same pixels. The already-updated neighbours are in the spatial
      // hash, so this costs only the local crowd rather than an O(n²) pass.
      const nearby = this.grid.query(this.x[i], this.z[i], 1.65, _query)
      for (let q = 0; q < nearby && q < 12; q++) {
        const j = _query[q]
        if (j >= i || this.dead[j]) continue
        let sx = this.x[i] - this.x[j]
        let sz = this.z[i] - this.z[j]
        let separation = Math.hypot(sx, sz)
        const desired = Math.min(1.25, (this.radius[i] + this.radius[j]) * 0.72)
        if (separation >= desired) continue
        if (separation < 0.001) {
          const angle = (this.uid[i] * 2.399963) % (Math.PI * 2)
          sx = Math.cos(angle)
          sz = Math.sin(angle)
          separation = 1
        }
        const push = (desired - separation) * 0.34
        this.x[i] += (sx / separation) * push
        this.z[i] += (sz / separation) * push
      }
      this.grid.insert(i, this.x[i], this.z[i])
    }
  }

  nearest(x, z, radius = 24) {
    const n = this.grid.query(x, z, radius, _query)
    let best = -1
    let bestD2 = radius * radius
    for (let q = 0; q < n; q++) {
      const i = _query[q]
      if (i >= this.count || this.dead[i]) continue
      const dx = this.x[i] - x
      const dz = this.z[i] - z
      const d2 = dx * dx + dz * dz
      if (d2 < bestD2) { bestD2 = d2; best = i }
    }
    return best
  }

  _applyBehaviorStatus(i, behavior, originX, originZ, chainDepth = 0) {
    const effects = behavior?.statusEffects
    if (!effects || i < 0 || i >= this.count) return
    let status = null
    if (effects.burn?.enabled) {
      this.burnDamage[i] = Math.max(this.burnDamage[i], effects.burn.amount ?? effects.burn.value ?? 0)
      this.burnTimer[i] = Math.max(this.burnTimer[i], effects.burn.durationSeconds ?? 3)
      this.burnTick[i] = Math.min(this.burnTick[i] || 0.5, 0.5)
      status = 'burn'
    }
    if (effects.slow?.enabled) {
      const multiplier = clamp(1 - (effects.slow.value ?? 0), 0.05, 1)
      this.slowMultiplier[i] = Math.min(this.slowMultiplier[i] || 1, multiplier)
      this.slowTimer[i] = Math.max(this.slowTimer[i], effects.slow.durationSeconds ?? 2)
      status ??= 'slow'
    }
    if (effects.freeze?.enabled) {
      this.freezeTimer[i] = Math.max(this.freezeTimer[i], effects.freeze.durationSeconds ?? 2.2)
      status = 'freeze'
    }
    if (effects.shatter?.enabled) {
      this.shatterDamage[i] = Math.max(this.shatterDamage[i], effects.shatter.damage ?? effects.shatter.value ?? 0)
      status ??= 'shatter'
    }
    if (effects.knockback?.enabled) {
      let dx = this.x[i] - originX
      let dz = this.z[i] - originZ
      let distance = Math.hypot(dx, dz)
      // A dash can end on the same coordinate as a small enemy. Choose a
      // stable uid-derived outward direction instead of silently losing the
      // authored push when the vector has zero length.
      if (distance < 0.001) {
        const angle = (this.uid[i] * 2.399963) % (Math.PI * 2)
        dx = Math.cos(angle)
        dz = Math.sin(angle)
        distance = 1
      }
      dx /= distance
      dz /= distance
      const force = Math.max(0, effects.knockback.strength ?? effects.knockback.value ?? 0) * 0.08
      this.x[i] += dx * force
      this.z[i] += dz * force
      status ??= 'knockback'
    }
    if (effects.pull?.enabled) {
      this.pullAt(originX, originZ, Math.max(0.8, behavior.collision?.radiusScale ?? 1.5), effects.pull.strength ?? 2, 0.08)
      status ??= 'pull'
    }
    if (effects.chain?.enabled || (effects.chain?.hops ?? 0) > 0) status ??= 'chain'
    if (status) this.world._emitWeaponAudio('status', behavior, `target:${this.uid[i]}`, { status })
    const hops = Math.min(8, Math.max(0, Math.trunc(effects.chain?.hops ?? effects.chain?.value ?? 0)))
    if (hops <= chainDepth || this.dead[i]) return
    const radius = Math.max(1, effects.chainRange ?? behavior.collision?.chainRange ?? 6)
    const n = this.grid.query(this.x[i], this.z[i], radius, _chainQuery)
    for (let q = 0; q < n; q++) {
      const target = _chainQuery[q]
      if (target === i || target >= this.count || this.dead[target]) continue
      const dx = this.x[target] - this.x[i]
      const dz = this.z[target] - this.z[i]
      if (dx * dx + dz * dz > radius * radius) continue
      this.damageOne(target, behavior.collision.damage * 0.55, behavior.tag, behavior, this.x[i], this.z[i], chainDepth + 1)
      break
    }
  }

  damageOne(i, rawDamage, tag, behavior = null, originX = null, originZ = null, chainDepth = 0, sourceId = null) {
    if (i < 0 || i >= this.count || this.dead[i]) return null
    const result = rollDamage(rawDamage, this.world.player.stats, tag, this.rng)
    this.hp[i] -= result.amount
    this.world.runStats.damageDealt += result.amount
    this.flash[i] = 0.14
    this.world.effects.spawn(EFFECT_KIND.hit, this.x[i], this.z[i], 0.18, result.crit ? 1.7 : 1.1, colorForTag(tag))
    this.world.onHit?.(this.x[i], this.z[i], tag, result.crit, result.amount)
    if (behavior && !String(sourceId ?? '').startsWith('field:')) {
      const source = sourceId == null ? `target:${this.uid[i]}` : `${sourceId}:target:${this.uid[i]}`
      this.world._emitWeaponAudio('impact', behavior, source, {
        targetId: this.uid[i], damage: result.amount, crit: result.crit,
      })
    }
    const hitX = Number.isFinite(originX) ? originX : this.x[i]
    const hitZ = Number.isFinite(originZ) ? originZ : this.z[i]
    this._applyBehaviorStatus(i, behavior, hitX, hitZ, chainDepth)
    if (this.hp[i] <= 0) this.dead[i] = 1
    return result
  }

  damageAt(x, z, radius, rawDamage, tag, behavior = null, sourceId = null) {
    const n = this.grid.query(x, z, radius + 1.3, _query)
    let victims = 0
    for (let q = 0; q < n; q++) {
      const i = _query[q]
      if (i >= this.count || this.dead[i]) continue
      const rr = radius + this.radius[i]
      const dx = this.x[i] - x
      const dz = this.z[i] - z
      if (dx * dx + dz * dz > rr * rr) continue
      this.damageOne(i, rawDamage, tag, behavior, x, z, 0, sourceId)
      victims++
    }
    const boss = this.world.boss
    if (boss?.active) {
      const rr = radius + boss.def.radius
      const dx = boss.x - x
      const dz = boss.z - z
      if (dx * dx + dz * dz <= rr * rr) this.world.damageBoss(rawDamage, tag, { behavior, sourceId })
    }
    return victims
  }

  damageSegmentAt(fromX, fromZ, toX, toZ, radius, rawDamage, tag, behavior = null, sourceId = null) {
    const centerX = (fromX + toX) * 0.5
    const centerZ = (fromZ + toZ) * 0.5
    const halfLength = Math.hypot(toX - fromX, toZ - fromZ) * 0.5
    const queryRadius = halfLength + radius + 1.3
    const n = this.grid.query(centerX, centerZ, queryRadius, _query)
    const vx = toX - fromX
    const vz = toZ - fromZ
    const lengthSquared = vx * vx + vz * vz
    let victims = 0
    for (let q = 0; q < n; q++) {
      const i = _query[q]
      if (i >= this.count || this.dead[i]) continue
      const px = this.x[i] - fromX
      const pz = this.z[i] - fromZ
      const t = lengthSquared > 0
        ? clamp((px * vx + pz * vz) / lengthSquared, 0, 1)
        : 0
      const closestX = fromX + vx * t
      const closestZ = fromZ + vz * t
      const dx = this.x[i] - closestX
      const dz = this.z[i] - closestZ
      const rr = radius + this.radius[i]
      if (dx * dx + dz * dz > rr * rr) continue
      this.damageOne(i, rawDamage, tag, behavior, centerX, centerZ, 0, sourceId)
      victims++
    }
    const boss = this.world.boss
    if (boss?.active) {
      const px = boss.x - fromX
      const pz = boss.z - fromZ
      const t = lengthSquared > 0
        ? clamp((px * vx + pz * vz) / lengthSquared, 0, 1)
        : 0
      const closestX = fromX + vx * t
      const closestZ = fromZ + vz * t
      const dx = boss.x - closestX
      const dz = boss.z - closestZ
      const rr = radius + boss.def.radius
      if (dx * dx + dz * dz <= rr * rr) {
        this.world.damageBoss(rawDamage, tag, { behavior, sourceId })
      }
    }
    return victims
  }

  pullAt(x, z, radius, strength = 2, dt = 1 / 60) {
    const n = this.grid.query(x, z, radius + 1.3, _pullQuery)
    const force = Math.max(0, strength) * Math.max(0, dt)
    for (let q = 0; q < n; q++) {
      const i = _pullQuery[q]
      if (i >= this.count || this.dead[i]) continue
      const dx = x - this.x[i]
      const dz = z - this.z[i]
      const distance = Math.hypot(dx, dz)
      const limit = radius + this.radius[i]
      if (distance <= 0.001 || distance > limit) continue
      const amount = Math.min(distance * 0.65, force * (1 - distance / limit + 0.25))
      this.x[i] += dx / distance * amount
      this.z[i] += dz / distance * amount
    }
  }

  pullLimitedAt(x, z, radius, limit = 8, strength = 2, dt = 1 / 60) {
    const n = this.grid.query(x, z, radius + 1.3, _pullQuery)
    const force = Math.max(0, strength) * Math.max(0, dt)
    let moved = 0
    for (let q = 0; q < n && moved < limit; q++) {
      const i = _pullQuery[q]
      if (i >= this.count || this.dead[i]) continue
      const dx = x - this.x[i]
      const dz = z - this.z[i]
      const distance = Math.hypot(dx, dz)
      const limitRadius = radius + this.radius[i]
      if (distance <= 0.001 || distance > limitRadius) continue
      const amount = Math.min(distance * 0.65, force * (1 - distance / limitRadius + 0.25))
      this.x[i] += dx / distance * amount
      this.z[i] += dz / distance * amount
      moved++
    }
    return moved
  }

  purgeOnScreen(player) {
    for (let i = 0; i < this.count; i++) {
      const dx = this.x[i] - player.x
      const dz = this.z[i] - player.z
      if (dx * dx + dz * dz <= 26 * 26) this.dead[i] = 1
    }
  }

  flushDeaths(onDeath = null) {
    const splits = []
    for (let i = this.count - 1; i >= 0; i--) {
      if (!this.dead[i]) continue
      const x = this.x[i]
      const z = this.z[i]
      const xp = this.xp[i]
      const elite = this.elite[i]
      const def = ENEMIES[this.type[i]] ?? ENEMIES[0]
      const shatter = this.shatterDamage[i]
      onDeath?.({
        id: this.uid[i], enemyId: def.id, x, z, elite: Boolean(elite),
        frozen: this.freezeTimer[i] > 0 || shatter > 0,
      })
      if (shatter > 0) {
        this.damageAt(x, z, 1.35, shatter, 'ice')
        this.world.effects.spawn(EFFECT_KIND.lightning, x, z, 0.28, 1.6, 0xb8efff)
      }
      if (this.behavior[i] === 6 && (def.splitInto ?? 0) > 0) {
        splits.push({ x, z, id: def.id, count: def.splitInto, runTime: this.world.runTime })
      }
      this.world.pickups.spawn(x, z, xp, false)
      if (elite || this.rng.chance(0.035)) this.world.pickups.spawn(x + 0.25, z, elite ? 6 : 2, true)
      this.world.effects.spawn(EFFECT_KIND.death, x, z, 0.32, elite ? 2.2 : 1.25, elite ? 0xf2c76f : 0x9c7bd8)
      this.killCount++
      this.world.player.kills = this.killCount
      const last = --this.count
      if (i !== last) copyAt(this._fields, last, i)
    }
    for (const split of splits) {
      for (let n = 0; n < split.count; n++) {
        const angle = (n / split.count) * Math.PI * 2 + this.rng.range(-0.35, 0.35)
        const index = this.count
        if (!this.spawn(
          split.id,
          split.x + Math.cos(angle) * 0.7,
          split.z + Math.sin(angle) * 0.7,
          split.runTime,
          0.32,
          1.18,
        )) continue
        // Spawned brood do not recurse; they are smaller, faster cleanup
        // threats that make the parent's death tactically distinct.
        this.behavior[index] = 0
        this.radius[index] *= 0.72
        this.xp[index] *= 0.2
      }
    }
  }

  radarSnapshot(playerX, playerZ, limit = 96) {
    const points = []
    for (let i = 0; i < this.count && points.length < limit; i++) {
      if (this.dead[i]) continue
      const dx = (this.x[i] - playerX) / 24
      const dz = (this.z[i] - playerZ) / 24
      if (dx * dx + dz * dz > 1) continue
      points.push({ x: dx, z: dz, elite: Boolean(this.elite[i]), ranged: this.behavior[i] === 1 })
    }
    return points
  }
}

export class CombatWorld2D {
  constructor({ character, stage, progress, rng, daoVows = null, daoSnapshot = null }) {
    this.stage = stage
    this.progress = progress
    this.rng = rng
    this.runTime = 0
    this.shake = 0
    this.ended = false
    this.victory = false
    this._pendingEnd = null
    this._daoTickComplete = false
    this._daoDashEvent = null
    this._daoTickIndex = 0
    this._daoDashSerial = 0
    this._daoPickupEvents = []
    this._daoDeathEvents = []
    this._daoPendingDeathEvents = []
    this._daoLastActions = []
    this._daoOverchargeBoost = null
    this.pendingLevels = 0
    this.runStats = {
      evolutions: 0,
      bossKills: 0,
      damageDealt: 0,
      damageTaken: 0,
      rerollsUsed: 0,
      banishesUsed: 0,
    }
    this.trial = applyTrial(progress.trial)
    this.effects = new EffectField2D()
    this.player = new PlayerState2D(character, progress.statMods, progress.reviveCharges, this.effects)
    this.player.onHurt = (amount) => {
      this.runStats.damageTaken += amount
      this.onPlayerHurt?.(amount)
    }
    this.player.onHeal = (amount, source) => this.onPlayerHeal?.(amount, source)
    this.daoVows = daoVows ?? null
    this.daoVowSnapshot = daoSnapshot ?? this.daoVows?.snapshot?.() ?? null
    this.daoRuntime = new DaoCombatRuntime2D({
      snapshot: this.daoVowSnapshot,
      seed: rng?.seed,
    })
    this.daoCombatRuntime = this.daoRuntime
    this.player.onDash = (dash) => this._onPlayerDash(dash)
    this.pickups = new PickupField2D(this)
    this.projectiles = new ProjectileField2D(this)
    this.weaponFields = new WeaponField2D(this)
    this.enemies = new EnemyField2D(this, rng)
    this.boss = null
    // Boss zones are simulation hazards, separate from renderer-only effects.
    // They retain the exact cast snapshot so a moving player is checked
    // against the same placement that was telegraphed.
    this.bossZoneFields = []
    const authoredSchedule = scheduleFor(stage)
    this.bossSchedule = [
      { ...authoredSchedule[0], t: 180, slot: 'mid' },
      { ...authoredSchedule.at(-1), t: 330, slot: 'final' },
    ]
    this.spawnedBosses = new Set()
    this.finalBossId = this.bossSchedule.at(-1)?.id ?? null
    this.weaponTimers = new Map()
    this.weaponBehaviorUsage = new Set()
    this.weaponBehaviorAxesUsed = new Map()
    this.weaponAudioEvents = new Array(32)
    this.weaponAudioCount = 0
    this.weaponAudioCastSequence = 0
    this.weaponAudioLastAt = new Map()
    this.weaponCache = []
    this.passiveCache = []
    this.pacing = new ContestPacing2D()
    this.formations = new FormationDirector2D({ seed: rng.seed, roster: stage?.roster })
    this.rebuildLoadoutCache()
    this.snapshot = Object.freeze({
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      weaponFields: this.weaponFields,
      pickups: this.pickups,
      effects: this.effects,
      world: this,
    })
    this.onLevels = null
    this.onEnd = null
    this.onHit = null
    this.onWeaponAudio = null
    this.onBossTelegraph = null
    this.onBossImpact = null
    this.onBossHit = null
    this.onBossDeath = null
    this.onPlayerHurt = null
    this.onPlayerHeal = null
    this.onPlayerDash = null
    this.onEnemyDeath = null
    this.onPacingMilestone = null
    this.onFormation = null
    this.onDaoAction = null
    this._daoActive = Boolean(this.daoRuntime?.active)
    if (this.daoVowSnapshot?.combatModifiers) {
      this.applyDaoModifiers(this.daoVowSnapshot.combatModifiers, this.daoVowSnapshot)
    }
  }

  rebuildLoadoutCache() {
    this.weaponCache = Object.entries(this.player.loadout.weapons).map(([id, level]) => ({ id, level }))
    this.passiveCache = Object.entries(this.player.loadout.passives).map(([id, level]) => ({ id, level }))
    const alive = new Set(this.weaponCache.map((w) => w.id))
    for (const id of this.weaponTimers.keys()) if (!alive.has(id)) this.weaponTimers.delete(id)
    for (const { id } of this.weaponCache) if (!this.weaponTimers.has(id)) this.weaponTimers.set(id, 0.05)
  }

  applyDaoModifiers(modifiers, snapshot = null, { reset = false } = {}) {
    this.player.daoModifiers = modifiers ?? null
    this.daoVowSnapshot = snapshot ?? this.daoVowSnapshot ?? null
    if (snapshot?.vowId) this.daoVows = this.daoVows ?? { vowId: snapshot.vowId }
    if (this.daoRuntime) {
      const source = snapshot ?? {
        vowId: modifiers?.vowId ?? this.daoVows?.vowId ?? null,
        combatModifiers: modifiers,
      }
      this.daoRuntime.setDaoState(source, { reset })
      this._daoActive = this.daoRuntime.active
    }
    this.player.recomputeStats()
    return this.player.stats
  }

  _onPlayerDash({ fromX, fromZ, toX, toZ }) {
    const event = {
      id: `dash:${this._daoTickIndex}:${++this._daoDashSerial}`,
      tick: this._daoTickIndex,
      fromX, fromZ, toX, toZ,
    }
    this._daoDashEvent = event
    this.effects.spawn(EFFECT_KIND.dash, toX, toZ, 0.24, 3.6, 0xd5f6ff)
    this.onPlayerDash?.(event)
  }

  _queueDaoDeath(death, pending = false) {
    if (!death?.frozen) return false
    const target = pending ? this._daoPendingDeathEvents : this._daoDeathEvents
    target.push(death)
    return true
  }

  /** Flush enemy deaths through the one Dao event hook used by every caller. */
  flushEnemyDeaths({ pending = false } = {}) {
    return this.enemies.flushDeaths((death) => {
      this._queueDaoDeath(death, pending)
      this.onEnemyDeath?.(death)
    })
  }

  _drainPendingDaoDeaths() {
    if (this._daoPendingDeathEvents.length === 0) return
    this._daoDeathEvents.push(...this._daoPendingDeathEvents)
    this._daoPendingDeathEvents.length = 0
  }

  _applyDaoDash({ fromX, fromZ, toX, toZ }) {
    // The fixed-tick Dao runtime owns all vow dash effects. Keep this legacy
    // method as a safe compatibility hook for callers from older integrations.
    if (this.daoRuntime?.active) return false
    const dao = this.player.daoModifiers
    if (!dao) return false
    if ((dao.frostFieldCountAdd ?? 0) > 0) {
      const radius = Math.max(1.2, dao.frostFieldRadius ?? 2.4)
      const damage = 12 * this.player.level
      this.enemies.damageAt(fromX, fromZ, radius, damage, 'ice')
      this.enemies.damageAt(toX, toZ, radius, damage, 'ice')
      this.effects.spawn(EFFECT_KIND.ring, fromX, fromZ, Math.max(0.45, dao.frostFieldDuration ?? 1), radius, 0x9ee8ff)
      this.effects.spawn(EFFECT_KIND.ring, toX, toZ, Math.max(0.45, dao.frostFieldDuration ?? 1), radius, 0xc8f5ff)
    }
    if (dao.swordRingEnabled) {
      const radius = Math.max(1.5, dao.swordRingRadius ?? 3.2)
      this.enemies.damageAt(toX, toZ, radius, 18 * this.player.level, 'sword')
      this.effects.spawn(EFFECT_KIND.ring, toX, toZ, dao.swordRingDuration ?? 0.45, radius, 0xeaf6ff)
    }
    if (dao.spiritPurgeEnabled) {
      const radius = Math.max(2, dao.spiritPurgeRadius ?? 4.5)
      this.enemies.damageAt(toX, toZ, radius, 15 * this.player.level, 'thunder')
      this.effects.spawn(EFFECT_KIND.lightning, toX, toZ, 0.42, radius, 0xc88cff)
    }
    return true
  }

  _daoFieldIndex(fieldId) {
    for (let i = 0; i < this.weaponFields.count; i++) {
      if (this.weaponFields.daoFieldId[i] === fieldId) return i
    }
    return -1
  }

  _daoFieldPosition(fieldId) {
    const index = this._daoFieldIndex(fieldId)
    return index < 0 ? null : { x: this.weaponFields.x[index], z: this.weaponFields.z[index] }
  }

  _daoFrostBehavior(action, wall = false) {
    const duration = Math.max(0.2, action.duration ?? 1.8)
    const slowMultiplier = clamp(action.slowMultiplier ?? 1, 0.05, 1)
    const daoDamage = Math.max(0.25, this.player.daoModifiers?.frostFieldDamageMultiplier ?? 1)
    return {
      ...DAO_FROST_FIELD_BEHAVIOR_2D,
      id: wall ? 'dao-frost-wall' : DAO_FROST_FIELD_BEHAVIOR_2D.id,
      weaponId: wall ? 'dao-frost-wall' : DAO_FROST_FIELD_BEHAVIOR_2D.weaponId,
      trajectory: { ...DAO_FROST_FIELD_BEHAVIOR_2D.trajectory, lifetimeSeconds: duration },
      collision: {
        ...DAO_FROST_FIELD_BEHAVIOR_2D.collision,
        damage: (wall ? 14 : 8) * this.player.level * daoDamage,
      },
      residualField: { ...DAO_FROST_FIELD_BEHAVIOR_2D.residualField, lifetimeSeconds: duration },
      statusEffects: {
        slow: { enabled: true, value: 1 - slowMultiplier, durationSeconds: duration },
        freeze: wall
          ? { enabled: true, durationSeconds: Math.min(0.65, duration) }
          : { enabled: true, durationSeconds: 0.32 },
      },
      audio: { kind: 'frost', tag: 'ice' },
    }
  }

  _dispatchDaoSwordFan(action) {
    const count = Math.max(1, Math.floor(action.count ?? 1))
    const aim = this._aim()
    const base = Math.atan2(aim.dz, aim.dx) + (action.angle ?? 0) * 0.08
    const spread = Math.max(0, action.spread ?? 0)
    const origin = action.origin ?? { x: this.player.x, z: this.player.z }
    const authoredPierceAdd = Number.isFinite(action.pierceAdd)
      ? action.pierceAdd : this.player.daoModifiers?.projectilePierceAdd ?? 0
    const pierce = Math.max(1, 1 + Math.floor(action.returnHits ?? 0) + Math.floor(authoredPierceAdd))
    const returnDelay = Number.isFinite(action.returnDelay)
      ? action.returnDelay : this.player.daoModifiers?.swordReturnDelay ?? 0
    const life = 2.3 * this.player.stats.duration
    for (let n = 0; n < count; n++) {
      const offset = count === 1 ? 0 : (n / (count - 1) - 0.5) * Math.max(0.18, spread + 0.22)
      const angle = base + offset
      this.projectiles.spawn({
        kind: PROJECTILE_KIND.sword,
        x: origin.x, z: origin.z,
        dx: Math.cos(angle), dz: Math.sin(angle),
        speed: 16 * this.player.stats.speedProj,
        life,
        damage: 12 * this.player.level,
        radius: 0.34 * this.player.stats.area,
        pierce,
        color: DAO_ACTION_COLORS_2D.sword,
        tag: 'sword',
        returning: action.mode === 'returning',
        returnDelay,
      })
    }
  }

  _dispatchDaoSwordRing(action) {
    const position = action.position ?? { x: this.player.x, z: this.player.z }
    const radius = Math.max(1.5, action.radius ?? 3.2)
    const push = Math.max(0, action.push ?? 0)
    const duration = Math.max(0.08, action.duration ?? 0.45)
    const behavior = {
      id: 'dao-sword-ring',
      weaponId: 'dao-sword-ring',
      daoAction: true,
      tag: 'sword',
      collision: { radiusScale: 1, damage: 18 * this.player.level, pierce: 999 },
      statusEffects: {
        knockback: { enabled: push > 0, strength: push },
      },
      audio: { kind: 'sword', tag: 'sword' },
    }
    this.enemies.damageAt(
      position.x, position.z, radius, behavior.collision.damage, 'sword', behavior,
      action.source ?? action.dashId ?? null,
    )
    this.effects.spawn(EFFECT_KIND.ring, position.x, position.z, duration, radius, DAO_ACTION_COLORS_2D.sword)
  }

  _dispatchDaoFrostField(action) {
    const behavior = this._daoFrostBehavior(action)
    const position = action.position ?? { x: this.player.x, z: this.player.z }
    this.weaponFields.spawn({
      behavior,
      x: position.x,
      z: position.z,
      radius: Math.max(0.8, action.radius ?? 2.4),
      life: Math.max(0.2, action.duration ?? 1.8) * this.player.stats.duration,
      damage: behavior.collision.damage,
      tag: 'ice',
      kind: 3,
      color: DAO_ACTION_COLORS_2D.frost,
      daoFieldId: action.fieldId,
    })
  }

  _dispatchDaoFrostSlow(action) {
    const index = this._daoFieldIndex(action.fieldId)
    if (index < 0) return
    const behavior = this.weaponFields.behavior[index] ?? this._daoFrostBehavior(action)
    const duration = Math.max(0.2, action.duration ?? 1.8)
    behavior.statusEffects = {
      ...(behavior.statusEffects ?? {}),
      slow: { enabled: true, value: 1 - clamp(action.slowMultiplier ?? 1, 0.05, 1), durationSeconds: duration },
    }
    this.weaponFields.behavior[index] = behavior
  }

  _dispatchDaoFrostWall(action) {
    const behavior = this._daoFrostBehavior(action, true)
    const position = action.position ?? { x: this.player.x, z: this.player.z }
    const distance = Math.max(0, action.distance ?? 0)
    const from = this._daoFieldPosition(action.fromFieldId)
      ?? { x: position.x - distance * 0.5, z: position.z }
    const to = this._daoFieldPosition(action.toFieldId)
      ?? { x: position.x + distance * 0.5, z: position.z }
    // The wall occupies the overlap corridor in the same bounded 128-field
    // pool. Its radius covers both source fields and the deterministic segment
    // midpoint, so enemies crossing either side receive the same status.
    this.weaponFields.spawn({
      behavior,
      x: position.x,
      z: position.z,
      radius: Math.max(0.9, action.radius ?? 2.4),
      life: Math.max(0.25, action.duration ?? 1.8) * this.player.stats.duration,
      damage: behavior.collision.damage,
      tag: 'ice',
      kind: 3,
      color: 0xc8f5ff,
      daoFieldId: 0,
      segment: { fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z },
    })
  }

  _dispatchDaoDeathShards(action) {
    const count = Math.max(1, Math.min(12, Math.floor(action.count ?? 1)))
    const origin = action.position ?? { x: this.player.x, z: this.player.z }
    const base = action.angle ?? 0
    for (let n = 0; n < count; n++) {
      const angle = base + (n / count) * Math.PI * 2
      this.projectiles.spawn({
        kind: PROJECTILE_KIND.ice,
        x: origin.x, z: origin.z,
        dx: Math.cos(angle), dz: Math.sin(angle),
        speed: 9 * this.player.stats.speedProj,
        life: 1.1 * this.player.stats.duration,
        damage: 8 * this.player.level,
        radius: Math.max(0.18, (action.radius ?? 1.4) * 0.16),
        pierce: 1,
        color: 0xb8efff,
        tag: 'ice',
      })
    }
  }

  _dispatchDaoOvercharge(action) {
    const attackDensity = Math.max(1, action.attackDensity ?? 1)
    const magnetMultiplier = Math.max(1, action.magnetMultiplier ?? 1)
    this._daoOverchargeBoost = {
      active: true,
      cooldownMultiplier: 1 / attackDensity,
      magnetMultiplier,
      cycle: action.cycle ?? 0,
    }
    this.player.daoRuntimeBoost = this._daoOverchargeBoost
    this.player.recomputeStats()
  }

  _dispatchDaoSpiritPickup(action) {
    const dao = this.player.daoModifiers ?? {}
    if (!dao.spiritPickupPulseEnabled) return
    const radius = Math.max(1.5, dao.spiritPickupPulseRadius ?? 3.5)
    const chain = Math.max(1, Math.floor(action.chain ?? 1))
    const chainScale = 1 + Math.min(10, chain - 1) * 0.05
    const damage = Math.max(1, dao.spiritPickupPulseDamage ?? 0)
      * this.player.level * chainScale
    this.enemies.damageAt(this.player.x, this.player.z, radius, damage, 'thunder')
    if (chain === 1 || chain % 3 === 0) {
      this.effects.spawn(
        EFFECT_KIND.ring,
        this.player.x,
        this.player.z,
        0.24,
        radius,
        DAO_ACTION_COLORS_2D.spirit,
      )
    }
  }

  _dispatchDaoPurge(action) {
    const position = action.position ?? { x: this.player.x, z: this.player.z }
    const radius = Math.max(1, action.radius ?? 4.5)
    this.enemies.damageAt(position.x, position.z, radius, 15 * this.player.level, 'thunder')
    this.effects.spawn(EFFECT_KIND.lightning, position.x, position.z, 0.42, radius, DAO_ACTION_COLORS_2D.spirit)
  }

  _dispatchDaoShadowPull(action) {
    const radius = Math.max(0, action.radius ?? 0)
    const limit = Math.max(1, Math.min(8, Math.floor(action.count ?? 1)))
    this.enemies.pullLimitedAt(this.player.x, this.player.z, radius, limit, 4, 1 / 60)
    this.effects.spawn(EFFECT_KIND.ring, this.player.x, this.player.z, 0.46, radius, DAO_ACTION_COLORS_2D.spirit)
  }

  _dispatchDaoAttackClone(action) {
    const count = Math.max(1, Math.min(8, Math.floor(action.count ?? 1)))
    const base = action.angle ?? this.player.facing
    const damageMultiplier = Math.max(1, Number.isFinite(action.damageMultiplier)
      ? action.damageMultiplier : 1)
    for (let n = 0; n < count; n++) {
      const angle = base + (n / count) * Math.PI * 2
      this.projectiles.spawn({
        kind: PROJECTILE_KIND.wind,
        x: this.player.x, z: this.player.z,
        dx: Math.cos(angle), dz: Math.sin(angle),
        speed: 12 * this.player.stats.speedProj,
        life: 1.8 * this.player.stats.duration,
        damage: 15 * this.player.level * damageMultiplier,
        radius: 0.38 * this.player.stats.area,
        pierce: 2,
        color: DAO_ACTION_COLORS_2D.spirit,
        tag: 'wind',
      })
    }
  }

  _dispatchDaoAction(action) {
    if (!action) return
    switch (action.type) {
      case DAO_COMBAT_ACTION_2D.swordFan: this._dispatchDaoSwordFan(action); break
      case DAO_COMBAT_ACTION_2D.swordRing: this._dispatchDaoSwordRing(action); break
      case DAO_COMBAT_ACTION_2D.frostField: this._dispatchDaoFrostField(action); break
      case DAO_COMBAT_ACTION_2D.frostSlow: this._dispatchDaoFrostSlow(action); break
      case DAO_COMBAT_ACTION_2D.frostWall: this._dispatchDaoFrostWall(action); break
      case DAO_COMBAT_ACTION_2D.frostDeathShards: this._dispatchDaoDeathShards(action); break
      case DAO_COMBAT_ACTION_2D.spiritPickup: this._dispatchDaoSpiritPickup(action); break
      case DAO_COMBAT_ACTION_2D.spiritOvercharge: this._dispatchDaoOvercharge(action); break
      case DAO_COMBAT_ACTION_2D.spiritPurge: this._dispatchDaoPurge(action); break
      case DAO_COMBAT_ACTION_2D.spiritShadowPull: this._dispatchDaoShadowPull(action); break
      case DAO_COMBAT_ACTION_2D.spiritAttackClone: this._dispatchDaoAttackClone(action); break
      default: return
    }
    this.onDaoAction?.(action)
  }

  _syncDaoOvercharge() {
    if (this._daoOverchargeBoost && !this.daoRuntime?.overchargeActive) {
      this._daoOverchargeBoost = null
      this.player.daoRuntimeBoost = null
      this.player.recomputeStats()
    }
  }

  _runDaoFixedTick({ runEnded = false } = {}) {
    if (!this.daoRuntime) return []
    this._drainPendingDaoDeaths()
    const input = this._daoTickInput ?? {}
    input.moving = Boolean(this._daoMoving)
    input.isMoving = input.moving
    input.moveSpeed = this.player.actualSpeed
    input.x = this.player.x
    input.z = this.player.z
    input.movementId = `move:${this._daoTickIndex}`
    input.dash = this._daoDashEvent
    input.pickups = this._daoPickupEvents
    input.frozenDeaths = this._daoDeathEvents
    input.runEnded = runEnded
    this._daoTickInput = input
    const actions = this.daoRuntime.fixedTick(input)
    this._daoTickComplete = true
    this._daoLastActions = actions
    for (const action of actions) this._dispatchDaoAction(action)
    this._syncDaoOvercharge()
    this._daoDashEvent = null
    this._daoPickupEvents.length = 0
    this._daoDeathEvents.length = 0
    return actions
  }

  _spawnBoss(id) {
    const def = BOSS_DEFS[id]
    if (!def || this.boss?.active) return false
    this.bossZoneFields.length = 0
    if (id === this.finalBossId) {
      // The final boss must enter as a legible encounter, not underneath the
      // accumulated 330-second crowd and its old bullets.
      this.enemies.purgeOnScreen(this.player)
      this.flushEnemyDeaths({ pending: true })
      this.projectiles.clearHostile()
      this.player.invulnTimer = Math.max(this.player.invulnTimer, 2)
    }
    const angle = this.rng.angle()
    const hpScale = this.stage?.hpScale ?? 1
    this.boss = {
      active: true, def, x: this.player.x + Math.cos(angle) * 16, z: this.player.z + Math.sin(angle) * 16,
      prevX: this.player.x + Math.cos(angle) * 16, prevZ: this.player.z + Math.sin(angle) * 16,
      hp: def.hp * TRIAL.hp * hpScale, maxHp: def.hp * TRIAL.hp * hpScale,
      hitFlash: 0, hitCd: 0, attackCd: 1.8, castTimer: 0, castDuration: 0.58,
      pendingPattern: null, lastPattern: null, patternColor: def.color,
      patternId: null, patternPhase: null, patternVowId: null, patternIntent: null,
      audioEventIds: new Set(), hitAudioSequence: 0,
      spawnedAt: this.runTime, phase: 0, reliefGateIndex: 0,
      castOriginX: null, castOriginZ: null, castTargetX: null, castTargetZ: null,
      castAngle: null, castDirection: null, recoveryUntil: 0,
    }
    this.effects.spawn(EFFECT_KIND.ring, this.boss.x, this.boss.z, 0.9, 5.5, def.color)
    this.onBossWarning?.(def, { final: id === this.finalBossId })
    return true
  }

  spawnBoss(id = 'jadeVoidWarden') {
    return this._spawnBoss(id)
  }

  damageBoss(rawDamage, tag, context = null) {
    const boss = this.boss
    if (!boss?.active) return
    const result = rollDamage(rawDamage, this.player.stats, tag, this.rng)
    // A complete endgame build can enter with hundreds of overlapping fields
    // and erase 14k HP before one authored tell completes. Only the real 330s
    // encounter receives phase floors; manual QA spawns at t=0 stay direct.
    let floorHp = 0
    const scheduledFinal = boss.def.id === this.finalBossId && boss.spawnedAt >= 330 - 1e-6
    if (scheduledFinal) {
      const elapsed = Math.max(0, this.runTime - boss.spawnedAt)
      floorHp = elapsed < FINAL_BOSS_PHASE_GATE_SECONDS_2D[0] ? boss.maxHp * 0.67
        : elapsed < FINAL_BOSS_PHASE_GATE_SECONDS_2D[1] ? boss.maxHp * 0.34
          : elapsed < FINAL_BOSS_PHASE_GATE_SECONDS_2D[2] ? boss.maxHp * 0.01 : 0
    }
    const hpBefore = boss.hp
    boss.hp = Math.max(floorHp, boss.hp - result.amount)
    const appliedDamage = Math.max(0, hpBefore - boss.hp)
    this.runStats.damageDealt += appliedDamage
    boss.hitFlash = 0.16
    this.effects.spawn(EFFECT_KIND.hit, boss.x, boss.z, 0.22, result.crit ? 2.6 : 1.8, colorForTag(tag))
    if (context?.behavior) {
      this._emitWeaponAudio('impact', context.behavior, `boss:${context.sourceId ?? boss.hitAudioSequence}`, {
        targetId: boss.def.id, damage: appliedDamage, crit: result.crit,
      })
    }
    // A scheduled phase floor can absorb the entire roll while still emitting
    // the weapon's shield/impact feedback. It is not an actual boss hit, so do
    // not teach the player that damage landed when `appliedDamage` is zero.
    if (appliedDamage > 0) {
      this._emitBossAudio('hit', boss, null, { damage: appliedDamage, crit: result.crit })
    }
    if (boss.hp > 0) return
    boss.hp = 0
    boss.active = false
    this.bossZoneFields.length = 0
    this.runStats.bossKills++
    this.player.stones += 40 * (this.stage?.stoneScale ?? 1)
    // Boss victory needs a readable release beat. Without one, leftover
    // projectiles and the uninterrupted wave can kill a low-health player
    // after the boss is already dead, which feels like the game ignored the
    // accomplishment. Give a bounded heal, clear boss bullets and let the
    // death shockwave open breathing room without deleting the whole map.
    this.player.heal(this.player.maxHp * BOSS_DEFEAT_HEAL_FRACTION_2D, 'boss')
    this.player.invulnTimer = Math.max(this.player.invulnTimer, BOSS_DEFEAT_GRACE_SECONDS_2D)
    this.projectiles.clearHostile()
    this.enemies.damageAt(
      boss.x,
      boss.z,
      BOSS_DEFEAT_SHOCKWAVE_RADIUS_2D,
      120 + this.player.level * 12,
      'array',
    )
    this.effects.spawn(EFFECT_KIND.death, boss.x, boss.z, 1, 6, boss.def.color)
    this._emitBossAudio('death', boss, null, { damage: appliedDamage, crit: result.crit })
    if (boss.def.id === this.finalBossId) {
      this.victory = true
      if (scheduledFinal && this.runTime < RUN_SECONDS_2D) {
        // The authored run ends at exactly 7:00. Once the judge has defeated
        // the final boss, make the brief remaining beat a safe victory lap
        // instead of allowing a stray horde projectile to steal the result.
        this.player.invulnTimer = Math.max(
          this.player.invulnTimer,
          RUN_SECONDS_2D - this.runTime + 0.25,
        )
      } else {
        // Manual QA spawns and an edge-case kill on the boundary still resolve
        // immediately; only the scheduled contest encounter waits for 7:00.
        this._pendingEnd = true
      }
    }
  }

  _spawnBossZoneField(event, damage, nextHitAt = this.runTime) {
    if (event?.patternType !== 'zone') return
    const linger = Math.max(0, Number(event.geometry?.lingerSeconds) || 0)
    const activeUntil = Number.isFinite(event.activeUntil) ? event.activeUntil : this.runTime
    this.bossZoneFields.push({
      event,
      damage,
      expiresAt: activeUntil + linger,
      nextHitAt,
    })
  }

  _updateBossZoneFields() {
    if (this.bossZoneFields.length === 0) return
    if (!this.player.alive) {
      this.bossZoneFields.length = 0
      return
    }
    for (let index = this.bossZoneFields.length - 1; index >= 0; index--) {
      const field = this.bossZoneFields[index]
      if (this.runTime > field.expiresAt + 1e-6) {
        this.bossZoneFields.splice(index, 1)
        continue
      }
      if (this.runTime + 1e-6 < field.nextHitAt) continue
      const hit = bossPointInsideZone2D(field.event, this.player.x, this.player.z)
      if (hit) {
        if (this.player.takeDamage(field.damage)) this.shake = Math.max(this.shake, 0.8)
        // Player mercy i-frames are 0.68s; matching that cadence lets a
        // lingering field matter without turning one telegraph into a burst.
        field.nextHitAt = this.runTime + MERCY_IFRAMES
      } else {
        field.nextHitAt = this.runTime + 0.1
      }
    }
  }

  _updateBoss(dt) {
    this._updateBossZoneFields()
    for (const entry of this.bossSchedule) {
      const scheduleKey = `${entry.slot}:${entry.id}`
      if (this.runTime >= entry.t && !this.spawnedBosses.has(scheduleKey)) {
        // Only consume a schedule entry after a boss really entered the world.
        // If the mid-boss is still alive at the final threshold, the final boss
        // remains pending and is retried on the next fixed tick after the slot
        // becomes available.
        if (this._spawnBoss(entry.id)) this.spawnedBosses.add(scheduleKey)
      }
    }
    const boss = this.boss
    if (!boss?.active) return
    const scheduledFinal = boss.def.id === this.finalBossId && boss.spawnedAt >= 330 - 1e-6
    if (scheduledFinal) {
      const elapsed = Math.max(0, this.runTime - boss.spawnedAt)
      while (
        boss.reliefGateIndex < FINAL_BOSS_PHASE_GATE_SECONDS_2D.length
        && elapsed + 1e-6 >= FINAL_BOSS_PHASE_GATE_SECONDS_2D[boss.reliefGateIndex]
      ) {
        boss.reliefGateIndex++
        this.player.heal(
          this.player.maxHp * FINAL_BOSS_PHASE_RELIEF_HEAL_FRACTION_2D,
          'boss-phase',
        )
        this.player.invulnTimer = Math.max(
          this.player.invulnTimer,
          FINAL_BOSS_PHASE_RELIEF_GRACE_SECONDS_2D,
        )
        this.projectiles.clearHostile()
        this.bossZoneFields.length = 0
        this.effects.spawn(EFFECT_KIND.ring, this.player.x, this.player.z, 0.5, 3.4, 0x73e3bd)
      }
    }
    boss.prevX = boss.x
    boss.prevZ = boss.z
    boss.hitFlash = Math.max(0, boss.hitFlash - dt)
    boss.castTimer = Math.max(0, boss.castTimer - dt)
    boss.hitCd = Math.max(0, boss.hitCd - dt)
    if (!boss.pendingPattern) boss.attackCd -= dt
    const dx = this.player.x - boss.x
    const dz = this.player.z - boss.z
    const dist = Math.hypot(dx, dz) || 1
    // The cast origin is part of the attack contract.  Freeze the boss for
    // the whole telegraph so the marker, projectiles and collision all keep
    // the same world-space origin; this also prevents contact damage from
    // sliding into the player while they are reading a tell.
    const casting = Boolean(boss.pendingPattern)
    if (!casting) {
      boss.x += (dx / dist) * boss.def.speed * TRIAL.speed * dt
      boss.z += (dz / dist) * boss.def.speed * TRIAL.speed * dt
    }
    boss.phase = boss.hp / boss.maxHp < 0.33 ? 2 : boss.hp / boss.maxHp < 0.66 ? 1 : 0
    const rr = boss.def.radius + 0.55
    if (!casting && dist <= rr && boss.hitCd <= 0) {
      if (this.player.takeDamage(boss.def.damage * TRIAL.damage)) this.shake = Math.max(this.shake, 0.7)
      boss.hitCd = 0.9
    }
    if (boss.pendingPattern) {
      boss.castTimer = Math.max(0, boss.pendingPattern.executeAt - this.runTime)
      if (this.runTime + 1e-6 >= boss.pendingPattern.executeAt) {
        this._executeBossPattern(boss, boss.pendingPattern)
        boss.attackCd = Math.max(0.55, boss.pendingPattern.recoveryUntil - boss.pendingPattern.activeUntil)
        boss.recoveryUntil = boss.pendingPattern.recoveryUntil
        boss.pendingPattern = null
      }
    } else if (boss.attackCd <= 0) {
      let mirrorPatternMetadata = null
      if (boss.def.id === 'jadeVoidWarden' && this.daoVows) {
        try {
          mirrorPatternMetadata = typeof this.daoVows.getMirrorPatternMetadata === 'function'
            ? this.daoVows.getMirrorPatternMetadata()
            : this.daoVows.mirrorPattern ?? null
        } catch {
          // A malformed optional Dao provider must not stop the fixed-tick
          // combat loop; BossPatterns2D will use its safe radial fallback.
          mirrorPatternMetadata = null
        }
      }
      const vowId = boss.def.id === 'jadeVoidWarden'
        ? (this.daoVows?.vowId ?? mirrorPatternMetadata?.vowId ?? 'sword')
        : boss.def.id === 'riverMaiden' ? 'frost'
          : boss.def.id === 'darkHeavenLord' ? 'spirit' : 'sword'
      const event = nextBossPatternEvent2D({
        phase: boss.phase + 1,
        time: this.runTime,
        seed: (this.rng.seed ^ Math.floor(boss.spawnedAt * 60) ^ Math.floor(this.runTime * 10)) >>> 0,
        vowId,
        mirrorPatternMetadata,
      })
      const pendingPattern = {
        ...event,
        targetX: this.player.x,
        targetZ: this.player.z,
        castTargetX: this.player.x,
        castTargetZ: this.player.z,
        castOriginX: boss.x,
        castOriginZ: boss.z,
        castOrigin: { x: boss.x, z: boss.z },
        castAngle: Number.isFinite(event.geometry?.angle) ? event.geometry.angle : 0,
        castDirection: event.geometry?.direction
          ? { x: event.geometry.direction.x, z: event.geometry.direction.z }
          : { x: 1, z: 0 },
      }
      if (pendingPattern.patternType === 'zone') {
        pendingPattern.zoneInstances = bossZoneInstances2D(pendingPattern)
      }
      boss.pendingPattern = pendingPattern
      boss.castOriginX = pendingPattern.castOriginX
      boss.castOriginZ = pendingPattern.castOriginZ
      boss.castTargetX = pendingPattern.castTargetX
      boss.castTargetZ = pendingPattern.castTargetZ
      boss.castAngle = pendingPattern.castAngle
      boss.castDirection = pendingPattern.castDirection
      boss.lastPattern = boss.pendingPattern
      boss.patternId = event.patternId
      boss.patternPhase = event.phase
      boss.patternVowId = event.vowId
      boss.castDuration = event.telegraphDuration
      boss.castTimer = event.telegraphDuration
      boss.patternColor = Number.isFinite(event.paletteColor)
        ? event.paletteColor
        : vowId === 'frost' ? 0x9ee8ff : vowId === 'spirit' ? 0xc88cff : 0xeaf6ff
      boss.patternIntent = event.intent ?? null
      if (pendingPattern.patternType === 'zone') {
        for (const instance of pendingPattern.zoneInstances) {
          const radius = instance.shape === 'circle'
            ? instance.radius : Math.max(instance.width * 0.5, instance.length * 0.5)
          this.effects.spawn(
            EFFECT_KIND.ring, instance.x, instance.z, event.telegraphDuration,
            radius, boss.patternColor,
          )
        }
      } else {
        const origin = bossPatternOrigin2D(pendingPattern)
        this.effects.spawn(
          EFFECT_KIND.ring, origin.x, origin.z, event.telegraphDuration,
          bossTelegraphRadius2D(pendingPattern, boss.phase), boss.patternColor,
        )
      }
      this._emitBossAudio('telegraph', boss, boss.pendingPattern, {
        damage: boss.def.damage * event.damageMultiplier * TRIAL.damage,
      })
    }
  }

  _executeBossPattern(boss, event) {
    const damage = boss.def.damage * event.damageMultiplier * TRIAL.damage
    this._emitBossAudio('impact', boss, event, { damage, crit: false })
    const color = boss.patternColor ?? boss.def.color
    const geometry = event.geometry ?? {}
    if (event.patternType === 'zone') {
      const hit = bossPointInsideZone2D(event, this.player.x, this.player.z)
      if (hit && this.player.takeDamage(damage)) this.shake = Math.max(this.shake, 0.8)
      for (const instance of bossZoneInstances2D(event)) {
        const radius = instance.shape === 'circle'
          ? instance.radius : Math.max(instance.width * 0.5, instance.length * 0.5)
        this.effects.spawn(EFFECT_KIND.lightning, instance.x, instance.z, 0.42, radius, color)
      }
      this._spawnBossZoneField(event, damage, this.runTime + (hit ? MERCY_IFRAMES : 0.1))
      return
    }

    const origin = bossPatternOrigin2D(event)
    const castAngle = bossPatternAngle2D(event)
    const speed = Math.max(0.1, Number(geometry.projectileSpeed) || (6.5 + boss.phase))
    const directionX = Math.cos(castAngle)
    const directionZ = Math.sin(castAngle)
    const lateralX = -directionZ
    const lateralZ = directionX

    if (event.patternType === 'line') {
      const length = Math.max(0.1, Number(geometry.length) || 13)
      const width = Math.max(0.1, Number(geometry.width) || 1.05)
      const shots = Math.max(1, Math.min(16, Math.trunc(Number(geometry.projectileCount) || Math.ceil(width * 2))))
      const life = Math.min(4, Math.max(0.15, length / speed + 0.35))
      for (let n = 0; n < shots; n++) {
        const offset = shots === 1 ? 0 : (n / (shots - 1) - 0.5) * width
        this.projectiles.spawn({
          kind: PROJECTILE_KIND.hostile,
          x: origin.x + lateralX * offset,
          z: origin.z + lateralZ * offset,
          dx: directionX,
          dz: directionZ,
          speed,
          life,
          damage,
          radius: Math.max(0.34, width * 0.38),
          hostile: true,
          color,
          tag: 'hostile',
        })
      }
    } else if (event.patternType === 'cone') {
      const length = Math.max(0.1, Number(geometry.length) || 11.5)
      const innerRadius = Math.max(0, Number(geometry.innerRadius) || 0)
      const arc = Math.max(0.1, Number(geometry.arcRadians) || 0.8)
      const shots = Math.max(3, Math.min(16, Math.trunc(Number(geometry.projectileCount) || (5 + boss.phase * 3))))
      const life = Math.min(4, Math.max(0.15, length / speed + 0.35))
      for (let n = 0; n < shots; n++) {
        const angle = castAngle + (shots === 1 ? 0 : (n / (shots - 1) - 0.5) * arc)
        const startX = origin.x + Math.cos(angle) * innerRadius
        const startZ = origin.z + Math.sin(angle) * innerRadius
        this.projectiles.spawn({
          kind: PROJECTILE_KIND.hostile,
          x: startX,
          z: startZ,
          dx: Math.cos(angle),
          dz: Math.sin(angle),
          speed,
          life,
          damage,
          radius: 0.42,
          hostile: true,
          color,
          tag: 'hostile',
        })
      }
    } else if (event.patternType === 'orbit') {
      const projectileCount = Math.max(1, Math.min(24,
        Math.trunc(Number(geometry.projectileCount) || 4)))
      const cloneCount = Math.max(0, Math.min(4, Math.trunc(Number(geometry.cloneCount) || 0)))
      const layers = Math.max(1, Math.min(cloneCount + 1, Math.floor(24 / projectileCount) || 1))
      const baseAngles = Array.isArray(geometry.shotAngles) && geometry.shotAngles.length > 0
        ? geometry.shotAngles : Array.from(
          { length: projectileCount }, (_, index) => castAngle + BOSS_PATTERN_TAU_2D * index / projectileCount,
        )
      const radius = Math.max(0.5, Number(geometry.radius) || 4.2)
      const activeSeconds = Math.max(0.5, Number(event.activeDuration) || 0.5)
      const orbitSpeed = (Math.max(0.1, Number(geometry.orbitTurns) || 0.5)
        * BOSS_PATTERN_TAU_2D) / activeSeconds
      for (let layer = 0; layer < layers; layer++) {
        const layerOffset = layers === 1 ? 0 : layer * BOSS_PATTERN_TAU_2D / (projectileCount * layers)
        for (let n = 0; n < projectileCount && layer * projectileCount + n < 24; n++) {
          const angle = Number(baseAngles[n % baseAngles.length]) + layerOffset
          this.projectiles.spawn({
            kind: PROJECTILE_KIND.hostile,
            x: origin.x,
            z: origin.z,
            dx: Math.cos(angle),
            dz: Math.sin(angle),
            speed,
            life: Math.max(1.4, activeSeconds + 0.75),
            damage,
            radius: 0.42,
            hostile: true,
            color,
            tag: 'hostile',
            orbit: true,
            orbitAngle: angle,
            orbitRadius: radius + layer * 0.45,
            orbitSpeed,
          })
        }
      }
    } else {
      const shots = Math.max(1, Math.min(32,
        Math.trunc(Number(geometry.projectileCount) || (5 + boss.phase * 3))))
      const startAngle = Number.isFinite(geometry.startAngle) ? geometry.startAngle : castAngle
      const angleStep = Number.isFinite(geometry.angleStep)
        ? geometry.angleStep : BOSS_PATTERN_TAU_2D / shots
      for (let n = 0; n < shots; n++) {
        const angle = startAngle + n * angleStep
        this.projectiles.spawn({
          kind: PROJECTILE_KIND.hostile,
          x: origin.x,
          z: origin.z,
          dx: Math.cos(angle),
          dz: Math.sin(angle),
          speed,
          life: 4,
          damage,
          radius: 0.42,
          hostile: true,
          color,
          tag: 'hostile',
        })
      }
    }
    this.effects.spawn(
      EFFECT_KIND.lightning, origin.x, origin.z, 0.34,
      bossTelegraphRadius2D(event, boss.phase), color,
    )
  }

  _spawnFormation(event) {
    if (!event || MAX_ENEMIES_2D - this.enemies.count < event.count) return false
    // A scheduled formation that lands during the final duel would compete
    // with the boss telegraph and safe-space language. Acknowledge it without
    // spawning; ambient adds continue at the bounded final-encounter density.
    if (this.boss?.active && this.boss.def.id === this.finalBossId) return true
    let spawned = 0
    this.formations.forEachMember(event, (_index, x, z) => {
      if (this.enemies.spawn(event.type, x, z, this.runTime, 1, event.haste)) spawned++
    })
    if (spawned !== event.count) return false
    this.runStats.formations = (this.runStats.formations ?? 0) + 1
    this.effects.spawn(EFFECT_KIND.ring, event.centerX, event.centerZ, 0.9, event.radius, 0xf2c76f)
    this.onFormation?.(event)
    return true
  }

  _aim() {
    // A boss is the current combat objective. Dense endless waves otherwise
    // keep nearest-enemy auto aim locked on fodder forever, leaving the boss
    // alive to overlap the player and making the encounter feel unwinnable.
    if (this.boss?.active) {
      return { dx: this.boss.x - this.player.x, dz: this.boss.z - this.player.z }
    }
    const i = this.enemies.nearest(this.player.x, this.player.z)
    if (i >= 0) return { dx: this.enemies.x[i] - this.player.x, dz: this.enemies.z[i] - this.player.z }
    return { dx: Math.sin(this.player.facing), dz: Math.cos(this.player.facing) }
  }

  _emitWeaponAudio(stage, behavior, sourceId = 'world', details = {}) {
    // Dao actions own their initial cue in Game2D.  Suppress persistent/status
    // callbacks here so a single field does not speak once on spawn and again
    // on every simulation tick.
    if (behavior?.daoAction) return false
    if (!behavior?.audio || !WEAPON_AUDIO_COOLDOWN_2D[stage]) {
      if (stage !== 'launch' || !behavior?.audio) return false
    }
    const audio = behavior.audio ?? {}
    const weaponId = behavior.weaponId ?? behavior.id ?? audio.weaponId ?? 'unknown'
    const kind = audio.kind ?? 'generic'
    const tag = audio.tag ?? behavior.tag ?? 'unknown'
    const cooldown = WEAPON_AUDIO_COOLDOWN_2D[stage] ?? 0
    const now = Number.isFinite(this.runTime) ? this.runTime : 0
    const source = String(sourceId ?? 'world')
    const key = `${stage}:${weaponId}:${source}`
    const last = this.weaponAudioLastAt.get(key)
    if (last != null && now - last < cooldown - 1e-9) return false
    this.weaponAudioLastAt.set(key, now)

    const cue = stage === 'launch'
      ? audio.launchCue
      : stage === 'impact' ? audio.impactCue
        : stage === 'field' ? (audio.fieldCue ?? audio.impactCue)
          : (audio.statusCue ?? audio.impactCue)
    const eventId = `weapon:${weaponId}:${stage}:${source}:${Math.round(now * 1000)}`
    const audioContract = Object.freeze({ ...audio, kind, weaponId, tag })
    const event = Object.freeze({
      eventId,
      stage,
      cue: cue ?? null,
      kind,
      weaponId,
      tag,
      audio: audioContract,
      sourceId: source,
      cooldown,
      ...details,
    })
    this.weaponAudioEvents[this.weaponAudioCount % this.weaponAudioEvents.length] = event
    this.weaponAudioCount++
    this.onWeaponAudio?.(event, cue ?? null, audioContract)
    return true
  }

  _bossPatternForAudio(boss) {
    return boss?.pendingPattern ?? boss?.lastPattern ?? null
  }

  _emitBossAudio(stage, boss, pattern = null, details = {}) {
    if (!boss) return false
    const eventPattern = pattern ?? this._bossPatternForAudio(boss)
    const patternKey = eventPattern?.id ?? boss.patternEventId ?? `boss:${boss.def.id}`
    const sequence = stage === 'hit'
      ? `${stage}:${boss.hitAudioSequence++}`
      : stage
    const eventId = `boss:${patternKey}:${sequence}`
    boss.audioEventIds ??= new Set()
    if (boss.audioEventIds.has(eventId)) return false
    boss.audioEventIds.add(eventId)
    const event = Object.freeze({
      eventId,
      stage,
      patternId: eventPattern?.patternId ?? boss.patternId ?? null,
      phase: eventPattern?.phase ?? boss.patternPhase ?? boss.phase + 1,
      vowId: eventPattern?.vowId ?? boss.patternVowId ?? null,
      intent: eventPattern?.intent ?? boss.patternIntent ?? null,
      crit: Boolean(details.crit),
      damage: Number.isFinite(details.damage) ? details.damage : 0,
      final: boss.def.id === this.finalBossId,
    })
    if (stage === 'telegraph') this.onBossTelegraph?.(event)
    else if (stage === 'impact') this.onBossImpact?.(event)
    else if (stage === 'hit') this.onBossHit?.(event)
    else if (stage === 'death') this.onBossDeath?.(event)
    return true
  }

  _recordWeaponBehavior(id, behavior) {
    this.weaponBehaviorUsage.add(id)
    this.weaponBehaviorAxesUsed.set(id, behavior.identityAxes)
    this.onWeaponBehavior?.(id, behavior)
  }

  _spawnWeaponField(behavior, x, z, area, damage, tag) {
    const residual = behavior.residualField
    const life = residual.lifetimeSeconds ?? behavior.trajectory.lifetimeSeconds ?? 2.4
    const kind = residual.kind === 'fire' ? 2 : residual.kind === 'poison' ? 3 : residual.kind === 'void' ? 4 : 1
    const pullRadius = behavior.statusEffects?.pull?.enabled ? 4.2 : 0
    const spawned = this.weaponFields.spawn({
      behavior,
      x,
      z,
      radius: Math.max(0.8, pullRadius * area, (residual.radiusScale || behavior.collision.radiusScale || 1) * area),
      life: Math.max(0.2, life * this.player.stats.duration),
      damage,
      tag,
      kind,
      color: colorForTag(tag),
    })
    if (spawned) this._emitWeaponAudio('field', behavior, `field:${this.weaponFields.lastSpawnAudioSourceId}`)
  }

  _spawnFan(def, level, kind, amountMul = 1, behavior = null) {
    const descriptor = behavior ?? getWeaponBehavior2D(def.id, level)
    const cfg = descriptor?.levelData ?? def.levels[Math.min(level - 1, def.levels.length - 1)]
    const trajectory = descriptor?.trajectory ?? {}
    const collision = descriptor?.collision ?? {}
    const aim = this._aim()
    const base = Math.atan2(aim.dz, aim.dx)
    const dao = this.player.daoModifiers ?? {}
    const swordBonus = def.tag === 'sword' ? (dao.swordFanProjectileAdd ?? 0) : 0
    const authoredCount = trajectory.count ?? cfg.amount ?? cfg.count ?? 1
    const amount = Math.max(1, Math.round(authoredCount + this.player.stats.amount + swordBonus)) * amountMul
    for (let n = 0; n < amount; n++) {
      const spreadWidth = Math.min(
        trajectory.kind === 'spread' ? 1.45 : 1.1,
        amount * 0.075 + (def.tag === 'sword' ? (dao.swordFanSpreadAdd ?? 0) : 0),
      )
      const spread = amount === 1 ? 0 : (n / (amount - 1) - 0.5) * spreadWidth
      const angle = base + spread
      this.projectiles.spawn({
        kind, x: this.player.x, z: this.player.z, dx: Math.cos(angle), dz: Math.sin(angle),
        speed: (trajectory.speed ?? cfg.speed ?? 16) * this.player.stats.speedProj,
        life: (trajectory.lifetimeSeconds ?? cfg.duration ?? 2.4) * this.player.stats.duration,
        // Store raw weapon damage. EnemyField2D.damageOne/damageBoss is the
        // single authoritative roll site for might, tag bonuses and criticals.
        damage: collision.damage ?? cfg.damage,
        radius: 0.34 * (collision.radiusScale ?? cfg.area ?? 1) * this.player.stats.area,
        pierce: (collision.pierce ?? cfg.pierce ?? 1) + (dao.projectilePierceAdd ?? 0),
        color: colorForTag(def.tag), tag: def.tag, behavior: descriptor,
        returning: Boolean(trajectory.returning),
      })
    }
  }

  _fireWeapon(id, level) {
    const def = getWeapon(id)
    if (!def) return 1
    const behavior = getWeaponBehavior2D(id, level)
    if (!behavior) return Math.max(0.08, (def.levels[Math.min(level - 1, def.levels.length - 1)]?.cooldown ?? 1) * this.player.stats.cooldown)
    this._recordWeaponBehavior(id, behavior)
    const castId = `cast:${++this.weaponAudioCastSequence}`
    this._emitWeaponAudio('launch', behavior, castId)
    this.player.attackTimer = Math.max(this.player.attackTimer, 0.32)
    const cfg = behavior.levelData
    const trajectory = behavior.trajectory
    const collision = behavior.collision
    const effects = behavior.statusEffects
    const area = (collision.radiusScale ?? cfg.area ?? 1) * this.player.stats.area
    const tag = behavior.tag
    const kind = tag === 'fire' ? PROJECTILE_KIND.fire
      : tag === 'ice' ? PROJECTILE_KIND.ice
        : id === 'hiddenNeedles' || id === 'needleStorm' ? PROJECTILE_KIND.needle
          : id === 'windBlade' || effects.return?.enabled ? PROJECTILE_KIND.wind : PROJECTILE_KIND.sword

    if (behavior.residualField.enabled) {
      // Inferno Sea keeps its authored outbound trajectory and also leaves a
      // bounded field. Ground-array weapons spend their whole cast in the
      // persistent fixed pool.
      if (trajectory.kind === 'lob' || trajectory.kind === 'spread') {
        this._spawnFan(def, level, kind, id === 'myriadSwords' ? 2 : 1, behavior)
      }
      const target = this.enemies.nearest(this.player.x, this.player.z, 18)
      const fieldX = target >= 0 ? this.enemies.x[target] : this.player.x
      const fieldZ = target >= 0 ? this.enemies.z[target] : this.player.z
      this.enemies.damageAt(
        fieldX, fieldZ, Math.max(1.2, area * 2.4), collision.damage, tag, behavior, castId,
      )
      this._spawnWeaponField(behavior, fieldX, fieldZ, area, collision.damage, tag)
      this.effects.spawn(EFFECT_KIND.ring, fieldX, fieldZ, 0.34, 4.2 * area, colorForTag(tag))
    } else if (effects.pull?.enabled) {
      // The void orb is an anchor, not a contact hit: enemies are drawn
      // toward the player's deterministic cast point for its lifetime.
      const fieldX = this.player.x
      const fieldZ = this.player.z
      this._spawnWeaponField(behavior, fieldX, fieldZ, area, collision.damage, tag)
      this.effects.spawn(EFFECT_KIND.ring, fieldX, fieldZ, 0.4, 4.2 * area, colorForTag(tag))
    } else if (trajectory.orbit) {
      const count = Math.max(1, Math.round(trajectory.count + this.player.stats.amount))
      const radius = Math.max(1.2, 4.2 * area)
      const orbitSpeed = Math.max(0.4, trajectory.speed ?? 2.2)
      for (let n = 0; n < count; n++) {
        const angle = (n / count) * Math.PI * 2
        this.projectiles.spawn({
          kind: PROJECTILE_KIND.thunder,
          x: this.player.x + Math.cos(angle) * radius,
          z: this.player.z + Math.sin(angle) * radius,
          dx: -Math.sin(angle), dz: Math.cos(angle),
          speed: orbitSpeed,
          life: Math.max(1.2, (trajectory.lifetimeSeconds ?? 3) * this.player.stats.duration),
          damage: collision.damage,
          radius: 0.46 * area,
          pierce: collision.pierce ?? 1,
          color: colorForTag(tag), tag, behavior,
          orbit: true, orbitAngle: angle, orbitRadius: radius, orbitSpeed,
        })
      }
      this.effects.spawn(EFFECT_KIND.lightning, this.player.x, this.player.z, 0.28, radius, colorForTag(tag))
    } else if (trajectory.kind === 'cone') {
      const x = this.player.x + Math.sin(this.player.facing) * 3.2
      const z = this.player.z + Math.cos(this.player.facing) * 3.2
      this.enemies.damageAt(x, z, Math.max(1.2, 3.1 * area), collision.damage, tag, behavior, castId)
      this.effects.spawn(EFFECT_KIND.ring, x, z, 0.42, 3.4 * area, colorForTag(tag))
    } else if (collision.kind === 'ring' || trajectory.kind === 'radial') {
      const radius = Math.max(1.5, (collision.kind === 'ring' ? 8 : 4.2) * area)
      this.enemies.damageAt(this.player.x, this.player.z, radius, collision.damage, tag, behavior, castId)
      this.effects.spawn(EFFECT_KIND.lightning, this.player.x, this.player.z, 0.28, radius, colorForTag(tag))
    } else if (trajectory.kind === 'groundBurst' || trajectory.kind === 'targetMarker') {
      const strikes = Math.max(1, Math.round((trajectory.count ?? cfg.amount ?? 1) + this.player.stats.amount))
      for (let n = 0; n < strikes; n++) {
        const i = this.enemies.nearest(this.player.x + this.rng.range(-8, 8), this.player.z + this.rng.range(-8, 8), 20)
        if (i < 0) continue
        this.enemies.damageAt(
          this.enemies.x[i], this.enemies.z[i], 1.4 * area, collision.damage, tag, behavior, castId,
        )
        this.effects.spawn(EFFECT_KIND.lightning, this.enemies.x[i], this.enemies.z[i], 0.25, 1.8 * area, colorForTag(tag))
      }
    } else {
      this._spawnFan(def, level, kind, id === 'myriadSwords' ? 2 : 1, behavior)
    }
    return Math.max(0.08, (cfg.cooldown ?? 1) * this.player.stats.cooldown)
  }

  _updateWeapons(dt) {
    for (const { id, level } of this.weaponCache) {
      let timer = (this.weaponTimers.get(id) ?? 0) - dt
      if (timer <= 0) timer += this._fireWeapon(id, level)
      this.weaponTimers.set(id, timer)
    }
  }

  update(dt, input) {
    if (this.ended) return
    this._daoTickIndex++
    this._daoTickComplete = false
    this._daoDashEvent = null
    this._daoPickupEvents.length = 0
    this._daoDeathEvents.length = 0
    this._drainPendingDaoDeaths()
    this.runTime += dt
    const pacingEvents = this.pacing.advance(dt)
    let hardTimeout = false
    for (const event of pacingEvents) {
      this.onPacingMilestone?.(event)
      if (event.id === CONTEST_PACING_MILESTONE_2D.hardTimeout) hardTimeout = true
    }
    // The pacing director clamps its own clock to 420 seconds, so the world
    // result must use that same authoritative boundary even when a render tick
    // crosses it (for example 419.999 -> 420.0167).
    if (hardTimeout) this.runTime = RUN_SECONDS_2D
    this.shake = Math.max(0, this.shake - dt * 2.8)
    this._daoMoving = Boolean(input?.moveX || input?.moveZ)
    this.player.update(dt, input)
    this.formations.update(this.runTime, { player: this.player }, (event) => this._spawnFormation(event))
    this.enemies.update(dt, this.runTime, this.player)
    this._updateBoss(dt)
    this._updateWeapons(dt)
    this.projectiles.update(dt)
    this.weaponFields.update(dt)
    this.flushEnemyDeaths()
    this.pickups.update(dt, this.player, (levels) => {
      this.pendingLevels += levels
      this.onLevels?.(levels)
    }, (pickup) => this._daoPickupEvents.push(pickup))
    this.effects.update(dt)
    const requestedEnd = this._pendingEnd
      ?? (!this.player.alive ? false : hardTimeout ? this.victory : null)
    this._runDaoFixedTick({ runEnded: requestedEnd !== null })
    if (requestedEnd !== null && !this.ended) this._end(requestedEnd)
  }

  purge() {
    this.enemies.purgeOnScreen(this.player)
    this.flushEnemyDeaths({ pending: true })
  }

  _end(victory) {
    if (this.ended) return
    if (!this._daoTickComplete && this.daoRuntime?.active) {
      this._runDaoFixedTick({ runEnded: true })
    }
    this.ended = true
    this.victory = victory
    this._pendingEnd = null
    this.onEnd?.(victory)
  }

  endRun(victory = false) {
    if (this.ended) return false
    this._daoTickComplete = false
    this._runDaoFixedTick({ runEnded: true })
    this._end(victory)
    return true
  }
}

export const RenderSnapshot = Object.freeze({
  description: 'Borrowed typed-array views owned by CombatWorld2D; renderers must not mutate them.',
})
