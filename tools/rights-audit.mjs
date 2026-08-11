#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SUBMISSION_RUNTIME_ASSETS,
} from './submission-assets.mjs'

/**
 * Independent legal-rights gate for the exact production asset allowlist.
 *
 * This intentionally does not treat generation, hashes, source chains, QA
 * passes, or a local provenance snapshot as legal clearance.  A future asset
 * may become CLEARED only when an explicit legal status and non-technical
 * rights evidence are both present in the input metadata.
 */

export const WORKSPACE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

export const DEFAULT_INPUTS = Object.freeze({
  manifest: 'tools/asset-manifest.json',
  allowlist: 'tools/submission-assets.mjs',
  ledger: 'docs/competition/ASSET_RIGHTS_LEDGER.md',
})

export const RIGHTS_STATUS = Object.freeze({
  BLOCKED: 'BLOCKED',
  CLEARED: 'CLEARED',
})

const CLI_EXIT = Object.freeze({
  OK: 0,
  BLOCKED: 1,
  USAGE: 2,
})

const TECHNICAL_SOURCE_PATTERN = /(?:generated|imagegen|atlas|chroma|img2three|trellis|forge|procedural|technical|source[- ]?chain|qa|hash|sha)/i
const LEGAL_EVIDENCE_PATTERN = /(?:legal|right|license|licen[cs]e|permission|consent|term|ownership|owner|holder|approval|approved|contract|release|copyright|commercial|contest)/i
function normalizePath(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
}

function manifestPathForRuntimePath(runtimePath) {
  const normalized = normalizePath(runtimePath)
  return normalized.startsWith('public/')
    ? normalized
    : `public/${normalized}`
}

function readJson(filePath) {
  let text
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    throw new Error(`unable to read JSON input ${filePath}: ${error.message}`)
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`unable to parse JSON input ${filePath}: ${error.message}`)
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    throw new Error(`unable to read text input ${filePath}: ${error.message}`)
  }
}

function resolveInput(root, relativeOrAbsolute) {
  if (path.isAbsolute(relativeOrAbsolute)) return path.normalize(relativeOrAbsolute)
  return path.resolve(root, relativeOrAbsolute)
}

function splitMarkdownRow(line) {
  let body = line.trim()
  if (body.startsWith('|')) body = body.slice(1)
  if (body.endsWith('|')) body = body.slice(0, -1)
  return body.split('|').map((cell) => cell.trim())
}

function cleanMarkdownCell(value) {
  return String(value ?? '')
    .replaceAll('`', '')
    .replaceAll('**', '')
    .trim()
}

/**
 * Parse the current AS inventory table without trusting its prose as legal approval.
 * The final cell is retained as a human-readable evidence excerpt.
 */
export function parseRightsLedger(markdown) {
  const rows = []
  const rowsByPath = new Map()
  const duplicatePaths = []
  const allLines = String(markdown ?? '').split(/\r?\n/)
  const sectionStart = allLines.findIndex((line) =>
    /^##\s+제출 포함 자산 원장/.test(line.trim()),
  )
  let lines = allLines
  if (sectionStart >= 0) {
    const sectionEndOffset = allLines
      .slice(sectionStart + 1)
      .findIndex((line) => /^#{2,3}\s+/.test(line.trim()))
    const sectionEnd = sectionEndOffset >= 0
      ? sectionStart + 1 + sectionEndOffset
      : allLines.length
    lines = allLines.slice(sectionStart + 1, sectionEnd)
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!/^\|\s*AS-\d+\s*\|/.test(line)) continue

    const cells = splitMarkdownRow(line)
    if (cells.length < 3) continue

    const id = cleanMarkdownCell(cells[0])
    const assetPath = normalizePath(cleanMarkdownCell(cells[1]))
    const classification = cleanMarkdownCell(cells[2]) || null
    const technicalSource = cleanMarkdownCell(cells[3]) || null
    const rightsCell = cleanMarkdownCell(cells[cells.length - 1])
    const row = {
      id,
      path: assetPath,
      classification,
      technicalSource,
      rightsCell,
      line: index + 1,
      raw: line,
    }

    if (rowsByPath.has(assetPath)) {
      duplicatePaths.push(assetPath)
      continue
    }
    rowsByPath.set(assetPath, row)
    rows.push(row)
  }

  return { rows, rowsByPath, duplicatePaths }
}

