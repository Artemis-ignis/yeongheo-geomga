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
          <button class="btn btn-alt clickable" data-act="quit">물러난다</button>
        </div>
      </div>`
    root.appendChild(this.node)
    this._uiFocusTarget = null

    // Pause has no synthetic menu loop of its own, so keep pointer and native
    // keyboard focus on the same small cue path. The target guard prevents the
    // browser's mouseenter -> focus pair from speaking twice.
    for (const button of this.node.querySelectorAll('button')) {
      const cueFocus = () => {
        if (this._uiFocusTarget === button) return
        this._uiFocusTarget = button
        this._uiCue('focus')
      }
      button.addEventListener('mouseenter', cueFocus)
      button.addEventListener('focus', cueFocus)
    }

    this.node.querySelector('[data-act="resume"]').addEventListener('click', () => {
      this._uiCue('confirm')
      this.onResume?.()
    })
    this.node.querySelector('[data-act="quality"]').addEventListener('click', (e) => {
      e.currentTarget.textContent = `화질 ${this.quality.cycle()}`
      this._uiCue('confirm')
    })
    // Leaving a run throws it away, so it asks once rather than on a mis-click.
    this.node.querySelector('[data-act="quit"]').addEventListener('click', (e) => {
      const btn = e.currentTarget
      if (btn.dataset.armed !== '1') {
        this._uiCue('focus')
        btn.dataset.armed = '1'
        btn.textContent = '정말 물러나는가?'
        return
      }
      this._uiCue('confirm')
      this.onQuit?.()
    })
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
    const quit = this.node.querySelector('[data-act="quit"]')
    quit.dataset.armed = '0'
    quit.textContent = '물러난다'
    this.node.querySelector('[data-act="quality"]').textContent = `화질 ${this.quality.mode ?? '자동'}`
    this._renderStats(snapshot)
    this._renderBuild(loadout)
  }

  hide() {
    this.node.style.display = 'none'
    this.node.setAttribute('aria-hidden', 'true')
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
