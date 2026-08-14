import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import {
  auditSubmissionAssets,
  formatSubmissionAssetReport,
  pruneSubmissionAssets,
} from './tools/submission-assets.mjs'

/**
 * Vite copies the entire public directory by design. Authoring sources live
 * outside public, while this final allowlist audit prevents any accidental
 * static file in public from entering the production artifact.
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll('\\', '/')
          if (path.includes('/node_modules/pixi.js/') || path.includes('/node_modules/@pixi/')) return 'pixi'
          if (path.endsWith('/src/runtime2d/PixiPresentation.js')) return 'presentation2d'
          return undefined
        },
      },
    },
  },
  plugins: [submissionRuntimeAssetPruner()],
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
})
