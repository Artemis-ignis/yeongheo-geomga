const clampInt = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Math.floor(Number(value) || 0)))
const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1))
const compareTag = (a, b) => a < b ? -1 : a > b ? 1 : 0

export const EFFECT_KIND_2D = Object.freeze({
  hit: 1,
  ring: 2,
  dash: 3,
  lightning: 4,
  death: 5,
})

export const EFFECT_RENDER_BUDGETS_2D = Object.freeze({
  [EFFECT_KIND_2D.hit]: Object.freeze({ minimum: 12, maximum: 32 }),
  [EFFECT_KIND_2D.ring]: Object.freeze({ minimum: 6, maximum: 16 }),
  [EFFECT_KIND_2D.dash]: Object.freeze({ minimum: 4, maximum: 10 }),
  [EFFECT_KIND_2D.lightning]: Object.freeze({ minimum: 5, maximum: 14 }),
  [EFFECT_KIND_2D.death]: Object.freeze({ minimum: 8, maximum: 24 }),
})

export const HIT_PRESENTATION_BUDGET_2D = Object.freeze({
  damageNumbers: 20,
  hitEffects: 32,
  audioVoices: 4,
})

const FALLBACK_EFFECT_BUDGET = Object.freeze({ minimum: 4, maximum: 12 })

function scaledBudget(budget, density) {
  const minimum = clampInt(budget?.minimum, 0, 4096)
  const maximum = clampInt(budget?.maximum, minimum, 4096)
  return minimum + Math.floor((maximum - minimum) * clamp01(density))
}

function deterministicSlots(sourceCount, sampleCount, frameId = 0) {
  const count = clampInt(sourceCount, 0, 1 << 24)
  const take = clampInt(sampleCount, 0, count)
  const slots = new Int32Array(take)
  if (take === 0) return slots
  if (take === count) {
    for (let i = 0; i < take; i++) slots[i] = i
    return slots
  }

  const offset = ((Math.trunc(frameId) % count) + count) % count
  for (let i = 0; i < take; i++) slots[i] = (Math.floor(i * count / take) + offset) % count
  slots.sort()
  return slots
}

/**
 * Selects a deterministic, per-kind subset from a mixed EffectField2D view.
 * The simulation field is never mutated and every kind receives its own budget.
 */
export function planEffectRenderSamples(kind, count, {
  density = 1,
  frameId = 0,
  budgets = EFFECT_RENDER_BUDGETS_2D,
} = {}) {
  const sourceCount = clampInt(count, 0, kind?.length ?? 0)
  const sourcesByKind = new Map()
  for (let i = 0; i < sourceCount; i++) {
    const key = Number(kind[i]) || 0
    let sources = sourcesByKind.get(key)
    if (!sources) {
      sources = []
      sourcesByKind.set(key, sources)
    }
    sources.push(i)
  }

  const selected = []
  const byKind = Object.create(null)
  const orderedKinds = [...sourcesByKind.keys()].sort((a, b) => a - b)
  for (const key of orderedKinds) {
    const sources = sourcesByKind.get(key)
    const budget = scaledBudget(budgets[key] ?? FALLBACK_EFFECT_BUDGET, density)
    const localSlots = deterministicSlots(sources.length, Math.min(sources.length, budget), frameId + key * 131)
    for (let i = 0; i < localSlots.length; i++) selected.push(sources[localSlots[i]])
    byKind[key] = Object.freeze({ sourceCount: sources.length, activeCount: localSlots.length, budget })
  }
  selected.sort((a, b) => a - b)

  return Object.freeze({
    sourceCount,
    activeCount: selected.length,
    droppedCount: sourceCount - selected.length,
    indices: Int32Array.from(selected),
    byKind: Object.freeze(byKind),
  })
}

/**
 * Describes storage allocation separately from the particles attached to a
 * ParticleContainer. Only activeCount particles should remain attached.
 */
