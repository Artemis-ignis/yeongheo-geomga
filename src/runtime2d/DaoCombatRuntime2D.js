import { getDaoCombatModifiers2D } from './DaoVows2D.js'

/**
 * Fixed-tick, renderer-agnostic runtime for the three Dao combat signatures.
 *
 * CombatWorld2D owns movement, projectiles, pickups, and effects.  This small
 * companion owns only the deterministic rules that turn those events into
 * authored Dao actions.  It deliberately communicates through a bounded ring
 * queue so a busy run does not allocate an object for every simulation tick.
 */

export const DAO_COMBAT_RUNTIME_VERSION_2D = 1
export const DAO_COMBAT_RUNTIME_MODEL_2D = 'DaoCombatRuntime2D'
export const DAO_COMBAT_FIXED_DT_2D = 1 / 60
export const DAO_COMBAT_ACTION_CAPACITY_2D = 128
export const EMPTY_ACTIONS = Object.freeze([])

export const DAO_COMBAT_ACTION_2D = Object.freeze({
  swordFan: 'sword-fan',
  swordRing: 'sword-ring',
  frostField: 'frost-field',
  frostSlow: 'frost-slow',
  frostWall: 'frost-wall',
  frostDeathShards: 'frost-death-shards',
  spiritPickup: 'spirit-pickup-chain',
  spiritOvercharge: 'spirit-overcharge',
  spiritPurge: 'spirit-purge',
  spiritShadowPull: 'spirit-shadow-pull',
  spiritAttackClone: 'spirit-attack-clone',
})
export const DAO_RUNTIME_ACTIONS_2D = DAO_COMBAT_ACTION_2D

const VOW_ALIASES = Object.freeze({
  sword: 'sword', 검맥: 'sword', '劍脈': 'sword',
  frost: 'frost', 설맥: 'frost', '雪脈': 'frost',
  spirit: 'spirit', 심맥: 'spirit', '心脈': 'spirit',
})

const SEEN_CAPACITY = 64
const FIELD_CAPACITY = 24
const WALL_PAIR_CAPACITY = 48
const PICKUP_CHAIN_WINDOW = 1.1
const TWO_PI = Math.PI * 2

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback
}

function positive(value, fallback) {
  const number = finite(value, fallback)
  return number > 0 ? number : fallback
}

function integer(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback
}

function uint32(value, fallback = 0x6d2b79f5) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback >>> 0
  return (Math.trunc(number) >>> 0) || (fallback >>> 0)
}

function cloneJson(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(cloneJson)
  const output = {}
  for (const [key, child] of Object.entries(value)) output[key] = cloneJson(child)
  return output
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  for (const child of Object.values(value)) deepFreeze(child, seen)
  return Object.freeze(value)
}

function canonicalVowId(value) {
  if (typeof value !== 'string') return null
  const exact = value.trim()
  return VOW_ALIASES[exact] ?? VOW_ALIASES[exact.toLowerCase()] ?? null
}

function sourceSnapshot(source) {
  if (!source) return null
  if (typeof source.snapshot === 'function') return source.snapshot()
  if (typeof source.getSnapshot === 'function') return source.getSnapshot()
  if (source.daoVow && typeof source.daoVow === 'object') return source.daoVow
  return source
}

function normalizeDaoSource(source) {
  const snapshot = sourceSnapshot(source)
  if (!snapshot || typeof snapshot !== 'object') {
    return { snapshot: null, vowId: null, modifiers: {} }
  }
  const vowId = canonicalVowId(snapshot.vowId ?? snapshot.vow ?? snapshot.id)
  let modifiers = snapshot.combatModifiers ?? snapshot.modifiers ?? null
  if (!modifiers && vowId) {
    modifiers = getDaoCombatModifiers2D(vowId, snapshot.choices ?? snapshot.selections)
  }
  return {
    snapshot: cloneJson(snapshot),
    vowId,
    modifiers: cloneJson(modifiers ?? {}),
  }
}

function eventPosition(event, fallback = null) {
  const value = event && typeof event === 'object' ? event : {}
  const nestedFrom = value.from && typeof value.from === 'object' ? value.from : null
  const nestedTo = value.to && typeof value.to === 'object' ? value.to : null
  const nestedPosition = value.position && typeof value.position === 'object' ? value.position : null
  const base = fallback ?? { x: 0, z: 0 }
  const fromX = finite(value.fromX, finite(nestedFrom?.x, finite(value.x, finite(base.x))))
  const fromZ = finite(value.fromZ, finite(nestedFrom?.z, finite(value.z, finite(base.z))))
  const toX = finite(value.toX, finite(nestedTo?.x, finite(nestedPosition?.x, fromX)))
  const toZ = finite(value.toZ, finite(nestedTo?.z, finite(nestedPosition?.z, fromZ)))
  return { fromX, fromZ, toX, toZ }
}

function eventId(event, fallback = null) {
  if (event && typeof event === 'object') return event.id ?? event.uid ?? event.key ?? fallback
  return fallback
}

function readDashEvents(input, callback) {
  if (Array.isArray(input?.dashes)) {
    for (let i = 0; i < input.dashes.length; i++) callback(input.dashes[i], i)
    return
  }
  if (input?.dash && typeof input.dash === 'object') {
    callback(input.dash, 0)
    return
  }
  if (input?.dash === true || input?.didDash === true || input?.dashed === true) {
    callback(input, 0)
  }
}

