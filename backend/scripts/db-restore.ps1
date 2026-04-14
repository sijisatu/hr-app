param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

function Get-PostgresBin {
  $candidates = @(
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\15\bin"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate "pg_restore.exe")) {
      return $candidate
    }
  }

  throw "pg_restore.exe not found. Install PostgreSQL client tools or update the script candidates."
}

function Get-EnvValue {
  param(
    [string]$FilePath,
    [string]$Key
  )

  if (-not (Test-Path $FilePath)) {
    return $null
  }

  $line = Get-Content $FilePath | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return ($line -replace "^$Key=", "").Trim().Trim('"')
}

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $DatabaseUrl = Get-EnvValue -FilePath (Join-Path (Get-Location) ".env") -Key "DATABASE_URL"
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "DATABASE_URL is required."
}

$uri = [System.Uri]$DatabaseUrl
$userInfo = $uri.UserInfo.Split(":", 2)
$username = $userInfo[0]
$password = if ($userInfo.Length -gt 1) { $userInfo[1] } else { "" }
$database = $uri.AbsolutePath.TrimStart("/")
$hostName = $uri.Host
$port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }

$pgRestore = Join-Path (Get-PostgresBin) "pg_restore.exe"
$env:PGPASSWORD = $password
& $pgRestore --clean --if-exists --no-owner --no-privileges --host=$hostName --port=$port --username=$username --dbname=$database $BackupFile
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

Write-Output "Restore completed for $database"
