import { iconFor } from './icons.js'
import { getWeapon } from '../data/weapons.js'
import { isReleasePlayableCharacter } from '../data/characters.js'
import { unlockCost } from '../data/unlocks.js'
import { STAGES } from '../data/stages.js'
import { TRIALS, getTrial } from '../data/trials.js'

const TITLE_ART = 'assets/marketing/yeongheo-contest-keyart-v1.png'
const SETUP_ART = 'assets/environment/jade-sanctuary-environment-v2.png'
const SEOLRYEONG_ART = 'assets/sprites2d/seolryeong-combat-v1.png'

// The stage cards use dedicated 1024×448 environment thumbnails. Keeping this
// mapping beside the copy makes it impossible for a new 비경 to silently fall
// back to a palette swatch or to another stage's art.
const STAGE_PRESENTATION = Object.freeze({
  jade: {
    index: '제1경',
    tone: '옥산 고원 · 균형형',
    kind: '비경 실경',
    image: 'assets/ui/stage-thumbnails-v1/jade.png',
    emblem: 'assets/ui/skill-icons-v1/bagua-array.png',
    overlay: 'linear-gradient(180deg, rgba(5, 20, 27, 0.06), rgba(3, 11, 16, 0.88))',
    position: 'center',
    accent: '#7fe2c3',
  },
  ember: {
    index: '제2경',
    tone: '잿불 황야 · 고위험',
    kind: '비경 실경',
    image: 'assets/ui/stage-thumbnails-v1/ember.png',
    emblem: 'assets/ui/skill-icons-v1/fire-talisman.png',
    overlay: 'linear-gradient(180deg, rgba(72, 13, 5, 0.04), rgba(19, 4, 3, 0.86))',
    position: 'center',
    accent: '#ff9a63',
  },
  frost: {
    index: '제3경',
    tone: '만년설 고봉 · 극한',
    kind: '비경 실경',
    image: 'assets/ui/stage-thumbnails-v1/frost.png',
    emblem: 'assets/ui/skill-icons-v1/frost-palm.png',
    overlay: 'linear-gradient(180deg, rgba(8, 23, 43, 0.04), rgba(4, 10, 23, 0.88))',
    position: 'center',
    accent: '#b9eaff',
  },
})

function assetUrl(path) {
  const base = import.meta.env?.BASE_URL ?? '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${String(path).replace(/^\/+/, '')}`
}

function stagePresentation(stage) {
  return STAGE_PRESENTATION[stage?.id] ?? STAGE_PRESENTATION.jade
}

const UI_DIRECTIONS = new Map([
  ['ArrowLeft', -1], ['ArrowUp', -1], ['KeyA', -1], ['KeyW', -1],
  ['ArrowRight', 1], ['ArrowDown', 1], ['KeyD', 1], ['KeyS', 1],
])

function focusElement(element) {
  element?.focus?.({ preventScroll: true })
}

function isButtonTarget(target) {
  const element = target?.closest?.('button,[role="button"]') ?? target
  const tag = String(element?.tagName ?? element?.nodeName ?? '').toLowerCase()
  return tag === 'button' || element?.getAttribute?.('role') === 'button'
}

function blurOwnedFocus(node) {
  if (typeof document === 'undefined') return
  const active = document.activeElement
  if (active && (active === node || node.contains?.(active))) active.blur?.()
}

/**
 * Title, main menu, and the run setup flow.
 *
 * The run setup deliberately has three stops — cultivator, 비경, and a final
 * confirmation — so a click or a controller press cannot launch the wrong
 * loadout. Only heroines with a matching authored combat sprite set enter the
 * release selector; future character designs are never sold as playable.
 */
