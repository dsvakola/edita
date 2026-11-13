# Draws the Microsoft Store listing images from the app icon (assets\icon.png) into store-listing\logos.
# Run: pnpm run store-art
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$out = Join-Path $root 'store-listing\logos'
New-Item -ItemType Directory -Force $out | Out-Null
$icon = [System.Drawing.Image]::FromFile((Join-Path $root 'assets\icon.png'))
$vra = [System.Drawing.Image]::FromFile((Join-Path $root 'logo.png'))
$bg = [System.Drawing.Color]::FromArgb(255, 30, 31, 28)
$amber = [System.Drawing.Color]::FromArgb(255, 255, 176, 32)
$white = [System.Drawing.Color]::White

function New-Art([string]$name, [int]$w, [int]$h, [bool]$transparent, [scriptblock]$paint) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  if (-not $transparent) { $g.Clear($bg) }
  & $paint $g $w $h
  $g.Dispose(); $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  "$name ${w}x${h}"
}
function Centre($g, [string]$text, [string]$font, [float]$px, $color, [int]$w, [float]$y) {
  $f = New-Object System.Drawing.Font $font, $px, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'
  $g.DrawString($text, $f, (New-Object System.Drawing.SolidBrush $color), (New-Object System.Drawing.RectangleF 0, $y, $w, ($px * 1.5)), $sf)
  $f.Dispose()
}

# App icon / Store logo (1:1), transparent corners.
New-Art 'store-logo-300x300.png' 300 300 $true { param($g, $w, $h) $g.DrawImage($icon, 0, 0, $w, $h) }
# 1:1 box art (shown in Store search and collections).
New-Art 'box-art-1080x1080.png' 1080 1080 $false { param($g, $w, $h)
  $g.DrawImage($icon, 290, 170, 500, 500)
  Centre $g 'Edita' 'Segoe UI' 120 $white $w 700
  Centre $g 'Text & code editor' 'Segoe UI' 48 $amber $w 860 }
# 2:3 poster art (Windows Store hero image).
New-Art 'poster-art-720x1080.png' 720 1080 $false { param($g, $w, $h)
  $g.DrawImage($icon, 160, 200, 400, 400)
  Centre $g 'Edita' 'Segoe UI' 110 $white $w 640
  Centre $g 'Text & code editor' 'Segoe UI' 40 $amber $w 790
  $g.DrawImage($vra, 310, 900, 100, 100) }
$icon.Dispose(); $vra.Dispose()
