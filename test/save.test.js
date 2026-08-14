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

  /**
   * This used to assert the opposite — that a version mismatch resets the save.
   * That is data loss dressed as safety: a save file is the only thing in this
   * project a player cannot regenerate, and the first schema change would have
   * silently taken their shop, their unlocks and their records the moment they
   * loaded a new build.
   */
  it('carries an older save forward instead of deleting it', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, JSON.stringify({
      version: 1,
      stones: 4200,
      upgrades: { vitality: 5, edge: 3 },
      unlockedCharacters: ['seolryeong', 'hongryeon'],
      unlockedStages: ['jade', 'ember'],
      hintsSeen: ['dash', 'levelUp'],
      records: { runs: 40, victories: 1, bestTime: 512, bestLevel: 61, totalKills: 9000 },
    }))
    const out = load(storage)
    expect(out.version).toBe(SAVE_VERSION)
    expect(out.stones).toBe(4200)
    expect(out.upgrades).toEqual({ vitality: 5, edge: 3 })
    expect(out.unlockedCharacters).toContain('hongryeon')
    expect(out.unlockedStages).toContain('ember')
    expect(out.records.bestTime).toBe(512)
    expect(out.records.totalKills).toBe(9000)
    // Fields the new version adds arrive at their defaults.
    expect(out.trial).toBe(0)
  })

  it('keeps a save written by a newer build rather than wiping it', () => {
    // Downgrading loses whatever this build cannot read either way, but the
    // player's 영석 and unlocks are not that.
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION + 1, stones: 99999, unlockedStages: ['jade', 'frost'],
    }))
    const out = load(storage)
    expect(out.stones).toBe(99999)
    expect(out.unlockedStages).toContain('frost')
  })

  it('keeps the two fields normalize was quietly dropping', () => {
    // `normalize` rebuilds the save from scratch and simply did not name
    // `hintsSeen` or `trial`, so every reload replayed the first-run hints and
    // reset the chosen 시련. Neither had a test.
    const storage = memoryStorage()
    const state = { ...defaultSave(), hintsSeen: ['dash', 'chest'], trial: 3 }
    save(state, storage)
    const back = load(storage)
    expect(back.hintsSeen).toEqual(['dash', 'chest'])
    expect(back.trial).toBe(3)
  })

  it('round-trips world journey progress independently of run records', () => {
    const storage = memoryStorage()
    const state = defaultSave()
    state.journey.chaptersCleared.push('jade:guardian')
    state.journey.expeditionVictories = 2
    state.journey.survivalVictories = 5
    state.journey.decisions['jade:guardian'] = [{
      beatId: 'sealed-record', choiceId: 'record-truth', name: '진상을 새기다', outcome: '원본 보존',
    }]
    save(state, storage)
    expect(load(storage).journey).toEqual(state.journey)
  })

  it('refuses a nonsense 시련 without discarding the rest', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), trial: -7, stones: 55 }))
    const out = load(storage)
    expect(out.trial).toBe(0)
    expect(out.stones).toBe(55)
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
