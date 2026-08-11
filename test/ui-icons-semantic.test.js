import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { iconFor } from '../src/ui/icons.js'
import { DAO_ICON_IDS_2D } from '../src/runtime2d/Game2D.js'
import { ENEMIES } from '../src/data/enemies.js'
import { BOSSES } from '../src/data/bosses.js'

const RELEASE_CHOICE_IDS = Object.freeze([
  'flyingSword', 'fireTalisman', 'thunderOrb', 'baguaArray',
  'myriadSwords', 'infernoSea', 'violetThunder',
  'swordArt', 'lightBody', 'guardianAura', 'spiritRoot', 'farSight',
  'goldenCore', 'heartMethod', 'swordRiding', 'cloneArt', 'destinedBond',
  'sword', 'returning-edge', 'piercing-edge', 'sword-ring',
  'frost', 'frost-shards', 'frost-line', 'ice-wall',
  'spirit', 'purifying-heart', 'echoing-heart', 'shadow-copy',
])

describe('release choice icon identity', () => {
  it('gives all 29 Jade and Seolryeong release choices distinct authored art', () => {
    const urls = RELEASE_CHOICE_IDS.map((id) => iconFor(id))
    expect(urls).toHaveLength(29)
    expect(new Set(urls).size).toBe(29)
    expect(urls.every((url) => url.includes('assets/ui/skill-icons-v'))).toBe(true)
  })

  it('keeps every Dao card on its exact semantic icon id', () => {
    expect(Object.keys(DAO_ICON_IDS_2D)).toEqual(RELEASE_CHOICE_IDS.slice(17))
    for (const [choiceId, iconId] of Object.entries(DAO_ICON_IDS_2D)) {
      expect(iconId).toBe(choiceId)
      expect(iconFor(iconId)).toContain('assets/ui/skill-icons-v2/')
    }
  })

  it('ships every authored v2 URL as a source asset', () => {
    const ids = [...RELEASE_CHOICE_IDS, 'venomMist', 'hiddenNeedles', 'bellToll',
      'windBlade', 'earthSpike', 'skyThunder', 'frozenSky', 'plagueTide',
      'needleStorm', 'voidOrb', 'heal', 'stones', 'purge']
    for (const id of ids) {
      const url = iconFor(id)
      if (!url.includes('skill-icons-v2/')) continue
      const relative = url.slice(url.indexOf('assets/'))
      expect(fs.existsSync(path.resolve('public', relative)), `${id}: ${relative}`).toBe(true)
    }
  })

  it('never falls back to a data-url for any current release choice id', () => {
    const ids = [
      ...RELEASE_CHOICE_IDS,
      'flyingSword', 'fireTalisman', 'thunderOrb', 'frostPalm', 'baguaArray',
      'vajra', 'spiritButterfly', 'venomMist', 'hiddenNeedles', 'bellToll',
      'windBlade', 'earthSpike', 'voidOrb', 'skyThunder',
      'myriadSwords', 'infernoSea', 'violetThunder', 'frozenSky', 'plagueTide',
      'needleStorm', ...Object.keys(DAO_ICON_IDS_2D), 'heartMethod', 'swordRiding',
      'cloneArt', 'destinedBond', 'heal', 'stones', 'purge',
    ]
    for (const id of ids) {
      expect(iconFor(id), `${id} should use authored release art`).toContain('assets/ui/skill-icons-v')
    }
  })

  it('keeps permanent shop groups semantically distinct and retires snowflake', () => {
    expect(new Set(['vitality', 'mending', 'revive'].map(iconFor)).size).toBe(3)
    expect(new Set(['fortune', 'insightRoll'].map(iconFor)).size).toBe(2)
    expect(iconFor('snowflake')).toBe(iconFor('frost'))
  })

  it('provides a non-empty codex description for every creature entry', () => {
    const creatures = [...ENEMIES, ...Object.values(BOSSES)]
    expect(creatures).toHaveLength(17)
    expect(creatures.every((entry) => typeof entry.desc === 'string' && entry.desc.trim().length > 0)).toBe(true)
  })
})