function readPickupEvents(input, callback) {
  if (Array.isArray(input?.pickups)) {
    for (let i = 0; i < input.pickups.length; i++) callback(input.pickups[i], i)
    return
  }
  if (input?.pickup && typeof input.pickup === 'object') {
    callback(input.pickup, 0)
    return
  }
  if (input?.pickup === true) callback(input, 0)
  const count = Math.max(0, Math.floor(finite(input?.pickupCount, 0)))
  for (let i = 0; i < count; i++) callback({ index: i }, i)
}

function readDeathEvents(input, callback) {
  const source = input?.frozenDeaths ?? input?.enemyDeaths ?? input?.deaths
  if (Array.isArray(source)) {
    for (let i = 0; i < source.length; i++) callback(source[i], i)
    return
  }
  if (source && typeof source === 'object') callback(source, 0)
  const count = Math.max(0, Math.floor(finite(source, 0)))
  for (let i = 0; i < count; i++) callback({ index: i, frozen: true }, i)
}

function isFrozenDeath(event, input) {
  if (input?.frozenDeaths != null) return true
  if (!event || typeof event !== 'object') return Boolean(input?.frozen)
  return event.frozen === true || event.wasFrozen === true || event.status === 'frozen' || event.element === 'frost'
}

/**
 * A deterministic action queue.  The queue stores primitive fields in fixed
 * typed arrays; object-shaped actions are created only when a caller drains or
 * serializes the queue, outside the hot fixed-tick loop.
 */
export class DaoCombatRuntime2D {
  constructor(options = {}) {
    const config = options && typeof options === 'object' ? options : { snapshot: options }
    this.fixedDt = positive(config.fixedDt, DAO_COMBAT_FIXED_DT_2D)
    this.queueCapacity = Math.max(8, Math.floor(positive(config.queueCapacity, DAO_COMBAT_ACTION_CAPACITY_2D)))
    this.seed = uint32(config.seed ?? sourceSnapshot(config.dao ?? config.daoVows ?? config.snapshot)?.seed)
    this._rngState = this.seed
    this._allocateQueue()
    this._allocateSeen()
    this._allocateFields()
    this._resetMechanics()

    const hasInlineDao = config.vowId != null || config.vow != null
      || config.combatModifiers != null || config.modifiers != null || config.choices != null
    const source = config.dao ?? config.daoVows ?? config.snapshot ?? (hasInlineDao ? config : null)
    if (source) this.setDaoState(source, { reset: false })
  }

  _allocateQueue() {
    this._queueType = new Array(this.queueCapacity)
    this._queueTick = new Int32Array(this.queueCapacity)
    this._queueSequence = new Int32Array(this.queueCapacity)
    // Sword fan actions carry two completion/deepening values in addition to
    // the original seven numbers. Keep them primitive so replay/restore does
    // not need an object allocation in the fixed-tick path.
    this._queueNumbers = Array.from({ length: 9 }, () => new Float64Array(this.queueCapacity))
    this._queueText = new Array(this.queueCapacity)
    this._queueText2 = new Array(this.queueCapacity)
    this._queueSource = new Array(this.queueCapacity)
    this._queueHead = 0
    this._queueSize = 0
    this._sequence = 0
    this.droppedActions = 0
  }

  _allocateSeen() {
    this._seenValues = {
      dash: new Array(SEEN_CAPACITY),
      swordDash: new Array(SEEN_CAPACITY),
      spiritDash: new Array(SEEN_CAPACITY),
      pickup: new Array(SEEN_CAPACITY),
      death: new Array(SEEN_CAPACITY),
    }
    this._seenCount = { dash: 0, swordDash: 0, spiritDash: 0, pickup: 0, death: 0 }
    this._seenCursor = { dash: 0, swordDash: 0, spiritDash: 0, pickup: 0, death: 0 }
  }

  _allocateFields() {
    this._fieldActive = new Uint8Array(FIELD_CAPACITY)
    this._fieldX = new Float64Array(FIELD_CAPACITY)
    this._fieldZ = new Float64Array(FIELD_CAPACITY)
    this._fieldTtl = new Float64Array(FIELD_CAPACITY)
    this._fieldId = new Array(FIELD_CAPACITY).fill(0)
    this._fieldDashSerial = new Int32Array(FIELD_CAPACITY)
    this._fieldCursor = 0
    this._fieldCount = 0
    this._nextFieldId = 1

    this._wallPairA = new Array(WALL_PAIR_CAPACITY).fill(0)
    this._wallPairB = new Array(WALL_PAIR_CAPACITY).fill(0)
    this._wallPairCount = 0
    this._wallPairCursor = 0
  }

