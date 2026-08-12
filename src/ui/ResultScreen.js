import { iconFor } from './icons.js'
import { applyDaoVowCssVars, getDaoVowVisual } from './Hud.js'
import { getWeapon } from '../data/weapons.js'
import { getPassive } from '../data/passives.js'

const RESULT_HERO_ART = 'assets/sprites2d/seolryeong-combat-v1.png'

const BOSS_PATTERN_LABELS = Object.freeze({
  radialVolley: '전방위 탄막',
  swordLine: '직선 베기',
  swordCone: '부채꼴 참격',
  swordRing: '검환 폭발',
  frostZone: '빙결 장판',
  frostLane: '빙결 가로막',
  frostMine: '빙결 지뢰',
  spiritOrbit: '영체 선회',
  spiritClone: '영체 분신',
  spiritBurst: '영체 폭발',
  'violet-orb-barrage': '자주색 구체 탄막',
  'returning-sword-line': '귀환 검로',
  'returning-sword-ring': '귀환 검환',
  'piercing-sword-cross': '관통 십자검',
  'piercing-sword-ring': '관통 검환',
  'chain-frost-mines': '연쇄 빙뢰',
  'chain-frost-mines-shards': '쇄빙 연쇄뢰',
  'chain-frost-wall-shards': '쇄빙 장벽',
  'cutting-ice-line': '절빙 검로',
  'cutting-ice-wall-line': '절빙 장벽',
  'tracking-shadow-double': '추적 그림자 분신',
  'tracking-shadow-double-purge': '정화 추적 그림자',
  'tracking-shadow-double-echo': '메아리 추적 그림자',
  'shadow-summon-overcharge': '그림자 소환과 과충전 폭발',
  'shadow-summon-overcharge-purge': '정화 그림자 과충전',
  'shadow-summon-overcharge-echo': '메아리 그림자 과충전',
})

function assetUrl(path) {
  const base = import.meta.env?.BASE_URL ?? '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${String(path).replace(/^\/+/, '')}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function readableField(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'object') {
    return value.name ?? value.label ?? value.pattern ?? value.mirrorPattern ?? value.id ?? ''
  }
  return String(value)
}

function bossPatternLabel(value) {
  const raw = readableField(value).trim()
  if (!raw) return ''
  if (BOSS_PATTERN_LABELS[raw]) return BOSS_PATTERN_LABELS[raw]
  // Replay ids are a stable technical contract, not player-facing copy. Keep
  // an unknown machine id out of the result screen while retaining authored
  // Korean names and normal prose from older saves.
  return /^[a-z0-9_-]+$/i.test(raw) ? '기록된 비전' : raw
}

function bossField(value) {
  if (!value) return ''
  if (typeof value !== 'object') return readableField(value)
  const name = value.name ?? value.bossName ?? value.id ?? ''
  const pattern = bossPatternLabel(
    value.patternName ?? value.patternId ?? value.intent ?? value.mirrorPattern?.name ?? '',
  )
  const phase = Number.isFinite(value.phase) ? `${value.phase}단계` : ''
  const phases = (value.phases ?? value.phaseSummary ?? value.mirrorPattern?.phases ?? [])
    .map((entry) => bossPatternLabel(entry?.name ?? entry?.patternName ?? entry?.patternId ?? entry?.id ?? ''))
    .filter(Boolean)
  const signature = pattern || phases.at(-1) || ''
  return [name, phase, signature]
    .filter(Boolean)
    .join(' · ')
}

