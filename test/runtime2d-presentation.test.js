import { describe, expect, it, vi } from 'vitest'
import {
  PixiPresentation,
  HOSTILE_PROJECTILE_PRESENTATION,
  PROJECTILE_PRESENTATION,
  RUNTIME2D_POOL_LIMITS,
  RUNTIME2D_RENDER_BUDGET,
  WEAPON_VISUAL_SIGNATURES,
  WEAPON_VISUAL_SIGNATURE_IDS,
  WEAPON_FIELD_PRESENTATION,
  projectilePresentationFor,
  projectilePresentationForBehavior,
  hostileProjectileVisualFor,
  projectileTint2D,
  heroDirectionFor,
  directionalHeroFrames,
  bossCombatHeight2D,
  heroCombatHeight2D,
  heroSlashPresentation2D,
  enemyBossFocusAlpha2D,
  enemyHeroOverlapAlpha2D,
  bossIntentLabel2D,
  bossTelegraphProfile2D,
  bossTelegraphWorldShapes2D,
  weaponFieldVisualForBehavior,
  weaponFieldPulse2D,
  enemyActorTint2D,
} from '../src/runtime2d/PixiPresentation.js'
import {
  MAX_PICKUPS_2D,
  MAX_PROJECTILES_2D,
  MAX_WEAPON_FIELDS_2D,
} from '../src/runtime2d/CombatWorld2D.js'
import { WEAPON_BEHAVIOR_IDS_2D, getWeaponBehavior2D } from '../src/runtime2d/WeaponBehaviors2D.js'
import { EVOLUTIONS } from '../src/data/weapons.js'

function fakeParticle() {
  return {
    x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 0, tint: 0, alpha: 0, texture: null,
  }
}

function fakePool(count) {
  return {
    items: Array.from({ length: count }, fakeParticle),
    activeCount: 0,
    setActiveCount(count) { this.activeCount = count },
  }
}