  _resetMechanics() {
    this.tickIndex = 0
    this.time = 0
    this._swordCharge = 0
    this._swordSequence = 0
    this._frostDashSequence = 0
    this._spiritDashSequence = 0
    this._spiritGauge = 0
    this._spiritChain = 0
    this._lastPickupTime = -Infinity
    this._overchargeActive = false
    this._overchargeRemaining = 0
    this._overchargeCycle = 0
    this._shadowTriggeredCycle = -1
    this._runEnded = false
    this._allocateSeen()
    this._fieldActive.fill(0)
    this._fieldCount = 0
    this._fieldCursor = 0
    this._nextFieldId = 1
    this._wallPairCount = 0
    this._wallPairCursor = 0
    this._queueHead = 0
    this._queueSize = 0
    this._sequence = 0
    this.droppedActions = 0
  }

  get vowId() { return this._vowId ?? null }
  get active() { return Boolean(this._vowId) }
  get queueSize() { return this._queueSize }
  get gauge() { return this._spiritGauge }
  get gaugeMax() { return this._gaugeMax() }
  get overchargeActive() { return this._overchargeActive }
  get overchargeRemaining() { return this._overchargeRemaining }
  get swordCharge() { return this._swordCharge }
  get spiritChain() { return this._spiritChain }

  _gaugeMax() {
    return Math.max(1, 100 + finite(this._modifiers?.spiritGaugeMaxAdd, 0))
  }

  setDaoState(source, { reset = true } = {}) {
    const normalized = normalizeDaoSource(source)
    if (reset) this._resetMechanics()
    this._vowId = normalized.vowId
    this._modifiers = normalized.modifiers
    this._sourceSnapshot = normalized.snapshot
    return this
  }

  setSnapshot(snapshot, options) { return this.setDaoState(snapshot, options) }
  applySnapshot(snapshot, options) { return this.setDaoState(snapshot, options) }

  setModifiers(vowId, modifiers, { reset = true } = {}) {
    return this.setDaoState({ vowId, combatModifiers: modifiers }, { reset })
  }

  setSpiritGauge(value) {
    this._spiritGauge = Math.max(0, Math.min(this._gaugeMax(), finite(value, 0)))
    return this._spiritGauge
  }

  _random() {
    // xorshift32: tiny, deterministic, and serializable.
    let x = this._rngState || 0x6d2b79f5
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this._rngState = x >>> 0
    return this._rngState / 0x100000000
  }

  _randomAngle() { return this._random() * TWO_PI - Math.PI }

  _remember(kind, value) {
    if (value == null) return true
    const values = this._seenValues[kind]
    const count = this._seenCount[kind]
    for (let i = 0; i < count; i++) if (values[i] === value) return false
    if (count < SEEN_CAPACITY) {
      values[count] = value
      this._seenCount[kind] = count + 1
    } else {
      const cursor = this._seenCursor[kind]
      values[cursor] = value
      this._seenCursor[kind] = (cursor + 1) % SEEN_CAPACITY
    }
    return true
  }

  _enqueue(type, numbers = [], text = null, text2 = null, source = null, tick = this.tickIndex, sequence = null) {
    let index
    if (this._queueSize >= this.queueCapacity) {
      index = this._queueHead
      this._queueHead = (this._queueHead + 1) % this.queueCapacity
      this.droppedActions++
    } else {
      index = (this._queueHead + this._queueSize) % this.queueCapacity
      this._queueSize++
    }
    this._queueType[index] = type
    this._queueTick[index] = integer(tick)
    const actionSequence = sequence == null ? ++this._sequence : integer(sequence)
    this._queueSequence[index] = actionSequence
    if (actionSequence > this._sequence) this._sequence = actionSequence
    for (let i = 0; i < this._queueNumbers.length; i++) this._queueNumbers[i][index] = finite(numbers[i], 0)
    this._queueText[index] = text
    this._queueText2[index] = text2
    this._queueSource[index] = source
    return actionSequence
  }

