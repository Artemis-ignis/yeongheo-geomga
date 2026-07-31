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
        <div class="modal-actions">
          <button class="modal-action clickable" data-act="reroll">점괘 <span class="act-count"></span></button>
          <button class="modal-action clickable" data-act="banish">봉인 <span class="act-count"></span></button>
          <button class="modal-action clickable" data-act="skip">넘기기</button>
        </div>
        <div class="modal-hint">1 · 2 · 3 또는 ← → 로 선택, Enter 로 확정</div>
      </div>`
    root.appendChild(this.node)
    this.cardsHost = this.node.querySelector('.modal-cards')
    this.actionsHost = this.node.querySelector('.modal-actions')
    this.hintNode = this.node.querySelector('.modal-hint')

    /**
     * Banish arms rather than firing, because it needs a target.
     *
     * Pressing it and then picking a card would otherwise be indistinguishable
     * from taking that card — the most expensive misclick in the game.
     */
    this.arming = false

    for (const btn of this.actionsHost.querySelectorAll('.modal-action')) {
      btn.addEventListener('click', () => this._act(btn.dataset.act))
    }
  }

  _act(act) {
    if (!this.isOpen) return
    if (act === 'skip') { const cb = this.onSkip; this.close(); cb?.(); return }
    if (act === 'reroll') {
      if (!this.charges.reroll) return
      const cb = this.onReroll
      this.close()
      cb?.()
      return
    }
    if (act === 'banish') {
      if (!this.charges.banish) return
      this.arming = !this.arming
      this._render()
    }
  }

  /** Repaint the action row and whatever the cards currently mean. */
  _render() {
    const counts = { reroll: this.charges.reroll ?? 0, banish: this.charges.banish ?? 0 }
    for (const btn of this.actionsHost.querySelectorAll('.modal-action')) {
      const act = btn.dataset.act
      const span = btn.querySelector('.act-count')
      if (span) span.textContent = counts[act] > 0 ? `×${counts[act]}` : ''
      if (act !== 'skip') btn.disabled = counts[act] <= 0
      btn.classList.toggle('armed', this.arming && act === 'banish')
    }
    this.cardsHost.classList.toggle('banishing', this.arming)
    this.hintNode.textContent = this.arming
      ? '지울 패를 고르세요. 이번 런에서 다시 나오지 않습니다.'
      : '1 · 2 · 3 또는 ← → 로 선택, Enter 로 확정'
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  open(choices, onPick, opts = {}) {
    if (this.isOpen) return
    this.choices = choices
    this.onPick = onPick
    this.onSkip = opts.onSkip ?? null
    this.onReroll = opts.onReroll ?? null
    this.onBanish = opts.onBanish ?? null
    this.charges = opts.charges ?? { reroll: 0, banish: 0 }
    this.arming = false
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
    this._render()
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
    // Armed to banish: this card is a target, not a selection.
    if (this.arming) {
      const cb = this.onBanish
      this.close()
      cb?.(choice)
      return
    }
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
    this.onSkip = null
    this.onReroll = null
    this.onBanish = null
    this.arming = false
  }

  dispose() {
    this.node.remove()
  }
}
