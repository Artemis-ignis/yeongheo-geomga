import { journeyProgressFor } from '../data/journey.js'

const SANCTUM_ART = 'assets/environment/jade-sanctuary-environment-v2.webp'
const HERO_ART = 'assets/sprites2d/seolryeong-combat-v1.webp'

function assetUrl(path) {
  const base = import.meta.env?.BASE_URL ?? '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${String(path).replace(/^\/+/, '')}`
}

const ACTIONS = Object.freeze(['expedition', 'survival', 'cultivation', 'codex'])

/**
 * 영허전 is the persistent hub between the title facade and playable routes.
 * It gives exploration, challenge combat, cultivation and records distinct
 * places instead of presenting one timed run as the entire game.
 */
export class SanctumScreen {
  constructor(root, progress, audio = null) {
    this.progress = progress
    this.audio = audio
    this.handlers = {}
    this.focus = 0

    this.node = document.createElement('div')
    this.node.className = 'screen sanctum-screen'
    this.node.style.display = 'none'
    this.node.style.backgroundImage = `linear-gradient(90deg, rgba(4,10,16,.96) 0%, rgba(4,12,18,.78) 43%, rgba(4,10,16,.18) 68%, rgba(4,9,15,.62) 100%), url("${assetUrl(SANCTUM_ART)}")`
    this.node.setAttribute('role', 'dialog')
    this.node.setAttribute('aria-modal', 'true')
    this.node.setAttribute('aria-label', '영허전 수행 거점')
    this.node.innerHTML = `
      <div class="sanctum-ink" aria-hidden="true"></div>
      <header class="sanctum-header">
        <span class="sanctum-seal" aria-hidden="true">虛</span>
        <div>
          <span class="sanctum-kicker">영허검가 · 수행 거점</span>
          <h1>영허전</h1>
          <p>검을 닦고, 천하의 인연을 좇는 곳</p>
        </div>
      </header>

      <main class="sanctum-body">
        <section class="sanctum-journey" aria-labelledby="sanctum-journey-title">
          <span class="sanctum-section-kicker">현재 검로 · <b class="sanctum-chapter-index">제1장</b></span>
          <h2 id="sanctum-journey-title" class="sanctum-quest-title">옥산에 번지는 마기의 근원을 찾으십시오</h2>
          <p class="sanctum-quest-copy">현장의 검흔을 판독하고 봉인 문서를 회수해 비경 수호자에게 이르는 수행입니다.</p>
          <div class="sanctum-route">
            <span class="is-current">영허전</span><i></i><span>검흔 판독</span><i></i><span>봉인 문서</span><i></i><span>옥허진장</span>
          </div>
          <div class="sanctum-consequence" aria-live="polite">
            <span>천하록에 남은 결단</span>
            <b class="sanctum-decision-name">아직 기록된 결단이 없습니다</b>
            <em class="sanctum-decision-outcome">옥산의 봉인 문서를 되찾으면 선택의 결과가 이곳에 남습니다.</em>
          </div>
          <button type="button" class="sanctum-primary clickable" data-act="expedition">
            <span>천하로 나아가기</span>
            <small>조사 · 추적 · 결단 · 봉인 · 장 보스</small>
          </button>
        </section>

        <nav class="sanctum-actions" aria-label="영허전 수행 메뉴">
          <button type="button" class="sanctum-action clickable" data-act="survival">
            <b>천겁 기록전</b><span class="sanctum-survival-copy">제1장 완수 후 열리는 극한 조합 도전</span>
          </button>
          <button type="button" class="sanctum-action clickable" data-act="cultivation">
            <b>수련과 전승</b><span>단전 강화 · 법보와 수사 해금</span>
          </button>
          <button type="button" class="sanctum-action clickable" data-act="codex">
            <b>천하록</b><span>요수 · 법보 · 마존 · 여정 기록</span>
          </button>
        </nav>
      </main>

      <aside class="sanctum-status" aria-label="현재 수행 기록">
        <span>보유 영석 <b class="sanctum-stones">0</b></span>
        <span>비경 여정 <b class="sanctum-clears">0/1</b></span>
        <span>남긴 결단 <b class="sanctum-decisions">0</b></span>
      </aside>
      <img class="sanctum-hero" src="${assetUrl(HERO_ART)}" alt="검을 들고 영허전에 선 설령" />
      <button type="button" class="sanctum-title-return clickable" data-act="title">처음 화면</button>
      <div class="sanctum-help">방향키 선택 · Enter 확인</div>
    `
    root.appendChild(this.node)

    this.buttons = ACTIONS.map((action) => this.node.querySelector(`[data-act="${action}"]`))
    for (const [index, button] of this.buttons.entries()) {
      const action = ACTIONS[index]
      button.addEventListener('mouseenter', () => this.setFocus(index, false))
      button.addEventListener('focus', () => this.setFocus(index, false))
      button.addEventListener('click', () => {
        if (button.disabled) return
        this.audio?.playUiCue?.('confirm')
        this.handlers[action]?.()
      })
    }
    this.node.querySelector('[data-act="title"]').addEventListener('click', () => {
      this.audio?.playUiCue?.('confirm')
      this.handlers.title?.()
    })
    this._onKeyDown = (event) => {
      if (!this.isOpen) return
      const delta = ['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(event.code) ? -1
        : ['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].includes(event.code) ? 1 : 0
      if (delta) {
        event.preventDefault?.()
        if (!event.repeat) this.setFocus(this.focus + delta)
      } else if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat) {
        event.preventDefault?.()
        this.buttons[this.focus]?.click()
      }
    }
    this.node.addEventListener('keydown', this._onKeyDown)
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  show(handlers = null) {
    if (handlers) this.handlers = handlers
    this.node.querySelector('.sanctum-stones').textContent = String(this.progress.stones)
    const journey = journeyProgressFor(this.progress)
    const chapter = journey.current
    const decisions = typeof this.progress.journeyDecisions === 'function'
      ? this.progress.journeyDecisions(chapter.id)
      : [...(this.progress.state.journey?.decisions?.[chapter.id] ?? [])]
    const latestDecision = decisions.at(-1)
    this.node.querySelector('.sanctum-clears').textContent = `${journey.completed}/${journey.total}`
    this.node.querySelector('.sanctum-decisions').textContent = String(decisions.length)
    this.node.querySelector('.sanctum-decision-name').textContent = latestDecision?.name ?? '아직 기록된 결단이 없습니다'
    this.node.querySelector('.sanctum-decision-outcome').textContent = latestDecision?.outcome
      ?? '옥산의 봉인 문서를 되찾으면 선택의 결과가 이곳에 남습니다.'
    this.node.querySelector('.sanctum-chapter-index').textContent = journey.complete ? '장 완료' : chapter.indexLabel
    this.node.querySelector('.sanctum-quest-title').textContent = journey.complete ? chapter.nextGoal : chapter.title
    this.node.querySelector('.sanctum-quest-copy').textContent = journey.complete ? chapter.completionCopy : chapter.objective
    const expeditionLabel = this.node.querySelector('[data-act="expedition"]')?.querySelector('span')
    if (expeditionLabel) expeditionLabel.textContent = journey.complete ? '옥산을 다시 조사하기' : chapter.entryLabel
    const survival = this.node.querySelector('[data-act="survival"]')
    const survivalCopy = survival?.querySelector('.sanctum-survival-copy')
    if (survival) {
      survival.disabled = !journey.complete
      survival.setAttribute('aria-disabled', journey.complete ? 'false' : 'true')
      survival.setAttribute('aria-label', journey.complete
        ? '천겁 기록전. 완성한 검로의 한계를 시험하는 극한 도전'
        : `천겁 기록전 잠김. ${chapter.indexLabel} ${chapter.title} 완수 후 개방`)
    }
    if (survivalCopy) survivalCopy.textContent = journey.complete
      ? '완성한 검로의 한계를 시험하는 극한 도전'
      : `${chapter.indexLabel} 완수 후 개방`
    this.node.style.display = ''
    this.node.setAttribute('aria-hidden', 'false')
    this.setFocus(0)
  }

  hide() {
    this.node.style.display = 'none'
    this.node.setAttribute('aria-hidden', 'true')
  }

  setFocus(index, focusDom = true) {
    this.focus = Math.max(0, Math.min(this.buttons.length - 1, index))
    this.buttons.forEach((button, i) => button.classList.toggle('focused', i === this.focus))
    if (focusDom) this.buttons[this.focus]?.focus?.({ preventScroll: true })
  }

  handleKey(slot, confirm, direction) {
    if (!this.isOpen) return
    if (direction) {
      this.setFocus(this.focus + direction)
      return
    }
    const index = slot > 0 ? slot - 1 : this.focus
    if (confirm || slot > 0) this.buttons[index]?.click()
  }

  dispose() {
    this.node.remove()
  }
}