  _readAction(index) {
    const type = this._queueType[index]
    const n = this._queueNumbers
    const base = {
      type,
      kind: type,
      action: type,
      tick: this._queueTick[index],
      sequence: this._queueSequence[index],
      source: this._queueSource[index] ?? null,
    }
    const position = (x, z) => ({ x, z })
    if (type === DAO_COMBAT_ACTION_2D.swordFan) {
      return {
        ...base,
        mode: this._queueText[index] ?? 'additional',
        count: n[0][index], spread: n[1][index], returnHits: n[2][index],
        chargeSerial: n[5][index], angle: n[6][index],
        pierceAdd: n[7][index], returnDelay: n[8][index],
        origin: position(n[3][index], n[4][index]),
      }
    }
    if (type === DAO_COMBAT_ACTION_2D.swordRing) {
      return {
        ...base,
        dashId: base.source,
        position: position(n[0][index], n[1][index]),
        radius: n[2][index], push: n[3][index], duration: n[4][index],
      }
    }
    if (type === DAO_COMBAT_ACTION_2D.frostField || type === DAO_COMBAT_ACTION_2D.frostSlow) {
      return {
        ...base,
        fieldId: n[5][index], dashSerial: n[6][index],
        position: position(n[0][index], n[1][index]),
        radius: n[2][index], duration: n[3][index], slowMultiplier: n[4][index],
      }
    }
    if (type === DAO_COMBAT_ACTION_2D.frostWall) {
      return {
        ...base,
        fromFieldId: n[6][index], toFieldId: n[7][index],
        position: position(n[0][index], n[1][index]), distance: n[2][index],
        radius: n[3][index], duration: n[4][index], slowMultiplier: n[5][index],
      }
    }
    if (type === DAO_COMBAT_ACTION_2D.frostDeathShards) {
      return {
        ...base,
        position: position(n[0][index], n[1][index]), count: n[2][index], radius: n[3][index],
        angle: n[4][index], deathSerial: n[5][index], deathId: this._queueText[index] ?? null,
      }
    }
    if (type === DAO_COMBAT_ACTION_2D.spiritPickup) {
      return { ...base, chain: n[0][index], gauge: n[1][index], gain: n[2][index] }
    }
    if (type === DAO_COMBAT_ACTION_2D.spiritOvercharge) {
      return {
        ...base,
        cycle: n[0][index], gauge: n[1][index], maxGauge: n[2][index],
        duration: n[3][index], attackDensity: n[4][index], magnetMultiplier: n[5][index],
      }
    }
    if (type === DAO_COMBAT_ACTION_2D.spiritPurge) {
      return {
        ...base,
        cycle: n[5][index], position: position(n[0][index], n[1][index]),
        radius: n[2][index], cost: n[3][index], gauge: n[4][index],
      }
    }
    if (type === DAO_COMBAT_ACTION_2D.spiritShadowPull) {
      return {
        ...base,
        reason: this._queueText[index] ?? 'overcharge-end',
        radius: n[0][index], count: n[1][index], cycle: n[2][index],
      }
    }
    if (type === DAO_COMBAT_ACTION_2D.spiritAttackClone) {
      return {
        ...base,
        reason: this._queueText[index] ?? 'overcharge-end',
        count: n[0][index], cycle: n[1][index], angle: n[2][index], damageMultiplier: n[3][index],
      }
    }
    return base
  }

  peekActions() {
    const actions = new Array(this._queueSize)
    for (let i = 0; i < this._queueSize; i++) {
      const index = (this._queueHead + i) % this.queueCapacity
      actions[i] = this._readAction(index)
    }
    return actions
  }

  drainActions(limit = Infinity) {
    const count = Math.min(this._queueSize, Math.max(0, Math.floor(finite(limit, this._queueSize))))
    if (count === 0) return EMPTY_ACTIONS
    const actions = new Array(count)
    for (let i = 0; i < count; i++) {
      const index = this._queueHead
      actions[i] = this._readAction(index)
      this._queueType[index] = undefined
      this._queueText[index] = null
      this._queueText2[index] = null
      this._queueSource[index] = null
      this._queueHead = (this._queueHead + 1) % this.queueCapacity
      this._queueSize--
    }
    return actions
  }

  consumeActions(limit) { return this.drainActions(limit) }
  dequeueActions(limit) { return this.drainActions(limit) }
  dequeue(limit) { return this.drainActions(limit) }
  flushActions(limit) { return this.drainActions(limit) }

  _processSword(input) {
    if (this._modifiers.swordRingEnabled) {
      readDashEvents(input, (dash) => {
        const id = eventId(dash, input.dashId ?? null)
        if (!this._remember('swordDash', id)) return
        const position = eventPosition(dash, input)
        this._enqueue(DAO_COMBAT_ACTION_2D.swordRing, [
          position.toX,
          position.toZ,
          Math.max(0, finite(this._modifiers.swordRingRadius, 0)),
          Math.max(0, finite(this._modifiers.swordRingPush, 0)),
          Math.max(this.fixedDt, finite(this._modifiers.swordRingDuration, 0)),
        ], null, null, id)
      })
    }
    const threshold = positive(this._modifiers.swordChargeSeconds, 0)
    if (threshold <= 0) return
    const moving = input.moving === true || input.isMoving === true || finite(input.moveSpeed, 0) > 0
    if (!moving) {
      this._swordCharge = 0
      return
    }
    const factor = Math.max(0, Math.min(2, finite(input.moveFactor, finite(input.moveSpeed, 1) || 1)))
    this._swordCharge += this.fixedDt * factor
    while (this._swordCharge + 1e-9 >= threshold) {
      this._swordCharge -= threshold
      const returnHits = Math.max(0, Math.floor(finite(this._modifiers.swordReturnHitsAdd, 0)))
      const count = Math.max(1, 1 + Math.floor(finite(this._modifiers.swordFanProjectileAdd, 0)))
      const pierceAdd = Math.max(0, Math.floor(finite(this._modifiers.projectilePierceAdd, 0)))
      const returnDelay = Math.max(0, finite(this._modifiers.swordReturnDelay, 0))
      const mode = returnHits > 0 ? 'returning' : 'additional'
      const serial = ++this._swordSequence
      this._enqueue(DAO_COMBAT_ACTION_2D.swordFan, [
        count,
        Math.max(0, finite(this._modifiers.swordFanSpreadAdd, 0)),
        returnHits,
        finite(input.x, 0),
        finite(input.z, 0),
        serial,
        this._randomAngle(),
        pierceAdd,
        returnDelay,
      ], mode, null, input.movementId ?? null)
    }
  }

  _fieldIndexForId(fieldId) {
    for (let i = 0; i < FIELD_CAPACITY; i++) if (this._fieldActive[i] && this._fieldId[i] === fieldId) return i
    return -1
  }

