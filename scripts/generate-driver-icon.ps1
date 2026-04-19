$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-RoundRectPath {
    param(
        [float]$x,
        [float]$y,
        [float]$w,
        [float]$h,
        [float]$r
    )

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function Draw-Taxi {
    param(
        [System.Drawing.Graphics]$g,
        [float]$cx,
        [float]$cy,
        [float]$scale,
        [System.Drawing.Color]$orange,
        [System.Drawing.Color]$dark,
        [System.Drawing.Color]$white
    )

    $state = $g.Save()
    try {
        $g.TranslateTransform($cx, $cy)
        $g.ScaleTransform($scale, $scale)

        $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
        $shadowBody = New-RoundRectPath -188 -18 376 176 52
        $m1 = New-Object System.Drawing.Drawing2D.Matrix
        $m1.Translate(8, 9)
        $shadowBody.Transform($m1)
        $g.FillPath($shadowBrush, $shadowBody)
        $m1.Dispose()
        $shadowBody.Dispose()

        $shadowRoof = New-RoundRectPath -124 -148 248 116 44
        $m2 = New-Object System.Drawing.Drawing2D.Matrix
        $m2.Translate(8, 9)
        $shadowRoof.Transform($m2)
        $g.FillPath($shadowBrush, $shadowRoof)
        $m2.Dispose()
        $shadowRoof.Dispose()
        $shadowBrush.Dispose()

        $bodyPath = New-RoundRectPath -188 -24 376 176 52
        $bodyBrush = New-Object System.Drawing.SolidBrush($orange)
        $g.FillPath($bodyBrush, $bodyPath)
        $bodyBrush.Dispose()

        $bodyPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(175, 255, 255, 255), 5)
        $bodyPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawPath($bodyPen, $bodyPath)
        $bodyPen.Dispose()
        $bodyPath.Dispose()

        $roofPath = New-RoundRectPath -124 -152 248 116 44
        $roofBrush = New-Object System.Drawing.SolidBrush($orange)
        $g.FillPath($roofBrush, $roofPath)
        $roofBrush.Dispose()

        $roofPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(175, 255, 255, 255), 5)
        $roofPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawPath($roofPen, $roofPath)
        $roofPen.Dispose()
        $roofPath.Dispose()

        $windowPath = New-RoundRectPath -96 -124 192 68 24
        $windowBrush = New-Object System.Drawing.SolidBrush($dark)
        $g.FillPath($windowBrush, $windowPath)
        $windowBrush.Dispose()
        $windowPath.Dispose()

        $mirrorBrush = New-Object System.Drawing.SolidBrush($white)
        $g.FillRectangle($mirrorBrush, -218, -16, 30, 56)
        $g.FillRectangle($mirrorBrush, 188, -16, 30, 56)
        $mirrorBrush.Dispose()

        $grillPath = New-RoundRectPath -76 56 152 38 16
        $grillBrush = New-Object System.Drawing.SolidBrush($dark)
        $g.FillPath($grillBrush, $grillPath)
        $grillBrush.Dispose()
        $grillPath.Dispose()

        $lightBrush = New-Object System.Drawing.SolidBrush($white)
        $g.FillEllipse($lightBrush, -140, 58, 48, 24)
        $g.FillEllipse($lightBrush, 92, 58, 48, 24)
        $lightBrush.Dispose()

        $wheelBrush = New-Object System.Drawing.SolidBrush($dark)
        $g.FillEllipse($wheelBrush, -146, 108, 82, 82)
        $g.FillEllipse($wheelBrush, 64, 108, 82, 82)
        $wheelBrush.Dispose()
    }
    finally {
        $g.Restore($state)
    }
}

