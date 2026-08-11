import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const workspaceRoot = process.cwd()
const scriptSource = path.join(workspaceRoot, 'tools', 'yeongheo', 'prune-qa-artifacts.ps1')
const temporaryRoots = []

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yeongheo-qa-retention-'))
  temporaryRoots.push(root)
  fs.mkdirSync(path.join(root, 'tools', 'yeongheo'), { recursive: true })
  fs.copyFileSync(scriptSource, path.join(root, 'tools', 'yeongheo', 'prune-qa-artifacts.ps1'))
  return root
}

function writeFixture(root, relativePath, contents = relativePath) {
  const absolute = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  fs.writeFileSync(absolute, contents, 'utf8')
  return absolute
}

function invokePruner(root, ...arguments_) {
  const script = path.join(root, 'tools', 'yeongheo', 'prune-qa-artifacts.ps1')
  return spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      '-Workspace',
      root,
      ...arguments_,
    ],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  )
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    fs.rmSync(temporaryRoots.pop(), { recursive: true, force: true })
  }
})

describe('QA artifact retention boundary', () => {
  it('preserves existing ignore rules and blocks only the requested local dumps', () => {
    const ignore = fs.readFileSync(path.join(workspaceRoot, '.gitignore'), 'utf8')
    for (const rule of [
      'node_modules/',
      'dist/',
      '.shots/',
      '/.img2threejs/',
      '/.playwright-cli/',
      '/output/',
      '/tmp/',
      '/artifacts/2d-build/',
      '/artifacts/2d-qa/',
    ]) {
      expect(ignore).toContain(rule)
    }
    expect(ignore).toContain('already committed')
  })

  it('defaults to a dry-run and only discovers qa/runs plus explicit temporary paths', () => {
    const root = fixtureRoot()
    const runCandidate = writeFixture(root, 'output/qa/runs/run-a/old.json', 'old')
    const nonTarget = writeFixture(root, 'output/qa/not-explicit.tmp.json', 'keep')
    const before = fs.readFileSync(runCandidate)

    const result = invokePruner(root)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('mode=DRY_RUN')
    expect(result.stdout).toContain('output/qa/runs/run-a/old.json')
    expect(result.stdout).not.toContain('output/qa/not-explicit.tmp.json')
    expect(fs.readFileSync(runCandidate)).toEqual(before)
    expect(fs.readFileSync(nonTarget, 'utf8')).toBe('keep')
  })

  it('requires a retention manifest before Apply and leaves files untouched', () => {
    const root = fixtureRoot()
    const candidate = writeFixture(root, 'output/qa/runs/run-a/old.json', 'old')

    const result = invokePruner(root, '-Apply')

    expect(result.status).not.toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain('RetentionManifest')
    expect(fs.existsSync(candidate)).toBe(true)
  })

  it('accepts Apply only with a non-empty manifest and honors WhatIf without deleting', () => {
    const root = fixtureRoot()
    const candidate = writeFixture(root, 'output/qa/runs/run-a/old.json', 'old')
    writeFixture(root, 'output/qa/keep.json', 'keep')
    const manifest = writeFixture(
      root,
      'retention-manifest.json',
      JSON.stringify({ schemaVersion: 1, retainedPaths: ['output/qa/keep.json'] }),
    )

    const result = invokePruner(
      root,
      '-Apply',
      '-RetentionManifest',
      manifest,
      '-WhatIf',
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('mode=APPLY')
    expect(`${result.stdout}\n${result.stderr}`).toContain('WhatIf')
    expect(fs.existsSync(candidate)).toBe(true)
  })

  it('supports an explicit temporary file in dry-run without touching it', () => {
    const root = fixtureRoot()
    const candidate = writeFixture(root, 'output/qa/temporary.tmp.webm', 'temporary')
    const before = fs.readFileSync(candidate)

    const result = invokePruner(root, '-TemporaryPath', 'output/qa/temporary.tmp.webm')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('output/qa/temporary.tmp.webm')
    expect(fs.readFileSync(candidate)).toEqual(before)
  })

  it('rejects outside paths and immutable release/current-v5.3 evidence paths', () => {
    const root = fixtureRoot()
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yeongheo-qa-outside-'))
    temporaryRoots.push(outsideRoot)
    const outside = writeFixture(outsideRoot, 'outside.tmp', 'outside')
    const release = writeFixture(root, 'output/releases/yeongheo-geomga-web-release-v5.3-20260810.zip', 'release')
    const evidence = writeFixture(root, 'output/qa/v5.3-final-seal-20260810.json', 'evidence')

    const outsideResult = invokePruner(root, '-TemporaryPath', outside)
    expect(outsideResult.status).not.toBe(0)
    expect(fs.existsSync(outside)).toBe(true)

    const releaseResult = invokePruner(root, '-TemporaryPath', 'output/releases/yeongheo-geomga-web-release-v5.3-20260810.zip')
    expect(releaseResult.status).not.toBe(0)
    expect(fs.existsSync(release)).toBe(true)

    const evidenceResult = invokePruner(root, '-TemporaryPath', 'output/qa/v5.3-final-seal-20260810.json')
    expect(evidenceResult.status).not.toBe(0)
    expect(fs.existsSync(evidence)).toBe(true)
  })

  it('documents tracked-file protection and the immutable v5.3 boundary in the script', () => {
    const source = fs.readFileSync(scriptSource, 'utf8')
    expect(source).toContain('ls-files --cached')
    expect(source).toContain('output/releases')
    expect(source).toContain('output/qa/v5.3-final-seal-20260810.json')
    expect(source).toContain('output/playwright/v5.3-bannerfix-current-package-video/fullrun-record-report.json')
    expect(source).toContain('retainedPaths')
    expect(source).toContain("-Apply에는 -RetentionManifest가 반드시 필요합니다.")
  })
})
