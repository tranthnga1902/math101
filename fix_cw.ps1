$c = Get-Content 'src\home.css' -Raw

# 1. curriculum-workspace: full-page frame like classroom-module
$c = $c -replace [regex]::Escape('.curriculum-workspace{margin-top:14px}'), '.curriculum-workspace{margin:-18px clamp(-28px,-2.2vw,-16px) -42px;min-height:calc(100vh - 58px);background:#f8fafc;display:flex;flex-direction:column}'

# 2. cw-shell: match clr-body grid (340px + fill, same padding/gap)
$c = $c -replace [regex]::Escape('.cw-shell{display:grid;grid-template-columns:330px minmax(0,1fr);gap:18px;align-items:start}'), '.cw-shell{display:grid;grid-template-columns:340px 1fr;gap:14px;flex:1;min-height:0;padding:16px 24px 24px;overflow:hidden}'

# 3. cw-tree: remove sticky/max-height so it fills grid cell height
$c = $c -replace [regex]::Escape('position:sticky;top:76px;max-height:calc(100vh - 96px);'), ''

# 4. cw-canvas: overflow auto so content scrolls inside fixed frame
$c = $c -replace [regex]::Escape('box-shadow:0 1px 3px rgba(0,0,0,.03)}.cw-tree-top'), '}.cw-tree-top'
$c = $c -replace 'min-width:0;box-shadow:0 1px 3px rgba\(0,0,0,\.03\)\}\.cw-canvas-header', 'min-height:0;overflow:auto}.cw-canvas-header'

Set-Content 'src\home.css' $c -NoNewline
Write-Host 'CSS updated OK'
