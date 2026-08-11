/**
 * The contest run's Dao choice is deliberately a small domain model instead
 * of a renderer or a combat-world singleton.  A run can therefore be replayed
 * from its three choices and every consumer (CombatWorld2D, HUD and the boss
 * presentation) receives the same deterministic answer.
 *
 * Product promise: `네가 고른 도가, 네가 싸울 마존을 만든다.`
 */

export const DAO_VOW_VERSION_2D = 1
export const DAO_VOW_MODEL_VERSION_2D = DAO_VOW_VERSION_2D
export const DAO_VOW_CONCEPT_2D = '네가 고른 도가, 네가 싸울 마존을 만든다.'
export const DAO_VOW_BOSS_ID_2D = 'jadeVoidWarden'
export const DAO_VOW_BOSS_NAME_2D = '옥허진장'

export const DAO_VOW_ID_2D = Object.freeze({
  sword: 'sword',
  frost: 'frost',
  spirit: 'spirit',
})

// Short aliases are useful to callers that already use the data-module naming
// convention.  They intentionally point at the same immutable values.
export const DAO_VOW_IDS_2D = Object.freeze(Object.values(DAO_VOW_ID_2D))
export const DAO_VOW_IDS = DAO_VOW_IDS_2D

export const DAO_PLEDGE_MILESTONE_2D = Object.freeze({
  pledge: 'pledge',
  deepening: 'deepening',
  completion: 'completion',
})

export const DAO_PLEDGE_MILESTONES_2D = Object.freeze([
  Object.freeze({
    id: DAO_PLEDGE_MILESTONE_2D.pledge,
    index: 0,
    stage: 1,
    name: '맹세',
    description: '따를 도를 고르고 첫 발동을 연다.',
  }),
  Object.freeze({
    id: DAO_PLEDGE_MILESTONE_2D.deepening,
    index: 1,
    stage: 2,
    name: '심화',
    description: '고른 도의 공격과 움직임을 한 겹 더 깊게 한다.',
  }),
  Object.freeze({
    id: DAO_PLEDGE_MILESTONE_2D.completion,
    index: 2,
    stage: 3,
    name: '완성',
    description: '고른 도를 완성해 마지막 마존의 거울을 세운다.',
  }),
])
export const PLEDGE_MILESTONES_2D = DAO_PLEDGE_MILESTONES_2D
export const PLEDGE_MILESTONES = DAO_PLEDGE_MILESTONES_2D

const MILESTONE_IDS = DAO_PLEDGE_MILESTONES_2D.map(({ id }) => id)
const MILESTONE_INDEX = new Map(MILESTONE_IDS.map((id, index) => [id, index]))

const VOW_ALIASES = new Map([
  ['sword', 'sword'], ['검맥', 'sword'], ['劍脈', 'sword'],
  ['frost', 'frost'], ['설맥', 'frost'], ['雪脈', 'frost'],
  ['spirit', 'spirit'], ['심맥', 'spirit'], ['心脈', 'spirit'],
])

const MILESTONE_ALIASES = new Map([
  ['pledge', 'pledge'], ['vow', 'pledge'], ['basic', 'pledge'], ['맹세', 'pledge'],
  ['deepening', 'deepening'], ['enhancement', 'deepening'], ['deepen', 'deepening'], ['심화', 'deepening'],
  ['completion', 'completion'], ['mastery', 'completion'], ['complete', 'completion'], ['완성', 'completion'],
])

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function cloneJson(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(cloneJson)
  const copy = {}
  for (const [key, child] of Object.entries(value)) copy[key] = cloneJson(child)
  return copy
}

function normalizedString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function canonicalVowId(value) {
  if (typeof value !== 'string') return null
  const exact = value.trim()
  return VOW_ALIASES.get(exact) ?? VOW_ALIASES.get(exact.toLowerCase()) ?? null
}

function canonicalMilestoneId(value) {
  if (Number.isInteger(value) && value >= 0 && value < MILESTONE_IDS.length) return MILESTONE_IDS[value]
  if (typeof value !== 'string') return null
  const exact = value.trim()
  return MILESTONE_ALIASES.get(exact) ?? MILESTONE_ALIASES.get(exact.toLowerCase()) ?? null
}

function canonicalOptionId(value) {
  if (typeof value !== 'string') return null
  const exact = value.trim()
  const lower = exact.toLowerCase()
  const aliases = {
    // Sword deepening choices
    '관통검선': 'piercing-edge',
    '관통': 'piercing-edge',
    'pierce': 'piercing-edge',
    'piercing': 'piercing-edge',
    'piercing-edge': 'piercing-edge',
    '회귀검선': 'returning-edge',
    '되돌이검선': 'returning-edge',
    '되돌이': 'returning-edge',
    'return': 'returning-edge',
    'returning': 'returning-edge',
    'returning-edge': 'returning-edge',
    // Frost deepening choices
    '빙결파편': 'frost-shards',
    '냉기파편': 'frost-shards',
    '파편': 'frost-shards',
    'shards': 'frost-shards',
    'frost-shards': 'frost-shards',
    '빙결선': 'frost-line',
    '빙선': 'frost-line',
    'frost-line': 'frost-line',
    // Spirit deepening choices
    '심화정화': 'purifying-heart',
    '정화': 'purifying-heart',
    'purge': 'purifying-heart',
    'purifying-heart': 'purifying-heart',
    '심마공명': 'echoing-heart',
    '공명': 'echoing-heart',
    'echo': 'echoing-heart',
    'echoing-heart': 'echoing-heart',
    // Completion choices
    '검환': 'sword-ring',
    'sword-ring': 'sword-ring',
    '얼음벽': 'ice-wall',
    '빙벽': 'ice-wall',
    'ice-wall': 'ice-wall',
    '심마그림자': 'shadow-copy',
    '그림자': 'shadow-copy',
    'shadow-copy': 'shadow-copy',
  }
  return aliases[exact] ?? aliases[lower] ?? exact
}

function colorSet(primary, secondary, accent, boss) {
  return { primary, secondary, accent, boss }
}

function vfxSet(select, pledge, deepening, completion) {
  return {
    select,
    pledge,
    deepening,
    completion,
    soundCue: `${select}-cue`,
  }
}

function mirrorPhase({ id, name, description, telegraph, safeSpace, impact, vfx, color, choiceId }) {
  return {
    id,
    patternId: id,
    name,
    description,
    telegraph,
    safeSpace,
    impact,
    vfx,
    color,
    choiceId,
  }
}

