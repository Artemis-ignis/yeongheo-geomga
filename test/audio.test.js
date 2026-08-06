import { describe, it, expect } from 'vitest'
import {
  PENTATONIC, MODES, intensityOf, isAnswerNote, nextDegree, noteFreq, noteInterval,
  scaleFor, tonicFor, BEATS_PER_BAR, tempoFor, phraseAt, chordRootAt, drumsForBar,
} from '../src/audio/theory.js'
import { AudioEngine } from '../src/audio/Audio.js'

describe('scale', () => {
  it('has no semitone steps, so nothing generated against the drone can clash', () => {
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
    // The whole reason live generation against a drone cannot clash. A mode that
    // lost this would produce dissonance nothing in the engine checks for.
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
    expect(a.muted).toBe(true)
    expect(a.masterVolume).toBeGreaterThan(0)
  })

  it('does not restore the old unmuted default after the silent-start upgrade', () => {
    const store = memoryStorage({
      'yeongheo.audio': JSON.stringify({ muted: false, master: 0.75 }),
    })
    const a = new AudioEngine({ contextFactory: () => null, storage: store })
    expect(a.muted).toBe(true)
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

  it('moves the bass and comes home', () => {
    expect(chordRootAt(0)).toBe(0)
    expect(chordRootAt(3)).toBe(0)
    const roots = [0, 1, 2, 3].map(chordRootAt)
    expect(new Set(roots).size).toBeGreaterThan(1)
    // Wraps rather than running off the end, including backwards.
    expect(chordRootAt(4)).toBe(chordRootAt(0))
    expect(chordRootAt(-1)).toBe(chordRootAt(3))
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
