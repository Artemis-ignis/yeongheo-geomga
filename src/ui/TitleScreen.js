import { iconFor } from './icons.js'
import { getWeapon } from '../data/weapons.js'
import { unlockCost } from '../data/unlocks.js'
import { STAGES } from '../data/stages.js'
import { TRIALS, getTrial } from '../data/trials.js'
import { portraitFor } from '../art/portrait.js'

/**
 * Title, main menu, and character select.
 *
 * Two views share one backdrop: the menu (시작 / 단전 / 도감) and the character
 * roster. Locked cultivators are shown greyed with their 영석 price rather than
 * hidden, so the player can see what there is to work toward.
 */
export class TitleScreen {
  /** @param renderer Borrowed to bake the character portraits; optional. */
  constructor(root, characters, progress, renderer = null) {
    this.root = root
    this.characters = characters
    this.progress = progress
    this.renderer = renderer
    this.focus = 0
    this.view = 'menu'
    this.handlers = {}
    this._bakedPortraitIds = new Set()

    this.node = document.createElement('div')
    this.node.className = 'screen'
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="screen-inner">
        <div class="title-mark">영허검가</div>
        <div class="title-tag">— 마기가 삼킨 비경에서, 검을 든 소녀들의 이야기 —</div>

        <div class="title-menu">
          <button class="btn clickable" data-act="start">비경 진입</button>
          <button class="btn btn-alt clickable" data-act="shop">단전</button>
          <button class="btn btn-alt clickable" data-act="codex">도감</button>
        </div>
        <div class="title-stones"></div>

        <div class="stage-select" style="display:none">
          <div class="select-heading">비경을 고르시오</div>
          <div class="stage-cards"></div>
          <div class="trial-row">
            <div class="trial-heading">시련</div>
            <div class="trial-pips"></div>
            <div class="trial-desc"></div>
          </div>
          <button class="btn btn-alt btn-back clickable" data-act="stageBack">← 돌아가기</button>
        </div>

        <div class="char-select" style="display:none">
          <div class="select-heading">수사를 고르시오</div>
          <div class="char-cards"></div>
          <button class="btn btn-alt btn-back clickable" data-act="back">← 돌아가기</button>
        </div>

        <div class="controls-legend">
          WASD·방향키 이동 &nbsp;·&nbsp; Space 축지법 &nbsp;·&nbsp; 마우스 휠 화면 확대·축소 &nbsp;·&nbsp; P 일시정지 &nbsp;·&nbsp; 공격은 자동
        </div>
      </div>`
    root.appendChild(this.node)

    this.menu = this.node.querySelector('.title-menu')
    this.stonesLabel = this.node.querySelector('.title-stones')
    this.selectView = this.node.querySelector('.char-select')

    this.stageView = this.node.querySelector('.stage-select')
    this.node.querySelector('[data-act="start"]').addEventListener('click', () => this._showStages())
    this.node.querySelector('[data-act="shop"]').addEventListener('click', () => this.handlers.onShop?.())
    this.node.querySelector('[data-act="codex"]').addEventListener('click', () => this.handlers.onCodex?.())
    this.node.querySelector('[data-act="back"]').addEventListener('click', () => this._showStages())
    this.node.querySelector('[data-act="stageBack"]').addEventListener('click', () => this._showMenu())

    const stageHost = this.node.querySelector('.stage-cards')
    this.stageCards = STAGES.map((s, i) => {
      const card = document.createElement('button')
      card.className = 'char-card stage-card clickable'
      card.innerHTML = `
        <div class="char-lock"></div>
        <div class="stage-swatch"></div>
        <div class="char-name">${s.name}</div>
        <div class="char-traits">${s.desc}</div>`
      const swatch = card.querySelector('.stage-swatch')
      const hex = (n) => `#${n.toString(16).padStart(6, '0')}`
      swatch.style.background =
        `linear-gradient(160deg, ${hex(s.palette.skyMid)}, ${hex(s.palette.grassTip)} 55%, ${hex(s.palette.ground)})`
      card.addEventListener('click', () => this.pickStage(i))
      card.addEventListener('mouseenter', () => this.setStageFocus(i))
      stageHost.appendChild(card)
      return { card, lock: card.querySelector('.char-lock'), id: s.id }
    })

    // 시련 sits with the 비경 because both are choices about the run rather than
    // about the cultivator. Locked tiers stay visible with the time that opens
    // them: a ladder you cannot see is a ladder nobody climbs.
    const pipHost = this.node.querySelector('.trial-pips')
    this.trialDesc = this.node.querySelector('.trial-desc')
    this.trialPips = TRIALS.map((t) => {
      const pip = document.createElement('button')
      pip.className = 'trial-pip clickable'
      pip.innerHTML = `<span class="trial-name">${t.name}</span><span class="trial-hanja">${t.hanja}</span>`
      pip.addEventListener('click', () => this.pickTrial(t.id))
      pip.addEventListener('mouseenter', () => this._describeTrial(t.id))
      pipHost.appendChild(pip)
      return { pip, id: t.id }
    })

    const host = this.node.querySelector('.char-cards')
    this.cards = characters.map((c, i) => {
      const card = document.createElement('button')
      card.className = 'char-card clickable'
      const weapon = getWeapon(c.startWeapon)
      card.innerHTML = `
        <div class="char-lock"></div>
        <div class="char-portrait"></div>
        <div class="char-name">${c.name}</div>
        <div class="char-path">${c.path}</div>
        <div class="char-start">
          <img alt="" src="${iconFor(c.startWeapon)}" />
          <span>${weapon ? weapon.name : ''}</span>
        </div>
        <div class="char-traits">${c.traits.map((t) => `· ${t}`).join('<br />')}</div>`
      card.addEventListener('click', () => this.pick(i))
      card.addEventListener('mouseenter', () => this.setFocus(i))
      host.appendChild(card)
      return { card, lock: card.querySelector('.char-lock'), id: c.id, character: c,
        portrait: card.querySelector('.char-portrait') }
    })
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  /** Called with handlers on first entry, and with none when returning from a sub-screen. */
  show(handlers) {
    if (handlers) this.handlers = handlers
    this.node.style.display = ''
    this._showMenu()
  }

  hide() {
    this.node.style.display = 'none'
  }

  _showMenu() {
    this.view = 'menu'
    this.menu.style.display = ''
    this.stonesLabel.style.display = ''
    this.selectView.style.display = 'none'
    this.stageView.style.display = 'none'
    this.stonesLabel.textContent = `보유 영석 ${this.progress.stones}`
  }

  _showStages() {
    this.view = 'stage'
    this.menu.style.display = 'none'
    this.stonesLabel.style.display = ''
    this.selectView.style.display = 'none'
    this.stageView.style.display = ''
    this.stonesLabel.textContent = `보유 영석 ${this.progress.stones}`
    for (const c of this.stageCards) {
      const unlocked = this.progress.isUnlocked('stages', c.id)
      c.card.classList.toggle('locked', !unlocked)
      c.lock.textContent = unlocked ? '' : `🔒 영석 ${unlockCost('stages', c.id) ?? '?'}`
    }
    const first = this.stageCards.findIndex((c) => this.progress.isUnlocked('stages', c.id))
    this.setStageFocus(first === -1 ? 0 : first)
    this._renderTrials()
  }

  _renderTrials() {
    const max = this.progress.maxTrial
    const chosen = this.progress.trial
    for (const p of this.trialPips) {
      p.pip.classList.toggle('locked', p.id > max)
      p.pip.classList.toggle('chosen', p.id === chosen)
    }
    // A row where every tier but one is locked is noise on a first run.
    this.node.querySelector('.trial-row').style.display = max > 0 ? '' : 'none'
    this._describeTrial(chosen)
  }

  _describeTrial(id) {
    const t = getTrial(id)
    if (id > this.progress.maxTrial) {
      const mm = Math.floor(t.unlockSeconds / 60)
      const ss = String(t.unlockSeconds % 60).padStart(2, '0')
      this.trialDesc.textContent = `🔒 ${mm}:${ss} 생존하면 열린다`
      return
    }
    this.trialDesc.textContent = t.id === 0
      ? t.desc
      : `${t.desc} · 영석 ×${t.stones.toFixed(1)}`
  }

  pickTrial(id) {
    if (id > this.progress.maxTrial) return
    this.progress.setTrial(id)
    this.handlers.onUnlock?.()
    this._renderTrials()
  }

  setStageFocus(i) {
    this.stageFocus = Math.max(0, Math.min(this.stageCards.length - 1, i))
    this.stageCards.forEach((c, k) => c.card.classList.toggle('focused', k === this.stageFocus))
  }

  /** Locked stages buy themselves on click, so there is no separate shop trip. */
  pickStage(i) {
    const card = this.stageCards[i]
    if (!card) return
    if (!this.progress.isUnlocked('stages', card.id)) {
      if (!this.progress.unlock('stages', card.id)) return
      this.handlers.onUnlock?.()
      this._showStages()
      return
    }
    this.chosenStage = card.id
    this._showSelect()
  }

  _showSelect() {
    this.view = 'select'
    this.menu.style.display = 'none'
    this.stonesLabel.style.display = 'none'
    this.stageView.style.display = 'none'
    this.selectView.style.display = ''
    this._bakePortraits()
    this._refreshLocks()
    // Land on the first playable cultivator, not a locked one.
    const first = this.cards.findIndex((c) => this.progress.isUnlocked('characters', c.id))
    this.setFocus(first === -1 ? 0 : first)
  }

  /**
   * Bake the six portraits the first time this screen is opened.
   *
   * Not at construction: the renderer is busy drawing the title behind this and
   * six render-target reads in the same frame as boot is a visible hitch on the
   * one screen a player is looking at hardest. Cached inside `portraitFor`, so
   * this is free on every later visit.
   */
  _bakePortraits() {
    if (!this.renderer) return
    for (const c of this.cards) {
      const unlocked = this.progress.isUnlocked('characters', c.id)
      if (!unlocked) {
        c.portrait.classList.add('locked-placeholder')
        continue
      }
      if (this._bakedPortraitIds.has(c.id)) continue
      this._bakedPortraitIds.add(c.id)
      c.portrait.classList.remove('locked-placeholder')
      // The hero card uses the latest ImageGen character reference. The
      // portrait is a real authored asset, so opening the roster does not
      // trigger another render-target bake for the hero.
      if (c.id === 'seolryeong') {
        const base = import.meta.env?.BASE_URL ?? '/'
        const latest = `${base}assets/characters/seolryeong-character-reference-v3.png`
        const legacy = `${base}assets/characters/seolryeong-character-reference-v2.png`
        // Keep the previous approved portrait as a real CSS fallback while the
        // new v3 reference is being fetched on a cold cache.
        c.portrait.style.backgroundImage = `url(${latest}), url(${legacy})`
        c.portrait.classList.add('imagegen-reference')
        continue
      }
      const url = portraitFor(c.character, this.renderer)
      // No portrait is a card without a picture, not a broken image.
      if (url) c.portrait.style.backgroundImage = `url(${url})`
      else c.portrait.classList.add('empty')
    }
  }

  _refreshLocks() {
    for (const c of this.cards) {
      const unlocked = this.progress.isUnlocked('characters', c.id)
      c.card.classList.toggle('locked', !unlocked)
      c.lock.textContent = unlocked ? '' : `🔒 영석 ${unlockCost('characters', c.id) ?? '?'}`
    }
  }

  setFocus(i) {
    this.focus = Math.max(0, Math.min(this.characters.length - 1, i))
    this.cards.forEach((c, k) => c.card.classList.toggle('focused', k === this.focus))
  }

  pick(i) {
    if (!this.isOpen || this.view !== 'select') return
    const c = this.characters[i]
    if (!c || !this.progress.isUnlocked('characters', c.id)) return
    const cb = this.handlers.onStart
    this.hide()
    if (cb) cb(c.id, this.chosenStage ?? 'jade')
  }

  handleKey(slot, confirm, dir) {
    if (!this.isOpen) return
    if (this.view === 'menu') {
      if (slot === 1 || confirm) this._showStages()
      else if (slot === 2) this.handlers.onShop?.()
      else if (slot === 3) this.handlers.onCodex?.()
      return
    }
    if (this.view === 'stage') {
      if (slot > 0) { this.pickStage(slot - 1); return }
      if (dir) { this.setStageFocus(this.stageFocus + dir); return }
      if (confirm) this.pickStage(this.stageFocus)
      return
    }
    if (slot > 0) { this.pick(slot - 1); return }
    if (dir) { this.setFocus(this.focus + dir); return }
    if (confirm) this.pick(this.focus)
  }

  dispose() {
    this.node.remove()
  }
}
