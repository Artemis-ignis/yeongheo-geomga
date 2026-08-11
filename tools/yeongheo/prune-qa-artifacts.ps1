[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [switch]$Apply,
    [string]$Workspace = '',
    [string]$RetentionManifest = '',
    [Alias('TempPath')]
    [string[]]$TemporaryPath = @()
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

<#
.SYNOPSIS
    Plans or removes only untracked QA files under the bounded QA targets.

.DESCRIPTION
    The default is a read-only dry-run. The only implicit target is
    output/qa/runs. Additional targets must be supplied one at a time with
    -TemporaryPath and must remain under output/qa or tmp. output/releases is
    immutable, as are the current v5.3 evidence paths cited by the release
    records. Existing tracked files are always skipped; .gitignore does not
    retroactively remove or untrack files.

    -Apply requires -RetentionManifest. The manifest is JSON with
    schemaVersion=1 and a non-empty retainedPaths array of workspace-relative
    paths. A retained path protects itself and all descendants. -WhatIf can be
    combined with -Apply for a second, PowerShell-level no-write preview.
#>

$defaultWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($Workspace)) {
    $Workspace = $defaultWorkspace
}
elseif (-not [IO.Path]::IsPathRooted($Workspace)) {
    $Workspace = [IO.Path]::GetFullPath($Workspace)
}

function Get-InputFullPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    if ([IO.Path]::IsPathRooted($Path)) {
        return [IO.Path]::GetFullPath($Path)
    }
    return [IO.Path]::GetFullPath((Join-Path $script:WorkspaceReal $Path))
}

function Get-ExistingRealPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [switch]$MustExist
    )

    $candidate = Get-InputFullPath $Path
    if (-not (Test-Path -LiteralPath $candidate)) {
        if ($MustExist) {
            throw "경로가 없습니다: $Path"
        }
        return $candidate
    }

    $resolved = Resolve-Path -LiteralPath $candidate -ErrorAction Stop
    $item = Get-Item -LiteralPath $resolved.Path -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "reparse point 경로는 안전하게 처리하지 않습니다: $Path"
    }
    return [IO.Path]::GetFullPath($item.FullName)
}

function Test-IsInside {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $pathFull = [IO.Path]::GetFullPath($Path)
    if ($pathFull.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }
    $prefix = $rootFull + [IO.Path]::DirectorySeparatorChar
    return $pathFull.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-InWorkspace {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-IsInside -Root $script:WorkspaceReal -Path $Path)) {
        throw "workspace 밖의 경로는 처리하지 않습니다: $Path"
    }
    return [IO.Path]::GetFullPath($Path)
}

function Get-WorkspaceRelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $full = Assert-InWorkspace $Path
    $root = $script:WorkspaceReal.TrimEnd('\', '/')
    if ($full.Equals($root, [StringComparison]::OrdinalIgnoreCase)) {
        return ''
    }
    return $full.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}

function Normalize-RelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return $Path.Replace('\', '/').TrimStart('./').TrimEnd('/')
}

function Add-UniquePath {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Collections.Generic.List[string]]$List,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Collections.Generic.HashSet[string]]$Seen,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $full = [IO.Path]::GetFullPath($Path)
    if ($Seen.Add($full)) {
        $List.Add($full)
    }
}

$workspaceCandidate = Get-ExistingRealPath $Workspace -MustExist
$workspaceItem = Get-Item -LiteralPath $workspaceCandidate -Force -ErrorAction Stop
if (-not $workspaceItem.PSIsContainer) {
    throw "Workspace는 디렉터리여야 합니다: $Workspace"
}
# Establish the workspace real path before any relative-path helper can use it.
# The candidate itself is the root, so it is not "inside" a pre-existing root.
$script:WorkspaceReal = [IO.Path]::GetFullPath($workspaceCandidate).TrimEnd('\', '/')

$qaRoot = [IO.Path]::GetFullPath((Join-Path $script:WorkspaceReal 'output\qa'))
$runsRoot = [IO.Path]::GetFullPath((Join-Path $qaRoot 'runs'))
$tmpRoot = [IO.Path]::GetFullPath((Join-Path $script:WorkspaceReal 'tmp'))
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $script:WorkspaceReal 'output\releases'))