function normalizeStatus(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim().toUpperCase()
  if (!normalized) return null

  if (['BLOCKED', 'DENIED', 'PENDING', 'UNCONFIRMED', 'UNKNOWN', 'REJECTED'].includes(normalized)) {
    return RIGHTS_STATUS.BLOCKED
  }
  if (['CLEARED', 'CONFIRMED', 'APPROVED', 'OWN', 'LICENSED'].includes(normalized)) {
    return RIGHTS_STATUS.CLEARED
  }
  return null
}

function explicitRightsStatus(manifestAsset, ledgerRow) {
  const candidates = [
    manifestAsset?.rightsStatus,
    manifestAsset?.legalRightsStatus,
    manifestAsset?.rights?.status,
    ledgerRow?.rightsStatus,
    ledgerRow?.legalRightsStatus,
  ]

  for (const candidate of candidates) {
    const status = normalizeStatus(candidate)
    if (status) return status
  }

  // A machine-readable marker is accepted from a future ledger revision.  Do
  // not infer a legal status from ordinary prose such as "rights unconfirmed".
  const marker = String(ledgerRow?.raw ?? '').match(
    /(?:rightsStatus|legalRightsStatus)\s*[:=]\s*`?([A-Za-z_-]+)`?/i,
  )
  return normalizeStatus(marker?.[1])
}

function asEvidenceArray(value) {
  if (value === null || value === undefined) return []
  const values = Array.isArray(value) ? value : [value]
  return values
    .filter((item) => item !== null && item !== undefined && String(item).trim() !== '')
    .map((item) => {
      if (typeof item === 'string') return { reference: item }
      if (typeof item === 'object') return { ...item }
      return { reference: String(item) }
    })
}

function legalEvidenceFor(manifestAsset) {
  const evidence = []
  if (manifestAsset?.rightsEvidence !== undefined) {
    evidence.push(...asEvidenceArray(manifestAsset.rightsEvidence))
  }
  if (manifestAsset?.legalEvidence !== undefined) {
    evidence.push(...asEvidenceArray(manifestAsset.legalEvidence))
  }
  if (manifestAsset?.rights?.evidence !== undefined) {
    evidence.push(...asEvidenceArray(manifestAsset.rights.evidence))
  }

  // A generic `evidence` field is accepted only when it is explicitly present
  // on the asset.  The current manifest has no such field, so this remains a
  // fail-closed extension point rather than a technical-provenance shortcut.
  if (manifestAsset?.evidence !== undefined) {
    evidence.push(...asEvidenceArray(manifestAsset.evidence))
  }
  return evidence
}

function evidenceText(evidence) {
  return evidence
    .map((item) => Object.entries(item).map(([key, value]) => `${key}:${value}`).join(' '))
    .join(' ')
}

function hasNonTechnicalLegalEvidence(evidence) {
  return evidence.some((item) => {
    const type = String(item.type ?? item.kind ?? '').toLowerCase()
    const text = evidenceText([item])
    if (type && /technical|provenance|hash|sha|source|qa|generated/.test(type)) return false
    return !TECHNICAL_SOURCE_PATTERN.test(text) && LEGAL_EVIDENCE_PATTERN.test(text)
  })
}

function technicalProvenanceFor(manifestAsset, ledgerRow) {
  const source = manifestAsset?.source ?? ledgerRow?.technicalSource ?? null
  const classification = manifestAsset?.classification
    ?? ledgerRow?.classification
    ?? (source ? 'generated' : 'unknown')
  return {
    source,
    classification,
    legalClearance: false,
    legalClearanceRule: 'technical provenance is never legal clearance',
  }
}

