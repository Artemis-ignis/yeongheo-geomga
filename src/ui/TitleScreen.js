import { iconFor } from './icons.js'
import { getWeapon } from '../data/weapons.js'

/**
 * Title and character select.
 *
 * The 3D preview of each cultivator is rendered by Game into an offscreen target
 * and blitted here as an image, so this module stays pure DOM.
 */
export class TitleScreen {
  constructor(root, characters) {
    this.root = root
    this.characters = characters
    this.focus = 0
    this.onStart = null

    this.node = document.createElement('div')
    this.node.className = 'screen'
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="screen-inner">
        <div class="title-mark">靈墟劍歌</div>
        <div class="title-sub">영허검가</div>
        <div class="title-tag">— 마기가 삼킨 비경에서, 검을 든 소녀들의 이야기 —</div>
        <div class="char-cards"></div>
        <div class="controls-legend">
          WASD·방향키 이동 &nbsp;·&nbsp; Space 축지법 &nbsp;·&nbsp; P 일시정지 &nbsp;·&nbsp; 공격은 자동
        </div>
      </div>`
    root.appendChild(this.node)

    const host = this.node.querySelector('.char-cards')
    this.cards = characters.map((c, i) => {
      const card = document.createElement('button')
      card.className = 'char-card clickable'
      const weapon = getWeapon(c.startWeapon)
      card.innerHTML = `
        <canvas class="char-portrait"></canvas>
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
      return { card, canvas: card.querySelector('canvas') }
    })
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  show(onStart) {
    this.onStart = onStart
    this.node.style.display = ''
    this.setFocus(0)
  }

  hide() {
    this.node.style.display = 'none'
  }

  setFocus(i) {
    this.focus = Math.max(0, Math.min(this.characters.length - 1, i))
    this.cards.forEach((c, k) => c.card.classList.toggle('focused', k === this.focus))
  }

  pick(i) {
    if (!this.isOpen) return
    const c = this.characters[i]
    if (!c) return
    const cb = this.onStart
    this.hide()
    if (cb) cb(c.id)
  }

  handleKey(slot, confirm, dir) {
    if (!this.isOpen) return
    if (slot > 0) { this.pick(slot - 1); return }
    if (dir) { this.setFocus(this.focus + dir); return }
    if (confirm) this.pick(this.focus)
  }

  dispose() {
    this.node.remove()
  }
}
