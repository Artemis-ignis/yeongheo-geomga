/**
 * The musical decisions, kept free of Web Audio so they can be tested in node.
 *
 * Everything here is pure: given a run's state it says which note to play and
 * how loud, and the engine in Audio.js turns that into sound. Splitting it this
 * way is the only reason any of the music is covered by the suite at all — an
 * AudioContext does not exist in the test environment.
 */

/**
 * 궁상각치우 — the five-tone scale, as semitone offsets from the tonic.
 *
 * A pentatonic scale has no semitone steps, so any two notes sound consonant
 * together. That matters here because the music is generated live against a
 * drone and nothing is checking for clashes: with this scale there are none to
 * check for.
 */
export const PENTATONIC = [0, 2, 4, 7, 9]

/**
 * 조(調) — a mode per 비경, because a tonic alone is not a different piece.
 *
 * Each arena already had its own key: A3, G3, B3. A whole tone apart, same five
 * intervals, same drone, same instruments. Nobody hears that as three
 * soundtracks — they hear one piece, slightly higher. Three 비경 that look
 * nothing alike sounded identical.
 *
 * The mode is what carries character. All three keep the property the comment
 * above is about — no two adjacent degrees a semitone apart — so live generation
 * against a drone still cannot produce a clash:
 *
 *   평조   0 2 4 7 9    steps 2 2 3 2 3   open, bright
 *   계면조 0 3 5 7 10   steps 3 2 2 3 2   dark, weighted low
 *   황종조 0 2 5 7 10   steps 2 3 2 3 2   hollow, suspended
 */
export const MODES = {
  평조: [0, 2, 4, 7, 9],
  계면조: [0, 3, 5, 7, 10],
  황종조: [0, 2, 5, 7, 10],
}

/** Tonic and mode per 비경. */
export const STAGE_KEY = {
  jade: { tonic: 220.0, mode: '평조' },    // A3, a green plateau in daylight
  ember: { tonic: 196.0, mode: '계면조' },  // G3, burnt ground
  frost: { tonic: 246.94, mode: '황종조' }, // B3, thin air over snow
}

/** Kept for callers that only want the pitch. */
export const STAGE_TONIC = Object.fromEntries(
  Object.entries(STAGE_KEY).map(([id, k]) => [id, k.tonic]),
)

export function tonicFor(stageId) {
  return (STAGE_KEY[stageId] ?? STAGE_KEY.jade).tonic
}

export function scaleFor(stageId) {
  return MODES[(STAGE_KEY[stageId] ?? STAGE_KEY.jade).mode]
}

/**
 * Equal-tempered frequency for a scale degree, `octave` steps of 12 apart.
 *
 * `scale` defaults to 평조 so every existing caller keeps its behaviour.
 */
export function noteFreq(tonic, degree, octave = 0, scale = PENTATONIC) {
  const n = scale.length
  const semis = scale[((degree % n) + n) % n]
  const shift = Math.floor(degree / n) + octave
  return tonic * 2 ** ((semis + shift * 12) / 12)
}

/**
 * How hard the music should push, 0..1, from run progress and how close the
 * player is to dying.
 *
 * Danger dominates deliberately: a player at 15% health in the first minute
 * should hear the same urgency as one at minute fourteen. Music that tracks
 * only the clock tells the player something they can already read off the HUD.
 */
export function intensityOf({ runTime = 0, runSeconds = 900, hpFraction = 1, bossAlive = false } = {}) {
  const progress = Math.min(1, Math.max(0, runTime / runSeconds))
  const danger = 1 - Math.min(1, Math.max(0, hpFraction))
  let value = progress * 0.55 + danger * 0.75
  if (bossAlive) value += 0.3
  return Math.min(1, value)
}

/** Seconds between plucks. Denser as the run tightens, but never a machine gun. */
export function noteInterval(intensity) {
  const i = Math.min(1, Math.max(0, intensity))
  return 1.15 - i * 0.72
}

/**
 * Pick the next scale degree.
 *
 * A random walk rather than independent draws: melodies move by step far more
 * often than they leap, and independent draws over five notes sound like a
 * wind chime rather than a phrase. Occasional leaps keep it from wandering.
 */
export function nextDegree(previous, roll, intensity = 0.5) {
  const leap = roll > 0.82 - intensity * 0.12
  const step = leap ? (roll > 0.91 ? 3 : 2) : 1
  const direction = roll < 0.5 ? -1 : 1
  const next = previous + direction * step
  // Keep it inside a two-octave span so it never drifts out of the instrument.
  if (next > 9) return previous - step
  if (next < -5) return previous + step
  return next
}

/** Drop an octave and lengthen the tail for the low answering phrase. */
export function isAnswerNote(index) {
  return index % 8 === 0
}
