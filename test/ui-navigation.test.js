import { afterAll, describe, expect, it, vi } from 'vitest'
import { CHARACTERS } from '../src/data/characters.js'
import { DaoVows2D } from '../src/runtime2d/DaoVows2D.js'
import { Hud } from '../src/ui/Hud.js'
import { LevelUpModal } from '../src/ui/LevelUpModal.js'
import { ResultScreen } from '../src/ui/ResultScreen.js'
import { TitleScreen } from '../src/ui/TitleScreen.js'
import { ShopScreen } from '../src/ui/ShopScreen.js'
import { CodexScreen } from '../src/ui/CodexScreen.js'
import { PauseScreen } from '../src/ui/PauseScreen.js'

class FakeClassList {
  constructor(owner) {
    this.owner = owner
    this.values = new Set()
  }

  add(...values) { values.forEach((value) => this.values.add(value)) }
  remove(...values) { values.forEach((value) => this.values.delete(value)) }
  contains(value) { return this.values.has(value) }
  toggle(value, force) {
    const next = force === undefined ? !this.values.has(value) : force
    if (next) this.values.add(value)
    else this.values.delete(value)
    return next
  }
}

function simpleSelector(element, selector) {
  const attr = selector.match(/^\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/)
  if (attr) return attr[2] === undefined
    ? element.getAttribute(attr[1]) !== null
    : element.getAttribute(attr[1]) === attr[2]
  const tag = selector.match(/^[a-zA-Z][\w-]*/)?.[0]
  if (tag && element.tagName.toLowerCase() !== tag.toLowerCase()) return false
  const classes = [...selector.matchAll(/\.([\w-]+)/g)].map((match) => match[1])
  return classes.every((name) => element.classList.contains(name))
}

function matchesSelector(element, selector) {
  const parts = selector.trim().split(/\s+/)
  if (!simpleSelector(element, parts.at(-1))) return false
  let parent = element.parentElement
  for (let i = parts.length - 2; i >= 0; i--) {
    while (parent && !simpleSelector(parent, parts[i])) parent = parent.parentElement
    if (!parent) return false
    parent = parent.parentElement
  }
  return true
}

function parseMarkup(parent, html) {
  const tokens = /<!--[^]*?-->|<\/?([a-zA-Z][\w-]*)([^>]*)>/g
  const stack = [parent]
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  let match
  while ((match = tokens.exec(html))) {
    const raw = match[0]
    if (raw.startsWith('<!--')) continue
    const closing = raw.startsWith('</')
    if (closing) {
      if (stack.length > 1) stack.pop()
      continue
    }
    const element = new FakeElement(match[1])
    const attrs = match[2] ?? ''
    for (const attr of attrs.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      element.setAttribute(attr[1], attr[2] ?? attr[3] ?? attr[4] ?? '')
    }
    stack.at(-1).appendChild(element)
    if (!voidTags.has(match[1].toLowerCase()) && !/\/\s*>$/.test(raw)) stack.push(element)
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase()
    this.nodeName = this.tagName
    this.children = []
    this.parentElement = null
    this.style = { setProperty(name, value) { this[name] = String(value) } }
    this.attributes = new Map()
    this.dataset = {}
    this.classList = new FakeClassList(this)
    this.listeners = new Map()
    this._innerHTML = ''
    this._textContent = ''
  }

  set className(value) {
    this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean))
  }

  get className() { return [...this.classList.values].join(' ') }

  set innerHTML(value) {
    this._innerHTML = String(value)
    this.children = []
    this._textContent = ''
    parseMarkup(this, this._innerHTML)
  }

  get innerHTML() { return this._innerHTML }

  set textContent(value) {
    this._textContent = String(value)
    this.children = []
  }

  get textContent() { return this._textContent || this.children.map((child) => child.textContent).join('') }

  setAttribute(name, value) {
    const stringValue = String(value)
    this.attributes.set(name, stringValue)
    if (name === 'class') this.className = stringValue
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      this.dataset[key] = stringValue
    }
  }

  getAttribute(name) { return this.attributes.get(name) ?? null }

  removeAttribute(name) {
    this.attributes.delete(name)
  }

  appendChild(child) {
    child.parentElement = this
    this.children.push(child)
    return child
  }

  remove() {
    const index = this.parentElement?.children.indexOf(this) ?? -1
    if (index >= 0) this.parentElement.children.splice(index, 1)
    this.parentElement = null
  }

  contains(element) {
    for (let current = element; current; current = current.parentElement) {
      if (current === this) return true
    }
    return false
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }

  querySelectorAll(selector) {
    const result = []
    const visit = (element) => {
      for (const child of element.children) {
        if (matchesSelector(child, selector)) result.push(child)
        visit(child)
      }
    }
    visit(this)
    return result
  }

  closest(selector) {
    const selectors = selector.split(',').map((part) => part.trim())
    for (let element = this; element; element = element.parentElement) {
      if (selectors.some((part) => matchesSelector(element, part))) return element
    }
    return null
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type).push(listener)
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? []
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }

  fire(type, event = {}) {
    const payload = { type, target: this, preventDefault() {}, stopPropagation() {}, ...event }
    for (const listener of this.listeners.get(type) ?? []) listener(payload)
  }

  click() { this.fire('click') }

  focus() { globalThis.document.activeElement = this }
  blur() { if (globalThis.document.activeElement === this) globalThis.document.activeElement = null }
}

