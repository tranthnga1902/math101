$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env.staging"
$credentialFile = Join-Path $projectRoot ".admin-staging-credentials.txt"

if (-not (Test-Path $envFile)) {
    throw ".env.staging was not found"
}

$values = [ordered]@{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line.Split("=", 2)
        if ($parts.Count -eq 2) { $values[$parts[0].Trim()] = $parts[1].Trim() }
    }
}

if (-not $values["E2E_ADMIN_USERNAME"]) {
    $values["E2E_ADMIN_USERNAME"] = "admin.staging"
}
if (-not $values["E2E_ADMIN_EMAIL"]) {
    $values["E2E_ADMIN_EMAIL"] = "admin.staging@math10.vn"
}
if (-not $values["E2E_ADMIN_PASSWORD"]) {
    $random = [byte[]]::new(24)
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($random) } finally { $generator.Dispose() }
    $values["E2E_ADMIN_PASSWORD"] = [Convert]::ToBase64String($random).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

$originalLines = @(Get-Content $envFile)
$adminKeys = @("E2E_ADMIN_USERNAME", "E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD")
$kept = @($originalLines | Where-Object {
    $line = $_
    -not ($adminKeys | Where-Object { $line -match "^$([regex]::Escape($_))=" })
})
$newLines = @($kept) + @("") + @($adminKeys | ForEach-Object { "$_=$($values[$_])" })
[System.IO.File]::WriteAllLines($envFile, $newLines, [System.Text.UTF8Encoding]::new($false))

$credentialLines = @(
    "MATH10 Supabase staging Admin"
    "Username: $($values['E2E_ADMIN_USERNAME'])"
    "Email: $($values['E2E_ADMIN_EMAIL'])"
    "Password: $($values['E2E_ADMIN_PASSWORD'])"
)
[System.IO.File]::WriteAllLines($credentialFile, $credentialLines, [System.Text.UTF8Encoding]::new($false))

Write-Output "ADMIN_CONFIGURATION_READY"
Write-Output "Credentials saved to .admin-staging-credentials.txt"
