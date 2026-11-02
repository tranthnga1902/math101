$c = Get-Content 'src\home.css' -Raw

# Fix clr-left: restore background + border, no radius
$c = $c -replace '\.clr-left\{-radius:0;display:flex;flex-direction:column;overflow:hidden\}', '.clr-left{background:#fff;border:1px solid #e2e8f0;border-radius:0;display:flex;flex-direction:column;overflow:hidden}'

# Fix clr-right: restore background + border, no radius
$c = $c -replace '\.clr-right\{-radius:0;display:flex;flex-direction:column;overflow:hidden\}', '.clr-right{background:#fff;border:1px solid #e2e8f0;border-radius:0;display:flex;flex-direction:column;overflow:hidden}'

# Fix cw-tree: restore background + border, no radius
$c = $c -replace '\.cw-tree\{-radius:0;overflow:hidden;display:flex;flex-direction:column;\}', '.cw-tree{background:#fff;border:1px solid #e2e8f0;border-radius:0;overflow:hidden;display:flex;flex-direction:column}'

# Fix cw-canvas (first occurrence): restore background + border, no radius
$c = $c -replace '\.cw-canvas\{-radius:0;padding:24px 28px;display:flex;flex-direction:column;gap:18px;min-height:0;overflow:auto\}', '.cw-canvas{background:#fff;border:1px solid #e2e8f0;border-radius:0;padding:24px 28px;display:flex;flex-direction:column;gap:18px;min-height:0;overflow:auto}'

Set-Content 'src\home.css' $c -NoNewline
Write-Host 'Panel CSS fixed'
