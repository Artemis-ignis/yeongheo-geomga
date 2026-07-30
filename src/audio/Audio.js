import { noiseBuffer, playBuffer, playTone, pluckBuffer } from './synth.js'
import { intensityOf, isAnswerNote, nextDegree, noteFreq, noteInterval, tonicFor } from './theory.js'

/**
 * The whole soundtrack and every sound effect, synthesised at runtime.
 *
 * Two rules shape this file. It must never crash the game: a browser that
 * blocks audio, or the node test environment where AudioContext does not exist
 * at all, has to leave a silent engine that still answers every call. And it
 * must never queue unbounded work — a horde death can fire twenty kills in one
 * frame, so voices are rate-limited per sound rather than trusted to be sane.
 */

/** tanh transfer curve, normalised so quiet signal passes through unchanged. */
function softClipCurve(drive = 1.7, size = 2048) {
  const curve = new Float32Array(size)
  // Ceiling just under unity: 2x oversampling reconstructs through a filter that
  // can ring a fraction above the curve's own maximum, and measured output sat
  // at 1.018 with a ceiling of exactly 1.
  const norm = Math.tanh(drive) / 0.97
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1
    curve[i] = Math.tanh(x * drive) / norm
  }
  return curve
}

const VOICE_GAP = {
  hit: 0.035,
  kill: 0.05,
  pickup: 0.045,
  swing: 0.07,
  hurt: 0.12,
}

export class AudioEngine {
  /**
   * `contextFactory` exists so tests can pass a stub, and so the real
   * AudioContext is not constructed until the player has actually interacted
   * with the page — browsers refuse to start one before a gesture.
   */
  constructor({ contextFactory = null, storage = undefined } = {}) {
    this._factory = contextFactory ?? (() => {
      const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
      return Ctor ? new Ctor() : null
    })
    this.ctx = null
    this.ok = false
    this.muted = false
    this.masterVolume = 0.75
    this.musicVolume = 0.5
    this.sfxVolume = 0.9

    this._lastPlayed = new Map()
    this._musicOn = false
    this._noteTimer = 0
    this._degree = 0
    this._noteIndex = 0
    this._intensity = 0
    this._rngState = 20260730
    this._stageId = 'jade'
    this._storage = storage
    this._loadSettings()
  }

  // ---- lifecycle -----------------------------------------------------------

