# build-release.ps1
# Uso: .\build-release.ps1 -Token ghp_xxxxx

param(
    [string]$Token = $env:GH_TOKEN
)

if (-not $Token) {
    Write-Error "Token GitHub nao definido. Use: .\build-release.ps1 -Token ghp_xxxxx"
    exit 1
}

Set-Location $PSScriptRoot

$nodePath = "C:\Program Files\nodejs"
if (Test-Path $nodePath) {
    $env:PATH = "$nodePath;$env:PATH"
}

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCmd) {
    $env:npm_execpath = $npmCmd.Source
} else {
    $env:npm_execpath = "$nodePath\npm.cmd"
}

$env:GH_TOKEN = $Token
$env:NODE_NO_WARNINGS = "1"

Write-Host "=== Farol Build de Release ===" -ForegroundColor Cyan
Write-Host "Token: $($Token.Substring(0,8))..." -ForegroundColor Yellow

npm run electron:build -- --publish always

if ($LASTEXITCODE -eq 0) {
    Write-Host "Release publicada em: https://github.com/ter-caio-abra-g4/Farol-tracking/releases" -ForegroundColor Green
} else {
    Write-Host "Build falhou." -ForegroundColor Red
    exit $LASTEXITCODE
}
