import { describe, it, expect } from 'vitest'
import { deltaE, minDeltaE } from '../src/art/contrast.js'
import { PICKUP_COLORS } from '../src/entities/PickupManager.js'
import { STAGES } from '../src/data/stages.js'
import { getEnemy } from '../src/data/enemies.js'
import { measureModel } from '../src/art/modelGates.js'
import { buildEnemyGeometry } from '../src/art/enemyGeometry.js'

/**
 * What a creature or a drop has to be picked out from, split by how much of the
 * screen each tone actually covers.
 *
 * `bulk` is the ground and the base of the grass — the large flat areas that
 * fill most of a frame. `accent` is the grass tips and the moss, which are the
 * lit edge of a blade and a texture wash: real, but a minority of pixels and
 * broken up rather than continuous.
 *
 * Holding both to one threshold produced a contradiction on 한천비경, whose
 * field legitimately spans dark violet ground to near-white highlights. Nothing
 * can be far from both ends of that range, and chasing it moved 설랑 from ΔE 11
 * against the ground to ΔE 4.5 against the highlights. The bar has to reflect
 * which one the player is actually looking at.
 */
function fieldOf(stage) {
  const p = stage.palette
  return { bulk: [p.ground, p.grassBase], accent: [p.grassTip, p.groundMoss] }
}

describe('drops stay legible on every stage', () => {
  for (const stage of STAGES) {
    for (const [kind, hex] of Object.entries(PICKUP_COLORS)) {
      it(`"${kind}" reads on ${stage.name}`, () => {
        const f = fieldOf(stage)
        const bulk = minDeltaE(hex, f.bulk)
        const accent = minDeltaE(hex, f.accent)
        expect(
          bulk,
          `${kind} (#${hex.toString(16)}) is ΔE ${bulk.toFixed(1)} from the ${stage.id} ground`,
        ).toBeGreaterThan(28)
        expect(
          accent,
          `${kind} (#${hex.toString(16)}) is ΔE ${accent.toFixed(1)} from the ${stage.id} highlights`,
        ).toBeGreaterThan(15)
      })
    }
  }

  it('keeps the drop kinds apart from each other', () => {
    const entries = Object.entries(PICKUP_COLORS)
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        // 상자 and 영석 are both treasure and are deliberately close; everything
        // else has to be tellable apart at a glance.
        const pair = [entries[i][0], entries[j][0]].sort().join('+')
        if (pair === 'chest+stone') continue
        const d = deltaE(entries[i][1], entries[j][1])
        expect(d, `${pair} are only ΔE ${d.toFixed(1)} apart`).toBeGreaterThan(25)
      }
    }
  })
})

/**
 * Measured from the built geometry's vertex colours, which is what the renderer
 * draws. The `color` field on the enemy table is never read by anything.
 */
const dominantOf = (id) => measureModel(buildEnemyGeometry(id)).dominant

describe('creatures stay legible on the stages that field them', () => {
  for (const stage of STAGES) {
    it(`every ${stage.name} creature separates from its ground`, () => {
      const f = fieldOf(stage)
      const weak = []
      for (const id of stage.roster ?? []) {
        const c = dominantOf(id)
        const bulk = minDeltaE(c, f.bulk)
        const accent = minDeltaE(c, f.accent)
        if (bulk <= 18) weak.push(`${getEnemy(id).name} ΔE ${bulk.toFixed(1)} vs ground`)
        else if (accent <= 9) weak.push(`${getEnemy(id).name} ΔE ${accent.toFixed(1)} vs highlights`)
      }
      expect(weak, `too close to the ${stage.id} field: ${weak.join(', ')}`).toEqual([])
    })
  }
})
