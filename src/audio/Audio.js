import { noiseBuffer, playBuffer, playTone, pluckBuffer } from './synth.js'
import {
  BEATS_PER_BAR, chordRootAt, drumsForBar, intensityOf, noteFreq,
  phraseAt, scaleFor, tempoFor, tonicFor,
} from './theory.js'

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

/**
 * How each damage element sounds when it lands.
 *
 * `filter` and `wave` do most of the work: a bright noise burst with a square
 * partial reads as metal, a dark one with a sine reads as a thud, and a long
 * plucked tail reads as glass. `ring` adds that tail where it belongs.
 */
const IMPACT_VOICE = {
  physical: { freq: 300, drop: 0.28, wave: 'triangle', filter: 3200, decay: 0.1, body: 2.0, tone: 1.8, ring: 0, seed: 7717 },
  // Loudness matched by ear-equivalent measurement, not by the numbers looking
  // even: a short bright square reads far quieter than a long dark saw at the
  // same gain, and 비검 measured at a quarter of 화염's peak before this.
  sword: { freq: 720, drop: 0.35, wave: 'square', filter: 7200, decay: 0.09, body: 1.05, tone: 0.95, ring: 0.7, seed: 3313 },
  fire: { freq: 240, drop: 0.4, wave: 'sawtooth', filter: 2400, decay: 0.14, body: 1.25, tone: 0.9, ring: 0, seed: 5501 },
  ice: { freq: 980, drop: 0.55, wave: 'sine', filter: 8600, decay: 0.06, body: 0.6, tone: 0.6, ring: 1.2, seed: 9013 },
  thunder: { freq: 1500, drop: 0.12, wave: 'square', filter: 11000, decay: 0.05, body: 1.1, tone: 0.8, ring: 0, seed: 4409 },
  array: { freq: 180, drop: 0.7, wave: 'sine', filter: 1400, decay: 0.2, body: 0.7, tone: 1.2, ring: 0.9, seed: 1811 },
  poison: { freq: 200, drop: 0.5, wave: 'sawtooth', filter: 1800, decay: 0.16, body: 1.0, tone: 0.5, ring: 0, seed: 2201 },
  wind: { freq: 420, drop: 0.45, wave: 'triangle', filter: 5200, decay: 0.12, body: 0.9, tone: 0.5, ring: 0, seed: 6607 },
}

/** Launch voice per projectile kind, matched to the trail it leaves. */
const LAUNCH_VOICE = {
  sword: { freq: 1250, to: 420, filter: 6400, gain: 0.11, decay: 0.1 },
  talisman: { freq: 620, to: 300, filter: 3000, gain: 0.09, decay: 0.15 },
  vajra: { freq: 300, to: 130, filter: 1900, gain: 0.13, decay: 0.13 },
  butterfly: { freq: 900, to: 620, filter: 5200, gain: 0.07, decay: 0.18 },
  darkSword: { freq: 900, to: 260, filter: 4200, gain: 0.11, decay: 0.13 },
}

/** Intensity above which the low pulse joins the score. */
const PULSE_THRESHOLD = 0.42

/**
 * How far ahead the sequencer schedules, in seconds.
 *
 * Long enough that a frame hitch — or a whole second of one, which is what the
 * player reported — cannot leave a gap in the music, short enough that a change
 * in intensity is heard within a bar rather than after one.
 */
const SCHEDULE_AHEAD = 0.35