export function planParticlePool2D(sourceCount, {
  budget = sourceCount,
  maximum = sourceCount,
  previousActiveCount = 0,
  currentAllocatedCount = 0,
  allocationBlock = 128,
  frameId = 0,
} = {}) {
  const maximumCount = clampInt(maximum, 0, 1 << 24)
  const source = clampInt(sourceCount, 0, maximumCount)
  const activeCount = Math.min(source, clampInt(budget, 0, maximumCount))
  const previous = clampInt(previousActiveCount, 0, maximumCount)
  const block = clampInt(allocationBlock, 1, Math.max(1, maximumCount || 1))
  const requiredAllocatedCount = Math.min(maximumCount, Math.ceil(activeCount / block) * block)
  const allocatedCount = Math.max(
    clampInt(currentAllocatedCount, 0, maximumCount),
    requiredAllocatedCount,
  )
  const indices = deterministicSlots(source, activeCount, frameId)

  return Object.freeze({
    sourceCount: source,
    activeCount,
    previousActiveCount: previous,
    stride: activeCount === 0 ? 0 : source / activeCount,
    indices,
    requiredAllocatedCount,
    allocatedCount,
    attachCount: Math.max(0, activeCount - previous),
    detachCount: Math.max(0, previous - activeCount),
    deactivateStart: Math.min(activeCount, previous),
    deactivateEnd: previous,
    submittedQuadCount: activeCount,
    submittedIndexCount: activeCount * 6,
  })
}

function addKahan(target, value) {
  const adjusted = value - target.compensation
  const next = target.sum + adjusted
  target.compensation = (next - target.sum) - adjusted
  target.sum = next
}

function makeTagRecord(tag, amount, crit, serial) {
  return { tag, amount: { sum: amount, compensation: 0 }, crit: Boolean(crit), count: 1, firstSerial: serial }
}

function makeGroup(x, z, tag, crit, damage, serial) {
  const amount = { sum: damage, compensation: 0 }
  return {
    amount,
    weightedX: x * damage,
    weightedZ: z * damage,
    crit,
    critCount: crit ? 1 : 0,
    count: 1,
    firstSerial: serial,
    tags: new Map([[tag, makeTagRecord(tag, damage, crit, serial)]]),
  }
}

function groupX(group) {
  return group.amount.sum > 0 ? group.weightedX / group.amount.sum : 0
}

function groupZ(group) {
  return group.amount.sum > 0 ? group.weightedZ / group.amount.sum : 0
}

function mergeEvent(group, x, z, tag, crit, damage, serial) {
  addKahan(group.amount, damage)
  group.weightedX += x * damage
  group.weightedZ += z * damage
  group.crit ||= crit
  group.critCount += crit ? 1 : 0
  group.count++
  let tagRecord = group.tags.get(tag)
  if (!tagRecord) {
    tagRecord = makeTagRecord(tag, 0, false, serial)
    tagRecord.count = 0
    group.tags.set(tag, tagRecord)
  }
  addKahan(tagRecord.amount, damage)
  tagRecord.crit ||= crit
  tagRecord.count++
}

function mergeGroup(target, source) {
  addKahan(target.amount, source.amount.sum)
  target.weightedX += source.weightedX
  target.weightedZ += source.weightedZ
  target.crit ||= source.crit
  target.critCount += source.critCount
  target.count += source.count
  target.firstSerial = Math.min(target.firstSerial, source.firstSerial)
  for (const sourceTag of source.tags.values()) {
    let targetTag = target.tags.get(sourceTag.tag)
    if (!targetTag) {
      targetTag = makeTagRecord(sourceTag.tag, 0, false, sourceTag.firstSerial)
      targetTag.count = 0
      target.tags.set(sourceTag.tag, targetTag)
    }
    addKahan(targetTag.amount, sourceTag.amount.sum)
    targetTag.crit ||= sourceTag.crit
    targetTag.count += sourceTag.count
    targetTag.firstSerial = Math.min(targetTag.firstSerial, sourceTag.firstSerial)
  }
}

