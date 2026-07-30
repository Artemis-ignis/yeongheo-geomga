/**
 * Dev-only balance probe: play a whole run headlessly and report the curve.
 *
 * This exists because I got the answer wrong twice by driving the game by hand
 * from the console, and both mistakes were silent — the game reported plausible
 * numbers the entire time.
 *
 *   1. `Input.moveX` / `Input.moveZ` are getters with no setters. Assigning to
 *      them does nothing at all, so a probe that sets `input.moveX` runs a
 *      completely motionless player and reports her survival as the game's
 *      difficulty. Mine drifted to the 결계 on stray dashes and stood there.
 *   2. Reading `game.modal.choices` and calling `_takeUpgrade` misses every
 *      level that resolves without the modal opening, and silently drops the
 *      pick when the field is not populated. Eighty percent of a run's upgrades
 *      went missing that way, which turned a balanced game into one that
 *      apparently died at four minutes with two level-one 법보.
 *
 * Both are avoided here: movement goes through `_x`/`_z`, the backing fields the
 * getters read, and upgrades are answered by replacing `modal.open`, which is
 * the single path every level-up takes.
 *
 * Never imported by the production build.
 */

/** Auto-pick preference. Evolutions first, then new 법보, then 공법. */
function rank(choice) {
  if (choice.kind === 'evolution') return 100
  if (choice.kind === 'weapon') return 80
  if (choice.kind === 'passive') return 60
  return 5
}

/**
 * Steer away from the local crowd, weighted by closeness, and slide along the
 * 결계 rather than pressing into it. Not a good player — a consistent one, which
 * is what a balance baseline needs.
 */
function steer(game, player, t) {
  let tx = 0
  let tz = 0
  let near = 0
  let closest = Infinity
  const e = game.enemies
  for (let i = 0; i < e.pool.count; i++) {
    const dx = e.px[i] - player.x
    const dz = e.pz[i] - player.z
    const d = Math.hypot(dx, dz) || 1
    if (d < closest) closest = d
    if (d < 4) near++
    if (d < 14) {
      const w = 1 / (d * d)
      tx -= (dx / d) * w
      tz -= (dz / d) * w
    }
  }
  let mx = tx
  let mz = tz
  const len = Math.hypot(mx, mz)
  if (len > 1e-4) { mx /= len; mz /= len } else { mx = Math.cos(t * 0.4); mz = Math.sin(t * 0.4) }

  const r = Math.hypot(player.x, player.z)
  if (r > 24) {
    const nx = player.x / r
    const nz = player.z / r
    // Only intervene when the crowd is pushing her outward; otherwise the
    // barrier is just scenery.
    if (mx * nx + mz * nz > 0) {
      let sx = -nz
      let sz = nx
      if (sx * mx + sz * mz < 0) { sx = nz; sz = -nx }
      mx = sx * 0.8 - nx * 0.6
      mz = sz * 0.8 - nz * 0.6
      const k = Math.hypot(mx, mz) || 1
      mx /= k
      mz /= k
    }
  }
  return { mx, mz, near, closest }
}

/**
 * Install `window.__probe(options)`.
 *
 * Returns one row per minute with the two numbers that actually describe a
 * survivors-like: whether kills keep pace with spawns, and what fraction of the
 * minute the player spent with something inside contact range. A run where
 * `danger` sits at zero is not an easy run — it is a minute with no gameplay in
 * it, and that reads the same as a balanced one on every other metric.
 */
export function installBalanceProbe(game) {
  if (typeof window === 'undefined') return
  window.__probe = ({ character = 'seolryeong', stage = 'jade', seconds = 960, band = 60 } = {}) => {
    const realOpen = game.modal.open.bind(game.modal)
    let taken = 0
    let spawned = 0
    // Answer synchronously and never build the card. `modal.isOpen` reads the
    // DOM, so it stays false on its own and `_openNextModal` keeps draining the
    // queue -- it is also getter-only, and assigning to it throws, which is the
    // third accessor in this file's history to bite exactly this way.
    game.modal.open = (choices, cb) => {
      taken++
      cb(choices.slice().sort((a, b) => rank(b) - rank(a))[0])
    }

    // The managers are built by `_startRun`, so the spawn counter can only be
    // attached once the run exists.
    game._startRun(character, stage)
    const realSpawn = game.enemies.spawn.bind(game.enemies)
    game.enemies.spawn = (...args) => { spawned++; return realSpawn(...args) }

    try {
      const p = game.player
      const rows = []
      let t = 0
      let bandT = 0
      let lastKills = 0
      let lastSpawn = 0
      let frames = 0
      let danger = 0

      while (t < seconds && game.state !== 'result') {
        const { mx, mz, near, closest } = steer(game, p, t)
        game.input._x = mx
        game.input._z = mz
        if (p.dashCooldown <= 0 && (near >= 4 || closest < 1.5)) game.input._dash = true

        frames++
        if (closest < 2.5) danger++
        t += 1 / 60
        window.__step(1 / 60)

        if (t - bandT >= band) {
          const kills = game.enemies.killCount - lastKills
          rows.push({
            at: Math.round(t),
            spawn: +(( spawned - lastSpawn) / band).toFixed(1),
            kill: +(kills / band).toFixed(1),
            alive: game.enemies.pool.count,
            danger: Math.round((danger / frames) * 100),
            hp: Math.round((p.hp / p.maxHp) * 100),
            level: p.level,
          })
          lastKills = game.enemies.killCount
          lastSpawn = spawned
          bandT = t
          frames = 0
          danger = 0
        }
      }

      return {
        survived: Math.round(game.runTime),
        level: p.level,
        kills: game.enemies.killCount,
        victory: game.victory,
        upgrades: taken,
        loadout: JSON.parse(JSON.stringify(p.loadout)),
        rows,
      }
    } finally {
      game.modal.open = realOpen
      game.enemies.spawn = realSpawn
    }
  }
}
