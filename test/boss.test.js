import { describe, it, expect } from 'vitest'
import { BOSS_PATTERNS, BOSSES } from '../src/entities/BossManager.js'

describe('boss move patterns', () => {
  it('covers every boss that a stage can field', () => {
    for (const id of Object.keys(BOSSES)) {
      expect(BOSS_PATTERNS[id], `"${id}" has no pattern`).toBeDefined()
    }
  })

  it('gives each boss three phases', () => {
    for (const [id, phases] of Object.entries(BOSS_PATTERNS)) {
      expect(phases.length, `"${id}" does not have three phases`).toBe(3)
    }
  })

  it('never shrinks a phase below the one before it', () => {
    // A later phase that offered fewer options would make the boss get simpler
    // as it gets more dangerous, which reads as the fight running out of ideas.
    for (const [id, phases] of Object.entries(BOSS_PATTERNS)) {
      for (let i = 1; i < phases.length; i++) {
        expect(
          phases[i].length,
          `"${id}" phase ${i + 1} has fewer moves than phase ${i}`,
        ).toBeGreaterThanOrEqual(phases[i - 1].length)
      }
    }
  })

  it('adds something to the moveset in the final phase', () => {
    for (const [id, phases] of Object.entries(BOSS_PATTERNS)) {
      const early = new Set(phases[0])
      const late = phases[phases.length - 1]
      expect(
        late.some((m) => !early.has(m)),
        `"${id}" ends the fight with nothing the player has not already seen`,
      ).toBe(true)
    }
  })

  it('never repeats a move back to back inside one cycle', () => {
    for (const [id, phases] of Object.entries(BOSS_PATTERNS)) {
      for (const [i, cycle] of phases.entries()) {
        for (let k = 0; k < cycle.length; k++) {
          const next = cycle[(k + 1) % cycle.length]
          expect(
            cycle[k] === next && cycle.length > 1,
            `"${id}" phase ${i + 1} plays ${cycle[k]} twice in a row`,
          ).toBe(false)
        }
      }
    }
  })
})

describe('boss stats', () => {
  it('makes the final boss the harder of the two', () => {
    expect(BOSSES.darkHeavenLord.hp).toBeGreaterThan(BOSSES.blueWolfKing.hp)
    expect(BOSSES.darkHeavenLord.damage).toBeGreaterThan(BOSSES.blueWolfKing.damage)
  })

  it('keeps both far above any ordinary creature', () => {
    for (const b of Object.values(BOSSES)) {
      expect(b.hp).toBeGreaterThan(2000)
      expect(b.radius).toBeGreaterThan(1.5)
    }
  })
})
