param(
  [string]$SourcePath = "web-ready",
  [string]$OutputDir = "exports",
  [string]$OutName = "portfolio-cubo",
  [switch]$IncludeRootReadme
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Source path not found: $SourcePath"
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipPath = Join-Path $OutputDir ("{0}-{1}.zip" -f $OutName, $stamp)
$tempDir = Join-Path $env:TEMP ("renderhub-export-" + [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $tempDir | Out-Null

Copy-Item -LiteralPath $SourcePath -Destination (Join-Path $tempDir (Split-Path $SourcePath -Leaf)) -Recurse -Force

if ($IncludeRootReadme -and (Test-Path -LiteralPath "README.md")) {
  Copy-Item -LiteralPath "README.md" -Destination (Join-Path $tempDir "README.md") -Force
}

Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath -CompressionLevel Optimal -Force
Remove-Item -LiteralPath $tempDir -Recurse -Force

Write-Output "Export created: $zipPath"
