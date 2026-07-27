import { iconFor } from './icons.js'
import { getWeapon } from '../data/weapons.js'
import { unlockCost } from '../data/unlocks.js'

/**
 * Title, main menu, and character select.
 *
 * Two views share one backdrop: the menu (시작 / 단전 / 도감) and the character
 * roster. Locked cultivators are shown greyed with their 영석 price rather than
 * hidden, so the player can see what there is to work toward.
 */
export class TitleScreen {
  constructor(root, characters, progress) {
    this.root = root
    this.characters = characters
    this.progress = progress
    this.focus = 0
    this.view = 'menu'
    this.handlers = {}

    this.node = document.createElement('div')
    this.node.className = 'screen'
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="screen-inner">
        <div class="title-mark">靈墟劍歌</div>
        <div class="title-sub">영허검가</div>
        <div class="title-tag">— 마기가 삼킨 비경에서, 검을 든 소녀들의 이야기 —</div>

        <div class="title-menu">
          <button class="btn clickable" data-act="start">비경 진입</button>
          <button class="btn btn-alt clickable" data-act="shop">단전 丹殿</button>
          <button class="btn btn-alt clickable" data-act="codex">도감 圖鑑</button>
        </div>
        <div class="title-stones"></div>

        <div class="char-select" style="display:none">
          <div class="char-cards"></div>
          <button class="btn btn-alt btn-back clickable" data-act="back">← 돌아가기</button>
        </div>

        <div class="controls-legend">
          WASD·방향키 이동 &nbsp;·&nbsp; Space 축지법 &nbsp;·&nbsp; P 일시정지 &nbsp;·&nbsp; 공격은 자동
        </div>
      </div>`
    root.appendChild(this.node)

    this.menu = this.node.querySelector('.title-menu')
    this.stonesLabel = this.node.querySelector('.title-stones')
    this.selectView = this.node.querySelector('.char-select')

    this.node.querySelector('[data-act="start"]').addEventListener('click', () => this._showSelect())
    this.node.querySelector('[data-act="shop"]').addEventListener('click', () => this.handlers.onShop?.())
    this.node.querySelector('[data-act="codex"]').addEventListener('click', () => this.handlers.onCodex?.())
    this.node.querySelector('[data-act="back"]').addEventListener('click', () => this._showMenu())

    const host = this.node.querySelector('.char-cards')
    this.cards = characters.map((c, i) => {
      const card = document.createElement('button')
      card.className = 'char-card clickable'
      const weapon = getWeapon(c.startWeapon)
      card.innerHTML = `
        <div class="char-lock"></div>
        <div class="char-name">${c.name}<span>${c.hanja}</span></div>
        <div class="char-path">${c.path}</div>
        <div class="char-start">
          <img alt="" src="${iconFor(c.startWeapon)}" />
          <span>${weapon ? weapon.name : ''}</span>
        </div>
        <div class="char-traits">${c.traits.map((t) => `· ${t}`).join('<br />')}</div>`
      card.addEventListener('click', () => this.pick(i))
      card.addEventListener('mouseenter', () => this.setFocus(i))
      host.appendChild(card)
      return { card, lock: card.querySelector('.char-lock'), id: c.id }
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
    this.stonesLabel.textContent = `보유 영석 ${this.progress.stones}`
  }

  _showSelect() {
    this.view = 'select'
    this.menu.style.display = 'none'
    this.stonesLabel.style.display = 'none'
    this.selectView.style.display = ''
    this._refreshLocks()
    // Land on the first playable cultivator, not a locked one.
    const first = this.cards.findIndex((c) => this.progress.isUnlocked('characters', c.id))
    this.setFocus(first === -1 ? 0 : first)
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
    if (cb) cb(c.id)
  }

  handleKey(slot, confirm, dir) {
    if (!this.isOpen) return
    if (this.view === 'menu') {
      if (slot === 1 || confirm) this._showSelect()
      else if (slot === 2) this.handlers.onShop?.()
      else if (slot === 3) this.handlers.onCodex?.()
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