function manifestByPath(manifest) {
  const map = new Map()
  const duplicates = []
  for (const asset of Array.isArray(manifest?.assets) ? manifest.assets : []) {
    const assetPath = normalizePath(asset?.path)
    if (!assetPath) continue
    if (map.has(assetPath)) duplicates.push(assetPath)
    else map.set(assetPath, asset)
  }
  return { map, duplicates }
}

function requiredEvidenceReferences({
  manifestAsset,
  manifestEvidencePath,
  manifestPath,
  ledgerPath,
  ledgerRow,
  technical,
}) {
  const evidence = []
  if (manifestAsset) {
    evidence.push({
      kind: 'manifest',
      path: manifestEvidencePath,
      assetId: manifestAsset.id ?? null,
      technicalSource: manifestAsset.source ?? null,
    })
  } else {
    evidence.push({
      kind: 'missing-manifest-entry',
      path: manifestPath,
    })
  }

  if (ledgerRow) {
    evidence.push({
      kind: 'rights-ledger',
      path: ledgerPath,
      line: ledgerRow.line,
      assetId: ledgerRow.id,
      excerpt: ledgerRow.rightsCell || null,
    })
  } else {
    evidence.push({
      kind: 'missing-rights-ledger-entry',
      path: ledgerPath,
    })
  }

  evidence.push({
    kind: 'technical-provenance',
    source: technical.source,
    classification: technical.classification,
    legalClearance: false,
  })
  return evidence
}

function assessAsset({
  runtimePath,
  manifestAsset,
  ledgerRow,
  manifestEvidencePath,
  ledgerPath,
}) {
  const manifestPath = manifestPathForRuntimePath(runtimePath)
  const technical = technicalProvenanceFor(manifestAsset, ledgerRow)
  const legalEvidence = legalEvidenceFor(manifestAsset)
  const declaredStatus = explicitRightsStatus(manifestAsset, ledgerRow)
  const nonTechnicalEvidence = hasNonTechnicalLegalEvidence(legalEvidence)
  const reasons = []

  if (!manifestAsset) reasons.push('runtime asset is missing from asset manifest')
  if (!ledgerRow) reasons.push('runtime asset is missing from rights ledger')
  if (!declaredStatus) reasons.push('no explicit legal rightsStatus is declared')
  if (!legalEvidence.length) reasons.push('no legal rights evidence is declared')
  if (legalEvidence.length && !nonTechnicalEvidence) {
    reasons.push('evidence is technical provenance only; it cannot clear legal rights')
  }
  if (declaredStatus !== RIGHTS_STATUS.CLEARED) {
    reasons.push(`legal rights status is ${declaredStatus ?? 'MISSING'}`)
  }

  const rightsStatus = declaredStatus === RIGHTS_STATUS.CLEARED
    && legalEvidence.length > 0
    && nonTechnicalEvidence
    && Boolean(manifestAsset)
    && Boolean(ledgerRow)
    ? RIGHTS_STATUS.CLEARED
    : RIGHTS_STATUS.BLOCKED

  const evidence = requiredEvidenceReferences({
    manifestAsset,
    manifestEvidencePath,
    manifestPath,
    ledgerPath,
    ledgerRow,
    technical,
  })

  return {
    id: ledgerRow?.id ?? manifestAsset?.id ?? null,
    runtimePath: normalizePath(runtimePath),
    manifestPath,
    ledgerPath,
    rightsStatus,
    declaredRightsStatus: declaredStatus,
    evidence,
    legalEvidence,
    legalEvidenceSufficient: nonTechnicalEvidence,
    technicalProvenance: technical,
    technicalProvenanceDoesNotClearRights: true,
    reasons: [...new Set(reasons)],
  }
}

