$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$winswVersion = "2.12.0"
$nodeVersion = "23.11.1"

$winswUrl = "https://github.com/winsw/winsw/releases/download/v$winswVersion/WinSW-x64.exe"
$winswOutput = Join-Path $PSScriptRoot "multivideo-service.exe"

$nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
$nodeZip = Join-Path $PSScriptRoot "node.zip"
$nodeExtractDir = Join-Path $PSScriptRoot "node_temp"
$nodeDest = Join-Path $PSScriptRoot "node.exe"

$runtimeManifestPath = Join-Path $PSScriptRoot "runtime-manifest.json"

function Write-RuntimeManifest {
    $manifest = [ordered]@{
        winswVersion = $winswVersion
        nodeVersion = $nodeVersion
    }

    $manifest | ConvertTo-Json | Set-Content -Path $runtimeManifestPath -Encoding UTF8
}

function Get-RuntimeManifest {
    if (-not (Test-Path -LiteralPath $runtimeManifestPath)) {
        return $null
    }

    try {
        return Get-Content -LiteralPath $runtimeManifestPath -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Ensure-WinSW($manifest) {
    $winswIsCurrent =
        (Test-Path -LiteralPath $winswOutput) -and
        (
            $null -eq $manifest -or
            $manifest.winswVersion -eq $winswVersion
        )

    if ($winswIsCurrent) {
        Write-Host "WinSW v$winswVersion already available at $winswOutput"
        return
    }

    Write-Host "Downloading WinSW v$winswVersion from $winswUrl..."
    Invoke-WebRequest -Uri $winswUrl -OutFile $winswOutput
}

function Ensure-NodeRuntime($manifest) {
    $nodeIsCurrent =
        (Test-Path -LiteralPath $nodeDest) -and
        (
            $null -eq $manifest -or
            $manifest.nodeVersion -eq $nodeVersion
        )

    if ($nodeIsCurrent) {
        Write-Host "Node.js v$nodeVersion already available at $nodeDest"
        return
    }

    Write-Host "Downloading Node.js v$nodeVersion from $nodeUrl..."
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip

    Write-Host "Extracting Node.js..."
    if (Test-Path -LiteralPath $nodeExtractDir) {
        Remove-Item -LiteralPath $nodeExtractDir -Recurse -Force
    }

    Expand-Archive -Path $nodeZip -DestinationPath $nodeExtractDir

    $extractedExe = Get-ChildItem -LiteralPath $nodeExtractDir -Filter "node.exe" -Recurse | Select-Object -First 1
    if ($null -eq $extractedExe) {
        throw "Could not find node.exe in the extracted archive."
    }

    Copy-Item -LiteralPath $extractedExe.FullName -Destination $nodeDest -Force
    Write-Host "Successfully placed node.exe at $nodeDest"
}

try {
    $manifest = Get-RuntimeManifest
    Ensure-WinSW $manifest
    Ensure-NodeRuntime $manifest
    Write-RuntimeManifest
} finally {
    if (Test-Path -LiteralPath $nodeZip) {
        Remove-Item -LiteralPath $nodeZip -Force
    }

    if (Test-Path -LiteralPath $nodeExtractDir) {
        Remove-Item -LiteralPath $nodeExtractDir -Recurse -Force
    }
}

if (-not (Test-Path -LiteralPath $winswOutput)) {
    throw "WinSW download failed."
}

if (-not (Test-Path -LiteralPath $nodeDest)) {
    throw "Node.js runtime setup failed."
}

Write-Host "Installer runtime dependencies are ready."