  _pairSeen(a, b) {
    const low = Math.min(a, b)
    const high = Math.max(a, b)
    for (let i = 0; i < this._wallPairCount; i++) if (this._wallPairA[i] === low && this._wallPairB[i] === high) return true
    if (this._wallPairCount < WALL_PAIR_CAPACITY) {
      this._wallPairA[this._wallPairCount] = low
      this._wallPairB[this._wallPairCount] = high
      this._wallPairCount++
    } else {
      const index = this._wallPairCursor
      this._wallPairA[index] = low
      this._wallPairB[index] = high
      this._wallPairCursor = (this._wallPairCursor + 1) % WALL_PAIR_CAPACITY
    }
    return false
  }

  _createField(x, z, dashSerial, input, slowMultiplier, radius, duration, pairDistance) {
    let index = -1
    for (let i = 0; i < FIELD_CAPACITY; i++) {
      const candidate = (this._fieldCursor + i) % FIELD_CAPACITY
      if (!this._fieldActive[candidate]) { index = candidate; break }
    }
    if (index < 0) index = this._fieldCursor
    if (!this._fieldActive[index]) this._fieldCount++
    const fieldId = this._nextFieldId++
    this._fieldActive[index] = 1
    this._fieldX[index] = x
    this._fieldZ[index] = z
    this._fieldTtl[index] = duration
    this._fieldId[index] = fieldId
    this._fieldDashSerial[index] = dashSerial
    this._fieldCursor = (index + 1) % FIELD_CAPACITY
    this._enqueue(DAO_COMBAT_ACTION_2D.frostField, [x, z, radius, duration, slowMultiplier, fieldId, dashSerial], null, null, eventId(input))
    if (slowMultiplier < 1) {
      this._enqueue(DAO_COMBAT_ACTION_2D.frostSlow, [x, z, radius, duration, slowMultiplier, fieldId, dashSerial], null, null, eventId(input))
    }

    if (pairDistance <= 0) return
    for (let i = 0; i < FIELD_CAPACITY; i++) {
      if (i === index || !this._fieldActive[i]) continue
      const dx = this._fieldX[i] - x
      const dz = this._fieldZ[i] - z
      const distance = Math.hypot(dx, dz)
      if (distance > pairDistance || this._pairSeen(this._fieldId[i], fieldId)) continue
      const otherId = this._fieldId[i]
      const fromId = Math.min(otherId, fieldId)
      const toId = Math.max(otherId, fieldId)
      this._enqueue(DAO_COMBAT_ACTION_2D.frostWall, [
        (this._fieldX[i] + x) * 0.5,
        (this._fieldZ[i] + z) * 0.5,
        distance,
        radius,
        Math.max(duration, finite(this._modifiers.frostWallDuration, duration)),
        slowMultiplier,
        fromId,
        toId,
      ], null, null, `${fromId}:${toId}`)
    }
  }

  _processFrost(input) {
    const fieldEnabled = finite(this._modifiers.frostFieldCountAdd, 0) > 0
    const slowMultiplier = Math.max(0.01, finite(this._modifiers.frostSlowMultiplier, 1))
    const radius = Math.max(0, finite(this._modifiers.frostFieldRadius, 0))
    const duration = Math.max(this.fixedDt, finite(this._modifiers.frostFieldDuration, 0))
    const pairDistance = finite(this._modifiers.frostWallPairDistance, 0) > 0
      ? finite(this._modifiers.frostWallPairDistance, 0)
      : this._modifiers.frostWallEnabled ? 4.2 : 0
    if (fieldEnabled) {
      readDashEvents(input, (dash, index) => {
        const id = eventId(dash, input.dashId ?? null)
        if (!this._remember('dash', id)) return
        const position = eventPosition(dash, input)
        const serial = ++this._frostDashSequence
        this._createField(position.fromX, position.fromZ, serial, dash, slowMultiplier, radius, duration, pairDistance)
        this._createField(position.toX, position.toZ, serial, dash, slowMultiplier, radius, duration, pairDistance)
        // An id-less multi-dash input still receives a stable source cursor.
        if (id == null && index > 0) this._frostDashSequence += 0
      })
    }

    const shardCount = Math.max(0, Math.floor(finite(this._modifiers.frostShardCountAdd, 0)))
    if (shardCount <= 0) return
    readDeathEvents(input, (death, index) => {
      if (!isFrozenDeath(death, input)) return
      const id = eventId(death, input.deathId ?? null)
      if (!this._remember('death', id)) return
      const position = eventPosition(death, input)
      this._enqueue(DAO_COMBAT_ACTION_2D.frostDeathShards, [
        position.toX, position.toZ, shardCount, Math.max(0, finite(this._modifiers.frostShardRadius, 0)),
        this._randomAngle(), index + 1,
      ], id == null ? null : String(id), null, id)
    })
  }

  _triggerOvercharge() {
    if (this._overchargeActive) return
    const duration = Math.max(this.fixedDt, finite(this._modifiers.spiritOverchargeDuration, 0))
    this._overchargeActive = true
    this._overchargeRemaining = duration
    this._overchargeCycle++
    this._spiritGauge = this._gaugeMax()
    this._enqueue(DAO_COMBAT_ACTION_2D.spiritOvercharge, [
      this._overchargeCycle,
      this._spiritGauge,
      this._gaugeMax(),
      duration,
      Math.max(1, finite(this._modifiers.spiritOverchargeAttackDensityMultiplier, 1)),
      Math.max(1, finite(this._modifiers.spiritOverchargeMagnetMultiplier, 1)),
    ])
  }

