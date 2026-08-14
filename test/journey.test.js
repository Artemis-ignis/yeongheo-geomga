import { describe, expect, it } from 'vitest'
import {
  JOURNEY_CHAPTERS,
  getJourneyChapter,
  journeyProgressFor,
  journeyLegacyFor,
  journeyRewardRoll,
  nextJourneyChapter,
} from '../src/data/journey.js'

describe('main journey contract', () => {
  it('authors story beats, distinct guardians, choices and a chapter boss outside the timed trial', () => {
    const chapter = getJourneyChapter('jade:guardian')
    expect(chapter.route).toHaveLength(3)
    expect(new Set(chapter.route.map((beat) => beat.id)).size).toBe(3)
    expect(new Set(chapter.route.map((beat) => beat.active)).size).toBe(3)
    expect(chapter.route[0].reward.kind).toBe('blessing-choice')
    expect(chapter.route[0].encounter.kind).toBe('investigation')
    expect(chapter.route[0].encounter.clues).toHaveLength(3)
    expect(new Set(chapter.route[0].encounter.clues.map((clue) => clue.type))).toEqual(new Set(['evidence', 'false_trace']))
    expect(chapter.route[0].reward.options).toHaveLength(3)
    expect(chapter.route[1].guardianBossId).toBe('blueWolfKing')
    expect(chapter.route[1].reward.kind).toBe('story-choice')
    expect(chapter.route[1].reward.options).toHaveLength(3)
    expect(new Set(chapter.route[1].reward.options.map((option) => option.id)).size).toBe(3)
    expect(chapter.route[2].guardians).toContain('demonCultivator')
    expect(chapter.boss.id).toBe('jadeVoidWarden')
    expect(JSON.stringify(chapter)).not.toContain('420')
  })

  it('reports persistent story progress without treating survival victories as chapters', () => {
    const progress = { state: { journey: { chaptersCleared: [], survivalVictories: 99 } } }
    expect(nextJourneyChapter(progress).id).toBe('jade:guardian')
    expect(journeyProgressFor(progress)).toMatchObject({ completed: 0, total: JOURNEY_CHAPTERS.length, complete: false })
    progress.state.journey.chaptersCleared.push('jade:guardian')
    expect(journeyProgressFor(progress)).toMatchObject({ completed: 1, complete: true })
  })

  it('keeps authored reward ranges deterministic and bounded', () => {
    expect(journeyRewardRoll([28, 45], 0)).toBe(28)
    expect(journeyRewardRoll([28, 45], 0.999999)).toBe(45)
    expect(journeyRewardRoll([28, 45], 0.5)).toBe(37)
  })

  it('turns a persistent story decision into an authored next-run legacy', () => {
    const chapter = getJourneyChapter('jade:guardian')
    expect(journeyLegacyFor(chapter, [{ choiceId: 'record-truth' }])).toMatchObject({
      choiceId: 'record-truth', name: '천하록의 진본', summary: expect.stringContaining('위력 +6%'),
    })
    expect(journeyLegacyFor(chapter, [{ choiceId: 'claim-seal' }]).mods).toHaveLength(2)
    expect(journeyLegacyFor(chapter, [])).toBeNull()
  })
})