/**
 * Build a deterministic rights report from the existing manifest, allowlist,
 * and markdown ledger.  `runtimeAssets` is injectable for unit tests; normal
 * CLI execution always uses the imported SUBMISSION_RUNTIME_ASSETS allowlist.
 */
export function buildRightsReport({
  root = WORKSPACE_ROOT,
  manifestPath = DEFAULT_INPUTS.manifest,
  ledgerPath = DEFAULT_INPUTS.ledger,
  runtimeAssets = SUBMISSION_RUNTIME_ASSETS,
} = {}) {
  const workspaceRoot = path.resolve(root)
  const absoluteManifestPath = resolveInput(workspaceRoot, manifestPath)
  const absoluteLedgerPath = resolveInput(workspaceRoot, ledgerPath)
  const manifest = readJson(absoluteManifestPath)
  const ledgerText = readText(absoluteLedgerPath)
  const ledger = parseRightsLedger(ledgerText)
  const manifestIndex = manifestByPath(manifest)
  const allowlist = [...runtimeAssets].map(normalizePath)
  const allowlistDuplicates = allowlist.filter((item, index) => allowlist.indexOf(item) !== index)
  const reportLedgerPath = normalizePath(path.relative(workspaceRoot, absoluteLedgerPath))
  const reportManifestPath = normalizePath(path.relative(workspaceRoot, absoluteManifestPath))
  const assets = allowlist.map((runtimePath) => {
    const manifestPathForAsset = manifestPathForRuntimePath(runtimePath)
    const ledgerRow = ledger.rowsByPath.get(manifestPathForAsset)
    return assessAsset({
      runtimePath,
      manifestAsset: manifestIndex.map.get(manifestPathForAsset),
      ledgerRow,
      manifestEvidencePath: reportManifestPath,
      ledgerPath: reportLedgerPath,
    })
  })

  const cleared = assets.filter((asset) => asset.rightsStatus === RIGHTS_STATUS.CLEARED)
  const blocked = assets.filter((asset) => asset.rightsStatus === RIGHTS_STATUS.BLOCKED)
  const withDeclaredRightsStatus = assets.filter((asset) => asset.declaredRightsStatus !== null)
  const withLegalEvidence = assets.filter((asset) => asset.legalEvidenceSufficient)
  const allHaveEvidenceReferences = assets.every((asset) =>
    Array.isArray(asset.evidence) && asset.evidence.length > 0,
  )

  return {
    schemaVersion: 1,
    reportType: 'runtime-asset-rights-audit',
    status: blocked.length === 0 && assets.length > 0
      ? RIGHTS_STATUS.CLEARED
      : RIGHTS_STATUS.BLOCKED,
    counts: {
      total: assets.length,
      cleared: cleared.length,
      blocked: blocked.length,
      withDeclaredRightsStatus: withDeclaredRightsStatus.length,
      withEvidenceReferences: assets.filter((asset) => asset.evidence.length > 0).length,
      withLegalEvidence: withLegalEvidence.length,
    },
    requirements: {
      eachRuntimeAssetHasRightsStatus: assets.every((asset) => asset.declaredRightsStatus !== null),
      eachRuntimeAssetHasEvidence: assets.every((asset) => asset.legalEvidenceSufficient),
      eachRuntimeAssetHasLegalEvidence: assets.every((asset) => asset.legalEvidenceSufficient),
      technicalProvenanceCanClearRights: false,
    },
    inputs: {
      manifest: normalizePath(path.relative(workspaceRoot, absoluteManifestPath)),
      allowlist: DEFAULT_INPUTS.allowlist,
      ledger: reportLedgerPath,
      manifestAssetCount: Array.isArray(manifest?.assets) ? manifest.assets.length : 0,
      ledgerRowCount: ledger.rows.length,
      allowlistAssetCount: allowlist.length,
      manifestDuplicatePaths: manifestIndex.duplicates,
      ledgerDuplicatePaths: ledger.duplicatePaths,
      allowlistDuplicates: [...new Set(allowlistDuplicates)],
    },
    assets,
    policy: {
      generatedIsNotLegalClearance: true,
      technicalProvenanceIsNotLegalClearance: true,
      defaultCurrentLedgerDecision: 'BLOCKED',
    },
  }
}

