const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { requireBackend } = require('../helpers/project_loader.cjs');

const { validateTargetUrl } = requireBackend('utils/ssrf');
const { encryptCredentials, decryptCredentials } = requireBackend('utils/crypto');

describe('Backend SSRF Protection & AES-256-GCM Encryption Unit Tests', () => {
  it('validateTargetUrl: permits valid public HTTP and HTTPS API URLs', () => {
    const httpsRes = validateTargetUrl('https://api.github.com/users/octocat');
    assert.equal(httpsRes.isValid, true);
    assert.equal(httpsRes.normalizedUrl, 'https://api.github.com/users/octocat');

    const httpRes = validateTargetUrl('http://jsonplaceholder.typicode.com/posts');
    assert.equal(httpRes.isValid, true);
  });

  it('validateTargetUrl: rejects empty strings, invalid URLs, and non-HTTP protocols', () => {
    assert.equal(validateTargetUrl('').isValid, false);
    assert.equal(validateTargetUrl('not a url').isValid, false);
    assert.equal(validateTargetUrl('file:///etc/passwd').isValid, false);
    assert.equal(validateTargetUrl('ftp://files.example.com/secret').isValid, false);
  });

  it('validateTargetUrl: blocks loopback, RFC1918 private IPs, AWS metadata, and internal domains in real mode', () => {
    const blockedTargets = [
      'http://localhost:5001/health',
      'http://127.0.0.1:8000/scan',
      'http://0.0.0.0:3000',
      'http://10.0.0.1/internal',
      'http://172.16.0.10/admin',
      'http://172.31.255.254/metrics',
      'http://192.168.1.1/router',
      'http://169.254.169.254/latest/meta-data/',
      'http://auth.service.internal/token',
      'http://db.corp/dump'
    ];

    for (const url of blockedTargets) {
      const result = validateTargetUrl(url, { allowLocalLab: false });
      assert.equal(result.isValid, false, `Expected SSRF guard to block ${url}`);
    }
  });

  it('validateTargetUrl: permits local vulnerable lab URL only when allowLocalLab is enabled', () => {
    const blocked = validateTargetUrl('http://localhost:5050/api/v1/lab/users/1', { allowLocalLab: false });
    assert.equal(blocked.isValid, false);

    const allowed = validateTargetUrl('http://localhost:5050/api/v1/lab/users/1', { allowLocalLab: true });
    assert.equal(allowed.isValid, true);
  });

  it('AES-256-GCM crypto: encrypts credentials with unique random IVs and decrypts losslessly', () => {
    const secret = 'Bearer_sk_live_api_sentinel_99887766';
    const cipher1 = encryptCredentials(secret);
    const cipher2 = encryptCredentials(secret);

    assert.notEqual(cipher1, secret);
    assert.notEqual(cipher1, cipher2, 'Random IV must produce distinct ciphertexts');
    assert.equal(cipher1.split(':').length, 3);
    assert.equal(decryptCredentials(cipher1), secret);
    assert.equal(decryptCredentials(cipher2), secret);
  });

  it('AES-256-GCM crypto: rejects tampered auth tag/ciphertext and handles empty strings safely', () => {
    assert.equal(encryptCredentials(''), '');
    assert.equal(decryptCredentials(''), '');
    assert.equal(decryptCredentials('malformed'), '');

    const cipher = encryptCredentials('sensitive-secret');
    const parts = cipher.split(':');
    // Corrupt the authentication tag
    parts[1] = '00'.repeat(16);
    assert.equal(decryptCredentials(parts.join(':')), '');
  });
});
