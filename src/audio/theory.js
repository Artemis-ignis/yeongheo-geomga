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

/** Tonic per 비경, so each arena has its own key. */
export const STAGE_TONIC = {
  jade: 220.0,   // A3
  ember: 196.0,  // G3
  frost: 246.94, // B3
}

export function tonicFor(stageId) {
  return STAGE_TONIC[stageId] ?? STAGE_TONIC.jade
}

/** Equal-tempered frequency for a scale degree, `octave` steps of 12 apart. */
export function noteFreq(tonic, degree, octave = 0) {
  const semis = PENTATONIC[((degree % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length]
  const shift = Math.floor(degree / PENTATONIC.length) + octave
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