// These are deltas, not a second source of truth for player stats.  The model
// folds them in order and exposes the resulting flat values in
// getCombatModifiers2D(), including a `stats` view whose names match the
// fields consumed by CombatWorld2D's PlayerState2D.
const RAW_VOW_DEFINITIONS = {
  sword: {
    id: 'sword',
    key: 'sword',
    name: '검맥',
    hanja: '劍脈',
    title: '움직임을 검비로 바꾸는 도',
    description: '계속 움직이면 다음 비검이 검비가 되어 전장을 가른다.',
    shortDescription: '움직이면 다음 비검이 검비가 된다.',
    fantasy: '멈춰서 안전을 얻는 대신, 움직임으로 화력을 준비한다.',
    icon: 'sword',
    palette: colorSet(0xeaf6ff, 0x6f9fda, 0xffffff, 0x8abfff),
    vfx: vfxSet('dao-sword', 'sword-fan', 'returning-sword-line', 'closing-sword-ring'),
    milestones: [
      {
        id: 'pledge',
        name: '맹세',
        description: '연속 이동 뒤 다음 비검을 검비 부채로 바꾼다.',
        options: [
          {
            id: 'sword',
            name: '검맥',
            description: '일정 시간 움직인 뒤 다음 비검이 넓은 검비가 된다.',
            vfx: 'sword-fan',
            modifiers: {
              moveSpeedMultiplier: 1.1,
              damageMultiplier: 1.08,
              maxHpMultiplier: 1.15,
              regenAdd: 0.2,
              swordChargeSeconds: 0.65,
              swordFanProjectileAdd: 3,
              swordFanSpreadAdd: 0.18,
            },
            mirror: mirrorPhase({
              id: 'straight-sword-rain',
              name: '직선 검우',
              description: '움직임을 좇아 곧게 떨어지는 검의 비.',
              telegraph: '은백색 직선이 먼저 바닥에 선다.',
              safeSpace: '검선과 검선 사이의 빈 칸.',
              impact: '직선 검비가 짧게 이어진다.',
              vfx: 'mirror-straight-sword-rain',
              color: 0xeaf6ff,
              choiceId: 'sword',
            }),
          },
        ],
      },
      {
        id: 'deepening',
        name: '심화',
        description: '비검을 한 번 더 관통시키거나 되돌려 두 번째 타격을 만든다.',
        options: [
          {
            id: 'returning-edge',
            name: '회귀검선',
            description: '검비가 되돌아와 두 번째 타격을 만든다.',
            vfx: 'returning-sword-line',
            modifiers: {
              projectilePierceAdd: 1,
              swordReturnHitsAdd: 1,
              swordReturnDelay: 0.26,
              damageMultiplier: 1.12,
              maxHpMultiplier: 1.08,
              regenAdd: 0.1,
            },
            mirror: mirrorPhase({
              id: 'returning-sword-line',
              name: '되돌아오는 검선',
              description: '첫 검선이 사라진 뒤 같은 선이 역행한다.',
              telegraph: '희미한 은선이 먼저 지나간 자리에 남는다.',
              safeSpace: '검선의 뒤쪽과 양옆.',
              impact: '되돌아오는 검선이 두 번째로 베어낸다.',
              vfx: 'mirror-returning-sword-line',
              color: 0x9dcfff,
              choiceId: 'returning-edge',
            }),
          },
          {
            id: 'piercing-edge',
            name: '관통검선',
            description: '비검이 적을 한 겹 더 꿰뚫고 나간다.',
            vfx: 'piercing-sword-line',
            modifiers: {
              projectilePierceAdd: 2,
              swordFanSpreadAdd: 0.08,
              damageMultiplier: 1.1,
              maxHpMultiplier: 1.08,
              regenAdd: 0.1,
            },
            mirror: mirrorPhase({
              id: 'piercing-sword-cross',
              name: '교차 관통선',
              description: '두 겹의 검선이 교차해 도망칠 틈을 줄인다.',
              telegraph: '청색 십자가 두 줄이 짧게 번뜩인다.',
              safeSpace: '교차점 바깥의 사선 공간.',
              impact: '교차 검선이 연속 관통한다.',
              vfx: 'mirror-piercing-sword-cross',
              color: 0x8fbaf4,
              choiceId: 'piercing-edge',
            }),
          },
        ],
      },
      {
        id: 'completion',
        name: '완성',
        description: '축지법이 끝난 자리에 접근한 적을 밀어내는 검환을 남긴다.',
        options: [
          {
            id: 'sword-ring',
            name: '검환 완성',
            description: '축지법 종료 지점에 짧은 검환을 피워 적을 밀어낸다.',
            vfx: 'closing-sword-ring',
            modifiers: {
              dashCooldownMultiplier: 0.94,
              dashDistanceMultiplier: 1.08,
              dashIFramesAdd: 0.12,
              swordRingEnabled: true,
              swordRingRadius: 4.2,
              swordRingPush: 8,
              swordRingDuration: 0.45,
              maxHpMultiplier: 1.05,
              regenAdd: 0.08,
            },
            mirror: mirrorPhase({
              id: 'closing-sword-ring',
              name: '닫히는 검환',
              description: '마존 주위의 검환이 안쪽으로 닫힌다.',
              telegraph: '은백색 고리 세 겹이 바닥에 번진다.',
              safeSpace: '고리가 닫히기 전 바깥쪽 빈 공간.',
              impact: '닫힌 검환이 중심을 밀어내며 베어낸다.',
              vfx: 'mirror-closing-sword-ring',
              color: 0xd8edff,
              choiceId: 'sword-ring',
            }),
          },
        ],
      },
    ],
  },
  frost: {
    id: 'frost',
    key: 'frost',
    name: '설맥',
    hanja: '雪脈',
    title: '축지법으로 전장을 얼리는 도',
    description: '축지법이 지나간 자리에 빙결 진을 남겨 전장을 설계한다.',
    shortDescription: '축지법이 지나간 자리에 빙결 진을 남긴다.',
    fantasy: '대시는 단순한 회피가 아니라 다음 이동 경로를 그리는 기술이 된다.',
    // Keep the source presentation on the same semantic id used by the active
    // Pixi choice cards. `snowflake` was a retired alias with no icon asset.
    icon: 'frost',
    palette: colorSet(0xb8efff, 0xeffbff, 0x73cfff, 0x9ee8ff),
    vfx: vfxSet('dao-frost', 'frost-field', 'frost-shards', 'ice-wall'),
    milestones: [
      {
        id: 'pledge',
        name: '맹세',
        description: '축지법의 출발과 도착에 짧은 빙결 진을 남긴다.',
        options: [
          {
            id: 'frost',
            name: '설맥',
            description: '축지법이 출발한 곳과 도착한 곳에 넓은 빙결 진이 생기고 냉기가 기혈을 보호한다.',
            vfx: 'frost-field',
            modifiers: {
              dashCooldownMultiplier: 0.88,
              moveSpeedMultiplier: 1.05,
              damageMultiplier: 1.1,
              maxHpMultiplier: 1.14,
              regenAdd: 0.18,
              frostFieldCountAdd: 2,
              frostFieldRadius: 3.3,
              frostFieldDuration: 3,
              frostSlowMultiplier: 0.6,
              frostFieldDamageMultiplier: 2.2,
            },
            mirror: mirrorPhase({
              id: 'radial-frost-ring',
              name: '방사형 냉기 고리',
              description: '마존의 발밑에서 냉기 고리가 방사된다.',
              telegraph: '빙청색 원이 세 겹으로 차오른다.',
              safeSpace: '고리와 고리 사이의 빈 틈.',
              impact: '냉기 고리가 바깥으로 퍼지며 늦춘다.',
              vfx: 'mirror-radial-frost-ring',
              color: 0xb8efff,
              choiceId: 'frost',
            }),
          },
        ],
      },
      {
        id: 'deepening',
        name: '심화',
        description: '빙결 진의 둔화를 깊게 하거나 쓰러진 적에게 냉기 파편을 남긴다.',
        options: [
          {
            id: 'frost-shards',
            name: '냉기 파편',
            description: '빙결 상태의 적이 쓰러지면 작은 냉기 파편을 흩뿌린다.',
            vfx: 'frost-shards',
            modifiers: {
              frostFieldDuration: 0.8,
              frostSlowMultiplier: 0.54,
              frostFieldRadius: 0.5,
              frostFieldDamageMultiplier: 1.25,
              frostShardCountAdd: 3,
              frostShardRadius: 1.25,
            },
            mirror: mirrorPhase({
              id: 'chain-frost-mines',
              name: '연쇄 빙결 지뢰',
              description: '빙결 표식이 이어져 다음 발밑으로 번진다.',
              telegraph: '작은 백색 결정이 순서대로 켜진다.',
              safeSpace: '아직 결정이 켜지지 않은 칸.',
              impact: '결정이 터지며 다음 지뢰를 얼린다.',
              vfx: 'mirror-chain-frost-mines',
              color: 0x8bdfff,
              choiceId: 'frost-shards',
            }),
          },
          {
            id: 'frost-line',
            name: '절단 빙선',
            description: '빙결 진을 잇는 차가운 선이 적의 이동을 끊는다.',
            vfx: 'frost-line',
            modifiers: {
              frostFieldDuration: 1.1,
              frostSlowMultiplier: 0.48,
              frostFieldRadius: 0.5,
              frostFieldDamageMultiplier: 1.25,
              frostWallPairDistance: 4.8,
            },
            mirror: mirrorPhase({
              id: 'cutting-ice-line',
              name: '이동을 자르는 빙선',
              description: '플레이어의 다음 경로를 가로지르는 빙선.',
              telegraph: '백색 선이 이동 예상 지점에 그어진다.',
              safeSpace: '빙선의 양끝 바깥.',
              impact: '빙선이 솟아 이동 경로를 자른다.',
              vfx: 'mirror-cutting-ice-line',
              color: 0x97e8ff,
              choiceId: 'frost-line',
            }),
          },
        ],
      },
      {
        id: 'completion',
        name: '완성',
        description: '가까운 두 빙결 진을 이어 잠깐의 얼음 벽과 안전 통로를 만든다.',
        options: [
          {
            id: 'ice-wall',
            name: '빙벽 완성',
            description: '가까운 빙결 진 두 개가 짧은 얼음 벽으로 이어진다.',
            vfx: 'ice-wall',
            modifiers: {
              frostWallEnabled: true,
              frostWallPairDistance: 4.2,
              frostWallDuration: 1.6,
              frostFieldDuration: 0.7,
              frostFieldDamageMultiplier: 1.15,
              maxHpMultiplier: 1.08,
              regenAdd: 0.12,
            },
            mirror: mirrorPhase({
              id: 'chain-frost-mines',
              name: '연쇄 빙결 지뢰',
              description: '얼음 벽의 파편이 연쇄 지뢰가 되어 전장을 닫는다.',
              telegraph: '빙벽 양끝에 작은 냉기 핵이 생긴다.',
              safeSpace: '아직 연결되지 않은 통로.',
              impact: '파편이 연쇄되며 빙결 지뢰가 된다.',
              vfx: 'mirror-chain-frost-mines-final',
              color: 0xc8f5ff,
              choiceId: 'ice-wall',
            }),
          },
        ],
      },
    ],
  },
  spirit: {
    id: 'spirit',
    key: 'spirit',
    name: '심맥',
    hanja: '心脈',
    title: '영기를 힘과 심마 사이에서 고르는 도',
    description: '영기 구슬을 잇달아 거두어 과충전하고, 그 힘의 대가까지 끌어안는다.',
    shortDescription: '영기 회수 연쇄가 과충전과 심마를 부른다.',
    fantasy: '안전하게 조금씩 강해질지, 위험을 감수하고 구슬을 몰아칠지 선택한다.',
    icon: 'spirit',
    palette: colorSet(0x9d71e8, 0xffd66b, 0xf3b8ff, 0xc98cff),
    vfx: vfxSet('dao-spirit', 'spirit-overcharge', 'spirit-purge', 'shadow-copy'),
    milestones: [
      {
        id: 'pledge',
        name: '맹세',
        description: '영기 회수 연쇄로 심맥 게이지를 채우고 과충전한다.',
        options: [
          {
            id: 'spirit',
            name: '심맥',
            description: '영기 구슬을 회수할 때 심맥 파동이 번지고, 연속 회수하면 과충전된다.',
            vfx: 'spirit-overcharge',
            modifiers: {
              spiritGaugeEnabled: true,
              spiritGaugeGainAdd: 18,
              spiritOverchargeDuration: 3.8,
              spiritOverchargeAttackDensityMultiplier: 1.35,
              spiritOverchargeMagnetMultiplier: 1.4,
              spiritPickupPulseEnabled: true,
              spiritPickupPulseDamage: 12,
              spiritPickupPulseRadius: 3.5,
              magnetMultiplier: 1.25,
              moveSpeedMultiplier: 1.05,
              damageMultiplier: 1.1,
              maxHpMultiplier: 1.12,
              regenAdd: 0.16,
            },
            mirror: mirrorPhase({
              id: 'violet-orb-barrage',
              name: '자주색 구체 탄막',
              description: '마존의 심마가 자주색 구체를 사방으로 쏟아낸다.',
              telegraph: '금빛 심핵이 먼저 세 번 맥박친다.',
              safeSpace: '구체의 회전 사이에 열린 부채꼴.',
              impact: '자주색 구체 탄막이 짧은 간격으로 겹친다.',
              vfx: 'mirror-violet-orb-barrage',
              color: 0xc88cff,
              choiceId: 'spirit',
            }),
          },
        ],
      },
      {
        id: 'deepening',
        name: '심화',
        description: '과충전 중 축지법을 심화정화하거나 다음 공격의 공명을 준비한다.',
        options: [
          {
            id: 'purifying-heart',
            name: '심화정화',
            description: '과충전 중 축지법을 쓰면 게이지를 소모해 주변을 정화한다.',
            vfx: 'spirit-purge',
            modifiers: {
              spiritPurgeEnabled: true,
              spiritPurgeRadius: 4.5,
              spiritPurgeGaugeCost: 40,
              spiritOverchargeDuration: 0.8,
              spiritPickupPulseDamage: 4,
              spiritPickupPulseRadius: 1,
              damageMultiplier: 1.05,
            },
            mirror: mirrorPhase({
              id: 'tracking-shadow-double',
              name: '추적 그림자 분신',
              description: '설령의 이동을 좇는 그림자 분신이 늦게 겹친다.',
              telegraph: '플레이어의 지난 발자국에 자주색 잔상이 선다.',
              safeSpace: '잔상이 생기지 않은 쪽으로 한 번 더 이동한다.',
              impact: '그림자 분신이 지난 이동선을 따라 베어낸다.',
              vfx: 'mirror-tracking-shadow-double',
              color: 0xa67aff,
              choiceId: 'purifying-heart',
            }),
          },
          {
            id: 'echoing-heart',
            name: '심마공명',
            description: '과충전 중 다음 공격에 심마의 공명을 겹치고 기혈을 단단히 붙든다.',
            vfx: 'spirit-echo',
            modifiers: {
              spiritOverchargeAttackDensityMultiplier: 1.35,
              spiritGaugeGainAdd: 4,
              spiritAttackCopyEnabled: true,
              spiritShadowCountAdd: 1,
              spiritPickupPulseDamage: 10,
              spiritPickupPulseRadius: 0.8,
              damageMultiplier: 1.08,
              maxHpMultiplier: 1.15,
              regenAdd: 0.3,
            },
            mirror: mirrorPhase({
              id: 'tracking-shadow-double',
              name: '추적 그림자 분신',
              description: '설령의 이동을 좇는 그림자 분신이 늦게 겹친다.',
              telegraph: '플레이어의 지난 발자국에 자주색 잔상이 선다.',
              safeSpace: '잔상이 생기지 않은 쪽으로 한 번 더 이동한다.',
              impact: '그림자 분신이 지난 이동선을 따라 베어낸다.',
              vfx: 'mirror-tracking-shadow-double',
              color: 0xa67aff,
              choiceId: 'echoing-heart',
            }),
          },
        ],
      },
      {
        id: 'completion',
        name: '완성',
        description: '과충전이 끝날 때 심마 그림자가 나타나 적을 끌거나 공격을 복제한다.',
        options: [
          {
            id: 'shadow-copy',
            name: '심마 그림자',
            description: '과충전 종료 순간 그림자가 적을 끌어당기고 다음 공격을 복제한다.',
            vfx: 'shadow-copy',
            modifiers: {
              spiritShadowEnabled: true,
              spiritShadowCountAdd: 1,
              spiritShadowPull: 4,
              spiritAttackCopyEnabled: true,
              spiritOverchargeAttackDensityMultiplier: 1.1,
              spiritPickupPulseDamage: 4,
              spiritPickupPulseRadius: 0.5,
              maxHpMultiplier: 1.08,
              regenAdd: 0.12,
            },
            mirror: mirrorPhase({
              id: 'shadow-summon-overcharge',
              name: '그림자 소환과 과충전 폭발',
              description: '그림자 소환이 과충전 폭발과 함께 겹쳐진다.',
              telegraph: '보스 뒤에 심마의 두 눈과 금빛 핵이 열린다.',
              safeSpace: '그림자와 폭발 핵 사이의 좁은 틈.',
              impact: '그림자가 적을 끌어당긴 뒤 과충전이 폭발한다.',
              vfx: 'mirror-shadow-summon-overcharge',
              color: 0xffcb70,
              choiceId: 'shadow-copy',
            }),
          },
        ],
      },
    ],
  },
}