  /**
   * Must be called from a user gesture. Safe to call repeatedly; the second and
   * later calls only resume a suspended context.
   */
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = this._factory()
      } catch {
        this.ctx = null
      }
      if (!this.ctx) return false
      this._buildGraph()
      this.ok = true
    }
    if (this.ctx.state === 'suspended') this.ctx.resume?.()
    return true
  }

  _buildGraph() {
    const ctx = this.ctx
    // A limiter on the master bus. Dozens of overlapping impacts will clip a
    // bare gain node, and clipping is the one artefact that makes synthesised
    // audio sound broken rather than cheap.
    this.limiter = ctx.createDynamicsCompressor()
    this.limiter.threshold.value = -8
    this.limiter.knee.value = 6
    this.limiter.ratio.value = 12
    this.limiter.attack.value = 0.003
    this.limiter.release.value = 0.16

    this.master = ctx.createGain()
    this.sfxBus = ctx.createGain()
    this.musicBus = ctx.createGain()

    this.sfxBus.connect(this.master)
    this.musicBus.connect(this.master)
    // Brickwall after the compressor.
    //
    // A DynamicsCompressor is not a limiter: with a 3ms attack, a pack of
    // twenty creatures dying in one frame slips its transient straight through,
    // and that measured at 1.167 — hard digital clipping, the one artefact that
    // makes synthesised audio sound broken rather than cheap. A tanh curve can
    // not exceed 1.0 by construction, and it rounds peaks off musically instead
    // of shearing them.
    this.clipper = ctx.createWaveShaper()
    this.clipper.curve = softClipCurve()
    this.clipper.oversample = '2x'

    this.master.connect(this.limiter)
    this.limiter.connect(this.clipper)
    this.clipper.connect(ctx.destination)
    this._applyVolumes()
  }

  _applyVolumes() {
    if (!this.ok) return
    const m = this.muted ? 0 : this.masterVolume
    this.master.gain.value = m
    this.sfxBus.gain.value = this.sfxVolume
    this.musicBus.gain.value = this.musicVolume
  }

  setMuted(on) {
    this.muted = Boolean(on)
    this._applyVolumes()
    this._saveSettings()
  }

  toggleMute() {
    this.setMuted(!this.muted)
    return this.muted
  }

  setVolumes({ master, music, sfx } = {}) {
    if (Number.isFinite(master)) this.masterVolume = Math.min(1, Math.max(0, master))
    if (Number.isFinite(music)) this.musicVolume = Math.min(1, Math.max(0, music))
    if (Number.isFinite(sfx)) this.sfxVolume = Math.min(1, Math.max(0, sfx))
    this._applyVolumes()
    this._saveSettings()
  }

  // ---- settings ------------------------------------------------------------

  _store() {
    if (this._storage !== undefined) return this._storage
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null
    } catch {
      return null
    }
  }

  _loadSettings() {
    const s = this._store()
    if (!s) return
    try {
      const raw = JSON.parse(s.getItem('yeongheo.audio') ?? 'null')
      if (!raw || typeof raw !== 'object') return
      if (typeof raw.muted === 'boolean') this.muted = raw.muted
      if (Number.isFinite(raw.master)) this.masterVolume = Math.min(1, Math.max(0, raw.master))
      if (Number.isFinite(raw.music)) this.musicVolume = Math.min(1, Math.max(0, raw.music))
      if (Number.isFinite(raw.sfx)) this.sfxVolume = Math.min(1, Math.max(0, raw.sfx))
    } catch {
      // A corrupt settings blob must not stop the game booting.
    }
  }

  _saveSettings() {
    const s = this._store()
    if (!s) return
    try {
      s.setItem('yeongheo.audio', JSON.stringify({
        muted: this.muted,
        master: this.masterVolume,
        music: this.musicVolume,
        sfx: this.sfxVolume,
      }))
    } catch {
      // Private browsing. Settings simply do not persist.
    }
  }

  // ---- effects -------------------------------------------------------------

  /** True if this sound is allowed to fire now, given its rate limit. */
  _allow(name) {
    const gap = VOICE_GAP[name]
    if (gap === undefined) return true
    const now = this.ctx.currentTime
    const last = this._lastPlayed.get(name) ?? -1
    if (now - last < gap) return false
    this._lastPlayed.set(name, now)
    return true
  }

  _rand() {
    this._rngState = (this._rngState * 48271) % 2147483647
    return this._rngState / 2147483647
  }

  /**
   * Fire a sound effect. Unknown names are ignored rather than thrown, so a
   * typo in a weapon module cannot take the run down.
   */
  play(name, opts = {}) {
    if (!this.ok || this.muted) return
    if (!this._allow(name)) return
    const ctx = this.ctx
    const bus = this.sfxBus
    const pan = Math.max(-1, Math.min(1, opts.pan ?? 0))
    const r = this._rand()

    switch (name) {
      case 'swing':
        // Air moving, not metal: a filtered noise sweep downward.
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.3, 4001), {
          gain: 0.20, decay: 0.16, filter: 5200 + r * 1800, filterTo: 700, pan, rate: 1 + r * 0.2,
        })
        break

      case 'hit':
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.2, 7717), {
          gain: 0.24, decay: 0.075, filter: 3600, filterTo: 500, pan,
        })
        playTone(ctx, bus, {
          freq: 320 + r * 90, toFreq: 90, type: 'triangle', gain: 0.18, decay: 0.085, pan,
        })
        break

      case 'crit':
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.25, 3313), {
          gain: 0.26, decay: 0.1, filter: 7000, filterTo: 900, pan,
        })
        playTone(ctx, bus, { freq: 1180, toFreq: 480, type: 'square', gain: 0.1, decay: 0.14, pan })
        break

      case 'kill':
        playTone(ctx, bus, { freq: 150, toFreq: 48, type: 'sine', gain: 0.26, decay: 0.2, pan })
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.35, 5501), {
          gain: 0.14, decay: 0.22, filter: 1500, filterTo: 260, pan,
        })
        break

      case 'pickup': {
        // Rises with the streak, so a chain of orbs is an ascending phrase.
        const step = Math.min(9, opts.step ?? 0)
        const f = noteFreq(tonicFor(this._stageId) * 2, step)
        playBuffer(ctx, bus, pluckBuffer(ctx, f, 0.5, 0.85, 2201), { gain: 0.16, decay: 0.34, pan })
        break
      }

      case 'stone':
        playTone(ctx, bus, { freq: 880, toFreq: 1320, type: 'sine', gain: 0.13, decay: 0.2, pan })
        break

      case 'hurt':
        playTone(ctx, bus, { freq: 180, toFreq: 62, type: 'sawtooth', gain: 0.24, decay: 0.3, pan })
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.4, 9013), {
          gain: 0.18, decay: 0.26, filter: 900, filterTo: 200,
        })
        break

      case 'breakthrough': {
        // 돌파: the tonic triad of the pentatonic, struck as a rolled chord.
        const t = tonicFor(this._stageId)
        // Rolled wide, and quiet per voice. Four plucks landing together drove
        // nearly 1.0 into the limiter, and a limiter working that hard pumps
        // every other sound in the mix down with it.
        for (const [i, degree] of [0, 2, 4, 6].entries()) {
          playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(t, degree, 1), 1.6, 0.35, 4409), {
            gain: 0.11, decay: 1.2, when: i * 0.085,
          })
        }
        playTone(ctx, bus, {
          freq: t * 4, toFreq: t * 6, type: 'sine', gain: 0.07, attack: 0.12, decay: 0.9,
        })
        break
      }

      case 'levelPick':
        playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(tonicFor(this._stageId), 4, 1), 0.9, 0.5, 8123), {
          gain: 0.22, decay: 0.6,
        })
        break

      case 'boss':
        // A low horn swell. Three detuned saws is the cheapest thing that sounds
        // like more than one instrument.
        for (const detune of [-9, 0, 11]) {
          playTone(ctx, bus, {
            freq: tonicFor(this._stageId) / 2, type: 'sawtooth', detune,
            gain: 0.1, attack: 0.5, hold: 0.7, decay: 1.6,
          })
        }
        playBuffer(ctx, bus, noiseBuffer(ctx, 1.6, 6607), {
          gain: 0.1, attack: 0.4, decay: 1.4, filter: 600, filterTo: 160,
        })
        break

      case 'victory': {
        const t = tonicFor(this._stageId)
        for (const [i, degree] of [0, 2, 4, 7, 9].entries()) {
          playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(t, degree, 1), 2.2, 0.28, 1811), {
            gain: 0.13, decay: 1.8, when: i * 0.17,
          })
        }
        break
      }

      case 'defeat':
        for (const [i, detune] of [0, -14].entries()) {
          playTone(ctx, bus, {
            freq: tonicFor(this._stageId) / 2, toFreq: tonicFor(this._stageId) / 2.7,
            type: 'sawtooth', detune, gain: 0.14, attack: 0.15, hold: 0.4, decay: 2.2, when: i * 0.08,
          })
        }
        break

      case 'uiMove':
        playTone(ctx, bus, { freq: 660, type: 'sine', gain: 0.07, decay: 0.07 })
        break

      case 'uiConfirm':
        playBuffer(ctx, bus, pluckBuffer(ctx, 587.33, 0.6, 0.7, 7001), { gain: 0.18, decay: 0.4 })
        break

      default:
        break
    }
  }

  // ---- music ---------------------------------------------------------------

  startMusic(stageId = 'jade') {
    this._stageId = stageId
    if (!this.ok) return
    this._musicOn = true
    this._noteTimer = 0
    this._noteIndex = 0
    this._startDrone()
  }

  stopMusic() {
    this._musicOn = false
    if (this._drone) {
      const t = this.ctx.currentTime
      try {
        this._drone.gain.gain.cancelScheduledValues(t)
        this._drone.gain.gain.setValueAtTime(this._drone.gain.gain.value, t)
        this._drone.gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
        for (const o of this._drone.oscs) o.stop(t + 1.4)
      } catch {
        // Already stopped.
      }
      this._drone = null
    }
  }

  /**
   * A slow bed under the plucks: the tonic and its fifth, detuned against each
   * other so the pair beats slowly. Without it the plucks sound like a demo of
   * a plucked string rather than like music.
   */
  _startDrone() {
    if (this._drone) return
    const ctx = this.ctx
    const tonic = tonicFor(this._stageId)
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    gain.connect(this.musicBus)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 620
    filter.connect(gain)

    const oscs = []
    for (const [mult, detune] of [[0.5, -6], [0.5, 7], [0.75, 3]]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = tonic * mult
      osc.detune.value = detune
      osc.connect(filter)
      osc.start()
      oscs.push(osc)
    }
    gain.gain.exponentialRampToValueAtTime(0.10, ctx.currentTime + 3)
    this._drone = { gain, filter, oscs }
  }

  /**
   * Advance the music. `state` is the run's own state, not audio state — the
   * decisions live in theory.js and are covered by the suite.
   */
  update(dt, state = {}) {
    if (!this.ok || !this._musicOn || this.muted) return
    this._intensity = intensityOf(state)

    if (this._drone) {
      // Opens up as the run tightens, which reads as the world closing in.
      const target = 560 + this._intensity * 900
      const g = this._drone.filter.frequency
      g.value += (target - g.value) * Math.min(1, dt * 0.6)
    }

    this._noteTimer -= dt
    if (this._noteTimer > 0) return
    this._noteTimer = noteInterval(this._intensity) * (0.85 + this._rand() * 0.3)

    const tonic = tonicFor(this._stageId)
    this._degree = nextDegree(this._degree, this._rand(), this._intensity)
    const answer = isAnswerNote(this._noteIndex)
    this._noteIndex++

    const freq = noteFreq(tonic, this._degree, answer ? 0 : 1)
    const buf = pluckBuffer(this.ctx, freq, answer ? 2.4 : 1.5, answer ? 0.25 : 0.45, 3607)
    playBuffer(this.ctx, this.musicBus, buf, {
      gain: (answer ? 0.26 : 0.17) * (0.7 + this._intensity * 0.5),
      decay: answer ? 1.9 : 1.1,
      pan: (this._rand() - 0.5) * 0.5,
    })
  }

  dispose() {
    this.stopMusic()
    try {
      this.ctx?.close?.()
    } catch {
      // Nothing to do if it is already closed.
    }
    this.ctx = null
    this.ok = false
  }
}
