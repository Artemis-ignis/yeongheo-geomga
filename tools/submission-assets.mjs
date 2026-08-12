import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url))
export const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '..')
export const DEFAULT_PUBLIC_DIR = path.join(WORKSPACE_ROOT, 'public')
export const DEFAULT_OUTPUT_DIR = path.join(WORKSPACE_ROOT, 'dist')

/**
 * Assets used by the shipped PixiJS 2D contest runtime. The source public tree
 * also keeps the current sprite authoring sheets; only this allowlist enters
 * the Pages bundle.
 */
export const SUBMISSION_RUNTIME_ASSETS = Object.freeze([
  'assets/characters/jade-void-warden-boss-reference-v2.png',
  'assets/characters/seolryeong-character-reference-v2.png',
  'assets/characters/seolryeong-character-reference-v3.png',
  'assets/environment/jade-sanctuary-environment-v2.png',
  'assets/marketing/yeongheo-contest-keyart-v1.png',
  'assets/ui/skill-icons-v1/area-formation.png',
  'assets/ui/skill-icons-v1/attack-seal.png',
  'assets/ui/skill-icons-v1/bagua-array.png',
  'assets/ui/skill-icons-v1/cooldown-hourglass.png',
  'assets/ui/skill-icons-v1/dao-lotus.png',
  'assets/ui/skill-icons-v1/fire-talisman.png',
  'assets/ui/skill-icons-v1/flying-sword.png',
  'assets/ui/skill-icons-v1/frost-palm.png',
  'assets/ui/skill-icons-v1/healing-core.png',
  'assets/ui/skill-icons-v1/qi-shield.png',
  'assets/ui/skill-icons-v1/soul-eye.png',
  'assets/ui/skill-icons-v1/spirit-butterfly.png',
  'assets/ui/skill-icons-v1/thunder-orb.png',
  'assets/ui/skill-icons-v1/twin-blades.png',
  'assets/ui/skill-icons-v1/vajra.png',
  'assets/ui/skill-icons-v1/windstep.png',
  'assets/ui/skill-icons-v2/clone-art.png',
  'assets/ui/skill-icons-v2/destined-bond.png',
  'assets/ui/skill-icons-v2/earth-dragon-spikes.png',
  'assets/ui/skill-icons-v2/echoing-heart.png',
  'assets/ui/skill-icons-v2/frost-line.png',
  'assets/ui/skill-icons-v2/frost-oath.png',
  'assets/ui/skill-icons-v2/frost-shards.png',
  'assets/ui/skill-icons-v2/frozen-sky.png',
  'assets/ui/skill-icons-v2/heal.png',
  'assets/ui/skill-icons-v2/heart-method.png',
  'assets/ui/skill-icons-v2/heavenly-lightning.png',
  'assets/ui/skill-icons-v2/hidden-needles.png',
  'assets/ui/skill-icons-v2/ice-wall.png',
  'assets/ui/skill-icons-v2/inferno-sea.png',
  'assets/ui/skill-icons-v2/myriad-swords.png',
  'assets/ui/skill-icons-v2/needle-storm.png',
  'assets/ui/skill-icons-v2/piercing-edge.png',
  'assets/ui/skill-icons-v2/plague-tide.png',
  'assets/ui/skill-icons-v2/purge.png',
  'assets/ui/skill-icons-v2/purifying-heart.png',
  'assets/ui/skill-icons-v2/returning-edge.png',
  'assets/ui/skill-icons-v2/shadow-copy.png',
  'assets/ui/skill-icons-v2/spirit-bell.png',
  'assets/ui/skill-icons-v2/spirit-oath.png',
  'assets/ui/skill-icons-v2/spirit-stones.png',
  'assets/ui/skill-icons-v2/sword-oath.png',
  'assets/ui/skill-icons-v2/sword-riding.png',
  'assets/ui/skill-icons-v2/sword-ring.png',
  'assets/ui/skill-icons-v2/venom-palm.png',
  'assets/ui/skill-icons-v2/violet-thunder.png',
  'assets/ui/skill-icons-v2/void-orb.png',
  'assets/ui/skill-icons-v2/wind-blades.png',
  'assets/ui/stage-thumbnails-v1/ember.png',
  'assets/ui/stage-thumbnails-v1/frost.png',
  'assets/ui/stage-thumbnails-v1/jade.png',
  'assets/materials/environment/jade-highland-ground-v1.png',
  'assets/materials/environment/jade-sanctuary-ground-material-v2.png',
  'assets/materials/environment/jade-pavilion-stone-v1.png',
  'assets/sprites2d/blood-scorpion-motion-v1.png',
  'assets/sprites2d/jade-sanctuary-props-v1.png',
  'assets/sprites2d/jade-serpent-motion-v1.png',
  'assets/sprites2d/jade-shard-guardian-motion-v1.png',
  'assets/sprites2d/jade-stone-ghoul-motion-v1.png',
  'assets/sprites2d/jade-void-warden-motion-v2.png',
  'assets/sprites2d/magi-remnant-motion-v2.png',
  'assets/sprites2d/masked-seal-revenant-motion-v1.png',
  'assets/sprites2d/seolryeong-combat-v1.png',
  'assets/sprites2d/seolryeong-heroine-east-motion-v1.png',
  'assets/sprites2d/seolryeong-heroine-motion-v5.png',
  'assets/sprites2d/seolryeong-heroine-northeast-motion-v1.png',
  'assets/sprites2d/seolryeong-heroine-north-motion-v1.png',
  'assets/sprites2d/seolryeong-heroine-south-motion-v1.png',
  'assets/sprites2d/talisman-revenant-motion-v1.png',
  'assets/sprites2d/shadow-seal-duelist-motion-v1.png',
  'assets/sprites2d/void-sentinel-motion-v2.png',
  'assets/sprites2d/jade-ridge-hound-motion-v1.png',
  'assets/sprites2d/yorang-motion-v2.png',
])