export class TitleScreen {
  /** @param renderer Borrowed to bake the character portraits; optional. */
  constructor(root, characters, progress, renderer = null, audio = null) {
    this.root = root
    this.characters = characters.filter((character) => isReleasePlayableCharacter(character.id))
    this.progress = progress
    this.renderer = renderer
    this.audio = audio
    this.focus = 0
    this.menuFocus = 0
    this.stageFocus = 0
    this.confirmFocus = 0
    this.view = 'menu'
    this.handlers = {}
    this.chosenCharacter = null
    this.chosenStage = null
    this._bakedPortraitIds = new Set()

    this.node = document.createElement('div')
    this.node.className = 'screen title-screen'
    this.node.dataset.view = this.view
    this.node.dataset.titleArt = TITLE_ART
    // Keep the key art's feet clear of the viewport edge on the 16:9 release
    // capture.  The wide-screen rule below gives taller 2560x1600 canvases a
    // little more breathing room without introducing a second image asset.
    this.node.dataset.titleSafeCrop = '22px'
    this.node.setAttribute('role', 'dialog')
    this.node.setAttribute('aria-modal', 'true')
    this.node.setAttribute('aria-label', '영허검가 출정 준비')
    this.node.style.display = 'none'
    this.node.innerHTML = `
      <div class="screen-inner">
        <div class="title-brand">
          <div class="title-eyebrow">선협 생존 액션</div>
          <h1 class="title-mark">영허검가</h1>
          <div class="title-sub">靈虛劍歌</div>
          <div class="title-tag">네가 고른 도가, 네가 맞설 천겁을 만든다</div>
        </div>

        <div class="title-promise">
          <strong class="title-promise-title">월하 옥산 · 약 7분의 천겁</strong>
          <span class="title-promise-copy">설령의 비검을 키우고 비경의 군세를 베어 마존과 결착을 내십시오.</span>
        </div>

        <div class="title-menu">
          <button type="button" class="btn clickable title-quickstart" data-act="start" aria-label="설령과 옥산 고원으로 바로 출정">
            <span class="title-action-kicker">추천 · 약 7분</span>
            <span class="title-action-label">빠른 출정</span>
          </button>
          <button type="button" class="btn btn-alt clickable title-setup" data-act="setup">
            <span class="title-action-kicker">출정 준비</span>
            <span class="title-action-label">수사 · 비경 고르기</span>
          </button>
          <button type="button" class="btn btn-alt clickable" data-act="shop">단전 · 해금</button>
          <button type="button" class="btn btn-alt clickable" data-act="codex">도감 · 기록</button>
        </div>
        <div class="title-stones"></div>

        <section class="stage-select" style="display:none" aria-labelledby="stage-select-title">
          <div class="setup-steps" aria-label="출정 준비 2단계">
            <span>01 수사</span><span aria-hidden="true">—</span><strong class="setup-step-current">02 비경</strong><span aria-hidden="true">—</span><span>03 출정</span>
          </div>
          <div class="select-kicker">비경 선택</div>
          <h2 class="select-heading" id="stage-select-title">천겁이 내릴 비경을 고르십시오</h2>
          <p class="select-intro">비경마다 적의 생태와 기혈, 영석 보상이 달라집니다.</p>
          <div class="stage-cards"></div>
          <div class="trial-row">
            <div class="trial-heading">시련 강도 · 보상 배율</div>
            <div class="trial-pips"></div>
            <div class="trial-desc"></div>
          </div>
          <button type="button" class="btn btn-alt btn-back clickable" data-act="stageBack">← 수사 다시 고르기</button>
        </section>

        <section class="char-select" style="display:none" aria-labelledby="char-select-title">
          <div class="setup-steps" aria-label="출정 준비 1단계">
            <strong class="setup-step-current">01 수사</strong><span aria-hidden="true">—</span><span>02 비경</span><span aria-hidden="true">—</span><span>03 출정</span>
          </div>
          <div class="select-kicker">수사 선택</div>
          <h2 class="select-heading" id="char-select-title">출정할 수사를 고르십시오</h2>
          <p class="select-intro">도가와 시작 법보가 전투의 첫 호흡을 결정합니다.</p>
          <div class="char-cards"></div>
          <button type="button" class="btn btn-alt btn-back clickable" data-act="back">← 돌아가기</button>
        </section>

        <section class="confirm-select" style="display:none" aria-labelledby="confirm-select-title">
          <div class="setup-steps" aria-label="출정 준비 3단계">
            <span>01 수사</span><span aria-hidden="true">—</span><span>02 비경</span><span aria-hidden="true">—</span><strong class="setup-step-current">03 출정</strong>
          </div>
          <div class="select-kicker">출정 확인</div>
          <h2 class="select-heading" id="confirm-select-title">천겁에 들 준비가 끝났습니다</h2>
          <p class="select-intro">선택한 수사와 비경, 시련을 마지막으로 확인하십시오.</p>
          <div class="confirm-visual">
            <img class="confirm-character-art" alt="" />
            <div class="confirm-visual-copy"></div>
          </div>
          <div class="confirm-summary"></div>
          <div class="confirm-actions">
            <button type="button" class="btn clickable" data-act="confirmStart">전투 시작</button>
            <button type="button" class="btn btn-alt clickable" data-act="confirmBack">← 비경 다시 고르기</button>
          </div>
        </section>

        <div class="setup-status" role="status" aria-live="polite"></div>

        <div class="controls-legend">
          WASD·방향키 이동 &nbsp;·&nbsp; Space 축지법 &nbsp;·&nbsp; E 상호작용 &nbsp;·&nbsp; 공격 자동
        </div>
      </div>`
    root.appendChild(this.node)

    this.menu = this.node.querySelector('.title-menu')
    this.menuButtons = [...this.node.querySelectorAll('.title-menu .btn')]
    this.titleBrand = this.node.querySelector('.title-brand')
    this.titlePromise = this.node.querySelector('.title-promise')
    this.stonesLabel = this.node.querySelector('.title-stones')
    this.selectView = this.node.querySelector('.char-select')
    this.statusLabel = this.node.querySelector('.setup-status')
    this.controlsLegend = this.node.querySelector('.controls-legend')

    this.stageView = this.node.querySelector('.stage-select')
    this.confirmView = this.node.querySelector('.confirm-select')
    this.confirmSummary = this.node.querySelector('.confirm-summary')
    this.confirmVisual = this.node.querySelector('.confirm-visual')
    this.confirmCharacterArt = this.node.querySelector('.confirm-character-art')
    this.confirmVisualCopy = this.node.querySelector('.confirm-visual-copy')
    this.confirmStartButton = this.node.querySelector('[data-act="confirmStart"]')
    this.confirmBackButton = this.node.querySelector('[data-act="confirmBack"]')

    this.node.querySelector('[data-act="start"]').addEventListener('click', () => {
      this._uiCue('confirm')
      this.quickStart()
    })
    this.node.querySelector('[data-act="setup"]').addEventListener('click', () => {
      this._uiCue('confirm')
      this._showSelect()
    })
    this.node.querySelector('[data-act="shop"]').addEventListener('click', () => {
      this._uiCue('confirm')
      this.handlers.onShop?.()
    })
    this.node.querySelector('[data-act="codex"]').addEventListener('click', () => {
      this._uiCue('confirm')
      this.handlers.onCodex?.()
    })
    this.node.querySelector('[data-act="back"]').addEventListener('click', () => {
      this._uiCue('confirm')
      this._showMenu()
    })
    this.node.querySelector('[data-act="stageBack"]').addEventListener('click', () => {
      this._uiCue('confirm')
      if (this.chosenCharacter) this._showSelect()
      else this._showMenu()
    })
    this.confirmStartButton.addEventListener('click', () => {
      this._uiCue('confirm')
      this.confirmStart()
    })
    this.confirmBackButton.addEventListener('click', () => {
      this._uiCue('confirm')
      this._showStages()
    })
    for (const [index, button] of [this.confirmStartButton, this.confirmBackButton].entries()) {
      button.addEventListener('mouseenter', () => this.setConfirmFocus(index, false))
      button.addEventListener('focus', () => this.setConfirmFocus(index, false))
    }

    this.menuButtons.forEach((button, index) => {
      button.addEventListener('mouseenter', () => this.setMenuFocus(index, false))
      button.addEventListener('focus', () => this.setMenuFocus(index, false))
    })

    // A focused button owns Enter/Space. Let the browser dispatch its native
    // click and stop the window-level Input listener from firing the same
    // action a second time. Direction keys are handled here as well so DOM
    // focus and controller focus never drift apart.
    this._onKeyDown = (event) => {
      if (!this.isOpen) return
      const direction = UI_DIRECTIONS.get(event.code)
      if (direction) {
        event.preventDefault?.()
        event.stopPropagation?.()
        if (!event.repeat) this.handleKey(0, false, direction)
        return
      }
      if (event.code !== 'Enter' && event.code !== 'Space') return
      event.stopPropagation?.()
      if (event.repeat) {
        event.preventDefault?.()
        return
      }
      // A button's default activation is the one source of truth. The root is
      // still useful for a gamepad-like synthetic event or a focused container.
      if (!isButtonTarget(event.target)) {
        event.preventDefault?.()
        this.handleKey(0, true, 0)
      }
    }
    this.node.addEventListener('keydown', this._onKeyDown)

    const stageHost = this.node.querySelector('.stage-cards')
    this.stageCards = STAGES.map((s, i) => {
      const presentation = stagePresentation(s)
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'char-card stage-card clickable'
      card.dataset.stage = s.id
      card.style.setProperty('--stage-accent', presentation.accent)
      card.style.setProperty('--stage-overlay', presentation.overlay)
      card.style.setProperty('--stage-position', presentation.position)
      card.setAttribute('aria-label', `${s.name}. ${presentation.tone}. ${s.desc}`)
      card.innerHTML = `
        <div class="char-lock"></div>
        <div class="stage-card-art stage-swatch">
          <img class="stage-art" src="${assetUrl(presentation.image)}" alt="${s.name} 비경 풍경 — ${s.desc}" />
          <div class="stage-art-shade" aria-hidden="true"></div>
          <img class="stage-emblem" src="${assetUrl(presentation.emblem)}" alt="" aria-hidden="true" />
          <span class="stage-art-kind">${presentation.kind}</span>
          <span class="stage-art-status">${presentation.index}</span>
        </div>
        <div class="char-name">${s.name}</div>
        <div class="char-path">${presentation.tone}</div>
        <div class="char-traits">${s.desc}</div>
        <div class="stage-rules">
          <span>적 기혈 ×${s.hpScale.toFixed(2)}</span><span aria-hidden="true">·</span><span>영석 ×${s.stoneScale.toFixed(2)}</span>
        </div>`
      card.addEventListener('click', () => {
        this._uiCue('confirm')
        this.pickStage(i)
      })
      card.addEventListener('mouseenter', () => this.setStageFocus(i, false))
      card.addEventListener('focus', () => this.setStageFocus(i, false))
      stageHost.appendChild(card)
      return {
        card,
        lock: card.querySelector('.char-lock'),
        badge: card.querySelector('.stage-art-status'),
        id: s.id,
        stage: s,
        presentation,
      }
    })

    // 시련 sits with the 비경 because both are choices about the run rather than
    // about the cultivator. Locked tiers stay visible with the time that opens
    // them: a ladder you cannot see is a ladder nobody climbs.
    const pipHost = this.node.querySelector('.trial-pips')
    this.trialDesc = this.node.querySelector('.trial-desc')
    this.trialPips = TRIALS.map((t) => {
      const pip = document.createElement('button')
      pip.type = 'button'
      pip.className = 'trial-pip clickable'
      pip.innerHTML = `<span class="trial-name">${t.name}</span><span class="trial-hanja">${t.hanja}</span>`
      pip.addEventListener('click', () => {
        this._uiCue('confirm')
        this.pickTrial(t.id)
      })
      pip.addEventListener('mouseenter', () => this._describeTrial(t.id))
      pipHost.appendChild(pip)
      return { pip, id: t.id }
    })

    const host = this.node.querySelector('.char-cards')
    host.classList.toggle('is-single', this.characters.length === 1)
    this.cards = this.characters.map((c, i) => {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'char-card clickable'
      card.dataset.character = c.id
      const weapon = getWeapon(c.startWeapon)
      card.setAttribute('aria-label', `${c.name}, ${c.path}. 시작 법보 ${weapon?.name ?? '미상'}. ${c.traits.join(', ')}`)
      card.innerHTML = `
        <div class="char-lock"></div>
        <div class="char-portrait" role="img">
          <span class="char-art-kind"></span>
        </div>
        <div class="char-name">${c.name}</div>
        <div class="char-path">${c.path}</div>
        <div class="char-start">
          <img alt="" src="${iconFor(c.startWeapon)}" />
          <span><small class="char-start-label">시작 법보</small>${weapon ? weapon.name : ''}</span>
        </div>
        <div class="char-traits">${c.traits.map((t) => `· ${t}`).join('<br />')}</div>`
      card.addEventListener('click', () => {
        this._uiCue('confirm')
        this.pick(i)
      })
      card.addEventListener('mouseenter', () => this.setFocus(i, false))
      card.addEventListener('focus', () => this.setFocus(i, false))
      host.appendChild(card)
      const portrait = card.querySelector('.char-portrait')
      const artLabel = card.querySelector('.char-art-kind')
      if (c.id === 'seolryeong') {
        portrait.style.backgroundImage = `linear-gradient(180deg, rgba(18, 42, 60, 0.05), rgba(3, 10, 17, 0.68)), url("${assetUrl(SEOLRYEONG_ART)}")`
        portrait.style.backgroundSize = 'cover, auto 126%'
        portrait.style.backgroundPosition = 'center, center 8%'
        portrait.setAttribute('aria-label', `${c.name}의 실제 전투 외형`)
        artLabel.textContent = '전투 외형'
      } else {
        // No authored portrait exists for the future cultivators yet. Their own
        // palette-derived face seal is honest progression art; an enemy or the
        // hero duplicated into these slots would promise a character that does
        // not exist.
        portrait.style.backgroundImage = `url("${iconFor(c.id)}"), radial-gradient(circle at 50% 42%, rgba(255,255,255,.12), rgba(5,10,17,.86) 72%)`
        portrait.style.backgroundSize = '56% auto, cover'
        portrait.style.backgroundPosition = 'center, center'
        portrait.setAttribute('aria-label', `${c.name}의 도가 인장. 실제 초상은 봉인 상태`)
        artLabel.textContent = '도가 인장'
      }
      portrait.style.backgroundRepeat = 'no-repeat'
      return {
        card,
        lock: card.querySelector('.char-lock'),
        id: c.id,
        character: c,
        portrait,
        artLabel,
      }
    })

    this._applyViewPresentation('menu')
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  _applyViewPresentation(view) {
    const menuView = view === 'menu'
    const image = assetUrl(menuView ? TITLE_ART : SETUP_ART)
    this.node.style.backgroundImage = menuView
      ? `linear-gradient(90deg, rgba(3, 10, 21, 0.90) 0%, rgba(4, 12, 24, 0.72) 40%, rgba(3, 8, 16, 0.10) 72%, rgba(3, 7, 14, 0.24) 100%), url("${image}")`
      : `linear-gradient(180deg, rgba(4, 11, 19, 0.76), rgba(4, 8, 13, 0.94)), url("${image}")`
    this.node.style.backgroundPosition = menuView
      ? 'center, center bottom var(--title-art-safe-bottom, 22px)'
      : 'center, center 48%'
    this.node.style.backgroundSize = menuView
      ? 'cover, auto calc(100% - var(--title-art-safe-bottom, 22px))'
      : 'cover, cover'
    this.node.style.backgroundRepeat = 'no-repeat, no-repeat'

    this.titleBrand.style.display = menuView ? '' : 'none'
    this.titlePromise.style.display = menuView ? '' : 'none'
    for (const [name, element] of [
      ['menu', this.menu],
      ['select', this.selectView],
      ['stage', this.stageView],
      ['confirm', this.confirmView],
    ]) element.setAttribute('aria-hidden', name === view ? 'false' : 'true')

    const legends = {
      menu: '빠른 출정은 약 7분  ·  직접 준비에서 수사·비경·시련을 고릅니다  ·  전투는 자동 공격',
      select: '방향키로 수사를 살피고 Enter로 선택  ·  봉인된 수사는 단전에서 영석으로 해금',
      stage: '방향키로 비경과 시련을 고르고 Enter로 선택  ·  봉인된 비경은 영석으로 개방',
      confirm: '선택 내용을 확인하고 전투에 진입  ·  돌아가면 비경과 시련을 다시 고를 수 있습니다',
    }
    this.controlsLegend.textContent = legends[view] ?? legends.menu
  }

  _announce(message = '') {
    this.statusLabel.textContent = message
  }

  _uiCue(kind = 'confirm') {
    this.audio?.playUiCue?.(kind)
  }

  /** Called with handlers on first entry, and with none when returning from a sub-screen. */
  show(handlers) {
    if (handlers) this.handlers = handlers
    this.node.style.display = ''
    this.node.setAttribute('aria-hidden', 'false')
    this._showMenu()
  }

  hide() {
    blurOwnedFocus(this.node)
    this.node.style.display = 'none'
    this.node.setAttribute('aria-hidden', 'true')
  }

  _showMenu() {
    this.view = 'menu'
    this.node.dataset.view = this.view
    this._applyViewPresentation(this.view)
    this.chosenCharacter = null
    this.chosenStage = null
    this.menu.style.display = ''
    this.stonesLabel.style.display = ''
    this.selectView.style.display = 'none'
    this.stageView.style.display = 'none'
    this.confirmView.style.display = 'none'
    this.stonesLabel.textContent = `보유 영석 ${this.progress.stones}`
    this._announce('')
    this.setMenuFocus(0)
  }

  _showStages() {
    this.view = 'stage'
    this.node.dataset.view = this.view
    this._applyViewPresentation(this.view)
    this.menu.style.display = 'none'
    this.stonesLabel.style.display = ''
    this.selectView.style.display = 'none'
    this.stageView.style.display = ''
    this.confirmView.style.display = 'none'
    this.stonesLabel.textContent = `보유 영석 ${this.progress.stones}`
    for (const c of this.stageCards) {
      const unlocked = this.progress.isUnlocked('stages', c.id)
      c.card.classList.toggle('locked', !unlocked)
      c.lock.textContent = unlocked ? '' : `🔒 영석 ${unlockCost('stages', c.id) ?? '?'}`
      const cost = unlockCost('stages', c.id) ?? '?'
      c.card.setAttribute('aria-label', unlocked
        ? `${c.stage.name}. ${c.presentation.tone}. ${c.stage.desc}`
        : `${c.stage.name}, 봉인됨. 영석 ${cost} 필요. 선택하면 보유 영석으로 개방을 시도합니다. ${c.stage.desc}`)
      c.badge.textContent = unlocked
        ? `${c.presentation.index} · ${c.id === 'jade' ? '초행 추천' : '개방됨'}`
        : `${c.presentation.index} · 봉인`
    }
    const chosen = this.stageCards.findIndex((c) => c.id === this.chosenStage)
    const first = this.stageCards.findIndex((c) => this.progress.isUnlocked('stages', c.id))
    this.setStageFocus(chosen >= 0 ? chosen : (first === -1 ? 0 : first))
    this._renderTrials()
    const character = this.characters.find((entry) => entry.id === this.chosenCharacter)
    this._announce(character ? `${character.name}의 출정지를 고르십시오.` : '출정할 비경을 고르십시오.')
  }

  _renderTrials() {
    const max = this.progress.maxTrial
    const chosen = this.progress.trial
    for (const p of this.trialPips) {
      p.pip.classList.toggle('locked', p.id > max)
      p.pip.classList.toggle('chosen', p.id === chosen)
      p.pip.setAttribute('aria-disabled', p.id > max ? 'true' : 'false')
      p.pip.setAttribute('aria-pressed', p.id === chosen ? 'true' : 'false')
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
    if (id > this.progress.maxTrial) {
      const trial = getTrial(id)
      const mm = Math.floor(trial.unlockSeconds / 60)
      const ss = String(trial.unlockSeconds % 60).padStart(2, '0')
      this._announce(`${trial.name} 시련은 ${mm}:${ss} 생존 기록을 달성하면 열립니다.`)
      return
    }
    this.progress.setTrial(id)
    this.handlers.onUnlock?.()
    this._renderTrials()
    this._announce(`${getTrial(id).name} 시련을 선택했습니다.`)
  }

  setStageFocus(i, focusDom = true) {
    const next = Math.max(0, Math.min(this.stageCards.length - 1, i))
    const changed = next !== this.stageFocus
    this.stageFocus = next
    this.stageCards.forEach((c, k) => c.card.classList.toggle('focused', k === this.stageFocus))
    if (focusDom) focusElement(this.stageCards[this.stageFocus]?.card)
    if (changed) this._uiCue('focus')
  }

  /** Locked stages buy themselves on click, so there is no separate shop trip. */
  pickStage(i) {
    const card = this.stageCards[i]
    if (!card) return
    if (!this.progress.isUnlocked('stages', card.id)) {
      if (!this.progress.unlock('stages', card.id)) {
        const cost = unlockCost('stages', card.id) ?? '?'
        this._announce(`${card.stage.name} 개방에는 영석 ${cost}이 필요합니다. 현재 ${this.progress.stones}개를 보유 중입니다.`)
        return
      }
      this.handlers.onUnlock?.()
      this._showStages()
      this._announce(`${card.stage.name}의 봉인을 풀었습니다. 다시 선택하면 출정 확인으로 이동합니다.`)
      return
    }
    this.chosenStage = card.id
    this._showConfirm()
  }

  _showSelect() {
    this.view = 'select'
    this.node.dataset.view = this.view
    this._applyViewPresentation(this.view)
    this.menu.style.display = 'none'
    this.stonesLabel.style.display = 'none'
    this.stageView.style.display = 'none'
    this.confirmView.style.display = 'none'
    this.selectView.style.display = ''
    this._bakePortraits()
    this._refreshLocks()
    // Restore the chosen cultivator when returning from 비경, otherwise land on
    // the first playable one rather than a locked progression card.
    const chosen = this.cards.findIndex((c) => c.id === this.chosenCharacter)
    const first = this.cards.findIndex((c) => this.progress.isUnlocked('characters', c.id))
    this.setFocus(chosen >= 0 ? chosen : (first === -1 ? 0 : first))
    this._announce('수사의 도가와 시작 법보를 비교한 뒤 선택하십시오.')
  }

  /** Contest judges reach the authored seven-minute run with one deliberate click. */
  quickStart() {
    if (!this.isOpen || this.view !== 'menu') return
    const character = this.characters.find((entry) => entry.id === 'seolryeong')
      ?? this.characters.find((entry) => this.progress.isUnlocked('characters', entry.id))
    const stage = STAGES.find((entry) => entry.id === 'jade')
    if (!character || !stage) return
    this.chosenCharacter = character.id
    this.chosenStage = stage.id
    const cb = this.handlers.onStart
    this.hide()
    cb?.(character.id, stage.id, { mode: 'showcase' })
  }

  _showConfirm() {
    const character = this.characters.find((c) => c.id === this.chosenCharacter)
    const stage = STAGES.find((s) => s.id === this.chosenStage)
    if (!character || !stage) return

    this.view = 'confirm'
    this.node.dataset.view = this.view
    this._applyViewPresentation(this.view)
    this.menu.style.display = 'none'
    this.stonesLabel.style.display = 'none'
    this.selectView.style.display = 'none'
    this.stageView.style.display = 'none'
    this.confirmView.style.display = ''
    const trial = getTrial(this.progress.trial)
    const weapon = getWeapon(character.startWeapon)
    const presentation = stagePresentation(stage)
    this.confirmVisual.style.backgroundImage = `linear-gradient(90deg, rgba(3, 10, 17, 0.88), rgba(3, 9, 15, 0.20) 66%, rgba(3, 8, 14, 0.48)), url("${assetUrl(presentation.image)}")`
    this.confirmVisual.style.backgroundSize = 'cover, cover'
    this.confirmVisual.style.backgroundPosition = `center, ${presentation.position}`
    this.confirmVisual.style.backgroundRepeat = 'no-repeat, no-repeat'
    this.confirmVisual.style.setProperty('--stage-accent', presentation.accent)
    this.confirmCharacterArt.src = character.id === 'seolryeong'
      ? assetUrl(SEOLRYEONG_ART)
      : iconFor(character.id)
    this.confirmCharacterArt.alt = character.id === 'seolryeong'
      ? `${character.name}의 실제 전투 외형`
      : `${character.name}의 도가 인장`
    this.confirmCharacterArt.classList.toggle('is-hero-cutout', character.id === 'seolryeong')
    this.confirmCharacterArt.classList.toggle('is-seal', character.id !== 'seolryeong')
    this.confirmVisualCopy.innerHTML = `
      <span class="confirm-visual-stage">${presentation.index} · ${presentation.tone}</span>
      <strong class="confirm-visual-title">${character.name} × ${stage.name}</strong>
      <span class="confirm-visual-meta">${character.path}<br />${weapon?.name ?? '법보 미상'}로 천겁을 맞습니다.</span>`
    this.confirmSummary.innerHTML = `
      <div class="confirm-choice">
        <span>수사 · 도가</span><b>${character.name}</b>
        <em class="confirm-choice-detail">${character.path}</em>
      </div>
      <div class="confirm-choice">
        <span>비경 · 보상</span><b>${stage.name}</b>
        <em class="confirm-choice-detail">영석 ×${stage.stoneScale.toFixed(2)}</em>
      </div>
      <div class="confirm-choice">
        <span>시련 · 난도</span><b>${trial.name}</b>
        <em class="confirm-choice-detail">${trial.desc}</em>
      </div>`
    this.confirmStartButton.textContent = `${stage.name} 진입`
    this._announce(`${character.name}, ${stage.name}, ${trial.name} 시련을 선택했습니다.`)
    this.setConfirmFocus(0)
  }

  setMenuFocus(i, focusDom = true) {
    const next = Math.max(0, Math.min(this.menuButtons.length - 1, i))
    const changed = next !== this.menuFocus
    this.menuFocus = next
    this.menuButtons.forEach((button, k) => button.classList.toggle('focused', k === this.menuFocus))
    if (focusDom) focusElement(this.menuButtons[this.menuFocus])
    if (changed) this._uiCue('focus')
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
    for (const c of this.cards) {
      const unlocked = this.progress.isUnlocked('characters', c.id)
      if (!unlocked) {
        c.portrait.classList.remove('empty', 'locked-placeholder')
        continue
      }
      if (this._bakedPortraitIds.has(c.id)) continue
      this._bakedPortraitIds.add(c.id)
      c.portrait.classList.remove('empty', 'locked-placeholder')
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
        c.portrait.style.backgroundSize = 'auto 170%, auto 170%'
        c.portrait.style.backgroundPosition = 'center 22%, center 22%'
        c.portrait.classList.add('imagegen-reference')
        c.artLabel.textContent = '공식 초상'
        c.portrait.setAttribute('aria-label', `${c.character.name}의 공식 수사 초상`)
        continue
      }
      // The PixiJS runtime intentionally has no Three.js renderer. Keep locked
      // and future cultivators as styled silhouettes until their authored 2D
      // portraits arrive instead of pulling the retired 3D graph into the web
      // bundle merely to bake menu thumbnails.
      if (!import.meta.env.DEV || !this.renderer) {
        c.portrait.classList.add('path-emblem-reference')
        continue
      }
      // Legacy-only portrait baking stays behind a dev constant so the
      // production Pixi entry cannot pull Three.js into its import graph.
      const legacyPortraitModule = '../art/portrait.js'
      import(/* @vite-ignore */ legacyPortraitModule).then(({ portraitFor }) => {
        const url = portraitFor(c.character, this.renderer)
        if (!url) return
        c.portrait.style.backgroundImage = `url(${url})`
        c.portrait.style.backgroundSize = 'contain'
        c.portrait.style.backgroundPosition = 'center'
        c.artLabel.textContent = '전투 모형'
        c.portrait.setAttribute('aria-label', `${c.character.name}의 전투 모형 초상`)
      })
    }
  }

  _refreshLocks() {
    for (const c of this.cards) {
      const unlocked = this.progress.isUnlocked('characters', c.id)
      c.card.classList.toggle('locked', !unlocked)
      c.lock.textContent = unlocked ? '' : `🔒 영석 ${unlockCost('characters', c.id) ?? '?'}`
      c.card.setAttribute('aria-disabled', unlocked ? 'false' : 'true')
      if (!unlocked) c.artLabel.textContent = c.id === 'seolryeong' ? '공식 초상 · 봉인' : '도가 인장 · 봉인'
    }
  }

  setFocus(i, focusDom = true) {
    const next = Math.max(0, Math.min(this.characters.length - 1, i))
    const changed = next !== this.focus
    this.focus = next
    this.cards.forEach((c, k) => c.card.classList.toggle('focused', k === this.focus))
    if (focusDom) focusElement(this.cards[this.focus]?.card)
    if (changed) this._uiCue('focus')
  }

  pick(i) {
    if (!this.isOpen || this.view !== 'select') return
    const c = this.characters[i]
    if (!c) return
    if (!this.progress.isUnlocked('characters', c.id)) {
      const cost = unlockCost('characters', c.id) ?? '?'
      this._announce(`${c.name}은 아직 봉인되어 있습니다. 단전에서 영석 ${cost}으로 해금할 수 있습니다.`)
      return
    }
    this.chosenCharacter = c.id
    this._showStages()
  }

  confirmStart() {
    if (!this.isOpen || this.view !== 'confirm') return
    const character = this.characters.find((c) => c.id === this.chosenCharacter)
    const stage = STAGES.find((s) => s.id === this.chosenStage)
    if (!character || !stage) return
    const cb = this.handlers.onStart
    this.hide()
    if (cb) cb(character.id, stage.id)
  }

  setConfirmFocus(i, focusDom = true) {
    const next = Math.max(0, Math.min(1, i))
    const changed = next !== this.confirmFocus
    this.confirmFocus = next
    this.confirmStartButton.classList.toggle('focused', this.confirmFocus === 0)
    this.confirmBackButton.classList.toggle('focused', this.confirmFocus === 1)
    if (focusDom) focusElement(this.confirmFocus === 0 ? this.confirmStartButton : this.confirmBackButton)
    if (changed) this._uiCue('focus')
  }

  handleKey(slot, confirm, dir) {
    if (!this.isOpen) return
    if (this.view === 'menu') {
      if (dir) { this.setMenuFocus(this.menuFocus + dir); return }
      if (slot === 1 || (confirm && this.menuFocus === 0)) {
        this._uiCue('confirm')
        this.quickStart()
      } else if (slot === 4 || (confirm && this.menuFocus === 1)) {
        this._uiCue('confirm')
        this._showSelect()
      } else if (slot === 2 || (confirm && this.menuFocus === 2)) {
        this._uiCue('confirm')
        this.handlers.onShop?.()
      } else if (slot === 3 || (confirm && this.menuFocus === 3)) {
        this._uiCue('confirm')
        this.handlers.onCodex?.()
      }
      return
    }
    if (this.view === 'confirm') {
      if (slot === 1 || (confirm && this.confirmFocus === 0)) {
        this._uiCue('confirm')
        this.confirmStart()
        return
      }
      if (slot === 2 || (confirm && this.confirmFocus === 1)) {
        this._uiCue('confirm')
        this._showStages()
        return
      }
      if (dir) this.setConfirmFocus(this.confirmFocus + dir)
      return
    }
    if (this.view === 'stage') {
      if (slot > 0) {
        this._uiCue('confirm')
        this.pickStage(slot - 1)
        return
      }
      if (dir) { this.setStageFocus(this.stageFocus + dir); return }
      if (confirm) {
        this._uiCue('confirm')
        this.pickStage(this.stageFocus)
      }
      return
    }
    if (slot > 0) {
      this._uiCue('confirm')
      this.pick(slot - 1)
      return
    }
    if (dir) { this.setFocus(this.focus + dir); return }
    if (confirm) {
      this._uiCue('confirm')
      this.pick(this.focus)
    }
  }

  dispose() {
    this.node.removeEventListener('keydown', this._onKeyDown)
    this.node.remove()
  }
}
