# Draws the installer images (24-bit BMP, as NSIS needs) with Edita's logo, the Vidyasagar Academy
# logo (logo.png) and the developer credits: installer/sidebar.bmp (Welcome / Finish pages)
# and installer/header.bmp (other pages). Drawn at 2x; the installer shrinks them to fit sharply.
# Run: pnpm run art
param([string]$Version = (Get-Content (Join-Path $PSScriptRoot '..\package.json') -Raw | ConvertFrom-Json).version)
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$out = Join-Path $root 'installer'
New-Item -ItemType Directory -Force $out | Out-Null
$vra = [System.Drawing.Image]::FromFile((Join-Path $root 'logo.png'))
$edita = [System.Drawing.Image]::FromFile((Join-Path $root 'assets\icon.png'))
$bg = [System.Drawing.Color]::FromArgb(255, 30, 31, 28)
$white = [System.Drawing.Color]::White
$amber = [System.Drawing.Color]::FromArgb(255, 255, 176, 32)
$soft = [System.Drawing.Color]::FromArgb(255, 236, 236, 228)
$flags = [System.Windows.Forms.TextFormatFlags]
$centre = $flags::HorizontalCenter -bor $flags::NoPadding -bor $flags::SingleLine
$left = $flags::Left -bor $flags::NoPadding -bor $flags::SingleLine
$scale = 2

function Draw([int]$w, [int]$h, [scriptblock]$paint, [string]$file) {
  $bmp = New-Object System.Drawing.Bitmap ($w * $scale), ($h * $scale), ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($bg)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  & $paint $g
  $g.Dispose()
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $bmp.Dispose()
}
function Img($g, $img, [double]$x, [double]$y, [double]$size) {
  $g.DrawImage($img, [int]($x * $scale), [int]($y * $scale), [int]($size * $scale), [int]($size * $scale))
}
function Text($g, [string]$txt, [double]$px, $color, [double]$x, [double]$y, [double]$w, $f) {
  $fnt = New-Object System.Drawing.Font 'Segoe UI Semibold', ([float]($px * $scale)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $rect = New-Object System.Drawing.Rectangle ([int]($x * $scale)), ([int]($y * $scale)), ([int]($w * $scale)), ([int]($px * 1.6 * $scale))
  [System.Windows.Forms.TextRenderer]::DrawText($g, $txt, $fnt, $rect, $color, $bg, $f)
  $fnt.Dispose()
}

# Sidebar, 164x314.
Draw 164 314 {
  param($g)
  Img $g $edita 12 14 50
  Text $g 'Edita' 27 $white 68 12 96 $left
  Text $g "Version $Version" 12 $soft 70 46 94 $left
  Img $g $vra 27 78 110
  Text $g 'Developed by' 11 $soft 0 198 164 $centre
  Text $g 'Prof. Dattaraj S. Vidyasagar' 11 $white 0 214 164 $centre
  Text $g '& Prof. Yash D. Vidyasagar' 11 $white 0 230 164 $centre
  Text $g 'for Vidyasagar' 13 $amber 0 252 164 $centre
  Text $g 'Academy' 13 $amber 0 270 164 $centre
  Text $g 'vsa.edu.in/software' 11 $soft 0 292 164 $centre
} (Join-Path $out 'sidebar.bmp')

# Header (top-right of the other pages), 150x57.
Draw 150 57 {
  param($g)
  Img $g $vra 5 4 49
  Text $g 'Edita' 22 $white 59 3 90 $left
  Text $g "Version $Version" 12 $amber 60 33 90 $left
} (Join-Path $out 'header.bmp')
$vra.Dispose(); $edita.Dispose()
"Wrote installer/sidebar.bmp and installer/header.bmp"
