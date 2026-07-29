import { describe, it, expect } from 'vitest'
import { deltaE, minDeltaE } from '../src/art/contrast.js'
import { PICKUP_COLORS } from '../src/entities/PickupManager.js'
import { STAGES } from '../src/data/stages.js'
import { getEnemy } from '../src/data/enemies.js'
import { measureModel } from '../src/art/modelGates.js'
import { buildEnemyGeometry } from '../src/art/enemyGeometry.js'

/** The large flat areas a drop or a creature has to be picked out from. */
function fieldOf(stage) {
  const p = stage.palette
  return [p.ground, p.grassBase, p.grassTip, p.groundMoss]
}

describe('drops stay legible on every stage', () => {
  for (const stage of STAGES) {
    for (const [kind, hex] of Object.entries(PICKUP_COLORS)) {
      it(`"${kind}" reads on ${stage.name}`, () => {
        const d = minDeltaE(hex, fieldOf(stage))
        expect(
          d,
          `${kind} (#${hex.toString(16)}) is ΔE ${d.toFixed(1)} from the ${stage.id} field`,
        ).toBeGreaterThan(28)
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
      const field = fieldOf(stage)
      const weak = []
      for (const id of stage.roster ?? []) {
        const d = minDeltaE(dominantOf(id), field)
        if (d <= 18) weak.push(`${getEnemy(id).name} ΔE ${d.toFixed(1)}`)
      }
      expect(weak, `too close to the ${stage.id} field: ${weak.join(', ')}`).toEqual([])
    })
  }
})
