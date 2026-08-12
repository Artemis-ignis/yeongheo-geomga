import { describe, it, expect } from 'vitest'
import {
  PENTATONIC, MODES, intensityOf, isAnswerNote, nextDegree, noteFreq, noteInterval,
  scaleFor, tonicFor, BEATS_PER_BAR, tempoFor, phraseAt, drumsForBar,
} from '../src/audio/theory.js'
import {
  AudioEngine,
  BOSS_DEATH_VICTORY_GAP,
  MAX_ACTIVE_SFX_VOICES,
  WEAPON_AUDIO_CUE_TABLE,
  resolveWeaponAudioCue,
} from '../src/audio/Audio.js'

describe('scale', () => {
  it('has no semitone steps, so overlapping generated notes do not clash', () => {
    for (let i = 1; i < PENTATONIC.length; i++) {
      expect(PENTATONIC[i] - PENTATONIC[i - 1]).toBeGreaterThan(1)
    }
  })

  it('gives each 비경 its own tonic and falls back for an unknown one', () => {
    const tonics = ['jade', 'ember', 'frost'].map(tonicFor)
    expect(new Set(tonics).size).toBe(3)
    expect(tonicFor('nonsense')).toBe(tonicFor('jade'))
  })

  it('rises by an octave every five degrees', () => {
    const t = tonicFor('jade')
    expect(noteFreq(t, 5) / noteFreq(t, 0)).toBeCloseTo(2, 5)
    expect(noteFreq(t, 10) / noteFreq(t, 0)).toBeCloseTo(4, 5)
  })

  it('handles negative degrees without falling off the scale', () => {
    const t = tonicFor('jade')
    for (let d = -12; d <= 12; d++) expect(noteFreq(t, d)).toBeGreaterThan(0)
    expect(noteFreq(t, -5) / noteFreq(t, 0)).toBeCloseTo(0.5, 5)
  })
})

describe('조 — the mode each 비경 is in', () => {
  /**
   * Each arena used to differ only by tonic: A3, G3, B3. A whole tone apart,
   * with the same five intervals, the same drone and the same instruments —
   * which is not three soundtracks, it is one piece played slightly higher.
   * Three 비경 that look nothing alike sounded identical.
   */
  it('gives every 비경 a different set of intervals, not just a different pitch', () => {
    const scales = ['jade', 'ember', 'frost'].map((id) => scaleFor(id).join(','))
    expect(new Set(scales).size, 'two 비경 share a mode').toBe(3)
  })

  it('keeps every mode free of semitone steps', () => {
    // A mode that lost this would produce dissonance nothing in the engine
    // checks for when generated notes overlap.
    for (const [name, scale] of Object.entries(MODES)) {
      for (let i = 1; i < scale.length; i++) {
        expect(scale[i] - scale[i - 1], `${name} has a semitone step`).toBeGreaterThan(1)
      }
      // And across the octave wrap.
      expect(12 - scale[scale.length - 1] + scale[0], `${name} wraps onto a semitone`).toBeGreaterThan(1)
    }
  })

  it('starts every mode on its tonic and stays inside the octave', () => {
    for (const [name, scale] of Object.entries(MODES)) {
      expect(scale[0], `${name} does not start on the tonic`).toBe(0)
      expect(scale.length, `${name} is not pentatonic`).toBe(5)
      expect(Math.max(...scale), `${name} leaves the octave`).toBeLessThan(12)
    }
  })

  it('still rises an octave every five degrees in every mode', () => {
    for (const id of ['jade', 'ember', 'frost']) {
      const t = tonicFor(id)
      const s = scaleFor(id)
      expect(noteFreq(t, 5, 0, s) / noteFreq(t, 0, 0, s)).toBeCloseTo(2, 5)
      expect(noteFreq(t, -5, 0, s) / noteFreq(t, 0, 0, s)).toBeCloseTo(0.5, 5)
    }
  })

  it('sounds darker where the 비경 is darker', () => {
    /**
     * The third is where a mode's character lives. 평조 has the major third at
     * 4 semitones, which is what makes 청람비경 read as daylight on grass.
     * 계면조 flattens it to 3 for the burnt ground, and 황종조 omits a third
     * entirely — the note between 2 and 7 is a fourth — which is why 한천비경
     * sounds hollow rather than merely sad.
     *
     * My first version of this asserted the *top* degree fell, and it does the
     * opposite: both dark modes raise it to a minor seventh. Nothing about the
     * modes was wrong; the assertion was.
     */
    expect(scaleFor('jade')).toContain(4)
    expect(scaleFor('ember'), '적염 lost its minor third').toContain(3)
    expect(scaleFor('ember'), '적염 kept a major third').not.toContain(4)
    expect(scaleFor('frost'), '한천 gained a third').not.toContain(3)
    expect(scaleFor('frost'), '한천 gained a third').not.toContain(4)
  })

  it('falls back to 평조 for an unknown 비경', () => {
    expect(scaleFor('nonsense')).toEqual(MODES['평조'])
  })
})