export const DAO_VOW_DEFINITIONS_2D = deepFreeze(RAW_VOW_DEFINITIONS)
export const DAO_VOWS_2D = DAO_VOW_DEFINITIONS_2D
export const DAO_VOW_DEFINITIONS = DAO_VOW_DEFINITIONS_2D
export const VOW_DEFINITIONS_2D = DAO_VOW_DEFINITIONS_2D
export const DAO_VOW_LIST_2D = Object.freeze(DAO_VOW_IDS_2D.map((id) => DAO_VOW_DEFINITIONS_2D[id]))
export const DAO_VOWS_LIST_2D = DAO_VOW_LIST_2D

const DEFAULT_COMBAT_MODIFIERS = Object.freeze({
  // CombatWorld2D stat-compatible multipliers/addends.
  moveSpeedMultiplier: 1,
  damageMultiplier: 1,
  areaMultiplier: 1,
  cooldownMultiplier: 1,
  projectileSpeedMultiplier: 1,
  durationMultiplier: 1,
  magnetMultiplier: 1,
  maxHpMultiplier: 1,
  regenAdd: 0,
  amountAdd: 0,

  // Cross-cutting action modifiers.
  projectileCountAdd: 0,
  projectilePierceAdd: 0,
  dashCooldownMultiplier: 1,
  dashDistanceMultiplier: 1,
  dashIFramesAdd: 0,

  // Sword vow.
  swordChargeSeconds: 0,
  swordFanProjectileAdd: 0,
  swordFanSpreadAdd: 0,
  swordReturnHitsAdd: 0,
  swordReturnDelay: 0,
  swordRingEnabled: false,
  swordRingRadius: 0,
  swordRingPush: 0,
  swordRingDuration: 0,

  // Frost vow.
  frostFieldCountAdd: 0,
  frostFieldRadius: 0,
  frostFieldDuration: 0,
  frostSlowMultiplier: 1,
  frostShardCountAdd: 0,
  frostShardRadius: 0,
  frostWallEnabled: false,
  frostWallPairDistance: 0,
  frostWallDuration: 0,
  frostFieldDamageMultiplier: 1,

  // Spirit vow.
  spiritGaugeEnabled: false,
  spiritGaugeMaxAdd: 0,
  spiritGaugeGainAdd: 0,
  spiritOverchargeDuration: 0,
  spiritOverchargeAttackDensityMultiplier: 1,
  spiritOverchargeMagnetMultiplier: 1,
  spiritPurgeEnabled: false,
  spiritPurgeRadius: 0,
  spiritPurgeGaugeCost: 0,
  spiritShadowEnabled: false,
  spiritShadowCountAdd: 0,
  spiritShadowPull: 0,
  spiritAttackCopyEnabled: false,
  spiritPickupPulseEnabled: false,
  spiritPickupPulseDamage: 0,
  spiritPickupPulseRadius: 0,
})

