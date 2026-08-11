import { describe, expect, it } from 'vitest'
import {
  RELEASE_DAO_BRANCHES_2D,
  runReleaseBranch2D,
  summarizeReleaseBranchRuns2D,
} from '../tools/yeongheo/branch-balance-sweep.mjs'

const SMOKE_SEEDS = Object.freeze([1, 123, 2024, 3185791507])

describe('release Dao branch fairness', () => {
  it('keeps every authored branch fair across ordinary first-card runs', () => {
    const runs = []
    for (const branch of RELEASE_DAO_BRANCHES_2D) {
      for (const seed of SMOKE_SEEDS) runs.push(runReleaseBranch2D(seed, branch))
    }

    const summary = summarizeReleaseBranchRuns2D(runs)
    expect(runs).toHaveLength(RELEASE_DAO_BRANCHES_2D.length * SMOKE_SEEDS.length)
    for (const branch of summary) {
      const diagnosis = JSON.stringify(branch)
      expect(branch.finalBossEntries, diagnosis).toBeGreaterThanOrEqual(3)
      expect(branch.victories, diagnosis).toBeGreaterThanOrEqual(3)
      expect(branch.winRate, diagnosis).toBeGreaterThanOrEqual(0.75)
      expect(branch.entryHpMin, diagnosis).toBeGreaterThanOrEqual(0.4)
      expect(branch.entryHpMedian, diagnosis).toBeGreaterThanOrEqual(0.55)
    }
  }, 60_000)
})