describe('intensity', () => {
  it('is low at the start of a healthy run and high at the end of a desperate one', () => {
    expect(intensityOf({ runTime: 0, hpFraction: 1 })).toBeLessThan(0.1)
    expect(intensityOf({ runTime: 900, hpFraction: 0.05 })).toBeGreaterThan(0.9)
  })

  it('answers to danger, not only to the clock', () => {
    const early = intensityOf({ runTime: 30, hpFraction: 0.12 })
    const lateAndSafe = intensityOf({ runTime: 700, hpFraction: 1 })
    expect(early).toBeGreaterThan(lateAndSafe)
  })

  it('never leaves 0..1, whatever it is handed', () => {
    const cases = [
      {}, { runTime: 99999, hpFraction: -3, bossAlive: true }, { hpFraction: 12 },
    ]
    for (const c of cases) {
      const v = intensityOf(c)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('plays faster as it rises, and never becomes a machine gun', () => {
    expect(noteInterval(1)).toBeLessThan(noteInterval(0))
    expect(noteInterval(1)).toBeGreaterThan(0.25)
    expect(noteInterval(5)).toBe(noteInterval(1))
  })
})

describe('melody', () => {
  it('steps more often than it leaps', () => {
    let steps = 0
    let leaps = 0
    let d = 0
    for (let i = 0; i < 400; i++) {
      const roll = (i * 0.0257) % 1
      const next = nextDegree(d, roll)
      if (Math.abs(next - d) > 1) leaps++
      else steps++
      d = next
    }
    expect(steps).toBeGreaterThan(leaps * 3)
  })

  it('stays inside the instrument however long it wanders', () => {
    let d = 0
    let seed = 7
    for (let i = 0; i < 5000; i++) {
      seed = (seed * 48271) % 2147483647
      d = nextDegree(d, seed / 2147483647)
      expect(d).toBeGreaterThanOrEqual(-8)
      expect(d).toBeLessThanOrEqual(12)
    }
  })

  it('drops to the low answering phrase on a regular cadence', () => {
    const hits = []
    for (let i = 0; i < 24; i++) if (isAnswerNote(i)) hits.push(i)
    expect(hits).toEqual([0, 8, 16])
  })
})

/** A storage stand-in, since the suite runs without a DOM. */
function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  }
}

describe('engine without an AudioContext', () => {
  it('stays silent and answers every call rather than throwing', () => {
    const a = new AudioEngine({ contextFactory: () => null, storage: memoryStorage() })
    expect(a.unlock()).toBe(false)
    expect(a.ok).toBe(false)
    expect(() => {
      a.play('hit')
      a.play('nonsense-sound')
      a.startMusic('jade')
      a.update(0.016, { runTime: 10 })
      a.stopMusic()
      a.dispose()
    }).not.toThrow()
  })

  it('survives a context constructor that throws', () => {
    const a = new AudioEngine({
      contextFactory: () => { throw new Error('blocked') },
      storage: memoryStorage(),
    })
    expect(() => a.unlock()).not.toThrow()
    expect(a.ok).toBe(false)
  })
})

describe('audio settings', () => {
  it('clamps volumes into range', () => {
    const a = new AudioEngine({ contextFactory: () => null, storage: memoryStorage() })
    a.setVolumes({ master: 5, music: -2, sfx: 0.4 })
    expect(a.masterVolume).toBe(1)
    expect(a.musicVolume).toBe(0)
    expect(a.sfxVolume).toBe(0.4)
  })

  it('round-trips through storage', () => {
    const store = memoryStorage()
    const a = new AudioEngine({ contextFactory: () => null, storage: store })
    a.setVolumes({ master: 0.3, music: 0.2 })
    a.setMuted(true)

    const b = new AudioEngine({ contextFactory: () => null, storage: store })
    expect(b.masterVolume).toBeCloseTo(0.3)
    expect(b.musicVolume).toBeCloseTo(0.2)
    expect(b.muted).toBe(true)
    expect(b.toggleMute()).toBe(false)
  })

  it('ignores a corrupt settings blob instead of failing to boot', () => {
    const store = memoryStorage({ 'yeongheo.audio': '{not json' })
    const a = new AudioEngine({ contextFactory: () => null, storage: store })
    expect(a.muted).toBe(false)
    expect(a.masterVolume).toBeGreaterThan(0)
  })

  it('starts fresh players with sound enabled', () => {
    const a = new AudioEngine({ contextFactory: () => null, storage: memoryStorage() })
    expect(a.muted).toBe(false)
  })

  it('ignores a legacy unversioned mute value', () => {
    const store = memoryStorage({
      'yeongheo.audio': JSON.stringify({ muted: true, master: 0.75 }),
    })
    const a = new AudioEngine({ contextFactory: () => null, storage: store })
    expect(a.muted).toBe(false)
  })
})

describe('metre, motif and harmony', () => {
  it('keeps the tempo walkable at every intensity', () => {
    for (const i of [0, 0.25, 0.5, 0.75, 1]) {
      const bpm = tempoFor(i)
      expect(bpm).toBeGreaterThanOrEqual(76)
      expect(bpm).toBeLessThanOrEqual(106)
    }
    expect(tempoFor(1)).toBeGreaterThan(tempoFor(0))
  })

  it('every phrase fills whole bars', () => {
    // A phrase whose beats do not sum to a multiple of the bar walks the melody
    // off the drums a little further every repeat.
    for (let i = 0; i < 4; i++) {
      const beats = phraseAt(i).reduce((n, [, b]) => n + b, 0)
      expect(beats % BEATS_PER_BAR).toBe(0)
    }
  })

  it('is A A B A — the tune repeats before it is answered', () => {
    expect(phraseAt(0)).toBe(phraseAt(1))
    expect(phraseAt(0)).toBe(phraseAt(3))
    expect(phraseAt(2)).not.toBe(phraseAt(0))
    expect(phraseAt(4)).toBe(phraseAt(0))
  })

  it('resolves each phrase onto the tonic', () => {
    for (let i = 0; i < 4; i++) {
      const sung = phraseAt(i).filter(([d]) => d !== null)
      expect(sung[sung.length - 1][0]).toBe(0)
    }
  })

  it('brings the kit in only as the run turns', () => {
    expect(drumsForBar(0.1, 0)).toHaveLength(0)
    const early = drumsForBar(0.4, 0).length
    const mid = drumsForBar(0.6, 0).length
    const late = drumsForBar(0.9, 0).length
    expect(early).toBeGreaterThan(0)
    expect(mid).toBeGreaterThan(early)
    expect(late).toBeGreaterThan(mid)
  })

  it('never places a drum hit outside its own bar', () => {
    for (const i of [0.4, 0.6, 0.9]) {
      for (const [beat] of drumsForBar(i, 0)) {
        expect(beat).toBeGreaterThanOrEqual(0)
        expect(beat).toBeLessThan(BEATS_PER_BAR)
      }
    }
  })

  it('only ever names a drum voice the engine can play', () => {
    for (const i of [0.4, 0.6, 0.9]) {
      for (const [, voice] of drumsForBar(i, 0)) {
        expect(['deep', 'tap']).toContain(voice)
      }
    }
  })
})

class FakeParam {
  constructor(value = 0) { this.value = value }
  setValueAtTime(value) { this.value = value }
  exponentialRampToValueAtTime(value) { this.value = value }
  cancelScheduledValues() {}
  setTargetAtTime(value) { this.value = value }
}

class FakeNode {
  constructor() {
    this.connections = []
    this.disconnectCount = 0
    this.listeners = new Map()
    this.onended = null
  }

  connect(node) { this.connections.push(node); return node }

  disconnect() { this.disconnectCount++ }

  addEventListener(type, callback, options = {}) {
    const list = this.listeners.get(type) ?? []
    list.push({ callback, once: Boolean(options.once) })
    this.listeners.set(type, list)
  }

  emitEnded() {
    const list = this.listeners.get('ended') ?? []
    for (const item of [...list]) {
      item.callback()
      if (item.once) {
        const current = this.listeners.get('ended') ?? []
        this.listeners.set('ended', current.filter((entry) => entry !== item))
      }
    }
    this.onended?.()
  }

  start(...args) { this.startTime = args[0] }

  stop(...args) { this.stopTime = args[0] }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0
    this.sampleRate = 8000
    this.state = 'running'
    this.destination = new FakeNode()
    this.sources = []
    this.gains = []
  }

  createDynamicsCompressor() {
    const node = new FakeNode()
    node.threshold = new FakeParam()
    node.knee = new FakeParam()
    node.ratio = new FakeParam()
    node.attack = new FakeParam()
    node.release = new FakeParam()
    return node
  }

  createGain() {
    const node = new FakeNode()
    node.gain = new FakeParam()
    this.gains.push(node)
    return node
  }

  createWaveShaper() {
    const node = new FakeNode()
    node.curve = null
    node.oversample = 'none'
    return node
  }

  createBiquadFilter() {
    const node = new FakeNode()
    node.frequency = new FakeParam()
    node.type = 'lowpass'
    return node
  }

  createStereoPanner() {
    const node = new FakeNode()
    node.pan = new FakeParam()
    return node
  }

  createBufferSource() {
    const node = new FakeNode()
    node.buffer = null
    node.playbackRate = new FakeParam(1)
    this.sources.push(node)
    return node
  }

  createOscillator() {
    const node = new FakeNode()
    node.frequency = new FakeParam()
    node.detune = new FakeParam()
    node.type = 'sine'
    this.sources.push(node)
    return node
  }

  createBuffer(channels, length, rate) {
    return {
      channels,
      length,
      sampleRate: rate,
      getChannelData: () => new Float32Array(length),
    }
  }

  suspend() { this.state = 'suspended'; return Promise.resolve() }
  resume() { this.state = 'running'; return Promise.resolve() }
  close() { this.state = 'closed'; return Promise.resolve() }
}

