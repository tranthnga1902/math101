$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$config = @{}

Get-Content -LiteralPath (Join-Path $projectRoot ".env.staging") | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line.Split("=", 2)
        if ($parts.Count -eq 2) {
            $config[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

$loginBody = @{
    identifier = $config["E2E_TEACHER_USERNAME"]
    password = $config["E2E_TEACHER_PASSWORD"]
} | ConvertTo-Json
$login = Invoke-RestMethod "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
$topics = Invoke-RestMethod "http://localhost:8080/api/math/topics" -Headers $headers
if (-not $topics.data) { throw "Staging has no topic" }
$types = Invoke-RestMethod "http://localhost:8080/api/math/types?topicId=$($topics.data[0].id)" -Headers $headers
if (-not $types.data) { throw "Staging has no problem type" }
$typeId = $types.data[0].id
$created = [System.Collections.Generic.List[long]]::new()

function New-E2eProblem {
    param(
        [string] $Kind,
        [string] $Status,
        [string] $Suffix,
        [Nullable[long]] $Easier,
        [Nullable[long]] $Equivalent,
        [Nullable[long]] $Harder
    )
    $payload = @{
        problemTypeId = $typeId
        publicCode = "E2E-$Suffix-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
        statementLatex = '$x^2=4$'
        contentHtml = '<p>$x^2=4$</p>'
        difficulty = "REINFORCEMENT"
        status = $Status
        problemKind = $Kind
        easierProblemId = $Easier
        equivalentProblemId = $Equivalent
        harderProblemId = $Harder
    } | ConvertTo-Json
    $response = Invoke-RestMethod "http://localhost:8080/api/math/problems" -Method Post -Headers $headers -ContentType "application/json" -Body $payload
    $created.Add([long] $response.data.id)
    return $response.data
}

try {
    $easy = New-E2eProblem "PRACTICE" "PUBLISHED" "EASY"
    $same = New-E2eProblem "PRACTICE" "PUBLISHED" "SAME"
    $hard = New-E2eProblem "PRACTICE" "PUBLISHED" "HARD"
    $main = New-E2eProblem "PRACTICE" "PUBLISHED" "MAIN" $easy.id $same.id $hard.id
    $exam = New-E2eProblem "EXAM" "DRAFT" "EXAM"

    $hint = @{ problemId = $main.id; contentLatex = '$x=2$'; orderIndex = 1 } | ConvertTo-Json
    Invoke-RestMethod "http://localhost:8080/api/math/hints" -Method Post -Headers $headers -ContentType "application/json" -Body $hint | Out-Null
    $public = Invoke-RestMethod "http://localhost:8080/api/public/problems/$($main.qrSlug)"

    $examHintBlocked = $false
    try {
        $badHint = @{ problemId = $exam.id; contentLatex = "forbidden"; orderIndex = 1 } | ConvertTo-Json
        Invoke-RestMethod "http://localhost:8080/api/math/hints" -Method Post -Headers $headers -ContentType "application/json" -Body $badHint | Out-Null
    } catch {
        $examHintBlocked = $_.Exception.Response.StatusCode.value__ -eq 400
    }

    $examWorksheetBlocked = $false
    try {
        $badSheet = @{ name = "E2E invalid exam"; columnsCount = 1; showQr = $true; showStudentFields = $true; problemIds = @($exam.id) } | ConvertTo-Json
        Invoke-RestMethod "http://localhost:8080/api/worksheets" -Method Post -Headers $headers -ContentType "application/json" -Body $badSheet | Out-Null
    } catch {
        $examWorksheetBlocked = $_.Exception.Response.StatusCode.value__ -eq 400
    }

    [pscustomobject] @{
        teacherLogin = $true
        practiceQrLength = $main.qrSlug.Length
        examQrIsNull = $null -eq $exam.qrSlug
        manualSimilarCount = @($public.data.similar).Count
        manualRelations = (@($public.data.similar) | ForEach-Object { $_.relation }) -join ","
        publicHintCount = @($public.data.hints).Count
        examHintBlocked = $examHintBlocked
        examWorksheetBlocked = $examWorksheetBlocked
    } | ConvertTo-Json -Compress
} finally {
    foreach ($id in $created) {
        try {
            Invoke-RestMethod "http://localhost:8080/api/math/problems/$id" -Method Delete -Headers $headers | Out-Null
        } catch {
            Write-Warning "Could not clean E2E problem $id"
        }
    }
}