  _triggerShadow(reason = 'overcharge-end') {
    if (!this._modifiers.spiritShadowEnabled && !this._modifiers.spiritAttackCopyEnabled) return
    const cycle = this._overchargeCycle
    if (this._shadowTriggeredCycle === cycle) return
    this._shadowTriggeredCycle = cycle
    const count = Math.max(1, 1 + Math.floor(finite(this._modifiers.spiritShadowCountAdd, 0)))
    if (this._modifiers.spiritShadowEnabled) {
      this._enqueue(DAO_COMBAT_ACTION_2D.spiritShadowPull, [
        Math.max(0, finite(this._modifiers.spiritShadowPull, 0)), count, cycle,
      ], reason)
    }
    if (this._modifiers.spiritAttackCopyEnabled || this._modifiers.spiritShadowEnabled) {
      this._enqueue(DAO_COMBAT_ACTION_2D.spiritAttackClone, [
        count,
        cycle,
        this._randomAngle(),
        Math.max(1, finite(this._modifiers.spiritOverchargeAttackDensityMultiplier, 1)),
      ], reason)
    }
  }

  _processSpirit(input) {
    if (!this._modifiers.spiritGaugeEnabled) return
    const gainDefault = Math.max(0, finite(this._modifiers.spiritGaugeGainAdd, 0))
    const maxGauge = this._gaugeMax()
    readPickupEvents(input, (pickup, index) => {
      const id = eventId(pickup, input.pickupId ?? null)
      if (!this._remember('pickup', id)) return
      const withinChain = this.time - this._lastPickupTime <= PICKUP_CHAIN_WINDOW
      this._spiritChain = withinChain ? this._spiritChain + 1 : 1
      this._lastPickupTime = this.time
      const gain = Math.max(0, finite(pickup?.gain, finite(pickup?.amount, gainDefault)))
      this._spiritGauge = Math.min(maxGauge, this._spiritGauge + gain)
      this._enqueue(DAO_COMBAT_ACTION_2D.spiritPickup, [this._spiritChain, this._spiritGauge, gain], null, null, id)
      if (this._spiritGauge >= maxGauge) this._triggerOvercharge()
      if (id == null && index > 0) this._spiritChain += 0
    })

    readDashEvents(input, (dash) => {
      if (!this._overchargeActive || !this._modifiers.spiritPurgeEnabled) return
      const id = eventId(dash, input.dashId ?? null)
      if (!this._remember('spiritDash', id)) return
      const cost = Math.max(0, finite(this._modifiers.spiritPurgeGaugeCost, 0))
      if (this._spiritGauge < cost) return
      this._spiritGauge -= cost
      const position = eventPosition(dash, input)
      this._spiritDashSequence++
      this._enqueue(DAO_COMBAT_ACTION_2D.spiritPurge, [
        position.toX, position.toZ, Math.max(0, finite(this._modifiers.spiritPurgeRadius, 0)),
        cost, this._spiritGauge, this._overchargeCycle,
      ], null, null, id)
    })
  }

  _advanceFields() {
    for (let i = 0; i < FIELD_CAPACITY; i++) {
      if (!this._fieldActive[i]) continue
      this._fieldTtl[i] -= this.fixedDt
      if (this._fieldTtl[i] <= 0) {
        this._fieldActive[i] = 0
        this._fieldCount = Math.max(0, this._fieldCount - 1)
      }
    }
  }

  _advanceSpirit() {
    if (!this._overchargeActive) return
    this._overchargeRemaining -= this.fixedDt
    if (this._overchargeRemaining > 1e-9) return
    this._overchargeRemaining = 0
    this._overchargeActive = false
    this._spiritGauge = 0
    if (!this._runEnded) this._triggerShadow('overcharge-end')
  }

  _forceOverchargeEnd(input) {
    if (!input?.overchargeEnded && !input?.spiritOverchargeEnded) return
    if (!this._overchargeActive) return
    this._overchargeRemaining = 0
    this._overchargeActive = false
    this._spiritGauge = 0
    if (!this._runEnded) this._triggerShadow('overcharge-end')
  }

  _processRunEnd(input) {
    if (!input?.runEnded && !input?.ended && !input?.end && !input?.result) return
    if (this._runEnded) return
    this._runEnded = true
    this._triggerShadow('run-end')
  }

  /** Advance exactly one fixed simulation tick and return that tick's actions. */
  fixedTick(input = {}) {
    this.tickIndex++
    this.time = this.tickIndex * this.fixedDt
    if (this.active) {
      this._processSword(input ?? {})
      this._processFrost(input ?? {})
      this._processSpirit(input ?? {})
      this._processRunEnd(input ?? {})
      this._forceOverchargeEnd(input ?? {})
      this._advanceFields()
      this._advanceSpirit()
    }
    return this.drainActions()
  }

