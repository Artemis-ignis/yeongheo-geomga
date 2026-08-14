import { describe, expect, it, vi } from 'vitest'
import {
  HERO_GROUND_MARKER_2D,
  HERO_AURA_PRESENTATION_2D,
  HERO_READABILITY_RIM_2D,
  INVESTIGATION_TRACE_PRESENTATION_2D,
  BOSS_MIN_SCREEN_HEIGHT_RATIO_2D,
  JADE_GROUND_COMPOSITION_2D,
  JADE_REGION_TEXTURE_ORDER_2D,
  PROP_MATERIAL_TINTS_2D,
  REGION_TERRAIN_PRESENTATION_2D,
  TERRAIN_GRADE_2D,
  PixiPresentation,
  actorFootPivot2D,
  actorGroundingProfile2D,
  bossCombatHeight2D,
  enemyBossFocusAlpha2D,
  heroCombatHeight2D,
  heroFootPivot2D,
  jadeGroundCropPlan2D,
  jadeRegionTextureIndex2D,
} from '../src/runtime2d/PixiPresentation.js'

describe('runtime 2D grounding and terrain integration', () => {
  it('composes jade from a seamless material and world-anchored regional detail', () => {
    expect(JADE_GROUND_COMPOSITION_2D.base).toBe('continuous-authored-material')
    expect(JADE_GROUND_COMPOSITION_2D.baseAsset).toBe('jade-sanctuary-ground-material-v2')
    expect(JADE_GROUND_COMPOSITION_2D.fallbackAsset).toBe('jade-highland-ground-v1')
    expect(JADE_GROUND_COMPOSITION_2D.authoredDetail).toBe('world-anchored-procedural-region-decals')
    expect(JADE_GROUND_COMPOSITION_2D.repeatsAuthoredPlate).toBe(false)
    expect(JADE_GROUND_COMPOSITION_2D.baseTiling).toBe('full-authored-material-period')
    expect(JADE_GROUND_COMPOSITION_2D.synthesisSize).toBeLessThanOrEqual(1536)
    expect(JADE_GROUND_COMPOSITION_2D.authoredCropMode).toBe('full-plate-no-crops')
    expect(JADE_GROUND_COMPOSITION_2D.landmarkMotifs).toBe('seed-specific-procedural')
    expect(JADE_GROUND_COMPOSITION_2D.decalOverlap).toBeGreaterThanOrEqual(1.02)
    expect(JADE_GROUND_COMPOSITION_2D.decalEdgeFeather).toBeGreaterThanOrEqual(72)
    expect(JADE_GROUND_COMPOSITION_2D.decalAlpha).toBeLessThanOrEqual(0.35)
    expect(JADE_GROUND_COMPOSITION_2D.floorTileScale.x).toBeLessThanOrEqual(1.5)
    expect(JADE_GROUND_COMPOSITION_2D.floorTileScale.y / JADE_GROUND_COMPOSITION_2D.floorTileScale.x)
      .toBeCloseTo(0.4, 2)
  })

  it('gives all resident jade variants distinct crop windows and four transforms', () => {
    const plans = Array.from({ length: 12 }, (_, i) => jadeGroundCropPlan2D(i + 11, 1254, 1254))
    const signatures = plans.map((plan) => [
      plan.crop, plan.sx, plan.sy, plan.flipX, plan.flipY,
    ].join(':'))

    expect(new Set(signatures).size).toBe(12)
    expect(new Set(plans.map((plan) => plan.transform))).toEqual(new Set([0, 1, 2, 3]))
    expect(Math.min(...plans.map((plan) => plan.crop))).toBeGreaterThanOrEqual(Math.round(1254 * 0.58))
    expect(Math.max(...plans.map((plan) => plan.crop))).toBeLessThanOrEqual(Math.round(1254 * 0.96))
    expect(new Set(plans.map((plan) => plan.crop)).size).toBeGreaterThanOrEqual(8)
  })

  it('assigns every semantic jade region two stable texture slots', () => {
    expect(JADE_REGION_TEXTURE_ORDER_2D).toEqual([
      'spawn_grove',
      'jade_path',
      'jade_grove',
      'lantern_shrine',
      'mist_marsh',
      'void_rim',
    ])

    const slots = JADE_REGION_TEXTURE_ORDER_2D.flatMap((regionId) => [
      jadeRegionTextureIndex2D(regionId, 0),
      jadeRegionTextureIndex2D(regionId, 1),
    ])

    expect(new Set(slots).size).toBe(12)
    expect(Math.min(...slots)).toBe(0)
    expect(Math.max(...slots)).toBe(11)
    expect(jadeRegionTextureIndex2D('unknown-region', 0))
      .toBe(jadeRegionTextureIndex2D('jade_grove', 0))
  })

  it('anchors every high-variance family to its sampled opaque contact row', () => {
    expect(heroFootPivot2D('n', 1)).toBeCloseTo(242 / 256)
    expect(heroFootPivot2D('s', 0)).toBeCloseTo(242 / 256)
    expect(actorFootPivot2D('prop', 7)).toBeCloseTo(193 / 256)
    expect(actorFootPivot2D('prop', 2)).toBeCloseTo(222 / 256)
    expect(actorFootPivot2D('bloodScorpion', 4)).toBeCloseTo(0.742)
    expect(actorFootPivot2D('yorang', 5)).toBeCloseTo(0.727)
    expect(actorFootPivot2D('yorangN', 5)).toBeCloseTo(232 / 256)
    expect(actorFootPivot2D('yorangS', 5)).toBeCloseTo(232 / 256)
    expect(actorFootPivot2D('jadeRidgeHound', 0)).toBeCloseTo(206 / 256)
    expect(actorFootPivot2D('jadeRidgeHoundN', 0)).toBeCloseTo(232 / 256)
    expect(actorFootPivot2D('jadeRidgeHoundS', 7)).toBeCloseTo(232 / 256)
    expect(actorFootPivot2D('jadeRidgeHound', 5)).toBeCloseTo(186 / 256)
    expect(actorFootPivot2D('jadeStoneGhoul', 0)).toBeCloseTo(0.953)
    expect(actorFootPivot2D('jadeSerpentN', 3)).toBeCloseTo(244 / 256)
    expect(actorFootPivot2D('jadeSerpentS', 6)).toBeCloseTo(244 / 256)
    expect(actorFootPivot2D('jadeShardGuardian', 0)).toBeCloseTo(223 / 256)
    expect(actorFootPivot2D('jadeShardGuardian', 6)).toBeCloseTo(230 / 256)
    expect(actorFootPivot2D('maskedSealRevenant', 0)).toBeCloseTo(217 / 256)
    expect(actorFootPivot2D('maskedSealRevenant', 3)).toBeCloseTo(223 / 256)
    expect(actorFootPivot2D('shadowSealDuelist', 0)).toBeCloseTo(232 / 256)
    expect(actorFootPivot2D('shadowSealDuelist', 6)).toBeCloseTo(217 / 256)
    expect(actorFootPivot2D('wisp', 0)).toBeCloseTo(0.902)
    expect(actorFootPivot2D('wisp', 5)).toBeCloseTo(0.848)
    expect(actorFootPivot2D('prop', 15)).toBe(actorFootPivot2D('prop', 7))
  })

  it('keeps all northeast heroine run and attack frames on one contact row', () => {
    const pivots = Array.from({ length: 16 }, (_, frame) => heroFootPivot2D('ne', frame))
    expect(pivots).toEqual(Array(16).fill(242 / 256))
  })

  it('uses silhouette-specific contact shadows and restrained separation light', () => {
    const scorpion = actorGroundingProfile2D('bloodScorpion')
    const serpent = actorGroundingProfile2D('jadeSerpent')
    const shardGuardian = actorGroundingProfile2D('jadeShardGuardian')
    const maskedSealRevenant = actorGroundingProfile2D('maskedSealRevenant')
    const wisp = actorGroundingProfile2D('wisp')
    const pillar = actorGroundingProfile2D('prop', 2)
    const fence = actorGroundingProfile2D('prop', 6)

    expect(scorpion.shadowWidth).toBeGreaterThan(serpent.shadowWidth)
    expect(shardGuardian.shadowWidth).toBeLessThan(actorGroundingProfile2D('jadeStoneGhoul').shadowWidth)
    expect(maskedSealRevenant.shadowWidth).toBeGreaterThan(actorGroundingProfile2D('talismanRevenant').shadowWidth)
    expect(maskedSealRevenant.contactAlpha).toBeLessThan(actorGroundingProfile2D('talismanRevenant').contactAlpha)
    expect(wisp.shadowAlpha).toBeLessThanOrEqual(0.65)
    expect(fence.shadowWidth).toBeGreaterThan(pillar.shadowWidth)
    expect(pillar.contactAlpha).toBe(0)
    expect(fence.contactAlpha).toBe(0)
    // Contact lights are disabled for scenery; their stored dimensions are
    // irrelevant as long as no luminous platform can be rendered.
    expect(new Set([scorpion.contactTint, serpent.contactTint, wisp.contactTint]).size).toBeGreaterThanOrEqual(2)
    expect(Math.min(scorpion.contactAlpha, serpent.contactAlpha)).toBe(0)
    expect(Math.max(scorpion.contactAlpha, serpent.contactAlpha, wisp.contactAlpha)).toBeLessThanOrEqual(0.13)
    const yorang = actorGroundingProfile2D('yorang')
    const jadeRidgeHound = actorGroundingProfile2D('jadeRidgeHound')
    expect(yorang.visualScale).toBeCloseTo(1.42)
    expect(yorang.contactLift).toBeLessThanOrEqual(0.02)
    expect(yorang.contactWidth).toBeLessThanOrEqual(yorang.shadowWidth)
    expect(yorang.contactHeight).toBeLessThanOrEqual(0.16)
    expect(yorang.contactAlpha).toBe(0)
    expect(jadeRidgeHound.visualScale).toBeCloseTo(yorang.visualScale)
    expect(jadeRidgeHound.contactHeight).toBeLessThanOrEqual(0.16)
    expect(jadeRidgeHound.contactTint).not.toBe(yorang.contactTint)
    expect(yorang.shadowAlpha).toBeLessThanOrEqual(0.6)
    expect(Math.max(scorpion.visualScale, serpent.visualScale, wisp.visualScale)).toBeLessThanOrEqual(1.42)
    expect(PROP_MATERIAL_TINTS_2D).toHaveLength(8)
    expect(PROP_MATERIAL_TINTS_2D.every((tint) => tint < 0xffffff)).toBe(true)
    expect(new Set(PROP_MATERIAL_TINTS_2D).size).toBeGreaterThanOrEqual(6)
    expect(Object.keys(REGION_TERRAIN_PRESENTATION_2D)).toEqual(expect.arrayContaining([
      'spawn_grove', 'jade_path', 'jade_grove', 'lantern_shrine', 'mist_marsh', 'void_rim',
    ]))
  })

  it('keeps the heroine marker flat, compact and non-rotating', () => {
    expect(HERO_GROUND_MARKER_2D.rotation).toBe(0)
    expect(HERO_GROUND_MARKER_2D.heightRatio / HERO_GROUND_MARKER_2D.widthRatio).toBeLessThan(0.3)
    expect(HERO_GROUND_MARKER_2D.widthRatio).toBeLessThanOrEqual(0.48)
    expect(HERO_GROUND_MARKER_2D.alpha).toBeLessThanOrEqual(0.14)
    expect(HERO_GROUND_MARKER_2D.offsetY).toBeLessThanOrEqual(2)
    expect(HERO_AURA_PRESENTATION_2D.widthRatio).toBeLessThanOrEqual(0.68)
    expect(HERO_AURA_PRESENTATION_2D.alpha).toBeLessThanOrEqual(0.12)
    expect(HERO_AURA_PRESENTATION_2D.invulnerableAlpha).toBeGreaterThan(HERO_AURA_PRESENTATION_2D.alpha)
  })

  it('meets the authored heroine occupancy targets at both release viewports', () => {
    expect(heroCombatHeight2D(1080, 140)).toBeCloseTo(196)
    expect(heroCombatHeight2D(1600, 140)).toBeCloseTo(276)
    expect(heroCombatHeight2D(1600, 140) / heroCombatHeight2D(1080, 140)).toBeCloseTo(276 / 196)
    expect(heroCombatHeight2D(720, 140)).toBeCloseTo(134)
    expect(heroCombatHeight2D(1080, 160)).toBeGreaterThan(196)
  })

  it('keeps bosses above a measurable screen occupancy floor', () => {
    expect(bossCombatHeight2D(1080, 120, 1)).toBeCloseTo(1080 * BOSS_MIN_SCREEN_HEIGHT_RATIO_2D)
    expect(bossCombatHeight2D(1600, 120, 1.333)).toBeGreaterThanOrEqual(1600 * BOSS_MIN_SCREEN_HEIGHT_RATIO_2D)
    expect(bossCombatHeight2D(1600, 220, 1.333)).toBeGreaterThanOrEqual(220 * 1.333)
  })

  it('dims only nearby ordinary mobs during an active boss encounter', () => {
    expect(enemyBossFocusAlpha2D(0, true, false)).toBeCloseTo(0.42)
    expect(enemyBossFocusAlpha2D(4, true, false)).toBeLessThan(1)
    expect(enemyBossFocusAlpha2D(8, true, false)).toBe(1)
    expect(enemyBossFocusAlpha2D(2, true, true)).toBe(1)
    expect(enemyBossFocusAlpha2D(2, false, false)).toBe(1)
  })

  it('lightens the terrain grade without removing its value structure', () => {
    expect(TERRAIN_GRADE_2D.alpha).toBeLessThan(0.6)
    expect(TERRAIN_GRADE_2D.edgeVignetteAlpha).toBeLessThan(0.35)
    expect(TERRAIN_GRADE_2D.topDepthAlpha).toBeLessThan(0.16)
    expect(TERRAIN_GRADE_2D.bottomDepthAlpha).toBeLessThan(0.09)
  })

  it('uses a subtle normal-blend ink rim instead of a detached additive copy', () => {
    expect(HERO_READABILITY_RIM_2D.scale).toBeGreaterThan(1)
    expect(HERO_READABILITY_RIM_2D.scale).toBeLessThanOrEqual(1.045)
    expect(HERO_READABILITY_RIM_2D.alpha).toBeGreaterThanOrEqual(0.35)
    expect(HERO_READABILITY_RIM_2D.alpha).toBeLessThanOrEqual(0.52)
    expect(HERO_READABILITY_RIM_2D.invulnerableAlpha).toBeLessThan(HERO_READABILITY_RIM_2D.alpha)
    expect(HERO_READABILITY_RIM_2D.zOffset).toBeLessThan(0)
    expect(HERO_READABILITY_RIM_2D.tint).not.toBe(0xffffff)
    expect(HERO_READABILITY_RIM_2D.hitTint).not.toBe(HERO_READABILITY_RIM_2D.tint)
  })

  it('applies the selected grounding profile in actor placement', () => {
    const sprite = {
      texture: { height: 256 },
      scale: { set: vi.fn() },
      position: { set: vi.fn() },
      visible: false,
      parent: null,
    }
    const shadow = { position: { set: vi.fn() }, visible: false }
    const buckets = Array.from({ length: 64 }, () => ({ addChild: vi.fn() }))
    const presentation = Object.create(PixiPresentation.prototype)
    Object.assign(presentation, {
      cameraX: 0,
      cameraZ: 0,
      viewport: { width: 1280, height: 720, zoom: 1 },
      actorBuckets: buckets,
    })
    const entry = { sprite, shadow, bucket: -1, key: 'bloodScorpion', frame: 0 }

    presentation._placeActor(entry, 0, 0, 100, 1, 0, 0xffffff)

    const profile = actorGroundingProfile2D('bloodScorpion')
    expect(shadow.width).toBeCloseTo(100 * profile.shadowWidth)
    expect(shadow.height).toBeCloseTo(Math.max(profile.minShadowHeight, 100 * profile.shadowHeight))
    expect(shadow.alpha).toBeCloseTo(profile.shadowAlpha)
    expect(shadow.position.set).toHaveBeenCalledWith(expect.any(Number), expect.any(Number))
  })

  it('renders investigation evidence as three dedicated grounded trace silhouettes', () => {
    expect(Object.keys(INVESTIGATION_TRACE_PRESENTATION_2D)).toEqual([
      'sword-scar', 'beast-trail', 'seal-ash',
    ])
    expect(new Set(Object.values(INVESTIGATION_TRACE_PRESENTATION_2D).map((trace) => trace.texture)).size).toBe(3)
    expect(Object.values(INVESTIGATION_TRACE_PRESENTATION_2D).every((trace) => trace.height < trace.width)).toBe(true)
    expect(INVESTIGATION_TRACE_PRESENTATION_2D['sword-scar'].width).toBeGreaterThanOrEqual(140)
    expect(INVESTIGATION_TRACE_PRESENTATION_2D['beast-trail'].width).toBeGreaterThanOrEqual(130)
  })

  it('keeps scenery contact shadows while the upper sprite fades around the heroine', () => {
    const sprite = {
      texture: { height: 256 }, scale: { set: vi.fn() }, position: { set: vi.fn() },
      visible: false, parent: null,
    }
    const shadow = { position: { set: vi.fn() }, visible: false }
    const presentation = Object.create(PixiPresentation.prototype)
    Object.assign(presentation, {
      cameraX: 0, cameraZ: 0,
      viewport: { width: 1280, height: 720, zoom: 1 },
      actorBuckets: Array.from({ length: 64 }, () => ({ addChild: vi.fn() })),
    })
    presentation._placeActor({
      sprite, shadow, bucket: -1, key: 'prop', groundingKey: 'prop', frame: 1,
    }, 0, 0, 100, 0.22, 0, 0xffffff)
    expect(shadow.alpha).toBeCloseTo(actorGroundingProfile2D('prop', 1).shadowAlpha * 0.72)
  })
})