function makeLiveAudio() {
  const context = new FakeAudioContext()
  const audio = new AudioEngine({ contextFactory: () => context, storage: memoryStorage() })
  audio.setMuted(false)
  expect(audio.unlock()).toBe(true)
  return { audio, context }
}

describe('live SFX routing and voice lifecycle', () => {
  it('starts music without any free-running bass oscillator', () => {
    const { audio, context } = makeLiveAudio()
    expect(context.sources).toHaveLength(0)
    audio.startMusic('jade')
    expect(context.sources).toHaveLength(0)
    expect('_drone' in audio).toBe(false)
    audio.stopMusic()
    audio.dispose()
  })

  it('exposes fixed launch, impact, field, and status cues for every descriptor kind', () => {
    for (const [kind, row] of Object.entries(WEAPON_AUDIO_CUE_TABLE)) {
      for (const phase of ['launch', 'impact', 'field', 'status']) {
        expect(row[phase], `${kind}.${phase}`).toMatch(/^weapon(?:Launch|Impact|Field|Status)$/)
        expect(resolveWeaponAudioCue(kind, phase), `${kind}.${phase} resolver`).toBe(row[phase])
      }
    }
    expect(resolveWeaponAudioCue('unknown-kind', 'status')).toBe('weaponStatus')
    expect(resolveWeaponAudioCue('weapon.blade.impact', 'impact')).toBe('weaponImpact')
  })

  it('recognises weapon phases and boss/content stingers through the live context', () => {
    const { audio, context } = makeLiveAudio()
    for (const [index, phase] of ['launch', 'impact', 'field', 'status'].entries()) {
      context.currentTime = index * 0.2
      expect(audio.playWeaponCue('blade', phase), phase).toBe(true)
    }
    for (const [index, name] of [
      'bossTelegraph', 'bossImpact', 'bossHit', 'bossDeath',
      'evolution', 'daoSelect', 'formation', 'timeout',
      'dash', 'heal', 'finalBoss',
    ].entries()) {
      context.currentTime = 1 + index * 0.5
      expect(audio.play(name), name).toBe(true)
    }
    expect(context.sources.length).toBeGreaterThan(0)
    audio.dispose()
  })

  it('keeps active SFX at 32, preempts low priority voices, and diagnoses drops', () => {
    const { audio, context } = makeLiveAudio()
    for (let i = 0; i < MAX_ACTIVE_SFX_VOICES; i++) expect(audio.play('uiMove')).toBe(true)
    expect(audio.play('uiMove')).toBe(false)
    expect(audio.getVoiceDiagnostics()).toMatchObject({
      activeSfxVoices: MAX_ACTIVE_SFX_VOICES,
      maxActiveSfxVoices: MAX_ACTIVE_SFX_VOICES,
      droppedSfxVoices: 1,
    })

    context.currentTime = 1
    expect(audio.play('bossImpact')).toBe(true)
    expect(audio.getVoiceDiagnostics()).toMatchObject({
      activeSfxVoices: MAX_ACTIVE_SFX_VOICES,
      preemptedSfxVoices: 1,
    })
    audio.stopAllSfx()
    expect(audio.getVoiceDiagnostics().activeSfxVoices).toBe(0)
    audio.dispose()
  })

  it('rate-limits only the shared UI cue helper, not raw low-level UI voices', () => {
    const { audio, context } = makeLiveAudio()
    expect(audio.playUiCue('focus')).toBe(true)
    expect(audio.playUiCue('focus')).toBe(false)
    expect(audio.play('uiMove')).toBe(true)
    context.currentTime = 0.061
    expect(audio.playUiCue('focus')).toBe(true)
    audio.dispose()
  })

  it('unlocks and resumes a previously muted context from the same gesture path', () => {
    const context = new FakeAudioContext()
    let resumes = 0
    context.state = 'suspended'
    context.resume = () => {
      resumes++
      context.state = 'running'
      return Promise.resolve()
    }
    const audio = new AudioEngine({ contextFactory: () => context, storage: memoryStorage() })
    audio.setMuted(true)
    expect(audio.ensureUnlocked()).toBe(true)
    expect(audio.muted).toBe(true)
    expect(resumes).toBe(1)
    audio.dispose()
  })

  it('delays the victory stinger until the boss death tail has resolved', () => {
    const { audio, context } = makeLiveAudio()
    expect(audio.play('bossDeath')).toBe(true)
    expect(audio.play('victory')).toBe(true)
    const victoryStarts = context.sources.slice(-5).map((source) => source.startTime)
    expect(Math.min(...victoryStarts)).toBeGreaterThanOrEqual(BOSS_DEATH_VICTORY_GAP)
    audio.dispose()
  })

  it('disconnects a completed voice and decrements the active count', () => {
    const { audio, context } = makeLiveAudio()
    expect(audio.play('uiMove')).toBe(true)
    expect(audio.getVoiceDiagnostics().activeSfxVoices).toBe(1)
    context.sources.at(-1).emitEnded()
    expect(audio.getVoiceDiagnostics()).toMatchObject({
      activeSfxVoices: 0,
      endedSfxVoices: 1,
    })
    expect(context.sources.at(-1).disconnectCount).toBeGreaterThan(0)
    audio.dispose()
  })

  it('ducks and suspends/resumes the context without losing the mix setting', () => {
    const { audio, context } = makeLiveAudio()
    audio.setDucked(true, 0.25)
    expect(audio.master.gain.value).toBeCloseTo(0.75 * 0.25)
    expect(audio.suspend()).toBe(true)
    expect(context.state).toBe('suspended')
    expect(audio.master.gain.value).toBe(0)
    expect(audio.play('uiMove')).toBe(false)
    expect(audio.resume()).toBe(false)
    expect(context.state).toBe('running')
    expect(audio.master.gain.value).toBeCloseTo(0.75 * 0.25)
    audio.setDucked(false)
    expect(audio.master.gain.value).toBeCloseTo(0.75)
    audio.dispose()
  })

  it('settles browser-policy resume and suspend rejections', async () => {
    const context = new FakeAudioContext()
    context.state = 'suspended'
    context.resume = () => Promise.reject(new Error('gesture required'))
    context.suspend = () => Promise.reject(new Error('context closing'))
    const audio = new AudioEngine({ contextFactory: () => context, storage: memoryStorage() })
    audio.setMuted(false)

    expect(audio.unlock()).toBe(true)
    await Promise.resolve()
    expect(audio.setSuspended(true)).toBe(true)
    await Promise.resolve()
    expect(audio.setSuspended(false)).toBe(false)
    await Promise.resolve()

    audio.dispose()
  })
})
