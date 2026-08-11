import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const manifestPath = path.join(
  root,
  'tools',
  'yeongheo',
  'recovered-provenance-manifest.json',
)

function sha256(relativePath) {
  const data = fs.readFileSync(path.join(root, relativePath))
  return crypto.createHash('sha256').update(data).digest('hex')
}

describe('recovered ImageGen provenance', () => {
  it('pins the recovered source and runtime files to the independently reproduced bytes', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    expect(manifest.legalRightsStatus).toBe('BLOCKED')
    expect(manifest.assets.map((asset) => asset.id)).toEqual([
      'AS-04',
      'AS-14',
      'AS-16',
    ])

    for (const asset of manifest.assets) {
      expect(asset.generationCallId).toMatch(/^exec-[0-9a-f-]{36}$/)
      expect(asset.revisedPromptSha256).toMatch(/^[0-9a-f]{64}$/)
      expect(asset.transformCommandLines.length).toBeGreaterThan(0)
      expect(sha256(asset.archivedOriginalPath)).toBe(asset.originalSha256)
      expect(sha256(asset.sourcePath)).toBe(asset.sourceSha256)
      expect(sha256(asset.runtimePath)).toBe(asset.runtimeSha256)
      expect(asset.sourceFileExact).toBe(true)
      expect(asset.sourcePixelExact).toBe(true)
      expect(asset.runtimeFileExact).toBe(true)
      expect(asset.runtimePixelExact).toBe(true)
    }

    expect(sha256(manifest.verificationReport)).toBe(
      manifest.verificationReportSha256,
    )
  })

  it('keeps technical lineage separate from legal rights clearance', () => {
    const disclosure = fs.readFileSync(
      path.join(root, 'public', 'AI_ASSET_DISCLOSURE_KO.txt'),
      'utf8',
    )
    const ledger = fs.readFileSync(
      path.join(root, 'docs', 'competition', 'ASSET_RIGHTS_LEDGER.md'),
      'utf8',
    )

    expect(disclosure).toContain('기술 provenance chain 76/76')
    expect(disclosure).toContain('법적 권리 증거 0/76')
    expect(ledger).toContain('technical_provenance_chain_verified: 76/76')
    expect(ledger).toContain('source_original_not_found: 0/76')
    expect(ledger).toContain('rights_evidence_confirmed: 0/76')
  })
})
