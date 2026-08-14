[CmdletBinding()]
param(
  [int] $Port = 4173
)

# This launcher deliberately uses only Windows PowerShell and the already-built
# dist/ directory.  A release machine must not need Node, npm, or node_modules
# just to run the game.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$gameRoot = Split-Path -Parent $PSScriptRoot
$distRoot = Join-Path $gameRoot 'dist'
$distIndex = Join-Path $distRoot 'index.html'
$serveScript = Join-Path $PSScriptRoot 'serve-dist.ps1'
$gameUrl = "http://127.0.0.1:$Port/"
$publicGameUrl = 'https://yeongheo-geomga.vercel.app/'
$server = $null
$serverLog = $null
$serverErrLog = $null

function Get-PowerShellExecutable {
  $candidate = Join-Path $PSHOME 'powershell.exe'
  if (Test-Path -LiteralPath $candidate -PathType Leaf) {
    return $candidate
  }

  $command = Get-Command powershell.exe -ErrorAction SilentlyContinue
  if ($command -and (Test-Path -LiteralPath $command.Source -PathType Leaf)) {
    return $command.Source
  }

  throw 'Windows PowerShell 실행 파일을 찾을 수 없습니다.'
}

function Get-FileSha256 {
  param([Parameter(Mandatory = $true)][byte[]] $Bytes)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Invoke-LocalHttpRequest {
  param(
    [Parameter(Mandatory = $true)][string] $Uri,
    [int] $TimeoutMilliseconds = 2000
  )

  $request = $null
  $response = $null
  $stream = $null
  $memory = $null
  try {
    $request = [Net.HttpWebRequest]::Create($Uri)
    $request.Method = 'GET'
    $request.Timeout = $TimeoutMilliseconds
    $request.ReadWriteTimeout = $TimeoutMilliseconds
    $request.AllowAutoRedirect = $false
    $request.Proxy = $null
    $response = $request.GetResponse()
    $stream = $response.GetResponseStream()
    $memory = New-Object IO.MemoryStream
    $stream.CopyTo($memory)
    [pscustomobject]@{
      StatusCode = [int]$response.StatusCode
      Bytes = $memory.ToArray()
      ContentType = [string]$response.ContentType
      Error = $null
    }
  } catch [Net.WebException] {
    $webResponse = $_.Exception.Response
    $statusCode = $null
    $errorBytes = [byte[]]@()
    if ($webResponse) {
      try {
        $statusCode = [int]$webResponse.StatusCode
        $errorStream = $webResponse.GetResponseStream()
        if ($errorStream) {
          $errorMemory = New-Object IO.MemoryStream
          $errorStream.CopyTo($errorMemory)
          $errorBytes = $errorMemory.ToArray()
          $errorMemory.Dispose()
          $errorStream.Dispose()
        }
      } catch {
        # The status code is still useful when an error body cannot be read.
      } finally {
        $webResponse.Dispose()
      }
    }
    [pscustomobject]@{
      StatusCode = $statusCode
      Bytes = $errorBytes
      ContentType = $null
      Error = $_.Exception.Message
    }
  } finally {
    if ($memory) { $memory.Dispose() }
    if ($stream) { $stream.Dispose() }
    if ($response) { $response.Dispose() }
    if ($request) { $request.Abort() }
  }
}

function Get-LocalPortOwner {
  try {
    $connection = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $connection) {
      $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    }
    if ($connection) {
      $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
      return [pscustomobject]@{
        ProcessId = [int]$connection.OwningProcess
        ProcessName = if ($process) { [string]$process.ProcessName } else { '알 수 없음' }
      }
    }
  } catch {
    # Get-NetTCPConnection is unavailable on some older Windows images.  The
    # HTTP probe below remains authoritative for normal launcher operation.
  }
  return $null
}

function Get-GameServerInfo {
  $probe = Invoke-LocalHttpRequest -Uri $gameUrl -TimeoutMilliseconds 2000
  $body = [Text.Encoding]::UTF8.GetString([byte[]]$probe.Bytes)
  $markers = @(
    '<title>영허검가</title>',
    '<canvas id="scene"></canvas>',
    '<div id="hud"></div>',
    'type="module"'
  )
  $markerMatch = ($probe.StatusCode -eq 200) -and ($probe.Bytes.Length -gt 300)
  foreach ($marker in $markers) {
    if (-not $body.Contains($marker)) { $markerMatch = $false; break }
  }

  $localHash = $null
  $remoteHash = $null
  if (Test-Path -LiteralPath $distIndex -PathType Leaf) {
    $localBytes = [IO.File]::ReadAllBytes($distIndex)
    $localHash = Get-FileSha256 -Bytes $localBytes
    if ($probe.StatusCode -eq 200) {
      $remoteHash = Get-FileSha256 -Bytes ([byte[]]$probe.Bytes)
    }
  }

  [pscustomobject]@{
    IsGame = [bool]($markerMatch -or ($localHash -and $localHash -eq $remoteHash))
    StatusCode = $probe.StatusCode
    Error = $probe.Error
    ExactBuild = [bool]($localHash -and $localHash -eq $remoteHash)
    ContentLength = $probe.Bytes.Length
  }
}

