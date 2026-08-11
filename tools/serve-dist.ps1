[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string] $Root,
  [int] $Port = 4173,
  [string] $BindHost = '127.0.0.1',
  [int] $ParentPid = 0
)

# Minimal release server for machines that do not have Node/npm installed.
# It serves only the resolved dist root; no directory listing or fallback to
# arbitrary filesystem paths is exposed.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$resolvedRoot = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path
$indexPath = Join-Path $resolvedRoot 'index.html'
if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
  throw "정적 게임 빌드의 index.html을 찾을 수 없습니다: $indexPath"
}

$rootFull = [IO.Path]::GetFullPath($resolvedRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$rootPrefix = $rootFull + [IO.Path]::DirectorySeparatorChar
$prefix = "http://$BindHost`:$Port/"
$listener = New-Object Net.HttpListener
$listener.Prefixes.Add($prefix)

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.map'  = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
  '.xml'  = 'application/xml; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.gif'  = 'image/gif'
  '.ico'  = 'image/x-icon'
  '.avif' = 'image/avif'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ttf'  = 'font/ttf'
  '.otf'  = 'font/otf'
  '.wasm' = 'application/wasm'
  '.mp3'  = 'audio/mpeg'
  '.ogg'  = 'audio/ogg'
  '.wav'  = 'audio/wav'
  '.webm' = 'video/webm'
  '.mp4'  = 'video/mp4'
}

function Write-ErrorResponse {
  param(
    [Parameter(Mandatory = $true)] $Context,
    [int] $StatusCode,
    [Parameter(Mandatory = $true)][string] $Message
  )
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Message)
    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = 'text/plain; charset=utf-8'
    $Context.Response.ContentLength64 = $bytes.Length
    if ($Context.Request.HttpMethod -ne 'HEAD') {
      $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } finally {
    $Context.Response.Close()
  }
}

function Resolve-SafeFilePath {
  param([Parameter(Mandatory = $true)][string] $RequestPath)

  try {
    $decoded = [Uri]::UnescapeDataString($RequestPath)
  } catch {
    throw [InvalidOperationException]::new('잘못된 URL 인코딩입니다.')
  }
  if ([string]::IsNullOrWhiteSpace($decoded)) { $decoded = '/' }
  if ($decoded.IndexOf([char]0) -ge 0) { throw [UnauthorizedAccessException]::new('허용되지 않은 경로입니다.') }

  # Convert URL separators only after decoding, then reject rooted paths and
  # resolve the final path before checking it remains inside dist/.
  $relative = $decoded.TrimStart('/', '\')
  if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
  $relative = $relative.Replace('/', [IO.Path]::DirectorySeparatorChar)
  if ([IO.Path]::IsPathRooted($relative) -or $relative.Contains(':')) {
    throw [UnauthorizedAccessException]::new('허용되지 않은 경로입니다.')
  }
  $candidate = [IO.Path]::GetFullPath([IO.Path]::Combine($rootFull, $relative))
  if (-not $candidate.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase) -and -not $candidate.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw [UnauthorizedAccessException]::new('dist 폴더 바깥의 파일은 제공하지 않습니다.')
  }
  return $candidate
}

function Test-ParentAlive {
  if ($ParentPid -le 0) { return $true }
  return [bool](Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)
}

try {
  $listener.Start()
  Write-Output "YEONGHEO_SERVER_READY $prefix"
  [Console]::Out.Flush()

  # Keep exactly one outstanding accept task. Creating a fresh GetContextAsync
  # after every one-second parent liveness check abandons the old task; later
  # requests are then consumed by those orphaned tasks and receive no response.
  $contextTask = $null
  while ($listener.IsListening -and (Test-ParentAlive)) {
    try {
      if (-not $contextTask) { $contextTask = $listener.GetContextAsync() }
      if (-not $contextTask.Wait(1000)) { continue }
      $context = $contextTask.Result
      $contextTask = $null
    } catch [AggregateException] {
      $contextTask = $null
      if (-not $listener.IsListening) { break }
      continue
    } catch [InvalidOperationException] {
      $contextTask = $null
      if (-not $listener.IsListening) { break }
      throw
    }

    try {
      $method = $context.Request.HttpMethod.ToUpperInvariant()
      if ($method -ne 'GET' -and $method -ne 'HEAD') {
        Write-ErrorResponse -Context $context -StatusCode 405 -Message 'GET 또는 HEAD 요청만 허용됩니다.'
        continue
      }

      $filePath = Resolve-SafeFilePath -RequestPath $context.Request.Url.AbsolutePath
      if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        Write-ErrorResponse -Context $context -StatusCode 404 -Message '파일을 찾을 수 없습니다.'
        continue
      }

      $fileInfo = Get-Item -LiteralPath $filePath -Force
      $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
      $context.Response.StatusCode = 200
      $context.Response.ContentType = $contentType
      $context.Response.Headers['X-Content-Type-Options'] = 'nosniff'
      $context.Response.Headers['Cache-Control'] = 'no-cache'
      $context.Response.ContentLength64 = $fileInfo.Length

      if ($method -eq 'GET') {
        $fileStream = $null
        try {
          $fileStream = [IO.File]::OpenRead($filePath)
          $fileStream.CopyTo($context.Response.OutputStream)
        } finally {
          if ($fileStream) { $fileStream.Dispose() }
        }
      }
      $context.Response.Close()
    } catch [UnauthorizedAccessException] {
      Write-ErrorResponse -Context $context -StatusCode 403 -Message $_.Exception.Message
    } catch [IO.FileNotFoundException] {
      Write-ErrorResponse -Context $context -StatusCode 404 -Message '파일을 찾을 수 없습니다.'
    } catch {
      Write-ErrorResponse -Context $context -StatusCode 500 -Message '정적 파일을 읽는 중 오류가 발생했습니다.'
    }
  }
} finally {
  if ($listener) {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
  }
}
