import { describe, expect, it } from 'vitest'
import {
  JOURNEY_CHAPTERS,
  getJourneyChapter,
  journeyProgressFor,
  journeyLegacyFor,
  journeyLayoutFor,
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

  it('builds three deterministic expedition topologies with reachable required beats', () => {
    const chapter = getJourneyChapter('jade:guardian')
    const topologyIds = new Set()
    for (let seed = 0; seed < 100; seed++) {
      const layout = journeyLayoutFor(seed, chapter)
      const replay = journeyLayoutFor(seed, chapter)
      topologyIds.add(layout.topologyId)
      expect(layout).toEqual(replay)
      expect(layout.requiredIds).toHaveLength(3)
      expect(layout.nodes.length).toBeGreaterThanOrEqual(4)
      expect(layout.nodes.filter((node) => !node.required).length).toBeGreaterThanOrEqual(1)
      expect(new Set(layout.nodes.map((node) => node.id)).size).toBe(layout.nodes.length)

      const byId = new Map(layout.nodes.map((node) => [node.id, node]))
      const completed = new Set()
      let guard = 0
      while (completed.size < layout.nodes.length && guard++ < layout.nodes.length + 1) {
        for (const node of layout.nodes) {
          if (completed.has(node.id)) continue
          if (node.requires.every((requiredId) => completed.has(requiredId))) completed.add(node.id)
        }
      }
      expect(completed.size).toBe(layout.nodes.length)
      expect(layout.requiredIds.every((id) => byId.get(id)?.required && completed.has(id))).toBe(true)

      for (let i = 0; i < layout.nodes.length; i++) {
        for (let j = i + 1; j < layout.nodes.length; j++) {
          const a = layout.nodes[i].position
          const b = layout.nodes[j].position
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(4)
        }
      }
    }
    expect(topologyIds.size).toBeGreaterThanOrEqual(3)
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
