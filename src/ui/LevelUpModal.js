import { iconFor } from './icons.js'
import { applyDaoVowCssVars, getDaoVowVisual } from './Hud.js'
import { escapeHtml } from './domPrimitives.js'

const CHOICE_KIND_PRESENTATION = Object.freeze({
  weapon: Object.freeze({ label: '법보', mark: '법', className: 'choice-artifact' }),
  passive: Object.freeze({ label: '공법', mark: '공', className: 'choice-technique' }),
  evolution: Object.freeze({ label: '진화', mark: '진', className: 'choice-evolution' }),
  dao: Object.freeze({ label: '도 선택', mark: '도', className: 'choice-dao' }),
  consumable: Object.freeze({ label: '기연', mark: '연', className: 'choice-consumable' }),
})

const FALLBACK_KIND_PRESENTATION = Object.freeze({
  label: '선택', mark: '선', className: 'choice-unknown',
})

function stepForChoice(choice) {
  if (choice.kind === 'evolution') return choice.step ?? '법보 진화 · 완성'
  if (choice.kind === 'dao') return choice.step ?? '천겁의 맹세'
  if (choice.kind === 'consumable') return choice.step ?? '즉시 발동'
  if (choice.fromLevel === 0) return `신규 습득 · Lv.${choice.toLevel ?? 1}`
  if (Number.isFinite(choice.fromLevel) && Number.isFinite(choice.toLevel)) {
    return `Lv.${choice.fromLevel} → Lv.${choice.toLevel}`
  }
  return choice.step ?? '새로운 깨달음'
}

/**
 * 경지 돌파 upgrade choice.
 *
 * Opening it pushes the game into the `levelUp` state: simulation stops but
 * rendering continues, so the frozen battlefield stays visible behind the cards.
 */
export class LevelUpModal {
  constructor(root, audio = null) {
    this.root = root
    this.audio = audio
    this.onPick = null
    this.choices = []
    this.focus = 0
    this._closeTimer = null

    this.node = document.createElement('div')
    this.node.className = 'modal-backdrop'
    this.node.style.display = 'none'
    this.node.setAttribute('aria-hidden', 'true')
    this.node.innerHTML = `
      <div class="modal-panel" role="dialog" aria-modal="true" aria-label="경지 돌파">
        <header class="modal-heading">
          <div class="modal-eyebrow">天命 · 한 번의 깨달음</div>
          <div class="modal-title">경지 돌파</div>
          <p class="modal-lead">지금의 검로를 바꿀 한 장을 고르십시오.</p>
        </header>
        <div class="modal-cards" role="group" aria-label="돌파 선택지"></div>
        <div class="modal-actions" role="group" aria-label="선택지 제어">
          <button type="button" class="modal-action modal-action-reroll clickable" data-act="reroll">
            <span class="modal-action-mark" aria-hidden="true">易</span>
            <span class="modal-action-copy"><b>점괘 바꾸기 <span class="act-count"></span></b><small>세 장을 다시 뽑습니다</small></span>
          </button>
          <button type="button" class="modal-action modal-action-banish clickable" data-act="banish">
            <span class="modal-action-mark" aria-hidden="true">封</span>
            <span class="modal-action-copy"><b>봉인하기 <span class="act-count"></span></b><small>고른 패를 이번 출정에서 제외합니다</small></span>
          </button>
          <button type="button" class="modal-action modal-action-skip clickable" data-act="skip">깨달음을 흘려보낸다</button>
        </div>
        <div class="modal-hint" aria-live="polite">一 · 二 · 三 / 방향키로 고르고 Enter로 받습니다</div>
      </div>`
    root.appendChild(this.node)
    this.cardsHost = this.node.querySelector('.modal-cards')
    this.actionsHost = this.node.querySelector('.modal-actions')
    this.hintNode = this.node.querySelector('.modal-hint')
    this.titleNode = this.node.querySelector('.modal-title')
    this.panelNode = this.node.querySelector('.modal-panel')

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
      ? '지울 패를 고르세요. 이번 출정에서 다시 나오지 않습니다.'
      : this.customHint ?? '一 · 二 · 三 / 방향키로 고르고 Enter로 받습니다'
  }

  get isOpen() {
    return this.node.style.display !== 'none' && !this.node.classList.contains('closing')
  }

