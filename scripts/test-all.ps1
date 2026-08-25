# One-click run all tests (v7 · TDD)
# Backend Vitest + Frontend Vitest + Selenium 5-role regression
param(
  [switch]$SkipE2E = $false
)

$ErrorActionPreference = 'Continue'
$projectRoot = $PSScriptRoot | Split-Path -Parent
$backendDir = Join-Path $projectRoot 'backend'
$frontendDir = Join-Path $projectRoot 'frontend'

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  Datawhale University Activity - Full Test Suite" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$failed = @()

# 1. Backend Vitest
Write-Host "[1/3] Backend Vitest..." -ForegroundColor Yellow
Push-Location $backendDir
try {
  $output = npm test 2>&1 | Out-String
  $output | Tee-Object -FilePath "$projectRoot\test-output-backend.log" | Out-Null
  if ($output -match '(\d+)\s+failed') {
    $count = $matches[1]
    if ([int]$count -gt 0) { $failed += 'backend' }
  } elseif ($output -notmatch 'passed') {
    $failed += 'backend'
  }
} catch {
  $failed += 'backend'
  Write-Host "  Backend test error: $_" -ForegroundColor Red
}
Pop-Location
Write-Host ""

# 2. Frontend Vitest
Write-Host "[2/3] Frontend Vitest..." -ForegroundColor Yellow
Push-Location $frontendDir
try {
  $env:VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true'
  $output = npm test 2>&1 | Out-String
  $output | Tee-Object -FilePath "$projectRoot\test-output-frontend.log" | Out-Null
  Write-Host $output -ForegroundColor Gray
  # 解析 vitest 输出
  if ($output -match '(\d+)\s+failed') {
    $count = $matches[1]
    if ([int]$count -gt 0) { $failed += 'frontend' }
  } elseif ($output -notmatch 'passed') {
    $failed += 'frontend'
  }
} catch {
  $failed += 'frontend'
  Write-Host "  Frontend test error: $_" -ForegroundColor Red
  Write-Host "  Stack: $($_.ScriptStackTrace)" -ForegroundColor Red
}
Pop-Location
Write-Host ""

# 3. Selenium 5-role regression (optional)
if (-not $SkipE2E) {
  Write-Host "[3/3] Selenium 5-role regression..." -ForegroundColor Yellow
  $seleniumScript = "C:\Users\15088\AppData\Local\Temp\snap_roleguard.py"
  if (Test-Path $seleniumScript) {
    try {
      python $seleniumScript 2>&1 | Tee-Object -FilePath "$projectRoot\test-output-e2e.log"
    } catch {
      Write-Host "  Selenium error (non-blocking): $_" -ForegroundColor Yellow
    }
  } else {
    Write-Host "  Skip (script not found: $seleniumScript)" -ForegroundColor Yellow
  }
} else {
  Write-Host "[3/3] Skip Selenium (-SkipE2E)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "=================================" -ForegroundColor Cyan
if ($failed.Count -eq 0) {
  Write-Host "  All tests passed" -ForegroundColor Green
  exit 0
} else {
  Write-Host "  Failed modules: $($failed -join ', ')" -ForegroundColor Red
  Write-Host "  See test-output-*.log for details" -ForegroundColor Yellow
  exit 1
}