  tick(input) { return this.fixedTick(input) }
  update(input) { return this.fixedTick(input) }
  step(input) { return this.fixedTick(input) }
  advance(input) { return this.fixedTick(input) }

  _queueRows() {
    const rows = new Array(this._queueSize)
    for (let i = 0; i < this._queueSize; i++) {
      const index = (this._queueHead + i) % this.queueCapacity
      rows[i] = this._readAction(index)
    }
    return rows
  }

  _restoreQueueAction(action) {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return
    const position = action.position ?? {}
    const origin = action.origin ?? {}
    const type = action.type
    if (type === DAO_COMBAT_ACTION_2D.swordFan) {
      this._enqueue(type, [action.count, action.spread, action.returnHits, origin.x, origin.z, action.chargeSerial, action.angle, action.pierceAdd, action.returnDelay], action.mode, null, action.source, action.tick, action.sequence)
    } else if (type === DAO_COMBAT_ACTION_2D.swordRing) {
      this._enqueue(type, [position.x, position.z, action.radius, action.push, action.duration], null, null, action.source ?? action.dashId, action.tick, action.sequence)
    } else if (type === DAO_COMBAT_ACTION_2D.frostField || type === DAO_COMBAT_ACTION_2D.frostSlow) {
      this._enqueue(type, [position.x, position.z, action.radius, action.duration, action.slowMultiplier, action.fieldId, action.dashSerial], null, null, action.source, action.tick, action.sequence)
    } else if (type === DAO_COMBAT_ACTION_2D.frostWall) {
      this._enqueue(type, [position.x, position.z, action.distance, action.radius, action.duration, action.slowMultiplier, action.fromFieldId, action.toFieldId], null, null, action.source, action.tick, action.sequence)
    } else if (type === DAO_COMBAT_ACTION_2D.frostDeathShards) {
      this._enqueue(type, [position.x, position.z, action.count, action.radius, action.angle, action.deathSerial], action.deathId, null, action.source, action.tick, action.sequence)
    } else if (type === DAO_COMBAT_ACTION_2D.spiritPickup) {
      this._enqueue(type, [action.chain, action.gauge, action.gain], null, null, action.source, action.tick, action.sequence)
    } else if (type === DAO_COMBAT_ACTION_2D.spiritOvercharge) {
      this._enqueue(type, [action.cycle, action.gauge, action.maxGauge, action.duration, action.attackDensity, action.magnetMultiplier], null, null, action.source, action.tick, action.sequence)
    } else if (type === DAO_COMBAT_ACTION_2D.spiritPurge) {
      this._enqueue(type, [position.x, position.z, action.radius, action.cost, action.gauge, action.cycle], null, null, action.source, action.tick, action.sequence)
    } else if (type === DAO_COMBAT_ACTION_2D.spiritShadowPull) {
      this._enqueue(type, [action.radius, action.count, action.cycle], action.reason, null, action.source, action.tick, action.sequence)
    } else if (type === DAO_COMBAT_ACTION_2D.spiritAttackClone) {
      this._enqueue(type, [action.count, action.cycle, action.angle, action.damageMultiplier], action.reason, null, action.source, action.tick, action.sequence)
    }
  }

  snapshot() {
    const fields = []
    for (let i = 0; i < FIELD_CAPACITY; i++) {
      if (!this._fieldActive[i]) continue
      fields.push({
        index: i, id: this._fieldId[i], x: this._fieldX[i], z: this._fieldZ[i],
        ttl: this._fieldTtl[i], dashSerial: this._fieldDashSerial[i],
      })
    }
    const state = {
      version: DAO_COMBAT_RUNTIME_VERSION_2D,
      model: DAO_COMBAT_RUNTIME_MODEL_2D,
      fixedDt: this.fixedDt,
      seed: this.seed,
      rngState: this._rngState,
      sequence: this._sequence,
      vowId: this._vowId ?? null,
      modifiers: cloneJson(this._modifiers ?? {}),
      tick: this.tickIndex,
      time: this.time,
      sword: { charge: this._swordCharge, sequence: this._swordSequence },
      frost: {
        dashSequence: this._frostDashSequence,
        fieldCursor: this._fieldCursor,
        nextFieldId: this._nextFieldId,
        wallPairCursor: this._wallPairCursor,
        fields,
        wallPairs: Array.from({ length: this._wallPairCount }, (_, i) => [this._wallPairA[i], this._wallPairB[i]]),
      },
      spirit: {
        gauge: this._spiritGauge,
        chain: this._spiritChain,
        // Infinity is not JSON-safe; null represents an untouched chain.
        lastPickupTime: Number.isFinite(this._lastPickupTime) ? this._lastPickupTime : null,
        overchargeActive: this._overchargeActive,
        overchargeRemaining: this._overchargeRemaining,
        overchargeCycle: this._overchargeCycle,
        shadowTriggeredCycle: this._shadowTriggeredCycle,
        runEnded: this._runEnded,
      },
      seen: {
        dash: this._seenValues.dash.slice(0, this._seenCount.dash),
        swordDash: this._seenValues.swordDash.slice(0, this._seenCount.swordDash),
        spiritDash: this._seenValues.spiritDash.slice(0, this._seenCount.spiritDash),
        pickup: this._seenValues.pickup.slice(0, this._seenCount.pickup),
        death: this._seenValues.death.slice(0, this._seenCount.death),
      },
      queue: this._queueRows(),
      droppedActions: this.droppedActions,
    }
    return deepFreeze(state)
  }