class FakeCanvas extends FakeElement {
  constructor() { super('canvas') }

  getContext() {
    return new Proxy({}, {
      get(_target, property) {
        if (property === 'createLinearGradient' || property === 'createRadialGradient') {
          return () => ({ addColorStop() {} })
        }
        return () => {}
      },
      set() { return true },
    })
  }

  toDataURL() { return 'data:image/png;base64,fixture' }
}

class FakeDocument {
  constructor() { this.activeElement = null }
  createElement(tagName) { return tagName === 'canvas' ? new FakeCanvas() : new FakeElement(tagName) }
}

const previousDocument = globalThis.document
globalThis.document = new FakeDocument()

function makeRoot() { return new FakeElement('div') }

function makeProgress() {
  return {
    stones: 0,
    state: { stagesCleared: [], journey: { chaptersCleared: [], survivalVictories: 0, decisions: {} } },
    records: { victories: 0 },
    trial: 0,
    maxTrial: 0,
    isUnlocked(kind, id) { return kind === 'characters' ? id === 'seolryeong' : id === 'jade' },
    unlock() { return false },
    setTrial(id) { this.trial = id; return id },
    journeyDecisions(chapterId) { return [...(this.state.journey.decisions[chapterId] ?? [])] },
  }
}

function resultFixture() {
  return {
    victory: false,
    runTime: 12,
    realm: { name: '연기' },
    level: 1,
    kills: 2,
    stones: 3,
    totalStones: 3,
    seed: 7,
    weapons: [],
    passives: [],
  }
}