describe('PixiPresentation combat bindings', () => {
  it('keeps atlas-sharing enemy species visually distinct without blackening authored art', () => {
    const wolf = enemyActorTint2D(0x5f7fa8, 'yorang')
    const frostWolf = enemyActorTint2D(0xa8d8ea, 'yorang')
    const ashRaven = enemyActorTint2D(0x8a5a4a, 'yorang')
    expect(new Set([wolf, frostWolf, ashRaven]).size).toBe(3)
    expect(enemyActorTint2D(0xff8a3c, 'wisp')).toBe(0xff8a3c)
    expect(enemyActorTint2D(0x5f7fa8, 'yorang', true)).toBe(0xffb6b6)
    for (const tint of [wolf, frostWolf, ashRaven]) {
      expect((tint >>> 16) & 0xff).toBeGreaterThan(100)
      expect((tint >>> 8) & 0xff).toBeGreaterThan(100)
      expect(tint & 0xff).toBeGreaterThan(100)
    }
  })

  it('keeps combat draw and fixed-pool budgets explicit', () => {
    expect(RUNTIME2D_RENDER_BUDGET.maxDrawCalls).toBeLessThanOrEqual(25)
    expect(RUNTIME2D_POOL_LIMITS.projectiles).toBe(MAX_PROJECTILES_2D)
    expect(RUNTIME2D_POOL_LIMITS.pickups).toBe(MAX_PICKUPS_2D)
    expect(RUNTIME2D_POOL_LIMITS.weaponFields).toBe(MAX_WEAPON_FIELDS_2D)
  })

  it('defines seven atlas-backed friendly families with at least two visual axes', () => {
    const kinds = Object.keys(PROJECTILE_PRESENTATION).map(Number)
    expect(kinds).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(new Set(kinds.map((kind) => PROJECTILE_PRESENTATION[kind].family))).toEqual(
      new Set(['sword', 'fire', 'ice', 'thunder', 'void', 'needle', 'wind']),
    )
    expect(new Set(kinds.map((kind) => PROJECTILE_PRESENTATION[kind].frame)).size).toBe(7)
    expect(new Set(kinds.map((kind) => `${PROJECTILE_PRESENTATION[kind].scaleX}:${PROJECTILE_PRESENTATION[kind].scaleY}`)).size)
      .toBeGreaterThanOrEqual(6)
    expect(new Set(kinds.map((kind) => PROJECTILE_PRESENTATION[kind].rotationOffset)).size).toBe(7)
    expect(new Set(kinds.map((kind) => projectileTint2D(kind, 0xd8efff))).size).toBe(7)
    expect(projectilePresentationFor(99).family).toBe('sword')
    expect(projectilePresentationFor(5, true).family).toBe('hostile')
  })

  it('keeps hostile projectile silhouettes separate from wisps and friendly frames', () => {
    expect(HOSTILE_PROJECTILE_PRESENTATION).toHaveLength(4)
    expect(new Set(HOSTILE_PROJECTILE_PRESENTATION.map((visual) => visual.shape)).size).toBe(4)
    expect(new Set(HOSTILE_PROJECTILE_PRESENTATION.map((visual) => visual.frame)).size).toBe(4)

    const presentation = Object.create(PixiPresentation.prototype)
    presentation.time = 0.4
    presentation.cameraX = 0
    presentation.cameraZ = 0
    presentation.viewport = { width: 800, height: 600, zoom: 1 }
    presentation.textures = {
      wisp: 'wisp-texture',
      hostileProjectileFrames: Array.from({ length: 4 }, (_, i) => `hostile-${i}`),
      projectileFrames: Array.from({ length: 7 }, (_, i) => `friendly-${i}`),
    }
    presentation.friendlyProjectilePool = fakePool(1)
    presentation.hostileProjectilePool = fakePool(4)
    presentation.friendlyProjectileContainer = { update: vi.fn() }
    presentation.hostileProjectileContainer = { update: vi.fn() }
    const field = {
      count: 4,
      kind: new Uint8Array([5, 5, 5, 5]),
      hostile: new Uint8Array([1, 1, 1, 1]),
      x: new Float32Array(4), z: new Float32Array(4),
      prevX: new Float32Array(4), prevZ: new Float32Array(4),
      dx: new Float32Array([1, 1, 1, 1]), dz: new Float32Array(4),
      uid: new Uint32Array([0, 1, 2, 3]),
      color: new Uint32Array([0xff7f91, 0xd37dff, 0xff8cc8, 0x9e91ff]),
    }
    presentation._renderProjectiles(field, 1)
    const particles = presentation.hostileProjectilePool.items
    expect(particles.map((particle, index) => particle.texture)).toEqual(
      Array.from({ length: 4 }, (_, index) => `hostile-${hostileProjectileVisualFor(field, index).frame}`),
    )
    expect(presentation.hostileProjectileContainer.update).toHaveBeenCalledTimes(1)
    expect(particles.every((particle) => particle.texture !== 'wisp-texture')).toBe(true)
  })

  it('preserves five unique directional frames when a snapshot facing is stale', () => {
    const frames = {
      seolryeongN: ['north'],
      seolryeongNe: ['north-east'],
      seolryeongE: ['east'],
      seolryeong: ['south-east'],
      seolryeongS: ['south'],
    }
    const directions = [
      heroDirectionFor({ facing: Math.PI / 2, x: 0, prevX: 0, z: -1, prevZ: 0, speed01: 1 }),
      heroDirectionFor({ facing: Math.PI / 2, x: 1, prevX: 0, z: -1, prevZ: 0, speed01: 1 }),
      heroDirectionFor({ facing: 0, x: 1, prevX: 0, z: 0, prevZ: 0, speed01: 1 }),
      heroDirectionFor({ facing: 0, x: 1, prevX: 0, z: 1, prevZ: 0, speed01: 1 }),
      heroDirectionFor({ facing: 0, x: 0, prevX: 0, z: 1, prevZ: 0, speed01: 1 }),
    ]
    expect(directions.map((direction) => direction.key)).toEqual(['n', 'ne', 'e', 'se', 's'])
    expect(new Set(directions.map((direction) => directionalHeroFrames(frames, direction)[0])).size).toBe(5)
  })

  it('keeps the heroine near authored gameplay scale across supported screens', () => {
    expect(heroCombatHeight2D(720, 140)).toBeCloseTo(118)
    expect(heroCombatHeight2D(1080, 140)).toBeCloseTo(176)
    expect(heroCombatHeight2D(1440, 140)).toBeCloseTo(225.8462, 3)
    expect(heroCombatHeight2D(1600, 140)).toBeCloseTo(248)
    expect(heroCombatHeight2D(1080, 160)).toBeGreaterThan(176)
    expect(bossCombatHeight2D(1080, 220, 1)).toBeGreaterThanOrEqual(194.4)
  })

  it('turns the existing sword arc into a directional anticipation-impact-recovery cue', () => {
    const east = heroSlashPresentation2D(Math.PI / 2, 0.16, 176, 32, 12)
    const north = heroSlashPresentation2D(Math.PI, 0.16, 176, 32, 12)
    expect(east.visible).toBe(true)
    expect(east.alpha).toBeGreaterThan(0.8)
    expect(east.offsetX).toBeGreaterThan(0)
    expect(Math.abs(east.offsetY + 176 * 0.42)).toBeLessThan(1)
    expect(north.offsetY).toBeLessThan(east.offsetY)
    expect(north.rotation).toBeLessThan(0)
    expect(heroSlashPresentation2D(0, 0, 176, 32, 12).visible).toBe(false)
  })

  it('fades only enemies that overlap the heroine and restores full opacity nearby', () => {
    expect(enemyHeroOverlapAlpha2D(0)).toBeCloseTo(0.58)
    expect(enemyHeroOverlapAlpha2D(1.4)).toBeCloseTo(0.79)
    expect(enemyHeroOverlapAlpha2D(2.8)).toBe(1)
    expect(enemyHeroOverlapAlpha2D(20)).toBe(1)
    expect(enemyHeroOverlapAlpha2D(Number.NaN)).toBe(1)
  })

  it('keeps boss-local ordinary mobs subordinate without fading elites', () => {
    expect(enemyBossFocusAlpha2D(0, true, false)).toBeCloseTo(0.42)
    expect(enemyBossFocusAlpha2D(7.99, true, false)).toBeLessThan(1)
    expect(enemyBossFocusAlpha2D(8, true, false)).toBe(1)
    expect(enemyBossFocusAlpha2D(0, true, true)).toBe(1)
  })

  it('keeps the static vista and fake horizon layers out of live combat', () => {
    const presentation = Object.create(PixiPresentation.prototype)
    const layer = () => ({ visible: true })
    Object.assign(presentation, {
      backdrop: layer(), backdropWash: layer(), titleHero: layer(), combatSky: layer(),
      combatVista: layer(), farMountains: layer(), nearMountains: layer(), farMist: layer(),
      floor: layer(), mapDecalLayer: layer(), floorRunes: layer(), horizonMist: layer(),
      nearMist: layer(), horizonVeil: layer(), groundLightLayer: layer(), weaponFieldLayer: layer(),
      propPool: [], poiPool: [],
    })

    presentation._setSceneMode(true)

    expect(presentation.floor.visible).toBe(true)
    expect(presentation.mapDecalLayer.visible).toBe(true)
    expect(presentation.combatVista.visible).toBe(false)
    expect(presentation.farMountains.visible).toBe(false)
    expect(presentation.nearMountains.visible).toBe(false)
    expect(presentation.farMist.visible).toBe(false)
  })

  it('maps boss cast intent and separates the wolf telegraph palette', () => {
    expect(bossIntentLabel2D('radialVolley', 'radial')).toBe('전방위 탄막')
    expect(bossIntentLabel2D(null, 'zone')).toBe('위험 장판')
    const profile = bossTelegraphProfile2D({
      x: 4, z: -2, patternId: 'radialVolley', patternColor: 0xffffff,
      def: { id: 'blueWolfKing', color: 0x5f7fa8 },
      pendingPattern: { patternId: 'radialVolley', patternType: 'radial', geometry: { radius: 6.6 } },
    })
    expect(profile.radius).toBe(6.6)
    expect(profile.color).toBe(0x6ca8ff)
    expect(profile.label).toBe('전방위 탄막')
  })

  it('keeps boss line, cone and zone telegraphs on the exact collision geometry', () => {
    const line = bossTelegraphProfile2D({
      x: 2, z: 3,
      pendingPattern: {
        patternId: 'swordLine', patternType: 'line', castOriginX: 2, castOriginZ: 3, castAngle: 0,
        geometry: { type: 'line', length: 10, width: 2, angle: 0 },
      },
    })
    const [lineShape] = bossTelegraphWorldShapes2D(line)
    expect(lineShape.map((point) => point.x)).toEqual([2, 12, 12, 2])
    expect(lineShape.map((point) => point.z)).toEqual([2, 2, 4, 4])

    const cone = bossTelegraphProfile2D({
      pendingPattern: {
        patternId: 'swordCone', patternType: 'cone', castOriginX: -1, castOriginZ: 4,
        castAngle: Math.PI / 2,
        geometry: { type: 'cone', length: 8, arcRadians: 0.8, innerRadius: 1 },
      },
    })
    const [coneShape] = bossTelegraphWorldShapes2D(cone)
    expect(coneShape).toHaveLength(38)
    expect(Math.max(...coneShape.map((point) => point.z))).toBeGreaterThan(11)
    expect(Math.min(...coneShape.map((point) => Math.hypot(point.x + 1, point.z - 4)))).toBeCloseTo(1, 5)

    const lane = bossTelegraphProfile2D({
      pendingPattern: {
        patternId: 'frostLane', patternType: 'zone', castTargetX: 20, castTargetZ: -4,
        geometry: { type: 'zone', shape: 'lane', center: { x: 2, z: 1 }, angle: Math.PI / 2, length: 12, width: 3 },
      },
    })
    expect(lane.instances).toEqual([
      expect.objectContaining({ shape: 'rect', x: 22, z: -3, length: 12, width: 3 }),
    ])
    expect(bossTelegraphWorldShapes2D(lane)[0]).toHaveLength(4)
  })

  it('covers every authored behavior and preserves descriptor identity axes', () => {
    expect(WEAPON_VISUAL_SIGNATURE_IDS).toEqual(WEAPON_BEHAVIOR_IDS_2D)
    for (const id of WEAPON_BEHAVIOR_IDS_2D) {
      const behavior = getWeaponBehavior2D(id, 1)
      const signature = WEAPON_VISUAL_SIGNATURES[id]
      const effects = behavior.statusEffects
      const status = effects.freeze?.enabled && effects.shatter?.enabled ? 'freeze-shatter'
        : effects.chain?.enabled ? 'orbit-chain'
          : effects.return?.enabled ? 'return-knockback'
            : effects.pull?.enabled ? 'pull'
              : effects.burn?.enabled && behavior.residualField.enabled ? 'burn-persistent'
                : effects.burn?.enabled ? 'burn'
                  : effects.slow?.enabled ? 'slow'
                    : behavior.residualField.enabled ? 'persistent'
                      : behavior.mode === 'delayedStrike' ? 'delayed-knockback'
                        : effects.orbit?.enabled ? 'orbit-knockback' : 'knockback'
      expect(signature.axes).toEqual({
        mode: behavior.mode,
        trajectory: behavior.trajectory.kind,
        collision: behavior.collision.kind,
        status,
      })
      expect(signature.projectile.frame).toBeGreaterThanOrEqual(0)
      expect(signature.projectile.frame).toBeLessThan(7)
      expect(signature.projectile.scaleX).toBeGreaterThan(0)
      expect(signature.projectile.scaleY).toBeGreaterThan(0)
      expect(signature.projectile.alpha).toBeGreaterThan(0)
      expect(signature.projectile.alpha).toBeLessThanOrEqual(1)
      expect(signature.field.frame).toBeGreaterThanOrEqual(0)
      expect(signature.field.frame).toBeLessThan(8)
      expect(projectilePresentationForBehavior(behavior, 1).family).toBe(signature.projectile.family)
      expect(weaponFieldVisualForBehavior(behavior, 1).family).toBe(signature.field.family)
    }
  })

  it('changes at least two visual axes for every authored evolution', () => {
    const projectileAxes = ['frame', 'scaleX', 'scaleY', 'rotationOffset', 'spin', 'pulse', 'alpha', 'tint']
    const fieldAxes = ['frame', 'scaleX', 'scaleY', 'rotationSpeed', 'pulse', 'alpha', 'tint']
    for (const evolution of EVOLUTIONS) {
      const base = WEAPON_VISUAL_SIGNATURES[evolution.evolutionOf]
      const evolved = WEAPON_VISUAL_SIGNATURES[evolution.id]
      const projectileChanges = projectileAxes.filter((axis) => base.projectile[axis] !== evolved.projectile[axis])
      const fieldChanges = fieldAxes.filter((axis) => base.field[axis] !== evolved.field[axis])
      expect(projectileChanges.length + fieldChanges.length, evolution.id).toBeGreaterThanOrEqual(2)
      expect(projectileChanges.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('consumes projectile.kind in the pooled renderer without splitting the atlas batch', () => {
    const presentation = Object.create(PixiPresentation.prototype)
    presentation.time = 0.4
    presentation.cameraX = 0
    presentation.cameraZ = 0
    presentation.viewport = { width: 800, height: 600, zoom: 1 }
    presentation.textures = { projectileFrames: Array.from({ length: 7 }, (_, i) => `frame-${i}`) }
    presentation.friendlyProjectilePool = fakePool(7)
    presentation.hostileProjectilePool = fakePool(1)
    presentation.friendlyProjectileContainer = { update: vi.fn() }

    const field = {
      count: 7,
      kind: new Uint8Array([1, 2, 3, 4, 5, 6, 7]),
      hostile: new Uint8Array(7),
      x: new Float32Array(7), z: new Float32Array(7),
      prevX: new Float32Array(7), prevZ: new Float32Array(7),
      dx: new Float32Array(7).fill(1), dz: new Float32Array(7),
      color: new Uint32Array(7).fill(0xd8efff),
    }

    presentation._renderProjectiles(field, 1)
    const particles = presentation.friendlyProjectilePool.items
    expect(particles.map((particle) => particle.texture)).toEqual(
      Array.from({ length: 7 }, (_, i) => `frame-${i}`),
    )
    expect(new Set(particles.map((particle) => `${particle.scaleX}:${particle.scaleY}`)).size).toBeGreaterThanOrEqual(6)
    expect(new Set(particles.map((particle) => particle.rotation)).size).toBe(7)
    expect(new Set(particles.map((particle) => particle.tint)).size).toBe(7)
    expect(presentation.friendlyProjectileContainer.update).toHaveBeenCalledTimes(1)
  })

  it('uses behaviorDescriptor signatures instead of only the coarse kind', () => {
    const presentation = Object.create(PixiPresentation.prototype)
    presentation.time = 0.4
    presentation.cameraX = 0
    presentation.cameraZ = 0
    presentation.viewport = { width: 800, height: 600, zoom: 1 }
    presentation.textures = { projectileFrames: Array.from({ length: 7 }, (_, i) => `frame-${i}`) }
    presentation.friendlyProjectilePool = fakePool(2)
    presentation.hostileProjectilePool = fakePool(1)
    presentation.friendlyProjectileContainer = { update: vi.fn() }
    const field = {
      count: 2,
      kind: new Uint8Array([1, 1]), hostile: new Uint8Array(2),
      x: new Float32Array(2), z: new Float32Array(2),
      prevX: new Float32Array(2), prevZ: new Float32Array(2),
      dx: new Float32Array([1, 1]), dz: new Float32Array(2),
      color: new Uint32Array([0xd8efff, 0xd8efff]),
      behaviorDescriptor: [getWeaponBehavior2D('flyingSword'), getWeaponBehavior2D('myriadSwords')],
    }
    presentation._renderProjectiles(field, 1)
    const particles = presentation.friendlyProjectilePool.items
    expect(particles[0].texture).toBe('frame-0')
    expect(particles[1].texture).toBe('frame-0')
    expect(particles[0].scaleX).not.toBe(particles[1].scaleX)
    expect(particles[0].rotation).not.toBe(particles[1].rotation)
    expect(particles[0].alpha).not.toBe(particles[1].alpha)
  })

  it('keeps a weapon field visible and pulsing until its lifetime expires', () => {
    const makeSprite = () => ({
      position: { set: vi.fn() },
      scale: { set: vi.fn() },
      rotation: 0, tint: 0, alpha: 0, visible: false,
    })
    const presentation = Object.create(PixiPresentation.prototype)
    presentation.time = 1.1
    presentation.cameraX = 0
    presentation.cameraZ = 0
    presentation.viewport = { width: 800, height: 600, zoom: 1 }
    presentation.textures = { weaponField: { width: 192, height: 96 } }
    presentation.weaponFieldPool = [makeSprite(), makeSprite(), makeSprite()]

    presentation._renderWeaponFields({
      count: 2,
      kind: new Uint8Array([1, 4]),
      x: new Float32Array([0, 1]), z: new Float32Array([0, 1]),
      radius: new Float32Array([2, 3]),
      life: new Float32Array([2, 0.3]), maxLife: new Float32Array([4, 4]),
      color: new Uint32Array([0x72e0af, 0x8f73d6]),
    })
    expect(presentation.weaponFieldPool[0].visible).toBe(true)
    expect(presentation.weaponFieldPool[1].visible).toBe(true)
    expect(presentation.weaponFieldPool[0].alpha).toBeGreaterThan(0)
    expect(presentation.weaponFieldPool[1].alpha).toBeGreaterThan(0)
    expect(presentation.weaponFieldPool[0].scale.set).toHaveBeenCalled()
    expect(presentation.weaponFieldPool[1].rotation).not.toBe(presentation.weaponFieldPool[0].rotation)
    expect(presentation.weaponFieldPool[2].visible).toBe(false)
    expect(weaponFieldPulse2D(3, 4, 1, 0)).not.toBe(weaponFieldPulse2D(0.05, 4, 1, 0))
    expect(Object.keys(WEAPON_FIELD_PRESENTATION)).toEqual(['1', '2', '3', '4'])
  })

  it('uses weaponFields.behavior for glyph, size, pulse and alpha', () => {
    const makeSprite = () => ({
      position: { set: vi.fn() },
      scale: { set: vi.fn() },
      rotation: 0, tint: 0, alpha: 0, visible: false, texture: null,
    })
    const presentation = Object.create(PixiPresentation.prototype)
    presentation.time = 1.1
    presentation.cameraX = 0
    presentation.cameraZ = 0
    presentation.viewport = { width: 800, height: 600, zoom: 1 }
    presentation.textures = {
      weaponField: { width: 192, height: 96 },
      weaponFieldFrames: Array.from({ length: 8 }, (_, i) => `field-${i}`),
    }
    presentation.weaponFieldPool = [makeSprite(), makeSprite()]
    presentation._renderWeaponFields({
      count: 2,
      kind: new Uint8Array([1, 1]),
      x: new Float32Array([0, 1]), z: new Float32Array([0, 1]),
      radius: new Float32Array([1, 1]),
      life: new Float32Array([2, 2]), maxLife: new Float32Array([4, 4]),
      color: new Uint32Array([0x72e0af, 0x72e0af]),
      behavior: [getWeaponBehavior2D('baguaArray'), getWeaponBehavior2D('plagueTide')],
    })
    expect(presentation.weaponFieldPool[0].texture).toBe('field-0')
    expect(presentation.weaponFieldPool[1].texture).toBe('field-7')
    expect(presentation.weaponFieldPool[0].scale.set).not.toHaveBeenCalledWith(
      presentation.weaponFieldPool[1].scale.set.mock.calls[0][0],
      presentation.weaponFieldPool[1].scale.set.mock.calls[0][1],
    )
    expect(presentation.weaponFieldPool[0].rotation).not.toBe(presentation.weaponFieldPool[1].rotation)
    expect(presentation.weaponFieldPool[0].alpha).not.toBe(presentation.weaponFieldPool[1].alpha)
  })

  it('renders Dao segment metadata as a length and angle based ice wall', () => {
    const sprite = {
      position: { set: vi.fn() },
      scale: { set: vi.fn() },
      rotation: 0, tint: 0, alpha: 0, visible: false, texture: null,
    }
    const presentation = Object.create(PixiPresentation.prototype)
    presentation.time = 1.1
    presentation.cameraX = 0
    presentation.cameraZ = 0
    presentation.viewport = { width: 800, height: 600, zoom: 1 }
    presentation.textures = {
      weaponField: { width: 192, height: 96 },
      weaponFieldFrames: Array.from({ length: 8 }, (_, i) => `field-${i}`),
      weaponFieldWall: { width: 256, height: 96 },
    }
    presentation.weaponFieldPool = [sprite]
    presentation._renderWeaponFields({
      count: 1,
      kind: new Uint8Array([1]),
      x: new Float32Array([0]), z: new Float32Array([0]),
      fromX: new Float32Array([-2]), fromZ: new Float32Array([-1]),
      toX: new Float32Array([3]), toZ: new Float32Array([2]),
      segment: new Uint8Array([1]),
      radius: new Float32Array([1.4]),
      life: new Float32Array([1.2]), maxLife: new Float32Array([2]),
      color: new Uint32Array([0x9deaff]),
    })
    expect(sprite.texture).toBe(presentation.textures.weaponFieldWall)
    expect(sprite.visible).toBe(true)
    expect(sprite.scale.set).toHaveBeenCalled()
    expect(sprite.rotation).not.toBe(0)
  })
})