function Open-GameOnce {
  param([string] $Url = $gameUrl)

  if ($env:YEONGHEO_NO_BROWSER -eq '1') {
    Write-Host '  YEONGHEO_NO_BROWSER=1 이므로 브라우저를 열지 않습니다.'
    return
  }

  # Keep this as the only browser-launching call in the entire release path.
  # Vite/serve-dist never auto-opens a browser, so one launcher invocation
  # produces exactly one navigation.
  Start-Process -FilePath 'explorer.exe' -ArgumentList @($Url) | Out-Null
  Write-Host '  브라우저를 한 번 열었습니다.'
}

function Read-ServerLog {
  $parts = @()
  foreach ($file in @($serverLog, $serverErrLog)) {
    if ($file -and (Test-Path -LiteralPath $file -PathType Leaf)) {
      $content = Get-Content -LiteralPath $file -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
      if ($content) { $parts += $content.Trim() }
    }
  }
  return ($parts -join "`n")
}

try {
  Write-Host ''
  Write-Host '  영허검가를 실행합니다...'
  Write-Host ''

  if (-not (Test-Path -LiteralPath $distIndex -PathType Leaf)) {
    Write-Host '  로컬 dist 빌드가 없어 최신 공개 빌드를 엽니다.'
    Write-Host "  공개 게임 주소: $publicGameUrl"
    Open-GameOnce -Url $publicGameUrl
    exit 0
  }
  if (-not (Test-Path -LiteralPath $serveScript -PathType Leaf)) {
    throw "정적 서버 실행기가 없습니다: $serveScript"
  }

  $existing = Get-GameServerInfo
  if ($existing.IsGame) {
    Write-Host '  이미 실행 중인 영허검가 서버를 재사용합니다.'
    if (-not $existing.ExactBuild) {
      Write-Host '  참고: 현재 서버는 같은 게임의 이전 빌드일 수 있습니다.'
    }
    Write-Host "  게임 주소: $gameUrl"
    Open-GameOnce
    exit 0
  }

  $owner = Get-LocalPortOwner
  if ($owner) {
    $detail = "$($owner.ProcessName) (PID $($owner.ProcessId))"
    $status = if ($existing.StatusCode) { "HTTP $($existing.StatusCode)" } elseif ($existing.Error) { $existing.Error } else { 'HTTP 응답 없음' }
    throw "포트 $Port 는 이미 다른 프로그램이 사용 중입니다: $detail / $status`n기존 프로세스는 안전을 위해 종료하지 않았습니다."
  }

  $powershell = Get-PowerShellExecutable
  $tempRoot = [IO.Path]::GetTempPath()
  $serverLog = Join-Path $tempRoot ("yeongheo-geomga-server-$PID.log")
  $serverErrLog = Join-Path $tempRoot ("yeongheo-geomga-server-$PID.err.log")
  Remove-Item -LiteralPath $serverLog, $serverErrLog -Force -ErrorAction SilentlyContinue

  Write-Host '  Node/npm 없이 dist 폴더를 정적 서버로 준비합니다.'
  Write-Host "  게임 주소: $gameUrl"
  $arguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', ('"{0}"' -f $serveScript),
    '-Root', ('"{0}"' -f $distRoot),
    '-Port', [string]$Port,
    '-ParentPid', [string]$PID
  )
  $server = Start-Process -FilePath $powershell -ArgumentList $arguments -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrLog -PassThru

  $deadline = (Get-Date).AddSeconds(30)
  $ready = $false
  while ((Get-Date) -lt $deadline) {
    if ($server.HasExited) { break }
    $info = Get-GameServerInfo
    if ($info.IsGame) { $ready = $true; break }
    Start-Sleep -Milliseconds 250
  }

  if ($server.HasExited) {
    $log = Read-ServerLog
    $extra = if ($log) { "`n서버 로그:`n$log" } else { '' }
    throw "게임 서버가 시작 중 종료되었습니다. 종료 코드: $($server.ExitCode)$extra"
  }
  if (-not $ready) {
    $log = Read-ServerLog
    $extra = if ($log) { "`n서버 로그:`n$log" } else { '' }
    throw "30초 안에 게임 서버가 응답하지 않았습니다.$extra"
  }

  Write-Host '  준비 완료.'
  Open-GameOnce

  # Browserless smoke tests can start, probe, and cleanly stop the server
  # without needing to send Ctrl+C or kill a process (which would skip finally).
  if ($env:YEONGHEO_TEST_MODE -eq '1') {
    Write-Host '  YEONGHEO_TEST_MODE=1 이므로 smoke test를 위해 종료합니다.'
    exit 0
  }

  Write-Host '  이 창을 닫거나 종료하면 게임 서버도 정리됩니다.'
  Wait-Process -Id $server.Id
} catch {
  Write-Host ''
  Write-Host "  [영허검가 실행 오류] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    try { Wait-Process -Id $server.Id -Timeout 3 -ErrorAction SilentlyContinue } catch { }
  }
  foreach ($logPath in @($serverLog, $serverErrLog)) {
    if ($logPath) {
      Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
    }
  }
}
