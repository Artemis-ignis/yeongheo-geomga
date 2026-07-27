import { describe, it, expect } from 'vitest'
import { load, save, reset, defaultSave, memoryStorage, SAVE_KEY, SAVE_VERSION } from '../src/meta/Save.js'
import { STARTING_CHARACTERS, STARTING_WEAPONS } from '../src/data/unlocks.js'

/** A storage that throws on every access, like a blocked private-mode one. */
function hostileStorage() {
  return {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
    removeItem() { throw new Error('blocked') },
  }
}

describe('defaultSave', () => {
  it('starts with no stones and no upgrades', () => {
    const s = defaultSave()
    expect(s.stones).toBe(0)
    expect(s.upgrades).toEqual({})
  })

  it('starts with the free characters and weapons unlocked', () => {
    const s = defaultSave()
    expect(s.unlockedCharacters).toEqual(STARTING_CHARACTERS)
    expect(s.unlockedWeapons).toEqual(STARTING_WEAPONS)
  })

  it('does not share arrays between calls', () => {
    const a = defaultSave()
    a.unlockedWeapons.push('vajra')
    expect(defaultSave().unlockedWeapons).not.toContain('vajra')
  })
})

describe('save / load round trip', () => {
  it('returns a default save when storage is empty', () => {
    expect(load(memoryStorage()).stones).toBe(0)
  })

  it('reads back exactly what was written', () => {
    const storage = memoryStorage()
    const s = defaultSave()
    s.stones = 1234
    s.upgrades.vitality = 3
    s.unlockedWeapons.push('vajra')
    save(s, storage)

    const back = load(storage)
    expect(back.stones).toBe(1234)
    expect(back.upgrades.vitality).toBe(3)
    expect(back.unlockedWeapons).toContain('vajra')
  })

  it('reports whether the write landed', () => {
    expect(save(defaultSave(), memoryStorage())).toBe(true)
    expect(save(defaultSave(), hostileStorage())).toBe(false)
  })

  it('resets on a version mismatch rather than trusting old fields', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION + 1, stones: 99999 }))
    expect(load(storage).stones).toBe(0)
  })

  it('survives corrupt JSON', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, '{ not json')
    expect(() => load(storage)).not.toThrow()
    expect(load(storage).stones).toBe(0)
  })
})

describe('normalisation of partial saves', () => {
  const write = (obj) => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, ...obj }))
    return load(storage)
  }

  it('fills in missing sections', () => {
    const s = write({ stones: 10 })
    expect(s.records.runs).toBe(0)
    expect(s.seen.enemies).toEqual([])
    expect(s.upgrades).toEqual({})
  })

  it('always restores the starting unlocks even if the save omits them', () => {
    const s = write({ unlockedCharacters: [], unlockedWeapons: [] })
    expect(s.unlockedCharacters).toContain(STARTING_CHARACTERS[0])
    expect(s.unlockedWeapons).toContain(STARTING_WEAPONS[0])
  })

  it('does not duplicate unlocks already present', () => {
    const s = write({ unlockedWeapons: [...STARTING_WEAPONS] })
    expect(new Set(s.unlockedWeapons).size).toBe(s.unlockedWeapons.length)
  })

  it('drops junk upgrade levels', () => {
    const s = write({ upgrades: { vitality: 3, bogus: 'x', negative: -2, zero: 0 } })
    expect(s.upgrades).toEqual({ vitality: 3 })
  })

  it('clamps negative stones', () => {
    expect(write({ stones: -500 }).stones).toBe(0)
  })

  it('rejects non-string entries in unlock lists', () => {
    const s = write({ unlockedWeapons: ['vajra', 42, null] })
    expect(s.unlockedWeapons).toContain('vajra')
    expect(s.unlockedWeapons.every((x) => typeof x === 'string')).toBe(true)
  })
})

describe('blocked storage', () => {
  it('loads a default save without throwing', () => {
    expect(() => load(hostileStorage())).not.toThrow()
    expect(load(hostileStorage()).stones).toBe(0)
  })

  it('resets without throwing', () => {
    expect(() => reset(hostileStorage())).not.toThrow()
  })

  it('treats a null storage as no persistence', () => {
    expect(load(null).stones).toBe(0)
    expect(save(defaultSave(), null)).toBe(false)
  })
})

describe('reset', () => {
  it('clears a stored save', () => {
    const storage = memoryStorage()
    const s = defaultSave()
    s.stones = 500
    save(s, storage)
    reset(storage)
    expect(load(storage).stones).toBe(0)
  })
})
