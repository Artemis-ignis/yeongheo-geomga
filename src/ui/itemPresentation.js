import { getPassive } from '../data/passives.js'
import { getWeapon } from '../data/weapons.js'

const EMPTY_EVOLUTION_IDS = new Set()

function definitionFor(id, slotKind) {
  return slotKind === 'passive' ? getPassive(id) : getWeapon(id)
}

function buildItemPresentation(item, slotKind, options) {
  const {
    evolutionIds = EMPTY_EVOLUTION_IDS,
    fallbackName,
    fallbackDescription,
    explicitDescription,
    nullishName,
    nullishDescription,
    clampLevel,
  } = options
  const id = typeof item === 'string' ? item : item?.id
  const definition = definitionFor(id, slotKind)
  const evolved = evolutionIds.has(id) || Boolean(definition?.evolutionOf)
  const visualKind = slotKind === 'passive' ? 'passive' : evolved ? 'evolution' : 'weapon'
  const kindLabel = visualKind === 'passive' ? '공법' : visualKind === 'evolution' ? '진화 법보' : '법보'
  const kindMark = visualKind === 'passive' ? '공' : visualKind === 'evolution' ? '진' : '법'

  const explicitName = typeof item === 'object' ? item?.name : undefined
  const resolvedFallbackName = typeof fallbackName === 'function' ? fallbackName(id) : fallbackName
  const name = nullishName
    ? explicitName ?? definition?.name ?? resolvedFallbackName
    : explicitName || definition?.name || resolvedFallbackName

  const descriptionValue = explicitDescription
    ? typeof item === 'object' ? item?.description ?? item?.desc : ''
    : typeof item === 'object' ? item?.desc : undefined
  const description = nullishDescription
    ? descriptionValue ?? definition?.desc ?? fallbackDescription
    : descriptionValue || definition?.desc || fallbackDescription

  const rawLevel = typeof item === 'object' && Number.isFinite(item?.level) ? item.level : 0
  const level = clampLevel ? Math.max(0, rawLevel) : rawLevel
  const maxLevel = slotKind === 'passive' ? definition?.max : definition?.levels?.length
  const levelText = visualKind === 'evolution'
    ? '진화'
    : Number.isFinite(maxLevel) ? `Lv.${level}/${maxLevel}` : `Lv.${level}`

  return {
    id,
    visualKind,
    kindLabel,
    kindMark,
    name,
    levelText,
    level,
    description,
    effect: description,
  }
}

/**
 * Build the result-screen loadout contract.  The explicit fallbacks and
 * description precedence match the former ResultScreen-local helper.
 */
export function itemPresentation(item, slotKind, evolutionIds = EMPTY_EVOLUTION_IDS) {
  const presentation = buildItemPresentation(item, slotKind, {
    evolutionIds,
    fallbackName: (id) => id || '알 수 없는 법보',
    fallbackDescription: '이번 출정에서 획득한 수련 효과입니다.',
    explicitDescription: true,
    nullishName: false,
    nullishDescription: false,
    clampLevel: false,
  })
  return {
    ...presentation,
    alt: `${presentation.name} ${presentation.kindLabel} 아이콘 · ${presentation.levelText} · 효과: ${presentation.description}`,
  }
}

/**
 * Build the in-run HUD slot contract.  HUD historically uses nullish name and
 * description fallbacks and clamps negative levels; keep those semantics here
 * rather than silently normalizing them to the result-screen contract.
 */
export function hudItemPresentation(item, slotKind) {
  return buildItemPresentation(item, slotKind, {
    fallbackName: item?.id,
    fallbackDescription: '',
    explicitDescription: false,
    nullishName: true,
    nullishDescription: true,
    clampLevel: true,
  })
}
