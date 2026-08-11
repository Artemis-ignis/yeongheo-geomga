import { describe, it, expect } from 'vitest'
import { FORMATIONS, formationAngles, formationType } from '../src/data/formations.js'
import { STAGES } from '../src/data/stages.js'
import { ENEMIES, ENEMY_INDEX } from '../src/data/enemies.js'
import { RUN_SECONDS } from '../src/data/waves.js'

/**
 * 진 are the run's texture. The wave table gives a correct average and no
 * shape — measured over full runs, whole minutes pass at zero danger not
 * because too little spawns but because nothing ever arrives together.
 *
 * `formationAngles` is pure, so the shapes are checkable without a scene. What
 * matters is that each named kind is actually a different shape: a "ring" that
 * left a gap, or a "wall" that quietly surrounded her, would play as the same
 * drizzle it was meant to break up.
 */

/** Largest angular gap between consecutive members, in radians. */
function widestGap(angles) {
  const sorted = angles.map((a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((x, y) => x - y)
  let worst = sorted[0] + Math.PI * 2 - sorted[sorted.length - 1]
  for (let i = 1; i < sorted.length; i++) worst = Math.max(worst, sorted[i] - sorted[i - 1])
  return worst
}

describe('formation shapes', () => {
  it('closes a ring all the way round', () => {
    const a = formationAngles('ring', 16, 0)
    expect(a).toHaveLength(16)
    // No gap wider than a comfortable stride: a ring with a hole in it is just
    // an arc, and she walks out of it without ever making a decision.
    expect(widestGap(a)).toBeLessThan(0.5)
  })

  it('leaves a wall open behind her', () => {
    const a = formationAngles('wall', 12, 0, 1.5)
    // Everything inside the stated arc, on the side she is heading.
    for (const x of a) expect(Math.abs(x)).toBeLessThanOrEqual(1.5 / 2 + 1e-9)
    // And therefore a way out: the gap is the rest of the circle.
    expect(widestGap(a)).toBeGreaterThan(Math.PI)
  })

  it('gives a pincer two arms and two ways out', () => {
    const a = formationAngles('pincer', 18, 0, 1.1)
    const ahead = a.filter((x) => Math.abs(Math.atan2(Math.sin(x), Math.cos(x))) < Math.PI / 2)
    expect(ahead.length, 'one arm swallowed the other').toBeGreaterThan(a.length / 3)
    expect(ahead.length).toBeLessThan((a.length * 2) / 3)
    // Two gaps, at the sides — each smaller than a wall's single opening.
    expect(widestGap(a)).toBeGreaterThan(0.8)
    expect(widestGap(a)).toBeLessThan(Math.PI)
  })

  it('orients to where she is running', () => {
    for (const kind of ['wall', 'pincer']) {
      const north = formationAngles(kind, 10, 0, 1.4)
      const east = formationAngles(kind, 10, Math.PI / 2, 1.4)
      for (let i = 0; i < north.length; i++) {
        expect(east[i] - north[i]).toBeCloseTo(Math.PI / 2, 6)
      }
    }
  })

  it('handles a single member without dividing by zero', () => {
    for (const kind of ['ring', 'wall', 'pincer']) {
      const a = formationAngles(kind, 1, 0, 1.4)
      expect(a).toHaveLength(1)
      expect(Number.isFinite(a[0]), `${kind} produced ${a[0]}`).toBe(true)
    }
  })
})

describe('the formation timeline', () => {
  it('names only enemies that exist', () => {
    for (const f of FORMATIONS) {
      expect(ENEMY_INDEX.has(f.type), `"${f.type}" is not in the enemy table`).toBe(true)
    }
  })

  it('is ordered, so the spawner can walk it with one index', () => {
    for (let i = 1; i < FORMATIONS.length; i++) {
      expect(FORMATIONS[i].t).toBeGreaterThan(FORMATIONS[i - 1].t)
    }
  })

  it('stays inside the run', () => {
    expect(FORMATIONS[0].t).toBeGreaterThan(30)
    expect(FORMATIONS[FORMATIONS.length - 1].t).toBeLessThan(RUN_SECONDS)
  })

  it('stays an event rather than becoming the background', () => {
    // Roughly one every ninety seconds. Any tighter and a 진 stops reading as an
    // interruption, which is the only thing it is for.
    for (let i = 1; i < FORMATIONS.length; i++) {
      expect(FORMATIONS[i].t - FORMATIONS[i - 1].t, `${FORMATIONS[i].t}s crowds the one before`).toBeGreaterThanOrEqual(60)
    }
    expect(FORMATIONS.length / (RUN_SECONDS / 60)).toBeLessThan(1)
  })

  it('builds the late 진 out of elites, which a finished build cannot delete', () => {
    // A ring of fodder at minute nine is a light show to a loadout that has come
    // together. Measured on a maxed 단전, minutes five through eleven sat at zero
    // danger exposure while the drizzle underneath was already at fifteen spawns
    // a second — nothing arriving in that window had the health to survive
    // contact. From 7:00 the formations are the one pressure that does not
    // evaporate when the player gets strong, so they have to be made of things
    // that take a while to kill.
    const late = FORMATIONS.filter((f) => f.t >= 420)
    expect(late.length, 'the late game has no 진 at all').toBeGreaterThanOrEqual(5)
    for (const f of late) {
      const def = ENEMIES[ENEMY_INDEX.get(f.type)]
      expect(def.elite, `${f.t}s fields "${f.type}", which is not an elite`).toBe(true)
    }
    // And the early ones must not be, or the opening becomes a wall.
    for (const f of FORMATIONS.filter((x) => x.t < 420)) {
      const def = ENEMIES[ENEMY_INDEX.get(f.type)]
      expect(def.elite, `${f.t}s opens with an elite 진`).toBeFalsy()
    }
  })

  it('keeps the elite 진 small enough to fight through', () => {
    // 빙벽수 carries 640 health before scaling. Twenty is a wall; forty is a
    // sentence.
    for (const f of FORMATIONS.filter((x) => x.t >= 420)) {
      expect(f.count, `${f.t}s fields ${f.count} elites`).toBeLessThanOrEqual(20)
    }
  })

  it('spawns inside the 결계 but outside arm\'s reach', () => {
    for (const f of FORMATIONS) {
      expect(f.radius).toBeGreaterThan(8)
      expect(f.radius).toBeLessThan(20)
      expect(f.count).toBeGreaterThan(8)
    }
  })

  it('puts slow members where they can actually arrive', () => {
    // 빙벽수 moves at 1.3 against a player doing 5.7 and climbing. Dropped at 16
    // units it spends twelve seconds walking to where she was, and measured that
    // way it was worth no more than fodder. Anything that stays slower than half
    // her pace even after `haste` has to start inside her working distance.
    const player = 5.7
    for (const f of FORMATIONS) {
      const def = ENEMIES[ENEMY_INDEX.get(f.type)]
      if (def.speed * (f.haste ?? 1) >= player / 2) continue
      expect(f.radius, `${f.t}s drops ${f.type} at ${f.radius}`).toBeLessThanOrEqual(10)
    }
  })

  it('hastens 진 members enough to close, and never past a sprint', () => {
    // The point is that they cut her off, not that they chase her down. Above
    // her own top speed a 진 stops being an ambush and becomes unavoidable.
    const player = 5.7
    for (const f of FORMATIONS) {
      const def = ENEMIES[ENEMY_INDEX.get(f.type)]
      const speed = def.speed * (f.haste ?? 1)
      expect(speed, `${f.t}s: ${f.type} at ${speed.toFixed(1)} outruns her`).toBeLessThanOrEqual(player * 1.05)
    }
  })

  it('substitutes within the same threat class at the closest authored health', () => {
    /**
     * 빙벽수 exists only in 한천비경 and 용암귀 only in 적염비경, so a 진 naming
     * one has to field something else elsewhere. The replacement must neither
     * collapse an elite 진 into fodder nor turn an early elemental ring into
     * twenty elites. Matching elite rank first and HP second preserves both.
     */
    const byId = Object.fromEntries(ENEMIES.map((e) => [e.id, e]))
    for (const stage of STAGES) {
      for (const f of FORMATIONS) {
        const got = formationType(f.type, stage.roster, byId)
        expect(stage.roster.includes(got), `${stage.id} fields "${got}", not in its roster`).toBe(true)
        if (got === f.type) continue
        expect(Boolean(byId[got].elite), `${stage.id} changed threat class for ${f.type}`)
          .toBe(Boolean(byId[f.type].elite))
        const sameClass = stage.roster.filter((id) => (
          Boolean(byId[id].elite) === Boolean(byId[f.type].elite)
        ))
        const closest = sameClass.reduce((best, id) => (
          Math.abs(byId[id].hp - byId[f.type].hp) < Math.abs(byId[best].hp - byId[f.type].hp)
            ? id
            : best
        ))
        expect(got, `${stage.id} swapped ${f.type} for ${got}`).toBe(closest)
      }
    }
  })

  it('never upgrades the early elemental ring into twenty elites', () => {
    const byId = Object.fromEntries(ENEMIES.map((enemy) => [enemy.id, enemy]))
    const elementalRing = FORMATIONS.find((formation) => formation.t === 215)
    expect(elementalRing?.type).toBe('emberSprite')
    for (const stage of STAGES) {
      const substitute = formationType(elementalRing.type, stage.roster, byId)
      expect(byId[substitute].elite, `${stage.id} fields elite ${substitute} at 215s`).toBeFalsy()
    }
  })

  it('leaves the ordinary horde alone', () => {
    // Only 진 carry haste. If this ever reads true of the wave table instead,
    // the kiting the whole game is built on has quietly been removed.
    for (const f of FORMATIONS.filter((x) => x.t < 420)) {
      expect(f.haste ?? 1, `the opening 진 at ${f.t}s is hastened`).toBe(1)
    }
  })
})
