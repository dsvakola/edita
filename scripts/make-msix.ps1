# Makes the Microsoft Store package msix\Edita_<version>_x64.msix from the Tauri release build
# (src-tauri\target\release\Edita.exe). The package is NOT signed: the Store signs it on submission.
# Store identity values: installer\msix-identity.json. Run: pnpm run msix  (after pnpm run dist)
param([switch]$NoBuild)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$id = Get-Content (Join-Path $root 'installer\msix-identity.json') -Raw | ConvertFrom-Json
$exe = Join-Path $root 'src-tauri\target\release\Edita.exe'
if (-not $NoBuild -or -not (Test-Path $exe)) {
  Push-Location $root; try { pnpm exec tauri build --no-bundle; if ($LASTEXITCODE) { throw 'tauri build failed' } } finally { Pop-Location }
}

# Windows SDK tools (MakeAppx, MakePri).
$sdk = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin' -Directory -Filter '10.*' | Sort-Object Name | Select-Object -Last 1
$makeappx = Join-Path $sdk.FullName 'x64\makeappx.exe'
$makepri = Join-Path $sdk.FullName 'x64\makepri.exe'
if (-not (Test-Path $makeappx)) { throw 'MakeAppx.exe not found: install the Windows SDK (App Packaging Tools).' }

# Same list as FILE_TYPES in src-tauri\src\main.rs (Tools > Make Edita the Default Text Editor).
$types = 'txt','log','ini','md','ino','c','h','cpp','hpp','py','java','js','json','html','htm','css','php','rs','vb','asm','s'

$out = Join-Path $root 'msix'
$stage = Join-Path $out 'package'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force (Join-Path $stage 'Assets') | Out-Null
Copy-Item $exe $stage
Copy-Item (Join-Path $root 'LICENSE') (Join-Path $stage 'LICENSE.txt')
Copy-Item (Join-Path $root 'NOTICE') (Join-Path $stage 'NOTICE.txt')

# Tile and logo images, drawn from the app icon (assets\icon.png) at the sizes the Store needs.
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Image]::FromFile((Join-Path $root 'assets\icon.png'))
function Save-Logo([string]$name, [int]$w, [int]$h, [double]$fill = 1.0) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $s = [int]([Math]::Min($w, $h) * $fill)
  $g.DrawImage($icon, [int](($w - $s) / 2), [int](($h - $s) / 2), $s, $s)
  $g.Dispose(); $bmp.Save((Join-Path $stage "Assets\$name"), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
Save-Logo 'StoreLogo.png' 50 50
Save-Logo 'Square44x44Logo.png' 44 44
Save-Logo 'Square44x44Logo.targetsize-256.png' 256 256
Save-Logo 'Square44x44Logo.targetsize-48.png' 48 48
Save-Logo 'Square44x44Logo.targetsize-24.png' 24 24
Save-Logo 'Square44x44Logo.targetsize-16.png' 16 16
Save-Logo 'Square71x71Logo.png' 71 71 0.8
Save-Logo 'Square150x150Logo.png' 150 150 0.66
Save-Logo 'Square310x310Logo.png' 310 310 0.66
Save-Logo 'Wide310x150Logo.png' 310 150 0.8
$icon.Dispose()

$manifest = (Get-Content (Join-Path $root 'installer\AppxManifest.template.xml') -Raw).
  Replace('{{IDENTITY_NAME}}', $id.identityName).Replace('{{PUBLISHER}}', $id.publisher).
  Replace('{{PUBLISHER_DISPLAY_NAME}}', [System.Security.SecurityElement]::Escape($id.publisherDisplayName)).
  Replace('{{VERSION}}', "$version.0").
  Replace('{{FILE_TYPES}}', (($types | ForEach-Object { "              <uap:FileType>.$_</uap:FileType>" }) -join "`r`n"))
[System.IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'), $manifest, (New-Object System.Text.UTF8Encoding $false))

# resources.pri (lets Windows pick the right logo size).
Push-Location $stage
try {
  & $makepri createconfig /cf priconfig.xml /dq en-US /o | Out-Null
  & $makepri new /pr . /cf priconfig.xml /of resources.pri /o | Out-Null
  Remove-Item priconfig.xml
} finally { Pop-Location }

$msix = Join-Path $out "Edita_${version}_x64.msix"
& $makeappx pack /d $stage /p $msix /o | Out-Null
if ($LASTEXITCODE) { throw 'MakeAppx failed' }
if ($id.identityName -like 'PLACEHOLDER*' -or $id.publisher -like '*PLACEHOLDER*') {
  Write-Warning 'installer\msix-identity.json still has PLACEHOLDER values: copy them from Partner Center > Product identity before uploading to the Store.'
}
"Wrote $msix ($([Math]::Round((Get-Item $msix).Length / 1MB, 2)) MB)"
