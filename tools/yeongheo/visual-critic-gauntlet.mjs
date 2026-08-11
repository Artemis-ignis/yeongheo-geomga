import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const SCRIPT_DIR = path.dirname(SCRIPT_PATH)
export const WORKSPACE_ROOT = path.resolve(SCRIPT_DIR, '..', '..')
export const RUBRIC_PATH = path.join(SCRIPT_DIR, 'visual-critic-rubric.json')
export const DEFAULT_RUNS_ROOT = path.join(WORKSPACE_ROOT, 'output', 'qa', 'runs')

export const EXIT_CODES = Object.freeze({
  OK: 0,
  INVALID_INPUT: 1,
  CONTRACT_ONLY: 2,
})

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/
const ARTIFACT_FIELDS = Object.freeze(['screenshot', 'console', 'page', 'layout', 'luma'])
const ARTIFACT_STATUSES = Object.freeze(['NOT_CAPTURED', 'CAPTURED'])
const MANIFEST_VERDICTS = Object.freeze([
  'NOT_RUN',
  'INCOMPLETE',
  'EVIDENCE_PENDING_CRITIC',
  'BLOCKED',
])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function fail(message) {
  throw new Error(message)
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object.`)
  }
  return value
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string.`)
  return value
}

function requireKeys(value, keys, label) {
  requireObject(value, label)
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${label}.${key} is required.`)
  }
  return value
}

function requireFiniteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite.`)
  return value
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) fail(`${label} must be a positive integer.`)
  return value
}

export function assertRunId(value) {
  requireString(value, 'runId')
  if (!RUN_ID_PATTERN.test(value) || value === '.' || value === '..') {
    fail('runId must contain only letters, numbers, dot, underscore or hyphen and cannot be a path.')
  }
  return value
}

export function assertSha256(value, label = 'sha256') {
  requireString(value, label)
  if (!SHA256_PATTERN.test(value)) fail(`${label} must be a lowercase 64-character SHA-256 hex string.`)
  return value
}

export function parseSeed(value) {
  const seed = Number(value)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    fail('seed must be an unsigned 32-bit integer.')
  }
  return seed
}

export function parseViewport(value, deviceScaleFactor = 1) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const width = Number(value.width)
    const height = Number(value.height)
    const dpr = Number(value.deviceScaleFactor ?? deviceScaleFactor)
    requirePositiveInteger(width, 'viewport.width')
    requirePositiveInteger(height, 'viewport.height')
    if (!Number.isFinite(dpr) || dpr <= 0) fail('viewport.deviceScaleFactor must be positive.')
    return { width, height, deviceScaleFactor: dpr }
  }

  const match = String(value ?? '').trim().match(/^(\d+)x(\d+)$/i)
  if (!match) fail('viewport must use WIDTHxHEIGHT, for example 1920x1080.')
  return parseViewport({
    width: Number(match[1]),
    height: Number(match[2]),
    deviceScaleFactor,
  })
}

function assertViewport(value, label = 'viewport') {
  requireKeys(value, ['width', 'height', 'deviceScaleFactor'], label)
  requirePositiveInteger(value.width, `${label}.width`)
  requirePositiveInteger(value.height, `${label}.height`)
  if (typeof value.deviceScaleFactor !== 'number' || !Number.isFinite(value.deviceScaleFactor) || value.deviceScaleFactor <= 0) {
    fail(`${label}.deviceScaleFactor must be positive.`)
  }
  return value
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`Unable to read JSON ${filePath}: ${error.message}`)
  }
}

