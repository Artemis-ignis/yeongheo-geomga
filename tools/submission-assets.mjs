import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url))
export const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '..')
export const DEFAULT_PUBLIC_DIR = path.join(WORKSPACE_ROOT, 'public')
export const DEFAULT_OUTPUT_DIR = path.join(WORKSPACE_ROOT, 'dist')

/**
 * Assets used by the shipped PixiJS 2D runtime. Authoring sheets live under
 * assets-source outside Vite's public tree; this allowlist independently pins
 * every static file admitted to the web bundle.
 */
export const SUBMISSION_RUNTIME_ASSETS = Object.freeze([
  'assets/characters/jade-void-warden-boss-reference-v2.webp',
  'assets/characters/seolryeong-character-reference-v2.webp',
  'assets/characters/seolryeong-character-reference-v3.webp',
  'assets/environment/jade-sanctuary-environment-v2.webp',
  'assets/brand/yeongheo-seal-v1.svg',
  'assets/marketing/yeongheo-ink-title-v1.webp',
  'assets/ui/ink-paper-texture-v1.svg',
  'assets/ui/skill-icons-v1/area-formation.webp',
  'assets/ui/skill-icons-v1/attack-seal.webp',
  'assets/ui/skill-icons-v1/bagua-array.webp',
  'assets/ui/skill-icons-v1/cooldown-hourglass.webp',
  'assets/ui/skill-icons-v1/dao-lotus.webp',
  'assets/ui/skill-icons-v1/fire-talisman.webp',
  'assets/ui/skill-icons-v1/flying-sword.webp',
  'assets/ui/skill-icons-v1/frost-palm.webp',
  'assets/ui/skill-icons-v1/healing-core.webp',
  'assets/ui/skill-icons-v1/qi-shield.webp',
  'assets/ui/skill-icons-v1/soul-eye.webp',
  'assets/ui/skill-icons-v1/spirit-butterfly.webp',
  'assets/ui/skill-icons-v1/thunder-orb.webp',
  'assets/ui/skill-icons-v1/twin-blades.webp',
  'assets/ui/skill-icons-v1/vajra.webp',
  'assets/ui/skill-icons-v1/windstep.webp',
  'assets/ui/skill-icons-v2/clone-art.webp',
  'assets/ui/skill-icons-v2/destined-bond.webp',
  'assets/ui/skill-icons-v2/earth-dragon-spikes.webp',
  'assets/ui/skill-icons-v2/echoing-heart.webp',
  'assets/ui/skill-icons-v2/frost-line.webp',
  'assets/ui/skill-icons-v2/frost-oath.webp',
  'assets/ui/skill-icons-v2/frost-shards.webp',
  'assets/ui/skill-icons-v2/frozen-sky.webp',
  'assets/ui/skill-icons-v2/heal.webp',
  'assets/ui/skill-icons-v2/heart-method.webp',
  'assets/ui/skill-icons-v2/heavenly-lightning.webp',
  'assets/ui/skill-icons-v2/hidden-needles.webp',
  'assets/ui/skill-icons-v2/ice-wall.webp',
  'assets/ui/skill-icons-v2/inferno-sea.webp',
  'assets/ui/skill-icons-v2/myriad-swords.webp',
  'assets/ui/skill-icons-v2/needle-storm.webp',
  'assets/ui/skill-icons-v2/piercing-edge.webp',
  'assets/ui/skill-icons-v2/plague-tide.webp',
  'assets/ui/skill-icons-v2/purge.webp',
  'assets/ui/skill-icons-v2/purifying-heart.webp',
  'assets/ui/skill-icons-v2/returning-edge.webp',
  'assets/ui/skill-icons-v2/shadow-copy.webp',
  'assets/ui/skill-icons-v2/spirit-bell.webp',
  'assets/ui/skill-icons-v2/spirit-oath.webp',
  'assets/ui/skill-icons-v2/spirit-stones.webp',
  'assets/ui/skill-icons-v2/sword-oath.webp',
  'assets/ui/skill-icons-v2/sword-riding.webp',
  'assets/ui/skill-icons-v2/sword-ring.webp',
  'assets/ui/skill-icons-v2/venom-palm.webp',
  'assets/ui/skill-icons-v2/violet-thunder.webp',
  'assets/ui/skill-icons-v2/void-orb.webp',
  'assets/ui/skill-icons-v2/wind-blades.webp',
  'assets/ui/stage-thumbnails-v1/ember.webp',
  'assets/ui/stage-thumbnails-v1/frost.webp',
  'assets/ui/stage-thumbnails-v1/jade.webp',
  'assets/materials/environment/jade-highland-ground-v1.webp',
  'assets/materials/environment/jade-sanctuary-ground-material-v2.webp',
  'assets/materials/environment/jade-pavilion-stone-v1.webp',
  'assets/sprites2d/blood-scorpion-motion-v1.webp',
  'assets/sprites2d/jade-sanctuary-props-v1.webp',
  'assets/sprites2d/jade-serpent-motion-v1.webp',
  'assets/sprites2d/jade-shard-guardian-motion-v1.webp',
  'assets/sprites2d/jade-stone-ghoul-motion-v1.webp',
  'assets/sprites2d/jade-stone-ghoul-north-motion-v2.webp',
  'assets/sprites2d/jade-stone-ghoul-south-motion-v2.webp',
  'assets/sprites2d/jade-stone-ghoul-reaction-v1.webp',
  'assets/sprites2d/jade-stone-ghoul-north-reaction-v1.webp',
  'assets/sprites2d/jade-stone-ghoul-south-reaction-v1.webp',
  'assets/sprites2d/jade-void-warden-motion-v2.webp',
  'assets/sprites2d/magi-remnant-motion-v2.webp',
  'assets/sprites2d/masked-seal-revenant-motion-v1.webp',
  'assets/sprites2d/seolryeong-combat-v1.webp',
  'assets/sprites2d/seolryeong-heroine-east-motion-v2.webp',
  'assets/sprites2d/seolryeong-heroine-east-reaction-v1.webp',
  'assets/sprites2d/seolryeong-heroine-southeast-motion-v2.webp',
  'assets/sprites2d/seolryeong-heroine-southeast-reaction-v1.webp',
  'assets/sprites2d/seolryeong-heroine-northeast-motion-v2.webp',
  'assets/sprites2d/seolryeong-heroine-northeast-reaction-v1.webp',
  'assets/sprites2d/seolryeong-heroine-north-motion-v3.webp',
  'assets/sprites2d/seolryeong-heroine-north-reaction-v1.webp',
  'assets/sprites2d/seolryeong-heroine-south-motion-v3.webp',
  'assets/sprites2d/seolryeong-heroine-south-reaction-v1.webp',
  'assets/sprites2d/talisman-revenant-motion-v1.webp',
  'assets/sprites2d/shadow-seal-duelist-motion-v1.webp',
  'assets/sprites2d/void-sentinel-motion-v2.webp',
  'assets/sprites2d/jade-ridge-hound-motion-v1.webp',
  'assets/sprites2d/jade-ridge-hound-north-motion-v2.webp',
  'assets/sprites2d/jade-ridge-hound-south-motion-v2.webp',
  'assets/sprites2d/jade-ridge-hound-reaction-v1.webp',
  'assets/sprites2d/jade-ridge-hound-north-reaction-v1.webp',
  'assets/sprites2d/jade-ridge-hound-south-reaction-v1.webp',
  'assets/sprites2d/jade-serpent-north-motion-v2.webp',
  'assets/sprites2d/jade-serpent-south-motion-v2.webp',
  'assets/sprites2d/jade-serpent-reaction-v1.webp',
  'assets/sprites2d/jade-serpent-north-reaction-v1.webp',
  'assets/sprites2d/jade-serpent-south-reaction-v1.webp',
  'assets/sprites2d/yorang-motion-v2.webp',
  'assets/sprites2d/yorang-north-motion-v5.webp',
  'assets/sprites2d/yorang-south-motion-v4.webp',
  'assets/sprites2d/yorang-reaction-v1.webp',
  'assets/sprites2d/yorang-north-reaction-v1.webp',
  'assets/sprites2d/yorang-south-reaction-v1.webp',
])

