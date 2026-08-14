import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url))
export const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '..')
export const MANIFEST_PATH = path.join(WORKSPACE_ROOT, 'tools', 'asset-manifest.json')
const SOURCE_ROOTS = ['src', 'styles']
const SOURCE_FILES = [
  'index.html',
  'tools/yeongheo/sprite-authoring-manifest.json',
  'tools/yeongheo/environment-authoring-manifest.json',
]
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.glb', '.gltf', '.bin'])

function normalize(value) {
  return String(value).replaceAll('\\', '/').replace(/^\.\//, '')
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return []
  const out = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name)
    if (entry.isDirectory()) out.push(...walkFiles(absolute))
    else if (entry.isFile()) out.push(absolute)
  }
  return out
}

function collectSourceText(workspaceRoot) {
  const files = [
    ...SOURCE_ROOTS.flatMap((root) => walkFiles(path.join(workspaceRoot, root))),
    ...SOURCE_FILES.map((file) => path.join(workspaceRoot, file)),
  ].filter((file) => fs.existsSync(file))
  return files.map((file) => ({ file: normalize(path.relative(workspaceRoot, file)), text: fs.readFileSync(file, 'utf8') }))
}

function pathInsideWorkspace(workspaceRoot, relativePath) {
  const absolute = path.resolve(workspaceRoot, relativePath)
  const relative = path.relative(workspaceRoot, absolute)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export function validateManifestData(manifest, {
  workspaceRoot = WORKSPACE_ROOT,
  actualFiles = null,
  sourceFiles = collectSourceText(workspaceRoot),
  fileExists = (relativePath) => fs.existsSync(path.join(workspaceRoot, relativePath)),
} = {}) {
  const errors = []
  const warnings = []
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : []
  const ids = new Set()
  const paths = new Set()
  const declaredPaths = new Set()
  const runtimeRoot = normalize(manifest?.runtimeRoot ?? '')
  const authoringRoot = normalize(manifest?.authoringRoot ?? '')
  const runtimeRasterFormat = String(manifest?.runtimeRasterFormat ?? '').toLowerCase()

  if (manifest?.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (!runtimeRoot) errors.push('runtimeRoot is required')
  if (runtimeRasterFormat && !['webp', 'png'].includes(runtimeRasterFormat)) {
    errors.push(`unsupported runtimeRasterFormat: ${runtimeRasterFormat}`)
  }

  for (const asset of assets) {
    const id = String(asset?.id ?? '').trim()
    const assetPath = normalize(asset?.path ?? '')
    const extension = path.extname(assetPath).toLowerCase()
    if (!id) errors.push('asset id is required')
    if (!assetPath) errors.push(`${id || '<unnamed>'}: path is required`)
    if (ids.has(id)) errors.push(`duplicate asset id: ${id}`)
    if (paths.has(assetPath)) errors.push(`duplicate asset path: ${assetPath}`)
    ids.add(id)
    paths.add(assetPath)
    declaredPaths.add(assetPath)

    const isAuthoring = asset?.tier === 'authoring'
    const expectedRoot = isAuthoring ? authoringRoot : runtimeRoot
    if (isAuthoring && !authoringRoot) errors.push(`${id}: authoringRoot is required for authoring assets`)
    if (expectedRoot && !assetPath.startsWith(`${expectedRoot}/`)) {
      errors.push(`${id}: path must stay under ${expectedRoot}`)
    }
    if (!isAuthoring && runtimeRasterFormat && ['.png', '.webp'].includes(extension)
      && extension !== `.${runtimeRasterFormat}`) {
      errors.push(`${id}: runtime raster must use .${runtimeRasterFormat}`)
    }
    if (!ALLOWED_EXTENSIONS.has(extension)) errors.push(`${id}: unsupported extension ${extension || '<none>'}`)
    if (!pathInsideWorkspace(workspaceRoot, assetPath)) errors.push(`${id}: path escapes workspace: ${assetPath}`)
    if (!fileExists(assetPath)) errors.push(`${id}: missing file ${assetPath}`)

    const consumers = Array.isArray(asset?.consumers) ? asset.consumers : []
    if (consumers.length === 0) errors.push(`${id}: at least one consumer is required`)
    const basename = path.basename(assetPath)
    const relativeAssetPath = assetPath.startsWith('public/') ? assetPath.slice('public/'.length) : assetPath
    const assetSuffix = relativeAssetPath.startsWith('assets/') ? relativeAssetPath.slice('assets/'.length) : relativeAssetPath
    const referenced = sourceFiles.some(({ text }) =>
      text.includes(`/${relativeAssetPath}`) || text.includes(relativeAssetPath) || text.includes(assetSuffix) || text.includes(basename))
    if (!referenced) errors.push(`${id}: no runtime source reference found for ${assetPath}`)

    for (const consumer of consumers) {
      const consumerPath = normalize(consumer)
      if (!fileExists(consumerPath)) errors.push(`${id}: missing consumer ${consumerPath}`)
      else {
        const source = sourceFiles.find(({ file }) => file === consumerPath)
        if (!source) errors.push(`${id}: consumer is outside audited source roots ${consumerPath}`)
        else if (!source.text.includes(basename) && !source.text.includes(assetSuffix)) {
          errors.push(`${id}: consumer does not mention ${basename}: ${consumerPath}`)
        }
      }
    }

    if (!Number.isInteger(asset?.maxBytes) || asset.maxBytes <= 0) {
      errors.push(`${id}: maxBytes must be a positive integer`)
    } else {
      const absolute = path.join(workspaceRoot, assetPath)
      if (fs.existsSync(absolute) && fs.statSync(absolute).size > asset.maxBytes) {
        errors.push(`${id}: file exceeds maxBytes (${fs.statSync(absolute).size} > ${asset.maxBytes})`)
      }
    }
  }

  if (actualFiles) {
    const actual = new Set(actualFiles.map(normalize))
    for (const file of actual) if (!declaredPaths.has(file)) errors.push(`unmanifested runtime file: ${file}`)
    for (const declared of declaredPaths) if (!actual.has(declared)) errors.push(`manifest file is not under runtime root: ${declared}`)
  }

  if (assets.length === 0) errors.push('manifest must declare at least one asset')
  if (warnings.length === 0 && errors.length === 0) warnings.push('none')
  return { ok: errors.length === 0, errors, warnings, assetCount: assets.length, actualFileCount: actualFiles?.length ?? null }
}

export function validateAuthoringPipelines(manifest, authoringManifest, {
  expectedSourceSuffix = 'sprites2d',
  expectedRuntimeSuffix = 'sprites2d',
} = {}) {
  const errors = []
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : []
  const pipelines = Array.isArray(authoringManifest?.pipelines) ? authoringManifest.pipelines : []
  const authoringRoot = normalize(manifest?.authoringRoot ?? '')
  const runtimeRoot = normalize(manifest?.runtimeRoot ?? '')
  const configuredSourceRoot = normalize(authoringManifest?.sourceRoot ?? '')
  const configuredRuntimeRoot = normalize(authoringManifest?.runtimeRoot ?? '')
  const declaredPaths = new Set(assets.map((asset) => normalize(asset.path)))
  const declaredAuthoring = new Set(
    assets.filter((asset) => asset.tier === 'authoring')
      .map((asset) => normalize(asset.path))
      .filter((assetPath) => assetPath.startsWith(`${configuredSourceRoot}/`)),
  )
  const declaredAuthoringOutputs = new Set(
    assets.filter((asset) => asset.tier === 'authoring' && asset.pipelineRole === 'output')
      .map((asset) => normalize(asset.path))
      .filter((assetPath) => assetPath.startsWith(`${configuredSourceRoot}/`)),
  )
  const declaredAuthoringSources = new Set(
    [...declaredAuthoring].filter((assetPath) => !declaredAuthoringOutputs.has(assetPath)),
  )
  const mappedSources = new Map()
  const mappedOutputs = new Map()

  if (configuredSourceRoot !== `${authoringRoot}/${expectedSourceSuffix}`) {
    errors.push(`authoring sourceRoot mismatch: ${configuredSourceRoot || '<missing>'}`)
  }
  if (configuredRuntimeRoot !== `${runtimeRoot}/${expectedRuntimeSuffix}`) {
    errors.push(`authoring runtimeRoot mismatch: ${configuredRuntimeRoot || '<missing>'}`)
  }

  for (const [index, pipeline] of pipelines.entries()) {
    const actor = String(pipeline?.actor ?? '').trim()
    if (!actor) errors.push(`pipeline ${index}: actor is required`)
    const sources = [
      ...(pipeline?.source ? [pipeline.source] : []),
      ...(Array.isArray(pipeline?.sources) ? pipeline.sources : []),
    ].map((file) => normalize(`${configuredSourceRoot}/${file}`))
    const outputRoot = normalize(pipeline?.outputRoot ?? configuredRuntimeRoot)
    const outputs = (Array.isArray(pipeline?.outputs) ? pipeline.outputs : [])
      .map((file) => normalize(`${outputRoot}/${file}`))
    if (sources.length === 0) errors.push(`pipeline ${actor || index}: source is required`)
    if (outputs.length === 0) errors.push(`pipeline ${actor || index}: output is required`)

    for (const source of sources) {
      mappedSources.set(source, (mappedSources.get(source) ?? 0) + 1)
      if (!declaredAuthoringSources.has(source)) errors.push(`pipeline ${actor}: undeclared authoring source ${source}`)
    }
    for (const output of outputs) {
      mappedOutputs.set(output, (mappedOutputs.get(output) ?? 0) + 1)
      if (!declaredPaths.has(output)) errors.push(`pipeline ${actor}: undeclared runtime output ${output}`)
      if (declaredAuthoring.has(output) && !declaredAuthoringOutputs.has(output)) {
        errors.push(`pipeline ${actor}: output cannot be authoring source ${output}`)
      }
    }
  }

  for (const source of declaredAuthoringSources) {
    const count = mappedSources.get(source) ?? 0
    if (count !== 1) errors.push(`authoring source must map exactly once (${count}): ${source}`)
  }
  for (const output of declaredAuthoringOutputs) {
    const count = mappedOutputs.get(output) ?? 0
    if (count !== 1) errors.push(`authoring output must map exactly once (${count}): ${output}`)
  }
  for (const [source, count] of mappedSources) {
    if (count > 1) errors.push(`authoring source mapped more than once (${count}): ${source}`)
  }
  for (const [output, count] of mappedOutputs) {
    if (count > 1) errors.push(`runtime output mapped more than once (${count}): ${output}`)
  }
  return { ok: errors.length === 0, errors, pipelineCount: pipelines.length }
}

export function auditWorkspace(workspaceRoot = WORKSPACE_ROOT, manifestPath = path.join(workspaceRoot, 'tools', 'asset-manifest.json')) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const auditedRoots = [manifest.runtimeRoot, manifest.authoringRoot].filter(Boolean)
  const actualFiles = auditedRoots.flatMap((root) => walkFiles(path.join(workspaceRoot, root)))
    .filter((file) => ALLOWED_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .map((file) => normalize(path.relative(workspaceRoot, file)))
  const report = validateManifestData(manifest, { workspaceRoot, actualFiles })
  const authoringPath = path.join(workspaceRoot, 'tools', 'yeongheo', 'sprite-authoring-manifest.json')
  const authoringManifest = JSON.parse(fs.readFileSync(authoringPath, 'utf8'))
  const pipelines = validateAuthoringPipelines(manifest, authoringManifest)
  const environmentPath = path.join(workspaceRoot, 'tools', 'yeongheo', 'environment-authoring-manifest.json')
  const environmentManifest = JSON.parse(fs.readFileSync(environmentPath, 'utf8'))
  const environmentPipelines = validateAuthoringPipelines(manifest, environmentManifest, {
    expectedSourceSuffix: 'environment',
    expectedRuntimeSuffix: 'environment',
  })
  return {
    ...report,
    ok: report.ok && pipelines.ok && environmentPipelines.ok,
    errors: [...report.errors, ...pipelines.errors, ...environmentPipelines.errors],
    authoringPipelineCount: pipelines.pipelineCount + environmentPipelines.pipelineCount,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const report = auditWorkspace()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exitCode = 1
}