const MULTIPLIER_FIELDS = new Set([
  'moveSpeedMultiplier', 'damageMultiplier', 'areaMultiplier', 'cooldownMultiplier',
  'projectileSpeedMultiplier', 'durationMultiplier', 'magnetMultiplier', 'maxHpMultiplier',
  'dashCooldownMultiplier', 'dashDistanceMultiplier', 'frostSlowMultiplier',
  'frostFieldDamageMultiplier',
  'spiritOverchargeAttackDensityMultiplier', 'spiritOverchargeMagnetMultiplier',
])

function optionFor(vow, milestoneId, choiceId = null) {
  const stage = vow?.milestones?.find((entry) => entry.id === milestoneId)
  if (!stage) return null
  const options = stage.options ?? []
  if (choiceId == null) return options[0] ?? null
  const canonical = milestoneId === 'pledge' ? choiceId : canonicalOptionId(choiceId)
  return options.find((entry) => entry.id === canonical) ?? null
}

function stageChoiceIds(vowId, choices) {
  if (!vowId) return []
  const vow = DAO_VOW_DEFINITIONS_2D[vowId]
  return MILESTONE_IDS
    .map((milestoneId) => choices[milestoneId])
    .filter((choiceId, index) => choiceId != null && optionFor(vow, MILESTONE_IDS[index], choiceId))
}

