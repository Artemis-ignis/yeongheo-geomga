import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildRightsReport } from '../tools/rights-audit.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const toolPath = path.join(root, 'tools', 'rights-audit.mjs')
const temporaryDirectories = []

function runCli(args = []) {
  return spawnSync(process.execPath, [toolPath, ...args], {
    cwd: root,
    encoding: 'utf8',
  })
}

function makeTemporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yeongheo-rights-audit-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('runtime asset rights audit CLI', () => {
  it('reports the current 0/77 gate as BLOCKED with a nonzero exit', () => {
    const result = runCli()

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('RIGHTS AUDIT: BLOCKED')
    expect(result.stdout).toContain('rights cleared: 0/77')
    expect(result.stdout).toContain('blocked: 77/77')
    expect(result.stdout).toContain('technical provenance does not clear legal rights: ENFORCED')
    expect(result.stderr).toBe('')
  })

  it('keeps --report-only at exit 0 while explicitly reporting BLOCKED', () => {
    const result = runCli(['--report-only'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('RIGHTS AUDIT: BLOCKED')
    expect(result.stdout).toContain('mode: REPORT-ONLY')
    expect(result.stdout).toContain('report-only: BLOCKED is reported but exit code is 0')
  })

  it('writes JSON only for an explicit output path and includes every asset field', () => {
    const directory = makeTemporaryDirectory()
    const outputPath = path.join(directory, 'rights-report.json')
    const result = runCli(['--output', outputPath])

    expect(result.status).toBe(1)
    expect(fs.existsSync(outputPath)).toBe(true)

    const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    expect(report.status).toBe('BLOCKED')
    expect(report.counts).toMatchObject({ total: 77, cleared: 0, blocked: 77 })
    expect(report.requirements.eachRuntimeAssetHasRightsStatus).toBe(false)
    expect(report.requirements.eachRuntimeAssetHasEvidence).toBe(false)
    expect(report.assets).toHaveLength(77)
    for (const asset of report.assets) {
      expect(asset.rightsStatus).toBe('BLOCKED')
      expect(asset.evidence.length).toBeGreaterThan(0)
      expect(asset.technicalProvenanceDoesNotClearRights).toBe(true)
    }
  })

  it('uses the current 77-row ledger section instead of historical fingerprint tables', () => {
    const report = buildRightsReport()

    expect(report.inputs.ledgerRowCount).toBe(77)
    expect(report.inputs.ledgerDuplicatePaths).toEqual([])
  })

  it('rejects an existing output without overwriting it', () => {
    const directory = makeTemporaryDirectory()
    const outputPath = path.join(directory, 'existing.json')
    fs.writeFileSync(outputPath, '{"sentinel":true}\n', 'utf8')

    const result = runCli(['--report-only', '--output', outputPath])

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('refusing to overwrite existing output')
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('{"sentinel":true}\n')
  })

  it('does not promote generated technical evidence to legal clearance', () => {
    const directory = makeTemporaryDirectory()
    const manifestPath = path.join(directory, 'tools', 'asset-manifest.json')
    const ledgerPath = path.join(directory, 'docs', 'competition', 'ASSET_RIGHTS_LEDGER.md')
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true })
    fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      runtimeRoot: 'public/assets',
      assets: [{
        id: 'fixture.generated',
        path: 'public/assets/fixture.png',
        source: 'imagegen',
        rightsStatus: 'CLEARED',
        rightsEvidence: [{
          type: 'technical-provenance',
          sha256: 'a'.repeat(64),
        }],
      }],
    }), 'utf8')
    fs.writeFileSync(ledgerPath, [
      '| ID | 제출 경로 | 분류 | 매니페스트 source | 증빙 | 권리 상태 |',
      '|---|---|---|---|---|---|',
      '| AS-01 | `public/assets/fixture.png` | `generated` | `imagegen` | source hash exact | `rightsStatus: CLEARED` |',
    ].join('\n') + '\n', 'utf8')

    const report = buildRightsReport({
      root: directory,
      runtimeAssets: ['assets/fixture.png'],
    })

    expect(report.status).toBe('BLOCKED')
    expect(report.counts).toMatchObject({ total: 1, cleared: 0, blocked: 1, withLegalEvidence: 0 })
    expect(report.assets[0].rightsStatus).toBe('BLOCKED')
    expect(report.assets[0].legalEvidenceSufficient).toBe(false)
    expect(report.assets[0].reasons).toContain(
      'evidence is technical provenance only; it cannot clear legal rights',
    )
    expect(report.requirements.technicalProvenanceCanClearRights).toBe(false)
  })
})