function publicGroup(group) {
  const tags = [...group.tags.values()]
    .sort((a, b) => a.firstSerial - b.firstSerial || compareTag(a.tag, b.tag))
    .map((entry) => Object.freeze({
      tag: entry.tag,
      amount: entry.amount.sum,
      crit: entry.crit,
      count: entry.count,
    }))
  const primary = [...tags].sort((a, b) => b.amount - a.amount || compareTag(a.tag, b.tag))[0]
  return Object.freeze({
    x: groupX(group),
    z: groupZ(group),
    amount: group.amount.sum,
    crit: group.crit,
    critCount: group.critCount,
    count: group.count,
    tag: tags.length === 1 ? tags[0].tag : (primary?.tag ?? 'mixed'),
    mixedTags: tags.length > 1,
    tags: Object.freeze(tags),
  })
}

function compactGroups(groups, budget) {
  const maximum = clampInt(budget, 0, groups.length)
  if (maximum === 0) return []
  const compacted = groups.slice(0, maximum)
  for (let i = maximum; i < groups.length; i++) {
    const source = groups[i]
    let best = 0
    let bestDistance = Infinity
    let bestSharesTag = false
    for (let n = 0; n < compacted.length; n++) {
      const target = compacted[n]
      const sharesTag = [...source.tags.keys()].some((tag) => target.tags.has(tag))
      const dx = groupX(target) - groupX(source)
      const dz = groupZ(target) - groupZ(source)
      const distance = dx * dx + dz * dz
      if ((sharesTag && !bestSharesTag) || (sharesTag === bestSharesTag && distance < bestDistance)) {
        best = n
        bestDistance = distance
        bestSharesTag = sharesTag
      }
    }
    mergeGroup(compacted[best], source)
  }
  return compacted
}

function planAudio(groups, budget) {
  const byTag = new Map()
  for (const group of groups) {
    for (const tag of group.tags.values()) {
      let aggregate = byTag.get(tag.tag)
      if (!aggregate) {
        aggregate = {
          tag: tag.tag, amount: { sum: 0, compensation: 0 }, crit: false,
          count: 0, firstSerial: tag.firstSerial, weightedX: 0,
        }
        byTag.set(tag.tag, aggregate)
      }
      addKahan(aggregate.amount, tag.amount.sum)
      aggregate.crit ||= tag.crit
      aggregate.count += tag.count
      aggregate.weightedX += groupX(group) * tag.amount.sum
    }
  }
  return [...byTag.values()]
    .sort((a, b) => Number(b.crit) - Number(a.crit)
      || b.amount.sum - a.amount.sum
      || a.firstSerial - b.firstSerial
      || compareTag(a.tag, b.tag))
    .slice(0, clampInt(budget, 0, 64))
    .map((entry) => Object.freeze({
      tag: entry.tag,
      crit: entry.crit,
      amount: entry.amount.sum,
      count: entry.count,
      x: entry.amount.sum > 0 ? entry.weightedX / entry.amount.sum : 0,
    }))
}

function coalesce(events, sourceCount, mergeRadius) {
  const groups = []
  const radiusSquared = mergeRadius * mergeRadius
  let rejectedCount = 0
  const total = { sum: 0, compensation: 0 }
  let hasCrit = false
  let critCount = 0

  const arraySource = Array.isArray(events)
  for (let serial = 0; serial < sourceCount; serial++) {
    const source = arraySource ? events[serial] : null
    const x = Number(arraySource ? source?.x : events.x[serial])
    const z = Number(arraySource ? source?.z : events.z[serial])
    const damage = Number(arraySource ? source?.amount : events.amount[serial])
    const sourceTag = arraySource ? source?.tag : events.tag[serial]
    const tag = typeof sourceTag === 'string' && sourceTag ? sourceTag : 'hit'
    const crit = Boolean(arraySource ? source?.crit : events.crit[serial])
    if (!Number.isFinite(x) || !Number.isFinite(z)
      || !Number.isFinite(damage) || damage <= 0) {
      rejectedCount++
      continue
    }
    addKahan(total, damage)
    hasCrit ||= crit
    critCount += crit ? 1 : 0

    let destination = null
    let destinationDistance = Infinity
    for (const group of groups) {
      if (!group.tags.has(tag)) continue
      const dx = groupX(group) - x
      const dz = groupZ(group) - z
      const distance = dx * dx + dz * dz
      if (distance <= radiusSquared && distance < destinationDistance) {
        destination = group
        destinationDistance = distance
      }
    }
    if (destination) mergeEvent(destination, x, z, tag, crit, damage, serial)
    else groups.push(makeGroup(x, z, tag, crit, damage, serial))
  }
  return { groups, total, hasCrit, critCount, rejectedCount }
}

