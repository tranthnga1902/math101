$c = Get-Content 'src\home.css' -Raw

# Extract relevant class definitions to inspect
$matches = [regex]::Matches($c, '\.(clr-left|clr-right|cw-tree|cw-canvas)\{[^}]+\}')
foreach ($m in $matches) { Write-Host $m.Value.Substring(0, [Math]::Min(300, $m.Value.Length)); Write-Host "---" }
