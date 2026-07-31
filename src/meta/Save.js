import { STARTING_CHARACTERS, STARTING_WEAPONS } from '../data/unlocks.js'

export const SAVE_KEY = 'yeongheo.save.v1'
/** Bump when the shape changes, and add the step to `MIGRATIONS` below. */
export const SAVE_VERSION = 2

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
    /** Selected 시련; what the player may select is derived from records. */
    trial: 0,
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

/**
 * Bring a save forward from an older layout.
 *
 * The version check used to be `if (raw.version !== SAVE_VERSION) return base` —
 * every future version bump would have silently deleted the player's shop, their
 * unlocks and their records the first time they loaded a new build. A save file
 * is the only thing in this project that cannot be regenerated, and throwing it
 * away on a schema change is not a fallback, it is data loss.
 *
 * Migrations run in order and each one only has to know how to get from its own
 * version to the next. A save from the future is left alone rather than reset —
 * it means the player has run a newer build, and `normalize` below drops
 * anything it does not recognise anyway.
 */
const MIGRATIONS = {
  // 1 -> 2: 시련 tiers arrived. Nothing to move; the field defaults to 평지 and
  // the unlock is derived from records.bestTime, which every v1 save has.
  1: (s) => ({ ...s, version: 2, trial: 0 }),
}

function migrate(raw) {
  let s = raw
  let guard = 0
  while (Number.isInteger(s.version) && s.version < SAVE_VERSION && guard++ < 32) {
    const step = MIGRATIONS[s.version]
    if (!step) break
    s = step(s)
  }
  return s
}

/** Fill in anything an older or hand-edited save is missing. */
function normalize(input) {
  const base = defaultSave()
  if (!input || typeof input !== 'object') return base
  const raw = migrate(input)

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
    // Both of these were being dropped on the floor: `normalize` rebuilds the
    // save from scratch and simply did not name them, so every reload replayed
    // the first-run hints and reset the chosen 시련 to 평지.
    hintsSeen: arr(raw.hintsSeen, []),
    trial: Math.max(0, Math.trunc(num(raw.trial, 0))),
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
