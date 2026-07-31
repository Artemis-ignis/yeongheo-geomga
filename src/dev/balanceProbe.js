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

import { ENEMIES, HP_SCALING } from '../data/enemies.js'
import { WAVES } from '../data/waves.js'
import { META_UPGRADES } from '../data/metaUpgrades.js'
import { SPAWN_RING } from '../entities/EnemyManager.js'
import { EVOLUTION_GATE } from '../combat/upgrades.js'

/**
 * Scale the roster for one probe run and restore it afterwards.
 *
 * This has to live inside the app's own module graph. Reaching for the table
 * from the console — `await import('/src/data/enemies.js')` — hands back a
 * *different instance* than the one the game holds, and mutating it changes
 * nothing while reporting success. I ran four sweeps that way and concluded
 * enemy HP could be multiplied three hundredfold with no effect on the run,
 * which is exactly what a dead copy looks like. The tell was that the level at
 * death never moved either: at 300x HP she cannot possibly have killed enough
 * to reach the same level 82.
 */
function withRoster(
  {
    hpMul = 1, speedMul = 1, damageMul = 1, quadPeriod, linear,
    densityMul = 1, densityFrom = 0, densityTo = Infinity, ringMul, evoPassiveLevel,
  },
  body,
) {
  const ring = SPAWN_RING.mul
  const gate = EVOLUTION_GATE.passiveLevel
  const roster = ENEMIES.map((e) => ({ hp: e.hp, speed: e.speed, damage: e.damage }))
  const scaling = { ...HP_SCALING }
  const waves = WAVES.map((w) => w.perSpawn)
  if (densityMul !== 1) {
    WAVES.forEach((w, i) => {
      if (w.t >= densityFrom && w.t <= densityTo) {
        w.perSpawn = Math.max(1, Math.round(waves[i] * densityMul))
      }
    })
  }
  ENEMIES.forEach((e, i) => {
    e.hp = roster[i].hp * hpMul
    e.speed = roster[i].speed * speedMul
    e.damage = roster[i].damage * damageMul
  })
  if (quadPeriod !== undefined) HP_SCALING.quadPeriod = quadPeriod
  if (linear !== undefined) HP_SCALING.linear = linear
  if (ringMul !== undefined) SPAWN_RING.mul = ringMul
  if (evoPassiveLevel !== undefined) EVOLUTION_GATE.passiveLevel = evoPassiveLevel
  try {
    return body()
  } finally {
    SPAWN_RING.mul = ring
    EVOLUTION_GATE.passiveLevel = gate
    ENEMIES.forEach((e, i) => { e.hp = roster[i].hp; e.speed = roster[i].speed; e.damage = roster[i].damage })
    Object.assign(HP_SCALING, scaling)
    WAVES.forEach((w, i) => { w.perSpawn = waves[i] })
  }
}

/**
 * Run `body` with the 단전 forced to a known state, then put the save back.
 *
 * Without this every number the probe reports is silently conditioned on
 * whatever the browser happened to have in localStorage, and that is not a
 * hypothetical: most of this file's history was measured against a save where I
 * had bought every meta upgrade during an unrelated experiment. Those runs
 * reached 866 of 900 seconds and produced the conclusion that the game has no
 * difficulty curve. The same build on a fresh save ends at four minutes. Both
 * are true, they are just different games, and the probe never said which one it
 * had run.
 *
 * `meta: 'none'` is what a new player meets. `meta: 'max'` is the endgame the
 * shop sells. Anything tuned against one has to be checked against the other.
 */
function withMeta(game, meta, body) {
  if (meta !== 'none' && meta !== 'max') return body()
  const progress = game.progress
  // Swap the backing state rather than rebuilding Progress — the title screen,
  // shop and codex all hold the same instance.
  const saved = JSON.parse(JSON.stringify(progress.state))
  try {
    progress.state.upgrades = {}
    progress.state.stones = 0
    if (meta === 'max') {
      progress.addStones(1e6)
      for (const u of META_UPGRADES) {
        while (!progress.isMaxed(u.id) && progress.buyUpgrade(u.id)) { /* buy it out */ }
      }
    }
    return body()
  } finally {
    progress.state = saved
  }
}

/** Auto-pick preference. Evolutions first, then new 법보, then 공법. */
function rank(choice) {
  if (choice.kind === 'evolution') return 100
  if (choice.kind === 'weapon') return 80
  if (choice.kind === 'passive') return 60
  return 5
}

/**
 * How long the bot commits to a heading, in seconds, and how many enemies it
 * can hold in its head at once.
 *
 * Both exist because the original steering was a perfect evasion controller: it
 * recomputed an inverse-square-weighted repulsion from every enemy within 14
 * units, sixty times a second, with no latency and no attention limit. Nothing
 * in the game could touch it. Six levers were swept properly against it — enemy
 * health, speed, contact damage, spawn density, entry distance and knockback,
 * the last taken all the way to zero — and the share of frames spent inside
 * contact range moved between 1.8% and 4.1% for all of them. That is not a
 * finding about the game; it is a finding about the bot, and tuning difficulty
 * against it would have been tuning against a machine no player is.
 *
 * 0.18 s is a middling human reaction; eight is generous for how many bodies
 * anyone actually tracks in a crowd.
 */
