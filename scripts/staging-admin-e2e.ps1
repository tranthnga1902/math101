$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$config = @{}
Get-Content (Join-Path $projectRoot ".env.staging") | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line.Split("=", 2)
        if ($parts.Count -eq 2) { $config[$parts[0].Trim()] = $parts[1].Trim() }
    }
}

function ConfigValue([string] $Name) {
    $environmentValue = [Environment]::GetEnvironmentVariable($Name)
    if ($environmentValue) { return $environmentValue }
    return $config[$Name]
}

function Login([string] $Identifier, [string] $Password) {
    $json = @{ identifier = $Identifier; password = $Password } | ConvertTo-Json
    $body = [System.Text.Encoding]::UTF8.GetBytes($json)
    return (Invoke-RestMethod "http://localhost:8080/api/auth/login" `
        -Method Post -ContentType "application/json; charset=utf-8" -Body $body).data.accessToken
}

function Api([string] $Method, [string] $Path, [string] $Token, $Body = $null) {
    $arguments = @{
        Uri = "http://localhost:8080/api$Path"
        Method = $Method
        Headers = @{ Authorization = "Bearer $Token" }
    }
    if ($null -ne $Body) {
        $arguments.ContentType = "application/json; charset=utf-8"
        $json = $Body | ConvertTo-Json -Depth 8
        $arguments.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    return Invoke-RestMethod @arguments
}

function IsForbidden([scriptblock] $Request) {
    try {
        & $Request | Out-Null
        return $false
    } catch {
        return $_.Exception.Response.StatusCode.value__ -eq 403
    }
}

$adminUsername = ConfigValue "E2E_ADMIN_USERNAME"
$adminPassword = ConfigValue "E2E_ADMIN_PASSWORD"
if (-not $adminUsername -or -not $adminPassword) {
    throw "Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to a real staging Admin account before running this acceptance test."
}

$adminToken = Login $adminUsername $adminPassword
$teacherToken = Login (ConfigValue "E2E_TEACHER_USERNAME") (ConfigValue "E2E_TEACHER_PASSWORD")
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$ids = @{}

try {
    $dashboard = (Api "GET" "/admin/dashboard" $adminToken).data
    $usersBefore = (Api "GET" "/users?size=5" $adminToken).data
    $teacherForbidden = IsForbidden { Api "GET" "/admin/dashboard" $teacherToken }

    $user = (Api "POST" "/users" $adminToken @{
        username = "e2e.student.$stamp"
        email = "e2e.student.$stamp@example.invalid"
        fullName = "E2E Student $stamp"
        phone = $null
        roleCode = "STUDENT"
        status = "ACTIVE"
        password = "E2e-Strong-$stamp"
    }).data
    $ids.user = $user.id

    $updatedUser = (Api "PUT" "/users/$($user.id)" $adminToken @{
        username = $user.username
        email = $user.email
        fullName = "E2E Student Updated $stamp"
        phone = "0900000000"
        roleCode = "STUDENT"
        status = "ACTIVE"
        password = $null
    }).data
    Api "PATCH" "/users/$($user.id)/lock" $adminToken | Out-Null
    Api "PATCH" "/users/$($user.id)/activate" $adminToken | Out-Null

    $topic = (Api "POST" "/math/topics" $adminToken @{
        name = "E2E Topic $stamp"
        description = "Admin staging acceptance"
    }).data
    $ids.topic = $topic.id
    $updatedTopic = (Api "PUT" "/math/topics/$($topic.id)" $adminToken @{
        name = "E2E Topic Updated $stamp"
        description = "Updated by Admin E2E"
    }).data

    $audit = (Api "GET" "/audit-logs?size=100&sort=createdAt,desc" $adminToken).data
    $auditRows = @($audit.content)
    $userAudited = @($auditRows | Where-Object {
        $_.targetType -eq "USER" -and "$($_.targetId)" -eq "$($user.id)"
    }).Count -gt 0

    $result = [ordered] @{
        adminLogin = [bool] $adminToken
        dashboardLoaded = $null -ne $dashboard.totalUsers
        usersPageLoaded = $null -ne $usersBefore.content
        teacherDeniedAdminDashboard = $teacherForbidden
        userCreated = $user.username -eq "e2e.student.$stamp"
        userUpdated = $updatedUser.fullName -eq "E2E Student Updated $stamp"
        topicCreated = $topic.name -eq "E2E Topic $stamp"
        topicUpdated = $updatedTopic.name -eq "E2E Topic Updated $stamp"
        userAuditFound = $userAudited
    }
    $failed = @($result.GetEnumerator() | Where-Object { -not $_.Value })
    $result | ConvertTo-Json -Compress
    if ($failed.Count -gt 0) {
        throw "Admin E2E assertions failed: $($failed.Name -join ', ')"
    }
} finally {
    if ($ids.topic) {
        try { Api "DELETE" "/math/topics/$($ids.topic)" $adminToken | Out-Null } catch {}
    }
    if ($ids.user) {
        try { Api "DELETE" "/users/$($ids.user)" $adminToken | Out-Null } catch {}
    }
}
