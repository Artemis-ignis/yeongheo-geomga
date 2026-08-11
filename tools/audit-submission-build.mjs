import { auditSubmissionAssets, formatSubmissionAssetReport } from './submission-assets.mjs'

const report = auditSubmissionAssets()
console.log(JSON.stringify(report, null, 2))
console.log(formatSubmissionAssetReport(report))
if (!report.ok) process.exitCode = 1
