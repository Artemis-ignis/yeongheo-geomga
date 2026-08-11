const MODES = [
  { name: '자동', resolution: 1, effects: 1 },
  { name: '선명', resolution: 1, effects: 1 },
  { name: '저사양', resolution: 0.85, effects: 0.55 },
]

export class Quality2D {
  constructor(onChange = null) {
    this.index = 0
    this.mode = MODES[0].name
    this.scale = 1
    this.effectsDensity = 1
    this.onChange = onChange
    this.slowFrames = 0
    this.fastFrames = 0
  }

  cycle() {
    this.index = (this.index + 1) % MODES.length
    this._apply(MODES[this.index])
    return this.mode
  }

  sample(ms) {
    if (this.index !== 0) return
    if (ms > 24) {
      this.slowFrames++
      this.fastFrames = 0
      if (this.slowFrames >= 45 && this.effectsDensity !== 0.55) {
        this._apply({ name: '자동', resolution: 0.85, effects: 0.55 })
      }
    } else if (ms < 14) {
      this.fastFrames++
      this.slowFrames = 0
      if (this.fastFrames >= 240 && this.scale !== 1) {
        this._apply(MODES[0])
      }
    }
  }

  _apply(mode) {
    this.mode = mode.name
    this.scale = Math.max(0.85, mode.resolution)
    this.effectsDensity = mode.effects
    this.slowFrames = 0
    this.fastFrames = 0
    this.onChange?.(this.scale, this.effectsDensity)
  }
}
