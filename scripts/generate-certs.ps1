# ==============================================================================
# API Sentinel - SSL/TLS Certificate Generator Script (PowerShell)
# ==============================================================================

$certDir = (Resolve-Path (Join-Path $PSScriptRoot "..\certs")).Path
if (-not $certDir) {
    $certDir = Join-Path $PSScriptRoot "..\certs"
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

$keyFile = Join-Path $certDir "server.key"
$certFile = Join-Path $certDir "server.crt"

Write-Host "[API Sentinel] Checking for SSL/TLS certificates in: $certDir" -ForegroundColor Cyan

if (Get-Command openssl -ErrorAction SilentlyContinue) {
    Write-Host "[API Sentinel] Generating certificates using OpenSSL..." -ForegroundColor Green
    & openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout $keyFile `
        -out $certFile `
        -subj "/C=US/ST=Security/L=Sentinel/O=API Sentinel/CN=localhost" `
        -addext "subjectAltName=DNS:localhost,DNS:api-sentinel-backend,IP:127.0.0.1"
} else {
    Write-Host "[API Sentinel] OpenSSL not found in PATH. Using Node.js generator..." -ForegroundColor Yellow
    $backendDir = Join-Path $PSScriptRoot "..\backend"
    Push-Location $backendDir
    $env:STORAGE_DIR = $certDir
    npx tsx -e "import path from 'path'; import { getOrCreateSslCredentials } from './src/utils/sslCert'; getOrCreateSslCredentials(undefined, undefined, process.env.STORAGE_DIR).then(() => console.log('SSL cert generated successfully!'));"
    Pop-Location
}

Write-Host "[API Sentinel] Key file:  $keyFile" -ForegroundColor Green
Write-Host "[API Sentinel] Cert file: $certFile" -ForegroundColor Green
