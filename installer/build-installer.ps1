param(
    [switch]$CleanOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $PSScriptRoot "Output"
$setupScript = Join-Path $PSScriptRoot "setup.iss"

function Find-Iscc {
    $candidates = @(
        (Join-Path $PSScriptRoot "tools\inno-setup\ISCC.exe"),
        (Get-Command "ISCC.exe" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
        "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        "C:\Program Files\Inno Setup 6\ISCC.exe"
    ) | Where-Object { $_ }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return $null
}

function Ensure-LocalInnoSetup {
    $localIscc = Join-Path $PSScriptRoot "tools\inno-setup\ISCC.exe"
    if (Test-Path -LiteralPath $localIscc) {
        return $localIscc
    }

    $setupScriptPath = Join-Path $PSScriptRoot "setup-inno.ps1"
    if (-not (Test-Path -LiteralPath $setupScriptPath)) {
        return $null
    }

    Write-Host "Preparing local Inno Setup toolchain..."
    $setupOutput = & powershell -ExecutionPolicy Bypass -File $setupScriptPath
    $resolvedIscc = $setupOutput | Select-Object -Last 1

    if ($resolvedIscc -and (Test-Path -LiteralPath $resolvedIscc)) {
        return $resolvedIscc
    }

    if (Test-Path -LiteralPath $localIscc) {
        return $localIscc
    }

    return $null
}

if (Test-Path -LiteralPath $outputDir) {
    Get-ChildItem -LiteralPath $outputDir -Force | Remove-Item -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Write-Host "Cleared old installer output from $outputDir"

if ($CleanOnly) {
    return
}

Push-Location $repoRoot
try {
    Write-Host "Preparing standalone build and installer runtime..."
    npm run service:prepare
} finally {
    Pop-Location
}

$isccPath = Find-Iscc
if ($null -eq $isccPath) {
    $isccPath = Ensure-LocalInnoSetup
}

if ($null -eq $isccPath) {
    throw "Could not find or prepare ISCC.exe. Rerun npm run installer:build after checking the local Inno Setup download step."
}

Write-Host "Compiling installer with $isccPath"
& $isccPath $setupScript
