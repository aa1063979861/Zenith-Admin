param(
  [string]$HostName = '101.126.143.247',
  [string]$User = 'root',
  [string]$IdentityFile = "$env:USERPROFILE/.ssh/zhiqiangl_ed25519",
  [string]$RemoteAppDir = '/opt/zhiqiangl-admin',
  [string]$ServiceName = 'zhiqiangl-admin'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $pnpmCommand) {
  $pnpmCommand = Get-Command pnpm -ErrorAction Stop
}
$pnpmExe = $pnpmCommand.Source
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$archive = Join-Path ([System.IO.Path]::GetTempPath()) "zhiqiangl-admin-$stamp.tar.gz"
$remote = "$User@$HostName"

if (-not (Test-Path -LiteralPath $IdentityFile)) {
  throw "SSH private key not found: $IdentityFile"
}

Push-Location $repoRoot
try {
  Write-Host 'Building backend...'
  & $pnpmExe --filter '@zenith-admin/server' run build
  if ($LASTEXITCODE -ne 0) {
    throw 'Backend build failed.'
  }

  Write-Host 'Building frontend...'
  & $pnpmExe build
  if ($LASTEXITCODE -ne 0) {
    throw 'Frontend build failed.'
  }

  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }

  Write-Host 'Packing release...'
  $tarArgs = @(
    '--exclude', '.git',
    '--exclude', 'node_modules',
    '--exclude', 'apps/server/node_modules',
    '--exclude', '.env',
    '--exclude', '.env.development',
    '--exclude', 'apps/server/.env',
    '--exclude', '.runtime',
    '--exclude', 'apps/server/uploads',
    '--exclude', 'apps/server/server.out.log',
    '--exclude', 'apps/server/server.err.log',
    '-czf', $archive,
    '-C', $repoRoot,
    '.'
  )
  & tar @tarArgs
  if ($LASTEXITCODE -ne 0) {
    throw 'Release package failed.'
  }

  Write-Host 'Uploading release...'
  & scp -i $IdentityFile $archive "${remote}:/tmp/zhiqiangl-admin.tar.gz"
  if ($LASTEXITCODE -ne 0) {
    throw 'Upload failed.'
  }

  $remoteScript = @'
set -eu
APP_DIR="__REMOTE_APP_DIR__"
SERVICE="__SERVICE_NAME__"
RELEASE="__RELEASE__"
RELEASE_DIR="$APP_DIR/releases/$RELEASE"
mkdir -p "$RELEASE_DIR"
tar -xzf /tmp/zhiqiangl-admin.tar.gz -C "$RELEASE_DIR"
cp "$APP_DIR/current/apps/server/.env" "$RELEASE_DIR/apps/server/.env"
rm -rf "$RELEASE_DIR/apps/server/uploads"
ln -sfn "$APP_DIR/uploads" "$RELEASE_DIR/apps/server/uploads"
cd "$RELEASE_DIR"
SIMPLE_GIT_HOOKS_SKIP_INSTALL=1 pnpm install --prod --frozen-lockfile --ignore-scripts
ln -sfn "$RELEASE_DIR" "$APP_DIR/current"
systemctl restart "$SERVICE"
systemctl is-active "$SERVICE"
rm -f /tmp/zhiqiangl-admin.tar.gz
echo "deployed:$RELEASE"
'@
  $remoteScript = $remoteScript.
    Replace('__REMOTE_APP_DIR__', $RemoteAppDir).
    Replace('__SERVICE_NAME__', $ServiceName).
    Replace('__RELEASE__', $stamp)

  Write-Host 'Switching remote release...'
  $remoteScript = $remoteScript -replace "`r`n", "`n" -replace "`r", "`n"
  $remoteScript | & ssh -i $IdentityFile $remote 'bash -s'
  if ($LASTEXITCODE -ne 0) {
    throw 'Remote deploy failed.'
  }

  Write-Host 'Done: https://zhiqiangl.cn/'
}
finally {
  Pop-Location
  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
}