const REACTION = 0.18
const ATTENTION = 8

/**
 * Steer away from the local crowd, weighted by closeness, and slide along the
 * 결계 rather than pressing into it. Not a good player — a consistent one, which
 * is what a balance baseline needs.
 */
function steer(game, player, t, memory) {
  let near = 0
  let closest = Infinity
  const e = game.enemies
  // Sensing is free and instant — `closest` and `near` describe the world, not
  // what she has noticed, and the danger metric depends on the world.
  for (let i = 0; i < e.pool.count; i++) {
    const dx = e.px[i] - player.x
    const dz = e.pz[i] - player.z
    const d = Math.hypot(dx, dz) || 1
    if (d < closest) closest = d
    if (d < 4) near++
  }

  // Deciding is not. She re-reads the crowd every REACTION seconds and holds the
  // heading in between, and she only weighs the nearest ATTENTION of them.
  if (t >= memory.until) {
    memory.until = t + REACTION
    const seen = []
    for (let i = 0; i < e.pool.count; i++) {
      const dx = e.px[i] - player.x
      const dz = e.pz[i] - player.z
      const d = Math.hypot(dx, dz) || 1
      if (d < 14) seen.push({ dx, dz, d })
    }
    seen.sort((a, b) => a.d - b.d)
    let tx = 0
    let tz = 0
    for (const s of seen.slice(0, ATTENTION)) {
      const w = 1 / (s.d * s.d)
      tx -= (s.dx / s.d) * w
      tz -= (s.dz / s.d) * w
    }
    const len = Math.hypot(tx, tz)
    if (len > 1e-4) { memory.mx = tx / len; memory.mz = tz / len }
    else { memory.mx = Math.cos(t * 0.4); memory.mz = Math.sin(t * 0.4) }
  }
  let mx = memory.mx
  let mz = memory.mz

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
  window.__probe = (opts = {}) => withRoster(opts, () => withMeta(game, opts.meta, () => runOne(game, opts)))

  /**
   * Sweep one roster knob and report the danger column for each value, so a
   * balance question is answered by a table rather than by one run.
   */
  window.__sweep = (knob, values, opts = {}) =>
    values.map((v) => {
      const r = window.__probe({ ...opts, [knob]: v })
      const d = r.rows.map((x) => x.danger)
      return {
        [knob]: v,
        survived: r.survived,
        level: r.level,
        kills: r.kills,
        noThreatMinutes: d.filter((x) => x <= 1).length,
        minHp: Math.min(...r.rows.map((x) => x.hp)),
        danger: d,
      }
    })

  function runOne(game, { character = 'seolryeong', stage = 'jade', seconds = 960, band = 60 } = {}) {
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
      // Snapshot before the first 공법 lands. Taken at the end this reads 321
      // health on a maxed 단전 that actually grants 159, because sixty in-run
      // levels are folded into the same number.
      const startStats = {
        maxHp: Math.round(p.maxHp), armor: p.stats.armor,
        might: +p.stats.might.toFixed(2), moveSpeed: +p.stats.moveSpeed.toFixed(2),
      }
      const rows = []
      let t = 0
      let bandT = 0
      let lastKills = 0
      let lastSpawn = 0
      let frames = 0
      let danger = 0
      let totalFrames = 0
      let totalDanger = 0

      const memory = { until: 0, mx: 0, mz: 1 }
      while (t < seconds && game.state !== 'result') {
        const { mx, mz, near, closest } = steer(game, p, t, memory)
        game.input._x = mx
        game.input._z = mz
        if (p.dashCooldown <= 0 && (near >= 4 || closest < 1.5)) game.input._dash = true

        frames++
        totalFrames++
        if (closest < 2.5) { danger++; totalDanger++ }
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
        // Stated, not implied. Every earlier conclusion in this file's history
        // was conditioned on a 단전 nobody had written down.
        // Two summaries, because the obvious one lies.
        //
        // Counting minutes whose danger is ~0 rewards dying early: the opening
        // is deliberately gentle, so a run that ends at four minutes has bands
        // [0,0,0,5] and scores 75% quiet by construction, while a full run that
        // is genuinely tense for ten of its fifteen minutes scores 33%. I spent
        // a sweep optimising that number before noticing it moves with run
        // length rather than with the game.
        //
        // `exposure` is frames spent inside contact range over frames played —
        // length-independent. `deadMinutes` ignores the first three, which are
        // supposed to be quiet, and counts the ones after that which are not.
        exposure: +(totalDanger / Math.max(1, totalFrames)).toFixed(3),
        deadMinutes: rows.slice(3).filter((r) => r.danger <= 1).length,
        playedMinutes: rows.length,
        meta: startStats,
        finalStats: {
          maxHp: Math.round(p.maxHp), armor: p.stats.armor,
          might: +p.stats.might.toFixed(2), moveSpeed: +p.stats.moveSpeed.toFixed(2),
        },
        loadout: JSON.parse(JSON.stringify(p.loadout)),
        rows,
      }
    } finally {
      game.modal.open = realOpen
      game.enemies.spawn = realSpawn
    }
  }
}
