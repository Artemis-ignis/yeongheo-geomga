import { CHARACTERS, TAGS, BASE_STATS } from './characters.js'
import { PASSIVES } from './passives.js'
import { WEAPONS, EVOLUTIONS, getWeapon } from './weapons.js'
import { ENEMIES } from './enemies.js'
import { WAVES, RUN_SECONDS } from './waves.js'

function fail(message) {
  throw new Error(`[data] ${message}`)
}

/**
 * Boot-time consistency check over the balance tables.
 *
 * A bad table should fail loudly at startup with a precise message, not surface
 * as a mysterious undefined halfway through a run.
 */
export function validateData() {
  const passiveIds = new Set(PASSIVES.map((p) => p.id))
  const enemyIds = new Set(ENEMIES.map((e) => e.id))
  const statNames = new Set([...Object.keys(BASE_STATS), 'tagMight'])

  const seen = new Set()
  for (const w of [...WEAPONS, ...EVOLUTIONS]) {
    if (seen.has(w.id)) fail(`duplicate weapon id "${w.id}"`)
    seen.add(w.id)
    if (!TAGS.includes(w.tag)) fail(`weapon "${w.id}" has unknown tag "${w.tag}"`)
    if (!Array.isArray(w.levels) || w.levels.length === 0) fail(`weapon "${w.id}" has no levels`)
    for (const [i, lv] of w.levels.entries()) {
      if (typeof lv.damage !== 'number') fail(`weapon "${w.id}" level ${i + 1} is missing damage`)
      if (typeof lv.cooldown !== 'number' || lv.cooldown <= 0) {
        fail(`weapon "${w.id}" level ${i + 1} has an invalid cooldown`)
      }
    }
  }

  for (const w of WEAPONS) {
    if (w.levels.length !== 5) fail(`base weapon "${w.id}" must have 5 levels, has ${w.levels.length}`)
    if (!w.evolvesTo) continue
    if (!w.pairPassive) fail(`weapon "${w.id}" evolves but has no pairPassive`)
    if (!passiveIds.has(w.pairPassive)) fail(`weapon "${w.id}" pairs with unknown passive "${w.pairPassive}"`)
    const evo = getWeapon(w.evolvesTo)
    if (!evo) fail(`weapon "${w.id}" evolves into unknown weapon "${w.evolvesTo}"`)
    if (evo.evolutionOf !== w.id) fail(`evolution "${evo.id}" does not point back at "${w.id}"`)
  }

  for (const e of EVOLUTIONS) {
    if (e.levels.length !== 1) fail(`evolution "${e.id}" must have exactly 1 level`)
    if (!getWeapon(e.evolutionOf)) fail(`evolution "${e.id}" comes from unknown weapon "${e.evolutionOf}"`)
  }

  for (const p of PASSIVES) {
    if (p.max !== 5) fail(`passive "${p.id}" must cap at 5`)
    for (const m of p.perLevel) {
      if (!statNames.has(m.stat)) fail(`passive "${p.id}" modifies unknown stat "${m.stat}"`)
      if (m.op !== 'add' && m.op !== 'mul') fail(`passive "${p.id}" uses unknown op "${m.op}"`)
    }
  }

  for (const c of CHARACTERS) {
    if (!getWeapon(c.startWeapon)) fail(`character "${c.id}" starts with unknown weapon "${c.startWeapon}"`)
    for (const m of c.mods) {
      if (!statNames.has(m.stat)) fail(`character "${c.id}" modifies unknown stat "${m.stat}"`)
      if (m.stat === 'tagMight' && !TAGS.includes(m.tag)) {
        fail(`character "${c.id}" targets unknown tag "${m.tag}"`)
      }
    }
  }

  if (WAVES[0].t !== 0) fail('wave timeline must start at t=0')
  for (let i = 1; i < WAVES.length; i++) {
    if (WAVES[i].t <= WAVES[i - 1].t) fail(`wave timeline is not increasing at index ${i}`)
    if (WAVES[i].t - WAVES[i - 1].t > 60) fail(`wave timeline has a gap before t=${WAVES[i].t}`)
  }
  if (WAVES[WAVES.length - 1].t > RUN_SECONDS) fail('wave timeline runs past the end of the run')
  for (const w of WAVES) {
    for (const id of w.types ?? []) {
      if (!enemyIds.has(id)) fail(`wave at t=${w.t} references unknown enemy "${id}"`)
    }
  }
}
