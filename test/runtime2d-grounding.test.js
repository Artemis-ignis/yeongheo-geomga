import { describe, expect, it, vi } from 'vitest'
import {
  HERO_GROUND_MARKER_2D,
  HERO_AURA_PRESENTATION_2D,
  HERO_READABILITY_RIM_2D,
  BOSS_MIN_SCREEN_HEIGHT_RATIO_2D,
  JADE_GROUND_COMPOSITION_2D,
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
} from '../src/runtime2d/PixiPresentation.js'

describe('runtime 2D grounding and terrain integration', () => {
  it('composes jade from a seamless material and world-anchored regional detail', () => {
    expect(JADE_GROUND_COMPOSITION_2D.base).toBe('procedural-authored-material-composite')
    expect(JADE_GROUND_COMPOSITION_2D.baseAsset).toBe('jade-sanctuary-ground-material-v2')
    expect(JADE_GROUND_COMPOSITION_2D.fallbackAsset).toBe('jade-highland-ground-v1')
    expect(JADE_GROUND_COMPOSITION_2D.authoredDetail).toBe('world-anchored-procedural-region-decals')
    expect(JADE_GROUND_COMPOSITION_2D.repeatsAuthoredPlate).toBe(false)
    expect(JADE_GROUND_COMPOSITION_2D.baseTiling).toBe('periodic-wrapped-material-islands')
    expect(JADE_GROUND_COMPOSITION_2D.synthesisSize).toBeLessThanOrEqual(1536)
    expect(JADE_GROUND_COMPOSITION_2D.authoredCropMode).toBe('multi-crop-rotated-soft-islands')
    expect(JADE_GROUND_COMPOSITION_2D.landmarkMotifs).toBe('seed-specific-procedural')
    expect(JADE_GROUND_COMPOSITION_2D.decalOverlap).toBeGreaterThanOrEqual(1.1)
    expect(JADE_GROUND_COMPOSITION_2D.decalEdgeFeather).toBeGreaterThanOrEqual(72)
    expect(JADE_GROUND_COMPOSITION_2D.decalAlpha).toBeGreaterThanOrEqual(0.9)
    expect(JADE_GROUND_COMPOSITION_2D.floorTileScale.x).toBeLessThanOrEqual(1)
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

  it('anchors every high-variance family to its sampled opaque contact row', () => {
    expect(heroFootPivot2D('n', 1)).toBeCloseTo(0.898)
    expect(heroFootPivot2D('s', 0)).toBeCloseTo(0.961)
    expect(actorFootPivot2D('prop', 7)).toBeCloseTo(0.758)
    expect(actorFootPivot2D('prop', 2)).toBeCloseTo(0.867)
    expect(actorFootPivot2D('bloodScorpion', 4)).toBeCloseTo(0.742)
    expect(actorFootPivot2D('yorang', 5)).toBeCloseTo(0.727)
    expect(actorFootPivot2D('jadeStoneGhoul', 0)).toBeCloseTo(0.953)
    expect(actorFootPivot2D('prop', 15)).toBe(actorFootPivot2D('prop', 7))
  })

  it('keeps all northeast heroine frames on the measured opaque contact row', () => {
    const pivots = Array.from({ length: 8 }, (_, frame) => heroFootPivot2D('ne', frame))
    expect(pivots).toEqual(Array(8).fill(244 / 256))
  })

  it('uses silhouette-specific contact shadows and restrained separation light', () => {
    const scorpion = actorGroundingProfile2D('bloodScorpion')
    const serpent = actorGroundingProfile2D('jadeSerpent')
    const wisp = actorGroundingProfile2D('wisp')
    const pillar = actorGroundingProfile2D('prop', 2)
    const fence = actorGroundingProfile2D('prop', 6)

    expect(scorpion.shadowWidth).toBeGreaterThan(serpent.shadowWidth)
    expect(wisp.shadowAlpha).toBeLessThan(serpent.shadowAlpha)
    expect(fence.shadowWidth).toBeGreaterThan(pillar.shadowWidth)
    expect(new Set([scorpion.contactTint, serpent.contactTint, wisp.contactTint]).size).toBe(3)
    expect(Math.min(scorpion.contactAlpha, serpent.contactAlpha, wisp.contactAlpha)).toBeGreaterThanOrEqual(0.3)
    expect(Math.max(scorpion.contactAlpha, serpent.contactAlpha, wisp.contactAlpha)).toBeLessThanOrEqual(0.46)
    const yorang = actorGroundingProfile2D('yorang')
    expect(yorang.visualScale).toBeCloseTo(1.55)
    expect(yorang.contactLift).toBeLessThanOrEqual(0.02)
    expect(yorang.contactWidth).toBeLessThanOrEqual(yorang.shadowWidth)
    expect(yorang.contactHeight).toBeLessThanOrEqual(0.16)
    expect(yorang.contactAlpha).toBeGreaterThanOrEqual(0.16)
    expect(yorang.contactAlpha).toBeLessThanOrEqual(0.24)
    expect(yorang.shadowAlpha).toBeGreaterThanOrEqual(0.84)
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
    expect(heroCombatHeight2D(1080, 140)).toBeCloseTo(176)
    expect(heroCombatHeight2D(1600, 140)).toBeCloseTo(248)
    expect(heroCombatHeight2D(1600, 140) / heroCombatHeight2D(1080, 140)).toBeCloseTo(248 / 176)
    expect(heroCombatHeight2D(720, 140)).toBeCloseTo(118)
    expect(heroCombatHeight2D(1080, 160)).toBeGreaterThan(176)
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

    expect(shadow.width).toBeCloseTo(86)
    expect(shadow.height).toBeCloseTo(9.5)
    expect(shadow.alpha).toBeCloseTo(0.86)
    expect(shadow.position.set).toHaveBeenCalledWith(expect.any(Number), expect.any(Number))
  })
})
