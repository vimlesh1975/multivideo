# Download WinSW
$winswUrl = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
$winswOutput = Join-Path $PSScriptRoot "multivideo-service.exe"

Write-Host "Downloading WinSW from $winswUrl..."
Invoke-WebRequest -Uri $winswUrl -OutFile $winswOutput

# Download Node.js v23.11.1
$nodeVersion = "23.11.1"
$nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
$nodeZip = Join-Path $PSScriptRoot "node.zip"
$nodeExtractDir = Join-Path $PSScriptRoot "node_temp"
$nodeDest = Join-Path $PSScriptRoot "node.exe"

Write-Host "Downloading Node.js v$nodeVersion from $nodeUrl..."
Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip

Write-Host "Extracting Node.js..."
if (Test-Path $nodeExtractDir) { Remove-Item -Recurse -Force $nodeExtractDir }
Expand-Archive -Path $nodeZip -DestinationPath $nodeExtractDir

$extractedExe = Get-ChildItem -Path $nodeExtractDir -Filter "node.exe" -Recurse | Select-Object -First 1
if ($extractedExe) {
    Copy-Item $extractedExe.FullName -Destination $nodeDest -Force
    Write-Host "Successfully placed node.exe at $nodeDest"
} else {
    Write-Error "Could not find node.exe in the extracted archive."
}

# Cleanup
Remove-Item $nodeZip -Force
Remove-Item -Recurse -Force $nodeExtractDir

if (Test-Path $winswOutput) {
    Write-Host "WinSW successfully downloaded to $winswOutput"
} else {
    Write-Error "WinSW download failed."
}
