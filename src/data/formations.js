/**
 * 마기의 진(陣) — set-piece spawns that arrive as a shape instead of as noise.
 *
 * The wave table spawns at a uniformly random angle every pulse, forever. That
 * gives a correct average and no texture: measured over full runs, minutes go by
 * at zero danger exposure not because too little is spawning but because nothing
 * ever arrives *together*. A player reads a steady drizzle as background and a
 * closing ring as a thing that is happening to her.
 *
 * Each entry fires once, at `t` seconds, and is independent of the wave table —
 * these are on top of the normal drizzle, not instead of it. Keep them sparse
 * enough that they read as events: roughly one every ninety seconds.
 *
 * `kind`:
 *   ring    a closed circle centred on the player. Nowhere to run outward, so
 *           she has to cut through it, which is what makes it different from
 *           the same count spawned at random.
 *   wall    an arc on one side, wide enough to shepherd rather than surround.
 *           Arrives from her heading, so it is the thing she was running toward.
 *   pincer  two arcs on opposite sides, leaving two gaps at right angles.
 */
export const FORMATIONS = [
  // First real interruption. Small, and 마기 잔영 are the weakest thing alive,
  // so the shape teaches the shape rather than killing her.
  { t: 75, kind: 'ring', type: 'wisp', count: 14, radius: 13 },
  { t: 140, kind: 'wall', type: 'wolf', count: 12, radius: 15, arc: 1.5 },
  { t: 215, kind: 'ring', type: 'emberSprite', count: 20, radius: 14 },
  { t: 290, kind: 'pincer', type: 'jadeSerpent', count: 18, radius: 15, arc: 1.1 },
  { t: 365, kind: 'ring', type: 'talismanGhost', count: 22, radius: 15 },
  { t: 430, kind: 'wall', type: 'stoneGhoul', count: 14, radius: 16, arc: 1.4 },
  // From here the drizzle is heavy on its own, so formations get rarer and
  // hit harder rather than more often.
  { t: 555, kind: 'pincer', type: 'bloodScorpion', count: 26, radius: 15, arc: 1.2 },
  { t: 645, kind: 'ring', type: 'ashRaven', count: 30, radius: 16 },
  { t: 735, kind: 'wall', type: 'magmaBrute', count: 12, radius: 16, arc: 1.3 },
  { t: 825, kind: 'ring', type: 'demonCultivator', count: 18, radius: 16 },
]

/**
 * Angles, in radians, for one formation's members. Pure so the shapes can be
 * checked without a scene — see `test/formations.test.js`.
 *
 * @param {'ring'|'wall'|'pincer'} kind
 * @param {number} count
 * @param {number} facing Where the player is heading; shapes orient to it.
 * @param {number} arc Angular width of a wall, or of each pincer arm.
 */
export function formationAngles(kind, count, facing, arc = 1.4) {
  const out = []
  if (kind === 'ring') {
    for (let i = 0; i < count; i++) out.push((i / count) * Math.PI * 2)
    return out
  }
  if (kind === 'wall') {
    // Spread across `arc`, centred on where she is going.
    for (let i = 0; i < count; i++) {
      const f = count === 1 ? 0.5 : i / (count - 1)
      out.push(facing + (f - 0.5) * arc)
    }
    return out
  }
  // pincer: half on her heading, half behind her.
  const half = Math.ceil(count / 2)
  for (let i = 0; i < count; i++) {
    const inFirst = i < half
    const n = inFirst ? half : count - half
    const k = inFirst ? i : i - half
    const f = n === 1 ? 0.5 : k / (n - 1)
    out.push(facing + (inFirst ? 0 : Math.PI) + (f - 0.5) * arc)
  }
  return out
}
