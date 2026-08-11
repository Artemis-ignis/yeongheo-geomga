[CmdletBinding()]
param(
    [string]$OutputRoot = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$qaRoot = [IO.Path]::GetFullPath((Join-Path $workspace "output\qa"))
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $qaRoot "rights-provenance-20260810\reproduced"
}
$outputPath = [IO.Path]::GetFullPath($OutputRoot)
$qaPrefix = $qaRoot.TrimEnd("\") + "\"
if (-not $outputPath.StartsWith($qaPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "OutputRoot must stay inside $qaRoot"
}
if ((Test-Path -LiteralPath $outputPath) -and -not $Force) {
    $existing = Get-ChildItem -LiteralPath $outputPath -Force -ErrorAction Stop
    if (@($existing).Count -gt 0) {
        throw "OutputRoot is not empty. Pass -Force to replace only the named QA outputs: $outputPath"
    }
}
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

$uv = "C:\Users\50106\AppData\Local\Microsoft\WinGet\Packages\astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe\uv.exe"
$heroPython = "C:\Users\50106\AppData\Local\uv\cache\archive-v0\CXEHHHDegTyyXRIW\Scripts\python.exe"
$chromaPython = "C:\Users\50106\.codex\tools\blender_mcp\mcp\.venv\Scripts\python.exe"
$removeKey = "C:\Users\50106\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py"
$heroNormalizer = Join-Path $PSScriptRoot "normalize_heroine_components.py"
$serpentNormalizer = Join-Path $PSScriptRoot "normalize_jade_serpent_components.py"
$comparer = Join-Path $PSScriptRoot "compare_image_pixels.py"

$requiredTools = @($uv, $heroPython, $chromaPython, $removeKey, $heroNormalizer, $serpentNormalizer, $comparer)
foreach ($requiredTool in $requiredTools) {
    if (-not (Test-Path -LiteralPath $requiredTool -PathType Leaf)) {
        throw "Required provenance tool is missing: $requiredTool"
    }
}

$records = @(
    [ordered]@{
        id = "AS-04"
        name = "seolryeong-heroine-motion-v4"
        original = Join-Path $workspace "artifacts\2d-build\provenance\recovered-imagegen-originals\AS-04-seolryeong-heroine-motion-v4-original.png"
        generatedOriginal = "C:\Users\50106\.codex\generated_images\019fe266-d780-71f3-afc9-be129253ebb1\exec-5df835cf-c68d-412d-ab42-4a61628b670b.png"
        source = Join-Path $workspace "public\assets\sprites2d\source\seolryeong-heroine-motion-sheet-v4.png"
        runtime = Join-Path $workspace "public\assets\sprites2d\seolryeong-heroine-motion-v4.png"
        sessionId = "019fe266-d780-71f3-afc9-be129253ebb1"
        log = "C:\Users\50106\.codex\archived_sessions\rollout-2026-08-09T02-23-38-019fe266-d780-71f3-afc9-be129253ebb1.jsonl"
        generationLine = 727
        transformLines = @(779, 788)
    },
    [ordered]@{
        id = "AS-14"
        name = "jade-serpent-motion-v1"
        original = Join-Path $workspace "artifacts\2d-build\provenance\recovered-imagegen-originals\AS-14-jade-serpent-motion-v1-original.png"
        generatedOriginal = "C:\Users\50106\.codex\generated_images\019fe25a-e641-7513-afb9-5b7a537cd533\exec-784f3722-5ae1-4794-8531-e1e03696b7c5.png"
        source = Join-Path $workspace "public\assets\sprites2d\source\jade-serpent-motion-sheet-v1.png"
        runtime = Join-Path $workspace "public\assets\sprites2d\jade-serpent-motion-v1.png"
        sessionId = "019fe25a-e641-7513-afb9-5b7a537cd533"
        log = "C:\Users\50106\.codex\archived_sessions\rollout-2026-08-09T02-10-35-019fe25a-e641-7513-afb9-5b7a537cd533.jsonl"
        generationLine = 516
        transformLines = @(609)
    },
    [ordered]@{
        id = "AS-16"
        name = "blood-scorpion-motion-v1"
        original = Join-Path $workspace "artifacts\2d-build\provenance\recovered-imagegen-originals\AS-16-blood-scorpion-motion-v1-original.png"
        generatedOriginal = "C:\Users\50106\.codex\generated_images\019fe25b-4127-77d3-8af4-9204d31df485\exec-dfac7553-c13d-4e05-9b7f-4907d1cd50b0.png"
        source = Join-Path $workspace "public\assets\sprites2d\source\blood-scorpion-motion-sheet-v1.png"
        runtime = Join-Path $workspace "public\assets\sprites2d\blood-scorpion-motion-v1.png"
        sessionId = "019fe25b-4127-77d3-8af4-9204d31df485"
        log = "C:\Users\50106\.codex\archived_sessions\rollout-2026-08-09T02-10-59-019fe25b-4127-77d3-8af4-9204d31df485.jsonl"
        generationLine = 524
        transformLines = @(637, 641, 654, 681)
    }
)

foreach ($record in $records) {
    foreach ($requiredPath in @($record.original, $record.source, $record.runtime, $record.log)) {
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "Required provenance input is missing: $requiredPath"
        }
    }
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $Executable $($Arguments -join ' ')"
    }
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-TextSha256 {
    param([Parameter(Mandatory = $true)][string]$Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-ImageInfo {
    param([Parameter(Mandatory = $true)][string]$Path)
    $bitmap = [Drawing.Bitmap]::FromFile($Path)
    try {
        return [ordered]@{
            path = $Path
            bytes = (Get-Item -LiteralPath $Path).Length
            width = $bitmap.Width
            height = $bitmap.Height
            pixelFormat = [string]$bitmap.PixelFormat
            sha256 = Get-Sha256 $Path
        }
    }
    finally {
        $bitmap.Dispose()
    }
}

function Get-GenerationEvidence {
    param(
        [Parameter(Mandatory = $true)][string]$LogPath,
        [Parameter(Mandatory = $true)][int]$LineNumber
    )
    $line = [IO.File]::ReadLines($LogPath) | Select-Object -Index ($LineNumber - 1)
    $event = $line | ConvertFrom-Json
    if ($event.type -ne "event_msg" -or $event.payload.type -ne "image_generation_end") {
        throw "Expected image_generation_end at ${LogPath}:$LineNumber"
    }
    $prompt = [string]$event.payload.revised_prompt
    return [ordered]@{
        logPath = $LogPath
        line = $LineNumber
        callId = [string]$event.payload.call_id
        status = [string]$event.payload.status
        revisedPromptSha256 = Get-TextSha256 $prompt
        revisedPrompt = $prompt
    }
}

function Compare-Image {
    param(
        [Parameter(Mandatory = $true)][string]$Expected,
        [Parameter(Mandatory = $true)][string]$Actual
    )
    $json = & $heroPython $comparer $Expected $Actual
    if ($LASTEXITCODE -ne 0) {
        throw "Pixel comparison failed: $Expected <> $Actual"
    }
    return ($json | ConvertFrom-Json)
}

Add-Type -AssemblyName System.Drawing

$heroSourceOut = Join-Path $outputPath "seolryeong-heroine-motion-sheet-v4.png"
$heroRuntimeOut = Join-Path $outputPath "seolryeong-heroine-motion-v4.png"
$serpentSourceOut = Join-Path $outputPath "jade-serpent-motion-sheet-v1.png"
$serpentRuntimeOut = Join-Path $outputPath "jade-serpent-motion-v1.png"
$scorpionContractOut = Join-Path $outputPath "blood-scorpion-motion-v1.contract.png"
$scorpionResizedOut = Join-Path $outputPath "blood-scorpion-motion-v1.resized.png"
$scorpionNormalizedOut = Join-Path $outputPath "blood-scorpion-motion-v1.normalized.png"
$scorpionSourceOut = Join-Path $outputPath "blood-scorpion-motion-sheet-v1.png"
$scorpionRuntimeOut = Join-Path $outputPath "blood-scorpion-motion-v1.png"

if ($Force) {
    foreach ($namedOutput in @(
        $heroSourceOut,
        $heroRuntimeOut,
        $serpentSourceOut,
        $serpentRuntimeOut,
        $scorpionContractOut,
        $scorpionResizedOut,
        $scorpionNormalizedOut,
        $scorpionSourceOut,
        $scorpionRuntimeOut,
        (Join-Path $outputPath "provenance-comparison.json")
    )) {
        if (Test-Path -LiteralPath $namedOutput -PathType Leaf) {
            Remove-Item -LiteralPath $namedOutput -Force
        }
    }
}

# AS-04: archived component extraction, then the archived chroma-key settings.
Invoke-Checked $heroPython @($heroNormalizer, $records[0].original, $heroSourceOut)
Invoke-Checked $heroPython @(
    $removeKey,
    "--input", $heroSourceOut,
    "--out", $heroRuntimeOut,
    "--auto-key", "border",
    "--soft-matte",
    "--transparent-threshold", "12",
    "--opaque-threshold", "220",
    "--despill"
)

# AS-14: archived connected-component extraction, then the archived chroma-key settings.
Invoke-Checked $uv @(
    "run", "--with", "pillow", "--with", "scipy", "python",
    $serpentNormalizer, $records[1].original, $serpentSourceOut
)
Invoke-Checked $uv @(
    "run", "--with", "pillow", "python", $removeKey,
    "--input", $serpentSourceOut,
    "--out", $serpentRuntimeOut,
    "--auto-key", "border",
    "--soft-matte",
    "--transparent-threshold", "12",
    "--opaque-threshold", "220",
    "--despill",
    "--force"
)

# AS-16: reproduce the final archived branch: contracted matte, atlas resize,
# per-cell safety padding, RGB source reconstruction, and final contracted matte.
Invoke-Checked $chromaPython @(
    $removeKey,
    "--input", $records[2].original,
    "--out", $scorpionContractOut,
    "--auto-key", "border",
    "--soft-matte",
    "--transparent-threshold", "12",
    "--opaque-threshold", "220",
    "--despill",
    "--edge-contract", "1"
)

$scorpionContract = [Drawing.Bitmap]::FromFile($scorpionContractOut)
try {
    $scorpionResized = [Drawing.Bitmap]::new(1024, 512, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $graphics = [Drawing.Graphics]::FromImage($scorpionResized)
        try {
            $graphics.Clear([Drawing.Color]::Transparent)
            $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($scorpionContract, 0, 0, 1024, 512)
        }
        finally {
            $graphics.Dispose()
        }
        $scorpionResized.Save($scorpionResizedOut, [Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $scorpionResized.Dispose()
    }
}
finally {
    $scorpionContract.Dispose()
}

$scorpionResized = [Drawing.Bitmap]::FromFile($scorpionResizedOut)
try {
    $scorpionNormalized = [Drawing.Bitmap]::new(1024, 512, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $graphics = [Drawing.Graphics]::FromImage($scorpionNormalized)
        try {
            $graphics.Clear([Drawing.Color]::Transparent)
            $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            for ($row = 0; $row -lt 2; $row++) {
                for ($col = 0; $col -lt 4; $col++) {
                    $sourceRect = [Drawing.Rectangle]::new($col * 256, $row * 256, 256, 256)
                    $destinationRect = [Drawing.Rectangle]::new($col * 256 + 10, $row * 256 + 10, 236, 236)
                    $graphics.DrawImage(
                        $scorpionResized,
                        $destinationRect,
                        $sourceRect,
                        [Drawing.GraphicsUnit]::Pixel
                    )
                }
            }
        }
        finally {
            $graphics.Dispose()
        }
        for ($y = 0; $y -lt $scorpionNormalized.Height; $y++) {
            for ($x = 0; $x -lt $scorpionNormalized.Width; $x++) {
                $pixel = $scorpionNormalized.GetPixel($x, $y)
                if (
                    $pixel.A -gt 0 -and
                    $pixel.G -gt ($pixel.R + 15) -and
                    $pixel.G -gt ($pixel.B + 15)
                ) {
                    $scorpionNormalized.SetPixel($x, $y, [Drawing.Color]::Transparent)
                }
            }
        }
        $scorpionNormalized.Save($scorpionNormalizedOut, [Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $scorpionNormalized.Dispose()
    }
}
finally {
    $scorpionResized.Dispose()
}

$scorpionNormalized = [Drawing.Bitmap]::FromFile($scorpionNormalizedOut)
try {
    $scorpionSource = [Drawing.Bitmap]::new(1024, 512, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
    try {
        $graphics = [Drawing.Graphics]::FromImage($scorpionSource)
        try {
            $graphics.Clear([Drawing.Color]::FromArgb(0, 255, 0))
            $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceOver
            $graphics.DrawImageUnscaled($scorpionNormalized, 0, 0)
        }
        finally {
            $graphics.Dispose()
        }
        $scorpionSource.Save($scorpionSourceOut, [Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $scorpionSource.Dispose()
    }
}
finally {
    $scorpionNormalized.Dispose()
}

Invoke-Checked $chromaPython @(
    $removeKey,
    "--input", $scorpionSourceOut,
    "--out", $scorpionRuntimeOut,
    "--auto-key", "border",
    "--soft-matte",
    "--transparent-threshold", "12",
    "--opaque-threshold", "220",
    "--despill",
    "--edge-contract", "1"
)

$reproduced = @(
    [ordered]@{ source = $heroSourceOut; runtime = $heroRuntimeOut },
    [ordered]@{ source = $serpentSourceOut; runtime = $serpentRuntimeOut },
    [ordered]@{ source = $scorpionSourceOut; runtime = $scorpionRuntimeOut }
)

$assetResults = @()
for ($index = 0; $index -lt $records.Count; $index++) {
    $record = $records[$index]
    $sourceComparison = Compare-Image $record.source $reproduced[$index].source
    $runtimeComparison = Compare-Image $record.runtime $reproduced[$index].runtime
    $assetResults += [ordered]@{
        id = $record.id
        name = $record.name
        sessionId = $record.sessionId
        generation = Get-GenerationEvidence $record.log $record.generationLine
        transformEvidence = [ordered]@{
            logPath = $record.log
            lines = $record.transformLines
        }
        generatedOriginalPath = $record.generatedOriginal
        original = Get-ImageInfo $record.original
        currentSource = Get-ImageInfo $record.source
        reproducedSource = Get-ImageInfo $reproduced[$index].source
        sourceComparison = $sourceComparison
        currentRuntime = Get-ImageInfo $record.runtime
        reproducedRuntime = Get-ImageInfo $reproduced[$index].runtime
        runtimeComparison = $runtimeComparison
        technicalChainVerified = [bool]($sourceComparison.pixelExact -and $runtimeComparison.pixelExact)
    }
}

$allVerified = @($assetResults | Where-Object { -not $_.technicalChainVerified }).Count -eq 0
$report = [ordered]@{
    schemaVersion = 1
    generatedAtKst = (Get-Date).ToString("yyyy-MM-dd'T'HH:mm:ssK")
    purpose = "Recover and independently reproduce the three ImageGen sprite chains previously recorded as missing exact originals."
    scope = @("AS-04", "AS-14", "AS-16")
    verdict = if ($allVerified) { "TECHNICAL_PROVENANCE_VERIFIED" } else { "MISMATCH" }
    legalRightsVerdict = "NOT_EVALUATED_REMAINS_BLOCKED"
    caveat = "Pixel identity and archived generation evidence establish a technical lineage only. They do not prove account authority, input rights, likeness or trademark clearance, team ownership, or contest publication rights."
    tools = [ordered]@{
        uv = [ordered]@{
            path = $uv
            bytes = (Get-Item -LiteralPath $uv).Length
            sha256 = Get-Sha256 $uv
        }
        heroPythonSha256 = Get-Sha256 $heroPython
        chromaPythonSha256 = Get-Sha256 $chromaPython
        removeChromaKeySha256 = Get-Sha256 $removeKey
        heroineNormalizerSha256 = Get-Sha256 $heroNormalizer
        serpentNormalizerSha256 = Get-Sha256 $serpentNormalizer
        pixelComparerSha256 = Get-Sha256 $comparer
    }
    assets = $assetResults
}

$reportPath = Join-Path $outputPath "provenance-comparison.json"
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Output "report=$reportPath"
Write-Output "verdict=$($report.verdict)"
foreach ($asset in $assetResults) {
    Write-Output (
        "$($asset.id) source_pixel_exact=$($asset.sourceComparison.pixelExact) " +
        "runtime_pixel_exact=$($asset.runtimeComparison.pixelExact) " +
        "source_file_exact=$($asset.sourceComparison.fileExact) " +
        "runtime_file_exact=$($asset.runtimeComparison.fileExact)"
    )
}
if (-not $allVerified) {
    exit 1
}
