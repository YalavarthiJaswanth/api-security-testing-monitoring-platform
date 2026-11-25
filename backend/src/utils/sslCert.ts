import fs from 'fs';
import path from 'path';
import { generate } from 'selfsigned';

export interface SslCredentials {
  key: string | Buffer;
  cert: string | Buffer;
  isSelfSigned: boolean;
}

/**
 * Ensures SSL certificate and key are available.
 * If external certs are specified in config and exist, loads them.
 * Otherwise, asynchronously generates a cryptographically valid self-signed cert and caches it to disk.
 */
export async function getOrCreateSslCredentials(
  keyPath?: string,
  certPath?: string,
  storageDir: string = path.resolve(__dirname, '../../certs')
): Promise<SslCredentials> {
  // 1. Check if custom certificate paths are provided and exist
  if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log(`[HTTPS] Loaded custom SSL certificates from: ${certPath}`);
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      isSelfSigned: false
    };
  }

  // 2. Ensure default cert directory exists
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const defaultKeyPath = path.join(storageDir, 'server.key');
  const defaultCertPath = path.join(storageDir, 'server.crt');

  if (fs.existsSync(defaultKeyPath) && fs.existsSync(defaultCertPath)) {
    console.log(`[HTTPS] Loaded existing cached SSL certificates from: ${storageDir}`);
    return {
      key: fs.readFileSync(defaultKeyPath),
      cert: fs.readFileSync(defaultCertPath),
      isSelfSigned: true
    };
  }

  // 3. Generate self-signed certificate using selfsigned package
  console.log('[HTTPS] Generating fresh self-signed SSL/TLS certificate for localhost...');
  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'organizationName', value: 'API Sentinel Security' },
    { shortName: 'OU', value: 'DevSecOps' }
  ];

  const now = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(now.getFullYear() + 1);

  const pems = await generate(attrs, {
    keySize: 2048,
    algorithm: 'sha256',
    notBeforeDate: now,
    notAfterDate: nextYear,
    extensions: [
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
        keyCertSign: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: 'api-sentinel-backend' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' }
        ]
      }
    ]
  });

  fs.writeFileSync(defaultKeyPath, pems.private, { mode: 0o600 });
  fs.writeFileSync(defaultCertPath, pems.cert, { mode: 0o644 });
  console.log(`[HTTPS] Generated and stored self-signed certificate at: ${storageDir}`);

  return {
    key: pems.private,
    cert: pems.cert,
    isSelfSigned: true
  };
}
