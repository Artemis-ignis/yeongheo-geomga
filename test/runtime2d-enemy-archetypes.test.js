import { describe, expect, it } from 'vitest'
import { getBoss } from '../src/data/bosses.js'
import { getEnemy } from '../src/data/enemies.js'
import {
  ENEMY_ARCHETYPES_2D,
  ENEMY_ARCHETYPE_IDS_2D,
  buildEnemyRuntimeProfile2D,
  classifyEnemyArchetype2D,
  getEnemyArchetype2D,
  getEnemyDifficultyScaling2D,
} from '../src/runtime2d/EnemyArchetypes2D.js'

describe('EnemyArchetypes2D', () => {
  it('defines the complete six-role contract with readable behavior and visual metadata', () => {
    expect(ENEMY_ARCHETYPE_IDS_2D).toEqual(['grunt', 'charger', 'ranged', 'tank', 'elite', 'boss'])
    for (const id of ENEMY_ARCHETYPE_IDS_2D) {
      const archetype = getEnemyArchetype2D(id)
      expect(archetype.stats.hp, id).toBeGreaterThan(0)
      expect(archetype.behavior.tags.length, id).toBeGreaterThanOrEqual(3)
      expect(archetype.visual.runtimeHeight, id).toHaveLength(2)
      expect(archetype.visual.runtimeHeight[1], id).toBeGreaterThan(archetype.visual.runtimeHeight[0])
      expect(archetype.visual.silhouette, id).toBeTruthy()
      expect(Object.isFrozen(archetype.behavior.tags), id).toBe(true)
    }
    expect(getEnemyArchetype2D('missing')).toBeNull()
  })

  it('classifies current authored enemies and bosses without renderer knowledge', () => {
    expect(classifyEnemyArchetype2D(getEnemy('wisp'))).toBe('grunt')
    expect(classifyEnemyArchetype2D(getEnemy('jadeSerpent'))).toBe('charger')
    expect(classifyEnemyArchetype2D(getEnemy('talismanGhost'))).toBe('ranged')
    expect(classifyEnemyArchetype2D(getEnemy('stoneGhoul'))).toBe('tank')
    expect(classifyEnemyArchetype2D(getEnemy('demonCultivator'))).toBe('elite')
    expect(classifyEnemyArchetype2D(getBoss('jadeVoidWarden'))).toBe('boss')
  })

  it('preserves authored stats at the normal opening while filling presentation contracts', () => {
    const authored = getEnemy('jadeSerpent')
    const profile = buildEnemyRuntimeProfile2D(authored)
    expect(profile.archetypeId).toBe('charger')
    expect(profile.stats.hp).toBe(authored.hp)
    expect(profile.stats.damage).toBe(authored.damage)
    expect(profile.stats.speed).toBe(authored.speed)
    expect(profile.stats.radius).toBe(authored.radius)
    expect(profile.stats.xp).toBe(authored.xp)
    expect(profile.behavior.tags).toContain('windup')
    expect(profile.visual.marker).toBe('lane')
    expect(profile.visual.accent).toBe(authored.color)
  })

  it('scales pressure monotonically but never scales pursuit speed over time', () => {
    const opening = getEnemyDifficultyScaling2D({ elapsedSeconds: 0, archetype: 'grunt' })
    const late = getEnemyDifficultyScaling2D({ elapsedSeconds: 15 * 60, archetype: 'grunt' })
    const nightmare = getEnemyDifficultyScaling2D({
      difficulty: 'nightmare', elapsedSeconds: 15 * 60, archetype: 'grunt',
    })
    expect(late.hp).toBeGreaterThan(opening.hp)
    expect(late.damage).toBeGreaterThan(opening.damage)
    expect(nightmare.hp).toBeGreaterThan(late.hp)
    expect(nightmare.damage).toBeGreaterThan(late.damage)
    expect(opening.speed).toBe(1)
    expect(late.speed).toBe(1)
    expect(nightmare.speed).toBe(1)
  })

  it('does not double-scale encounter-authored bosses by their spawn time', () => {
    const boss = getBoss('jadeVoidWarden')
    const opening = buildEnemyRuntimeProfile2D(boss, { elapsedSeconds: 0 })
    const final = buildEnemyRuntimeProfile2D(boss, { elapsedSeconds: 15 * 60 })
    expect(opening.stats.hp).toBe(boss.hp)
    expect(final.stats.hp).toBe(boss.hp)
    expect(final.stats.damage).toBe(boss.damage)
    expect(final.behavior.tags).toContain('phase')
    expect(final.visual.healthBar).toBe('boss')
  })

  it('returns immutable profiles and rejects unknown configuration keys', () => {
    const profile = buildEnemyRuntimeProfile2D({}, { archetype: 'ranged' })
    expect(Object.isFrozen(profile)).toBe(true)
    expect(Object.isFrozen(profile.stats)).toBe(true)
    expect(Object.isFrozen(profile.behavior.tags)).toBe(true)
    expect(ENEMY_ARCHETYPES_2D.ranged.stats.hp).toBe(64)
    expect(() => getEnemyDifficultyScaling2D({ difficulty: 'impossible' })).toThrow(RangeError)
    expect(() => getEnemyDifficultyScaling2D({ archetype: 'unknown' })).toThrow(RangeError)
  })
})
