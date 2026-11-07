# 使用無頭 Chrome／Edge 執行 tests/test.html 並輸出測試結果。
# 使用方式：powershell -ExecutionPolicy Bypass -File tests\run-tests.ps1 [-Url <網址>]
#   未指定 -Url 時以 file:// 開啟本機檔案；指定線上網址可驗證部署後的網站（含 Service Worker）。
param([string]$Url)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
$browser = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw '找不到 Chrome 或 Edge。' }

$id = [guid]::NewGuid().ToString('N')
$profileDir = Join-Path $env:TEMP "todo-test-profile-$id"
$domFile = Join-Path $env:TEMP "todo-test-dom-$id.html"
$errFile = Join-Path $env:TEMP "todo-test-err-$id.txt"
if (-not $Url) { $Url = ([System.Uri](Join-Path $root 'tests\test.html')).AbsoluteUri }

$argsList = @('--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--allow-file-access-from-files', "--user-data-dir=$profileDir",
  '--virtual-time-budget=30000', '--window-size=1200,900', '--dump-dom', $Url)
Start-Process $browser -ArgumentList $argsList -RedirectStandardOutput $domFile `
  -RedirectStandardError $errFile -Wait -NoNewWindow | Out-Null

$html = Get-Content $domFile -Raw -Encoding UTF8
Remove-Item -Recurse -Force $profileDir, $domFile, $errFile -ErrorAction SilentlyContinue

$summary = [regex]::Match($html, '<pre id="summary">(.*?)</pre>').Groups[1].Value
[regex]::Matches($html, '<li class="(?:pass|fail)">(.*?)</li>') |
  ForEach-Object { [System.Net.WebUtility]::HtmlDecode($_.Groups[1].Value) }
Write-Output '---'
Write-Output $summary
if ($summary -notmatch 'failed=0') { exit 1 }