export const SUBMISSION_RUNTIME_ASSET_SET = new Set(SUBMISSION_RUNTIME_ASSETS)

// These are the public static asset types that can be copied into dist/assets.
// JavaScript and CSS chunks are deliberately excluded from pruning.
const STATIC_ASSET_EXTENSIONS = new Set([
  '.avif', '.bin', '.gif', '.glb', '.gltf', '.jpeg', '.jpg', '.mp3', '.ogg',
  '.png', '.svg', '.wav', '.webp',
])

function normalize(value) {
  return String(value).replaceAll('\\', '/').replace(/^\.\//, '')
}

/**
 * Return production asset references that are outside the exact Pages
 * allowlist. References may be BASE_URL-prefixed URLs, public-relative paths,
 * or already-normalized assets/... paths.
 */
export function findUnallowlistedSubmissionAssetReferences(
  references,
  { assetSet = SUBMISSION_RUNTIME_ASSET_SET } = {},
) {
  const unallowlisted = new Set()
  for (const reference of references ?? []) {
    const raw = String(reference ?? '').trim()
    if (!raw) continue
    const normalized = normalize(raw).split(/[?#]/, 1)[0]
    const marker = normalized.indexOf('assets/')
    const assetPath = marker >= 0
      ? normalized.slice(marker)
      : `assets/${normalized.replace(/^\/+/, '').replace(/^public\//, '')}`
    if (!assetSet.has(assetPath)) unallowlisted.add(assetPath)
  }
  return [...unallowlisted].sort()
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return []
  const files = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(absolute))
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

function relativeFiles(root) {
  return walkFiles(root).map((file) => normalize(path.relative(root, file))).sort()
}

function isInside(root, target) {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function staticAssetPath(relativePath) {
  return relativePath.startsWith('assets/')
    && STATIC_ASSET_EXTENSIONS.has(path.extname(relativePath).toLowerCase())
}

function statsForFiles(root, files) {
  let bytes = 0
  for (const file of files) bytes += fs.statSync(path.join(root, file)).size
  return { fileCount: files.length, bytes }
}

/** Return deterministic file count/byte totals for a directory. */
export function summarizeDirectory(root) {
  const absolute = path.resolve(root)
  if (!fs.existsSync(absolute)) return { root: absolute, exists: false, fileCount: 0, bytes: 0 }
  const files = relativeFiles(absolute)
  return { root: absolute, exists: true, ...statsForFiles(absolute, files) }
}

function sourceAssetPaths(publicDir) {
  return new Set(relativeFiles(publicDir).filter(staticAssetPath))
}

/**
 * Remove only public static files copied to an explicit output directory and
 * not admitted to the submission allowlist.  The source public tree is never
 * touched.  The returned report is suitable for CI logs and tests.
 */
export function pruneSubmissionAssets({
  publicDir = DEFAULT_PUBLIC_DIR,
  outDir = DEFAULT_OUTPUT_DIR,
} = {}) {
  const publicRoot = path.resolve(publicDir)
  const outputRoot = path.resolve(outDir)
  const sourceAssets = sourceAssetPaths(publicRoot)
  const outputFiles = relativeFiles(outputRoot)
  const removable = outputFiles.filter((relativePath) =>
    sourceAssets.has(relativePath) && !SUBMISSION_RUNTIME_ASSET_SET.has(relativePath))
  const before = summarizeDirectory(outputRoot)
  let removedBytes = 0

  for (const relativePath of removable) {
    const absolute = path.resolve(outputRoot, relativePath)
    if (!isInside(outputRoot, absolute)) throw new Error(`refusing to prune outside output: ${relativePath}`)
    const size = fs.statSync(absolute).size
    fs.unlinkSync(absolute)
    removedBytes += size
  }

  // Remove only empty directories under dist/assets; never remove dist itself.
  const outputAssetRoot = path.resolve(outputRoot, 'assets')
  if (isInside(outputRoot, outputAssetRoot) && fs.existsSync(outputAssetRoot)) {
    const directories = walkDirectories(outputAssetRoot).sort((a, b) => b.length - a.length)
    for (const directory of directories) {
      if (fs.readdirSync(directory).length === 0) fs.rmdirSync(directory)
    }
  }

  const after = summarizeDirectory(outputRoot)
  return {
    before,
    after,
    removed: removable,
    removedFileCount: removable.length,
    removedBytes,
  }
}

function walkDirectories(root) {
  if (!fs.existsSync(root)) return []
  const directories = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const absolute = path.join(root, entry.name)
    directories.push(absolute, ...walkDirectories(absolute))
  }
  return directories
}

/** Audit required source/output assets and unexpected static files in dist. */
export function auditSubmissionAssets({
  publicDir = DEFAULT_PUBLIC_DIR,
  outDir = DEFAULT_OUTPUT_DIR,
} = {}) {
  const publicRoot = path.resolve(publicDir)
  const outputRoot = path.resolve(outDir)
  const sourceMissing = SUBMISSION_RUNTIME_ASSETS.filter((relativePath) =>
    !fs.existsSync(path.resolve(publicRoot, relativePath)))
  const outputFiles = relativeFiles(outputRoot)
  const outputStaticAssets = outputFiles.filter(staticAssetPath)
  const outputAssetSet = new Set(outputStaticAssets)
  const outputMissing = SUBMISSION_RUNTIME_ASSETS.filter((relativePath) => !outputAssetSet.has(relativePath))
  const unexpectedOutputAssets = outputStaticAssets.filter((relativePath) =>
    !SUBMISSION_RUNTIME_ASSET_SET.has(relativePath))
  const sourceStats = statsForFiles(publicRoot, relativeFiles(publicRoot).filter(staticAssetPath))
  const outputStats = statsForFiles(outputRoot, outputStaticAssets)
  const runtimeOutputStats = statsForFiles(
    outputRoot,
    outputStaticAssets.filter((relativePath) => SUBMISSION_RUNTIME_ASSET_SET.has(relativePath)),
  )

  return {
    ok: sourceMissing.length === 0 && outputMissing.length === 0 && unexpectedOutputAssets.length === 0,
    requiredAssetCount: SUBMISSION_RUNTIME_ASSETS.length,
    sourceMissing,
    outputMissing,
    unexpectedOutputAssets,
    sourceStatic: sourceStats,
    outputStatic: outputStats,
    outputRuntime: runtimeOutputStats,
    output: summarizeDirectory(outputRoot),
  }
}

export function formatSubmissionAssetReport(report) {
  const before = report.before ?? report.output
  const after = report.after ?? report.output
  const fields = [
    `[submission-assets] runtime=${report.requiredAssetCount ?? SUBMISSION_RUNTIME_ASSETS.length}`,
    `before=${before?.fileCount ?? 0} files/${before?.bytes ?? 0} bytes`,
    `after=${after?.fileCount ?? 0} files/${after?.bytes ?? 0} bytes`,
    `sourceMissing=${report.sourceMissing?.length ?? 0}`,
    `outputMissing=${report.outputMissing?.length ?? 0}`,
    `unexpected=${report.unexpectedOutputAssets?.length ?? 0}`,
  ]
  if (report.removedFileCount != null) fields.push(`removed=${report.removedFileCount} files/${report.removedBytes ?? 0} bytes`)
  return fields.join(' ')
}
