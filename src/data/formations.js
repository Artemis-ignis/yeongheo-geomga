/**
 * 마기의 진형 — set-piece spawns that arrive as a shape instead of as noise.
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
  { t: 75, kind: 'ring', type: 'wisp', count: 14, radius: 10 },
  { t: 140, kind: 'wall', type: 'wolf', count: 12, radius: 15, arc: 1.5 },
  { t: 215, kind: 'ring', type: 'emberSprite', count: 20, radius: 14 },
  // The 18-serpent version killed the 2560x1600 ordinary-input candidate at
  // 4:51, one second after it appeared: the two arms merged with the ambient
  // horde before their escape lanes could be read. Twelve actors still draw a
  // clear pincer, while the wider radius gives the telegraph time to matter.
  { t: 290, kind: 'pincer', type: 'jadeSerpent', count: 12, radius: 16, arc: 1.1 },
  { t: 365, kind: 'ring', type: 'talismanGhost', count: 22, radius: 10 },
  // From 7:00 the 진 are made of elites, and that is the whole point of them.
  //
  // A build that has come together deletes fodder on contact, so a ring of 마기
  // 잔영 at minute nine is a light show. Measured on a maxed 단전, minutes five
  // through eleven ran at zero danger exposure while the drizzle underneath them
  // was already at fifteen spawns a second. 마수사 and 빙벽수 carry ten to twenty
  // times the health of the roster they arrive with — around 900 and 1800 by
  // minute eight after scaling — so a wall of them is still a wall to a finished
  // loadout. This is the one pressure in the game that does not evaporate when
  // the player gets strong.
  // Radius matters more here than anywhere else in this table. 빙벽수 moves at
  // 1.3 and 마수사 at 3.4, against a player who is doing 5.7 and climbing, so an
  // elite dropped at 16 units spends twelve seconds walking to where she was.
  // The first attempt did exactly that and measured no better than fodder: on a
  // maxed 단전 minutes eight through ten still read zero. They arrive inside her
  // working distance instead, close enough that ignoring them is a decision
  // rather than a default.
  // `haste` is the second half of the same problem. Radius alone was not enough:
  // rings of elites at nine units still measured as nothing, because 빙벽수 walks
  // at 1.3 and a bought 단전 has her at 6.6, so they were still setting off when
  // she left. A 진 is an ambush, and its members move like one for as long as
  // they live. Nothing outside a 진 is ever hastened, so kiting the ordinary
  // horde is untouched.
  { t: 430, kind: 'wall', type: 'demonCultivator', count: 10, radius: 12, arc: 1.4, haste: 1.5 },
  { t: 500, kind: 'ring', type: 'glacierWarden', count: 12, radius: 9, haste: 2.6 },
  { t: 570, kind: 'pincer', type: 'demonCultivator', count: 14, radius: 12, arc: 1.2, haste: 1.5 },
  { t: 645, kind: 'ring', type: 'demonCultivator', count: 16, radius: 11, haste: 1.6 },
  { t: 720, kind: 'wall', type: 'glacierWarden', count: 14, radius: 10, arc: 1.3, haste: 2.8 },
  { t: 795, kind: 'pincer', type: 'demonCultivator', count: 20, radius: 12, arc: 1.15, haste: 1.7 },
  { t: 860, kind: 'ring', type: 'glacierWarden', count: 20, radius: 9, haste: 3.0 },
]

/**
 * Which enemy a 진 actually fields in a given 비경.
 *
 * A formation names the creature it wants, but 비경 rosters differ: 빙벽수 only
 * exists in 한천비경 and 용암귀 only in 적염비경, while 마수사 is in all three.
 * Routing that through the wave table's `rosterFor` silently substituted the
 * stage's *first* entry, which is 마기 잔영 — so every elite 진 in 청람비경 was
 * fielding the weakest creature in the game. Caught by reading the health of a
 * ring that should have been 3350 apiece and was 84.
 *
 * A substitute must stay in the wanted creature's threat class. Previously the
 * 215-second 화정 ring became twenty elite 마수사 in 청람비경 simply because
 * 마수사 had the most HP in that roster. That was both a difficulty spike and a
 * wall of duplicated silhouettes. Non-elite 진 now choose the closest-health
 * non-elite alternative; elite 진 still choose an elite alternative, so the
 * late pressure cannot silently collapse back into fodder.
 *
 * @param {string} wanted @param {string[]|undefined} roster @param {object} byId
 */
export function formationType(wanted, roster, byId) {
  if (!roster || roster.includes(wanted)) return wanted
  const wantedDef = byId[wanted]
  if (!wantedDef) {
    let toughest = roster[0]
    for (const id of roster) {
      if ((byId[id]?.hp ?? 0) > (byId[toughest]?.hp ?? 0)) toughest = id
    }
    return toughest
  }

  const sameThreatClass = roster.filter((id) => (
    byId[id] && Boolean(byId[id].elite) === Boolean(wantedDef.elite)
  ))
  const candidates = sameThreatClass.length > 0
    ? sameThreatClass
    : roster.filter((id) => byId[id])
  let best = candidates[0] ?? roster[0]
  let bestDistance = Math.abs((byId[best]?.hp ?? 0) - wantedDef.hp)
  for (const id of candidates.slice(1)) {
    const distance = Math.abs((byId[id]?.hp ?? 0) - wantedDef.hp)
    if (distance < bestDistance) {
      best = id
      bestDistance = distance
    }
  }
  return best
}

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
