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

function Login([string] $Identifier, [string] $Password) {
    $body = @{ identifier = $Identifier; password = $Password } | ConvertTo-Json
    return (Invoke-RestMethod "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body $body).data.accessToken
}
function Api([string] $Method, [string] $Path, $Token, $Body = $null) {
    $arguments = @{ Uri = "http://localhost:8080/api$Path"; Method = $Method; Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $Body) {
        $arguments.ContentType = "application/json; charset=utf-8"
        $json = $Body | ConvertTo-Json -Depth 8
        $arguments.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    return Invoke-RestMethod @arguments
}

$teacherToken = Login $config["E2E_TEACHER_USERNAME"] $config["E2E_TEACHER_PASSWORD"]
$studentToken = Login $config["E2E_STUDENT_USERNAME"] $config["E2E_STUDENT_PASSWORD"]
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$ids = @{}

try {
    $grades = Api "GET" "/grades" $teacherToken
    if (-not $grades.data) { throw "Staging has no grade" }
    $students = Api "GET" "/users/students?search=$([uri]::EscapeDataString($config['E2E_STUDENT_USERNAME']))" $teacherToken
    $student = @($students.data.content)[0]
    if (-not $student) { throw "Seeded Student not found" }

    $course = (Api "POST" "/courses" $teacherToken @{
        code = "E2E-C-$stamp"; name = "E2E Course $stamp"; description = "Full staging acceptance"; status = "PUBLISHED"
    }).data
    $ids.course = $course.id
    $chapter = (Api "POST" "/chapters" $teacherToken @{
        courseId = $course.id; title = "E2E Chapter"; orderIndex = 1; status = "PUBLISHED"
    }).data
    $ids.chapter = $chapter.id
    $lesson = (Api "POST" "/lessons" $teacherToken @{
        chapterId = $chapter.id; title = "E2E Lesson"; publicCode = "E2E-L-$stamp"; summary = "Nội dung E2E"
        contentHtml = "<p>Nội dung <strong>E2E</strong> với `$x^2=4`$</p>"; orderIndex = 1; status = "PUBLISHED"
    }).data
    $ids.lesson = $lesson.id

    $classroom = (Api "POST" "/classes" $teacherToken @{
        code = "E2E-CL-$stamp"; name = "E2E Class $stamp"; gradeId = $grades.data[0].id; status = "ACTIVE"
    }).data
    $ids.class = $classroom.id
    Api "POST" "/enrollments/class-students" $teacherToken @{ classId = $classroom.id; userId = $student.id } | Out-Null
    Api "POST" "/enrollments/class-courses" $teacherToken @{ classId = $classroom.id; courseId = $course.id } | Out-Null

    $topics = Api "GET" "/math/topics" $teacherToken
    $types = Api "GET" "/math/types?topicId=$($topics.data[0].id)" $teacherToken
    $problem = (Api "POST" "/math/problems" $teacherToken @{
        problemTypeId = $types.data[0].id; publicCode = "E2E-P-$stamp"; statementLatex = '$x^2=4$'
        contentHtml = '<p>$x^2=4$</p>'; difficulty = "REINFORCEMENT"; status = "PUBLISHED"; problemKind = "PRACTICE"
        easierProblemId = $null; equivalentProblemId = $null; harderProblemId = $null
    }).data
    $ids.problem = $problem.id
    $worksheet = (Api "POST" "/worksheets" $teacherToken @{
        name = "E2E Worksheet $stamp"; columnsCount = 1; showQr = $true; showStudentFields = $true; problemIds = @($problem.id)
    }).data
    $ids.worksheet = $worksheet.id
    $attached = (Api "PATCH" "/worksheets/$($worksheet.id)/lesson" $teacherToken @{ lessonId = $lesson.id }).data

    $assignment = (Api "POST" "/assignments" $teacherToken @{
        classId = $classroom.id; lessonId = $null; worksheetId = $worksheet.id; title = "E2E Assignment $stamp"
        dueAt = $null; status = "PUBLISHED"
    }).data
    $ids.assignment = $assignment.id

    $studentCourses = Api "GET" "/student/courses" $studentToken
    $studentAssignments = Api "GET" "/student/assignments" $studentToken
    $assigned = @($studentAssignments.data | Where-Object { $_.id -eq $assignment.id })[0]
    $courseView = @($studentCourses.data | Where-Object { $_.id -eq $course.id })[0]
    $lessonView = $courseView.chapters[0].lessons[0]

    $before = Api "GET" "/teacher/gradebook?classId=$($classroom.id)" $teacherToken
    Api "PATCH" "/assignment-progress/$($assignment.id)/opened" $studentToken | Out-Null
    $during = Api "GET" "/teacher/gradebook?classId=$($classroom.id)" $teacherToken
    Api "PATCH" "/assignment-progress/$($assignment.id)/completed" $studentToken | Out-Null
    $after = Api "GET" "/teacher/gradebook?classId=$($classroom.id)" $teacherToken
    $unifiedProgress = Api "GET" "/progress?studentId=$($student.id)" $studentToken

    Api "PATCH" "/problem-progress/$($problem.id)/opened" $studentToken | Out-Null
    $problemDone = (Api "PATCH" "/problem-progress/$($problem.id)/completed" $studentToken).data

    [pscustomobject] @{
        teacherLogin = [bool] $teacherToken
        studentLogin = [bool] $studentToken
        teacherCreatedAndOwnsClass = @((Api "GET" "/teacher/classes" $teacherToken).data | Where-Object { $_.id -eq $classroom.id }).Count -eq 1
        studentSeesCourse = $null -ne $courseView
        lessonContentHtml = [bool] $lessonView.contentHtml
        attachedWorksheetVisible = @($lessonView.worksheets | Where-Object { $_.id -eq $worksheet.id }).Count -eq 1
        studentSeesAssignment = $null -ne $assigned
        gradebookBefore = @($before.data)[0].status
        gradebookDuring = @($during.data)[0].status
        gradebookAfter = @($after.data)[0].status
        unifiedWorksheetProgress = @($unifiedProgress.data | Where-Object { $_.worksheetId -eq $worksheet.id -and $_.status -eq "COMPLETED" }).Count -eq 1
        publicProblemProgress = $problemDone.status
        worksheetAttachedLessonId = $attached.lessonId
    } | ConvertTo-Json -Compress
} finally {
    if ($ids.assignment) { try { Api "DELETE" "/assignments/$($ids.assignment)" $teacherToken | Out-Null } catch {} }
    if ($ids.worksheet) { try { Api "DELETE" "/worksheets/$($ids.worksheet)" $teacherToken | Out-Null } catch {} }
    if ($ids.problem) { try { Api "DELETE" "/math/problems/$($ids.problem)" $teacherToken | Out-Null } catch {} }
    if ($ids.lesson) { try { Api "DELETE" "/lessons/$($ids.lesson)" $teacherToken | Out-Null } catch {} }
    if ($ids.chapter) { try { Api "DELETE" "/chapters/$($ids.chapter)" $teacherToken | Out-Null } catch {} }
    if ($ids.course) { try { Api "DELETE" "/courses/$($ids.course)" $teacherToken | Out-Null } catch {} }
    if ($ids.class) { try { Api "DELETE" "/classes/$($ids.class)" $teacherToken | Out-Null } catch {} }
}
