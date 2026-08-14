import { describe, expect, it, vi } from 'vitest'
import {
  PixiPresentation,
  actorMirrorForFacing2D,
  directionalEnemyFrames2D,
  directionalEnemyReactionFrames2D,
  enemyDirectionalTextureKey2D,
  enemyReactionFrameIndex2D,
  enemyReactionTextureKey2D,
  COMBAT_HORIZON_PRESENTATION_2D,
  HOSTILE_PROJECTILE_PRESENTATION,
  ORBIT_PROJECTILE_RENDER_CAP_2D,
  PROJECTILE_PRESENTATION,
  PICKUP_PRESENTATION_2D,
  RUNTIME2D_POOL_LIMITS,
  RUNTIME2D_RENDER_BUDGET,
  WISP_THREAT_PRESENTATION_2D,
  WEAPON_VISUAL_SIGNATURES,
  WEAPON_VISUAL_SIGNATURE_IDS,
  WEAPON_FIELD_PRESENTATION,
  projectilePresentationFor,
  projectilePresentationForBehavior,
  selectOrbitProjectileRenderIndices2D,
  hostileProjectileVisualFor,
  projectileTint2D,
  pickupVisualAlpha2D,
  pickupVisualScale2D,
  heroDirectionFor,
  heroAnimationFrameIndex2D,
  heroGroundedRunFrames2D,
  directionalHeroFrames,
  directionalHeroReactionFrames,
  heroReactionFrameIndex2D,
  bossCombatHeight2D,
  heroCombatHeight2D,
  heroSlashPresentation2D,
  enemyBossFocusAlpha2D,
  enemyHeroOverlapAlpha2D,
  bossIntentLabel2D,
  bossTelegraphProfile2D,
  bossTelegraphWorldShapes2D,
  weaponFieldVisualForBehavior,
  planWeaponFieldVisuals2D,
  weaponFieldPulse2D,
  enemyActorTint2D,
  attachCombatGroundMasks2D,
  enemyAttackPresentationDuration2D,
  enemyLocomotionFrame2D,
  enemyMotionProfile2D,
  enemyTextureKey2D,
  resolveEnemyIntentPresentation2D,
  wispThreatRotation2D,
  jadeRegionTextureIndex2D,
  mapDecalTextureIndex2D,
} from '../src/runtime2d/PixiPresentation.js'
import {
  HERO_DEATH_REACTION_SECONDS_2D,
  HERO_HURT_REACTION_SECONDS_2D,
  MAX_PICKUPS_2D,
  MAX_PROJECTILES_2D,
  MAX_WEAPON_FIELDS_2D,
} from '../src/runtime2d/CombatWorld2D.js'
import { WEAPON_BEHAVIOR_IDS_2D, getWeaponBehavior2D } from '../src/runtime2d/WeaponBehaviors2D.js'
import { SPRITE_MANIFEST } from '../src/runtime2d/spriteManifest.js'
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
  it('keeps semantic jade regions on distinct streamed ground textures', () => {
    const grove = mapDecalTextureIndex2D('jade', { regionId: 'jade_grove', variant: 1 })
    const path = mapDecalTextureIndex2D('jade', { regionId: 'jade_path', variant: 1 })
    expect(grove).toBe(jadeRegionTextureIndex2D('jade_grove', 1))
    expect(path).toBe(jadeRegionTextureIndex2D('jade_path', 1))
    expect(path).not.toBe(grove)
    expect(mapDecalTextureIndex2D('ember', { regionId: 'jade_path', variant: 3 })).toBe(3)
  })

  it('mirrors each single-direction atlas from its authored baseline', () => {
    expect(actorMirrorForFacing2D('yorang', Math.PI / 2)).toBe(true)
    expect(actorMirrorForFacing2D('yorang', -Math.PI / 2)).toBe(false)
    expect(actorMirrorForFacing2D('jadeSerpent', Math.PI / 2)).toBe(false)
    expect(actorMirrorForFacing2D('jadeSerpent', -Math.PI / 2)).toBe(true)
    expect(actorMirrorForFacing2D('wisp', Math.PI / 2)).toBe(false)
  })

  it('uses authored yorang north and south views while keeping side-view mirroring', () => {
    const frames = { yorang: ['side'], yorangN: ['north'], yorangS: ['south'] }
    expect(directionalEnemyFrames2D(frames, 'yorang', 0)).toMatchObject({
      frames: frames.yorangS, directionKey: 's', pivotKey: 'yorangS', mirror: false,
    })
    expect(directionalEnemyFrames2D(frames, 'yorang', Math.PI / 2)).toMatchObject({
      frames: frames.yorang, directionKey: 'e', pivotKey: 'yorang', mirror: true,
    })
    expect(directionalEnemyFrames2D(frames, 'yorang', Math.PI)).toMatchObject({
      frames: frames.yorangN, directionKey: 'n', pivotKey: 'yorangN', mirror: false,
    })
    expect(enemyDirectionalTextureKey2D('yorang', 'n')).toBe('yorangN')
    expect(enemyDirectionalTextureKey2D('yorang', 's')).toBe('yorangS')
    expect(enemyDirectionalTextureKey2D('yorang', 'e')).toBeNull()
    expect(enemyDirectionalTextureKey2D('jadeRidgeHound', 'n')).toBe('jadeRidgeHoundN')
    expect(enemyDirectionalTextureKey2D('jadeSerpent', 's')).toBe('jadeSerpentS')
  })

  it('binds yorang hit and death reactions to the same three grounded directions', () => {
    const actor = SPRITE_MANIFEST.actors.yorang
    const frames = {
      yorangReaction: Array.from({ length: 8 }, (_, frame) => `side-${frame}`),
      yorangReactionN: Array.from({ length: 8 }, (_, frame) => `north-${frame}`),
      yorangReactionS: Array.from({ length: 8 }, (_, frame) => `south-${frame}`),
    }
    expect(directionalEnemyReactionFrames2D(frames, 'yorang', 0)).toMatchObject({
      frames: frames.yorangReactionS, directionKey: 's', mirror: false,
    })
    expect(directionalEnemyReactionFrames2D(frames, 'yorang', Math.PI / 2)).toMatchObject({
      frames: frames.yorangReaction, directionKey: 'e', mirror: true,
    })
    expect(directionalEnemyReactionFrames2D(frames, 'yorang', Math.PI)).toMatchObject({
      frames: frames.yorangReactionN, directionKey: 'n', mirror: false,
    })
    expect(enemyReactionTextureKey2D('yorang', 'n')).toBe('yorangReactionN')
    expect(enemyReactionTextureKey2D('yorang', 's')).toBe('yorangReactionS')
    expect(enemyReactionTextureKey2D('yorang', 'e')).toBe('yorangReaction')
    expect(enemyReactionFrameIndex2D(actor, 'hurt', 0.14, 0.14)).toBe(0)
    expect(enemyReactionFrameIndex2D(actor, 'hurt', 0.001, 0.14)).toBe(1)
    expect(enemyReactionFrameIndex2D(actor, 'death', 0.78, 0.78)).toBe(2)
    expect(enemyReactionFrameIndex2D(actor, 'death', 0.001, 0.78)).toBe(7)
  })

  it('resolves jade ridge hound reactions through the shared enemy contract', () => {
    const frames = {
      jadeRidgeHoundReaction: ['side'],
      jadeRidgeHoundReactionN: ['north'],
      jadeRidgeHoundReactionS: ['south'],
    }
    expect(directionalEnemyReactionFrames2D(frames, 'jadeRidgeHound', 0)).toMatchObject({
      frames: frames.jadeRidgeHoundReactionS, mirror: false,
    })
    expect(directionalEnemyReactionFrames2D(frames, 'jadeRidgeHound', Math.PI)).toMatchObject({
      frames: frames.jadeRidgeHoundReactionN, mirror: false,
    })
    expect(directionalEnemyReactionFrames2D(frames, 'jadeRidgeHound', Math.PI / 2)).toMatchObject({
      frames: frames.jadeRidgeHoundReaction, mirror: true,
    })
  })

  it('keeps locomotion frames active during automatic attacks', () => {
    const hero = SPRITE_MANIFEST.actors.seolryeong
    expect(heroAnimationFrameIndex2D(hero, {
      moving: true, attackTimer: 0.2, time: 0.14,
    })).toBe(hero.animations.run[1])
    expect(hero.animations.attack).toContain(heroAnimationFrameIndex2D(hero, {
      moving: false, attackTimer: 0.2, time: 0.14,
    }))
    expect(hero.animations.dash).toContain(heroAnimationFrameIndex2D(hero, {
      moving: true, dashing: 0.08, attackTimer: 0.2, time: 0.14,
    }))
    expect(heroAnimationFrameIndex2D(hero, {
      moving: false, movementSettle: 0.1, attackTimer: 0.2,
    })).toBe(hero.animations.run[0])
  })

  it('binds five authored reaction views and plays idle, hurt and death in semantic order', () => {
    const hero = SPRITE_MANIFEST.actors.seolryeong
    const frames = {
      seolryeongReactionN: ['n'], seolryeongReactionNe: ['ne'],
      seolryeongReactionE: ['e'], seolryeongReaction: ['se'], seolryeongReactionS: ['s'],
    }
    expect(directionalHeroReactionFrames(frames, { key: 'n' })).toBe(frames.seolryeongReactionN)
    expect(directionalHeroReactionFrames(frames, { key: 'ne' })).toBe(frames.seolryeongReactionNe)
    expect(directionalHeroReactionFrames(frames, { key: 'e' })).toBe(frames.seolryeongReactionE)
    expect(directionalHeroReactionFrames(frames, { key: 'se' })).toBe(frames.seolryeongReaction)
    expect(directionalHeroReactionFrames(frames, { key: 's' })).toBe(frames.seolryeongReactionS)
    expect(heroReactionFrameIndex2D(hero, { time: 0 })).toBe(0)
    expect(heroReactionFrameIndex2D(hero, { time: 0.7 })).toBe(1)
    expect(heroReactionFrameIndex2D(hero, {
      hurtTimer: HERO_HURT_REACTION_SECONDS_2D,
    })).toBe(2)
    expect(heroReactionFrameIndex2D(hero, { hurtTimer: 0.01 })).toBe(3)
    expect(heroReactionFrameIndex2D(hero, {
      alive: false, deathTimer: HERO_DEATH_REACTION_SECONDS_2D,
    })).toBe(4)
    expect(heroReactionFrameIndex2D(hero, { alive: false, deathTimer: 0.01 })).toBe(7)
  })

  it('locks the complete grounded eight-pose run cycle to world distance', () => {
    const hero = SPRITE_MANIFEST.actors.seolryeong
    const sideRun = heroGroundedRunFrames2D(hero, 'se')
    expect(sideRun).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(heroGroundedRunFrames2D(hero, 'n')).toEqual(hero.animations.run)
    expect(heroAnimationFrameIndex2D(hero, {
      moving: true, travelDistance: 0.45, time: 500, runFrames: sideRun,
    })).toBe(sideRun[0])
    expect(heroAnimationFrameIndex2D(hero, {
      moving: true, travelDistance: 0.47, time: 0, runFrames: sideRun,
    })).toBe(sideRun[1])
  })

  it('deterministically divides stone ghouls between two authored silhouettes', () => {
    const variants = Array.from({ length: 64 }, (_, index) => (
      enemyTextureKey2D('stoneGhoul', index + 1)
    ))
    const shardCount = variants.filter((key) => key === 'jadeShardGuardian').length

    expect(new Set(variants)).toEqual(new Set(['jadeStoneGhoul', 'jadeShardGuardian']))
    expect(shardCount).toBeGreaterThanOrEqual(24)
    expect(shardCount).toBeLessThanOrEqual(40)
    expect(enemyTextureKey2D('stoneGhoul', 17)).toBe(enemyTextureKey2D('stoneGhoul', 17))
    expect(enemyTextureKey2D('jadeSerpent', 17)).toBe('jadeSerpent')
  })

  it('deterministically divides talisman casters between two authored silhouettes', () => {
    for (const id of ['talismanGhost', 'snowWraith']) {
      const variants = Array.from({ length: 64 }, (_, index) => enemyTextureKey2D(id, index + 1))
      const maskedCount = variants.filter((key) => key === 'maskedSealRevenant').length

      expect(new Set(variants)).toEqual(new Set(['talismanRevenant', 'maskedSealRevenant']))
      expect(maskedCount).toBeGreaterThanOrEqual(24)
      expect(maskedCount).toBeLessThanOrEqual(40)
      expect(enemyTextureKey2D(id, 29)).toBe(enemyTextureKey2D(id, 29))
    }
  })

  it('deterministically divides demon cultivators between two authored silhouettes', () => {
    const variants = Array.from({ length: 64 }, (_, index) => (
      enemyTextureKey2D('demonCultivator', index + 1)
    ))
    const duelistCount = variants.filter((key) => key === 'shadowSealDuelist').length

    expect(new Set(variants)).toEqual(new Set(['voidSentinel', 'shadowSealDuelist']))
    expect(duelistCount).toBeGreaterThanOrEqual(24)
    expect(duelistCount).toBeLessThanOrEqual(40)
    // This is the exact local pattern that previously produced a visible 9:1
    // wall in a mixed late-wave capture: one demon every seven roster slots.
    // Cover the other common wave strides as well so a globally balanced hash
    // cannot regress into a locally repeated crowd again.
    for (const stride of [2, 3, 4, 5, 6, 7]) {
      const local = Array.from({ length: 10 }, (_, index) => (
        enemyTextureKey2D('demonCultivator', 6 + index * stride)
      ))
      const localDuelists = local.filter((key) => key === 'shadowSealDuelist').length
      expect(localDuelists, `stride ${stride}`).toBeGreaterThanOrEqual(4)
      expect(localDuelists, `stride ${stride}`).toBeLessThanOrEqual(6)
    }
    expect(enemyTextureKey2D('demonCultivator', 31)).toBe(
      enemyTextureKey2D('demonCultivator', 31),
    )
    expect(() => enemyTextureKey2D('magmaBrute', 31)).toThrow(/전용 런타임/)
    expect(() => enemyTextureKey2D('glacierWarden', 31)).toThrow(/전용 런타임/)
  })

  it('deterministically divides ordinary wolves between two authored silhouettes', () => {
    const variants = Array.from({ length: 64 }, (_, index) => (
      enemyTextureKey2D('wolf', index + 1)
    ))
    const ridgeCount = variants.filter((key) => key === 'jadeRidgeHound').length

    expect(new Set(variants)).toEqual(new Set(['yorang', 'jadeRidgeHound']))
    expect(ridgeCount).toBeGreaterThanOrEqual(24)
    expect(ridgeCount).toBeLessThanOrEqual(40)
    for (const stride of [2, 3, 4, 5, 6, 7]) {
      const local = Array.from({ length: 10 }, (_, index) => (
        enemyTextureKey2D('wolf', 3 + index * stride)
      ))
      const localRidgeHounds = local.filter((key) => key === 'jadeRidgeHound').length
      expect(localRidgeHounds, `stride ${stride}`).toBeGreaterThanOrEqual(4)
      expect(localRidgeHounds, `stride ${stride}`).toBeLessThanOrEqual(6)
    }
    expect(() => enemyTextureKey2D('frostWolf', 23)).toThrow(/전용 런타임/)
    expect(() => enemyTextureKey2D('ashRaven', 23)).toThrow(/전용 런타임/)
  })

  it('keeps atlas-sharing enemy species visually distinct without blackening authored art', () => {
    const wolf = enemyActorTint2D(0x5f7fa8, 'yorang')
    const frostWolf = enemyActorTint2D(0xa8d8ea, 'yorang')
    const ashRaven = enemyActorTint2D(0x8a5a4a, 'yorang')
    expect(new Set([wolf, frostWolf, ashRaven]).size).toBe(3)
    const authoredWisp = enemyActorTint2D(0xff8a3c, 'wisp')
    expect(authoredWisp).not.toBe(0xff8a3c)
    expect((authoredWisp >>> 16) & 0xff).toBeGreaterThan(245)
    expect((authoredWisp >>> 8) & 0xff).toBeGreaterThan(180)
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

  it('separates upright hostile wisps from continuously rotating faceted rewards', () => {
    expect(WISP_THREAT_PRESENTATION_2D.silhouette).toBe('upright-eyed-wraith')
    expect(WISP_THREAT_PRESENTATION_2D.baseHeight).toBeGreaterThanOrEqual(74)
    expect(Math.abs(wispThreatRotation2D(3.2, 7))).toBeLessThanOrEqual(0.065)
    expect(Math.abs(wispThreatRotation2D(3.2, 7))).toBeGreaterThan(0)

    const qi1080 = pickupVisualScale2D(false, 1, 0)
    const qi1600 = pickupVisualScale2D(false, 4 / 3, 0)
    const stone1080 = pickupVisualScale2D(true, 1, 0)
    expect(qi1080).toBeCloseTo(PICKUP_PRESENTATION_2D.qi.baseScale)
    expect(qi1080).toBeGreaterThanOrEqual(0.32)
    expect(qi1080).toBeLessThanOrEqual(0.38)
    expect(qi1600).toBeGreaterThan(qi1080)
    expect(stone1080).toBeGreaterThan(qi1080)
    expect(pickupVisualScale2D(false, 1, 1)).toBeGreaterThan(qi1080)
    expect(pickupVisualScale2D(false, 1, -1)).toBeLessThan(qi1080)
    expect(pickupVisualAlpha2D(false, 0)).toBeCloseTo(PICKUP_PRESENTATION_2D.qi.alpha)
    expect(pickupVisualAlpha2D(false, 20)).toBeLessThan(PICKUP_PRESENTATION_2D.qi.alpha)
    expect(pickupVisualAlpha2D(false, 120)).toBeCloseTo(PICKUP_PRESENTATION_2D.qi.minimumAlpha)
    expect(pickupVisualAlpha2D(true, 120)).toBeCloseTo(PICKUP_PRESENTATION_2D.stone.alpha)
  })

  it('breaks consecutive spawn pulses into deterministic local motion variants', () => {
    const profiles = Array.from({ length: 24 }, (_, index) => enemyMotionProfile2D(index + 1, 'wisp'))
    expect(enemyMotionProfile2D(7, 'wisp')).toEqual(enemyMotionProfile2D(7, 'wisp'))
    expect(enemyMotionProfile2D(7, 'wisp')).not.toEqual(enemyMotionProfile2D(7, 'yorang'))
    expect(Math.min(...profiles.map((profile) => profile.tempo))).toBeGreaterThanOrEqual(0.9)
    expect(Math.max(...profiles.map((profile) => profile.tempo))).toBeLessThanOrEqual(1.1)
    expect(Math.min(...profiles.map((profile) => profile.scale))).toBeGreaterThanOrEqual(0.94)
    expect(Math.max(...profiles.map((profile) => profile.scale))).toBeLessThanOrEqual(1.06)
    expect(Math.min(...profiles.map((profile) => profile.aspect))).toBeGreaterThanOrEqual(0.9)
    expect(Math.max(...profiles.map((profile) => profile.aspect))).toBeLessThanOrEqual(1.1)

    const frames = profiles.map((profile) => enemyLocomotionFrame2D([0, 1, 2, 3], 120, 7, profile))
    expect(new Set(frames)).toEqual(new Set([0, 1, 2, 3]))
    let longestRun = 1
    let currentRun = 1
    for (let index = 1; index < frames.length; index++) {
      currentRun = frames[index] === frames[index - 1] ? currentRun + 1 : 1
      longestRun = Math.max(longestRun, currentRun)
    }
    expect(longestRun).toBeLessThanOrEqual(2)
  })

  it('gives long-lived crowd silhouettes restrained per-actor shape and palette variation', () => {
    for (const key of [
      'jadeStoneGhoul', 'jadeShardGuardian', 'talismanRevenant', 'maskedSealRevenant',
      'voidSentinel', 'shadowSealDuelist',
    ]) {
      const profiles = Array.from({ length: 32 }, (_, index) => enemyMotionProfile2D(index + 1, key))
      const scaleSpan = Math.max(...profiles.map((profile) => profile.scale))
        - Math.min(...profiles.map((profile) => profile.scale))
      const aspectSpan = Math.max(...profiles.map((profile) => profile.aspect))
        - Math.min(...profiles.map((profile) => profile.aspect))
      const tints = profiles.map((profile) => enemyActorTint2D(0x6b5f78, key, false, profile.palette))

      expect(scaleSpan, `${key} scale variation`).toBeGreaterThan(0.1)
      expect(aspectSpan, `${key} aspect variation`).toBeGreaterThan(0.05)
      expect(new Set(tints).size, `${key} palette variation`).toBeGreaterThanOrEqual(12)
      for (const tint of tints) {
        expect((tint >>> 16) & 0xff).toBeGreaterThan(90)
        expect((tint >>> 8) & 0xff).toBeGreaterThan(90)
        expect(tint & 0xff).toBeGreaterThan(90)
      }
    }
  })

  it('breaks the opening wisp horde into restrained cyan and violet material variants', () => {
    const profiles = Array.from({ length: 32 }, (_, index) => enemyMotionProfile2D(index + 1, 'wisp'))
    const tints = profiles.map((profile) => enemyActorTint2D(0x8065b0, 'wisp', false, profile.palette))
    expect(new Set(tints).size).toBeGreaterThanOrEqual(12)
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

  it('keeps fire talismans aligned to travel instead of rendering upright icon stamps', () => {
    const fallback = PROJECTILE_PRESENTATION[2]
    const fire = WEAPON_VISUAL_SIGNATURES.fireTalisman.projectile
    const inferno = WEAPON_VISUAL_SIGNATURES.infernoSea.projectile

    expect(fallback.shape).toBe('talisman-comet')
    expect(fire.shape).toBe('talisman-comet')
    expect(inferno.shape).toBe('inferno-talisman-comet')
    for (const visual of [fallback, fire, inferno]) {
      expect(visual.preserveAtlasColor).toBe(true)
      expect(visual.scaleX / visual.scaleY).toBeGreaterThan(1.5)
      expect(Math.abs(visual.rotationOffset)).toBeLessThan(0.1)
    }
    expect(inferno.scaleX).toBeGreaterThan(fire.scaleX)
  })

  it('renders orbiting thunder weapons as compact pearls instead of zigzag handwriting', () => {
    const fallback = PROJECTILE_PRESENTATION[4]
    const orb = WEAPON_VISUAL_SIGNATURES.thunderOrb.projectile
    const evolved = WEAPON_VISUAL_SIGNATURES.violetThunder.projectile

    expect(fallback.shape).toBe('thunder-orb')
    expect(orb.shape).toBe('thunder-orb')
    expect(evolved.shape).toBe('violet-thunder-orb')
    for (const visual of [fallback, orb, evolved]) {
      expect(visual.preserveAtlasColor).toBe(true)
      expect(visual.scaleX / visual.scaleY).toBeCloseTo(1, 5)
      expect(visual.pulse).toBeLessThanOrEqual(0.14)
    }
    expect(evolved.scaleX).toBeGreaterThan(orb.scaleX)
  })

  it('caps only visible orbit representatives while preserving every simulation body', () => {
    const orbitCount = 40
    const count = orbitCount + 2
    const indices = Array.from({ length: count }, (_, index) => index)
    const orbit = new Uint8Array(count)
    orbit.fill(1, 0, orbitCount)
    const hostile = new Uint8Array(count)
    hostile[count - 1] = 1
    const orbitAngle = new Float32Array(count)
    const age = new Float32Array(count)
    const behaviorDescriptor = Array.from({ length: count }, (_, index) => (
      index < orbitCount ? { id: 'violetThunder', trajectory: { orbit: true } } : null
    ))
    for (let index = 0; index < orbitCount; index++) {
      orbitAngle[index] = index / orbitCount * Math.PI * 2
      age[index] = index * 0.01
    }
    const field = { count, orbit, hostile, orbitAngle, age, behaviorDescriptor, kind: new Uint8Array(count) }

    const visible = selectOrbitProjectileRenderIndices2D(indices, field)
    const visibleOrbit = visible.filter((index) => index < orbitCount)

    expect(visibleOrbit).toHaveLength(ORBIT_PROJECTILE_RENDER_CAP_2D)
    expect(visible).toContain(orbitCount)
    expect(visible).toContain(orbitCount + 1)
    expect(field.count).toBe(count)
    expect(orbit.reduce((sum, value) => sum + value, 0)).toBe(orbitCount)
    const sectors = new Set(visibleOrbit.map((index) => Math.floor(
      orbitAngle[index] / (Math.PI * 2) * ORBIT_PROJECTILE_RENDER_CAP_2D,
    )))
    expect(sectors.size).toBeGreaterThanOrEqual(ORBIT_PROJECTILE_RENDER_CAP_2D - 1)
  })

  it('shares the orbit render budget across simultaneous behaviors', () => {
    const groupSize = 8
    const count = groupSize * 2
    const indices = Array.from({ length: count }, (_, index) => index)
    const orbit = new Uint8Array(count)
    orbit.fill(1)
    const orbitAngle = new Float32Array(count)
    const behaviorDescriptor = Array.from({ length: count }, (_, index) => ({
      id: index < groupSize ? 'thunderOrb' : 'violetThunder',
      trajectory: { orbit: true },
    }))
    for (let index = 0; index < count; index++) {
      orbitAngle[index] = index % groupSize / groupSize * Math.PI * 2
    }
    const field = {
      orbit,
      orbitAngle,
      behaviorDescriptor,
      hostile: new Uint8Array(count),
      age: new Float32Array(count),
      kind: new Uint8Array(count),
    }

    const visible = selectOrbitProjectileRenderIndices2D(indices, field, 4)

    expect(visible).toHaveLength(4)
    expect(visible.filter((index) => index < groupSize)).toHaveLength(2)
    expect(visible.filter((index) => index >= groupSize)).toHaveLength(2)
    expect(orbit.reduce((sum, value) => sum + value, 0)).toBe(count)
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
    expect(heroCombatHeight2D(720, 140)).toBeCloseTo(134)
    expect(heroCombatHeight2D(1080, 140)).toBeCloseTo(196)
    expect(heroCombatHeight2D(1440, 140)).toBeCloseTo(251.3846, 3)
    expect(heroCombatHeight2D(1600, 140)).toBeCloseTo(276)
    expect(heroCombatHeight2D(1080, 160)).toBeGreaterThan(196)
    expect(bossCombatHeight2D(1080, 220, 1)).toBeGreaterThanOrEqual(194.4)
  })

  it('turns the existing sword arc into a directional anticipation-impact-recovery cue', () => {
    const east = heroSlashPresentation2D(Math.PI / 2, 0.16, 176, 32, 12)
    const north = heroSlashPresentation2D(Math.PI, 0.16, 176, 32, 12)
    expect(east.visible).toBe(true)
    expect(east.alpha).toBeGreaterThan(0.85)
    expect(east.offsetX).toBeGreaterThan(0)
    expect(Math.abs(east.offsetY + 176 * 0.46)).toBeLessThan(1)
    expect(east.width).toBeLessThanOrEqual(176 * 0.92)
    expect(east.height).toBeLessThanOrEqual(176 * 0.46)
    expect(north.offsetY).toBeLessThan(east.offsetY)
    expect(north.rotation).toBeLessThan(0)

    const movingEast = heroSlashPresentation2D(Math.PI / 2, 0.16, 196, 32, 12, true)
    expect(movingEast.alpha).toBeLessThan(east.alpha)
    expect(movingEast.width).toBeLessThan(196 * 0.92)
    expect(heroSlashPresentation2D(0, 0, 176, 32, 12).visible).toBe(false)
  })

  it('fades only enemies that overlap the heroine and restores full opacity nearby', () => {
    expect(enemyHeroOverlapAlpha2D(0)).toBeCloseTo(0.48)
    expect(enemyHeroOverlapAlpha2D(1.6)).toBeCloseTo(0.74)
    expect(enemyHeroOverlapAlpha2D(3.2)).toBe(1)
    expect(enemyHeroOverlapAlpha2D(20)).toBe(1)
    expect(enemyHeroOverlapAlpha2D(Number.NaN)).toBe(1)
    expect(enemyHeroOverlapAlpha2D(0, 'wisp')).toBeCloseTo(0.22)
    expect(enemyHeroOverlapAlpha2D(1.6, 'wisp')).toBeCloseTo(0.61)
    expect(enemyHeroOverlapAlpha2D(3.2, 'wisp')).toBe(1)
  })

  it('keeps boss-local ordinary mobs subordinate without fading elites', () => {
    expect(enemyBossFocusAlpha2D(0, true, false)).toBeCloseTo(0.42)
    expect(enemyBossFocusAlpha2D(7.99, true, false)).toBeLessThan(1)
    expect(enemyBossFocusAlpha2D(8, true, false)).toBe(1)
    expect(enemyBossFocusAlpha2D(0, true, true)).toBe(1)
  })

  it('uses a masked procedural horizon without restoring the pasted static vista', () => {
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
    expect(presentation.farMountains.visible).toBe(true)
    expect(presentation.nearMountains.visible).toBe(true)
    expect(presentation.farMist.visible).toBe(true)
    expect(COMBAT_HORIZON_PRESENTATION_2D.topFloorAlpha).toBeGreaterThanOrEqual(0.12)
    expect(COMBAT_HORIZON_PRESENTATION_2D.topFloorAlpha).toBeLessThanOrEqual(0.22)
    expect(COMBAT_HORIZON_PRESENTATION_2D.horizonVeilAlpha).toBeLessThanOrEqual(0.16)
    expect(COMBAT_HORIZON_PRESENTATION_2D.farMountainHeightRatio).toBeLessThan(0.4)
    expect(COMBAT_HORIZON_PRESENTATION_2D.nearMountainHeightRatio).toBeLessThanOrEqual(0.42)
    expect(COMBAT_HORIZON_PRESENTATION_2D.nearMountainAlpha).toBeGreaterThan(
      COMBAT_HORIZON_PRESENTATION_2D.farMountainAlpha,
    )
    expect(COMBAT_HORIZON_PRESENTATION_2D.nearMountainAlpha).toBeLessThanOrEqual(0.6)
  })

  it('reads the alpha channel for both combat ground masks', () => {
    const floor = { setMask: vi.fn() }
    const decals = { setMask: vi.fn() }
    const floorMask = { id: 'floor-mask' }
    const decalMask = { id: 'decal-mask' }

    attachCombatGroundMasks2D(floor, floorMask, decals, decalMask)

    expect(floor.setMask).toHaveBeenCalledWith({ mask: floorMask, channel: 'alpha' })
    expect(decals.setMask).toHaveBeenCalledWith({ mask: decalMask, channel: 'alpha' })
  })

  it('keeps attack animation and intent timing aligned with simulation behavior', () => {
    expect(enemyAttackPresentationDuration2D({ chargeWindup: 0.5, chargeTime: 0.55 }, 5)).toBeCloseTo(1.05)
    expect(enemyAttackPresentationDuration2D({}, 5)).toBeCloseTo(0.66)
    expect(enemyAttackPresentationDuration2D({}, 7)).toBeCloseTo(0.2)
    expect(enemyAttackPresentationDuration2D({}, 1)).toBeCloseTo(0.34)
    expect(enemyAttackPresentationDuration2D({}, 0)).toBeCloseTo(0.3)
  })

  it('renders pre-contact intent separately from the post-contact attack timer', () => {
    const output = {}
    const preContact = resolveEnemyIntentPresentation2D(output, 0, 0.18, 0.3)
    expect(preContact).toMatchObject({ visible: true, preContact: true, duration: 0.24 })
    expect(preContact.remaining).toBeCloseTo(0.18)

    const attack = resolveEnemyIntentPresentation2D(output, 0.22, 0.18, 0.3)
    expect(attack).toBe(output)
    expect(attack).toMatchObject({ visible: true, preContact: false, duration: 0.3 })
    expect(attack.remaining).toBeCloseTo(0.22)
    expect(resolveEnemyIntentPresentation2D(output, 0, 0, 0.3).visible).toBe(false)
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
    expect(new Set(particles.map((particle) => particle.tint)).size).toBe(6)
    expect(particles[1].tint).toBe(0xffffff)
    expect(particles[3].tint).toBe(0xffffff)
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
    expect(presentation.weaponFieldPool[0].rotation).toBe(0)
    expect(presentation.weaponFieldPool[1].rotation).toBe(0)
    expect(presentation.weaponFieldPool[2].visible).toBe(false)
    expect(weaponFieldPulse2D(3, 4, 1, 0)).not.toBe(weaponFieldPulse2D(0.05, 4, 1, 0))
    expect(Object.keys(WEAPON_FIELD_PRESENTATION)).toEqual(['1', '2', '3', '4'])
  })

  it('clusters only deeply overlapping copies of the same weapon field', () => {
    const bagua = getWeaponBehavior2D('baguaArray', 5)
    const plague = getWeaponBehavior2D('plagueTide', 1)
    const field = {
      count: 5,
      kind: new Uint8Array([1, 1, 1, 1, 3]),
      x: new Float32Array([0, 0.3, -0.25, 4, 0]),
      z: new Float32Array([0, -0.2, 0.15, 0, 0]),
      radius: new Float32Array([2, 2, 2, 2, 2]),
      segment: new Uint8Array(5),
      tag: ['array', 'array', 'array', 'array', 'array'],
      behavior: [bagua, bagua, bagua, bagua, plague],
    }

    const plan = planWeaponFieldVisuals2D(field)
    expect(plan).toHaveLength(3)
    expect(plan[0]).toMatchObject({ overlapCount: 3 })
    expect(plan[0].x).toBeCloseTo((0 + 0.3 - 0.25) / 3)
    expect(plan[0].z).toBeCloseTo((0 - 0.2 + 0.15) / 3)
    expect(plan[0].radius).toBeGreaterThan(2)
    expect(plan[1]).toMatchObject({ overlapCount: 1, x: 4, z: 0, radius: 2 })
    expect(plan[2]).toMatchObject({ overlapCount: 1, x: 0, z: 0, radius: 2 })
    expect(field.count).toBe(5)

    field.segment[0] = 1
    const segmented = planWeaponFieldVisuals2D(field)
    expect(segmented).toHaveLength(4)
    expect(segmented[0]).toMatchObject({ overlapCount: 1, index: 0, radius: 2 })
    expect(segmented[1]).toMatchObject({ overlapCount: 2 })
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
    expect(presentation.weaponFieldPool[0].rotation).toBe(0)
    expect(presentation.weaponFieldPool[1].rotation).toBe(0)
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