function currentMilestoneIndex(choices) {
  let index = 0
  for (const milestoneId of MILESTONE_IDS) {
    if (choices[milestoneId] == null) break
    index++
  }
  return index
}

function selectedOptions(vowId, choices) {
  if (!vowId) return []
  const vow = DAO_VOW_DEFINITIONS_2D[vowId]
  return MILESTONE_IDS
    .map((milestoneId) => choices[milestoneId] == null
      ? null
      : optionFor(vow, milestoneId, choices[milestoneId]))
    .filter(Boolean)
}

function foldModifiers(vowId, choices) {
  const output = { ...DEFAULT_COMBAT_MODIFIERS }
  for (const option of selectedOptions(vowId, choices)) {
    for (const [key, rawValue] of Object.entries(option.modifiers ?? {})) {
      if (MULTIPLIER_FIELDS.has(key)) output[key] *= rawValue
      else if (typeof output[key] === 'boolean') output[key] ||= Boolean(rawValue)
      else if (Number.isFinite(rawValue)) output[key] = (output[key] ?? 0) + rawValue
    }
  }

  // CombatWorld2D can apply this view to PlayerState2D.stats without knowing
  // anything about the individual Dao.  The full flat object remains available
  // for bespoke sword/frost/spirit mechanics.
  output.stats = {
    maxHp: output.maxHpMultiplier,
    moveSpeed: output.moveSpeedMultiplier,
    might: output.damageMultiplier,
    area: output.areaMultiplier,
    cooldown: output.cooldownMultiplier,
    speedProj: output.projectileSpeedMultiplier,
    duration: output.durationMultiplier,
    amount: output.amountAdd,
    magnet: output.magnetMultiplier * output.spiritOverchargeMagnetMultiplier,
    regen: output.regenAdd,
  }
  output.playerStats = { ...output.stats }
  output.combat = {
    damage: output.damageMultiplier,
    area: output.areaMultiplier,
    cooldown: output.cooldownMultiplier,
    projectileSpeed: output.projectileSpeedMultiplier,
    duration: output.durationMultiplier,
    pierceAdd: output.projectilePierceAdd,
    amountAdd: output.amountAdd,
  }
  output.movement = {
    speed: output.moveSpeedMultiplier,
    dashCooldown: output.dashCooldownMultiplier,
    dashDistance: output.dashDistanceMultiplier,
    dashIFramesAdd: output.dashIFramesAdd,
  }
  output.activeMilestones = MILESTONE_IDS.filter((id) => choices[id] != null)
  output.selectedChoices = { ...choices }
  output.vowId = vowId
  output.milestone = output.activeMilestones.length
  output.complete = output.milestone === MILESTONE_IDS.length
  return deepFreeze(output)
}

function phaseForOption(vow, milestoneId, choiceId) {
  const option = optionFor(vow, milestoneId, choiceId)
  if (!option?.mirror) return null
  const phase = MILESTONE_INDEX.get(milestoneId) + 1
  return {
    phase,
    milestone: milestoneId,
    vowId: vow.id,
    choiceId: option.id,
    id: option.mirror.id,
    patternId: option.mirror.patternId,
    name: option.mirror.name,
    description: option.mirror.description,
    telegraph: option.mirror.telegraph,
    safeSpace: option.mirror.safeSpace,
    impact: option.mirror.impact,
    vfx: option.mirror.vfx,
    color: option.mirror.color,
  }
}

