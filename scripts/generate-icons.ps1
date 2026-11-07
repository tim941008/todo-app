# 產生 PWA 圖示（PNG）。使用方式：powershell -ExecutionPolicy Bypass -File scripts\generate-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$outDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Icon([int]$size, [string]$file, [bool]$fullBleed, [double]$markScale) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
  $c1 = [System.Drawing.Color]::FromArgb(255, 99, 102, 241)   # 靛藍
  $c2 = [System.Drawing.Color]::FromArgb(255, 192, 132, 252)  # 紫色
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45

  if ($fullBleed) {
    $g.FillRectangle($brush, $rect)
  } else {
    # 圓角方形
    $r = $size * 0.22; $d = $r * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($size - $d, 0, $d, $d, 270, 90)
    $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $path.AddArc(0, $size - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)
  }

  # 白色勾號
  $s = $size * $markScale
  $o = ($size - $s) / 2
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ($s * 0.13)
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
  $pts = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF ($o + $s * 0.18), ($o + $s * 0.53)),
    (New-Object System.Drawing.PointF ($o + $s * 0.42), ($o + $s * 0.76)),
    (New-Object System.Drawing.PointF ($o + $s * 0.84), ($o + $s * 0.28))
  )
  $g.DrawLines($pen, $pts)

  $bmp.Save((Join-Path $outDir $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "已產生 $file"
}

New-Icon 192 'icon-192.png' $false 0.8
New-Icon 512 'icon-512.png' $false 0.8
New-Icon 512 'icon-maskable-512.png' $true 0.6   # 可遮罩圖示：勾號位於安全區域內
New-Icon 180 'apple-touch-icon.png' $true 0.7
