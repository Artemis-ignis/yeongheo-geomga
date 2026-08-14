import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPRITE_MANIFEST } from '../src/runtime2d/spriteManifest.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const HERO_REQUIRED_MOTIONS = Object.freeze({
  idle: 2, run: 4, dash: 3, attack: 4, hurt: 2, death: 3,
})
const ENEMY_REQUIRED_MOTIONS = Object.freeze({
  locomotion: 4, attack: 4, hurt: 2, death: 3,
})

function animationLength(actor, name) {
  const frames = actor?.animations?.[name]
  return Array.isArray(frames) ? frames.length : 0
}

function heroMotionLength(actor, name) {
  if (['idle', 'hurt', 'death'].includes(name)) {
    const frames = actor?.reactionAnimations?.[name]
    return Array.isArray(frames) ? frames.length : 0
  }
  return animationLength(actor, name)
}

function enemyMotionLength(actor, kind) {
  if (kind === 'locomotion') {
    return Math.max(animationLength(actor, 'walk'), animationLength(actor, 'hover'), animationLength(actor, 'idle'))
  }
  if (kind === 'attack') return Math.max(animationLength(actor, 'attack'), animationLength(actor, 'cast'))
  return animationLength(actor, kind)
}

function authoredEnemyViewCount(actor) {
  const views = new Set(actor?.directions ?? [])
  for (const direction of Object.keys(actor?.directionalRuntime ?? {})) views.add(direction)
  return views.size
}

export function auditActorMotionContracts(manifest = SPRITE_MANIFEST) {
  const blockers = []
  for (const [id, actor] of Object.entries(manifest.actors ?? {})) {
    const hero = id === 'seolryeong' || actor.role === 'hero'
    if (hero) {
      if (new Set(actor.directions ?? []).size < 5) {
        blockers.push(`motion:${id}.directions: ${(actor.directions ?? []).length}/5 authored views`)
      }
      for (const [motion, minimum] of Object.entries(HERO_REQUIRED_MOTIONS)) {
        const actual = heroMotionLength(actor, motion)
        if (actual < minimum) blockers.push(`motion:${id}.${motion}: ${actual}/${minimum} frames`)
      }
      continue
    }

    const authoredViews = authoredEnemyViewCount(actor)
    if (authoredViews < 3) blockers.push(`motion:${id}.directions: ${authoredViews}/3 authored views`)
    for (const [motion, minimum] of Object.entries(ENEMY_REQUIRED_MOTIONS)) {
      const actual = enemyMotionLength(actor, motion)
      if (actual < minimum) blockers.push(`motion:${id}.${motion}: ${actual}/${minimum} frames`)
    }
  }
  return blockers
}

export function auditCommercialQuality({
  readiness = JSON.parse(fs.readFileSync(path.join(root, 'quality/commercial-readiness.json'), 'utf8')),
  release = JSON.parse(fs.readFileSync(path.join(root, 'public/release.json'), 'utf8')),
  manifest = SPRITE_MANIFEST,
} = {}) {
  const blockers = []
  for (const blocker of readiness.blockers ?? []) {
    if (blocker.status !== 'CLOSED') blockers.push(`${blocker.id}: ${blocker.summary}`)
  }

  for (const [id, actor] of Object.entries(manifest.actors ?? {})) {
    if (actor.visualApproval !== 'approved') blockers.push(`actor:${id}: visual approval ${actor.visualApproval ?? 'missing'}`)
    if (actor.productionReady !== true) blockers.push(`actor:${id}: productionReady is not true`)
  }
  for (const [id, asset] of Object.entries(manifest.environment ?? {})) {
    if (asset.visualApproval !== 'approved') blockers.push(`environment:${id}: visual approval ${asset.visualApproval ?? 'missing'}`)
    if (asset.productionReady !== true) blockers.push(`environment:${id}: productionReady is not true`)
  }
  blockers.push(...auditActorMotionContracts(manifest))

  const requiredEvidence = [
    'immutableRunId', 'buildHash', 'chrome1920x1080', 'chrome2560x1600',
    'currentExpeditionFullRun', 'completeGameStructure', 'contentCompleteness',
    'performance', 'rightsLedger', 'humanVisualApproval',
  ]
  for (const key of requiredEvidence) {
    if (!readiness.evidence?.[key]) blockers.push(`evidence:${key}: missing`)
  }
  if (release.rightsGate !== 'PASS') blockers.push(`release:rightsGate: ${release.rightsGate ?? 'missing'}`)
  if ((release.rightsEvidenceConfirmed ?? 0) < (release.runtimeImageAssets ?? 0)) {
    blockers.push(`release:rightsEvidenceConfirmed: ${release.rightsEvidenceConfirmed ?? 0}/${release.runtimeImageAssets ?? 0}`)
  }
  if (readiness.commercialStatus !== 'CANDIDATE') {
    blockers.push(`readiness:commercialStatus: ${readiness.commercialStatus ?? 'missing'}`)
  }

  return {
    ok: blockers.length === 0,
    target: readiness.target,
    commercialStatus: blockers.length === 0 ? 'CANDIDATE' : 'BLOCKED',
    blockerCount: blockers.length,
    blockers,
  }
}

export function formatCommercialQualityReport(report) {
  return JSON.stringify(report, null, 2)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditCommercialQuality()
  process.stdout.write(`${formatCommercialQualityReport(report)}\n`)
  process.exitCode = report.ok ? 0 : 1
}