function mirrorPatternForState(vowId, choices, includeUnselected = false) {
  if (!vowId || !DAO_VOW_DEFINITIONS_2D[vowId]) {
    return deepFreeze({
      bossId: DAO_VOW_BOSS_ID_2D,
      bossName: DAO_VOW_BOSS_NAME_2D,
      tagline: '네가 만든 천겁',
      vowId: null,
      vowName: null,
      phases: [],
      sequence: [],
      patternSequence: [],
      complete: false,
    })
  }
  const vow = DAO_VOW_DEFINITIONS_2D[vowId]
  const phases = MILESTONE_IDS
    .map((milestoneId) => {
      const choiceId = choices[milestoneId]
      if (choiceId == null && !includeUnselected) return null
      return phaseForOption(vow, milestoneId, choiceId)
        ?? (includeUnselected ? phaseForOption(vow, milestoneId, null) : null)
    })
    .filter(Boolean)
  const sequence = phases.map((phase) => deepFreeze(phase))
  return deepFreeze({
    bossId: DAO_VOW_BOSS_ID_2D,
    bossName: DAO_VOW_BOSS_NAME_2D,
    tagline: '네가 만든 천겁',
    vowId,
    vowName: vow.name,
    palette: cloneJson(vow.palette),
    phases: sequence,
    sequence,
    patternSequence: sequence,
    complete: phases.length === MILESTONE_IDS.length,
  })
}

function presentationForState(vowId, choices) {
  if (!vowId || !DAO_VOW_DEFINITIONS_2D[vowId]) {
    return deepFreeze({
      identity: 'dao-unselected',
      vowId: null,
      name: null,
      hanja: null,
      palette: null,
      vfx: null,
      activeVfx: null,
      milestone: 0,
    })
  }
  const vow = DAO_VOW_DEFINITIONS_2D[vowId]
  const activeMilestones = MILESTONE_IDS.filter((id) => choices[id] != null)
  const current = activeMilestones.at(-1)
  const currentOption = current ? optionFor(vow, current, choices[current]) : null
  const palette = cloneJson(vow.palette)
  const vfx = cloneJson(vow.vfx)
  return deepFreeze({
    identity: `dao-${vow.id}`,
    vowId: vow.id,
    name: vow.name,
    hanja: vow.hanja,
    icon: vow.icon,
    palette,
    colors: cloneJson(palette),
    vfx,
    activeVfx: currentOption?.vfx ?? vow.vfx.select,
    activeMilestones,
    milestone: activeMilestones.length,
  })
}

function selectionResult(valid, details = {}) {
  return deepFreeze({
    valid,
    ok: valid,
    reason: valid ? null : details.reason ?? 'invalid-selection',
    message: valid ? null : details.message ?? '선택할 수 없는 도입니다.',
    milestone: details.milestone ?? null,
    choiceId: details.choiceId ?? null,
    vowId: details.vowId ?? null,
    expectedMilestone: details.expectedMilestone ?? null,
  })
}

function candidateChoice(vowId, milestoneId, rawChoice) {
  if (milestoneId === 'pledge') {
    const choiceVow = canonicalVowId(rawChoice)
    if (!choiceVow) return null
    return { vowId: choiceVow, choiceId: choiceVow }
  }
  if (!vowId) return null
  const vow = DAO_VOW_DEFINITIONS_2D[vowId]
  let choiceId = canonicalOptionId(rawChoice)
  // A direct vow id on a later milestone is a convenient deterministic
  // shorthand: it selects the authored default option for that stage.
  if (canonicalVowId(rawChoice) === vowId) choiceId = optionFor(vow, milestoneId)?.id ?? null
  const option = optionFor(vow, milestoneId, choiceId)
  if (!option) return null
  return { vowId, choiceId: option.id }
}

function normalizeChoicesInput(input) {
  if (Array.isArray(input)) {
    return {
      pledge: input[0] ?? null,
      deepening: input[1] ?? null,
      completion: input[2] ?? null,
    }
  }
  if (input && typeof input === 'object') {
    return {
      pledge: input.pledge ?? input.vow ?? input.basic ?? input[0] ?? null,
      deepening: input.deepening ?? input.enhancement ?? input.deepen ?? input[1] ?? null,
      completion: input.completion ?? input.mastery ?? input.complete ?? input[2] ?? null,
    }
  }
  return { pledge: null, deepening: null, completion: null }
}

function parseStateInput(state) {
  if (typeof state === 'string') {
    try { return JSON.parse(state) } catch { return null }
  }
  if (state && typeof state === 'object') return state
  return null
}

function canonicalStateFromInput(state) {
  const source = parseStateInput(state)
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null
  if (source.version != null && source.version !== DAO_VOW_VERSION_2D) return null

  let rawChoices = source.choices ?? source.selections ?? source.milestones
  if (Array.isArray(source.milestones) && source.milestones.some((entry) => entry && typeof entry === 'object')) {
    const fromMilestones = {}
    for (const entry of source.milestones) {
      const id = canonicalMilestoneId(entry.id ?? entry.milestone ?? entry.key ?? entry.stage)
      if (id) fromMilestones[id] = entry.choiceId ?? entry.choice ?? entry.selected ?? null
    }
    rawChoices = fromMilestones
  }
  if (rawChoices == null) {
    rawChoices = {
      pledge: source.pledge ?? source.vowId ?? source.vow ?? null,
      deepening: source.deepening ?? source.deepeningId ?? source.deepeningChoice ?? null,
      completion: source.completion ?? source.completionId ?? source.completionChoice ?? null,
    }
  }
  const choices = normalizeChoicesInput(rawChoices)
  const requestedVow = canonicalVowId(source.vowId ?? source.vow ?? choices.pledge)
  if (choices.pledge == null && requestedVow == null) {
    return { vowId: null, choices: { pledge: null, deepening: null, completion: null } }
  }
  if (!requestedVow) return null

  const canonicalChoices = { pledge: null, deepening: null, completion: null }
  const pledge = candidateChoice(null, 'pledge', choices.pledge ?? requestedVow)
  if (!pledge || pledge.vowId !== requestedVow) return null
  canonicalChoices.pledge = pledge.choiceId
  for (const milestoneId of ['deepening', 'completion']) {
    const raw = choices[milestoneId]
    if (raw == null) break
    const choice = candidateChoice(requestedVow, milestoneId, raw)
    if (!choice) return null
    canonicalChoices[milestoneId] = choice.choiceId
  }
  // The milestones are a strictly ordered pledge.  A later persisted choice
  // without its predecessor is malformed rather than silently repaired.
  if (choices.completion != null && canonicalChoices.deepening == null) return null
  if (source.milestone != null && Number.isInteger(source.milestone)
    && source.milestone !== currentMilestoneIndex(canonicalChoices)) return null
  return { vowId: requestedVow, choices: canonicalChoices }
}

