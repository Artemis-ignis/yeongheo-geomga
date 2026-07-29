import { describe, it, expect } from 'vitest'
import { measureModel, checkModel, CREATURE_GATES, silhouetteLikeness } from '../src/art/modelGates.js'
import { buildEnemyGeometry } from '../src/art/enemyGeometry.js'
import { buildBossGeometry } from '../src/art/bossGeometry.js'
import { ENEMIES } from '../src/data/enemies.js'
import { STAGES } from '../src/data/stages.js'
import { WAVES } from '../src/data/waves.js'

const BOSS_IDS = [...new Set(STAGES.flatMap((s) => [s.bosses.mid, s.bosses.final]))]

describe('every creature has a geometry builder', () => {
  it('builds a model for every enemy in the table', () => {
    for (const e of ENEMIES) {
      expect(() => buildEnemyGeometry(e.id), `enemy "${e.id}" has no model`).not.toThrow()
    }
  })

  it('builds a model for every boss a stage can field', () => {
    for (const id of BOSS_IDS) {
      expect(() => buildBossGeometry(id), `boss "${id}" has no model`).not.toThrow()
    }
  })
})

describe('creature model quality gates', () => {
  // One measurement per model, shared across the assertions below.
  const measured = ENEMIES.map((e) => ({ id: e.id, m: measureModel(buildEnemyGeometry(e.id)) }))
    .concat(BOSS_IDS.map((id) => ({ id, m: measureModel(buildBossGeometry(id)) })))

  for (const { id, m } of measured) {
    it(`"${id}" reads as a creature, not a lump`, () => {
      const failures = checkModel(m, CREATURE_GATES)
      expect(failures, `${id}: ${failures.join('; ')}`).toEqual([])
    })
  }

  it('carries vertex colours on every model', () => {
    for (const { id, m } of measured) {
      expect(m.colours, `"${id}" is a single flat colour`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps the horde inside a sane triangle budget', () => {
    // Rank-and-file enemies draw by the hundred; bosses draw one at a time.
    const elite = new Set(ENEMIES.filter((e) => e.elite).map((e) => e.id))
    for (const { id, m } of measured) {
      if (BOSS_IDS.includes(id) || elite.has(id)) continue
      expect(m.triangles, `"${id}" is too heavy for the horde`).toBeLessThan(3000)
    }
  })
})

describe('no two creatures on a stage share a silhouette', () => {
  // Absolute complexity says whether a shape is articulated. This says whether
  // the player can tell two of them apart mid-fight, which is the question that
  // actually decides whether a crowd is readable. Only creatures that can be on
  // screen together are compared — 석귀 and 용암귀 look alike but belong to
  // different 비경 and never meet.
  for (const stage of STAGES) {
    it(`every ${stage.name} pairing is distinguishable`, () => {
      const roster = stage.roster ?? ENEMIES.map((e) => e.id)
      const geo = new Map(roster.map((id) => [id, buildEnemyGeometry(id)]))
      const clashes = []
      for (let i = 0; i < roster.length; i++) {
        for (let j = i + 1; j < roster.length; j++) {
          const like = silhouetteLikeness(geo.get(roster[i]), geo.get(roster[j]))
          if (like > 0.72) clashes.push(`${roster[i]}/${roster[j]} ${like.toFixed(2)}`)
        }
      }
      expect(clashes, `too alike on ${stage.id}: ${clashes.join(', ')}`).toEqual([])
    })
  }
})

describe('stage rosters', () => {
  it('names only enemies that exist', () => {
    const known = new Set(ENEMIES.map((e) => e.id))
    for (const s of STAGES) {
      for (const id of s.roster ?? []) {
        expect(known.has(id), `stage "${s.id}" rosters unknown enemy "${id}"`).toBe(true)
      }
    }
  })

  it('gives every stage a creature the other stages do not field', () => {
    for (const s of STAGES) {
      const others = new Set(STAGES.filter((o) => o.id !== s.id).flatMap((o) => o.roster ?? []))
      const unique = (s.roster ?? []).filter((id) => !others.has(id))
      expect(unique.length, `stage "${s.id}" fields nothing of its own`).toBeGreaterThan(0)
    }
  })

  it('leaves every wave band spawnable on every stage without falling back', () => {
    for (const s of STAGES) {
      for (const w of WAVES) {
        const allowed = (w.types ?? []).filter((t) => !s.roster || s.roster.includes(t))
        expect(
          allowed.length,
          `stage "${s.id}" filters the t=${w.t} band down to nothing`,
        ).toBeGreaterThan(0)
      }
    }
  })
})
