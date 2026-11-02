$c = Get-Content 'src\home.css' -Raw
$patterns = @('cw-canvas-header\{[^}]+\}','cw-canvas-title-area\{[^}]+\}','cw-canvas-actions\{[^}]+\}','cw-canvas-body\{[^}]+\}')
foreach ($p in $patterns) {
  $m = [regex]::Match($c, $p)
  if ($m.Success) { Write-Host $m.Value.Substring(0,[Math]::Min(200,$m.Value.Length)) }
  else { Write-Host "NOT FOUND: $p" }
  Write-Host "---"
}
