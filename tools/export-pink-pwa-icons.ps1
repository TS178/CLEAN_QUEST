$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
$source = [System.Drawing.Bitmap]::FromFile((Join-Path $projectRoot 'assets/opening/logo.png'))
try {
    $safeFraction = 0.78 / [Math]::Sqrt(1 + [Math]::Pow($source.Height / $source.Width, 2))
    foreach ($spec in @(@('icon-192.png',192,0.94), @('icon-512.png',512,0.94), @('apple-touch-icon.png',180,0.86), @('icon-maskable-512.png',512,$safeFraction))) {
        $size = [int]$spec[1]
        $canvas = [System.Drawing.Bitmap]::new($size,$size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)
        try {
            $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#F9E3E3'))
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $scale = $size * [double]$spec[2] / [Math]::Max($source.Width,$source.Height)
            $width = [int][Math]::Round($source.Width*$scale)
            $height = [int][Math]::Round($source.Height*$scale)
            $rect = [System.Drawing.Rectangle]::new([int][Math]::Floor(($size-$width)/2),[int][Math]::Floor(($size-$height)/2),$width,$height)
            $graphics.DrawImage($source,$rect,0,0,$source.Width,$source.Height,[System.Drawing.GraphicsUnit]::Pixel)
            $canvas.Save((Join-Path $projectRoot ('icons/'+$spec[0])),[System.Drawing.Imaging.ImageFormat]::Png)
            Write-Output ($spec[0] + ' : ' + $size + 'px / #F9E3E3')
        } finally { $graphics.Dispose(); $canvas.Dispose() }
    }
} finally { $source.Dispose() }
