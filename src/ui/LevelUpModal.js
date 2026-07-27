import { iconFor } from './icons.js'

/**
 * 경지 돌파 upgrade choice.
 *
 * Opening it pushes the game into the `levelUp` state: simulation stops but
 * rendering continues, so the frozen battlefield stays visible behind the cards.
 */
export class LevelUpModal {
  constructor(root) {
    this.root = root
    this.onPick = null
    this.choices = []
    this.focus = 0

    this.node = document.createElement('div')
    this.node.className = 'modal-backdrop'
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="modal-panel">
        <div class="modal-title">경지 돌파</div>
        <div class="modal-cards"></div>
        <div class="modal-hint">1 · 2 · 3 또는 ← → 로 선택, Enter 로 확정</div>
      </div>`
    root.appendChild(this.node)
    this.cardsHost = this.node.querySelector('.modal-cards')
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  open(choices, onPick) {
    if (this.isOpen) return
    this.choices = choices
    this.onPick = onPick
    this.focus = 0
    this.cardsHost.innerHTML = ''

    choices.forEach((choice, i) => {
      const card = document.createElement('button')
      card.className = `modal-card clickable kind-${choice.kind}`
      const step = choice.kind === 'evolution'
        ? '진화'
        : choice.fromLevel === 0
          ? '신규 습득'
          : `Lv${choice.fromLevel} → Lv${choice.toLevel}`
      card.innerHTML = `
        ${choice.kind === 'evolution' ? '<div class="modal-evo">진화</div>' : ''}
        <img class="modal-icon" alt="" src="${iconFor(choice.id)}" />
        <div class="modal-name">${choice.name}</div>
        <div class="modal-step">${step}</div>
        <div class="modal-desc">${choice.desc ?? ''}</div>`
      card.addEventListener('click', () => this.pick(i))
      card.addEventListener('mouseenter', () => this.setFocus(i))
      this.cardsHost.appendChild(card)
    })

    this.node.style.display = ''
    this.setFocus(0)
  }

  setFocus(i) {
    this.focus = Math.max(0, Math.min(this.choices.length - 1, i))
    const cards = this.cardsHost.children
    for (let k = 0; k < cards.length; k++) cards[k].classList.toggle('focused', k === this.focus)
  }

  pick(i) {
    if (!this.isOpen) return
    const choice = this.choices[i]
    if (!choice) return
    const cb = this.onPick
    this.close()
    if (cb) cb(choice)
  }

  /** Called by the game's input handling while this modal owns the keyboard. */
  handleKey(slot, confirm, dir) {
    if (!this.isOpen) return
    if (slot > 0) { this.pick(slot - 1); return }
    if (dir) { this.setFocus(this.focus + dir); return }
    if (confirm) this.pick(this.focus)
  }

  close() {
    this.node.style.display = 'none'
    this.choices = []
    this.onPick = null
  }

  dispose() {
    this.node.remove()
  }
}