# These are cited by the current v5.3 release audit and handoff. They remain
# immutable even if a caller accidentally passes one as -TemporaryPath.
$currentV53Protected = @(
    'output/releases/yeongheo-geomga-web-release-v5.3-20260810.zip',
    'output/releases/yeongheo-geomga-windows-portable-v5.3-20260810.zip',
    'output/releases/yeongheo-geomga-submission-video-v5.3-1080p-audio-166s-20260810.webm',
    'output/releases/yeongheo-geomga-thumbnail-v5.3-1920x1080.png',
    'output/releases/SHA256SUMS-v5.3-20260810.txt',
    'output/releases/screenshots-v5.3',
    'output/qa/v5.3-final-seal-20260810.json',
    'output/qa/v5.3-bannerfix-package-verify-20260810/web',
    'output/playwright/v5.3-bannerfix-current-package-video/fullrun-record-report.json'
) | ForEach-Object { Normalize-RelativePath $_ }

$protectedRelative = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
)
foreach ($path in $currentV53Protected) {
    [void]$protectedRelative.Add($path)
}

function Test-IsProtectedRelativePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $relative = Normalize-RelativePath $RelativePath
    foreach ($protected in $protectedRelative) {
        if ($relative.Equals($protected, [StringComparison]::OrdinalIgnoreCase) -or
            $relative.StartsWith("$protected/", [StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Read-RetentionManifest {
    param([Parameter(Mandatory = $true)][string]$Path)

    $manifestFull = Get-ExistingRealPath $Path -MustExist
    [void](Assert-InWorkspace $manifestFull)
    if ((Get-Item -LiteralPath $manifestFull -Force).PSIsContainer) {
        throw "RetentionManifest는 파일이어야 합니다: $Path"
    }
    $manifestRelative = Get-WorkspaceRelativePath $manifestFull
    if (Test-IsProtectedRelativePath $manifestRelative) {
        throw "현재 v5.3 evidence 위치를 retention manifest로 사용할 수 없습니다: $manifestRelative"
    }

    try {
        $manifest = Get-Content -LiteralPath $manifestFull -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "RetentionManifest JSON을 읽을 수 없습니다: $Path"
    }
    if ($null -eq $manifest -or $manifest.schemaVersion -ne 1) {
        throw 'RetentionManifest schemaVersion은 1이어야 합니다.'
    }
    $retained = @($manifest.retainedPaths)
    if ($retained.Count -eq 0) {
        throw 'RetentionManifest retainedPaths는 비어 있을 수 없습니다.'
    }

    $result = [System.Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )
    foreach ($declared in $retained) {
        if ($declared -isnot [string] -or [string]::IsNullOrWhiteSpace($declared)) {
            throw 'RetentionManifest retainedPaths에는 비어 있지 않은 문자열만 허용됩니다.'
        }
        $declaredFull = Get-ExistingRealPath $declared
        [void](Assert-InWorkspace $declaredFull)
        $declaredRelative = Get-WorkspaceRelativePath $declaredFull
        [void]$result.Add($declaredRelative)
    }
    # Never remove the manifest itself if it happens to live under a target.
    [void]$result.Add($manifestRelative)
    return $result
}

if ($Apply -and [string]::IsNullOrWhiteSpace($RetentionManifest)) {
    throw '-Apply에는 -RetentionManifest가 반드시 필요합니다. 기본 실행은 dry-run입니다.'
}

if ([string]::IsNullOrWhiteSpace($RetentionManifest)) {
    Write-Output 'retentionManifest=none (dry-run only; -Apply requires -RetentionManifest)'
}
else {
    $manifestPaths = Read-RetentionManifest $RetentionManifest
    foreach ($path in $manifestPaths) {
        [void]$protectedRelative.Add($path)
    }
    Write-Output ("retentionManifest={0} retainedPaths={1}" -f (Get-WorkspaceRelativePath (Get-ExistingRealPath $RetentionManifest -MustExist)), $manifestPaths.Count)
}

$targetRoots = [System.Collections.Generic.List[string]]::new()
$targetSeen = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
)
if (Test-Path -LiteralPath $runsRoot -PathType Container) {
    Add-UniquePath -List $targetRoots -Seen $targetSeen -Path (Get-ExistingRealPath $runsRoot -MustExist)
}

foreach ($temporary in @($TemporaryPath)) {
    if ([string]::IsNullOrWhiteSpace($temporary)) {
        throw '-TemporaryPath에는 비어 있는 경로를 넣을 수 없습니다.'
    }
    $temporaryFull = Get-ExistingRealPath $temporary -MustExist
    [void](Assert-InWorkspace $temporaryFull)
    $temporaryRelative = Get-WorkspaceRelativePath $temporaryFull
    if (Test-IsInside -Root $releaseRoot -Path $temporaryFull) {
        throw "output/releases는 immutable target입니다: $temporaryRelative"
    }
    if (Test-IsProtectedRelativePath $temporaryRelative) {
        throw "현재 v5.3 evidence는 immutable target입니다: $temporaryRelative"
    }
    if (-not (Test-IsInside -Root $qaRoot -Path $temporaryFull) -and
        -not (Test-IsInside -Root $tmpRoot -Path $temporaryFull)) {
        throw "-TemporaryPath는 output/qa 또는 tmp 아래의 명시 경로만 허용됩니다: $temporaryRelative"
    }
    Add-UniquePath -List $targetRoots -Seen $targetSeen -Path $temporaryFull
}

function Get-TargetFiles {
    param([Parameter(Mandatory = $true)][string]$Root)

    $item = Get-Item -LiteralPath $Root -Force -ErrorAction Stop
    if (-not $item.PSIsContainer) {
        return @($Root)
    }
    $directories = @(Get-ChildItem -LiteralPath $Root -Directory -Force -Recurse -ErrorAction Stop)
    foreach ($directory in $directories) {
        if (($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "reparse point 디렉터리는 처리하지 않습니다: $($directory.FullName)"
        }
    }
    $files = @(Get-ChildItem -LiteralPath $Root -File -Force -Recurse -ErrorAction Stop)
    $result = [System.Collections.Generic.List[string]]::new()
    foreach ($file in $files) {
        if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "reparse point 파일은 처리하지 않습니다: $($file.FullName)"
        }
        $real = Get-ExistingRealPath $file.FullName -MustExist
        [void](Assert-InWorkspace $real)
        $result.Add($real)
    }
    return $result
}

function Get-TrackedRelativePaths {
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($null -eq $git) {
        return (, [System.Collections.Generic.HashSet[string]]::new(
            [StringComparer]::OrdinalIgnoreCase
        ))
    }
    # Unit-test fixtures and copied workspaces may intentionally have no Git
    # metadata. Treat those as having no tracked paths instead of surfacing
    # Git's diagnostic on stderr as a terminating PowerShell error.
    if (-not (Test-Path -LiteralPath (Join-Path $script:WorkspaceReal '.git'))) {
        return (, [System.Collections.Generic.HashSet[string]]::new(
            [StringComparer]::OrdinalIgnoreCase
        ))
    }
    $tracked = [System.Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )
    try {
        $lines = @(& $git.Source -C $script:WorkspaceReal ls-files --cached 2>$null)
    }
    catch {
        return (, $tracked)
    }
    if ($LASTEXITCODE -ne 0) {
        return (, $tracked)
    }
    foreach ($line in $lines) {
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            [void]$tracked.Add((Normalize-RelativePath $line))
        }
    }
    return (, $tracked)
}

$trackedRelative = Get-TrackedRelativePaths
$candidateFiles = [System.Collections.Generic.List[object]]::new()
$candidateSeen = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
)
$skippedTracked = 0
$skippedProtected = 0

foreach ($targetRoot in $targetRoots) {
    foreach ($file in @(Get-TargetFiles $targetRoot)) {
        $relative = Get-WorkspaceRelativePath $file
        if (-not $candidateSeen.Add($file)) {
            continue
        }
        if ($trackedRelative.Contains($relative)) {
            $skippedTracked++
            continue
        }
        if (Test-IsProtectedRelativePath $relative) {
            $skippedProtected++
            continue
        }
        $candidateFiles.Add([pscustomobject]@{
                AbsolutePath = $file
                RelativePath = $relative
                Bytes = (Get-Item -LiteralPath $file -Force).Length
            })
    }
}

$mode = if ($Apply) { 'APPLY' } else { 'DRY_RUN' }
Write-Output ("qa-retention mode={0} workspace={1}" -f $mode, $script:WorkspaceReal)
Write-Output ("targets={0} candidates={1} skippedTracked={2} skippedProtected={3}" -f $targetRoots.Count, $candidateFiles.Count, $skippedTracked, $skippedProtected)
foreach ($candidate in $candidateFiles) {
    Write-Output ("candidate`t{0}`t{1} bytes" -f $candidate.RelativePath, $candidate.Bytes)
}

if ($Apply) {
    foreach ($candidate in $candidateFiles) {
        if (-not (Test-Path -LiteralPath $candidate.AbsolutePath -PathType Leaf)) {
            continue
        }
        if ($PSCmdlet.ShouldProcess($candidate.RelativePath, 'Remove untracked QA artifact')) {
            Remove-Item -LiteralPath $candidate.AbsolutePath -Force
            Write-Output ("removed`t{0}" -f $candidate.RelativePath)
        }
    }
}