  open(choices, onPick, opts = {}) {
    if (this.node.classList.contains('closing')) {
      if (this._closeTimer !== null) clearTimeout(this._closeTimer)
      this._closeTimer = null
      this.node.style.display = 'none'
      this.node.classList.remove('closing')
    }
    if (this.isOpen) return
    this.choices = choices
    this.onPick = onPick
    this.onSkip = opts.onSkip ?? null
    this.onReroll = opts.onReroll ?? null
    this.onBanish = opts.onBanish ?? null
    this.charges = opts.charges ?? { reroll: 0, banish: 0 }
    this.arming = false
    this.focus = 0
    this.titleNode.textContent = opts.title ?? '경지 돌파'
    this.panelNode.setAttribute('aria-label', this.titleNode.textContent)
    this.panelNode.classList.toggle('dao-vow-panel', opts.variant === 'dao')
    this.actionsHost.style.display = opts.actions === false ? 'none' : ''
    this.customHint = opts.hint ?? null
    this.cardsHost.innerHTML = ''

    choices.forEach((choice, i) => {
      const card = document.createElement('button')
      card.type = 'button'
      const daoVisual = choice.kind === 'dao'
        ? getDaoVowVisual(choice.daoPresentation ?? choice)
        : null
      const daoClass = daoVisual?.vowId ? ` dao-${daoVisual.vowId}` : ''
      const kind = CHOICE_KIND_PRESENTATION[choice.kind] ?? FALLBACK_KIND_PRESENTATION
      card.className = `modal-card clickable kind-${choice.kind ?? 'unknown'} ${kind.className}${daoClass}`
      card.dataset.kind = choice.kind ?? 'unknown'
      if (daoVisual?.vowId) {
        card.dataset.daoIdentity = daoVisual.identity
        card.dataset.daoVfx = daoVisual.activeVfx ?? ''
        card.dataset.daoGlyph = daoVisual.glyph
        applyDaoVowCssVars(card, daoVisual)
      }
      const step = stepForChoice(choice)
      const iconId = choice.iconId ?? choice.id
      const name = choice.name ?? choice.id ?? '이름 없는 선택'
      const effect = choice.desc ?? '선택 즉시 효과가 적용됩니다.'
      const choiceNumber = ['一', '二', '三'][i] ?? String(i + 1)
      const daoLabel = daoVisual?.vowId
        ? `<div class="modal-dao-label">${escapeHtml(daoVisual.name)}</div>
        <div class="modal-dao-mark" aria-hidden="true"><span>${escapeHtml(daoVisual.glyph)}</span></div>`
        : ''
      const ariaLabel = choice.ariaLabel
        ?? `${kind.label} · ${step} · ${daoVisual?.vowId ? `${daoVisual.name} · ` : ''}${name} · 효과: ${effect}`
      card.setAttribute('aria-label', ariaLabel)
      card.setAttribute('title', `${kind.label} · ${name}\n${step}\n${effect}`)
      card.innerHTML = `
        <span class="modal-card-index" aria-hidden="true">${choiceNumber}</span>
        ${choice.kind === 'evolution' ? '<div class="modal-evo">진화</div>' : ''}
        <div class="modal-icon-frame" data-placeholder="${kind.mark}">
          <img class="modal-icon" alt="${escapeHtml(`${name} ${kind.label} 아이콘`)}"
            title="${escapeHtml(`${kind.label} · ${name}`)}" src="${escapeHtml(iconFor(iconId))}"
            decoding="sync" fetchpriority="high" draggable="false" />
          <span class="modal-kind-mark" aria-hidden="true">${kind.mark}</span>
        </div>
        ${daoLabel}
        <div class="modal-name">${escapeHtml(name)}</div>
        <div class="modal-meta">
          <span class="modal-kind">${kind.label}</span>
          <span class="modal-step">${escapeHtml(step)}</span>
        </div>
        <div class="modal-effect">
          <span class="modal-effect-label">효과</span>
          <div class="modal-desc">${escapeHtml(effect)}</div>
        </div>
        <span class="modal-pick-cue" aria-hidden="true">이 깨달음을 받는다</span>
        ${daoVisual?.vowId ? `<div class="modal-dao-vfx" aria-hidden="true"></div>` : ''}`
      card.addEventListener('click', () => this.pick(i))
      card.addEventListener('mouseenter', () => this.setFocus(i, false))
      card.addEventListener('focus', () => this.setFocus(i, false))
      this.cardsHost.appendChild(card)
    })

    this.node.style.display = ''
    this.node.setAttribute('aria-hidden', 'false')
    this._render()
    this.setFocus(0)
  }

  setFocus(i, focusDom = true) {
    const next = Math.max(0, Math.min(this.choices.length - 1, i))
    const changed = next !== this.focus
    this.focus = next
    const cards = this.cardsHost.children
    for (let k = 0; k < cards.length; k++) {
      const focused = k === this.focus
      cards[k].classList.toggle('focused', focused)
      cards[k].setAttribute('tabindex', focused ? '0' : '-1')
    }
    if (focusDom) cards[this.focus]?.focus?.({ preventScroll: true })
    if (changed) this.audio?.playUiCue?.('focus')
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
    if (!this.isOpen) return
    this.node.setAttribute('aria-hidden', 'true')
    this.node.classList.add('closing')
    this.choices = []
    this.onPick = null
    this.onSkip = null
    this.onReroll = null
    this.onBanish = null
    this.arming = false
    this.customHint = null
    this.actionsHost.style.display = ''
    this.panelNode.classList.remove('dao-vow-panel')
    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => {
      this._closeTimer = null
      this.node.style.display = 'none'
      this.node.classList.remove('closing')
    }
    if (reducedMotion) finish()
    else this._closeTimer = setTimeout(finish, 150)
  }

  dispose() {
    if (this._closeTimer !== null) clearTimeout(this._closeTimer)
    this.node.remove()
  }
}