/**
 * Coalesces all hits emitted between two presentation frames. Damage-number
 * groups are compacted rather than dropped, so their sum and crit OR always
 * match the accepted simulation events.
 */
export function coalesceHitEvents2D(events, {
  mergeRadius = 1.75,
  damageNumberBudget = HIT_PRESENTATION_BUDGET_2D.damageNumbers,
  hitEffectBudget = HIT_PRESENTATION_BUDGET_2D.hitEffects,
  audioVoiceBudget = HIT_PRESENTATION_BUDGET_2D.audioVoices,
  frameId = 0,
} = {}) {
  const radius = Math.max(0, Number.isFinite(mergeRadius) ? mergeRadius : 1.75)
  const arraySource = Array.isArray(events)
  const typedSource = !arraySource && events
    && Number.isInteger(events.count) && events.x && events.z && events.amount && events.tag && events.crit
  const sourceEvents = arraySource || typedSource ? events : []
  const sourceCount = arraySource ? sourceEvents.length : typedSource ? clampInt(events.count, 0,
    Math.min(events.x.length, events.z.length, events.amount.length, events.tag.length, events.crit.length)) : 0
  const result = coalesce(sourceEvents, sourceCount, radius)
  const visualGroups = compactGroups(result.groups, damageNumberBudget).map(publicGroup)
  const effectSlots = deterministicSlots(result.groups.length, Math.min(result.groups.length,
    clampInt(hitEffectBudget, 0, 4096)), frameId)
  const effectGroups = Array.from(effectSlots, (slot) => publicGroup(result.groups[slot]))
  const audio = planAudio(result.groups, audioVoiceBudget)

  return Object.freeze({
    summary: Object.freeze({
      sourceCount,
      acceptedCount: result.groups.reduce((sum, group) => sum + group.count, 0),
      rejectedCount: result.rejectedCount,
      spatialGroupCount: result.groups.length,
      totalDamage: result.total.sum,
      hasCrit: result.hasCrit,
      critCount: result.critCount,
    }),
    damageNumbers: Object.freeze(visualGroups),
    hitEffects: Object.freeze(effectGroups),
    audio: Object.freeze(audio),
    diagnostics: Object.freeze({
      coalescedCount: Math.max(0, sourceCount - result.rejectedCount - visualGroups.length),
      sampledEffectCount: effectGroups.length,
      skippedEffectCount: Math.max(0, result.groups.length - effectGroups.length),
      suppressedAudioCount: Math.max(0, result.groups.length - audio.length),
    }),
  })
}

export class HitEventQueue2D {
  constructor(initialCapacity = 512) {
    const capacity = clampInt(initialCapacity, 16, 1 << 20)
    this.x = new Float64Array(capacity)
    this.z = new Float64Array(capacity)
    this.amount = new Float64Array(capacity)
    this.crit = new Uint8Array(capacity)
    this.tag = new Array(capacity)
    this._count = 0
    this.frameId = 0
  }

  enqueue(x, z, tag, crit, amount) {
    this._ensure(this._count + 1)
    const i = this._count++
    this.x[i] = x
    this.z[i] = z
    this.amount[i] = amount
    this.crit[i] = crit ? 1 : 0
    this.tag[i] = tag
  }

  flush(options = {}) {
    const result = coalesceHitEvents2D(this, { ...options, frameId: options.frameId ?? this.frameId })
    this._count = 0
    this.frameId++
    return result
  }

  clear() {
    this._count = 0
  }

  get count() {
    return this._count
  }

  _ensure(required) {
    if (required <= this.x.length) return
    let capacity = this.x.length
    while (capacity < required) capacity *= 2
    const grow = (source, Type) => {
      const next = new Type(capacity)
      next.set(source)
      return next
    }
    this.x = grow(this.x, Float64Array)
    this.z = grow(this.z, Float64Array)
    this.amount = grow(this.amount, Float64Array)
    this.crit = grow(this.crit, Uint8Array)
    this.tag.length = capacity
  }
}