export function parseCliArgs(argv = []) {
  const options = {
    reportOnly: false,
    output: null,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--report-only') {
      options.reportOnly = true
      continue
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }
    if (argument === '--output') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error('--output requires an explicit file path')
      }
      options.output = value
      index += 1
      continue
    }
    if (argument.startsWith('--output=')) {
      const value = argument.slice('--output='.length)
      if (!value) throw new Error('--output requires an explicit file path')
      options.output = value
      continue
    }
    throw new Error(`unknown argument: ${argument}`)
  }

  return options
}

export function writeJsonReportExclusive(report, outputPath, { cwd = process.cwd() } = {}) {
  if (!outputPath) throw new Error('refusing to write a JSON report without explicit --output')
  const absolutePath = path.resolve(cwd, outputPath)
  if (fs.existsSync(absolutePath)) {
    throw new Error(`refusing to overwrite existing output: ${absolutePath}`)
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  let descriptor
  try {
    descriptor = fs.openSync(absolutePath, 'wx')
    fs.writeFileSync(descriptor, serialized, 'utf8')
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`refusing to overwrite existing output: ${absolutePath}`)
    }
    throw new Error(`unable to write JSON report ${absolutePath}: ${error.message}`)
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor)
  }
  return absolutePath
}

export function renderSummary(report, { reportOnly = false } = {}) {
  const mode = reportOnly ? 'REPORT-ONLY' : 'GATE'
  const lines = [
    `RIGHTS AUDIT: ${report.status}`,
    `runtime assets: ${report.counts.total}`,
    `rights cleared: ${report.counts.cleared}/${report.counts.total}`,
    `blocked: ${report.counts.blocked}/${report.counts.total}`,
    `declared rightsStatus: ${report.counts.withDeclaredRightsStatus}/${report.counts.total}`,
    `legal rights evidence: ${report.counts.withLegalEvidence}/${report.counts.total}`,
    'technical provenance does not clear legal rights: ENFORCED',
    `mode: ${mode}`,
  ]
  if (reportOnly && report.status === RIGHTS_STATUS.BLOCKED) {
    lines.push('report-only: BLOCKED is reported but exit code is 0')
  }
  return lines.join('\n')
}

export function main(
  argv = process.argv.slice(2),
  {
    root = WORKSPACE_ROOT,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) {
  let options
  try {
    options = parseCliArgs(argv)
  } catch (error) {
    stderr.write(`rights-audit: ${error.message}\n`)
    return CLI_EXIT.USAGE
  }

  if (options.help) {
    stdout.write([
      'Usage: node tools/rights-audit.mjs [--report-only] [--output <path>]',
      '',
      'Audits every runtime allowlist asset for explicit legal rights status and evidence.',
      'JSON is written only when --output is supplied, and existing files are never overwritten.',
      'Without --report-only, BLOCKED exits with code 1.',
    ].join('\n') + '\n')
    return CLI_EXIT.OK
  }

  let report
  try {
    report = buildRightsReport({ root })
    if (options.output) writeJsonReportExclusive(report, options.output)
  } catch (error) {
    stderr.write(`rights-audit: ${error.message}\n`)
    return CLI_EXIT.USAGE
  }

  stdout.write(renderSummary(report, options) + '\n')
  if (report.status === RIGHTS_STATUS.BLOCKED && !options.reportOnly) return CLI_EXIT.BLOCKED
  return CLI_EXIT.OK
}

const isEntrypoint = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isEntrypoint) process.exitCode = main()
