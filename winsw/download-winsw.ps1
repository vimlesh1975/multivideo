$url = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
$output = Join-Path $PSScriptRoot "multivideo-service.exe"

Write-Host "Downloading WinSW from $url..."
Invoke-WebRequest -Uri $url -OutFile $output

if (Test-Path $output) {
    Write-Host "Successfully downloaded to $output"
} else {
    Write-Error "Download failed."
}