  getSnapshot() { return this.snapshot() }
  toSaveState() { return this.snapshot() }
  serialize() { return this.snapshot() }
  serializeJson() { return JSON.stringify(this.snapshot()) }
  toJSON() { return this.snapshot() }

  restore(input) {
    let state = input
    if (typeof state === 'string') {
      try { state = JSON.parse(state) } catch { return false }
    }
    if (!state || typeof state !== 'object' || state.version !== DAO_COMBAT_RUNTIME_VERSION_2D) return false
    const vowId = canonicalVowId(state.vowId)
    this.fixedDt = positive(state.fixedDt, this.fixedDt)
    this.seed = uint32(state.seed, this.seed)
    this._rngState = uint32(state.rngState, this.seed)
    this._vowId = vowId
    this._modifiers = cloneJson(state.modifiers ?? {})
    this._sourceSnapshot = null
    this._resetMechanics()
    this.tickIndex = Math.max(0, integer(state.tick, 0))
    this.time = finite(state.time, this.tickIndex * this.fixedDt)
    this._rngState = uint32(state.rngState, this.seed)
    this._swordCharge = Math.max(0, finite(state.sword?.charge, 0))
    this._swordSequence = Math.max(0, integer(state.sword?.sequence, 0))
    this._frostDashSequence = Math.max(0, integer(state.frost?.dashSequence, 0))
    this._fieldCursor = Math.max(0, integer(state.frost?.fieldCursor, 0)) % FIELD_CAPACITY
    this._nextFieldId = Math.max(1, integer(state.frost?.nextFieldId, 1))
    for (const field of state.frost?.fields ?? []) {
      if (!field || this._fieldCount >= FIELD_CAPACITY) break
      let index = Number.isInteger(field.index) && field.index >= 0 && field.index < FIELD_CAPACITY
        && !this._fieldActive[field.index] ? field.index : -1
      if (index < 0) {
        for (let candidate = 0; candidate < FIELD_CAPACITY; candidate++) {
          if (!this._fieldActive[candidate]) { index = candidate; break }
        }
      }
      if (index < 0) break
      this._fieldCount++
      this._fieldActive[index] = 1
      this._fieldId[index] = integer(field.id, index + 1)
      this._fieldX[index] = finite(field.x)
      this._fieldZ[index] = finite(field.z)
      this._fieldTtl[index] = Math.max(0, finite(field.ttl))
      this._fieldDashSerial[index] = integer(field.dashSerial, 0)
    }
    this._wallPairCursor = Math.max(0, integer(state.frost?.wallPairCursor, 0)) % WALL_PAIR_CAPACITY
    for (const pair of state.frost?.wallPairs ?? []) {
      if (!Array.isArray(pair) || pair.length < 2 || this._wallPairCount >= WALL_PAIR_CAPACITY) break
      this._wallPairA[this._wallPairCount] = integer(pair[0])
      this._wallPairB[this._wallPairCount] = integer(pair[1])
      this._wallPairCount++
    }
    this._spiritGauge = Math.max(0, finite(state.spirit?.gauge, 0))
    this._spiritChain = Math.max(0, integer(state.spirit?.chain, 0))
    this._lastPickupTime = finite(state.spirit?.lastPickupTime, -Infinity)
    this._overchargeActive = state.spirit?.overchargeActive === true
    this._overchargeRemaining = Math.max(0, finite(state.spirit?.overchargeRemaining, 0))
    this._overchargeCycle = Math.max(0, integer(state.spirit?.overchargeCycle, 0))
    this._shadowTriggeredCycle = integer(state.spirit?.shadowTriggeredCycle, -1)
    this._runEnded = state.spirit?.runEnded === true
    for (const kind of ['dash', 'swordDash', 'spiritDash', 'pickup', 'death']) {
      for (const value of state.seen?.[kind] ?? []) this._remember(kind, value)
    }
    this._queueHead = 0
    this._queueSize = 0
    this._sequence = Math.max(0, integer(state.sequence, 0))
    for (const action of state.queue ?? []) this._restoreQueueAction(action)
    this.droppedActions = Math.max(0, integer(state.droppedActions, 0))
    return true
  }

  restoreState(state) { return this.restore(state) }

  static fromSaveState(state, options = {}) {
    const runtime = new DaoCombatRuntime2D(options)
    if (!runtime.restore(state)) throw new RangeError('DaoCombatRuntime2D 저장 상태가 올바르지 않습니다.')
    return runtime
  }

  static deserialize(state, options) { return DaoCombatRuntime2D.fromSaveState(state, options) }
  static fromJSON(state, options) { return DaoCombatRuntime2D.fromSaveState(state, options) }
}

export const DaoCombatRuntime = DaoCombatRuntime2D
export const DaoCombatRuntimeState2D = DaoCombatRuntime2D

export function createDaoCombatRuntime2D(options) { return new DaoCombatRuntime2D(options) }
export function restoreDaoCombatRuntime2D(state, options) { return DaoCombatRuntime2D.fromSaveState(state, options) }
