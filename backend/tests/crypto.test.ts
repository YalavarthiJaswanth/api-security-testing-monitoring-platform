import { encryptCredentials, decryptCredentials } from '../src/utils/crypto';

describe('AES-256-GCM Credential Encryption', () => {
  it('should securely encrypt and decrypt sensitive API tokens', () => {
    const secretToken = 'ghp_live_super_secret_oauth_token_12345';
    const encrypted = encryptCredentials(secretToken);

    expect(encrypted).not.toEqual(secretToken);
    expect(encrypted.split(':')).toHaveLength(3); // iv:tag:ciphertext

    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toBe(secretToken);
  });

  it('should return empty string on invalid cipher format', () => {
    expect(decryptCredentials('invalid-cipher-string')).toBe('');
  });
});
