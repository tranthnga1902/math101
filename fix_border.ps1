$c = Get-Content 'src\home.css' -Raw

# Make right panel borders more visible
$c = $c -replace '\.clr-right\{background:#fff;border:1px solid #e2e8f0;', '.clr-right{background:#fff;border:1px solid #cbd5e1;'
$c = $c -replace '\.cw-canvas\{background:#fff;border:1px solid #e2e8f0;', '.cw-canvas{background:#fff;border:1px solid #cbd5e1;'

Set-Content 'src\home.css' $c -NoNewline
Write-Host 'Done'
