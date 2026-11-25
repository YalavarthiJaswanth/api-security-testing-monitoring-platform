import { webhookService } from '../src/services/webhookService';

describe('Webhook System & HMAC Signature Tests', () => {
  it('should generate a secure HMAC-SHA256 signature for payload verification', () => {
    const payload = JSON.stringify({ event: 'scan.completed', id: 'scan_123', findings: 5 });
    const secret = 'whsec_test_secret_key_abcdef123456';

    const sig1 = webhookService.generateSignature(payload, secret);
    const sig2 = webhookService.generateSignature(payload, secret);

    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64); // 256 bits = 64 hex characters

    // Changing payload must change signature
    const alteredPayload = JSON.stringify({ event: 'scan.completed', id: 'scan_123', findings: 6 });
    const sigAltered = webhookService.generateSignature(alteredPayload, secret);
    expect(sig1).not.toBe(sigAltered);
  });

  it('should generate random unique webhook secrets with whsec_ prefix', () => {
    const secret1 = webhookService.generateSecret();
    const secret2 = webhookService.generateSecret();

    expect(secret1.startsWith('whsec_')).toBe(true);
    expect(secret2.startsWith('whsec_')).toBe(true);
    expect(secret1).not.toBe(secret2);
  });

  it('should prevent SSRF attacks when dispatching webhooks', async () => {
    const mockWebhook: any = {
      _id: 'mock_wh_1',
      name: 'Malicious Cloud Metadata Webhook',
      url: 'http://169.254.169.254/latest/meta-data/',
      secret: 'whsec_secret',
      customHeaders: {},
      save: jest.fn().mockResolvedValue(true)
    };

    const res = await webhookService.deliverToWebhook(mockWebhook, 'scan.completed', { test: true });
    expect(res.success).toBe(false);
    expect(res.error).toContain('SSRF block');
  });
});