export function assertRubricContract(rubric) {
  requireKeys(rubric, ['schemaVersion', 'kind', 'canonicalStateCount', 'canonicalStates', 'artifactSchema'], 'rubric')
  if (rubric.schemaVersion !== 1) fail('rubric.schemaVersion must be 1.')
  if (rubric.kind !== 'yeongheo-visual-critic-rubric') fail('rubric.kind is not recognised.')
  if (!Array.isArray(rubric.canonicalStates)) fail('rubric.canonicalStates must be an array.')
  if (rubric.canonicalStateCount !== rubric.canonicalStates.length || rubric.canonicalStateCount !== 10) {
    fail('rubric must define exactly 10 canonical states.')
  }
  const seen = new Set()
  for (const [index, state] of rubric.canonicalStates.entries()) {
    requireKeys(state, [
      'id',
      'label',
      'viewportProfiles',
      'capture',
      'expected',
      'requiredSelectors',
      'criticalFeatures',
      'artifactFields',
    ], `rubric.canonicalStates[${index}]`)
    requireString(state.id, `rubric.canonicalStates[${index}].id`)
    if (seen.has(state.id)) fail(`rubric contains duplicate canonical state ${state.id}.`)
    seen.add(state.id)
    if (!Array.isArray(state.viewportProfiles) || state.viewportProfiles.length === 0) {
      fail(`canonical state ${state.id} must define a viewport profile.`)
    }
    for (const [profileIndex, profile] of state.viewportProfiles.entries()) {
      assertViewport(profile, `canonical state ${state.id}.viewportProfiles[${profileIndex}]`)
    }
    if (!Array.isArray(state.requiredSelectors) || state.requiredSelectors.length === 0) {
      fail(`canonical state ${state.id} must define requiredSelectors.`)
    }
    if (!Array.isArray(state.criticalFeatures) || state.criticalFeatures.length === 0) {
      fail(`canonical state ${state.id} must define criticalFeatures.`)
    }
    if (JSON.stringify(state.artifactFields) !== JSON.stringify(ARTIFACT_FIELDS)) {
      fail(`canonical state ${state.id} must require ${ARTIFACT_FIELDS.join(', ')} artifacts in order.`)
    }
  }

  const artifactSchema = rubric.artifactSchema
  requireKeys(artifactSchema, ['requiredFields', 'statuses', ...ARTIFACT_FIELDS], 'rubric.artifactSchema')
  if (JSON.stringify(artifactSchema.requiredFields) !== JSON.stringify(ARTIFACT_FIELDS)) {
    fail('rubric.artifactSchema.requiredFields must contain the five required artifact fields.')
  }
  if (JSON.stringify(artifactSchema.statuses) !== JSON.stringify(ARTIFACT_STATUSES)) {
    fail('rubric.artifactSchema.statuses must be NOT_CAPTURED and CAPTURED.')
  }
  for (const field of ARTIFACT_FIELDS) {
    requireKeys(artifactSchema[field], ['requiredFields'], `rubric.artifactSchema.${field}`)
  }
  return rubric
}

export function readRubric(filePath = RUBRIC_PATH) {
  return assertRubricContract(loadJson(filePath))
}

function assertStatus(value, label) {
  if (!ARTIFACT_STATUSES.includes(value)) fail(`${label} must be ${ARTIFACT_STATUSES.join(' or ')}.`)
  return value
}

function assertArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array.`)
  return value
}

function assertNullableString(value, label) {
  if (value !== null && typeof value !== 'string') fail(`${label} must be a string or null.`)
}

function assertCapturedScreenshot(value) {
  requireKeys(value, ['status', 'path', 'sha256', 'bytes', 'width', 'height'], 'artifact.screenshot')
  assertStatus(value.status, 'artifact.screenshot.status')
  if (value.status === 'NOT_CAPTURED') return
  requireString(value.path, 'artifact.screenshot.path')
  assertSha256(value.sha256, 'artifact.screenshot.sha256')
  requirePositiveInteger(value.bytes, 'artifact.screenshot.bytes')
  requirePositiveInteger(value.width, 'artifact.screenshot.width')
  requirePositiveInteger(value.height, 'artifact.screenshot.height')
}

function assertCapturedConsole(value) {
  requireKeys(value, ['status', 'errors', 'warnings', 'pageErrors'], 'artifact.console')
  assertStatus(value.status, 'artifact.console.status')
  if (value.status === 'NOT_CAPTURED') return
  assertArray(value.errors, 'artifact.console.errors')
  assertArray(value.warnings, 'artifact.console.warnings')
  assertArray(value.pageErrors, 'artifact.console.pageErrors')
}

function assertCapturedPage(value) {
  requireKeys(value, ['status', 'state', 'runTimeSeconds', 'expectedState', 'result'], 'artifact.page')
  assertStatus(value.status, 'artifact.page.status')
  if (value.status === 'NOT_CAPTURED') return
  requireString(value.state, 'artifact.page.state')
  if (value.runTimeSeconds !== null) requireFiniteNumber(value.runTimeSeconds, 'artifact.page.runTimeSeconds')
  requireString(value.expectedState, 'artifact.page.expectedState')
  assertNullableString(value.result, 'artifact.page.result')
}

function assertDimensionObject(value, label) {
  requireKeys(value, ['width', 'height'], label)
  requirePositiveInteger(value.width, `${label}.width`)
  requirePositiveInteger(value.height, `${label}.height`)
}

function assertCapturedLayout(value) {
  requireKeys(value, [
    'status',
    'viewport',
    'canvasCss',
    'canvasBacking',
    'overflow',
    'rects',
    'overlaps',
  ], 'artifact.layout')
  assertStatus(value.status, 'artifact.layout.status')
  if (value.status === 'NOT_CAPTURED') return
  assertDimensionObject(value.viewport, 'artifact.layout.viewport')
  assertDimensionObject(value.canvasCss, 'artifact.layout.canvasCss')
  assertDimensionObject(value.canvasBacking, 'artifact.layout.canvasBacking')
  requireKeys(value.overflow, ['x', 'y'], 'artifact.layout.overflow')
  requireFiniteNumber(value.overflow.x, 'artifact.layout.overflow.x')
  requireFiniteNumber(value.overflow.y, 'artifact.layout.overflow.y')
  if (value.overflow.x < 0 || value.overflow.y < 0) fail('artifact.layout.overflow cannot be negative.')
  requireObject(value.rects, 'artifact.layout.rects')
  requireObject(value.overlaps, 'artifact.layout.overlaps')
}

function assertCapturedLuma(value) {
  requireKeys(value, ['status', 'mean', 'p01', 'p99', 'blackFraction', 'flat'], 'artifact.luma')
  assertStatus(value.status, 'artifact.luma.status')
  if (value.status === 'NOT_CAPTURED') return
  for (const field of ['mean', 'p01', 'p99', 'blackFraction']) {
    requireFiniteNumber(value[field], `artifact.luma.${field}`)
  }
  if (value.mean < 0 || value.mean > 255 || value.p01 < 0 || value.p01 > 255 || value.p99 < 0 || value.p99 > 255) {
    fail('artifact.luma mean and percentiles must be in the 0..255 range.')
  }
  if (value.blackFraction < 0 || value.blackFraction > 1) fail('artifact.luma.blackFraction must be in the 0..1 range.')
  if (typeof value.flat !== 'boolean') fail('artifact.luma.flat must be boolean.')
}

export function assertArtifactContract(artifact) {
  requireKeys(artifact, ARTIFACT_FIELDS, 'state.artifacts')
  assertCapturedScreenshot(artifact.screenshot)
  assertCapturedConsole(artifact.console)
  assertCapturedPage(artifact.page)
  assertCapturedLayout(artifact.layout)
  assertCapturedLuma(artifact.luma)
  const statuses = ARTIFACT_FIELDS.map((field) => artifact[field].status)
  if (artifact.status !== undefined) {
    assertStatus(artifact.status, 'state.artifacts.status')
    if (artifact.status === 'CAPTURED' && statuses.some((status) => status !== 'CAPTURED')) {
      fail('state.artifacts.status cannot be CAPTURED while a required artifact is NOT_CAPTURED.')
    }
  }
  return artifact
}

function createArtifactSkeleton() {
  return {
    status: 'NOT_CAPTURED',
    screenshot: {
      status: 'NOT_CAPTURED', path: null, sha256: null, bytes: null, width: null, height: null,
    },
    console: {
      status: 'NOT_CAPTURED', errors: null, warnings: null, pageErrors: null,
    },
    page: {
      status: 'NOT_CAPTURED', state: null, runTimeSeconds: null, expectedState: null, result: null,
    },
    layout: {
      status: 'NOT_CAPTURED',
      viewport: null, canvasCss: null, canvasBacking: null, overflow: null, rects: null, overlaps: null,
    },
    luma: {
      status: 'NOT_CAPTURED', mean: null, p01: null, p99: null, blackFraction: null, flat: null,
    },
  }
}

function assertBuild(build) {
  requireKeys(build, ['id', 'distManifestSha256', 'gameChunkSha256'], 'manifest.build')
  requireString(build.id, 'manifest.build.id')
  assertSha256(build.distManifestSha256, 'manifest.build.distManifestSha256')
  assertSha256(build.gameChunkSha256, 'manifest.build.gameChunkSha256')
}

function assertPackage(packageInfo) {
  requireKeys(packageInfo, ['path', 'sha256'], 'manifest.package')
  requireString(packageInfo.path, 'manifest.package.path')
  assertSha256(packageInfo.sha256, 'manifest.package.sha256')
}

export function createManifest(options, rubric = readRubric()) {
  assertRubricContract(rubric)
  requireKeys(options, [
    'runId',
    'releaseId',
    'buildId',
    'distManifestSha256',
    'gameChunkSha256',
    'packagePath',
    'packageSha256',
    'seed',
    'viewport',
  ], 'manifest options')
  const runId = assertRunId(options.runId)
  const releaseId = requireString(options.releaseId, 'releaseId')
  const buildId = requireString(options.buildId, 'buildId')
  const seed = typeof options.seed === 'number' ? parseSeed(options.seed) : parseSeed(options.seed)
  const viewport = parseViewport(options.viewport, options.deviceScaleFactor ?? 1)
  const build = {
    id: buildId,
    distManifestSha256: assertSha256(options.distManifestSha256, 'distManifestSha256'),
    gameChunkSha256: assertSha256(options.gameChunkSha256, 'gameChunkSha256'),
  }
  const packageInfo = {
    path: requireString(options.packagePath, 'packagePath'),
    sha256: assertSha256(options.packageSha256, 'packageSha256'),
  }
  const canonicalStates = rubric.canonicalStates.map((state) => ({
    id: state.id,
    label: state.label,
    viewportProfiles: clone(state.viewportProfiles),
    capture: clone(state.capture),
    expected: clone(state.expected),
    requiredSelectors: [...state.requiredSelectors],
    criticalFeatures: [...state.criticalFeatures],
    artifactFields: [...state.artifactFields],
    artifacts: createArtifactSkeleton(),
  }))

  return {
    schemaVersion: 1,
    kind: 'yeongheo-visual-critic-run',
    runId,
    releaseId,
    createdAt: new Date().toISOString(),
    execution: {
      mode: 'dry-contract',
      browserExecution: false,
      runtimeCaptureOwner: 'release-owner',
    },
    verdict: 'NOT_RUN',
    build,
    package: packageInfo,
    seed,
    viewport,
    canonicalStateCount: canonicalStates.length,
    canonicalStates,
    artifactSchema: clone(rubric.artifactSchema),
    critic: clone(rubric.critic),
    hardGates: clone(rubric.hardGates),
    retention: clone(rubric.retention),
    evidence: {
      capturedStateCount: 0,
      requiredStateCount: canonicalStates.length,
      sourceRunId: runId,
      notes: [
        'No runtime capture was performed by this contract runner.',
        'A browser-capable release owner must supply and independently review artifacts.',
      ],
    },
  }
}

function assertCanonicalStateShape(state, index) {
  requireKeys(state, [
    'id',
    'label',
    'viewportProfiles',
    'capture',
    'expected',
    'requiredSelectors',
    'criticalFeatures',
    'artifactFields',
    'artifacts',
  ], `manifest.canonicalStates[${index}]`)
  if (!Array.isArray(state.viewportProfiles) || state.viewportProfiles.length === 0) {
    fail(`manifest canonical state ${state.id} has no viewport profile.`)
  }
  for (const [profileIndex, profile] of state.viewportProfiles.entries()) {
    assertViewport(profile, `manifest.canonicalStates[${index}].viewportProfiles[${profileIndex}]`)
  }
  if (!Array.isArray(state.requiredSelectors) || state.requiredSelectors.length === 0) {
    fail(`manifest canonical state ${state.id} has no required selectors.`)
  }
  if (!Array.isArray(state.criticalFeatures) || state.criticalFeatures.length === 0) {
    fail(`manifest canonical state ${state.id} has no critical features.`)
  }
  if (JSON.stringify(state.artifactFields) !== JSON.stringify(ARTIFACT_FIELDS)) {
    fail(`manifest canonical state ${state.id} has an incomplete artifact field contract.`)
  }
  assertArtifactContract(state.artifacts)
}

export function assertManifestContract(manifest, rubric = readRubric()) {
  assertRubricContract(rubric)
  requireKeys(manifest, [
    'schemaVersion',
    'kind',
    'runId',
    'releaseId',
    'execution',
    'verdict',
    'build',
    'package',
    'seed',
    'viewport',
    'canonicalStateCount',
    'canonicalStates',
    'artifactSchema',
    'evidence',
  ], 'manifest')
  if (manifest.schemaVersion !== 1) fail('manifest.schemaVersion must be 1.')
  if (manifest.kind !== 'yeongheo-visual-critic-run') fail('manifest.kind is not recognised.')
  assertRunId(manifest.runId)
  requireString(manifest.releaseId, 'manifest.releaseId')
  requireKeys(manifest.execution, ['mode', 'browserExecution', 'runtimeCaptureOwner'], 'manifest.execution')
  if (manifest.execution.mode !== 'dry-contract' || manifest.execution.browserExecution !== false) {
    fail('manifest.execution must identify a non-browser dry contract run.')
  }
  if (!MANIFEST_VERDICTS.includes(manifest.verdict)) fail(`manifest.verdict must be one of ${MANIFEST_VERDICTS.join(', ')}.`)
  assertBuild(manifest.build)
  assertPackage(manifest.package)
  parseSeed(manifest.seed)
  assertViewport(manifest.viewport, 'manifest.viewport')
  if (manifest.canonicalStateCount !== rubric.canonicalStateCount) fail('manifest canonicalStateCount does not match rubric.')
  if (!Array.isArray(manifest.canonicalStates) || manifest.canonicalStates.length !== rubric.canonicalStateCount) {
    fail('manifest must contain exactly 10 canonical states.')
  }
  const expectedIds = rubric.canonicalStates.map((state) => state.id)
  const actualIds = manifest.canonicalStates.map((state) => state.id)
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) fail('manifest canonical state order does not match rubric.')
  manifest.canonicalStates.forEach(assertCanonicalStateShape)
  requireKeys(manifest.evidence, ['capturedStateCount', 'requiredStateCount', 'sourceRunId', 'notes'], 'manifest.evidence')
  if (manifest.evidence.requiredStateCount !== rubric.canonicalStateCount) fail('manifest.evidence.requiredStateCount must be 10.')
  if (manifest.evidence.sourceRunId !== manifest.runId) fail('manifest.evidence.sourceRunId must equal manifest.runId.')
  if (!Array.isArray(manifest.evidence.notes)) fail('manifest.evidence.notes must be an array.')
  return manifest
}

export function mergeStateArtifact(manifest, stateId, artifact) {
  const next = clone(manifest)
  assertManifestContract(next)
  requireString(stateId, 'stateId')
  assertArtifactContract(artifact)
  const state = next.canonicalStates.find((entry) => entry.id === stateId)
  if (!state) fail(`Unknown canonical state ${stateId}.`)
  if (state.artifacts.status === 'CAPTURED') fail(`Canonical state ${stateId} is already captured; refusing overwrite.`)
  state.artifacts = clone(artifact)
  state.artifacts.status = ARTIFACT_FIELDS.every((field) => state.artifacts[field].status === 'CAPTURED')
    ? 'CAPTURED'
    : 'NOT_CAPTURED'
  next.evidence.capturedStateCount = next.canonicalStates.filter((entry) => entry.artifacts.status === 'CAPTURED').length
  next.verdict = next.evidence.capturedStateCount === 0 ? 'NOT_RUN' : 'INCOMPLETE'
  return assertManifestContract(next)
}

export function assertRuntimeEvidenceComplete(manifest) {
  assertManifestContract(manifest)
  const incomplete = manifest.canonicalStates
    .filter((state) => state.artifacts.status !== 'CAPTURED')
    .map((state) => state.id)
  if (incomplete.length) fail(`Runtime evidence is incomplete for canonical states: ${incomplete.join(', ')}.`)

  for (const state of manifest.canonicalStates) {
    const artifact = state.artifacts
    if (artifact.console.errors.length !== 0 || artifact.console.warnings.length !== 0 || artifact.console.pageErrors.length !== 0) {
      fail(`Console/page errors block state ${state.id}.`)
    }
    if (artifact.layout.overflow.x !== 0 || artifact.layout.overflow.y !== 0) {
      fail(`Viewport overflow blocks state ${state.id}.`)
    }
    if (Object.values(artifact.layout.overlaps).some((value) => value !== 0 && value !== false)) {
      fail(`Critical layout overlap blocks state ${state.id}.`)
    }
    if (artifact.luma.flat || artifact.luma.blackFraction >= 0.98) {
      fail(`Blank or flat luma blocks state ${state.id}.`)
    }
    const allowedProfiles = state.viewportProfiles
    const sizeMatches = allowedProfiles.some((profile) => (
      artifact.screenshot.width === profile.width && artifact.screenshot.height === profile.height
    ))
    if (!sizeMatches) fail(`Screenshot dimensions do not match a canonical viewport for state ${state.id}.`)
  }
  return { complete: true, verdict: 'EVIDENCE_PENDING_CRITIC' }
}

export function createRunDirectory({ runsRoot = DEFAULT_RUNS_ROOT, runId }) {
  assertRunId(runId)
  const root = path.resolve(runsRoot)
  const runDir = path.join(root, runId)
  fs.mkdirSync(root, { recursive: true })
  try {
    fs.mkdirSync(runDir)
  } catch (error) {
    if (error?.code === 'EEXIST') fail(`Refusing to overwrite existing run directory: ${runDir}`)
    throw error
  }
  fs.mkdirSync(path.join(runDir, 'screenshots'))
  fs.mkdirSync(path.join(runDir, 'comparisons'))
  fs.mkdirSync(path.join(runDir, 'logs'))
  return runDir
}

export function writeManifest(runDir, manifest) {
  assertManifestContract(manifest)
  const manifestPath = path.join(runDir, 'manifest.json')
  const payload = `${JSON.stringify(manifest, null, 2)}\n`
  try {
    fs.writeFileSync(manifestPath, payload, { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    if (error?.code === 'EEXIST') fail(`Refusing to overwrite existing manifest: ${manifestPath}`)
    throw error
  }
  return manifestPath
}

export function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function parseCliArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--help' || token === '-h') {
      result.help = true
      continue
    }
    if (!token.startsWith('--')) fail(`Unknown positional argument ${token}.`)
    const equalIndex = token.indexOf('=')
    const rawKey = equalIndex >= 0 ? token.slice(2, equalIndex) : token.slice(2)
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    const inlineValue = equalIndex >= 0 ? token.slice(equalIndex + 1) : null
    const value = inlineValue ?? argv[++index]
    if (value === undefined || value === '' || (inlineValue === null && value.startsWith('--'))) {
      fail(`Option --${rawKey} requires a value.`)
    }
    if (Object.prototype.hasOwnProperty.call(result, key)) fail(`Option --${rawKey} was supplied more than once.`)
    result[key] = value
  }
  return result
}

function printUsage() {
  console.log([
    'Usage:',
    '  node tools/yeongheo/visual-critic-gauntlet.mjs --run-id ID --release-id ID',
    '    --build-id ID --dist-manifest-sha256 SHA --game-chunk-sha256 SHA',
    '    --package-path PATH --package-sha256 SHA --seed UINT32 --viewport WIDTHxHEIGHT',
    '    [--dpr NUMBER] [--runs-root PATH]',
    '',
    'This command writes a dry contract manifest only. It never captures runtime evidence',
    'and exits 2 so a contract-only run cannot be mistaken for PASS.',
  ].join('\n'))
}

function requiredCli(options, key) {
  if (!Object.prototype.hasOwnProperty.call(options, key)) fail(`Missing required option --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}.`)
  return options[key]
}

export function buildManifestOptions(cliOptions) {
  return {
    runId: requiredCli(cliOptions, 'runId'),
    releaseId: requiredCli(cliOptions, 'releaseId'),
    buildId: requiredCli(cliOptions, 'buildId'),
    distManifestSha256: requiredCli(cliOptions, 'distManifestSha256'),
    gameChunkSha256: requiredCli(cliOptions, 'gameChunkSha256'),
    packagePath: requiredCli(cliOptions, 'packagePath'),
    packageSha256: requiredCli(cliOptions, 'packageSha256'),
    seed: requiredCli(cliOptions, 'seed'),
    viewport: requiredCli(cliOptions, 'viewport'),
    deviceScaleFactor: cliOptions.dpr ?? 1,
  }
}

export function runContractCli(argv = process.argv.slice(2)) {
  let cliOptions
  try {
    cliOptions = parseCliArgs(argv)
    if (cliOptions.help) {
      printUsage()
      return EXIT_CODES.OK
    }
    const manifestOptions = buildManifestOptions(cliOptions)
    const runId = assertRunId(manifestOptions.runId)
    const manifest = createManifest(manifestOptions)
    const runDir = createRunDirectory({
      runsRoot: cliOptions.runsRoot ?? DEFAULT_RUNS_ROOT,
      runId,
    })
    const manifestPath = writeManifest(runDir, manifest)
    const logPath = path.join(runDir, 'logs', 'contract.log')
    fs.writeFileSync(logPath, [
      `[${new Date().toISOString()}] NOT_RUN`,
      'Browser execution is intentionally outside this runner.',
      'No runtime PASS is asserted.',
      `manifest=${manifestPath}`,
    ].join('\n') + '\n', { encoding: 'utf8', flag: 'wx' })
    console.error(`[visual-critic-gauntlet] NOT_RUN: dry contract manifest written to ${manifestPath}`)
    console.error('[visual-critic-gauntlet] Runtime capture and human critic review remain required; returning nonzero.')
    return EXIT_CODES.CONTRACT_ONLY
  } catch (error) {
    console.error(`[visual-critic-gauntlet] BLOCKED: ${error.message}`)
    return EXIT_CODES.INVALID_INPUT
  }
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH
if (isDirectExecution) process.exitCode = runContractCli()
