import { noiseBuffer, playBuffer, playTone, pluckBuffer } from './synth.js'
import {
  BEATS_PER_BAR, drumsForBar, intensityOf, noteFreq,
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
const AUDIO_SETTINGS_VERSION = 2
// Keep the release stinger out of the boss's final impact tail. The boss death
// voice is intentionally heavy (its saw body lasts just under a second), so a
// same-tick victory chord would otherwise read as clipped overlap rather than a
// clear resolution.
export const BOSS_DEATH_VICTORY_GAP = 0.95

const VOICE_GAP = {
  launch: 0.055,
  hit: 0.035,
  kill: 0.08,
  pickup: 0.045,
  swing: 0.07,
  hurt: 0.12,
  dash: 0.12,
  heal: 0.25,
  finalBoss: 0.8,
  weaponLaunch: 0.055,
  weaponImpact: 0.035,
  weaponField: 0.08,
  weaponStatus: 0.1,
  crit: 0.035,
  bossTelegraph: 0.24,
  bossImpact: 0.08,
  bossHit: 0.035,
  bossDeath: 0.45,
  evolution: 0.25,
  daoSelect: 0.12,
  formation: 0.24,
  timeout: 0.45,
}

export const MAX_ACTIVE_SFX_VOICES = 32

const SFX_PRIORITY = Object.freeze({
  launch: 18,
  weaponLaunch: 18,
  swing: 22,
  pickup: 28,
  stone: 28,
  hit: 34,
  weaponImpact: 36,
  weaponField: 30,
  weaponStatus: 42,
  kill: 46,
  dash: 56,
  uiMove: 48,
  uiConfirm: 54,
  levelPick: 62,
  heal: 68,
  daoSelect: 70,
  breakthrough: 72,
  evolution: 78,
  formation: 76,
  hurt: 82,
  crit: 86,
  bossHit: 90,
  bossTelegraph: 92,
  bossImpact: 96,
  boss: 98,
  finalBoss: 105,
  timeout: 102,
  bossDeath: 108,
  victory: 112,
  defeat: 112,
})

const SFX_NAMES = new Set([
  'swing', 'launch', 'hit', 'crit', 'kill', 'pickup', 'stone', 'hurt', 'dash', 'heal',
  'breakthrough', 'levelPick', 'boss', 'victory', 'defeat', 'uiMove', 'uiConfirm',
  'weaponLaunch', 'weaponImpact', 'weaponField', 'weaponStatus',
  'bossTelegraph', 'bossImpact', 'bossHit', 'bossDeath',
  'evolution', 'daoSelect', 'formation', 'timeout', 'finalBoss',
])

const WEAPON_PHASES = Object.freeze({
  launch: 'weaponLaunch',
  impact: 'weaponImpact',
  field: 'weaponField',
  status: 'weaponStatus',
})

function weaponCueRow(kind, launchVoice, impactTag, fieldTag = impactTag, statusTag = fieldTag) {
  return Object.freeze({
    kind,
    launch: WEAPON_PHASES.launch,
    impact: WEAPON_PHASES.impact,
    field: WEAPON_PHASES.field,
    status: WEAPON_PHASES.status,
    launchVoice,
    impactTag,
    fieldTag,
    statusTag,
  })
}

/**
 * Fixed, renderer-independent voice routing for the 2D weapon descriptors.
 * The descriptor's audio.kind is deliberately the only dynamic input: raw
 * `weapon.<id>.*` strings never become WebAudio graph names.
 */
export const WEAPON_AUDIO_CUE_TABLE = Object.freeze({
  blade: weaponCueRow('blade', 'sword', 'sword'),
  fire: weaponCueRow('fire', 'talisman', 'fire'),
  thunder: weaponCueRow('thunder', 'vajra', 'thunder'),
  frost: weaponCueRow('frost', 'butterfly', 'ice'),
  array: weaponCueRow('array', 'vajra', 'array'),
  metal: weaponCueRow('metal', 'vajra', 'physical'),
  spirit: weaponCueRow('spirit', 'butterfly', 'wind'),
  poison: weaponCueRow('poison', 'talisman', 'poison'),
  needle: weaponCueRow('needle', 'sword', 'physical'),
  bell: weaponCueRow('bell', 'butterfly', 'array'),
  wind: weaponCueRow('wind', 'sword', 'wind'),
  earth: weaponCueRow('earth', 'vajra', 'array'),
  void: weaponCueRow('void', 'darkSword', 'physical', 'wind', 'wind'),
  thunderStrike: weaponCueRow('thunderStrike', 'vajra', 'thunder'),
  bladeRain: weaponCueRow('bladeRain', 'sword', 'sword'),
  inferno: weaponCueRow('inferno', 'talisman', 'fire'),
  chainThunder: weaponCueRow('chainThunder', 'vajra', 'thunder'),
  freeze: weaponCueRow('freeze', 'butterfly', 'ice'),
  plague: weaponCueRow('plague', 'talisman', 'poison'),
  needleRain: weaponCueRow('needleRain', 'sword', 'physical'),
  generic: weaponCueRow('generic', 'sword', 'physical'),
})

// Keep common authored aliases stable without importing runtime2d modules into
// the audio layer (which would create a renderer/audio dependency cycle).
const WEAPON_AUDIO_KIND_ALIASES = Object.freeze({
  sword: 'blade', ice: 'frost', physical: 'metal', talisman: 'fire',
  lightning: 'thunder', dark: 'void',
})

export const WEAPON_AUDIO_CUES = WEAPON_AUDIO_CUE_TABLE

function cueRowFor(kind) {
  const raw = String(kind ?? 'generic').trim()
  const normalized = WEAPON_AUDIO_KIND_ALIASES[raw] ?? raw
  return WEAPON_AUDIO_CUE_TABLE[normalized] ?? WEAPON_AUDIO_CUE_TABLE.generic
}

export function resolveWeaponAudioCue(kind, phase = 'impact') {
  const row = cueRowFor(kind)
  const normalizedPhase = String(phase ?? 'impact').replace(/Cue$/, '')
  return row[normalizedPhase] ?? row.impact
}

export class AudioEngine {
  /**
   * `contextFactory` exists so tests can pass a stub, and so the real
   * AudioContext is not constructed until the player has actually interacted
   * with the page — browsers refuse to start one before a gesture.
   */
  constructor({ contextFactory = null, storage = undefined, maxActiveSfxVoices = MAX_ACTIVE_SFX_VOICES } = {}) {
    this._factory = contextFactory ?? (() => {
      const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
      return Ctor ? new Ctor() : null
    })
    this.ctx = null
    this.ok = false
    // Sound is part of the first-ten-second experience. The title click is a
    // user gesture, so browsers allow us to unlock the graph without forcing a
    // new player to discover a hidden mute toggle first. A saved explicit mute
    // choice is still restored below.
    this.muted = false
    this.masterVolume = 0.75
    this.musicVolume = 0.5
    this.sfxVolume = 0.9

    this._lastPlayed = new Map()
    this._lastUiCueAt = new Map()
    this._lastBossDeathAt = -Infinity
    this._musicOn = false
    this._intensity = 0
    this._rngState = 20260730
    this._stageId = 'jade'
    this._storage = storage
    this.maxActiveSfxVoices = Math.max(1, Math.min(
      MAX_ACTIVE_SFX_VOICES,
      Number.isFinite(maxActiveSfxVoices) ? Math.trunc(maxActiveSfxVoices) : MAX_ACTIVE_SFX_VOICES,
    ))
    this._activeSfxVoices = new Set()
    this._voiceSerial = 0
    this._startedSfxVoices = 0
    this._endedSfxVoices = 0
    this._droppedSfxVoices = 0
    this._preemptedSfxVoices = 0
    this._ducked = false
    this._duckLevel = 1
    this._suspended = false
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
    if (this.ctx.state === 'suspended') {
      // Browsers return a Promise here. A synchronous try/catch cannot catch a
      // policy rejection, so always settle it and retry on the next gesture.
      this.ctx.resume?.()?.catch?.(() => {})
    }
    return true
  }

  /**
   * Resolve the browser audio policy from the current user gesture. Kept as a
   * named operation so callers such as the mute shortcut can resume a context
   * even when the player had previously chosen silence.
   */
  ensureUnlocked() {
    return this.unlock()
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
    const m = this.muted || this._suspended ? 0 : this.masterVolume * this._duckLevel
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

  /**
   * Duck the whole mix for pause/menu emphasis without changing saved volume.
   * `level` is the remaining master level, so 0.28 is a quiet but audible bed.
   */
  setDucked(on, level = 0.28) {
    this._ducked = Boolean(on)
    this._duckLevel = this._ducked
      ? Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0.28))
      : 1
    this._applyVolumes()
    return this._ducked
  }

  duck(on = true, level = 0.28) {
    if (typeof on === 'number') return this.setDucked(true, on)
    return this.setDucked(on, level)
  }

  /** Suspend/resume both the audio clock and the mix for hidden-tab handling. */
  setSuspended(on) {
    this._suspended = Boolean(on)
    this._applyVolumes()
    if (this.ctx) {
      try {
        if (this._suspended) this.ctx.suspend?.()?.catch?.(() => {})
        else this.ctx.resume?.()?.catch?.(() => {})
      } catch {
        // Browser policy can reject a resume; the next user gesture retries it.
      }
    }
    if (!this._suspended && this._musicOn && this.ctx) {
      // Do not replay every note that elapsed while the tab was hidden.
      this._nextNoteTime = this.ctx.currentTime + 0.12
    }
    return this._suspended
  }

  suspend() { return this.setSuspended(true) }

  resume() { return this.setSuspended(false) }

  setVisibility(hidden) { return this.setSuspended(Boolean(hidden)) }

  /** Stop all active one-shot SFX and release their graph handles. */
  stopAllSfx() {
    const voices = [...this._activeSfxVoices]
    for (const voice of voices) this._releaseVoice(voice, { stop: true })
    return voices.length
  }

  getVoiceDiagnostics() {
    return Object.freeze({
      activeSfxVoices: this._activeSfxVoices.size,
      maxActiveSfxVoices: this.maxActiveSfxVoices,
      startedSfxVoices: this._startedSfxVoices,
      endedSfxVoices: this._endedSfxVoices,
      droppedSfxVoices: this._droppedSfxVoices,
      preemptedSfxVoices: this._preemptedSfxVoices,
      muted: this.muted,
      ducked: this._ducked,
      suspended: this._suspended,
    })
  }

  diagnostics() { return this.getVoiceDiagnostics() }

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
      // Only this schema represents an explicit player choice. Older blobs are
      // ignored so a stale migration value cannot silently disable the score.
      if (raw.version === AUDIO_SETTINGS_VERSION && typeof raw.muted === 'boolean') {
        this.muted = raw.muted
      }
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
        version: AUDIO_SETTINGS_VERSION,
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

  _priorityFor(name, opts = {}) {
    return Number.isFinite(opts.priority)
      ? opts.priority
      : (SFX_PRIORITY[name] ?? 32)
  }

  _releaseVoice(voice, { stop = false, dropped = false } = {}) {
    if (!voice || voice.finished) return false
    // Mark finished before stopping sources: a test double or a browser can
    // dispatch `ended` synchronously from stop().
    voice.finished = true
    this._activeSfxVoices.delete(voice)
    this._endedSfxVoices++
    if (dropped) this._droppedSfxVoices++
    if (stop) {
      for (const handle of voice.handles) {
        try { handle.stop?.() } catch { /* already stopped */ }
      }
    }
    return true
  }

  _beginVoice(name, priority) {
    if (this._activeSfxVoices.size >= this.maxActiveSfxVoices) {
      let weakest = null
      for (const candidate of this._activeSfxVoices) {
        if (!weakest
          || candidate.priority < weakest.priority
          || (candidate.priority === weakest.priority && candidate.serial < weakest.serial)) {
          weakest = candidate
        }
      }
      if (!weakest || priority <= weakest.priority) {
        this._droppedSfxVoices++
        return null
      }
      this._preemptedSfxVoices++
      this._releaseVoice(weakest, { stop: true, dropped: true })
    }

    const voice = {
      name,
      priority,
      serial: this._voiceSerial++,
      parts: 0,
      handles: [],
      finished: false,
    }
    this._activeSfxVoices.add(voice)
    this._startedSfxVoices++
    return voice
  }

  _voicePartEnded(voice) {
    if (!voice || voice.finished) return
    voice.parts--
    if (voice.parts <= 0) this._releaseVoice(voice)
  }

  _playBufferVoice(voice, buffer, options = {}) {
    if (!voice) return null
    voice.parts++
    try {
      const handle = playBuffer(this.ctx, this.sfxBus, buffer, {
        ...options,
        returnHandle: true,
        onEnded: () => this._voicePartEnded(voice),
      })
      voice.handles.push(handle)
      return handle
    } catch (error) {
      this._voicePartEnded(voice)
      throw error
    }
  }

  _playToneVoice(voice, options = {}) {
    if (!voice) return null
    voice.parts++
    try {
      const handle = playTone(this.ctx, this.sfxBus, {
        ...options,
        returnHandle: true,
        onEnded: () => this._voicePartEnded(voice),
      })
      voice.handles.push(handle)
      return handle
    } catch (error) {
      this._voicePartEnded(voice)
      throw error
    }
  }

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
  playWeaponCue(kindOrCue, phaseOrOpts = 'impact', maybeOpts = {}) {
    let kind = kindOrCue
    let phase = phaseOrOpts
    let opts = maybeOpts
    if (phaseOrOpts && typeof phaseOrOpts === 'object') {
      opts = phaseOrOpts
      phase = opts.phase ?? 'impact'
    }
    const raw = String(kindOrCue ?? 'generic')
    if (raw.startsWith('weapon.')) {
      const dot = raw.lastIndexOf('.')
      phase = dot >= 0 ? raw.slice(dot + 1) : 'impact'
      kind = opts.audioKind ?? opts.kind ?? 'generic'
    }
    const row = cueRowFor(kind)
    const cue = row[String(phase ?? 'impact').replace(/Cue$/, '')] ?? row.impact
    return this.play(cue, { ...opts, audioKind: row.kind })
  }

  playWeapon(kind, phase = 'impact', opts = {}) {
    return this.playWeaponCue(kind, phase, opts)
  }

  /** Shared low-noise cue vocabulary for menus and keyboard focus. */
  playUiCue(kind = 'confirm', opts = {}) {
    const cue = kind === 'focus' || kind === 'move' || kind === 'uiMove'
      ? 'uiMove'
      : 'uiConfirm'
    // Pointer hover can emit mouseenter and focus back-to-back, while a held
    // direction key can repeat. Rate-limit only this shared semantic API; raw
    // `play('uiMove')` remains a low-level primitive for legacy callers/tests.
    const gap = cue === 'uiMove' ? 0.06 : 0.08
    const now = this.ctx?.currentTime
    const last = this._lastUiCueAt.get(cue) ?? -Infinity
    if (Number.isFinite(now) && now - last < gap) return false
    const played = this.play(cue, opts)
    if (played && Number.isFinite(now)) this._lastUiCueAt.set(cue, now)
    return played
  }

  play(name, opts = {}) {
    if (typeof name !== 'string') return false
    if (name.startsWith('weapon.')) return this.playWeaponCue(name, opts)
    if (name === 'weapon' || name === 'weaponCue') {
      return this.playWeaponCue(opts.audioKind ?? opts.kind, opts.phase ?? 'impact', opts)
    }
    if (!SFX_NAMES.has(name) || !this.ok || this.muted || this._suspended) return false
    if (!this._allow(name)) return false
    const ctx = this.ctx
    const bus = this.sfxBus
    const pan = Math.max(-1, Math.min(1, opts.pan ?? 0))
    const r = this._rand()
    const voice = this._beginVoice(name, this._priorityFor(name, opts))
    if (!voice) return false
    const previousTracker = ctx.__yeongheoSfxTracker
    ctx.__yeongheoSfxTracker = {
      begin: () => {
        voice.parts++
        return () => this._voicePartEnded(voice)
      },
      attach: (handle) => { voice.handles.push(handle) },
    }

    try {
      switch (name) {
      case 'swing':
        // Air moving, not metal: a filtered noise sweep downward.
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.3, 4001), {
          gain: 0.20, decay: 0.16, filter: 5200 + r * 1800, filterTo: 700, pan, rate: 1 + r * 0.2,
        })
        break

      case 'launch':
      case 'weaponLaunch': {
        // Quiet by design. This fires on every shot of a built loadout, which
        // is several a second — it has to be felt more than heard, or it buries
        // the impacts it is announcing.
        const row = name === 'weaponLaunch' ? cueRowFor(opts.audioKind ?? opts.kind) : null
        const v = LAUNCH_VOICE[row?.launchVoice ?? opts.kind]
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

      case 'hit':
      case 'weaponImpact':
      case 'weaponField':
      case 'weaponStatus': {
        // Impact voiced by element.
        //
        // Every 법보 landed with the same click, so a loadout that had just been
        // given six distinct silhouettes and six distinct trails still sounded
        // like one weapon. Timbre is the channel that survives a crowded frame
        // best — the player often hears a hit they did not see.
        const row = name.startsWith('weapon') ? cueRowFor(opts.audioKind ?? opts.kind) : null
        const tag = row
          ? (name === 'weaponField' ? row.fieldTag : name === 'weaponStatus' ? row.statusTag : row.impactTag)
          : opts.tag
        const v = IMPACT_VOICE[tag] ?? IMPACT_VOICE.physical
        const phaseScale = name === 'weaponField' ? 0.62 : name === 'weaponStatus' ? 0.72 : 1
        playBuffer(ctx, bus, noiseBuffer(ctx, name === 'weaponField' ? 0.28 : 0.22, v.seed), {
          gain: 0.2 * v.body * phaseScale, decay: name === 'weaponField' ? Math.max(v.decay, 0.24) : v.decay,
          filter: v.filter, filterTo: v.filter * 0.14, pan,
        })
        playTone(ctx, bus, {
          freq: v.freq * (0.92 + r * 0.16), toFreq: v.freq * v.drop,
          type: v.wave, gain: 0.16 * v.tone * phaseScale, decay: v.decay * 1.15, pan,
        })
        // Ice and 진법 ring on afterwards; a sword and a fist do not.
        if (v.ring && name !== 'weaponField') {
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

      case 'dash':
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.24, 7351), {
          gain: 0.12, attack: 0.002, decay: 0.16, filter: 4200, filterTo: 780, pan,
        })
        playTone(ctx, bus, {
          freq: 460, toFreq: 1120, type: 'triangle', gain: 0.075, attack: 0.004, decay: 0.13, pan,
        })
        break

      case 'heal': {
        const tonic = tonicFor(this._stageId)
        for (const [index, degree] of [0, 2, 4].entries()) {
          playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(tonic, degree, 2, this._scale()), 0.72, 0.62, 6221 + index), {
            gain: 0.095, attack: 0.008, decay: 0.48, when: index * 0.075, pan,
          })
        }
        playTone(ctx, bus, {
          freq: tonic * 2, toFreq: tonic * 3, type: 'sine', gain: 0.055, attack: 0.08, decay: 0.55, pan,
        })
        break
      }

      case 'hurt':
        playTone(ctx, bus, { freq: 180, toFreq: 62, type: 'sawtooth', gain: 0.24, decay: 0.3, pan })
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.4, 9013), {
          gain: 0.18, decay: 0.26, filter: 900, filterTo: 200,
        })
        break

      case 'breakthrough':
      case 'evolution': {
        // 돌파: the tonic triad of the pentatonic, struck as a rolled chord.
        const t = tonicFor(this._stageId)
        // Rolled wide, and quiet per voice. Four plucks landing together drove
        // nearly 1.0 into the limiter, and a limiter working that hard pumps
        // every other sound in the mix down with it.
        const degrees = name === 'evolution' ? [0, 3, 5, 7] : [0, 2, 4, 6]
        for (const [i, degree] of degrees.entries()) {
          playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(t, degree, 1, this._scale()), 1.6, 0.35, 4409), {
            gain: name === 'evolution' ? 0.13 : 0.11, decay: 1.2, when: i * 0.085,
          })
        }
        playTone(ctx, bus, {
          freq: t * (name === 'evolution' ? 5 : 4), toFreq: t * (name === 'evolution' ? 8 : 6),
          type: 'sine', gain: 0.07, attack: 0.12, decay: 0.9,
        })
        break
      }

      case 'daoSelect':
        playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(tonicFor(this._stageId), 2, 1, this._scale()), 0.8, 0.45, 9973), {
          gain: 0.2, decay: 0.52,
        })
        playTone(ctx, bus, {
          freq: tonicFor(this._stageId) * 3, toFreq: tonicFor(this._stageId) * 4,
          type: 'sine', gain: 0.08, decay: 0.42,
        })
        break

      case 'levelPick':
        playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(tonicFor(this._stageId), 4, 1, this._scale()), 0.9, 0.5, 8123), {
          gain: 0.22, decay: 0.6,
        })
        break

      case 'boss':
      case 'finalBoss':
      case 'bossTelegraph': {
        // A low horn swell. Three detuned saws is the cheapest thing that sounds
        // like more than one instrument.
        const telegraph = name === 'bossTelegraph'
        const final = name === 'finalBoss'
        for (const detune of telegraph ? [-5, 5] : final ? [-14, -4, 7, 17] : [-9, 0, 11]) {
          playTone(ctx, bus, {
            freq: tonicFor(this._stageId) / (telegraph ? 1.4 : final ? 2.8 : 2),
            type: telegraph ? 'triangle' : 'sawtooth', detune,
            gain: telegraph ? 0.08 : final ? 0.075 : 0.1,
            attack: telegraph ? 0.08 : 0.5,
            hold: telegraph ? 0.1 : final ? 0.95 : 0.7,
            decay: telegraph ? 0.52 : final ? 2.1 : 1.6,
          })
        }
        playBuffer(ctx, bus, noiseBuffer(ctx, telegraph ? 0.36 : final ? 2.1 : 1.6, final ? 6619 : 6607), {
          gain: telegraph ? 0.07 : final ? 0.13 : 0.1,
          attack: telegraph ? 0.08 : final ? 0.22 : 0.4,
          decay: telegraph ? 0.42 : final ? 1.9 : 1.4,
          filter: telegraph ? 1400 : final ? 820 : 600,
          filterTo: telegraph ? 240 : final ? 90 : 160,
        })
        if (final) {
          playTone(ctx, bus, {
            freq: tonicFor(this._stageId) * 4, toFreq: tonicFor(this._stageId),
            type: 'sine', gain: 0.065, attack: 0.02, decay: 1.3,
          })
        }
        break
      }

      case 'bossImpact':
        playTone(ctx, bus, { freq: 120, toFreq: 38, type: 'sawtooth', gain: 0.25, decay: 0.24, pan })
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.42, 1777), {
          gain: 0.2, decay: 0.3, filter: 1700, filterTo: 160, pan,
        })
        break

      case 'bossHit': {
        const v = IMPACT_VOICE[opts.tag] ?? IMPACT_VOICE.physical
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.24, v.seed + 101), {
          gain: 0.24 * v.body, decay: v.decay, filter: v.filter, filterTo: v.filter * 0.12, pan,
        })
        playTone(ctx, bus, {
          freq: v.freq * 0.8, toFreq: v.freq * v.drop * 0.8,
          type: v.wave, gain: 0.18, decay: v.decay, pan,
        })
        break
      }

      case 'bossDeath':
        this._lastBossDeathAt = ctx.currentTime
        playTone(ctx, bus, {
          freq: 96, toFreq: 28, type: 'sawtooth', gain: 0.3, attack: 0.01, hold: 0.12, decay: 0.75,
        })
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.62, 7613), {
          gain: 0.22, decay: 0.52, filter: 1900, filterTo: 110,
        })
        break

      case 'formation':
        playTone(ctx, bus, { freq: 210, toFreq: 84, type: 'triangle', gain: 0.16, decay: 0.34 })
        playBuffer(ctx, bus, noiseBuffer(ctx, 0.22, 3131), {
          gain: 0.1, decay: 0.18, filter: 1200, filterTo: 220,
        })
        break

      case 'timeout':
        playTone(ctx, bus, {
          freq: 220, toFreq: 110, type: 'sawtooth', gain: 0.18, attack: 0.04, hold: 0.1, decay: 0.48,
        })
        playTone(ctx, bus, {
          freq: 165, toFreq: 82, type: 'sawtooth', gain: 0.14, attack: 0.1, hold: 0.1, decay: 0.56, when: 0.12,
        })
        break

      case 'victory': {
        const t = tonicFor(this._stageId)
        const introDelay = Number.isFinite(this._lastBossDeathAt)
          ? Math.max(0, this._lastBossDeathAt + BOSS_DEATH_VICTORY_GAP - ctx.currentTime)
          : 0
        for (const [i, degree] of [0, 2, 4, 7, 9].entries()) {
          playBuffer(ctx, bus, pluckBuffer(ctx, noteFreq(t, degree, 1, this._scale()), 2.2, 0.28, 1811), {
            gain: 0.13, decay: 1.8, when: introDelay + i * 0.17,
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
    } catch {
      this._releaseVoice(voice, { stop: true, dropped: true })
      if (previousTracker) ctx.__yeongheoSfxTracker = previousTracker
      else delete ctx.__yeongheoSfxTracker
      return false
    }
    if (previousTracker) ctx.__yeongheoSfxTracker = previousTracker
    else delete ctx.__yeongheoSfxTracker
    if (voice.parts <= 0) {
      this._releaseVoice(voice)
      return false
    }
    return true
  }

  // ---- music ---------------------------------------------------------------

  startMusic(stageId = 'jade') {
    this._stageId = stageId
    if (!this.ok) return
    this._musicOn = true
    // Where the sequencer has scheduled up to, on the audio clock. See _sequence.
    this._nextNoteTime = this.ctx.currentTime + 0.12
    this._beat = 0          // beats elapsed since the music started
    this._noteAt = 0        // index into the current phrase
    this._phraseIndex = 0
  }

  stopMusic() {
    this._musicOn = false
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

      // Bar boundary: lay in the drums for the bar ahead. Do not start or glide
      // a free-running bass oscillator: that layer was the repetitive low
      // "hum" heard throughout every run.
      if (this._beat % BEATS_PER_BAR === 0) {
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
        // by construction: the Karplus-Strong pluck is a lowpassed feedback
        // loop. Measured, the bed carried 1-4%
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

    // The free-running low pulse that used to live here is gone. It existed
    // because there was no beat and danger had to be signalled somehow; now the
    // 장구 carries it, on the grid, and two unsynchronised pulses in the bottom
    // octave fight each other. `drumsForBar` escalates the kit with intensity,
    // which is the same idea done in time.

    this._sequence()
  }

  dispose() {
    this.stopMusic()
    this.stopAllSfx()
    try {
      this.ctx?.close?.()
    } catch {
      // Nothing to do if it is already closed.
    }
    this.ctx = null
    this.ok = false
  }
}
