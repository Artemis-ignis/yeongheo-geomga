import { STARTING_CHARACTERS, STARTING_WEAPONS } from '../data/unlocks.js'

export const SAVE_KEY = 'yeongheo.save.v1'
export const SAVE_VERSION = 1

/**
 * Persistence for meta progression.
 *
 * The storage backend is injected so this stays testable in the node
 * environment the rest of the suite runs in — `localStorage` is only the
 * default. Every access is guarded: private-browsing modes throw on
 * localStorage, and the game must remain playable (just not persistent) rather
 * than crash at boot.
 */

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    stones: 0,
    upgrades: {},
    unlockedCharacters: [...STARTING_CHARACTERS],
    unlockedWeapons: [...STARTING_WEAPONS],
    unlockedStages: ['jade'],
    seen: { enemies: [], weapons: [], bosses: [] },
    // First-run hints already delivered. Persisted so they never reappear.
    hintsSeen: [],
    records: { runs: 0, victories: 0, bestTime: 0, bestLevel: 0, totalKills: 0 },
  }
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Accessing localStorage itself can throw when storage is blocked.
  }
  return null
}

/** Fill in anything a older or hand-edited save is missing. */
function normalize(raw) {
  const base = defaultSave()
  if (!raw || typeof raw !== 'object') return base
  if (raw.version !== SAVE_VERSION) return base

  const arr = (v, fallback) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : fallback)
  const num = (v, fallback) => (Number.isFinite(v) ? v : fallback)

  const upgrades = {}
  if (raw.upgrades && typeof raw.upgrades === 'object') {
    for (const id in raw.upgrades) {
      const level = raw.upgrades[id]
      if (Number.isInteger(level) && level > 0) upgrades[id] = level
    }
  }

  // Starting content is always present, even if a save omits it.
  const characters = new Set([...base.unlockedCharacters, ...arr(raw.unlockedCharacters, [])])
  const weapons = new Set([...base.unlockedWeapons, ...arr(raw.unlockedWeapons, [])])
  const stages = new Set([...base.unlockedStages, ...arr(raw.unlockedStages, [])])

  return {
    version: SAVE_VERSION,
    stones: Math.max(0, num(raw.stones, 0)),
    upgrades,
    unlockedCharacters: [...characters],
    unlockedWeapons: [...weapons],
    unlockedStages: [...stages],
    seen: {
      enemies: arr(raw.seen?.enemies, []),
      weapons: arr(raw.seen?.weapons, []),
      bosses: arr(raw.seen?.bosses, []),
    },
    records: {
      runs: num(raw.records?.runs, 0),
      victories: num(raw.records?.victories, 0),
      bestTime: num(raw.records?.bestTime, 0),
      bestLevel: num(raw.records?.bestLevel, 0),
      totalKills: num(raw.records?.totalKills, 0),
    },
  }
}

export function load(storage = defaultStorage()) {
  if (!storage) return defaultSave()
  try {
    const text = storage.getItem(SAVE_KEY)
    if (!text) return defaultSave()
    return normalize(JSON.parse(text))
  } catch {
    // Corrupt JSON or a storage that throws — start fresh rather than fail boot.
    return defaultSave()
  }
}

/** Returns whether the write actually landed, so callers can warn if they care. */
export function save(state, storage = defaultStorage()) {
  if (!storage) return false
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function reset(storage = defaultStorage()) {
  if (!storage) return defaultSave()
  try {
    storage.removeItem(SAVE_KEY)
  } catch {
    // Nothing to do — the caller still gets a fresh state.
  }
  return defaultSave()
}

/** In-memory stand-in used by tests and as a fallback when storage is blocked. */
export function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}
