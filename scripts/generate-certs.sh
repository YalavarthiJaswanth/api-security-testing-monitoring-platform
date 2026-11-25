#!/usr/bin/env bash
# ==============================================================================
# API Sentinel - SSL/TLS Certificate Generator Script
# Generates a self-signed RSA 2048-bit certificate for localhost / staging HTTPS
# ==============================================================================

set -e

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../certs" && pwd)"
mkdir -p "$CERT_DIR"

KEY_FILE="$CERT_DIR/server.key"
CERT_FILE="$CERT_DIR/server.crt"

echo "[API Sentinel] Generating SSL/TLS certificates in: $CERT_DIR"

if command -v openssl >/dev/null 2>&1; then
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/C=US/ST=Security/L=Sentinel/O=API Sentinel/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:api-sentinel-backend,IP:127.0.0.1"
  chmod 600 "$KEY_FILE"
  chmod 644 "$CERT_FILE"
  echo "[API Sentinel] Certificates generated successfully with OpenSSL!"
else
  echo "[API Sentinel] OpenSSL not found. Triggering Node.js certificate generator..."
  node -e "
    const path = require('path');
    const { getOrCreateSslCredentials } = require('./backend/dist/utils/sslCert.js');
    getOrCreateSslCredentials(undefined, undefined, '$CERT_DIR');
  "
fi

echo "[API Sentinel] Key file:  $KEY_FILE"
echo "[API Sentinel] Cert file: $CERT_FILE"