function Draw-Label {
    param(
        [System.Drawing.Graphics]$g,
        [float]$cx,
        [float]$top,
        [float]$scale,
        [System.Drawing.Color]$orange,
        [System.Drawing.Color]$white
    )

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Near

    [float]$cxf = $cx
    [float]$topf = $top
    [float]$scalef = $scale

    $driveFont = New-Object System.Drawing.Font('Segoe UI', [float](54 * $scalef), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $numFont = New-Object System.Drawing.Font('Segoe UI', [float](220 * $scalef), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

    $driveRect = [System.Drawing.RectangleF]::new(
        [float]($cxf - (300 * $scalef)),
        [float]$topf,
        [float](600 * $scalef),
        [float](88 * $scalef)
    )
    $numRect = [System.Drawing.RectangleF]::new(
        [float]($cxf - (390 * $scalef)),
        [float]($topf + (56 * $scalef)),
        [float](780 * $scalef),
        [float](250 * $scalef)
    )

    $whiteBrush = New-Object System.Drawing.SolidBrush($white)
    $orangeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(215, $orange.R, $orange.G, $orange.B))

    $g.DrawString('drive', $driveFont, $whiteBrush, $driveRect, $sf)

    $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(235, $orange.R, $orange.G, $orange.B), [float](9 * $scalef))
    $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $lineY = [float]($topf + (61 * $scalef))
    $g.DrawLine(
        $linePen,
        [float]($cxf - (102 * $scalef)),
        $lineY,
        [float]($cxf + (102 * $scalef)),
        $lineY
    )
    $linePen.Dispose()

    $offsets = @(
        @(-4, -4), @(0, -4), @(4, -4),
        @(-4,  0),           @(4,  0),
        @(-4,  4), @(0,  4), @(4,  4)
    )

    foreach ($o in $offsets) {
        $r = [System.Drawing.RectangleF]::new(
            [float]($numRect.X + ($o[0] * $scalef)),
            [float]($numRect.Y + ($o[1] * $scalef)),
            [float]$numRect.Width,
            [float]$numRect.Height
        )
        $g.DrawString('944', $numFont, $orangeBrush, $r, $sf)
    }

    $g.DrawString('944', $numFont, $whiteBrush, $numRect, $sf)

    $whiteBrush.Dispose()
    $orangeBrush.Dispose()
    $driveFont.Dispose()
    $numFont.Dispose()
    $sf.Dispose()
}

$orange = [System.Drawing.Color]::FromArgb(255, 242, 145, 29)
$dark = [System.Drawing.Color]::FromArgb(255, 46, 47, 53)
$darkDeep = [System.Drawing.Color]::FromArgb(255, 26, 27, 31)
$white = [System.Drawing.Color]::FromArgb(255, 248, 249, 251)

$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptsDir
$assetsDir = Join-Path $projectDir 'assets'

$iconPath = Join-Path $assetsDir 'icon.png'
$adaptivePath = Join-Path $assetsDir 'adaptive-icon.png'
$size = 1024

$icon = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($icon)
try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $bgRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, $dark, $darkDeep, 135)
    $g.FillRectangle($bgBrush, $bgRect)
    $bgBrush.Dispose()

    $panelPath = New-RoundRectPath 80 80 864 864 200
    $panelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 58, 60, 66))
    $g.FillPath($panelBrush, $panelPath)
    $panelBrush.Dispose()

    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse(156, 130, 712, 712)
    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
    $glowBrush.CenterPoint = New-Object System.Drawing.PointF(512, 420)
    $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(88, $orange.R, $orange.G, $orange.B)
    $glowBrush.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(0, $orange.R, $orange.G, $orange.B))
    $g.FillPath($glowBrush, $glowPath)
    $glowBrush.Dispose()
    $glowPath.Dispose()

    $borderOrange = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, $orange.R, $orange.G, $orange.B), 10)
    $borderOrange.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($borderOrange, $panelPath)
    $borderOrange.Dispose()

    $borderWhite = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 255, 255, 255), 4)
    $borderWhite.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($borderWhite, $panelPath)
    $borderWhite.Dispose()
    $panelPath.Dispose()

    Draw-Taxi -g $g -cx 512 -cy 362 -scale 1.02 -orange $orange -dark $darkDeep -white $white
    Draw-Label -g $g -cx 512 -top 560 -scale 1.0 -orange $orange -white $white
}
finally {
    $g.Dispose()
}
$icon.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$icon.Dispose()

$adaptive = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ga = [System.Drawing.Graphics]::FromImage($adaptive)
try {
    $ga.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $ga.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $ga.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $ga.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $ga.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $ga.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

    $discPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $discPath.AddEllipse(120, 120, 784, 784)

    $discBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 58, 60, 66))
    $ga.FillPath($discBrush, $discPath)
    $discBrush.Dispose()

    $discBorderO = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, $orange.R, $orange.G, $orange.B), 10)
    $ga.DrawPath($discBorderO, $discPath)
    $discBorderO.Dispose()

    $discBorderW = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 255, 255, 255), 4)
    $ga.DrawPath($discBorderW, $discPath)
    $discBorderW.Dispose()
    $discPath.Dispose()

    Draw-Taxi -g $ga -cx 512 -cy 390 -scale 0.90 -orange $orange -dark $darkDeep -white $white
    Draw-Label -g $ga -cx 512 -top 575 -scale 0.84 -orange $orange -white $white
}
finally {
    $ga.Dispose()
}
$adaptive.Save($adaptivePath, [System.Drawing.Imaging.ImageFormat]::Png)
$adaptive.Dispose()
