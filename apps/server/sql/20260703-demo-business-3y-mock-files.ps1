param(
  [string]$HostName = "127.0.0.1",
  [int]$Port = 3306,
  [string]$User = "root",
  [string]$Database = "zenith_admin",
  [string]$UploadRoot = "",
  [switch]$Overwrite
)

$ErrorActionPreference = 'Stop'

function New-MockPdfBytes {
  $stream = @(
    "BT"
    "/F1 18 Tf"
    "72 720 Td"
    "(SIM3Y Mock Archive File) Tj"
    "/F1 11 Tf"
    "0 -28 Td"
    "(Generated placeholder for local preview and download tests.) Tj"
    "0 -18 Td"
    "(The business data lives in MySQL; this PDF only backs archive file access.) Tj"
    "ET"
  ) -join "`n"

  $objects = @(
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length $([System.Text.Encoding]::ASCII.GetByteCount($stream)) >>`nstream`n$stream`nendstream"
  )

  $builder = [System.Text.StringBuilder]::new()
  [void]$builder.Append("%PDF-1.4`n")
  $offsets = New-Object System.Collections.Generic.List[int]

  for ($index = 0; $index -lt $objects.Count; $index += 1) {
    $offsets.Add([System.Text.Encoding]::ASCII.GetByteCount($builder.ToString()))
    [void]$builder.Append("$($index + 1) 0 obj`n")
    [void]$builder.Append($objects[$index])
    [void]$builder.Append("`nendobj`n")
  }

  $xrefOffset = [System.Text.Encoding]::ASCII.GetByteCount($builder.ToString())
  [void]$builder.Append("xref`n")
  [void]$builder.Append("0 6`n")
  [void]$builder.Append("0000000000 65535 f `n")
  foreach ($offset in $offsets) {
    [void]$builder.Append(("{0:D10} 00000 n `n" -f $offset))
  }
  [void]$builder.Append("trailer`n")
  [void]$builder.Append("<< /Size 6 /Root 1 0 R >>`n")
  [void]$builder.Append("startxref`n")
  [void]$builder.Append("$xrefOffset`n")
  [void]$builder.Append("%%EOF`n")

  return [System.Text.Encoding]::ASCII.GetBytes($builder.ToString())
}

function Resolve-UploadRoot {
  param([string]$InputPath)

  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) {
      [void](New-Item -ItemType Directory -Path $InputPath -Force)
    }
    return (Resolve-Path -LiteralPath $InputPath).Path
  }

  $sqlDir = Split-Path -Parent $PSCommandPath
  $serverDir = Split-Path -Parent $sqlDir
  $defaultUploadRoot = Join-Path $serverDir "uploads"
  if (-not (Test-Path -LiteralPath $defaultUploadRoot)) {
    [void](New-Item -ItemType Directory -Path $defaultUploadRoot -Force)
  }
  return (Resolve-Path -LiteralPath $defaultUploadRoot).Path
}

function Resolve-MockFilePath {
  param(
    [string]$RootPath,
    [string]$StorageKey
  )

  $normalized = $StorageKey.Replace('\', '/').Trim()
  if (-not $normalized.StartsWith('mock/')) {
    throw "只允许生成 mock/ 下的模拟附件文件：$StorageKey"
  }
  if ($normalized.StartsWith('/') -or $normalized.Contains('../') -or $normalized.Contains('/..')) {
    throw "附件存储路径不安全：$StorageKey"
  }

  $relativeParts = $normalized.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries)
  $path = $RootPath
  foreach ($part in $relativeParts) {
    $path = Join-Path $path $part
  }
  return $path
}

$mysql = Get-Command "mysql" -ErrorAction Stop
$uploadRootPath = Resolve-UploadRoot -InputPath $UploadRoot
$query = @"
SELECT storageKey
FROM archive_attachments
WHERE deleteTime IS NULL
  AND storageKey LIKE 'mock/%'
  AND (remark LIKE 'SIM3Y %' OR name LIKE 'SIM3Y-%')
ORDER BY id;
"@

$rows = & $mysql.Source `
  -h $HostName `
  -P $Port `
  -u $User `
  $Database `
  --default-character-set=utf8mb4 `
  --batch `
  --raw `
  --skip-column-names `
  -e $query

if ($LASTEXITCODE -ne 0) {
  throw "读取 SIM3Y 模拟附件记录失败"
}

$pdfBytes = New-MockPdfBytes
$created = 0
$skipped = 0
$seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

foreach ($row in $rows) {
  $storageKey = [string]$row
  if (-not $storageKey.Trim()) {
    continue
  }
  if (-not $seen.Add($storageKey)) {
    continue
  }

  $targetPath = Resolve-MockFilePath -RootPath $uploadRootPath -StorageKey $storageKey
  $targetDir = Split-Path -Parent $targetPath
  if (-not (Test-Path -LiteralPath $targetDir)) {
    [void](New-Item -ItemType Directory -Path $targetDir -Force)
  }

  if ((Test-Path -LiteralPath $targetPath) -and -not $Overwrite) {
    $skipped += 1
    continue
  }

  [System.IO.File]::WriteAllBytes($targetPath, $pdfBytes)
  $created += 1
}

Write-Host "SIM3Y mock archive files ready. created=$created skipped=$skipped root=$uploadRootPath"
