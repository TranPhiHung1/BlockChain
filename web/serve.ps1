# =============================================================================
#  serve.ps1 — Máy chủ tĩnh tối giản cho DLU Blockchain Lab
# -----------------------------------------------------------------------------
#  Dùng khi máy CHƯA cài Node.js hay Python. Chỉ cần Windows PowerShell.
#
#      Chạy:  powershell -ExecutionPolicy Bypass -File serve.ps1
#      Cổng :  http://localhost:8080  (đổi bằng tham số -Port)
#
#  Lưu ý: trang web cũng chạy được khi mở thẳng public\index.html bằng trình
#  duyệt; máy chủ này chỉ giúp môi trường giống lúc triển khai thật.
# =============================================================================
param(
  [int]$Port = 8080,
  [string]$Root = (Join-Path $PSScriptRoot 'public')
)

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
  $listener.Start()
} catch {
  Write-Host "Khong mo duoc cong $Port. Thu cong khac: -Port 8081" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  DLU Blockchain Lab dang chay tai  http://localhost:$Port/" -ForegroundColor Green
Write-Host "  Thu muc goc: $Root"
Write-Host "  Nhan Ctrl+C de dung." -ForegroundColor DarkGray
Write-Host ""

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $path = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
  if ($path -eq '/') { $path = '/index.html' }

  $file = Join-Path $Root ($path.TrimStart('/') -replace '/', '\')

  # Chan truy cap ra ngoai thu muc goc
  $fullRoot = [System.IO.Path]::GetFullPath($Root)
  $fullFile = [System.IO.Path]::GetFullPath($file)

  if ($fullFile.StartsWith($fullRoot) -and (Test-Path $fullFile -PathType Leaf)) {
    $ext = [System.IO.Path]::GetExtension($fullFile).ToLower()
    $type = $mime[$ext]
    if (-not $type) { $type = 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($fullFile)
    $context.Response.ContentType = $type
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    Write-Host ("  200  " + $path) -ForegroundColor DarkGray
  } else {
    $context.Response.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes('404 - Khong tim thay: ' + $path)
    $context.Response.OutputStream.Write($msg, 0, $msg.Length)
    Write-Host ("  404  " + $path) -ForegroundColor Yellow
  }
  $context.Response.OutputStream.Close()
}
