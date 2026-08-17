import { iconFor } from './icons.js'
import { getWeapon } from '../data/weapons.js'
import { getPassive } from '../data/passives.js'
import { realmFor } from '../data/realms.js'

/**
 * 조식 — the pause screen.
 *
 * Pause used to be the word 일시정지 rendered in the middle of the screen, and
 * nothing else. Volume lived on the M key and quality on F4, which is to say
 * they lived nowhere a player would ever find them, and there was no way out of
 * a run except dying in it.
 *
 * Two things belong here: a way to leave and a look at the build assembled. In a
 * genre where the whole pleasure is watching a loadout come together, being
 * unable to read your own 법보 without squinting at the HUD during a fight is a
 * real omission.
 */
export class PauseScreen {
  constructor(root, { audio, quality, onResume, onQuit }) {
    this.audio = audio
    this.quality = quality
    this.onResume = onResume
    this.onQuit = onQuit

    this.node = document.createElement('div')
    this.node.className = 'screen pause-screen'
    this.node.setAttribute('role', 'dialog')
    this.node.setAttribute('aria-modal', 'true')
    this.node.setAttribute('aria-labelledby', 'pause-screen-title')
    this.node.setAttribute('aria-hidden', 'true')
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="screen-inner pause-inner">
        <div class="pause-title" id="pause-screen-title">잠시 멈춤</div>
        <div class="pause-sub">숨을 고르고 현재 수련을 확인합니다.</div>

        <div class="pause-stats"></div>

        <div class="pause-build">
          <div class="pause-heading">법보</div>
          <div class="pause-row pause-weapons"></div>
          <div class="pause-heading">공법</div>
          <div class="pause-row pause-passives"></div>
        </div>

        <div class="pause-settings pause-settings-silent">
          <p class="pause-silent-note">이번 여정은 무음으로 진행됩니다.</p>
          <div class="pause-toggles">
            <button class="btn btn-alt clickable" data-act="quality">화질 자동</button>
          </div>
        </div>

        <div class="pause-buttons">
          <button class="btn clickable" data-act="resume">계속한다 <span class="key">P</span></button>
          <button class="btn btn-alt clickable" data-act="quit">검가로 돌아간다</button>
        </div>
      </div>`
    root.appendChild(this.node)
    this.resumeButton = this.node.querySelector('[data-act="resume"]')
    this.qualityButton = this.node.querySelector('[data-act="quality"]')
    this.quitButton = this.node.querySelector('[data-act="quit"]')
    this.buttons = [this.resumeButton, this.qualityButton, this.quitButton]
    this._uiFocusTarget = null
    this._focusTarget = null
    this._quitArmed = false
    for (const button of this.buttons) button.tabIndex = -1

    // Pause has no synthetic menu loop of its own, so keep pointer and native
    // keyboard focus on the same small cue path. The target guard prevents the
    // browser's mouseenter -> focus pair from speaking twice.
    for (const button of this.buttons) {
      const cueFocus = () => {
        if (this._uiFocusTarget === button) return
        this._uiFocusTarget = button
        this._setFocus(button, false)
        this._uiCue('focus')
      }
      button.addEventListener('mouseenter', cueFocus)
      button.addEventListener('focus', cueFocus)
    }

    this.resumeButton.addEventListener('click', () => this._activate(this.resumeButton))
    this.qualityButton.addEventListener('click', () => this._activate(this.qualityButton))
    this.quitButton.addEventListener('click', () => this._activate(this.quitButton))
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  _uiCue(kind = 'confirm') {
    this.audio?.playUiCue?.(kind)
  }

  /** @param snapshot The same shape `Game._hudState()` builds. */
  show(snapshot, loadout) {
    this.node.style.display = ''
    this.node.setAttribute('aria-hidden', 'false')
    this._uiFocusTarget = null
    this._resetQuit()
    this.qualityButton.textContent = `화질 ${this.quality.mode ?? '자동'}`
    this._renderStats(snapshot)
    this._renderBuild(loadout)
    this._setFocus(this.resumeButton, false)
  }

  hide() {
    const active = this._ownedFocus()
    if (active) active.blur?.()
    this._focusTarget = null
    this.node.style.display = 'none'
    this.node.setAttribute('aria-hidden', 'true')
  }

  _ownedFocus() {
    const active = globalThis.document?.activeElement
    return active && this.node.contains(active) ? active : this._focusTarget
  }

  _setFocus(button, cue = true) {
    if (!button) return
    const changed = this._focusTarget !== button
    if (button !== this.quitButton) this._resetQuit()
    for (const candidate of this.buttons) {
      candidate.classList.toggle('focused', candidate === button)
      candidate.tabIndex = candidate === button ? 0 : -1
    }
    this._uiFocusTarget = button
    this._focusTarget = button
    button.focus?.({ preventScroll: true })
    if (cue && changed) this._uiCue('focus')
  }

  _resetQuit() {
    this._quitArmed = false
    if (this.quitButton) {
      this.quitButton.dataset.armed = '0'
      this.quitButton.textContent = '검가로 돌아간다'
    }
  }

  _activate(button) {
    if (!button || !this.isOpen) return
    this._setFocus(button, false)
    if (button === this.resumeButton) {
      this._uiCue('confirm')
      this.onResume?.()
      return
    }
    if (button === this.qualityButton) {
      button.textContent = `화질 ${this.quality.cycle()}`
      this._uiCue('confirm')
      return
    }
    if (button !== this.quitButton) return
    if (!this._quitArmed) {
      this._quitArmed = true
      button.dataset.armed = '1'
      button.textContent = '정말 검가로 돌아가는가?'
      this._uiCue('focus')
      return
    }
    this._uiCue('confirm')
    this.onQuit?.()
  }

  handleKey(confirm, dir = 0, vertical = 0) {
    if (!this.isOpen) return
    const step = vertical || dir
    const active = this._ownedFocus() ?? this.resumeButton
    const index = this.buttons.indexOf(active)
    if (step) {
      const next = Math.max(0, Math.min(this.buttons.length - 1, (index < 0 ? 0 : index) + step))
      this._setFocus(this.buttons[next])
      return
    }
    if (confirm) this._activate(active)
  }

  _renderStats(s = {}) {
    const mm = Math.floor((s.runTime ?? 0) / 60)
    const ss = String(Math.floor((s.runTime ?? 0) % 60)).padStart(2, '0')
    const realm = s.realm ?? realmFor(s.level ?? 1)
    const timeLabel = s.mode === 'expedition' ? '탐사 경과' : '시련 경과'
    const rows = [
      [timeLabel, `${mm}:${ss}`],
      ['경지', `${realm?.name ?? ''} ${s.level ?? 1}층`],
      ['처치', `${s.kills ?? 0}`],
      ['영석', `${s.stones ?? 0}`],
    ]
    this.node.querySelector('.pause-stats').innerHTML = rows
      .map(([k, v]) => `<div class="pause-stat"><span>${k}</span><b>${v}</b></div>`)
      .join('')
  }

  _renderBuild(loadout) {
    const chip = (id, level, name) => `
      <div class="pause-chip" title="${name}">
        <img alt="" src="${iconFor(id)}" />
        <span class="pause-chip-name">${name}</span>
        <span class="pause-chip-level">${level}</span>
      </div>`

    const weapons = Object.entries(loadout?.weapons ?? {})
      .map(([id, level]) => chip(id, level, getWeapon(id)?.name ?? id))
      .join('')
    const passives = Object.entries(loadout?.passives ?? {})
      .map(([id, level]) => chip(id, level, getPassive(id)?.name ?? id))
      .join('')

    this.node.querySelector('.pause-weapons').innerHTML = weapons || '<div class="pause-empty">아직 없다</div>'
    this.node.querySelector('.pause-passives').innerHTML = passives || '<div class="pause-empty">아직 없다</div>'
  }
}
