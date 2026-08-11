import { describe, expect, it } from 'vitest'
import { FrameTelemetry2D } from '../src/runtime2d/FrameTelemetry2D.js'

describe('FrameTelemetry2D', () => {
  it('computes partial-window metrics without stale scratch samples', () => {
    const telemetry = new FrameTelemetry2D(4)
    telemetry.record(10, 2, 3, 4)

    expect(telemetry.snapshot()).toEqual({
      sampleCount: 1,
      intervalMs: { average: 10, p50: 10, p95: 10, p99: 10, max: 10 },
      workMs: { average: 2, p50: 2, p95: 2, p99: 2, max: 2 },
      simMs: { average: 3, p50: 3, p95: 3, p99: 3, max: 3 },
      drawMs: { average: 4, p50: 4, p95: 4, p99: 4, max: 4 },
      fps: 100,
      longTaskCount: 0,
    })
  })

  it('keeps a fixed rolling window and computes deterministic metrics', () => {
    const telemetry = new FrameTelemetry2D(4)

    telemetry.record(10, 1, 2, 3)
    telemetry.record(20, 2, 3, 4)
    telemetry.record(30, 3, 4, 5)
    telemetry.record(40, 4, 5, 6)
    telemetry.record(60, 6, 7, 8)

    expect(telemetry.snapshot()).toEqual({
      sampleCount: 4,
      intervalMs: { average: 37.5, p50: 30, p95: 60, p99: 60, max: 60 },
      workMs: { average: 3.75, p50: 3, p95: 6, p99: 6, max: 6 },
      simMs: { average: 4.75, p50: 4, p95: 7, p99: 7, max: 7 },
      drawMs: { average: 5.75, p50: 5, p95: 8, p99: 8, max: 8 },
      fps: 1000 / 37.5,
      longTaskCount: 1,
    })
  })

  it('accepts object samples and safely clamps invalid values', () => {
    const telemetry = new FrameTelemetry2D({ capacity: 3 })

    telemetry.record({ intervalMs: Number.NaN, workMs: -1, simMs: Number.POSITIVE_INFINITY, drawMs: 4 })
    telemetry.record({ frameMs: 25, work: 5, simulationMs: 2, draw: Number.NaN })
    telemetry.record(-10, Number.NaN, -4, Number.NEGATIVE_INFINITY)

    const snapshot = telemetry.snapshot()
    expect(snapshot.sampleCount).toBe(3)
    expect(snapshot.intervalMs).toEqual({ average: 25 / 3, p50: 0, p95: 25, p99: 25, max: 25 })
    expect(snapshot.workMs).toEqual({ average: 5 / 3, p50: 0, p95: 5, p99: 5, max: 5 })
    expect(snapshot.simMs).toEqual({ average: 2 / 3, p50: 0, p95: 2, p99: 2, max: 2 })
    expect(snapshot.drawMs).toEqual({ average: 4 / 3, p50: 0, p95: 4, p99: 4, max: 4 })
    expect(snapshot.fps).toBeCloseTo(120, 12)
    expect(snapshot.longTaskCount).toBe(0)
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('returns deeply immutable snapshots and reset clears the rolling state', () => {
    const telemetry = new FrameTelemetry2D(2)
    const intervalRing = telemetry._intervalRing
    telemetry.record(16.6667, 2, 1, 1)

    const snapshot = telemetry.snapshot()
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.intervalMs)).toBe(true)
    expect(() => { snapshot.intervalMs.average = 999 }).toThrow()

    telemetry.reset()
    expect(telemetry._intervalRing).toBe(intervalRing)
    expect(telemetry.snapshot()).toEqual({
      sampleCount: 0,
      intervalMs: { average: 0, p50: 0, p95: 0, p99: 0, max: 0 },
      workMs: { average: 0, p50: 0, p95: 0, p99: 0, max: 0 },
      simMs: { average: 0, p50: 0, p95: 0, p99: 0, max: 0 },
      drawMs: { average: 0, p50: 0, p95: 0, p99: 0, max: 0 },
      fps: 0,
      longTaskCount: 0,
    })
  })

  it('does not replace the preallocated rings while recording', () => {
    const telemetry = new FrameTelemetry2D(8)
    const rings = [
      telemetry._intervalRing,
      telemetry._workRing,
      telemetry._simRing,
      telemetry._drawRing,
      telemetry._longTaskRing,
    ]

    for (let i = 0; i < 1000; i++) telemetry.record(16 + (i % 3), 2, 1, 1)

    expect([
      telemetry._intervalRing,
      telemetry._workRing,
      telemetry._simRing,
      telemetry._drawRing,
      telemetry._longTaskRing,
    ]).toEqual(rings)
    expect(telemetry.snapshot().sampleCount).toBe(8)
  })
})
