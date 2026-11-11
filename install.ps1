# One-command Windows install. No administrator rights or preinstalled Node needed.
param([string]$InstallDir = (Join-Path $env:USERPROFILE 'Konnectivity'))
$ErrorActionPreference = 'Stop'
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (Test-Path $InstallDir) {
  if (!(Test-Path (Join-Path $InstallDir 'start.bat'))) { throw 'Destination already exists and is not a Konnectivity installation.' }
  Write-Host 'Starting existing installation; personal data is unchanged.'
} else {
  $stage = Join-Path ([IO.Path]::GetTempPath()) ('konnectivity-' + [Guid]::NewGuid().ToString('N'))
  [IO.Directory]::CreateDirectory($stage) | Out-Null
  try {
    $archive = Join-Path $stage 'source.zip'
    $client = New-Object Net.WebClient
    try { $client.DownloadFile('https://github.com/shivam-aggarwal-git/Konnectivity/archive/refs/heads/10.05.zip', $archive) } finally { $client.Dispose() }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($archive, (Join-Path $stage 'source'))
    $source = Join-Path $stage 'source\Konnectivity-10.05'
    if (!(Test-Path (Join-Path $source 'start.bat'))) { throw 'Invalid source archive.' }
    [IO.Directory]::CreateDirectory((Split-Path -Parent $InstallDir)) | Out-Null
    Copy-Item -LiteralPath $source -Destination $InstallDir -Recurse
  } finally { if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force } }
}
Set-Location -LiteralPath $InstallDir
& (Join-Path $InstallDir 'start.bat') --local