export const SUBMISSION_RUNTIME_ASSET_SET = new Set(SUBMISSION_RUNTIME_ASSETS)

// These are the public static asset types that can be copied into dist/assets.
// JavaScript and CSS chunks are deliberately excluded from pruning.
const STATIC_ASSET_EXTENSIONS = new Set([
  '.avif', '.bin', '.gif', '.glb', '.gltf', '.jpeg', '.jpg', '.mp3', '.ogg',
  '.png', '.svg', '.wav', '.webp',
])

// Product builds must not contain developer control surfaces, even as hidden
// DOM or dead-looking strings. Vite should erase DEV-only branches entirely.
export const PRODUCTION_DEBUG_MARKERS = Object.freeze([
  '__game2dDiagnostics',
  '__forceBoss',
  '__forceLevelUp',
  '__stress2d',
  'debug-overlay',
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

export function findProductionDebugMarkers(outDir = DEFAULT_OUTPUT_DIR) {
  const outputRoot = path.resolve(outDir)
  const inspectable = relativeFiles(outputRoot).filter((relativePath) =>
    ['.css', '.html', '.js'].includes(path.extname(relativePath).toLowerCase()))
  const matches = []
  for (const relativePath of inspectable) {
    const content = fs.readFileSync(path.join(outputRoot, relativePath), 'utf8')
    for (const marker of PRODUCTION_DEBUG_MARKERS) {
      if (content.includes(marker)) matches.push({ path: relativePath, marker })
    }
  }
  return matches
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
  const productionDebugMarkers = findProductionDebugMarkers(outputRoot)

  return {
    ok: sourceMissing.length === 0
      && outputMissing.length === 0
      && unexpectedOutputAssets.length === 0
      && productionDebugMarkers.length === 0,
    requiredAssetCount: SUBMISSION_RUNTIME_ASSETS.length,
    sourceMissing,
    outputMissing,
    unexpectedOutputAssets,
    productionDebugMarkers,
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
    `debugMarkers=${report.productionDebugMarkers?.length ?? 0}`,
  ]
  if (report.removedFileCount != null) fields.push(`removed=${report.removedFileCount} files/${report.removedBytes ?? 0} bytes`)
  return fields.join(' ')
}
