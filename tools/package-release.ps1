[CmdletBinding()]
param(
  [string] $ReleaseTag = 'current-20260812',
  [string] $OutputDirectory = '',
  [datetimeoffset] $ArchiveTimestamp = [datetimeoffset]'2026-08-12T00:00:00+09:00',
  [switch] $AllowUnclearedRights
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$gameRoot = Split-Path -Parent $PSScriptRoot
$distRoot = Join-Path $gameRoot 'dist'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $gameRoot 'output\releases'
}
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$rightsDisclosurePath = Join-Path $gameRoot 'public\AI_ASSET_DISCLOSURE_KO.txt'
$releaseMetadataPath = Join-Path $gameRoot 'public\release.json'

$requiredFiles = @(
  (Join-Path $distRoot 'index.html'),
  (Join-Path $gameRoot '영허검가 실행.vbs'),
  (Join-Path $PSScriptRoot 'start-game.ps1'),
  (Join-Path $PSScriptRoot 'serve-dist.ps1'),
  (Join-Path $gameRoot 'public\PLAY_GUIDE_KO.txt'),
  (Join-Path $gameRoot 'public\PRIVACY_KO.txt'),
  (Join-Path $gameRoot 'public\THIRD_PARTY_NOTICES.txt'),
  $rightsDisclosurePath,
  $releaseMetadataPath
)
foreach ($requiredFile in $requiredFiles) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "릴리스 필수 파일이 없습니다: $requiredFile"
  }
}

