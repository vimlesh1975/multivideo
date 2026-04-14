$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$innoVersion = "6.7.1"
$installerFileName = "innosetup-$innoVersion.exe"
$installerUrl = "https://github.com/jrsoftware/issrc/releases/download/is-6_7_1/$installerFileName"

$toolsDir = Join-Path $PSScriptRoot "tools"
$downloadsDir = Join-Path $toolsDir "downloads"
$innoDir = Join-Path $toolsDir "inno-setup"
$installerPath = Join-Path $downloadsDir $installerFileName
$manifestPath = Join-Path $innoDir "local-install-manifest.json"
$isccPath = Join-Path $innoDir "ISCC.exe"

function Get-Manifest {
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        return $null
    }

    try {
        return Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Write-Manifest {
    $manifest = [ordered]@{
        innoVersion = $innoVersion
        installerFile = $installerFileName
    }

    $manifest | ConvertTo-Json | Set-Content -Path $manifestPath -Encoding UTF8
}

if (-not (Test-Path -LiteralPath $downloadsDir)) {
    New-Item -ItemType Directory -Path $downloadsDir -Force | Out-Null
}

if (-not (Test-Path -LiteralPath $innoDir)) {
    New-Item -ItemType Directory -Path $innoDir -Force | Out-Null
}

$manifest = Get-Manifest
$localInstallIsCurrent =
    (Test-Path -LiteralPath $isccPath) -and
    (
        $null -eq $manifest -or
        $manifest.innoVersion -eq $innoVersion
    )

if ($localInstallIsCurrent) {
    Write-Host "Local Inno Setup v$innoVersion already available at $innoDir"
    Write-Host $isccPath
    return
}

if (-not (Test-Path -LiteralPath $installerPath)) {
    Write-Host "Downloading Inno Setup v$innoVersion from $installerUrl..."
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath
} else {
    Write-Host "Using cached Inno Setup installer at $installerPath"
}

Write-Host "Installing Inno Setup v$innoVersion locally into $innoDir..."
if (Test-Path -LiteralPath $innoDir) {
    Get-ChildItem -LiteralPath $innoDir -Force | Remove-Item -Recurse -Force
}

$installArguments = @(
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART",
    "/CURRENTUSER",
    "/PORTABLE=1",
    "/DIR=$innoDir"
)

$process = Start-Process -FilePath $installerPath -ArgumentList $installArguments -Wait -PassThru
if ($process.ExitCode -ne 0) {
    throw "Inno Setup local install failed with exit code $($process.ExitCode)."
}

if (-not (Test-Path -LiteralPath $isccPath)) {
    throw "Local Inno Setup install completed but ISCC.exe was not found at $isccPath."
}

Write-Manifest
Write-Host "Local Inno Setup is ready."
Write-Host $isccPath