const VOICE_GAP = {
  launch: 0.055,
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
    this._pulseTimer = 0
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

  /** The 조 this 비경 is in. Every note the score plays goes through it. */
  _scale() {
    return scaleFor(this._stageId)
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

      case 'launch': {
        // Quiet by design. This fires on every shot of a built loadout, which
        // is several a second — it has to be felt more than heard, or it buries
        // the impacts it is announcing.
        const v = LAUNCH_VOICE[opts.kind]
        if (!v) break
        playTone(ctx, bus, {
          freq: v.freq, toFreq: v.to, type: 'triangle',
          gain: v.gain, attack: 0.004, decay: v.decay, pan,
        })
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.22, 4001), {
          gain: v.gain * 0.55, decay: v.decay * 0.8, filter: v.filter, filterTo: v.filter * 0.2, pan,
        })
        break
      }

      case 'hit': {
        // Impact voiced by element.
        //
        // Every 법보 landed with the same click, so a loadout that had just been
        // given six distinct silhouettes and six distinct trails still sounded
        // like one weapon. Timbre is the channel that survives a crowded frame
        // best — the player often hears a hit they did not see.
        const v = IMPACT_VOICE[opts.tag] ?? IMPACT_VOICE.physical
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.22, v.seed), {
          gain: 0.2 * v.body, decay: v.decay, filter: v.filter, filterTo: v.filter * 0.14, pan,
        })
        playTone(ctx, bus, {
          freq: v.freq * (0.92 + r * 0.16), toFreq: v.freq * v.drop,
          type: v.wave, gain: 0.16 * v.tone, decay: v.decay * 1.15, pan,
        })
        // Ice and 진법 ring on afterwards; a sword and a fist do not.
        if (v.ring) {
          playBuffer(ctx, bus, pluckBuffer(ctx, v.freq * 3, 0.7, 0.5, v.seed + 7), {
            gain: 0.09 * v.ring, decay: 0.45, pan,
          })
        }
        break
      }

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
        const f = noteFreq(tonicFor(this._stageId) * 2, step, 0, this._scale())
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
          playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(t, degree, 1, this._scale()), 1.6, 0.35, 4409), {
            gain: 0.11, decay: 1.2, when: i * 0.085,
          })
        }
        playTone(ctx, bus, {
          freq: t * 4, toFreq: t * 6, type: 'sine', gain: 0.07, attack: 0.12, decay: 0.9,
        })
        break
      }

      case 'levelPick':
        playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(tonicFor(this._stageId), 4, 1, this._scale()), 0.9, 0.5, 8123), {
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
          playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(t, degree, 1, this._scale()), 2.2, 0.28, 1811), {
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
    this._pulseTimer = 0
    // Where the sequencer has scheduled up to, on the audio clock. See _sequence.
    this._nextNoteTime = this.ctx.currentTime + 0.12
    this._beat = 0          // beats elapsed since the music started
    this._noteAt = 0        // index into the current phrase
    this._phraseIndex = 0
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
   *
   * The oscillators are pitched by `_setDroneRoot` as the progression moves, so
   * this is a bass part rather than the single held note it used to be.
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
    const mults = [[0.5, -6], [0.5, 7], [0.75, 3]]
    for (const [mult, detune] of mults) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = tonic * mult
      osc.detune.value = detune
      osc.connect(filter)
      osc.start()
      oscs.push(osc)
    }
    gain.gain.exponentialRampToValueAtTime(0.10, ctx.currentTime + 3)
    this._drone = { gain, filter, oscs, mults }
  }

  /**
   * Glide the bass to a new chord root.
   *
   * Glide, not jump: three detuned sawtooths re-pitched instantly click, and a
   * bass that slides between chords is the sound this score wants anyway.
   */
  _setDroneRoot(degree, when, seconds) {
    if (!this._drone) return
    const f = noteFreq(tonicFor(this._stageId), degree, -1, this._scale())
    for (let i = 0; i < this._drone.oscs.length; i++) {
      const [mult] = this._drone.mults[i]
      const target = Math.max(20, f * mult * 2)
      const p = this._drone.oscs[i].frequency
      try {
        p.cancelScheduledValues(when)
        p.setValueAtTime(p.value, when)
        p.exponentialRampToValueAtTime(target, when + seconds)
      } catch {
        // A stopped oscillator; the next startMusic rebuilds it.
      }
    }
  }

  /** 장구. `deep` is the palm-struck head, `tap` the stick. */
  _drum(voice, when, velocity) {
    const deep = voice === 'deep'
    const buf = noiseBuffer(this.ctx, deep ? 0.34 : 0.12, deep ? 4241 : 991)
    playBuffer(this.ctx, this.musicBus, buf, {
      gain: (deep ? 0.30 : 0.13) * velocity,
      attack: 0.001,
      decay: deep ? 0.20 : 0.055,
      filter: deep ? 420 : 5200,
      filterTo: deep ? 90 : 2600,
      pan: deep ? 0 : 0.22,
      // Without this the noise body of every hit fires the instant it is
      // scheduled while its pitched thump waits for the beat — the drum splits
      // into two sounds up to a third of a second apart.
      when: when - this.ctx.currentTime,
    })
    if (deep) {
      // A pitched thump under the noise, or it reads as a hiss rather than a
      // drum. The drop is what makes a membrane sound struck.
      playTone(this.ctx, this.musicBus, {
        freq: 128, toFreq: 52, type: 'sine',
        gain: 0.26 * velocity, attack: 0.002, decay: 0.20, when: when - this.ctx.currentTime,
      })
    }
  }

  /**
   * Schedule every event that falls inside the lookahead window.
   *
   * This is the whole reason the music now has a beat. It used to schedule notes
   * from the render loop — a note fired whenever a frame happened to land, with
   * the interval jittered on top — so the rhythm wobbled with the frame rate and
   * fell apart entirely when the game stuttered. Nothing scheduled that way can
   * hold a pulse.
   *
   * Here the sequencer runs on `ctx.currentTime` and schedules ahead, so timing
   * is sample-accurate and completely independent of how the renderer is doing.
   */
  _sequence() {
    const ctx = this.ctx
    const horizon = ctx.currentTime + SCHEDULE_AHEAD
    const tonic = tonicFor(this._stageId)
    const scale = this._scale()

    while (this._nextNoteTime < horizon) {
      const spb = 60 / tempoFor(this._intensity)
      const phrase = phraseAt(this._phraseIndex)
      const [degree, beats] = phrase[this._noteAt]
      const when = this._nextNoteTime
      const bar = Math.floor(this._beat / BEATS_PER_BAR)

      // Bar boundary: move the bass, and lay in the drums for the bar ahead.
      if (this._beat % BEATS_PER_BAR === 0) {
        this._setDroneRoot(chordRootAt(bar), when, spb * BEATS_PER_BAR * 0.6)
        for (const [b, voice, vel] of drumsForBar(this._intensity, bar)) {
          this._drum(voice, when + b * spb, vel)
        }
      }

      if (degree !== null) {
        const low = degree <= 0
        const freq = noteFreq(tonic, degree, low ? 0 : 1, scale)
        const buf = pluckBuffer(ctx, freq, low ? 2.4 : 1.5, low ? 0.25 : 0.45, 3607)
        playBuffer(ctx, this.musicBus, buf, {
          gain: (low ? 0.26 : 0.19) * (0.7 + this._intensity * 0.45),
          decay: Math.min(1.9, beats * spb * 1.4),
          pan: ((this._noteAt % 5) / 4 - 0.5) * 0.4,
          when: when - ctx.currentTime,
        })

        // 편경 — a stone chime two octaves up, keeping air in a mix that is dark
        // by construction: the drone is filtered sawtooths and a Karplus-Strong
        // pluck is a lowpassed feedback loop. Measured, the bed carried 1-4%
        // of its energy above 2.5 kHz without this.
        const lift = beats >= 2 ? 1 : 0.34
        for (const [mult, gain, decay] of [[1, 0.055, 0.7], [2.76, 0.022, 0.45]]) {
          playTone(ctx, this.musicBus, {
            freq: freq * 4 * mult, type: 'sine',
            gain: gain * lift * (0.75 + this._intensity * 0.35),
            attack: 0.004, decay: decay * lift,
            pan: ((this._noteAt % 3) / 2 - 0.5) * 0.6,
            when: when - ctx.currentTime,
          })
        }
      }

      this._nextNoteTime += beats * spb
      this._beat += beats
      this._noteAt++
      if (this._noteAt >= phrase.length) {
        this._noteAt = 0
        this._phraseIndex++
        // Re-anchor the bar count to the phrase so a phrase whose beats do not
        // divide evenly cannot walk the downbeat off the drums.
        this._beat = Math.round(this._beat / BEATS_PER_BAR) * BEATS_PER_BAR
      }
    }
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

    // The free-running low pulse that used to live here is gone. It existed
    // because there was no beat and danger had to be signalled somehow; now the
    // 장구 carries it, on the grid, and two unsynchronised pulses in the bottom
    // octave fight each other. `drumsForBar` escalates the kit with intensity,
    // which is the same idea done in time.

    this._sequence()
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