function itemPresentation(item, slotKind, evolutionIds) {
  const id = typeof item === 'string' ? item : item?.id
  const definition = slotKind === 'passive' ? getPassive(id) : getWeapon(id)
  const evolved = evolutionIds.has(id) || Boolean(definition?.evolutionOf)
  const visualKind = slotKind === 'passive' ? 'passive' : evolved ? 'evolution' : 'weapon'
  const kindLabel = visualKind === 'passive' ? '공법' : visualKind === 'evolution' ? '진화 법보' : '법보'
  const explicitName = typeof item === 'object' ? item?.name : ''
  const name = explicitName || definition?.name || id || '알 수 없는 법보'
  const explicitDescription = typeof item === 'object' ? item?.description ?? item?.desc : ''
  const description = explicitDescription || definition?.desc || '이번 출정에서 획득한 수련 효과입니다.'
  const level = typeof item === 'object' && Number.isFinite(item?.level) ? item.level : 0
  const maxLevel = slotKind === 'passive' ? definition?.max : definition?.levels?.length
  const levelText = visualKind === 'evolution'
    ? '진화'
    : Number.isFinite(maxLevel) ? `Lv.${level}/${maxLevel}` : `Lv.${level}`
  const alt = `${name} ${kindLabel} 아이콘 · ${levelText} · 효과: ${description}`
  return { id, visualKind, kindLabel, name, levelText, description, alt }
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

/** 승천 / 좌화 — the end-of-run summary. */
export class ResultScreen {
  constructor(root, audio = null) {
    this.root = root
    this.audio = audio
    this.onRestart = null
    this.onMenu = null
    this.focus = 0
    this.actions = []

    this.node = document.createElement('div')
    this.node.className = 'screen result-screen'
    this.node.setAttribute('role', 'dialog')
    this.node.setAttribute('aria-modal', 'true')
    this.node.setAttribute('aria-labelledby', 'result-title')
    this.node.setAttribute('aria-describedby', 'result-description')
    this.node.setAttribute('aria-hidden', 'true')
    this.node.style.display = 'none'
    root.appendChild(this.node)

    // The game loop still provides controller/legacy keyboard edges through
    // handleKey. This DOM path gives a focused player both CTAs and prevents a
    // focused button's native Enter/Space click from also reaching Input.
    this._onKeyDown = (event) => {
      if (!this.isOpen) return
      const direction = UI_DIRECTIONS.get(event.code)
      if (direction) {
        event.preventDefault?.()
        event.stopPropagation?.()
        if (!event.repeat) this.handleKey(false, direction)
        return
      }
      if (event.code !== 'Enter' && event.code !== 'Space') return
      event.stopPropagation?.()
      if (event.repeat) {
        event.preventDefault?.()
        return
      }
      if (!isButtonTarget(event.target)) {
        event.preventDefault?.()
        this.handleKey(true, 0)
      }
    }
    this.node.addEventListener('keydown', this._onKeyDown)
  }

  get isOpen() {
    return this.node.style.display !== 'none'
  }

  show(result, handlers) {
    this.onRestart = typeof handlers === 'function' ? handlers : handlers?.onRestart
    this.onMenu = typeof handlers === 'object' ? handlers?.onMenu : null
    const m = Math.floor(result.runTime / 60)
    const s = Math.floor(result.runTime % 60)
    const time = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

    const evolutionIds = new Set(
      result.evolutionIds ?? result.build?.evolutions?.map((item) => item?.id).filter(Boolean) ?? [],
    )
    const loadoutItems = [
      ...(result.weapons ?? result.build?.weapons ?? [])
        .map((item) => itemPresentation(item, 'weapon', evolutionIds)),
      ...(result.passives ?? result.build?.passives ?? [])
        .map((item) => itemPresentation(item, 'passive', evolutionIds)),
    ]
    const icons = loadoutItems.length === 0
      ? '<div class="result-loadout-empty">이번 출정에서 얻은 법보가 없습니다.</div>'
      : loadoutItems.map((item) => `
        <div class="result-loadout-item kind-${item.visualKind}" role="listitem" aria-label="${escapeHtml(item.alt)}" title="${escapeHtml(item.alt)}">
          <img alt="${escapeHtml(item.alt)}" title="${escapeHtml(item.alt)}" src="${iconFor(item.id)}" />
          <span class="result-loadout-kind">${escapeHtml(item.kindLabel)}</span>
          <b class="result-loadout-name">${escapeHtml(item.name)}</b>
          <small class="result-loadout-level">${escapeHtml(item.levelText)}</small>
          <small class="result-loadout-effect">${escapeHtml(item.description)}</small>
        </div>`)
        .join('')

    // 업적 earned by this run, if any. Shown between the numbers and the bank
    // because it is the one part of this screen that says what to try next
    // rather than what just happened.
    const earned = result.achievements ?? []
    const achievements = earned.length === 0 ? '' : `
      <div class="result-achievements">
        <div class="result-ach-title">업적 달성</div>
        ${earned.map((a) => `
          <div class="result-ach">
            <b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.desc)}</span><em>+${escapeHtml(a.stones)}</em>
          </div>`).join('')}
      </div>`
    const daoVisual = getDaoVowVisual(result.daoVow)
    const selectedDaoChoices = result.daoVow?.milestones
      ?.filter((entry) => entry.selected)
      ?.map((entry) => entry.choiceName)
      ?.filter(Boolean)
      ?.join(' · ') ?? ''
    const hasDao = Boolean(result.daoVow?.vowName && daoVisual.vowId)
    const dao = hasDao ? `
      <section class="result-dao dao-${daoVisual.vowId}" data-dao-identity="${daoVisual.identity}"
         data-dao-vfx="${escapeHtml(daoVisual.activeVfx ?? '')}" role="status"
         aria-label="이번 생의 도 ${escapeHtml(daoVisual.name)}; ${escapeHtml(selectedDaoChoices || '맹세 정보 없음')}">
        <div class="result-dao-mark" aria-hidden="true"><span>${daoVisual.glyph}</span></div>
        <div class="result-dao-copy">
          <span>이번 생의 도 · ${escapeHtml(daoVisual.activeVfxLabel || '맹세의 결')}</span>
          <b>${escapeHtml(daoVisual.name)}</b>
          <em>${escapeHtml(selectedDaoChoices || '맹세 정보 없음')}</em>
        </div>
        <div class="result-dao-vfx" aria-hidden="true"></div>
      </section>` : ''

    const stageName = readableField(result.stageName ?? result.stage?.name ?? result.stageId)
    const trialName = readableField(result.trialInfo ?? result.trial)
    const bossSummary = bossField(result.bossSummary ?? result.boss)
    const runContext = [
      stageName ? `<div><span>비경</span><b>${escapeHtml(stageName)}</b></div>` : '',
      trialName ? `<div><span>시련</span><b>${escapeHtml(trialName)}</b></div>` : '',
      bossSummary ? `<div><span>보스 기록</span><b>${escapeHtml(bossSummary)}</b></div>` : '',
    ].filter(Boolean).join('')
    const runContextBlock = runContext ? `
      <section class="result-run-context" aria-label="이번 출정의 장소와 시련">
        ${runContext}
      </section>` : ''
    const earnedStones = result.earnedStones ?? result.stones ?? 0

    this.node.innerHTML = `
      <div class="screen-inner">
        <h1 class="result-banner ${result.victory ? 'win' : 'lose'}" id="result-title">
          ${result.victory ? '승천' : '좌화'}
        </h1>
        <p class="result-flavor" id="result-description">
          ${result.victory
            ? '마존을 베고 비경의 마기를 걷어냈다. 그대는 승천한다.'
            : '기혈이 다해 그 자리에 앉은 채 숨을 거두었다.'}
        </p>
        <section class="result-hero-reward" aria-label="설령의 출정 결과">
          <div class="result-hero-art">
            <img src="${assetUrl(RESULT_HERO_ART)}" alt="설령의 전투 외형" />
          </div>
          <div class="result-reward-copy">
            <span class="result-reward-kicker">${result.victory ? '출정 성공' : '출정 기록'}</span>
            <strong>영석 <em>+${escapeHtml(earnedStones)}</em></strong>
            <span>단전에 쌓인 보상으로 다음 출정을 준비하십시오.</span>
            <img class="result-reward-icon" src="${iconFor('stones')}" alt="영석 보상 아이콘" title="영석 · 다음 출정의 영구 강화 재화" />
          </div>
        </section>
        ${runContextBlock}
        ${dao}
        <div class="result-actions">
          <button type="button" class="btn clickable" data-action="restart">같은 비경 다시 도전</button>
          <button type="button" class="btn btn-alt clickable" data-action="menu">문파로 돌아가기 · 단전 강화</button>
        </div>
        <div class="result-stats">
          <div><span>생존 시간</span><b>${escapeHtml(time)}${result.bests?.time ? ' <em>신기록</em>' : ''}</b></div>
          <div><span>도달 경지</span><b>${escapeHtml(result.realm?.name ?? '알 수 없음')} ${escapeHtml(result.level ?? 0)}층${result.bests?.level ? ' <em>신기록</em>' : ''}</b></div>
          <div><span>처치 수</span><b>${escapeHtml(result.kills ?? 0)}</b></div>
          <div><span>가한 피해</span><b>${escapeHtml(Math.round(result.damageDealt ?? 0).toLocaleString('ko-KR'))}</b></div>
          <div><span>획득 영석</span><b class="gain">+${escapeHtml(earnedStones)}</b></div>
        </div>
        <section class="result-build-summary" aria-labelledby="result-build-title">
          <h2 class="result-section-title" id="result-build-title">이번 출정의 빌드</h2>
          <div class="result-loadout" role="list">${icons}</div>
        </section>
        ${achievements}
        <div class="result-bank">보유 영석 <b>${result.totalStones ?? 0}</b> · 단전에서 영구 강화에 쓸 수 있다</div>
        <div class="result-seed" aria-label="출정 seed">seed ${escapeHtml(result.seed)}</div>
      </div>`

    const daoNode = this.node.querySelector('.result-dao')
    if (daoNode) applyDaoVowCssVars(daoNode, daoVisual)

    const restartButton = this.node.querySelector('[data-action="restart"]')
    const menuButton = this.node.querySelector('[data-action="menu"]')
    restartButton.type = 'button'
    restartButton.addEventListener('click', () => this.restart())
    menuButton.addEventListener('click', () => this.menu())
    this.actions = [restartButton, menuButton]
    for (const [index, button] of this.actions.entries()) {
      if (button.dataset.uiFocusBound === '1') continue
      button.dataset.uiFocusBound = '1'
      const cueFocus = () => this.setFocus(index)
      button.addEventListener('mouseenter', cueFocus)
      button.addEventListener('focus', cueFocus)
    }
    this.node.style.display = ''
    this.node.setAttribute('aria-hidden', 'false')
    this.setFocus(0)
  }

  restart() {
    this.audio?.playUiCue?.('confirm')
    const cb = this.onRestart
    this.hide()
    if (cb) cb()
  }

  menu() {
    this.audio?.playUiCue?.('confirm')
    const cb = this.onMenu
    this.hide()
    if (cb) cb()
  }

  setFocus(i) {
    const next = Math.max(0, Math.min(this.actions.length - 1, i))
    const changed = next !== this.focus
    this.focus = next
    this.actions.forEach((button, k) => button.classList.toggle('focused', k === this.focus))
    focusElement(this.actions[this.focus])
    if (changed) this.audio?.playUiCue?.('focus')
  }

  handleKey(confirm, dir = 0) {
    if (!this.isOpen) return
    if (dir) { this.setFocus(this.focus + dir); return }
    if (!confirm) return
    if (this.focus === 0) this.restart()
    else this.menu()
  }

  hide() {
    blurOwnedFocus(this.node)
    this.node.style.display = 'none'
    this.node.setAttribute('aria-hidden', 'true')
  }

  dispose() {
    this.node.removeEventListener('keydown', this._onKeyDown)
    this.node.remove()
  }
}
