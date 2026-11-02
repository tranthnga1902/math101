$c = Get-Content 'src\home.css' -Raw

# 1. cw-canvas-header: change from row to column layout
$c = $c -replace [regex]::Escape('.cw-canvas-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:14px;border-bottom:1px solid #f1f5f9}'), '.cw-canvas-header{display:flex;flex-direction:column;gap:0;padding-bottom:0;border-bottom:0}'

# 2. cw-canvas-title-area: full width, keep column, add border-bottom separator
$c = $c -replace [regex]::Escape('.cw-canvas-title-area{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}'), '.cw-canvas-title-area{width:100%;display:flex;flex-direction:column;gap:6px;padding-bottom:14px;border-bottom:1px solid #e2e8f0}'

# 3. cw-canvas-actions: full-width row, add border-bottom
$c = $c -replace [regex]::Escape('.cw-canvas-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;white-space:nowrap}'), '.cw-canvas-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #f1f5f9}'

# 4. cw-canvas-body: add card border + padding
$c = $c -replace [regex]::Escape('.cw-canvas-body{display:flex;flex-direction:column;gap:16px}'), '.cw-canvas-body{display:flex;flex-direction:column;gap:14px;border:1px solid #e2e8f0;padding:16px;flex:1;min-height:0;overflow:auto}'

Set-Content 'src\home.css' $c -NoNewline
Write-Host 'Layout updated'