describe('TitleScreen player navigation', () => {
  it('only exposes cultivators with an authored release combat sprite set', () => {
    const screen = new TitleScreen(makeRoot(), CHARACTERS, makeProgress())
    expect(screen.cards.map((card) => card.id)).toEqual(['seolryeong'])
    expect(screen.stageCards.map((card) => card.id)).toEqual(['jade'])
    expect(screen.node.querySelector('.char-cards').classList.contains('is-single')).toBe(true)
  })

  it('keeps the Seolryeong roster portrait on the canonical v3 identity', () => {
    const screen = new TitleScreen(makeRoot(), CHARACTERS, makeProgress())
    screen._bakePortraits()
    const portrait = screen.cards[0].portrait
    expect(portrait.style.backgroundImage).toContain('seolryeong-character-reference-v3.webp')
    expect(portrait.style.backgroundImage).not.toContain('seolryeong-character-reference-v2.webp')
  })

  it('skips both redundant single-character and single-chapter card steps for the main journey', () => {
    const screen = new TitleScreen(makeRoot(), CHARACTERS, makeProgress())
    screen.show({ onStart() { throw new Error('started too early') } })
    screen._openSetup()
    expect(screen.view).toBe('confirm')
    expect(screen.chosenCharacter).toBe('seolryeong')
    expect(screen.chosenStage).toBe('jade')
    expect(screen.selectView.style.display).toBe('none')
    expect(screen.stageView.style.display).toBe('none')
    expect(screen.confirmBackButton.textContent).toContain('처음 화면')
  })

  it('owns every top-level route without opening a second title screen', () => {
    const screen = new TitleScreen(makeRoot(), [CHARACTERS[0]], makeProgress())
    const routes = []
    screen.show({
      onExpedition: () => routes.push('expedition'),
      onCultivation: () => routes.push('cultivation'),
      onCodex: () => routes.push('codex'),
    })

    screen.handleKey(0, true, 0)
    screen.setMenuFocus(2)
    screen.handleKey(0, true, 0)
    screen.setMenuFocus(3)
    screen.handleKey(0, true, 0)
    expect(routes).toEqual(['expedition', 'cultivation', 'codex'])
  })

  it('uses player-facing Korean copy on the first screen', () => {
    const screen = new TitleScreen(makeRoot(), [CHARACTERS[0]], makeProgress())
    expect(screen.node.innerHTML).toContain('끊어진 영맥 끝에 감춰진 검가의 진실')
    expect(screen.node.innerHTML).toContain('검의 맹세 · 영허의 길')
    expect(screen.node.innerHTML).toContain('옥산으로 출정')
    expect(screen.node.innerHTML).toContain('수련과 전승')
    expect(screen.node.innerHTML).not.toContain('칠 분의 천겁')
    expect(screen.node.innerHTML).not.toContain('시연')
    expect(screen.node.style.backgroundPosition)
      .toBe('center, center')
  })

  it('keeps the detailed setup flow internally consistent for future full-game mode', () => {
    const screen = new TitleScreen(makeRoot(), [CHARACTERS[0]], makeProgress())
    screen.show({ onStart() { throw new Error('started too early') } })
    screen.setupMode = 'survival'
    screen._showSelect()
    screen.handleKey(0, true, 0)
    screen.handleKey(0, true, 0)

    screen.handleKey(0, false, 1)
    expect(screen.confirmFocus).toBe(1)
    screen.handleKey(0, true, 0)
    expect(screen.view).toBe('stage')
    expect(screen.chosenStage).toBe('jade')
  })
})

describe('TitleScreen route ownership', () => {
  it('keeps the main journey primary and locks survival until the first chapter is cleared', () => {
    const screen = new TitleScreen(makeRoot(), [CHARACTERS[0]], makeProgress())
    const calls = []
    screen.show({
      onExpedition: () => calls.push('expedition'),
      onSurvival: () => calls.push('survival'),
      onCultivation: () => calls.push('cultivation'),
      onCodex: () => calls.push('codex'),
    })

    screen.menuButtons.forEach((button) => button.fire('click'))
    expect(calls).toEqual(['expedition', 'cultivation', 'codex'])
    expect(screen.node.querySelector('[data-act="survival"]').disabled).toBe(true)
    expect(screen.node.textContent).toContain('제1장 완수 후 개방')
    expect(screen.node.textContent).toContain('옥산에 번지는 마기')
  })

  it('shows the consequence carried from a prior chapter decision in expedition confirmation', () => {
    const progress = makeProgress()
    progress.state.journey.decisions['jade:guardian'] = [{ choiceId: 'claim-seal', beatId: 'sealed-record' }]
    const screen = new TitleScreen(makeRoot(), [CHARACTERS[0]], progress)
    screen.setupMode = 'expedition'
    screen.chosenCharacter = 'seolryeong'
    screen.chosenStage = 'jade'
    screen._showConfirm()

    expect(screen.confirmSummary.innerHTML).toContain('결단 · 전승')
    expect(screen.confirmSummary.innerHTML).toContain('검가의 봉인술')
    expect(screen.confirmSummary.innerHTML).toContain('재시전 -5%')
  })

  it('unlocks the optional heavenly trial after completing the authored chapter', () => {
    const progress = makeProgress()
    progress.state.journey.chaptersCleared.push('jade:guardian')
    const screen = new TitleScreen(makeRoot(), [CHARACTERS[0]], progress)
    const calls = []
    screen.show({ onSurvival: () => calls.push('survival') })

    const survival = screen.node.querySelector('[data-act="survival"]')
    expect(survival.disabled).toBe(false)
    survival.fire('click')
    expect(calls).toEqual(['survival'])
    expect(screen.node.textContent).toContain('완성한 검로의 한계를 시험하는 극한 도전')
  })

  it('brings a persistent story decision back into the single home screen', () => {
    const progress = makeProgress()
    progress.state.journey.decisions['jade:guardian'] = [{
      beatId: 'sealed-record', choiceId: 'record-truth', name: '진상을 새기다',
      outcome: '문서 원본을 천하록에 보존했습니다.',
    }]
    const screen = new TitleScreen(makeRoot(), [CHARACTERS[0]], progress)
    screen.show()

    expect(screen.node.dataset.decisions).toBe('1')
    expect(screen.node.querySelector('.title-route-name').textContent).toContain('옥산')
  })
})

