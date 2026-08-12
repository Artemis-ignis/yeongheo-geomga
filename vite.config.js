import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import {
  auditSubmissionAssets,
  formatSubmissionAssetReport,
  pruneSubmissionAssets,
} from './tools/submission-assets.mjs'

/**
 * Vite copies the entire public directory by design. Keep current authoring
 * sources in the repository, then remove non-runtime files from the Pages
 * artifact after the bundle is written.
 */
function submissionRuntimeAssetPruner() {
  let publicDir = resolve(process.cwd(), 'public')
  let outDir = resolve(process.cwd(), 'dist')
  return {
    name: 'submission-runtime-asset-pruner',
    apply: 'build',
    configResolved(config) {
      if (typeof config.publicDir === 'string') publicDir = config.publicDir
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const beforeAudit = auditSubmissionAssets({ publicDir, outDir })
      if (beforeAudit.sourceMissing.length > 0) {
        throw new Error(`submission runtime source assets missing: ${beforeAudit.sourceMissing.join(', ')}`)
      }
      const pruning = pruneSubmissionAssets({ publicDir, outDir })
      const afterAudit = auditSubmissionAssets({ publicDir, outDir })
      if (!afterAudit.ok) {
        throw new Error(`submission runtime output asset audit failed: ${JSON.stringify(afterAudit)}`)
      }
      console.log(formatSubmissionAssetReport({ ...afterAudit, ...pruning }))
    },
  }
}

export default defineConfig({
  base: './',
  // Do not auto-launch the system browser: the dev server gets started and
  // restarted a lot during work, and each restart would pop a new window.
  // Open http://localhost:5173 yourself, or use `npm run dev -- --open`.
  server: { open: false },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  plugins: [submissionRuntimeAssetPruner()],
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
})