function applyState(target, canonical) {
  target._vowId = canonical.vowId
  target._choices = { ...canonical.choices }
}

/** Return the immutable authored definition for a Dao vow. */
export function getDaoVow2D(vowId) {
  const id = canonicalVowId(vowId)
  return id ? DAO_VOW_DEFINITIONS_2D[id] ?? null : null
}
export const getDaoVow = getDaoVow2D

/** Return all three definitions in their stable display order. */
export function listDaoVows2D() {
  return DAO_VOW_LIST_2D
}

/**
 * Pure validation helper.  It validates a proposed next choice against an
 * optional current state without mutating a DaoVows2D instance.
 */
export function validateDaoVowSelection2D({ milestone = 'pledge', choiceId, vowId = null, choices = null } = {}) {
  const milestoneId = canonicalMilestoneId(milestone)
  if (!milestoneId) return selectionResult(false, { reason: 'unknown-milestone', message: '알 수 없는 맹세 경지입니다.' })
  const currentVow = canonicalVowId(vowId)
  const currentChoices = normalizeChoicesInput(choices)
  const activeCount = currentMilestoneIndex(currentChoices)
  const expected = MILESTONE_IDS[activeCount] ?? null
  if (milestoneId !== expected) {
    return selectionResult(false, {
      reason: 'milestone-order',
      message: expected ? `${expected} 선택부터 진행해야 합니다.` : '맹세 경지가 이미 완성되었습니다.',
      milestone: milestoneId,
      expectedMilestone: expected,
      vowId: currentVow,
    })
  }
  const candidate = candidateChoice(currentVow, milestoneId, choiceId)
  if (!candidate) {
    return selectionResult(false, {
      reason: milestoneId === 'pledge' ? 'unknown-vow' : 'unknown-choice',
      message: milestoneId === 'pledge' ? '검맥·설맥·심맥 중 하나를 고르시오.' : '고른 도에 속한 심화·완성만 고를 수 있습니다.',
      milestone: milestoneId,
      vowId: currentVow,
    })
  }
  return selectionResult(true, {
    milestone: milestoneId,
    choiceId: candidate.choiceId,
    vowId: candidate.vowId,
    expectedMilestone: expected,
  })
}
export const validateDaoVowSelection = validateDaoVowSelection2D

/** Fold a serialized choice set into deterministic CombatWorld2D modifiers. */
export function getDaoCombatModifiers2D(vowId = null, choices = null) {
  const id = canonicalVowId(vowId)
  // A pure query with only a vow id represents the first pledge.  This makes
  // the three authored vows useful as standalone definitions while the class
  // still exposes genuinely cumulative results as later milestones are added.
  const normalized = choices == null
    ? { pledge: id, deepening: null, completion: null }
    : normalizeChoicesInput(choices)
  if (!id) return foldModifiers(null, { pledge: null, deepening: null, completion: null })
  return foldModifiers(id, normalized)
}
export const getCombatModifiers2D = getDaoCombatModifiers2D
export const combatModifiersForDaoVow2D = getDaoCombatModifiers2D

/** Build all available final-boss mirror phases for a vow. */
export function getDaoMirrorPattern2D(vowId, choices = null) {
  const id = canonicalVowId(vowId)
  const normalized = normalizeChoicesInput(choices)
  return mirrorPatternForState(id, normalized, true)
}
export const getMirrorPattern2D = getDaoMirrorPattern2D
export const finalBossMirrorForDaoVow2D = getDaoMirrorPattern2D

/** Apply the stat-compatible part of a modifier result to a plain stats row. */
export function applyDaoCombatModifiers2D(baseStats = {}, modifiers = {}) {
  const source = baseStats && typeof baseStats === 'object' ? baseStats : {}
  const mod = modifiers && typeof modifiers === 'object' ? modifiers : {}
  const stats = mod.stats ?? mod.playerStats ?? {}
  const result = { ...source }
  const multiply = (key, factor) => {
    if (Number.isFinite(source[key]) && Number.isFinite(factor)) result[key] = source[key] * factor
  }
  const add = (key, amount) => {
    if (Number.isFinite(source[key]) && Number.isFinite(amount)) result[key] = source[key] + amount
  }
  multiply('maxHp', stats.maxHp ?? mod.maxHpMultiplier ?? 1)
  multiply('moveSpeed', stats.moveSpeed ?? mod.moveSpeedMultiplier ?? 1)
  multiply('might', stats.might ?? mod.damageMultiplier ?? 1)
  multiply('area', stats.area ?? mod.areaMultiplier ?? 1)
  multiply('cooldown', stats.cooldown ?? mod.cooldownMultiplier ?? 1)
  multiply('speedProj', stats.speedProj ?? mod.projectileSpeedMultiplier ?? 1)
  multiply('duration', stats.duration ?? mod.durationMultiplier ?? 1)
  multiply('magnet', stats.magnet ?? mod.magnetMultiplier ?? 1)
  add('amount', stats.amount ?? mod.amountAdd ?? 0)
  add('regen', stats.regen ?? mod.regenAdd ?? 0)
  return deepFreeze(result)
}

/**
 * Stateful owner for one contest run's three Dao choices.  The state itself is
 * tiny and mutable, while every public data object is a fresh deeply frozen
 * JSON-safe snapshot.
 */
export class DaoVows2D {
  constructor(options = {}) {
    this._vowId = null
    this._choices = { pledge: null, deepening: null, completion: null }

    if (typeof options === 'string') {
      this.select('pledge', options)
      return
    }
    if (!options || typeof options !== 'object') return

    const saveState = options.saveState ?? options.state ?? options.serialized
    if (saveState != null) {
      this.restore(saveState)
      return
    }
    const initialChoices = options.choices ?? options.selections
    if (initialChoices != null) {
      const canonical = canonicalStateFromInput({ version: DAO_VOW_VERSION_2D, choices: initialChoices })
      if (!canonical) throw new RangeError('DaoVows2D 초기 선택이 올바르지 않습니다.')
      applyState(this, canonical)
      return
    }
    const vowId = options.vowId ?? options.vow
    if (vowId != null) this.select('pledge', vowId)
  }

  get vowId() { return this._vowId }
  get vow() { return getDaoVow2D(this._vowId) }
  get milestone() { return currentMilestoneIndex(this._choices) }
  get level() { return this.milestone }
  get complete() { return this.milestone === MILESTONE_IDS.length }
  get choices() { return Object.freeze({ ...this._choices }) }
  get selections() { return this.choices }

