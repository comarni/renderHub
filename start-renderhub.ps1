param(
    [switch]$NoTail
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logsDir = Join-Path $root '.runlogs'
if (!(Test-Path -LiteralPath $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

function Stop-PortOwner {
    param([int]$Port)
    $owners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($owner in $owners) {
        try {
            Stop-Process -Id $owner -Force -ErrorAction Stop
            Write-Host "[renderhub] stopped PID $owner on port $Port"
        } catch {
            Write-Host ("[renderhub] could not stop PID {0} on port {1}: {2}" -f $owner, $Port, $_.Exception.Message)
        }
    }
}

function Start-LoggedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory
    )

    $outLog = Join-Path $logsDir "$Name.out.log"
    $errLog = Join-Path $logsDir "$Name.err.log"

    if (Test-Path -LiteralPath $outLog) { Remove-Item -LiteralPath $outLog -Force }
    if (Test-Path -LiteralPath $errLog) { Remove-Item -LiteralPath $errLog -Force }

    $proc = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru

    Write-Host "[renderhub] started $Name PID=$($proc.Id)"
    Write-Host "[renderhub] logs: $outLog"
    return $proc
}

function Wait-ForHttp {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Retries = 30,
        [int]$DelaySeconds = 1
    )

    for ($i = 1; $i -le $Retries; $i++) {
        try {
            $resp = Invoke-RestMethod -Uri $Url -TimeoutSec 3
            Write-Host "[$Name] healthy on attempt $i"
            return $resp
        } catch {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    throw "[$Name] did not become healthy: $Url"
}

Write-Host '[renderhub] cleaning old listeners on 5500/8787/9000...'
Stop-PortOwner -Port 5500
Stop-PortOwner -Port 8787
Stop-PortOwner -Port 9000

$tripoPython = Join-Path $root 'triposr-service\.venv311\Scripts\python.exe'
if (!(Test-Path -LiteralPath $tripoPython)) {
    throw "Python venv not found: $tripoPython"
}

$triposrProc = Start-LoggedProcess -Name 'triposr' -FilePath $tripoPython -ArgumentList @('service.py') -WorkingDirectory (Join-Path $root 'triposr-service')

$aiProc = Start-LoggedProcess -Name 'ai-server' -FilePath 'npm.cmd' -ArgumentList @('run', 'dev') -WorkingDirectory (Join-Path $root 'ai-server')

$frontProc = Start-LoggedProcess -Name 'frontend' -FilePath 'npx.cmd' -ArgumentList @('http-server', '.', '-p', '5500', '--cors', '-c-1') -WorkingDirectory (Join-Path $root '3d-editor')

Start-Sleep -Seconds 2

if ($triposrProc.HasExited) { throw "triposr exited early; check .runlogs\\triposr.err.log" }
if ($aiProc.HasExited) { throw "ai-server exited early; check .runlogs\\ai-server.err.log" }
if ($frontProc.HasExited) { throw "frontend exited early; check .runlogs\\frontend.err.log" }

Write-Host ''
Write-Host '[renderhub] health checks:'
$h1 = Wait-ForHttp -Name 'triposr' -Url 'http://127.0.0.1:9000/api/v1/health'
Write-Host "[triposr] $($h1 | ConvertTo-Json -Compress)"

$h2 = Wait-ForHttp -Name 'ai-server' -Url 'http://127.0.0.1:8787/api/ai/health'
Write-Host "[ai-server] $($h2 | ConvertTo-Json -Compress)"

Write-Host '[frontend] http://127.0.0.1:5500'
Write-Host ''
Write-Host '[renderhub] to stop all: run stop-renderhub.ps1'

if (-not $NoTail) {
    Write-Host ''
    Write-Host '[renderhub] streaming logs (Ctrl+C to stop tail only)...'
    Get-Content -Path (Join-Path $logsDir '*.out.log'), (Join-Path $logsDir '*.err.log') -Wait -Tail 30
}
