import { getOrCreateSslCredentials } from '../src/utils/sslCert';
import fs from 'fs';
import path from 'path';

describe('HTTPS & SSL/TLS Credentials Tests', () => {
  const testCertDir = path.resolve(__dirname, '../temp_test_certs');

  afterAll(() => {
    if (fs.existsSync(testCertDir)) {
      fs.rmSync(testCertDir, { recursive: true, force: true });
    }
  });

  it('should generate valid self-signed certificate and private key when none exist', async () => {
    const creds = await getOrCreateSslCredentials(undefined, undefined, testCertDir);

    expect(creds.isSelfSigned).toBe(true);
    expect(creds.key).toBeDefined();
    expect(creds.cert).toBeDefined();

    const keyStr = creds.key.toString();
    const certStr = creds.cert.toString();

    expect(keyStr).toContain('PRIVATE KEY');
    expect(certStr).toContain('BEGIN CERTIFICATE');

    // Files should be persisted to testCertDir
    expect(fs.existsSync(path.join(testCertDir, 'server.key'))).toBe(true);
    expect(fs.existsSync(path.join(testCertDir, 'server.crt'))).toBe(true);
  });

  it('should reuse cached certificates from disk on subsequent calls', async () => {
    const credsFirst = await getOrCreateSslCredentials(undefined, undefined, testCertDir);
    const credsSecond = await getOrCreateSslCredentials(undefined, undefined, testCertDir);

    expect(credsFirst.key.toString()).toBe(credsSecond.key.toString());
    expect(credsFirst.cert.toString()).toBe(credsSecond.cert.toString());
  });
});