describe('ResultScreen keyboard CTAs', () => {
  it('moves focus to menu and invokes the focused action', () => {
    const screen = new ResultScreen(makeRoot())
    const calls = []
    screen.show(resultFixture(), { onRestart: () => calls.push('restart'), onMenu: () => calls.push('menu') })
    expect(globalThis.document.activeElement).toBe(screen.actions[0])

    screen.handleKey(false, 1)
    expect(globalThis.document.activeElement).toBe(screen.actions[1])
    screen.handleKey(true)
    expect(calls).toEqual(['menu'])
  })

  it('does not duplicate a focused native button with a global Enter event', () => {
    const screen = new ResultScreen(makeRoot())
    const calls = []
    screen.show(resultFixture(), { onRestart: () => calls.push('restart') })
    screen.node.fire('keydown', { code: 'Enter', target: screen.actions[0] })
    expect(calls).toEqual([])
    screen.actions[0].fire('click')
    expect(calls).toEqual(['restart'])
  })

  it('renders an accessible result dialog with a named runtime build and reward visual', () => {
    const screen = new ResultScreen(makeRoot())
    screen.show({
      ...resultFixture(),
      victory: true,
      stageName: '옥산 고원',
      trial: { name: '초행' },
      bossSummary: { name: '옥허진장' },
      earnedStones: 8,
      weapons: [{ id: 'flyingSword', level: 3 }],
      passives: [{ id: 'swordArt', level: 2 }],
      achievements: [{ name: '첫 베기', desc: '요괴를 쓰러뜨린다.', stones: 4 }],
    }, { onRestart() {} })

    expect(screen.node.getAttribute('role')).toBe('dialog')
    expect(screen.node.getAttribute('aria-labelledby')).toBe('result-title')
    expect(screen.node.querySelector('.result-hero-art img').getAttribute('alt')).toContain('설령')
    expect(screen.node.querySelector('.result-reward-icon').getAttribute('alt')).toContain('영석')
    expect(screen.node.querySelector('.result-reward-icon').getAttribute('title')).toContain('영구 강화')
    expect(screen.node.innerHTML).toContain('옥산 고원')
    const loadout = screen.node.querySelectorAll('.result-loadout-item')
    expect(loadout).toHaveLength(2)
    expect(loadout[0].getAttribute('aria-label')).toContain('비검')
    expect(loadout[1].getAttribute('aria-label')).toContain('검결')
    expect(loadout[0].getAttribute('aria-label')).toContain('효과:')
    expect(loadout[0].getAttribute('title')).toBe(loadout[0].getAttribute('aria-label'))
    const buildSummary = screen.node.querySelector('.result-build-summary')
    expect(buildSummary.getAttribute('aria-labelledby')).toBe('result-build-title')
    expect(screen.node.querySelector('.result-section-title').getAttribute('id')).toBe('result-build-title')
    expect(screen.node.innerHTML.indexOf('result-build-summary')).toBeLessThan(
      screen.node.innerHTML.indexOf('result-achievements'),
    )
    expect(screen.node.innerHTML).toContain('추적')
    expect(screen.node.innerHTML).toContain('위력')
    expect(screen.node.innerHTML).toContain('처음 화면으로 돌아가기')
  })

  it('keeps sparse records to two zones and adds a progress zone only when authored data exists', () => {
    const screen = new ResultScreen(makeRoot())
    screen.show({
      ...resultFixture(),
      achievements: [{ name: '무흔', desc: '기혈을 잃지 않는다.', stones: 220 }],
    }, { onRestart() {}, onMenu() {} })

    const sparseLedger = screen.node.querySelector('.result-ledger')
    expect(sparseLedger.classList.contains('result-ledger-has-progress')).toBe(false)
    expect(screen.node.querySelector('.result-progress-column')).toBeNull()
    expect(screen.node.querySelectorAll('.result-achievements')).toHaveLength(1)
    expect(screen.node.querySelectorAll('.result-ach')).toHaveLength(1)
    expect(screen.node.innerHTML.match(/무흔/g)).toHaveLength(1)
    expect(screen.node.querySelector('.result-outcome-column').getAttribute('aria-label')).toBe('출정 결과와 보상')
    expect(screen.node.querySelector('.result-record-column').getAttribute('aria-label')).toBe('출정 기록과 빌드')

    screen.show({
      ...resultFixture(), mode: 'expedition',
      journey: {
        title: '옥산에 번지는 마기', nextGoal: '다음 검로를 확인하십시오.',
        objectivesCompleted: 1, objectivesTotal: 3,
      },
    }, { onRestart() {}, onMenu() {} })

    expect(screen.node.querySelector('.result-ledger').classList.contains('result-ledger-has-progress')).toBe(true)
    expect(screen.node.querySelector('.result-progress-column').getAttribute('aria-label')).toBe('다음 수행과 진행')
    expect(screen.node.querySelector('.result-journey')).not.toBeNull()
  })

  it('presents exploration as a return journey without 천겁 vocabulary', () => {
    const screen = new ResultScreen(makeRoot())
    screen.show({
      ...resultFixture(), mode: 'expedition', victory: true,
      trialInfo: { name: '역풍' }, replay: { mode: 'expedition' },
    }, { onRestart() {}, onMenu() {} })

    expect(screen.node.innerHTML).toContain('비경 귀환')
    expect(screen.node.innerHTML).toContain('탐사 시간')
    expect(screen.node.innerHTML).toContain('다시 탐사한다')
    expect(screen.node.innerHTML).not.toContain('역풍')
    expect(screen.node.innerHTML).not.toContain('같은 시련')
    expect(screen.node.innerHTML).not.toContain('승천')
  })

  it('shows the authored decision and consequence in an expedition record', () => {
    const screen = new ResultScreen(makeRoot())
    screen.show({
      ...resultFixture(), mode: 'expedition', victory: true,
      journey: {
        indexLabel: '제1장', title: '옥산에 번지는 마기', completionCopy: '옥산의 영맥을 되살렸습니다.',
        nextGoal: '천하록에서 회수한 문서를 읽으십시오.', objectivesCompleted: 3, objectivesTotal: 3,
        decisions: [{ name: '진상을 새기다', outcome: '문서 원본을 천하록에 보존했습니다.' }],
      },
    }, { onRestart() {}, onMenu() {} })

    expect(screen.node.innerHTML).toContain('이번 장의 결단')
    expect(screen.node.innerHTML).toContain('진상을 새기다')
    expect(screen.node.innerHTML).toContain('문서 원본을 천하록에 보존했습니다.')
  })

  it('turns replay pattern ids into concise player-facing boss records', () => {
    const screen = new ResultScreen(makeRoot())
    screen.show({
      ...resultFixture(),
      victory: true,
      bossSummary: {
        name: '옥허진장',
        phase: 3,
        patternId: 'shadow-summon-overcharge-purge',
        phases: [
          { patternId: 'violet-orb-barrage' },
          { patternId: 'tracking-shadow-double-purge' },
          { patternId: 'shadow-summon-overcharge-purge' },
        ],
      },
    }, { onRestart() {} })

    const record = screen.node.innerHTML
    expect(record).toContain('옥허진장')
    expect(record).toContain('3단계')
    expect(record).toContain('정화 그림자 과충전')
    expect(record).not.toContain('shadow-summon-overcharge-purge')
    expect(record).not.toContain('violet-orb-barrage')
  })
})