  /** Return the immutable definitions applicable to the next card. */
  availableSelections(milestone = MILESTONE_IDS[this.milestone]) {
    const id = canonicalMilestoneId(milestone)
    if (!id) return Object.freeze([])
    if (id === 'pledge') return DAO_VOW_LIST_2D
    if (!this._vowId) return Object.freeze([])
    const stage = this.vow.milestones.find((entry) => entry.id === id)
    // 관통검선 is the stable recommendation for a first run. 회귀검선 remains
    // a valid higher-variance second card, but the default keyboard/Enter path
    // must carry the published showcase seed through the final mirror boss.
    if (id === 'deepening' && this._vowId === 'sword' && stage?.options?.length === 2) {
      return Object.freeze([
        stage.options.find((option) => option.id === 'piercing-edge'),
        stage.options.find((option) => option.id === 'returning-edge'),
      ].filter(Boolean))
    }
    return stage?.options ?? Object.freeze([])
  }

  getAvailableSelections(milestone) { return this.availableSelections(milestone) }

  validateSelection(milestone, choiceId) {
    return validateDaoVowSelection2D({
      milestone,
      choiceId,
      vowId: this._vowId,
      choices: this._choices,
    })
  }

  isValidSelection(milestone, choiceId) {
    return this.validateSelection(milestone, choiceId).valid
  }

  _selectCanonical(milestoneId, rawChoice) {
    const result = this.validateSelection(milestoneId, rawChoice)
    if (!result.valid) {
      const error = new RangeError(result.message)
      error.code = result.reason
      error.details = result
      throw error
    }
    if (milestoneId === 'pledge') this._vowId = result.vowId
    this._choices[milestoneId] = result.choiceId
    return this.snapshot()
  }

  /** Choose a milestone. One argument means the next milestone. */
  select(milestoneOrChoice, maybeChoice) {
    let milestone = milestoneOrChoice
    let choice = maybeChoice
    if (maybeChoice === undefined) {
      milestone = MILESTONE_IDS[this.milestone] ?? null
      choice = milestoneOrChoice
    }
    const milestoneId = canonicalMilestoneId(milestone)
    if (!milestoneId) {
      const error = new RangeError('알 수 없는 맹세 경지입니다.')
      error.code = 'unknown-milestone'
      throw error
    }
    return this._selectCanonical(milestoneId, choice)
  }

  choose(milestoneOrChoice, maybeChoice) { return this.select(milestoneOrChoice, maybeChoice) }
  selectMilestone(milestone, choiceId) { return this.select(milestone, choiceId) }
  chooseMilestone(milestone, choiceId) { return this.select(milestone, choiceId) }
  selectVow(vowId) { return this.select('pledge', vowId) }
  chooseVow(vowId) { return this.select('pledge', vowId) }
  pledge(vowId) { return this.select('pledge', vowId) }
  deepen(choiceId) { return this.select('deepening', choiceId) }
  completeDao(choiceId) { return this.select('completion', choiceId) }
  completeVow(choiceId) { return this.select('completion', choiceId) }

  getCombatModifiers() {
    return getDaoCombatModifiers2D(this._vowId, this._choices)
  }
  get combatModifiers() { return this.getCombatModifiers() }

  getPresentation() {
    return presentationForState(this._vowId, this._choices)
  }
  get presentation() { return this.getPresentation() }
  getPresentationIdentity() { return this.getPresentation() }

  getMirrorPatternMetadata() {
    return mirrorPatternForState(this._vowId, this._choices, false)
  }
  getMirrorPattern() { return this.getMirrorPatternMetadata() }
  getBossMirror() { return this.getMirrorPatternMetadata() }
  get mirrorPattern() { return this.getMirrorPatternMetadata() }

  snapshot() {
    const vow = this.vow
    const selectedMilestones = MILESTONE_IDS.map((id, index) => {
      const choiceId = this._choices[id]
      const option = vow && choiceId != null ? optionFor(vow, id, choiceId) : null
      const definition = DAO_PLEDGE_MILESTONES_2D[index]
      return {
        id,
        index,
        stage: definition.stage,
        name: definition.name,
        choiceId,
        choiceName: option?.name ?? null,
        selected: choiceId != null,
      }
    })
    return deepFreeze({
      version: DAO_VOW_VERSION_2D,
      model: 'DaoVows2D',
      concept: DAO_VOW_CONCEPT_2D,
      vowId: this._vowId,
      vowName: vow?.name ?? null,
      vowHanja: vow?.hanja ?? null,
      choices: { ...this._choices },
      selections: { ...this._choices },
      milestone: this.milestone,
      level: this.level,
      nextMilestone: MILESTONE_IDS[this.milestone] ?? null,
      complete: this.complete,
      milestones: selectedMilestones,
      combatModifiers: this.getCombatModifiers(),
      presentation: this.getPresentation(),
      mirrorPattern: this.getMirrorPatternMetadata(),
    })
  }

  getSnapshot() { return this.snapshot() }

  /** Minimal persistence shape; derived data is recomputed on restore. */
  toSaveState() {
    return deepFreeze({
      version: DAO_VOW_VERSION_2D,
      vowId: this._vowId,
      choices: { ...this._choices },
      milestone: this.milestone,
    })
  }

  serialize() { return this.toSaveState() }
  serializeJson() { return JSON.stringify(this.toSaveState()) }
  toJSON() { return this.toSaveState() }

  /** Restore atomically. Invalid input leaves the existing run unchanged. */
  restore(state) {
    const canonical = canonicalStateFromInput(state)
    if (!canonical) return false
    applyState(this, canonical)
    return true
  }

  restoreState(state) { return this.restore(state) }

  static fromSaveState(state) {
    const model = new DaoVows2D()
    if (!model.restore(state)) throw new RangeError('DaoVows2D 저장 상태가 올바르지 않습니다.')
    return model
  }

  static deserialize(state) { return DaoVows2D.fromSaveState(state) }
  static fromJSON(state) { return DaoVows2D.fromSaveState(state) }
}

export const DaoVowModel2D = DaoVows2D
export const DaoVowState2D = DaoVows2D

export function createDaoVows2D(options) { return new DaoVows2D(options) }
export const createDaoVowModel2D = createDaoVows2D
export function restoreDaoVows2D(state) { return DaoVows2D.fromSaveState(state) }
export function deserializeDaoVows2D(state) { return DaoVows2D.fromSaveState(state) }
