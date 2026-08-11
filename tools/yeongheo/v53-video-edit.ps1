[CmdletBinding()]
param(
  [string] $InputPath = 'output/playwright/v5.3-current-package-video/yeongheo-v5.3-current-package-fullrun-av-sync.webm',
  [string] $OutputPath = 'output/releases/yeongheo-geomga-submission-video-v5.3-1080p-audio-166s-20260810.webm',
  [string] $FfmpegPath = 'output/qa/v5.3-release-tools/node_modules/ffmpeg-static/ffmpeg.exe',
  [string] $ReleaseRunId = 'release-v5.3-video-3185791507-1920x1080-20260810'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$resolvedInput = (Resolve-Path -LiteralPath $InputPath -ErrorAction Stop).Path
$resolvedFfmpeg = (Resolve-Path -LiteralPath $FfmpegPath -ErrorAction Stop).Path
$resolvedOutput = [IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

# These cuts are measured against the immutable v5.3 package recording. They
# preserve title/first-ten-seconds, early build growth, mid-boss, completed Dao
# build, final boss phases, and the unforced 07:00 victory result.
$segments = @(
  @{ Start = 0.25; End = 18.25 },
  @{ Start = 43.0; End = 68.0 },
  @{ Start = 184.0; End = 215.0 },
  @{ Start = 313.0; End = 336.0 },
  @{ Start = 346.0; End = 389.0 },
  @{ Start = 414.0; End = 440.44 }
)

$filterParts = [Collections.Generic.List[string]]::new()
$concatInputs = [Collections.Generic.List[string]]::new()
for ($index = 0; $index -lt $segments.Count; $index += 1) {
  $segment = $segments[$index]
  $duration = [double]$segment.End - [double]$segment.Start
  $fadeOutAt = [Math]::Max(0, $duration - 0.25)
  $start = ([double]$segment.Start).ToString('0.###', [Globalization.CultureInfo]::InvariantCulture)
  $end = ([double]$segment.End).ToString('0.###', [Globalization.CultureInfo]::InvariantCulture)
  $fadeOut = $fadeOutAt.ToString('0.###', [Globalization.CultureInfo]::InvariantCulture)
  $filterParts.Add("[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.25,fade=t=out:st=${fadeOut}:d=0.25[v$index]")
  $filterParts.Add("[0:a]atrim=start=${start}:end=${end},asetpts=N/SR/TB,aresample=48000:async=1:first_pts=0,afade=t=in:st=0:d=0.18,afade=t=out:st=${fadeOut}:d=0.18[a$index]")
  $concatInputs.Add("[v$index][a$index]")
}
$concatPrefix = $concatInputs -join ''
$filterParts.Add($concatPrefix + 'concat=n=' + $segments.Count + ':v=1:a=1[vout][aout]')
$filterGraph = $filterParts -join ';'

$arguments = @(
  '-hide_banner',
  '-y',
  '-i', $resolvedInput,
  '-filter_complex', $filterGraph,
  '-map', '[vout]',
  '-map', '[aout]',
  '-c:v', 'libvpx',
  '-b:v', '3800k',
  '-crf', '12',
  '-deadline', 'good',
  '-cpu-used', '3',
  '-threads', '8',
  '-pix_fmt', 'yuv420p',
  '-r', '25',
  '-c:a', 'libopus',
  '-b:a', '192k',
  '-ar', '48000',
  '-ac', '2',
  '-metadata', 'title=Yeongheo Geomga v5.3 actual ascension run',
  '-metadata', "comment=$ReleaseRunId",
  $resolvedOutput
)

& $resolvedFfmpeg @arguments
if ($LASTEXITCODE -ne 0) {
  throw "ffmpeg exited with code $LASTEXITCODE"
}

$totalDuration = ($segments | ForEach-Object { [double]$_.End - [double]$_.Start } | Measure-Object -Sum).Sum
[pscustomobject]@{
  Input = $resolvedInput
  Output = $resolvedOutput
  SegmentCount = $segments.Count
  ExpectedDurationSeconds = $totalDuration
  OutputBytes = (Get-Item -LiteralPath $resolvedOutput).Length
} | ConvertTo-Json
