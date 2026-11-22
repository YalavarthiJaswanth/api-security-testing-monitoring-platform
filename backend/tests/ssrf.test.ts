import { validateTargetUrl } from '../src/utils/ssrf';

describe('SSRF Protection Utility', () => {
  it('should allow valid public HTTPS URLs', () => {
    const res = validateTargetUrl('https://api.github.com/users');
    expect(res.isValid).toBe(true);
    expect(res.normalizedUrl).toBe('https://api.github.com/users');
  });

  it('should block localhost and loopback addresses', () => {
    const res1 = validateTargetUrl('http://localhost:3000');
    expect(res1.isValid).toBe(false);

    const res2 = validateTargetUrl('http://127.0.0.1:8080/admin');
    expect(res2.isValid).toBe(false);
  });

  it('should block AWS / cloud metadata IP 169.254.169.254', () => {
    const res = validateTargetUrl('http://169.254.169.254/latest/meta-data/');
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('protected private/metadata ranges');
  });

  it('should block RFC1918 private address ranges', () => {
    expect(validateTargetUrl('http://10.0.0.1/status').isValid).toBe(false);
    expect(validateTargetUrl('http://192.168.1.1/router').isValid).toBe(false);
    expect(validateTargetUrl('http://172.16.0.5/api').isValid).toBe(false);
  });

  it('should permit local addresses when allowLocalLab option is enabled', () => {
    const res = validateTargetUrl('http://localhost:5050/lab', { allowLocalLab: true });
    expect(res.isValid).toBe(true);
  });
});
