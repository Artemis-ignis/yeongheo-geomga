/**
 * Synthesis primitives. Every sound in the game is generated here at runtime —
 * the project ships no audio files, for the same reason it ships no textures.
 *
 * Buffers are cached by their parameters: a plucked string is a few thousand
 * samples of arithmetic, which is cheap once and wasteful sixty times a second.
 */

const bufferCache = new Map()

function cachedBuffer(ctx, key, build) {
  let buf = bufferCache.get(key)
  if (buf === undefined) {
    buf = build()
    bufferCache.set(key, buf)
  }
  return buf
}

/** Deterministic noise, so a given sound is identical every time it plays. */
function rng(seed) {
  let s = seed || 1
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647 * 2 - 1
  }
}

/**
 * Karplus-Strong plucked string.
 *
 * A burst of noise in a delay line one wavelength long, low-pass filtered each
 * time round. It costs a few thousand adds and sounds like a struck string,
 * which is the sound this game wants: 선협 is guqin and 가야금, not orchestral
 * brass. Damping controls how fast the harmonics die — high values give the
 * short woody tock of a fingernail, low values a long singing tail.
 */
export function pluckBuffer(ctx, freq, seconds = 1.4, damping = 0.5, seed = 12345) {
  const key = `pluck:${freq.toFixed(1)}:${seconds}:${damping}:${seed}`
  return cachedBuffer(ctx, key, () => {
    const rate = ctx.sampleRate
    const len = Math.max(1, Math.floor(rate * seconds))
    const buf = ctx.createBuffer(1, len, rate)
    const out = buf.getChannelData(0)

    const n = Math.max(2, Math.round(rate / freq))
    const line = new Float32Array(n)
    const noise = rng(seed)
    for (let i = 0; i < n; i++) line[i] = noise()

    // Feedback just under 1 so the string decays instead of ringing forever.
    const feedback = 0.998 - damping * 0.02
    let idx = 0
    for (let i = 0; i < len; i++) {
      const cur = line[idx]
      const next = line[(idx + 1) % n]
      const avg = (cur + next) * 0.5 * feedback
      line[idx] = avg
      out[i] = cur
      idx = (idx + 1) % n
    }

    // Fade the tail so a truncated buffer does not click.
    const fade = Math.min(len, Math.floor(rate * 0.08))
    for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade
    return buf
  })
}

/** A short burst of filtered noise — impacts, footfalls, wind. */
export function noiseBuffer(ctx, seconds = 0.3, seed = 999) {
  const key = `noise:${seconds}:${seed}`
  return cachedBuffer(ctx, key, () => {
    const rate = ctx.sampleRate
    const len = Math.max(1, Math.floor(rate * seconds))
    const buf = ctx.createBuffer(1, len, rate)
    const out = buf.getChannelData(0)
    const noise = rng(seed)
    for (let i = 0; i < len; i++) out[i] = noise()
    return buf
  })
}

/** One-shot buffer voice with an envelope, optional filter sweep, and panning. */
export function playBuffer(ctx, dest, buffer, {
  gain = 1, rate = 1, attack = 0.002, decay = 0.4,
  filter = null, filterTo = null, pan = 0, when = 0,
  onEnded = null, returnHandle = false,
} = {}) {
  const t = ctx.currentTime + when
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate

  let node = src
  const nodes = [src]
  let biquad = null
  let env = null
  let panner = null
  if (filter !== null) {
    biquad = ctx.createBiquadFilter()
    biquad.type = 'lowpass'
    biquad.frequency.setValueAtTime(filter, t)
    if (filterTo !== null) biquad.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t + decay)
    node.connect(biquad)
    nodes.push(biquad)
    node = biquad
  }

  env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  node.connect(env)
  nodes.push(env)

  if (pan !== 0 && ctx.createStereoPanner) {
    panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    env.connect(panner)
    panner.connect(dest)
    nodes.push(panner)
  } else {
    env.connect(dest)
  }

  const tracker = ctx.__yeongheoSfxTracker
  const trackedEnded = !onEnded && typeof tracker?.begin === 'function' ? tracker.begin() : null
  const cleanup = createVoiceHandle(src, nodes, onEnded ?? trackedEnded)
  tracker?.attach?.(cleanup)

  src.start(t)
  src.stop(t + attack + decay + 0.05)
  return returnHandle ? cleanup : src
}

/** A pitched oscillator voice, for sweeps, blips and horns. */
export function playTone(ctx, dest, {
  freq = 440, toFreq = null, type = 'sine', gain = 0.3,
  attack = 0.005, hold = 0, decay = 0.3, pan = 0, when = 0, detune = 0,
  onEnded = null, returnHandle = false,
} = {}) {
  const t = ctx.currentTime + when
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (detune) osc.detune.value = detune
  if (toFreq !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), t + attack + hold + decay)
  }

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack)
  if (hold > 0) env.gain.setValueAtTime(Math.max(0.0002, gain), t + attack + hold)
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay)

  osc.connect(env)
  const nodes = [osc, env]
  if (pan !== 0 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    env.connect(panner)
    panner.connect(dest)
    nodes.push(panner)
  } else {
    env.connect(dest)
  }

  const tracker = ctx.__yeongheoSfxTracker
  const trackedEnded = !onEnded && typeof tracker?.begin === 'function' ? tracker.begin() : null
  const cleanup = createVoiceHandle(osc, nodes, onEnded ?? trackedEnded)
  tracker?.attach?.(cleanup)

  osc.start(t)
  osc.stop(t + attack + hold + decay + 0.05)
  return returnHandle ? cleanup : osc
}

/**
 * Attach one-shot cleanup to an AudioScheduledSourceNode.
 *
 * Audio nodes are intentionally short-lived, but leaving their filter/gain
 * graph connected until browser GC makes dense combat produce avoidable graph
 * churn.  The returned handle is opt-in so the historical helper return value
 * (the source node) stays compatible for callers that do not need cancellation.
 */
function createVoiceHandle(source, nodes, onEnded) {
  let finished = false
  const disconnect = () => {
    if (finished) return
    finished = true
    for (let i = nodes.length - 1; i >= 0; i--) {
      try { nodes[i]?.disconnect?.() } catch { /* already disconnected */ }
    }
    onEnded?.()
  }

  if (typeof source.addEventListener === 'function') {
    source.addEventListener('ended', disconnect, { once: true })
  } else {
    source.onended = disconnect
  }

  return {
    source,
    stop() {
      try { source.stop?.() } catch { /* already stopped */ }
      disconnect()
    },
    disconnect,
  }
}