$releaseMetadata = [IO.File]::ReadAllText($releaseMetadataPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
if (-not $AllowUnclearedRights -and $releaseMetadata.rightsGate -ne 'CLEARED') {
  throw '권리 게이트가 BLOCKED입니다. 공개·제출용 패키지를 만들 수 없습니다. 로컬 검토 후보만 만들려면 -AllowUnclearedRights를 명시하십시오.'
}

# Vite copies these public files into dist. Refuse to package a stale dist whose
# legal notices, guide, privacy boundary, or release identity differs from the
# source-of-truth public files. This keeps the Web and Windows archives aligned.
$publicParityFiles = @(
  'PLAY_GUIDE_KO.txt',
  'PRIVACY_KO.txt',
  'THIRD_PARTY_NOTICES.txt',
  'AI_ASSET_DISCLOSURE_KO.txt',
  'release.json'
)
foreach ($relativeName in $publicParityFiles) {
  $publicPath = Join-Path (Join-Path $gameRoot 'public') $relativeName
  $distPath = Join-Path $distRoot $relativeName
  if (-not (Test-Path -LiteralPath $distPath -PathType Leaf)) {
    throw "dist에 필수 공개 문서가 없습니다: $distPath"
  }
  $publicHash = (Get-FileHash -LiteralPath $publicPath -Algorithm SHA256).Hash
  $distHash = (Get-FileHash -LiteralPath $distPath -Algorithm SHA256).Hash
  if ($publicHash -ne $distHash) {
    throw "public과 dist 문서가 다릅니다. npm run build 후 다시 시도하십시오: $relativeName"
  }
}

Add-Type -AssemblyName System.IO.Compression
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

function ConvertTo-ZipEntryName {
  param([Parameter(Mandatory = $true)][string] $Name)
  $normalized = $Name.Replace('\', '/').Trim('/')
  if ([string]::IsNullOrWhiteSpace($normalized) -or
      $normalized.Contains(':') -or
      $normalized -eq '..' -or
      $normalized.StartsWith('../') -or
      $normalized.Contains('/../')) {
    throw "허용되지 않은 ZIP 경로입니다: $Name"
  }
  return $normalized
}

function Get-TreeEntries {
  param(
    [Parameter(Mandatory = $true)][string] $SourceRoot,
    [string] $EntryPrefix = ''
  )
  $root = [IO.Path]::GetFullPath($SourceRoot).TrimEnd('\', '/')
  $files = Get-ChildItem -LiteralPath $root -File -Recurse | Sort-Object FullName
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($root.Length).TrimStart('\', '/')
    $entryName = if ([string]::IsNullOrWhiteSpace($EntryPrefix)) {
      $relative
    } else {
      Join-Path $EntryPrefix $relative
    }
    [pscustomobject]@{
      Source = $file.FullName
      Name = ConvertTo-ZipEntryName $entryName
    }
  }
}

function New-ReleaseZip {
  param(
    [Parameter(Mandatory = $true)][string] $TargetPath,
    [Parameter(Mandatory = $true)][object[]] $Entries,
    [hashtable] $TextEntries = @{}
  )
  if (Test-Path -LiteralPath $TargetPath) {
    throw "기존 릴리스 파일을 덮어쓰지 않습니다: $TargetPath"
  }

  $temporaryPath = "$TargetPath.partial-$PID"
  $stream = $null
  $archive = $null
  $succeeded = $false
  try {
    $stream = [IO.File]::Open($temporaryPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $true, [Text.Encoding]::UTF8)
    foreach ($item in ($Entries | Sort-Object Name)) {
      $entryName = ConvertTo-ZipEntryName $item.Name
      $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = $ArchiveTimestamp
      $input = $null
      $output = $null
      try {
        $input = [IO.File]::OpenRead($item.Source)
        $output = $entry.Open()
        $input.CopyTo($output)
      } finally {
        if ($output) { $output.Dispose() }
        if ($input) { $input.Dispose() }
      }
    }
    foreach ($name in ($TextEntries.Keys | Sort-Object)) {
      $entry = $archive.CreateEntry((ConvertTo-ZipEntryName $name), [IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = $ArchiveTimestamp
      $writer = $null
      try {
        $writer = [IO.StreamWriter]::new($entry.Open(), [Text.UTF8Encoding]::new($false))
        $writer.Write([string]$TextEntries[$name])
      } finally {
        if ($writer) { $writer.Dispose() }
      }
    }
    $archive.Dispose()
    $archive = $null
    $stream.Dispose()
    $stream = $null
    Move-Item -LiteralPath $temporaryPath -Destination $TargetPath
    $succeeded = $true
  } finally {
    if ($archive) { $archive.Dispose() }
    if ($stream) { $stream.Dispose() }
    if (-not $succeeded -and (Test-Path -LiteralPath $temporaryPath -PathType Leaf)) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
  }
}

$webPath = Join-Path $outputRoot "yeongheo-geomga-web-release-$ReleaseTag.zip"
$windowsPath = Join-Path $outputRoot "yeongheo-geomga-windows-portable-$ReleaseTag.zip"

$webEntries = @(Get-TreeEntries -SourceRoot $distRoot)
New-ReleaseZip -TargetPath $webPath -Entries $webEntries

$packageRoot = 'Yeongheo-Geomga'
$windowsEntries = @(
  Get-TreeEntries -SourceRoot $distRoot -EntryPrefix "$packageRoot\dist"
  [pscustomobject]@{ Source = Join-Path $gameRoot '영허검가 실행.vbs'; Name = "$packageRoot\영허검가 실행.vbs" }
  [pscustomobject]@{ Source = Join-Path $PSScriptRoot 'start-game.ps1'; Name = "$packageRoot\tools\start-game.ps1" }
  [pscustomobject]@{ Source = Join-Path $PSScriptRoot 'serve-dist.ps1'; Name = "$packageRoot\tools\serve-dist.ps1" }
  [pscustomobject]@{ Source = Join-Path $gameRoot 'public\PLAY_GUIDE_KO.txt'; Name = "$packageRoot\PLAY_GUIDE_KO.txt" }
  [pscustomobject]@{ Source = Join-Path $gameRoot 'public\PRIVACY_KO.txt'; Name = "$packageRoot\PRIVACY_KO.txt" }
  [pscustomobject]@{ Source = Join-Path $gameRoot 'public\THIRD_PARTY_NOTICES.txt'; Name = "$packageRoot\THIRD_PARTY_NOTICES.txt" }
  [pscustomobject]@{ Source = Join-Path $gameRoot 'public\AI_ASSET_DISCLOSURE_KO.txt'; Name = "$packageRoot\AI_ASSET_DISCLOSURE_KO.txt" }
  [pscustomobject]@{ Source = Join-Path $gameRoot 'public\release.json'; Name = "$packageRoot\release.json" }
)
$firstRead = @"
영허검가 Windows 휴대용 빌드

1. ZIP 전체를 원하는 폴더에 압축 해제합니다.
2. 압축을 푼 Yeongheo-Geomga 폴더의 영허검가 실행.vbs를 더블클릭합니다.
3. 최소화된 실행 창을 닫으면 로컬 게임 서버도 함께 종료됩니다.

Node, npm, 별도 설치는 필요하지 않습니다. index.html을 직접 열면 브라우저
보안 정책 때문에 실행되지 않습니다. 사용자 실행 진입점은
영허검가 실행.vbs 하나입니다.
자세한 조작법은 PLAY_GUIDE_KO.txt를 확인하십시오.
"@
New-ReleaseZip -TargetPath $windowsPath -Entries $windowsEntries -TextEntries @{ "$packageRoot\README_FIRST_KO.txt" = $firstRead }

foreach ($path in @($webPath, $windowsPath)) {
  $file = Get-Item -LiteralPath $path
  $hash = Get-FileHash -LiteralPath $path -Algorithm SHA256
  Write-Output ("{0}`t{1} bytes`tSHA256 {2}" -f $file.FullName, $file.Length, $hash.Hash.ToLowerInvariant())
}
