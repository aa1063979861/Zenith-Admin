$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$mysqlExe = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $pnpmCommand) {
  $pnpmCommand = Get-Command pnpm -ErrorAction Stop
}
$pnpmExe = $pnpmCommand.Source
$runtimeDir = Join-Path $repoRoot '.runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$serverOutLog = Join-Path $runtimeDir 'server.out.log'
$serverErrLog = Join-Path $runtimeDir 'server.err.log'
$webOutLog = Join-Path $runtimeDir 'web.out.log'
$webErrLog = Join-Path $runtimeDir 'web.err.log'

function Test-PortListening {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Stop-PortProcess {
  param([int]$Port)
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    if ($connection.OwningProcess) {
      Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host 'Checking MySQL84 service...'
$mysqlService = Get-Service -Name 'MySQL84' -ErrorAction Stop
if ($mysqlService.Status -ne 'Running') {
  Start-Service -Name 'MySQL84'
  Start-Sleep -Seconds 5
}

if (-not (Test-PortListening 3306)) {
  throw 'MySQL84 did not open port 3306.'
}

Write-Host 'Checking MySQL root empty-password login and database...'
& $mysqlExe --protocol=TCP --host=127.0.0.1 --port=3306 --user=root --skip-password -e "CREATE DATABASE IF NOT EXISTS zenith_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
if ($LASTEXITCODE -ne 0) {
  throw 'Cannot login to MySQL as root with empty password.'
}

Write-Host 'Building backend...'
Push-Location $repoRoot
& $pnpmExe --filter '@zenith-admin/server' build
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  throw 'Backend build failed.'
}

Write-Host 'Restarting backend on 8085...'
Stop-PortProcess 8085
Start-Process -FilePath 'node' -ArgumentList 'dist/main.js' -WorkingDirectory (Join-Path $repoRoot 'apps/server') -WindowStyle Hidden -RedirectStandardOutput $serverOutLog -RedirectStandardError $serverErrLog

for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  if (Test-PortListening 8085) {
    break
  }
}
if (-not (Test-PortListening 8085)) {
  Get-Content -Tail 80 $serverErrLog -ErrorAction SilentlyContinue
  Pop-Location
  throw 'Backend did not open port 8085.'
}

Write-Host 'Restarting frontend on 3200...'
Stop-PortProcess 3200
Start-Process -FilePath $pnpmExe -ArgumentList 'dev', '--host', '0.0.0.0' -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $webOutLog -RedirectStandardError $webErrLog

for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  if (Test-PortListening 3200) {
    break
  }
}
if (-not (Test-PortListening 3200)) {
  Get-Content -Tail 80 $webErrLog -ErrorAction SilentlyContinue
  Pop-Location
  throw 'Frontend did not open port 3200.'
}

Pop-Location

Write-Host 'ZenithAdmin dev environment is running:'
Write-Host '  Frontend: http://127.0.0.1:3200/'
Write-Host '  Backend:  http://127.0.0.1:8085/'