describe('LevelUpModal keyboard focus', () => {
  it('moves real DOM focus with the roving selection', () => {
    const modal = new LevelUpModal(makeRoot())
    modal.open([
      { kind: 'weapon', id: 'flyingSword', name: '비검', desc: '첫째' },
      { kind: 'weapon', id: 'fireTalisman', name: '화염부', desc: '둘째' },
      { kind: 'passive', id: 'lightBody', name: '경신공', desc: '셋째' },
    ], () => {})
    expect(globalThis.document.activeElement).toBe(modal.cardsHost.children[0])
    modal.handleKey(0, false, 1)
    expect(globalThis.document.activeElement).toBe(modal.cardsHost.children[1])
    expect(modal.cardsHost.children[1].getAttribute('tabindex')).toBe('0')
  })
})

function hudFixture(daoVow = null) {
  return {
    realm: { name: '연기' }, level: 1, runTime: 1,
    xp: 0, xpNeeded: 10, kills: 0, stones: 0,
    daoVow, radar: [], playerHeading: 0, radarRevision: 1, runId: 1,
    hp: 100, maxHp: 100, dashCooldown: 0, weapons: [], passives: [], boss: null,
  }
}

describe('Dao identity surfaces', () => {
  it('labels objective-driven exploration time separately from survival time', () => {
    const hud = new Hud(makeRoot())
    hud.update({ ...hudFixture(), mode: 'expedition', runTime: 61, expeditionLabel: '제1장 · 영맥 1/3' })
    expect(hud.timer.textContent).toBe('제1장 · 영맥 1/3')
    expect(hud.timer.getAttribute('aria-label')).toContain('경과 시간 01:01')
    hud.update({ ...hudFixture(), mode: 'survival', runTime: 61 })
    expect(hud.timer.textContent).toBe('01:01')
  })

  it('clears a defeated run boss bar before the next run starts', () => {
    const hud = new Hud(makeRoot())
    hud.update({
      ...hudFixture(),
      boss: { name: '옥허진장', hp: 1200, maxHp: 14000, referenceAsset: 'boss.png' },
    })
    expect(hud.bossWrap.style.display).toBe('')
    expect(hud.bossPortrait.getAttribute('alt')).toBe('옥허진장 초상화')
    expect(hud.bossPortrait.getAttribute('title')).toBe('옥허진장 초상화')

    hud.reset()
    hud.update(hudFixture())

    expect(hud.bossWrap.style.display).toBe('none')
    expect(hud.bossName.textContent).toBe('')
    expect(hud.bossPortrait.getAttribute('src')).toBeNull()
    expect(hud.bossPortrait.getAttribute('alt')).toBe('보스 초상화')
  })

  it('keeps an unselected HUD fallback and distinguishes all three vows by color, glyph, and label', () => {
    const hud = new Hud(makeRoot())
    hud.update(hudFixture())
    expect(hud.dao.hidden).toBe(true)
    expect(hud.dao.style.display).toBe('none')
    expect(hud.dao.getAttribute('aria-label')).toBe('맹세 미선택')

    const identities = []
    for (const vowId of ['sword', 'frost', 'spirit']) {
      const snapshot = new DaoVows2D({ vowId }).snapshot()
      hud.update(hudFixture(snapshot))
      identities.push({
        color: hud.dao.style['--dao-primary'],
        glyph: hud.daoGlyph.textContent,
        label: hud.daoLabel.textContent,
      })
      expect(hud.dao.hidden).toBe(false)
      expect(hud.dao.dataset.daoIdentity).toBe(`dao-${vowId}`)
      expect(hud.dao.dataset.daoVfx).toBe(snapshot.presentation.activeVfx)
      expect(hud.dao.getAttribute('aria-label')).toContain('맹세')
    }

    expect(new Set(identities.map((entry) => entry.color)).size).toBe(3)
    expect(new Set(identities.map((entry) => entry.glyph)).size).toBe(3)
    expect(new Set(identities.map((entry) => entry.label)).size).toBe(3)
  })

  it('passes Dao palette, VFX identity, glyph, and accessible label into pledge cards', () => {
    const modal = new LevelUpModal(makeRoot())
    const model = new DaoVows2D()
    const choices = model.availableSelections('pledge').map((option, index) => ({
      kind: 'dao', id: option.id, name: option.name,
      desc: option.description, step: `맹세 · ${index + 1}`,
      iconId: option.id === 'sword' ? 'flyingSword' : option.id === 'frost' ? 'frostPalm' : 'thunderOrb',
      daoPresentation: {
        vowId: option.id, name: option.name, hanja: option.hanja,
        palette: option.palette, vfx: option.vfx,
        activeVfx: option.milestones[0].options[0].vfx,
      },
    }))

    modal.open(choices, () => {}, { variant: 'dao', actions: false })
    const cards = [...modal.cardsHost.children]
    expect(cards).toHaveLength(3)
    expect(new Set(cards.map((card) => card.dataset.daoIdentity)).size).toBe(3)
    expect(new Set(cards.map((card) => card.dataset.daoVfx)).size).toBe(3)
    expect(new Set(cards.map((card) => card.dataset.daoGlyph)).size).toBe(3)
    for (const card of cards) {
      expect(card.getAttribute('aria-label')).toContain('선택')
      expect(card.innerHTML).toContain(card.dataset.daoGlyph)
      expect(card.querySelector('.modal-dao-label')).not.toBeNull()
      expect(card.style['--dao-primary']).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('renders the selected Dao and active VFX in the result, while keeping no-selection fallback empty', () => {
    const screen = new ResultScreen(makeRoot())
    const model = new DaoVows2D({ vowId: 'spirit' })
    model.select('deepening', 'purifying-heart')
    model.select('completion', 'shadow-copy')
    const snapshot = model.snapshot()
    screen.show({ ...resultFixture(), daoVow: snapshot }, { onRestart() {} })

    const dao = screen.node.querySelector('.result-dao')
    expect(dao).not.toBeNull()
    expect(dao.dataset.daoIdentity).toBe('dao-spirit')
    expect(dao.dataset.daoVfx).toBe(snapshot.presentation.activeVfx)
    expect(screen.node.innerHTML).toContain('심')
    expect(screen.node.innerHTML).not.toMatch(/[\u3400-\u9fff]/u)
    expect(dao.getAttribute('aria-label')).toContain('심맥')
    expect(dao.getAttribute('aria-label')).toContain('이번 생의 도')
    expect(dao.style['--dao-primary']).toBe('#9d71e8')

    screen.show({ ...resultFixture(), daoVow: null }, { onRestart() {} })
    expect(screen.node.querySelector('.result-dao')).toBeNull()
  })

  it('keeps optional objective and Dao gauge surfaces hidden for legacy snapshots', () => {
    const hud = new Hud(makeRoot())
    hud.update(hudFixture())
    expect(hud.objective.hidden).toBe(true)
    expect(hud.daoGauge.hidden).toBe(true)

    hud.update({
      ...hudFixture(),
      firstVowObjective: '영맥 제단을 찾으십시오',
      daoRuntime: { gauge: 2, gaugeMax: 3 },
    })
    expect(hud.objective.hidden).toBe(false)
    expect(hud.objective.textContent).toContain('영맥 제단')
    expect(hud.daoGauge.hidden).toBe(false)
    expect(hud.daoGauge.textContent).toContain('2/3')
  })
})

function makeShopProgress() {
  return {
    stones: 100,
    buyUpgrade: vi.fn(() => true),
    unlock: vi.fn(() => true),
    levelOf: vi.fn(() => 0),
    isMaxed: vi.fn(() => false),
    costOf: vi.fn(() => 10),
    canAfford: vi.fn(() => true),
    isUnlocked: vi.fn(() => false),
    canAffordUnlock: vi.fn(() => true),
  }
}

function makeCodexProgress() {
  return {
    achievements: [],
    records: {},
    state: { journey: { decisions: {} } },
    hasSeen: vi.fn(() => false),
  }
}

describe('bounded ledger input ownership', () => {
  it('focuses the shop tab, roves through enabled cards, activates purchase, and closes from back', () => {
    const progress = makeShopProgress()
    let closed = 0
    const screen = new ShopScreen(makeRoot(), progress, vi.fn())
    screen.show(() => { closed++ })

    expect(globalThis.document.activeElement).toBe(screen.tabs[0])
    expect(screen.node.innerHTML).toContain('검가로 돌아간다')
    screen.handleKey(false, 0, 1)
    expect(globalThis.document.activeElement).toBe(screen.rows[0].row)

    screen.handleKey(true)
    expect(progress.buyUpgrade).toHaveBeenCalledWith(screen.rows[0].up.id)

    screen.handleKey(false, 0, -1)
    expect(globalThis.document.activeElement).toBe(screen.tabs[0])
    screen.handleKey(false, 0, -1)
    expect(globalThis.document.activeElement).toBe(screen.backButton)
    screen.handleKey(true)
    expect(closed).toBe(1)
    expect(screen.isOpen).toBe(false)
  })

  it('gives Codex tabs and panes an explicit ARIA relationship and roves entries', () => {
    const screen = new CodexScreen(makeRoot(), makeCodexProgress())
    screen.show(() => {})

    const tab = screen.tabs[0]
    const pane = screen.panes[0]
    expect(globalThis.document.activeElement).toBe(tab)
    expect(screen.node.innerHTML).toContain('검가로 돌아간다')
    expect(tab.getAttribute('aria-controls')).toBe(pane.getAttribute('id'))
    expect(pane.getAttribute('aria-labelledby')).toBe(tab.getAttribute('id'))

    screen.handleKey(false, 1)
    expect(screen.activeTab).toBe('enemies')
    expect(globalThis.document.activeElement).toBe(screen.tabs[1])
    screen.handleKey(false, 0, 1)
    const firstEnemy = screen.entries.find((entry) => entry.kind === 'enemies')
    expect(globalThis.document.activeElement).toBe(firstEnemy.cell)
    screen.handleKey(true)
    expect(screen.detail.innerHTML).toContain('아직 만나지 못했다')
    screen.handleKey(false, 0, -1)
    expect(globalThis.document.activeElement).toBe(screen.tabs[1])
    screen.handleKey(false, 0, -1)
    expect(globalThis.document.activeElement).toBe(screen.backButton)
    screen.handleKey(true)
    expect(screen.isOpen).toBe(false)
  })
})

describe('PauseScreen input ownership', () => {
  it('focuses resume, routes direction/confirm, and requires two confirmations to quit', () => {
    const resumed = vi.fn()
    const quit = vi.fn()
    const quality = { mode: '자동', cycle: vi.fn(() => '높음') }
    const screen = new PauseScreen(makeRoot(), {
      audio: { playUiCue: vi.fn() }, quality, onResume: resumed, onQuit: quit,
    })
    screen.show({ runTime: 12, level: 2, kills: 3, stones: 4 }, { weapons: {}, passives: {} })

    expect(globalThis.document.activeElement).toBe(screen.resumeButton)
    expect(screen.node.innerHTML).toContain('검가로 돌아간다')
    screen.handleKey(false, 1)
    expect(globalThis.document.activeElement).toBe(screen.qualityButton)
    screen.handleKey(true)
    expect(quality.cycle).toHaveBeenCalledTimes(1)
    screen.handleKey(false, 1)
    expect(globalThis.document.activeElement).toBe(screen.quitButton)
    screen.handleKey(true)
    expect(quit).not.toHaveBeenCalled()
    expect(screen.quitButton.textContent).toBe('정말 검가로 돌아가는가?')
    screen.handleKey(true)
    expect(quit).toHaveBeenCalledTimes(1)
    expect(resumed).not.toHaveBeenCalled()
  })
})

afterAll(() => {
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
})
