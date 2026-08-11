const DEFAULT_CAPACITY = 600
const DEFAULT_LONG_TASK_THRESHOLD_MS = 50

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function finiteJsonNumber(value) {
  if (Number.isFinite(value)) return value
  return value > 0 ? Number.MAX_VALUE : 0
}

function nearestRank(sorted, count, fraction) {
  if (count === 0) return 0
  const index = Math.min(count - 1, Math.max(0, Math.ceil(count * fraction) - 1))
  return sorted[index]
}

/**
 * Fixed-size rolling frame telemetry for the 2D runtime.
 *
 * `record` only writes to preallocated typed-array rings. It accepts either
 * positional values or a sample object, so the caller can choose where an
 * object allocation (if any) belongs. Percentiles use the nearest-rank rule.
 */
export class FrameTelemetry2D {
  constructor(capacityOrOptions = DEFAULT_CAPACITY) {
    let capacity = capacityOrOptions
    let longTaskThresholdMs = DEFAULT_LONG_TASK_THRESHOLD_MS

    if (capacityOrOptions !== null && typeof capacityOrOptions === 'object') {
      capacity = capacityOrOptions.capacity ?? capacityOrOptions.size ?? DEFAULT_CAPACITY
      longTaskThresholdMs = capacityOrOptions.longTaskThresholdMs
        ?? capacityOrOptions.longTaskMs
        ?? DEFAULT_LONG_TASK_THRESHOLD_MS
    }

    capacity = Number(capacity)
    if (!Number.isFinite(capacity) || capacity < 1 || Math.floor(capacity) !== capacity) {
      throw new RangeError('FrameTelemetry2D capacity must be a positive integer')
    }

    longTaskThresholdMs = Number(longTaskThresholdMs)
    if (!Number.isFinite(longTaskThresholdMs) || longTaskThresholdMs < 0) {
      longTaskThresholdMs = DEFAULT_LONG_TASK_THRESHOLD_MS
    }

    this.capacity = capacity
    this.longTaskThresholdMs = longTaskThresholdMs
    this._intervalRing = new Float64Array(capacity)
    this._workRing = new Float64Array(capacity)
    this._simRing = new Float64Array(capacity)
    this._drawRing = new Float64Array(capacity)
    this._longTaskRing = new Uint8Array(capacity)
    this._intervalScratch = new Float64Array(capacity)
    this._workScratch = new Float64Array(capacity)
    this._simScratch = new Float64Array(capacity)
    this._drawScratch = new Float64Array(capacity)
    this._cursor = 0
    this._count = 0
    this._longTaskCount = 0
  }

  /**
   * Record one frame. Values that are NaN, infinite, negative, or nonnumeric
   * are stored as zero. The method performs no object/array allocation.
   *
   * Positional form:
   *   record(intervalMs, workMs, simMs, drawMs)
   *
   * Object form:
   *   record({ intervalMs, workMs, simMs, drawMs })
   */
  record(intervalMs, workMs = 0, simMs = 0, drawMs = 0) {
    if (intervalMs !== null && typeof intervalMs === 'object') {
      const sample = intervalMs
      intervalMs = sample.intervalMs ?? sample.frameIntervalMs ?? sample.frameMs ?? sample.interval
      workMs = sample.workMs ?? sample.work ?? 0
      simMs = sample.simMs ?? sample.simulationMs ?? sample.sim ?? 0
      drawMs = sample.drawMs ?? sample.draw ?? 0
    }

    const interval = finiteNonNegative(intervalMs)
    const work = finiteNonNegative(workMs)
    const sim = finiteNonNegative(simMs)
    const draw = finiteNonNegative(drawMs)
    const index = this._cursor

    if (this._count === this.capacity) {
      if (this._longTaskRing[index] !== 0) this._longTaskCount--
    } else {
      this._count++
    }

    this._intervalRing[index] = interval
    this._workRing[index] = work
    this._simRing[index] = sim
    this._drawRing[index] = draw

    const isLongTask = interval > this.longTaskThresholdMs || work > this.longTaskThresholdMs
    this._longTaskRing[index] = isLongTask ? 1 : 0
    if (isLongTask) this._longTaskCount++

    this._cursor++
    if (this._cursor === this.capacity) this._cursor = 0
    return this
  }

  /** Clear all samples while retaining the preallocated rings. */
  reset() {
    this._intervalRing.fill(0)
    this._workRing.fill(0)
    this._simRing.fill(0)
    this._drawRing.fill(0)
    this._longTaskRing.fill(0)
    this._cursor = 0
    this._count = 0
    this._longTaskCount = 0
    return this
  }

  /**
   * Return a JSON-safe, deeply immutable rolling snapshot.
   *
   * Percentiles are nearest-rank values: for n samples, p uses the element at
   * `ceil(n * p) - 1` after numeric ascending sort.
   */
  snapshot() {
    const sampleCount = this._count
    const interval = this._metricSnapshot(this._intervalRing, this._intervalScratch)
    const work = this._metricSnapshot(this._workRing, this._workScratch)
    const sim = this._metricSnapshot(this._simRing, this._simScratch)
    const draw = this._metricSnapshot(this._drawRing, this._drawScratch)
    const fps = interval.average > 0
      ? finiteJsonNumber(1000 / interval.average)
      : 0

    return Object.freeze({
      sampleCount,
      intervalMs: interval,
      workMs: work,
      simMs: sim,
      drawMs: draw,
      fps,
      longTaskCount: this._longTaskCount,
    })
  }

  _metricSnapshot(ring, scratch) {
    const count = this._count
    const capacity = this.capacity
    let index = count === capacity ? this._cursor : 0

    for (let i = 0; i < count; i++) {
      scratch[i] = ring[index]
      index++
      if (index === capacity) index = 0
    }
    // Typed-array sort covers the whole view. Keep unused slots above the
    // valid prefix at +Infinity so stale samples can never enter the metrics.
    for (let i = count; i < capacity; i++) scratch[i] = Number.POSITIVE_INFINITY
    scratch.sort()

    // Incremental averaging avoids an overflowing sum for valid, very large
    // finite samples and keeps every value in the JSON-safe snapshot finite.
    let average = 0
    let max = 0
    for (let i = 0; i < count; i++) {
      const value = scratch[i]
      average += (value - average) / (i + 1)
      if (value > max) max = value
    }

    return Object.freeze({
      average: finiteJsonNumber(average),
      p50: count === 0 ? 0 : nearestRank(scratch, count, 0.5),
      p95: count === 0 ? 0 : nearestRank(scratch, count, 0.95),
      p99: count === 0 ? 0 : nearestRank(scratch, count, 0.99),
      max: finiteJsonNumber(max),
    })
  }
}

export default FrameTelemetry2D
